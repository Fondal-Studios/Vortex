// EL MANDINGA (id interno «coloso», jefe 1) — el diablo criollo: un torso colosal de piel de obsidiana con GRIETAS DE LAVA, que nace de un
// TORBELLINO DE FUEGO Y HUMO (no tiene piernas), con PONCHO negro forrado de rojo, rastra de monedas de plata en la cintura, SOMBRERO DE
// GAUCHO atravesado por dos CUERNOS de chivo enormes, ojos de brasa y manos con garras. Silueta: sombrero+cuernos sobre hombros anchos.
// Estados: 'wind' (0.8 s) = levanta los brazos y le arden las palmas (sale el anillo de orbes) · 'ray' = abre la boca y el pecho, un haz de
// fuego crece hacia el resonador (st.a) · 'stagger' = se desploma: sombrero caído, fuego apagado, humo, brazos colgando (vulnerable).
// st.sd = escudo (anillo de fuego que gira + burbuja). Fases por hp: más grietas encendidas, cuernos al rojo, más fuego.
// NÚCLEO = corazón de fuego enorme en el pecho (se ve por una herida abierta en el esternón).
import { THREE, lod, clamp, lerp, smooth, Rig, humanoide, alcanzar, velo, carne, hueso, metal, brillo, setBrillo, nucleo, motas, fuego, llamas, sudario, calavera, tube, spike, ellipsoid, paint, skinRigid, skinChain, skinFn, setK, glowSprite, disposer, shieldAura, tickAura, Spring, dampTo, TAU, rng, joinUV } from './alma-kit.js';

export default function build(kit, color = 0xff4a1a) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const skin = carne({ vein: 0xff6a10, veinK: 0.55, veinGlow: 1.2, sss: 0.1, sssColor: 0xff3010, rimColor: 0xff7a30, rim: 0.5, tex: 'scales', tile: 3.5, bump: 1.3, rough: 0.5, clear: 0.4, lift: 0.02 });
  const poncho = velo(0x0a0608, { alpha: 1, rimColor: 0xff3a10, rim: 0.7, flutter: 0.05, speed: 1.6, weave: 1.0, emissiveLift: 0.0, sheen: 0.8, iri: 0.4, hem: 0.7, hemGlow: 0.8 });
  const smoke = velo(0x1a0a08, { alpha: 0.7, rimColor: 0xff5a20, rim: 1.4, flutter: 0.14, speed: 3.2, hem: 0.35, hemGlow: 1.4, weave: 0, sheen: 0, iri: 0.8 });
  const silver = metal(0xd8d8e0, { rough: 0.25, metalness: 1 });
  const horn = hueso({ rimColor: 0xff5a20, rim: 0.5, glowColor: 0xff5a10 });
  const eyeM = brillo(0xffb040, 2.8), fireM = fuego(0xff2a00, 0xffe080, { k: 1, speed: 1, wob: 0.25 }), handFire = fuego(0xff3a00, 0xfff0b0, { k: 0, speed: 1.4, wob: 0.2 });
  const mats = [skin, poncho, smoke, silver, horn, eyeM, fireM, handFire];
  const rig = new Rig();
  const B = humanoide(rig, { H: 2.0, shoulder: 0.4, hip: 0.16, arm: [0.44, 0.42], armR: [0.12, 0.07], hand: 0.27, claw: 0.09, legs: false, pelY: 0.8, matSkin: skin, neckLen: 0.08, curl: 0.35, hunch: 0.12,
    torso: (t) => lerp(0.2, 0.24, smooth(0, 0.4, t)) + 0.14 * smooth(0.45, 0.8, t) - 0.2 * smooth(0.86, 1, t), torsoEx: [1.25, 0.8],
    torsoBulge: (t, a) => 1 + 0.09 * Math.pow(Math.max(0, Math.cos(a * 2)), 4) * smooth(0.5, 0.8, t) + 0.05 * Math.pow(Math.abs(Math.sin(t * 25)), 6) * smooth(0.1, 0.5, t) * Math.max(0, Math.cos(a)),
    torsoPaint: (p) => new THREE.Color(0x1a1010).lerp(new THREE.Color(0x060404), smooth(1.6, 1.0, p.y)), armPaint: 0x140c0c, handColor: 0x1a1010, clawColor: 0xffe0c0 });
  const { root, pelvis, spine, chest, neck, head, armL, armR, Y } = B;
  const hp = head.userData.rest;
  // cabeza: cráneo largo de chivo-hombre con piel, barba en punta, ojos de brasa y boca que se abre (rayo)
  const sk = calavera(0.13, { long: 1.25, seed: 51, bone: 0x2a1a18, dark: 0x000000 }); sk.cranium.translate(hp.x, hp.y + 0.09, hp.z + 0.02); rig.add(skin, skinRigid(sk.cranium, head));
  const jaw = rig.bone(head, [hp.x, hp.y + 0.02, hp.z - 0.02], 'jaw'); sk.jaw.translate(hp.x, hp.y + 0.09, hp.z + 0.02); rig.add(skin, skinRigid(sk.jaw, jaw));
  const beard = spike(0.05, 0.22, { sides: 5, seg: 3, bend: 0.3, bendDir: [0, 0, 1], pos: [hp.x, hp.y - 0.05, hp.z + 0.12], dir: [0, -1, 0.25] }); paint(beard, 0x0a0606); rig.add(skin, skinRigid(beard, jaw));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.03, 0.018, 0.014); e.translate(hp.x + s * 0.046, hp.y + 0.1, hp.z + 0.15); rig.add(eyeM, skinRigid(e, head)); }
  // cuernos de chivo (anillados) que atraviesan el sombrero
  for (const s of [-1, 1]) { const P = [[hp.x + s * 0.07, hp.y + 0.17, hp.z + 0.02], [hp.x + s * 0.2, hp.y + 0.35, hp.z - 0.08], [hp.x + s * 0.36, hp.y + 0.42, hp.z - 0.22], [hp.x + s * 0.48, hp.y + 0.33, hp.z - 0.32], [hp.x + s * 0.5, hp.y + 0.2, hp.z - 0.24], [hp.x + s * 0.44, hp.y + 0.15, hp.z - 0.1]];
    const g = tube(P, { rad: (t) => 0.055 * Math.pow(1 - t, 0.8) * (1 + 0.15 * Math.pow(Math.abs(Math.sin(t * 40)), 3)) + 0.004, seg: low ? 16 : 26, sides: low ? 6 : 9 }); paint(g, (p) => new THREE.Color(0x2a2018).lerp(new THREE.Color(0xd8c8a0), smooth(hp.x + s * 0.2, hp.x + s * 0.5, p.x) * (s > 0 ? 1 : 0) + smooth(hp.x - 0.2, hp.x - 0.5, p.x) * (s < 0 ? 1 : 0))); rig.add(horn, skinRigid(g, head)); }
  // sombrero de gaucho (ala plana, copa baja) negro con cinta de plata
  { const hatY = hp.y + 0.2; const ring = new THREE.RingGeometry(0.13, 0.4, low ? 22 : 34, 2); ring.rotateX(-Math.PI / 2); const P = ring.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), r = Math.hypot(x, z); P.setY(i, 0.02 * smooth(0.3, 0.4, r)); } ring.computeVertexNormals(); ring.translate(hp.x, hatY, hp.z + 0.02); paint(ring, 0x0c0808); setK(ring, 0);
    const crown = tube([[hp.x, hatY - 0.02, hp.z + 0.02], [hp.x, hatY + 0.09, hp.z + 0.02], [hp.x, hatY + 0.12, hp.z + 0.02]], { rad: [0.15, 0.135], seg: 2, sides: low ? 12 : 18 }); paint(crown, (p) => (p.y < hatY + 0.03 ? new THREE.Color(0x9a9aa8) : new THREE.Color(0x0a0606))); setK(crown, 0);
    rig.add(poncho, skinRigid(joinUV([ring, crown]), head)); }
  // poncho sobre los hombros (forro rojo que brilla en el borde)
  const pb = [rig.bone(chest, [0, Y.chestY - 0.1, -0.1], 'p0')];
  const pon = sudario([[0, Y.neckY + 0.08, 0.0], [0, Y.neckY - 0.05, -0.02], [0, Y.chestY - 0.05, -0.04], [0, Y.pelY + 0.1, -0.05]], { rad: (t) => lerp(0.2, 0.5, smooth(0, 0.6, t)), rows: 12, cols: low ? 22 : 30, tatter: 0.25, seed: 7, color: 0x14080a, colorEnd: 0x2a0606, ex: [1.1, 0.8], fold: 0.08, folds: 10, arc: [0.55, TAU - 0.55] });
  rig.add(poncho, skinFn(pon, (p) => [[neck, smooth(Y.neckY - 0.05, Y.neckY + 0.05, p.y) * 0.5], [chest, 1 - smooth(Y.neckY - 0.05, Y.neckY + 0.05, p.y) * 0.5 - smooth(Y.chestY, Y.pelY + 0.1, p.y) * 0.5], [pb[0], smooth(Y.chestY, Y.pelY + 0.1, p.y) * 0.5]]));
  // rastra: cinto de cuero con monedas de plata
  { const parts = [], n = low ? 10 : 16, by = Y.pelY + 0.06; for (let i = 0; i < n; i++) { const a = -2.4 + (i / (n - 1)) * 4.8; const g = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10); g.rotateX(Math.PI / 2); g.rotateY(a); g.translate(Math.sin(a) * 0.2, by, Math.cos(a) * 0.16); paint(g, 0xffffff); parts.push(g); }
    const buckle = new THREE.CylinderGeometry(0.07, 0.07, 0.015, 14); buckle.rotateX(Math.PI / 2); buckle.translate(0, by, 0.18); paint(buckle, 0xf0f0ff); parts.push(buckle);
    rig.add(silver, skinRigid(joinUV(parts), pelvis)); }
  // herida abierta en el esternón (borde de costillas) donde arde el corazón
  { const parts = []; for (let i = 0; i < (low ? 3 : 5); i++) for (const s of [-1, 1]) { const y = Y.chestY + 0.06 - i * 0.05; const g = tube([[s * 0.03, y, 0.22], [s * 0.085, y - 0.015, 0.21], [s * 0.13, y - 0.03, 0.17]], { rad: 0.012, seg: 4, sides: 4 }); paint(g, 0xd8c8a8); parts.push(g); } rig.add(horn, skinRigid(joinUV(parts), chest)); }
  // torbellino de humo (sudarios que giran) bajo la cintura
  const vortexB = rig.bone(pelvis, [0, Y.pelY - 0.4, 0], 'vx'); const vortexB2 = rig.bone(vortexB, [0, Y.pelY - 1.0, 0], 'vx2');
  const vtx = sudario([[0, Y.pelY + 0.1, 0], [0, Y.pelY - 0.3, 0.0], [0, Y.pelY - 0.7, 0.05], [0, Y.pelY - 1.2, 0.0]], { rad: (t) => lerp(0.22, 0.04, Math.pow(t, 0.8)) + 0.06 * Math.sin(t * 9), rows: 16, cols: 18, tatter: 0.5, seed: 12, color: 0x2a0e08, colorEnd: 0x601808, fold: 0.25, folds: 5 });
  rig.add(smoke, skinChain(vtx, [pelvis, vortexB, vortexB2], 0.12));
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 0.82; rootObj.scale.setScalar(K); rootObj.position.y = -1.0;
  const vfire = llamas(fireM, [{ pos: [0, 0, 0], dir: [0, -1, 0], w: 0.5, h: 1.3 }, { pos: [0.18, 0.05, 0.05], dir: [0.3, -1, 0.1], w: 0.25, h: 0.9 }, { pos: [-0.18, 0.05, -0.05], dir: [-0.3, -1, -0.1], w: 0.25, h: 0.9 }, { pos: [0.0, 0.1, 0.15], dir: [0, 1, 0.2], w: 0.2, h: 0.5 }, { pos: [0.0, 0.1, -0.18], dir: [0, 1, -0.2], w: 0.2, h: 0.5 }]);
  vfire.position.set(0, Y.pelY - 0.15, 0).sub(pelvis.userData.rest); pelvis.add(vfire);
  const palms = [armL, armR].map((A) => { const f = llamas(handFire, [{ pos: [0, 0, 0], w: 0.2, h: 0.6 }, { pos: [0.03, 0, 0.03], dir: [0.3, 1, 0.2], w: 0.12, h: 0.4 }]); f.position.set(0, -0.12, 0.03); A.hand.add(f); return f; });
  const core = nucleo(color, 0.13, { halo: 8 }); chest.add(core.object); core.object.position.set(0, -0.04, 0.17); mats.push(...core.mats);
  const beamM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa040).multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); beamM.userData.u = { uHurt: { value: 0 } };
  const beamG = new THREE.CylinderGeometry(1, 0.6, 1, 10, 1, true); beamG.translate(0, 0.5, 0); beamG.rotateX(Math.PI / 2);
  const beam = new THREE.Mesh(beamG, beamM); beam.visible = false; beam.frustumCulled = false; beam.renderOrder = 6; beam.userData.noBox = true; rootObj.add(beam); mats.push(beamM);
  const mouthGlow = glowSprite(0xffa040, 0.6, 0); rootObj.add(mouthGlow); mats.push(mouthGlow.material);
  const embers = motas(40, { color: 0xff8a30, size: 0.05, modo: 'rise', box: [1.6, 2.6, 1.6], speed: 0.4 }); embers.position.y = 0.8; rootObj.add(embers); mats.push(embers.material);
  const ringF = motas(46, { color: 0xffb040, size: 0.08, modo: 'orbit', box: [1.5, 0.25, 1.5], speed: 0.5, k: 0 }); ringF.position.y = 1.2; rootObj.add(ringF); mats.push(ringF.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffd0a0), 0.5), 1.55); aura.position.set(0, 1.2, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, beamG, embers.userData.geo, ringF.userData.geo]));
  // ── animación ──
  const cache = new Map(), sHy = new Spring(0, 20, 5), sHp = new Spring(0, 20, 5), tgt = new V3(), look = new V3(0, 0, 1), aim = new V3(0, 0, 1), mp = new V3(), qi = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  let wK = 0, rK = 0, sK = 0, prevHp = 1, flinch = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const wind = st.s === 'wind', ray = st.s === 'ray', stag = st.s === 'stagger' || (!!st.st && !ray), hp01 = st.hp == null ? 1 : st.hp, ph = hp01 > 0.66 ? 1 : hp01 > 0.33 ? 2 : 3; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.002) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 3);
    wK = dampTo(wK, wind ? 1 : 0, wind ? 8 : 4, dt); rK = dampTo(rK, ray ? 1 : 0, ray ? 3 : 5, dt); sK = dampTo(sK, stag ? 1 : 0, stag ? 3 : 2, dt); const idle = Math.max(0, 1 - wK - rK - sK);
    if (st.a) { rootObj.updateWorldMatrix(true, false); rootObj.getWorldQuaternion(qi).invert(); aim.set(st.a[0], st.a[1], st.a[2]).applyQuaternion(qi).normalize(); } else aim.copy(look);
    // torso: respira pesado, se agranda en el aviso, se desploma aturdido
    const br = Math.sin(t * 1.1) * 0.02;
    rootObj.position.y = -1.0 + Math.sin(t * 0.7) * 0.05 - sK * 0.12;
    pelvis.rotation.y = Math.sin(t * 0.4) * 0.08; spine.rotation.x = 0.05 + sK * 0.45 - wK * 0.15 + flinch * 0.08; chest.rotation.x = 0.05 + sK * 0.4 - wK * 0.2 - rK * 0.15; chest.scale.set(1 + br + wK * 0.05, 1 + br, 1 + br);
    const lx = Math.atan2((rK > 0.3 ? aim : look).x, Math.max(0.2, (rK > 0.3 ? aim : look).z)), ly = Math.asin(clamp((rK > 0.3 ? aim : look).y, -1, 1));
    neck.rotation.y = sHy.step(dt, clamp(lx, -0.8, 0.8) * 0.5 * (1 - sK)); neck.rotation.x = sHp.step(dt, -clamp(ly, -0.5, 0.5) * 0.6 + sK * 0.6 - wK * 0.3); head.rotation.z = sK * 0.35 + Math.sin(t * 0.6) * 0.04;
    jaw.rotation.x = 0.08 + rK * 0.7 + wK * 0.3 + sK * 0.25 + flinch * 0.2 + Math.max(0, Math.sin(t * 2.1)) * 0.06 * idle;
    // brazos: garras abiertas a los lados ↔ arriba con las palmas en llamas (aviso) ↔ hacia el haz ↔ colgando
    [armL, armR].forEach((A, i) => { const s = A.side;
      tgt.set(s * 0.6, Y.chestY - 0.15 + Math.sin(t * 0.9 + i) * 0.05, 0.3);
      tgt.lerp(new V3(s * 0.5, Y.H + 0.35, 0.15), wK); tgt.lerp(new V3(s * 0.3, Y.chestY + 0.1, 0.55), rK * 0.7); tgt.lerp(new V3(s * 0.45, Y.pelY - 0.35, 0.25), sK);
      alcanzar(A, root, tgt, new V3(s, -0.3, -0.6), cache); A.fing.rotation.x = -0.3 + wK * 0.4 - sK * 0.5; });
    vortexB.rotation.y = t * 2.5; vortexB2.rotation.y = t * 3.5; vortexB.rotation.x = Math.sin(t * 1.3) * 0.1; vortexB2.rotation.z = Math.sin(t * 1.7) * 0.15;
    // fuego / luz por estado y fase
    fireM.uniforms.uK.value = (1.5 + 0.25 * ph) * (1 - sK * 0.75); vfire.rotation.y = t * 1.5;
    handFire.uniforms.uK.value = wK * 1.3 + rK * 0.3; palms.forEach((f) => { f.visible = wK + rK > 0.05; f.scale.setScalar(0.6 + wK); });
    skin.userData.u.uVeinGlow.value = (0.6 + 0.5 * ph + wK * 1.5 + rK) * (1 - sK * 0.7) + 0.3 * Math.sin(t * 2.3);
    horn.userData.u.uGlow.value = ph >= 3 ? 0.4 + 0.3 * Math.sin(t * 4) : 0; setBrillo(eyeM, (2 + wK * 2 + rK * 3) * (1 - sK * 0.7));
    smoke.userData.u.uFlut.value = 0.12 + wK * 0.08; poncho.userData.u.uWind.value.set(0, 0.06 * wK, -0.1 * (wK + rK));
    core.set((1.2 + wK * 0.8 + rK * 1.2 + sK * 1.5 + flinch * 0.5), t, dt);
    embers.material.uniforms.uK.value = (0.6 + 0.2 * ph) * (1 - sK * 0.6);
    // haz del rayo: desde la boca hacia st.a, crece mientras carga
    head.updateMatrixWorld(true); mp.set(hp.x, hp.y + 0.0, hp.z + 0.2).applyMatrix4(m4.copy(group.matrixWorld).invert().multiply(head.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(-hp.x, -hp.y, -hp.z)));
    beam.visible = rK > 0.03; beam.position.copy(mp); beam.quaternion.setFromUnitVectors(new V3(0, 0, 1), aim); const bw = 0.03 + rK * 0.06 + Math.sin(t * 40) * 0.008; beam.scale.set(bw, bw, 4 + rK * 30); beamM.opacity = rK * 0.8;
    mouthGlow.position.copy(mp); mouthGlow.material.opacity = rK * 0.9 + wK * 0.3; mouthGlow.scale.setScalar(0.3 + rK * 0.6);
    // escudo: anillo de fuego girando
    ringF.material.uniforms.uK.value = st.sd ? 1 : 0; ringF.rotation.y = t * 0.6;
    tickAura(aura, st, t);
  } };
}
