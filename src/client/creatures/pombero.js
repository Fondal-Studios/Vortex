// POMBERO (id interno «espejo», emboscador) — duende del monte: petiso, panzón y PELUDO, piernas chuecas, brazos larguísimos que tocan el
// piso, manos enormes, orejas de murciélago, barba, ojos verdes que brillan y un SOMBRERO DE PAJA ENORME (la silueta de lejos: un ala ancha
// sobre un bulto). Se vuelve INVISIBLE (st.c): el cuerpo se deshace en un temblor transparente y sólo quedan dos chispas de ojos.
// AVISO ('blink', 0.6 s): se agacha, frunce la boca y SILBA (aros de sonido salen de la boca) y parpadea — después aparece a tu espalda
// ('strike'): salta con los brazos en alto y las garras abiertas. NÚCLEO = ombligo de luz en la panza.
import { THREE, lod, clamp, lerp, smooth, Rig, humanoide, alcanzar, velo, carne, pelo, brillo, setBrillo, nucleo, motas, aro, sudario, ellipsoid, spike, tube, paint, skinRigid, skinChain, skinFn, setK, disposer, shieldAura, tickAura, Spring, dampTo, TAU, rng } from './alma-kit.js';

export default function build(kit, color = 0x8cff4a) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const fur = pelo({ rimColor: 0xffb070, rim: 0.18, seam: 0x020100, seamK: 0.6, grain: 0.9 });
  const skin = carne({ vein: 0x40ff60, veinK: 0.1, veinGlow: 0.1, sss: 0.3, sssColor: 0xa06040, rimColor: color, tex: 'skin', tile: 4, rough: 0.6 });
  const straw = velo(0xd8b060, { alpha: 1, rimColor: 0xffe8a0, rim: 0.25, flutter: 0.012, speed: 1.2, weave: 1.2, emissiveLift: 0.05, sheen: 0.2, rough: 0.9 });
  const eyeM = brillo(color, 2.4);
  const ghost = velo(0xffffff, { alpha: 0.07, rimColor: color, rim: 1.5, rimPow: 3, flutter: 0, weave: 0, hem: 1, hemGlow: 0, sheen: 0 });   // temblor del camuflaje
  const mats = [fur, skin, straw, eyeM, ghost];
  const rig = new Rig();
  const B = humanoide(rig, { H: 1.25, shoulder: 0.2, hip: 0.13, arm: [0.36, 0.34], armR: [0.07, 0.04], hand: 0.2, claw: 0.05, fingers: 4, legs: true, leg: [0.26, 0.26], legR: [0.085, 0.045], matSkin: fur, matHand: skin, hunch: 0.22, neckLen: 0.04, curl: 0.35,
    torso: (t) => 0.2 + 0.07 * Math.exp(-Math.pow((t - 0.3) / 0.22, 2)) - 0.05 * smooth(0.8, 1, t), torsoEx: [1, 0.9],
    torsoPaint: (p) => new THREE.Color(0x2a1c10).lerp(new THREE.Color(0x120a06), smooth(0.9, 0.5, p.y)), armPaint: 0x22180e, legPaint: 0x1a1208, handColor: 0x4a3426, clawColor: 0x0a0806, footColor: 0x3a2a1e });
  const { root, pelvis, spine, chest, neck, head, armL, armR, legL, legR, Y } = B;
  const hp = head.userData.rest;
  // cabeza: cara ancha de piel curtida, nariz bulbosa, boca de sonrisa ancha (labio que se frunce para silbar), barba y orejas grandes
  const fh = ellipsoid([0.16, 0.15, 0.15], { w: low ? 14 : 20, h: low ? 10 : 14, noise: 0.08, seed: 7, pos: [hp.x, hp.y + 0.08, hp.z + 0.04] }); paint(fh, (p) => new THREE.Color(0x6a4a34).lerp(new THREE.Color(0x2a1a10), smooth(hp.y + 0.1, hp.y - 0.05, p.y))); rig.add(skin, skinRigid(fh, head));
  const nose = ellipsoid([0.045, 0.04, 0.05], { w: 10, h: 8, pos: [hp.x, hp.y + 0.07, hp.z + 0.2] }); paint(nose, 0x7a4a36); rig.add(skin, skinRigid(nose, head));
  const lip = rig.bone(head, [hp.x, hp.y + 0.0, hp.z + 0.17], 'lip');
  const mouth = ellipsoid([0.075, 0.018, 0.03], { w: 12, h: 6, pos: [hp.x, hp.y + 0.0, hp.z + 0.17] }); paint(mouth, (p) => (Math.abs(p.y - hp.y) < 0.006 ? new THREE.Color(0x0a0303) : new THREE.Color(0x5a2a22))); rig.add(skin, skinRigid(mouth, lip));
  for (const s of [-1, 1]) {
    const ear = spike(0.07, 0.22, { sides: 4, seg: 3, bend: 0.3, bendDir: [0, 1, 0], pos: [hp.x + s * 0.14, hp.y + 0.1, hp.z + 0.0], dir: [s * 1, 0.45, -0.2] }); ear.scale(1, 1, 1); paint(ear, (p) => new THREE.Color(0x6a4030).lerp(new THREE.Color(0xa05a48), 0.3)); rig.add(skin, skinRigid(ear, head));
    const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.03, 0.026, 0.016); e.translate(hp.x + s * 0.06, hp.y + 0.12, hp.z + 0.17); rig.add(eyeM, skinRigid(e, head));
  }
  // barba y matas de pelo (espinas finas = mechones) — misma malla de pelo
  const R = rng(9), tufts = [];
  const tuft = (x, y, z, dx, dy, dz, h, bone) => { const g = spike(0.022, h, { sides: 3, seg: 2, bend: 0.3, bendDir: [0, -1, 0], pos: [x, y, z], dir: [dx, dy, dz] }); paint(g, 0x2a1c10); tufts.push([g, bone]); };
  for (let i = 0; i < (low ? 8 : 14); i++) { const a = -1.1 + (i / ((low ? 8 : 14) - 1)) * 2.2; tuft(hp.x + Math.sin(a) * 0.12, hp.y - 0.02 + Math.abs(a) * 0.04, hp.z + Math.cos(a) * 0.1 + 0.04, Math.sin(a) * 0.2, -1, 0.3, 0.16 + R() * 0.08, head); }
  for (let i = 0; i < (low ? 10 : 22); i++) { const a = R() * TAU, y = lerp(Y.pelY, Y.neckY, R()); tuft(Math.cos(a) * 0.19, y, Math.sin(a) * 0.16 + chest.userData.rest.z * 0.5, Math.cos(a), 0.2, Math.sin(a), 0.1 + R() * 0.06, y > Y.chestY ? chest : spine); }
  for (const A of [armL, armR]) for (let i = 0; i < (low ? 3 : 6); i++) { const k = R(), p = A.rest.sh.clone().lerp(A.rest.el, k * 1.6); tuft(p.x + A.side * 0.05, p.y, p.z, A.side, -0.4, -0.2, 0.09, k < 0.6 ? A.up : A.fo); }
  tufts.forEach(([g, b]) => rig.add(fur, skinRigid(g, b)));
  // SOMBRERO DE PAJA: ala ancha (aro de tela que ondea un poco) + copa con cinta
  const hatY = hp.y + 0.24;
  // ala: disco ondulado de 0.18 → 0.56 (el borde ondea un poco con el aire)
  const ring = new THREE.RingGeometry(0.18, 0.56, low ? 22 : 34, 2); ring.rotateX(-Math.PI / 2); { const P = ring.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x); P.setY(i, -0.06 * smooth(0.25, 0.56, r) + 0.025 * Math.sin(a * 5) * smooth(0.3, 0.56, r) - (r > 0.5 ? 0.02 * Math.abs(Math.sin(a * 13)) : 0)); } ring.computeVertexNormals(); }
  ring.translate(hp.x, hatY, hp.z + 0.02); paint(ring, (p) => new THREE.Color(0xc8a050).lerp(new THREE.Color(0x6a4a20), 0.4 * Math.abs(Math.sin(Math.hypot(p.x - hp.x, p.z - hp.z) * 60)))); setK(ring, (p) => smooth(0.3, 0.56, Math.hypot(p.x - hp.x, p.z - hp.z - 0.02)));
  rig.add(straw, skinRigid(ring, head));
  const crown = tube([[hp.x, hatY - 0.04, hp.z + 0.02], [hp.x, hatY + 0.08, hp.z + 0.02], [hp.x, hatY + 0.16, hp.z + 0.0], [hp.x, hatY + 0.2, hp.z - 0.01]], { rad: (t) => lerp(0.2, 0.15, t) * (t > 0.9 ? 0.7 : 1), seg: 5, sides: low ? 12 : 18 }); paint(crown, (p) => (p.y < hatY + 0.04 && p.y > hatY - 0.0 ? new THREE.Color(0x3a1408) : new THREE.Color(0xb89048).lerp(new THREE.Color(0x705020), 0.4 * Math.abs(Math.sin(p.y * 90))))); setK(crown, 0);
  rig.add(straw, skinRigid(crown, head));
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 1.2; rootObj.scale.setScalar(K); rootObj.position.y = -0.9;
  // copia «fantasma» del cuerpo para el camuflaje: mismas geometrías y esqueleto con material de temblor
  const ghosts = rig.meshes.filter((m) => m.material !== eyeM).map((m) => { const g = new THREE.SkinnedMesh(m.geometry, ghost); g.bind(rig.skeleton, new THREE.Matrix4()); g.frustumCulled = false; g.visible = false; g.renderOrder = 3; group.add(g); return g; });
  const core = nucleo(color, 0.06, { halo: 8 }); spine.add(core.object); core.object.position.set(0, -0.03, 0.22); mats.push(...core.mats);
  const whistle = aro(color, { n: 3, dir: 1, speed: 2.2, vertical: true }); whistle.scale.setScalar(0.35); rootObj.add(whistle); mats.push(whistle.material);
  const spark = motas(14, { color, size: 0.05, modo: 'burst', box: [0.9, 0.9, 0.9], speed: 1.4, k: 0, center: [0, 0.7, 0] }); rootObj.add(spark); mats.push(spark.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.0); aura.position.set(0, 0.7, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, spark.userData.geo]));
  const bodyMats = [fur, skin, straw];
  // ── animación ──
  const cache = new Map(), sHy = new Spring(0, 60, 8), tgt = new V3(), look = new V3(0, 0, 1), mp = new V3();
  let ph = 0, runK = 0, blinkK = 0, strikeK = 0, cloakK = 0, prevHp = 1, flinch = 0, wasCloak = false;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const speed = Math.min(1.6, ctx.speed || 0), blink = st.s === 'blink', strike = st.s === 'strike', hurt = st.hp != null && st.hp < 0.35; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    runK = dampTo(runK, Math.min(1, speed * 1.4), 6, dt); blinkK = dampTo(blinkK, blink ? 1 : 0, blink ? 12 : 6, dt); strikeK = dampTo(strikeK, strike ? 1 : 0, strike ? 14 : 4, dt);
    cloakK = dampTo(cloakK, st.c && !blink ? 1 : 0, st.c ? 3 : 9, dt);
    ph += dt * (4 + runK * 10);
    // trotecito chueco y bamboleante; agachado al silbar; salto con brazos arriba al atacar
    const bob = Math.abs(Math.sin(ph)) * 0.05 * runK;
    pelvis.position.y = pelvis.userData.rest.y + bob - blinkK * 0.1 + strikeK * 0.08 + Math.sin(t * 2) * 0.01;
    pelvis.rotation.z = Math.sin(ph) * 0.14 * runK; pelvis.rotation.x = 0.15 * runK + blinkK * 0.2 - strikeK * 0.15;
    spine.rotation.x = 0.1 + 0.15 * runK + blinkK * 0.25 - strikeK * 0.2; chest.rotation.x = 0.1 - strikeK * 0.25; chest.rotation.y = -Math.sin(ph) * 0.15 * runK;
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    neck.rotation.y = sHy.step(dt, clamp(lx, -0.9, 0.9) * 0.7); neck.rotation.x = -0.25 - clamp(ly, -0.4, 0.4) * 0.4 + blinkK * 0.15;
    head.rotation.z = Math.sin(t * 1.7 + st.id) * 0.1 + Math.sin(ph) * 0.1 * runK;
    lip.scale.set(1 - blinkK * 0.65, 1 + blinkK * 1.4 + strikeK * 2.5, 1 + blinkK * 0.6); lip.position.z = lip.userData.rest.z - head.userData.rest.z + blinkK * 0.02;
    [legL, legR].forEach((Lg, i) => { const adv = Math.sin(ph + i * Math.PI), lift = Math.max(0, Math.cos(ph + i * Math.PI));
      tgt.set(Lg.side * 0.2, 0.05 + lift * 0.14 * runK, adv * 0.18 * runK); if (strikeK > 0.01) tgt.lerp(new V3(Lg.side * 0.18, 0.25, -0.1), strikeK); if (blinkK > 0.01) tgt.lerp(new V3(Lg.side * 0.26, 0.05, 0.05), blinkK);
      alcanzar(Lg, root, tgt, new V3(Lg.side * 0.6, 0, 1), cache); });
    // brazos larguísimos: arrastran los nudillos / se alzan con garras al atacar
    [armL, armR].forEach((A, i) => { const s = A.side, sw = Math.sin(ph + (i ? 0 : Math.PI)) * 0.2 * runK;
      tgt.set(s * 0.32, 0.12 + Math.sin(t * 1.3 + i) * 0.02, 0.12 + sw);
      if (blinkK > 0.01) tgt.lerp(new V3(s * 0.1, Y.neckY - 0.05, 0.3), blinkK);   // manos a la boca: silbido
      if (strikeK > 0.01) tgt.lerp(new V3(s * 0.3, Y.H + 0.2, 0.25), strikeK);
      alcanzar(A, root, tgt, new V3(s * 0.8, -0.2, -0.6), cache); A.fing.rotation.x = -0.6 + strikeK * 0.9 - blinkK * 0.4; });
    // camuflaje: el cuerpo se vuelve un temblor transparente; quedan las chispas de los ojos. También se apaga su aura del render.
    const vis = 1 - cloakK * 0.97, cl = cloakK > 0.02;
    if (cl !== wasCloak) { bodyMats.forEach((m) => { m.transparent = cl; m.depthWrite = !cl; m.needsUpdate = true; }); wasCloak = cl; }
    bodyMats.forEach((m) => { m.opacity = vis; }); ghosts.forEach((g) => { g.visible = cloakK > 0.05; }); ghost.userData.u.uVis.value = cloakK * (0.6 + 0.4 * Math.sin(t * 7));
    const piv = rootObj.parent; if (piv) for (const c of piv.children) if (c.name === 'beacon' || c.name === 'beaconDark' || c.name === 'elite') c.visible = cloakK < 0.5;
    setBrillo(eyeM, (2 + blinkK * 3 + strikeK * 2) * (1 - cloakK * 0.6));
    core.set((1 + blinkK + strikeK * 1.5 + flinch) * (1 - cloakK * 0.92), t, dt);
    // silbido: aros de sonido frente a la boca
    head.updateMatrixWorld(true); mp.set(hp.x, hp.y + 0.0, hp.z + 0.3).applyMatrix4(new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(head.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(-hp.x, -hp.y, -hp.z)));
    whistle.position.copy(mp); whistle.userData.setK(blinkK * 1.1); whistle.scale.setScalar(0.1 + blinkK * 0.12); whistle.rotation.y = 0;
    spark.material.uniforms.uK.value = blinkK * 1.4 + strikeK; fur.userData.u.uRim.value = 0.3 + blinkK * 1.2;
    fur.userData.u.uWound.value = Math.max(fur.userData.u.uWound.value, hurt ? 0.6 : 0);
    tickAura(aura, st, t);
  } };
}
