// Guante táctico y antebrazo corto: placas de cristal, correas, costuras luminosas, uñas, muñequera con pantallita,
// brazalete y manga. Todo se construye en el marco local de la mano (reposo) y se «pega» a cada hueso con su matriz de pose,
// así sigue a los dedos cuando se cierran. Se dibuja con el Kit en la capa 'g' (material de manos, ver handmat.js).
// Clases (kind): 1 placa de cristal · 2 correa/armadura · 3 costura luminosa · 4 manga · 5 piel/guante (malla orgánica) · 6 uña · 7 pantallita
// (+8 = pertenece al dedo índice, que se curva en el vértice).
import * as THREE from 'three';
import { FINGERS, REST, TIP, ARM } from './hand-rig.js';

export const K = { CRY: 1, ARM: 2, SEAM: 3, SLV: 4, ORG: 5, NAIL: 6, SCR: 7 };
const gr = (x) => { const v = Math.round(Math.min(1, x) * 255); return (v << 16) | (v << 8) | v; };
const V = (...a) => new THREE.Vector3(...a);

/** Altura del dorso (Y local) en (x, z) según la malla de reposo: evita que las placas floten o se hundan. */
export function surfY(H, x, z, r = 0.012) {
  let best = -9; for (let i = 0; i < H.n; i++) { const px = H.pos[i * 3], pz = H.pos[i * 3 + 2]; if (Math.abs(px - x) < r && Math.abs(pz - z) < r && H.nor[i * 3 + 1] > 0.2 && H.pos[i * 3 + 1] > best) best = H.pos[i * 3 + 1]; }
  return best < -8 ? 0.012 : best;
}
/** Eje y radios del antebrazo (marco local): centro en la muñeca y en el corte, dirección hacia el codo. */
export function armFrame(H) {
  const c = (z0, z1) => { let sx = 0, sy = 0, n = 0, mnx = 9, mxx = -9, mny = 9, mxy = -9; for (let i = 0; i < H.n; i++) { const z = H.pos[i * 3 + 2]; if (z < z0 || z > z1) continue; const x = H.pos[i * 3], y = H.pos[i * 3 + 1]; sx += x; sy += y; n++; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); } return { c: V(sx / n, sy / n, (z0 + z1) / 2), rx: (mxx - mnx) / 2, ry: (mxy - mny) / 2 }; };
  const a = c(-0.03, -0.01), b = c(-0.115, -0.1); const dir = b.c.clone().sub(a.c).normalize();
  return { c0: a.c, dir, rx0: a.rx, ry0: a.ry, rx1: b.rx, ry1: b.ry };
}

/** Pega lo que se dibuje dentro de fn al hueso b (matriz de reposo -> pose). */
const on = (T, pose, b, fn) => { T.push(pose.B[b]); fn(); T.pop(); };

/* ───────────── piezas que se adaptan a la malla (placas, correas, uñas) ───────────── */

/** Geometría (no indexada) de un subconjunto de triángulos de la malla posada. which = 'main' | 'index' (el índice va en otra pieza).
 *  off > 0 = «cáscara»: la superficie sube `off` por la normal y se cierra con un faldón (placas de cristal y correas que copian la mano). */
export function meshGeom(H, pose, which, sel, { off = 0, kind = K.ORG, tone = 1, organic = true, edge = 0 } = {}) {
  if (!pose._skin) pose._skin = pose.skin();
  const { pos, nor } = pose._skin;
  if (!H.idxV) { H.idxV = new Uint8Array(H.n); for (let i = 0; i < H.n; i++) { let w = 0; for (let j = 0; j < 4; j++) { const bb = H.si[i * 4 + j]; if (bb >= 4 && bb <= 6) w += H.sw[i * 4 + j]; } H.idxV[i] = w > 0.02 ? 1 : 0; } }
  const isI = which === 'index', tris = [];
  for (let t = 0; t < H.tris; t++) { const a = H.ix[t * 3], b = H.ix[t * 3 + 1], c = H.ix[t * 3 + 2]; if (!sel(a, b, c)) continue; if ((isI) === !!(H.idxV[a] || H.idxV[b] || H.idxV[c])) tris.push(t); }
  if (!tris.length) return null;
  const out = [], push = (v, p, n, flat) => out.push({ v, p, n });
  const S = pose.root.getMaxScaleOnAxis(), o = off * S, kd = kind + (isI ? 8 : 0);
  const P3 = (v, k) => [pos[v * 3] + (k ? nor[v * 3] * o : 0), pos[v * 3 + 1] + (k ? nor[v * 3 + 1] * o : 0), pos[v * 3 + 2] + (k ? nor[v * 3 + 2] * o : 0)];
  const edges = new Map(), key = (a, b) => (a < b ? a * 65536 + b : b * 65536 + a);
  for (const t of tris) for (let e = 0; e < 3; e++) { const a = H.ix[t * 3 + e], b = H.ix[t * 3 + (e + 1) % 3], kk = key(a, b); const r = edges.get(kk); if (r) r.n++; else edges.set(kk, { a, b, n: 1, t }); }
  const verts = []; // {p, n, v}
  for (const t of tris) for (let c = 0; c < 3; c++) { const v = H.ix[t * 3 + c]; verts.push({ p: P3(v, off > 0), n: [nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]], v }); }
  if (off > 0) for (const e of edges.values()) { // faldón en el borde de la placa
    if (e.n !== 1) continue; const A0 = P3(e.a, false), B0 = P3(e.b, false), A1 = P3(e.a, true), B1 = P3(e.b, true);
    const ex = [B1[0] - A1[0], B1[1] - A1[1], B1[2] - A1[2]], ey = [A0[0] - A1[0], A0[1] - A1[1], A0[2] - A1[2]];
    let nn = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]]; const l = Math.hypot(...nn) || 1; nn = nn.map((x) => x / l);
    // el faldón debe mirar hacia afuera de la placa: opuesto al centro del triángulo vecino
    const t = e.t, cx = [0, 0, 0]; for (let c = 0; c < 3; c++) { const v = H.ix[t * 3 + c]; cx[0] += pos[v * 3] / 3; cx[1] += pos[v * 3 + 1] / 3; cx[2] += pos[v * 3 + 2] / 3; }
    const mid = [(A1[0] + B1[0]) / 2, (A1[1] + B1[1]) / 2, (A1[2] + B1[2]) / 2], out2 = [mid[0] - cx[0], mid[1] - cx[1], mid[2] - cx[2]];
    const flip = nn[0] * out2[0] + nn[1] * out2[1] + nn[2] * out2[2] < 0;
    const mk = (p, v) => ({ p, n: nn, v, k: edge ? edge + (isI ? 8 : 0) : kd });
    const quad = flip ? [mk(A1, e.a), mk(A0, e.a), mk(B1, e.b), mk(B1, e.b), mk(A0, e.a), mk(B0, e.b)] : [mk(A1, e.a), mk(B1, e.b), mk(A0, e.a), mk(B1, e.b), mk(B0, e.b), mk(A0, e.a)];
    // el sentido se corrige abajo comparando la normal geométrica con nn
    for (let i = 0; i < 6; i += 3) { const [p0, p1, p2] = [quad[i].p, quad[i + 1].p, quad[i + 2].p]; const u = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], w = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]]; const gn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; if (gn[0] * nn[0] + gn[1] * nn[1] + gn[2] * nn[2] < 0) { const x = quad[i + 1]; quad[i + 1] = quad[i + 2]; quad[i + 2] = x; } }
    verts.push(...quad);
  }
  const m = verts.length, P = new Float32Array(m * 3), N = new Float32Array(m * 3), C = new Float32Array(m * 3), KD = new Float32Array(m).fill(kd), AX = new Float32Array(m), RS = new Float32Array(m * 4), FW = isI ? new Float32Array(m * 3) : null;
  verts.forEach((q, i) => { KD[i] = q.k ?? kd; P.set(q.p, i * 3); N.set(q.n, i * 3); if (organic) C.set(H.uvm.subarray(q.v * 3, q.v * 3 + 3), i * 3); else C.fill(tone, i * 3, i * 3 + 3); AX[i] = H.aux[q.v]; RS.set(H.rs.subarray(q.v * 4, q.v * 4 + 4), i * 4);
    if (FW) for (let j = 0; j < 4; j++) { const bb = H.si[q.v * 4 + j]; if (bb >= 4 && bb <= 6) FW[i * 3 + (bb - 4)] += H.sw[q.v * 4 + j]; } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('kind', new THREE.BufferAttribute(KD, 1)); g.setAttribute('aux', new THREE.BufferAttribute(AX, 1)); g.setAttribute('rs', new THREE.BufferAttribute(RS, 4));
  if (FW) g.setAttribute('fw', new THREE.BufferAttribute(FW, 3));
  return g;
}

/**
 * Todas las piezas de una parte de la mano ('main' = todo menos el índice · 'index' = sólo el índice): piel/guante orgánico
 * (las placas de armadura, correas y tendones se PINTAN en el shader sobre la malla, ver handmat.js), cristales de nudillos y del dorso,
 * uñas y (en 'main') muñequera + pantallita + brazalete + manga.
 */
export function handGeoms(T, H, pose, which, { arm = true } = {}) {
  const low = T.q.low, out = [], add = (g) => { if (g) out.push(g); }, isI = which === 'index';
  add(meshGeom(H, pose, which, () => true));                                       // piel / guante (+ placas pintadas)
  // cristales facetados en los nudillos (siguen al hueso de cada dedo) y en las falanges medias (sólo Alta)
  const ik = (k, j) => k + (isI ? 8 + 16 * j : 0), thumbBones = FINGERS.thumb;
  for (let f = 1; f < 5; f++) {
    if (isI !== (f === 1)) continue;
    const b = FINGERS[['thumb', 'index', 'middle', 'ring', 'pinky'][f]], sc = f === 4 ? 0.8 : f === 3 ? 0.92 : 1, p1 = REST[b[0]], p2 = REST[b[1]];
    T.push(pose.B[b[0]]);
    T.poly('g', 'oct', 0.0072 * sc, [p1.x, p1.y + 0.0075 * sc, p1.z + 0.003], { k: ik(K.CRY, 0), s: [0.95, 0.4, 1.5], u: 1.1, c: gr(1) });
    T.pop();
  }
  if (!isI) {
    T.push(pose.B[thumbBones[1]]); const p = REST[thumbBones[1]]; T.poly('g', 'oct', 0.0088, [p.x + 0.003, p.y + 0.0092, p.z + 0.002], { k: K.CRY, s: [1.3, 0.42, 1.5], r: [0, 0.6, 0], u: 0.9, c: gr(1) }); T.pop();
    // gema central del dorso, sobre la placa pintada
    T.push(pose.B[0]); const sy = surfY(H, -0.001, 0.057, 0.008); T.poly('g', 'oct', 0.0125, [-0.001, sy + 0.0035, 0.057], { k: K.CRY, s: [0.9, 0.34, 1.55], u: 1.0, c: gr(1) }); T.pop();
  }
  // uñas: lámina brillante sobre la yema
  for (let fi = 0; fi < 5; fi++) {
    if (isI !== (fi === 1)) continue;
    const b = FINGERS[['thumb', 'index', 'middle', 'ring', 'pinky'][fi]], p3 = REST[b[2]], sc = fi === 4 ? 0.82 : fi === 3 ? 0.94 : fi === 0 ? 1.12 : 1;
    T.push(pose.B[b[2]]);
    const dirv = TIP[fi].clone().sub(p3), c = p3.clone().addScaledVector(dirv, 0.6); c.y += fi === 0 ? 0.0088 : 0.0072 * sc;
    const kd = K.NAIL + (isI ? 8 + 32 : 0);
    if (low) T.poly('g', 'tet', 0.0072 * sc, [c.x, c.y, c.z], { k: kd, s: [0.8, 0.34, 1.3], u: 1.95, c: gr(1) }); else T.sph('g', 0.0064 * sc, [c.x, c.y - 0.0006, c.z], { k: kd, s: [0.85, 0.3, 1.25], u: 1.95, c: gr(1), seg: 6 });
    T.pop();
  }
  if (!isI && arm) armGear(T, pose, H, low);
  return [...out, ...T.parts.h.g];
}

/** Muñequera + pantallita + brazalete + manga, alineados con el eje del antebrazo de la malla. */
function armGear(T, pose, H, low) {
  const A = armFrame(H), d = A.dir.clone(), up = V(0, 1, 0).sub(d.clone().multiplyScalar(d.y)).normalize(), side = V().crossVectors(up, d).normalize();
  const at = (t, h = 0, s = 0) => A.c0.clone().addScaledVector(d, t).addScaledVector(up, h).addScaledVector(side, s);
  const qb = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, d.clone().negate()));
  const lerpR = (a, b, t) => a + (b - a) * Math.min(1.3, t / 0.11);
  const rx = (t) => lerpR(A.rx0, A.rx1, t) + 0.0035, ry = (t) => lerpR(A.ry0, A.ry1, t) + 0.0035;
  const basis = new THREE.Matrix4().makeBasis(side, d, up.clone().negate()); // X->lado, Y->eje del brazo (hacia el codo), Z->abajo
  on(T, pose, ARM, () => {
    // anillo/tubo alrededor del antebrazo entre t0 y t1 (grow = holgura sobre la piel; r0/r1 = relación de radio en cada extremo)
    const band = (t0, t1, grow, kind, c, u, { r0 = 1, r1 = 1, flow = null } = {}) => {
      const t = (t0 + t1) / 2, rm = rx(t) + grow, rym = ry(t) + grow;
      T.push(new THREE.Matrix4().makeTranslation(...at(t).toArray()).multiply(basis).multiply(new THREE.Matrix4().makeScale(rm / 0.03, (t1 - t0) / 0.06, rym / 0.03)));
      T.cyl('g', [0.03 * r1, 0.03 * r0, 0.06], [0, 0, 0], { axis: 'y', k: kind, c, seg: low ? 10 : 16, u, flow: flow ? [flow[0], flow[1], 'y', 0.06] : null, open: kind === K.SEAM });
      T.pop();
    };
    // — muñequera: correa mate con hebilla y dos hilos luminosos
    band(0.010, 0.036, 0.0016, K.ARM, gr(0.75), -0.3);
    band(0.0095, 0.0112, 0.0021, K.SEAM, gr(1), -0.3); band(0.0348, 0.0365, 0.0021, K.SEAM, gr(1), -0.3);
    T.box('g', [0.016, 0.0085, 0.014], at(0.023, ry(0.023) + 0.0042).toArray(), { k: K.ARM, c: gr(1), q: qb, sharp: true, u: -0.3 });
    // — pantallita de muñeca: marco, cristal con HUD (barras, ojo, barrido)
    const pc = at(0.07, ry(0.07) + 0.0034), W = 0.036, Hh = 0.04;
    T.box('g', [W + 0.008, 0.0065, Hh + 0.008], pc.toArray(), { k: K.ARM, c: gr(0.9), q: qb, rad: 0.0035, u: -0.6 });
    const pg = new THREE.PlaneGeometry(W, Hh); const pp = pg.attributes.position, rs = new Float32Array(pp.count * 4);
    for (let i = 0; i < pp.count; i++) { rs[i * 4] = pp.getX(i) / (W / 2); rs[i * 4 + 1] = -pp.getY(i) / (Hh / 2); rs[i * 4 + 3] = -3; }
    pg.setAttribute('rs', new THREE.BufferAttribute(rs, 4)); pg.rotateX(-Math.PI / 2);
    T.put('g', pg, at(0.07, ry(0.07) + 0.0071).toArray(), { k: K.SCR, c: gr(1), q: qb, u: -0.6 });
    for (const sg of [-1, 1]) T.box('g', [0.003, 0.0042, Hh + 0.006], at(0.07, ry(0.07) + 0.0068, sg * (W / 2 + 0.0055)).toArray(), { k: K.SEAM, c: gr(1), q: qb, sharp: true, u: -0.6 });
    // — manga corta: tubo que se deshace en polvo de cristal hacia el codo (el final nunca se ve como un corte; no domina la vista)
    const m0 = 0.112, m1 = 0.38, mm = (m0 + m1) / 2, rr = (t) => (rx(t) + 0.0055) / (rx(mm) + 0.0055);
    T.push(new THREE.Matrix4().makeTranslation(...at(mm).toArray()).multiply(basis).multiply(new THREE.Matrix4().makeScale((rx(mm) + 0.0055) / 0.03, (m1 - m0) / 0.06, (ry(mm) + 0.0055) / 0.03)));
    T.cyl('g', [0.03 * Math.min(1.2, rr(m1)), 0.03 * rr(m0), 0.06], [0, 0, 0], { axis: 'y', k: K.SLV, c: gr(1), seg: low ? 10 : 18, u: -1.0, flow: [0, 1, 'y', 0.06], open: true });
    T.pop();
    // — brazalete: aro de armadura con un filo luminoso fino y un cristal (sin picos)
    band(0.098, 0.126, 0.0072, K.ARM, gr(0.8), -0.8); band(0.1255, 0.1285, 0.0079, K.SEAM, gr(1), -0.8);
    T.poly('g', 'oct', 0.0105, at(0.112, ry(0.112) + 0.0088).toArray(), { k: K.CRY, s: [0.9, 0.5, 1.9], q: qb, c: gr(1), u: -0.9 });
    if (!low) for (const sg of [-1, 1]) T.poly('g', 'oct', 0.0058, at(0.112, 0.0, sg * (rx(0.112) + 0.0085)).toArray(), { k: K.CRY, s: [0.5, 0.9, 1.7], q: qb, c: gr(1), u: -0.9 });
  });
}
