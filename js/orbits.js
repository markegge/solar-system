// Orbital mechanics helpers (no Three.js dependency, so this also runs under Node for checks).
// All vectors are plain [x, y, z] arrays in the J2000 ECLIPTIC frame unless noted.
import { PLANET_ELEMENTS, BODY_BY_ID, J2000, OBLIQUITY_DEG } from './data.js';

const DEG = Math.PI / 180;

export function norm360(x) { x %= 360; return x < 0 ? x + 360 : x; }

// Solve Kepler's equation M = E - e sin E (radians)
export function solveKepler(M, e) {
  M = Math.atan2(Math.sin(M), Math.cos(M));
  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let i = 0; i < 30; i++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

export function trueAnomaly(E, e) {
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
}

// Rotate a point in the orbital plane (x toward periapsis) into the reference frame
function orbitalToRef(xp, yp, omega, Omega, I) {
  const co = Math.cos(omega), so = Math.sin(omega);
  const cO = Math.cos(Omega), sO = Math.sin(Omega);
  const cI = Math.cos(I), sI = Math.sin(I);
  return [
    (co * cO - so * sO * cI) * xp + (-so * cO - co * sO * cI) * yp,
    (co * sO + so * cO * cI) * xp + (-so * sO + co * cO * cI) * yp,
    (so * sI) * xp + (co * sI) * yp,
  ];
}

export function planetElements(id, jd) {
  const el = PLANET_ELEMENTS[id];
  const T = (jd - J2000) / 36525;
  const v = k => el[k][0] + el[k][1] * T;
  return { a: v('a'), e: v('e'), I: v('I'), L: v('L'), varpi: v('varpi'), Omega: v('Omega') };
}

// Heliocentric ecliptic position in AU (JPL approximate method)
export function planetPosition(id, jd) {
  const { a, e, I, L, varpi, Omega } = planetElements(id, jd);
  const omega = varpi - Omega;
  const M = (L - varpi) * DEG;
  const E = solveKepler(M, e);
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  return orbitalToRef(xp, yp, omega * DEG, Omega * DEG, I * DEG);
}

// Sampled closed orbit (AU, ecliptic) at the given epoch
export function planetOrbitPath(id, jd, n = 256) {
  const { a, e, I, varpi, Omega } = planetElements(id, jd);
  const omega = (varpi - Omega) * DEG;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const E = (i / n) * 2 * Math.PI;
    pts.push(orbitalToRef(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E), omega, Omega * DEG, I * DEG));
  }
  return pts;
}

// --- Orientation -----------------------------------------------------------------

const eps = OBLIQUITY_DEG * DEG;
export function equatorialToEcliptic([x, y, z]) {
  return [x, y * Math.cos(eps) + z * Math.sin(eps), -y * Math.sin(eps) + z * Math.cos(eps)];
}

// IAU pole (RA, Dec) -> unit vector in ecliptic frame
export function poleVector(raDeg, decDeg) {
  const a = raDeg * DEG, d = decDeg * DEG;
  return equatorialToEcliptic([Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)]);
}

// Ascending node of the body's equator on the ICRF equator (reference for W)
export function nodeVector(raDeg) {
  const a = raDeg * DEG;
  return equatorialToEcliptic([-Math.sin(a), Math.cos(a), 0]);
}

export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const unit = a => scale(a, 1 / len(a));

// Equatorial basis of a planet (pole n, node u, v = n x u), ecliptic frame
export function planetBasis(body) {
  const n = poleVector(body.pole[0], body.pole[1]);
  const u = unit(nodeVector(body.pole[0]));
  return { n, u, v: cross(n, u) };
}

// Prime meridian angle W [deg] at jd (uniform rotation from IAU W0 and sidereal period)
export function rotationAngle(body, jd) {
  const rateDegPerDay = 360 / (body.rotationH / 24);
  return norm360((body.W0 || 0) + rateDegPerDay * (jd - J2000));
}

// --- Satellites --------------------------------------------------------------------

// Mean elements of the Moon (Meeus ch. 47, mean terms only), degrees
function lunaElements(jd) {
  const d = jd - J2000;
  const L = 218.3164477 + 13.17639648 * d;   // mean longitude
  const M = 134.9633964 + 13.06499295 * d;   // mean anomaly
  const Omega = 125.0445479 - 0.0529538083 * d; // ascending node
  return { L, M, Omega };
}

/**
 * Satellite position relative to its parent (km, ecliptic).
 * Returns { pos, normal, M, nu } where normal is the orbit normal (unit), M/nu in radians.
 */
export function satellitePosition(body, jd, parentBasis) {
  const m = body.moon;
  const e = m.e;
  if (m.luna) {
    const { L, M, Omega } = lunaElements(jd);
    const omega = (L - M) - Omega; // argument of perigee
    const Mr = M * DEG;
    const E = solveKepler(Mr, e);
    const nu = trueAnomaly(E, e);
    const r = m.aKm * (1 - e * Math.cos(E));
    const pos = orbitalToRef(r * Math.cos(nu), r * Math.sin(nu), omega * DEG, Omega * DEG, m.iDeg * DEG);
    const ci = Math.cos(m.iDeg * DEG), si = Math.sin(m.iDeg * DEG), Or = Omega * DEG;
    const normal = [si * Math.sin(Or), -si * Math.cos(Or), ci];
    return { pos, normal, M: Mr, nu };
  }
  // Generic: orbit in the parent's equatorial plane, inclined by i about the node u.
  const { n, u, v } = parentBasis;
  const i = m.iDeg * DEG;
  const vp = add(scale(v, Math.cos(i)), scale(n, Math.sin(i)));
  const normal = add(scale(n, Math.cos(i)), scale(v, -Math.sin(i)));
  const meanMotion = 360 / body.orbitDays; // deg/day (orbit sense is set by the inclination)
  const Mr = norm360((m.M0Deg || 0) + meanMotion * (jd - J2000)) * DEG;
  const E = solveKepler(Mr, e);
  const nu = trueAnomaly(E, e);
  const r = m.aKm * (1 - e * Math.cos(E));
  const pos = add(scale(u, r * Math.cos(nu)), scale(vp, r * Math.sin(nu)));
  return { pos, normal, M: Mr, nu, u, vp };
}

// Sampled satellite orbit relative to parent (km, ecliptic)
export function satelliteOrbitPath(body, jd, parentBasis, n = 180) {
  const m = body.moon, e = m.e;
  const pts = [];
  if (m.luna) {
    const { L, M, Omega } = lunaElements(jd);
    const omega = (L - M) - Omega;
    for (let k = 0; k <= n; k++) {
      const E = (k / n) * 2 * Math.PI;
      pts.push(orbitalToRef(m.aKm * (Math.cos(E) - e), m.aKm * Math.sqrt(1 - e * e) * Math.sin(E), omega * DEG, Omega * DEG, m.iDeg * DEG));
    }
    return pts;
  }
  const { n: nn, u, v } = parentBasis;
  const i = m.iDeg * DEG;
  const vp = add(scale(v, Math.cos(i)), scale(nn, Math.sin(i)));
  for (let k = 0; k <= n; k++) {
    const E = (k / n) * 2 * Math.PI;
    const x = m.aKm * (Math.cos(E) - e), y = m.aKm * Math.sqrt(1 - e * e) * Math.sin(E);
    pts.push(add(scale(u, x), scale(vp, y)));
  }
  return pts;
}

// --- Day lengths -------------------------------------------------------------------

/** Sidereal day in Earth days (signed: negative = retrograde). */
export function siderealDays(body) { return body.rotationH / 24; }

/**
 * Mean solar day in Earth days (signed: negative = the Sun moves east-to-west backwards,
 * i.e. retrograde rotation).  The Sun's apparent direction from a body turns at the rate of
 * the body's HELIOCENTRIC orbit - for a moon, that is its parent planet's year.
 *    1 / solar = 1 / sidereal - 1 / year      (sidereal signed; retrograde < 0)
 */
export function solarDays(body) {
  if (!body.parent) return null;
  const helio = body.parent === 'sun' ? body : BODY_BY_ID[body.parent];
  const sid = siderealDays(body);
  const year = helio.orbitDays;
  const f = 1 / sid - 1 / year;
  if (Math.abs(f) < 1e-12) return Infinity;
  return 1 / f;
}

/** Heliocentric "year" (days) felt by the body (its own for planets, parent's for moons). */
export function yearDays(body) {
  if (!body.parent) return null;
  return body.parent === 'sun' ? body.orbitDays : BODY_BY_ID[body.parent].orbitDays;
}
