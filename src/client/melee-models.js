// Modelos 3D procedurales de las ARMAS CUERPO A CUERPO (15 del catálogo + 5 innatas). Sin archivos externos ni compilación.
//   import { buildMelee, attachToViewmodel } from './melee-models.js';
//   const m = buildMelee(THREE, 'filo_oseo', { tier: 2, quality: 'low', color: 0x3aa8ff });   // → { group, update(dt, t), dispose(), info, setTier(n) }
//   scene.add(m.group); en cada cuadro: m.update(dt, t)
// Marco local del modelo: el EMPUÑE está en el origen, la hoja / cabeza sube por +Y, el filo mira a +X y el frente es +Z.
//   El tejido de FUSIÓN (manga que sube por la muñeca) baja por −Y: al colocar el arma en la mano, −Y apunta al antebrazo.
// Evolución visible (tier 0–4) = la «fusión» del arma con el Huésped:
//   0 arma sola · 1 manga de tejido + venas que suben por el empuñe · 2 venas por la hoja + cristales de fusión ·
//   3 aura translúcida + fragmentos orbitando · 4 más grande, halo y corona de espinas.
// Presupuesto (Baja): ≤ 14 llamadas de dibujo y ≤ 6 000 triángulos por arma (en la práctica 4–6 y < 2 500). Ver docs/HUESPEDES.md → «Melee: modelos».
// Piezas: 'body' (metal / hueso / quitina, sombreado plano), 'glow' (emisivo, sin luz), 'mem' (membrana aditiva) + el grupo 'orbit' (cuerpo + brillo).

const ZERO = [0, 0, 0], ONE = [1, 1, 1];
export const MELEE_MODEL_IDS = [
  'filo_oseo', 'sable_plasma', 'hoja_umbral', 'hacha_quitina', 'hacha_doble', 'segur_vorax', 'martillo_sismico', 'maza_espora', 'yunque_vital',
  'lanza_sinaptica', 'pica_cristal', 'tridente_abisal', 'daga_neurotoxica', 'colmillo', 'aguja_fantasma',
  'cuchillas', 'garras', 'punos', 'hoja_dim', 'latigo',
];
/** Nombres de las armas innatas (las del catálogo están en data.js → MELEE_WEAPONS). */
export const NATIVE_NAMES = { cuchillas: 'Cuchillas', garras: 'Garras', punos: 'Puños', hoja_dim: 'Hoja dimensional', latigo: 'Látigo' };

/* ───────────────────────── constructor de piezas ───────────────────────── */
export function makeBuilder(T, S) {
  const E = new T.Euler(), Q = new T.Quaternion(), M = new T.Matrix4(), v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), cc = new T.Color(), UPV = new T.Vector3(0, 1, 0);
  const buckets = { body: [], glow: [], mem: [], ob: [], og: [], aura: [], cage: [] };
  const tf = (g, p = ZERO, r = ZERO, s = ONE) => { E.set(r[0], r[1], r[2]); Q.setFromEuler(E); M.compose(v1.set(p[0], p[1], p[2]), Q, v2.set(s[0], s[1], s[2])); g.applyMatrix4(M); return g; };
  const put = (k, g, col) => {
    if (g.index) { const n = g.toNonIndexed(); g.dispose(); g = n; }
    g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, c = new Float32Array(n * 3); cc.set(col);
    for (let i = 0; i < n; i++) { c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); buckets[k].push(g);
  };
  const sg = (n) => n || S;
  const B = {
    box(k, col, d, p, r, s) { put(k, tf(new T.BoxGeometry(d[0], d[1], d[2]), p, r, s), col); },
    cyl(k, col, rt, rb, h, p, r, n, s) { put(k, tf(new T.CylinderGeometry(rt, rb, h, sg(n), 1), p, r, s), col); },
    cone(k, col, rad, h, p, r, n, s) { put(k, tf(new T.ConeGeometry(rad, h, sg(n), 1), p, r, s), col); },
    sph(k, col, rad, p, s, n) { put(k, tf(new T.SphereGeometry(rad, sg(n), Math.max(3, sg(n) - 2)), p, ZERO, s), col); },
    oct(k, col, rad, p, s, r) { put(k, tf(new T.OctahedronGeometry(rad, 0), p, r, s), col); },
    ico(k, col, rad, p, s, r) { put(k, tf(new T.IcosahedronGeometry(rad, 0), p, r, s), col); },
    tor(k, col, R, rad, p, r, n, s) { put(k, tf(new T.TorusGeometry(R, rad, 4, sg(n) * 3), p, r, s), col); },
    /** cilindro cónico entre dos puntos (r1 en a, r2 en b) */
    limb(k, col, a, b, r1, r2, n) {
      v1.set(a[0], a[1], a[2]); v2.set(b[0], b[1], b[2]); v3.subVectors(v2, v1); const len = v3.length() || 1e-3;
      const g = new T.CylinderGeometry(r2, r1, len, sg(n), 1); Q.setFromUnitVectors(UPV, v3.normalize()); M.compose(v1.clone().add(v2).multiplyScalar(0.5), Q, new T.Vector3(1, 1, 1)); g.applyMatrix4(M); put(k, g, col);
    },
    /** cono aplanado entre dos puntos (cuchilla afilada) */
    spike(k, col, a, b, w, th) {
      v1.set(a[0], a[1], a[2]); v2.set(b[0], b[1], b[2]); v3.subVectors(v2, v1); const len = v3.length() || 1e-3;
      const g = new T.ConeGeometry(0.5, len, 4, 1); g.rotateY(Math.PI / 4); g.scale(w, 1, th); Q.setFromUnitVectors(UPV, v3.normalize()); M.compose(v1.clone().add(v2).multiplyScalar(0.5), Q, new T.Vector3(1, 1, 1)); g.applyMatrix4(M); put(k, g, col);
    },
    tri(k, col, a, b, c) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array([...a, ...b, ...c]), 3)); g.computeVertexNormals(); put(k, g, col); },
    /** placa: polígono en el plano XY extruido en Z (grosor th) con bisel suave */
    plate(k, col, pts, th = 0.02, p = ZERO, r = ZERO, s = ONE, bev = 0.006) {
      const sh = new T.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
      const g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.002, th - bev * 2), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 1, steps: 1 });
      g.translate(0, 0, -(th - bev * 2) / 2); put(k, tf(g, p, r, s), col);
    },
    /** tubo que sigue una curva fn(u)→[x,y,z], u∈[0,1] */
    arc(k, col, fn, n, r0, r1, seg = 4) { for (let i = 0; i < n; i++) { const a = fn(i / n), b = fn((i + 1) / n), u = i / Math.max(1, n - 1); B.limb(k, col, a, b, r0 + (r1 - r0) * u, r0 + (r1 - r0) * Math.min(1, u + 1 / n), seg); } },
  };
  /** une las piezas de cada tipo en una sola malla */
  B.finish = (mats, group, orbit) => {
    let draws = 0, tris = 0;
    for (const kind of Object.keys(buckets)) {
      const arr = buckets[kind]; if (!arr.length) continue;
      let n = 0; for (const g of arr) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
      for (const g of arr) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
      const mat = mats[kind === 'ob' ? 'body' : kind === 'og' ? 'glow' : kind], mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false; mesh.name = 'melee:' + kind;
      if (kind === 'mem' || kind === 'aura' || kind === 'cage') mesh.renderOrder = 3;
      (kind === 'ob' || kind === 'og' ? orbit : group).add(mesh); draws++; tris += n / 3;
      buckets[kind] = [];
    }
    return { draws, tris };
  };
  B.has = (k) => buckets[k].length > 0;
  return B;
}

/* ───────────────────────── armas: cada una dibuja en `B` con su paleta ───────────────────────── */
// Cada función devuelve metadatos para la fusión: { base (y donde sube el empuñe), top (punta), guardY, hw (media anchura), fz (media grosor), mid, rad }
const mixc = (a, b, u) => { const A = [(a >> 16) & 255, (a >> 8) & 255, a & 255], C = [(b >> 16) & 255, (b >> 8) & 255, b & 255]; return (Math.round(A[0] + (C[0] - A[0]) * u) << 16) | (Math.round(A[1] + (C[1] - A[1]) * u) << 8) | Math.round(A[2] + (C[2] - A[2]) * u); };
const gripWrap = (B, col, col2, y0, y1, r, rings = 4) => { B.cyl('body', col, r, r, y1 - y0, [0, (y0 + y1) / 2, 0]); for (let i = 0; i < rings; i++) B.cyl('body', col2, r * 1.18, r * 1.18, 0.014, [0, y0 + (y1 - y0) * ((i + 0.5) / rings), 0]); };
const ribs = (B, col, y, n, r, w = 0.01) => { for (let i = 0; i < n; i++) B.tor('body', col, r, w, [0, y + i * 0.05, 0], [Math.PI / 2, 0, 0], 6); };

const W = {
  /* ═════ ESPADAS ═════ */
  filo_oseo(B, c, t) {
    const BONE = 0xece1c6, BONE2 = 0xb7a883, MAR = c.g;
    gripWrap(B, BONE2, 0x3a2c22, -0.16, 0.08, 0.026, 4);
    B.ico('body', BONE, 0.05, [0, -0.2, 0], [1, 1.1, 0.9]); B.cone('body', BONE2, 0.012, 0.07, [0.03, -0.24, 0.02], [0, 0, 0.5], 4); B.cone('body', BONE2, 0.012, 0.07, [-0.03, -0.24, -0.02], [0, 0, -0.5], 4);
    B.arc('body', BONE, (u) => [0.02 + u * 0.17, 0.09 + Math.sin(u * 2.4) * 0.07, 0], 4, 0.022, 0.012); B.arc('body', BONE, (u) => [-0.02 - u * 0.17, 0.09 + Math.sin(u * 2.4) * 0.07, 0], 4, 0.022, 0.012);
    B.sph('body', BONE2, 0.04, [0, 0.1, 0], [1.1, 0.8, 1.1]);
    B.plate('body', BONE, [[-0.06, 0.1], [0.06, 0.1], [0.07, 0.4], [0.055, 0.8], [0.0, 1.28], [-0.05, 0.9], [-0.07, 0.75], [-0.045, 0.68], [-0.075, 0.5], [-0.045, 0.43], [-0.075, 0.3]], 0.026, [0, 0, 0], ZERO, ONE, 0.007);
    // dientes de hueso del lado izquierdo (serrado)
    for (let i = 0; i < 4 + (t >= 2 ? 1 : 0); i++) B.spike('body', BONE2, [-0.05, 0.3 + i * 0.16, 0], [-0.13 - (i % 2) * 0.02, 0.4 + i * 0.16, 0], 0.045, 0.02);
    B.box('glow', MAR, [0.014, 0.82, 0.03], [0.01, 0.6, 0], ZERO); B.sph('glow', MAR, 0.02, [0.0, 0.14, 0.02]);
    return { base: 0.1, top: 1.28, guardY: 0.1, hw: 0.07, fz: 0.016, mid: 0.7, rad: 0.12 };
  },
  sable_plasma(B, c, t) {
    const MET = 0x2a3140, MET2 = 0x59657c, CY = c.g, PK = c.h;
    gripWrap(B, MET, MET2, -0.17, 0.05, 0.024, 3); B.cyl('body', MET2, 0.03, 0.036, 0.05, [0, -0.2, 0]);
    B.cyl('body', MET2, 0.032, 0.05, 0.08, [0, 0.09, 0]); B.tor('glow', CY, 0.044, 0.007, [0, 0.12, 0], [Math.PI / 2, 0, 0], 6);
    for (const s of [-1, 1]) { B.arc('body', MET, (u) => [s * (0.045 + u * 0.075), 0.1 + u * 0.2, 0], 4, 0.016, 0.008); B.sph('glow', PK, 0.014, [s * 0.12, 0.3, 0]); }
    B.box('glow', 0xffffff, [0.022, 1.02, 0.022], [0, 0.66, 0]); B.cone('glow', 0xffffff, 0.022, 0.1, [0, 1.22, 0], ZERO, 4);
    B.sph('mem', CY, 0.075, [0, 0.66, 0], [1, 7.6, 1], 6); B.sph('mem', PK, 0.045, [0, 0.66, 0], [1, 8.4, 1], 5);
    for (let i = 0; i < 3 + (t >= 3 ? 2 : 0); i++) B.tor('glow', i % 2 ? PK : CY, 0.06 + (i % 2) * 0.02, 0.005, [0, 0.3 + i * 0.22, 0], [Math.PI / 2 + i * 0.4, i * 0.5, 0], 6);
    return { base: 0.12, top: 1.28, guardY: 0.12, hw: 0.07, fz: 0.03, mid: 0.7, rad: 0.15, vein: false };
  },
  hoja_umbral(B, c, t) {
    const VO = 0x40308a, VO2 = 0x7a5cd0, VI = c.g, GH = c.h;
    gripWrap(B, 0x1b1030, VO2, -0.16, 0.06, 0.025, 3); B.oct('body', VO2, 0.05, [0, -0.2, 0], [1, 1.3, 1]);
    for (const s of [-1, 1]) B.plate('body', VO2, [[0.02 * s, 0.04], [0.19 * s, 0.14], [0.22 * s, 0.26], [0.1 * s, 0.17], [0.02 * s, 0.17]], 0.03);
    // dos mitades de cristal con una grieta luminosa entre ellas; la punta flota separada
    B.plate('body', VO, [[0.024, 0.13], [0.11, 0.3], [0.1, 0.78], [0.022, 0.8]], 0.03); B.plate('body', VO, [[-0.024, 0.13], [-0.11, 0.3], [-0.1, 0.78], [-0.022, 0.8]], 0.03);
    B.plate('body', VO2, [[0.0, 0.92], [0.085, 1.08], [0.0, 1.5], [-0.085, 1.08]], 0.03);
    B.box('glow', VI, [0.034, 0.7, 0.012], [0, 0.46, 0]); B.oct('glow', GH, 0.03, [0, 0.86, 0], [0.8, 1.1, 0.5]); B.box('glow', VI, [0.016, 0.5, 0.012], [0, 1.1, 0]);
    for (let i = 0; i < 4 + (t >= 2 ? 2 : 0); i++) { const a = i * 1.7, y = 0.3 + i * 0.2; B.oct('body', VO2, 0.035, [Math.sin(a) * 0.15, y, Math.cos(a) * 0.08], [0.7, 1.6, 0.7], [a, a, 0]); B.oct('glow', GH, 0.012, [Math.sin(a) * 0.15, y, Math.cos(a) * 0.08], [0.7, 1.6, 0.7], [a, a, 0]); }
    return { base: 0.12, top: 1.5, guardY: 0.15, hw: 0.1, fz: 0.02, mid: 0.8, rad: 0.18, vein: false };
  },
  /* ═════ HACHAS ═════ */
  hacha_quitina(B, c, t) {
    const CH = 0x5a3a24, CH2 = 0x9a6a3c, EDGE = 0xe9d8b0, G = c.g;
    B.cyl('body', CH, 0.026, 0.03, 1.14, [0, 0.38, 0]); ribs(B, CH2, -0.12, 5, 0.031, 0.011); B.cone('body', CH2, 0.04, 0.16, [0, -0.28, 0], [Math.PI, 0, 0], 4);
    B.plate('body', EDGE, [[0.03, 0.58], [0.1, 0.72], [0.12, 0.86], [0.22, 1.0], [0.36, 1.03], [0.43, 0.84], [0.45, 0.66], [0.43, 0.48], [0.36, 0.29], [0.22, 0.32], [0.12, 0.46]], 0.036, [0, 0, 0], ZERO, ONE, 0.01);
    B.plate('body', CH2, [[0.03, 0.74], [0.12, 0.8], [0.2, 0.74], [0.2, 0.6], [0.12, 0.54], [0.03, 0.58]], 0.05);
    B.spike('body', CH, [-0.02, 0.66, 0], [-0.24, 0.72, 0], 0.07, 0.04); B.spike('body', CH2, [0, 1.0, 0], [0.02, 1.2, 0], 0.07, 0.05);
    for (let i = 0; i < 3 + (t >= 2 ? 1 : 0); i++) B.spike('body', CH2, [0.14 + i * 0.05, 0.9 - i * 0.12, 0.02], [0.18 + i * 0.07, 0.99 - i * 0.12, 0.05], 0.03, 0.03);
    B.limb('glow', G, [0.34, 1.0, 0.0], [0.43, 0.84, 0.0], 0.008, 0.008, 3); B.limb('glow', G, [0.43, 0.84, 0.0], [0.45, 0.66, 0.0], 0.008, 0.008, 3); B.limb('glow', G, [0.45, 0.66, 0.0], [0.43, 0.48, 0.0], 0.008, 0.008, 3); B.limb('glow', G, [0.43, 0.48, 0.0], [0.34, 0.31, 0.0], 0.008, 0.008, 3); B.sph('glow', G, 0.02, [0.09, 0.66, 0.028], [1, 1, 0.6]);
    return { base: 0.2, top: 1.2, guardY: 0.5, hw: 0.04, fz: 0.03, mid: 0.7, rad: 0.32, vein: [0, 0.2, 0.6] };
  },
  hacha_doble(B, c, t) {
    const ST = 0x3a4a62, ST2 = 0x7f93b4, G = c.g, G2 = c.h;
    B.cyl('body', ST, 0.025, 0.028, 1.1, [0, 0.36, 0]); ribs(B, ST2, -0.14, 4, 0.03, 0.01); B.cone('body', ST2, 0.035, 0.14, [0, -0.28, 0], [Math.PI, 0, 0], 4);
    for (const s of [-1, 1]) {
      B.plate('body', ST2, [[0.02 * s, 0.86], [0.12 * s, 0.94], [0.27 * s, 0.98], [0.37 * s, 0.7], [0.27 * s, 0.42], [0.12 * s, 0.46], [0.02 * s, 0.54]].map((p) => p), 0.034, [0, 0, 0], ZERO, ONE, 0.009);
      B.limb('glow', G, [0.28 * s, 0.97, 0.0], [0.37 * s, 0.7, 0.0], 0.007, 0.007, 3); B.limb('glow', G, [0.37 * s, 0.7, 0.0], [0.28 * s, 0.43, 0.0], 0.007, 0.007, 3);
      B.spike('body', ST, [0.1 * s, 0.7, 0.02], [0.28 * s, 0.7, 0.02], 0.1, 0.05);
    }
    B.oct('body', ST, 0.075, [0, 0.7, 0], [1, 1.3, 1]); B.oct('glow', G2, 0.035, [0, 0.7, 0.04], [1, 1.4, 0.8]); B.spike('body', ST2, [0, 0.76, 0], [0, 1.18, 0], 0.07, 0.05);
    if (t >= 2) for (const s of [-1, 1]) B.oct('glow', G, 0.02, [0.2 * s, 0.7, 0.03], [1, 1.8, 0.8]);
    return { base: 0.2, top: 1.18, guardY: 0.55, hw: 0.04, fz: 0.03, mid: 0.7, rad: 0.38, vein: [0, 0.2, 0.62] };
  },
  segur_vorax(B, c, t) {
    const DK = 0x2a0e14, RD = 0x7a1a26, TO = 0xf4e8d0, G = c.g;
    B.cyl('body', DK, 0.027, 0.03, 1.1, [0, 0.36, 0]); ribs(B, RD, -0.12, 5, 0.032, 0.012); for (let i = 0; i < 3; i++) B.limb('glow', G, [0.022, 0.0 + i * 0.3, 0.012], [-0.022, 0.2 + i * 0.3, 0.012], 0.005, 0.005, 3);
    B.cone('body', RD, 0.045, 0.16, [0, -0.28, 0], [Math.PI, 0, 0], 4);
    // mandíbula: dos quijadas con dientes
    B.plate('body', RD, [[0.0, 0.86], [0.14, 0.98], [0.3, 0.92], [0.34, 0.74], [0.2, 0.74], [0.04, 0.72]], 0.04, [0, 0, 0], ZERO, ONE, 0.009);
    B.plate('body', DK, [[0.0, 0.52], [0.14, 0.42], [0.3, 0.48], [0.34, 0.64], [0.2, 0.64], [0.04, 0.66]], 0.04, [0, 0, 0], ZERO, ONE, 0.009);
    for (let i = 0; i < 4 + (t >= 2 ? 1 : 0); i++) { const x = 0.07 + i * 0.065; B.spike('body', TO, [x, 0.74, 0.0], [x + 0.012, 0.64 - (i === 3 ? 0.0 : 0.0), 0.0], 0.045, 0.026); B.spike('body', TO, [x + 0.03, 0.64, 0.0], [x + 0.018, 0.74, 0.0], 0.04, 0.026); }
    B.sph('glow', G, 0.045, [0.0, 0.7, 0.03], [1, 1.3, 0.8]); B.box('glow', 0x1a0006, [0.012, 0.05, 0.012], [0.0, 0.7, 0.075]);
    for (const s of [-1, 1]) B.spike('body', DK, [-0.01, 0.7 + s * 0.12, 0], [-0.12, 0.7 + s * 0.26, 0], 0.05, 0.03);
    B.limb('glow', G, [0.3, 0.92, 0.0], [0.34, 0.74, 0.0], 0.007, 0.007, 3);
    return { base: 0.2, top: 1.0, guardY: 0.5, hw: 0.04, fz: 0.03, mid: 0.7, rad: 0.28, vein: [0, 0.2, 0.62] };
  },
  /* ═════ MARTILLOS ═════ */
  martillo_sismico(B, c, t) {
    const RK = 0x4a4350, RK2 = 0x7a7083, OR = c.g, OR2 = c.h;
    B.cyl('body', 0x2c2430, 0.03, 0.034, 1.0, [0, 0.3, 0]); ribs(B, RK2, -0.14, 4, 0.036, 0.012); B.cyl('body', RK, 0.05, 0.05, 0.05, [0, -0.2, 0]);
    B.box('body', RK, [0.46, 0.3, 0.3], [0, 0.88, 0], [0, 0, 0.0]); B.box('body', RK2, [0.4, 0.06, 0.34], [0, 1.0, 0]); B.box('body', RK2, [0.4, 0.06, 0.34], [0, 0.76, 0]);
    for (const s of [-1, 1]) { B.box('body', RK2, [0.1, 0.34, 0.34], [0.26 * s, 0.88, 0]); B.cone('body', RK, 0.12, 0.16, [0.36 * s, 0.88, 0], [0, 0, -Math.PI / 2 * s], 4, [1, 1, 1]); }
    // grietas de lava
    B.box('glow', OR, [0.34, 0.016, 0.01], [0, 0.9, 0.152], [0, 0, 0.12]); B.box('glow', OR, [0.016, 0.22, 0.01], [-0.06, 0.88, 0.152], [0, 0, 0.3]); B.box('glow', OR2, [0.2, 0.014, 0.01], [0.08, 0.82, 0.152], [0, 0, -0.2]);
    B.box('glow', OR, [0.34, 0.016, 0.01], [0, 0.9, -0.152], [0, 0, -0.12]);
    for (let i = 0; i < 3 + (t >= 2 ? 2 : 0); i++) { const a = i * 2.1; B.oct('body', RK2, 0.04 + (i % 2) * 0.02, [Math.sin(a) * 0.3, 1.22 + (i % 2) * 0.06, Math.cos(a) * 0.1], [1, 1.2, 1], [a, a, 0]); B.oct('glow', OR, 0.012, [Math.sin(a) * 0.3, 1.22 + (i % 2) * 0.06, Math.cos(a) * 0.1]); }
    B.cone('body', RK2, 0.07, 0.18, [0, 1.12, 0], ZERO, 4);
    return { base: 0.25, top: 1.2, guardY: 0.6, hw: 0.1, fz: 0.15, mid: 0.88, rad: 0.38, vein: false };
  },
  maza_espora(B, c, t) {
    const FL = 0x4a5a2a, FL2 = 0x86a63a, CAP = 0xc9732a, SP = c.g, SP2 = c.h;
    B.cyl('body', 0x3a3220, 0.028, 0.034, 1.0, [0, 0.3, 0]); ribs(B, FL2, -0.12, 4, 0.036, 0.012);
    B.arc('body', 0x3a3220, (u) => [Math.sin(u * 6) * 0.04, 0.08 + u * 0.5, Math.cos(u * 6) * 0.04], 8, 0.014, 0.01);
    B.sph('body', FL, 0.19, [0, 0.92, 0], [1, 1.05, 1], 7);
    for (let i = 0; i < 9; i++) { const a = i * 2.4, e = i / 9 * 2 - 1, r = Math.sqrt(1 - e * e) * 0.19, x = Math.cos(a) * r, z = Math.sin(a) * r; B.cone('body', CAP, 0.05, 0.1, [x * 1.1, 0.92 + e * 0.2, z * 1.1], [Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0], 5); B.sph('glow', SP, 0.016, [x * 1.28, 0.92 + e * 0.2, z * 1.28], [1, 1, 1], 3); }
    B.cone('body', CAP, 0.1, 0.12, [0, 1.15, 0], ZERO, 6); B.cone('body', FL2, 0.04, 0.2, [0, 1.3, 0], ZERO, 4);
    for (let i = 0; i < 5 + (t >= 2 ? 3 : 0); i++) { const a = i * 1.3; B.sph('mem', SP2, 0.03 + (i % 3) * 0.01, [Math.sin(a) * 0.3, 0.7 + i * 0.1, Math.cos(a) * 0.3], [1, 1, 1], 4); }
    B.sph('mem', SP, 0.26, [0, 0.92, 0], [1, 1, 1], 6);
    return { base: 0.25, top: 1.3, guardY: 0.62, hw: 0.19, fz: 0.19, mid: 0.92, rad: 0.36, vein: false };
  },
  yunque_vital(B, c, t) {
    const FS = 0x6a2a3a, FS2 = 0xb04a5c, BN = 0xe6d4b8, G = c.g;
    B.cyl('body', 0x2a1820, 0.036, 0.042, 0.62, [0, 0.14, 0]); ribs(B, BN, -0.12, 4, 0.045, 0.014);
    B.cone('body', BN, 0.05, 0.12, [0, -0.24, 0], [Math.PI, 0, 0], 5);
    // cabeza de yunque: base, cintura, mesa superior y cuerno
    B.box('body', FS, [0.34, 0.1, 0.26], [0, 0.5, 0]); B.box('body', FS2, [0.22, 0.12, 0.2], [0, 0.6, 0]); B.box('body', FS, [0.5, 0.14, 0.3], [0, 0.73, 0]);
    B.cone('body', FS2, 0.1, 0.24, [0.36, 0.73, 0], [0, 0, -Math.PI / 2], 5); B.box('body', BN, [0.5, 0.025, 0.31], [0, 0.81, 0]);
    for (let i = 0; i < 3; i++) B.cone('body', BN, 0.02, 0.1, [-0.2 + i * 0.07, 0.86, 0.08 - i * 0.04], ZERO, 4);
    B.sph('glow', G, 0.06 + (t >= 2 ? 0.01 : 0), [0, 0.62, 0.11], [1, 1.1, 0.7], 5); B.sph('mem', G, 0.1, [0, 0.62, 0.11], [1, 1, 0.8], 5);
    for (let i = 0; i < 4; i++) B.limb('glow', G, [0.04 * (i - 1.5), 0.62, 0.15], [0.2 * (i - 1.5), 0.78 + (i % 2) * 0.02, 0.15], 0.006, 0.006, 3);
    B.limb('glow', G, [0.0, 0.5, 0.14], [0.0, 0.62, 0.14], 0.01, 0.01, 3);
    return { base: 0.22, top: 0.86, guardY: 0.45, hw: 0.06, fz: 0.06, mid: 0.7, rad: 0.3, vein: false };
  },
  /* ═════ LANZAS ═════ */
  lanza_sinaptica(B, c, t) {
    const NV = 0xd9e9ea, DK = 0x1f3a40, G = c.g, G2 = c.h;
    B.cyl('body', DK, 0.019, 0.021, 1.9, [0, 0.55, 0]); ribs(B, NV, -0.14, 6, 0.026, 0.008); B.sph('glow', G, 0.04, [0, -0.43, 0], ONE, 5); B.cone('body', DK, 0.03, 0.12, [0, -0.5, 0], [Math.PI, 0, 0], 4);
    B.spike('body', NV, [0, 1.5, 0], [0, 2.1, 0], 0.11, 0.035); B.box('glow', G, [0.012, 0.5, 0.045], [0, 1.78, 0]);
    // dendritas: ramas finas con bulbo sináptico
    const nb = 5 + (t >= 2 ? 2 : 0);
    for (let i = 0; i < nb; i++) { const a = i * 2.4, y = 1.0 + i * 0.09, dx = Math.cos(a), dz = Math.sin(a); B.limb('glow', G, [0, y, 0], [dx * 0.12, y + 0.14, dz * 0.12], 0.006, 0.004, 3); B.limb('glow', G, [dx * 0.12, y + 0.14, dz * 0.12], [dx * 0.17, y + 0.3, dz * 0.17], 0.004, 0.003, 3); B.sph('glow', G2, 0.014, [dx * 0.17, y + 0.3, dz * 0.17], ONE, 3); }
    B.tor('body', NV, 0.04, 0.012, [0, 1.46, 0], [Math.PI / 2, 0, 0], 6);
    return { base: 0.4, top: 2.1, guardY: 1.4, hw: 0.05, fz: 0.03, mid: 1.5, rad: 0.2, vein: false };
  },
  pica_cristal(B, c, t) {
    const SH = 0xe8f2fa, CR = 0x9ad8f0, DK = 0x2a3c4c, G = c.g;
    B.cyl('body', DK, 0.018, 0.02, 2.0, [0, 0.6, 0]); ribs(B, SH, -0.14, 6, 0.025, 0.008); B.cone('body', CR, 0.03, 0.14, [0, -0.52, 0], [Math.PI, 0, 0], 5);
    // punta de cristal hexagonal
    B.cyl('body', CR, 0.055, 0.075, 0.45, [0, 1.8, 0], ZERO, 6); B.cone('body', SH, 0.055, 0.32, [0, 2.18, 0], ZERO, 6); B.cone('body', CR, 0.075, 0.1, [0, 1.52, 0], [Math.PI, 0, 0], 6);
    B.cyl('mem', G, 0.04, 0.058, 0.44, [0, 1.8, 0], ZERO, 6); B.cone('mem', G, 0.04, 0.3, [0, 2.18, 0], ZERO, 6); B.cyl('glow', G, 0.012, 0.012, 0.6, [0, 1.85, 0], ZERO, 4);
    for (let i = 0; i < 4 + (t >= 2 ? 2 : 0); i++) { const a = i * 1.57 + (i > 3 ? 0.8 : 0), y = 1.46 + (i % 2) * 0.06; B.spike('body', SH, [Math.cos(a) * 0.05, y, Math.sin(a) * 0.05], [Math.cos(a) * 0.17, y + 0.2 + (i > 3 ? 0.08 : 0), Math.sin(a) * 0.17], 0.05, 0.05); }
    return { base: 0.4, top: 2.5, guardY: 1.45, hw: 0.07, fz: 0.07, mid: 1.8, rad: 0.2, vein: false };
  },
  tridente_abisal(B, c, t) {
    const AB = 0x16405a, AB2 = 0x2a8aa8, PE = 0xcfe9f2, G = c.g, G2 = c.h;
    B.cyl('body', AB, 0.022, 0.026, 1.7, [0, 0.45, 0]); ribs(B, AB2, -0.14, 5, 0.03, 0.01); B.cone('body', AB2, 0.04, 0.16, [0, -0.46, 0], [Math.PI, 0, 0], 5);
    B.cyl('body', AB2, 0.045, 0.03, 0.16, [0, 1.34, 0]);
    // tres púas: la central recta, las laterales curvas, con ganchos
    B.spike('body', PE, [0, 1.4, 0], [0, 2.05, 0], 0.09, 0.04); B.box('glow', G, [0.01, 0.4, 0.03], [0, 1.7, 0]);
    for (const s of [-1, 1]) {
      B.arc('body', AB2, (u) => [s * (0.05 + Math.sin(u * 1.5) * 0.17), 1.38 + u * 0.55, 0], 5, 0.026, 0.014);
      B.spike('body', PE, [s * 0.2, 1.8, 0], [s * 0.19, 2.02, 0], 0.07, 0.035); B.spike('body', PE, [s * 0.2, 1.64, 0], [s * 0.3, 1.72, 0], 0.045, 0.03); B.sph('glow', G2, 0.016, [s * 0.19, 2.02, 0.0], ONE, 3);
    }
    for (let i = 0; i < 4; i++) { const a = i * 1.57; B.arc('body', AB, (u) => [Math.cos(a) * (0.05 + u * 0.1), 1.3 - u * 0.14 + Math.sin(u * 3) * 0.03, Math.sin(a) * (0.05 + u * 0.1)], 4, 0.014, 0.006); B.sph('glow', G, 0.012, [Math.cos(a) * 0.15, 1.16, Math.sin(a) * 0.15], ONE, 3); }
    if (t >= 2) for (let i = 0; i < 4; i++) B.sph('glow', G, 0.014, [0.02, 0.9 + i * 0.1, 0.03], ONE, 3);
    return { base: 0.4, top: 2.05, guardY: 1.34, hw: 0.05, fz: 0.03, mid: 1.6, rad: 0.3, vein: false };
  },
  /* ═════ DAGAS ═════ */
  daga_neurotoxica(B, c, t) {
    const DK = 0x1c2a1c, GR = 0x3f7a3a, BL = 0xcfe0c0, G = c.g;
    gripWrap(B, DK, GR, -0.12, 0.04, 0.022, 3); B.sph('body', GR, 0.035, [0, -0.15, 0]);
    for (const s of [-1, 1]) B.spike('body', GR, [0.01 * s, 0.05, 0], [0.12 * s, 0.1, 0], 0.045, 0.03);
    B.plate('body', BL, [[-0.05, 0.05], [0.055, 0.05], [0.06, 0.22], [0.075, 0.38], [0.04, 0.5], [-0.02, 0.58], [-0.045, 0.4], [-0.05, 0.2]], 0.022, [0, 0, 0], ZERO, ONE, 0.006);
    B.box('glow', G, [0.014, 0.34, 0.026], [0.005, 0.28, 0]); B.sph('glow', G, 0.026, [0, 0.1, 0.03], [1, 1.3, 0.8]); B.sph('mem', G, 0.055, [0, 0.1, 0.03], [1, 1.3, 0.9], 5);
    for (let i = 0; i < 3 + (t >= 2 ? 2 : 0); i++) B.sph('glow', G, 0.009, [0.05, 0.25 + i * 0.09, 0.03], ONE, 3);
    return { base: 0.05, top: 0.58, guardY: 0.06, hw: 0.06, fz: 0.012, mid: 0.3, rad: 0.1, vein: [0.005, 0.1, 0.5] };
  },
  colmillo(B, c, t) {
    const IV = 0xf2ead4, IV2 = 0xcabc9a, RT = 0x7a3a3a, G = c.g;
    gripWrap(B, IV2, 0x5a4030, -0.14, 0.04, 0.024, 3); B.ico('body', RT, 0.05, [0, -0.17, 0], [1, 1.2, 1]);
    for (let i = 0; i < 4; i++) { const a = i * 1.57; B.limb('body', RT, [0, -0.15, 0], [Math.cos(a) * 0.08, -0.26, Math.sin(a) * 0.08], 0.015, 0.006, 3); }
    // el colmillo: un arco ancho que se afila
    B.arc('body', IV, (u) => [u * u * 0.2, 0.04 + u * 0.62, 0], 7, 0.062, 0.006, 5);
    B.arc('body', IV2, (u) => [u * u * 0.2 - 0.03, 0.06 + u * 0.5, 0.0], 5, 0.02, 0.004, 4);
    B.limb('glow', G, [0.0, 0.1, 0.045], [0.07, 0.4, 0.04], 0.009, 0.005, 3); B.sph('glow', G, 0.014, [0.2, 0.66, 0.0], ONE, 3);
    for (let i = 0; i < 2 + (t >= 2 ? 1 : 0); i++) B.spike('body', IV, [0.0, 0.2 + i * 0.15, 0], [-0.1 - i * 0.01, 0.3 + i * 0.15, 0], 0.05, 0.03);
    return { base: 0.05, top: 0.68, guardY: 0.05, hw: 0.06, fz: 0.05, mid: 0.35, rad: 0.12, vein: false };
  },
  aguja_fantasma(B, c, t) {
    const MT = 0x14161e, SV = 0xd6e2f2, G = c.g;
    gripWrap(B, MT, 0x4a5568, -0.16, 0.04, 0.02, 3); B.tor('body', SV, 0.04, 0.009, [0, 0.06, 0], [0, Math.PI / 2, 0], 6); B.tor('glow', G, 0.05, 0.005, [0, 0.0, 0], [Math.PI / 2, 0, 0], 6);
    B.cyl('body', SV, 0.005, 0.014, 0.92, [0, 0.52, 0], ZERO, 4); B.cyl('glow', 0xffffff, 0.004, 0.004, 0.88, [0, 0.52, 0], ZERO, 3); B.tor('body', SV, 0.012, 0.004, [0, 0.12, 0], ZERO, 5);
    for (const s of [-1, 1]) { B.cyl('mem', G, 0.004, 0.016, 0.9, [0.07 * s, 0.5 + s * 0.04, 0], [0, 0, -0.04 * s], 4); B.tor('glow', G, 0.07 + (s > 0 ? 0.02 : 0), 0.004, [0, 0.34 + s * 0.15, 0], [Math.PI / 2, 0, 0], 8); }
    for (let i = 0; i < 2 + (t >= 2 ? 2 : 0); i++) B.sph('glow', G, 0.01, [Math.sin(i * 2.1) * 0.06, 0.2 + i * 0.2, Math.cos(i * 2.1) * 0.06], ONE, 3);
    return { base: 0.05, top: 0.98, guardY: 0.05, hw: 0.014, fz: 0.014, mid: 0.5, rad: 0.1, vein: false };
  },
  /* ═════ INNATAS (las armas que cada Huésped lleva consigo) ═════ */
  cuchillas(B, c, t) {
    const NEG = 0x1c2230, ARM = 0x3a4458, BL = 0xdfe8f0, G = c.g, G2 = c.h;
    B.cyl('body', ARM, 0.05, 0.06, 0.34, [0, -0.12, 0]); B.box('body', NEG, [0.16, 0.06, 0.12], [0, 0.07, 0]); B.box('glow', G, [0.012, 0.3, 0.012], [0.052, -0.12, 0.02]);
    for (const s of [-1, 1]) {
      B.plate('body', BL, [[0.0, 0.05], [0.04 * s, 0.05], [0.05 * s, 0.5], [0.03 * s, 0.9], [-0.005 * s, 0.05]].map(([x, y]) => [x, y]), 0.022, [0.04 * s, 0, 0], [0, 0, -0.08 * s], ONE, 0.006);
      B.box('glow', G2, [0.008, 0.72, 0.026], [0.07 * s, 0.46, 0], [0, 0, -0.06 * s]);
    }
    for (let i = 0; i < 2 + (t >= 2 ? 1 : 0); i++) B.spike('body', ARM, [0, 0.0 + i * 0.05, -0.04], [0, 0.18 + i * 0.05, -0.12], 0.05, 0.03);
    return { base: 0.1, top: 0.9, guardY: 0.08, hw: 0.08, fz: 0.02, mid: 0.5, rad: 0.12, vein: false };
  },
  garras(B, c, t) {
    const SK = 0x2a1a38, SK2 = 0x472a62, CL = 0xf0e6fa, G = c.g, G2 = c.h;
    B.box('body', SK2, [0.14, 0.08, 0.1], [0, 0.05, 0]); B.cyl('body', SK, 0.04, 0.05, 0.3, [0, -0.12, 0]); B.limb('glow', G, [0.04, -0.2, 0.03], [0.03, 0.0, 0.04], 0.007, 0.007, 3);
    for (let i = 0; i < 3 + (t >= 3 ? 1 : 0); i++) {
      const o = (i - (t >= 3 ? 1.5 : 1)) * 0.06, spread = o * 1.6; B.arc('body', CL, (u) => [o + spread * u * u, 0.08 + u * 0.7, -0.1 * u * u * 0 + u * u * 0.18 * (i % 2 ? 0.5 : 1)], 5, 0.03, 0.004, 4);
      B.sph('glow', G, 0.014, [o, 0.1, 0.03], ONE, 3);
    }
    B.sph('glow', G2, 0.016, [0, 0.0, 0.052], ONE, 3);
    return { base: 0.06, top: 0.8, guardY: 0.08, hw: 0.1, fz: 0.04, mid: 0.4, rad: 0.15, vein: false };
  },
  punos(B, c, t) {
    const CH = 0x2f3f20, CH2 = 0x587a34, CAP = 0xc9732a, CAP2 = 0x7be03a, G = c.g, G2 = c.h;
    B.cyl('body', CH, 0.07, 0.08, 0.22, [0, -0.1, 0]); B.tor('body', CH2, 0.085, 0.02, [0, -0.02, 0], [Math.PI / 2, 0, 0], 6);
    B.ico('body', CH, 0.17, [0, 0.1, 0], [1.15, 0.95, 1]); B.sph('body', CH2, 0.16, [0, 0.14, -0.02], [1.2, 0.5, 1.05], 6);
    for (let i = 0; i < 4; i++) { const x = -0.11 + i * 0.073; B.sph('body', CH2, 0.056, [x, 0.24, 0.1], [1, 1, 1], 5); B.cone('body', 0xe9e2c8, 0.022, 0.1, [x, 0.3, 0.12], [0.5, 0, 0], 4); }
    B.sph('body', CH2, 0.06, [0.17, 0.12, 0.07], [1, 1.3, 1], 5); B.sph('body', CH, 0.05, [-0.16, 0.05, 0.0], ONE, 5);
    for (let i = 0; i < 3 + (t >= 2 ? 2 : 0); i++) { const x = -0.12 + i * 0.1, h = 0.1 + (i % 2) * 0.06; B.cyl('body', 0xd8cdb0, 0.012, 0.016, h, [x, 0.3 + h / 2 - 0.04, -0.04], [0.2, 0, 0], 4); B.sph('body', i % 2 ? CAP2 : CAP, 0.05 + (i % 2) * 0.01, [x, 0.3 + h, -0.04], [1, 0.5, 1], 5); B.sph('glow', G, 0.012, [x + 0.02, 0.33 + h, -0.01], ONE, 3); }
    B.sph('glow', G2, 0.026, [0.06, 0.12, 0.17], [1, 1, 0.5], 4); B.limb('glow', G, [-0.12, 0.04, 0.15], [0.1, 0.14, 0.16], 0.007, 0.007, 3);
    return { base: 0.0, top: 0.4, guardY: 0.0, hw: 0.17, fz: 0.14, mid: 0.15, rad: 0.2, vein: false };
  },
  hoja_dim(B, c, t) {
    const VO = 0x3a2a7a, VO2 = 0x7a5cd0, VI = c.g, GH = c.h;
    B.cyl('body', 0x140a24, 0.026, 0.032, 0.3, [0, -0.1, 0]); B.oct('body', VO2, 0.05, [0, 0.07, 0], [1, 0.8, 1]); B.tor('glow', VI, 0.07, 0.006, [0, 0.07, 0], [Math.PI / 2, 0, 0], 8);
    // hoja = octaedro alargado partido en segmentos que no se tocan
    B.plate('body', VO, [[0, 0.16], [0.06, 0.3], [0, 0.62], [-0.06, 0.3]], 0.024); B.plate('body', VO2, [[0, 0.7], [0.07, 0.86], [0, 1.2], [-0.07, 0.86]], 0.026); B.plate('body', VO, [[0, 1.28], [0.04, 1.4], [0, 1.62], [-0.04, 1.4]], 0.022);
    B.box('glow', GH, [0.012, 0.44, 0.012], [0, 0.4, 0.0]); B.box('glow', VI, [0.01, 0.4, 0.012], [0, 0.95, 0]); B.oct('glow', GH, 0.02, [0, 1.45, 0], [1, 2, 1]);
    B.tor('glow', VI, 0.12, 0.006, [0, 0.66, 0], [Math.PI / 2 - 0.3, 0, 0.2], 8); B.tor('glow', GH, 0.09, 0.005, [0, 1.24, 0], [Math.PI / 2 + 0.3, 0, 0], 8);
    for (let i = 0; i < 3 + (t >= 2 ? 2 : 0); i++) { const a = i * 2.2, y = 0.3 + i * 0.28; B.oct('body', VO2, 0.03, [Math.sin(a) * 0.12, y, Math.cos(a) * 0.1], [0.6, 1.7, 0.6], [a, a, 0]); B.oct('glow', GH, 0.01, [Math.sin(a) * 0.12, y, Math.cos(a) * 0.1], [0.6, 1.7, 0.6], [a, a, 0]); }
    return { base: 0.1, top: 1.62, guardY: 0.1, hw: 0.07, fz: 0.014, mid: 0.9, rad: 0.15, vein: false };
  },
  latigo(B, c, t) {
    const GD = c.g, GD2 = c.h, IV = 0xe9dcc2, DK = 0x3a2a1c;
    gripWrap(B, DK, 0xffd45a, -0.14, 0.06, 0.026, 4); B.sph('body', IV, 0.04, [0, 0.09, 0], [1, 0.9, 1]); B.sph('glow', GD2, 0.026, [0, 0.12, 0.02], ONE, 4);
    // látigo: cadena que dibuja una S ascendente, afinándose, con bulbo en la punta
    const P = (u) => [Math.sin(u * 7.0) * 0.16 * (0.4 + u), 0.1 + u * 1.5, Math.cos(u * 7.0) * 0.1 * u + u * u * 0.1];
    B.arc('body', IV, P, 12, 0.026, 0.006, 4); B.arc('glow', GD, (u) => { const p = P(u); return [p[0], p[1], p[2] + 0.018]; }, 12, 0.007, 0.003, 3);
    const e = P(1); B.sph('glow', GD2, 0.034, e, ONE, 4); B.sph('mem', GD, 0.07, e, ONE, 5);
    for (let i = 0; i < 5 + (t >= 2 ? 3 : 0); i++) { const u = 0.15 + i * 0.1, p = P(u); B.limb('glow', GD, p, [p[0] + Math.cos(i * 2.4) * 0.11, p[1] + 0.05, p[2] + Math.sin(i * 2.4) * 0.11], 0.004, 0.002, 3); }
    return { base: 0.1, top: 1.6, guardY: 0.1, hw: 0.1, fz: 0.04, mid: 0.8, rad: 0.2, vein: false };
  },
};

/* ───────────────────────── fusión / evolución (se suma a cualquier arma) ───────────────────────── */
const FLESH = 0x2a1620;
function fuse(B, info, tier, host) {
  if (tier < 1) return;
  const hc = host, fl = mixc(0x4a2a3a, hc, 0.5), fl2 = mixc(0x7a4a5c, hc, 0.6), veinC = mixc(0xffffff, hc, 0.5);
  const b = info.base == null ? 0.1 : info.base;
  // manga de tejido: sube por la muñeca (−Y), abraza el empuñe y se abre en tendones, anillos y bultos
  B.limb('body', fl, [0, 0.0, 0], [0, -0.3, 0], 0.062, 0.088, 6); B.sph('body', fl2, 0.078, [0, -0.04, 0], [1.1, 0.7, 1.1], 6);
  for (let i = 0; i < 3; i++) B.tor('body', fl2, 0.07 + i * 0.008, 0.012, [0, -0.1 - i * 0.07, 0], [Math.PI / 2, 0, 0], 6);
  for (let i = 0; i < 6; i++) { const a = i * 1.047 + 0.4; B.limb('body', fl2, [Math.cos(a) * 0.05, 0.02, Math.sin(a) * 0.05], [Math.cos(a) * 0.082, -0.27, Math.sin(a) * 0.082], 0.017, 0.012, 3); }
  for (let i = 0; i < 3; i++) { const a = i * 2.3; B.sph('body', fl2, 0.022, [Math.cos(a) * 0.075, -0.15 - i * 0.04, Math.sin(a) * 0.075], [1, 1.3, 1], 4); B.sph('glow', veinC, 0.008, [Math.cos(a) * 0.092, -0.15 - i * 0.04, Math.sin(a) * 0.092], ONE, 3); }
  // venas luminosas que suben en espiral desde la manga hasta la base de la hoja
  const nv = tier >= 3 ? 5 : tier >= 2 ? 4 : 3;
  for (let i = 0; i < nv; i++) {
    const a0 = i * (6.283 / nv);
    B.arc('glow', veinC, (u) => { const a = a0 + u * 3.4, r = 0.06 - u * 0.025; return [Math.cos(a) * r, -0.28 + u * (b + 0.28 + 0.08), Math.sin(a) * r]; }, 8, 0.0075, 0.005, 3);
  }
  if (tier >= 2) {
    // venas por la hoja + cristales de fusión en la guarda
    if (info.vein !== false) { const v = info.vein || [0, b, info.top * 0.8], x = v[0], y0 = v[1], y1 = v[2]; B.arc('glow', veinC, (u) => [x + Math.sin(u * 9) * 0.012, y0 + u * (y1 - y0), (info.fz || 0.02) + 0.003], 10, 0.0055, 0.003, 3); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.6, g = info.guardY || b; B.oct('body', fl2, 0.03, [Math.cos(a) * 0.075, g - 0.02, Math.sin(a) * 0.075], [0.7, 1.7, 0.7], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.7]); B.oct('glow', veinC, 0.014, [Math.cos(a) * 0.085, g, Math.sin(a) * 0.085], [0.7, 1.7, 0.7], [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.7]); }
  }
  if (tier >= 4) { // corona de espinas + halo
    for (let i = 0; i < 6; i++) { const a = i * 1.047; B.cone('body', fl2, 0.018, 0.12, [Math.cos(a) * 0.09, -0.14, Math.sin(a) * 0.09], [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9], 4); B.sph('glow', veinC, 0.01, [Math.cos(a) * 0.14, -0.1, Math.sin(a) * 0.14], ONE, 3); }
    B.tor('glow', veinC, 0.11, 0.006, [0, info.guardY == null ? b : info.guardY, 0], [Math.PI / 2, 0, 0], 8);
  }
}
function orbitParts(B, info, tier, host) {
  const n = tier >= 4 ? 6 : 4, r = (info.rad || 0.15) * 1.05 + 0.04, col = mixc(0x7a7a90, host, 0.35), gl = mixc(0xffffff, host, 0.5);
  for (let i = 0; i < n; i++) { const a = (i / n) * 6.283, y = (info.mid || 0.5) + Math.sin(i * 2.3) * (info.top || 1) * 0.28; B.oct('ob', col, 0.032 + (i % 2) * 0.012, [Math.cos(a) * r, y, Math.sin(a) * r], [0.7, 1.6, 0.7], [a, 0.4, 0.3]); B.oct('og', gl, 0.012, [Math.cos(a) * r, y, Math.sin(a) * r], [0.7, 1.6, 0.7], [a, 0.4, 0.3]); }
}

/** Colores canon de cada arma (glow principal g, acento h). Con tier ≥ 1 el brillo se tiñe de color del Huésped. */
const PAL = {
  filo_oseo: [0xff6a5a, 0xffc0a0], sable_plasma: [0x5cf2ff, 0xff4fd8], hoja_umbral: [0xb98cff, 0x40ffc0], hacha_quitina: [0xffa24a, 0xffd27a], hacha_doble: [0x5cf2ff, 0xa0e0ff],
  segur_vorax: [0xff2a4a, 0xffa0a0], martillo_sismico: [0xff7a2a, 0xffd23f], maza_espora: [0xb8ff5a, 0xe8ff9a], yunque_vital: [0xff5a7a, 0xffa0b0],
  lanza_sinaptica: [0x5cffd0, 0xffffff], pica_cristal: [0x7be8ff, 0xffffff], tridente_abisal: [0x30e0d0, 0x90ffe8], daga_neurotoxica: [0x7cff4a, 0xd0ff9a],
  colmillo: [0xff5a5a, 0xffc0c0], aguja_fantasma: [0xc8b8ff, 0xffffff], cuchillas: [0x3aa8ff, 0xbfe6ff], garras: [0xb04bff, 0xff3a8a], punos: [0x7be03a, 0xc6ff7a],
  hoja_dim: [0xb98cff, 0x40ffc0], latigo: [0xffd45a, 0xfff0b0],
};
/** Color canon del brillo de cada arma (por si la interfaz quiere teñirse con él). */
export const meleeGlow = (id) => (PAL[id] || [0xffffff])[0];

/** Construye el modelo de un arma. opts: { tier 0–4, quality 'low'|'medium'|'high', color (hex del Huésped, tiñe las venas desde tier 1) }. */
export function buildMelee(THREE, id, opts = {}) {
  const T = THREE, mk = W[id]; if (!mk) throw new Error('Arma desconocida: ' + id);
  const quality = opts.quality || 'low', S = quality === 'low' ? 5 : quality === 'medium' ? 6 : 8, host = opts.color == null ? 0xffffff : opts.color;
  const state = { tier: Math.max(0, Math.min(4, opts.tier | 0)), time: 0, info: null, counts: { draws: 0, tris: 0 }, dead: false };
  const group = new T.Group(); group.name = 'melee-' + id;
  const root = new T.Group(); group.add(root);
  const mats = {
    body: new T.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.48, flatShading: true }),
    glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    mem: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.38, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }),
    aura: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.07, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }),
    cage: new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, wireframe: true, toneMapped: false }),
  };
  let content = null, orbit = null, aura = null;
  function build() {
    if (content) { root.remove(content); content.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    content = new T.Group(); orbit = new T.Group(); content.add(orbit); root.add(content);
    const B = makeBuilder(T, S), tier = state.tier, pal = PAL[id] || [0xffffff, 0xffffff];
    // con la fusión el brillo del arma se tiñe poco a poco del color del Huésped
    const mixu = tier === 0 ? 0 : 0.18 + tier * 0.14, c = { g: mixc(pal[0], host, mixu), h: mixc(pal[1], host, mixu * 0.6), t: tier };
    const info = mk(B, c, tier); state.info = info;
    fuse(B, info, tier, host);
    if (tier >= 3) {
      orbitParts(B, info, tier, host); if (opts.aura !== false) {
      const ac = mixc(pal[0], host, 0.6), ar = (info.rad || 0.15) * 1.15 + 0.04, ay = Math.max(1.2, (info.top || 1) * 0.55 / ar);
      B.ico('aura', ac, ar, [0, info.mid || 0.5, 0], [1, ay, 1]); B.ico('cage', ac, ar * 1.02, [0, info.mid || 0.5, 0], [1, ay, 1]); }
    }
    state.counts = B.finish(mats, content, orbit);
    orbit.position.set(0, 0, 0);
    const s = tier >= 4 ? 1.1 : 1; content.scale.setScalar(s); group.userData.tier = tier;
  }
  build();
  const phase = (id.length * 1.37) % 6;
  function update(dt, t) {
    if (state.dead) return; state.time = t == null ? state.time + dt : t; const tm = state.time, tier = state.tier;
    const k = 0.85 + Math.sin(tm * 2.6 + phase) * (0.1 + tier * 0.02) + tier * 0.04;
    mats.glow.color.setScalar(k); mats.mem.opacity = 0.3 + tier * 0.03 + Math.sin(tm * 1.8 + phase) * 0.06; mats.cage.opacity = 0.26 + Math.sin(tm * 2.2 + phase) * 0.08;
    if (orbit) { orbit.rotation.y = tm * (0.9 + tier * 0.25); orbit.position.y = Math.sin(tm * 1.4) * 0.02; }
    if (id === 'latigo') content.rotation.z = Math.sin(tm * 1.6) * 0.06;
    if (id === 'hoja_dim' || id === 'hoja_umbral') content.position.y = Math.sin(tm * 1.2) * 0.012;
    if (id === 'aguja_fantasma') content.rotation.y = Math.sin(tm * 0.8) * 0.12;
  }
  function setTier(n) { n = Math.max(0, Math.min(4, n | 0)); if (n === state.tier) return; state.tier = n; build(); }
  function dispose() { state.dead = true; group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of Object.values(mats)) m.dispose(); }
  return { group, update, setTier, dispose, id, get tier() { return state.tier; }, get info() { return { id, tier: state.tier, draws: state.counts.draws, tris: Math.round(state.counts.tris), size: state.info }; } };
}

/** Gancho para el viewmodel en primera persona (lo usa hostfx-melee.js; ver docs/HUESPEDES.md → «Melee: modelos»).
 *  `anchor` = Object3D de la mano (el modelo cuelga de él). En el viewmodel el frente es −Z: el arma se gira para que la hoja apunte hacia −Z.
 *  opts: { tier, quality, color, size (escala, por defecto 0.55 para primera persona), offset [x,y,z], frame: 'vm' | 'host' }
 *  Devuelve { group, update(dt,t), setTier(n), setWeapon(id), dispose() }. Llamar a update() una vez por cuadro mientras el arma esté visible. */
export function attachToViewmodel(THREE, anchor, id, opts = {}) {
  const T = THREE, pivot = new T.Group(); pivot.name = 'melee-anchor';
  const frame = opts.frame || 'vm', size = opts.size || (frame === 'vm' ? 0.55 : 1), off = opts.offset || ZERO;
  if (frame === 'vm') pivot.rotation.x = -Math.PI / 2;       // +Y (hoja) → −Z (adelante)
  else pivot.rotation.x = Math.PI - 0.85;                      // mano de un Huésped: hoja al frente y hacia abajo
  pivot.position.set(off[0], off[1], off[2]); pivot.scale.setScalar(size); anchor.add(pivot);
  let cur = null, curId = null;
  const mk = (wid) => { if (cur) { pivot.remove(cur.group); cur.dispose(); } curId = wid; cur = wid && W[wid] ? buildMelee(T, wid, { tier: opts.tier | 0, quality: opts.quality || 'low', color: opts.color, aura: opts.aura }) : null; if (cur) pivot.add(cur.group); };
  mk(id);
  return {
    group: pivot, get model() { return cur; }, get id() { return curId; },
    update(dt, t) { if (cur) cur.update(dt, t); },
    setTier(n) { opts.tier = n; if (cur) cur.setTier(n); },
    setWeapon(wid) { if (wid !== curId) mk(wid); },
    dispose() { if (cur) cur.dispose(); anchor.remove(pivot); },
  };
}
