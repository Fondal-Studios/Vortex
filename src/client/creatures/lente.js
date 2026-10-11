// LENTE — a distancia. Una criatura-ojo: un globo ocular gigante, húmedo y venoso, sobre un pedúnculo vertebrado que se
// mece con peso, con párpados de carne, un iris-lente de biocristal y una corona de pétalos de cristal. Patas finas con IK.
// AVISO DE DISPARO (st.s === 'aim', 0.6 s): el pedúnculo se arquea hacia atrás, los párpados se abren del todo, la pupila
// se contrae, los pétalos convergen en cañón, el lente se enfoca y arde; al soltar el proyectil, retroceso.
import { cfg } from '../quality.js';
import { slimLeg, fixEye, glowSprite, shieldAura, tickAura } from './geoda_util.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, horn, eye, leg, tentacle, Spring } = kit;
  const level = cfg().humans, low = level === 'low';
  const col = new THREE.Color(color);
  const skinCol = col.clone().lerp(new THREE.Color(0xc2607a), 0.7).getHex();
  const skin = fleshMaterial({ color: skinCol, vein: 0x4a0a2a, spot: color, glow: 0.1, wobble: 0.015, breath: 0.025, spots: 0.7, veins: 0.8, rough: 0.35, scale: 2.4 });
  const tskin = fleshMaterial({ color: skinCol, vein: 0x4a0a2a, spot: color, glow: 0.1, wobble: 0, breath: 0, spots: 0.5, veins: 0.6, rough: 0.35, sheen: 0.2 });
  const eyeFlesh = fleshMaterial({ color: 0xf4ddd2, vein: 0x9a1426, spot: color, glow: 0.0, wobble: 0.004, breath: 0.008, spots: 0, veins: 0.85, rough: 0.1, sheen: 0.3, scale: 3.2 });
  const lidM = fleshMaterial({ color: skinCol, vein: 0x4a0a2a, spot: color, glow: 0.08, wobble: 0.01, breath: 0.01, spots: 0.5, veins: 0.9, rough: 0.3, scale: 3 });
  const crystal = bioCrystalMaterial(color, { glow: 0.9 }), lensM = bioCrystalMaterial(color, { glow: 0.6 }); lensM.opacity = 0.3; lensM.color.multiplyScalar(0.55);
  const claw = boneMaterial(0xf0e4d0);
  const mats = [skin, tskin, eyeFlesh, lidM, crystal, lensM, claw];

  const root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(0.88); root.add(body);
  // bulbo-raíz
  const bulb = blob(skin, 0.5, 1.15, 0.7, 1.15); bulb.position.y = 0.45; body.add(bulb);
  // pedúnculo de segmentos encadenados (cada uno cuelga del anterior: movimiento con peso)
  const N = low ? 4 : 5, SL = low ? 0.28 : 0.23, segs = [];
  let parent = body, py = 0.75;
  const smallGeo = new THREE.SphereGeometry(1, low ? 8 : 12, low ? 6 : 8), small = (mat, x, y, z) => { const m = new THREE.Mesh(smallGeo, mat); m.scale.set(x, y, z); return m; };
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group(); g.position.set(0, i === 0 ? py : SL, i === 0 ? 0.02 : 0); parent.add(g);
    const r = 0.17 - i * 0.015, m = small(skin, r, SL * 0.78, r); m.position.y = SL * 0.35; g.add(m);
    segs.push({ g, sp: new Spring(0, 38 + i * 4, 4.5 + i * 0.3), base: [0.3, -0.05, -0.28, -0.1, 0.35][i] * (N === 4 ? 1.1 : 1) });
    parent = g;
  }
  // cabeza: cuenca carnosa + ojo gigante + párpados + lente + corona de pétalos
  const head = new THREE.Group(); head.position.y = SL * 0.7; parent.add(head);
  const socket = small(skin, 0.5 * 1.05, 0.5 * 0.95, 0.5 * 0.9); socket.position.set(0, 0.2, -0.05); head.add(socket);
  const R = 0.5;
  const ey = fixEye(eye({ r: R, iris: new THREE.Color(color).multiplyScalar(0.8).getHex(), glow: 0.6 })); ey.object.position.set(0, 0.2, 0.12); head.add(ey.object);
  const ball = ey.object.children[0], lookG = ey.object.children[1], kitLid = ey.object.children[2];
  ball.material = eyeFlesh; kitLid.visible = false;
  const pupil = lookG.children[1], iris = lookG.children[0];
  iris.scale.setScalar(R * 0.66);
  // lente de biocristal sobre el iris (se enfoca al apuntar)
  const lens = new THREE.Mesh(new THREE.SphereGeometry(1, low ? 12 : 18, low ? 6 : 8, 0, Math.PI * 2, 0, Math.PI / 2), lensM);
  lens.rotation.x = Math.PI / 2; lens.position.z = R * 1.02; lens.scale.set(R * 0.62, R * 0.62, R * 0.22); lookG.add(lens);
  // párpados (media cáscara que sube/baja)
  const lidGeo = new THREE.SphereGeometry(1, low ? 12 : 18, low ? 5 : 7, 0, Math.PI * 2, 0, Math.PI / 2);
  const lidU = new THREE.Mesh(lidGeo, lidM), lidL = new THREE.Mesh(lidGeo, lidM); lidU.scale.setScalar(R * 1.07); lidL.scale.set(R * 1.07, -R * 1.07, R * 1.07);
  ey.object.add(lidU, lidL);
  // corona de pétalos de cristal
  const nP = low ? 5 : 6, petals = [];
  for (let i = 0; i < nP; i++) {
    const a = (i / nP) * Math.PI * 2 + 0.3, piv = new THREE.Group(); piv.position.set(Math.cos(a) * R * 0.98, 0.22 + Math.sin(a) * R * 0.98, 0.18); piv.rotation.z = a; head.add(piv);
    const sp = horn(crystal, 0.075 + (i % 2) * 0.02, 0.34 + (i % 3) * 0.08, 5); piv.add(sp); petals.push({ piv, sp, i });
  }
  // cristales que brotan del pedúnculo y la cuenca
  const cs = [];
  for (let i = 0; i < 2; i++) { const sg = segs[1 + (i % (N - 1))].g, c = horn(crystal, 0.06, 0.28 + (i % 3) * 0.08, 5); const a = i * 2.4; c.position.set(Math.cos(a) * 0.14, SL * 0.4, Math.sin(a) * 0.14); c.rotation.set(Math.sin(a) * 1.0, 0, -Math.cos(a) * 1.0); sg.add(c); cs.push(c); }
  // patas finas con IK (4) + raíces colgantes
  const legs = [], nL = 3;
  for (let i = 0; i < nL; i++) {
    const a = (i / nL) * Math.PI * 2 + 0.6, sx = Math.cos(a), sz = Math.sin(a);
    const l = slimLeg(leg(skin, { upper: 0.45, lower: 0.62, r: 0.055, claw })); l.object.position.set(sx * 0.45, 0.5, sz * 0.45); l.setBend(new THREE.Vector3(sx * 0.6, 2, sz * 0.6)); body.add(l.object);
    legs.push({ l, base: new THREE.Vector3(sx * 0.82, -0.5, sz * 0.82) });
  }
  const roots = [];
  if (!low) for (let i = 0; i < 2; i++) { const t = tentacle(tskin, { len: 0.7, r0: 0.07, r1: 0.012, hang: true, amp: 0.1, speed: 1.6 + i * 0.3, freq: 3 }); t.position.set(Math.cos(i * 2.1) * 0.2, 0.35, Math.sin(i * 2.1) * 0.2); body.add(t); roots.push(t); }
  mats.push(...roots.map((t) => t.userData.mat));
  const glow = glowSprite(color, 2, 0); glow.position.set(0, 0.22, 0.9); head.add(glow);
  const aura = shieldAura(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), 1.6); aura.position.y = 1.2; body.add(aura);

  const spYaw = new Spring(0, 70, 8), spPit = new Spring(0, 70, 8), spKick = new Spring(0, 120, 7), spLid = new Spring(1, 140, 14);
  let blinkT = 1.5 + Math.random() * 2, blink = 0, phase = 0, aimTime = 0, wasAim = false, kick = 0;
  const tmp = new THREE.Vector3(0, 0, 1), Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), AX = new THREE.Vector3(0, 1, 0), EU = new THREE.Euler();

  return { root, mats, tick(dt, st, t, ctx = {}) {
    const aim = st.s === 'aim', speed = Math.min(1.5, ctx.speed || 0), hurt = st.hp != null && st.hp < 0.35, stun = !!st.st;
    if (aim) aimTime += dt; else aimTime = 0;
    const p = aim ? Math.min(1, aimTime / 0.6) : 0, pe = p * p * (3 - 2 * p);
    if (wasAim && !aim) kick = 1; wasAim = aim; kick = Math.max(0, kick - dt * 3);
    const look = ctx.look || tmp, lx = Math.atan2(look.x, Math.max(0.15, look.z)), ly = Math.asin(THREE.MathUtils.clamp(look.y, -1, 1));
    // pedúnculo: S base + vaivén + arqueo hacia atrás al apuntar + retroceso al disparar + temblor si está herida
    const sway = Math.sin(t * 1.3 + st.id), jit = hurt ? Math.sin(t * 19 + st.id) * 0.06 : 0, arch = -pe * 0.5 + spKick.step(dt, kick * -0.5);
    segs.forEach((S, i) => { const tgt = S.base + sway * 0.12 * (i + 1) / N + arch * (i === 0 ? 0.3 : 1) * 0.45 + jit * (i / N) + (stun ? Math.sin(t * 8 + i) * 0.2 : 0) + (hurt ? 0.12 * i / N : 0); S.g.rotation.x = S.sp.step(dt, tgt); S.g.rotation.z = Math.sin(t * 0.9 + i * 0.7 + st.id) * 0.06 * (1 + speed); });
    head.rotation.y = spYaw.step(dt, THREE.MathUtils.clamp(lx, -1.0, 1.0)) * 0.8; let chain = 0; segs.forEach((S) => { chain += S.g.rotation.x; });
    head.rotation.x = spPit.step(dt, -THREE.MathUtils.clamp(ly, -0.5, 0.5) * 0.6 - chain * 0.85 + 0.05);
    // respiración del bulbo
    const br = Math.sin(t * 2.0 + st.id); bulb.scale.set(0.575 * (1 + 0.03 * br), 0.35 * (1 - 0.04 * br), 0.575 * (1 + 0.03 * br));
    // marcha de patas (diagonales alternas)
    phase += dt * (3 + speed * 9);
    legs.forEach((L, i) => { const ph = phase + (i % 2) * Math.PI, stride = 0.3 * Math.min(1, 0.2 + speed), lift = Math.max(0, Math.sin(ph)) * 0.3 * Math.min(1, 0.3 + speed); const dir = L.base.z > 0 ? 1 : -1; tmp.set(L.base.x, L.base.y + lift + (hurt ? Math.sin(t * 14 + i * 2) * 0.05 : 0), L.base.z + Math.cos(ph) * stride * dir * 0.7 + Math.cos(ph) * stride * 0.3); L.l.setFoot(tmp); });
    tmp.set(0, 0, 1);
    body.position.y = Math.abs(Math.sin(phase)) * 0.04 * speed + Math.sin(t * 2.0 + st.id) * 0.012; body.rotation.z = Math.sin(phase) * 0.04 * speed;
    // ojo: párpados (parpadeo, apertura total al apuntar, caído si herida/aturdida), pupila, lente
    blinkT -= dt; if (blinkT <= 0) { blink = 1; blinkT = 1.8 + Math.random() * 3.5; } blink = Math.max(0, blink - dt * 6);
    const openT = (stun ? 0.35 : hurt ? 0.6 + 0.25 * Math.sin(t * 5) ** 2 : 0.78 + 0.22 * pe) * (1 - Math.sin(Math.min(1, blink) * Math.PI));
    const lid = THREE.MathUtils.clamp(spLid.step(dt, openT), 0, 1.05), la = 0.05 + lid * 1.45;
    lidU.rotation.x = -la; lidL.rotation.x = la * 0.7;
    ey.update(dt, ctx.look || tmp.set(0, 0, 1), { dilate: 0, glowMul: 0.5 + 1.0 * pe });
    const pr = R * 0.3 * (1 + 0.15 * Math.sin(t * 1.5) - 0.65 * pe + (hurt ? 0.3 * Math.sin(t * 9) : 0)); pupil.scale.set(pr, pr, 1);
    lens.scale.set(R * (0.62 - 0.1 * pe), R * (0.62 - 0.1 * pe), R * (0.22 + 0.4 * pe)); lensM.emissiveIntensity = 0.25 + 1.5 * pe + 0.1 * Math.sin(t * 6); lensM.opacity = 0.3 + 0.4 * pe;
    // pétalos: abiertos en reposo, convergen en cañón al apuntar
    petals.forEach((P) => { const tilt = 0.75 - 0.7 * pe + 0.06 * Math.sin(t * 2.2 + P.i) + (hurt ? 0.1 * Math.sin(t * 15 + P.i) : 0); Q1.setFromAxisAngle(AX.set(0, 1, 0), tilt); P.sp.quaternion.setFromEuler(EU.set(Math.PI / 2, 0, 0)).premultiply(Q1); P.sp.scale.y = 0.34 * (1 + 0.5 * pe) + P.i % 3 * 0.08; });
    crystal.emissiveIntensity = 0.5 + 0.3 * Math.sin(t * 3) + 1.8 * pe; crystal.userData.u.uGlow.value = 0.6 + 1.5 * pe;
    glow.material.opacity = pe * (0.22 + 0.12 * Math.sin(t * 30 * (0.5 + pe))); glow.scale.setScalar(1.2 + 1.6 * pe);
    cs.forEach((c, i) => { c.scale.y = 0.28 * (1 + 0.12 * Math.sin(t * 3 + i)); });
    skin.userData.u.uGlow.value = tskin.userData.u.uGlow.value = 0.1 + 0.55 * pe; skin.userData.u.uPulse.value = pe > 0.2 ? pe : 0;
    eyeFlesh.userData.u.uGlow.value = 0.0; roots.forEach((r2, i) => { r2.userData.u.uAmp.value = 0.1 + 0.1 * speed + (hurt ? 0.15 : 0); });
    // aturdida: bamboleo; escudada: aura
    root.rotation.z = stun ? Math.sin(t * 21) * 0.05 : 0; tickAura(aura, st, t);
  } };
}
