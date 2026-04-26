import {
  pickConfigByCount,
  type BuildingInsights,
  type SolarPanelConfig,
} from './google';
import type { City, CostBreakdown, FormInputs, SolarConfigInputs, SystemDesign, BomItem } from './types';
import { generateSyntheticH0 } from './slp';

// Fallback yield (kWh per kWp per year) when Solar API yield isn't available
export const CITY_YIELDS: Record<City, number> = {
  Munich: 1150,
  Stuttgart: 1100,
  Frankfurt: 1050,
  Dresden: 1050,
  Berlin: 1000,
  Cologne: 1000,
  Düsseldorf: 1000,
  Leipzig: 1000,
  Bremen: 970,
  Hamburg: 950,
};
const DEFAULT_YIELD = 1000;

const EV_KWH_PER_KM = 0.18;

// Detailed BOM pricing baselines (EUR) based on German market averages
const PRICE_PANEL = 150;
const PRICE_OPTIMIZER = 45;
const PRICE_SUBSTRUCTURE_PER_PANEL = 35;
const PRICE_INVERTER_BASE = 800;
const PRICE_INVERTER_PER_KW = 80;
const PRICE_BATTERY_PER_KWH = 500;
const PRICE_SMART_METER = 200;

const PRICE_SCAFFOLDING_BASE = 500;
const PRICE_SCAFFOLDING_PER_PANEL = 15;
const PRICE_INSTALL_INVERTER = 600;
const PRICE_INSTALL_BATTERY = 350;
const PRICE_INSTALL_PANEL_DC = 50; // DC installation per panel

const PRICE_TRAVEL_FLAT = 250;
const PRICE_PLANNING = 200;
const PRICE_METER_CABINET = 800;

const DEFAULT_FEED_IN_TARIFF = 0.082;
const GRID_CO2_KG_PER_KWH = 0.38;
const DEFAULT_ELECTRICITY_INFLATION = 0.03;
const M2_PER_MODULE = 2.0;

export function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Fallback yield calculation based on city-specific solar data for Germany.
 * @param inputs - User form inputs containing address data.
 * @returns Predicted annual yield in kWh per kWp.
 */
function fallbackYield(inputs: FormInputs): number {
  const city = (inputs.address.city as City | undefined) ?? null;
  if (city && city in CITY_YIELDS) return CITY_YIELDS[city];
  return DEFAULT_YIELD;
}

/**
 * Pick a sensible default panel count + battery for the given roof + inputs.
 * Used as the initial state for the SolarConfig screen.
 */
export function defaultConfigForBuilding(
  insights: BuildingInsights | null,
  inputs: FormInputs,
): SolarConfigInputs {
  const panelCapacityWatts = insights?.solarPotential?.panelCapacityWatts ?? 400;
  const configs = insights?.solarPotential?.solarPanelConfigs;
  const maxPanels = configs && configs.length ? configs[configs.length - 1].panelsCount : 12;

  // Aim for ~110% of demand
  const evKwh = inputs.hasEv ? inputs.evAnnualKm * EV_KWH_PER_KM : 0;
  const annualDemand = inputs.energyDemandKwh + evKwh;


  // By user request, start with the maximum possible system size to ensure
  // full roof coverage and immediate visibility of potential.
  const panelsCount = maxPanels;

  const dailyDemand = annualDemand / 365;
  const batteryKwh = clamp(Math.round(dailyDemand * 0.6), 0, 12);

  return {
    panelsCount,
    panelWattage: panelCapacityWatts,
    batteryKwh,
    activePanels: [], // Initialized as empty, to be populated by the caller if needed
  };
}

/**
 * Determines the best available solar yield estimate for the property.
 * Prioritizes actual geometry-based insights from Google Solar API.
 * @param insights - Rooftop analysis data.
 * @param inputs - Location data for fallback yield lookup.
 * @returns Annual kWh/kWp estimate.
 */
export function bestYield(
  insights: BuildingInsights | null | undefined,
  inputs: FormInputs,
): number {
  if (insights?.solarPotential?.solarPanelConfigs?.length) {
    const configs = insights.solarPotential.solarPanelConfigs;
    const cap = insights.solarPotential.panelCapacityWatts || 400;
    // Yield from the largest config: total kWh / total kWp.
    const last = configs[configs.length - 1];
    const kwp = (last.panelsCount * cap) / 1000;
    if (kwp > 0) return last.yearlyEnergyDcKwh / kwp;
  }
  return fallbackYield(inputs);
}

export function generateBOM(
  panelsCount: number,
  panelWattage: number,
  batteryKwh: number,
  inverterKw: number
): CostBreakdown {
  const bom: BomItem[] = [];

  // --- HARDWARE ---
  bom.push({
    category: 'hardware',
    componentType: 'Module',
    name: `PV Module ${panelWattage}W TOPCon`,
    quantity: panelsCount,
    unit: 'pcs',
    unitPrice: PRICE_PANEL,
    totalPrice: panelsCount * PRICE_PANEL,
  });

  bom.push({
    category: 'hardware',
    componentType: 'ModuleFrameConstruction',
    name: 'Substructure Roof Mounting System',
    quantity: panelsCount,
    unit: 'pcs',
    unitPrice: PRICE_SUBSTRUCTURE_PER_PANEL,
    totalPrice: panelsCount * PRICE_SUBSTRUCTURE_PER_PANEL,
  });

  bom.push({
    category: 'hardware',
    componentType: 'AccessoryToModule',
    name: 'Power Optimizer',
    brand: 'Huawei',
    quantity: panelsCount,
    unit: 'pcs',
    unitPrice: PRICE_OPTIMIZER,
    totalPrice: panelsCount * PRICE_OPTIMIZER,
  });

  const invPrice = Math.round(PRICE_INVERTER_BASE + inverterKw * PRICE_INVERTER_PER_KW);
  bom.push({
    category: 'hardware',
    componentType: 'Inverter',
    name: `Hybrid Inverter ${Math.ceil(inverterKw)}kW`,
    brand: 'Huawei',
    quantity: 1,
    unit: 'pcs',
    unitPrice: invPrice,
    totalPrice: invPrice,
  });

  if (batteryKwh > 0) {
    const battPrice = Math.round(batteryKwh * PRICE_BATTERY_PER_KWH);
    bom.push({
      category: 'hardware',
      componentType: 'BatteryStorage',
      name: `Battery Storage ${batteryKwh}kWh`,
      brand: 'Huawei',
      quantity: 1,
      unit: 'pcs',
      unitPrice: battPrice,
      totalPrice: battPrice,
    });
  }

  bom.push({
    category: 'hardware',
    componentType: 'AccessoryToModule',
    name: 'Smart Energy Meter',
    brand: 'Huawei',
    quantity: 1,
    unit: 'pcs',
    unitPrice: PRICE_SMART_METER,
    totalPrice: PRICE_SMART_METER,
  });

  // --- LABOR ---
  const scaffoldPrice = PRICE_SCAFFOLDING_BASE + panelsCount * PRICE_SCAFFOLDING_PER_PANEL;
  bom.push({
    category: 'labor',
    componentType: 'ModuleFrameConstruction',
    name: 'Scaffolding Setup & Removal',
    quantity: 1,
    unit: 'lump sum',
    unitPrice: scaffoldPrice,
    totalPrice: scaffoldPrice,
  });

  const dcInstallPrice = panelsCount * PRICE_INSTALL_PANEL_DC;
  bom.push({
    category: 'labor',
    componentType: 'AccessoryToModule',
    name: 'DC Installation Roof',
    quantity: panelsCount,
    unit: 'pcs',
    unitPrice: PRICE_INSTALL_PANEL_DC,
    totalPrice: dcInstallPrice,
  });

  bom.push({
    category: 'labor',
    componentType: 'InstallationFee',
    name: 'Install & Commission Inverter',
    quantity: 1,
    unit: 'lump sum',
    unitPrice: PRICE_INSTALL_INVERTER,
    totalPrice: PRICE_INSTALL_INVERTER,
  });

  if (batteryKwh > 0) {
    bom.push({
      category: 'labor',
      componentType: 'InstallationFee',
      name: 'Install Battery Storage',
      quantity: 1,
      unit: 'lump sum',
      unitPrice: PRICE_INSTALL_BATTERY,
      totalPrice: PRICE_INSTALL_BATTERY,
    });
  }

  bom.push({
    category: 'labor',
    componentType: 'InstallationFee',
    name: 'Meter Cabinet Modification / AC Integration',
    quantity: 1,
    unit: 'lump sum',
    unitPrice: PRICE_METER_CABINET,
    totalPrice: PRICE_METER_CABINET,
  });

  // --- SERVICES ---
  bom.push({
    category: 'service',
    componentType: 'ServiceFee',
    name: 'Travel & Logistics',
    quantity: 1,
    unit: 'lump sum',
    unitPrice: PRICE_TRAVEL_FLAT,
    totalPrice: PRICE_TRAVEL_FLAT,
  });

  bom.push({
    category: 'service',
    componentType: 'InstallationFee',
    name: 'Planning, Registration & Consulting',
    quantity: 1,
    unit: 'lump sum',
    unitPrice: PRICE_PLANNING,
    totalPrice: PRICE_PLANNING,
  });

  const hardwareTotal = bom.filter(i => i.category === 'hardware').reduce((sum, i) => sum + i.totalPrice, 0);
  const laborTotal = bom.filter(i => i.category === 'labor').reduce((sum, i) => sum + i.totalPrice, 0);
  const serviceTotal = bom.filter(i => i.category === 'service').reduce((sum, i) => sum + i.totalPrice, 0);

  return {
    bom,
    hardwareTotal,
    laborTotal,
    serviceTotal,
    total: hardwareTotal + laborTotal + serviceTotal,
  };
}

/**
 * Compute a complete SystemDesign from the form inputs and the user's
 * configuration. Solar API insights, when present, refine the production
 * estimate; otherwise the city/default yield is used.
 */
export function design(
  inputs: FormInputs,
  config: SolarConfigInputs,
  insights: BuildingInsights | null = null,
): SystemDesign {
  const { panelsCount, panelWattage, batteryKwh, activePanels } = config;

  const pvArrayKwp = round1((panelsCount * panelWattage) / 1000);
  const inverterKw = round1(pvArrayKwp * 0.9);
  const cost = generateBOM(panelsCount, panelWattage, batteryKwh, inverterKw);

  // Annual production calculation
  let annualProductionKwh: number;

  if (activePanels && activePanels.length > 0) {
    // If we have specific active panels (e.g. from the map), sum their energy
    const totalEnergy = activePanels.reduce((sum, p) => sum + (p.yearlyEnergyDcKwh || 0), 0);
    // Adjust if user is using a non-default wattage
    const apiPanelW = insights?.solarPotential?.panelCapacityWatts ?? 400;
    annualProductionKwh = Math.round(totalEnergy * (panelWattage / apiPanelW));
  } else {
    // Fallback: use Solar API configs if count matches, else use yield-based estimate
    const cfg = pickConfigForCount(insights?.solarPotential?.solarPanelConfigs, panelsCount);
    if (cfg && Math.abs(cfg.panelsCount - panelsCount) <= 2) {
      const apiPanelW = insights?.solarPotential?.panelCapacityWatts ?? 400;
      annualProductionKwh = Math.round(cfg.yearlyEnergyDcKwh * (panelWattage / apiPanelW));
    } else {
      const y = bestYield(insights, inputs);
      annualProductionKwh = Math.round(pvArrayKwp * y);
    }
  }

  const evKwh = inputs.hasEv ? inputs.evAnnualKm * EV_KWH_PER_KM : 0;
  const annualDemand = inputs.energyDemandKwh + evKwh;

  const selfConsumptionRatio = batteryKwh > 0 ? 0.7 : 0.3;
  const useful = Math.min(annualProductionKwh, annualDemand) * selfConsumptionRatio;
  const direct = useful * inputs.energyPricePerKwh;
  const excess = Math.max(0, annualProductionKwh - useful);
  const feedIn = excess * (inputs.solarFeedInPerKwh ?? DEFAULT_FEED_IN_TARIFF);
  const annualSavingsEur = Math.round(direct + feedIn);

  const paybackYears = annualSavingsEur > 0 ? round1(cost.total / annualSavingsEur) : 99;
  const co2ReductionTons = round1((annualProductionKwh * GRID_CO2_KG_PER_KWH) / 1000);

  // Roof utilization. Solar API provides the actual roof area.
  const roofAreaM2 = Math.round(insights?.solarPotential?.wholeRoofStats?.areaMeters2 ?? 0);
  const usedArea = panelsCount * M2_PER_MODULE;
  const roofUtilizationPct =
    roofAreaM2 > 0 ? Math.min(100, Math.round((usedArea / roofAreaM2) * 100)) : 0;

  // ROI timeline using the customer-supplied escalation rate.
  const inflation = inputs.energyPriceIncreasePct
    ? inputs.energyPriceIncreasePct / 100
    : DEFAULT_ELECTRICITY_INFLATION;
  const roi: { year: number; cumulative: number }[] = [];
  let cum = -cost.total;
  roi.push({ year: 0, cumulative: cum });
  for (let y = 1; y <= 25; y++) {
    cum += annualSavingsEur * Math.pow(1 + inflation, y - 1);
    roi.push({ year: y, cumulative: Math.round(cum) });
  }

  return {
    inputs,
    config,
    insights,
    pvArrayKwp,
    modulesCount: panelsCount,
    batteryKwh,
    inverterKw,
    annualProductionKwh,
    selfConsumptionRatio,
    cost,
    annualSavingsEur,
    paybackYears,
    co2ReductionTons,
    roofAreaM2,
    roofUtilizationPct,
    roi,
    budgetLimited: inputs.budgetEur ? cost.total > inputs.budgetEur : false,
  };
}

function pickConfigForCount(
  configs: SolarPanelConfig[] | undefined,
  panelsCount: number,
): SolarPanelConfig | null {
  return pickConfigByCount(configs, panelsCount);
}

export interface HourlyResult {
  consumption: number;
  generation: number;
  soc: number;
}

export function simulateBattery(annualConsumption: number, annualGeneration: number, batteryCapacityKwh: number): HourlyResult[] {
  const h0 = generateSyntheticH0();
  const hoursInYear = 8760;
  
  const consumptionScale = annualConsumption / 1000;
  
  const results: HourlyResult[] = [];
  
  for (let h = 0; h < hoursInYear; h++) {
    const hourOfDay = h % 24;
    const dayOfYear = Math.floor(h / 24);
    
    let gen = 0;
    if (hourOfDay > 6 && hourOfDay < 18) {
      const x = (hourOfDay - 12) / 6;
      gen = Math.max(0, 1 - x * x);
    }
    const seasonalGen = 1.0 - 0.5 * Math.cos((dayOfYear / 365) * 2 * Math.PI);
    gen *= seasonalGen;
    
    const con = h0[h] * consumptionScale;
    
    results.push({
      consumption: con,
      generation: gen,
      soc: 0
    });
  }
  
  const totalGen = results.reduce((acc, curr) => acc + curr.generation, 0);
  const genScale = totalGen > 0 ? annualGeneration / totalGen : 0;
  
  let soc = 0;
  for (let h = 0; h < hoursInYear; h++) {
    const gen = results[h].generation * genScale;
    const con = results[h].consumption;
    
    const net = gen - con;
    soc = Math.max(0, Math.min(batteryCapacityKwh, soc + net));
    
    results[h].generation = gen;
    results[h].soc = soc;
  }
  
  return results;
}

export function compute24HourAverage(results: HourlyResult[]): HourlyResult[] {
  const avg: HourlyResult[] = Array.from({ length: 24 }, () => ({ consumption: 0, generation: 0, soc: 0 }));
  
  for (let h = 0; h < 8760; h++) {
    const hour = h % 24;
    avg[hour].consumption += results[h].consumption;
    avg[hour].generation += results[h].generation;
    avg[hour].soc += results[h].soc;
  }
  
  const days = 365;
  for (let i = 0; i < 24; i++) {
    avg[i].consumption /= days;
    avg[i].generation /= days;
    avg[i].soc /= days;
  }
  
  return avg;
}
