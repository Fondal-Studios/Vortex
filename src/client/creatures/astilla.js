// ASTILLA — corredor. Depredador-insecto de biocristal: tórax acorazado con hombros, cintura de avispa, abdomen segmentado que
// se enrosca hacia arriba y termina en un aguijón de cristal, 6 patas largas con articulaciones y espinas (IK real sobre un
// esqueleto), mandíbulas serradas, antenas que restallan y dos ojos de verdad (iris, pupila vertical, párpados).
// Cuerpo = 1 malla con esqueleto por material (carne, quitina, cristal) => pocos draw calls.
// Estados reales: run (zigzag) / leap (salto 7–18 u, mandíbulas abiertas). st.hp<0.35 cojea; st.sd escudada; st.st aturdida.
import { THREE, TAU, lod, clamp, lerp, smooth, rng, bio, crystalMat, lidMaterial, ellipsoid, tube, spike, plate, crystal, crystalCluster, paint, orient, path, Rig, skinRigid, skinChain, eye, legIK, boneMatrix, toLocal, boneQuat, gait, shieldAura, tickAura, Spring, dampTo } from './geoda-bio.js';

export default function build(kit, color) {
  const L = lod(), low = L.low, hi = L.hi, V3 = THREE.Vector3;
  const col = new THREE.Color(color), R = rng(7);
  const carap = bio({ rough: 0.5, clear: 0.4, clearRough: 0.3, metal: 0.0, tex: 'plates', tile: 1.4, bump: 0.7, grain: 0.6, seam: color, seamK: 0.3, seamGlow: 0.25, vcol: true });
  const flesh = bio({ rough: 0.6, clear: 0.15, sheen: 0, tex: 'skin', tile: 1.6, bump: 0.6, grain: 0.5, seam: 0x180a14, seamK: 0.4, vein: color, veinK: 0.55, veinGlow: 0.7, sss: 0.0, sssColor: 0x30b0a8 });
  const cry = crystalMat(color, { glow: 0.95, alpha: 0.9 });
  const mats = [carap, flesh, cry];

  const rig = new Rig();
  const root = rig.bone(null, [0, 0, 0], 'root');
  const body = rig.bone(root, [0, 0.76, 0.0], 'body');
  const thorax = rig.bone(body, [0, 0.78, 0.2], 'thorax');
  const neck = rig.bone(thorax, [0, 0.78, 0.5], 'neck');
  const head = rig.bone(neck, [0, 0.82, 0.8], 'head');
  const abd1 = rig.bone(body, [0, 0.72, -0.45], 'abd1'), abd2 = rig.bone(abd1, [0, 0.8, -1.0], 'abd2'), abd3 = rig.bone(abd2, [0, 1.1, -1.45], 'abd3'), sting = rig.bone(abd3, [0, 1.38, -1.55], 'sting');
  const jaw = [-1, 1].map((s) => rig.bone(head, [s * 0.09, 0.79, 1.1], 'jaw'));
  const palp = [-1, 1].map((s) => rig.bone(head, [s * 0.05, 0.73, 1.2], 'palp'));
  const ant = [-1, 1].map((s) => [rig.bone(head, [s * 0.06, 1.0, 1.0], 'a1'), null, null, null].map((b, i, a) => { if (i === 0) return b; const P = [[0, 0, 0], [s * 0.2, 1.32, 1.28], [s * 0.4, 1.58, 1.6], [s * 0.66, 1.66, 2.0]][i]; a[i] = rig.bone(a[i - 1], P, 'a' + i); return a[i]; }));
  // ── cuerpo: tubo con radio variable (cuello, tórax, cintura, abdomen que se enrosca) ──
  const SP = [[0, .78, .62], [0, .78, .40], [0, .80, .12], [0, .74, -.18], [0, .70, -.40], [0, .72, -.62], [0, .80, -1.0], [0, .98, -1.35], [0, 1.22, -1.55], [0, 1.46, -1.5]];
  const RK = [.10, .2, .30, .26, .10, .2, .31, .24, .14, .06], rf = (t) => { const f = t * (RK.length - 1), i = Math.min(RK.length - 2, Math.floor(f)); return lerp(RK[i], RK[i + 1], smooth(0, 1, f - i)); };
  const sp = path(SP);
  const segN = low ? 22 : hi ? 40 : 30, sides = low ? 7 : hi ? 12 : 9;
  const ring = (t) => (t > 0.5 ? Math.pow(Math.abs(Math.sin((t - 0.5) / 0.5 * Math.PI * 3.5)), 0.5) : 1);
  const bodyGeo = tube(SP, { rad: rf, seg: segN, sides, ex: [0.92, 1.1], bulge: (t, a) => (t > 0.5 ? 0.9 + 0.1 * ring(t) : 1) * (1 + 0.1 * Math.pow(Math.max(0, Math.cos(a)), 6)) });
  paint(bodyGeo, (p, n) => { const up = clamp(n.y * 0.5 + 0.5, 0, 1); return new THREE.Color(0x3c1626).lerp(new THREE.Color(0x10181e), smooth(0.2, 0.8, up)); });
  rig.add(flesh, skinChain(bodyGeo, [neck, thorax, body, abd1, abd2, abd3, sting], 0.2));
  // ── placas de quitina superpuestas: pronoto, escudo del tórax y tergitos del abdomen ──
  const dark = 0x0e1a22, mid = 0x172a33, edge = 0x4a8a90;
  const plateOn = (t, w, l, h, o = {}) => { const P = sp.at(t), T = sp.tan(t), up = new V3(0, 1, 0).addScaledVector(T, -T.y).normalize(), q = orient(up, T.clone().negate()); return plate({ w, l, h, nr: low ? 2 : 3, ns: low ? 6 : 9, pow: 1.5, wrap: o.wrap ?? 1.3, curve: o.curve ?? -0.4, keel: o.keel ?? 0.5, pt: 0.3, quat: q, pos: P.clone().addScaledVector(up, rf(t) * (o.in ?? 0.92)), col: o.col ?? mid, col2: edge }); };
  const tergBone = (t) => (t < 0.18 ? thorax : t < 0.42 ? body : t < 0.62 ? abd1 : t < 0.8 ? abd2 : abd3);
  const addPlate = (t, w, l, h, o) => { const g = plateOn(t, w, l, h, o); rig.add(carap, skinChain(g, [neck, thorax, body, abd1, abd2, abd3, sting], 0.2)); };
  addPlate(0.12, 0.2, 0.2, 0.07, { col: dark }); addPlate(0.22, 0.27, 0.24, 0.1, { col: mid, keel: 0.9 }); addPlate(0.32, 0.22, 0.17, 0.07, { col: dark });
  const nAb = low ? 4 : 6; for (let i = 0; i < nAb; i++) { const t = 0.52 + (i / (nAb - 1)) * 0.4; addPlate(t, 0.2 + 0.1 * Math.sin((i / (nAb - 1)) * 3), 0.13, 0.06, { col: i % 2 ? dark : mid, keel: 0.7 }); }
  // ── cabeza ──
  const hw = 0.19;
  const skull = ellipsoid([hw, 0.16, 0.27], { w: low ? 10 : 16, h: low ? 7 : 12, noise: 0.08, seed: 3, pos: [0, 0.83, 0.97] }); paint(skull, (p, n) => new THREE.Color(0x14242c).lerp(new THREE.Color(0x090f14), smooth(0.2, -0.8, n.y)));
  rig.add(carap, skinRigid(skull, head));
  const face = ellipsoid([0.12, 0.1, 0.13], { w: 10, h: 7, seed: 9, pos: [0, 0.76, 1.15] }); paint(face, 0x1c3038); rig.add(carap, skinRigid(face, head));
  const hp = (g) => rig.add(carap, skinRigid(g, head));
  hp(plate({ w: 0.12, l: 0.2, h: 0.08, nr: 3, ns: 8, keel: 1.0, wrap: 1.5, pos: [0, 0.99, 0.93], dir: [0, 1, -0.1], col: dark }));
  for (const s of [-1, 1]) {
    hp(plate({ w: 0.075, l: 0.14, h: 0.05, nr: 2, ns: 7, pos: [s * 0.11, 0.97, 1.06], quat: orient(new V3(s * 0.55, 1, 0.1), new V3(0, 0.1, 1)), col: dark }));   // ceja sobre el ojo
    hp(spike(0.028, 0.3, { bend: 0.5, bendDir: [s * 0.5, 0.2, 0], pos: [s * 0.1, 0.93, 0.78], dir: [s * 0.35, 0.5, -0.8] }));        // cuernos swept
    hp(spike(0.02, 0.12, { pos: [s * 0.16, 0.76, 1.08], dir: [s * 1, -0.1, 0.6] }));                                               // espina de mejilla
    hp(plate({ w: 0.06, l: 0.1, h: 0.035, nr: 2, ns: 6, pos: [s * 0.15, 0.74, 0.95], quat: orient(new V3(s * 1, 0.2, 0), new V3(0, 0, 1)), col: mid }));
  }
  // ── ojos reales ──
  const eyes = [], eyeMount = [];
  for (const s of [-1, 1]) {
    const e = eye({ r: 0.095, iris: color, iris2: new THREE.Color(color).multiplyScalar(0.25).getHex(), vein: 0x501828, pupil: 'slit', irisR: 0.95, sclera: 0x3a4a46, glow: 0.55, lidMat: lidMaterial({ color: 0x1a2c34, vein: 0x0a2830, tile: 2, sssColor: 0x40e0d0, sss: 0.3 }), slant: -s * 0.0 + 0.22, maxYaw: 0.5, maxPitch: 0.45, follow: 0.9 });
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, s * 0.75, 0)); e.object.quaternion.copy(q); e.mount = q; rig.attach(head, e.object, [s * 0.14, 0.885, 1.04]); eyes.push(e); mats.push(e.mat, e.lid.material);
  }
  const oce = [-1, 1].map((s) => { const e = eye({ r: 0.032, iris: color, sclera: 0x0a2a2a, irisR: 1.1, pupil: 'round', glow: 0.9, lids: false }); e.object.quaternion.setFromEuler(new THREE.Euler(-0.6, s * 0.25, 0)); rig.attach(head, e.object, [s * 0.045, 1.03, 1.0]); mats.push(e.mat); return e; });
  // ── mandíbulas serradas + labio con dientes + palpos ──
  jaw.forEach((jb, k) => {
    const s = k ? 1 : -1, P = [[s * 0.07, 0.79, 1.1], [s * 0.21, 0.74, 1.27], [s * 0.2, 0.67, 1.5], [s * 0.06, 0.68, 1.68]];
    const g = tube(P, { rad: (t) => 0.036 * Math.pow(1 - t, 0.7) + 0.005, seg: low ? 6 : 10, sides: low ? 4 : 6, ex: [1.3, 0.8] }); paint(g, (p) => new THREE.Color(0x16262e).lerp(new THREE.Color(0xe6dcc0), smooth(0.2, 0.05, p.distanceTo(new V3(...P[3]))))); rig.add(carap, skinRigid(g, jb));
    const nT = low ? 3 : 5, cu = sp; for (let i = 0; i < nT; i++) { const t = 0.35 + (i / nT) * 0.6, c = new THREE.CatmullRomCurve3(P.map((q) => new V3(...q))).getPointAt(t); const tg = spike(0.011 + R() * 0.006, 0.05 + R() * 0.045, { sides: 3, seg: 1, pos: [c.x - s * 0.012, c.y - 0.006, c.z], dir: [-s * (0.7 + R() * 0.3), -0.1, 0.35 + R() * 0.4] }); paint(tg, 0xf0e6cf); rig.add(carap, skinRigid(tg, jb)); }
  });
  const mouth = ellipsoid([0.085, 0.045, 0.11], { w: 9, h: 6, seed: 4, pos: [0, 0.745, 1.2] }); paint(mouth, 0x5a0f24); rig.add(flesh, skinRigid(mouth, head));
  palp.forEach((pb, k) => { const s = k ? 1 : -1, g = tube([[s * 0.05, 0.73, 1.2], [s * 0.07, 0.69, 1.3], [s * 0.04, 0.66, 1.38]], { rad: [0.02, 0.008], seg: 3, sides: 4 }); paint(g, 0xc89098); rig.add(flesh, skinRigid(g, pb)); });
  // ── antenas anilladas ──
  ant.forEach((ch) => { const J = ch.map((b) => b.userData.rest), g = tube(J, { rad: (t) => 0.024 * (1 - t * 0.8), seg: low ? 8 : 14, sides: low ? 3 : 4, bulge: (t) => 1 + 0.35 * Math.pow(Math.abs(Math.sin(t * TAU * 5)), 3), caps: false }); paint(g, (p, n, i) => new THREE.Color(0x14333b).lerp(new THREE.Color(color), smooth(1.4, 2.0, p.z))); rig.add(carap, skinChain(g, ch, 0.12)); });
  // ── patas: cadera→rodilla→pie (IK), con nudillo, espinas y cristales en la rodilla ──
  const legDefs = [
    { par: thorax, hip: [0.17, 0.74, 0.40], knee: [0.5, 1.0, 0.62], foot: [0.62, 0, 1.05], base: [0.62, 0, 0.98], sw: 0.5 },
    { par: thorax, hip: [0.2, 0.72, 0.10], knee: [0.64, 0.98, 0.14], foot: [0.95, 0, 0.1], base: [0.95, 0, 0.12], sw: 0.4 },
    { par: body, hip: [0.18, 0.7, -0.3], knee: [0.56, 0.9, -0.62], foot: [0.82, 0, -1.0], base: [0.82, 0, -1.0], sw: 0.45 },
  ];
  const legs = [];
  for (let side = 0; side < 2; side++) legDefs.forEach((d, row) => {
    const s = side ? 1 : -1, H = new V3(d.hip[0] * s, d.hip[1], d.hip[2]), K = new V3(d.knee[0] * s, d.knee[1], d.knee[2]), F = new V3(d.foot[0] * s, d.foot[1] + 0.02, d.foot[2]);
    const hb = rig.bone(d.par, H, 'hip'), kb = rig.bone(hb, K, 'knee'), fb = rig.bone(kb, F, 'foot');
    const L1 = H.distanceTo(K), L2 = K.distanceTo(F), f1 = L1 / (L1 + L2);
    const mid1 = H.clone().lerp(K, 0.5).add(new V3(s * 0.05, 0.06, 0)), mid2 = K.clone().lerp(F, 0.5).add(new V3(s * 0.07, 0.02, 0));
    const g = tube([H, mid1, K, mid2, F], { rad: (t) => (t < f1 ? lerp(0.075, 0.052, t / f1) + 0.022 * Math.exp(-Math.pow((t - f1) / 0.035, 2)) : lerp(0.042, 0.01, Math.pow((t - f1) / (1 - f1), 0.8))), seg: low ? 10 : 16, sides: low ? 5 : 7, ex: [1, 1], caps: false });
    paint(g, (p) => new THREE.Color(0x101e26).lerp(new THREE.Color(0x5aa8a8), smooth(0.04, 0, p.distanceTo(K))).lerp(new THREE.Color(0x070d12), smooth(0.5, 0.0, p.y)));
    rig.add(carap, skinChain(g, [hb, kb, fb], 0.09));
    const nS = low ? 1 : 3; for (let i = 0; i < nS; i++) { const t = 0.3 + i * 0.22, c = K.clone().lerp(F, t); const sg = spike(0.014, 0.1 + R() * 0.05, { sides: 3, seg: 1, pos: [c.x + s * 0.03, c.y, c.z], dir: [s * 0.6, 0.4, 0.5 + (i % 2) * 0.3] }); paint(sg, 0x3b8a90); rig.add(carap, skinRigid(sg, kb)); }
    const kc = crystalCluster(low ? 1 : 2, 0.018, 0.13, { pos: [K.x + s * 0.02, K.y + 0.045, K.z], dir: [s * 0.4, 1, -0.3], seed: 31 + side * 3 + row, c0: 0x0f4f58, c1: 0xe0ffff }); kc.forEach((c) => rig.add(cry, skinRigid(c, hb)));
    legs.push({ hb, kb, fb, par: d.par, s, row, side, base: new V3(d.base[0] * s, 0, d.base[2]), sw: d.sw, ph: (row + side) % 2 ? Math.PI : 0, foot: new V3(), kneeRest: K });
  });
  // ── cresta de biocristal con lógica: nace de las juntas de las placas (hombros, columna, cola) y el aguijón ──
  const cl = (t, n, r, h, bone, seed, dir = [0, 1, -0.2], off = [0, 0, 0]) => { const P = sp.at(t), up = new V3(0, 1, 0); crystalCluster(n, r, h, { pos: [P.x + off[0], P.y + rf(t) * 0.95 + off[1], P.z + off[2]], dir, seed, c0: 0x0e4a52, c1: 0xe8ffff }).forEach((c) => rig.add(cry, skinRigid(c, bone))); };
  cl(0.2, low ? 3 : 4, 0.04, 0.36, thorax, 11, [0, 1, -0.3]); cl(0.3, 3, 0.03, 0.26, body, 12, [0, 1, -0.4]);
  cl(0.56, 3, 0.033, 0.3, abd1, 13); cl(0.7, 3, 0.036, 0.34, abd2, 14, [0, 1, -0.5]); cl(0.82, 2, 0.03, 0.26, abd3, 15, [0, 1, -0.6]);
  for (const s of [-1, 1]) cl(0.17, 2, 0.026, 0.2, thorax, 20 + s, [s * 0.9, 1, -0.2], [s * 0.2, -0.18, 0]);
  rig.add(cry, skinRigid(crystal(0.055, 0.46, { sides: 6, taper: 0.7, tip: 0.35, lean: 0.4, seed: 5, pos: [0, 1.44, -1.52], dir: [0, 0.75, 0.6], c0: 0x0e4a52, c1: 0xffffff }), sting));
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.5); aura.position.set(0, 0.8, 0); rootObj.add(aura);
  // estado de animación
  const sHead = new Spring(0, 70, 9), sPit = new Spring(0, 70, 9), sTail = new Spring(0, 55, 5), sBody = new Spring(0, 60, 7), sAnt = ant.map(() => [new Spring(0, 40, 4.5), new Spring(0, 40, 4.5)]);
  let phase = 0, leapK = 0, jawO = 0.1, runK = 0, tic = 2, ticT = 0, stunK = 0, prevLeap = false, land = 0;
  const tmp = new V3(), tgt = new V3(), pm = new THREE.Matrix4(), q1 = new THREE.Quaternion(), look = new V3(0, 0, 1), lh = new V3();
  const bend = new V3();
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05);
    const speed = Math.min(1.6, ctx.speed || 0), leap = st.s === 'leap', hurt = st.hp != null && st.hp < 0.35, stun = !!st.st;
    if (ctx.look) look.copy(ctx.look);
    leapK = dampTo(leapK, leap ? 1 : 0, leap ? 14 : 7, dt); stunK = dampTo(stunK, stun ? 1 : 0, 8, dt); runK = dampTo(runK, Math.min(1, speed * 1.2), 6, dt);
    if (prevLeap && !leap) land = 1; prevLeap = leap; land = Math.max(0, land - dt * 4);
    phase += dt * (stun ? 0 : (5 + speed * 12) * (hurt ? 0.7 : 1));
    // tics: de vez en cuando una pata se sacude / mandíbulas chasquean
    tic -= dt; if (tic <= 0) { ticT = 1; tic = 1.5 + Math.random() * 3; } ticT = Math.max(0, ticT - dt * 3.5);
    // cuerpo: rebote de la marcha, inclinación al correr, agachado antes del salto; cojea si herida
    const bob = Math.abs(Math.sin(phase)) * 0.045 * (0.3 + runK), breath = Math.sin(t * 2.4 + st.id) * 0.012;
    const crouch = 0.1 * runK + 0.14 * land + (hurt ? 0.07 : 0) + stunK * 0.08;
    body.position.y = body.userData.rest.y - crouch + bob + breath + leapK * 0.22;
    body.rotation.x = -0.05 * runK - leapK * 0.42 + (hurt ? 0.08 : 0) + land * 0.1 + sBody.step(dt, Math.sin(phase * 2) * 0.03 * runK);
    body.rotation.z = Math.sin(phase) * 0.05 * runK + (hurt ? Math.sin(t * 2) * 0.05 + 0.1 : 0) + (stun ? Math.sin(t * 28) * 0.05 : 0);
    thorax.scale.set(1 + Math.sin(t * 2.4 + st.id) * 0.015, 1 + Math.sin(t * 2.4 + st.id) * 0.02, 1);      // respiración
    // cabeza: sigue al jugador con retardo + escanea (tics) / baja al correr
    const lx = Math.atan2(look.x, Math.max(0.25, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    neck.rotation.y = sHead.step(dt, clamp(lx, -0.9, 0.9) * 0.55 + (stun ? Math.sin(t * 9) * 0.25 : 0)); thorax.rotation.y = neck.rotation.y * 0.25;
    neck.rotation.x = sPit.step(dt, -clamp(ly, -0.4, 0.5) * 0.5 + 0.1 * runK + leapK * 0.45 + (hurt ? 0.25 : 0) + stunK * 0.3);
    head.rotation.y = clamp(lx, -0.9, 0.9) * 0.3 + Math.sin(t * 0.9 + st.id) * 0.04 * (1 - runK) + ticT * Math.sin(ticT * 9) * 0.1;
    // abdomen: cuelga con inercia (resorte), se enrosca al saltar y late
    const tl = sTail.step(dt, -runK * 0.12 + leapK * 0.5 + (hurt ? -0.2 : 0) + Math.sin(phase) * 0.05 * runK);
    abd1.rotation.x = tl * 0.5 + Math.sin(t * 1.3 + st.id) * 0.03; abd2.rotation.x = tl * 0.7 + 0.08 + Math.sin(t * 1.6 + 1 + st.id) * 0.05; abd3.rotation.x = tl * 0.9 + 0.1 + Math.sin(t * 1.9 + 2) * 0.07;
    abd1.rotation.y = abd2.rotation.y = abd3.rotation.y = Math.sin(phase) * 0.12 * runK;
    // mandíbulas y palpos
    const jt = leap ? 1 : stun ? 0.55 : 0.12 + 0.2 * runK + Math.max(0, Math.sin(ticT * 12)) * ticT * 0.5 + (hurt ? 0.25 : 0);
    jawO = dampTo(jawO, jt, leap ? 20 : 9, dt);
    jaw.forEach((jb, k) => { const s = k ? 1 : -1; jb.rotation.y = s * (-0.08 - jawO * 0.5 + Math.sin(t * 18 + k) * 0.05 * (runK + ticT)); jb.rotation.z = s * -jawO * 0.15; });
    palp.forEach((pb, k) => { pb.rotation.x = Math.sin(t * 9 + k * 2) * 0.35 * (0.3 + runK) + jawO * 0.3; pb.rotation.y = (k ? 1 : -1) * jawO * 0.25; });
    // antenas: latigazos con resortes encadenados
    ant.forEach((ch, k) => { const s = k ? 1 : -1, tw = Math.sin(t * 3.1 + k * 2.2 + st.id) * 0.18 + Math.sin(t * 7.3 + k) * 0.08 * (1 + runK), sw = leap ? -0.5 : 0.1 * runK;
      const a = sAnt[k][0].step(dt, tw + sw), b = sAnt[k][1].step(dt, tw * 1.5 + sw * 1.2 - sBody.v * 0.4);
      ch[0].rotation.set(0.1 + a * 0.5 - ly * 0.1, s * 0.06 + a * 0.5, 0); ch[1].rotation.set(b * 0.8 + 0.05, b * 0.7, 0); ch[2].rotation.set(b * 1.1, b * 0.6, 0); });
    // ojos: miran al jugador (globo gira), se achican al saltar
    head.updateMatrix(); boneQuat(head, root, q1); lh.copy(look).applyQuaternion(q1.clone().invert());
    eyes.forEach((e, k) => { tmp.copy(lh).applyQuaternion(e.mount.clone().invert()); e.update(dt, tmp, { open: stun ? 0.4 : leap ? 1.0 : hurt ? 0.7 : 0.9, dilate: leap ? 0.5 : -0.1 * runK, glowMul: 0.7 + 0.8 * leapK, squint: runK * 0.5, quiver: stun ? 1 : 0 }); });
    oce.forEach((e) => { tmp.copy(lh); e.update(dt, tmp, { glowMul: 1 + leapK }); });
    // patas: marcha de trípodes (IK). Salto: patas delanteras al frente, traseras estiradas. Cojera: pata trasera izquierda arrastra.
    const parentM = new Map();
    legs.forEach((Lg, i) => {
      let pmx = parentM.get(Lg.par); if (!pmx) { pmx = boneMatrix(Lg.par, root, new THREE.Matrix4()); parentM.set(Lg.par, pmx); }
      const tri = (Lg.row + Lg.side) % 2 ? 1 : 0, ph = phase + tri * Math.PI, [adv, lift] = gait(ph, 0.4 + 0.1 * (1 - runK));
      const stride = Lg.sw * (0.25 + 0.75 * Math.min(1, speed + 0.2)) * (1 - 0.4 * stunK), lh2 = 0.34 * Math.min(1, 0.25 + speed) * (stun ? 0 : 1);
      tgt.set(Lg.base.x * (1 + 0.1 * runK), Lg.base.y + lift * lh2, Lg.base.z + adv * stride * (runK > 0.08 ? 1 : 0));
      // idle: pequeñas correcciones de pasos (pisa y se reacomoda)
      if (runK < 0.08) { tgt.x += Math.sin(t * 0.7 + i * 2) * 0.01; tgt.y += Math.max(0, Math.sin(t * 1.3 + i * 1.7)) ** 12 * 0.1; if (ticT > 0.1 && i === 1) tgt.y += Math.sin(ticT * 3) * 0.28; }
      // salto: patas delanteras alzadas al frente, medias a los lados, traseras estiradas atrás
      if (leapK > 0.01) { const lp = Lg.row === 0 ? [Lg.s * 0.4, 0.95, 1.5] : Lg.row === 1 ? [Lg.s * 1.1, 0.5, 0.2] : [Lg.s * 0.5, 0.2, -1.5]; tgt.x = lerp(tgt.x, lp[0], leapK); tgt.y = lerp(tgt.y, lp[1], leapK); tgt.z = lerp(tgt.z, lp[2], leapK); }
      if (hurt && Lg.row === 2 && Lg.side === 0) { tgt.y = 0.03 + (Math.sin(t * 3) > 0.5 ? 0.2 : 0); tgt.z = Lg.base.z + 0.15 - ((t * 0.6) % 1) * 0.25; }
      if (stunK > 0.01) { tgt.x = lerp(tgt.x, Lg.base.x * 1.25, stunK); tgt.y = lerp(tgt.y, 0.02, stunK) + Math.sin(t * 30 + i) * 0.015 * stunK; }
      const lp = toLocal(Lg.par, root, tgt, new V3(), pmx);
      bend.set(Lg.s * 0.8, 1.2, -0.1); legIK(Lg.hb, Lg.kb, Lg.fb, lp, bend);
    });
    // cristales laten; aviso de salto = brillo
    cry.userData.u.uGlow.value = 0.9; cry.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 4 + st.id) + 1.2 * leapK + (hurt ? 0.5 * Math.sin(t * 22) ** 2 : 0);
    carap.userData.u.uSeamGlow.value = 0.8 + 0.5 * Math.sin(t * 3) + 1.4 * leapK + (hurt ? 0.8 : 0); flesh.userData.u.uVeinGlow.value = 1.0 + 0.6 * Math.sin(t * 5.5) + leapK;
    rootObj.rotation.z = stun ? Math.sin(t * 31) * 0.03 : 0; tickAura(aura, st, t);
  } };
}
