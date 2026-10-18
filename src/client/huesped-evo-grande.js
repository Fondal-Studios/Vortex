// PIEZAS GRANDES de la evolución (se leen desde 5-10 m): lo que hace que cada camino cambie la SILUETA y no sólo el detalle.
// Las llama addEvolution (huesped-evo-piezas.js) al final, así que sirven a los cinco Huéspedes. Son geometrías baratas (pocas caras, radial bajo) para
// no pasar el presupuesto de Baja (≤ 45 llamadas, ≤ 20 000 triángulos por Huésped): casi todas van en los materiales que el kit ya tiene (no suman llamadas).
//   depredador → cuernos grandes en la frente · coraza → hombreras enormes con púas · velocidad → aletas de espalda + estelas de luz que ondean
//   simbiosis → tentáculos largos de la espalda · anomalía → anillo de grieta vertical a la espalda (artillería, resonancia y apoteosis se agrandan en huesped-evo-piezas.js)
import * as T from 'three';
import { V } from './huesped-piezas.js';

export function addEvolutionBig(ak, ctx, t, pal, o = {}) {
  const { G, X, spikeAt, S, low } = t, P = (n) => ak.P(n), add = ak.add, has = ctx.has, glow = ctx.glow, Y = V(0, 1, 0);
  const gl = new T.Color(glow).lerp(new T.Color(0xffffff), 0.35);
  if (has('depredador')) {
    ak.both(() => { // cuernos curvos hacia atrás
      add('bone', spikeAt(V(0.07, 1.72, 0.03), V(0.4, 0.9, -0.55), 0.4, 0.03, 0.12, V(0, 0, -1), { radial: S(6, 4), ridges: low ? 0 : 3, ridgeAmp: 0.18 }), 'head', { color: pal.boneL });
    });
  }
  if (has('coraza')) {
    ak.both(() => { // hombrera enorme con borde de oro y tres púas
      const S0 = P('upperarm01'), c = S0.clone().add(V(0.06, 0.08, 0));
      add('metal', X(t.dome(0.19, 0.14, { lip: 0.12, seg: S(16, 8) }), { p: [c.x, c.y, c.z], r: [0, 0, -0.55] }), 'upperarm01', { color: pal.steel });
      add('gold', X(G.torus(0.2, 0.009, 3, S(18, 9)), { p: [c.x + 0.012, c.y - 0.014, c.z], r: [Math.PI / 2, 0, -0.55] }), 'upperarm01');
      for (let i = 0; i < (low ? 2 : 3); i++) add('metal', spikeAt(V(c.x + 0.07 + i * 0.015, c.y + 0.11 - i * 0.02, c.z + (i - 1) * 0.075), V(0.7, 0.8, (i - 1) * 0.5), 0.2 - i * 0.02, 0.026, 0, Y, { radial: S(5, 4) }), 'upperarm01', { color: pal.steelD });
    });
  }
  if (has('velocidad')) {
    ak.both(() => { // aletas de espalda barridas hacia atrás, con filo de luz
      const base = V(0.09, 1.3, -0.12), dir = V(0.55, 0.35, -0.85);
      add('metal', X(t.blade(0.78, 0.1, 0.008, { tipLean: 0.1 }), { q: t.basisQ(dir, V(0, 1, 0)), p: [base.x, base.y, base.z] }), 'spine01', { color: pal.steel });
      add('light', X(t.blade(0.7, 0.014, 0.012), { q: t.basisQ(dir, V(0, 1, 0)), p: [base.x + 0.004, base.y + 0.005, base.z - 0.004] }), 'spine01', { color: gl });
    });
    for (let k = 0; k < (low ? 2 : 3); k++) { // estelas de luz que ondean en la espalda baja
      const base = V((k - (low ? 0.5 : 1)) * 0.1, 1.0, -0.14), pts = [0, 1, 2, 3, 4, 5].map((i) => base.clone().add(V((k - 1) * 0.02 * i, -0.04 * i, -0.13 * i)));
      const ch = ak.chain('estela' + k, 'spine03', pts, { stiff: 0.03, damp: 0.94, gravity: 1.2, sway: 1.8 });
      for (let i = 0; i < 5; i++) add('spirit', G.tube([pts[i], pts[i + 1]], 0.05 - i * 0.007, 0.043 - i * 0.007, { radial: 4, tubular: 2, sx: 1, sz: 0.06 }), ch.bones[i].name, { color: gl });
    }
  }
  if (has('simbiosis')) {
    const FLESH = 0xb04a58, FLESH2 = 0xd8707a;
    for (let k = 0; k < (low ? 2 : 3); k++) { // tentáculos largos que salen de la espalda
      const sgn = k === 1 ? 0 : k ? 1 : -1, base = V(sgn * 0.1, 1.22, -0.1), pts = [0, 1, 2, 3, 4, 5, 6].slice(0, low ? 6 : 7).map((i) => base.clone().add(V(sgn * i * 0.055, 0.05 * i - 0.012 * i * i, -0.09 * i - 0.01 * i * i)));
      const ch = ak.chain('tentG' + k, 'spine02', pts, { stiff: 0.06, damp: 0.93, gravity: 2.5, sway: 2.2 });
      for (let i = 0; i < pts.length - 1; i++) add('flesh', G.tube([pts[i], pts[i + 1]], 0.034 - i * 0.0045, 0.029 - i * 0.0045, { radial: S(5, 4), tubular: 2 }), ch.bones[i].name, { color: i % 2 ? FLESH : FLESH2 });
    }
  }
  if (has('anomalia')) { // anillo de grieta vertical detrás de la espalda
    add('dark', X(G.torus(0.52, 0.026, 4, S(26, 12)), { p: [0, 1.4, -0.38], r: [0, 0, 0] }), 'spine01', { color: 0x120a1c });
    add('light', X(G.torus(0.52, 0.007, 3, S(26, 12)), { p: [0, 1.4, -0.352], r: [0, 0, 0] }), 'spine01', { color: 0xb070ff });
  }
  void o;
}
