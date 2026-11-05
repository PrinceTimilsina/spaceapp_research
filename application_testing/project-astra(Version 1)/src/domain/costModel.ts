import type { MobilityProfile, Strategy } from '../types';
import { DEG } from './mars';

/**
 * Mobility profiles are PLANNING ASSUMPTIONS, not NASA or vendor specifications. They exist so that the
 * terrain cost has explicit, adjustable, user-visible parameters instead of hidden constants.
 */
export const PROFILES: MobilityProfile[] = [
  {
    id: 'conservative',
    name: 'Conservative',
    description: 'Planning assumption: low slope tolerance and strong avoidance of steep ground.',
    maxSlopeDeg: 12,
    terrainWeight: 6,
    uphillWeight: 4,
  },
  {
    id: 'standard',
    name: 'Standard',
    description: 'Planning assumption: moderate slope tolerance. Default for demonstrations.',
    maxSlopeDeg: 20,
    terrainWeight: 4,
    uphillWeight: 3,
  },
  {
    id: 'capable',
    name: 'Capable',
    description: 'Planning assumption: high slope tolerance and milder terrain penalties.',
    maxSlopeDeg: 30,
    terrainWeight: 2,
    uphillWeight: 2,
  },
];

export const DEFAULT_PROFILE_ID = 'standard';

/** Science-focused strategy: edges within this radius of a target get a bounded cost discount. */
export const SCIENCE_RADIUS_M = 2500;
/** Maximum fractional discount at a target (cost multiplier floor = 1 - bonus). Keeps the A* heuristic admissible. */
export const SCIENCE_BONUS = 0.75;

export const STRATEGY_INFO: Record<Strategy, { name: string; short: string }> = {
  shortest: { name: 'Shortest', short: 'Minimises planar distance. Only the hard slope limit constrains it.' },
  terrain: {
    name: 'Terrain-conscious',
    short: 'Adds cost for steep ground and for climbing, so it trades distance for gentler grades.',
  },
  science: {
    name: 'Science-focused',
    short: 'Terrain-conscious cost with a bounded discount near selected science targets.',
  },
};

export const STRATEGIES: Strategy[] = ['shortest', 'terrain', 'science'];

/** Absolute slope (degrees) of a grid edge from its elevation change and horizontal length. */
export function edgeSlopeDeg(distM: number, dz: number): number {
  return Math.atan(Math.abs(dz) / distM) / DEG;
}

/** Dimensionless terrain penalty for travelling an edge in the direction that produces `dz`. */
export function terrainPenalty(distM: number, dz: number, profile: MobilityProfile): number {
  const s = edgeSlopeDeg(distM, dz) / profile.maxSlopeDeg;
  const uphill = Math.max(0, dz / distM);
  return s * s + profile.uphillWeight * uphill;
}

/**
 * Directed edge cost.
 *   cost = distance * (1 + w_t * penalty)       (w_t = 0 for 'shortest')
 *   penalty = (slope / maxSlope)^2 + uphillWeight * max(0, dz / distance)
 * Returns Infinity when the edge is steeper than the profile's hard limit.
 */
export function stepCost(distM: number, dz: number, profile: MobilityProfile, strategy: Strategy): number {
  if (edgeSlopeDeg(distM, dz) > profile.maxSlopeDeg) return Infinity;
  const w = strategy === 'shortest' ? 0 : profile.terrainWeight;
  return distM * (1 + w * terrainPenalty(distM, dz, profile));
}
