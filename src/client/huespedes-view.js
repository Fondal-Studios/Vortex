// Modelos 3D procedurales de los 5 HUÉSPEDES (docs/HUESPEDES.md): organismos biomecánicos con silueta propia.
//   import { buildHost } from './huespedes-view.js';
//   const h = buildHost(THREE, 'vesper', 'low');   // → { group, update(dt, t), pose(name), dispose(), info }
//   scene.add(h.group); en cada cuadro: h.update(dt, t); h.pose('melee') | 'skill' | 'idle'
// Todo se arma con geometrías simples fusionadas por articulación (sin archivos externos, sin compilación):
// cada articulación = 1 malla «cuerpo» (metal/quitina, color por vértice) + 1 malla «brillo» (emisiva) + a veces 1 «membrana» translúcida.
// Presupuesto en Baja: ≤ 40 llamadas de dibujo y ≤ 15 000 triángulos por Huésped (ver `h.info` y tests/huespedes-ui.test.js).
// El frente del modelo mira a +Z; los pies están en y = 0.

const UP = [0, 1, 0], ZERO = [0, 0, 0];
const smooth = (u) => u * u * (3 - 2 * u);

/** Constructor de piezas: junta geometrías por articulación y las fusiona al final. */
export function makeBuilder(T, S) {
  const joints = {};
  const m4 = new T.Matrix4(), q = new T.Quaternion(), eu = new T.Euler(), v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), cc = new T.Color();
  const xf = (geo, p = ZERO, r = ZERO, s = [1, 1, 1]) => { eu.set(r[0], r[1], r[2]); q.setFromEuler(eu); m4.compose(v1.set(p[0], p[1], p[2]), q, v2.set(s[0], s[1], s[2])); geo.applyMatrix4(m4); return geo; };
  const push = (j, kind, geo, col) => {
    const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose();
    const n = g.attributes.position.count, c = new Float32Array(n * 3); cc.set(col);
    for (let i = 0; i < n; i++) { c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
    g.setAttribute('color', new T.BufferAttribute(c, 3)); g.deleteAttribute('uv'); j.parts[kind].push(g);
  };
  const seg = (n) => n || S;
  const P = {
    joints,
    joint(name, parent, pos = ZERO) { const g = new T.Group(); g.name = name; g.position.set(pos[0], pos[1], pos[2]); if (parent) parent.g.add(g); const j = { name, g, parts: { body: [], glow: [], mem: [] }, rest: [0, 0, 0] }; joints[name] = j; return j; },
    box(j, k, col, d, p, r, s) { push(j, k, xf(new T.BoxGeometry(d[0], d[1], d[2]), p, r, s), col); },
    cyl(j, k, col, rt, rb, h, p, r, n, s) { push(j, k, xf(new T.CylinderGeometry(rt, rb, h, seg(n), 1), p, r, s), col); },
    cone(j, k, col, rad, h, p, r, n, s) { push(j, k, xf(new T.ConeGeometry(rad, h, seg(n), 1), p, r, s), col); },
    sph(j, k, col, rad, p, s, n) { push(j, k, xf(new T.SphereGeometry(rad, seg(n), Math.max(3, seg(n) - 2)), p, ZERO, s), col); },
    oct(j, k, col, rad, p, s, r) { push(j, k, xf(new T.OctahedronGeometry(rad, 0), p, r, s), col); },
    ico(j, k, col, rad, p, s, r, d = 0) { push(j, k, xf(new T.IcosahedronGeometry(rad, d), p, r, s), col); },
    tor(j, k, col, R, rad, p, r, n, s) { push(j, k, xf(new T.TorusGeometry(R, rad, 4, seg(n) * 3), p, r, s), col); },
    /** cilindro cónico entre dos puntos a→b (r1 en a, r2 en b) */
    limb(j, k, col, a, b, r1, r2, n) {
      v1.set(a[0], a[1], a[2]); v2.set(b[0], b[1], b[2]); v3.subVectors(v2, v1); const len = v3.length() || 1e-3;
      const geo = new T.CylinderGeometry(r2, r1, len, seg(n), 1); q.setFromUnitVectors(new T.Vector3(UP[0], UP[1], UP[2]), v3.normalize());
      m4.compose(v1.clone().add(v2).multiplyScalar(0.5), q, new T.Vector3(1, 1, 1)); geo.applyMatrix4(m4); push(j, k, geo, col);
    },
    tri(j, k, col, a, b, c) {
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array([...a, ...b, ...c]), 3)); g.computeVertexNormals(); push(j, k, g, col);
    },
    /** cuchilla plana: base ancha → punta, apuntando en la dirección a→b */
    blade(j, k, col, a, b, w, th) {
      v1.set(a[0], a[1], a[2]); v2.set(b[0], b[1], b[2]); v3.subVectors(v2, v1); const len = v3.length() || 1e-3;
      const geo = new T.ConeGeometry(0.5, len, 4, 1); geo.rotateY(Math.PI / 4); geo.scale(w, 1, th);
      q.setFromUnitVectors(new T.Vector3(0, 1, 0), v3.normalize()); m4.compose(v1.clone().add(v2).multiplyScalar(0.5), q, new T.Vector3(1, 1, 1)); geo.applyMatrix4(m4); push(j, k, geo, col);
    },
  };
  /** fusiona las piezas de cada articulación en una malla por tipo */
  P.finish = (mats) => {
    let draws = 0, tris = 0;
    for (const j of Object.values(joints)) {
      for (const kind of ['body', 'glow', 'mem']) {
        const arr = j.parts[kind]; if (!arr.length) continue;
        let n = 0; for (const g of arr) n += g.attributes.position.count;
        const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
        for (const g of arr) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); }
        const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
        const mesh = new T.Mesh(geo, mats[kind]); mesh.frustumCulled = false; mesh.name = j.name + ':' + kind; if (kind === 'mem') mesh.renderOrder = 2; j.g.add(mesh); j.parts[kind] = []; draws++; tris += n / 3;
      }
    }
    return { draws, tris };
  };
  return P;
}

/* ═════════════ Los cinco cuerpos. Cada uno devuelve { poses, custom?, fx } ═════════════ */

// Convención de ángulos: en un brazo que cuelga, rotación X NEGATIVA = levantarlo hacia el frente; Z positiva en el lado derecho (R) = abrirlo hacia afuera.
// En los cuadros de pose, `arm`/`fore` valen para el lado R y se espejan solos en el L (salvo que se dé `armL` explícito).

function axioma(P, c) {
  const NEG = 0x15171f, ARM = 0x262a36, LN = c.color, LN2 = 0xbfe6ff, BONE = 0x3d4559;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 1.0, 0]), head = P.joint('head', torso, [0, 0.64, 0.02]);
  // piernas: grandes, acorazadas, con tendones azules
  for (const s of [-1, 1]) {
    P.limb(root, 'body', ARM, [0.17 * s, 0.98, 0], [0.2 * s, 0.54, 0.05], 0.115, 0.085); P.limb(root, 'body', NEG, [0.2 * s, 0.54, 0.05], [0.19 * s, 0.1, -0.02], 0.085, 0.06);
    P.oct(root, 'body', BONE, 0.1, [0.2 * s, 0.54, 0.12], [1, 1.1, 0.7]); P.box(root, 'body', NEG, [0.15, 0.09, 0.3], [0.19 * s, 0.045, 0.07]);
    P.limb(root, 'glow', LN, [0.27 * s, 0.95, 0.02], [0.27 * s, 0.6, 0.06], 0.02, 0.02, 4); P.limb(root, 'glow', LN, [0.25 * s, 0.5, 0.0], [0.24 * s, 0.14, -0.04], 0.018, 0.018, 4);
  }
  P.box(root, 'body', ARM, [0.46, 0.2, 0.3], [0, 1.0, 0]); P.box(root, 'glow', LN, [0.3, 0.015, 0.02], [0, 1.06, 0.15]);
  // tronco: pecho ancho en cuña, costillas con líneas azules, lomo con espinas dorsales
  P.box(torso, 'body', ARM, [0.5, 0.34, 0.34], [0, 0.15, 0]); P.box(torso, 'body', NEG, [0.7, 0.3, 0.38], [0, 0.46, 0]); P.box(torso, 'body', BONE, [0.34, 0.3, 0.1], [0, 0.46, 0.2], [0.25, 0, 0]);
  for (let i = 0; i < 4; i++) { P.box(torso, 'glow', LN, [0.34 - i * 0.03, 0.025, 0.03], [0, 0.04 + i * 0.1, 0.18], [0.1, 0, 0]); }
  P.limb(torso, 'glow', LN, [0, 0.34, 0.2], [0, 0.6, 0.24], 0.016, 0.016, 4); P.oct(torso, 'glow', LN2, 0.045, [0, 0.46, 0.25], [1, 1.3, 0.6]);
  for (let i = 0; i < 5; i++) P.cone(torso, 'body', BONE, 0.04, 0.2 - i * 0.015, [0, 0.62 - i * 0.12, -0.2 - i * 0.015], [-1.1, 0, 0], 4);
  for (const s of [-1, 1]) { P.limb(torso, 'body', ARM, [0.12 * s, 0.6, -0.17], [0.15 * s, 0.05, -0.2], 0.035, 0.035, 5); P.limb(torso, 'glow', LN, [0.12 * s, 0.6, -0.2], [0.15 * s, 0.05, -0.23], 0.01, 0.01, 4); }
  // cabeza: cráneo alargado con visor
  P.limb(torso, 'body', ARM, [0, 0.58, 0], [0, 0.66, 0.01], 0.09, 0.07); P.ico(head, 'body', NEG, 0.15, [0, 0.12, 0.02], [0.8, 1.15, 1.25]); P.box(head, 'body', BONE, [0.03, 0.16, 0.32], [0, 0.26, -0.06], [-0.3, 0, 0]);
  P.box(head, 'glow', LN2, [0.19, 0.03, 0.02], [0, 0.13, 0.19]); P.box(head, 'glow', LN, [0.012, 0.12, 0.012], [0, 0.26, 0.08], [0.25, 0, 0]);
  // brazos con cuchillas en los antebrazos
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.46 * s, 0.56, 0]), fore = P.joint('fore' + side, arm, [0, -0.34, 0]);
    arm.rest = [-0.12, 0, 0.12 * s]; fore.rest = [-0.3, 0, 0];
    P.oct(arm, 'body', NEG, 0.17, [0.02 * s, 0.03, 0], [1.2, 0.8, 1.1]); P.box(arm, 'body', ARM, [0.26, 0.05, 0.26], [0.03 * s, 0.1, 0], [0, 0, -0.3 * s]);
    P.limb(arm, 'body', ARM, [0, 0, 0], [0, -0.34, 0], 0.085, 0.07); P.limb(arm, 'glow', LN, [0.075 * s, -0.04, 0.01], [0.065 * s, -0.3, 0.01], 0.01, 0.01, 4);
    P.sph(fore, 'body', BONE, 0.075, [0, 0, 0]); P.box(fore, 'body', NEG, [0.15, 0.3, 0.16], [0, -0.16, 0]); P.box(fore, 'body', ARM, [0.13, 0.09, 0.18], [0, -0.33, 0.02]);
    // cuchilla: nace en el codo, corre por el antebrazo y sobrepasa el puño
    if (c.native !== false) { P.blade(fore, 'body', NEG, [0, -0.25, 0.1], [0, -0.98, 0.1], 0.07, 0.03); P.blade(fore, 'glow', LN2, [0, -0.3, 0.1], [0, -0.97, 0.1], 0.016, 0.05); } P.box(fore, 'glow', LN, [0.012, 0.22, 0.012], [0.07 * s, -0.16, 0.0]);
  }
  const R = (a) => a;
  return {
    fx: { color: LN, kind: 'ring' },
    poses: {
      melee: [
        { t: 0.2, r: { arm: R([0.7, 0.2, 0.7]), fore: [-0.5, 0, 0], armL: [-0.4, 0, -0.2], torso: [0.05, 0.55, 0] } },
        { t: 0.36, r: { arm: R([-1.65, -0.3, -0.05]), fore: [-0.15, 0, 0], armL: [-0.7, 0, -0.3], torso: [0.12, -0.65, 0] }, y: -0.04 },
        { t: 0.7, r: { arm: [-1.4, -0.3, 0], fore: [-0.2, 0, 0], armL: [-0.6, 0, -0.2], torso: [0.1, -0.5, 0] } },
        { t: 1.05, r: {} },
      ],
      skill: [
        { t: 0.3, r: { arm: [-0.9, 0.4, -0.8], fore: [-1.6, 0, 0], torso: [0.3, 0, 0] }, y: -0.1, open: 1 },
        { t: 1.5, r: { arm: [-0.9, 0.4, -0.8], fore: [-1.6, 0, 0], torso: [0.3, 0, 0] }, y: -0.1, open: 1 },
        { t: 2.0, r: {} },
      ],
    },
    custom(k, t, J) { J.torso.g.scale.x += k.open * 0.06; },
  };
}

function vesper(P, c) {
  const SK = 0x2a1a38, SK2 = 0x472a62, NV = c.color, NV2 = 0xe2b8ff, CL = 0xe6dcf2;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 1.02, 0.05]), head = P.joint('head', torso, [0, 0.66, 0.12]);
  torso.rest = [0.32, 0, 0];
  // piernas digitígradas largas con garras
  for (const s of [-1, 1]) {
    P.limb(root, 'body', SK2, [0.13 * s, 1.02, 0.02], [0.17 * s, 0.62, 0.26], 0.075, 0.055); P.limb(root, 'body', SK, [0.17 * s, 0.62, 0.26], [0.17 * s, 0.26, -0.1], 0.055, 0.035); P.limb(root, 'body', SK2, [0.17 * s, 0.26, -0.1], [0.17 * s, 0.03, 0.22], 0.035, 0.022);
    for (const dx of [-0.04, 0, 0.04]) P.cone(root, 'body', CL, 0.014, 0.12, [0.17 * s + dx, 0.03, 0.31], [1.5, 0, 0], 4);
    P.limb(root, 'glow', NV, [0.2 * s, 1.0, 0.04], [0.23 * s, 0.64, 0.26], 0.008, 0.008, 3); P.limb(root, 'glow', NV, [0.2 * s, 0.6, 0.22], [0.2 * s, 0.28, -0.08], 0.008, 0.008, 3);
  }
  P.box(root, 'body', SK2, [0.3, 0.16, 0.24], [0, 1.02, 0]);
  // cola segmentada que ondula
  const t1 = P.joint('tail1', root, [0, 1.0, -0.12]), t2 = P.joint('tail2', t1, [0, -0.2, -0.5]);
  P.limb(t1, 'body', SK2, [0, 0, 0], [0, -0.1, -0.28], 0.07, 0.055); P.limb(t1, 'body', SK, [0, -0.1, -0.28], [0, -0.2, -0.5], 0.055, 0.04); P.limb(t1, 'glow', NV, [0, 0.03, -0.1], [0, -0.17, -0.5], 0.008, 0.008, 3);
  P.limb(t2, 'body', SK2, [0, 0, 0], [0, -0.1, -0.35], 0.04, 0.025); P.blade(t2, 'body', CL, [0, -0.1, -0.35], [0, 0.04, -0.75], 0.07, 0.025);
  // tronco estrecho, costillas visibles, espinas
  P.cyl(torso, 'body', SK, 0.17, 0.12, 0.6, [0, 0.28, 0]); for (let i = 0; i < 4; i++) P.box(torso, 'body', SK2, [0.31, 0.025, 0.2], [0, 0.12 + i * 0.1, 0.02], [0, 0, 0]);
  for (let i = 0; i < 6; i++) P.cone(torso, 'body', CL, 0.028, 0.2 - i * 0.015, [0, 0.55 - i * 0.09, -0.15], [-1.0, 0, 0], 4);
  for (let i = 0; i < 4; i++) P.limb(torso, 'glow', NV, [-0.1 + i * 0.066, 0.52, 0.12], [-0.08 + i * 0.05, 0.05, 0.1], 0.007, 0.007, 3);
  P.oct(torso, 'glow', NV2, 0.05, [0, 0.38, 0.14], [1, 1.4, 0.6]);
  for (const s of [-1, 1]) P.cone(torso, 'body', CL, 0.05, 0.32, [0.17 * s, 0.6, -0.04], [0.5, 0, -0.9 * s], 4);
  // cabeza: hocico estrecho, cresta hacia atrás, ojos violeta
  P.limb(torso, 'body', SK, [0, 0.52, 0.0], [0, 0.66, 0.1], 0.07, 0.05); P.ico(head, 'body', SK2, 0.11, [0, 0.0, 0.08], [0.85, 0.9, 1.7]); P.cone(head, 'body', SK, 0.05, 0.22, [0, -0.05, 0.3], [-1.4, 0, 0], 5);
  for (const s of [-1, 1]) { P.limb(head, 'body', CL, [0.05 * s, 0.07, -0.02], [0.1 * s, 0.2, -0.38], 0.028, 0.006, 4); P.sph(head, 'glow', NV2, 0.022, [0.06 * s, 0.03, 0.2], [1, 0.7, 1], 4); }
  P.limb(head, 'body', CL, [0, 0.1, -0.02], [0, 0.34, -0.36], 0.03, 0.006, 4);
  // brazos larguísimos con tres garras por mano
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.2 * s, 0.56, 0.02]), fore = P.joint('fore' + side, arm, [0, -0.52, 0]);
    arm.rest = [-0.05, 0, 0.1 * s]; fore.rest = [-0.25, 0, 0];
    P.sph(arm, 'body', SK2, 0.075, [0, 0, 0]); P.limb(arm, 'body', SK2, [0, 0, 0], [0, -0.52, 0], 0.06, 0.042); P.limb(arm, 'glow', NV, [0.05 * s, -0.02, 0], [0.036 * s, -0.5, 0], 0.007, 0.007, 3);
    P.sph(fore, 'body', SK, 0.045, [0, 0, 0]); P.limb(fore, 'body', SK, [0, 0, 0], [0, -0.56, 0.02], 0.042, 0.03); P.limb(fore, 'glow', NV, [0.03 * s, -0.04, 0], [0.02 * s, -0.52, 0.02], 0.006, 0.006, 3);
    P.box(fore, 'body', SK2, [0.09, 0.08, 0.06], [0, -0.6, 0.02]);
    if (c.native !== false) for (const dx of [-0.035, 0, 0.035]) { P.limb(fore, 'body', CL, [dx, -0.64, 0.02], [dx * 1.6, -0.95, 0.1], 0.016, 0.003, 4); }
  }
  return {
    fx: { color: NV, kind: 'streak' },
    poses: {
      melee: [
        { t: 0.18, r: { arm: [0.5, 0, 1.3], fore: [-0.5, 0, 0], armL: [0.3, 0, -0.3], torso: [0.1, 0.7, 0] }, y: -0.08 },
        { t: 0.3, r: { arm: [-1.4, 0.3, -0.7], fore: [-0.3, 0, 0], armL: [0.5, 0, -1.1], torso: [0.3, -0.8, 0] }, y: -0.1 },
        { t: 0.42, r: { arm: [-1.2, 0.2, 0.9], fore: [-0.2, 0, 0], armL: [-1.4, -0.3, 0.7], torso: [0.25, 0.6, 0] }, y: -0.1 },
        { t: 0.9, r: {} },
      ],
      skill: [
        { t: 0.25, r: { arm: [0.1, 0, 1.2], fore: [-0.2, 0, 0], torso: [-0.15, 0, 0], head: [-0.3, 0, 0] }, open: 1 },
        { t: 1.3, r: { arm: [0.1, 0, 1.2], fore: [-0.2, 0, 0], torso: [-0.15, 0, 0], head: [-0.3, 0, 0] }, open: 1 },
        { t: 1.8, r: {} },
      ],
    },
    custom(k, t, J) { J.tail1.g.rotation.y += Math.sin(t * 1.3) * 0.28 * (1 + k.open); J.tail2.g.rotation.y += Math.sin(t * 1.3 - 0.9) * 0.45 * (1 + k.open); J.tail1.g.rotation.x += k.open * 0.3; J.torso.g.rotation.z += Math.sin(t * 0.8) * 0.03; },
  };
}

function micelio(P, c) {
  const CH = 0x4a3a2a, CH2 = 0x7a6040, MOSS = 0x3f6a2a, GR = c.color, CAP = [0xc9732a, 0x7be03a, 0xe8c25a, 0xa8421e], SPORE = 0xc6ff7a;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 1.0, 0]), head = P.joint('head', torso, [0, 0.9, 0.2]);
  torso.rest = [0.22, 0, 0];
  // piernas-tocón con raíces
  for (const s of [-1, 1]) {
    P.limb(root, 'body', CH2, [0.32 * s, 1.05, 0], [0.38 * s, 0.14, 0.04], 0.24, 0.19); P.box(root, 'body', CH, [0.4, 0.14, 0.52], [0.38 * s, 0.07, 0.1]);
    for (let i = 0; i < 4; i++) P.cone(root, 'body', MOSS, 0.05, 0.4, [0.38 * s + (i - 1.5) * 0.16, 0.04, 0.38], [1.4, 0, 0.1 * (i - 1.5)], 4);
    P.limb(root, 'body', MOSS, [0.5 * s, 0.1, -0.1], [0.78 * s, 0.01, -0.4], 0.06, 0.01, 4);
  }
  P.box(root, 'body', CH, [0.8, 0.3, 0.5], [0, 1.0, 0]);
  // tronco: cúpula enorme con placas de quitina superpuestas
  P.sph(torso, 'body', CH2, 0.62, [0, 0.45, 0], [1.15, 0.9, 0.85], 8);
  for (let i = 0; i < 6; i++) P.box(torso, 'body', i % 2 ? CH : CH2, [0.95 - i * 0.07, 0.09, 0.62], [0, 0.12 + i * 0.13, -0.04], [-0.35 + i * 0.05, 0, 0]);
  for (const s of [-1, 1]) P.cone(torso, 'body', CH, 0.12, 0.5, [0.58 * s, 0.75, -0.05], [0, 0, -0.95 * s], 5);
  // sacos de esporas y hongos
  for (let i = 0; i < 4; i++) P.sph(torso, 'glow', GR, 0.08 + (i % 2) * 0.03, [-0.22 + i * 0.15, 0.3 + (i % 2) * 0.12, 0.5], [1, 1, 0.8], 5);
  const caps = [[-0.5, 0.92, -0.2, 0.2, 0], [0.45, 0.98, -0.25, 0.26, 1], [0.0, 0.98, -0.45, 0.3, 2], [-0.25, 0.78, -0.55, 0.15, 3], [0.62, 0.55, -0.35, 0.17, 0], [-0.62, 0.55, -0.3, 0.19, 1]];
  for (const [x, y, z, r, ci] of caps) {
    P.cyl(torso, 'body', 0xd8cdb0, r * 0.2, r * 0.28, r * 1.4, [x, y + r * 0.5, z], [0.3, 0, 0], 5);
    P.sph(torso, 'body', CAP[ci], r, [x, y + r * 1.2, z + 0.03], [1, 0.5, 1], 6);
    P.sph(torso, 'glow', SPORE, r * 0.12, [x + r * 0.3, y + r * 1.5, z + 0.06], [1, 1, 1], 3);
  }
  // cabeza hundida, varios ojos y boca ancha
  P.sph(head, 'body', CH, 0.22, [0, 0, 0], [1.15, 0.8, 1]); P.box(head, 'glow', GR, [0.26, 0.03, 0.02], [0, -0.08, 0.2]);
  for (let i = 0; i < 5; i++) P.sph(head, 'glow', SPORE, 0.028, [(i - 2) * 0.07, 0.07 + (i % 2) * 0.04, 0.2], [1, 1, 0.7], 4);
  P.sph(head, 'body', CAP[0], 0.17, [0.0, 0.2, -0.02], [1, 0.45, 1], 6);
  // brazos colosales: puños de quitina
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.75 * s, 0.7, 0.0]), fore = P.joint('fore' + side, arm, [0, -0.5, 0]);
    arm.rest = [-0.1, 0, 0.22 * s]; fore.rest = [-0.35, 0, 0];
    P.sph(arm, 'body', CH, 0.26, [0, 0, 0], [1, 0.9, 1]); P.limb(arm, 'body', CH2, [0, 0, 0], [0, -0.5, 0], 0.2, 0.17); P.box(arm, 'body', CH, [0.24, 0.1, 0.34], [0.04 * s, -0.12, 0.0], [0, 0, 0.2 * s]);
    P.sph(fore, 'body', CH, 0.19, [0, 0, 0]); P.limb(fore, 'body', CH2, [0, 0, 0], [0, -0.5, 0.05], 0.18, 0.24); P.box(fore, 'body', CH, [0.46, 0.34, 0.44], [0, -0.66, 0.07]);
    for (let i = 0; i < 4; i++) P.cone(fore, 'body', CH2, 0.045, 0.14, [(i - 1.5) * 0.11, -0.8, 0.22], [1.2, 0, 0], 4);
    P.sph(fore, 'glow', GR, 0.05, [0.12 * s, -0.4, 0.22], [1, 1, 1], 4); P.cyl(fore, 'body', 0xd8cdb0, 0.012, 0.016, 0.1, [-0.15 * s, -0.26, -0.12], [0.2, 0, 0], 4); P.sph(fore, 'body', CAP[2], 0.07, [-0.15 * s, -0.2, -0.12], [1, 0.5, 1], 5);
  }
  return {
    fx: { color: GR, kind: 'ring', big: true },
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
    custom(k, t, J) { const b = 1 + Math.sin(t * 1.2) * 0.02 + k.open * 0.06; J.torso.g.scale.multiplyScalar(b); },
  };
}

function umbra(P, c) {
  const VOID = 0x1d1230, VOID2 = 0x3b2468, VI = c.color, GH = 0x40ffc0, LIL = 0x7a58b8;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 1.1, 0]), head = P.joint('head', torso, [0, 0.82, 0]);
  // sin piernas: cuerpo que se afila hacia el vacío, con hojas flotando alrededor
  P.cone(root, 'body', VOID2, 0.24, 0.95, [0, 0.58, 0], [Math.PI, 0, 0], 6); P.cone(root, 'glow', VI, 0.012, 0.3, [0, 0.1, 0], [Math.PI, 0, 0], 4);
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.4; P.blade(root, 'body', VOID, [Math.cos(a) * 0.26, 1.0, Math.sin(a) * 0.26], [Math.cos(a) * 0.3, 0.3 + i * 0.1, Math.sin(a) * 0.3], 0.09, 0.02); P.limb(root, 'glow', VI, [Math.cos(a) * 0.27, 0.95, Math.sin(a) * 0.27], [Math.cos(a) * 0.3, 0.4 + i * 0.1, Math.sin(a) * 0.3], 0.006, 0.006, 3); }
  // pecho: octaedro alargado atravesado por un anillo imposible
  P.oct(torso, 'body', VOID2, 0.3, [0, 0.25, 0], [0.8, 1.6, 0.55]); P.oct(torso, 'glow', GH, 0.05, [0, 0.3, 0.14], [1, 1.5, 0.6]);
  P.tor(torso, 'glow', VI, 0.34, 0.012, [0, 0.4, 0], [Math.PI / 2 - 0.35, 0.2, 0], 8); P.tor(torso, 'body', LIL, 0.4, 0.018, [0, 0.12, 0], [Math.PI / 2 + 0.3, 0, 0.4], 8);
  for (let i = 0; i < 3; i++) P.box(torso, 'body', VOID, [0.5 - i * 0.1, 0.03, 0.03], [0, 0.0 + i * 0.12, 0.19], [0, 0, 0.2 * (i - 1)]);
  // cabeza separada del cuerpo (hueco imposible), sin rostro y con un ojo vertical
  P.oct(head, 'body', VOID2, 0.16, [0, 0, 0], [0.9, 1.4, 0.9], [0, 0.4, 0]); P.box(head, 'glow', GH, [0.018, 0.17, 0.012], [0, 0.0, 0.16]); P.tor(head, 'glow', VI, 0.24, 0.01, [0, 0.08, 0], [Math.PI / 2, 0, 0.3], 8);
  for (let i = 0; i < 5; i++) P.limb(head, 'body', VOID, [(i - 2) * 0.05, 0.15, -0.05], [(i - 2) * 0.09, 0.4 - Math.abs(i - 2) * 0.05, -0.2], 0.022, 0.003, 3);
  // brazos: segmentos que no se tocan; la derecha es una hoja que atraviesa defensas
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.34 * s, 0.5, 0.02]), fore = P.joint('fore' + side, arm, [0, -0.42, 0.04]);
    arm.rest = [-0.15, 0, 0.16 * s]; fore.rest = [-0.4, 0, 0];
    P.oct(arm, 'body', VOID2, 0.1, [0, 0, 0], [1.1, 0.8, 1]); P.limb(arm, 'body', VOID, [0, -0.04, 0], [0, -0.32, 0], 0.045, 0.032); P.limb(arm, 'glow', VI, [0.035 * s, -0.06, 0], [0.026 * s, -0.3, 0], 0.005, 0.005, 3);
    if (s > 0) {
      P.limb(fore, 'body', VOID2, [0, 0, 0], [0, -0.2, 0.02], 0.04, 0.035); if (c.native !== false) { P.blade(fore, 'body', VOID, [0, -0.15, 0.03], [0, -1.12, 0.1], 0.1, 0.03); P.blade(fore, 'glow', GH, [0, -0.2, 0.03], [0, -1.1, 0.1], 0.02, 0.05); } P.oct(fore, 'glow', VI, 0.04, [0, -0.1, 0.03]);
    } else {
      P.limb(fore, 'body', VOID2, [0, 0, 0], [0, -0.3, 0.02], 0.04, 0.03); P.oct(fore, 'body', VOID, 0.08, [0, -0.4, 0.04], [1.2, 0.5, 1]); P.tor(fore, 'glow', GH, 0.12, 0.008, [0, -0.5, 0.05], [Math.PI / 2, 0, 0], 8);
      for (let i = 0; i < 3; i++) P.limb(fore, 'body', VOID, [(i - 1) * 0.04, -0.42, 0.06], [(i - 1) * 0.07, -0.64, 0.12], 0.012, 0.003, 3);
    }
  }
  // fragmentos flotantes en dos órbitas (cuerpo oscuro + aristas de brillo + vidrio fantasma)
  const fa = P.joint('fragA', root, [0, 1.2, 0]), fb = P.joint('fragB', root, [0, 1.0, 0]);
  const shards = [[fa, 0.75, 0.15, 0.12, 0], [fa, 0.75, -0.15, 0.1, 2.1], [fa, 0.75, 0.4, 0.08, 4.2], [fb, 1.1, -0.35, 0.16, 1], [fb, 1.1, 0.05, 0.09, 3], [fb, 1.1, 0.5, 0.12, 5]];
  shards.forEach(([j, rad, y, sz, a], i) => {
    const p = [Math.cos(a) * rad, y, Math.sin(a) * rad], rot = [a, a * 0.7, 0.4 * i];
    if (i % 3 === 0) P.oct(j, 'body', VOID2, sz, p, [1, 1.7, 1], rot); else if (i % 3 === 1) P.box(j, 'body', LIL, [sz, sz * 1.6, sz * 0.6], p, rot); else P.ico(j, 'mem', VI, sz * 1.1, p, [1, 1.2, 1], rot);
    P.oct(j, 'glow', GH, sz * 0.25, p, [1, 1.5, 1], rot);
  });
  P.tor(fa, 'glow', VI, 0.8, 0.008, [0, 0.1, 0], [Math.PI / 2 + 0.2, 0, 0], 12); P.tor(fb, 'glow', LIL, 1.1, 0.008, [0, 0.0, 0], [Math.PI / 2 - 0.3, 0, 0.2], 12);
  return {
    fx: { color: VI, kind: 'ringV' },
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
      J.fragA.g.position.y = 1.2 + Math.sin(t * 1.1) * 0.08; J.fragB.g.position.y = 1.0 + Math.sin(t * 0.8 + 1) * 0.1; J.fragB.g.rotation.z = 0.15 * Math.sin(t * 0.6);
      J.head.g.position.y = 0.82 + Math.sin(t * 1.4) * 0.025; J.root.g.position.y += 0.1 + Math.sin(t * 1.0) * 0.06;
    },
  };
}

function seraf(P, c) {
  const IV = 0xe9dcc2, IV2 = 0xbba57d, GD = c.color, GD2 = 0xfff0b0, DK = 0x2b2112, MEM = 0xffe08a;
  const root = P.joint('root', null), torso = P.joint('torso', root, [0, 1.0, 0]), head = P.joint('head', torso, [0, 0.62, 0.02]);
  // piernas largas y finas, con placas de marfil
  for (const s of [-1, 1]) {
    P.limb(root, 'body', IV, [0.11 * s, 1.0, 0], [0.13 * s, 0.52, 0.05], 0.075, 0.055); P.limb(root, 'body', IV2, [0.13 * s, 0.52, 0.05], [0.13 * s, 0.08, 0], 0.055, 0.035); P.oct(root, 'body', DK, 0.06, [0.13 * s, 0.53, 0.1], [1, 1.2, 0.7]);
    P.box(root, 'body', DK, [0.1, 0.06, 0.24], [0.13 * s, 0.03, 0.06]); P.limb(root, 'glow', GD, [0.17 * s, 0.98, 0.02], [0.18 * s, 0.56, 0.06], 0.007, 0.007, 3); P.limb(root, 'glow', GD, [0.17 * s, 0.5, 0.05], [0.16 * s, 0.1, 0.0], 0.007, 0.007, 3);
  }
  P.box(root, 'body', IV2, [0.3, 0.16, 0.22], [0, 1.0, 0]);
  // falda de filamentos dorados
  const sk = P.joint('skirt', root, [0, 0.96, 0]);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.283, x = Math.cos(a) * 0.17, z = Math.sin(a) * 0.15; P.limb(sk, 'glow', GD, [x, 0, z], [x * 1.9, -0.72 - (i % 3) * 0.12, z * 1.9], 0.012, 0.003, 3); }
  // tronco fino, costillar de marfil, núcleo dorado
  P.cyl(torso, 'body', IV, 0.16, 0.12, 0.6, [0, 0.28, 0]); for (let i = 0; i < 4; i++) P.tor(torso, 'body', IV2, 0.15 - i * 0.003, 0.012, [0, 0.14 + i * 0.1, 0.0], [Math.PI / 2, 0, 0], 8, [1, 0.85, 1]);
  P.sph(torso, 'glow', GD2, 0.06, [0, 0.36, 0.13], [1, 1, 0.7], 5); P.limb(torso, 'glow', GD, [-0.12, 0.54, 0.1], [0, 0.4, 0.14], 0.007, 0.007, 3); P.limb(torso, 'glow', GD, [0.12, 0.54, 0.1], [0, 0.4, 0.14], 0.007, 0.007, 3);
  P.tor(torso, 'body', DK, 0.15, 0.03, [0, 0.58, 0], [Math.PI / 2, 0, 0], 8);
  // cabeza ovoide con corona de filamentos y halo vertical
  P.ico(head, 'body', IV, 0.13, [0, 0.14, 0.02], [0.85, 1.2, 1]); P.limb(torso, 'body', IV2, [0, 0.54, 0], [0, 0.64, 0.02], 0.05, 0.04);
  P.box(head, 'glow', GD, [0.1, 0.012, 0.012], [0, 0.16, 0.14]); P.tor(head, 'glow', GD, 0.3, 0.012, [0, 0.2, -0.16], [0, 0, 0], 12);
  for (let i = 0; i < 7; i++) { const a = -1.2 + i * 0.4; P.limb(head, 'glow', GD2, [Math.sin(a) * 0.1, 0.24 + Math.cos(a) * 0.05, -0.04], [Math.sin(a) * 0.2, 0.46 + Math.cos(a) * 0.1, -0.12], 0.008, 0.002, 3); }
  // alas membranosas: tres huesos largos y una membrana entre ellos
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', w = P.joint('wing' + side, torso, [0.1 * s, 0.5, -0.14]);
    w.rest = [0, 0.35 * s, 0.1 * s];
    const tips = [[0.45, 0.85, -0.35], [0.95, 0.5, -0.4], [1.0, -0.15, -0.35], [0.5, -0.5, -0.25]]; // hacia afuera (+x para R); se espeja con s
    const T0 = [0, 0, 0], tp = tips.map(([x, y, z]) => [x * s, y, z]);
    P.limb(w, 'body', IV2, T0, [0.3 * s, 0.35, -0.1], 0.03, 0.022, 4); tp.forEach((t, i) => { P.limb(w, 'body', i % 2 ? IV2 : IV, i < 2 ? [0.3 * s, 0.35, -0.1] : T0, t, i < 2 ? 0.022 : 0.016, 0.005, 4); P.limb(w, 'glow', GD, i < 2 ? [0.3 * s, 0.35, -0.1] : T0, t, 0.004, 0.003, 3); });
    P.tri(w, 'mem', MEM, T0, tp[0], tp[1]); P.tri(w, 'mem', MEM, T0, tp[1], tp[2]); P.tri(w, 'mem', MEM, T0, tp[2], tp[3]);
  }
  // brazos finos; el derecho lleva el látigo extensible
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'R' : 'L', arm = P.joint('arm' + side, torso, [0.2 * s, 0.54, 0]), fore = P.joint('fore' + side, arm, [0, -0.36, 0]);
    arm.rest = [-0.1, 0, 0.1 * s]; fore.rest = [-0.35, 0, 0];
    P.sph(arm, 'body', DK, 0.07, [0, 0, 0]); P.limb(arm, 'body', IV, [0, 0, 0], [0, -0.36, 0], 0.052, 0.04); P.sph(fore, 'body', IV2, 0.04, [0, 0, 0]); P.limb(fore, 'body', IV, [0, 0, 0], [0, -0.34, 0.01], 0.04, 0.032); P.box(fore, 'body', DK, [0.07, 0.09, 0.07], [0, -0.38, 0.01]);
    P.limb(fore, 'glow', GD, [0.032 * s, -0.04, 0], [0.026 * s, -0.32, 0.01], 0.005, 0.005, 3);
    if (s > 0 && c.native !== false) { const wh = P.joint('whip', fore, [0, -0.42, 0.01]); let px = 0, py = 0, pz = 0; for (let i = 0; i < 8; i++) { const nx = Math.sin(i * 0.5) * 0.06, ny = py - 0.12, nz = pz + 0.03; P.limb(wh, 'glow', i < 2 ? GD2 : GD, [px, py, pz], [nx, ny, nz], 0.016 - i * 0.0017, 0.014 - i * 0.0017, 3); px = nx; py = ny; pz = nz; } P.oct(wh, 'glow', GD2, 0.025, [px, py, pz]); }
    else { for (let i = 0; i < 4; i++) P.limb(fore, 'glow', GD, [(i - 1.5) * 0.02, -0.42, 0.01], [(i - 1.5) * 0.045, -0.62, 0.02], 0.006, 0.002, 3); }
  }
  return {
    fx: { color: GD, kind: 'ring' },
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
      const f = Math.sin(t * 1.5) * 0.12; for (const s of [-1, 1]) { const w = J[s > 0 ? 'wingR' : 'wingL']; w.g.rotation.z += s * (f + k.open * 0.75); w.g.rotation.y -= s * k.open * 0.9; w.g.rotation.x += k.open * -0.15; }
      J.skirt.g.rotation.x = Math.sin(t * 1.1) * 0.06; J.skirt.g.rotation.z = Math.sin(t * 0.9 + 1) * 0.06; J.skirt.g.scale.setScalar(1 + k.open * 0.15);
      if (J.whip) { J.whip.g.scale.y = 1 + k.ext * 1.9; J.whip.g.rotation.z = Math.sin(t * 2) * (0.12 - k.ext * 0.08); J.whip.g.rotation.x = Math.sin(t * 1.7) * 0.1; }
      J.root.g.position.y += k.open * 0.1 + 0.02 * Math.sin(t * 1.3);
    },
  };
}

const BUILDERS = { axioma, vesper, micelio, umbra, seraf };
export const HOST_COLORS = { axioma: 0x3aa8ff, vesper: 0xb04bff, micelio: 0x7be03a, umbra: 0xb98cff, seraf: 0xffd45a };
export const HOST_MODEL_IDS = Object.keys(BUILDERS);

/** Construye un Huésped. quality: 'low' | 'medium' | 'high' (más segmentos). */
export function buildHost(THREE, id, quality = 'low', opts = {}) {
  const T = THREE, mk = BUILDERS[id]; if (!mk) throw new Error('Huésped desconocido: ' + id);
  const color = HOST_COLORS[id], S = quality === 'low' ? 5 : quality === 'medium' ? 7 : 9;
  const P = makeBuilder(T, S), spec = mk(P, { color, S, native: opts.native !== false });
  const mats = {
    body: new T.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.5, flatShading: true, emissive: new T.Color(color).multiplyScalar(0.05) }),
    glow: new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    mem: new T.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.55, flatShading: true, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false, emissive: new T.Color(color).multiplyScalar(0.3) }),
  };
  const counts = P.finish(mats), J = P.joints, group = new T.Group(); group.name = 'huesped-' + id;
  group.add(J.root.g);
  // efecto de la habilidad: un aro que se expande desde los pies (1 llamada de dibujo más)
  const fxMat = new T.MeshBasicMaterial({ color: spec.fx.color, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  const vertical = spec.fx.kind === 'ringV', fxGeo = new T.RingGeometry(0.88, 1, 40), fx = new T.Mesh(fxGeo, fxMat);
  fx.rotation.x = vertical ? 0 : -Math.PI / 2; fx.position.y = vertical ? 1.1 : 0.04; fx.visible = false; fx.frustumCulled = false; group.add(fx);
  counts.draws += 1; counts.tris += 80;

  const names = Object.keys(J), cur = {}, snap = {}, Z = [0, 0, 0];
  for (const n of names) { cur[n] = [0, 0, 0]; snap[n] = [0, 0, 0]; }
  const st = { seq: null, name: 'idle', pt: 0, bt: 1, open: 0, ext: 0, y: 0 }, k = { open: 0, ext: 0 };
  const rotOf = (fr, n) => {
    const r = fr && fr.r; if (!r) return Z; if (r[n]) return r[n];
    const sd = n[n.length - 1]; if (sd === 'L' || sd === 'R') { const v = r[n.slice(0, -1)]; if (v) return sd === 'R' ? v : [v[0], -v[1], -v[2]]; }
    return Z;
  };
  const REST = { t: 0, r: {}, y: 0, open: 0, ext: 0 };
  const tgt = {}; for (const n of names) tgt[n] = [0, 0, 0];
  let tgtY = 0, tgtOpen = 0, tgtExt = 0;
  function evalSeq(pt) {
    const seq = st.seq; let a = REST, b = null;
    if (!seq) { for (const n of names) tgt[n][0] = tgt[n][1] = tgt[n][2] = 0; tgtY = tgtOpen = tgtExt = 0; return; }
    for (let i = 0; i < seq.length; i++) { if (pt < seq[i].t) { b = seq[i]; break; } a = seq[i]; }
    if (!b) { for (const n of names) { const v = rotOf(a, n); tgt[n][0] = v[0]; tgt[n][1] = v[1]; tgt[n][2] = v[2]; } tgtY = a.y || 0; tgtOpen = a.open || 0; tgtExt = a.ext || 0; st.seq = null; st.name = 'idle'; return; }
    const u = smooth(Math.min(1, Math.max(0, (pt - a.t) / (b.t - a.t))));
    for (const n of names) { const va = rotOf(a, n), vb = rotOf(b, n); for (let i = 0; i < 3; i++) tgt[n][i] = va[i] + (vb[i] - va[i]) * u; }
    tgtY = (a.y || 0) + ((b.y || 0) - (a.y || 0)) * u; tgtOpen = (a.open || 0) + ((b.open || 0) - (a.open || 0)) * u; tgtExt = (a.ext || 0) + ((b.ext || 0) - (a.ext || 0)) * u;
  }
  const ALIAS = { idle: 'idle', reposo: 'idle', melee: 'melee', ataque: 'melee', skill: 'skill', habilidad: 'skill' };
  function pose(name) {
    const nm = ALIAS[name] || 'idle'; for (const n of names) { snap[n][0] = cur[n][0]; snap[n][1] = cur[n][1]; snap[n][2] = cur[n][2]; }
    st.snapY = st.y; st.snapOpen = st.open; st.snapExt = st.ext; st.bt = 0; st.pt = 0;
    st.seq = nm === 'idle' ? null : spec.poses[nm]; st.name = nm;
    if (nm === 'skill') { st.fxT = 0; fx.visible = true; }
  }
  st.snapY = 0; st.snapOpen = 0; st.snapExt = 0; st.fxT = -1;
  let time = 0;
  function update(dt, t) {
    time = t == null ? time + dt : t; st.pt += dt; st.bt += dt;
    evalSeq(st.pt);
    const w = smooth(Math.min(1, st.bt / 0.14));
    for (const n of names) { const c = cur[n], a = snap[n], b = tgt[n]; for (let i = 0; i < 3; i++) c[i] = a[i] + (b[i] - a[i]) * w; }
    st.y = st.snapY + (tgtY - st.snapY) * w; st.open = st.snapOpen + (tgtOpen - st.snapOpen) * w; st.ext = st.snapExt + (tgtExt - st.snapExt) * w;
    k.open = st.open; k.ext = st.ext;
    const bre = Math.sin(time * 1.7), ph = Math.sin(time * 1.1);
    for (const n of names) { const j = J[n], c = cur[n]; j.g.rotation.set(j.rest[0] + c[0], j.rest[1] + c[1], j.rest[2] + c[2]); if (n !== 'root') j.g.scale.set(1, 1, 1); }
    J.root.g.position.set(0, st.y + bre * 0.006, 0);
    J.torso.g.scale.set(1 + bre * 0.012, 1 + bre * 0.02, 1 + bre * 0.012); J.torso.g.rotation.x += bre * 0.012;
    if (J.head) { J.head.g.rotation.y += Math.sin(time * 0.6) * 0.1; J.head.g.rotation.x += ph * 0.03; }
    for (const s of ['L', 'R']) { const a = J['arm' + s], f = J['fore' + s]; if (a) { a.g.rotation.x += Math.sin(time * 1.7 + (s === 'L' ? 0.8 : 0)) * 0.025; a.g.rotation.z += (s === 'L' ? -1 : 1) * (0.02 + bre * 0.01); } if (f) f.g.rotation.x += Math.sin(time * 1.7 + 0.5) * 0.03; }
    mats.glow.color.setScalar(0.85 + 0.2 * Math.sin(time * 2.4) + st.open * 0.3);
    spec.custom && spec.custom(k, time, J);
    if (st.fxT >= 0) {
      st.fxT += dt; const u = st.fxT / 1.3, big = spec.fx.big ? 2.4 : 1.6;
      if (u >= 1) { st.fxT = -1; fx.visible = false; fxMat.opacity = 0; } else { const e = 1 - Math.pow(1 - u, 2); fx.scale.setScalar(0.35 + e * big * (vertical ? 0.9 : 1)); fxMat.opacity = (1 - u) * 0.85; }
    }
  }
  function dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); for (const m of Object.values(mats)) m.dispose(); fxMat.dispose(); }
  pose('idle'); update(0, 0);
  return { group, update, pose, dispose, joints: J, mats, info: { id, draws: counts.draws, tris: Math.round(counts.tris) }, get poseName() { return st.name; } };
}
