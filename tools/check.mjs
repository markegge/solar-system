// Sanity checks against authoritative data: node tools/check.mjs
//  1. Solar-day lengths vs known values
//  2. Geocentric Moon RA/Dec/distance vs JPL Horizons (tools/reference/horizons_moon.json)
//  3. Simulated new/full moon times vs USNO (tools/reference/usno_phases.json)
// The Moon and Sun here go through the same functions the site uses (orbits.js / moon.js).
import { readFileSync } from 'node:fs';
import { BODIES, AU_KM, OBLIQUITY_DEG } from '../js/data.js';
import { solarDays, siderealDays, planetPosition, satellitePosition } from '../js/orbits.js';
import { BODY_BY_ID } from '../js/data.js';
import { moonOrientation } from '../js/moon.js';
import { poleVector, nodeVector, unit, cross, dot } from '../js/orbits.js';

const ref = f => JSON.parse(readFileSync(new URL('./reference/' + f, import.meta.url)));
const D = Math.PI / 180;
const jdOf = iso => Date.parse(iso) / 86400000 + 2440587.5;
let ok = true;

// ---- 1. Day lengths
console.log('== Day lengths');
const expected = { moon: 29.530589, mercury: 175.94, venus: -116.75, earth: 1.0, mars: 1.02749 };
for (const b of BODIES) {
  const s = solarDays(b), exp = expected[b.id];
  let flag = '';
  if (exp != null) { const good = Math.abs(s - exp) / Math.abs(exp) < 0.002; ok &&= good; flag = good ? '  OK' : `  MISMATCH (expected ${exp})`; }
  console.log(b.name.padEnd(9), 'sidereal', siderealDays(b).toFixed(4).padStart(10), 'd   solar', s == null ? '       n/a' : s.toFixed(4).padStart(10), 'd', flag);
}

// ---- 2. Moon vs Horizons
const eps = OBLIQUITY_DEG * D;
const eclToEqu = ([x, y, z]) => [x, y * Math.cos(eps) - z * Math.sin(eps), y * Math.sin(eps) + z * Math.cos(eps)];
const moonKm = jd => satellitePosition(BODY_BY_ID.moon, jd, null).pos; // J2000 ecliptic, km
console.log('\n== Moon vs JPL Horizons (geocentric, J2000/ICRF)');
console.log('UTC                    RA model     RA JPL       Dec model   Dec JPL     sep (deg)   dist err (km)');
let maxSep = 0;
for (const [iso, ra, dec, dAU] of ref('horizons_moon.json').rows) {
  const [x, y, z] = eclToEqu(moonKm(jdOf(iso)));
  const r = Math.hypot(x, y, z);
  const mra = (Math.atan2(y, x) / D + 360) % 360, mdec = Math.asin(z / r) / D;
  const sep = Math.acos(Math.min(1, Math.sin(mdec * D) * Math.sin(dec * D) + Math.cos(mdec * D) * Math.cos(dec * D) * Math.cos((mra - ra) * D))) / D;
  maxSep = Math.max(maxSep, sep);
  console.log(iso.slice(0, 16).padEnd(22), mra.toFixed(4).padStart(10), ra.toFixed(4).padStart(10), mdec.toFixed(4).padStart(11), dec.toFixed(4).padStart(10), sep.toFixed(4).padStart(11), (r - dAU * AU_KM).toFixed(1).padStart(12));
}
const moonOk = maxSep < 0.01;
ok &&= moonOk;
console.log(`max separation ${maxSep.toFixed(4)} deg (${(maxSep * 3600).toFixed(1)}")  ${moonOk ? 'OK (< 0.01 deg)' : 'FAIL'}`);

// ---- 3. Phase timing vs USNO, using the scene's own Sun (JPL elements) and Moon
// Earth = EM barycentre - Moon/82.3 (as in the scene). Elongation measured in J2000 ecliptic longitude.
function elongation(jd) {
  const m = moonKm(jd);
  const emb = planetPosition('earth', jd).map(v => v * AU_KM);
  const earth = emb.map((v, i) => v - m[i] / 82.30056);
  const lm = Math.atan2(m[1], m[0]), ls = Math.atan2(-earth[1], -earth[0]);
  return ((lm - ls) / D % 360 + 360) % 360;
}
function findPhase(target, jd0) {
  const f = jd => ((elongation(jd) - target + 540) % 360) - 180; // signed, wraps
  let a = jd0 - 1, b = jd0 + 1;
  for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; }
  return (a + b) / 2;
}
console.log('\n== New / full moon timing vs USNO');
console.log('Phase       USNO (UT)            model (UT)            diff');
let maxDiff = 0;
for (const [phase, iso] of ref('usno_phases.json').rows) {
  const jdU = jdOf(iso);
  const jdM = findPhase(phase === 'New Moon' ? 0 : 180, jdU);
  const diffMin = (jdM - jdU) * 1440;
  maxDiff = Math.max(maxDiff, Math.abs(diffMin));
  const model = new Date((jdM - 2440587.5) * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  console.log(phase.padEnd(11), iso.slice(0, 16).replace('T', ' ').padEnd(20), model.padEnd(21), `${diffMin >= 0 ? '+' : ''}${diffMin.toFixed(1)} min`);
}
const phaseOk = maxDiff < 5;
ok &&= phaseOk;
console.log(`max |diff| ${maxDiff.toFixed(1)} min  ${phaseOk ? 'OK (< 5 min)' : 'FAIL'}`);

// ---- 4. Lunar orientation: the sub-Earth point (libration) vs Horizons
// Uses the same IAU pole/prime-meridian the scene uses to orient the Moon's texture.
console.log('\n== Sub-Earth point on the Moon (libration) vs JPL Horizons');
console.log('UTC                 lon model  lon JPL   lat model  lat JPL   error (deg)');
let maxLib = 0;
for (const [iso, lonJ, latJ] of ref('horizons_moon_subearth.json').rows) {
  const jd = jdOf(iso);
  const o = moonOrientation(jd);
  const n = poleVector(o.raDeg, o.decDeg), u = unit(nodeVector(o.raDeg)), v = cross(n, u);
  const W = o.W * D;
  const pm = u.map((x, i) => x * Math.cos(W) + v[i] * Math.sin(W)); // prime meridian direction
  const east = cross(n, pm);
  const d = unit(moonKm(jd).map(x => -x));                          // Moon -> Earth
  const lon = (Math.atan2(dot(d, east), dot(d, pm)) / D + 360) % 360, lat = Math.asin(dot(d, n)) / D;
  const err = Math.acos(Math.min(1, Math.sin(lat * D) * Math.sin(latJ * D) + Math.cos(lat * D) * Math.cos(latJ * D) * Math.cos((lon - lonJ) * D))) / D;
  maxLib = Math.max(maxLib, err);
  console.log(iso.slice(0, 16).padEnd(19), lon.toFixed(3).padStart(9), lonJ.toFixed(3).padStart(9), lat.toFixed(3).padStart(10), latJ.toFixed(3).padStart(8), err.toFixed(3).padStart(12));
}
const libOk = maxLib < 0.1;
ok &&= libOk;
console.log(`max error ${maxLib.toFixed(3)} deg  ${libOk ? 'OK (< 0.1 deg)' : 'FAIL'}`);

console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
