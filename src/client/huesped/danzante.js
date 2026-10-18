// DANZANTE — el espíritu de baile del limbo (docs/HUESPEDES_ARTE.md). Un esqueleto de carnaval que no deja de bailar: calavera-máscara de azúcar con ojos de dos colores, penacho de plumas
// con ojos de pavo real, corsé de huesos tallados con lazo de listones, banda cruzada, falda de tiras, faja y cola de gala con física, ocho cintas largas que flotan de muñecas,
// tobillos y cintura, y una RUEDA de plumas a la espalda (un solo abanico central: nada que ver con las alas de Seraf). Paleta propia: hueso, fucsia, turquesa, cempasúchil y ciruela.
// Evolución visible por nivel: más cintas (1), penacho y rueda más grandes (2), brillo y flores en órbita (3) y la rueda de máscaras giratoria (4).
// Se escribe en el marco del modelo (pose de enlace); el lado izquierdo (+x) va dentro de ak.both().
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';

export const BELLY = 1; // vientre de luz de cempasúchil entre las costillas
const BONE = 0xeadfc6, BONE_D = 0xb9a98a, FUC = 0xff3fa0, FUC_D = 0xa8125f, TUR = 0x2fe6d0, TUR_D = 0x0b8a86, MAR = 0xffb020, MAR_D = 0xd9780a, PLUM = 0x2f1040, PLUM_L = 0x5a2272, INK = 0x0b0614;
const CYC = [FUC, TUR, MAR];   // el ciclo de colores de las cintas
const LK = 0.86;   // las cintas y plumas brillan por sí solas: se bajan un poco para que el bloom no las vuelva pastel

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, ringAt, dome, cuff, bonelump, S, low } = t, P = (n) => ak.P(n), add = ak.add;
  const HC = V(0, 1.6, 0.06), Y = V(0, 1, 0), Zv = V(0, 0, 1), upd = [], R = t.rng(77), evo = ctx.evo | 0;
  const C = (h) => new T.Color(h);
  {  // materiales: la tela algo apagada, y el oro vivo (si no, los aros de la evolución salen marrones)
    const mc = ak.material('cloth'), mg = ak.material('gold'); mc.color.setRGB(0.9, 0.8, 0.95);
    mg.color.setRGB(1.8, 1.2, 0.45); mg.roughness = 0.5; mg.metalness = 0.8; mg.normalScale.set(0.22, 0.22); mg.userData.uvk = 0.45;
  }

  // ───────────────────────── utilidades de diseño
  /** Hoja lenticular (pluma / pétalo / cinta con punta): base en el origen, eje +Y, plana en XY. */
  const leaf = (len, w, th = 0.004, n = low ? 3 : 5, tip = 0.75) => {   // malla plana de doble cara con un lomo central (8 triángulos por tramo): barata y se ve bien con luz propia
    const pos = [], idx = [];
    for (let i = 0; i <= n; i++) { const u = i / n, hw = Math.max(0.0005, (w / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, tip)), 0.8) * (1 - 0.1 * u)); pos.push(-hw, u * len, 0, 0, u * len, th, hw, u * len, 0); }
    for (let i = 0; i < n; i++) { const a = i * 3, b = a + 3; idx.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2); idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  /** Disco plano de doble cara (ojos de pluma, centros de flor): n lados. */
  const disc = (r, n = 6) => { const a = new T.CircleGeometry(r, n), b = a.clone(); b.scale(1, 1, -1); const ib = b.index.array; for (let i = 0; i < ib.length; i += 3) { const k = ib[i + 1]; ib[i + 1] = ib[i + 2]; ib[i + 2] = k; } return G.merge([a, b]); };
  /** Tira plana de doble cara (cuatro triángulos). */
  const strip = (wa, wb, L) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-wa / 2, 0, 0, wa / 2, 0, 0, -wb / 2, L, 0, wb / 2, L, 0], 3)); g.setIndex([0, 1, 2, 2, 1, 3, 0, 2, 1, 2, 3, 1]); g.computeVertexNormals(); return g; };
  /** Degradado base→punta a lo largo de `dir` (largo L). */
  const grad = (base, dir, L, c0, c1, k = 1) => { const a = C(c0), b = C(c1), c = new T.Color(); return (x, y, z) => { const u = Math.min(1, Math.max(0, ((x - base.x) * dir.x + (y - base.y) * dir.y + (z - base.z) * dir.z) / L)); return c.copy(a).lerp(b, Math.pow(u, k)).multiplyScalar(LK); }; };
  /** Pluma con ojo de pavo real en la punta. */
  function plume(bone, base, dir, len, w, c0, c1, o = {}) {
    const d = dir.clone().normalize(), g = leaf(len, w, 0.004, low ? 3 : 5);
    X(g, { q: t.basisQ(d, o.toward || Zv), p: [base.x, base.y, base.z] });
    add(o.mat || 'light', g, bone, { color: grad(base, d, len, c0, c1, o.k || 1.3) });
    if (o.eye !== false) {
      const tp = base.clone().addScaledVector(d, len * 0.86), q = t.basisQ(d, o.toward || Zv);
      const nz = V(0, 0, 0.0012).applyQuaternion(q);
      add('light', X(disc(w * 0.34, low ? 6 : 9), { q, p: [tp.x, tp.y, tp.z], s: [1, 1.25, 1] }), bone, { color: o.eyeC ?? MAR });
      add('light', X(disc(w * 0.2, low ? 5 : 8), { q, p: [tp.x + nz.x, tp.y + nz.y, tp.z + nz.z], s: [1, 1.25, 1] }), bone, { color: o.eyeD ?? PLUM_L });
      if (!low) add('light', X(disc(w * 0.11, 5), { q, p: [tp.x + nz.x * 2, tp.y + nz.y * 2, tp.z + nz.z * 2], s: [1, 1.25, 1] }), bone, { color: o.eyeI ?? TUR });
    }
    return g;
  }
  /** CINTA con física: cadena de huesos con una tira plana por tramo (ancho w → w2), colores en degradado. */
  let ribN = 0;
  function ribbon(parent, base, dir, len, w, segs, c0, c1, o = {}) {
    const d = dir.clone().normalize(), n = segs, pts = [];
    for (let i = 0; i <= n; i++) pts.push(base.clone().addScaledVector(d, (len * i) / n).add(V(0, -(o.droop || 0) * (i / n) * (i / n), 0)));
    const ch = ak.chain('cinta' + ribN++, parent, pts, { stiff: o.stiff ?? 0.075, damp: 0.94, gravity: o.grav ?? 3.2, sway: o.sway ?? 1.7 });
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[i + 1], dd = b.clone().sub(a), L = dd.length(), wa = w * (1 - 0.35 * (i / n)), wb = w * (1 - 0.35 * ((i + 1) / n)) * (i === n - 1 ? 0.25 : 1);
      const g = strip(wa, wb, L);
      X(g, { q: t.basisQ(dd, o.toward || Zv), p: [a.x, a.y, a.z] });
      const k0 = i / n, k1 = (i + 1) / n, ca = C(c0), cb = C(c1);
      add(o.mat || 'light', g, ch.bones[i].name, { color: (x, y, z) => { const u = Math.min(1, Math.max(0, ((x - a.x) * dd.x + (y - a.y) * dd.y + (z - a.z) * dd.z) / (L * L))); return new T.Color().copy(ca).lerp(cb, k0 + (k1 - k0) * u).multiplyScalar(LK); } });
    }
    return ch;
  }
  /** Flor de cempasúchil: dos coronas de pétalos y un corazón de luz. */
  function flower(bone, c, s = 1, nx = V(0, 0, 1), col = MAR) {
    const q = t.basisQ(nx, Y), cc = V().copy(c);
    for (let k = 0; k < (low ? 1 : 2); k++) add('light', X(G.torus(0.024 * s - k * 0.006 * s, 0.0125 * s, low ? 3 : 4, low ? 6 : 11).rotateX(Math.PI / 2), { q, p: [cc.x + nx.x * k * 0.006 * s, cc.y + nx.y * k * 0.006 * s, cc.z + nx.z * k * 0.006 * s] }), bone, { color: k ? 0xffd070 : col });
    add('light', X(G.sphere(0.011 * s, 5, 4), { p: [cc.x + nx.x * 0.012 * s, cc.y + nx.y * 0.012 * s, cc.z + nx.z * 0.012 * s] }), bone, { color: FUC });
  }
  // ───────────────────────── cráneo: radio del casco a una altura y z delante del casco en (x, y)
  const SH = [[-0.075, 0.1], [-0.035, 0.108], [0.015, 0.112], [0.07, 0.105], [0.113, 0.086], [0.139, 0.054], [0.152, 0.018], [0.155, 0]];
  const rAt = (y) => { if (y <= SH[0][0]) return SH[0][1]; for (let i = 1; i < SH.length; i++) if (y <= SH[i][0]) { const a = SH[i - 1], b = SH[i], u = (y - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * u; } return 0; };
  const fz = (x, y) => 1.2 * Math.sqrt(Math.max(0, rAt(y) * rAt(y) - x * x));
  const fp = (x, y, out = 0.004) => V(x * (1 + out * 4), HC.y + y, HC.z + fz(x, y) + out);
  const sline = (list, r, o = 0.004) => G.tube(list.map(([x, y]) => fp(x, y, o)), r, r, { radial: 3, tubular: Math.max(4, list.length * (low ? 2 : 4)), closeStart: true });

  // ═══════════════════════════ CALAVERA DE CARNAVAL
  {
    const shell = G.lathe(SH.map(([y, r]) => [r, y]), S(16, 10), 0, Math.PI * 2, 34); X(shell, { p: [HC.x, HC.y, HC.z], s: [1, 1, 1.2] });
    add('bone', shell, 'head', { color: BONE });
    // frente y pómulos tallados
    ak.both(() => {
      add('bone', X(bonelump(0.03, [1.3, 0.8, 0.8], 5, 0.18), { p: [0.062, HC.y - 0.05, HC.z + fz(0.062, -0.05) - 0.004] }), 'head', { color: BONE });   // pómulo
      // cuenca del ojo: hueco oscuro + aro de fucsia + pupila de luz (un ojo turquesa y el otro fucsia: heterocromía)
      const ex = 0.046, ey = 0.004, ez = fz(ex, ey);
      add('dark', X(G.sphere(0.028, S(8, 6), S(6, 5)), { p: [ex, HC.y + ey, HC.z + ez - 0.002], s: [1, 1.18, 0.5] }), 'head', { color: INK });
      add('light', X(G.torus(0.0285, 0.0036, 3, S(14, 8)).rotateX(Math.PI / 2), { p: [ex, HC.y + ey, HC.z + ez + 0.008], s: [1, 1.18, 1] }), 'head', { color: FUC });
      add('light', X(G.sphere(0.0085, 5, 4), { p: [ex, HC.y + ey - 0.002, HC.z + ez + 0.004] }), 'head', { color: TUR });
      // pétalos de azúcar alrededor del ojo
      const np = low ? 4 : 8;
      for (let i = 0; i < np; i++) { const a = -0.4 + (i / (np - 1)) * (Math.PI * 1.7); const px = ex + Math.cos(a) * 0.043, py = ey + Math.sin(a) * 0.05; add('light', sline([[ex + Math.cos(a) * 0.033, ey + Math.sin(a) * 0.04], [px, py]], 0.0029, 0.0035), 'head', { color: i % 2 ? MAR : TUR }); add('light', X(G.sphere(0.0046, 4, 3), { p: [fp(px, py, 0.004).x, fp(px, py, 0.004).y, fp(px, py, 0.004).z] }), 'head', { color: i % 2 ? FUC : MAR }); }
      // enredadera turquesa que baja por la mejilla
      add('light', sline([[0.075, -0.018], [0.082, -0.04], [0.074, -0.06], [0.062, -0.078], [0.07, -0.098]], 0.0028), 'head', { color: TUR });
      add('light', sline([[0.052, -0.03], [0.058, -0.052], [0.05, -0.066]], 0.0024), 'head', { color: MAR });
      // pendiente de hueso con lazo
      add('bone', X(G.sphere(0.012, 5, 4), { p: [0.108, HC.y - 0.035, HC.z - 0.01] }), 'head', { color: BONE_D });
      add('light', X(G.cone(0.01, 0.07, 4).rotateX(Math.PI), { p: [0.108, HC.y - 0.04, HC.z - 0.01] }), 'head', { color: TUR });
    });
    // nariz (dos fosas) y frente con flor de azúcar
    for (const s of [-1, 1]) add('dark', X(G.sphere(0.0105, 5, 4), { p: [s * 0.0085, HC.y - 0.04, HC.z + fz(0.0085, -0.04) - 0.001], s: [0.8, 1.5, 0.6], r: [0, 0, s * 0.3] }), 'head', { color: INK });
    add('light', X(G.cone(0.01, 0.026, 3), { p: [0, HC.y + 0.0, HC.z + fz(0, 0.0) + 0.002], r: [0, 0, Math.PI] }), 'head', { color: MAR });
    flower('head', fp(0, 0.07, 0.006), 0.9, V(0, 0.3, 1).normalize(), FUC);
    // dientes: fila superior (8) y mandíbula inferior con fila de dientes y una rendija oscura entre ambas
    add('dark', X(t.box(0.1, 0.02, 0.03, 0.004, 1), { p: [0, HC.y - 0.092, HC.z + fz(0, -0.092) - 0.012] }), 'head', { color: INK });
    for (let i = -3; i <= 3; i++) { const x = i * 0.0125; add('bone', X(t.box(0.0105, 0.026, 0.01, 0.003, 1), { p: [x, HC.y - 0.077, HC.z + fz(x, -0.077) + 0.001], r: [0, -x * 2.2, 0] }), 'head', { color: BONE }); }
    const jaw = G.wrapE(G.plate([[-0.062, 0.02], [0.062, 0.02], [0.052, -0.03], [0, -0.05], [-0.052, -0.03]], 0.02, 0.006), 0.098, 0.12);
    X(jaw, { p: [HC.x, HC.y - 0.118, HC.z - 0.006] }); add('bone', jaw, 'jaw', { color: BONE_D });
    for (let i = -3; i <= 3; i++) { const x = i * 0.0125; add('bone', X(t.box(0.0095, 0.02, 0.009, 0.003, 1), { p: [x, HC.y - 0.1, HC.z + fz(x, -0.1) - 0.003], r: [0, -x * 2.2, 0] }), 'jaw', { color: BONE }); }
    add('light', sline([[-0.04, -0.126], [-0.02, -0.136], [0, -0.139], [0.02, -0.136], [0.04, -0.126]], 0.0027, 0.002), 'jaw', { color: FUC });

    // ─ penacho: banda de hueso con flores y un abanico de plumas (dos capas) con ojos de pavo real; todo en un hueso extra que se mece
    const hub = V(0, HC.y + 0.1, HC.z - 0.015), pen = ak.bone('penacho', 'head', hub);
    add('bone', X(G.band(0.108, 0.036, 0.012, { seg: S(20, 10), sz: 1.2, simple: low }), { p: [HC.x, HC.y + 0.082, HC.z] }), 'penacho', { color: BONE_D });
    add('light', G.torus(0.111, 0.0042, 3, S(22, 10)).scale(1, 1, 1.2).translate(HC.x, HC.y + 0.1, HC.z), 'penacho', { color: FUC });
    flower('penacho', V(0.07, HC.y + 0.1, HC.z + 0.1), 1.1, V(0.5, 0.2, 1).normalize(), MAR); flower('penacho', V(-0.07, HC.y + 0.1, HC.z + 0.1), 0.8, V(-0.5, 0.2, 1).normalize(), TUR);
    const big = evo >= 2 ? 1.18 : 1, nIn = low ? 5 : 7, nOut = low ? 4 : 6;
    for (let i = 0; i < nOut; i++) { const a = ((i - (nOut - 1) / 2) / ((nOut - 1) / 2)) * 1.25, L = (0.5 - Math.abs(a) * 0.13) * big; plume('penacho', hub.clone().add(V(Math.sin(a) * 0.05, 0, -0.03)), V(Math.sin(a), Math.cos(a) * 1.15, -0.28), L, 0.1, i % 2 ? TUR_D : FUC_D, i % 2 ? TUR : FUC, { eyeC: i % 2 ? FUC : TUR, eyeI: MAR }); }
    for (let i = 0; i < nIn; i++) { const a = ((i - (nIn - 1) / 2) / ((nIn - 1) / 2)) * 0.95, L = (0.62 - Math.abs(a) * 0.2) * big; plume('penacho', hub.clone().add(V(Math.sin(a) * 0.03, 0.01, -0.012)), V(Math.sin(a), Math.cos(a) * 1.3, -0.12), L, 0.09, i % 2 ? FUC : TUR, i % 2 ? MAR : FUC, { k: 1.6, eyeC: MAR, eyeI: FUC }); }
    if (evo >= 2) for (const s of [-1, 1]) plume('penacho', hub.clone().add(V(s * 0.08, -0.02, -0.02)), V(s * 1.0, 0.45, -0.2), 0.34, 0.08, TUR_D, MAR, { eyeC: FUC });
    upd.push((dt, tt, c) => { const sp = Math.min(1, (c && c.speed || 0) / 7); pen.rotation.z = Math.sin(tt * 1.6) * 0.05; pen.rotation.x = -0.1 * sp + Math.sin(tt * 1.1) * 0.025; });
    // dos cintas largas que caen de la banda a los lados de la cara
    ak.both(() => { ribbon('head', V(0.1, HC.y + 0.05, HC.z - 0.02), V(0.25, -1, -0.12), 0.7, 0.06, low ? 4 : 5, FUC, TUR, { stiff: 0.06, sway: 2.1 }); });
    // gorguera: pétalos de cinta alrededor del cuello
    const nn = low ? 7 : 11;
    for (let i = 0; i < nn; i++) { const a = (i / nn) * Math.PI * 2, rr = 0.09, d = V(Math.sin(a) * 0.7, 0.45, Math.cos(a) * 0.7 - 0.05); const g = leaf(0.085, 0.045, 0.004, 3); X(g, { q: t.basisQ(d, V(0, 1, 0)), p: [Math.sin(a) * rr, 1.43, 0.03 + Math.cos(a) * rr * 0.85] }); add('light', g, 'neck01', { color: i % 2 ? MAR : FUC }); }
  }

  // ═══════════════════════════ TORSO: corsé de huesos tallados con lazo, banda cruzada, faja y flor-corazón
  {
    const zc = 0.045;
    // costillas talladas (arcos abiertos al frente, tres altos) sobre el vientre de luz
    for (let i = 0; i < (low ? 4 : 6); i++) {
      const y = 1.125 + i * (low ? 0.062 : 0.044), k = 1 + 0.045 * Math.sin(i * 1.1), cz = 0.058 - i * 0.002;
      add('bone', G.torus(0.134 * k, 0.0096, S(4, 3), S(22, 12)).scale(1, 1, 0.8).translate(0, y, cz), i < 2 ? 'spine03' : 'spine02', { color: BONE_D });
      add('bone', G.cone(0.01, 0.034, 4).rotateX(Math.PI / 2).translate(0, y, cz + 0.134 * 0.8 * k - 0.004), i < 2 ? 'spine03' : 'spine02', { color: BONE });
    }
    // columna vertebral y paletillas
    for (let i = 0; i < (low ? 4 : 7); i++) add('bone', X(bonelump(0.021, [1.2, 0.72, 0.9], 3 + i, 0.2), { p: [0, 1.4 - i * (low ? 0.07 : 0.045), -0.085 - 0.004 * Math.sin(i)] }), i < 3 ? 'spine01' : i < 5 ? 'spine02' : 'spine03', { color: BONE });
    // peto de hueso tallado en el pecho (dos hojas) con filetes de luz
    ak.both(() => {
      t.armorPlate('spine01', [[0.012, 0.1], [0.07, 0.112], [0.13, 0.082], [0.146, 0.01], [0.118, -0.058], [0.06, -0.084], [0.012, -0.06]], { mat: 'bone', depth: 0.024, bevel: 0.009, wrap: { rx: 0.172, rz: 0.12 }, place: (g) => X(g, { p: [0, 1.31, zc - 0.002], r: [0.07, 0, 0] }), color: BONE, trim: 'ember', trimInset: 0.14, trimR: 0.0032 });
      add('light', seam([V(0.024, 1.402, 0.164), V(0.07, 1.418, 0.156), V(0.126, 1.384, 0.134), V(0.148, 1.31, 0.098)], 0.0036), 'spine01', { color: FUC });
      add('light', seam([V(0.03, 1.372, 0.17), V(0.066, 1.372, 0.162), V(0.104, 1.34, 0.146)], 0.0028), 'spine01', { color: TUR });
      // hombrera de flores: casquete de hueso + corona de pétalos de cempasúchil
      const S0 = P('upperarm01'), sc = S0.clone().add(V(0.034, 0.05, 0));
      add('bone', X(dome(0.07, 0.05, { lip: 0.3, seg: S(10, 7) }), { p: [sc.x, sc.y, sc.z], r: [0, 0, -0.45] }), 'upperarm01', { color: BONE });
      const npet = low ? 7 : 11;
      for (let i = 0; i < npet; i++) { const a = (i / npet) * Math.PI * 2, d = V(Math.cos(a) * 0.9, 0.35, Math.sin(a) * 0.9); const g = leaf(0.085, 0.04, 0.004, 3); X(g, { q: t.basisQ(d, V(0, 1, 0)), p: [sc.x + Math.cos(a) * 0.07, sc.y + 0.02, sc.z + Math.sin(a) * 0.07] }); add('light', g, 'upperarm01', { color: i % 2 ? MAR : 0xffd070 }); }
      add('light', X(G.sphere(0.022, 6, 5), { p: [sc.x, sc.y + 0.05, sc.z] }), 'upperarm01', { color: FUC });
      // ojales del corsé (anillos) en el borde del pecho
    });
    // lazo central: cruces de cinta entre los dos bordes del peto (zigzag) + moño
    const nz = low ? 3 : 5;
    for (let i = 0; i < nz; i++) {
      const y0 = 1.39 - i * 0.052, y1 = y0 - 0.052, zf = (y) => 0.17 - Math.abs(y - 1.3) * 0.12;
      add('light', G.tube([V(-0.04, y0, zf(y0)), V(0, (y0 + y1) / 2 + 0.01, zf(y0) + 0.012), V(0.04, y1, zf(y1))], 0.0042, 0.0042, { radial: 3, tubular: 5, closeStart: true }), 'spine01', { color: i % 2 ? TUR : FUC });
      add('light', G.tube([V(0.04, y0, zf(y0)), V(0, (y0 + y1) / 2 + 0.01, zf(y0) + 0.012), V(-0.04, y1, zf(y1))], 0.0042, 0.0042, { radial: 3, tubular: 5, closeStart: true }), 'spine01', { color: i % 2 ? FUC : TUR });
      add('gold', G.torus(0.008, 0.0026, 3, 6).rotateX(Math.PI / 2).translate(-0.042, y0, zf(y0)), 'spine01'); add('gold', G.torus(0.008, 0.0026, 3, 6).rotateX(Math.PI / 2).translate(0.042, y0, zf(y0)), 'spine01');
    }
    // flor-corazón: núcleo de luz en el esternón
    flower('spine01', V(0, 1.268, 0.196), 1.7, V(0, 0, 1), MAR);
    ak.halo('spine01', V(0, 1.268, 0.24), FUC, 0.5, 0.55);
    // banda cruzada (hombro izquierdo → cadera derecha): cinta ancha de tela con flecos de cinta que caen
    const bp = [V(0.1, 1.42, 0.07), V(0.07, 1.36, 0.17), V(-0.02, 1.2, 0.2), V(-0.11, 1.04, 0.18), V(-0.16, 0.96, 0.1)];
    add('cloth', G.tube(bp, 0.03, 0.03, { radial: 4, tubular: S(14, 8), sx: 1, sz: 0.2, closeStart: true }), 'spine02', { color: FUC_D });
    add('light', G.tube(bp.map((p) => p.clone().add(V(0, 0, 0.007))), 0.007, 0.007, { radial: 3, tubular: S(14, 8), sx: 1, sz: 0.6, closeStart: true }), 'spine02', { color: MAR });
    for (let i = 0; i < 3; i++) ribbon('spine05', V(-0.16 + i * 0.03, 0.95, 0.09), V(-0.2, -1, 0.08), 0.55 - i * 0.07, 0.034, low ? 3 : 4, MAR, FUC, { stiff: 0.07, sway: 1.9 });
    // faja turquesa con hebilla de calavera-flor
    add('cloth', G.band(0.18, 0.07, 0.02, { seg: S(20, 10), sz: 0.78 }).translate(0, 0.95, zc + 0.01), 'spine05', { color: TUR_D });
    for (const y of [0.99, 0.91]) add('light', G.torus(0.182, 0.0042, 3, S(20, 10)).scale(1, 1, 0.78).translate(0, y, zc + 0.01), 'spine05', { color: MAR });
    flower('spine05', V(0, 0.95, 0.196), 1.35, V(0, 0, 1), FUC);
    // falda de tiras: cintas colgando alrededor de las caderas
    const nsk = low ? 8 : 12;
    for (let i = 0; i < nsk; i++) {
      const a = (i / nsk) * Math.PI * 2, rr = 0.19; if (Math.abs(Math.sin(a)) < 0.2 && Math.cos(a) < 0) continue;   // el hueco de atrás es para la cola
      ribbon('spine05', V(Math.sin(a) * rr, 0.92, 0.045 + Math.cos(a) * rr * 0.85), V(Math.sin(a) * 0.25, -1, Math.cos(a) * 0.25), 0.42 + 0.08 * Math.sin(i * 2.1), 0.066, low ? 3 : 4, CYC[i % 3], CYC[(i + 1) % 3], { stiff: 0.1, sway: 1.2, grav: 4 });
    }
  }

  // ═══════════════════════════ BRAZOS Y MANOS: guantes de hueso tallado, puños de volado y cintas largas
  ak.both(() => {
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist');
    t.armorPlate('upperarm01', [[-0.04, 0.09], [0.04, 0.09], [0.034, -0.08], [-0.034, -0.08]], { mat: 'bone', depth: 0.014, bevel: 0.005, wrap: { rx: 0.07, rz: 0.075 }, color: BONE_D, trim: 'ember', trimInset: 0.2, place: (g) => limb(g, S0, E0, 0.5) });
    for (const tt of [0.18, 0.82]) add('light', ringAt(S0, E0, tt, 0.066 - (tt - 0.18) * 0.04, 0.012, 0.005), 'upperarm01', { color: tt < 0.5 ? FUC : TUR });
    // codo con púa de hueso y flor
    add('bone', spikeAt(E0.clone().add(V(0.06, 0.0, -0.04)), V(1, 0.2, -0.8), 0.09, 0.016, 0.02, Y), 'lowerarm01', { color: BONE });
    // antebrazo: guante largo de hueso con una espiral de cinta
    const fl = W0.distanceTo(E0);
    t.armorPlate('lowerarm01', [[-0.03, 0.095], [0.03, 0.095], [0.024, -0.09], [-0.024, -0.09]], { mat: 'bone', depth: 0.014, bevel: 0.005, wrap: { rx: 0.062, rz: 0.066 }, color: BONE, trim: 'ember', trimInset: 0.18, place: (g) => limb(g, E0, W0, 0.5) });
    const hx = []; for (let i = 0; i <= 14; i++) { const u = i / 14, a = u * Math.PI * 4.4; hx.push(V(Math.cos(a) * 0.058, (u - 0.5) * 0.9, Math.sin(a) * 0.062)); }
    add('light', limb(G.tube(hx, 0.0046, 0.0046, { radial: 3, tubular: S(34, 18), closeStart: true }), E0, W0, 0.5, { s: [1, fl * 0.92, 1] }), 'lowerarm01', { color: FUC });
    // puño de volado (campana de tela) y aro de flores en la muñeca
    add('cloth', limb(cuff(0.052, 0.112, 0.09, 0.012, S(14, 8), 30), E0, W0, 0.93), 'lowerarm01', { color: PLUM_L });
    add('light', ringAt(E0, W0, 0.985, 0.113, 0.01, 0.005), 'lowerarm01', { color: MAR });
    // mano: dedos con anillos
    for (const f of ['finger2', 'finger3', 'finger4']) { const a = P(`${f}-2`), b = P(`${f}-3`); add('bone', limb(t.box(0.02, a.distanceTo(b) * 1.05, 0.016, 0.005, 1), a, b, 0.55), `${f}-2`, { color: BONE }); }
    add('light', X(G.torus(0.013, 0.0035, 3, 6).rotateZ(Math.PI / 2), { p: [P('finger3-2').x, P('finger3-2').y, P('finger3-2').z] }), 'finger3-2', { color: MAR });
    // cintas de la muñeca: dos por mano, largas
    ribbon('wrist', W0.clone().add(V(0.02, 0, 0)), V(0.5, -0.5, -0.7), 1.0, 0.08, low ? 5 : 6, FUC, TUR, { stiff: 0.05, sway: 2.4, grav: 2.4 });
    ribbon('wrist', W0.clone().add(V(0.02, 0, 0)), V(0.2, -0.7, 0.55), 0.85, 0.07, low ? 5 : 6, TUR, MAR, { stiff: 0.05, sway: 2.2, grav: 2.4 });
    if (evo >= 1) ribbon('wrist', W0.clone().add(V(0.02, 0, 0)), V(0.9, -0.1, -0.1), 1.15, 0.06, low ? 5 : 7, MAR, FUC, { stiff: 0.04, sway: 2.8, grav: 1.8 });
    if (evo >= 3 && !low) ribbon('lowerarm01', E0.clone().add(V(0.04, 0, -0.04)), V(0.8, 0.0, -0.5), 0.8, 0.06, 6, TUR, FUC, { stiff: 0.05, sway: 2.6, grav: 1.8 });
  });

  // ═══════════════════════════ PIERNAS: grebas de hueso, cintas de ballet en espiral, flores en las rodillas, zapatos de punta
  ak.both(() => {
    const H = P('upperleg01'), K = P('lowerleg01'), A = P('foot'), TO = P('toe3-1'), ll = K.distanceTo(A), ul = H.distanceTo(K);
    add('bone', limb(cuff(0.09, 0.07, ul * 0.45, 0.012, S(12, 7), 28), H, K, 0.3), 'upperleg01', { color: BONE_D });
    add('light', ringAt(H, K, 0.12, 0.092, 0.012, 0.005), 'upperleg01', { color: FUC });
    t.armorPlate('upperleg01', [[-0.04, 0.1], [0.04, 0.1], [0.034, -0.1], [-0.034, -0.1]], { mat: 'bone', depth: 0.014, bevel: 0.005, wrap: { rx: 0.082, rz: 0.088 }, color: BONE, trim: 'ember', trimInset: 0.18, place: (g) => limb(g, H, K, 0.62) });
    // rodilla: casquete de hueso y flor
    add('bone', X(dome(0.056, 0.04, { lip: 0.3, seg: S(9, 6) }), { p: [K.x, K.y, K.z + 0.052], r: [Math.PI / 2, 0, 0] }), 'lowerleg01', { color: BONE });
    flower('lowerleg01', V(K.x, K.y + 0.0, K.z + 0.1), 1.0, V(0, 0, 1), MAR);
    // pantorrilla: espiral de cinta de ballet que sube del tobillo
    const sp = []; for (let i = 0; i <= 16; i++) { const u = i / 16, a = u * Math.PI * 5.2; sp.push(V(Math.cos(a) * (0.066 - 0.012 * u), (u - 0.5) * 0.95, Math.sin(a) * (0.07 - 0.012 * u))); }
    add('light', limb(G.tube(sp, 0.0058, 0.0058, { radial: 3, tubular: S(40, 20), closeStart: true }), K, A, 0.5, { s: [1, ll * 0.95, 1] }), 'lowerleg01', { color: TUR });
    add('bone', limb(cuff(0.062, 0.05, ll * 0.7, 0.01, S(10, 6), 25), K, A, 0.52), 'lowerleg01', { color: BONE_D });
    // moño en el tobillo con dos colas de cinta
    for (const sg of [-1, 1]) add('light', X(leaf(0.07, 0.04, 0.004, 3), { p: [A.x + sg * 0.01, A.y + 0.07, A.z + 0.07], r: [0.4, 0, sg * 1.3] }), 'foot', { color: FUC });
    add('light', X(G.sphere(0.014, 5, 4), { p: [A.x, A.y + 0.07, A.z + 0.07] }), 'foot', { color: MAR });
    ribbon('foot', V(A.x, A.y + 0.06, A.z + 0.05), V(0.1, -0.5, -1), 0.6, 0.05, low ? 4 : 5, FUC, MAR, { stiff: 0.1, sway: 1.4, grav: 2 });
    ribbon('foot', V(A.x, A.y + 0.06, A.z + 0.05), V(-0.1, -0.2, -1), 0.5, 0.045, low ? 4 : 5, TUR, FUC, { stiff: 0.1, sway: 1.4, grav: 2 });
    // zapato de baile: puntera de hueso y suela
    const shoe = G.plate([[-0.06, 0.0], [-0.065, 0.07], [-0.03, 0.105], [0.03, 0.105], [0.09, 0.07], [0.19, 0.035], [0.225, 0.008], [0.19, 0.0]], 0.088, 0.02, { crease: 50 });
    X(shoe, { r: [0, -Math.PI / 2, 0] }); X(shoe, { p: [A.x + 0.005, 0.0, 0.0] }); add('leather', shoe, 'foot', { color: PLUM });
    add('bone', X(G.plate([[0.12, 0.07], [0.19, 0.04], [0.225, 0.01], [0.19, 0.0], [0.12, 0.02]], 0.09, 0.012, { crease: 50 }), { r: [0, -Math.PI / 2, 0], p: [A.x + 0.005, 0.012, 0.0] }), 'foot', { color: BONE });
    add('light', G.torus(0.062, 0.0045, 3, S(12, 7)).translate(A.x, A.y + 0.045, A.z), 'foot', { color: MAR });
  });

  // ═══════════════════════════ ESPALDA: rueda de plumas, cola de gala y colas de frac con tela
  {
    const hubB = V(0, 1.22, -0.13), rue = ak.bone('rueda', 'spine02', hubB);
    add('bone', X(G.cyl(0.062, 0.07, 0.04, S(10, 7)), { p: [hubB.x, hubB.y, hubB.z - 0.02], r: [Math.PI / 2, 0, 0] }), 'rueda', { color: BONE_D });
    add('light', X(G.torus(0.075, 0.006, 3, S(14, 8)), { p: [hubB.x, hubB.y, hubB.z - 0.045], r: [Math.PI / 2, 0, 0] }), 'rueda', { color: MAR });
    flower('rueda', V(0, hubB.y, hubB.z - 0.05), 1.8, V(0, 0, -1), FUC);
    const nf = (low ? 7 : 9) + (evo >= 2 ? 2 : 0);
    for (let i = 0; i < nf; i++) {
      const a = ((i - (nf - 1) / 2) / ((nf - 1) / 2)) * 1.32, L = (1.05 - Math.abs(a) * 0.3) * (evo >= 2 ? 1.1 : 1), d = V(Math.sin(a), Math.cos(a), -0.42);
      plume('rueda', hubB.clone().add(V(0, 0, -0.05)), d, L, 0.14, CYC[(i + 1) % 3] === TUR ? TUR_D : FUC_D, CYC[i % 3], { toward: V(0, 0, -1), eyeC: CYC[(i + 2) % 3], eyeI: CYC[i % 3], k: 1.5 });
    }
    // segunda capa más corta, mirando hacia arriba, de otro color
    for (let i = 0; i < (low ? 4 : 6); i++) { const a = ((i - ((low ? 4 : 6) - 1) / 2) / (((low ? 4 : 6) - 1) / 2)) * 0.9; plume('rueda', hubB.clone().add(V(0, 0.01, -0.07)), V(Math.sin(a), Math.cos(a), -0.6), 0.62 - Math.abs(a) * 0.15, 0.1, MAR_D, MAR, { toward: V(0, 0, -1), eye: false }); }
    upd.push((dt, tt, c) => { const sp = Math.min(1, (c && c.speed || 0) / 7); rue.rotation.x = -0.18 * sp + Math.sin(tt * 1.2) * 0.04; rue.rotation.z = Math.sin(tt * 0.9) * 0.045; });
    // cola de gala: tela larga con dobladillo que brilla (física); y colas de frac más cortas a los lados
    const top = [], lens = [], nc = low ? 7 : 9;
    for (let j = 0; j < nc; j++) { const u = j / (nc - 1), x = -0.15 + u * 0.3; top.push({ bone: 'spine05', p: V(x, 0.93, -0.118 + 0.03 * Math.abs(x) / 0.15) }); lens.push(1.12 - 0.62 * Math.pow(Math.abs(u - 0.5) * 2, 1.5) + (j % 2) * 0.06); }   // punta de cola de gala (más larga en el centro)
    ak.cloth({ top, dir: V(0, -1, -0.3), lens, rows: S(11, 6), color: PLUM_L, hem: FUC, gravity: 7, stiff: 0.016, drag: 0.982, wave: 0.04, ember: 1.5 });
    for (const sg of [-1, 1]) { const t2 = [], l2 = []; for (let j = 0; j < 3; j++) { t2.push({ bone: 'spine05', p: V(sg * (0.17 + j * 0.03), 0.93, -0.03 - j * 0.04) }); l2.push(0.5 - j * 0.07); } ak.cloth({ top: t2, dir: V(sg * 0.35, -1, -0.15), lens: l2, rows: S(7, 4), color: TUR_D, hem: MAR_D, gravity: 7, stiff: 0.02, drag: 0.98, ember: 0.9 }); }
    ak.collider('spine02', V(0, 1.0, 0.045), V(0, 1.36, 0.045), 0.17); ak.collider('spine05', V(0, 0.86, 0.045), V(0, 0.98, 0.045), 0.185);
    ak.both(() => ak.collider('upperleg01', P('upperleg01'), P('lowerleg01'), 0.105));
    ak.embers(MAR, low ? 24 : 44, { radius: 0.55, height: 2.2, size: 5 });
  }

  // ═══════════════════════════ EVOLUCIÓN PROPIA: nivel 3 = flores en órbita, nivel 4 = rueda de máscaras giratoria
  if (evo >= 3) {
    const orb = ak.bone('orbita', 'spine05', V(0, 0.95, 0)), nfl = low ? 3 : 6;
    for (let i = 0; i < nfl; i++) { const a = (i / nfl) * Math.PI * 2; flower('orbita', V(Math.sin(a) * 0.46, 0.95 + 0.12 * Math.sin(i * 2), Math.cos(a) * 0.46), 1.1, V(Math.sin(a), 0, Math.cos(a)), CYC[i % 3]); }
    upd.push((dt, tt) => { orb.rotation.y = tt * 0.7; });
  }
  if (evo >= 4) {
    const hub = V(0, 1.4, -0.62), wh = ak.bone('ruedaMascaras', 'spine01', hub), nm = low ? 6 : 10, WR = 0.7;
    add('light', X(G.torus(WR, 0.008, 3, S(34, 16)), { p: [hub.x, hub.y, hub.z], r: [Math.PI / 2, 0, 0] }), 'ruedaMascaras', { color: FUC });
    add('light', X(G.torus(WR - 0.05, 0.0045, 3, S(34, 16)), { p: [hub.x, hub.y, hub.z], r: [Math.PI / 2, 0, 0] }), 'ruedaMascaras', { color: TUR });
    for (let i = 0; i < nm; i++) {   // calaveritas de azúcar con ojos de luz que giran con la rueda
      const a = (i / nm) * Math.PI * 2, c = V(hub.x + Math.cos(a) * WR, hub.y + Math.sin(a) * WR, hub.z);
      add('bone', X(G.sphere(0.066, S(8, 6), S(6, 5)), { p: [c.x, c.y, c.z], s: [0.85, 1, 0.5] }), 'ruedaMascaras', { color: BONE });
      for (const s of [-1, 1]) add('light', X(G.sphere(0.015, 4, 3), { p: [c.x + s * 0.024, c.y + 0.01, c.z - 0.03] }), 'ruedaMascaras', { color: CYC[i % 3] });
      add('light', X(leaf(0.26, 0.07, 0.004, 3), { q: t.basisQ(V(Math.cos(a), Math.sin(a), 0), Zv), p: [c.x + Math.cos(a) * 0.06, c.y + Math.sin(a) * 0.06, c.z] }), 'ruedaMascaras', { color: CYC[(i + 1) % 3] });
    }
    ak.halo('ruedaMascaras', hub, FUC, 1.6, 0.2);
    upd.push((dt, tt) => { wh.rotation.z = tt * 0.45; });
  }
  if (ctx.has('apoteosis')) {   // Apoteosis (propia): aureola de flores de cempasúchil sobre la cabeza, con un anillo de luz que gira
    const au = ak.bone('aureola', 'head', V(0, HC.y + 0.5, HC.z)), na = low ? 7 : 10;
    add('light', X(G.torus(0.26, 0.007, 3, S(30, 14)), { p: [0, HC.y + 0.5, HC.z] }), 'aureola', { color: MAR });
    for (let i = 0; i < na; i++) { const a = (i / na) * Math.PI * 2; flower('aureola', V(Math.sin(a) * 0.26, HC.y + 0.5, HC.z + Math.cos(a) * 0.26), 1.0, V(Math.sin(a) * 0.3, 1, Math.cos(a) * 0.3).normalize(), CYC[i % 3]); }
    ak.halo('aureola', V(0, HC.y + 0.5, HC.z), MAR, 0.9, 0.3);
    upd.push((dt, tt) => { au.rotation.y = tt * 0.9; });
  }
  const ev = addEvolution(ak, ctx, { t, skipApoteosis: true, pal: { bone: BONE_D, boneL: BONE, steel: 0xd9bdea, steelD: 0x9a6cb8 } });
  return { update: (dt, tt, c) => { upd.forEach((f) => f(dt, tt, c)); ev.update(dt, tt, c); } };
}
