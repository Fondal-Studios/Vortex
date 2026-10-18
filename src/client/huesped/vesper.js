// VESPER — BESTIA CAZADORA (versión base del kit; docs/HUESPEDES_ARTE.md). Cráneo de lobo como casco, melena de cristal violeta, torso esbelto con arneses y costillas de cristal,
// garras largas, pantorrillas con espolón (ilusión de patas digitígradas) y una cola de nervios luminosos con física. Silueta: ágil, alargada, sin hombreras grandes.
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';
export const BELLY = 0;
const OBS = 0x6a5a86, BONE = 0xe8dcc4, VIO = 0xb04bff, MAG = 0xff5ad8, EYE = 0xb8ff6a;

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, ringAt, bonelump, S, low } = t, P = (n) => ak.P(n), add = ak.add, Y = V(0, 1, 0), Zv = V(0, 0, 1), HC = V(0, 1.6, 0.06), upd = [];
  // cráneo de lobo: bóveda + hocico alargado + mandíbula con colmillos + orejas
  add('bone', X(G.lathe([[0.1, -0.07], [0.108, -0.02], [0.105, 0.05], [0.085, 0.105], [0.04, 0.14], [0, 0.15]], S(14, 9), 0, Math.PI * 2, 32), { p: [HC.x, HC.y, HC.z - 0.01], s: [1, 1, 1.15] }), 'head', { color: BONE });
  add('bone', X(G.tube([V(0, 0.01, 0.08), V(0, -0.005, 0.2), V(0, -0.03, 0.29)], 0.055, 0.03, { radial: S(8, 6), tubular: 6, sx: 1, sz: 0.82 }), { p: [HC.x, HC.y, HC.z] }), 'head', { color: BONE });
  add('dark', X(G.tube([V(0, -0.045, 0.1), V(0, -0.055, 0.2), V(0, -0.06, 0.285)], 0.04, 0.022, { radial: S(8, 6), tubular: 5, sx: 1, sz: 0.5 }), { p: [HC.x, HC.y, HC.z] }), 'head', { color: 0x0a0612 });
  for (const s of [-1, 1]) {
    add('light', G.sphere(0.017, 8, 6).scale(1.4, 0.75, 0.6).translate(HC.x + s * 0.05, HC.y + 0.0, HC.z + 0.115), 'head', { color: EYE });
    add('dark', X(G.plate([[0, 0], [0.04, 0.012], [0.07, -0.01], [0.03, -0.02]], 0.01, 0.002), { p: [HC.x + s * 0.03, HC.y + 0.02, HC.z + 0.125], s: [s, 1, 1] }), 'head', { color: 0x15101f });
    add('bone', spikeAt(V(HC.x + s * 0.06, HC.y - 0.035, HC.z + 0.22), V(s * 0.1, -1, 0.15), 0.07, 0.01, 0.0, Zv, { radial: 4 }), 'head', { color: 0xffffff });
    add('bone', X(G.plate([[0, 0], [0.05, 0.0], [0.035, 0.09], [0.0, 0.13], [-0.02, 0.07]], 0.012, 0.003), { p: [HC.x + s * 0.07, HC.y + 0.09, HC.z - 0.04], r: [-0.5, 0.35 * s, -0.5 * s], s: [s, 1, 1] }), 'head', { color: BONE });
    add('crystal', X(G.plate([[0, 0], [0.03, 0.0], [0.02, 0.07], [0.0, 0.1]], 0.008, 0.002), { p: [HC.x + s * 0.075, HC.y + 0.095, HC.z - 0.035], r: [-0.5, 0.35 * s, -0.5 * s], s: [s, 1, 1] }), 'head', { color: VIO });
  }
  add('bone', t.box(0.07, 0.014, 0.1, 0.005, 1).translate(HC.x, HC.y - 0.065, HC.z + 0.2), 'head', { color: 0xffffff }); // mandíbula
  // melena de cristal: púas largas que bajan por la nuca y la espalda
  for (let i = 0; i < 9; i++) { const y = 1.5 - i * 0.052, L = 0.2 - i * 0.012; add('crystal', spikeAt(V(0, y, -0.06 - 0.01 * (i > 4 ? 1 : 0)), V(0, -0.3, -1), L, 0.018, -0.04, Y, { radial: 4, tubular: 4 }), i < 2 ? 'neck01' : i < 5 ? 'spine01' : 'spine02', { color: i % 2 ? VIO : MAG }); }
  // torso esbelto: arnés cruzado, placa pectoral pequeña, costillas de cristal y núcleo
  add('leather', G.tube([V(-0.17, 1.4, 0.06), V(-0.05, 1.3, 0.16), V(0.08, 1.2, 0.15), V(0.17, 1.1, 0.07)], 0.018, 0.018, { radial: 5, tubular: 12, sx: 1, sz: 0.5 }), 'spine01', { color: 0x6a4a52 });
  add('leather', G.tube([V(0.17, 1.4, 0.06), V(0.05, 1.3, 0.16), V(-0.08, 1.2, 0.15), V(-0.17, 1.1, 0.07)], 0.018, 0.018, { radial: 5, tubular: 12, sx: 1, sz: 0.5 }), 'spine01', { color: 0x6a4a52 });
  add('dark', X(G.wrapE(G.plate([[0, 0.08], [0.07, 0.06], [0.085, -0.02], [0.03, -0.09], [0, -0.07], [-0.03, -0.09], [-0.085, -0.02], [-0.07, 0.06]], 0.024, 0.008), 0.15, 0.115), { p: [0, 1.3, 0.04] }), 'spine01', { color: 0x1a1426 });
  add('light', G.sphere(0.024, 8, 6).translate(0, 1.29, 0.175), 'spine01', { color: MAG }); ak.halo('spine01', V(0, 1.29, 0.2), MAG, 0.36, 0.5);
  ak.both(() => {
    for (let i = 0; i < 4; i++) add('crystal', X(G.plate([[0, 0], [0.04, 0.012], [0.12 - i * 0.015, 0.0], [0.04, -0.012]], 0.01, 0.002), { p: [0.13, 1.32 - i * 0.055, 0.0], r: [0, 0, -0.5 + i * 0.1] }), 'spine01', { color: i % 2 ? VIO : MAG });
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'), H = P('upperleg01'), K = P('lowerleg01'), A = P('foot'), TO = P('toe3-1');
    add('dark', X(t.dome(0.075, 0.05, { lip: 0.3, seg: S(8, 6), crease: 35 }), { p: [S0.x + 0.03, S0.y + 0.03, S0.z], r: [0, 0, -0.5] }), 'upperarm01', { color: 0x1a1426 });
    for (let i = 0; i < 3; i++) add('bone', spikeAt(V(S0.x + 0.06, S0.y + 0.06, S0.z - 0.03 + i * 0.03), V(1, 0.8, -0.4 + i * 0.4), 0.09, 0.012, 0.01, Y, { radial: 4 }), 'upperarm01', { color: BONE });
    add('dark', limb(t.cuff(0.056, 0.044, 0.2, 0.01, S(9, 6), 30), E0, W0, 0.5), 'lowerarm01', { color: 0x1a1426 });
    add('crystal', limb(t.blade(0.34, 0.045, 0.008), E0, W0, 0.7, { off: [-0.06, 0, 0], r: [0, Math.PI / 2, 0] }), 'lowerarm01', { color: VIO });
    for (const [f, len] of [['finger2', 0.16], ['finger3', 0.19], ['finger4', 0.16], ['finger5', 0.12]]) { const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize(); add('bone', spikeAt(b, d.clone().add(V(0, -0.1, 0.1)), len, 0.0085, -0.03, V(0, 0.4, 0.2), { radial: 4, tubular: 5 }), `${f}-3`, { color: 0xffffff }); }
    add('bone', spikeAt(P('finger1-3'), P('finger1-3').sub(P('finger1-2')).add(V(0, 0, 0.3)), 0.12, 0.009, -0.02, V(0, 1, 0.3), { radial: 4 }), 'finger1-3', { color: 0xffffff });
    // muslo con pelaje de placas y pantorrilla larga con espolón (digitígrada)
    for (let i = 0; i < 3; i++) add('dark', limb(G.wrapE(G.plate([[-0.04, 0.05], [0.04, 0.05], [0.03, -0.04], [0, -0.06], [-0.03, -0.04]], 0.012, 0.004), 0.08 - i * 0.003, 0.082 - i * 0.003), H, K, 0.25 + i * 0.22), 'upperleg01', { color: 0x1a1426 });
    add('dark', limb(t.cuff(0.062, 0.046, 0.34, 0.01, S(9, 6), 30), K, A, 0.5), 'lowerleg01', { color: 0x1a1426 });
    add('crystal', limb(t.blade(0.3, 0.05, 0.008, { curve: -0.06 }), K, A, 0.12, { off: [0.0, 0, -0.07], r: [Math.PI, 0, 0] }), 'lowerleg01', { color: MAG });
    add('bone', spikeAt(V(K.x, K.y - 0.1, K.z - 0.08), V(0, -0.4, -1), 0.14, 0.018, 0.02, Y, { radial: 4 }), 'lowerleg01', { color: BONE });
    add('dark', t.box(0.07, 0.07, 0.2, 0.02, 1).translate(A.x, 0.05, 0.07), 'foot', { color: 0x1a1426 });
    for (let i = -1; i <= 1; i++) add('bone', spikeAt(V(TO.x + i * 0.028, 0.03, 0.17), V(i * 0.2, 0.1, 1), 0.11, 0.011, 0.01, Y, { radial: 4 }), 'toe3-1', { color: 0xffffff });
    add('light', ringAt(K, A, 0.9, 0.056, 0.01, 0.004), 'lowerleg01', { color: MAG });
  });
  // cola de nervios luminosos (física): vaina oscura + núcleo magenta
  const base = V(0, 0.93, -0.1), pts = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => V(0, 0.93 - i * 0.045 + 0.0 * i, -0.1 - i * 0.1));
  const tail = ak.chain('cola', 'spine05', pts, { stiff: 0.05, damp: 0.93, gravity: 3.2, sway: 1.6 });
  for (let i = 0; i < 7; i++) { const r0 = 0.032 - i * 0.0036, r1 = 0.032 - (i + 1) * 0.0036; add('dark', G.tube([pts[i], pts[i + 1]], r0, r1, { radial: S(6, 5), tubular: 3 }), tail.bones[i].name, { color: 0x1c1428 }); add('light', G.tube([pts[i], pts[i + 1]], r0 * 0.5, r1 * 0.5, { radial: 4, tubular: 3 }), tail.bones[i].name, { color: i % 2 ? VIO : MAG }); }
  add('crystal', spikeAt(pts[7], V(0, -0.35, -1), 0.14, 0.02, 0, Y, { radial: 4, tubular: 3 }), tail.bones[7].name, { color: MAG });
  ak.collider('spine05', V(0, 0.86, 0.045), V(0, 0.98, 0.045), 0.185);
  ak.embers(MAG, low ? 18 : 34, { radius: 0.45, height: 1.9, size: 5 });
  const evo = addEvolution(ak, ctx, { t, pal: { bone: 0xd8cdb8, boneL: 0xffffff, steel: 0x3a3050, steelD: 0x1a1426 } });
  return { update: (dt, tt, c) => { evo.update(dt, tt, c); } };
}
