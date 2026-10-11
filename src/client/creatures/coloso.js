// COLOSO PRISMÁTICO (jefe M1) — leviatán / ojo-colmena flotante. Masa de carne oscura y caparazón de quitina con un gran ojo central rodeado por un
// iris de placas, enjambre de ojos de tamaños distintos que siguen al jugador, mandíbula con dientes, costillas de hueso, corona de cuernos de cristal,
// tres anillos giroscópicos con dientes de cristal, tentáculos gruesos y sacos bioluminiscentes. Evoluciona con las fases (hp>0.66 / >0.33 / menos):
// más cristales brotando, grietas ardiendo, ojos nuevos, anillos más rápidos y carne más enrojecida.
// 'wind' (0.8 s) = aviso del anillo de orbes · 'ray' (~4 s) = carga del RAYO DEL VACÍO: el ojo se abre, los anillos se alinean, los ojos se clavan en
// el resonador (st.a) y un haz crece desde el ojo · 'stagger' (~8 s) = aturdido: se ladea y cae, el escudo estalla, ojos desorientados, humo y tentáculos flácidos.
// st.sd = ESCUDO DE RESONANCIA (burbuja de cristal con esquirlas orbitando; se agrieta al recibir daño).
import * as THREE from 'three';
import { cfg } from '../quality.js';
import { bioMaterial } from './obelisco-mat.js';
import { bigEye, eyeCluster, mawBio, softDot, clamp, lerp, damp, rnd } from './obelisco-lib.js';
import { V3, paint, place, aimY, merge, loft, line, prof, domePlate, patch, blobGeo, spikes, crystals, tentacleBundle, tentacleRig, sstep } from './obelisco-geo.js';
import { shieldBubble, orbitShards, chargeBeam, particleBank } from './coloso-fx.js';

const TAU = Math.PI * 2;

export default function build(kit, color) {
  const { Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const R = LOW ? 8 : HI ? 16 : 12;
  const GOLD = 0xffa21f, TEAL = 0x30c8ff, FLESH = 0x2e1438, FLESH2 = 0x4a2250, CHIT = 0x161024, BONE = 0x8a7a68;
  const bio = bioMaterial({ glow: 0xff8a20, vein: 0x120620, rim: 0x4a2a80, scale: 0.9, bump: 1.0, wet: 0.5, ridge: 70, sheen: 0.12, metal: 0.14, breath: 0.012 }); const U = bio.userData.u; U.uVeinGlow.value = 0.12; U.uCrackGlow.value = 0.2;
  const NT = LOW ? 8 : 14;
  const bioT = bioMaterial({ glow: 0xff8a20, vein: 0x120620, rim: 0x4a2a80, scale: 2.0, tent: NT, breath: 0 }); const UT = bioT.userData.u; UT.uVeinGlow.value = 0.15;
  const root = new THREE.Group(), rig = new THREE.Group(), body = new THREE.Group(); root.add(rig); rig.add(body);
  const RAD = [0.7, 0.62, 0.78], BS = 1.28;
  const onSurf = (d, k = 1) => { const n = d.clone().normalize(); return { p: new V3(n.x * RAD[0] * k, n.y * RAD[1] * k, n.z * RAD[2] * k), n: new V3(n.x / RAD[0], n.y / RAD[1], n.z / RAD[2]).normalize() }; };
  const mesh = (g, parent = body, m = bio) => { const o = new THREE.Mesh(g, m); parent.add(o); return o; };

  /* ── masa estática: núcleo con caparazón, cola, costillas, corona de cuernos, crestas dorsales y anillo orbital del ojo ── */
  { const sp = [];
    sp.push(paint(blobGeo(RAD[0], RAD[1], RAD[2], LOW ? 16 : 28, LOW ? 12 : 20, (p, n) => { const b = Math.sin(p.x * 7) * Math.sin(p.y * 6) * Math.sin(p.z * 5); p.addScaledVector(n, 0.025 * b); }), FLESH, 0, 0, (p, n) => { const arm = sstep(-0.15, 0.4, n.y * 0.9 - n.z * 0.15 + 0.1 * Math.sin(p.x * 9)); return { cls: arm, c: new THREE.Color(FLESH).lerp(new THREE.Color(CHIT), arm), k: 0.75 + 0.45 * Math.max(0, n.y), g: 0 }; }));
    // cola ahusada
    const tp = [new V3(0, -0.05, -0.5), new V3(0, -0.08, -0.85), new V3(0, -0.02, -1.15), new V3(0, 0.1, -1.45)];
    sp.push(paint(loft(tp, { seg: 10, radial: R, r: prof([[0, 0.5], [0.4, 0.34], [1, 0.05]]), ry: () => 0.9, round: [0, 0.08] }), FLESH, 0, 0, (p, n, uv) => ({ cls: n.y > 0.15 ? 1 : 0, c: n.y > 0.15 ? CHIT : FLESH, k: 0.8 + 0.3 * n.y })));
    sp.push(crystals([{ p: new V3(0, 0.1, -1.4), d: new V3(0, 0.3, -1), r: 0.12, h: 0.8, c: GOLD }], { sides: 6 }));
    // costillas de hueso (jaula abierta por delante)
    { const N = LOW ? 5 : 8;
      for (let i = 0; i < N; i++) { const ph = (i / N) * TAU + 0.2, pts = []; for (let j = 0; j <= 10; j++) { const th = 0.75 + (j / 10) * 1.75, k = 1.1 + Math.sin((j / 10) * Math.PI) * 0.1; pts.push(new V3(Math.sin(th) * Math.cos(ph) * RAD[0] * k, Math.sin(th) * Math.sin(ph) * RAD[1] * k, Math.cos(th) * RAD[2] * k)); }
        sp.push(paint(loft(pts, { seg: 16, radial: 5, r: (t) => 0.05 * (0.4 + Math.sin(t * Math.PI) * 0.8), ry: () => 0.8, round: [0.1, 0.1] }), BONE, 2, 0, (p, n, uv) => ({ g: 0.1, k: 0.9 }))); } }
    // corona de cuernos de quitina con punta de cristal detrás del cuerpo (silueta a distancia)
    { const N = LOW ? 8 : 12;
      for (let i = 0; i < N; i++) { const a = (i / N) * TAU + 0.15, c = Math.cos(a), s = Math.sin(a), L = i % 2 ? 1.0 : 1.3;
        const pts = [new V3(c * 0.5, s * 0.46, -0.35), new V3(c * 0.85, s * 0.8, -0.55), new V3(c * (1.2 * L), s * (1.15 * L), -0.85), new V3(c * (1.45 * L), s * (1.4 * L), -1.3 * L)];
        sp.push(paint(loft(pts, { seg: 10, radial: 6, r: (t) => lerp(0.1, 0.01, Math.pow(t, 0.8)), ry: () => 0.9, round: [0.05, 0] }), CHIT, 1, 0, (p, n, uv) => ({ c: new THREE.Color(CHIT).lerp(new THREE.Color(GOLD), sstep(0.62, 0.9, uv[1])), cls: 1 + 2 * sstep(0.7, 0.88, uv[1]), g: sstep(0.5, 1, uv[1]) * 0.8, k: 0.8 + 0.6 * uv[1] }))); } }
    // crestas dorsales (placas altas) y aro del ojo
    for (let i = 0; i < (LOW ? 3 : 5); i++) { const z = 0.3 - i * 0.28, h = 0.3 - i * 0.03; const pl = domePlate(0.12, 0.2, h, { ridge: 0.8, thick: 0.03, nu: 5, nv: 5 }); sp.push(paint(aimY(pl, new V3(0, RAD[1] * 0.97 * Math.cos(0.15 * i), z), new V3(0, 1, -0.5)), CHIT, 1, 0, (p, n, uv) => ({ k: 0.8 + 0.6 * Math.max(0, p.y * 2), g: 0.6 * sstep(0.75, 1, uv[1]) }))); }
    sp.push(place(paint(new THREE.TorusGeometry(0.37, 0.07, 8, LOW ? 20 : 36), CHIT, 1, 0.3, (p) => ({ k: 0.9 })), [0, 0.1, 0.6]));
    mesh(merge(sp)).castShadow = true; }

  /* ── iris de placas alrededor del ojo central (se abre al cargar el rayo) ── */
  const NPL = LOW ? 6 : 8, plates = [];
  const plateGeo = (() => { const g = patch((u, v) => { const w = 0.15 * Math.pow(Math.sin(Math.PI * (0.18 + 0.82 * v)), 0.8) * (1 - 0.25 * v), x = (u - 0.5) * 2 * w, y = v * 0.62, z = 0.18 * v * v + 0.025 * Math.sin(v * 16) + 0.04 * Math.abs(x) * 3; return new V3(x, y, z); }, 6, 9, { thick: 0.03, inner: true });
    return paint(g, CHIT, 1, 0, (p, n, uv) => ({ c: new THREE.Color(CHIT).lerp(new THREE.Color(GOLD), sstep(0.88, 1, uv[1]) * 0.7), k: 0.7 + 0.8 * uv[1], g: sstep(0.85, 1, uv[1]) * 0.9 })); })();
  const plateIM = new THREE.InstancedMesh(plateGeo, bio, NPL); plateIM.frustumCulled = false; plateIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const plateRing = new THREE.Group(); plateRing.position.set(0, 0.1, 0.62); body.add(plateRing); plateRing.add(plateIM);
  for (let i = 0; i < NPL; i++) { const h1 = new THREE.Object3D(); h1.rotation.z = (i / NPL) * TAU + 0.2; const h2 = new THREE.Object3D(); h2.position.y = 0.36; plates.push({ h1, h2, i, off: rnd() * 6.28 }); }
  const mA = new THREE.Matrix4(), mB = new THREE.Matrix4();

  /* ── ojos: gran ojo central + enjambre instanciado ── */
  const eyeRoot = new THREE.Group(); eyeRoot.position.set(0, 0.1, 0.6); body.add(eyeRoot);
  const BE = bigEye({ r: 0.3, iris: color, quality: level, lidColor: 0x4a2a4a, scleraColor: 0x7a6a58, irisR: 0.52, brow: 0.18 }); eyeRoot.add(BE.object);
  const eyeLens = new THREE.Object3D(); eyeLens.position.set(0, 0, 0.34); eyeRoot.add(eyeLens);
  const EC = eyeCluster({ max: LOW ? 14 : 26, quality: level, iris: 0xffffff, sclera: 0x8a7a6a }); body.add(EC.object);
  const eyeInfo = [];
  const addEye = (d, r, ph, tint, slit) => { const s = onSurf(d, 0.96); const id = EC.add({ p: s.p, n: s.n, r, tint, slit }); if (id >= 0) { EC.setScale(id, 0); eyeInfo.push({ id, ph, s: 0 }); } };
  const tints = [0xd08a20, 0x20c8a0, 0xd02a78, 0x4a6aff, 0xd05a20];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; addEye(new V3(Math.sin(a) * 0.62, Math.cos(a) * 0.55 + 0.1, 1.0), 0.12 - (i % 2) * 0.02, 1, tints[i % 5], i % 3 === 0); }
  { const n = LOW ? 7 : 19, ga = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - 2 * ((i + 0.5) / n), rr = Math.sqrt(1 - y * y), th = i * ga + 1.1, d = new V3(Math.cos(th) * rr, y * 0.9, Math.sin(th) * rr);
    if (d.z > 0.8 && Math.abs(d.x) < 0.5 && Math.abs(d.y) < 0.5) continue; addEye(d, 0.055 + (i % 4) * 0.015, i < n * 0.4 ? 1 : i < n * 0.75 ? 2 : 3, tints[(i + 2) % 5], i % 5 === 0); } }

  /* ── boca con dientes y tentáculos ── */
  const mouth = mawBio(bio, { w: 0.4, len: 0.32, teeth: LOW ? 7 : 11, tooth: 0.12, flesh: FLESH2, shell: 1, gum: 0x8a1c30, gumGlow: 0.7 }); mouth.object.position.set(0, -0.34, 0.5); mouth.object.rotation.x = 0.3; body.add(mouth.object);
  const specs = [], NL = LOW ? 6 : 10;
  for (let i = 0; i < NL; i++) { const a = (i / NL) * TAU + 0.3, len = 2.6 + (i % 3) * 0.6; specs.push({ p: new V3(Math.cos(a) * 0.46, Math.sin(a) * 0.4 - 0.06, -0.45), d: new V3(Math.cos(a) * 0.55, Math.sin(a) * 0.5 - 0.4, -1), sag: new V3(0, -0.12, 0), len, r0: 0.19 - (i % 3) * 0.02, r1: 0.02, c: FLESH, ph: i * 1.9 }); }
  for (let i = 0; i < NT - NL; i++) { const s = i < 2 ? -1 : 1; specs.push({ p: new V3(s * (0.3 + (i % 2) * 0.1), -0.38, 0.55), d: new V3(s * 0.3, -1, 0.3), len: 0.75, r0: 0.05, r1: 0.008, c: FLESH2, ph: i * 1.3 }); }
  mesh(tentacleBundle(specs, { seg: LOW ? 10 : 18, radial: LOW ? 5 : 8, color: FLESH, tipColor: 0x6a3a60 }), body, bioT);
  const trig = tentacleRig(bioT);

  /* ── anillos giroscópicos con dientes de cristal ── */
  const rings = [], RR = [1.2, 1.38, 1.58];
  for (let i = 0; i < (LOW ? 2 : 3); i++) {
    const tilt = new THREE.Group(), spin = new THREE.Group(); tilt.add(spin); rig.add(tilt);
    const pr = [paint(new THREE.TorusGeometry(RR[i], 0.03 + i * 0.005, 8, LOW ? 40 : 80), i === 1 ? 0x2a8aaa : 0x8a5a14, 3, 0.55, (p, n, uv) => ({ k: 0.6 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(Math.atan2(p.y, p.x) * 16), 2) }))];
    const items = []; const n = 10 + i * 2; for (let j = 0; j < n; j++) { const a = (j / n) * TAU + i, d = new V3(Math.cos(a), Math.sin(a), 0); items.push({ p: d.clone().multiplyScalar(RR[i]), d: d.clone().add(new V3(0, 0, j % 2 ? 0.28 : -0.28)), r: 0.035 + (j % 3) * 0.009, h: 0.15 + (j % 3) * 0.08, c: i === 1 ? TEAL : GOLD }); }
    pr.push(crystals(items, { sides: 4 })); const rm = mesh(merge(pr), spin);
    tilt.rotation.set([1.25, 0.4, 0.0][i], [0.2, 0.2, 0][i], [0.3, 1.05, 0.0][i]); rings.push({ tilt, spin, sp: [0.35, -0.5, 0.25][i], pre: [0.12, -0.09, 0.07][i], base: tilt.rotation.clone(), mesh: rm });
  }

  /* ── cristales que brotan por fases ── */
  const mkCluster = (items, sides = 5) => { const g = new THREE.Group(); mesh(crystals(items, { sides }), g); g.scale.setScalar(0.001); body.add(g); return g; };
  const c1 = [], c2 = [], c3 = [];
  for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU, s = onSurf(new V3(Math.cos(a) * 0.45, 1, -0.25 + Math.sin(a) * 0.5), 0.94); c1.push({ p: s.p, d: s.n.clone().add(new V3(0, 0.2, -0.2)), r: 0.08 + (i % 2) * 0.03, h: 0.45 + (i % 3) * 0.16, c: GOLD }); }
  for (let i = 0; i < 8; i++) { const sd = i % 2 ? 1 : -1, s = onSurf(new V3(sd * 1, (i >> 1) * 0.28 - 0.3, 0.1 - (i >> 1) * 0.35), 0.94); c2.push({ p: s.p, d: s.n.clone().add(new V3(sd * 0.3, 0.1, -0.35)), r: 0.08 + (i % 3) * 0.02, h: 0.45 + (i % 3) * 0.18, c: TEAL }); }
  for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, s = onSurf(new V3(Math.cos(a) * 0.85, Math.sin(a) * 0.8, 0.75), 0.95); c3.push({ p: s.p, d: s.n.clone().add(new V3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0.1)), r: 0.09 + (i % 2) * 0.03, h: 0.55 + (i % 3) * 0.2, c: GOLD }); }
  const cl1 = mkCluster(c1), cl2 = mkCluster(c2), cl3 = mkCluster(c3, 6);

  /* ── sacos bioluminiscentes y heridas brillantes ── */
  const sacM = new THREE.MeshBasicMaterial({ color: 0x20b0c0 });
  const NS = LOW ? 6 : 12, sacs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), sacM, NS), sacD = []; sacs.frustumCulled = false; sacs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < NS; i++) { const a = rnd() * TAU, y = (rnd() - 0.5) * 1.3, s = onSurf(new V3(Math.cos(a), y, Math.sin(a) * 0.9 - 0.2), 1.0); sacD.push({ p: s.p, n: s.n, r: 0.04 + rnd() * 0.05, ph: rnd() * 6.28 }); }
  body.add(sacs);
  const woundM = new THREE.MeshBasicMaterial({ color: 0xff7a30 }), NW = LOW ? 4 : 9, wounds = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), woundM, NW), woundD = []; wounds.frustumCulled = false;
  for (let i = 0; i < NW; i++) { const a = rnd() * TAU, y = (rnd() - 0.2) * 1.2, s = onSurf(new V3(Math.cos(a), y, Math.sin(a) * 0.8 + 0.1), 0.995); woundD.push({ p: s.p, n: s.n, ph: i < 4 ? 2 : 3, rot: rnd() * 6.28, s: 0 }); }
  body.add(wounds);

  /* ── escudo de resonancia, rayo, humo/brasas, halo y esporas ── */
  const shield = shieldBubble(GOLD, 1.9, 2); rig.add(shield.object);
  const shards = orbitShards(rig, LOW ? 8 : 18, { radius: 2.0, color: GOLD });
  const beam = chargeBeam(); body.add(beam.object);
  const smoke = particleBank(rig, LOW ? 12 : 32, { size: 0.9, additive: false, color: 0x403848, opacity: 0.55 }), embers = particleBank(rig, LOW ? 10 : 28, { size: 0.16, additive: true, color: 0xff9a40 });
  const rayGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: 0x70d8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); rayGlow.position.set(0, 0.1, 0.95); body.add(rayGlow);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.scale.setScalar(4.2); rig.add(halo);
  const NP = LOW ? 14 : 36, pp = new Float32Array(NP * 3), pc = new Float32Array(NP * 3), pd = []; for (let i = 0; i < NP; i++) pd.push({ a: rnd() * 6.28, r: 1.4 + rnd() * 0.9, y: (rnd() - 0.5) * 1.8, s: 0.15 + rnd() * 0.3, h: rnd() });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const motes = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.1, map: softDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); motes.frustumCulled = false; rig.add(motes);

  const mats = [bio, bioT, shards.mat, ...BE.mats, ...EC.mats];
  const sKick = new Spring(0, 90, 7), sHit = new Spring(0, 140, 8), sRoll = new Spring(0, 40, 5);
  let p2 = 0, p3 = 0, wind = 0, wt = 0, prevS = '', burst = 0, hit = 0, prevHp = 1, prevPh = 1, flashT = 0, rayT = 0, ray = 0, stg = 0, stgT = 0, sdAmt = 0, crack = 0, shFlash = 0, prevSd = false, smokeAcc = 0, emberAcc = 0, shBurst = 0;
  const Q = new THREE.Quaternion(), S = new V3(), P = new V3(), up = new V3(0, 1, 0), look0 = new V3(0, 0, 1), aimL = new V3(), aimW = new V3(), qa = new THREE.Quaternion(), M = new THREE.Matrix4();
  const baseSkin = new THREE.Color(FLESH), rageSkin = new THREE.Color(0x5a1a30), colA = new THREE.Color(color), colHot = new THREE.Color(0xff5a40), dc = new THREE.Color(), tmp = new V3(), dirT = new V3(), vel = new V3();

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0, 0.05); const id = st.id || 0, hp = st.hp == null ? 1 : st.hp, ph = hp > 0.66 ? 1 : hp > 0.33 ? 2 : 3, look = ctx.look || look0, sn = st.s;
    if (ph !== prevPh) { flashT = 1; sKick.v += 5; prevPh = ph; }
    const damaged = hp < prevHp - 0.0005; if (damaged) { hit = Math.min(1, hit + 0.5); sHit.v += 2.2; if (st.sd) { crack = Math.min(1, crack + 0.14); shFlash = 0.7; } } prevHp = hp; hit = Math.max(0, hit - dt * 4); flashT = Math.max(0, flashT - dt * 1.2);
    if (sn !== prevS) { if (sn === 'wind') wt = 0; if (prevS === 'wind') { burst = 1; sKick.v -= 8; } if (sn === 'ray') rayT = 0; if (sn === 'stagger') { stgT = 0; sKick.v += 6; } prevS = sn; }
    if (sn === 'wind') wt += dt; if (sn === 'ray') rayT += dt; if (sn === 'stagger') stgT += dt;
    const w = sn === 'wind' ? clamp(wt / 0.8, 0, 1) : 0; wind = damp(wind, w, w > 0 ? 18 : 6, dt); burst = Math.max(0, burst - dt * 2.4);
    ray = damp(ray, sn === 'ray' ? 1 : 0, sn === 'ray' ? 3 : 7, dt); stg = damp(stg, sn === 'stagger' ? 1 : 0, sn === 'stagger' ? 5 : 1.6, dt);
    const rayK = sn === 'ray' ? clamp(rayT / 4, 0, 1) : 0; // progreso de la carga
    // escudo: aparece con st.sd; si se pierde (o al quedar aturdido) estalla
    const sdOn = !!st.sd && sn !== 'stagger'; if (prevSd && !sdOn) { shards.burst(); shBurst = 1; shFlash = 1; crack = 0; } prevSd = sdOn;
    sdAmt = damp(sdAmt, sdOn ? 1 : 0, 6, dt); shFlash = Math.max(0, shFlash - dt * 2.5); shBurst = Math.max(0, shBurst - dt * 1.6); if (!sdOn) crack = Math.max(0, crack - dt * 0.2); else crack = Math.max(0, crack - dt * 0.03);
    p2 = damp(p2, ph >= 2 ? 1 : 0, 1.4, dt); p3 = damp(p3, ph >= 3 ? 1 : 0, 1.4, dt); const rage = clamp((1 - hp) * 1.25, 0, 1);
    const kick = sKick.step(dt, 0), hk = sHit.step(dt, 0), roll = sRoll.step(dt, Math.sin(t * 0.35 + id) * 0.05);
    const breath = Math.sin(t * (1.3 + rage * 1.5) + id) * 0.5 + 0.5;
    // dirección del rayo (st.a, en mundo → espacio local de root)
    root.updateWorldMatrix(true, false); root.getWorldQuaternion(qa).invert();
    if (st.a) { aimW.set(st.a[0] ?? st.a.x, st.a[1] ?? st.a.y, st.a[2] ?? st.a.z); aimL.copy(aimW).applyQuaternion(qa).normalize(); } else aimL.set(0, 0, 1);

    /* flotar; aturdido: se ladea y cae unos metros */
    const sway = Math.sin(t * 5.3) * 0.02 * rayK + hit * 0.03 * Math.sin(t * 40);
    rig.position.y = Math.sin(t * 0.6 + id) * 0.05 + Math.sin(t * 1.1) * 0.015 - stg * 0.55 + Math.sin(stgT * 2.1) * 0.05 * stg;
    rig.rotation.z = roll * 0.6 + stg * (0.5 + 0.08 * Math.sin(stgT * 1.7)) + sway; rig.rotation.x = Math.sin(t * 0.45 + 1) * 0.03 + kick * 0.05 + stg * 0.32 - ray * 0.05;
    rig.rotation.y = stg * Math.sin(stgT * 0.9) * 0.18;
    body.position.z = -wind * 0.12 + kick * 0.08 - burst * 0.05 - ray * 0.12;
    const bs = 1 + (breath - 0.5) * 0.035 + wind * 0.045 + burst * 0.03 - hit * 0.02 + hk * 0.03 + ray * 0.03 * Math.sin(t * 22) * rayK; body.scale.set(bs * (1 + hit * 0.01) * BS, bs * (1 - wind * 0.03) * BS, bs * BS);

    /* piel: se enrojece y brilla con las fases / el aviso / la carga */
    const heat = Math.max(wind, ray * (0.4 + 0.6 * rayK), burst * 0.6);
    U.uGlow.value = 0.05 + p3 * 0.15 + heat * 0.7 + flashT * 0.3; U.uCrackGlow.value = 0.2 + p2 * 0.3 + p3 * 0.5 + heat * 1.6 - stg * 0.15; U.uVeinGlow.value = 0.12 + p3 * 0.3 + heat * 0.6;
    U.uCry.value = (0.7 + p3 * 0.3 + heat * 1.4 + flashT * 0.8 + 0.12 * Math.sin(t * 4)) * (1 - 0.55 * stg); U.uPulse.value = wind * 0.7 + p3 * 0.2 + ray * 0.5;
    U.uGlowCol.value.setHex(0xff8a20).lerp(dc.setHex(0x70d0ff), ray * rayK * 0.8); U.uHurt.value = U.uHurt.value; UT.uHurt.value = U.uHurt.value; UT.uVeinGlow.value = 0.15 + heat * 0.4; UT.uGlow.value = heat * 0.3;
    shards.mat.userData.u.uHurt.value = 0;

    /* ojo central: se abre al cargar el rayo; aturdido: pesado y desorientado */
    const aimEye = tmp.copy(aimL); const eyeLookDir = sn === 'ray' ? aimEye : look;
    BE.update(dt, stg > 0.3 ? tmp.set(Math.sin(t * 2.2) * 0.8, Math.cos(t * 1.7) * 0.6, 1) : eyeLookDir, { open: clamp(0.78 + wind * 0.2 + ray * 0.22 - hit * 0.4 - (1 - hp) * 0.08 - stg * 0.5, 0.08, 1), pupil: lerp(0.8, 0.4, wind) * (1 - p3 * 0.1) + 0.05 * Math.sin(t * 2 + id) - ray * 0.3 + stg * 0.35, glow: 0.4 + wind * 1.6 + p3 * 0.5 + flashT + ray * 2.5 * (0.4 + rayK), hurt: U.uHurt.value, shake: wind * 0.01 + stg * 0.15, blinkRate: 0.5 + rage + stg * 2, track: 8, brow: 0.18 + ray * 0.2 });
    BE.iris.userData.u.uIris.value.set(color).lerp(dc.setHex(0x80e0ff), ray * 0.8);
    /* ojos del enjambre */
    for (const e of eyeInfo) { const tg = ph >= e.ph ? 1 : 0; e.s = damp(e.s, tg, 3.2, dt); EC.setScale(e.id, e.s * (1 + 0.04 * Math.sin(t * 3 + e.id))); }
    EC.update(dt, sn === 'ray' ? aimL : look, { open: clamp(1 - hit * 0.7 - (1 - hp) * 0.1 + wind * 0.3 - stg * 0.4, 0.2, 1), dilate: 1 - wind * 0.35 - p3 * 0.1 - ray * 0.3 + stg * 0.4, glow: 0.4 + p3 * 0.4 + wind * 1.2 + ray * 1.4, jitter: (1 - wind * 0.9 + rage) * (1 - ray * 0.9) + stg * 6, blinkRate: 0.8 + rage * 1.5 + stg * 2, track: 1 + wind * 2 + ray * 4 - stg * 0.7, maxAng: sn === 'ray' ? 1.7 : stg > 0.3 ? 2.2 : 1.2 });
    /* iris de placas */
    const openP = clamp(0.45 + wind * 0.2 + ray * 0.55 + stg * 0.1, 0, 1);
    for (const P0 of plates) { P0.h2.rotation.x = lerp(1.0, 0.12, openP) + Math.sin(t * 1.6 + P0.off) * 0.04 * (1 - openP * 0.5) + hit * 0.2 * Math.sin(P0.i * 2.3 + t * 25) + stg * 0.15 * Math.sin(stgT * 3 + P0.i); P0.h1.updateMatrix(); P0.h2.updateMatrix(); mA.multiplyMatrices(P0.h1.matrix, P0.h2.matrix); plateIM.setMatrixAt(P0.i, mA); }
    plateIM.instanceMatrix.needsUpdate = true;
    /* boca */
    const mo = clamp(0.12 + breath * 0.1 + wind * 0.85 + burst * 0.5 + hit * 0.4 + p3 * 0.12 + ray * 0.4 + stg * 0.5 + Math.max(0, Math.sin(t * 0.7 + id)) * 0.08, 0, 1); mouth.set(mo);

    /* anillos: giran, se expanden al avisar, se ALINEAN al cargar el rayo (concéntricos al eje del haz) y caen desordenados al aturdirse */
    const spd = (1 + rage * 1.2 + p3 * 0.8 + wind * 5 + burst * 3 + ray * 2.5) * (1 - 0.85 * stg);
    // base de alineación: ejes de los anillos → +z local del haz (rotación del grupo 'tilt' a la dirección aimL)
    const qAim = Q.setFromUnitVectors(new V3(0, 0, 1), aimL);
    rings.forEach((Rg, i) => {
      Rg.spin.rotation.z += dt * Rg.sp * spd;
      const free = new THREE.Euler(Rg.base.x + Math.sin(t * 0.3 + i * 2) * 0.12 + hk * 0.06, Rg.base.y + t * Rg.pre * (1 + rage) + Math.sin(t * 0.5 + i) * 0.1, Rg.base.z);
      const qFree = new THREE.Quaternion().setFromEuler(free);
      const qAl = qAim.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), i * 0.5)); // (el aro está en el plano xy ⇒ eje z)
      Rg.tilt.quaternion.copy(qFree).slerp(qAl, ray * (0.55 + 0.45 * rayK) * (1 - stg));
      if (stg > 0.05) { Rg.tilt.rotation.x += stg * Math.sin(stgT * (1.3 + i * 0.4)) * 0.5; Rg.tilt.rotation.z += stg * Math.cos(stgT * (0.9 + i * 0.3)) * 0.6; }
      const sc = 1 + wind * 0.14 + burst * (0.22 + i * 0.06) + (breath - 0.5) * 0.015 + flashT * 0.12 - ray * 0.06 * rayK + stg * 0.04 * Math.sin(stgT * 5 + i);
      Rg.tilt.scale.setScalar(sc);
    });

    /* tentáculos: serpentean; con la carga se tensan hacia atrás; aturdido: flácidos y colgando */
    for (let i = 0; i < NT; i++) {
      const sp = specs[i]; let amp, spdT, bAmt = 0;
      if (i < NL) { amp = 0.5 + p3 * 0.25 + wind * 0.3 + hit * 0.4 + ray * 0.2; spdT = 1.3 + (i % 4) * 0.15 + rage * 1.1 + wind * 1.2; amp = lerp(amp, 0.1, stg); spdT = lerp(spdT, 0.5, stg); bAmt = stg * 0.9 + ray * 0.15; dirT.set(0, -1, -0.2); }
      else { amp = 0.12 + wind * 0.25 + rage * 0.1; spdT = 2.4; amp = lerp(amp, 0.05, stg); dirT.set(0, -1, 0); bAmt = stg * 0.4; }
      trig.set(i, amp, spdT, dirT, bAmt, 1);
    }

    /* cristales por fases (brotan con rebote) y heridas */
    const grow = (g, v, wob) => { const s = clamp(v, 0, 1.05); g.scale.setScalar(Math.max(0.001, s * (1 + wob * Math.sin(t * 3 + id) + 0.06 * wind))); };
    grow(cl1, 1, 0.025); grow(cl2, p2, 0.03); grow(cl3, p3, 0.04);
    for (let i = 0; i < NW; i++) { const Wd = woundD[i]; Wd.s = damp(Wd.s, ph >= Wd.ph ? 1 : 0, 2.2, dt); Q.setFromUnitVectors(up, Wd.n); const k = Wd.s * (0.7 + 0.3 * Math.sin(t * 4 + i)) * (1 + ray * 0.5); S.set(0.13 * k, 0.018 * k, 0.04 * k); Q.multiply(new THREE.Quaternion().setFromAxisAngle(up, Wd.rot)); P.copy(Wd.p).addScaledVector(Wd.n, 0.01); M.compose(P, Q, S); wounds.setMatrixAt(i, M); }
    wounds.instanceMatrix.needsUpdate = true; woundM.color.setHex(0xff6a20).lerp(colHot, p3).lerp(dc.setHex(0x80e0ff), ray * rayK);
    for (let i = 0; i < NS; i++) { const sd = sacD[i], k = 0.8 + 0.25 * Math.sin(t * (2 + rage * 3) + sd.ph) + wind * 0.3; Q.setFromUnitVectors(up, sd.n); P.copy(sd.p).addScaledVector(sd.n, sd.r * 0.3); S.set(sd.r * k, sd.r * k * 0.9, sd.r * k); M.compose(P, Q, S); sacs.setMatrixAt(i, M); }
    sacs.instanceMatrix.needsUpdate = true; sacM.color.setHex(0x20a8b8).lerp(colHot, p3 * 0.5).multiplyScalar(0.6 + 0.25 * Math.sin(t * 2.2) + wind * 0.6 + rage * 0.3);

    /* escudo de resonancia */
    shield.set({ amt: sdAmt * 0.85, crack: crack, flash: shFlash * 0.8, scale: 1 + shBurst * 0.5 + sdAmt * 0.02 * Math.sin(t * 3) });
    shield.object.rotation.y += dt * 0.15; shards.update(dt, t, { amt: sdAmt * 0.9, spin: 1 + wind * 2 });

    /* rayo: crece desde el ojo en la dirección st.a; los últimos instantes se vuelve blanco-azulado */
    if (ray > 0.02 && sn === 'ray') {
      eyeLens.getWorldPosition(P); body.worldToLocal(P); const k = rayK, flick = 0.85 + 0.15 * Math.sin(t * 50);
      beam.object.position.copy(P); beam.object.quaternion.setFromUnitVectors(new V3(0, 0, 1), aimL.clone().applyQuaternion(rig.quaternion.clone().multiply(body.quaternion).invert()));
      beam.set({ len: 6 + 22 * ease2(k), w: 0.015 + 0.14 * ease2(k) * (k > 0.8 ? 1 : 0.7), a: clamp(ray * (0.15 + 0.85 * k), 0, 1) * flick, k });
    } else beam.set({ a: 0 });
    rayGlow.material.opacity = ray * (0.1 + 0.55 * rayK) * (0.85 + 0.15 * Math.sin(t * 30)); rayGlow.scale.setScalar(0.8 + ray * (0.8 + 2.4 * rayK));
    // partículas de energía que convergen en el ojo durante la carga
    if (sn === 'ray') { emberAcc += dt * (10 + 40 * rayK); while (emberAcc >= 1) { emberAcc -= 1; const a = Math.random() * TAU, el = (Math.random() - 0.3) * 1.2, r = 2.2; tmp.set(Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r + 0.1, Math.sin(a) * Math.cos(el) * r * 0.8 + 0.6); eyeLens.getWorldPosition(P); rig.worldToLocal(P); vel.copy(P).sub(tmp).multiplyScalar(0.9); embers.emit(tmp, vel, 1.1, 0x70d8ff); } }
    // aturdido: humo oscuro, brasas y esquirlas que caen
    if (stg > 0.15) { smokeAcc += dt * 14 * stg; while (smokeAcc >= 1) { smokeAcc -= 1; const a = Math.random() * TAU, r = 0.3 + Math.random() * 0.5; tmp.set(Math.cos(a) * r, 0.5 + Math.random() * 0.2, Math.sin(a) * r - 0.2); vel.set((Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 0.4); smoke.emit(tmp, vel, 1.8, 0x555060); if (Math.random() < 0.6) { vel.set((Math.random() - 0.5) * 1.2, -0.5 - Math.random() * 1.5, (Math.random() - 0.5) * 1.2); embers.emit(tmp, vel, 1.2, 0xff8a30); } } }
    smoke.update(dt, { grow: 0.2, drag: 0.4 }); embers.update(dt, { gravity: sn === 'stagger' ? -1.5 : 0, drag: 0.3 });

    /* halo y esporas */
    halo.material.opacity = 0.1 + wind * 0.22 + burst * 0.2 + p3 * 0.07 + flashT * 0.15 + ray * 0.1; halo.scale.setScalar(4.2 + wind * 1.2 + burst * 1.8 + flashT * 1.0); halo.material.color.copy(colA).lerp(colHot, p3 * 0.45 + wind * 0.2).lerp(dc.setHex(0x60c8ff), ray * rayK * 0.7);
    for (let i = 0; i < NP; i++) { const d = pd[i]; d.a += dt * d.s * (1 + wind * 3 + rage); const rr = d.r * (1 + burst * 0.5 + wind * -0.15) + Math.sin(t + d.h * 9) * 0.06; pp[i * 3] = Math.cos(d.a) * rr; pp[i * 3 + 1] = d.y + Math.sin(t * 0.8 + d.h * 6) * 0.25; pp[i * 3 + 2] = Math.sin(d.a) * rr; const f = 0.15 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2 + d.h * 20)); dc.copy(colA).lerp(colHot, p3 * 0.5).multiplyScalar(f); pc[i * 3] = dc.r; pc[i * 3 + 1] = dc.g; pc[i * 3 + 2] = dc.b; }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
  } };
  function ease2(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
}
