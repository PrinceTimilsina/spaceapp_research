import { useEffect, useMemo, useRef, useState } from 'react';
import OLMap from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import ImageStatic from 'ol/source/ImageStatic';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import GeoJSON from 'ol/format/GeoJSON';
import { defaults as defaultInteractions } from 'ol/interaction';
import { defaults as defaultControls } from 'ol/control';
import { Circle as CircleStyle, Fill, RegularShape, Stroke, Style, Text } from 'ol/style';
import type { FeatureLike } from 'ol/Feature';
import type BaseLayer from 'ol/layer/Base';

import { LAYERS, STRATEGY_COLORS } from '../data/layers';
import { getDataset } from '../data/registry';
import { MAPPABLE_POIS } from '../data/pois';
import { useGeology, unitColor } from '../data/useGeology';
import { M_PER_DEG, JEZERO_CENTER, DEG, formatLonLat } from '../domain/mars';
import { cellOf, inGrid } from '../domain/grid';
import { STRATEGIES } from '../domain/costModel';
import { useAstra } from '../store/useAstra';
import { LEVEL0_RES, createTrekSource } from './trekSource';
import { MARS_EXTENT, MARS_PROJECTION } from './marsProjection';
import { renderGridCanvas } from './terrainRender';

const MAX_ZOOM = 19;
const RESOLUTIONS = Array.from({ length: MAX_ZOOM + 1 }, (_, z) => LEVEL0_RES / 2 ** z);
const Z: Record<string, number> = {
  viking: 0,
  themis: 1,
  ctx: 2,
  hirise: 3,
  slope: 10,
  elevation: 10,
  geology: 20,
  'usgs-footprint': 21,
  'terrain-extent': 22,
  graticule: 23,
  plan: 30,
  pois: 31,
};

function rectFeature(w: number, s: number, e: number, n: number, props: Record<string, unknown> = {}): Feature {
  const f = new Feature(new Polygon([[[w, s], [e, s], [e, n], [w, n], [w, s]]]));
  f.setProperties(props);
  return f;
}

function graticuleFeatures(): Feature[] {
  const out: Feature[] = [];
  const step = 0.1;
  const w = 76.5;
  const e = 78.7;
  const s = 17.5;
  const n = 19.3;
  for (let lon = Math.ceil(w / step) * step; lon <= e + 1e-9; lon += step) {
    out.push(new Feature(new LineString([[lon, s], [lon, n]])));
  }
  for (let lat = Math.ceil(s / step) * step; lat <= n + 1e-9; lat += step) {
    out.push(new Feature(new LineString([[w, lat], [e, lat]])));
  }
  return out;
}

const dashed = (color: string, width = 1.5) => new Style({ stroke: new Stroke({ color, width, lineDash: [8, 6] }) });

function markerStyle(kind: string, label: string, selected: boolean): Style[] {
  const colors: Record<string, string> = {
    start: '#7fd1a0',
    destination: '#f2a65a',
    return: '#8ab4f8',
    stop: '#e7e4df',
    poi: '#5fb3a1',
  };
  const color = colors[kind] ?? '#e7e4df';
  const image =
    kind === 'poi'
      ? new RegularShape({
          points: 4,
          radius: selected ? 11 : 8,
          angle: Math.PI / 4,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: selected ? '#fff' : '#0c0d0f', width: 2 }),
        })
      : new CircleStyle({
          radius: 8,
          fill: new Fill({ color }),
          stroke: new Stroke({ color: '#0c0d0f', width: 2.5 }),
        });
  return [
    new Style({
      image,
      text: new Text({
        text: label,
        font: '600 12px Inter, system-ui, sans-serif',
        offsetY: -18,
        fill: new Fill({ color: '#fff' }),
        stroke: new Stroke({ color: '#0c0d0f', width: 3.5 }),
      }),
    }),
  ];
}

function niceScale(maxMeters: number): number {
  const pow = 10 ** Math.floor(Math.log10(maxMeters));
  for (const m of [5, 2, 1]) if (m * pow <= maxMeters) return m * pow;
  return pow;
}

export default function MapView({ className = '' }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<OLMap | null>(null);
  const layerRefs = useRef<Record<string, BaseLayer>>({});
  const planSrc = useRef(new VectorSource());
  const poiSrc = useRef(new VectorSource());
  const geoSrc = useRef(new VectorSource());
  const terrainLayers = useRef<{ slope: ImageLayer<ImageStatic>; elevation: ImageLayer<ImageStatic> } | null>(null);
  const counters = useRef<Record<string, { ok: number; err: number }>>({});

  const layers = useAstra((s) => s.layers);
  const terrain = useAstra((s) => s.terrain);
  const pickMode = useAstra((s) => s.pickMode);
  const bundle = useAstra((s) => s.bundle);
  const selectedRouteKey = useAstra((s) => s.selectedRouteKey);
  const selectedPoiId = useAstra((s) => s.selectedPoiId);
  const start = useAstra((s) => s.start);
  const destination = useAstra((s) => s.destination);
  const returnPoint = useAstra((s) => s.returnPoint);
  const waypoints = useAstra((s) => s.waypoints);
  const focus = useAstra((s) => s.focus);
  const geology = useGeology();

  const [cursor, setCursor] = useState<{ lon: number; lat: number } | null>(null);
  const [scale, setScale] = useState<{ px: number; label: string } | null>(null);
  const [zoomInfo, setZoomInfo] = useState<string>('');

  /* ---- one-time map construction ---- */
  useEffect(() => {
    if (!hostRef.current) return;
    const store = useAstra.getState();

    const view = new View({
      projection: MARS_PROJECTION,
      resolutions: RESOLUTIONS,
      center: [JEZERO_CENTER.lon, JEZERO_CENTER.lat],
      zoom: 9,
      extent: MARS_EXTENT,
      constrainOnlyCenter: true,
    });

    const map = new OLMap({
      target: hostRef.current,
      view,
      controls: defaultControls({ rotate: false, attributionOptions: { collapsible: true, collapsed: true } }),
      interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false }),
    });
    mapRef.current = map;

    const refs: Record<string, BaseLayer> = {};

    for (const cfg of LAYERS) {
      if (!cfg.tile) continue;
      const id = cfg.id;
      counters.current[id] = { ok: 0, err: 0 };
      const source = createTrekSource(cfg.tile, (ok) => {
        const c = counters.current[id];
        if (ok) c.ok++;
        else c.err++;
      });
      const ds = cfg.datasetId ? getDataset(cfg.datasetId) : undefined;
      if (ds) source.setAttributions(ds.attribution);
      const layer = new TileLayer({ source, zIndex: Z[id] ?? 1, preload: 0 });
      refs[id] = layer;
      map.addLayer(layer);
    }

    const addVector = (id: string, source: VectorSource, style: Style | ((f: FeatureLike) => Style | Style[])) => {
      const l = new VectorLayer({ source, style, zIndex: Z[id] });
      refs[id] = l;
      map.addLayer(l);
      return l;
    };

    const grat = new VectorSource({ features: graticuleFeatures() });
    addVector('graticule', grat, new Style({ stroke: new Stroke({ color: 'rgba(255,255,255,0.35)', width: 0.7 }) }));

    addVector('usgs-footprint', new VectorSource({ features: [rectFeature(76.8, 17.7, 77.8, 18.7)] }), dashed('#d6a84a', 2));
    addVector('terrain-extent', new VectorSource(), dashed('#e06c5a', 2));

    addVector('geology', geoSrc.current, (f) => {
      const key = (f.get('__nameKey') as string | undefined) ?? '';
      const name = String(f.get(key) ?? '');
      const color = unitColor(name);
      return new Style({
        fill: new Fill({ color: color.replace('hsl(', 'hsla(').replace(')', ' / 0.5)') }),
        stroke: new Stroke({ color, width: 1 }),
      });
    });

    addVector('plan', planSrc.current, (f) => {
      const kind = f.get('kind') as string;
      if (kind === 'route') {
        const strategy = f.get('strategy') as keyof typeof STRATEGY_COLORS;
        const selected = f.get('selected') as boolean;
        const isReturn = f.get('direction') !== 'outbound';
        const color = STRATEGY_COLORS[strategy];
        const styles: Style[] = [];
        if (selected) styles.push(new Style({ stroke: new Stroke({ color: '#0c0d0f', width: 8 }), zIndex: 1 }));
        styles.push(
          new Style({
            stroke: new Stroke({
              color: selected ? color : color + '99',
              width: selected ? 4.5 : 2.5,
              lineDash: isReturn ? [10, 7] : undefined,
            }),
            zIndex: selected ? 2 : 0,
          }),
        );
        return styles;
      }
      return markerStyle(kind, (f.get('label') as string) ?? '', false);
    });

    addVector('pois', poiSrc.current, (f) =>
      markerStyle('poi', (f.get('label') as string) ?? '', Boolean(f.get('selected'))),
    );

    layerRefs.current = refs;

    // Terrain raster overlays (created empty; sources assigned when the grid is ready).
    const mk = (id: 'slope' | 'elevation') => {
      const l = new ImageLayer<ImageStatic>({ zIndex: Z[id] });
      refs[id] = l;
      map.addLayer(l);
      return l;
    };
    terrainLayers.current = { slope: mk('slope'), elevation: mk('elevation') };

    /* ---- interactions ---- */
    map.on('pointermove', (e) => {
      if (e.dragging) return;
      const [lon, lat] = e.coordinate;
      setCursor({ lon, lat });
    });
    host_leave(hostRef.current, () => setCursor(null));

    map.on('singleclick', (e) => {
      const [lon, lat] = e.coordinate;
      const st = useAstra.getState();
      if (st.pickMode) {
        const p = { lon, lat };
        if (st.pickMode === 'stop') st.addWaypoint({ name: '', location: p, origin: 'user' });
        else st.setPoint(st.pickMode, p);
        st.setPickMode(null);
        return;
      }
      let hit: string | null = null;
      map.forEachFeatureAtPixel(
        e.pixel,
        (f) => {
          const id = f.get('poiId') as string | undefined;
          if (id) {
            hit = id;
            return true;
          }
          return false;
        },
        { hitTolerance: 6 },
      );
      st.selectPoi(hit);
    });

    const updateScale = () => {
      const res = view.getResolution();
      const c = view.getCenter();
      if (!res || !c) return;
      const mPerPx = res * M_PER_DEG * Math.cos(c[1] * DEG);
      const m = niceScale(mPerPx * 120);
      setScale({ px: m / mPerPx, label: m >= 1000 ? `${m / 1000} km` : `${m} m` });
      setZoomInfo(mPerPx >= 10 ? `${mPerPx.toFixed(0)} m/px` : mPerPx >= 1 ? `${mPerPx.toFixed(1)} m/px` : `${(mPerPx * 100).toFixed(0)} cm/px`);
    };
    view.on('change:resolution', updateScale);
    view.on('change:center', updateScale);
    updateScale();

    const flush = window.setInterval(() => {
      for (const [id, c] of Object.entries(counters.current)) {
        if (c.ok || c.err) {
          store.reportTiles(id, c.ok, c.err);
          c.ok = 0;
          c.err = 0;
        }
      }
    }, 600);

    return () => {
      window.clearInterval(flush);
      map.setTarget(undefined);
      map.dispose();
      mapRef.current = null;
    };
  }, []);

  /* ---- layer visibility / opacity ---- */
  useEffect(() => {
    for (const [id, st] of Object.entries(layers)) {
      const l = layerRefs.current[id];
      if (!l) continue;
      l.setVisible(st.visible);
      l.setOpacity(st.opacity);
    }
  }, [layers]);

  /* ---- terrain overlays + coverage footprint ---- */
  useEffect(() => {
    const grid = terrain.grid;
    const tl = terrainLayers.current;
    if (!grid || !tl) return;
    const extent: [number, number, number, number] = [grid.west, grid.south, grid.east, grid.north];
    const make = (mode: 'slope' | 'elevation') =>
      new ImageStatic({
        url: renderGridCanvas(grid, mode, terrain.slope).toDataURL('image/png'),
        imageExtent: extent,
        projection: MARS_PROJECTION,
        interpolate: false,
      });
    tl.slope.setSource(make('slope'));
    tl.elevation.setSource(make('elevation'));
    const ext = layerRefs.current['terrain-extent'] as VectorLayer<VectorSource>;
    const src = ext.getSource();
    src?.clear();
    src?.addFeature(rectFeature(grid.west, grid.south, grid.east, grid.north));
  }, [terrain]);

  /* ---- geology overlay ---- */
  useEffect(() => {
    geoSrc.current.clear();
    if (geology.status !== 'present' || !geology.json) return;
    const feats = new GeoJSON().readFeatures(geology.json as object);
    for (const f of feats) f.set('__nameKey', geology.nameKey ?? '');
    geoSrc.current.addFeatures(feats);
  }, [geology]);

  /* ---- POIs ---- */
  useEffect(() => {
    poiSrc.current.clear();
    for (const p of MAPPABLE_POIS) {
      if (!p.location) continue;
      const f = new Feature(new Point([p.location.lon, p.location.lat]));
      f.setProperties({ poiId: p.id, label: p.name.split(' (')[0], selected: p.id === selectedPoiId });
      poiSrc.current.addFeature(f);
    }
  }, [selectedPoiId]);

  /* ---- mission plan + routes ---- */
  useEffect(() => {
    const src = planSrc.current;
    src.clear();
    if (bundle) {
      const add = (route: { found: boolean; coordinates: { lon: number; lat: number }[]; strategy: string; direction: string; id: string }, key: string) => {
        if (!route.found || route.coordinates.length < 2) return;
        const f = new Feature(new LineString(route.coordinates.map((c) => [c.lon, c.lat])));
        f.setProperties({
          kind: 'route',
          strategy: route.strategy,
          direction: route.direction,
          selected: key === selectedRouteKey,
        });
        src.addFeature(f);
      };
      for (const s of STRATEGIES) {
        add(bundle.outbound[s], `outbound-${s}`);
        add(bundle.returns[s], `return-${s}`);
      }
      const sel = selectedRouteKey.startsWith('retrace-') ? bundle.retrace[selectedRouteKey.split('-')[1] as (typeof STRATEGIES)[number]] : null;
      if (sel?.found) add({ ...sel, direction: 'return' }, selectedRouteKey);
    }
    const pt = (kind: string, label: string, p: { lon: number; lat: number } | null) => {
      if (!p) return;
      const f = new Feature(new Point([p.lon, p.lat]));
      f.setProperties({ kind, label });
      src.addFeature(f);
    };
    pt('start', 'Start', start);
    pt('destination', 'Destination', destination);
    pt('return', 'Return point', returnPoint);
    waypoints.forEach((w, i) => pt('stop', `${i + 1}. ${w.name}`, w.location));
  }, [bundle, selectedRouteKey, start, destination, returnPoint, waypoints]);

  /* ---- programmatic focus ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const view = map.getView();
    view.animate({ center: [focus.lon, focus.lat], zoom: focus.zoom ?? 12, duration: 500 });
  }, [focus]);

  /* ---- crosshair while picking ---- */
  useEffect(() => {
    const el = hostRef.current;
    if (el) el.style.cursor = pickMode ? 'crosshair' : '';
  }, [pickMode]);

  const readout = useMemo(() => {
    if (!cursor) return null;
    const grid = terrain.grid;
    let terr: string | null = null;
    if (grid && inGrid(grid, cursor)) {
      const c = cellOf(grid, cursor);
      if (c) {
        const i = c.row * grid.cols + c.col;
        const e = grid.elev[i];
        const sl = terrain.slope?.[i];
        const tag = grid.source === 'simulated' ? ' (SIMULATED)' : '';
        terr = Number.isNaN(e)
          ? 'no data'
          : `elev ${e.toFixed(0)} m${tag}, slope ${sl === undefined || Number.isNaN(sl) ? '—' : sl.toFixed(1) + '°'}${tag}`;
      }
    }
    return { text: formatLonLat(cursor, 4), terr };
  }, [cursor, terrain]);

  return (
    <div className={`relative ${className}`}>
      <div ref={hostRef} className="absolute inset-0 bg-[#05060a]" role="application" aria-label="Interactive map of Jezero crater" />
      <div className="pointer-events-none absolute bottom-2 left-2 z-10 space-y-1 text-xs">
        <div className="rounded bg-bg/85 px-2 py-1 font-mono">
          {readout ? readout.text : 'Move the pointer over the map'}
          {readout?.terr && <span className="ml-2 text-der">{readout.terr}</span>}
        </div>
        {scale && (
          <div className="flex items-end gap-2 rounded bg-bg/85 px-2 py-1">
            <div className="border-x border-b border-ink" style={{ width: scale.px, height: 6 }} />
            <span className="font-mono">{scale.label}</span>
            <span className="text-mute">· {zoomInfo}</span>
          </div>
        )}
      </div>
      {pickMode && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded border border-rust bg-bg/90 px-3 py-1.5 text-sm text-rust-soft">
          Click the map to set {pickMode === 'stop' ? 'a science stop' : pickMode === 'return' ? 'the return point' : `the ${pickMode}`}
        </div>
      )}
    </div>
  );
}

/** Small helper so the cleanup path stays tidy. */
function host_leave(el: HTMLElement, fn: () => void): void {
  el.addEventListener('mouseleave', fn);
}
