// PIEZAS DEL LABORATORIO (EH-02, docs/EDITOR_HUESPEDES.md §2.3 y §3.4): generadores PARAMÉTRICOS de las 20 piezas del catálogo v1 (12 cosméticas + 8 funcionales).
// Usan las mismas herramientas que los 8 Huéspedes oficiales (tools(ak) de huesped-piezas.js, ak.chain de huesped-armor.js) y se anclan a los HUESOS del kit.
//
//   construirInstancia(ak, x, ctx) → { proxy: { group, mesh }, tris? }      x = una instancia de `instancias(build)` (src/shared/host-build.js, espejo = 2).
//
// CONVENCIONES (iguales a las del kit):
//   · Cada generador dibuja en el «espacio de la pieza»: origen = su base, +Y = hacia donde crece, +Z = adelante, +X = hacia AFUERA del cuerpo (lado izquierdo del modelo).
//     El lado derecho lo espeja `ak.one('R')`. En anclas de un solo lado (cabeza, pecho…) el eje +X de `t.pos` es el lado derecho del personaje.
//   · Lugar «natural» de cada pieza en cada ancla (`NAT`): la `t.pos` del diseño se SUMA a ese lugar. Con `t` = 0 la pieza ya queda bien puesta.
//   · Orden de transformación (el mismo que X() del kit): escala → giro (grados XYZ, pivote en la base) → posición.
//   · Presupuesto: cada generador usa SÓLO los materiales de su entrada `mats` del catálogo (cuenta de llamadas exacta) y tris ≈ `tris.low` (la tabla del catálogo;
//     tools/lab-costes.mjs mide y compara). Calidad: Baja ×1, Media ×1,74, Alta ×3,3 en triángulos (QF = factor lineal de segmentos).
// Los tamaños, posiciones y colores son SÓLO estética: ninguna fórmula de combate lee nada de aquí.
import * as T from 'three';
import { tools, V, basisQ } from '../huesped-piezas.js';
import { PARTES, ANCLAS } from '../../shared/host-build-catalogo.js';

/** Factor lineal de segmentos por calidad (los triángulos crecen con el cuadrado: 1 → 1,74 → 3,31). */
export const QF = { low: 1, medium: 1.32, high: 1.82 };
const D2R = Math.PI / 180, TAU = Math.PI * 2;
const hexN = (s) => parseInt(String(s).replace('#', ''), 16);
const mixC = (a, b, k) => new T.Color(a).lerp(new T.Color(b), k).getHex();

/** Lugar natural de cada pieza en cada ancla: posición [x, y, z] en el marco del hueso (m, bind). Lo que no figura = [0,0,0]. */
export const NAT = {
  cuerno_curvo: { cabeza: [0.06, 0.1, 0.03] },
  cresta_osea: { cabeza: [0, 0.135, 0.0] },
  corona_espinas: { cabeza: [0, 0.11, 0.045] },
  gorguera: { cuello: [0, 0.0, 0.012] },
  hombrera_espinas: { hombros: [0.025, 0.05, 0.0] },
  placa_pectoral: { pecho: [0, 0.01, 0.05] },
  espinas_dorsales: { espalda: [0, -0.01, -0.095] },
  alas_membrana: { espalda: [0.05, 0.24, -0.1] },
  cola_larga: { cola: [0, -0.02, -0.07] },
  cuchilla_antebrazo: { antebrazos: [0.06, -0.035, 0.085] },
  rodillera_placa: { muslos: [0.045, -0.405, 0.075] },
  garras_mano: { manos: [0.05, -0.12, 0.15] },
  placas: { pecho: [0.075, 0.03, 0.115], espalda: [0.08, 0.2, -0.085], hombros: [0.03, 0.065, 0.0] },
  adrenal: { cintura: [0, -0.03, 0.105], espalda: [0, -0.03, -0.1] },
  ojo_extra: { cabeza: [0, 0.15, 0.125], pecho: [0, 0.05, 0.16] },
  saco_g: { espalda: [0, 0.02, -0.11], cintura: [0, -0.02, -0.1] },
  medula: { espalda: [0, -0.06, -0.09], pecho: [0, -0.07, 0.165] },
  tentaculo: { espalda: [0.07, 0.14, -0.1], hombros: [0.0, 0.07, -0.05], cintura: [0.12, -0.02, -0.02] },
  corazon_cristal: { pecho: [0, 0.03, 0.15] },
  espiraculo: { cabeza: [0, 0.17, 0.03], espalda: [0, 0.14, -0.115] },
};

/** Color por vértice según el material del kit: el natural del material (blanco = textura tal cual) mezclado con la paleta del diseño. */
function colorDe(mat, c, pal) {
  if (c && c.tinte) return hexN(c.tinte);
  const P = hexN(pal.primario), S = hexN(pal.secundario), E = hexN(pal.emisivo);
  switch (mat) {
    case 'bone': return mixC(0xf2e8d0, P, 0.22);
    case 'stone': return mixC(0xcfcbdc, P, 0.2);
    case 'metal': return mixC(0xf2f4ff, P, 0.1);
    case 'gold': return 0xffffff;
    case 'marble': return mixC(0xffffff, P, 0.1);
    case 'leather': return mixC(0xd8b8a0, P, 0.45);
    case 'bark': return mixC(0xd0b090, P, 0.3);
    case 'cloth': return mixC(0xffffff, P, 0.75);
    case 'flesh': return mixC(0xff8a96, P, 0.35);
    case 'dark': return mixC(S, 0x1a1626, 0.4);
    case 'crystal': return mixC(E, 0xffffff, 0.35);
    case 'ember': case 'light': return E;
    default: return 0xffffff;
  }
}

/** Marco de dibujo de UNA instancia: transforma y añade al hueso correcto (con el espejo del lado derecho). */
function marco(ak, x, ctx) {
  const t = tools(ak), { X } = t, d = PARTES[x.p], A = ANCLAS[x.a], q = QF[ak.quality] || 1, base = x.hueso.replace(/_[LR]$/, '');
  const lado = x.lado, central = lado === 'c';
  const nat = (NAT[x.p] && NAT[x.p][x.a]) || [0, 0, 0], tt = x.t || { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 };
  // anclas de un lado: +X de `t` es el lado DERECHO del personaje; el kit dibuja con +X = izquierda, así que se refleja (pos.x, rot.y, rot.z cambian de signo)
  const sg = central ? -1 : 1;
  const pos = [tt.pos[0] * sg, tt.pos[1], tt.pos[2]], rot = [tt.rot[0] * D2R, tt.rot[1] * D2R * sg, tt.rot[2] * D2R * sg], esc = tt.esc || 1;
  const f = {
    ak, t, d, A, x, q, base, esc, lado, central, pos, rot, nat, mat: (m) => (x.c && x.c.mat && d.variantesMat.includes(x.c.mat) && m === d.mats[0] ? x.c.mat : m),
    sg: (n, min = 3) => Math.max(min, Math.round(n * q)),
    col: (m) => colorDe(m, x.c, ctx.pal),
    pal: ctx.pal, ctxPal: ctx.pal, P0: null, M: new T.Matrix4(),
    /** Transforma una geometría del espacio de la pieza al del hueso (pose de enlace del modelo). Muta y devuelve. */
    place(g) { return X(g, { p: [f.P0.x, f.P0.y, f.P0.z], r: rot, s: esc }); },
    /** Un punto del espacio de la pieza → el del modelo (para huesos de cadena). */
    pt(v) { return new T.Vector3(...(Array.isArray(v) ? v : [v.x, v.y, v.z])).multiplyScalar(esc).applyEuler(new T.Euler(rot[0], rot[1], rot[2], 'XYZ')).add(f.P0); },
    add(mat, g, o = {}) { const m = f.mat(mat); return ak.add(m, f.place(g), o.bone || base, { color: o.color ?? f.col(m) }); },
    /** Sólo para huesos extra: añade una geometría YA en coordenadas del modelo (se usa con f.pt) al hueso `bone`. */
    addRaw(mat, g, bone, o = {}) { const m = f.mat(mat); return ak.add(m, g, bone, { color: o.color ?? f.col(m) }); },
  };
  return f;
}

/* ───────────────────────────── generadores (espacio de la pieza) ───────────────────────────── */
// Cada uno recibe el marco `f` y devuelve { c: [x,y,z], r } = centro y radio (espacio de la pieza, m) de su zona de selección.
const spikeDir = (f, base, dir, len, r, bend, o = {}) => f.t.spikeAt(V(...base), V(...dir), len, r, bend, V(0, 0, 1), { radial: o.radial ?? f.sg(5, 3), tubular: o.tubular ?? f.sg(4, 2), ...o });

/** Polígono 2D «orgánico» de n puntos (placa de quitina con borde ondulado): semieje (rx, ry) y ondulación `wob`. */
const blob = (n, rx, ry, wob = 0.12) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU, k = 1 + wob * (i % 2 ? 1 : -1); return [Math.cos(a) * rx * k, Math.sin(a) * ry * k]; });
const bsegsDe = (f) => (f.q > 1.5 ? 3 : f.q > 1.2 ? 2 : 1);

export const GEN = {
  /* ───── cosméticas ───── */
  cuerno_curvo(f) {
    const { G } = f.t, r = f.sg(6, 4), tu = f.sg(18, 8);
    const pts = [V(0, 0, 0), V(0.03, 0.065, -0.02), V(0.052, 0.125, -0.07), V(0.045, 0.165, -0.145)];
    const g = G.tube(pts, 0.022, 0.0015, { radial: r, tubular: tu, ridges: 4, ridgeAmp: 0.14, twist: 1.6, ease: 0.85 });
    f.add('bone', g); return { c: [0.03, 0.08, -0.05], r: 0.1 };
  },
  cresta_osea(f) {
    const { G, X } = f.t, pl = [[0.14, 0.0], [0.115, 0.045], [0.09, 0.03], [0.065, 0.075], [0.04, 0.05], [0.015, 0.09], [-0.01, 0.055], [-0.035, 0.085], [-0.06, 0.045], [-0.085, 0.06], [-0.12, 0.01], [-0.13, -0.01], [0.13, -0.01]];
    const g = G.plate(pl, 0.014 * 1.0, 0.003, { crease: 40, bsegs: bsegsDe(f) }); X(g, { r: [0, -Math.PI / 2, 0] }); f.add('bone', g);
    for (let i = 0; i < 4; i++) { const z = 0.085 - i * 0.056; f.add('bone', spikeDir(f, [0, 0.005, z], [0, 1, -0.4], 0.07 - i * 0.008, 0.0105, 0.01, { radial: f.sg(5, 3), tubular: f.sg(4, 2) })); }
    return { c: [0, 0.04, 0], r: 0.14 };
  },
  corona_espinas(f) {
    const { G, X } = f.t, n = 8, R = 0.108;
    f.add('metal', X(G.torus(R, 0.0045, f.sg(3, 3), f.sg(18, 8)), { s: [1, 1, 1.15] }));
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, c = Math.cos(a), s = Math.sin(a); f.add('metal', spikeDir(f, [s * R, 0, c * R * 1.15], [s * 0.45, 1, c * 0.45], 0.05 + 0.02 * (i % 2), 0.008, 0.0, { radial: f.sg(4, 3), tubular: f.sg(3, 2) })); }
    return { c: [0, 0.03, 0], r: 0.13 };
  },
  gorguera(f) {
    const { G } = f.t, nb = 3;
    for (let i = 0; i < nb; i++) f.add('bone', G.band(0.082 - i * 0.004, 0.026, 0.012, { seg: f.sg(12, 7), simple: true, y0: i * 0.022 - 0.022, sx: 1, sz: 0.94 }));
    return { c: [0, 0, 0], r: 0.1 };
  },
  hombrera_espinas(f) {
    const { G, X } = f.t, dm = f.t.dome(0.08, 0.06, { lip: 0.2, seg: f.sg(11, 6), crease: 30 });
    f.add('bone', X(dm, { s: [1.12, 1, 1], r: [0, 0, -0.35] }));
    f.add('bone', X(G.torus(0.082, 0.007, f.sg(3, 3), f.sg(18, 8)), { s: [1.1, 1, 1], r: [0, 0, -0.35] }));
    for (let i = 0; i < 6; i++) { const a = -0.62 + i * 0.3; f.add('bone', spikeDir(f, [Math.sin(a) * 0.05 + 0.02, 0.045 - Math.abs(Math.sin(a)) * 0.02, Math.cos(a) * 0.05], [Math.sin(a) * 0.7 + 0.5, 0.9, Math.cos(a) * 0.4], 0.075 - Math.abs(a) * 0.03, 0.013, 0.012, { radial: f.sg(5, 3), tubular: f.sg(4, 2) })); }
    return { c: [0.03, 0.04, 0], r: 0.11 };
  },
  placa_pectoral(f) {
    const { G, X } = f.t, half = [[0.0, 0.1], [0.03, 0.108], [0.06, 0.112], [0.09, 0.1], [0.115, 0.085], [0.13, 0.06], [0.138, 0.03], [0.14, 0.0], [0.135, -0.03], [0.12, -0.055], [0.1, -0.075], [0.075, -0.095], [0.045, -0.11], [0.02, -0.118], [0.0, -0.12]].map((q) => [q[0] * 0.86, q[1] * 0.86]), pts = f.t.platePts(half, true);
    const g = G.wrapE(G.plate(pts, 0.022, 0.007, { crease: 36, bsegs: bsegsDe(f) + 1 }), 0.17, 0.12); f.add('metal', g);
    f.add('metal', X(G.wrapE(G.plate([[-0.08, 0.012], [0.0, 0.02], [0.08, 0.012], [0.08, -0.012], [0.0, -0.004], [-0.08, -0.012]], 0.014, 0.003, { crease: 36, bsegs: 1 }), 0.17, 0.12 + 0.012), { p: [0, 0.098, 0] }));
    f.add('metal', X(G.wrapE(G.plate([[0.004, 0.09], [0.012, 0.0], [0.004, -0.1], [-0.004, -0.1], [-0.012, 0.0], [-0.004, 0.09]], 0.012, 0.003), 0.17, 0.12 + 0.02), { p: [0, 0, 0] }));
    return { c: [0, 0, 0.12], r: 0.14 };
  },
  espinas_dorsales(f) {
    const n = 9;
    for (let i = 0; i < n; i++) { const u = i / (n - 1), y = 0.02 + u * 0.24, big = Math.sin(u * Math.PI) * 0.5 + 0.5; f.add('bone', spikeDir(f, [0, y, 0.0], [0, 0.55, -0.85], 0.04 + 0.075 * big, 0.012 + 0.006 * big, 0.0, { radial: f.sg(5, 3), tubular: f.sg(4, 2) })); }
    return { c: [0, 0.14, -0.04], r: 0.18 };
  },
  alas_membrana(f) {
    const { G } = f.t, nf = 4, rN = f.sg(5, 3), tN = f.sg(7, 3), rows = f.sg(6, 3);
    for (const sd of [1, -1]) {
      const sh = (p) => V(sd * p[0], p[1], p[2]), arm = [sh([0, 0, 0]), sh([0.08, 0.14, -0.08]), sh([0.17, 0.3, -0.12]), sh([0.3, 0.46, -0.16])];
      f.add('bone', G.tube(arm, 0.014, 0.008, { radial: rN, tubular: tN, closeStart: true }));
      const tips = []; for (let k = 0; k < nf; k++) { const a = 0.15 + k * 0.28, L = 0.46 - k * 0.04; tips.push(sh([0.3 + Math.sin(a + 0.9) * L * 0.6, 0.46 - Math.cos(a + 0.4) * L * 0.95, -0.16 - 0.05 * k])); }
      for (const tp of tips) f.add('bone', G.tube([arm[3], V().lerpVectors(arm[3], tp, 0.5).add(V(0, 0.015, -0.01)), tp], 0.0075, 0.0025, { radial: f.sg(4, 3), tubular: f.sg(4, 2) }));
      // membrana: abanico de triángulos subdivididos entre el hombro y cada par de dedos (doble cara)
      const edge = [arm[2], arm[3], ...tips];
      for (let k = 1; k < edge.length - 1; k++) {
        const A0 = arm[0], B0 = edge[k], C0 = edge[k + 1], pos = [], idx = [], id = (i, j) => i * (rows + 1) - (i * (i - 1)) / 2 + j;
        for (let i = 0; i <= rows; i++) for (let j = 0; j <= rows - i; j++) { const u = i / rows, w = j / rows, z = 1 - u - w; pos.push(A0.x * z + B0.x * u + C0.x * w, A0.y * z + B0.y * u + C0.y * w, A0.z * z + B0.z * u + C0.z * w - 0.012 * Math.sin(u * Math.PI) * z * 4); }
        for (let i = 0; i < rows; i++) for (let j = 0; j < rows - i; j++) { idx.push(id(i, j), id(i + 1, j), id(i, j + 1)); if (j < rows - i - 1) idx.push(id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        const gb = g.clone(), ix = gb.index.array; for (let i = 0; i < ix.length; i += 3) { const t0 = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t0; } gb.computeVertexNormals();
        f.add('leather', g); f.add('leather', gb);
      }
    }
    return { c: [0, 0.12, -0.12], r: 0.4 };
  },
  cola_larga(f) {
    const n = 11, { G } = f.t, pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n; pts.push(f.pt([0, -0.03 * u - 0.12 * u * u, -0.02 - 0.62 * u])); }
    const ch = f.ak.chain('lab' + f.x.i + 'cola', 'spine05', pts, { stiff: 0.08, damp: 0.93, gravity: 4, sway: 0.9 });
    for (let i = 0; i < n; i++) {
      const u = i / n, r0 = 0.045 * (1 - u * 0.85) * f.esc, r1 = 0.045 * (1 - (u + 1 / n) * 0.85) * f.esc;
      const g = G.tube([pts[i].clone().lerp(pts[Math.max(0, i - 1)], 0.0), pts[i + 1]], r0, r1, { radial: f.sg(8, 4), tubular: f.sg(4, 2), closeStart: false });
      f.addRaw('bone', g, ch.bones[i].name);
    }
    const tip = pts[n], dir = pts[n].clone().sub(pts[n - 1]).normalize();
    f.addRaw('bone', f.t.spikeAt(tip, dir, 0.1 * f.esc, 0.014 * f.esc, 0.0, V(0, 1, 0), { radial: f.sg(6, 3), tubular: f.sg(4, 2) }), ch.bones[n - 1].name);
    return { c: [0, -0.06, -0.3], r: 0.34, chain: ch };
  },
  cuchilla_antebrazo(f) {
    const { G, X } = f.t, dir = V(0.5, -0.44, 0.69).normalize(), q = basisQ(dir, V(-1, 0, 0)), n = f.sg(15, 5);
    const bl = f.t.blade(0.36, 0.05, 0.012, { n, tipLean: 0.0 }); X(bl, { q }); f.add('metal', bl);
    const r0 = X(G.band(0.036, 0.022, 0.008, { seg: f.sg(14, 7), simple: true }), { q }); f.add('metal', r0);
    const r1 = X(G.band(0.04, 0.02, 0.008, { seg: f.sg(14, 7), simple: true, y0: 0.06 }), { q }); f.add('metal', r1);
    return { c: [0.09, -0.08, 0.14], r: 0.14 };
  },
  rodillera_placa(f) {
    const { G, X } = f.t, dm = f.t.dome(0.052, 0.05, { lip: 0.25, seg: f.sg(17, 8), crease: 28 });
    f.add('metal', X(dm, { r: [Math.PI / 2, 0, 0], p: [0, 0, 0], s: [1.05, 0.7, 1.05] }));
    f.add('metal', X(G.torus(0.054, 0.005, f.sg(3, 3), f.sg(18, 8)), { r: [Math.PI / 2, 0, 0], p: [0, 0, -0.005] }));
    f.add('metal', spikeDir(f, [0, 0, 0.045], [0, 0.2, 1], 0.05, 0.011, 0, { radial: f.sg(5, 3), tubular: f.sg(3, 2) }));
    return { c: [0, 0, 0.03], r: 0.07 };
  },
  garras_mano(f) {
    const n = 5;
    for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * 0.25; f.add('bone', spikeDir(f, [Math.sin(a) * 0.03, 0, Math.cos(a) * 0.01], [Math.sin(a) * 0.5 + 0.28, -0.6, 0.78], 0.115 - Math.abs(a) * 0.05, 0.0105, 0.018, { radial: f.sg(5, 3), tubular: f.sg(5, 2) })); }
    return { c: [0.02, -0.04, 0.04], r: 0.09 };
  },

  /* ───── funcionales (el efecto sale del órgano; esto es sólo el dibujo) ───── */
  placas(f) {
    const { G, X } = f.t, n = 17, bs = bsegsDe(f);
    const mk = (rx, ry, y, z, rz, rx2) => { const g = G.plate(blob(n, rx, ry, 0.1), 0.016, 0.005, { crease: 36, bsegs: bs }); X(g, { p: [0, y, z], r: [rx2, 0, rz] }); f.add('bone', g); };
    mk(0.075, 0.095, 0.0, 0.0, 0.1, -0.25); mk(0.062, 0.078, -0.07, 0.018, -0.05, -0.3); mk(0.05, 0.062, -0.13, 0.034, 0.15, -0.35); mk(0.04, 0.05, -0.18, 0.05, -0.1, -0.4);
    return { c: [0, -0.08, 0.03], r: 0.12 };
  },
  adrenal(f) {
    const { G, X } = f.t, ws = f.sg(11, 6), hs = f.sg(7, 4);
    f.add('flesh', X(G.sphere(0.045, ws, hs), { s: [1, 1.25, 0.85] }));
    f.add('flesh', X(G.sphere(0.03, f.sg(8, 5), f.sg(5, 3)), { p: [0.03, 0.05, 0.015] }));
    f.add('flesh', G.tube([V(0, 0.05, 0), V(0.01, 0.09, 0.01), V(-0.02, 0.13, 0.0)], 0.011, 0.005, { radial: f.sg(5, 3), tubular: f.sg(5, 2) }));
    f.add('flesh', G.tube([V(0.0, -0.04, 0), V(-0.01, -0.09, 0.0), V(0.015, -0.13, 0.01)], 0.009, 0.004, { radial: f.sg(5, 3), tubular: f.sg(4, 2) }));
    return { c: [0, 0, 0], r: 0.075 };
  },
  ojo_extra(f) {
    const { G, X } = f.t, ws = f.sg(10, 6), hs = f.sg(7, 4);
    f.add('flesh', X(G.torus(0.032, 0.008, f.sg(4, 3), f.sg(11, 6)), { r: [Math.PI / 2, 0, 0], p: [0, 0, 0.0] }));
    f.add('flesh', X(G.sphere(0.03, ws, hs), { p: [0, 0, -0.004] }));
    f.add('crystal', X(G.sphere(0.0145, f.sg(7, 4), f.sg(5, 3)), { p: [0, 0, 0.022], s: [1, 1, 0.6] }));
    if (f.ak.halo) { const hb = f.base, m = f.ak.halo(hb, f.P0.clone().add(V(0, 0, 0.03)), f.col('crystal'), 0.1 * f.esc, 0.45); void m; }
    return { c: [0, 0, 0.01], r: 0.05 };
  },
  saco_g(f) {
    const { G, X } = f.t;
    f.add('flesh', X(G.sphere(0.06, f.sg(12, 6), f.sg(7, 4)), { p: [0, -0.06, -0.02], s: [1, 1.2, 0.95] }));
    f.add('flesh', X(G.sphere(0.04, f.sg(8, 5), f.sg(5, 3)), { p: [0.045, -0.12, 0.0] }));
    f.add('flesh', X(G.sphere(0.04, f.sg(8, 5), f.sg(5, 3)), { p: [-0.045, -0.12, 0.0] }));
    f.add('flesh', G.tube([V(0, 0.0, 0.0), V(0, -0.02, -0.01), V(0, -0.045, -0.02)], 0.02, 0.03, { radial: f.sg(6, 4), tubular: f.sg(3, 2) }));
    return { c: [0, -0.08, -0.02], r: 0.11 };
  },
  medula(f) {
    const { G, X } = f.t, n = 7;
    for (let i = 0; i < n; i++) { const y = i * (0.3 / (n - 1)), s = 1 - Math.abs(i - (n - 1) / 2) / n * 0.5; f.add('bone', X(G.cyl(0.026 * s, 0.03 * s, 0.03, f.sg(5, 4)), { p: [0, y, 0], s: [1.3, 1, 0.9] })); }
    f.add('flesh', G.tube([V(0.028, -0.02, 0.0), V(0.034, 0.1, -0.005), V(0.028, 0.2, 0.0), V(0.03, 0.32, 0.0)], 0.007, 0.007, { radial: f.sg(5, 3), tubular: f.sg(10, 4) }));
    f.add('flesh', G.tube([V(-0.028, -0.02, 0.0), V(-0.034, 0.1, -0.005), V(-0.028, 0.2, 0.0), V(-0.03, 0.32, 0.0)], 0.007, 0.007, { radial: f.sg(5, 3), tubular: f.sg(10, 4) }));
    return { c: [0, 0.15, 0], r: 0.19 };
  },
  tentaculo(f) {
    const n = 10, { G } = f.t, pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n; pts.push(f.pt([0.02 + 0.2 * u + 0.05 * Math.sin(u * 5), 0.06 * u + 0.18 * Math.sin(u * 2.4), -0.1 * u - 0.2 * u * u * 1.2])); }
    const ch = f.ak.chain('lab' + f.x.i + 'tent', f.base, pts, { stiff: 0.07, damp: 0.92, gravity: 2, sway: 1.5 });
    for (let i = 0; i < n; i++) {
      const u = i / n, r0 = (0.03 - 0.026 * u) * f.esc, r1 = (0.03 - 0.026 * (u + 1 / n)) * f.esc;
      f.addRaw('flesh', G.tube([pts[i], pts[i + 1]], r0, r1, { radial: f.sg(8, 4), tubular: f.sg(4, 2), closeStart: false }), ch.bones[i].name);
    }
    return { c: [0.1, 0.05, -0.05], r: 0.18, chain: ch };
  },
  corazon_cristal(f) {
    const { G, X } = f.t;
    f.add('crystal', X(new T.IcosahedronGeometry(0.036, f.sg(1, 1) > 1 ? 2 : 1), { s: [1, 1.15, 0.9] }));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.4; f.add('crystal', f.t.spikeAt(V(Math.sin(a) * 0.03, Math.cos(a) * 0.03 - 0.005, 0.0), V(Math.sin(a), Math.cos(a), 0.5), 0.05 + 0.02 * (i % 2), 0.011, 0.0, V(0, 0, 1), { radial: f.sg(4, 3), tubular: f.sg(2, 1) })); }
    if (f.ak.halo) { f.ak.halo(f.base, f.P0.clone().add(V(0, 0, 0.02)), f.col('crystal'), 0.22 * f.esc, 0.5); }
    void G; return { c: [0, 0, 0.0], r: 0.065 };
  },
  espiraculo(f) {
    const { G, X } = f.t;
    f.add('dark', G.lathe([[0.012, 0.0], [0.03, 0.002], [0.045, 0.03], [0.06, 0.06], [0.052, 0.062], [0.036, 0.032], [0.016, 0.008], [0.012, 0.0]], f.sg(10, 6), 0, TAU, 28));
    f.add('dark', X(G.torus(0.058, 0.007, f.sg(3, 3), f.sg(12, 7)), { p: [0, 0.061, 0] }));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU; f.add('dark', spikeDir(f, [Math.sin(a) * 0.058, 0.06, Math.cos(a) * 0.058], [Math.sin(a) * 0.5, 1, Math.cos(a) * 0.5], 0.04, 0.008, 0, { radial: f.sg(4, 3), tubular: f.sg(3, 2) })); }
    return { c: [0, 0.04, 0], r: 0.08 };
  },
};

/**
 * Dibuja UNA instancia. Devuelve { c, r, group (donde cuelga la zona de selección), chain } o null si no hay generador.
 * `ctx` = { pal, proxies: [] }. El ancla, el hueso y el lado ya vienen resueltos por `instancias()` (host-build.js).
 */
export function construirInstancia(ak, x, ctx) {
  const gen = GEN[x.p]; if (!gen) return null;
  let out = null;
  const run = () => {
    const f = marco(ak, x, ctx);
    f.P0 = ak.P(f.base).add(V(f.nat[0] + f.pos[0], f.nat[1] + f.pos[1], f.nat[2] + f.pos[2]));
    out = gen(f) || { c: [0, 0, 0], r: 0.06 };
    // zona de selección (invisible) colgada del hueso, en el lugar de la pieza
    const cw = f.pt(out.c), rr = Math.max(0.035, out.r * f.esc), g = ak.mount(f.base, cw);
    if (g) out.group = g;
    out.radius = rr; out.world = cw.clone();
  };
  if (x.lado === 'izq') ak.one('L', run); else if (x.lado === 'der') ak.one('R', run); else run();
  return out;
}
