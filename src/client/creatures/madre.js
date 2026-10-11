// MADRE GEODA (jefe M2) — flor / útero colosal. Pétalos de hueso-cristal que se cierran como capullo blindado ('fire': dispara
// espirales; las puntas relampaguean girando al ritmo de los disparos) y se abren como una flor ('open': vulnerable) revelando un núcleo
// de carne húmeda con un ojo grande, una boca y sacos translúcidos con embriones que "paren" racimos. Pétalos internos carnosos,
// tentáculos/raíces, esporas flotantes. Fases por hp: más espinas, heridas brillantes, pétalos rotos y más rabia.
import { cfg } from '../quality.js';
import { bigEye, maw, mergeParts, spikeGeometry, softDot, clamp, lerp, damp, rnd } from './obelisco-lib.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, horn, tentacle, Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const skin = fleshMaterial({ color: 0x7a2c4a, vein: 0x2a0818, spot: color, glow: 0.0, wobble: 0.02, breath: 0.03, spots: 0.5, veins: 1.0, rough: 0.4, sheen: 0.4, scale: 2.4 });
  const wet = fleshMaterial({ color: 0xc0485e, vein: 0x4a0a1c, spot: color, glow: 0.0, wobble: 0.025, breath: 0.04, spots: 0.6, veins: 1.0, rough: 0.22, sheen: 0.5, scale: 2.8 });
  const rootM = fleshMaterial({ color: 0x3a1a2e, vein: 0x12040e, spot: color, glow: 0.0, wobble: 0.015, breath: 0.02, spots: 0.4, veins: 0.8, rough: 0.5, sheen: 0.2, scale: 2.2 });
  const gum = fleshMaterial({ color: 0x8a1c34, vein: 0x300612, spot: 0xff9a50, glow: 0.3, wobble: 0.02, breath: 0.03, spots: 0.2, veins: 0.8, rough: 0.35, scale: 3 });
  const shell = boneMaterial(0x2c4a2e, { rough: 0.25 }), shell2 = boneMaterial(0x4e7a3a, { rough: 0.3 }), fang = boneMaterial(0xf4f0dc, { rough: 0.25 });
  const crystal = bioCrystalMaterial(color, { glow: 0.9 }), crystal2 = bioCrystalMaterial(0xff5ab0, { glow: 0.8 });
  const sacM = new THREE.MeshPhysicalMaterial({ color: 0xffb0c0, roughness: 0.15, transparent: true, opacity: 0.5, emissive: new THREE.Color(0x802040), emissiveIntensity: 0.4, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
  sacM.userData.u = { uHurt: { value: 0 } };
  const embM = new THREE.MeshStandardMaterial({ color: 0x331020, emissive: new THREE.Color(color), emissiveIntensity: 1.2, roughness: 0.3 });

  const root = new THREE.Group(), rig = new THREE.Group(), body = new THREE.Group(); root.add(rig); rig.add(body);

  /* ── núcleo: útero de carne, ojo, boca, sacos con embriones ── */
  const core = blob(wet, 0.5, 1, 1, 1.05); core.position.z = -0.05; body.add(core);
  const back = blob(skin, 0.45, 1, 1, 1.4); back.position.z = -0.45; body.add(back);
  const eyeRoot = new THREE.Group(); eyeRoot.position.set(0, 0.04, 0.4); body.add(eyeRoot);
  const BE = bigEye({ r: 0.24, iris: color, quality: level, lidSkin: wet, scleraColor: 0xf6e8dc }); eyeRoot.add(BE.object);
  const mouth = maw(wet, fang, { w: 0.24, len: 0.22, teeth: LOW ? 5 : 8, tooth: 0.09, inner: gum }); mouth.object.position.set(0, -0.3, 0.32); mouth.object.rotation.x = 0.5; body.add(mouth.object);
  const NS = LOW ? 4 : 5, sacG = new THREE.Group(), sacs = []; body.add(sacG);
  for (let i = 0; i < NS; i++) {
    const a = (i / NS) * Math.PI * 2 + 0.3, g = new THREE.Group(); g.position.set(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.12); sacG.add(g);
    const sac = blob(sacM, 0.2, 0.9, 1.0, 1.1); g.add(sac); const emb = blob(embM, 0.085, 1, 1, 1.3); g.add(emb); sacs.push({ g, sac, emb, a, ph: i * 1.7 });
  }

  /* ── pétalos: exteriores (hueso-cristal) e interiores (carne luminosa) ── */
  const petalGeo = (L, W, T, curl, tip = 0.85) => {
    const g = new THREE.SphereGeometry(1, LOW ? 8 : 14, LOW ? 8 : 14), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), s = (y + 1) / 2, wd = W * Math.pow(Math.sin(Math.PI * Math.pow(s, tip)), 0.8) * (0.55 + 0.45 * Math.sin(s * 2.4 + 0.3));
      pos.setXYZ(i, x * Math.max(0.004, wd), s * L, z * T * (0.3 + wd / W) + curl * s * s * L * 0.55 + (1 - Math.abs(x)) * 0.0 + x * x * 0.08 * s); }
    g.computeVertexNormals(); return g;
  };
  const NP = LOW ? 6 : 8, NI = LOW ? 0 : 6, petals = [], inner = [];
  const gOut = petalGeo(1.15, 0.62, 0.1, 0.5), gOutB = petalGeo(1.0, 0.54, 0.09, 0.45), gIn = petalGeo(0.8, 0.34, 0.07, 0.35);
  for (let i = 0; i < NP; i++) {
    const ang = (i / NP) * Math.PI * 2 + (i % 2) * 0.03, h = new THREE.Group(); h.position.z = -0.38; h.rotation.z = ang; body.add(h);
    const p = new THREE.Group(); p.position.y = 0.26; h.add(p);
    const big = i % 2 === 0, m = new THREE.Mesh(big ? gOut : gOutB, big ? shell : shell2); p.add(m);
    const lin = new THREE.Mesh(big ? gOut : gOutB, wet); lin.scale.set(0.9, 0.93, 0.7); lin.position.z = -0.045; p.add(lin); // forro de carne húmeda por dentro
    const tip = horn(crystal, 0.07, 0.38, 5); tip.position.y = (big ? 1.15 : 1.0) * 0.98; tip.position.z = (big ? 1.15 : 1.0) * 0.55 * 0.97 * 0.45; tip.rotation.x = 0.4; p.add(tip);
    const sp = []; for (let k = 0; k < 2; k++) { const s = horn(crystal2, 0.04, 0.2 + k * 0.04, 4); s.position.set((k ? 1 : -1) * 0.1, 0.5 + k * 0.1, 0.06 + 0.45 * 0.45 * 0.2); s.rotation.x = 0.5; p.add(s); sp.push(s); }
    petals.push({ h, p, m, tip, sp, ang, big, i, off: (rnd() - 0.5) * 0.25 });
  }
  for (let i = 0; i < NI; i++) {
    const ang = ((i + 0.5) / NI) * Math.PI * 2, h = new THREE.Group(); h.position.z = -0.3; h.rotation.z = ang; body.add(h); const p = new THREE.Group(); p.position.y = 0.2; h.add(p);
    p.add(new THREE.Mesh(gIn, wet)); const t = horn(crystal2, 0.05, 0.3, 5); t.position.set(0, 0.8, 0.2); t.rotation.x = 0.4; p.add(t); inner.push({ h, p, t, ang, i });
  }

  /* ── raíces/tentáculos atrás y espinas que brotan por fases ── */
  const tents = [], NT = LOW ? 5 : 9;
  for (let i = 0; i < NT; i++) {
    const a = (i / NT) * Math.PI * 2 + 0.2, len = 2.3 + (i % 3) * 0.5, t = tentacle(rootM, { len, r0: 0.17 - (i % 3) * 0.02, r1: 0.02, hang: true, amp: 0.5, speed: 1.1 + (i % 3) * 0.2, freq: 2.2, phase: i * 2.1 });
    const pv = new THREE.Group(); pv.position.set(Math.cos(a) * 0.28, Math.sin(a) * 0.28, -0.8); pv.quaternion.setFromUnitVectors(V(0, -1, 0), V(Math.cos(a) * 0.6, Math.sin(a) * 0.6, -1).normalize()); pv.add(t); body.add(pv); tents.push({ pv, t });
  }
  const mkCluster = (items, mat, sides = 5) => { const g = new THREE.Group(); g.add(new THREE.Mesh(spikeGeometry(items, sides), mat)); g.scale.setScalar(0.001); body.add(g); return g; };
  const c2 = [], c3 = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c2.push({ p: V(Math.cos(a) * 0.4, Math.sin(a) * 0.4, -0.55), d: V(Math.cos(a), Math.sin(a), -0.5), r: 0.07, h: 0.45 + (i % 3) * 0.15 }); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; c3.push({ p: V(Math.cos(a) * 0.5, Math.sin(a) * 0.5, -0.2), d: V(Math.cos(a), Math.sin(a), -0.8), r: 0.1, h: 0.8 + (i % 2) * 0.3 }); }
  const cl2 = mkCluster(c2, crystal2), cl3 = mkCluster(c3, crystal, 6);

  /* ── luces de disparo (giran al ritmo de las espirales), halo interior y esporas ── */
  const mkSprite = (c, s, o) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.setScalar(s); return sp; };
  const NA = 6, arms = []; for (let i = 0; i < NA; i++) { const s = mkSprite(color, 0.55, 0); body.add(s); arms.push(s); }
  const inGlow = mkSprite(0xff6a90, 2.2, 0); inGlow.position.z = 0.15; body.add(inGlow);
  const halo = mkSprite(color, 4.6, 0.25); rig.add(halo);
  const NSP = LOW ? 20 : 56, pp = new Float32Array(NSP * 3), pc = new Float32Array(NSP * 3), pd = []; for (let i = 0; i < NSP; i++) pd.push({ a: rnd() * 6.28, r: 0.7 + rnd() * 1.1, y: rnd() * 2 - 1, s: 0.1 + rnd() * 0.25, h: rnd(), v: rnd() });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const spores = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.12, map: softDot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); spores.frustumCulled = false; rig.add(spores);

  const mats = [skin, wet, rootM, gum, shell, shell2, fang, crystal, crystal2, sacM, embM, ...BE.mats];
  const sOp = new Spring(0, 120, 11), sHit = new Spring(0, 150, 8), sKick = new Spring(0, 80, 7);
  let op = 0, p2 = 0, p3 = 0, prevS = '', prevHp = 1, hit = 0, prevPh = 1, flashT = 0, shock = 0, birth = 0, fireT = 0;
  const colA = new THREE.Color(color), colHot = new THREE.Color(0xff4a60), dc = new THREE.Color();
  const look0 = new THREE.Vector3(0, 0, 1), P = new THREE.Vector3();
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0, 0.05); const id = st.id || 0, hp = st.hp == null ? 1 : st.hp, ph = hp > 0.66 ? 1 : hp > 0.33 ? 2 : 3, look = ctx.look || look0, isOpen = st.s === 'open' || !!st.o;
    if (ph !== prevPh) { flashT = 1; sKick.v += 4; prevPh = ph; }
    if (hp < prevHp - 0.0005) { hit = Math.min(1, hit + 0.5); sHit.v += 2; } prevHp = hp; hit = Math.max(0, hit - dt * 4); flashT = Math.max(0, flashT - dt * 1.2); shock = Math.max(0, shock - dt * 2.5);
    if (isOpen && prevS !== 'o') { sKick.v += 3; birth = 0; } if (!isOpen && prevS === 'o') { shock = 1; sKick.v -= 4; fireT = 0; } prevS = isOpen ? 'o' : 'c';
    p2 = damp(p2, ph >= 2 ? 1 : 0, 1.4, dt); p3 = damp(p3, ph >= 3 ? 1 : 0, 1.4, dt); const rage = clamp((1 - hp) * 1.25, 0, 1), hurtLow = clamp((0.35 - hp) / 0.35, 0, 1);
    op = damp(op, isOpen ? 1 : 0, isOpen ? 4.2 : 8, dt); const opS = op + sOp.step(dt, 0) * 0.0; // apertura suavizada
    sOp.v += ((isOpen ? 1 : 0) - sOp.x) * 0; const hk = sHit.step(dt, 0), kick = sKick.step(dt, 0);
    if (!isOpen) fireT += dt; if (isOpen) birth += dt;
    const breath = Math.sin(t * (1.1 + rage) + id) * 0.5 + 0.5, cyc = [0, 0.22, 0.17, 0.13][ph];

    /* flotación y respiración */
    rig.position.y = Math.sin(t * 0.5 + id) * 0.04; rig.rotation.z = Math.sin(t * 0.3) * 0.05 + kick * 0.04; rig.rotation.x = Math.sin(t * 0.37) * 0.03;
    const bs = 1 + (breath - 0.5) * 0.03 + shock * 0.04 - hk * 0.03 + kick * 0.02; body.scale.setScalar(bs); body.rotation.z += dt * (0.05 + rage * 0.1) * (isOpen ? 0.2 : 1);

    /* pétalos: onda de apertura, vibración al disparar, rotos/colgando con la salud baja */
    const shoot = isOpen ? 0 : Math.sin((fireT / cyc) * Math.PI * 2) * 0.5 + 0.5;
    petals.forEach((P0) => {
      const delay = P0.i * 0.045, k = sstep(delay, delay + 0.6, opS), over = Math.sin(clamp(opS * 3.14, 0, 3.14)) * 0.0;
      const closed = 1.42 - (P0.i % 2) * 0.05, open = 0.3 + P0.off * 0.6 + hurtLow * 0.25 * (P0.i % 3 === 0 ? 1 : 0);
      const th = lerp(closed, open, k) + (1 - k) * (shoot * 0.03 + Math.sin(t * 40 + P0.i) * 0.004 * (1 + rage)) + hk * 0.1 * Math.sin(P0.i * 2.3 + t * 30) + (k > 0.05 ? Math.sin(t * 1.3 + P0.i) * 0.04 * k : 0);
      P0.p.rotation.x = th; P0.p.rotation.y = Math.sin(t * 0.9 + P0.i) * 0.03 * k + (hurtLow && P0.i % 3 === 0 ? Math.sin(t * 7 + P0.i) * 0.05 : 0); P0.h.position.z = -0.38 + (1 - k) * 0.0;
      P0.p.scale.set(1, 1 + (1 - k) * (breath - 0.5) * 0.03, 1);
      P0.tip.scale.y = 0.38 * (1 + p2 * 0.35 + p3 * 0.5 + 0.1 * Math.sin(t * 4 + P0.i));
      P0.sp.forEach((s, k) => { s.visible = p2 > 0.05; const q = Math.max(0.001, p2); s.scale.set(0.04 * q, (0.2 + k * 0.04) * q, 0.04 * q); });
    });
    inner.forEach((I) => { const k = sstep(0.1 + I.i * 0.03, 0.8 + I.i * 0.03, opS); I.p.rotation.x = lerp(1.5, 0.6 + Math.sin(t * 1.2 + I.i) * 0.06, k); I.h.position.z = -0.3; I.p.visible = true; });

    /* núcleo: ojo, boca, sacos que paren */
    const exp = sstep(0.35, 0.9, opS);
    core.scale.set(0.5 * (1 + (breath - 0.5) * 0.06 + hk * 0.08), 0.5 * (1 + (breath - 0.5) * 0.06 - hk * 0.05), 0.525);
    BE.update(dt, look, { open: clamp(exp * (1 - hit * 0.6) * (0.95 + 0.05 * Math.sin(t)), 0.0, 1) * 0.95 + 0.04, pupil: lerp(1.0, 0.7, 0.5) + 0.12 * Math.sin(t * 4) * exp + p3 * 0.2, glow: 0.4 + exp * (1.0 + 0.6 * Math.sin(t * 3) + p3 * 1.0) + flashT, hurt: skin.userData.u.uHurt.value, shake: hurtLow * 0.05, blinkRate: 0.7 + rage * 1.2, track: 7 });
    const bp = Math.pow(Math.max(0, Math.sin(birth * 2.6)), 3), mo = clamp(exp * (0.25 + 0.55 * bp + 0.2 * breath) + hit * 0.3 * exp, 0, 1); mouth.set(mo);
    sacs.forEach((S, i) => {
      const w = Math.pow(Math.max(0, Math.sin(birth * 2.6 - i * 0.7)), 2), sw = 0.9 + 0.2 * Math.sin(t * 2 + S.ph) + w * 0.35 * exp;
      S.g.position.set(Math.cos(S.a + t * 0.05) * (0.52 + 0.05 * w * exp), Math.sin(S.a + t * 0.05) * (0.52 + 0.05 * w), 0.12 + 0.08 * w * exp); S.g.scale.setScalar(Math.max(0.001, exp) * (0.85 + 0.25 * exp));
      S.sac.scale.set(0.2 * sw * 0.9, 0.2 * sw, 0.22 * sw); S.emb.position.z = 0.03 * w * exp + Math.sin(t * 5 + S.ph) * 0.01; S.emb.scale.set(0.085 * (1 + 0.2 * Math.sin(t * 7 + S.ph)), 0.085 * (1 + 0.25 * Math.sin(t * 6 + S.ph * 2)), 0.11);
    });
    sacM.emissiveIntensity = 0.3 + exp * (0.4 + 0.5 * bp); embM.emissiveIntensity = 0.8 + exp * (1.0 + 1.2 * bp);

    /* materiales: brillo del vientre al abrirse (punto débil) y rabia */
    skin.color.setHex(0x7a2c4a).lerp(dc.setHex(0x9a2438), p3 * 0.6); wet.userData.u.uGlow.value = 0.02 + exp * (0.1 + 0.07 * Math.sin(t * 3.4) + p3 * 0.08) + flashT * 0.12; skin.userData.u.uPulse.value = exp * 0.3 + hurtLow * 0.2; wet.userData.u.uPulse.value = exp * 0.4;
    gum.userData.u.uGlow.value = 0.3 + exp * 0.9 * bp; crystal.userData.u.uGlow.value = 0.9; crystal.emissiveIntensity = 0.5 + (1 - op) * (0.2 + shoot * 0.9) + p3 * 0.3 + flashT + 0.12 * Math.sin(t * 4); crystal2.emissiveIntensity = 0.5 + p2 * 0.4 + p3 * 0.3 + 0.12 * Math.sin(t * 5);
    shell.emissive.setRGB(0.0, 0.1, 0.02).multiplyScalar((1 - op) * (0.3 + shoot * 1.2) + flashT);

    /* destellos de disparo: giran como las espirales (m.t*1.6 rad/s) */
    arms.forEach((s, i) => { const a = t * 1.6 + (i / NA) * Math.PI * 2, r = 0.55; s.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.6 - 0.1 * Math.sin(a * 2)); s.material.opacity = (1 - op) * (0.35 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(a * 2 - fireT * 4), 2)) * (i < ph + 3 ? 1 : 0.0); s.scale.setScalar(0.5 + shoot * 0.35 + p3 * 0.2); s.material.color.copy(colA).lerp(colHot, p3 * 0.6); });
    inGlow.material.opacity = exp * (0.35 + 0.25 * bp + 0.1 * Math.sin(t * 3)) + shock * 0.3; inGlow.scale.setScalar(2.2 + exp * 0.6 + shock * 1.2);
    halo.material.opacity = 0.2 + (1 - op) * 0.12 + exp * 0.15 + shock * 0.3 + flashT * 0.25 + p3 * 0.1; halo.scale.setScalar(4.6 + shock * 1.5 + flashT * 1.0); halo.material.color.copy(colA).lerp(colHot, p3 * 0.5);

    /* tentáculos, cristales por fases */
    tents.forEach((T, i) => { const u = T.t.userData.u; u.uAmp.value = 0.5 + p3 * 0.3 + hit * 0.4 + exp * 0.15; u.uSpeed.value = 1.1 + (i % 3) * 0.2 + rage * 1.0; });
    const gr = (g, v, w) => g.scale.setScalar(Math.max(0.001, clamp(v, 0, 1.05) * (1 + w * Math.sin(t * 3 + id)))); gr(cl2, p2, 0.03); gr(cl3, p3, 0.04);

    /* esporas: más densas y de color al abrirse (la cría) */
    for (let i = 0; i < NSP; i++) { const d = pd[i]; d.a += dt * d.s * (0.6 + exp * 1.2 + rage); d.y += dt * (0.08 + exp * 0.18) * (0.5 + d.v); if (d.y > 1.1) d.y = -1.1; const rr = d.r * (1 + exp * 0.25) + Math.sin(t + d.h * 9) * 0.05;
      pp[i * 3] = Math.cos(d.a) * rr; pp[i * 3 + 1] = d.y; pp[i * 3 + 2] = Math.sin(d.a) * rr; const f = (0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 2 + d.h * 20))) * (1 - Math.abs(d.y) * 0.6); dc.copy(colA).lerp(colHot, p3 * 0.5 + (d.v > 0.7 ? exp * 0.5 : 0)).multiplyScalar(f * (0.5 + exp * 0.8)); pc[i * 3] = dc.r; pc[i * 3 + 1] = dc.g; pc[i * 3 + 2] = dc.b; }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
  } };
}
