// GEODA — tanque. Un molusco-armadillo acorazado: el caparazón son BANDAS de placas superpuestas (como un armadillo/quitón) con
// una quilla dorsal y biocristales que brotan de las juntas. Cerrada rueda como una bola de placas (20 % de daño); cada ~5 s
// se abre ~2 s: la valva superior se alza, las bandas se abren en abanico y enseña un interior de carne húmeda: labios, dientes
// irregulares de nácar, lengua de tentáculos y un ojo-núcleo ardiente sobre un tallo muscular (la debilidad).
// st.s: 'roll' (cerrada) / 'open' (st.o). st.hp<0.35 la coraza se agrieta y tirita; st.sd aura; st.st aturdida.
import { THREE, TAU, disposer, gazeDir, lod, clamp, lerp, smooth, rng, bio, crystalMat, lidMaterial, ellipsoid, tube, spike, plate, orient, crystalCluster, paint, path, Rig, skinRigid, skinChain, eye, boneQuat, glowSprite, shieldAura, tickAura, Spring, dampTo } from './geoda-bio.js';

export default function build(kit, color) {
  const L = lod(), low = L.low, hi = L.hi, V3 = THREE.Vector3;
  const col = new THREE.Color(color), R = rng(11);
  const RX = 1.1, RY = 0.9, RZ = 1.0, CY = 0.92, HZ = -0.95;
  const shell = bio({ rough: 0.42, clear: 0.5, clearRough: 0.3, metal: 0.1, env: 0.5, tex: 'chitin', tile: 1.2, bump: 0.8, grain: 0.55, seam: color, seamK: 0.0, seamGlow: 0.0, rv: 0.7, lift: 0.14, rim: 0.25, rimColor: 0xb890ff, sssColor: 0xb066ff });
  const flesh = bio({ rough: 0.4, clear: 0.6, clearRough: 0.18, sheen: 0.1, env: 0.6, tex: 'flesh', tile: 1.3, bump: 0.9, grain: 0.45, seam: 0x2a0630, seamK: 0.55, vein: 0xd9a0ff, veinK: 0.3, veinGlow: 0.7, sss: 0.25, sssColor: 0xff40b0, lift: 0.16 });
  const cry = crystalMat(color, { glow: 0.9, alpha: 0.9 });
  const mats = [shell, flesh, cry];

  const rig = new Rig();
  const root = rig.bone(null, [0, 0, 0], 'root'), body = rig.bone(root, [0, CY, 0], 'body');
  const hu = rig.bone(body, [0, CY, HZ], 'hu'), hl = rig.bone(body, [0, CY, HZ], 'hl');
  const NU = low ? 8 : 11, NL = low ? 6 : 8, bandsU = [], bandsL = [];
  for (let i = 0; i < NU; i++) bandsU.push(rig.bone(hu, [0, CY, HZ], 'bu'));
  for (let i = 0; i < NL; i++) bandsL.push(rig.bone(hl, [0, CY, HZ], 'bl'));

  // ── bandas del caparazón ──
  const nb = low ? 14 : hi ? 26 : 20, na = low ? 2 : 3;
  const shellBase = new THREE.Color(0x2a1658), shellRim = new THREE.Color(0x9a78e8), flC0 = new THREE.Color(0x6a0a50), flC1 = new THREE.Color(0xc8388c), tmp = new THREE.Color();
  function band(sign, k, N, bone, ryK) {
    const a0 = Math.max(k === 0 ? 0.16 : 0, (k / N) * Math.PI), a1 = ((k + 1) / N) * Math.PI, aEnd = Math.min(Math.PI, a1 + 0.07), ry = RY * ryK;
    const over = 0.17, keel = 0.1 + 0.03 * Math.sin(k * 1.7), thick = 0.12, tone = (k % 2 ? 0.7 : 1.15) * (0.9 + R() * 0.2);
    const P = (a, b, rad, o) => { const sa = Math.sin(a); o.set(RX * sa * Math.cos(b) * rad, sign * ry * sa * Math.sin(b) * rad + CY, RZ * Math.cos(a) * rad); };
    const v = new V3(), outer = [], inner = [], co = [], ci = [], ids = (i, j) => i * (nb + 1) + j;
    for (let i = 0; i <= na; i++) { const tt = i / na, a = lerp(a0, aEnd, tt); for (let j = 0; j <= nb; j++) {
      const b = (j / nb) * Math.PI, kb = Math.exp(-Math.pow((b - Math.PI / 2) / 0.24, 2)), rb = Math.pow(Math.sin(b), 0.5);
      const rad = 1 + over * smooth(0, 1, tt) * (0.6 + 0.4 * rb) + keel * kb * (0.55 + 0.45 * Math.sin(tt * Math.PI)) + 0.012 * Math.sin(b * 9 + k);
      P(a, b, rad, v); outer.push(v.x, v.y, v.z); P(a, b, rad - thick, v); inner.push(v.x, v.y, v.z);
      tmp.copy(shellBase).multiplyScalar(tone * (0.45 + 0.55 * smooth(0, 0.7, tt))).lerp(shellRim, 0.5 * smooth(0.75, 1, tt) + 0.35 * kb + 0.15 * (1 - rb)); co.push(tmp.r, tmp.g, tmp.b);
      tmp.copy(flC0).lerp(flC1, 0.5 * Math.sin(b) + 0.3 * R()); ci.push(tmp.r, tmp.g, tmp.b);
    } }
    const I = [], mk = (flip) => { const o = []; for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) { const a = ids(i, j), b = ids(i, j + 1), c = ids(i + 1, j), d = ids(i + 1, j + 1); if (flip) o.push(a, c, b, b, c, d); else o.push(a, b, c, b, d, c); } return o; };
    const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(outer, 3)); g1.setAttribute('color', new THREE.Float32BufferAttribute(co, 3)); g1.setIndex(mk(sign > 0)); g1.computeVertexNormals();
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(inner, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(ci, 3)); g2.setIndex(mk(sign < 0)); g2.computeVertexNormals();
    // cantos: borde delantero/trasero y laterales (grosor de la placa)
    const E = [], EC = [], pushQ = (pa, pb, qa, qb, flip) => { const base = E.length / 3; for (const q of [pa, pb, qa, qb]) { E.push(q[0], q[1], q[2]); EC.push(0.05, 0.02, 0.1); } return flip ? [base, base + 2, base + 1, base + 1, base + 2, base + 3] : [base, base + 1, base + 2, base + 1, base + 3, base + 2]; };
    const gp = (arr, i, j) => { const o = ids(i, j) * 3; return [arr[o], arr[o + 1], arr[o + 2]]; }, EI = [];
    for (let j = 0; j < nb; j++) { EI.push(...pushQ(gp(outer, 0, j), gp(outer, 0, j + 1), gp(inner, 0, j), gp(inner, 0, j + 1), sign > 0)); EI.push(...pushQ(gp(outer, na, j), gp(outer, na, j + 1), gp(inner, na, j), gp(inner, na, j + 1), sign < 0)); }
    for (let i = 0; i < na; i++) { EI.push(...pushQ(gp(outer, i, 0), gp(outer, i + 1, 0), gp(inner, i, 0), gp(inner, i + 1, 0), sign < 0)); EI.push(...pushQ(gp(outer, i, nb), gp(outer, i + 1, nb), gp(inner, i, nb), gp(inner, i + 1, nb), sign > 0)); }
    const g3 = new THREE.BufferGeometry(); g3.setAttribute('position', new THREE.Float32BufferAttribute(E, 3)); g3.setAttribute('color', new THREE.Float32BufferAttribute(EC, 3)); g3.setIndex(EI); g3.computeVertexNormals();
    rig.add(shell, skinRigid(g1, bone)); rig.add(flesh, skinRigid(g2, bone)); rig.add(shell, skinRigid(g3, bone));
    return { a0, a1, sign, ry };
  }
  const infoU = bandsU.map((b, k) => band(1, k, NU, b, 1)), infoL = bandsL.map((b, k) => band(-1, k, NL, b, 0.8));
  // ── biocristales: nacen de las juntas entre bandas, asimétricos (más en el flanco derecho) y de las grietas ──
  const rimPt = (sign, a, b, ryK, rad = 1.03) => new V3(RX * Math.sin(a) * Math.cos(b) * rad, sign * RY * ryK * Math.sin(a) * Math.sin(b) * rad + CY, RZ * Math.cos(a) * rad);
  infoU.forEach((inf, k) => {
    if (k === 0) return; const a = inf.a0 + 0.02, bone = bandsU[k];
    [[Math.PI / 2 + (R() - 0.5) * 0.3, 1], [0.45 + R() * 0.4, k % 2 ? 0 : 1], [Math.PI - 0.5 - R() * 0.4, k % 3 ? 0 : 1]].forEach(([b, on], ix) => {
      if (!on) return; const p = rimPt(1, a, b, 1, 1.04), n = new V3(RX * Math.sin(a) * Math.cos(b) / (RX * RX), RY * Math.sin(a) * Math.sin(b) / (RY * RY), Math.cos(a) / RZ).normalize(); if (n.lengthSq() < 0.5) return;
      const big = ix === 0 ? 1 : 0.65; crystalCluster(low ? 2 : ix === 0 ? 4 : 3, 0.05 * big * (0.8 + 0.5 * Math.sin(k * 1.3 + ix)), 0.34 * big * (1 - k * 0.04), { pos: p, dir: [n.x, n.y, n.z - 0.1], seed: 40 + k * 7 + ix, c0: 0x2a1060, c1: 0xe6ccff, spread: 0.45 }).forEach((c) => rig.add(cry, skinRigid(c, bone)));
    });
  });
  infoL.forEach((inf, k) => { if (k === 0 || k % 2) return; const a = inf.a0 + 0.02, b = Math.PI / 2 + (R() - 0.5) * 0.6, p = rimPt(-1, a, b, 0.8, 1.04); crystalCluster(2, 0.04, 0.22, { pos: p, dir: [0, -1, 0.2], seed: 90 + k, c0: 0x2a1060, c1: 0xe6ccff }).forEach((c) => rig.add(cry, skinRigid(c, bandsL[k]))); });
  // cresta dorsal de placas puntiagudas sobre la quilla de cada banda
  infoU.forEach((inf, k) => { const a = (inf.a0 + inf.a1) / 2 + 0.08, p = rimPt(1, a, Math.PI / 2, 1, 1.1), g = spike(0.13 - Math.abs(k - NU / 2) * 0.012, 0.26 - Math.abs(k - NU / 2) * 0.025, { sides: 4, seg: 2, bend: -0.5, bendDir: [0, 0, 1], pos: p, dir: [0, 1, 0.1], pow: 0.9 }); paint(g, (q) => new THREE.Color(0x6a4ab8).lerp(new THREE.Color(0xf0e4ff), smooth(0, 0.3, q.y - p.y))); rig.add(shell, skinRigid(g, bandsU[k])); });
  // ── dientes irregulares de nácar y labios en el borde de las valvas ──
  const nT = low ? 4 : 7;
  for (const [sign, bands, infos, ryK] of [[1, bandsU, infoU, 1], [-1, bandsL, infoL, 0.8]]) for (const side of [-1, 1]) for (let i = 0; i < nT; i++) {
    const a = 0.25 + (i / (nT - 1)) * (Math.PI * 0.62) + (R() - 0.5) * 0.12, rim = new V3(RX * Math.sin(a) * side * 0.93, CY + sign * 0.02, RZ * Math.cos(a) * 0.93);
    const len = (0.2 + R() * 0.3) * (R() < 0.15 ? 0.4 : 1), g = spike(0.05 + R() * 0.03, len, { sides: 4, seg: 2, bend: (R() - 0.5) * 0.8, bendDir: [-side, 0, 0.3], pos: rim, dir: [-side * 0.35, -sign * 0.9, 0.2] });
    paint(g, (p) => new THREE.Color(0x62503c).lerp(new THREE.Color(0xf2e8d2), smooth(rim.y + sign * 0.0, rim.y - sign * len * 0.9, p.y) * 1.0));
    let kk = 0; infos.forEach((inf, ix) => { if (a >= inf.a0) kk = ix; }); rig.add(shell, skinRigid(g, bands[kk]));
  }
  // labios hinchados del manto a lo largo del borde (arcos de carne)
  for (const [sign, bone, ryK] of [[-1, body, 0.8]]) for (const side of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 8; i++) { const a = 0.15 + (i / 8) * (Math.PI - 0.5); pts.push([RX * Math.sin(a) * side * 0.86, CY - 0.03, RZ * Math.cos(a) * 0.86]); }
    const g = tube(pts, { rad: (t) => 0.09 * (0.7 + 0.5 * Math.sin(t * Math.PI)), seg: low ? 8 : 16, sides: low ? 5 : 7, ex: [0.8, 1.3] }); paint(g, (p) => new THREE.Color(0x6a1058).lerp(new THREE.Color(0xc0509a), 0.5 * R()));
    rig.add(flesh, skinRigid(g, body));
  }
  // manto: montículo de carne que llena la valva inferior
  const mantle = ellipsoid([0.95, 0.36, 0.92], { w: low ? 12 : 20, h: low ? 7 : 12, noise: 0.14, freq: 2.2, seed: 8, pos: [0, CY - 0.18, 0.05] }); paint(mantle, (p, n) => new THREE.Color(0x680c54).lerp(new THREE.Color(0xd04c9c), smooth(0.2, 1, n.y) * 0.6)); rig.add(flesh, skinRigid(mantle, body));
  // tallo del ojo-núcleo: columna muscular de 3 huesos
  const s1 = rig.bone(body, [0, CY - 0.05, 0.1], 's1'), s2 = rig.bone(s1, [0, CY + 0.28, 0.3], 's2'), s3 = rig.bone(s2, [0, CY + 0.52, 0.5], 's3');
  const stalk = tube([[0, CY - 0.15, 0.05], [0, CY + 0.1, 0.18], [0, CY + 0.3, 0.32], [0, CY + 0.5, 0.48]], { rad: (t) => 0.27 - 0.07 * t, seg: low ? 8 : 14, sides: low ? 6 : 10, bulge: (t) => 1 + 0.08 * Math.sin(t * 20), ex: [1, 1] });
  paint(stalk, (p, n) => new THREE.Color(0x600c4c).lerp(new THREE.Color(0xc03c90), smooth(0.1, 1, n.y) * 0.4)); rig.add(flesh, skinChain(stalk, [s1, s2, s3], 0.14));
  // ojo-núcleo
  const core = eye({ r: 0.44, iris: 0xff5a10, iris2: 0x7a1400, sclera: 0xeed4c4, vein: 0xa01820, pupil: 'round', irisR: 0.66, glow: 0.7, lidMat: lidMaterial({ color: 0x9a2a80, vein: 0x50104a, sssColor: 0xff40b0, sss: 0.4, tile: 1.4 }), slant: 0.12, maxYaw: 0.8, maxPitch: 0.6 });
  rig.attach(s3, core.object, [0, CY + 0.52 + 0.3, 0.6]); mats.push(core.mat, core.lid.material);
  // lengua: 5 tentáculos de 4 huesos con punta luminosa
  const tongue = [], nTen = low ? 3 : 5;
  for (let i = 0; i < nTen; i++) {
    const sx = (i - (nTen - 1) / 2) * 0.3, len = 0.95 + (i % 2) * 0.25, J = [[sx, CY - 0.08, 0.55], [sx * 1.15, CY + 0.08, 0.55 + len * 0.3], [sx * 1.35, CY + 0.15, 0.55 + len * 0.62], [sx * 1.5, CY + 0.1, 0.55 + len]];
    const bs = []; J.forEach((p, ix) => bs.push(rig.bone(ix ? bs[ix - 1] : body, p, 'tg')));
    const g = tube(J, { rad: (t) => 0.085 * (1 - t * 0.85) + 0.01, seg: low ? 8 : 14, sides: low ? 4 : 6, bulge: (t) => 1 + 0.15 * Math.sin(t * 25), caps: true }); paint(g, (p) => new THREE.Color(0x781060).lerp(new THREE.Color(0xff9a50), smooth(0.7, 1.0, (p.z - 0.55) / len)));
    rig.add(flesh, skinChain(g, bs, 0.12)); tongue.push({ bs, sx, ph: i * 1.3, len });
  }
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); rootObj.position.y = -0.9; /* el centro de la criatura (sim) está a 0.9 r del suelo: los pies del modelo (y=0) deben tocar el piso */
  const halo = glowSprite(0xffa040, 1.4, 0); halo.position.set(0, CY + 0.9, 0.6); rootObj.add(halo);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.5); aura.position.y = CY; rootObj.add(aura);
  mats.push(disposer(rig, [halo.material, aura.geometry, aura.material]));

  const sOpen = new Spring(0, 55, 7.5), sWob = new Spring(0, 70, 6), sShake = new Spring(0, 90, 5), sPit = new Spring(0, 40, 6), sYaw = new Spring(0, 40, 6);
  const tmp0 = new V3(); let prevHp = 1, flinch = 0, roll = 0, glowT = 0, prevOpen = false, snap = 0, rattle = 0; const q1 = new THREE.Quaternion(), lh = new V3(), tv = new V3(), look = new V3(0, 0.3, 1);

  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05);
    const open = !!(st.o || st.s === 'open'), speed = Math.min(1.6, ctx.speed || 0), hurt = st.hp != null && st.hp < 0.35, stun = !!st.st;
    if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.004) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 4.5);
    if (flinch > 0.9) rattle = Math.max(rattle, 0.7); if (open && !prevOpen) { snap = 1; rattle = 1; } prevOpen = open; snap = Math.max(0, snap - dt * 2.5); rattle = Math.max(0, rattle - dt * 2);
    const o = Math.max(0, sOpen.step(dt, open ? 1 : 0)), oc = Math.min(1.1, o), oe = clamp(o, 0, 1);
    // valvas: la superior se alza y las bandas se abren en abanico; la inferior baja un poco
    hu.rotation.x = -oc * 1.12; hl.rotation.x = oc * 0.3;
    const flare = oe * 0.16 + snap * 0.08;
    bandsU.forEach((b, k) => { b.rotation.x = -flare * (k / NU) * 0.9 + (hurt ? Math.sin(t * 17 + k * 2) * 0.012 : 0) + Math.sin(t * 40 + k) * rattle * 0.01; b.rotation.y = (k % 2 ? 1 : -1) * 0.01 * Math.sin(t * 13 + k) * (hurt ? 2 : 0.4) * (1 - oe); });
    bandsL.forEach((b, k) => { b.rotation.x = flare * (k / NL) * 0.5; });
    // rodar cerrada, nivelar al abrir
    if (open || o > 0.05) { const tgt = Math.round(roll / TAU) * TAU; roll += (tgt - roll) * Math.min(1, 7 * dt); } else roll += dt * (speed * 3.4) * (hurt ? 0.6 : 1);
    const wob = sWob.step(dt, open ? 0 : Math.sin(roll * 2) * 0.05);
    body.rotation.x = roll + wob; body.rotation.z = Math.sin(t * 1.1 + st.id) * 0.03 * (1 - oc) + (hurt ? Math.sin(t * 17) * 0.04 : 0);
    body.position.y = body.userData.rest.y + (open ? 0.02 : Math.abs(Math.sin(roll * 2)) * 0.05 * speed) + Math.sin(t * 2.2 + st.id) * 0.015 - 0.04 * snap;
    const shk = sShake.step(dt, stun ? Math.sin(t * 40) * 0.08 : 0); rootObj.position.x = shk + flinch * Math.sin(t * 60) * 0.03; rootObj.rotation.z = stun ? Math.sin(t * 31) * 0.05 : 0;
    tickAura(aura, st, t);
    // interior: latido; el ojo se asoma y arde (retraído al cerrar para caber dentro del caparazón)
    const beat = 0.5 + 0.5 * Math.sin(t * (hurt ? 9 : 5.2)), pul = oc * (0.6 + 0.4 * beat);
    s1.position.y = s1.userData.rest.y - body.userData.rest.y - (1 - oe) * 0.55; s1.rotation.x = sPit.step(dt, -clamp(look.y, -0.5, 0.8) * 0.5 + 0.1 * Math.sin(t * 1.2 + st.id)); s1.rotation.y = sYaw.step(dt, clamp(Math.atan2(look.x, Math.max(0.2, look.z)), -0.7, 0.7) * 0.5);
    s2.rotation.x = -s1.rotation.x * 0.3 + 0.1 * Math.sin(t * 1.5) * oe; s3.rotation.z = Math.sin(t * 0.9) * 0.05 * oe;
    core.object.scale.setScalar(0.5 + 0.5 * oe * (1 + 0.05 * beat));
    s3.updateMatrix(); boneQuat(s3, root, q1); gazeDir(look, ctx.dist, tmp0.set(0, CY + 0.8, 0.6), lh); lh.applyQuaternion(q1.clone().invert());
    core.update(dt, lh, { open: oe > 0.2 ? (stun ? 0.5 : hurt ? 0.65 + 0.2 * beat : 1) : 0.0, dilate: -0.15 + 0.35 * beat - (hurt ? 0.25 : 0), glowMul: 0.5 + 0.9 * oc * (0.7 + 0.5 * beat), quiver: hurt ? 1 : 0 });
    halo.material.opacity = oc * (0.22 + 0.16 * beat) * (0.8 + snap * 0.5); halo.scale.setScalar(1.4 + 0.3 * beat + snap * 0.6);
    glowT += (oc - glowT) * Math.min(1, 10 * dt);
    tongue.forEach((T, i) => { const ext = oe, a = (0.12 + 0.45 * oe) * (1 + (hurt ? 0.6 : 0)); T.bs.forEach((b, ix) => { if (!ix) { b.rotation.x = -0.5 + (1 - ext) * 0.9 + Math.sin(t * 1.8 + T.ph) * 0.12 * oe; b.rotation.y = Math.sin(t * 0.9 + T.ph) * 0.15; return; } b.rotation.x = Math.sin(t * (2.0 + (hurt ? 3 : 0)) + T.ph + ix * 0.9) * a * 0.55 - 0.15 * ext; b.rotation.y = Math.cos(t * 1.7 + T.ph + ix) * a * 0.5; }); T.bs[0].scale.setScalar(Math.max(0.15, ext)); });
    // cristales y grietas: brillan cerrada (alerta de blindaje) y titilan; herida = grietas encendidas
    cry.emissiveIntensity = 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4)) + (open ? -0.1 : 0.25) + (hurt ? 0.5 * Math.sin(t * 20) ** 2 : 0);
    shell.userData.u.uSeamGlow.value = 0.25 + (open ? 0 : 0.2 * Math.sin(t * 5) ** 2) + (hurt ? 1.3 + 0.6 * Math.sin(t * 13) : 0);
    flesh.userData.u.uVeinGlow.value = 0.5 + 1.2 * glowT * beat; flesh.userData.u.uSss.value = 0.15 + 0.5 * glowT;
  } };
}
