// Núcleo de la mano orgánica: decodifica la malla (hand-data.js, MakeHuman CC0 simplificada), calcula sus coordenadas de
// tatuaje, hace esqueleto (FK) + skinning por CPU y resuelve el agarre de los dedos contra la forma real del arma.
// Marco local de la mano (derecha): X = lado del pulgar · Y = dorso · Z = hacia los dedos · origen en la muñeca (metros).
// La mano IZQUIERDA es la misma malla reflejada (se resuelve «en un mundo espejo» y se espeja al final).
import * as THREE from 'three';
import { HAND_DATA } from './hand-data.js';

export const FINGERS = { thumb: [1, 2, 3], index: [4, 5, 6], middle: [7, 8, 9], ring: [10, 11, 12], pinky: [13, 14, 15] };
export const FNAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export const ARM = 16;

const dec = (s, T) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const bones = HAND_DATA.bones.map((b) => ({ name: b.name, parent: b.parent, p: V(...b.pos) }));
const tips = Object.fromEntries(Object.entries(HAND_DATA.tips).map(([k, v]) => [k, V(...v)]));
export const REST = bones.map((b) => b.p);
export const TIP = FNAMES.map((f) => tips[f]);

const _lods = {};
/** LOD de la malla ('lo' | 'hi') con sus datos derivados (coordenadas de tatuaje, dedo dominante...). */
export function handLod(name) {
  if (_lods[name]) return _lods[name];
  const d = HAND_DATA[name], n = d.n;
  const H = { name, n, tris: d.tris, pos: new Float32Array(n * 3), nor: new Float32Array(n * 3), si: dec(d.si, Uint8Array), sw: new Float32Array(n * 4), ix: dec(d.ix, Uint16Array) };
  const p16 = dec(d.pos, Int16Array), n8 = dec(d.nor, Int8Array), w8 = dec(d.sw, Uint8Array);
  for (let i = 0; i < n * 3; i++) { H.pos[i] = p16[i] / 10000; H.nor[i] = n8[i] / 127; } for (let i = 0; i < n * 4; i++) H.sw[i] = w8[i] / 255;
  // ── coordenadas derivadas: aux (flujo normalizado: muñeca 0 · nudillos 1 · punta 2), uvm = (u, v, máscara de tatuaje), dedo dominante
  H.aux = new Float32Array(n); H.rs = new Float32Array(n * 4); H.uvm = new Float32Array(n * 3); H.fing = new Int8Array(n).fill(-1);
  const chains = FNAMES.map((f, fi) => { const b = FINGERS[f]; return { pts: [REST[b[0]], REST[b[1]], REST[b[2]], tips[f]], par: fi === 0 ? [0.4, 1.0, 1.5, 2.0] : [1.0, 1.333, 1.666, 2.0] }; });
  const P = V(), Ap = V(), s = V(), r = V();
  for (let i = 0; i < n; i++) {
    const fw = [0, 0, 0, 0, 0]; for (let j = 0; j < 4; j++) { const b = H.si[i * 4 + j]; for (let f = 0; f < 5; f++) if (FINGERS[FNAMES[f]].includes(b)) fw[f] += H.sw[i * 4 + j]; }
    let fb = 0; for (let f = 1; f < 5; f++) if (fw[f] > fw[fb]) fb = f;
    P.set(H.pos[i * 3], H.pos[i * 3 + 1], H.pos[i * 3 + 2]);
    if (fw[fb] > 0.5) {
      H.fing[i] = fb; const c = chains[fb]; let best = 1e9, aux = 1;
      for (let k = 0; k < 3; k++) { s.copy(c.pts[k + 1]).sub(c.pts[k]); const L2 = s.lengthSq(); const t = Math.min(1, Math.max(0, r.copy(P).sub(c.pts[k]).dot(s) / L2)); Ap.copy(c.pts[k]).addScaledVector(s, t); const dd = Ap.distanceToSquared(P); if (dd < best) { best = dd; aux = c.par[k] + (c.par[k + 1] - c.par[k]) * t; r.copy(Ap); H._ax = r.x; H._ay = r.y; } }
      H.aux[i] = aux; const ax = H._ax, ay = H._ay;
      H.uvm[i * 3] = fb === 0 ? aux * 0.07 : P.z; H.uvm[i * 3 + 1] = ax + 0.011 * Math.atan2(P.x - ax, P.y - ay); H.uvm[i * 3 + 2] = 1;
      H.rs[i * 4] = Math.atan2(P.x - ax, P.y - ay); H.rs[i * 4 + 1] = P.z; H.rs[i * 4 + 2] = H.nor[i * 3 + 1]; H.rs[i * 4 + 3] = fb; // rs: finger -> (ángulo alrededor del dedo, z, normal-y, dedo)
    } else {
      H.aux[i] = Math.max(-1.2, Math.min(1, P.z / 0.0964)); H.rs[i * 4] = P.x; H.rs[i * 4 + 1] = P.z; H.rs[i * 4 + 2] = H.nor[i * 3 + 1]; H.rs[i * 4 + 3] = -1; H.uvm[i * 3] = P.z; H.uvm[i * 3 + 1] = P.x; H.uvm[i * 3 + 2] = smooth(-0.1, 0.4, H.nor[i * 3 + 1]);
    }
  }
  return (_lods[name] = H);
}

/* ───────────────────────── esqueleto + skinning ───────────────────────── */

const _m = new THREE.Matrix4(), _t = new THREE.Matrix4();
export class Pose {
  constructor(H) {
    this.H = H; this.q = bones.map(() => new THREE.Quaternion()); this.root = new THREE.Matrix4();
    this.W = bones.map(() => new THREE.Matrix4()); this.B = bones.map(() => new THREE.Matrix4());
  }
  /** Recalcula las matrices de los huesos (this.W = hueso en el espacio de resolución, this.B = de reposo a pose). */
  update() {
    for (let b = 0; b < bones.length; b++) {
      const bn = bones[b], W = this.W[b];
      if (bn.parent < 0) { W.copy(this.root); _m.makeRotationFromQuaternion(this.q[b]); W.multiply(_m); }
      else { _t.makeTranslation(bn.p.x - bones[bn.parent].p.x, bn.p.y - bones[bn.parent].p.y, bn.p.z - bones[bn.parent].p.z); W.copy(this.W[bn.parent]).multiply(_t); _m.makeRotationFromQuaternion(this.q[b]); W.multiply(_m); }
      _t.makeTranslation(-bn.p.x, -bn.p.y, -bn.p.z); this.B[b].copy(W).multiply(_t);
    }
    return this;
  }
  joint(b, out = V()) { return out.setFromMatrixPosition(this.W[b]); }
  tip(fi, out = V()) { const b = FINGERS[FNAMES[fi]][2]; return out.copy(TIP[fi]).sub(REST[b]).applyMatrix4(this.W[b]); }
  /** Punto de reposo (marco local de la mano) llevado a la pose, por el hueso dado. */
  point(b, rest, out = V()) { return out.copy(rest).applyMatrix4(this.B[b]); }
  /** Skinning por CPU de toda la malla -> {pos, nor} (Float32Array en el espacio de resolución). */
  skin(pos = new Float32Array(this.H.n * 3), nor = new Float32Array(this.H.n * 3)) {
    const H = this.H, E = this.B.map((m) => m.elements);
    for (let i = 0; i < H.n; i++) {
      const px = H.pos[i * 3], py = H.pos[i * 3 + 1], pz = H.pos[i * 3 + 2], nx = H.nor[i * 3], ny = H.nor[i * 3 + 1], nz = H.nor[i * 3 + 2];
      let x = 0, y = 0, z = 0, X = 0, Y = 0, Z = 0;
      for (let j = 0; j < 4; j++) {
        const w = H.sw[i * 4 + j]; if (w <= 0) continue; const e = E[H.si[i * 4 + j]];
        x += w * (e[0] * px + e[4] * py + e[8] * pz + e[12]); y += w * (e[1] * px + e[5] * py + e[9] * pz + e[13]); z += w * (e[2] * px + e[6] * py + e[10] * pz + e[14]);
        X += w * (e[0] * nx + e[4] * ny + e[8] * nz); Y += w * (e[1] * nx + e[5] * ny + e[9] * nz); Z += w * (e[2] * nx + e[6] * ny + e[10] * nz);
      }
      const l = Math.hypot(X, Y, Z) || 1; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; nor[i * 3] = X / l; nor[i * 3 + 1] = Y / l; nor[i * 3 + 2] = Z / l;
    }
    return { pos, nor };
  }
}
export const flexQ = (th, abd = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(th, abd, 0, 'YXZ')); // abducción (Y) y luego flexión (X)

/* ───────────────────────── sólidos (el arma) ───────────────────────── */

/** Triángulos de la capa 'b' (cuerpo) ya construidos en el Kit, en el espacio del arma. box = [x0,y0,z0,x1,y1,z1] recorta. */
export function collectSolids(k, box) {
  const out = [];
  for (const part of Object.values(k.parts)) {
    const off = part.pivot || { x: 0, y: 0, z: 0 };
    for (const g of part.b) {
      const a = g.attributes.position.array, ni = g.index ? null : 1; if (!ni) continue; // el Kit entrega geometría no indexada
      for (let i = 0; i < a.length; i += 9) {
        const t = [a[i] + off.x, a[i + 1] + off.y, a[i + 2] + off.z, a[i + 3] + off.x, a[i + 4] + off.y, a[i + 5] + off.z, a[i + 6] + off.x, a[i + 7] + off.y, a[i + 8] + off.z];
        if (box) { let ok = true; for (let v = 0; v < 3 && ok; v++) { const x = t[v * 3], y = t[v * 3 + 1], z = t[v * 3 + 2]; if (x < box[0] || y < box[1] || z < box[2] || x > box[3] || y > box[4] || z > box[5]) ok = false; } if (!ok) { let any = false; for (let v = 0; v < 3; v++) { const x = t[v * 3], y = t[v * 3 + 1], z = t[v * 3 + 2]; if (x >= box[0] && y >= box[1] && z >= box[2] && x <= box[3] && y <= box[4] && z <= box[5]) any = true; } if (!any) continue; } }
        out.push(...t);
      }
    }
  }
  return Float32Array.from(out);
}

/** Distancia al cuadrado de un punto a un triángulo (Ericson). */
function dTri2(px, py, pz, a, i) {
  const ax = a[i], ay = a[i + 1], az = a[i + 2], bx = a[i + 3], by = a[i + 4], bz = a[i + 5], cx = a[i + 6], cy = a[i + 7], cz = a[i + 8];
  const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
  let qx, qy, qz;
  if (d1 <= 0 && d2 <= 0) { qx = ax; qy = ay; qz = az; }
  else {
    const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { qx = bx; qy = by; qz = bz; }
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); qx = ax + abx * v; qy = ay + aby * v; qz = az + abz * v; }
      else {
        const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) { qx = cx; qy = cy; qz = cz; }
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); qx = ax + acx * w; qy = ay + acy * w; qz = az + acz * w; }
          else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + d5 - d6); qx = bx + (cx - bx) * w; qy = by + (cy - by) * w; qz = bz + (cz - bz) * w; }
            else { const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w; }
          }
        }
      }
    }
  }
  const dx = px - qx, dy = py - qy, dz = pz - qz; return dx * dx + dy * dy + dz * dz;
}
/** Distancia (sin signo) de un punto a la malla de triángulos. */
export function distTris(tris, p, cap = 1) {
  let best = cap * cap; for (let i = 0; i < tris.length; i += 9) { const d = dTri2(p.x, p.y, p.z, tris, i); if (d < best) best = d; } return Math.sqrt(best);
}
/** Distancia con signo a un cilindro infinito: centro c, eje 'x'|'y'|'z', radio R. */
export function distCyl(c, axis, R) { return (p) => { const dx = p.x - c[0], dy = p.y - c[1], dz = p.z - c[2]; const r = axis === 'z' ? Math.hypot(dx, dy) : axis === 'y' ? Math.hypot(dx, dz) : Math.hypot(dy, dz); return r - R; }; }

/**
 * Cierra un dedo («hasta tocar»): sube la flexión de cada articulación hasta que su falange toque el objeto.
 * dist(p) = distancia al objeto · rad = radio del dedo · base = flexión inicial [MCP, PIP, DIP] · max = tope · step = paso (rad).
 * Devuelve los ángulos. Modifica pose.q del dedo y deja la pose actualizada.
 */
export function closeFinger(pose, fi, dist, { rad, base = [0.15, 0.2, 0.1], max = [1.45, 1.75, 1.25], step = 0.05, abd = 0, flexAxisSign = 1 }) {
  const b = FINGERS[FNAMES[fi]], ang = base.slice(), A = V(), B = V(), P = V();
  const apply = () => { for (let j = 0; j < 3; j++) pose.q[b[j]].copy(flexQ(ang[j] * flexAxisSign, j === 0 ? abd : 0)); pose.update(); };
  const touches = (j) => {
    pose.joint(b[j], A); if (j < 2) pose.joint(b[j + 1], B); else pose.tip(fi, B);
    for (let s = 0; s <= 5; s++) { P.lerpVectors(A, B, s / 5); if (dist(P) < rad) return true; } return false;
  };
  apply();
  for (let j = 0; j < 3; j++) {
    let guard = 0;
    while (ang[j] < max[j] && guard++ < 80) { ang[j] += step; apply(); if (touches(j)) { ang[j] -= step * 0.35; apply(); break; } }
  }
  return ang;
}

/** Cinemática inversa CCD de la cadena del pulgar hacia un objetivo (espacio de resolución). */
export function ikThumb(pose, target, { iters = 14, limits = [1.1, 1.0, 0.9] } = {}) {
  const b = FINGERS.thumb, J = V(), T = V(), v1 = V(), v2 = V(), qd = new THREE.Quaternion(), pw = new THREE.Quaternion(), pwi = new THREE.Quaternion(), loc = new THREE.Quaternion(), idq = new THREE.Quaternion();
  for (let it = 0; it < iters; it++) {
    for (let j = 2; j >= 0; j--) {
      pose.update(); pose.joint(b[j], J); pose.tip(0, T);
      v1.copy(T).sub(J).normalize(); v2.copy(target).sub(J).normalize(); qd.setFromUnitVectors(v1, v2);
      const par = bones[b[j]].parent; pw.setFromRotationMatrix(_m.extractRotation(pose.W[par])); pwi.copy(pw).invert();
      // la escala uniforme de la raíz no afecta la rotación (extractRotation la normaliza)
      loc.copy(pwi).multiply(qd).multiply(pw).multiply(pose.q[b[j]]);
      const ang = 2 * Math.acos(Math.min(1, Math.abs(loc.w))); if (ang > limits[j]) loc.slerp(idq, 1 - limits[j] / ang);
      pose.q[b[j]].copy(loc);
    }
  }
  pose.update(); return pose.tip(0).distanceTo(target);
}

/**
 * Pulgar: búsqueda estocástica (recocido simple) de los ángulos de sus 3 articulaciones para que la yema llegue al objetivo SIN atravesar el arma.
 * dist(p) = distancia al objeto · target = punto de la yema · rad = radio del pulgar. Determinista (semilla fija). Parte de la solución de ikThumb.
 */
export function fitThumb(pose, dist, target, { rad = 0.014, iters = 360, seed = 7 } = {}) {
  const b = FINGERS.thumb, E = new THREE.Euler(), A = V(), B = V(), P = V();
  let st = seed >>> 0; const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.7;
  const LIM = [[-1.2, 1.2], [-1.0, 1.0], [-1.0, 1.0], [-0.3, 1.3], [-0.5, 0.5], [-0.3, 1.3]];
  const apply = (p) => { pose.q[b[0]].setFromEuler(E.set(p[0], p[1], p[2])); pose.q[b[1]].setFromEuler(E.set(p[3], 0, p[4])); pose.q[b[2]].setFromEuler(E.set(p[5], 0, 0)); pose.update(); };
  const cost = (p) => {
    apply(p); let c = 0; pose.tip(0, B); c += 10 * B.distanceTo(target);
    const J = [pose.joint(b[0], V()), pose.joint(b[1], V()), pose.joint(b[2], V()), B.clone()];
    for (let s = 0; s < 3; s++) for (let i = 1; i <= 4; i++) { P.lerpVectors(J[s], J[s + 1], i / 4); const d = dist(P); if (d < rad) c += 40 * (rad - d); }
    for (let i = 0; i < 6; i++) c += 0.015 * Math.abs(p[i]);
    return c;
  };
  let best = [0, 0, 0, 0.2, 0, 0.2], bc = cost(best);
  for (let it = 0; it < iters; it++) {
    const sg = 0.35 * (1 - it / iters) + 0.03, cand = best.map((v, i) => { const x = rnd() < 0.45 ? v + gauss() * sg : v; return Math.min(LIM[i][1], Math.max(LIM[i][0], x)); }), c = cost(cand);
    if (c < bc) { bc = c; best = cand; }
  }
  apply(best); void A; return { cost: bc, tipErr: pose.tip(0).distanceTo(target) };
}

/** Rejilla espacial de triángulos para consultar la distancia sin recorrerlos todos. */
export class TriGrid {
  constructor(tris, cell = 0.02) {
    this.t = tris; this.c = cell; this.m = new Map(); const n = tris.length / 9; this.stamp = new Int32Array(n); this.cur = 0;
    for (let i = 0; i < n; i++) {
      let x0 = 9, y0 = 9, z0 = 9, x1 = -9, y1 = -9, z1 = -9;
      for (let v = 0; v < 3; v++) { const x = tris[i * 9 + v * 3], y = tris[i * 9 + v * 3 + 1], z = tris[i * 9 + v * 3 + 2]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      for (let a = Math.floor(x0 / cell); a <= Math.floor(x1 / cell); a++) for (let b = Math.floor(y0 / cell); b <= Math.floor(y1 / cell); b++) for (let d = Math.floor(z0 / cell); d <= Math.floor(z1 / cell); d++) { const k = ((a + 512) << 20) | ((b + 512) << 10) | (d + 512); let l = this.m.get(k); if (!l) this.m.set(k, (l = [])); l.push(i); }
    }
  }
  /** Distancia (sin signo) al triángulo más cercano; devuelve `cap` si no hay ninguno dentro del radio. */
  dist(p, cap = 0.06) {
    const c = this.c, r = Math.ceil(cap / c), ax = Math.floor(p.x / c), ay = Math.floor(p.y / c), az = Math.floor(p.z / c); let best = cap * cap; this.cur++;
    for (let a = ax - r; a <= ax + r; a++) for (let b = ay - r; b <= ay + r; b++) for (let d = az - r; d <= az + r; d++) {
      const l = this.m.get(((a + 512) << 20) | ((b + 512) << 10) | (d + 512)); if (!l) continue;
      for (let j = 0; j < l.length; j++) { const i = l[j]; if (this.stamp[i] === this.cur) continue; this.stamp[i] = this.cur; const dd = dTri2(p.x, p.y, p.z, this.t, i * 9); if (dd < best) best = dd; }
    }
    return Math.sqrt(best);
  }
}
