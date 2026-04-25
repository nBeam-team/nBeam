import type { City } from './types';

const CITIES: City[] = [
  'Berlin',
  'Munich',
  'Hamburg',
  'Frankfurt',
  'Cologne',
  'Stuttgart',
  'Düsseldorf',
  'Dresden',
  'Leipzig',
  'Bremen',
];

const CITY_ALIASES: Record<string, City> = {
  berlin: 'Berlin',
  munich: 'Munich',
  munchen: 'Munich',
  münchen: 'Munich',
  hamburg: 'Hamburg',
  frankfurt: 'Frankfurt',
  cologne: 'Cologne',
  köln: 'Cologne',
  koln: 'Cologne',
  stuttgart: 'Stuttgart',
  düsseldorf: 'Düsseldorf',
  dusseldorf: 'Düsseldorf',
  duesseldorf: 'Düsseldorf',
  dresden: 'Dresden',
  leipzig: 'Leipzig',
  bremen: 'Bremen',
};

/** Subset of FormInputs the natural-language parser can populate. */
export interface ParsedInputs {
  energyDemandKwh?: number;
  budgetEur?: number;
  energyPricePerKwh?: number;
  hasEv?: boolean;
  evAnnualKm?: number;
  city?: City; // Tavily/snapshot hint — not stored in FormInputs
  customerName?: string;
  /** Full street address; geocoded by InputForm to auto-fill the address field. */
  customerAddress?: string;
  numInhabitants?: number;
  hasSolar?: boolean;
  hasStorage?: boolean;
  hasWallbox?: boolean;
}

export interface ParseResult {
  inputs: ParsedInputs;
  found: Partial<Record<keyof ParsedInputs, true>>;
}

/** Defaults for fields that aren't required to submit. */
export const DEFAULT_PARTIAL = {
  energyDemandKwh: 4500,
  budgetEur: 25000,
  energyPricePerKwh: 0.45,
  energyPriceIncreasePct: 3,
  energyPriceFlexibleTariff: false,
  basePricePerMonth: 12,
  basePriceIncreasePct: 2,
  loadProfile: 'H0' as const,
  hasEv: false,
  evAnnualKm: 15000,
  hasSolar: false,
  hasStorage: false,
  hasWallbox: false,
};

function parseLoose(raw: string): number {
  const cleaned = raw.replace(/[,_\s]/g, '').toLowerCase();
  if (/k$/.test(cleaned)) return Math.round(parseFloat(cleaned) * 1000);
  return parseFloat(cleaned);
}

const NUM = String.raw`(\d+(?:[.,]\d+)?)\s*k?`;

export function parseNaturalLanguage(text: string): ParseResult {
  const inputs: ParsedInputs = {};
  const found: ParseResult['found'] = {};
  if (!text || !text.trim()) return { inputs, found };

  const t = text.toLowerCase();

  // --- city ---
  for (const key of Object.keys(CITY_ALIASES)) {
    const re = new RegExp(`\\b${key}\\b`, 'i');
    if (re.test(t)) {
      inputs.city = CITY_ALIASES[key];
      found.city = true;
      break;
    }
  }

  // --- electricity (kWh / yr) ---
  const kwhMatch = t.match(new RegExp(`${NUM}\\s*kwh`));
  if (kwhMatch) {
    const v = parseLoose(kwhMatch[1] + (kwhMatch[0].includes('k') && !kwhMatch[0].includes('kwh') ? 'k' : ''));
    if (v >= 100 && v <= 30000) {
      inputs.energyDemandKwh = Math.round(v);
      found.energyDemandKwh = true;
    }
  } else {
    const altElec = t.match(/(?:use|consume|using|consumes?)[^.]*?(\d[\d,.]{2,})/);
    if (altElec) {
      const v = parseLoose(altElec[1]);
      if (v >= 1000 && v <= 30000) {
        inputs.energyDemandKwh = Math.round(v);
        found.energyDemandKwh = true;
      }
    }
  }

  // --- budget (€) ---
  const budgetCandidates: number[] = [];
  const euroNum = t.matchAll(/(?:€|eur(?:os?)?)\s*(\d+(?:[.,]\d+)?)\s*k?/g);
  for (const m of euroNum) {
    const raw = m[1] + (m[0].toLowerCase().endsWith('k') ? 'k' : '');
    const v = parseLoose(raw);
    if (v >= 1000 && v <= 200000) budgetCandidates.push(v);
  }
  const numEuro = t.matchAll(/(\d+(?:[.,]\d+)?)\s*k?\s*(?:€|eur(?:os?)?)/g);
  for (const m of numEuro) {
    const raw = m[1] + (m[0].toLowerCase().includes('k') && !m[0].toLowerCase().includes('kwh') ? 'k' : '');
    const v = parseLoose(raw);
    if (v >= 1000 && v <= 200000) budgetCandidates.push(v);
  }
  const budgetWord = t.match(
    /budget(?:\s+(?:is|of|around|about))?\s*(?:€)?\s*(\d+(?:[.,]\d+)?)\s*(k|thousand)?/,
  );
  if (budgetWord) {
    let v = parseFloat(budgetWord[1].replace(',', ''));
    if (budgetWord[2]) v *= 1000;
    if (v >= 1000 && v <= 200000) budgetCandidates.push(v);
  }
  if (budgetCandidates.length) {
    const v = budgetCandidates.sort((a, b) => b - a)[0];
    inputs.budgetEur = Math.round(v);
    found.budgetEur = true;
  }

  // --- electricity price ---
  const priceMatch = t.match(/(?:€|eur)?\s*(0?\.\d{1,2})\s*(?:€)?\s*\/?\s*(?:per\s*)?kwh/);
  if (priceMatch) {
    const v = parseFloat(priceMatch[1]);
    if (v >= 0.05 && v <= 1.5) {
      inputs.energyPricePerKwh = v;
      found.energyPricePerKwh = true;
    }
  } else {
    const cents = t.match(/(\d{1,3})\s*(?:cents?|ct|c)\s*(?:\/|per)?\s*kwh/);
    if (cents) {
      const v = parseInt(cents[1], 10) / 100;
      if (v >= 0.05 && v <= 1.5) {
        inputs.energyPricePerKwh = v;
        found.energyPricePerKwh = true;
      }
    }
  }

  // --- num inhabitants ---
  const inhab = t.match(/\b(\d{1,2})\s*(?:people|inhabitants?|residents?|in\s+(?:my|our|the)\s+(?:family|home|household)|family|adults?|person)/);
  if (inhab) {
    const n = parseInt(inhab[1], 10);
    if (n >= 1 && n <= 12) {
      inputs.numInhabitants = n;
      found.numInhabitants = true;
    }
  }

  // --- existing equipment ---
  if (/already\s+(?:have|own|got)\s+(?:solar|pv|panels)/.test(t) || /existing\s+solar/.test(t)) {
    inputs.hasSolar = true;
    found.hasSolar = true;
  }
  if (/already\s+(?:have|own|got)\s+(?:battery|storage)/.test(t) || /existing\s+(?:battery|storage)/.test(t)) {
    inputs.hasStorage = true;
    found.hasStorage = true;
  }
  if (/wallbox|home\s+charger/.test(t)) {
    inputs.hasWallbox = true;
    found.hasWallbox = true;
  }

  // --- EV ---
  const evRe = /\b(ev|electric\s+vehicle|electric\s+car|tesla|polestar|i\d|e-tron|ioniq)\b/;
  if (evRe.test(t)) {
    inputs.hasEv = true;
    found.hasEv = true;
    const km = t.match(/(\d+(?:[.,]\d+)?)\s*k?\s*(?:km|kilomet(?:er|re)s?|miles?)\s*(?:\/|per)?\s*(?:year|yr|annum|a)?/);
    if (km) {
      const raw = km[1] + (km[0].toLowerCase().includes('k') && !km[0].toLowerCase().includes('km') ? 'k' : '');
      let v = parseLoose(raw);
      if (km[0].toLowerCase().includes('mile')) v = Math.round(v * 1.609);
      if (v >= 500 && v <= 60000) {
        inputs.evAnnualKm = Math.round(v);
        found.evAnnualKm = true;
      }
    }
  } else if (/\b(no\s+ev|no\s+electric\s+(car|vehicle))\b/.test(t)) {
    inputs.hasEv = false;
    found.hasEv = true;
  }

  return { inputs, found };
}

export const NL_EXAMPLE =
  "Anna Müller lives at Am Wriezener Bhf, 10243 Berlin-Bezirk Friedrichshain-Kreuzberg, Germany. Family of 4, uses about 5,000 kWh of electricity a year. Budget around €20,000, pays €0.42 per kWh. Drives an EV about 12,000 km/year.";

export { CITIES };
