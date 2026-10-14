// LA VIUDA (id interno «obelisco», francotiradora) — figura de luto, alta e inmóvil: vestido negro de seda con miriñaque (campana ancha
// hasta el piso), corsé, cuello alto, PEINETA ALTA con MANTILLA de encaje negro que le tapa la cara (silueta inconfundible: un triángulo
// negro con una corona de peineta), rosario de hueso y guantes. Sólo dos ojos rojos brillan detrás del encaje.
// AVISO ('charge', 1.6 s): se levanta la mantilla, aparece la cara de calavera pálida, extiende el brazo señalando, los ojos arden y un
// HILO LÁSER rojo sale de sus ojos en la dirección de apuntado (st.a); los últimos 0.4 s el hilo se FIJA (más grueso y titilando) → disparo.
// NÚCLEO = broche-corazón rojo en el pecho.
import { THREE, lod, clamp, lerp, smooth, Rig, humanoide, alcanzar, velo, carne, hueso, brillo, setBrillo, nucleo, motas, sudario, calavera, tube, spike, paint, ellipsoid, skinRigid, skinChain, skinFn, setK, disposer, shieldAura, tickAura, Spring, dampTo, TAU, joinUV } from './alma-kit.js';

export default function build(kit, color = 0xff2a5a) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const silk = velo(0x0a080c, { alpha: 1, rimColor: 0x9a6aff, rim: 0.8, rimPow: 2.6, flutter: 0.02, speed: 1, weave: 0.5, emissiveLift: 0.0, sheen: 1, rough: 0.35, iri: 0.9, iriSpd: 0.08 });
  const lace = velo(0x050406, { fresAlpha: false, alpha: 0.78, rimColor: color, rim: 0.7, flutter: 0.05, speed: 1.2, hem: 0.7, hemGlow: 0.3, weave: 1.4, iri: 0.6 });
  const bone = hueso({ rimColor: color, rim: 0.4 });
  const skin = carne({ vein: color, veinK: 0.1, veinGlow: 0.2, sssColor: 0xffd0d8, rimColor: color, tex: 'skin', tile: 3, rough: 0.4, clear: 0.6 });
  const eyeM = brillo(color, 2.2);
  const mats = [silk, lace, bone, skin, eyeM];
  const rig = new Rig();
  const B = humanoide(rig, { H: 2.1, shoulder: 0.15, hip: 0.1, arm: [0.3, 0.29], armR: [0.035, 0.022], hand: 0.17, legs: false, pelY: 1.0, matSkin: silk, matHand: silk, neckLen: 0.15, curl: 0.1,
    torso: (t) => lerp(0.11, 0.08, smooth(0, 0.35, t)) + 0.05 * smooth(0.45, 0.75, t) - 0.07 * smooth(0.85, 1, t), torsoPaint: 0x16121a, armPaint: 0x120e14, handColor: 0x1a1418 });
  const { root, pelvis, spine, chest, neck, head, armL, armR, Y } = B;
  const hp = head.userData.rest;
  // cara de calavera pálida (se ve al levantar la mantilla) + ojos rojos
  const sk = calavera(0.095, { long: 1.05, seed: 21, bone: 0xe8e0e4, dark: 0x100006 }); sk.cranium.translate(hp.x, hp.y + 0.08, hp.z + 0.02); rig.add(skin, skinRigid(sk.cranium, head)); sk.jaw.translate(hp.x, hp.y + 0.08, hp.z + 0.02); rig.add(skin, skinRigid(sk.jaw, head));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.02, 0.014, 0.01); e.translate(hp.x + s * 0.033, hp.y + 0.087, hp.z + 0.105); rig.add(eyeM, skinRigid(e, head)); }
  // cuello alto de encaje y PEINETA (abanico de carey con púas)
  const pe = [], pY = hp.y + 0.16, pZ = hp.z - 0.06;
  { const parts = []; for (let i = 0; i < (low ? 7 : 11); i++) { const a = -1.0 + (i / ((low ? 7 : 11) - 1)) * 2.0; const g = spike(0.018, 0.24 + 0.12 * Math.cos(a * 1.4), { sides: 4, seg: 2, pos: [Math.sin(a) * 0.06, pY, pZ], dir: [Math.sin(a) * 0.6, 1, -0.15] }); paint(g, 0x2a1420); parts.push(g); }
    const fan = new THREE.CircleGeometry(0.3, low ? 12 : 20, Math.PI * 0.18, Math.PI * 0.64); fan.translate(0, pY - 0.02, pZ - 0.005); paint(fan, (p) => new THREE.Color(0x3a1828).lerp(new THREE.Color(0x0a0408), 0.5 + 0.5 * Math.sin(Math.atan2(p.y - pY, p.x) * 22))); parts.push(fan);
    rig.add(silk, skinRigid(joinUV(parts), head)); }
  // MANTILLA: cae desde la peineta, tapa la cara (se levanta en el aviso) y llega a la cintura
  const mb = [rig.bone(head, [0, hp.y + 0.1, hp.z + 0.16], 'm0')]; mb.push(rig.bone(mb[0], [0, hp.y - 0.25, hp.z + 0.2], 'm1'));
  const veilFront = sudario([[0, pY + 0.12, pZ + 0.04], [0, hp.y + 0.15, hp.z + 0.14], [0, hp.y - 0.05, hp.z + 0.18], [0, hp.y - 0.4, hp.z + 0.2]], { rad: (t) => lerp(0.08, 0.17, smooth(0, 1, t)), arc: [-1.7, 1.7], up: [0, 0, 1], rows: 10, cols: 14, tatter: 0.2, seed: 9, color: 0x1a1018, kStart: 0.1 });
  rig.add(lace, skinFn(veilFront, (p) => { const k = smooth(hp.y + 0.2, hp.y - 0.15, p.y); return [[head, 1 - k], [mb[0], k * 0.6], [mb[1], k * 0.4]]; }));
  const back = sudario([[0, pY + 0.12, pZ + 0.0], [0, hp.y + 0.05, hp.z - 0.14], [0, hp.y - 0.35, hp.z - 0.26], [0, Y.pelY - 0.1, hp.z - 0.32]], { rad: (t) => lerp(0.1, 0.32, smooth(0, 1, t)), arc: [1.3, 4.98], up: [0, 0, 1], rows: 12, cols: 18, tatter: 0.3, seed: 4, color: 0x140c12, fold: 0.15 });
  rig.add(lace, skinFn(back, (p) => [[head, smooth(hp.y - 0.15, hp.y + 0.05, p.y)], [chest, 1 - smooth(hp.y - 0.15, hp.y + 0.05, p.y)]]));
  // miriñaque: vestido acampanado hasta el piso con volados
  const pl = pelvis.userData.rest, db = [rig.bone(pelvis, [0, 0.5, 0], 'd0')];
  const dress = sudario([[0, Y.chestY - 0.05, 0.0], [0, pl.y + 0.02, 0.0], [0, pl.y - 0.3, 0.0], [0, 0.0, 0.0]], { rad: (t) => 0.1 + 0.42 * smooth(0.2, 1, t) * (0.9 + 0.1 * Math.sin(t * 30)), rows: 16, cols: low ? 22 : 30, tatter: 0.12, seed: 3, color: 0x120e14, colorEnd: 0x0a080c, fold: 0.1, folds: 12 });
  rig.add(silk, skinChain(dress, [chest, pelvis, ...db], 0.12));
  // rosario de hueso colgando del cinto
  { const beads = []; for (let i = 0; i < (low ? 10 : 18); i++) { const k = i / ((low ? 10 : 18) - 1), x = 0.07 + Math.sin(k * 3) * 0.05, y = pl.y - 0.02 - k * 0.45, z = 0.24 + Math.sin(k * 2.2) * 0.05; const g = new THREE.SphereGeometry(0.014, 6, 4); g.translate(x, y, z); paint(g, 0xe8dcc8); beads.push(g); }
    const cr = tube([[0.08, pl.y - 0.5, 0.28], [0.08, pl.y - 0.6, 0.28]], { rad: 0.01, seg: 1, sides: 4 }); const cr2 = tube([[0.05, pl.y - 0.53, 0.28], [0.11, pl.y - 0.53, 0.28]], { rad: 0.01, seg: 1, sides: 4 }); paint(cr, 0xe8dcc8); paint(cr2, 0xe8dcc8); beads.push(cr, cr2);
    rig.add(bone, skinRigid(joinUV(beads), pelvis)); }
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 1.0; rootObj.scale.setScalar(K); rootObj.position.y = -0.92;
  const core = nucleo(color, 0.06, { halo: 9 }); chest.add(core.object); core.object.position.set(0, -0.02, 0.12); mats.push(...core.mats);
  // hilo láser de apuntado
  const laserM = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); laserM.userData.u = { uHurt: { value: 0 } };
  const laserG = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); laserG.translate(0, 0.5, 0); laserG.rotateX(Math.PI / 2);
  const laser = new THREE.Mesh(laserG, laserM); laser.frustumCulled = false; laser.renderOrder = 6; laser.visible = false; laser.userData.noBox = true; rootObj.add(laser); mats.push(laserM);
  const dust = motas(16, { color, size: 0.04, modo: 'rise', box: [0.9, 1.6, 0.9], speed: 0.15, k: 0.4 }); dust.position.y = 0.9; rootObj.add(dust); mats.push(dust.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.35); aura.position.set(0, 1.0, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, laserG, dust.userData.geo]));
  // ── animación ──
  const cache = new Map(), sHy = new Spring(0, 30, 7), tgt = new V3(), look = new V3(0, 0, 1), aim = new V3(0, 0, 1), eyeP = new V3(), qi = new THREE.Quaternion(), m4 = new THREE.Matrix4();
  let chK = 0, chT = 0, prevHp = 1, flinch = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const ch = st.s === 'charge', hurt = st.hp != null && st.hp < 0.35; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    chK = dampTo(chK, ch ? 1 : 0, ch ? 8 : 4, dt); chT = ch ? chT + dt : 0; const lock = ch && chT > 1.2, idle = 1 - chK;
    // dirección de apuntado en espacio local (st.a viene en el mundo); si no hay, mira a la cámara
    if (st.a) { rootObj.updateWorldMatrix(true, false); rootObj.getWorldQuaternion(qi).invert(); aim.set(st.a[0], st.a[1], st.a[2]).applyQuaternion(qi).normalize(); } else aim.copy(look);
    // inmóvil: sólo respira y la tela apenas se mueve; al apuntar se yergue y gira el torso
    pelvis.rotation.y = 0; spine.rotation.x = 0.02 + Math.sin(t * 1.1 + st.id) * 0.01; chest.rotation.x = -0.04 - 0.05 * chK;
    chest.rotation.y = clamp(Math.atan2(aim.x, aim.z), -0.6, 0.6) * 0.3 * chK;
    const lx = Math.atan2((chK > 0.3 ? aim : look).x, Math.max(0.2, (chK > 0.3 ? aim : look).z)), ly = Math.asin(clamp((chK > 0.3 ? aim : look).y, -1, 1));
    neck.rotation.y = sHy.step(dt, clamp(lx, -0.8, 0.8) * 0.55); neck.rotation.x = 0.15 * idle - clamp(ly, -0.5, 0.5) * 0.6 * chK; head.rotation.z = Math.sin(t * 0.5) * 0.04 * idle;
    // mantilla: se levanta y cae hacia atrás
    mb[0].rotation.x = -chK * 1.9 + Math.sin(t * 1.3) * 0.03; mb[1].rotation.x = -chK * 0.8;
    // brazos: manos juntas sobre el vientre (rezo) ↔ brazo derecho extendido señalando la mira
    tgt.set(0.04, Y.pelY + 0.18, 0.2); alcanzar(armL, root, tgt, new V3(0.8, -0.3, -0.4), cache); armL.fing.rotation.x = -0.6;
    tgt.set(-0.04, Y.pelY + 0.15, 0.2); const point = new V3(-0.15, Y.neckY - 0.05, 0.1).addScaledVector(aim, 0.6); tgt.lerp(point, chK);
    alcanzar(armR, root, tgt, new V3(-0.8, -0.4, -0.3), cache); armR.fing.rotation.x = -0.6 * idle + 0.2 * chK;
    // láser: de los ojos hacia la mira (fijado = grueso y titila)
    head.updateMatrixWorld(true); eyeP.set(hp.x, hp.y + 0.087, hp.z + 0.11).applyMatrix4(m4.copy(group.matrixWorld).invert().multiply(head.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(-hp.x, -hp.y, -hp.z)));
    laser.visible = chK > 0.05; laser.position.copy(eyeP); laser.quaternion.setFromUnitVectors(new V3(0, 0, 1), aim); const w = lock ? 0.022 + 0.01 * Math.sin(t * 60) : 0.008; laser.scale.set(w, w, 40);
    laserM.opacity = chK * (lock ? 0.95 : 0.45 + 0.2 * Math.sin(t * 25));
    setBrillo(eyeM, 1.5 + chK * 3 + (lock ? 2 : 0)); core.set((1 + chK * 1.2 + flinch * 0.5) * (hurt ? (Math.sin(t * 15) > 0 ? 1 : 0.5) : 1), t, dt);
    lace.userData.u.uRim.value = 0.7 + chK * 1.2; dust.material.uniforms.uK.value = 0.35 + chK * 0.6;
    tickAura(aura, st, t);
  } };
}
