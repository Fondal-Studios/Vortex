// LA LLORONA (id interno «lente», a distancia) — mujer alta de VESTIDO Y VELO BLANCOS que flota sin pisar, pelo negro largo que le tapa
// la espalda, cara de porcelana con cuencas oscuras y lágrimas de luz. En reposo llora: se tapa la cara con las manos y se mece.
// AVISO DE APUNTADO ('aim', 0.6 s): levanta la cabeza de golpe hacia el jugador, aparta las manos y extiende los brazos con las mangas
// abiertas, el velo vuela hacia atrás, la boca se abre en un grito y una bola de lamento (luz azul) crece frente a la boca = de ahí sale
// el disparo. El NÚCLEO late en el pecho, bajo el velo. st.hp baja = el vestido se deshilacha y parpadea · st.sd escudo.
import { THREE, lod, clamp, lerp, smooth, Rig, humanoide, alcanzar, velo, carne, brillo, setBrillo, nucleo, motas, sudario, cara, ellipsoid, paint, skinRigid, skinChain, skinFn, glowSprite, disposer, shieldAura, tickAura, Spring, dampTo } from './alma-kit.js';

export default function build(kit, color = 0xa8c8ff) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const skin = carne({ vein: color, sssColor: 0xd0e0ff, rimColor: color, veinGlow: 0.3, veinK: 0.15, rough: 0.35, clear: 0.6, tex: 'skin', tile: 3 });
  const cloth = velo(0xf4f8ff, { alpha: 0.72, rimColor: color, rim: 1.0, flutter: 0.07, speed: 1.8, hem: 0.62, hemGlow: 0.8 });
  const hair = velo(0x0b0a10, { alpha: 1, rimColor: 0x6080b0, rim: 0.5, flutter: 0.05, speed: 1.4, sheen: 0.8, weave: 0.3, emissiveLift: 0.02 });
  const eyeM = brillo(color, 1.6);
  const mats = [skin, cloth, hair, eyeM];
  const rig = new Rig();
  const B = humanoide(rig, { H: 2.05, shoulder: 0.16, hip: 0.1, arm: [0.3, 0.28], armR: [0.034, 0.02], hand: 0.17, legs: false, pelY: 1.0, matSkin: skin, neckLen: 0.13, curl: 0.15,
    torso: (t) => lerp(0.12, 0.1, smooth(0, 0.4, t)) * (1 - 0.15 * Math.exp(-Math.pow((t - 0.42) / 0.1, 2))) + 0.025 * smooth(0.55, 0.75, t) - 0.06 * smooth(0.86, 1, t),
    torsoPaint: 0x8a90a0, armPaint: 0x9098a8, handColor: 0xa8a4a8 });
  const { root, pelvis, spine, chest, neck, head, armL, armR, Y } = B;
  const hp = head.userData.rest;
  // cara de porcelana con cuencas hundidas + lágrimas pintadas + boca (hueso «jaw» que baja y abre)
  const fg = cara(0.1, { skin: 0xb8b8c4, socket: 0x0a0a14, lips: 0x50404a, gaunt: 0.6 }); fg.translate(hp.x, hp.y + 0.08, hp.z + 0.02);
  paint(fg, ((orig) => (p, n, i) => { const c = new THREE.Color(orig.getX(i), orig.getY(i), orig.getZ(i)); for (const s of [-1, 1]) { const dx = Math.abs(p.x - (hp.x + s * 0.034)); if (dx < 0.006 && p.y < hp.y + 0.08 && p.y > hp.y - 0.0 && p.z > hp.z + 0.07) c.lerp(new THREE.Color(0x203060), 0.7); } return c; })(fg.attributes.color.clone()));
  rig.add(skin, skinRigid(fg, head));
  const jaw = rig.bone(head, [hp.x, hp.y + 0.03, hp.z + 0.06], 'jaw');
  const mouth = ellipsoid([0.026, 0.012, 0.012], { w: 10, h: 6, pos: [hp.x, hp.y + 0.03, hp.z + 0.1] }); paint(mouth, 0x020104); rig.add(skin, skinRigid(mouth, jaw));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.014, 0.008, 0.006); e.translate(hp.x + s * 0.034, hp.y + 0.093, hp.z + 0.098); rig.add(eyeM, skinRigid(e, head)); }
  // pelo negro largo (atrás) + mechones adelante
  const hb = [rig.bone(head, [0, hp.y - 0.05, hp.z - 0.12], 'h0')]; hb.push(rig.bone(hb[0], [0, hp.y - 0.45, hp.z - 0.2], 'h1')); hb.push(rig.bone(hb[1], [0, hp.y - 0.9, hp.z - 0.22], 'h2'));
  const hairBack = sudario([[0, hp.y + 0.2, hp.z - 0.02], [0, hp.y + 0.05, hp.z - 0.12], [0, hp.y - 0.4, hp.z - 0.17], [0, hp.y - 0.95, hp.z - 0.2]], { rad: (t) => lerp(0.115, 0.17, smooth(0, 0.6, t)), arc: [1.25, 5.03], up: [0, 0, 1], rows: 14, cols: 16, tatter: 0.45, seed: 3, color: 0x101018, colorEnd: 0x060608, fold: 0.18, folds: 11 });
  rig.add(hair, skinChain(hairBack, [head, ...hb], 0.1));
  for (const s of [-1, 1]) { const g = sudario([[s * 0.07, hp.y + 0.12, hp.z + 0.05], [s * 0.1, hp.y - 0.05, hp.z + 0.08], [s * 0.12, hp.y - 0.4, hp.z + 0.1], [s * 0.12, hp.y - 0.62, hp.z + 0.11]], { rad: 0.03, arc: [-1.6, 1.6], up: [s, 0, 0.3], rows: 8, cols: 6, tatter: 0.5, seed: 8 + s, color: 0x0e0e14 });
    rig.add(hair, skinFn(g, (p) => [[head, smooth(hp.y - 0.25, hp.y + 0.05, p.y)], [chest, 1 - smooth(hp.y - 0.25, hp.y + 0.05, p.y)]])); }
  // velo blanco translúcido sobre la cabeza (vuela hacia atrás al gritar)
  const vb = [rig.bone(head, [0, hp.y + 0.1, hp.z - 0.14], 'v0')]; vb.push(rig.bone(vb[0], [0, hp.y - 0.3, hp.z - 0.32], 'v1')); vb.push(rig.bone(vb[1], [0, hp.y - 0.8, hp.z - 0.42], 'v2'));
  const veil = sudario([[0, hp.y + 0.24, hp.z + 0.04], [0, hp.y + 0.16, hp.z - 0.12], [0, hp.y - 0.25, hp.z - 0.3], [0, hp.y - 0.85, hp.z - 0.42]], { rad: (t) => lerp(0.15, 0.32, smooth(0, 1, t)), arc: [-2.25, 2.25], up: [0, 0.3, 1], rows: 14, cols: 20, tatter: 0.35, seed: 5, color: 0xffffff, colorEnd: 0xd8e6ff, fold: 0.12 });
  rig.add(cloth, skinChain(veil, [head, ...vb], 0.12));
  // vestido largo hasta el piso (se deshace en luz abajo) + mangas acampanadas
  const cy = Y.chestY, pl = pelvis.userData.rest;
  const db = [rig.bone(pelvis, [0, pl.y - 0.35, 0.0], 'd0')]; db.push(rig.bone(db[0], [0, pl.y - 0.75, -0.02], 'd1')); db.push(rig.bone(db[1], [0, 0.0, -0.05], 'd2'));
  const dress = sudario([[0, cy + 0.12, 0.0], [0, cy - 0.15, 0.0], [0, pl.y, 0.0], [0, pl.y - 0.5, -0.02], [0, 0.0, -0.06]], { rad: (t) => lerp(0.11, 0.38, smooth(0.2, 1, t)) + 0.02 * smooth(0, 0.15, t), rows: 18, cols: 24, tatter: 0.3, seed: 2, color: 0xffffff, colorEnd: 0xc8d8f0, fold: 0.1, folds: 9, ex: [1, 0.85] });
  rig.add(cloth, skinChain(dress, [chest, spine, pelvis, ...db], 0.1));
  [armL, armR].forEach((A, k) => { const r = A.rest, s = A.side; const g = sudario([r.sh.toArray(), r.el.toArray(), r.wr.toArray(), r.wr.clone().add(new V3(s * 0.02, -0.14, 0.04)).toArray()], { rad: (t) => lerp(0.05, 0.13, smooth(0.3, 1, t)), rows: 10, cols: 12, tatter: 0.4, seed: 11 + k, color: 0xffffff, colorEnd: 0xd0e0ff, up: [0, 0, 1] });
    rig.add(cloth, skinChain(g, [A.cl, A.up, A.fo, A.hand], 0.06)); });
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 1.0; rootObj.scale.setScalar(K); rootObj.position.y = -0.92;
  const core = nucleo(color, 0.065, { halo: 9 }); chest.add(core.object); core.object.position.set(0, 0.0, 0.1); mats.push(...core.mats);
  const lament = glowSprite(color, 0.5, 0); rootObj.add(lament); lament.renderOrder = 5; mats.push(lament.material);
  const tears = motas(14, { color, size: 0.03, modo: 'rise', box: [0.15, -0.9, 0.1], speed: 0.4, k: 0.6 }); tears.position.set(0, hp.y + 0.05, hp.z + 0.12); head.add(tears); tears.position.sub(head.userData.rest); mats.push(tears.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.35); aura.position.set(0, 1.1, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, tears.userData.geo]));
  // ── animación ──
  const cache = new Map(), sHy = new Spring(0, 50, 7), sHp = new Spring(0, 50, 7), tgt = new V3(), look = new V3(0, 0, 1), mp = new V3();
  let aimK = 0, prevHp = 1, flinch = 0, sob = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const aim = st.s === 'aim', hurt = st.hp != null && st.hp < 0.35; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    aimK = dampTo(aimK, aim ? 1 : 0, aim ? 12 : 3, dt); const idle = 1 - aimK;
    sob = Math.max(0, Math.sin(t * 2.6 + st.id)) ** 3;   // sollozo (hombros que saltan)
    // flota y se mece
    rootObj.position.y = -0.92 + Math.sin(t * 1.1 + st.id) * 0.05;
    pelvis.rotation.z = Math.sin(t * 0.8 + st.id) * 0.05 * idle; pelvis.rotation.x = 0.04;
    spine.rotation.x = 0.12 * idle - 0.1 * aimK + sob * 0.05 * idle; chest.rotation.x = 0.22 * idle - 0.08 * aimK + sob * 0.06 * idle - flinch * 0.1;
    chest.position.y = chest.userData.rest.y - spine.userData.rest.y + sob * 0.012 * idle;
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    neck.rotation.y = sHy.step(dt, clamp(lx, -0.9, 0.9) * (0.25 + 0.6 * aimK)); neck.rotation.x = sHp.step(dt, 0.45 * idle - clamp(ly, -0.5, 0.5) * 0.6 * aimK - 0.15 * aimK);
    head.rotation.z = Math.sin(t * 0.7) * 0.1 * idle;
    jaw.position.y = -0.0 - 0.035 * aimK - 0.01 * sob * idle; jaw.scale.set(1 + 0.5 * aimK, 1 + 3.5 * aimK + sob * idle, 1);
    // manos: tapan la cara (llanto) ↔ brazos extendidos al frente (lamento)
    head.updateMatrix(); [armL, armR].forEach((A, i) => {
      const s = A.side; tgt.set(s * 0.05, hp.y + 0.03 - 0.12 + sob * 0.01, hp.z + 0.13 + 0.15);
      const fwd = new V3(s * 0.32, Y.neckY - 0.05 + clamp(ly, -0.4, 0.4) * 0.3, 0.55); tgt.lerp(fwd, aimK);
      if (hurt) tgt.y -= 0.05 * idle;
      alcanzar(A, root, tgt, new V3(s * 0.9, -0.6, -0.2), cache);
      A.fing.rotation.x = -0.4 * idle + 0.4 * aimK; A.hand.rotation.x = 0.4 * idle;
    });
    // tela: viento hacia atrás al gritar
    cloth.userData.u.uWind.value.set(0, 0.05 * aimK, -0.22 * aimK); cloth.userData.u.uFlut.value = 0.06 + 0.06 * aimK; hair.userData.u.uWind.value.set(0, 0.02 * aimK, -0.15 * aimK);
    vb.forEach((b, i) => { b.rotation.x = -0.35 * aimK * (i + 1) * 0.5 + Math.sin(t * 1.3 - i) * 0.04; }); hb.forEach((b, i) => { b.rotation.x = -0.25 * aimK + Math.sin(t * 1.1 - i) * 0.03; });
    db.forEach((b, i) => { b.rotation.x = Math.sin(t * 1.4 - i * 0.7 + st.id) * 0.06; b.rotation.z = Math.sin(t * 1.1 - i * 0.6) * 0.05; });
    // luz: núcleo, ojos, bola de lamento frente a la boca (crece durante el aviso)
    const fl = hurt ? (Math.sin(t * 17) > 0 ? 1 : 0.45) : 1;
    core.set((1 + aimK * 1.4 + flinch * 0.6) * fl, t, dt); setBrillo(eyeM, 1.2 + aimK * 3.0);
    mp.set(hp.x, hp.y + 0.03, hp.z + 0.12); head.updateMatrixWorld(true); mp.applyMatrix4(new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(head.matrixWorld).multiply(new THREE.Matrix4().makeTranslation(-hp.x, -hp.y, -hp.z)));
    lament.position.copy(mp).add(new V3(0, 0, 0.12 * aimK)); lament.material.opacity = aimK * (0.65 + 0.3 * Math.sin(t * 40)); lament.scale.setScalar(0.12 + aimK * 0.45);
    tears.material.uniforms.uK.value = 0.5 * idle + 0.8 * aimK; cloth.userData.u.uVis.value = hurt ? 0.6 + 0.4 * fl : 1;
    tickAura(aura, st, t);
  } };
}
