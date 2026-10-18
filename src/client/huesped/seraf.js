// SERAF — ÁNGEL CAÍDO (docs/HUESPEDES_ARTE.md). Armadura y vestido de marfil y oro: casco-máscara de oro con rostro sereno y ojos de luz, peto y hombreras de placas de porcelana con filetes
// y filigrana de oro, núcleo que late con uBeat, ALAS DE LUZ de decenas de plumas sueltas (la izquierda entera, de luz dorada; la derecha quemada y rota, de ceniza y brasa) con física de
// muelles, aureola quebrada que gira, látigo de luz (cadena de muelles), falda/tabardo/velos con tela Verlet, cintas y plumas que caen. Silueta: esbelta, alas enormes en abanico y aureola.
// Se escribe en el marco del modelo (pose de enlace); el lado izquierdo (+x) va dentro de ak.both().
import * as T from 'three';
import { tools, V } from '../huesped-piezas.js';
import { addEvolution } from '../huesped-evo-piezas.js';
import { uBeat } from '../shaders.js';

export const BELLY = 1; // vientre de luz dorada entre las bandas del corsé
const IVORY = 0xeae0cf, IVORY_D = 0xcdbfa8, GOLD_L = 0xffd45a, GOLD_W = 0xfff3c8, AMBER = 0xff9a2a, ASH = 0x4c3e38, ASH_D = 0x1f1917, CREAM = 0xf0e6d2;

export function build(ak, ctx) {
  const t = tools(ak), { G, X, spikeAt, seam, limb, ringAt, dome, cuff, S, low } = t, P = (n) => ak.P(n), add = ak.add;
  const HC = V(0, 1.6, 0.06), Y = V(0, 1, 0), upd = [], R = t.rng(61), zc = 0.045, AP = ctx.has('apoteosis');
  const C = (h) => new T.Color(h);

  // ───────────────────────── utilidades de diseño
  const swirl = (cx, cy, r0, r1, a0, turns, n = 14, sg = 1) => { const o = []; for (let i = 0; i <= n; i++) { const u = i / n, a = a0 + sg * u * turns * Math.PI * 2, r = r0 + (r1 - r0) * u; o.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return o; };
  const filig = (curves, z, r = 0.0032) => G.merge(curves.map((c) => G.tube(c.map((q) => V(q[0], q[1], z)), r, r, { radial: low ? 3 : 4, tubular: Math.max(5, (c.length * (low ? 1.4 : 2.6)) | 0), closeStart: true })));
  /** Placa de porcelana con filete de oro (siempre, también en Baja) y filigrana opcional. */
  const gplate = (bone, pts, o = {}) => {
    const depth = o.depth ?? 0.02, bevel = o.bevel ?? depth * 0.34, r = o.r ?? 0.003;
    const fin = (g) => { let q = g; if (o.wrap) q = G.wrapE(q, o.wrap.rx, o.wrap.rz ?? o.wrap.rx); if (o.place) q = o.place(q) || q; return q; };
    add(o.mat || 'marble', fin(G.plate(pts, depth, bevel, { crease: o.crease ?? 38 })), bone, { color: o.color ?? IVORY });
    if (o.trim !== false) add('gold', fin(t.outline(pts, { inset: o.inset ?? 0.1, z: depth / 2 + r * 0.2, r })), bone);
    if (o.fil && !(low && o.filHigh)) add('gold', fin(filig(o.fil, depth / 2 + 0.002)), bone);
  };

  /** Pluma: geometría por tramos (un tramo por hueso de la cadena) con vena central; base en el origen, eje +Y. Devuelve [geometrías]. */
  function featherGeo({ len, w, segs = 1, rps = 3, curve = 0.0, lean = 0, trunc = 1, jag = 0, solid = false, rnd = R }) {
    const Ld = len * trunc, n = segs * rps, rows = [];
    const prof = (u) => { const a = Math.min(1, 0.4 + u * 3.2), e = u > 0.7 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.7) / 0.3, 2))) : 1; return a * e * (1 - 0.16 * u); };
    for (let i = 0; i <= n; i++) {
      const tt = i / n, u = tt * trunc, hw = (w / 2) * (trunc < 1 && i === n ? prof(u - 0.001) : prof(u)), y = tt * Ld, z = curve * tt * tt * Ld, tl = lean * tt * tt * w, jl = jag && tt > 0.5 ? 1 - jag * rnd() : 1, jr = jag && tt > 0.5 ? 1 - jag * rnd() : 1;
      rows.push({ y, z, l: -hw * jl + tl, r: hw * jr + tl, m: tl, th: 0.006 * (1 - tt * 0.7), droop: hw * 0.16 });
    }
    const out = [];
    for (let s = 0; s < segs; s++) {
      const pos = [], idx = [], k0 = s * rps, k1 = (s + 1) * rps, rr = k1 - k0 + 1;
      for (let i = k0; i <= k1; i++) { const q = rows[i]; pos.push(q.l, q.y, q.z - q.droop, q.m, q.y, q.z + q.th, q.r, q.y, q.z - q.droop); }
      for (let i = 0; i < rr - 1; i++) { const a = i * 3, b = a + 3; idx.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2); }
      let g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      if (solid) { const g2 = g.clone(); const ix = g2.index.array; for (let i = 0; i < ix.length; i += 3) { const a = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = a; } g.computeVertexNormals(); g2.computeVertexNormals(); g = G.merge([g, g2]); } else g.computeVertexNormals();
      out.push(g);
    }
    return { geos: out, Ld, local: (tt) => V(lean * tt * tt * w, tt * Ld, curve * tt * tt * Ld) };
  }
  const grad = (base, dir, Ld, w, c0, c1, k = 1, edge = 0.4) => { const c = new T.Color(); return (x, y, z) => { const dx = x - base.x, dy = y - base.y, dz = z - base.z, tt = Math.min(1, Math.max(0, (dx * dir.x + dy * dir.y + dz * dir.z) / Ld)), l = Math.min(1, Math.hypot(dx - dir.x * tt * Ld, dy - dir.y * tt * Ld, dz - dir.z * tt * Ld) / (w * 0.5)); return c.copy(c0).lerp(c1, Math.pow(tt, 0.8)).multiplyScalar(k * (1 - edge * l * l)); }; };
  /** Coloca una pluma. o: {mat, bone, base, dir, len, w, name (si es de cadena con física), color, rach (vena de luz), ...opciones de featherGeo} */
  function feather(o) {
    const segs = o.name ? (low ? 2 : 3) : 1, rps = o.name ? (low ? 2 : 3) : (low ? 3 : 4), f = featherGeo({ len: o.len, w: o.w, segs, rps, curve: o.curve ?? 0.06, lean: o.lean ?? 0, trunc: o.trunc ?? 1, jag: o.jag ?? 0, solid: !!o.solid });
    const qq = t.basisQ(o.dir, V(0, 0, 1)), at = (g) => X(g, { q: qq, p: [o.base.x, o.base.y, o.base.z] }); let bones = null, pts = null;
    if (o.name) { pts = []; for (let j = 0; j <= segs; j++) pts.push(f.local(j / segs).applyQuaternion(qq).add(o.base)); const ch = ak.chain(o.name, o.parent, pts, { stiff: o.stiff ?? 0.07, damp: 0.93, gravity: o.grav ?? 3, sway: o.sway ?? 1.3 }); bones = ch.bones.map((b) => b.name); }
    const colf = o.color || (() => 0xffffff);
    f.geos.forEach((g, j) => { at(g); add(o.mat, g, bones ? bones[j] : o.bone, { color: colf }); if (o.rach) { const tb = G.tube([pts ? pts[j] : f.local(j / segs).applyQuaternion(qq).add(o.base), pts ? pts[j + 1] : f.local((j + 1) / segs).applyQuaternion(qq).add(o.base)], o.rach.r ?? 0.0042, (o.rach.r ?? 0.0042) * 0.7, { radial: 3, tubular: 1, closeStart: false }); add('light', tb, bones ? bones[j] : o.bone, { color: o.rach.c }); } });
    return f;
  }

  // ═══════════════════════════ CASCO-MÁSCARA DE ORO: rostro sereno, ojos de luz, aletas hacia atrás, gema y collar de plumas
  {
    const shell = G.lathe([[0.1, -0.078], [0.108, -0.04], [0.112, 0.015], [0.105, 0.07], [0.087, 0.113], [0.054, 0.139], [0.018, 0.152], [0, 0.156]], S(16, 10), 0, Math.PI * 2, 34); X(shell, { p: [HC.x, HC.y, HC.z], s: [1, 1, 1.2] });
    add('gold', shell, 'head');
    // rostro: máscara ovalada con nariz fina, párpados bajos, mejillas y boca serena
    const face = G.wrapE(G.plate([[0, 0.078], [0.046, 0.068], [0.077, 0.034], [0.082, -0.016], [0.058, -0.07], [0.022, -0.108], [0, -0.116], [-0.022, -0.108], [-0.058, -0.07], [-0.082, -0.016], [-0.077, 0.034], [-0.046, 0.068]], 0.014, 0.005), 0.118, 0.143); X(face, { p: [HC.x, HC.y - 0.012, HC.z] });
    add('marble', face, 'head', { color: IVORY });
    add('gold', X(G.wrapE(t.outline([[0, 0.078], [0.046, 0.068], [0.077, 0.034], [0.082, -0.016], [0.058, -0.07], [0.022, -0.108], [0, -0.116], [-0.022, -0.108], [-0.058, -0.07], [-0.082, -0.016], [-0.077, 0.034], [-0.046, 0.068]], { inset: 0.02, z: 0.0075, r: 0.0036 }), 0.118, 0.143), { p: [HC.x, HC.y - 0.012, HC.z] }), 'head');
    add('gold', X(G.wrapE(G.plate([[0.0, 0.03], [0.012, 0.0], [0.014, -0.05], [0.0, -0.074], [-0.014, -0.05], [-0.012, 0.0]], 0.026, 0.008), 0.05, 0.151), { p: [HC.x, HC.y, HC.z] }), 'head'); // puente y nariz
    add('dark', X(G.wrapE(G.plate([[-0.02, 0.0], [0.02, 0.0], [0.014, -0.006], [-0.014, -0.006]], 0.012, 0.002), 0.03, 0.152), { p: [HC.x, HC.y - 0.056, HC.z] }), 'head', { color: 0x1a1008 });
    add('gold', X(G.wrapE(G.plate([[-0.03, 0.0], [0.03, 0.0], [0.022, -0.007], [0, -0.012], [-0.022, -0.007]], 0.014, 0.003), 0.03, 0.146), { p: [HC.x, HC.y - 0.087, HC.z] }), 'head'); // labios
    ak.both(() => {
      add('dark', X(G.wrapE(G.plate([[0.012, 0.012], [0.07, 0.016], [0.082, -0.006], [0.058, -0.022], [0.016, -0.014]], 0.012, 0.002), 0.114, 0.14), { p: [HC.x, HC.y + 0.0, HC.z] }), 'head', { color: 0x120a04 });
      add('light', X(G.wrapE(G.plate([[0.02, 0.003], [0.052, 0.01], [0.074, 0.002], [0.06, -0.011], [0.024, -0.007]], 0.012, 0.002), 0.115, 0.1405), { p: [HC.x, HC.y + 0.0, HC.z] }), 'head', { color: GOLD_W }); // ojo de luz (párpado bajo)
      add('gold', X(G.wrapE(G.plate([[0.01, 0.02], [0.06, 0.034], [0.095, 0.022], [0.088, 0.012], [0.06, 0.02], [0.012, 0.01]], 0.02, 0.005), 0.117, 0.143), { p: [HC.x, HC.y + 0.0, HC.z] }), 'head'); // ceja
      const ch = G.wrapE(G.plate([[0.004, 0.034], [0.05, 0.026], [0.092, -0.022], [0.07, -0.082], [0.03, -0.095], [0.004, -0.062]], 0.014, 0.005), 0.108, 0.136); X(ch, { p: [HC.x, HC.y - 0.015, HC.z], r: [0, 0.4, 0] });
      add('gold', ch, 'head');
      add('gold', G.cyl(0.04, 0.036, 0.014, S(10, 7)).rotateZ(Math.PI / 2).translate(0.114, HC.y - 0.01, HC.z - 0.005), 'head'); add('light', G.cyl(0.02, 0.02, 0.016, S(8, 6)).rotateZ(Math.PI / 2).translate(0.116, HC.y - 0.01, HC.z - 0.005), 'head', { color: GOLD_L });
      // aletas de oro hacia atrás (tres por lado), como alas de casco
      for (let i = 0; i < 3; i++) { const L = 0.3 - i * 0.065, d = V(0.45 + i * 0.12, 0.34 - i * 0.2, -0.9).normalize(); const g = featherGeo({ len: L, w: 0.058 - i * 0.008, segs: 1, rps: low ? 3 : 5, curve: -0.12, lean: 0.12, solid: true }).geos[0]; X(g, { q: t.basisQ(d, V(0, 1, 0.4)), p: [HC.x + 0.1, HC.y + 0.04 - i * 0.03, HC.z - 0.02] }); add('gold', g, 'head'); }
    });
    // corona: gema en la frente con filetes y una cresta de pétalos
    add('crystal', X(new T.OctahedronGeometry(0.019, 0), { p: [HC.x, HC.y + 0.066, HC.z + 0.149], s: [0.8, 1.25, 0.6] }), 'head', { color: GOLD_L });
    add('gold', X(G.torus(0.025, 0.0032, 3, S(10, 6)), { p: [HC.x, HC.y + 0.066, HC.z + 0.147], r: [Math.PI / 2, 0, 0], s: [0.9, 1, 1.35] }), 'head');
    add('gold', G.torus(0.109, 0.0042, 4, S(24, 12)).scale(1, 1, 1.2).translate(HC.x, HC.y + 0.082, HC.z), 'head');
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.33, L = 0.115 - Math.abs(i - 2) * 0.022, d = V(Math.sin(a) * 0.5, 1, Math.cos(a) * 0.5 - 0.35).normalize(); const g = featherGeo({ len: L, w: 0.03, segs: 1, rps: 3, solid: true }).geos[0]; X(g, { q: t.basisQ(d, V(0, 0, 1)), p: [HC.x + Math.sin(a) * 0.1, HC.y + 0.08, HC.z + 0.095 * Math.cos(a)] }); add('gold', g, 'head'); }
    add('marble', X(G.wrapE(G.plate([[0, 0.0], [0.05, 0.02], [0.05, 0.1], [0, 0.14], [-0.05, 0.1], [-0.05, 0.02]], 0.01, 0.004), 0.1, 0.13), { p: [HC.x, HC.y + 0.09, HC.z], r: [-0.55, 0, 0] }), 'head', { color: IVORY }); // placa de la coronilla
    // gorguera: collar alto de plumas de oro + aros
    for (let i = 0; i < 2; i++) add('gold', G.band(0.07 - i * 0.003, 0.026, 0.01, { seg: S(16, 8) }).translate(0, 1.446 + i * 0.026, 0.03), 'neck01');
    add('marble', G.band(0.077, 0.02, 0.01, { seg: S(16, 8) }).translate(0, 1.428, 0.03), 'neck01', { color: IVORY });
    const nn = low ? 7 : 11; for (let i = 0; i < nn; i++) { const a = Math.PI * (0.58 + i * (0.84 / (nn - 1))), c = (nn - 1) / 2, L = 0.1 + (1 - Math.abs(i - c) / c) * 0.05; const g = featherGeo({ len: L, w: 0.032, segs: 1, rps: 3, solid: true }).geos[0]; X(g, { q: t.basisQ(V(Math.sin(a) * 0.7, 1.0, Math.cos(a) * 0.7 - 0.15), V(Math.sin(a), 0, Math.cos(a))), p: [Math.sin(a) * 0.09, 1.452, 0.03 + Math.cos(a) * 0.09] }); add('gold', g, 'neck01'); }
  }

  // ═══════════════════════════ TORSO: peto de porcelana con filetes y filigrana de oro, corsé, núcleo
  {
    const chest = G.lathe([[0.165, 1.2], [0.176, 1.25], [0.18, 1.3], [0.17, 1.35], [0.145, 1.395], [0.105, 1.425], [0.092, 1.44]], S(14, 10), 0, Math.PI * 2, 30); X(chest, { p: [0, 0, zc - 0.005], s: [1, 1, 0.74] });
    add('marble', chest, 'spine01', { color: IVORY_D });
    ak.both(() => {
      const pts = [[0.012, 0.118], [0.075, 0.135], [0.145, 0.098], [0.158, 0.02], [0.13, -0.062], [0.07, -0.098], [0.012, -0.07]];
      gplate('spine01', pts, { depth: 0.028, bevel: 0.01, wrap: { rx: 0.172, rz: 0.12 }, place: (g) => X(g, { p: [0, 1.292, zc - 0.002], r: [0.07, 0, 0] }), inset: 0.13, r: 0.0034,
        fil: [swirl(0.092, 0.03, 0.044, 0.008, 0.4, 1.5, 16), swirl(0.052, -0.045, 0.026, 0.006, 3.5, 1.2, 12, -1), [[0.03, 0.095], [0.07, 0.108], [0.12, 0.085]], [[0.03, -0.018], [0.065, -0.012], [0.12, -0.02]]] });
      add('gold', seam([V(0.022, 1.212, 0.168), V(0.07, 1.218, 0.162), V(0.125, 1.238, 0.145), V(0.158, 1.285, 0.1)], 0.0034), 'spine01');
      add('marble', X(G.wrapE(G.plate([[0, 0.05], [0.09, 0.055], [0.12, 0.02], [0.1, -0.03], [0, -0.04]], 0.016, 0.006), 0.1, 0.085), { p: [0.0, 1.42, zc - 0.07], r: [0.9, 0.0, -0.16] }), 'clavicle', { color: IVORY });
      add('gold', X(G.torus(0.105, 0.0042, 3, S(14, 8)).scale(1, 1, 0.9), { p: [0.0, 1.43, zc - 0.07], r: [0.9, 0, -0.16] }), 'clavicle');
    });
    // esternón de oro con el núcleo y su jaula
    add('gold', X(G.wrapE(G.plate([[0.0, 0.135], [0.03, 0.1], [0.036, 0.0], [0.022, -0.1], [0, -0.14], [-0.022, -0.1], [-0.036, 0.0], [-0.03, 0.1]], 0.03, 0.01), 0.04, 0.152), { p: [0, 1.26, zc - 0.012] }), 'spine01');
    for (let i = 0; i < 3; i++) add('gold', G.torus(0.044 + i * 0.008, 0.0045, 4, S(16, 9)).rotateX(Math.PI / 2 + (i - 1) * 0.5).translate(0, 1.278, 0.196), 'spine01');
    add('light', G.sphere(0.03, S(10, 7), S(8, 6)).translate(0, 1.278, 0.199), 'spine01', { color: GOLD_W });
    add('crystal', X(new T.OctahedronGeometry(0.05, 0), { p: [0, 1.278, 0.202], s: [0.75, 1.2, 0.75] }), 'spine01', { color: GOLD_L });
    ak.halo('spine01', V(0, 1.278, 0.24), GOLD_L, 0.5, 0.5);
    // corsé: bandas de oro con rombos de porcelana sobre el vientre de luz
    for (let i = 0; i < 4; i++) { const y = 1.058 + i * 0.045, k = 1 + 0.03 * Math.sin(i * 1.3 + 0.3), cz = 0.058 - i * 0.003; add('gold', G.torus(0.128 * k, 0.0085, S(4, 3), S(24, 12)).scale(1, 1, 0.82).translate(0, y, cz), i < 2 ? 'spine03' : 'spine02'); }
    for (let i = 0; i < 3; i++) add('marble', X(new T.OctahedronGeometry(0.03, 0), { p: [0, 1.08 + i * 0.045, 0.058 - i * 0.003 + 0.128 * 0.82 + 0.002], s: [0.6, 1.0, 0.4] }), i < 1 ? 'spine03' : 'spine02', { color: IVORY });
    add('gold', G.tube([V(0, 1.2, -0.056), V(0, 1.12, -0.066), V(0, 1.04, -0.062)], 0.012, 0.01, { radial: 4, tubular: 8 }), 'spine02');
    // cinturón de oro con medallón de luz
    add('gold', G.band(0.178, 0.05, 0.02, { seg: S(20, 10), sz: 0.78 }).translate(0, 0.945, zc + 0.01), 'spine05');
    for (const y of [0.975, 0.915]) add('marble', G.torus(0.18, 0.004, 4, S(20, 10)).scale(1, 1, 0.78).translate(0, y, zc + 0.01), 'spine05', { color: IVORY });
    add('marble', t.box(0.09, 0.09, 0.028, 0.01, 1).translate(0, 0.945, 0.178), 'spine05', { color: IVORY });
    add('light', X(new T.OctahedronGeometry(0.026, 0), { p: [0, 0.945, 0.196], s: [0.8, 1.2, 0.5] }), 'spine05', { color: GOLD_L });
    add('gold', G.torus(0.036, 0.0036, 3, S(12, 7)).rotateX(Math.PI / 2).translate(0, 0.945, 0.194), 'spine05');
    // fáldares laterales y trasero: láminas de porcelana con filete de oro
    for (const [a0, n] of [[Math.PI * 0.5, 3], [Math.PI * 1.5, 3], [Math.PI, 3]]) for (let i = 0; i < n; i++) {
      const y = 0.925 - i * 0.043;
      gplate('spine05', [[-0.12, 0.0], [0.12, 0.0], [0.112, -0.052 - i * 0.008], [0.0, -0.075 - i * 0.012], [-0.112, -0.052 - i * 0.008]], { depth: 0.012, bevel: 0.004, wrap: { rx: 0.215 + i * 0.008, rz: 0.2 + i * 0.008 }, color: i === 1 ? IVORY_D : IVORY, r: 0.0026, inset: 0.1,
        place: (g) => X(g, { p: [0, y, zc], r: [0, a0, 0] }) });
    }
    // espaldar: placa con filigrana y los dos cubos de donde nacen las alas
    gplate('spine01', [[-0.13, 0.1], [0.13, 0.1], [0.15, 0.0], [0.09, -0.12], [0, -0.16], [-0.09, -0.12], [-0.15, 0.0]], { depth: 0.022, bevel: 0.008, wrap: { rx: 0.165, rz: 0.12 }, place: (g) => X(g, { p: [0, 1.29, zc], r: [0, Math.PI, 0] }), inset: 0.12, r: 0.0036,
      fil: [swirl(0.06, 0.02, 0.04, 0.008, 0, 1.4, 14), swirl(-0.06, 0.02, 0.04, 0.008, Math.PI, 1.4, 14), [[-0.1, -0.06], [0, -0.1], [0.1, -0.06]]] });
    for (const s of [-1, 1]) { const hx = s * 0.085; add('gold', X(G.cyl(0.045, 0.05, 0.03, S(10, 7)), { p: [hx, 1.34, -0.105], r: [Math.PI / 2, 0, 0] }), 'spine01'); add('light', X(G.sphere(0.02, 8, 6), { p: [hx, 1.34, -0.125], s: [1, 1, 0.6] }), 'spine01', { color: GOLD_L }); add('gold', X(G.torus(0.052, 0.005, 3, S(14, 8)), { p: [hx, 1.34, -0.12], r: [Math.PI / 2, 0, 0] }), 'spine01'); }
  }

  // ═══════════════════════════ HOMBRERAS, BRAZOS, MANOS
  ak.both(() => {
    const S0 = P('upperarm01'), E0 = P('lowerarm01'), W0 = P('wrist'), P0 = S0.clone().add(V(0.0, 0.055, 0.0));
    // hombrera laminada de porcelana (3 placas en arco) con filigrana, y un abanico de plumas de oro que sube por detrás
    for (let i = 0; i < 3; i++) {
      const R0 = 0.132 - i * 0.006, len = 0.15 + (i === 0 ? 0.04 : 0), wArc = 0.3 - i * 0.02, th = 0.02 - i * 0.002;
      gplate('upperarm01', [[-wArc / 2, 0.0], [-wArc * 0.5, len * 0.55], [-wArc * 0.3, len], [0, len * 1.08], [wArc * 0.3, len], [wArc * 0.5, len * 0.55], [wArc / 2, 0.0]], { depth: th, bevel: th * 0.38, wrap: { rx: R0, rz: R0 * 0.94 }, color: i === 1 ? IVORY_D : IVORY, inset: 0.1, r: 0.0028,
        fil: i === 0 ? [swirl(0, len * 0.55, 0.05, 0.01, 0.5, 1.3, 14), [[-0.09, len * 0.9], [0, len * 1.0], [0.09, len * 0.9]]] : null, filHigh: true,
        place: (g) => { X(g, { r: [-Math.PI / 2, 0, -Math.PI / 2] }); return X(g, { p: [P0.x + 0.02 + i * 0.04, P0.y - i * 0.035, P0.z], r: [0, 0, -0.1 - i * 0.2] }); } });
    }
    for (let i = 0; i < (low ? 3 : 5); i++) { const L = 0.27 - i * 0.04, d = V(0.25 + i * 0.28, 1.0 - i * 0.12, -0.55 - i * 0.05).normalize(); const g = featherGeo({ len: L, w: 0.065 - i * 0.006, segs: 1, rps: low ? 3 : 5, curve: -0.1, solid: true }).geos[0]; X(g, { q: t.basisQ(d, V(0, 0, 1)), p: [P0.x + 0.07, P0.y + 0.07, P0.z - 0.05 + i * 0.012] }); add('gold', g, 'upperarm01'); }
    for (let i = 0; i < 3; i++) { add('marble', limb(cuff(0.1 - i * 0.008, 0.092 - i * 0.008, 0.06, 0.012, S(10, 7), 30), S0, E0, 0.2 + i * 0.15, { s: [1.08, 1, 1] }), 'upperarm01', { color: i === 1 ? IVORY : IVORY_D }); add('gold', ringAt(S0, E0, 0.2 + i * 0.15 + 0.03, 0.1 - i * 0.008, 0.007, 0.004, { sx: 1.08 }), 'upperarm01'); }
    add('gold', ringAt(S0, E0, 0.76, 0.068, 0.04, 0.012), 'upperarm01'); add('light', ringAt(S0, E0, 0.76, 0.0705, 0.004, 0.003), 'upperarm01', { color: GOLD_L });
    add('gold', X(dome(0.054, 0.05, { lip: 0.3, seg: S(9, 6), crease: 30 }), { p: [E0.x + 0.03, E0.y + 0.0, E0.z - 0.035], r: [0, 0, -Math.PI / 2 + 0.2] }), 'lowerarm01');
    // antebrazo: guante largo de porcelana con placa dorsal, filetes y alerón de oro hacia atrás
    const fl = W0.distanceTo(E0);
    add('marble', limb(cuff(0.064, 0.05, fl * 0.84, 0.012, S(8, 6), 25), E0, W0, 0.5), 'lowerarm01', { color: IVORY });
    gplate('lowerarm01', [[-0.03, 0.09], [0.03, 0.09], [0.024, -0.09], [-0.024, -0.09]], { depth: 0.014, bevel: 0.005, wrap: { rx: 0.063, rz: 0.067 }, color: IVORY_D, inset: 0.16, place: (g) => limb(g, E0, W0, 0.55), fil: [[[0, 0.07], [0.012, 0.03], [-0.012, -0.01], [0, -0.06]]], filHigh: true });
    for (const tt of [0.08, 0.92]) add('gold', ringAt(E0, W0, tt, 0.058 - (tt - 0.08) * 0.03, 0.012, 0.005), 'lowerarm01');
    for (let i = 0; i < 3; i++) { const L = 0.3 - i * 0.07, d = V(0.45 + i * 0.1, 0.12 + i * 0.1, -1.0).normalize(); const g = featherGeo({ len: L, w: 0.062 - i * 0.008, segs: 1, rps: low ? 3 : 5, curve: -0.08, solid: true, lean: 0.1 }).geos[0]; X(g, { q: t.basisQ(d, V(0, 1, 0)), p: [E0.x + 0.075, E0.y - 0.015 - i * 0.04, E0.z - 0.04 + i * 0.03] }); add('gold', g, 'lowerarm01'); }
    // mano: dorso de oro y dedos de uñas largas y finas
    const F3 = P('finger3-1');
    add('gold', limb(t.box(0.09, 0.1, 0.018, 0.007, 1), W0, F3, 0.5, { off: [-0.04, 0, 0], r: [0, Math.PI / 2, 0] }), 'wrist');
    for (const [f, len, r] of [['finger2', 0.085, 0.0075], ['finger3', 0.11, 0.008], ['finger4', 0.095, 0.0075], ['finger5', 0.07, 0.0065]]) {
      const a = P(`${f}-2`), b = P(`${f}-3`), d = b.clone().sub(a).normalize();
      add('gold', spikeAt(b.clone().addScaledVector(d, 0.004), d.clone().add(V(0, -0.1, 0.1)), len, r, -0.012, V(0, 0.4, 0.2), { radial: 4 }), `${f}-3`);
      add('marble', limb(t.box(0.02, a.distanceTo(b) * 1.1, 0.016, 0.006, 1), a, b, 0.55, { off: [-0.006, 0, 0] }), `${f}-2`, { color: IVORY });
    }
    { const a = P('finger1-2'), b = P('finger1-3'), d = b.clone().sub(a).normalize(); add('gold', spikeAt(b, d, 0.06, 0.007, -0.01, V(0, 1, 0.3), { radial: 4 }), 'finger1-3'); }
  });

  // ═══════════════════════════ PIERNAS: grebas de porcelana, rodillas y tobillos alados de oro
  ak.both(() => {
    const H = P('upperleg01'), K = P('lowerleg01'), A = P('foot'), ll = K.distanceTo(A), ul = H.distanceTo(K);
    add('marble', limb(cuff(0.086, 0.066, ul * 0.7, 0.012, S(10, 7), 28), H, K, 0.5), 'upperleg01', { color: IVORY });
    add('gold', ringAt(H, K, 0.2, 0.088, 0.014, 0.005), 'upperleg01'); add('gold', ringAt(H, K, 0.86, 0.07, 0.014, 0.005), 'upperleg01');
    gplate('lowerleg01', [[0, 0.08], [0.052, 0.045], [0.06, -0.015], [0.02, -0.065], [-0.02, -0.065], [-0.06, -0.015], [-0.052, 0.045]], { depth: 0.032, bevel: 0.012, wrap: { rx: 0.078, rz: 0.086 }, color: IVORY, r: 0.0034, inset: 0.2, place: (g) => X(g, { p: [K.x, K.y, K.z - 0.005] }),
      fil: [swirl(0, 0.0, 0.03, 0.006, 0.6, 1.3, 12)], filHigh: true });
    add('gold', X(G.wrapE(G.plate([[0.0, 0.082], [0.054, 0.045], [0.0, 0.07]], 0.036, 0.003), 0.08, 0.088), { p: [K.x, K.y, K.z - 0.005] }), 'lowerleg01');
    add('gold', X(dome(0.045, 0.036, { lip: 0.3, seg: S(9, 6), crease: 30 }), { p: [K.x, K.y, K.z + 0.07], r: [Math.PI / 2, 0, 0] }), 'lowerleg01');
    add('marble', limb(cuff(0.078, 0.056, ll * 0.88, 0.012, S(10, 7), 25), K, A, 0.5), 'lowerleg01', { color: IVORY });
    gplate('lowerleg01', [[-0.022, 0.15], [0.022, 0.15], [0.016, -0.14], [0, -0.17], [-0.016, -0.14]], { depth: 0.018, bevel: 0.006, wrap: { rx: 0.062, rz: 0.072 }, color: IVORY_D, inset: 0.14, place: (g) => limb(g, K, A, 0.46) });
    add('gold', ringAt(K, A, 0.08, 0.062, 0.014, 0.005), 'lowerleg01'); add('gold', ringAt(K, A, 0.93, 0.052, 0.014, 0.005), 'lowerleg01');
    // alitas de tobillo (estilo Hermes): tres plumas de oro hacia atrás
    for (let i = 0; i < 3; i++) { const L = 0.2 - i * 0.045, d = V(0.5 + i * 0.12, 0.35 - i * 0.2, -1).normalize(); const g = featherGeo({ len: L, w: 0.045, segs: 1, rps: low ? 3 : 4, curve: -0.08, solid: true }).geos[0]; X(g, { q: t.basisQ(d, V(0, 1, 0)), p: [A.x + 0.05, A.y + 0.14 - i * 0.03, A.z - 0.04] }); add('gold', g, 'lowerleg01'); }
    // bota: puntera de oro
    const boot = G.plate([[-0.065, 0.0], [-0.07, 0.07], [-0.035, 0.115], [0.03, 0.115], [0.1, 0.075], [0.185, 0.04], [0.215, 0.012], [0.19, 0.0]], 0.09, 0.02, { crease: 50 });
    X(boot, { r: [0, -Math.PI / 2, 0] }); X(boot, { p: [A.x + 0.005, 0.0, 0.0] }); add('marble', boot, 'foot', { color: IVORY });
    add('gold', X(G.plate([[0.09, 0.09], [0.17, 0.056], [0.2, 0.026], [0.215, 0.012], [0.19, 0.0], [0.12, 0.0]], 0.094, 0.012, { crease: 50 }), { r: [0, -Math.PI / 2, 0], p: [A.x + 0.005, 0.0, 0.0] }), 'foot');
    add('gold', X(t.box(0.1, 0.014, 0.28, 0.006, 1), { p: [A.x + 0.005, 0.007, 0.06] }), 'foot');
  });

  // ═══════════════════════════ FALDA, TABARDO, VELO Y CINTAS (tela Verlet y muelles)
  {
    const cols = [], lens = [], N = low ? 14 : 20; for (let j = 0; j < N; j++) { const a = -1.15 + (j / (N - 1)) * (Math.PI * 2 - 2.3) + Math.PI, x = Math.sin(a) * 0.205, z = 0.05 + Math.cos(a) * 0.16; cols.push({ bone: j % 2 ? 'spine05' : 'spine04', p: V(x, 0.935, z) }); lens.push(0.86 + (R() - 0.5) * 0.1 + 0.05 * Math.cos(a * 1.5)); }
    ak.cloth({ top: cols, dir: V(0, -1, 0), lens, rows: S(9, 6), color: CREAM, hem: 0xe8b860, gravity: 6, stiff: 0.02, drag: 0.985, wave: 0.02, ember: 0.85 });
    const c2 = [], l2 = []; for (let j = 0; j < 5; j++) { c2.push({ bone: 'spine05', p: V(-0.09 + j * 0.045, 0.925, 0.195) }); l2.push(0.74 - Math.abs(j - 2) * 0.05); }
    ak.cloth({ top: c2, dir: V(0, -1, 0.05), lens: l2, rows: S(8, 5), color: 0xf8f0e0, hem: 0xffcf66, gravity: 6, stiff: 0.03, drag: 0.98, ember: 1 });
    const c3 = [], l3 = []; for (let j = 0; j < 7; j++) { const x = -0.18 + j * 0.06; c3.push({ bone: j === 0 ? 'clavicle_R' : j === 6 ? 'clavicle_L' : 'spine01', p: V(x, 1.4 - Math.abs(x) * 0.2, -0.13) }); l3.push(1.18 - Math.abs(j - 3) * 0.06 + (R() - 0.5) * 0.1); }
    ak.cloth({ top: c3, dir: V(0, -1, -0.08), lens: l3, rows: S(10, 7), color: 0xfff6e2, hem: 0xe8b860, gravity: 6, stiff: 0.012, drag: 0.982, wave: 0.03, ember: 0.9 });
    ak.collider('spine02', V(0, 1.0, 0.045), V(0, 1.36, 0.045), 0.17); ak.collider('spine05', V(0, 0.86, 0.045), V(0, 0.98, 0.045), 0.2);
    ak.both(() => { ak.collider('upperleg01', P('upperleg01'), P('lowerleg01'), 0.125); ak.collider('lowerleg01', P('lowerleg01'), P('foot'), 0.095);
      const E0 = P('lowerarm01'), W0 = P('wrist'), top = [0.22, 0.5, 0.78].map((u, j) => ({ bone: 'lowerarm01', p: E0.clone().lerp(W0, u).add(V(0.055, -0.01, -0.05)) }));
      ak.cloth({ top, dir: V(0.25, -1, -0.15), lens: [0.5, 0.62, 0.5], rows: S(8, 5), color: 0xfff6e2, hem: 0xffcf66, gravity: 4, stiff: 0.03, drag: 0.982, ember: 1 }); });
    // cintas de la cintura: cadenas de muelles con eslabones de tela
    for (const [sx, nm] of [[0.2, 'cintaL'], [-0.2, 'cintaR']]) {
      const pts = Array.from({ length: 8 }, (_, i) => V(sx * (1 + i * 0.03), 0.93 - i * 0.12, -0.05 - i * 0.03)), ch = ak.chain(nm, 'spine05', pts, { stiff: 0.03, damp: 0.95, gravity: 5, sway: 2 });
      for (let i = 0; i < 7; i++) add('cloth', G.tube([pts[i], pts[i + 1]], 0.034 - i * 0.002, 0.034 - i * 0.002, { radial: 4, tubular: 1, sx: 1, sz: 0.06, closeStart: false }), ch.bones[i].name, { color: i % 2 ? 0xe8b860 : CREAM });
    }
  }

  // ═══════════════════════════ ALAS DE LUZ: izquierda entera (oro), derecha quemada y rota (ceniza y brasa); decenas de plumas, las largas con cadenas de muelles
  const SC = 0.88, wingBones = [];
  const wing = (s, burnt) => {
    const hub = V(s * 0.085, 1.34, -0.125), wb = ak.bone(s > 0 ? 'alaL' : 'alaR', 'spine01', hub), nm = s > 0 ? 'L' : 'R';
    const ctrl = [[0, 0, 0], [0.2, 0.26, -0.08], [0.42, 0.66, -0.15], [0.7, 0.82, -0.2], [0.96, 0.62, -0.26]].map((q) => V(s * q[0] * SC, q[1] * SC, q[2] * SC)), cv = new T.CatmullRomCurve3(ctrl, false, 'centripetal');
    const arm = (u) => cv.getPoint(u).add(hub), uMax = burnt ? 0.74 : 1;
    const dirAt = (u, tilt = 0) => { const th = 0.2 + 1.1 * Math.pow(u, 1.05) + tilt; return V(s * Math.sin(th), -Math.cos(th), -0.22 - 0.14 * (1 - u)).normalize(); };
    const rr = t.rng(burnt ? 5 : 9), nA = (burnt ? 9 : low ? 10 : 13) + (AP && !burnt ? 3 : 0), apK = AP && !burnt ? 1.16 : 1;
    // hueso del ala: espina de oro con nudos y garra
    const sp = []; for (let i = 0; i <= 10; i++) sp.push(arm((i / 10) * uMax));
    add('gold', G.tube(sp, 0.018, burnt ? 0.012 : 0.007, { radial: S(6, 4), tubular: S(14, 8), ridges: 3, ridgeAmp: 0.14 }), wb.name);
    add('light', G.tube(sp.slice(1).map((p) => p.clone().add(V(0, 0.012, -0.012))), burnt ? 0.003 : 0.0036, 0.0026, { radial: 3, tubular: 10, closeStart: false }), wb.name, { color: burnt ? AMBER : GOLD_W });
    for (const u of burnt ? [0.3, 0.66] : [0.3, 0.64, 0.97]) { const p = arm(u); add('gold', G.sphere(0.026 - u * 0.006, S(8, 5), S(6, 4)).translate(p.x, p.y, p.z), wb.name); }
    if (!burnt) { const p = arm(1), d = cv.getTangent(1); add('gold', spikeAt(p, V(d.x, d.y + 0.25, d.z - 0.1), 0.13, 0.016, 0.02, V(0, 0, 1), { radial: 4 }), wb.name); }
    else { const p = arm(uMax), d = cv.getTangent(uMax); add('ember', spikeAt(p, d, 0.05, 0.016, 0, V(0, 0, 1), { radial: 4 }), wb.name, { color: AMBER }); for (let k = 0; k < 3; k++) add('marble', spikeAt(p, V(d.x + (rr() - 0.5), d.y + (rr() - 0.4) * 0.8, d.z + (rr() - 0.5) * 0.8), 0.06 + rr() * 0.07, 0.01, 0, V(0, 0, 1), { radial: 3 }), wb.name, { color: IVORY_D }); }
    const cG0 = C(burnt ? ASH : 0xe09a1c), cG1 = C(GOLD_W);
    // fila A: plumas de vuelo (largas, con cadenas de muelles)
    for (let i = 0; i < nA; i++) {
      const u = (0.1 + 0.9 * (i / (nA - 1))) * uMax, p = arm(u), d = dirAt(u / uMax * (burnt ? 0.8 : 1)), lenA = (0.4 + 0.5 * Math.pow(u / uMax, 0.75)) * (u / uMax > 0.93 ? 0.85 : 1) * apK * SC * 1.05;
      if (burnt && rr() < 0.26) { // pluma perdida: sólo queda el cañón pelado y chamuscado
        const L = 0.18 + rr() * 0.22; add('gold', G.tube([p, p.clone().addScaledVector(d, L * 0.5), p.clone().addScaledVector(d, L)], 0.006, 0.0025, { radial: 3, tubular: 3 }), wb.name); add('ember', G.sphere(0.006, 4, 3).translate(p.x + d.x * L, p.y + d.y * L, p.z + d.z * L), wb.name, { color: AMBER }); continue; }
      const len = burnt ? lenA * (0.5 + rr() * 0.4) : lenA, w = (0.1 + 0.02 * u) * (burnt ? 0.9 : 1), trunc = burnt ? 0.6 + rr() * 0.35 : 1, Ld = len * trunc, nmF = `pl${nm}${i}`;
      const f = feather({ mat: burnt ? 'dark' : 'spirit', parent: wb.name, name: nmF, base: p, dir: d, len, w, trunc, jag: burnt ? 0.55 : 0, solid: burnt, curve: 0.07, lean: s * 0.05 + (rr() - 0.5) * 0.06, stiff: burnt ? 0.035 : 0.07, grav: burnt ? 5 : 2.5, sway: burnt ? 0.8 : 1.4,
        color: burnt ? grad(p, d, Ld, w, C(ASH_D), C(ASH), 1, 0.2) : grad(p, d, Ld, w, cG0, cG1, 0.78, 0.45), rach: burnt ? null : { c: GOLD_W, r: 0.0042 } });
      if (burnt) { const e = f.local(1).applyQuaternion(t.basisQ(d, V(0, 0, 1))).add(p); if (i % 2 === 0 || !low) add('ember', G.cone(0.012, 0.03, 4).translate(e.x, e.y, e.z), `${nmF}${low ? 1 : 2}`, { color: AMBER }); }
    }
    // fila B: plumas de relleno, de luz más tenue, estáticas
    const nB = burnt ? 5 : low ? 8 : 12; for (let i = 0; i < nB; i++) {
      const u = (0.14 + 0.82 * ((i + 0.5) / nB)) * uMax, p = arm(u).add(V(0, -0.012, -0.018)), d = dirAt(u / uMax * (burnt ? 0.8 : 1), -0.08), len = (0.26 + 0.34 * Math.pow(u / uMax, 0.7)) * (burnt ? 0.6 + rr() * 0.3 : 1) * apK, w = 0.1;
      feather({ mat: burnt ? 'dark' : 'spirit', bone: wb.name, base: p, dir: d, len, w, curve: 0.05, solid: burnt, trunc: burnt ? 0.7 + rr() * 0.3 : 1, jag: burnt ? 0.5 : 0, color: burnt ? grad(p, d, len, w, C(ASH_D), C(ASH), 0.9, 0.2) : grad(p, d, len, w, C(0xc47a10), C(0xffe08a), 0.62, 0.5) });
    }
    // fila C: cubiertas de porcelana y fila D de oro (sólidas), cerca del hueso
    const nC = burnt ? 6 : low ? 8 : 12; for (let i = 0; i < nC; i++) {
      const u = (0.08 + 0.88 * (i / (nC - 1))) * uMax, p = arm(u).add(V(0, -0.02, -0.03)), d = dirAt(u / uMax * (burnt ? 0.8 : 1), 0.06), len = 0.2 - 0.05 * (u / uMax) + 0.03 * Math.sin(u * 5), w = 0.085;
      const col = burnt ? (i % 2 ? ASH : ASH_D) : IVORY;
      feather({ mat: burnt ? 'dark' : 'marble', bone: wb.name, base: p, dir: d, len: len * (burnt ? 0.8 : 1), w, curve: 0.08, solid: true, trunc: burnt ? 0.75 + rr() * 0.25 : 1, jag: burnt ? 0.4 : 0, color: col });
      if (!burnt && (i % 2 === 0 || !low)) feather({ mat: 'gold', bone: wb.name, base: arm(u).add(V(0, 0.0, -0.036)), dir: dirAt(u, 0.0), len: len * 0.55, w: 0.062, curve: 0.1, solid: true, color: 0xffffff });
    }
    if (burnt) for (let k = 0; k < 7; k++) { const p = arm(0.15 + rr() * 0.6).add(V(0, -0.05 - rr() * 0.12, -0.05)); add('ember', G.sphere(0.007 + rr() * 0.005, 4, 3).translate(p.x, p.y, p.z), wb.name, { color: k % 2 ? AMBER : 0xffd060 }); }
    wingBones.push(wb); return wb;
  };
  const wl = wing(1, false), wr = wing(-1, true);
  upd.push((dt, tt, c) => { const sp = Math.min(1, ((c && c.speed) || 0) / 8); wl.rotation.set(0.05 * Math.sin(tt * 1.1), 0.12 + 0.08 * Math.sin(tt * 1.5) + sp * 0.4, 0.07 * Math.sin(tt * 1.5 + 0.4)); wr.rotation.set(0.04 * Math.sin(tt * 1.0), -(0.1 + 0.05 * Math.sin(tt * 1.3) + sp * 0.34), -0.05 * Math.sin(tt * 1.3) - 0.03); });

  // ═══════════════════════════ AUREOLA QUEBRADA: dos anillos de arcos que giran en sentidos opuestos, con esquirlas sueltas
  {
    const hub = V(0, 1.74, -0.19), a1 = ak.bone('aur1', 'head', hub), a2 = ak.bone('aur2', 'head', hub), arcs = (bone, r, list, rad, col, light) => { for (const [s0, len] of list) { const pts = t.arcPts(hub, V(1, 0, 0), V(0, 1, 0), r, s0, s0 + len, S(14, 8)); add('gold', G.tube(pts, rad, rad * 0.8, { radial: low ? 3 : 4, tubular: S(14, 8) * 2 }), bone); if (light) add('light', G.tube(pts.map((p) => p.clone().add(V(0, 0, 0.004))), 0.0022, 0.0016, { radial: 3, tubular: S(14, 8) * 2, closeStart: false }), bone, { color: col }); } };
    arcs('aur1', 0.27, [[0.1, 1.5], [1.95, 1.0], [3.4, 1.7], [5.4, 0.7]], 0.0065, GOLD_W, true);
    for (const [a, L] of [[1.72, 0.1], [2.98, 0.14], [5.2, 0.12]]) { const p = hub.clone().add(V(Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0)); add('gold', X(G.shard(L, 0.011, 4), { p: [p.x, p.y, p.z], r: [0.2, 0.0, a - Math.PI / 2 + 0.3] }), 'aur1'); }
    for (let i = 0; i < 8; i++) { const a = i * 0.8 + 0.2, p = hub.clone().add(V(Math.cos(a) * 0.295, Math.sin(a) * 0.295, 0)); add('light', X(G.cone(0.005, 0.022, 3), { p: [p.x, p.y, p.z], r: [0, 0, a - Math.PI / 2] }), 'aur1', { color: GOLD_L }); }
    const dash = []; for (let i = 0; i < (low ? 9 : 14); i++) dash.push([i * (Math.PI * 2 / (low ? 9 : 14)), 0.16]);
    arcs('aur2', 0.325, dash, 0.0028, GOLD_L, false);
    if (AP) arcs('aur2', 0.36, [[0.4, 1.2], [2.6, 1.6], [4.9, 1.0]], 0.0045, GOLD_L, true);
    ak.halo('head', V(0, 1.74, -0.2), GOLD_L, 0.9, 0.22);
    upd.push((dt, tt) => { a1.rotation.set(-0.16, 0, tt * 0.28); a2.rotation.set(-0.16, 0, -tt * 0.45); });
  }

  // ═══════════════════════════ LÁTIGO DE LUZ: empuñadura de oro y cadena de 15 eslabones con muelles
  {
    const W0 = P('wrist_R'), N = 15, pts = Array.from({ length: N }, (_, i) => V(W0.x - 0.01 * i, W0.y - 0.045 * i - 0.04, W0.z + 0.05 + i * 0.075));
    add('gold', G.cyl(0.016, 0.019, 0.1, S(8, 6)).rotateX(Math.PI / 2).translate(W0.x, W0.y - 0.045, W0.z + 0.03), 'wrist_R'); add('gold', G.torus(0.024, 0.005, 3, S(10, 6)).rotateX(0).translate(W0.x, W0.y - 0.045, W0.z + 0.085), 'wrist_R');
    add('light', G.sphere(0.014, 6, 5).translate(W0.x, W0.y - 0.045, W0.z - 0.02), 'wrist_R', { color: GOLD_L });
    const wh = ak.chain('latigo', 'wrist_R', pts, { stiff: 0.03, damp: 0.94, gravity: 4, sway: 2 });
    for (let i = 0; i < N - 1; i++) { const r0 = 0.0095 - i * 0.0004; add('light', G.tube([pts[i], pts[i + 1]], r0, r0 - 0.0004, { radial: 4, tubular: 2 }), wh.bones[i].name, { color: i % 3 ? GOLD_L : GOLD_W }); if (i % 3 === 1) add('gold', G.sphere(0.017 - i * 0.0007, 5, 4).translate(pts[i].x, pts[i].y, pts[i].z), wh.bones[i].name); }
    const e = pts[N - 1]; add('light', X(new T.OctahedronGeometry(0.03, 0), { p: [e.x, e.y, e.z], s: [0.7, 1.3, 0.7] }), wh.bones[N - 2].name, { color: GOLD_W });
  }

  // ═══════════════════════════ PLUMAS QUE CAEN (partículas): doradas del ala entera, de ceniza con brasa del ala quemada
  {
    const n = low ? 14 : 30, g = new T.BufferGeometry(), seeds = new Float32Array(n), kind = new Float32Array(n); for (let i = 0; i < n; i++) { seeds[i] = (i + 0.5) / n; kind[i] = i % 3 === 2 ? 1 : 0; }
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aS', new T.BufferAttribute(seeds, 1)); g.setAttribute('aK', new T.BufferAttribute(kind, 1));
    const u = { uT: { value: 0 }, uBeat, uS: { value: low ? 46 : 54 } };
    const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: u,
      vertexShader: `attribute float aS; attribute float aK; uniform float uT, uS; varying float vA, vK, vR; varying vec2 vD;
        void main(){ float f = fract(aS * 7.31 + uT * (0.045 + 0.04 * fract(aS * 3.1))), side = aK > 0.5 ? -1.0 : 1.0, sw = sin(uT * 1.1 + aS * 60.0);
          vec3 p = vec3(side * (0.18 + 0.95 * fract(aS * 5.7)) + 0.16 * sw, 1.95 - f * 1.9 + 0.0, -0.2 - 0.35 * fract(aS * 9.3) + 0.12 * cos(uT * 0.9 + aS * 40.0));
          vA = smoothstep(0.0, 0.08, f) * smoothstep(1.0, 0.86, f); vK = aK; vR = uT * (0.6 + fract(aS * 4.1)) + aS * 30.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = uS * (0.6 + 0.6 * fract(aS * 13.7)) / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA, vK, vR; uniform float uBeat;
        void main(){ vec2 q = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
          float hw = 0.13 * (1.0 - pow(abs(q.y) * 2.0, 1.6)) + 0.012; float vane = step(abs(q.x - q.y * 0.18), hw) * step(abs(q.y), 0.46); float rach = step(abs(q.x - q.y * 0.18), 0.012) * step(abs(q.y), 0.48);
          vec3 col = vK > 0.5 ? mix(vec3(0.16, 0.12, 0.1), vec3(1.0, 0.45, 0.1), smoothstep(0.0, 0.46, q.y)) : mix(vec3(1.0, 0.72, 0.2), vec3(1.0, 0.95, 0.75), q.y + 0.5) * (1.1 + 0.4 * uBeat);
          col += rach * (vK > 0.5 ? vec3(0.3, 0.1, 0.0) : vec3(0.6));
          float a = max(vane * 0.8, rach) * vA; if (a < 0.02) discard; gl_FragColor = vec4(col, a); }` });
    const pts = new T.Points(g, m); pts.frustumCulled = false; pts.name = 'kit-plumas'; ak.extraRoots.push(pts);
    upd.push((dt, tt) => { u.uT.value = tt; });
  }
  ak.embers(GOLD_L, low ? 14 : 30, { radius: 0.55, height: 2.2, size: 5 });
  const evo = addEvolution(ak, ctx, { t, skipApoteosis: true, pal: { bone: 0xe8dcc8, boneL: 0xfff6e6, steel: 0xeae0cf, steelD: 0xcdbfa8 } });
  return { update: (dt, tt, c) => { upd.forEach((f) => f(dt, tt, c)); evo.update(dt, tt, c); } };
}
