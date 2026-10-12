// MADRE GEODA (jefe M2) — flor / útero colosal. Pétalos de quitina verde-negra con costillas y venas luminosas que se cierran como capullo blindado
// ('fire': dispara espirales; las puntas relampaguean girando al ritmo de los disparos) y se abren como una flor ('open': vulnerable) revelando un
// núcleo de carne húmeda con un ojo grande, una boca y sacos translúcidos con embriones. Pétalos internos carnosos, raíces, esporas.
// 'vent' = las dos VÁLVULAS están siendo mantenidas: sale vapor por las grietas, el capullo tiembla y se abre a medias.
// st.pr (0..1) = PRESIÓN: el capullo se hincha y brilla, las venas laten más rápido.
// 'gestate' (~3 s) = pone SACOS DE HUEVOS: el núcleo/abdomen se contrae en espasmos y expulsa nubes de larvas hacia las paredes.
// Fases por hp: más espinas, grietas ardiendo, pétalos rotos y más rabia.
import * as THREE from 'three';
import { cfg } from '../quality.js';
import { bioMaterial } from './obelisco-mat.js';
import { bigEye, mawBio, softDot, clamp, lerp, damp, rnd } from './obelisco-lib.js';
import { V3, paint, place, aimY, merge, loft, line, prof, patch, blobGeo, spikes, crystals, crystalGeo, tentacleBundle, tentacleRig, sstep } from './obelisco-geo.js';
import { particleBank } from './coloso-fx.js';
import { makeFacer } from './boss-face.js';

const TAU = Math.PI * 2;

export default function build(kit, color) {
  const { Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const R = LOW ? 8 : HI ? 16 : 12;
  const SHELL = 0x0e2a1c, FLESH = 0x7a1c34, FLESH2 = 0x9a2c44, LIME = color, BONE = 0xa8b890;
  const bio = bioMaterial({ glow: 0x9dff5a, vein: 0x061a10, rim: 0x2a8a50, scale: 0.9, bump: 1.0, wet: 0.6, ridge: 60, sheen: 0.12, metal: 0.12, breath: 0.012 }); const U = bio.userData.u; U.uVeinGlow.value = 0.2; U.uCrackGlow.value = 0.25;
  const bioF = bioMaterial({ glow: 0xc8ff70, vein: 0x300612, rim: 0xa03050, scale: 2.0, bump: 0.7, wet: 0.9, sheen: 0.25, breath: 0.02 }); const UF = bioF.userData.u; UF.uVeinGlow.value = 0.4;
  const bioM = bioMaterial({ glow: 0xc8ff70, vein: 0x401020, rim: 0xe08090, scale: 1.4, bump: 0.3, wet: 1.0, alpha: 0.5, depthWrite: false, double: true, fres: 1.6, breath: 0.03, sheen: 0 }); const UM = bioM.userData.u; UM.uVeinGlow.value = 0.5;
  const NT = LOW ? 5 : 9;
  const bioT = bioMaterial({ glow: 0x9dff5a, vein: 0x061a10, rim: 0x2a8a50, scale: 2.0, tent: NT, breath: 0 }); const UT = bioT.userData.u; UT.uVeinGlow.value = 0.15;

  const root = new THREE.Group(), rig = new THREE.Group(), body = new THREE.Group(); root.add(rig); rig.add(body); rig.scale.setScalar(1.5); // jefe: escala imponente
  const mesh = (g, parent = body, m = bio) => { const o = new THREE.Mesh(g, m); parent.add(o); return o; };

  /* ── núcleo: útero de carne, abdomen, ojo, boca, sacos con embriones ── */
  const coreM = mesh(paint(blobGeo(0.5, 0.5, 0.52, LOW ? 14 : 24, LOW ? 10 : 18, (p, n) => { p.addScaledVector(n, 0.02 * Math.sin(p.x * 11) * Math.sin(p.y * 9)); }), FLESH2, 0, 0.0, (p, n) => ({ k: 0.8 + 0.4 * Math.max(0, n.z), g: 0.2 })), body, bioF); coreM.position.z = -0.05;
  const backG = new THREE.Group(); backG.position.z = -0.45; body.add(backG);
  { const bp = [];
    bp.push(paint(blobGeo(0.46, 0.46, 0.62, LOW ? 12 : 22, LOW ? 8 : 14), FLESH, 0, 0, (p, n) => ({ k: 0.7 + 0.4 * Math.max(0, n.y), g: 0.15 })));
    // costillas de hueso sobre el abdomen
    for (let i = 0; i < (LOW ? 4 : 6); i++) { const z = -0.45 + i * 0.18, pts = []; for (let j = 0; j <= 10; j++) { const a = (j / 10) * Math.PI * 2; pts.push(new V3(Math.cos(a) * (0.42 * Math.sqrt(Math.max(0.02, 1 - (z / 0.62) ** 2)) + 0.03), Math.sin(a) * (0.42 * Math.sqrt(Math.max(0.02, 1 - (z / 0.62) ** 2)) + 0.03), z)); }
      bp.push(paint(loft(pts, { seg: 18, radial: 4, r: () => 0.02, round: [0, 0] }), BONE, 2, 0, () => ({ k: 0.9 }))); }
    mesh(merge(bp), backG, bioF); }
  const eyeRoot = new THREE.Group(); eyeRoot.position.set(0, 0.04, 0.42); eyeRoot.scale.setScalar(1.3); body.add(eyeRoot);
  const BE = bigEye({ r: 0.26, iris: 0xb8ff40, quality: level, lidColor: 0x6a1c30, scleraColor: 0x8a7a60, irisR: 0.5, brow: 0.15 }); eyeRoot.add(BE.object);
  const mouth = mawBio(bioF, { w: 0.26, len: 0.24, teeth: LOW ? 5 : 9, tooth: 0.09, flesh: FLESH, shell: 0, gum: 0xa02848, gumGlow: 0.5 }); mouth.object.position.set(0, -0.3, 0.34); mouth.object.rotation.x = 0.5; body.add(mouth.object);
  const NS = LOW ? 4 : 5, sacs = [];
  const sacIM = new THREE.InstancedMesh(paint(blobGeo(1, 1, 1, 14, 10), 0xe8a0a8, 4, 0.0), bioM, NS), embIM = new THREE.InstancedMesh(paint(blobGeo(1, 1, 1, 10, 8), 0x40a020, 0, 1.0), bio, NS);
  for (const o of [sacIM, embIM]) { o.frustumCulled = false; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); body.add(o); }
  for (let i = 0; i < NS; i++) sacs.push({ a: (i / NS) * TAU + 0.3, ph: i * 1.7 });

  /* ── pétalos exteriores (quitina), interiores (carne), espinas y puntas: InstancedMesh ── */
  // pétalo exterior: concha ACOPADA (borde curvado hacia dentro), nervio central en relieve, lomo de quitina verde-negra y cara interior de carne rosada
  const outerG = (() => { const L = 1.45, W = 1.15;
    const g = patch((u, v) => { const w = W * Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * v)), 0.75) * (0.55 + 0.45 * Math.sin(v * 2.4 + 0.3)), x = (u - 0.5) * 2 * w, y = v * L, xr = x / Math.max(w, 0.01),
        z = 0.55 * v * v * 0.5 + (0.3 * xr * xr) * Math.min(1, v * 2.4) - 0.07 * Math.exp(-Math.pow(xr * 4.5, 2)) * Math.min(1, v * 3) - 0.04 * Math.sin(v * 22) * (1 - Math.abs(2 * u - 1)); return new V3(x, y, z); }, LOW ? 8 : 12, LOW ? 8 : 14, { thick: 0.07, inner: true });
    return paint(g, SHELL, 1, 0, (p, n, uv) => { const mid = Math.exp(-Math.pow((uv[0] - 0.5) * 7, 2)), edge = sstep(0.78, 1, Math.abs(uv[0] * 2 - 1)), inside = n.z > 0.05;
      if (inside) return { cls: 0, c: new THREE.Color(0x2e0614).lerp(new THREE.Color(0x8a1a38), Math.min(1, uv[1] * 1.6)).lerp(new THREE.Color(0xc02a50), sstep(0.6, 1, uv[1]) * 0.8), k: 0.7 + 0.3 * uv[1] + 0.2 * mid, g: 0.1 + 0.45 * uv[1] };
      return { cls: 1, c: new THREE.Color(SHELL).lerp(new THREE.Color(0x1c5a34), 0.35 * uv[1] + 0.5 * edge + 0.3 * mid), k: 0.65 + 0.8 * uv[1] + 0.4 * mid, g: (mid * 0.7 + edge * 0.7) * (0.45 + 0.55 * uv[1]) }; }); })();
  const innerG = (() => { const L = 0.85, W = 0.34;
    const g = patch((u, v) => { const w = W * Math.pow(Math.sin(Math.PI * (0.12 + 0.88 * v)), 0.8), x = (u - 0.5) * 2 * w, y = v * L, z = 0.35 * v * v + 0.06 * Math.pow(x / Math.max(w, 0.01), 2); return new V3(x, y, z); }, 6, 9, { thick: 0.04, inner: true });
    return paint(g, FLESH2, 0, 0, (p, n, uv) => ({ c: new THREE.Color(FLESH).lerp(new THREE.Color(0xd04a5a), uv[1]), k: 0.8 + 0.5 * uv[1], g: 0.3 * uv[1] })); })();
  const spkG = crystalGeo(new V3(0, 0, 0), new V3(0, 1, 0), 0.5, 1, LIME, { sides: 5, glow: 1, tip: 0.5 });
  const NP = LOW ? 6 : 8, NI = LOW ? 4 : 6;
  const outerIM = new THREE.InstancedMesh(outerG, bio, NP), innerIM = new THREE.InstancedMesh(innerG, bioF, Math.max(1, NI)), spkIM = new THREE.InstancedMesh(spkG, bio, NP * 3 + NI);
  for (const o of [outerIM, innerIM, spkIM]) { o.frustumCulled = false; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); body.add(o); } innerIM.count = NI; spkIM.count = NP * 3 + NI;
  const petals = [], inner = [];
  for (let i = 0; i < NP; i++) { const h = new THREE.Object3D(); h.position.z = -0.38; h.rotation.z = (i / NP) * TAU + (i % 2) * 0.03; const p = new THREE.Object3D(); p.position.y = 0.26; petals.push({ h, p, big: i % 2 === 0, i, off: (rnd() - 0.5) * 0.25 }); }
  for (let i = 0; i < NI; i++) { const h = new THREE.Object3D(); h.position.z = -0.3; h.rotation.z = ((i + 0.5) / NI) * TAU; const p = new THREE.Object3D(); p.position.y = 0.2; inner.push({ h, p, i }); }
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), mC = new THREE.Matrix4(), qq = new THREE.Quaternion(), vv = new THREE.Vector3(), ss = new THREE.Vector3(), eul = new THREE.Euler();
  const compose = (x, y, z, rx, sx, sy, sz) => { qq.setFromEuler(eul.set(rx, 0, 0)); return mC.compose(vv.set(x, y, z), qq, ss.set(sx, sy, sz)); };

  /* ── raíces/tentáculos atrás y espinas que brotan por fases ── */
  const tspecs = [];
  for (let i = 0; i < NT; i++) { const a = (i / NT) * TAU + 0.2, len = 2.4 + (i % 3) * 0.5; tspecs.push({ p: new V3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.85), d: new V3(Math.cos(a) * 0.6, Math.sin(a) * 0.6, -1), sag: new V3(0, -0.1, 0), len, r0: 0.18 - (i % 3) * 0.02, r1: 0.02, c: 0x0e2a1c, ph: i * 2.1 }); }
  mesh(tentacleBundle(tspecs, { seg: LOW ? 10 : 18, radial: LOW ? 5 : 8, color: 0x143a24, tipColor: 0x40a060 }), body, bioT); const trig = tentacleRig(bioT);
  const mkCluster = (items, sides = 5) => { const g = new THREE.Group(); mesh(crystals(items, { sides }), g); g.scale.setScalar(0.001); body.add(g); return g; };
  const c2 = [], c3 = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c2.push({ p: new V3(Math.cos(a) * 0.45, Math.sin(a) * 0.45, -0.7), d: new V3(Math.cos(a), Math.sin(a), -0.5), r: 0.08, h: 0.5 + (i % 3) * 0.16, c: LIME }); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; c3.push({ p: new V3(Math.cos(a) * 0.55, Math.sin(a) * 0.55, -0.3), d: new V3(Math.cos(a), Math.sin(a), -0.8), r: 0.11, h: 0.85 + (i % 2) * 0.3, c: 0xd8ff50 }); }
  const cl2 = mkCluster(c2), cl3 = mkCluster(c3, 6);

  /* ── luces de disparo, vapor, esporas y larvas ── */
  const mkSprite = (c, s, o) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(s); return sp; };
  const NA = 6, armP = new Float32Array(NA * 3), armC = new Float32Array(NA * 3), armG = new THREE.BufferGeometry(); armG.setAttribute('position', new THREE.BufferAttribute(armP, 3)); armG.setAttribute('color', new THREE.BufferAttribute(armC, 3));
  const armPts = new THREE.Points(armG, new THREE.PointsMaterial({ size: 0.55, map: softDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); armPts.frustumCulled = false; body.add(armPts);
  const inGlow = mkSprite(0xff7a90, 2.0, 0); inGlow.position.z = 0.15; body.add(inGlow);
  const halo = mkSprite(color, 4.6, 0.1); rig.add(halo);
  const steam = particleBank(rig, LOW ? 14 : 40, { size: 0.55, additive: true, color: 0xcfffe0 }), larvae = particleBank(rig, LOW ? 12 : 32, { size: 0.2, additive: true, color: 0xe8ff90 });
  const NSP = LOW ? 16 : 44, pp = new Float32Array(NSP * 3), pc = new Float32Array(NSP * 3), pd = []; for (let i = 0; i < NSP; i++) pd.push({ a: rnd() * 6.28, r: 0.7 + rnd() * 1.1, y: rnd() * 2 - 1, s: 0.1 + rnd() * 0.25, h: rnd(), v: rnd() });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const spores = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.1, map: softDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); spores.frustumCulled = false; rig.add(spores);

  const mats = [bio, bioF, bioM, bioT, ...BE.mats];
  const sOp = new Spring(0, 120, 11), sHit = new Spring(0, 150, 8), sKick = new Spring(0, 80, 7);
  let op = 0, p2 = 0, p3 = 0, prevS = '', prevHp = 1, hit = 0, prevPh = 1, flashT = 0, shock = 0, birth = 0, fireT = 0, gesT = 0, ventAcc = 0, larvAcc = 0, spasmPrev = 0, prSm = 0;
  const colA = new THREE.Color(color), colHot = new THREE.Color(0xff4a60), dc = new THREE.Color();
  const look0 = new V3(0, 0, 1), P = new V3(), tmpV = new V3(), velV = new V3(), lookR = new V3(), eulS = new THREE.Euler(), qS = new THREE.Quaternion(), F = makeFacer({ rate: 2.2 });
  const sstp = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0, 0.05); const id = st.id || 0, hp = st.hp == null ? 1 : st.hp, ph = hp > 0.66 ? 1 : hp > 0.33 ? 2 : 3, look = ctx.look || look0, sn = st.s;
    const vent = sn === 'vent', gest = sn === 'gestate', isOpen = sn === 'open' || !!st.o, pr = clamp(st.pr || 0, 0, 1);
    if (ph !== prevPh) { flashT = 1; sKick.v += 4; prevPh = ph; }
    if (hp < prevHp - 0.0005) { hit = Math.min(1, hit + 0.5); sHit.v += 2; } prevHp = hp; hit = Math.max(0, hit - dt * 4); flashT = Math.max(0, flashT - dt * 1.2); shock = Math.max(0, shock - dt * 2.5);
    if (isOpen && prevS !== 'o') { sKick.v += 3; birth = 0; } if (!isOpen && prevS === 'o') { shock = 1; sKick.v -= 4; fireT = 0; } prevS = isOpen ? 'o' : 'c';
    if (gest) gesT += dt; else gesT = 0;
    p2 = damp(p2, ph >= 2 ? 1 : 0, 1.4, dt); p3 = damp(p3, ph >= 3 ? 1 : 0, 1.4, dt); const rage = clamp((1 - hp) * 1.25, 0, 1), hurtLow = clamp((0.35 - hp) / 0.35, 0, 1);
    prSm = damp(prSm, pr, 4, dt);
    // apertura: abierta; vent = a medias; gestate = bastante abierta (contrae el abdomen)
    const target = isOpen ? 1 : vent ? 0.38 : gest ? 0.8 : 0;
    op = damp(op, target, target > op ? 4.2 : 8, dt); const opS = op;
    const hk = sHit.step(dt, 0), kick = sKick.step(dt, 0);
    if (!isOpen && !vent && !gest) fireT += dt; if (isOpen) birth += dt;
    const pulseHz = 1.1 + rage + prSm * 5.5, breath = Math.sin(t * pulseHz + id) * 0.5 + 0.5, cyc = [0, 0.22, 0.17, 0.13][ph];
    const spasm = gest ? Math.pow(Math.max(0, Math.sin(gesT * 9.5)), 3) : 0; // contracciones del parto

    /* flotación, temblor y respiración (más hinchada con la presión) */
    const trem = (vent ? 0.02 : 0) + prSm * 0.012 + hurtLow * 0.006;
    rig.position.y = Math.sin(t * 0.5 + id) * 0.04; rig.position.x = Math.sin(t * 47) * trem;
    // la flor gira entera para MIRAR a la cámara en 3D (el motor solo la orienta en horizontal; sin esto el ojo/punto débil queda de canto)
    F.step(dt, look, 1 + (isOpen ? 0.4 : 0)); rig.quaternion.copy(F.q).multiply(qS.setFromEuler(eulS.set(Math.sin(t * 0.37) * 0.03 + Math.sin(t * 53) * trem * 0.5, 0, Math.sin(t * 0.3) * 0.05 + kick * 0.04)));
    lookR.copy(look); F.toRig(lookR);
    const bs = 1 + (breath - 0.5) * (0.03 + prSm * 0.03) + shock * 0.04 - hk * 0.03 + kick * 0.02 + prSm * 0.07 + spasm * 0.03; body.scale.setScalar(bs); body.rotation.z += dt * (0.05 + rage * 0.1) * (isOpen ? 0.2 : 1);

    /* pétalos: onda de apertura, vibración al disparar / con la presión, rotos/colgando con la salud baja */
    const shoot = (isOpen || vent || gest) ? 0 : Math.sin((fireT / cyc) * Math.PI * 2) * 0.5 + 0.5;
    let sIdx = 0;
    petals.forEach((P0) => {
      const delay = P0.i * 0.045, k = sstp(delay, delay + 0.6, opS);
      const closed = 1.8 - (P0.i % 2) * 0.1, open = -0.22 + P0.off * 0.6 + hurtLow * 0.25 * (P0.i % 3 === 0 ? 1 : 0);
      const th = lerp(closed, open, k) + (1 - k) * (shoot * 0.03 + Math.sin(t * 40 + P0.i) * 0.004 * (1 + rage) + prSm * Math.sin(t * 31 + P0.i * 2) * 0.012) + hk * 0.1 * Math.sin(P0.i * 2.3 + t * 30) + (k > 0.05 ? Math.sin(t * 1.3 + P0.i) * 0.04 * k : 0) + (vent ? Math.sin(t * 28 + P0.i * 1.7) * 0.03 : 0) - spasm * 0.12;
      P0.p.rotation.x = th; P0.p.rotation.y = Math.sin(t * 0.9 + P0.i) * 0.03 * k + (hurtLow && P0.i % 3 === 0 ? Math.sin(t * 7 + P0.i) * 0.05 : 0);
      P0.h.updateMatrix(); P0.p.updateMatrix(); mA.multiplyMatrices(P0.h.matrix, P0.p.matrix);
      const L = P0.big ? 1.0 : 0.88, sxw = lerp(1.1, 0.8, k); mB.multiplyMatrices(mA, mC.makeScale(sxw, L, 1.0)); outerIM.setMatrixAt(P0.i, mB);
      // punta de cristal + dos espinas laterales (aparecen en fases)
      mB.multiplyMatrices(mA, compose(0, 1.2 * L * 0.98, 0.24 * L * 0.9, 0.35, 0.12, 0.42 * (1 + p2 * 0.3 + p3 * 0.5 + 0.1 * Math.sin(t * 4 + P0.i)), 0.12)); spkIM.setMatrixAt(P0.i, mB);
      for (let q = 0; q < 2; q++) { const z = Math.max(0.001, p2); mB.multiplyMatrices(mA, compose((q ? 1 : -1) * 0.2, 0.55 * L + q * 0.15, 0.12, 0.5, 0.07 * z, (0.28 + q * 0.06) * z, 0.07 * z)); spkIM.setMatrixAt(NP + P0.i * 2 + q, mB); }
    });
    inner.forEach((I) => { const k = sstp(0.1 + I.i * 0.03, 0.8 + I.i * 0.03, opS); I.p.rotation.x = lerp(1.5, 0.6 + Math.sin(t * 1.2 + I.i) * 0.06 + spasm * 0.2, k); I.h.updateMatrix(); I.p.updateMatrix(); mA.multiplyMatrices(I.h.matrix, I.p.matrix); innerIM.setMatrixAt(I.i, mA); mB.multiplyMatrices(mA, compose(0, 0.82, 0.22, 0.4, 0.08, 0.34, 0.08)); spkIM.setMatrixAt(NP * 3 + I.i, mB); });
    outerIM.instanceMatrix.needsUpdate = innerIM.instanceMatrix.needsUpdate = spkIM.instanceMatrix.needsUpdate = true;

    /* núcleo: ojo, boca, sacos que paren; en 'gestate' se contrae en espasmos */
    const exp = sstp(0.3, 0.9, opS);
    coreM.scale.set(1 + (breath - 0.5) * 0.06 + hk * 0.08 - spasm * 0.12, 1 + (breath - 0.5) * 0.06 - hk * 0.05 - spasm * 0.12, 1 + spasm * 0.08); backG.scale.set(1 - spasm * 0.18, 1 - spasm * 0.18, 1 + spasm * 0.1 + prSm * 0.05);
    BE.update(dt, lookR, { open: clamp(exp * (1 - hit * 0.6) * (0.95 + 0.05 * Math.sin(t)), 0.0, 1) * 0.95 + 0.04 + (vent ? 0.25 : 0), pupil: 0.8 + 0.12 * Math.sin(t * 4) * exp + p3 * 0.2 - prSm * 0.25, glow: 0.4 + exp * (1.0 + 0.6 * Math.sin(t * 3) + p3 * 1.0) + flashT + prSm * 0.6, hurt: U.uHurt.value, shake: hurtLow * 0.05 + (vent ? 0.04 : 0), blinkRate: 0.7 + rage * 1.2 + prSm * 2, track: 7, brow: 0.15 + prSm * 0.2 });
    const bp = Math.pow(Math.max(0, Math.sin(birth * 2.6)), 3), mo = clamp(exp * (0.25 + 0.55 * bp + 0.2 * breath) + hit * 0.3 * exp + (vent ? 0.35 : 0) + (gest ? 0.35 + 0.5 * spasm : 0), 0, 1); mouth.set(mo);
    sacs.forEach((S, i) => {
      const w = Math.pow(Math.max(0, Math.sin(birth * 2.6 - i * 0.7)), 2), sw = 0.9 + 0.2 * Math.sin(t * 2 + S.ph) + w * 0.35 * exp + spasm * 0.2, gs = Math.max(0.001, Math.max(exp, gest ? 0.9 : 0)) * (0.85 + 0.25 * exp);
      const gx = Math.cos(S.a + t * 0.05) * (0.52 + 0.05 * w * exp + spasm * 0.25), gy = Math.sin(S.a + t * 0.05) * (0.52 + 0.05 * w), gz = 0.12 + 0.08 * w * exp + spasm * 0.15;
      mA.compose(vv.set(gx, gy, gz), qq.identity(), ss.set(0.2 * sw * 0.9 * gs, 0.2 * sw * gs, 0.22 * sw * gs)); sacIM.setMatrixAt(i, mA);
      mA.compose(vv.set(gx, gy, gz + (0.03 * w * exp + Math.sin(t * 5 + S.ph) * 0.01) * gs), qq.identity(), ss.set(0.085 * (1 + 0.2 * Math.sin(t * 7 + S.ph)) * gs, 0.085 * (1 + 0.25 * Math.sin(t * 6 + S.ph * 2)) * gs, 0.11 * gs)); embIM.setMatrixAt(i, mA);
    });
    sacIM.instanceMatrix.needsUpdate = embIM.instanceMatrix.needsUpdate = true;

    /* materiales: venas laten al ritmo de la presión; vientre brillante al abrirse (punto débil) */
    const beat = 0.5 + 0.5 * Math.sin(t * pulseHz * TAU * 0.5 + id);
    U.uVeinGlow.value = 0.18 + prSm * (0.6 + 0.9 * beat) + exp * 0.2 + flashT * 0.4 + (vent ? 0.4 : 0); U.uCrackGlow.value = 0.2 + p2 * 0.2 + p3 * 0.4 + prSm * 1.0 + (vent ? 0.8 : 0) + shoot * 0.3; U.uGlow.value = prSm * 0.4 + flashT * 0.3 + (1 - op) * shoot * 0.3; U.uCry.value = 0.6 + (1 - op) * (0.2 + shoot * 0.9) + p3 * 0.3 + flashT + prSm * 0.8 + 0.12 * Math.sin(t * 4);
    U.uPulse.value = prSm * 0.5 + (vent ? 0.4 : 0); bioT.userData.u.uHurt.value = U.uHurt.value; UT.uVeinGlow.value = 0.15 + prSm * 0.5 * beat;
    UF.uHurt.value = U.uHurt.value; UF.uGlow.value = 0.05 + exp * (0.2 + 0.2 * Math.sin(t * 3.4) + p3 * 0.2) + flashT * 0.3 + prSm * 0.3 * beat + spasm * 0.7; UF.uVeinGlow.value = 0.3 + exp * 0.3 + prSm * 0.9 * beat + spasm * 0.8; UF.uPulse.value = exp * 0.4 + spasm * 0.8 + prSm * 0.4;
    UM.uHurt.value = U.uHurt.value; UM.uVeinGlow.value = 0.4 + exp * 0.4 + spasm * 0.9; UM.uGlow.value = 0.1 + exp * (0.4 * bp) + spasm * 0.7;
    const colG = dc.copy(colA).lerp(colHot, p3 * 0.5); U.uGlowCol.value.copy(colG);

    /* destellos de disparo: giran como las espirales (m.t*1.6 rad/s) */
    for (let i = 0; i < NA; i++) { const a = t * 1.6 + (i / NA) * TAU, r = 0.55, f = (1 - op) * (0.3 + 0.4 * Math.pow(0.5 + 0.5 * Math.sin(a * 2 - fireT * 4), 2)) * (i < ph + 3 ? 1 : 0) * (1 + shoot * 0.5) * (1 - (vent || gest ? 1 : 0));
      armP[i * 3] = Math.cos(a) * r; armP[i * 3 + 1] = Math.sin(a) * r; armP[i * 3 + 2] = 0.6 - 0.1 * Math.sin(a * 2); dc.copy(colA).lerp(colHot, p3 * 0.6).multiplyScalar(f); armC[i * 3] = dc.r; armC[i * 3 + 1] = dc.g; armC[i * 3 + 2] = dc.b; }
    armG.attributes.position.needsUpdate = true; armG.attributes.color.needsUpdate = true;
    inGlow.material.opacity = exp * (0.28 + 0.2 * bp + 0.08 * Math.sin(t * 3)) + shock * 0.3 + spasm * 0.4; inGlow.scale.setScalar(2.0 + exp * 0.6 + shock * 1.2 + spasm * 0.8);
    halo.material.opacity = 0.08 + (1 - op) * 0.06 + exp * 0.1 + shock * 0.25 + flashT * 0.2 + p3 * 0.07 + prSm * 0.2 * beat; halo.scale.setScalar(4.6 + shock * 1.5 + flashT * 1.0 + prSm * 0.8); halo.material.color.copy(colA).lerp(colHot, p3 * 0.5 + prSm * 0.3);

    /* tentáculos, cristales por fases */
    for (let i = 0; i < NT; i++) trig.set(i, 0.5 + p3 * 0.3 + hit * 0.4 + exp * 0.15 + spasm * 0.3 + prSm * 0.1, 1.1 + (i % 3) * 0.2 + rage * 1.0, null, 0, 1 + spasm * 0.06);
    const gr = (g, v, w) => g.scale.setScalar(Math.max(0.001, clamp(v, 0, 1.05) * (1 + w * Math.sin(t * 3 + id)))); gr(cl2, p2, 0.03); gr(cl3, p3, 0.04);

    /* vapor por las grietas (vent) y larvas expulsadas (gestate) */
    if (vent || prSm > 0.65) { ventAcc += dt * ((vent ? 38 : 0) + prSm * 8); while (ventAcc >= 1) { ventAcc -= 1; const a = Math.random() * TAU, r = 0.5 + Math.random() * 0.45; tmpV.set(Math.cos(a) * r, Math.sin(a) * r, 0.5 + Math.random() * 0.5); velV.set(Math.cos(a) * (0.6 + Math.random()), Math.sin(a) * (0.6 + Math.random()), 0.4 + Math.random() * 0.8); steam.emit(tmpV, velV, 1.3, 0xcfffe0); } }
    if (gest) { const sp = spasm > 0.5 && spasmPrev <= 0.5; if (sp) { for (let i = 0; i < (LOW ? 4 : 8); i++) { tmpV.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, -0.2 + Math.random() * 0.3); const a = Math.random() * TAU, e = (Math.random() - 0.3) * 1.2; velV.set(Math.cos(a) * Math.cos(e) * 2.2, Math.sin(e) * 2.2, Math.sin(a) * Math.cos(e) * 2.2); larvae.emit(tmpV, velV, 1.6, 0xe8ff90); } } }
    spasmPrev = spasm; steam.update(dt, { grow: 0.15, drag: 0.8 }); larvae.update(dt, { drag: 0.5 });

    /* esporas: más densas y de color al abrirse (la cría) */
    for (let i = 0; i < NSP; i++) { const d = pd[i]; d.a += dt * d.s * (0.6 + exp * 1.2 + rage); d.y += dt * (0.08 + exp * 0.18) * (0.5 + d.v); if (d.y > 1.1) d.y = -1.1; const rr = d.r * (1 + exp * 0.25) + Math.sin(t + d.h * 9) * 0.05;
      pp[i * 3] = Math.cos(d.a) * rr; pp[i * 3 + 1] = d.y; pp[i * 3 + 2] = Math.sin(d.a) * rr; const f = (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + d.h * 20))) * (1 - Math.abs(d.y) * 0.6); dc.copy(colA).lerp(colHot, p3 * 0.5 + (d.v > 0.7 ? exp * 0.5 : 0)).multiplyScalar(f * (0.5 + exp * 0.8)); pc[i * 3] = dc.r; pc[i * 3 + 1] = dc.g; pc[i * 3 + 2] = dc.b; }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
  } };
}
