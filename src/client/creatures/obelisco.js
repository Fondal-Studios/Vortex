// OBELISCO — francotirador estacionario. Torre carnosa-ósea anclada al suelo: una columna de vértebras de carne con costillas de hueso, placas
// dorsales y cristales; en la cima una flor-ojo imponente (pétalos-garra de quitina que se abren, un gran ojo húmedo de iris cian y párpados
// de carne); cola de escorpión con aguijón de biocristal; raíces que reptan y patas-ancla.
// Aviso del disparo (charge 1.6 s): los pétalos se abren, la pupila se enfoca y el cristal del ojo se calienta; un rayo láser fino traza al
// jugador (st.a = vector de apuntado en mundo) y se fija (más grueso, blanco-rojo) los últimos 0.4 s; al disparar hay retroceso.
import * as THREE from 'three';
import { cfg } from '../quality.js';
import { bioMaterial } from './obelisco-mat.js';
import { bigEye, beamMesh, glowMat, glowSphere, softDot, clamp, lerp, damp } from './obelisco-lib.js';
import { V3, paint, place, aimY, merge, loft, line, prof, domePlate, blobGeo, spikes, crystals, crystalGeo, sstep, ikLeg, legGeometry, tentacleBundle, tentacleRig } from './obelisco-geo.js';

export default function build(kit, color) {
  const { Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const R = LOW ? 7 : HI ? 14 : 10;
  const bio = bioMaterial({ glow: 0x2de0ff, vein: 0x0a1020, rim: 0x1c4a6a, scale: 1.3, bump: 1.0, wet: 0.6, ridge: 50, sheen: 0.1, breath: 0.012 });
  const U = bio.userData.u; U.uVeinGlow.value = 0.35; U.uCrackGlow.value = 0.2;
  const bioT = bioMaterial({ glow: 0x2de0ff, vein: 0x0a1020, rim: 0x1c4a6a, scale: 1.3, tent: 12, breath: 0.0 }); const UT = bioT.userData.u; UT.uVeinGlow.value = 0.3;
  const FLESH = 0x2a2236, FLESH2 = 0x433a52, CHIT = 0x101a24, BONE = 0x6a7680, CRY = 0x20d0ff;
  const root = new THREE.Group(), body = new THREE.Group(); body.scale.setScalar(0.78); body.position.y = -1.0; root.add(body); // origen = centro de la esfera de colisión: el suelo queda en y=-1
  const mesh = (geo, parent, m = bio) => { const o = new THREE.Mesh(geo, m); parent.add(o); return o; };

  /* ── base: montículo de carne con esquirlas de hueso, raíces (haz de tentáculos) y patas-ancla ── */
  { const bp = [];
    bp.push(paint(blobGeo(0.95, 0.3, 0.95, 18, 10, (p) => { p.y += 0.12 * Math.sin(p.x * 5) * Math.sin(p.z * 4); }), FLESH, 0, 0, (p, n) => ({ k: 0.7 + 0.5 * Math.max(0, n.y), g: 0.0 })));
    const it = []; for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.55 + (i % 3) * 0.12; it.push({ p: new V3(Math.cos(a) * r, 0.18, Math.sin(a) * r), d: new V3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), r: 0.07, h: 0.3 + (i % 3) * 0.12 }); }
    bp.push(spikes(it, { sides: 5, color: BONE, cls: 2, curve: 0.1 }));
    mesh(merge(bp), body); }
  const nr = LOW ? 4 : 6, rootSpecs = [];
  for (let i = 0; i < nr; i++) { const a = (i / nr) * Math.PI * 2 + 0.4; rootSpecs.push({ p: new V3(Math.cos(a) * 0.55, 0.14, Math.sin(a) * 0.55), d: new V3(Math.cos(a), -0.12, Math.sin(a)), sag: new V3(0, -0.45, 0), len: 1.6 + (i % 2) * 0.3, r0: 0.17, r1: 0.025, c: FLESH, ph: i * 1.7 }); }
  const rootsM = mesh(tentacleBundle(rootSpecs, { seg: LOW ? 8 : 14, radial: LOW ? 5 : 7, color: FLESH, tipColor: 0x4a5a66 }), body, bioT); const rootRig = tentacleRig(bioT);
  const legs = [];
  if (!LOW) {
    const lg = legGeometry({ upper: 0.85, lower: 1.0, rUp: [0.14, 0.18, 0.12, 0.08], rLo: [0.08, 0.1, 0.065, 0.04], radial: 7, seg: 7, pal: { flesh: FLESH, chit: CHIT, bone: BONE } });
    for (let i = 0; i < 2; i++) {
      const a = (i / 2) * Math.PI * 2 + 2.7, side = Math.sin(a) > 0 ? 1 : -1;
      const l = ikLeg(bio, side > 0 ? lg.uR : lg.uL, bio, side > 0 ? lg.lR : lg.lL, { upper: 0.85, lower: 1.0 });
      l.object.position.set(Math.sin(a) * 0.5, 0.85, Math.cos(a) * 0.5); l.object.rotation.y = 0; l.setBend(new V3(Math.sin(a) * 0.8, 1, Math.cos(a) * 0.8)); body.add(l.object);
      legs.push({ l, foot: new V3(Math.sin(a) * 1.15, -0.8, Math.cos(a) * 1.15), ph: i * 2.1, a });
    }
  }

  /* ── tallo: vértebras de carne con costillas, placas dorsales y cristales ── */
  const NS = LOW ? 4 : 5, segs = [], segLen = 0.5, SR = [0.62, 0.54, 0.47, 0.4, 0.34];
  let parent = body;
  for (let i = 0; i < NS; i++) {
    const g = new THREE.Group(); g.position.y = i === 0 ? 0.28 : segLen; parent.add(g); const Ri = SR[i], parts = [];
    const colProf = prof([[0, 0.86], [0.25, 1.0], [0.55, 0.82], [0.85, 0.95], [1, 0.8]]);
    const col = loft(line([0, -0.02, 0], [0, 0.62, 0]), { seg: 7, radial: R, r: (t) => colProf(t) * Ri, ry: () => 1.0 });
    parts.push(paint(col, FLESH, 0, 0, (p, n, uv) => ({ c: n.z > 0.2 ? FLESH2 : FLESH, k: 0.75 + 0.35 * Math.sin(uv[1] * 3.1), g: 0.0 })));
    // costillas: arcos de hueso que rodean el tallo por delante y los lados
    for (let k = 0; k < (LOW ? 1 : 2); k++) {
      const yk = 0.18 + 0.3 * k, pts = []; for (let s = 0; s <= 8; s++) { const f = s / 8, ph = -2.1 + f * 4.2; pts.push(new V3(Math.sin(ph) * (Ri + 0.05), yk - 0.1 * Math.pow(ph / 2.1, 2) + 0.03 * Math.sin(f * 6 + i), Math.cos(ph) * (Ri + 0.05))); }
      parts.push(paint(loft(pts, { seg: 14, radial: 5, r: (t) => 0.05 * (0.3 + Math.sin(t * Math.PI) * 0.9), ry: () => 0.8, round: [0.1, 0.1] }), BONE, 2, 0.0, (p, n, uv) => ({ g: 0.1 })));
    }
    // faldón óseo festoneado en la base de cada vértebra y placa de pecho
    parts.push(paint(loft(line([0, -0.02, 0], [0, 0.16, 0]), { seg: 3, radial: R + 6, r: (t) => Ri * (1.22 - 0.22 * t), mod: (t, a) => 1 + 0.07 * Math.sin(a * 7 + i) * (1 - t) }), BONE, 2, 0, (p, n, uv) => ({ g: 0.5 * (1 - uv[1]) })));
    const cp = domePlate(Ri * 0.38, 0.2, 0.09, { ridge: 0.8, thick: 0.02, nu: 5, nv: 5 }); parts.push(paint(aimY(cp, new V3(0, 0.34, Ri * 0.97), new V3(0, 0.1, 1)), BONE, 2, 0, () => ({ k: 1.0 })));
    // placa dorsal de quitina + espina con cristal
    const dp = domePlate(Ri * 0.45, 0.25, 0.11, { ridge: 0.7, thick: 0.025, nu: 6, nv: 6 });
    parts.push(paint(aimY(dp, new V3(0, 0.31, -Ri * 0.93), new V3(0, 0.2, -1)), CHIT, 1, 0, (p, n, uv) => ({ k: 0.8 + 0.6 * Math.max(0, n.y), g: sstep(0.8, 1, Math.max(Math.abs(uv[0] * 2 - 1), Math.abs(uv[1] * 2 - 1))) * 0.6 })));
    parts.push(crystals([{ p: new V3(0, 0.36, -Ri * 1.0), d: new V3(0, 0.75, -1), r: 0.055, h: 0.3 - i * 0.03, c: CRY }, ...(LOW ? [] : [{ p: new V3(Ri * 0.6, 0.3, -Ri * 0.7), d: new V3(0.9, 0.6, -0.6), r: 0.04, h: 0.22 - i * 0.02, c: CRY }, { p: new V3(-Ri * 0.6, 0.3, -Ri * 0.7), d: new V3(-0.9, 0.6, -0.6), r: 0.04, h: 0.22 - i * 0.02, c: CRY }])], { sides: 5 }));
    mesh(merge(parts), g); segs.push(g); parent = g;
  }
  /* ── cabeza: flor-ojo ── */
  const head = new THREE.Group(); head.position.y = segLen * 0.95; segs[NS - 1].add(head);
  { const hp = [];
    hp.push(paint(blobGeo(0.52, 0.38, 0.5, 16, 10), FLESH, 0, 0, (p, n) => ({ k: 0.75 + 0.35 * n.y })));
    hp[0] = place(hp[0], [0, 0.08, -0.1]);
    hp.push(crystals([-2, -1, 0, 1, 2].slice(0, LOW ? 3 : 5).map((a, i, arr) => { const ang = (a / 2) * 0.9; return { p: new V3(Math.sin(ang) * 0.34, 0.56 + Math.cos(ang) * 0.2, -0.22), d: new V3(-Math.sin(ang) * 0.9, 0.9, -0.5), r: 0.065, h: 0.5 + (i % 2) * 0.12, c: CRY }; }), { sides: 6 }));
    mesh(merge(hp), head); }
  const eyeRoot = new THREE.Group(); eyeRoot.position.set(0, 0.34, 0.12); head.add(eyeRoot);
  const RE = 0.6;
  const E = bigEye({ r: RE, iris: 0x18c8ff, quality: level, lidColor: 0x3a2a40, scleraColor: 0x59626a, irisR: 0.5 }); eyeRoot.add(E.object);
  const lensPt = new THREE.Object3D(); lensPt.position.z = RE * 1.1; E.ball.add(lensPt);
  // pétalos-garra de quitina (se abren al apuntar): 1 solo InstancedMesh
  const NP = LOW ? 5 : HI ? 8 : 7, petals = [];
  const petalGeo = (() => { const pts = [new V3(0, 0, 0), new V3(0, 0.45, 0.05), new V3(0, 0.85, 0.2), new V3(0, 1.12, 0.42)];
    const g = loft(pts, { seg: 10, radial: 6, r: (t) => lerp(0.11, 0.008, Math.pow(t, 0.8)) * (1 + 0.15 * Math.sin(t * 20)), ry: () => 2.6, round: [0.05, 0] });
    return merge([paint(g, CHIT, 1, 0, (p, n, uv) => ({ c: new THREE.Color(CHIT).lerp(new THREE.Color(CRY), sstep(0.7, 1, uv[1])), cls: 1 + 2 * sstep(0.78, 0.92, uv[1]), k: 0.8 + 0.7 * uv[1], g: sstep(0.5, 1, uv[1]) * 0.6 }))]); })();
  const petalIM = new THREE.InstancedMesh(petalGeo, bio, NP); petalIM.frustumCulled = false; petalIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const petalRing = new THREE.Group(); petalRing.position.copy(eyeRoot.position); petalRing.position.z -= 0.06; head.add(petalRing); petalRing.add(petalIM);
  for (let i = 0; i < NP; i++) { const h1 = new THREE.Object3D(); h1.rotation.z = (i / NP) * Math.PI * 2; const h2 = new THREE.Object3D(); h2.position.y = 0.56; petals.push({ h1, h2, i, off: (i * 2.4) % 6.28 }); }
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), mS = new THREE.Matrix4();
  const updatePetals = (stretch) => { for (const P of petals) { P.h1.updateMatrix(); P.h2.updateMatrix(); mA.multiplyMatrices(P.h1.matrix, P.h2.matrix); mS.makeScale(0.9, stretch, 1.0); mB.multiplyMatrices(mA, mS); petalIM.setMatrixAt(P.i, mB); } petalIM.instanceMatrix.needsUpdate = true; };
  const glowM = new THREE.SpriteMaterial({ map: softDot(), color: 0xffc060, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), halo = new THREE.Sprite(glowM); eyeRoot.add(halo);
  const coreM = glowMat(0xffffff, 0.0), core = glowSphere(coreM, RE * 0.2); core.position.z = RE * 1.03; E.ball.add(core);
  // antenas sensoras
  const feelSpecs = [-1, 1].map((s) => ({ p: new V3(s * 0.36, 0.1, 0.0), d: new V3(s * 0.7, -0.5, 0.35), sag: new V3(0, -0.3, 0), len: 1.1, r0: 0.07, r1: 0.012, c: FLESH, ph: s * 2 }));
  let feelRig = null; if (!LOW) { const m = bioMaterial({ glow: 0x2de0ff, vein: 0x0a1020, tent: 2, breath: 0 }); mesh(tentacleBundle(feelSpecs, { seg: 12, radial: 6, color: FLESH, tipColor: 0x40e0ff, tipGlow: 1 }), head, m); feelRig = { rig: tentacleRig(m), mat: m }; }

  /* ── cola de escorpión con aguijón de biocristal ── */
  const NT = LOW ? 4 : 5, tail = [], CURL = [-0.95, 0.5, 0.45, 0.42, 0.38], tl = 0.46;
  const tailRoot = new THREE.Group(); tailRoot.position.set(0, 0.4, -0.62); body.add(tailRoot);
  let tp = tailRoot, stingGlow;
  for (let i = 0; i < NT; i++) {
    const g = new THREE.Group(); g.position.y = i === 0 ? 0 : tl; tp.add(g); const r = 0.21 - i * 0.025, parts = [];
    parts.push(paint(loft(line([0, -0.04, 0], [0, tl * 1.08, 0]), { seg: 5, radial: R - 2, r: (t) => r * (0.85 + 0.2 * Math.sin(t * Math.PI)), round: [0.1, 0.1] }), FLESH, 0, 0, (p, n) => ({ k: 0.8 + 0.3 * n.y })));
    const pl = domePlate(r * 0.7, tl * 0.4, r * 0.5, { ridge: 0.6, thick: 0.02, nu: 6, nv: 5 });
    parts.push(paint(aimY(pl, new V3(0, tl * 0.5, -r * 0.8), new V3(0, 0.15, -1)), CHIT, 1, 0, (p, n, uv) => ({ k: 0.8 + 0.5 * Math.max(0, p.y * 3), g: 0.3 * sstep(0.75, 1, uv[1]) })));
    if (i === NT - 1) {
      parts.push(spikes([{ p: new V3(0, tl * 0.4, 0), d: new V3(0, 1, 0.1), r: 0.1, h: 0.55 }], { sides: 6, color: BONE, cls: 2, curve: 0.5 }));
      parts.push(crystals([{ p: new V3(0, tl * 0.4 + 0.3, 0.07), d: new V3(0, 1, 0.5), r: 0.075, h: 0.5, c: CRY, glow: 1.4 }, { p: new V3(0, tl * 0.5, 0.06), d: new V3(0, 0.3, 1), r: 0.04, h: 0.2, c: CRY }], { sides: 5 }));
    }
    mesh(merge(parts), g); tail.push(g); tp = g;
  }
  stingGlow = glowSphere(glowMat(color, 0.0), 0.2); stingGlow.position.y = tl * 1.0 + 0.45; tp.add(stingGlow);

  /* ── láser ── */
  const beamM = glowMat(0xff3040, 0.0), beam = beamMesh(beamM); root.add(beam);
  const coreBeamM = glowMat(0xffffff, 0.0), coreBeam = beamMesh(coreBeamM); root.add(coreBeam);

  const mats = [bio, bioT, ...E.mats]; if (feelRig) mats.push(feelRig.mat);
  const sYaw = new Spring(0, 40, 7), sPit = new Spring(0, 40, 7), sRec = new Spring(0, 160, 9), sTail = new Spring(0, 70, 6), sHit = new Spring(0, 120, 7);
  let ct = -1, wasCharge = false, open = 0, heat = 0, prevHp = 1, hit = 0, shotFlash = 0, lockedAim = null, lockAmt = 0;
  const aimW = new V3(), aimL = new V3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), pa = new V3(), up = new V3(), cc = new THREE.Color(), cA = new THREE.Color(0x40e8ff), cB = new THREE.Color(0xe8fbff), cR = new THREE.Color(0xff2a3a);
  const irisA = new THREE.Color(0x18c8ff), irisR = new THREE.Color(0xff5030), look0 = new V3(0, 0.1, 1), Zv = new V3(0, 0, 1), bendDown = new V3(0, -1, 0);

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0, 0.05);
    const hp = st.hp == null ? 1 : st.hp, hurtLow = clamp((0.35 - hp) / 0.35, 0, 1), id = st.id || 0;
    const charging = st.s === 'charge';
    if (charging && !wasCharge) { ct = 0; lockedAim = null; }
    if (!charging && wasCharge) { shotFlash = 1; sRec.v -= 9; sTail.v += 6; ct = -1; }
    wasCharge = charging; if (charging) ct += dt;
    if (hp < prevHp - 0.001) { hit = 1; sHit.v += 7; } prevHp = hp; hit = Math.max(0, hit - dt * 3); shotFlash = Math.max(0, shotFlash - dt * 3);
    const e = charging ? ct : 0, k = charging ? clamp(e / 1.6, 0, 1) : 0, locked = charging && e > 1.2;
    const look = ctx.look || look0;
    // dirección de apuntado (en espacio local de root); mientras carga usa st.a (fija al final)
    root.updateWorldMatrix(true, false); root.getWorldQuaternion(qa); qa.invert();
    if (charging && st.a) { aimW.set(st.a[0] ?? st.a.x, st.a[1] ?? st.a.y, st.a[2] ?? st.a.z); aimL.copy(aimW).applyQuaternion(qa).normalize(); } else aimL.copy(look).normalize();
    if (locked) { if (!lockedAim) lockedAim = aimL.clone(); aimL.copy(lockedAim); }
    lockAmt = damp(lockAmt, locked ? 1 : 0, 14, dt);

    const breath = Math.sin(t * 1.9 + id) * 0.5 + 0.5, tremble = (hurtLow * 0.012 + k * 0.01 + hit * 0.02);
    open = damp(open, charging ? 1 : 0, charging ? 3.5 : 4, dt); heat = damp(heat, k, 6, dt);
    const yaw = Math.atan2(aimL.x, Math.max(0.15, aimL.z)), pit = Math.asin(clamp(aimL.y, -1, 1));
    const sy = sYaw.step(dt, clamp(yaw, -1.2, 1.2)), sp = sPit.step(dt, clamp(-pit, -0.6, 0.6)), rec = sRec.step(dt, 0), hv = sHit.step(dt, 0);
    for (let i = 0; i < NS; i++) {
      const s = segs[i], w = 1 - i * 0.12;
      s.rotation.y = sy * 0.25 * w + Math.sin(t * 0.7 + i) * 0.03; s.rotation.x = sp * 0.22 * w * (0.5 + 0.5 * (1 - open)) + (k * -0.07 + rec * 0.18 + hv * 0.12) + Math.sin(t * 1.3 + i * 0.8 + id) * 0.025 + (hurtLow ? Math.sin(t * 9 + i) * 0.03 * hurtLow : 0);
      s.rotation.z = Math.sin(t * 0.9 + i * 0.9 + id) * 0.025 + Math.sin(t * 31 + i) * tremble;
      s.scale.set(1 + (breath - 0.5) * 0.04, 1 + (breath - 0.5) * 0.03, 1 + (breath - 0.5) * 0.04);
    }
    head.rotation.x = 0.05 + hurtLow * 0.35 + rec * 0.3 - k * 0.08; head.position.y = segLen * 0.95 + Math.sin(t * 1.9 + id) * 0.012;
    root.updateWorldMatrix(true, true);
    eyeRoot.getWorldQuaternion(qb); root.getWorldQuaternion(qa); qb.premultiply(qa.clone().invert()).invert();
    up.copy(aimL).applyQuaternion(qb).normalize();
    const squint = locked ? 0.7 : charging ? 1.1 : 1;
    E.update(dt, up, { open: clamp((0.62 + 0.18 * Math.sin(t * 0.8 + id)) * squint * (1 - hit * 0.5) * (1 - hurtLow * 0.2) + k * 0.15, 0, 1), pupil: lerp(0.55, 0.16, heat) * (1 - hit * 0.1) + 0.08 * Math.sin(t * 2.3 + id), glow: 0.35 + heat * 0.9 + shotFlash * 1.2, hurt: U.uHurt.value, shake: hurtLow * 0.1 + k * 0.03, blinkRate: charging ? 0.2 : 1 + hurtLow, brow: 0.22 + heat * 0.3 });
    E.iris.userData.u.uIris.value.copy(irisA).lerp(irisR, lockAmt * 0.8 + hurtLow * 0.3);

    // pétalos: respiran, se abren al cargar, se cierran al ser herido
    for (const P of petals) { P.h2.rotation.x = lerp(1.05 - 0.15 * Math.sin(t * 1.9 + P.off), 0.12, open) + hit * 0.3 + Math.sin(t * 2.7 + P.off) * 0.04 + rec * 0.4; }
    updatePetals(0.95 * (1 + open * 0.15));
    cc.copy(cA).lerp(cB, heat); if (lockAmt > 0.01) cc.lerp(cR, lockAmt * 0.5);
    glowM.color.copy(cc); glowM.opacity = (heat * 0.4 + shotFlash * 0.8) * (0.75 + 0.25 * Math.sin(t * (14 + heat * 40)));
    halo.scale.setScalar(RE * (2.2 + heat * 1.0 + shotFlash * 2.0));
    coreM.opacity = clamp(heat * 1.0 + shotFlash, 0, 1); core.scale.setScalar(RE * (0.05 + heat * 0.15 + shotFlash * 0.25) * (1 + 0.12 * Math.sin(t * 30)));
    // cola: se alza y apunta el aguijón al blanco
    const tw = sTail.step(dt, 0);
    tailRoot.rotation.y = sy * 0.5 * (0.4 + k) + Math.sin(t * 0.9 + id) * 0.12;
    for (let i = 0; i < NT; i++) { const g = tail[i], curl = CURL[i] + (i === 0 ? k * 0.12 : k * 0.06);
      g.rotation.x = curl + tw * 0.25 + Math.sin(t * 1.6 + i * 0.7 + id) * 0.07 * (1 + hurtLow * 2);
      g.rotation.z = Math.sin(t * 1.1 + i * 0.5) * 0.05 + (hurtLow ? Math.sin(t * 8 + i) * 0.04 : 0); }
    const sg = stingGlow.material; sg.color.copy(cc); sg.opacity = clamp(heat * 0.6 + shotFlash, 0, 1) * (0.7 + 0.3 * Math.sin(t * 25)); stingGlow.scale.setScalar(0.14 + heat * 0.22 + shotFlash * 0.2);
    // materiales: venas y cristales laten; todo se enciende al cargar
    U.uCry.value = 0.8 + heat * 1.6 + shotFlash * 2 + 0.25 * Math.sin(t * 5) + (1 - hp) * 0.4; U.uVeinGlow.value = 0.3 + heat * 0.9 + shotFlash * 0.8 + 0.1 * Math.sin(t * 3 + id); U.uCrackGlow.value = 0.2 + heat * 1.0; U.uGlow.value = heat * 0.5 + shotFlash * 0.6; U.uPulse.value = heat * 0.5 + hurtLow * 0.3;
    UT.uVeinGlow.value = U.uVeinGlow.value; UT.uHurt.value = U.uHurt.value;
    // raíces / patas: ancladas, agarran con fuerza al cargar y se crispan al daño
    for (let i = 0; i < nr; i++) rootRig.set(i, 0.07 + hit * 0.3 + hurtLow * 0.12 + k * 0.03, 1.1 + hurtLow * 3 + i * 0.1, bendDown, 0.1 + k * 0.25 + hit * 0.1, 1);
    for (const L of legs) { pa.copy(L.foot); pa.y += hit * 0.18 * Math.sin(L.ph * 2); pa.x *= 1 + k * 0.04 + rec * 0.05; pa.z *= 1 + k * 0.04; L.l.setFoot(pa); }
    if (feelRig) { for (let i = 0; i < 2; i++) feelRig.rig.set(i, 0.2 + hit * 0.4 + k * 0.1, 2.0, null, 0, 1); feelRig.mat.userData.u.uVeinGlow.value = U.uVeinGlow.value; }

    // láser: sale de la lente, traza el blanco; se fija y engrosa al final
    root.updateWorldMatrix(true, true);
    const on = charging && e > 0.12;
    if (on) {
      lensPt.getWorldPosition(pa); root.worldToLocal(pa);
      beam.position.copy(pa); coreBeam.position.copy(pa); beam.quaternion.setFromUnitVectors(Zv, aimL); coreBeam.quaternion.copy(beam.quaternion);
      const L = 70 / 0.78, flick = locked ? 1 : 0.55 + 0.45 * Math.sin(t * 60), w = locked ? 0.03 + Math.min(0.03, (e - 1.2) * 0.1) : 0.008 + k * 0.01;
      beam.scale.set(w * (locked ? 2.6 : 1.6), w * (locked ? 2.6 : 1.6), L); coreBeam.scale.set(w * 0.8, w * 0.8, L);
      beamM.color.copy(cA).lerp(cR, clamp(k * 1.2, 0, 1)); beamM.opacity = (locked ? 0.7 : 0.22 + k * 0.2) * flick; coreBeamM.opacity = locked ? 0.95 : 0.3 * flick;
      beam.visible = coreBeam.visible = true;
    } else beam.visible = coreBeam.visible = false;
  } };
}
