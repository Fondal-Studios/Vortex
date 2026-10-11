// KIT ORGÁNICO · PIEZAS — primitivas baratas y bonitas: cuerpos blandos con LOD, cuernos suaves, cristales de UNA malla,
// tentáculos afinados (ventosas/cilios opcionales), patas con huesos «skinneados» (1 draw call por pata), mandíbulas con dientes
// fusionados, hileras de espinas/placas, costillas, dientes, sacos translúcidos, cicatrices y fusión de mallas estáticas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cfg } from './quality.js';
import { isLow, gooMaterial, membraneMaterial, fleshMaterial } from './organism-skin.js';

const V3 = THREE.Vector3, V2 = THREE.Vector2, M4 = THREE.Matrix4, TAU = Math.PI * 2;
const geoCache = new Map();
const cache = (k, f) => { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g; };
const SEG = () => (cfg().humans === 'low' ? [14, 10] : cfg().humans === 'medium' ? [20, 14] : [28, 20]);
const rnd = (i, s = 1) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
export const lodOf = (size) => (size < 0.12 ? 0.55 : size < 0.25 ? 0.75 : 1);

/** Normaliza una geometría para poder fusionarla: no indexada, sólo position/normal/uv. */
function prep(g) {
  let c = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') c.deleteAttribute(k);
  if (!c.attributes.normal) c.computeVertexNormals();
  if (!c.attributes.uv) c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
  return c;
}
const xf = (g, m) => { const c = prep(g); c.applyMatrix4(m); if (m.determinant() < 0) { const p = c.attributes.position, n = c.attributes.normal, u = c.attributes.uv; for (let i = 0; i < p.count; i += 3) for (const a of [p, n, u]) { const s = a.itemSize; for (let k = 0; k < s; k++) { const t = a.array[(i + 1) * s + k]; a.array[(i + 1) * s + k] = a.array[(i + 2) * s + k]; a.array[(i + 2) * s + k] = t; } } } return c; };
const merged = (list) => { const m = mergeGeometries(list, false); list.forEach((g) => g.dispose()); return m; };
const _q = new THREE.Quaternion(), _s = new V3(), _p = new V3(), _m = new M4(), _up = new V3(0, 1, 0);
const compose = (pos, quat, sc) => _m.compose(pos, quat, sc).clone();

/* ───────────── cuerpos ───────────── */
/** Cuerpo blando: esfera lisa estirable (sx,sy,sz). Los segmentos bajan solos en blobs pequeños (lod = 0.4..1 para forzar). */
export function blob(mat, r = 1, sx = 1, sy = 1, sz = 1, lod) {
  let [w, h] = SEG(); const k = lod ?? lodOf(r * Math.max(sx, sy, sz)); w = Math.max(8, Math.round(w * k)); h = Math.max(6, Math.round(h * k));
  const m = new THREE.Mesh(cache(`sph${w}x${h}`, () => new THREE.SphereGeometry(1, w, h)), mat); m.scale.set(r * sx, r * sy, r * sz); return m;
}
/** Cápsula orgánica (torso, cola, segmentos). */
export function capsule(mat, r = 0.5, len = 1) {
  let [w] = SEG(); w = Math.max(8, Math.round(w * lodOf(r)));
  const m = new THREE.Mesh(cache(`cap${w}`, () => new THREE.CapsuleGeometry(1, 1, 6, w)), mat); m.scale.set(r, len, r); return m;
}
const hornGeo = (sides) => cache(`horn${sides}${isLow() ? 'L' : 'H'}`, () => {
  const pts = isLow() ? [[1, 0], [0.62, 0.5], [0, 1]] : [[1, 0], [0.93, 0.2], [0.74, 0.5], [0.42, 0.78], [0, 1]];
  return new THREE.LatheGeometry(pts.map(([x, y]) => new V2(x, y)), sides);
});
/** Cuerno/espina/diente/garra de perfil suave, base en y=0 y punta en y=h. */
export function horn(mat, r = 0.1, h = 0.6, sides = 7) {
  const m = new THREE.Mesh(hornGeo(Math.min(sides, isLow() ? 5 : 12)), mat); m.scale.set(r, h, r); return m;
}
/** Prisma de cristal con punta: UNA sola malla (antes eran dos). */
export function crystalSpike(mat, r = 0.1, h = 0.6) {
  const g = cache('cspike1', () => {
    const body = new THREE.CylinderGeometry(0.9, 1, 1, 6, 1, true); body.translate(0, 0.5, 0);
    const tip = new THREE.ConeGeometry(0.9, 0.7, 6, 1, true); tip.translate(0, 1.35, 0);
    return merged([prep(body), prep(tip)]);
  });
  const m = new THREE.Mesh(g, mat); m.scale.set(r, h, r); return m;
}

/** Distribuye `n` objetos sobre la superficie de un elipsoide (puntos de Fibonacci). `make(i, normal)` devuelve un Object3D. */
export function scatterOnSurface(parent, n, radii, make, { from = 0, to = 1, seed = 1 } = {}) {
  const out = []; const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - 2 * (from + (to - from) * (i + 0.5) / n), rr = Math.sqrt(Math.max(0, 1 - y * y)), th = i * ga + seed;
    const nrm = new V3(Math.cos(th) * rr, y, Math.sin(th) * rr);
    const o = make(i, nrm); if (!o) continue;
    o.position.set(nrm.x * radii[0], nrm.y * radii[1], nrm.z * radii[2]);
    o.quaternion.setFromUnitVectors(new V3(0, 1, 0), new V3(nrm.x / radii[0], nrm.y / radii[1], nrm.z / radii[2]).normalize());
    parent.add(o); out.push(o);
  }
  return out;
}

/* ───────────── tentáculos ───────────── */
const tentGeo = ({ len, r0, r1, rad, segs, suckers, cilia, hang }) => {
  const prof = [];
  for (let i = 0; i <= segs; i++) { const k = i / segs; const rr = r1 + (r0 - r1) * Math.pow(1 - k, 1.45) + r0 * 0.22 * Math.max(0, 1 - k / 0.07); prof.push(new V2(rr, k * len)); }
  prof.push(new V2(r1 * 0.45, len + r1 * 0.5), new V2(0, len + r1 * 0.75));
  const parts = [prep(new THREE.LatheGeometry(prof, rad))];
  const radAt = (k) => r1 + (r0 - r1) * Math.pow(1 - k, 1.45);
  if (suckers > 0) {
    const sg = new THREE.SphereGeometry(1, 6, 4);
    for (let j = 0; j < suckers; j++) { const k = 0.14 + 0.8 * (j + 0.5) / suckers, rr = radAt(k), s = rr * 0.5; parts.push(xf(sg, compose(_p.set(0, k * len, rr * 0.88), _q.identity(), _s.set(s, s * 1.05, s * 0.6)))); }
  }
  if (cilia > 0) {
    const cg = new THREE.ConeGeometry(1, 1, 3, 1, true); cg.translate(0, 0.5, 0);
    for (let j = 0; j < cilia; j++) { const k = 0.1 + 0.88 * rnd(j, 3), a = rnd(j, 7) * TAU, rr = radAt(k), s = rr * 0.16; const d = new V3(Math.sin(a), 0.25, Math.cos(a)).normalize(); _q.setFromUnitVectors(_up, d); parts.push(xf(cg, compose(_p.set(Math.sin(a) * rr * 0.9, k * len, Math.cos(a) * rr * 0.9), _q, _s.set(s, rr * 1.8 + 0.01, s)))); }
  }
  const g = merged(parts); if (hang) g.rotateX(Math.PI); return g;
};
/**
 * Tentáculo que ondula por shader (1 draw call). Base en y=0, punta en y=-len (cuelga) si `hang`, o +len.
 * Afinado natural con bulbo en la base. NUEVAS opciones: suckers (n ventosas en el costado +z), cilia (n pelitos).
 * Controles vivos: t.userData.u.uAmp (agitación), uSpeed, uPhase.
 */
export function tentacle(baseMat, { len = 2, r0 = 0.12, r1 = 0.02, hang = true, amp = 0.25, speed = 2.2, freq = 3.0, phase = Math.random() * 6.28, suckers = 0, cilia = 0 } = {}) {
  const low = isLow(); const segs = low ? 8 : cfg().humans === 'medium' ? 12 : 16, rad = low ? 5 : 8;
  if (low) { suckers = Math.min(suckers, 3); cilia = 0; }
  const g = cache(`tent|${len}|${r0}|${r1}|${rad}|${segs}|${suckers}|${cilia}|${hang}`, () => tentGeo({ len, r0, r1, rad, segs, suckers, cilia, hang }));
  const mat = baseMat.clone(); mat.userData.u = { ...(baseMat.userData.u || {}) };
  const uni = { uAmp: { value: amp }, uSpeed: { value: speed }, uFreq: { value: freq }, uTPhase: { value: phase }, uLen: { value: len }, uDir: { value: hang ? -1 : 1 } };
  const prev = baseMat.onBeforeCompile; const baseU = baseMat.userData.u;
  const bk = baseMat.customProgramCacheKey ? baseMat.customProgramCacheKey() : 'mat';
  mat.customProgramCacheKey = () => `${bk}|tentacle`;
  mat.onBeforeCompile = (sh, rd) => {
    if (prev) prev(sh, rd); Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uAmp,uSpeed,uFreq,uTPhase,uLen,uDir;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float k = clamp(abs(position.y) / uLen, 0.0, 1.0); float w = k * k;
          transformed.x += (sin(uTime * uSpeed + k * uFreq + uTPhase) + 0.25 * sin(uTime * uSpeed * 2.3 + k * uFreq * 2.4 + uTPhase * 1.7)) * uAmp * w;
          transformed.z += (cos(uTime * uSpeed * 0.8 + k * uFreq * 1.3 + uTPhase) + 0.2 * cos(uTime * uSpeed * 1.9 + k * uFreq * 2.0 + uTPhase)) * uAmp * 0.7 * w; }`);
  };
  mat.userData.u = { ...baseU, ...uni }; // los uniformes de la piel base se comparten por referencia
  const m = new THREE.Mesh(g, mat); m.userData.u = uni; m.userData.mat = mat; return m;
}

/* ───────────── mandíbula ───────────── */
/** Boca con dientes FUSIONADOS en una malla por mitad: dos mitades que se abren. open ∈ [0,1]. */
export function jaw(skin, boneMat, { w = 0.5, len = 0.5, teeth = 6, canines = true } = {}) {
  const g = new THREE.Group(), up = new THREE.Group(), lo = new THREE.Group();
  const shellGeo = cache(`jawhalf${isLow() ? 'L' : 'H'}`, () => new THREE.SphereGeometry(1, isLow() ? 12 : 16, isLow() ? 6 : 8, 0, TAU, 0, Math.PI / 2));
  const half = (flip) => {
    const grp = flip ? lo : up; const m = new THREE.Mesh(shellGeo, skin); m.scale.set(w, len * 0.5, len); grp.add(m);
    const parts = []; const hg = hornGeo(isLow() ? 4 : 6);
    for (let i = 0; i < teeth; i++) {
      const a = teeth > 1 ? (i / (teeth - 1) - 0.5) * 2 : 0, big = canines && (i === 0 || i === teeth - 1) ? 1.5 : 1, j = 0.85 + 0.3 * rnd(i, flip ? 2 : 5);
      _q.setFromEuler(new THREE.Euler(flip ? 0.2 : Math.PI - 0.2, 0, 0));
      parts.push(xf(hg, compose(_p.set(a * w * 0.85, 0, len * (0.85 - Math.abs(a) * 0.4)), _q, _s.set(w * 0.09 * j, len * 0.28 * big * j, w * 0.09 * j))));
    }
    if (parts.length) { const tm = new THREE.Mesh(merged(parts), boneMat); grp.add(tm); }
    if (flip) grp.scale.y = -1; return grp;
  };
  g.add(half(false), half(true));
  return { object: g, upper: up, lower: lo, set(open) { up.rotation.x = -open * 0.7; lo.rotation.x = open * 0.7; } };
}

/* ───────────── patas con cinemática inversa (hueso «skinneado»: UN draw call por pata) ───────────── */
const legGeo = (upper, lower, r, rad) => cache(`leg|${upper}|${lower}|${r}|${rad}`, () => {
  const low = isLow();
  const tU = low ? [0, 0.5, 0.9, 1] : [0, 0.14, 0.36, 0.62, 0.86, 1], tL = low ? [0.1, 0.5, 0.95, 1] : [0.1, 0.22, 0.46, 0.74, 0.93, 1];
  const rings = [];
  const bulge = (x, c, wd, a) => a * Math.exp(-(((x - c) / wd) ** 2));
  for (const t of tU) rings.push({ y: -t * upper, rr: r * (0.85 - 0.2 * t) + bulge(t, 1, 0.1, r * 0.3) + bulge(t, 0, 0.1, r * 0.2), wB: t > 0.8 ? 0.5 * (t - 0.8) / 0.2 * 0.95 : 0 });
  for (const t of tL) rings.push({ y: -upper - t * lower, rr: r * 0.72 * (1 - 0.45 * t) + bulge(t, 0, 0.12, r * 0.28) + bulge(t, 1, 0.1, r * 0.26), wB: t < 0.2 ? 0.55 + 0.45 * (t / 0.2) : 1 });
  const pos = [], idx = [], si = [], sw = [];
  const push = (x, y, z, wB) => { pos.push(x, y, z); si.push(0, 1, 0, 0); sw.push(1 - wB, wB, 0, 0); return pos.length / 3 - 1; };
  const apexTop = push(0, r * 0.5, 0, 0);
  const R = rings.map((rg) => { const row = []; for (let i = 0; i < rad; i++) { const a = i / rad * TAU; row.push(push(Math.cos(a) * rg.rr, rg.y, Math.sin(a) * rg.rr, rg.wB)); } return row; });
  const last = rings[rings.length - 1]; const apexBot = push(0, last.y - last.rr * 0.5, 0, 1);
  for (let i = 0; i < rad; i++) { const j = (i + 1) % rad; idx.push(apexTop, R[0][j], R[0][i]); }
  for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < rad; i++) { const j = (i + 1) % rad; idx.push(R[k][i], R[k][j], R[k + 1][i], R[k][j], R[k + 1][j], R[k + 1][i]); }
  const E = R[R.length - 1]; for (let i = 0; i < rad; i++) { const j = (i + 1) % rad; idx.push(E[i], E[j], apexBot); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); g.setIndex(idx); g.computeVertexNormals();
  // orientación: las normales deben apuntar hacia fuera
  const n = g.attributes.normal, p = g.attributes.position, q = R[2][0]; if (n.getX(q) * p.getX(q) + n.getZ(q) * p.getZ(q) < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  g.computeBoundingSphere(); g.boundingSphere.radius = (upper + lower) * 1.1 + r * 3; return g;
});
/** Pata de 2 huesos con rodilla y pie incluidos en UNA malla skinneada. root en la cadera; setFoot(Vector3 local) coloca el pie y dobla la rodilla hacia `bend`. */
export function leg(mat, { upper = 0.7, lower = 0.8, r = 0.07, claw = null } = {}) {
  const root = new THREE.Group(), A = new THREE.Bone(), B = new THREE.Bone();
  B.position.y = -upper; A.add(B);
  const mesh = new THREE.SkinnedMesh(legGeo(upper, lower, r, isLow() ? 5 : 8), mat); mesh.frustumCulled = false;
  root.add(A, mesh); root.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton([A, B]));
  if (claw) { const c = horn(claw, r * 0.6, r * 4); c.rotation.x = Math.PI; c.position.y = -lower; B.add(c); }
  const bend = new V3(0, 1, 0), tgt = new V3(), DOWN = new V3(0, -1, 0);
  const dir = new V3(), axis = new V3(), kneeDir = new V3(), kneePos = new V3(), lowDir = new V3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  function solve(foot) {
    tgt.copy(foot); let d = tgt.length(); const max = upper + lower - 1e-3; if (d > max) { tgt.multiplyScalar(max / d); d = max; } d = Math.max(d, Math.abs(upper - lower) + 1e-3);
    const ang = Math.acos(THREE.MathUtils.clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1));
    dir.copy(tgt).normalize(); axis.crossVectors(dir, bend); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
    kneeDir.copy(dir).applyAxisAngle(axis, -ang);
    A.quaternion.setFromUnitVectors(DOWN, kneeDir);
    kneePos.copy(kneeDir).multiplyScalar(upper); lowDir.copy(tgt).sub(kneePos).normalize();
    qb.setFromUnitVectors(DOWN, lowDir); qa.copy(A.quaternion).invert(); B.quaternion.copy(qa.multiply(qb));
  }
  solve(new V3(0, -(upper + lower) * 0.9, 0));
  return { object: root, setFoot: solve, setBend(v) { bend.copy(v).normalize(); }, mesh, bones: [A, B] };
}

/* ───────────── utilidades de composición ───────────── */
/** Hilera de espinas / placas / cristales en UNA malla. path: array de Vector3 (curva suave) o función t→Vector3.
 *  Opciones: n, r/h (base) y r1/h1 (final), up (Vector3 o t→Vector3), lean (inclinación hacia la tangente), kind 'spine'|'plate'|'crystal', jitter, sides, seed. */
export function crestRow(mat, { path = [new V3(0, 0, -0.5), new V3(0, 0, 0.5)], n = 8, r = 0.06, h = 0.2, r1, h1, up = new V3(0, 1, 0), lean = 0.25, kind = 'spine', jitter = 0.2, sides = 5, seed = 1 } = {}) {
  const curve = typeof path === 'function' ? null : new THREE.CatmullRomCurve3(path);
  const base = kind === 'crystal' ? (() => { const b = new THREE.CylinderGeometry(0.9, 1, 1, 6, 1, true); b.translate(0, 0.5, 0); const t = new THREE.ConeGeometry(0.9, 0.7, 6, 1, true); t.translate(0, 1.35, 0); return merged([prep(b), prep(t)]); })() : prep(hornGeo(sides));
  const parts = []; const T = new V3(), U = new V3(), D = new V3(), side = new V3(), X = new V3(), Z = new V3(), mm = new M4();
  r1 = r1 ?? r; h1 = h1 ?? h;
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5, p = curve ? curve.getPointAt(t) : path(t); T.copy(curve ? curve.getTangentAt(t) : new V3(0, 0, 1));
    U.copy(typeof up === 'function' ? up(t) : up).normalize(); D.copy(U).addScaledVector(T, lean).normalize();
    const j = 1 + (rnd(i, seed) - 0.5) * 2 * jitter, rr = (r + (r1 - r) * t) * j, hh = (h + (h1 - h) * t) * j * (kind === 'plate' ? 0.8 : 1);
    side.crossVectors(D, T); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize(); X.copy(kind === 'plate' ? T : side).normalize(); Z.crossVectors(X, D).normalize(); X.crossVectors(D, Z).normalize();
    mm.makeBasis(X, D, Z); _q.setFromRotationMatrix(mm);
    parts.push(xf(base, compose(p, _q, kind === 'plate' ? _s.set(rr * 2.2, hh, rr * 0.45) : _s.set(rr, hh, rr))));
  }
  base.dispose(); return new THREE.Mesh(merged(parts), mat);
}
/** Hilera de dientes (curva en x, apuntando a +y) en UNA malla. flip=true apunta hacia abajo. */
export function teeth(mat, { n = 8, w = 0.5, h = 0.14, r = 0.03, curve = 0.25, rows = 1, flip = false, jitter = 0.25, canines = false, seed = 1 } = {}) {
  const parts = [], hg = hornGeo(isLow() ? 4 : 6);
  for (let row = 0; row < rows; row++) for (let i = 0; i < n; i++) {
    const a = n > 1 ? (i / (n - 1) - 0.5) * 2 : 0, j = 1 + (rnd(i + row * 31, seed) - 0.5) * 2 * jitter, big = canines && (i === 0 || i === n - 1) ? 1.6 : 1;
    _q.setFromEuler(new THREE.Euler(flip ? Math.PI : 0, 0, -a * 0.25 * (flip ? -1 : 1)));
    parts.push(xf(hg, compose(_p.set(a * w, 0, curve * (1 - a * a) - row * h * 0.6), _q, _s.set(r * j, h * big * j * (row ? 0.75 : 1), r * j))));
  }
  return new THREE.Mesh(merged(parts), mat);
}
/** Caja torácica: n costillas curvas (a ambos lados) en UNA malla, a lo largo de -z/+z. radius = radio del tórax. */
export function ribs(mat, { n = 6, radius = 0.4, r = 0.025, spacing = 0.14, arc = 2.2, squash = 1, taper = 0.6, sides = 2, z0 = 0 } = {}) {
  const parts = [], segs = isLow() ? 6 : 10, rad = isLow() ? 4 : 5;
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(1, n - 1), R = radius * (1 - taper * Math.pow(Math.abs(k - 0.35) * 1.4, 2) * 0.5), z = z0 + (i - (n - 1) / 2) * spacing;
    for (const sd of sides === 2 ? [-1, 1] : [1]) {
      const pts = []; for (let s = 0; s <= segs; s++) { const th = s / segs * arc; pts.push(new V3(sd * Math.sin(th) * R, Math.cos(th) * R * squash, z + Math.sin(th * 1.2) * 0.02)); }
      parts.push(prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, r * (1 - 0.3 * Math.abs(k - 0.4)), rad, false)));
    }
  }
  return new THREE.Mesh(merged(parts), mat);
}
/** Saco translúcido con contenido (huevos/larva/líquido luminoso). Devuelve {object, mats, set(pulse, glow)}. content: 'orbs'|'embryo'|'glow'|'none'. */
export function sac({ r = 0.3, color = 0xd8a0c0, content = 'orbs', contentColor = 0x66ffee, n = 3, alpha = 0.5, goo = false } = {}) {
  const g = new THREE.Group();
  const shell = goo ? gooMaterial({ color, alpha: Math.min(0.9, alpha + 0.2) }) : membraneMaterial({ color, alpha, veins: 0.8 });
  const inner = fleshMaterial({ color: contentColor, vein: 0x103040, spot: contentColor, glow: 0.8, spots: 0.5, veins: 0.3, wobble: 0.03, breath: 0.03, rough: 0.35 });
  const body = blob(shell, r); body.renderOrder = 2; g.add(body);
  const items = [];
  if (content === 'glow') { const c = blob(inner, r * 0.55); g.add(c); items.push(c); }
  else if (content === 'orbs') { for (let i = 0; i < n; i++) { const a = i / n * TAU + 0.5, c = blob(inner, r * (0.26 + 0.1 * rnd(i, 4))); c.position.set(Math.cos(a) * r * 0.38, (rnd(i, 9) - 0.5) * r * 0.5, Math.sin(a) * r * 0.38); g.add(c); items.push(c); } }
  else if (content === 'embryo') { const body2 = capsule(inner, r * 0.28, r * 0.5); body2.rotation.z = 1.2; g.add(body2); items.push(body2); const hd = blob(inner, r * 0.24); hd.position.set(r * 0.32, r * 0.18, 0); g.add(hd); items.push(hd); }
  const u = inner.userData.u; let t = 0;
  return { object: g, mats: [shell, inner], inner, shell, set(pulse = 0, glow = 0.8) { t += 0.016; u.uGlow.value = glow; u.uPulse.value = pulse; items.forEach((c, i) => { const s = 1 + 0.05 * Math.sin(t * 4 + i * 2) + pulse * 0.1; c.scale.copy(c.userData.s0 ??= c.scale.clone()).multiplyScalar(s); }); } };
}
/** Cicatriz: cresta rugosa con puntos de sutura, en UNA malla. Eje largo = x, normal de la superficie = +z. Colócala con scarOn(). */
export function scar(mat, { len = 0.5, w = 0.022, stitches = 5, bend = 0.06 } = {}) {
  const parts = [], segs = isLow() ? 6 : 10;
  const pts = []; for (let i = 0; i <= segs; i++) { const t = i / segs - 0.5; pts.push(new V3(t * len, Math.sin(t * 3.1) * bend, 0)); }
  parts.push(prep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, w, 5, false)));
  const cg = new THREE.CylinderGeometry(1, 1, 1, 5, 1); const q = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), 0);
  for (let i = 0; i < stitches; i++) { const t = (i + 0.5) / stitches - 0.5; parts.push(xf(cg, compose(_p.set(t * len, Math.sin(t * 3.1) * bend, 0), q, _s.set(w * 0.4, w * 5.5, w * 0.4)))); }
  return new THREE.Mesh(merged(parts), mat);
}
/** Coloca un objeto sobre un elipsoide: pos (local), normal de la superficie; devuelve el objeto (lo agrega a parent). */
export function scarOn(parent, obj, pos, normal, roll = 0) { obj.position.copy(pos); obj.quaternion.setFromUnitVectors(new V3(0, 0, 1), normal.clone().normalize()); obj.rotateZ(roll); parent.add(obj); return obj; }

/** Funde en UNA malla por material todas las mallas ESTÁTICAS descendientes de `group` (opcional: sólo las de `mat`). Salta las skinneadas,
 *  las que tengan hijos o userData.keep, y los tentáculos. Llamala al final del build, sobre un grupo de piezas que no se animan por separado. */
export function mergeStatic(group, mat = null) {
  group.updateMatrixWorld(true);
  const inv = new M4().copy(group.matrixWorld).invert(), by = new Map(), kill = [];
  group.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.children.length || o.userData.keep || o.userData.u || Array.isArray(o.material)) return;
    if (mat && o.material !== mat) return;
    let arr = by.get(o.material); if (!arr) by.set(o.material, arr = []);
    arr.push(xf(o.geometry, new M4().multiplyMatrices(inv, o.matrixWorld))); kill.push(o);
  });
  let first = null;
  for (const [m, arr] of by) { const mesh = new THREE.Mesh(merged(arr), m); group.add(mesh); first = first || mesh; }
  kill.forEach((o) => o.parent && o.parent.remove(o));
  return first;
}

/** Resorte crítico-amortiguado para movimiento secundario (colas, antenas, cabezas). */
export class Spring { constructor(x = 0, k = 60, d = 8) { this.x = x; this.v = 0; this.k = k; this.d = d; } step(dt, target) { const a = this.k * (target - this.x) - this.d * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; } }
