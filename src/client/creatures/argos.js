// ARGOS, EL OJO PRIMORDIAL (jefe M3, «Laberinto Celestial») — un ojo cósmico gigante que flota. Globo húmedo con venas (shader propio,
// ver ojo.js), iris enorme psicodélico (fibras que giran, ondas que se contraen hacia la pupila), pupila que dilata y sigue al jugador,
// párpados de carne con borde grueso, almohadillas de carne alrededor, tres coronas de espinas de cristal que brotan por fases, nervio
// óptico (tentáculos) colgando por detrás, anillos-halo y un ESCUDO facetado de cristal que lo cubre mientras haya ojos orbitando.
// Estados (st.s): 'gaze' = carga la mirada 2,5 s (pupila se achica, iris rojo/blanco, ojo abierto de par en par y vibrando);
// 'stagger' = aturdido 9 s (párpado a medias, tembloroso, apagado, sin escudo, vulnerable). st.sd = escudo activo.
// Unidades del modelo: globo radio 0.92; con escala m.r (6.5) mide ~6 en el mundo; las espinas llegan a ~1.5.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cfg } from '../quality.js';
import { eyeballMaterial, ballGeo, softDot, shared } from './ojo.js';

const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const Z = new THREE.Vector3(0, 0, 1);
const rndMake = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Anillo de espinas de cristal en el plano XY (apuntan hacia afuera y un poco hacia atrás). */
function spikeRing(n, radius, z, hMin, hMax, rBase, sides, seed) {
  const rnd = rndMake(seed), parts = [], up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.12, h = hMin + (hMax - hMin) * (0.3 + 0.7 * rnd()) * (i % 2 ? 1 : 0.7);
    const c = new THREE.ConeGeometry(rBase * (0.8 + 0.5 * rnd()), h, sides, 1); c.translate(0, h / 2, 0);
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), -0.12 - 0.2 * rnd()).normalize(), q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z), q, new THREE.Vector3(1, 1, 1)));
    parts.push(c.toNonIndexed());
  }
  return mergeGeometries(parts, false);
}

const SHIELD_V = `varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vP = mv.xyz; gl_Position = projectionMatrix * mv; }`;
const SHIELD_F = `varying vec3 vP; uniform float uTime,uK,uFlash; uniform vec3 uCol;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){
  vec3 n = normalize(cross(dFdx(vP), dFdy(vP))); vec3 v = normalize(-vP); float f = abs(dot(n, v));
  float id = h31(floor(n * 6.0 + 20.0)); float shimmer = 0.5 + 0.5 * sin(uTime * 1.6 + id * 25.0);
  vec3 pal = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + id * 0.5 + uTime * 0.05));
  vec3 c = mix(uCol, pal, 0.55);
  float a = (0.07 + 0.42 * pow(1.0 - f, 2.0) + 0.16 * shimmer * id) + uFlash * 0.4;
  gl_FragColor = vec4(c * (0.8 + uFlash * 1.5), a * uK);
}`;

export default function build(kit, color) {
  color = color == null ? 0xff4fa8 : color;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const R = 0.92;
  const root = new THREE.Group(), rig = new THREE.Group(), body = new THREE.Group(); root.add(rig); rig.add(body);

  /* ── materiales ── */
  const lidM = kit.fleshMaterial({ color: 0x8a3050, vein: 0x300612, spot: 0x602040, glow: 0.0, wobble: 0.012, breath: 0.03, spots: 0.08, veins: 1.0, rough: 0.34, sheen: 0.5, scale: 2.2 });
  const foldM = kit.fleshMaterial({ color: 0x4a1840, vein: 0x14030f, spot: 0x401030, glow: 0.0, wobble: 0.018, breath: 0.03, spots: 0.1, veins: 0.9, rough: 0.42, sheen: 0.3, scale: 2.0 });
  const nerveM = kit.fleshMaterial({ color: 0x5a2050, vein: 0x1a0418, spot: 0x401030, glow: 0.0, wobble: 0.02, breath: 0.04, spots: 0.1, veins: 1.0, rough: 0.4, sheen: 0.3, scale: 2.2 });
  const crystA = kit.bioCrystalMaterial(0xff5ac8, { glow: 0.8 }), crystB = kit.bioCrystalMaterial(0x4fd8ff, { glow: 0.9 }), crystC = kit.bioCrystalMaterial(0xffc040, { glow: 1.0 });
  const ballM = eyeballMaterial({ color, irisAng: 0.8, fib: 26 });
  const U = ballM.uniforms;

  /* ── globo + iris (UNA malla pintada por shader) ── */
  const ballG = new THREE.Group(); body.add(ballG);
  const ball = new THREE.Mesh(ballGeo(LOW), ballM); ball.scale.setScalar(R); ballG.add(ball);
  const chargeM = new THREE.SpriteMaterial({ map: softDot(), color: 0xff6a40, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const charge = new THREE.Sprite(chargeM); charge.position.z = R * 1.02; ballG.add(charge);

  /* ── párpados (hemisferios de carne con borde grueso) ── */
  const lidSeg = LOW ? [16, 6] : HI ? [30, 10] : [22, 8];
  const lidGeo = shared(`alid${lidSeg}`, () => new THREE.SphereGeometry(1, lidSeg[0], lidSeg[1], 0, Math.PI * 2, 0, Math.PI / 2));
  const rimGeo = shared(`arim${LOW}`, () => { const g = new THREE.TorusGeometry(1, 0.075, LOW ? 6 : 10, LOW ? 24 : 40); g.rotateX(Math.PI / 2); return g; });
  const mkLid = (flip) => { const g = new THREE.Group(), m = new THREE.Mesh(lidGeo, lidM), rim = new THREE.Mesh(rimGeo, foldM); g.add(m, rim); g.scale.set(R * 1.06, R * 1.06 * (flip ? -1 : 1), R * 1.06); body.add(g); return g; };
  const lidUp = mkLid(false), lidDn = mkLid(true);

  /* ── almohadillas de carne alrededor (pliegues) ── */
  const foldParts = [], NF = LOW ? 8 : 12, rf = rndMake(77);
  for (let i = 0; i < NF; i++) {
    const a = (i / NF) * Math.PI * 2 + 0.2, g = new THREE.SphereGeometry(1, 8, 6); const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(Z, a), s = V(0.34 + rf() * 0.14, 0.12 + rf() * 0.06, 0.2);
    m.compose(V(Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1, -0.22), q, s); g.applyMatrix4(m); foldParts.push(g.toNonIndexed());
  }
  { const g = new THREE.SphereGeometry(1, 14, 10); g.applyMatrix4(new THREE.Matrix4().compose(V(0, 0, -0.62), new THREE.Quaternion(), V(0.98, 0.98, 0.5))); foldParts.push(g.toNonIndexed()); }
  const folds = new THREE.Mesh(mergeGeometries(foldParts, false), foldM); body.add(folds);

  /* ── coronas de espinas de cristal (3 anillos que brotan por fase) ── */
  const mkCrown = (n, radius, z, hMin, hMax, rb, mat, seed, sides = 5) => { const pv = new THREE.Group(), m = new THREE.Mesh(spikeRing(n, radius, z, hMin, hMax, rb, sides, seed), mat); pv.add(m); body.add(pv); return pv; };
  const crowns = [
    { g: mkCrown(LOW ? 14 : 20, R * 1.2, -0.2, 0.4, 0.9, 0.08, crystA, 11), sp: 0.07, ph: 1 },
    { g: mkCrown(LOW ? 12 : 18, R * 1.3, -0.36, 0.5, 1.1, 0.09, crystB, 23, 6), sp: -0.05, ph: 2 },
    { g: mkCrown(LOW ? 10 : 14, R * 1.4, -0.52, 0.6, 1.3, 0.1, crystC, 37, 6), sp: 0.035, ph: 3 },
  ];

  /* ── anillos-halo (finos, aditivos) y halo grande detrás ── */
  const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const rings = [[2.6, 0.02, ringMat, 0.55, 0.3], [3.1, 0.014, ringMat2, 0.85, -0.5], [2.3, 0.012, ringMat, 0.35, 0.9]].slice(0, LOW ? 2 : 3).map(([rad, tube, mat, tilt, sp]) => {
    const tl = new THREE.Group(), m = new THREE.Mesh(shared(`arg-ring${rad}${LOW}`, () => new THREE.TorusGeometry(rad, tube, 4, LOW ? 48 : 90)), mat); tl.add(m); tl.rotation.x = tilt; tl.rotation.y = tilt * 0.6; rig.add(tl); return { tl, m, sp };
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); halo.position.z = -0.9; halo.scale.setScalar(7.5); rig.add(halo);

  /* ── nervio óptico y tentáculos colgando por detrás ── */
  const tents = [], NT = LOW ? 5 : 9;
  { const t = kit.tentacle(nerveM, { len: 3.4, r0: 0.3, r1: 0.05, hang: true, amp: 0.35, speed: 1.0, freq: 2.2, phase: 0.5 }); const pv = new THREE.Group(); pv.position.set(0, -0.45, -0.6); pv.rotation.x = 0.28; pv.add(t); body.add(pv); tents.push({ t, base: 0.35 }); }
  for (let i = 0; i < NT; i++) {
    const a = Math.PI + (i / (NT - 1) - 0.5) * 2.9 + Math.PI * 0.0, len = 2.3 + (i % 3) * 0.55, t = kit.tentacle(nerveM, { len, r0: 0.11 - (i % 3) * 0.015, r1: 0.016, hang: true, amp: 0.6, speed: 1.3 + (i % 4) * 0.15, freq: 2.5, phase: i * 1.9 });
    const pv = new THREE.Group(), ax = Math.sin(a) * 0.6, d = V(Math.sin(a + Math.PI) * 0.0 + (i / (NT - 1) - 0.5) * 1.5, -1, -0.5 - 0.15 * (i % 2)).normalize();
    pv.position.set((i / (NT - 1) - 0.5) * 1.5, -0.55 + Math.abs(i / (NT - 1) - 0.5) * 0.45, -0.5); pv.quaternion.setFromUnitVectors(V(0, -1, 0), d); void ax; pv.add(t); body.add(pv); tents.push({ t, base: 0.6 });
  }

  /* ── escudo facetado de cristal ── */
  const shM = new THREE.ShaderMaterial({ vertexShader: SHIELD_V, fragmentShader: SHIELD_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: kit.uTime, uK: { value: 1 }, uFlash: { value: 0 }, uCol: { value: new THREE.Color(color) } } });
  const shGeo = shared(`ash${LOW}`, () => new THREE.IcosahedronGeometry(1, LOW ? 1 : 2));
  const shield = new THREE.Mesh(shGeo, shM); shield.scale.setScalar(R * 1.62); shield.frustumCulled = false; rig.add(shield);
  const shEdgeM = new THREE.LineBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const shEdges = new THREE.LineSegments(shared(`ashe${LOW}`, () => new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1, LOW ? 1 : 2), 1)), shEdgeM); shield.add(shEdges);

  /* ── esporas ── */
  const NP = LOW ? 24 : 70, pp = new Float32Array(NP * 3), pc = new Float32Array(NP * 3), pd = [], rp = rndMake(5);
  for (let i = 0; i < NP; i++) pd.push({ a: rp() * 6.28, r: 1.7 + rp() * 1.6, y: (rp() - 0.5) * 3.2, s: 0.1 + rp() * 0.25, h: rp() });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const motes = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.2, map: softDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); motes.frustumCulled = false; rig.add(motes);

  const mats = [lidM, foldM, nerveM, crystA, crystB, crystC, ballM, shM, ringMat, ringMat2, shEdgeM, chargeM, halo.material, motes.material];
  const sKick = new kit.Spring(0, 90, 7), sHit = new kit.Spring(0, 140, 8);
  let p2 = 0, p3 = 0, prevPh = 1, prevHp = 1, hit = 0, flashT = 0, prevS = '', gt = 0, gz = 0, recoil = 0, stag = 0, shieldK = 1, prevSd = true, shBurst = 0;
  let lastHurt = 0, open = 0.85, blinkT = 2, blink = 0, pupS = 0.42, shakeX = 0, shakeY = 0;
  const tq = new THREE.Quaternion(), d = new THREE.Vector3(), inv = new THREE.Matrix4(), dc = new THREE.Color();
  const colA = new THREE.Color(color), colHot = new THREE.Color(0xff3a20), tintLid = new THREE.Color(0x8a3050), tintRage = new THREE.Color(0xb02a3a);

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0, 0.05); const id = st.id || 0, hp = st.hp == null ? 1 : st.hp, ph = hp > 0.66 ? 1 : hp > 0.33 ? 2 : 3, rage = clamp((1 - hp) * 1.25, 0, 1);
    const sn = st.s, look = ctx.look || Z, sdOn = st.sd !== false;
    if (ph !== prevPh) { flashT = 1; sKick.v += 5; prevPh = ph; }
    if (hp < prevHp - 0.0005) { hit = Math.min(1, hit + 0.5); sHit.v += 2; } prevHp = hp; hit = Math.max(0, hit - dt * 4); flashT = Math.max(0, flashT - dt * 1.2);
    if (sn !== prevS) { if (sn === 'gaze') gt = 0; if (prevS === 'gaze') { recoil = 1; sKick.v -= 7; } prevS = sn; }
    if (sn === 'gaze') gt += dt;
    const gTarget = sn === 'gaze' ? clamp(gt / 2.5, 0, 1) : 0; gz = damp(gz, gTarget, gTarget > gz ? 10 : 5, dt); recoil = Math.max(0, recoil - dt * 2.5);
    stag = damp(stag, sn === 'stagger' || st.st ? 1 : 0, 3, dt);
    if (sdOn !== prevSd) { if (!sdOn) shBurst = 1; prevSd = sdOn; } shBurst = Math.max(0, shBurst - dt * 1.8); shieldK = damp(shieldK, sdOn ? 1 : 0, sdOn ? 2.5 : 9, dt);
    p2 = damp(p2, ph >= 2 ? 1 : 0, 1.4, dt); p3 = damp(p3, ph >= 3 ? 1 : 0, 1.4, dt);
    const kick = sKick.step(dt, 0), hk = sHit.step(dt, 0), cg = gz * gz, a = 1 - stag;

    /* flotar / vibrar */
    const trem = (stag * 0.012 + cg * 0.018 + hit * 0.01);
    shakeX = (Math.random() - 0.5) * trem; shakeY = (Math.random() - 0.5) * trem;
    rig.position.set(shakeX, Math.sin(t * 0.5 + id) * 0.07 - stag * 0.18 + shakeY, 0); rig.rotation.x = Math.sin(t * 0.37 + 1) * 0.03 + kick * 0.05 + stag * 0.16; rig.rotation.z = Math.sin(t * 0.29 + id) * 0.04 + (stag ? Math.sin(t * 7) * 0.012 * stag : 0);
    body.position.z = -cg * 0.14 + kick * 0.1 + recoil * 0.12; const bs = 1 + Math.sin(t * (1.2 + rage) + id) * 0.018 + cg * 0.05 + hit * -0.02 + hk * 0.03; body.scale.setScalar(bs);

    /* mirada: sigue al jugador (cámara); durante el rayo apunta a su objetivo (st.a, en mundo) */
    d.copy(look);
    if (sn === 'gaze' && st.a && root.parent) { const A = Array.isArray(st.a) ? st.a : [st.a.x, st.a.y, st.a.z]; if (isFinite(A[0] + A[1] + A[2])) { root.updateWorldMatrix(true, false); inv.copy(root.matrixWorld).invert(); const w = V(A[0], A[1], A[2]).transformDirection(inv); if (w.lengthSq() > 0.1) d.lerp(w, 0.85); } }
    d.normalize(); if (d.z < 0.3) { d.z = 0.3; d.normalize(); }
    tq.setFromUnitVectors(Z, d); ballG.quaternion.slerp(tq, 1 - Math.exp(-(sn === 'gaze' ? 14 : 6) * dt));
    if (cg > 0.05) ballG.rotation.z += (Math.random() - 0.5) * cg * 0.06;

    /* párpados */
    blinkT -= dt * (0.5 + rage) * a; if (blinkT <= 0) { blink = 1; blinkT = 2.5 + Math.random() * 4; } blink = Math.max(0, blink - dt * 5); const bl = Math.sin(Math.min(1, blink) * Math.PI);
    const tOpen = sn === 'gaze' ? 1.0 : stag > 0.5 ? 0.68 + 0.04 * Math.sin(t * 5) : clamp(0.95 - (1 - hp) * 0.05 - hit * 0.35, 0.2, 1);
    open = damp(open, tOpen, 8, dt); const o = clamp(open * (1 - bl * a) + (stag * 0.0), 0, 1);
    lidUp.rotation.x = lerp(1.5, -1.45, o); lidDn.rotation.x = lerp(-1.5, 1.15, o);

    /* iris y pupila */
    const pTarget = sn === 'gaze' ? lerp(0.42, 0.12, gz) : stag > 0.5 ? 0.62 : 0.42 + 0.05 * Math.sin(t * 1.3 + id) + rage * 0.04;
    pupS = damp(pupS, pTarget, sn === 'gaze' ? 10 : 4, dt); U.uPup.value = pupS;
    U.uHot.value = Math.pow(gz, 1.4); U.uDim.value = stag * 0.55; U.uVein.value = 0.75 + rage * 0.6 + gz * 0.5; U.uVuln.value = stag * (0.55 + 0.4 * Math.sin(t * 5)); U.uPhase.value = ph - 1 + p3;
    const ext = U.uHurt.value !== lastHurt ? U.uHurt.value : 0; lastHurt = Math.max(ext, hit * 0.7, flashT * 0.5); U.uHurt.value = lastHurt;
    kit.setHurt([lidM, foldM, nerveM, crystA, crystB, crystC], Math.max(lidM.userData.u.uHurt ? lidM.userData.u.uHurt.value : 0, hit * 0.7));
    chargeM.opacity = cg * 0.9; charge.scale.setScalar(0.4 + cg * 2.0 + Math.sin(t * 30) * 0.05 * cg);

    /* carne: se enrojece con las fases / la mirada */
    lidM.color.copy(tintLid).lerp(tintRage, p3 * 0.6 + gz * 0.4).multiplyScalar(0.55 + 0.45 * a);
    lidM.userData.u.uGlow.value = 0.02 + cg * 0.25 + p3 * 0.06 + flashT * 0.1; foldM.userData.u.uGlow.value = 0.01 + cg * 0.12 + p3 * 0.04; foldM.color.setHex(0x4a1840).multiplyScalar(0.6 + 0.4 * a);
    folds.scale.setScalar(1 + Math.sin(t * 1.4 + id) * 0.02 + cg * 0.06); nerveM.color.setHex(0x5a2050).multiplyScalar(0.6 + 0.4 * a);

    /* coronas: brotan por fase, giran; se encienden al cargar y se apagan aturdido */
    crowns.forEach((C, i) => { const g = C.ph === 1 ? 1 : C.ph === 2 ? p2 : p3; C.g.rotation.z += dt * C.sp * (1 + cg * 6 + rage) * (0.3 + 0.7 * a); const s = Math.max(0.001, clamp(g, 0, 1.05) * (1 + 0.03 * Math.sin(t * 2 + i) + cg * 0.1) * (0.92 + 0.08 * a)); C.g.scale.set(s, s, 1); });
    crystA.emissiveIntensity = (0.4 + cg * 1.4 + flashT * 0.8 + 0.12 * Math.sin(t * 3)) * (0.35 + 0.65 * a); crystB.emissiveIntensity = (0.45 + cg * 1.2 + 0.14 * Math.sin(t * 4 + 1)) * (0.35 + 0.65 * a); crystC.emissiveIntensity = (0.5 + cg * 1.6 + 0.16 * Math.sin(t * 5 + 2)) * (0.35 + 0.65 * a);

    /* tentáculos: serpentean; casi laxos al estar aturdido */
    tents.forEach((T, i) => { const u = T.t.userData.u; u.uAmp.value = (T.base + p3 * 0.2 + cg * 0.35 + hit * 0.4) * (0.35 + 0.65 * a); u.uSpeed.value = (1 + (i % 4) * 0.15 + rage * 1.0 + cg * 2) * (0.5 + 0.5 * a); const m = T.t.userData.mat; if (m) m.color.copy(nerveM.color); });

    /* anillos-halo */
    rings.forEach((Rg, i) => { Rg.tl.rotation.z += dt * Rg.sp * (1 + cg * 5 + rage * 0.5); Rg.m.scale.setScalar(1 + cg * 0.1 + shBurst * 0.2 + Math.sin(t + i) * 0.01); });
    ringMat.opacity = (0.45 + cg * 0.4 + flashT * 0.3) * (0.25 + 0.75 * a); ringMat.color.copy(colA).lerp(colHot, cg * 0.8 + p3 * 0.3); ringMat2.opacity = 0.35 * (0.2 + 0.8 * a);
    halo.material.opacity = (0.25 + cg * 0.5 + p3 * 0.1 + flashT * 0.25 + shBurst * 0.2) * (0.3 + 0.7 * a); halo.scale.setScalar(7.5 + cg * 2.2 + shBurst * 2 + flashT * 1.0); halo.material.color.copy(colA).lerp(colHot, cg * 0.85 + p3 * 0.2);

    /* escudo: cubre el ojo; al romperse destella y se esfuma */
    shM.uniforms.uK.value = shieldK; shM.uniforms.uFlash.value = shBurst + flashT * 0.2 + hit * 0.5 * shieldK; shield.visible = shieldK > 0.01;
    shield.scale.setScalar(R * (1.62 + shBurst * 0.5 - (1 - shieldK) * 0.08) * (1 + 0.012 * Math.sin(t * 1.9))); shield.rotation.y += dt * 0.08; shield.rotation.x += dt * 0.03;
    shEdgeM.opacity = 0.5 * shieldK * (0.8 + 0.2 * Math.sin(t * 3) + shBurst); shEdgeM.color.setHex(0xbfe8ff).lerp(dc.setHex(0xff9a80), cg * 0.5);

    /* esporas */
    for (let i = 0; i < NP; i++) { const q = pd[i]; q.a += dt * q.s * (1 + cg * 4 + rage); const rr = q.r * (1 - cg * 0.18 + shBurst * 0.4) + Math.sin(t + q.h * 9) * 0.08; pp[i * 3] = Math.cos(q.a) * rr; pp[i * 3 + 1] = q.y + Math.sin(t * 0.7 + q.h * 6) * 0.3; pp[i * 3 + 2] = Math.sin(q.a) * rr - 0.2; const f = (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 2 + q.h * 20))) * (0.35 + 0.65 * a); dc.copy(colA).lerp(colHot, cg * 0.8).multiplyScalar(f); pc[i * 3] = dc.r; pc[i * 3 + 1] = dc.g; pc[i * 3 + 2] = dc.b; }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
  } };
}
