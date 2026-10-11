// AURORA — sanadora. Medusa-ángel amable pero extraña: campana translúcida con gradiente aqua→rosa, pétalos luminosos y núcleo cálido por dentro,
// ojos grandes y suaves, brazos orales con volantes, tentáculos y cintas de seda que ondulan, "alas" de luz y un halo flotante.
// Estado cast (~0.9 s): inhala (la campana se expande y el núcleo se concentra) y exhala: pulso, ondas de luz y una nube de esporas.
import { auraShell, ringPool, glowSprite, jellyMaterial, bellMesh, ribbon, isLow, damp, clamp, lerp, ease, TAU } from './prisma-util.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, crystalSpike, tentacle, eye, Spring, uTime } = kit;
  const V = THREE.Vector3, low = isLow(), col = new THREE.Color(color);
  const bellM = jellyMaterial({ top: 0x30e0d0, bottom: 0xff4cc0, alpha: 0.55, rim: 0.8, glow: 0.22, bands: 8 });
  const innerM = jellyMaterial({ top: 0xffd870, bottom: 0xff80d8, alpha: 0.45, rim: 0.6, glow: 0.3, bands: 5 });
  const petal = fleshMaterial({ color: 0xffb0e8, vein: 0xff5ac0, spot: 0xfff0b0, glow: 0.9, spots: 0.6, veins: 0.8, rough: 0.35, alpha: 0.85, scale: 3 });
  const nucleus = fleshMaterial({ color: 0xfff0c0, vein: 0xffa050, spot: 0xffffff, glow: 0.9, spots: 0.4, veins: 0.7, rough: 0.3, scale: 3.5 });
  const arm = fleshMaterial({ color: 0xff9ae0, vein: 0xb02890, spot: 0x60ffe8, glow: 0.4, spots: 0.9, veins: 0.7, rough: 0.4, alpha: 0.7, scale: 3, sheen: 0.2 });
  const gold = bioCrystalMaterial(0xffe9a0, { glow: 1.2 });

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bell = new THREE.Group(); bell.position.y = 0.55; body.add(bell);
  const dome = bellMesh(bellM, 1.05, 0.85, 1.05); bell.add(dome);
  const dome2 = bellMesh(innerM, 0.74, 0.62, 0.74); dome2.position.y = 0.02; bell.add(dome2);
  // núcleo, pétalos de trébol y halo de luz dentro de la campana
  const core = new THREE.Group(); core.position.y = 0.34; bell.add(core);
  const nuc = blob(nucleus, 0.2); core.add(nuc);
  const petals = [0, 1, 2, 3].map((i) => { const p = blob(petal, 0.22, 1.0, 0.22, 0.6); const a = i * TAU / 4 + 0.4; p.position.set(Math.cos(a) * 0.3, -0.02, Math.sin(a) * 0.3); p.rotation.y = -a; core.add(p); return p; });
  const coreGlow = glowSprite(0xffe9b0, 1.8, 0.4); core.add(coreGlow);
  // ojos grandes y suaves (se ven a través de la campana)
  const eyes = [-1, 1].map((sd) => { const e = eye({ r: 0.13, iris: 0xffd890, glow: 0.8 }); e.object.position.set(sd * 0.3, 0.12, 0.62); e.object.rotation.y = sd * 0.35; bell.add(e.object); return { e, ry: sd * 0.35 }; });
  // brazos orales: cintas anchas con volantes (carne translúcida) + tentáculos largos y finos
  const oral = [], tents = [];
  for (let i = 0; i < (low ? 3 : 4); i++) { const a = i * TAU / (low ? 3 : 4) + 0.5; const r = ribbon({ len: 1.7, w: 0.42, color: 0xff80d8, color2: 0x40f0e0, amp: 0.35, speed: 1.3 + i * 0.2, freq: 3, alpha: 0.9, phase: i * 1.7 }); r.position.set(Math.cos(a) * 0.14, 0.55, Math.sin(a) * 0.14); r.rotation.y = a; body.add(r); oral.push({ r, a }); }
  for (let i = 0; i < (low ? 5 : 9); i++) { const a = (i / (low ? 5 : 9)) * TAU, n = low ? 5 : 9; const t = tentacle(arm, { len: 2.6 + (i % 3) * 0.5, r0: 0.04, r1: 0.008, hang: true, amp: 0.4, speed: 1.2 + (i % 3) * 0.3, freq: 3, phase: i * 1.1 });
    t.position.set(Math.cos(a) * 0.88, 0.5, Math.sin(a) * 0.88); body.add(t); tents.push({ t, a }); const tip = blob(gold, 0.03); tip.position.y = -(2.6 + (i % 3) * 0.5); t.add(tip); }
  // cintas-ala: dos abanicos de seda de luz que suben desde los lados (ángel) + halo flotante
  const wingR = []; const nw = low ? 1 : 3;
  [-1, 1].forEach((sd) => { for (let i = 0; i < nw; i++) { const r = ribbon({ len: 1.5 - i * 0.2, w: 0.6, color: 0xfff0c8, color2: color, amp: 0.18, speed: 1.6, freq: 2, alpha: 0.75, phase: i + sd, hang: false }); r.position.set(sd * 0.55, 0.95, -0.15); r.rotation.z = -sd * (0.55 + i * 0.35); r.rotation.y = sd * 0.0; body.add(r); wingR.push({ r, sd, i }); } });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.028, 8, low ? 24 : 40), new THREE.MeshBasicMaterial({ color: 0xffe9a0 })); halo.rotation.x = Math.PI / 2 - 0.25; halo.position.set(0, 1.62, -0.05); body.add(halo);
  const haloG = glowSprite(0xffe9a0, 1.8, 0.45); haloG.position.copy(halo.position); body.add(haloG);
  const crystals = [0, 1, 2, 3, 4].map((i) => { const a = i * TAU / 5, c = crystalSpike(gold, 0.03, 0.12); c.position.set(Math.cos(a) * 0.5, 1.0 + Math.sin(a * 2) * 0.03, Math.sin(a) * 0.5); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); body.add(c); return c; });
  // ondas de luz y esporas
  const waves = ringPool(root, 3, 0xfff0c8, { plane: 'xz' }), wavesV = ringPool(root, 2, color, { plane: 'xz' }); waves.rings.forEach((r) => { r.position.y = 0.5; }); wavesV.rings.forEach((r) => { r.position.y = 0.5; });
  const NS = low ? 14 : 36, sp = new Float32Array(NS * 3), sv = new Float32Array(NS * 3), sph = [];
  for (let i = 0; i < NS; i++) { const a = Math.random() * TAU, r = 0.6 + Math.random() * 1.6; sp[i * 3] = Math.cos(a) * r; sp[i * 3 + 1] = -0.5 + Math.random() * 2.4; sp[i * 3 + 2] = Math.sin(a) * r; sph.push(Math.random() * 6.28); }
  const spG = new THREE.BufferGeometry(); spG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const spM = new THREE.PointsMaterial({ color: 0xfff0c8, size: 0.14, map: glowSprite(0xffffff).material.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
  const spores = new THREE.Points(spG, spM); spores.frustumCulled = false; root.add(spores);
  const aura = auraShell(0xffe0f8, 1.6); aura.position.y = 0.9; root.add(aura);

  const mats = [bellM, innerM, petal, nucleus, arm, gold];
  const bellS = new Spring(0, 50, 7), tiltX = new Spring(0, 40, 6), tiltY = new Spring(0, 40, 6), jetS = new Spring(0, 60, 8), brightS = new Spring(0, 40, 6);
  let phase = Math.random() * 6, lastS = '', castT = 0, relT = 9, cycle = 0;
  const tmp = new V(), Y = new V(0, 1, 0);
  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(Math.max(dt, 0.001), 0.05); const look = ctx.look || tmp.set(0, 0, 1), speed = Math.min(1.5, ctx.speed || 0);
    const cast = st.s === 'cast', hurt = (st.hp ?? 1) < 0.35, stun = !!st.st;
    if (cast && lastS !== 'cast') { castT = 0; relT = 9; } lastS = st.s;
    if (cast) { castT += dt; if (castT > 0.5 && relT > 5) relT = 0; } relT += dt;
    const inhale = cast ? ease(castT / 0.5) * (castT < 0.5 ? 1 : 0) + (castT >= 0.5 ? Math.max(0, 1 - (castT - 0.5) / 0.15) : 0) : 0;
    const exhale = relT < 0.9 ? Math.sin(clamp(relT / 0.9, 0, 1) * Math.PI) : 0;
    // pulso de natación: contrae la campana y empuja el cuerpo hacia arriba; irregular si está herida
    phase += dt * (1.9 + speed * 0.8) * (stun ? 0.4 : hurt ? 0.7 : 1) * (cast ? 0.2 : 1) + (hurt ? Math.sin(t * 8) * dt * 0.8 : 0);
    const sw = Math.sin(phase), pulse = clamp(-Math.cos(phase) * 0.5 + 0.5, 0, 1); // 1 = contraída
    const contract = cast ? -0.55 * inhale + exhale * 0.9 : pulse * 0.8 - 0.1;
    const cs = bellS.step(dt, contract); bellM.userData.u.uContract.value = cs; innerM.userData.u.uContract.value = cs * 0.9; bellM.userData.u.uPulse.value = Math.abs(cs); innerM.userData.u.uPulse.value = Math.abs(cs);
    const jet = jetS.step(dt, pulse * 0.1 + exhale * 0.25 - inhale * 0.08); body.position.y = Math.sin(t * 0.6) * 0.06 + jet; body.rotation.z = Math.sin(t * 0.5 + st.id) * 0.06 + (hurt ? Math.sin(t * 4) * 0.07 : 0);
    // se inclina hacia el jugador con retardo
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    bell.rotation.y = tiltY.step(dt, clamp(lx, -0.9, 0.9) * 0.4); bell.rotation.x = tiltX.step(dt, clamp(-ly, -0.5, 0.5) * 0.2 + inhale * 0.1);
    bell.scale.set(1 + inhale * 0.18 - exhale * 0.1, 1 + exhale * 0.12 - inhale * 0.08, 1 + inhale * 0.18 - exhale * 0.1);
    // núcleo: respira, se concentra al inhalar y revienta de luz al exhalar
    const bright = brightS.step(dt, inhale * 0.8 + exhale * 1.2);
    const nr = 1 + Math.sin(t * 2.2) * 0.07 - inhale * 0.25 + exhale * 0.5; nuc.scale.setScalar(0.2 * nr);
    petals.forEach((p, i) => { const a = i * TAU / 4 + 0.4 + t * (0.15 + inhale * 1.2 + exhale * 2); p.position.set(Math.cos(a) * 0.3 * (1 - inhale * 0.3 + exhale * 0.5), -0.02, Math.sin(a) * 0.3 * (1 - inhale * 0.3 + exhale * 0.5)); p.rotation.y = -a; p.scale.set(0.22 * (1 + exhale * 0.5), 0.05, 0.13); });
    nucleus.userData.u.uGlow.value = 0.9 + bright * 2.4 + (hurt ? Math.sin(t * 14) * 0.5 : 0); petal.userData.u.uGlow.value = 0.5 + bright * 1.6;
    coreGlow.material.opacity = 0.3 + bright * 0.4 + 0.06 * Math.sin(t * 3); coreGlow.scale.setScalar(1.7 + bright * 2.2);
    bellM.userData.u.uGlow.value = 0.22 + bright * 0.9 - (hurt ? 0.2 : 0); innerM.userData.u.uGlow.value = 0.3 + bright * 0.9;
    // ojos suaves que siguen al jugador; sonríen (se entrecierran) al curar
    eyes.forEach(({ e, ry }) => { tmp.copy(look).applyAxisAngle(Y, -(bell.rotation.y + ry)); e.update(dt, tmp, { dilate: 0.25 + inhale * 0.3, glowMul: 1 + bright }); });
    // brazos, tentáculos y cintas: ondulan más al impulsarse, se elevan al inhalar y se sueltan al exhalar
    oral.forEach(({ r }, i) => { const u = r.userData.u; u.uAmp.value = (0.35 + pulse * 0.25 + exhale * 0.5) * (hurt ? 1.3 : 1); u.uSpeed.value = 1.3 + exhale * 3; r.rotation.x = Math.sin(t * 0.8 + i * 1.5) * 0.08 - inhale * 0.25; });
    tents.forEach(({ t: tn, a }, i) => { const u = tn.userData.u; u.uAmp.value = (0.4 + pulse * 0.3 + exhale * 0.6) * (hurt ? 1.4 : 1) * (1 - inhale * 0.5); u.uSpeed.value = 1.2 + exhale * 3 + (i % 3) * 0.3; tn.rotation.set(Math.sin(a) * 0.1 * (1 + pulse), 0, -Math.cos(a) * 0.1 * (1 + pulse) - inhale * 0.0); });
    wingR.forEach(({ r, sd, i }) => { const open = 0.55 + i * 0.35 + inhale * 0.35 - exhale * 0.15 + Math.sin(phase + i * 0.6) * 0.07; r.rotation.z = -sd * open; r.userData.u.uAmp.value = 0.18 + exhale * 0.5; r.userData.u.uA.value = 0.5 + bright * 0.4; });
    // halo de ángel + cristales dorados que respiran
    halo.rotation.z = t * (0.6 + inhale * 4 + exhale * 6); halo.position.y = 1.62 + Math.sin(t * 1.1) * 0.05 + jet * 0.5; haloG.position.copy(halo.position); haloG.material.opacity = 0.25 + bright * 0.5; haloG.scale.setScalar(1.8 + bright * 1.5); halo.scale.setScalar(1 + inhale * 0.2 + exhale * 0.4);
    crystals.forEach((c, i) => { c.scale.y = 0.12 * (1 + 0.15 * Math.sin(t * 3 + i) + bright * 0.8); }); gold.emissiveIntensity = 1 + bright * 1.5;
    // ondas de luz expansivas (curación) y esporas que se dispersan
    waves.rings.forEach((r, i) => { const k = clamp(relT / 0.95 - i * 0.14, 0, 1); waves.set(i, 0.8 + ease(k) * 5.2, relT < 1.2 && k < 1 ? (1 - k) * 0.9 : 0); });
    wavesV.rings.forEach((r, i) => { const k = clamp(relT / 0.8 - 0.08 - i * 0.2, 0, 1); wavesV.set(i, 0.6 + ease(k) * 4.2, relT < 1.2 && k < 1 && k > 0 ? (1 - k) * 0.7 : 0); r.position.y = 0.5 + 0.5 * i; });
    const pa = spG.attributes.position.array;
    for (let i = 0; i < NS; i++) { const ix = i * 3, bx = pa[ix], bz = pa[ix + 2], rr = Math.hypot(bx, bz) + 0.001;
      if (relT < 0.9 && relT > 0) { const s = (1.5 + (i % 5) * 0.5) * dt; pa[ix] += bx / rr * s * 2.2; pa[ix + 2] += bz / rr * s * 2.2; pa[ix + 1] += 0.4 * dt; }
      else { pa[ix] += Math.sin(t * 0.7 + sph[i]) * 0.1 * dt; pa[ix + 1] += (0.12 + 0.1 * Math.sin(sph[i] + t)) * dt; pa[ix + 2] += Math.cos(t * 0.6 + sph[i]) * 0.1 * dt;
        if (rr > 2.6) { pa[ix] *= 1 - dt * 0.8; pa[ix + 2] *= 1 - dt * 0.8; } }
      if (pa[ix + 1] > 2.2) { const a = Math.random() * TAU, r = 0.5 + Math.random() * 1.2; pa[ix] = Math.cos(a) * r; pa[ix + 1] = -0.7; pa[ix + 2] = Math.sin(a) * r; } }
    spG.attributes.position.needsUpdate = true; spM.opacity = 0.55 + 0.25 * Math.sin(t * 2) + exhale * 0.4; spM.size = 0.13 + exhale * 0.08;
    aura.userData.set(st.sd ? 0.65 + 0.2 * Math.sin(t * 4) : 0);
  } };
}
