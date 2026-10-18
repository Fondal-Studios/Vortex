// MICELIO — COLOSO RAÍZ (versión base del kit). El más grande (escala ×1,25 en huesped-cuerpo.js): armadura de corteza y raíces, hombros de hongos-estantería con luz verde debajo,
// brazos descomunales (raíces que envuelven antebrazos y manos), cornamenta de ramas con brotes luminosos, musgo que late y raíces colgantes con física.
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';
export const BELLY = 0;
const BARK = 0xb09a80, BARK_D = 0x6a5a48, MOSS = 0x7be03a, MOSS2 = 0xc8ff4a;

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, ringAt, bonelump, dome, S, low } = t, P = (n) => ak.P(n), add = ak.add, Y = V(0, 1, 0), Zv = V(0, 0, 1), HC = V(0, 1.6, 0.06), R = t.rng(41);
  ak.both(() => { console.warn('BONES ' + ['upperarm01','lowerarm01','wrist','finger3-1','finger3-3','upperleg01','lowerleg01','foot','toe3-1','clavicle','neck01','spine01','spine02','spine03','spine05'].map((n)=>n+':'+ak.P(n).toArray().map((v)=>v.toFixed(2))).join(' ')); });
  // cabeza: tronco hueco con máscara de corteza + cornamenta de ramas con brotes luminosos
  add('bark', X(G.lathe([[0.1, -0.075], [0.112, -0.02], [0.112, 0.04], [0.09, 0.1], [0.05, 0.135], [0, 0.145]], S(10, 8), 0, Math.PI * 2, 35), { p: [HC.x, HC.y, HC.z], s: [1.05, 1.05, 1.22] }), 'head', { color: BARK });
  add('dark', t.box(0.1, 0.05, 0.02, 0.01, 1).translate(HC.x, HC.y - 0.005, HC.z + 0.135), 'head', { color: 0x0a0a06 });
  for (const s of [-1, 1]) { add('light', G.sphere(0.014, 7, 5).translate(HC.x + s * 0.034, HC.y - 0.003, HC.z + 0.142), 'head', { color: MOSS2 }); }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const pts = [V(s * 0.06, 0.07, 0.0), V(s * (0.12 + k * 0.03), 0.14 + k * 0.05, -0.02), V(s * (0.17 + k * 0.05), 0.24 + k * 0.08, -0.05 - k * 0.02), V(s * (0.15 + k * 0.07), 0.32 + k * 0.1, -0.08)];
    add('bark', X(G.tube(pts, 0.022 - k * 0.003, 0.004, { radial: S(6, 5), tubular: S(10, 6), ridges: 3, ridgeAmp: 0.2 }), { p: [HC.x, HC.y, HC.z] }), 'head', { color: BARK_D });
    add('light', G.sphere(0.014, 6, 5).translate(HC.x + pts[3].x, HC.y + pts[3].y, HC.z + pts[3].z), 'head', { color: MOSS });
  }
  // torso: coraza de placas de corteza, musgo luminoso en las grietas, cavidad que late
  add('bark', X(G.lathe([[0.17, 1.05], [0.19, 1.15], [0.2, 1.27], [0.18, 1.36], [0.12, 1.42], [0.09, 1.44]], S(12, 9), 0, Math.PI * 2, 36), { p: [0, 0, 0.04], s: [1, 1, 0.8] }), 'spine01', { color: BARK });
  for (let i = 0; i < 4; i++) add('bark', X(G.wrapE(G.plate([[-0.1, 0.05], [0.1, 0.05], [0.12, -0.03], [0.0, -0.07], [-0.12, -0.03]], 0.03, 0.01), 0.19, 0.15), { p: [0, 1.38 - i * 0.07, 0.035], r: [0.08, 0, 0] }), i < 2 ? 'spine01' : 'spine02', { color: i % 2 ? BARK : BARK_D });
  add('dark', G.sphere(0.07, 9, 7).scale(1, 1.2, 0.6).translate(0, 1.2, 0.185), 'spine01', { color: 0x050804 }); add('light', G.sphere(0.036, 8, 6).translate(0, 1.2, 0.2), 'spine01', { color: MOSS });
  ak.halo('spine01', V(0, 1.2, 0.24), 0x7be03a, 0.5, 0.5);
  for (let i = 0; i < 12; i++) add('light', G.sphere(0.012 + R() * 0.01, 5, 4).translate((R() - 0.5) * 0.3, 1.06 + R() * 0.36, 0.17 + R() * 0.02), 'spine01', { color: R() > 0.5 ? MOSS : MOSS2 });
  ak.both(() => {
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'), H = P('upperleg01'), K = P('lowerleg01'), A = P('foot'), TO = P('toe3-1');
    // hombro: hongos-estantería apilados con luz debajo
    for (let i = 0; i < 3; i++) { const R0 = 0.17 - i * 0.03; add('bark', X(G.lathe([[0.0, 0.04], [R0, 0.015], [R0 * 1.05, 0], [R0 * 0.9, -0.012], [0.0, -0.01]], S(14, 8)), { p: [S0.x + 0.05 + i * 0.012, S0.y + 0.02 + i * 0.045, S0.z], r: [0, 0, -0.35] }), 'upperarm01', { color: i % 2 ? 0xc8a878 : 0xa88a62 }); add('light', X(G.torus(R0 * 0.9, 0.005, 3, S(18, 9)), { p: [S0.x + 0.05 + i * 0.012, S0.y + 0.012 + i * 0.045, S0.z], r: [0, 0, -0.35] }), 'upperarm01', { color: MOSS }); }
    // brazos descomunales: raíces que envuelven antebrazo y mano
    add('bark', limb(bonelump(0.085, [1, 1.9, 1], 4, 0.22), E0, W0, 0.45), 'lowerarm01', { color: BARK_D });
    for (let k = 0; k < 4; k++) add('bark', limb(G.tube([V(-0.05 + k * 0.03, -0.14, 0.08), V(0.06 - k * 0.04, -0.03, 0.1), V(-0.04 + k * 0.025, 0.07, 0.085), V(0.03, 0.14, 0.07)], 0.018, 0.012, { radial: S(5, 4), tubular: 8 }), E0, W0, 0.5), 'lowerarm01', { color: BARK });
    add('bark', limb(bonelump(0.07, [1.1, 1.2, 1.1], 6, 0.25), W0, P('finger3-1'), 0.7), 'wrist', { color: BARK });
    for (const f of ['finger2', 'finger3', 'finger4', 'finger5']) { const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize(); add('bark', spikeAt(b, d.clone().add(V(0, -0.1, 0.1)), 0.09, 0.012, -0.02, V(0, 0.4, 0.2), { radial: 5 }), `${f}-3`, { color: BARK_D }); }
    add('bark', spikeAt(E0.clone().add(V(0.06, 0, -0.04)), V(1, 0.3, -0.6), 0.14, 0.024, 0.03, Y), 'lowerarm01', { color: BARK });
    // piernas: corteza + raíces en el pie
    add('bark', limb(bonelump(0.09, [1, 2.6, 1], 8, 0.2), H, K, 0.5), 'upperleg01', { color: BARK });
    add('bark', limb(bonelump(0.075, [1, 2.4, 1], 9, 0.2), K, A, 0.5), 'lowerleg01', { color: BARK_D });
    add('bark', bonelump(0.075, [1.1, 0.7, 2.2], 10, 0.2).translate(A.x, 0.05, 0.07), 'foot', { color: BARK });
    for (let k = -1; k <= 1; k++) add('bark', G.tube([V(TO.x + k * 0.02, 0.05, 0.12), V(TO.x + k * 0.05, 0.03, 0.2), V(TO.x + k * 0.08, 0.012, 0.27)], 0.025, 0.006, { radial: 5, tubular: 5 }), 'toe3-1', { color: BARK_D });
    add('light', ringAt(K, A, 0.5, 0.078, 0.012, 0.004), 'lowerleg01', { color: MOSS });
  });
  // raíces colgantes y musgo (física)
  for (let k = 0; k < 4; k++) {
    const x = -0.12 + k * 0.08, pts = [0, 1, 2, 3, 4].map((i) => V(x + Math.sin(k + i) * 0.02, 1.32 - i * 0.11, -0.12 - i * 0.03));
    const ch = ak.chain('raiz' + k, 'spine01', pts, { stiff: 0.05, damp: 0.92, gravity: 3.5, sway: 1.2 });
    for (let i = 0; i < 4; i++) add('bark', G.tube([pts[i], pts[i + 1]], 0.026 - i * 0.005, 0.021 - i * 0.005, { radial: S(5, 4), tubular: 3 }), ch.bones[i].name, { color: i % 2 ? BARK : BARK_D });
    add('light', G.sphere(0.016, 5, 4).translate(pts[4].x, pts[4].y, pts[4].z), ch.bones[4].name, { color: MOSS2 });
  }
  ak.collider('spine02', V(0, 1.0, 0.045), V(0, 1.36, 0.045), 0.17);
  ak.embers(MOSS2, low ? 20 : 40, { radius: 0.55, height: 2.0, size: 5 });
  const evo = addEvolution(ak, ctx, { t, pal: { bone: 0xb09a80, boneL: 0xc8b494, steel: 0x8a7a62, steelD: 0x5a4a38 } });
  return { update: (dt, tt, c) => evo.update(dt, tt, c) };
}
