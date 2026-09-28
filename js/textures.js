// Procedural equirectangular textures for bodies without a bundled image map,
// plus the Sun's glow sprite. Everything is generated on a <canvas> at load time.

// Deterministic 3D value noise
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256).map(() => rnd());
  const fade = t => t * t * (3 - 2 * t);
  const h = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf),
      zf);
  };
}

function fbm(noise, x, y, z, oct = 5) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * noise(x * f, y * f, z * f); norm += a; a *= 0.5; f *= 2.03; }
  return sum / norm;
}

const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = x => Math.max(0, Math.min(1, x));

const STYLES = {
  rocky:    { base: '#6f6358', alt: '#9a8b7c', freq: 4, craters: 60, craterDark: 0.35 },
  io:       { base: '#e2cf5a', alt: '#c9892e', freq: 3, spots: ['#2b1d12', '#f4efd0', '#b8421e'], spotCount: 70 },
  europa:   { base: '#e3d8c3', alt: '#c9b79a', freq: 3, lines: '#8a5a3a', lineCount: 55 },
  ganymede: { base: '#7c7266', alt: '#b3aa9c', freq: 2.5, craters: 40, craterDark: -0.25 },
  callisto: { base: '#4a4239', alt: '#6a5f53', freq: 4, craters: 160, craterDark: -0.6 },
  titan:    { base: '#c98a3a', alt: '#e2ad5c', freq: 1.5, bands: true },
  triton:   { base: '#d2bfb3', alt: '#a8948a', freq: 6, cap: '#efe6dc' },
  pluto:    { base: '#b8946f', alt: '#7a5a44', freq: 3, heart: '#f2e7d6' },
};

export function makeProceduralTexture(style, seed = 7, W = 512, H = 256) {
  const st = STYLES[style] || STYLES.rocky;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const noise = makeNoise(seed);
  const base = hex(st.base), alt = hex(st.alt);
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * 2 * Math.PI;
      const px = cl * Math.cos(lon), py = cl * Math.sin(lon), pz = sl;
      let n = fbm(noise, px * st.freq + 10, py * st.freq + 10, pz * st.freq + 10);
      if (st.bands) n = 0.55 * n + 0.45 * (0.5 + 0.5 * Math.sin(lat * 7 + n * 3));
      let c = mix(base, alt, clamp01((n - 0.3) * 2.2));
      if (st.cap && Math.abs(lat) > 0.9) c = mix(c, hex(st.cap), clamp01((Math.abs(lat) - 0.9) * 3));
      const i = (y * W + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Deterministic decorations
  let s = seed * 9973;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const wrapDraw = (x, w, fn) => { fn(x); if (x - w < 0) fn(x + W); if (x + w > W) fn(x - W); };
  if (st.craters) {
    for (let k = 0; k < st.craters; k++) {
      const x = rnd() * W, y = H * (0.1 + 0.8 * rnd()), r = 2 + Math.pow(rnd(), 3) * 16;
      const rx = r / Math.max(0.25, Math.cos((0.5 - y / H) * Math.PI));
      wrapDraw(x, rx, cx => {
        ctx.beginPath(); ctx.ellipse(cx, y, rx, r, 0, 0, Math.PI * 2);
        ctx.fillStyle = st.craterDark > 0 ? `rgba(0,0,0,${st.craterDark * (0.5 + rnd() * 0.5)})` : `rgba(255,255,255,${-st.craterDark * (0.3 + rnd() * 0.5)})`;
        ctx.fill();
      });
    }
  }
  if (st.spots) {
    for (let k = 0; k < st.spotCount; k++) {
      const x = rnd() * W, y = H * (0.08 + 0.84 * rnd()), r = 1.5 + rnd() * 7;
      const col = st.spots[Math.floor(rnd() * st.spots.length)];
      wrapDraw(x, r * 2, cx => {
        const g = ctx.createRadialGradient(cx, y, 0, cx, y, r * 2);
        g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, y, r * 2, 0, Math.PI * 2); ctx.fill();
      });
    }
  }
  if (st.lines) {
    ctx.strokeStyle = st.lines; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.2;
    for (let k = 0; k < st.lineCount; k++) {
      let x = rnd() * W, y = rnd() * H; const a = rnd() * Math.PI;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 8; j++) { x += Math.cos(a + (rnd() - 0.5) * 0.6) * 18; y += Math.sin(a + (rnd() - 0.5) * 0.6) * 9; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (st.heart) {
    // Tombaugh Regio sits near longitude 180 (texture edge), just north of the equator
    const drawHeart = (cx, cy, sz) => {
      ctx.fillStyle = st.heart; ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(cx, cy + sz * 0.9);
      ctx.bezierCurveTo(cx - sz * 1.6, cy - sz * 0.1, cx - sz * 0.8, cy - sz * 1.1, cx, cy - sz * 0.45);
      ctx.bezierCurveTo(cx + sz * 0.8, cy - sz * 1.1, cx + sz * 1.6, cy - sz * 0.1, cx, cy + sz * 0.9);
      ctx.fill(); ctx.globalAlpha = 1;
    };
    drawHeart(0, H * 0.42, 34); drawHeart(W, H * 0.42, 34);
  }
  return cv;
}

export function makeGlowCanvas(inner = 'rgba(255,236,190,1)', outer = 'rgba(255,170,60,0)') {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.12, 'rgba(255,220,150,0.85)');
  g.addColorStop(0.3, 'rgba(255,180,80,0.25)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return cv;
}
