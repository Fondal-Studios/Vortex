// GRAVITÓN — control. Embrión-cefalópodo que flota sin peso: bolsa de carne pálida y translúcida con venas oscuras, un órgano luminoso
// en el centro que distorsiona el espacio (anillos expansivos), ojos desparejos entrecerrados, pico, tentáculos que "no saben dónde está el suelo".
// Estado charge (1.3 s): los tentáculos se tensan hacia ARRIBA, el órgano se contrae y brilla, los anillos convergen; al soltar: onda de choque.
import { soft as blob, bead, auraShell, ringPool, glowSprite, isLow, damp, clamp, lerp, ease, TAU } from './prisma-util.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, crystalSpike, scatterOnSurface, tentacle, eye, jaw, Spring } = kit;
  const V = THREE.Vector3, low = isLow();
  const skin = fleshMaterial({ color: 0xa890dc, vein: 0x1c0a40, spot: color, glow: 0.12, wobble: 0.025, breath: 0.035, spots: 0.5, veins: 1.0, scale: 1.7, iri: 0.5, rough: 0.5, sheen: 0.2, alpha: 0.5 });
  skin.forceSinglePass = true; const tskin = fleshMaterial({ color: 0xb7a6dc, vein: 0x2a1450, spot: color, glow: 0.1, wobble: 0.01, breath: 0.02, spots: 0.9, veins: 0.8, scale: 3.0, rough: 0.5, sheen: 0.5 });
  const organM = fleshMaterial({ color: 0xffd6ff, vein: 0xff3a9a, spot: 0xffffff, glow: 1.1, wobble: 0.05, breath: 0.05, spots: 0.5, veins: 0.9, scale: 3.0, rough: 0.3 });
  const beak = boneMaterial(0x3a2a55, { rough: 0.3 }), crystal = bioCrystalMaterial(color, { glow: 1.0 });

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  body.position.y = 0.55;
  const head = new THREE.Group(); body.add(head);
  const mantle = blob(skin, 0.78, 0.92, 1.12, 0.95); mantle.position.y = 0.3; head.add(mantle);
  const brow = blob(skin, 0.42, 1.0, 0.7, 0.9); brow.position.set(0, -0.2, 0.42); head.add(brow);
  // órgano central: núcleo carnoso que late dentro de la bolsa + halo + cascarones de distorsión
  const organ = new THREE.Group(); organ.position.set(0, 0.32, 0); head.add(organ);
  const core = blob(organM, 0.36); organ.add(core);
  const lobes = [0, 1, 2].map((i) => { const b = bead(organM, 0.17); const a = i * TAU / 3; b.position.set(Math.cos(a) * 0.3, Math.sin(a * 1.3) * 0.15, Math.sin(a) * 0.3); organ.add(b); return b; });
  const haloS = glowSprite(color, 2.6, 0.7); organ.add(haloS);
  const lens = auraShell(0xb8c4ff, 1.0); lens.scale.setScalar(0.62); organ.add(lens);
  const ringsH = ringPool(organ, 4, color, { plane: 'xz' }), ringsV = ringPool(organ, 3, 0xe0b0ff, { plane: 'xz' }); ringsV.rings.forEach((r, i) => { r.rotation.set(-Math.PI / 2 + 1.1, 0, i * 1.0); });
  // rostro desparejo y entrecerrado + pico
  const eyes = [[0, -0.15, 0.7, 0.2, 'slit'], [-0.38, -0.02, 0.58, 0.085, 'round'], [0.4, -0.3, 0.52, 0.065, 'round']].map(([x, y, z, r, p], i) => { const e = eye({ r, iris: i ? 0xc0d0ff : color, pupil: p, glow: 0.7 }); e.object.position.set(x, y, z); e.object.rotation.y = x * 1.2; head.add(e.object); return { e, ry: x * 1.2 }; });
  const mouth = jaw(skin, beak, { w: 0.17, len: 0.22, teeth: 3 }); mouth.object.position.set(0, -0.52, 0.5); mouth.object.rotation.x = 0.35; head.add(mouth.object);
  // cristales que brotan de la corona de la bolsa
  const crys = scatterOnSurface(head, low ? 3 : 8, [0.62, 0.95, 0.6], (i) => crystalSpike(crystal, 0.05 + (i % 3) * 0.012, 0.2 + (i % 4) * 0.05), { from: 0.02, to: 0.42, seed: 1.3 }).map((c) => { c.position.y += 0.3; c.userData.h = c.scale.y; return c; });
  // tentáculos: 6 largos finos + 4 cortos gruesos; cada uno cuelga de un pivote para poder alzarlo
  const tents = [];
  const mk = (i, n, ang, R, len, r0, amp) => { const th = ang + (i / n) * TAU; const piv = new THREE.Group(); piv.rotation.order = 'YXZ'; piv.position.set(Math.sin(th) * R, -0.18, Math.cos(th) * R); piv.rotation.y = th;
    const t = tentacle(tskin, { len, r0, r1: 0.012, hang: true, amp, speed: 0.9 + Math.random() * 0.6, freq: 2.4 + Math.random(), phase: i * 1.7 }); piv.add(t); head.add(piv);
    const tip = bead(crystal, r0 * 0.5); tip.position.y = -len; t.add(tip); tents.push({ piv, t, th, amp, ph: i * 1.3 + ang, len }); };
  for (let i = 0; i < (low ? 5 : 6); i++) mk(i, low ? 5 : 6, 0.2, 0.42, 2.5, 0.065, 0.55);
  for (let i = 0; i < (low ? 2 : 4); i++) mk(i, low ? 2 : 4, 0.9, 0.3, 1.5, 0.1, 0.35);
  const aura = auraShell(0xb8c4ff, 1.5); aura.position.y = 0.8; root.add(aura);

  const mats = [skin, tskin, organM, beak, crystal];
  const headS = new Spring(0, 60, 8), headX = new Spring(0, 60, 8), orgS = new Spring(1, 120, 9), upS = new Spring(0, 55, 6), shock = { t: 9 };
  let cT = 0, lastS = '', tilt = new V(), phase = Math.random() * 6;
  const tmp = new V();
  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(Math.max(dt, 0.001), 0.05); const look = ctx.look || tmp.set(0, 0, 1), speed = Math.min(1.5, ctx.speed || 0);
    const charge = st.s === 'charge', hurt = (st.hp ?? 1) < 0.35;
    if (charge && lastS !== 'charge') cT = 0; if (!charge && lastS === 'charge') { shock.t = 0; orgS.x = 1.9; orgS.v = 10; } lastS = st.s;
    cT = charge ? cT + dt : 0; const ck = charge ? clamp(cT / 1.3, 0, 1) : 0, ce = ease(ck);
    shock.t += dt;
    // flotación sin peso: sube y baja, se inclina y rota despacio; el motor lo mueve, esto es solo el "respirar" en el aire
    phase += dt * (0.8 + speed * 0.6);
    body.position.y = 0.55 + Math.sin(phase) * 0.1 + ce * 0.15; body.rotation.z = Math.sin(phase * 0.7) * 0.07 + (hurt ? Math.sin(t * 5) * 0.08 : 0); body.rotation.x = Math.cos(phase * 0.6) * 0.05;
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    head.rotation.y = headS.step(dt, clamp(lx, -1, 1) * 0.5 + (hurt ? Math.sin(t * 9) * 0.1 : 0)); head.rotation.x = headX.step(dt, -clamp(ly, -0.6, 0.6) * 0.4 + ce * 0.12);
    const br = 1 + Math.sin(t * 1.7 + st.id) * 0.035 - ce * 0.06;
    head.scale.set(br * (1 + ce * 0.04 * Math.sin(t * 40)), br * (1 + 0.05 * ce), br);
    // órgano: latido lento; en charge se CONTRAE y arde; al soltar revienta y vuelve (resorte)
    const beat = 1 + Math.sin(t * 2.4) * 0.07 + (hurt ? Math.sin(t * 17) * 0.1 : 0);
    const os = charge ? lerp(1, 0.42, ce) * (1 + Math.sin(t * 38) * 0.05 * ce) : orgS.step(dt, 1); organ.scale.setScalar(os * beat);
    lobes.forEach((b, i) => { const a = t * (0.7 + ce * 5) + i * TAU / 3; b.position.set(Math.cos(a) * 0.3, Math.sin(a * 1.3) * 0.15, Math.sin(a) * 0.3); });
    organM.userData.u.uGlow.value = 1.1 + ce * 3.5 + (shock.t < 0.3 ? 3 : 0); organM.userData.u.uPulse.value = ce;
    haloS.material.opacity = 0.6 + ce * 0.4 + (shock.t < 0.4 ? 0.4 : 0); haloS.scale.setScalar(2.4 + ce * 1.4 + (shock.t < 0.4 ? 2 : 0));
    lens.userData.set(0.45 + ce * 0.6); lens.scale.setScalar(0.6 + 0.05 * Math.sin(t * 3) + (1 - os) * 0.2);
    skin.userData.u.uGlow.value = 0.12 + ce * 0.9; skin.userData.u.uPulse.value = ce * 0.5;
    // anillos: en calma salen despacio (distorsión); en charge CONVERGEN hacia el órgano; al soltar, onda de choque
    ringsH.rings.forEach((r, i) => {
      if (charge) { const k = ((cT * 2.4 + i / 4) % 1); ringsH.set(i, lerp(3.0, 0.45, k), (1 - Math.abs(k * 2 - 1)) * (0.4 + ce * 0.9)); }
      else if (shock.t < 0.9) { const k = clamp(shock.t / 0.9 - i * 0.12, 0, 1); ringsH.set(i, 0.5 + k * 5.5, (1 - k) * 1.0); }
      else { const k = ((t * 0.33 + i / 4) % 1); ringsH.set(i, 0.7 + k * 2.4, Math.sin(k * Math.PI) * 0.35); }
    });
    ringsV.rings.forEach((r, i) => { if (charge) { const k = ((cT * 1.9 + i / 3) % 1); ringsV.set(i, lerp(2.4, 0.4, k), Math.sin(k * Math.PI) * (0.3 + ce * 0.7)); } else if (shock.t < 0.9) { const k = clamp(shock.t / 0.9 - 0.05 * i, 0, 1); ringsV.set(i, 0.5 + k * 4.2, (1 - k) * 0.8); } else { const k = ((t * 0.27 + i / 3) % 1); ringsV.set(i, 0.6 + k * 1.8, Math.sin(k * Math.PI) * 0.22); } r.rotation.z += dt * (0.4 + i * 0.2); });
    // tentáculos: a la deriva en calma, TENSOS hacia arriba en charge; después azotan hacia abajo
    const up = upS.step(dt, ce);
    tents.forEach((T, i) => {
      const drift = 0.35 + 0.35 * Math.sin(t * 0.45 + T.ph) + (hurt ? 0.5 : 0) - speed * 0.15 + 0.12 * Math.sin(t * 1.3 + T.ph * 2);
      const tau = lerp(drift, Math.PI * 0.92 - 0.12 * Math.sin(T.ph), clamp(up, -0.2, 1.15));
      T.piv.rotation.x = -tau; T.piv.rotation.y = T.th + Math.sin(t * 0.3 + T.ph) * 0.2 + up * 0.1 * Math.sin(T.ph);
      const u = T.t.userData.u; u.uAmp.value = lerp(T.amp * (1 + (hurt ? 0.5 : 0)), 0.05 + 0.03 * Math.sin(t * 45 + i), ce); u.uSpeed.value = 0.9 + ce * 8 + (hurt ? 1.2 : 0);
    });
    // ojos entrecerrados que siguen al jugador; el grande se abre al cargar
    eyes.forEach(({ e, ry }, i) => { tmp.copy(look).applyAxisAngle(new V(0, 1, 0), -(head.rotation.y + ry)); e.update(dt, tmp, { dilate: i === 0 ? ce * 0.7 : st.a ? 0.3 : 0, glowMul: 1 + ce * 2 }); });
    mouth.set(0.06 + 0.04 * Math.sin(t * 1.9) + ce * 0.45 + (hurt ? 0.15 : 0));
    crys.forEach((c, i) => { c.scale.y = c.userData.h * (1 + 0.1 * Math.sin(t * 3 + i) + ce * 0.9); }); crystal.emissiveIntensity = 0.8 + ce * 2; crystal.userData.u.uGlow.value = 1 + ce * 3;
    aura.userData.set(st.sd ? 0.65 + 0.2 * Math.sin(t * 4) : 0);
  } };
}
