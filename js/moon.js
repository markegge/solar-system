// Precise Moon: position and orientation from the vendored astronomy-engine (MIT, v2.1.19).
//
// Position: astronomy-engine GeoMoon() - a lunar theory derived from Brown / the Improved
//   Lunar Ephemeris (via Montenbruck & Pfleger), with its full periodic series, converted from
//   the ecliptic of date to the J2000 mean equator (precession included). Checked against JPL
//   Horizons in tools/check.mjs (better than 0.01 degree, 2020-2030).
// Orientation: astronomy-engine RotationAxis(Body.Moon) - the IAU WGCCRE lunar model: pole
//   RA/Dec and prime meridian W with the periodic E1..E13 terms, so physical libration is
//   included and longitude 0 (the mean sub-Earth point) faces Earth.
import { GeoMoon, RotationAxis, Body } from './vendor/astronomy-engine-2.1.19.js';
import { OBLIQUITY_DEG } from './data.js';

const EPS = OBLIQUITY_DEG * Math.PI / 180;
const equatorialToEcliptic = ([x, y, z]) => [x, y * Math.cos(EPS) + z * Math.sin(EPS), -y * Math.sin(EPS) + z * Math.cos(EPS)];

export const KM_PER_AU = 149597870.7;
const J2000 = 2451545.0;

/** Geocentric Moon position, km, J2000 mean ECLIPTIC frame. jd is a UTC Julian date. */
export function moonGeocentricKm(jd) {
  const v = GeoMoon(jd - J2000); // number = UTC days since J2000; returns EQJ vector in AU
  return equatorialToEcliptic([v.x * KM_PER_AU, v.y * KM_PER_AU, v.z * KM_PER_AU]);
}

/**
 * Lunar orientation. Returns { raDeg, decDeg, W } where (raDeg, decDeg) is the north pole in
 * J2000 equatorial coordinates and W the prime meridian angle in degrees (IAU convention:
 * measured from the ascending node of the lunar equator on the ICRF equator).
 */
export function moonOrientation(jd) {
  const a = RotationAxis(Body.Moon, jd - J2000);
  return { raDeg: a.ra * 15, decDeg: a.dec, W: a.spin };
}
