// Solar system data.
//
// SOURCES
// - Planet orbits: E.M. Standish, "Keplerian Elements for Approximate Positions of the
//   Major Planets", JPL Solar System Dynamics, Table 1 (valid 1800 AD - 2050 AD).
//   https://ssd.jpl.nasa.gov/planets/approx_pos.html
//   Elements are J2000 ecliptic/equinox; rates are per Julian century.
//   Fields: a [AU], e, I [deg], L mean longitude [deg], varpi longitude of perihelion [deg],
//   Omega longitude of ascending node [deg].
// - Physical data (radius, sidereal rotation, axial tilt, orbital period):
//   NASA GSFC Planetary Fact Sheets, https://nssdc.gsfc.nasa.gov/planetary/factsheet/
//   Negative rotation = retrograde (Venus, Uranus, Pluto, Triton).
// - Spin-axis orientation (pole RA/Dec) and prime-meridian angle W0 at J2000:
//   Archinal et al. (2018), "Report of the IAU Working Group on Cartographic Coordinates
//   and Rotational Elements: 2015", Celest. Mech. Dyn. Astr. 130:22.
// - Moon orbit (mean elements): Meeus, "Astronomical Algorithms" (2nd ed.) ch. 47,
//   truncated to mean terms.
// - Other satellites: JPL Planetary Satellite Mean Elements,
//   https://ssd.jpl.nasa.gov/sats/elem/  and NASA satellite fact sheets.
//   (Mean longitudes at epoch for satellites other than the Moon are illustrative.)

export const AU_KM = 149597870.7;
export const EARTH_R_KM = 6371.0;
export const J2000 = 2451545.0;
export const OBLIQUITY_DEG = 23.4392911;

// Planet Keplerian elements [value at J2000, rate per century]
export const PLANET_ELEMENTS = {
  mercury: { a: [0.38709927, 0.00000037], e: [0.20563593, 0.00001906], I: [7.00497902, -0.00594749], L: [252.2503235, 149472.67411175], varpi: [77.45779628, 0.16047689], Omega: [48.33076593, -0.12534081] },
  venus:   { a: [0.72333566, 0.0000039],  e: [0.00677672, -0.00004107], I: [3.39467605, -0.0007889],  L: [181.9790995, 58517.81538729], varpi: [131.60246718, 0.00268329], Omega: [76.67984255, -0.27769418] },
  earth:   { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], varpi: [102.93768193, 0.32327364], Omega: [0.0, 0.0] },
  mars:    { a: [1.52371034, 0.00001847], e: [0.0933941, 0.00007882],  I: [1.84969142, -0.00813131], L: [-4.55343205, 19140.30268499], varpi: [-23.94362959, 0.44441088], Omega: [49.55953891, -0.29257343] },
  jupiter: { a: [5.202887, -0.00011607],  e: [0.04838624, -0.00013253], I: [1.30439695, -0.00183714], L: [34.39644051, 3034.74612775], varpi: [14.72847983, 0.21252668], Omega: [100.47390909, 0.20469106] },
  saturn:  { a: [9.53667594, -0.0012506],  e: [0.05386179, -0.00050991], I: [2.48599187, 0.00193609],  L: [49.95424423, 1222.49362201], varpi: [92.59887831, -0.41897216], Omega: [113.66242448, -0.28867794] },
  uranus:  { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], varpi: [170.9542763, 0.40805281], Omega: [74.01692503, 0.04240589] },
  neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372],  L: [-55.12002969, 218.45945325], varpi: [44.96476227, -0.32241464], Omega: [131.78422574, -0.00508664] },
  pluto:   { a: [39.48211675, -0.00031596], e: [0.2488273, 0.0000517],  I: [17.14001206, 0.00004818], L: [238.92903833, 145.20780515], varpi: [224.06891629, -0.04062942], Omega: [110.30393684, -0.01183482] },
};

// Body definitions.
//  radiusKm      mean radius
//  rotationH     sidereal rotation period in hours (negative = retrograde)
//  tiltDeg       axial tilt (obliquity to orbit), for display
//  orbitDays     sidereal orbital period (around parent) in days
//  pole          IAU north pole [RA, Dec] in degrees (J2000 equatorial)
//  W0            IAU prime meridian angle at J2000 [deg]
//  moon: { aKm, e, iDeg, M0Deg } for satellites; orbit plane = parent's equator
//        (except the Moon, which uses ecliptic mean elements)
export const BODIES = [
  {
    id: 'sun', name: 'Sun', type: 'Star', parent: null,
    radiusKm: 695700, rotationH: 609.12, tiltDeg: 7.25, orbitDays: null,
    pole: [286.13, 63.87], W0: 84.176,
    color: '#ffcc55', texture: 'textures/2k_sun.jpg',
    fact: 'The Sun holds 99.86% of the Solar System\'s mass, and its equator spins faster than its poles.',
  },
  {
    id: 'mercury', name: 'Mercury', type: 'Planet', parent: 'sun',
    radiusKm: 2439.7, rotationH: 1407.6, tiltDeg: 0.034, orbitDays: 87.969,
    pole: [281.0103, 61.4155], W0: 329.5988,
    color: '#9a948c', texture: 'textures/2k_mercury.jpg',
    fact: 'Mercury spins exactly 3 times for every 2 orbits, so one solar day lasts two Mercury years.',
  },
  {
    id: 'venus', name: 'Venus', type: 'Planet', parent: 'sun',
    radiusKm: 6051.8, rotationH: -5832.6, tiltDeg: 177.36, orbitDays: 224.701,
    pole: [272.76, 67.16], W0: 160.20,
    color: '#e3c07a', texture: 'textures/2k_venus_surface.jpg',
    fact: 'Venus spins backwards: on Venus the Sun rises in the west and sets in the east.',
  },
  {
    id: 'earth', name: 'Earth', type: 'Planet', parent: 'sun',
    radiusKm: 6371.0, rotationH: 23.9345, tiltDeg: 23.44, orbitDays: 365.256,
    pole: [0.0, 90.0], W0: 190.147,
    color: '#3f7fd6', texture: 'textures/2k_earth_daymap.jpg',
    fact: 'A solar day (24 h) is about 4 minutes longer than one full spin (23 h 56 m) because Earth moves along its orbit.',
  },
  {
    id: 'moon', name: 'Moon', type: 'Moon', parent: 'earth',
    radiusKm: 1737.4, rotationH: 655.72, tiltDeg: 6.68, orbitDays: 27.321661,
    locked: true, moon: { aKm: 384400, e: 0.0549, iDeg: 5.145, luna: true },
    color: '#bdbab4', texture: 'textures/2k_moon.jpg',
    fact: 'The Moon is tidally locked: it turns once per orbit, so the same face always points at Earth.',
  },
  {
    id: 'mars', name: 'Mars', type: 'Planet', parent: 'sun',
    radiusKm: 3389.5, rotationH: 24.6229, tiltDeg: 25.19, orbitDays: 686.98,
    pole: [317.681, 52.887], W0: 176.049863,
    color: '#c1512f', texture: 'textures/2k_mars.jpg',
    fact: 'A Martian solar day, a "sol", is 24 h 39 m 35 s, remarkably close to Earth\'s.',
  },
  {
    id: 'phobos', name: 'Phobos', type: 'Moon', parent: 'mars',
    radiusKm: 11.27, rotationH: 7.6538, tiltDeg: 0, orbitDays: 0.31891023,
    locked: true, moon: { aKm: 9376, e: 0.0151, iDeg: 1.075, M0Deg: 30 },
    color: '#7d6f63', procedural: 'rocky',
    fact: 'Phobos orbits faster than Mars spins, so it rises in the west, twice a day.',
  },
  {
    id: 'deimos', name: 'Deimos', type: 'Moon', parent: 'mars',
    radiusKm: 6.2, rotationH: 30.2986, tiltDeg: 0, orbitDays: 1.2624407,
    locked: true, moon: { aKm: 23463.2, e: 0.0002, iDeg: 1.788, M0Deg: 200 },
    color: '#8d8174', procedural: 'rocky',
    fact: 'Deimos is only about 12 km across; from the surface of Mars it looks like a bright star.',
  },
  {
    id: 'jupiter', name: 'Jupiter', type: 'Planet', parent: 'sun',
    radiusKm: 69911, rotationH: 9.925, tiltDeg: 3.13, orbitDays: 4332.589,
    pole: [268.056595, 64.495303], W0: 284.95,
    color: '#c9a27a', texture: 'textures/2k_jupiter.jpg',
    fact: 'Jupiter has the shortest day of any planet: under 10 hours, despite being 11 times wider than Earth.',
  },
  {
    id: 'io', name: 'Io', type: 'Moon', parent: 'jupiter',
    radiusKm: 1821.6, rotationH: 42.459, tiltDeg: 0, orbitDays: 1.769138,
    locked: true, moon: { aKm: 421800, e: 0.0041, iDeg: 0.036, M0Deg: 0 },
    color: '#e8d45a', procedural: 'io',
    fact: 'Io is the most volcanically active world known, heated by tidal flexing from Jupiter.',
  },
  {
    id: 'europa', name: 'Europa', type: 'Moon', parent: 'jupiter',
    radiusKm: 1560.8, rotationH: 85.228, tiltDeg: 0.1, orbitDays: 3.551181,
    locked: true, moon: { aKm: 671100, e: 0.0094, iDeg: 0.466, M0Deg: 90 },
    color: '#d9cbb0', procedural: 'europa',
    fact: 'Europa hides a salty ocean under its ice with perhaps twice the water of Earth\'s oceans.',
  },
  {
    id: 'ganymede', name: 'Ganymede', type: 'Moon', parent: 'jupiter',
    radiusKm: 2631.2, rotationH: 171.709, tiltDeg: 0.33, orbitDays: 7.154553,
    locked: true, moon: { aKm: 1070400, e: 0.0013, iDeg: 0.177, M0Deg: 180 },
    color: '#9d9384', procedural: 'ganymede',
    fact: 'Ganymede is the largest moon in the Solar System, bigger than the planet Mercury.',
  },
  {
    id: 'callisto', name: 'Callisto', type: 'Moon', parent: 'jupiter',
    radiusKm: 2410.3, rotationH: 400.536, tiltDeg: 0, orbitDays: 16.689018,
    locked: true, moon: { aKm: 1882700, e: 0.0074, iDeg: 0.192, M0Deg: 270 },
    color: '#5f564c', procedural: 'callisto',
    fact: 'Callisto is one of the most heavily cratered surfaces in the Solar System.',
  },
  {
    id: 'saturn', name: 'Saturn', type: 'Planet', parent: 'sun',
    radiusKm: 58232, rotationH: 10.656, tiltDeg: 26.73, orbitDays: 10759.22,
    pole: [40.589, 83.537], W0: 38.90,
    color: '#dcc28c', texture: 'textures/2k_saturn.jpg',
    rings: { innerKm: 74500, outerKm: 140220, texture: 'textures/2k_saturn_ring_alpha.png' },
    fact: 'Saturn is less dense than water. Its rings span 280,000 km but are mostly only ~10 m thick.',
  },
  {
    id: 'titan', name: 'Titan', type: 'Moon', parent: 'saturn',
    radiusKm: 2574.7, rotationH: 382.68, tiltDeg: 0.3, orbitDays: 15.945421,
    locked: true, moon: { aKm: 1221870, e: 0.0288, iDeg: 0.306, M0Deg: 120 },
    color: '#d39a45', procedural: 'titan',
    fact: 'Titan has a thicker atmosphere than Earth, and lakes of liquid methane.',
  },
  {
    id: 'uranus', name: 'Uranus', type: 'Planet', parent: 'sun',
    radiusKm: 25362, rotationH: -17.24, tiltDeg: 97.77, orbitDays: 30685.4,
    pole: [257.311, -15.175], W0: 203.81,
    color: '#9fd8e0', texture: 'textures/2k_uranus.jpg',
    fact: 'Uranus is tipped on its side, so each pole gets about 42 years of continuous sunlight, then 42 of darkness.',
  },
  {
    id: 'neptune', name: 'Neptune', type: 'Planet', parent: 'sun',
    radiusKm: 24622, rotationH: 16.11, tiltDeg: 28.32, orbitDays: 60189,
    pole: [299.36, 43.46], W0: 249.978,
    color: '#4a6fe0', texture: 'textures/2k_neptune.jpg',
    fact: 'Neptune has completed only one orbit (in 2011) since its discovery in 1846.',
  },
  {
    id: 'triton', name: 'Triton', type: 'Moon', parent: 'neptune',
    radiusKm: 1353.4, rotationH: -141.0445, tiltDeg: 0, orbitDays: 5.876854,
    locked: true, retrograde: true, moon: { aKm: 354759, e: 0.000016, iDeg: 156.865, M0Deg: 60 },
    color: '#cbb9b0', procedural: 'triton',
    fact: 'Triton orbits backwards (retrograde), a sign it was captured from the Kuiper Belt.',
  },
  {
    id: 'pluto', name: 'Pluto', type: 'Dwarf planet', parent: 'sun',
    radiusKm: 1188.3, rotationH: -153.2928, tiltDeg: 122.53, orbitDays: 90560,
    pole: [132.993, -6.163], W0: 302.695,
    color: '#c7a98a', procedural: 'pluto',
    fact: 'Pluto hasn\'t finished a single orbit since its discovery in 1930; it will in 2178.',
  },
];

export const BODY_BY_ID = Object.fromEntries(BODIES.map(b => [b.id, b]));

// Satellites use their parent's pole/orbit plane; the Moon's spin axis is taken as its orbit normal.
