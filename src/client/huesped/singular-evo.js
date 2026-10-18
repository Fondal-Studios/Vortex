// EVOLUCIÓN VISIBLE de Singular: una pieza FÍSICA y propia por cada camino de EVO_PATHS (los mismos ids que usa toda la simulación; la lectura de cada uno está en data.js → EVO_FLAVOR.singular):
//   nivel 1  depredador «Devoradora de Mundos» → colmillos de vidrio negro que se cierran alrededor de la estrella del pecho + colmillos en los hombros (y una luna más)
//            coraza «Corteza Estelar» → losas continentales sobre los hombros y un gran disco de roca con cráteres y borde de oro a la espalda
//   nivel 2  velocidad «Perihelio» → colas de cometa (cintas con física) desde hombros y codos (y los anillos giran un 50 % más rápido, ver singular.js)
//            resonancia «Resonancia Gravitatoria» → corona de cristales que vibran girando alrededor del torso, con anillo de runas
//   nivel 3  simbiosis «Anillo de Acreción» → disco de acreción enorme alrededor de la cintura con plasma, antebrazo derecho cristalizado (y una luna más)
//            artilleria «Cañón de Marea» → dos cañones de roca y cristal sobre los hombros con bobinas de oro y esfera de carga
//   nivel 4  apoteosis «Supernova Interior» → explosión radial de rayos de oro a la espalda y corona de eclipse con rayos larguísimos
//            anomalia «Singularidad Desnuda» → el pecho se abre a un vacío negro con anillos de fotones, esquirlas negras en órbita y rayos violeta sobre el cuerpo
// Todo reutiliza los materiales del kit (ember/light/spirit/mirror/stone/crystal): casi no suma llamadas de dibujo, sólo triángulos (Baja recorta lo fino).
import * as T from 'three';
import { V } from '../huesped-piezas.js';
import { uBeat } from '../shaders.js';

export const PAL = { ROC: 0x3c3250, ROC_D: 0x221a30, ROC_L: 0x62547c, CRY: 0x1d1034, CRY_V: 0x6a30c8, VIO: 0xa05cff, VIO_L: 0xd8b8ff, ORO: 0xffc23a, ORO_L: 0xffeaa6, NEG: 0x07040e };
const { ROC, ROC_D, ROC_L, CRY_V, VIO, VIO_L, ORO, ORO_L, NEG } = PAL;
const TAU = Math.PI * 2;
/** Gradiente radial de un disco (centro → borde): color por vértice. */
export const radial = (r0, r1, cA, cB) => { const a = new T.Color(cA), b = new T.Color(cB), o = new T.Color(0); return (x, y, z) => { const r = Math.hypot(x, z), k = Math.min(1, Math.max(0, (r - r0) / (r1 - r0))); return o.copy(a).lerp(b, Math.pow(k, 0.7)).getHex(); }; };
/** Anillo plano (disco) en el plano XZ. */
export const disc = (r0, r1, seg = 32) => new T.RingGeometry(r0, r1, seg, 1).rotateX(-Math.PI / 2);

export function addEvolucionSingular(ak, ctx, o = {}) {
  if (!ctx.evo) return { update() {} };
  const { t, upd, has } = o, { G, X, spikeAt, seam, limb, cuff, bonelump, S, low } = t, P = (n) => ak.P(n), add = ak.add, Y = V(0, 1, 0), Zv = V(0, 0, 1), R = t.rng(77);
  const CC = V(0, 1.285, 0.172), HUB = V(0, 1.22, 0.02), mine = [];

  // ═════════════ NIVEL 1
  if (has('depredador')) {
    const n = low ? 6 : 8;
    for (let i = 0; i < n; i++) { // mandíbula de colmillos de vidrio negro cerrándose sobre la estrella
      const a = (i / n) * TAU + 0.2, r = 0.27, base = V(CC.x + Math.cos(a) * r, CC.y + Math.sin(a) * r, CC.z - 0.03), dir = V(-Math.cos(a) * 0.7, -Math.sin(a) * 0.7, 0.55), L = 0.16 + 0.04 * (i % 2);
      add('mirror', spikeAt(base, dir, L, 0.02, 0.025, Zv, { radial: S(5, 4) }), 'spine01', { color: 0x120c22 });
      add('ember', spikeAt(base.clone().addScaledVector(dir.clone().normalize(), 0.02), dir, L * 0.62, 0.0036, 0.015, Zv, { radial: 3, tubular: 3 }), 'spine01', { color: ORO });
    }
    ak.both(() => { // colmillos en los hombros
      const S0 = P('upperarm01');
      add('mirror', spikeAt(S0.clone().add(V(0.07, 0.15, -0.04)), V(0.5, 1, -0.7), 0.36, 0.034, 0.12, V(0, 0, -1), { radial: S(6, 4) }), 'upperarm01', { color: 0x14102a });
      add('ember', spikeAt(S0.clone().add(V(0.075, 0.2, -0.05)), V(0.5, 1, -0.7), 0.26, 0.005, 0.09, V(0, 0, -1), { radial: 3, tubular: 4 }), 'upperarm01', { color: ORO });
    });
  }
  if (has('coraza')) {
    ak.both(() => { // losas continentales sobre los hombros, con grieta de oro
      const S0 = P('upperarm01');
      for (let k = 0; k < (low ? 2 : 3); k++) add('stone', X(bonelump(0.16 - 0.025 * k, [1.35, 0.5, 1.15], 70 + k, 0.26), { p: [S0.x + 0.05 + 0.012 * k, S0.y + 0.15 + 0.04 * k, S0.z], r: [0, 0.4 * k, -0.3 - 0.14 * k] }), 'upperarm01', { color: k % 2 ? ROC : ROC_L });
      add('ember', seam([S0.clone().add(V(-0.05, 0.2, 0.1)), S0.clone().add(V(0.05, 0.22, 0.02)), S0.clone().add(V(0.14, 0.2, -0.08))], 0.0034), 'upperarm01', { color: ORO });
    });
    // disco de roca vertical a la espalda (escudo): cráteres, grieta y borde de oro
    const ed = ak.bone('escudo', 'spine02', V(0, 1.2, -0.26));
    add('stone', X(G.cyl(0.42, 0.4, 0.07, S(30, 14)), { p: [0, 1.2, -0.26], r: [Math.PI / 2, 0, 0] }), 'escudo', { color: ROC_D });
    add('ember', X(G.torus(0.415, 0.0065, 3, S(40, 20)), { p: [0, 1.2, -0.296], r: [Math.PI / 2, 0, 0] }), 'escudo', { color: ORO });
    for (let i = 0; i < (low ? 5 : 8); i++) { const a = i * 2.4 + 0.5, rr = 0.06 + 0.26 * ((i * 7) % 5) / 5; add('stone', X(bonelump(0.045 + 0.02 * (i % 3), [1.2, 1.2, 0.5], 90 + i, 0.3), { p: [Math.cos(a) * rr, 1.2 + Math.sin(a) * rr, -0.31], r: [0, 0, a] }), 'escudo', { color: i % 2 ? ROC_L : ROC }); }
    add('ember', seam([V(-0.3, 1.32, -0.3), V(-0.1, 1.24, -0.31), V(0.08, 1.2, -0.31), V(0.28, 1.08, -0.3)], 0.0034), 'escudo', { color: VIO });
    upd.push((dt, tt) => { ed.rotation.z = 0.04 * Math.sin(tt * 0.6); });
  }

  // ═════════════ NIVEL 2
  if (has('velocidad')) { // colas de cometa: cintas de espíritu sobre cadenas con física (se arrastran al correr)
    const wisp = (name, parent, p0, dir, len, n, w, s, col) => {
      const d = dir.clone().normalize(), pts = []; for (let i = 0; i <= n; i++) pts.push(p0.clone().addScaledVector(d, len * (i / n)));
      ak.chain(name, parent, pts, { stiff: 0.07, damp: 0.93, gravity: 0.8, sway: 0.9 });
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[i + 1], dd = b.clone().sub(a), nn = V().crossVectors(dd, V(0, 1, 0)).normalize(), w0 = w * (1 - (i / n) * 0.8) * (i ? 1 : 0.5), w1 = w * (1 - ((i + 1) / n) * 0.8);
        const q = [a.clone().addScaledVector(nn, -w0), a.clone().addScaledVector(nn, w0), b.clone().addScaledVector(nn, -w1), b.clone().addScaledVector(nn, w1)], g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(q.flatMap((v) => [v.x, v.y, v.z]), 3)); g.setIndex([0, 1, 2, 2, 1, 3, 2, 1, 0, 3, 1, 2]); g.computeVertexNormals();
        const k0 = 0.08 + 0.55 * Math.pow(1 - i / n, 1.2), k1 = 0.08 + 0.55 * Math.pow(1 - (i + 1) / n, 1.2), c0 = new T.Color(col).multiplyScalar(k0), c1 = new T.Color(col).multiplyScalar(k1);
        add('spirit', g, `${name}_${s}${i}`, { color: (x, y, z) => (V(x, y, z).sub(a).dot(dd) / dd.lengthSq() > 0.5 ? c1 : c0) });
      }
    };
    ak.both((s) => {
      const S0 = P('upperarm01'), E0 = P('lowerarm01');
      wisp('cmA', 'upperarm01', S0.clone().add(V(0.09, 0.1, -0.1)), V(0.25, 0.1, -1), 1.0, low ? 5 : 7, 0.07, s, ORO);
      wisp('cmB', 'lowerarm01', E0.clone().add(V(0.04, 0, -0.06)), V(0.2, -0.1, -1), 0.8, low ? 4 : 6, 0.05, s, 0xa05cff);
    });
  }
  if (has('resonancia')) { // corona de cristales que vibran girando alrededor del torso + anillo de runas
    const rb = ak.bone('resR', 'spine02', HUB), nS = low ? 8 : 12;
    for (let i = 0; i < nS; i++) { const a = (i / nS) * TAU, r = 0.36 + 0.04 * (i % 2), y = HUB.y + 0.16 * (((i * 5) % 3) - 1), sz = 0.03 + 0.012 * (i % 3);
      add('crystal', X(new T.OctahedronGeometry(sz, 0), { p: [HUB.x + Math.cos(a) * r, y, HUB.z + Math.sin(a) * r], s: [0.7, 1.9, 0.7], r: [0.3, a, 0.2] }), 'resR', { color: i % 2 ? VIO : ORO_L }); }
    add('ember', G.torus(0.36, 0.0034, 3, S(40, 20)).translate(HUB.x, HUB.y + 0.17, HUB.z), 'resR', { color: VIO });
    add('ember', G.torus(0.36, 0.0034, 3, S(40, 20)).translate(HUB.x, HUB.y - 0.17, HUB.z), 'resR', { color: ORO });
    upd.push((dt, tt) => { rb.rotation.y = -tt * 0.85; rb.scale.setScalar(1 + 0.08 * uBeat.value); });
  }

  // ═════════════ NIVEL 3
  if (has('simbiosis')) {
    const C = V(0, 0.98, 0.02), ad = ak.bone('acrecion', 'spine05', C);
    add('spirit', X(disc(0.5, 0.98, S(56, 24)), { p: [C.x, C.y, C.z] }), 'acrecion', { color: radial(0.5, 0.98, 0x8a5a12, 0x1c0a48) });
    add('ember', G.torus(0.5, 0.004, 3, S(44, 22)).translate(C.x, C.y, C.z), 'acrecion', { color: ORO_L });
    add('ember', G.torus(0.78, 0.0036, 3, S(52, 26)).translate(C.x, C.y, C.z), 'acrecion', { color: VIO });
    for (let i = 0; i < (low ? 5 : 8); i++) { const a = i * 0.9 + 0.3, r = 0.55 + 0.4 * ((i * 3) % 4) / 4; add('light', G.sphere(0.016 + 0.01 * (i % 3), 6, 5).translate(C.x + Math.cos(a) * r, C.y, C.z + Math.sin(a) * r), 'acrecion', { color: i % 2 ? ORO_L : VIO_L }); }
    ad.rotation.x = 0.08; upd.push((dt, tt) => { ad.rotation.y = tt * 0.45; });
    ak.one('R', () => { // antebrazo derecho cristalizado por la fusión
      const E0 = P('lowerarm01'), W0 = P('wrist');
      for (let i = 0; i < (low ? 3 : 5); i++) add('crystal', limb(G.shard(0.16 - 0.015 * i, 0.03, 4), E0, W0, 0.25 + i * 0.16, { off: [0.04 * ((i % 2) * 2 - 1) + 0.02, 0, 0.05], r: [0.5, i, 0.6 * (i % 2 ? 1 : -1)] }), 'lowerarm01', { color: i % 2 ? CRY_V : VIO });
      add('ember', seam([E0.clone().add(V(0.03, 0, 0.07)), W0.clone().add(V(0.0, 0.0, 0.07))], 0.004), 'lowerarm01', { color: VIO_L });
    });
  }
  if (has('artilleria')) {
    ak.both(() => { // cañón de marea sobre cada hombro: tubo de roca, bobinas de oro, cañón de cristal y esfera de carga
      const x = 0.27, y = 1.5, z = -0.06;
      add('stone', X(G.cyl(0.048, 0.062, 0.46, S(10, 6)), { p: [x, y, z + 0.08], r: [Math.PI / 2, 0, 0] }), 'spine01', { color: ROC_L });
      add('stone', X(bonelump(0.07, [1, 0.9, 1.2], 120, 0.25), { p: [x, y - 0.06, z - 0.12] }), 'spine01', { color: ROC });
      for (const k of [-0.05, 0.1, 0.22]) add('ember', X(G.torus(0.062 + (k < 0 ? 0.008 : 0), 0.006, 3, S(14, 8)), { p: [x, y, z + k + 0.1], r: [Math.PI / 2, 0, 0] }), 'spine01', { color: ORO });
      add('crystal', X(G.cyl(0.032, 0.032, 0.2, S(8, 5)), { p: [x, y, z + 0.4], r: [Math.PI / 2, 0, 0] }), 'spine01', { color: CRY_V });
      add('light', G.sphere(0.03, 8, 6).translate(x, y, z + 0.52), 'spine01', { color: VIO_L });
      add('ember', seam([V(x - 0.05, y + 0.05, z - 0.05), V(x - 0.05, y + 0.05, z + 0.3)], 0.003), 'spine01', { color: VIO });
    });
  }

  // ═════════════ NIVEL 4
  if (has('apoteosis')) { // supernova: explosión radial de rayos de oro a la espalda + corona de eclipse con rayos larguísimos
    const sol = ak.bone('sol', 'spine02', V(0, 1.25, -0.36)), N = low ? 18 : 22;
    for (let i = 0; i < N; i++) { const a = (i / N) * TAU, long = i % 2 === 0, L = long ? 0.95 : 0.55, r0 = 0.5;
      add('ember', spikeAt(V(Math.cos(a) * r0, 1.25 + Math.sin(a) * r0, -0.36), V(Math.cos(a), Math.sin(a), -0.1), L, long ? 0.0105 : 0.0065, 0, Zv, { radial: 3, tubular: 2 }), 'sol', { color: long ? ORO : 0xe8a838 }); }
    add('ember', X(G.torus(0.48, 0.0055, 3, S(48, 22)), { p: [0, 1.25, -0.36], r: [Math.PI / 2, 0, 0] }), 'sol', { color: ORO });
    for (let i = 0; i < (low ? 5 : 8); i++) { const a = (i / (low ? 5 : 8)) * TAU + 0.3, HC = V(0, 1.575, 0.035); add('ember', spikeAt(V(HC.x + Math.cos(a) * 0.17, HC.y + Math.sin(a) * 0.17, HC.z - 0.1), V(Math.cos(a), Math.sin(a), -0.35), 0.7, 0.009, 0, Zv, { radial: 3, tubular: 2 }), 'corona', { color: ORO }); }
    upd.push((dt, tt) => { sol.rotation.z = tt * 0.12; });
  }
  if (has('anomalia')) { // el pecho se abre a un vacío negro: anillos de fotones, esquirlas en órbita y rayos violeta sobre el cuerpo
    const vb = ak.bone('vacio', 'spine01', V(CC.x, CC.y, CC.z + 0.06)), vo = ak.bone('vacioO', 'spine01', CC);
    add('mirror', G.sphere(0.072, S(16, 10), S(12, 8)).translate(CC.x, CC.y, CC.z + 0.05), 'vacio', { color: NEG });
    add('light', G.torus(0.21, 0.009, 3, S(40, 20)).rotateX(Math.PI / 2).translate(CC.x, CC.y, CC.z + 0.05), 'vacio', { color: ORO_L });
    add('ember', X(G.torus(0.29, 0.0055, 3, S(40, 20)), { p: [CC.x, CC.y, CC.z + 0.05], r: [1.0, 0, 0.5] }), 'vacio', { color: VIO });
    for (let i = 0; i < (low ? 6 : 9); i++) { const a = (i / (low ? 6 : 9)) * TAU, r = 0.36 + 0.05 * (i % 2); add('mirror', spikeAt(V(CC.x + Math.cos(a) * r, CC.y + Math.sin(a * 2) * 0.12, CC.z + 0.04 + Math.sin(a) * r * 0.7), V(Math.cos(a + 1.2), 0.2, Math.sin(a + 1.2)), 0.1, 0.014, 0.01, Y, { radial: 4 }), 'vacioO', { color: 0x120c22 }); }
    const hands = [V(0.43, 1.09, 0.17), V(-0.43, 1.09, 0.17), V(0.11, 0.9, 0.05), V(-0.11, 0.9, 0.05), V(0.17, 1.5, -0.02), V(-0.17, 1.5, -0.02)];
    for (let i = 0; i < (low ? 4 : hands.length); i++) add('ember', t.crackLine(V(CC.x, CC.y, CC.z - 0.02), hands[i].clone().add(V(0, 0, 0.1)), { n: 8, jag: 0.025, r: 0.0034, seed: 40 + i }), 'spine01', { color: i % 2 ? VIO : VIO_L });
    upd.push((dt, tt) => { vo.rotation.y = tt * 1.7; vo.rotation.z = 0.5 * Math.sin(tt * 0.7); vb.scale.setScalar(1 + 0.08 * uBeat.value); });
  }
  void cuff; void seam; void mine; void R; void Y;
  return { update() {} };
}
