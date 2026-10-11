// COLOSO PRISMÁTICO (jefe M1) — leviatán / ojo-colmena flotante. Masa de carne viva con un gran ojo central, un enjambre de ojos
// de tamaños distintos que siguen al jugador, boca con dientes, costillas de hueso-cristal, tres anillos giroscópicos con cristales,
// tentáculos largos que ondulan, sacos bioluminiscentes y partículas. Evoluciona con las fases (hp>0.66 / >0.33 / menos):
// más cristales brotando de la piel, heridas brillantes, ojos nuevos, anillos más rápidos, carne más enrojecida y rabiosa.
// 'wind' (0.8 s) = aviso: ojos clavados en el jugador, boca abierta, anillos que se expanden, núcleo que se calienta; luego estalla.
import { cfg } from '../quality.js';
import { bigEye, eyeCluster, soft, maw, mergeParts, spikeGeometry, tubeGeo, softDot, clamp, lerp, damp, rnd } from './obelisco-lib.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, tentacle, Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const skin = fleshMaterial({ color: 0x3a1646, vein: 0x12041e, spot: color, glow: 0.0, wobble: 0.02, breath: 0.03, spots: 0.4, sheen: 0.2, veins: 0.9, iri: 0, rough: 0.5, scale: 2.0 });
  const skinD = fleshMaterial({ color: 0x2a0f38, vein: 0x0c0215, spot: color, glow: 0.0, wobble: 0.015, breath: 0.02, spots: 0.35, sheen: 0.3, veins: 0.8, rough: 0.5, scale: 2.4 });
  const gum = fleshMaterial({ color: 0x8a2438, vein: 0x300612, spot: 0xff7a50, glow: 0.4, wobble: 0.02, breath: 0.03, spots: 0.2, veins: 0.8, rough: 0.35, scale: 3 });
  const bone = boneMaterial(0xe3d9ee, { rough: 0.3, glow: 0.05 }), fang = boneMaterial(0xfaf5e8, { rough: 0.25 });
  const crystal = bioCrystalMaterial(0xffa21f, { glow: 0.7 }), crystal2 = bioCrystalMaterial(0x4fd2ff, { glow: 0.8 });
  const root = new THREE.Group(), rig = new THREE.Group(), body = new THREE.Group(); root.add(rig); rig.add(body);
  const RAD = [0.64, 0.6, 0.74];
  const onSurf = (d, k = 1) => { const n = d.clone().normalize(); return { p: V(n.x * RAD[0] * k, n.y * RAD[1] * k, n.z * RAD[2] * k), n: V(n.x / RAD[0], n.y / RAD[1], n.z / RAD[2]).normalize() }; };

  /* ── masa: núcleo, grupa, vientre ── */
  const core = blob(skin, 1, RAD[0], RAD[1], RAD[2]); body.add(core);
  const rear = soft(skin, 0.5, 1, 0.9, 1.25, 20, 14); rear.position.set(0, -0.1, -0.58); body.add(rear);
  const belly = soft(skinD, 0.42, 1.1, 0.8, 1.0, 18, 12); belly.position.set(0, -0.42, 0.12); body.add(belly);
  const nape = soft(skinD, 0.3, 1.5, 0.7, 1.0, 14, 10); nape.position.set(0, 0.5, -0.1); body.add(nape);

  /* ── costillas de hueso-cristal (jaula abierta por delante) ── */
  { const ribs = [], N = LOW ? 5 : 8;
    for (let i = 0; i < N; i++) { const ph = (i / N) * Math.PI * 2 + 0.2, pts = []; for (let j = 0; j <= 10; j++) { const th = 0.75 + (j / 10) * 1.75, k = 1.09 + Math.sin((j / 10) * Math.PI) * 0.08; pts.push(V(Math.sin(th) * Math.cos(ph) * RAD[0] * k, Math.sin(th) * Math.sin(ph) * RAD[1] * k, Math.cos(th) * RAD[2] * k)); }
      ribs.push(tubeGeo(pts, 0.032, 16, 5)); }
    const g = mergeParts(ribs.map((r) => ({ g: r, m: new THREE.Matrix4() }))); body.add(new THREE.Mesh(g, bone)); }

  /* ── anillos giroscópicos con cristales ── */
  const rings = [], RR = [0.98, 1.1, 1.2];
  for (let i = 0; i < (LOW ? 2 : 3); i++) {
    const tilt = new THREE.Group(), spin = new THREE.Group(); tilt.add(spin); rig.add(tilt);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(RR[i], 0.016 + i * 0.004, 6, LOW ? 40 : 72), i === 1 ? crystal : crystal2); spin.add(ring);
    const items = []; const n = 10 + i * 2; for (let j = 0; j < n; j++) { const a = (j / n) * Math.PI * 2 + i, d = V(Math.cos(a), Math.sin(a), 0); items.push({ p: d.clone().multiplyScalar(RR[i]), d: d.clone().add(V(0, 0, (j % 2 ? 0.25 : -0.25))), r: 0.028 + (j % 3) * 0.008, h: 0.12 + (j % 3) * 0.07 }); }
    spin.add(new THREE.Mesh(spikeGeometry(items, 4), i === 1 ? crystal2 : crystal));
    tilt.rotation.set([1.25, 0.4, 0.0][i], [0.2, 0.2, 0][i], [0.3, 1.05, 0.0][i]); rings.push({ tilt, spin, sp: [0.35, -0.5, 0.25][i], pre: [0.12, -0.09, 0.07][i], base: tilt.rotation.clone() });
  }

  /* ── ojos: gran ojo central + enjambre instanciado ── */
  const eyeRoot = new THREE.Group(); eyeRoot.position.set(0, 0.1, 0.6); body.add(eyeRoot);
  const BE = bigEye({ r: 0.27, iris: color, quality: level, lidSkin: skin }); eyeRoot.add(BE.object);
  const EC = eyeCluster({ max: LOW ? 14 : 26, quality: level }); body.add(EC.object);
  const eyeInfo = []; // ph: fase a partir de la cual aparece
  const addEye = (d, r, ph, tint, slit) => { const s = onSurf(d, 0.96); const id = EC.add({ p: s.p, n: s.n, r, tint, slit }); if (id >= 0) { EC.setScale(id, 0); eyeInfo.push({ id, ph, s: 0 }); } };
  const tints = [0xffd24a, 0x7affc8, 0xff7ab0, 0x8fb0ff, 0xffa040];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; addEye(V(Math.sin(a) * 0.62, Math.cos(a) * 0.55 + 0.1, 1.0), 0.115 - (i % 2) * 0.02, 1, tints[i % 5], i % 3 === 0); }
  { const n = LOW ? 7 : 19, ga = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - 2 * ((i + 0.5) / n), rr = Math.sqrt(1 - y * y), th = i * ga + 1.1, d = V(Math.cos(th) * rr, y * 0.9, Math.sin(th) * rr);
    if (d.z > 0.8 && Math.abs(d.x) < 0.5 && Math.abs(d.y) < 0.5) continue; addEye(d, 0.05 + (i % 4) * 0.014, i < n * 0.4 ? 1 : i < n * 0.75 ? 2 : 3, tints[(i + 2) % 5], i % 5 === 0); } }

  /* ── boca ── */
  const mouth = maw(skin, fang, { w: 0.36, len: 0.3, teeth: LOW ? 6 : 10, tooth: 0.12, inner: gum }); mouth.object.position.set(0, -0.3, 0.52); mouth.object.rotation.x = 0.35; body.add(mouth.object);
  const lipT = []; if (!LOW) for (let i = 0; i < 4; i++) { const s = i < 2 ? -1 : 1, t = tentacle(skin, { len: 0.7, r0: 0.05, r1: 0.008, hang: true, amp: 0.12, speed: 2.4, freq: 3, phase: i * 1.3 }); t.position.set(s * (0.28 + (i % 2) * 0.1), -0.34, 0.58); body.add(t); lipT.push(t); }

  /* ── tentáculos largos que arrastra por detrás ── */
  const tents = [], NT = LOW ? 6 : 10;
  for (let i = 0; i < NT; i++) {
    const a = (i / NT) * Math.PI * 2 + 0.3, len = 2.2 + (i % 3) * 0.45, t = tentacle(skinD, { len, r0: 0.16 - (i % 3) * 0.02, r1: 0.018, hang: true, amp: 0.55, speed: 1.3 + (i % 4) * 0.15, freq: 2.4, phase: i * 1.9 });
    const pv = new THREE.Group(); pv.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.36 - 0.06, -0.5); const d = V(Math.cos(a) * 0.55, Math.sin(a) * 0.5 - 0.35, -1).normalize(); pv.quaternion.setFromUnitVectors(V(0, -1, 0), d);
    pv.add(t); body.add(pv); tents.push({ pv, t, d, a });
  }

  /* ── cristales que brotan por fases ── */
  const mkCluster = (items, mat, sides = 5) => { const g = new THREE.Group(); g.add(new THREE.Mesh(spikeGeometry(items, sides), mat)); g.scale.setScalar(0.001); body.add(g); return g; };
  const c1 = [], c2 = [], c3 = [];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, s = onSurf(V(Math.cos(a) * 0.45, 1, -0.25 + Math.sin(a) * 0.5), 0.94); c1.push({ p: s.p, d: s.n.clone().add(V(0, 0.2, -0.2)), r: 0.07 + (i % 2) * 0.03, h: 0.4 + (i % 3) * 0.14 }); }
  for (let i = 0; i < 8; i++) { const sd = i % 2 ? 1 : -1, s = onSurf(V(sd * 1, (i >> 1) * 0.28 - 0.3, 0.1 - (i >> 1) * 0.35), 0.94); c2.push({ p: s.p, d: s.n.clone().add(V(sd * 0.3, 0.1, -0.35)), r: 0.07 + (i % 3) * 0.02, h: 0.4 + (i % 3) * 0.16 }); }
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, s = onSurf(V(Math.cos(a) * 0.85, Math.sin(a) * 0.8, 0.75), 0.95); c3.push({ p: s.p, d: s.n.clone().add(V(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.1)), r: 0.08 + (i % 2) * 0.03, h: 0.5 + (i % 3) * 0.2 }); }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2, s = onSurf(V(Math.cos(a) * 0.6, Math.sin(a) * 0.6, -1), 0.94); c3.push({ p: s.p, d: V(Math.cos(a) * 0.5, Math.sin(a) * 0.5, -1), r: 0.1, h: 0.85 + (i % 2) * 0.3 }); }
  const cl1 = mkCluster(c1, crystal), cl2 = mkCluster(c2, crystal2), cl3 = mkCluster(c3, crystal, 6);

  /* ── sacos bioluminiscentes (pústulas) y heridas brillantes ── */
  const sacM = new THREE.MeshStandardMaterial({ color: 0x1a3a40, emissive: new THREE.Color(color), emissiveIntensity: 1.2, roughness: 0.2 });
  const NS = LOW ? 6 : 14, sacs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), sacM, NS), sacD = []; sacs.frustumCulled = false; sacs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < NS; i++) { const a = rnd() * Math.PI * 2, y = (rnd() - 0.5) * 1.3, s = onSurf(V(Math.cos(a), y, Math.sin(a) * 0.9 - 0.2), 1.0); sacD.push({ p: s.p, n: s.n, r: 0.05 + rnd() * 0.06, ph: rnd() * 6.28 }); }
  body.add(sacs);
  const woundM = new THREE.MeshBasicMaterial({ color: 0xff7a30 }), NW = LOW ? 4 : 9, wounds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), woundM, NW), woundD = []; wounds.frustumCulled = false;
  for (let i = 0; i < NW; i++) { const a = rnd() * Math.PI * 2, y = (rnd() - 0.2) * 1.2, s = onSurf(V(Math.cos(a), y, Math.sin(a) * 0.8 + 0.1), 0.995); woundD.push({ p: s.p, n: s.n, ph: i < 4 ? 2 : 3, rot: rnd() * 6.28, s: 0 }); }
  body.add(wounds);

  /* ── halo y esporas ── */
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.scale.setScalar(4.2); rig.add(halo);
  const NP = LOW ? 18 : 48, pp = new Float32Array(NP * 3), pc = new Float32Array(NP * 3), pd = []; for (let i = 0; i < NP; i++) pd.push({ a: rnd() * 6.28, r: 1.3 + rnd() * 0.9, y: (rnd() - 0.5) * 1.8, s: 0.15 + rnd() * 0.3, h: rnd() });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const motes = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.13, map: softDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); motes.frustumCulled = false; rig.add(motes);

  const mats = [skin, skinD, gum, bone, fang, crystal, crystal2, sacM, ...BE.mats, ...EC.mats];
  const sKick = new Spring(0, 90, 7), sHit = new Spring(0, 140, 8), sRoll = new Spring(0, 40, 5);
  let p2 = 0, p3 = 0, wind = 0, wt = 0, prevS = '', burst = 0, hit = 0, prevHp = 1, prevPh = 1, flashT = 0, ringBoost = 0;
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), look0 = new THREE.Vector3(0, 0, 1);
  const baseSkin = new THREE.Color(0x3a1646), rageSkin = new THREE.Color(0x7a1c34), baseVein = new THREE.Color(0x1e0830), rageVein = new THREE.Color(0x5a0a14), colA = new THREE.Color(color), colHot = new THREE.Color(0xff5a40);
  const dc = new THREE.Color(), tmp = new THREE.Vector3();

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0, 0.05); const id = st.id || 0, hp = st.hp == null ? 1 : st.hp, ph = hp > 0.66 ? 1 : hp > 0.33 ? 2 : 3, look = ctx.look || look0;
    if (ph !== prevPh) { flashT = 1; sKick.v += 5; prevPh = ph; }
    if (hp < prevHp - 0.0005) { hit = Math.min(1, hit + 0.5); sHit.v += 2.2; } prevHp = hp; hit = Math.max(0, hit - dt * 4); flashT = Math.max(0, flashT - dt * 1.2);
    const sn = st.s; if (sn !== prevS) { if (sn === 'wind') wt = 0; if (prevS === 'wind') { burst = 1; sKick.v -= 8; } prevS = sn; } if (sn === 'wind') wt += dt;
    const w = sn === 'wind' ? clamp(wt / 0.8, 0, 1) : 0; wind = damp(wind, w, w > 0 ? 18 : 6, dt); burst = Math.max(0, burst - dt * 2.4);
    p2 = damp(p2, ph >= 2 ? 1 : 0, 1.4, dt); p3 = damp(p3, ph >= 3 ? 1 : 0, 1.4, dt); const rage = clamp((1 - hp) * 1.25, 0, 1);
    const kick = sKick.step(dt, 0), hk = sHit.step(dt, 0), roll = sRoll.step(dt, Math.sin(t * 0.35 + id) * 0.05);
    const breath = Math.sin(t * (1.3 + rage * 1.5) + id) * 0.5 + 0.5;

    /* flotar */
    rig.position.y = Math.sin(t * 0.6 + id) * 0.05 + Math.sin(t * 1.1) * 0.015; rig.rotation.z = roll * 0.6; rig.rotation.x = Math.sin(t * 0.45 + 1) * 0.03 + kick * 0.05;
    body.position.z = -wind * 0.12 + kick * 0.08 - burst * 0.05;
    const bs = 1 + (breath - 0.5) * 0.035 + wind * 0.045 + burst * 0.03 - hit * 0.02 + hk * 0.03; body.scale.set(bs * (1 + hit * 0.01), bs * (1 - wind * 0.03), bs);

    /* piel: se enrojece y brilla con las fases / el aviso */
    skin.color.copy(baseSkin).lerp(rageSkin, p3 * 0.7 + rage * 0.3); skin.userData.u.uVein.value.copy(baseVein).lerp(rageVein, p3 * 0.8);
    const U = skin.userData.u; U.uGlow.value = 0.01 + p3 * 0.05 + wind * 0.12 + burst * 0.2 + flashT * 0.15; U.uPulse.value = wind * 0.7 + p3 * 0.2; skinD.userData.u.uGlow.value = 0.01 + p3 * 0.04 + wind * 0.08;
    gum.userData.u.uGlow.value = 0.4 + wind * 1.6 + 0.2 * Math.sin(t * 6); skinD.color.setHex(0x2a0f38).lerp(dc.setHex(0x4a1230), p3 * 0.6);
    crystal.userData.u.uGlow.value = 1 + wind * 2; crystal.emissiveIntensity = 0.45 + wind * 1.2 + p3 * 0.3 + flashT * 0.9 + 0.12 * Math.sin(t * 4); crystal2.emissiveIntensity = 0.55 + wind * 1.2 + p3 * 0.3 + 0.14 * Math.sin(t * 5 + 1);
    bone.emissive.setRGB(0.1, 0.06, 0.12).multiplyScalar(wind * 2 + p3 * 0.8);

    /* ojos */
    const focus = Math.max(wind, 0); BE.update(dt, look, { open: clamp(0.92 + wind * 0.08 - hit * 0.4 - (1 - hp) * 0.08, 0.1, 1), pupil: lerp(0.8, 0.45, wind) * (1 - p3 * 0.1) + 0.05 * Math.sin(t * 2 + id), glow: 0.6 + wind * 2.2 + p3 * 0.7 + flashT, hurt: U.uHurt.value, shake: wind * 0.01, blinkRate: 0.5 + rage, track: 8 });
    for (const e of eyeInfo) { const tg = ph >= e.ph ? 1 : 0; e.s = damp(e.s, tg, 3.2, dt); EC.setScale(e.id, e.s * (1 + 0.04 * Math.sin(t * 3 + e.id))); }
    EC.update(dt, look, { open: clamp(1 - hit * 0.7 - (1 - hp) * 0.1 + wind * 0.3, 0.2, 1), dilate: 1 - wind * 0.35 - p3 * 0.1, glow: 0.5 + p3 * 0.5 + wind * 1.5, jitter: 1 - wind * 0.9 + rage, blinkRate: 0.8 + rage * 1.5, track: 1 + wind * 2, maxAng: 1.2 });
    EC.sclera.userData.u.uGlow.value = wind * 0.3;
    /* boca */
    const mo = clamp(0.12 + breath * 0.1 + wind * 0.85 + burst * 0.5 + hit * 0.4 + p3 * 0.12 + Math.max(0, Math.sin(t * 0.7 + id)) * 0.08, 0, 1); mouth.set(mo);
    lipT.forEach((l) => { l.userData.u.uAmp.value = 0.12 + wind * 0.25 + rage * 0.1; });

    /* anillos: giran, se expanden al avisar y estallan al lanzar */
    const spd = 1 + rage * 1.2 + p3 * 0.8 + wind * 5 + burst * 3;
    rings.forEach((R, i) => { R.spin.rotation.z += dt * R.sp * spd; R.tilt.rotation.y = R.base.y + t * R.pre * (1 + rage) + Math.sin(t * 0.5 + i) * 0.1; R.tilt.rotation.x = R.base.x + Math.sin(t * 0.3 + i * 2) * 0.12 + hk * 0.06; const sc = 1 + wind * 0.14 + burst * (0.22 + i * 0.06) + (breath - 0.5) * 0.015 + flashT * 0.12; R.tilt.scale.setScalar(sc); });

    /* tentáculos: serpentean, se agitan con la rabia; colores siguen a la piel */
    tents.forEach((T, i) => { const u = T.t.userData.u; u.uAmp.value = 0.5 + p3 * 0.25 + wind * 0.3 + hit * 0.4; u.uSpeed.value = 1.3 + (i % 4) * 0.15 + rage * 1.1 + wind * 1.2; T.pv.rotation.z += 0; const m = T.t.userData.mat; if (m) { m.color.copy(skinD.color); } });

    /* cristales por fases (brotan con rebote) y heridas */
    const grow = (g, v, wob) => { const s = clamp(v, 0, 1.05); g.scale.setScalar(Math.max(0.001, s * (1 + wob * Math.sin(t * 3 + id) + 0.06 * wind))); };
    grow(cl1, 1, 0.025); grow(cl2, p2, 0.03); grow(cl3, p3, 0.04);
    for (let i = 0; i < NW; i++) { const W = woundD[i]; W.s = damp(W.s, ph >= W.ph ? 1 : 0, 2.2, dt); Q.setFromUnitVectors(up, W.n); const k = W.s * (0.7 + 0.3 * Math.sin(t * 4 + i)); S.set(0.13 * k, 0.018 * k, 0.04 * k); Q.multiply(new THREE.Quaternion().setFromAxisAngle(up, W.rot)); P.copy(W.p).addScaledVector(W.n, 0.01); M.compose(P, Q, S); wounds.setMatrixAt(i, M); }
    wounds.instanceMatrix.needsUpdate = true; woundM.color.setHex(0xff6a20).lerp(colHot, p3);
    for (let i = 0; i < NS; i++) { const sd = sacD[i], k = 0.8 + 0.25 * Math.sin(t * (2 + rage * 3) + sd.ph) + wind * 0.3; Q.setFromUnitVectors(up, sd.n); P.copy(sd.p).addScaledVector(sd.n, sd.r * 0.3); S.set(sd.r * k, sd.r * k * 0.9, sd.r * k); M.compose(P, Q, S); sacs.setMatrixAt(i, M); }
    sacs.instanceMatrix.needsUpdate = true; sacM.emissiveIntensity = 1 + 0.5 * Math.sin(t * 2.2) + wind * 1.5 + rage * 0.8; sacM.emissive.copy(colA).lerp(colHot, p3 * 0.5);

    /* halo y esporas */
    halo.material.opacity = 0.22 + wind * 0.45 + burst * 0.4 + p3 * 0.15 + flashT * 0.3; halo.scale.setScalar(4.2 + wind * 1.2 + burst * 1.8 + flashT * 1.0); halo.material.color.copy(colA).lerp(colHot, p3 * 0.45 + wind * 0.2);
    for (let i = 0; i < NP; i++) { const d = pd[i]; d.a += dt * d.s * (1 + wind * 3 + rage); const rr = d.r * (1 + burst * 0.5 + wind * -0.15) + Math.sin(t + d.h * 9) * 0.06; pp[i * 3] = Math.cos(d.a) * rr; pp[i * 3 + 1] = d.y + Math.sin(t * 0.8 + d.h * 6) * 0.25; pp[i * 3 + 2] = Math.sin(d.a) * rr; const f = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2 + d.h * 20)); dc.copy(colA).lerp(colHot, p3 * 0.5).multiplyScalar(f); pc[i * 3] = dc.r; pc[i * 3 + 1] = dc.g; pc[i * 3 + 2] = dc.b; }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
  } };
}
