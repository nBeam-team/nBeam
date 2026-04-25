/**
 * Build a Google Static Maps URL with the proposed panel layout overlaid as
 * paths. Used to embed a rooftop screenshot in the print stylesheet.
 *
 * Requires the Maps Static API to be enabled on the Maps JS key.
 */
import { mapsKey, panelPolygon, topPanelsByEnergy } from './google';
import type { SystemDesign } from './types';

const PANEL_STROKE = '0x9F3A21FF';
const PANEL_FILL = '0xC44A2CB0'; // ~70% alpha — readable in print

interface Options {
  width?: number;
  height?: number;
  zoom?: number;
  scale?: 1 | 2;
}

const URL_BUDGET = 7800; // safe under the 8192 hard limit

export function staticMapUrl(design: SystemDesign, opts: Options = {}): string {
  const { width = 800, height = 500, zoom = 20, scale = 2 } = opts;
  const { lat, lng } = design.inputs.address;

  // Maps Platform paid-tier limit: 1024 per side at 2x scale.
  const w = Math.min(width, 1024);
  const h = Math.min(height, 1024);

  const params = new URLSearchParams();
  params.set('center', `${lat.toFixed(6)},${lng.toFixed(6)}`);
  params.set('zoom', String(zoom));
  params.set('size', `${w}x${h}`);
  params.set('scale', String(scale));
  params.set('maptype', 'satellite');
  params.set('format', 'png');
  params.set('key', mapsKey());

  const sp = design.insights?.solarPotential;
  if (sp?.solarPanels && sp.solarPanels.length > 0) {
    const top = topPanelsByEnergy(sp.solarPanels, design.config.panelsCount);
    let baseLen = params.toString().length;
    for (const panel of top) {
      const corners = panelPolygon(
        panel,
        sp.roofSegmentStats,
        sp.panelWidthMeters,
        sp.panelHeightMeters,
      );
      const points = [...corners, corners[0]]
        .map((c) => `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`)
        .join('|');
      const segment = `color:${PANEL_STROKE}|fillcolor:${PANEL_FILL}|weight:1|${points}`;
      // Skip remaining paths if the URL would exceed the byte budget.
      if (baseLen + segment.length + 8 > URL_BUDGET) break;
      params.append('path', segment);
      baseLen += segment.length + 8;
    }
  }

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}
