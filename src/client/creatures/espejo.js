// ESPEJO — emboscador. Camaleón-mímico de piel espejada: cuerpo comprimido y reptiliano de escamas finas que reflejan un cielo falso
// iridiscente con parches de color; casco con cresta, cresta dorsal de esquirlas, pies cigodáctilos con garras, cola enroscada en
// espiral, papada que se infla, dos OJOS-TORRETA que giran independientes en conos de piel y una lengua con maza que restalla.
// Se camufla por opacidad + distorsión (queda un destello de borde). Estados: blink = se retuerce y desvanece (0.6 s) /
// strike = reaparece y ataca (preparación → latigazo → recuperación). st.c = camuflado, st.hp<0.35 cojea, st.sd aura.
import { THREE, TAU, disposer, gazeDir, lod, clamp, lerp, smooth, rng, bio, crystalMat, lidMaterial, ellipsoid, tube, spike, plate, crystal, crystalCluster, paint, orient, path, Rig, skinRigid, skinChain, eye, buildLeg, footTo, boneQuat, gait, glowSprite, shieldAura, tickAura, Spring, dampTo } from './geoda-bio.js';
import { uTime } from '../shaders.js';

export default function build(kit, color) {
  const L = lod(), low = L.low, hi = L.hi, V3 = THREE.Vector3, R = rng(51);
  const col = new THREE.Color(color), ease = (x) => smooth(0, 1, x);

  /* ── piel espejo: escamas + reflejo falso (no depende del env del escenario), parches de color, camuflaje con distorsión ── */
  const mirror = bio({ rough: 0.2, metal: 0.9, clear: 1, clearRough: 0.08, iri: 1, env: 0.5, tex: 'scales', tile: 2.0, bump: 0.8, grain: 0.5, seam: 0x0a0e1c, seamK: 0.5, rv: 0.4, vcol: true });
  mirror.transparent = true; mirror.userData.u.uCamo = { value: 0 }; mirror.userData.u.uHue = { value: 0.55 }; mirror.userData.u.uGlow2 = { value: 0 }; mirror.userData.u.uTint = { value: new THREE.Color(0xffffff) };
  { const base = mirror.onBeforeCompile, u = mirror.userData.u; mirror.customProgramCacheKey = () => 'espejo' + (L.low ? 'L' : '');
    mirror.onBeforeCompile = (sh, r) => {
      base(sh, r); Object.assign(sh.uniforms, { uCamo: u.uCamo, uHue: u.uHue, uGlow2: u.uGlow2, uTint: u.uTint });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uCamo; uniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normal * (sin(position.y * 11.0 + position.x * 7.0 + uTime * 5.0) * 0.03 * uCamo);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uCamo,uHue,uGlow2; uniform vec3 uTint; vec3 pal(float t){ return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67))); }')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { vec3 vdir = normalize(vViewPosition); float fres = pow(1.0 - abs(dot(normal, vdir)), 2.5);
            vec3 rw = inverseTransformDirection(reflect(-vdir, normal), viewMatrix);
            float pch = vn(vP * 3.2 + vec3(0.0, uTime * 0.12, 0.0)); float sky = smoothstep(-0.15, 0.95, rw.y);
            vec3 envc = mix(vec3(0.01, 0.01, 0.05), vec3(0.62, 0.78, 1.0), pow(sky, 1.4));
            envc += pal(rw.x * 1.2 + rw.z * 0.8 + uHue + pch * 0.7) * 0.5 * smoothstep(0.7, 0.0, abs(rw.y - 0.05));
            envc = mix(envc, pal(pch * 1.3 + uHue) * 0.9, 0.3 * smoothstep(0.35, 0.75, pch));
            envc += vec3(1.0) * smoothstep(0.94, 1.0, sin(rw.x * 7.0 + rw.z * 5.0 + uTime * 0.3)) * 0.7;
            float shim = 0.5 + 0.5 * sin(vP.y * 16.0 - uTime * 4.0 + vP.x * 6.0);
            diffuseColor.a = mix(1.0, 0.02 + fres * 0.32 + shim * 0.06 * fres, uCamo);
            totalEmissiveRadiance += (envc * 0.28 * (1.0 - uCamo * 0.55) * (0.65 + 0.7 * tx.g) + pal(uHue + fres * 0.6 + pch) * fres * (0.5 + uCamo * 0.8)) * uTint + uTint * uGlow2 * (0.5 + 0.5 * pch); }`);
    }; }
  const inner = bio({ rough: 0.4, clear: 0.6, clearRough: 0.2, env: 0.7, tex: 'flesh', tile: 1.6, bump: 0.8, grain: 0.5, seam: 0x30081a, seamK: 0.5, vein: 0xcfe9ff, veinK: 0.3, veinGlow: 0.3, sss: 0.3, sssColor: 0xff6a90 }); inner.transparent = true;
  const claw = bio({ rough: 0.25, clear: 0.7, env: 0.7, tex: 'fine', tile: 2, bump: 0.4, grain: 0.4 }); claw.transparent = true;
  const cry = crystalMat(0xcfe9ff, { glow: 0.7, alpha: 0.88 });
  const mats = [mirror, inner, claw, cry];
  const camoMats = [inner, claw, cry];

  const rig = new Rig();
  const root = rig.bone(null, [0, 0, 0], 'root'), body = rig.bone(root, [0, 0.96, 0.0], 'body');
  const fore = rig.bone(body, [0, 1.0, 0.5], 'fore'), hind = rig.bone(body, [0, 0.92, -0.5], 'hind'), head = rig.bone(fore, [0, 1.05, 0.95], 'head');
  const jaw = rig.bone(head, [0, 0.92, 1.12], 'jaw'), pouch = rig.bone(head, [0, 0.82, 1.1], 'pouch');
  const tg = rig.bone(head, [0, 0.93, 1.42], 'tg'), club = rig.bone(tg, [0, 0.93, 2.42], 'club');
  const tur = [-1, 1].map((s) => rig.bone(head, [s * 0.22, 1.13, 1.05], 'tur'));
  // cola: espiral logarítmica
  const spiral = []; for (let i = 0; i <= 12; i++) { const a = i * 0.5, r = 1.0 * Math.exp(-0.2 * i); spiral.push(new V3(0, 0.95 + (1 - Math.cos(a)) * r * 0.7 - 0.1, -1.0 - Math.sin(a) * r * 0.8)); }
  const tail = []; [0, 2, 4, 6, 8, 10, 12].forEach((i, k) => tail.push(rig.bone(k ? tail[k - 1] : hind, spiral[i], 'tl')));
  // ── piel: tubo comprimido lateralmente (tronco), vientre claro, músculos de hombro/cadera ──
  const mirrorCol = (p, n) => new THREE.Color(0x6a7890).lerp(new THREE.Color(0xc0d0ee), 0.5 + 0.5 * Math.sin(p.x * 9 + p.y * 7 + p.z * 5)).multiplyScalar(0.62 + 0.25 * Math.sin(p.z * 6 + p.y * 3)).lerp(new THREE.Color(0xc89ab0), smooth(0.1, -0.9, n.y) * 0.7);
  const TS = [[0, 0.95, 0.66], [0, 1.0, 0.3], [0, 0.98, -0.15], [0, 0.9, -0.6], [0, 0.88, -0.9]];
  const trunk = tube(TS, { rad: (t) => lerp(0.3, 0.26, t) * (0.7 + 0.5 * Math.sin(Math.PI * (0.1 + 0.8 * t))) + 0.02, seg: low ? 14 : 24, sides: low ? 7 : 12, ex: [1.28, 0.78], bulge: (t, a) => 1 + 0.04 * Math.sin(t * 40) * Math.pow(Math.cos(a), 2), caps: true });
  paint(trunk, mirrorCol); rig.add(mirror, skinChain(trunk, [fore, body, hind], 0.25));
  for (const s of [-1, 1]) for (const [z, bn] of [[0.5, fore], [-0.5, hind]]) { const g = ellipsoid([0.1, 0.2, 0.22], { w: low ? 8 : 12, h: low ? 6 : 8, noise: 0.1, seed: z * 3 + s, pos: [s * 0.25, 0.86, z] }); paint(g, mirrorCol); rig.add(mirror, skinRigid(g, bn)); }
  const belly = ellipsoid([0.18, 0.15, 0.7], { w: low ? 8 : 12, h: low ? 5 : 8, noise: 0.1, seed: 4, pos: [0, 0.68, -0.02] }); paint(belly, (p, n) => new THREE.Color(0x9a5a80).lerp(new THREE.Color(0xd8a0c0), smooth(-0.3, 0.6, -n.y))); rig.add(inner, skinChain(belly, [fore, body, hind], 0.25));
  // ── cabeza de reptil: cráneo en cuña, casco con cresta, cejas, hocico, mandíbula con dientes irregulares ──
  const skull = ellipsoid([0.2, 0.2, 0.42], { w: low ? 10 : 16, h: low ? 7 : 12, noise: 0.07, seed: 6, pos: [0, 1.03, 1.12] }); paint(skull, mirrorCol); rig.add(mirror, skinRigid(skull, head));
  const snout = ellipsoid([0.14, 0.12, 0.3], { w: low ? 8 : 12, h: low ? 6 : 8, noise: 0.06, seed: 7, pos: [0, 0.97, 1.4] }); paint(snout, mirrorCol); rig.add(mirror, skinRigid(snout, head));
  const casque = ellipsoid([0.03, 0.3, 0.17], { w: low ? 8 : 12, h: low ? 7 : 12, noise: 0.15, freq: 3, seed: 8, pos: [0, 1.25, 0.8], dir: [0, 0.8, -1] }); paint(casque, (p, n) => new THREE.Color(0x7a90b8).lerp(new THREE.Color(0xe8f4ff), smooth(1.1, 1.6, p.y))); rig.add(mirror, skinRigid(casque, head));
  for (const s of [-1, 1]) { rig.add(mirror, skinRigid(plate({ w: 0.1, l: 0.16, h: 0.06, nr: 2, ns: 8, wrap: 1.5, keel: 0.7, quat: orient(new V3(s * 0.5, 1, 0.2), new V3(0, -0.15, 1)), pos: [s * 0.15, 1.2, 1.12], col: 0x6a80a8, col2: 0xd0e0ff }), head)); rig.add(claw, skinRigid(spike(0.02, 0.1, { sides: 3, seg: 1, pos: [s * 0.075, 0.99, 1.62], dir: [s * 0.2, 0.9, 0.3] }), head)); }
  const jw = ellipsoid([0.13, 0.065, 0.32], { w: low ? 8 : 12, h: low ? 5 : 8, noise: 0.05, seed: 9, pos: [0, 0.88, 1.32] }); paint(jw, mirrorCol); rig.add(mirror, skinRigid(jw, jaw));
  const mouthIn = ellipsoid([0.11, 0.05, 0.26], { w: 8, h: 5, seed: 10, pos: [0, 0.9, 1.34] }); paint(mouthIn, 0x8a2a48); rig.add(inner, skinRigid(mouthIn, jaw));
  const nT = low ? 4 : 7; for (let i = 0; i < nT; i++) for (const s of [-1, 1]) { const z = 1.22 + (i / nT) * 0.4, up = i % 2 === 0; if (R() < 0.12) continue; const g = spike(0.011 + R() * 0.005, 0.04 + R() * 0.035, { sides: 3, seg: 1, pos: [s * (0.11 - i * 0.004), up ? 0.935 : 0.885, z], dir: [-s * 0.15, up ? -1 : 1, 0.1] }); paint(g, 0xf2eadc); rig.add(claw, skinRigid(g, up ? head : jaw)); }
  // papada (saco de la garganta) y lengua con maza
  const sac = ellipsoid([0.15, 0.13, 0.2], { w: low ? 8 : 12, h: low ? 6 : 8, noise: 0.08, seed: 11, pos: [0, 0.8, 1.14] }); paint(sac, (p, n) => new THREE.Color(0xa05a88).lerp(new THREE.Color(0xe8b0d0), smooth(0.8, 0.7, p.y) * 0.5)); rig.add(inner, skinRigid(sac, pouch));
  const tng = tube([[0, 0.93, 1.42], [0, 0.93, 1.9], [0, 0.93, 2.42]], { rad: [0.032, 0.026], seg: 4, sides: 5, caps: false }); paint(tng, 0xd8607a); rig.add(inner, skinRigid(tng, tg));
  const clubG = ellipsoid([0.1, 0.1, 0.12], { w: 10, h: 7, seed: 12, pos: [0, 0.93, 2.42] }); paint(clubG, (p, n) => new THREE.Color(0xe0708a).lerp(new THREE.Color(0xffd0e0), 0.5 * smooth(0, 1, n.z))); rig.add(inner, skinRigid(clubG, club));
  // ── ojos-torreta: conos de piel con el ojo dentro; cada uno gira solo ──
  const turrets = [];
  tur.forEach((tb, i) => { const s = i ? 1 : -1; const cone = ellipsoid([0.19, 0.19, 0.17], { w: low ? 9 : 14, h: low ? 6 : 9, noise: 0.06, seed: 20 + i, pos: [s * 0.22, 1.13, 1.04] }); paint(cone, mirrorCol); rig.add(mirror, skinRigid(cone, tb));
    const e = eye({ r: 0.125, iris: 0xffd040, iris2: 0x7a4000, sclera: 0x9aa4b4, vein: 0x502838, pupil: 'slit', irisR: 0.9, glow: 0.9, lidMat: lidMaterial({ color: 0x5a6a88, vein: 0x303a50, sssColor: 0xcfe9ff, sss: 0.2, tile: 2 }), slant: 0.18, maxYaw: 0.5, maxPitch: 0.4, follow: 0.9 }); rig.attach(tb, e.object, [s * 0.22, 1.13, 1.1]); mats.push(e.mat, e.lid.material);
    turrets.push({ tb, e, sd: s, tx: 0, ty: 0, timer: Math.random(), mode: 0, sy: new Spring(0, 120, 12), sx: new Spring(0, 120, 12) }); });
  // ── patas de reptil (sprawl), pies cigodáctilos ──
  const legs = [];
  for (let side = 0; side < 2; side++) for (let row = 0; row < 2; row++) {
    const s = side ? 1 : -1, z = row ? -0.5 : 0.5, par = row ? hind : fore, H = new V3(s * 0.3, 0.8, z), K = new V3(s * 0.8, 0.6, z + (row ? -0.12 : 0.1)), F = new V3(s * 0.88, 0.03, z + (row ? -0.35 : 0.4));
    const Lg = buildLeg(rig, mirror, par, H, K, F, { r0: 0.1, rk: 0.075, r1: 0.032, knuckle: 0.02, seg: low ? 8 : 12, sides: low ? 5 : 7, claw: 0, spines: 0, side: s, name: 'e' + side + row, paintFn: mirrorCol });
    for (let k = 0; k < 4; k++) { const front = k < 2, sp = (k % 2 ? 1 : -1) * (front ? 0.45 : 0.4), dir = [Math.sin(sp) * 0.9 + s * 0.15, -0.35, (front ? 1 : -1) * Math.cos(sp)]; const tg2 = spike(0.024, 0.2 + (front ? 0.04 : 0), { sides: 4, seg: 2, bend: 0.3, bendDir: [0, -1, 0], pos: [F.x, F.y + 0.02, F.z], dir }); paint(tg2, (p) => new THREE.Color(0x8a9ab8).lerp(new THREE.Color(0xfaf0e0), smooth(0.05, 0.2, p.distanceTo(F)))); rig.add(claw, skinRigid(tg2, Lg.kb)); }
    legs.push({ Lg, s, row, base: new V3(F.x, 0, F.z) });
  }
  // ── cola enroscada ──
  { const g = tube(spiral, { rad: (t) => 0.2 * Math.pow(1 - t, 0.9) + 0.03, seg: low ? 16 : 30, sides: low ? 6 : 9, ex: [1.1, 0.9] }); paint(g, mirrorCol); rig.add(mirror, skinChain(g, tail, 0.2)); rig.add(cry, skinRigid(crystal(0.035, 0.18, { sides: 5, pos: spiral[12].toArray(), dir: [0, 0.4, 1], seed: 3, c0: 0x4a6a90, c1: 0xffffff }), tail[6])); }
  // ── cresta dorsal de esquirlas ──
  { const sp = path(TS); for (let i = 0; i < (low ? 5 : 11); i++) { const t = 0.04 + (i / (low ? 4 : 10)) * 0.92, P = sp.at(t), k = 1 - Math.abs(t - 0.4) * 1.1, h = 0.32 * clamp(k, 0.3, 1) + 0.04, bn = t < 0.4 ? fore : t < 0.72 ? body : hind;
      rig.add(cry, skinRigid(crystal(0.045 * clamp(k, 0.4, 1), h, { sides: 5, taper: 0.7, tip: 0.4, lean: -0.3, seed: 200 + i, pos: [P.x, P.y + 0.42 * (1 - Math.abs(t - 0.4) * 0.5), P.z], dir: [0, 1, -0.45], c0: 0x2a4068, c1: 0xf0ffff }), bn)); } }
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group);
  const glow = glowSprite(0xcfe9ff, 3.5, 0); glow.position.set(0, 1.0, 0); rootObj.add(glow);
  const aura = shieldAura(0x9ad8ff, 1.5); aura.position.y = 0.9; rootObj.add(aura);
  mats.push(disposer(rig, [glow.material, aura.geometry, aura.material]));
  const tmp = new V3(), look = new V3(0, 0, 1), q1 = new THREE.Quaternion(), lh = new V3(), cache = new Map(), bend = new V3();
  const headS = new Spring(0, 70, 9), bodyS = new Spring(0, 60, 7), tailS = new Spring(0, 40, 5), popS = new Spring(1, 90, 9), tailY = new Spring(0, 35, 4);
  let prevHp = 1, flinch = 0, phase = 0, camo = 0, lastS = '', sT = 0, bT = 0, openT = 0, tongue = 0, flickT = 3, flickK = 0, tint = 0, flashK = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(Math.max(dt, 0.001), 0.05); const speed = Math.min(1.5, ctx.speed || 0);
    if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4.5);
    const blink = st.s === 'blink', strike = st.s === 'strike', hurt = (st.hp ?? 1) < 0.35, mu = mirror.userData.u;
    if (st.s !== lastS) { if (strike) { sT = 0; popS.x = 0.55; popS.v = 4; flashK = 1; } if (blink) bT = 0; lastS = st.s; }
    if (strike) sT += dt; if (blink) bT += dt; flashK = Math.max(0, flashK - dt * 2.2);
    // camuflaje: opacidad + distorsión; se revela al golpear y al ser herido
    const wantCamo = blink ? 1 : strike ? 0 : st.c ? 1 : 0; camo = dampTo(camo, wantCamo, strike ? 24 : blink ? 9 : 5, dt); mu.uCamo.value = camo;
    phase += dt * (3.2 + speed * 7) * (hurt ? 0.7 : 1);
    // golpe: preparación → latigazo → recuperación
    let lunge = 0, wind = 0, lash = 0;
    if (strike) { const c = sT % 1.15; lash = c >= 0.28 && c < 0.46 ? ease((c - 0.28) / 0.1) : c >= 0.46 && c < 0.7 ? 1 - ease((c - 0.46) / 0.24) : 0; lunge = lash; wind = c < 0.3 ? ease(c / 0.3) : c < 0.5 ? 1 : Math.max(0, 1 - (c - 0.5) / 0.3); }
    // patas de camaleón (pares diagonales, lentas, balanceo); el latigazo las adelanta
    cache.clear();
    legs.forEach((Lg, i) => { const grp = (i === 0 || i === 3) ? 0 : 1, ph = phase + grp * Math.PI, [adv, lift] = gait(ph, 0.45), stp = 0.28 * Math.min(1, 0.2 + speed), lf = 0.3 * Math.min(1, 0.25 + speed);
      let fy = Lg.base.y + lift * lf + (hurt && i === 2 ? 0.12 : 0), fz = Lg.base.z + adv * stp;
      if (strike && Lg.row === 0) { const w = clamp(sT / 0.3, 0, 1), s2 = sT > 0.3 && sT < 0.5 ? 1 : 0; fy += w * 0.4 * (1 - s2); fz += s2 * 0.5 + w * 0.15; }
      tmp.set(Lg.base.x, fy, fz); bend.set(Lg.s * 1.5, 0.6, 0); footTo(Lg.Lg, root, tmp, bend, cache); });
    const sway = Math.sin(phase * 0.5) * 0.06, bk = blink ? ease(bT / 0.6) : 0, pop = popS.step(dt, 1);
    body.rotation.y = (blink ? bk * 3.2 : 0) + sway * 0.4;
    body.rotation.x = -wind * 0.28 + lunge * 0.4 + bodyS.step(dt, speed * 0.04) + (blink ? -bk * 0.2 : 0);
    body.rotation.z = Math.sin(phase) * 0.04 * (0.3 + speed) + flinch * Math.sin(t * 55) * 0.07 + (hurt ? Math.sin(t * 4) * 0.08 : 0);
    const br = 1 + Math.sin(t * 2 + st.id) * 0.02, sq = (1 - 0.25 * bk) * pop; body.scale.set(sq * br, sq * (1 - 0.18 * bk) * (1 + 0.05 * Math.sin(t * 2 + st.id)), sq * br);
    body.position.y = body.userData.rest.y + Math.abs(Math.sin(phase)) * 0.025 + (blink ? -bk * 0.25 : 0) - wind * 0.12 - (hurt ? 0.05 : 0); body.position.z = lunge * 0.55 - wind * 0.15;
    fore.rotation.y = Math.sin(phase) * 0.06 * (0.3 + speed); hind.rotation.y = -fore.rotation.y * 1.2;
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    head.rotation.y = headS.step(dt, clamp(lx, -0.7, 0.7) * 0.6); head.rotation.x = -wind * 0.15 + lunge * 0.2 + clamp(-ly, -0.5, 0.5) * 0.2;
    // boca y lengua: aviso (abre la boca) → latigazo (estira) → recoge. En calma, un chasquido ocasional.
    flickT -= dt; if (flickT <= 0 && !strike && !blink) { flickK = 1; flickT = 2.5 + Math.random() * 4; } flickK = Math.max(0, flickK - dt * 2.2);
    const tTarget = strike ? lash * 1.0 + wind * 0.08 : flickK > 0 ? Math.sin(flickK * Math.PI) * 0.28 : 0; tongue = dampTo(tongue, tTarget, strike ? 28 : 14, dt);
    const TL = Math.max(0.001, tongue); tg.scale.set(1, 1, TL); club.scale.set(1, 1, 1 / TL); club.scale.multiplyScalar(tongue > 0.04 ? 1 : 0.001); tg.rotation.y = Math.sin(t * 50) * 0.02 * lash;
    openT = dampTo(openT, strike ? Math.max(0.35, wind) : flickK > 0 ? 0.6 : 0.06 + 0.04 * Math.sin(t * 2.2), 14, dt); jaw.rotation.x = openT * 0.55;
    const pc = 1 + 0.12 * Math.sin(t * 2.6 + st.id) + openT * 0.3 + wind * 0.4 + flinch * 0.3; pouch.scale.set(pc, pc, pc);
    // ojos-torreta: cada uno elige objetivo (jugador o barrido aleatorio) por su cuenta
    head.updateMatrix(); boneQuat(head, root, q1); q1.invert();
    turrets.forEach((T, i) => {
      T.timer -= dt; if (T.timer <= 0) { T.mode = Math.random() < (strike ? 0.95 : 0.5) ? 0 : 1; T.timer = 0.5 + Math.random() * 1.7; if (T.mode) { T.tx = (Math.random() - 0.5) * 2.4 + T.sd * 0.4; T.ty = (Math.random() - 0.5) * 1.0; } }
      const ty = T.mode ? T.tx : clamp(lx - head.rotation.y, -1.1, 1.1) + T.sd * 0.15, tx = T.mode ? T.ty : clamp(-ly, -0.8, 0.8) * 0.6;
      T.tb.rotation.y = T.sy.step(dt, ty) * 0.8; T.tb.rotation.x = T.sx.step(dt, tx) * 0.8;
      gazeDir(look, ctx.dist, tmp.set(T.sd * 0.22, 1.13, 1.1), lh); lh.applyQuaternion(q1); lh.applyQuaternion(new THREE.Quaternion().setFromEuler(T.tb.rotation).invert());
      T.e.update(dt, T.mode ? null : lh, { open: 0.95 - (hurt ? 0.25 : 0), dilate: strike ? 0.4 : 0, glowMul: 1 - camo * 0.5, quiver: hurt ? 1 : 0 });
    });
    camoMats.forEach((m) => { m.opacity = lerp(m === cry ? 0.88 : 1, 0.03, camo); }); turrets.forEach((T) => { T.e.mat.transparent = true; T.e.mat.opacity = lerp(1, 0.35, camo); T.e.lid.material.transparent = true; T.e.lid.material.opacity = lerp(1, 0.2, camo); });
    // cola: se enrosca y afloja; resorte para movimiento secundario
    tailY.step(dt, Math.sin(t * 0.9 + st.id) * 0.35 - speed * 0.2); const tl = tailS.step(dt, wind * 0.4 - lunge * 0.3 + Math.sin(phase) * 0.05);
    tail.forEach((b, i) => { b.rotation.y = (tailY.x * 0.3 + Math.sin(t * 1.1 + i * 0.5) * 0.08) * (i ? 0.6 : 1) + wind * 0.08; b.rotation.x = tl * 0.15 + (hurt ? -0.03 : 0); b.scale.setScalar(1); });
    // color de camaleón: azul-cian en calma, rojo-ámbar en el aviso; destello al reaparecer
    const hueT = strike ? 0.0 + 0.04 * Math.sin(t * 20) : 0.55 + 0.12 * Math.sin(t * 0.35 + st.id);
    mu.uHue.value = dampTo(mu.uHue.value, hueT, 8, dt); mu.uGlow2.value = wind * 0.5 + lunge * 0.4; tint = dampTo(tint, strike ? 1 : 0, 10, dt); mu.uTint.value.setRGB(1, 1 - tint * 0.7, 1 - tint * 0.85); mirror.color.setRGB(1 - tint * 0.1, 1 - tint * 0.75, 1 - tint * 0.8);
    cry.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 5) + wind * 1.5; inner.userData.u.uVeinGlow.value = 0.3 + wind * 1.2; inner.userData.u.uSss.value = 0.3 + wind * 0.8;
    glow.material.opacity = (strike && sT < 0.45 ? 1 - sT / 0.45 : 0) * 0.6 + wind * 0.25 * (1 - camo); rootObj.rotation.z = 0; tickAura(aura, st, t);
  } };
}
