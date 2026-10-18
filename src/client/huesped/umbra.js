// UMBRA — EL ERRANTE (docs/HUESPEDES_ARTE.md). Un espectro que flota: sudario de sombra que le tapa las piernas y se deshace en jirones de tela (física Verlet) y volutas de humo y
// luz; capucha vacía con dos puntos de luz y una máscara de espejo ROTA; armadura mínima de obsidiana (espejo oscuro) con filigrana violeta; fragmentos de espejo que orbitan y
// giran sobre sí mismos (reflejan el cielo HDRI); tres anillos de runas que giran; una hoja dimensional que atraviesa planos de luz; núcleo que late con uBeat en el pecho.
// Se escribe en el marco del modelo (pose de enlace); el lado izquierdo (+x) va dentro de ak.both(); ak.one('R') dibuja sólo la mano derecha (con coordenadas del lado L).
// Flotar: update() suma una oscilación propia (balanceo, inclinación hacia donde se mueve, respiración) a la pelvis y la columna DESPUÉS de las animaciones, sin pisar los clips.
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';
import { uBeat } from '../shaders.js';

export const BELLY = 0;
const VIO = 0xb98cff, VIO_D = 0x7a4cff, LILA = 0xcfb4ff, OBS = 0x1c1232, OBS_D = 0x1e1438, VOID = 0x000000, MIR = 0xa8b0d0, MIRV = 0x9a86d0, SHROUD = 0x1c1236;

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, ringAt, cuff, S, low, basisQ } = t, P = (n) => ak.P(n), add = ak.add, Y = V(0, 1, 0), Zv = V(0, 0, 1), HC = V(0, 1.6, 0.06), upd = [], R = t.rng(51), TAU = Math.PI * 2;
  const cnew = (h) => new T.Color(h);
  ak.material('mirror').envMapIntensity = low ? 1.3 : 1.2;
  { const dm = ak.material('dark'); dm.roughness = 0.6; dm.metalness = 1; dm.envMapIntensity = 0.7; } // sudario mate: sólo un brillo en los bordes


  // ═══════════════════════════ CAPUCHA VACÍA + MÁSCARA DE ESPEJO ROTA
  {
    const shell = G.lathe([[0.1, -0.13], [0.135, -0.07], [0.15, 0.02], [0.14, 0.1], [0.105, 0.17], [0.06, 0.235], [0.025, 0.3], [0.004, 0.37]], S(16, 10), 0, TAU, 32);
    add('dark', X(shell, { p: [HC.x, HC.y, HC.z - 0.03], s: [1, 1, 1.22] }), 'head', { color: SHROUD });
    // cola de la capucha: cae a la espalda como un pico de tela
    add('dark', G.tube([V(0, 0.2, -0.1), V(0, 0.1, -0.2), V(0, -0.06, -0.26), V(0, -0.24, -0.25), V(0, -0.4, -0.2)], 0.1, 0.012, { radial: S(8, 6), tubular: S(10, 6), sx: 1.35, sz: 0.5, ease: 0.7 }).translate(HC.x, HC.y, HC.z), 'head', { color: OBS_D });
    // cara de vacío (negro absoluto) con aro de obsidiana y filo de luz alrededor de la abertura
    add('light', X(G.sphere(0.112, S(14, 9), S(10, 7)), { p: [HC.x, HC.y - 0.005, HC.z + 0.095], s: [1, 1.18, 0.74] }), 'head', { color: 0x000000 });
    add('mirror', X(G.torus(0.118, 0.012, S(6, 4), S(26, 14)), { p: [HC.x, HC.y, HC.z + 0.118], r: [Math.PI / 2, 0, 0], s: [1, 1, 1.2] }), 'head', { color: OBS });
    add('ember', X(G.torus(0.108, 0.0034, 3, S(30, 16)), { p: [HC.x, HC.y, HC.z + 0.128], r: [Math.PI / 2, 0, 0], s: [1, 1, 1.2] }), 'head', { color: VIO });
    // los dos puntos de luz (ojos): núcleo blanco + lente violeta, con un halo
    for (const s of [-1, 1]) {
      add('light', X(G.sphere(0.017, 8, 6), { p: [HC.x + s * 0.042, HC.y + 0.03, HC.z + 0.162], s: [1.5, 0.95, 0.7] }), 'head', { color: 0xffffff });
      add('light', X(G.sphere(0.03, 8, 6), { p: [HC.x + s * 0.042, HC.y + 0.03, HC.z + 0.152], s: [1.9, 0.9, 0.5] }), 'head', { color: VIO });
      add('ember', seam([V(HC.x + s * 0.075, HC.y + 0.034, HC.z + 0.14), V(HC.x + s * 0.11, HC.y + 0.05, HC.z + 0.11)], 0.0026), 'head', { color: VIO });
    }
    ak.halo('head', V(HC.x, HC.y + 0.022, HC.z + 0.2), VIO, 0.34, 0.55);
    // máscara de espejo ROTA: casco de 4 esquirlas curvas sobre la mitad izquierda del rostro y trozos desprendidos; entre ellas, grietas de luz
    const rx = 0.116, rz = 0.13, Z0 = HC.z + 0.072, Rm = (rx + rz) / 2, face = (x, y, lift = 0) => { const a = x / Rm, sa = Math.sin(a), ca = Math.cos(a), nl = Math.hypot(sa / rx, ca / rz); return V(rx * sa + (sa / rx / nl) * lift, HC.y + y, Z0 + rz * ca + (ca / rz / nl) * lift); };
    const shards = [
      { pts: [[-0.004, -0.004], [0.07, 0.012], [0.105, -0.034], [0.07, -0.07], [0.02, -0.05]], th: 0.014, col: MIR, dz: 0 },
      { pts: [[0.0, -0.062], [0.06, -0.082], [0.075, -0.13], [0.03, -0.15], [-0.008, -0.11]], th: 0.012, col: MIRV, dz: 0.004 },
      { pts: [[-0.02, -0.07], [-0.065, -0.05], [-0.095, -0.1], [-0.05, -0.138], [-0.022, -0.11]], th: 0.012, col: MIR, dz: 0.012 },
      { pts: [[0.09, 0.03], [0.12, 0.012], [0.14, -0.03], [0.108, -0.026]], th: 0.01, col: MIRV, dz: 0.02 },
    ];
    for (const sh of shards) { const g = G.wrapE(G.plate(sh.pts, sh.th, 0.003, { crease: 40 }), rx + sh.dz, rz + sh.dz); g.translate(HC.x, HC.y + 0.003, Z0); add('mirror', g, 'head', { color: sh.col }); }
    add('light', seam([face(0.07, 0.012, 0.01), face(0.03, 0.0, 0.01), face(-0.004, -0.03, 0.01), face(0.02, -0.052, 0.01), face(0.0, -0.1, 0.01), face(-0.03, -0.12, 0.01)], 0.0022), 'head', { color: LILA });
    add('ember', seam([face(0.07, -0.07, 0.012), face(0.1, -0.1, 0.014), face(0.09, -0.14, 0.012)], 0.002), 'head', { color: VIO });
    // trozos flotando delante de la cara (espejo que se va soltando)
    for (const [x, y, z, s, r] of [[0.14, -0.05, 0.19, 0.03, 0.7], [-0.08, -0.17, 0.19, 0.022, -0.5]]) add('mirror', X(G.plate([[0, s], [s * 0.7, -s * 0.2], [0, -s], [-s * 0.6, s * 0.1]], 0.007, 0.002), { p: [HC.x + x, HC.y + y, HC.z + z], r: [0.3, r, r * 0.6] }), 'head', { color: MIR });
    // corona de esquirlas de espejo (orbitan despacio alrededor de la cabeza) y un cuello alto de espinas de obsidiana
    const crown = ak.bone('corona', 'head', V(HC.x, HC.y + 0.06, HC.z - 0.02));
    for (let i = 0; i < (low ? 5 : 7); i++) { const a = (i / (low ? 5 : 7)) * TAU, sz = 0.03 + R() * 0.02; add('mirror', X(G.shard(sz * 3, sz * 0.7, 4), { p: [HC.x + Math.cos(a) * 0.23, HC.y + 0.14 + 0.05 * Math.sin(a * 2), HC.z - 0.02 + Math.sin(a) * 0.23], r: [0.3 * Math.cos(a), a, 0.7] }), 'corona', { color: i % 2 ? MIR : MIRV }); }
    upd.push((dt, tt) => { crown.rotation.y = tt * 0.5; });
    for (let i = 0; i < 6; i++) { const a = Math.PI * (0.6 + i * 0.16), L2 = 0.12 + (i === 2 || i === 3 ? 0.07 : 0); add('mirror', spikeAt(V(Math.sin(a) * 0.1, 1.45, 0.03 + Math.cos(a) * 0.1), V(Math.sin(a) * 0.5, 1, Math.cos(a) * 0.5 - 0.25), L2, 0.016, -0.015, Y, { radial: 4 }), 'neck01', { color: OBS }); }
  }

  // ═══════════════════════════ TORSO: sudario ajustado, peto de obsidiana, filigrana y núcleo que late
  {
    add('dark', X(G.lathe([[0.17, 0.92], [0.185, 1.08], [0.2, 1.28], [0.175, 1.4], [0.1, 1.47], [0.07, 1.5]], S(16, 10), 0, TAU, 28), { p: [0, 0, 0.02], s: [1, 1, 0.72] }), 'spine01', { color: OBS_D });
    ak.both((s) => {
      t.armorPlate('spine01', [[0.012, 0.125], [0.08, 0.14], [0.15, 0.1], [0.162, 0.01], [0.12, -0.075], [0.06, -0.12], [0.012, -0.1]], { mat: 'mirror', depth: 0.03, bevel: 0.01, wrap: { rx: 0.176, rz: 0.13 }, place: (g) => X(g, { p: [0, 1.295, 0.04], r: [0.07, 0, 0] }), color: OBS, trim: 'ember', trimColor: VIO, trimInset: 0.14, trimR: 0.0032 });
      // filigrana: ramas de luz que nacen del núcleo y suben hacia los hombros
      for (const [a, b, c, d] of [[V(0.03, 1.33, 0.185), V(0.08, 1.36, 0.18), V(0.13, 1.33, 0.15), V(0.16, 1.4, 0.1)], [V(0.03, 1.29, 0.19), V(0.1, 1.3, 0.186), V(0.15, 1.25, 0.15), V(0.17, 1.2, 0.1)], [V(0.025, 1.24, 0.19), V(0.07, 1.2, 0.186), V(0.12, 1.16, 0.165), V(0.14, 1.1, 0.12)]]) add('ember', seam([a, b, c, d], 0.0026), 'spine01', { color: VIO });
      add('light', G.sphere(0.0065, 5, 4).translate(0.16, 1.4, 0.1), 'spine01', { color: LILA }); add('light', G.sphere(0.0065, 5, 4).translate(0.14, 1.1, 0.12), 'spine01', { color: LILA });
      // clavícula: placa de espejo oscuro y una esquirla que sale hacia arriba del cuello
      add('mirror', X(G.wrapE(G.plate([[0, 0.05], [0.09, 0.06], [0.125, 0.02], [0.1, -0.03], [0, -0.04]], 0.018, 0.006), 0.1, 0.085), { p: [0.0, 1.42, -0.025], r: [0.9, 0.0, -0.16] }), 'clavicle', { color: OBS });
      add('mirror', spikeAt(V(0.09, 1.43, 0.0), V(0.5, 1, -0.2), s === 'L' ? 0.2 : 0.14, 0.018, 0.012, Zv, { radial: 4 }), 'clavicle', { color: MIRV });
    });
    // espina dorsal: lomo de obsidiana con vértebras
    for (let i = 0; i < 6; i += (low ? 2 : 1)) add('mirror', t.box(0.05, 0.04, 0.03, 0.01, 1).translate(0, 1.42 - i * 0.07, -0.1 - (i === 0 ? 0 : 0)), i < 3 ? 'spine01' : 'spine02', { color: OBS });
    // núcleo que late (hueso propio: se escala con uBeat): cristal + luz + jaula de aros
    const nuc = ak.bone('nucleo', 'spine01', V(0, 1.28, 0.2));
    add('light', G.sphere(0.03, S(10, 7), S(8, 6)).translate(0, 1.28, 0.2), 'nucleo', { color: 0xffffff });
    add('crystal', X(new T.OctahedronGeometry(0.052, 0), { p: [0, 1.28, 0.2], s: [0.8, 1.2, 0.8] }), 'nucleo', { color: VIO });
    for (let i = 0; i < 3; i++) add('light', G.torus(0.058 + i * 0.01, 0.0026, 3, S(18, 10)).rotateX(Math.PI / 2 + (i - 1) * 0.6).rotateY(i * 0.8).translate(0, 1.28, 0.2), 'nucleo', { color: LILA });
    ak.halo('nucleo', V(0, 1.28, 0.24), VIO, 0.5, 0.55);
    upd.push(() => { nuc.scale.setScalar(1 + 0.22 * uBeat.value); });
    // cinturón de obsidiana con esquirlas de espejo colgando
    add('mirror', G.band(0.178, 0.05, 0.02, { seg: S(20, 10), sz: 0.74, simple: low }).translate(0, 0.96, 0.03), 'spine05', { color: OBS });
    add('ember', G.torus(0.18, 0.0034, 3, S(22, 12)).scale(1, 1, 0.74).translate(0, 0.99, 0.03), 'spine05', { color: VIO });
    add('mirror', X(G.plate([[0, 0.07], [0.05, 0.0], [0.0, -0.075], [-0.05, 0.0]], 0.014, 0.004), { p: [0, 0.96, 0.2], r: [0.1, 0, 0] }), 'spine05', { color: MIR });
    for (let i = 0; i < (low ? 3 : 5); i++) { const a = 0.55 + i * (low ? 0.8 : 0.5), sg = i % 2 ? -1 : 1, sz = 0.04 + 0.01 * (i % 3); for (const m of [1, -1]) add('mirror', X(G.plate([[0, sz], [sz * 0.55, 0], [0, -sz * 1.5], [-sz * 0.5, 0]], 0.01, 0.003), { p: [m * Math.sin(a) * 0.2, 0.9, 0.03 + Math.cos(a) * 0.15], r: [0, m * a, 0.1 * sg] }), 'spine05', { color: i % 2 ? MIRV : OBS }); }
  }

  // ═══════════════════════════ HOMBROS, BRAZOS Y MANOS
  ak.both((s) => {
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'), P0 = S0.clone().add(V(0, 0.055, 0)), big = s === 'L';
    for (let i = 0; i < (low ? 3 : 4); i++) {
      const R0 = 0.128 - i * 0.006, len = 0.14 + (i === 0 ? 0.04 : 0), wArc = 0.28 - i * 0.02, th = 0.018 - i * 0.002;
      t.armorPlate('upperarm01', [[-wArc / 2, 0.0], [-wArc * 0.5, len * 0.55], [-wArc * 0.3, len], [0, len * 1.1], [wArc * 0.3, len], [wArc * 0.5, len * 0.55], [wArc / 2, 0.0]], { mat: 'mirror', depth: th, bevel: th * 0.38, wrap: { rx: R0, rz: R0 * 0.94 }, color: i % 2 ? OBS : 0x382458, trim: i < 2 ? 'ember' : null, trimColor: VIO, trimInset: 0.1, trimR: 0.0028,
        place: (g) => { X(g, { r: [-Math.PI / 2, 0, -Math.PI / 2] }); return X(g, { p: [P0.x + 0.02 + i * 0.04, P0.y - i * 0.035, P0.z], r: [0, 0, -0.1 - i * 0.2] }); } });
    }
    // esquirlas de espejo que brotan del hombro (la izquierda, más alta; la derecha, rota con luz en la fractura)
    const sh = (dx, dy, dz, dir, len, r, col) => add('mirror', spikeAt(P0.clone().add(V(dx, dy, dz)), dir, len, r, 0.02, Zv, { radial: 4, ridges: 0 }), 'upperarm01', { color: col });
    sh(0.06, 0.08, -0.02, V(0.35, 1, -0.2), big ? 0.34 : 0.2, 0.034, MIR); sh(0.1, 0.05, 0.05, V(0.8, 0.9, 0.3), big ? 0.22 : 0.15, 0.026, MIRV); sh(0.0, 0.08, -0.08, V(-0.1, 1, -0.6), big ? 0.26 : 0.12, 0.026, OBS);
    if (!big) add('light', G.cone(0.02, 0.04, 4).translate(P0.x + 0.1, P0.y + 0.2, P0.z - 0.02), 'upperarm01', { color: VIO });
    add('ember', seam([V(P0.x + 0.03, P0.y + 0.115, P0.z - 0.1), V(P0.x + 0.1, P0.y + 0.12, P0.z - 0.03), V(P0.x + 0.16, P0.y + 0.09, P0.z + 0.06)], 0.003), 'upperarm01', { color: VIO });
    for (let i = 0; i < 2; i++) add('mirror', limb(cuff(0.1 - i * 0.008, 0.095 - i * 0.008, 0.05, 0.01, S(10, 7), 30), S0, E0, 0.3 + i * 0.22, { s: [1.05, 1, 1] }), 'upperarm01', { color: OBS });
    add('ember', ringAt(S0, E0, 0.5, 0.098, 0.012, 0.004), 'upperarm01', { color: VIO });
    // antebrazo: brazalete de obsidiana con filigrana y manga acampanada de sombra que cubre la muñeca
    t.armorPlate('lowerarm01', [[-0.03, 0.085], [0.03, 0.085], [0.022, -0.085], [-0.022, -0.085]], { mat: 'mirror', depth: 0.014, bevel: 0.005, wrap: { rx: 0.062, rz: 0.066 }, color: 0x382458, trim: 'ember', trimColor: VIO, trimInset: 0.2, place: (g) => limb(g, E0, W0, 0.4) });
    add('dark', limb(cuff(0.058, 0.115, 0.27, 0.012, S(12, 8), 24), E0, W0, 0.7), 'lowerarm01', { color: SHROUD });
    add('dark', limb(cuff(0.082, 0.062, S0.distanceTo(E0) * 0.96, 0.01, S(10, 7), 20), S0, E0, 0.5), 'upperarm01', { color: OBS_D });
    add('dark', limb(cuff(0.066, 0.056, E0.distanceTo(W0) * 0.62, 0.01, S(10, 7), 20), E0, W0, 0.28), 'lowerarm01', { color: OBS_D });
    add('ember', limb(G.torus(0.116, 0.0034, 3, S(18, 10)), E0, W0, 0.7 + 0.135 / E0.distanceTo(W0)), 'lowerarm01', { color: VIO });
    // garras de espejo
    for (const [f, len, r] of [['finger2', 0.1, 0.0085], ['finger3', 0.125, 0.009], ['finger4', 0.11, 0.0085], ['finger5', 0.08, 0.0075]]) {
      const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize();
      add('mirror', spikeAt(b.clone().addScaledVector(d, 0.004), d.clone().add(V(0, -0.1, 0.1)), len, r, -0.016, V(0, 0.4, 0.2), { radial: S(4, 4) }), `${f}-3`, { color: MIR });
    }
    { const a = P('finger1-2'), b = P('finger1-3'), d = b.clone().sub(a).normalize(); add('mirror', spikeAt(b, d, 0.07, 0.008, -0.01, V(0, 1, 0.3), { radial: 4 }), 'finger1-3', { color: MIR }); }
  });

  // ═══════════════════════════ HOJA DIMENSIONAL (mano derecha): atraviesa dos planos de luz y reaparece desplazada
  ak.one('R', () => {
    const W0 = P('wrist'), D = V(0.85, 0.2, 0.62).normalize(), tip = (u) => W0.clone().addScaledVector(D, u), seg = (g, u, off, col, mat = 'mirror') => add(mat, limb(g, W0, tip(1), u, { off }), 'wrist', { color: col });
    seg(t.box(0.03, 0.04, 0.16, 0.01, 1), 0.04, [0, 0, 0], OBS); // empuñadura
    seg(t.box(0.05, 0.05, 0.05, 0.01, 1), 0.075, [0, 0, 0], VIO, 'light');
    // tramos de hoja: la hoja es la misma pero cada tramo está corrido de lado (cruzó un plano)
    const parts = [[0.1, 0.5, 0.0, 0.085], [0.58, 0.95, 0.07, 0.085], [1.02, 1.42, 0.15, 0.08]];
    for (const [u0, u1, dx, w] of parts) {
      const len = u1 - u0, ang = 0.0, base = limb(G.blade(len, w, 0.014, { n: low ? 3 : 6, tipLean: u1 > 1.3 ? 0.12 : 0 }), tip(0), tip(1), 0, { off: [dx, 0, 0] }); void ang;
      base.translate(D.x * u0, D.y * u0, D.z * u0); add('mirror', base, 'wrist', { color: u0 > 1 ? MIRV : OBS });
      const edge = limb(G.blade(len, 0.012, 0.016), tip(0), tip(1), 0, { off: [dx, 0, 0.001] }); edge.translate(D.x * u0, D.y * u0, D.z * u0); add('light', edge, 'wrist', { color: VIO });
    }
    // planos: marco de luz + membrana translúcida perpendicular a la hoja
    for (const [u, sz, dx] of [[0.54, 0.2, 0.035], [0.985, 0.26, 0.11]]) {
      const hs = sz / 2, fr = [t.box(sz, 0.012, 0.012, 0.003, 1).translate(0, 0, hs), t.box(sz, 0.012, 0.012, 0.003, 1).translate(0, 0, -hs), t.box(0.012, 0.012, sz, 0.003, 1).translate(hs, 0, 0), t.box(0.012, 0.012, sz, 0.003, 1).translate(-hs, 0, 0)];
      const lf = G.merge(fr), pane = new T.BoxGeometry(sz * 0.98, 0.002, sz * 0.98);
      add('light', limb(lf, tip(0), tip(1), u, { off: [dx, 0, 0], r: [0, 0.35, 0] }), 'wrist', { color: LILA });
      add('spirit', limb(pane, tip(0), tip(1), u, { off: [dx, 0, 0], r: [0, 0.35, 0] }), 'wrist', { color: cnew(VIO_D).multiplyScalar(0.55) });
    }
    // imagen residual de la hoja (espíritu): la hoja que «ya pasó»
    add('spirit', limb(G.blade(1.3, 0.1, 0.004, { n: 4 }), tip(0), tip(1), 0.1, { off: [-0.06, 0, 0] }), 'wrist', { color: (x, y, z) => cnew(VIO_D).multiplyScalar(0.5 * Math.max(0.1, 1 - ((x - W0.x) * D.x + (y - W0.y) * D.y + (z - W0.z) * D.z) / 1.4)) });
  });

  // ═══════════════════════════ SUDARIO: manto rígido que tapa las piernas + telas con física + jirones de humo/luz
  {
    // manto interior (rígido, sale de la cintura y llega casi al suelo con el borde mordido)
    const rob = G.lathe([[0.33, -0.14], [0.33, 0.06], [0.31, 0.25], [0.27, 0.48], [0.235, 0.7], [0.205, 0.88], [0.185, 1.0]], S(24, 12), 0, TAU, 0);
    G.warp(rob, (x, y, z) => { if (y < 0.3) { const a = Math.atan2(z, x), k = (0.3 - y) / 0.36, j = Math.max(0, Math.sin(a * 7 + 0.5) * Math.sin(a * 3 + 1.2)); return [x, y + k * (j * 0.1 - 0.01), z]; } return [x, y, z]; });
    G.warp(rob, (x, y, z) => { const a = Math.atan2(z, x), f = 1 + 0.045 * Math.sin(a * 11 + y * 2.2) * Math.min(1, (1.0 - y) * 2); return [x * f, y, z * f]; }); // pliegues verticales
    add('dark', X(rob, { p: [0, 0, 0.02], s: [1, 1, 0.92] }), 'spine05', { color: SHROUD });
    { const cm = ak.material('cloth'); cm.map = null; cm.roughnessMap = null; cm.roughness = 0.62; cm.metalness = 1; cm.envMapIntensity = 0.8; cm.color.set(0xffffff); cm.needsUpdate = true; } // tela lisa: el color sale del vértice (sin el tono marrón del lino)
    const flare = (cl, k, cx, cz, pw = 1.4) => { for (let i = 0; i < cl.rows; i++) for (let j = 0; j < cl.cols; j++) { const b = cl.bind[i * cl.cols + j], f = i / (cl.rows - 1); const dx = cl.top[j].p.x - cx, dz = cl.top[j].p.z - cz, l = Math.hypot(dx, dz) || 1; b.x += (dx / l) * k * Math.pow(f, pw); b.z += (dz / l) * k * Math.pow(f, pw); } return cl; }; // abre el vuelo de la tela hacia afuera
    // filigrana en el sudario: ramas de luz que bajan por la espalda
    for (let k = -2; k <= 2; k++) { const pts = []; for (let i = 0; i <= 6; i++) { const y = 0.95 - i * 0.14, x = k * (0.03 + i * 0.018) + Math.sin(i * 1.3 + k) * 0.012, rr = (0.2 + i * 0.016) * 1.1; pts.push(V(x, y, 0.02 - Math.sqrt(Math.max(0.001, rr * rr - x * x)) * 0.93)); } add('ember', seam(pts, 0.0024), 'spine05', { color: VIO }); }
    // faldón de telas: anillo de 18 jirones de largo distinto
    const cols = [], lens = [], N = low ? 16 : 22;
    for (let j = 0; j < N; j++) { const a = (j / (N - 1)) * (TAU - 0.5) + Math.PI + 0.25; cols.push({ bone: j % 2 ? 'spine05' : 'spine04', p: V(Math.sin(a) * 0.22, 0.99, 0.03 + Math.cos(a) * 0.19) }); lens.push(0.78 + (R() - 0.35) * 0.42 + (j % 3 === 0 ? 0.12 : 0)); }
    flare(ak.cloth({ top: cols, dir: V(0, -1, 0), lens, rows: S(10, 6), color: 0x32225a, hem: 0x08050f, gravity: 5, stiff: 0.02, drag: 0.985, wave: 0.04, ember: 1.1 }), 0.2, 0, 0.03);
    // capa trasera, ancha, con los largos rotos
    const c2 = [], l2 = []; const M = low ? 8 : 11; for (let j = 0; j < M; j++) { const x = -0.25 + j * (0.5 / (M - 1)); c2.push({ bone: 'spine01', p: V(x, 1.42 - Math.abs(x) * 0.1, -0.1) }); l2.push(1.25 + 0.3 * Math.cos((j / (M - 1) - 0.5) * 2.2) + (R() - 0.5) * 0.45); }
    flare(ak.cloth({ top: c2, dir: V(0, -1, -0.3), lens: l2, rows: S(12, 8), color: 0x281a46, hem: 0x08050f, gravity: 6, stiff: 0.012, drag: 0.982, wave: 0.03, ember: 1.0 }), 0.22, 0, 0.1);
    // faldón delantero (jirón central)
    const c3 = [], l3 = []; for (let j = 0; j < 4; j++) { c3.push({ bone: 'spine05', p: V(-0.075 + j * 0.05, 0.95, 0.2) }); l3.push(0.7 + (R() - 0.5) * 0.2); }
    flare(ak.cloth({ top: c3, dir: V(0, -1, 0.1), lens: l3, rows: S(8, 5), color: 0x32225a, hem: 0x08050f, gravity: 6, stiff: 0.03, drag: 0.98, ember: 0.9 }), 0.1, 0, 0.0);
    ak.collider('spine02', V(0, 1.0, 0.045), V(0, 1.36, 0.045), 0.18); ak.collider('spine05', V(0, 0.86, 0.045), V(0, 0.98, 0.045), 0.21); ak.collider('spine05', V(0, 0.3, 0.03), V(0, 0.8, 0.03), 0.3);
    ak.both(() => { ak.collider('upperleg01', P('upperleg01'), P('lowerleg01'), 0.13);
      const H = P('upperleg01'), K = P('lowerleg01'), A = P('foot'); // piernas y pies cubiertos de sombra (por si asoman bajo el sudario)
      add('dark', limb(cuff(0.1, 0.08, H.distanceTo(K) * 0.98, 0.01, S(9, 6), 20), H, K, 0.5), 'upperleg01', { color: OBS_D });
      add('dark', limb(cuff(0.075, 0.06, K.distanceTo(A) * 0.98, 0.01, S(9, 6), 20), K, A, 0.5), 'lowerleg01', { color: OBS_D });
      add('dark', X(t.box(0.1, 0.07, 0.27, 0.02, 1), { p: [A.x + 0.005, 0.04, 0.05] }), 'foot', { color: OBS_D });
    });
    // volutas: jirones de espíritu (cadenas con física) que se deshacen en luz; cada eslabón se desvanece hacia la punta
    const wisp = (name, parent, p0, dir, len, n, w, o = {}) => {
      const d = dir.clone().normalize(), pts = []; for (let i = 0; i <= n; i++) { const u = i / n; pts.push(p0.clone().addScaledVector(d, len * u).add(V(0, -(o.drop ?? 0) * u * u, 0))); }
      ak.chain(name, parent, pts, { stiff: o.stiff ?? 0.06, damp: 0.93, gravity: o.g ?? 1.5, sway: o.sway ?? 0.9 });
      for (let i = 0; i < n; i++) { // cinta: trapecio entre dos puntos de la cadena, más angosto y más tenue hacia la punta
        const a = pts[i], b = pts[i + 1], dd = b.clone().sub(a), nn = V().crossVectors(dd, o.toward ?? V(1, 0, 0)).cross(dd).normalize(), nz = V().crossVectors(dd, nn).normalize(), w0 = w * (1 - i / n * 0.75) * (i ? 1 : 0.5), w1 = w * (1 - (i + 1) / n * 0.75);
        const q = [a.clone().addScaledVector(nn, -w0), a.clone().addScaledVector(nn, w0), b.clone().addScaledVector(nn, -w1), b.clone().addScaledVector(nn, w1)], g = new T.BufferGeometry(); void nz;
        g.setAttribute('position', new T.Float32BufferAttribute(q.flatMap((v) => [v.x, v.y, v.z]), 3)); g.setIndex([0, 1, 2, 2, 1, 3, 2, 1, 0, 3, 1, 2]); g.computeVertexNormals();
        const c0 = cnew(o.col ?? VIO).multiplyScalar(0.06 + 0.5 * Math.pow(1 - i / n, 1.3)), c1 = cnew(o.col ?? VIO).multiplyScalar(0.06 + 0.5 * Math.pow(1 - (i + 1) / n, 1.3));
        add('spirit', g, `${name}${i}`, { color: (x, y, z) => (V(x, y, z).sub(a).dot(dd) / dd.lengthSq() > 0.5 ? c1 : c0) }); }
    };
    const nw = low ? 6 : 10;
    for (let i = 0; i < nw; i++) { const a = (i / nw) * TAU + 0.3; wisp(`jir${i}`, 'spine05', V(Math.sin(a) * 0.3, 0.3, 0.02 + Math.cos(a) * 0.26), V(Math.sin(a) * 0.25, -1, Math.cos(a) * 0.25), 0.7 + (i % 3) * 0.14, 7, 0.06, { toward: V(Math.cos(a), 0, -Math.sin(a)), g: 1.2, sway: 1.0, drop: 0.1 }); }
    for (const [sx, nm] of [[1, 'mL'], [-1, 'mR']]) { // humo de las mangas y de los hombros
      const w0 = P('wrist_L_h'); wisp(`${nm}0`, 'wrist_' + (sx > 0 ? 'L' : 'R'), V(sx * w0.x, w0.y - 0.04, w0.z), V(sx * 0.2, -0.4, -1), 0.55, 6, 0.05, { toward: V(0, 1, 0), g: 1.0, sway: 1.2, stiff: 0.08 });
      wisp(`${nm}1`, 'spine01', V(sx * 0.2, 1.42, -0.06), V(sx * 0.3, 0.1, -1), 0.6, 6, 0.05, { toward: V(0, 1, 0), g: 0.2, sway: 1.4, stiff: 0.04 });
    }
    ak.embers(VIO, low ? 18 : 34, { radius: 0.5, height: 2.1, size: 5 });
    if (!low) ak.embers(VIO_D, 14, { radius: 0.35, height: 1.5, size: 16 }); // humo de luz (partículas grandes y tenues)
  }

  // ═══════════════════════════ FRAGMENTOS DE ESPEJO en órbita (cada uno gira sobre sí) + ANILLOS DE RUNAS
  {
    const hub = V(0, 1.15, 0.04), orbs = [ak.bone('orb1', 'spine02', hub), ak.bone('orb2', 'spine02', hub), ak.bone('orb3', 'spine02', hub)], fr = [];
    const nf = low ? 9 : 13;
    for (let i = 0; i < nf; i++) {
      const o = i % 3, a = (i / nf) * TAU * 1.7, Rr = 0.6 + o * 0.13 + (R() - 0.5) * 0.08, y = (R() - 0.5) * 0.9 + (o - 1) * 0.12, sz = 0.05 + R() * 0.07, p = V(hub.x + Math.cos(a) * Rr, hub.y + y, hub.z + Math.sin(a) * Rr), nm = `frag${i}`;
      const b = ak.bone(nm, `orb${o + 1}`, p); fr.push({ b, ph: R() * 10, ax: V(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), sp: 0.6 + R() * 1.2, y0: b.position.y, o });
      const kind = i % 4; let g;
      if (kind === 0) g = G.shard(sz * 2.4, sz * 0.55, 4);
      else { const pts = kind === 1 ? [[0, sz], [sz * 0.62, 0], [0, -sz * 1.1], [-sz * 0.5, -sz * 0.2]] : kind === 2 ? [[-sz * 0.6, sz * 0.5], [sz * 0.2, sz], [sz * 0.7, -sz * 0.3], [-sz * 0.2, -sz * 0.9]] : [[0, sz * 1.2], [sz * 0.5, sz * 0.1], [sz * 0.25, -sz], [-sz * 0.35, -sz * 0.7], [-sz * 0.55, sz * 0.1]]; g = G.plate(pts, 0.012, 0.0035, { crease: 40 }); }
      add('mirror', X(g, { p: [p.x, p.y, p.z], r: [R() * 3, R() * 3, R() * 3] }), nm, { color: i % 3 === 0 ? MIRV : i % 3 === 1 ? MIR : 0xffffff });
      if (kind === 1 || kind === 3) add('light', X(t.outline([[0, sz], [sz * 0.62, 0], [0, -sz * 1.1], [-sz * 0.5, -sz * 0.2]], { inset: 0.02, r: 0.0022 }), { p: [p.x, p.y, p.z], r: [0, 0, 0] }), nm, { color: VIO });
    }
    upd.push((dt, tt) => {
      orbs[0].rotation.y = tt * 0.42; orbs[1].rotation.y = -tt * 0.3 + 1; orbs[2].rotation.y = tt * 0.22 + 2; orbs[1].rotation.z = 0.25 * Math.sin(tt * 0.3); orbs[2].rotation.x = 0.22 * Math.cos(tt * 0.27);
      for (const f of fr) { f.b.rotation.set(f.ax.x * tt * f.sp, f.ax.y * tt * f.sp, f.ax.z * tt * f.sp); f.b.position.y = f.y0 + 0.05 * Math.sin(tt * 0.9 + f.ph); }
    });

    // anillo de runas: banda de obsidiana con glifos de luz grabados (eje Y en la geometría; los huesos lo orientan y lo hacen girar)
    const ring = (name, parent, c, R0, h, nG, seed, tilt = null) => {
      const rr = t.rng(seed), pb = tilt ? ak.bone(name + 'T', parent, c) : null, sb = ak.bone(name, tilt ? name + 'T' : parent, c);
      add('mirror', X(G.band(R0, h, 0.016, { seg: S(36, 18), simple: low }), { p: [c.x, c.y, c.z] }), name, { color: OBS });
      add('ember', X(G.torus(R0 + 0.001, 0.0032, 3, S(36, 18)), { p: [c.x, c.y + h * 0.5, c.z] }), name, { color: VIO }); add('ember', X(G.torus(R0 + 0.001, 0.0032, 3, S(36, 18)), { p: [c.x, c.y - h * 0.5, c.z] }), name, { color: VIO });
      for (let i = 0; i < nG; i++) {
        const a = (i / nG) * TAU, gs = [], nb = 2 + ((rr() * 2) | 0), gw = (R0 * TAU / nG) * 0.55;
        for (let k = 0; k < nb; k++) { const horiz = rr() > 0.5, w = horiz ? gw * (0.4 + rr() * 0.6) : 0.008, hh = horiz ? 0.008 : h * (0.35 + rr() * 0.5); gs.push(new T.PlaneGeometry(w, hh).translate((rr() - 0.5) * gw * 0.7, (rr() - 0.5) * h * 0.4, 0.003)); }
        const g = G.merge(gs); X(g, { p: [Math.sin(a) * (R0 + 0.006), 0, Math.cos(a) * (R0 + 0.006)], r: [0, a, 0] }); X(g, { p: [c.x, c.y, c.z] });
        add('light', g, name, { color: i % 4 === 0 ? 0xffffff : LILA });
      }
      return { pb, sb };
    };
    const r1 = ring('rn1', 'spine03', V(0, 1.02, 0.03), 0.44, 0.07, low ? 14 : 20, 3, true), r2 = ring('rn2', 'spine02', V(0, 1.32, -0.34), 0.66, 0.06, low ? 18 : 26, 9), r3 = ring('rn3', 'spine01', V(0, 1.3, 0.03), 0.32, 0.05, low ? 12 : 16, 5, true);
    r1.pb.rotation.x = 0.28; r3.pb.rotation.z = -0.4; r3.pb.rotation.x = -0.25;
    // el anillo grande de la espalda mira hacia atrás: se gira el hueso para que su eje Y quede a lo largo de Z (el pivote en su centro)
    upd.push((dt, tt) => { r1.sb.rotation.y = tt * 0.6; r3.sb.rotation.y = -tt * 0.9; r1.pb.rotation.z = 0.12 * Math.sin(tt * 0.5); });
    // el anillo trasero se modela con su eje Y; para que quede vertical lo rotamos en el marco de la espalda (hueso con rotación fija + giro propio)
    upd.push((dt, tt) => { r2.sb.rotation.set(Math.PI / 2, tt * 0.25, 0, 'XYZ'); });
  }

  // ═══════════════════════════ FLOTAR (animación propia sobre el esqueleto, sin pisar los clips)
  const fst = new Map(), dq = new T.Quaternion(), eu = new T.Euler(), bn = (n) => ak.bones[n] || ak.bones[n + '_h'];
  const addRot = (n, x, y, z) => { const b = bn(n); if (!b) return; let st = fst.get(n); if (!st) { st = { last: null, d: new T.Quaternion() }; fst.set(n, st); }
    if (st.last && b.quaternion.equals(st.last)) b.quaternion.multiply(dq.copy(st.d).invert()); st.d.setFromEuler(eu.set(x, y, z)); b.quaternion.multiply(st.d); st.last = b.quaternion.clone(); };
  let spd = 0;
  upd.push((dt, tt, c) => {
    spd += ((c && c.speed || 0) - spd) * Math.min(1, dt * 4);
    const lean = Math.min(0.2, spd * 0.03);
    addRot('spine05', 0.045 * Math.sin(tt * 0.9) + lean, 0.07 * Math.sin(tt * 0.45), 0.055 * Math.sin(tt * 0.7 + 1));
    addRot('spine02', 0.02 * Math.sin(tt * 1.3 + 0.5), 0, 0.03 * Math.sin(tt * 0.7 + 2.4));
    addRot('head', -0.03 * Math.sin(tt * 0.9) - lean * 0.5, 0.08 * Math.sin(tt * 0.37 + 1), 0.04 * Math.sin(tt * 0.55));
  });
  const evo = addEvolution(ak, ctx, { t, pal: { bone: 0x6a5a86, boneL: 0x9a8ac0, steel: 0x3a2e58, steelD: 0x1c1230 } });
  return { update: (dt, tt, c) => { upd.forEach((f) => f(dt, tt, c)); evo.update(dt, tt, c); } };
}
