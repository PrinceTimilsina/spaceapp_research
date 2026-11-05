export const SITE = {
  name: 'PROJECT ASTRA',
  tagline: 'From planetary data to mission decisions.',
  challenge: 'NASA Space Apps Challenge 2026 · Interplanetary Survival Guide: Martian Map',
  focus: 'Jezero Crater, Mars',
};

export const PROTOTYPE_NOTICE =
  'Research and education prototype. Not certified navigation, not a validated safety system and not a life-support predictor. Routes are planning demonstrations; no route is claimed to be safe.';

export const MISSION_OBJECTIVES = [
  'Understand Jezero terrain from orbital imagery and, when supplied, an elevation model.',
  'Investigate sourced scientific targets and their geological context.',
  'Compare outbound routes under explicit, adjustable planning assumptions.',
  'Plan the return journey as part of the mission from the start.',
  'Keep provenance, uncertainty and data gaps visible at every step.',
];

export const GLOBAL_LIMITATIONS = [
  'The route planner runs on SIMULATED terrain unless you supply a real DEM (see README). Simulated routes are algorithm demonstrations only.',
  'Orbital imagery cannot show individual rocks, soft ground or sand traps below its resolution; no hazard-free claim is made.',
  'Mobility profiles (maximum slope, weights) are planning assumptions, not NASA or vendor specifications.',
  'Terrain burden is a relative model index (% extra effort over flat ground). It is not a safety score.',
  'THEMIS and other mosaics are observations from particular times, not live weather. No live environmental data are shown.',
  'Curiosity radiation measurements are from Gale crater and are not Jezero measurements.',
  'Mineral detections do not prove that usable water or resources are present.',
  'Point-of-interest coordinates come from a secondary source, are rounded, and must be verified before publication.',
  'Mars Trek layer availability depends on the live NASA service; the app shows unavailable states rather than substituting data.',
];
