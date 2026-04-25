import { useEffect, useRef, useState } from 'react';
import {
  loadMaps,
  panelPolygon,
  topPanelsByEnergy,
  type Address,
  type BuildingInsights,
} from '../lib/google';
import { loadFluxRaster, renderFluxToBlobUrl } from '../lib/flux';

interface Props {
  address: Address;
  insights: BuildingInsights;
  panelsCount: number;
  showPanels?: boolean;
  showFlux?: boolean;
  /** From dataLayers:get — pass in to enable the heatmap overlay. */
  fluxUrl?: string | null;
  className?: string;
}

const PANEL_FILL = '#C44A2C';
const PANEL_STROKE = '#9F3A21';

export function SolarMap({
  address,
  insights,
  panelsCount,
  showPanels = true,
  showFlux = false,
  fluxUrl,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const buildingRef = useRef<google.maps.Polygon | null>(null);
  const panelsRef = useRef<google.maps.Polygon[]>([]);
  const fluxOverlayRef = useRef<google.maps.GroundOverlay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fluxLoading, setFluxLoading] = useState(false);
  // Tracks whether mapRef.current has been populated. The overlay effects
  // depend on this so they re-run after the async map mount completes.
  const [mapReady, setMapReady] = useState(false);

  // Initialize map once per address
  useEffect(() => {
    let cancelled = false;
    setMapReady(false);
    loadMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: address.lat, lng: address.lng },
          zoom: 20,
          maxZoom: 21,
          minZoom: 16,
          mapTypeId: 'satellite',
          tilt: 0,
          rotateControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          gestureHandling: 'greedy',
          backgroundColor: '#1A1410',
          keyboardShortcuts: false,
        });
        mapRef.current = map;

        const bbox = insights.boundingBox;
        const bounds = new google.maps.LatLngBounds(
          { lat: bbox.sw.latitude, lng: bbox.sw.longitude },
          { lat: bbox.ne.latitude, lng: bbox.ne.longitude },
        );
        map.fitBounds(bounds, 28);

        buildingRef.current = new google.maps.Polygon({
          paths: [
            { lat: bbox.sw.latitude, lng: bbox.sw.longitude },
            { lat: bbox.sw.latitude, lng: bbox.ne.longitude },
            { lat: bbox.ne.latitude, lng: bbox.ne.longitude },
            { lat: bbox.ne.latitude, lng: bbox.sw.longitude },
          ],
          strokeColor: '#FAF4E8',
          strokeOpacity: 0.35,
          strokeWeight: 1,
          fillOpacity: 0,
          clickable: false,
          map,
        });

        // Map is now mounted; overlay effects can read mapRef.
        setMapReady(true);
      })
      .catch((e: Error) => {
        // eslint-disable-next-line no-console
        console.error('Map init failed', e);
        setError('Could not load the map.');
      });

    return () => {
      cancelled = true;
      panelsRef.current.forEach((p) => p.setMap(null));
      panelsRef.current = [];
      if (buildingRef.current) {
        buildingRef.current.setMap(null);
        buildingRef.current = null;
      }
      if (fluxOverlayRef.current) {
        fluxOverlayRef.current.setMap(null);
        fluxOverlayRef.current = null;
      }
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address.lat, address.lng]);

  // Panels overlay
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    panelsRef.current.forEach((p) => p.setMap(null));
    panelsRef.current = [];

    if (!showPanels || panelsCount <= 0) return;

    const sp = insights.solarPotential;
    const allPanels = sp.solarPanels ?? [];
    if (allPanels.length === 0) return;

    const top = topPanelsByEnergy(allPanels, panelsCount);
    for (const panel of top) {
      const corners = panelPolygon(
        panel,
        sp.roofSegmentStats,
        sp.panelWidthMeters,
        sp.panelHeightMeters,
      );
      const poly = new google.maps.Polygon({
        paths: corners.map((c) => ({ lat: c.latitude, lng: c.longitude })),
        strokeColor: PANEL_STROKE,
        strokeOpacity: 0.9,
        strokeWeight: 0.9,
        fillColor: PANEL_FILL,
        fillOpacity: 0.62,
        clickable: false,
        map,
      });
      panelsRef.current.push(poly);
    }
  }, [panelsCount, insights, showPanels, mapReady]);

  // Flux heatmap overlay
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    // If toggled off or no URL, remove existing overlay
    if (!showFlux || !fluxUrl) {
      if (fluxOverlayRef.current) {
        fluxOverlayRef.current.setMap(null);
        fluxOverlayRef.current = null;
      }
      return;
    }

    let cancelled = false;
    setFluxLoading(true);
    (async () => {
      try {
        const raster = await loadFluxRaster(fluxUrl);
        const blobUrl = await renderFluxToBlobUrl(raster, fluxUrl);
        if (cancelled || !mapRef.current) return;

        if (fluxOverlayRef.current) {
          fluxOverlayRef.current.setMap(null);
          fluxOverlayRef.current = null;
        }
        const bounds = new google.maps.LatLngBounds(
          { lat: raster.bounds.south, lng: raster.bounds.west },
          { lat: raster.bounds.north, lng: raster.bounds.east },
        );
        const overlay = new google.maps.GroundOverlay(blobUrl, bounds, {
          opacity: 0.85,
          clickable: false,
        });
        overlay.setMap(mapRef.current);
        fluxOverlayRef.current = overlay;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('flux overlay failed', e);
      } finally {
        if (!cancelled) setFluxLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showFlux, fluxUrl, mapReady]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-hairline bg-ink ${className ?? ''}`}>
      <div ref={containerRef} className="w-full h-full" />
      {fluxLoading ? (
        <div className="absolute top-3 right-3 inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-paper-light/90 backdrop-blur-sm shadow-soft text-[11px] italic font-serif text-ink-500">
          <Spinner /> heatmap rendering…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/80 text-paper-light text-sm">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="animate-spin" aria-hidden>
      <circle cx="6" cy="6" r="4" stroke="#E0D3BC" strokeWidth="1.4" fill="none" />
      <path d="M6 2a4 4 0 0 1 4 4" stroke="#C44A2C" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
