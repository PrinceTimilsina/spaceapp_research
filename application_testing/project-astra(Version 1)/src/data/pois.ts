import type { PoiFeature, SourceLink } from '../types';

/**
 * Points of interest. RULES: no coordinate without a traceable source; no scientific claim beyond what the
 * cited source says. Features without a verified coordinate have `location: null`: they are listed in the
 * Science guide but NOT drawn on the map. To add a feature, append a record with its citation.
 */

const WIKI_JEZERO: SourceLink = {
  title: 'Jezero (crater) - Wikipedia (secondary source)',
  url: 'https://en.wikipedia.org/wiki/Jezero_(crater)',
};
const WIKI_LANDING: SourceLink = {
  title: 'Octavia E. Butler Landing - Wikipedia (cites NASA GISS Mars Lander Missions)',
  url: 'https://en.wikipedia.org/wiki/Octavia_E._Butler_Landing',
};
const USGS_SIM: SourceLink = {
  title: 'USGS SIM 3464 - Geologic Map of Jezero Crater and the Nili Planum Region',
  url: 'https://pubs.usgs.gov/publication/sim3464',
};

const NO_COORD = 'No coordinate was available in the sources verified for this prototype. Not drawn on the map.';
const SECONDARY = 'Described via a secondary (encyclopedic) source; confirm with primary mission publications.';

export const POIS: PoiFeature[] = [
  {
    id: 'jezero-crater',
    name: 'Jezero crater (centre)',
    category: 'Landmark',
    location: { lon: 77.58, lat: 18.38 },
    locationSource: 'Coordinates 18°23′N 77°35′E (18.38°N, 77.58°E) as listed in the cited article; convention not stated.',
    significance:
      'A crater about 45 km in diameter that Perseverance has been exploring; it is the focus area of PROJECT ASTRA.',
    sources: [WIKI_JEZERO, USGS_SIM],
    products: ['USGS SIM 3464 (map covers most of Jezero and part of Nili Planum)'],
    limitations: [
      'Coordinate is rounded to 0.01° and the planetocentric/planetographic convention is not stated at the source.',
      SECONDARY,
    ],
    dataClass: 'DERIVED',
  },
  {
    id: 'octavia-butler-landing',
    name: 'Octavia E. Butler Landing (Perseverance landing site)',
    category: 'Mission site',
    location: { lon: 77.45, lat: 18.44 },
    locationSource: 'Coordinates 18°26′N 77°27′E (18.44°N, 77.45°E) as listed in the cited article, which cites NASA GISS.',
    significance:
      'Where Perseverance landed on 18 February 2021; the site was named on 5 March 2021 (per the cited article).',
    sources: [WIKI_LANDING],
    products: ['MRO HiRISE orthomosaic of the landing-site area (Trek layer in this app, if available)'],
    limitations: [
      'Rounded to 0.01° (~600 m): the marker is indicative, not a survey position.',
      'Coordinate system (planetocentric vs planetographic) not stated at the source.',
      SECONDARY,
    ],
    dataClass: 'DERIVED',
  },
  {
    id: 'delta-deposits',
    name: 'Delta-like deposits at channel mouths',
    category: 'Geology',
    location: null,
    locationSource: NO_COORD,
    significance:
      'The cited article describes two channels, on the northern and western sides of the crater, each with a delta-like deposit.',
    sources: [WIKI_JEZERO, USGS_SIM],
    products: ['USGS SIM 3464 map units (inspect the legend in the USGS publication)'],
    limitations: [NO_COORD, 'Interpretation of origin must follow the primary literature; this app does not reinterpret units.'],
    dataClass: 'DERIVED',
  },
  {
    id: 'seitah',
    name: 'Séítah',
    category: 'Rover campaign area',
    location: null,
    locationSource: NO_COORD,
    significance:
      'Described in the cited article as potentially among the oldest accessible geologic units in the crater, where the science campaign began and the first core samples were taken.',
    sources: [WIKI_JEZERO],
    products: ['Perseverance mission science pages (not integrated)'],
    limitations: [NO_COORD, SECONDARY],
    dataClass: 'OBSERVED',
  },
  {
    id: 'margin-unit',
    name: 'Margin unit',
    category: 'Geology',
    location: null,
    locationSource: NO_COORD,
    significance: 'A geologic area at the inner edge of the crater, per the cited article.',
    sources: [WIKI_JEZERO, USGS_SIM],
    products: ['USGS SIM 3464 (verify the unit name and extent in the legend)'],
    limitations: [NO_COORD, SECONDARY],
    dataClass: 'DERIVED',
  },
  {
    id: 'cheyava-falls',
    name: 'Cheyava Falls',
    category: 'Rover sample target',
    location: null,
    locationSource: NO_COORD,
    significance:
      'An arrowhead-shaped rock described in the cited article as showing "possible" biosignatures. This is not a confirmed detection.',
    sources: [WIKI_JEZERO],
    products: ['Perseverance mission science pages (not integrated)'],
    limitations: [NO_COORD, 'Interpretation is preliminary and contested in the literature; do not present as life detection.', SECONDARY],
    dataClass: 'OBSERVED',
  },
  {
    id: 'bright-angel',
    name: 'Bright Angel',
    category: 'Rover sample target',
    location: null,
    locationSource: NO_COORD,
    significance: 'Rock formations where vivianite and greigite were reported as observed, per the cited article.',
    sources: [WIKI_JEZERO],
    products: ['Perseverance mission science pages (not integrated)'],
    limitations: [NO_COORD, 'A mineral detection does not by itself show usable water or resources.', SECONDARY],
    dataClass: 'OBSERVED',
  },
  {
    id: 'dacono',
    name: 'Dacono crater',
    category: 'Impact crater',
    location: null,
    locationSource: NO_COORD,
    significance:
      'A small crater (about 2 km across) on the crater floor where evidence of boulder fall was found, per the cited article.',
    sources: [WIKI_JEZERO],
    products: ['Candidate for HiRISE inspection where coverage exists'],
    limitations: [NO_COORD, SECONDARY],
    dataClass: 'OBSERVED',
  },
  {
    id: 'three-forks',
    name: 'Three Forks',
    category: 'Mission planning site',
    location: null,
    locationSource: NO_COORD,
    significance:
      'Named in the cited article as the planned landing site for a proposed sample-return lander. Mission plans change; check current NASA statements.',
    sources: [WIKI_JEZERO],
    products: ['Mars Sample Return TRN HiRISE DTM/orthomosaic (candidate dataset, not integrated)'],
    limitations: [NO_COORD, 'Plans for sample return may have changed since the source was written.', SECONDARY],
    dataClass: 'OBSERVED',
  },
];

export function getPoi(id: string): PoiFeature | undefined {
  return POIS.find((p) => p.id === id);
}

export const MAPPABLE_POIS = POIS.filter((p) => p.location !== null);
