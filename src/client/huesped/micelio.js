// MICELIO — COLOSO RAÍZ (Huésped de arte, docs/HUESPEDES_ARTE.md). El más grande (escala ×1,25 en huesped-cuerpo.js): armadura de placas de corteza con filetes de musgo luminoso,
// roca agrietada en los puños, hombros descomunales de hongos-estantería escalonados (anillos de crecimiento, vientre que brilla), brazos enormes con raíces enroscadas y puños de raíz,
// torso con un hueco-corazón de musgo que late (uBeat), costillar de raíces sobre el vientre verde, cornamenta de ciervo con hongos de cristal en las puntas, máscara de corteza con ojos de luz,
// capa de musgo y raíces que arrastra con física de muelles, esporas que flotan. Se escribe en el marco del modelo (pose de enlace); el lado izquierdo (+x) va dentro de ak.both().
import * as T from 'three';
import { tools, V, basisQ } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';

export const BELLY = 1; // vientre verde que late entre las raíces del costillar
const MOSS = 0x7be03a, MOSS2 = 0xc8ff4a, MOSS_D = 0x2c7a18, VIOLET = 0xb04bff, MAG = 0xff4ad8, CYAN = 0x4af0e0, ORANGE = 0xff9a3a;
const TAU = Math.PI * 2, clamp01 = (x) => Math.max(0, Math.min(1, x));

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, ringAt, dome, cuff, bonelump, S, low, fbm } = t, P = (n) => ak.P(n), add = ak.add;
  const HC = V(0, 1.6, 0.06), Y = V(0, 1, 0), Zv = V(0, 0, 1), zc = 0.045, upd = [], R = t.rng(41);
  const C = (h) => new T.Color(h);
  // colores por vértice: corteza veteada (mezcla de dos tonos con ruido) y musgo (verde oscuro → lima)
  const barkC = (a, b, k = 12, sd = 0) => { const ca = C(a), cb = C(b); return (x, y, z) => ca.clone().lerp(cb, clamp01(fbm(Math.abs(x) * k + sd, y * k, z * k, 3) * 1.7 - 0.2)); };
  const mossC = (k = 16, sd = 0) => { const a = C(MOSS_D), b = C(MOSS); return (x, y, z) => a.clone().lerp(b, clamp01(fbm(Math.abs(x) * k + sd, y * k, z * k, 2) * 1.8 - 0.15)); };
  const BD = barkC(0x3c2e24, 0x7a6048, 10, 1), BM = barkC(0x64503c, 0xa88c68, 12, 2), BL = barkC(0x9a8260, 0xd6c096, 14, 3), BRK = 0x7a634c;
  const bud = (r) => (low ? new T.OctahedronGeometry(r, 0) : G.sphere(r, 5, 4));
  const lump = (r, sd = 0) => (low ? new T.OctahedronGeometry(r, 0).scale(1, 0.7, 1) : G.rock(r, { detail: 1, amp: 0.3, freq: 2.6, s: [1, 0.75, 1], seed: sd }));
  /** Penacho de musgo luminoso: n bultos verdes alrededor de c (esparcidos en `sp`, mirando hacia `n`). */
  const tuft = (bone, c, n, r0, r1, sp, nv = Y, sd = 1) => { const rr = t.rng(sd), mc = mossC(14, sd); for (let i = 0; i < n; i++) { const a = rr() * TAU, d = Math.sqrt(rr()) * sp, u = V(1, 0, 0).cross(nv).normalize(), w = nv.clone().cross(u); add('light', lump(r0 + rr() * (r1 - r0), i + sd).translate(c.x + u.x * Math.cos(a) * d + w.x * Math.sin(a) * d + nv.x * 0.01, c.y + u.y * Math.cos(a) * d + w.y * Math.sin(a) * d + nv.y * 0.01, c.z + u.z * Math.cos(a) * d + w.z * Math.sin(a) * d + nv.z * 0.01), bone, { color: mc }); } };
  /** Hongo-estantería: disco con anillos de crecimiento (rojo-naranja-crema, borde magenta), vientre de luz verde→violeta y filo luminoso. rot = Euler, c = centro (en el lado izquierdo). */
  const shelf = (bone, c, Rr, rot, o = {}) => {
    const th = o.th ?? Rr * 0.12, zs = o.zs ?? 1, xs = o.xs ?? 1, seg = low ? 8 : S(o.seg ?? 16, 8);
    const prof = low ? [[0, -th * 0.4], [Rr * 0.94, -th * 0.5], [Rr, 0], [Rr * 0.64, th * 0.5], [Rr * 0.3, th * 0.8], [0, th * 1.1]] : [[0, -th * 0.35], [Rr * 0.2, -th * 0.35], [Rr * 0.94, -th * 0.5], [Rr, 0], [Rr * 0.95, th * 0.4], [Rr * 0.64, th * 0.45], [Rr * 0.62, th * 0.85], [Rr * 0.3, th * 0.78], [Rr * 0.28, th * 1.1], [0, th * 1.1]];
    const arc = o.half ? Math.PI : TAU, place = (g) => X(X(g, { s: [xs, 1, zs] }), { p: [c.x, c.y, c.z], r: rot });
    const cap = place(G.lathe(prof, seg, 0, arc, 0)), ca = o.ca || [0x7a3018, 0xc8782c, 0xcfb47c, 0xa84a86];
    add('bone', cap, bone, { color: (x, y, z) => { const d = Math.hypot((Math.abs(x) - c.x) / xs, (z - c.z) / zs) / Rr; return C(d < 0.3 ? ca[0] : d < 0.64 ? ca[1] : d < 0.93 ? ca[2] : ca[3]).multiplyScalar(0.62 + 0.22 * fbm(x * 30, y * 30, z * 30, 2)); } });
    if (o.half && o.wall) add('bark', place(new T.BoxGeometry(0.014, th * 1.5, 2 * Rr * 0.985)).translate(0, th * 0.3, 0), bone, { color: 0x4a3a2c }); // cierra el borde plano contra el cuerpo
    const und = place(G.lathe([[0, -th * 0.5], [Rr * 0.93, -th * 0.56]], seg, 0, arc, 0));
    add('light', und, bone, { color: (x, y, z) => { const d = Math.hypot((Math.abs(x) - c.x) / xs, (z - c.z) / zs) / Rr; return C(MOSS).lerp(C(o.glow ?? VIOLET), clamp01(d * 1.15 - 0.2)).multiplyScalar(0.7); } });
    if (!low) add('light', place(o.half ? new T.TorusGeometry(Rr * 0.97, Math.max(0.004, th * 0.12), 3, seg, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI / 2) : G.torus(Rr * 0.97, Math.max(0.004, th * 0.12), 3, seg)).translate(0, -th * 0.02, 0), bone, { color: C(o.glow ?? MOSS).multiplyScalar(0.8) });
  };
  /** Hongo de cristal luminoso (tallo de corteza + sombrero translúcido). */
  const shroom = (bone, base, dir, h, Rr, cols, o = {}) => {
    const d = dir.clone().normalize(), tip = base.clone().addScaledVector(d, h);
    add('bone', G.tube([base, base.clone().addScaledVector(d, h * 0.5).add(V(0.004, 0, 0.003)), tip], Rr * 0.18, Rr * 0.12, { radial: S(5, 4), tubular: 4 }), bone, { color: 0xe8d8b4 });
    const cp = dome(Rr, Rr * 0.7, { lip: 0.5, seg: S(10, 6), flat: 0.2 }); X(cp, { q: basisQ(d, V(0, 0, 1)), p: [tip.x - d.x * Rr * 0.05, tip.y - d.y * Rr * 0.05, tip.z - d.z * Rr * 0.05] });
    add('crystal', cp, bone, { color: (x, y, z) => C(cols[0]).lerp(C(cols[1]), clamp01(((x - tip.x) * d.x + (y - tip.y) * d.y + (z - tip.z) * d.z) / (Rr * 0.8) + 0.4)).multiplyScalar(0.36) });
  };
  /** Cuerno de ciervo: viga principal curva + puntas (tines) que salen de ella, con brote luminoso en cada punta. */
  const antler = (bone, o0, sc = 1) => {
    const beam = [V(0.05, 0.05, 0), V(0.12, 0.12, -0.03), V(0.22, 0.24, -0.08), V(0.27, 0.42, -0.16), V(0.2, 0.62, -0.24), V(0.1, 0.78, -0.3)].map((p) => p.multiplyScalar(sc).add(o0));
    add('bone', G.tube(beam, 0.03 * sc, 0.007 * sc, { radial: S(6, 5), tubular: S(18, 10), ridges: 5, ridgeAmp: 0.22, twist: 1.5, ease: 0.9 }), bone, { color: BL });
    const pick = (u) => { const f = u * (beam.length - 1), i = Math.min(beam.length - 2, Math.floor(f)); return beam[i].clone().lerp(beam[i + 1], f - i); };
    const tines = [[0.26, V(0.55, 0.9, 0.7), 0.3], [0.42, V(0.9, 0.7, 0.3), 0.34], [0.6, V(0.8, 1, -0.2), 0.3], [0.78, V(0.4, 1, -0.5), 0.25], [0.15, V(0.3, 0.3, 1), 0.22]]; void 0;
    for (const [u, dir, len] of (low ? tines.slice(0, 3) : tines)) {
      const b = pick(u), d = dir.clone().normalize(), l = len * sc, pts = [b, b.clone().addScaledVector(d, l * 0.45).add(V(0, 0.02 * sc, 0.02 * sc)), b.clone().addScaledVector(d, l)];
      add('bone', G.tube(pts, 0.017 * sc, 0.004 * sc, { radial: S(5, 4), tubular: S(8, 5), ridges: 3, ridgeAmp: 0.2 }), bone, { color: BL });
      add('light', bud(0.012 * sc).translate(pts[2].x, pts[2].y, pts[2].z), bone, { color: u > 0.5 ? 0x5ab02a : 0x2a9a90 });
    }
    add('light', bud(0.016 * sc).translate(beam[5].x, beam[5].y, beam[5].z), bone, { color: MOSS2 });
    return { pick, beam };
  };

  // ═══════════════════════════ CABEZA: máscara de corteza, ojos de luz, cornamenta de ciervo con hongos de cristal
  {
    const shell = G.lathe([[0.098, -0.085], [0.114, -0.04], [0.12, 0.015], [0.11, 0.075], [0.088, 0.12], [0.05, 0.145], [0.0, 0.152]], S(14, 8), 0, TAU, 34); X(shell, { p: [HC.x, HC.y, HC.z], s: [1.08, 1.04, 1.2] });
    add('bark', shell, 'head', { color: BD });
    const face = G.wrapE(G.plate(t.platePts([[0.0, 0.07], [0.045, 0.062], [0.088, 0.03], [0.098, -0.03], [0.07, -0.095], [0.035, -0.13], [0.0, -0.14]]), 0.022, 0.007), 0.122, 0.15);
    X(face, { p: [HC.x, HC.y - 0.005, HC.z] }); add('bark', face, 'head', { color: BL });
    const brow = G.wrapE(G.plate([[0, 0.012], [0.05, 0.028], [0.112, 0.056], [0.13, 0.03], [0.07, -0.01], [0, -0.022], [-0.07, -0.01], [-0.13, 0.03], [-0.112, 0.056], [-0.05, 0.028]], 0.03, 0.009), 0.124, 0.152);
    X(brow, { p: [HC.x, HC.y + 0.038, HC.z] }); add('bark', brow, 'head', { color: BM });
    add('dark', X(G.wrapE(G.plate(t.platePts([[0.0, 0.0], [0.07, 0.012], [0.1, 0.0], [0.07, -0.026], [0, -0.03]]), 0.012, 0.003), 0.116, 0.144), { p: [HC.x, HC.y - 0.002, HC.z] }), 'head', { color: 0x040802 }); // cuenca
    ak.both(() => {
      add('light', G.wrapE(G.plate([[0.014, 0.0], [0.05, 0.016], [0.094, 0.011], [0.074, -0.008], [0.022, -0.013]], 0.013, 0.003), 0.118, 0.148).translate(HC.x, HC.y + 0.004, HC.z + 0.002), 'head', { color: MOSS }); // ojo de luz rasgado
      add('bark', X(G.wrapE(G.plate([[0.004, 0.03], [0.05, 0.02], [0.095, -0.03], [0.078, -0.09], [0.032, -0.1], [0.004, -0.06]], 0.016, 0.005), 0.114, 0.142), { p: [HC.x, HC.y - 0.015, HC.z], r: [0, 0.4, 0] }), 'head', { color: BM }); // mejilla
      add('light', seam([V(0.04, HC.y - 0.1, HC.z + 0.1), V(0.07, HC.y - 0.06, HC.z + 0.095), V(0.088, HC.y - 0.02, HC.z + 0.075)], 0.0026), 'head', { color: MOSS });
      add('bone', t.box(0.05, 0.05, 0.02, 0.006, 1).translate(0.125, HC.y - 0.005, HC.z - 0.01), 'head', { color: BL }); // oreja de corteza
      if (!low) shelf('head', V(0.135, HC.y + 0.005, HC.z - 0.01), 0.1, [0, 0, -Math.PI / 2 + 0.25], { th: 0.016, seg: 10, rim: true, xs: 1, zs: 1.1 }); // hongo-oreja
      shroom('head', V(0.07, HC.y + 0.1, HC.z + 0.1), V(0.2, 1, 0.3), 0.05, 0.03, [MAG, 0xffd0f0]);
    });
    for (let i = -2; i <= 2; i++) { const dx = i * 0.0165; add('bone', spikeAt(V(HC.x + dx, HC.y - 0.118, HC.z + 0.137 - Math.abs(i) * 0.008), V(dx * 2, -1, 0.35), 0.05 + (i === 0 ? 0.015 : 0) - Math.abs(i) * 0.006, 0.0075, 0.006, Zv, { radial: 4, tubular: 3 }), 'head', { color: 0xe6d6b0 }); } // colmillos-raíz
    add('dark', t.box(0.09, 0.03, 0.016, 0.004, 1).translate(HC.x, HC.y - 0.112, HC.z + 0.13), 'head', { color: 0x030602 });
    tuft('head', V(0, HC.y + 0.125, HC.z + 0.0), low ? 5 : 10, 0.02, 0.034, 0.07, Y, 3); // musgo sobre el cráneo
    ak.both(() => { // cornamenta: dos astas enormes con puntas, hongos de cristal y un estante de hongo en la viga
      const A = antler('head', V(HC.x + 0.04, HC.y + 0.1, HC.z - 0.01), 1.12);
      const q = A.pick(0.55); if (!low) shelf('head', V(q.x + 0.045, q.y + 0.035, q.z), 0.085, [0, 0, -0.3], { th: 0.014, seg: 10, rim: true, ca: [0x6a2a6a, 0xb04bff, 0xffa0e8, 0xffffff], glow: CYAN });
      const q2 = A.pick(0.92); shroom('head', q2, V(0.2, 1, 0.2), 0.07, 0.04, [CYAN, 0xd8fff8]);
      shroom('head', A.pick(0.3).add(V(0.02, 0.02, 0.03)), V(0.5, 1, 0.8), 0.06, 0.034, [VIOLET, 0xffc8ff]);
    });
    // barba de raíces bajo la máscara y collar de corteza
    for (let i = 0; i < (low ? 2 : 3); i++) add('bark', G.band(0.082 - i * 0.002, 0.03, 0.012, { seg: S(14, 8) }).translate(0, 1.446 + i * 0.024, 0.03), 'neck01', { color: i === 1 ? BM : BD });
    for (let k = 0; k < (low ? 3 : 5); k++) { const x = (k - (low ? 1 : 2)) * 0.028; add('bark', G.tube([V(x, HC.y - 0.12, HC.z + 0.1), V(x * 1.4, HC.y - 0.19, HC.z + 0.12), V(x * 1.8, HC.y - 0.27 - (k % 2) * 0.04, HC.z + 0.1)], 0.011, 0.003, { radial: 4, tubular: 5 }), 'head', { color: BM }); }
  }

  // ═══════════════════════════ TORSO: barril de corteza, pectorales con filete de musgo, hueco-corazón que late, costillar de raíces
  {
    const chest = G.lathe([[0.21, 1.2], [0.24, 1.26], [0.252, 1.32], [0.235, 1.385], [0.16, 1.43], [0.1, 1.45]], S(14, 9), 0, TAU, 30); X(chest, { p: [0, 0, zc - 0.005], s: [1, 1, 0.78] });
    add('bark', chest, 'spine01', { color: BD });
    ak.both(() => {
      t.armorPlate('spine01', [[0.02, 0.13], [0.09, 0.15], [0.17, 0.11], [0.2, 0.02], [0.17, -0.07], [0.1, -0.115], [0.02, -0.08]], { mat: 'bark', depth: 0.05, bevel: 0.016, wrap: { rx: 0.205, rz: 0.152 }, color: BM, trim: 'ember', trimColor: MOSS, trimInset: 0.14, trimR: 0.0034, place: (g) => X(g, { p: [0, 1.31, zc], r: [0.08, 0, 0] }) });
      t.armorPlate('spine01', [[0.0, 0.05], [0.08, 0.06], [0.14, 0.02], [0.12, -0.03], [0.0, -0.04]], { mat: 'bark', depth: 0.036, bevel: 0.012, wrap: { rx: 0.215, rz: 0.16 }, color: BL, trim: 'ember', trimColor: MOSS2, trimInset: 0.2, place: (g) => X(g, { p: [0, 1.405, zc - 0.01], r: [0.3, 0, 0] }) }); // clavícula
      add('light', seam([V(0.035, 1.24, 0.2), V(0.09, 1.25, 0.19), V(0.15, 1.28, 0.165), V(0.19, 1.34, 0.12)], 0.003), 'spine01', { color: MOSS });
      tuft('spine01', V(0.12, 1.43, 0.12), low ? 4 : 8, 0.014, 0.026, 0.06, V(0.3, 1, 0.3), 11);
    });
    // hueco-corazón: cavidad oscura, núcleo de musgo que late, cristal y jaula de raíces
    add('dark', G.sphere(0.075, 10, 8).scale(1, 1.25, 0.55).translate(0, 1.29, 0.185), 'spine01', { color: 0x030602 });
    add('light', G.sphere(0.034, S(10, 7), S(8, 6)).translate(0, 1.29, 0.2), 'spine01', { color: MOSS2 });
    add('crystal', X(new T.OctahedronGeometry(0.044, 0), { p: [0, 1.29, 0.204], s: [0.8, 1.2, 0.8] }), 'spine01', { color: 0x86ff3a });
    for (let i = 0; i < 3; i++) add('bark', G.torus(0.062 + i * 0.006, 0.0075, 4, S(14, 8)).rotateX(Math.PI / 2 + (i - 1) * 0.55).scale(1, 1.25, 1).translate(0, 1.29, 0.206), 'spine01', { color: BM });
    ak.halo('spine01', V(0, 1.29, 0.25), MOSS, 0.55, 0.55);
    // vientre: costillar de 5 raíces gruesas sobre el vientre verde + espina de raíz
    for (let i = 0; i < 5; i += (low ? 1 : 1)) {
      if (low && i === 4) continue;
      const y = 1.05 + i * 0.036, k = 1 + 0.04 * Math.sin(i * 1.3), cz = 0.055 - i * 0.002;
      add('bark', G.torus(0.14 * k, 0.014 - i * 0.0006, low ? 3 : 5, low ? 12 : 26).scale(1, 1, 0.84).translate(0, y, cz), i < 2 ? 'spine03' : 'spine02', { color: i % 2 ? BM : BD });
      add('bark', G.sphere(0.017, 5, 4).translate(0, y, cz + 0.14 * 0.84 * k), i < 2 ? 'spine03' : 'spine02', { color: BL });
    }
    add('bark', G.tube([V(0, 1.2, -0.07), V(0, 1.12, -0.085), V(0, 1.04, -0.07)], 0.02, 0.014, { radial: 5, tubular: 8, ridges: 4, ridgeAmp: 0.4 }), 'spine02', { color: BM });
    // cinturón de corteza con hebilla de hongo
    add('bark', G.band(0.19, 0.07, 0.024, { seg: S(20, 10), sz: 0.8 }).translate(0, 0.945, zc + 0.01), 'spine05', { color: BD });
    for (const y of [0.982, 0.908]) add('light', G.torus(0.192, 0.0035, 3, S(20, 10)).scale(1, 1, 0.8).translate(0, y, zc + 0.01), 'spine05', { color: MOSS });
    add('bark', bonelump(0.05, [1.3, 1, 0.8], 7, 0.25).translate(0, 0.945, 0.192), 'spine05', { color: BL });
    shelf('spine05', V(0, 0.952, 0.215), 0.06, [Math.PI / 2 - 0.1, 0, 0], { th: 0.012, seg: 10, rim: true });
    // espalda: joroba de corteza, columna de hongos-estantería que sube por el espinazo y esporas de cristal
    add('bark', bonelump(0.2, [1.45, 0.95, 0.78], 3, 0.24).translate(0, 1.3, -0.1), 'spine01', { color: BD });
    add('bark', bonelump(0.15, [1.3, 0.9, 0.8], 4, 0.26).translate(0, 1.13, -0.085), 'spine02', { color: BM });
    const sp = [[1.47, 0.14, 0.45], [1.37, 0.18, -0.5], [1.26, 0.15, 0.3], [1.16, 0.12, -0.3]];
    sp.forEach(([y, Rr, hd], i) => { if (low && i === 3) return; shelf(i < 2 ? 'spine01' : 'spine02', V(Math.sin(hd) * 0.07, y, -0.13), Rr, [0, Math.PI / 2 + hd, 0.75 - i * 0.07], { half: true, th: Rr * 0.14, seg: 14, rim: true, glow: i % 2 ? CYAN : VIOLET, zs: 1.1 }); });
    shroom('spine01', V(0, 1.42, -0.22), V(0, 1, -0.4), 0.1, 0.05, [MAG, 0xffd8f4]); shroom('spine01', V(0.1, 1.38, -0.2), V(0.5, 1, -0.5), 0.07, 0.035, [CYAN, 0xd8fff8]);
    tuft('spine01', V(0, 1.45, -0.13), low ? 6 : 12, 0.015, 0.03, 0.12, Y, 21);
  }

  // ═══════════════════════════ HOMBROS DESCOMUNALES, BRAZOS ENORMES, PUÑOS DE RAÍZ
  ak.both(() => {
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'), F3 = P('finger3-1');
    // hombrera: peñasco de corteza con 4 hongos-estantería escalonados (cada uno más bajo y más ancho hacia afuera) y musgo luminoso encima
    add('bark', bonelump(0.19, [1.35, 0.95, 1.2], 12, 0.26).translate(S0.x + 0.08, S0.y + 0.04, S0.z), 'upperarm01', { color: BD });
    for (let i = 0; i < 4; i++) { if (low && i === 3) continue; shelf('upperarm01', V(0.14 + i * 0.06, 1.53 - i * 0.1, S0.z + [0.0, -0.03, 0.03, 0.0][i]), 0.4 - i * 0.05, [0, [0.15, -0.25, 0.3, -0.1][i], -0.1 - i * 0.04], { half: true, wall: true, th: 0.05 - i * 0.005, seg: 20, rim: true, zs: 1.15, glow: [VIOLET, CYAN, MOSS, MAG][i], ca: i % 2 ? [0x4a2a1c, 0xa8622a, 0xb8a06c, 0x6aa840] : [0x6a2814, 0xb8682a, 0xc4aa72, 0xa84a86] }); }
    tuft('upperarm01', V(S0.x + 0.1, S0.y + 0.2, S0.z), low ? 5 : 11, 0.016, 0.03, 0.1, Y, 31);
    shroom('upperarm01', V(S0.x + 0.12, S0.y + 0.2, S0.z - 0.05), V(0.2, 1, -0.3), 0.09, 0.045, [VIOLET, 0xffc8ff]);
    if (!low) shroom('upperarm01', V(S0.x + 0.02, S0.y + 0.2, S0.z + 0.06), V(-0.1, 1, 0.4), 0.06, 0.03, [CYAN, 0xd8fff8]);
    // brazo enorme: tronco de corteza (bíceps) + brazal de placas + raíces enroscadas en espiral + codo con púa
    add('bark', limb(bonelump(0.15, [1.05, 1.9, 1.05], 5, 0.24), S0, E0, 0.5), 'upperarm01', { color: BM });
    for (let i = 0; i < (low ? 2 : 3); i++) add('bark', limb(cuff(0.12 - i * 0.008, 0.108 - i * 0.008, 0.045, 0.014, S(10, 7), 30), S0, E0, 0.3 + i * 0.2), 'upperarm01', { color: i === 1 ? BL : BD });
    add('light', ringAt(S0, E0, 0.42, 0.118, 0.01, 0.005), 'upperarm01', { color: MOSS });
    if (!low) add('bark', limb(bonelump(0.13, [1.1, 1.0, 1.0], 6, 0.26), S0, E0, 1.0), 'upperarm01', { color: BD }); // codo
    add('bone', spikeAt(E0.clone().add(V(0.09, 0.0, -0.05)), V(1, 0.3, -0.6), 0.22, 0.034, 0.04, Y, { ridges: 4, ridgeAmp: 0.2 }), 'lowerarm01', { color: BL });
    const fl = W0.distanceTo(E0);
    add('bark', limb(bonelump(0.13, [1.0, 2.0, 1.0], 8, 0.22), E0, W0, 0.5), 'lowerarm01', { color: BD });
    const helix = (r0, turns, ph, rad) => { const pts = []; for (let k = 0; k <= 14; k++) { const u = k / 14, a = ph + u * turns * TAU, r = (r0 + 0.012 * Math.sin(u * 9 + ph)) * (1 - 0.15 * Math.abs(u - 0.5)); pts.push(V(Math.cos(a) * r, (u - 0.5) * fl * 1.0, Math.sin(a) * r)); } return G.tube(pts, rad, rad * 0.8, { radial: S(5, 4), tubular: S(30, 12), ridges: 3, ridgeAmp: 0.2 }); };
    for (let k = 0; k < (low ? 1 : 3); k++) add('bark', limb(helix(0.118, 1.2, k * 2.1, 0.026), E0, W0, 0.5), 'lowerarm01', { color: k % 2 ? BL : BM });
    t.armorPlate('lowerarm01', [[-0.05, 0.12], [0.05, 0.12], [0.04, -0.1], [0, -0.13], [-0.04, -0.1]], { mat: 'bark', depth: 0.03, bevel: 0.01, wrap: { rx: 0.125, rz: 0.13 }, color: BL, trim: 'ember', trimColor: MOSS, trimInset: 0.16, place: (g) => limb(g, E0, W0, 0.5, { r: [0, -0.6, 0] }) });
    tuft('lowerarm01', E0.clone().lerp(W0, 0.3).add(V(0.0, 0.1, -0.1)), low ? 3 : 7, 0.014, 0.026, 0.06, V(0, 0.6, -1), 41);
    // puño de raíz: núcleo de roca agrietada con grietas de musgo, nudillos de corteza, raíces que lo envuelven y zarpas
    const PF = W0.clone().lerp(F3, 0.7).add(V(0, -0.01, 0.01));
    add('stone', bonelump(0.15, [1.05, 1.0, 1.15], 14, 0.3).translate(PF.x, PF.y, PF.z), 'wrist', { color: barkC(0x6c6458, 0xa89a84, 10, 4) });
    for (let k = 0; k < (low ? 2 : 4); k++) { const a = -0.9 + k * 0.6; add('light', t.crackLine(PF.clone().add(V(0.0 + Math.sin(a) * 0.04, 0.15, 0.0 + Math.cos(a) * 0.1)), PF.clone().add(V(Math.sin(a) * 0.15, 0.0 - k * 0.01, Math.cos(a) * 0.14 + 0.02)), { n: 6, jag: 0.012, r: 0.0034, seed: 3 + k }), 'wrist', { color: MOSS }); }
    for (let k = 0; k < (low ? 3 : 5); k++) { const a = (k / 5) * Math.PI * 1.6 - 0.8; add('bark', G.tube([PF.clone().add(V(-0.1, 0.1, -0.06 + a * 0.05)), PF.clone().add(V(0.02 + a * 0.05, 0.16, 0.08)), PF.clone().add(V(0.14, 0.04, 0.12 + a * 0.03)), PF.clone().add(V(0.12, -0.12, 0.08 + a * 0.05))], 0.024, 0.014, { radial: S(5, 4), tubular: S(12, 7), ridges: 3, ridgeAmp: 0.2 }), 'wrist', { color: k % 2 ? BM : BD }); }
    for (let k = 0; k < 4; k++) add('bone', spikeAt(PF.clone().add(V(-0.05 + k * 0.045, -0.02, 0.15)), V(-0.1 + k * 0.1, -0.15, 1), 0.1, 0.022, 0.012, Y, { radial: S(5, 4), ridges: 3, ridgeAmp: 0.15 }), 'wrist', { color: BL }); // zarpas-raíz
    add('bark', bonelump(0.07, [1.0, 1.4, 1.0], 9, 0.3).translate(PF.x - 0.13, PF.y + 0.03, PF.z - 0.06), 'wrist', { color: BM }); // pulgar
    // raíces que cuelgan del antebrazo (física)
    const rc = [V(E0.x - 0.02, E0.y - 0.02, E0.z - 0.12), V(E0.x - 0.04, E0.y - 0.12, E0.z - 0.16), V(E0.x - 0.05, E0.y - 0.24, E0.z - 0.18), V(E0.x - 0.05, E0.y - 0.36, E0.z - 0.19), V(E0.x - 0.05, E0.y - 0.48, E0.z - 0.2)];
    const ch = ak.chain('raizb', 'lowerarm01', rc, { stiff: 0.05, damp: 0.92, gravity: 4, sway: 1.4 });
    for (let i = 0; i < 4; i++) add('bark', G.tube([rc[i], rc[i + 1]], 0.026 - i * 0.005, 0.021 - i * 0.005, { radial: S(5, 4), tubular: 3 }), ch.bones[i].name, { color: i % 2 ? BM : BD });
    add('light', bud(0.017).translate(rc[4].x, rc[4].y, rc[4].z), ch.bones[4].name, { color: MOSS2 });
  });

  // ═══════════════════════════ PIERNAS: troncos de corteza, rodillas con hongo, pies de raíz
  ak.both(() => {
    const H = P('upperleg01'), K = P('lowerleg01'), A = P('foot'), TO = P('toe3-1'), ul = H.distanceTo(K), ll = K.distanceTo(A);
    add('bark', limb(bonelump(0.165, [1.0, 2.2, 1.0], 15, 0.22), H, K, 0.45), 'upperleg01', { color: BM });
    t.armorPlate('upperleg01', [[-0.06, 0.15], [0.06, 0.15], [0.08, 0.0], [0.05, -0.15], [0, -0.18], [-0.05, -0.15], [-0.08, 0.0]], { mat: 'bark', depth: 0.036, bevel: 0.012, wrap: { rx: 0.14, rz: 0.13 }, color: BL, trim: 'ember', trimColor: MOSS, trimInset: 0.15, place: (g) => limb(g, H, K, 0.4, { r: [0, -Math.PI / 2 + 0.15, 0] }) });
    for (let i = 0; i < (low ? 2 : 3); i++) add('bark', limb(cuff(0.125 - i * 0.012, 0.115 - i * 0.012, 0.05, 0.014, S(10, 7), 30), H, K, 0.12 + i * 0.1), 'upperleg01', { color: i % 2 ? BM : BD });
    if (!low) add('bark', limb(bonelump(0.12, [1.1, 1.0, 1.1], 16, 0.26), H, K, 1.0), 'upperleg01', { color: BD });
    shelf('lowerleg01', V(K.x + 0.1, K.y + 0.04, K.z + 0.04), 0.14, [0.1, 0.4, -0.7], { th: 0.022, seg: 12, rim: true, glow: CYAN }); // hongo en la rodilla
    add('bark', limb(bonelump(0.13, [1.0, 2.1, 1.0], 17, 0.22), K, A, 0.5), 'lowerleg01', { color: BD });
    t.armorPlate('lowerleg01', [[0, 0.1], [0.06, 0.06], [0.07, -0.02], [0.03, -0.09], [-0.03, -0.09], [-0.07, -0.02], [-0.06, 0.06]], { mat: 'bark', depth: 0.04, bevel: 0.014, wrap: { rx: 0.115, rz: 0.12 }, color: BM, trim: 'ember', trimColor: MOSS, trimInset: 0.2, place: (g) => limb(g, K, A, 0.4) });
    add('bark', limb(cuff(0.105, 0.09, ll * 0.18, 0.016, S(10, 7), 30), K, A, 0.88), 'lowerleg01', { color: BL });
    add('light', ringAt(K, A, 0.74, 0.108, 0.012, 0.005), 'lowerleg01', { color: MOSS });
    tuft('lowerleg01', K.clone().lerp(A, 0.25).add(V(0.0, 0, 0.1)), low ? 3 : 6, 0.014, 0.024, 0.06, Zv, 51);
    // pie: masa de raíz con 4 dedos-raíz que se agarran al suelo
    add('bark', bonelump(0.095, [1.25, 0.75, 2.5], 18, 0.2).translate(A.x, 0.07, 0.07), 'foot', { color: BD });
    for (let k = -1; k <= 1; k++) add('bark', G.tube([V(TO.x + k * 0.03, 0.06, 0.15), V(TO.x + k * 0.075, 0.04, 0.26), V(TO.x + k * 0.12, 0.012, 0.35)], 0.036, 0.008, { radial: S(5, 4), tubular: S(7, 5), ridges: 3, ridgeAmp: 0.2 }), 'toe3-1', { color: k % 2 ? BM : BD });
    add('bone', spikeAt(V(A.x, 0.06, -0.08), V(0, 0.3, -1), 0.13, 0.03, 0.02, Y, { ridges: 3 }), 'foot', { color: BL });
    add('light', t.seam([V(A.x - 0.06, 0.15, 0.0), V(A.x, 0.16, 0.06), V(A.x + 0.06, 0.15, 0.0)], 0.003), 'foot', { color: MOSS });
  });

  // ═══════════════════════════ CAPA DE MUSGO, FALDÓN Y RAÍCES QUE ARRASTRA (física)
  {
    const cols = [], lens = [], R2 = t.rng(11);
    for (let j = 0; j < 8; j++) { const x = -0.2 + j * (0.4 / 7); cols.push({ bone: j === 0 ? 'clavicle_R' : j === 7 ? 'clavicle_L' : 'spine01', p: V(x, 1.43 - Math.abs(x) * 0.1, -0.24 - 0.05 * (1 - Math.abs(x) / 0.26)) }); lens.push(0.7 + 0.25 * Math.cos((j / 7 - 0.5) * 2.4) + (R2() - 0.5) * 0.3); }
    ak.cloth({ top: cols, dir: V(0, -1, -0.12), lens, rows: S(10, 6), color: 0xb0ff68, hem: 0x2a4a14, gravity: 7, stiff: 0.012, drag: 0.982, wave: 0.035, ember: 1 });
    const c2 = [], l2 = []; for (let j = 0; j < 5; j++) { c2.push({ bone: 'spine05', p: V(-0.1 + j * 0.05, 0.93, 0.2) }); l2.push(0.42 + (R2() - 0.5) * 0.2); }
    ak.cloth({ top: c2, dir: V(0, -1, 0.1), lens: l2, rows: S(6, 4), color: 0x90d850, hem: 0x2a4a14, gravity: 7, stiff: 0.03, drag: 0.98, ember: 0.7 });
    // raíces que arrastra por el suelo (5 cadenas con muelles: cuelgan de la cintura hacia atrás)
    for (let k = 0; k < (low ? 4 : 5); k++) {
      const x = (k - (low ? 1.5 : 2)) * 0.075, sgn = Math.sign(x) || 1, pts = [0, 1, 2, 3, 4, 5].map((i) => V(x * (1 + i * 0.35) + Math.sin(k * 2 + i) * 0.025, [0.95, 0.78, 0.55, 0.34, 0.17, 0.07][i], [-0.12, -0.19, -0.27, -0.38, -0.55, -0.78][i]));
      const ch = ak.chain('arrastre' + k, 'spine05', pts, { stiff: 0.07, damp: 0.93, gravity: 3.2, sway: 1.1 });
      for (let i = 0; i < 5; i++) add('bark', G.tube([pts[i], pts[i + 1]], 0.05 - i * 0.007, 0.043 - i * 0.007, { radial: S(6, 5), tubular: 3, ridges: 3, ridgeAmp: 0.2 }), ch.bones[i].name, { color: i % 2 ? BL : BM });
      add('light', bud(0.026).translate(pts[5].x, pts[5].y, pts[5].z), ch.bones[5].name, { color: k % 2 ? MOSS2 : CYAN });
      void sgn;
    }
    ak.collider('spine02', V(0, 1.0, 0.045), V(0, 1.36, 0.045), 0.2); ak.collider('spine05', V(0, 0.86, 0.045), V(0, 0.98, 0.045), 0.2);
    ak.both(() => ak.collider('upperleg01', P('upperleg01'), P('lowerleg01'), 0.14));
    ak.embers(MOSS2, low ? 16 : 36, { radius: 0.7, height: 2.4, size: 5 });
    ak.embers(MAG, low ? 8 : 18, { radius: 0.6, height: 2.2, size: 4 });
  }
  const evo = addEvolution(ak, ctx, { t, pal: { bone: 0xb09a80, boneL: 0xd6c096, steel: 0x8a7a62, steelD: 0x5a4a38 } });
  return { update: (dt, tt, c) => { upd.forEach((f) => f(dt, tt, c)); evo.update(dt, tt, c); } };
}
