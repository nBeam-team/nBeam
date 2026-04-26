import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  loadMaps,
  type Address,
  type BuildingInsights,
  type SolarPanel,
} from '../lib/google';
import { loadFluxRaster, renderFluxToBlobUrl } from '../lib/flux';

export type EditTool = 'select' | 'place' | 'lasso-add' | 'lasso-remove';

interface Props {
  address: Address;
  insights: BuildingInsights;
  activePanels: SolarPanel[];
  onPanelsChange?: (panels: SolarPanel[]) => void;
  showPanels?: boolean;
  showFlux?: boolean;
  /** From dataLayers:get — pass in to enable the heatmap overlay. */
  fluxUrl?: string | null;
  className?: string;
  /** External edit mode control */
  editMode?: boolean;
  editTool?: EditTool;
}

const PANEL_FILL = '#2B3990';
const PANEL_STROKE = '#1A237E';
const PANEL_SELECTED_STROKE = '#FFFFFF';

export function SolarMap({
  address,
  insights,
  activePanels,
  onPanelsChange,
  showPanels = true,
  showFlux = false,
  fluxUrl,
  className,
  editMode = false,
  editTool = 'select',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const buildingRef = useRef<google.maps.Polygon | null>(null);
  const panelsRef = useRef<google.maps.Polygon[]>([]);
  const fluxOverlayRef = useRef<google.maps.GroundOverlay | null>(null);
  const drawingManagerRef = useRef<google.maps.drawing.DrawingManager | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [fluxLoading, setFluxLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const selectedIndexRef = useRef<number>(-1);

  // Stable refs for values used in map event handlers
  const activePanelsRef = useRef(activePanels);
  const onPanelsChangeRef = useRef(onPanelsChange);
  const editModeRef = useRef(editMode);
  const editToolRef = useRef(editTool);

  useLayoutEffect(() => {
    activePanelsRef.current = activePanels;
    onPanelsChangeRef.current = onPanelsChange;
    editModeRef.current = editMode;
    editToolRef.current = editTool;
  });

  // Helper: compute panel polygon corners
  const computePanelPaths = useCallback(
    (panel: SolarPanel) => {
      const sp = insights.solarPotential;
      const [w, h] = [sp.panelWidthMeters / 2, sp.panelHeightMeters / 2];
      const points = [
        { x: +w, y: +h },
        { x: +w, y: -h },
        { x: -w, y: -h },
        { x: -w, y: +h },
        { x: +w, y: +h },
      ];
      const orientation = panel.orientation === 'PORTRAIT' ? 90 : 0;
      const seg = sp.roofSegmentStats[panel.segmentIndex] ?? sp.roofSegmentStats[0];
      const azimuth = seg?.azimuthDegrees ?? 0;

      return points.map(({ x, y }) =>
        google.maps.geometry.spherical.computeOffset(
          { lat: panel.center.latitude, lng: panel.center.longitude },
          Math.sqrt(x * x + y * y),
          Math.atan2(y, x) * (180 / Math.PI) + orientation + azimuth,
        ),
      );
    },
    [insights],
  );

  // Initialize map once per address
  useEffect(() => {
    // --- Place panel at arbitrary position ---
    function handlePlacePanel(latLng: google.maps.LatLng) {
      const cb = onPanelsChangeRef.current;
      if (!cb) return;
      const sp = insights.solarPotential;
      const newPanel: SolarPanel = {
        center: { latitude: latLng.lat(), longitude: latLng.lng() },
        orientation: 'LANDSCAPE',
        yearlyEnergyDcKwh: sp.solarPanels?.[0]?.yearlyEnergyDcKwh ?? 200,
        segmentIndex: 0,
      };
      cb([...activePanelsRef.current, newPanel]);
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setMapReady(false);
    });
    loadMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: address.lat, lng: address.lng },
          zoom: 20,
          maxZoom: 22,
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

        // Initialize Drawing Manager
        const drawingManager = new google.maps.drawing.DrawingManager({
          drawingMode: null,
          drawingControl: false, // We use our own UI
          polygonOptions: {
            fillColor: '#4CAF50',
            fillOpacity: 0.3,
            strokeWeight: 2,
            clickable: false,
            editable: false,
            zIndex: 10,
          },
        });
        drawingManager.setMap(map);
        drawingManagerRef.current = drawingManager;

        // Handle lasso completion
        google.maps.event.addListener(drawingManager, 'polygoncomplete', (polygon: google.maps.Polygon) => {
          const tool = editToolRef.current;
          const currentPanels = activePanelsRef.current;
          const cb = onPanelsChangeRef.current;
          
          if (!cb) {
            polygon.setMap(null);
            return;
          }

          if (tool === 'lasso-remove') {
            const remaining = currentPanels.filter((p) => {
              const pt = new google.maps.LatLng(p.center.latitude, p.center.longitude);
              return !google.maps.geometry.poly.containsLocation(pt, polygon);
            });
            if (remaining.length !== currentPanels.length) {
              cb(remaining);
            }
          } else if (tool === 'lasso-add') {
            const allPanels = insights.solarPotential.solarPanels ?? [];
            const activeKeys = new Set(
              currentPanels.map((p) => `${p.center.latitude.toFixed(7)},${p.center.longitude.toFixed(7)}`),
            );
            const toAdd = allPanels.filter((p) => {
              const key = `${p.center.latitude.toFixed(7)},${p.center.longitude.toFixed(7)}`;
              if (activeKeys.has(key)) return false;
              const pt = new google.maps.LatLng(p.center.latitude, p.center.longitude);
              return google.maps.geometry.poly.containsLocation(pt, polygon);
            });
            if (toAdd.length > 0) {
              cb([...currentPanels, ...toAdd]);
            }
          }

          // Remove the temporary drawing polygon
          polygon.setMap(null);
          // Reset tool to select after lasso? Or keep it? User might want multiple.
          // Let's keep it but reset drawing mode so map is draggable again.
          // Actually DrawingManager handles mode reset if we tell it.
        });

        // Map click handler: place new panel
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (!editModeRef.current || !e.latLng) return;
          const tool = editToolRef.current;
          if (tool === 'place') {
            handlePlacePanel(e.latLng);
          }
        });

        setMapReady(true);
      })
      .catch((e: Error) => {
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
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address.lat, address.lng]);

  // Update Drawing Manager Mode when tool changes
  useEffect(() => {
    const dm = drawingManagerRef.current;
    const map = mapRef.current;
    if (!dm || !map) return;

    if (!editMode) {
      dm.setDrawingMode(null);
      map.setOptions({ draggable: true });
      return;
    }

    if (editTool === 'lasso-add' || editTool === 'lasso-remove') {
      dm.setDrawingMode(google.maps.drawing.OverlayType.POLYGON);
      dm.setOptions({
        polygonOptions: {
          fillColor: editTool === 'lasso-add' ? '#4CAF50' : '#F44336',
          strokeColor: editTool === 'lasso-add' ? '#4CAF50' : '#F44336',
        }
      });
      // Drawing manager should handle dragging, but to be safe:
      map.setOptions({ draggable: false }); 
    } else {
      dm.setDrawingMode(null);
      map.setOptions({ draggable: true });
    }
  }, [editMode, editTool, mapReady]);



  // Single global keydown listener for delete
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (
        (e.key === 'Backspace' || e.key === 'Delete') &&
        selectedIndexRef.current >= 0 &&
        onPanelsChangeRef.current
      ) {
        e.preventDefault();
        const idx = selectedIndexRef.current;
        selectedIndexRef.current = -1;
        panelsRef.current.forEach((p) =>
          p.setOptions({ strokeColor: PANEL_STROKE, strokeWeight: 1 }),
        );
        const newPanels = [...activePanelsRef.current];
        newPanels.splice(idx, 1);
        onPanelsChangeRef.current(newPanels);
      }
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, []);

  // Panels overlay — lightweight static polygons
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    panelsRef.current.forEach((p) => p.setMap(null));
    panelsRef.current = [];
    selectedIndexRef.current = -1;

    if (!showPanels || activePanels.length === 0) return;

    for (let i = 0; i < activePanels.length; i++) {
      const panel = activePanels[i];
      const paths = computePanelPaths(panel);
      const poly = new google.maps.Polygon({
        paths,
        strokeColor: PANEL_STROKE,
        strokeOpacity: 0.9,
        strokeWeight: 1,
        fillColor: PANEL_FILL,
        fillOpacity: 0.9,
        clickable: editMode,
        editable: false,
        draggable: false,
        map,
        zIndex: 2,
      });

      if (editMode) {
        google.maps.event.addListener(poly, 'click', (e: google.maps.MapMouseEvent) => {
          e.stop?.();
          const tool = editToolRef.current;
          if (tool === 'select') {
            panelsRef.current.forEach((p) =>
              p.setOptions({ strokeColor: PANEL_STROKE, strokeWeight: 1 }),
            );
            if (selectedIndexRef.current === i) {
              selectedIndexRef.current = -1;
            } else {
              poly.setOptions({ strokeColor: PANEL_SELECTED_STROKE, strokeWeight: 3 });
              selectedIndexRef.current = i;
            }
          }
        });
      }

      panelsRef.current.push(poly);
    }
  }, [activePanels, insights, showPanels, mapReady, editMode, computePanelPaths]);

  // Flux heatmap overlay
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    if (!showFlux || !fluxUrl) {
      if (fluxOverlayRef.current) {
        fluxOverlayRef.current.setMap(null);
        fluxOverlayRef.current = null;
      }
      return;
    }

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) setFluxLoading(true);
    });
    (async () => {
      try {
        const raster = await loadFluxRaster(fluxUrl);
        const dataUrl = await renderFluxToBlobUrl(raster, fluxUrl);
        if (cancelled || !mapRef.current) return;

        if (fluxOverlayRef.current) {
          fluxOverlayRef.current.setMap(null);
          fluxOverlayRef.current = null;
        }
        const bounds = new google.maps.LatLngBounds(
          { lat: raster.bounds.south, lng: raster.bounds.west },
          { lat: raster.bounds.north, lng: raster.bounds.east },
        );
        const overlay = new google.maps.GroundOverlay(dataUrl, bounds, {
          opacity: 0.85,
          clickable: false,
        });
        overlay.setMap(mapRef.current);
        fluxOverlayRef.current = overlay;
      } catch (e) {
        console.error('flux overlay failed', e);
      } finally {
        if (!cancelled) setFluxLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showFlux, fluxUrl, mapReady]);

  // Change cursor based on edit tool
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    if (!editMode) {
      map.setOptions({ draggableCursor: undefined });
    } else if (editTool === 'place' || editTool === 'lasso-add' || editTool === 'lasso-remove') {
      map.setOptions({ draggableCursor: 'crosshair' });
    } else {
      map.setOptions({ draggableCursor: 'pointer' });
    }
  }, [editMode, editTool, mapReady]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-hairline bg-ink ${className ?? ''}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Edit mode indicator */}
      {editMode && (
        <div className="absolute top-12 left-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-terracotta/90 backdrop-blur-sm shadow-soft text-[11px] font-medium text-paper-light uppercase tracking-widest z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-paper-light animate-pulse" />
          editing
        </div>
      )}

      {/* Lasso instructions */}
      {editMode && (editTool === 'lasso-add' || editTool === 'lasso-remove') && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-ink/80 backdrop-blur-sm text-[11px] text-paper-light font-serif italic whitespace-nowrap">
          click to draw region points · close loop to apply
        </div>
      )}

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
