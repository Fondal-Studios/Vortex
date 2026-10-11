// RACIMO — explosivo. Un racimo de vejigas de gas de membrana finísima con venas, cada una con su bolsa de gas encendida dentro,
// unidas por tallos carnosos a un núcleo; un ojo de verdad en un esfínter de carne, una mecha-filamento con la punta encendida y
// 4 patas finas con IK que corren sin parar. Cuanto más cerca está el jugador (ctx.dist) más se hincha, tiembla, se enrojece y
// parpadea más rápido: "a punto de estallar". (st.s === 'fuse' fuerza la urgencia máxima, para pruebas.)
import { THREE, TAU, disposer, gazeDir, lod, clamp, lerp, smooth, rng, bio, crystalMat, lidMaterial, ellipsoid, tube, spike, crystal, paint, bendAttr, Rig, skinRigid, skinChain, eye, buildLeg, footTo, boneQuat, gait, glowSprite, shieldAura, tickAura, Spring, dampTo } from './geoda-bio.js';

export default function build(kit, color) {
  const L = lod(), low = L.low, hi = L.hi, V3 = THREE.Vector3, R = rng(61);
  const col = new THREE.Color(color), HOT = new THREE.Color(0xff3a22), WHITE = new THREE.Color(0xfff2d8), MEM0 = col.clone().lerp(new THREE.Color(0xffb0c0), 0.1), C = new THREE.Color();
  const memM = bio({ color: MEM0, rough: 0.1, clear: 1, clearRough: 0.04, env: 0.9, tex: 'flesh', tile: 2.2, bump: 0.5, grain: 0.3, seam: 0x601028, seamK: 0.2, vein: 0xb01848, veinK: 0.9, veinGlow: 0.5, sss: 0.9, sssColor: 0xff5070, alpha: 0.46, vcol: true });
  const gasM = bio({ rough: 0.5, tex: 'flesh', tile: 2.5, bump: 0.3, grain: 0.7, vein: 0xff5020, veinK: 0.7, veinGlow: 1.2, glow: 1.0, glowColor: color, sss: 0.5, sssColor: 0xffa060, vcol: true });
  const skin = bio({ rough: 0.4, clear: 0.5, clearRough: 0.25, sheen: 0.2, env: 0.7, tex: 'flesh', tile: 2, bump: 0.8, grain: 0.5, seam: 0x2a0818, seamK: 0.5, vein: color, veinK: 0.3, veinGlow: 0.6, sss: 0.25, sssColor: 0xff3a5c });
  const claw = bio({ rough: 0.4, clear: 0.5, tex: 'fine', tile: 2, bump: 0.4, grain: 0.4 });
  const lashM = bio({ rough: 0.6, tex: 'fine', bend: true, bump: 0, grain: 0, vcol: true }); lashM.userData.u.uAmp.value = 0.05; lashM.userData.u.uSpd.value = 3;
  const cry = crystalMat(color, { glow: 1.0, alpha: 0.9 });
  const mats = [memM, gasM, skin, claw, lashM, cry];

  const rig = new Rig();
  const root = rig.bone(null, [0, 0, 0], 'root'), body = rig.bone(root, [0, 0.62, 0], 'body'), cl = rig.bone(body, [0, 0.8, 0], 'cl');
  // ── vejigas: posiciones tipo racimo (Fibonacci) alrededor del núcleo ──
  const nB = low ? 5 : 9, ga = Math.PI * (3 - Math.sqrt(5)), B = [{ c: new V3(0, 0.8, 0), r: 0.42, ph: 0 }];
  for (let i = 0; i < nB - 1; i++) { const y = 0.7 - ((i + 0.5) / (nB - 1)) * 1.4, rr = Math.sqrt(1 - y * y), th = i * ga + 0.6, r = 0.27 + (i % 3) * 0.05; let z = Math.sin(th) * rr * 0.55; if (z > 0.1) z = 0.1 - (z - 0.1) * 0.8; B.push({ c: new V3(Math.cos(th) * rr * 0.55, 0.8 + y * 0.55, z), r, ph: i * 0.9 + 1 }); }
  const bl = [];
  B.forEach((b, i) => {
    const bb = rig.bone(cl, b.c, 'bl'), g = ellipsoid([b.r, b.r * 1.05, b.r], { w: low ? 9 : 16, h: low ? 7 : 12, noise: 0.05, freq: 2, seed: i, pos: b.c.toArray() });
    paint(g, (p, n) => new THREE.Color(0xffffff).lerp(col, 0.55 + 0.2 * Math.sin(p.y * 12 + i))); rig.add(memM, skinRigid(g, bb));
    const gg = ellipsoid([b.r * 0.55, b.r * 0.6, b.r * 0.55], { w: low ? 7 : 10, h: low ? 5 : 8, noise: 0.2, freq: 3, seed: i + 9, pos: b.c.toArray() }); paint(gg, (p) => new THREE.Color(0xff9a70).lerp(new THREE.Color(0xff2a48), Math.abs(Math.sin(p.x * 14 + i)))); rig.add(gasM, skinRigid(gg, bb));
    if (i) { const st = tube([[b.c.x * 0.3, 0.8 + (b.c.y - 0.8) * 0.3, b.c.z * 0.3], b.c.clone().multiplyScalar(0.6).add(new V3(0, 0.32, 0)), b.c.clone().lerp(new V3(0, 0.8, 0), 0.0).add(new V3(-b.c.x * 0.4, -(b.c.y - 0.8) * 0.4, -b.c.z * 0.4))], { rad: [0.05, 0.03], seg: 3, sides: 4 }); paint(st, 0xb04060); rig.add(skin, skinRigid(st, bb)); }
    bl.push({ bb, r: b.r, ph: b.ph, c: b.c });
  });
  const coreG = ellipsoid([0.3, 0.3, 0.3], { w: low ? 8 : 12, h: low ? 6 : 9, noise: 0.15, freq: 2.5, seed: 33, pos: [0, 0.8, 0] }); paint(coreG, 0x8a2040); rig.add(skin, skinRigid(coreG, cl));
  // ── ojo en un esfínter de carne ──
  const EP = new V3(0, 0.86, 0.5), eb = rig.bone(cl, EP, 'eye');
  const ring = (a0, a1) => { const pts = []; for (let i = 0; i <= 8; i++) { const a = a0 + (i / 8) * (a1 - a0); pts.push([EP.x + Math.cos(a) * 0.23, EP.y + Math.sin(a) * 0.23, EP.z - 0.04]); } return pts; };
  for (const [a0, a1] of [[0.0, Math.PI], [Math.PI, TAU]]) { const g = tube(ring(a0, a1), { rad: (t) => 0.05 * (0.8 + 0.4 * Math.sin(t * Math.PI)), seg: low ? 6 : 10, sides: low ? 5 : 7 }); paint(g, 0xa03050); rig.add(skin, skinRigid(g, eb)); }
  const e = eye({ r: 0.19, iris: 0xff6020, iris2: 0x601000, sclera: 0xe8cfc0, vein: 0xb02020, pupil: 'round', irisR: 0.72, glow: 0.8, lidMat: lidMaterial({ color: 0x9a3048, vein: 0x601020, sssColor: 0xff3050, sss: 0.4, tile: 2 }), slant: 0.1, maxYaw: 0.6, maxPitch: 0.45 }); rig.attach(eb, e.object, [EP.x, EP.y, EP.z]); mats.push(e.mat, e.lid.material);
  if (!low) for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, base = new V3(EP.x + Math.cos(a) * 0.27, EP.y + Math.sin(a) * 0.27, EP.z - 0.05), out = new V3(Math.cos(a), Math.sin(a), 0.5).normalize(), len = 0.1 + R() * 0.07; const g = tube([base, base.clone().addScaledVector(out, len * 0.5), base.clone().addScaledVector(out, len).add(new V3(0, 0, 0.03))], { rad: [0.008, 0.002], seg: 3, sides: 3, caps: false }); paint(g, 0x3a1020); bendAttr(g, (p) => clamp(p.distanceTo(base) / len, 0, 1), i * 0.6); rig.add(lashM, skinRigid(g, eb)); }
  // ── mecha: filamento con la punta encendida ──
  const FJ = [[0.05, 1.18, -0.05], [0.12, 1.5, -0.12], [0.02, 1.78, -0.1], [-0.08, 1.98, -0.02]], fb = []; FJ.forEach((p, i) => fb.push(rig.bone(i ? fb[i - 1] : cl, p, 'fz')));
  { const g = tube(FJ, { rad: (t) => 0.04 * (1 - t * 0.8) + 0.008, seg: low ? 6 : 10, sides: low ? 4 : 5 }); paint(g, (p) => new THREE.Color(0x5a1a28).lerp(new THREE.Color(0xff8a30), smooth(1.7, 2.0, p.y))); rig.add(skin, skinChain(g, fb, 0.1)); rig.add(cry, skinRigid(crystal(0.03, 0.12, { sides: 5, pos: FJ[3], dir: [-0.3, 1, 0], seed: 5, c0: 0x802010, c1: 0xffe0a0 }), fb[3])); }
  // cristales que asoman entre las vejigas
  [[0.3, 1.1, 0.3], [-0.35, 0.95, 0.2], [0.1, 0.5, 0.35], [-0.25, 1.25, -0.25]].slice(0, low ? 2 : 4).forEach((p, i) => rig.add(cry, skinRigid(crystal(0.035, 0.18, { sides: 5, pos: p, dir: [p[0], p[1] - 0.8, p[2]], seed: 8 + i, c0: 0x802010, c1: 0xffe0a0 }), cl)));
  // ── patas finas con IK ──
  const legs = [];
  for (let i = 0; i < 4; i++) { const s = i % 2 ? 1 : -1, row = i >> 1, z = row ? -0.18 : 0.2, H = new V3(s * 0.24, 0.62, z), K = new V3(s * 0.55, 0.72, z + (row ? -0.1 : 0.08)), F = new V3(s * 0.62, 0.03, z + (row ? -0.28 : 0.3));
    const Lg = buildLeg(rig, skin, body, H, K, F, { r0: 0.06, rk: 0.045, r1: 0.012, knuckle: 0.015, seg: low ? 6 : 10, sides: low ? 4 : 6, claw: 0.12, clawCol: 0xf0e4d0, spines: 0, side: s, name: 'r' + i, paintFn: (p) => new THREE.Color(0x7a2840).lerp(new THREE.Color(0xe0a080), smooth(0.3, 0.02, p.y)) });
    legs.push({ Lg, s, row, base: new V3(F.x, 0, F.z) }); }
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); rootObj.position.y = -0.9; /* el centro de la criatura (sim) está a 0.9 r del suelo: los pies del modelo (y=0) deben tocar el piso */ const K = 1.05; rootObj.scale.setScalar(K);
  const glow = glowSprite(color, 2, 0); glow.position.y = 0.9; rootObj.add(glow);
  const spark = glowSprite(0xffd080, 0.35, 0.8); spark.position.set(-0.08, 2.0, -0.02); rootObj.add(spark);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.3); aura.position.y = 0.9; rootObj.add(aura);
  mats.push(disposer(rig, [glow.material, spark.material, aura.geometry, aura.material]));
  const spJit = new Spring(0, 200, 12); let prevHp = 1, flinch = 0, phase = 0, fuse = 0, strobe = 0; const tmp = new V3(0, 0, 1), look = new V3(0, 0, 1), q1 = new THREE.Quaternion(), lh = new V3(), cache = new Map(), bend = new V3();
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05);
    const speed = Math.min(1.6, Math.max(0.35, ctx.speed || 0)), hurt = st.hp != null && st.hp < 0.35, stun = !!st.st;
    if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4.5);
    // urgencia: 0 lejos … 1 a punto de estallar (ctx.dist en unidades de mundo)
    const d = ctx.dist == null ? 40 : ctx.dist, target = st.s === 'fuse' ? 1 : THREE.MathUtils.clamp(1 - (d - 5) / 22, 0, 1);
    fuse += (target - fuse) * Math.min(1, 5 * dt); const u = fuse * fuse * (3 - 2 * fuse) * 0.4 + fuse * 0.6;
    const freq = 2.4 + 16 * u + (hurt ? 3 : 0); strobe += dt * freq * TAU; const beat = 0.5 + 0.5 * Math.sin(strobe), flash = u > 0.55 ? (Math.sin(strobe * 0.5) > 0 ? 1 : 0) * (u - 0.4) : 0;
    // vejigas: laten a su aire, se hinchan con la urgencia y se agitan; una está flácida si está herida
    const infl = 1 + 0.3 * u + 0.12 * flinch;
    bl.forEach((b, i) => { const p = Math.sin(strobe + b.ph), k = infl * (1 + (0.05 + 0.1 * u) * p) * (hurt && i === 3 ? 0.55 : 1), rp = b.c.clone().sub(cl.userData.rest); b.bb.scale.set(k, k * (1 - 0.06 * p), k);
      b.bb.position.set(rp.x * (1 + (infl - 1) * 0.6) + (u > 0.3 ? Math.sin(t * 40 + b.ph) * 0.012 * u : 0), rp.y * (1 + (infl - 1) * 0.6) + (u > 0.3 ? Math.cos(t * 37 + b.ph) * 0.012 * u : 0), rp.z * (1 + (infl - 1) * 0.6)); });
    // color del gas: del color propio al rojo caliente y a blanco en el flash
    C.copy(col).lerp(HOT, Math.min(1, u * 1.3)).lerp(WHITE, flash * 0.6);
    gasM.userData.un.uGlowC.value.copy(C); gasM.userData.u.uGlow.value = 0.8 + 1.4 * u + 1.2 * flash; gasM.userData.un.uVeinC.value.copy(C).multiplyScalar(0.8);
    memM.userData.u.uVeinGlow.value = 0.5 + 1.2 * u + flash; memM.userData.u.uSss.value = 0.9 + 1.4 * u + flash; memM.userData.un.uSssC.value.copy(C); memM.opacity = 0.46 - 0.1 * u; memM.color.copy(MEM0).lerp(HOT, Math.min(1, u * 1.25)).lerp(WHITE, flash * 0.3);
    skin.userData.u.uVeinGlow.value = 0.6 + 1.0 * u; cry.emissiveIntensity = 0.7 + 0.8 * u + flash;
    glow.material.opacity = (0.12 + 0.5 * u) * (0.4 + 0.6 * beat) + 0.35 * flash; glow.material.color.copy(C); glow.scale.setScalar(1.6 + 1.6 * u + 0.5 * beat * u);
    // temblor general y bamboleo al correr
    const jit = spJit.step(dt, (Math.sin(t * 45) + Math.sin(t * 61)) * 0.012 * (u + (hurt ? 0.5 : 0) + (stun ? 0.4 : 0)));
    cl.position.x = jit; cl.position.y = cl.userData.rest.y - body.userData.rest.y + Math.abs(Math.sin(phase * 0.5)) * 0.06 * speed - (hurt ? 0.05 : 0); cl.rotation.z = Math.sin(phase * 0.5) * 0.08 * speed + jit * 2; cl.rotation.x = 0.1 * speed - 0.15 * u;
    // mecha: ondula y cada vez más agitada; chispa en la punta
    fb.forEach((b, i) => { b.rotation.x = Math.sin(t * (2 + 6 * u) + i) * (0.12 + 0.2 * u); b.rotation.z = Math.cos(t * (1.7 + 5 * u) + i * 1.3) * (0.12 + 0.2 * u); });
    spark.material.opacity = 0.6 + 0.4 * Math.sin(t * 30) * (0.5 + u); spark.scale.setScalar(0.3 + 0.35 * u + 0.12 * Math.sin(t * 37));
    spark.position.set(-0.08 + Math.sin(t * 3) * 0.08 * (1 + u), 2.0 + Math.sin(t * 2) * 0.03, -0.02 + Math.cos(t * 2.4) * 0.07 * (1 + u));
    // ojo: mira, se abre de par en par cuando se acerca
    cl.updateMatrix(); eb.updateMatrix(); boneQuat(eb, root, q1); gazeDir(look, (ctx.dist || 8) / K, tmp.set(0, 1.6, 0.5), lh); lh.applyQuaternion(q1.invert());
    eb.scale.setScalar(1 + 0.25 * u);
    e.update(dt, lh, { open: stun ? 0.45 : hurt ? 0.7 : 0.95, dilate: 0.5 * u - 0.1, glowMul: 0.6 + 1.6 * u, quiver: u > 0.5 || hurt ? 1 : 0 });
    // patitas: más rápidas con la urgencia
    cache.clear(); phase += dt * (6 + speed * 12 + 8 * u);
    legs.forEach((Lg, i) => { const g = (Lg.row + (Lg.s > 0 ? 1 : 0)) % 2, [adv, lift] = gait(phase + g * Math.PI, 0.45), stride = 0.26 * Math.min(1, 0.3 + speed), lf = 0.24 * Math.min(1, 0.4 + speed); tmp.set(Lg.base.x, Lg.base.y + lift * lf - 0.02 * u + (hurt && i === 0 ? 0.14 : 0), Lg.base.z + adv * stride); bend.set(Lg.s * 0.8, 1.2, 0); footTo(Lg.Lg, root, tmp, bend, cache); });
    body.position.y = body.userData.rest.y; rootObj.rotation.z = stun ? Math.sin(t * 24) * 0.06 : 0; tickAura(aura, st, t);
  } };
}
