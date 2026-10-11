// ASTILLA — corredor. Un depredador-insecto de biocristal: tórax segmentado, 6 patas con IK, mandíbulas, ojos compuestos que miran.
export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, capsule, horn, crystalSpike, eye, jaw, leg, scatterOnSurface, Spring } = kit;
  const skin = fleshMaterial({ color: 0x1f6f66, vein: 0x0b2a36, spot: color, glow: 0.12, wobble: 0.02, breath: 0.03, spots: 0.8, veins: 0.7, iri: 0.6, rough: 0.35 });
  const shell = boneMaterial(0x0e3b45, { rough: 0.25 }), crystal = bioCrystalMaterial(color, { glow: 0.9 }), fang = boneMaterial(0xf4efe0);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // abdomen, tórax y cabeza: tres masas blandas con articulaciones
  const abd = blob(skin, 0.55, 0.9, 0.8, 1.35); abd.position.set(0, 0.55, -0.85); body.add(abd);
  const thx = blob(skin, 0.5, 1, 0.85, 1.1); thx.position.set(0, 0.62, 0); body.add(thx);
  const head = new THREE.Group(); head.position.set(0, 0.62, 0.95); body.add(head);
  head.add(blob(skin, 0.42, 1, 0.9, 1.05));
  // placas dorsales de quitina + cristales que brotan del lomo
  scatterOnSurface(body, 5, [0.46, 0.72, 0.62], (i) => { const p = horn(shell, 0.2 - i * 0.015, 0.34); return p; }, { from: 0.0, to: 0.45, seed: 2 }).forEach((p) => { p.position.z -= 0.2; p.position.y += 0.2; });
  const crys = []; for (let i = 0; i < 4; i++) { const c = crystalSpike(crystal, 0.09, 0.5 - i * 0.05); c.position.set((i % 2 ? 0.14 : -0.14), 1.05 - i * 0.04, -0.2 - i * 0.28); c.rotation.set(-0.5 + i * 0.05, 0, (i % 2 ? -0.25 : 0.25)); body.add(c); crys.push(c); }
  // ojos compuestos (dos grandes + dos pequeños) y antenas
  const eyes = [eye({ r: 0.17, iris: color, pupil: 'slit' }), eye({ r: 0.17, iris: color, pupil: 'slit' }), eye({ r: 0.09, iris: color }), eye({ r: 0.09, iris: color })];
  [[-0.2, 0.18, 0.32], [0.2, 0.18, 0.32], [-0.1, 0.28, 0.28], [0.1, 0.28, 0.28]].forEach(([x, y, z], i) => { eyes[i].object.position.set(x, y, z); eyes[i].object.rotation.y = x * 1.5; head.add(eyes[i].object); });
  const ant = [-1, 1].map((s) => { const a = horn(shell, 0.025, 0.9); a.position.set(s * 0.1, 0.35, 0.3); a.rotation.set(0.9, 0, -s * 0.5); head.add(a); return a; });
  const mouth = jaw(skin, fang, { w: 0.2, len: 0.22, teeth: 4 }); mouth.object.position.set(0, -0.12, 0.35); mouth.object.rotation.x = 0.2; head.add(mouth.object);
  const mand = [-1, 1].map((s) => { const m = horn(fang, 0.05, 0.4); m.position.set(s * 0.16, -0.08, 0.38); m.rotation.set(1.3, 0, s * 0.5); head.add(m); return m; });
  // 6 patas con IK y marcha de trípode alterno
  const legs = [];
  for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1, row = Math.floor(i / 2); const l = leg(skin, { upper: 0.62, lower: 0.78, r: 0.065, claw: fang }); l.object.position.set(side * 0.38, 0.55, 0.45 - row * 0.5); l.setBend(new THREE.Vector3(side * 0.6, 1, 0)); body.add(l.object); legs.push({ l, side, row, base: new THREE.Vector3(side * 0.75, -0.55, 0.45 - row * 0.5 + (row === 0 ? 0.35 : row === 2 ? -0.3 : 0)) }); }
  const mats = [skin, shell, crystal, fang];
  const tailSpring = new Spring(0, 80, 9), headSpring = new Spring(0, 90, 10); let phase = 0, openT = 0;
  const tmp = new THREE.Vector3();
  return { root, mats, tick(dt, st, t, ctx = {}) {
    const speed = Math.min(1.6, ctx.speed || 0), lunge = st.s === 'leap';
    phase += dt * (6 + speed * 14);
    // marcha: trípodes alternos (0,3,4) / (1,2,5)
    legs.forEach((L, i) => { const grp = (i === 0 || i === 3 || i === 4) ? 0 : 1, ph = phase + grp * Math.PI, stride = 0.35 * Math.min(1, 0.25 + speed), lift = Math.max(0, Math.sin(ph)) * 0.34 * Math.min(1, 0.3 + speed);
      tmp.set(L.base.x, L.base.y + lift + (lunge ? 0.5 : 0), L.base.z + Math.cos(ph) * stride); L.l.setFoot(tmp); });
    body.position.y = Math.abs(Math.sin(phase)) * 0.05 * (0.4 + speed) + (lunge ? 0.5 : 0); body.rotation.z = Math.sin(phase) * 0.05 * speed; body.rotation.x = lunge ? -0.4 : 0.04 * Math.sin(phase * 2);
    // cabeza que sigue al jugador con retardo (resorte) + abdomen que cuelga
    const lx = ctx.look ? Math.atan2(ctx.look.x, Math.max(0.2, ctx.look.z)) : 0; head.rotation.y = headSpring.step(dt, THREE.MathUtils.clamp(lx, -0.8, 0.8));
    abd.rotation.x = tailSpring.step(dt, -speed * 0.08) ; abd.scale.y = 0.8 * (1 + 0.04 * Math.sin(t * 5 + st.id));
    ant.forEach((a, i) => { a.rotation.x = 0.9 + Math.sin(t * 3 + i * 2) * 0.18; a.rotation.z = (i ? 0.5 : -0.5) * 1 + Math.sin(t * 2.4 + i) * 0.12; });
    openT += ((lunge || st.s === 'run' && speed > 0.5 ? 1 : 0.15) - openT) * Math.min(1, 8 * dt); mouth.set(openT * (0.8 + 0.2 * Math.sin(t * 18))); mand.forEach((m, i) => { m.rotation.z = (i ? 1 : -1) * (0.5 + openT * 0.5); });
    eyes.forEach((e) => e.update(dt, ctx.look || tmp.set(0, 0, 1), { dilate: lunge ? 0.5 : 0 }));
    crys.forEach((c, i) => { c.scale.y = 0.5 * (1 + 0.1 * Math.sin(t * 4 + i)); }); crystal.userData.u.uGlow.value = 0.9 + 0.5 * Math.sin(t * 6);
    skin.userData.u.uPulse.value = lunge ? 1 : 0; skin.userData.u.uGlow.value = lunge ? 0.8 : 0.12;
  } };
}
