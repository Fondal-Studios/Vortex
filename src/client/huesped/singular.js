// SINGULAR — EL ASTRO MUERTO (docs/HUESPEDES_ARTE.md · docs/HUESPEDES.md «Singular»). Fue una estrella: murió hace tanto que su luz todavía viaja. Cuerpo de roca estelar partida en placas
// con grietas de oro, cabeza de vidrio negro sin cara con una CORONA DE ECLIPSE (rayos de oro que giran detrás), un hueco en el pecho con una ESTRELLA MUERTA (esfera negra con disco de
// acreción violeta-dorado que late con uBeat), una ESFERA ARMILAR de tres anillos de oro que giran como un giroscopio (con muelle: se inclinan al arrancar y frenar), LUNAS de roca que
// orbitan (una más por Depredador y por Simbiosis: las mismas que lanza la simulación), una luna con anillo en el hombro izquierdo y un arco de anillo roto en el derecho, un cinturón de
// asteroides, una mini-estrella flotando sobre la mano izquierda y el CETRO ORBITAL (planeta con anillo y lunas) en la derecha. Silueta: rayos tras la cabeza + anillos anchos + lunas.
// Se escribe en el marco del modelo (pose de enlace); el lado izquierdo (+x) va dentro de ak.both(); ak.one('R') dibuja sólo la mano/hombro derecho (con coordenadas del lado L).
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { uBeat } from '../shaders.js';
import { PAL, radial, disc, addEvolucionSingular } from './singular-evo.js';

export const BELLY = 0;
export { PAL };
const { ROC, ROC_D, ROC_L, CRY, CRY_V, VIO, VIO_L, ORO, ORO_L, NEG } = PAL;
const TAU = Math.PI * 2;

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, cuff, bonelump, S, low } = t, P = (n) => ak.P(n), add = ak.add, Y = V(0, 1, 0), Zv = V(0, 0, 1), upd = [], R = t.rng(8);
  const HC = V(0, 1.6, 0.04), CC = V(0, 1.285, 0.172), HUB = V(0, 1.22, 0.02), cnew = (h) => new T.Color(h);
  const has = ctx.has, nMoons = Math.min(5, 3 + (has('depredador') ? 1 : 0) + (has('simbiosis') ? 1 : 0));
  { const mm = ak.material('mirror'); mm.envMapIntensity = 1.3; mm.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = min(outgoingLight, vec3(1.15));\n#include <opaque_fragment>'); }; mm.customProgramCacheKey = () => 'singular-vidrio'; } // vidrio negro: refleja el cielo sin quemar el bloom
  // ═══════════════════════════ CABEZA DE ECLIPSE: vidrio negro sin cara, una ranura de luz y la corona de rayos que gira detrás
  {
    add('mirror', X(G.sphere(0.118, S(18, 10), S(14, 8)), { p: [HC.x, HC.y, HC.z], s: [1, 1.1, 1.06] }), 'head', { color: 0x0b0716 });
    add('light', X(G.sphere(0.05, 8, 6), { p: [HC.x, HC.y + 0.012, HC.z + 0.12], s: [1.9, 0.09, 0.3] }), 'head', { color: ORO_L });                    // la ranura: un ojo apagado que aún brilla
    add('ember', X(G.torus(0.122, 0.0032, 3, S(30, 14)), { p: [HC.x, HC.y + 0.004, HC.z], r: [0.12, 0, 0.18], s: [1, 1, 1.06] }), 'head', { color: ORO });  // línea de horizonte alrededor del cráneo
    const cor = ak.bone('corona', 'head', V(HC.x, HC.y, HC.z - 0.1)), N = low ? 14 : 22;
    for (let i = 0; i < N; i++) { // corona: rayos largos y cortos alternados, en un plano vertical detrás de la cabeza
      const a = (i / N) * TAU + 0.1, long = i % 2 === 0, len = long ? 0.36 + 0.07 * Math.sin(i * 1.7) : 0.2, r0 = 0.155;
      add('ember', spikeAt(V(HC.x + Math.cos(a) * r0, HC.y + Math.sin(a) * r0, HC.z - 0.1), V(Math.cos(a), Math.sin(a), -0.45), len, long ? 0.0125 : 0.008, 0, Zv, { radial: 3, tubular: 2 }), 'corona', { color: long ? ORO : ORO_L });
    }
    add('light', X(G.torus(0.145, 0.0042, 3, S(36, 16)), { p: [HC.x, HC.y, HC.z - 0.1], r: [Math.PI / 2, 0, 0] }), 'corona', { color: ORO_L });
    ak.halo('head', V(HC.x, HC.y, HC.z - 0.12), VIO, 0.62, 0.3);   // fulgor violeta tras la corona
    upd.push((dt, tt) => { cor.rotation.z = tt * 0.22; });
    // collar: anillo de rocas flotando alrededor del cuello
    const neck = ak.bone('collar', 'neck01', V(0, 1.43, 0.01));
    for (let i = 0; i < (low ? 6 : 9); i++) { const a = (i / (low ? 6 : 9)) * TAU, s = 0.028 + R() * 0.018; add('stone', X(bonelump(s, [1, 0.7, 1.2], i, 0.3), { p: [Math.cos(a) * 0.115, 1.43 + (R() - 0.5) * 0.03, 0.01 + Math.sin(a) * 0.105], r: [R() * 3, a, R() * 3] }), 'collar', { color: i % 2 ? ROC : ROC_L }); }
    upd.push((dt, tt) => { neck.rotation.y = -tt * 0.3; });
  }

  // ═══════════════════════════ PECHO: pétalos de corteza alrededor de la ESTRELLA MUERTA (esfera negra + disco de acreción) y grietas de oro
  {
    const shell = G.lathe([[0.15, 1.2], [0.168, 1.26], [0.172, 1.32], [0.16, 1.38], [0.135, 1.42], [0.09, 1.445]], S(18, 10), 0, TAU, 34);
    add('stone', X(shell, { p: [0, 0, 0.012], s: [1.04, 1, 0.84] }), 'spine01', { color: ROC_D });
    for (let i = 0; i < 3; i++) { // abdomen en estratos: bandas de roca con un hueco de luz entre cada una
      add('stone', G.band(0.14 + 0.006 * i, 0.062, 0.03, { seg: S(18, 10), sz: 0.82, simple: low }).translate(0, 1.15 - i * 0.075, 0.02), i < 1 ? 'spine02' : 'spine03', { color: i % 2 ? ROC : ROC_L });
      add('ember', G.torus(0.158 + 0.006 * i, 0.0034, 3, S(24, 12)).scale(1, 1, 0.82).translate(0, 1.115 - i * 0.075, 0.02), i < 1 ? 'spine02' : 'spine03', { color: i % 2 ? VIO : ORO });
    }
    const np = low ? 7 : 9;
    for (let i = 0; i < np; i++) { // pétalos de roca: placas abiertas hacia afuera como una flor de corteza
      const a = (i / np) * TAU + 0.2, len = 0.13 + 0.035 * ((i * 5) % 3);
      const g = G.plate([[-0.034, 0], [0.034, 0], [0.046, len * 0.7], [0, len], [-0.046, len * 0.7]], 0.02, 0.006, { crease: 40 });
      g.rotateX(-0.5).translate(0, 0.075, 0).rotateZ(a - Math.PI / 2).translate(CC.x, CC.y, CC.z - 0.01);
      add('stone', g, i < np / 2 ? 'spine01' : 'spine02', { color: i % 3 === 0 ? ROC_L : i % 3 === 1 ? ROC : ROC_D });
      if (!low || i % 2 === 0) add('ember', seam([V(CC.x + Math.cos(a) * 0.08, CC.y + Math.sin(a) * 0.08, CC.z + 0.02), V(CC.x + Math.cos(a) * 0.16, CC.y + Math.sin(a) * 0.16, CC.z + 0.04), V(CC.x + Math.cos(a) * (0.26 + 0.04 * (i % 2)), CC.y + Math.sin(a) * (0.26 + 0.04 * (i % 2)), CC.z - 0.03)], 0.0024), 'spine01', { color: ORO });
    }
    add('ember', G.torus(0.078, 0.0045, 3, S(26, 14)).rotateX(Math.PI / 2).translate(CC.x, CC.y, CC.z - 0.005), 'spine01', { color: ORO });
    // la estrella: núcleo negro + disco de acreción oblicuo (gira) + anillo de fotones; late con uBeat
    const nuc = ak.bone('nucleo', 'spine01', CC), disk = ak.bone('disco', 'nucleo', CC);
    add('mirror', G.sphere(0.052, S(14, 9), S(10, 7)).translate(CC.x, CC.y, CC.z), 'nucleo', { color: NEG });
    add('spirit', X(disc(0.062, 0.19, S(34, 16)), { p: [CC.x, CC.y, CC.z], r: [0.0, 0, 0] }), 'disco', { color: radial(0.062, 0.19, 0xfff0b0, 0x7a38d8) });
    add('light', G.torus(0.066, 0.0034, 3, S(26, 12)).translate(CC.x, CC.y, CC.z), 'disco', { color: ORO_L });
    if (!low) add('ember', G.torus(0.12, 0.0026, 3, S(30, 14)).translate(CC.x, CC.y, CC.z), 'disco', { color: ORO });
    nuc.rotation.set(1.05, 0, 0.35);   // el disco se ve oblicuo desde el frente
    ak.halo('nucleo', V(CC.x, CC.y, CC.z + 0.05), VIO, 0.36, 0.34);
    upd.push((dt, tt) => { disk.rotation.y = tt * 1.4; nuc.scale.setScalar(1 + 0.18 * uBeat.value); });
    // espaldar: losa de roca partida con grietas de oro (corteza continental)
    for (const [dx, dy, s, sd] of [[-0.07, 1.34, 0.1, 1], [0.08, 1.3, 0.11, 2], [0.0, 1.2, 0.12, 3], [-0.1, 1.15, 0.08, 4]]) add('stone', X(bonelump(s, [1.3, 1, 0.55], sd, 0.3), { p: [dx, dy, -0.1], r: [0.2 * sd, sd, 0] }), 'spine02', { color: sd % 2 ? ROC : ROC_L });
    add('ember', seam([V(-0.14, 1.4, -0.14), V(-0.04, 1.3, -0.16), V(0.04, 1.22, -0.15), V(0.12, 1.1, -0.15)], 0.003), 'spine02', { color: ORO });
    add('ember', seam([V(0.12, 1.4, -0.14), V(0.06, 1.32, -0.15), V(0.0, 1.24, -0.15)], 0.0026), 'spine02', { color: VIO });
  }

  // ═══════════════════════════ ESFERA ARMILAR: tres anillos de oro en cardán (giran distinto, con muelle) y lunas de roca que orbitan
  {
    const gA = ak.bone('gA', 'spine02', HUB), gB = ak.bone('gB', 'gA', HUB), gC = ak.bone('gC', 'gB', HUB), RA = 0.66, RB = 0.55, RC = 0.45;
    const ring = (bone, Rr, axis, col, tube, beads) => {
      const g = G.torus(Rr, tube, 3, S(44, 22)); if (axis === 'z') g.rotateX(Math.PI / 2); if (axis === 'x') g.rotateZ(Math.PI / 2); g.translate(HUB.x, HUB.y, HUB.z);
      add('ember', g, bone, { color: col });
      for (let i = 0; i < beads; i++) { // planetas pequeños sobre el anillo
        const a = (i / beads) * TAU + (axis === 'y' ? 0.3 : axis === 'z' ? 1.1 : 2), p = axis === 'y' ? [Math.cos(a) * Rr, 0, Math.sin(a) * Rr] : axis === 'z' ? [Math.cos(a) * Rr, Math.sin(a) * Rr, 0] : [0, Math.cos(a) * Rr, Math.sin(a) * Rr];
        add('light', G.sphere(0.018 + 0.006 * (i % 2), 6, 5).translate(HUB.x + p[0], HUB.y + p[1], HUB.z + p[2]), bone, { color: i % 2 ? VIO_L : ORO_L });
      }
      if (!low) for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, p = axis === 'y' ? [Math.cos(a) * Rr, 0, Math.sin(a) * Rr] : axis === 'z' ? [Math.cos(a) * Rr, Math.sin(a) * Rr, 0] : [0, Math.cos(a) * Rr, Math.sin(a) * Rr]; add('ember', t.box(0.008, 0.026, 0.008, 0.002, 1).translate(HUB.x + p[0], HUB.y + p[1], HUB.z + p[2]), bone, { color: ORO_L }); }   // graduaciones
    };
    ring('gA', RA, 'y', ORO, 0.011, 3); ring('gB', RB, 'z', VIO, 0.009, 3); ring('gC', RC, 'x', ORO_L, 0.008, 2);
    // lunas: roca con una veta de cristal violeta; cada una orbita en su propio plano
    const moons = [], mP = ak.bone('moP', 'spine02', HUB);
    for (let i = 0; i < nMoons; i++) {
      const ob = ak.bone(`mo${i}`, 'moP', HUB), rad = 0.86 + 0.07 * (i % 2), a = 0, y = (i - 2) * 0.05, sz = 0.05 + 0.012 * (i % 3), p = V(HUB.x + Math.cos(a) * rad, HUB.y + y, HUB.z + Math.sin(a) * rad);
      const mb = ak.bone(`mo${i}m`, `mo${i}`, p);
      add('stone', X(bonelump(sz, [1, 0.9, 1.1], 20 + i, 0.34), { p: [p.x, p.y, p.z] }), `mo${i}m`, { color: i % 2 ? ROC_L : ROC });
      add('crystal', X(new T.OctahedronGeometry(sz * 0.5, 0), { p: [p.x + sz * 0.5, p.y + sz * 0.35, p.z + sz * 0.5], s: [0.8, 1.3, 0.8] }), `mo${i}m`, { color: CRY_V });
      add('ember', X(G.torus(sz * 1.5, 0.0032, 3, S(16, 10)), { p: [p.x, p.y, p.z], r: [0.5, 0, 0.3] }), `mo${i}m`, { color: ORO });
      moons.push({ ob, mb, ph: (i / nMoons) * TAU, w: 0.55 + 0.17 * (i % 3), y0: y });
    }
    // física: cada anillo es un resorte amortiguado (se inclina al arrancar o frenar y vuelve), y giran más rápido cuanto más corrés (Velocidad: más aún)
    let spd = 0, last = 0; const wob = [0, 0, 0], wv = [0, 0, 0], ang = [0, 0, 0], fast = has('velocidad') ? 1.5 : 1;
    upd.push((dt, tt, c) => {
      const s = (c && c.speed) || 0; spd += (s - spd) * Math.min(1, dt * 5); const acc = dt > 0 ? Math.max(-40, Math.min(40, (s - last) / dt)) : 0; last = s;
      for (let i = 0; i < 3; i++) { wv[i] += (-46 * wob[i] - 3.4 * wv[i] + acc * (0.012 + 0.006 * i) * (i === 1 ? -1 : 1)) * dt; wob[i] = Math.max(-0.5, Math.min(0.5, wob[i] + wv[i] * dt)); }
      const k = (1 + spd * 0.16) * fast; ang[0] += dt * 0.34 * k; ang[1] += dt * 0.27 * k; ang[2] += dt * 0.44 * k;
      gA.rotation.set(0.28 + wob[0], ang[0], 0); gB.rotation.set(0.7 + wob[1], 0, ang[1]); gC.rotation.set(0.2, ang[2], 0.55 + wob[2]);
      mP.rotation.set(0.32 + 0.1 * Math.min(1, spd / 7) + wob[0] * 0.5, 0, 0.18 + wob[2] * 0.5);
      for (const m of moons) { m.ob.rotation.y = m.ph + tt * m.w * k; m.mb.rotation.set(tt * 0.9 + m.ph, tt * 0.7, 0); }
    });
  }

  // ═══════════════════════════ HOMBROS: luna con anillo (izquierdo) y arco de anillo roto (derecho)
  ak.one('L', () => {
    const S0 = P('upperarm01'), P0 = S0.clone().add(V(0.035, 0.085, 0.0));
    const mo = ak.bone('lunaH', 'upperarm01', P0), sat = ak.bone('lunaS', 'lunaH', P0), satm = ak.bone('lunaSm', 'lunaS', P0.clone().add(V(0.25, 0.02, 0)));
    add('stone', X(bonelump(0.135, [1.05, 0.85, 1.05], 5, 0.3), { p: [P0.x, P0.y, P0.z] }), 'upperarm01', { color: ROC_L });
    for (const [dx, dz, s] of [[0.04, 0.09, 0.035], [-0.05, 0.05, 0.026], [0.08, -0.03, 0.03]]) add('mirror', X(G.cyl(s, s * 0.8, 0.012, S(10, 6)), { p: [P0.x + dx, P0.y + 0.1, P0.z + dz], r: [-0.2, 0, 0.1] }), 'upperarm01', { color: 0x0e0a18 });   // cráteres de vidrio negro
        add('ember', X(G.torus(0.2, 0.0028, 3, S(30, 16)), { p: [P0.x, P0.y, P0.z], r: [0.25, 0, -0.35] }), 'upperarm01', { color: ORO });
    add('stone', X(bonelump(0.032, [1, 1, 1], 9, 0.3), { p: [P0.x + 0.25, P0.y + 0.02, P0.z] }), 'lunaSm', { color: ROC });
    add('crystal', X(new T.OctahedronGeometry(0.02, 0), { p: [P0.x + 0.25, P0.y + 0.05, P0.z] }), 'lunaSm', { color: CRY_V });
    mo.rotation.set(0, 0, 0); void mo;
    upd.push((dt, tt) => { sat.rotation.y = tt * 1.1; satm.rotation.set(tt, tt * 0.7, 0); });
  });
  ak.one('R', () => {
    const S0 = P('upperarm01'), C0 = S0.clone().add(V(0.0, 0.1, 0.0)), pts = [];
    for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.05 + 0.85 * (i / 8)); pts.push(V(C0.x + Math.cos(a) * 0.27 - 0.02, C0.y + Math.sin(a) * 0.26 - 0.04, C0.z - 0.02 + 0.02 * Math.sin(a * 3))); }   // medio anillo que sube sobre el hombro y se corta
    add('stone', G.tube(pts, 0.036, 0.016, { radial: S(7, 5), tubular: S(18, 9), ridges: 4, ridgeAmp: 0.2, ease: 0.8 }), 'upperarm01', { color: ROC_L });
    add('ember', G.tube(pts.map((p) => p.clone().add(V(0, 0, 0.026))), 0.0045, 0.0028, { radial: 3, tubular: S(18, 9), closeStart: true }), 'upperarm01', { color: ORO });
    for (const [i, s] of [[3, 0.03], [5, 0.024], [7, 0.02]]) add('crystal', X(new T.OctahedronGeometry(s, 0), { p: [pts[i].x, pts[i].y + s * 1.4, pts[i].z], s: [0.7, 1.8, 0.7] }), 'upperarm01', { color: CRY_V });   // cristales sobre el arco
    add('stone', X(bonelump(0.07, [1.1, 0.8, 1], 12, 0.3), { p: [S0.x + 0.03, S0.y + 0.06, S0.z] }), 'upperarm01', { color: ROC });
    add('stone', X(bonelump(0.045, [1, 0.8, 1], 13, 0.3), { p: [pts[8].x, pts[8].y, pts[8].z] }), 'upperarm01', { color: ROC_D });   // el extremo roto
    add('ember', X(G.sphere(0.014, 6, 4), { p: [pts[8].x, pts[8].y - 0.02, pts[8].z] }), 'upperarm01', { color: VIO_L });
  });

  // ═══════════════════════════ BRAZOS Y MANOS: brazales de estratos, esquirlas de cristal en el codo y garras de vidrio negro
  ak.both((s) => {
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist');
    for (let i = 0; i < 2; i++) add('stone', limb(cuff(0.088 - i * 0.008, 0.082 - i * 0.008, 0.07, 0.014, S(10, 7), 30), S0, E0, 0.3 + i * 0.3), 'upperarm01', { color: i ? ROC : ROC_L });
    add('ember', t.ringAt(S0, E0, 0.5, 0.092, 0.012, 0.004), 'upperarm01', { color: ORO });
    for (let i = 0; i < 3; i++) add('stone', limb(cuff(0.066 + i * 0.006, 0.06 + i * 0.006, 0.06, 0.012, S(10, 7), 30), E0, W0, 0.22 + i * 0.26), 'lowerarm01', { color: i === 1 ? ROC_L : ROC });
    for (const u of [0.38, 0.64]) add('ember', t.ringAt(E0, W0, u, 0.07, 0.01, 0.005), 'lowerarm01', { color: ORO });
    add('ember', seam([E0.clone().add(V(0.02, -0.03, 0.06)), E0.clone().lerp(W0, 0.5).add(V(0.02, 0, 0.065)), W0.clone().add(V(0.0, 0.03, 0.06))], 0.0026), 'lowerarm01', { color: VIO });
    for (const [dx, dy, dz, L, r] of [[0.03, 0.04, -0.07, 0.17, 0.02], [0.07, 0.0, -0.06, 0.12, 0.016], [-0.01, -0.03, -0.075, 0.1, 0.014]]) add('crystal', spikeAt(E0.clone().add(V(dx, dy, dz)), V(0.3 + dx * 2, 0.15, -1), L, r, 0.01, Y, { radial: 4 }), 'lowerarm01', { color: dx > 0.02 ? CRY_V : CRY });   // esquirlas en el codo
    for (const [f, len, r] of [['finger2', 0.085, 0.008], ['finger3', 0.1, 0.009], ['finger4', 0.09, 0.008], ['finger5', 0.065, 0.007]]) {
      const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize();
      add('mirror', spikeAt(b.clone().addScaledVector(d, 0.004), d.clone().add(V(0, -0.1, 0.1)), len, r, -0.014, V(0, 0.4, 0.2), { radial: S(4, 4) }), `${f}-3`, { color: 0x14102a });
    }
    void s;
  });

  // mini-estrella flotando sobre la palma izquierda (se mueve con la mano)
  ak.one('L', () => {
    const W0 = P('wrist'), c = W0.clone().add(V(0.01, 0.13, 0.06)), ob = ak.bone('miniE', 'wrist', c);
    add('mirror', G.sphere(0.038, S(12, 8), S(9, 6)).translate(c.x, c.y, c.z), 'miniE', { color: NEG });
    add('spirit', X(disc(0.045, 0.11, S(24, 12)), { p: [c.x, c.y, c.z], r: [0.5, 0, 0.3] }), 'miniE', { color: radial(0.045, 0.11, 0xfff0b0, 0x7a38d8) });
    add('light', X(G.torus(0.047, 0.0028, 3, S(18, 10)), { p: [c.x, c.y, c.z], r: [0.5, 0, 0.3] }), 'miniE', { color: ORO_L });
    upd.push((dt, tt) => { ob.rotation.y = tt * 2.2; ob.position.y += 0; });
  });

  // ═══════════════════════════ CETRO ORBITAL (mano derecha): báculo de cristal oscuro con un planeta anillado y lunas (si el jugador fusionó un arma melee, ella ocupa la mano)
  if (!ctx.melee) ak.one('R', () => {
    const W0 = P('wrist'), D = V(0.06, 1, 0.16).normalize(), tip = (u) => W0.clone().addScaledVector(D, u), seg = (g, u, off = [0, 0, 0], r = [0, 0, 0]) => limb(g, W0, tip(1), u, { off, r });
    add('crystal', seg(G.cyl(0.016, 0.014, 1.3, S(8, 5)), 0.32), 'wrist', { color: CRY });
    for (const u of [-0.15, 0.1, 0.5, 0.78]) add('ember', seg(G.torus(0.024, 0.0055, 3, S(12, 7)), u), 'wrist', { color: ORO });
    add('ember', seg(G.cyl(0.0045, 0.0045, 1.0, 3), 0.36, [0.015, 0, 0]), 'wrist', { color: VIO });
    const pc = tip(1.0), pb = ak.bone('cetroP', 'wrist', pc), mA = ak.bone('cetroM', 'cetroP', pc);
    add('stone', X(bonelump(0.1, [1, 0.95, 1], 31, 0.3), { p: [pc.x, pc.y, pc.z] }), 'wrist', { color: ROC_L });
    add('crystal', X(new T.OctahedronGeometry(0.035, 0), { p: [pc.x + 0.03, pc.y + 0.065, pc.z + 0.03], s: [0.8, 1.4, 0.8] }), 'wrist', { color: CRY_V });
    add('ember', X(G.torus(0.17, 0.006, 3, S(30, 16)), { p: [pc.x, pc.y, pc.z], r: [0.5, 0, 0.25] }), 'wrist', { color: ORO });
    for (let i = 0; i < 2; i++) { const a = i * Math.PI, mp = V(pc.x + Math.cos(a) * 0.22, pc.y + 0.02, pc.z + Math.sin(a) * 0.22); add('stone', X(bonelump(0.024, [1, 1, 1], 40 + i, 0.3), { p: [mp.x, mp.y, mp.z] }), 'cetroM', { color: ROC }); add('light', G.sphere(0.01, 5, 4).translate(mp.x, mp.y + 0.03, mp.z), 'cetroM', { color: VIO_L }); }
    for (let i = 0; i < 3; i++) add('crystal', spikeAt(tip(-0.2).add(V(0, 0, 0)), V(Math.cos(i * 2.1) * 0.5, -1, Math.sin(i * 2.1) * 0.5), 0.1, 0.012, 0, Y, { radial: 4 }), 'wrist', { color: CRY });   // contera de esquirlas
    upd.push((dt, tt) => { pb.rotation.y = tt * 0.0; mA.rotation.y = tt * 1.3; });
  });

  // ═══════════════════════════ CINTURÓN DE ASTEROIDES + piernas de estratos
  {
    const belt = ak.bone('cinto', 'spine05', V(0, 0.95, 0.01)), nB = low ? 8 : 12;
    for (let i = 0; i < nB; i++) { const a = (i / nB) * TAU, r = 0.3 + 0.03 * ((i * 7) % 3), s = 0.026 + 0.022 * ((i * 5) % 3); add('stone', X(bonelump(s, [1.2, 0.8, 1], 50 + i, 0.34), { p: [Math.cos(a) * r, 0.95 + 0.04 * Math.sin(i * 2.3), 0.01 + Math.sin(a) * r * 0.9], r: [R() * 3, a, R() * 3] }), 'cinto', { color: i % 3 === 0 ? ROC_L : ROC }); }
    add('ember', X(G.torus(0.285, 0.0034, 3, S(34, 16)), { p: [0, 0.95, 0.01], s: [1, 1, 0.9] }), 'cinto', { color: ORO });
    upd.push((dt, tt) => { belt.rotation.y = tt * 0.28; });
    ak.both(() => {
      const H = P('upperleg01'), K = P('lowerleg01'), A = P('foot');
      for (let i = 0; i < 2; i++) add('stone', limb(cuff(0.098 - i * 0.01, 0.088 - i * 0.01, 0.1, 0.014, S(10, 7), 30), H, K, 0.28 + i * 0.3), 'upperleg01', { color: i ? ROC : ROC_L });
      add('stone', X(bonelump(0.06, [1.1, 1, 0.9], 60, 0.3), { p: [K.x, K.y, K.z + 0.05] }), 'lowerleg01', { color: ROC_L });
      add('crystal', spikeAt(K.clone().add(V(0, 0.02, 0.08)), V(0.1, 0.25, 1), 0.14, 0.02, 0.01, Y, { radial: 4 }), 'lowerleg01', { color: CRY_V });   // rótula de cristal
      for (let i = 0; i < 2; i++) add('stone', limb(cuff(0.072 - i * 0.006, 0.058 - i * 0.004, 0.14, 0.012, S(10, 7), 30), K, A, 0.3 + i * 0.36), 'lowerleg01', { color: i ? ROC_D : ROC });
      add('ember', t.ringAt(K, A, 0.28, 0.078, 0.01, 0.004), 'lowerleg01', { color: ORO });
      add('stone', X(bonelump(0.075, [0.9, 0.62, 1.55], 61, 0.28), { p: [A.x, A.y - 0.03, A.z + 0.06] }), 'foot', { color: ROC });
    });
  }

  ak.embers(ORO, low ? 18 : 36, { radius: 0.7, height: 2.2, size: 5 });
  if (!low) ak.embers(VIO, 22, { radius: 1.0, height: 2.0, size: 9 });

  const evo = addEvolucionSingular(ak, ctx, { t, upd, has, nMoons });
  return { update: (dt, tt, c) => { for (const f of upd) f(dt, tt, c); evo.update(dt, tt, c); } };
}
