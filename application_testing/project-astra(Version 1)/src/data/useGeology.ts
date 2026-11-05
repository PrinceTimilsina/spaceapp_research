import { useEffect, useState } from 'react';

/**
 * Optional USGS geologic-unit overlay. The GeoJSON is produced by pipeline/convert_geology.sh from the
 * USGS SIM 3464 GIS database that the user downloads. If it is missing, the app says so.
 */

export interface GeologyState {
  status: 'loading' | 'present' | 'absent' | 'invalid';
  json: unknown;
  units: string[];
  nameKey: string | null;
}

const CANDIDATE_KEYS = ['MapUnit', 'MAPUNIT', 'Map_Unit', 'Unit', 'UNIT', 'UnitName', 'Unit_Name', 'Label', 'LABEL', 'Name', 'NAME'];

let cache: GeologyState | null = null;
let inflight: Promise<GeologyState> | null = null;

export function pickNameKey(props: Record<string, unknown>): string | null {
  for (const k of CANDIDATE_KEYS) if (typeof props[k] === 'string' && (props[k] as string).length) return k;
  for (const [k, v] of Object.entries(props)) if (typeof v === 'string' && v.length && v.length < 60) return k;
  return null;
}

async function load(): Promise<GeologyState> {
  const url = `${import.meta.env.BASE_URL}data/geology/sim3464_units.geojson`;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || type.includes('html')) return { status: 'absent', json: null, units: [], nameKey: null };
    const json = (await res.json()) as { type?: string; features?: { properties?: Record<string, unknown> }[] };
    if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) {
      return { status: 'invalid', json: null, units: [], nameKey: null };
    }
    const first = json.features.find((f) => f.properties)?.properties ?? {};
    const nameKey = pickNameKey(first);
    const units = nameKey
      ? Array.from(new Set(json.features.map((f) => String(f.properties?.[nameKey] ?? '')).filter(Boolean))).sort()
      : [];
    return { status: 'present', json, units, nameKey };
  } catch {
    return { status: 'invalid', json: null, units: [], nameKey: null };
  }
}

export function useGeology(): GeologyState {
  const [state, setState] = useState<GeologyState>(cache ?? { status: 'loading', json: null, units: [], nameKey: null });
  useEffect(() => {
    if (cache) return;
    inflight ??= load();
    let alive = true;
    void inflight.then((s) => {
      cache = s;
      if (alive) setState(s);
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

/** Stable colour per unit name. */
export function unitColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 55% 55%)`;
}
