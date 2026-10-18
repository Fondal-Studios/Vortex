// Modelos 3D procedurales de los 5 HUÉSPEDES (docs/HUESPEDES.md): almas y bestias en pena del limbo, guardianes entre los muertos y los vivos.
//   import { buildHost } from './huespedes-view.js';
//   const h = buildHost(THREE, 'vesper', 'low');   // → { group, update(dt, t), pose(name), dispose(), info }
//   scene.add(h.group); en cada cuadro: h.update(dt, t); h.pose('melee') | 'skill' | 'idle'
// Todo se arma con geometrías simples fusionadas por articulación (sin archivos externos, sin compilación):
// cada articulación = 1 malla «cuerpo» (metal/quitina, color por vértice) + 1 malla «brillo» (emisiva) + a veces 1 «membrana» translúcida.
// Presupuesto en Baja: ≤ 40 llamadas de dibujo y ≤ 15 000 triángulos por Huésped (ver `h.info` y tests/huespedes-ui.test.js).
// El frente del modelo mira a +Z; los pies están en y = 0.

import { LIMBO } from './huespedes-limbo.js';
import { hostMats, hostParticles } from './huesped-mat.js';

const UP = [0, 1, 0], ZERO = [0, 0, 0];
const smooth = (u) => u * u * (3 - 2 * u);

/** Constructor de piezas: junta geometrías por articulación y las fusiona al final. */
export function makeBuilder(T, S) {
  const joints = {};
  const m4 = new T.Matrix4(), q = new T.Quaternion(), eu = new T.Euler(), v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), cc = new T.Color();
  const xf = (geo, p = ZERO, r = ZERO, s = [1, 1, 1]) => { eu.set(r[0], r[1], r[2]); q.setFromEuler(eu); m4.compose(v1.set(p[0], p[1], p[2]), q, v2.set(s[0], s[1], s[2])); geo.applyMatrix4(m4); return geo; };
  const push = (j, kind, geo, col) => {
    const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose();
    const n = g.attributes.position.count; g.deleteAttribute('uv');
    if (!g.attributes.color) { const c = new Float32Array(n * 3); cc.set(col); for (let i = 0; i < n; i++) { c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; } g.setAttribute('color', new T.BufferAttribute(c, 3)); }
    if (!g.attributes.normal) g.computeVertexNormals(); j.parts[kind].push(g);
  };
  const sc = (n) => (S <= 5 ? Math.max(4, Math.round(n * 0.7)) : S >= 9 ? n + 2 : n); // Baja: menos caras; Alta: más
  const seg = (n) => (n ? sc(n) : S);
  const P = {
    joints,
    joint(name, parent, pos = ZERO) { const g = new T.Bone(); g.name = name; g.position.set(pos[0], pos[1], pos[2]); if (parent) parent.g.add(g); const j = { name, g, parts: { body: [], glow: [], mem: [] }, rest: [0, 0, 0] }; joints[name] = j; return j; },
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
    /** TUBO afilado que sigue una curva suave por los puntos `pts` (colas, raíces, tentáculos, astas, filamentos): radio r0→r1, color col→col2. */
    tube(j, k, col, pts, r0, r1, n = 6, col2 = null, taper = 1) {
      n = sc(n); const curve = new T.CatmullRomCurve3(pts.map((p) => new T.Vector3(p[0], p[1], p[2]))), M = Math.max(4, pts.length * 3), fr = curve.computeFrenetFrames(M, false), c1 = new T.Color(col), c2 = new T.Color(col2 == null ? col : col2), c3 = new T.Color();
      const pos = [], nor = [], cols = [], idx = [], pt = new T.Vector3();
      for (let i = 0; i <= M; i++) {
        const u = i / M, N = fr.normals[i], B = fr.binormals[i], r = Math.max(0.0005, r0 + (r1 - r0) * Math.pow(u, taper)); curve.getPointAt(u, pt); c3.copy(c1).lerp(c2, u);
        for (let a = 0; a < n; a++) { const an = (a / n) * 6.2832, ca = Math.cos(an), sa = Math.sin(an), nx = ca * N.x + sa * B.x, ny = ca * N.y + sa * B.y, nz = ca * N.z + sa * B.z; pos.push(pt.x + nx * r, pt.y + ny * r, pt.z + nz * r); nor.push(nx, ny, nz); cols.push(c3.r, c3.g, c3.b); }
      }
      for (let i = 0; i < M; i++) for (let a = 0; a < n; a++) { const a0 = i * n + a, a1 = i * n + ((a + 1) % n), b0 = (i + 1) * n + a, b1 = (i + 1) * n + ((a + 1) % n); idx.push(a0, a1, b0, a1, b1, b0); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); g.setIndex(idx); push(j, k, g, col);
    },
    /** LÁMINA (capa, velo, membrana de ala): superficie entre dos polilíneas A y B de igual largo; `seg` divisiones a lo ancho; color col→col2 de A a B. */
    sheet(j, k, col, A, B, seg = 2, col2 = null) {
      const pos = [], cols = [], idx = [], c1 = new T.Color(col), c2 = new T.Color(col2 == null ? col : col2), c3 = new T.Color(), R = A.length;
      for (let i = 0; i < R; i++) for (let s = 0; s <= seg; s++) { const u = s / seg; pos.push(A[i][0] + (B[i][0] - A[i][0]) * u, A[i][1] + (B[i][1] - A[i][1]) * u, A[i][2] + (B[i][2] - A[i][2]) * u); c3.copy(c1).lerp(c2, u); cols.push(c3.r, c3.g, c3.b); }
      for (let i = 0; i < R - 1; i++) for (let s = 0; s < seg; s++) { const a = i * (seg + 1) + s, b = a + 1, c = a + seg + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals(); push(j, k, g, col);
    },
    /** SÓLIDO DE REVOLUCIÓN (túnica, capa, tronco, sombrero de hongo): perfil [[radio, altura], …] de abajo hacia arriba girado alrededor de Y; color col abajo → col2 arriba. */
    lathe(j, k, col, prof, n = 10, p = ZERO, r = ZERO, col2 = null, s = [1, 1, 1]) {
      const g = new T.LatheGeometry(prof.map((q) => new T.Vector2(q[0], q[1])), sc(n)), pa = g.attributes.position, cols = new Float32Array(pa.count * 3), c1 = new T.Color(col), c2 = new T.Color(col2 == null ? col : col2), c3 = new T.Color(), y0 = prof[0][1], y1 = prof[prof.length - 1][1];
      for (let i = 0; i < pa.count; i++) { c3.copy(c1).lerp(c2, (pa.getY(i) - y0) / (y1 - y0 || 1)); cols[i * 3] = c3.r; cols[i * 3 + 1] = c3.g; cols[i * 3 + 2] = c3.b; }
      g.setAttribute('color', new T.BufferAttribute(cols, 3)); push(j, k, xf(g, p, r, s), col);
    },
    /** BULTO orgánico: esfera con relieve irregular (músculo, tumor, hongo, hueso nudoso). jit = irregularidad, seed = variante. */
    lump(j, k, col, rad, p, s = [1, 1, 1], n = 8, jit = 0.14, seed = 1, r = ZERO) {
      const g = new T.SphereGeometry(rad, seg(n) + 2, seg(n)), pa = g.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i), h = Math.sin(x * 9.1 + seed * 3.7) * Math.cos(y * 7.3 + seed) + Math.sin(z * 8.2 + seed * 1.3 + x * 3.1) * 0.8; const f = 1 + jit * h * 0.5; pa.setXYZ(i, x * f, y * f, z * f); }
      g.computeVertexNormals(); push(j, k, xf(g, p, r, s), col);
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
  /** Une TODAS las piezas en 3 mallas con esqueleto (cuerpo, brillo, membrana): cada vértice sigue a su articulación (piel rígida). Sea cual sea el número de
   *  articulaciones o de mutaciones, el Huésped cuesta 3 llamadas de dibujo. Devuelve { draws, tris, meshes, skeleton }; quien llama agrega las mallas al mismo grupo que la raíz. */
  P.finish = (mats) => {
    const list = Object.values(joints), idx = new Map(list.map((j, i) => [j, i])), offs = list.map((j) => { let x = 0, y = 0, z = 0, o = j.g; while (o && o.isBone) { x += o.position.x; y += o.position.y; z += o.position.z; o = o.parent; } return [x, y, z]; });
    const skeleton = new T.Skeleton(list.map((j) => j.g), offs.map((o) => new T.Matrix4().makeTranslation(-o[0], -o[1], -o[2])));
    const meshes = []; let tris = 0;
    for (const kind of ['body', 'glow', 'mem']) {
      let n = 0; for (const j of list) for (const g of j.parts[kind]) n += g.attributes.position.count; if (!n) continue;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4); let o = 0;
      for (const j of list) { const bi = idx.get(j), off = offs[bi]; for (const g of j.parts[kind]) { const c = g.attributes.position.count, pa = g.attributes.position.array; for (let q = 0; q < c; q++) { pos[(o + q) * 3] = pa[q * 3] + off[0]; pos[(o + q) * 3 + 1] = pa[q * 3 + 1] + off[1]; pos[(o + q) * 3 + 2] = pa[q * 3 + 2] + off[2]; si[(o + q) * 4] = bi; sw[(o + q) * 4] = 1; }
        nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += c; g.dispose(); } j.parts[kind] = []; }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setAttribute('skinIndex', new T.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(sw, 4));
      const mesh = new T.SkinnedMesh(geo, mats[kind]); mesh.frustumCulled = false; mesh.name = 'huesped:' + kind; if (kind === 'mem') mesh.renderOrder = 2; mesh.bind(skeleton, new T.Matrix4()); meshes.push(mesh); tris += n / 3;
    }
    return { draws: meshes.length, tris, meshes, skeleton };
  };
  return P;
}

// Los cinco cuerpos (almas y bestias en pena) viven en huespedes-limbo.js; los materiales y partículas, en huesped-mat.js.
// Convención de ángulos: en un brazo que cuelga, rotación X NEGATIVA = levantarlo hacia el frente; Z positiva en el lado derecho (R) = abrirlo hacia afuera.
// En los cuadros de pose, `arm`/`fore` valen para el lado R y se espejan solos en el L (salvo que se dé `armL` explícito).

const BUILDERS = LIMBO;
export const HOST_COLORS = { axioma: 0x3aa8ff, vesper: 0xb04bff, micelio: 0x7be03a, umbra: 0xb98cff, seraf: 0xffd45a };
export const HOST_MODEL_IDS = Object.keys(BUILDERS);

/** Construye un Huésped. quality: 'low' | 'medium' | 'high' (más segmentos). */
export function buildHost(THREE, id, quality = 'low', opts = {}) {
  const T = THREE, mk = BUILDERS[id]; if (!mk) throw new Error('Huésped desconocido: ' + id);
  const color = HOST_COLORS[id], S = quality === 'low' ? 5 : quality === 'medium' ? 7 : 9;
  const P = makeBuilder(T, S), spec = mk(P, { color, S, native: opts.native !== false });
  const mutAnim = []; if (opts.mutate) opts.mutate(P, P.joints, spec, mutAnim); // mutaciones de camino / región: se funden con las mallas del cuerpo (huespedes-mut.js)
  const M = hostMats(T, { color, quality, ...(spec.mat || {}) }), mats = M;
  const counts = P.finish(mats), J = P.joints, group = new T.Group(); group.name = 'huesped-' + id;
  group.add(J.root.g); for (const m of counts.meshes) group.add(m);
  // efecto de la habilidad: un aro que se expande desde los pies (1 llamada de dibujo más)
  const fxMat = new T.MeshBasicMaterial({ color: spec.fx.color, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false });
  const vertical = spec.fx.kind === 'ringV', fxGeo = new T.RingGeometry(0.88, 1, 40), fx = new T.Mesh(fxGeo, fxMat);
  fx.rotation.x = vertical ? 0 : -Math.PI / 2; fx.position.y = vertical ? 1.1 : 0.04; fx.visible = false; fx.frustumCulled = false; group.add(fx);
  counts.draws += 1; counts.tris += 80;

  // partículas propias (1 llamada): suben y giran alrededor del cuerpo
  const parts = spec.particles ? hostParticles(T, spec.particles.kind, spec.particles) : null; if (parts) { parts.material.uniforms.uPx.value = quality === 'low' ? 0.8 : 1; group.add(parts.points); counts.draws += 1; counts.tris += 0; }
  let region = null;
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
    M.tick(time, evoLevel, st.open); if (parts) parts.tick(time);
    spec.custom && spec.custom(k, time, J);
    if (mutAnim.fn) mutAnim.fn(time, k);
    if (st.fxT >= 0) {
      st.fxT += dt; const u = st.fxT / 1.3, big = spec.fx.big ? 2.4 : 1.6;
      if (u >= 1) { st.fxT = -1; fx.visible = false; fxMat.opacity = 0; } else { const e = 1 - Math.pow(1 - u, 2); fx.scale.setScalar(0.35 + e * big * (vertical ? 0.9 : 1)); fxMat.opacity = (1 - u) * 0.85; }
    }
  }
  function dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); M.dispose(); counts.skeleton.dispose(); if (parts) parts.dispose(); fxMat.dispose(); }
  let evoLevel = 0;
  /** Región (mapa): color regional del borde de luz, los brillos y las partículas. `hex` null = sin región. */
  function setRegion(hex) { region = hex; M.setRegion(hex); if (parts) parts.set(hex == null ? spec.particles.color : hex); }
  pose('idle'); update(0, 0);
  return { group, update, pose, dispose, setRegion, setEvoLevel(n) { evoLevel = n; }, anchors: spec.anchors, pal: spec.pal, joints: J, mats, get region() { return region; }, info: { id, draws: counts.draws, tris: Math.round(counts.tris) }, get poseName() { return st.name; } };
}
