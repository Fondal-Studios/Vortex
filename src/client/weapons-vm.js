import * as THREE from 'three';
import { crystalMaterial } from './shaders.js';

const G = {
  oct: new THREE.OctahedronGeometry(1, 0), ico: new THREE.IcosahedronGeometry(1, 0), tet: new THREE.TetrahedronGeometry(1, 0), cone: new THREE.ConeGeometry(1, 2, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 2, 8), box: new THREE.BoxGeometry(1, 1, 1), torus: new THREE.TorusGeometry(1, 0.1, 6, 20),
};
const M = (geo, mat, s = [1, 1, 1], p = [0, 0, 0], r = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.scale.set(...s); m.position.set(...p); m.rotation.set(...r); return m; };
export const WEAPON_COLORS = [0x66ffee, 0xff8fd0, 0xffd34a, 0xff7a45, 0xa98bff];
const FORWARD = new THREE.Euler(-Math.PI / 2, 0, 0); // los conos apuntan a -Z

/** Cada arma: grupo 3D psicodélico + `tick(dt, t, firing)` y punto de boca `muzzle`. */
const BUILDERS = [
  // 1 · Haz — pistola de prisma con anillo giratorio y esquirlas en órbita
  (c, mats) => {
    const m = mats.main, g = new THREE.Group(), spin = new THREE.Group(), shards = [];
    g.add(M(G.oct, m, [0.08, 0.09, 0.36], [0, 0, 0]));
    g.add(M(G.cone, m, [0.04, 0.3, 0.04], [0, 0, -0.5], [-Math.PI / 2, 0, 0]));
    const ring = M(G.torus, mats.glow, [0.12, 0.12, 0.12], [0, 0, -0.38]); spin.add(ring); g.add(spin);
    for (let i = 0; i < 3; i++) { const s = M(G.tet, mats.glow, [0.025, 0.04, 0.025]); g.add(s); shards.push(s); }
    return { g, muzzle: [0, 0, -0.85], tick(dt, t, f) { spin.rotation.z += dt * (f ? 18 : 3); shards.forEach((s, i) => { const a = t * 3 + i * 2.09; s.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, -0.7); s.rotation.z = a; }); } };
  },
  // 2 · Prisma — escopeta de tres cañones en abanico con anillos refractantes
  (c, mats) => {
    const g = new THREE.Group(), rings = [];
    g.add(M(G.box, mats.dark, [0.16, 0.12, 0.34], [0, -0.01, 0.05]));
    for (const a of [-0.2, 0, 0.2]) g.add(M(G.cone, mats.main, [0.045, 0.34, 0.045], [Math.sin(a) * 0.22, 0, -0.42], [-Math.PI / 2, 0, a]));
    for (let i = 0; i < 2; i++) { const r = M(G.torus, mats.glow, [0.17, 0.17, 0.17], [0, 0, -0.18 - i * 0.2]); g.add(r); rings.push(r); }
    g.add(M(G.oct, mats.glow, [0.05, 0.05, 0.05], [0, 0.1, 0.1]));
    return { g, muzzle: [0, 0, -0.95], tick(dt, t, f) { rings.forEach((r, i) => { r.rotation.z += dt * (f ? 14 : 2) * (i ? -1 : 1); r.scale.setScalar(0.17 + 0.015 * Math.sin(t * 6 + i)); }); } };
  },
  // 3 · Ráfaga — haz de cañones giratorios (multi-cañón) con tambor luminoso
  (c, mats) => {
    const g = new THREE.Group(), drum = new THREE.Group();
    g.add(M(G.box, mats.dark, [0.12, 0.14, 0.3], [0, -0.03, 0.12]));
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; drum.add(M(G.cyl, i % 2 ? mats.main : mats.glow, [0.022, 0.32, 0.022], [Math.cos(a) * 0.055, Math.sin(a) * 0.055, -0.3], [Math.PI / 2, 0, 0])); }
    drum.add(M(G.torus, mats.glow, [0.09, 0.09, 0.09], [0, 0, -0.5])); g.add(drum);
    g.add(M(G.ico, mats.glow, [0.06, 0.06, 0.06], [0, 0.1, 0.05]));
    let spin = 0;
    return { g, muzzle: [0, 0, -0.65], tick(dt, t, f) { spin += dt * (f ? 40 : 1.2); drum.rotation.z = spin; } };
  },
  // 4 · Nova — lanzador con cámara bulbosa y un orbe que arremolina en su interior
  (c, mats) => {
    const g = new THREE.Group();
    g.add(M(G.cyl, mats.dark, [0.09, 0.4, 0.09], [0, 0, -0.2], [Math.PI / 2, 0, 0]));
    const bulb = M(G.ico, mats.main, [0.17, 0.17, 0.17], [0, 0.02, 0.06]); g.add(bulb);
    const orb = M(G.ico, mats.glow, [0.09, 0.09, 0.09], [0, 0.02, 0.06]); g.add(orb);
    for (let i = 0; i < 3; i++) g.add(M(G.tet, mats.main, [0.04, 0.12, 0.04], [Math.cos(i * 2.09) * 0.12, Math.sin(i * 2.09) * 0.12, -0.38], [0, 0, i * 2.09]));
    g.add(M(G.torus, mats.glow, [0.12, 0.12, 0.12], [0, 0, -0.55]));
    return { g, muzzle: [0, 0, -0.65], tick(dt, t, f) { orb.rotation.set(t * 3, t * 4, 0); orb.scale.setScalar(0.09 + 0.02 * Math.sin(t * 9) + (f ? 0.04 : 0)); bulb.rotation.y = t * 0.6; } };
  },
  // 5 · Aguja — riel largo de dos vigas con bobinas que pulsan
  (c, mats) => {
    const g = new THREE.Group(), coils = [];
    for (const x of [-0.05, 0.05]) g.add(M(G.box, mats.main, [0.025, 0.05, 0.9], [x, 0, -0.25]));
    g.add(M(G.cone, mats.glow, [0.012, 0.5, 0.012], [0, 0, -0.95], [-Math.PI / 2, 0, 0]));
    for (let i = 0; i < 4; i++) { const r = M(G.torus, mats.glow, [0.085, 0.085, 0.085], [0, 0, -0.55 + i * 0.2]); g.add(r); coils.push(r); }
    g.add(M(G.oct, mats.dark, [0.08, 0.1, 0.2], [0, -0.04, 0.3]));
    return { g, muzzle: [0, 0, -1.2], tick(dt, t, f) { coils.forEach((r, i) => { const k = (Math.sin(t * 8 - i * 1.2) + 1) / 2; r.scale.setScalar(0.07 + k * 0.03 + (f ? 0.03 : 0)); }); } };
  },
];

export class Viewmodels {
  constructor(camera, haloTexture) {
    this.root = new THREE.Group(); camera.add(this.root);
    this.items = BUILDERS.map((build, i) => {
      const c = WEAPON_COLORS[i];
      const mats = { main: crystalMaterial(c, { glow: 0.12 }), glow: crystalMaterial(c, { glow: 1.6 }), dark: crystalMaterial(new THREE.Color(c).multiplyScalar(0.28), { glow: 0.05 }) };
      const b = build(c, mats), holder = new THREE.Group(); holder.add(b.g);
      // antebrazo-guantelete cristalino
      holder.add(M(G.box, mats.dark, [0.075, 0.075, 0.34], [0.03, -0.1, 0.34], [0.35, 0, 0]));
      holder.add(M(G.torus, mats.glow, [0.065, 0.065, 0.065], [0.03, -0.075, 0.2], [0, 0, 0]));
      const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
      flash.position.set(...b.muzzle); flash.scale.setScalar(0.5); holder.add(flash);
      holder.visible = false; this.root.add(holder);
      return { holder, flash, tick: b.tick, mats };
    });
    this.cur = -1; this.raise = 1; this.kick = 0; this.sx = 0; this.sy = 0; this.t = 0;
  }
  setWeapon(i) { if (i === this.cur) return; this.items.forEach((it, k) => { it.holder.visible = k === i; }); this.cur = i; this.raise = 1; }
  shoot() { this.kick = 1; const it = this.items[this.cur]; if (it) it.flash.material.opacity = 1; }
  update(dt, { firing, hidden, look = [0, 0] }) {
    this.t += dt; this.kick = Math.max(0, this.kick - dt * 7); this.raise = Math.max(0, this.raise - dt * 5);
    this.sx += (look[0] - this.sx) * Math.min(1, 10 * dt); this.sy += (look[1] - this.sy) * Math.min(1, 10 * dt);
    const it = this.items[this.cur]; if (!it) return;
    it.holder.visible = !hidden;
    const bob = Math.sin(this.t * 1.7) * 0.004;
    it.holder.position.set(0.27 - this.sx * 0.02, -0.25 + bob - this.raise * 0.35 + this.sy * 0.015, -0.6 + this.kick * 0.1);
    it.holder.rotation.set(this.kick * 0.16 + this.sy * 0.04, this.sx * 0.05, 0); it.holder.scale.setScalar(0.62);
    it.tick(dt, this.t, firing);
    it.flash.material.opacity = Math.max(0, it.flash.material.opacity - dt * 14);
    it.flash.scale.setScalar(0.4 + Math.random() * 0.25);
  }
}
