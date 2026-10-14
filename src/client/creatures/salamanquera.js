// SALAMANQUERA (id interno «cuarzo», invocadora) — bruja de la Salamanca (la cueva donde el Malo enseña sus artes). Vieja encorvada bajo
// una CAPUCHA PUNTIAGUDA y un rebozo color vino raídos, cara verdosa de nariz larga y ojos magenta, collar de huesitos, manos de garra
// y un BÁCULO torcido más alto que ella coronado por un cráneo de chivo con cuernos y una vela. Silueta: joroba + báculo + capucha.
// INVOCACIÓN ('cast', 1 s): levanta el báculo con las dos manos, la vela se vuelve una llamarada magenta, el cráneo mira y en el piso
// se enciende un CÍRCULO DE RUNAS mientras ánimas de luz giran a su alrededor (de ahí salen las criaturas). NÚCLEO = amuleto del pecho.
import { THREE, lod, clamp, lerp, smooth, Rig, humanoide, alcanzar, velo, carne, hueso, brillo, setBrillo, nucleo, motas, fuego, llama, aro, sudario, cara, calavera, tube, spike, paint, ellipsoid, skinRigid, skinChain, skinFn, disposer, shieldAura, tickAura, Spring, dampTo, TAU, joinUV } from './alma-kit.js';
import { bio } from './geoda-bio.js';

export default function build(kit, color = 0xff4fd0) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const skin = carne({ vein: 0x40ff90, sssColor: 0x90c070, rimColor: color, veinGlow: 0.2, veinK: 0.2, tex: 'skin', tile: 4, bump: 1.2, rough: 0.7, clear: 0.1 });
  const cloth = velo(0x5a1a2c, { alpha: 1, rimColor: color, rim: 0.45, flutter: 0.045, speed: 1.6, weave: 0.9, emissiveLift: 0.05, sheen: 0.4 });
  const bone = hueso({ rimColor: color });
  const wood = bio({ color: 0xffffff, rough: 0.8, tex: 'fine', tile: 6, bump: 1.2, grain: 0.7, seam: 0x120806, seamK: 0.4, lift: 0.08, rim: 0.2, rimColor: color });
  const eyeM = brillo(color, 2), fireM = fuego(0xff2aa0, 0xffe0f0, { k: 0.8, speed: 1.2, wob: 0.15 });
  const mats = [skin, cloth, bone, wood, eyeM, fireM];
  const rig = new Rig();
  const B = humanoide(rig, { H: 1.72, shoulder: 0.16, hip: 0.1, arm: [0.28, 0.26], armR: [0.035, 0.02], hand: 0.15, claw: 0.05, legs: false, pelY: 0.82, matSkin: skin, matHand: skin, hunch: 0.28, neckLen: 0.09, curl: 0.4,
    torso: (t) => lerp(0.13, 0.12, t) + 0.05 * smooth(0.5, 0.8, t) * Math.exp(-Math.pow((t - 0.8) / 0.2, 2)) - 0.06 * smooth(0.86, 1, t), torsoPaint: 0x40503a, armPaint: (p) => new THREE.Color(0x5a6a48).lerp(new THREE.Color(0x2a3020), smooth(1.2, 0.8, p.y)), handColor: 0x6a7850, clawColor: 0x100808 });
  const { root, pelvis, spine, chest, neck, head, armL, armR, Y } = B;
  const hp = head.userData.rest;
  // cara de vieja: nariz larga, cuencas hundidas, mentón; ojos magenta
  const fg = cara(0.095, { skin: 0x6a7a50, socket: 0x100810, lips: 0x2a1a20, gaunt: 1 }); fg.translate(hp.x, hp.y + 0.07, hp.z + 0.02); rig.add(skin, skinRigid(fg, head));
  const nose = spike(0.022, 0.11, { sides: 5, seg: 3, bend: 0.4, bendDir: [0, -1, 0], pos: [hp.x, hp.y + 0.07, hp.z + 0.1], dir: [0, -0.35, 1] }); paint(nose, 0x6a7a50); rig.add(skin, skinRigid(nose, head));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.016, 0.01, 0.008); e.translate(hp.x + s * 0.032, hp.y + 0.09, hp.z + 0.09); rig.add(eyeM, skinRigid(e, head)); }
  // capucha puntiaguda + rebozo hasta media espalda (1 tela) + falda larga raída
  const hood = sudario([[0, hp.y + 0.34, hp.z - 0.14], [0, hp.y + 0.2, hp.z - 0.06], [0, hp.y + 0.05, hp.z - 0.04], [0, hp.y - 0.15, hp.z - 0.08], [0, Y.chestY - 0.1, hp.z - 0.12]],
    { rad: (t) => lerp(0.005, 0.15, smooth(0, 0.35, t)) + 0.12 * smooth(0.45, 1, t), arc: [-2.35, 2.35], up: [0, 0.2, 1], rows: 14, cols: 20, tatter: 0.35, seed: 4, color: 0x8a3048, colorEnd: 0x40101e, fold: 0.1 });
  rig.add(cloth, skinFn(hood, (p) => [[head, smooth(hp.y - 0.15, hp.y + 0.02, p.y)], [chest, 1 - smooth(hp.y - 0.15, hp.y + 0.02, p.y)]]));
  const sk2 = [rig.bone(pelvis, [0, 0.45, -0.05], 'sk0')]; sk2.push(rig.bone(sk2[0], [0, 0.05, -0.08], 'sk1'));
  const skirt = sudario([[0, Y.chestY, Y.chestY * 0 + chest.userData.rest.z - 0.02], [0, Y.pelY, 0], [0, 0.45, -0.04], [0, 0.0, -0.08]], { rad: (t) => lerp(0.15, 0.36, smooth(0.15, 1, t)), rows: 14, cols: 22, tatter: 0.4, seed: 6, color: 0x4a1424, colorEnd: 0x200810, fold: 0.12, folds: 8 });
  rig.add(cloth, skinChain(skirt, [chest, pelvis, ...sk2], 0.12));
  // collar de huesitos
  { const parts = []; for (let i = 0; i < (low ? 7 : 11); i++) { const a = -1.2 + (i / ((low ? 7 : 11) - 1)) * 2.4, r = 0.12; const g = spike(0.01, 0.045, { sides: 4, seg: 1, pos: [Math.sin(a) * r, Y.neckY - 0.08 - Math.cos(a) * 0.04, chest.userData.rest.z + Math.cos(a) * r * 0.9 + 0.04], dir: [Math.sin(a) * 0.3, -1, 0.2] }); paint(g, 0xe8dcc0); parts.push(g); } rig.add(bone, skinRigid(joinUV(parts), chest)); }
  // báculo torcido en la mano derecha (armR) con cráneo de chivo y vela
  const wr = armR.rest.wr, sx = wr.x - 0.01, sz = wr.z + 0.04;
  const staff = tube([[sx, 0.02, sz + 0.02], [sx + 0.03, 0.6, sz], [sx - 0.02, 1.2, sz + 0.02], [sx + 0.04, 1.75, sz - 0.01], [sx + 0.0, 2.02, sz + 0.03]], { rad: (t) => 0.022 * (1 + 0.35 * Math.pow(Math.abs(Math.sin(t * 17)), 8)) * (1 + 0.4 * smooth(0.85, 1, t)), seg: low ? 14 : 22, sides: low ? 5 : 7 });
  paint(staff, (p) => new THREE.Color(0x3a2414).lerp(new THREE.Color(0x150a06), Math.abs(Math.sin(p.y * 13)) * 0.6));
  rig.add(wood, skinRigid(staff, armR.hand));
  const gs = calavera(0.075, { long: 1.5, seed: 9, bone: 0xd8c8a0 }); const top = new V3(sx, 2.08, sz + 0.04);
  gs.cranium.rotateX(0.5); gs.cranium.translate(top.x, top.y, top.z); gs.jaw.rotateX(0.5); gs.jaw.translate(top.x, top.y, top.z);
  rig.add(bone, skinRigid(gs.cranium, armR.hand)); rig.add(bone, skinRigid(gs.jaw, armR.hand));
  for (const s of [-1, 1]) { const h = tube([[top.x + s * 0.04, top.y + 0.05, top.z - 0.02], [top.x + s * 0.1, top.y + 0.12, top.z - 0.08], [top.x + s * 0.15, top.y + 0.06, top.z - 0.12], [top.x + s * 0.14, top.y - 0.03, top.z - 0.06], [top.x + s * 0.1, top.y - 0.04, top.z + 0.01]], { rad: (t) => 0.026 * (1 - t * 0.75) * (1 + 0.2 * Math.abs(Math.sin(t * 40))), seg: low ? 8 : 14, sides: 5 }); paint(h, (p) => new THREE.Color(0x3a3020).lerp(new THREE.Color(0xc8b890), smooth(top.y + 0.3, top.y + 0.05, p.y))); rig.add(bone, skinRigid(h, armR.hand));
    const e = new THREE.SphereGeometry(1, 6, 5); e.scale(0.012, 0.01, 0.01); e.applyMatrix4(new THREE.Matrix4().makeRotationX(0.5)); e.translate(top.x + s * 0.026, top.y + 0.02, top.z + 0.065); rig.add(eyeM, skinRigid(e, armR.hand)); }
  const candle = tube([[top.x, top.y + 0.06, top.z - 0.02], [top.x, top.y + 0.17, top.z - 0.02]], { rad: 0.018, seg: 2, sides: 6 }); paint(candle, 0xeee4d0); rig.add(bone, skinRigid(candle, armR.hand));
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 1.05; rootObj.scale.setScalar(K); rootObj.position.y = -0.9;
  const flame = llama(fireM, 0.09, 0.3); flame.position.set(top.x, top.y + 0.17, top.z - 0.02).sub(armR.hand.userData.rest); armR.hand.add(flame);
  const core = nucleo(color, 0.06, { halo: 9 }); chest.add(core.object); core.object.position.set(0, -0.06, 0.14); mats.push(...core.mats);
  const ring = aro(color, { n: 5, dir: -1, speed: 0.8 }); ring.position.y = 0.02; ring.scale.setScalar(1.25); rootObj.add(ring); mats.push(ring.material);
  const souls = motas(20, { color, size: 0.07, modo: 'orbit', box: [0.95, 1.2, 0.95], speed: 0.4, k: 0 }); souls.position.y = 0.7; rootObj.add(souls); mats.push(souls.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.3); aura.position.set(0, 0.95, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, souls.userData.geo]));
  // ── animación ──
  const cache = new Map(), sHy = new Spring(0, 40, 7), tgt = new V3(), look = new V3(0, 0, 1);
  let castK = 0, prevHp = 1, flinch = 0, mutter = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const cast = st.s === 'cast', hurt = st.hp != null && st.hp < 0.35, speed = Math.min(1.2, ctx.speed || 0); if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    castK = dampTo(castK, cast ? 1 : 0, cast ? 7 : 3, dt); const idle = 1 - castK; mutter = Math.sin(t * 9) * Math.sin(t * 3.3);
    // renguea apoyada en el báculo; al invocar se yergue y alza el báculo
    const step = Math.sin(t * (2 + speed * 4) + st.id);
    rootObj.position.y = -0.9 + Math.abs(step) * 0.02 * speed;
    pelvis.rotation.z = step * 0.05 * (0.3 + speed) * idle; pelvis.rotation.y = step * 0.08 * speed * idle;
    spine.rotation.x = 0.2 * idle - 0.2 * castK + flinch * 0.15; chest.rotation.x = 0.18 * idle - 0.25 * castK; chest.rotation.y = Math.sin(t * 0.6) * 0.08 * idle;
    const lx = Math.atan2(look.x, Math.max(0.2, look.z));
    neck.rotation.y = sHy.step(dt, clamp(lx, -0.8, 0.8) * 0.5 + Math.sin(t * 0.4) * 0.1 * idle); neck.rotation.x = -0.25 * idle - 0.35 * castK;
    head.rotation.z = Math.sin(t * 0.9) * 0.08; head.rotation.x = mutter * 0.03 * idle;
    // mano del báculo: apoyado adelante ↔ levantado alto; la otra mano hace pases (dedos abiertos, garras)
    tgt.set(-0.24, Y.pelY + 0.12 + Math.abs(step) * 0.02, 0.2); tgt.lerp(new V3(-0.12, Y.neckY + 0.3, 0.32), castK);
    alcanzar(armR, root, tgt, new V3(-0.8, -0.3, -0.5), cache); armR.fing.rotation.x = -0.9; armR.hand.rotation.z = -0.15 * castK;
    tgt.set(0.2 + Math.sin(t * 1.7) * 0.03, Y.pelY + 0.2 + Math.sin(t * 2.1) * 0.05, 0.22 + mutter * 0.03); tgt.lerp(new V3(0.3, Y.neckY + 0.15 + Math.sin(t * 7) * 0.04, 0.35), castK);
    alcanzar(armL, root, tgt, new V3(0.8, -0.3, -0.5), cache); armL.fing.rotation.x = -0.2 + 0.5 * castK + Math.sin(t * 5) * 0.2;
    sk2.forEach((b, i) => { b.rotation.x = Math.sin(t * 1.5 - i) * 0.05 + speed * 0.06; b.rotation.z = Math.sin(t * 1.2 - i * 0.8) * 0.05; });
    cloth.userData.u.uWind.value.set(0, 0.04 * castK, -0.06 * castK); cloth.userData.u.uFlut.value = 0.04 + 0.06 * castK;
    // magia: vela→llamarada, ojos, círculo de runas y ánimas girando (AVISO de invocación)
    fireM.uniforms.uK.value = 0.8 + castK * 0.8; flame.scale.set(0.09 / 0.32 * (1 + castK * 2.5), 0.3 * (1 + castK * 3), 0.09 / 0.32 * (1 + castK * 2.5));
    setBrillo(eyeM, 1.5 + castK * 3 + Math.max(0, mutter) * 0.5);
    ring.userData.setK(castK * (0.85 + 0.15 * Math.sin(t * 12))); ring.rotation.z = t * 0.7;
    souls.material.uniforms.uK.value = castK * 1.2; souls.material.uniforms.uSpd.value = 0.3 + castK * 0.9;
    core.set((1 + castK * 1.3 + flinch * 0.5) * (hurt ? (Math.sin(t * 15) > 0 ? 1 : 0.5) : 1), t, dt);
    tickAura(aura, st, t);
  } };
}
