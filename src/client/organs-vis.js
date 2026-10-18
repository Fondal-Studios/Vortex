// ÓRGANOS que crecen (docs/EVOLUCION.md): cada órgano de WEAPON_ORGANS / CHAMP_ORGANS trae una etiqueta `vis`; acá se dibuja de forma procedural,
// con un estilo biomecánico (hueso, tejido, vasos luminosos). Todo se une en 3 mallas (cuerpo, brillo, membrana) por conjunto de órganos:
//   · armas:    buildWeaponOrgans(THREE, ids[], {quality}) → {group, update(dt,t), dispose(), info}   (≤ 3 llamadas de dibujo extra por arma; unidades ≈ metros de un arma de 0.5 m)
//   · campeón:  attachChampOrgans(THREE, hostId, joints, ids[], {color, quality}) → {update, dispose, info}   (cuelga de torso y cabeza: ≤ 6 llamadas extra)
// Latido: el brillo pulsa con un doble latido si hay un órgano 'corazon' (o 'vital', 'cristal' del campeón); crecen con una animación corta (grow) al aparecer.
import { makeBuilder } from './melee-models.js';
import { WEAPON_ORGANS, CHAMP_ORGANS } from '../sim/data.js';

const ZERO = [0, 0, 0];
const A = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
/** Proxy del constructor que traslada y escala cada pieza: así cada órgano se dibuja en su propio espacio (at = posición, s = escala). */
function proxy(B, at, s) {
  const sc = (v) => (v ? v.map((x) => x * s) : v), P = (p) => A(at, p || ZERO, s);
  return {
    box: (k, c, d, p, r, z) => B.box(k, c, sc(d), P(p), r, z), cyl: (k, c, rt, rb, h, p, r, n, z) => B.cyl(k, c, rt * s, rb * s, h * s, P(p), r, n, z), cone: (k, c, rad, h, p, r, n, z) => B.cone(k, c, rad * s, h * s, P(p), r, n, z),
    sph: (k, c, rad, p, z, n) => B.sph(k, c, rad * s, P(p), z, n), oct: (k, c, rad, p, z, r) => B.oct(k, c, rad * s, P(p), z, r), ico: (k, c, rad, p, z, r) => B.ico(k, c, rad * s, P(p), z, r),
    tor: (k, c, R, rad, p, r, n, z) => B.tor(k, c, R * s, rad * s, P(p), r, n, z), limb: (k, c, a, b, r1, r2, n) => B.limb(k, c, P(a), P(b), r1 * s, r2 * s, n), spike: (k, c, a, b, w, th) => B.spike(k, c, P(a), P(b), w * s, th * s),
    arc: (k, c, fn, n, r0, r1, seg) => B.arc(k, c, (u) => P(fn(u)), n, r0 * s, r1 * s, seg),
  };
}
const BONE = 0xece1c6, BONE2 = 0xb7a883, FLESH = 0x8a3a4a, FLESH2 = 0xc8606e;
/** Formas (unidad ≈ 0.1 m). X = proxy; c = color de acento del Huésped / del arma. Dibujan alrededor del origen, apuntando a +Y. */
const SHAPE = {
  hueso(X) { X.box('body', BONE2, [0.1, 0.012, 0.02], [0, 0, 0]); for (let i = 0; i < 4; i++) X.spike('body', BONE, [-0.045 + i * 0.03, 0.004, 0], [-0.04 + i * 0.03, 0.05 + (i % 2) * 0.02, 0.0], 0.026, 0.016); X.sph('glow', 0xff7a5a, 0.008, [0.05, 0.004, 0], [1, 1, 1], 3); },
  corazon(X) { X.sph('body', FLESH, 0.032, [0, 0.03, 0], [1, 1.1, 1], 6); X.sph('glow', 0xff3a4a, 0.022, [0, 0.032, 0.012], [1, 1.05, 0.9], 5); X.limb('body', FLESH2, [-0.01, 0.055, 0], [-0.03, 0.09, 0.01], 0.011, 0.008, 4); X.limb('body', FLESH2, [0.012, 0.055, 0], [0.03, 0.085, -0.01], 0.01, 0.007, 4); X.sph('mem', 0xff3a4a, 0.044, [0, 0.03, 0], [1, 1.1, 1], 5); },
  ojo(X) { X.sph('body', 0xf2f0e6, 0.03, [0, 0.03, 0], [1, 1, 1], 6); X.sph('glow', 0xffd45a, 0.017, [0, 0.03, 0.017], [1, 1, 0.6], 5); X.sph('body', 0x1a0a10, 0.008, [0, 0.03, 0.03], [1, 1, 0.6], 3); X.tor('body', FLESH, 0.032, 0.007, [0, 0.03, 0], [0, 0, 0], 6); },
  cristal(X) { for (let i = 0; i < 4; i++) { const a = i * 1.6, h = 0.07 + (i % 2) * 0.04; X.cone('body', 0x9adff0, 0.016, h, [Math.cos(a) * 0.022, h / 2, Math.sin(a) * 0.022], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], 5); X.cone('mem', 0x66f0ff, 0.022, h * 1.05, [Math.cos(a) * 0.022, h / 2, Math.sin(a) * 0.022], [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], 5); } X.sph('glow', 0xcffaff, 0.01, [0, 0.03, 0], [1, 1, 1], 3); },
  nervio(X) { for (let i = 0; i < 3; i++) { const a = -0.8 + i * 0.8, e = [Math.sin(a) * 0.08, 0.07 + (i % 2) * 0.03, 0]; X.limb('glow', 0xbff6ff, ZERO, e, 0.006, 0.003, 3); X.limb('glow', 0xbff6ff, e, A(e, [Math.sin(a) * 0.03, 0.04, 0.02]), 0.003, 0.002, 3); X.sph('glow', 0xffffff, 0.01, A(e, [Math.sin(a) * 0.03, 0.04, 0.02]), [1, 1, 1], 3); } X.sph('body', FLESH2, 0.014, ZERO, [1, 1, 1], 4); },
  vacio(X) { X.sph('body', 0x140a24, 0.018, [0, 0.035, 0], [1, 1, 1], 5); X.sph('mem', 0xb07bff, 0.045, [0, 0.035, 0], [1, 1, 1], 6); X.tor('glow', 0xb07bff, 0.04, 0.003, [0, 0.035, 0], [Math.PI / 2 - 0.4, 0, 0.3], 8); for (let i = 0; i < 3; i++) { const a = i * 2.1; X.limb('glow', 0xd8b8ff, [0, 0.035, 0], [Math.cos(a) * 0.06, 0.035 + Math.sin(a) * 0.04, Math.sin(a) * 0.05], 0.004, 0.002, 3); } },
  acido(X) { X.sph('body', 0x3a6a2a, 0.02, [0, 0.03, 0], [1, 1.1, 1], 5); X.sph('mem', 0x8cff4a, 0.04, [0, 0.03, 0], [1, 1.15, 1], 6); for (let i = 0; i < 3; i++) X.sph('glow', 0xc8ff7a, 0.007 + i * 0.002, [0.02 * (i - 1), 0.03 + i * 0.012, 0.012], [1, 1, 1], 3); X.cone('glow', 0x8cff4a, 0.008, 0.035, [0, -0.01, 0], [Math.PI, 0, 0], 4); },
  espora(X) { for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.03, h = 0.04 + (i % 2) * 0.02; X.cyl('body', 0xd8cdb0, 0.005, 0.007, h, [x, h / 2, 0], [0.1 * (i - 1), 0, 0], 4); X.sph('body', [0xc9732a, 0x7be03a, 0xe8c25a][i], 0.017, [x, h, 0], [1, 0.55, 1], 5); X.sph('glow', 0xc6ff7a, 0.005, [x + 0.01, h + 0.01, 0.01], [1, 1, 1], 3); } },
  vital(X) { X.sph('body', 0xd8a0a8, 0.03, [0, 0.03, 0], [1, 1.15, 1], 6); X.tor('body', 0xffd45a, 0.03, 0.005, [0, 0.03, 0], [Math.PI / 2, 0, 0], 6); X.sph('glow', 0xffe27a, 0.014, [0, 0.032, 0.015], [1, 1.1, 0.8], 5); X.sph('mem', 0xffd45a, 0.042, [0, 0.03, 0], [1, 1.15, 1], 5); },
  musculo(X) { for (let i = 0; i < 3; i++) X.tor('body', i % 2 ? 0x7a3a3a : 0xa04a4a, 0.026, 0.01, [0, 0.006 + i * 0.026, 0], [Math.PI / 2, 0, 0], 6); X.limb('glow', 0xff7a6a, [0.026, 0, 0], [0.026, 0.07, 0], 0.003, 0.003, 3); },
  /* sólo del campeón */
  placas(X, c) { for (let i = 0; i < 4; i++) X.box('body', i % 2 ? BONE2 : BONE, [0.14 - i * 0.015, 0.016, 0.1], [0, 0.03 + i * 0.045, -i * 0.012], [-0.5 + i * 0.05, 0, 0]); X.box('glow', c, [0.12, 0.004, 0.004], [0, 0.17, -0.03], [-0.3, 0, 0]); },
  adrenal(X) { for (const s of [-1, 1]) { X.sph('body', 0xc84a2a, 0.03, [0.045 * s, 0.03, 0], [1, 1.2, 1], 5); X.sph('glow', 0xffa24a, 0.015, [0.045 * s, 0.03, 0.02], [1, 1.2, 0.7], 4); X.limb('glow', 0xff7a3a, [0.045 * s, 0.05, 0], [0.01 * s, 0.1, 0.0], 0.004, 0.003, 3); } },
  medula(X, c) { for (let i = 0; i < 6; i++) { X.sph('body', BONE2, 0.019 - i * 0.001, [0, i * 0.04, 0], [1.3, 0.8, 1], 5); X.sph('glow', c, 0.008, [0, i * 0.04, 0.012], [1, 1, 1], 3); } X.limb('glow', c, [0, -0.01, 0.012], [0, 0.22, 0.012], 0.003, 0.003, 3); },
  tentaculo(X, c) { X.arc('body', FLESH2, (u) => [Math.sin(u * 3.2) * 0.05 + u * 0.08, u * 0.16, Math.cos(u * 3.2) * 0.03], 7, 0.016, 0.004, 4); for (let i = 0; i < 4; i++) X.sph('glow', c, 0.006, [0.02 + i * 0.02, 0.03 + i * 0.035, 0.02], [1, 1, 1], 3); },
  espiraculo(X, c) { for (let i = 0; i < 3; i++) { X.tor('body', BONE, 0.03, 0.009, [(i - 1) * 0.07, 0.01 + (i % 2) * 0.03, 0], [Math.PI / 2 + 0.3, 0, 0], 6); X.sph('glow', c, 0.016, [(i - 1) * 0.07, 0.016 + (i % 2) * 0.03, 0.006], [1, 0.6, 1], 4); X.sph('mem', c, 0.03, [(i - 1) * 0.07, 0.05 + (i % 2) * 0.03, 0], [1, 1.4, 1], 4); } },
};
const WEAPON_SPOTS = [[0, 0.055, -0.05], [0.05, 0.01, 0.02], [0, -0.06, -0.1]]; // arriba, lado, abajo (en el marco del arma)
const WEAPON_ROT = [[0, 0, 0], [0, 0, -Math.PI / 2], [0, 0, Math.PI]];

function materials(T) {
  return {
    body: new T.MeshStandardMaterial({ vertexColors: true, metalness: 0.15, roughness: 0.55, flatShading: true }),
    glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    mem: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }),
    aura: new T.MeshBasicMaterial({ vertexColors: true }), cage: new T.MeshBasicMaterial({ vertexColors: true }),
  };
}
const heart = (t) => { const u = (t % 1.1) / 1.1; return Math.max(0, Math.sin(Math.min(1, u * 5) * Math.PI)) * 0.8 + Math.max(0, Math.sin(Math.min(1, Math.max(0, u - 0.28) * 5) * Math.PI)) * 0.5; };

function pulser(mats, vis, T0 = 0) {
  const born = { t: T0 }; return (dt, t) => { const g = vis.includes('corazon') || vis.includes('vital') ? 0.85 + heart(t) * 0.5 : 0.9 + Math.sin(t * 2.2) * 0.1; mats.glow.color.setScalar(g); mats.mem.opacity = 0.28 + Math.sin(t * 1.7) * 0.07 + (vis.includes('corazon') ? heart(t) * 0.12 : 0); void born; void dt; };
}

/** Órganos de un arma a distancia. ids = ids de WEAPON_ORGANS (hasta 3). Se cuelga del grupo del arma. */
export function buildWeaponOrgans(THREE, ids, opts = {}) {
  const T = THREE, S = opts.quality === 'low' ? 5 : 6, B = makeBuilder(T, S), mats = materials(T), group = new T.Group(); group.name = 'organos-arma';
  const vis = [];
  ids.slice(0, 3).forEach((id, i) => { const O = WEAPON_ORGANS[id]; if (!O || !SHAPE[O.vis]) return; vis.push(O.vis); const sp = WEAPON_SPOTS[i], X = proxy(B, ZERO, 1);
    // cada órgano se dibuja en su sitio rotado: primero se arma en el origen y se orienta con la rotación del puesto (se aplica al grupo contenedor en la unión)
    const R = WEAPON_ROT[i]; const rot = new T.Euler(R[0], R[1], R[2]), q = new T.Quaternion().setFromEuler(rot), v = new T.Vector3();
    const base = B; const Y = proxy({ ...base, box: (k, c, d, p, r, z) => base.box(k, c, d, tr(p), r, z), cyl: (k, c, a, b, h, p, r, n, z) => base.cyl(k, c, a, b, h, tr(p), r, n, z), cone: (k, c, rad, h, p, r, n, z) => base.cone(k, c, rad, h, tr(p), r, n, z), sph: (k, c, rad, p, z, n) => base.sph(k, c, rad, tr(p), z, n), oct: (k, c, rad, p, z, r) => base.oct(k, c, rad, tr(p), z, r), ico: (k, c, rad, p, z, r) => base.ico(k, c, rad, tr(p), z, r), tor: (k, c, R2, rad, p, r, n, z) => base.tor(k, c, R2, rad, tr(p), r, n, z), limb: (k, c, a, b, r1, r2, n) => base.limb(k, c, tr(a), tr(b), r1, r2, n), spike: (k, c, a, b, w, th) => base.spike(k, c, tr(a), tr(b), w, th), arc: (k, c, fn, n, r0, r1, seg) => base.arc(k, c, (u) => tr(fn(u)), n, r0, r1, seg) }, ZERO, 1);
    function tr(p) { v.set(p[0], p[1], p[2]).applyQuaternion(q); return [v.x + sp[0], v.y + sp[1], v.z + sp[2]]; }
    void X; SHAPE[O.vis](Y, 0xffffff); });
  const counts = B.finish(mats, group, group); const upd = pulser(mats, vis); let age = 0;
  group.scale.setScalar(0.01);
  return { group, info: counts, vis, update(dt, t) { age += dt; const g = Math.min(1, age / 1.2), e = 1 - Math.pow(1 - g, 3); group.scale.setScalar(Math.max(0.01, e * (1 + 0.15 * Math.sin(g * Math.PI)))); upd(dt, t); },
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of Object.values(mats)) m.dispose(); } };
}

/** Puntos de anclaje en el torso / cabeza de cada Huésped: [posición, escala]. */
const MOUNT = {
  axioma: { s: 4.2, back: [0, 0.2, -0.22], front: [0, 0.3, 0.26], side: [0.42, 0.4, 0], low: [0, 0.05, -0.2], head: [0, 0.2, 0.2], hs: 1.2 },
  vesper: { s: 3.2, back: [0, 0.18, -0.17], front: [0, 0.3, 0.16], side: [0.2, 0.35, 0], low: [0, 0.04, -0.15], head: [0, 0.06, 0.3], hs: 1 },
  micelio: { s: 6, back: [0, 0.3, -0.6], front: [0, 0.4, 0.55], side: [0.7, 0.55, 0], low: [0, 0.1, -0.5], head: [0, 0.09, 0.24], hs: 1.6 },
  umbra: { s: 3.4, back: [0, 0.15, -0.2], front: [0, 0.22, 0.2], side: [0.28, 0.3, 0], low: [0, 0.02, -0.18], head: [0, 0.02, 0.17], hs: 1 },
  seraf: { s: 3, back: [0, 0.2, -0.19], front: [0, 0.3, 0.17], side: [0.17, 0.35, 0], low: [0, 0.05, -0.17], head: [0, 0.16, 0.15], hs: 0.9 },
};
MOUNT.singular = { s: 3.4, back: [0, 0.2, -0.22], front: [0, 0.3, 0.2], side: [0.22, 0.38, 0], low: [0, 0.05, -0.2], head: [0, 0.14, 0.17], hs: 1 };   // Singular
MOUNT.danzante = { s: 3.2, back: [0, 0.2, -0.2], front: [0, 0.3, 0.2], side: [0.2, 0.38, 0], low: [0, 0.05, -0.18], head: [0, 0.14, 0.17], hs: 1 };   // Danzante
const CHAMP_SPOT = { placas: ['back', 0], adrenal: ['low', 0], medula: ['back', 1], tentaculo: ['side', -1], espiraculo: ['back', 2], saco_g: ['side', 1], corazon_cristal: ['front', 0], ojo_extra: ['head', 0] };
/** Órganos del campeón (ids de CHAMP_ORGANS) colgados del torso y de la cabeza de su modelo. joints = host.joints. */
export function attachChampOrgans(THREE, hostId, joints, ids, opts = {}) {
  const T = THREE, S = opts.quality === 'low' ? 5 : 6, M = MOUNT[hostId] || MOUNT.axioma, color = opts.color || 0xffffff;
  const sets = { torso: makeBuilder(T, S), head: makeBuilder(T, S) }, vis = [], used = { torso: false, head: false };
  for (const id of ids) {
    const O = CHAMP_ORGANS[id]; if (!O || !SHAPE[O.vis]) continue; const [spot, k] = CHAMP_SPOT[id] || ['back', 0], head = spot === 'head', B = sets[head ? 'head' : 'torso'], at = A(M[spot], [k * 0.12 * (head ? 0 : 1) * M.s / 4, k === 2 ? 0.09 : 0, 0]);
    const sc = head ? M.hs * 1.6 : M.s * (id === 'placas' ? 1 : 0.8); vis.push(O.vis); used[head ? 'head' : 'torso'] = true;
    const R = spot === 'back' || spot === 'low' ? [0, Math.PI, 0] : spot === 'side' ? [0, k < 0 ? -Math.PI / 2 : Math.PI / 2, 0] : ZERO, q = new T.Quaternion().setFromEuler(new T.Euler(R[0], R[1], R[2])), v = new T.Vector3();
    const tr = (p) => { v.set(p[0], p[1], p[2]).applyQuaternion(q); return [v.x, v.y, v.z]; };
    const base = proxy(B, at, sc), Y = { box: (kk, c, d, p, r, z) => base.box(kk, c, d, tr(p), r, z), cyl: (kk, c, a, b, h, p, r, n, z) => base.cyl(kk, c, a, b, h, tr(p), r, n, z), cone: (kk, c, rad, h, p, r, n, z) => base.cone(kk, c, rad, h, tr(p), r, n, z), sph: (kk, c, rad, p, z, n) => base.sph(kk, c, rad, tr(p), z, n), oct: (kk, c, rad, p, z, r) => base.oct(kk, c, rad, tr(p), z, r), ico: (kk, c, rad, p, z, r) => base.ico(kk, c, rad, tr(p), z, r), tor: (kk, c, R2, rad, p, r, n, z) => base.tor(kk, c, R2, rad, tr(p), r, n, z), limb: (kk, c, a, b, r1, r2, n) => base.limb(kk, c, tr(a), tr(b), r1, r2, n), spike: (kk, c, a, b, w, th) => base.spike(kk, c, tr(a), tr(b), w, th), arc: (kk, c, fn, n, r0, r1, seg) => base.arc(kk, c, (u) => tr(fn(u)), n, r0, r1, seg) };
    SHAPE[O.vis](Y, color);
  }
  const mats = materials(T), groups = [], counts = { draws: 0, tris: 0 };
  for (const [jn, B] of Object.entries(sets)) { if (!used[jn] || !joints[jn]) continue; const g = new T.Group(); g.name = 'organos-' + jn; const c = B.finish(mats, g, g); counts.draws += c.draws; counts.tris += c.tris; joints[jn].g.add(g); groups.push(g); g.scale.setScalar(0.01); }
  const upd = pulser(mats, vis); let age = 0;
  return { info: counts, vis, update(dt, t) { age += dt; const g = Math.min(1, age / 1.4), e = 1 - Math.pow(1 - g, 3), s = Math.max(0.01, e * (1 + 0.12 * Math.sin(g * Math.PI))); for (const gr of groups) gr.scale.setScalar(s); upd(dt, t); },
    dispose() { for (const g of groups) { g.parent && g.parent.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } for (const m of Object.values(mats)) m.dispose(); } };
}
export const ORGAN_VIS = Object.keys(SHAPE);
