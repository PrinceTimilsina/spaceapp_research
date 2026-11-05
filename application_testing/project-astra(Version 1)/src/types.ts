/** Shared domain types for PROJECT ASTRA. */

/** Data-integrity classification required by the specification. */
export type DataClass = 'OBSERVED' | 'DERIVED' | 'MODELLED' | 'SIMULATED';

/** Planetocentric longitude (east positive, -180..180) and latitude in degrees, Mars 2000 sphere. */
export interface LonLat {
  lon: number;
  lat: number;
}

export type Strategy = 'shortest' | 'terrain' | 'science';
export type Direction = 'outbound' | 'return';

export interface MobilityProfile {
  id: string;
  name: string;
  /** Plain-language statement of what this profile is. Always a planning assumption. */
  description: string;
  /** Hard limit: grid edges steeper than this are treated as impassable (degrees). */
  maxSlopeDeg: number;
  /** Weight applied to the slope penalty by terrain-aware strategies. */
  terrainWeight: number;
  /** Extra weight applied to the uphill grade along the direction of travel. */
  uphillWeight: number;
}

export interface SourceLink {
  title: string;
  url: string;
}

export type IntegrationStatus =
  | 'integrated' // used by the app with a verified endpoint/format
  | 'runtime-check' // used by the app; endpoint is probed in the browser at runtime
  | 'optional-file' // used only if a pipeline-generated file is present
  | 'candidate' // identified as a source, not integrated
  | 'demo'; // demonstration-only content

/** Provenance record. Unknown values are null and displayed as "not recorded". */
export interface DatasetRecord {
  id: string;
  name: string;
  provider: string;
  dataClass: DataClass;
  integration: IntegrationStatus;
  identifier: string | null;
  sourceUrl: string | null;
  instrument: string | null;
  acquisition: string | null;
  resolution: string | null;
  coverage: string | null;
  crs: string | null;
  processing: string | null;
  license: string | null;
  attribution: string;
  limitations: string[];
  /** What was actually checked while building this prototype, and when. */
  verification: string;
}

export interface PoiFeature {
  id: string;
  name: string;
  category: string;
  /** null => no sourced coordinate; the feature is listed in the guide but not drawn on the map. */
  location: LonLat | null;
  locationSource: string;
  significance: string;
  sources: SourceLink[];
  products: string[];
  limitations: string[];
  dataClass: DataClass;
}

export interface Waypoint {
  id: string;
  name: string;
  location: LonLat;
  /** 'user' = placed by the user (hypothetical stop); 'poi' = taken from a sourced point of interest. */
  origin: 'user' | 'poi';
  poiId?: string;
}
