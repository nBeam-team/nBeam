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
   
  console.warn('VITE_GOOGLE_MAPS_KEY is not set; Maps + Places will fail.');
}
if (!SOLAR_KEY) {
   
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
    await Promise.all([
      importLibrary('maps'),
      importLibrary('places'),
      importLibrary('geometry'),
      importLibrary('drawing'),
    ]);
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
  url.searchParams.set('requiredQuality', 'BASE');
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

/* ---------------- Geocoder ---------------- */

const geocodeCache = new Map<string, Address>();

/**
 * Resolve a free-form address string to an Address with lat/lng. Tries the
 * Geocoder first (richer results when the Geocoding API is enabled) and
 * falls back to Places.findPlaceFromQuery, which only needs the Places API.
 * Cached per query string.
 */
export async function geocodeAddress(query: string): Promise<Address | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const cached = geocodeCache.get(trimmed);
  if (cached) return cached;

  await loadMaps();

  const viaGeocoder = await tryGeocoder(trimmed);
  if (viaGeocoder) {
    geocodeCache.set(trimmed, viaGeocoder);
    return viaGeocoder;
  }

  const viaPlaces = await tryPlaces(trimmed);
  if (viaPlaces) {
    geocodeCache.set(trimmed, viaPlaces);
    return viaPlaces;
  }

  return null;
}

function tryGeocoder(query: string): Promise<Address | null> {
  return new Promise((resolve) => {
    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: query, region: 'de' }, (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) return resolve(null);
        const r = results[0];
        if (!r.geometry?.location) return resolve(null);
        const components = r.address_components ?? [];
        const city =
          components.find((c) => c.types.includes('locality'))?.long_name ??
          components.find((c) => c.types.includes('postal_town'))?.long_name ??
          components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name;
        const country = components.find((c) => c.types.includes('country'))?.short_name;
        resolve({
          formatted: r.formatted_address ?? query,
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng(),
          city,
          countryCode: country,
          placeId: r.place_id,
        });
      });
    } catch {
      resolve(null);
    }
  });
}

function tryPlaces(query: string): Promise<Address | null> {
  return new Promise((resolve) => {
    try {
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      service.findPlaceFromQuery(
        {
          query,
          fields: ['place_id', 'formatted_address', 'geometry', 'name'],
        },
        (results, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !results?.[0]) {
            return resolve(null);
          }
          const place = results[0];
          if (!place.geometry?.location) return resolve(null);
          resolve({
            formatted: place.formatted_address ?? query,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            placeId: place.place_id,
          });
        },
      );
    } catch {
      resolve(null);
    }
  });
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

/**
 * Compute the ideal radius for the dataLayers:get call.
 * We calculate the distance from the building center to the furthest corner
 * of its bounding box to ensure the entire structure is covered.
 */
export function computeBuildingRadius(insights: BuildingInsights): number {
  const center = insights.center;
  const centerPt = new google.maps.LatLng(center.latitude, center.longitude);
  const bbox = insights.boundingBox;

  // Check distance to all 4 corners of the bounding box
  const corners = [
    { lat: bbox.ne.latitude, lng: bbox.ne.longitude },
    { lat: bbox.ne.latitude, lng: bbox.sw.longitude },
    { lat: bbox.sw.latitude, lng: bbox.ne.longitude },
    { lat: bbox.sw.latitude, lng: bbox.sw.longitude },
  ];

  let maxDist = 0;
  for (const corner of corners) {
    const d = google.maps.geometry.spherical.computeDistanceBetween(
      centerPt,
      new google.maps.LatLng(corner.lat, corner.lng),
    );
    if (d > maxDist) maxDist = d;
  }

  // Add a generous 20% buffer to ensure the GeoTIFF covers the roof edges
  return Math.ceil(maxDist * 1.2);
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
