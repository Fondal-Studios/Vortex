// Armas psicodélicas en primera persona y modelos para el mundo.
// Las piezas viven en src/client/weapons/ (kit.js: geometría y materiales · hands.js: guantes · guns.js: las 5 armas · fx.js: efectos).
import * as THREE from 'three';
import { cfg } from './quality.js';
import { qualityOf } from './weapons/kit.js';
import { BUILD, WEAPON_COLORS } from './weapons/guns.js';
import { VMFx, flashTexture, makeBeam } from './weapons/fx.js';
import { applyUpgrades } from './weapons/mods.js';
import { setHandStyle, HAND_STYLE, HAND_PRESETS, HU, TATTOOS, GLOVES } from './weapons/handmat.js';

/** FOV propio del viewmodel (vertical, grados). La cámara del juego usa ~82° (en un celular apaisado el arma se ve diminuta);
 *  el arma se dibuja como si se viera con este ángulo más cerrado: la raíz se ensancha en x/y (no en z) alrededor de la cámara. */
export const VM_FOV = 60;
export { WEAPON_COLORS, applyUpgrades, setHandStyle, HAND_PRESETS, TATTOOS, GLOVES };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const smooth = (x) => x * x * (3 - 2 * x);

class Spring {
  constructor(k, c) { this.x = 0; this.v = 0; this.k = k; this.c = c; }
  step(dt) { let n = Math.max(1, Math.ceil(dt / 0.006)); const h = dt / n; while (n--) { this.v += (-this.k * this.x - this.c * this.v) * h; this.x += this.v * h; } return this.x; }
}

/** Armas en primera persona: cuelgan de la cámara. Contrato: setWeapon(i), shoot(), update(dt,{firing,hidden,look,speed,ammo,maxAmmo}), setAmmo(n,max), root. */
export class Viewmodels {
  constructor(camera, haloTexture) {
    this.camera = camera; this.halo = haloTexture;
    this.root = new THREE.Group(); camera.add(this.root);
    this.q = qualityOf(cfg().humans); this.fx = new VMFx(this.root, haloTexture, this.q);
    this.items = []; this.cur = -1; this.pending = -1; this.low = 1; this.phase = 'in'; this.t = 0;
    this.upg = {}; this.sx = 0; this.sy = 0; this.bobPhase = 0; this.bobAmp = 0; this.lastSx = 0; this.ammo = {}; this.hidden = false;
  }
  /** Reconstruye las armas con otro nivel de calidad ('low' | 'medium' | 'high'). */
  setQuality(name) {
    this.q = qualityOf(name); const cur = this.cur;
    for (const it of this.items) if (it) { this.root.remove(it.rig); it.W.dispose(); it.shape.material.dispose(); it.glow.material.dispose(); it.beam.material.dispose(); it.beam.geometry.dispose(); }
    this.items = []; this.fx.dispose(); this.fx = new VMFx(this.root, this.halo, this.q); if (cur >= 0) this._ensure(cur).rig.visible = true;
  }
  _ensure(i) {
    let it = this.items[i]; if (it) return it;
    const W = BUILD[i](this.q, true), rig = new THREE.Group(); rig.add(W.group); W.group.userData.index = i; W.group.userData.muzzle = W.muzzle; if (this.upg[i]) applyUpgrades(W.group, this.upg[i]);
    const hex = WEAPON_COLORS[i], shape = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(W.flash.shape), color: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.55), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.halo, color: hex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
    for (const s of [glow, shape]) { s.position.set(...W.muzzle); s.renderOrder = 10; s.visible = false; rig.add(s); }
    const beam = makeBeam(hex); beam.position.set(...W.muzzle); beam.visible = false; beam.renderOrder = 9; rig.add(beam);
    rig.visible = false; this.root.add(rig);
    const r = W.recoil, sp = { z: new Spring(r.k, r.c), y: new Spring(r.k, r.c), p: new Spring(r.k * 0.9, r.c), r: new Spring(r.k, r.c) };
    const tmpP = new THREE.Vector3(), tmpV = new THREE.Vector3(), pq = new THREE.Quaternion();
    const toRoot = (p) => tmpP.set(p[0], p[1], p[2]).applyMatrix4(rig.matrix).clone();
    const dirRoot = (v) => tmpV.set(v[0], v[1], v[2]).multiplyScalar(rig.scale.x).applyQuaternion(pq.copy(rig.quaternion)).clone();
    const ctx = {
      shard: (p, v, hex2, s = 1) => this.fx.shard(toRoot(p), dirRoot(v), hex2, s),
      puff: (p, v, hex2, o) => this.fx.puff(toRoot(p), dirRoot(v), hex2, { ...o, size: (o && o.size || 0.08) * rig.scale.x * 1.6, grow: ((o && o.grow) || 0.2) * rig.scale.x * 1.6 }),
    };
    it = { W, rig, sp, shape, glow, beam, f: 0, ctx, auto: W.flash.shape === 'jet' };
    if (this.ammo.n !== undefined) W.setAmmo(this.ammo.n, this.ammo.max);
    this.items[i] = it; return it;
  }
  /** Estilo de las manos: { color, accent, tattoo: 'runas'|'ojos'|'constelacion'|'venas'|'ninguno', glove: 'tactico'|'cristal'|'desnudo', skin }.
   *  Parcial (lo no pasado se conserva), en caliente, sin reconstruir. También sirve un nombre de HAND_PRESETS ('egida'...'umbra'). Devuelve el estilo vigente. */
  setHandStyle(st) { return setHandStyle(typeof st === 'string' ? HAND_PRESETS[st] || {} : st); }
  getHandStyle() { return { ...HAND_STYLE }; }
  /** Mejoras visibles de un arma: upg = { dmg:0-5, rate:0-5, mag:0-4, mod:null|'perfora'|'explosiva'|'cadena'|'vampirica' }. Se recuerdan por arma. */
  setUpgrades(weaponId, upg) { this.upg[weaponId] = upg ? { ...upg } : null; const it = this.items[weaponId]; if (it) applyUpgrades(it.W.group, upg || {}); }
  setAmmo(n, max) { this.ammo = { n, max }; const it = this.items[this.cur]; if (it) it.W.setAmmo(n, max); }
  setWeapon(i) {
    if (!(i >= 0 && i < BUILD.length)) return;
    if (this.cur < 0) { this._show(i); this.low = 1; this.phase = 'in'; return; }
    if (i === this.cur) { this.pending = -1; if (this.phase === 'out') this.phase = 'in'; return; }
    this.pending = i; this.phase = 'out';
  }
  _show(i) {
    this.items.forEach((it, k) => { if (it) it.rig.visible = k === i; });
    const it = this._ensure(i); it.rig.visible = !this.hidden; this.cur = i; this.pending = -1;
    if (this.ammo.n !== undefined) it.W.setAmmo(this.ammo.n, this.ammo.max);
  }
  shoot() {
    const it = this.items[this.cur]; if (!it || this.phase === 'out') return;
    const { W, sp } = it, r = W.recoil;
    sp.z.v += r.z * Math.sqrt(r.k) * 1.2; sp.y.v += -r.y * Math.sqrt(r.k) * 1.2; sp.p.v += r.pitch * Math.sqrt(r.k) * 1.1; sp.r.v += (Math.random() - 0.5) * 2 * r.roll * Math.sqrt(r.k) * 1.2;
    it.f = 1; it.shape.material.rotation = Math.random() * 6.28; it.rig.updateMatrix(); W.fire(it.ctx); it.beamJ = Math.random();
  }
  update(dt, { firing = false, hidden = false, look = [0, 0], speed = 0, ammo, maxAmmo } = {}) {
    dt = Math.min(dt, 0.1); this.t += dt; this.hidden = hidden;
    const kf = Math.tan((this.camera.fov || 82) * Math.PI / 360) / Math.tan(VM_FOV * Math.PI / 360); this.root.scale.set(kf, kf, 1);
    if (ammo !== undefined) this.setAmmo(ammo, maxAmmo === undefined ? ammo : maxAmmo);
    this.fx.setScale(this.camera.fov || 82, (typeof window !== 'undefined' ? window.innerHeight : 720) * 0.8);
    // cambio de arma: baja la actual, sube la nueva con un giro
    if (this.phase === 'out') { this.low = Math.min(1, this.low + dt / 0.15); if (this.low >= 1 && this.pending >= 0) { this._show(this.pending); this.phase = 'in'; } }
    else this.low = Math.max(0, this.low - dt / 0.36);
    this.fx.update(dt);
    const it = this.items[this.cur]; if (!it) return;
    it.rig.visible = !hidden; const { W, sp } = it, v = W.view;
    // balanceo por giro de cámara (suave y limitado)
    this.sx = damp(this.sx, look[0], 9, dt); this.sy = damp(this.sy, look[1], 9, dt);
    const sx = Math.tanh(this.sx * 0.7) / 0.7, sy = Math.tanh(this.sy * 0.7) / 0.7;
    // caminar: bob que crece con la velocidad
    const amp = clamp(speed / 6.5, 0, 1); this.bobAmp = damp(this.bobAmp, amp, 7, dt); this.bobPhase += dt * (5.5 + clamp(speed, 0, 12) * 0.85) * (amp > 0.02 ? 1 : 0);
    const b = this.bobAmp, ph = this.bobPhase, breathe = Math.sin(this.t * 1.7);
    const kz = sp.z.step(dt), ky = sp.y.step(dt), kp = sp.p.step(dt), kr = sp.r.step(dt);
    const lowE = smooth(this.low), lowTilt = this.low * this.low;
    it.rig.position.set(
      v.pos[0] - sx * 0.02 + Math.sin(ph) * 0.013 * b - lowE * 0.08,
      v.pos[1] + breathe * 0.0032 * (1 - b) + sy * 0.015 - Math.abs(Math.cos(ph)) * 0.011 * b + ky * 1 - lowE * 0.42,
      v.pos[2] + kz + Math.sin(ph * 2) * 0.004 * b + (it.phase === 'x' ? 0 : 0));
    it.rig.rotation.set(
      v.rot[0] + kp + sy * 0.04 + breathe * 0.004 + Math.sin(ph * 2 + 1) * 0.008 * b - lowTilt * 0.95,
      v.rot[1] + sx * 0.055 + Math.sin(ph) * 0.012 * b + lowTilt * 0.55,
      v.rot[2] + kr - sx * 0.035 + Math.sin(ph) * 0.016 * b + lowTilt * 0.6, 'YXZ');
    it.rig.scale.set(v.scale, v.scale, v.scale * (v.zs || 1)); it.rig.updateMatrix();
    const u = this.upg[this.cur]; HU.uUpg.value = u ? Math.min(1, ((u.dmg | 0) + (u.rate | 0) + (u.mag | 0) + (u.mod ? 1 : 0)) / 15) : 0; // el tatuaje crece con las mejoras del arma
    W.update(dt, this.t, firing, it.ctx);
    // fogonazo: destello con forma propia + halo
    it.f = Math.max(0, it.f - dt * W.flash.decay * 0.8);
    const f = it.f, jit = it.auto ? 0.75 + Math.random() * 0.5 : 1; if (it.auto && f > 0.5) it.shape.material.rotation = Math.random() * 6.28;
    const on = f > 0.012; it.shape.visible = it.glow.visible = it.beam.visible = on;
    if (on) {
      const fs0 = W.flash.size, fs = fs0 > 1 ? 1 + (fs0 - 1) * 0.2 : fs0, gl = W.flash.glow ?? 0.55;
      it.shape.material.opacity = Math.min(1, f * 1.5); it.shape.scale.setScalar(fs * 0.62 * (0.55 + 0.6 * f) * jit);
      const hi = this.q.high ? 0.55 : 1; it.glow.material.opacity = Math.min(0.8, f * (0.3 + gl * 0.5)) * hi; it.glow.scale.setScalar(fs * 0.62 * (0.55 + 0.8 * f) * jit);
      // haz de luz hacia donde va el disparo: 2 cintas cruzadas desde la boca (se ve igual en Baja)
      const u = it.beam.material.uniforms; u.uI.value = Math.min(1, f * 1.3) * (W.flash.beam ?? 1); const w = (0.05 + fs * 0.05) * (0.7 + 0.5 * f), L = (W.flash.len ?? 3.2) * (0.5 + 0.5 * f); it.beam.scale.set(w, w, L);
    }
    this.fx.setLive();
  }
}

/** Modelo del arma para el mundo / tercera persona (lo usa el avatar). Origen en la empuñadura, boca hacia -Z.
 *  group.userData: muzzle [x,y,z] · tick(dt,t,firing) · shoot() · setAmmo(n,max) · dispose(). `hands:true` agrega guantes (no suele hacer falta). */
export function createWeaponModel(index = 0, { quality = 'high', hands = false } = {}) {
  const i = ((index % BUILD.length) + BUILD.length) % BUILD.length, W = BUILD[i](qualityOf(quality), !!hands), g = W.group;
  g.userData.index = i; g.userData.muzzle = W.muzzle; g.userData.tick = (dt, t, firing) => W.update(Math.min(dt, 0.1), t, !!firing);
  g.userData.shoot = () => W.fire(null); g.userData.setAmmo = W.setAmmo; g.userData.dispose = W.dispose; g.userData.eject = W.eject; g.userData.weapon = W;
  return g;
}
