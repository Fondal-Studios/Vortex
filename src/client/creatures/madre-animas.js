// LA MADRE DE LAS ÁNIMAS (id interno «madre», jefe 2) — una madre colosal que pare almas. Cara de porcelana serena con cuencas de luz y
// lágrimas, una CORONA DE ÁNIMAS (llamitas celestes) girando sobre la cabeza, un velo inmenso, mangas-alas larguísimas, una falda de
// PÉTALOS de tela y, en el vientre, un ÚTERO DE LUZ translúcido donde se ven almitas (calaveritas) girando = el NÚCLEO / punto débil.
// 'fire' (cerrada) = se abraza el vientre: brazos cruzados y alas-mangas envolviendo el útero como un capullo (casi no se ve la luz)
// 'vent' = tiembla, el abrazo se afloja a medias y sale vapor de luz (alguien sostiene las válvulas) · 'open' = abre los brazos y las alas
// al cielo, echa la cabeza atrás, los pétalos se abren y el útero brilla al máximo (= ventana de daño) · 'gestate' = contracciones.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { THREE, lod, clamp, lerp, smooth, Rig, humanoide, alcanzar, velo, carne, hueso, brillo, setBrillo, nucleo, motas, fuego, llamas, sudario, cara, calavera, ellipsoid, paint, skinRigid, skinChain, skinFn, setK, disposer, shieldAura, tickAura, Spring, dampTo, TAU, rng } from './alma-kit.js';

export default function build(kit, color = 0xbfe8ff) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const skin = carne({ vein: 0x9fe8ff, veinK: 0.2, veinGlow: 0.6, sss: 0.8, sssColor: 0xbfe8ff, rimColor: 0xb07bff, rim: 0.6, tex: 'skin', tile: 2.5, rough: 0.3, clear: 0.8 });
  const veil = velo(0xe8f0ff, { alpha: 0.7, rimColor: 0xb07bff, rim: 1.4, flutter: 0.06, speed: 1.2, hem: 0.6, hemGlow: 1.0, iri: 0.9, iriSpd: 0.07 });
  const petal = velo(0x6a4ab0, { alpha: 0.85, rimColor: 0x9fe8ff, rim: 1.2, flutter: 0.05, speed: 1.0, hem: 0.55, hemGlow: 1.2, iri: 1.0, iriSpd: 0.1 });
  const womb = velo(0xffe0f0, { alpha: 0.4, rimColor: 0xff9ad8, rim: 2.0, rimPow: 1.6, flutter: 0.0, hem: 1, hemGlow: 0, weave: 0, glow: 0.1, glowColor: 0xff9ad8, iri: 1 });
  const bone = hueso({ rimColor: color, rim: 0.8, sss: 0.6, sssColor: color });
  const soulFire = fuego(0x3a8aff, 0xe0f8ff, { k: 0.9, speed: 1.2, wob: 0.15 }), tearM = brillo(color, 2.2);
  const mats = [skin, veil, petal, womb, bone, soulFire, tearM];
  const rig = new Rig();
  const B = humanoide(rig, { H: 2.3, shoulder: 0.26, hip: 0.18, arm: [0.5, 0.48], armR: [0.07, 0.04], hand: 0.24, legs: false, pelY: 0.95, matSkin: skin, neckLen: 0.16, curl: 0.2,
    torso: (t) => lerp(0.2, 0.15, smooth(0, 0.45, t)) + 0.06 * smooth(0.5, 0.75, t) - 0.08 * smooth(0.86, 1, t), torsoEx: [1.1, 0.8], torsoPaint: (p) => new THREE.Color(0x7a80b0).lerp(new THREE.Color(0x40306a), smooth(1.8, 1.0, p.y)), armPaint: 0x7a7ab0, handColor: 0x9a9ac8 });
  const { root, pelvis, spine, chest, neck, head, armL, armR, Y } = B;
  const hp = head.userData.rest;
  const fg = cara(0.14, { skin: 0xc8c4e0, socket: 0x10142a, lips: 0x9a7a9a, gaunt: 0.1 }); fg.translate(hp.x, hp.y + 0.1, hp.z + 0.02); rig.add(skin, skinRigid(fg, head));
  for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.004, 0.006, 0.14, 4); g.translate(hp.x + s * 0.047, hp.y + 0.06, hp.z + 0.135); rig.add(tearM, skinRigid(g, head)); const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.02, 0.012, 0.008); e.translate(hp.x + s * 0.047, hp.y + 0.125, hp.z + 0.13); rig.add(tearM, skinRigid(e, head)); }
  // velo de la cabeza hasta el piso por detrás
  const vb = [rig.bone(head, [0, hp.y - 0.2, hp.z - 0.3], 'v0')]; vb.push(rig.bone(vb[0], [0, hp.y - 1.0, hp.z - 0.5], 'v1')); vb.push(rig.bone(vb[1], [0, -0.4, hp.z - 0.6], 'v2'));
  const vg = sudario([[0, hp.y + 0.3, hp.z + 0.02], [0, hp.y + 0.15, hp.z - 0.2], [0, hp.y - 0.4, hp.z - 0.4], [0, Y.pelY - 0.3, hp.z - 0.55], [0, -0.5, hp.z - 0.62]], { rad: (t) => lerp(0.19, 0.75, smooth(0, 1, t)), arc: [-2.3, 2.3], up: [0, 0.3, 1], rows: 18, cols: low ? 22 : 30, tatter: 0.3, seed: 3, color: 0xffffff, colorEnd: 0xb0c8ff, fold: 0.12, folds: 9 });
  rig.add(veil, skinChain(vg, [head, ...vb], 0.15));
  // mangas-alas: tela enorme que cuelga de cada brazo (envuelven el vientre / se abren como alas)
  [armL, armR].forEach((A, k) => { const r = A.rest, s = A.side, ext = r.wr.clone().add(new V3(s * 0.05, -0.6, 0.0));
    const g = sudario([r.sh.toArray(), r.el.toArray(), r.wr.toArray(), ext.toArray()], { rad: (t) => lerp(0.1, 0.55, smooth(0.0, 1, t)), arc: [s > 0 ? -0.2 : 0.2 - Math.PI, s > 0 ? Math.PI - 0.2 : 0.2], up: [0, 0, 1], rows: 14, cols: 14, tatter: 0.45, seed: 9 + k, color: 0xf0f4ff, colorEnd: 0x9a80ff });
    rig.add(veil, skinChain(g, [A.cl, A.up, A.fo, A.hand], 0.1)); });
  // falda de pétalos (8) que cuelgan de la cintura; cada pétalo con su hueso para abrirse
  const petals = [], NP = low ? 6 : 8;
  for (let i = 0; i < NP; i++) { const a = (i / NP) * TAU + 0.2, dx = Math.sin(a), dz = Math.cos(a), pb = rig.bone(pelvis, [dx * 0.2, Y.pelY - 0.05, dz * 0.16], 'pt' + i);
    const g = sudario([[dx * 0.2, Y.pelY - 0.02, dz * 0.16], [dx * 0.35, Y.pelY - 0.4, dz * 0.3], [dx * 0.45, Y.pelY - 0.9, dz * 0.38], [dx * 0.42, Y.pelY - 1.4, dz * 0.36]], { rad: (t) => 0.2 * Math.sin(Math.PI * (0.15 + 0.75 * t)), arc: [-1.4, 1.4], up: [dx, 0, dz], rows: 10, cols: 8, tatter: 0.35, seed: 20 + i, color: 0x8a6ad0, colorEnd: 0x2a1a60, kStart: 0.05 });
    rig.add(petal, skinRigid(g, pb)); petals.push({ pb, a }); }
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 0.72; rootObj.scale.setScalar(K); rootObj.position.y = -0.85;
  // útero de luz con almitas adentro (cuelga de la pelvis, al frente)
  const wombG = new THREE.Group(); wombG.position.set(0, Y.pelY + 0.12, 0.22).sub(pelvis.userData.rest); pelvis.add(wombG);
  const wg = ellipsoid([0.38, 0.42, 0.36], { w: low ? 16 : 24, h: low ? 12 : 18, noise: 0.06, seed: 2 }); paint(wg, 0xffffff); setK(wg, 0);
  const wombMesh = new THREE.Mesh(wg, womb); wombMesh.renderOrder = 4; wombG.add(wombMesh);
  const babies = new THREE.Group(); wombG.add(babies);
  { const parts = []; for (let i = 0; i < 3; i++) { const sk = calavera(0.05, { seed: 60 + i, bone: 0xe8f0ff, dark: 0x203050 }); const a = (i / 3) * TAU; sk.cranium.rotateY(a + Math.PI / 2); sk.cranium.translate(Math.cos(a) * 0.14, (i - 1) * 0.08, Math.sin(a) * 0.12); parts.push(sk.cranium.toNonIndexed()); }
    babies.add(new THREE.Mesh(mergeGeometries(parts, false), bone)); }
  const core = nucleo(0xff9ad8, 0.16, { halo: 7 }); wombG.add(core.object); mats.push(...core.mats);
  const souls = motas(30, { color: 0xbfe8ff, size: 0.05, modo: 'orbit', box: [0.22, 0.4, 0.22], speed: 0.6 }); wombG.add(souls); mats.push(souls.material);
  const outS = motas(40, { color: 0xffc8f0, size: 0.07, modo: 'burst', box: [2.4, 2.4, 2.4], speed: 0.6, k: 0 }); wombG.add(outS); mats.push(outS.material);
  const steam = motas(36, { color: 0xe0f0ff, size: 0.07, modo: 'rise', box: [1.4, 1.8, 0.8], speed: 0.8, k: 0 }); steam.position.y = Y.chestY; rootObj.add(steam); mats.push(steam.material);
  // corona de ánimas sobre la cabeza
  const crown = new THREE.Group(); crown.position.set(0, hp.y + 0.38, hp.z - 0.04).sub(head.userData.rest); head.add(crown);
  crown.add(llamas(soulFire, Array.from({ length: low ? 7 : 11 }, (_, i) => { const a = (i / (low ? 7 : 11)) * TAU; return { pos: [Math.cos(a) * 0.28, Math.sin(i * 1.7) * 0.03, Math.sin(a) * 0.28], w: 0.07, h: 0.22 }; })));
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.6); aura.position.set(0, 1.2, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, wg, babies.children[0].geometry, souls.userData.geo, outS.userData.geo, steam.userData.geo]));
  // ── animación ──
  const cache = new Map(), tgt = new V3(), look = new V3(0, 0, 1), sHy = new Spring(0, 15, 5);
  let oK = 0, vK = 0, gK = 0, prevHp = 1, flinch = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const open = st.s === 'open' || !!st.o, vent = st.s === 'vent', gest = st.s === 'gestate', hp01 = st.hp == null ? 1 : st.hp, ph = hp01 > 0.66 ? 1 : hp01 > 0.33 ? 2 : 3; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.002) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 3);
    oK = dampTo(oK, open ? 1 : 0, open ? 3 : 2, dt); vK = dampTo(vK, vent ? 1 : 0, 5, dt); gK = dampTo(gK, gest ? 1 : 0, 5, dt);
    const half = Math.max(oK, vK * 0.45), closed = 1 - half, tremble = vK * Math.sin(t * 37) * 0.02 + gK * Math.sin(t * 9) * 0.04;
    // cuerpo: encorvada abrazando ↔ erguida con la cabeza al cielo
    rootObj.position.y = -0.85 + Math.sin(t * 0.6) * 0.04;
    spine.rotation.x = 0.25 * closed - 0.2 * oK + tremble + gK * 0.15 * Math.max(0, Math.sin(t * 6)); chest.rotation.x = 0.2 * closed - 0.25 * oK + tremble + flinch * 0.06;
    chest.scale.setScalar(1 + Math.sin(t * 0.9) * 0.015);
    neck.rotation.y = sHy.step(dt, clamp(Math.atan2(look.x, Math.max(0.2, look.z)), -0.6, 0.6) * 0.4 * closed); neck.rotation.x = 0.45 * closed - 0.55 * oK + tremble; head.rotation.z = Math.sin(t * 0.4) * 0.06;
    // brazos: abrazo cruzado sobre el vientre ↔ abiertos en cruz hacia arriba
    [armL, armR].forEach((A, i) => { const s = A.side;
      tgt.set(-s * 0.12, Y.pelY + 0.15 + Math.sin(t * 0.8 + i) * 0.02, 0.48);
      tgt.lerp(new V3(s * 0.9, Y.H + 0.15, 0.25), half);
      alcanzar(A, root, tgt, new V3(s, -0.4, -0.5), cache); A.fing.rotation.x = -0.4 * closed + 0.3 * oK; });
    vb.forEach((b, i) => { b.rotation.x = Math.sin(t * 0.7 - i * 0.6) * 0.05 - oK * 0.15; });
    petals.forEach(({ pb, a }, i) => { const o = oK * 0.9 + vK * 0.25 + Math.sin(t * 1.2 + i) * 0.04; pb.rotation.set(Math.cos(a) * o * 0.9, 0, -Math.sin(a) * o * 0.9); });
    veil.userData.u.uWind.value.set(0, 0.08 * oK, -0.15 * oK); veil.userData.u.uFlut.value = 0.06 + vK * 0.1 + oK * 0.04;
    // útero / núcleo / almas
    const pulse = 1 + gK * 0.12 * Math.max(0, Math.sin(t * 6)) + Math.sin(t * 1.8) * 0.03; wombG.scale.setScalar(pulse * (1 + oK * 0.12));
    babies.rotation.y = t * 0.5; babies.rotation.x = Math.sin(t * 0.4) * 0.3;
    womb.userData.u.uRim.value = 1.2 + oK * 1.6 + vK; womb.userData.u.uGlow.value = 0.1 + oK * 0.5;
    core.set(0.35 + oK * 2.2 + vK * 0.6 + gK * 0.8 + flinch * 0.4, t, dt);
    souls.material.uniforms.uK.value = 0.6 + oK; outS.material.uniforms.uK.value = oK * 1.2 + gK * 0.8; steam.material.uniforms.uK.value = vK * 1.3 + oK * 0.3;
    crown.rotation.y = t * (0.6 + 0.6 * closed + ph * 0.2); soulFire.uniforms.uK.value = 0.8 + 0.2 * ph + oK * 0.5;
    setBrillo(tearM, 1.8 + oK * 1.5);
    tickAura(aura, st, t);
  } };
}
