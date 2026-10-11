// CUARZO — invocador. Una madre-pólipo con forma de amanita: volva con patas, tallo costillado con anillo-falda, sombrero de carne
// con lunares y verrugas de biocristal, corona de espiras que se abre como una flor, y SACOS DE HUEVOS translúcidos colgando del
// borde con larvas luminosas dentro. Cara en el tallo: dos ojos (pupila horizontal), cejas óseas, labios con dientes irregulares y lengua.
// INVOCACIÓN (st.s === 'cast', ~1 s): el sombrero se alza y el tallo se arquea, la corona florece, la boca se abre, los sacos se
// hinchan y arden, las larvas se agitan; al terminar los sacos se desinflan de golpe (suelta 2 astillas).
import { THREE, TAU, gazeDir, lod, clamp, lerp, smooth, rng, bio, crystalMat, lidMaterial, ellipsoid, tube, spike, plate, crystal, crystalCluster, paint, orient, path, place, bendAttr, Rig, skinRigid, skinChain, eye, buildLeg, footTo, boneQuat, gait, glowSprite, shieldAura, tickAura, Spring, dampTo } from './geoda-bio.js';

export default function build(kit, color) {
  const L = lod(), low = L.low, hi = L.hi, V3 = THREE.Vector3, R = rng(41);
  const col = new THREE.Color(color);
  const flesh = bio({ rough: 0.45, clear: 0.5, clearRough: 0.22, sheen: 0.25, env: 0.7, tex: 'flesh', tile: 1.4, bump: 0.9, grain: 0.5, seam: 0x3a0c08, seamK: 0.5, vein: color, veinK: 0.35, veinGlow: 0.5, sss: 0.15, sssColor: 0xff7a45 });
  const skirtM = bio({ rough: 0.5, clear: 0.3, env: 0.6, tex: 'flesh', tile: 1.2, bump: 0.6, grain: 0.4, vein: color, veinK: 0.5, veinGlow: 0.6, sss: 0.6, sssColor: 0xff9a60, side: THREE.DoubleSide });
  const bone = bio({ rough: 0.5, clear: 0.3, env: 0.55, tex: 'fine', tile: 1.8, bump: 0.5, grain: 0.5 });
  const sacM = bio({ rough: 0.12, clear: 1, clearRough: 0.05, env: 0.9, tex: 'flesh', tile: 1.6, bump: 0.5, grain: 0.3, vein: 0xd03060, veinK: 0.7, veinGlow: 0.5, sss: 1.2, sssColor: 0xff8a60, alpha: 0.5, vcol: true });
  const larvaM = bio({ rough: 0.35, clear: 0.4, tex: 'flesh', tile: 3, bump: 0.5, grain: 0.3, vein: color, veinK: 0.6, veinGlow: 1.2, glow: 0.8, glowColor: color, sss: 0.8, sssColor: 0xffa060 });
  const lashM = bio({ rough: 0.6, tex: 'fine', bend: true, bump: 0, grain: 0, vcol: true }); lashM.userData.u.uAmp.value = 0.12; lashM.userData.u.uSpd.value = 1.8;
  const cry = crystalMat(color, { glow: 1.0, alpha: 0.9 });
  const mats = [flesh, skirtM, bone, sacM, larvaM, lashM, cry];

  const rig = new Rig();
  const root = rig.bone(null, [0, 0, 0], 'root'), body = rig.bone(root, [0, 0.5, 0], 'body');
  const SJ = [[0, 0.55, 0], [0, 0.95, 0.02], [0, 1.35, 0]], st = []; SJ.forEach((p, i) => st.push(rig.bone(i ? st[i - 1] : body, p, 'st')));
  const cap = rig.bone(st[2], [0, 1.7, -0.02], 'cap'), ann = rig.bone(st[1], [0, 1.0, 0], 'ann'), jaw = rig.bone(st[2], [0, 1.2, 0.3], 'jaw'), tongue = rig.bone(jaw, [0, 1.18, 0.34], 'tg'), tongue2 = rig.bone(tongue, [0, 1.15, 0.5], 'tg2');
  // ── volva y tallo costillado ──
  const volva = ellipsoid([0.62, 0.38, 0.62], { w: low ? 12 : 20, h: low ? 8 : 12, noise: 0.14, freq: 2, seed: 3, pos: [0, 0.48, 0] }); paint(volva, (p, n) => new THREE.Color(0x40160e).lerp(new THREE.Color(0xa05840), smooth(-0.2, 0.9, n.y))); rig.add(flesh, skinRigid(volva, body));
  const SP = [[0, 0.5, 0], [0, 0.55, 0], [0, 0.95, 0.02], [0, 1.35, 0], [0, 1.7, -0.02]], sp = path(SP), RAD = [0.5, 0.46, 0.35, 0.3, 0.34];
  const rf = (t) => { const f = t * (RAD.length - 1), i = Math.min(RAD.length - 2, Math.floor(f)); return lerp(RAD[i], RAD[i + 1], smooth(0, 1, f - i)); };
  const stG = tube(SP, { rad: rf, seg: low ? 16 : 28, sides: low ? 8 : 14, bulge: (t, a) => (1 + 0.07 * Math.cos(a * 7)) * (1 + 0.08 * Math.exp(-Math.pow((t - 0.62) / 0.025, 2))), caps: false });
  paint(stG, (p, n) => new THREE.Color(0x8a3428).lerp(new THREE.Color(0xc06a54), smooth(0.9, 1.7, p.y)).lerp(new THREE.Color(0x42180f), smooth(0.9, 0.5, p.y))); rig.add(flesh, skinChain(stG, [body, ...st], 0.2));
  // anillo-falda (membrana festoneada que cuelga)
  { const nA = low ? 14 : 28, nK = 3, P = [], I = [], C = []; for (let k = 0; k <= nK; k++) for (let j = 0; j < nA; j++) { const a = (j / nA) * TAU, kk = k / nK, rr = 0.34 + kk * 0.34 + 0.05 * Math.sin(a * 7) * kk, y = 1.02 - kk * 0.3 - 0.06 * Math.abs(Math.sin(a * 3.5)) * kk * kk; P.push(Math.cos(a) * rr, y, Math.sin(a) * rr); const c = new THREE.Color(0xc89070).lerp(new THREE.Color(0x984a3c), kk); C.push(c.r, c.g, c.b); }
    for (let k = 0; k < nK; k++) for (let j = 0; j < nA; j++) { const a = k * nA + j, b = k * nA + (j + 1) % nA, c = (k + 1) * nA + j, d = (k + 1) * nA + (j + 1) % nA; I.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); rig.add(skirtM, skinRigid(g, ann)); }
  // ── sombrero: domo con lunares, borde ondulado y verrugas de biocristal ──
  const SPOTS = []; for (let i = 0; i < 16; i++) { const a = R() * TAU, r = Math.sqrt(R()) * 0.85; SPOTS.push([Math.cos(a) * r, Math.sin(a) * r, 0.08 + R() * 0.1]); }
  const capG = ellipsoid([1.02, 0.6, 1.02], { w: low ? 14 : 24, h: low ? 6 : 10, noise: 0.07, freq: 2.2, seed: 5, theta: [0, Math.PI * 0.5], pos: [0, 1.7, 0] });
  paint(capG, (p, n) => { const base = new THREE.Color(0xd8501e).lerp(new THREE.Color(0x8a2412), smooth(0.4, 1.0, Math.hypot(p.x, p.z))).lerp(new THREE.Color(0x3a1a18), smooth(1.7, 1.35, p.y) * 0.9); if (p.y > 1.7) for (const [sx, sz, sr] of SPOTS) { const d = Math.hypot(p.x - sx, p.z - sz); if (d < sr) base.lerp(new THREE.Color(0xf0dcc0), smooth(sr, sr * 0.6, d)); } return base; });
  rig.add(flesh, skinRigid(capG, cap));
  { const gl = ellipsoid([1.0, 0.18, 1.0], { w: low ? 14 : 24, h: low ? 4 : 6, noise: 0.05, seed: 6, theta: [Math.PI * 0.5, Math.PI], pos: [0, 1.7, 0] }); paint(gl, (p, n) => new THREE.Color(0x40100c).lerp(new THREE.Color(0xc07060), smooth(0.2, 1.0, Math.hypot(p.x, p.z)) * 0.7)); rig.add(flesh, skinRigid(gl, cap)); }
  const warts = []; for (let i = 0; i < (low ? 4 : 9); i++) { const a = i * 2.4 + 0.3, r = 0.25 + 0.6 * ((i * 0.37) % 1), y = 1.7 + 0.6 * Math.sqrt(Math.max(0, 1 - (r / 1.02) ** 2)); crystalCluster(low ? 1 : 2, 0.04, 0.2 + 0.1 * ((i * 0.53) % 1), { pos: [Math.cos(a) * r, y - 0.02, Math.sin(a) * r], dir: [Math.cos(a) * r * 0.5, 1, Math.sin(a) * r * 0.5], seed: 100 + i, c0: 0x6a2008, c1: 0xffe0b0 }).forEach((c) => rig.add(cry, skinRigid(c, cap))); }
  // ── corona de espiras que florece (5 huesos) ──
  const crown = [];
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, base = new V3(Math.cos(a) * 0.14, 2.24, Math.sin(a) * 0.14), cb = rig.bone(cap, base, 'cr'), th = 0.18, dir = new V3(Math.cos(a) * Math.sin(th), Math.cos(th), Math.sin(a) * Math.sin(th));
    rig.add(cry, skinRigid(crystal(0.07, 0.62 + (i % 2) * 0.18, { sides: 6, taper: 0.65, tip: 0.38, lean: 0.12, seed: 120 + i, pos: base.toArray(), dir: dir.toArray(), c0: 0x6a2008, c1: 0xfff0d0 }), cb)); crown.push({ cb, a, ax: new V3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(-1) }); }
  // ── cara: cejas óseas, ojos de pupila horizontal, labios, dientes irregulares y lengua ──
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = eye({ r: 0.17, iris: 0xff8a20, iris2: 0x601000, sclera: 0xd8c0a8, vein: 0xa02818, pupil: 'hslit', irisR: 0.85, glow: 0.7, lidMat: lidMaterial({ color: 0x9a4a38, vein: 0x601810, sssColor: 0xff7a45, sss: 0.35, tile: 2 }), slant: 0.3, maxYaw: 0.55, maxPitch: 0.4, follow: 0.9 });
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.08, s * 0.55, 0)); e.object.quaternion.copy(q); e.mount = q; rig.attach(st[2], e.object, [s * 0.19, 1.5, 0.22]); eyes.push(e); mats.push(e.mat, e.lid.material);
    rig.add(bone, skinRigid(plate({ w: 0.14, l: 0.1, h: 0.05, nr: 2, ns: 7, wrap: 1.5, keel: 0.5, quat: orient(new V3(s * 0.5, 1, 0.5), new V3(s * 0.2, -0.1, 1)), pos: [s * 0.17, 1.66, 0.26], col: 0x4a2418, col2: 0xc8a070 }), st[2]));
  }
  // boca: anillo de carne con dientes irregulares alrededor de una cavidad vertical (se dilata al invocar) + lengua
  { const MC = new V3(0, 1.24, 0.3), rx = 0.1, ry = 0.15, ring = (sd) => { const pts = []; for (let i = 0; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI; pts.push([MC.x + sd * Math.cos(a) * rx, MC.y + Math.sin(a) * ry * -1, MC.z + 0.03 - Math.cos(a) * 0.015]); } return pts; };
    for (const sd of [-1, 1]) { const g = tube(ring(sd), { rad: (t) => 0.034 * (0.75 + 0.5 * Math.sin(t * Math.PI)), seg: low ? 6 : 12, sides: low ? 5 : 7, caps: true }); paint(g, (p) => new THREE.Color(0x8a2a2a).lerp(new THREE.Color(0xd06a5a), 0.4 + 0.3 * Math.sin(p.y * 40))); rig.add(flesh, skinRigid(g, jaw)); }
    const cav = ellipsoid([0.085, 0.13, 0.05], { w: 8, h: 6, seed: 2, pos: [MC.x, MC.y, MC.z + 0.0] }); paint(cav, 0x2a0408); rig.add(flesh, skinRigid(cav, jaw));
    const nT = low ? 5 : 10; for (let i = 0; i < nT; i++) { const a = (i / nT) * TAU + 0.2, px = MC.x + Math.cos(a) * rx * 0.95, py = MC.y + Math.sin(a) * ry * 0.95, g = spike(0.011 + R() * 0.007, 0.05 + R() * 0.06, { sides: 3, seg: 1, pos: [px, py, MC.z + 0.04], dir: [-Math.cos(a) * 0.8, -Math.sin(a) * 0.8, 0.5 + R() * 0.3] }); paint(g, (q) => new THREE.Color(0x8a7a60).lerp(new THREE.Color(0xf4ecd6), smooth(0, 0.08, q.distanceTo(new V3(px, py, MC.z + 0.04))))); rig.add(bone, skinRigid(g, jaw)); } }
  const tg = tube([[0, 1.22, 0.3], [0, 1.2, 0.4], [0, 1.17, 0.5]], { rad: [0.035, 0.01], seg: 4, sides: 5 }); paint(tg, 0xd8607a); rig.add(flesh, skinChain(tg, [tongue, tongue2], 0.05));
  // ── sacos de huevos con larvas (hueso del saco + hueso de la larva) ──
  const nS = low ? 3 : 5, sacs = [], SA = low ? [0.0, 2.7, 4.5] : [-0.25, 0.6, 2.55, 3.5, 4.5];
  for (let i = 0; i < nS; i++) {
    const a = SA[i], c = new V3(Math.cos(a) * 0.9, 1.5, Math.sin(a) * 0.9), sb = rig.bone(cap, c, 'sac'), lb = rig.bone(sb, c.clone().add(new V3(0, 0.0, 0)), 'lv');
    const sg = ellipsoid([0.22, 0.28, 0.22], { w: low ? 10 : 16, h: low ? 7 : 12, noise: 0.05, seed: i, pos: c.toArray() }); paint(sg, (p, n) => new THREE.Color(0xffb890).lerp(new THREE.Color(0xe86a70), smooth(0.2, -1, n.y) * 0.6)); rig.add(sacM, skinRigid(sg, sb));
    const lg = tube([[c.x - 0.07, c.y + 0.06, c.z], [c.x, c.y + 0.09, c.z + 0.03], [c.x + 0.07, c.y + 0.02, c.z], [c.x + 0.03, c.y - 0.08, c.z - 0.03]], { rad: (t) => 0.05 * Math.sin(Math.PI * (0.15 + 0.7 * t)) + 0.01, seg: 8, sides: 6 }); paint(lg, (p) => new THREE.Color(0xff8a50).lerp(new THREE.Color(0xffe0a0), 0.4)); rig.add(larvaM, skinRigid(lg, lb));
    const cord = tube([[Math.cos(a) * 0.78, 1.72, Math.sin(a) * 0.78], [Math.cos(a) * 0.86, 1.64, Math.sin(a) * 0.86], [c.x, c.y + 0.26, c.z]], { rad: [0.05, 0.035], seg: 4, sides: 5 }); paint(cord, 0xc0705a); rig.add(flesh, skinRigid(cord, cap));
    sacs.push({ sb, lb, a, ph: i * 1.7, c });
  }
  // flecos: filamentos finos que cuelgan del borde del sombrero
  if (!low) for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU + R() * 0.1, rr = 0.98, base = new V3(Math.cos(a) * rr, 1.7 - 0.08, Math.sin(a) * rr), len = 0.2 + R() * 0.2; const g = tube([base, base.clone().add(new V3(Math.cos(a) * 0.04, -len * 0.5, Math.sin(a) * 0.04)), base.clone().add(new V3(Math.cos(a) * 0.06, -len, Math.sin(a) * 0.06))], { rad: [0.014, 0.003], seg: 3, sides: 3, caps: false }); paint(g, new THREE.Color(0xd88a60).lerp(new THREE.Color(0xfff0d0), R() * 0.4)); bendAttr(g, (p) => clamp((base.y - p.y) / len, 0, 1), R() * 6); rig.add(lashM, skinRigid(g, cap)); }
  // ── patas gruesas con garra (IK) ──
  const legs = [];
  for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.2, c = Math.cos(a), s = Math.sin(a), H = new V3(c * 0.38, 0.5, s * 0.38), K = new V3(c * 0.78, 0.7, s * 0.78), F = new V3(c * 1.0, 0.03, s * 1.0);
    const Lg = buildLeg(rig, flesh, body, H, K, F, { r0: 0.13, rk: 0.1, r1: 0.02, knuckle: 0.03, seg: low ? 8 : 12, sides: low ? 5 : 8, claw: 0.2, clawCol: 0xe8dcc0, spines: 0, side: 1, name: 'c' + i, paintFn: (p) => new THREE.Color(0x6a3028).lerp(new THREE.Color(0xc08868), smooth(0.5, 0.05, p.y)) }); legs.push({ Lg, c, s, base: new V3(c * 1.0, 0, s * 1.0) }); }
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group);
  const glow = glowSprite(color, 2.6, 0); glow.position.y = 1.7; rootObj.add(glow);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.7); aura.position.y = 1.2; rootObj.add(aura);
  const spArch = new Spring(0, 40, 6), spSac = new Spring(0, 110, 7), spYaw = new Spring(0, 60, 8), spCrown = new Spring(0, 70, 7), spJaw = new Spring(0, 80, 8);
  let castT = 0, wasCast = false, burst = 0, phase = 0; const tmp = new V3(), look = new V3(0, 0, 1), q1 = new THREE.Quaternion(), lh = new V3(), qq = new THREE.Quaternion(), cache = new Map(), bend = new V3();
  return { root: rootObj, mats, tick(dt, stt, t, ctx = {}) {
    dt = Math.min(dt, 0.05);
    const cast = stt.s === 'cast', speed = Math.min(1.5, ctx.speed || 0), hurt = stt.hp != null && stt.hp < 0.35, stun = !!stt.st;
    if (ctx.look) look.copy(ctx.look);
    castT = cast ? Math.min(1, castT + dt / 0.95) : Math.max(0, castT - dt * 3);
    if (wasCast && !cast) burst = 1; wasCast = cast; burst = Math.max(0, burst - dt * 2.2);
    const pe = castT * castT * (3 - 2 * castT), lx = Math.atan2(look.x, Math.max(0.15, look.z));
    // tallo: respira, se arquea hacia atrás al invocar, se inclina al caminar; temblor si herida
    const arch = spArch.step(dt, -pe * 0.34 + (hurt ? Math.sin(t * 13) * 0.03 + 0.18 : 0) + (stun ? Math.sin(t * 9) * 0.1 : 0));
    st.forEach((b, i) => { b.rotation.x = arch * (i === 0 ? 0.3 : 0.5) + 0.03 * Math.sin(t * 1.4 + st0(i)); b.rotation.y = i === 2 ? spYaw.step(dt, clamp(lx, -0.8, 0.8)) * 0.3 : 0; b.rotation.z = Math.sin(t * 0.8 + i) * 0.02; });
    const br = Math.sin(t * 1.9 + stt.id); body.scale.set(1 + 0.02 * br + 0.05 * pe, 1 - 0.025 * br, 1 + 0.02 * br + 0.05 * pe);
    const cr = spCrown.step(dt, pe); cap.rotation.x = -0.1 * cr + (hurt ? 0.1 : 0); cap.position.y = cap.userData.rest.y - st[2].userData.rest.y + 0.18 * cr; cap.scale.set(1 + 0.06 * cr, 1 + 0.3 * cr * 0.5 + 0.02 * br, 1 + 0.06 * cr);
    ann.rotation.x = Math.sin(t * 1.3) * 0.04 + 0.1 * pe; ann.scale.set(1 + 0.12 * pe, 1, 1 + 0.12 * pe);
    // corona: cerrada en reposo, florece al invocar
    crown.forEach((C, i) => { const open = 0.1 + 1.0 * Math.max(0, cr) + (hurt ? -0.1 : 0) + 0.05 * Math.sin(t * 2 + i); qq.setFromAxisAngle(C.ax, open * 0.7); C.cb.quaternion.copy(qq); C.cb.scale.setScalar(0.7 + 0.5 * pe); });
    // boca: se abre al invocar; lengua asoma
    const jo = spJaw.step(dt, pe * 0.9 + (stun ? 0.5 : 0) + 0.05 * Math.sin(t * 2.2) + (hurt ? 0.2 : 0)); jaw.scale.set(1 + jo * 0.45, 1 + jo * 0.3, 1 + jo * 0.3); tongue.rotation.x = -0.2 + jo * 0.4 + Math.sin(t * 6) * 0.08 * pe; tongue2.rotation.x = Math.sin(t * 7 + 1) * 0.2 * (0.3 + pe);
    // sacos: laten; al invocar se hinchan, arden y las larvas se agitan; al soltar se desinflan de golpe
    const infl = spSac.step(dt, pe);
    sacs.forEach((S, i) => { const beat = 0.5 + 0.5 * Math.sin(t * (hurt ? 8 : 2.4) + S.ph), k = (1 + 0.42 * infl + 0.06 * beat) * (1 - 0.3 * burst) * (hurt ? 0.85 : 1); S.sb.scale.set(k, k * 1.1, k); S.sb.position.y = S.sb.userData.rest.y - cap.userData.rest.y - 0.04 * infl + Math.sin(t * 1.3 + S.ph) * 0.015 - 0.0;
      const w = 1 + 7 * pe, wob = Math.sin(t * 3 * w + S.ph); S.lb.position.set(Math.sin(t * 1.1 * w + S.ph) * 0.07, Math.sin(t * 0.9 * w + S.ph * 2) * 0.06, Math.cos(t * 1.3 * w + S.ph) * 0.07); S.lb.rotation.set(wob * 0.7, t * w * 0.8 + S.ph, wob * 0.4); });
    sacM.userData.u.uVeinGlow.value = 0.5 + 1.2 * pe + 1.0 * burst; sacM.userData.u.uSss.value = 0.7 + 0.8 * pe; larvaM.userData.u.uGlow.value = 0.8 + 1.5 * pe + 1.0 * burst; sacM.opacity = 0.5 + 0.15 * pe;
    flesh.userData.u.uVeinGlow.value = 0.5 + 0.9 * pe + 0.7 * burst; flesh.userData.u.uSss.value = 0.15 + 0.5 * pe; skirtM.userData.u.uSss.value = 0.6 + 0.6 * pe;
    cry.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 3) + 0.9 * pe + 0.8 * burst;
    glow.material.opacity = (0.28 * pe + 0.45 * burst) * (0.8 + 0.2 * Math.sin(t * 25)); glow.scale.setScalar(2.2 + 1.2 * pe + 1.5 * burst);
    // ojos
    st[2].updateMatrix(); boneQuat(st[2], root, q1); q1.invert();
    eyes.forEach((e, k) => { gazeDir(look, ctx.dist, tmp.set(k ? 0.19 : -0.19, 1.5, 0.3), lh); lh.applyQuaternion(q1); lh.applyQuaternion(e.mount.clone().invert()); e.update(dt, lh, { open: stun ? 0.4 : hurt ? 0.7 : 0.92 + 0.08 * pe, dilate: -0.1 + 0.4 * pe, glowMul: 0.7 + 1.5 * pe, squint: 0, quiver: stun ? 1 : 0 }); });
    // marcha
    cache.clear(); phase += dt * (3.5 + speed * 7);
    legs.forEach((Lg, i) => { const ph = phase + i * (TAU / 3), [adv, lift] = gait(ph, 0.4), stride = 0.3 * Math.min(1, 0.2 + speed), lh2 = 0.3 * Math.min(1, 0.3 + speed);
      tmp.set(Lg.base.x + Lg.c * adv * stride * 0.4, Lg.base.y + lift * lh2 - (cast ? 0.0 : 0), Lg.base.z + Lg.s * adv * stride * 0.4); bend.set(Lg.c * 0.6, 2, Lg.s * 0.6); footTo(Lg.Lg, root, tmp, bend, cache); });
    body.position.y = body.userData.rest.y + Math.abs(Math.sin(phase * 0.5)) * 0.05 * speed + 0.06 * pe - (hurt ? 0.06 : 0); rootObj.rotation.z = stun ? Math.sin(t * 22) * 0.05 : 0;
    lashM.userData.u.uAmp.value = 0.1 + 0.15 * pe + 0.1 * speed; tickAura(aura, stt, t);
  } };
  function st0(i) { return i * 0.9 + 0.3; }
}
