// Monopoly buildings — procedural Three.js assets
// Units: 1 unit ≈ one house width. Ground at y = 0, front faces +Z.
// Usage:
//   const h = createBuilding('brown', 'house', { seed: 3 });  scene.add(h);
//   applyPalette(h, 'set' | 'classic');   setLights(true|false);   h.userData.tick?.(timeSeconds)
//   disposeBuilding(h) when removing.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Detail mode. false = full showcase detail (viewer). true while buildGameAssets() runs:
// plain boxes for small parts, fewer radial segments, static pose.
let GAME = false;
const lod = (n, min) => (GAME ? Math.max(min, Math.ceil(n / 2)) : n);
const sph = (r, w = 32, h = 16) => new THREE.SphereGeometry(r, lod(w, 6), lod(h, 4));
const cyl = (rt, rbot, h, seg = 32) => new THREE.CylinderGeometry(rt, rbot, h, lod(seg, 6));
const cone = (r, h, seg = 32) => new THREE.ConeGeometry(r, h, lod(seg, 6));
const torus = (r, t, rs = 12, ts = 48, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, lod(rs, 4), lod(ts, 8), arc);
const circle = (r, seg = 32, a0 = 0, len = Math.PI * 2) => new THREE.CircleGeometry(r, lod(seg, 8), a0, len);
const lathe = (pts, seg = 12) => new THREE.LatheGeometry(pts, lod(seg, 8));

// ───────────────────────── utils ─────────────────────────
function rng(seed) {
  let s = (Math.imul((seed | 0) || 1, 2654435761) >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
const geoCache = new Map();
function rb(w, h, d, r = 0.012) {
  r = Math.min(r, w * 0.49, h * 0.49, d * 0.49);
  const plain = GAME && Math.min(w, h, d) < 0.06;
  const k = [w, h, d, r].map(v => v.toFixed(4)).join('|') + (GAME ? (plain ? '|box' : '|g') : '');
  let g = geoCache.get(k);
  if (!g) {
    g = plain ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, GAME ? 1 : 2, r);
    g.userData.cached = true; geoCache.set(k, g);
  }
  return g;
}
function M(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m;
}
function shade(hex, k) { return new THREE.Color(hex).multiplyScalar(k).getHex(); }
function css(hex) { return '#' + hex.toString(16).padStart(6, '0'); }

// ───────────────────── procedural textures ─────────────────────
const texCache = new Map();
function canvasTex(key, w, h, draw, { color = false, wrap = true } = {}) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8; t.userData.key = key;
  texCache.set(key, t); return t;
}
// "slab" textures are transposed: rows stack along U, which is the slope direction on a roof slab.
// "F" (frustum/cone) textures are not: rows stack along V, the slope direction on cones and frustums.
function drawShingles(g, w, h, lo, hi, gap, transpose = true) {
  const r = rng(11);
  g.fillStyle = `rgb(${gap},${gap},${gap})`; g.fillRect(0, 0, w, h);
  if (transpose) g.setTransform(0, 1, -1, 0, w, 0);
  const rows = 8, rh = w / rows;
  for (let i = 0; i < rows; i++) {
    let x = -(i % 2) * 14 - r() * 10;
    while (x < h) {
      const sw = 20 + r() * 22, v = lo + r() * (hi - lo);
      const gr = g.createLinearGradient(0, i * rh, 0, (i + 1) * rh);
      const a = v * 0.55 | 0, b = v | 0;
      gr.addColorStop(0, `rgb(${a},${a},${a})`); gr.addColorStop(0.35, `rgb(${b},${b},${b})`); gr.addColorStop(1, `rgb(${b},${b},${b})`);
      g.fillStyle = gr; g.fillRect(x + 1.5, i * rh + 1, sw - 3, rh - 2.5); x += sw;
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
function drawLines(g, w, h, n, vertical) {
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const p = (i + 0.5) * (vertical ? w : h) / n;
    if (vertical) { g.fillStyle = '#e8e8e8'; g.fillRect(p - 2, 0, 3, h); g.fillStyle = '#404040'; g.fillRect(p + 1, 0, 2, h); }
    else { g.fillStyle = '#e8e8e8'; g.fillRect(0, p - 2, w, 3); g.fillStyle = '#404040'; g.fillRect(0, p + 1, w, 2); }
  }
}
function drawPlanks(g, w, h, n, vertical) {
  const r = rng(5);
  g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const v = 120 + r() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`;
    if (vertical) g.fillRect(r() * w, r() * h, 1, 6 + r() * 20); else g.fillRect(r() * w, r() * h, 6 + r() * 20, 1);
  }
  g.fillStyle = '#2a2a2a';
  for (let i = 0; i < n; i++) { const p = i * (vertical ? w : h) / n; if (vertical) g.fillRect(p, 0, 2, h); else g.fillRect(0, p, w, 2); }
}
const T = {
  stucco: () => canvasTex('stucco', 256, 256, (g, w, h) => {
    const r = rng(3); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = 90 + r() * 90 | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`; const s = 1 + r() * 3; g.fillRect(r() * w, r() * h, s, s); }
  }),
  clapboard: () => canvasTex('clap', 64, 256, (g, w, h) => {
    const n = 8, bh = h / n;
    for (let i = 0; i < n; i++) {
      const gr = g.createLinearGradient(0, i * bh, 0, (i + 1) * bh);
      gr.addColorStop(0, '#303030'); gr.addColorStop(0.1, '#909090'); gr.addColorStop(1, '#d8d8d8');
      g.fillStyle = gr; g.fillRect(0, i * bh, w, bh);
    }
  }),
  shingles: () => canvasTex('shingB', 256, 256, (g, w, h) => drawShingles(g, w, h, 150, 230, 20)),
  shinglesC: () => canvasTex('shingC', 256, 256, (g, w, h) => drawShingles(g, w, h, 200, 255, 90), { color: true }),
  seams: () => canvasTex('seamsH', 64, 256, (g, w, h) => drawLines(g, w, h, 8, false)),
  seamsV: () => canvasTex('seamsV', 256, 64, (g, w, h) => drawLines(g, w, h, 8, true)),
  planksV: () => canvasTex('planksV', 128, 128, (g, w, h) => drawPlanks(g, w, h, 4, true)),
  planksH: () => canvasTex('planksH', 128, 128, (g, w, h) => drawPlanks(g, w, h, 6, false)),
  bricks: () => canvasTex('bricks', 256, 256, (g, w, h) => {
    const r = rng(9); g.fillStyle = '#303030'; g.fillRect(0, 0, w, h);
    const bh = 16, bw = 42;
    for (let row = 0; row < h / bh; row++) for (let x = -(row % 2) * 21; x < w; x += bw) {
      const v = 150 + r() * 70 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 2, row * bh + 2, bw - 3, bh - 3);
    }
  }),
  stones: () => canvasTex('stones', 256, 128, (g, w, h) => {
    const r = rng(21); g.fillStyle = '#2a2a2a'; g.fillRect(0, 0, w, h);
    const rows = 3, rh = h / rows;
    for (let i = 0; i < rows; i++) for (let x = -r() * 20; x < w;) {
      const sw = 26 + r() * 40, v = 140 + r() * 90 | 0; g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath(); if (g.roundRect) g.roundRect(x + 2, i * rh + 2, sw - 4, rh - 4, 7); else g.rect(x + 2, i * rh + 2, sw - 4, rh - 4); g.fill();
      x += sw;
    }
  }),
  ringStripes: () => canvasTex('ring', 128, 16, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#d8352a'; g.fillRect(i * w / 8, 0, w / 8, h); }
  }, { color: true }),
  shinglesF: () => canvasTex('shingBF', 256, 256, (g, w, h) => drawShingles(g, w, h, 150, 230, 20, false)),
  shinglesFC: () => canvasTex('shingCF', 256, 256, (g, w, h) => drawShingles(g, w, h, 200, 255, 90, false), { color: true }),
  scales: () => canvasTex('scalesB', 256, 256, (g, w, h) => drawScales(g, w, h, 150, 235, 20, true)),
  scalesC: () => canvasTex('scalesC', 256, 256, (g, w, h) => drawScales(g, w, h, 205, 255, 110, true), { color: true }),
  scalesF: () => canvasTex('scalesBF', 256, 256, (g, w, h) => drawScales(g, w, h, 150, 235, 20, false)),
  scalesFC: () => canvasTex('scalesCF', 256, 256, (g, w, h) => drawScales(g, w, h, 205, 255, 110, false), { color: true }),
  tiles: () => canvasTex('tilesB', 256, 256, (g, w, h) => drawTiles(g, w, h, false, true)),
  tilesC: () => canvasTex('tilesC', 256, 256, (g, w, h) => drawTiles(g, w, h, true, true), { color: true }),
  tilesF: () => canvasTex('tilesBF', 256, 256, (g, w, h) => drawTiles(g, w, h, false, false)),
  tilesFC: () => canvasTex('tilesCF', 256, 256, (g, w, h) => drawTiles(g, w, h, true, false), { color: true }),
  bricksC: () => canvasTex('bricksC', 256, 256, (g, w, h) => {
    const r = rng(9); g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, w, h);
    const bh = 16, bw = 42;
    for (let row = 0; row < h / bh; row++) for (let x = -(row % 2) * 21; x < w; x += bw) {
      const k = 0.8 + r() * 0.35, dk = r() < 0.08 ? 0.7 : 1;
      g.fillStyle = `rgb(${172 * k * dk | 0},${78 * k * dk | 0},${56 * k * dk | 0})`; g.fillRect(x + 2, row * bh + 2, bw - 3, bh - 3);
    }
  }, { color: true }),
  copperC: () => canvasTex('copperC', 256, 256, (g, w, h) => {
    const r = rng(17); g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = r() * w, y = r() * h, rad = 6 + r() * 26, v = 175 + r() * 80 | 0;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${v},${v},${v},.55)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(70,60,50,.18)'; g.fillRect(r() * w, r() * h, 1.5, 10 + r() * 40); }
  }, { color: true }),
  bars: () => canvasTex('bars', 128, 8, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; for (let i = 0; i < 8; i++) g.fillRect(i * 16 + 5, 0, 6, h);
  }),
};
function drawScales(g, w, h, lo, hi, gap, transpose) {
  const r = rng(13);
  g.fillStyle = `rgb(${gap},${gap},${gap})`; g.fillRect(0, 0, w, h);
  if (transpose) g.setTransform(0, 1, -1, 0, w, 0);
  const rows = 8, rh = w / rows, sw = 32;
  for (let i = rows; i >= -1; i--) for (let x = -(i % 2) * sw / 2; x < h + sw; x += sw) {
    const v = lo + r() * (hi - lo), a = v * 0.5 | 0, b = v | 0;
    const cx = x + sw / 2, cy = i * rh + rh * 0.35;
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, sw * 0.55);
    gr.addColorStop(0, `rgb(${b},${b},${b})`); gr.addColorStop(0.75, `rgb(${b},${b},${b})`); gr.addColorStop(1, `rgb(${a},${a},${a})`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(cx - sw / 2 + 1, cy - rh);
    g.lineTo(cx - sw / 2 + 1, cy); g.arc(cx, cy, sw / 2 - 1, Math.PI, 0, false); g.lineTo(cx + sw / 2 - 1, cy - rh); g.closePath(); g.fill();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// Barrel (Spanish) tiles. Untransposed: ridges vary along U and run along V (down a cone/frustum slope).
function drawTiles(g, w, h, color, transpose) {
  const r = rng(19);
  const W = transpose ? h : w, H = transpose ? w : h;
  if (transpose) g.setTransform(0, 1, -1, 0, w, 0);
  const n = 8, tw = W / n, courses = 4, ch = H / courses;
  for (let c = 0; c < courses; c++) for (let i = 0; i < n; i++) {
    const v = color ? 205 + r() * 50 : 0;
    for (let x = 0; x < tw; x++) {
      const s = Math.sin((x / tw) * Math.PI);
      const k = color ? (v * (0.72 + 0.28 * s)) | 0 : (40 + 200 * s) | 0;
      g.fillStyle = `rgb(${k},${k},${k})`; g.fillRect(i * tw + x, c * ch, 1, ch);
    }
    const gr = g.createLinearGradient(0, c * ch, 0, c * ch + ch * 0.25);
    gr.addColorStop(0, color ? 'rgba(60,40,20,.35)' : 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(i * tw, c * ch, tw, ch * 0.25);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
// Facade of punched windows (light wall, dark glass) + matching emissive "lit" map.
function punchTex(cols, rows, seed, lit) {
  return canvasTex(`punch${cols}x${rows}s${seed}${lit ? 'L' : 'C'}`, cols * 40, rows * 56, (g, w, h) => {
    const r = rng(seed * 13 + (lit ? 7 : 2));
    g.fillStyle = lit ? '#000' : '#e2e2e2'; g.fillRect(0, 0, w, h);
    for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
      const x = c * 40, y = k * 56;
      if (lit) { g.fillStyle = r() < 0.65 ? `rgb(255,${200 + r() * 40 | 0},${130 + r() * 60 | 0})` : '#000'; g.fillRect(x + 12, y + 14, 16, 30); continue; }
      g.fillStyle = '#f7f7f7'; g.fillRect(x + 9, y + 11, 22, 37);
      g.fillStyle = '#c8c8c8'; g.fillRect(x + 7, y + 8, 26, 4);
      const v = 26 + r() * 18 | 0; g.fillStyle = `rgb(${v},${v + 5},${v + 14})`; g.fillRect(x + 12, y + 14, 16, 30);
      g.fillStyle = '#f7f7f7'; g.fillRect(x + 19, y + 14, 2, 30);
    }
  }, { color: true, wrap: false });
}
function stripesTex(hex) {
  return () => canvasTex('stripes' + hex, 128, 16, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fbfaf5' : css(hex); g.fillRect(i * w / 8, 0, w / 8, h); }
  }, { color: true });
}
function textTex(key, text, { w = 512, h = 160, bg = '#4a2e1c', fg = '#f3e3c3', font = 'bold 96px Georgia, serif', border = '#c9a24a', vertical = false } = {}) {
  return canvasTex('txt:' + key, w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = border; g.lineWidth = Math.max(4, w * 0.02); g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2); }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (vertical) { const ch = [...text], step = h / (ch.length + 0.6); ch.forEach((c, i) => g.fillText(c, w / 2, step * (i + 0.8))); }
    else g.fillText(text, w / 2, h / 2 + 4);
  }, { color: true, wrap: false });
}
function facadeTex(cols, rows, seed, lit) {
  return canvasTex(`fac${cols}x${rows}s${seed}${lit ? 'L' : 'C'}`, cols * 32, rows * 48, (g, w, h) => {
    const r = rng(seed * 7 + (lit ? 3 : 1));
    g.fillStyle = lit ? '#000' : '#d6d6d6'; g.fillRect(0, 0, w, h);
    for (let c = 0; c < cols; c++) for (let k = 0; k < rows; k++) {
      const x = c * 32 + 5, y = k * 48 + 7;
      if (lit) { const on = r() < 0.68; g.fillStyle = on ? `rgb(255,${205 + r() * 40 | 0},${130 + r() * 70 | 0})` : '#000'; }
      else { const v = 26 + r() * 22 | 0; g.fillStyle = `rgb(${v},${v + 6},${v + 16})`; }
      g.fillRect(x, y, 22, 34);
    }
  }, { color: true, wrap: false });
}
function rep(tex, r = [1, 1]) { const t = tex.clone(); t.repeat.set(r[0], r[1]); t.needsUpdate = true; return t; }

// ───────────────────── lights (evening windows) ─────────────────────
export const LIT = { on: false, mats: new Set() };
export function setLights(on) {
  LIT.on = on;
  for (const m of LIT.mats) m.emissiveIntensity = on ? m.userData.lit : 0;
}

// ───────────────────── material kit per building ─────────────────────
class Kit {
  constructor(seed) { this.rand = rng(seed); this.paints = []; }
  mat(role, color, o = {}) {
    const m = new THREE.MeshPhysicalMaterial({
      color, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0,
      clearcoat: o.clear ?? 0.3, clearcoatRoughness: o.ccr ?? 0.35,
    });
    if (o.bump) { m.bumpMap = rep(o.bump(), o.rep); m.bumpScale = o.bs ?? 1.5; }
    if (o.map) { m.map = rep(o.map(), o.rep); }
    m.userData.role = role; m.userData.base = m.color.clone();
    if (role !== 'keep') this.paints.push(m);
    return m;
  }
  glass(o = {}) {
    const on = o.always ? 1 : (this.rand() < 0.72 ? 1 : 0.0);
    const m = new THREE.MeshPhysicalMaterial({
      color: o.color ?? 0x182230, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
      emissive: new THREE.Color(o.glow ?? 0xffc27a),
    });
    m.userData.lit = (o.intensity ?? (1.1 + this.rand() * 1.0)) * on;
    m.emissiveIntensity = LIT.on ? m.userData.lit : 0;
    m.userData.role = 'keep'; m.userData.isGlass = true; LIT.mats.add(m); return m;
  }
  gold() { return this._gold ??= this.mat('keep', 0xd6aa52, { metal: 1, rough: 0.26, clear: 0 }); }
  brass() { return this._brass ??= this.mat('keep', 0xc9a24a, { metal: 1, rough: 0.3, clear: 0 }); }
  iron() { return this._iron ??= this.mat('keep', 0x2b2724, { metal: 0.6, rough: 0.5, clear: 0 }); }
}

// ───────────────────── reusable parts ─────────────────────
function windowUnit(kit, w, h, o = {}) {
  const { trim, glass = kit.glass(), mullion = 'cross', shutter = null, sill = true, box = null } = o;
  const g = new THREE.Group(), f = 0.026, dp = 0.03;
  g.add(M(rb(w, f, dp, 0.006), trim, 0, h / 2 - f / 2, dp / 2));
  g.add(M(rb(w, f, dp, 0.006), trim, 0, -h / 2 + f / 2, dp / 2));
  g.add(M(rb(f, h - 2 * f, dp, 0.006), trim, -w / 2 + f / 2, 0, dp / 2));
  g.add(M(rb(f, h - 2 * f, dp, 0.006), trim, w / 2 - f / 2, 0, dp / 2));
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - f * 1.2, h - f * 1.2), glass); gl.position.z = 0.004; g.add(gl);
  if (mullion === 'cross' || mullion === 'v') g.add(M(rb(f * 0.42, h - 2 * f, dp * 0.55, 0.003), trim, 0, 0, dp * 0.3));
  if (mullion === 'cross' || mullion === 'h') g.add(M(rb(w - 2 * f, f * 0.42, dp * 0.55, 0.003), trim, 0, 0, dp * 0.3));
  if (sill) g.add(M(rb(w + 0.05, 0.022, dp + 0.035, 0.006), trim, 0, -h / 2 - 0.011, (dp + 0.035) / 2));
  if (shutter) for (const s of [-1, 1]) g.add(M(rb(w * 0.42, h, 0.016, 0.004), shutter, s * (w / 2 + w * 0.21 + 0.008), 0, 0.008));
  if (box) {
    g.add(M(rb(w * 0.95, 0.045, 0.055, 0.008), box, 0, -h / 2 - 0.05, 0.055));
    const cols = [0xe0457b, 0xf2c94c, 0xffffff, 0xd94c3d, 0xb27ce0];
    const leaf = kit._leaf ??= kit.mat('keep', 0x4f7a3a, { rough: 0.8, clear: 0 });
    const n = 7;
    for (let i = 0; i < n; i++) {
      const x = -w * 0.4 + (w * 0.8) * i / (n - 1);
      g.add(M(sph(0.02, 8, 6), leaf, x, -h / 2 - 0.022, 0.05 + (kit.rand() - 0.5) * 0.02));
      const fm = kit.mat('keep', cols[(kit.rand() * cols.length) | 0], { rough: 0.6, clear: 0.2 });
      g.add(M(sph(0.013, 8, 6), fm, x + (kit.rand() - 0.5) * 0.01, -h / 2 - 0.006, 0.06 + (kit.rand() - 0.5) * 0.02));
    }
  }
  return g;
}
function doorUnit(kit, w, h, { trim, panel, knob = true, glassTop = false }) {
  const g = new THREE.Group(), f = 0.028, dp = 0.03;
  g.add(M(rb(w + 2 * f, f, dp, 0.006), trim, 0, h / 2 + f / 2, dp / 2));
  g.add(M(rb(f, h, dp, 0.006), trim, -w / 2 - f / 2, 0, dp / 2));
  g.add(M(rb(f, h, dp, 0.006), trim, w / 2 + f / 2, 0, dp / 2));
  g.add(M(rb(w, h, 0.016, 0.005), panel, 0, 0, 0.006));
  if (glassTop) {
    const gw = w * 0.6, gh = h * 0.24, gy = h * 0.26;
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), kit.glass()); gl.position.set(0, gy, 0.0148); g.add(gl);
    for (const s of [-1, 1]) {
      g.add(M(rb(gw + 0.016, 0.008, 0.006, 0.002), trim, 0, gy + s * (gh / 2 + 0.004), 0.016));
      g.add(M(rb(0.008, gh, 0.006, 0.002), trim, s * (gw / 2 + 0.004), gy, 0.016));
    }
  }
  if (knob) g.add(M(sph(0.013, 12, 8), kit.brass(), w * 0.32, -h * 0.05, 0.022));
  return g;
}
function lantern(kit, x, y, z) {
  const g = new THREE.Group(), iron = kit.iron();
  g.add(M(rb(0.012, 0.012, 0.05, 0.003), iron, 0, 0.04, 0.025));
  g.add(M(rb(0.032, 0.05, 0.032, 0.004), kit.glass({ always: true, glow: 0xffa040, intensity: 3, color: 0x3a2a18 }), 0, 0.01, 0.05));
  const cap = M(cone(0.03, 0.026, 4), iron, 0, 0.048, 0.05); cap.rotation.y = Math.PI / 4; g.add(cap);
  g.add(M(rb(0.036, 0.008, 0.036, 0.003), iron, 0, -0.018, 0.05));
  g.position.set(x, y, z); return g;
}
function roundWindow(kit, trim, r, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  g.add(M(torus(r, 0.012, 10, 28), trim, 0, 0, 0.004));
  const gl = new THREE.Mesh(circle(r - 0.003, 28), kit.glass()); gl.position.z = 0.002; g.add(gl);
  g.add(M(rb(r * 1.9, 0.01, 0.01, 0.003), trim, 0, 0, 0.006));
  g.add(M(rb(0.01, r * 1.9, 0.01, 0.003), trim, 0, 0, 0.006));
  g.position.set(x, y, z); g.rotation.y = rotY; return g;
}
function curtain(kit, { w, h, cols, frame, glass }) {
  const g = new THREE.Group(), f = 0.014, dp = 0.02;
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass || kit.glass()); gl.position.z = 0.003; g.add(gl);
  g.add(M(rb(w + f, f, dp, 0.004), frame, 0, h / 2, dp / 2));
  g.add(M(rb(w + f, f, dp, 0.004), frame, 0, -h / 2, dp / 2));
  for (let i = 0; i <= cols; i++) {
    const x = -w / 2 + w * i / cols, edge = i === 0 || i === cols;
    g.add(M(rb(edge ? f : f * 0.6, h, edge ? dp : dp * 0.7, 0.003), frame, x, 0, dp / 2));
  }
  return g;
}
// Roof surface material. slab=true → a roof slab (slope along U); false → cone/frustum/lean-to (slope along V).
// Ls = length along the slope, La = length across it.
const ROOF = {
  shingle: { b: ['shingles', 'shinglesF'], c: ['shinglesC', 'shinglesFC'], dA: 2.2, dX: 2.2, o: { rough: 0.72, clear: 0.12, bs: 2.2 } },
  scales:  { b: ['scales', 'scalesF'], c: ['scalesC', 'scalesFC'], dA: 2.6, dX: 2.6, o: { rough: 0.55, clear: 0.3, bs: 2 } },
  tile:    { b: ['tiles', 'tilesF'], c: ['tilesC', 'tilesFC'], dA: 1.6, dX: 2.4, o: { rough: 0.6, clear: 0.2, bs: 3 } },
  metal:   { b: ['seams', 'seamsV'], c: null, dA: 0, dX: 3, o: { rough: 0.38, metal: 0.25, clear: 0.5, bs: 1.4 } },
  copper:  { b: ['seams', 'seamsV'], c: ['copperC', 'copperC'], dA: 0, dX: 3, o: { rough: 0.45, metal: 0.3, clear: 0.35, bs: 1.2 } },
};
function surfMat(kit, kind, color, Ls, La, slab) {
  const K = ROOF[kind], i = slab ? 0 : 1;
  const along = K.dA ? Ls * K.dA : 1, across = La * K.dX;
  return kit.mat('roof', color, { ...K.o, bump: T[K.b[i]], map: K.c ? T[K.c[i]] : null, rep: slab ? [along, across] : [across, along] });
}
// Square frustum scaled to w×d footprint (topRatio 0 → pyramid). Flat-shaded. Origin at its base center.
function frustum(w, d, h, topRatio, mat) {
  const geo = new THREE.CylinderGeometry(Math.SQRT1_2 * Math.max(topRatio, 0.001), Math.SQRT1_2, 1, 4, 1).toNonIndexed();
  geo.rotateY(Math.PI / 4); geo.translate(0, 0.5, 0); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); m.scale.set(w, h, d); return m;
}
function frustumRoof(kit, kind, color, w, d, h, topRatio) {
  const slant = Math.hypot(h, Math.min(w, d) * (1 - topRatio) / 2);
  return frustum(w, d, h, topRatio, surfMat(kit, kind, color, slant, 2 * (w + d), false));
}
// z of a frustum's front face at height y above its base
function frustumZ(d, h, topRatio, y) { return d / 2 * (1 - (1 - topRatio) * (y / h)); }
function dormer(kit, { w = 0.13, h = 0.12, d = 0.14, wall, trim, roofColor, roofKind = 'shingle' }) {
  const g = gable(kit, { w, d, wallH: h, roofH: w * 0.42, wall, gableWall: wall, roofColor, roofKind, over: 0.02, thick: 0.022 });
  const win = windowUnit(kit, w * 0.62, h * 0.72, { trim, sill: false, mullion: 'v' }); win.position.set(0, h * 0.52, d / 2); g.add(win);
  return g;
}
function archShape(w, h, x0 = 0, y0 = 0) {
  const s = new THREE.Shape(), r = w / 2;
  s.moveTo(x0 - r, y0 - h / 2); s.lineTo(x0 + r, y0 - h / 2); s.lineTo(x0 + r, y0 + h / 2 - r);
  s.absarc(x0, y0 + h / 2 - r, r, 0, Math.PI, false); s.lineTo(x0 - r, y0 - h / 2); return s;
}
function archWindow(kit, w, h, { trim, glass, panel = null, f = 0.022, sill = true, mullion = true, shutter = null }) {
  const g = new THREE.Group();
  const outer = archShape(w, h), inner = archShape(w - 2 * f, h - 2 * f);
  outer.holes.push(new THREE.Path(inner.getPoints(24)));
  g.add(M(new THREE.ExtrudeGeometry(outer, { depth: 0.028, bevelEnabled: false, curveSegments: 18 }), trim));
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(inner, 18), panel || glass || kit.glass()); fill.position.z = 0.004; g.add(fill);
  if (mullion && !panel) {
    g.add(M(rb(f * 0.45, h - 2 * f, 0.016, 0.003), trim, 0, 0, 0.01));
    g.add(M(rb(w - 2 * f, f * 0.45, 0.016, 0.003), trim, 0, h / 2 - w / 2, 0.01));
  }
  if (panel) g.add(M(sph(0.012, 10, 8), kit.iron(), w * 0.25, -h * 0.08, 0.012));
  if (sill) g.add(M(rb(w + 0.04, 0.02, 0.055, 0.005), trim, 0, -h / 2 - 0.01, 0.025));
  if (shutter) for (const s of [-1, 1]) g.add(M(rb(w * 0.45, h - w * 0.35, 0.014, 0.004), shutter, s * (w / 2 + w * 0.225 + 0.008), -w * 0.175, 0.007));
  return g;
}
// Wall slab with n arched openings along the bottom (an arcade). Origin at bottom center, front face at +depth.
function archWall(w, h, n, aw, ah, depth, mat) {
  const s = new THREE.Shape(), r = aw / 2, step = w / n;
  s.moveTo(-w / 2, 0);
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + step * (i + 0.5);
    s.lineTo(cx - r, 0); s.lineTo(cx - r, ah - r); s.absarc(cx, ah - r, r, Math.PI, 0, true); s.lineTo(cx + r, 0);
  }
  s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
  return M(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 16 }), mat);
}
// Railing: top + bottom rail and a single alpha-tested panel of balusters (cheap: 3 meshes).
function balustrade(kit, len, h, mat, count) {
  const g = new THREE.Group();
  g.add(M(rb(len, 0.014, 0.016, 0.004), mat, 0, h, 0));
  g.add(M(rb(len, 0.01, 0.012, 0.003), mat, 0, 0.012, 0));
  const pm = mat.clone(); pm.userData.base = mat.userData.base.clone(); pm.alphaMap = rep(T.bars(), [count / 8, 1]); pm.alphaTest = 0.5; pm.side = THREE.DoubleSide;
  if (pm.userData.role !== 'keep') kit.paints.push(pm);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(len, h - 0.012), pm); p.position.y = h / 2 + 0.003; p.userData.noShadow = true; g.add(p);
  return g;
}
function palm(kit, h, lean = 0.14) {
  const g = new THREE.Group();
  const bark = kit._bark ??= kit.mat('keep', 0x8d6c4a, { rough: 0.9, clear: 0, bump: T.clapboard, rep: [1, 7], bs: 2.5 });
  const trunk = M(cyl(0.016, 0.026, h, 10), bark, Math.sin(lean) * h / 2, Math.cos(lean) * h / 2, 0);
  trunk.rotation.z = -lean; g.add(trunk);
  const top = new THREE.Group(); top.position.set(Math.sin(lean) * h, Math.cos(lean) * h, 0); g.add(top);
  const leafM = kit._palmLeaf ??= (() => { const m = kit.mat('keep', 0x4f8a3c, { rough: 0.7, clear: 0.1 }); m.side = THREE.DoubleSide; return m; })();
  const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.1, 0.05, 0.28, 0); s.quadraticCurveTo(0.1, -0.05, 0, 0);
  const lg = new THREE.ShapeGeometry(s, 8); lg.rotateX(-Math.PI / 2);
  for (let i = 0; i < 9; i++) {
    const holder = new THREE.Group(); holder.rotation.set(0, i / 9 * Math.PI * 2 + kit.rand() * 0.3, -0.3 - kit.rand() * 0.35);
    holder.add(new THREE.Mesh(lg, leafM)); top.add(holder);
  }
  const nut = kit.mat('keep', 0x5a3e22, { rough: 0.7, clear: 0 });
  for (let i = 0; i < 3; i++) { const a = i * 2.1; top.add(M(sph(0.018, 10, 8), nut, Math.cos(a) * 0.02, -0.02, Math.sin(a) * 0.02)); }
  return g;
}
// Pennant on a pole. Returns { group, tick }.
function flagPole(kit, color, poleH = 0.3, phase = 0) {
  const g = new THREE.Group();
  const white = kit._poleM ??= kit.mat('keep', 0xf4f1ea, { rough: 0.4, clear: 0.3 });
  g.add(M(cyl(0.006, 0.007, poleH, 8), white, 0, poleH / 2, 0));
  g.add(M(sph(0.012, 10, 8), kit.gold(), 0, poleH + 0.01, 0));
  const pivot = new THREE.Group(); pivot.position.y = poleH - 0.06; g.add(pivot);
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.17, 0.035); sh.lineTo(0, 0.07); sh.closePath();
  const fm = kit.mat('accent', color, { rough: 0.8, clear: 0 }); fm.side = THREE.DoubleSide;
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(sh), fm); flag.position.y = -0.035; pivot.add(flag);
  return { group: g, tick: (t) => { pivot.rotation.y = Math.sin(t * 2.3 + phase) * 0.35 + 0.2; flag.scale.x = 1 + 0.08 * Math.sin(t * 5.1 + phase); } };
}
function addTick(root, fn) { const prev = root.userData.tick; root.userData.tick = prev ? (t) => { prev(t); fn(t); } : fn; }
function facadePlane(kit, w, h, cols, rows, seed, color) {
  const fm = kit.mat('wall', color, { rough: 0.7, clear: 0.15 });
  fm.map = punchTex(cols, rows, seed, false); fm.emissive = new THREE.Color(0xffffff); fm.emissiveMap = punchTex(cols, rows, seed, true);
  fm.userData.lit = 1.4; fm.emissiveIntensity = LIT.on ? 1.4 : 0; LIT.mats.add(fm);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), fm);
}
function flowers(kit, g, x0, x1, y, z, n, cols = [0xe0457b, 0xf2c94c, 0xffffff, 0xd94c3d, 0xb27ce0]) {
  const leaf = kit._leaf ??= kit.mat('keep', 0x4f7a3a, { rough: 0.8, clear: 0 });
  for (let i = 0; i < n; i++) {
    const x = x0 + (x1 - x0) * i / Math.max(1, n - 1);
    g.add(M(sph(0.02, 8, 6), leaf, x, y, z + (kit.rand() - 0.5) * 0.02));
    const fm = kit.mat('keep', cols[(kit.rand() * cols.length) | 0], { rough: 0.6, clear: 0.2 });
    g.add(M(sph(0.013, 8, 6), fm, x + (kit.rand() - 0.5) * 0.01, y + 0.016, z + 0.005 + (kit.rand() - 0.5) * 0.02));
  }
}

// Gable house body: walls + gable triangles + two roof slabs + ridge cap. Ridge runs along Z.
function gable(kit, { w, d, wallH, roofH, wall, gableWall, roofColor, roofKind = 'shingle', over = 0.07, thick = 0.05 }) {
  const g = new THREE.Group();
  g.add(M(rb(w, wallH, d, 0.012), wall, 0, wallH / 2, 0));
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + 0.004, 0); s.lineTo(w / 2 - 0.004, 0); s.lineTo(0, roofH - 0.004); s.closePath();
  const tg = new THREE.ExtrudeGeometry(s, { depth: d - 0.006, bevelEnabled: false });
  tg.translate(0, wallH - 0.003, -(d - 0.006) / 2);
  g.add(M(tg, gableWall));
  const half = w / 2, len = Math.hypot(half, roofH), a = Math.atan2(roofH, half), L = len + over, D = d + 2 * over;
  const roof = surfMat(kit, roofKind, roofColor, L, D, true);
  const Ry = wallH + roofH;
  for (const side of [-1, 1]) {
    const ux = -side * half / len, uy = roofH / len, nx = side * roofH / len, ny = half / len;
    const m = M(rb(L, thick, D, 0.012), roof, -ux * L / 2 + nx * thick / 2, Ry - uy * L / 2 + ny * thick / 2, 0);
    if (side === 1) { m.rotation.order = 'ZYX'; m.rotation.set(0, Math.PI, -a); } // flip so texture U points to the ridge on both slabs
    else m.rotation.z = a;
    g.add(m);
  }
  const capM = kit._cap ??= kit.mat('roof', shade(roofColor, 0.8), { rough: 0.6, clear: 0.2 });
  g.add(M(rb(0.06, 0.045, D + 0.01, 0.015), capM, 0, Ry + thick * half / len + 0.004, 0));
  g.userData.roofY = (x) => wallH + roofH * (1 - Math.abs(x) / half);
  return g;
}

// ═════════════════════ BROWN — Cottage / Roadside Inn ═════════════════════
function cottage(kit, P) {
  const root = new THREE.Group();
  const W = 0.9, D = 0.7, WH = 0.5, RH = 0.36, B = 0.08, zf = D / 2;
  const stone = kit.mat('base', 0xa39686, { rough: 0.9, clear: 0, bump: T.stones, rep: [2.5, 0.45], bs: 2.5 });
  root.add(M(rb(W + 0.08, B, D + 0.08, 0.02), stone, 0, B / 2, 0));
  const wall = kit.mat('wall', 0xf3e7d0, { rough: 0.85, clear: 0.05, bump: T.stucco, rep: [W * 2, WH * 2], bs: 0.8 });
  const gw = kit.mat('wall', 0xf3e7d0, { rough: 0.85, clear: 0.05, bump: T.stucco, rep: [2, 2], bs: 0.8 });
  const body = gable(kit, { w: W, d: D, wallH: WH, roofH: RH, wall, gableWall: gw, roofColor: P.accent, over: 0.08, thick: 0.055 });
  body.position.y = B; root.add(body);
  const trim = kit.mat('trim', 0xfbf6ea, { rough: 0.45, clear: 0.4 });
  const doorM = kit.mat('accent', shade(P.accent, 0.72), { rough: 0.5, clear: 0.5, bump: T.planksV, bs: 1 });
  const shut = kit.mat('accent', shade(P.accent, 0.9), { rough: 0.5, clear: 0.4, bump: T.planksV, bs: 0.8 });
  const boxM = kit.mat('accent', shade(P.accent, 0.6), { rough: 0.6, clear: 0.2 });
  const door = doorUnit(kit, 0.19, 0.33, { trim, panel: doorM }); door.position.set(-0.2, B + 0.165, zf); root.add(door);
  const win = windowUnit(kit, 0.21, 0.2, { trim, shutter: shut, box: boxM }); win.position.set(0.18, B + 0.3, zf); root.add(win);
  root.add(roundWindow(kit, trim, 0.055, 0, B + WH + 0.14, zf));
  for (const s of [-1, 1]) { const w2 = windowUnit(kit, 0.2, 0.18, { trim }); w2.position.set(s * W / 2, B + 0.3, 0); w2.rotation.y = s * Math.PI / 2; root.add(w2); }
  const wb = windowUnit(kit, 0.2, 0.18, { trim }); wb.position.set(-0.15, B + 0.3, -zf); wb.rotation.y = Math.PI; root.add(wb);
  const brick = kit.mat('base', 0x9a5a44, { rough: 0.85, clear: 0, bump: T.bricks, rep: [0.7, 1.6], bs: 2 });
  const cx = 0.24, cz = -0.14, top = B + WH + RH + 0.1, bot = B + body.userData.roofY(cx) - 0.08;
  root.add(M(rb(0.14, top - bot, 0.14, 0.01), brick, cx, (top + bot) / 2, cz));
  root.add(M(rb(0.18, 0.035, 0.18, 0.008), stone, cx, top + 0.017, cz));
  root.add(lantern(kit, -0.055, B + 0.29, zf));
  root.add(M(rb(0.26, 0.035, 0.09, 0.01), stone, -0.2, 0.0175, zf + 0.08));
  return root;
}
function inn(kit, P) {
  const root = new THREE.Group();
  const W = 1.5, D = 0.8, WH = 0.92, RH = 0.42, B = 0.08, zf = D / 2;
  const stone = kit.mat('base', 0xa39686, { rough: 0.9, clear: 0, bump: T.stones, rep: [4, 0.45], bs: 2.5 });
  root.add(M(rb(W + 0.08, B, D + 0.08, 0.02), stone, 0, B / 2, 0));
  const wall = kit.mat('wall', 0xf3e7d0, { rough: 0.85, clear: 0.05, bump: T.stucco, rep: [W * 2, WH * 2], bs: 0.8 });
  const gw = kit.mat('wall', 0xf3e7d0, { rough: 0.85, clear: 0.05, bump: T.stucco, rep: [2, 2], bs: 0.8 });
  const body = gable(kit, { w: D, d: W, wallH: WH, roofH: RH, wall, gableWall: gw, roofColor: P.accent, over: 0.09, thick: 0.06 });
  body.rotation.y = Math.PI / 2; body.position.y = B; root.add(body);
  const timber = kit.mat('accent', shade(P.accent, 0.42), { rough: 0.7, clear: 0.1, bump: T.planksV, rep: [0.25, 1], bs: 0.6 });
  const trim = kit.mat('trim', 0xfbf6ea, { rough: 0.45, clear: 0.4 });
  // half-timber frame
  for (const s of [-1, 1]) for (const t of [-1, 1]) root.add(M(rb(0.055, WH, 0.055, 0.008), timber, s * (W / 2 - 0.02), B + WH / 2, t * (zf - 0.02)));
  for (const z of [zf + 0.008, -zf - 0.008]) {
    for (const y of [B + 0.022, B + WH / 2, B + WH - 0.022]) root.add(M(rb(W + 0.012, 0.045, 0.03, 0.008), timber, 0, y, z));
    for (const x of [-0.26, 0.26]) root.add(M(rb(0.04, WH, 0.025, 0.006), timber, x, B + WH / 2, z));
  }
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.008);
    root.add(M(rb(0.03, 0.045, D, 0.008), timber, x, B + WH / 2, 0));
    const y0 = B + WH / 2, y1 = B + WH - 0.02, dz = 0.31, dy = y1 - y0, L = Math.hypot(dz, dy), th = Math.atan2(dz, dy);
    for (const t of [-1, 1]) { const m = M(rb(0.025, L, 0.035, 0.006), timber, x, (y0 + y1) / 2, t * (0.36 - dz / 2)); m.rotation.x = -t * th; root.add(m); }
    root.add(M(rb(0.025, RH * 0.8, 0.035, 0.006), timber, s * (W / 2 + 0.005), B + WH + RH * 0.4, 0));
    const sw = windowUnit(kit, 0.2, 0.2, { trim }); sw.position.set(s * (W / 2 + 0.01), B + 0.24, 0); sw.rotation.y = s * Math.PI / 2; root.add(sw);
  }
  const box = kit.mat('accent', shade(P.accent, 0.6), { rough: 0.6, clear: 0.2 });
  for (const x of [-0.5, 0.5]) { const w = windowUnit(kit, 0.2, 0.2, { trim, box }); w.position.set(x, B + 0.24, zf + 0.01); root.add(w); }
  for (const x of [-0.5, 0, 0.5]) { const w = windowUnit(kit, 0.2, 0.2, { trim }); w.position.set(x, B + WH / 2 + 0.23, zf + 0.01); root.add(w); }
  for (const x of [-0.5, 0, 0.5]) { const w = windowUnit(kit, 0.2, 0.2, { trim }); w.position.set(x, B + WH / 2 + 0.23, -zf - 0.01); w.rotation.y = Math.PI; root.add(w); }
  const doorM = kit.mat('accent', shade(P.accent, 0.55), { rough: 0.5, clear: 0.5, bump: T.planksV, bs: 1 });
  const door = doorUnit(kit, 0.24, 0.36, { trim, panel: doorM, glassTop: true }); door.position.set(0, B + 0.18, zf + 0.01); root.add(door);
  const canopy = M(rb(0.42, 0.025, 0.17, 0.006), timber, 0, B + 0.43, zf + 0.08); canopy.rotation.x = 0.38; root.add(canopy);
  for (const s of [-1, 1]) { const br = M(rb(0.018, 0.13, 0.018, 0.004), timber, s * 0.17, B + 0.37, zf + 0.045); br.rotation.x = -0.6; root.add(br); }
  root.add(lantern(kit, -0.19, B + 0.3, zf + 0.01));
  root.add(lantern(kit, 0.19, B + 0.3, zf + 0.01));
  // hanging sign
  const iron = kit.iron(), sx = W / 2 - 0.12;
  root.add(M(rb(0.012, 0.012, 0.27, 0.003), iron, sx, B + 0.8, zf + 0.135));
  for (const z of [zf + 0.08, zf + 0.22]) root.add(M(rb(0.004, 0.04, 0.004, 0.001), iron, sx, B + 0.775, z));
  const signBoard = kit.mat('keep', 0x4a2e1c, { rough: 0.6, clear: 0.3 });
  root.add(M(rb(0.016, 0.13, 0.2, 0.01), signBoard, sx, B + 0.69, zf + 0.15));
  const sm = new THREE.MeshStandardMaterial({ map: textTex('INN', 'INN'), roughness: 0.55 });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.11), sm); p.position.set(sx + s * 0.0085, B + 0.69, zf + 0.15); p.rotation.y = s * Math.PI / 2; root.add(p); }
  const brick = kit.mat('base', 0x9a5a44, { rough: 0.85, clear: 0, bump: T.bricks, rep: [0.7, 1.8], bs: 2 });
  for (const s of [-1, 1]) {
    const top = B + WH + RH + 0.18, bot = B + body.userData.roofY(0.12) - 0.06;
    root.add(M(rb(0.13, top - bot, 0.13, 0.01), brick, s * 0.58, (top + bot) / 2, -0.12));
    root.add(M(rb(0.17, 0.03, 0.17, 0.008), stone, s * 0.58, top + 0.015, -0.12));
  }
  return root;
}

// ═════════════════════ LIGHT BLUE — Beach Bungalow / Seaside Hotel ═════════════════════
function bungalow(kit, P) {
  const root = new THREE.Group();
  const white = kit.mat('trim', 0xfbfaf6, { rough: 0.45, clear: 0.4 });
  const deckM = kit.mat('base', 0xcdb79a, { rough: 0.85, clear: 0.05, bump: T.planksH, rep: [1.5, 1.5], bs: 1.5 });
  const SH = 0.2;
  for (const x of [-0.47, 0.47]) for (const z of [-0.42, 0.02, 0.44]) root.add(M(cyl(0.024, 0.028, SH, 10), white, x, SH / 2, z));
  root.add(M(rb(1.04, 0.045, 0.98, 0.01), deckM, 0, SH + 0.0225, 0));
  const DT = SH + 0.045, W = 0.78, D = 0.56, WH = 0.46, RH = 0.3, BZ = -0.17, zf = BZ + D / 2;
  const clap = kit.mat('wall', 0xf7f4ec, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [1, WH * 2], bs: 1.6 });
  const clapG = kit.mat('wall', 0xf7f4ec, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [2, 2], bs: 1.6 });
  const body = gable(kit, { w: W, d: D, wallH: WH, roofH: RH, wall: clap, gableWall: clapG, roofColor: P.accent, roofKind: 'metal', over: 0.07, thick: 0.04 });
  body.position.set(0, DT, BZ); root.add(body);
  const accent = kit.mat('accent', shade(P.accent, 0.8), { rough: 0.45, clear: 0.5, bump: T.planksV, bs: 0.8 });
  const door = doorUnit(kit, 0.16, 0.3, { trim: white, panel: accent, glassTop: true }); door.position.set(0, DT + 0.15, zf); root.add(door);
  for (const s of [-1, 1]) { const w = windowUnit(kit, 0.13, 0.17, { trim: white, shutter: accent }); w.position.set(s * 0.245, DT + 0.27, zf); root.add(w); }
  for (const s of [-1, 1]) { const w = windowUnit(kit, 0.15, 0.17, { trim: white }); w.position.set(s * W / 2, DT + 0.27, BZ); w.rotation.y = s * Math.PI / 2; root.add(w); }
  root.add(roundWindow(kit, white, 0.04, 0, DT + WH + 0.11, zf));
  // porch roof
  const pr = kit.mat('roof', P.accent, { rough: 0.38, metal: 0.25, clear: 0.5, bump: T.seamsV, rep: [W * 3, 1], bs: 1.4 });
  const slab = M(rb(W + 0.12, 0.03, 0.43, 0.008), pr, 0, DT + 0.43, 0.31); slab.rotation.x = 0.27; root.add(slab);
  for (const s of [-1, 1]) root.add(M(cyl(0.016, 0.016, 0.4, 10), white, s * 0.42, DT + 0.2, 0.46));
  for (const s of [-1, 1]) {
    const x0 = s * 0.13, x1 = s * 0.42, cx = (x0 + x1) / 2, len = Math.abs(x1 - x0);
    root.add(M(rb(len, 0.018, 0.022, 0.005), white, cx, DT + 0.15, 0.46));
    root.add(M(rb(len, 0.012, 0.016, 0.004), white, cx, DT + 0.03, 0.46));
    for (let i = 1; i < 6; i++) root.add(M(rb(0.012, 0.12, 0.012, 0.003), white, x0 + (x1 - x0) * i / 6, DT + 0.09, 0.46));
    const z0 = zf + 0.02, z1 = 0.46;
    root.add(M(rb(0.022, 0.018, z1 - z0, 0.005), white, s * 0.42, DT + 0.15, (z0 + z1) / 2));
    for (let i = 1; i < 5; i++) root.add(M(rb(0.012, 0.12, 0.012, 0.003), white, s * 0.42, DT + 0.09, z0 + (z1 - z0) * i / 5));
  }
  for (let i = 0; i < 4; i++) root.add(M(rb(0.24, 0.04, 0.08, 0.008), deckM, 0, DT - 0.06 * (i + 1) + 0.02, 0.53 + 0.07 * i));
  const ringM = kit.mat('keep', 0xffffff, { rough: 0.5, clear: 0.3, map: T.ringStripes });
  const lr = M(torus(0.045, 0.014, 10, 24), ringM, W / 2 + 0.016, DT + 0.27, BZ + 0.19); lr.rotation.y = Math.PI / 2; root.add(lr);
  const boardM = kit.mat('keep', 0xf28c6a, { rough: 0.3, clear: 1 });
  const sb = M(sph(1, 24, 12), boardM, -0.29, DT + 0.25, 0.41); sb.scale.set(0.055, 0.24, 0.012); sb.rotation.set(-0.15, 0, 0.1); root.add(sb);
  root.add(lantern(kit, 0.12, DT + 0.25, zf));
  return root;
}
function seaside(kit, P) {
  const root = new THREE.Group();
  const W = 1.56, D = 0.84, WH = 1.2, RH = 0.28, B = 0.07, zf = D / 2;
  const base = kit.mat('base', 0xd8d4cc, { rough: 0.8, clear: 0.05, bump: T.stucco, rep: [3, 0.4], bs: 0.6 });
  root.add(M(rb(W + 0.06, B, D + 0.06, 0.015), base, 0, B / 2, 0));
  const clap = kit.mat('wall', 0xf1ebdf, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [1, WH * 2], bs: 1.6 });
  const clapG = kit.mat('wall', 0xf1ebdf, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [2, 2], bs: 1.6 });
  const body = gable(kit, { w: D, d: W, wallH: WH, roofH: RH, wall: clap, gableWall: clapG, roofColor: P.accent, roofKind: 'metal', over: 0.07, thick: 0.045 });
  body.rotation.y = Math.PI / 2; body.position.y = B; root.add(body);
  const white = kit.mat('trim', 0xffffff, { rough: 0.4, clear: 0.4 });
  for (const s of [-1, 1]) for (const t of [-1, 1]) root.add(M(rb(0.04, WH, 0.04, 0.006), white, s * (W / 2 - 0.012), B + WH / 2, t * (zf - 0.012)));
  for (const z of [zf + 0.006, -zf - 0.006]) for (const y of [B + 0.4, B + 0.8]) root.add(M(rb(W + 0.01, 0.028, 0.02, 0.006), white, 0, y, z));
  const awnM = kit.mat('keep', 0xffffff, { rough: 0.85, clear: 0, map: stripesTex(P.accent) });
  const cols = [-0.62, -0.31, 0, 0.31, 0.62];
  for (let i = 0; i < 3; i++) for (const x of cols) {
    for (const back of [false, true]) {
      if (i === 0 && !back && Math.abs(x) < 0.4) continue;
      const y = B + 0.4 * i + 0.21, w = windowUnit(kit, 0.15, 0.2, { trim: white, mullion: 'v' });
      const g = new THREE.Group(); g.add(w);
      if (!back || i > 0) {
        const aw = M(rb(0.18, 0.01, 0.09, 0.003), awnM, 0, 0.135, 0.05); aw.rotation.x = 0.55; g.add(aw);
        g.add(M(rb(0.18, 0.025, 0.006, 0.002), awnM, 0, 0.098, 0.088));
      }
      g.position.set(x, y, back ? -zf : zf); if (back) g.rotation.y = Math.PI; root.add(g);
    }
  }
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) for (const z of [-0.2, 0.2]) {
    const w = windowUnit(kit, 0.15, 0.2, { trim: white, mullion: 'v' }); w.position.set(s * W / 2, B + 0.4 * i + 0.21, z); w.rotation.y = s * Math.PI / 2; root.add(w);
  }
  for (const s of [-1, 1]) root.add(roundWindow(kit, white, 0.05, s * (W / 2 - 0.004), B + WH + RH * 0.38, 0, s * Math.PI / 2));
  // entrance
  const accent = kit.mat('accent', P.accent, { rough: 0.4, clear: 0.6 });
  root.add(M(rb(0.56, 0.05, 0.27, 0.01), accent, 0, B + 0.43, zf + 0.135));
  for (const s of [-1, 1]) root.add(M(cyl(0.02, 0.02, 0.4, 12), white, s * 0.25, B + 0.2, zf + 0.24));
  const fas = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.04), new THREE.MeshStandardMaterial({ map: textTex('SEASIDE', 'SEASIDE HOTEL', { w: 1024, h: 80, bg: '#fbfaf5', fg: '#1f4f78', font: 'bold 56px Georgia, serif', border: null }), roughness: 0.6 }));
  fas.position.set(0, B + 0.43, zf + 0.2705); root.add(fas);
  const dw = windowUnit(kit, 0.26, 0.3, { trim: white, mullion: 'v', sill: false }); dw.position.set(0, B + 0.16, zf); root.add(dw);
  // flag
  const top = B + WH + RH + 0.04, px = -0.62;
  root.add(M(cyl(0.008, 0.008, 0.42, 8), white, px, top + 0.21, 0));
  root.add(M(sph(0.016, 12, 8), kit.gold(), px, top + 0.43, 0));
  const pivot = new THREE.Group(); pivot.position.set(px, top + 0.36, 0); root.add(pivot);
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.2, 0.045); sh.lineTo(0, 0.09); sh.closePath();
  const flagM = kit.mat('accent', shade(P.accent, 0.85), { rough: 0.8, clear: 0 }); flagM.side = THREE.DoubleSide;
  const flag = new THREE.Mesh(new THREE.ShapeGeometry(sh), flagM); flag.position.y = -0.045; pivot.add(flag);
  root.userData.tick = (t) => { pivot.rotation.y = Math.sin(t * 2.3) * 0.35 + 0.2; flag.scale.x = 1 + 0.08 * Math.sin(t * 5.1); };
  return root;
}

// ═════════════════════ DARK BLUE — Modern Villa / Art Deco Tower ═════════════════════
function villa(kit, P) {
  const root = new THREE.Group(), B = 0.06;
  const stoneL = kit.mat('base', 0xdcd5c8, { rough: 0.75, clear: 0.05, bump: T.stucco, rep: [2, 2], bs: 0.4 });
  root.add(M(rb(1.24, B, 1.0, 0.012), stoneL, 0, B / 2, 0));
  const white = kit.mat('wall', 0xf5f3ef, { rough: 0.6, clear: 0.2, bump: T.stucco, rep: [2, 1], bs: 0.35 });
  const navy = kit.mat('roof', P.accent, { rough: 0.32, clear: 0.85, ccr: 0.12 });
  const gold = kit.gold();
  root.add(M(rb(0.78, 0.4, 0.74, 0.008), white, -0.2, B + 0.2, -0.08));
  root.add(M(rb(0.88, 0.3, 0.7, 0.008), navy, 0.1, B + 0.55, -0.06));
  root.add(M(rb(0.9, 0.018, 0.72, 0.004), gold, 0.1, B + 0.709, -0.06));
  root.add(M(rb(0.79, 0.012, 0.75, 0.003), gold, -0.2, B + 0.4, -0.08));
  const c1 = curtain(kit, { w: 0.48, h: 0.3, cols: 3, frame: gold }); c1.position.set(-0.33, B + 0.18, 0.29); root.add(c1);
  const walnut = kit.mat('trim', 0x6b4a33, { rough: 0.45, clear: 0.7, bump: T.planksV, rep: [0.5, 1], bs: 0.5 });
  const door = doorUnit(kit, 0.12, 0.32, { trim: gold, panel: walnut, knob: false }); door.position.set(0.08, B + 0.16, 0.29); root.add(door);
  root.add(M(rb(0.008, 0.13, 0.012, 0.003), gold, 0.12, B + 0.16, 0.315));
  const c2 = curtain(kit, { w: 0.72, h: 0.13, cols: 6, frame: gold }); c2.position.set(0.1, B + 0.55, 0.29); root.add(c2);
  const c3 = curtain(kit, { w: 0.72, h: 0.13, cols: 6, frame: gold }); c3.position.set(0.1, B + 0.55, -0.41); c3.rotation.y = Math.PI; root.add(c3);
  const c4 = curtain(kit, { w: 0.5, h: 0.13, cols: 4, frame: gold }); c4.position.set(0.54, B + 0.55, -0.06); c4.rotation.y = Math.PI / 2; root.add(c4);
  const c5 = curtain(kit, { w: 0.1, h: 0.28, cols: 1, frame: gold }); c5.position.set(-0.59, B + 0.19, -0.08); c5.rotation.y = -Math.PI / 2; root.add(c5);
  // pool under cantilever
  root.add(M(rb(0.34, 0.03, 0.69, 0.008), white, 0.38, B + 0.015, 0.075));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.64), kit.glass({ always: true, color: 0x2fb7d6, glow: 0x30c8ff, intensity: 0.8 }));
  water.material.roughness = 0.02; water.rotation.x = -Math.PI / 2; water.position.set(0.38, B + 0.031, 0.075); root.add(water);
  root.add(M(cyl(0.018, 0.018, 0.4, 12), white, 0.5, B + 0.2, -0.36));
  // planters + topiary
  const pot = kit.mat('keep', 0x34312e, { rough: 0.6, clear: 0.2 });
  const leaf = kit.mat('keep', 0x46703a, { rough: 0.9, clear: 0, bump: T.stucco, bs: 3 });
  for (const [x, z] of [[-0.54, 0.4], [0.02, 0.42]]) { root.add(M(rb(0.09, 0.07, 0.09, 0.01), pot, x, B + 0.035, z)); root.add(M(sph(0.055, 16, 12), leaf, x, B + 0.12, z)); }
  const sky = M(rb(0.2, 0.03, 0.14, 0.006), kit.glass(), 0.25, B + 0.715, -0.2); root.add(sky);
  return root;
}
function deco(kit, P) {
  const root = new THREE.Group();
  const stone = kit.mat('base', 0xebe2cf, { rough: 0.6, clear: 0.15, bump: T.stucco, rep: [2, 1], bs: 0.4 });
  const navy = kit.mat('wall', P.accent, { rough: 0.32, clear: 0.85, ccr: 0.12 });
  const gold = kit.gold();
  const BH = 0.4;
  root.add(M(rb(1.5, BH, 1.0, 0.012), stone, 0, BH / 2, 0));
  root.add(M(rb(1.52, 0.03, 1.02, 0.006), gold, 0, BH - 0.035, 0));
  for (const x of [-0.45, 0.45]) { const c = curtain(kit, { w: 0.22, h: 0.18, cols: 2, frame: gold }); c.position.set(x, 0.17, 0.5); root.add(c); }
  const dg = curtain(kit, { w: 0.3, h: 0.22, cols: 3, frame: gold }); dg.position.set(0, 0.12, 0.5); root.add(dg);
  root.add(M(rb(0.46, 0.025, 0.16, 0.006), gold, 0, 0.27, 0.58));
  const tiers = [{ w: 1.24, h: 0.84, d: 0.8, cols: 8, rows: 6 }, { w: 0.94, h: 0.48, d: 0.62, cols: 6, rows: 3 }, { w: 0.62, h: 0.32, d: 0.44, cols: 4, rows: 2 }];
  let y = BH;
  tiers.forEach((t, i) => {
    root.add(M(rb(t.w, t.h, t.d, 0.01), navy, 0, y + t.h / 2, 0));
    for (const [pw, cols, pos, rot] of [
      [t.w, t.cols, [0, 0, t.d / 2 + 0.002], 0], [t.w, t.cols, [0, 0, -t.d / 2 - 0.002], Math.PI],
      [t.d, Math.max(2, Math.round(t.cols * t.d / t.w)), [t.w / 2 + 0.002, 0, 0], Math.PI / 2], [t.d, Math.max(2, Math.round(t.cols * t.d / t.w)), [-t.w / 2 - 0.002, 0, 0], -Math.PI / 2]]) {
      const seed = i * 10 + Math.round(rot * 10) + 5;
      const fm = kit.mat('wall', P.accent, { rough: 0.18, clear: 0.9, ccr: 0.08 });
      fm.map = facadeTex(cols, t.rows, seed, false); fm.emissive = new THREE.Color(0xffffff); fm.emissiveMap = facadeTex(cols, t.rows, seed, true);
      fm.userData.lit = 1.5; fm.emissiveIntensity = LIT.on ? 1.5 : 0; LIT.mats.add(fm);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.06, t.h - 0.06), fm);
      p.position.set(pos[0], y + t.h / 2, pos[2]); p.rotation.y = rot; root.add(p);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(M(rb(0.03, t.h, 0.03, 0.006), gold, sx * (t.w / 2 - 0.004), y + t.h / 2, sz * (t.d / 2 - 0.004)));
    root.add(M(rb(t.w + 0.03, 0.025, t.d + 0.03, 0.006), gold, 0, y + t.h + 0.0125, 0));
    if (i === 0) for (const sz of [1, -1]) for (let k = 1; k < t.cols; k++) {
      if (sz === 1 && k === t.cols / 2) continue;
      const x = -(t.w - 0.06) / 2 + (t.w - 0.06) * k / t.cols;
      root.add(M(rb(0.014, t.h - 0.06, 0.022, 0.004), gold, x, y + t.h / 2, sz * (t.d / 2 + 0.011)));
    }
    y += t.h + 0.025;
  });
  // vertical blade sign
  const t0 = tiers[0];
  root.add(M(rb(0.1, 0.62, 0.04, 0.008), navy, 0, BH + 0.43, t0.d / 2 + 0.03));
  root.add(M(rb(0.11, 0.015, 0.045, 0.004), gold, 0, BH + 0.745, t0.d / 2 + 0.03));
  root.add(M(rb(0.11, 0.015, 0.045, 0.004), gold, 0, BH + 0.115, t0.d / 2 + 0.03));
  const st = textTex('HOTELV', 'HOTEL', { w: 96, h: 640, bg: '#0d1a3a', fg: '#ffe2a0', font: 'bold 84px Georgia, serif', border: '#d6aa52', vertical: true });
  const signM = new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, roughness: 0.4 });
  signM.userData.lit = 1.4; signM.emissiveIntensity = LIT.on ? 1.4 : 0; LIT.mats.add(signM);
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.58), signM); sp.position.set(0, BH + 0.43, t0.d / 2 + 0.0505); root.add(sp);
  // crown + spire + beacon
  root.add(M(rb(0.4, 0.08, 0.3, 0.008), navy, 0, y + 0.04, 0));
  root.add(M(rb(0.26, 0.07, 0.2, 0.008), gold, 0, y + 0.115, 0));
  root.add(M(cone(0.045, 0.36, 16), gold, 0, y + 0.15 + 0.18, 0));
  const beaconM = new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.3 });
  root.add(M(sph(0.022, 16, 12), beaconM, 0, y + 0.15 + 0.36 + 0.012, 0));
  root.userData.tick = (t) => { const on = Math.sin(t * 3.2) > 0.55; beaconM.emissiveIntensity = on ? (LIT.on ? 5 : 1.2) : 0; };
  return root;
}

// ═════════════════════ PINK — Painted Lady / Victorian Grand Hotel ═════════════════════
function turret(kit, { r, h, wall, trim, roofColor, coneH, x, z, y0 }) {
  const g = new THREE.Group();
  g.add(M(cyl(r, r, h, 22), wall, x, y0 + h / 2, z));
  g.add(M(cyl(r + 0.016, r + 0.016, 0.03, 22), trim, x, y0 + h, z));
  const cr = r + 0.045;
  g.add(M(cone(cr, coneH, 22), surfMat(kit, 'scales', roofColor, Math.hypot(cr, coneH), 2 * Math.PI * cr, false), x, y0 + h + 0.015 + coneH / 2, z));
  const gold = kit.gold();
  g.add(M(sph(0.016, 12, 8), gold, x, y0 + h + coneH + 0.03, z));
  g.add(M(cyl(0.004, 0.004, 0.07, 6), gold, x, y0 + h + coneH + 0.07, z));
  return g;
}
function turretWindow(kit, trim, tx, tz, r, a, y, w = 0.08, h = 0.16) {
  const win = windowUnit(kit, w, h, { trim, mullion: 'h' }); win.position.set(tx + Math.sin(a) * (r + 0.005), y, tz + Math.cos(a) * (r + 0.005)); win.rotation.y = a; return win;
}
function victorian(kit, P) {
  const root = new THREE.Group(), B = 0.07;
  const stone = kit.mat('base', 0x9a8f86, { rough: 0.9, clear: 0, bump: T.stones, rep: [2.5, 0.4], bs: 2.5 });
  root.add(M(rb(0.86, B, 0.72, 0.015), stone, -0.02, B / 2, 0));
  const wc = 0xf7e2ea;
  const W = 0.62, D = 0.66, WH = 0.66, RH = 0.42, bx = -0.1, zf = D / 2;
  const clap = kit.mat('wall', wc, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [1, WH * 2], bs: 1.6 });
  const clapG = kit.mat('wall', wc, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [2, 2], bs: 1.6 });
  const body = gable(kit, { w: W, d: D, wallH: WH, roofH: RH, wall: clap, gableWall: clapG, roofColor: P.accent, roofKind: 'scales', over: 0.06, thick: 0.045 });
  body.position.set(bx, B, 0); root.add(body);
  const trim = kit.mat('trim', 0xffffff, { rough: 0.4, clear: 0.4 });
  const deep = kit.mat('accent', shade(P.accent, 0.62), { rough: 0.45, clear: 0.5, bump: T.planksV, bs: 0.8 });
  // corner turret
  const tx = 0.24, tz = 0.17, tr = 0.14, TH = 0.84;
  const tw = kit.mat('wall', wc, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [3, TH * 2], bs: 1.6 });
  root.add(turret(kit, { r: tr, h: TH, wall: tw, trim, roofColor: P.accent, coneH: 0.4, x: tx, z: tz, y0: B }));
  root.add(M(cyl(tr + 0.008, tr + 0.008, 0.02, 22), trim, tx, B + 0.42, tz));
  for (const a of [0.3, 1.0, 1.7]) for (const y of [B + 0.22, B + 0.6]) root.add(turretWindow(kit, trim, tx, tz, tr, a, y));
  // wraparound porch
  const deckM = kit.mat('base', 0xe9e2d8, { rough: 0.7, clear: 0.1, bump: T.planksH, rep: [1.5, 1], bs: 1 });
  const pz = zf + 0.11, pzF = zf + 0.2;
  root.add(M(rb(0.88, 0.035, 0.22, 0.008), deckM, -0.02, B + 0.0175, pz));
  const proof = M(rb(0.92, 0.025, 0.27, 0.006), surfMat(kit, 'scales', P.accent, 0.27, 0.92, false), -0.02, B + 0.37, pz + 0.01); proof.rotation.x = 0.22; root.add(proof);
  for (let i = 0; i < 5; i++) root.add(M(cyl(0.011, 0.011, 0.32, 8), trim, -0.44 + i * 0.205, B + 0.195, pzF));
  root.add(M(rb(0.86, 0.018, 0.016, 0.004), trim, -0.02, B + 0.33, pzF));
  for (let i = 0; i < 20; i++) root.add(M(rb(0.006, 0.03, 0.006, 0.002), trim, -0.43 + i * 0.043, B + 0.305, pzF));
  for (const [x0, x1] of [[-0.44, -0.33], [-0.17, 0.38]]) { const b = balustrade(kit, x1 - x0, 0.11, trim, Math.round((x1 - x0) * 60)); b.position.set((x0 + x1) / 2, B + 0.035, pzF); root.add(b); }
  for (let i = 0; i < 2; i++) root.add(M(rb(0.16, 0.03, 0.06, 0.006), deckM, -0.25, 0.045 - i * 0.03, zf + 0.25 + i * 0.05));
  const door = doorUnit(kit, 0.14, 0.29, { trim, panel: deep, glassTop: true }); door.position.set(-0.25, B + 0.035 + 0.145, zf); root.add(door);
  const w1 = windowUnit(kit, 0.11, 0.22, { trim, mullion: 'h' }); w1.position.set(-0.04, B + 0.2, zf); root.add(w1);
  for (const x of [-0.24, -0.02]) {
    const w = windowUnit(kit, 0.1, 0.2, { trim, mullion: 'h' }); w.position.set(x, B + 0.53, zf); root.add(w);
    root.add(M(rb(0.14, 0.022, 0.04, 0.005), deep, x, B + 0.645, zf + 0.02));
  }
  // gable sunburst
  const sun = new THREE.Mesh(circle(0.075, 18, 0, Math.PI), deep); sun.position.set(bx, B + WH + 0.03, zf + 0.002); root.add(sun);
  for (let i = 1; i < 6; i++) { const sp = M(rb(0.006, 0.07, 0.006, 0.002), trim, bx, B + WH + 0.03, zf + 0.006); sp.rotation.z = i * Math.PI / 6 - Math.PI / 2; sp.position.x += Math.cos(i * Math.PI / 6) * 0.035; sp.position.y += Math.sin(i * Math.PI / 6) * 0.035; root.add(sp); }
  root.add(M(torus(0.075, 0.008, 6, 20, Math.PI), trim, bx, B + WH + 0.03, zf + 0.004));
  for (const y of [B + 0.22, B + 0.53]) { const w = windowUnit(kit, 0.12, 0.2, { trim }); w.position.set(bx - W / 2, y, 0); w.rotation.y = -Math.PI / 2; root.add(w); }
  for (const y of [B + 0.22, B + 0.53]) { const w = windowUnit(kit, 0.12, 0.2, { trim }); w.position.set(bx, y, -zf); w.rotation.y = Math.PI; root.add(w); }
  const brick = kit.mat('base', 0x9a5a44, { rough: 0.85, clear: 0, bump: T.bricks, rep: [0.7, 1.6], bs: 2 });
  const cx = -0.17, top = B + WH + RH + 0.12, bot = B + body.userData.roofY(cx) - 0.07;
  root.add(M(rb(0.11, top - bot, 0.11, 0.008), brick, bx + cx, (top + bot) / 2, -0.14));
  root.add(M(rb(0.14, 0.03, 0.14, 0.006), stone, bx + cx, top + 0.015, -0.14));
  root.add(lantern(kit, -0.14, B + 0.27, zf));
  return root;
}
function grandVictorian(kit, P) {
  const root = new THREE.Group(), B = 0.07;
  const W = 1.3, D = 0.78, WH = 0.99, RH = 0.4, zf = D / 2, FL = 0.33;
  const stone = kit.mat('base', 0x9a8f86, { rough: 0.9, clear: 0, bump: T.stones, rep: [4, 0.4], bs: 2.5 });
  root.add(M(rb(1.66, B, 1.0, 0.015), stone, 0, B / 2, 0.04));
  const wc = 0xf7e6ec;
  const clap = kit.mat('wall', wc, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [1, WH * 2], bs: 1.6 });
  const clapG = kit.mat('wall', wc, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [2, 2], bs: 1.6 });
  const body = gable(kit, { w: D, d: W, wallH: WH, roofH: RH, wall: clap, gableWall: clapG, roofColor: P.accent, roofKind: 'scales', over: 0.07, thick: 0.05 });
  body.rotation.y = Math.PI / 2; body.position.y = B; root.add(body);
  const trim = kit.mat('trim', 0xffffff, { rough: 0.4, clear: 0.4 });
  const deep = kit.mat('accent', shade(P.accent, 0.62), { rough: 0.45, clear: 0.5, bump: T.planksV, bs: 0.8 });
  const deckM = kit.mat('base', 0xe9e2d8, { rough: 0.7, clear: 0.1, bump: T.planksH, rep: [3, 1], bs: 1 });
  // turrets at front corners
  const tw = kit.mat('wall', wc, { rough: 0.6, clear: 0.2, bump: T.clapboard, rep: [3, 2.4], bs: 1.6 });
  const tr = 0.17, TH = 1.18, tz = 0.26;
  for (const s of [-1, 1]) {
    const tx = s * 0.66;
    root.add(turret(kit, { r: tr, h: TH, wall: tw, trim, roofColor: P.accent, coneH: 0.5, x: tx, z: tz, y0: B }));
    for (let f = 0; f < 3; f++) for (const a of [0.35, 1.25]) root.add(turretWindow(kit, trim, tx, tz, tr, s * a, B + f * FL + 0.18, 0.08, 0.17));
    for (let f = 1; f < 3; f++) root.add(M(cyl(tr + 0.008, tr + 0.008, 0.018, 22), trim, tx, B + f * FL, tz));
  }
  const fp = flagPole(kit, shade(P.accent, 0.8), 0.22); fp.group.position.set(0.66, B + TH + 0.6, tz); root.add(fp.group); addTick(root, fp.tick);
  // three-level veranda
  const vz = zf + 0.09, vzF = zf + 0.17, VW = 1.12;
  root.add(M(rb(VW, 0.03, 0.2, 0.006), deckM, 0, B + 0.015, vz));
  for (let k = 1; k <= 2; k++) {
    const y = B + k * FL;
    root.add(M(rb(VW, 0.025, 0.19, 0.006), deckM, 0, y + 0.0125, vz));
    const b = balustrade(kit, VW, 0.1, trim, 64); b.position.set(0, y + 0.025, vzF); root.add(b);
  }
  const vr = M(rb(VW + 0.04, 0.025, 0.24, 0.006), surfMat(kit, 'scales', P.accent, 0.24, VW, false), 0, B + WH - 0.02, vz + 0.02); vr.rotation.x = 0.22; root.add(vr);
  for (let k = 0; k < 3; k++) for (let i = 0; i < 8; i++) {
    const x = -VW / 2 + 0.03 + i * (VW - 0.06) / 7;
    root.add(M(cyl(0.01, 0.01, FL - 0.02, 8), trim, x, B + k * FL + FL / 2 + 0.01, vzF));
  }
  for (let k = 0; k < 3; k++) root.add(M(rb(VW, 0.02, 0.014, 0.004), trim, 0, B + (k + 1) * FL - 0.03, vzF));
  // windows behind the veranda
  const cols = [-0.4, -0.2, 0, 0.2, 0.4];
  for (let f = 0; f < 3; f++) for (const x of cols) {
    if (f === 0 && x === 0) continue;
    const w = windowUnit(kit, 0.1, 0.19, { trim, mullion: 'h' }); w.position.set(x, B + f * FL + 0.17, zf); root.add(w);
  }
  const door = doorUnit(kit, 0.16, 0.25, { trim, panel: deep, glassTop: true }); door.position.set(0, B + 0.03 + 0.125, zf); root.add(door);
  root.add(lantern(kit, -0.12, B + 0.2, zf)); root.add(lantern(kit, 0.12, B + 0.2, zf));
  // back + sides: punched facades
  const back = facadePlane(kit, W - 0.06, WH - 0.06, 7, 3, 41, wc); back.position.set(0, B + WH / 2, -zf - 0.003); back.rotation.y = Math.PI; root.add(back);
  for (const s of [-1, 1]) { const sp = facadePlane(kit, D - 0.46, WH - 0.06, 2, 3, 43 + s, wc); sp.position.set(s * (W / 2 + 0.003), B + WH / 2, -0.15); sp.rotation.y = s * Math.PI / 2; root.add(sp); }
  // dormers + sign
  for (const x of [-0.32, 0, 0.32]) { const d = dormer(kit, { w: 0.14, h: 0.12, d: 0.16, wall: clap, trim, roofColor: P.accent, roofKind: 'scales' }); d.position.set(x, B + WH + 0.05, frustumZ(D, RH, 0, 0.05) - 0.08 + 0.03); root.add(d); }
  const sign = new THREE.MeshStandardMaterial({ map: textTex('ROSEMONT', 'THE ROSEMONT', { w: 1024, h: 150, bg: '#fbf4f6', fg: css(shade(P.accent, 0.55)), font: 'bold 92px Georgia, serif', border: css(shade(P.accent, 0.55)) }), roughness: 0.5 });
  root.add(M(rb(0.44, 0.075, 0.02, 0.005), deep, 0, B + WH + 0.005, vzF + 0.035));
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.062), sign); sp.position.set(0, B + WH + 0.005, vzF + 0.046); root.add(sp);
  return root;
}

// ═════════════════════ ORANGE — Brownstone / Downtown Hotel ═════════════════════
function brownstone(kit, P) {
  const root = new THREE.Group();
  const W = 0.62, D = 0.74, GB = 0.14, WH = 0.68, zf = D / 2;
  const brown = kit.mat('wall', 0x7b4b37, { rough: 0.82, clear: 0.05, bump: T.stucco, rep: [2, 2], bs: 1 });
  const rust = kit.mat('base', 0x6a3f2e, { rough: 0.85, clear: 0, bump: T.planksH, rep: [1, 0.5], bs: 2 });
  const cream = kit.mat('trim', 0xe9dcc2, { rough: 0.5, clear: 0.3 });
  const iron = kit.iron();
  root.add(M(rb(W, GB, D, 0.01), rust, 0, GB / 2, 0));
  root.add(M(rb(W, WH, D, 0.01), brown, 0, GB + WH / 2, 0));
  root.add(M(rb(W + 0.06, 0.05, D + 0.04, 0.008), cream, 0, GB + WH + 0.025, 0));
  for (let i = 0; i < 12; i++) root.add(M(rb(0.022, 0.02, 0.016, 0.003), cream, -W / 2 + 0.03 + i * (W - 0.06) / 11, GB + WH - 0.012, zf + 0.01));
  for (const s of [-1, 1]) root.add(M(rb(0.03, 0.07, 0.04, 0.005), cream, s * (W / 2 - 0.015), GB + WH - 0.035, zf + 0.02));
  const MH = 0.28, top = 0.74;
  const mans = frustumRoof(kit, 'shingle', P.accent, W + 0.04, D + 0.02, MH, top); mans.position.y = GB + WH + 0.05; root.add(mans);
  root.add(M(rb((W + 0.04) * top, 0.02, (D + 0.02) * top, 0.004), kit.mat('keep', 0x2e2a28, { rough: 0.7, clear: 0 }), 0, GB + WH + 0.05 + MH + 0.01, 0));
  for (const x of [-0.14, 0.14]) {
    const d = dormer(kit, { w: 0.11, h: 0.11, d: 0.12, wall: cream, trim: cream, roofColor: P.accent });
    d.position.set(x, GB + WH + 0.09, frustumZ(D + 0.02, MH, top, 0.04) - 0.05); root.add(d);
  }
  // stoop
  const doorX = -0.15;
  for (let i = 0; i < 5; i++) { const h = GB - i * 0.028; root.add(M(rb(0.2, h, 0.055, 0.004), brown, doorX, h / 2, zf + 0.0275 + i * 0.055)); }
  for (const s of [-1, 1]) {
    const x = doorX + s * 0.105, dz = 0.275, dy = GB, L = Math.hypot(dz, dy);
    const rail = M(rb(0.01, L, 0.01, 0.003), iron, x, 0.1 + dy / 2, zf + dz / 2); rail.rotation.x = Math.atan2(-dz, dy); root.add(rail);
    root.add(M(cyl(0.008, 0.008, 0.13, 8), iron, x, 0.065, zf + dz + 0.01));
    root.add(M(sph(0.012, 8, 6), iron, x, 0.135, zf + dz + 0.01));
  }
  const wood = kit.mat('accent', 0x4a2a1a, { rough: 0.45, clear: 0.6, bump: T.planksV, bs: 0.8 });
  const door = doorUnit(kit, 0.13, 0.27, { trim: cream, panel: wood, glassTop: true }); door.position.set(doorX, GB + 0.135, zf); root.add(door);
  for (const s of [-1, 1]) root.add(M(rb(0.025, 0.31, 0.02, 0.004), cream, doorX + s * 0.1, GB + 0.155, zf + 0.01));
  root.add(M(rb(0.25, 0.035, 0.035, 0.005), cream, doorX, GB + 0.325, zf + 0.015));
  // bay window
  root.add(M(rb(0.26, 0.34, 0.1, 0.006), brown, 0.15, GB + 0.17, zf + 0.05));
  const bw = windowUnit(kit, 0.18, 0.22, { trim: cream, mullion: 'v' }); bw.position.set(0.15, GB + 0.18, zf + 0.1); root.add(bw);
  for (const s of [-1, 1]) { const sw = windowUnit(kit, 0.05, 0.2, { trim: cream, mullion: 'none', sill: false }); sw.position.set(0.15 + s * 0.13, GB + 0.18, zf + 0.05); sw.rotation.y = s * Math.PI / 2; root.add(sw); }
  root.add(M(rb(0.29, 0.025, 0.12, 0.005), cream, 0.15, GB + 0.35, zf + 0.055));
  for (const x of [doorX, 0.15]) {
    const w = windowUnit(kit, 0.13, 0.2, { trim: cream, mullion: 'h' }); w.position.set(x, GB + 0.52, zf); root.add(w);
    root.add(M(rb(0.17, 0.03, 0.03, 0.005), cream, x, GB + 0.635, zf + 0.012));
  }
  const gw = windowUnit(kit, 0.14, 0.08, { trim: cream, mullion: 'v', sill: false }); gw.position.set(0.15, GB / 2, zf); root.add(gw);
  root.add(lantern(kit, doorX + 0.13, GB + 0.22, zf));
  for (const s of [-1, 1]) for (const y of [GB + 0.2, GB + 0.52]) { const w = windowUnit(kit, 0.11, 0.18, { trim: cream }); w.position.set(s * W / 2, y, -0.12); w.rotation.y = s * Math.PI / 2; root.add(w); }
  const back = facadePlane(kit, W - 0.08, WH - 0.08, 2, 2, 51, 0x7b4b37); back.position.set(0, GB + WH / 2, -zf - 0.003); back.rotation.y = Math.PI; root.add(back);
  return root;
}
function cityHotel(kit, P) {
  const root = new THREE.Group();
  const W = 1.3, D = 0.86, H = 1.37, GF = 0.38, FL = 0.33, zf = D / 2;
  const brick = kit.mat('wall', 0xffffff, { rough: 0.82, clear: 0.05, bump: T.bricks, map: T.bricksC, rep: [3.5, 5], bs: 1.8 });
  const cream = kit.mat('trim', 0xe9dcc2, { rough: 0.5, clear: 0.3 });
  const iron = kit.iron(), gold = kit.gold();
  root.add(M(rb(W, H, D, 0.01), brick, 0, H / 2, 0));
  root.add(M(rb(W + 0.02, 0.04, D + 0.02, 0.006), cream, 0, 0.02, 0));
  root.add(M(rb(W + 0.02, 0.03, D + 0.02, 0.006), cream, 0, GF, 0));
  // storefront
  for (const x of [-0.42, 0.42]) { const c = curtain(kit, { w: 0.3, h: 0.24, cols: 3, frame: iron }); c.position.set(x, 0.18, zf); root.add(c); }
  const dc = curtain(kit, { w: 0.22, h: 0.26, cols: 2, frame: gold }); dc.position.set(0, 0.15, zf); root.add(dc);
  // marquee with chasing bulbs
  const dark = kit.mat('keep', 0x2a1c14, { rough: 0.5, clear: 0.4 });
  root.add(M(rb(0.52, 0.09, 0.18, 0.008), dark, 0, 0.33, zf + 0.09));
  const mt = textTex('HOTELM', 'HOTEL', { w: 512, h: 96, bg: '#2a1c14', fg: '#ffd27a', font: 'bold 70px Georgia, serif', border: null });
  const mm = new THREE.MeshStandardMaterial({ map: mt, emissiveMap: mt, emissive: 0xffffff, roughness: 0.4 }); mm.userData.lit = 1.6; mm.emissiveIntensity = LIT.on ? 1.6 : 0.25; LIT.mats.add(mm);
  const mp = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.06), mm); mp.position.set(0, 0.335, zf + 0.181); root.add(mp);
  const bulbA = new THREE.MeshStandardMaterial({ color: 0x664422, emissive: 0xffcf70 }), bulbB = bulbA.clone();
  const bulbG = sph(0.008, 8, 6);
  for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(bulbG, i % 2 ? bulbA : bulbB); b.position.set(-0.24 + i * 0.032, 0.28, zf + 0.181); root.add(b); }
  addTick(root, (t) => { const ph = Math.floor(t * 4) % 2, hi = LIT.on ? 4 : 1.2; bulbA.emissiveIntensity = ph ? hi : 0.1; bulbB.emissiveIntensity = ph ? 0.1 : hi; });
  // upper floors
  for (let f = 0; f < 3; f++) for (const x of [-0.45, -0.15, 0.15, 0.45]) {
    const y = GF + 0.165 + f * FL;
    const w = windowUnit(kit, 0.13, 0.2, { trim: cream, mullion: 'h' }); w.position.set(x, y, zf); root.add(w);
    root.add(M(rb(0.17, 0.03, 0.03, 0.005), cream, x, y + 0.115, zf + 0.012));
  }
  for (const s of [-1, 1]) for (let f = 0; f < 3; f++) for (const z of [-0.2, 0.2]) {
    const w = windowUnit(kit, 0.12, 0.2, { trim: cream, mullion: 'h' }); w.position.set(s * W / 2, GF + 0.165 + f * FL, z); w.rotation.y = s * Math.PI / 2; root.add(w);
  }
  const back = facadePlane(kit, W - 0.08, H - 0.1, 6, 4, 61, 0xb0563c); back.position.set(0, H / 2, -zf - 0.003); back.rotation.y = Math.PI; root.add(back);
  // fire escape
  const fx = 0.3, fz = zf + 0.065;
  for (let f = 0; f < 3; f++) {
    const y = GF + f * FL + 0.005;
    root.add(M(rb(0.46, 0.012, 0.13, 0.002), iron, fx, y, fz));
    const b = balustrade(kit, 0.46, 0.09, iron, 14); b.position.set(fx, y, zf + 0.128); root.add(b);
    for (const s of [-1, 1]) root.add(M(rb(0.008, 0.09, 0.13, 0.002), iron, fx + s * 0.23, y + 0.045, fz));
    if (f < 2) {
      const dir = f % 2 ? -1 : 1, x0 = fx - dir * 0.15, x1 = fx + dir * 0.15, dy = FL - 0.01, L = Math.hypot(x1 - x0, dy);
      const lad = M(rb(0.028, L, 0.01, 0.002), iron, (x0 + x1) / 2, y + dy / 2, fz - 0.02); lad.rotation.z = -Math.atan2(x1 - x0, dy); root.add(lad);
    }
  }
  root.add(M(rb(0.028, 0.16, 0.01, 0.002), iron, fx + 0.17, GF - 0.08, fz + 0.03));
  // cornice + mansard + water tower
  root.add(M(rb(W + 0.06, 0.06, D + 0.06, 0.008), cream, 0, H + 0.03, 0));
  for (let i = 0; i < 22; i++) root.add(M(rb(0.022, 0.02, 0.016, 0.003), cream, -W / 2 + 0.03 + i * (W - 0.06) / 21, H - 0.012, zf + 0.01));
  const MH = 0.3, top = 0.72, my = H + 0.06;
  const mans = frustumRoof(kit, 'shingle', P.accent, W + 0.02, D + 0.02, MH, top); mans.position.y = my; root.add(mans);
  const tar = kit.mat('keep', 0x34302c, { rough: 0.85, clear: 0 });
  root.add(M(rb((W + 0.02) * top, 0.02, (D + 0.02) * top, 0.004), tar, 0, my + MH + 0.01, 0));
  for (const x of [-0.35, 0, 0.35]) {
    const d = dormer(kit, { w: 0.12, h: 0.12, d: 0.12, wall: cream, trim: cream, roofColor: P.accent });
    d.position.set(x, my + 0.04, frustumZ(D + 0.02, MH, top, 0.04) - 0.05); root.add(d);
  }
  const ty = my + MH + 0.02, tx = 0.22, tz = -0.08;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(M(cyl(0.007, 0.007, 0.12, 6), iron, tx + sx * 0.07, ty + 0.06, tz + sz * 0.07));
  root.add(M(rb(0.2, 0.012, 0.2, 0.003), iron, tx, ty + 0.126, tz));
  const stave = kit.mat('keep', 0x8a6a4a, { rough: 0.8, clear: 0.05, bump: T.planksV, rep: [5, 1], bs: 1.5 });
  root.add(M(cyl(0.09, 0.095, 0.17, 20), stave, tx, ty + 0.132 + 0.085, tz));
  for (const y of [0.03, 0.085, 0.14]) { const h = M(torus(0.094, 0.004, 6, 24), iron, tx, ty + 0.132 + y, tz); h.rotation.x = Math.PI / 2; root.add(h); }
  root.add(M(cone(0.1, 0.08, 20), kit.mat('keep', 0x5a4030, { rough: 0.8, clear: 0 }), tx, ty + 0.132 + 0.17 + 0.04, tz));
  return root;
}

// ═════════════════════ RED — Alpine Chalet / Ski Lodge ═════════════════════
function roofStones(kit, root, body, xs, zs, baseY, stone) {
  for (let i = 0; i < xs.length; i++) {
    const s = M(sph(0.03, 10, 8), stone, xs[i], baseY + body.userData.roofY(xs[i]) + 0.055, zs[i]);
    s.scale.set(1, 0.6, 1.1); root.add(s);
  }
}
function chalet(kit, P) {
  const root = new THREE.Group();
  const W = 0.84, D = 0.7, SB = 0.24, WH = 0.3, RH = 0.26, zf = D / 2;
  const stone = kit.mat('base', 0xa8a198, { rough: 0.9, clear: 0, bump: T.stones, rep: [2.5, 1.2], bs: 2.8 });
  root.add(M(rb(W, SB, D, 0.015), stone, 0, SB / 2, 0));
  const wood = kit.mat('wall', 0x9a6438, { rough: 0.7, clear: 0.15, bump: T.planksH, rep: [1, 1.2], bs: 1.4 });
  const woodG = kit.mat('wall', 0x9a6438, { rough: 0.7, clear: 0.15, bump: T.planksH, rep: [2, 3], bs: 1.4 });
  const body = gable(kit, { w: W - 0.02, d: D - 0.02, wallH: WH, roofH: RH, wall: wood, gableWall: woodG, roofColor: P.accent, over: 0.15, thick: 0.05 });
  body.position.y = SB; root.add(body);
  const trim = kit.mat('trim', 0xf3ead8, { rough: 0.5, clear: 0.3 });
  const dark = kit.mat('accent', 0x5a3a22, { rough: 0.7, clear: 0.1, bump: T.planksV, bs: 0.8 });
  const red = kit.mat('accent', P.accent, { rough: 0.5, clear: 0.4, bump: T.planksV, bs: 0.8 });
  // balcony
  const bz = zf + 0.07;
  root.add(M(rb(W + 0.06, 0.025, 0.15, 0.006), dark, 0, SB + 0.0125, bz));
  const bal = balustrade(kit, W + 0.06, 0.11, dark, 26); bal.position.set(0, SB + 0.025, bz + 0.07); root.add(bal);
  for (const s of [-1, 1]) { const sb = balustrade(kit, 0.14, 0.11, dark, 5); sb.position.set(s * (W / 2 + 0.03), SB + 0.025, bz); sb.rotation.y = Math.PI / 2; root.add(sb); }
  root.add(M(rb(W * 0.85, 0.035, 0.045, 0.006), red, 0, SB + 0.155, bz + 0.075));
  flowers(kit, root, -W * 0.4, W * 0.4, SB + 0.18, bz + 0.075, 12, [0xd8342c, 0xffffff, 0xd8342c, 0xf2c94c]);
  for (const x of [-0.3, 0, 0.3]) { const br = M(rb(0.025, 0.12, 0.025, 0.004), dark, x, SB - 0.045, zf + 0.04); br.rotation.x = 0.7; root.add(br); }
  for (const s of [-1, 1]) { const w = windowUnit(kit, 0.13, 0.16, { trim, shutter: red }); w.position.set(s * 0.2, SB + 0.17, zf - 0.01); root.add(w); }
  const gw = windowUnit(kit, 0.09, 0.08, { trim, mullion: 'v' }); gw.position.set(0, SB + WH + 0.09, zf - 0.016); root.add(gw);
  // ground floor (stone)
  const door = doorUnit(kit, 0.16, 0.19, { trim: dark, panel: dark }); door.position.set(0, 0.095, zf); root.add(door);
  for (const s of [-1, 1]) { const w = windowUnit(kit, 0.11, 0.1, { trim, shutter: red }); w.position.set(s * 0.27, 0.13, zf); root.add(w); }
  for (const s of [-1, 1]) { const w = windowUnit(kit, 0.12, 0.13, { trim, shutter: red }); w.position.set(s * (W / 2 - 0.01), SB + 0.15, 0); w.rotation.y = s * Math.PI / 2; root.add(w); }
  const rs = kit.mat('keep', 0x8e8a84, { rough: 0.9, clear: 0, bump: T.stucco, bs: 2 });
  roofStones(kit, root, body, [-0.28, -0.14, 0.16, 0.3, -0.22, 0.24], [0.22, -0.1, 0.18, -0.2, -0.3, 0.02], SB, rs);
  const top = SB + WH + RH + 0.12, bot = SB + body.userData.roofY(0.2) - 0.06;
  root.add(M(rb(0.13, top - bot, 0.13, 0.012), stone, 0.2, (top + bot) / 2, -0.16));
  root.add(M(rb(0.17, 0.03, 0.17, 0.008), dark, 0.2, top + 0.015, -0.16));
  const logM = kit.mat('keep', 0xb08458, { rough: 0.85, clear: 0, bump: T.planksH, bs: 1 });
  const lg = cyl(0.022, 0.022, 0.24, 10);
  [[0, 0], [0.045, 0], [0.09, 0], [0.0225, 0.04], [0.0675, 0.04], [0.045, 0.08]].forEach(([o, y]) => { const l = M(lg, logM, -W / 2 - 0.025 - o, 0.022 + y, -0.1); l.rotation.x = Math.PI / 2; root.add(l); });
  root.add(lantern(kit, 0.12, 0.17, zf));
  return root;
}
function lodge(kit, P) {
  const root = new THREE.Group();
  const W = 1.5, D = 0.82, SB = 0.3, WH = 0.62, RH = 0.38, zf = D / 2;
  const stone = kit.mat('base', 0xa8a198, { rough: 0.9, clear: 0, bump: T.stones, rep: [4.5, 1.6], bs: 2.8 });
  root.add(M(rb(W, SB, D, 0.015), stone, 0, SB / 2, 0));
  const wood = kit.mat('wall', 0x9a6438, { rough: 0.7, clear: 0.15, bump: T.planksH, rep: [1, 2.4], bs: 1.4 });
  const woodG = kit.mat('wall', 0x9a6438, { rough: 0.7, clear: 0.15, bump: T.planksH, rep: [2, 3], bs: 1.4 });
  const body = gable(kit, { w: D, d: W, wallH: WH, roofH: RH, wall: wood, gableWall: woodG, roofColor: P.accent, over: 0.14, thick: 0.055 });
  body.rotation.y = Math.PI / 2; body.position.y = SB; root.add(body);
  const trim = kit.mat('trim', 0xf3ead8, { rough: 0.5, clear: 0.3 });
  const dark = kit.mat('accent', 0x5a3a22, { rough: 0.7, clear: 0.1, bump: T.planksV, bs: 0.8 });
  const red = kit.mat('accent', P.accent, { rough: 0.5, clear: 0.4, bump: T.planksV, bs: 0.8 });
  // glass great-room cross gable
  const cz = zf + 0.12, cd = 0.36;
  root.add(M(rb(0.56, SB, cd, 0.012), stone, 0, SB / 2, cz));
  const glass = kit.glass({ always: true, intensity: 1.3 });
  const cg = gable(kit, { w: 0.54, d: cd, wallH: WH, roofH: 0.36, wall: wood, gableWall: glass, roofColor: P.accent, over: 0.08, thick: 0.05 });
  cg.position.set(0, SB, cz); root.add(cg);
  const czf = cz + cd / 2;
  const cc = curtain(kit, { w: 0.46, h: 0.54, cols: 4, frame: dark, glass }); cc.position.set(0, SB + 0.3, czf); root.add(cc);
  root.add(M(rb(0.022, 0.32, 0.022, 0.004), dark, 0, SB + WH + 0.15, czf - 0.001));
  root.add(M(rb(0.5, 0.022, 0.022, 0.004), dark, 0, SB + WH + 0.01, czf));
  // entrance + sign
  const dd = doorUnit(kit, 0.2, 0.21, { trim: dark, panel: dark, glassTop: true }); dd.position.set(0, 0.105, czf); root.add(dd);
  root.add(M(rb(0.32, 0.06, 0.02, 0.005), dark, 0, 0.26, czf + 0.012));
  const st = new THREE.MeshStandardMaterial({ map: textTex('LODGE', 'ALPINE LODGE', { w: 1024, h: 180, bg: '#3e2716', fg: '#f3e3c3', font: 'bold 104px Georgia, serif', border: '#c9a24a' }), roughness: 0.55 });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.052), st); sp.position.set(0, 0.26, czf + 0.0225); root.add(sp);
  root.add(lantern(kit, -0.16, 0.18, czf)); root.add(lantern(kit, 0.16, 0.18, czf));
  // wings: balconies + shuttered windows
  for (const s of [-1, 1]) {
    const cx = s * 0.51;
    for (const k of [0, 1]) {
      const y = SB + k * 0.31;
      root.add(M(rb(0.44, 0.025, 0.13, 0.006), dark, cx, y + 0.0125, zf + 0.065));
      const b = balustrade(kit, 0.44, 0.1, dark, 14); b.position.set(cx, y + 0.025, zf + 0.125); root.add(b);
      for (const x of [cx - 0.12, cx + 0.12]) { const w = windowUnit(kit, 0.12, 0.17, { trim, shutter: red }); w.position.set(x, y + 0.165, zf); root.add(w); }
    }
    for (const x of [cx - 0.14, cx + 0.14]) { const w = windowUnit(kit, 0.12, 0.12, { trim, shutter: red }); w.position.set(x, 0.16, zf); root.add(w); }
    const sw = windowUnit(kit, 0.12, 0.16, { trim, shutter: red }); sw.position.set(s * W / 2, SB + 0.46, 0.15); sw.rotation.y = s * Math.PI / 2; root.add(sw);
  }
  for (const x of [-0.5, 0, 0.5]) { const w = windowUnit(kit, 0.12, 0.17, { trim }); w.position.set(x, SB + 0.46, -zf); w.rotation.y = Math.PI; root.add(w); }
  // exterior stone chimney
  const ch = SB + WH + RH + 0.22;
  root.add(M(rb(0.17, ch, 0.22, 0.015), stone, -W / 2 - 0.07, ch / 2, -0.06));
  root.add(M(rb(0.21, 0.035, 0.26, 0.008), dark, -W / 2 - 0.07, ch + 0.017, -0.06));
  const rs = kit.mat('keep', 0x8e8a84, { rough: 0.9, clear: 0, bump: T.stucco, bs: 2 });
  for (const [x, z] of [[-0.55, 0.2], [-0.3, -0.18], [0.35, 0.22], [0.6, -0.12]]) {
    const y = SB + WH + RH * (1 - Math.abs(z) / (D / 2)) + 0.06;
    const s = M(sph(0.035, 10, 8), rs, x, y, z); s.scale.set(1.1, 0.6, 1); root.add(s);
  }
  return root;
}

// ═════════════════════ YELLOW — Mediterranean Villa / Resort ═════════════════════
function medVilla(kit, P) {
  const root = new THREE.Group(), B = 0.04;
  const terr = kit.mat('base', 0xd9c7a8, { rough: 0.85, clear: 0.05, bump: T.stucco, rep: [2, 2], bs: 0.5 });
  root.add(M(rb(0.98, B, 0.8, 0.01), terr, 0, B / 2, 0));
  const stucco = kit.mat('wall', 0xf6ead2, { rough: 0.85, clear: 0.05, bump: T.stucco, rep: [2, 2], bs: 0.9 });
  const trim = kit.mat('trim', 0xfbf4e6, { rough: 0.6, clear: 0.2 });
  const shutter = kit.mat('keep', 0x3f7d86, { rough: 0.5, clear: 0.4, bump: T.planksV, bs: 0.8 });
  const wood = kit.mat('keep', 0x6b4a33, { rough: 0.5, clear: 0.5, bump: T.planksV, bs: 1 });
  const iron = kit.iron();
  const mx = -0.12, mz = -0.04, mw = 0.62, mh = 0.62, md = 0.6, zf = mz + md / 2;
  root.add(M(rb(mw, mh, md, 0.01), stucco, mx, B + mh / 2, mz));
  root.add(M(rb(mw + 0.03, 0.025, md + 0.03, 0.006), trim, mx, B + mh, mz));
  const r1 = frustumRoof(kit, 'tile', P.accent, mw + 0.14, md + 0.14, 0.24, 0.12); r1.position.set(mx, B + mh + 0.012, mz); root.add(r1);
  const wx = 0.35, ww = 0.32, wh = 0.36, wd = 0.5;
  root.add(M(rb(ww, wh, wd, 0.01), stucco, wx, B + wh / 2, 0.01));
  const r2 = frustumRoof(kit, 'tile', P.accent, ww + 0.12, wd + 0.12, 0.15, 0.2); r2.position.set(wx, B + wh, 0.01); root.add(r2);
  const dr = archWindow(kit, 0.15, 0.3, { trim, panel: wood, sill: false }); dr.position.set(mx, B + 0.15, zf); root.add(dr);
  const uw = archWindow(kit, 0.13, 0.2, { trim, shutter }); uw.position.set(mx, B + 0.46, zf); root.add(uw);
  root.add(M(rb(0.22, 0.015, 0.07, 0.004), iron, mx, B + 0.355, zf + 0.035));
  const jb = balustrade(kit, 0.22, 0.07, iron, 9); jb.position.set(mx, B + 0.36, zf + 0.068); root.add(jb);
  for (const x of [mx - 0.2, mx + 0.2]) for (const y of [B + 0.17, B + 0.46]) { const w = archWindow(kit, 0.1, 0.17, { trim, shutter }); w.position.set(x, y, zf); root.add(w); }
  const big = archWindow(kit, 0.18, 0.22, { trim }); big.position.set(wx, B + 0.15, 0.26); root.add(big);
  for (const y of [B + 0.17, B + 0.46]) { const w = archWindow(kit, 0.1, 0.17, { trim, shutter }); w.position.set(mx - mw / 2, y, mz); w.rotation.y = -Math.PI / 2; root.add(w); }
  for (const x of [mx - 0.15, mx + 0.15]) { const w = archWindow(kit, 0.1, 0.17, { trim }); w.position.set(x, B + 0.46, mz - md / 2); w.rotation.y = Math.PI; root.add(w); }
  const terra = kit.mat('keep', 0xb5603a, { rough: 0.8, clear: 0.05 });
  const plant = kit.mat('keep', 0x4f7a3a, { rough: 0.85, clear: 0, bump: T.stucco, bs: 3 });
  for (const x of [mx - 0.13, mx + 0.13]) { root.add(M(cyl(0.035, 0.025, 0.065, 12), terra, x, B + 0.0325, zf + 0.06)); root.add(M(sph(0.04, 12, 10), plant, x, B + 0.09, zf + 0.06)); }
  const bloom = kit.mat('keep', 0xd2387e, { rough: 0.7, clear: 0.1 });
  for (let i = 0; i < 26; i++) {
    const m = M(sph(0.011 + kit.rand() * 0.008, 8, 6), kit.rand() < 0.3 ? plant : bloom,
      mx + 0.06 + kit.rand() * 0.1, B + 0.26 + kit.rand() * 0.16 + (kit.rand() < 0.4 ? -0.2 * kit.rand() : 0), zf + 0.01 + kit.rand() * 0.02);
    root.add(m);
  }
  const top = B + mh + 0.2, cx = mx - 0.2;
  root.add(M(rb(0.09, 0.2, 0.09, 0.008), stucco, cx, top - 0.05, mz - 0.15));
  const cap = frustumRoof(kit, 'tile', P.accent, 0.13, 0.13, 0.05, 0); cap.position.set(cx, top + 0.05, mz - 0.15); root.add(cap);
  root.add(lantern(kit, mx + 0.11, B + 0.24, zf));
  return root;
}
function resort(kit, P) {
  const root = new THREE.Group(), B = 0.04;
  const terr = kit.mat('base', 0xd9c7a8, { rough: 0.85, clear: 0.05, bump: T.stucco, rep: [3, 2], bs: 0.5 });
  root.add(M(rb(1.62, B, 0.98, 0.01), terr, 0, B / 2, 0));
  const stucco = kit.mat('wall', 0xf6ead2, { rough: 0.85, clear: 0.05, bump: T.stucco, rep: [3, 2], bs: 0.9 });
  const stuccoX = kit.mat('wall', 0xf6ead2, { rough: 0.85, clear: 0.05, bump: T.stucco, rep: [2, 2], bs: 0.9 });
  const trim = kit.mat('trim', 0xfbf4e6, { rough: 0.6, clear: 0.2 });
  const shutter = kit.mat('keep', 0x3f7d86, { rough: 0.5, clear: 0.4, bump: T.planksV, bs: 0.8 });
  const iron = kit.iron();
  const mx = -0.16, mz = -0.06, mw = 1.12, mh = 0.78, md = 0.64, zf = mz + md / 2;
  root.add(M(rb(mw, mh, md, 0.01), stucco, mx, B + mh / 2, mz));
  root.add(M(rb(mw + 0.03, 0.025, md + 0.03, 0.006), trim, mx, B + mh, mz));
  const r1 = frustumRoof(kit, 'tile', P.accent, mw + 0.14, md + 0.14, 0.28, 0.35); r1.position.set(mx, B + mh + 0.012, mz); root.add(r1);
  // arcade (loggia)
  const n = 4, aw = 0.17, ah = 0.25, AH = 0.32, az = zf + 0.115;
  const arc = archWall(mw, AH, n, aw, ah, 0.05, stuccoX); arc.position.set(mx, B, az); root.add(arc);
  const lr = M(rb(mw + 0.04, 0.025, 0.19, 0.006), surfMat(kit, 'tile', P.accent, 0.19, mw, false), mx, B + AH + 0.03, zf + 0.085); lr.rotation.x = 0.3; root.add(lr);
  const step = mw / n;
  for (let i = 0; i < n; i++) {
    const x = mx - mw / 2 + step * (i + 0.5);
    const w = archWindow(kit, 0.12, 0.2, { trim, panel: i === 1 || i === 2 ? kit.mat('keep', 0x6b4a33, { rough: 0.5, clear: 0.5, bump: T.planksV, bs: 1 }) : null }); w.position.set(x, B + 0.11, zf); root.add(w);
  }
  const sign = new THREE.MeshStandardMaterial({ map: textTex('MIRAMAR', 'HOTEL MIRAMAR', { w: 1024, h: 120, bg: '#f6ead2', fg: '#7a4b1c', font: 'bold 82px Georgia, serif', border: null }), roughness: 0.7 });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.05), sign); sp.position.set(mx, B + 0.287, az + 0.0505); root.add(sp);
  // upper floor arched windows + iron balconies
  for (let i = 0; i < 5; i++) {
    const x = mx - 0.46 + i * 0.23;
    const w = archWindow(kit, 0.11, 0.22, { trim, shutter }); w.position.set(x, B + 0.56, zf); root.add(w);
    if (i % 2 === 0) {
      root.add(M(rb(0.18, 0.014, 0.07, 0.004), iron, x, B + 0.44, zf + 0.035));
      const b = balustrade(kit, 0.18, 0.07, iron, 8); b.position.set(x, B + 0.445, zf + 0.068); root.add(b);
    }
  }
  const back = facadePlane(kit, mw - 0.06, mh - 0.08, 6, 2, 71, 0xf6ead2); back.position.set(mx, B + mh / 2, mz - md / 2 - 0.003); back.rotation.y = Math.PI; root.add(back);
  { const sw = facadePlane(kit, md - 0.08, mh - 0.08, 3, 2, 73, 0xf6ead2); sw.position.set(mx - mw / 2 - 0.003, B + mh / 2, mz); sw.rotation.y = -Math.PI / 2; root.add(sw); }
  // bell tower
  const tx = 0.56, tz = -0.12, tw = 0.26, th = 1.1;
  root.add(M(rb(tw, th, tw, 0.008), stucco, tx, B + th / 2, tz));
  for (const y of [0.5, th]) root.add(M(rb(tw + 0.03, 0.025, tw + 0.03, 0.006), trim, tx, B + y, tz));
  const td = archWindow(kit, 0.1, 0.2, { trim, panel: kit.mat('keep', 0x6b4a33, { rough: 0.5, clear: 0.5 }), sill: false }); td.position.set(tx, B + 0.1, tz + tw / 2); root.add(td);
  const tw2 = archWindow(kit, 0.07, 0.14, { trim }); tw2.position.set(tx, B + 0.75, tz + tw / 2); root.add(tw2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(M(rb(0.05, 0.2, 0.05, 0.006), stucco, tx + sx * 0.105, B + th + 0.1, tz + sz * 0.105));
  const bell = lathe([new THREE.Vector2(0, 0), new THREE.Vector2(0.045, 0), new THREE.Vector2(0.04, 0.02), new THREE.Vector2(0.032, 0.05), new THREE.Vector2(0.022, 0.075), new THREE.Vector2(0, 0.08)], 20);
  const bronze = kit.mat('keep', 0xb58a3c, { metal: 1, rough: 0.35, clear: 0 });
  const bm = M(bell, bronze, tx, B + th + 0.07, tz); root.add(bm);
  root.add(M(rb(tw + 0.05, 0.035, tw + 0.05, 0.006), trim, tx, B + th + 0.215, tz));
  const tr = frustumRoof(kit, 'tile', P.accent, tw + 0.08, tw + 0.08, 0.22, 0); tr.position.set(tx, B + th + 0.232, tz); root.add(tr);
  root.add(M(sph(0.018, 12, 8), kit.gold(), tx, B + th + 0.47, tz));
  addTick(root, (t) => { bm.rotation.z = Math.sin(t * 1.6) * 0.12; });
  for (const [x, z, h, l] of [[-0.76, 0.42, 0.72, 0.16], [0.74, 0.32, 0.62, -0.12], [0.34, 0.42, 0.5, 0.1]]) { const p = palm(kit, h, l); p.position.set(x, B, z); root.add(p); }
  return root;
}

// ═════════════════════ GREEN — Georgian Manor / Beaux-Arts Grand Hotel ═════════════════════
function column(kit, mat, x, y0, z, h, r = 0.018) {
  const g = new THREE.Group();
  g.add(M(cyl(r, r * 1.12, h, 14), mat, x, y0 + h / 2, z));
  g.add(M(rb(r * 2.8, 0.018, r * 2.8, 0.004), mat, x, y0 + 0.009, z));
  g.add(M(rb(r * 2.8, 0.018, r * 2.8, 0.004), mat, x, y0 + h - 0.009, z));
  return g;
}
function georgian(kit, P) {
  const root = new THREE.Group(), B = 0.07;
  const W = 0.9, D = 0.62, WH = 0.6, zf = D / 2;
  const stone = kit.mat('base', 0xd9d1c1, { rough: 0.8, clear: 0.05, bump: T.stucco, rep: [2, 0.5], bs: 0.6 });
  root.add(M(rb(W + 0.06, B, D + 0.06, 0.01), stone, 0, B / 2, 0));
  const brick = kit.mat('wall', 0xffffff, { rough: 0.85, clear: 0.05, bump: T.bricks, map: T.bricksC, rep: [2.5, 1.6], bs: 1.8 });
  root.add(M(rb(W, WH, D, 0.006), brick, 0, B + WH / 2, 0));
  const white = kit.mat('trim', 0xf8f6f0, { rough: 0.45, clear: 0.35 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(M(rb(0.045, WH, 0.045, 0.004), white, sx * (W / 2 - 0.012), B + WH / 2, sz * (D / 2 - 0.012)));
  root.add(M(rb(W + 0.05, 0.04, D + 0.05, 0.006), white, 0, B + WH + 0.02, 0));
  const RH = 0.3, rt = 0.4, ry = B + WH + 0.04;
  const roof = frustumRoof(kit, 'copper', P.accent, W + 0.06, D + 0.06, RH, rt); roof.position.y = ry; root.add(roof);
  root.add(M(rb((W + 0.06) * rt, 0.02, (D + 0.06) * rt, 0.004), kit.mat('roof', shade(P.accent, 0.8), { rough: 0.5, metal: 0.3, clear: 0.3 }), 0, ry + RH + 0.01, 0));
  for (const x of [-0.22, 0.22]) { const d = dormer(kit, { w: 0.12, h: 0.11, d: 0.14, wall: white, trim: white, roofColor: P.accent, roofKind: 'copper' }); d.position.set(x, ry + 0.04, frustumZ(D + 0.06, RH, rt, 0.04) - 0.06); root.add(d); }
  for (const s of [-1, 1]) {
    const top = ry + RH + 0.14;
    root.add(M(rb(0.12, top - (ry - 0.05), 0.1, 0.006), brick, s * 0.36, (top + ry - 0.05) / 2, 0));
    root.add(M(rb(0.15, 0.025, 0.13, 0.005), white, s * 0.36, top + 0.012, 0));
  }
  // portico
  const pz = zf + 0.1;
  for (const x of [-0.11, 0.11]) root.add(column(kit, white, x, B, pz + 0.02, 0.34));
  root.add(M(rb(0.32, 0.04, 0.16, 0.006), white, 0, B + 0.36, pz - 0.01));
  const ped = new THREE.Shape(); ped.moveTo(-0.17, 0); ped.lineTo(0.17, 0); ped.lineTo(0, 0.085); ped.closePath();
  const pg = new THREE.ExtrudeGeometry(ped, { depth: 0.16, bevelEnabled: false }); pg.translate(0, 0, -0.08);
  root.add(M(pg, white, 0, B + 0.38, pz - 0.01));
  root.add(M(rb(0.36, 0.03, 0.18, 0.005), stone, 0, B - 0.005, pz - 0.0));
  root.add(M(rb(0.4, 0.035, 0.08, 0.006), stone, 0, 0.0175, pz + 0.12));
  const doorM = kit.mat('accent', shade(P.accent, 0.42), { rough: 0.35, clear: 0.8, bump: T.planksV, bs: 0.6 });
  const door = doorUnit(kit, 0.13, 0.24, { trim: white, panel: doorM }); door.position.set(0, B + 0.12, zf); root.add(door);
  const fan = new THREE.Mesh(circle(0.068, 18, 0, Math.PI), kit.glass()); fan.position.set(0, B + 0.268, zf + 0.004); root.add(fan);
  root.add(M(torus(0.07, 0.009, 6, 20, Math.PI), white, 0, B + 0.268, zf + 0.008));
  const shutter = kit.mat('accent', shade(P.accent, 0.5), { rough: 0.45, clear: 0.5, bump: T.planksV, bs: 0.8 });
  const win = (x, y, z, rot, w = 0.13, h = 0.19, shut = true) => {
    const g = new THREE.Group();
    g.add(windowUnit(kit, w, h, { trim: white, shutter: shut ? shutter : null }));
    g.add(M(rb(w + 0.04, 0.03, 0.035, 0.004), white, 0, h / 2 + 0.02, 0.015));
    g.add(M(rb(0.022, 0.042, 0.04, 0.003), white, 0, h / 2 + 0.022, 0.02));
    g.position.set(x, y, z); g.rotation.y = rot; return g;
  };
  for (const x of [-0.3, 0.3]) { root.add(win(x, B + 0.16, zf, 0)); root.add(win(x, B + 0.44, zf, 0)); }
  for (const s of [-1, 1]) for (const y of [B + 0.16, B + 0.44]) root.add(win(s * W / 2, y, 0, s * Math.PI / 2, 0.12, 0.18, false));
  for (const x of [-0.3, 0, 0.3]) root.add(win(x, B + 0.44, -zf, Math.PI, 0.12, 0.18, false));
  const box = kit.mat('keep', 0x3c6a34, { rough: 0.9, clear: 0, bump: T.stucco, bs: 3 });
  for (const x of [-0.23, 0.23]) root.add(M(sph(0.05, 14, 10), box, x, B + 0.045, zf + 0.06));
  root.add(lantern(kit, -0.16, B + 0.2, zf)); root.add(lantern(kit, 0.16, B + 0.2, zf));
  return root;
}
function beaux(kit, P) {
  const root = new THREE.Group();
  const W = 1.5, D = 0.92, BH = 0.28, MH = 0.9, zf = D / 2;
  const cream = 0xe8dfcc;
  const rustic = kit.mat('base', cream, { rough: 0.75, clear: 0.05, bump: T.stones, rep: [5, 0.8], bs: 2 });
  root.add(M(rb(W, BH, D, 0.01), rustic, 0, BH / 2, 0));
  const stone = kit.mat('wall', cream, { rough: 0.7, clear: 0.1, bump: T.stucco, rep: [3, 2], bs: 0.5 });
  root.add(M(rb(W - 0.04, MH, D - 0.04, 0.008), stone, 0, BH + MH / 2, 0));
  for (const [pw, cols, x, z, rot] of [[W - 0.12, 9, 0, zf - 0.017, 0], [W - 0.12, 9, 0, -zf + 0.017, Math.PI], [D - 0.12, 5, W / 2 - 0.017, 0, Math.PI / 2], [D - 0.12, 5, -W / 2 + 0.017, 0, -Math.PI / 2]]) {
    const f = facadePlane(kit, pw, MH - 0.08, cols, 3, 80 + Math.round(rot * 3), cream); f.position.set(x, BH + MH / 2, z); f.rotation.y = rot; root.add(f);
  }
  const white = kit.mat('trim', 0xf4efe4, { rough: 0.55, clear: 0.2 });
  root.add(M(rb(W + 0.01, 0.025, D + 0.01, 0.005), white, 0, BH, 0));
  for (const x of [-0.6, -0.2, 0.2, 0.6]) root.add(M(rb(0.03, MH - 0.04, 0.02, 0.004), white, x, BH + MH / 2, zf - 0.01));
  root.add(M(rb(W + 0.05, 0.05, D + 0.05, 0.008), white, 0, BH + MH + 0.025, 0));
  const RH = 0.36, rt = 0.72, ry = BH + MH + 0.05;
  const mans = frustumRoof(kit, 'copper', P.accent, W, D, RH, rt); mans.position.y = ry; root.add(mans);
  root.add(M(rb(W * rt, 0.02, D * rt, 0.004), kit.mat('roof', shade(P.accent, 0.8), { rough: 0.5, metal: 0.3, clear: 0.3 }), 0, ry + RH + 0.01, 0));
  for (const back of [false, true]) for (const x of (back ? [-0.3, 0, 0.3] : [-0.56, -0.28, 0, 0.28, 0.56])) {
    const d = dormer(kit, { w: 0.1, h: 0.1, d: 0.12, wall: white, trim: white, roofColor: P.accent, roofKind: 'copper' });
    const z = frustumZ(D, RH, rt, 0.06) - 0.05;
    d.position.set(x, ry + 0.06, back ? -z : z); if (back) d.rotation.y = Math.PI; root.add(d);
  }
  // corner pavilions with steep copper roofs + flags
  for (const s of [-1, 1]) {
    const px = s * (W / 2 - 0.15), pz = zf - 0.15, py = ry;
    root.add(M(rb(0.3, 0.16, 0.3, 0.006), stone, px, py + 0.08, pz));
    const pw = facadePlane(kit, 0.22, 0.1, 2, 1, 90 + s, cream); pw.position.set(px, py + 0.08, pz + 0.152); root.add(pw);
    root.add(M(rb(0.32, 0.025, 0.32, 0.004), white, px, py + 0.17, pz));
    const pr = frustumRoof(kit, 'copper', P.accent, 0.34, 0.34, 0.34, 0.08); pr.position.set(px, py + 0.182, pz); root.add(pr);
    const fp = flagPole(kit, P.accent, 0.2, s); fp.group.position.set(px, py + 0.52, pz); root.add(fp.group); addTick(root, fp.tick);
  }
  // entrance: revolving door, marquise canopy, sign, lamp posts
  const gold = kit.gold(), iron = kit.iron();
  const glassR = kit.glass({ always: true, intensity: 1.2 });
  root.add(M(cyl(0.06, 0.06, 0.17, 20), glassR, 0, 0.085, zf));
  root.add(M(cyl(0.064, 0.064, 0.02, 20), gold, 0, 0.18, zf));
  for (const s of [-1, 1]) { const c = curtain(kit, { w: 0.09, h: 0.16, cols: 1, frame: gold }); c.position.set(s * 0.12, 0.09, zf); root.add(c); }
  const canG = kit.glass({ always: true, intensity: 0.6, color: 0x2a3a40 }); canG.transparent = true; canG.opacity = 0.75;
  root.add(M(rb(0.5, 0.012, 0.24, 0.003), canG, 0, 0.215, zf + 0.12));
  root.add(M(rb(0.52, 0.02, 0.012, 0.003), gold, 0, 0.215, zf + 0.24));
  for (const s of [-1, 1]) { root.add(M(rb(0.012, 0.02, 0.24, 0.003), gold, s * 0.255, 0.215, zf + 0.12)); const rod = M(rb(0.006, 0.2, 0.006, 0.002), iron, s * 0.2, 0.28, zf + 0.09); rod.rotation.x = -0.9; root.add(rod); }
  const sign = new THREE.MeshStandardMaterial({ map: textTex('PACIFIC', 'THE PACIFIC', { w: 1024, h: 120, bg: '#e8dfcc', fg: '#9a7a2e', font: 'bold 88px Georgia, serif', border: null }), roughness: 0.4, metalness: 0.2 });
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.045), sign); sp.position.set(0, 0.252, zf + 0.002); root.add(sp);
  for (const x of [-0.42, -0.62, 0.42, 0.62]) { const a = archWindow(kit, 0.1, 0.17, { trim: white }); a.position.set(x, 0.12, zf); root.add(a); }
  for (const s of [-1, 1]) {
    root.add(M(cyl(0.008, 0.011, 0.22, 8), iron, s * 0.32, 0.11, zf + 0.2));
    root.add(M(sph(0.022, 14, 10), kit.glass({ always: true, glow: 0xffd48a, intensity: 3, color: 0x544838 }), s * 0.32, 0.235, zf + 0.2));
  }
  const hedge = kit.mat('keep', 0x3c6a34, { rough: 0.9, clear: 0, bump: T.stucco, bs: 3 });
  for (const s of [-1, 1]) root.add(M(rb(0.36, 0.06, 0.07, 0.025), hedge, s * 0.55, 0.03, zf + 0.06));
  return root;
}

// ───────────────────── public API ─────────────────────
export const SETS = {
  brown: { label: 'Brown', color: 0x8b5a2b, props: [['Mediterranean Avenue', 60], ['Baltic Avenue', 60]], houseName: 'Cottage', hotelName: 'Roadside Inn', house: cottage, hotel: inn },
  lightBlue: { label: 'Light Blue', color: 0x86cfe8, props: [['Oriental Avenue', 100], ['Connecticut Avenue', 120]], houseName: 'Beach Bungalow', hotelName: 'Seaside Hotel', house: bungalow, hotel: seaside },
  pink: { label: 'Pink', color: 0xd6548f, props: [['St. Charles Place', 140], ['Virginia Avenue', 160]], houseName: 'Painted Lady', hotelName: 'The Rosemont', house: victorian, hotel: grandVictorian },
  orange: { label: 'Orange', color: 0xf08a24, props: [['St. James Place', 180], ['New York Avenue', 200]], houseName: 'Brownstone', hotelName: 'Downtown Hotel', house: brownstone, hotel: cityHotel },
  red: { label: 'Red', color: 0xd23a30, props: [['Kentucky Avenue', 220], ['Illinois Avenue', 240]], houseName: 'Alpine Chalet', hotelName: 'Ski Lodge', house: chalet, hotel: lodge },
  yellow: { label: 'Yellow', color: 0xf0c232, props: [['Atlantic Avenue', 260], ['Marvin Gardens', 280]], houseName: 'Villa Mediterranea', hotelName: 'Hotel Miramar', house: medVilla, hotel: resort },
  green: { label: 'Green', color: 0x2f9a6a, props: [['Pacific Avenue', 300], ['Pennsylvania Avenue', 320]], houseName: 'Georgian Manor', hotelName: 'The Pacific', house: georgian, hotel: beaux },
  darkBlue: { label: 'Dark Blue', color: 0x1f3d8c, props: [['Park Place', 350], ['Boardwalk', 400]], houseName: 'Modern Villa', hotelName: 'Art Deco Tower', house: villa, hotel: deco },
};
export const CLASSIC = { house: 0x2f9a48, hotel: 0xd23a2e };

export function createBuilding(setKey, kind, { seed = 1 } = {}) {
  const S = SETS[setKey], kit = new Kit(seed);
  const root = S[kind](kit, { accent: S.color });
  root.userData.paints = kit.paints; root.userData.kind = kind;
  root.traverse(o => { if (o.isMesh) { o.castShadow = !o.userData.noShadow; o.receiveShadow = true; } });
  return root;
}
export function applyPalette(root, mode) {
  const c0 = new THREE.Color(CLASSIC[root.userData.kind]);
  for (const m of root.userData.paints) {
    if (!m.userData.base?.isColor) m.userData.base = new THREE.Color(m.userData.base); // material.clone() serializes Colors to hex numbers
    if (mode !== 'classic') { m.color.copy(m.userData.base); continue; }
    const c = c0.clone(), r = m.userData.role;
    if (r === 'trim') c.lerp(new THREE.Color(0xffffff), 0.22);
    else if (r === 'base') c.multiplyScalar(0.7);
    else if (r === 'roof') c.multiplyScalar(0.85);
    m.color.copy(c);
  }
}
export function disposeBuilding(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    LIT.mats.delete(o.material);
    if (!o.geometry.userData.cached) o.geometry.dispose();
  });
  for (const m of root.userData.paints || []) m.dispose();
}

// ═════════════════════ GAME EXPORT ═════════════════════
// buildGameAssets() turns every design into a few merged, game-ready geometries that share a
// small fixed set of materials ("finishes"), so the game can draw all buildings of one finish
// with one BatchedMesh. Everything per-surface is baked into vertex data:
//   • transforms (geometry is in model units, origin at the footprint center, ground at y = 0,
//     front facing +Z),
//   • color (vertex attribute "color", linear),
//   • texture tiling (UVs pre-multiplied; finish textures use repeat 1 with RepeatWrapping),
//   • signs/facades/awnings (UVs remapped into one shared "print" atlas).
// Idle animations are frozen in their rest pose. Night lighting (setLights) is not used.

export const FINISH_NAMES = ['matte', 'gloss', 'matteDouble', 'metal', 'iron', 'glass', 'railing', 'print',
  'stucco', 'clapboard', 'planks', 'bricks', 'stones', 'shingle', 'scales', 'tile', 'seams', 'copper'];
const NO_SHADOW = new Set(['glass', 'railing', 'print']);

function finishMaterials(atlas) {
  const P = (o) => new THREE.MeshPhysicalMaterial({ vertexColors: true, clearcoatRoughness: 0.35, ...o });
  const tex = (f) => { const t = f().clone(); t.repeat.set(1, 1); t.needsUpdate = true; return t; };
  const bump = (f, s, extra = {}) => P({ bumpMap: tex(f), bumpScale: s, ...extra });
  const m = {
    matte: P({ roughness: 0.75, clearcoat: 0.1 }),
    gloss: P({ roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
    matteDouble: P({ roughness: 0.75, clearcoat: 0, side: THREE.DoubleSide }),
    metal: P({ roughness: 0.28, metalness: 1, clearcoat: 0 }),
    iron: P({ roughness: 0.5, metalness: 0.6, clearcoat: 0 }),
    glass: P({ roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }),
    railing: P({ roughness: 0.6, clearcoat: 0.2, alphaMap: tex(T.bars), alphaTest: 0.5, side: THREE.DoubleSide }),
    print: P({ roughness: 0.55, clearcoat: 0.15, map: atlas }),
    stucco: bump(T.stucco, 0.8, { roughness: 0.82, clearcoat: 0.05 }),
    clapboard: bump(T.clapboard, 1.6, { roughness: 0.6, clearcoat: 0.2 }),
    planks: bump(T.planksV, 1.2, { roughness: 0.7, clearcoat: 0.15 }),
    bricks: bump(T.bricks, 1.8, { roughness: 0.85, clearcoat: 0.05, map: tex(T.bricksC) }),
    stones: bump(T.stones, 2.6, { roughness: 0.88, clearcoat: 0 }),
    shingle: bump(T.shingles, 2.2, { roughness: 0.72, clearcoat: 0.12, map: tex(T.shinglesC) }),
    scales: bump(T.scales, 2, { roughness: 0.55, clearcoat: 0.3, map: tex(T.scalesC) }),
    tile: bump(T.tiles, 3, { roughness: 0.6, clearcoat: 0.2, map: tex(T.tilesC) }),
    seams: bump(T.seams, 1.4, { roughness: 0.38, metalness: 0.25, clearcoat: 0.5 }),
    copper: bump(T.seams, 1.2, { roughness: 0.45, metalness: 0.3, clearcoat: 0.35, map: tex(T.copperC) }),
  };
  for (const [k, v] of Object.entries(m)) v.name = 'building-' + k;
  return m;
}

// Which finish a showcase material becomes, and how its UVs must change.
const BUMP_FAMILY = {
  shingB: ['shingle', false], shingBF: ['shingle', true], scalesB: ['scales', false], scalesBF: ['scales', true],
  tilesB: ['tile', false], tilesBF: ['tile', true], seamsH: ['seams', false], seamsV: ['seams', true],
  stucco: ['stucco', false], clap: ['clapboard', false], planksV: ['planks', false], planksH: ['planks', true],
  bricks: ['bricks', false], stones: ['stones', false],
};
function classify(m) {
  const key = (t) => t?.userData?.key || '';
  const color = m.color.clone();
  const mk = key(m.map), bk = key(m.bumpMap);
  if (m.userData.isGlass) return { finish: 'glass', color };
  if (m.alphaMap) return { finish: 'railing', color, repeat: [m.alphaMap.repeat.x, m.alphaMap.repeat.y] };
  if (/^(txt:|fac|punch|stripes|ring)/.test(mk)) return { finish: 'print', color, print: m.map };
  if (BUMP_FAMILY[bk]) {
    let [finish, swap] = BUMP_FAMILY[bk];
    if (finish === 'seams' && mk === 'copperC') finish = 'copper';
    if (finish === 'bricks' && !m.map) color.set(0xffffff); // the brick finish carries its own color map
    return { finish, color, swap, repeat: [m.bumpMap.repeat.x, m.bumpMap.repeat.y] };
  }
  if (m.metalness >= 0.9) return { finish: 'metal', color };
  if (m.metalness >= 0.5) return { finish: 'iron', color };
  if (m.side === THREE.DoubleSide) return { finish: 'matteDouble', color };
  return { finish: (m.roughness ?? 1) <= 0.45 ? 'gloss' : 'matte', color };
}

function packAtlas(texes) {
  const PAD = 4, W = 2048;
  const items = [...texes].map((t) => ({ t, w: t.image.width, h: t.image.height })).sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowH = 0;
  for (const it of items) {
    const s = it.w > W - 2 * PAD ? (W - 2 * PAD) / it.w : 1;
    it.dw = Math.round(it.w * s); it.dh = Math.round(it.h * s);
    if (x + it.dw + 2 * PAD > W) { x = 0; y += rowH; rowH = 0; }
    it.x = x + PAD; it.y = y + PAD; x += it.dw + 2 * PAD; rowH = Math.max(rowH, it.dh + 2 * PAD);
  }
  const H = Math.pow(2, Math.ceil(Math.log2(Math.max(64, y + rowH))));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rects = new Map();
  for (const it of items) {
    // Edge-extend into the padding so mipmaps don't bleed neighbours in.
    g.drawImage(it.t.image, it.x - PAD, it.y - PAD, it.dw + 2 * PAD, it.dh + 2 * PAD);
    g.drawImage(it.t.image, it.x, it.y, it.dw, it.dh);
    rects.set(it.t.userData.key, { u0: it.x / W, v0: 1 - (it.y + it.dh) / H, du: it.dw / W, dv: it.dh / H });
  }
  const atlas = new THREE.CanvasTexture(c);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 8; atlas.name = 'building-print-atlas';
  return { atlas, rects };
}

function bakePart(mesh, cls) {
  let g = mesh.geometry.clone();
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  g.morphAttributes = {}; g.clearGroups();
  if (!g.index) { const n = g.attributes.position.count; const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
  g.applyMatrix4(mesh.matrixWorld);
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) cls.color.toArray(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const uv = g.attributes.uv;
  if (cls.repeat || cls.swap) {
    const [ru, rv] = cls.repeat || [1, 1];
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i) * ru, v = uv.getY(i) * rv;
      if (cls.swap) uv.setXY(i, v, u); else uv.setXY(i, u, v);
    }
  }
  return g;
}

/**
 * Build every design for the game.
 * @param {{ colors?: Partial<Record<string, number>> }} opts  group id → accent color (0xRRGGBB, sRGB).
 *   Missing groups use SETS[id].color.
 * @returns {{ finishes: Record<string, THREE.MeshPhysicalMaterial>, castShadow: Record<string, boolean>,
 *   designs: Record<string, { house: Design, hotel: Design }>, dispose(): void }}
 *   Design = { parts: { finish: string, geometry: THREE.BufferGeometry }[], size: THREE.Vector3 }
 *   (size = footprint width X, height Y, depth Z in model units).
 */
export function buildGameAssets({ colors = {} } = {}) {
  GAME = true;
  try {
    const raw = {}; const prints = new Set();
    for (const [key, S] of Object.entries(SETS)) {
      raw[key] = {};
      for (const kind of ['house', 'hotel']) {
        const kit = new Kit(7);
        const root = S[kind](kit, { accent: colors[key] ?? S.color });
        root.userData.tick?.(0);
        root.updateMatrixWorld(true);
        const parts = [];
        root.traverse((o) => {
          if (!o.isMesh) return;
          const cls = classify(o.material);
          if (cls.print) prints.add(cls.print);
          parts.push({ cls, geometry: bakePart(o, cls) });
        });
        raw[key][kind] = parts;
        for (const m of kit.paints) m.dispose();
        root.traverse((o) => { if (o.isMesh) { LIT.mats.delete(o.material); if (!o.geometry.userData.cached) o.geometry.dispose(); } });
      }
    }
    const { atlas, rects } = packAtlas(prints);
    const finishes = finishMaterials(atlas);
    const designs = {};
    for (const [key, kinds] of Object.entries(raw)) {
      designs[key] = {};
      for (const [kind, parts] of Object.entries(kinds)) {
        const byFinish = new Map();
        for (const p of parts) {
          if (p.cls.print) {
            const r = rects.get(p.cls.print.userData.key), uv = p.geometry.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + uv.getX(i) * r.du, r.v0 + uv.getY(i) * r.dv);
          }
          if (!byFinish.has(p.cls.finish)) byFinish.set(p.cls.finish, []);
          byFinish.get(p.cls.finish).push(p.geometry);
        }
        const box = new THREE.Box3();
        const merged = [...byFinish].map(([finish, geos]) => {
          const g = mergeGeometries(geos, false);
          geos.forEach((x) => x.dispose());
          g.computeBoundingBox(); box.union(g.boundingBox);
          return { finish, geometry: g };
        });
        const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
        for (const p of merged) { p.geometry.translate(-cx, -box.min.y, -cz); p.geometry.computeBoundingBox(); p.geometry.computeBoundingSphere(); }
        designs[key][kind] = { parts: merged, size: box.getSize(new THREE.Vector3()) };
      }
    }
    const castShadow = Object.fromEntries(FINISH_NAMES.map((f) => [f, !NO_SHADOW.has(f)]));
    return {
      finishes, castShadow, designs,
      dispose() {
        for (const d of Object.values(designs)) for (const k of ['house', 'hotel']) d[k].parts.forEach((p) => p.geometry.dispose());
        for (const m of Object.values(finishes)) { m.map?.dispose(); m.bumpMap?.dispose(); m.alphaMap?.dispose(); m.dispose(); }
        atlas.dispose();
      },
    };
  } finally {
    GAME = false;
  }
}
