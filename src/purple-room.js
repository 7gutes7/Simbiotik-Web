// Purple Wireframe Room — port a JS vanilla para SimbiotiK.
// Fondo de la seccion Simbiosis. Entra y sale con una cortina que barre de
// abajo hacia arriba con una linea inclinada 5 grados, ligada al scroll.

const ADVANCED_DEFAULTS = {
  vanishX: 50, vanishY: 50, horizonY: 54, wallX: 23,
  cycleMs: 1380, depthPerCycle: 32, floorRowsPerCycle: 15,
  floorCell: 20, floorPeaks: 100, floorDotChance: 100,
  floorLine: 8, floorDotSize: 16,
  farColor: "#392870", nearColor: "#A494D6", hazeColor: "#180C32",
  hazeOpacity: 0, haloColor: "#A494D6",
  glyphCount: 5200, glyphSize: 9, glyphLine: 9, glyphOpacity: 57,
  curtainShare: 54, curtainColumns: 24, curtainDepth: 40,
  radialStretch: 90, glyphTilt: 25, linkOpacity: 45,
  wallDots: 1600, footBand: 30, dotSize: 10, farFade: 15,
  seed: 7, grain: 0, vignette: 0,
};

// Preset elegido para SimbiotiK
const PRESET = {
  speed: 45, scale: 50, density: 20,
  color: "#3B00FF", dotColor: "#DED4F5", background: "#000000",
  advanced: {
    vanishX: 50, vanishY: 65, horizonY: 1, wallX: 37,
    cycleMs: 3180, depthPerCycle: 54, floorRowsPerCycle: 12,
    floorCell: 30, floorPeaks: 35, floorDotChance: 43,
    floorLine: 8, floorDotSize: 16,
    farColor: "#392870", nearColor: "#A494D6", hazeColor: "#180C32",
    hazeOpacity: 0, haloColor: "#A494D6",
    glyphCount: 2800, glyphSize: 9, glyphLine: 9, glyphOpacity: 57,
    curtainShare: 54, curtainColumns: 24, curtainDepth: 40,
    radialStretch: 90, glyphTilt: 25, linkOpacity: 45,
    wallDots: 1600, footBand: 30, dotSize: 10, farFade: 15,
    seed: 7, grain: 0, vignette: 0,
  },
};

const TAU = Math.PI * 2;
const GRADOS_CORTINA = 5;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth01 = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
const mod = (a, m) => ((a % m) + m) % m;

function parseColor(input, fallback) {
  if (!input || typeof input !== "string") return fallback;
  let s = input.trim();
  if (s[0] === "#") {
    let h = s.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return fallback;
    const n = parseInt(h.slice(0, 6), 16);
    if (isNaN(n)) return fallback;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    if (p.length >= 3 && p.every((x) => !isNaN(x))) return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  return fallback;
}

function mix(a, b, t) {
  const k = clamp01(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
}

const css = (c, alpha) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${clamp01(c[3] * alpha).toFixed(3)})`;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(i, k, salt, seed) {
  let h = Math.imul(i | 0, 374761393) ^ Math.imul(k | 0, 668265263) ^ Math.imul((salt + seed * 97) | 0, 2246822519 | 0);
  h = Math.imul(h ^ (h >>> 13), 3266489917 | 0);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const GLYPH_LINES = [
  [[0.2, 0, 0.2, 1], [0.8, 0, 0.2, 0.55, 0.8, 1]],
  [[0.15, 0, 0.85, 0, 0.15, 1, 0.85, 1]],
  [[0.1, 1, 0.5, 0, 0.9, 1]],
  [[0.5, 0, 0.9, 0.5, 0.5, 1, 0.1, 0.5, 0.5, 0]],
  [[0.5, 0, 0.5, 1], [0.5, 0.25, 0.85, 0.4, 0.85, 0.6, 0.5, 0.75, 0.15, 0.6, 0.15, 0.4, 0.5, 0.25]],
  [[0.15, 0, 0.85, 0, 0.35, 1]],
  [[0.85, 0.1, 0.5, 0, 0.15, 0.3, 0.15, 0.7, 0.5, 1, 0.85, 0.9]],
  [[0.5, 0, 0.85, 0.25, 0.85, 0.75, 0.5, 1, 0.15, 0.75, 0.15, 0.25, 0.5, 0]],
  [[0.2, 0.1, 0.35, 0.4], [0.85, 0.05, 0.6, 0.6, 0.2, 1]],
  [[0.4, 0, 0.4, 1], [0.4, 0.4, 0.85, 0.6]],
  [[0.15, 1, 0.15, 0, 0.85, 1, 0.85, 0]],
  [[0, 0.2, 0.25, 1, 0.5, 0.4, 0.75, 1, 1, 0.2]],
  [[0.45, 0, 0.15, 0.45], [0.35, 0.2, 0.85, 0.2, 0.6, 0.7, 0.25, 1]],
  [[0.65, 1, 0.65, 0, 0.1, 0.65, 0.9, 0.65]],
  [[0.15, 0, 0.85, 1], [0.85, 0, 0.15, 1]],
  [[0.5, 0, 0.95, 0.9, 0.05, 0.9, 0.5, 0]],
];
const GLYPH_SEGS = GLYPH_LINES.map((lines) => {
  const out = [];
  for (const l of lines)
    for (let i = 0; i + 3 < l.length; i += 2) out.push(l[i] - 0.5, l[i + 1] - 0.5, l[i + 2] - 0.5, l[i + 3] - 0.5);
  return out;
});

const FALLBACK_MID = [106, 89, 163, 1];
const FALLBACK_FAR = [57, 40, 112, 1];
const FALLBACK_NEAR = [164, 148, 214, 1];
const FALLBACK_DOT = [222, 212, 245, 1];
const FALLBACK_HAZE = [24, 12, 50, 1];
const FALLBACK_BG = [1, 0, 2, 1];
const WHITE = [255, 255, 255, 1];

const wallXRnd = (rnd) => (rnd() < 0.5 ? -1 : 1) * (0.75 + Math.pow(rnd(), 0.9) * 0.5);

function buildField(seed, density, glyphCount, curtainShare, curtainColumns, wallDots, footBand) {
  const rnd = mulberry32((seed | 0) * 9973 + 17);
  const n = Math.max(40, Math.min(20000, Math.round((glyphCount * density) / 70)));
  const nC = Math.round(n * clamp01(curtainShare / 100));
  const colsC = Math.max(2, curtainColumns | 0);
  const gx = new Float32Array(n), gy = new Float32Array(n), gp = new Float32Array(n);
  const gs = new Float32Array(n), gr = new Float32Array(n);
  const gt = new Uint8Array(n), gk = new Uint8Array(n);
  const gl = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const curtain = i < nC;
    gk[i] = curtain ? 1 : 0;
    if (curtain) {
      const col = Math.round((rnd() * 2 - 1) * colsC) / colsC;
      gx[i] = col * 0.97 + (rnd() - 0.5) * (0.25 / colsC);
    } else gx[i] = wallXRnd(rnd);
    gy[i] = -0.64 + rnd() * 0.79;
    gp[i] = rnd();
    gs[i] = curtain ? 0.7 + rnd() * 0.5 : 0.85 + rnd() * 0.7;
    gr[i] = rnd() * 2 - 1;
    gt[i] = Math.floor(rnd() * GLYPH_SEGS.length);
  }
  for (let i = nC; i < n; i++) {
    let best = -1, bd = 0.003;
    for (let j = nC; j < n; j++) {
      if (j === i || gx[i] * gx[j] < 0) continue;
      const ex = (gx[i] - gx[j]) * 0.25, ey = gy[i] - gy[j];
      if (ey * ey > bd) continue;
      let ep = Math.abs(gp[i] - gp[j]);
      if (ep > 0.5) ep = 1 - ep;
      ep *= 0.7;
      const d = ex * ex + ey * ey + ep * ep;
      if (d < bd) { bd = d; best = j; }
    }
    gl[i] = best;
  }
  const m = Math.max(0, Math.round((wallDots * density) / 70));
  const dx = new Float32Array(m), dy = new Float32Array(m), dp = new Float32Array(m);
  const ds = new Float32Array(m), dk = new Uint8Array(m), db = new Uint8Array(m);
  for (let j = 0; j < m; j++) {
    const curtain = rnd() < 0.55;
    dk[j] = curtain ? 1 : 0;
    dx[j] = curtain ? (rnd() * 2 - 1) * 0.97 : wallXRnd(rnd);
    const band = rnd() < footBand / 100;
    db[j] = band ? 1 : 0;
    dy[j] = band ? Math.pow(rnd(), 1.6) * 0.08 : -0.64 + rnd() * 0.79;
    dp[j] = rnd();
    ds[j] = band ? 0.7 + rnd() * 0.6 : 0.5 + rnd() * 0.8;
  }
  return { n, gx, gy, gp, gs, gr, gt, gk, gl, m, dx, dy, dp, ds, dk, db };
}

export class PurpleRoom {
  constructor(canvas, overrides = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true });
    this.listo = !!this.ctx;
    if (!this.listo) { console.warn("PurpleRoom: canvas 2D no disponible"); return; }

    this.p = { ...PRESET, ...overrides };
    this.adv = { ...ADVANCED_DEFAULTS, ...PRESET.advanced, ...(overrides.advanced || {}) };

    // En tactil se recorta densidad y resolucion: este render es CPU puro.
    this.tactil = window.matchMedia("(max-width: 992px), (pointer: coarse)").matches;
    this.dprMax = this.tactil ? 1.25 : 2;
    this.densidad = Math.max(1, this.tactil ? this.p.density * 0.55 : this.p.density);

    this.colores = {
      bg: parseColor(this.p.background, FALLBACK_BG),
      mid: parseColor(this.p.color, FALLBACK_MID),
      far: parseColor(this.adv.farColor, FALLBACK_FAR),
      near: parseColor(this.adv.nearColor, FALLBACK_NEAR),
      dot: parseColor(this.p.dotColor, FALLBACK_DOT),
      halo: parseColor(this.adv.haloColor, FALLBACK_NEAR),
      haze: parseColor(this.adv.hazeColor, FALLBACK_HAZE),
    };

    this.field = buildField(this.adv.seed, this.densidad, this.adv.glyphCount,
      this.adv.curtainShare, this.adv.curtainColumns, this.adv.wallDots, this.adv.footBand);

    this.W = 0; this.H = 0; this.dpr = 1;
    this.travel = 0; this.last = -1; this.raf = null; this.corriendo = false;
    this.hover = { x: 0, y: 0, t: 0, target: 0 };
    // Cortina: sIn 0..1 revela de abajo a arriba, sOut 0..1 oculta de abajo a arriba
    this.sIn = 0; this.sOut = 0; this.visible = false;

    this.sxA = new Float32Array(0); this.syA = new Float32Array(0);
    this.zA = new Float32Array(0); this.fA = new Float32Array(0);
    this.fx = new Float32Array(0); this.fy = new Float32Array(0); this.fz = new Float32Array(0);
    this.rowZ = new Float32Array(0);
    this.gB = Array.from({ length: 24 }, () => []);
    this.fB = Array.from({ length: 30 }, () => []);
    this.linkB = [];
    this.wdB = Array.from({ length: 4 }, () => []);
    this.fdB = Array.from({ length: 4 }, () => []);

    this.mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    this.resize();
    window.addEventListener("resize", () => this.resize(), { passive: true });
    window.addEventListener("pointermove", (e) => {
      if (!this.visible) return;
      this.hover.x = Math.max(-1, Math.min(1, (e.clientX / Math.max(1, this.W)) * 2 - 1));
      this.hover.y = Math.max(-1, Math.min(1, (e.clientY / Math.max(1, this.H)) * 2 - 1));
      this.hover.target = 1;
    }, { passive: true });
    window.addEventListener("pointerleave", () => { this.hover.target = 0; }, { passive: true });
  }

  resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.dpr = Math.min(this.dprMax, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(this.W * this.dpr));
    this.canvas.height = Math.max(1, Math.round(this.H * this.dpr));
  }

  // sIn: 0 cuando el borde superior de la seccion esta en el fondo de la pantalla,
  //      1 cuando llega arriba. sOut: igual para el borde inferior.
  setCortina(sIn, sOut) {
    this.sIn = clamp01(sIn);
    this.sOut = clamp01(sOut);
    const visible = this.sIn > 0.001 && this.sOut < 0.999;
    if (visible !== this.visible) {
      this.visible = visible;
      this.canvas.style.opacity = visible ? "1" : "0";
      if (!visible) {
        const c = this.ctx;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  // Recorta al area de la cortina. Devuelve false si no hay nada que pintar.
  aplicarCortina(ctx) {
    const { W, H } = this;
    const tan = Math.tan((GRADOS_CORTINA * Math.PI) / 180);
    const dh = W * tan;
    const fuera = H + dh + 4;
    // Mientras sale manda sOut (oculta); si no, manda sIn (revela).
    const saliendo = this.sOut > 0.001;
    const s = saliendo ? this.sOut : this.sIn;
    if (!saliendo && s >= 0.999) return true; // completamente abierta: sin recorte
    const yc = (H + dh / 2) - s * (H + dh);
    const y0 = yc + (W / 2) * tan;  // borde izquierdo (mas abajo)
    const y1 = yc - (W / 2) * tan;  // borde derecho (mas arriba)
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(W, y1);
    if (saliendo) { ctx.lineTo(W, -fuera); ctx.lineTo(0, -fuera); }  // visible por encima
    else { ctx.lineTo(W, fuera); ctx.lineTo(0, fuera); }             // visible por debajo
    ctx.closePath();
    ctx.clip();
    return true;
  }

  start() {
    if (this.corriendo || !this.listo) return;
    this.corriendo = true;
    const tick = (now) => {
      if (!this.corriendo) return;
      this.raf = requestAnimationFrame(tick);
      const dt = this.last < 0 ? 0 : Math.min(1 / 20, (now - this.last) / 1000);
      this.last = now;
      if (!this.visible || this.W < 2 || this.H < 2) return;
      const hv = this.hover;
      hv.t += (hv.target - hv.t) * Math.min(1, dt * 6);
      const rate = (Math.max(0, this.p.speed) / 50) * (1 + hv.t * 0.35);
      const v = this.adv.depthPerCycle / 100 / Math.max(0.05, this.adv.cycleMs / 1000);
      if (!(this.mq && this.mq.matches)) this.travel += dt * v * rate;
      this.render();
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() { this.corriendo = false; if (this.raf) cancelAnimationFrame(this.raf); }

  render() {
    const ctx = this.ctx, adv = this.adv, f = this.field;
    const W = this.W, H = this.H, travel = this.travel, hover = this.hover;
    const { bg, mid, far, near, dot: dotC, halo, haze } = this.colores;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    this.aplicarCortina(ctx);

    const sc = Math.max(0.1, this.p.scale / 100);
    const stretchRate = Math.min(2, Math.max(0, this.p.speed / 50)) * (1 + hover.t * 0.6);

    ctx.fillStyle = css(bg, 1);
    ctx.fillRect(0, 0, W, H);

    const parallax = 0.045 * Math.min(W, H) * hover.t;
    const vx = (adv.vanishX / 100) * W + hover.x * parallax;
    const vy = (adv.vanishY / 100) * H + hover.y * parallax * 0.6;
    const hW = Math.max(0.02, (adv.horizonY - adv.vanishY) / 100);
    const horizonPx = vy + hW * H;
    const Wc = (Math.max(0.02, (adv.vanishX - adv.wallX) / 100) * W) / H;

    const hazeOp = clamp01(adv.hazeOpacity / 100);
    if (hazeOp > 0) {
      ctx.save();
      ctx.translate(vx, horizonPx * 0.5);
      ctx.scale(W * 0.55, horizonPx * 0.7);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, css(haze, hazeOp));
      g.addColorStop(0.6, css(haze, hazeOp * 0.75));
      g.addColorStop(1, css(haze, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    }

    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const strokeSegs = (arr) => {
      ctx.beginPath();
      for (let s = 0; s < arr.length; s += 4) { ctx.moveTo(arr[s], arr[s + 1]); ctx.lineTo(arr[s + 2], arr[s + 3]); }
      ctx.stroke();
    };
    const fillDots = (arr, rMul, rAdd) => {
      ctx.beginPath();
      for (let s = 0; s < arr.length; s += 3) {
        const r = arr[s + 2] * rMul + rAdd;
        ctx.moveTo(arr[s] + r, arr[s + 1]);
        ctx.arc(arr[s], arr[s + 1], r, 0, TAU);
      }
      ctx.fill();
    };

    const seed = adv.seed | 0;
    const zBottom = Math.min(0.95, hW / Math.max(0.05, 1 - adv.vanishY / 100));
    const zf0 = Math.max(0.06, zBottom * 0.8);
    const Lf = 1 - zf0;
    const cell = Math.max(0.004, adv.floorCell / 1000);
    const dzT = Math.max(0.005, adv.depthPerCycle / 100 / Math.max(1, adv.floorRowsPerCycle));
    const R = Math.max(3, Math.min(60, Math.round(Lf / dzT)));
    const dz = Lf / R;
    const C = Math.min(160, Math.ceil((0.55 * W) / H / cell) + 1);
    const cols = 2 * C + 1;
    const nv = cols * R;
    if (this.fx.length < nv) { this.fx = new Float32Array(nv); this.fy = new Float32Array(nv); this.fz = new Float32Array(nv); }
    if (this.rowZ.length < R) this.rowZ = new Float32Array(R);
    const fx = this.fx, fy = this.fy, fz = this.fz, rowZ = this.rowZ;
    const peaks = adv.floorPeaks / 100;
    for (let k = 0; k < R; k++) {
      const zb = zf0 + mod(k * dz - travel, Lf);
      rowZ[k] = zb;
      for (let c = 0; c < cols; c++) {
        const i = c - C;
        const jx = (hash(i, k, 1, seed) - 0.5) * 0.7;
        const jz = (hash(i, k, 2, seed) - 0.5) * 0.6;
        const pk = hash(i, k, 3, seed) < peaks ? hash(i, k, 4, seed) * 0.011 : 0;
        const z = Math.max(0.05, zb + jz * dz);
        const idx = k * cols + c;
        fx[idx] = vx + ((i + jx) * cell * H) / z;
        fy[idx] = vy + ((hW - pk) * H) / z;
        fz[idx] = z;
      }
    }
    const ff = (z) => clamp01((1 - z) / 0.05) * (0.15 + 0.85 * smooth01((0.97 - z) / 0.27));
    const nearDen = Math.max(0.01, 1 / zBottom - 1);
    for (const b of this.fB) b.length = 0;
    const fB = this.fB;
    const addEdge = (a, b, bright) => {
      const xa = fx[a], xb = fx[b], ya = fy[a], yb = fy[b];
      if ((xa < 0 && xb < 0) || (xa > W && xb > W) || (ya > H && yb > H)) return;
      const zm = (fz[a] + fz[b]) * 0.5;
      const al = ff(zm);
      if (al < 0.03) return;
      const nr = clamp01((1 / zm - 1) / nearDen);
      const ni = Math.min(4, (nr * 5) | 0);
      const ai = Math.min(2, (al * 3) | 0);
      fB[((bright ? 1 : 0) * 5 + ni) * 3 + ai].push(xa, ya, xb, yb);
    };
    for (let k = 0; k < R; k++) {
      const kn = (k + 1) % R;
      const valid = rowZ[kn] > rowZ[k];
      for (let c = 0; c < cols; c++) {
        const i = c - C;
        const a = k * cols + c;
        const bright = hash(i, k, 9, seed) > 0.85;
        if (c < cols - 1 && hash(i, k, 5, seed) > 0.22) addEdge(a, a + 1, bright);
        if (!valid) continue;
        const an = kn * cols + c;
        if (hash(i, k, 6, seed) > 0.3) addEdge(a, an, bright);
        if (c < cols - 1 && hash(i, k, 7, seed) > 0.25) {
          if (hash(i, k, 8, seed) < 0.5) addEdge(a, an + 1, bright);
          else addEdge(a + 1, an, bright);
        }
      }
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = css(far, 0.22);
    ctx.beginPath();
    for (let k = 0; k < R; k++) {
      const zb = rowZ[k];
      if (ff(zb) < 0.5) continue;
      const y = vy + (hW * H) / zb;
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    const zg = 0.9;
    for (let i = -C; i <= C; i++) {
      ctx.moveTo(vx + (i * cell * H) / zg, vy + (hW * H) / zg);
      ctx.lineTo(vx + (i * cell * H) / zf0, vy + (hW * H) / zf0);
    }
    ctx.stroke();

    const floorW = adv.floorLine / 10;
    for (let bright = 0; bright < 2; bright++)
      for (let ni = 0; ni < 5; ni++)
        for (let ai = 0; ai < 3; ai++) {
          const arr = fB[(bright * 5 + ni) * 3 + ai];
          if (!arr.length) continue;
          const nn = (ni + 0.5) / 5;
          const col = bright ? mix(mid, near, 0.4) : mix(far, mid, nn);
          ctx.strokeStyle = css(col, ((ai + 0.5) / 3) * 0.75);
          ctx.lineWidth = floorW * (1 + 1.6 * nn);
          strokeSegs(arr);
        }

    const n = f.n;
    if (this.sxA.length < n) {
      this.sxA = new Float32Array(n); this.syA = new Float32Array(n);
      this.zA = new Float32Array(n); this.fA = new Float32Array(n);
    }
    const sxA = this.sxA, syA = this.syA, zA = this.zA, fA = this.fA;
    for (const b of this.gB) b.length = 0;
    const gB = this.gB;
    this.linkB.length = 0;
    const linkB = this.linkB;
    const farFade = Math.max(0.01, adv.farFade / 100);
    const zw0 = 0.3, zwL = 0.7;
    const zc0 = 1 - Math.min(0.9, Math.max(0.05, adv.curtainDepth / 100));
    const zcL = 1 - zc0;
    const nearRef = 1 / 0.4 - 1;
    const tilt = (adv.glyphTilt * Math.PI) / 180;
    const stretchAmt = (adv.radialStretch / 100) * stretchRate;
    const gSize = (adv.glyphSize / 1000) * H * sc;
    const footFadePx = 0.015 * H;
    for (let i = 0; i < n; i++) {
      fA[i] = 0;
      const kind = f.gk[i];
      const z0 = kind ? zc0 : zw0;
      const L = kind ? zcL : zwL;
      const z = z0 + mod(f.gp[i] * L - travel, L);
      zA[i] = z;
      let fade = clamp01((1 - z) / farFade);
      fade *= kind ? clamp01((z - z0) / (L * 0.25)) : clamp01((z - z0) / 0.06);
      if (fade < 0.02) continue;
      const sx = vx + (f.gx[i] * Wc * H) / z;
      const sy = vy + (f.gy[i] * H) / z;
      const gh = (gSize / z) * f.gs[i];
      if (sx < -gh || sx > W + gh || sy < -gh || sy > horizonPx) continue;
      fade *= clamp01((horizonPx - sy) / footFadePx);
      if (fade < 0.02) continue;
      sxA[i] = sx; syA[i] = sy; fA[i] = fade;
      const nr = clamp01((1 / z - 1) / nearRef);
      const ddx = sx - vx, ddy = sy - vy;
      const dist = Math.hypot(ddx, ddy);
      let ux = 0, uy = 0, k = 0;
      if (dist > 1) { ux = ddx / dist; uy = ddy / dist; k = stretchAmt * clamp01(dist / (0.5 * W)); }
      const th = f.gr[i] * tilt * (kind ? 0.4 : 1);
      const cs = Math.cos(th), sn = Math.sin(th);
      const s00 = 1 + k * ux * ux, s01 = k * ux * uy, s11 = 1 + k * uy * uy;
      const m00 = s00 * cs + s01 * sn, m01 = -s00 * sn + s01 * cs;
      const m10 = s01 * cs + s11 * sn, m11 = -s01 * sn + s11 * cs;
      const ni = Math.min(5, (nr * 6) | 0);
      const ai = Math.min(3, (fade * 4) | 0);
      const b = gB[ni * 4 + ai];
      const segs = GLYPH_SEGS[f.gt[i]];
      const gw = gh * 0.7;
      for (let s = 0; s < segs.length; s += 4) {
        const u1 = segs[s] * gw, v1 = segs[s + 1] * gh;
        const u2 = segs[s + 2] * gw, v2 = segs[s + 3] * gh;
        b.push(sx + m00 * u1 + m01 * v1, sy + m10 * u1 + m11 * v1,
               sx + m00 * u2 + m01 * v2, sy + m10 * u2 + m11 * v2);
      }
    }

    const linkOp = clamp01(adv.linkOpacity / 100);
    if (linkOp > 0) {
      const maxLen = 0.1 * W;
      for (let i = 0; i < n; i++) {
        const j = f.gl[i];
        if (j < 0 || fA[i] < 0.3 || fA[j] < 0.3) continue;
        if (Math.abs(zA[i] - zA[j]) > 0.12) continue;
        const lx = sxA[j] - sxA[i], ly = syA[j] - syA[i];
        if (lx * lx + ly * ly > maxLen * maxLen) continue;
        linkB.push(sxA[i], syA[i], sxA[j], syA[j]);
      }
      if (linkB.length) {
        ctx.strokeStyle = css(mix(far, mid, 0.3), linkOp);
        ctx.lineWidth = 1;
        strokeSegs(linkB);
      }
    }

    const gLine = (adv.glyphLine / 10) * Math.sqrt(sc);
    const gOp = clamp01(adv.glyphOpacity / 100);
    for (let ni = 0; ni < 6; ni++)
      for (let ai = 0; ai < 4; ai++) {
        const arr = gB[ni * 4 + ai];
        if (!arr.length) continue;
        const t = (ni + 0.5) / 6;
        const col = t < 0.3 ? mix(far, mid, t / 0.3) : mix(mid, near, (t - 0.3) / 0.7);
        ctx.strokeStyle = css(col, gOp * (0.3 + 0.7 * ((ai + 0.5) / 4)));
        ctx.lineWidth = gLine * (0.9 + 1.4 * t);
        strokeSegs(arr);
      }

    for (const b of this.wdB) b.length = 0;
    const wdB = this.wdB;
    const dotR = (adv.dotSize / 10000) * H * sc;
    for (let j = 0; j < f.m; j++) {
      const kind = f.dk[j];
      const z0 = kind ? zc0 : zw0;
      const L = kind ? zcL : zwL;
      const z = z0 + mod(f.dp[j] * L - travel, L);
      let fade = clamp01((1 - z) / farFade);
      fade *= kind ? clamp01((z - z0) / (L * 0.25)) : clamp01((z - z0) / 0.06);
      if (fade < 0.03) continue;
      const sx = vx + (f.dx[j] * Wc * H) / z;
      let sy, r;
      if (f.db[j]) {
        sy = horizonPx - f.dy[j] * H;
        r = Math.min(dotR * 1.4, dotR / z) * f.ds[j];
      } else {
        sy = vy + (f.dy[j] * H) / z;
        if (sy > horizonPx) continue;
        fade *= clamp01((horizonPx - sy) / footFadePx);
        r = (dotR / Math.sqrt(z)) * f.ds[j];
      }
      if (sx < -4 || sx > W + 4 || sy < -4 || fade < 0.03) continue;
      wdB[Math.min(3, (fade * 4) | 0)].push(sx, sy, r);
    }

    for (const b of this.fdB) b.length = 0;
    const fdB = this.fdB;
    const fdChance = adv.floorDotChance / 100;
    const fdR = (adv.floorDotSize / 10000) * H * sc;
    for (let k = 0; k < R; k++)
      for (let c = 0; c < cols; c++) {
        if (hash(c - C, k, 10, seed) >= fdChance) continue;
        const idx = k * cols + c;
        const x = fx[idx], y = fy[idx], z = fz[idx];
        if (x < -10 || x > W + 10 || y > H + 10) continue;
        const fade = clamp01((1 - z) / 0.06);
        if (fade < 0.03) continue;
        fdB[Math.min(3, (fade * 4) | 0)].push(x, y, fdR / z);
      }

    for (let ai = 0; ai < 4; ai++) {
      const a = (ai + 0.5) / 4;
      if (wdB[ai].length) {
        ctx.fillStyle = css(halo, 0.15 * a * (1 + hover.t * 0.9));
        fillDots(wdB[ai], 1.8, 0.8);
        ctx.fillStyle = css(dotC, a);
        fillDots(wdB[ai], 1, 0);
      }
      if (fdB[ai].length) {
        ctx.fillStyle = css(halo, 0.22 * a);
        fillDots(fdB[ai], 1.5, 1);
        ctx.fillStyle = css(dotC, a);
        fillDots(fdB[ai], 1, 0);
        ctx.fillStyle = css(WHITE, 0.8 * a);
        fillDots(fdB[ai], 0.45, 0);
      }
    }

    ctx.globalCompositeOperation = "source-over";
    if (adv.vignette > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${(clamp01(adv.vignette / 100) * 0.9).toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
