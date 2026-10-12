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
  const m = verts.length, P = new Float32Array(m * 3), N = new Float32Array(m * 3), C = new Float32Array(m * 3), KD = new Float32Array(m).fill(kd), AX = new Float32Array(m), FW = isI ? new Float32Array(m * 3) : null;
  verts.forEach((q, i) => { KD[i] = q.k ?? kd; P.set(q.p, i * 3); N.set(q.n, i * 3); if (organic) C.set(H.uvm.subarray(q.v * 3, q.v * 3 + 3), i * 3); else C.fill(tone, i * 3, i * 3 + 3); AX[i] = H.aux[q.v];
    if (FW) for (let j = 0; j < 4; j++) { const bb = H.si[q.v * 4 + j]; if (bb >= 4 && bb <= 6) FW[i * 3 + (bb - 4)] += H.sw[q.v * 4 + j]; } });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('kind', new THREE.BufferAttribute(KD, 1)); g.setAttribute('aux', new THREE.BufferAttribute(AX, 1));
  if (FW) g.setAttribute('fw', new THREE.BufferAttribute(FW, 3));
  return g;
}

/**
 * Todas las piezas de una parte de la mano ('main' = todo menos el índice · 'index' = sólo el índice): piel/guante orgánico,
 * placas de cristal y correas adaptadas a la malla, uñas y (en 'main') muñequera + pantallita + brazalete + manga.
 */
export function handGeoms(T, H, pose, which, { arm = true } = {}) {
  const low = T.q.low, out = [], add = (g) => { if (g) out.push(g); }, isI = which === 'index';
  // criterio sobre el CENTRO del triángulo (más estable que vértice a vértice): x, y, z de reposo, normal-y, flujo y dedo
  const C = (a, b, c) => ({ x: (H.pos[a * 3] + H.pos[b * 3] + H.pos[c * 3]) / 3, y: (H.pos[a * 3 + 1] + H.pos[b * 3 + 1] + H.pos[c * 3 + 1]) / 3, z: (H.pos[a * 3 + 2] + H.pos[b * 3 + 2] + H.pos[c * 3 + 2]) / 3,
    ny: (H.nor[a * 3 + 1] + H.nor[b * 3 + 1] + H.nor[c * 3 + 1]) / 3, nx: (H.nor[a * 3] + H.nor[b * 3] + H.nor[c * 3]) / 3, aux: (H.aux[a] + H.aux[b] + H.aux[c]) / 3, f: H.fing[a] === H.fing[b] || H.fing[a] === H.fing[c] ? H.fing[a] : H.fing[b] });
  const where = (fn) => (a, b, c) => fn(C(a, b, c));
  add(meshGeom(H, pose, which, () => true));                                       // piel / guante
  // placa dorsal: armadura oscura adaptada a los metacarpianos con el borde luminoso
  add(meshGeom(H, pose, which, where((c) => c.f < 0 && c.ny > 0.45 && c.z > 0.034 && c.z < 0.075 && c.x > -0.03 && c.x < 0.028), { off: 0.0036, kind: K.ARM, tone: 0.95, organic: false, edge: K.SEAM }));
  // correa de muñeca (alrededor) y de nudillos (por el dorso)
  add(meshGeom(H, pose, which, where((c) => c.f < 0 && c.z > 0.006 && c.z < 0.022), { off: 0.0026, kind: K.ARM, tone: 0.8, organic: false }));
  add(meshGeom(H, pose, which, where((c) => c.ny > 0.1 && c.z > 0.08 && c.z < 0.092 && c.x > -0.046 && c.x < 0.04 && (c.f < 1 || c.aux < 1.12)), { off: 0.0024, kind: K.ARM, tone: 0.8, organic: false }));
  // cristales facetados en los nudillos y en las falanges medias (siguen al hueso de cada dedo)
  const ik = (k, j) => k + (isI ? 8 + 16 * j : 0), thumbBones = FINGERS.thumb;
  for (let f = 1; f < 5; f++) {
    if (isI !== (f === 1)) continue;
    const b = FINGERS[['thumb', 'index', 'middle', 'ring', 'pinky'][f]], sc = f === 4 ? 0.82 : f === 3 ? 0.94 : 1, p1 = REST[b[0]], p2 = REST[b[1]];
    T.push(pose.B[b[0]]);
    T.poly('g', 'oct', 0.0098 * sc, [p1.x, p1.y + 0.0108 * sc, p1.z + 0.004], { k: ik(K.CRY, 0), s: [1.0, 0.45, 1.5], u: 1.1, c: gr(1) });
    T.pop(); T.push(pose.B[b[1]]);
    if (!low || f === 1) T.poly('g', 'oct', 0.0074 * sc, [p2.x, p2.y + 0.0088 * sc, p2.z + 0.005], { k: ik(K.CRY, 1), s: [1.0, 0.4, 1.5], u: 1.4, c: gr(1) });
    T.pop();
  }
  if (!isI) {
    T.push(pose.B[thumbBones[1]]); const p = REST[thumbBones[1]]; T.poly('g', 'oct', 0.0105, [p.x + 0.003, p.y + 0.0105, p.z + 0.002], { k: K.CRY, s: [1.3, 0.45, 1.5], r: [0, 0.6, 0], u: 0.9, c: gr(1) }); T.pop();
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
  const rx = (t) => A.rx0 + (A.rx1 - A.rx0) * Math.min(1, t / 0.11) + 0.0035, ry = (t) => A.ry0 + (A.ry1 - A.ry0) * Math.min(1, t / 0.11) + 0.0035;
  on(T, pose, ARM, () => {
    // — muñequera (correa) con hebilla
    const band = (t0, t1, grow, kind, c, u) => {
      const t = (t0 + t1) / 2, geo = { s: [(rx(t) + grow) / 0.03, (t1 - t0) / 0.06, (ry(t) + grow) / 0.03] };
      // el cilindro unitario tiene su eje en Y; lo giramos para que Y apunte a lo largo de `d` y su elipse use side/up
      const m = new THREE.Matrix4().makeBasis(side, d, up.clone().negate()); // X->lado, Y->eje del brazo, Z->abajo (mano derecha)
      T.push(new THREE.Matrix4().makeTranslation(...at(t).toArray()).multiply(m).multiply(new THREE.Matrix4().makeScale(...geo.s)));
      T.cyl('g', [0.03, 0.03, 0.06], [0, 0, 0], { axis: 'y', k: kind, c, seg: low ? 9 : 14, u });
      T.pop();
    };
    band(0.012, 0.034, 0.0016, K.ARM, gr(0.75), -0.3);
    T.box('g', [0.016, 0.0095, 0.012], at(0.023, ry(0.023) + 0.0045).toArray(), { k: K.ARM, c: gr(1), q: qb, sharp: true, u: -0.3 });
    // — pantallita de muñeca (marco + cristal oscuro con píxeles + costuras)
    const pc = at(0.07, ry(0.07) + 0.0036);
    T.box('g', [0.046, 0.0075, 0.05], pc.toArray(), { k: K.ARM, c: gr(0.9), q: qb, rad: 0.004, u: -0.6 });
    T.box('g', [0.036, 0.0062, 0.04], at(0.07, ry(0.07) + 0.0082).toArray(), { k: K.SCR, c: gr(1), q: qb, rad: 0.002, u: -0.6 });
    for (const sg of [-1, 1]) T.box('g', [0.0034, 0.0046, 0.046], at(0.07, ry(0.07) + 0.0075, sg * 0.0235).toArray(), { k: K.SEAM, c: gr(1), q: qb, sharp: true, u: -0.6 });
    // — manga (tela) bajo el brazalete, acampanada, con aro luminoso
    const t0 = 0.098, t1 = 0.2, tm = (t0 + t1) / 2, flare = 1.1;
    T.push(new THREE.Matrix4().makeTranslation(...at(tm).toArray()).multiply(new THREE.Matrix4().makeBasis(side, d, up.clone().negate())).multiply(new THREE.Matrix4().makeScale((rx(0.1) + 0.006) * flare / 0.03, (t1 - t0) / 0.06, (ry(0.1) + 0.006) * flare / 0.03)));
    T.cyl('g', [0.03, 0.037, 0.06], [0, 0, 0], { axis: 'y', k: K.SLV, c: gr(1), seg: low ? 9 : 14, u: -1.0 });
    T.pop();
    T.push(new THREE.Matrix4().makeTranslation(...at(t0 - 0.002).toArray()).multiply(new THREE.Matrix4().makeBasis(side, up, d)).multiply(new THREE.Matrix4().makeScale((rx(0.1) + 0.006) * flare, (ry(0.1) + 0.006) * flare, 0.03)));
    T.tor('g', [1, 0.095], [0, 0, 0], { k: K.SEAM, c: gr(1), seg: low ? 12 : 20 }); T.pop();
    // — brazalete de armadura: dos placas laterales + vientre, abierto por el dorso, con costura luminosa y un cristal
    const b0 = 0.108, b1 = 0.18, bm = (b0 + b1) / 2, bl = b1 - b0;
    for (const sg of [-1, 1]) {
      T.box('g', [0.0072, (ry(bm) * 2 + 0.006) * 0.8, bl], at(bm, -ry(bm) * 0.1, sg * (rx(bm) + 0.0075)).toArray(), { k: K.ARM, c: gr(0.8), q: qb, rad: 0.003, u: -0.8 });
      T.box('g', [0.003, 0.003, bl * 0.96], at(bm, ry(bm) * 0.45, sg * (rx(bm) + 0.0085)).toArray(), { k: K.SEAM, c: gr(1), q: qb, sharp: true, u: -0.8 });
    }
    T.box('g', [rx(bm) * 1.5, 0.0068, bl], at(bm, -ry(bm) - 0.005).toArray(), { k: K.ARM, c: gr(0.7), q: qb, rad: 0.003, u: -0.8 });
    T.poly('g', 'oct', 0.012, at(0.155, ry(0.155) + 0.011).toArray(), { k: K.CRY, s: [1, 0.6, 1.9], q: qb, c: gr(1), u: -0.9 });
  });
}
