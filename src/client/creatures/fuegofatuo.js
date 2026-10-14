// FUEGO FATUO (id interno «racimo», explosivo) — la llamita azul de los cementerios, que corre sola. Una LLAMA AZUL alta y viva con una
// calaverita adentro (ojos de brasa blanca, mandíbula que castañetea de risa) sobre dos patitas de hueso que corren rapidísimo; la llama
// se inclina hacia atrás con la velocidad y deja chispas. AVISO DE ESTALLIDO: cuanto más cerca del jugador (ctx.dist), más se hincha,
// la llama se vuelve blanca, tiembla, la calavera se ríe y salta un anillo de chispas — a ~3 m revienta. NÚCLEO = corazón blanco-azul.
import { THREE, lod, clamp, lerp, smooth, Rig, hueso, brillo, setBrillo, nucleo, motas, fuego, llamas, calavera, tube, paint, skinRigid, skinChain, alcanzar, disposer, shieldAura, tickAura, Spring, dampTo, TAU } from './alma-kit.js';

export default function build(kit, color = 0x3f7bff) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const bone = hueso({ rimColor: color, rim: 0.9, sss: 0.4, sssColor: color, lift: 0.0 });
  const fireA = fuego(0x1030ff, 0x58c8ff, { k: 1.1, speed: 1.4, wob: 0.22 });
  const eyeM = brillo(0xe0f4ff, 2.4);
  const mats = [bone, fireA, eyeM];
  const rig = new Rig();
  const root = rig.bone(null, [0, 0, 0], 'root'), pelvis = rig.bone(root, [0, 0.4, 0], 'pelvis'), skullB = rig.bone(pelvis, [0, 0.72, 0.02], 'skull');
  // patitas de hueso (fémur + tibia + pie)
  const legs = [-1, 1].map((s) => {
    const H = new V3(s * 0.07, 0.4, 0), K = new V3(s * 0.08, 0.22, 0.05), A = new V3(s * 0.08, 0.04, 0);
    const hb = rig.bone(pelvis, H.toArray(), 'th'), kb = rig.bone(hb, K.toArray(), 'sh'), fb = rig.bone(kb, A.toArray(), 'ft');
    const g = tube([H.toArray(), H.clone().lerp(K, 0.5).toArray(), K.toArray(), K.clone().lerp(A, 0.5).toArray(), A.toArray()], { rad: (t) => 0.016 * (1 + 0.6 * Math.exp(-Math.pow((t - 0.5) / 0.08, 2)) + 0.5 * Math.exp(-Math.pow(t / 0.08, 2))), seg: low ? 8 : 12, sides: 5 });
    paint(g, 0x283050); rig.add(bone, skinChain(g, [hb, kb, fb], 0.04));
    const f = tube([A.toArray(), [A.x, 0.01, A.z + 0.06], [A.x, 0.0, A.z + 0.1]], { rad: [0.016, 0.01], seg: 3, sides: 4 }); paint(f, 0x283050); rig.add(bone, skinRigid(f, fb));
    return { hb, kb, fb, par: pelvis, side: s };
  });
  // pelvis-hueso y columnita hacia la calavera
  const sp = tube([[0, 0.36, 0], [0, 0.48, -0.01], [0, 0.6, 0.0], [0, 0.66, 0.01]], { rad: (t) => 0.014 * (1 + 0.6 * Math.pow(Math.abs(Math.sin(t * 22)), 4)), seg: low ? 8 : 14, sides: 5 }); paint(sp, 0x303858); rig.add(bone, skinChain(sp, [pelvis, skullB], 0.1));
  const pv = tube([[-0.09, 0.42, 0], [0, 0.38, 0.03], [0.09, 0.42, 0]], { rad: 0.025, seg: 6, sides: 5 }); paint(pv, 0x303858); rig.add(bone, skinRigid(pv, pelvis));
  const sk = calavera(0.1, { long: 1.0, seed: 13, bone: 0x405080, dark: 0x02040a }); sk.cranium.translate(0, 0.8, 0.02); rig.add(bone, skinRigid(sk.cranium, skullB));
  const jaw = rig.bone(skullB, [0, 0.74, 0.0], 'jaw'); sk.jaw.translate(0, 0.8, 0.02); rig.add(bone, skinRigid(sk.jaw, jaw));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(1, 8, 6); e.scale(0.022, 0.017, 0.012); e.translate(s * 0.036, 0.807, 0.11); rig.add(eyeM, skinRigid(e, skullB)); }
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 1.25; rootObj.scale.setScalar(K); rootObj.position.y = -0.9;
  const flameG = new THREE.Group(); flameG.position.set(0, 0.36, 0.03).sub(pelvis.userData.rest); pelvis.add(flameG);
  const big = llamas(fireA, [{ pos: [0, 0, 0], w: 0.62, h: 1.35 }, { pos: [0.1, 0.05, -0.05], dir: [0.3, 1, -0.2], w: 0.2, h: 0.75 }, { pos: [-0.1, 0.05, -0.04], dir: [-0.3, 1, -0.2], w: 0.2, h: 0.7 }, { pos: [0, 0.1, -0.1], dir: [0, 1, -0.5], w: 0.18, h: 0.85 }, { pos: [0.06, 0.25, 0.08], dir: [0.2, 1, 0.3], w: 0.12, h: 0.5 }]);
  flameG.add(big);
  const core = nucleo(0x6ab0ff, 0.07, { halo: 7 }); skullB.add(core.object); core.object.position.set(0, -0.14, 0.02); mats.push(...core.mats);
  const sparks = motas(26, { color: 0x7fb0ff, size: 0.04, modo: 'rise', box: [0.6, 1.4, 0.6], speed: 0.7 }); sparks.position.y = 0.6; rootObj.add(sparks); mats.push(sparks.material);
  const burst = motas(22, { color: 0xe0f0ff, size: 0.05, modo: 'burst', box: [0.9, 0.9, 0.9], speed: 2.2, k: 0, center: [0, 0.8, 0] }); rootObj.add(burst); mats.push(burst.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.0); aura.position.set(0, 0.75, 0); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, sparks.userData.geo, burst.userData.geo]));
  // ── animación ──
  const cache = new Map(), tgt = new V3(), look = new V3(0, 0, 1), sLean = new Spring(0, 40, 6);
  let ph = 0, runK = 0, fuse = 0, prevHp = 1, flinch = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05); cache.clear();
    const speed = Math.min(1.6, ctx.speed || 0); if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    const d = ctx.dist != null ? ctx.dist : 99;   // distancia a la cámara en radios: revienta a ~3.4
    fuse = dampTo(fuse, clamp((8 - d) / 4.5, 0, 1), 8, dt);
    runK = dampTo(runK, Math.min(1, speed * 1.5 + 0.15), 8, dt); ph += dt * (6 + runK * 16);
    // carrerita de patitas; la llama se inclina hacia atrás; temblor al estar por reventar
    const shake = fuse * 0.03; pelvis.position.set(Math.sin(t * 57) * shake, pelvis.userData.rest.y + Math.abs(Math.sin(ph)) * 0.05 * runK + Math.sin(t * 3) * 0.01, Math.cos(t * 49) * shake);
    pelvis.rotation.x = 0.12 * runK; pelvis.rotation.z = Math.sin(ph) * 0.1 * runK;
    legs.forEach((Lg, i) => { const a = Math.sin(ph + i * Math.PI), up = Math.max(0, Math.cos(ph + i * Math.PI)); tgt.set(Lg.side * 0.09, 0.04 + up * 0.12 * runK, a * 0.14 * runK + 0.02); alcanzar(Lg, root, tgt, new V3(0, 0, 1), cache); });
    const lean = sLean.step(dt, -0.1 * runK); flameG.rotation.x = lean; flameG.rotation.z = Math.sin(t * 4) * 0.08;
    const sw = 1 + fuse * 0.55 + Math.sin(t * (14 + fuse * 30)) * 0.05 * (0.5 + fuse); flameG.scale.set(sw, sw * (1 + fuse * 0.2), sw);
    skullB.rotation.y = clamp(Math.atan2(look.x, look.z), -0.8, 0.8) * 0.6; skullB.rotation.x = -0.1 - fuse * 0.2 + Math.sin(ph) * 0.05 * runK;
    jaw.rotation.x = 0.1 + Math.max(0, Math.sin(t * (8 + fuse * 22))) * (0.15 + fuse * 0.35) + flinch * 0.4;   // castañetea / se ríe
    // color: azul → blanco a punto de reventar
    fireA.uniforms.uC0.value.copy(new THREE.Color(0x1030ff).lerp(new THREE.Color(0x8a5aff), fuse)); fireA.uniforms.uC1.value.copy(new THREE.Color(0x58c8ff).lerp(new THREE.Color(0xffffff), fuse)); fireA.uniforms.uK.value = 2.0 + fuse * 0.6 + flinch * 0.3 + 0.08 * Math.sin(t * 13);
    core.set(0.55 + fuse * 1.6 + Math.max(0, Math.sin(t * 25)) * fuse, t, dt); setBrillo(eyeM, 2 + fuse * 3);
    sparks.material.uniforms.uK.value = 0.6 + runK * 0.4 + fuse; burst.material.uniforms.uK.value = fuse > 0.4 ? fuse * 1.3 : 0;
    tickAura(aura, st, t);
  } };
}
