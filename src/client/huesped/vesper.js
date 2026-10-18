// VESPER — BESTIA CAZADORA (docs/HUESPEDES_ARTE.md). Cráneo de lobo como casco (hocico largo, mandíbula que respira, orejas que se mueven, ojos fosforescentes), torso estrecho de
// felino con costillar de hueso abierto y placas traslúcidas violetas con costuras de nervios luminosos, melena de velos y pelaje de púas de cristal, garras largas, patas
// «digitígradas» (espolón de corvejón, greba que se estrecha, pata-pezuña con dedos largos) y una cola de nervios con física de muelles. Luz interior violeta que late con uBeat.
// Se escribe en el marco del modelo (pose de enlace); el lado izquierdo (+x) va dentro de ak.both().
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';

export const BELLY = 0;
const BONE = 0xe8dcc4, BONE_D = 0xb3a386, BONE_L = 0xfff6e4, DARK = 0x1a1426, DARK2 = 0x2c2140, LEATH = 0x4a3040, VIO = 0xb04bff, VIO_D = 0x7a35d0, MAG = 0xff5ad8, EYE = 0xb8ff6a;

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, ringAt, dome, cuff, bonelump, S, low } = t, P = (n) => ak.P(n), add = ak.add;
  const HC = V(0, 1.6, 0.06), Y = V(0, 1, 0), Zv = V(0, 0, 1), upd = [], zc = 0.045;
  const PL = (bone, pts, o) => t.armorPlate(bone, pts, { trimColor: MAG, ...o });

  // ═══════════════════════════ CABEZA: cráneo de lobo
  {
    const shell = G.lathe([[0.1, -0.075], [0.108, -0.035], [0.112, 0.015], [0.105, 0.07], [0.086, 0.113], [0.054, 0.139], [0.018, 0.152], [0, 0.155]], S(16, 10), 0, Math.PI * 2, 34); X(shell, { p: [HC.x, HC.y, HC.z - 0.005], s: [1.02, 1, 1.2] });
    add('bone', shell, 'head', { color: BONE });
    // frente: placa de cristal con costuras de nervios que bajan a los ojos
    PL('head', [[-0.04, 0.0], [0.04, 0.0], [0.05, 0.05], [0.0, 0.085], [-0.05, 0.05]], { mat: 'crystal', depth: 0.014, bevel: 0.004, wrap: { rx: 0.116, rz: 0.15 }, color: VIO_D, trim: 'ember', trimInset: 0.2, trimR: 0.0026, place: (g) => X(g, { p: [HC.x, HC.y + 0.045, HC.z - 0.005], r: [-0.18, 0, 0] }) });
    // cresta sagital que corre hacia atrás
    const crest = G.plate([[0.06, 0.0], [0.07, 0.05], [0.03, 0.095], [-0.02, 0.06], [-0.06, 0.1], [-0.1, 0.05], [-0.14, 0.075], [-0.18, 0.02], [-0.21, -0.03], [-0.12, -0.01]], 0.012, 0.003); X(crest, { r: [0, -Math.PI / 2, 0] });
    X(crest, { p: [HC.x, HC.y + 0.1, HC.z - 0.01] }); add('bone', crest, 'head', { color: BONE_D });
    // hocico largo (puente + dorso) y nariz
    const snout = G.tube([V(0, 0.005, 0.07), V(0, -0.012, 0.17), V(0, -0.03, 0.28), V(0, -0.038, 0.35)], 0.07, 0.036, { radial: S(9, 6), tubular: S(8, 4), sx: 1, sz: 0.78, ease: 0.9 }); X(snout, { p: [HC.x, HC.y, HC.z] });
    add('bone', snout, 'head', { color: BONE });
    add('bone', X(G.tube([V(0, 0.058, 0.09), V(0, 0.045, 0.2), V(0, 0.015, 0.3)], 0.014, 0.011, { radial: 4, tubular: 6 }), { p: [HC.x, HC.y, HC.z] }), 'head', { color: BONE_L });
    add('dark', X(G.sphere(0.034, S(8, 6), S(6, 5)), { p: [HC.x, HC.y - 0.03, HC.z + 0.355], s: [1, 0.8, 0.8] }), 'head', { color: 0x07050c });
    add('light', X(G.sphere(0.009, 5, 4), { p: [HC.x, HC.y - 0.016, HC.z + 0.375], s: [1.6, 0.6, 0.6] }), 'head', { color: MAG });
    // costuras de luz sobre el hocico y la frente
    add('light', seam([V(0.012, HC.y + 0.1, HC.z + 0.07), V(0.016, HC.y + 0.06, HC.z + 0.16), V(0.012, HC.y + 0.02, HC.z + 0.25), V(0.01, HC.y - 0.0, HC.z + 0.33)], 0.0026), 'head', { color: VIO });
    add('light', seam([V(-0.012, HC.y + 0.1, HC.z + 0.07), V(-0.016, HC.y + 0.06, HC.z + 0.16), V(-0.012, HC.y + 0.02, HC.z + 0.25), V(-0.01, HC.y - 0.0, HC.z + 0.33)], 0.0026), 'head', { color: VIO });
    // mandíbula articulada (respira / gruñe)
    const jaw = ak.bone('mandibula', 'head', V(0, HC.y - 0.075, HC.z + 0.03));
    add('bone', X(G.tube([V(0, -0.015, 0.03), V(0, -0.035, 0.15), V(0, -0.045, 0.27), V(0, -0.04, 0.33)], 0.05, 0.026, { radial: S(8, 6), tubular: S(8, 4), sx: 1, sz: 0.55, ease: 0.9 }), { p: [HC.x, HC.y - 0.06, HC.z] }), 'mandibula', { color: BONE_D });
    add('dark', X(G.tube([V(0, 0.01, 0.06), V(0, 0.0, 0.2), V(0, -0.005, 0.3)], 0.034, 0.02, { radial: 5, tubular: 5, sx: 1, sz: 0.4 }), { p: [HC.x, HC.y - 0.052, HC.z] }), 'mandibula', { color: 0x0a0612 });
    ak.both((sd) => {
      add('bone', spikeAt(V(HC.x + 0.052, HC.y - 0.055, HC.z + 0.3), V(0.04, 1, 0.12), 0.06, 0.011, 0.0, Zv, { radial: 4 }), 'mandibula', { color: BONE_L });
      for (let i = 0; i < (low ? 2 : 4); i++) add('bone', spikeAt(V(HC.x + 0.035, HC.y - 0.058, HC.z + 0.13 + i * 0.055), V(0.0, 1, 0.1), 0.026, 0.0075, 0, Zv, { radial: 4, tubular: 2 }), 'mandibula', { color: BONE_L });
      // colmillos del hocico (arriba) y dientes
      add('bone', spikeAt(V(HC.x + 0.05, HC.y - 0.032, HC.z + 0.285), V(0.08, -1, 0.1), 0.085, 0.013, 0.012, Zv, { radial: S(6, 4) }), 'head', { color: BONE_L });
      for (let i = 0; i < (low ? 2 : 4); i++) add('bone', spikeAt(V(HC.x + 0.045, HC.y - 0.025, HC.z + 0.14 + i * 0.045), V(0, -1, 0.05), 0.03, 0.008, 0, Zv, { radial: 4, tubular: 2 }), 'head', { color: BONE_L });
      // ojos fosforescentes en cuenca oscura
      PL('head', [[0.012, 0.0], [0.05, 0.02], [0.09, 0.016], [0.09, -0.004], [0.05, -0.022], [0.012, -0.016]], { depth: 0.014, bevel: 0.004, wrap: { rx: 0.111, rz: 0.142 }, color: 0x0a0612, place: (g) => X(g, { p: [HC.x, HC.y + 0.0, HC.z - 0.005], r: [0, 0, 0.16] }) });
      add('light', G.wrapE(G.plate([[0.02, 0.0], [0.05, 0.014], [0.082, 0.014], [0.07, -0.002], [0.04, -0.013]], 0.012, 0.002), 0.113, 0.145).rotateZ(0.16).translate(HC.x, HC.y + 0.0, HC.z - 0.005), 'head', { color: EYE });
      add('dark', X(G.wrapE(G.plate([[0.0, 0.0], [0.05, 0.028], [0.1, 0.03], [0.1, 0.022], [0.05, 0.016]], 0.014, 0.004), 0.113, 0.144), { p: [HC.x, HC.y + 0.03, HC.z - 0.005], r: [0, 0, 0.1] }), 'head', { color: 0x0a0612 }); // ceja que hunde la mirada
      ak.halo('head', V(0.058, HC.y + 0.0, HC.z + 0.13), EYE, 0.13, 0.55);
      // oreja: cuero + hueso por fuera, cristal por dentro; se mueve (hueso propio)
      const eb = ak.bone('oreja' + sd, 'head', V(HC.x + 0.07, HC.y + 0.09, HC.z - 0.045));
      add('bone', X(G.spike(0.2, 0.052, -0.03, { radial: 4, tubular: S(6, 3), sx: 1, sz: 0.34, tip: 0.001 }), { p: [HC.x + 0.07, HC.y + 0.09, HC.z - 0.045], r: [-0.12, 0, -0.34] }), 'oreja' + sd, { color: BONE_D });
      add('crystal', X(G.spike(0.17, 0.036, -0.03, { radial: 4, tubular: S(6, 3), sx: 1, sz: 0.3, tip: 0.001 }), { p: [HC.x + 0.07, HC.y + 0.094, HC.z - 0.036], r: [-0.12, 0, -0.34] }), 'oreja' + sd, { color: VIO });
      if (!low) add('bone', spikeAt(V(HC.x + 0.085, HC.y + 0.2, HC.z - 0.055), V(0.2, 1, -0.2), 0.07, 0.004, 0.0, Zv, { radial: 3, tubular: 3 }), 'oreja' + sd, { color: BONE_L }); // mechón de la punta
      upd.push((dt, tt) => { const k = tt * 1.1 + (sd === 'L' ? 0 : 1.7); eb.rotation.z = (Math.sin(tt * 0.9) * 0.05 + Math.max(0, Math.sin(tt * 0.37 + 1)) ** 6 * 0.35) * -1; eb.rotation.x = Math.sin(tt * 1.3 + k) * 0.03; });
      // mejilla: placa de cristal y púas de pelaje hacia atrás
      PL('head', [[0.0, 0.05], [0.07, 0.035], [0.1, -0.02], [0.06, -0.07], [0.0, -0.045]], { mat: 'crystal', depth: 0.014, bevel: 0.004, wrap: { rx: 0.112, rz: 0.14 }, color: VIO_D, trim: 'ember', trimInset: 0.22, trimR: 0.0025, place: (g) => X(g, { p: [HC.x, HC.y - 0.05, HC.z - 0.01], r: [0, 0.32, 0] }) });
      for (let i = 0; i < (low ? 2 : 3); i++) add('bone', spikeAt(V(HC.x + 0.1, HC.y - 0.04 - i * 0.03, HC.z - 0.03 - i * 0.012), V(0.7, -0.15 - i * 0.2, -0.8), 0.12 - i * 0.02, 0.012, 0.01, Y, { radial: 4 }), 'head', { color: BONE_D });
    });
    upd.push((dt, tt) => { jaw.rotation.x = 0.1 + 0.05 * Math.sin(tt * 1.6) + 0.06 * Math.max(0, Math.sin(tt * 0.5)) ** 4; });
    // gorguera: aro de hueso y collar de púas de pelaje que sube hacia el cráneo
    add('bone', G.band(0.074, 0.03, 0.012, { seg: S(16, 8) }).translate(0, 1.452, 0.026), 'neck01', { color: BONE_D });
    add('dark', G.band(0.078, 0.02, 0.012, { seg: S(16, 8) }).translate(0, 1.43, 0.026), 'neck01', { color: DARK2 });
    add('light', G.torus(0.081, 0.0032, 3, S(16, 8)).translate(0, 1.44, 0.026), 'neck01', { color: VIO });
    const nn = low ? 7 : 11;
    for (let i = 0; i < nn; i++) { const a = (i / nn) * Math.PI * 2, r = 0.085, up = Math.cos(a) < -0.2; add(i % 2 ? 'crystal' : 'bone', spikeAt(V(Math.sin(a) * r, 1.45, 0.026 + Math.cos(a) * r), V(Math.sin(a) * 0.9, up ? 1.0 : 0.5, Math.cos(a) * 0.9 - (up ? 0.1 : 0.0)), up ? 0.15 : 0.1, 0.014, 0.02, Y, { radial: 4, tubular: 4 }), 'neck01', { color: i % 2 ? VIO : BONE_D }); }
  }

  // ═══════════════════════════ TORSO felino: costillar abierto, esternón de cristal, arnés
  {
    // dorsal: esternón-placa traslúcida con núcleo de luz
    PL('spine01', [[0.0, 0.135], [0.04, 0.1], [0.052, 0.0], [0.034, -0.1], [0, -0.14], [-0.034, -0.1], [-0.052, 0.0], [-0.04, 0.1]], { mat: 'crystal', depth: 0.03, bevel: 0.01, wrap: { rx: 0.14, rz: 0.12 }, color: VIO_D, trim: 'ember', trimInset: 0.25, trimR: 0.0028, place: (g) => X(g, { p: [0, 1.285, zc + 0.002], r: [0.06, 0, 0] }) });
    add('light', G.sphere(0.026, S(10, 7), S(8, 6)).translate(0, 1.283, 0.186), 'spine01', { color: MAG });
    add('crystal', X(new T.OctahedronGeometry(0.04, 0), { p: [0, 1.283, 0.19], s: [0.8, 1.2, 0.8] }), 'spine01', { color: VIO });
    for (let i = 0; i < 2; i++) add('bone', G.torus(0.04 + i * 0.01, 0.004, 4, S(14, 8)).rotateX(Math.PI / 2 + (i - 0.5) * 0.7).translate(0, 1.283, 0.19), 'spine01', { color: BONE_L });
    ak.halo('spine01', V(0, 1.283, 0.23), MAG, 0.42, 0.55);
    // costillar: costillas de hueso que abrazan el pecho y el vientre (se ve la piel luminosa entre ellas)
    for (let i = 0; i < 6; i++) {
      const y = 1.36 - i * 0.062, rr = 0.158 - Math.abs(i - 1.2) * 0.006 - (i > 3 ? (i - 3) * 0.012 : 0), c = V(0, y, 0.03), pts = [];
      for (let k = 0; k <= 6; k++) { const a = -0.28 + (k / 6) * 2.0; pts.push(V(Math.sin(a) * rr * 1.04, y - Math.sin(a) * 0.02 - (k / 6) * 0.012, c.z + Math.cos(a) * rr * 0.78)); }
      const pp = pts.map((p) => V(p.x, p.y, p.z));
      for (const sg of [1, -1]) add('bone', G.tube(pp.map((p) => V(p.x * sg, p.y, p.z)), 0.0105 - i * 0.0007, 0.0065, { radial: S(5, 4), tubular: S(14, 7), closeStart: true }), i < 3 ? 'spine01' : 'spine02', { color: i % 2 ? BONE : BONE_D });
    }
    // columna a la espalda: vértebras con púas
    for (let i = 0; i < (low ? 6 : 9); i++) { const y = 1.4 - i * (low ? 0.062 : 0.042); add('bone', X(bonelump(0.026 - i * 0.0007, [1.1, 0.8, 1], i + 3, 0.2), { p: [0, y, -0.094 - Math.sin(i * 0.4) * 0.004] }), y > 1.2 ? 'spine01' : y > 1.07 ? 'spine02' : 'spine03', { color: BONE_D }); }
    // arnés de cuero cruzado con hebilla de hueso
    for (const sg of (low ? [1] : [-1, 1])) add('leather', G.tube([V(sg * 0.13, 1.4, 0.06), V(sg * 0.08, 1.33, 0.175), V(-sg * 0.02, 1.18, 0.2), V(-sg * 0.13, 1.0, 0.19)], 0.014, 0.014, { radial: 4, tubular: 12, sx: 1, sz: 0.5 }), 'spine02', { color: LEATH });
    add('bone', t.box(0.04, 0.034, 0.014, 0.005, 1).translate(0.0, 1.24, 0.2), 'spine02', { color: BONE });
    // vientre: placas escalonadas (como armadillo) a los costados + línea de nervio central
    ak.both(() => {
      for (let i = 0; i < 3; i++) PL(i < 1 ? 'spine02' : 'spine03', [[-0.032, 0.03], [0.032, 0.03], [0.04, -0.01], [0.0, -0.034], [-0.04, -0.01]], { depth: 0.014, bevel: 0.005, wrap: { rx: 0.15 - i * 0.004, rz: 0.115 }, color: i === 1 ? DARK2 : DARK, trim: 'ember', trimInset: 0.2, trimR: 0.0024, place: (g) => X(g, { p: [0.1 - i * 0.004, 1.145 - i * 0.052, 0.02 - i * 0.002], r: [0, 0.65, 0] }) });
      add('light', seam([V(0.012, 1.17, 0.17), V(0.014, 1.09, 0.17), V(0.01, 1.01, 0.165)], 0.0028), 'spine03', { color: VIO });
      // cordones y bolsa de cuero en la cadera
      add('leather', G.tube([V(0.155, 1.205, 0.07), V(0.19, 1.11, 0.095), V(0.195, 1.02, 0.075), V(0.185, 0.97, 0.04)], 0.0105, 0.0105, { radial: low ? 3 : 4, tubular: 8 }), 'spine03', { color: LEATH });
    });
    // cinturón con hebilla de garra y faldón de pelaje
    add('leather', G.band(0.172, 0.055, 0.02, { seg: S(20, 10), sz: 0.78 }).translate(0, 0.945, zc + 0.01), 'spine05', { color: LEATH });
    add('bone', G.torus(0.176, 0.0045, 4, S(20, 10)).scale(1, 1, 0.78).translate(0, 0.975, zc + 0.01), 'spine05', { color: BONE_D });
    add('bone', spikeAt(V(0, 0.99, 0.185), V(0, -1, 0.45), 0.11, 0.022, 0.015, Zv, { radial: S(6, 4) }), 'spine05', { color: BONE_L });
    add('light', G.sphere(0.014, 6, 5).translate(0, 0.95, 0.196), 'spine05', { color: MAG });
  }

  // ═══════════════════════════ HOMBROS, BRAZOS, GARRAS
  ak.both(() => {
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'), D = W0.clone().sub(E0).normalize(), fl = W0.distanceTo(E0);
    // hombrera ligera: dos escamas de cuero y cristal + colmillo de hueso
    for (let i = 0; i < (low ? 2 : 3); i++) { const R0 = 0.108 - i * 0.006, w = 0.26 - i * 0.03, len = 0.13 + i * 0.02;
      PL('upperarm01', [[-w / 2, 0.0], [-w * 0.45, len * 0.6], [0, len * 1.1], [w * 0.45, len * 0.6], [w / 2, 0.0]], { mat: i === 1 ? 'crystal' : 'metal', depth: 0.016, bevel: 0.005, wrap: { rx: R0, rz: R0 * 0.94 }, color: i === 1 ? VIO_D : i ? DARK2 : DARK, trim: i === 1 ? 'ember' : undefined, trimInset: 0.18, trimR: 0.0026,
        place: (g) => { X(g, { r: [-Math.PI / 2, 0, -Math.PI / 2] }); return X(g, { p: [S0.x + 0.02 + i * 0.035, S0.y + 0.05 - i * 0.035, S0.z], r: [0, 0, -0.1 - i * 0.22] }); } }); }
    add('bone', spikeAt(S0.clone().add(V(0.02, 0.1, -0.04)), V(0.35, 1, -0.55), 0.2, 0.024, 0.06, V(0, 0, -1), { radial: S(6, 4), ridges: 3, ridgeAmp: 0.15 }), 'upperarm01', { color: BONE });
    add('light', seam([S0.clone().add(V(0.05, 0.12, 0.0)), S0.clone().add(V(0.1, 0.06, 0.02)), S0.clone().add(V(0.13, -0.02, 0.0))], 0.003), 'upperarm01', { color: VIO });
    // brazo: bandas de cuero con hueso + codo con espolón + nervio luminoso
    for (let i = 0; i < 2; i++) add('leather', limb(cuff(0.062 - i * 0.004, 0.056 - i * 0.004, 0.05, 0.01, S(10, 6), 30), S0, E0, 0.25 + i * 0.35), 'upperarm01', { color: LEATH });
    add('bone', ringAt(S0, E0, 0.55, 0.062, 0.016, 0.01), 'upperarm01', { color: BONE_D });
    add('light', seam([S0.clone().add(V(-0.02, -0.02, 0.07)), S0.clone().lerp(E0, 0.5).add(V(0.0, 0.0, 0.07)), E0.clone().add(V(0.0, 0.03, 0.06))], 0.0028), 'upperarm01', { color: VIO });
    add('bone', spikeAt(E0.clone().add(V(0.055, 0.02, -0.04)), V(0.8, 0.3, -1), 0.17, 0.024, 0.05, Y, { radial: S(6, 4), ridges: 3, ridgeAmp: 0.16 }), 'lowerarm01', { color: BONE });
    add('dark', X(dome(0.05, 0.04, { lip: 0.3, seg: S(9, 6), crease: 30 }), { p: [E0.x + 0.025, E0.y, E0.z - 0.03], r: [0, 0, -Math.PI / 2 + 0.2] }), 'lowerarm01', { color: DARK });
    // antebrazo: brazal oscuro con filete de luz, placa de cristal y garra-cuchilla curva
    add('dark', limb(cuff(0.062, 0.047, fl * 0.84, 0.012, S(8, 6), 25), E0, W0, 0.5), 'lowerarm01', { color: DARK });
    PL('lowerarm01', [[-0.03, 0.1], [0.03, 0.1], [0.022, -0.1], [-0.022, -0.1]], { mat: 'crystal', depth: 0.014, bevel: 0.005, wrap: { rx: 0.064, rz: 0.068 }, color: VIO_D, trim: 'ember', trimInset: 0.18, place: (g) => limb(g, E0, W0, 0.5) });
    add('bone', limb(cuff(0.058, 0.052, 0.035, 0.012, S(8, 6), 25), E0, W0, 0.08), 'lowerarm01', { color: BONE_D });
    add('bone', limb(cuff(0.05, 0.044, 0.03, 0.012, S(8, 6), 25), E0, W0, 0.92), 'lowerarm01', { color: BONE_D });
    add('light', limb(G.tube([V(-0.07, -0.09, 0.02), V(-0.082, 0.0, 0.0), V(-0.07, 0.09, -0.02)], 0.003, 0.003, { radial: 4, tubular: 6 }), E0, W0, 0.5), 'lowerarm01', { color: VIO });
    const bl = 0.46, bt = 0.58, ox = -0.085;
    add('bone', limb(t.box(0.034, 0.12, 0.06, 0.008, 1), E0, W0, bt, { off: [ox, 0, 0] }), 'lowerarm01', { color: BONE_D });
    add('crystal', limb(t.blade(bl, 0.07, 0.008, { tipLean: 0.18, curve: 0.11 }), E0, W0, bt + 0.08, { off: [ox, 0, 0], r: [0, Math.PI / 2, 0] }), 'lowerarm01', { color: (x, y, z) => new T.Color(VIO_D).lerp(new T.Color(MAG), Math.min(1, Math.max(0, ((x - E0.x) * D.x + (y - E0.y) * D.y + (z - E0.z) * D.z) / (fl + bl) - 0.55) * 1.6)) });
    add('light', limb(t.blade(bl * 0.95, 0.008, 0.01, { curve: 0.11 }), E0, W0, bt + 0.08, { off: [ox, 0.01, 0.005], r: [0, Math.PI / 2, 0] }), 'lowerarm01', { color: VIO });
    // mano: dorso oscuro, nudillos de hueso y garras largas con punta de luz
    const F3 = P('finger3-1');
    add('dark', limb(t.box(0.085, 0.1, 0.018, 0.007, 1), W0, F3, 0.5, { off: [-0.035, 0, 0], r: [0, Math.PI / 2, 0] }), 'wrist', { color: DARK });
    for (const [f, len, r] of [['finger2', 0.17, 0.0095], ['finger3', 0.21, 0.01], ['finger4', 0.18, 0.0095], ['finger5', 0.12, 0.0085]]) {
      const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize(), tw = d.clone().add(V(0, -0.14, 0.2));
      add('bone', spikeAt(b.clone().addScaledVector(d, 0.008), tw, len, r, -0.035, V(0, 0.4, 0.2), { radial: S(5, 4), ridges: 3, ridgeAmp: 0.12 }), `${f}-3`, { color: BONE_L });
      if (!low) add('light', spikeAt(b.clone().addScaledVector(d, 0.008 + len * 0.55), tw, len * 0.45, 0.004, -0.02, V(0, 0.4, 0.2), { radial: 3, tubular: 3 }), `${f}-3`, { color: VIO });
      add('bone', limb(t.box(0.02, a.distanceTo(b) * 1.1, 0.016, 0.006, 1), a, b, 0.55, { off: [-0.005, 0, 0] }), `${f}-2`, { color: BONE_D });
    }
    { const a = P('finger1-2'), b = P('finger1-3'), d = b.clone().sub(a).normalize(); add('bone', spikeAt(b, d.clone().add(V(0, 0, 0.3)), 0.12, 0.009, -0.02, V(0, 1, 0.3), { radial: S(5, 4) }), 'finger1-3', { color: BONE_L }); }
  });

  // ═══════════════════════════ PIERNAS «digitígradas»: muslo de pelaje, rótula, greba que se estrecha, espolón de corvejón, pata-pezuña de dedos largos
  ak.both(() => {
    const H = P('upperleg01'), K = P('lowerleg01'), A = P('foot'), TO = P('toe3-1'), ll = K.distanceTo(A), ul = H.distanceTo(K);
    add('dark', limb(cuff(0.09, 0.066, ul * 0.8, 0.012, S(10, 7), 28), H, K, 0.46), 'upperleg01', { color: DARK });
    PL('upperleg01', [[-0.055, 0.12], [0.055, 0.12], [0.07, 0.0], [0.04, -0.13], [0, -0.16], [-0.04, -0.13], [-0.07, 0.0]], { mat: 'crystal', depth: 0.014, bevel: 0.005, wrap: { rx: 0.108, rz: 0.098 }, color: VIO_D, trim: 'ember', trimInset: 0.2, place: (g) => limb(g, H, K, 0.28, { r: [0, -Math.PI / 2 + 0.2, 0] }) });
    for (let i = 0; i < 3; i++) add('bone', limb(G.wrapE(G.plate([[-0.045 + i * 0.004, 0.04], [0.045 - i * 0.004, 0.04], [0.035, -0.04], [0, -0.06], [-0.035, -0.04]], 0.012, 0.004), 0.1 - i * 0.004, 0.092 - i * 0.004), H, K, 0.58 + i * 0.12, { r: [0, 0.0, 0] }), 'upperleg01', { color: i % 2 ? BONE : BONE_D });
    add('light', limb(G.tube([V(0.0, 0.14, 0.092), V(0.003, 0.0, 0.098), V(-0.003, -0.13, 0.094)], 0.003, 0.003, { radial: 4, tubular: 8 }), H, K, 0.4), 'upperleg01', { color: VIO });
    // rodilla: casquete de hueso con púa
    add('bone', X(dome(0.055, 0.05, { lip: 0.3, seg: S(9, 6), crease: 30 }), { p: [K.x, K.y + 0.005, K.z + 0.07], r: [Math.PI / 2, 0, 0] }), 'lowerleg01', { color: BONE_D });
    add('bone', spikeAt(V(K.x, K.y + 0.01, K.z + 0.115), V(0, 0.25, 1), 0.1, 0.022, 0.0, Y, { radial: S(6, 4), ridges: 3, ridgeAmp: 0.15 }), 'lowerleg01', { color: BONE });
    // greba: se estrecha hacia abajo como un metatarso largo; corvejón detrás (el «talón» falso) con espolón
    add('dark', limb(cuff(0.072, 0.042, ll * 0.78, 0.012, S(10, 7), 25), K, A, 0.4), 'lowerleg01', { color: DARK });
    PL('lowerleg01', [[0, 0.17], [0.03, 0.13], [0.034, -0.1], [0.012, -0.17], [-0.012, -0.17], [-0.034, -0.1], [-0.03, 0.13]], { mat: 'crystal', depth: 0.024, bevel: 0.01, wrap: { rx: 0.064, rz: 0.076 }, color: VIO_D, trim: 'ember', trimInset: 0.22, trimR: 0.0028, place: (g) => limb(g, K, A, 0.42, { off: [0, 0, 0.0] }) });
    const hock = V(K.x - 0.0, K.y - ll * 0.55, K.z - 0.095);
    add('bone', X(bonelump(0.052, [0.8, 1.2, 1.2], 7, 0.18), { p: [hock.x, hock.y, hock.z] }), 'lowerleg01', { color: BONE_D });
    add('bone', spikeAt(V(hock.x, hock.y + 0.02, hock.z - 0.03), V(0, 0.6, -1), 0.2, 0.026, 0.05, Y, { radial: S(6, 4), ridges: 3, ridgeAmp: 0.16 }), 'lowerleg01', { color: BONE });
    add('crystal', limb(G.wrapE(G.plate([[-0.03, 0.14], [0.03, 0.14], [0.026, -0.1], [0, -0.14], [-0.026, -0.1]], 0.014, 0.005), 0.064, 0.07), K, A, 0.5, { r: [0, Math.PI, 0] }), 'lowerleg01', { color: VIO_D });
    add('light', ringAt(K, A, 0.88, 0.058, 0.012, 0.004), 'lowerleg01', { color: MAG });
    // pata-pezuña: bota larga hasta las puntas, dedos de hueso con garras
    const boot = G.plate([[-0.062, 0.0], [-0.066, 0.075], [-0.03, 0.125], [0.03, 0.12], [0.1, 0.075], [0.19, 0.036], [0.235, 0.012], [0.2, 0.0]], 0.092, 0.022, { crease: 50 });
    X(boot, { r: [0, -Math.PI / 2, 0] }); X(boot, { p: [A.x + 0.005, 0.0, 0.0] }); add('dark', boot, 'foot', { color: DARK });
    add('bone', X(G.plate([[0.0, 0.11], [0.09, 0.09], [0.19, 0.045], [0.12, 0.05], [0.05, 0.075]], 0.082, 0.012, { crease: 50 }), { r: [0, -Math.PI / 2, 0], p: [A.x + 0.005, 0.014, 0.0] }), 'foot', { color: BONE_D });
    for (let i = -1; i <= 1; i++) add('bone', spikeAt(V(TO.x + i * 0.026, 0.038, 0.205), V(i * 0.15, -0.05, 1), 0.12, 0.0115, 0.012, Y, { radial: S(5, 4), ridges: 3, ridgeAmp: 0.12 }), 'toe3-1', { color: BONE_L });
    add('bone', spikeAt(V(A.x, 0.075, -0.062), V(0, 0.45, -1), 0.1, 0.018, 0.015, Y, { radial: S(5, 4) }), 'foot', { color: BONE });
    add('light', seam([V(A.x - 0.035, 0.122, 0.0), V(A.x, 0.13, 0.05), V(A.x + 0.035, 0.122, 0.0)], 0.0028), 'foot', { color: VIO });
  });

  // ═══════════════════════════ ESPALDA: melena de velos, púas dorsales, faldón de pelaje y cola de nervios
  {
    for (let i = 0; i < (low ? 5 : 8); i++) { const k = low ? 1.6 : 1, y = 1.42 - i * 0.052 * k, L = 0.18 - Math.abs(i - 1.5) * 0.012; add(i % 3 === 0 ? 'crystal' : 'bone', spikeAt(V(0, y, -0.1), V(0, 0.18 - i * 0.02, -1), L, 0.017 - i * 0.0006, 0.03, Y, { radial: S(5, 4), ridges: 3, ridgeAmp: 0.14 }), i < 3 ? 'spine01' : i < 5 ? 'spine02' : 'spine03', { color: i % 3 === 0 ? VIO : BONE }); }
    // melena: velos largos que nacen en la nuca y los hombros
    const cols = [], lens = [], R2 = t.rng(5);
    for (let j = 0; j < 9; j++) { const x = -0.2 + j * 0.05; cols.push({ bone: j === 0 ? 'clavicle_R' : j === 8 ? 'clavicle_L' : 'spine01', p: V(x, 1.43 - Math.abs(x) * 0.18, -0.1 - 0.025 * (1 - Math.abs(x) / 0.2)) }); lens.push(0.62 + 0.28 * Math.cos((j / 8 - 0.5) * 2.2) + (R2() - 0.5) * 0.24); }
    ak.cloth({ top: cols, dir: V(0, -1, -0.15), lens, rows: S(10, 6), color: 0x4a2480, hem: 0x120a22, gravity: 7, stiff: 0.014, drag: 0.982, wave: 0.03, ember: 1 });
    const c2 = [], l2 = []; for (let j = 0; j < 5; j++) { c2.push({ bone: 'spine05', p: V(-0.1 + j * 0.05, 0.93, -0.098) }); l2.push(0.46 + (R2() - 0.5) * 0.2); }
    ak.cloth({ top: c2, dir: V(0, -1, -0.05), lens: l2, rows: S(7, 4), color: 0x3a1c60, hem: 0x120a22, gravity: 7, stiff: 0.02, drag: 0.98, wave: 0.015, ember: 0.8 });
    const c3 = [], l3 = []; for (let j = 0; j < 4; j++) { c3.push({ bone: 'spine05', p: V(-0.075 + j * 0.05, 0.92, 0.185) }); l3.push(0.3 + (R2() - 0.5) * 0.12); }
    ak.cloth({ top: c3, dir: V(0, -1, 0.12), lens: l3, rows: S(6, 4), color: 0x3a1c60, hem: 0x120a22, gravity: 7, stiff: 0.03, drag: 0.98, ember: 0.8 });
    ak.collider('spine02', V(0, 1.0, 0.045), V(0, 1.36, 0.045), 0.17); ak.collider('spine05', V(0, 0.86, 0.045), V(0, 0.98, 0.045), 0.185);
    ak.both(() => ak.collider('upperleg01', P('upperleg01'), P('lowerleg01'), 0.105));
    // cola de nervios (física de muelles): vaina oscura, núcleo luminoso, vértebras de hueso y mechón de cristal
    const N = 9, pts = []; for (let i = 0; i < N; i++) pts.push(V(0, 0.93 - Math.sin(i * 0.34) * 0.1 - i * 0.012, -0.1 - i * 0.095));
    const tail = ak.chain('cola', 'spine05', pts, { stiff: 0.05, damp: 0.93, gravity: 3.2, sway: 1.6 });
    for (let i = 0; i < N - 1; i++) {
      const r0 = 0.034 - i * 0.0034, r1 = 0.034 - (i + 1) * 0.0034, nm = tail.bones[i].name;
      add('dark', G.tube([pts[i], pts[i + 1]], r0, r1, { radial: S(7, 5), tubular: 3 }), nm, { color: DARK2 });
      add('light', G.tube([pts[i], pts[i + 1]], r0 * 0.55, r1 * 0.55, { radial: 4, tubular: 3 }), nm, { color: i % 2 ? VIO : MAG });
      if (i % 2 === 0) add('bone', X(G.torus(r0 * 1.12, r0 * 0.28, 4, S(9, 6)), { p: [pts[i].x, pts[i].y, pts[i].z], q: t.basisQ(pts[i + 1].clone().sub(pts[i]), V(0, 0, 1)) }).rotateX(0), nm, { color: BONE_D });
    }
    const tip = pts[N - 1], tn = tail.bones[N - 1].name;
    for (let k = 0; k < (low ? 3 : 5); k++) add('crystal', spikeAt(tip, V((k - 2) * 0.35, 0.12 - Math.abs(k - 2) * 0.1, -1), 0.16 - Math.abs(k - 2) * 0.025, 0.02, 0.01, Y, { radial: 4, tubular: 3 }), tn, { color: k % 2 ? VIO : MAG });
    ak.embers(MAG, low ? 18 : 34, { radius: 0.45, height: 1.9, size: 5 });
  }
  const evo = addEvolution(ak, ctx, { t, pal: { bone: 0xd8cdb8, boneL: 0xffffff, steel: 0x3a3050, steelD: 0x1a1426 } });
  return { update: (dt, tt, c) => { upd.forEach((f) => f(dt, tt, c)); evo.update(dt, tt, c); } };
}
