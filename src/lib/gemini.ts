/**
 * Frontend client for the Gemini extraction proxy. The Vite middleware
 * (see vite.config.ts) injects the API key and structured schema server-side.
 */
import type { ParsedInputs } from './parse';

interface ExtractResponse {
  fields?: ParsedInputs;
  error?: string;
}

const cache = new Map<string, ParsedInputs>();

export async function extractFromText(
  text: string,
  signal?: AbortSignal,
): Promise<ParsedInputs> {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const cached = cache.get(trimmed);
  if (cached) return cached;

  const res = await fetch('/api/gemini/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: trimmed }),
    signal,
  });

  const data = (await res.json()) as ExtractResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `gemini ${res.status}`);
  }
  const fields = sanitize(data.fields ?? {});
  cache.set(trimmed, fields);
  return fields;
}

/**
 * Drop empty fields and discard numeric values outside plausible ranges.
 */
function sanitize(raw: ParsedInputs): ParsedInputs {
  const out: ParsedInputs = {};
  if (raw.customerName) out.customerName = String(raw.customerName).trim();
  if (raw.customerAddress) out.customerAddress = String(raw.customerAddress).trim();
  if (raw.city) out.city = raw.city;
  if (typeof raw.energyDemandKwh === 'number' && raw.energyDemandKwh > 100 && raw.energyDemandKwh < 30000)
    out.energyDemandKwh = Math.round(raw.energyDemandKwh);
  if (typeof raw.energyPricePerKwh === 'number' && raw.energyPricePerKwh > 0.05 && raw.energyPricePerKwh < 1.5)
    out.energyPricePerKwh = raw.energyPricePerKwh;
  if (typeof raw.budgetEur === 'number' && raw.budgetEur > 1000 && raw.budgetEur < 200000)
    out.budgetEur = Math.round(raw.budgetEur);
  if (typeof raw.numInhabitants === 'number' && raw.numInhabitants > 0 && raw.numInhabitants < 20)
    out.numInhabitants = Math.round(raw.numInhabitants);
  if (typeof raw.hasEv === 'boolean') out.hasEv = raw.hasEv;
  if (typeof raw.evAnnualKm === 'number' && raw.evAnnualKm > 100 && raw.evAnnualKm < 100000)
    out.evAnnualKm = Math.round(raw.evAnnualKm);
  if (typeof raw.hasSolar === 'boolean') out.hasSolar = raw.hasSolar;
  if (typeof raw.hasStorage === 'boolean') out.hasStorage = raw.hasStorage;
  if (typeof raw.hasWallbox === 'boolean') out.hasWallbox = raw.hasWallbox;
  return out;
}

export interface PanelLayoutCommand {
  action: 'remove' | 'add';
  region: 'north' | 'south' | 'east' | 'west';
  count?: number;
}

export async function chatMapCommand(text: string): Promise<PanelLayoutCommand | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const res = await fetch('/api/gemini/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: trimmed }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error ?? `gemini ${res.status}`);
  }
  return data.functionCall as PanelLayoutCommand | null;
}
