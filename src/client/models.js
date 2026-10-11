import * as THREE from 'three';
import { crystalMaterial } from './shaders.js';
import { cfg } from './quality.js';
import { kit, setHurt } from './organism.js';
import { ORGANISMS } from './creatures/index.js';

/** Colores del bestiario (también usados por partículas y HUD). */
export const COLORS = {
  astilla: 0x44ffd0, geoda: 0xb066ff, prisma: 0xff66c4, lente: 0xffd23f, cuarzo: 0xff7a45,
  espejo: 0xcfe9ff, racimo: 0xff3b5c, graviton: 0x6a7bff, coloso: 0xffc65c, madre: 0x9dff5a,
  obelisco: 0x2de0ff, aurora: 0xff9ae8, ariete: 0xff8a3d, espiral: 0xb48cff,
};

const G = {
  oct: new THREE.OctahedronGeometry(1, 0), ico: new THREE.IcosahedronGeometry(1, 0), tet: new THREE.TetrahedronGeometry(1, 0),
  cone6: new THREE.ConeGeometry(1, 2, 6), cyl6: new THREE.CylinderGeometry(1, 1, 2, 6), box: new THREE.BoxGeometry(1, 1, 1),
  torus: new THREE.TorusGeometry(1, 0.08, 6, 24), halfA: new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  halfB: new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), sph: new THREE.SphereGeometry(1, 12, 8),
  knot: new THREE.TorusKnotGeometry(0.7, 0.13, 72, 6, 2, 3), cyl8: new THREE.CylinderGeometry(1, 1, 2, 8), dome: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
};
const mesh = (geo, mat, s = [1, 1, 1], p = [0, 0, 0]) => { const m = new THREE.Mesh(geo, mat); m.scale.set(...s); m.position.set(...p); return m; };

/**
 * Cada constructor devuelve { root, mats, tick(dt, st) } con el modelo a escala unitaria
 * (el render lo escala por el radio). Frente = +Z, arriba = +Y. `st` = estado del monstruo.
 */
const BUILD = {
  astilla(c) {
    const m = crystalMaterial(c), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh(G.oct, m, [0.55, 0.5, 1.5]));
    const head = mesh(G.tet, m, [0.4, 0.4, 0.5], [0, 0.15, 1.35]); head.rotation.x = Math.PI / 2; body.add(head);
    const legs = [];
    for (let i = 0; i < 4; i++) { const l = mesh(G.cone6, m, [0.12, 0.7, 0.12], [(i % 2 ? 1 : -1) * 0.55, -0.3, (i < 2 ? 0.5 : -0.5)]); l.rotation.z = (i % 2 ? -1 : 1) * 0.6; body.add(l); legs.push(l); }
    const spikes = mesh(G.tet, m, [0.3, 0.3, 0.6], [0, 0.45, -0.9]); spikes.rotation.x = -1.2; body.add(spikes);
    return { root, mats: [m], tick(dt, st, t) {
      body.position.y = Math.sin(t * 14 + st.id) * 0.08; body.rotation.z = Math.sin(t * 7 + st.id) * 0.12;
      legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 16 + i * 1.6) * 0.7; });
      body.position.z = st.s === 'leap' ? 0.3 : 0;
    } };
  },
  geoda(c) {
    const shell = crystalMaterial(c), core = crystalMaterial(0xff9a3c, { glow: 1.0 }), root = new THREE.Group();
    const top = new THREE.Group(), bot = new THREE.Group(); root.add(top, bot);
    top.add(mesh(G.halfA, shell)); bot.add(mesh(G.halfB, shell));
    for (let i = 0; i < 6; i++) { const sp = mesh(G.cone6, shell, [0.18, 0.5, 0.18]); const a = i * 1.047; sp.position.set(Math.cos(a) * 0.8, 0.55, Math.sin(a) * 0.8); sp.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); top.add(sp); }
    const inner = mesh(G.ico, core, [0.55, 0.55, 0.55]); root.add(inner);
    let open = 0;
    return { root, mats: [shell, core], tick(dt, st, t) {
      open += ((st.o ? 1 : 0) - open) * Math.min(1, 10 * dt);
      top.position.y = open * 0.9; top.rotation.z = open * 0.5; bot.position.y = -open * 0.5; bot.rotation.z = -open * 0.2;
      core.uniforms.uGlow.value = 0.2 + open * 1.4; inner.scale.setScalar(0.45 + open * 0.25);
      inner.rotation.y = t * 2; root.rotation.x = st.o ? 0 : t * 2.2; // rueda cerrado, quieto abierto
    } };
  },
  prisma(c) {
    const m = crystalMaterial(c), root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    body.add(mesh(G.cone6, m, [0.5, 0.9, 0.5], [0, 0, 0.5])).rotation.x = Math.PI / 2;
    const b2 = mesh(G.cone6, m, [0.5, 0.6, 0.5], [0, 0, -0.3]); b2.rotation.x = -Math.PI / 2; body.add(b2);
    const wings = [-1, 1].map((s) => { const w = mesh(G.tet, m, [1.0, 0.08, 0.7], [s * 0.7, 0, 0]); body.add(w); return w; });
    return { root, mats: [m], tick(dt, st, t) {
      const f = st.s === 'wind' ? 26 : 9;
      wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * f) * 0.6; });
      body.rotation.z = t * (st.s === 'dive' ? 14 : 2); m.uniforms.uGlow.value = st.s === 'wind' ? 1.4 : 0;
    } };
  },
  lente(c) {
    const m = crystalMaterial(c), lens = crystalMaterial(0xffffff, { glow: 0.3 }), root = new THREE.Group();
    root.add(mesh(G.oct, m, [0.7, 1.3, 0.7], [0, 0.2, 0]));
    const ring = mesh(G.torus, m, [0.9, 0.9, 0.9], [0, 0.4, 0.55]); root.add(ring);
    const disc = mesh(G.cyl6, lens, [0.65, 0.04, 0.65], [0, 0.4, 0.58]); disc.rotation.x = Math.PI / 2; root.add(disc);
    for (let i = 0; i < 3; i++) root.add(mesh(G.cone6, m, [0.12, 0.6, 0.12], [Math.cos(i * 2.09) * 0.4, -1.0, Math.sin(i * 2.09) * 0.4]));
    return { root, mats: [m, lens], tick(dt, st, t) {
      const aim = st.s === 'aim'; lens.uniforms.uGlow.value = aim ? 3 : 0.3; ring.rotation.z = t * (aim ? 8 : 1);
      root.position.y = Math.sin(t * 2 + st.id) * 0.1;
    } };
  },
  cuarzo(c) {
    const m = crystalMaterial(c), root = new THREE.Group(), cl = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group(), h = 0.9 + (i % 3) * 0.35;
      g.add(mesh(G.cyl6, m, [0.22, h * 0.6, 0.22], [0, h * 0.6, 0])); g.add(mesh(G.cone6, m, [0.22, 0.4, 0.22], [0, h * 1.2 + 0.4, 0]));
      const a = (i / 6) * Math.PI * 2; g.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); g.position.set(Math.cos(a) * 0.15, -0.9, Math.sin(a) * 0.15); root.add(g); cl.push(g);
    }
    return { root, mats: [m], tick(dt, st, t) {
      const cast = st.s === 'cast'; m.uniforms.uGlow.value = cast ? 2 : 0.1;
      cl.forEach((g, i) => { g.scale.y = 1 + (cast ? 0.4 + 0.2 * Math.sin(t * 12 + i) : 0); });
      root.rotation.y = t * (cast ? 3 : 0.5); root.position.y = Math.sin(t * 1.6) * 0.15;
    } };
  },
  espejo(c) {
    const m = crystalMaterial(c, { alpha: 0.85 }), root = new THREE.Group(), pan = [];
    for (let i = 0; i < 4; i++) { const p = mesh(G.box, m, [0.9, 1.9, 0.07]); p.rotation.y = (i * Math.PI) / 4; root.add(p); pan.push(p); }
    root.add(mesh(G.oct, m, [0.45, 0.7, 0.45]));
    return { root, mats: [m], tick(dt, st, t) {
      m.uniforms.uShim.value += ((st.c ? 0.92 : 0) - m.uniforms.uShim.value) * Math.min(1, 8 * dt);
      pan.forEach((p, i) => { p.rotation.y = i * 0.785 + Math.sin(t * 2 + i) * 0.5 + (st.s === 'blink' ? t * 20 : 0); });
      root.position.y = Math.sin(t * 3 + st.id) * 0.12;
    } };
  },
  racimo(c) {
    const m = crystalMaterial(c, { glow: 0.5 }), root = new THREE.Group(), nodes = [];
    for (let i = 0; i < 7; i++) { const a = i * 2.4, n = mesh(G.ico, m, [0.4, 0.4, 0.4], [Math.cos(a) * 0.55, Math.sin(i * 1.3) * 0.5, Math.sin(a) * 0.55]); root.add(n); nodes.push(n); }
    root.add(mesh(G.ico, m, [0.55, 0.55, 0.55]));
    return { root, mats: [m], tick(dt, st, t) {
      nodes.forEach((n, i) => { const s = 0.4 + 0.12 * Math.sin(t * 11 + i * 2); n.scale.setScalar(s); });
      m.uniforms.uGlow.value = 0.6 + 0.7 * Math.sin(t * 12) ** 2; root.rotation.y = t * 4; root.rotation.x = t * 2.5;
    } };
  },
  graviton(c) {
    const m = crystalMaterial(c, { glow: 0.2 }), core = crystalMaterial(0xffffff, { glow: 1 }), root = new THREE.Group();
    root.add(mesh(G.sph, m, [0.6, 0.6, 0.6])); root.add(mesh(G.ico, core, [0.3, 0.3, 0.3]));
    const r1 = mesh(G.torus, m, [1.2, 1.2, 1.2]), r2 = mesh(G.torus, m, [1.5, 1.5, 1.5]); root.add(r1, r2);
    const halo = mesh(G.torus, core, [1, 1, 1]); halo.rotation.x = Math.PI / 2; root.add(halo);
    return { root, mats: [m, core], tick(dt, st, t) {
      const ch = st.s === 'charge'; r1.rotation.set(t * 1.5, t * 0.7, 0); r2.rotation.set(0, t * 1.1, t * 2);
      m.uniforms.uGlow.value = ch ? 2 : 0.2; const k = ch ? 1 + ((t * 2.5) % 1) * 3.2 : 1; halo.scale.setScalar(k); halo.visible = ch;
      root.position.y = Math.sin(t * 1.4 + st.id) * 0.2;
    } };
  },
  coloso(c) {
    const m = crystalMaterial(c, { glow: 0.2 }), edge = crystalMaterial(0xff4fd8, { glow: 0.5 }), root = new THREE.Group();
    const core = mesh(G.oct, m, [0.55, 0.9, 0.55]); root.add(core);
    const rings = [0, 1, 2].map((i) => { const r = mesh(G.torus, edge, [0.9 + i * 0.22, 0.9 + i * 0.22, 0.9 + i * 0.22]); r.scale.z = 1; root.add(r); return r; });
    const orbit = [];
    for (let i = 0; i < 8; i++) { const o = mesh(i % 2 ? G.oct : G.tet, i % 2 ? m : edge, [0.16, 0.3, 0.16]); root.add(o); orbit.push(o); }
    return { root, mats: [m, edge], tick(dt, st, t) {
      const w = st.s === 'wind'; core.rotation.y = t * 0.8; m.uniforms.uGlow.value = w ? 2.5 : 0.2;
      rings.forEach((r, i) => r.rotation.set(t * (0.6 + i * 0.35), t * (0.4 - i * 0.2), i));
      orbit.forEach((o, i) => { const a = t * 1.1 + (i * Math.PI) / 4, rr = 1.25 + (w ? 0.35 : 0); o.position.set(Math.cos(a) * rr, Math.sin(a * 2) * 0.4, Math.sin(a) * rr); o.rotation.y = a * 3; });
    } };
  },
  madre(c) {
    const shell = crystalMaterial(c), glow = crystalMaterial(0xff7ad9, { glow: 1.5 }), root = new THREE.Group(), petals = [];
    const orb = mesh(G.ico, glow, [0.5, 0.5, 0.5]); root.add(orb);
    for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 8; i++) {
      const holder = new THREE.Group(); holder.rotation.y = (i / 8) * Math.PI * 2 + ring * 0.4; holder.scale.y = ring ? -1 : 1;
      const g = new THREE.Group(); g.position.set(0, 0.1, 0.55); g.add(mesh(G.cone6, shell, [0.4, 0.85, 0.4], [0, 0.85, 0]));
      holder.add(g); root.add(holder); petals.push(g);
    }
    let k = 0;
    return { root, mats: [shell, glow], tick(dt, st, t) {
      k += ((st.o ? 1 : 0) - k) * Math.min(1, 6 * dt);
      petals.forEach((g) => { g.rotation.x = -1.0 + k * 1.7; });
      orb.scale.setScalar(0.4 + k * 0.4); glow.uniforms.uGlow.value = 0.5 + k * 2.5; orb.rotation.y = t * 1.2; root.rotation.y = t * 0.2;
    } };
  },
  obelisco(c) {
    const m = crystalMaterial(c), dark = crystalMaterial(0x16304a), eyeM = crystalMaterial(0xffffff, { glow: 0.6 }), root = new THREE.Group();
    root.add(mesh(G.cyl6, m, [0.5, 1.5, 0.5], [0, 0.4, 0]));
    root.add(mesh(G.cone6, m, [0.5, 0.8, 0.5], [0, 2.4, 0]));
    root.add(mesh(G.cyl6, dark, [0.85, 0.12, 0.85], [0, -1.05, 0]));
    const eye = mesh(G.oct, eyeM, [0.16, 0.45, 0.1], [0, 0.9, 0.5]); root.add(eye);
    const orbit = []; for (let i = 0; i < 3; i++) { const o = mesh(G.tet, m, [0.2, 0.3, 0.2]); root.add(o); orbit.push(o); }
    return { root, mats: [m, dark, eyeM], tick(dt, st, t) {
      const ch = st.s === 'charge'; eyeM.uniforms.uGlow.value = ch ? 4 : 0.5; eye.scale.y = ch ? 0.9 + 0.2 * Math.sin(t * 30) : 0.45;
      m.uniforms.uGlow.value = ch ? 1.2 : 0.1;
      orbit.forEach((o, i) => { const a = t * (ch ? 6 : 1.2) + i * 2.09; o.position.set(Math.cos(a) * 1.0, 0.4 + Math.sin(a * 2) * 0.5, Math.sin(a) * 1.0); o.rotation.y = a * 2; });
    } };
  },
  aurora(c) {
    const m = crystalMaterial(c, { alpha: 0.62 }), core = crystalMaterial(0xffffff, { glow: 1.2 }), root = new THREE.Group(), ten = [];
    root.add(mesh(G.dome, m, [1.1, 0.9, 1.1]));
    const heart = mesh(G.ico, core, [0.32, 0.32, 0.32], [0, 0.2, 0]); root.add(heart);
    for (let i = 0; i < 7; i++) { const g = new THREE.Group(), a = (i / 7) * Math.PI * 2; for (let k = 0; k < 3; k++) g.add(mesh(G.cone6, m, [0.07, 0.45, 0.07], [0, -0.45 - k * 0.55, 0])); g.position.set(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7); root.add(g); ten.push(g); }
    const ring = mesh(G.torus, core, [1.4, 1.4, 1.4], [0, -0.1, 0]); ring.rotation.x = Math.PI / 2; ring.visible = false; root.add(ring);
    return { root, mats: [m, core], tick(dt, st, t) {
      const cast = st.s === 'cast'; ten.forEach((g, i) => { g.rotation.z = Math.sin(t * 3 + i) * 0.35; g.rotation.x = Math.cos(t * 2.4 + i * 1.7) * 0.35; });
      heart.scale.setScalar(0.3 + 0.08 * Math.sin(t * 6) + (cast ? 0.25 : 0)); core.uniforms.uGlow.value = cast ? 3.2 : 1.0;
      ring.visible = cast; if (cast) ring.scale.setScalar(1 + ((t * 2.2) % 1) * 2.4); root.position.y = Math.sin(t * 1.5 + st.id) * 0.2;
    } };
  },
  ariete(c) {
    const m = crystalMaterial(c), dark = crystalMaterial(0x7a2e14), hornM = crystalMaterial(0xffe9b0, { glow: 0.2 }), root = new THREE.Group(), body = new THREE.Group(), legs = [];
    root.add(body);
    body.add(mesh(G.oct, m, [1.0, 0.8, 1.5], [0, 0.25, 0]));
    const head = new THREE.Group(); head.position.set(0, 0.2, 1.3); head.add(mesh(G.oct, dark, [0.6, 0.55, 0.65])); const horn = mesh(G.cone6, hornM, [0.22, 1.1, 0.22], [0, 0.05, 0.75]); horn.rotation.x = Math.PI / 2; head.add(horn); body.add(head);
    for (let i = 0; i < 5; i++) { const sp = mesh(G.cone6, m, [0.17, 0.6, 0.17], [0, 0.95, 0.7 - i * 0.45]); sp.rotation.x = -0.25; body.add(sp); }
    for (let i = 0; i < 4; i++) { const l = mesh(G.cone6, dark, [0.2, 0.7, 0.2], [(i % 2 ? 0.75 : -0.75), -0.6, i < 2 ? 0.7 : -0.7]); l.rotation.x = Math.PI; body.add(l); legs.push(l); }
    const orb = []; for (let i = 0; i < 3; i++) { const o = mesh(G.tet, hornM, [0.18, 0.18, 0.18]); o.visible = false; root.add(o); orb.push(o); }
    return { root, mats: [m, dark, hornM], tick(dt, st, t) {
      const w = st.s === 'wind', ch = st.s === 'charge', stun = st.s === 'stun';
      head.rotation.x = w ? 0.5 + Math.sin(t * 30) * 0.06 : ch ? 0.25 : 0; hornM.uniforms.uGlow.value = w ? 3 : ch ? 2 : 0.2; m.uniforms.uGlow.value = w ? 1.2 : 0;
      legs.forEach((l, i) => { l.rotation.x = Math.PI + Math.sin(t * (ch ? 30 : 9) + i * 1.6) * (stun ? 0.05 : 0.5); });
      body.scale.set(ch ? 0.85 : 1, ch ? 0.85 : 1, ch ? 1.3 : 1); body.rotation.z = stun ? Math.sin(t * 6) * 0.25 : 0; body.position.y = stun ? -0.3 : 0;
      orb.forEach((o, i) => { o.visible = stun; const a = t * 5 + i * 2.09; o.position.set(Math.cos(a) * 1.0, 1.7, Math.sin(a) * 1.0); o.rotation.y = a; });
    } };
  },
  espiral(c) {
    const m = crystalMaterial(c, { glow: 0.3 }), core = crystalMaterial(0xffffff, { glow: 1.5 }), root = new THREE.Group();
    const knot = mesh(G.knot, m, [1, 1, 1]); root.add(knot); const heart = mesh(G.ico, core, [0.3, 0.3, 0.3]); root.add(heart);
    const rings = [0, 1, 2].map((i) => { const r = mesh(G.torus, core, [1.6 + i * 0.5, 1.6 + i * 0.5, 1.6 + i * 0.5]); r.visible = false; root.add(r); return r; });
    return { root, mats: [m, core], tick(dt, st, t) {
      const pull = st.s === 'pull', ch = st.s === 'charge';
      knot.rotation.set(t * 1.2, t * (pull ? 9 : 1.6), t * 0.7); heart.rotation.y = t * 3; core.uniforms.uGlow.value = pull ? 3.5 : ch ? 2.5 : 1.2; m.uniforms.uGlow.value = pull ? 1 : 0.3;
      rings.forEach((r, i) => { r.visible = pull; if (pull) { const k = 1 - (((t * 1.8) + i / 3) % 1); r.scale.setScalar((1.6 + k * 1.8)); r.rotation.x = Math.PI / 2; } });
      root.position.y = Math.sin(t * 1.3 + st.id) * 0.2;
    } };
  },
};

const edgeCache = new WeakMap();
const edgeMats = new Map();
let haloTex = null;
function halo() {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (haloTex = new THREE.CanvasTexture(c));
}
/** Pulido: aristas luminosas de cristal (Alta), halo de color (Media/Alta). */
function polish(root, color) {
  const q = cfg();
  if (q.edges) {
    let em = edgeMats.get(color); if (!em) { em = new THREE.LineBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }); edgeMats.set(color, em); }
    const meshes = []; root.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.type !== 'TorusGeometry' && o.geometry.type !== 'TorusKnotGeometry' && o.geometry.type !== 'SphereGeometry' && !(o.material.transparent)) meshes.push(o); });
    for (const mm of meshes) { let eg = edgeCache.get(mm.geometry); if (!eg) { eg = new THREE.EdgesGeometry(mm.geometry, 28); edgeCache.set(mm.geometry, eg); } mm.add(new THREE.LineSegments(eg, em)); }
  }
  if (q.halos) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 }));
    sp.scale.setScalar(4.2); root.add(sp); return sp;
  }
  return null;
}

export function buildMonster(kind) {
  const org = ORGANISMS[kind];
  const b = org ? org(kit, COLORS[kind]) : BUILD[kind](COLORS[kind]);
  const pivot = new THREE.Group(); pivot.add(b.root);
  const sp = org ? null : polish(b.root, COLORS[kind]);
  const mats = b.mats;
  return { object: pivot, mats, organism: !!org, halo: sp, tick(dt, st, t, ctx) { b.tick(dt, st, t, ctx); if (sp) sp.material.opacity = 0.25 + 0.12 * Math.sin(t * 3 + st.id); } };
}
export const MONSTER_KINDS = Object.keys(BUILD);
export { setHurt };
