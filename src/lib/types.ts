import type { Address, BuildingInsights, SolarPanel } from './google';

export type { Address };

export type City =
  | 'Berlin'
  | 'Munich'
  | 'Hamburg'
  | 'Frankfurt'
  | 'Cologne'
  | 'Stuttgart'
  | 'Düsseldorf'
  | 'Dresden'
  | 'Leipzig'
  | 'Bremen';

/** Standard residential load profiles. H0 is the BDEW German default. */
export type LoadProfileId = 'H0' | 'EVENING' | 'DAY' | 'CUSTOM';

/**
 * Installer-facing input schema. Energy values use kWh internally; Wh
 * equivalents are accepted on import.
 */
export interface FormInputs {
  // ---- meta (auto-generated) ----
  projectId: string;
  customerContactId?: string;
  requestCreatedAt: string; // ISO timestamp
  offerCreatedAt?: string; // stamped when proposal is generated
  firstSignedAt?: string;

  // ---- customer ----
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  // ---- location ----
  address: Address;
  country?: string; // 2-letter ISO (DE, AT, CH, …) — derived from address

  // ---- energy demand & pricing ----
  energyDemandKwh: number;
  energyPricePerKwh: number;
  energyPriceIncreasePct: number; // annual %, eg 3 for 3%
  energyPriceFlexibleTariff: boolean;
  basePricePerMonth: number; // € fixed monthly grid fee
  basePriceIncreasePct: number;
  loadProfile: LoadProfileId;
  loadProfileEditorId?: string;

  // ---- household ----
  numInhabitants?: number;

  // ---- existing solar (relevant only when hasSolar=true) ----
  hasSolar: boolean;
  solarSizeKw?: number;
  solarAngleDeg?: number;
  solarOrientationDeg?: number;
  solarBuiltYear?: number;
  solarFeedInPerKwh?: number;
  solarFeedInPostEegPerKwh?: number;

  // ---- existing storage ----
  hasStorage: boolean;
  storageSizeKwh?: number;
  storageBuiltYear?: number;

  // ---- existing wallbox ----
  hasWallbox: boolean;
  wallboxChargeSpeedKw?: number;

  // ---- vehicles ----
  hasEv: boolean;
  evAnnualKm: number;

  budgetEur?: number;
}

/** Represents a single line item in the granular CPQ Bill of Materials. */
export interface BomItem {
  category: 'hardware' | 'labor' | 'service';
  componentType: string;
  name: string;
  brand?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

/** Detailed cost aggregation for the entire project quotation. */
export interface CostBreakdown {
  bom: BomItem[];
  hardwareTotal: number;
  laborTotal: number;
  serviceTotal: number;
  total: number;
}

/** Knobs the user can turn on the SolarConfig screen. */
export interface SolarConfigInputs {
  panelsCount: number;
  panelWattage: number;
  batteryKwh: number;
  activePanels: SolarPanel[];
}

export interface SystemDesign {
  inputs: FormInputs;
  config: SolarConfigInputs;
  insights?: BuildingInsights | null;

  pvArrayKwp: number;
  modulesCount: number;
  batteryKwh: number;
  inverterKw: number;
  annualProductionKwh: number;
  selfConsumptionRatio: number;
  cost: CostBreakdown;
  annualSavingsEur: number;
  paybackYears: number;
  co2ReductionTons: number;
  roofAreaM2: number;
  roofUtilizationPct: number;
  roi: { year: number; cumulative: number }[];
  budgetLimited: boolean;
}

/* ------------- helpers ------------- */

export function makeProjectId(): string {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `P-${date}-${rand}`;
}
