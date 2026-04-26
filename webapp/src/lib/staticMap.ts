/**
 * Build a Google Static Maps URL with the proposed panel layout overlaid as
 * paths. Used to embed a rooftop screenshot in the print stylesheet.
 *
 * Requires the Maps Static API to be enabled on the Maps JS key.
 */
import { mapsKey, panelPolygon } from './google';
import type { SystemDesign } from './types';

// Matching the interactive map colors (Blue/Navy)
const PANEL_STROKE = '0x1A237EFF'; // Navy
const PANEL_FILL = '0x2B3990B0';   // Semi-transparent Blue

interface Options {
  width?: number;
  height?: number;
  zoom?: number;
  scale?: 1 | 2;
}

const URL_BUDGET = 7800; // safe under the 8192 hard limit

export function staticMapUrl(design: SystemDesign, opts: Options = {}): string {
  const { width = 800, height = 500, zoom = 20, scale = 2 } = opts;
  const { insights, config } = design;
  const { lat, lng } = insights?.center 
    ? { lat: insights.center.latitude, lng: insights.center.longitude } 
    : design.inputs.address;

  // Maps Platform paid-tier limit: 1024 per side at 2x scale.
  const w = Math.min(width, 1024);
  const h = Math.min(height, 1024);

  const params = new URLSearchParams();
  params.set('size', `${w}x${h}`);
  params.set('scale', String(scale));
  params.set('maptype', 'satellite');
  params.set('format', 'png');
  params.set('key', mapsKey());

  if (insights) {
    // Auto-fit logic using visible bounds
    const { sw, ne } = insights.boundingBox;
    params.append('visible', `${sw.latitude.toFixed(6)},${sw.longitude.toFixed(6)}`);
    params.append('visible', `${ne.latitude.toFixed(6)},${ne.longitude.toFixed(6)}`);
  } else {
    params.set('center', `${lat.toFixed(6)},${lng.toFixed(6)}`);
    params.set('zoom', String(zoom));
  }

  const sp = insights?.solarPotential;
  const active = config.activePanels;
  
  if (sp && active && active.length > 0) {
    let baseLen = params.toString().length;
    for (const panel of active) {
      const corners = panelPolygon(
        panel,
        sp.roofSegmentStats,
        sp.panelWidthMeters,
        sp.panelHeightMeters,
      );
      // Use encoded polylines to fit significantly more panels in the URL
      const points = [...corners, corners[0]].map(c => ({
        lat: c.latitude,
        lng: c.longitude
      }));
      const encoded = encodePath(points);
      const segment = `color:${PANEL_STROKE}|fillcolor:${PANEL_FILL}|weight:1|enc:${encoded}`;
      
      // Skip remaining paths if the URL would exceed the budget.
      // Encoded paths are ~5x smaller than raw lat/lng strings.
      if (baseLen + segment.length + 8 > URL_BUDGET) break;
      params.append('path', segment);
      baseLen += segment.length + 8;
    }
  }

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Google Polyline Algorithm implementation.
 * Encodes a series of LatLng points into a compact string.
 */
function encodePath(points: { lat: number; lng: number }[]): string {
  let lastLat = 0;
  let lastLng = 0;
  let result = '';

  const encodeValue = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    result += String.fromCharCode(v + 63);
  };

  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lng = Math.round(p.lng * 1e5);
    encodeValue(lat - lastLat);
    encodeValue(lng - lastLng);
    lastLat = lat;
    lastLng = lng;
  }
  return result;
}
