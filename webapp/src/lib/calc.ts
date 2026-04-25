import {
  pickConfigByCount,
  type BuildingInsights,
  type SolarPanelConfig,
} from './google';
import type { City, CostBreakdown, FormInputs, SolarConfigInputs, SystemDesign } from './types';

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

// EUR cost rates, indicative German market values.
const PV_EUR_PER_KWP = 1000;
const BATTERY_EUR_PER_KWH = 700;
const INSTALL_BASE_EUR = 2000;
const INSTALL_EUR_PER_KWP = 100;

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
  const yieldPerKwp = bestYield(insights, inputs);

  let targetKwp = (annualDemand * 1.1) / yieldPerKwp;
  // Soft budget cap: don't recommend something that obviously bursts the budget
  if (inputs.budgetEur) {
    const softBudgetKwp =
      (inputs.budgetEur - INSTALL_BASE_EUR - 4 * BATTERY_EUR_PER_KWH) /
      (PV_EUR_PER_KWP + INSTALL_EUR_PER_KWP);
    if (softBudgetKwp > 0) targetKwp = Math.min(targetKwp, softBudgetKwp);
  }

  const targetPanels = Math.round((targetKwp * 1000) / panelCapacityWatts);
  const panelsCount = clamp(targetPanels, 1, maxPanels);

  const dailyDemand = annualDemand / 365;
  const batteryKwh = clamp(Math.round(dailyDemand * 0.6), 0, 12);

  return {
    panelsCount,
    panelWattage: panelCapacityWatts,
    batteryKwh,
  };
}

/** Best yield estimate (kWh/kWp/yr): from Solar API when usable, else city/default. */
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

export function computeCost(pvKwp: number, batteryKwh: number): CostBreakdown {
  const pvSystem = Math.round(pvKwp * PV_EUR_PER_KWP);
  const battery = Math.round(batteryKwh * BATTERY_EUR_PER_KWH);
  const installation = Math.round(INSTALL_BASE_EUR + pvKwp * INSTALL_EUR_PER_KWP);
  return { pvSystem, battery, installation, total: pvSystem + battery + installation };
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
  const { panelsCount, panelWattage, batteryKwh } = config;

  const pvArrayKwp = round1((panelsCount * panelWattage) / 1000);
  const inverterKw = round1(pvArrayKwp * 0.9);
  const cost = computeCost(pvArrayKwp, batteryKwh);

  // Annual production:
  // 1) If Solar API supplied a panel config matching our count, use its kWh
  // 2) Else: scale Solar API's yield-per-kWp by our chosen kWp
  // 3) Else: city/default yield
  const cfg = pickConfigForCount(insights?.solarPotential?.solarPanelConfigs, panelsCount);
  let annualProductionKwh: number;
  if (cfg && Math.abs(cfg.panelsCount - panelsCount) <= 2) {
    // Adjust if user is using a non-default wattage
    const apiPanelW = insights?.solarPotential?.panelCapacityWatts ?? 400;
    annualProductionKwh = Math.round(cfg.yearlyEnergyDcKwh * (panelWattage / apiPanelW));
  } else {
    const y = bestYield(insights, inputs);
    annualProductionKwh = Math.round(pvArrayKwp * y);
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
