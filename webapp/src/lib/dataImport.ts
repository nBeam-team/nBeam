/**
 * Structured data importer.
 *
 * Accepts JSON (single record or array, first used), TSV (Excel paste with
 * header row + value row), and CSV. Maps the snake_case schema onto the
 * internal camelCase FormInputs. A few alternate keys are accepted for
 * compatibility with upstream sources (psolar_angle, has_wallboxwall,
 * box_charge_speed_kw).
 */
import type { FormInputs, LoadProfileId } from './types';

export type ImportFormat = 'json' | 'tsv' | 'csv' | 'unknown';

export type ImportedFields = Omit<Partial<FormInputs>, 'address'>;

export interface ImportResult {
  format: ImportFormat;
  fields: ImportedFields;
  /** Keys that produced a value, by canonical schema name (snake_case). */
  matched: string[];
  /** Key:value entries we couldn't map to a schema field. */
  unknown: Record<string, string>;
  error?: string;
}

const SAMPLE_JSON = `{
  "project_id": "P-2026-0834",
  "customer_contact_id": "C-1102",
  "customer_name": "Anna Müller",
  "customer_email": "anna.mueller@example.de",
  "country": "DE",
  "energy_demand_wh": 4500000,
  "energy_price_per_wh": 0.00042,
  "energy_price_increase": 0.03,
  "energy_price_with_flexible_tariff": false,
  "base_price_per_month": 12.50,
  "base_price_increase": 0.02,
  "load_profile": "H0",
  "num_inhabitants": 4,
  "has_ev": true,
  "ev_annual_drive_distance_km": 12000,
  "has_solar": false,
  "has_storage": false,
  "has_wallbox": true,
  "wallbox_charge_speed_kw": 11
}`;

const SAMPLE_TSV =
  'project_id\tcustomer_name\tenergy_demand_wh\tenergy_price_per_wh\tnum_inhabitants\thas_ev\tev_annual_drive_distance_km\thas_solar\thas_storage\thas_wallbox\n' +
  'P-2026-0521\tThomas Weber\t6200000\t0.00045\t5\ttrue\t18000\tfalse\tfalse\ttrue';

export const SAMPLE_INPUTS = {
  json: SAMPLE_JSON,
  tsv: SAMPLE_TSV,
};

export function detectFormat(raw: string): ImportFormat {
  const text = raw.trim();
  if (!text) return 'unknown';
  if (text.startsWith('{') || text.startsWith('[')) return 'json';
  const tabCount = (text.match(/\t/g) ?? []).length;
  if (tabCount >= 3) return 'tsv';
  // Multi-line CSV with multiple commas in a structured way
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length >= 2 && lines[0].split(',').length >= 3) return 'csv';
  // Single-line key=value, key:value, etc → treat as TSV/CSV-ish
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*[:=]/.test(text)) return 'csv';
  return 'unknown';
}

export function parseImport(raw: string): ImportResult {
  const text = raw.trim();
  if (!text) return { format: 'unknown', fields: {}, matched: [], unknown: {} };

  const format = detectFormat(text);
  try {
    if (format === 'json') {
      const obj = JSON.parse(text);
      const record = Array.isArray(obj) ? obj[0] ?? {} : obj;
      return mapRecord(record, 'json');
    }
    if (format === 'tsv') return parseTabular(text, '\t');
    if (format === 'csv') return parseTabular(text, ',');
  } catch (e) {
    return {
      format,
      fields: {},
      matched: [],
      unknown: {},
      error: (e as Error).message,
    };
  }
  return { format: 'unknown', fields: {}, matched: [], unknown: {} };
}

/* ---------------- Tabular (TSV/CSV) ---------------- */

function parseTabular(text: string, sep: string): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { format: sep === '\t' ? 'tsv' : 'csv', fields: {}, matched: [], unknown: {} };

  // Try header+row layout
  if (lines.length >= 2 && lines[0].includes(sep)) {
    const headers = splitRow(lines[0], sep);
    const values = splitRow(lines[1], sep);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] ?? '';
    });
    return mapRecord(obj, sep === '\t' ? 'tsv' : 'csv');
  }

  // Try key:value-per-line layout
  const obj: Record<string, unknown> = {};
  for (const line of lines) {
    const m = line.match(/^([^:=,\t]+)[:=](.+)$/);
    if (!m) continue;
    obj[m[1].trim()] = m[2].trim();
  }
  return mapRecord(obj, 'csv');
}

function splitRow(row: string, sep: string): string[] {
  // Naive split. Quoted commas require a fuller parser, not handled here.
  return row.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
}

/* ---------------- Mapping snake_case → FormInputs ---------------- */

function mapRecord(rawObj: Record<string, unknown>, format: ImportFormat): ImportResult {
  const norm: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawObj)) {
    const key = k
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
    norm[key] = v;
  }

  const fields: ImportedFields = {};
  const matched: string[] = [];
  const unknown: Record<string, string> = {};

  // --- meta ---
  pull(norm, 'project_id', (v) => set(fields, matched, 'projectId', String(v), 'project_id'));
  pull(norm, 'customer_contact_id', (v) =>
    set(fields, matched, 'customerContactId', String(v), 'customer_contact_id'),
  );
  pull(norm, 'request_created_at', (v) =>
    set(fields, matched, 'requestCreatedAt', String(v), 'request_created_at'),
  );
  pull(norm, 'offer_created_at', (v) =>
    set(fields, matched, 'offerCreatedAt', String(v), 'offer_created_at'),
  );
  pull(norm, 'first_signed_at', (v) =>
    set(fields, matched, 'firstSignedAt', String(v), 'first_signed_at'),
  );
  pull(norm, 'country', (v) => set(fields, matched, 'country', String(v).toUpperCase(), 'country'));

  // --- customer ---
  pull(norm, 'customer_name', (v) =>
    set(fields, matched, 'customerName', String(v), 'customer_name'),
  );
  pull(norm, 'customer_email', (v) =>
    set(fields, matched, 'customerEmail', String(v), 'customer_email'),
  );
  pull(norm, 'customer_phone', (v) =>
    set(fields, matched, 'customerPhone', String(v), 'customer_phone'),
  );

  // --- energy demand (Wh or kWh) ---
  if (norm.energy_demand_kwh !== undefined) {
    const v = num(norm.energy_demand_kwh);
    if (Number.isFinite(v)) set(fields, matched, 'energyDemandKwh', v, 'energy_demand_kwh');
    delete norm.energy_demand_kwh;
  } else if (norm.energy_demand_wh !== undefined) {
    const v = num(norm.energy_demand_wh) / 1000;
    if (Number.isFinite(v)) set(fields, matched, 'energyDemandKwh', v, 'energy_demand_wh');
    delete norm.energy_demand_wh;
  }

  // --- price (€/Wh or €/kWh) ---
  if (norm.energy_price_per_kwh !== undefined) {
    const v = num(norm.energy_price_per_kwh);
    if (Number.isFinite(v)) set(fields, matched, 'energyPricePerKwh', v, 'energy_price_per_kwh');
    delete norm.energy_price_per_kwh;
  } else if (norm.energy_price_per_wh !== undefined) {
    const v = num(norm.energy_price_per_wh) * 1000;
    if (Number.isFinite(v)) set(fields, matched, 'energyPricePerKwh', v, 'energy_price_per_wh');
    delete norm.energy_price_per_wh;
  }

  pull(norm, 'energy_price_increase', (v) => {
    const raw = num(v);
    if (Number.isFinite(raw)) {
      // Accept fraction (0.03) or percent (3); normalize to percent.
      const pct = raw < 1 ? raw * 100 : raw;
      set(fields, matched, 'energyPriceIncreasePct', pct, 'energy_price_increase');
    }
  });
  pull(norm, 'energy_price_with_flexible_tariff', (v) =>
    set(fields, matched, 'energyPriceFlexibleTariff', bool(v), 'energy_price_with_flexible_tariff'),
  );
  pull(norm, 'base_price_per_month', (v) => {
    const raw = num(v);
    if (Number.isFinite(raw)) set(fields, matched, 'basePricePerMonth', raw, 'base_price_per_month');
  });
  pull(norm, 'base_price_increase', (v) => {
    const raw = num(v);
    if (Number.isFinite(raw)) {
      const pct = raw < 1 ? raw * 100 : raw;
      set(fields, matched, 'basePriceIncreasePct', pct, 'base_price_increase');
    }
  });

  pull(norm, 'load_profile', (v) => {
    const id = String(v).toUpperCase() as LoadProfileId;
    set(fields, matched, 'loadProfile', id, 'load_profile');
  });
  pull(norm, 'load_profile_editor_id', (v) =>
    set(fields, matched, 'loadProfileEditorId', String(v), 'load_profile_editor_id'),
  );

  // --- household ---
  pull(norm, 'num_inhabitants', (v) => {
    const n = Math.round(num(v));
    if (Number.isFinite(n)) set(fields, matched, 'numInhabitants', n, 'num_inhabitants');
  });

  // --- EV ---
  pull(norm, 'has_ev', (v) => set(fields, matched, 'hasEv', bool(v), 'has_ev'));
  pull(norm, 'ev_annual_drive_distance_km', (v) => {
    const km = num(v);
    if (Number.isFinite(km)) set(fields, matched, 'evAnnualKm', km, 'ev_annual_drive_distance_km');
  });

  // --- existing solar ---
  pull(norm, 'has_solar', (v) => set(fields, matched, 'hasSolar', bool(v), 'has_solar'));
  pull(norm, 'solar_size_kw', (v) => {
    const n = num(v);
    if (Number.isFinite(n)) set(fields, matched, 'solarSizeKw', n, 'solar_size_kw');
  });
  // Accept either canonical or alternate key spelling.
  if (norm.solar_angle !== undefined || norm.psolar_angle !== undefined) {
    const n = num(norm.solar_angle ?? norm.psolar_angle);
    if (Number.isFinite(n)) {
      set(fields, matched, 'solarAngleDeg', n, norm.solar_angle !== undefined ? 'solar_angle' : 'psolar_angle');
    }
    delete norm.solar_angle;
    delete norm.psolar_angle;
  }
  pull(norm, 'solar_orientation', (v) => {
    const n = num(v);
    if (Number.isFinite(n)) set(fields, matched, 'solarOrientationDeg', n, 'solar_orientation');
  });
  pull(norm, 'solar_built_year', (v) => {
    const n = Math.round(num(v));
    if (Number.isFinite(n)) set(fields, matched, 'solarBuiltYear', n, 'solar_built_year');
  });
  pull(norm, 'solar_feedin_renumeration', (v) => {
    const n = num(v);
    if (Number.isFinite(n)) set(fields, matched, 'solarFeedInPerKwh', n, 'solar_feedin_renumeration');
  });
  pull(norm, 'solar_feedin_renumeration_post_eeg', (v) => {
    const n = num(v);
    if (Number.isFinite(n))
      set(fields, matched, 'solarFeedInPostEegPerKwh', n, 'solar_feedin_renumeration_post_eeg');
  });

  // --- existing storage ---
  pull(norm, 'has_storage', (v) => set(fields, matched, 'hasStorage', bool(v), 'has_storage'));
  pull(norm, 'storage_size_kwh', (v) => {
    const n = num(v);
    if (Number.isFinite(n)) set(fields, matched, 'storageSizeKwh', n, 'storage_size_kwh');
  });
  pull(norm, 'storage_built_year', (v) => {
    const n = Math.round(num(v));
    if (Number.isFinite(n)) set(fields, matched, 'storageBuiltYear', n, 'storage_built_year');
  });

  // --- existing wallbox ---
  if (norm.has_wallbox !== undefined || norm.has_wallboxwall !== undefined) {
    const v = norm.has_wallbox ?? norm.has_wallboxwall;
    set(
      fields,
      matched,
      'hasWallbox',
      bool(v),
      norm.has_wallbox !== undefined ? 'has_wallbox' : 'has_wallboxwall',
    );
    delete norm.has_wallbox;
    delete norm.has_wallboxwall;
  }
  if (norm.wallbox_charge_speed_kw !== undefined || norm.box_charge_speed_kw !== undefined) {
    const v = norm.wallbox_charge_speed_kw ?? norm.box_charge_speed_kw;
    const n = num(v);
    if (Number.isFinite(n)) {
      set(
        fields,
        matched,
        'wallboxChargeSpeedKw',
        n,
        norm.wallbox_charge_speed_kw !== undefined ? 'wallbox_charge_speed_kw' : 'box_charge_speed_kw',
      );
    }
    delete norm.wallbox_charge_speed_kw;
    delete norm.box_charge_speed_kw;
  }

  // Collect any remaining keys that weren't recognized.
  for (const [k, v] of Object.entries(norm)) {
    if (
      k === 'energy_demand_wh' ||
      k === 'energy_demand_kwh' ||
      k === 'energy_price_per_wh' ||
      k === 'energy_price_per_kwh'
    )
      continue;
    if (!matched.includes(k)) {
      unknown[k] = String(v);
    }
  }

  return { format, fields, matched, unknown };
}

/* ---------------- helpers ---------------- */

function pull(
  obj: Record<string, unknown>,
  key: string,
  apply: (value: unknown) => void,
): void {
  if (obj[key] === undefined || obj[key] === null || obj[key] === '') return;
  apply(obj[key]);
  delete obj[key];
}

function set<K extends keyof ImportedFields>(
  fields: ImportedFields,
  matched: string[],
  key: K,
  value: ImportedFields[K],
  schemaKey: string,
) {
  if (value === undefined || value === null) return;
  fields[key] = value;
  if (!matched.includes(schemaKey)) matched.push(schemaKey);
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === null || v === undefined || v === '') return NaN;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '');
  return parseFloat(cleaned);
}

function bool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null || v === undefined) return false;
  const s = String(v).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}
