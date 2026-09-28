// Sanity checks: node tools/check.mjs
import { BODIES, BODY_BY_ID } from '../js/data.js';
import { solarDays, siderealDays, planetPosition, satellitePosition, planetBasis } from '../js/orbits.js';

const expected = { moon: 29.530589, mercury: 175.94, venus: -116.75, earth: 1.0, mars: 1.02749 };
let ok = true;
for (const b of BODIES) {
  const s = solarDays(b);
  const exp = expected[b.id];
  const flag = exp == null ? '' : (Math.abs(s - exp) / Math.abs(exp) < 0.002 ? '  OK' : '  MISMATCH (expected ' + exp + ')');
  if (flag.includes('MISMATCH')) ok = false;
  console.log(b.name.padEnd(9), 'sidereal', siderealDays(b).toFixed(4).padStart(10), 'd   solar', s == null ? '   n/a' : s.toFixed(4).padStart(10), 'd', s ? `(${(s*24).toFixed(3)} h)` : '', flag);
}
const jd = 2461311.5; // 2026-09-27 00:00 UTC
const e = planetPosition('earth', jd);
const lon = (Math.atan2(e[1], e[0]) * 180 / Math.PI + 360) % 360;
console.log('Earth heliocentric longitude 2026-09-27:', lon.toFixed(2), '(Sun geocentric lon ~', ((lon + 180) % 360).toFixed(2), ', expect ~184)');
const m = satellitePosition(BODY_BY_ID.moon, jd, null);
const mlon = (Math.atan2(m.pos[1], m.pos[0]) * 180 / Math.PI + 360) % 360;
const elong = ((mlon - (lon + 180)) % 360 + 360) % 360;
console.log('Moon geocentric lon', mlon.toFixed(1), 'elongation from Sun', elong.toFixed(1), '(0=new, 180=full)');
process.exit(ok ? 0 : 1);
