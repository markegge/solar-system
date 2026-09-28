import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BODIES, BODY_BY_ID, AU_KM, EARTH_R_KM } from './data.js';
import * as O from './orbits.js';
import { moonOrientation } from './moon.js';
import { QUESTIONS } from './questions.js';
import { makeProceduralTexture, makeGlowCanvas } from './textures.js';
import { fmtNum, fmtDuration, fmtDurationSub, fmtDistanceKm } from './format.js';

// ---------------------------------------------------------------------------------------
// Constants & state
// ---------------------------------------------------------------------------------------
const DEG = Math.PI / 180;
const SPEEDS = [
  { s: 1, label: 'Real time' },
  { s: 60, label: '1 minute / s' },
  { s: 600, label: '10 minutes / s' },
  { s: 3600, label: '1 hour / s' },
  { s: 21600, label: '6 hours / s' },
  { s: 86400, label: '1 day / s' },
  { s: 604800, label: '1 week / s' },
  { s: 2629746, label: '1 month / s' },
  { s: 31556952, label: '1 year / s' },
  { s: 315569520, label: '10 years / s' },
];
const JD_MIN = 2305447.5; // 1600-01-01
const JD_MAX = 2597640.5; // 2400-01-01
const VIS_D = 60, VIS_P = 0.6; // visible scale: d = 60 * r_AU^0.6 (scene units)
const EARTH_MOON_MASS_RATIO_PLUS_1 = 82.30056; // 1 + M_earth / M_moon (IAU 2009: 81.30056)
const KEY_BODIES = ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];

const nowJD = () => Date.now() / 86400000 + 2440587.5;
const jdToDate = jd => new Date((jd - 2440587.5) * 86400000);

const S = {
  jd: nowJD(), speedIdx: 5, dir: 1, paused: false,
  scale: 'visible', mode: 'orbit', focus: 'sun',
  showOrbits: true, showLabels: true, showMarkers: false,
  flyFrame: null, flyOffset: [0, 0, 0], yaw: 0, pitch: 0, flyScale: 1, flySpeedNow: 0,
  origin: [0, 0, 0], transition: null,
};

const $ = id => document.getElementById(id);
const toThree = v => [v[0], v[2], -v[1]];          // ecliptic (x,y,z) -> three (x, z, -y), y-up
const vec = a => new THREE.Vector3(a[0], a[1], a[2]);
const isTouch = matchMedia('(pointer: coarse)').matches;

// ---------------------------------------------------------------------------------------
// Renderer / scene
// ---------------------------------------------------------------------------------------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020308);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1e-7, 1e9);
camera.position.set(0, 95, 165);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 1.1;
controls.screenSpacePanning = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.07));
const sunLight = new THREE.PointLight(0xffffff, 2.8, 0, 0);
scene.add(sunLight);

let loaded = false;
const manager = new THREE.LoadingManager(() => finishLoading());
const texLoader = new THREE.TextureLoader(manager);
const maxAniso = renderer.capabilities.getMaxAnisotropy();
function loadTex(url) {
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, maxAniso);
  return t;
}
function finishLoading() {
  if (loaded) return;
  loaded = true;
  $('loading').classList.add('done');
  setTimeout(() => $('loading').remove(), 800);
}
setTimeout(finishLoading, 8000);

// Star background: a sphere that always sits on the camera and ignores depth
const stars = new THREE.Mesh(
  new THREE.SphereGeometry(1000, 48, 24),
  new THREE.MeshBasicMaterial({ map: loadTex('textures/2k_stars_milky_way.jpg'), side: THREE.BackSide, depthTest: false, depthWrite: false, color: 0x6a6a6a })
);
stars.renderOrder = -10;
stars.frustumCulled = false;
scene.add(stars);
// Crisp point stars on top of the (soft) Milky Way map
{
  const N = 7000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < N; i++) {
    const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u);
    pos.set([q * Math.cos(t) * 900, u * 900, q * Math.sin(t) * 900], i * 3);
    const br = 0.25 + 0.75 * Math.pow(rnd(), 4), tint = rnd();
    col.set([br * (tint > 0.8 ? 1 : 0.85 + tint * 0.15), br * 0.92, br * (tint < 0.25 ? 1 : 0.8 + tint * 0.2)], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6 * Math.min(window.devicePixelRatio, 2), sizeAttenuation: false, vertexColors: true, depthTest: false, depthWrite: false }));
  pts.renderOrder = -9;
  pts.frustumCulled = false;
  stars.add(pts);
}

const helioGroup = new THREE.Group(); // holds planet orbit lines; positioned at Sun - origin
scene.add(helioGroup);

// ---------------------------------------------------------------------------------------
// Body construction
// ---------------------------------------------------------------------------------------
const R = {};           // runtime per body
const pickMeshes = [];
const sphereHi = new THREE.SphereGeometry(1, 72, 36);
const sphereLo = new THREE.SphereGeometry(1, 36, 18);
const pinMat = new THREE.MeshBasicMaterial({ color: 0xff4d7d });
const pinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
const tipGeo = new THREE.SphereGeometry(0.075, 14, 10);

function basisQuaternion(X, Y) {
  const x = vec(X).normalize(), y = vec(Y).normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  x.crossVectors(y, z).normalize(); // re-orthogonalise
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// The star map is in galactic coordinates (centre = galactic centre, south at the top,
// longitude increasing to the left), so orient it to the real sky.
stars.quaternion.copy(basisQuaternion(
  toThree(O.poleVector(266.405, -28.936)),               // galactic centre (RA, Dec)
  toThree(O.scale(O.poleVector(192.859, 27.128), -1))    // south galactic pole
));

function hashSeed(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

for (const b of BODIES) {
  const r = { b, world: [0, 0, 0] };
  r.pivot = new THREE.Group();
  r.tilt = new THREE.Group();
  r.pivot.add(r.tilt);
  scene.add(r.pivot);

  let mat;
  if (b.id === 'sun') {
    mat = new THREE.MeshBasicMaterial({ map: loadTex(b.texture), color: 0xffffff });
  } else {
    let map;
    if (b.texture) map = loadTex(b.texture);
    else {
      map = new THREE.CanvasTexture(makeProceduralTexture(b.procedural, hashSeed(b.id)));
      map.colorSpace = THREE.SRGBColorSpace;
    }
    mat = new THREE.MeshLambertMaterial({ map });
  }
  const big = b.radiusKm > 2000;
  r.mesh = new THREE.Mesh(big ? sphereHi : sphereLo, mat);
  r.mesh.userData.id = b.id;
  r.tilt.add(r.mesh);
  pickMeshes.push(r.mesh);

  // Surface marker at longitude 0 (texture centre), pointing along local +X
  r.marker = new THREE.Group();
  const pin = new THREE.Mesh(pinGeo, pinMat); pin.rotation.z = -Math.PI / 2; pin.position.x = 1.22;
  const tip = new THREE.Mesh(tipGeo, pinMat); tip.position.x = 1.47;
  r.marker.add(pin, tip);
  r.marker.visible = false;
  r.mesh.add(r.marker);

  // Spin axis line (north half bright)
  const axGeoN = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.8, 0)]);
  const axGeoS = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1.8, 0)]);
  r.axis = new THREE.Group();
  r.axis.add(new THREE.Line(axGeoN, new THREE.LineBasicMaterial({ color: 0x8fd3ff })));
  r.axis.add(new THREE.Line(axGeoS, new THREE.LineBasicMaterial({ color: 0x55607a })));
  r.axis.visible = false;
  r.tilt.add(r.axis);

  if (b.pole) {
    r.basis = O.planetBasis(b); // ecliptic
    r.tilt.quaternion.copy(basisQuaternion(toThree(r.basis.u), toThree(r.basis.n)));
  }

  if (b.rings) {
    const inner = b.rings.innerKm / b.radiusKm, outer = b.rings.outerKm / b.radiusKm;
    const g = new THREE.RingGeometry(inner, outer, 180, 1);
    const pos = g.attributes.position, uv = g.attributes.uv, v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v3.fromBufferAttribute(pos, i); uv.setXY(i, (v3.length() - inner) / (outer - inner), 0.5); }
    const ringMat = new THREE.MeshLambertMaterial({ map: loadTex(b.rings.texture), transparent: true, side: THREE.DoubleSide, depthWrite: false, emissive: 0x222222 });
    r.ring = new THREE.Mesh(g, ringMat);
    r.ring.rotation.x = -Math.PI / 2;
    r.tilt.add(r.ring);
  }

  if (b.id === 'sun') {
    const glowTex = new THREE.CanvasTexture(makeGlowCanvas());
    r.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    r.pivot.add(r.glow);
  }

  // Orbit line
  if (b.parent) {
    const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(b.color), transparent: true, opacity: b.type === 'Moon' ? 0.35 : 0.42, depthWrite: false });
    r.orbitLine = new THREE.Line(new THREE.BufferGeometry(), lineMat);
    r.orbitLine.frustumCulled = false;
    if (b.parent === 'sun') helioGroup.add(r.orbitLine);
  }

  // Label
  const el = document.createElement('div');
  el.className = 'label' + (b.type === 'Moon' ? ' moon' : '');
  el.innerHTML = `<span class="ring" style="color:${b.color}"></span><span>${b.name}</span>`;
  el.addEventListener('click', e => { e.stopPropagation(); selectBody(b.id); });
  $('labels').appendChild(el);
  r.label = el;
  r.screen = { x: 0, y: 0, visible: false };

  R[b.id] = r;
}
// Moon orbit lines ride along with their parent
for (const b of BODIES) if (b.parent && b.parent !== 'sun') R[b.parent].pivot.add(R[b.id].orbitLine);

// ---------------------------------------------------------------------------------------
// Scale model
// ---------------------------------------------------------------------------------------
function radiusScene(b) {
  const r = b.radiusKm / EARTH_R_KM;
  return S.scale === 'true' ? r : Math.max(0.12, Math.pow(r, 0.55));
}
function helioScene(pAU) {
  if (S.scale === 'true') return O.scale(pAU, AU_KM / EARTH_R_KM);
  const r = O.len(pAU);
  return r === 0 ? pAU : O.scale(pAU, VIS_D * Math.pow(r, VIS_P) / r);
}
function helioSceneInverseDist(d, scale) { // scene distance -> AU for a given scale mode
  return scale === 'true' ? d * EARTH_R_KM / AU_KM : Math.pow(d / VIS_D, 1 / VIS_P);
}
function helioSceneDist(au, scale) { return scale === 'true' ? au * AU_KM / EARTH_R_KM : VIS_D * Math.pow(au, VIS_P); }
function moonScale(b, scale = S.scale) { // km -> scene units
  if (scale === 'true') return 1 / EARTH_R_KM;
  const p = BODY_BY_ID[b.parent];
  const pr = Math.max(0.12, Math.pow(p.radiusKm / EARTH_R_KM, 0.55));
  return pr * (1.6 + 0.6 * Math.sqrt(b.moon.aKm / p.radiusKm)) / b.moon.aKm;
}
const firstMoon = {};
for (const b of BODIES) if (b.moon && !firstMoon[b.parent]) firstMoon[b.parent] = b;

let orbitsJD = { planets: -1e9, moons: -1e9, luna: -1e9, lunaReal: 0 };
function rebuildOrbits(force = false) {
  if (force || Math.abs(S.jd - orbitsJD.planets) > 3652) {
    orbitsJD.planets = S.jd;
    for (const b of BODIES) {
      if (b.parent !== 'sun') continue;
      const pts = O.planetOrbitPath(b.id, S.jd, 1440).map(p => vec(toThree(helioScene(p))));
      R[b.id].orbitLine.geometry.dispose();
      R[b.id].orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    }
  }
  const nowMs = performance.now();
  if (force || (Math.abs(S.jd - orbitsJD.luna) > 0.1 && nowMs - orbitsJD.lunaReal > 200)) {
    // The Moon's drawn path is its real path over one month centred on now
    orbitsJD.luna = S.jd; orbitsJD.lunaReal = nowMs;
    const b = BODY_BY_ID.moon, k = moonScale(b);
    const pts = O.satelliteOrbitPath(b, S.jd, null, 160).map(p => vec(toThree(O.scale(p, k))));
    R.moon.orbitLine.geometry.dispose();
    R.moon.orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  }
  if (force) {
    for (const b of BODIES) {
      if (!b.moon || b.moon.luna) continue;
      const k = moonScale(b);
      const pts = O.satelliteOrbitPath(b, S.jd, R[b.parent].basis).map(p => vec(toThree(O.scale(p, k))));
      R[b.id].orbitLine.geometry.dispose();
      R[b.id].orbitLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    }
  }
}

function applyScale() {
  for (const b of BODIES) {
    const r = R[b.id], rad = radiusScene(b);
    r.mesh.scale.setScalar(rad);
    r.axis.scale.setScalar(rad);
    if (r.ring) r.ring.scale.setScalar(rad);
    r.radius = rad;
  }
  rebuildOrbits(true);
  controls.maxDistance = S.scale === 'true' ? 5e6 : 5000;
  $('scaleVisible').classList.toggle('on', S.scale === 'visible');
  $('scaleTrue').classList.toggle('on', S.scale === 'true');
}

// ---------------------------------------------------------------------------------------
// Simulation update
// ---------------------------------------------------------------------------------------
function updateWorld() {
  const jd = S.jd;
  for (const b of BODIES) {
    const r = R[b.id];
    if (!b.parent) { r.world = [0, 0, 0]; r.helioKm = 0; }
    else if (b.parent === 'sun') {
      const p = O.planetPosition(b.id, jd);
      r.parentKm = O.len(p) * AU_KM;
      r.world = toThree(helioScene(p));
    }
  }
  for (const b of BODIES) {
    if (!b.moon) continue;
    const r = R[b.id], pr = R[b.parent];
    const sat = O.satellitePosition(b, jd, pr.basis);
    r.sat = sat;
    r.parentKm = O.len(sat.pos);
    const off = toThree(O.scale(sat.pos, moonScale(b)));
    if (b.moon.luna) {
      // The planetary elements give the Earth-Moon barycentre; put Earth and Moon either side of it
      pr.world = O.sub(pr.world, O.scale(off, 1 / EARTH_MOON_MASS_RATIO_PLUS_1));
    }
    r.world = O.add(pr.world, off);
  }
  // Rotation
  for (const b of BODIES) {
    const r = R[b.id];
    if (b.moon && b.moon.luna) {
      // IAU lunar orientation (pole + prime meridian with periodic terms => physical libration)
      const o = moonOrientation(jd);
      const n = O.poleVector(o.raDeg, o.decDeg), u = O.unit(O.nodeVector(o.raDeg));
      r.tilt.quaternion.copy(basisQuaternion(toThree(u), toThree(n)));
      r.mesh.rotation.y = o.W * DEG;
    } else if (b.locked && r.sat) {
      // Spin axis = orbit normal; mean rotation keeps longitude 0 facing the parent,
      // offset by (true - mean anomaly) so libration from the eccentric orbit shows up.
      const toParent = toThree(O.scale(r.sat.pos, -1));
      const Y = toThree(r.sat.normal);
      const X = O.sub(toParent, O.scale(Y, O.dot(toParent, Y)));
      r.tilt.quaternion.copy(basisQuaternion(X, Y));
      r.mesh.rotation.y = -(r.sat.nu - r.sat.M);
    } else {
      r.mesh.rotation.y = O.rotationAngle(b, jd) * DEG;
    }
  }
}

// ---------------------------------------------------------------------------------------
// Camera: orbit / fly / transitions (floating origin keeps precision at true scale)
// ---------------------------------------------------------------------------------------
const tmpV = new THREE.Vector3();
const camWorld = () => O.add(S.origin, camera.position.toArray());

function defaultDistance(id) {
  const rad = R[id].radius;
  if (id === 'sun') return S.scale === 'true' ? rad * 6 : rad * 5;
  return rad * 4;
}

function startTransition(id, opts = {}) {
  const tW = R[id].world;
  const cW = camWorld();
  let off = O.sub(cW, tW);
  let d0 = O.len(off);
  if (d0 < 1e-9) { off = [0, 0.3, 1]; d0 = 1e-9; }
  const dir0 = vec(O.unit(off));
  const dir1 = opts.dir ? opts.dir.clone().normalize() : dir0.clone();
  const minD = R[id].radius * 1.25;
  const d1 = Math.max(minD, opts.dist ?? (opts.keepDist ? d0 : defaultDistance(id)));
  const ratio = Math.abs(Math.log(d1 / d0));
  S.transition = {
    id, t: 0, dur: opts.dur ?? Math.min(2.6, 1.1 + ratio * 0.12),
    d0, d1, dir0, dir1, q0: camera.quaternion.clone(), then: opts.then || S.mode,
    qd: new THREE.Quaternion().setFromUnitVectors(dir0, dir1),
  };
  controls.enabled = false;
}

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lookM = new THREE.Matrix4();
const qLook = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

function stepTransition(dt) {
  const T = S.transition;
  T.t = Math.min(1, T.t + dt / T.dur);
  const a = ease(T.t);
  const q = new THREE.Quaternion().slerp(T.qd, a);
  const dir = T.dir0.clone().applyQuaternion(q);
  const d = Math.exp(Math.log(T.d0) + (Math.log(T.d1) - Math.log(T.d0)) * a);
  S.origin = R[T.id].world.slice();
  camera.position.copy(dir.multiplyScalar(d));
  lookM.lookAt(camera.position, tmpV.set(0, 0, 0), UP);
  qLook.setFromRotationMatrix(lookM);
  camera.quaternion.copy(T.q0).slerp(qLook, Math.min(1, a * 1.6));
  if (T.t >= 1) {
    S.transition = null;
    S.focus = T.id;
    if (T.then === 'fly') {
      S.flyFrame = $('togFlyFrame').checked ? T.id : null;
      const base = S.flyFrame ? R[S.flyFrame].world : [0, 0, 0];
      S.flyOffset = O.sub(O.add(S.origin, camera.position.toArray()), base);
      syncYawPitch();
      setMode('fly', true);
    } else {
      controls.target.set(0, 0, 0);
      controls.minDistance = R[T.id].radius * 1.15;
      controls.enabled = true;
      controls.update();
      setMode('orbit', true);
    }
    updateInfo(true);
  }
}

function syncYawPitch() {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  S.yaw = e.y; S.pitch = e.x;
}

const keys = new Set();
const padKeys = new Set();
let padBoost = false;

function nearestBody(p) {
  let best = null, bd = Infinity;
  for (const b of BODIES) {
    const r = R[b.id];
    const d = O.len(O.sub(p, r.world)) - r.radius;
    if (d < bd) { bd = d; best = b.id; }
  }
  return { id: best, dist: bd };
}

function stepFly(dt) {
  const base = S.flyFrame ? R[S.flyFrame].world : [0, 0, 0];
  let cW = O.add(base, S.flyOffset);
  const near = nearestBody(cW);
  const rNear = R[near.id].radius;
  let f = 0, s = 0, u = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp') || padKeys.has('fwd')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown') || padKeys.has('back')) f -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight') || padKeys.has('right')) s += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft') || padKeys.has('left')) s -= 1;
  if (keys.has('KeyE') || padKeys.has('up')) u += 1;
  if (keys.has('KeyQ') || padKeys.has('down')) u -= 1;
  let mod = 1;
  if (keys.has('ShiftLeft') || keys.has('ShiftRight') || padBoost) mod *= 10;
  if (keys.has('AltLeft') || keys.has('AltRight') || keys.has('ControlLeft')) mod *= 0.1;
  const speed = Math.max(near.dist, rNear * 0.02) * 0.9 * S.flyScale * mod;
  S.flySpeedNow = (f || s || u) ? speed : 0;
  camera.quaternion.setFromEuler(new THREE.Euler(S.pitch, S.yaw, 0, 'YXZ'));
  if (f || s || u) {
    const mv = new THREE.Vector3(s, u, -f).normalize().applyQuaternion(camera.quaternion).multiplyScalar(speed * dt);
    cW = O.add(cW, mv.toArray());
  }
  // Don't fly into bodies
  const n2 = nearestBody(cW);
  const rr = R[n2.id];
  if (n2.dist < rr.radius * 0.03) {
    const out = O.unit(O.sub(cW, rr.world));
    cW = O.add(rr.world, O.scale(out, rr.radius * 1.03));
  }
  S.flyOffset = O.sub(cW, base);
  S.origin = cW;
  camera.position.set(0, 0, 0);
}

function setMode(mode, silent = false) {
  if (!silent && mode === S.mode && !S.transition) return;
  if (!silent) {
    if (mode === 'fly') {
      S.transition = null;
      const cW = camWorld();
      S.flyFrame = $('togFlyFrame').checked ? S.focus : null;
      const base = S.flyFrame ? R[S.flyFrame].world : [0, 0, 0];
      S.flyOffset = O.sub(cW, base);
      syncYawPitch();
      S.mode = 'fly';
    } else {
      const cW = camWorld();
      const id = S.flyFrame || nearestBody(cW).id;
      S.mode = 'orbit';
      startTransition(id, { keepDist: true, then: 'orbit', dur: 0.9 });
      const d = O.len(O.sub(cW, R[id].world));
      S.transition.d1 = Math.min(Math.max(d, R[id].radius * 1.3), defaultDistance(id) * 3);
    }
  }
  S.mode = mode;
  controls.enabled = mode === 'orbit' && !S.transition;
  $('modeOrbit').classList.toggle('on', mode === 'orbit');
  $('modeFly').classList.toggle('on', mode === 'fly');
  $('flyHud').hidden = mode !== 'fly';
  $('flyPad').hidden = !(mode === 'fly' && isTouch);
  updateFlyFrameLabel();
}

function updateFlyFrameLabel() {
  const id = S.flyFrame || S.focus;
  $('flyFrameLabel').textContent = `Move with ${BODY_BY_ID[id].name}`;
}

// ---------------------------------------------------------------------------------------
// Selection & info panel
// ---------------------------------------------------------------------------------------
function selectBody(id, opts = {}) {
  S.focus = id;
  startTransition(id, { then: S.mode, ...opts });
  for (const b of BODIES) R[b.id].label.classList.toggle('sel', b.id === id);
  document.querySelectorAll('#bodyList button').forEach(btn => btn.classList.toggle('sel', btn.dataset.id === id));
  for (const b of BODIES) if (R[b.id].orbitLine) R[b.id].orbitLine.material.opacity = b.id === id ? 0.9 : (b.type === 'Moon' ? 0.35 : 0.42);
  updateInfo(true);
}

function updateInfo(full = false) {
  const b = BODY_BY_ID[S.focus], r = R[b.id];
  if (full) {
    const parent = b.parent ? BODY_BY_ID[b.parent] : null;
    $('infoType').textContent = b.type === 'Moon' ? `Moon of ${parent.name}` : b.type;
    $('infoName').textContent = b.name;
    const sid = O.siderealDays(b), sol = O.solarDays(b), year = O.yearDays(b);
    const retro = sid < 0 ? '<span class="tag">retrograde</span>' : '';
    const rows = [];
    rows.push(['Radius', `${fmtNum(b.radiusKm, b.radiusKm < 100 ? 1 : 0)} km<small>${fmtNum(b.radiusKm / EARTH_R_KM, b.radiusKm < 100 ? 4 : 3)} × Earth</small>`]);
    rows.push(['Sidereal day<br><small>one full spin</small>', `${fmtDuration(Math.abs(sid))}<small>${retro}${fmtDurationSub(Math.abs(sid))}</small>`]);
    if (sol != null) rows.push(['Solar day<br><small>noon to noon</small>', `${fmtDuration(Math.abs(sol))}<small>${fmtDurationSub(Math.abs(sol))}</small>`, true]);
    if (b.type === 'Moon') {
      rows.push([`Orbit around ${parent.name}`, `${fmtDuration(b.orbitDays)}<small>${b.retrograde ? 'retrograde orbit · ' : ''}${b.locked ? 'tidally locked' : ''}</small>`]);
      rows.push([`Year<br><small>with ${parent.name}</small>`, `${fmtDuration(year)}<small>${fmtDurationSub(year)}</small>`]);
    } else if (year) {
      rows.push(['Year<br><small>one orbit of the Sun</small>', `${fmtDuration(year)}<small>${fmtDurationSub(year)}</small>`]);
    }
    if (sol != null && isFinite(sol)) rows.push(['Solar days per year', fmtNum(year / Math.abs(sol), year / Math.abs(sol) < 10 ? 2 : 1)]);
    rows.push(['Axial tilt', `${fmtNum(b.tiltDeg, b.tiltDeg < 1 ? 2 : 1)}°<small>${b.id === 'sun' ? 'to the ecliptic' : b.type === 'Moon' ? 'to its orbit' : 'to its orbit'}</small>`]);
    if (parent) rows.push([`Distance from ${parent.name}`, `<span id="liveDist">—</span><small id="liveDistSub"></small>`]);
    $('infoStats').innerHTML = rows.map(([k, v, hl]) => `<dt${hl ? ' class="hl"' : ''}>${k}</dt><dd${hl ? ' class="hl"' : ''}>${v}</dd>`).join('');
    $('infoFact').textContent = b.fact;
    updateFlyFrameLabel();
  }
  const ld = $('liveDist');
  if (ld && r.parentKm != null) {
    ld.textContent = fmtDistanceKm(r.parentKm);
    const sub = $('liveDistSub');
    if (b.type === 'Moon') sub.textContent = `${fmtNum(r.parentKm / BODY_BY_ID[b.parent].radiusKm, 1)} × ${BODY_BY_ID[b.parent].name}'s radius`;
    else sub.textContent = `${fmtNum(r.parentKm / 1e6, 1)} million km · light ${fmtLight(r.parentKm)}`;
  }
}
function fmtLight(km) {
  const s = km / 299792.458;
  if (s < 120) return `${fmtNum(s, 1)} s`;
  if (s < 7200) return `${fmtNum(s / 60, 1)} min`;
  return `${fmtNum(s / 3600, 2)} h`;
}

// ---------------------------------------------------------------------------------------
// Scale switching
// ---------------------------------------------------------------------------------------
function convertDistance(id, d, from, to) {
  const b = BODY_BY_ID[id];
  const rFrom = from === 'true' ? b.radiusKm / EARTH_R_KM : Math.max(0.12, Math.pow(b.radiusKm / EARTH_R_KM, 0.55));
  const rTo = to === 'true' ? b.radiusKm / EARTH_R_KM : Math.max(0.12, Math.pow(b.radiusKm / EARTH_R_KM, 0.55));
  if (d < rFrom * 3) return d / rFrom * rTo;
  if (id === 'sun') return helioSceneDist(helioSceneInverseDist(d, from), to);
  const m = firstMoon[id];
  if (m) return d * moonScale(m, to) / moonScale(m, from);
  return d / rFrom * rTo;
}

function setScale(mode) {
  if (mode === S.scale) return;
  const from = S.scale;
  if (S.transition) { S.focus = S.transition.id; S.transition = null; controls.enabled = S.mode === 'orbit'; controls.target.set(0, 0, 0); }
  if (S.mode === 'orbit') {
    const d = camera.position.distanceTo(controls.target);
    const d2 = convertDistance(S.focus, d, from, mode);
    S.scale = mode;
    applyScale();
    updateWorld();
    const off = camera.position.clone().sub(controls.target).setLength(d2);
    controls.target.multiplyScalar(d2 / Math.max(d, 1e-12));
    camera.position.copy(controls.target).add(off);
    controls.minDistance = R[S.focus].radius * 1.15;
    S.origin = R[S.focus].world.slice();
  } else {
    let id = S.flyFrame;
    if (!id) { id = nearestBody(camWorld()).id; }
    const base = R[id].world;
    const off = O.sub(camWorld(), base);
    const d = O.len(off);
    const d2 = convertDistance(id, d, from, mode);
    S.scale = mode;
    applyScale();
    updateWorld();
    S.flyFrame = id;
    $('togFlyFrame').checked = true;
    S.flyOffset = O.scale(off, d2 / Math.max(d, 1e-12));
  }
  toast(mode === 'true' ? 'True scale: real sizes and distances. Space is mostly empty; use labels to find things.' : 'Visible scale: sizes enlarged, distances compressed.');
}

// ---------------------------------------------------------------------------------------
// Time controls
// ---------------------------------------------------------------------------------------
function setSpeed(idx) {
  S.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, idx));
  updateSpeedUI();
}
function updateSpeedUI() {
  $('speedSlider').value = S.speedIdx;
  const sp = SPEEDS[S.speedIdx];
  $('speedLabel').innerHTML = (S.paused ? 'Paused · ' : '') + (S.dir < 0 ? '<span class="rev">◀ reverse · </span>' : '') + sp.label;
  $('controls').classList.toggle('paused', S.paused);
  $('btnReverse').classList.toggle('on', S.dir < 0);
}
function setDate(jd) {
  S.jd = Math.max(JD_MIN, Math.min(JD_MAX, jd));
  rebuildOrbits(true);
  lastPickerUpdate = 0;
}

let lastPickerUpdate = 0;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function updateClock(now) {
  const d = jdToDate(S.jd);
  const p2 = n => String(n).padStart(2, '0');
  $('clockDate').textContent = `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  $('clockTime').textContent = `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
  const y = d.getUTCFullYear();
  $('rangeWarn').hidden = y >= 1800 && y < 2050;
  if (now - lastPickerUpdate > 100 && document.activeElement !== $('datePicker')) {
    lastPickerUpdate = now;
    $('datePicker').value = `${String(y).padStart(4, '0')}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
  }
}

// ---------------------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------------------
const projV = new THREE.Vector3();
function updateLabels() {
  const w = window.innerWidth, h = window.innerHeight;
  const tanHalf = Math.tan(camera.fov * DEG / 2);
  camera.updateMatrixWorld();
  for (const b of BODIES) {
    const r = R[b.id];
    projV.copy(r.pivot.position).applyMatrix4(camera.matrixWorldInverse);
    const depth = -projV.z;
    if (depth <= 0) { r.screen.visible = false; continue; }
    projV.copy(r.pivot.position).project(camera);
    r.screen.x = (projV.x * 0.5 + 0.5) * w;
    r.screen.y = (-projV.y * 0.5 + 0.5) * h;
    r.screen.rpx = r.radius / (depth * tanHalf) * (h / 2);
    r.screen.depth = depth;
    r.screen.visible = r.screen.x > -50 && r.screen.x < w + 50 && r.screen.y > -50 && r.screen.y < h + 50;
  }
  for (const b of BODIES) {
    const r = R[b.id], el = r.label;
    let show = S.showLabels && r.screen.visible && r.screen.rpx < h * 0.3;
    if (show && b.parent && b.parent !== 'sun' && b.id !== S.focus) {
      const p = R[b.parent].screen;
      if (!p.visible || Math.hypot(p.x - r.screen.x, p.y - r.screen.y) < Math.max(22, p.rpx * 1.3)) show = false;
    }
    if (show && b.id !== S.focus && b.parent === 'sun' && b.id !== 'sun') {
      // Hide planet labels that collapse onto the Sun at great distance
      const s = R.sun.screen;
      if (s.visible && Math.hypot(s.x - r.screen.x, s.y - r.screen.y) < 10 && r.screen.depth > R.sun.screen.depth) show = false;
    }
    el.classList.toggle('hidden', !show);
    if (show) {
      const off = Math.min(Math.max(6, r.screen.rpx + 6), 400);
      el.style.transform = `translate3d(${(r.screen.x + off - 4).toFixed(1)}px, ${(r.screen.y - 10).toFixed(1)}px, 0)`;
    }
  }
}

// ---------------------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
let ptr = null;
canvas.addEventListener('pointerdown', e => {
  if (ptr && ptr.id !== e.pointerId) { ptr.multi = true; return; }
  ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), moved: 0, multi: false };
  if (S.mode === 'fly') canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!ptr || ptr.id !== e.pointerId) return;
  const dx = e.clientX - ptr.lx, dy = e.clientY - ptr.ly;
  ptr.lx = e.clientX; ptr.ly = e.clientY;
  ptr.moved += Math.abs(dx) + Math.abs(dy);
  if (S.mode === 'fly' && !S.transition && !ptr.multi) {
    const k = 0.0032 * (camera.fov / 50);
    S.yaw -= dx * k;
    S.pitch = Math.max(-1.55, Math.min(1.55, S.pitch - dy * k));
  }
});
const endPtr = e => {
  if (!ptr || ptr.id !== e.pointerId) return;
  if (ptr.moved < 6 && !ptr.multi && performance.now() - ptr.t < 600 && e.type === 'pointerup') pick(e.clientX, e.clientY);
  ptr = null;
};
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);

canvas.addEventListener('wheel', e => {
  if (S.mode !== 'fly') return;
  e.preventDefault();
  S.flyScale = Math.max(0.01, Math.min(100, S.flyScale * Math.pow(1.2, -Math.sign(e.deltaY))));
  toast(`Fly speed ×${fmtNum(S.flyScale, S.flyScale < 1 ? 2 : 1)}`);
}, { passive: false });

function pick(x, y) {
  const ndc = new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(pickMeshes, false);
  let id = hits.length ? hits[0].object.userData.id : null;
  if (!id) {
    let bd = 24;
    for (const b of BODIES) {
      const s = R[b.id].screen;
      if (!s.visible || R[b.id].label.classList.contains('hidden') && b.type === 'Moon') continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; id = b.id; }
    }
  }
  if (id) selectBody(id);
}

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (e.metaKey || e.ctrlKey) return;
  keys.add(e.code);
  const k = e.key.toLowerCase();
  if (S.mode === 'fly' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { e.preventDefault(); return; }
  if (e.code === 'Space') { e.preventDefault(); S.paused = !S.paused; updateSpeedUI(); }
  else if (k === ',' || k === '<') setSpeed(S.speedIdx - 1);
  else if (k === '.' || k === '>') setSpeed(S.speedIdx + 1);
  else if (k === 'r') { S.dir *= -1; updateSpeedUI(); }
  else if (k === 'n') setDate(nowJD());
  else if (k === 'f') setMode(S.mode === 'orbit' ? 'fly' : 'orbit');
  else if (k === 't') setScale(S.scale === 'visible' ? 'true' : 'visible');
  else if (k === 'o') { $('togOrbits').checked = !$('togOrbits').checked; $('togOrbits').dispatchEvent(new Event('change')); }
  else if (k === 'l') { $('togLabels').checked = !$('togLabels').checked; $('togLabels').dispatchEvent(new Event('change')); }
  else if (k === 'm') { $('togMarkers').checked = !$('togMarkers').checked; $('togMarkers').dispatchEvent(new Event('change')); }
  else if (k === 'h' || k === '?') $('help').hidden = !$('help').hidden;
  else if (k === 'escape') { $('help').hidden = true; $('questions').hidden = true; $('answer').hidden = true; }
  else if (/^[0-9]$/.test(k)) selectBody(KEY_BODIES[+k]);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// Touch fly pad
document.querySelectorAll('#flyPad [data-k]').forEach(btn => {
  const k = btn.dataset.k;
  const on = e => { e.preventDefault(); padKeys.add(k); btn.classList.add('active'); };
  const off = e => { e.preventDefault(); padKeys.delete(k); btn.classList.remove('active'); };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('pointercancel', off);
});
$('padBoost').addEventListener('click', () => { padBoost = !padBoost; $('padBoost').classList.toggle('active', padBoost); });

// ---------------------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------------------
function buildBodyList() {
  const ul = $('bodyList');
  for (const b of BODIES) {
    const li = document.createElement('li');
    if (b.type === 'Moon') li.className = 'moon';
    const ki = KEY_BODIES.indexOf(b.id);
    li.innerHTML = `<button data-id="${b.id}"><span class="dot" style="background:${b.color}"></span>${b.name}${ki >= 0 ? `<span class="key">${ki}</span>` : ''}</button>`;
    li.querySelector('button').addEventListener('click', () => {
      selectBody(b.id);
      if (window.innerWidth < 760) $('bodies').classList.add('collapsed');
    });
    ul.appendChild(li);
  }
}
buildBodyList();

$('bodiesToggle').addEventListener('click', () => {
  const c = $('bodies').classList.toggle('collapsed');
  $('bodiesToggle').setAttribute('aria-expanded', String(!c));
});
$('infoCollapse').addEventListener('click', () => {
  const c = $('info').classList.toggle('collapsed');
  $('infoCollapse').textContent = c ? '+' : '–';
});
if (window.innerWidth < 760) {
  $('bodies').classList.add('collapsed');
  $('info').classList.add('collapsed');
  $('infoCollapse').textContent = '+';
}

$('btnPlay').addEventListener('click', () => { S.paused = !S.paused; updateSpeedUI(); });
$('btnReverse').addEventListener('click', () => { S.dir *= -1; updateSpeedUI(); });
$('btnSlower').addEventListener('click', () => setSpeed(S.speedIdx - 1));
$('btnFaster').addEventListener('click', () => setSpeed(S.speedIdx + 1));
$('speedSlider').addEventListener('input', e => setSpeed(+e.target.value));
$('btnNow').addEventListener('click', () => { setDate(nowJD()); toast('Jumped to now'); });
$('datePicker').addEventListener('change', e => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(e.target.value);
  if (!m) return;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  if (isFinite(ms)) setDate(ms / 86400000 + 2440587.5);
});
$('modeOrbit').addEventListener('click', () => setMode('orbit'));
$('modeFly').addEventListener('click', () => setMode('fly'));
$('scaleVisible').addEventListener('click', () => setScale('visible'));
$('scaleTrue').addEventListener('click', () => setScale('true'));
$('togOrbits').addEventListener('change', e => { S.showOrbits = e.target.checked; for (const b of BODIES) if (R[b.id].orbitLine) R[b.id].orbitLine.visible = S.showOrbits; });
$('togLabels').addEventListener('change', e => { S.showLabels = e.target.checked; });
$('togMarkers').addEventListener('change', e => setMarkers(e.target.checked));
function setMarkers(on) {
  S.showMarkers = on;
  $('togMarkers').checked = on;
  for (const b of BODIES) { R[b.id].marker.visible = on; R[b.id].axis.visible = on; }
}
$('togFlyFrame').addEventListener('change', e => {
  const cW = camWorld();
  S.flyFrame = e.target.checked ? nearestBody(cW).id : null;
  if (S.flyFrame) S.focus = S.flyFrame;
  const base = S.flyFrame ? R[S.flyFrame].world : [0, 0, 0];
  S.flyOffset = O.sub(cW, base);
  updateFlyFrameLabel();
});
$('btnFlyHere').addEventListener('click', () => { setMode('fly'); toast('Fly mode: WASD / QE to move, drag to look, Shift for ×10'); });
$('btnHelp').addEventListener('click', () => { $('help').hidden = false; });
$('btnQuestions').addEventListener('click', () => { $('questions').hidden = !$('questions').hidden; });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { $(b.dataset.close).hidden = true; }));
$('help').addEventListener('click', e => { if (e.target.id === 'help') $('help').hidden = true; });

// Questions
QUESTIONS.forEach((q, i) => {
  const li = document.createElement('li');
  li.innerHTML = `<button><span class="qi">Q${i + 1}</span><span>${q.q}</span></button>`;
  li.querySelector('button').addEventListener('click', () => askQuestion(q));
  $('questionList').appendChild(li);
});

function askQuestion(q) {
  $('questions').hidden = true;
  if (S.scale !== 'visible') setScale('visible');
  if (S.mode !== 'orbit') { S.mode = 'orbit'; setMode('orbit', true); }
  S.paused = false; S.dir = 1; setSpeed(q.speed);
  setMarkers(!!q.markers);
  if (!S.showOrbits) { $('togOrbits').checked = true; $('togOrbits').dispatchEvent(new Event('change')); }
  updateWorld();
  const w = R[q.body].world;
  const sunDir = vec(O.unit(O.scale(w, -1)));
  const side = new THREE.Vector3().crossVectors(sunDir, UP).normalize();
  let dir;
  if (q.view.dir === 'above') dir = UP.clone().add(sunDir.clone().multiplyScalar(0.35));
  else if (q.view.dir === 'side') dir = side.clone().add(sunDir.clone().multiplyScalar(0.35)).add(UP.clone().multiplyScalar(0.25));
  else dir = sunDir.clone().multiplyScalar(0.8).add(side.clone().multiplyScalar(0.5)).add(UP.clone().multiplyScalar(0.3));
  let dist;
  if (q.view.distMoonOrbit) { const m = firstMoon[q.body]; dist = m.moon.aKm * moonScale(m) * q.view.distMoonOrbit; }
  else dist = R[q.body].radius * q.view.distR;
  selectBody(q.body, { dir, dist, then: 'orbit' });
  $('answerQ').textContent = q.q;
  $('answerBody').innerHTML = q.answer();
  $('answer').hidden = false;
  $('bodies').classList.add('collapsed');
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------------------
applyScale();
updateWorld();
S.origin = R.sun.world.slice();
controls.target.set(0, 0, 0);
controls.minDistance = R.sun.radius * 1.15;
controls.update();
selectBody('sun', { dur: 0.01, dist: camera.position.length() });
updateSpeedUI();

let last = performance.now(), lastInfo = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;

  if (!S.paused) {
    S.jd += S.dir * SPEEDS[S.speedIdx].s * dt / 86400;
    if (S.jd < JD_MIN || S.jd > JD_MAX) {
      S.jd = Math.max(JD_MIN, Math.min(JD_MAX, S.jd));
      S.paused = true; updateSpeedUI();
      toast('Reached the edge of the supported date range (1600 to 2400)');
    }
  }
  rebuildOrbits();
  updateWorld();

  if (S.transition) stepTransition(dt);
  else if (S.mode === 'fly') stepFly(dt);
  else {
    S.origin = R[S.focus].world.slice();
    controls.update();
  }

  // Floating origin: place everything relative to the origin
  for (const b of BODIES) {
    const r = R[b.id];
    r.pivot.position.set(r.world[0] - S.origin[0], r.world[1] - S.origin[1], r.world[2] - S.origin[2]);
  }
  helioGroup.position.set(-S.origin[0], -S.origin[1], -S.origin[2]);
  sunLight.position.copy(R.sun.pivot.position);
  stars.position.copy(camera.position);
  // Sun glow: at least a small apparent size so the Sun is always findable
  const sunDist = camera.position.distanceTo(R.sun.pivot.position);
  R.sun.glow.scale.setScalar(Math.max(R.sun.radius * 7, sunDist * 0.035));

  renderer.render(scene, camera);
  updateLabels();
  if (now - lastInfo > 150) {
    lastInfo = now;
    updateClock(now);
    updateInfo(false);
    if (S.mode === 'fly') {
      const v = S.flySpeedNow;
      $('flySpeed').textContent = v === 0 ? 'Fly speed: idle' : S.scale === 'true'
        ? `Fly speed: ${fmtSpeed(v * EARTH_R_KM)}`
        : `Fly speed: ${fmtNum(v, v < 10 ? 2 : 0)} units/s`;
    }
  }
  requestAnimationFrame(frame);
}
function fmtSpeed(kms) {
  const c = kms / 299792.458;
  if (c >= 0.5) return `${fmtNum(c, c < 10 ? 2 : 0)} c`;
  if (kms >= 1000) return `${fmtNum(kms / 1000, 1)}k km/s`;
  return `${fmtNum(kms, kms < 10 ? 2 : 0)} km/s`;
}
requestAnimationFrame(frame);

// Expose a small hook for automated checks
window.__orrery = { S, R, O, SPEEDS, selectBody, setScale, setMode, setSpeed, setDate, camWorld, askQuestion, QUESTIONS };
