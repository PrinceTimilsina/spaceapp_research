import type { DataClass, SourceLink } from '../types';

/**
 * Environmental and mission context. This module intentionally contains NO measured numbers:
 * it documents WHICH sourced data would feed each topic, how to classify it, and the caveats.
 * Never add a value here without a citation and an acquisition/model date.
 */

export interface ContextItem {
  id: string;
  topic: string;
  dataClass: DataClass;
  status: 'not-integrated' | 'display-only' | 'assumption';
  summary: string;
  whatToShow: string;
  caveats: string[];
  sources: SourceLink[];
}

export const CONTEXT_ITEMS: ContextItem[] = [
  {
    id: 'meda',
    topic: 'Surface weather observations (temperature, pressure, wind, humidity)',
    dataClass: 'OBSERVED',
    status: 'not-integrated',
    summary:
      'Perseverance carries the MEDA environmental station; its archived data are published through NASA\'s Planetary Data System.',
    whatToShow:
      'Dated historical summaries (e.g. sol ranges) with the product ID and acquisition range, never presented as "live" or forecast.',
    caveats: [
      'Not integrated in this prototype. Confirm product availability and time ranges in the PDS archive before use.',
      'A rover-local record is not a forecast for another location or season.',
    ],
    sources: [
      { title: 'NASA Planetary Data System', url: 'https://pds.nasa.gov/' },
      { title: 'PDS Geosciences Node', url: 'https://pds-geosciences.wustl.edu/' },
    ],
  },
  {
    id: 'climate-model',
    topic: 'Modelled climate (climatology of temperature, pressure, dust)',
    dataClass: 'MODELLED',
    status: 'not-integrated',
    summary:
      'Global climate models such as the Mars Climate Database provide modelled climatologies that can be pre-computed offline.',
    whatToShow:
      'Seasonal/diurnal ranges labelled MODELLED with the model name, version and run date.',
    caveats: [
      'Model output is not a local live weather station and carries model uncertainty.',
      'Not integrated in this prototype.',
    ],
    sources: [{ title: 'Mars Climate Database (LMD)', url: 'http://www-mars.lmd.jussieu.fr/' }],
  },
  {
    id: 'themis-thermal',
    topic: 'Thermal-infrared context (THEMIS)',
    dataClass: 'OBSERVED',
    status: 'display-only',
    summary:
      'A THEMIS daytime infrared mosaic can be toggled on the map as brightness imagery (layer "THEMIS IR daytime mosaic").',
    whatToShow: 'The image layer only, with its provenance record.',
    caveats: [
      'Observations from particular acquisition times, not live weather.',
      'The app does not convert brightness into temperatures.',
    ],
    sources: [{ title: 'NASA Mars Trek WMTS API', url: 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars' }],
  },
  {
    id: 'radiation',
    topic: 'Radiation',
    dataClass: 'OBSERVED',
    status: 'not-integrated',
    summary:
      'Surface radiation was measured by the RAD instrument on Curiosity in Gale crater. Perseverance does not carry an equivalent instrument.',
    whatToShow:
      'If shown at all, Gale-crater RAD values only as a clearly labelled NON-LOCAL reference with their source and date.',
    caveats: [
      'Curiosity RAD measurements from Gale crater are not direct Jezero radiation measurements.',
      'No radiation dose or risk figure is computed or displayed anywhere in this prototype.',
    ],
    sources: [{ title: 'NASA Planetary Data System', url: 'https://pds.nasa.gov/' }],
  },
  {
    id: 'minerals',
    topic: 'Mineral detections (e.g. CRISM)',
    dataClass: 'DERIVED',
    status: 'not-integrated',
    summary:
      'Orbital spectrometer products can show candidate mineralogy where coverage exists; coverage is not complete over Jezero.',
    whatToShow: 'Overlays only where a product with documented Jezero coverage is integrated, with its limitations.',
    caveats: [
      'A mineral detection does not prove that usable water or resources are present.',
      'Not integrated in this prototype.',
    ],
    sources: [{ title: 'NASA Planetary Data System', url: 'https://pds.nasa.gov/' }],
  },
  {
    id: 'mission-assumptions',
    topic: 'Mission assumptions (traverse speed)',
    dataClass: 'SIMULATED',
    status: 'assumption',
    summary:
      'The planner lets you enter an average traverse speed to turn distance into a duration. This is a hypothetical planning input.',
    whatToShow: 'Durations labelled as hypothetical, derived from your chosen speed.',
    caveats: [
      'Not a rover or crew performance specification. Real traverse planning also depends on terrain, power, communications and operations.',
    ],
    sources: [],
  },
];
