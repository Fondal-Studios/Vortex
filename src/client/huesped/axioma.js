// AXIOMA — GUERRERO CAÍDO (Huésped de referencia, docs/HUESPEDES_ARTE.md). Armadura de acero ennegrecido y hueso con costuras de brasa, hombreras facetadas con púas,
// costillar de hueso sobre un vientre de brasa, capa rasgada con física, cuchillas de espíritu en los antebrazos, casco con un cuerno entero y otro roto, núcleo de luz
// en el pecho y un halo de espadas rotas que gira a la espalda. Se escribe en el marco del modelo (pose de enlace); el lado izquierdo (+x) va dentro de ak.both().
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';

export const BELLY = 1; // vientre de brasa en el cuerpo espectral (visible entre las costillas)
const STEEL = 0xaab0c8, STEEL_D = 0x666a82, BONE = 0xe6d9bc, BONE_D = 0xb5a482, EMBER = 0xff7a22, EMBER_HOT = 0xffc060, CORE = 0x8fd2ff;

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, ringAt, dome, cuff, bonelump, rivetArc, S, low } = t, P = (n) => ak.P(n), add = ak.add;
  const HC = V(0, 1.6, 0.06), Y = V(0, 1, 0), Zv = V(0, 0, 1), Xv = V(1, 0, 0), zc = 0.045, upd = [];

  // ═══════════════════════════ CASCO CON CUERNO
  {
    const shell = G.lathe([[0.1, -0.075], [0.108, -0.035], [0.112, 0.015], [0.105, 0.07], [0.086, 0.113], [0.054, 0.139], [0.018, 0.152], [0, 0.155]], S(16, 10), 0, Math.PI * 2, 34); X(shell, { p: [HC.x, HC.y, HC.z], s: [1, 1, 1.22] });
    add('metal', shell, 'head', { color: STEEL_D });
    const brow = G.wrapE(G.plate([[0, 0.012], [0.05, 0.03], [0.108, 0.052], [0.122, 0.03], [0.07, -0.006], [0, -0.02], [-0.07, -0.006], [-0.122, 0.03], [-0.108, 0.052], [-0.05, 0.03]], 0.026, 0.007), 0.118, 0.145);
    X(brow, { p: [HC.x, HC.y + 0.03, HC.z] }); add('metal', brow, 'head', { color: STEEL });
    add('gold', G.torus(0.108, 0.0042, 4, S(24, 12)).scale(1, 1, 1.22).translate(HC.x, HC.y + 0.062, HC.z), 'head');
    // mascarilla: quilla nasal + rejilla de barras de hueso sobre un fondo oscuro
    add('bone', G.wrapE(G.plate([[0.012, 0.03], [0.014, -0.09], [0, -0.105], [-0.014, -0.09], [-0.012, 0.03]], 0.022, 0.006), 0.05, 0.149).translate(HC.x, HC.y, HC.z), 'head', { color: BONE });
    for (let i = -2; i <= 2; i++) add('bone', t.box(0.01, 0.05, 0.018, 0.003, 1).translate(HC.x + i * 0.0175, HC.y - 0.085, HC.z + 0.139 - Math.abs(i) * 0.0075), 'head', { color: BONE_D });
    add('dark', t.box(0.1, 0.045, 0.012, 0.004, 1).translate(HC.x, HC.y - 0.085, HC.z + 0.13), 'head', { color: 0x07060a });
    ak.both(() => {
      add('light', G.wrapE(G.plate([[0.016, 0.0], [0.06, 0.013], [0.092, 0.004], [0.088, -0.006], [0.024, -0.016]], 0.012, 0.002), 0.114, 0.142).translate(HC.x, HC.y - 0.004, HC.z), 'head', { color: 0x9fd8ff });
      const ch = G.wrapE(G.plate([[0.004, 0.03], [0.05, 0.02], [0.09, -0.03], [0.07, -0.088], [0.03, -0.1], [0.004, -0.06]], 0.016, 0.005), 0.108, 0.136); X(ch, { p: [HC.x, HC.y - 0.015, HC.z], r: [0, 0.38, 0] });
      add('metal', ch, 'head', { color: STEEL });
      add('ember', seam([V(0.052, HC.y - 0.1, HC.z + 0.085), V(0.082, HC.y - 0.058, HC.z + 0.082), V(0.1, HC.y - 0.012, HC.z + 0.062)], 0.0028), 'head', { color: EMBER });
      add('metal', G.cyl(0.042, 0.04, 0.014, S(10, 7)).rotateZ(Math.PI / 2).translate(0.113, HC.y - 0.01, HC.z - 0.005), 'head', { color: STEEL_D });
      add('gold', G.torus(0.043, 0.0042, 4, S(14, 8)).rotateZ(Math.PI / 2).translate(0.121, HC.y - 0.01, HC.z - 0.005), 'head');
    });
    // gema de la frente, mentonera y filetes de la mandíbula
    add('ember', X(G.sphere(0.012, 6, 4), { p: [HC.x, HC.y + 0.057, HC.z + 0.148], s: [1, 1.5, 0.6] }), 'head', { color: EMBER_HOT });
    add('gold', X(G.torus(0.016, 0.0028, 3, S(10, 6)), { p: [HC.x, HC.y + 0.057, HC.z + 0.147], r: [Math.PI / 2, 0, 0], s: [1, 1, 1.5] }), 'head');
    t.armorPlate('head', [[-0.045, 0.0], [0.045, 0.0], [0.035, -0.04], [0, -0.055], [-0.035, -0.04]], { depth: 0.018, bevel: 0.006, wrap: { rx: 0.075, rz: 0.12 }, color: STEEL, trim: 'gold', trimInset: 0.12, place: (g) => X(g, { p: [HC.x, HC.y - 0.115, HC.z + 0.0] }) });
    // cresta afilada con dientes
    const crest = G.plate([[0.04, 0.0], [0.06, 0.07], [0.04, 0.12], [0.0, 0.175], [-0.04, 0.13], [-0.06, 0.15], [-0.09, 0.1], [-0.12, 0.12], [-0.15, 0.06], [-0.18, 0.04], [-0.2, -0.02], [-0.12, 0.0]], 0.011, 0.003); X(crest, { r: [0, -Math.PI / 2, 0] });
    X(crest, { p: [HC.x, HC.y + 0.05, HC.z] }); add('bone', crest, 'head', { color: BONE_D });
    // cuerno izquierdo largo y cuerno derecho ROTO con brasa en la fractura
    const horn = G.tube([V(0.085, 0.035, 0), V(0.15, 0.09, -0.01), V(0.205, 0.21, -0.05), V(0.17, 0.35, -0.14), V(0.085, 0.46, -0.25)], 0.027, 0.0015, { radial: S(7, 5), tubular: S(16, 9), ridges: 5, ridgeAmp: 0.22, twist: 2.2, ease: 0.85 });
    X(horn, { p: [HC.x, HC.y, HC.z] }); add('bone', horn, 'head', { color: BONE_D });
    add('gold', G.torus(0.034, 0.0085, 5, S(12, 7)).rotateZ(Math.PI / 2 - 0.55).translate(HC.x + 0.108, HC.y + 0.048, HC.z), 'head');
    const stump = G.tube([V(-0.085, 0.035, 0), V(-0.145, 0.085, -0.01), V(-0.19, 0.16, -0.035)], 0.027, 0.018, { radial: S(7, 5), tubular: S(8, 5), ridges: 5, ridgeAmp: 0.2, twist: 1.2, ease: 1 });
    X(stump, { p: [HC.x, HC.y, HC.z] }); add('bone', stump, 'head', { color: BONE_D });
    add('ember', G.cone(0.018, 0.034, 5).rotateZ(0.4).translate(HC.x - 0.19, HC.y + 0.158, HC.z - 0.035), 'head', { color: EMBER_HOT });
    add('gold', G.torus(0.034, 0.0085, 5, S(12, 7)).rotateZ(Math.PI / 2 + 0.55).translate(HC.x - 0.108, HC.y + 0.048, HC.z), 'head');
    // gorguera de 3 aros y collar de púas de hueso
    for (let i = 0; i < 3; i++) add('metal', G.band(0.074 - i * 0.002, 0.026, 0.01, { seg: S(16, 8) }).translate(0, 1.446 + i * 0.022, 0.03), 'neck01', { color: i === 1 ? STEEL : STEEL_D });
    add('gold', G.torus(0.077, 0.0038, 4, S(18, 9)).translate(0, 1.4695, 0.03), 'neck01');
    const nn = low ? 5 : 7; for (let i = 0; i < nn; i++) { const a = Math.PI * (0.64 + i * (0.72 / (nn - 1))), r = 0.1, c = (nn - 1) / 2; add('bone', spikeAt(V(Math.sin(a) * r, 1.446, 0.03 + Math.cos(a) * r), V(Math.sin(a) * 0.55, 1.0, Math.cos(a) * 0.55 - 0.15), 0.08 + (i === c ? 0.05 : 0) - Math.abs(i - c) * 0.01, 0.012, -0.02, Y, { radial: 5 }), 'neck01', { color: BONE_D }); }
  }

  // ═══════════════════════════ TORSO: peto facetado, quilla, costillar sobre vientre de brasa, cinturón
  {
    const chest = G.lathe([[0.165, 1.2], [0.176, 1.25], [0.18, 1.3], [0.17, 1.35], [0.145, 1.395], [0.105, 1.425], [0.092, 1.44]], S(14, 10), 0, Math.PI * 2, 30); X(chest, { p: [0, 0, zc - 0.005], s: [1, 1, 0.74] });
    add('metal', chest, 'spine01', { color: STEEL_D });
    ak.both(() => {
      t.armorPlate('spine01', [[0.012, 0.118], [0.075, 0.135], [0.145, 0.098], [0.158, 0.02], [0.13, -0.062], [0.07, -0.098], [0.012, -0.07]], { depth: 0.03, bevel: 0.01, wrap: { rx: 0.172, rz: 0.12 }, place: (g) => X(g, { p: [0, 1.292, zc - 0.002], r: [0.07, 0, 0] }), color: STEEL, trim: 'ember', trimInset: 0.16, trimR: 0.003 });
      add('gold', seam([V(0.02, 1.412, 0.166), V(0.075, 1.428, 0.158), V(0.14, 1.392, 0.134), V(0.158, 1.31, 0.098)], 0.0046), 'spine01');
      add('ember', seam([V(0.022, 1.212, 0.168), V(0.07, 1.218, 0.162), V(0.125, 1.238, 0.145), V(0.158, 1.285, 0.1)], 0.0032), 'spine01', { color: EMBER });
      add('ember', seam([V(0.03, 1.33, 0.172), V(0.04, 1.28, 0.176), V(0.03, 1.23, 0.172)], 0.0028), 'spine01', { color: EMBER });
      add('metal', X(G.wrapE(G.plate([[0, 0.05], [0.09, 0.055], [0.12, 0.02], [0.1, -0.03], [0, -0.04]], 0.018, 0.006), 0.1, 0.085), { p: [0.0, 1.42, zc - 0.07], r: [0.9, 0.0, -0.16] }), 'clavicle', { color: STEEL_D });
    });
    // esternón-quilla con el núcleo de luz y su jaula
    add('bone', X(G.wrapE(G.plate([[0.0, 0.135], [0.034, 0.1], [0.04, 0.0], [0.024, -0.1], [0, -0.14], [-0.024, -0.1], [-0.04, 0.0], [-0.034, 0.1]], 0.034, 0.011), 0.04, 0.152), { p: [0, 1.26, zc - 0.012] }), 'spine01', { color: BONE });
    for (let i = 0; i < 3; i++) add('gold', G.torus(0.04 + i * 0.008, 0.0045, 5, S(16, 9)).rotateX(Math.PI / 2 + (i - 1) * 0.5).translate(0, 1.278, 0.196), 'spine01');
    add('light', G.sphere(0.03, S(10, 7), S(8, 6)).translate(0, 1.278, 0.199), 'spine01', { color: CORE });
    add('crystal', X(new T.OctahedronGeometry(0.046, 0), { p: [0, 1.278, 0.202], s: [0.8, 1.15, 0.8] }), 'spine01', { color: CORE });
    ak.halo('spine01', V(0, 1.278, 0.24), 0x6ab8ff, 0.46, 0.5);
    // vientre: COSTILLAR de hueso (5 aros) sobre el vientre de brasa + columna vertebral
    for (let i = 0; i < 5; i++) {
      const y = 1.052 + i * 0.034, k = 1 + 0.03 * Math.sin(i * 1.3), cz = 0.058 - i * 0.003;
      add('bone', G.torus(0.128 * k, 0.0108 - i * 0.0004, S(5, 4), S(24, 12)).scale(1, 1, 0.82).translate(0, y, cz), i < 2 ? 'spine03' : 'spine02', { color: BONE_D });
      add('bone', G.cone(0.011, 0.034, 4).rotateX(Math.PI / 2).translate(0, y, cz + 0.128 * 0.82 * k - 0.004), i < 2 ? 'spine03' : 'spine02', { color: BONE });
    }
    add('bone', G.tube([V(0, 1.2, -0.056), V(0, 1.12, -0.066), V(0, 1.04, -0.062)], 0.016, 0.012, { radial: 5, tubular: 10, ridges: 4, ridgeAmp: 0.4 }), 'spine02', { color: BONE_D });
    // arnés de cuero cruzado con hebillas de oro
    for (const sg of (low ? [1] : [-1, 1])) {
      const pts = [V(sg * 0.13, 1.4, 0.07), V(sg * 0.08, 1.33, 0.175), V(-sg * 0.02, 1.18, 0.2), V(-sg * 0.13, 1.0, 0.19)];
      add('leather', G.tube(pts, 0.012, 0.012, { radial: 4, tubular: 12, sx: 1, sz: 0.5 }), 'spine02', { color: 0x6a4a40 });
      add('gold', G.box(0.036, 0.03, 0.012, 0.004, 1).translate(sg * 0.01, 1.25, 0.2), 'spine02');
    }
    // cordones de cuero entre el peto y el cinturón + tanques de brasa a la espalda baja
    ak.both(() => {
      add('leather', G.tube([V(0.155, 1.205, 0.07), V(0.19, 1.11, 0.095), V(0.195, 1.02, 0.075), V(0.185, 0.97, 0.04)], 0.0105, 0.0105, { radial: low ? 3 : 4, tubular: 8 }), 'spine03', { color: 0x4a3238 });
      add('gold', G.torus(0.0135, 0.0035, 3, 6).rotateX(Math.PI / 2).translate(0.192, 1.07, 0.088), 'spine03');
      add('metal', G.cyl(0.034, 0.034, 0.17, S(8, 6)).translate(0.075, 1.04, -0.135), 'spine03', { color: STEEL_D });
      add('gold', G.torus(0.036, 0.004, 3, S(10, 6)).translate(0.075, 1.1, -0.135), 'spine03'); add('gold', G.torus(0.036, 0.004, 3, S(10, 6)).translate(0.075, 0.98, -0.135), 'spine03');
      add('ember', G.cone(0.026, 0.03, 5).rotateX(Math.PI).translate(0.075, 0.93, -0.135), 'spine03', { color: EMBER_HOT });
    });
    // cinturón con hebilla de calavera
    add('leather', G.band(0.178, 0.065, 0.02, { seg: S(20, 10), sz: 0.78 }).translate(0, 0.945, zc + 0.01), 'spine05', { color: 0xa88a74 });
    for (const y of [0.979, 0.911]) add('gold', G.torus(0.18, 0.0045, 4, S(20, 10)).scale(1, 1, 0.78).translate(0, y, zc + 0.01), 'spine05');
    add('metal', t.box(0.1, 0.085, 0.03, 0.01, 1).translate(0, 0.945, 0.175), 'spine05', { color: STEEL });
    add('bone', bonelump(0.04, [1, 1.05, 0.85], 9, 0.18).translate(0, 0.946, 0.2), 'spine05', { color: BONE });
    for (const s of [-1, 1]) { add('dark', G.sphere(0.0105, 6, 4).translate(s * 0.0155, 0.952, 0.236), 'spine05', { color: 0x050407 }); add('ember', G.sphere(0.0055, 5, 4).translate(s * 0.0155, 0.952, 0.2395), 'spine05', { color: EMBER_HOT }); }
    if (!low) add('gold', rivetArc(V(0, 0.945, zc + 0.01), Xv, Zv, 0.18, 0.5, Math.PI * 2 - 0.5, 14, 0.0052), 'spine05');
  }

  // ═══════════════════════════ HOMBRERAS, BRAZOS, MANOS
  ak.both(() => {
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'), C0 = S0.clone().add(V(0.034, 0.042, 0)), TILT = -0.42, SC = [1.2, 1, 1.12];
    // hombrera LAMINADA: 4 placas en arco (como las de una armadura de verdad) que bajan por el brazo, borde de oro y corona de púas
    const P0 = S0.clone().add(V(0.0, 0.055, 0.0));
    for (let i = 0; i < (low ? 3 : 4); i++) {
      const R0 = 0.132 - i * 0.006, len = 0.15 + (i === 0 ? 0.04 : 0), wArc = 0.3 - i * 0.02, th = 0.02 - i * 0.002;
      t.armorPlate('upperarm01', [[-wArc / 2, 0.0], [-wArc * 0.5, len * 0.55], [-wArc * 0.3, len], [0, len * 1.08], [wArc * 0.3, len], [wArc * 0.5, len * 0.55], [wArc / 2, 0.0]], {
        depth: th, bevel: th * 0.38, wrap: { rx: R0, rz: R0 * 0.94 }, color: i === 0 ? STEEL : i % 2 ? STEEL_D : STEEL, trim: i < 2 ? 'ember' : 'gold', trimInset: 0.1, trimR: 0.0028,
        place: (g) => { X(g, { r: [-Math.PI / 2, 0, -Math.PI / 2] }); return X(g, { p: [P0.x + 0.02 + i * 0.04, P0.y - i * 0.035, P0.z], r: [0, 0, -0.1 - i * 0.2] }); } });
    }
    // cresta de hueso sobre la placa superior y 5 púas en el borde exterior
    const top = (x, y, z) => V(P0.x + 0.02 + x, P0.y + y, P0.z + z);
    add('bone', X(G.plate([[-0.13, 0], [-0.08, 0.04], [0, 0.065], [0.08, 0.04], [0.13, 0], [0.08, 0.01], [0, 0.02], [-0.08, 0.01]], 0.022, 0.007), { p: [P0.x + 0.07, P0.y + 0.11, P0.z], r: [0, Math.PI / 2, 0.1] }), 'upperarm01', { color: BONE_D });
    for (const [az, len, r, tilt] of [[0.0, 0.2, 0.024, 0.2], [0.5, 0.15, 0.019, 0.5], [-0.5, 0.15, 0.019, 0.5], [1.0, 0.11, 0.015, 0.7], [-1.0, 0.12, 0.015, 0.7]]) {
      const ang = az * 0.85, bp = top(0.1 + 0.07 * Math.cos(ang), 0.02 + 0.095 * Math.cos(ang), 0.13 * Math.sin(ang) * 0.9), dir = V(0.35 + Math.cos(ang) * 0.6, 0.65 + tilt * 0.4, Math.sin(ang) * 0.85);
      add('bone', spikeAt(bp, dir, len, r, 0.03, Y, { radial: S(6, 5), ridges: 3, ridgeAmp: 0.18 }), 'upperarm01', { color: BONE_D });
      if (!low) add('gold', G.torus(r * 1.12, r * 0.3, 4, S(8, 5)).translate(bp.x, bp.y, bp.z), 'upperarm01');
    }
    { const pts = []; for (let k = 0; k <= 8; k++) { const u = k / 8; pts.push(top(0.03 + 0.2 * u, 0.115 - 0.05 * u + Math.sin(k * 2.3) * 0.006, -0.1 + 0.2 * u * 0.5 + Math.sin(k * 1.7) * 0.01)); } add('ember', seam(pts, 0.0034), 'upperarm01', { color: EMBER }); }
    add('ember', seam([top(0.02, 0.1, -0.1), top(0.07, 0.115, -0.04), top(0.12, 0.115, 0.04), top(0.17, 0.09, 0.09)], 0.003), 'upperarm01', { color: EMBER });
    // mantelete: placa que une el cuello con la hombrera
    add('metal', X(G.wrapE(G.plate([[0, 0.05], [0.07, 0.06], [0.12, 0.02], [0.1, -0.035], [0, -0.04]], 0.022, 0.007), 0.12, 0.1), { p: [S0.x - 0.12, S0.y + 0.07, zc - 0.07], r: [0.55, 0.0, -0.25] }), 'clavicle', { color: STEEL_D });
    for (let i = 0; i < 3; i++) { add('metal', limb(cuff(0.108 - i * 0.008, 0.1 - i * 0.008, 0.06, 0.012, S(10, 7), 30), S0, E0, 0.2 + i * 0.15, { s: [1.08, 1, 1] }), 'upperarm01', { color: i === 1 ? STEEL : STEEL_D }); if (!low) add('gold', ringAt(S0, E0, 0.2 + i * 0.15 + 0.03, 0.1 - i * 0.008, 0.007, 0.004, { sx: 1.08 }), 'upperarm01'); }
    add('metal', ringAt(S0, E0, 0.72, 0.066, 0.05, 0.012), 'upperarm01', { color: STEEL }); if (!low) add('gold', ringAt(S0, E0, 0.72, 0.069, 0.007, 0.004), 'upperarm01'); add('ember', ringAt(S0, E0, 0.72, 0.0725, 0.004, 0.003), 'upperarm01', { color: EMBER });
    add('metal', X(dome(0.058, 0.05, { lip: 0.3, seg: S(9, 6), crease: 30 }), { p: [E0.x + 0.03, E0.y + 0.0, E0.z - 0.035], r: [0, 0, -Math.PI / 2 + 0.2] }), 'lowerarm01', { color: STEEL_D });
    add('bone', spikeAt(E0.clone().add(V(0.075, 0.0, -0.04)), V(1, 0.25, -0.7), 0.12, 0.019, 0.025, Y), 'lowerarm01', { color: BONE_D });
    const fl = W0.distanceTo(E0), D = W0.clone().sub(E0).normalize();
    add('metal', limb(cuff(0.066, 0.05, fl * 0.84, 0.012, S(8, 6), 25), E0, W0, 0.5), 'lowerarm01', { color: STEEL_D });
    const wing = G.plate([[0.0, -0.1], [0.05, -0.08], [0.062, 0.0], [0.045, 0.09], [0.0, 0.11], [-0.01, 0.0]], 0.012, 0.004);
    add('metal', limb(wing, E0, W0, 0.5, { off: [-0.075, 0, 0.0], r: [0, Math.PI / 2, 0] }), 'lowerarm01', { color: STEEL });
    t.armorPlate('lowerarm01', [[-0.03, 0.09], [0.03, 0.09], [0.024, -0.09], [-0.024, -0.09]], { depth: 0.014, bevel: 0.005, wrap: { rx: 0.062, rz: 0.066 }, color: STEEL_D, trim: 'ember', trimInset: 0.18, place: (g) => limb(g, E0, W0, 0.55) });
    for (const tt of [0.1, 0.9]) if (!low) add('gold', ringAt(E0, W0, tt, 0.056 - (tt - 0.1) * 0.03, 0.012, 0.005), 'lowerarm01');
    add('ember', limb(G.tube([V(-0.07, -0.09, 0.02), V(-0.082, 0.0, 0.0), V(-0.07, 0.09, -0.02)], 0.0034, 0.0034, { radial: 4, tubular: 6 }), E0, W0, 0.5), 'lowerarm01', { color: EMBER });
    // cuchilla de espíritu: base metálica, hoja translúcida (degradado blanco-celeste → azul) y filo de luz
    const bl = 0.7, bt = 0.62, pos0 = E0.clone().lerp(W0, bt);
    add('metal', limb(t.box(0.034, 0.12, 0.07, 0.008, 1), E0, W0, bt, { off: [-0.085, 0, 0] }), 'lowerarm01', { color: STEEL });
    const grad = (x, y, z) => { const u = Math.min(1, Math.max(0, ((x - pos0.x) * D.x + (y - pos0.y) * D.y + (z - pos0.z) * D.z) / bl)); return new T.Color(0xaee4ff).lerp(new T.Color(0x1f6dff), u * 0.95); };
    add('spirit', limb(t.blade(bl, 0.085, 0.006, { tipLean: 0.1 }), E0, W0, bt, { off: [-0.085, 0, 0], r: [0, Math.PI / 2, 0] }), 'lowerarm01', { color: grad });
    add('light', limb(t.blade(bl * 0.96, 0.011, 0.012), E0, W0, bt, { off: [-0.085, 0.01, 0], r: [0, Math.PI / 2, 0] }), 'lowerarm01', { color: (x, y, z) => grad(x, y, z).multiplyScalar(0.7) });
    // mano: placa dorsal, nudillos y garras de hueso
    const F3 = P('finger3-1');
    add('metal', limb(t.box(0.095, 0.1, 0.02, 0.007, 1), W0, F3, 0.5, { off: [-0.04, 0, 0], r: [0, Math.PI / 2, 0] }), 'wrist', { color: STEEL_D });
    for (const [f, len, r] of [['finger2', 0.075, 0.0085], ['finger3', 0.1, 0.009], ['finger4', 0.088, 0.0085], ['finger5', 0.062, 0.0075]]) {
      const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize();
      add('bone', spikeAt(b.clone().addScaledVector(d, 0.004), d.clone().add(V(0, -0.1, 0.1)), len, r, -0.012, V(0, 0.4, 0.2), { radial: 5 }), `${f}-3`, { color: BONE });
      add('metal', limb(t.box(0.022, a.distanceTo(b) * 1.1, 0.018, 0.006, 1), a, b, 0.55, { off: [-0.006, 0, 0] }), `${f}-2`, { color: STEEL_D });
    }
    { const a = P('finger1-2'), b = P('finger1-3'), d = b.clone().sub(a).normalize(); add('bone', spikeAt(b, d, 0.06, 0.008, -0.01, V(0, 1, 0.3), { radial: 5 }), 'finger1-3', { color: BONE }); }
  });

  // ═══════════════════════════ FALDONES Y PIERNAS
  ak.both(() => {
    const H = P('upperleg01'), K = P('lowerleg01'), A = P('foot'), TO = P('toe3-1'), ll = K.distanceTo(A), ul = H.distanceTo(K);
    add('metal', limb(cuff(0.088, 0.068, ul * 0.78, 0.012, S(10, 7), 28), H, K, 0.46), 'upperleg01', { color: STEEL_D });
    t.armorPlate('upperleg01', [[-0.06, 0.1], [0.06, 0.1], [0.075, 0.0], [0.045, -0.12], [0, -0.14], [-0.045, -0.12], [-0.075, 0.0]], { depth: 0.016, bevel: 0.006, wrap: { rx: 0.115, rz: 0.1 }, color: STEEL, trim: 'ember', trimInset: 0.15, place: (g) => limb(g, H, K, 0.16, { r: [0, -Math.PI / 2 + 0.1, 0] }) });
    add('gold', limb(G.wrapE(G.plate([[-0.062, 0.102], [0.062, 0.102], [0.077, 0.096], [-0.077, 0.096]], 0.02, 0.003), 0.116, 0.101), H, K, 0.16, { r: [0, -Math.PI / 2 + 0.1, 0] }), 'upperleg01');
    for (let i = 0; i < 3; i++) add('metal', limb(G.wrapE(G.plate([[-0.05 + i * 0.004, 0.06], [0.05 - i * 0.004, 0.06], [0.04, -0.05], [0, -0.07], [-0.04, -0.05]], 0.014, 0.005), 0.108 - i * 0.004, 0.098 - i * 0.004), H, K, 0.28 + i * 0.1), 'upperleg01', { color: i % 2 ? STEEL : STEEL_D });
    t.armorPlate('upperleg01', [[-0.045, 0.16], [0.045, 0.16], [0.04, -0.14], [0, -0.17], [-0.04, -0.14]], { depth: 0.016, bevel: 0.006, wrap: { rx: 0.082, rz: 0.088 }, color: STEEL_D, trim: 'gold', trimInset: 0.1, place: (g) => limb(g, H, K, 0.52) });
    add('ember', limb(G.tube([V(0.0, 0.14, 0.092), V(0.003, 0.0, 0.098), V(-0.003, -0.13, 0.094)], 0.0034, 0.0034, { radial: 4, tubular: 8 }), H, K, 0.52), 'upperleg01', { color: EMBER });
    add('metal', ringAt(H, K, 0.88, 0.076, 0.06, 0.012), 'upperleg01', { color: STEEL }); if (!low) add('gold', ringAt(H, K, 0.88, 0.0785, 0.007, 0.004), 'upperleg01');
    t.armorPlate('lowerleg01', [[0, 0.075], [0.052, 0.04], [0.06, -0.015], [0.02, -0.062], [-0.02, -0.062], [-0.06, -0.015], [-0.052, 0.04]], { depth: 0.034, bevel: 0.012, wrap: { rx: 0.078, rz: 0.086 }, color: STEEL, trim: 'ember', trimInset: 0.2, trimR: 0.0032, place: (g) => X(g, { p: [K.x, K.y, K.z - 0.005] }) });
    add('metal', X(G.wrapE(G.plate([[0.0, 0.03], [0.04, 0.02], [0.035, -0.045], [0, -0.06]], 0.02, 0.007), 0.08, 0.088), { p: [K.x, K.y - 0.0, K.z], r: [0, 0.8, 0] }), 'lowerleg01', { color: STEEL_D });
    add('gold', X(G.wrapE(G.plate([[0.0, 0.082], [0.054, 0.045], [0.0, 0.07]], 0.036, 0.003), 0.08, 0.088), { p: [K.x, K.y, K.z - 0.005] }), 'lowerleg01');
    add('ember', seam([V(K.x - 0.004, K.y + 0.06, K.z + 0.1), V(K.x, K.y, K.z + 0.115), V(K.x - 0.004, K.y - 0.05, K.z + 0.105)], 0.003), 'lowerleg01', { color: EMBER });
    add('bone', spikeAt(K.clone().add(V(0.0, 0.015, 0.118)), V(0.15, 0.55, 1), 0.1, 0.022, 0.02, Y, { ridges: 3 }), 'lowerleg01', { color: BONE_D });
    add('metal', limb(cuff(0.078, 0.056, ll * 0.88, 0.012, S(10, 7), 25), K, A, 0.5), 'lowerleg01', { color: STEEL_D });
    add('bone', limb(G.wrapE(G.plate([[-0.022, 0.15], [0.022, 0.15], [0.016, -0.14], [0, -0.17], [-0.016, -0.14]], 0.02, 0.007), 0.06, 0.07), K, A, 0.46), 'lowerleg01', { color: BONE_D });
    add('ember', limb(G.tube([V(0, 0.13, 0.078), V(0.002, 0.0, 0.082), V(-0.002, -0.12, 0.076)], 0.0032, 0.0032, { radial: 4, tubular: 8 }), K, A, 0.46), 'lowerleg01', { color: EMBER });
    for (const tt of [0.08, 0.92]) if (!low) add('gold', ringAt(K, A, tt, 0.06 - (tt - 0.08) * 0.02, 0.014, 0.005), 'lowerleg01');
    const boot = G.plate([[-0.065, 0.0], [-0.07, 0.07], [-0.035, 0.115], [0.03, 0.115], [0.1, 0.075], [0.185, 0.04], [0.215, 0.012], [0.19, 0.0]], 0.095, 0.022, { crease: 50 });
    X(boot, { r: [0, -Math.PI / 2, 0] }); X(boot, { p: [A.x + 0.005, 0.0, 0.0] }); add('metal', boot, 'foot', { color: STEEL_D });
    add('metal', X(G.plate([[0.02, 0.1], [0.11, 0.085], [0.19, 0.045], [0.14, 0.05], [0.07, 0.07]], 0.09, 0.012, { crease: 50 }), { r: [0, -Math.PI / 2, 0], p: [A.x + 0.005, 0.012, 0.0] }), 'foot', { color: STEEL });
    add('metal', X(t.box(0.11, 0.018, 0.26, 0.007, 1), { p: [A.x + 0.005, 0.009, 0.06] }), 'foot', { color: 0x2a2c38 });
    add('bone', spikeAt(V(TO.x, 0.04, 0.2), V(0, 0.12, 1), 0.075, 0.02, 0.012, Y, { ridges: 3 }), 'toe3-1', { color: BONE_D });
    add('bone', spikeAt(V(A.x, 0.07, -0.062), V(0, 0.35, -1), 0.07, 0.017, 0.012, Y), 'foot', { color: BONE_D });
    add('ember', seam([V(A.x - 0.04, 0.113, 0.0), V(A.x, 0.12, 0.04), V(A.x + 0.04, 0.113, 0.0)], 0.0028), 'foot', { color: EMBER });
    add('gold', X(G.torus(0.064, 0.0045, 4, S(14, 8)), { p: [A.x, A.y + 0.055, A.z] }), 'foot'); add('ember', X(G.torus(0.0575, 0.003, 4, S(14, 8)), { p: [A.x, A.y + 0.07, A.z] }), 'foot', { color: EMBER });
  });

  // ═══════════════════════════ ESPALDA: columna de púas, halo de espadas rotas, capa y faldones de tela
  {
    for (let i = 0; i < 7; i += (low ? 3 : 1)) { const y = 1.42 - i * 0.055, L = 0.13 - Math.abs(i - 2) * 0.012; add('bone', spikeAt(V(0, y, -0.088), V(0, 0.25 + i * 0.02, -1), L, 0.016 - i * 0.0008, 0.015, Y, { ridges: 3, ridgeAmp: 0.15 }), i < 3 ? 'spine01' : i < 5 ? 'spine02' : 'spine03', { color: BONE_D }); }
    add('metal', t.box(0.07, 0.34, 0.03, 0.012, 1).translate(0, 1.24, -0.098), 'spine01', { color: STEEL_D });
    const hub = V(0, 1.36, -0.24), hb = ak.bone('halo', 'spine01', hub);
    add('gold', X(G.torus(0.19, 0.0045, 4, S(30, 14)), { p: [hub.x, hub.y, hub.z], r: [Math.PI / 2, 0, 0] }), 'halo');
    add('ember', X(G.torus(0.172, 0.0028, 4, S(30, 14)), { p: [hub.x, hub.y, hub.z], r: [Math.PI / 2, 0, 0] }), 'halo', { color: EMBER });
    const rr2 = t.rng(7);
    const nb = low ? 6 : 9;
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2, d = V(Math.cos(a), Math.sin(a), 0), len = 0.17 + rr2() * 0.2, w = 0.04 + rr2() * 0.02;
      const g = t.blade(len, w, 0.012, { tipLean: (rr2() - 0.5) * 0.5 }); X(g, { q: t.basisQ(d, V(0, 0, 1)), p: [hub.x + d.x * 0.2, hub.y + d.y * 0.2, hub.z] });
      add('metal', g, 'halo', { color: i % 3 === 0 ? STEEL : STEEL_D });
      if (i % 2 === 0 && !low) add('ember', G.cone(0.008, 0.02, 4).rotateZ(a - Math.PI / 2).translate(hub.x + d.x * (0.2 + len), hub.y + d.y * (0.2 + len), hub.z), 'halo', { color: EMBER_HOT });
      if (!low || i % 2 === 0) add('ember', X(t.blade(len * 0.6, 0.0045, 0.014), { q: t.basisQ(d, V(0, 0, 1)), p: [hub.x + d.x * 0.205, hub.y + d.y * 0.205, hub.z] }), 'halo', { color: EMBER });
    }
    ak.halo('halo', hub, 0xff8a40, 1.0, 0.16);
    upd.push((dt, tt) => { hb.rotation.z = tt * 0.22; });
    const cols = [], lens = [], R2 = t.rng(11);
    for (let j = 0; j < 8; j++) { const x = -0.235 + j * (0.47 / 7); cols.push({ bone: j === 0 ? 'clavicle_R' : j === 7 ? 'clavicle_L' : 'spine01', p: V(x, 1.405 - Math.abs(x) * 0.12, -0.098 - 0.02 * (1 - Math.abs(x) / 0.235)) }); lens.push(0.78 + 0.3 * Math.cos((j / 7 - 0.5) * 2.4) + (R2() - 0.5) * 0.28); }
    ak.cloth({ top: cols, dir: V(0, -1, -0.1), lens, rows: S(10, 6), color: 0x6a2a3c, hem: 0x1a0c10, gravity: 7, stiff: 0.012, drag: 0.982, wave: 0.03, ember: 1 });
    const c2 = [], l2 = []; for (let j = 0; j < 5; j++) { c2.push({ bone: 'spine05', p: V(-0.1 + j * 0.05, 0.93, -0.098) }); l2.push(0.6 + (R2() - 0.5) * 0.22); }
    ak.cloth({ top: c2, dir: V(0, -1, -0.05), lens: l2, rows: S(7, 5), color: 0x4a2030, hem: 0x1a0c10, gravity: 7, stiff: 0.02, drag: 0.98, wave: 0.015, ember: 0.8 });
    const c3 = [], l3 = []; for (let j = 0; j < 4; j++) { c3.push({ bone: 'spine05', p: V(-0.075 + j * 0.05, 0.92, 0.185) }); l3.push(0.38 + (R2() - 0.5) * 0.16); }
    ak.cloth({ top: c3, dir: V(0, -1, 0.12), lens: l3, rows: S(6, 4), color: 0x5a2434, hem: 0x1a0c10, gravity: 7, stiff: 0.03, drag: 0.98, ember: 0.8 });
    ak.collider('spine02', V(0, 1.0, 0.045), V(0, 1.36, 0.045), 0.17); ak.collider('spine05', V(0, 0.86, 0.045), V(0, 0.98, 0.045), 0.185);
    ak.both(() => ak.collider('upperleg01', P('upperleg01'), P('lowerleg01'), 0.105));
    ak.embers(EMBER, low ? 22 : 40, { radius: 0.5, height: 2.1, size: 5 });
  }
  const evo = addEvolution(ak, ctx, { t });
  return { update: (dt, tt, c) => { upd.forEach((f) => f(dt, tt, c)); evo.update(dt, tt, c); } };
}
