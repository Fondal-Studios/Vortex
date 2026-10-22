// Combate visual de Cristal Vórtice: QUÉ se ve en cada disparo, impacto, muerte, explosión y daño.
// La maquinaria (pools de partículas, cintas, anillos) vive en effects.js; acá sólo se "dirige" el espectáculo.
// Se crea solo: `new Effects(...)` construye `fx.combat`. render.js llama `combat.frame(...)` y `combat.event(...)`.
import * as THREE from 'three';
import { WEAPONS, CHARACTERS } from '../sim/data.js';
import { WEAPON_COLORS } from './shotfx.js';
import { COLORS } from './models.js';
import { SHAPE, GAM } from './effects.js';
import { flashTexture } from './weapons/fx.js'; // sólo lectura: el dibujo del fogonazo de cada arma (estrella, abanico, rayo, hielo...)

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const WN = WEAPONS.map((w) => w.id);
const PROJ_W = new Set([3, 9, 10, 11, 12, 19]);
const rnd = (a = 1) => Math.random() * a;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const _color = new THREE.Color(), _white = new THREE.Color(0xffffff);
const _u = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _q = new THREE.Vector3();
function perp(dir, u, w) { u.crossVectors(dir, Math.abs(dir.y) < 0.9 ? Y : X).normalize(); w.crossVectors(dir, u).normalize(); }
function segDist(p, a, b) { _d.copy(b).sub(a); const l2 = _d.lengthSq() || 1e-6; const t = clamp(_t.copy(p).sub(a).dot(_d) / l2, 0, 1); return _q.copy(a).addScaledVector(_d, t).distanceTo(p); }
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

/** Material de cada criatura: decide el "tipo de golpe" (fluido, esquirlas de cristal, polvo de roca, ondas de energía). */
const MATERIAL = { astilla: 'bio', racimo: 'bio', ariete: 'bio', madre: 'bio', argos: 'bio', geoda: 'rock', prisma: 'glass', lente: 'glass', espejo: 'glass', cuarzo: 'glass', obelisco: 'glass', coloso: 'glass', graviton: 'energy', aurora: 'energy', espiral: 'energy' };
/** Estilo de daño por arma (color del número, tipo de impacto). */
const WSTYLE = {
  haz: 'spark', prisma: 'crystal', rafaga: 'spark', nova: 'blast', aguja: 'ring', pulso: 'ring', gemelas: 'spark', solar: 'fire', fractal: 'poisonlight', enjambre: 'blast', cometa: 'blast',
  vortice: 'void', lanza: 'crystal', cetro: 'life', eclipse: 'void', voltaico: 'shock', glaciar: 'frost', plaga: 'poison', brasa: 'fire', mina: 'blast', sierra: 'slash', pulsar: 'ring', dardos: 'crystal', requiem: 'void', quimera: 'ring',
};
const NUMCOL = { phys: 0xfff3c0, spark: 0xfff3c0, ring: 0xdff8ff, crystal: 0xb8fff0, fire: 0xff9a3a, frost: 0xa8ecff, poison: 0x8dff5a, poisonlight: 0xb6ff6a, shock: 0x8ac0ff, void: 0xc79cff, blast: 0xffb04a, slash: 0xff8aa0, life: 0x8dffb0, armor: 0xaab0c8 };

/* ═══════════════════════ Números de daño 3D ═══════════════════════ */
const GLY = '0123456789!+x.';
class DamageNumbers {
  constructor(scene) {
    this.scene = scene; this.cap = 24; this.items = []; this.maxQuads = 24 * 7;
    const cw = 64, ch = 96, cols = 8, c = document.createElement('canvas'); c.width = cw * cols; c.height = ch * 2; const g = c.getContext('2d');
    g.font = 'italic 900 74px "Arial Black","Impact","Trebuchet MS",system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    for (let i = 0; i < GLY.length; i++) { const x = (i % cols) * cw + cw / 2, y = Math.floor(i / cols) * ch + ch / 2 + 4; g.lineWidth = 13; g.strokeStyle = 'rgba(8,4,24,0.95)'; g.strokeText(GLY[i], x, y); g.fillStyle = '#fff'; g.fillText(GLY[i], x, y); }
    this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace; this.cw = cw; this.ch = ch; this.cols = cols;
    const VS = 12; this.VS = VS; this.V = new Float32Array(this.maxQuads * 4 * VS);
    const idx = new Uint16Array(this.maxQuads * 6); for (let i = 0; i < this.maxQuads; i++) { const v = i * 4; idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6); }
    const ib = new THREE.InterleavedBuffer(this.V, VS); ib.setUsage(THREE.DynamicDrawUsage); this.ib = ib;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0)); geo.setAttribute('aOff', new THREE.InterleavedBufferAttribute(ib, 2, 3)); geo.setAttribute('aUv', new THREE.InterleavedBufferAttribute(ib, 2, 5));
    geo.setAttribute('aCol', new THREE.InterleavedBufferAttribute(ib, 3, 7)); geo.setAttribute('aA', new THREE.InterleavedBufferAttribute(ib, 1, 10)); geo.setAttribute('aS', new THREE.InterleavedBufferAttribute(ib, 1, 11));
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.setDrawRange(0, 0);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, uniforms: { uMap: { value: this.tex }, uK: { value: 0.082 }, uGam: GAM, uMul: { value: 1 } },
      vertexShader: `uniform float uK; attribute vec2 aOff; attribute vec2 aUv; attribute vec3 aCol; attribute float aA; attribute float aS; varying vec2 vUv; varying vec3 vCol; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float dist = clamp(-mv.z, 2.0, 90.0); mv.xy += aOff * aS * dist * uK; vUv = aUv; vCol = aCol; vA = aA; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uGam; uniform float uMul; varying vec2 vUv; varying vec3 vCol; varying float vA;
        void main(){ vec4 t = texture2D(uMap, vUv); vec3 c = t.rgb * vCol * uMul; gl_FragColor = vec4(pow(max(c, vec3(0.0)), vec3(uGam)), t.a * vA); }`,
    });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 20; scene.add(this.mesh); this.geo = geo;
  }
  setCap(n) { this.cap = Math.min(24, n); while (this.items.length > this.cap) this.items.shift(); }
  /** value: número; o: { key (para acumular), color, size, crit, text } */
  add(pos, value, o = {}) {
    const now = performance.now() / 1000;
    if (o.key != null) { // acumular golpes rápidos sobre la misma criatura
      for (const it of this.items) if (it.key === o.key && !it.crit && !o.crit && now - it.last < 0.42 && it.age < 1.2) {
        it.value += value; it.last = now; it.age = Math.min(it.age, 0.25); it.pop = 1; it.hits++; it.base.copy(pos).lerp(it.base, 0.4); it.size = Math.max(it.size, o.size || 1) * 1.04; it.color = o.color; this.layout(it); return it;
      }
    }
    if (this.items.length >= this.cap) this.items.shift();
    const it = { key: o.key, base: pos.clone(), value, color: o.color || 0xffffff, size: o.size || 1, crit: !!o.crit, age: 0, max: o.crit ? 1.25 : 0.95, last: now, pop: 1, hits: 1, text: o.text || null, dx: (Math.random() - 0.5) * 1.4, dz: (Math.random() - 0.5) * 1.4, glyphs: [] };
    this.layout(it); this.items.push(it); return it;
  }
  layout(it) {
    const s = (it.text || String(Math.max(1, Math.round(it.value)))) + (it.crit && !it.text ? '!' : ''); it.glyphs = [];
    for (const ch of s.slice(0, 7)) { const i = GLY.indexOf(ch); if (i >= 0) it.glyphs.push(i); }
  }
  update(dt, cam, up) {
    const V = this.V, VS = this.VS; let q = 0; this.mesh.material.uniforms.uMul.value = GAM.value >= 1 ? 0.72 : 1;
    if (cam) { _u.set(1, 0, 0).applyQuaternion(cam.quaternion); }
    for (let n = this.items.length - 1; n >= 0; n--) {
      const it = this.items[n]; it.age += dt; it.pop = Math.max(0, it.pop - dt * 7); if (it.age >= it.max) { this.items.splice(n, 1); continue; }
    }
    for (const it of this.items) {
      const k = it.age / it.max, rise = (1 - Math.pow(1 - k, 2.2)) * (it.crit ? 2.6 : 1.9) + 0.3, a = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      const pop = 1 + it.pop * 0.5 + (it.age < 0.12 ? (1 - it.age / 0.12) * (it.crit ? 0.9 : 0.35) : 0), sc = it.size * pop * (1 - Math.max(0, k - 0.75) * 0.8), sh = it.crit ? Math.sin(it.age * 90) * 0.04 * (1 - k) : 0;
      const px = it.base.x + _u.x * (it.dx * k + sh * 3) + up.x * rise, py = it.base.y + _u.y * (it.dx * k + sh * 3) + up.y * rise, pz = it.base.z + _u.z * (it.dx * k + sh * 3) + up.z * rise;
      const col = _color.setHex(it.color); const n = it.glyphs.length, gw = 0.56;
      for (let g = 0; g < n; g++) {
        if (q >= this.maxQuads) break;
        const gi = it.glyphs[g], u0 = (gi % this.cols) * this.cw / (this.cw * this.cols), v1 = 1 - Math.floor(gi / this.cols) * this.ch / (this.ch * 2), du = 1 / this.cols, dv = 0.5;
        const cx = (g - (n - 1) / 2) * gw;
        for (let j = 0; j < 4; j++) {
          const o = (q * 4 + j) * VS, sx = j & 1 ? 1 : -1, sy = j >> 1 ? -1 : 1;
          V[o] = px; V[o + 1] = py; V[o + 2] = pz; V[o + 3] = cx + sx * 0.34; V[o + 4] = sy * 0.52; V[o + 5] = u0 + (j & 1 ? du : 0); V[o + 6] = v1 - (j >> 1 ? dv : 0);
          V[o + 7] = col.r; V[o + 8] = col.g; V[o + 9] = col.b; V[o + 10] = a; V[o + 11] = sc;
        }
        q++;
      }
    }
    this.geo.setDrawRange(0, q * 6); this.ib.needsUpdate = true;
  }
}

/* ═══════════════════════ Dirección del espectáculo ═══════════════════════ */
export class CombatFx {
  constructor(fx) {
    this.fx = fx; this.tier = fx.tier; this.nums = new DamageNumbers(fx.scene);
    this.cam = null; this.me = null; this.myId = -9; this.state = null; this.up = new THREE.Vector3(0, 1, 0);
    this.mon = new Map(); this.prevMon = new Map(); this.proj = new Map(); this.shots = []; this.booms = []; this.ended = []; this.skills = []; this.arcs = [];
    this.timers = []; this.gateT = new Map(); this.mzLocal = new THREE.Vector3(0.3, -0.25, -1.2); this.K = { p: 0, y: 0, r: 0, fov: 0, sh: 0, base: 82, lastFov: -1 }; this.camFlash = null; this.t = 0; this.lastNow = 0; this.dt = 1 / 60; this._sz = new THREE.Vector2(); this.acc = new Map(); this.lastHit = new Map(); this.tick = 0;
    fx.updaters.push((dt) => this.update(dt));
  }
  configure(tier) { this.tier = tier; this.nums.setCap(this.fx.T.nums); this.timers.length = 0; this.nums.items.length = 0; }
  later(t, fn) { this.timers.push({ t, fn }); }
  /** Probabilidad por cuadro para emitir `rate` partículas/seg. */
  rateN(rate) { const f = rate * this.dt * (this.tier === 0 ? 0.5 : 1); return Math.floor(f) + (Math.random() < f - Math.floor(f) ? 1 : 0); }
  monPos(m) { return V(m.p); }

  /* ───────── cuadro: estado → partículas continuas ───────── */
  frame(r, state, me) {
    const fx = this.fx, now = performance.now() / 1000; this.dt = clamp(now - (this.lastNow || now - 1 / 60), 1 / 240, 0.1); this.lastNow = now; this.tick++;
    if (!this.camFlash && r.camera) this.buildCamFlash(r);
    if (!r.__cfxHook && r.updateCamera) { r.__cfxHook = true; const orig = r.updateCamera.bind(r); r.updateCamera = (...a) => { orig(...a); this.postCamera(this.dt); }; } // patada de cámara: se aplica DESPUÉS de colocar la cámara
    this.r = r; this.cam = r.camera; this.state = state; this.me = me || null; this.myId = me ? me.id : -9;
    // arriba "de verdad" del lugar (la gravedad cambia: mapa 1 plano, mapa 2 esfera hueca, inversión, marea sin peso)
    const zero = !!(state.fx && state.fx.zero);
    if (me) { if (state.map === 'm2') this.up.set(-me.pos[0], -me.pos[1], -me.pos[2]).normalize(); else this.up.set(0, me.flip ? -1 : 1, 0); }
    r.gl.getDrawingBufferSize(this._sz);
    fx.setView(r.camera, this._sz.y, zero ? _t.set(0, 0, 0) : this.up);
    // criaturas
    this.prevMon = this.mon; this.mon = new Map(); for (const m of state.monsters) this.mon.set(m.id, m);
    // disparos y habilidades de este cuadro (para atribuir impactos y proyectiles)
    this.booms.length = 0; this.ended.length = 0; this.skills.length = 0; this.arcs.length = 0;
    for (let i = this.shots.length - 1; i >= 0; i--) if (this.t - this.shots[i].t > 0.8) this.shots.splice(i, 1);
    for (const e of state.events) {
      if (e.t === 'shot') { const o = V(e.o); this.shots.push({ t: this.t, w: e.w, pid: e.pid, o, tips: (e.to || []).map(V), fx: e.fx || null }); }
      else if (e.t === 'skill') this.skills.push({ id: e.id, pid: e.pid, p: V(e.p) });
      else if (e.t === 'arc') { let w = -1; for (const s of this.shots) if (WEAPONS[s.w] && WEAPONS[s.w].chain) w = s.w; if (w < 0 && this.shots.length) w = this.shots[this.shots.length - 1].w; this.arcs.push({ p: V(e.to), w }); }
    }
    // proyectiles: seguir, atribuir arma, estela, y detectar los que terminaron
    const seen = new Set();
    for (const p of state.projectiles) {
      seen.add(p.id); let pr = this.proj.get(p.id); const pos = V(p.p), vel = V(p.v);
      if (!pr) {
        pr = { w: Number.isInteger(p.w) ? p.w : -1, owner: p.o, k: p.k, last: pos.clone(), age: 0 };
        if (p.o === 'p' && pr.w < 0) {
          let best = 14; for (const s of this.shots) if (PROJ_W.has(s.w) && s.o.distanceTo(pos) < best) { best = s.o.distanceTo(pos); pr.w = s.w; }
          if (pr.w < 0) for (const s of this.skills) { if (s.id === 'cohete' && s.p.distanceTo(pos) < 14) pr.w = 100; else if (s.id === 'singularidad' && s.p.distanceTo(pos) < 14) pr.w = 101; }
          if (pr.w < 0 && p.k === 'mina') pr.w = 19; if (pr.w < 0 && p.k === 'lanza') pr.w = 12; if (pr.w < 0 && p.k === 'swarm') pr.w = 9; if (pr.w < 0) pr.w = 3;
        }
        this.proj.set(p.id, pr);
      }
      pr.age += this.dt; this.trail(pr, pos, vel); pr.last.copy(pos); pr.vel = vel;
    }
    for (const [id, pr] of this.proj) if (!seen.has(id)) { this.ended.push({ w: pr.w, p: pr.last.clone(), owner: pr.owner, k: pr.k }); this.proj.delete(id); }
    // criaturas con estado: veneno / fuego / hielo / marca / herida
    const cp = this.cam.position; let n = 0;
    for (const m of state.monsters) {
      const dx = m.p[0] - cp.x, dy = m.p[1] - cp.y, dz = m.p[2] - cp.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 > 3600 || n >= (this.tier === 0 ? 4 : 10)) continue;
      const ef = m.ef || 0, wounded = m.mh && m.hp < m.mh * 0.3; if (!ef && !m.mk && !wounded) continue; n++;
      this.status(m, ef, wounded);
    }
    // objetos del director: pozos, minas, cúpula, torreta
    for (const o of state.objs || []) this.objectFx(o);
  }

  /* ───────── estelas de proyectiles ───────── */
  trail(pr, p, v) {
    const fx = this.fx, w = pr.w, tier = this.tier; if (tier === 0 && (this.tick & 1)) return;
    if (pr.owner === 'p' && this.cam && p.distanceTo(this.cam.position) < 5) return;
    const dir = _d.copy(v).normalize(), L = pr.last;
    if (pr.owner !== 'p') { // proyectiles enemigos: se tienen que LEER (magenta pulsante / azul de francotirador)
      const sn = pr.k === 'beam', c = sn ? 0x66f0ff : 0xff4fd8;
      if (sn) fx.line(L, p, c, 0.22, 0.3, { shrink: 0.9, a0: 0.9, a1: 0.9 }); else fx.line(L, p, c, 0.3, 0.28, { shrink: 0.9, a0: 0.8, a1: 0.8 });
      fx.spray(p, c, 1.2, 1.5, 0.45, 0.7, { grow: -0.8, drag: 3, c2: sn ? 0x2a60ff : 0x7a1a90 }); return;
    }
    // Independent of refresh rate: at most one signature per projectile per 90/150 ms.
    if (pr.age >= (pr.signatureAt || 0)) {
      pr.signatureAt = pr.age + (tier === 0 || this.reduced ? 0.15 : 0.09);
      const c = WEAPON_COLORS[w] || 0xff9a2a;
      if (w === 12) { // crystalline lance: narrow spearhead, no round plasma silhouette
        fx.line(p, p.clone().addScaledVector(dir, 1.5), c, 0.10, 0.12, { a0: 1, a1: 0, shrink: 0.8 });
      } else if (w === 11 || w === 101) { // void: contracting orbital collars
        fx.ring(p, dir, c, 0.18, 0.3, { r0: 0.85, th: 0.06, op: 0.6 });
      } else if (w === 9) { // swarm: paired wings around the flight axis
        perp(dir, _u, _w);
        for (const sign of [-1, 1]) fx.line(p, p.clone().addScaledVector(_u, sign * 0.45).addScaledVector(dir, -0.65), c, 0.07, 0.16, { a0: 0.8, a1: 0, shrink: 0.8 });
      } else if (w === 10) { // comet: compression rings
        fx.ring(p, dir, c, 0.7, 0.22, { r0: 0.15, th: 0.05, op: 0.45 });
      } else if (w === 3 || w === 100) { // rocket: exhaust thrust, short and directional
        fx.line(p, p.clone().addScaledVector(dir, -1.3), c, 0.25, 0.12, { a0: 0.7, a1: 0, shrink: 0.7 });
      } else if (w === 19) fx.ring(p, this.up, c, 0.65, 0.35, { r0: 0.2, th: 0.06, op: 0.5 });
    }
    switch (w) {
      case 3: fx.spray(p, 0xffa040, 2, 3, 0.4, 1.0, { grow: 0.5, drag: 3, c2: 0x8a1a10 }); fx.spray(p, 0x3a2030, 1, 1.5, 0.9, 1.0, { smoke: true, grow: 1.6, drag: 2, shape: SHAPE.smoke, c2: 0x1a1020, spin: 2 }); fx.sparks(p, 0xffd080, 1, 6, 0.3, { dir: _t.copy(dir).negate(), cone: 1, grav: 6 }); break;
      case 9: fx.line(L, p, 0xff9ad8, 0.12, 0.35, { shrink: 0.9, a0: 0.8, a1: 0.5 }); fx.spray(p, 0xe8b8d8, 1, 1, 0.8, 0.7, { smoke: true, grow: 1.5, drag: 2.5, shape: SHAPE.smoke, c2: 0x6a3a5a, spin: 2 }); break;
      case 10: fx.line(L, p, 0xffb35c, 0.42, 0.65, { shrink: 0.95, a0: 0.9, a1: 0.9, c2: 0xff3a1a }); fx.line(L, p, 0xfff0d0, 0.12, 0.4, { shrink: 0.9, a0: 1, a1: 1 }); fx.spray(p, 0xffe6a0, 1.5, 2.2, 0.8, 0.8, { shape: SHAPE.star, grow: -0.9, drag: 2, c2: 0xff5a2a, spin: 4 }); break;
      case 11: case 101: { perp(dir, _u, _w); const a = this.t * 16, R = w === 101 ? 1.2 : 0.8; for (let i = 0; i < 2; i++) { const ph = a + i * Math.PI; _t.copy(p).addScaledVector(_u, Math.cos(ph) * R).addScaledVector(_w, Math.sin(ph) * R); fx.spray(_t, i ? 0x66ffee : 0xb98cff, 1, 0.3, 0.45, 0.8, { grow: -0.7, drag: 4, c2: 0x3a1a8a, raw: tier > 0 }); } fx.spray(p, 0x1a0a30, 0.6, 0.5, 0.5, 1.3, { smoke: true, shape: SHAPE.smoke, drag: 3 }); break; }
      case 12: fx.line(L, p, 0xe8f6ff, 0.28, 0.35, { shrink: 0.9, a0: 1, a1: 0.4, c2: 0x66b8ff }); fx.spray(p, 0xcff6ff, 1, 4, 0.5, 0.45, { shape: SHAPE.shard, spin: 8, grav: 3, drag: 3, grow: -0.6 }); break;
      case 19: fx.sparks(p, 0xffd23f, 1, 5, 0.3, { grav: 8 }); break;
      case 100: fx.line(L, p, 0xff9a2a, 0.55, 0.7, { shrink: 0.9, a0: 1, a1: 0.8, c2: 0xff2a10 }); fx.spray(p, 0xffd08a, 2, 4, 0.5, 1.2, { grow: 0.6, c2: 0xff3a10, drag: 3 }); fx.spray(p, 0x2a1a20, 1.2, 1.5, 1.2, 1.4, { smoke: true, shape: SHAPE.smoke, grow: 1.6, spin: 2, c2: 0x120a14 }); break;
      default: break;
    }
  }

  /* ───────── estados sobre criaturas ───────── */
  status(m, ef, wounded) {
    const fx = this.fx, r = m.r || 1, p = this.monPos(m), mat = COLORS[m.k] || 0xffffff;
    const up = this.up, shell = () => { _t.set(rnd(2) - 1, rnd(2) - 1, rnd(2) - 1).normalize().multiplyScalar(r * 0.85); return _q.copy(p).add(_t); };
    if (ef & 4) { // fuego: llamas que suben + brasas + humo
      for (let i = this.rateN(22); i > 0; i--) { const s = shell(); fx.add.spawn(s.x, s.y, s.z, up.x * 2.4 + rnd(1) - 0.5, up.y * 2.4 + rnd(1) - 0.5, up.z * 2.4 + rnd(1) - 0.5, new THREE.Color(0xffd04a), new THREE.Color(0xd02a0a), r * 0.55, 0.6, -2.5 * 0 + 0, 1.2, -0.4, SHAPE.soft, 0); }
      for (let i = this.rateN(5); i > 0; i--) { const s = shell(); fx.add.spawn(s.x, s.y, s.z, up.x * 3 + rnd(2) - 1, up.y * 3 + rnd(2) - 1, up.z * 3 + rnd(2) - 1, new THREE.Color(0xffe08a), new THREE.Color(0xff4a10), 0.22, 1.0, -1.5, 0.6, -0.8, SHAPE.ember, 0); }
      for (let i = this.rateN(3); i > 0; i--) { const s = shell(); fx.smoke.spawn(s.x + up.x * r, s.y + up.y * r, s.z + up.z * r, up.x * 2, up.y * 2, up.z * 2, new THREE.Color(0x2a1a18), new THREE.Color(0x0c0808), r * 0.6, 1.1, 0, 1.2, 1.4, SHAPE.smoke, 1.5); }
    }
    if (ef & 2) { // veneno: burbujas verdes que suben y gotas que caen
      for (let i = this.rateN(9); i > 0; i--) { const s = shell(); fx.add.spawn(s.x, s.y, s.z, up.x * 1.4 + rnd(0.6) - 0.3, up.y * 1.4 + rnd(0.6) - 0.3, up.z * 1.4 + rnd(0.6) - 0.3, new THREE.Color(0x9dff5a), new THREE.Color(0x2aa04a), 0.38 + rnd(0.3), 0.9, 0, 1.4, 0.4, SHAPE.bubble, 0); }
      for (let i = this.rateN(3); i > 0; i--) { const s = shell(); fx.add.spawn(s.x, s.y, s.z, 0, 0, 0, new THREE.Color(0x7dff4a), new THREE.Color(0x1a7a2a), 0.22, 0.8, 9, 0.2, -0.3, SHAPE.ember, 0); }
    }
    if (ef & 1) { // hielo: copos y esquirlas pálidas que giran + bruma
      for (let i = this.rateN(8); i > 0; i--) { const s = shell(); fx.add.spawn(s.x, s.y, s.z, rnd(1) - 0.5, rnd(1) - 0.5, rnd(1) - 0.5, new THREE.Color(0xe6fbff), new THREE.Color(0x66b8ff), 0.3 + rnd(0.25), 1.1, 0.8, 0.5, -0.3, i & 1 ? SHAPE.star : SHAPE.shard, 3); }
      for (let i = this.rateN(2.5); i > 0; i--) { const s = shell(); fx.smoke.spawn(s.x, s.y, s.z, 0, 0, 0, new THREE.Color(0xbfe6ff), new THREE.Color(0x6a9ad0), r * 0.7, 1.2, 0.5, 1, 1.2, SHAPE.smoke, 1); }
    }
    if (m.mk) { // marca del Vigía: estrella dorada sobre la cabeza
      if (Math.random() < this.dt * 6) { _t.copy(p).addScaledVector(up, r + 0.9); fx.add.spawn(_t.x + rnd(0.6) - 0.3, _t.y, _t.z + rnd(0.6) - 0.3, 0, 0.4, 0, new THREE.Color(0xffe27a), new THREE.Color(0xff9a3a), 0.9, 0.7, 0, 1, -0.2, SHAPE.star, 2); }
    }
    if (wounded && !(ef & 4) && Math.random() < this.dt * 3) { const s = shell(); fx.add.spawn(s.x, s.y, s.z, 0, 0, 0, new THREE.Color(mat), new THREE.Color(mat).multiplyScalar(0.3), 0.3, 0.7, 10, 0.2, -0.2, SHAPE.ember, 0); }
  }

  /* ───────── objetos: pozos, minas, cúpula ───────── */
  objectFx(o) {
    const fx = this.fx, p = V(o.p);
    if (o.t === 'well') {
      const R = clamp(o.r * 3.5, 6, 11); perp(this.up, _u, _w);
      for (let i = this.rateN(46); i > 0; i--) {
        const a = rnd(6.283), rr = R * (0.55 + rnd(0.45)), px = _u.x * Math.cos(a) + _w.x * Math.sin(a), py = _u.y * Math.cos(a) + _w.y * Math.sin(a), pz = _u.z * Math.cos(a) + _w.z * Math.sin(a);
        const tx = -_u.x * Math.sin(a) + _w.x * Math.cos(a), ty = -_u.y * Math.sin(a) + _w.y * Math.cos(a), tz = -_u.z * Math.sin(a) + _w.z * Math.cos(a), sp = 6 + rnd(4);
        fx.add.spawn(p.x + px * rr, p.y + py * rr * 0.7, p.z + pz * rr, tx * sp - px * sp * 0.9, ty * sp - py * sp * 0.9, tz * sp - pz * sp * 0.9, new THREE.Color(i & 1 ? 0xb98cff : 0x66ffee), new THREE.Color(0x1a0a40), 0.55, rr / (sp * 0.9) * 0.8 + 0.2, 0, 0.3, -0.6, SHAPE.soft, 0);
      }
      if (this.tick % 22 === 0) fx.ringChroma(p, null, 0.4, 0.8, { r0: R, ease: 1.4, op: 0.8 });
      return;
    }
    if (o.t === 'mine') { if (this.tick % 48 === (o.id % 48)) { fx.flash(_t.copy(p).addScaledVector(this.up, 0.5), 0xffd23f, 0.9, 0.18); fx.ring(p, this.up, 0xffd23f, (o.r || 5) * 0.25, 0.5, { r0: 0.2, op: 0.4 }); } return; }
    if (o.t === 'dome') { if (this.tier > 0 && Math.random() < this.dt * 14) { _t.set(rnd(2) - 1, Math.abs(rnd(2) - 1), rnd(2) - 1).normalize().multiplyScalar(o.r); _q.copy(p).add(_t); fx.add.spawn(_q.x, _q.y, _q.z, 0, 0.3, 0, new THREE.Color(0x66ffee), new THREE.Color(0xffffff), 0.5, 0.8, 0, 0.5, -0.3, SHAPE.star, 2); } return; }
    if (o.t === 'turret') { if (Math.random() < this.dt * 4) { _t.copy(p).addScaledVector(this.up, 1.0); fx.add.spawn(_t.x, _t.y, _t.z, rnd(1) - 0.5, 1, rnd(1) - 0.5, new THREE.Color(0x66bbff), new THREE.Color(0x2a50ff), 0.3, 0.6, 0, 1, -0.5, SHAPE.ember, 0); } }
  }

  /* ───────── atribución de impactos ───────── */
  nearMon(p, slack = 0.8) { for (const m of this.mon.values()) if (m.p && V(m.p).distanceTo(p) < (m.r || 1) * 1.35 + slack) return m; return null; }
  attribute(p) {
    let best = null, bd = 1e9;
    for (const s of this.shots) { // el segmento boca→punta más cercano (cualquier perdigón de la misma salva sirve)
      for (const t of s.tips) { const d = segDist(p, s.o, t) / (1 + 0.08 * s.o.distanceTo(p)); if (d < bd) { bd = d; best = s; } }
    }
    if (best && bd < 1.3) return { w: best.w, shot: best };
    for (const a of this.arcs) if (p.distanceTo(a.p) < 2.5) return { w: a.w, arc: true };
    for (const b of this.booms) if (p.distanceTo(b.p) <= b.r + 2.5) return { w: b.w, splash: true };
    for (const e of this.ended) if (p.distanceTo(e.p) < 6) return { w: e.w, splash: true };
    return best && bd < 6 ? { w: best.w, shot: best } : null;
  }

  /** Despacha un evento del simulador a su efecto. (El disparo ('shot') lo llama shotfx.js con la boca del arma ya calculada.) */
  event(e) {
    switch (e.t) {
      case 'hit': this.hit(e); break; case 'kill': this.kill(e); break; case 'boom': this.boom(e); break; case 'splat': this.splat(e); break;
      case 'pulsar': this.pulsar(e); break; case 'arc': this.arc(e); break; case 'beam': this.beamFx(e); break; case 'tshot': this.tshot(e); break;
      case 'well': this.wellPop(e); break; case 'minePlace': this.minePlace(e); break; case 'skill': this.skill(e); break; case 'blink': this.blink(e); break;
      default: break;
    }
  }

  /* ═══════════════════════ DISPARO ═══════════════════════ */
  /** Posición en el mundo de la boca del arma en primera persona (la misma que dibuja el viewmodel). */
  muzzleWorld(r) {
    const cam = r.camera, it = r.vm && r.vm.items ? r.vm.items[r.vm.cur] : null, v = new THREE.Vector3();
    if (it && it.W && it.W.muzzle && it.rig) { v.set(it.W.muzzle[0], it.W.muzzle[1], it.W.muzzle[2]).applyMatrix4(it.rig.matrix); this.mzLocal.copy(v); }
    else { v.set(0.3, -0.25, -1.2); this.mzLocal.copy(v); }
    v.set(clamp(v.x, -0.5, 0.6), clamp(v.y, -0.5, 0.2), clamp(v.z, -1.6, -0.55)); this.mzLocal.copy(v); // si el arma está subiendo/bajando, el fogonazo no se va de la pantalla
    cam.updateMatrixWorld(); return cam.localToWorld(v);
  }
  /** ¿El jugador pidió menos movimiento? (ajuste del sistema o `cristal.reduceMotion`=1). Se relee cada 2 s. */
  get reduced() {
    if (this._rmT == null || this.t - this._rmT > 2) {
      this._rmT = this.t; let v = false;
      try { v = localStorage.getItem('cristal.reduceMotion') === '1'; } catch { /* sin almacenamiento */ }
      try { if (!v && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) v = true; } catch { /* sin matchMedia */ }
      this._rm = v;
    }
    return !!this._rm;
  }
  /** Cuántos tiros dibujar por salva (Baja dibuja menos perdigones). */
  tipCap() { return this.tier === 0 ? 5 : this.tier === 1 ? 8 : 12; }
  /** Deja pasar un efecto como máximo cada `dt` segundos por clave (armas de cadencia loca). */
  gate(key, dt) { const l = this.gateT.get(key); if (l != null && this.t - l < dt) return false; this.gateT.set(key, this.t); return true; }

  shot(e, origin) {
    const fx = this.fx, w = e.w, name = WN[w] || 'haz', mine = e.pid === this.myId;
    const fp = mine && this.cam && !(this.r && this.r.third), mo = origin ? origin.clone() : V(e.o), c = WEAPON_COLORS[w] || 0xffffff;
    // en 1ª persona la traza nace un poco a la derecha y abajo de la boca: así se ve como una línea desde el arma y no como un punto (el cañón apunta casi al centro)
    const o = fp ? this.cam.localToWorld(_t.set(this.mzLocal.x + 0.3, this.mzLocal.y - 0.22, Math.max(this.mzLocal.z, -0.75))).clone() : mo.clone();
    const all = (e.to || []).map(V); let name2 = name, cc = c;
    if (e.fx) { name2 = e.fx === 'explosiva' ? 'quimeraexp' : e.fx; cc = e.fx === 'voltaico' ? 0x66aaff : e.fx === 'glaciar' ? 0x9fe8ff : e.fx === 'brasa' ? 0xff7a1a : 0xff66c4; }
    const cap = this.tipCap(), tips = all.length > cap ? all.filter((_, i) => i % Math.ceil(all.length / cap) === 0).slice(0, cap) : all;
    const aim = all.length ? _d.copy(all[0]).sub(o).normalize().clone() : (mine && this.r && this.r.aim ? this.r.aim.clone() : (this.cam ? _d.set(0, 0, -1).applyQuaternion(this.cam.quaternion).clone() : new THREE.Vector3(0, 0, -1)));
    const S = WS[name2] || WS.haz; this.fastGate = (WEAPONS[w] ? WEAPONS[w].rate : 1) < 0.12;
    const x = { o, mo, tips, c: cc, mine, aim, name, e, w, S, k: mine ? 0.6 : 1 };
    this.muzzle(name2, { ...x, o: mo });
    if (fp) this.firstPerson(name2, x);
    const fn = TRACE[name2]; if (fn && tips.length) fn.call(this, x);
    // punta de cada traza: impacto en el mundo (superficie) o brillo sobre la criatura
    for (const t of tips) {
      const n = _d.copy(o).sub(t).normalize().clone(), onMon = this.nearMon(t, 1.2);
      this.tipFx(name2, t, n, cc, !!onMon, x);
    }
  }
  /** Fogonazo en el mundo (el de la boca para los demás jugadores; para mí, uno chico: el grande es de pantalla). */
  muzzle(name, x) {
    const fx = this.fx, o = x.o, k = x.k, c = x.c, a = x.aim, S = MZ[name] || MZ.haz;
    fx.flash(o, S.c || c, S.size * (x.mine ? 0.3 : 1.3), (S.life || 0.09) * 1.5, { burst: S.burst !== false, op: (S.op == null ? 0.95 : S.op) * (x.mine ? 0.8 : 1) });
    if (S.sparks) fx.sparks(o, S.sc || c, S.sparks * (x.mine ? 0.8 : 1), S.sp || 12, 0.3, { dir: a, cone: S.cone || 0.9, c2: S.c2, grav: 6 });
    if (S.smoke && this.gate('sm' + name, 0.12)) fx.spray(o, S.smc || 0x504860, S.smoke, 2.2, 0.8, 0.9, { smoke: true, dir: a, cone: 0.8, grow: 1.6, drag: 3, shape: SHAPE.smoke, c2: 0x1a1424, spin: 2, raw: this.tier > 0 });
    if (S.ring && !x.mine) fx.ring(o, a, S.c || c, S.ring, 0.28, { r0: 0.2, op: 0.7, shock: true });
    if (S.glow && this.gate('gl' + name, 0.06)) fx.spray(o, c, S.glow, 3, 0.35, 0.8, { dir: a, cone: 0.6, grow: -0.6, c2: S.c2 });
    void k;
  }
  /** Lo que se ve y se siente en primera persona: fogonazo grande en pantalla (con el dibujo propio de cada arma),
   *  lavado de color (la "luz" del disparo, también en Baja), luz de fogonazo, patada de cámara y golpe de FOV. */
  firstPerson(name, x) {
    const r = this.r, S = x.S, rm = this.reduced, it = r && r.vm && r.vm.items ? r.vm.items[r.vm.cur] : null;
    const shape = it && it.W && it.W.flash ? it.W.flash.shape : 'star', cf = this.camFlash; if (!cf) return;
    const col = _color.setHex(S.tint || x.c), k = this.nextCF = ((this.nextCF || 0) + 1) % cf.length, F = cf[k];
    const rate = WEAPONS[x.w] ? WEAPONS[x.w].rate : 0.3, calm = rate < 0.12 ? 0.5 : 1; // armas de ráfaga: destello más suave (no estroboscópico)
    F.life = F.max = (S.fd || 0.1) * 1.3; F.size = Math.min(S.fl, 0.95) * 0.7; F.wash = (rm ? 0.25 : this.tier === 0 ? 0.7 : 0.15) * S.wash * calm; // Baja no tiene luz de fogonazo: el lavado hace de luz
    F.pat.material.map = flashTexture(shape); F.pat.material.color.copy(col).lerp(_white, 0.1); F.glow.material.color.copy(col); F.wash_.material.color.copy(col);
    F.pat.material.rotation = Math.random() * 6.283; F.group.position.copy(this.mzLocal); F.group.visible = true;
    // luz de fogonazo (la PointLight de Alta; en Baja el "lavado" hace de luz)
    if (r.muzzle) { r.muzzle.color.setHex(S.tint || x.c); r.muzzle.position.copy(this.mzLocal).add(_t.set(0, 0.05, -1.2)); r.muzzle.intensity = Math.max(r.muzzle.intensity, S.light * 0.45 * (rm ? 0.4 : 1)); } // ARTE: la luz sale MÁS lejos y más suave; a 0,6 m 'quemaba' el arma/manos (mancha blanca abajo a la derecha)
    // patada de cámara y golpe de FOV (respetan "reducir movimiento")
    const K = this.K, km = rm ? 0.15 : 1, kick = (S.kick || 0.3) * Math.PI / 180 * km;
    K.p = Math.min(K.p + kick, 0.045 * km + 0.002); K.y += (Math.random() - 0.5) * kick * 0.7; K.r += (Math.random() - 0.5) * kick * 0.8; K.fov = Math.min(K.fov + (rm ? 0 : S.fov || 0.2), 3.2);
  }
  /** Sacudida de cámara (explosiones, jefes). mag ~ 0..1. */
  addShake(mag) { this.K.sh = Math.min(1.6, Math.max(this.K.sh, mag)); }
  /** Se llama una vez por cuadro DESPUÉS de colocar la cámara (render.js la engancha sola). */
  postCamera(dt) {
    const K = this.K, cam = this.cam; if (!cam || !cam.isPerspectiveCamera) return; const rm = this.reduced;
    K.p *= Math.exp(-dt * 11); K.y *= Math.exp(-dt * 11); K.r *= Math.exp(-dt * 11); K.fov *= Math.exp(-dt * 9); K.sh *= Math.exp(-dt * 3.4);
    if (cam.fov !== K.lastFov) K.base = cam.fov;
    const fov = K.base + (rm ? 0 : K.fov);
    if (Math.abs(fov - cam.fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); } K.lastFov = cam.fov;
    const s = rm ? K.sh * 0.1 : K.sh, tt = this.t * 51;
    if (K.p > 1e-5 || Math.abs(K.y) > 1e-5 || Math.abs(K.r) > 1e-5 || s > 1e-4) {
      cam.rotateX(K.p + Math.sin(tt) * 0.012 * s); cam.rotateY(K.y + Math.sin(tt * 1.3 + 1) * 0.012 * s); cam.rotateZ(K.r + Math.sin(tt * 0.9 + 2) * 0.02 * s);
    }
  }
  /** Fogonazos de pantalla pegados a la cámara (pool fijo, aditivos, sin luces). */
  buildCamFlash(r) {
    this.camFlash = []; const cam = r.camera, tex = r.halo || this.fx.tex.glow;
    setTimeout(() => { for (const sh of ['star', 'fan', 'jet', 'ball', 'bolt', 'frost', 'blob', 'ember', 'saw', 'pulse', 'quad', 'scythe', 'chaos', 'ring']) { try { flashTexture(sh); } catch { /* sin canvas */ } } }, 1500); // calienta las texturas de fogonazo (si no, el primer disparo de cada arma las dibuja y se nota un tirón)
    for (let i = 0; i < 3; i++) {
      const mk = (map, ro) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xffffff, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); s.renderOrder = ro; return s; };
      const group = new THREE.Group(), wash_ = mk(tex, 28), glow = mk(tex, 29), pat = mk(flashTexture('star'), 30);
      wash_.position.set(0, 0, -0.6); glow.position.set(0, 0, -0.06); pat.position.set(0, 0, -0.08); group.add(wash_, glow, pat); group.visible = false; cam.add(group);
      this.camFlash.push({ group, wash_, glow, pat, life: 0, max: 0.1, size: 0.5, wash: 0.1 });
    }
  }
  updateCamFlash(dt) {
    if (!this.camFlash) return;
    for (const F of this.camFlash) {
      if (!F.group.visible) continue; F.life -= dt; const u = clamp(1 - F.life / F.max, 0, 1), f = 1 - u * u * 0.9;
      if (F.life <= 0) { F.group.visible = false; F.pat.material.opacity = F.glow.material.opacity = F.wash_.material.opacity = 0; continue; }
      const hk = this.tier === 0 ? 1 : 0.5; // con bloom (Media/Alta) lo aditivo se quema: menos opacidad y halo más chico
      F.pat.scale.setScalar(F.size * (1.1 + 0.5 * u) * (hk < 1 ? 0.85 : 1)); F.pat.material.opacity = clamp(f * 0.95 * hk, 0, 1);
      F.glow.scale.setScalar(F.size * (2.2 + 0.8 * u) * (hk < 1 ? 0.6 : 1)); F.glow.material.opacity = clamp(f * 0.6 * hk, 0, 1);
      F.wash_.scale.setScalar(5); F.wash_.material.opacity = f * F.wash;
    }
  }
  /** Lo que pasa donde termina la traza: destello + estallido + onda + chispas/esquirlas + quemadura, según arma y material. */
  tipFx(name, t, n, c, onMon, x) {
    const fx = this.fx, st = (TIPS[name] || 'spark'), S = x.S, pw = S.pw || 1;
    this.impact(st, t, n, c, 1.15 * pw, onMon);
    if (!onMon) { // en pared/suelo: quemadura breve
      const sz = (st === 'fire' ? 1.7 : st === 'frost' ? 1.9 : 1.4) * pw, dc = st === 'frost' ? 0xbfe8ff : st === 'poison' ? 0x1a4a14 : st === 'fire' ? 0x180a04 : st === 'void' ? 0x1a0a30 : 0x101018;
      if (x.w !== 7 && x.w !== 18 && x.w !== 2 && x.w !== 6 && Math.random() < 0.7) fx.decal(t, n, dc, sz, st === 'frost' ? 3 : 4.5, { op: st === 'frost' ? 0.6 : 0.8 });
    }
  }

  /** Impactos por estilo (para criaturas y mundo). k = escala por daño/arma. Base común (destello + estallido + onda) y firma por estilo. */
  impact(style, p, n, c, k = 1, creature = false) {
    const fx = this.fx; k = clamp(k, 0.5, 2.8); const lowT = this.tier === 0, fast = this.fastGate;
    // lejos hay que agrandar para que se vea (a 30 m un estallido de 1 m es un punto); cerca, achicar para no tapar la pantalla
    if (this.cam) k *= Math.pow(clamp(this.cam.position.distanceTo(p) / 14, 0.6, 2.0), 0.7);
    // base común: brillo de color + estrella blanca + onda sobre la superficie. Se ve a 30 m.
    const cf = creature ? 0.7 : 1; // sobre criaturas hay muchas capas más (fluido, números, muerte): el brillo base se contiene para no quemar la pantalla
    fx.flash(p, c, 1.05 * k * cf, 0.17, { op: 0.95 });
    fx.flash(p, _color.setHex(c).lerp(_white, 0.5).getHex(), 0.7 * k * cf, 0.1, { burst: true });
    if (!fast || Math.random() < 0.4) fx.ring(p, n, c, clamp(1.35 * k, 0.9, 3.2), 0.32, { r0: 0.2, shock: true, op: 0.9 });
    switch (style) {
      case 'spark': fx.sparks(p, 0xfff2b0, 8 * k, 12, 0.4, { dir: n, cone: 2.0, c2: 0xff7a2a, w: 0.07 }); break;
      case 'crystal': fx.spray(p, c, 6 * k, 8, 0.6, 0.6, { shape: SHAPE.shard, spin: 9, grav: 6, dir: n, cone: 1.5, grow: -0.4, c2: 0xffffff, raw: !lowT }); fx.spray(p, 0xffffff, 2, 3, 0.4, 0.9, { shape: SHAPE.star, drag: 4, spin: 3, raw: true }); break;
      case 'ring': fx.ring(p, n, c, clamp(2.2 * k, 1.2, 4), 0.4, { r0: 0.2, shock: true }); fx.sparks(p, c, 6 * k, 11, 0.34, { dir: n, cone: 1.8, w: 0.07 }); break;
      case 'frost': fx.spray(p, 0xdff8ff, 7 * k, 6, 0.8, 0.65, { shape: SHAPE.shard, spin: 6, grav: 3, dir: n, cone: 1.7, c2: 0x66b8ff, grow: -0.3 }); fx.spray(p, 0xcfeaff, 3, 2, 1.2, 1.2, { smoke: true, shape: SHAPE.smoke, grow: 1.3, drag: 2.5, c2: 0x6a9ad0, spin: 1 }); fx.spray(p, 0xffffff, 2, 2, 0.5, 0.9, { shape: SHAPE.star, drag: 3, spin: 2 }); break;
      case 'poison': fx.spray(p, 0x9dff5a, 5 * k, 4, 0.9, 0.8, { shape: SHAPE.bubble, up: 1.2, drag: 2, c2: 0x2aa04a, grow: 0.3 }); fx.spray(p, 0x7dff4a, 5 * k, 7, 0.7, 0.4, { shape: SHAPE.ember, grav: 14, dir: n, cone: 1.6, c2: 0x1a7a2a }); break;
      case 'fire': fx.spray(p, 0xffe08a, 6 * k, 5, 0.6, 1.1, { c2: 0xd02a0a, grow: 0.4, dir: n, cone: 1.5, up: 1.5 }); fx.spray(p, 0xffc040, 4 * k, 7, 0.9, 0.34, { shape: SHAPE.ember, grav: -2, c2: 0xff3a10 }); fx.spray(p, 0x3a2420, 2, 1.5, 1.0, 1.0, { smoke: true, shape: SHAPE.smoke, grow: 1.5, up: 2, c2: 0x0c0808, spin: 1 }); break;
      case 'shock': this.bolt(p, _t.copy(p).addScaledVector(n, 1.4).add(_u.set(rnd(5) - 2.5, rnd(5) - 2.5, rnd(5) - 2.5)), 0x8ac0ff, { w: 0.1, step: 1.1, jit: 0.5, life: 0.16 }); fx.sparks(p, 0xcfe8ff, 8 * k, 13, 0.34, { dir: n, cone: 2.2, c2: 0x4a8aff, w: 0.07 }); break;
      case 'void': fx.spray(p, 0x2a1050, 4, 2.5, 0.9, 1.2, { smoke: true, shape: SHAPE.smoke, grow: 1.5, drag: 2, c2: 0x0a0414, spin: 2 }); fx.ring(p, n, 0xb98cff, 2.8 * k, 0.45, { r0: 2.8 * k, ease: 1.1, op: 0.9 }); fx.sparks(p, 0xe8d8ff, 5 * k, 9, 0.4, { dir: n, cone: 2 }); break;
      case 'blast': fx.sparks(p, 0xffd080, 7 * k, 13, 0.45, { dir: n, cone: 2.2, c2: 0xff5a1a, w: 0.07 }); fx.spray(p, 0xffa24a, 4, 5, 0.5, 1.1, { c2: 0xa0200a, grow: 0.4 }); break;
      case 'slash': fx.sparks(p, 0xffd0d8, 10 * k, 14, 0.42, { dir: n, cone: 2.4, c2: 0xff3a5a, tail: 0.08, w: 0.07 }); break;
      case 'life': fx.spray(p, 0x7dff9a, 5 * k, 5, 0.7, 0.6, { shape: SHAPE.star, spin: 3, dir: n, cone: 1.6, c2: 0x2aa06a, grow: -0.5 }); break;
      case 'poisonlight': fx.sparks(p, 0xb6ff6a, 7 * k, 12, 0.36, { dir: n, cone: 2, c2: 0x2aa04a, w: 0.07 }); break;
      default: fx.sparks(p, c, 6 * k, 9, 0.3, { dir: n, cone: 2 });
    }
    void creature;
  }

  /* ═══════════════════════ GOLPE A UNA CRIATURA ═══════════════════════ */
  hit(e) {
    const fx = this.fx, p = V(e.p), m = this.mon.get(e.id) || this.prevMon.get(e.id) || null, kind = m ? m.k : null, mat = MATERIAL[kind] || 'energy', mc = COLORS[kind] || 0xff9ae8;
    const at = this.attribute(p), w = at ? at.w : -1, name = WN[w] || null, style = at && at.splash ? 'blast' : (WSTYLE[name] || 'spark');
    const sh = at && at.shot ? at.shot : null, nrm = sh ? _d.copy(sh.o).sub(p).normalize().clone() : (this.cam ? _d.copy(this.cam.position).sub(p).normalize().clone() : new THREE.Vector3(0, 1, 0));
    const dmg = e.d || 1, base = (w >= 0 && WEAPONS[w] ? WEAPONS[w].dmg : 20) * (at && at.arc ? 0.7 : 1);
    let mul = base > 0 ? dmg / base : 1; if (sh && sh.pid === this.myId && this.me && this.me.ug && Array.isArray(this.me.ug)) { const i = this.me.sl ? this.me.sl.indexOf(w) : -1, u = i >= 0 ? this.me.ug[i] : 0; if (Array.isArray(u) && u[0]) mul /= 1 + 0.22 * u[0]; }
    const crit = !!e.cr, boost = !e.arm && !crit && mul >= 1.22, heavy = dmg >= 90, k = clamp(0.6 + Math.log10(dmg + 1) * 0.45 + (crit ? 0.5 : 0), 0.6, 2.4);
    // marca para la animación de muerte (cómo lo mataron)
    this.lastHit.set(e.id, { style, w, t: this.t, nrm, p });
    // Melee already has contact/weapon trails: do not stack the full gun impact on top.
    if (e.src === 'melee') {
      const c = e.arm ? NUMCOL.armor : CHARACTERS[e.char]?.color || mc;
      const count = this.tier === 0 || this.reduced ? 4 : 7;
      fx.sparks(p, crit ? 0xffd23f : c, count, 10, 0.3, { dir: nrm, cone: 1.1, c2: c });
      if (crit) fx.ring(p, nrm, 0xffd23f, 1.5, 0.24, { r0: 0.2, th: 0.06, op: 0.5 });
      this.nums.add(p.clone().addScaledVector(this.up, m ? m.r * 0.45 : 0.5), dmg,
        { key: e.id, color: crit ? 0xffd23f : c, size: crit ? 1.5 : 1.0, crit });
      return;
    }
    // capa 1: el material de la criatura reacciona
    if (e.arm) { fx.sparks(p, 0xcfd8ff, 5, 12, 0.3, { dir: nrm, cone: 1.2, c2: 0x6a7bff }); fx.ring(p, nrm, 0x9999ff, 1.0, 0.2, { r0: 0.2, op: 0.7 }); }
    else if (mat === 'bio') { fx.spray(p, mc, 7 * k, 7, 0.7, 0.7, { dir: nrm, cone: 1.6, grav: 9, c2: mix(mc, 0x000000, 0.65), grow: -0.4 }); fx.spray(p, mc, 3 * k, 4, 0.5, 1.0, { c2: 0xffffff, grow: 0.3 }); fx.spray(p, 0xffffff, 2, 5, 0.3, 0.4, { shape: SHAPE.ember }); }
    else if (mat === 'glass') { fx.spray(p, mc, 6 * k, 9, 0.8, 0.38, { shape: SHAPE.shard, spin: 10, grav: 8, dir: nrm, cone: 1.7, c2: 0xffffff, grow: -0.4 }); fx.sparks(p, 0xffffff, 3, 9, 0.3, { dir: nrm, cone: 1.8, c2: mc }); }
    else if (mat === 'rock') { fx.spray(p, 0x6a4a8a, 3 * k, 4, 0.9, 1.1, { smoke: true, shape: SHAPE.smoke, grow: 1.2, drag: 2.5, c2: 0x241a34, dir: nrm, cone: 1.3, spin: 2 }); fx.spray(p, mc, 5 * k, 8, 0.7, 0.45, { shape: SHAPE.shard, grav: 10, spin: 7, dir: nrm, cone: 1.5 }); }
    else { fx.spray(p, mc, 5 * k, 6, 0.6, 0.8, { c2: 0xffffff, grow: 0.5 }); fx.ring(p, nrm, mc, 1.6 * k, 0.28, { r0: 0.2, shock: true, op: 0.7 }); }
    // capa 2: el arma deja su firma
    if (!e.arm) this.impact(style, p, nrm, WEAPON_COLORS[w] || mc, k * 0.8, true);
    fx.flash(p, mc, 0.8 * k, 0.12, { op: 0.5 }); // brillo del material herido (se ve a distancia)
    const mineHit = sh ? sh.pid === this.myId : true;
    if (crit) { // crítico: estallido dorado grande, onda con color separado, estrellas, golpe de FOV y sacudida chica
      fx.flash(p, 0xffe27a, 1.6, 0.13, { burst: true, op: 0.6 }); fx.flash(p, 0xffe9a0, 0.6, 0.07, { op: 0.5 }); fx.ring(p, null, 0xffe27a, 2.8, 0.32, { r0: 0.3, shock: true }); if (!this.reduced && this.tier > 0) fx.ringChroma(p, null, 2.1, 0.28, { r0: 0.3, op: 0.4 });
      fx.sparks(p, 0xffe9a0, this.tier === 0 || this.reduced ? 5 : 10, 16, 0.5, { c2: 0xff8a2a, w: 0.08 }); fx.spray(p, 0xffe27a, this.tier === 0 || this.reduced ? 2 : 4, 8, 0.6, 0.8, { shape: SHAPE.star, spin: 4, c2: 0xff8a2a, raw: true });
      if (mineHit) { this.K.fov = Math.min(this.K.fov + 0.7, 3.2); this.addShake(0.12); }
    }
    else if (heavy) { fx.ring(p, nrm, WEAPON_COLORS[w] || mc, 3.2, 0.35, { r0: 0.3, shock: true }); }
    // número de daño
    const col = e.arm ? NUMCOL.armor : crit ? 0xffd23f : boost ? 0xffa23a : (NUMCOL[style] || NUMCOL.phys);
    const pos = _t.copy(p).addScaledVector(this.up, (m ? m.r * 0.45 : 0.5)).clone();
    this.nums.add(pos, dmg, { key: e.id, color: col, size: e.arm ? 0.7 : clamp(0.78 + Math.log10(dmg + 1) * 0.34, 0.8, 1.9) * (crit ? 1.35 : 1), crit });
  }

  /* ═══════════════════════ MUERTE ═══════════════════════ */
  kill(e) {
    this.addShake(0.06);
    const fx = this.fx, p = V(e.p), k = e.k, m = this.prevMon.get(e.id) || this.mon.get(e.id) || null, mc = COLORS[k] || 0xffffff, mat = MATERIAL[k] || 'energy';
    const boss = k === 'coloso' || k === 'madre' || k === 'argos', r = m ? m.r : 1, elite = !!(m && m.el), lh = this.lastHit.get(e.id); this.lastHit.delete(e.id);
    const style = lh && this.t - lh.t < 0.5 ? lh.style : 'spark', up = this.up, size = boss ? 1.6 : clamp(r * 0.45, 0.3, 1.1);
    const tint = style === 'frost' ? 0xbfeaff : style === 'poison' || style === 'poisonlight' ? 0x8dff5a : style === 'fire' ? 0xff8a3a : mc;
    // 1) el cuerpo se rompe en trozos sólidos + fluido luminoso
    fx.shatter(p, tint, { size: Math.max(size, r * 0.5) * (boss ? 1.2 : 2.0), n: boss ? 24 : 10, speed: boss ? 16 : 10, dir: lh ? lh.nrm.clone().negate() : null });
    fx.blast(p, tint, boss ? 30 : r * 2.4 + 2, boss ? 0.8 : 0.34);
    // 2) fluido por material
    if (mat === 'bio') { fx.spray(p, mc, 26 * (boss ? 3 : 1), 9, 0.95, 0.9 * size + 0.5, { grav: 10, c2: mix(mc, 0x000000, 0.7), grow: -0.3 }); fx.spray(p, mc, 6, 3, 0.5, 1.8 * size + 0.6, { c2: 0xffffff, grow: 0.5, drag: 3 }); }
    else if (mat === 'glass') { fx.spray(p, mc, 22 * (boss ? 3 : 1), 12, 1.0, 0.7 * size + 0.3, { shape: SHAPE.shard, spin: 10, grav: 7, c2: 0xffffff, grow: -0.3 }); fx.sparks(p, 0xffffff, 10, 13, 0.5, { c2: mc }); }
    else if (mat === 'rock') { fx.spray(p, 0x6a4a8a, 8, 5, 1.3, 2.0 * size + 0.5, { smoke: true, shape: SHAPE.smoke, grow: 1.3, drag: 2, c2: 0x241a34, spin: 2 }); fx.spray(p, mc, 14, 9, 0.9, 0.7 * size + 0.3, { shape: SHAPE.shard, spin: 8, grav: 9 }); }
    else { fx.spray(p, mc, 20, 10, 0.9, 0.9 * size + 0.3, { c2: 0xffffff, grow: 0.2 }); fx.ring(p, null, mc, r * 3.2, 0.5, { r0: r * 0.6, shock: true }); }
    // 3) variación según el arma que lo mató
    switch (style) {
      case 'frost': fx.spray(p, 0xffffff, 8, 6, 1.2, 0.9, { shape: SHAPE.star, spin: 3, grav: 2, c2: 0x66b8ff }); fx.spray(p, 0xcfeaff, 4, 3, 1.4, 2.2 * size + 0.4, { smoke: true, shape: SHAPE.smoke, grow: 1.3, c2: 0x6a9ad0 }); break;
      case 'fire': fx.spray(p, 0xffd04a, 10, 7, 0.9, 1.0 * size + 0.3, { c2: 0xa0200a, up: 3, grow: 0.4 }); fx.spray(p, 0x2a2024, 5, 3, 1.5, 2.2 * size + 0.5, { smoke: true, shape: SHAPE.smoke, up: 3, grow: 1.4, c2: 0x0a0606, spin: 1 }); break;
      case 'poison': case 'poisonlight': fx.spray(p, 0x9dff5a, 9, 4, 1.2, 0.8 * size + 0.3, { shape: SHAPE.bubble, up: 1.5, c2: 0x2aa04a }); break;
      case 'shock': for (let i = 0; i < (this.tier ? 4 : 2); i++) this.bolt(p, _t.copy(p).add(_u.set(rnd(2) - 1, rnd(2) - 1, rnd(2) - 1).normalize().multiplyScalar(r * 2.2 + 1.5)), 0x8ac0ff, { w: 0.08, step: 1.2, jit: 0.5, life: 0.16 }); break;
      case 'void': fx.ring(p, null, 0xb98cff, 0.5, 0.45, { r0: r * 3, ease: 1.3, op: 0.9 }); fx.spray(p, 0x1a0a30, 8, 3, 1.2, 1.8 * size + 0.4, { smoke: true, shape: SHAPE.smoke, grow: 1.2, c2: 0x0a0414 }); break;
      case 'blast': fx.spray(p, 0xffa24a, 8, 9, 0.7, 1.1, { c2: 0xa0200a, grow: 0.5 }); break;
      case 'slash': fx.sparks(p, 0xffb0c0, 12, 14, 0.5, { c2: 0xff3a5a, tail: 0.08 }); break;
      default: break;
    }
    // 4) destello y onda (más grandes si es élite o jefe)
    fx.flash(p, elite ? 0xffd23f : mc, boss ? 7 : (elite ? 3 : 1.6 + r * 0.6), boss ? 0.5 : 0.25, { burst: true });
    fx.ring(p, up, mc, (boss ? 22 : elite ? 9 : 3 + r * 2), boss ? 0.9 : 0.5, { r0: 0.5, shock: true, op: 0.9 });
    if (elite) { fx.ringChroma(p, null, 11, 0.7, { op: 0.9 }); fx.ring(p, up, 0xff3a5a, 14, 0.8, { r0: 0.5, shock: true }); fx.spray(p, 0xffe27a, 14, 12, 1.1, 1.0, { shape: SHAPE.star, spin: 4, c2: 0xff3a5a, grow: -0.5 }); fx.sparks(p, 0xffe9a0, 14, 15, 0.6, { c2: 0xff3a5a }); }
    if (boss) { fx.ringChroma(p, null, 38, 1.4, { op: 0.9 }); fx.blast(p, mc, 36, 1.4); fx.spray(p, 0xffffff, 40, 26, 1.4, 1.6, { shape: SHAPE.star, spin: 3, c2: mc, grow: -0.4, raw: true }); }
    fx.decal(_t.copy(p).addScaledVector(up, -r * 0.6), up, style === 'frost' ? 0xbfe8ff : mix(mc, 0x000000, 0.7), r * 2.6, 6, { op: 0.6 });
  }

  /* ═══════════════════════ EXPLOSIONES Y ÁREAS ═══════════════════════ */
  boom(e) {
    const fx = this.fx, p = V(e.p), r = e.r || 5, up = this.up;
    // Host shockwaves are ground cuts, not fireball explosions. Preserve targets inside the radius.
    if (e.src === 'host') {
      const c = CHARACTERS[e.char]?.color || 0x66ffee;
      fx.ring(p, up, c, r, 0.38, { r0: 0.4, th: 0.08, op: 0.5, shock: true });
      fx.sparks(p, c, this.tier === 0 || this.reduced ? 5 : 10, Math.min(16, r * 2), 0.35, { dir: up, cone: 1.6, c2: c });
      fx.flash(p, c, Math.min(1.4, r * 0.25), 0.1, { op: 0.35 });
      if (!this.reduced && this.cam) this.addShake(0.12 * clamp(12 / (this.cam.position.distanceTo(p) + 6), 0.1, 1));
      return;
    }
    if (this.cam) this.addShake(clamp(r / 9, 0.3, 1.4) * clamp(16 / (this.cam.position.distanceTo(p) + 6), 0.12, 1));
    let src = null; for (const en of this.ended) if (en.p.distanceTo(p) < r + 4) { src = en; break; }
    let w = src ? src.w : -1; const sk = this.skills.find((s) => s.id === 'onda' && s.p.distanceTo(p) < 12);
    const rac = !src && [...this.prevMon.values()].some((m) => m.k === 'racimo' && !this.mon.has(m.id) && V(m.p).distanceTo(p) < 2);
    this.booms.push({ p, r, w });
    let pal = { a: 0xffe9a0, b: 0xff7a1a, c: 0x7a1a08, sm: 0x2a1a18, ring: 0xffa24a };
    if (w === 10) pal = { a: 0xfff0c0, b: 0xffb35c, c: 0xc03a0a, sm: 0x2a1a18, ring: 0xffb35c };
    else if (w === 11 || w === 101) pal = { a: 0xe8d8ff, b: 0x8a5cff, c: 0x1a0a50, sm: 0x140a28, ring: 0xb98cff };
    else if (w === 19) pal = { a: 0xfff6b0, b: 0xffd23f, c: 0xa05a0a, sm: 0x2a2018, ring: 0xffd23f };
    else if (w === 9) pal = { a: 0xffd0ec, b: 0xff66c4, c: 0x7a1a5a, sm: 0x2a1424, ring: 0xff66c4 };
    else if (rac) pal = { a: 0xffc0c8, b: 0xff3b5c, c: 0x5a0a20, sm: 0x240a14, ring: 0xff3b5c };
    else if (sk) pal = { a: 0xe8ffff, b: 0x66ffee, c: 0x1a6a8a, sm: 0x10303a, ring: 0x66ffee };
    else if (w === 100) pal = { a: 0xfff0b0, b: 0xffd23f, c: 0xc03a0a, sm: 0x2a1a18, ring: 0xffd23f };
    const big = clamp(r / 6, 0.5, 2.2);
    fx.flash(p, pal.a, r * 1.9, 0.28, { burst: true });
    fx.spray(p, pal.a, 22, r * 2.4, 0.65, r * 0.34 + 0.5, { c2: pal.b, grow: 0.9, drag: 3.2 });
    fx.spray(p, pal.b, 18, r * 1.6, 0.9, r * 0.45 + 0.5, { c2: pal.c, grow: 0.8, drag: 2.4, up: 1 });
    fx.spray(p, pal.sm, 10, r * 0.8, 1.7, r * 0.55 + 0.8, { smoke: true, shape: SHAPE.smoke, grow: 1.6, drag: 1.6, up: 2.5, c2: 0x0a0608, spin: 1.5 });
    fx.sparks(p, pal.a, 14, r * 3.4, 0.7, { c2: pal.b, grav: 12, tail: 0.06 });
    fx.ring(p, up, pal.ring, r * 1.25, 0.55, { r0: 0.5, shock: true, op: 1 });
    fx.ringChroma(p, null, r * 1.6, 0.6, { r0: 0.5, op: 0.8 });
    perp(up, _u, _w); fx.spray(p, 0x6a5a7a, 14, r * 2.0, 1.1, 0.9 + r * 0.12, { smoke: true, shape: SHAPE.smoke, grow: 1.4, drag: 2.4, c2: 0x1c1626, flat: up, spin: 2 }); // anillo de polvo
    fx.blast(p, pal.ring, r, 0.5);
    fx.shatter(p, w === 11 ? 0xb98cff : 0x9a7ad8, { size: 0.35 + big * 0.2, n: 5, speed: r * 1.6 });
    if (r >= 8 || w === 100) { fx.spray(p, pal.b, 12, r * 3, 1.1, 0.5, { shape: SHAPE.ember, grav: 6, c2: pal.c }); }
    // luz momentánea: reutiliza la luz de fogonazo del jugador (sin luces nuevas)
    const rr = this.r; if (rr && rr.muzzle && this.cam) { const d = this.cam.position.distanceTo(p); rr.muzzle.color.setHex(pal.b); rr.muzzle.intensity = Math.max(rr.muzzle.intensity, clamp(40 * r / (d + 8), 0, 46)); }
    fx.decal(_t.copy(p).addScaledVector(up, -0.4), up, 0x0a0608, r * 1.1, 7, { op: 0.75 });
  }
  splat(e) {
    const fx = this.fx, p = V(e.p); let src = this.ended.find((en) => en.p.distanceTo(p) < 6) || null; const n = this.cam ? _d.copy(this.cam.position).sub(p).normalize().clone() : this.up.clone();
    const enemy = !src || src.owner !== 'p', c = enemy ? 0xff4fd8 : (WEAPON_COLORS[src.w] || 0xffffff);
    // ¿pegó contra la cúpula? onda de impacto sobre la superficie
    for (const o of this.state ? this.state.objs || [] : []) if (o.t === 'dome' && V(o.p).distanceTo(p) < o.r * 1.15) { const nn = p.clone().sub(V(o.p)).normalize(); fx.ring(p, nn, 0x66ffee, 3.4, 0.4, { r0: 0.3, shock: true }); fx.flash(p, 0x66ffee, 2.2, 0.15); fx.spray(p, 0x66ffee, 6, 4, 0.5, 0.5, { shape: SHAPE.star, dir: nn, cone: 1.4 }); return; }
    fx.sparks(p, c, 7, 11, 0.4, { dir: n, cone: 2, c2: enemy ? 0x7a1a90 : 0xffaa40 }); fx.flash(p, c, 1.4, 0.12, { burst: true }); fx.spray(p, c, 4, 4, 0.5, 0.8, { c2: 0xffffff });
    fx.decal(p, n, enemy ? 0x2a0a30 : 0x101018, 1.4, 4, { op: 0.65 });
  }
  pulsar(e) {
    const fx = this.fx, p = V(e.p), r = e.r || 10, up = this.up, c = 0xb98cff;
    fx.flash(p, 0xe8d8ff, r * 0.9, 0.2, { burst: true });
    fx.ring(p, up, c, r, 0.45, { r0: 0.8, shock: true, op: 1, lift: 0.12 }); fx.ringChroma(p, null, r * 1.15, 0.5, { r0: 0.8, op: 0.9 }); fx.blast(p, c, r, 0.45);
    this.later(0.09, () => { fx.ring(p, up, 0xe8d8ff, r * 0.85, 0.4, { r0: 0.5, shock: true, op: 0.8 }); });
    this.later(0.18, () => { fx.ring(p, up, 0x66ffee, r * 0.6, 0.35, { r0: 0.4, shock: true, op: 0.6 }); });
    fx.spray(p, 0xe8d8ff, 26, r * 2.4, 0.5, 0.7, { flat: up, c2: c, drag: 3, grow: -0.5 });
    fx.sparks(p, 0xffffff, 12, r * 2.8, 0.45, { c2: c });
    fx.spray(p, 0x6a5a8a, 10, r * 1.6, 0.9, 1.2, { smoke: true, shape: SHAPE.smoke, flat: up, grow: 1.4, c2: 0x1c1626, spin: 2 });
  }
  arc(e) { const c = 0x9fd8ff; this.bolt(V(e.o), V(e.to), c, { w: 0.11, step: 2.6, jit: 0.7, forks: 1, life: 0.16 }); this.fx.flash(V(e.to), c, 1.4, 0.1, { burst: true }); this.fx.sparks(V(e.to), 0xdff0ff, 4, 9, 0.3, { c2: 0x4a8aff }); }
  beamFx(e) {
    const fx = this.fx, a = V(e.o), b = V(e.to), heal = e.c === 'heal', c = heal ? 0x7dff9a : 0xc8fff0, c2 = heal ? 0xff66c4 : 0x66ffee;
    fx.line(a, b, c, heal ? 0.35 : 0.5, 0.5, { a0: 0.8, a1: 0.8, shrink: 0.8, c2 }); fx.line(a, b, 0xffffff, 0.1, 0.35, { shrink: 0.5 });
    this.helix(a, b, c2, { radius: heal ? 0.9 : 0.6, turns: 0.5, w: 0.1, life: 0.5 });
    fx.flash(a, c, 2.2, 0.2, { burst: true }); fx.flash(b, c, 3, 0.25, { burst: true }); fx.ring(b, _d.copy(a).sub(b).normalize(), c, 4, 0.4, { r0: 0.3, shock: true });
    if (heal) fx.spray(b, 0x7dff9a, 10, 4, 1.0, 0.8, { shape: SHAPE.star, spin: 3, up: 2, c2: 0xff66c4 });
    else { fx.ringChroma(a, _d.copy(b).sub(a).normalize(), 1.2, 0.4, {}); const d = a.distanceTo(b), n = Math.min(5, Math.floor(d / 18)); for (let i = 1; i <= n; i++) fx.ring(_t.copy(a).lerp(b, i / (n + 1)), _d.copy(b).sub(a).normalize(), 0x66ffee, 2.4, 0.5, { r0: 0.4, op: 0.6 }); }
  }
  tshot(e) {
    const fx = this.fx, o = V(e.o), t = V(e.to); fx.dart(o, t, 0x66bbff, 0.1, 220, 4); fx.flash(o, 0x66bbff, 1.2, 0.08, { burst: true }); fx.sparks(o, 0x9fd0ff, 3, 7, 0.25, { dir: _d.copy(t).sub(o).normalize(), cone: 1 });
    fx.spray(_t.copy(o).addScaledVector(this.up, 0.2), 0xffe08a, 1, 3, 0.5, 0.25, { shape: SHAPE.ember, grav: 9, raw: true });
    fx.sparks(t, 0x9fd0ff, 4, 8, 0.3, { c2: 0x2a50ff });
  }
  wellPop(e) { const fx = this.fx, p = V(e.p); fx.flash(p, 0xb98cff, 5, 0.3, { burst: true }); fx.ringChroma(p, null, 1, 0.7, { r0: 9, ease: 1.2 }); fx.spray(p, 0xe8d8ff, 14, 9, 0.5, 0.7, { c2: 0x3a1a8a }); fx.ring(p, this.up, 0x66ffee, 9, 0.6, { r0: 0.5, shock: true }); }
  minePlace(e) { const fx = this.fx, p = V(e.p); fx.ring(p, this.up, 0xffd23f, 3, 0.4, { r0: 0.3, shock: true }); fx.sparks(p, 0xffe27a, 6, 6, 0.35, { dir: this.up, cone: 1.4 }); fx.flash(p, 0xffd23f, 1.4, 0.15); }

  /* ═══════════════════════ HÉROES: habilidades ═══════════════════════ */
  skill(e) {
    const fx = this.fx, p = V(e.p), up = this.up, pl = this.state ? this.state.players.find((q) => q.id === e.pid) : null, hero = pl && CHARACTERS[pl.char] ? CHARACTERS[pl.char].color : 0x66ffee;
    const h = pl ? _d.set(pl.h[0], pl.h[1], pl.h[2]).clone() : new THREE.Vector3(0, 0, -1), feet = p.clone();
    switch (e.id) {
      case 'embestida': // Égida: carga de choque cian
        fx.ring(feet, up, hero, 5, 0.4, { r0: 0.5, shock: true }); fx.spray(feet, hero, 14, 10, 0.5, 0.8, { dir: h.clone().negate(), cone: 0.7, c2: 0xffffff }); fx.sparks(feet, 0xffffff, 10, 16, 0.4, { dir: h.clone().negate(), cone: 0.8, c2: hero });
        for (let i = 0; i < 6; i++) { _t.copy(feet).addScaledVector(h, -1 - i * 1.4).addScaledVector(up, 0.4 + rnd(1.2)); fx.line(_t, _q.copy(_t).addScaledVector(h, -4), hero, 0.1, 0.35, { a0: 0.8, a1: 0, shrink: 0.9 }); }
        fx.spray(feet, 0x6a5a7a, 5, 3, 0.8, 1.2, { smoke: true, shape: SHAPE.smoke, grow: 1.4, c2: 0x1c1626 }); break;
      case 'onda': { // Égida: cono de choque hacia donde mira
        const o = feet.clone().addScaledVector(up, 0.6); fx.ringChroma(o, h, 9, 0.5, { r0: 1, op: 0.9 }); this.later(0.07, () => fx.ring(o.clone().addScaledVector(h, 3), h, hero, 8, 0.45, { r0: 1, shock: true })); this.later(0.14, () => fx.ring(o.clone().addScaledVector(h, 6), h, 0xffffff, 8, 0.4, { r0: 1, shock: true, op: 0.7 }));
        fx.sparks(o, hero, 22, 28, 0.5, { dir: h, cone: 0.8, c2: 0xffffff }); fx.spray(o, hero, 20, 18, 0.5, 1.0, { dir: h, cone: 0.7, c2: 0x2a6aff, grow: 0.6 }); break; }
      case 'paso': // Lumen: columna de luz rosa
        fx.flash(feet, 0xffd0f0, 6, 0.3, { burst: true }); fx.ring(feet, up, hero, 4, 0.45, { r0: 0.4, shock: true }); for (let i = 0; i < 3; i++) fx.line(_t.copy(feet).addScaledVector(up, -0.6), _q.copy(feet).addScaledVector(up, 6), hero, 0.9 - i * 0.25, 0.45, { a0: 0.8, a1: 0, shrink: 0.5 });
        fx.spray(feet, hero, 16, 6, 0.8, 0.7, { shape: SHAPE.star, spin: 3, up: 3, c2: 0xffffff }); break;
      case 'propulsor': // Forja: llamarada hacia abajo
        fx.spray(feet, 0xfff0a0, 24, 14, 0.6, 1.3, { dir: up.clone().negate(), cone: 0.5, c2: 0xff4a10, grow: 0.7, drag: 2 }); fx.spray(feet, 0x3a2a24, 8, 5, 1.2, 1.6, { smoke: true, shape: SHAPE.smoke, dir: up.clone().negate(), cone: 0.7, grow: 1.4, c2: 0x0c0808 });
        fx.sparks(feet, 0xffd23f, 12, 16, 0.5, { dir: up.clone().negate(), cone: 0.9, c2: 0xff5a1a }); fx.ring(feet, up, hero, 5, 0.4, { r0: 0.5, shock: true }); fx.flash(feet, 0xffd23f, 4, 0.2, { burst: true }); break;
      case 'deslizamiento': // Vigía: estela verde
        fx.sparks(feet, hero, 14, 14, 0.5, { dir: h.clone().negate(), cone: 0.8, c2: 0xffffff }); for (let i = 0; i < 5; i++) { _t.copy(feet).addScaledVector(up, 0.3 + rnd(1.2)).addScaledVector(h, rnd(0.6)); fx.line(_t, _q.copy(_t).addScaledVector(h, -5), hero, 0.14, 0.4, { a0: 0.9, a1: 0, shrink: 0.9 }); }
        fx.spray(feet, 0x6a7a5a, 5, 3, 0.8, 1.1, { smoke: true, shape: SHAPE.smoke, grow: 1.3, c2: 0x1c261a }); fx.ring(feet, up, hero, 3, 0.35, { r0: 0.4, shock: true, op: 0.7 }); break;
      case 'salto': // Nova: onda naranja + columna de brasas
        fx.ring(feet, up, hero, 6, 0.45, { r0: 0.5, shock: true }); fx.ringChroma(feet, up, 4, 0.4, {}); fx.spray(feet, hero, 20, 8, 0.9, 0.8, { dir: up, cone: 0.5, up: 5, c2: 0xff3a10 }); fx.sparks(feet, 0xffe0a0, 14, 18, 0.6, { dir: up, cone: 0.9, c2: hero }); fx.flash(feet, 0xffb060, 5, 0.25, { burst: true }); break;
      case 'fase': // Umbra: humo violeta y eco invertido
        fx.spray(feet, 0x2a1050, 10, 5, 1.3, 2.0, { smoke: true, shape: SHAPE.smoke, grow: 1.4, c2: 0x0a0414, spin: 2 }); fx.spray(feet, hero, 16, 7, 0.9, 0.7, { c2: 0x3a1a8a, grow: -0.5 }); fx.ring(feet, null, hero, 0.5, 0.5, { r0: 5, ease: 1.2, op: 0.9 }); fx.ringChroma(feet, null, 4, 0.5, {}); fx.flash(feet, hero, 4, 0.25); break;
      case 'rafaga': fx.sparks(feet, hero, 18, 24, 0.5, { dir: h, cone: 1.1, c2: 0xffffff }); fx.ring(feet.clone().addScaledVector(h, 1.5).addScaledVector(up, 0.6), h, hero, 5, 0.4, { r0: 0.5, shock: true }); break;
      case 'cohete': fx.flash(feet, 0xffd23f, 3, 0.2, { burst: true }); fx.sparks(feet, 0xffd23f, 10, 14, 0.4, { dir: h, cone: 0.7 }); fx.spray(feet, 0x504860, 5, 3, 1.0, 1.2, { smoke: true, shape: SHAPE.smoke, dir: h, cone: 0.7, grow: 1.4, c2: 0x1a1424 }); break;
      case 'riel': fx.ring(feet.clone().addScaledVector(up, 0.6), h, hero, 3, 0.35, { r0: 0.3, shock: true }); fx.flash(feet.clone().addScaledVector(h, 1).addScaledVector(up, 0.6), hero, 3, 0.2, { burst: true }); break;
      case 'singularidad': fx.ringChroma(feet, null, 1, 0.5, { r0: 5, ease: 1.2 }); fx.spray(feet, hero, 12, 6, 0.6, 0.7, { c2: 0x1a0a40 }); break;
      default: fx.ring(feet, up, hero, 4, 0.4, { r0: 0.5, shock: true });
    }
  }
  blink(e) {
    const fx = this.fx, p = V(e.p), up = this.up;
    fx.flash(p, 0xdff0ff, 5, 0.25, { burst: true }); fx.ring(p, null, 0xcfe9ff, 0.5, 0.45, { r0: 4.5, ease: 1.3, op: 0.8 }); fx.ringChroma(p, null, 3.5, 0.4, {});
    fx.spray(p, 0xcfe9ff, 18, 9, 0.6, 0.8, { c2: 0x6a8aff, grow: -0.6 }); fx.sparks(p, 0xffffff, 8, 12, 0.4, { c2: 0x8ac0ff });
    fx.line(_t.copy(p).addScaledVector(up, -1), _q.copy(p).addScaledVector(up, 7), 0xcfe9ff, 0.7, 0.35, { a0: 0.7, a1: 0, shrink: 0.6 });
  }

  /* ═══════════════════════ utilidades de rayos ═══════════════════════ */
  /** Rayo eléctrico en zigzag con ramas. o: { w, step, jit, forks, life, depth } */
  bolt(a, b, color, o = {}) {
    const fx = this.fx, d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 0.2) return;
    const step = (o.step || 3) * (this.tier === 0 ? 1.8 : 1), n = clamp(Math.round(L / step), 2, this.tier === 0 ? 7 : 14), dir = d.clone().normalize(), jit = (o.jit == null ? 0.6 : o.jit) * clamp(L / 12, 0.4, 1.8);
    const u = new THREE.Vector3(), w = new THREE.Vector3(); perp(dir, u, w); const pts = [a.clone()];
    for (let i = 1; i < n; i++) { const t = i / n, env = Math.sin(Math.PI * t); pts.push(a.clone().addScaledVector(d, t).addScaledVector(u, (rnd(2) - 1) * jit * env * 1.4).addScaledVector(w, (rnd(2) - 1) * jit * env * 1.4)); }
    pts.push(b.clone());
    const life = o.life || 0.16, width = o.w || 0.09;
    for (let i = 0; i < pts.length - 1; i++) fx.line(pts[i], pts[i + 1], color, width, life, { flick: 0.4, shrink: 0.5 });
    const forks = this.tier === 0 ? Math.min(o.forks || 0, 1) : (o.forks || 0); const depth = o.depth || 0;
    for (let f = 0; f < forks && depth < 2; f++) {
      const i = 1 + Math.floor(rnd(pts.length - 2)); if (!pts[i]) continue; const fd = dir.clone().addScaledVector(u, (rnd(2) - 1) * 0.9).addScaledVector(w, (rnd(2) - 1) * 0.9).normalize(), fl = L * (0.2 + rnd(0.2));
      this.bolt(pts[i], pts[i].clone().addScaledVector(fd, fl), color, { w: width * 0.6, step: step * 0.7, jit: jit * 0.8, forks: depth === 0 ? 1 : 0, life: life * 0.9, depth: depth + 1 });
    }
    return pts;
  }
  /** Hélice alrededor del segmento a→b. */
  helix(a, b, color, o = {}) {
    const fx = this.fx, d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 1) return; const dir = d.clone().normalize(), u = new THREE.Vector3(), w = new THREE.Vector3(); perp(dir, u, w);
    const n = clamp(Math.round(L / (this.tier === 0 ? 3 : 1.4)), 4, this.tier === 0 ? 14 : 48), R = o.radius || 0.5, turns = L * (o.turns || 0.25) / 6.283 * 1.0, ph = rnd(6.283); let prev = a.clone();
    for (let i = 1; i <= n; i++) { const t = i / n, ang = ph + t * L * (o.turns || 0.25), env = Math.min(1, t * 6) * Math.min(1, (1 - t) * 6) * 0.9 + 0.1; const q = a.clone().addScaledVector(d, t).addScaledVector(u, Math.cos(ang) * R * env).addScaledVector(w, Math.sin(ang) * R * env); fx.line(prev, q, color, o.w || 0.06, o.life || 0.3, { shrink: 0.5, a0: 0.9, a1: 0.9 }); prev = q; }
    void turns;
  }
  /** Línea ondulada (veneno, cetro): seno que se apaga hacia el final. */
  wave(a, b, color, o = {}) {
    const fx = this.fx, d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 1) return; const dir = d.clone().normalize(), u = new THREE.Vector3(), w = new THREE.Vector3(); perp(dir, u, w);
    const n = clamp(Math.round(L / (this.tier === 0 ? 3 : 1.6)), 4, this.tier === 0 ? 12 : 40), A = o.amp || 0.6, f = o.freq || 0.7, ph = rnd(6.283); let prev = a.clone();
    for (let i = 1; i <= n; i++) { const t = i / n, s = Math.sin(ph + t * L * f) * A * Math.min(1, t * 5), q = a.clone().addScaledVector(d, t).addScaledVector(u, s).addScaledVector(w, Math.cos(ph + t * L * f) * A * 0.4 * Math.min(1, t * 5)); fx.line(prev, q, color, o.w || 0.07, o.life || 0.14, { shrink: 0.5, a0: 1, a1: 0.9, c2: o.c2 }); prev = q; }
  }

  update(dt) {
    this.t += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm.t -= dt; if (tm.t <= 0) { this.timers.splice(i, 1); try { tm.fn(); } catch { /* efecto tardío sin objetivo */ } } }
    this.nums.update(dt, this.cam, this.up); this.updateCamFlash(dt);
  }
}

/* ═══════════════════════ Tablas por arma ═══════════════════════ */
/** Ficha visual de cada arma. w/hw = ancho del núcleo/halo de la traza (m), life = cuánto dura la línea (s), hd/hl/hs = cabeza viajera (ancho, cola, m/s),
 *  fl/fd = tamaño (m) y duración del fogonazo de pantalla, wash = lavado de color (luz), light = luz de fogonazo (Alta), kick/fov = patada de cámara (grados) y golpe de FOV, pw = fuerza del impacto. */
const WS = {
  haz:      { w: 0.06, hw: 0.26, life: 0.24, hd: 0.15, hl: 10, hs: 520, fl: 0.5, fd: 0.1, wash: 0.1, light: 26, kick: 0.35, fov: 0.25, pw: 1.0 },
  prisma:   { w: 0.04, hw: 0.17, life: 0.22, hd: 0.1, hl: 5, hs: 360, fl: 0.75, fd: 0.13, wash: 0.2, light: 36, kick: 1.5, fov: 1.2, pw: 0.85 },
  rafaga:   { w: 0.045, hw: 0.2, life: 0.18, hd: 0.12, hl: 7, hs: 700, fl: 0.42, fd: 0.07, wash: 0.1, light: 22, kick: 0.3, fov: 0.12, pw: 0.8 },
  nova:     { fl: 1.0, fd: 0.16, wash: 0.3, light: 50, kick: 1.7, fov: 1.5, pw: 1.4 },
  aguja:    { w: 0.12, hw: 0.55, life: 0.6, fl: 1.1, fd: 0.2, wash: 0.34, light: 60, kick: 2.1, fov: 2.2, pw: 1.5 },
  pulso:    { w: 0.065, hw: 0.28, life: 0.24, hd: 0.2, hl: 6, hs: 420, fl: 0.6, fd: 0.1, wash: 0.13, light: 28, kick: 0.75, fov: 0.5, pw: 1.1 },
  gemelas:  { w: 0.04, hw: 0.16, life: 0.16, hd: 0.1, hl: 6, hs: 700, fl: 0.38, fd: 0.06, wash: 0.08, light: 20, kick: 0.2, fov: 0.1, pw: 0.7 },
  solar:    { w: 0.05, hw: 0.3, life: 0.1, fl: 0.55, fd: 0.07, wash: 0.1, light: 24, kick: 0.15, fov: 0.05, pw: 0.7 },
  fractal:  { fl: 0.7, fd: 0.12, wash: 0.16, light: 34, kick: 0.5, fov: 0.35, pw: 1.1 },
  enjambre: { fl: 0.8, fd: 0.12, wash: 0.2, light: 36, kick: 0.9, fov: 0.7, pw: 1.0 },
  cometa:   { fl: 0.95, fd: 0.15, wash: 0.28, light: 48, kick: 1.4, fov: 1.2, pw: 1.3 },
  vortice:  { fl: 1.0, fd: 0.16, wash: 0.26, light: 44, kick: 1.2, fov: 1.0, pw: 1.2 },
  lanza:    { tint: 0x7ac8ff, fl: 0.9, fd: 0.14, wash: 0.22, light: 42, kick: 1.4, fov: 1.4, pw: 1.3 },
  cetro:    { w: 0.05, hw: 0.2, life: 0.16, fl: 0.55, fd: 0.09, wash: 0.1, light: 22, kick: 0.2, fov: 0.1, pw: 0.8 },
  eclipse:  { w: 0.05, hw: 0.2, life: 0.26, fl: 1.2, fd: 0.16, wash: 0.4, light: 66, kick: 2.7, fov: 2.6, pw: 1.0 },
  voltaico: { fl: 0.7, fd: 0.1, wash: 0.16, light: 32, kick: 0.5, fov: 0.35, pw: 1.1 },
  glaciar:  { w: 0.055, hw: 0.26, life: 0.22, hd: 0.15, hl: 7, hs: 520, fl: 0.6, fd: 0.1, wash: 0.12, light: 26, kick: 0.3, fov: 0.2, pw: 1.0 },
  plaga:    { w: 0.05, hw: 0.2, life: 0.18, fl: 0.55, fd: 0.09, wash: 0.1, light: 22, kick: 0.2, fov: 0.1, pw: 0.9 },
  brasa:    { w: 0.04, hw: 0.28, life: 0.1, fl: 0.5, fd: 0.07, wash: 0.1, light: 26, kick: 0.15, fov: 0.05, pw: 0.7 },
  mina:     { fl: 0.8, fd: 0.12, wash: 0.2, light: 36, kick: 1.0, fov: 0.8, pw: 1.2 },
  sierra:   { w: 0.06, hw: 0.3, life: 0.1, fl: 0.7, fd: 0.06, wash: 0.1, light: 24, kick: 0.1, fov: 0.05, pw: 0.7 },
  pulsar:   { fl: 1.1, fd: 0.18, wash: 0.36, light: 60, kick: 1.6, fov: 2.0, pw: 1.4 },
  dardos:   { w: 0.04, hw: 0.17, life: 0.2, hd: 0.1, hl: 6, hs: 500, fl: 0.6, fd: 0.1, wash: 0.14, light: 28, kick: 0.65, fov: 0.4, pw: 0.9 },
  requiem:  { tint: 0x8a5cff, w: 0.09, hw: 0.42, life: 0.5, fl: 1.1, fd: 0.2, wash: 0.3, light: 56, kick: 1.9, fov: 1.9, pw: 1.4 },
  quimera:  { w: 0.06, hw: 0.28, life: 0.24, hd: 0.15, hl: 8, hs: 420, fl: 0.7, fd: 0.12, wash: 0.16, light: 32, kick: 0.5, fov: 0.4, pw: 1.1 },
  quimeraexp: { w: 0.08, hw: 0.4, life: 0.3, hd: 0.2, hl: 8, hs: 360, fl: 0.9, fd: 0.14, wash: 0.22, light: 44, kick: 1.0, fov: 0.8, pw: 1.4 },
};
/** Fogonazo de boca (mundo): destello, chispas, humo. size en metros del sprite. */
const MZ = {
  haz: { size: 1.3, sparks: 3, glow: 3 }, prisma: { size: 2.2, sparks: 6, sc: 0xffd0f0, c2: 0x66e8ff, smoke: 1, ring: 1.8 }, rafaga: { size: 1.0, sparks: 2, sc: 0xffe9a0, life: 0.06 },
  nova: { size: 3.2, sparks: 8, smoke: 3, ring: 3, c2: 0xff3a10, life: 0.14 }, aguja: { size: 3.6, sparks: 6, ring: 3.6, life: 0.2, c: 0xe8e0ff }, pulso: { size: 1.7, sparks: 3, ring: 1.6 },
  gemelas: { size: 1.0, sparks: 2, sc: 0xffe0a0, life: 0.05 }, solar: { size: 0.9, glow: 2, c: 0xffd060, op: 0.5, life: 0.05 }, fractal: { size: 2.0, sparks: 5, sc: 0xd6ff9a }, enjambre: { size: 2.2, sparks: 5, smoke: 2, smc: 0x9a7a90, c2: 0xff3aa8 },
  cometa: { size: 3.0, sparks: 7, ring: 3, c2: 0xff5a2a, smoke: 2 }, vortice: { size: 2.6, glow: 5, ring: 2.8, c2: 0x3a1a8a }, lanza: { size: 3.2, sparks: 6, ring: 3.2, sc: 0xe8f6ff, c2: 0x66b8ff }, cetro: { size: 1.7, glow: 4, c2: 0x2aa06a },
  eclipse: { size: 3.6, sparks: 12, sc: 0xff7a9a, c2: 0x8a0a30, smoke: 4, smc: 0x2a1030, ring: 4, c: 0xff5a7a, life: 0.12 }, voltaico: { size: 2.2, sparks: 7, sc: 0xcfe8ff, c2: 0x3a7aff }, glaciar: { size: 1.8, glow: 3, smoke: 2, smc: 0xcfeaff, c2: 0x66b8ff },
  plaga: { size: 1.5, glow: 3, smoke: 1, smc: 0x5a8a3a, c2: 0x1a7a2a, life: 0.07 }, brasa: { size: 0.9, glow: 2, smoke: 1, smc: 0x4a2a1a, c: 0xff7a2a, c2: 0xd02a0a, life: 0.05, op: 0.5 }, mina: { size: 2.2, sparks: 5, smoke: 2, ring: 2.4 },
  sierra: { size: 1.7, sparks: 6, sc: 0xffb0c0, c2: 0xff3a5a, life: 0.05 }, pulsar: { size: 0.1, op: 0 }, dardos: { size: 1.6, sparks: 4, sc: 0xcfffee, c2: 0x2aa0a0 }, requiem: { size: 3.0, sparks: 5, smoke: 3, smc: 0x2a1448, ring: 3.2, c: 0xe8d8ff, life: 0.18 },
  quimeraexp: { size: 3.0, sparks: 8, ring: 3, c2: 0xff3a90 },
};
/** Estilo de impacto en la punta de cada traza. */
const TIPS = { haz: 'spark', prisma: 'crystal', rafaga: 'spark', aguja: 'ring', pulso: 'ring', gemelas: 'spark', solar: 'fire', fractal: 'poisonlight', cetro: 'life', eclipse: 'void', voltaico: 'shock', glaciar: 'frost', plaga: 'poison', brasa: 'fire', sierra: 'slash', dardos: 'crystal', requiem: 'void', quimeraexp: 'blast', quimera: 'ring' };

/** Rayo estándar: halo de color + núcleo blanco + cabeza luminosa que viaja. Persiste S.life segundos. */
function ray(C, x, t, o = {}) {
  const fx = C.fx, S = x.S, L = x.o.distanceTo(t), life = S.life * (o.lm || 1) * 1.2, c = o.c || x.c, bw = x.mine ? 1.3 : 1;
  fx.line(x.o, t, c, S.hw * (o.hm || 1) * bw, life, { a0: 0.85, a1: 0.7, shrink: 0.3, fade: 0.55, c2: o.c2 });
  fx.line(x.o, t, 0xffffff, S.w * (o.wm || 1) * bw, life * 0.8, { a0: 1, a1: 1, shrink: 0.25, fade: 0.45 });
  if (S.hs && !o.nohead) fx.dart(x.o, t, c, S.hd * (o.hm || 1), Math.max(S.hs, L / 0.09), S.hl, {});
}
/** Chorro de llamas: bolas grandes y suaves en cono delante de la boca (cadencia muy alta: se emite por tandas). */
function stream(C, x, c1, c2, o = {}) {
  const fx = C.fx, t = x.tips[0]; if (!t) return;
  const d = _d.copy(t).sub(x.o).normalize().clone(), L = Math.min(x.o.distanceTo(t), o.reach || 20);
  ray(C, x, _q.copy(x.o).addScaledVector(d, L).clone(), { hm: 0.9, nohead: true });
  if (!C.gate('st' + x.name, o.every || 0.05)) return;
  const n = C.tier === 0 ? 3 : 7;
  fx.spray(x.o.clone().addScaledVector(d, 1.2), c1, n, o.sp || 22, 0.55, o.size || 1.2, { dir: d, cone: 0.15, c2, grow: 1.6, drag: 1.2, up: 0.5, amp: 0.9, raw: true });
  fx.spray(x.o.clone().addScaledVector(d, 1.2), 0xffffff, 1, o.sp || 22, 0.3, 0.6, { dir: d, cone: 0.1, c2: c1, grow: 0.5, drag: 1.5, raw: true });
}

/** Trazas por arma (cada una con identidad propia). `this` = CombatFx. x = { o, tips, c, mine, aim, k, S } */
const TRACE = {
  haz(x) { for (const t of x.tips) ray(this, x, t); },
  prisma(x) {
    const cs = [0xff7ad8, 0x7affea, 0xffe27a]; x.tips.forEach((t, i) => ray(this, x, t, { c: cs[i % 3], lm: 0.9, hs: 1 }));
    this.fx.spray(x.o, 0xffc0f0, 6, 8, 0.5, 0.6, { shape: SHAPE.shard, spin: 8, dir: x.aim, cone: 0.5, c2: 0x66e8ff, grav: 3, raw: this.tier > 0 });
  },
  rafaga(x) { for (const t of x.tips) ray(this, x, t, { c: 0xffe066 }); if (!x.mine && this.gate('cas', 0.1)) this.fx.spray(x.o, 0xffe9a0, 1, 3, 0.4, 0.25, { shape: SHAPE.ember, grav: 12, raw: true }); },
  aguja(x) {
    for (const t of x.tips) {
      const L = x.o.distanceTo(t); ray(this, x, t, { c: 0xe8e0ff, c2: 0x6a4aff, nohead: true }); this.fx.line(x.o, t, 0xb9a4ff, 1.0, 0.7, { a0: 0.3, a1: 0.3, shrink: 0.2, fade: 0.5 });
      this.helix(x.o, t, 0xcfc0ff, { radius: 0.7, turns: 0.9, w: 0.08, life: 0.55 }); const d = _d.copy(t).sub(x.o).normalize().clone(), n = Math.min(this.tier === 0 ? 4 : 7, Math.floor(L / 14));
      for (let i = 1; i <= n; i++) { const q = x.o.clone().lerp(t, i / (n + 1)); this.later(i * 0.025, () => this.fx.ring(q, d, 0xb9a4ff, 2.6, 0.42, { r0: 0.3, op: 0.8 })); }
      if (!x.mine) this.fx.ringChroma(x.o, d, 3.2, 0.35, { r0: 0.3, op: 0.8 });
    }
  },
  pulso(x) { for (const t of x.tips) { ray(this, x, t); const n = Math.min(this.tier === 0 ? 3 : 8, Math.floor(x.o.distanceTo(t) / 8)); for (let i = 1; i <= n; i++) { _q.copy(x.o).lerp(t, i / (n + 1)); this.fx.add.spawn(_q.x, _q.y, _q.z, 0, 0, 0, new THREE.Color(0x9ffcff), new THREE.Color(0x2a7aff), 0.7, 0.3 + i * 0.02, 0, 1, -0.7, SHAPE.soft, 0); } } },
  gemelas(x) { x.tips.forEach((t, i) => ray(this, x, t, { c: i & 1 ? 0xffd23f : 0xffa040 })); },
  solar(x) { stream(this, x, 0xffc84a, 0xd0300a, { reach: 22, size: 1.4, sp: 22, every: 0.05 }); },
  fractal(x) { for (const t of x.tips) { const pts = this.bolt(x.o, t, 0x9dff5a, { w: 0.14, step: 3.4, jit: 0.45, forks: 3, life: 0.26 }); this.later(0.05, () => this.bolt(x.o, t, 0xd6ff9a, { w: 0.08, step: 3.4, jit: 0.45, forks: 2, life: 0.16 })); this.fx.line(x.o, t, 0x9dff5a, 0.4, 0.2, { a0: 0.3, a1: 0.3, shrink: 0.3 }); if (pts && this.tier > 0) for (let i = 1; i < pts.length - 1; i += 2) this.fx.spray(pts[i], 0xd6ff9a, 1, 1, 0.4, 0.6, { shape: SHAPE.star, spin: 3, raw: true }); } },
  enjambre(x) { for (let i = 0; i < 5; i++) { _u.set(rnd(2) - 1, rnd(2) - 1, rnd(2) - 1).multiplyScalar(0.5); this.fx.flash(_q.copy(x.o).add(_u), 0xff9ad8, 1.0, 0.12); } this.fx.spray(x.o, 0xffe0f0, 5, 10, 0.5, 0.7, { dir: x.aim, cone: 0.6, c2: 0xff3aa8, raw: this.tier > 0 }); },
  nova(x) { this.fx.spray(x.o, 0xffa040, 8, 12, 0.5, 1.0, { dir: x.aim, cone: 0.5, c2: 0xa01808, grow: 0.8, raw: true }); this.fx.ring(_q.copy(x.o).addScaledVector(x.aim, 2), x.aim, 0xff7a45, 3.2, 0.3, { r0: 0.4, shock: true }); },
  cometa(x) { this.fx.spray(x.o, 0xffe6a0, 6, 7, 0.6, 0.8, { shape: SHAPE.star, dir: x.aim, cone: 0.5, spin: 4, c2: 0xff5a2a, raw: true }); this.fx.ring(_q.copy(x.o).addScaledVector(x.aim, 2), x.aim, 0xffb35c, 3.4, 0.3, { r0: 0.4, shock: true }); },
  vortice(x) { for (let i = 0; i < 10; i++) { perp(x.aim, _u, _w); const a = rnd(6.283), r = 1.4; _t.copy(x.o).addScaledVector(_u, Math.cos(a) * r).addScaledVector(_w, Math.sin(a) * r); this.fx.add.spawn(_t.x, _t.y, _t.z, (x.o.x - _t.x) * 4, (x.o.y - _t.y) * 4, (x.o.z - _t.z) * 4, new THREE.Color(i & 1 ? 0xb98cff : 0x66ffee), new THREE.Color(0x2a1a8a), 0.6, 0.3, 0, 0.5, -0.6, SHAPE.soft, 0); } this.fx.ring(x.o, x.aim, 0xb98cff, 0.4, 0.3, { r0: 2.8, ease: 1.2 }); },
  lanza(x) { this.fx.spray(x.o, 0xe8f6ff, 6, 9, 0.5, 0.7, { shape: SHAPE.shard, spin: 8, dir: x.aim, cone: 0.35, c2: 0x66b8ff, raw: true }); this.fx.line(x.o, _q.copy(x.o).addScaledVector(x.aim, 8), 0xe8f6ff, 0.6, 0.2, { a0: 1, a1: 0 }); this.fx.ring(_q.copy(x.o).addScaledVector(x.aim, 2), x.aim, 0x9fe8ff, 3.2, 0.3, { r0: 0.4, shock: true }); },
  cetro(x) { for (const t of x.tips) { this.wave(x.o, t, 0x7dff9a, { amp: 0.55, freq: 0.9, w: 0.12, life: 0.18 }); this.wave(x.o, t, 0xd6ffe0, { amp: 0.35, freq: 1.3, w: 0.06, life: 0.15 }); this.fx.line(x.o, t, 0x7dff9a, 0.3, 0.16, { a0: 0.35, a1: 0.35, shrink: 0.3 }); if (this.nearMon(t, 1.2)) { const n = _d.copy(x.o).sub(t); const L = n.length(); this.fx.add.spawn(t.x, t.y, t.z, n.x / L * 12, n.y / L * 12, n.z / L * 12, new THREE.Color(0xaaffcc), new THREE.Color(0x2aa06a), 0.7, Math.min(0.5, L / 12), 0, 0.2, -0.5, SHAPE.star, 3); } } },
  eclipse(x) {
    for (const t of x.tips) { this.fx.line(x.o, t, 0xff5a7a, 0.6, 0.26, { w1: 0.05, a0: 0.95, a1: 0.25, shrink: 0.5, fade: 0.6, c2: 0x6a0a50 }); this.fx.line(x.o, t, 0xffd0dc, 0.14, 0.18, { a0: 1, a1: 0.4, shrink: 0.3 }); }
    this.fx.ring(_q.copy(x.o).addScaledVector(x.aim, 3), x.aim, 0xff5a7a, 7, 0.32, { r0: 0.6, shock: true }); this.fx.spray(x.o, 0xff5a7a, 10, 20, 0.45, 0.9, { dir: x.aim, cone: 0.28, c2: 0x3a0a30, drag: 2, raw: this.tier > 0 });
  },
  voltaico(x) { for (const t of x.tips) { this.bolt(x.o, t, 0x7ab4ff, { w: 0.16, step: 2.8, jit: 0.6, forks: 2, life: 0.24 }); this.later(0.045, () => this.bolt(x.o, t, 0xcfe8ff, { w: 0.09, step: 2.4, jit: 0.6, forks: 1, life: 0.14 })); this.fx.line(x.o, t, 0x4a8aff, 0.4, 0.18, { a0: 0.3, a1: 0.3, shrink: 0.3 }); } },
  glaciar(x) {
    for (const t of x.tips) { const L = x.o.distanceTo(t); ray(this, x, t, { c: 0x9fe8ff, c2: 0x3a8aff });
      const n = Math.min(this.tier === 0 ? 2 : 6, Math.floor(L / 6)); for (let i = 1; i <= n; i++) { _q.copy(x.o).lerp(t, i / (n + 1)); this.fx.add.spawn(_q.x + rnd(0.6) - 0.3, _q.y + rnd(0.6) - 0.3, _q.z + rnd(0.6) - 0.3, rnd(1) - 0.5, rnd(1) - 0.5, rnd(1) - 0.5, new THREE.Color(0xe6fbff), new THREE.Color(0x66b8ff), 0.6, 0.9, 2.5, 0.8, -0.4, SHAPE.shard, 5); } }
  },
  plaga(x) { for (const t of x.tips) { this.wave(x.o, t, 0x9dff5a, { amp: 0.4, freq: 0.6, w: 0.1, life: 0.2, c2: 0x2aa04a }); this.fx.line(x.o, t, 0x7dff4a, 0.3, 0.18, { a0: 0.3, a1: 0.3, shrink: 0.3 }); const L = x.o.distanceTo(t), n = Math.min(this.tier === 0 ? 2 : 5, Math.floor(L / 7)); for (let i = 1; i <= n; i++) { _q.copy(x.o).lerp(t, i / (n + 1)); this.fx.add.spawn(_q.x, _q.y, _q.z, rnd(1) - 0.5, rnd(1) - 0.5, rnd(1) - 0.5, new THREE.Color(0x9dff5a), new THREE.Color(0x2aa04a), 0.65, 0.9, i & 1 ? 7 : -0.5, 0.6, 0.3, SHAPE.bubble, 0); } } },
  brasa(x) { stream(this, x, 0xff9a2a, 0xa01008, { reach: 18, size: 1.1, sp: 20, every: 0.05 }); if (this.tier > 0 && this.gate('brs', 0.2) && x.tips[0]) { const d = _d.copy(x.tips[0]).sub(x.o).normalize().clone(); this.fx.spray(_q.copy(x.o).addScaledVector(d, 10), 0x2a2020, 1, 3, 1.2, 1.1, { smoke: true, shape: SHAPE.smoke, up: 3, grow: 1.4, c2: 0x0a0606, spin: 1, raw: true }); } },
  mina(x) { this.fx.ring(_q.copy(x.o).addScaledVector(x.aim, 1.5), x.aim, 0xffd23f, 3, 0.3, { r0: 0.3, shock: true }); this.fx.spray(x.o, 0xffe27a, 5, 9, 0.4, 0.6, { dir: x.aim, cone: 0.5, c2: 0xff9a2a, raw: true }); },
  sierra(x) { // hoja de luz: media luna giratoria delante del arma
    const d = x.aim, c = _q.copy(x.o).addScaledVector(d, 4.5).clone(); perp(d, _u, _w); const ph = rnd(6.283), n = this.tier === 0 ? 5 : 9, R = 3.4; let prev = null;
    for (let i = 0; i <= n; i++) { const a = ph + (i / n - 0.5) * 2.2, q = c.clone().addScaledVector(_u, Math.cos(a) * R).addScaledVector(_w, Math.sin(a) * R); if (prev) { this.fx.line(prev, q, 0xff5a7a, 0.4, 0.12, { w1: 0.4, a0: 0.9, a1: 0.9, shrink: 0.5, c2: 0xffd0dc }); this.fx.line(prev, q, 0xffffff, 0.12, 0.1, { a0: 1, a1: 1, shrink: 0.4 }); } prev = q; }
    this.fx.flash(c, 0xff7a9a, 3.6, 0.1, { burst: true, op: 0.7 });
  },
  dardos(x) { x.tips.forEach((t) => { ray(this, x, t, { c: 0x66ffcc, c2: 0x1aa0a0 }); const n = Math.min(this.tier === 0 ? 1 : 3, Math.floor(x.o.distanceTo(t) / 10)); for (let i = 1; i <= n; i++) { _q.copy(x.o).lerp(t, i / (n + 1)); this.fx.add.spawn(_q.x, _q.y, _q.z, rnd(1) - 0.5, rnd(1) - 0.5, rnd(1) - 0.5, new THREE.Color(0xe0fff6), new THREE.Color(0x2aa0a0), 0.55, 0.5, 2, 1, -0.5, SHAPE.shard, 6); } }); },
  requiem(x) {
    for (const t of x.tips) { const d = _d.copy(t).sub(x.o).normalize().clone(), L = x.o.distanceTo(t); ray(this, x, t, { c: 0xb98cff, c2: 0x2a0a60, nohead: true }); this.fx.line(x.o, t, 0x6a3aff, 1.0, 0.5, { a0: 0.35, a1: 0.35, shrink: 0.3, fade: 0.5, c2: 0x2a0a60 });
      const n = Math.min(this.tier === 0 ? 3 : 6, Math.floor(L / 25)); for (let i = 1; i <= n; i++) { const q = x.o.clone().lerp(t, i / (n + 1)); this.later(i * 0.03, () => this.fx.ring(q, d, 0xb98cff, 2.4, 0.45, { r0: 0.3, op: 0.7 })); } }
  },
  quimeraexp(x) { for (const t of x.tips) { ray(this, x, t, { c: 0xff66c4 }); this.fx.ring(t, _d.copy(x.o).sub(t).normalize(), 0xff66c4, 5, 0.4, { r0: 0.4, shock: true }); } },
  quimera(x) { for (const t of x.tips) { ray(this, x, t, { c: 0xff66c4 }); } },
};
