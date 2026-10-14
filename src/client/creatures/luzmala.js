// LUZ MALA (id interno «prisma», volador en picada) — la luz que flota de noche sobre el campo y que no hay que seguir. Una ESFERA DE LUZ
// amarillenta (el núcleo ES el cuerpo: punto débil enorme), envuelta en una membrana de plasma que tiembla; contra la membrana se aprieta
// desde adentro una CARA de ánima que grita (se ve al acercarse); detrás arrastra jirones de luz como una cola de cometa.
// 'orbit' = flota y ronda · 'wind' (0.7 s, AVISO) = se encoge, la cara abre la boca, le brotan rayos rojos y tiembla · 'dive' = se estira
// como cometa hacia el jugador con la cola larga. st.hp baja = parpadea y pierde jirones · st.sd escudo.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { THREE, lod, clamp, lerp, smooth, velo, nucleo, motas, fuego, llamas, sudario, calavera, setK, paint, ellipsoid, shieldAura, tickAura, Spring, dampTo, TAU, rng } from './alma-kit.js';

export default function build(kit, color = 0xfff27a) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color), hot = new THREE.Color(0xff5a2a);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const memM = velo(0xfff6c0, { alpha: 0.2, rimColor: color, rim: 1.6, rimPow: 1.6, flutter: 0.05, speed: 4.5, hem: 2, hemGlow: 0, glow: 0.25, glowColor: color, weave: 0, sheen: 0 });
  const faceM = velo(0xfff4e0, { alpha: 0.92, rimColor: 0xfff0b0, rim: 0.9, flutter: 0.0, hem: 2, hemGlow: 0, glow: 0.0, weave: 0, sheen: 0, emissiveLift: 0.05, fresAlpha: false, depthWrite: true, side: THREE.FrontSide });
  const tailM = velo(0xfff4c0, { alpha: 0.5, rimColor: color, rim: 1.4, flutter: 0.16, speed: 5, hem: 0.35, hemGlow: 1.2, glow: 0.4, glowColor: color, weave: 0, sheen: 0 });
  const rayM = fuego(0xff7a20, 0xfff6c0, { k: 0, speed: 1.6, wob: 0.12 });
  const mats = [memM, faceM, tailM, rayM];
  // membrana de plasma (esfera irregular que ondula entera: aK = 1)
  const mg = ellipsoid([0.5, 0.5, 0.52], { w: low ? 16 : 24, h: low ? 12 : 18, noise: 0.12, seed: 9 }); setK(mg, 1); paint(mg, 0xffffff);
  const membrane = new THREE.Mesh(mg, memM); membrane.renderOrder = 2; body.add(membrane);
  // cara que se aprieta contra la luz (calavera translúcida) con mandíbula que se abre
  const sk = calavera(0.2, { long: 0.9, seed: 11, bone: 0xd8c8a8, dark: 0x040302 }); setK(sk.cranium, 0); setK(sk.jaw, 0);
  const face = new THREE.Group(); face.position.set(0, 0.04, 0.3); body.add(face);
  const cr = new THREE.Mesh(sk.cranium, faceM), jawG = new THREE.Group(), jw = new THREE.Mesh(sk.jaw, faceM); jawG.position.set(0, -0.06, -0.02); jw.position.set(0, 0.06, 0.02); jawG.add(jw); face.add(cr, jawG); cr.renderOrder = jw.renderOrder = 6;
  const eyeM = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false }); mats.push(eyeM);
  for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeM); e.position.set(sd * 0.072, 0.01, 0.14); e.scale.set(1, 0.75, 0.5); e.renderOrder = 7; face.add(e); }
  // jirones de cola (sudarios finos que salen de atrás)
  const R = rng(5), tails = [];
  const tg = []; for (let i = 0; i < (low ? 4 : 6); i++) { const a = (i / (low ? 4 : 6)) * TAU + R() * 0.4, rr = 0.25, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    const g = sudario([[x, y, -0.2], [x * 1.3, y * 1.3, -0.7], [x * 1.1, y * 1.1 - 0.05, -1.3], [x * 0.7, y * 0.7 - 0.1, -1.9]], { rad: (t) => lerp(0.1, 0.02, t), rows: 10, cols: 6, tatter: 0.3, seed: 20 + i, up: [x, y, 0.01], color: 0xffffff, colorEnd: 0xffe080 }); tg.push(g); }
  const tailMesh = new THREE.Mesh(mergeGeometries(tg.map((g) => g.toNonIndexed()), false), tailM); tailMesh.renderOrder = 2; body.add(tailMesh);
  // rayos de aviso (llamas que brotan en corona) — 1 malla
  const rays = []; for (let i = 0; i < (low ? 8 : 12); i++) { const a = (i / (low ? 8 : 12)) * TAU, el = (i % 2 ? 0.35 : -0.25); const d = [Math.cos(a) * Math.cos(el), Math.sin(el) * 0.9 + Math.sin(a) * 0.6, 0.35 + Math.cos(el) * 0.2]; const n = new V3(...d).normalize(); rays.push({ pos: n.clone().multiplyScalar(0.36).toArray(), dir: n.toArray(), w: 0.12, h: 0.75 }); }
  const rayMesh = llamas(rayM, rays); body.add(rayMesh);
  const core = nucleo(color, 0.3, { halo: 7, white: 0xfffff0 }); core.object.position.z = -0.08; body.add(core.object); mats.push(...core.mats);
  const orb = motas(24, { color, size: 0.06, modo: 'orbit', box: [0.75, 0.8, 0.75], speed: 0.35 }); body.add(orb); mats.push(orb.material);
  const trail = motas(26, { color: 0xffe9a0, size: 0.06, modo: 'trail', box: [0.6, 0.6, 2.4], speed: 1.2 }); trail.position.z = -0.3; body.add(trail); mats.push(trail.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.2); root.add(aura);
  mats.push({ userData: {}, dispose() { [mg, sk.cranium, sk.jaw, tailMesh.geometry, rayMesh.geometry, aura.geometry, aura.material, orb.userData.geo, trail.userData.geo].forEach((x) => x && x.dispose && x.dispose()); } });
  const sBob = new Spring(0, 30, 5), look = new V3(0, 0, 1); let windK = 0, diveK = 0, prevHp = 1, flinch = 0, jawO = 0;
  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05);
    const wind = st.s === 'wind', dive = st.s === 'dive', hurt = st.hp != null && st.hp < 0.35; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4);
    windK = dampTo(windK, wind ? 1 : 0, wind ? 10 : 5, dt); diveK = dampTo(diveK, dive ? 1 : 0, dive ? 9 : 3, dt);
    // vuelo: flota y deriva; aviso = se encoge y tiembla; picada = se estira hacia adelante
    root.position.y = Math.sin(t * 1.7 + st.id) * 0.12 * (1 - diveK) + sBob.step(dt, 0);
    const shake = windK * 0.04; body.position.set(Math.sin(t * 61) * shake, Math.cos(t * 53) * shake, 0);
    const sq = 1 - windK * 0.18 + Math.sin(t * 5) * 0.03; body.scale.set(sq * (1 - diveK * 0.18), sq * (1 - diveK * 0.18), sq * (1 + diveK * 0.55));
    membrane.rotation.y = t * 0.6; membrane.rotation.x = t * 0.37; memM.userData.u.uFlut.value = 0.04 + windK * 0.08 + diveK * 0.05;
    // cara: mira al jugador; grita en el aviso
    face.rotation.y = clamp(Math.atan2(look.x, look.z), -0.6, 0.6) * 0.5; face.rotation.x = -clamp(look.y, -0.5, 0.5) * 0.4;
    jawO = dampTo(jawO, 0.08 + windK * 0.75 + diveK * 0.5 + flinch * 0.4 + Math.max(0, Math.sin(t * 2.3)) * 0.1, 12, dt); jawG.rotation.x = jawO;
    face.position.z = 0.3 + windK * 0.06 + Math.sin(t * 2) * 0.015;
    // cola: larga en la picada
    tailMesh.scale.set(1 - diveK * 0.2, 1 - diveK * 0.2, 1 + diveK * 1.1 - windK * 0.3); tailM.userData.u.uFlut.value = 0.12 + diveK * 0.12; tailM.userData.u.uVis.value = hurt ? 0.5 + 0.5 * Math.abs(Math.sin(t * 13)) : 1;
    // color: amarillo enfermizo → rojo blanco al avisar
    const c = col.clone().lerp(hot, windK * 0.85 + diveK * 0.4);
    core.inner.material.userData.base.copy(new THREE.Color(0xfffff0).lerp(new THREE.Color(0xffe0c0), windK)); core.shell.material.uniforms.uC.value.copy(c); core.sprite.material.color.copy(c);
    memM.userData.u.uRimC.value.copy(c); memM.userData.u.uGlowC.value.copy(c);
    const fl = hurt ? (Math.sin(t * 19) > -0.2 ? 1 : 0.35) : 1;
    core.set((1.2 + windK * 1.3 + diveK * 0.6 + flinch * 0.5) * fl, t, dt);
    rayM.uniforms.uK.value = windK * 1.3 + diveK * 0.5; rayMesh.visible = windK + diveK > 0.03; rayMesh.scale.setScalar(0.6 + windK * 0.6 + Math.sin(t * 30) * 0.05 * windK); rayMesh.rotation.z = t * 2;
    orb.material.uniforms.uK.value = 0.7 * (1 - diveK) + windK * 0.6; orb.material.uniforms.uSpd.value = 0.35 + windK * 1.2;
    trail.material.uniforms.uK.value = 0.25 + diveK * 1.2; trail.material.uniforms.uSpd.value = 0.8 + diveK * 1.5;
    tickAura(aura, st, t);
  } };
}
