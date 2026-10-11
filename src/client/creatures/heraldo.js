// EL HERALDO — el bicho guía de la historia: una medusa-feto flotante, translúcida, con un ojo enorme y húmedo.
// No es enemigo: aparece al despertar el Pasajero y le explica las reglas del Vórtice. `st.talk` (0–1) hace latir la campana al hablar.
export default function build(kit, color = 0xffa6e8) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, horn, crystalSpike, eye, tentacle, scatterOnSurface, Spring } = kit;
  const bell = fleshMaterial({ color: 0xc9569a, vein: 0x7a1450, spot: 0x7dfff0, glow: 0.2, wobble: 0.04, breath: 0.04, alpha: 0.8, veins: 0.9, spots: 1.0, iri: 1, rough: 0.2 });
  const ribbon = fleshMaterial({ color: 0xa8407e, vein: 0x601040, spot: 0x7dfff0, glow: 0.3, alpha: 0.85, veins: 0.4, spots: 0.6, rough: 0.3 });
  const crystal = bioCrystalMaterial(0x35d3c4, { glow: 0.4 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const dome = blob(bell, 0.9, 1.0, 0.85, 1.0); dome.position.y = 0.3; body.add(dome);
  const core = blob(fleshMaterial({ color: 0xff4f9e, glow: 0.25, veins: 0.8, spots: 0.5 }), 0.5, 1, 1, 1); core.position.y = 0.2; body.add(core);
  const e = eye({ r: 0.4, iris: 0x7dfff0, glow: 0.9 }); e.object.position.set(0, 0.25, 0.45); body.add(e.object);
  const tens = [];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, t = tentacle(ribbon, { len: 1.5 + (i % 3) * 0.35, r0: 0.07, r1: 0.012, amp: 0.3, speed: 2 + (i % 3) * 0.4, phase: i }); t.position.set(Math.cos(a) * 0.55, -0.1, Math.sin(a) * 0.55); body.add(t); tens.push(t); }
  const cr = scatterOnSurface(body, 6, [0.9, 0.8, 0.9], () => crystalSpike(crystal, 0.05, 0.28), { from: 0.0, to: 0.4, seed: 3 });
  cr.forEach((c) => { c.position.y += 0.3; });
  const bob = new Spring(0, 40, 6); let talkS = 0;
  return { root, mats: [bell, ribbon, crystal], tick(dt, st, t, ctx = {}) {
    const talk = st.talk || 0; talkS += (talk - talkS) * Math.min(1, 14 * dt);
    root.position.y = Math.sin(t * 1.4) * 0.12 + bob.step(dt, 0);
    const pulse = 1 + Math.sin(t * 2.2) * 0.04 + talkS * (0.1 + 0.08 * Math.sin(t * 30));
    dome.scale.set(0.9 * pulse, 0.85 / pulse, 0.9 * pulse); core.scale.setScalar(0.5 + 0.06 * Math.sin(t * 3) + talkS * 0.1);
    e.update(dt, ctx.look, { dilate: talkS * 0.4, glowMul: 1 + talkS });
    tens.forEach((x, i) => { x.userData.u.uAmp.value = 0.3 + talkS * 0.25; });
    bell.userData.u.uGlow.value = 0.2 + talkS * 0.4; crystal.userData.u.uGlow.value = 0.55 + Math.sin(t * 5) * 0.2;
    body.rotation.y = Math.sin(t * 0.5) * 0.15;
  } };
}
