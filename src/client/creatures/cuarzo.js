// CUARZO — invocador. Una madre-pólipo / hongo de cristal: tronco carnoso con sombrero de cristal coronado de espiras,
// ojos que miran, tentáculos colgantes y SACOS DE HUEVOS translúcidos con larvas luminosas que se ven por dentro.
// INVOCACIÓN (st.s === 'cast', ~1 s): el sombrero se alza y el tronco se arquea, la corona de tentáculos florece, los
// sacos se hinchan y arden, las larvas se agitan desesperadas; al terminar los sacos se desinflan de golpe (suelta 2 astillas).
import { cfg } from '../quality.js';
import { slimLeg, fixEye, mergeStatic, glowSprite, shieldAura, tickAura } from './geoda_util.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, horn, crystalSpike, scatterOnSurface, tentacle, eye, leg, Spring, TAU } = kit;
  const level = cfg().humans, low = level === 'low';
  const col = new THREE.Color(color);
  const skinCol = col.clone().lerp(new THREE.Color(0xb05a88), 0.65).getHex();
  const skin = fleshMaterial({ color: skinCol, vein: 0x3c0a30, spot: color, glow: 0.1, wobble: 0.025, breath: 0.035, spots: 0.8, veins: 0.9, rough: 0.3, iri: 0.5, scale: 2.4 });
  const tskin = fleshMaterial({ color: skinCol, vein: 0x3c0a30, spot: color, glow: 0.1, wobble: 0, breath: 0, spots: 0.6, veins: 0.7, rough: 0.3, sheen: 0.2 });
  const capM = fleshMaterial({ color: col.clone().lerp(new THREE.Color(0x44285c), 0.55).getHex(), vein: 0x1c0830, spot: color, glow: 0.15, wobble: 0.02, breath: 0.03, spots: 1.0, veins: 0.6, rough: 0.25, iri: 0.9, scale: 2 });
  const sacM = fleshMaterial({ color: 0xf2dcee, vein: 0xb0306a, spot: color, glow: 0.12, wobble: 0.03, breath: 0.05, spots: 0.0, veins: 0.9, rough: 0.12, alpha: 0.42, scale: 3.2 });
  const larvaM = fleshMaterial({ color: 0xffb0d8, vein: 0x802050, spot: color, glow: 0.8, wobble: 0.01, breath: 0.03, spots: 1.6, veins: 0.4, rough: 0.3, scale: 5 });
  const crystal = bioCrystalMaterial(color, { glow: 1.0 }), claw = boneMaterial(0xf0e4d0);
  const mats = [skin, tskin, capM, sacM, larvaM, crystal, claw];

  const bigGeo = new THREE.SphereGeometry(1, low ? 12 : 22, low ? 8 : 14);
  const root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(0.92); root.add(body);
  // tronco (se arquea al invocar) y sombrero
  const trunk = new THREE.Group(); trunk.position.y = 0.55; body.add(trunk);
  const stem = blob(skin, 0.58, 1, 1.25, 1); stem.geometry = bigGeo; stem.position.y = 0.45; trunk.add(stem);
  const crown = new THREE.Group(); crown.position.y = 1.05; trunk.add(crown);
  const cap = blob(capM, 0.95, 1.12, 0.5, 1.12); cap.geometry = bigGeo; cap.position.y = 0.12; crown.add(cap);
  // espiras de biocristal que brotan del sombrero y el tronco
  const spires = [];
  scatterOnSurface(crown, low ? 5 : 8, [1.0, 0.5, 1.0], (i) => { const h = 0.2 + (i % 3) * 0.1, c = crystalSpike(crystal, 0.06 + (i % 2) * 0.02, h); return c; }, { from: 0.0, to: 0.3, seed: 1 }).forEach((o, i) => { o.position.y += 0.12; spires.push(o); });
  mergeStatic(crown, crystal);
  const trunkCr = new THREE.Group(); trunk.add(trunkCr);
  scatterOnSurface(trunkCr, low ? 2 : 4, [0.58, 0.72, 0.58], (i) => { if (i % 2) return null; const c = crystalSpike(crystal, 0.06, 0.28); return c; }, { from: 0.35, to: 0.8, seed: 3 }).forEach((o) => { o.position.y += 0.45; });
  mergeStatic(trunkCr, crystal);   // las espiras y cristales: 1 sola malla por grupo (brillan juntos)
  // corona de tentáculos en la cima: florece al invocar
  const bloom = [], nB = 3;
  for (let i = 0; i < nB; i++) { const t = tentacle(tskin, { len: 0.7, r0: 0.07, r1: 0.012, hang: false, amp: 0.1, speed: 2 + i * 0.3, freq: 3 }); const g = new THREE.Group(); g.position.set(Math.cos(i / nB * TAU) * 0.18, 0.55, Math.sin(i / nB * TAU) * 0.18); g.rotation.y = -(i / nB) * TAU; g.add(t); crown.add(g); bloom.push({ g, t, a: i / nB * TAU }); }
  // ojos y boca
  const eyes = [-1, 1].map((s) => { const e = fixEye(eye({ r: 0.2, iris: new THREE.Color(color).multiplyScalar(0.85).getHex(), glow: 0.6 })); e.object.position.set(s * 0.26, 0.62, 0.46); e.object.rotation.y = s * 0.45; trunk.add(e.object); return e; });
  // sacos de huevos con larvas
  const nS = low ? 3 : 5, sacs = [], sGeo = new THREE.SphereGeometry(1, low ? 10 : 14, low ? 7 : 10), lGeo = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < nS; i++) {
    const a = (i / nS) * TAU + 0.4, g = new THREE.Group(); g.position.set(Math.cos(a) * 0.82, 0.5, Math.sin(a) * 0.82); body.add(g);
    const stalk = null;
    const sac = new THREE.Mesh(sGeo, sacM); sac.position.y = -0.05; g.add(sac);
    const larva = new THREE.Mesh(lGeo, larvaM); sac.add(larva); sacs.push({ g, sac, larva, a, ph: i * 1.7, stalk });
  }
  mats.push(...bloom.map((b) => b.t.userData.mat));
  // tentáculos colgantes bajo el sombrero + patas gruesas con IK
  const hang = [], nH = low ? 2 : 3;
  for (let i = 0; i < nH; i++) { const a = (i / nH) * TAU + 1.1, t = tentacle(tskin, { len: 0.95, r0: 0.07, r1: 0.014, hang: true, amp: 0.2, speed: 1.6 + i * 0.3, freq: 3 }); t.position.set(Math.cos(a) * 0.92, 1.55, Math.sin(a) * 0.92); body.add(t); hang.push(t); }
  mats.push(...hang.map((t) => t.userData.mat));
  const legs = [], nL = 3;
  for (let i = 0; i < nL; i++) { const a = (i / nL) * TAU + 0.2, sx = Math.cos(a), sz = Math.sin(a); const l = slimLeg(leg(skin, { upper: 0.4, lower: 0.5, r: 0.09 })); l.object.position.set(sx * 0.35, 0.55, sz * 0.35); l.setBend(new THREE.Vector3(sx * 0.7, 1.6, sz * 0.7)); body.add(l.object); legs.push({ l, base: new THREE.Vector3(sx * 0.62, -0.5, sz * 0.62) }); }
  const glow = glowSprite(color, 2.6, 0); glow.position.y = 1.2; body.add(glow);
  const aura = shieldAura(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), 1.7); aura.position.y = 1.2; body.add(aura);

  const spArch = new Spring(0, 40, 6), spSac = new Spring(0, 110, 7), spYaw = new Spring(0, 60, 8), spCrown = new Spring(0, 70, 7);
  let castT = 0, wasCast = false, burst = 0, phase = 0, blinkT = 2, blink = 0; const tmp = new THREE.Vector3(0, 0, 1);

  return { root, mats, tick(dt, st, t, ctx = {}) {
    const cast = st.s === 'cast', speed = Math.min(1.5, ctx.speed || 0), hurt = st.hp != null && st.hp < 0.35, stun = !!st.st;
    castT = cast ? Math.min(1, castT + dt / 0.95) : Math.max(0, castT - dt * 3);
    if (wasCast && !cast) burst = 1; wasCast = cast; burst = Math.max(0, burst - dt * 2.2);
    const pe = castT * castT * (3 - 2 * castT);
    const look = ctx.look || tmp.set(0, 0, 1), lx = Math.atan2(look.x, Math.max(0.15, look.z));
    // tronco: respira, se arquea hacia atrás al invocar y se inclina al caminar; temblor si herida
    const arch = spArch.step(dt, -pe * 0.32 + (hurt ? Math.sin(t * 13) * 0.04 : 0) + (stun ? Math.sin(t * 9) * 0.1 : 0));
    trunk.rotation.x = arch + 0.04 * Math.sin(t * 1.4 + st.id); trunk.rotation.y = spYaw.step(dt, THREE.MathUtils.clamp(lx, -0.8, 0.8)) * 0.35;
    const br = Math.sin(t * 1.9 + st.id); stem.scale.set(0.58 * (1 + 0.025 * br + 0.05 * pe), 0.725 * (1 - 0.03 * br), 0.58 * (1 + 0.025 * br + 0.05 * pe));
    // sombrero: se alza y se ensancha al invocar
    const cr = spCrown.step(dt, pe); crown.position.y = 1.05 + 0.18 * cr; crown.rotation.x = -0.12 * cr; cap.scale.set(1.064 * (1 + 0.06 * cr), 0.25 * (1 + 0.3 * cr + 0.05 * br), 1.064 * (1 + 0.06 * cr));
    // corona de tentáculos: cerrada en reposo, abre como una flor al invocar
    bloom.forEach((B, i) => { const open = 0.25 + 0.95 * Math.max(0, cr); B.g.rotation.x = 0; B.t.rotation.set(0, 0, 0); B.g.rotation.z = Math.cos(B.a) * open * 0.9 * -1; B.g.rotation.x = Math.sin(B.a) * open * 0.9; B.t.userData.u.uAmp.value = 0.1 + 0.3 * pe + (hurt ? 0.15 : 0); });
    // sacos: laten; al invocar se hinchan, arden y las larvas se agitan; al soltar se desinflan de golpe
    const infl = spSac.step(dt, pe);
    sacs.forEach((S, i) => {
      const beat = 0.5 + 0.5 * Math.sin(t * (hurt ? 8 : 2.4) + S.ph), k = 0.3 * (1 + 0.42 * infl + 0.06 * beat) * (1 - 0.25 * burst);
      S.sac.scale.set(k, k * 1.18, k); S.g.position.y = 0.5 - 0.04 * infl + Math.sin(t * 1.3 + S.ph) * 0.015;
      const w = 1 + 7 * pe, wob = Math.sin(t * 3 * w + S.ph);
      S.larva.position.set(Math.sin(t * 1.1 * w + S.ph) * 0.4, Math.sin(t * 0.9 * w + S.ph * 2) * 0.35, Math.cos(t * 1.3 * w + S.ph) * 0.4);
      S.larva.scale.set(0.3, 0.3, 0.55 + 0.1 * wob); S.larva.rotation.set(wob * 0.6, t * w * 0.8 + S.ph, 0);
    });
    sacM.userData.u.uGlow.value = 0.12 + 0.55 * pe + 0.5 * burst; larvaM.userData.u.uGlow.value = 0.8 + 1.3 * pe + 0.9 * burst; sacM.opacity = 0.42 + 0.2 * pe;
    // piel y cristales
    skin.userData.u.uGlow.value = tskin.userData.u.uGlow.value = 0.1 + 0.2 * pe + 0.25 * burst; capM.userData.u.uGlow.value = 0.15 + 0.35 * pe + 0.3 * burst; skin.userData.u.uPulse.value = pe > 0.3 ? pe : 0;
    crystal.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 3) + 0.9 * pe + 0.7 * burst; crystal.userData.u.uGlow.value = 0.8 + 1.4 * pe;
    glow.material.opacity = (0.28 * pe + 0.4 * burst) * (0.8 + 0.2 * Math.sin(t * 25)); glow.scale.setScalar(2.2 + 1.2 * pe + 1.5 * burst);
    // ojos: miran, parpadean (párpado de carne)
    
    eyes.forEach((e, i) => { e.update(dt, ctx.look || tmp.set(0, 0, 1), { glowMul: 0.6 + 1.5 * pe });  });
    // marcha
    phase += dt * (3.5 + speed * 7);
    legs.forEach((L, i) => { const ph = phase + i * (TAU / 3), stride = 0.3 * Math.min(1, 0.2 + speed), lift = Math.max(0, Math.sin(ph)) * 0.3 * Math.min(1, 0.3 + speed); tmp.set(L.base.x, L.base.y + lift - (cast ? 0.1 : 0), L.base.z + Math.cos(ph) * stride * 0.5 + Math.cos(ph) * stride * 0.3 * Math.sign(L.base.x + 1e-3)); L.l.setFoot(tmp); });
    tmp.set(0, 0, 1);
    body.position.y = Math.abs(Math.sin(phase * 0.5)) * 0.05 * speed + 0.06 * pe; root.rotation.z = stun ? Math.sin(t * 22) * 0.05 : 0;
    hang.forEach((h, i) => { h.userData.u.uAmp.value = 0.15 + 0.15 * speed + 0.25 * pe + (hurt ? 0.2 : 0); });
    tickAura(aura, st, t);
  } };
}
