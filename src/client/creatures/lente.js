// LENTE — a distancia. Una criatura-ojo: un globo ocular enorme (iris con fibras, pupila, córnea húmeda, párpados de verdad) en una
// cuenca de carne con pestañas, sobre una COLUMNA carnosa continua con vértebras de hueso visibles, tendones y espolones dorsales;
// base muscular con 3 patas con garra. Corona de 6 pétalos de biocristal que, al apuntar, convergen en cañón sobre un lente de cristal.
// AVISO DE DISPARO (st.s === 'aim', 0.6 s): la columna se arquea hacia atrás, los párpados se abren del todo, la pupila se contrae,
// los pétalos convergen, el lente se enfoca y arde; al soltar el proyectil, retroceso.
import { THREE, TAU, disposer, gazeDir, lod, clamp, lerp, smooth, rng, bio, crystalMat, lidMaterial, ellipsoid, tube, spike, plate, crystal, paint, orient, path, place, bendAttr, Rig, skinRigid, skinChain, eye, buildLeg, footTo, boneQuat, gait, glowSprite, shieldAura, tickAura, Spring, dampTo, tint } from './geoda-bio.js';

export default function build(kit, color) {
  const L = lod(), low = L.low, hi = L.hi, V3 = THREE.Vector3, R = rng(21);
  const col = new THREE.Color(color);
  const flesh = bio({ rough: 0.45, clear: 0.5, clearRough: 0.25, sheen: 0.25, env: 0.7, tex: 'flesh', tile: 1.5, bump: 0.9, grain: 0.5, seam: 0x2a0c0c, seamK: 0.5, vein: 0x9a1828, veinK: 0.3, veinGlow: 0.15, sss: 0.2, sssColor: 0xff7040 });
  const bone = bio({ rough: 0.5, clear: 0.3, clearRough: 0.35, env: 0.55, tex: 'fine', tile: 1.8, bump: 0.5, grain: 0.5, seam: 0x30200c, seamK: 0.25, rv: 0.7 });
  const lashM = bio({ rough: 0.6, tex: 'fine', bend: true, bump: 0, grain: 0, vcol: true }); lashM.userData.u.uAmp.value = 0.05; lashM.userData.u.uSpd.value = 2.2;
  const cry = crystalMat(color, { glow: 0.9, alpha: 0.9 });
  const lensM = crystalMat(color, { glow: 0.5, alpha: 0.32, clear: 1 }); lensM.depthWrite = false;
  const mats = [flesh, bone, lashM, cry, lensM];

  tint({ from: 0.02, to: 0.118, range: 0.08, sat: 1.35, light: 1.25 });
  const rig = new Rig();
  const root = rig.bone(null, [0, 0, 0], 'root'), body = rig.bone(root, [0, 0.5, 0], 'body');
  const SJ = [[0, 0.55, 0], [0, 0.9, -0.14], [0, 1.3, -0.1], [0, 1.7, 0.05], [0, 2.0, 0.22]], stalk = [];
  SJ.forEach((p, i) => stalk.push(rig.bone(i ? stalk[i - 1] : body, p, 's' + i)));
  const head = rig.bone(stalk[4], [0, 2.15, 0.34], 'head');
  const EC = new V3(0, 2.28, 0.58), ER = 0.52;
  // ── bulbo muscular + collar de placas ──
  const bulb = ellipsoid([0.55, 0.4, 0.55], { w: low ? 12 : 20, h: low ? 8 : 14, noise: 0.14, freq: 2, seed: 4, pos: [0, 0.48, 0] });
  paint(bulb, (p, n) => new THREE.Color(0x401a1a).lerp(new THREE.Color(0x84483c), smooth(-0.2, 0.9, n.y))); rig.add(flesh, skinRigid(bulb, body));
  for (let i = 0; i < (low ? 4 : 6); i++) { const a = (i / (low ? 4 : 6)) * TAU + 0.3, n = new V3(Math.cos(a), 0.6, Math.sin(a)).normalize(); const g = plate({ w: 0.15, l: 0.2, h: 0.07, nr: 2, ns: 7, wrap: 1.5, keel: 0.6, quat: orient(n, new V3(-Math.cos(a), 0.2, -Math.sin(a))), pos: [Math.cos(a) * 0.4, 0.68, Math.sin(a) * 0.4], col: 0x3a2a24, col2: 0x9a8260 }); rig.add(bone, skinRigid(g, body)); }
  // ── columna: tubo carnoso continuo con anillos musculares + vértebras de hueso visibles, tendones y espolones ──
  const SP = [[0, 0.5, 0], ...SJ.map((p) => p), [0, 2.15, 0.34]], sp = path(SP), RAD = [0.28, 0.23, 0.19, 0.16, 0.14, 0.14, 0.16];
  const rf = (t) => { const f = t * (RAD.length - 1), i = Math.min(RAD.length - 2, Math.floor(f)); return lerp(RAD[i], RAD[i + 1], smooth(0, 1, f - i)); };
  const stGeo = tube(SP, { rad: rf, seg: low ? 18 : 30, sides: low ? 7 : 11, bulge: (t, a) => (1 + 0.05 * Math.sin(t * TAU * 7)) * (1 + 0.05 * Math.cos(a * 3)), caps: false });
  paint(stGeo, (p, n) => new THREE.Color(0x4e1e1c).lerp(new THREE.Color(0x9a5444), smooth(0.0, 0.9, n.z * 0.5 + 0.5) * 0.7));
  rig.add(flesh, skinChain(stGeo, [body, ...stalk, head].slice(1, 6), 0.16));
  const nV = low ? 3 : 5;
  for (let i = 0; i < nV; i++) {
    const t = 0.16 + (i / (nV - 1)) * 0.66, P = sp.at(t), T = sp.tan(t), r = rf(t), tilt = new V3(0.05 * Math.sin(i * 2), 0, 0.05 * Math.cos(i * 3)), d = T.clone().add(tilt).normalize();
    const disc = ellipsoid([r * 1.36, 0.12, r * 1.3], { w: low ? 9 : 14, h: 5, noise: 0.1, seed: i, pos: P.toArray(), dir: d.toArray() }); paint(disc, (p, n) => new THREE.Color(0x7a6a52).lerp(new THREE.Color(0xe0d2b0), smooth(-0.3, 0.8, n.y)));
    for (const sd of [-1, 1]) { const tp = spike(0.03, 0.14, { sides: 4, seg: 2, bend: 0.2, bendDir: [0, -1, 0], pos: [P.x + sd * r * 1.25, P.y, P.z], dir: [sd, 0.1, 0.1] }); paint(tp, 0xd8caa8); rig.add(bone, skinRigid(tp, t < 0.25 ? stalk[0] : t < 0.45 ? stalk[1] : t < 0.62 ? stalk[2] : t < 0.8 ? stalk[3] : stalk[4])); }
    const nearest = t < 0.25 ? stalk[0] : t < 0.45 ? stalk[1] : t < 0.62 ? stalk[2] : t < 0.8 ? stalk[3] : stalk[4]; rig.add(bone, skinRigid(disc, nearest));
    const spur = spike(0.04, 0.16 + 0.04 * Math.sin(i * 1.9), { sides: 4, seg: 2, bend: 0.5, bendDir: [0, 0, -1], pos: [P.x, P.y, P.z - r * 0.92], dir: [0, 0.5, -1] }); paint(spur, (p) => new THREE.Color(0x6a5a44).lerp(new THREE.Color(0xe8dcc0), smooth(0, 0.14, p.distanceTo(P) - r * 0.85))); rig.add(bone, skinRigid(spur, nearest));
  }
  for (const s of [-1, 1]) {   // tendones tensos a los lados
    const pts = SP.map((p, i) => [p[0] + s * rf(i / (SP.length - 1)) * 0.86, p[1], p[2] + 0.04]);
    const g = tube(pts, { rad: (t) => 0.034 * (1 - t * 0.3), seg: low ? 12 : 22, sides: 4, caps: false }); paint(g, 0x9a5a50); rig.add(flesh, skinChain(g, stalk, 0.16));
  }
  // ── cuenca, ceja, pestañas ──
  const socket = ellipsoid([0.6, 0.54, 0.48], { w: low ? 12 : 18, h: low ? 8 : 12, noise: 0.1, freq: 2.4, seed: 6, pos: [0, EC.y - 0.02, EC.z - 0.2] }); paint(socket, (p, n) => new THREE.Color(0x401c1c).lerp(new THREE.Color(0x84483c), smooth(0, 1, n.y * 0.5 + 0.5))); rig.add(flesh, skinRigid(socket, head));
  const brow = plate({ w: 0.46, l: 0.2, h: 0.1, nr: 3, ns: 10, keel: 0.5, wrap: 1.4, curve: -0.9, quat: orient(new V3(0, 1, 0.5), new V3(0, -0.3, 1)), pos: [0, EC.y + 0.5, EC.z + 0.05], col: 0x3a2a24, col2: 0xa89068 }); rig.add(bone, skinRigid(brow, head));
  for (const s of [-1, 1]) rig.add(bone, skinRigid(spike(0.06, 0.28, { sides: 5, seg: 3, bend: 0.4, bendDir: [s, 0.3, 0], pos: [s * 0.5, EC.y + 0.36, EC.z - 0.05], dir: [s * 0.8, 0.8, 0.1] }), head));
  for (let i = 0; i < (low ? 3 : 5); i++) { const a = Math.PI * (0.15 + i * 0.175), n = new V3(Math.cos(a) * 0.9, Math.sin(a), -0.55).normalize(), pp = new V3(Math.cos(a) * 0.6, EC.y - 0.02 + Math.sin(a) * 0.6, EC.z - 0.34); rig.add(bone, skinRigid(plate({ w: 0.24, l: 0.3, h: 0.1, nr: 2, ns: 8, wrap: 1.2, keel: 0.6, quat: orient(n, new V3(-Math.cos(a), 0.4, 0.2)), pos: pp.toArray(), col: 0x3a2a24, col2: 0xb09a74 }), head)); rig.add(bone, skinRigid(spike(0.04, 0.2 - Math.abs(i - 2) * 0.03, { sides: 4, seg: 2, bend: 0.4, bendDir: [0, 0, -1], pos: [pp.x * 1.05, pp.y + 0.05, pp.z - 0.08], dir: [n.x, n.y, n.z - 0.3] }), head)); }
  const nL = low ? 0 : 16;
  for (let i = 0; i < nL; i++) {
    const a = -0.2 + (i / (nL - 1)) * (Math.PI + 0.4), base = new V3(Math.cos(a) * 0.56, EC.y + Math.sin(a) * 0.56, EC.z + 0.12), out = new V3(Math.cos(a), Math.sin(a), 0.35).normalize(), len = 0.14 + 0.08 * R();
    const g = tube([base, base.clone().addScaledVector(out, len * 0.5), base.clone().addScaledVector(out, len).add(new V3(0, 0.02, 0.05)), base.clone().addScaledVector(out, len * 1.5).add(new V3(0, -0.04 * (a > 1.5 ? 1 : 0), 0.14))], { rad: [0.014, 0.002], seg: 3, sides: 3, caps: false }); paint(g, 0x2a1210); bendAttr(g, (p) => clamp(p.distanceTo(base) / (len * 1.5), 0, 1), i * 0.7); rig.add(lashM, skinRigid(g, head));
  }
  // ── ojo gigante ──
  const ey = eye({ r: ER, iris: 0xffb020, iris2: 0x5a2800, sclera: 0xe6d6c4, vein: 0xa02a1a, pupil: 'round', irisR: 0.66, glow: 0.65, lidMat: lidMaterial({ color: 0x70382e, vein: 0x401410, sssColor: 0xff7040, sss: 0.4, tile: 1.2 }), slant: 0.08, maxYaw: 0.75, maxPitch: 0.55 });
  rig.attach(head, ey.object, EC.toArray()); mats.push(ey.mat, ey.lid.material);
  const lensGeo = new THREE.SphereGeometry(1.05, low ? 10 : 18, low ? 4 : 7, 0, TAU, 0, 0.78).rotateX(Math.PI / 2), lens = new THREE.Mesh(lensGeo, lensM); ey.ball.add(lens);
  // pétalos de la corona
  const nP = 6, petals = [];
  for (let i = 0; i < nP; i++) {
    const a = (i / nP) * TAU + 0.3, base = new V3(Math.cos(a) * 0.62, EC.y + Math.sin(a) * 0.62, EC.z - 0.08), pb = rig.bone(head, base, 'petal'), th = 0.7, dir = new V3(Math.cos(a) * Math.sin(th), Math.sin(a) * Math.sin(th), Math.cos(th));
    const g = crystal(0.055 + (i % 2) * 0.012, 0.38 + (i % 3) * 0.07, { sides: 5, taper: 0.7, tip: 0.4, lean: 0.1, seed: 60 + i, pos: base.toArray(), dir: dir.toArray(), c0: 0x7a5000, c1: 0xfff0b0 }); rig.add(cry, skinRigid(g, pb));
    petals.push({ pb, ax: new V3(-Math.sin(a), Math.cos(a), 0), i });
  }
  // ── patas gruesas con garra e IK ──
  const legs = [];
  for (let i = 0; i < 3; i++) {
    const a = 0.6 + (i / 3) * TAU, c = Math.cos(a), s = Math.sin(a);
    const H = new V3(c * 0.36, 0.5, s * 0.36), K = new V3(c * 0.78, 0.74, s * 0.78), F = new V3(c * 1.02, 0.03, s * 1.02);
    const Lg = buildLeg(rig, flesh, body, H, K, F, { r0: 0.11, rk: 0.085, r1: 0.014, knuckle: 0.03, seg: low ? 8 : 14, sides: low ? 5 : 8, claw: 0.2, clawCol: 0xe8dcc0, spines: low ? 0 : 2, spineCol: 0xc8b898, side: 1, name: 'l' + i, paintFn: (p) => new THREE.Color(0x4a1c1a).lerp(new THREE.Color(0x9a6a50), smooth(0.5, 0.05, p.y)).lerp(new THREE.Color(0xe0d0b0), smooth(0.06, 0.02, p.y) * 0.8) });
    legs.push({ Lg, a, base: new V3(c * 1.02, 0, s * 1.02), c, s });
  }
  // raíces colgantes que reptan
  const roots = [];
  if (!low) for (let i = 0; i < 2; i++) { const a = 1.8 + i * 3.1, c = Math.cos(a), s = Math.sin(a), J = [[c * 0.3, 0.3, s * 0.3], [c * 0.55, 0.12, s * 0.55], [c * 0.8, 0.05, s * 0.8], [c * 1.0, 0.03, s * 1.0]], bs = []; J.forEach((p, ix) => bs.push(rig.bone(ix ? bs[ix - 1] : body, p, 'rt')));
    const g = tube(J, { rad: (t) => 0.07 * (1 - t) + 0.01, seg: 10, sides: 5 }); paint(g, 0x6a302c); rig.add(flesh, skinChain(g, bs, 0.1)); roots.push({ bs, ph: i * 2 }); }
  tint(null);
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); rootObj.position.y = -0.9; /* el centro de la criatura (sim) está a 0.9 r del suelo: los pies del modelo (y=0) deben tocar el piso */ const K = 0.92; rootObj.scale.setScalar(K);
  const glow = glowSprite(color, 2, 0); glow.position.set(0, EC.y, EC.z + 0.8); rootObj.add(glow);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.6); aura.position.y = 1.2; rootObj.add(aura);
  mats.push(disposer(rig, [glow.material, aura.geometry, aura.material, lensGeo]));
  const spYaw = new Spring(0, 70, 8), spPit = new Spring(0, 70, 8), spKick = new Spring(0, 120, 7), spS = stalk.map((_, i) => new Spring(0, 38 + i * 4, 4.5 + i * 0.3)), spPet = petals.map(() => new Spring(0, 90, 7));
  let prevHp = 1, flinch = 0, phase = 0, aimTime = 0, wasAim = false, kick = 0, tw = 0; const tmp = new V3(0, 0, 1), look = new V3(0, 0, 1), q1 = new THREE.Quaternion(), lh = new V3(), qq = new THREE.Quaternion(), cache = new Map(), bend = new V3();

  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05);
    const aim = st.s === 'aim', speed = Math.min(1.5, ctx.speed || 0), hurt = st.hp != null && st.hp < 0.35, stun = !!st.st;
    if (ctx.look) look.copy(ctx.look); if (aim) aimTime += dt; else aimTime = 0;
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4.5);

    const p = aim ? Math.min(1, aimTime / 0.6) : 0, pe = p * p * (3 - 2 * p);
    if (wasAim && !aim) kick = 1; wasAim = aim; kick = Math.max(0, kick - dt * 3);
    const lx = Math.atan2(look.x, Math.max(0.15, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    // columna: vaivén + arqueo hacia atrás al apuntar + retroceso al disparar + temblor si está herida
    const sway = Math.sin(t * 1.3 + st.id) - flinch * 2.2, jit = hurt ? Math.sin(t * 19 + st.id) * 0.06 : 0, arch = -pe * 0.5 + spKick.step(dt, kick * -0.5);
    stalk.forEach((b, i) => { const tg = sway * 0.06 * (i + 1) / 5 + arch * (i === 0 ? 0.25 : 1) * 0.36 + jit * (i / 5) + (stun ? Math.sin(t * 8 + i) * 0.14 : 0) + (hurt ? 0.1 * (i + 1) / 5 : 0); b.rotation.x = spS[i].step(dt, tg); b.rotation.z = Math.sin(t * 0.9 + i * 0.7 + st.id) * 0.05 * (1 + speed) + (hurt ? 0.04 * Math.sin(t * 11 + i) : 0); });
    let chain = 0; stalk.forEach((b) => { chain += b.rotation.x; });
    head.rotation.y = spYaw.step(dt, clamp(lx, -1.0, 1.0)) * 0.7; head.rotation.x = spPit.step(dt, -clamp(ly, -0.5, 0.5) * 0.5 - chain * 0.8 + 0.04 + (hurt ? 0.18 : 0));
    body.scale.set(1 + 0.025 * Math.sin(t * 2 + st.id), 1 - 0.035 * Math.sin(t * 2 + st.id), 1 + 0.025 * Math.sin(t * 2 + st.id));
    phase += dt * (3 + speed * 9);
    // patas (IK): 3 patas con fases a 120°; cojea si herida
    cache.clear();
    legs.forEach((Lg, i) => { const ph = phase + i * (TAU / 3), [adv, lift] = gait(ph, 0.4), stride = 0.32 * Math.min(1, 0.2 + speed), lh2 = 0.32 * Math.min(1, 0.3 + speed) * (stun ? 0 : 1);
      tmp.set(Lg.base.x + Lg.c * adv * stride * 0.4, Lg.base.y + lift * lh2 + (hurt && i === 1 ? 0.12 + Math.sin(t * 14) * 0.04 : 0), Lg.base.z + Lg.s * adv * stride * 0.4);
      if (speed < 0.05 && ((Math.sin(t * 0.8 + i * 2.1) > 0.97))) tmp.y += 0.12;
      bend.set(Lg.c * 0.6, 2, Lg.s * 0.6); footTo(Lg.Lg, root, tmp, bend, cache); });
    tmp.set(0, 0, 1);
    roots.forEach((R2, k) => R2.bs.forEach((b, i) => { b.rotation.y = Math.sin(t * (1.1 + k * 0.3) + R2.ph + i * 0.8) * 0.3; b.rotation.x = Math.cos(t * 0.9 + R2.ph + i) * 0.1; }));
    body.position.y = body.userData.rest.y + Math.abs(Math.sin(phase * 0.5)) * 0.04 * speed + Math.sin(t * 2.0 + st.id) * 0.012 - (hurt ? 0.05 : 0); body.rotation.z = Math.sin(phase * 0.5) * 0.04 * speed;
    // ojo: gira para mirar al jugador; párpados (apertura total al apuntar, caído si herida/aturdida); pupila; lente
    head.updateMatrix(); boneQuat(head, root, q1); gazeDir(look, (ctx.dist || 8) / K, EC, lh); lh.applyQuaternion(q1.clone().invert());
    const openT = flinch > 0.3 ? 0.35 : stun ? 0.45 : hurt ? 0.65 + 0.2 * Math.sin(t * 5) ** 2 : 0.94 + 0.06 * pe;
    ey.update(dt, lh, { open: openT, dilate: -0.55 * pe + 0.05 * Math.sin(t * 1.5) + (hurt ? 0.3 * Math.sin(t * 9) : 0), glowMul: 0.6 + 1.6 * pe, squint: pe * 0.5, quiver: hurt || stun ? 1 : 0 });
    lens.scale.set(1, 1, 1 + 0.9 * pe + 0.15 * kick); lensM.emissiveIntensity = 0.15 + 2.4 * pe + 0.1 * Math.sin(t * 6); lensM.opacity = 0.2 + 0.25 * pe;
    // pétalos: abiertos en reposo, convergen en cañón al apuntar, se abren de golpe al disparar
    petals.forEach((P, i) => { const tg = -0.58 * pe + (kick > 0.05 ? 0.35 * kick : 0) + 0.05 * Math.sin(t * 2.2 + P.i) + (hurt ? 0.08 * Math.sin(t * 15 + P.i) : 0); qq.setFromAxisAngle(P.ax, spPet[i].step(dt, tg)); P.pb.quaternion.copy(qq); });
    cry.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 3) + 3.2 * pe; glow.material.opacity = pe * (0.75 + 0.2 * Math.sin(t * 30 * (0.5 + pe))) + 0.5 * kick; glow.scale.setScalar(1.6 + 3.4 * pe + 1.5 * kick);
    flesh.userData.u.uVeinGlow.value = 0.5 + 1.8 * pe; flesh.userData.u.uSss.value = 0.3 + 0.7 * pe;
    rootObj.rotation.z = stun ? Math.sin(t * 21) * 0.05 : 0; tickAura(aura, st, t);
  } };
}
