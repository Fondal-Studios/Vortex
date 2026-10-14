// ÁNIMA (id interno «astilla», corredor) — alma en pena flaca y veloz. Cuerpo consumido de carne espectral (piel gris-celeste que deja
// pasar la luz), costillas al aire con el NÚCLEO DE LUZ latiendo entre ellas, calavera bajo una capucha de sudario que se estira hacia
// atrás como una ESTELA larga y rasgada (se lee de lejos: cabeza adelante, cola de tela atrás). Corre agachada en zigzag con zancadas
// largas y brazos colgando hacia atrás; antes del salto (estado 'leap') se encoge, abre las manos con garras y el núcleo se enciende.
// Estados: run (zigzag, ctx.speed) · leap (salto) · st.hp<0.35 cojea y parpadea · st.st aturdida · st.sd escudo.
import { THREE, lod, clamp, lerp, smooth, Rig, humanoide, alcanzar, velo, carne, hueso, brillo, setBrillo, nucleo, motas, sudario, calavera, tube, paint, skinRigid, skinChain, skinFn, gait, disposer, shieldAura, tickAura, Spring, dampTo, TAU } from './alma-kit.js';

export default function build(kit, color = 0x6ff4ff) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const skin = carne({ vein: color, sssColor: color, rimColor: color, veinGlow: 0.5, veinK: 0.25, alpha: 1 });
  const bone = hueso({ rimColor: color });
  const shroud = velo(0xe6f6ff, { alpha: 0.62, rimColor: color, rim: 1.1, flutter: 0.09, speed: 3.2, hem: 0.55, hemGlow: 0.7 });
  const eyeM = brillo(color, 2.2);
  const mats = [skin, bone, shroud, eyeM];
  const rig = new Rig();
  const B = humanoide(rig, { H: 1.85, shoulder: 0.17, hip: 0.09, arm: [0.32, 0.31], armR: [0.038, 0.02], hand: 0.2, claw: 0.07, legs: true, leg: [0.44, 0.44], legR: [0.05, 0.022], matSkin: skin, matHand: bone, hunch: 0.12, neckLen: 0.12,
    torso: (t) => lerp(0.085, 0.115, smooth(0, 0.25, t)) * (1 - 0.32 * Math.exp(-Math.pow((t - 0.42) / 0.1, 2))) + 0.03 * smooth(0.55, 0.78, t) - 0.07 * smooth(0.86, 1, t),
    torsoPaint: (p) => new THREE.Color(0x56626e).lerp(new THREE.Color(0x262c36), smooth(0.9, 0.5, p.y)).lerp(new THREE.Color(0xa8b8c4), 0.5 * Math.pow(Math.abs(Math.sin(p.y * 46)), 6) * smooth(1.1, 1.3, p.y)),
    armPaint: (p) => new THREE.Color(0x56606c).lerp(new THREE.Color(0x242a32), smooth(1.3, 0.8, p.y)), legPaint: (p) => new THREE.Color(0x3a4450).lerp(new THREE.Color(0x10141a), smooth(0.6, 0.0, p.y)), handColor: 0xcfc8b8 });
  const { root, pelvis, spine, chest, neck, head, armL, armR, legL, legR, Y } = B;
  // ── cabeza: calavera con mandíbula articulada + ojos de luz en las cuencas ──
  const hp = head.userData.rest, sk = calavera(0.105, { long: 1.08, seed: 5 });
  sk.cranium.translate(hp.x, hp.y + 0.06, hp.z + 0.03); rig.add(bone, skinRigid(sk.cranium, head));
  const jaw = rig.bone(head, [hp.x, hp.y + 0.0, hp.z + 0.0], 'jaw'); sk.jaw.translate(hp.x, hp.y + 0.06, hp.z + 0.03); rig.add(bone, skinRigid(sk.jaw, jaw));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.022, 0.016, 0.012); e.translate(hp.x + s * 0.036, hp.y + 0.067, hp.z + 0.115); rig.add(eyeM, skinRigid(e, head)); }
  // ── costillas al aire sobre el núcleo + esternón ──
  const cy = Y.chestY, cz = chest.userData.rest.z;
  for (let i = 0; i < (low ? 4 : 6); i++) { const y = cy + 0.07 - i * 0.042, w = 0.1 - i * 0.004, d = 0.085;
    for (const s of [-1, 1]) { const g = tube([[s * 0.02, y + 0.01, cz - d * 0.9], [s * w, y, cz - d * 0.3], [s * w * 1.02, y - 0.02, cz + d * 0.5], [s * 0.035, y - 0.045, cz + d * 1.05]], { rad: 0.0085, seg: low ? 6 : 9, sides: 4 }); paint(g, 0xd8ccb0); rig.add(bone, skinRigid(g, chest)); } }
  // ── capucha + ESTELA: sudario que nace en la cabeza y se estira hacia atrás (huesos de cola con resortes) ──
  const tailP = [[0, hp.y + 0.2, hp.z - 0.02], [0, hp.y + 0.12, hp.z - 0.22], [0, hp.y - 0.02, hp.z - 0.6], [0, hp.y - 0.14, hp.z - 1.05], [0, hp.y - 0.22, hp.z - 1.55]];
  const tail = []; { let par = head; tailP.forEach((p, i) => { const b = rig.bone(par, p, 'tail' + i); tail.push(b); par = b; }); }
  const hood = sudario([[0, hp.y + 0.2, hp.z + 0.05], [0, hp.y + 0.15, hp.z - 0.16], [0, hp.y + 0.0, hp.z - 0.55], [0, hp.y - 0.12, hp.z - 1.0], [0, hp.y - 0.2, hp.z - 1.6]],
    { rad: (t) => lerp(0.15, 0.06, smooth(0.0, 1, t)) + 0.04 * Math.exp(-Math.pow((t - 0.12) / 0.08, 2)), rows: 18, cols: 20, arc: [-2.5, 2.5], up: [0, -0.2, 1], tatter: 0.42, seed: 7, color: 0xf0fbff, colorEnd: 0xb8e8f6, fold: 0.1 });
  rig.add(shroud, skinChain(hood, [head, ...tail], 0.12));
  // jirones de la cintura (taparrabo rasgado)
  const pl = pelvis.userData.rest, skirt = sudario([[0, pl.y + 0.06, 0], [0, pl.y - 0.12, 0], [0, pl.y - 0.36, -0.03]], { rad: [0.12, 0.17], rows: 8, cols: 18, tatter: 0.6, seed: 9, color: 0xdceef6, colorEnd: 0x90b0c0, kStart: 0.2 });
  rig.add(shroud, skinFn(skirt, (p) => [[pelvis, 1 - smooth(pl.y - 0.05, pl.y - 0.3, p.y) * 0.6], [p.x > 0 ? legL.hb : legR.hb, smooth(pl.y - 0.05, pl.y - 0.3, p.y) * 0.6]]));
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 1.05; rootObj.scale.setScalar(K); rootObj.position.y = -0.9;
  const core = nucleo(color, 0.075, { halo: 9 }); chest.add(core.object); core.object.position.set(0, -0.005, 0.065); mats.push(...core.mats);
  const trail = motas(26, { color, size: 0.05, modo: 'trail', box: [0.5, 0.5, 2.2], speed: 0.9 }); trail.position.set(0, Y.neckY, -0.2); rootObj.add(trail); mats.push(trail.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.25); aura.position.set(0, 1.0, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, trail.userData.geo]));
  // ── animación ──
  const sHead = new Spring(0, 60, 8), sPit = new Spring(0, 60, 8), sTail = tail.map(() => new Spring(0, 30, 4)), cache = new Map();
  let ph = 0, runK = 0, leapK = 0, stunK = 0, prevHp = 1, flinch = 0, tw = 0;
  const tgt = new V3(), look = new V3(0, 0, 1);
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const speed = Math.min(1.6, ctx.speed || 0), leap = st.s === 'leap', hurt = st.hp != null && st.hp < 0.35, stun = !!st.st; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    runK = dampTo(runK, stun ? 0 : Math.min(1, speed * 1.3 + (st.s === 'run' ? 0.25 : 0)), 6, dt); leapK = dampTo(leapK, leap ? 1 : 0, leap ? 12 : 5, dt); stunK = dampTo(stunK, stun ? 1 : 0, 6, dt);
    ph += dt * (3 + runK * 9) * (hurt ? 0.75 : 1);
    // cuerpo: corre agachada y adelantada; respira; en el salto se estira horizontal
    const bob = Math.abs(Math.sin(ph)) * 0.05 * runK, br = Math.sin(t * 2.1 + st.id) * 0.012;
    pelvis.position.y = pelvis.userData.rest.y - pelvis.parent.userData.rest.y - 0.05 * runK + bob + br + leapK * 0.12 - flinch * 0.05 - stunK * 0.1;
    pelvis.rotation.x = 0.18 * runK + leapK * 0.55 + stunK * 0.2; pelvis.rotation.z = Math.sin(ph) * 0.05 * runK + (hurt ? 0.08 : 0); pelvis.rotation.y = Math.sin(ph) * 0.12 * runK;
    spine.rotation.x = 0.12 * runK + 0.1 + leapK * 0.25 + Math.sin(t * 2.1) * 0.02; spine.rotation.y = -Math.sin(ph) * 0.1 * runK;
    chest.rotation.x = 0.18 * runK + 0.08 + leapK * 0.1; chest.rotation.y = -Math.sin(ph) * 0.12 * runK; chest.scale.set(1 + br * 1.5, 1 + br * 2, 1 + br * 1.5);
    // cabeza: mira al jugador (con tics espasmódicos de alma en pena)
    tw = Math.max(0, tw - dt * 3); if (Math.random() < dt * 0.6) tw = 1;
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    neck.rotation.y = sHead.step(dt, clamp(lx, -1, 1) * 0.6 + Math.sin(tw * 20) * 0.25 * tw + (stun ? Math.sin(t * 7) * 0.4 : 0));
    neck.rotation.x = sPit.step(dt, -0.2 * runK - clamp(ly, -0.5, 0.5) * 0.5 - leapK * 0.5 + stunK * 0.5 + (hurt ? 0.2 : 0));
    head.rotation.z = Math.sin(t * 1.3 + st.id) * 0.08 + tw * Math.sin(t * 40) * 0.1;
    jaw.rotation.x = 0.12 + leapK * 0.55 + flinch * 0.4 + Math.max(0, Math.sin(t * 9)) * 0.1 * runK;
    // piernas: zancadas largas (IK), en el salto recogidas atrás
    [legL, legR].forEach((Lg, i) => {
      const [adv, lift] = gait(ph + i * Math.PI, 0.42), stride = 0.42 * runK, s = Lg.side;
      tgt.set(s * 0.1, 0.06 + lift * 0.3 * runK, 0.05 + adv * stride + 0.1 * runK);
      if (runK < 0.1) { tgt.y += Math.max(0, Math.sin(t * 1.1 + i * 3)) ** 16 * 0.08; tgt.z = 0.02 + i * 0.12 - 0.06; }
      if (leapK > 0.01) { tgt.lerp(new V3(s * 0.12, 0.55 + i * 0.1, -0.55 + i * 0.25), leapK); }
      if (stunK > 0.01) tgt.lerp(new V3(s * 0.2, 0.06, 0.05), stunK);
      if (hurt && i === 1) { tgt.y = 0.06 + Math.max(0, Math.sin(ph)) * 0.08; tgt.z = 0.0 - ((t * 0.7) % 1) * 0.2; }
      alcanzar(Lg, root, tgt, new V3(0, 0.1, 1), cache);
    });
    // brazos: cuelgan hacia atrás al correr (silueta de alma arrastrada); en el salto se adelantan con las garras abiertas
    [armL, armR].forEach((A, i) => {
      const s = A.side, sw = Math.sin(ph + (i ? 0 : Math.PI)) * 0.25 * runK;
      tgt.set(s * 0.26, Y.pelY + 0.05 + 0.15 * runK, -0.15 - 0.45 * runK + sw);
      if (runK < 0.1) tgt.set(s * 0.22, Y.pelY - 0.12 + Math.sin(t * 1.4 + i) * 0.02, 0.12 + Math.sin(t * 0.9 + i * 2) * 0.03);
      if (leapK > 0.01) tgt.lerp(new V3(s * 0.25, Y.neckY + 0.1, 0.75), leapK);
      if (stunK > 0.01) tgt.lerp(new V3(s * 0.3, Y.pelY - 0.1, 0.2 + Math.sin(t * 5 + i) * 0.1), stunK);
      alcanzar(A, root, tgt, new V3(s * 0.6, -0.2, -1), cache);
      A.fing.rotation.x = -0.3 - leapK * 0.5 + flinch * 0.6 + Math.sin(t * 3 + i) * 0.1;
    });
    // estela de tela: se levanta con la velocidad y ondea
    const tilt = pelvis.rotation.x + spine.rotation.x + chest.rotation.x + neck.rotation.x;
    sTail.forEach((sp, i) => { const tg0 = i === 0 ? -tilt * 0.85 - 0.55 * (1 - runK) * (1 - leapK) + 0.1 * runK : -0.22 * (1 - runK) * (1 - leapK) + 0.02 * runK;
      tail[i].rotation.x = sp.step(dt, tg0 + Math.sin(t * 5 - i * 1.1) * (0.05 + 0.06 * runK)); tail[i].rotation.y = Math.sin(t * 3.4 - i * 0.9 + st.id) * 0.12 * (0.3 + runK); });
    shroud.userData.u.uFlut.value = 0.06 + 0.06 * runK + 0.08 * leapK; shroud.userData.u.uWind.value.set(0, 0.05 * runK, -0.12 * runK - 0.2 * leapK);
    // luz: el núcleo late; antes/durante el salto se enciende (aviso); herida = parpadeo
    const hurtFl = hurt ? (Math.sin(t * 23) > 0.2 ? 1 : 0.4) : 1;
    core.set((1 + 0.5 * runK + 1.5 * leapK + flinch) * hurtFl, t, dt); setBrillo(eyeM, (1.8 + 2 * leapK + runK * 0.6) * hurtFl);
    shroud.userData.u.uVis.value = hurt ? 0.65 + 0.35 * hurtFl : 1; shroud.userData.u.uRim.value = 1 + leapK * 1.5;
    skin.userData.u.uVeinGlow.value = 0.4 + 0.3 * Math.sin(t * 4) + leapK * 1.2;
    trail.material.uniforms.uK.value = 0.2 + runK * 0.9 + leapK; trail.material.uniforms.uSpd.value = 0.6 + runK;
    rootObj.rotation.z = stun ? Math.sin(t * 13) * 0.05 : 0; tickAura(aura, st, t);
  } };
}
