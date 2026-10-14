// EL FAMILIAR (id interno «graviton», control) — el perro negro gigante que el patrón de la estancia le entrega al Malo: pelaje negro
// como hollín con GRIETAS DE BRASA, ojos de carbón encendido, collar de hierro con la cadena rota colgando y una cola de HUMO. Flota
// (las patas cuelgan y «nadan» despacio) rodeado de un remolino lento de motas. AVISO ('charge', 1.3 s): se encoge, levanta la cabeza y
// AÚLLA con la boca abierta, los ojos y las grietas se vuelven blancas, ANILLOS DE GRAVEDAD giran a su alrededor y las motas caen hacia
// él (= la gravedad se va a invertir). NÚCLEO = brasa del pecho, entre las patas delanteras.
import { THREE, lod, clamp, lerp, smooth, Rig, cuadrupedo, andar, cabezaCanina, carne, velo, metal, brillo, setBrillo, nucleo, motas, aro, sudario, cadena, ellipsoid, spike, paint, skinRigid, skinChain, skinFn, disposer, shieldAura, tickAura, Spring, dampTo, TAU, rng, joinUV } from './alma-kit.js';

export default function build(kit, color = 0xff3a1a) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const hide = carne({ vein: 0xff4a10, veinK: 0.2, veinGlow: 0.8, lift: 0.0, color: 0x505050, sss: 0.1, sssColor: 0xff3010, rimColor: 0xff5a20, rim: 0.25, tex: 'scales', tile: 5, bump: 1.2, rough: 0.85, clear: 0, grain: 0.8 });
  const smoke = velo(0x14080a, { alpha: 0.75, rimColor: 0xff4a20, rim: 1.2, flutter: 0.1, speed: 2.4, hem: 0.4, hemGlow: 0.9, weave: 0, sheen: 0, iri: 0.7 });
  const iron = metal(0x2a2624, { rough: 0.55 });
  const eyeM = brillo(0xff6a20, 2.6);
  const mats = [hide, smoke, iron, eyeM];
  const rig = new Rig();
  const Q = cuadrupedo(rig, { len: 1.0, hipY: 0.82, chestY: 0.92, lx: 0.17, ex: [0.82, 1.05], neck: [[0.14, 0.12], [0.3, 0.26]], tail: { n: 4, len: 0.9, rise: 0.2 }, front: [0.42, 0.4], rear: [0.42, 0.42], legR: [0.085, 0.04], foot: 0.12, matBody: hide,
    barrel: (t) => 0.2 + 0.08 * smooth(0.2, 0.9, t) + 0.02 * Math.sin(t * 9), neckR: 0.15,
    bodyPaint: (p) => new THREE.Color(0x141010).lerp(new THREE.Color(0x060404), smooth(1.0, 0.6, p.y)), legPaint: 0x0a0808,
    footGeo: (A, F, s) => { const g = ellipsoid([0.065, 0.04, 0.09], { w: 8, h: 6, pos: [A.x, A.y - 0.02, A.z + 0.05] }); paint(g, 0x080606); return g; } });
  const { root, pelvis, spine, chest, neck0, neck1, head, tail, legs } = Q;
  // cabeza de perro grande con mandíbula; ojos de brasa
  const hpos = head.userData.rest, hd = cabezaCanina(0.25, { snout: 1.35, ears: 0.75, color: 0x0c0a0a, gum: 0x801808, teethC: 0xf0e0c0 });
  hd.skull.translate(hpos.x, hpos.y, hpos.z); rig.add(hide, skinRigid(hd.skull, head));
  const jaw = rig.bone(head, [hpos.x, hpos.y - 0.01, hpos.z + 0.04], 'jaw'); hd.jaw.translate(hpos.x, hpos.y, hpos.z); rig.add(hide, skinRigid(hd.jaw, jaw));
  for (const e of hd.eyePos) { const g = new THREE.SphereGeometry(1, 8, 6); g.scale(0.045, 0.03, 0.025); g.translate(hpos.x + e[0], hpos.y + e[1], hpos.z + e[2] + 0.01); rig.add(eyeM, skinRigid(g, head)); }
  // melena erizada de pelo-espina en la cruz y el lomo
  { const R = rng(4), parts = []; for (let i = 0; i < (low ? 12 : 24); i++) { const z = lerp(-0.4, 0.62, R()), y = (z > 0.3 ? 1.15 : 1.05) + R() * 0.04, a = (R() - 0.5) * 1.6; const g = spike(0.03, 0.14 + R() * 0.12, { sides: 3, seg: 2, bend: 0.4, bendDir: [0, 0, -1], pos: [Math.sin(a) * 0.15, y - (1 - Math.cos(a)) * 0.2, z], dir: [Math.sin(a) * 0.8, 1, -0.6] }); paint(g, 0x0a0606); parts.push([g, z]); }
    parts.forEach(([g, z]) => rig.add(hide, skinRigid(g, z > 0.3 ? chest : z > -0.2 ? spine : pelvis))); }
  // collar de hierro con púas + cadena rota que cuelga
  const n0 = neck0.userData.rest, collar = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * TAU; collar.push([Math.sin(a) * 0.19, n0.y + 0.03 + Math.cos(a) * 0.17, n0.z + 0.02 - Math.cos(a) * 0.03]); }
  rig.add(iron, skinRigid(cadena(collar, { link: 0.07, thick: 0.016 }), neck0));
  rig.add(iron, skinFn(cadena([[0, n0.y - 0.15, n0.z + 0.05], [0.02, n0.y - 0.4, n0.z + 0.0], [0.05, n0.y - 0.7, n0.z - 0.08], [0.08, n0.y - 0.95, n0.z - 0.2]], { link: 0.08, thick: 0.017, seed: 3 }), (p) => [[neck0, smooth(n0.y - 0.5, n0.y - 0.1, p.y)], [chest, 1 - smooth(n0.y - 0.5, n0.y - 0.1, p.y)]]));
  // cola de humo (sudario oscuro que se deshace en brasas)
  const pl = pelvis.userData.rest, tp = [[0, pl.y + 0.06, pl.z - 0.1], ...tail.map((b) => b.userData.rest.toArray())];
  const smk = sudario(tp, { rad: (t) => lerp(0.06, 0.22, smooth(0, 1, t)), rows: 14, cols: 14, tatter: 0.5, seed: 8, up: [0, 1, 0], color: 0x1a0a08, colorEnd: 0x401008 });
  rig.add(smoke, skinChain(smk, [pelvis, ...tail], 0.1));
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 1.15; rootObj.scale.setScalar(K); rootObj.position.y = -0.75;
  const core = nucleo(color, 0.085, { halo: 9 }); chest.add(core.object); core.object.position.set(0, -0.2, 0.14); mats.push(...core.mats);
  const rings = [aro(color, { n: 3, dir: -1, speed: 1.6, vertical: true }), aro(0xffa060, { n: 3, dir: -1, speed: 2.0, vertical: true }), aro(color, { n: 5, dir: -1, speed: 1.2 })];
  rings.forEach((r, i) => { r.position.y = 0.8; rootObj.add(r); mats.push(r.material); }); rings[2].position.y = 0.0;
  const swirl = motas(30, { color: 0xff7a3a, size: 0.05, modo: 'orbit', box: [1.0, 1.0, 1.0], speed: 0.25 }); swirl.position.y = 0.8; rootObj.add(swirl); mats.push(swirl.material);
  const fall = motas(28, { color: 0xffd0a0, size: 0.05, modo: 'suck', box: [2.2, 2.2, 2.2], speed: 0.9, k: 0, center: [0, 0, 0] }); fall.position.y = 0.8; rootObj.add(fall); mats.push(fall.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.25); aura.position.set(0, 0.8, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, swirl.userData.geo, fall.userData.geo]));
  // ── animación ──
  const cache = new Map(), sHy = new Spring(0, 40, 6), look = new V3(0, 0, 1);
  let ph = 0, chK = 0, prevHp = 1, flinch = 0, pant = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const ch = st.s === 'charge', hurt = st.hp != null && st.hp < 0.35; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    chK = dampTo(chK, ch ? 1 : 0, ch ? 6 : 3, dt); const idle = 1 - chK; ph += dt * 2.2; pant = Math.sin(t * 7);
    // flota con un vaivén pesado; en el aviso se eleva y se encoge
    rootObj.position.y = -0.75 + Math.sin(t * 1.2 + st.id) * 0.08 + chK * 0.15; rootObj.rotation.z = Math.sin(t * 0.9) * 0.05;
    pelvis.rotation.x = -0.1 * idle + chK * 0.25 + Math.sin(t * 1.2) * 0.04; spine.rotation.x = 0.04 + chK * 0.1; chest.rotation.x = -chK * 0.45 + flinch * 0.1;
    chest.scale.set(1 + pant * 0.015 * idle, 1 + pant * 0.02 * idle, 1);
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    neck0.rotation.y = sHy.step(dt, clamp(lx, -0.8, 0.8) * 0.45 * idle); neck0.rotation.x = -clamp(ly, -0.4, 0.4) * 0.3 * idle - chK * 0.7; neck1.rotation.x = -chK * 0.35; head.rotation.x = -chK * 0.4 + Math.sin(t * 0.7) * 0.05;
    jaw.rotation.x = 0.1 + Math.max(0, pant) * 0.12 * idle + chK * (0.75 + 0.08 * Math.sin(t * 30)) + flinch * 0.3;
    // patas: cuelgan y «nadan» en el aire (andar lento sin piso)
    andar(Q, ph, 1, { stride: 0.2, lift: 0.12, order: [0, 0.5, 0.25, 0.75], duty: 0.5, cache, override: (i, p, Lg) => { p.y += 0.12 + chK * 0.15; if (chK > 0.01) p.z += (Lg.front ? 0.12 : -0.1) * chK; } });
    tail.forEach((b, i) => { b.rotation.x = 0.15 + Math.sin(t * 2 - i * 0.8) * 0.15 - chK * 0.2; b.rotation.y = Math.sin(t * 1.3 - i * 0.7) * 0.3; });
    // luz: grietas de brasa → blancas; anillos de gravedad y motas que caen hacia él (AVISO)
    hide.userData.u.uVeinGlow.value = 0.8 + 0.4 * Math.sin(t * 3) + chK * 2.5 + (hurt ? 0.6 : 0);
    setBrillo(eyeM, 2.2 + chK * 3.5);
    core.set(1 + chK * 1.6 + flinch * 0.5, t, dt);
    rings[0].userData.setK(chK); rings[0].rotation.set(t * 1.4, t * 0.9, 0); rings[0].scale.setScalar(1.5 + chK * 0.6);
    rings[1].userData.setK(chK * 0.8); rings[1].rotation.set(Math.PI / 2 + t * 0.7, 0, t * 1.3); rings[1].scale.setScalar(1.8);
    rings[2].userData.setK(chK * 0.9); rings[2].scale.setScalar(2.4);
    swirl.material.uniforms.uK.value = 0.6 * idle + 0.3; swirl.material.uniforms.uSpd.value = 0.25 + chK * 1.2;
    fall.material.uniforms.uK.value = chK * 1.3;
    smoke.userData.u.uFlut.value = 0.08 + chK * 0.1;
    tickAura(aura, st, t);
  } };
}
