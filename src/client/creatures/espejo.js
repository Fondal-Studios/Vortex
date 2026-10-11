// ESPEJO — emboscador. Camaleón-mímico de piel espejada: refleja un cielo falso iridiscente que cambia de tono (parches de camaleón),
// se camufla por opacidad + distorsión (solo queda un destello de borde), ojos-torreta que giran INDEPENDIENTES, lengua que restalla,
// garras, cola enroscada. Estados: blink = se retuerce y desvanece (0.6 s) / strike = reaparece y ataca (preparación → latigazo → recuperación).
import { soft as blob, bead, leg2 as leg, auraShell, ringPool, glowSprite, taperTube, isLow, damp, clamp, lerp, ease, TAU, NOISE } from './prisma-util.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, horn, crystalSpike, eye, jaw, Spring, uTime } = kit;
  const V = THREE.Vector3, low = isLow();

  /* ── piel espejo: reflejo falso (no depende del env del escenario), parches de hue, camuflaje con distorsión ── */
  const mu = { uTime, uHurt: { value: 0 }, uCamo: { value: 0 }, uHue: { value: 0.55 }, uGlow: { value: 0 }, uTint: { value: new THREE.Color(0xffffff) } };
  const Cls = low ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const mirror = new Cls({ color: 0x8a96b0, roughness: 0.16, metalness: 0.85, transparent: true, opacity: 1 });
  if (!low) { mirror.clearcoat = 1; mirror.clearcoatRoughness = 0.05; mirror.iridescence = 1; mirror.iridescenceIOR = 1.7; mirror.iridescenceThicknessRange = [200, 800]; }
  mirror.userData.u = mu;
  mirror.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mu);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime,uCamo; varying vec3 vObj;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vObj = position;
        transformed += normal * (sin(position.y * 11.0 + position.x * 7.0 + uTime * 5.0) * 0.035 * uCamo + sin(uTime * 2.1 + position.z * 3.0) * 0.008);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime,uHurt,uCamo,uHue,uGlow; uniform vec3 uTint; varying vec3 vObj; ${NOISE}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 vdir = normalize(vViewPosition); float fres = pow(1.0 - abs(dot(normal, vdir)), 2.5);
        vec3 rw = inverseTransformDirection(reflect(-vdir, normal), viewMatrix);
        float pch = vn(vObj * 3.2 + vec3(0.0, uTime * 0.12, 0.0));
        float sky = smoothstep(-0.15, 0.95, rw.y);
        vec3 envc = mix(vec3(0.03, 0.02, 0.10), vec3(0.80, 0.93, 1.0), sky);
        envc += pal(rw.x * 1.2 + rw.z * 0.8 + uHue + pch * 0.7) * 0.75 * smoothstep(0.7, 0.0, abs(rw.y - 0.05));
        envc = mix(envc, pal(pch * 1.3 + uHue) * 1.1, 0.35 * smoothstep(0.35, 0.75, pch));
        envc += vec3(1.0) * smoothstep(0.94, 1.0, sin(rw.x * 7.0 + rw.z * 5.0 + uTime * 0.3)) * 0.7;
        float shim = 0.5 + 0.5 * sin(vObj.y * 16.0 - uTime * 4.0 + vObj.x * 6.0);
        diffuseColor.a = mix(1.0, 0.012 + fres * 0.15 + shim * 0.03 * fres, uCamo);
        totalEmissiveRadiance += (envc * 0.62 * (1.0 - uCamo * 0.55) + pal(uHue + fres * 0.6 + pch) * fres * (0.55 + uCamo * 0.8)) * uTint + uTint * uGlow * (0.5 + 0.5 * pch) + vec3(1.0, 0.85, 0.7) * uHurt * 0.9;`);
  };
  const skinInner = fleshMaterial({ color: 0xff7aa0, vein: 0x8a1040, spot: 0xffe0f0, glow: 0.1, spots: 0.3, veins: 0.9, rough: 0.35, breath: 0.02 }); // lengua / boca húmeda
  const claw = boneMaterial(0xdfeaff, { rough: 0.15, glow: 0.12 }), crystal = bioCrystalMaterial(color, { glow: 0.8 });

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const torso = blob(mirror, 0.5, 0.95, 0.8, 1.45); torso.position.set(0, 0.95, -0.05); body.add(torso);
  const hip = blob(mirror, 0.42, 0.95, 0.85, 1.0); hip.position.set(0, 0.88, -0.75); body.add(hip);
  const chest = blob(mirror, 0.4, 0.95, 0.85, 1.0); chest.position.set(0, 0.95, 0.55); body.add(chest);
  const head = new THREE.Group(); head.position.set(0, 1.05, 1.0); body.add(head);
  const skull = blob(mirror, 0.33, 0.9, 0.8, 1.35); head.add(skull);
  const snout = blob(mirror, 0.22, 0.85, 0.6, 1.2); snout.position.set(0, -0.06, 0.32); head.add(snout);
  // casco (casque) de espejo con espinas de cristal que brotan
  const bellyMat = fleshMaterial({ color: 0x9a5a88, vein: 0x4a1040, spot: 0xcfe9ff, spots: 0.5, veins: 0.9, glow: 0.05, rough: 0.5 }); const belly = blob(bellyMat, 0.46, 0.8, 0.55, 1.5); belly.position.set(0, 0.62, -0.05); body.add(belly);
  const pouch = blob(skinInner, 0.2, 1, 0.9, 1.1); pouch.position.set(0, -0.2, 0.22); head.add(pouch);
  const casque = blob(mirror, 0.26, 0.5, 0.9, 1.5); casque.position.set(0, 0.28, -0.08); head.add(casque);
  for (let i = 0; i < (low ? 1 : 3); i++) { const c = horn(claw, 0.05 - i * 0.008, 0.28 - i * 0.04); c.position.set(0, 0.42 - i * 0.02, -0.1 - i * 0.2); c.rotation.x = -0.5 - i * 0.2; head.add(c); }
  const mouth = jaw(skinInner, claw, { w: 0.13, len: 0.2, teeth: 5 }); mouth.object.position.set(0, -0.12, 0.42); mouth.object.rotation.x = 0.05; head.add(mouth.object);
  // ojos-torreta independientes
  const turrets = [-1, 1].map((sd) => { const g = new THREE.Group(); g.position.set(sd * 0.27, 0.12, 0.12);
    const sock = blob(mirror, 0.17); sock.position.z = -0.05; g.add(sock);
    const e = eye({ r: 0.125, iris: 0xffd040, pupil: 'slit', glow: 0.9 }); e.object.position.z = 0.03; g.add(e.object);
    head.add(g); return { g, e, sd, ax: sd * 0.5, ay: 0, tx: 0, ty: 0, timer: Math.random(), mode: 0, sy: new Spring(0, 120, 12), sx: new Spring(0, 120, 12) }; });
  // lengua: fuste que se estira + maza en la punta
  const tg = new THREE.Group(); tg.position.set(0, -0.1, 0.45); head.add(tg);
  const tshaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.7, 1, 8, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2), skinInner), tclub = bead(skinInner, 0.1);
  tg.add(tshaft, tclub); tshaft.scale.set(0.035, 0.035, 0.001);
  // piernas con cinemática inversa (4) y garras
  const legs = [];
  for (let i = 0; i < 4; i++) { const side = i % 2 ? 1 : -1, row = i < 2 ? 0 : 1, z = row ? -0.75 : 0.55;
    const l = leg(mirror, { upper: 0.52, lower: 0.62, r: 0.115, claw }); l.object.position.set(side * 0.42, 0.8, z); l.setBend(new V(side * 1.5, 0.5, 0)); body.add(l.object);
    legs.push({ l, side, row, base: new V(side * 0.62, -0.84, z + (row ? -0.15 : 0.25)) }); }
  // cola enroscada (espiral logarítmica) que se afloja y se aprieta
  const spiral = []; for (let i = 0; i <= 12; i++) { const a = i * 0.5, r = 1.0 * Math.exp(-0.2 * i); spiral.push(new V(0, 0.95 + (1 - Math.cos(a)) * r * 0.7 - 0.1, -1.0 - Math.sin(a) * r * 0.8)); }
  const tailG = new THREE.Group(); tailG.add(new THREE.Mesh(taperTube(new THREE.CatmullRomCurve3(spiral), 0.22, 0.03, low ? 6 : 8, low ? 14 : 24), mirror)); body.add(tailG);
  const tailTipC = crystalSpike(crystal, 0.03, 0.12); tailTipC.position.copy(spiral[12]); tailG.add(tailTipC);
  // cresta de esquirlas de espejo a lo largo del lomo
  const crys = []; for (let i = 0; i < (low ? 3 : 8); i++) { const k = i / (low ? 2.5 : 7), c = crystalSpike(crystal, 0.07 - k * 0.03, 0.3 - k * 0.12); c.position.set(0, 1.42 - k * 0.14, 0.7 - k * 1.7); c.rotation.set(-0.35 + k * 0.6, 0, (i % 2 ? 1 : -1) * 0.15); body.add(c); crys.push({ c, h: 0.3 - k * 0.12 }); }
  const flash = ringPool(root, 2, 0xcfe9ff, { plane: 'xz' }), glow = glowSprite(0xcfe9ff, 3.5, 0); glow.position.set(0, 1.0, 0); root.add(glow);
  const aura = auraShell(0x9ad8ff, 1.5); aura.position.y = 0.9; root.add(aura);

  const mats = [mirror, skinInner, claw, crystal, bellyMat]; const camoMats = [skinInner, claw, crystal, bellyMat]; camoMats.forEach((m) => { m.transparent = true; });
  const eyeMats = turrets.flatMap((T) => T.e.mats); eyeMats.forEach((m) => { m.transparent = true; });
  const tmp = new V(), headS = new Spring(0, 70, 9), bodyS = new Spring(0, 60, 7), tailS = new Spring(0, 40, 5), popS = new Spring(1, 90, 9), tailY = new Spring(0, 35, 4);
  let phase = 0, camo = 0, lastS = '', sT = 0, bT = 0, openT = 0, tongue = 0, flickT = 3, flickK = 0, tint = 0;
  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(Math.max(dt, 0.001), 0.05); const speed = Math.min(1.5, ctx.speed || 0), look = ctx.look || tmp.set(0, 0, 1);
    const blink = st.s === 'blink', strike = st.s === 'strike', hurt = (st.hp ?? 1) < 0.35;
    if (st.s !== lastS) { if (strike) { sT = 0; popS.x = 0.55; popS.v = 4; flash.set(0, 0.2, 0.9); } if (blink) bT = 0; lastS = st.s; }
    if (strike) sT += dt; if (blink) bT += dt;
    // camuflaje: opacidad + distorsión; se revela al golpear y al ser herido
    const wantCamo = blink ? 1 : strike ? 0 : st.c ? 1 : 0;
    camo = damp(camo, wantCamo, strike ? 24 : blink ? 9 : 5, dt); mu.uCamo.value = camo;
    // marcha de camaleón: pares diagonales, lenta y con balanceo
    phase += dt * (3.2 + speed * 7) * (hurt ? 0.7 : 1);
    legs.forEach((L, i) => { const grp = (i === 0 || i === 3) ? 0 : 1, ph = phase + grp * Math.PI, st_ = 0.3 * Math.min(1, 0.2 + speed), lift = Math.max(0, Math.sin(ph)) * 0.3 * Math.min(1, 0.25 + speed);
      let fy = L.base.y + lift, fz = L.base.z + Math.cos(ph) * st_;
      if (strike && L.row === 0) { const w = clamp(sT / 0.3, 0, 1), s2 = sT > 0.3 && sT < 0.5 ? 1 : 0; fy += w * 0.4 * (1 - s2); fz += s2 * 0.5 + w * 0.15; }
      tmp.set(L.base.x, fy, fz); L.l.setFoot(tmp); });
    const sway = Math.sin(phase * 0.5) * 0.06;
    // golpe: preparación → latigazo → recuperación
    let lunge = 0, wind = 0, lash = 0;
    if (strike) { const c = sT % 1.15; wind = ease(c / 0.3) * (c < 0.3 ? 1 : 0) + (c >= 0.3 && c < 0.5 ? 1 : 0); lash = c >= 0.28 && c < 0.46 ? ease((c - 0.28) / 0.1) : c >= 0.46 && c < 0.7 ? 1 - ease((c - 0.46) / 0.24) : 0; lunge = lash; wind = c < 0.3 ? ease(c / 0.3) : c < 0.5 ? 1 : Math.max(0, 1 - (c - 0.5) / 0.4); }
    // parpadeo: se retuerce sobre sí mismo y se encoge antes de desvanecerse
    const bk = blink ? ease(bT / 0.6) : 0;
    const pop = popS.step(dt, 1);
    body.rotation.y = (blink ? bk * 3.2 : 0) + sway * 0.4;
    body.rotation.x = -wind * 0.28 + lunge * 0.4 + bodyS.step(dt, speed * 0.04) + (blink ? -bk * 0.2 : 0);
    body.rotation.z = Math.sin(phase) * 0.04 * (0.3 + speed) + (hurt ? Math.sin(t * 4) * 0.08 : 0);
    const br = 1 + Math.sin(t * 2 + st.id) * 0.02, sq = (1 - 0.25 * bk) * pop;
    body.scale.set(sq * br, sq * (1 - 0.18 * bk) * (1 + 0.05 * Math.sin(t * 2 + st.id)), sq * br);
    body.position.y = Math.abs(Math.sin(phase)) * 0.025 + (blink ? -bk * 0.25 : 0) - wind * 0.12; body.position.z = lunge * 0.55 - wind * 0.15;
    // cabeza con retardo hacia el jugador
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    head.rotation.y = headS.step(dt, clamp(lx, -0.7, 0.7) * 0.6); head.rotation.x = -wind * 0.15 + lunge * 0.2 + clamp(-ly, -0.5, 0.5) * 0.2;
    // boca y lengua: aviso (abre la boca) → latigazo (estira) → recoge. En calma, un chasquido ocasional.
    flickT -= dt; if (flickT <= 0 && !strike && !blink) { flickK = 1; flickT = 2.5 + Math.random() * 4; } flickK = Math.max(0, flickK - dt * 2.2);
    const tTarget = strike ? lash * 1.9 + wind * 0.15 : flickK > 0 ? Math.sin(flickK * Math.PI) * 0.5 : 0;
    tongue = damp(tongue, tTarget, strike ? 28 : 14, dt); const TL = Math.max(0.001, tongue);
    tshaft.scale.set(0.035, 0.035, TL); tclub.position.z = TL; tclub.scale.setScalar(0.1 * (tongue > 0.05 ? 1 : 0.001) * (1 + 0.3 * Math.sin(t * 30)));
    tg.rotation.x = 0.05 - lunge * 0.05; tg.rotation.y = Math.sin(t * 50) * 0.02 * lash;
    pouch.scale.setScalar(0.2 * (1 + 0.12 * Math.sin(t * 2.6 + st.id) + openT * 0.3)); openT = damp(openT, strike ? Math.max(0.35, wind) : flickK > 0 ? 0.6 : 0.06 + 0.04 * Math.sin(t * 2.2), 14, dt); mouth.set(openT);
    // ojos-torreta: cada uno elige objetivo (jugador o barrido aleatorio) por su cuenta
    turrets.forEach((T, i) => {
      T.timer -= dt; if (T.timer <= 0) { T.mode = Math.random() < (strike ? 0.95 : 0.5) ? 0 : 1; T.timer = 0.5 + Math.random() * 1.7; if (T.mode) { T.tx = (Math.random() - 0.5) * 2.4 + T.sd * 0.4; T.ty = (Math.random() - 0.5) * 1.0; } }
      const ty = T.mode ? T.tx : clamp(lx - head.rotation.y, -1.1, 1.1) + T.sd * 0.15, tx = T.mode ? T.ty : clamp(-ly, -0.8, 0.8);
      T.e.object.rotation.y = T.sy.step(dt, ty); T.e.object.rotation.x = T.sx.step(dt, tx); T.g.rotation.z = Math.sin(t * 0.7 + i * 3) * 0.1 * (1 - camo);
      T.e.update(dt, null, { dilate: strike ? 0.4 : 0, glowMul: 1 - camo * 0.5 });
    });
    eyeMats.forEach((m) => { m.opacity = lerp(1, 0.35, camo); }); camoMats.forEach((m) => { m.opacity = lerp(m === crystal ? 0.88 : 1, 0.03, camo); });
    // cola: se enrosca y afloja; resorte para movimiento secundario
    tailY.step(dt, Math.sin(t * 0.9 + st.id) * 0.35 - speed * 0.2); tailG.rotation.y = tailY.x; tailG.rotation.x = tailS.step(dt, wind * 0.4 - lunge * 0.3 + Math.sin(phase) * 0.05);
    tailG.scale.setScalar(1 + 0.12 * Math.sin(t * 1.3) + (hurt ? -0.15 : 0) + wind * 0.15);
    // hue de camaleón: azul-cian en calma, rojo-ámbar en el aviso; destello al reaparecer
    const hueT = strike ? 0.0 + 0.04 * Math.sin(t * 20) : 0.55 + 0.12 * Math.sin(t * 0.35 + st.id);
    mu.uHue.value = damp(mu.uHue.value, hueT, 8, dt); mu.uGlow.value = wind * 0.9 + lunge * 0.8; tint = damp(tint, strike ? 1 : 0, 10, dt); mu.uTint.value.setRGB(1, 1 - tint * 0.35, 1 - tint * 0.6);
    crys.forEach(({ c, h }, i) => { c.scale.y = h * (1 + 0.12 * Math.sin(t * 3 + i) + wind * 0.8); }); crystal.userData.u.uGlow.value = 0.8 + 0.4 * Math.sin(t * 5) + wind * 1.5; crystal.emissiveIntensity = 0.7 + wind * 1.5;
    skinInner.userData.u.uGlow.value = 0.1 + wind * 0.8;
    const fl = strike && sT < 0.45 ? 1 - sT / 0.45 : 0; flash.set(0, 0.6 + (1 - fl) * 2.2, fl * 0.8); flash.set(1, 0.4 + (1 - fl) * 1.4, fl * 0.6); glow.material.opacity = fl * 0.6 + wind * 0.25 * (1 - camo);
    aura.userData.set(st.sd ? 0.65 + 0.2 * Math.sin(t * 4) : 0);
  } };
}
