import type { TerrainGrid } from './grid';

/**
 * Optional real-DEM loader.
 *
 * The app looks for `data/dem/dem.meta.json` + the binary named in `meta.file`. Both are produced by
 * `pipeline/build_dem.py` from a USGS/NASA DEM that YOU download (see README). If they are absent the app
 * falls back to the SIMULATED terrain and says so everywhere.
 *
 * Binary format: little-endian float32, row-major, first row = NORTH edge, `nodata` value = no data.
 */

export interface DemMeta {
  schema: 1;
  name: string;
  productId: string;
  provider: string;
  sourceUrl: string;
  bounds: { west: number; south: number; east: number; north: number };
  cols: number;
  rows: number;
  cellSizeM: number;
  elevationUnits: 'm';
  nodata: number;
  verticalDatum: string;
  processing: string;
  acquisition: string;
  license: string;
  limitations: string[];
  file: string;
}

export function validateDemMeta(raw: unknown): DemMeta {
  if (typeof raw !== 'object' || raw === null) throw new Error('DEM metadata is not an object');
  const m = raw as Record<string, unknown>;
  const need = ['name', 'productId', 'provider', 'sourceUrl', 'file', 'processing', 'license'];
  for (const k of need) if (typeof m[k] !== 'string' || !(m[k] as string).length) throw new Error(`DEM metadata missing "${k}"`);
  if (m.schema !== 1) throw new Error('Unsupported DEM metadata schema');
  const b = m.bounds as Record<string, number> | undefined;
  if (!b || ![b.west, b.south, b.east, b.north].every((v) => typeof v === 'number' && Number.isFinite(v)))
    throw new Error('DEM metadata has invalid bounds');
  if (!(b.east > b.west && b.north > b.south)) throw new Error('DEM bounds are inverted');
  for (const k of ['cols', 'rows', 'cellSizeM', 'nodata']) {
    if (typeof m[k] !== 'number' || !Number.isFinite(m[k] as number)) throw new Error(`DEM metadata has invalid "${k}"`);
  }
  if (m.elevationUnits !== 'm') throw new Error('DEM elevation units must be metres');
  return raw as DemMeta;
}

export function buildGridFromDem(meta: DemMeta, buffer: ArrayBuffer): TerrainGrid {
  const expected = meta.cols * meta.rows * 4;
  if (buffer.byteLength !== expected) {
    throw new Error(`DEM binary is ${buffer.byteLength} bytes; expected ${expected} (${meta.cols}x${meta.rows} float32)`);
  }
  const elev = new Float32Array(buffer.slice(0));
  for (let i = 0; i < elev.length; i++) {
    const v = elev[i];
    if (v === meta.nodata || !Number.isFinite(v)) elev[i] = NaN;
  }
  const { west, south, east, north } = meta.bounds;
  return {
    id: `dem-${meta.productId}`,
    source: 'dem',
    dataClass: 'DERIVED',
    label: `${meta.name} (${meta.cellSizeM} m grid)`,
    west,
    south,
    east,
    north,
    cols: meta.cols,
    rows: meta.rows,
    dLon: (east - west) / meta.cols,
    dLat: (north - south) / meta.rows,
    elev,
    resolutionM: meta.cellSizeM,
    provenance: `${meta.provider} — ${meta.productId}. ${meta.processing} Vertical datum: ${meta.verticalDatum}. Acquisition: ${meta.acquisition}. License: ${meta.license}. Source: ${meta.sourceUrl}`,
    limitations: meta.limitations,
  };
}

export async function loadRealDem(baseUrl: string): Promise<{ grid: TerrainGrid; meta: DemMeta } | null> {
  try {
    const res = await fetch(`${baseUrl}data/dem/dem.meta.json`, { cache: 'no-cache' });
    const type = res.headers.get('content-type') ?? '';
    // Dev servers answer unknown paths with index.html (HTTP 200); treat non-JSON as "not present".
    if (!res.ok || !type.includes('json')) return null;
    const meta = validateDemMeta(await res.json());
    const bin = await fetch(`${baseUrl}data/dem/${meta.file}`);
    if (!bin.ok) return null;
    return { grid: buildGridFromDem(meta, await bin.arrayBuffer()), meta };
  } catch (err) {
    console.warn('[ASTRA] Real DEM present but could not be loaded:', err);
    return null;
  }
}
