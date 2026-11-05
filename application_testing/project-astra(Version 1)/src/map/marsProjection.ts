import Projection from 'ol/proj/Projection';
import { M_PER_DEG } from '../domain/mars';

/**
 * Mars equirectangular lon/lat (planetocentric, east positive) on the Mars 2000 sphere.
 * Map coordinates ARE degrees [lon, lat]. This matches NASA Trek's equirectangular tile services
 * (SupportedCRS urn:ogc:def:crs:EPSG::104905 in the capabilities). It is NOT Web Mercator.
 * `metersPerUnit` uses the Mars radius so OpenLayers never falls back to Earth geometry.
 */
export const MARS_EXTENT: [number, number, number, number] = [-180, -90, 180, 90];

export const MARS_PROJECTION = new Projection({
  code: 'MARS:2000-EQ',
  units: 'degrees',
  extent: MARS_EXTENT,
  worldExtent: MARS_EXTENT,
  global: true,
  metersPerUnit: M_PER_DEG,
});
