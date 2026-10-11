// ARIETE — embestidor. Bestia-escarabajo/rinoceronte acorazada: placas de quitina sobre carne musculosa, cuerno de biocristal enorme,
// 4 patas con IK y peso (los muslos se tensan al pisar), ojos húmedos con párpados, mandíbulas y vapor por los ollares.
// wind: se agacha, patea el suelo con las manos, la cabeza baja, brilla y resuella; charge: galope estirado; stun: se tambalea con
// pájaros-esquirla girando; hp<0.35: cojea y jadea.
import { cfg } from '../quality.js';
import { bigEye, softDot, clamp, lerp, damp } from './obelisco-lib.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, horn, crystalSpike, jaw, leg, tentacle, Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const skin = fleshMaterial({ color: 0x5e2434, vein: 0x240510, spot: color, glow: 0.08, wobble: 0.015, breath: 0.03, spots: 0.5, veins: 0.9, iri: 0.4, rough: 0.4, scale: 2.6 });
  const musc = fleshMaterial({ color: 0x74303c, vein: 0x300612, spot: color, glow: 0.05, wobble: 0.01, breath: 0.02, spots: 0.0, veins: 1.0, rough: 0.35, scale: 3.4 });
  const chit = boneMaterial(0x2d2238, { rough: 0.22 }), chit2 = boneMaterial(0x4a3358, { rough: 0.3 }), hornM = boneMaterial(0xeadfc6, { rough: 0.28 }), claw = boneMaterial(0xf2ead8);
  const crystal = bioCrystalMaterial(color, { glow: 1.0 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const GY = -1; // suelo

  /* ── tronco: abdomen, tórax musculoso, joroba ── */
  const abd = blob(skin, 0.62, 0.95, 0.85, 1.2); abd.position.set(0, 0.0, -0.78); body.add(abd);
  const thx = blob(musc, 0.7, 1, 0.82, 1.1); thx.position.set(0, 0.05, 0.12); body.add(thx);
  const hump = blob(skin, 0.5, 1, 0.55, 1); hump.position.set(0, 0.45, 0.2); body.add(hump);
  // placas de quitina solapadas sobre el lomo + cristales que brotan entre ellas
  const plates = [], zs = [0.62, 0.22, -0.2, -0.62, -1.02];
  zs.forEach((z, i) => { const p = blob(i % 2 ? chit2 : chit, 1, 0.66 - i * 0.04, 0.11, 0.3); p.position.set(0, 0.62 - Math.abs(z - 0.2) * 0.2 - i * 0.015, z); p.rotation.x = -0.25 + i * 0.08; body.add(p); plates.push(p);
    if (!LOW || i % 2 === 0) { const c = horn(crystal, 0.07, 0.34 - i * 0.03, 6); c.position.set((i % 2 ? 0.2 : -0.2), 0.7 - i * 0.03, z - 0.12); c.rotation.set(-0.6, 0, (i % 2 ? -0.4 : 0.4)); body.add(c); plates.push(c); c.userData.cry = 1; } });
  const shoulders = [-1, 1].map((s) => { const p = blob(chit, 0.42, 0.6, 0.9, 1.1); p.position.set(s * 0.72, 0.22, 0.45); p.rotation.z = -s * 0.5; body.add(p);
    const sp = horn(hornM, 0.1, 0.4, 5); sp.position.set(s * 0.95, 0.38, 0.5); sp.rotation.z = -s * 1.1; body.add(sp); return p; });
  const flank = [-1, 1].map((s) => { const p = blob(chit2, 0.5, 0.3, 0.55, 1.4); p.position.set(s * 0.62, -0.08, -0.62); body.add(p); return p; });
  const tail = new THREE.Group(); tail.position.set(0, -0.02, -1.55); body.add(tail);
  { const t0 = blob(skin, 0.25, 1, 1, 1.5); t0.position.z = -0.1; tail.add(t0); const t1 = horn(crystal, 0.12, 0.5, 6); t1.rotation.x = -Math.PI / 2 - 0.4; t1.position.set(0, 0.05, -0.2); tail.add(t1); }

  /* ── cabeza: cuerno-cristal, ojos, mandíbula, ollares ── */
  const head = new THREE.Group(); head.position.set(0, -0.02, 1.0); body.add(head);
  const skull = blob(skin, 0.46, 1, 0.82, 1.12); skull.position.set(0, 0, 0.1); head.add(skull);
  const snout = blob(musc, 0.3, 1, 0.75, 1.1); snout.position.set(0, -0.12, 0.5); head.add(snout);
  const brow = blob(chit, 0.5, 1, 0.22, 0.7); brow.position.set(0, 0.2, 0.2); brow.rotation.x = -0.25; head.add(brow);
  const hornBase = new THREE.Group(); hornBase.position.set(0, 0.08, 0.5); hornBase.rotation.x = 1.15; head.add(hornBase);
  const h1 = horn(hornM, 0.27, 0.8, 8); hornBase.add(h1);
  const hTip = new THREE.Group(); hTip.position.y = 0.72; hTip.rotation.x = -0.28; hornBase.add(hTip); // el cuerno se curva hacia delante
  const cry = crystalSpike(crystal, 0.16, 1.15); hTip.add(cry);
  // venas de luz en el cuerno
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.position.y = 0.9; halo.scale.setScalar(1.6); hTip.add(halo);
  const sideHorns = [-1, 1].map((s) => { const h = horn(hornM, 0.1, 0.55, 6); h.position.set(s * 0.3, 0.28, 0.12); h.rotation.set(0.5, 0, -s * 0.7); head.add(h); return h; });
  const eyes = [-1, 1].map((s) => { const e = bigEye({ r: 0.17, iris: 0xffd040, slit: true, quality: level, lidSkin: skin, scleraColor: 0xf0e0c4 }); e.object.position.set(s * 0.36, 0.12, 0.28); e.object.rotation.y = s * 0.7; head.add(e.object); e.rotY = s * 0.7; return e; });
  const mouth = jaw(skin, claw, { w: 0.24, len: 0.3, teeth: LOW ? 3 : 5 }); mouth.object.position.set(0, -0.28, 0.5); mouth.object.rotation.x = 0.1; head.add(mouth.object);
  const mand = [-1, 1].map((s) => { const m = horn(claw, 0.06, 0.38, 5); m.position.set(s * 0.2, -0.3, 0.62); m.rotation.set(1.35, 0, s * 0.45); head.add(m); return m; });
  const barbs = []; if (!LOW) for (const s of [-1, 1]) { const t = tentacle(skin, { len: 0.8, r0: 0.04, r1: 0.008, hang: true, amp: 0.15, speed: 2.4, freq: 3, phase: s }); t.position.set(s * 0.17, -0.2, 0.7); head.add(t); barbs.push(t); }

  /* ── patas con IK (cuatro) + muslos que se tensan ── */
  const legs = [], hipsZ = [0.55, -0.62];
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, row = i >> 1, hz = hipsZ[row];
    const l = leg(skin, { upper: 0.78, lower: 0.85, r: 0.21, claw }); l.object.position.set(side * 0.55, -0.12, hz); l.setBend(new THREE.Vector3(side * 0.5, 1, row ? -0.5 : 0.7)); body.add(l.object);
    const th = blob(musc, 0.3, 0.8, 1.0, 0.95); th.position.set(side * 0.58, -0.22, hz); body.add(th);
    legs.push({ l, side, row, th, base: new THREE.Vector3(side * 0.28, -0.82, row ? -0.1 : 0.12), ph: (i === 0 || i === 3) ? 0 : Math.PI });
  }

  /* ── vapor ── */
  const NV = LOW ? 0 : 20; let vap = null, vpos, vcol, vvel, vage;
  if (NV) {
    vpos = new Float32Array(NV * 3); vcol = new Float32Array(NV * 3); vvel = new Float32Array(NV * 3); vage = new Float32Array(NV).fill(9);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(vpos, 3)); g.setAttribute('color', new THREE.BufferAttribute(vcol, 3));
    vap = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, map: softDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })); vap.frustumCulled = false; root.add(vap);
  }
  // pájaros-esquirla que giran al estar aturdido
  const birds = []; for (let i = 0; i < 4; i++) { const g = new THREE.Group(); const m = horn(crystal, 0.07, 0.3, 4); m.rotation.x = Math.PI / 2; g.add(m); const w = horn(hornM, 0.09, 0.2, 3); w.rotation.z = 1.2; w.position.x = 0.08; g.add(w); const w2 = horn(hornM, 0.09, 0.2, 3); w2.rotation.z = -1.2; w2.position.x = -0.08; g.add(w2); g.visible = false; head.add(g); birds.push({ g, w, w2, ph: i / 4 * 6.28 }); }

  const mats = [skin, musc, chit, chit2, hornM, claw, crystal, ...eyes.flatMap((e) => e.mats)];
  const sPitch = new Spring(0, 140, 10), sHit = new Spring(0, 160, 9), sSway = new Spring(0, 90, 6), sTail = new Spring(0, 70, 7), sYaw = new Spring(0, 60, 8);
  let phase = 0, wind = 0, chg = 0, stun = 0, prevHp = 1, hit = 0, limp = 0, wt = 0, vt = 0, prevS = '', steamAcc = 0, stompT = 0, pawL = 0, pawR = 0;
  const tmp = new THREE.Vector3(), eyeDir = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), look0 = new THREE.Vector3(0, 0.1, 1), cc = new THREE.Color();
  const sx = Math.sin;

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0, 0.05); const id = st.id || 0, hp = st.hp == null ? 1 : st.hp, hurtLow = clamp((0.35 - hp) / 0.35, 0, 1);
    const sn = st.s;
    if (sn !== prevS) { if (sn === 'wind') wt = 0; if (sn === 'stun') { sSway.v += 4; } if (prevS === 'stun' || sn === 'stun') hit = Math.max(hit, 0.3); prevS = sn; }
    if (sn === 'wind') wt += dt;
    if (hp < prevHp - 0.001) { hit = 1; sHit.v += 6; } prevHp = hp; hit = Math.max(0, hit - dt * 3);
    const speed = clamp(ctx.speed || 0, 0, 1.6), look = ctx.look || look0;
    wind = damp(wind, sn === 'wind' ? 1 : 0, sn === 'wind' ? 5 : 3, dt); chg = damp(chg, sn === 'charge' ? 1 : 0, 6, dt); stun = damp(stun, (sn === 'stun' || st.st) ? 1 : 0, 6, dt); limp = damp(limp, hurtLow, 3, dt);
    const heat = Math.max(wind, chg * 0.9);
    // paso: más rápido al correr/cargar, trote diagonal
    const run = Math.max(speed, chg * 1.6) * (1 - stun);
    phase += dt * (3 + run * 7.5 + hurtLow * 1.5);
    const breath = sx(t * (1.6 + hurtLow * 2.2 + wind * 1.4) + id) * 0.5 + 0.5;

    // ─ patas
    let planted = 0;
    legs.forEach((L, i) => {
      const ph = phase + L.ph, st0 = clamp(0.1 + run * 0.65, 0, 1), swing = sx(ph), lift = Math.max(0, Math.cos(ph)) * 0.38 * st0;
      let fz = L.base.z + swing * 0.42 * st0 * (1 - 0.0), fy = L.base.y + lift, fx = L.base.x;
      if (i === 1 && limp > 0.01) { fy += 0.25 * limp + Math.max(0, sx(t * 3)) * 0.12 * limp; fz *= 1 - 0.5 * limp; } // la pata herida cojea
      if (L.row === 0 && wind > 0.05) { // patear el suelo con las patas delanteras (alternando)
        const pw = sx(wt * 7.0 + (L.side > 0 ? 3.1 : 0)); const up = Math.max(0, pw); fy = lerp(fy, L.base.y + up * 0.55, wind); fz = lerp(fz, L.base.z + 0.45 - (1 - up) * 0.8, wind); if (up < 0.04 && wt > 0.05 && L.side > 0 === (pw > 0)) planted++;
      }
      if (stun > 0.05) { fx += Math.sin(t * 2.3 + i * 2) * 0.22 * stun; fz += Math.cos(t * 1.7 + i) * 0.2 * stun; fy += Math.max(0, sx(t * 2.6 + i * 1.7)) * 0.25 * stun; fx += L.side * 0.15 * stun; }
      if (chg > 0.05) { fz = lerp(fz, L.base.z + sx(ph) * 0.7, chg); fy = lerp(fy, L.base.y + Math.max(0, Math.cos(ph)) * 0.5, chg); }
      tmp.set(fx, fy + hit * 0.1 * (i & 1 ? 1 : -1), fz); L.l.setFoot(tmp);
      // músculo: se tensa cuando la pata empuja (apoyada y hacia atrás)
      const push = clamp(-Math.cos(ph) * 0.5 + 0.5, 0, 1) * (0.3 + run) + wind * 0.5 * (L.row === 0 ? 1 : 0.3);
      L.th.scale.set(0.24 * (1 + push * 0.18), 0.3 * (1.0 + push * 0.12), 0.285 * (1 + push * 0.14));
    });
    const gait = sx(phase * 2) * 0.5 + 0.5;
    // ─ cuerpo: peso, vaivén, agachado al avisar, estirado al cargar, tambaleo al aturdirse
    const pitchS = sPitch.step(dt, 0), hitK = sHit.step(dt, 0), swayK = sSway.step(dt, 0), tl = sTail.step(dt, 0), yawS = sYaw.step(dt, clamp(Math.atan2(look.x, Math.max(0.2, look.z)), -0.9, 0.9));
    const squat = wind * (0.14 + 0.03 * sx(wt * 14)) + stun * 0.08 + hurtLow * 0.06;
    body.position.y = -squat + (run > 0.05 ? Math.abs(sx(phase)) * 0.06 * (0.4 + run) : 0) + (breath - 0.5) * 0.02 - hit * 0.04;
    body.rotation.x = chg * 0.1 + wind * 0.07 + sx(phase * 2) * 0.03 * run + hitK * 0.1 + stun * (sx(t * 1.9) * 0.12) + hurtLow * 0.05;
    body.rotation.z = sx(phase) * 0.05 * run + stun * (sx(t * 2.4) * 0.16 + swayK * 0.2) + (hurtLow ? sx(t * 5) * 0.015 : 0) + hit * 0.06 * sx(t * 40) + wind * sx(wt * 7) * 0.035;
    body.rotation.y = stun * sx(t * 1.3) * 0.22 + sYaw.x * 0.0;
    body.scale.set(1 - chg * 0.03, 1 - chg * 0.03 + (breath - 0.5) * 0.025, 1 + chg * 0.07);
    thx.scale.set(0.7 * (1 + (breath - 0.5) * 0.06), 0.574 * (1 + (breath - 0.5) * 0.08), 0.77);
    abd.scale.set(0.59, 0.527 * (1 + (breath - 0.5) * 0.1), 0.744);
    plates.forEach((p, i) => { if (p.userData.cry) { p.scale.y = (0.34 - 0.02 * (i >> 1)) * (1 + 0.5 * (1 - hp) + 0.2 * heat) * (1 + 0.06 * sx(t * 4 + i)); return; } p.rotation.x = -0.25 + (i >> 1) * 0.08 + (breath - 0.5) * 0.05 + wind * sx(wt * 9 + i) * 0.04; p.position.y += 0; });
    shoulders.forEach((p, i) => { p.scale.y = 0.378 * (1 + push0(legs[i * 0 + (i ? 1 : 0)], phase) * 0.1); });
    // ─ cabeza: pesada, sigue al jugador con retardo; baja para embestir; cae mareada
    const hy = sYaw.x * 0.5;
    head.rotation.x = lerp(0.02 + hurtLow * 0.12, 0.42, wind) + chg * 0.22 + stun * (0.28 + sx(t * 1.9 + 1) * 0.14) + pitchS + hitK * 0.2 - Math.max(0, Math.sin(phase * 2)) * 0.05 * run;
    head.rotation.y = hy * (1 - heat * 0.8) + stun * sx(t * 1.6) * 0.5 + sx(t * 0.8 + id) * 0.04;
    head.position.set(0, -0.02 - wind * 0.1 - stun * 0.12, 1.0 + chg * 0.06);
    const jo = clamp(0.15 + breath * 0.12 + wind * (0.5 + 0.4 * sx(wt * 20)) + chg * 0.9 + stun * 0.5 + hurtLow * 0.2 + hit * 0.6, 0, 1); mouth.set(jo);
    mand.forEach((m, i) => { m.rotation.z = (i ? 1 : -1) * (0.45 + jo * 0.5); });
    sideHorns.forEach((h, i) => { h.rotation.z = -(i ? 1 : -1) * 0.7 + (i ? 1 : -1) * 0.1 * wind; });
    // cuerno: respira, se calienta
    hTip.rotation.x = -0.28 - tl * 0.1 + sx(t * 1.7) * 0.01;
    crystal.userData.u.uGlow.value = 1 + heat * 3; crystal.emissiveIntensity = 0.8 + heat * 1.6 + 0.25 * sx(t * 5) + hit * 0.8;
    halo.material.opacity = clamp(heat * 0.75, 0, 0.8) * (0.8 + 0.2 * sx(t * (12 + wind * 30))); halo.scale.setScalar(1.4 + heat * 1.1);
    const U = skin.userData.u; U.uGlow.value = 0.08 + heat * 0.55; U.uPulse.value = wind * 0.5 + hurtLow * 0.2; musc.userData.u.uGlow.value = 0.05 + heat * 0.4;
    // ─ ojos
    eyes.forEach((E, i) => {
      if (stun > 0.3) { eyeDir.set(sx(t * 3 + i * 2.2) * 0.9, Math.cos(t * 2.4 + i * 1.3) * 0.6, 1).normalize(); } else { eyeDir.copy(look); eyeDir.applyAxisAngle(Y, -E.rotY).normalize(); }
      E.update(dt, eyeDir, { open: clamp(1 - wind * 0.35 - chg * 0.35 - stun * 0.45 - hurtLow * 0.15, 0.1, 1), pupil: 1 - heat * 0.55 + stun * 0.4, glow: 0.7 + heat * 1.8, hurt: U.uHurt.value, shake: stun * 0.4, blinkRate: 1 + stun * 2 + hurtLow });
    });
    barbs.forEach((b) => { const u = b.userData.u; u.uAmp.value = 0.15 + wind * 0.2 + stun * 0.3; });
    // ─ cola
    tail.rotation.x = tl * 0.4 - run * 0.15 + sx(t * 1.3) * 0.05 + wind * 0.3; tail.rotation.y = sx(phase) * 0.18 * run + sx(t * 0.9 + id) * 0.12 + stun * sx(t * 2) * 0.4;
    if (hit > 0.9) sTail.v += 4;
    // ─ pájaros aturdidos
    birds.forEach((B, i) => { B.g.visible = stun > 0.05; const a = t * 3.2 + B.ph; B.g.position.set(Math.cos(a) * 0.55, 0.7 + Math.sin(t * 2 + i) * 0.06, 0.1 + Math.sin(a) * 0.55); B.g.rotation.y = -a + Math.PI; B.g.scale.setScalar(stun); const fl = sx(t * 22 + i) * 0.7; B.w.rotation.z = 1.2 + fl; B.w2.rotation.z = -1.2 - fl; });
    // ─ vapor por los ollares (más al avisar y al estar herido)
    if (vap) {
      const rate = 3 + wind * 22 + hurtLow * 10 + run * 5 + stun * 2; steamAcc += dt * rate;
      head.updateWorldMatrix(true, false);
      while (steamAcc >= 1) { steamAcc -= 1; let k = 0; for (let j = 0; j < NV; j++) if (vage[j] > 1.1) { k = j; break; }
        tmp.set((Math.random() < 0.5 ? -1 : 1) * 0.12, -0.05, 0.82); head.localToWorld(tmp); root.worldToLocal(tmp); vpos[k * 3] = tmp.x; vpos[k * 3 + 1] = tmp.y; vpos[k * 3 + 2] = tmp.z; vvel[k * 3] = (Math.random() - 0.5) * 0.3; vvel[k * 3 + 1] = 0.35 + Math.random() * 0.3; vvel[k * 3 + 2] = 0.5 + Math.random() * 0.4 + wind * 0.6; vage[k] = 0; }
      for (let j = 0; j < NV; j++) { vage[j] += dt * (1.3); const a = vage[j]; if (a > 1.1) { vcol[j * 3] = vcol[j * 3 + 1] = vcol[j * 3 + 2] = 0; continue; }
        vpos[j * 3] += vvel[j * 3] * dt; vpos[j * 3 + 1] += vvel[j * 3 + 1] * dt; vpos[j * 3 + 2] += vvel[j * 3 + 2] * dt * (1 - a * 0.6); const f = Math.sin(Math.min(1, a) * Math.PI) * 0.45; vcol[j * 3] = f * 0.9; vcol[j * 3 + 1] = f * 0.85; vcol[j * 3 + 2] = f; }
      vap.geometry.attributes.position.needsUpdate = true; vap.geometry.attributes.color.needsUpdate = true; vap.material.size = 0.35 + heat * 0.25;
    }
  } };
  function push0(L, ph) { return clamp(-Math.cos(ph + L.ph) * 0.5 + 0.5, 0, 1); }
}
