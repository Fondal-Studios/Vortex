// DIFUNTA (id interno «aurora», sanadora) — la santa milagrosa del camino: una mujer que FLOTA ACOSTADA de costado (silueta horizontal,
// distinta de todas las demás), con vestido rojo y un manto celeste que cuelga hacia el piso como una cascada, el HIJO en brazos (un
// atadito de luz que se amamanta), una AUREOLA de oro detrás de la cabeza y BOTELLAS DE AGUA de ofrenda girando a su alrededor.
// AVISO DE CURACIÓN ('cast', 0.9 s): se incorpora, alza al niño, la aureola estalla en rayos, cae un anillo de oro al piso y suben motas
// doradas (= va a curar y escudar a las almas cercanas). NÚCLEO = corazón de luz bajo el pecho.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { THREE, lod, clamp, lerp, smooth, Rig, humanoide, alcanzar, velo, carne, brillo, setBrillo, nucleo, motas, aro, sudario, cara, ellipsoid, tube, paint, skinRigid, skinChain, skinFn, setK, glowSprite, disposer, shieldAura, tickAura, Spring, dampTo, TAU, rng, joinUV } from './alma-kit.js';

export default function build(kit, color = 0xf2c66d) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const skin = carne({ vein: 0xffd090, veinK: 0.08, veinGlow: 0.2, sssColor: 0xffe0c0, rimColor: color, tex: 'skin', tile: 3, rough: 0.35, clear: 0.7, sss: 0.6 });
  const dress = velo(0xb01828, { alpha: 1, rimColor: 0xff8070, rim: 0.6, flutter: 0.03, speed: 1.2, weave: 0.9, emissiveLift: 0.06, sheen: 0.8, iri: 0.5 });
  const mantle = velo(0x7ab8ff, { alpha: 0.7, rimColor: 0xbfe8ff, rim: 1.3, flutter: 0.08, speed: 1.4, hem: 0.55, hemGlow: 1.0, iri: 0.8 });
  const gold = brillo(color, 1.8), glass = velo(0xc8f0ff, { alpha: 0.45, rimColor: 0xffffff, rim: 1.6, flutter: 0, hem: 1, hemGlow: 0, weave: 0, glow: 0.15, glowColor: 0x9fe8ff, iri: 1 });
  const mats = [skin, dress, mantle, gold, glass];
  const rig = new Rig();
  const B = humanoide(rig, { H: 1.75, shoulder: 0.15, hip: 0.11, arm: [0.27, 0.25], armR: [0.035, 0.022], hand: 0.15, legs: false, pelY: 0.85, matSkin: skin, neckLen: 0.1, curl: 0.3,
    torso: (t) => lerp(0.13, 0.1, smooth(0, 0.4, t)) + 0.04 * smooth(0.5, 0.75, t) - 0.06 * smooth(0.86, 1, t), torsoPaint: 0xb03030, armPaint: 0xe8c8b0, handColor: 0xf0d0c0 });
  const { root, pelvis, spine, chest, neck, head, armL, armR, Y } = B;
  const hp = head.userData.rest;
  const fg = cara(0.095, { skin: 0xf0d8c8, socket: 0x5a3a40, lips: 0xa05060, gaunt: 0.2 }); fg.translate(hp.x, hp.y + 0.07, hp.z + 0.02); rig.add(skin, skinRigid(fg, head));
  // pelo oscuro recogido + vestido rojo largo (cubre las piernas) + manto celeste por la cabeza y la espalda
  const hair = ellipsoid([0.1, 0.11, 0.11], { w: 12, h: 10, pos: [hp.x, hp.y + 0.1, hp.z - 0.03] }); paint(hair, 0x1a1010); rig.add(dress, skinRigid(hair, head));
  const db = [rig.bone(pelvis, [0, 0.4, 0.0], 'd0')]; db.push(rig.bone(db[0], [0, -0.05, 0.0], 'd1'));
  const dg = sudario([[0, Y.chestY + 0.05, 0.0], [0, Y.pelY, 0.0], [0, 0.4, 0.02], [0, -0.1, 0.04]], { rad: (t) => lerp(0.12, 0.2, smooth(0.15, 1, t)), rows: 14, cols: 18, tatter: 0.2, seed: 2, color: 0xc02030, colorEnd: 0x701018, fold: 0.1 });
  rig.add(dress, skinChain(dg, [chest, pelvis, ...db], 0.12));
  const mg = sudario([[0, hp.y + 0.22, hp.z + 0.03], [0, hp.y + 0.12, hp.z - 0.12], [0, Y.chestY, -0.2], [0, Y.pelY - 0.2, -0.24], [0, 0.0, -0.25]], { rad: (t) => lerp(0.13, 0.32, smooth(0, 0.6, t)), arc: [-2.2, 2.2], up: [0, 0.3, 1], rows: 16, cols: 18, tatter: 0.35, seed: 6, color: 0x9ad0ff, colorEnd: 0x4a80e0 });
  rig.add(mantle, skinFn(mg, (p) => { const a = smooth(hp.y - 0.1, hp.y + 0.1, p.y), b = smooth(Y.pelY - 0.1, Y.chestY, p.y); return [[head, a], [chest, (1 - a) * b], [pelvis, (1 - b) * smooth(0.3, 0.6, p.y)], [db[0], 1 - smooth(0.3, 0.6, p.y)]]; }));
  // el niño: atadito de tela blanca con carita, en el pecho
  const baby = rig.bone(chest, [0.0, Y.chestY - 0.08, 0.22], 'baby');
  const bun = ellipsoid([0.08, 0.13, 0.08], { w: 12, h: 10, noise: 0.15, seed: 4, pos: [0, Y.chestY - 0.08, 0.22] }); paint(bun, 0xfff8f0); bun.rotateZ(0); rig.add(mantle, skinRigid(bun, baby));
  const bf = ellipsoid([0.04, 0.045, 0.035], { w: 10, h: 8, pos: [0.0, Y.chestY + 0.03, 0.26] }); paint(bf, 0xffe0d0); rig.add(skin, skinRigid(bf, baby));
  // aureola de oro (aro + rayos finos) detrás de la cabeza
  // ── ensamblaje: «lying» rota todo el cuerpo hasta quedar acostada de costado ──
  const group = rig.build(); const rootObj = new THREE.Group(), lying = new THREE.Group(); lying.add(group); rootObj.add(lying); const K = 1.1; rootObj.scale.setScalar(K); rootObj.position.y = -0.35;
  group.position.y = -Y.pelY; lying.position.y = 0.2;
  const haloG = (() => { const parts = [new THREE.TorusGeometry(0.2, 0.012, 6, low ? 28 : 44).toNonIndexed()]; for (let i = 0; i < (low ? 12 : 20); i++) { const a = (i / (low ? 12 : 20)) * TAU; const g = new THREE.CylinderGeometry(0.004, 0.009, 0.11 + (i % 2) * 0.06, 4).toNonIndexed(); g.translate(0, 0.27 + (i % 2) * 0.03, 0); g.rotateZ(a); parts.push(g); } parts.forEach((g) => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); }); return mergeGeometries(parts, false); })();
  const halo = new THREE.Mesh(haloG, gold); halo.position.set(0, 0.06, -0.1); head.add(halo); const haloSp = glowSprite(color, 0.9, 0.5); halo.add(haloSp); mats.push(haloSp.material);
  // botellas de agua de ofrenda (1 malla) que giran alrededor
  const bottles = new THREE.Group(); rootObj.add(bottles);
  { const prof = [[0.0, 0], [0.05, 0.0], [0.055, 0.02], [0.055, 0.14], [0.03, 0.19], [0.018, 0.21], [0.018, 0.26], [0.0, 0.26]].map((p) => new THREE.Vector2(p[0], p[1])); const parts = [], R = rng(3);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, g = new THREE.LatheGeometry(prof, low ? 7 : 10); g.scale(1.2, 1.2, 1.2); g.rotateZ((R() - 0.5) * 0.8); g.translate(Math.cos(a) * 0.9, (R() - 0.5) * 0.5, Math.sin(a) * 0.65); parts.push(g.toNonIndexed()); }
    const bg = mergeGeometries(parts, false); paint(bg, 0xffffff); setK(bg, 0); bottles.add(new THREE.Mesh(bg, glass)); }
  const core = nucleo(color, 0.065, { halo: 9 }); chest.add(core.object); core.object.position.set(0.06, 0.06, 0.12); mats.push(...core.mats);
  const ring = aro(color, { n: 4, dir: 1, speed: 1.4 }); ring.position.y = -0.55; ring.scale.setScalar(1.6); rootObj.add(ring); mats.push(ring.material);
  const up = motas(26, { color, size: 0.05, modo: 'rise', box: [1.6, 1.6, 1.2], speed: 0.35, k: 0.4 }); up.position.y = -0.2; rootObj.add(up); mats.push(up.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.2); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, haloG, up.userData.geo, bottles.children[0].geometry]));
  // ── animación ──
  const cache = new Map(), tgt = new V3(), look = new V3(0, 0, 1);
  let cK = 0, prevHp = 1, flinch = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const cast = st.s === 'cast', hurt = st.hp != null && st.hp < 0.35; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    cK = dampTo(cK, cast ? 1 : 0, cast ? 7 : 2.5, dt); const idle = 1 - cK;
    // acostada de costado (cabeza hacia +X) → se incorpora al curar
    lying.rotation.z = lerp(-1.35, -0.25, cK) + Math.sin(t * 0.8 + st.id) * 0.04; lying.rotation.y = 0.15 * idle;
    rootObj.position.y = -0.35 + Math.sin(t * 1.0 + st.id) * 0.08 + cK * 0.15;
    spine.rotation.x = 0.15 * idle; chest.rotation.x = 0.1 * idle - 0.1 * cK; chest.scale.set(1 + Math.sin(t * 1.4) * 0.01, 1, 1);
    neck.rotation.x = 0.35 * idle - 0.3 * cK; neck.rotation.y = 0.3 * idle + clamp(Math.atan2(look.x, look.z), -0.5, 0.5) * 0.3 * cK; head.rotation.z = 0.2 * idle;
    // brazos acunan al niño ↔ lo alzan
    const bp = new V3(0, Y.chestY - 0.08, 0.3); const lift = new V3(0, Y.neckY + 0.35, 0.3);
    baby.position.set(0, 0, 0).add(new V3().copy(bp).lerp(lift, cK).sub(baby.userData.rest)); baby.rotation.x = Math.sin(t * 2) * 0.05;
    [armL, armR].forEach((A) => { const s = A.side; tgt.copy(bp).lerp(lift, cK).add(new V3(s * 0.08, -0.05 + cK * -0.1, -0.02)); alcanzar(A, root, tgt, new V3(s, -0.5, -0.3), cache); A.fing.rotation.x = -0.6; });
    mantle.userData.u.uWind.value.set(0, -0.15 * idle, 0); mantle.userData.u.uFlut.value = 0.07 + cK * 0.08;
    // luz: aureola, anillo de oro, motas (AVISO); botellas giran
    halo.rotation.z = t * 0.3; halo.scale.setScalar(1 + cK * 0.5 + Math.sin(t * 3) * 0.03); setBrillo(gold, 1.5 + cK * 2); haloSp.material.opacity = 0.4 + cK * 0.5; haloSp.scale.setScalar(0.9 + cK * 0.9);
    bottles.rotation.y = t * 0.35; bottles.position.y = Math.sin(t * 0.9) * 0.05;
    ring.userData.setK(cK); up.material.uniforms.uK.value = 0.35 + cK * 1.3; up.material.uniforms.uSpd.value = 0.3 + cK * 0.6;
    core.set((1 + cK * 1.3 + flinch * 0.5) * (hurt ? (Math.sin(t * 15) > 0 ? 1 : 0.5) : 1), t, dt);
    tickAura(aura, st, t);
  } };
}
