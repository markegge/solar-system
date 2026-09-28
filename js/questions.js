// Preset questions: each sets up the scene and shows an answer.
// Numbers in the answers are computed from data.js so they always agree with the info panel.
import { BODY_BY_ID as B } from './data.js';
import { solarDays, siderealDays } from './orbits.js';
import { fmtNum } from './format.js';

const sd = id => Math.abs(solarDays(B[id]));
const sid = id => Math.abs(siderealDays(B[id]));

// speed indices refer to SPEEDS in main.js:
// 0 real, 1 1min, 2 10min, 3 1h, 4 6h, 5 1day, 6 1week, 7 1month, 8 1yr, 9 10yr
export const QUESTIONS = [
  {
    id: 'moon-day',
    q: 'How long is a day on the Moon?',
    body: 'moon', speed: 5, markers: true,
    view: { dir: 'above', distR: 9 },
    answer: () => `
      <div class="big">${fmtNum(sd('moon'), 1)} Earth days</div>
      <p>The Moon spins once every <b>${fmtNum(sid('moon'), 1)} days</b> (its sidereal day). But from sunrise to sunrise, a <b>solar day</b>, takes <b>${fmtNum(sd('moon'), 1)} days</b>, about two weeks of daylight followed by two weeks of night.</p>
      <p>The difference comes from Earth's trip around the Sun: while the Moon turns once, the pair moves about 1/13 of the way around their orbit, so the Moon has to turn a bit further before the Sun is overhead again. It is also why a lunar month (new moon to new moon) is 29.5 days.</p>
      <p class="hint">Running at 1 day per second. Watch day and night sweep across the surface once every ~30 seconds, while the <span class="pinkdot"></span> marker keeps facing Earth.</p>`,
  },
  {
    id: 'same-side',
    q: 'Why do we always see the same side of the Moon?',
    body: 'earth', speed: 5, markers: true,
    view: { dir: 'above', distMoonOrbit: 3.4 },
    answer: () => `
      <p>Because the Moon is <b>tidally locked</b>: it rotates exactly once per orbit (${fmtNum(sid('moon'), 2)} days for both), so the same hemisphere always faces Earth.</p>
      <p>Earth's gravity stretched the young Moon into a slightly egg-shaped body. Tides pulling on that bulge acted as a brake until its spin matched its orbit. Most large moons are locked the same way, including Io, Europa, Ganymede, Callisto, Titan and Triton.</p>
      <p class="hint">Watch the <span class="pinkdot"></span> marker on the Moon: it stays pointed at Earth all the way round. Because the orbit is slightly elliptical it wobbles a little (libration), which lets us see about 59% of the surface over time.</p>`,
  },
  {
    id: 'venus-day',
    q: 'Why does Venus’s day outlast its year?',
    body: 'venus', speed: 6, markers: true,
    view: { dir: 'above', distR: 5.5 },
    answer: () => `
      <p>Venus turns extremely slowly, and <b>backwards</b>: one spin takes <b>${fmtNum(sid('venus'), 0)} Earth days</b>, but one orbit of the Sun takes only <b>${fmtNum(B.venus.orbitDays, 1)} days</b>. So a single rotation is longer than its year.</p>
      <p>Because the spin is retrograde, it works together with the orbital motion, and sunrise-to-sunrise (the solar day) is only <b>${fmtNum(sd('venus'), 1)} days</b>, just under two solar days per Venus year. The Sun rises in the west.</p>
      <p class="hint">Running at 1 week per second. The <span class="pinkdot"></span> marker turns clockwise when seen from above, the opposite of Venus's orbit.</p>`,
  },
  {
    id: 'mercury-day',
    q: 'How long is a day on Mercury?',
    body: 'mercury', speed: 6, markers: true,
    view: { dir: 'above', distR: 6 },
    answer: () => `
      <div class="big">${fmtNum(sd('mercury'), 0)} Earth days</div>
      <p>Mercury spins once every <b>${fmtNum(sid('mercury'), 1)} days</b> and orbits in <b>${fmtNum(B.mercury.orbitDays, 0)} days</b>: exactly 3 spins for every 2 orbits. The result is that one solar day lasts <b>two Mercury years</b>.</p>
      <p class="hint">Running at 1 week per second. Follow the <span class="pinkdot"></span> marker: once it points at the Sun, it only points at the Sun again after Mercury has gone round twice.</p>`,
  },
  {
    id: 'mars-day',
    q: 'How long is a day on Mars?',
    body: 'mars', speed: 3, markers: true,
    view: { dir: 'sunlit', distR: 4.5 },
    answer: () => {
      const s = sd('mars') * 86400;
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
      return `
      <div class="big">${h} h ${m} m ${sec} s</div>
      <p>A Martian solar day, called a <b>sol</b>, is only about 40 minutes longer than Earth's. Mars spins in ${fmtNum(sid('mars') * 24, 2)} hours, and its slow 687-day orbit adds about 2 more minutes to get from noon to noon.</p>
      <p>Mars is also tilted ${B.mars.tiltDeg}°, almost the same as Earth's 23.4°, so it has seasons too, each about twice as long as ours.</p>
      <p class="hint">Running at 1 hour per second: one sol takes about 25 seconds.</p>`;
    },
  },
  {
    id: 'uranus-seasons',
    q: 'What are the seasons like on Uranus?',
    body: 'uranus', speed: 8, markers: true,
    view: { dir: 'side', distR: 7 },
    answer: () => `
      <p>Uranus is tipped over by <b>${B.uranus.tiltDeg}°</b>, so it essentially rolls around the Sun on its side. Over its <b>84-year</b> orbit each pole spends about 42 years in continuous sunlight, then 42 years in darkness.</p>
      <p>Its day is ${fmtNum(sid('uranus') * 24, 1)} hours and, like Venus, it spins retrograde. The tilt was probably caused by a giant collision long ago.</p>
      <p class="hint">Running at 1 year per second. Watch the axis line: first one pole, then the equator, then the other pole faces the Sun.</p>`,
  },
];
