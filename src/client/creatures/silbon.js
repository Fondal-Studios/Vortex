// EL SILBÓN (id interno «espiral», atractor) — alma en pena del llano: un hombre FLAQUÍSIMO Y ALTÍSIMO (casi el doble de una persona),
// brazos y piernas de palo, sombrero de ala ancha caído, ropa raída y al hombro un SACO DE HUESOS (los de su padre) que asoman y
// tintinean. Flota con los pies colgando en punta. Cuando el silbido se oye lejos, está cerca.
// AVISO ('charge', 0.8 s): echa la cabeza atrás y TOMA AIRE (el pecho se infla, ojos violetas, el saco brilla) → 'pull' (2.6 s): se
// inclina hacia el jugador con los labios fruncidos y SILBA: aros de sonido que se cierran hacia su boca y motas arrastradas hacia él
// (= te está tirando: alejate). NÚCLEO = luz violeta en el pecho hundido.
import { THREE, lod, clamp, lerp, smooth, Rig, humanoide, alcanzar, velo, carne, hueso, brillo, setBrillo, nucleo, motas, aro, sudario, ellipsoid, tube, spike, paint, skinRigid, skinChain, skinFn, calavera, setK, disposer, shieldAura, tickAura, Spring, dampTo, TAU, rng, joinUV } from './alma-kit.js';

export default function build(kit, color = 0x9a7bff) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const skin = carne({ vein: color, veinK: 0.3, veinGlow: 0.5, sssColor: 0xc0a0ff, rimColor: color, rim: 0.5, tex: 'skin', tile: 4, rough: 0.6 });
  const rags = velo(0x3a3044, { alpha: 1, rimColor: color, rim: 0.55, flutter: 0.06, speed: 2, weave: 1.2, emissiveLift: 0.04, iri: 0.7 });
  const sackM = velo(0x7a6448, { alpha: 1, rimColor: 0xffd0a0, rim: 0.3, flutter: 0.01, speed: 1, weave: 1.5, emissiveLift: 0.03, glow: 0, glowColor: color });
  const bone = hueso({ rimColor: color, rim: 0.5 });
  const eyeM = brillo(color, 2.4);
  const mats = [skin, rags, sackM, bone, eyeM];
  const rig = new Rig();
  const B = humanoide(rig, { H: 2.6, shoulder: 0.15, hip: 0.08, arm: [0.5, 0.48], armR: [0.03, 0.018], hand: 0.2, claw: 0.03, legs: true, leg: [0.68, 0.66], legR: [0.04, 0.022], matSkin: skin, hunch: 0.15, neckLen: 0.2, curl: 0.3,
    torso: (t) => lerp(0.08, 0.09, smooth(0, 0.3, t)) * (1 - 0.3 * Math.exp(-Math.pow((t - 0.42) / 0.1, 2))) + 0.02 * smooth(0.55, 0.78, t) - 0.05 * smooth(0.86, 1, t),
    torsoPaint: 0x5a5060, armPaint: 0x6a6070, legPaint: 0x40384a, handColor: 0x8a8090, footColor: 0x2a2028 });
  const { root, pelvis, spine, chest, neck, head, armL, armR, legL, legR, Y } = B;
  const hp = head.userData.rest;
  // cara chupada de calavera con piel, labios que se fruncen (hueso «lip»), ojos violeta
  const sk = calavera(0.09, { long: 1.2, seed: 31, bone: 0x8a7e90, dark: 0x0a0610 }); sk.cranium.translate(hp.x, hp.y + 0.07, hp.z + 0.02); rig.add(skin, skinRigid(sk.cranium, head));
  const lip = rig.bone(head, [hp.x, hp.y - 0.01, hp.z + 0.11], 'lip');
  sk.jaw.translate(hp.x, hp.y + 0.07, hp.z + 0.02); rig.add(skin, skinRigid(sk.jaw, head));
  const lips = new THREE.TorusGeometry(0.018, 0.009, 5, 10); lips.translate(hp.x, hp.y - 0.01, hp.z + 0.115); paint(lips, 0x4a2a3a); rig.add(skin, skinRigid(lips, lip));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.018, 0.013, 0.01); e.translate(hp.x + s * 0.031, hp.y + 0.075, hp.z + 0.095); rig.add(eyeM, skinRigid(e, head)); }
  // sombrero de ala ancha caída (llanero)
  { const hatY = hp.y + 0.16; const ring = new THREE.RingGeometry(0.1, 0.32, low ? 18 : 28, 2); ring.rotateX(-Math.PI / 2); const P = ring.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x); P.setY(i, -0.09 * smooth(0.12, 0.32, r) * (0.7 + 0.3 * Math.sin(a * 2 + 1))); } ring.computeVertexNormals(); ring.translate(hp.x, hatY, hp.z + 0.01); paint(ring, 0x201a24); setK(ring, (p) => 0.4 * smooth(0.15, 0.32, Math.hypot(p.x - hp.x, p.z - hp.z)));
    const crown = tube([[hp.x, hatY - 0.03, hp.z], [hp.x, hatY + 0.08, hp.z - 0.01], [hp.x, hatY + 0.13, hp.z - 0.02]], { rad: (t) => lerp(0.115, 0.09, t), seg: 3, sides: low ? 10 : 16 }); paint(crown, 0x18121c); setK(crown, 0);
    rig.add(rags, skinRigid(joinUV([ring, crown]), head)); }
  // ropa raída: camisa abierta, pantalón en jirones
  const shirt = sudario([[0, Y.neckY + 0.02, chest.userData.rest.z - 0.02], [0, Y.chestY, chest.userData.rest.z - 0.02], [0, Y.pelY + 0.05, 0], [0, Y.pelY - 0.15, 0]], { rad: (t) => lerp(0.1, 0.12, t), arc: [0.5, TAU - 0.5], up: [0, 0, 1], rows: 10, cols: 16, tatter: 0.5, seed: 4, color: 0x5a4a60, colorEnd: 0x2a2030, kStart: 0.05 });
  rig.add(rags, skinChain(shirt, [pelvis, spine, chest, neck], 0.1));
  for (const Lg of [legL, legR]) { const r = Lg.rest; const g = sudario([r.hp.toArray(), r.kn.toArray(), r.kn.clone().lerp(r.an, 0.6).toArray()], { rad: (t) => lerp(0.07, 0.06, t), rows: 10, cols: 10, tatter: 0.55, seed: 7 + Lg.side, up: [0, 0, 1], color: 0x2a2434, colorEnd: 0x14101a });
    rig.add(rags, skinChain(g, [Lg.hb, Lg.kb, Lg.fb], 0.06)); }
  // SACO DE HUESOS al hombro izquierdo (cuelga a la espalda), con huesos que asoman
  const sackB = rig.bone(chest, [0.12, Y.neckY - 0.1, -0.2], 'sack'), sackT = rig.bone(sackB, [0.16, Y.chestY - 0.25, -0.32], 'sack2');
  const sc = new V3(0.15, Y.chestY - 0.12, -0.3);
  const sack = ellipsoid([0.22, 0.3, 0.2], { w: low ? 12 : 18, h: low ? 10 : 14, noise: 0.22, seed: 6, pos: sc.toArray() }); paint(sack, (p) => new THREE.Color(0x8a7050).lerp(new THREE.Color(0x3a2a1a), smooth(sc.y + 0.2, sc.y - 0.3, p.y))); setK(sack, 0.15);
  rig.add(sackM, skinFn(sack, (p) => [[sackB, smooth(sc.y - 0.2, sc.y + 0.2, p.y)], [sackT, 1 - smooth(sc.y - 0.2, sc.y + 0.2, p.y)]]));
  const tie = tube([[0.04, Y.neckY - 0.02, 0.0], [0.1, Y.neckY + 0.02, -0.1], [0.14, sc.y + 0.28, -0.25]], { rad: 0.02, seg: 6, sides: 5 }); paint(tie, 0x5a4430); rig.add(sackM, skinRigid(tie, sackB));
  { const R = rng(3), parts = []; for (let i = 0; i < (low ? 4 : 7); i++) { const a = R() * TAU, d = new V3(Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4).normalize(); const st = sc.clone().add(new V3(Math.cos(a) * 0.08, 0.22, Math.sin(a) * 0.06)); const g = tube([st.toArray(), st.clone().addScaledVector(d, 0.2 + R() * 0.1).toArray()], { rad: (t) => 0.015 * (1 + 1.2 * Math.exp(-Math.pow((t - 1) / 0.12, 2)) + 1.2 * Math.exp(-Math.pow(t / 0.12, 2))), seg: 4, sides: 5 }); paint(g, 0xe0d4b8); parts.push(g); }
    const sk2 = calavera(0.06, { seed: 41 }); sk2.cranium.rotateZ(0.6); sk2.cranium.translate(sc.x + 0.1, sc.y + 0.26, sc.z + 0.05); parts.push(sk2.cranium);
    rig.add(bone, skinRigid(joinUV(parts), sackB)); }
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 0.82; rootObj.scale.setScalar(K); rootObj.position.y = -1.15;
  const core = nucleo(color, 0.065, { halo: 9 }); chest.add(core.object); core.object.position.set(0, -0.02, 0.09); mats.push(...core.mats);
  const rings = [0, 1, 2].map((i) => { const r = aro(color, { n: 3, dir: -1, speed: 1.6 + i * 0.3, vertical: true }); rootObj.add(r); mats.push(r.material); return r; });
  const pull = motas(36, { color: 0xd0c0ff, size: 0.05, modo: 'suck', box: [2.6, 1.8, 3.2], speed: 0.8, k: 0 }); rootObj.add(pull); mats.push(pull.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.6); aura.position.set(0, 1.3, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, pull.userData.geo]));
  // ── animación ──
  const cache = new Map(), sHy = new Spring(0, 30, 6), tgt = new V3(), look = new V3(0, 0, 1), mp = new V3(), m4 = new THREE.Matrix4();
  let chK = 0, pK = 0, prevHp = 1, flinch = 0, sw = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const charge = st.s === 'charge', pulling = st.s === 'pull', hurt = st.hp != null && st.hp < 0.35; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    chK = dampTo(chK, charge ? 1 : 0, charge ? 8 : 5, dt); pK = dampTo(pK, pulling ? 1 : 0, pulling ? 7 : 3, dt); const idle = Math.max(0, 1 - chK - pK); sw = Math.sin(t * 0.9 + st.id);
    // flota encorvado, se balancea como colgado; inhala (atrás) → silba (adelante)
    rootObj.position.y = -1.15 + Math.sin(t * 0.8 + st.id) * 0.06; rootObj.rotation.z = sw * 0.04;
    pelvis.rotation.x = 0.05 + pK * 0.25; spine.rotation.x = 0.15 * idle - 0.15 * chK + 0.2 * pK; chest.rotation.x = 0.2 * idle - 0.3 * chK + 0.2 * pK + flinch * 0.1;
    chest.scale.set(1 + chK * 0.18, 1 + chK * 0.1, 1 + chK * 0.25);
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    neck.rotation.y = sHy.step(dt, clamp(lx, -0.8, 0.8) * 0.5); neck.rotation.x = 0.35 * idle - 0.6 * chK - clamp(ly, -0.4, 0.4) * 0.4 * pK + 0.05 * pK; head.rotation.z = 0.25 * idle * Math.sin(t * 0.5) + pK * 0.2;
    lip.scale.setScalar(1 + pK * 0.6 + Math.sin(t * 30) * 0.08 * pK); lip.position.z = lip.userData.rest.z - head.userData.rest.z + pK * 0.015;
    // piernas colgando con las puntas abajo; brazos larguísimos colgando / uno sujeta el saco
    [legL, legR].forEach((Lg, i) => { tgt.set(Lg.side * 0.1, 0.05 + Math.sin(t * 0.9 + i * 2) * 0.05, -0.08 + Math.sin(t * 0.7 + i) * 0.08); alcanzar(Lg, root, tgt, new V3(0, 0, 1), cache); Lg.fb.rotation.x = 0.9; });
    tgt.set(0.18, Y.neckY - 0.15, -0.12); alcanzar(armL, root, tgt, new V3(0.6, -0.5, 0.4), cache); armL.fing.rotation.x = -1.0;
    tgt.set(-0.2, Y.pelY - 0.35 + Math.sin(t * 1.1) * 0.03, 0.15 + sw * 0.05); tgt.lerp(new V3(-0.1, Y.neckY - 0.1, 0.35), pK * 0.6 + chK * 0.3); alcanzar(armR, root, tgt, new V3(-0.8, -0.3, -0.5), cache); armR.fing.rotation.x = -0.5 + pK * 0.3;
    sackB.rotation.x = Math.sin(t * 1.3) * 0.05 + pK * Math.sin(t * 25) * 0.04; sackB.rotation.z = sw * 0.06;
    // silbido: aros que se cierran hacia la boca y motas arrastradas (AVISO = inhala con ojos y saco brillando)
    head.updateMatrixWorld(true); mp.set(hp.x, hp.y - 0.01, hp.z + 0.14).applyMatrix4(m4.copy(group.matrixWorld).invert().multiply(head.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(-hp.x, -hp.y, -hp.z)));
    rings.forEach((r, i) => { r.position.copy(mp).add(new V3(0, 0, 0.25 + i * 0.45)); r.userData.setK(pK * (1 - i * 0.2) + chK * 0.25 * (i === 0 ? 1 : 0)); r.scale.setScalar(0.2 + i * 0.25); });
    pull.position.copy(mp); pull.material.uniforms.uK.value = pK * 1.3;
    setBrillo(eyeM, 1.8 + chK * 3 + pK * 2); sackM.userData.u.uGlow.value = chK * 0.6 + pK * 0.3;
    core.set((1 + chK * 1.5 + pK * 0.8 + flinch * 0.5) * (hurt ? (Math.sin(t * 15) > 0 ? 1 : 0.5) : 1), t, dt);
    rags.userData.u.uWind.value.set(0, 0, 0.08 * pK); tickAura(aura, st, t);
  } };
}
