// GEODA — tanque. Un molusco-almeja acorazado: valvas de placas con biocristales que ruedan cerradas (casi inmune).
// Al abrirse (~2 s) muestra su interior: carne húmeda y palpitante, un gran ojo-núcleo ardiente (la debilidad),
// una lengua de tentáculos y dientes de nácar. La apertura es MUY legible: chasquido de bisagra, resplandor, latido.
import { cfg } from '../quality.js';

import { fixEye, mergeStatic, glowSprite, shieldAura, tickAura } from './geoda_util.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, horn, crystalSpike, scatterOnSurface, tentacle, eye, Spring, TAU } = kit;
  const level = cfg().humans, low = level === 'low', hi = level === 'high';
  const col = new THREE.Color(color);
  const shellCol = col.clone().lerp(new THREE.Color(0x1a1230), 0.72).getHex();
  // materiales
  const shellM = boneMaterial(shellCol, { rough: 0.3 }); shellM.side = THREE.DoubleSide;
  const plateM = boneMaterial(col.clone().lerp(new THREE.Color(0x2a2236), 0.5).getHex(), { rough: 0.25 });
  const crystal = bioCrystalMaterial(color, { glow: 0.9 });
  const tooth = boneMaterial(0xf6ecd8, { rough: 0.3 });
  const flesh = fleshMaterial({ color: 0xe0687e, vein: 0x66082e, spot: color, glow: 0.1, wobble: 0.025, breath: 0.035, spots: 0.7, veins: 0.9, rough: 0.3, sheen: 1, scale: 2.6 });
  const lining = fleshMaterial({ color: 0xc24b78, vein: 0x4a0628, spot: color, glow: 0.08, wobble: 0.015, breath: 0.02, spots: 0.5, veins: 1, rough: 0.28, scale: 3 }); lining.side = THREE.BackSide;
  // piel para tentáculos: SIN ondulación/respiración de superficie (en tubos finos inflaría el radio) — workaround del kit
  const tflesh = fleshMaterial({ color: 0xe0687e, vein: 0x66082e, spot: color, glow: 0.1, wobble: 0, breath: 0, spots: 0.6, veins: 0.9, rough: 0.3, sheen: 0.2, scale: 2.6 });
  const mats = [tflesh, shellM, plateM, crystal, tooth, flesh, lining];

  const root = new THREE.Group(), body = new THREE.Group(); body.position.y = 0.92; root.add(body);
  const RX = 1.1, RY = 0.88, RZ = 1.02, HZ = -0.96;
  // media esfera (cúpula) con base en y=0
  const [dw, dh] = low ? [14, 7] : hi ? [28, 12] : [20, 9];
  const domeGeo = new THREE.SphereGeometry(1, dw, dh, 0, TAU, 0, Math.PI / 2);
  const dome = (m, sx, sy, sz) => { const d = new THREE.Mesh(domeGeo, m); d.scale.set(sx, sy, sz); return d; };

  // ── valva: pivote en la bisagra trasera; dentro, el grupo con cúpula + forro + placas + dientes
  function valve(sign) {
    const pivot = new THREE.Group(); pivot.position.set(0, 0, HZ); body.add(pivot);
    const g = new THREE.Group(); g.position.z = -HZ; pivot.add(g);
    const flip = new THREE.Group(); flip.scale.y = sign; g.add(flip);      // sign -1 => valva inferior (espejo)
    const ry = sign > 0 ? RY : RY * 0.8;
    flip.add(dome(shellM, RX, ry, RZ));
    flip.add(dome(lining, RX * 0.94, ry * 0.9, RZ * 0.94));
    // costillas (anillos de placa) para dar lectura de caparazón
    const ribs = low ? 3 : 5;
    for (let i = 0; i < ribs; i++) {
      const ph = (i + 0.5) / ribs * Math.PI, rh = 1 / Math.sqrt((Math.cos(ph) / RX) ** 2 + (Math.sin(ph) / RZ) ** 2);
      const rib = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 4, low ? 10 : 16, Math.PI), plateM);
      rib.rotation.y = ph; rib.scale.set(rh * 1.015, ry * 1.015, 1); flip.add(rib);
    }
    // escudos hexagonales planos y cristales que brotan de las grietas
    const scutes = scatterOnSurface(flip, low ? 8 : 16, [RX * 1.0, ry, RZ * 1.0], (i) => { if (i % 3 === 0) return null; const h = horn(plateM, 0.2 + (i % 4) * 0.03, 0.1 + (i % 3) * 0.04, 6); return h; }, { from: 0.04, to: 0.5, seed: sign * 2 + 1 });
    const crys = scatterOnSurface(flip, low ? 4 : 9, [RX * 0.98, ry * 0.98, RZ * 0.98], (i) => { if (i % 3 !== 0) return null; const c = crystalSpike(crystal, 0.075 + (i % 4) * 0.02, 0.22 + (i % 5) * 0.07); c.rotation.z += (i % 2 ? 0.2 : -0.2); return c; }, { from: 0.03, to: 0.46, seed: sign * 1.7 + 4 });
    // dientes de nácar en el borde frontal
    const nT = low ? 5 : 9;
    for (let i = 0; i < nT; i++) {
      const a = (i / (nT - 1) - 0.5) * 2 * 1.15;                           // arco frontal del borde
      const t = horn(tooth, 0.075, 0.28 + 0.1 * Math.sin(i * 1.7) ** 2, 6);
      t.position.set(Math.sin(a) * RX * 0.9, 0, Math.cos(a) * RZ * 0.9); t.rotation.x = Math.PI; flip.add(t);
    }
    [plateM, crystal, tooth].forEach((m) => mergeStatic(flip, m));
    return { pivot, flip, crys };
  }
  const up = valve(1), lo = valve(-1);

  // ── interior: manto carnoso sobre la valva inferior + ojo-núcleo + lengua de tentáculos
  const inner = new THREE.Group(); inner.position.set(0, 0.02, 0.05); body.add(inner);
  const mantle = blob(flesh, 0.8, 1.15, 0.5, 1.15); mantle.position.set(0, -0.12, 0); inner.add(mantle);
  const lipsG = new THREE.Group(); inner.add(lipsG); // labios del manto (bultos que laten), fundidos en 1 malla
  const lipGeo = new THREE.SphereGeometry(1, low ? 8 : 12, low ? 5 : 8);
  for (let i = 0; i < (low ? 4 : 7); i++) { const a = (i / (low ? 4 : 7)) * TAU; const b = new THREE.Mesh(lipGeo, flesh); b.scale.set(0.22, 0.18, 0.26); b.position.set(Math.cos(a) * 0.8, -0.05, Math.sin(a) * 0.82); lipsG.add(b); }
  mergeStatic(lipsG, flesh);
  const neck = blob(flesh, 0.3, 1, 1.1, 1); neck.geometry = new THREE.SphereGeometry(1, 14, 9); neck.position.set(0, 0.2, 0.15); inner.add(neck); const core = fixEye(eye({ r: 0.46, iris: 0xff5a14, glow: 0.5 })); core.mats[0].color.set(0xffd2c0); core.mats[0].emissive.set(0x601810); core.object.position.set(0, 0.5, 0.25);  inner.add(core.object);
  const haloS = glowSprite(0xffa040, 1.4, 0);
  haloS.position.set(0, 0.66, -0.05); inner.add(haloS); 
  const tongue = [];
  const nTen = low ? 3 : 5;
  for (let i = 0; i < nTen; i++) {
    const t = tentacle(tflesh, { len: 0.85 + (i % 2) * 0.25, r0: 0.09, r1: 0.025, hang: false, amp: 0.18, speed: 2.4 + i * 0.3, freq: 3.4 });
    const g = new THREE.Group(); g.position.set((i - (nTen - 1) / 2) * 0.3, 0.1, 0.55); g.rotation.set(Math.PI / 2 - 0.2, 0, (i - (nTen - 1) / 2) * 0.5); g.add(t); inner.add(g); tongue.push({ g, t });
  }
  const fringe = []; // flecos finos en el borde de la valva inferior
  if (!low) for (let i = 0; i < 7; i++) {
    const a = -0.9 + (i / 6) * (Math.PI + 1.8) - Math.PI / 2 + Math.PI / 2; const t = tentacle(tflesh, { len: 0.5, r0: 0.045, r1: 0.01, hang: false, amp: 0.12, speed: 3 + (i % 3), freq: 4 });
    const g = new THREE.Group(); g.position.set(Math.sin(a - 0.0) * RX * 0.78, 0.05, Math.cos(a) * RZ * 0.78); g.rotation.set(0.3 * Math.cos(a), 0, -0.3 * Math.sin(a)); g.add(t); inner.add(g); fringe.push(g);
  }
  mats.push(...tongue.map((x) => x.t.userData.mat));

  // aura de escudo
  const aura = shieldAura(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), 1.5); body.add(aura);

  const sOpen = new Spring(0, 55, 7.5), sWob = new Spring(0, 70, 6), sShake = new Spring(0, 90, 5);
  let roll = 0, glowT = 0, prevOpen = false, snap = 0; const tmp = new THREE.Vector3(0, 0.4, 1);

  return { root, mats, tick(dt, st, t, ctx = {}) {
    const open = !!(st.o || st.s === 'open'), speed = Math.min(1.6, ctx.speed || 0), hurtLow = st.hp != null && st.hp < 0.35;
    if (open && !prevOpen) snap = 1; prevOpen = open; snap = Math.max(0, snap - dt * 2.5);
    const o = Math.max(0, sOpen.step(dt, open ? 1 : 0)); const oc = Math.min(1.1, o);
    // bisagra: valva superior se alza (con rebote), la inferior baja un poco
    up.pivot.rotation.x = -oc * 1.12; lo.pivot.rotation.x = oc * 0.34;
    // rodar cerrada, nivelar al abrir
    if (open || o > 0.05) { const tgt = Math.round(roll / TAU) * TAU; roll += (tgt - roll) * Math.min(1, 7 * dt); } else roll += dt * (speed * 3.4);
    const wob = sWob.step(dt, (open ? 0 : Math.sin(roll * 2) * 0.05));
    body.rotation.x = roll + wob; body.rotation.z = Math.sin(t * 1.1 + st.id) * 0.03 * (1 - oc) + (hurtLow ? Math.sin(t * 17) * 0.05 : 0);
    body.position.y = 0.92 + (open ? 0.02 : Math.abs(Math.sin(roll * 2)) * 0.05 * speed) - snap * 0.0 + Math.sin(t * 2.2 + st.id) * 0.015;
    body.scale.set(1 + 0.02 * Math.sin(t * 2.3) * oc, 1, 1);
    // aturdida: tiembla; escudada: aura
    const shk = sShake.step(dt, st.st ? Math.sin(t * 40) * 0.08 : 0); root.position.x = shk; root.rotation.z = st.st ? Math.sin(t * 31) * 0.05 : 0;
    tickAura(aura, st, t);
    // interior: sólo visible/activo al abrir; el ojo se asoma y arde
    const beat = 0.5 + 0.5 * Math.sin(t * (hurtLow ? 9 : 5.2)), pul = oc * (0.6 + 0.4 * beat);
    inner.scale.setScalar(0.55 + 0.45 * Math.min(1, o)); core.object.scale.setScalar(0.35 + 0.65 * oc * (1 + 0.06 * beat));
    core.update(dt, ctx.look || tmp, { dilate: -0.15 + 0.35 * beat, glowMul: 0.5 + 0.9 * oc * (0.7 + 0.5 * beat) });
    haloS.material.opacity = oc * (0.22 + 0.16 * beat) * (0.8 + snap * 0.5); haloS.scale.setScalar(1.4 + 0.3 * beat + snap * 0.6);
    glowT += (oc - glowT) * Math.min(1, 10 * dt);
    flesh.userData.u.uGlow.value = tflesh.userData.u.uGlow.value = 0.05 + glowT * 0.3; flesh.userData.u.uPulse.value = open ? 0.35 + snap : 0;
    lining.userData.u.uGlow.value = 0.03 + glowT * 0.2;
    mantle.scale.set(0.92 * (1 + 0.04 * beat * oc), 0.4 * (1 + 0.1 * beat), 0.92);
    lipsG.scale.set(1 + 0.05 * beat * oc, 1 + 0.35 * beat * oc, 1 + 0.05 * beat * oc);
    tongue.forEach((T, i) => { T.t.userData.u.uAmp.value = 0.1 + 0.35 * oc + (hurtLow ? 0.25 : 0); T.t.userData.u.uSpeed.value = 2 + (hurtLow ? 3 : 0) + i * 0.2; T.g.scale.set(1, Math.max(0.05, oc), 1); T.g.rotation.x = Math.PI / 2 - 0.2 - 0.2 * Math.sin(t * 1.8 + i) * oc; });
    fringe.forEach((g, i) => { g.scale.setScalar(Math.max(0.05, oc)); });
    // cristales: brillan más cerrados (alerta de blindaje) y titilan
    crystal.userData.u.uGlow.value = 0.7 + 0.4 * Math.sin(t * 5) + (open ? -0.1 : 0.2); crystal.emissiveIntensity = 0.55 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4)) + (hurtLow ? 0.4 * Math.sin(t * 20) ** 2 : 0);
    // al abrirse la valva superior se agita levemente por el latido
    up.flip.position.y = 0.012 * beat * oc;
  } };
}
