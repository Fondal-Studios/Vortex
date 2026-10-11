// PRISMA — volador. Mantarraya-polilla de carne y biocristal: cuerpo blando, alas de membrana translúcida con venas y
// ocelos psicodélicos (dos segmentos con codo que baten con retardo), cola de tentáculos, ojos húmedos que miran.
// Estados: orbit = vuela en círculos / wind = se repliega y brilla (aviso 0.7 s) / dive = alas pegadas, cuerpo estirado.
import { glowSprite, auraShell, isLow, isHigh, damp, clamp, lerp, TAU, NOISE } from './prisma-util.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, blob, horn, crystalSpike, tentacle, eye, jaw, Spring, uTime } = kit;
  const V = THREE.Vector3, Y = new V(0, 1, 0);
  const col = new THREE.Color(color), low = isLow();
  const skin = fleshMaterial({ color: 0x4a1766, vein: 0x1a0430, spot: color, glow: 0.12, wobble: 0.02, breath: 0.025, spots: 0.7, veins: 0.9, iri: 0.35, rough: 0.45, sheen: 0.35 });
  const belly = fleshMaterial({ color: 0xc06a9a, vein: 0x5a1048, spot: color, glow: 0.1, wobble: 0.02, breath: 0.03, spots: 0.4, veins: 1.0, iri: 0.3, rough: 0.5, sheen: 0.35 });
  const bone = boneMaterial(0x2a1038, { rough: 0.3 }), fang = boneMaterial(0xf8ecd8);
  const crystal = bioCrystalMaterial(0x7af4ff, { glow: 0.9 });

  /* ── membrana de ala: shader con venas en abanico, ocelos iridiscentes y borde que flamea ── */
  const wu = { uTime, uHurt: { value: 0 }, uWind: { value: 0 }, uC1: { value: new THREE.Color(0x35107a) }, uC2: { value: col.clone() }, uSide: { value: 0 } };
  const wing = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  wing.userData.u = wu;
  wing.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, wu);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aW; varying vec2 vW; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vW = aW; float edgeK = smoothstep(0.55, 1.0, aW.y) * (0.3 + aW.x);
        transformed.y += sin(uTime * 7.0 - aW.x * 9.0 + aW.y * 3.0) * 0.045 * edgeK;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime,uHurt,uWind; uniform vec3 uC1,uC2; varying vec2 vW; ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float s = vW.x, v = vW.y;
        float l1 = abs(fract(v * 4.0 + sin(s * 4.0) * 0.3 + s * 0.8) - 0.5); float vein = smoothstep(0.455, 0.5, l1);
        float cross = (1.0 - smoothstep(0.455, 0.5, abs(vn(vec3(s * 9.0, v * 6.0, 3.0)) - 0.5))) * 0.55 * smoothstep(0.05, 0.4, v);
        float vv = max(vein * (1.0 - s * 0.5), cross);
        vec2 q = (vec2(s, v) - vec2(0.56, 0.42)) * vec2(1.0, 1.6); float d = length(q);
        float oc = smoothstep(0.32, 0.26, d) + smoothstep(0.12, 0.08, abs(d - 0.2)) * 0.8; float ring = 0.5 + 0.5 * sin(d * 46.0 - uTime * 2.2);
        vec3 irid = pal(d * 2.2 + s * 0.8 + uTime * 0.07 + vn(vec3(s * 6.0, v * 6.0, uTime * 0.2)) * 0.5);
        vec3 base = mix(uC1, uC2, smoothstep(0.1, 1.0, s)); base = mix(base, irid, 0.12 + 0.18 * v);
        diffuseColor.rgb = mix(base, mix(irid, vec3(1.0), ring * 0.4), oc * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.0, 0.1), vv * 0.95);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float fres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
        diffuseColor.a = clamp(0.42 + 0.3 * (1.0 - v) + vv * 0.45 + oc * 0.5 + fres * 0.25, 0.0, 0.95) * (1.0 - smoothstep(0.86, 1.0, v) * 0.5);
        totalEmissiveRadiance += uC2 * (vv * (0.7 + uWind * 3.0) * (0.6 + 0.4 * sin(uTime * 3.0 - s * 8.0)) + oc * (0.4 + ring * 0.7) * (1.0 + uWind * 2.0)) + irid * fres * 0.5 + vec3(1.0, 0.85, 0.7) * uHurt * 0.9;`);
  };
  // planta del ala (mantarraya/polilla): borde de ataque que se curva hacia atrás, borde de fuga festoneado
  const L = 1.45, nx = low ? 4 : 8, nz = low ? 3 : 6;
  const zl = (s) => 0.38 - 0.95 * s * s, zt = (s) => lerp(-0.78, zl(s) - 0.1, Math.pow(s, 1.4));
  function wingGeo(s0, s1) {
    const pos = [], aw = [], idx = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const s = lerp(s0, s1, i / nx), v = j / nz, scal = 0.08 * Math.abs(Math.sin(s * Math.PI * 3.5)) * Math.pow(v, 3);
      pos.push((s - s0) * L, 0.05 * Math.sin(v * Math.PI) - 0.04 * s, lerp(zl(s), zt(s), v) - scal); aw.push(s, v);
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = i * (nz + 1) + j, b = a + nz + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aW', new THREE.Float32BufferAttribute(aw, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  const gIn = wingGeo(0, 0.5), gOut = wingGeo(0.5, 1);
  const place = (m, A, B, r) => { const d = new V().subVectors(B, A), len = d.length(); m.position.copy(A); m.quaternion.setFromUnitVectors(Y, d.normalize()); m.scale.set(r, len, r); return m; };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const wings = [-1, 1].map((side) => {
    const sh = new THREE.Group(); sh.position.set(side * 0.3, 0.1, 0.18); sh.scale.x = side;           // hombro
    const inner = new THREE.Mesh(gIn, wing), el = new THREE.Group(); el.position.set(0.5 * L, 0, zl(0.5)); // codo
    const outer = new THREE.Mesh(gOut, wing); outer.position.z = -zl(0.5); el.add(outer); sh.add(inner, el);
    // huesos: borde de ataque + dedos en abanico (cuelgan de cada segmento)
    sh.add(place(horn(bone, 0.05, 1, 6), new V(0, 0.02, zl(0)), new V(0.5 * L, 0.02, zl(0.5)), 0.05));
    el.add(place(horn(bone, 0.04, 1, 6), new V(0, 0.02, 0), new V(0.5 * L, 0.02, zl(1) - zl(0.5)), 0.04));
    if (!low) {
      sh.add(place(horn(bone, 0.025, 1, 5), new V(0.02, 0.02, zl(0.02)), new V(0.5 * L, 0.0, zt(0.5) + 0.12), 0.022));
      el.add(place(horn(bone, 0.022, 1, 5), new V(0, 0.0, 0), new V(0.5 * L, 0.0, zt(1) - zl(0.5) + 0.05), 0.018));
    }
    const c1 = crystalSpike(crystal, 0.035, 0.17); c1.position.set(0, 0.03, 0); c1.rotation.set(-0.5, 0, -0.2); el.add(c1);
    const c2 = crystalSpike(crystal, 0.025, 0.12); c2.position.set(0.5 * L, 0.03, zl(1) - zl(0.5)); c2.rotation.set(-1.1, 0, -1.2); el.add(c2);
    body.add(sh); return { sh, el, side, c1, c2 };
  });

  /* ── cuerpo: torso blando, vientre claro, cabeza con ojos húmedos, boca, antenas, cola de tentáculos ── */
  const torso = blob(skin, 0.4, 0.9, 0.55, 1.65); body.add(torso);
  const bel = blob(belly, 0.34, 0.78, 0.5, 1.55); bel.position.set(0, -0.12, 0.02); body.add(bel);
  const head = new THREE.Group(); head.position.set(0, 0.02, 0.88); body.add(head);
  head.add(blob(skin, 0.3, 1, 0.9, 1.05));
  const eyes = [], eyeDef = [[-0.2, 0.07, 0.2, 0.15, -0.9], [0.2, 0.07, 0.2, 0.15, 0.9], [0, 0.26, 0.17, 0.065, 0]];
  eyeDef.forEach(([x, y, z, r, ry]) => { const e = eye({ r, iris: color, glow: 0.8 }); e.object.position.set(x, y, z); e.object.rotation.y = ry * 0.55; head.add(e.object); eyes.push({ e, ry: ry * 0.55 }); });
  const mouth = jaw(skin, fang, { w: 0.12, len: 0.15, teeth: 4 }); mouth.object.position.set(0, -0.1, 0.26); mouth.object.rotation.x = 0.1; head.add(mouth.object);
  const ants = [-1, 1].map((sd) => { const a = tentacle(skin, { len: 0.7, r0: 0.03, r1: 0.008, hang: false, amp: 0.1, speed: 3, freq: 4 }); a.position.set(sd * 0.1, 0.24, 0.12); a.rotation.set(Math.PI / 2 - 0.9, 0, -sd * 0.35); head.add(a);
    const tip = blob(crystal, 0.035); tip.position.set(0, 0.7, 0); a.add(tip); return a; });
  // cola: dos tentáculos finos largos + uno central grueso con cristal en la punta
  const tails = [[-0.1, 0.5, 1.5, 0.05], [0.1, 0.5, 1.5, 0.05], [0, 0.55, 1.8, 0.07]].map(([x, amp, len, r0], i) => {
    const t = tentacle(skin, { len, r0, r1: 0.012, hang: false, amp, speed: 2.1 + i * 0.4, freq: 3.4 }); const g = new THREE.Group(); g.position.set(x, -0.04, -0.95); t.rotation.x = -Math.PI / 2; g.add(t); body.add(g); return { g, t };
  });
  const tailTip = crystalSpike(crystal, 0.05, 0.2); tailTip.position.set(0, 1.8, 0); tailTip.rotation.x = 0; tails[2].t.add(tailTip);
  // cristales que brotan del lomo
  const crys = [[0, 0.24, 0.25, 0.06, 0.3, -0.3], [-0.1, 0.22, -0.2, 0.04, 0.2, -0.55], [0.1, 0.22, -0.35, 0.04, 0.18, -0.6], [0, 0.2, -0.6, 0.032, 0.15, -0.8]].map(([x, y, z, r, h, rx]) => { const c = crystalSpike(crystal, r, h); c.position.set(x, y, z); c.rotation.set(rx, 0, x * 1.5); body.add(c); return { c, h }; });
  const halo = glowSprite(color, 3.2, 0.0); halo.position.set(0, 0.1, 0.1); body.add(halo);
  const aura = auraShell(0xaa88ff, 1.5); root.add(aura);

  const mats = [skin, belly, bone, fang, crystal, wing];
  const wl = new Spring(0, 70, 8), wr = new Spring(0, 70, 8), eL = new Spring(0, 40, 6), eR = new Spring(0, 40, 6), tailS = new Spring(0, 45, 5), headY = new Spring(0, 90, 10), headX = new Spring(0, 90, 10);
  let phase = Math.random() * 6, windK = 0, diveK = 0, openT = 0, lastS = '';
  const lk = new V(0, 0, 1), tmp = new V();
  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(Math.max(dt, 0.001), 0.05); const speed = Math.min(1.5, ctx.speed || 0), look = ctx.look || lk;
    const wind = st.s === 'wind', dive = st.s === 'dive', hurt = (st.hp ?? 1) < 0.35, stun = !!st.st;
    windK = damp(windK, wind ? 1 : 0, 12, dt); diveK = damp(diveK, dive ? 1 : 0, 9, dt);
    const tense = Math.max(windK, diveK);
    // batido: más rápido con la velocidad, errático y con ala coja si está herida, lento si está aturdida
    phase += dt * TAU * (1.5 + speed * 1.4) * (stun ? 0.4 : hurt ? 0.75 : 1) * (1 - 0.9 * tense) + (hurt ? Math.sin(t * 9) * dt * 1.5 : 0);
    const amp = 0.62 * (1 - tense) * (stun ? 0.5 : 1), base = Math.sin(phase) * amp + 0.1 - (stun ? 0.35 : 0);
    const tgt = base + windK * (1.0 + Math.sin(t * 42) * 0.035 - base) + diveK * (-0.12 - base);
    const fl = tgt * (hurt ? 0.55 : 1) - (hurt ? 0.18 : 0), fr = tgt;
    const sweep = 0.15 + windK * 0.65 + diveK * 1.3;
    const sl = wl.step(dt, fl * 1.25), sr = wr.step(dt, fr * 1.25);
    wings.forEach((w, i) => {
      const f = i ? fr : fl, spr = i ? sr : sl;
      w.sh.rotation.set(0, sweep, f);
      w.el.rotation.set(0, 0.1 + windK * 0.55 + diveK * 0.25, (spr - f) * 0.85 - 0.12 - windK * 0.65);
    });
    wu.uWind.value = windK;
    // cuerpo: banqueo, rebote con cada aleteo, estiramiento en la picada, repliegue en el aviso
    const bob = Math.sin(phase) * 0.07 * (1 - tense);
    body.position.y = bob; body.rotation.z = Math.sin(t * 0.55 + st.id) * 0.16 * (1 - tense) + (hurt ? Math.sin(t * 3.1) * 0.14 : 0);
    body.rotation.x = diveK * 0.34 - windK * 0.28 + Math.cos(phase) * 0.04;
    const br = 1 + Math.sin(t * 2.3 + st.id) * 0.025;
    body.scale.set(lerp(1, 0.78, diveK) * (1 - 0.06 * windK) * br, lerp(1, 0.8, diveK) * (1 - 0.05 * windK) * br, lerp(1, 1.38, diveK) * (1 + 0.04 * windK));
    // cabeza y ojos siguen al jugador con retardo
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    head.rotation.y = headY.step(dt, clamp(lx, -0.9, 0.9) * 0.7); head.rotation.x = headX.step(dt, -clamp(ly, -0.6, 0.6) * 0.5 + diveK * 0.1);
    openT = damp(openT, dive ? 1 : wind ? 0.45 : 0.08 + 0.05 * Math.sin(t * 2), 10, dt); mouth.set(openT);
    eyes.forEach(({ e, ry }, i) => { tmp.copy(look).applyAxisAngle(Y, -(head.rotation.y + ry)); e.update(dt, tmp, { dilate: dive ? -0.4 : wind ? 0.6 : st.a ? 0.3 : 0, glowMul: 1 + windK * 2 }); });
    ants.forEach((a, i) => { a.rotation.x = Math.PI / 2 - 0.9 + Math.sin(t * 2.6 + i * 2) * 0.16 - diveK * 0.7 + windK * 0.5; a.userData.u.uAmp.value = 0.1 + windK * 0.25; });
    // cola: se arquea con el movimiento, se enrolla en el aviso, se endereza en la picada
    const tp = tailS.step(dt, -Math.cos(phase) * 0.22 * (1 - tense) + windK * 0.9 - diveK * 0.1 + (hurt ? 0.3 : 0));
    tails.forEach((T, i) => { T.g.rotation.x = tp + (i - 1) * 0.02; T.g.rotation.y = Math.sin(t * 1.3 + i * 1.7) * 0.18 * (1 - diveK); T.t.userData.u.uAmp.value = lerp(0.5, 0.95, windK) * (1 - 0.85 * diveK) * (1 + 0.2 * i); T.t.userData.u.uSpeed.value = 2.1 + i * 0.4 + windK * 5; });
    // cristales brotan y se encienden en el aviso; latido de luz
    crys.forEach(({ c, h }, i) => { c.scale.y = h * (1 + 0.1 * Math.sin(t * 4 + i) + windK * 0.9); c.scale.x = c.scale.z *= 1; });
    const pulse = 0.9 + 0.4 * Math.sin(t * 6);
    crystal.userData.u.uGlow.value = pulse + windK * 3; if (crystal.emissiveIntensity !== undefined) crystal.emissiveIntensity = pulse * 0.8 + windK * 2.6;
    skin.userData.u.uGlow.value = 0.16 + windK * 1.3 + diveK * 0.3; skin.userData.u.uPulse.value = windK; belly.userData.u.uGlow.value = 0.1 + windK * 1.0;
    halo.material.opacity = windK * 0.75 + diveK * 0.15; halo.scale.setScalar(2.6 + windK * 1.6 + Math.sin(t * 30) * 0.12 * windK);
    aura.userData.set(st.sd ? 0.7 + 0.2 * Math.sin(t * 4) : 0);
  } };
}
