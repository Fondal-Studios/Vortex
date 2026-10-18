// UMBRA — EL ERRANTE (versión base del kit). Sudario de sombra que cae hasta el suelo sin piernas visibles, capucha vacía con dos puntos de luz, fragmentos de espejo
// que orbitan y una hoja dimensional en la mano derecha. Silueta: columna estrecha y alta, vacía; todo lo brillante es espejo o luz.
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';
export const BELLY = 0;
const VIO = 0xb98cff, SHROUD = 0x1c1230;

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, S, low } = t, P = (n) => ak.P(n), add = ak.add, Y = V(0, 1, 0), HC = V(0, 1.6, 0.06), upd = [], R = t.rng(51);
  // capucha vacía: bóveda + cara de vacío con dos puntos de luz
  add('dark', X(G.lathe([[0.12, -0.09], [0.13, 0.0], [0.125, 0.07], [0.09, 0.14], [0.04, 0.185], [0, 0.2]], S(14, 9), 0, Math.PI * 2, 40), { p: [HC.x, HC.y, HC.z - 0.01], s: [1, 1, 1.2] }), 'head', { color: 0x120c1e });
  add('dark', G.sphere(0.1, 12, 8).scale(1, 1.2, 0.55).translate(HC.x, HC.y - 0.02, HC.z + 0.09), 'head', { color: 0x000000 });
  for (const s of [-1, 1]) { add('light', G.sphere(0.012, 6, 5).translate(HC.x + s * 0.035, HC.y + 0.005, HC.z + 0.135), 'head', { color: VIO }); ak.halo('head', V(HC.x + s * 0.035, HC.y + 0.005, HC.z + 0.14), VIO, 0.16, 0.6); }
  add('dark', X(G.tube([V(0, 0.12, 0.06), V(0, 0.1, 0.12), V(0, 0.02, 0.15), V(0, -0.06, 0.12)], 0.115, 0.108, { radial: 12, tubular: 6, sz: 0.4 }), { p: [HC.x, HC.y, HC.z] }), 'head', { color: SHROUD });
  // hombros y sudario: capa de hombros + túnica larga (tela con física) hasta el suelo
  add('dark', X(G.lathe([[0.2, 1.2], [0.24, 1.3], [0.2, 1.42], [0.1, 1.47], [0.07, 1.49]], S(16, 9)), { p: [0, 0, 0.03], s: [1, 1, 0.75] }), 'spine01', { color: SHROUD });
  const cols = [], lens = [];
  for (let j = 0; j < 14; j++) { const a = -1.15 + (j / 13) * (Math.PI * 2 - 2.3) + Math.PI, x = Math.sin(a) * 0.22, z = 0.04 + Math.cos(a) * 0.17; cols.push({ bone: j % 2 ? 'spine05' : 'spine04', p: V(x, 0.98, z) }); lens.push(0.98 + (R() - 0.5) * 0.24); }
  ak.cloth({ top: cols, dir: V(0, -1, 0.0), lens, rows: S(10, 6), color: 0x2a1c48, hem: 0x08040e, gravity: 6, stiff: 0.02, drag: 0.985 });
  const c2 = [], l2 = []; for (let j = 0; j < 8; j++) { const x = -0.23 + j * (0.46 / 7); c2.push({ bone: 'spine01', p: V(x, 1.4, -0.105) }); l2.push(1.3 + (R() - 0.5) * 0.4 + Math.cos((j / 7 - 0.5) * 2.4) * 0.15); }
  ak.cloth({ top: c2, dir: V(0, -1, -0.12), lens: l2, rows: S(11, 7), color: 0x30204e, hem: 0x08040e, gravity: 7, stiff: 0.012, drag: 0.982 });
  ak.collider('spine02', V(0, 1.0, 0.045), V(0, 1.36, 0.045), 0.18); ak.collider('spine05', V(0, 0.86, 0.045), V(0, 0.98, 0.045), 0.2);
  ak.both(() => { ak.collider('upperleg01', P('upperleg01'), P('lowerleg01'), 0.12); ak.collider('lowerleg01', P('lowerleg01'), P('foot'), 0.095); });
  // brazos: mangas largas con puños de espejo y la hoja dimensional (mano derecha)
  ak.both(() => {
    const E0 = P('lowerarm01'), W0 = P('wrist');
    add('dark', limb(t.cuff(0.07, 0.05, 0.22, 0.012, S(9, 6), 30), E0, W0, 0.5), 'lowerarm01', { color: SHROUD });
    add('mirror', limb(G.plate([[0, 0.1], [0.04, 0.0], [0.0, -0.1], [-0.03, 0.0]], 0.01, 0.003), E0, W0, 0.6, { off: [-0.06, 0, 0], r: [0, Math.PI / 2, 0] }), 'lowerarm01', { color: 0xdde6ff });
    for (const f of ['finger2', 'finger3', 'finger4']) { const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize(); add('dark', spikeAt(b, d, 0.07, 0.007, 0.0, V(0, 1, 0), { radial: 4 }), `${f}-3`, { color: 0x0a0612 }); }
  });
  ak.one('R', () => { const E0 = P('lowerarm01'), W0 = P('wrist'); // hoja dimensional: filo violeta sobre una hoja negra
    add('dark', limb(t.blade(0.9, 0.07, 0.012, { tipLean: 0.05 }), W0, W0.clone().add(V(0.1, -0.1, 0.4)), 0.0, { r: [0, 0, 0], off: [0, 0, 0] }), 'wrist', { color: 0x0a0612 });
    add('light', limb(t.blade(0.9, 0.012, 0.014), W0, W0.clone().add(V(0.1, -0.1, 0.4)), 0.0, { off: [0, 0, 0.02] }), 'wrist', { color: VIO });
  });
  // fragmentos de espejo en órbita
  const hub = V(0, 1.15, 0.04), orb = ak.bone('orbita', 'spine02', hub);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, Rr = 0.5 + (i % 3) * 0.09, y = (R() - 0.5) * 0.9, sz = 0.07 + R() * 0.07; add('mirror', X(G.plate([[0, sz], [sz * 0.6, 0], [0, -sz * 1.1], [-sz * 0.5, -sz * 0.2]], 0.01, 0.003), { p: [hub.x + Math.cos(a) * Rr, hub.y + y, hub.z + Math.sin(a) * Rr], r: [R(), -a, R()] }), 'orbita', { color: 0xdde6ff }); }
  upd.push((dt, tt) => { orb.rotation.y = tt * 0.45; orb.position.y = 0; });
  ak.embers(VIO, low ? 16 : 30, { radius: 0.5, height: 2.0, size: 5 });
  const evo = addEvolution(ak, ctx, { t, pal: { bone: 0x6a5a86, boneL: 0x9a8ac0, steel: 0x3a2e58, steelD: 0x1c1230 } });
  return { update: (dt, tt, c) => { upd.forEach((f) => f(dt, tt, c)); evo.update(dt, tt, c); } };
}
