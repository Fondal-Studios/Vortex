// OBELISCO — francotirador estacionario. Planta-escorpión biológico: un tallo de vértebras de carne que respira, anclado por
// raíces y patas; en la cima una flor-ojo (pétalos de hueso) con un gran ojo húmedo y párpados; cola con aguijón de biocristal.
// Aviso del disparo (charge 1.6 s): los pétalos se abren, la pupila se enfoca y el cristal del ojo se calienta; un rayo láser
// fino traza al jugador y se fija (más grueso, blanco-rojo) los últimos 0.4 s; al disparar hay retroceso.
import { cfg } from '../quality.js';
import { bigEye, beamMesh, glowMat, glowSphere, softDot, clamp, lerp, damp } from './obelisco-lib.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, horn, crystalSpike, tentacle, leg, Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const skin = fleshMaterial({ color: 0x8a4170, vein: 0x2b0a3d, spot: color, glow: 0.1, wobble: 0.018, breath: 0.025, spots: 0.9, veins: 0.8, iri: 0.5, rough: 0.38 });
  const skinD = fleshMaterial({ color: 0x4d2150, vein: 0x180626, spot: color, glow: 0.05, wobble: 0.01, breath: 0.015, spots: 0.5, veins: 0.7, rough: 0.5 });
  const bone = boneMaterial(0xe9dcc4, { rough: 0.3, glow: 0.04 }), crystal = bioCrystalMaterial(color, { glow: 0.9 }), fang = boneMaterial(0xf6f0e2);
  const root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(0.78); body.position.y = -1.0; root.add(body); // origen = centro de la esfera de colisión: el suelo queda en y=-1

  /* ── base: montículo de carne, raíces que reptan y patas ancla ── */
  const mound = blob(skinD, 0.75, 1.15, 0.32, 1.15); mound.position.y = 0.05; body.add(mound);
  const roots = []; const nr = LOW ? 4 : 6;
  for (let i = 0; i < nr; i++) {
    const a = (i / nr) * Math.PI * 2 + 0.4, t = tentacle(skinD, { len: 1.5, r0: 0.17, r1: 0.025, hang: false, amp: 0.06, speed: 1.1 + i * 0.1, freq: 2.2, phase: i * 1.7 });
    const pv = new THREE.Group(); pv.position.set(Math.sin(a) * 0.4, 0.32, Math.cos(a) * 0.4); pv.rotation.y = a;
    pv.add(t); t.rotation.x = 1.78 + (i % 2) * 0.12; body.add(pv); roots.push({ pv, t, a }); // x+ gira Y→Z: sale hacia fuera y apenas hacia abajo
  }
  const legs = [];
  if (!LOW) {
    const n = HI ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 2.2 + (n === 2 ? 0.5 : 0), l = leg(skinD, { upper: 0.8, lower: 0.95, r: 0.12 });
      l.object.position.set(Math.sin(a) * 0.5, 0.8, Math.cos(a) * 0.5); l.setBend(new THREE.Vector3(Math.sin(a) * 0.8, 1, Math.cos(a) * 0.8)); body.add(l.object);
      legs.push({ l, foot: new THREE.Vector3(Math.sin(a) * 1.0, -0.78, Math.cos(a) * 1.0), ph: i * 2.1, a });
    }
  }

  /* ── tallo: vértebras de carne encadenadas (cada una hereda la inclinación de la anterior) ── */
  const NS = 4, segs = []; let parent = body, y0 = 0.28; const segLen = 0.52, rad = [0.55, 0.43, 0.34, 0.28];
  for (let i = 0; i < NS; i++) {
    const g = new THREE.Group(); g.position.y = i === 0 ? y0 : segLen; parent.add(g);
    const b = blob(skin, rad[i], 1, (segLen * 0.78) / rad[i], 1); b.position.y = segLen * 0.5; g.add(b);
    if (!LOW && i % 2 === 0) { const ring = new THREE.Mesh(new THREE.TorusGeometry(rad[i] * 0.98, 0.04, 6, 14), bone); ring.rotation.x = Math.PI / 2; ring.position.y = segLen * 0.02; g.add(ring); }
    // espinas de hueso en la espalda de cada vértebra + cristal que brota
    if (i < 3 || !LOW) { const sp = horn(bone, 0.075, 0.34 - i * 0.04, 5); sp.position.set(0, segLen * 0.5, -rad[i] * 0.85); sp.rotation.x = -0.9; g.add(sp); }
    segs.push(g); parent = g;
  }
  const dorsal = []; // cristales que brotan del lomo y crecen cuando pierde vida
  for (let i = 0; i < (LOW ? 3 : 5); i++) { const c = horn(crystal, 0.07, 0.4, 6); const sg = segs[Math.min(NS - 1, i % NS)]; c.position.set((i % 2 ? 1 : -1) * 0.2, segLen * 0.45, -0.18 - i * 0.02); c.rotation.set(-0.5, 0, (i % 2 ? -1 : 1) * 0.7); sg.add(c); dorsal.push(c); }

  /* ── cabeza: flor-ojo ── */
  const head = new THREE.Group(); head.position.y = segLen * 0.95; segs[NS - 1].add(head);
  const collar = blob(skin, 0.5, 1, 0.7, 0.9); collar.position.set(0, 0.1, -0.12); head.add(collar);
  const eyeRoot = new THREE.Group(); eyeRoot.position.set(0, 0.34, 0.12); head.add(eyeRoot);
  const R = 0.6;
  const E = bigEye({ r: R, iris: color, quality: level, lidSkin: skin }); eyeRoot.add(E.object);
  const lensPt = new THREE.Object3D(); lensPt.position.z = R * 1.1; E.ball.add(lensPt);
  // pétalos de hueso (se abren al apuntar)
  const NP = LOW ? 5 : HI ? 8 : 7, petals = [];
  const petalRing = new THREE.Group(); petalRing.position.copy(eyeRoot.position); petalRing.position.z -= 0.06; head.add(petalRing);
  for (let i = 0; i < NP; i++) {
    const ang = (i / NP) * Math.PI * 2, h1 = new THREE.Group(); h1.rotation.z = ang; petalRing.add(h1);
    const h2 = new THREE.Group(); h2.position.y = 0.56; h1.add(h2);
    const p = horn(i % 2 ? bone : fang, 0.24, 1.05, 5); p.scale.z = 0.22; h2.add(p); // pétalo plano y puntiagudo
    const tipc = horn(crystal, 0.06, 0.28, 5); tipc.position.y = 0.62; tipc.scale.z = 0.6; h2.add(tipc);
    petals.push({ h2, p, i, off: (i * 2.4) % 6.28 });
  }
  const glowM = new THREE.SpriteMaterial({ map: softDot(), color: 0xffc060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), halo = new THREE.Sprite(glowM); eyeRoot.add(halo);
  const coreM = glowMat(0xffffff, 0.0), core = glowSphere(coreM, R * 0.2); core.position.z = R * 1.03; E.ball.add(core);
  const feel = [];
  if (!LOW) for (const s of [-1, 1]) { const t = tentacle(skin, { len: 1.15, r0: 0.07, r1: 0.012, hang: true, amp: 0.2, speed: 2.0, freq: 3.3, phase: s * 2 }); t.position.set(s * 0.36, 0.1, 0.0); t.userData.s = s; head.add(t); feel.push(t); }
  const crown = []; for (let i = 0; i < (LOW ? 3 : 5); i++) { const a = (i / (LOW ? 3 : 5) - 0.5) * 2.0; const c = horn(crystal, 0.07, 0.55, 6); c.position.set(Math.sin(a) * 0.3, 0.55 + Math.cos(a) * 0.22, -0.2); c.rotation.set(-0.5, 0, -a * 0.9); head.add(c); crown.push(c); }

  /* ── cola con aguijón de biocristal ── */
  const NT = LOW ? 4 : 5, tail = [], CURL = [-0.95, 0.5, 0.45, 0.42, 0.38]; let tp = body; const tl = 0.46;
  const tailRoot = new THREE.Group(); tailRoot.position.set(0, 0.4, -0.62); body.add(tailRoot); tp = tailRoot;
  for (let i = 0; i < NT; i++) {
    const g = new THREE.Group(); g.position.y = i === 0 ? 0 : tl; tp.add(g); const r = 0.21 - i * 0.025;
    const b = blob(skin, r, 1, tl * 0.62 / r, 1); b.position.y = tl * 0.5; g.add(b); tail.push(g); tp = g;
  }
  const sting = crystalSpike(crystal, 0.085, 0.55); sting.position.y = tl * 0.9; sting.rotation.x = 0.0; tp.add(sting);
  const stingGlow = glowSphere(glowMat(color, 0.0), 0.2); stingGlow.position.y = tl * 1.0; tp.add(stingGlow);
  const barb = horn(fang, 0.04, 0.22, 5); barb.position.set(0, tl * 0.5, 0.1); barb.rotation.x = 1.2; tp.add(barb);

  /* ── láser ── */
  const beamM = glowMat(0xff3040, 0.0), beam = beamMesh(beamM); root.add(beam);
  const coreBeamM = glowMat(0xffffff, 0.0), coreBeam = beamMesh(coreBeamM); root.add(coreBeam);

  const mats = [skin, skinD, bone, crystal, fang, ...E.mats];
  const sYaw = new Spring(0, 40, 7), sPit = new Spring(0, 40, 7), sRec = new Spring(0, 160, 9), sTail = new Spring(0, 70, 6), sHit = new Spring(0, 120, 7);
  let ct = -1, wasCharge = false, open = 0, heat = 0, prevHp = 1, hit = 0, shotFlash = 0, lockedAim = null, lockAmt = 0, bt = 0;
  const aimTest = false; const aimW = new THREE.Vector3(), aimL = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), pa = new THREE.Vector3(), pb = new THREE.Vector3(), up = new THREE.Vector3(), col = new THREE.Color(), cA = new THREE.Color(0xffb040), cB = new THREE.Color(0xfff2d0), cR = new THREE.Color(0xff2a3a);
  const look0 = new THREE.Vector3(0, 0.1, 1);

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0, 0.05); bt += dt;
    const hp = st.hp == null ? 1 : st.hp, hurtLow = clamp((0.35 - hp) / 0.35, 0, 1), id = st.id || 0;
    const charging = st.s === 'charge';
    if (charging && !wasCharge) { ct = 0; lockedAim = null; }
    if (!charging && wasCharge) { shotFlash = 1; sRec.v -= 9; sTail.v += 6; ct = -1; }
    wasCharge = charging; if (charging) ct += dt;
    if (hp < prevHp - 0.001) { hit = 1; sHit.v += 7; } prevHp = hp; hit = Math.max(0, hit - dt * 3); shotFlash = Math.max(0, shotFlash - dt * 3);
    const e = charging ? ct : 0, k = charging ? clamp(e / 1.6, 0, 1) : 0, locked = charging && e > 1.2;
    const look = ctx.look || look0;
    // dirección de apuntado (en espacio local de root); mientras carga usa st.a (fija al final)
    root.updateWorldMatrix(true, false); root.getWorldQuaternion(qa); qa.invert();
    if (charging && st.a) { aimW.set(st.a[0] ?? st.a.x, st.a[1] ?? st.a.y, st.a[2] ?? st.a.z); aimL.copy(aimW).applyQuaternion(qa).normalize(); } else aimL.copy(look).normalize();
    if (aimTest && charging) aimL.set(0.9, 0.05, 0.4).normalize();
    if (locked) { if (!lockedAim) lockedAim = aimL.clone(); aimL.copy(lockedAim); }
    lockAmt = damp(lockAmt, locked ? 1 : 0, 14, dt);

    // respiración y estado general
    const breath = Math.sin(t * 1.9 + id) * 0.5 + 0.5, agit = hurtLow, tremble = (hurtLow * 0.012 + k * 0.01 + hit * 0.02);
    open = damp(open, charging ? 1 : 0, charging ? 3.5 : 4, dt); heat = damp(heat, k, 6, dt);
    // tallo: gira/se inclina hacia el objetivo, se encoge al recibir daño o al disparar, se arquea al cargar
    const yaw = Math.atan2(aimL.x, Math.max(0.15, aimL.z)), pit = Math.asin(clamp(aimL.y, -1, 1));
    const sy = sYaw.step(dt, clamp(yaw, -1.2, 1.2)), sp = sPit.step(dt, clamp(-pit, -0.6, 0.6)), rec = sRec.step(dt, 0), hv = sHit.step(dt, 0);
    for (let i = 0; i < NS; i++) {
      const s = segs[i], w = 1 - i * 0.12;
      s.rotation.y = sy * 0.25 * w + Math.sin(t * 0.7 + i) * 0.03; s.rotation.x = sp * 0.22 * w * (0.5 + 0.5 * (1 - open)) + (0.06 + hurtLow * 0.1) * (i === 0 ? 1 : 0.6) * Math.sin(1 + i) * 0 + (k * -0.07 + rec * 0.18 + hv * 0.12) + Math.sin(t * 1.3 + i * 0.8 + id) * 0.025 + (hurtLow ? Math.sin(t * 9 + i) * 0.03 * agit : 0);
      s.rotation.z = Math.sin(t * 0.9 + i * 0.9 + id) * 0.025 + Math.sin(t * 31 + i) * tremble;
      s.scale.set(1 + (breath - 0.5) * 0.04, 1 + (breath - 0.5) * 0.03, 1 + (breath - 0.5) * 0.04);
    }
    // cabeza (cae un poco al estar herido) y ojo
    head.rotation.x = 0.05 + hurtLow * 0.35 + rec * 0.3 - k * 0.08; head.position.y = segLen * 0.95 + Math.sin(t * 1.9 + id) * 0.012;
    root.updateWorldMatrix(true, true);
    eyeRoot.getWorldQuaternion(qb); root.getWorldQuaternion(qa); qb.premultiply(qa.clone().invert()).invert(); // mundo-local→espacio del ojo
    up.copy(aimL).applyQuaternion(qb).normalize();
    const squint = locked ? 0.7 : charging ? 1.15 : 1;
    E.update(dt, up, { open: clamp((0.78 + 0.22 * Math.sin(t * 0.8 + id)) * squint * (1 - hit * 0.5) * (1 - hurtLow * 0.2) + k * 0.2, 0, 1), pupil: lerp(0.9, 0.18, heat) * (1 - hit * 0.1) + 0.08 * Math.sin(t * 2.3 + id), glow: 0.5 + heat * 1.1 + shotFlash * 1.2, hurt: skin.userData.u.uHurt.value, shake: hurtLow * 0.1 + k * 0.03, blinkRate: charging ? 0.2 : 1 + hurtLow });

    // pétalos: respiran, se abren al cargar, se cierran al ser herido
    for (const P of petals) { const a = lerp(1.05 - 0.15 * Math.sin(t * 1.9 + P.off), 0.12, open) + hit * 0.3 + Math.sin(t * 2.7 + P.off) * 0.04 + rec * 0.4; P.h2.rotation.x = a; P.p.scale.y = 0.95 * (1 + open * 0.15); }
    // calor del ojo: halo + núcleo aditivos
    col.copy(cA).lerp(cB, heat); if (lockAmt > 0.01) col.lerp(cR, lockAmt * 0.5);
    glowM.color.copy(col); glowM.opacity = (heat * 0.55 + shotFlash * 0.9) * (0.75 + 0.25 * Math.sin(t * (14 + heat * 40)));
    halo.scale.setScalar(R * (2.6 + heat * 1.2 + shotFlash * 2.2));
    coreM.opacity = clamp(heat * 1.2 + shotFlash, 0, 1); core.scale.setScalar(R * (0.05 + heat * 0.15 + shotFlash * 0.25) * (1 + 0.12 * Math.sin(t * 30)));
    // cola: se alza y apunta el aguijón al blanco
    const tw = sTail.step(dt, 0);
    tailRoot.rotation.y = sy * 0.5 * (0.4 + k) + Math.sin(t * 0.9 + id) * 0.12;
    for (let i = 0; i < NT; i++) { const g = tail[i];
      const curl = CURL[i] + (i === 0 ? k * 0.12 : k * 0.06);
      g.rotation.x = curl + (i === 0 ? 0.0 : 0) + tw * 0.25 + Math.sin(t * 1.6 + i * 0.7 + id) * 0.07 * (1 + hurtLow * 2);
      g.rotation.z = Math.sin(t * 1.1 + i * 0.5) * 0.05 + (hurtLow ? Math.sin(t * 8 + i) * 0.04 : 0); }
    const sg = stingGlow.material; sg.color.copy(col); sg.opacity = clamp(heat * 0.7 + shotFlash, 0, 1) * (0.7 + 0.3 * Math.sin(t * 25)); stingGlow.scale.setScalar(0.16 + heat * 0.25 + shotFlash * 0.2);
    crystal.userData.u.uGlow.value = 0.9 + 0.5 * Math.sin(t * 5) + heat * 2.5 + shotFlash * 3; crystal.emissiveIntensity = 0.9 + heat * 0.9 + shotFlash * 1 + 0.25 * Math.sin(t * 5);
    // piel: pulso y brillo creciente al cargar, jadea al estar herido
    const U = skin.userData.u; U.uPulse.value = heat * 0.5 + hurtLow * 0.3; U.uGlow.value = 0.1 + heat * 0.35 + shotFlash * 0.4;
    // cristales dorsales crecen con el daño
    dorsal.forEach((c, i) => { c.scale.y = (0.4 + 0.3 * (1 - hp)) * (1 + 0.5 * (1 - hp)) * (1 + 0.08 * Math.sin(t * 4 + i)); });
    crown.forEach((c, i) => { c.scale.y = 0.55 * (1 + 0.5 * open + 0.25 * (1 - hp)) * (1 + 0.06 * Math.sin(t * 3.4 + i)); });
    // raíces / patas: ancladas, agarran con fuerza al cargar y se crispan al daño
    for (const R2 of roots) { const u = R2.t.userData.u; u.uAmp.value = 0.06 + hit * 0.25 + hurtLow * 0.12 + k * 0.03; u.uSpeed.value = 1.1 + hurtLow * 3; R2.t.rotation.x = 1.78 + (roots.indexOf(R2) % 2) * 0.12 - k * 0.15 - hit * 0.1; }
    for (const L of legs) { pa.copy(L.foot); pa.y += Math.max(0, Math.sin(t * 0.5 + L.ph) * 0.0) + hit * 0.18 * Math.sin(L.ph * 2); pa.x *= 1 + k * 0.04 + rec * 0.05; pa.z *= 1 + k * 0.04; L.l.setFoot(pa); }
    mound.scale.y = 0.24 * (1 + (breath - 0.5) * 0.12);
    feel.forEach((f) => { const u = f.userData.u; u.uAmp.value = 0.2 + hit * 0.4 + k * 0.1; f.rotation.z = f.userData.s * (0.3 + open * 0.5 - hurtLow * 0.3); f.rotation.x = 0.1; });

    // láser: sale de la lente, traza el blanco; se fija y engrosa al final
    root.updateWorldMatrix(true, true);
    const on = charging && e > 0.12;
    if (on) {
      lensPt.getWorldPosition(pa); root.worldToLocal(pa);
      beam.position.copy(pa); coreBeam.position.copy(pa); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), aimL); coreBeam.quaternion.copy(beam.quaternion);
      const L = 70 / 0.78, flick = locked ? 1 : 0.55 + 0.45 * Math.sin(t * 60), w = locked ? 0.03 + Math.min(0.03, (e - 1.2) * 0.1) : 0.008 + k * 0.01;
      beam.scale.set(w * (locked ? 2.6 : 1.6), w * (locked ? 2.6 : 1.6), L); coreBeam.scale.set(w * 0.8, w * 0.8, L);
      beamM.color.copy(cA).lerp(cR, clamp(k * 1.2, 0, 1)); beamM.opacity = (locked ? 0.7 : 0.22 + k * 0.2) * flick; coreBeamM.opacity = locked ? 0.95 : 0.3 * flick;
      beam.visible = coreBeam.visible = true;
    } else beam.visible = coreBeam.visible = false;
  } };
}
