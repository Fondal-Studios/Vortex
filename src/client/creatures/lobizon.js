// LOBIZÓN (id interno «ariete», embestidor) — el séptimo hijo varón que las noches de luna llena se vuelve lobo. Bestia jorobada de
// HOMBROS ENORMES y patas delanteras largas como brazos (manos con garras), grupa baja, cabeza de lobo de hocico largo con colmillos,
// pelo gris-negro apelmazado con una cresta erizada en el lomo y los JIRONES DE LA CAMISA que tenía de hombre. Ojos verde-luna.
// AVISO ('wind', 1 s): SE PARA EN DOS PATAS, abre los brazos con las garras, aúlla hacia arriba, los ojos y las venas se encienden y
// escarba el piso → 'charge': galope bajo y estirado, orejas atrás, estela de motas → 'stun': queda sentado, mareado, la cabeza le
// cuelga y le giran lucecitas alrededor (= momento de pegarle, recibe ×1.5). NÚCLEO = corazón verde en el pecho.
import { THREE, lod, clamp, lerp, smooth, Rig, cuadrupedo, andar, cabezaCanina, carne, pelo, velo, brillo, setBrillo, nucleo, motas, sudario, spike, tube, paint, ellipsoid, skinRigid, skinChain, skinFn, disposer, shieldAura, tickAura, Spring, dampTo, TAU, rng, joinUV } from './alma-kit.js';

export default function build(kit, color = 0x4affb0) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const fur = pelo({ rimColor: color, rim: 0.12, seam: 0x020202, seamK: 0.3, lift: 0.03 });
  const flesh = carne({ vein: color, veinK: 0.35, veinGlow: 0.6, sssColor: 0x80ffc0, rimColor: color, rim: 0.4, tex: 'flesh', rough: 0.6 });
  const rag = velo(0x6a5a48, { alpha: 1, rimColor: color, rim: 0.3, flutter: 0.06, speed: 3, weave: 1.2, emissiveLift: 0.03, iri: 0.3 });
  const eyeM = brillo(color, 2.6);
  const mats = [fur, flesh, rag, eyeM];
  const rig = new Rig();
  const claws = (A, F, s, front) => { const parts = []; const pw = front ? 0.11 : 0.08; const pad = ellipsoid([pw, 0.04, pw * 1.2], { w: 8, h: 6, pos: [A.x, A.y - 0.03, A.z + 0.06] }); paint(pad, 0x1a1614); parts.push(pad);
    for (let i = 0; i < 4; i++) { const x = A.x + (i - 1.5) * pw * 0.55; const c = spike(0.016, front ? 0.13 : 0.09, { sides: 4, seg: 2, bend: 0.5, bendDir: [0, -1, 0], pos: [x, A.y - 0.03, A.z + pw * 1.1], dir: [0, -0.3, 1] }); paint(c, 0xe8e0c8); parts.push(c); }
    return joinUV(parts); };
  const Q = cuadrupedo(rig, { len: 1.05, hipY: 0.78, chestY: 1.06, lx: 0.2, ex: [0.95, 1.05], neck: [[0.08, 0.14], [0.14, 0.32]], tail: { n: 4, len: 0.6, rise: -0.1 }, front: [0.5, 0.52], rear: [0.42, 0.4], legR: [0.1, 0.05], foot: 0.1, matBody: fur,
    barrel: (t) => 0.17 + 0.15 * smooth(0.35, 0.95, t), neckR: 0.15,
    bodyPaint: (p) => new THREE.Color(0x2e2a26).lerp(new THREE.Color(0x0c0a08), smooth(1.15, 0.75, p.y)), legPaint: (p) => new THREE.Color(0x3a3630).lerp(new THREE.Color(0x0e0c0a), smooth(0.5, 0.1, p.y)), footGeo: claws });
  const { root, pelvis, spine, chest, neck0, neck1, head, tail, legs } = Q;
  const hpos = head.userData.rest, hd = cabezaCanina(0.28, { snout: 1.5, ears: 1.1, color: 0x2a2622, gum: 0x6a1020, teethC: 0xf4ecd8, lupino: 1 });
  hd.skull.translate(hpos.x, hpos.y, hpos.z); rig.add(fur, skinRigid(hd.skull, head));
  const jaw = rig.bone(head, [hpos.x, hpos.y - 0.01, hpos.z + 0.04], 'jaw'); hd.jaw.translate(hpos.x, hpos.y, hpos.z); rig.add(flesh, skinRigid(hd.jaw, jaw));
  for (const e of hd.eyePos) { const g = new THREE.SphereGeometry(1, 8, 6); g.scale(0.032, 0.02, 0.018); g.translate(hpos.x + e[0], hpos.y + e[1], hpos.z + e[2] + 0.01); rig.add(eyeM, skinRigid(g, head)); }
  // cresta erizada (lomo y hombros) + mechones en codos
  { const R = rng(7); for (let i = 0; i < (low ? 14 : 26); i++) { const z = lerp(-0.45, 0.7, R()), hy = z > 0.3 ? 1.38 : lerp(1.0, 1.3, (z + 0.45) / 0.75), a = (R() - 0.5) * 1.8;
    const g = spike(0.035, 0.12 + R() * 0.14 + (z > 0.2 ? 0.08 : 0), { sides: 3, seg: 2, bend: 0.5, bendDir: [0, 0, -1], pos: [Math.sin(a) * 0.2, hy - (1 - Math.cos(a)) * 0.25, z], dir: [Math.sin(a), 1.2, -0.7] }); paint(g, (p) => new THREE.Color(0x1a1814).lerp(new THREE.Color(0x8a8478), 0.35 * R())); rig.add(fur, skinRigid(g, z > 0.25 ? chest : z > -0.2 ? spine : pelvis)); } }
  // jirones de camisa en el pecho/hombros
  const ch = chest.userData.rest;
  const shirt = sudario([[0, ch.y + 0.22, ch.z - 0.25], [0, ch.y + 0.05, ch.z - 0.05], [0, ch.y - 0.15, ch.z + 0.05], [0, ch.y - 0.38, ch.z + 0.08]], { rad: (t) => 0.27 + 0.06 * t, rows: 8, cols: 18, tatter: 0.65, seed: 3, up: [0, 0, 1], color: 0x8a7a64, colorEnd: 0x3a3024, kStart: 0.15 });
  rig.add(rag, skinChain(shirt, [spine, chest], 0.15));
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 1.0; rootObj.scale.setScalar(K); rootObj.position.y = -0.9;
  const core = nucleo(color, 0.08, { halo: 9 }); chest.add(core.object); core.object.position.set(0, -0.15, 0.24); mats.push(...core.mats);
  const trail = motas(24, { color, size: 0.05, modo: 'trail', box: [0.6, 0.6, 2.2], speed: 1.4, k: 0 }); trail.position.set(0, 1.0, -0.4); rootObj.add(trail); mats.push(trail.material);
  const stars = motas(10, { color: 0xe8fff0, size: 0.07, modo: 'orbit', box: [0.38, 0.1, 0.38], speed: 0.9, k: 0 }); rootObj.add(stars); mats.push(stars.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.4); aura.position.set(0, 0.9, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, trail.userData.geo, stars.userData.geo]));
  // ── animación ──
  const cache = new Map(), sHy = new Spring(0, 40, 6), look = new V3(0, 0, 1), hw = new V3();
  let ph = 0, walkK = 0, windK = 0, chK = 0, stunK = 0, prevHp = 1, flinch = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const wind = st.s === 'wind', charge = st.s === 'charge', stun = st.s === 'stun' || !!st.st, speed = Math.min(1.6, ctx.speed || 0), hurt = st.hp != null && st.hp < 0.35; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    windK = dampTo(windK, wind ? 1 : 0, wind ? 7 : 6, dt); chK = dampTo(chK, charge ? 1 : 0, 8, dt); stunK = dampTo(stunK, stun ? 1 : 0, 6, dt);
    walkK = dampTo(walkK, charge ? 1 : Math.min(1, speed * 1.3), 6, dt); ph += dt * (3 + walkK * 6 + chK * 8);
    // parado en dos patas (aviso): la grupa baja, el pecho sube
    const rear = windK, bob = Math.abs(Math.sin(ph)) * 0.05 * walkK;
    pelvis.rotation.x = -rear * 0.95 + chK * 0.05 + stunK * 0.1; pelvis.position.y = pelvis.userData.rest.y - rear * 0.12 - chK * 0.08 - stunK * 0.25 + bob;
    spine.rotation.x = -rear * 0.25 + Math.sin(ph * 2) * 0.04 * chK; chest.rotation.x = -rear * 0.2 + chK * 0.1 + flinch * 0.1 + stunK * 0.2;
    chest.scale.set(1 + Math.sin(t * 3) * 0.02, 1 + Math.sin(t * 3) * 0.02, 1);
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    neck0.rotation.y = sHy.step(dt, clamp(lx, -0.8, 0.8) * 0.4 * (1 - chK) + (stunK > 0.1 ? Math.sin(t * 4) * 0.4 : 0));
    neck0.rotation.x = -clamp(ly, -0.4, 0.4) * 0.3 - rear * 0.5 + chK * 0.35 + stunK * 0.7; head.rotation.x = -rear * 0.5 + chK * 0.1 + stunK * 0.2; head.rotation.z = stunK * Math.sin(t * 3) * 0.3;
    jaw.rotation.x = 0.12 + rear * (0.7 + 0.06 * Math.sin(t * 28)) + chK * 0.4 + flinch * 0.3 + stunK * 0.35;
    tail.forEach((b, i) => { b.rotation.x = -0.2 + chK * 0.35 + rear * 0.4 - stunK * 0.4; b.rotation.y = Math.sin(t * 4 - i) * 0.2 * (1 - chK); });
    // patas: trote ↔ galope; en dos patas los brazos se abren con las garras; mareado se sienta
    andar(Q, ph, walkK, { stride: 0.32 + chK * 0.25, lift: 0.2, order: chK > 0.5 ? [0, 0.12, 0.55, 0.67] : [0, 0.5, 0.5, 0], duty: chK > 0.5 ? 0.4 : 0.55, cache, override: (i, p, Lg) => {
      if (rear > 0.01) { if (Lg.front) p.lerp(new V3(Lg.side * (0.42 + Math.sin(t * 9 + i) * 0.04), 1.25 + Math.sin(t * 9 + i * 2) * 0.08, 0.55), rear); else p.lerp(new V3(Lg.side * 0.24, 0.0, -0.05 + (i === 2 ? Math.max(0, Math.sin(t * 14)) * 0.15 : 0)), rear); }
      if (stunK > 0.01) { if (Lg.front) p.lerp(new V3(Lg.side * 0.2, 0.05, 0.6), stunK); else p.lerp(new V3(Lg.side * 0.32, 0.05, -0.2), stunK); }
    } });
    // luz
    setBrillo(eyeM, 2.2 + rear * 3 + chK * 1.5 - stunK * 1.6); flesh.userData.u.uVeinGlow.value = 0.6 + rear * 2 + chK;
    fur.userData.u.uRim.value = 0.35 + rear * 1.0 + chK * 0.6;
    core.set((1 + rear * 1.4 + chK * 0.8 + stunK * 1.2 + flinch * 0.5) * (hurt ? (Math.sin(t * 15) > 0 ? 1 : 0.5) : 1), t, dt);
    trail.material.uniforms.uK.value = chK * 1.2;
    head.updateMatrixWorld(true); hw.set(hpos.x, hpos.y + 0.35, hpos.z).applyMatrix4(new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(head.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(-hpos.x, -hpos.y, -hpos.z)));
    stars.position.copy(hw); stars.material.uniforms.uK.value = stunK * 1.3;
    tickAura(aura, st, t);
  } };
}
