/**
 * Annual flux heatmap renderer.
 *
 * Pipeline: Solar API dataLayers:get returns an annualFluxUrl pointing at a
 * GeoTIFF. The TIFF is downloaded with the API key appended, decoded by
 * geotiff.js, color-mapped onto a canvas, and exposed as a data URL suitable
 * for google.maps.GroundOverlay. Bounds are reprojected using proj4 +
 * geotiff-geokeys-to-proj4 (matching the official Google Solar demo).
 */
import { fromArrayBuffer } from 'geotiff';
import type { GeoTIFFImage } from 'geotiff';
import * as geokeysToProj4 from 'geotiff-geokeys-to-proj4';
import proj4 from 'proj4';
import { solarKey } from './google';

export interface FluxRaster {
  /** Per-pixel kWh/kW/yr value, length = width × height. NaN where masked out. */
  values: Float32Array;
  width: number;
  height: number;
  bounds: { south: number; west: number; north: number; east: number };
  /** 99th-percentile value, used as the colormap upper bound. */
  p99: number;
  min: number;
}

const fluxCache = new Map<string, FluxRaster>();
const overlayBlobCache = new Map<string, string>();

/** Adds the API key to a Solar API URL (used for geoTiff:get URLs). */
export function withSolarKey(url: string): string {
  return url + (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(solarKey());
}

/** Download + decode the GeoTIFF and compute statistics. */
export async function loadFluxRaster(annualFluxUrl: string): Promise<FluxRaster> {
  const cached = fluxCache.get(annualFluxUrl);
  if (cached) return cached;

  const fullUrl = withSolarKey(annualFluxUrl);
  const res = await fetch(fullUrl);
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`flux download ${res.status}: ${err.slice(0, 160)}`);
  }
  const buf = await res.arrayBuffer();

  const tiff = await fromArrayBuffer(buf);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const rasters = await image.readRasters();
  // geotiff.js v3 returns an array-like { 0: TypedArray, length: N }.
  // Array.isArray is false, so access band 0 directly.
  const band: Float32Array =
    rasters instanceof Float32Array
      ? rasters
      : ((rasters as Record<number, Float32Array>)[0] ?? rasters) as Float32Array;

  const bounds = readableBounds(image);

  // Off-roof pixels in the flux GeoTIFF use a negative sentinel or NaN.
  let min = Infinity;
  let max = -Infinity;
  const usable: number[] = [];
  for (let i = 0; i < band.length; i++) {
    const v = band[i];
    if (!Number.isFinite(v) || v < 0) continue;
    if (v < min) min = v;
    if (v > max) max = v;
    usable.push(v);
  }
  usable.sort((a, b) => a - b);
  const p99 = usable.length ? usable[Math.floor(usable.length * 0.99)] : max;

  const raster: FluxRaster = {
    values: band,
    width,
    height,
    bounds,
    p99: Number.isFinite(p99) ? p99 : 1500,
    min: Number.isFinite(min) ? min : 0,
  };
  fluxCache.set(annualFluxUrl, raster);
  return raster;
}

/**
 * Render the heatmap to a data URL (PNG), cached by source URL.
 * Uses canvas.toDataURL() which is more compatible with GroundOverlay
 * than blob URLs (matching the Google Solar demo approach).
 */
export async function renderFluxToBlobUrl(
  raster: FluxRaster,
  sourceUrl: string,
): Promise<string> {
  const cached = overlayBlobCache.get(sourceUrl);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = raster.width;
  canvas.height = raster.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  const img = ctx.createImageData(raster.width, raster.height);
  const range = Math.max(1, raster.p99 - raster.min);

  for (let i = 0; i < raster.values.length; i++) {
    const v = raster.values[i];
    const j = i * 4;
    if (!Number.isFinite(v) || v < 0) {
      img.data[j + 3] = 0;
      continue;
    }
    const t = Math.max(0, Math.min(1, (v - raster.min) / range));
    const [r, g, b, a] = colormap(t);
    img.data[j] = r;
    img.data[j + 1] = g;
    img.data[j + 2] = b;
    img.data[j + 3] = a;
  }
  ctx.putImageData(img, 0, 0);

  // Use toDataURL instead of blob — more reliable for GroundOverlay
  const dataUrl = canvas.toDataURL('image/png');
  overlayBlobCache.set(sourceUrl, dataUrl);
   
  console.log('[flux] rendered overlay', raster.width, 'x', raster.height, 'bounds:', raster.bounds);
  return dataUrl;
}

/* ---------------- helpers ---------------- */

/**
 * Convert the GeoTIFF bounding box to EPSG:4326 lat/lng using proj4 and
 * geotiff-geokeys-to-proj4, matching the approach in the official Google
 * Solar API demo (js-solar-potential).
 */
function readableBounds(
  image: GeoTIFFImage,
): { south: number; west: number; north: number; east: number } {
  const box = image.getBoundingBox();

  // Try proj4-based reprojection using GeoKeys
  try {
    const geoKeys = image.getGeoKeys();
    if (!geoKeys) throw new Error('No geoKeys');
    const projObj = geokeysToProj4.toProj4(geoKeys as Parameters<typeof geokeysToProj4.toProj4>[0]);
    const projection = proj4(projObj.proj4, 'WGS84');
    const coordParams = projObj.coordinatesConversionParameters ?? { x: 1, y: 1 };
    const sw = projection.forward({
      x: box[0] * coordParams.x,
      y: box[1] * coordParams.y,
    });
    const ne = projection.forward({
      x: box[2] * coordParams.x,
      y: box[3] * coordParams.y,
    });
     
    console.log('[flux] proj4 bounds:', { south: sw.y, west: sw.x, north: ne.y, east: ne.x });
    return { south: sw.y, west: sw.x, north: ne.y, east: ne.x };
  } catch (e) {
     
    console.warn('[flux] proj4 reprojection failed, falling back to manual', e);
  }

  // Fallback: check if already in lat/lng
  const [minX, minY, maxX, maxY] = box;
  if (
    Math.abs(minX) <= 180 && Math.abs(maxX) <= 180 &&
    Math.abs(minY) <= 90 && Math.abs(maxY) <= 90
  ) {
    return { south: minY, west: minX, north: maxY, east: maxX };
  }

  // Manual Web Mercator → lat/lng (EPSG:3857 → EPSG:4326)
  const R = 6378137;
  const toLng = (x: number) => (x / R) * (180 / Math.PI);
  const toLat = (y: number) =>
    (Math.atan(Math.sinh(y / R)) * 180) / Math.PI;
  return {
    south: toLat(minY),
    west: toLng(minX),
    north: toLat(maxY),
    east: toLng(maxX),
  };
}

/**
 * Sunset colormap: transparent at low flux through plum, terracotta, gold,
 * to pale yellow at peak.
 */
function colormap(t: number): [number, number, number, number] {
  const stops: { t: number; rgb: [number, number, number]; alpha: number }[] = [
    { t: 0.0, rgb: [60, 30, 60], alpha: 0 },
    { t: 0.06, rgb: [80, 38, 70], alpha: 80 },
    { t: 0.25, rgb: [140, 60, 60], alpha: 165 },
    { t: 0.5, rgb: [196, 74, 44], alpha: 210 },
    { t: 0.7, rgb: [240, 130, 50], alpha: 225 },
    { t: 0.85, rgb: [253, 184, 19], alpha: 235 },
    { t: 1.0, rgb: [255, 248, 200], alpha: 240 },
  ];
  if (t <= stops[0].t) return [...stops[0].rgb, stops[0].alpha];
  if (t >= 1) return [...stops[stops.length - 1].rgb, stops[stops.length - 1].alpha];
  let i = 0;
  while (i < stops.length - 1 && stops[i + 1].t < t) i++;
  const a = stops[i];
  const b = stops[i + 1] ?? stops[stops.length - 1];
  const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return [
    Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * u),
    Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * u),
    Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * u),
    Math.round(a.alpha + (b.alpha - a.alpha) * u),
  ];
}
