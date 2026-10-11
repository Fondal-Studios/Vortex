// Efectos de combate (3D). Todo sale de POOLS FIJOS (nada se crea por partícula ni por disparo):
//  · Particles  — puntos con formas (brasa, esquirla, burbuja, estrella, humo) en 2 capas: aditiva y humo (mezcla normal).
//  · Strips     — segmentos "cinta" que miran a la cámara: rayos, trazas, estelas, chispas alargadas. UN solo draw call.
//  · anillos/destellos/marcas — mallas planas y sprites reutilizados (onda de choque, destello de boca, quemadura).
//  · esquirlas sólidas con física simple.
// Compatibilidad: burst / tracer / blast / shatter / update se siguen usando igual (objects.js, render.js).
// El "qué se ve por arma" vive en combatfx.js (this.combat); acá sólo está la maquinaria.
import * as THREE from 'three';
import { OUT } from './shaders.js';
import { CombatFx } from './combatfx.js';

/** Presupuesto por calidad (0 = Baja/iPhone, 1 = Media, 2 = Alta). Baja: ≤150 partículas vivas entre las dos capas. */
export const TIERS = [
  { live: 112, smoke: 38, segs: 120, rings: 6, flashes: 8, decals: 4, chunks: 6, nums: 10, dens: 0.4 },
  { live: 560, smoke: 120, segs: 420, rings: 10, flashes: 12, decals: 8, chunks: 12, nums: 16, dens: 0.75 },
  { live: 1700, smoke: 300, segs: 900, rings: 14, flashes: 16, decals: 12, chunks: 18, nums: 24, dens: 1 },
];
export const tierOf = (q) => { const p = (q && q.particles) || 3000; return p <= 700 ? 0 : p <= 1600 ? 1 : 2; };
const MAXT = TIERS[2];

export const GAM = { value: 1 }; // salida: con post-proceso el OutputPass codifica sRGB; sin él lo hacemos nosotros
export const INT = { value: 1 }; // intensidad global de lo aditivo (con bloom se baja para que no se queme)
const UH = { value: 540 }; // alto del framebuffer: mantiene el tamaño de los puntos al cambiar de calidad
const col = new THREE.Color();
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

/* ───────────────────────── Partículas ───────────────────────── */
export const SHAPE = { soft: 0, ember: 1, shard: 2, bubble: 3, star: 4, smoke: 5 };

class Particles {
  constructor(scene, cap, blending) {
    this.cap = cap; this.limit = cap; this.head = 0; this.live = 0; this.dirty = false;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.shape = new Float32Array(cap); this.rot = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.base = new Float32Array(cap);
    this.c2 = new Float32Array(cap * 3); this.c1 = new Float32Array(cap * 3); this.grav = new Float32Array(cap); this.drag = new Float32Array(cap);
    this.grow = new Float32Array(cap); this.spin = new Float32Array(cap); this.fadePow = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('shape', new THREE.BufferAttribute(this.shape, 1)); g.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1));
    for (const a of Object.values(g.attributes)) a.setUsage(THREE.DynamicDrawUsage);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending,
      uniforms: { uH: UH, uGam: GAM, uInt: blending === THREE.AdditiveBlending ? INT : { value: 1 } },
      vertexShader: `uniform float uH; attribute float size; attribute float alpha; attribute float shape; attribute float rot; attribute vec3 color; varying vec3 vC; varying float vA; varying float vS; varying float vR;
        void main(){ vC = color; vA = alpha; vS = shape; vR = rot; vec4 mv = modelViewMatrix * vec4(position, 1.0); vA *= smoothstep(0.8, 3.2, -mv.z); gl_PointSize = clamp(size * projectionMatrix[1][1] * 0.5 * uH / max(-mv.z, 0.4), 0.0, 420.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uGam; uniform float uInt; varying vec3 vC; varying float vA; varying float vS; varying float vR;
        void main(){
          vec2 d = (gl_PointCoord - 0.5) * 2.0; float cs = cos(vR), sn = sin(vR); d = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y);
          float r = length(d), a = 0.0; vec3 c = vC;
          if (vS < 0.5) { a = smoothstep(1.0, 0.0, r); }
          else if (vS < 1.5) { a = smoothstep(1.0, 0.0, r); a = a * a; c = mix(vC, vec3(1.0), smoothstep(0.45, 0.0, r) * 0.75); }
          else if (vS < 2.5) { float m = abs(d.x) + abs(d.y) * 0.5; a = smoothstep(1.0, 0.84, m); c = mix(vC * 0.5, vC + 0.35, step(0.0, d.x + d.y * 0.3)); c += smoothstep(0.72, 1.0, m) * 0.35; }
          else if (vS < 3.5) { a = smoothstep(0.58, 0.82, r) * smoothstep(1.0, 0.9, r) * 0.9 + (1.0 - smoothstep(0.0, 0.9, r)) * 0.12; a += smoothstep(0.24, 0.0, length(d - vec2(-0.38, 0.38))) * 0.9; }
          else if (vS < 4.5) { float k = min(abs(d.x), abs(d.y)); a = smoothstep(0.14, 0.0, k) * smoothstep(1.0, 0.0, max(abs(d.x), abs(d.y))) + smoothstep(0.38, 0.0, r) * 0.9; c = mix(vC, vec3(1.0), 0.35); }
          else { a = smoothstep(1.0, 0.0, r); a = a * a * (3.0 - 2.0 * a) * 0.85; a *= 0.72 + 0.28 * sin(d.x * 6.0 + vR * 3.0) * sin(d.y * 5.0 - vR * 2.0); }
          gl_FragColor = vec4(pow(max(c, vec3(0.0)), vec3(uGam)), a * vA * uInt);
        }`,
    });
    this.points = new THREE.Points(g, mat); this.points.frustumCulled = false; scene.add(this.points); this.geo = g;
  }
  /** Una partícula. Colores 0..1; grow: cambio relativo de tamaño al final de la vida (−1 = se encoge a 0, +2 = triplica). */
  spawn(x, y, z, vx, vy, vz, c1, c2, size, life, grav, drag, grow, shape, spin, amp = 1) {
    const k = this.head; this.head = (this.head + 1) % this.limit; const i3 = k * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z; this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.c1[i3] = c1.r; this.c1[i3 + 1] = c1.g; this.c1[i3 + 2] = c1.b; this.c2[i3] = c2.r; this.c2[i3 + 1] = c2.g; this.c2[i3 + 2] = c2.b;
    this.col[i3] = c1.r; this.col[i3 + 1] = c1.g; this.col[i3 + 2] = c1.b;
    this.life[k] = this.max[k] = life; this.base[k] = size; this.grav[k] = grav; this.drag[k] = drag; this.grow[k] = grow; this.shape[k] = shape;
    this.spin[k] = spin; this.rot[k] = Math.random() * 6.283; this.fadePow[k] = amp; this.alpha[k] = 0.01; this.size[k] = size; this.dirty = true;
  }
  update(dt, gx, gy, gz) {
    if (!this.live && !this.dirty) return;
    let live = 0; const L = this.limit, damp0 = dt;
    for (let k = 0; k < L; k++) {
      if (this.life[k] <= 0) { if (this.alpha[k] !== 0) { this.alpha[k] = 0; this.size[k] = 0; } continue; }
      live++; this.life[k] -= dt; const mx = this.max[k], t = Math.max(0, this.life[k] / mx), u = 1 - t, i3 = k * 3;
      const dm = Math.max(0, 1 - this.drag[k] * damp0), g = this.grav[k];
      this.vel[i3] = this.vel[i3] * dm + gx * g * dt; this.vel[i3 + 1] = this.vel[i3 + 1] * dm + gy * g * dt; this.vel[i3 + 2] = this.vel[i3 + 2] * dm + gz * g * dt;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const s = u * u * (3 - 2 * u); // color: c1 → c2
      this.col[i3] = this.c1[i3] + (this.c2[i3] - this.c1[i3]) * s; this.col[i3 + 1] = this.c1[i3 + 1] + (this.c2[i3 + 1] - this.c1[i3 + 1]) * s; this.col[i3 + 2] = this.c1[i3 + 2] + (this.c2[i3 + 2] - this.c1[i3 + 2]) * s;
      this.alpha[k] = (u < 0.06 ? u / 0.06 : 1) * t * (this.shape[k] === 5 ? 0.7 : 1) * this.fadePow[k];
      this.size[k] = Math.max(0, this.base[k] * (1 + this.grow[k] * u)); this.rot[k] += this.spin[k] * dt;
    }
    this.live = live; this.dirty = false;
    const a = this.geo.attributes; a.position.needsUpdate = a.alpha.needsUpdate = a.size.needsUpdate = a.color.needsUpdate = a.rot.needsUpdate = a.shape.needsUpdate = true;
  }
  clear() { this.life.fill(0); this.alpha.fill(0); this.size.fill(0); this.live = 0; this.dirty = true; }
}

/* ───────────────────────── Cintas (rayos, trazas, chispas) ───────────────────────── */
const SS = 30; // floats de estado por segmento
const VS = 13; // floats por vértice: p(3) o(3) side end c(3) a w
export const SEG = { line: 0, spark: 1, dart: 2 };
class Strips {
  constructor(scene, cap, fx) {
    this.cap = cap; this.n = 0; this.fx = fx; this.rr = 0;
    this.S = new Float32Array(cap * SS); this.V = new Float32Array(cap * 4 * VS);
    const idx = new Uint16Array(cap * 6); for (let i = 0; i < cap; i++) { const v = i * 4; idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6); }
    const g = new THREE.BufferGeometry(); this.ib = new THREE.InterleavedBuffer(this.V, VS); this.ib.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(this.ib, 3, 0)); g.setAttribute('aO', new THREE.InterleavedBufferAttribute(this.ib, 3, 3));
    g.setAttribute('aSide', new THREE.InterleavedBufferAttribute(this.ib, 1, 6)); g.setAttribute('aEnd', new THREE.InterleavedBufferAttribute(this.ib, 1, 7));
    g.setAttribute('aC', new THREE.InterleavedBufferAttribute(this.ib, 3, 8)); g.setAttribute('aA', new THREE.InterleavedBufferAttribute(this.ib, 1, 11)); g.setAttribute('aW', new THREE.InterleavedBufferAttribute(this.ib, 1, 12));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.setDrawRange(0, 0);
    for (let i = 0; i < cap; i++) for (let j = 0; j < 4; j++) { const o = (i * 4 + j) * VS; this.V[o + 6] = j & 1 ? 1 : -1; this.V[o + 7] = j >> 1; }
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uGam: GAM, uInt: INT },
      vertexShader: `attribute vec3 aO; attribute float aSide; attribute float aEnd; attribute vec3 aC; attribute float aA; attribute float aW; varying vec3 vC; varying float vA; varying float vSd; varying float vEnd;
        void main(){ vC = aC; vA = aA; vSd = aSide; vEnd = aEnd;
          vec4 p0 = modelViewMatrix * vec4(position, 1.0); vec4 p1 = modelViewMatrix * vec4(aO, 1.0);
          vec3 d = p1.xyz - p0.xyz; vec3 n = cross(d, p0.xyz); float l = length(n); n = l < 1e-5 ? vec3(1.0, 0.0, 0.0) : n / l;
          float sg = aEnd > 0.5 ? -1.0 : 1.0; float wd = min(aW, max(-p0.z, 0.5) * 0.05); p0.xyz += n * aSide * sg * wd; gl_Position = projectionMatrix * p0; }`,
      fragmentShader: `uniform float uGam; uniform float uInt; varying vec3 vC; varying float vA; varying float vSd; varying float vEnd;
        void main(){ float s = abs(vSd); float core = exp(-s * s * 10.0); float glow = pow(1.0 - s, 1.8);
          vec3 c = mix(vC, vec3(1.0), core * 0.8); gl_FragColor = vec4(pow(max(c, vec3(0.0)), vec3(uGam)), vA * uInt * (glow * 0.5 + core * 0.8)); }`,
    });
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; scene.add(this.mesh); this.geo = g;
  }
  setLimit(n) { this.cap = Math.min(n, this.S.length / SS); this.n = Math.min(this.n, this.cap); }
  /** Segmento genérico. o = { kind, vel:[x,y,z], grav, w1 (ancho en B), a0, a1, c2 (color final), flick, shrink, len, speed, trail } */
  add(ax, ay, az, bx, by, bz, c, w, life, o = {}) {
    let i = this.n; if (i >= this.cap) { i = this.rr = (this.rr + 1) % this.cap; } else this.n++;
    const S = this.S, p = i * SS;
    S[p] = ax; S[p + 1] = ay; S[p + 2] = az; S[p + 3] = bx; S[p + 4] = by; S[p + 5] = bz;
    const v = o.vel; S[p + 6] = v ? v[0] : 0; S[p + 7] = v ? v[1] : 0; S[p + 8] = v ? v[2] : 0; S[p + 9] = o.grav || 0;
    S[p + 10] = life; S[p + 11] = life; S[p + 12] = w; S[p + 13] = o.w1 == null ? w : o.w1; S[p + 14] = o.a0 == null ? 1 : o.a0; S[p + 15] = o.a1 == null ? 1 : o.a1;
    col.set(c); S[p + 16] = col.r; S[p + 17] = col.g; S[p + 18] = col.b;
    if (o.c2 != null) { col.set(o.c2); S[p + 19] = col.r; S[p + 20] = col.g; S[p + 21] = col.b; } else { S[p + 19] = S[p + 16]; S[p + 20] = S[p + 17]; S[p + 21] = S[p + 18]; }
    S[p + 22] = o.kind || 0; S[p + 23] = o.flick || 0; S[p + 24] = o.shrink == null ? 0.6 : o.shrink; S[p + 25] = o.len || 0; S[p + 26] = o.speed || 0; S[p + 27] = 0; S[p + 28] = o.trail || 0; S[p + 29] = o.fade == null ? 1 : o.fade;
    return i;
  }
  update(dt) {
    const S = this.S, V = this.V; let n = this.n;
    if (!n) { this.geo.setDrawRange(0, 0); return; }
    for (let i = 0; i < n; i++) {
      const p = i * SS; S[p + 10] -= dt;
      if (S[p + 22] === 1) { // chispa: vuela, cae y deja una cola corta
        const dm = Math.max(0, 1 - 1.4 * dt); S[p + 6] *= dm; S[p + 7] = S[p + 7] * dm + this.fx.gy * S[p + 9] * dt; S[p + 8] *= dm; S[p + 6] += this.fx.gx * S[p + 9] * dt; S[p + 8] += this.fx.gz * S[p + 9] * dt;
        S[p] += S[p + 6] * dt; S[p + 1] += S[p + 7] * dt; S[p + 2] += S[p + 8] * dt;
        const k = S[p + 25] || 0.045; S[p + 3] = S[p] - S[p + 6] * k; S[p + 4] = S[p + 1] - S[p + 7] * k; S[p + 5] = S[p + 2] - S[p + 8] * k;
      } else if (S[p + 22] === 2) { // dardo: la cabeza viaja; muere cuando la cola llega al final
        S[p + 27] += S[p + 26] * dt; if (S[p + 27] - S[p + 25] >= S[p + 9]) S[p + 10] = 0; else S[p + 10] = Math.max(S[p + 10], 0.05);
      }
    }
    // compactar muertos
    for (let i = n - 1; i >= 0; i--) {
      if (S[i * SS + 10] > 0) continue;
      n--; if (i !== n) S.copyWithin(i * SS, n * SS, n * SS + SS);
    }
    this.n = n;
    for (let i = 0; i < n; i++) this.write(i);
    this.ib.needsUpdate = true; this.geo.setDrawRange(0, n * 6);
  }
  write(i) {
    const S = this.S, V = this.V, p = i * SS, t = Math.max(0, S[p + 10] / S[p + 11]), kind = S[p + 22];
    let ax = S[p], ay = S[p + 1], az = S[p + 2], bx = S[p + 3], by = S[p + 4], bz = S[p + 5], envA = 1;
    if (kind === 2) { // dardo: cabeza y cola sobre la recta A→B (guardada en vel = dirección, grav = distancia)
      const tot = S[p + 9], dx = S[p + 6], dy = S[p + 7], dz = S[p + 8], tr = S[p + 27], L = S[p + 25], h = Math.min(tr, tot), tl = Math.min(Math.max(0, tr - L), tot);
      bx = ax + dx * h; by = ay + dy * h; bz = az + dz * h; ax = ax + dx * tl; ay = ay + dy * tl; az = az + dz * tl;
      envA = tr > tot ? Math.max(0, 1 - (tr - tot) / Math.max(L, 1e-3)) : 1;
    } else envA = Math.pow(t, S[p + 29]);
    const fl = S[p + 23] ? 1 - S[p + 23] * Math.random() : 1, sh = kind === 2 ? 1 : (1 - S[p + 24]) + S[p + 24] * t;
    const w0 = S[p + 12] * sh, w1 = S[p + 13] * sh, a0 = S[p + 14] * envA * fl, a1 = S[p + 15] * envA * fl;
    const u = 1 - t, s = u * u * (3 - 2 * u), r = S[p + 16] + (S[p + 19] - S[p + 16]) * s, g = S[p + 17] + (S[p + 20] - S[p + 17]) * s, b = S[p + 18] + (S[p + 21] - S[p + 18]) * s;
    for (let j = 0; j < 4; j++) {
      const o = (i * 4 + j) * VS, endB = j >> 1;
      V[o] = endB ? bx : ax; V[o + 1] = endB ? by : ay; V[o + 2] = endB ? bz : az; V[o + 3] = endB ? ax : bx; V[o + 4] = endB ? ay : by; V[o + 5] = endB ? az : bz;
      V[o + 8] = r; V[o + 9] = g; V[o + 10] = b; V[o + 11] = endB ? a1 : a0; V[o + 12] = endB ? w1 : w0;
    }
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); }
}

/* ───────────────────────── Texturas generadas ───────────────────────── */
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeTextures() {
  const glow = canvasTex(128, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.18, 'rgba(255,255,255,0.7)'); r.addColorStop(0.5, 'rgba(255,255,255,0.14)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
  const ring = canvasTex(256, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, s * 0.30, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,255,255,0.18)'); r.addColorStop(0.82, 'rgba(255,255,255,1)'); r.addColorStop(0.9, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
  const shock = canvasTex(256, (g, s) => { const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.5, 'rgba(255,255,255,0.05)'); r.addColorStop(0.8, 'rgba(255,255,255,0.45)'); r.addColorStop(0.93, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s); });
  const burst = canvasTex(256, (g, s) => {
    g.translate(s / 2, s / 2); const r = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.22); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.beginPath(); g.arc(0, 0, s * 0.22, 0, 6.283); g.fill();
    for (let i = 0; i < 8; i++) { g.save(); g.rotate(i * Math.PI / 4 + 0.2); const L = s * (i % 2 ? 0.28 : 0.48), gr = g.createLinearGradient(0, 0, L, 0); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -s * 0.02); g.lineTo(L, 0); g.lineTo(0, s * 0.02); g.fill(); g.restore(); }
  });
  const scorch = canvasTex(128, (g, s) => {
    g.clearRect(0, 0, s, s); const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); r.addColorStop(0, 'rgba(255,255,255,0.95)'); r.addColorStop(0.45, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, s, s);
    g.globalCompositeOperation = 'destination-out'; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, d = (0.3 + rnd() * 0.7) * s * 0.5; g.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.5})`; g.beginPath(); g.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, 2 + rnd() * 7, 0, 6.283); g.fill(); }
  });
  return { glow, ring, shock, burst, scorch };
}

/* ───────────────────────── Efectos ───────────────────────── */
export class Effects {
  constructor(scene, cap = 3000, q = {}) {
    this.scene = scene; this.tier = tierOf(q); this.T = TIERS[this.tier]; this.dens = this.T.dens;
    this.cap = MAXT.live; this.gx = 0; this.gy = -1; this.gz = 0; this.cam = null; this.t = 0; this.updaters = [];
    this.add = new Particles(scene, MAXT.live, THREE.AdditiveBlending);
    this.smoke = new Particles(scene, MAXT.smoke, THREE.NormalBlending); this.smoke.points.renderOrder = 2; this.add.points.renderOrder = 3;
    this.strips = new Strips(scene, MAXT.segs, this);
    this.tex = makeTextures();
    // anillos (planos con textura)
    const pg = new THREE.PlaneGeometry(2, 2); this.rings = [];
    for (let i = 0; i < MAXT.rings; i++) { const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: this.tex.ring, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.visible = false; m.life = 0; m.userData = {}; m.renderOrder = 3; scene.add(m); this.rings.push(m); }
    this.ri = 0;
    // destellos (sprites)
    this.flashes = []; for (let i = 0; i < MAXT.flashes; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); s.visible = false; s.life = 0; s.userData = {}; s.renderOrder = 5; scene.add(s); this.flashes.push(s); }
    this.fi = 0;
    // marcas en superficie (quemadura / mancha de fluido)
    this.decals = []; for (let i = 0; i < MAXT.decals; i++) { const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: this.tex.scorch, color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, opacity: 0.8 })); m.visible = false; m.life = 0; m.userData = {}; m.renderOrder = 1; scene.add(m); this.decals.push(m); }
    this.di = 0;
    // ondas esféricas (energía): cáscara con borde luminoso
    this.blasts = []; const bg = new THREE.SphereGeometry(1, 20, 14);
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uC: { value: new THREE.Color(0xffffff) }, uO: { value: 0.5 }, uGam: GAM, uInt: INT },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform vec3 uC; uniform float uO; uniform float uGam; uniform float uInt; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.4); gl_FragColor = vec4(pow(uC, vec3(uGam)), (f + 0.05) * uO * uInt); }` });
      const m = new THREE.Mesh(bg, mat); m.visible = false; m.life = 0; scene.add(m); this.blasts.push(m);
    }
    this.bi = 0;
    // esquirlas sólidas (cristal / quitina) con física simple
    this.chunks = []; this.ci = 0; const cg = new THREE.TetrahedronGeometry(1, 0);
    for (let i = 0; i < MAXT.chunks; i++) { const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.2, flatShading: true, emissive: 0xffffff, emissiveIntensity: 0.55, transparent: true })); m.visible = false; m.life = 0; m.vel = new THREE.Vector3(); m.spin = new THREE.Vector3(); scene.add(m); this.chunks.push(m); }
    this.combat = new CombatFx(this);
    this.configure(q);
  }
  /** Ajusta los pools a la calidad actual. */
  configure(q = {}) {
    this.tier = tierOf(q); this.T = TIERS[this.tier]; this.dens = this.T.dens; const T = this.T;
    this.add.limit = T.live; this.add.head = 0; this.smoke.limit = T.smoke; this.smoke.head = 0; this.add.clear(); this.smoke.clear();
    this.strips.setLimit(T.segs); this.strips.clear();
    this.nRings = Math.min(this.rings.length, T.rings); this.nFlashes = Math.min(this.flashes.length, T.flashes); this.nDecals = Math.min(this.decals.length, T.decals); this.nChunks = Math.min(this.chunks.length, T.chunks);
    for (const m of [...this.rings, ...this.flashes, ...this.decals, ...this.chunks, ...this.blasts]) { m.visible = false; m.life = 0; }
    this.combat.configure(this.tier);
  }
  setView(camera, heightPx, up) { this.cam = camera; if (heightPx) UH.value = heightPx; if (up) { this.gx = -up.x; this.gy = -up.y; this.gz = -up.z; } }

  /* ── partículas de alto nivel ── */
  /** Chorro de partículas. o: { dir:Vector3, cone (rad), c2, grav, drag, grow, shape, spin, size2 (variación), smoke:bool, up (empuje extra hacia arriba), ring:bool (plano ⟂ dir) } */
  spray(p, color, n, speed, life, size, o = {}) {
    const sys = o.smoke ? this.smoke : this.add; { const f = n * (o.raw ? 1 : this.dens); n = Math.floor(f) + (Math.random() < f - Math.floor(f) ? 1 : 0); }
    const c1 = col.set(color).clone(), c2 = o.c2 != null ? new THREE.Color(o.c2) : c1;
    const dir = o.dir, cone = o.cone == null ? Math.PI : o.cone, grav = o.grav || 0, drag = o.drag == null ? 2.2 : o.drag, grow = o.grow == null ? -0.7 : o.grow, shape = o.shape || 0, spin = o.spin || 0, sv = o.sizeVar == null ? 0.6 : o.sizeVar;
    let ux, uy, uz, vx, vy, vz;
    if (dir) { tmpA.copy(dir).normalize(); tmpB.set(Math.abs(tmpA.y) < 0.9 ? 0 : 1, Math.abs(tmpA.y) < 0.9 ? 1 : 0, 0).cross(tmpA).normalize(); tmpC.copy(tmpA).cross(tmpB); ux = tmpB; uz = tmpC; }
    for (let i = 0; i < n; i++) {
      let dx, dy, dz;
      if (dir) { const a = Math.random() * 6.283, ph = Math.acos(1 - Math.random() * (1 - Math.cos(cone))), sa = Math.sin(ph), cx = Math.cos(a) * sa, cz = Math.sin(a) * sa, cy = Math.cos(ph); dx = tmpA.x * cy + ux.x * cx + uz.x * cz; dy = tmpA.y * cy + ux.y * cx + uz.y * cz; dz = tmpA.z * cy + ux.z * cx + uz.z * cz; }
      else { dx = Math.random() * 2 - 1; dy = Math.random() * 2 - 1; dz = Math.random() * 2 - 1; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l; }
      if (o.flat) { const k = dx * o.flat.x + dy * o.flat.y + dz * o.flat.z; dx -= o.flat.x * k; dy -= o.flat.y * k; dz -= o.flat.z * k; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l; }
      const sp = speed * (0.3 + Math.random() * 0.7);
      const px = p.x + (o.jit ? (Math.random() - 0.5) * o.jit : 0), py = p.y + (o.jit ? (Math.random() - 0.5) * o.jit : 0), pz = p.z + (o.jit ? (Math.random() - 0.5) * o.jit : 0);
      sys.spawn(px, py, pz, dx * sp - this.gx * (o.up || 0), dy * sp - this.gy * (o.up || 0), dz * sp - this.gz * (o.up || 0), c1, c2, size * (1 - sv * 0.5 + Math.random() * sv), life * (0.55 + Math.random() * 0.45), grav, drag, grow, shape, spin * (Math.random() - 0.5) * 2, o.amp == null ? 1 : o.amp);
    }
  }
  /** Compatibilidad: ráfaga esférica simple. */
  burst(p, color, n, speed, life, size) { this.spray(p, color, n, speed, life, size * 1.4, { grow: -0.72, drag: 2.2 }); }
  /** Chispas alargadas (cintas con física). */
  sparks(p, color, n, speed, life = 0.45, o = {}) {
    { const f = n * Math.max(this.dens, 0.5); n = Math.floor(f) + (Math.random() < f - Math.floor(f) ? 1 : 0); } const dir = o.dir, cone = o.cone == null ? Math.PI : o.cone;
    for (let i = 0; i < n; i++) {
      let dx = Math.random() * 2 - 1, dy = Math.random() * 2 - 1, dz = Math.random() * 2 - 1; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
      if (dir) { tmpA.copy(dir).normalize(); const k = cone / Math.PI; dx = tmpA.x * (1 - k) + dx * k; dy = tmpA.y * (1 - k) + dy * k; dz = tmpA.z * (1 - k) + dz * k; const m = Math.hypot(dx, dy, dz) || 1; dx /= m; dy /= m; dz /= m; }
      const s = speed * (0.4 + Math.random() * 0.8);
      this.strips.add(p.x, p.y, p.z, p.x, p.y, p.z, color, o.w || 0.05, life * (0.6 + Math.random() * 0.6), { kind: SEG.spark, vel: [dx * s, dy * s, dz * s], grav: o.grav == null ? 14 : o.grav, c2: o.c2, a0: 1, a1: 0.2, len: o.tail || 0.05, shrink: 0.7 });
    }
  }
  /** Cinta recta (rayo, haz, estela). */
  line(a, b, color, width, life, o = {}) { return this.strips.add(a.x, a.y, a.z, b.x, b.y, b.z, color, width, life, o); }
  /** Dardo: cabeza luminosa que viaja de a a b (px/seg `speed`) con cola de largo `len`. */
  dart(a, b, color, width, speed, len, o = {}) {
    tmpA.copy(b).sub(a); const d = tmpA.length(); if (d < 0.01) return; tmpA.multiplyScalar(1 / d);
    return this.strips.add(a.x, a.y, a.z, b.x, b.y, b.z, color, width, 2, { ...o, kind: SEG.dart, vel: [tmpA.x, tmpA.y, tmpA.z], grav: d, speed, len });
  }
  /** Compatibilidad: trazo corto y brillante. */
  tracer(a, b, color, w = 0.05, life = 0.12) { this.line(a, b, color, w, life, { shrink: 0.3 }); this.line(a, b, color, w * 3, life, { a0: 0.3, a1: 0.3, shrink: 0.2 }); }

  /* ── mallas planas ── */
  ring(p, normal, color, r1, life, o = {}) {
    const m = this.rings[this.ri]; this.ri = (this.ri + 1) % this.nRings;
    m.position.copy(p); if (normal) { m.quaternion.setFromUnitVectors(Z, normal); m.position.addScaledVector(normal, o.lift == null ? 0.05 : o.lift); } else if (this.cam) m.quaternion.copy(this.cam.quaternion);
    m.material.map = o.shock ? this.tex.shock : this.tex.ring; m.material.color.set(color); m.userData = { r0: o.r0 == null ? 0.1 : o.r0, r1, max: life, op: o.op == null ? 0.9 : o.op, ease: o.ease == null ? 0.5 : o.ease, bill: !normal, roll: o.roll || 0 };
    m.scale.setScalar(m.userData.r0); m.life = life; m.visible = true; m.material.opacity = m.userData.op; return m;
  }
  /** Onda de choque con "distorsión" falsa: tres anillos con el color separado (aberración cromática). */
  ringChroma(p, normal, r1, life, o = {}) {
    const s = o.split == null ? 0.07 : o.split;
    this.ring(p, normal, 0xff5a5a, r1 * (1 + s), life, { ...o, op: (o.op || 0.8) * 0.8 }); this.ring(p, normal, 0x5aff8a, r1, life, { ...o, op: (o.op || 0.8) * 0.8 }); this.ring(p, normal, 0x5a8aff, r1 * (1 - s), life, { ...o, op: (o.op || 0.8) * 0.8 });
  }
  flash(p, color, size, life = 0.12, o = {}) {
    const s = this.flashes[this.fi]; this.fi = (this.fi + 1) % this.nFlashes;
    s.position.copy(p); s.material.map = o.burst ? this.tex.burst : this.tex.glow; s.material.color.set(color); s.material.rotation = o.rot == null ? Math.random() * 6.283 : o.rot;
    s.userData = { size, max: life, op: o.op == null ? 1 : o.op, grow: o.grow == null ? 1.3 : o.grow }; s.life = life; s.scale.setScalar(size); s.visible = true; s.material.opacity = s.userData.op; return s;
  }
  decal(p, normal, color, size, life = 4, o = {}) {
    const m = this.decals[this.di]; this.di = (this.di + 1) % this.nDecals;
    m.position.copy(p).addScaledVector(normal, 0.04); m.quaternion.setFromUnitVectors(Z, normal); m.rotateZ(Math.random() * 6.283);
    m.material.color.set(color); m.userData = { max: life, op: o.op == null ? 0.7 : o.op }; m.scale.setScalar(size); m.life = life; m.visible = true; m.material.opacity = m.userData.op; return m;
  }
  /** Compatibilidad: onda esférica de energía. */
  blast(p, color, radius, life) {
    const m = this.blasts[this.bi]; this.bi = (this.bi + 1) % this.blasts.length;
    m.position.copy(p); m.material.uniforms.uC.value.set(color); m.userData = { r: radius, max: life }; m.life = life; m.visible = true; m.scale.setScalar(0.01);
  }
  /** Muerte de una criatura: trozos sólidos que giran y caen + fluido luminoso (ícor), sin gore. */
  shatter(p, color, { size = 0.5, n = 8, speed = 9, dir = null } = {}) {
    const c = new THREE.Color(color), nn = Math.min(n, this.nChunks);
    for (let i = 0; i < nn; i++) {
      const m = this.chunks[this.ci]; this.ci = (this.ci + 1) % this.nChunks;
      m.position.copy(p); m.scale.set(size * (0.3 + Math.random() * 0.5), size * (0.5 + Math.random() * 0.8), size * (0.3 + Math.random() * 0.5)); m.material.color.copy(c).multiplyScalar(0.8); m.material.emissive.copy(c); m.material.opacity = 1;
      m.vel.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(speed * (0.4 + Math.random())); if (dir) m.vel.addScaledVector(dir, speed * 0.5);
      m.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14); m.life = 1.3; m.visible = true;
    }
    this.spray(p, color, n * 3, speed * 0.8, 1.1, size * 1.4, { grow: -0.6, grav: 4 });
  }

  update(dt) {
    this.t += dt; GAM.value = OUT.linear ? 1 : 1 / 2.2; INT.value = OUT.linear ? 0.6 : 1; const KI = INT.value;
    this.add.update(dt, this.gx, this.gy, this.gz); this.smoke.update(dt, this.gx * 0.3, this.gy * 0.3, this.gz * 0.3); this.strips.update(dt);
    for (const m of this.chunks) if (m.visible) { m.life -= dt; m.vel.multiplyScalar(1 - 0.8 * dt); m.vel.x += this.gx * 9 * dt; m.vel.y += this.gy * 9 * dt; m.vel.z += this.gz * 9 * dt; m.position.addScaledVector(m.vel, dt); m.rotation.x += m.spin.x * dt; m.rotation.y += m.spin.y * dt; m.rotation.z += m.spin.z * dt; m.material.opacity = Math.min(1, m.life * 1.5); if (m.life <= 0) m.visible = false; }
    for (const m of this.rings) if (m.visible) {
      m.life -= dt; const u = Math.min(1, 1 - m.life / m.userData.max), e = 1 - Math.pow(1 - u, 1 / Math.max(0.2, m.userData.ease * 2));
      m.scale.setScalar(m.userData.r0 + (m.userData.r1 - m.userData.r0) * e); m.material.opacity = m.userData.op * KI * (1 - u) * (1 - u * 0.3);
      if (m.userData.bill && this.cam) { m.quaternion.copy(this.cam.quaternion); if (m.userData.roll) m.rotateZ(m.userData.roll * u); }
      if (m.life <= 0) m.visible = false;
    }
    for (const s of this.flashes) if (s.visible) { s.life -= dt; const u = Math.min(1, 1 - s.life / s.userData.max); s.scale.setScalar(s.userData.size * (1 + (s.userData.grow - 1) * u)); s.material.opacity = s.userData.op * KI * (1 - u) * (1 - u); if (s.life <= 0) s.visible = false; }
    for (const m of this.decals) if (m.visible) { m.life -= dt; const u = 1 - m.life / m.userData.max; m.material.opacity = m.userData.op * (u < 0.1 ? u * 10 : 1 - (u - 0.1) / 0.9); if (m.life <= 0) m.visible = false; }
    for (const m of this.blasts) if (m.visible) {
      m.life -= dt; const t = 1 - m.life / m.userData.max; m.scale.setScalar(Math.max(0.01, m.userData.r * (0.15 + 0.85 * (1 - (1 - t) * (1 - t))))); m.material.uniforms.uO.value = Math.max(0, 0.9 * (1 - t));
      if (m.life <= 0) m.visible = false;
    }
    for (const f of this.updaters) f(dt);
  }
}
