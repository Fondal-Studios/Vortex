// Objetos del director en el mundo: ancla, placas, núcleo, altar, pilares del Coloso, válvulas de la Madre, huevos, cúpula, torreta.
// Todo se arma con geometría simple y materiales aditivos para que brille con el bloom, sin costo de draw calls importante.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { kit } from './organism.js';
import { buildOjo } from './creatures/ojo.js';
import { M4_BUILD, m4Animate, m4Event, m4Frame } from './env/map4-objs.js'; // mapa 4: capullos del Cultivo y puente vivo
import { NPC_INFO } from '../sim/npcs.js';
import { NPC_COLORS, hexCss } from './mundo-vivo.js';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const Y = new THREE.Vector3(0, 1, 0);
const add = (color, opacity = 0.5, extra = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, ...extra });

const GEO = {
  ring: new THREE.TorusGeometry(1, 0.05, 8, 48),
  disc: new THREE.CircleGeometry(1, 40),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true),
  ico: new THREE.IcosahedronGeometry(1, 1),
  sph: new THREE.SphereGeometry(1, 24, 16),
  box: new THREE.BoxGeometry(1, 1, 1),
};

/** Normal "hacia arriba" del lugar: en el mapa 2 es hacia el centro; en el 1 es +Y (o −Y bajo la isla-techo). */
function upAt(map, p) {
  if (map === 'm2') return new THREE.Vector3(-p[0], -p[1], -p[2]).normalize();
  return new THREE.Vector3(0, p[1] > 20 ? -1 : 1, 0);
}

const BUILD = {
  ancla(o) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(GEO.ring, add(0xffe27a, 0.9)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(o.r); g.add(ring);
    const inner = new THREE.Mesh(GEO.ring, add(0xffe27a, 0.5)); inner.rotation.x = Math.PI / 2; g.add(inner);
    const floor = new THREE.Mesh(GEO.disc, add(0xffe27a, 0.12)); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.05; floor.scale.setScalar(o.r); g.add(floor);
    const beam = new THREE.Mesh(GEO.cyl, add(0xffe27a, 0.28)); beam.position.y = 9; beam.scale.set(0.8, 18, 0.8); g.add(beam);
    const core = new THREE.Mesh(GEO.ico, add(0xfff3b0, 0.9)); core.position.y = 2.4; core.scale.setScalar(0.8); g.add(core);
    g.userData = { ring, inner, beam, core, floor };
    return g;
  },
  plate(o) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(GEO.disc, add(0x7a5cff, 0.55)); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.08; disc.scale.setScalar(o.r); g.add(disc);
    const ring = new THREE.Mesh(GEO.ring, add(0xb9a4ff, 0.9)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(o.r); g.add(ring);
    const beam = new THREE.Mesh(GEO.cyl, add(0x7a5cff, 0.22)); beam.position.y = 5; beam.scale.set(o.r * 0.55, 10, o.r * 0.55); g.add(beam);
    g.userData = { disc, ring, beam };
    return g;
  },
  core(o) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(GEO.ico, add(0x7dfcff, 0.95)); c.scale.setScalar(0.65); g.add(c);
    const w = new THREE.Mesh(GEO.ico, new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 })); w.scale.setScalar(0.95); g.add(w);
    const halo = new THREE.Mesh(GEO.sph, add(0x7dfcff, 0.14)); halo.scale.setScalar(1.8); g.add(halo);
    const light = new THREE.PointLight(0x7dfcff, 2.5, 14); g.add(light);
    g.userData = { c, w };
    return g;
  },
  altar(o) {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(GEO.ring, add(0x7dfcff, 0.85 - i * 0.2)); r.rotation.x = Math.PI / 2; r.position.y = 0.1 + i * 0.5; r.scale.setScalar(o.r * (1 - i * 0.22)); g.add(r); }
    const beam = new THREE.Mesh(GEO.cyl, add(0x7dfcff, 0.24)); beam.position.y = 8; beam.scale.set(1.2, 16, 1.2); g.add(beam);
    g.userData = { beam };
    return g;
  },
  resonator(o) {
    const g = new THREE.Group();
    const pillar = new THREE.Mesh(GEO.cyl, add(0x8a7fff, 0.4)); pillar.position.y = 4; pillar.scale.set(0.9, 8, 0.9); g.add(pillar);
    const ring = new THREE.Mesh(GEO.ring, add(0x8a7fff, 0.9)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(o.r); g.add(ring);
    const floor = new THREE.Mesh(GEO.disc, add(0x8a7fff, 0.15)); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.06; floor.scale.setScalar(o.r); g.add(floor);
    const top = new THREE.Mesh(GEO.ico, add(0xcfc6ff, 0.9)); top.position.y = 8.4; top.scale.setScalar(0.9); g.add(top);
    g.userData = { pillar, ring, floor, top };
    return g;
  },
  valve(o) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(GEO.ring, add(0xff9ae8, 0.9)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(o.r); g.add(ring);
    const floor = new THREE.Mesh(GEO.disc, add(0xff9ae8, 0.2)); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.06; floor.scale.setScalar(o.r); g.add(floor);
    const beam = new THREE.Mesh(GEO.cyl, add(0xff9ae8, 0.3)); beam.position.y = 7; beam.scale.set(1.1, 14, 1.1); g.add(beam);
    g.userData = { ring, floor, beam };
    return g;
  },
  sac(o) {
    const g = new THREE.Group();
    const egg = new THREE.Mesh(GEO.sph, new THREE.MeshStandardMaterial({ color: 0x8a2a5a, emissive: 0xff2a8a, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.92 }));
    egg.scale.set(1.1, 1.5, 1.1); egg.position.y = 1.3; g.add(egg);
    const halo = new THREE.Mesh(GEO.sph, add(0xff5aa8, 0.12)); halo.scale.setScalar(2.2); halo.position.y = 1.3; g.add(halo);
    g.userData = { egg, halo };
    return g;
  },
  well(o) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0x000000 })); core.scale.setScalar(1.1); g.add(core);
    const ring = new THREE.Mesh(GEO.ring, add(0xb98cff, 0.9)); ring.scale.setScalar(3); g.add(ring); const ring2 = new THREE.Mesh(GEO.ring, add(0x66ffee, 0.7)); ring2.scale.setScalar(5); ring2.rotation.x = 1.2; g.add(ring2);
    g.userData = { ring, ring2 }; return g;
  },
  ojo(o) {
    const g = new THREE.Group(), h = buildOjo(kit, { color: 0xff3a5a });
    g.add(h.root); g.scale.setScalar(o.r || 1.7); g.userData = { h };
    return g;
  },
  mine(o) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(GEO.ico, new THREE.MeshStandardMaterial({ color: 0x3a2a10, emissive: 0xffa010, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.6 })); body.scale.setScalar(0.5); body.position.y = 0.3; g.add(body);
    const ring = new THREE.Mesh(GEO.ring, add(0xffd23f, 0.6)); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(o.r || 5); g.add(ring);
    g.userData = { body, ring }; return g;
  },
  dome(o) {
    const g = new THREE.Group();
    const d = new THREE.Mesh(GEO.sph, add(0x66ffee, 0.12)); d.scale.setScalar(o.r); g.add(d);
    const w = new THREE.Mesh(GEO.sph, new THREE.MeshBasicMaterial({ color: 0x66ffee, wireframe: true, transparent: true, opacity: 0.25 })); w.scale.setScalar(o.r * 1.002); g.add(w);
    g.userData = { d, w };
    return g;
  },
  turret(o) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(GEO.box, new THREE.MeshStandardMaterial({ color: 0x263548, emissive: 0x2a7aff, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.7 }));
    base.scale.set(0.9, 0.5, 0.9); base.position.y = 0.25; g.add(base);
    const head = new THREE.Mesh(GEO.ico, add(0x66bbff, 0.95)); head.scale.setScalar(0.45); head.position.y = 0.95; g.add(head);
    const barrel = new THREE.Mesh(GEO.box, new THREE.MeshStandardMaterial({ color: 0x9fb8d8, roughness: 0.3, metalness: 0.8 })); barrel.scale.set(0.12, 0.12, 0.8); barrel.position.set(0, 0.95, 0.5); g.add(barrel);
    g.userData = { head, barrel };
    return g;
  },
};

/** Etiqueta flotante (sprite con texto) para NPC; la textura se comparte por texto+color. */
const LABELS = new Map();
export function labelSprite(text, color = '#ffffff') {
  const key = text + color; let mat = LABELS.get(key);
  if (!mat) {
    const c = document.createElement('canvas'); c.width = 384; c.height = 64; const x = c.getContext('2d'); x.font = '700 28px "Trebuchet MS", system-ui'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = '#000c'; x.strokeText(text, 192, 42); x.fillStyle = color; x.fillText(text, 192, 42);
    mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }); LABELS.set(key, mat);
  }
  const sp = new THREE.Sprite(mat); sp.scale.set(3.6, 0.6, 1); sp.renderOrder = 10; return sp;
}
/** NPC liviano (espectral): túnica, cabeza y un objeto propio de su oficio. Un solo material translúcido por parte. */
function npcSimple(o) {
  const kind = o.nk, col = NPC_COLORS[kind] || 0xffffff, g = new THREE.Group(), pivot = new THREE.Group(); g.add(pivot);
  const body = new THREE.MeshStandardMaterial({ color: 0x2a2440, emissive: col, emissiveIntensity: 0.35, roughness: 0.6, transparent: true, opacity: 0.78 });
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.7, 1.5, 10, 1, true), body); robe.position.y = 0.85; pivot.add(robe);
  const chest = new THREE.Mesh(GEO.sph, body); chest.scale.set(0.42, 0.34, 0.3); chest.position.y = 1.55; pivot.add(chest);
  const head = new THREE.Mesh(GEO.sph, add(col, 0.85)); head.scale.setScalar(0.24); head.position.y = 1.98; pivot.add(head);
  if (kind === 'cambista') { const coin = new THREE.Mesh(GEO.ring, add(col, 0.9)); coin.scale.setScalar(0.35); coin.position.set(0.6, 1.5, 0.2); pivot.add(coin); g.userData.prop = coin; }
  else if (kind === 'sanadora') { const a = new THREE.Mesh(GEO.box, add(col, 0.9)); a.scale.set(0.5, 0.12, 0.12); const b = a.clone(); b.rotation.z = Math.PI / 2; const c = new THREE.Group(); c.add(a, b); c.position.set(0, 2.6, 0); pivot.add(c); g.userData.prop = c; }
  else { const h = new THREE.Mesh(GEO.box, add(col, 0.9)); h.scale.set(0.4, 0.22, 0.22); h.position.set(0.65, 1.2, 0.2); pivot.add(h); g.userData.prop = h; }
  const aura = new THREE.Mesh(GEO.ring, add(col, 0.6)); aura.rotation.x = Math.PI / 2; aura.scale.setScalar(1.1); aura.position.y = 0.06; g.add(aura);
  const halo = new THREE.Mesh(GEO.sph, add(col, 0.1)); halo.scale.set(1.1, 1.8, 1.1); halo.position.y = 1.2; g.add(halo);
  g.userData.pivot = pivot; g.userData.aura = aura; g.userData.simple = true;
  return g;
}
/** Vuelve translúcido y teñido (espectral) a un humano de la fábrica, una vez armado. */
function spectral(root, col) {
  root.traverse((n) => { if (n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; const cl = ms.map((m) => { const c = m.clone(); c.transparent = true; c.opacity = 0.72; c.depthWrite = false; if (c.emissive) { c.emissive.setHex(col); c.emissiveIntensity = 0.3; } return c; }); n.material = Array.isArray(n.material) ? cl : cl[0]; n.userData.specMats = cl; } });
}
/* ───────── COLMENA (src/sim/enjambre.js): zánganos, nidos-torreta y la Reina. Geometría COMPARTIDA y fusionada (cuerpo = 1 llamada, alas = 1, nido = 2) ───────── */
let ENJ_G = null;
function enjG() {
  if (ENJ_G) return ENJ_G;
  const paint = (g, hex) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const at = (g, x, y, z, sx = 1, sy = 1, sz = 1) => { g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
  const sphere = (r, hex, x, y, z, sx, sy, sz) => paint(at(new THREE.SphereGeometry(r, 8, 6), x, y, z, sx, sy, sz), hex);
  const zang = [sphere(1, 0x8a1f34, 0, 0, -0.14, 0.2, 0.18, 0.34), sphere(1, 0x3a0e1a, 0, 0.01, 0.16, 0.15, 0.14, 0.17), sphere(1, 0xf2dfb4, 0, 0.02, 0.36, 0.11, 0.1, 0.11), sphere(1, 0xff3a55, -0.06, 0.05, 0.42, 0.04, 0.04, 0.04), sphere(1, 0xff3a55, 0.06, 0.05, 0.42, 0.04, 0.04, 0.04), paint(at(new THREE.ConeGeometry(0.05, 0.3, 5).rotateX(-Math.PI / 2), 0, 0, -0.62), 0x2a0911)];
  const wing = (sd) => paint(new THREE.PlaneGeometry(0.5, 0.24).rotateX(-Math.PI / 2).translate(sd * 0.3, 0.14, 0.08).rotateZ(sd * 0.35), 0xffb030);
  const crown = [0, 1, 2].map((i) => paint(at(new THREE.CylinderGeometry(0.05, 0.05, 0.16 + (i === 1 ? 0.08 : 0), 6), (i - 1) * 0.08, 0.2 + (i === 1 ? 0.04 : 0), 0.34), 0xf2dfb4));
  const nido = [paint(at(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, 0, 0.9, 0.55, 0.9), 0x5a1424), paint(at(new THREE.CylinderGeometry(0.55, 0.62, 0.14, 6), 0, 0.5, 0), 0xf2dfb4), paint(at(new THREE.CylinderGeometry(0.3, 0.42, 0.5, 8, 1, true), 0, 0.66, 0), 0x3a0e1a)];
  ENJ_G = { zang: mergeGeometries(zang), reina: mergeGeometries([...zang, ...crown]), wings: mergeGeometries([wing(1), wing(-1)]), nido: mergeGeometries(nido), core: new THREE.SphereGeometry(0.32, 10, 8), ring: new THREE.RingGeometry(0.96, 1, 6) };
  return ENJ_G;
}
const enjUnit = (reina) => (o) => {
  const G = enjG(), g = new THREE.Group(), pv = new THREE.Group(), s = reina ? 2.3 : 1;
  const body = new THREE.Mesh(reina ? G.reina : G.zang, new THREE.MeshBasicMaterial({ vertexColors: true })), wings = new THREE.Mesh(G.wings, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  pv.add(body, wings); pv.scale.setScalar(s); g.add(pv); g.userData = { pv, wings, body }; return g;
};
BUILD.zangano = enjUnit(false); BUILD.reina = enjUnit(true);
BUILD.nido = () => {
  const G = enjG(), g = new THREE.Group(), shell = new THREE.Mesh(G.nido, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })), core = new THREE.Mesh(G.core, add(0xff3a55, 0.9)), ring = new THREE.Mesh(G.ring, add(0xffb030, 0.5));
  core.position.y = 0.75; ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.scale.setScalar(1.6); g.add(shell, core, ring); g.userData = { core, ring }; return g;
};

Object.assign(BUILD, M4_BUILD);
const SIZE_HINT = { turret: 1 };

export class ObjectsView {
  constructor(scene, fx) {
    this.root = new THREE.Group(); scene.add(this.root); this.fx = fx;
    this.items = new Map(); this.beams = []; this.t = 0;
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(GEO.cyl, add(0xff6a6a, 0.55)); m.visible = false; this.root.add(m); this.beams.push(m); }
    this.tracers = [];
    this.humans = null; // { kit, hm }: lo pone render.js cuando el kit de personas está cargado (los NPC pasan de figura liviana a humano espectral)
  }
  /** NPC del respiro: humano espectral si el kit de personas ya cargó (calidad media/alta); si no, figura liviana. Siempre con etiqueta de nombre. */
  buildNpc(d) {
    const info = NPC_INFO[d.nk] || { name: 'Alma' }, col = NPC_COLORS[d.nk] || 0xffffff;
    let g = null;
    if (this.humans && this.humans.hm && this.humans.kit) {
      try {
        const h = this.humans.hm.createHuman(this.humans.kit, { seed: 'npc-' + d.nk, name: info.name, color: col, weapon: null, noWeapon: true, noGear: true });
        g = new THREE.Group(); const pivot = new THREE.Group(); pivot.add(h.object); g.add(pivot);
        const aura = new THREE.Mesh(GEO.ring, add(col, 0.6)); aura.rotation.x = Math.PI / 2; aura.scale.setScalar(1.1); aura.position.y = 0.06; g.add(aura);
        g.userData = { h, pivot, aura, human: true }; try { h.play('idle'); } catch { /* sin clip */ }
        if (h.ready && h.ready.then) h.ready.then(() => spectral(h.object, col)).catch(() => {}); else spectral(h.object, col);
      } catch (err) { console.warn('NPC humano no disponible:', err.message); g = null; }
    }
    if (!g) g = npcSimple(d);
    const lb = labelSprite(info.name, hexCss(col)); lb.position.y = 2.7; g.add(lb); g.userData.label = lb;
    return g;
  }
  /** Rayo entre dos puntos (cilindro fino) que se apaga solo. */
  beam(a, b, color, life = 0.35, width = 0.12) {
    const m = new THREE.Mesh(GEO.cyl, add(color, 0.9)); this.root.add(m);
    const A = V(a), B = V(b), d = B.clone().sub(A), l = d.length();
    m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y, d.normalize()); m.scale.set(width, l, width);
    this.tracers.push({ m, life, max: life });
  }
  /** Rayo eléctrico en zigzag entre dos puntos. */
  bolt(a, b, color) {
    const A = a.clone ? a : V(a), B = b.clone ? b : V(b), d = B.clone().sub(A), l = d.length(); if (l < 0.5) return;
    const n = Math.max(3, Math.min(9, Math.round(l / 6))), pts = [A.clone()];
    const side = new THREE.Vector3().crossVectors(d, Y).normalize();
    for (let i = 1; i < n; i++) pts.push(A.clone().addScaledVector(d, i / n).addScaledVector(side, (Math.random() - 0.5) * 1.6).addScaledVector(Y, (Math.random() - 0.5) * 1.6));
    pts.push(B.clone());
    for (let i = 0; i < pts.length - 1; i++) this.beam([pts[i].x, pts[i].y, pts[i].z], [pts[i + 1].x, pts[i + 1].y, pts[i + 1].z], color, 0.14, 0.07);
  }
  sync(state, dt, map, cam) {
    this.t += dt; this.dt = dt; this.cam = cam || null;
    const seen = new Set(), objs = state.objs || [];
    for (const o of objs) {
      seen.add(o.id);
      let it = this.items.get(o.id);
      if (!it) {
        const mk = o.t === 'npc' ? (d) => this.buildNpc(d) : BUILD[o.t]; if (!mk) continue;
        it = { g: mk({ r: o.r || 2, nk: o.nk }), t: o.t, c0: 0 }; this.root.add(it.g); this.items.set(o.id, it);
      }
      const g = it.g, u = g.userData, pos = V(o.p);
      g.position.copy(pos);
      const up = o.t === 'dome' || o.t === 'core' || o.t === 'well' || o.t === 'ojo' ? Y : upAt(map, o.p); g.quaternion.setFromUnitVectors(Y, up);
      this.animate(it, o, u, up);
      this.fadeNear(it, o, u);
    }
    m4Frame(state);
    for (const [id, it] of this.items) if (!seen.has(id)) { this.root.remove(it.g); if (it.g.userData.h) it.g.userData.h.dispose(); else it.g.traverse((x) => { if (x.material) x.material.dispose && x.material.dispose(); }); this.items.delete(id); }
    // rayo del jefe hacia cada pilar marcado
    const boss = state.monsters && state.monsters.find((m) => m.k === 'coloso');
    let bi = 0;
    if (boss && state.boss && state.boss.ray > 0) {
      for (const o of objs) if (o.t === 'resonator' && o.s === 'targeted' && bi < this.beams.length) {
        const m = this.beams[bi++], A = V(boss.p), B = V(o.p).add(new THREE.Vector3(0, 1, 0)), d = B.clone().sub(A), l = d.length();
        m.visible = true; m.position.copy(A).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(Y, d.normalize());
        const w = 0.15 + (1 - state.boss.ray / 4) * 0.9 + Math.sin(this.t * 40) * 0.05; m.scale.set(w, l, w); m.material.opacity = 0.35 + (1 - state.boss.ray / 4) * 0.5;
      }
    }
    for (; bi < this.beams.length; bi++) this.beams[bi].visible = false;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i]; tr.life -= dt; tr.m.material.opacity = Math.max(0, tr.life / tr.max) * 0.9;
      if (tr.life <= 0) { this.root.remove(tr.m); tr.m.material.dispose(); this.tracers.splice(i, 1); }
    }
  }
  /** Arte (legibilidad): los haces/anillos aditivos se apagan cuando la cámara está dentro o pegada a ellos
   *  (antes tapaban un cuarto de la pantalla con un bloque blanco "quemado"). */
  fadeNear(it, o, u) {
    if (!this.cam || !u || !(u.beam || u.ring)) return;
    const r = o.r || 2, c = this.cam, p = it.g.position, hd = Math.hypot(c.x - p.x, c.z - p.z) + Math.abs(c.y - p.y) * 0.15;
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    if (u.beam) { // el haz: sólo se ve desde fuera (si animate() no lo reescribió este cuadro, reusamos la base guardada)
      const m = u.beam.material, ud = m.userData; if (ud.last === undefined || m.opacity !== ud.last) ud.base = m.opacity;
      m.opacity = ud.last = ud.base * 0.7 * sm(r * 0.6, r * 1.8, hd);
    }
    if (u.ring) { const m = u.ring.material; if (m.userData.o0 === undefined) m.userData.o0 = m.opacity; m.opacity = Math.min(0.55, m.userData.o0) * sm(0.6, 4, Math.abs(hd - r)); }
  }
  animate(it, o, u, up) {
    const t = this.t, pulse = 0.5 + 0.5 * Math.sin(t * 4 + o.id);
    switch (o.t) {
      case 'ancla': {
        const prog = o.v || 0, on = o.s === 'on', hpk = o.mx ? o.hp / o.mx : 1;
        u.ring.rotation.z = t * 0.5; u.inner.scale.setScalar(Math.max(0.1, o.r * prog)); u.inner.rotation.z = -t;
        u.core.position.y = 2.4 + Math.sin(t * 2) * 0.3; u.core.rotation.y = t; u.core.scale.setScalar(0.6 + prog * 0.9);
        u.beam.material.opacity = 0.12 + prog * 0.4; u.floor.material.opacity = on ? 0.28 : 0.1;
        u.ring.material.color.setHex(hpk < 0.35 ? 0xff5a5a : on ? 0xffe27a : 0xb8a860);
        break;
      }
      case 'plate': {
        const on = o.s === 'on'; const col = on ? 0x7dff9a : 0x7a5cff;
        u.disc.material.color.setHex(col); u.ring.material.color.setHex(on ? 0xc8ffd2 : 0xb9a4ff); u.beam.material.color.setHex(col);
        u.disc.material.opacity = on ? 0.3 + pulse * 0.1 : 0.2; u.beam.material.opacity = on ? 0.35 : 0.12 + (o.v || 0) * 0.2; u.ring.rotation.z = t;
        break;
      }
      case 'core': {
        const k = o.c ? 0.5 : 1; u.c.rotation.y = t * 1.5; u.c.rotation.x = t * 0.9; u.w.rotation.y = -t; u.w.rotation.z = t * 0.6;
        it.g.scale.setScalar(k * (0.9 + pulse * 0.2));
        break;
      }
      case 'altar': { it.g.children.forEach((c, i) => { if (i < 3) c.rotation.z = t * (0.6 + i * 0.3); }); u.beam.material.opacity = 0.14 + pulse * 0.14; break; }
      case 'resonator': {
        const st = o.s; const col = st === 'targeted' ? 0xff5a5a : st === 'down' ? 0x444455 : 0x8a7fff;
        for (const k of ['pillar', 'ring', 'floor', 'top']) u[k].material.color.setHex(col);
        const warn = st === 'targeted' ? 0.55 + 0.45 * Math.sin(t * 14) : 0;
        u.pillar.material.opacity = st === 'down' ? 0.08 : 0.35 + warn * 0.3; u.floor.material.opacity = st === 'targeted' ? 0.25 + warn * 0.2 : 0.12;
        u.top.rotation.y = t * 2; u.ring.rotation.z = t * (st === 'targeted' ? 3 : 0.6); u.top.visible = st !== 'down';
        break;
      }
      case 'valve': {
        const on = o.s === 'on' || (o.v || 0) > 0.05;
        const col = on ? 0x7dff9a : 0xff9ae8;
        u.ring.material.color.setHex(col); u.floor.material.color.setHex(col); u.beam.material.color.setHex(col);
        u.beam.material.opacity = on ? 0.5 : 0.15; u.floor.material.opacity = on ? 0.3 : 0.14; u.ring.rotation.z = t * (on ? 3 : 0.8);
        break;
      }
      case 'sac': {
        const hpk = o.mx ? o.hp / o.mx : 1, hatch = 1 - Math.min(1, (o.l || 0) / 12);
        u.egg.scale.set(1.1 + Math.sin(t * (6 + hatch * 14)) * 0.08 * (0.5 + hatch), 1.5, 1.1);
        u.egg.material.emissiveIntensity = 0.5 + hatch * 1.4 + (1 - hpk) * 0.3; u.halo.material.opacity = 0.1 + hatch * 0.2;
        break;
      }
      case 'dome': {
        const life = Math.min(1, (o.l || 6) / 6); u.d.material.opacity = 0.06 + 0.1 * life; u.w.rotation.y = t * 0.3; u.w.material.opacity = 0.15 + 0.15 * life;
        break;
      }
      case 'well': { u.ring.rotation.z = t * 5; u.ring2.rotation.z = -t * 4; u.ring.scale.setScalar(3 + Math.sin(t * 6) * 0.4); break; }
      case 'ojo': { u.h.tick(this.dt, { hp: o.hp, maxhp: o.mx || 1, t }); if (this.cam) it.g.lookAt(this.cam); break; }
      case 'mine': { const pu = 0.5 + 0.5 * Math.sin(t * 8); u.body.material.emissiveIntensity = 0.4 + pu; u.ring.material.opacity = 0.15 + 0.2 * pu; break; }
      case 'zangano': case 'reina': {   // Colmena: zumban (las alas se aplastan rápido), se orientan hacia donde vuelan y flotan
        const p = it.g.position; if (it.px !== undefined) { const dx = p.x - it.px, dz = p.z - it.pz; if (dx * dx + dz * dz > 1e-5) it.yaw = Math.atan2(dx, dz); } it.px = p.x; it.pz = p.z;
        const d = ((it.yaw || 0) - u.pv.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI; u.pv.rotation.y += d * Math.min(1, 8 * this.dt); u.pv.position.y = 0.07 * Math.sin(t * 5 + o.id);
        u.wings.scale.set(0.45 + 0.55 * Math.abs(Math.sin(t * 46 + o.id)), 1, 1); break;
      }
      case 'nido': { u.core.scale.setScalar(0.8 + 0.25 * pulse); u.core.material.opacity = 0.6 + 0.35 * pulse; u.ring.rotation.z = t * 0.6; break; }
      case 'turret': { u.head.rotation.y = t * 2; u.head.material.opacity = 0.7 + pulse * 0.3; break; }
      case 'npc': {
        if (u.h) u.h.update(this.dt, { speed: 0, moveDir: { x: 0, z: 0 }, pitch: 0, camera: null });
        if (this.cam && u.pivot) { const p = it.g.position; u.pivot.rotation.y = Math.atan2(this.cam.x - p.x, this.cam.z - p.z); }
        if (u.aura) { u.aura.rotation.z = t * 0.8; u.aura.material.opacity = 0.35 + 0.25 * pulse; }
        if (u.prop) { u.prop.rotation.y = t * 2; }
        break;
      }
      case 'capullo': case 'puente': m4Animate(it, o, u, t, this.dt); break;
      default: break;
    }
  }
  /** Eventos puntuales del director. */
  onEvent(e, fx, pos) {
    if (m4Event(e, fx, this)) return;
    if (e.t === 'tshot') this.beam(e.o, e.to, 0x66bbff, 0.12, 0.05);
    else if (e.t === 'reflect') this.beam(e.from, e.to, 0xffffff, 0.6, 0.5);
    else if (e.t === 'pulse') fx.blast(V(e.p), 0x7dff9a, 12, 0.8);
    else if (e.t === 'mark') fx.blast(V(e.p), 0xffe27a, 32, 0.9);
    else if (e.t === 'ability') {/* cada rol lo resuelve su objeto */}
    else if (e.t === 'purge') fx.blast(V(pos || [0, 0, 0]), 0xff9ae8, 60, 1.2);
    else if (e.t === 'sacbreak' || e.t === 'hatch') { fx.burst(V(e.p), 0xff5aa8, 22, 8, 0.7, 0.8); fx.blast(V(e.p), 0xff5aa8, 5, 0.5); }
    else if (e.t === 'pulsar') { fx.blast(V(e.p), 0xb98cff, e.r || 10, 0.45); fx.burst(V(e.p), 0xe8d8ff, 24, 14, 0.4, 0.5); }
    else if (e.t === 'minePlace') { fx.blast(V(e.p), 0xffd23f, 2, 0.3); }
    else if (e.t === 'ping') fx.blast(V(e.p), 0xffe27a, 3, 0.6);
    else if (e.t === 'beam') this.beam(e.o, e.to, e.c === 'heal' ? 0x7dff9a : 0xffffff, 0.35, e.c === 'rail' ? 0.18 : 0.3);
    else if (e.t === 'arc') this.beam(e.o, e.to, 0xb8e6ff, 0.18, 0.07);
    else if (e.t === 'gazefire') this.beam(e.from, e.to, 0xff3a5a, 0.5, 0.9);
    else if (e.t === 'ojobreak') { fx.burst(V(e.p), 0xff3a5a, 30, 10, 0.8, 0.9); fx.blast(V(e.p), 0xff3a5a, 6, 0.6); }
    else if (e.t === 'skill') { fx.blast(V(e.p), 0x66ffee, 5, 0.4); }
    else if (e.t === 'well') { fx.blast(V(e.p), 0xb98cff, 8, 0.5); }
    else if (e.t === 'stagger') { fx.blast(V(pos || [0, 0, 0]), 0xffffff, 40, 1.0); }
  }
}
void SIZE_HINT;
