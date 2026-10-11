// GEOMETRÍA PROCEDURAL ESCULPIDA para el material bio-orgánico (obelisco-mat.js): tubos/lofts con perfil de músculo, placas de armadura
// paramétricas con grosor, cuernos con costillas, cristales facetados, haz de tentáculos en UNA malla y patas con cinemática inversa.
// Todas las piezas llevan los atributos: position, normal, uv, color (albedo), aS=(clase, brillo) → se pueden FUSIONAR (1 draw call).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V3 = THREE.Vector3;
const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _up = new V3(0, 1, 0);
export const col = (h) => new THREE.Color(h);
export const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const rnd = (() => { let s = 98765; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

/** Deja la geometría con índice + normales + uv (para poder fusionar). */
export function prep(g) {
  if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aS', 'aT', 'aD'].includes(k)) g.deleteAttribute(k);
  return g;
}
/**
 * Pinta la pieza: color base + clase de material (0 carne, 1 quitina, 2 hueso, 3 cristal, 4 membrana) + brillo de vértice.
 * fn(p, n, uv, i) opcional → { c: Color|hex, k: multiplicador de luz, g: brillo, cls }.
 */
export function paint(g, color, cls = 0, glow = 0, fn = null) {
  prep(g); const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, n = pos.count;
  const C = new Float32Array(n * 3), S = new Float32Array(n * 2), base = new THREE.Color(color), p = new V3(), nn = new V3();
  for (let i = 0; i < n; i++) {
    let c = base, k = 1, gl = glow, cl = cls;
    if (fn) { p.fromBufferAttribute(pos, i); nn.fromBufferAttribute(nor, i); const r = fn(p, nn, [uv.getX(i), uv.getY(i)], i); if (r) { if (r.c != null) c = _c.set(r.c); if (r.k != null) k = r.k; if (r.g != null) gl = r.g; if (r.cls != null) cl = r.cls; } }
    C[i * 3] = c.r * k; C[i * 3 + 1] = c.g * k; C[i * 3 + 2] = c.b * k; S[i * 2] = cl; S[i * 2 + 1] = gl;
  }
  g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('aS', new THREE.BufferAttribute(S, 2));
  return g;
}
/** Coloca (clona) la geometría: posición, rotación (Euler [x,y,z] | Quaternion) y escala (número o [x,y,z]). */
export function place(g, pos = [0, 0, 0], rot = null, sc = 1) {
  const c = g.clone(); const q = rot ? (rot.isQuaternion ? rot : _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]))) : _q.identity();
  const s = typeof sc === 'number' ? [sc, sc, sc] : sc; const P = pos.isVector3 ? pos : new V3(pos[0], pos[1], pos[2]);
  c.applyMatrix4(_m.compose(P, q, new V3(s[0], s[1], s[2]))); return c;
}
/** Orienta +y local hacia `dir`. */
export function aimY(g, pos, dir, sc = 1) { return place(g, pos, new THREE.Quaternion().setFromUnitVectors(_up, new V3().copy(dir).normalize()), sc); }
/** Espejo en X (invierte también el orden de los triángulos). */
export function mirrorX(g) {
  const c = g.clone(); c.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1)); const ix = c.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } c.index.needsUpdate = true; c.computeVertexNormals(); return c;
}
export function merge(list) { const l = list.filter(Boolean).map(prep); const out = mergeGeometries(l, false); out.computeBoundingSphere(); return out; }

/* ───────────── lofts (tubos con perfil) ───────────── */
/**
 * Tubo a lo largo de una curva. r(t) radio; ry(t) razón de aplastado; mod(t, a) ondulación (costillas/músculo); round=[a,b] redondeo de los extremos.
 */
export function loft(pts, { seg = 14, radial = 10, r = () => 0.1, ry = () => 1, mod = null, round = [0.0, 0.0], closedStart = true, twist = 0 } = {}) {
  const curve = Array.isArray(pts) ? new THREE.CatmullRomCurve3(pts, false, "centripetal") : pts;
  const fr = curve.computeFrenetFrames(seg, false);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, P = curve.getPointAt(t); let rr = r(t); const k = ry(t);
    if (round[0] > 0 && t < round[0]) rr *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - t / round[0], 2)));
    if (round[1] > 0 && t > 1 - round[1]) rr *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - (1 - t) / round[1], 2)));
    const N = fr.normals[i], B = fr.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2 + twist * t, m = mod ? mod(t, a) : 1, ca = Math.cos(a), sa = Math.sin(a);
      pos.push(P.x + (N.x * ca + B.x * sa * k) * rr * m, P.y + (N.y * ca + B.y * sa * k) * rr * m, P.z + (N.z * ca + B.z * sa * k) * rr * m);
      uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); seamNormals(g, seg, radial); g.userData.curve = curve;
  return g;
}
function seamNormals(g, seg, radial) {
  const n = g.attributes.normal; const v = new V3(), w = new V3();
  for (let i = 0; i <= seg; i++) { const a = i * (radial + 1), b = a + radial; v.fromBufferAttribute(n, a); w.fromBufferAttribute(n, b); v.add(w).normalize(); n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z); }
}
/** Recta de p0 a p1 (lofts rectos: patas, cuernos rectos). */
export const line = (p0, p1) => new THREE.LineCurve3(new V3(...p0), new V3(...p1));

/* ───────────── superficie paramétrica con grosor (placas de armadura) ───────────── */
/** fn(u,v) → V3 con u,v∈[0,1]. thick>0 añade el borde (faldón) hacia dentro. */
export function patch(fn, nu = 8, nv = 6, { thick = 0.03, flipY = false, inner = false } = {}) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = fn(i / nu, j / nv); pos.push(p.x, p.y, p.z); uv.push(i / nu, j / nv); }
  const W = nu + 1;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, c, b, b, c, d); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  if (flipY) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
  if (thick > 0) {
    const N = g.attributes.normal, P = g.attributes.position; const sp = [...P.array], su = [...g.attributes.uv.array], si = [...g.index.array]; const edges = [];
    for (let i = 0; i < nu; i++) { edges.push([i, i + 1], [nv * W + i + 1, nv * W + i]); } for (let j = 0; j < nv; j++) { edges.push([(j + 1) * W, j * W]); edges.push([j * W + nu, (j + 1) * W + nu]); }
    for (const [a, b] of edges) {
      const base = sp.length / 3; for (const k of [a, b]) sp.push(P.getX(k), P.getY(k), P.getZ(k)); for (const k of [a, b]) sp.push(P.getX(k) - N.getX(k) * thick, P.getY(k) - N.getY(k) * thick, P.getZ(k) - N.getZ(k) * thick);
      su.push(0, 0, 0, 0, 0, 0, 0, 0); const w = flipY ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 1, 2, 3]; si.push(...w.map((o) => base + o));
    }
    const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2)); out.setIndex(si);
    // normales: las del parche arriba (suaves) y planas en los faldones
    if (inner) { // cara interior (se ve desde abajo): copia desplazada hacia dentro con el orden invertido
      const b0 = sp.length / 3; for (let k = 0; k < P.count; k++) sp.push(P.getX(k) - N.getX(k) * thick, P.getY(k) - N.getY(k) * thick, P.getZ(k) - N.getZ(k) * thick);
      su.push(...Array.from(g.attributes.uv.array)); const gi = g.index.array; for (let k = 0; k < gi.length; k += 3) si.push(b0 + gi[k], b0 + gi[k + 2], b0 + gi[k + 1]);
      out.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2)); out.setIndex(si);
      out.computeVertexNormals(); const on2 = out.attributes.normal; for (let k = 0; k < P.count; k++) { on2.setXYZ(k, N.getX(k), N.getY(k), N.getZ(k)); on2.setXYZ(b0 + k, -N.getX(k), -N.getY(k), -N.getZ(k)); } return out;
    }
    out.computeVertexNormals(); const on = out.attributes.normal; for (let k = 0; k < P.count; k++) on.setXYZ(k, N.getX(k), N.getY(k), N.getZ(k));
    g = out;
  }
  return g;
}

/* ───────────── primitivas esculpidas ───────────── */
/** Elipsoide con deformación opcional deform(p, n) (muta p). */
export function blobGeo(rx = 1, ry = 1, rz = 1, w = 16, h = 12, deform = null) {
  const g = new THREE.SphereGeometry(1, w, h); const P = g.attributes.position, v = new V3(), n = new V3();
  for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i); n.copy(v); v.set(v.x * rx, v.y * ry, v.z * rz); if (deform) deform(v, n); P.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); seamSphere(g, w, h); return g;
}
function seamSphere(g, w, h) { const n = g.attributes.normal; const a = new V3(), b = new V3(); for (let j = 0; j <= h; j++) { const i0 = j * (w + 1), i1 = i0 + w; a.fromBufferAttribute(n, i0); b.fromBufferAttribute(n, i1); a.add(b).normalize(); n.setXYZ(i0, a.x, a.y, a.z); n.setXYZ(i1, a.x, a.y, a.z); } }
/** Cono/espina (base en y=0, punta en y=1). */
export function coneGeo(sides = 6, curve = 0) { const g = new THREE.ConeGeometry(1, 1, sides, curve ? 3 : 1); g.translate(0, 0.5, 0); if (curve) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); P.setX(i, P.getX(i) + curve * y * y); } g.computeVertexNormals(); } return g; }
/** Racimo de espinas pintadas. items: {p,d,r,h,c?,cls?,glow?}. */
export function spikes(items, { sides = 5, color = 0xffffff, cls = 2, glow = 0, curve = 0, tipGlow = 0 } = {}) {
  const cone = coneGeo(sides, curve), out = [];
  for (const it of items) {
    const g = aimY(cone, it.p, it.d, [it.r, it.h, it.r]);
    g.attributes.uv.array.fill(0);
    paint(g, it.c ?? color, it.cls ?? cls, it.glow ?? glow, tipGlow ? (p) => ({ g: clamp((p.clone().sub(it.p).dot(it.d.clone().normalize()) / it.h), 0, 1) * tipGlow }) : null); out.push(g);
  }
  return merge(out);
}
/** Cristal facetado: prisma hexagonal con punta, brillo creciente hacia la punta. */
export function crystalGeo(p, d, r, h, color = 0xff9a20, { sides = 6, glow = 1, tip = 0.45, base = 0.35 } = {}) {
  const body = new THREE.CylinderGeometry(r * 0.78, r, h * (1 - tip), sides, 1, true); body.translate(0, h * (1 - tip) / 2, 0);
  const top = new THREE.ConeGeometry(r * 0.78, h * tip, sides, 1, true); top.translate(0, h * (1 - tip) + h * tip / 2, 0);
  const g = merge([body, top].map(prep)); const rot = new THREE.Quaternion().setFromUnitVectors(_up, new V3().copy(d).normalize()); g.applyMatrix4(_m.compose(p, rot, new V3(1, 1, 1)));
  const dn = new V3().copy(d).normalize(), P0 = p;
  paint(g, color, 3, glow, (v) => { const t = clamp(v.clone().sub(P0).dot(dn) / h, 0, 1); return { k: lerp(base, 1, t), g: lerp(0.15, 1, t * t) * glow }; }); g.computeVertexNormals(); return g;
}
/** Cristales dispuestos en lista: [{p,d,r,h,c}] → una sola geometría. */
export function crystals(items, opt = {}) { return merge(items.map((it) => crystalGeo(it.p, it.d, it.r, it.h, it.c ?? opt.color ?? 0xff9a20, { sides: it.sides ?? opt.sides ?? 6, glow: it.glow ?? opt.glow ?? 1, tip: opt.tip ?? 0.45, base: opt.base ?? 0.35 }))); }

/* ───────────── haz de tentáculos (UNA malla) ───────────── */
/**
 * specs: [{ p:V3 raíz, d:V3 dirección inicial, len, r0, r1, sag?:V3 (caída), c?: color, ph? }].
 * La malla lleva aT=(id, k a lo largo, fase, longitud) y aD (dirección) para el shader de obelisco-mat (opción tent:N).
 */
export function tentacleBundle(specs, { seg = 14, radial = 6, color = 0x884466, cls = 0, tipColor = null, tipGlow = 0 } = {}) {
  const parts = [];
  specs.forEach((s, id) => {
    const pts = []; const n = 6; const d = s.d.clone().normalize(), sag = s.sag || new V3(0, 0, 0);
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push(s.p.clone().addScaledVector(d, k * s.len).addScaledVector(sag, k * k * s.len)); }
    const g = loft(pts, { seg, radial, r: (t) => lerp(s.r0, s.r1, Math.pow(t, 0.8)) * (1 + 0.18 * Math.sin(t * 22 + id)) * (t > 0.92 ? Math.max(0.05, (1 - t) / 0.08 * 0.6 + 0.4) : 1), round: [0.05, 0.0] });
    prep(g); const P = g.attributes.position, n0 = P.count, T = new Float32Array(n0 * 4), D = new Float32Array(n0 * 3);
    for (let i = 0; i < n0; i++) { const k = Math.floor(i / (radial + 1)) / seg; T[i * 4] = id; T[i * 4 + 1] = k; T[i * 4 + 2] = s.ph ?? id * 1.7; T[i * 4 + 3] = s.len; D[i * 3] = d.x; D[i * 3 + 1] = d.y; D[i * 3 + 2] = d.z; }
    g.setAttribute('aT', new THREE.BufferAttribute(T, 4)); g.setAttribute('aD', new THREE.BufferAttribute(D, 3));
    paint(g, s.c ?? color, cls, 0, (p, nn, uv) => { const k = uv[1]; const r = { k: 0.7 + 0.5 * k, g: tipGlow ? sstep(0.8, 1, k) * tipGlow : 0 }; if (tipColor) r.c = _c.set(s.c ?? color).lerp(col(tipColor), sstep(0.7, 1, k)); return r; });
    parts.push(g);
  });
  return merge(parts);
}
/** Prepara los vectores uTA/uTB de un haz: devuelve funciones set(i, amp, speed, bendDir, bendAmt, stretch). */
export function tentacleRig(mat) {
  const u = mat.userData.u;
  return { n: u.uTA.value.length, set(i, amp, speed, bend = null, bendAmt = 0, stretch = 1) { u.uTA.value[i].set(amp, speed, 0, stretch); const b = u.uTB.value[i]; if (bend) b.set(bend.x, bend.y, bend.z, bendAmt); else b.set(0, 0, 0, 0); } };
}

/* ───────────── patas con cinemática inversa (mallas propias) ───────────── */
/** Pata de 2 huesos con las geometrías dadas (cuelgan hacia -y). setFoot(V3) en el espacio de la cadera. */
export function ikLeg(matUp, geoUp, matLo, geoLo, { upper = 0.7, lower = 0.8 } = {}) {
  const root = new THREE.Group(), A = new THREE.Group(), B = new THREE.Group();
  const mu = new THREE.Mesh(geoUp, matUp), ml = new THREE.Mesh(geoLo, matLo); A.add(mu); B.position.y = -upper; B.add(ml); A.add(B); root.add(A);
  const bend = new V3(0, 1, 0), tgt = new V3(), DOWN = new V3(0, -1, 0), dir = new V3(), axis = new V3(), kd = new V3(), kp = new V3(), ld = new V3(), w2 = new THREE.Quaternion();
  function solve(foot) {
    tgt.copy(foot); let d = tgt.length(); const max = upper + lower - 1e-3; if (d > max) { tgt.multiplyScalar(max / d); d = max; } d = Math.max(d, Math.abs(upper - lower) + 1e-3);
    const ang = Math.acos(clamp((upper * upper + d * d - lower * lower) / (2 * upper * d), -1, 1));
    dir.copy(tgt).normalize(); axis.crossVectors(dir, bend); if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0); axis.normalize();
    kd.copy(dir).applyAxisAngle(axis, -ang); A.quaternion.setFromUnitVectors(DOWN, kd);
    kp.copy(kd).multiplyScalar(upper); ld.copy(tgt).sub(kp).normalize(); w2.setFromUnitVectors(DOWN, ld); B.quaternion.copy(A.quaternion).invert().multiply(w2);
  }
  solve(new V3(0, -(upper + lower) * 0.9, 0));
  return { object: root, upperMesh: mu, lowerMesh: ml, A, B, setFoot: solve, setBend(v) { bend.copy(v).normalize(); } };
}

/* ───────────── utilidades de perfil y placas ───────────── */
/** Perfil suave por tramos: keys = [[t, valor], ...] (t creciente). */
export const prof = (keys) => (t) => {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = keys[i - 1], b = keys[i], k = (t - a[0]) / (b[0] - a[0]), s = k * k * (3 - 2 * k); return a[1] + (b[1] - a[1]) * s; }
  return keys[keys.length - 1][1];
};
/**
 * Placa abombada de armadura (domo elíptico con borde caído y cresta opcional), centrada en el origen con la cúpula hacia +y.
 * w = ancho (x), l = largo (z), h = altura. Se coloca con aimY()/place().
 */
export function domePlate(w, l, h, { nu = 8, nv = 7, thick = 0.03, droop = 0.35, ridge = 0, taper = 0, inner = false } = {}) {
  return patch((u, v) => {
    const x = (u - 0.5) * 2, z = (v - 0.5) * 2, X = x * Math.sqrt(1 - z * z / 2), Z = z * Math.sqrt(1 - x * x / 2), r2 = Math.min(1, X * X + Z * Z);
    const hh = h * (Math.pow(1 - r2, 0.55) * (1 - droop) + (1 - r2) * droop) + h * ridge * Math.exp(-X * X * 7) * (1 - r2);
    return new V3(X * w * (1 - taper * (Z * 0.5 + 0.5) * 0.5), hh, Z * l);
  }, nu, nv, { thick, inner });
}

/**
 * Geometrías de una pata (lado derecho +x y espejo): muslo musculoso con placa externa, rodilla acorazada, tibia con tendón, pie con garras.
 * Devuelve { uR, lR, uL, lL } (cuelgan hacia -y desde la cadera). pal = { flesh, chit, bone }.
 */
export function legGeometry({ upper = 0.7, lower = 0.8, rUp = [0.2, 0.26, 0.18, 0.1], rLo = [0.1, 0.12, 0.08, 0.045], radial = 8, seg = 8, pal = {}, claws = 3, spur = true } = {}) {
  const FL = pal.flesh ?? 0x3a1a26, CH = pal.chit ?? 0x1a1524, BO = pal.bone ?? 0x7a6a50, UP = upper, LO = lower;
  const up = [], lo = [];
  const thigh = loft(line([0, 0, 0], [0, -UP, 0]), { seg, radial, r: prof([[0, rUp[0]], [0.28, rUp[1]], [0.62, rUp[2]], [1, rUp[3]]]), ry: () => 0.9, round: [0.2, 0.0], mod: (t, a) => 1 + 0.07 * Math.sin(a * 3 + t * 5) * (1 - t) });
  up.push(paint(thigh, FL, 0, 0, (p, n) => ({ k: 0.8 + 0.3 * n.x })));
  const gp = domePlate(rUp[1] * 0.55, UP * 0.5, rUp[1] * 0.5, { ridge: 0.5, thick: 0.03, nu: 6, nv: 6 });
  up.push(paint(aimY(gp, new V3(rUp[1] * 0.65, -UP * 0.42, 0.0), new V3(1, 0.15, 0.0)), CH, 1, 0, (p, n, uv) => ({ k: 0.55 + 0.7 * Math.max(0, p.x * 3), g: sstep(0.8, 1, Math.max(Math.abs(uv[0] * 2 - 1), Math.abs(uv[1] * 2 - 1))) * 0.5 })));
  up.push(place(paint(blobGeo(rUp[3] * 1.2, rUp[3] * 1.2, rUp[3] * 1.3, 10, 8), CH, 1, 0, (p) => ({ k: 0.7 + 0.5 * p.y })), [0, -UP, 0]));
  if (spur) up.push(spikes([{ p: new V3(0.06, -UP, -rUp[3]), d: new V3(0.4, 0.2, -1), r: rUp[3] * 0.5, h: rUp[3] * 2.4 }, { p: new V3(rUp[3], -UP * 0.6, -0.08), d: new V3(1, 0.3, -0.6), r: rUp[3] * 0.35, h: rUp[3] * 1.6 }], { sides: 5, color: BO, cls: 2, curve: -0.2 }));
  const shin = loft(line([0, 0, 0], [0, -LO, 0]), { seg, radial, r: prof([[0, rLo[0]], [0.16, rLo[1]], [0.45, rLo[2]], [1, rLo[3]]]), ry: () => 0.95 });
  lo.push(paint(shin, FL, 0, 0, (p, n) => ({ k: 0.8 + 0.3 * n.x })));
  const sg = domePlate(rLo[2] * 0.8, LO * 0.38, rLo[2] * 0.7, { ridge: 0.6, thick: 0.02, nu: 5, nv: 6 });
  lo.push(paint(aimY(sg, new V3(0.0, -LO * 0.4, rLo[2] * 0.75), new V3(0, 0.1, 1)), CH, 1, 0, (p) => ({ k: 0.7 + 0.5 * Math.max(0, p.y * 4) })));
  lo.push(paint(loft([new V3(0, -0.05, -rLo[1]), new V3(0, -LO * 0.5, -rLo[2] * 0.75), new V3(0, -LO + 0.06, -rLo[3] * 0.7)], { seg: 6, radial: 5, r: () => rLo[3] * 0.4, round: [0.2, 0.2] }), 0xb08a80, 0, 0, () => ({ k: 1.1 })));
  lo.push(paint(place(blobGeo(rLo[1], rLo[1] * 0.6, rLo[1] * 1.4, 10, 7), [0, -LO, rLo[1] * 0.4]), 0x2a1822, 1, 0, () => ({ k: 0.9 })));
  const cl = []; const ch = rLo[3] * 4;
  for (let i = 0; i < claws; i++) { const a = claws === 1 ? 0 : (i / (claws - 1) - 0.5) * 1.2; cl.push({ p: new V3(Math.sin(a) * rLo[3] * 1.4, -LO, rLo[3] * 2), d: new V3(Math.sin(a) * 0.9, -0.5, 0.9), r: rLo[3] * 0.8, h: ch }); }
  cl.push({ p: new V3(0, -LO + 0.04, -rLo[3] * 2), d: new V3(0, -0.2, -1), r: rLo[3] * 0.5, h: ch * 0.55 });
  lo.push(spikes(cl, { sides: 5, color: BO, cls: 2, curve: 0.15 }));
  const mu = merge(up), ml = merge(lo);
  return { uR: mu, lR: ml, uL: mirrorX(mu), lL: mirrorX(ml) };
}
