// ALMAMULA (id interno «geoda», tanque) — la mula sin cabeza del folclore: cuerpo de mula de cuero chamuscado con grietas de brasa,
// costillas al aire, cadenas enroscadas al lomo y una cadena que arrastra; del muñón del cuello sale una LLAMARADA (se lee de lejos).
// Sobre el lomo lleva un CAPARAZÓN DE COSTILLAS GIGANTES: en 'roll' se enrosca (cuello abajo, patas recogidas), las costillas se cierran
// como una jaula-bola y rueda casi inmune; en 'open' se planta, se encabrita un poco, las costillas se abren hacia arriba como un abanico
// y deja ver el NÚCLEO al rojo blanco en el pecho (= momento de pegarle). st.sd escudo · st.hp baja: más brasas y humo.
import { THREE, lod, clamp, lerp, smooth, Rig, cuadrupedo, andar, carne, hueso, pelo, metal, brillo, setBrillo, nucleo, motas, fuego, llama, cadena, tube, spike, paint, skinRigid, skinChain, skinFn, ellipsoid, orient, disposer, shieldAura, tickAura, Spring, dampTo, TAU } from './alma-kit.js';
import { plate } from './geoda-bio.js';

export default function build(kit, color = 0xff6a1a) {
  const L = lod(), low = L.low, V3 = THREE.Vector3;
  const hide = carne({ vein: 0xff5a10, veinK: 0.55, veinGlow: 1.1, sss: 0.15, sssColor: 0xff4010, rimColor: 0xff8a40, rim: 0.3, tex: 'flesh', tile: 2.4, bump: 0.9, clear: 0.05, rough: 0.8 });
  const bone = hueso({ rimColor: 0xffa060, rim: 0.3 });
  const iron = metal(0x3a3632, { rough: 0.5, glow: 0 });
  const fireM = fuego(0xff3a08, 0xffe080, { k: 1, speed: 1.1, wob: 0.22 });
  const mats = [hide, bone, iron, fireM];
  const rig = new Rig();
  const len = 1.15, hipY = 1.0, chestY = 1.04;
  const Q = cuadrupedo(rig, { len, hipY, chestY, lx: 0.2, ex: [0.78, 1.05], neck: [[0.14, 0.14], [0.42, 0.3]], head: false, tail: { n: 4, len: 0.62, rise: 0.05 }, front: [0.5, 0.46], rear: [0.52, 0.46], legR: [0.1, 0.045], foot: 0.09, matBody: hide,
    barrel: (t) => 0.26 + 0.07 * Math.sin(t * Math.PI) + 0.02 * smooth(0.7, 1, t), neckR: 0.13,
    bodyPaint: (p) => new THREE.Color(0x3a261c).lerp(new THREE.Color(0x120a08), smooth(hipY + 0.2, hipY - 0.3, p.y)).lerp(new THREE.Color(0x5a2e18), 0.4 * Math.pow(Math.abs(Math.sin(p.z * 23 + p.y * 7)), 8)),
    legPaint: (p) => new THREE.Color(0x2a1a12).lerp(new THREE.Color(0x0a0605), smooth(0.6, 0.1, p.y)),
    footGeo: (A, F, s) => { const g = tube([[A.x, A.y + 0.02, A.z], [A.x, 0.05, A.z + 0.02], [A.x, 0.0, A.z + 0.03]], { rad: [0.05, 0.065], seg: 3, sides: 8 }); paint(g, 0x0a0806); return g; } });
  const { root, pelvis, spine, chest, neck0, neck1, tail, legs } = Q;
  // ── muñón del cuello: carne desgarrada + vértebra al aire ──
  const n1 = neck1.userData.rest;
  const stump = ellipsoid([0.15, 0.08, 0.14], { w: low ? 10 : 14, h: 7, noise: 0.35, seed: 4, pos: [0, n1.y + 0.02, n1.z + 0.02] }); paint(stump, (p) => new THREE.Color(0x5a1408).lerp(new THREE.Color(0xff6a20), smooth(n1.y + 0.02, n1.y + 0.09, p.y))); rig.add(hide, skinRigid(stump, neck1));
  const vert = spike(0.035, 0.16, { sides: 6, seg: 2, pos: [0, n1.y + 0.04, n1.z], dir: [0, 1, 0.3] }); paint(vert, 0xe0d0b0); rig.add(bone, skinRigid(vert, neck1));
  // ── costillas al aire en los flancos ──
  for (const s of [-1, 1]) for (let i = 0; i < (low ? 3 : 5); i++) { const z = 0.32 - i * 0.12, y = chestY + 0.18, r = 0.33;
    const g = tube([[s * 0.06, y, z], [s * r * 0.85, y - 0.1, z - 0.02], [s * r * 1.02, y - 0.32, z - 0.04], [s * r * 0.75, y - 0.52, z - 0.03]], { rad: 0.016, seg: low ? 6 : 9, sides: 4 }); paint(g, 0xcdbd9a); rig.add(bone, skinChain(g, [spine, chest], 0.2)); }
  // ── cadenas: dos vueltas al tronco + una que cuelga del cuello y se arrastra ──
  const wrap = []; for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU * 2 + 0.6, z = lerp(-0.45, 0.42, i / 28), r = 0.36 + 0.03 * Math.sin(i); wrap.push([Math.sin(a) * r * 0.82, hipY + 0.02 + Math.cos(a) * r * 1.0, z]); }
  rig.add(iron, skinChain(cadena(wrap, { link: low ? 0.12 : 0.09, thick: 0.018, seed: 2 }), [pelvis, spine, chest], 0.2));
  const drag = [[0.06, n1.y - 0.15, n1.z - 0.05], [0.12, chestY - 0.25, len / 2 + 0.12], [0.14, 0.35, len / 2 + 0.05], [0.18, 0.03, len / 2 - 0.25], [0.24, 0.01, -0.4], [0.3, 0.01, -1.1], [0.36, 0.01, -1.5]];
  rig.add(iron, skinFn(cadena(drag, { link: low ? 0.13 : 0.1, thick: 0.02, seed: 5 }), (p) => [[neck0, smooth(0.4, 0.9, p.y)], [chest, smooth(0.1, 0.4, p.y) * (1 - smooth(0.4, 0.9, p.y))], [root, 1 - smooth(0.06, 0.25, p.y)]]));
  // ── cola de crin quemada ──
  { const tp = [pelvis.userData.rest.clone().add(new V3(0, 0.05, -0.12)), ...tail.map((b) => b.userData.rest)].map((v) => v.toArray()); const g = tube(tp, { rad: (t) => lerp(0.05, 0.02, t) * (1 + 0.6 * smooth(0.6, 1, t)), seg: low ? 8 : 12, sides: 6 }); paint(g, (p) => new THREE.Color(0x1a100a).lerp(new THREE.Color(0xff5a10), smooth(-1.0, -1.25, p.z))); rig.add(hide, skinChain(g, [pelvis, ...tail], 0.1)); }
  // ── CAPARAZÓN DE COSTILLAS GIGANTES: 6 pares de placas de hueso que pivotan sobre el espinazo ──
  const shell = [], NP = 6, backY = hipY + 0.34;
  for (let i = 0; i < NP; i++) for (const s of [-1, 1]) {
    const z = lerp(-0.62, 0.58, i / (NP - 1)), par = z < -0.25 ? pelvis : z < 0.25 ? spine : chest, w = 0.17 - Math.abs(i - (NP - 1) / 2) * 0.012, l = 0.62 - Math.abs(i - (NP - 1) / 2) * 0.05;
    const pv = rig.bone(par, [s * 0.05, backY, z], 'sh' + i);
    const q = orient(new V3(s, 0.35, 0), new V3(0, -1, 0));
    const g = plate({ w, l, h: 0.07, nr: low ? 2 : 3, ns: low ? 7 : 10, keel: 0.9, curve: -0.5, wrap: 0.8, pt: 0.5, quat: q, pos: [s * 0.2, backY - l * 0.62, z], col: 0xd8c8a8, col2: 0x5a4430 });
    const spur = spike(0.025, 0.2, { sides: 4, seg: 2, bend: 0.3, bendDir: [0, 0, -1], pos: [s * 0.1, backY + 0.02, z], dir: [s * 0.4, 1, -0.3] }); paint(spur, 0xe8dcc0);
    rig.add(bone, skinRigid(g, pv)); rig.add(bone, skinRigid(spur, pv)); shell.push({ pv, s, i });
  }
  // ── ensamblaje: roller = pivote de la rodada en el centro del cuerpo ──
  const group = rig.build(); const rootObj = new THREE.Group(), roller = new THREE.Group(); const CY = 0.95, K = 0.98;
  roller.position.y = CY; group.position.y = -CY; roller.add(group); rootObj.add(roller); rootObj.position.y = -0.9; rootObj.scale.setScalar(K);
  const flames = [llama(fireM, 0.34, 1.05), llama(fireM, 0.2, 0.62), llama(fireM, 0.16, 0.5)];
  flames[0].position.set(0, n1.y + 0.05, n1.z + 0.02); flames[1].position.set(0.08, n1.y - 0.02, n1.z - 0.06); flames[2].position.set(-0.07, n1.y - 0.04, n1.z - 0.1);
  flames.forEach((f, i) => { f.position.sub(neck1.userData.rest); neck1.add(f); f.rotation.x = -0.25 - i * 0.2; });
  const core = nucleo(color, 0.1, { halo: 8 }); chest.add(core.object); core.object.position.set(0, -0.12, 0.27); mats.push(...core.mats);
  const embers = motas(30, { color: 0xff8a30, size: 0.045, modo: 'rise', box: [0.5, 1.6, 0.5], speed: 0.45 }); embers.position.set(0, n1.y + 0.2, n1.z); rootObj.add(embers); mats.push(embers.material);
  const aura = shieldAura(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4), 1.45); aura.position.set(0, 1.0, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, embers.userData.geo]));
  // ── animación ──
  const cache = new Map(), sNeck = new Spring(0, 40, 6), tgt = new V3();
  let ph = 0, openK = 0, rollA = 0, walkK = 0, prevHp = 1, flinch = 0, stunK = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const open = !!st.o || st.s === 'open', speed = Math.min(1.6, ctx.speed || 0), hurt = st.hp != null && st.hp < 0.35, stun = !!st.st;
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    openK = dampTo(openK, open ? 1 : 0, open ? 5 : 6, dt); stunK = dampTo(stunK, stun ? 1 : 0, 6, dt); const closeK = 1 - openK;
    walkK = dampTo(walkK, open ? 0.15 : Math.min(1, speed + 0.3), 4, dt); ph += dt * (2 + 5 * walkK);
    // rodar cerrada (vuelve a 0 vuelta entera al abrirse)
    if (closeK > 0.6) rollA += dt * (3 + 6 * speed) * closeK; else { const tgtA = Math.round(rollA / TAU) * TAU; rollA = dampTo(rollA, tgtA, 6, dt); }
    roller.rotation.x = rollA; roller.scale.set(1 + 0.08 * closeK, 1 - 0.1 * closeK, 1 - 0.3 * closeK);
    // cuerpo: enroscado (cerrado) ↔ plantada y encabritada (abierta)
    const br = Math.sin(t * 1.6 + st.id) * 0.015;
    pelvis.rotation.x = closeK * 0.55 - openK * 0.05; spine.rotation.x = closeK * 0.45 + br; chest.rotation.x = closeK * 0.5 - openK * 0.32 + flinch * 0.1;
    pelvis.position.y = pelvis.userData.rest.y - closeK * 0.32 + openK * 0.02 + br;
    neck0.rotation.x = sNeck.step(dt, closeK * 1.1 - openK * 0.25 + Math.sin(t * 1.2) * 0.04 + stunK * 0.4); neck1.rotation.x = closeK * 0.6 - openK * 0.2; neck0.rotation.y = openK * Math.sin(t * 0.9) * 0.25;
    tail.forEach((b, i) => { b.rotation.x = -closeK * 0.7 + Math.sin(t * 3 - i) * 0.12 * openK; b.rotation.y = Math.sin(t * 2.4 - i * 0.8) * 0.25 * (0.3 + openK); });
    // patas: abierta camina despacio/pisotea; cerrada se recogen al centro
    andar(Q, ph, walkK * openK + 0.05, { stride: 0.28, lift: 0.18, order: [0, 0.5, 0.5, 0], cache, override: (i, p, Lg) => {
      if (openK > 0.6 && Lg.front && walkK < 0.3) p.y += Math.max(0, Math.sin(t * 5 + i * 2)) ** 6 * 0.18;   // pisotón amenazante
      if (closeK > 0.01) p.lerp(new V3(Lg.side * 0.12, Lg.front ? 0.55 : 0.6, Lg.front ? 0.05 : -0.1), closeK);
    } });
    // caparazón: cerrado envuelve (rota hacia abajo/adentro); abierto se abre en abanico hacia arriba
    shell.forEach(({ pv, s, i }) => { pv.scale.setScalar(1 + 0.22 * closeK); const wave = Math.sin(t * 2.2 + i * 0.6) * 0.06 * openK; pv.rotation.z = s * (-closeK * 0.55 + openK * 2.0 + wave); pv.rotation.x = (i - (NP - 1) / 2) * 0.1 * openK + Math.sin(t * 8 + i) * 0.03 * flinch; });
    // fuego: más alto y blanco abierto; brasas y núcleo = aviso de la ventana de daño
    const fk = 0.55 + 0.6 * openK + 0.2 * Math.sin(t * 9) * openK + (hurt ? 0.2 : 0);
    fireM.uniforms.uK.value = fk; flames[0].scale.y = 0.9 + 0.55 * openK; flames.forEach((f, i) => { f.rotation.z = Math.sin(t * 3 + i) * 0.1; f.rotation.x = -0.25 - i * 0.2 + closeK * 0.6; });
    core.set(0.15 + openK * 2.2 + flinch * 0.4, t, dt);
    hide.userData.u.uVeinGlow.value = 0.6 + 0.6 * openK + (hurt ? 0.6 + 0.4 * Math.sin(t * 12) : 0) + 0.25 * Math.sin(t * 3.3);
    bone.userData.u.uRim.value = 0.3 + 0.5 * closeK;
    embers.material.uniforms.uK.value = 0.4 + openK * 0.8 + (hurt ? 0.5 : 0);
    tickAura(aura, st, t);
  } };
}
