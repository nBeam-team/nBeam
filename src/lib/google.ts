/**
 * Google Maps Platform integration:
 * - Loader for Maps JS and the Places library (VITE_GOOGLE_MAPS_KEY).
 * - Solar API REST clients (VITE_GOOGLE_SOLAR_KEY).
 * - In-memory cache keyed by lat/lng to avoid duplicate API calls.
 */
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
const SOLAR_KEY = (import.meta.env.VITE_GOOGLE_SOLAR_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_KEY) as string | undefined;

if (!MAPS_KEY) {
  // eslint-disable-next-line no-console
  console.warn('VITE_GOOGLE_MAPS_KEY is not set; Maps + Places will fail.');
}
if (!SOLAR_KEY) {
  // eslint-disable-next-line no-console
  console.warn('VITE_GOOGLE_SOLAR_KEY is not set; Solar API calls will fail.');
}

let optionsApplied = false;
function ensureOptions() {
  if (optionsApplied) return;
  setOptions({ key: MAPS_KEY ?? '', v: 'weekly' });
  optionsApplied = true;
}

let loadPromise: Promise<typeof google> | null = null;

export async function loadMaps(): Promise<typeof google> {
  if (loadPromise) return loadPromise;
  ensureOptions();
  loadPromise = (async () => {
    await Promise.all([importLibrary('maps'), importLibrary('places')]);
    return google;
  })();
  return loadPromise;
}

export function solarKey(): string {
  return SOLAR_KEY ?? '';
}

export function mapsKey(): string {
  return MAPS_KEY ?? '';
}

/* ---------------- Solar API types (subset we use) ---------------- */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  sw: LatLng;
  ne: LatLng;
}

export interface SolarPanel {
  center: LatLng;
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  yearlyEnergyDcKwh: number;
  segmentIndex: number;
}

export interface RoofSegmentStat {
  pitchDegrees: number;
  azimuthDegrees: number;
  stats: { areaMeters2: number; sunshineQuantiles: number[]; groundAreaMeters2: number };
  center: LatLng;
  boundingBox: BoundingBox;
  planeHeightAtCenterMeters: number;
}

export interface SolarPanelConfig {
  panelsCount: number;
  yearlyEnergyDcKwh: number;
  roofSegmentSummaries: {
    pitchDegrees: number;
    azimuthDegrees: number;
    panelsCount: number;
    yearlyEnergyDcKwh: number;
    segmentIndex: number;
  }[];
}

export interface SolarPotential {
  panelCapacityWatts: number;
  panelHeightMeters: number;
  panelWidthMeters: number;
  panelLifetimeYears: number;
  carbonOffsetFactorKgPerMwh: number;
  wholeRoofStats: { areaMeters2: number; sunshineQuantiles: number[]; groundAreaMeters2: number };
  roofSegmentStats: RoofSegmentStat[];
  solarPanels?: SolarPanel[];
  solarPanelConfigs?: SolarPanelConfig[];
}

export interface BuildingInsights {
  name: string;
  center: LatLng;
  imageryDate?: { year: number; month: number; day: number };
  postalCode?: string;
  administrativeArea?: string;
  regionCode?: string;
  boundingBox: BoundingBox;
  solarPotential: SolarPotential;
}

export interface DataLayers {
  imageryDate?: { year: number; month: number; day: number };
  imageryProcessedDate?: { year: number; month: number; day: number };
  dsmUrl?: string;
  rgbUrl?: string;
  maskUrl?: string;
  annualFluxUrl?: string;
  monthlyFluxUrl?: string;
  hourlyShadeUrls?: string[];
  imageryQuality: 'HIGH' | 'MEDIUM' | 'LOW';
}

/* ---------------- Address ---------------- */

export interface Address {
  formatted: string;
  lat: number;
  lng: number;
  city?: string;
  countryCode?: string;
  placeId?: string;
}

/* ---------------- Solar API client + cache ---------------- */

const insightsCache = new Map<string, BuildingInsights>();
const dataLayersCache = new Map<string, DataLayers>();

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export async function fetchBuildingInsights(
  lat: number,
  lng: number,
): Promise<BuildingInsights> {
  const key = cacheKey(lat, lng);
  const cached = insightsCache.get(key);
  if (cached) return cached;

  const url = new URL('https://solar.googleapis.com/v1/buildingInsights:findClosest');
  url.searchParams.set('location.latitude', String(lat));
  url.searchParams.set('location.longitude', String(lng));
  url.searchParams.set('requiredQuality', 'HIGH');
  url.searchParams.set('key', solarKey());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Solar API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as BuildingInsights;
  insightsCache.set(key, data);
  return data;
}

export async function fetchDataLayers(
  lat: number,
  lng: number,
  radiusMeters = 50,
): Promise<DataLayers> {
  const key = cacheKey(lat, lng) + '|r' + radiusMeters;
  const cached = dataLayersCache.get(key);
  if (cached) return cached;

  const url = new URL('https://solar.googleapis.com/v1/dataLayers:get');
  url.searchParams.set('location.latitude', String(lat));
  url.searchParams.set('location.longitude', String(lng));
  url.searchParams.set('radiusMeters', String(radiusMeters));
  url.searchParams.set('view', 'FULL_LAYERS');
  url.searchParams.set('requiredQuality', 'HIGH');
  url.searchParams.set('key', solarKey());

  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Solar dataLayers ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = (await res.json()) as DataLayers;
  dataLayersCache.set(key, data);
  return data;
}

/* ---------------- Geometry helpers for panel rectangles ---------------- */

const METERS_PER_DEG_LAT = 111_320;

/**
 * Compute the 4-corner polygon (lat/lng) for a single panel,
 * rotated by the roof segment's azimuth.
 * azimuth is the compass direction the segment faces (0=N, 90=E, 180=S, 270=W).
 */
export function panelPolygon(
  panel: SolarPanel,
  segments: RoofSegmentStat[],
  panelWidthMeters: number,
  panelHeightMeters: number,
): LatLng[] {
  const seg = segments[panel.segmentIndex] ?? segments[0];
  const azimuth = seg?.azimuthDegrees ?? 0;

  // PORTRAIT: long edge along ridge direction. LANDSCAPE: long edge across.
  // The panel's long axis is its "height" (~1.88 m); orientation flips which
  // dimension maps to the segment's azimuth direction.
  const longSide = panelHeightMeters;
  const shortSide = panelWidthMeters;
  const w = panel.orientation === 'PORTRAIT' ? shortSide : longSide;
  const h = panel.orientation === 'PORTRAIT' ? longSide : shortSide;

  // Half-extents in segment-local frame: x = along-azimuth, y = perpendicular
  const halfH = h / 2;
  const halfW = w / 2;
  const local: [number, number][] = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ];

  // Rotate by azimuth (clockwise from north). Convert to (east-meters, north-meters).
  const az = (azimuth * Math.PI) / 180;
  const cos = Math.cos(az);
  const sin = Math.sin(az);

  const cosLat = Math.cos((panel.center.latitude * Math.PI) / 180);
  const mPerLng = METERS_PER_DEG_LAT * cosLat;

  return local.map(([x, y]) => {
    // azimuth rotation: north-axis = (sin az, cos az), east-axis = (cos az, -sin az)
    const east = x * cos + y * sin;
    const north = -x * sin + y * cos;
    return {
      latitude: panel.center.latitude + north / METERS_PER_DEG_LAT,
      longitude: panel.center.longitude + east / mPerLng,
    };
  });
}

/* ---------------- Util ---------------- */

export function pickConfigByCount(
  configs: SolarPanelConfig[] | undefined,
  panelsCount: number,
): SolarPanelConfig | null {
  if (!configs || configs.length === 0) return null;
  // Configs are returned sorted by panelsCount ascending — pick the closest
  let best = configs[0];
  for (const c of configs) {
    if (Math.abs(c.panelsCount - panelsCount) < Math.abs(best.panelsCount - panelsCount)) {
      best = c;
    }
  }
  return best;
}

export function topPanelsByEnergy(
  panels: SolarPanel[] | undefined,
  count: number,
): SolarPanel[] {
  if (!panels) return [];
  return [...panels]
    .sort((a, b) => b.yearlyEnergyDcKwh - a.yearlyEnergyDcKwh)
    .slice(0, Math.max(0, count));
}
