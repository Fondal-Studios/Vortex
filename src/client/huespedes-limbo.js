// LOS CINCO HUÉSPEDES — almas y bestias en pena del limbo (docs/CONCEPTO_ARTE.md «REWORK DE LOS HUÉSPEDES»), guardianes entre los muertos y los vivos.
// Cada constructor recibe P (makeBuilder de huespedes-view.js) y c = { color, S, native } y devuelve:
//   { fx, poses, custom(k, t, J), anchors, pal, mat, particles }
//   · poses/custom: misma convención de articulaciones que antes (root, torso, head, armR/L, foreR/L; + cola, alas, velos, órbitas propias).
//   · anchors: dónde cuelgan las mutaciones por camino (huespedes-paths.js) y el aspecto regional (huespedes-region.js).
//   · pal: paleta del cuerpo para que cada mutación se vea «del mismo material» (hueso, corteza, sombra, oro…).
//   · mat: parámetros del shader del cuerpo (huesped-mat.js); particles: partículas propias.
// Axioma = Guerrero Caído (hueso y brasas) · Vesper = Bestia Cazadora (felina/lupina traslúcida) · Micelio = Coloso Raíz · Umbra = el Errante (sudario y espejos) · Seraf = Ángel Caído.
// Orientación: el frente mira a +Z, los pies en y = 0. Presupuesto Baja: ≤ 20 llamadas de dibujo en el cuerpo base (quedan ≥ 20 para caminos, regiones y órganos).

const TAU = Math.PI * 2;
/** Franja de tela que cuelga: `rows` filas desde (x0..x1, y0, z0) hasta la altura `len`, con vaivén `wav` y ensanche `flare`. */
function strip(x0, x1, y0, z0, len, rows, flare = 0, wav = 0, zf = 0) {
  const A = [], B = [];
  for (let r = 0; r < rows; r++) { const u = r / (rows - 1), y = y0 - u * len, f = 1 + flare * u * u, w = Math.sin(u * 3 + x0 * 7) * wav * u;
    A.push([x0 * f + w, y, z0 + u * zf]); B.push([x1 * f + w * 0.8, y - 0.04 * Math.sin(u * 5 + x1 * 9) * u, z0 + u * zf]); }
  return [A, B];
}

/** PLUMA: lámina en forma de hoja a lo largo de una curva base→mid→tip (en el plano XY), con ancho `wd`; luego un eje `shaft` (tubo) opcional. */
export function feather(P, j, kind, col, col2, base, mid, tip, wd, rows = 5, z = 0) {
  const A = [], B = [];
  for (let q = 0; q <= rows; q++) {
    const t = q / rows, u = 1 - t, x = u * u * base[0] + 2 * u * t * mid[0] + t * t * tip[0], y = u * u * base[1] + 2 * u * t * mid[1] + t * t * tip[1], zz = u * u * (base[2] || z) + 2 * u * t * (mid[2] || z) + t * t * (tip[2] || z);
    const tx = 2 * u * (mid[0] - base[0]) + 2 * t * (tip[0] - mid[0]), ty = 2 * u * (mid[1] - base[1]) + 2 * t * (tip[1] - mid[1]), l = Math.hypot(tx, ty) || 1, nx = -ty / l, ny = tx / l, w = wd * Math.pow(Math.sin(Math.min(1, t * 1.04) * Math.PI), 0.65) + 0.004;
    A.push([x - nx * w, y - ny * w, zz]); B.push([x + nx * w, y + ny * w, zz]);
  }
  P.sheet(j, kind, col, A, B, 1, col2);
}

/* ═════════════ AXIOMA — el Guerrero Caído ═════════════ */
function axioma(P, c) {
  const BONE = 0xd9d0b8, BONE2 = 0x9d917a, CHAR = 0x1f1a16, CHAR2 = 0x3a2e26, EMB = 0xff6a2a, EMB2 = 0xffb04a, SP = c.color, SP2 = 0xcfeaff;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 1.0, 0]), head = P.joint('head', torso, [0, 0.66, 0.05]);
  torso.rest = [0.1, 0, 0]; head.rest = [0.1, 0, 0];
  for (const s of [-1, 1]) { // piernas de armadura quemada con rodilleras de hueso, grietas de brasa y pies de espectro
    P.tube(root, 'body', CHAR2, [[0.15 * s, 1.03, 0], [0.19 * s, 0.8, 0.05], [0.2 * s, 0.58, 0.09]], 0.115, 0.08, 7, CHAR);
    P.lump(root, 'body', BONE, 0.1, [0.2 * s, 0.56, 0.13], [1, 1.1, 0.8], 7, 0.22, s + 3); P.cone(root, 'body', BONE, 0.032, 0.17, [0.2 * s, 0.58, 0.24], [1.25, 0, 0], 5);
    P.tube(root, 'body', CHAR, [[0.2 * s, 0.55, 0.08], [0.19 * s, 0.34, -0.02], [0.17 * s, 0.13, -0.06]], 0.075, 0.048, 7, BONE2);
    P.tube(root, 'body', CHAR2, [[0.17 * s, 0.1, -0.05], [0.17 * s, 0.05, 0.1], [0.17 * s, 0.03, 0.25]], 0.055, 0.032, 6);
    for (const dx of [-0.045, 0, 0.045]) P.cone(root, 'body', BONE, 0.013, 0.11, [0.17 * s + dx, 0.03, 0.31], [1.5, 0, 0], 4);
    P.tube(root, 'glow', EMB, [[0.215 * s, 0.97, 0.08], [0.24 * s, 0.77, 0.1], [0.225 * s, 0.6, 0.1]], 0.008, 0.005, 3, EMB2);
    P.tube(root, 'glow', EMB, [[0.185 * s, 0.5, 0.0], [0.19 * s, 0.33, -0.01], [0.17 * s, 0.16, -0.05]], 0.006, 0.004, 3);
  }
  P.lump(root, 'body', CHAR2, 0.22, [0, 1.02, 0], [1.25, 0.7, 0.9], 7, 0.1, 2); P.tube(root, 'glow', EMB, [[-0.25, 1.06, 0.1], [0, 1.1, 0.18], [0.25, 1.06, 0.1]], 0.009, 0.009, 3, EMB2);
  // tronco: caja torácica expuesta con peto partido y corazón de llama espiritual
  P.tube(torso, 'body', BONE2, [[0, -0.05, -0.08], [0, 0.3, -0.13], [0, 0.66, -0.06]], 0.036, 0.03, 6);
  for (let i = 0; i < 6; i++) P.tor(torso, 'body', i % 2 ? BONE2 : BONE, 0.175 - i * 0.007 + (i === 0 ? 0 : 0), 0.014, [0, 0.13 + i * 0.085, 0.0], [Math.PI / 2, 0, 0], 7, [1, 0.78, 1]);
  for (const s of [-1, 1]) { P.lump(torso, 'body', CHAR2, 0.2, [0.12 * s, 0.4, 0.13], [0.75, 1.2, 0.5], 7, 0.12, 5 + s); P.lump(torso, 'body', BONE2, 0.07, [0.2 * s, 0.6, 0.12], [1.2, 0.7, 0.8], 6, 0.2, 9); }
  P.tube(torso, 'glow', EMB, [[0, 0.62, 0.2], [0.02, 0.46, 0.22], [-0.015, 0.3, 0.2]], 0.01, 0.007, 4, EMB2);
  P.ico(torso, 'glow', SP2, 0.055, [0, 0.42, 0.05], [1, 1.35, 1], [0, 0, 0], 1); P.lump(torso, 'mem', SP, 0.13, [0, 0.42, 0.05], [1, 1.35, 1], 7, 0.1, 2);
  for (let i = 0; i < 5; i++) P.cone(torso, 'body', BONE, 0.035, 0.2 - i * 0.02, [0, 0.62 - i * 0.12, -0.17 - i * 0.012], [-1.15, 0, 0], 5);
  P.tube(torso, 'body', CHAR2, [[0, 0.58, 0], [0, 0.7, 0.02], [0, 0.78, 0.05]], 0.07, 0.055, 6);
  // cabeza: yelmo de hueso agrietado, visor hueco con ojos de llama azul y penacho de fuego espiritual
  P.lump(head, 'body', BONE, 0.155, [0, 0.14, 0.02], [0.88, 1.12, 1.05], 8, 0.07, 4); P.box(head, 'body', CHAR, [0.18, 0.075, 0.12], [0, 0.135, 0.12]);
  for (const s of [-1, 1]) { P.sph(head, 'glow', SP2, 0.021, [0.048 * s, 0.135, 0.185], [1, 0.6, 0.6], 5); P.cone(head, 'body', BONE, 0.035, 0.22 - (s > 0 ? 0.09 : 0), [0.1 * s, 0.27, -0.02], [-0.3, 0, -0.55 * s], 5); }
  P.cone(head, 'body', BONE2, 0.03, 0.16, [0, 0.3, -0.03], [-0.4, 0, 0], 5);
  P.tube(head, 'glow', SP, [[0, 0.28, -0.04], [0.02, 0.44, -0.14], [-0.04, 0.6, -0.2], [0.0, 0.76, -0.22]], 0.045, 0.004, 5, SP2); P.tube(head, 'mem', SP, [[0, 0.28, -0.04], [0.02, 0.46, -0.14], [-0.05, 0.66, -0.2], [0.0, 0.86, -0.22]], 0.085, 0.008, 6, SP2);
  // brazos: hombreras de hueso y carbón con puntas, antebrazos con hoja espectral
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.34 * s, 0.57, 0]), fore = P.joint('fore' + side, arm, [0, -0.34, 0]);
    arm.rest = [-0.12, 0, 0.12 * s]; fore.rest = [-0.3, 0, 0];
    P.lump(arm, 'body', CHAR2, 0.17, [0.04 * s, 0.05, 0], [1.3, 0.7, 1.15], 7, 0.13, 6 + s); for (let i = 0; i < 3; i++) P.cone(arm, 'body', BONE, 0.03, 0.2 - i * 0.04, [(0.1 + i * 0.06) * s, 0.12 - i * 0.015, (i - 1) * 0.06], [0, 0, -(1.0 + i * 0.1) * s], 5);
    P.tor(arm, 'glow', EMB, 0.17, 0.008, [0.04 * s, 0.07, 0], [Math.PI / 2, 0, 0], 7, [1.25, 1.1, 1]);
    P.tube(arm, 'body', BONE2, [[0, 0, 0], [0, -0.17, 0.0], [0, -0.34, 0.01]], 0.062, 0.046, 6); P.tor(arm, 'body', CHAR, 0.06, 0.012, [0, -0.2, 0], [Math.PI / 2, 0, 0], 6);
    P.lump(fore, 'body', BONE, 0.058, [0, 0, 0], [1, 1, 1], 6, 0.15, 3); P.tube(fore, 'body', CHAR2, [[0, 0, 0], [0, -0.17, 0.02], [0, -0.32, 0.03]], 0.058, 0.05, 6, CHAR);
    P.lump(fore, 'body', CHAR, 0.075, [0, -0.38, 0.03], [1, 1.1, 1.1], 6, 0.15, 4); for (const dx of [-0.03, 0, 0.03]) P.cone(fore, 'body', BONE, 0.012, 0.09, [dx, -0.45, 0.07], [0.7, 0, 0], 4);
    P.tube(fore, 'glow', EMB, [[0.045 * s, -0.04, 0.02], [0.05 * s, -0.18, 0.04], [0.04 * s, -0.31, 0.04]], 0.006, 0.004, 3);
    if (c.native !== false) { const L = s > 0 ? 1.05 : 0.8; P.blade(fore, 'body', BONE, [0, -0.3, 0.1], [0, -L + 0.06, 0.1], 0.085, 0.03); P.blade(fore, 'glow', SP2, [0, -0.32, 0.1], [0, -L, 0.1], 0.02, 0.05); P.blade(fore, 'mem', SP, [0, -0.3, 0.1], [0, -L - 0.05, 0.1], 0.2, 0.08); }
  }
  // capa hecha jirones (espectral) y tabardo
  const cape = P.joint('cape', torso, [0, 0.58, -0.17]);
  for (let i = 0; i < 6; i++) { const x0 = -0.3 + i * 0.1, [A, B] = strip(x0, x0 + 0.095, 0, 0, 1.05 + (i % 3) * 0.22, 6, 0.4, 0.05, -0.1); P.sheet(cape, 'body', i % 2 ? 0x2a1d17 : 0x1c1410, A, B, 1, i % 2 ? 0x7a2e12 : 0x4a1f10); P.tube(cape, 'glow', 0xff6a2a, A.slice(-3).map((p) => [p[0] + 0.01, p[1], p[2]]), 0.005, 0.003, 3); }
  const tab = P.joint('tab', root, [0, 1.0, 0.0]);
  for (let i = 0; i < 3; i++) { const x0 = -0.15 + i * 0.1, [A, B] = strip(x0, x0 + 0.095, 0, 0.2, 0.62 + (i % 2) * 0.15, 5, 0.15, 0.03, 0.06); P.sheet(tab, 'body', 0x2a1d17, A, B, 1, 0x7a2e12); }
  // fragmentos de espada y brasas que giran detrás
  const orb = P.joint('orb', root, [0, 1.35, 0]);
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4, rr = 0.9 + (i % 2) * 0.12, p = [Math.cos(a) * rr, (i - 1.5) * 0.18, Math.sin(a) * rr], rot = [0.3, -a, 0.2 * i];
    P.blade(orb, 'body', BONE, [p[0], p[1] - 0.18, p[2]], [p[0] + Math.sin(a) * 0.1, p[1] + 0.28, p[2] - Math.cos(a) * 0.1], 0.09, 0.03); P.blade(orb, 'glow', EMB2, [p[0], p[1] - 0.16, p[2]], [p[0] + Math.sin(a) * 0.1, p[1] + 0.26, p[2] - Math.cos(a) * 0.1], 0.016, 0.045); void rot; }
  return {
    fx: { color: SP, kind: 'ring' }, pal: { main: BONE, dark: CHAR2, glow: SP, hot: EMB, light: SP2, rim: BONE2 },
    mat: { rim: SP, vein: EMB, rough: 0.72, metal: 0.12, ns: 3.2, veinK: 1.15, rimK: 0.75 }, particles: { kind: 'brasas', color: 0xff8a3a, n: 56 },
    anchors: { sh: [0.34, 0.66, 0], back: [0, 0.45, -0.2], chest: [0, 0.42, 0.22], headTop: [0, 0.3, -0.02], hand: [0, -0.38, 0.04], s: 1, head: [0, 0.14, 0.02] },
    poses: {
      melee: [
        { t: 0.2, r: { arm: [0.7, 0.2, 0.7], fore: [-0.5, 0, 0], armL: [-0.4, 0, -0.2], torso: [0.05, 0.55, 0] } },
        { t: 0.36, r: { arm: [-1.65, -0.3, -0.05], fore: [-0.15, 0, 0], armL: [-0.7, 0, -0.3], torso: [0.12, -0.65, 0] }, y: -0.04 },
        { t: 0.7, r: { arm: [-1.4, -0.3, 0], fore: [-0.2, 0, 0], armL: [-0.6, 0, -0.2], torso: [0.1, -0.5, 0] } },
        { t: 1.05, r: {} },
      ],
      skill: [
        { t: 0.3, r: { arm: [-0.9, 0.4, -0.8], fore: [-1.6, 0, 0], torso: [0.3, 0, 0] }, y: -0.1, open: 1 },
        { t: 1.5, r: { arm: [-0.9, 0.4, -0.8], fore: [-1.6, 0, 0], torso: [0.3, 0, 0] }, y: -0.1, open: 1 },
        { t: 2.0, r: {} },
      ],
    },
    custom(k, t, J) {
      J.cape.g.rotation.x = 0.1 + Math.sin(t * 1.3) * 0.07 + k.open * 0.2; J.cape.g.rotation.z = Math.sin(t * 0.9) * 0.05; J.tab.g.rotation.x = Math.sin(t * 1.1 + 1) * 0.06;
      J.orb.g.rotation.y = t * (0.7 + k.open * 2); J.orb.g.position.y = 1.35 + Math.sin(t * 1.2) * 0.06; J.torso.g.scale.x += k.open * 0.06;
      J.head.g.rotation.x += Math.sin(t * 0.7) * 0.03;
    },
  };
}

/* ═════════════ VESPER — la Bestia Cazadora ═════════════ */
function vesper(P, c) {
  const SK = 0x24123f, SK2 = 0x4c2c7c, GH = 0x7a54b8, NV = c.color, NV2 = 0xe6c0ff, PH = 0xc8ff5a, CL = 0xf0e8f8;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 0.98, 0.12]), head = P.joint('head', torso, [0, 0.16, 0.7]);
  head.rest = [0.14, 0, 0];
  // cuarto trasero: ancas poderosas, patas digitígradas y cola que ondula
  for (const s of [-1, 1]) {
    const th = [[0.22 * s, 0.98, -0.45], [0.31 * s, 0.74, -0.58], [0.26 * s, 0.48, -0.78]], sh = [[0.26 * s, 0.48, -0.78], [0.23 * s, 0.26, -0.62], [0.2 * s, 0.07, -0.5]];
    P.tube(root, 'body', SK2, th, 0.17, 0.09, 8, SK); P.tube(root, 'mem', GH, th, 0.215, 0.12, 8); P.tube(root, 'body', SK, sh, 0.09, 0.05, 7, SK2); P.tube(root, 'mem', GH, sh, 0.125, 0.08, 6);
    P.lump(root, 'body', SK2, 0.08, [0.2 * s, 0.05, -0.4], [1, 0.7, 1.5], 6, 0.1, 3); for (const dx of [-0.04, 0, 0.04]) P.tube(root, 'body', CL, [[0.2 * s + dx, 0.04, -0.32], [0.2 * s + dx, 0.03, -0.24], [0.2 * s + dx * 1.2, 0.01, -0.17]], 0.016, 0.003, 4);
    P.tube(root, 'glow', NV, [[0.24 * s, 1.0, -0.5], [0.34 * s, 0.76, -0.6], [0.28 * s, 0.5, -0.78], [0.23 * s, 0.3, -0.62]], 0.009, 0.005, 3, NV2);
  }
  P.lump(root, 'body', SK2, 0.3, [0, 0.98, -0.5], [1, 0.95, 1.2], 8, 0.08, 2); P.lump(root, 'mem', GH, 0.37, [0, 0.98, -0.5], [1, 0.95, 1.2], 8, 0.08, 2);
  const t1 = P.joint('tail1', root, [0, 1.0, -0.8]), t2 = P.joint('tail2', t1, [0, 0.1, -0.55]);
  P.tube(t1, 'body', SK2, [[0, 0, 0], [0, 0.04, -0.28], [0, 0.1, -0.55]], 0.11, 0.065, 7, SK); P.tube(t1, 'glow', NV, [[0, 0.09, -0.02], [0, 0.13, -0.3], [0, 0.2, -0.55]], 0.008, 0.005, 3);
  P.tube(t2, 'mem', GH, [[0, 0, 0], [0, 0.2, -0.28], [0, 0.08, -0.56], [0, 0.36, -0.86]], 0.09, 0.012, 7, NV2); P.tube(t2, 'body', SK, [[0, 0, 0], [0, 0.2, -0.28], [0, 0.08, -0.56]], 0.06, 0.03, 6); P.sph(t2, 'glow', NV2, 0.04, [0, 0.36, -0.86], [1, 1, 1.4], 5);
  // torso: pecho enorme, costillar de luz dentro de un cuerpo fantasma y una vela dorsal de nervios
  P.tube(torso, 'body', SK, [[0, 0.0, -0.6], [0, 0.06, -0.1], [0, 0.12, 0.45]], 0.09, 0.09, 6);
  P.lump(torso, 'body', SK2, 0.34, [0, -0.02, 0.32], [0.95, 1.05, 1.2], 9, 0.08, 4); P.lump(torso, 'mem', GH, 0.41, [0, -0.02, 0.32], [0.95, 1.05, 1.2], 9, 0.08, 4); P.lump(torso, 'body', SK2, 0.27, [0, -0.02, -0.16], [0.95, 0.9, 1.5], 8, 0.08, 6);
  for (let i = 0; i < 6; i++) P.tor(torso, 'glow', i % 2 ? NV : NV2, 0.27 - Math.abs(i - 2.5) * 0.012, 0.007, [0, -0.02, -0.12 + i * 0.1], [0, 0, 0], 8, [1, 1.05, 1]);
  for (let i = 0; i < 7; i++) { const z = -0.45 + i * 0.16, h = 0.34 - Math.abs(i - 3) * 0.045; P.tri(torso, 'mem', i % 2 ? GH : 0xa07ae0, [0, 0.26, z], [0, 0.26 + h, z + 0.06], [0, 0.26, z + 0.15]); P.tube(torso, 'glow', NV2, [[0, 0.26, z], [0, 0.26 + h, z + 0.06]], 0.006, 0.003, 3); }
  P.ico(torso, 'glow', NV2, 0.09, [0, -0.04, 0.34], [1, 1.2, 1.1], [0, 0, 0], 1);
  P.tube(torso, 'body', SK2, [[0, 0.08, 0.4], [0, 0.18, 0.55], [0, 0.2, 0.7]], 0.2, 0.13, 8); P.tube(torso, 'mem', GH, [[0, 0.08, 0.4], [0, 0.18, 0.55], [0, 0.2, 0.7]], 0.25, 0.17, 8);
  // crin de llama de nervios que flota hacia atrás
  const mane = P.joint('mane', torso, [0, 0.3, 0.52]);
  for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 0.05, A = [], B = []; for (let r = 0; r < 6; r++) { const u = r / 5; A.push([x - 0.02, 0.04 * Math.sin(u * 3 + i) + u * 0.06, 0.05 - u * (0.7 + (i % 2) * 0.2)]); B.push([x + 0.02, 0.04 * Math.sin(u * 3 + i) + u * 0.06 + 0.03, 0.05 - u * (0.7 + (i % 2) * 0.2)]); } P.sheet(mane, 'mem', i % 2 ? NV : NV2, A, B, 1, GH); P.tube(mane, 'glow', i % 2 ? NV2 : NV, A.map((p, q) => [p[0] + 0.02, p[1] + 0.015, p[2]]), 0.009, 0.002, 3); }
  // cabeza lupina grande: cráneo, hocico con colmillos, ojos fosforescentes, orejas largas, cuernos de hueso
  P.lump(head, 'body', SK2, 0.17, [0, 0.0, 0.05], [0.88, 0.85, 1.2], 9, 0.07, 2); P.lump(head, 'mem', GH, 0.22, [0, 0.0, 0.05], [0.88, 0.85, 1.2], 9, 0.07, 2);
  P.tube(head, 'body', SK, [[0, -0.01, 0.12], [0, -0.04, 0.3], [0, -0.06, 0.43]], 0.105, 0.065, 7); P.sph(head, 'glow', NV2, 0.03, [0, -0.035, 0.48], [1.2, 0.8, 0.8], 5);
  P.tube(head, 'body', SK, [[0, -0.1, 0.1], [0, -0.14, 0.28], [0, -0.12, 0.4]], 0.05, 0.03, 6); // mandíbula
  for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.026, k = 1 - Math.abs(i - 2) * 0.12; P.cone(head, 'body', CL, 0.012, 0.09 * k, [x, -0.075, 0.36 - Math.abs(i - 2) * 0.025], [Math.PI, 0, 0], 4); P.cone(head, 'body', CL, 0.01, 0.07 * k, [x, -0.12, 0.34 - Math.abs(i - 2) * 0.025], [0, 0, 0], 4); }
  for (const s of [-1, 1]) {
    P.sph(head, 'glow', PH, 0.04, [0.075 * s, 0.05, 0.2], [1.3, 0.6, 0.7], 6); P.sph(head, 'mem', PH, 0.085, [0.075 * s, 0.05, 0.2], [1.2, 0.8, 0.8], 5); P.tube(head, 'glow', NV2, [[0.04 * s, 0.1, 0.24], [0.09 * s, 0.11, 0.2], [0.13 * s, 0.09, 0.1]], 0.007, 0.004, 3);
    P.cone(head, 'body', SK2, 0.06, 0.34, [0.09 * s, 0.2, -0.03], [-0.35, 0, -0.35 * s], 6); P.cone(head, 'glow', NV, 0.014, 0.3, [0.092 * s, 0.2, -0.05], [-0.35, 0, -0.35 * s], 3);
    P.tube(head, 'body', CL, [[0.08 * s, 0.12, -0.02], [0.17 * s, 0.26, -0.12], [0.22 * s, 0.42, -0.1]], 0.026, 0.006, 5); P.tube(head, 'body', CL, [[0.16 * s, 0.24, -0.1], [0.28 * s, 0.3, -0.18]], 0.016, 0.004, 4);
  }
  // patas delanteras con garras (las articulaciones armR/foreR golpean)
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.26 * s, -0.04, 0.34]), fore = P.joint('fore' + side, arm, [0, -0.46, 0]);
    arm.rest = [-0.04, 0, 0.1 * s]; fore.rest = [-0.2, 0, 0];
    P.lump(arm, 'body', SK2, 0.16, [0, 0, 0], [1, 1.1, 1.1], 8, 0.1, 5); P.tube(arm, 'body', SK2, [[0, 0, 0], [0, -0.24, -0.04], [0, -0.46, 0]], 0.14, 0.085, 8, SK); P.tube(arm, 'mem', GH, [[0, 0, 0], [0, -0.24, -0.04], [0, -0.46, 0]], 0.18, 0.115, 7);
    P.tube(arm, 'glow', NV, [[0.08 * s, -0.04, 0.03], [0.09 * s, -0.24, -0.02], [0.07 * s, -0.44, 0.02]], 0.009, 0.006, 3, NV2);
    P.tube(fore, 'body', SK, [[0, 0, 0], [0, -0.22, 0.06], [0, -0.42, 0.03]], 0.085, 0.05, 7); P.tube(fore, 'mem', GH, [[0, 0, 0], [0, -0.22, 0.06], [0, -0.42, 0.03]], 0.115, 0.075, 6);
    P.lump(fore, 'body', SK2, 0.085, [0, -0.47, 0.09], [1, 0.8, 1.3], 7, 0.12, 4); P.tube(fore, 'glow', NV, [[0.05 * s, -0.04, 0.04], [0.05 * s, -0.22, 0.08], [0.04 * s, -0.42, 0.05]], 0.007, 0.005, 3);
    if (c.native !== false) for (const dx of [-0.045, 0, 0.045]) { P.tube(fore, 'body', CL, [[dx, -0.5, 0.14], [dx * 1.3, -0.58, 0.23], [dx * 1.5, -0.7, 0.26]], 0.022, 0.004, 4); P.tube(fore, 'glow', NV2, [[dx, -0.5, 0.14], [dx * 1.3, -0.58, 0.23], [dx * 1.5, -0.7, 0.26]], 0.006, 0.002, 3); }
  }
  // colmillos flotantes que rondan al cazador
  const orb = P.joint('orb', torso, [0, 0.3, 0.45]);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5, p = [Math.cos(a) * 0.62, Math.sin(i * 1.7) * 0.1, Math.sin(a) * 0.62]; P.tube(orb, 'body', CL, [[p[0], p[1] - 0.12, p[2]], [p[0] + Math.sin(a) * 0.08, p[1], p[2] - Math.cos(a) * 0.08], [p[0], p[1] + 0.14, p[2]]], 0.026, 0.004, 5); P.sph(orb, 'glow', NV2, 0.016, [p[0], p[1] + 0.14, p[2]], [1, 1, 1], 4); }
  return {
    fx: { color: NV, kind: 'streak' }, pal: { main: SK2, dark: SK, glow: NV, hot: PH, light: NV2, rim: CL },
    mat: { rim: NV2, vein: NV, rough: 0.42, metal: 0.1, ns: 3.6, veinK: 1.0, rimK: 1.0 }, particles: { kind: 'fosforo', color: 0xc8ff5a, n: 48 },
    anchors: { sh: [0.28, 0.14, 0.34], back: [0, 0.2, -0.1], chest: [0, -0.02, 0.62], headTop: [0, 0.14, 0.0], hand: [0, -0.5, 0.12], s: 1.0, head: [0, 0.05, 0.2], quad: true, legs: { x: 0.28, y0: 0.9, y1: 0.12, z: -0.6 } },
    poses: {
      melee: [
        { t: 0.18, r: { arm: [0.5, 0, 1.0], fore: [-0.5, 0, 0], armL: [0.3, 0, -0.3], torso: [-0.25, 0.5, 0] }, y: -0.08 },
        { t: 0.3, r: { arm: [-1.5, 0.3, -0.5], fore: [-0.3, 0, 0], armL: [0.5, 0, -0.9], torso: [-0.1, -0.6, 0] }, y: -0.1 },
        { t: 0.42, r: { arm: [-1.3, 0.2, 0.7], fore: [-0.2, 0, 0], armL: [-1.5, -0.3, 0.6], torso: [-0.1, 0.5, 0] }, y: -0.1 },
        { t: 0.9, r: {} },
      ],
      skill: [
        { t: 0.25, r: { arm: [-0.9, 0, 0.5], fore: [-0.2, 0, 0], torso: [-0.5, 0, 0], head: [-0.6, 0, 0] }, y: 0.04, open: 1 },
        { t: 1.3, r: { arm: [-0.9, 0, 0.5], fore: [-0.2, 0, 0], torso: [-0.5, 0, 0], head: [-0.6, 0, 0] }, y: 0.04, open: 1 },
        { t: 1.8, r: {} },
      ],
    },
    custom(k, t, J) {
      J.tail1.g.rotation.y += Math.sin(t * 1.3) * 0.3 * (1 + k.open); J.tail2.g.rotation.y += Math.sin(t * 1.3 - 0.9) * 0.5 * (1 + k.open); J.tail1.g.rotation.x += k.open * 0.35;
      J.mane.g.rotation.y = Math.sin(t * 1.1) * 0.14; J.mane.g.rotation.x = -0.1 - k.open * 0.3 + Math.sin(t * 1.7) * 0.07; J.torso.g.rotation.z += Math.sin(t * 0.8) * 0.045; J.head.g.rotation.y += Math.sin(t * 0.5 + 1) * 0.16;
      J.orb.g.rotation.y = t * (0.9 + k.open); J.orb.g.position.y = 0.3 + Math.sin(t * 1.4) * 0.04;
    },
  };
}

/* ═════════════ MICELIO — el Coloso Raíz ═════════════ */
function micelio(P, c) {
  const BARK = 0x5a4130, BARK2 = 0x7d6044, BARK3 = 0x2a1e16, MOSS = 0x4a8a2c, GR = c.color, CAPS = [0xd9742a, 0xe8c25a, 0xa8421e, 0x9ad84a], STEM = 0xe6dcc0, SP = 0xc6ff7a;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 1.05, 0]), head = P.joint('head', torso, [0, 0.98, 0.2]);
  torso.rest = [0.18, 0, 0];
  for (const s of [-1, 1]) { // piernas-columna de raíz que se abren en el suelo
    P.tube(root, 'body', BARK, [[0.3 * s, 1.1, 0], [0.42 * s, 0.7, 0.05], [0.48 * s, 0.32, 0.1]], 0.27, 0.2, 8, BARK3); P.lump(root, 'body', BARK2, 0.21, [0.45 * s, 0.7, 0.18], [1, 1.2, 0.8], 7, 0.25, 5 + s);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3, L = 0.55 + (i % 3) * 0.2; P.tube(root, 'body', i % 2 ? BARK2 : BARK, [[0.48 * s, 0.3, 0.1], [0.48 * s + Math.cos(a) * L * 0.5, 0.14, 0.1 + Math.sin(a) * L * 0.5], [0.48 * s + Math.cos(a) * L, 0.02, 0.1 + Math.sin(a) * L]], 0.1, 0.018, 5, MOSS); }
    P.tube(root, 'glow', GR, [[0.52 * s, 0.26, 0.12], [0.6 * s, 0.1, 0.4], [0.62 * s, 0.03, 0.8]], 0.012, 0.005, 3, SP);
  }
  P.lump(root, 'body', BARK3, 0.5, [0, 1.1, 0], [1.3, 0.55, 0.85], 8, 0.15, 3);
  // tronco: corteza con una cavidad que late, hongos de repisa, musgo y bulbos de esporas
  P.tube(torso, 'body', BARK, [[0, -0.05, 0], [0, 0.4, 0.04], [0, 0.85, 0.1]], 0.5, 0.45, 9, BARK2); P.lump(torso, 'body', BARK2, 0.32, [0, 0.5, -0.16], [1.45, 1.3, 0.8], 8, 0.22, 7);
  P.lump(torso, 'body', BARK3, 0.27, [0, 0.45, 0.3], [0.95, 1.5, 0.45], 8, 0.1, 2); P.lump(torso, 'glow', GR, 0.1, [0, 0.45, 0.36], [1, 1.9, 0.6], 7, 0.1, 3); P.lump(torso, 'mem', GR, 0.2, [0, 0.45, 0.36], [1, 1.9, 0.7], 7, 0.1, 3);
  for (let i = 0; i < 6; i++) { const y = 0.12 + i * 0.12, w = 0.2 - i * 0.015; P.tube(torso, 'glow', i % 2 ? GR : SP, [[-w, y, 0.34], [-w * 0.3, y - 0.03, 0.4], [w * 0.3, y - 0.03, 0.4], [w, y, 0.34]], 0.008, 0.008, 3); }
  const shelf = [[-0.46, 0.5, 0.05, 0.26, 0], [0.5, 0.7, -0.05, 0.3, 1], [-0.36, 0.86, -0.3, 0.22, 2], [0.4, 0.3, -0.34, 0.24, 3], [0, 0.72, -0.5, 0.3, 0], [-0.5, 0.25, -0.15, 0.2, 1]];
  for (const [x, y, z, r, ci] of shelf) { P.lump(torso, 'body', CAPS[ci], r, [x, y, z], [1, 0.28, 0.85], 7, 0.12, ci + 1, [0, Math.atan2(x, 1) * 0.5, 0]); P.tube(torso, 'glow', SP, [[x - r * 0.8, y - 0.03, z + 0.05], [x, y - 0.06, z + r * 0.8], [x + r * 0.8, y - 0.03, z + 0.05]], 0.007, 0.007, 3); }
  for (let i = 0; i < 5; i++) P.lump(torso, 'glow', i % 2 ? SP : GR, 0.06 + (i % 2) * 0.025, [-0.26 + i * 0.13, 0.12 + (i % 2) * 0.05, 0.36], [1, 1, 0.8], 6, 0.12, i);
  P.lump(torso, 'body', MOSS, 0.2, [-0.3, 0.95, 0.0], [1.4, 0.5, 1.1], 7, 0.3, 3); P.lump(torso, 'body', MOSS, 0.17, [0.34, 0.9, -0.05], [1.4, 0.5, 1.1], 7, 0.3, 5);
  const vines = P.joint('vines', torso, [0, 0.9, 0]);
  for (let i = 0; i < 7; i++) { const a = i * TAU / 7, x = Math.cos(a) * 0.38, z = Math.sin(a) * 0.3; P.tube(vines, 'body', MOSS, [[x, 0, z], [x * 1.1, -0.25, z * 1.1], [x * 1.15 + 0.03, -0.55 - (i % 3) * 0.12, z * 1.15]], 0.025, 0.006, 4, SP); }
  // cabeza: máscara de corteza con ojos, cornamenta de ramas y un sombrero de hongo
  P.lump(head, 'body', BARK, 0.21, [0, 0.0, 0.0], [1.15, 0.85, 1.0], 8, 0.16, 8); P.lump(head, 'body', BARK3, 0.11, [0, -0.02, 0.17], [1.5, 0.6, 0.5], 7, 0.1, 2); P.sph(head, 'glow', GR, 0.03, [0.07, 0.02, 0.2], [1.3, 0.7, 0.6], 5); P.sph(head, 'glow', GR, 0.03, [-0.07, 0.02, 0.2], [1.3, 0.7, 0.6], 5);
  for (let i = 0; i < 4; i++) P.sph(head, 'glow', SP, 0.016, [(i - 1.5) * 0.06, 0.1 + (i % 2) * 0.03, 0.19], [1, 1, 0.7], 4);
  for (const s of [-1, 1]) { P.tube(head, 'body', BARK2, [[0.12 * s, 0.1, 0], [0.26 * s, 0.3, -0.05], [0.34 * s, 0.55, -0.02], [0.3 * s, 0.78, 0.04]], 0.04, 0.012, 5, BARK); P.tube(head, 'body', BARK2, [[0.26 * s, 0.3, -0.05], [0.42 * s, 0.4, -0.1], [0.55 * s, 0.5, -0.08]], 0.025, 0.008, 4); P.tube(head, 'body', BARK2, [[0.34 * s, 0.55, -0.02], [0.18 * s, 0.7, 0.0], [0.1 * s, 0.84, 0.0]], 0.02, 0.006, 4); P.sph(head, 'glow', SP, 0.02, [0.3 * s, 0.78, 0.04], [1, 1, 1], 4); P.sph(head, 'glow', GR, 0.02, [0.55 * s, 0.5, -0.08], [1, 1, 1], 4); }
  P.lump(head, 'body', CAPS[0], 0.34, [0, 0.27, -0.02], [1, 0.34, 1], 9, 0.1, 3); P.tor(head, 'glow', SP, 0.28, 0.01, [0, 0.2, -0.02], [Math.PI / 2, 0, 0], 8);
  // brazos colosales: ramas retorcidas que terminan en puños de raíz
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.66 * s, 0.78, 0]), fore = P.joint('fore' + side, arm, [0, -0.55, 0.0]);
    arm.rest = [-0.1, 0, 0.2 * s]; fore.rest = [-0.35, 0, 0];
    P.lump(arm, 'body', BARK2, 0.27, [0, 0, 0], [1, 0.95, 1], 8, 0.25, 4 + s); P.lump(arm, 'body', MOSS, 0.2, [0.03 * s, 0.14, 0], [1.3, 0.5, 1.1], 7, 0.3, 2);
    P.tube(arm, 'body', BARK, [[0, 0, 0], [0.07 * s, -0.28, 0.03], [0.03 * s, -0.55, 0.05]], 0.19, 0.14, 8, BARK2);
    P.lump(fore, 'body', BARK3, 0.17, [0, 0, 0], [1, 1, 1], 7, 0.2, 3); P.tube(fore, 'body', BARK, [[0, 0, 0], [0.02 * s, -0.3, 0.06], [0, -0.58, 0.12]], 0.14, 0.17, 8, BARK2);
    P.lump(fore, 'body', BARK2, 0.24, [0, -0.7, 0.14], [1, 1.1, 1], 8, 0.22, 6); for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.1; P.tube(fore, 'body', BARK, [[x, -0.82, 0.18], [x * 1.3, -0.95, 0.3], [x * 1.4, -1.0 - (i % 2) * 0.06, 0.4]], 0.04, 0.008, 4, MOSS); }
    P.tube(fore, 'glow', GR, [[0.1 * s, -0.15, 0.14], [0.14 * s, -0.4, 0.2], [0.1 * s, -0.62, 0.26]], 0.01, 0.007, 3, SP);
    P.cyl(fore, 'body', STEM, 0.014, 0.02, 0.12, [-0.15 * s, -0.22, -0.14], [0.2, 0, 0], 5); P.lump(fore, 'body', CAPS[2], 0.08, [-0.15 * s, -0.15, -0.14], [1, 0.5, 1], 6, 0.1, 2);
  }
  // vainas de esporas que orbitan
  const orb = P.joint('orb', root, [0, 2.0, 0]);
  for (let i = 0; i < 7; i++) { const a = i * TAU / 7 * 1.0, r = 0.9 + (i % 3) * 0.28, y = (i % 4) * 0.28 - 0.5; P.lump(orb, 'mem', SP, 0.07 + (i % 3) * 0.025, [Math.cos(a) * r, y, Math.sin(a) * r], [1, 1, 1], 6, 0.15, i); P.sph(orb, 'glow', GR, 0.025, [Math.cos(a) * r, y, Math.sin(a) * r], [1, 1, 1], 4); }
  return {
    fx: { color: GR, kind: 'ring', big: true }, pal: { main: BARK2, dark: BARK3, glow: GR, hot: SP, light: STEM, rim: MOSS },
    mat: { rim: GR, vein: GR, rough: 0.88, metal: 0.02, ns: 2.2, veinK: 0.9, rimK: 0.65 }, particles: { kind: 'esporas', color: 0xb8ff6a, n: 64 },
    anchors: { sh: [0.66, 0.86, 0], back: [0, 0.55, -0.45], chest: [0, 0.45, 0.4], headTop: [0, 0.34, -0.02], hand: [0, -0.78, 0.14], s: 1.5, head: [0, 0.02, 0.18] },
    poses: {
      melee: [
        { t: 0.3, r: { arm: [-2.7, 0, 0.35], fore: [-0.4, 0, 0], torso: [-0.2, 0, 0] }, y: 0.05 },
        { t: 0.45, r: { arm: [-0.6, 0, 0.15], fore: [-0.2, 0, 0], torso: [0.55, 0, 0] }, y: -0.14 },
        { t: 0.9, r: { arm: [-0.6, 0, 0.15], fore: [-0.2, 0, 0], torso: [0.5, 0, 0] }, y: -0.12 },
        { t: 1.3, r: {} },
      ],
      skill: [
        { t: 0.4, r: { arm: [-0.3, 0, 1.5], fore: [-0.5, 0, 0], torso: [-0.25, 0, 0], head: [-0.2, 0, 0] }, y: 0.04, open: 1 },
        { t: 1.6, r: { arm: [-0.3, 0, 1.5], fore: [-0.5, 0, 0], torso: [-0.25, 0, 0], head: [-0.2, 0, 0] }, y: 0.04, open: 1 },
        { t: 2.1, r: {} },
      ],
    },
    custom(k, t, J) {
      const b = 1 + Math.sin(t * 1.2) * 0.02 + k.open * 0.06; J.torso.g.scale.multiplyScalar(b); J.vines.g.rotation.x = Math.sin(t * 0.9) * 0.08; J.vines.g.rotation.z = Math.sin(t * 0.7 + 1) * 0.08;
      J.orb.g.rotation.y = t * (0.3 + k.open); J.orb.g.position.y = 2.0 + Math.sin(t * 0.8) * 0.1; J.head.g.rotation.z += Math.sin(t * 0.5) * 0.04;
    },
  };
}

/* ═════════════ UMBRA — el Errante ═════════════ */
function umbra(P, c) {
  const SH = 0x140b26, SH2 = 0x2f1c58, MIR = 0x6d7699, VI = c.color, GH = 0x40ffc0, LIL = 0x8a68c8;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 1.25, 0]), head = P.joint('head', torso, [0, 0.72, 0.04]);
  torso.rest = [0.06, 0, 0];
  // sudario: capas de sombra que se deshilachan hacia abajo (no hay piernas)
  const sh1 = P.joint('shroud', torso, [0, 0.5, 0]), sh2 = P.joint('shroud2', torso, [0, 0.45, 0]);
  const strips = (j, n, r0, r1, len, col, col2, ph) => { for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU + ph, a1 = ((i + 0.92) / n) * TAU + ph, L = len * (0.7 + 0.3 * Math.abs(Math.sin(i * 2.3 + ph))), rows = 7, A = [], B = []; for (let r = 0; r < rows; r++) { const u = r / (rows - 1), rad = r0 + (r1 - r0) * u * u, y = -u * L, w = Math.sin(u * 4 + i) * 0.06 * u; A.push([Math.cos(a0) * (rad + w), y, Math.sin(a0) * (rad + w) * 0.8]); B.push([Math.cos(a1) * (rad - w), y - 0.05 * u, Math.sin(a1) * (rad - w) * 0.8]); } P.sheet(j, 'mem', col, A, B, 1, col2); } };
  strips(sh1, 11, 0.26, 0.62, 1.75, SH2, SH, 0); strips(sh2, 8, 0.2, 0.46, 1.4, SH, 0x1a0e30, 0.4);
  P.lathe(sh1, 'body', 0x1a0d32, [[0.62, -1.55], [0.5, -1.0], [0.36, -0.5], [0.27, -0.1], [0.3, 0.05], [0.22, 0.12]], 12, [0, 0, 0], [0, 0, 0], 0x321a60, [1, 1, 0.8]);
  // torso: vacío con un anillo y un espejo en el pecho
  P.lump(torso, 'body', SH, 0.22, [0, 0.28, 0], [0.9, 1.5, 0.65], 8, 0.08, 3); P.lump(torso, 'mem', SH2, 0.32, [0, 0.28, 0], [0.9, 1.5, 0.7], 8, 0.08, 3);
  P.tor(torso, 'glow', VI, 0.3, 0.011, [0, 0.46, 0], [Math.PI / 2 - 0.3, 0.2, 0], 10); P.tor(torso, 'body', LIL, 0.36, 0.016, [0, 0.14, 0], [Math.PI / 2 + 0.3, 0, 0.4], 10);
  P.lump(torso, 'body', MIR, 0.12, [0, 0.32, 0.17], [1, 1.15, 0.2], 8, 0.04, 2); P.tor(torso, 'glow', GH, 0.13, 0.008, [0, 0.32, 0.18], [0, 0, 0], 8, [1, 1.15, 1]);
  // cabeza: capucha sin rostro, tres ojos en columna y un cuerno de sombra
  P.lump(head, 'body', SH2, 0.19, [0, 0.12, 0.0], [0.9, 1.3, 1.0], 8, 0.08, 4); P.lump(head, 'mem', SH2, 0.27, [0, 0.14, 0.0], [0.95, 1.4, 1.05], 8, 0.08, 4); P.lump(head, 'body', 0x05020a, 0.13, [0, 0.12, 0.1], [0.9, 1.3, 0.6], 8, 0.04, 2);
  for (let i = 0; i < 3; i++) P.sph(head, 'glow', i === 1 ? GH : VI, 0.02 - i * 0.002, [0, 0.2 - i * 0.07, 0.165], [0.8, 1.3, 0.6], 5);
  P.tube(head, 'body', SH2, [[0, 0.3, -0.05], [0, 0.48, -0.16], [0, 0.62, -0.36], [0, 0.6, -0.55]], 0.06, 0.008, 6, SH); P.tube(head, 'mem', LIL, [[0, 0.3, -0.05], [0, 0.48, -0.16], [0, 0.62, -0.36], [0, 0.66, -0.62]], 0.1, 0.01, 6);
  P.tor(head, 'glow', VI, 0.24, 0.008, [0, 0.34, -0.02], [Math.PI / 2, 0, 0.3], 10);
  // brazos fantasmales con manos de dedos largos (la derecha empuña la hoja de vacío)
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.34 * s, 0.52, 0.02]), fore = P.joint('fore' + side, arm, [0, -0.4, 0.03]);
    arm.rest = [-0.15, 0, 0.16 * s]; fore.rest = [-0.4, 0, 0];
    P.lump(arm, 'body', SH2, 0.07, [0, 0, 0], [1, 1, 1], 6, 0.1, 2); P.tube(arm, 'body', SH2, [[0, 0, 0], [0.01 * s, -0.2, 0.02], [0, -0.4, 0.03]], 0.05, 0.035, 6, SH); P.tube(arm, 'mem', LIL, [[0, 0, 0], [0.01 * s, -0.2, 0.02], [0, -0.4, 0.03]], 0.085, 0.06, 6);
    P.lump(fore, 'body', SH2, 0.04, [0, 0, 0], [1, 1, 1], 5, 0.1, 2); P.tube(fore, 'body', SH2, [[0, 0, 0], [0, -0.2, 0.04], [0, -0.38, 0.05]], 0.035, 0.026, 6, SH); P.tube(fore, 'mem', LIL, [[0, 0, 0], [0, -0.2, 0.04], [0, -0.38, 0.05]], 0.06, 0.04, 6);
    P.lump(fore, 'body', SH2, 0.035, [0, -0.4, 0.05], [1, 1.2, 1], 5, 0.1, 3); for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.026; P.tube(fore, 'body', MIR, [[x, -0.42, 0.06], [x * 1.4, -0.52, 0.1], [x * 1.7, -0.6 - (i % 2) * 0.04, 0.12]], 0.008, 0.003, 4); }
    if (s > 0 && c.native !== false) { P.blade(fore, 'body', MIR, [0, -0.3, 0.1], [0, -1.12, 0.12], 0.1, 0.025); P.blade(fore, 'glow', GH, [0, -0.32, 0.1], [0, -1.1, 0.12], 0.02, 0.045); P.blade(fore, 'mem', VI, [0, -0.3, 0.1], [0, -1.18, 0.12], 0.2, 0.07); }
    else P.tor(fore, 'glow', GH, 0.12, 0.007, [0, -0.5, 0.06], [Math.PI / 2, 0, 0], 8);
  }
  // fragmentos de espejo en dos órbitas + espejo mayor detrás (existe en varios planos)
  const fa = P.joint('fragA', root, [0, 1.35, 0]), fb = P.joint('fragB', root, [0, 1.1, 0]), mr = P.joint('mirror', torso, [0, 0.5, -0.6]);
  const shards = [[fa, 0.8, 0.15, 0.13, 0], [fa, 0.8, -0.2, 0.1, 2.1], [fa, 0.8, 0.45, 0.08, 4.2], [fa, 0.8, 0.0, 0.11, 5.4], [fb, 1.15, -0.35, 0.16, 1], [fb, 1.15, 0.05, 0.09, 3], [fb, 1.15, 0.5, 0.12, 5], [fb, 1.15, -0.1, 0.1, 6]];
  shards.forEach(([j, rad, y, sz, a], i) => { const p = [Math.cos(a) * rad, y, Math.sin(a) * rad], rot = [a, a * 0.7, 0.4 * i]; if (i % 3 === 0) P.oct(j, 'body', MIR, sz, p, [0.8, 1.9, 0.4], rot); else if (i % 3 === 1) P.box(j, 'body', MIR, [sz * 0.8, sz * 1.8, sz * 0.18], p, rot); else P.oct(j, 'body', MIR, sz * 1.1, p, [0.7, 1.5, 0.3], rot); P.oct(j, 'glow', i % 2 ? GH : VI, sz * 0.22, p, [1, 1.6, 0.5], rot); });
  P.tor(fa, 'glow', VI, 0.8, 0.007, [0, 0.1, 0], [Math.PI / 2 + 0.2, 0, 0], 12); P.tor(fb, 'glow', LIL, 1.15, 0.007, [0, 0, 0], [Math.PI / 2 - 0.3, 0, 0.2], 12);
  P.tor(mr, 'body', LIL, 0.55, 0.03, [0, 0.3, 0], [0, 0, 0], 12, [1, 1.3, 1]); P.lump(mr, 'mem', 0x9bb0ff, 0.52, [0, 0.3, 0.0], [1, 1.3, 0.04], 10, 0.03, 2); P.tor(mr, 'glow', VI, 0.57, 0.01, [0, 0.3, 0.02], [0, 0, 0], 12, [1, 1.3, 1]);
  return {
    fx: { color: VI, kind: 'ringV' }, pal: { main: SH2, dark: SH, glow: VI, hot: GH, light: MIR, rim: LIL },
    mat: { rim: VI, vein: GH, rough: 0.3, metal: 0.75, ns: 5.5, veinK: 0.18, rimK: 0.9 }, particles: { kind: 'espejos', color: 0xcfe0ff, n: 52 },
    anchors: { sh: [0.34, 0.56, 0.02], back: [0, 0.4, -0.2], chest: [0, 0.32, 0.2], headTop: [0, 0.34, -0.02], hand: [0, -0.4, 0.05], s: 1.05, head: [0, 0.12, 0.05] },
    poses: {
      melee: [
        { t: 0.22, r: { armR: [0.4, 0.1, 0.4], foreR: [-0.9, 0, 0], armL: [-0.9, 0, -0.3], torso: [0.05, 0.5, 0] } },
        { t: 0.36, r: { armR: [-1.45, -0.1, -0.1], foreR: [-0.05, 0, 0], armL: [0.2, 0, -0.9], torso: [0.1, -0.45, 0] }, y: 0.03 },
        { t: 0.75, r: { armR: [-1.3, 0, -0.05], foreR: [-0.1, 0, 0], torso: [0.1, -0.3, 0] } },
        { t: 1.1, r: {} },
      ],
      skill: [
        { t: 0.35, r: { arm: [-2.5, 0, 0.5], fore: [-0.2, 0, 0], head: [-0.3, 0, 0] }, y: 0.12, open: 1 },
        { t: 1.6, r: { arm: [-2.5, 0, 0.5], fore: [-0.2, 0, 0], head: [-0.3, 0, 0] }, y: 0.12, open: 1 },
        { t: 2.1, r: {} },
      ],
    },
    custom(k, t, J) {
      const o = 1 + k.open * 0.6; J.fragA.g.rotation.y = t * (0.55 + k.open * 2.5); J.fragB.g.rotation.y = -t * (0.35 + k.open * 2); J.fragA.g.scale.setScalar(o); J.fragB.g.scale.setScalar(o);
      J.fragA.g.position.y = 1.35 + Math.sin(t * 1.1) * 0.08; J.fragB.g.position.y = 1.1 + Math.sin(t * 0.8 + 1) * 0.1; J.fragB.g.rotation.z = 0.15 * Math.sin(t * 0.6);
      J.shroud.g.rotation.x = Math.sin(t * 0.9) * 0.07; J.shroud.g.rotation.z = Math.sin(t * 0.7 + 1) * 0.07; J.shroud.g.scale.y = 1 + Math.sin(t * 1.3) * 0.03; J.shroud2.g.rotation.x = -Math.sin(t * 0.8) * 0.09; J.shroud2.g.rotation.z = Math.sin(t * 1.1) * 0.08;
      J.mirror.g.rotation.y = Math.sin(t * 0.5) * 0.5; J.mirror.g.position.y = 0.5 + Math.sin(t * 0.9) * 0.05; J.head.g.position.y = 0.72 + Math.sin(t * 1.4) * 0.025; J.root.g.position.y += 0.1 + Math.sin(t * 1.0) * 0.06;
    },
  };
}

/* ═════════════ SERAF — el Ángel Caído ═════════════ */
function seraf(P, c) {
  const IV = 0xf4ebd4, IV2 = 0xcdb88a, GD = c.color, GD2 = 0xfff2b8, DK = 0x3a2a12, MEM = 0xffe08a, ASH = 0x4a3a22;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 1.05, 0]), head = P.joint('head', torso, [0, 0.66, 0.03]);
  // piernas finas bajo una túnica de luz
  for (const s of [-1, 1]) { P.tube(root, 'body', IV, [[0.1 * s, 1.0, 0], [0.12 * s, 0.55, 0.05], [0.12 * s, 0.1, 0.0]], 0.07, 0.036, 6, IV2); P.tube(root, 'body', DK, [[0.12 * s, 0.07, 0.0], [0.12 * s, 0.04, 0.12], [0.12 * s, 0.03, 0.22]], 0.04, 0.025, 5); P.tube(root, 'glow', GD, [[0.14 * s, 0.95, 0.04], [0.15 * s, 0.55, 0.08], [0.14 * s, 0.14, 0.03]], 0.006, 0.004, 3); }
  P.lump(root, 'body', IV2, 0.18, [0, 1.0, 0], [1.2, 0.65, 0.85], 7, 0.06, 2);
  const robe = P.joint('robe', root, [0, 1.0, 0]);
  P.lathe(robe, 'body', 0xe8d9ae, [[0.4, -1.0], [0.35, -0.6], [0.245, -0.25], [0.19, 0.0], [0.16, 0.1]], 12, [0, 0, 0], [0, 0, 0], 0xfff0c8, [1, 1, 0.85]);
  for (let i = 0; i < 12; i++) { const a0 = (i / 12) * TAU, a1 = ((i + 0.9) / 12) * TAU, L = 0.82 + 0.25 * Math.abs(Math.sin(i * 1.7)), rows = 6, A = [], B = []; for (let r = 0; r < rows; r++) { const u = r / (rows - 1), rad = 0.15 + u * u * 0.3 + u * 0.06, y = -u * L, w = Math.sin(u * 3.5 + i) * 0.05 * u; A.push([Math.cos(a0) * (rad + w), y, Math.sin(a0) * (rad + w) * 0.85]); B.push([Math.cos(a1) * (rad - w), y, Math.sin(a1) * (rad - w) * 0.85]); } P.sheet(robe, 'mem', i % 2 ? MEM : 0xfff6dc, A, B, 1, i % 3 ? 0xffd37a : 0xfff0c0); }
  for (const [y, r] of [[-0.99, 0.41], [-0.27, 0.25]]) P.tor(robe, 'glow', GD, r, 0.01, [0, y, 0], [Math.PI / 2, 0, 0], 12, [1, 0.85, 1]);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, ca = Math.cos(a), sa = Math.sin(a) * 0.85; P.tube(robe, 'glow', i % 2 ? GD : GD2, [[ca * 0.195, -0.02, sa * 0.195], [ca * 0.255, -0.27, sa * 0.255], [ca * 0.36, -0.62, sa * 0.36], [ca * 0.415, -0.98, sa * 0.415]], 0.006, 0.005, 3); }
  for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, x = Math.cos(a) * 0.17, z = Math.sin(a) * 0.15; P.tube(robe, 'glow', GD, [[x, 0, z], [x * 1.6, -0.45, z * 1.6], [x * 2.2 + 0.03, -0.85 - (i % 3) * 0.14, z * 2.2]], 0.01, 0.002, 3, GD2); }
  // tronco ceñido con filigrana de oro y un núcleo de luz
  P.tube(torso, 'body', IV, [[0, 0, 0], [0, 0.32, 0.0], [0, 0.58, 0.02]], 0.15, 0.115, 8, IV2); for (let i = 0; i < 4; i++) P.tor(torso, 'glow', GD, 0.15 - i * 0.008, 0.007, [0, 0.12 + i * 0.1, 0.0], [Math.PI / 2, 0, 0], 8, [1, 0.88, 1]);
  P.ico(torso, 'glow', GD2, 0.055, [0, 0.38, 0.12], [1, 1.2, 0.7], [0, 0, 0], 1); P.lump(torso, 'mem', MEM, 0.14, [0, 0.38, 0.12], [1, 1.2, 0.7], 7, 0.05, 2);
  P.tube(torso, 'glow', GD, [[-0.13, 0.55, 0.09], [-0.05, 0.46, 0.12], [0, 0.4, 0.13]], 0.007, 0.007, 3); P.tube(torso, 'glow', GD, [[0.13, 0.55, 0.09], [0.05, 0.46, 0.12], [0, 0.4, 0.13]], 0.007, 0.007, 3);
  P.tor(torso, 'body', DK, 0.15, 0.028, [0, 0.58, 0], [Math.PI / 2, 0, 0], 8); P.tube(torso, 'body', IV2, [[0, 0.56, 0], [0, 0.64, 0.02]], 0.05, 0.04, 6);
  // cabeza: máscara serena con ojos cerrados, aureola QUEBRADA (arcos que giran) y fragmentos sueltos
  P.lump(head, 'body', IV, 0.125, [0, 0.14, 0.02], [0.85, 1.2, 1.0], 8, 0.04, 2); P.tube(head, 'glow', GD, [[0.02, 0.15, 0.135], [0.05, 0.14, 0.14]], 0.004, 0.004, 3); for (const s of [-1, 1]) P.tube(head, 'glow', GD2, [[0.025 * s, 0.155, 0.128], [0.06 * s, 0.15, 0.12], [0.08 * s, 0.135, 0.11]], 0.005, 0.003, 3);
  P.tube(head, 'glow', GD, [[0, 0.2, 0.125], [0, 0.12, 0.138], [0, 0.04, 0.13]], 0.004, 0.003, 3);
  const halo = P.joint('halo', head, [0, 0.3, -0.12]);
  const arc = (a0, a1, R, r, y = 0, col = GD) => { const pts = []; for (let i = 0; i <= 6; i++) { const a = a0 + (a1 - a0) * (i / 6); pts.push([Math.cos(a) * R, y + Math.sin(a * 3) * 0.01, Math.sin(a) * R * 0.0]); } P.tube(halo, 'glow', col, pts, r, r * 0.7, 5); };
  arc(0.2, 4.2, 0.3, 0.014); arc(4.45, 5.9, 0.3, 0.011); P.tor(halo, 'mem', GD2, 0.3, 0.05, [0, 0, 0], [0, 0, 0], 10);
  const frag = P.joint('frag', root, [0, 1.8, 0]);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5, rr = 0.75 + (i % 2) * 0.15; P.tube(frag, 'glow', GD, [[Math.cos(a) * rr, 0, Math.sin(a) * rr], [Math.cos(a + 0.18) * rr, 0.08 + i * 0.02, Math.sin(a + 0.18) * rr], [Math.cos(a + 0.36) * rr, 0.04, Math.sin(a + 0.36) * rr]], 0.012, 0.004, 4); }
  // alas: el ala derecha entera (plumas de luz); la izquierda, quebrada y quemada en las puntas
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', w = P.joint('wing' + side, torso, [0.1 * s, 0.5, -0.14]); w.rest = [0, 0.35 * s, 0.1 * s];
    const n = s > 0 ? 8 : 5;
    for (let l = 0; l < 2; l++) for (let i = 0; i < n; i++) {
      const u = i / (n - 1), L = (s > 0 ? 1.25 : 0.9) * (1 - l * 0.38) * (0.55 + 0.45 * Math.sin((u * 0.8 + 0.2) * Math.PI)), ang = 1.0 - u * 1.95 - (s < 0 ? 0.1 : 0) - l * 0.1, y0 = 0.05 - l * 0.12, burnt = s < 0 && i > 2;
      const tip = [Math.cos(ang) * L * s, y0 + 0.25 + Math.sin(ang) * L, -0.2 - u * 0.1 - l * 0.04], mid = [tip[0] * 0.45, y0 + 0.25 + (tip[1] - y0 - 0.25) * 0.5 + 0.14, tip[2] * 0.8], base = [0.02 * s, y0, 0];
      feather(P, w, 'mem', burnt ? 0x6a4a2a : (l ? 0xffe9a8 : 0xfff6dc), burnt ? 0x7a4a18 : (l ? 0xffd45a : 0xffe9a8), base, mid, tip, (0.1 - u * 0.03) * (1 - l * 0.25));
      if (l === 0) { P.tube(w, 'body', i % 2 ? IV2 : IV, [base, mid, tip], 0.02 - u * 0.006, 0.004, 5, burnt ? ASH : IV2); P.tube(w, 'glow', burnt ? 0x7a4a18 : GD, [[base[0] + 0.02 * s, base[1] + 0.01, 0.01], mid, tip], 0.006, 0.002, 3, GD2); }
    }
  }
  // brazos finos con hilos de luz; el derecho extiende un látigo
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.2 * s, 0.54, 0]), fore = P.joint('fore' + side, arm, [0, -0.36, 0]);
    arm.rest = [-0.1, 0, 0.1 * s]; fore.rest = [-0.35, 0, 0];
    P.lump(arm, 'body', DK, 0.065, [0, 0, 0], [1, 1, 1], 6, 0.08, 2); P.tube(arm, 'body', IV, [[0, 0, 0], [0, -0.18, 0.01], [0, -0.36, 0.0]], 0.05, 0.038, 6, IV2); P.lump(fore, 'body', IV2, 0.04, [0, 0, 0], [1, 1, 1], 5, 0.08, 2); P.tube(fore, 'body', IV, [[0, 0, 0], [0, -0.17, 0.02], [0, -0.34, 0.02]], 0.038, 0.028, 6);
    P.tor(fore, 'glow', GD, 0.045, 0.007, [0, -0.2, 0], [Math.PI / 2, 0, 0], 6); P.lump(fore, 'body', IV, 0.035, [0, -0.37, 0.02], [1, 1.2, 1], 5, 0.08, 3);
    P.tube(fore, 'glow', GD, [[0.032 * s, -0.04, 0], [0.028 * s, -0.2, 0.01], [0.026 * s, -0.32, 0.01]], 0.005, 0.004, 3);
    if (s > 0 && c.native !== false) { const wh = P.joint('whip', fore, [0, -0.42, 0.01]); const pts = []; for (let i = 0; i < 9; i++) pts.push([Math.sin(i * 0.6) * 0.07, -i * 0.13, i * 0.04]); P.tube(wh, 'glow', GD2, pts, 0.014, 0.003, 4, GD); P.tube(wh, 'mem', MEM, pts, 0.04, 0.008, 5); }
    else for (let i = 0; i < 4; i++) P.tube(fore, 'glow', GD, [[(i - 1.5) * 0.02, -0.4, 0.01], [(i - 1.5) * 0.04, -0.52, 0.02], [(i - 1.5) * 0.06, -0.66, 0.03]], 0.006, 0.002, 3);
  }
  return {
    fx: { color: GD, kind: 'ring' }, pal: { main: IV, dark: DK, glow: GD, hot: GD2, light: MEM, rim: IV2 },
    mat: { rim: GD, vein: GD, rough: 0.35, metal: 0.25, ns: 4.5, veinK: 0.35, rimK: 1.1 }, particles: { kind: 'luz', color: 0xffd45a, n: 56 },
    anchors: { sh: [0.2, 0.56, 0], back: [0, 0.42, -0.14], chest: [0, 0.38, 0.14], headTop: [0, 0.3, -0.02], hand: [0, -0.37, 0.03], s: 0.9, head: [0, 0.14, 0.02] },
    poses: {
      melee: [
        { t: 0.2, r: { arm: [0.6, 0.2, 1.3], fore: [-0.5, 0, 0], torso: [0, 0.5, 0] }, ext: 0.2 },
        { t: 0.34, r: { arm: [-1.6, -0.5, -0.2], fore: [-0.1, 0, 0], torso: [0.1, -0.6, 0] }, ext: 1 },
        { t: 0.75, r: { arm: [-1.4, -0.4, 0], fore: [-0.1, 0, 0], torso: [0.1, -0.4, 0] }, ext: 1 },
        { t: 1.15, r: {}, ext: 0 },
      ],
      skill: [
        { t: 0.35, r: { arm: [-2.0, 0, 0.9], fore: [-0.3, 0, 0], head: [-0.25, 0, 0], torso: [-0.1, 0, 0] }, y: 0.1, open: 1 },
        { t: 1.6, r: { arm: [-2.0, 0, 0.9], fore: [-0.3, 0, 0], head: [-0.25, 0, 0], torso: [-0.1, 0, 0] }, y: 0.1, open: 1 },
        { t: 2.1, r: {} },
      ],
    },
    custom(k, t, J) {
      const f = Math.sin(t * 1.5) * 0.12; for (const s of [-1, 1]) { const w = J[s > 0 ? 'wingR' : 'wingL']; w.g.rotation.z += s * (f * (s > 0 ? 1 : 0.6) + k.open * 0.75); w.g.rotation.y -= s * k.open * 0.9; w.g.rotation.x += k.open * -0.15 + (s < 0 ? Math.sin(t * 0.9) * 0.05 : 0); }
      J.robe.g.rotation.x = Math.sin(t * 1.1) * 0.05; J.robe.g.rotation.z = Math.sin(t * 0.9 + 1) * 0.05; J.robe.g.scale.setScalar(1 + k.open * 0.15);
      J.halo.g.rotation.y = t * 0.5; J.halo.g.rotation.z = Math.sin(t * 0.8) * 0.12; J.frag.g.rotation.y = -t * 0.35; J.frag.g.position.y = 1.8 + Math.sin(t * 1.0) * 0.07;
      if (J.whip) { J.whip.g.scale.y = 1 + k.ext * 1.9; J.whip.g.rotation.z = Math.sin(t * 2) * (0.12 - k.ext * 0.08); J.whip.g.rotation.x = Math.sin(t * 1.7) * 0.1; }
      J.root.g.position.y += k.open * 0.1 + 0.05 + 0.03 * Math.sin(t * 1.3);
    },
  };
}
export const LIMBO = { axioma, vesper, micelio, umbra, seraf };
