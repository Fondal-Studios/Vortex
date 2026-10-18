// SERAF — ÁNGEL CAÍDO (versión base del kit). Vestido y armadura de marfil y oro, aureola quebrada, un ala entera de luz y otra quemada (plumas sueltas con física de cadenas),
// y un látigo de luz en la mano derecha. Silueta: vestido amplio + alas enormes.
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';
export const BELLY = 0;
const IVORY = 0xd8cfc0, GOLD = 0xffffff, LIGHT = 0xffd45a;

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, ringAt, dome, S, low } = t, P = (n) => ak.P(n), add = ak.add, Y = V(0, 1, 0), HC = V(0, 1.6, 0.06), upd = [], R = t.rng(61);
  // casco: máscara de marfil con visor de luz + corona y aureola quebrada
  add('marble', X(G.lathe([[0.1, -0.075], [0.108, -0.02], [0.108, 0.04], [0.088, 0.1], [0.05, 0.138], [0, 0.15]], S(14, 9), 0, Math.PI * 2, 34), { p: [HC.x, HC.y, HC.z], s: [1, 1, 1.2] }), 'head', { color: IVORY });
  add('gold', X(G.wrapE(G.plate([[0, 0.02], [0.06, 0.03], [0.1, 0.0], [0.05, -0.02], [0, -0.03], [-0.05, -0.02], [-0.1, 0.0], [-0.06, 0.03]], 0.02, 0.006), 0.115, 0.142), { p: [HC.x, HC.y + 0.01, HC.z] }), 'head');
  for (const s of [-1, 1]) add('light', X(G.wrapE(G.plate([[0.012, 0.0], [0.05, 0.01], [0.075, 0.0], [0.03, -0.012]], 0.01, 0.002), 0.114, 0.14), { p: [HC.x, HC.y - 0.012, HC.z], s: [s, 1, 1] }), 'head', { color: LIGHT });
  add('gold', X(G.torus(0.19, 0.0045, 4, S(36, 16), 0), { p: [HC.x, HC.y + 0.2, HC.z - 0.07], r: [0.3, 0, 0] }).clone(), 'head');
  add('light', X(G.torus(0.19, 0.0028, 3, S(36, 16)), { p: [HC.x, HC.y + 0.2, HC.z - 0.07], r: [0.3, 0, 0] }), 'head', { color: LIGHT });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI - Math.PI * 0.1; add('gold', spikeAt(V(HC.x + Math.cos(a) * 0.1, HC.y + 0.1, HC.z + Math.sin(a) * 0.1 * 0.2), V(Math.cos(a) * 0.3, 1, -0.1), 0.08 + (i === 3 ? 0.04 : 0), 0.009, 0, Y, { radial: 4 }), 'head'); }
  // peto de marfil con filigrana de oro y núcleo
  add('marble', X(G.lathe([[0.16, 1.1], [0.17, 1.2], [0.18, 1.3], [0.16, 1.38], [0.11, 1.42], [0.09, 1.44]], S(14, 9), 0, Math.PI * 2, 32), { p: [0, 0, 0.04], s: [1, 1, 0.74] }), 'spine01', { color: IVORY });
  ak.both(() => {
    add('gold', seam([V(0.02, 1.4, 0.16), V(0.07, 1.36, 0.17), V(0.12, 1.3, 0.15), V(0.07, 1.24, 0.17), V(0.02, 1.2, 0.18)], 0.0042), 'spine01');
    add('gold', seam([V(0.1, 1.38, 0.14), V(0.15, 1.33, 0.11), V(0.15, 1.26, 0.1)], 0.0036), 'spine01');
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'); // hombrera alada: 3 plumas de marfil con borde de oro
    for (let i = 0; i < 3; i++) add('marble', X(G.plate([[0, 0], [0.04, 0.02], [0.05, 0.1 + i * 0.04], [0.0, 0.18 + i * 0.05], [-0.04, 0.1 + i * 0.04]], 0.012, 0.004), { p: [S0.x + 0.03 + i * 0.015, S0.y + 0.03, S0.z - 0.02 + i * 0.02], r: [0, 0, -0.55 - i * 0.25] }), 'upperarm01', { color: IVORY });
    add('gold', X(t.dome(0.1, 0.06, { lip: 0.3, seg: S(9, 6), crease: 30 }), { p: [S0.x + 0.03, S0.y + 0.03, S0.z], r: [0, 0, -0.42], s: [1.1, 1, 1.05] }), 'upperarm01');
    add('marble', limb(t.cuff(0.062, 0.048, 0.2, 0.01, S(9, 6), 28), E0, W0, 0.5), 'lowerarm01', { color: IVORY }); add('gold', ringAt(E0, W0, 0.12, 0.058, 0.012, 0.004), 'lowerarm01'); add('gold', ringAt(E0, W0, 0.88, 0.048, 0.012, 0.004), 'lowerarm01');
    for (const f of ['finger2', 'finger3', 'finger4']) { const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize(); add('gold', spikeAt(b, d, 0.06, 0.006, 0.0, V(0, 1, 0), { radial: 4 }), `${f}-3`); }
  });
  add('light', G.sphere(0.028, 9, 7).translate(0, 1.27, 0.2), 'spine01', { color: LIGHT }); for (let i = 0; i < 3; i++) add('gold', G.torus(0.04 + i * 0.008, 0.0045, 4, S(16, 9)).rotateX(Math.PI / 2 + (i - 1) * 0.5).translate(0, 1.27, 0.195), 'spine01'); ak.halo('spine01', V(0, 1.27, 0.24), LIGHT, 0.4, 0.3);
  // falda larga de tela con borde de oro (física) + cinturón
  add('gold', G.band(0.18, 0.04, 0.014, { seg: S(20, 10), sz: 0.78 }).translate(0, 0.95, 0.055), 'spine05');
  const cols = [], lens = []; for (let j = 0; j < 14; j++) { const a = -1.15 + (j / 13) * (Math.PI * 2 - 2.3) + Math.PI, x = Math.sin(a) * 0.2, z = 0.05 + Math.cos(a) * 0.15; cols.push({ bone: j % 2 ? 'spine05' : 'spine04', p: V(x, 0.95, z) }); lens.push(0.88 + (R() - 0.5) * 0.18); }
  ak.cloth({ top: cols, dir: V(0, -1, 0), lens, rows: S(9, 6), color: 0xe8dcc8, hem: 0xe8b860, gravity: 6, stiff: 0.02, drag: 0.985 });
  ak.collider('spine05', V(0, 0.86, 0.045), V(0, 0.98, 0.045), 0.2); ak.both(() => { ak.collider('upperleg01', P('upperleg01'), P('lowerleg01'), 0.115); ak.collider('lowerleg01', P('lowerleg01'), P('foot'), 0.09); });
  ak.both(() => { const K = P('lowerleg01'), A = P('foot'); add('marble', limb(t.cuff(0.066, 0.05, 0.3, 0.01, S(9, 6), 28), K, A, 0.5), 'lowerleg01', { color: IVORY }); add('gold', ringAt(K, A, 0.1, 0.064, 0.012, 0.004), 'lowerleg01'); add('marble', t.box(0.08, 0.07, 0.22, 0.02, 1).translate(A.x, 0.05, 0.07), 'foot', { color: IVORY }); });
  // alas de plumas: ala izquierda de luz (entera), derecha quemada (menos plumas, ceniza y brasa); cada una cuelga de un hueso que aletea
  const wing = (s, burnt) => {
    const hub = V(s * 0.08, 1.34, -0.12), b = ak.bone(s < 0 ? 'alaR' : 'alaL', 'spine01', hub), arm = (u) => V(s * (0.04 + 0.62 * u), 0.04 + 0.46 * Math.sin(u * Math.PI * 0.62), -0.05 - 0.1 * u), n = burnt ? 7 : 11;
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < n; i++) {
      const u = 0.08 + 0.92 * (i / (n - 1)); if (burnt && u > 0.35 && R() < 0.3) continue; const a = arm(u), alpha = -1.15 + u * 1.5, len = (layer ? 0.42 : 0.7) * (0.7 + 0.6 * Math.sin(Math.min(1, u * 1.1 + 0.15) * Math.PI * 0.8)) * (burnt ? 0.55 + R() * 0.4 : 1);
      const dir = V(s * Math.cos(alpha), Math.sin(alpha), -0.22 - layer * 0.08).normalize(), at = V(hub.x + a.x, hub.y + a.y, hub.z + a.z - layer * 0.012), g = t.blade(len, 0.1 - layer * 0.025, 0.005, { tipLean: s * 0.18, curve: -0.05 }); X(g, { q: t.basisQ(dir, V(0, 0, 1)), p: [at.x, at.y, at.z] });
      if (burnt) add('dark', g, b.name, { color: layer ? 0x3a2a24 : 0x5a463c }); else add('spirit', g, b.name, { color: (x, y, z) => new T.Color(LIGHT).multiplyScalar(0.45).lerp(new T.Color(0xfff2c8), Math.pow(Math.min(1, Math.hypot(x - at.x, y - at.y, z - at.z) / len), 0.8)).multiplyScalar(0.9) });
      if (burnt && i % 2 === 0) add('ember', G.cone(0.012, 0.03, 4).rotateZ(-s * 1.2).translate(at.x + dir.x * len, at.y + dir.y * len, at.z + dir.z * len), b.name, { color: 0xff7a22 });
    }
    add(burnt ? 'dark' : 'light', G.tube([0, 0.25, 0.5, 0.75, 1].map((u) => { const a = arm(u); return V(hub.x + a.x, hub.y + a.y, hub.z + a.z); }), 0.01, 0.005, { radial: 4, tubular: 10 }), b.name, { color: burnt ? 0x3a2a24 : 0xffffff });
    return b;
  };
  const wl = wing(1, false), wr = wing(-1, true);
  upd.push((dt, tt, c) => { const sp = Math.min(1, ((c && c.speed) || 0) / 8); wl.rotation.set(0.05 * Math.sin(tt * 1.1), 0.15 + 0.1 * Math.sin(tt * 1.5) + sp * 0.35, 0.05 * Math.sin(tt * 1.5)); wr.rotation.set(0.05 * Math.sin(tt * 1.0), -(0.1 + 0.07 * Math.sin(tt * 1.3) + sp * 0.3), 0); });
  // látigo de luz (física): cadena de 12 eslabones desde la mano derecha
  const W0 = P('wrist_R'); const pts = Array.from({ length: 12 }, (_, i) => V(W0.x + 0.02 * i, W0.y - 0.05 * i, W0.z + 0.06 + i * 0.07));
  const wh = ak.chain('latigo', 'wrist_R', pts, { stiff: 0.03, damp: 0.94, gravity: 4, sway: 2 });
  for (let i = 0; i < 11; i++) { const r0 = 0.011 - i * 0.0006; add('light', G.tube([pts[i], pts[i + 1]], r0, r0 - 0.0006, { radial: 4, tubular: 2 }), wh.bones[i].name, { color: i % 3 ? LIGHT : 0xffffff }); }
  ak.embers(LIGHT, low ? 18 : 34, { radius: 0.5, height: 2.1, size: 5 });
  const evo = addEvolution(ak, ctx, { t, pal: { bone: 0xe8dcc8, boneL: 0xfff6e6, steel: 0xe8dcc8, steelD: 0xb8a888 } });
  return { update: (dt, tt, c) => { upd.forEach((f) => f(dt, tt, c)); evo.update(dt, tt, c); } };
}
