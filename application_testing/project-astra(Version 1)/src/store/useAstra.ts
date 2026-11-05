import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LonLat, MobilityProfile, Strategy, Waypoint } from '../types';
import { LAYERS } from '../data/layers';
import { MAPPABLE_POIS, getPoi } from '../data/pois';
import { computeSlopeDeg, type TerrainGrid } from '../domain/grid';
import { loadRealDem } from '../domain/demLoader';
import { generateSimulatedTerrain } from '../domain/simTerrain';
import { DEFAULT_PROFILE_ID, PROFILES } from '../domain/costModel';
import type { PlanBundle, PlanInput, RouteResult, ScienceTarget } from '../domain/routePlanner';
import { planRoutes } from '../workers/routeClient';

export type PickMode = null | 'start' | 'destination' | 'return' | 'stop';
export type LayerStatus = 'idle' | 'ok' | 'unavailable';

export interface LayerState {
  visible: boolean;
  opacity: number;
  status: LayerStatus;
  loaded: number;
  errors: number;
}

export interface PlanSettings {
  start: LonLat | null;
  destination: LonLat | null;
  returnPoint: LonLat | null;
  waypoints: Waypoint[];
  profileId: string;
  /** null => use the profile's own maximum slope. */
  maxSlopeOverride: number | null;
  attractorPoiIds: string[];
  speedKmH: number;
}

/** Demonstration plan shown on first load: landing-site marker to a user-placed demo destination. */
const landing = getPoi('octavia-butler-landing')?.location ?? { lon: 77.45, lat: 18.44 };
export const DEFAULT_PLAN: PlanSettings = {
  start: landing,
  destination: { lon: 77.76, lat: 18.3 },
  returnPoint: null,
  waypoints: [],
  profileId: DEFAULT_PROFILE_ID,
  maxSlopeOverride: null,
  attractorPoiIds: [],
  speedKmH: 1.0,
};

interface AstraState extends PlanSettings {
  layers: Record<string, LayerState>;
  pickMode: PickMode;
  selectedPoiId: string | null;
  terrain: {
    status: 'loading' | 'ready';
    grid: TerrainGrid | null;
    slope: Float32Array | null;
    note: string;
  };
  bundle: PlanBundle | null;
  planning: boolean;
  planError: string | null;
  selectedRouteKey: string;
  focus: { lon: number; lat: number; zoom?: number; nonce: number } | null;

  setLayerVisible: (id: string, visible: boolean) => void;
  setLayerOpacity: (id: string, opacity: number) => void;
  reportTiles: (id: string, ok: number, err: number) => void;
  setPickMode: (m: PickMode) => void;
  selectPoi: (id: string | null) => void;
  setPoint: (kind: 'start' | 'destination' | 'return', p: LonLat | null) => void;
  addWaypoint: (w: Omit<Waypoint, 'id'>) => void;
  removeWaypoint: (id: string) => void;
  moveWaypoint: (id: string, dir: -1 | 1) => void;
  renameWaypoint: (id: string, name: string) => void;
  setProfile: (id: string) => void;
  setMaxSlopeOverride: (v: number | null) => void;
  toggleAttractor: (poiId: string) => void;
  setSpeed: (v: number) => void;
  selectRoute: (key: string) => void;
  resetPlan: () => void;
  focusOn: (lon: number, lat: number, zoom?: number) => void;
  initTerrain: () => Promise<void>;
  runPlan: () => Promise<void>;
}

const initialLayers = (): Record<string, LayerState> =>
  Object.fromEntries(
    LAYERS.map((l) => [
      l.id,
      { visible: l.defaultVisible, opacity: l.defaultOpacity, status: 'idle', loaded: 0, errors: 0 } as LayerState,
    ]),
  );

export function resolveProfile(s: Pick<PlanSettings, 'profileId' | 'maxSlopeOverride'>): MobilityProfile {
  const base = PROFILES.find((p) => p.id === s.profileId) ?? PROFILES[1];
  return s.maxSlopeOverride ? { ...base, maxSlopeDeg: s.maxSlopeOverride } : base;
}

export function scienceTargetsOf(s: Pick<PlanSettings, 'waypoints' | 'attractorPoiIds'>): ScienceTarget[] {
  const t: ScienceTarget[] = s.waypoints.map((w) => ({ id: w.id, name: w.name, location: w.location }));
  for (const id of s.attractorPoiIds) {
    const p = MAPPABLE_POIS.find((x) => x.id === id);
    if (p?.location) t.push({ id: p.id, name: p.name, location: p.location });
  }
  return t;
}

let planTimer: ReturnType<typeof setTimeout> | null = null;
let planSeq = 0;

export const useAstra = create<AstraState>()(
  persist(
    (set, get) => {
      const schedulePlan = () => {
        if (planTimer) clearTimeout(planTimer);
        planTimer = setTimeout(() => void get().runPlan(), 120);
      };
      const edit = (patch: Partial<PlanSettings>) => {
        set(patch as Partial<AstraState>);
        schedulePlan();
      };

      return {
        ...DEFAULT_PLAN,
        layers: initialLayers(),
        pickMode: null,
        selectedPoiId: null,
        terrain: { status: 'loading', grid: null, slope: null, note: '' },
        bundle: null,
        planning: false,
        planError: null,
        selectedRouteKey: 'outbound-terrain',
        focus: null,

        setLayerVisible: (id, visible) =>
          set((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], visible } } })),
        setLayerOpacity: (id, opacity) =>
          set((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], opacity } } })),
        reportTiles: (id, ok, err) =>
          set((s) => {
            const l = s.layers[id];
            if (!l) return s;
            const loaded = l.loaded + ok;
            const errors = l.errors + err;
            const status: LayerStatus = loaded > 0 ? 'ok' : errors >= 3 ? 'unavailable' : l.status;
            return { layers: { ...s.layers, [id]: { ...l, loaded, errors, status } } };
          }),
        setPickMode: (pickMode) => set({ pickMode }),
        selectPoi: (selectedPoiId) => set({ selectedPoiId }),
        setPoint: (kind, p) => {
          if (kind === 'start') edit({ start: p });
          else if (kind === 'destination') edit({ destination: p });
          else edit({ returnPoint: p });
        },
        addWaypoint: (w) => {
          const n = get().waypoints.length + 1;
          const wp: Waypoint = {
            ...w,
            id: `wp-${Date.now().toString(36)}-${n}`,
            name: w.name || `Science stop ${n}`,
          };
          edit({ waypoints: [...get().waypoints, wp] });
        },
        removeWaypoint: (id) => edit({ waypoints: get().waypoints.filter((w) => w.id !== id) }),
        moveWaypoint: (id, dir) => {
          const list = [...get().waypoints];
          const i = list.findIndex((w) => w.id === id);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= list.length) return;
          [list[i], list[j]] = [list[j], list[i]];
          edit({ waypoints: list });
        },
        renameWaypoint: (id, name) =>
          set({ waypoints: get().waypoints.map((w) => (w.id === id ? { ...w, name } : w)) }),
        setProfile: (profileId) => edit({ profileId, maxSlopeOverride: null }),
        setMaxSlopeOverride: (maxSlopeOverride) => edit({ maxSlopeOverride }),
        toggleAttractor: (poiId) => {
          const cur = get().attractorPoiIds;
          edit({ attractorPoiIds: cur.includes(poiId) ? cur.filter((x) => x !== poiId) : [...cur, poiId] });
        },
        setSpeed: (speedKmH) => set({ speedKmH }),
        selectRoute: (selectedRouteKey) => set({ selectedRouteKey }),
        resetPlan: () => {
          edit({ ...DEFAULT_PLAN, waypoints: [] });
          set({ selectedRouteKey: 'outbound-terrain' });
        },
        focusOn: (lon, lat, zoom) => set({ focus: { lon, lat, zoom, nonce: Date.now() } }),

        initTerrain: async () => {
          if (get().terrain.status === 'ready') return;
          const base = import.meta.env.BASE_URL ?? './';
          const real = await loadRealDem(base);
          const grid = real ? real.grid : generateSimulatedTerrain();
          set({
            terrain: {
              status: 'ready',
              grid,
              slope: computeSlopeDeg(grid),
              note: real
                ? `Real DEM loaded: ${real.meta.productId}`
                : 'No DEM file found in public/data/dem — using SIMULATED demonstration terrain.',
            },
          });
          await get().runPlan();
        },

        runPlan: async () => {
          const s = get();
          const grid = s.terrain.grid;
          if (!grid) return;
          if (!s.start || !s.destination) {
            set({ bundle: null, planError: 'Set a start and a destination to generate routes.', planning: false });
            return;
          }
          const input: PlanInput = {
            start: s.start,
            destination: s.destination,
            waypoints: s.waypoints,
            returnPoint: s.returnPoint,
            profile: resolveProfile(s),
            scienceTargets: scienceTargetsOf(s),
          };
          const my = ++planSeq;
          set({ planning: true, planError: null });
          try {
            const bundle = await planRoutes(grid, input);
            if (my !== planSeq) return; // a newer request superseded this one
            set({ bundle, planning: false });
          } catch (err) {
            if (my !== planSeq) return;
            set({ planning: false, planError: err instanceof Error ? err.message : String(err) });
          }
        },
      };
    },
    {
      name: 'astra-plan-v1',
      version: 1,
      partialize: (s) => ({
        start: s.start,
        destination: s.destination,
        returnPoint: s.returnPoint,
        waypoints: s.waypoints,
        profileId: s.profileId,
        maxSlopeOverride: s.maxSlopeOverride,
        attractorPoiIds: s.attractorPoiIds,
        speedKmH: s.speedKmH,
      }),
    },
  ),
);

export function routeByKey(bundle: PlanBundle | null, key: string): RouteResult | null {
  if (!bundle) return null;
  const [dir, strat] = key.split('-') as ['outbound' | 'return' | 'retrace', Strategy];
  if (dir === 'outbound') return bundle.outbound[strat] ?? null;
  if (dir === 'return') return bundle.returns[strat] ?? null;
  return bundle.retrace[strat] ?? null;
}
