import type { LonLat } from '../types';

/**
 * Mars 2000 sphere radius used by NASA Trek equirectangular products (IAU2000:49900).
 * NEVER use Earth radii here: most JS geo libraries (e.g. Turf geodesic helpers) assume Earth.
 */
export const MARS_RADIUS_M = 3396190;
export const M_PER_DEG = (MARS_RADIUS_M * Math.PI) / 180;
export const DEG = Math.PI / 180;

/** Jezero crater centre as listed (decimal degrees) in the cited source. See data/pois.ts. */
export const JEZERO_CENTER: LonLat = { lon: 77.58, lat: 18.38 };

/** Great-circle distance on the Mars sphere, metres. */
export function haversineM(a: LonLat, b: LonLat): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLon = (b.lon - a.lon) * DEG;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** East/north offsets in metres from `origin` (local equirectangular approximation, fine for < ~100 km). */
export function toLocalM(origin: LonLat, p: LonLat): { x: number; y: number } {
  return {
    x: (p.lon - origin.lon) * M_PER_DEG * Math.cos(origin.lat * DEG),
    y: (p.lat - origin.lat) * M_PER_DEG,
  };
}

export function fromLocalM(origin: LonLat, x: number, y: number): LonLat {
  return {
    lon: origin.lon + x / (M_PER_DEG * Math.cos(origin.lat * DEG)),
    lat: origin.lat + y / M_PER_DEG,
  };
}

export function formatLonLat(p: LonLat, digits = 4): string {
  const ns = p.lat >= 0 ? 'N' : 'S';
  const ew = p.lon >= 0 ? 'E' : 'W';
  return `${Math.abs(p.lat).toFixed(digits)}°${ns}, ${Math.abs(p.lon).toFixed(digits)}°${ew}`;
}

export function formatKm(m: number, digits = 2): string {
  return `${(m / 1000).toFixed(digits)} km`;
}

export function formatMeters(m: number, digits = 0): string {
  return `${m.toFixed(digits)} m`;
}

export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours)) return '—';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h} h ${m.toString().padStart(2, '0')} min`;
}
