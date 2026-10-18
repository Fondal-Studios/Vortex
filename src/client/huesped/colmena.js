// COLMENA — LA SOBERANA DEL ENJAMBRE (Huésped de arte, docs/HUESPEDES_ARTE.md). Folclore del limbo: las abejas de un colmenar quemado que aprendieron a pensar juntas.
// Silueta inconfundible (nada se parece a los otros cinco): torso de avispa con la cintura muy fina, ABDOMEN-SACO segmentado que cuelga hacia atrás y termina en un aguijón
// (cadena de muelles: se balancea), CUATRO ALAS de membrana ámbar con venas (zumban), un NIMBO de celdas hexagonales detrás de la cabeza, ojos compuestos facetados, mandíbulas y
// antenas con física, hombreras de panal (cúmulos de hexágonos de cera con miel dentro) y dos brazos pequeños plegados sobre el vientre. Paleta propia: quitina BURDEOS,
// cera crema, miel ámbar translúcida y jalea real CORAL (nadie más es rojo). Evoluciones visibles por camino (src/sim/colmena-data.js):
//   criador → panal de larvas en la espalda y bolsas de huevos · aguijón → lanzas de veneno en los antebrazos y aguijón enorme · nidos → dos bocas-torreta en la espalda ·
//   nube → alas mayores con púas y nube de polen · cohabita → zánganos posados en hombros y venas fundidas · detonador → glándulas de carga que laten ·
//   reina → corona de panal y manto largo · plaga → enjambre orbitando y abdomen triple.
// Se escribe en el marco del modelo (pose de enlace); el lado izquierdo (+x) va dentro de ak.both().
import * as T from 'three';
import { tools, V, basisQ } from '../huesped-piezas.js';

export const BELLY = 0;   // sin vientre brillante: la jalea vive en la celda-corazón y en las costuras
const CH_D = 0x1c060c, CH = 0x340c16, CH_L = 0x501522, CH_HI = 0x6e2232;               // quitina burdeos (de oscuro a lustre)
const WAX = 0xc4ae82, WAX_D = 0x9a7a4c, WAX_S = 0x6a4c28;                               // cera de panal
const HONEY = 0xe48a10, HONEY_L = 0xe6a838, HONEY_D = 0xa8500a;                         // miel ámbar
const CORAL = 0xf02848, CORAL_L = 0xff7080;                                             // jalea real (rojo sangre-miel: nadie más es rojo)
const TAU = Math.PI * 2, clamp01 = (x) => Math.max(0, Math.min(1, x));

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, cuff, S, low, fbm } = t, P = (n) => ak.P(n), add = ak.add;
  const HC = V(0, 1.6, 0.06), Y = V(0, 1, 0), Zv = V(0, 0, 1), upd = [], has = ctx.has, evo = ctx.evo | 0;
  const C = (h) => new T.Color(h), R = t.rng(77);
  const chit = (a, b, k = 11, sd = 0) => { const ca = C(a), cb = C(b); return (x, y, z) => ca.clone().lerp(cb, clamp01(fbm(Math.abs(x) * k + sd, y * k, z * k, 3) * 1.7 - 0.25)); };
  const CHD = chit(CH_D, CH, 11, 1), CHM = chit(CH, CH_L, 12, 2), CHL = chit(CH_L, CH_HI, 13, 3), HONEYC = (x, y, z) => C(HONEY_D).lerp(C(HONEY_L), clamp01(0.5 + 2.2 * (y - Math.floor(y * 10) / 10 - 0.05) + 0.4 * fbm(x * 18, y * 18, z * 18, 2)));
  const flat = (g) => { g.deleteAttribute('normal'); g.computeVertexNormals(); return g; };   // facetas (ojos compuestos, gemas)
  const hexG = (r, h) => G.cyl(r, r, h, 6);
  /** Celda de panal: prisma hexagonal de cera (eje = dir) con un hexágono de miel que asoma por la cara; core = brasa de jalea dentro. */
  const cell = (bone, p, dir, r, h, o = {}) => {
    const q = basisQ(dir, o.toward || Zv), d = dir.clone().normalize();
    add('marble', X(hexG(r, h), { q, p: [p.x, p.y, p.z] }), bone, { color: o.wax ?? WAX });
    if (o.honey !== false) { const c2 = p.clone().addScaledVector(d, h * 0.5); add('crystal', X(hexG(r * 0.72, h * 1.0), { q, p: [c2.x, c2.y, c2.z] }), bone, { color: C(o.honeyC ?? HONEY).multiplyScalar(0.7) }); }
    if (o.both && !low) { const c4 = p.clone().addScaledVector(d, -h * 0.5); add('crystal', X(hexG(r * 0.72, h * 1.0), { q, p: [c4.x, c4.y, c4.z] }), bone, { color: C(o.honeyC ?? HONEY).multiplyScalar(0.7) }); }
    if (o.core && !low) { const c3 = p.clone().addScaledVector(d, h * 0.78); add('light', X(G.sphere(r * 0.28, 6, 4), { p: [c3.x, c3.y, c3.z], s: [1, 1, 0.6] }), bone, { color: o.core }); }
  };
  /** Posiciones (plano XY) de una flor hexagonal de anillos 0..n, con celdas "pointy-top" de radio rad. */
  const flower = (n, rad) => { const out = [], d = Math.sqrt(3) * rad; for (let q = -n; q <= n; q++) for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) out.push({ x: d * (q + r / 2), y: 1.5 * rad * r, ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) }); return out; };

  // ═══════════════════════════ CABEZA: máscara de avispa con ojos compuestos, mandíbulas, antenas y un nimbo de panal detrás
  {
    const shell = G.lathe([[0.094, -0.082], [0.106, -0.04], [0.111, 0.015], [0.1, 0.072], [0.08, 0.116], [0.045, 0.141], [0, 0.149]], S(14, 8), 0, TAU, 34); X(shell, { p: [HC.x, HC.y, HC.z], s: [1, 1.02, 1.18] });
    add('dark', shell, 'head', { color: CHM });
    add('marble', G.wrapE(G.plate(t.platePts([[0.0, 0.078], [0.03, 0.058], [0.04, -0.01], [0.027, -0.1], [0, -0.128]]), 0.02, 0.006), 0.07, 0.142).translate(HC.x, HC.y, HC.z), 'head', { color: WAX });   // quilla de la cara
    add('light', G.wrapE(G.plate([[0.0, 0.1], [0.012, 0.075], [0.0, 0.05], [-0.012, 0.075]], 0.012, 0.003), 0.05, 0.146).translate(HC.x, HC.y + 0.0, HC.z + 0.004), 'head', { color: CORAL });   // gema de la frente
    add('dark', t.box(0.07, 0.024, 0.016, 0.004, 1).translate(HC.x, HC.y - 0.108, HC.z + 0.128), 'head', { color: 0x120308 });   // boca
    add('dark', G.wrapE(G.plate(t.platePts([[0.0, 0.0], [0.06, 0.016], [0.1, 0.07], [0.07, 0.125], [0.0, 0.145]]), 0.016, 0.005), 0.108, 0.141).translate(HC.x, HC.y + 0.02, HC.z), 'head', { color: CHL });   // placa de la frente
    ak.both(() => {
      // ojo compuesto: gema facetada ámbar → coral, con un destello de luz
      const eye = flat(new T.IcosahedronGeometry(0.056, low ? 0 : 1)); X(eye, { p: [0.078, HC.y + 0.015, HC.z + 0.118], s: [0.9, 1.25, 0.8] });
      add('crystal', eye, 'head', { color: (x, y, z) => C(HONEY_D).lerp(C(CORAL), clamp01(0.5 + (y - HC.y) * 7 + (x - 0.078) * 6)).lerp(C(HONEY_L), clamp01(0.4 - Math.hypot(x - 0.085, y - HC.y - 0.025, z - HC.z - 0.15) * 12)) });
      add('light', X(G.sphere(0.01, 6, 4), { p: [0.09, HC.y + 0.042, HC.z + 0.16] }), 'head', { color: CORAL_L });
      ak.halo('head', V(0.078, HC.y + 0.015, HC.z + 0.17), CORAL, 0.1, 0.22);
      // ceja de quitina que se prolonga hacia atrás, mejilla y mandíbulas cruzadas
      add('dark', X(G.wrapE(G.plate([[0.0, 0.018], [0.07, 0.034], [0.128, 0.0], [0.07, -0.014], [0.0, -0.006]], 0.02, 0.006), 0.113, 0.146), { p: [HC.x, HC.y + 0.045, HC.z] }), 'head', { color: CHL });
      add('dark', X(G.wrapE(G.plate([[0.004, 0.02], [0.05, 0.012], [0.09, -0.04], [0.07, -0.098], [0.03, -0.108], [0.004, -0.06]], 0.016, 0.005), 0.108, 0.14), { p: [HC.x, HC.y - 0.015, HC.z], r: [0, 0.36, 0] }), 'head', { color: CHM });
      add('marble', spikeAt(V(0.034, HC.y - 0.1, HC.z + 0.122), V(0.55, -0.9, 0.7), 0.13, 0.013, 0.03, Zv, { radial: S(5, 4), ridges: 3, ridgeAmp: 0.15 }), 'head', { color: WAX });
      add('marble', spikeAt(V(0.052, HC.y - 0.082, HC.z + 0.108), V(0.9, -0.5, 0.5), 0.085, 0.009, 0.02, Zv, { radial: S(5, 4) }), 'head', { color: WAX_D });
      // antenas con física (cadena de muelles) y bulbo de luz en la punta
      const ap = [V(0.035, 1.715, 0.1), V(0.07, 1.8, 0.14), V(0.105, 1.9, 0.16), V(0.15, 1.99, 0.145), V(0.205, 2.06, 0.1), V(0.265, 2.1, 0.04), V(0.32, 2.11, -0.03)];
      const ch = ak.chain('antena', 'head', ap, { stiff: 0.09, damp: 0.92, gravity: 1.8, sway: 1.3 });
      for (let i = 0; i < ap.length - 1; i++) add('dark', G.tube([ap[i], ap[i + 1]], 0.011 - i * 0.0013, 0.0095 - i * 0.0013, { radial: S(5, 4), tubular: 2, ridges: 3, ridgeAmp: 0.15 }), ch.bones[i].name, { color: i % 2 ? CH_L : CH });
      add('light', G.sphere(0.017, S(7, 5), S(5, 4)).translate(ap[6].x, ap[6].y, ap[6].z), ch.bones[6].name, { color: HONEY_L });
    });
    // collar: tres anillos de cera con fino filete de jalea
    for (let i = 0; i < 3; i++) add('marble', G.band(0.07 - i * 0.002, 0.022, 0.009, { seg: S(16, 8) }).translate(0, 1.446 + i * 0.02, 0.025), 'neck01', { color: i === 1 ? WAX : WAX_D });
    add('light', G.torus(0.071, 0.0028, 3, S(16, 8)).translate(0, 1.456, 0.025), 'neck01', { color: CORAL });
    // NIMBO: disco de celdas hexagonales detrás de la cabeza (gira despacio; algunas celdas rotas, otras con miel que brilla)
    const nb = ak.bone('nimbo', 'head', V(0, HC.y + 0.04, HC.z - 0.17)), rr = t.rng(5), rad = 0.064, cells = flower(low ? 2 : 2, rad);
    for (const c of cells) {
      if (c.ring === 2 && rr() < 0.3) continue;   // hueco: panal roto
      const p = V(c.x, HC.y + 0.04 + c.y, HC.z - 0.17 - c.ring * 0.012), full = rr() < 0.55;
      cell('nimbo', p, V(0, 0.12, -1), rad * 0.93, 0.016 + 0.006 * (3 - c.ring), { honey: full && c.ring > 0, both: true, honeyC: [HONEY, HONEY_L, 0xff7a2a][c.ring % 3], wax: c.ring === 2 ? WAX_D : WAX, toward: Y });
    }
    add('light', G.torus(0.34, 0.0036, 3, S(34, 14)).rotateX(Math.PI / 2 - 0.12).translate(0, HC.y + 0.04, HC.z - 0.18), 'nimbo', { color: CORAL });   // aro fino de luz
    ak.halo('head', V(0, HC.y + 0.04, HC.z - 0.2), HONEY, 0.8, 0.08);
    upd.push((dt, tt) => { nb.rotation.set(0, 0, tt * 0.22); });
  }

  // ═══════════════════════════ TORSO: tórax de avispa (cintura fina), segmentos de cera, celda-corazón con una larva de luz, hombreras de panal
  {
    const chest = G.lathe([[0.1, 1.17], [0.136, 1.22], [0.158, 1.28], [0.162, 1.335], [0.14, 1.39], [0.1, 1.425], [0.082, 1.44]], S(14, 9), 0, TAU, 30); X(chest, { p: [0, 0, 0.02], s: [1, 1, 0.8] });
    add('dark', chest, 'spine01', { color: CHD });
    for (let i = 0; i < 3; i++) add('marble', G.band(0.157 - i * 0.012, 0.05, 0.018, { seg: S(18, 10), sz: 0.82 }).translate(0, 1.355 - i * 0.075, 0.022), i < 1 ? 'spine01' : 'spine02', { color: i % 2 ? WAX_D : WAX });
    for (let i = 0; i < 3; i++) add('light', G.torus(0.158 - i * 0.012, 0.0028, 3, S(18, 10)).scale(1, 1, 0.82).translate(0, 1.327 - i * 0.075, 0.022), i < 1 ? 'spine01' : 'spine02', { color: CORAL });
    // celda-corazón: marco hexagonal de cera, miel dentro y una larva de luz (tres segmentos) que late
    cell('spine01', V(0, 1.285, 0.186), V(0, 0.08, 1), 0.07, 0.034, { honeyC: HONEY, toward: Y });
    for (let i = 0; i < 3; i++) add('light', G.sphere(0.021 - i * 0.003, S(8, 5), S(6, 4)).translate(0, 1.305 - i * 0.034, 0.222 - i * 0.002), 'spine01', { color: i === 0 ? CORAL_L : CORAL });
    ak.halo('spine01', V(0, 1.285, 0.24), CORAL, 0.4, 0.45);
    // cintura de avispa: anillo fino de quitina con hebilla de panal y dos celdas en las caderas
    add('dark', G.band(0.108, 0.05, 0.016, { seg: S(16, 9), sz: 0.82 }).translate(0, 0.99, 0.015), 'spine04', { color: CH_L });
    add('light', G.torus(0.109, 0.003, 3, S(16, 9)).scale(1, 1, 0.82).translate(0, 1.016, 0.015), 'spine04', { color: HONEY_L });
    cell('spine04', V(0, 0.988, 0.108), V(0, 0, 1), 0.04, 0.026, { honeyC: CORAL, toward: Y });
    ak.both(() => {   // pectorales de quitina con filete de jalea y costillas laterales
      t.armorPlate('spine01', [[0.014, 0.118], [0.075, 0.135], [0.145, 0.098], [0.158, 0.02], [0.13, -0.062], [0.07, -0.098], [0.014, -0.07]], { mat: 'dark', depth: 0.028, bevel: 0.009, wrap: { rx: 0.17, rz: 0.125 }, place: (g) => X(g, { p: [0, 1.292, 0.022], r: [0.07, 0, 0] }), color: CHL, trim: 'ember', trimColor: CORAL, trimInset: 0.16, trimR: 0.003 });
      for (let k = 0; k < (low ? 2 : 3); k++) add('dark', G.tube([V(0.06, 1.22 - k * 0.05, 0.15), V(0.15, 1.22 - k * 0.05, 0.1), V(0.175, 1.22 - k * 0.05, 0.0), V(0.15, 1.215 - k * 0.05, -0.09)], 0.011, 0.008, { radial: S(5, 4), tubular: S(10, 6) }), 'spine02', { color: k % 2 ? CHM : CHL });
    });
    for (let k = 0; k < (low ? 3 : 5); k++) add('dark', spikeAt(V(0, 1.38 - k * 0.09, -0.105 - k * 0.008), V(0, 0.55, -1), 0.13 - k * 0.018, 0.022 - k * 0.002, 0.03, Y, { radial: S(5, 4), ridges: 3, ridgeAmp: 0.15 }), k < 2 ? 'spine01' : 'spine02', { color: k % 2 ? CHM : CH });   // cresta dorsal
    ak.both(() => {
      cell('spine05', V(0.14, 0.9, 0.05), V(0.9, 0.1, 0.3), 0.052, 0.03, { honeyC: HONEY, toward: Y });
      // clavícula y hombrera: cúmulo de tres celdas hexagonales de cera apuntando hacia afuera/arriba + cuerno-aguijón de quitina
      const S0 = P('upperarm01');
      add('dark', X(G.wrapE(G.plate([[0, 0.05], [0.09, 0.055], [0.12, 0.02], [0.1, -0.03], [0, -0.04]], 0.018, 0.006), 0.1, 0.085), { p: [0.0, 1.425, -0.006], r: [0.9, 0.0, -0.16] }), 'clavicle', { color: CHL });
      const sh = [[V(S0.x + 0.03, S0.y + 0.1, S0.z + 0.01), V(0.35, 1, 0.15), 0.092, 0.05, HONEY], [V(S0.x + 0.12, S0.y + 0.055, S0.z + 0.04), V(0.9, 0.7, 0.2), 0.075, 0.045, CORAL], [V(S0.x + 0.075, S0.y + 0.12, S0.z - 0.075), V(0.5, 0.8, -0.5), 0.066, 0.04, HONEY_L]];
      sh.forEach(([p, d, r, h, hc], i) => { if (low && i === 2) return; cell('spine01', p, d, r, h, { honeyC: hc, wax: i === 0 ? WAX : WAX_D }); });
      add('dark', spikeAt(V(S0.x + 0.1, S0.y + 0.1, S0.z - 0.06), V(0.5, 1, -0.7), 0.3, 0.028, 0.07, Zv, { radial: S(6, 4), ridges: 3, ridgeAmp: 0.18 }), 'spine01', { color: CH });
      add('light', spikeAt(V(S0.x + 0.115, S0.y + 0.2, S0.z - 0.11), V(0.45, 1, -0.75), 0.13, 0.0075, 0.03, Zv, { radial: 3, tubular: 3 }), 'spine01', { color: CORAL });
      // brazo: manga de quitina con anillos de cera, púa en el codo; antebrazo-guantelete con placa de cera y garras en la mano
      const E0 = P('lowerarm01'), W0 = P('wrist'), F3 = P('finger3-1'), F3e = P('finger3-3');
      add('dark', limb(G.tube([V(0, 0.15, 0), V(0, -0.15, 0)], 0.078, 0.066, { radial: S(7, 5), tubular: 2 }), S0, E0, 0.5), 'upperarm01', { color: CHM });
      for (const u of low ? [0.3] : [0.2, 0.5, 0.8]) add('marble', limb(G.band(0.058, 0.02, 0.01, { seg: S(10, 7) }), S0, E0, u), 'upperarm01', { color: WAX_D });
      add('dark', spikeAt(E0.clone().add(V(0.05, 0.0, -0.04)), V(0.9, 0.3, -0.8), 0.17, 0.02, 0.03, Y, { radial: S(5, 4), ridges: 3 }), 'lowerarm01', { color: CHL });
      add('dark', limb(cuff(0.082, 0.064, 0.2, 0.012, S(10, 7), 30), E0, W0, 0.5), 'lowerarm01', { color: CHM });
      t.armorPlate('lowerarm01', [[-0.04, 0.1], [0.04, 0.1], [0.032, -0.09], [0, -0.115], [-0.032, -0.09]], { mat: 'marble', depth: 0.02, bevel: 0.007, wrap: { rx: 0.066, rz: 0.07 }, color: WAX, trim: 'ember', trimColor: CORAL, trimInset: 0.18, place: (g) => limb(g, E0, W0, 0.5, { r: [0, -0.5, 0] }) });
      cell('wrist', W0.clone().add(V(0.012, 0.012, -0.036)), V(0.3, 0.4, -1), 0.036, 0.022, { honeyC: CORAL });
      for (const [f, len] of (low ? [['finger3', 0.1]] : [['finger2', 0.075], ['finger3', 0.1], ['finger4', 0.085]])) { const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize(); add('marble', spikeAt(b.clone().addScaledVector(d, 0.01), d.clone().add(V(0, -0.1, 0.25)), len, 0.0085, -0.015, V(0, 0.4, 0.2), { radial: S(4, 3) }), `${f}-3`, { color: WAX }); }
      void F3; void F3e;
    });
  }

  // ═══════════════════════════ ABDOMEN-SACO: cadena de segmentos de quitina que cuelga hacia atrás (muelles) y termina en el aguijón
  {
    const pts = [V(0, 0.95, -0.13), V(0, 0.9, -0.3), V(0, 0.78, -0.47), V(0, 0.6, -0.59), V(0, 0.4, -0.66), V(0, 0.2, -0.64)];
    const rad = [0.1, 0.165, 0.19, 0.155, 0.105], ch = ak.chain('abd', 'spine05', pts, { stiff: 0.07, damp: 0.93, gravity: 5, sway: 0.7 });
    for (let i = 0; i < 5; i++) {
      const a = pts[i], b = pts[i + 1], L = a.distanceTo(b), r = rad[i];
      const egg = G.lathe([[0, -L * 0.62], [r * 0.7, -L * 0.52], [r, -L * 0.1], [r * 0.95, L * 0.25], [r * 0.7, L * 0.52], [0, L * 0.62]], S(14, 8), 0, TAU, 34);
      add('dark', limb(egg, a, b, 0.5, { s: [1, 1, 0.92] }), ch.bones[i].name, { color: i === 1 || i === 2 ? CHM : CHD });
      add('marble', limb(G.band(r * 0.96, 0.028, 0.014, { seg: S(16, 9), bevel: 0.4 }), a, b, 0.0), ch.bones[i].name, { color: WAX_D });   // anillo de cera entre segmentos
      add('light', limb(G.torus(r * 0.97, 0.0032, 3, S(16, 9)), a, b, 0.0, { off: [0, 0.014, 0] }), ch.bones[i].name, { color: CORAL });
      if (i >= 1 && i <= 3) add('crystal', limb(flat(new T.IcosahedronGeometry(r * 0.72, low ? 0 : 1)), a, b, 0.5, { s: [0.95, 0.8, 0.5], off: [0, 0, -r * 0.62] }), ch.bones[i].name, { color: (x, y) => C(HONEY_D).lerp(C(CORAL), clamp01(0.4 + (y - 0.7) * 1.2)) });   // ventana de miel: se ven las larvas dentro
      if (i >= 1 && i <= 2 && !low) { cell(ch.bones[i].name, a.clone().lerp(b, 0.5).add(V(r * 0.9, 0.03, 0.02)), V(1, 0.1, 0.1), 0.05, 0.026, { honeyC: HONEY }); cell(ch.bones[i].name, a.clone().lerp(b, 0.5).add(V(-r * 0.9, 0.03, 0.02)), V(-1, 0.1, 0.1), 0.05, 0.026, { honeyC: HONEY }); }
    }
    // aguijón: lanza de quitina oscura curvada hacia arriba, con la punta de jalea
    const tip = pts[5], sd = has('aguijon') ? 1.8 : 1;
    add('dark', G.tube([pts[4].clone().lerp(pts[5], 0.4), tip, tip.clone().add(V(0, -0.1 * sd, 0.02)), tip.clone().add(V(0, -0.25 * sd, 0.12 * sd))], 0.045, 0.004, { radial: S(7, 5), tubular: S(12, 8), ridges: 3, ridgeAmp: 0.14, ease: 0.9 }), ch.bones[5].name, { color: CHD });
    add('light', G.sphere(0.012, 5, 4).translate(tip.x, tip.y - 0.25 * sd, tip.z + 0.12 * sd), ch.bones[5].name, { color: CORAL });
    ak.collider('spine05', V(0, 0.86, 0.0), V(0, 0.98, 0.0), 0.14);
  }

  // ═══════════════════════════ CUATRO ALAS DE MEMBRANA ÁMBAR (zumban): par superior grande y par inferior corto; venas de quitina y borde de jalea
  const wings = [];
  const wingGeo = (L, Wf, Wb, theta, psi, hub) => {
    const n = low ? 7 : 11, top = [], bot = [];
    for (let i = 0; i <= n; i++) { const s = i / n; top.push([s * L, Wf * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.9)]); bot.push([s * L, -Wb * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.9)]); }
    const poly = [...top, ...bot.slice(1, -1).reverse()], place = (g) => X(g, { r: [0, psi, theta], p: [hub.x, hub.y, hub.z] });
    return { poly, top, bot, place };
  };
  const mkWing = (nm, L, Wf, Wb, theta, psi, hub, o = {}) => ak.both((side) => {
    const w = wingGeo(L, Wf, Wb, theta, psi, hub), bn = ak.bone(nm + side, 'spine01', hub);
    add('crystal', w.place(G.plate(w.poly, 0.004, 0.0014)), bn.name, { color: (x, y, z) => { const d = Math.hypot(x - hub.x, y - hub.y, z - hub.z) / L; return C(0xe8960c).lerp(C(0xa84a04), clamp01(d * 1.2 - 0.2)).lerp(C(0xc42030), clamp01((d - 0.72) * 2.8)).multiplyScalar(0.5); } });
    const nv = low ? 3 : 5;   // venas radiales desde la raíz al borde de fuga
    for (let k = 0; k <= nv; k++) { const s = 0.3 + 0.66 * (k / nv), tail = w.bot[Math.min(w.bot.length - 1, Math.round(s * (w.bot.length - 1)))]; add('dark', w.place(G.tube([V(0, 0, 0.004), V(tail[0] * 0.5, tail[1] * 0.35, 0.006), V(tail[0], tail[1] * 0.97, 0.004)], 0.0045 - k * 0.0003, 0.0022, { radial: 3, tubular: 5, closeStart: false })), bn.name, { color: CH_D }); }
    add('dark', w.place(G.tube(w.top.map((q) => V(q[0], q[1] * 0.96, 0.005)), 0.0085, 0.003, { radial: S(5, 4), tubular: S(10, 8), closeStart: true })), bn.name, { color: CH });   // vena costal gruesa
    add('light', w.place(G.tube(w.bot.slice(2).map((q) => V(q[0], q[1] * 0.98, 0.005)), 0.0024, 0.0016, { radial: 3, tubular: S(12, 8), closeStart: false })), bn.name, { color: CORAL });   // filo de jalea
    if (o.barbs) for (let k = 1; k <= (low ? 2 : 4); k++) { const q = w.bot[Math.round(w.bot.length * (0.3 + k * 0.15))] || w.bot[w.bot.length - 2]; add('dark', w.place(X(G.cone(0.012, 0.08, 4), { p: [q[0], q[1], 0.004], r: [0, 0, Math.PI + 0.3] })), bn.name, { color: CH_D }); }   // púas del borde (Nube)
    wings.push({ b: bn, s: side === 'L' ? 1 : -1, ph: o.ph ?? 0, amp: o.amp ?? 0.08, base: o.base ?? 0 });
  });
  const wk = 1 + 0.08 * evo + (has('nube') ? 0.25 : 0) + (has('reina') ? 0.12 : 0);
  mkWing('alaA', 0.95 * wk, 0.1 * wk, 0.27 * wk, 0.95, 0.5, V(0.045, 1.4, -0.1), { ph: 0, amp: 0.09, base: 0.0, barbs: has('nube') });
  mkWing('alaB', 0.62 * wk, 0.07 * wk, 0.19 * wk, 0.25, 0.7, V(0.04, 1.33, -0.11), { ph: 1.7, amp: 0.1, base: 0.0, barbs: has('nube') });
  upd.push((dt, tt, c) => {
    const sp = Math.min(1, ((c && c.speed) || 0) / 8), buzz = 0.04 + 0.2 * sp;   // quietas al reposo (leve aleteo); al correr zumban
    for (const w of wings) { const f = 7 + 30 * sp; w.b.rotation.set(0.06 * Math.sin(tt * 1.3 + w.ph), -w.s * 0.08 * sp, w.s * (w.base + (w.amp * 0.5 + buzz) * Math.sin(tt * f + w.ph) + 0.05 * Math.sin(tt * 1.1 + w.ph))); }
  });

  // ═══════════════════════════ BRAZOS PEQUEÑOS plegados sobre el vientre (cadena de muelles) y MANTO de membrana
  ak.both(() => {
    const ap = [V(0.1, 1.1, 0.1), V(0.17, 1.06, 0.19), V(0.19, 1.0, 0.27), V(0.12, 1.0, 0.31), V(0.04, 1.03, 0.3)];
    const ch = ak.chain('brazo', 'spine03', ap, { stiff: 0.1, damp: 0.9, gravity: 1.5, sway: 0.5 });
    for (let i = 0; i < 4; i++) add('dark', G.tube([ap[i], ap[i + 1]], 0.019 - i * 0.003, 0.016 - i * 0.003, { radial: S(5, 4), tubular: 2, ridges: 3, ridgeAmp: 0.15 }), ch.bones[i].name, { color: i % 2 ? CHL : CHM });
    add('marble', spikeAt(ap[4], V(-1, -0.2, 0.6), 0.075, 0.009, 0.01, Y, { radial: S(4, 3) }), ch.bones[4].name, { color: WAX });
    add('marble', spikeAt(ap[4], V(-0.6, 0.3, 1), 0.065, 0.008, 0.01, Y, { radial: S(4, 3) }), ch.bones[4].name, { color: WAX_D });
  });
  {
    const cols = [], lens = [], r2 = t.rng(21);
    for (let j = 0; j < 9; j++) { const a = -Math.PI * 0.95 + (j / 8) * Math.PI * 1.9; cols.push({ bone: 'spine05', p: V(Math.sin(a) * 0.125, 0.95, Math.cos(a) * 0.1) }); lens.push((a > -1.1 && a < 1.1 ? 0.42 : 0.34) + (r2() - 0.5) * 0.12); }
    ak.cloth({ top: cols, dir: V(0, -1, 0), lens, rows: S(8, 5), color: new T.Color(2.6, 0.45, 0.8), hem: new T.Color(3.2, 0.5, 0.35), gravity: 8, stiff: 0.03, drag: 0.98, wave: 0.02, ember: 1 });
  }

  // ═══════════════════════════ PIERNAS: grebas de quitina con rodillera de panal, espolón trasero y pies con tres garras
  ak.both(() => {
    const H = P('upperleg01'), K = P('lowerleg01'), A = P('foot'), TO = P('toe3-1');
    add('dark', limb(G.tube([V(0, 0.2, 0), V(0, -0.2, 0)], 0.128, 0.088, { radial: S(7, 5), tubular: 2 }), H, K, 0.5), 'upperleg01', { color: CHM });
    for (const u of low ? [0.25, 0.7] : [0.2, 0.45, 0.7]) add('marble', limb(G.band(0.08 - u * 0.02, 0.022, 0.01, { seg: S(10, 7) }), H, K, u), 'upperleg01', { color: WAX_D });
    t.armorPlate('upperleg01', [[-0.05, 0.13], [0.05, 0.13], [0.065, 0.0], [0.04, -0.13], [0, -0.16], [-0.04, -0.13], [-0.065, 0.0]], { mat: 'dark', depth: 0.026, bevel: 0.009, wrap: { rx: 0.108, rz: 0.104 }, color: CHL, trim: 'ember', trimColor: CORAL, trimInset: 0.16, place: (g) => limb(g, H, K, 0.4, { r: [0, -Math.PI / 2 + 0.15, 0] }) });
    cell('lowerleg01', K.clone().add(V(0.0, 0.04, 0.085)), V(0, 0.15, 1), 0.058, 0.032, { honeyC: HONEY, toward: Y });   // rodillera de panal
    add('dark', limb(G.tube([V(0, 0.2, 0), V(0, -0.2, 0)], 0.092, 0.058, { radial: S(7, 5), tubular: 2, ridges: 3, ridgeAmp: 0.12 }), K, A, 0.5), 'lowerleg01', { color: CHM });
    t.armorPlate('lowerleg01', [[0, 0.1], [0.045, 0.06], [0.05, -0.04], [0.02, -0.12], [-0.02, -0.12], [-0.05, -0.04], [-0.045, 0.06]], { mat: 'marble', depth: 0.022, bevel: 0.008, wrap: { rx: 0.062, rz: 0.066 }, color: WAX, trim: 'ember', trimColor: CORAL, trimInset: 0.2, place: (g) => limb(g, K, A, 0.42) });
    add('dark', spikeAt(K.clone().add(V(-0.01, -0.12, -0.05)), V(0, -0.4, -1), 0.15, 0.02, 0.02, Y, { radial: S(5, 4), ridges: 3 }), 'lowerleg01', { color: CHL });   // espolón
    add('light', ringAt_(K, A, 0.78, 0.062), 'lowerleg01', { color: CORAL });
    add('dark', X(G.box(0.1, 0.07, 0.2, 0.02, 1), { p: [A.x, 0.07, 0.07] }), 'foot', { color: CHD });
    for (let k = -1; k <= 1; k += (low ? 2 : 1)) add('marble', spikeAt(V(TO.x + k * 0.032, 0.045, 0.14), V(k * 0.18, -0.12, 1), 0.12, 0.014, 0.012, Y, { radial: S(5, 4) }), 'toe3-1', { color: WAX });
    function ringAt_(a, b, u, R) { return t.ringAt(a, b, u, R, 0.012, 0.005); }
  });

  // ═══════════════════════════ NUBE DE POLEN Y LUCES
  ak.embers(HONEY_L, low ? 18 : 40, { radius: 0.75, height: 2.3, size: 4.5 });
  ak.embers(CORAL, low ? 6 : 14, { radius: 0.55, height: 2.0, size: 4 });

  // ═══════════════════════════ EVOLUCIÓN POR CAMINO (ids de colmena-data.js)
  const drone = (bone, p, sc = 1, ang = 0) => {   // zángano pequeño: cuerpo, cabeza, dos alas y ojo de jalea
    add('dark', X(G.sphere(0.022 * sc, 6, 4), { p: [p.x, p.y, p.z], s: [1, 0.85, 1.5] }), bone, { color: CH });
    add('marble', X(G.sphere(0.015 * sc, 5, 4), { p: [p.x, p.y + 0.004 * sc, p.z + 0.03 * sc] }), bone, { color: WAX });
    add('light', X(G.sphere(0.006 * sc, 4, 3), { p: [p.x, p.y + 0.008 * sc, p.z + 0.042 * sc] }), bone, { color: CORAL });
    for (const s of [-1, 1]) add('crystal', X(G.plate([[0, 0], [0.05 * sc, 0.012 * sc], [0.07 * sc, -0.01 * sc], [0.03 * sc, -0.02 * sc]], 0.002, 0.0006), { p: [p.x + s * 0.012 * sc, p.y + 0.016 * sc, p.z - 0.005 * sc], r: [0.5, s * 0.5 + (s < 0 ? Math.PI : 0), 0.15 + ang] }), bone, { color: HONEY_L });
  };
  if (has('criador')) {   // panal de larvas en la espalda + dos bolsas de huevos en las caderas
    const cells = flower(1, 0.056);
    cells.forEach((c, i) => { if (low && i > 4) return; cell('spine02', V(c.x, 1.14 + c.y, -0.15 - c.ring * 0.01), V(0, 0.1, -1), 0.052, 0.026, { honey: true, honeyC: i % 2 ? HONEY : HONEY_L, core: i % 3 === 0 ? CORAL : null, wax: WAX, toward: Y }); });
    ak.both(() => { const o = V(0.2, 0.9, -0.1); add('marble', G.sphere(0.075, S(9, 6), S(7, 5)).translate(o.x, o.y, o.z), 'spine05', { color: WAX_D }); add('crystal', X(G.sphere(0.06, S(8, 5), S(6, 4)), { p: [o.x + 0.02, o.y, o.z - 0.02] }), 'spine05', { color: HONEY }); add('light', X(G.sphere(0.022, 6, 4), { p: [o.x + 0.03, o.y, o.z - 0.03], s: [1, 1.4, 1] }), 'spine05', { color: CORAL }); });
  }
  if (has('aguijon')) {   // lanzas de veneno en los antebrazos
    ak.both(() => {
      const E0 = P('lowerarm01'), W0 = P('wrist');
      add('dark', limb(G.tube([V(0, 0, 0), V(0.0, 0.2, 0.0), V(0.0, 0.42, 0.06), V(0.0, 0.62, 0.2)], 0.03, 0.004, { radial: S(6, 4), tubular: S(14, 9), ridges: 3, ridgeAmp: 0.16 }), E0, W0, 1.05, { off: [-0.03, 0, -0.045] }), 'wrist', { color: CHD });
      add('light', limb(G.sphere(0.011, 5, 4).translate(0.0, 0.62, 0.2), E0, W0, 1.05, { off: [-0.03, 0, -0.045] }), 'wrist', { color: CORAL });
      for (let k = 0; k < (low ? 1 : 3); k++) add('dark', spikeAt(P('spine01').add(V(0.12 + k * 0.05, 0.14 - k * 0.02, -0.16 - k * 0.02)), V(0.4 + k * 0.4, 1, -0.7), 0.2 - k * 0.04, 0.02, 0.03, Zv, { radial: S(5, 4) }), 'spine01', { color: CH });
    });
  }
  if (has('nidos')) {   // dos bocas-torreta que brotan de la espalda
    ak.both(() => {
      const b0 = V(0.14, 1.44, -0.21), d = V(0.35, 1, -0.45).normalize();
      add('dark', X(G.lathe([[0.03, 0], [0.05, 0.05], [0.04, 0.14], [0.075, 0.24], [0.062, 0.26], [0.032, 0.17], [0.022, 0.05], [0.0, 0.0]], S(10, 7), 0, TAU, 30), { q: basisQ(d, Zv), p: [b0.x, b0.y, b0.z] }), 'spine01', { color: CHM });
      add('light', X(G.sphere(0.034, S(8, 5), S(6, 4)), { p: [b0.x + d.x * 0.22, b0.y + d.y * 0.22, b0.z + d.z * 0.22] }), 'spine01', { color: CORAL });
      add('marble', X(G.band(0.07, 0.022, 0.012, { seg: S(10, 7) }), { q: basisQ(d, Zv), p: [b0.x + d.x * 0.1, b0.y + d.y * 0.1, b0.z + d.z * 0.1] }), 'spine01', { color: WAX });
      ak.halo('spine01', V(b0.x + d.x * 0.24, b0.y + d.y * 0.24, b0.z + d.z * 0.24), HONEY_L, 0.18, 0.4);
    });
  }
  if (has('cohabita')) {   // zánganos posados en hombros y brazos + venas de jalea fundidas con el cuerpo
    ak.both(() => {
      const S0 = P('upperarm01'), E0 = P('lowerarm01');
      drone('spine01', V(S0.x + 0.04, S0.y + 0.2, S0.z + 0.05), 1.6, 0.2); drone('spine01', V(S0.x + 0.17, S0.y + 0.11, S0.z - 0.02), 1.3, -0.1); if (!low) drone('upperarm01', V(E0.x + 0.07, E0.y + 0.1, E0.z + 0.07), 1.2, 0.3);
      add('light', seam([S0.clone().add(V(0.02, 0.07, 0.07)), S0.clone().lerp(E0, 0.4).add(V(0.05, 0.02, 0.07)), S0.clone().lerp(E0, 0.8).add(V(0.07, 0.0, 0.065)), E0.clone().add(V(0.06, -0.03, 0.05))], 0.0034), 'upperarm01', { color: CORAL });
    });
    add('light', seam([V(0, 1.4, 0.15), V(0.06, 1.33, 0.17), V(0.04, 1.24, 0.17), V(0, 1.15, 0.15)], 0.0036), 'spine01', { color: CORAL });
  }
  if (has('detonador')) {   // glándulas de carga que laten (el cristal brilla con uBeat)
    const gl = [[V(0.11, 1.22, -0.17), 0.055], [V(-0.11, 1.18, -0.17), 0.05], [V(0.17, 0.98, -0.1), 0.045], [V(-0.17, 1.0, -0.1), 0.045]];
    gl.forEach(([p, r], i) => { if (low && i > 1) return; add('crystal', G.sphere(r, S(9, 6), S(7, 5)).translate(p.x, p.y, p.z), i < 2 ? 'spine02' : 'spine05', { color: i % 2 ? 0xff5a22 : CORAL }); add('marble', G.band(r * 0.78, 0.014, 0.008, { seg: S(10, 7) }).rotateX(Math.PI / 2).translate(p.x, p.y, p.z - r * 0.8), i < 2 ? 'spine02' : 'spine05', { color: WAX_D }); });
    for (let k = 0; k < (low ? 1 : 3); k++) add('ember', t.crackLine(V(-0.12 + k * 0.1, 1.38, -0.2), V(-0.08 + k * 0.08, 1.14, -0.17), { n: 6, jag: 0.012, r: 0.003, seed: 9 + k }), 'spine01', { color: k % 2 ? HONEY_L : CORAL });
  }
  if (has('reina')) {   // corona de panal: abanico de columnas hexagonales de cera y miel que irradian sobre la frente + manto largo
    const n = low ? 5 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 2.3, ca = Math.cos(a), sa = Math.sin(a), hgt = 0.1 + 0.07 * ca * ca, rr = 0.12;
      const base = V(sa * rr, HC.y + 0.06 + ca * rr * 0.8, HC.z + 0.03 - Math.abs(a) * 0.025), d = V(sa * 0.95, ca, 0.3).normalize();
      cell('head', base.clone().addScaledVector(d, hgt * 0.5), d, 0.03 + 0.013 * ca, hgt, { honeyC: i % 2 ? HONEY_L : CORAL, wax: i === (n >> 1) ? WAX : WAX_D, toward: Zv });
    }
    add('light', G.torus(0.118, 0.004, 3, S(18, 9)).scale(1, 1, 1.2).translate(HC.x, HC.y + 0.1, HC.z), 'head', { color: HONEY_L });
    const cols = [], lens = [];   // manto largo de la Reina, de hombro a hombro
    for (let j = 0; j < 8; j++) { const x = -0.22 + (j / 7) * 0.44; cols.push({ bone: j < 1 ? 'clavicle_R' : j > 6 ? 'clavicle_L' : 'spine01', p: V(x, 1.42 - Math.abs(x) * 0.15, -0.16) }); lens.push(0.95 + 0.25 * Math.cos((j / 7 - 0.5) * 2.4)); }
    ak.cloth({ top: cols, dir: V(0, -1, -0.1), lens, rows: S(10, 6), color: new T.Color(2.4, 0.3, 0.6), hem: new T.Color(3.6, 2.0, 0.3), gravity: 7, stiff: 0.012, drag: 0.982, wave: 0.03, ember: 1 });
  }
  if (has('plaga')) {   // enjambre orbitando + dos sacos más en el abdomen
    const nD = low ? 5 : 9, centers = [], orbit = [];
    for (let i = 0; i < nD; i++) { const a = (i / nD) * TAU, p0 = V(Math.cos(a) * 0.62, 1.1 + 0.5 * Math.sin(i * 1.7), Math.sin(a) * 0.62), bn = ak.bone('dron' + i, 'spine02', p0); drone(bn.name, p0, 1.5, 0); centers.push(p0); orbit.push({ b: bn, a, k: 0.7 + 0.12 * (i % 4), h: p0.y }); }
    const sp2 = P('spine02');
    upd.push((dt, tt) => { orbit.forEach((o, i) => { const a = o.a + tt * o.k, rr = 0.62 + 0.08 * Math.sin(tt * 1.3 + i), p = V(Math.cos(a) * rr, o.h + 0.12 * Math.sin(tt * 2.1 + i * 1.3), Math.sin(a) * rr), p0 = centers[i]; o.b.position.set(p0.x - sp2.x + (p.x - p0.x), p0.y - sp2.y + (p.y - p0.y), p0.z - sp2.z + (p.z - p0.z)); o.b.rotation.y = -a; }); });
    for (const [y, z, r] of [[0.64, -0.5, 0.075], [0.7, -0.2, 0.06]]) add('crystal', G.sphere(r, S(9, 6), S(7, 5)).translate(0.19, y, z), 'abd2', { color: HONEY });
    ak.embers(0xd8402f, low ? 8 : 16, { radius: 0.9, height: 2.2, size: 4 });
  }
  if (has('nube')) ak.embers(HONEY_L, low ? 14 : 30, { radius: 1.05, height: 2.0, size: 5.5 });

  upd.push((dt, tt) => void tt);
  return { update: (dt, tt, c) => upd.forEach((f) => f(dt, tt, c)) };
}
