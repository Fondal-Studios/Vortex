// ESPIRAL — atractor. Nautilo-caracol: concha en espiral logarítmica de biocristal (cámaras que brillan por dentro) y un cuerpo blando
// que asoma por la abertura: capucha húmeda, ojos que miran, corona de tentáculos y una boca-vórtice con dientes.
// Estados: charge (0.8 s) = se encoge y la concha arde / pull (2.6 s) = la boca se abre en vórtice, los tentáculos se estiran hacia el jugador
// y anillos de succión CONVERGEN hacia la boca.
import { soft as blob, bead, auraShell, ringPool, glowSprite, isLow, damp, clamp, lerp, ease, TAU } from './prisma-util.js';

export default function build(kit, color) {
  const { THREE, fleshMaterial, boneMaterial, bioCrystalMaterial, horn, crystalSpike, tentacle, eye, Spring, uTime } = kit;
  const V = THREE.Vector3, low = isLow(), Y = new V(0, 1, 0), Z = new V(0, 0, 1);
  const skin = fleshMaterial({ color: 0xc66aa0, vein: 0x5a1048, spot: 0xffe08a, glow: 0.14, wobble: 0.03, breath: 0.035, spots: 0.7, veins: 0.9, iri: 0.5, rough: 0.42, sheen: 0.5 });
  const tskin = fleshMaterial({ color: 0xb85a96, vein: 0x4a0c3c, spot: 0xffe08a, glow: 0.12, wobble: 0.01, breath: 0.02, spots: 1.0, veins: 0.6, scale: 3.4, rough: 0.4 });
  const shellM = bioCrystalMaterial(0x7a52ff, { glow: 0.35 }), glowM = bioCrystalMaterial(0xff7ae0, { glow: 1.2 }), fang = boneMaterial(0xf6ecd8);
  shellM.forceSinglePass = true; glowM.forceSinglePass = true; shellM.side = THREE.DoubleSide; glowM.side = THREE.DoubleSide; glowM.opacity = 0.6; shellM.opacity = 0.62; glowM.depthWrite = false;

  /* ── concha: tubo en espiral logarítmica (se ensancha hasta la abertura) con costillas de cámara ── */
  const Phi = 3.25 * Math.PI, bb = 0.2, Rend = 0.78, cc = 0.5;
  function shellGeo(scale, segs, radial) {
    const pos = [], nor = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const phi = Phi * i / segs, R = Rend * Math.exp(-bb * (Phi - phi)), rho = R * cc * scale * (1 + 0.06 * Math.cos(phi * 11)), psi = phi - Phi - Math.PI / 2;
      const P = new V(0, R * Math.sin(psi), R * Math.cos(psi)), T = new V(0, R * bb * Math.sin(psi) + R * Math.cos(psi), R * bb * Math.cos(psi) - R * Math.sin(psi)).normalize();
      const N1 = new V(1, 0, 0), N2 = new V().crossVectors(T, N1).normalize();
      for (let j = 0; j <= radial; j++) { const a = j / radial * TAU, n = N1.clone().multiplyScalar(Math.cos(a)).addScaledVector(N2, Math.sin(a)); pos.push(P.x + n.x * rho, P.y + n.y * rho, P.z + n.z * rho); nor.push(n.x, n.y, n.z); }
    }
    for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx); return g;
  }
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const shell = new THREE.Group(); shell.position.set(0, 0.5, -0.38); body.add(shell);
  const sg = shellGeo(1, low ? 36 : 56, low ? 7 : 10);
  shell.add(new THREE.Mesh(sg, shellM)); const inner = new THREE.Mesh(shellGeo(0.8, low ? 36 : 56, low ? 7 : 8), glowM); shell.add(inner);
  const spikes = []; const NSP = low ? 4 : 7;
  for (let i = 0; i < NSP; i++) { const phi = Phi * (0.45 + 0.5 * i / (NSP - 1)), R = Rend * Math.exp(-bb * (Phi - phi)), rho = R * cc, psi = phi - Phi - Math.PI / 2; const dir = new V(0, Math.sin(psi), Math.cos(psi));
    const c = crystalSpike(shellM, 0.05 * (R / Rend + 0.4), 0.2 * (R / Rend + 0.3)); c.position.set((i % 2 ? 0.1 : -0.1), dir.y * (R + rho * 0.95), dir.z * (R + rho * 0.95)); c.quaternion.setFromUnitVectors(Y, dir); shell.add(c); c.userData.h = c.scale.y; spikes.push(c); }
  const shellGlow = glowSprite(0xff9ae8, 2.8, 0.0); shellGlow.position.set(0, 0, 0.2); shell.add(shellGlow);

  /* ── cuerpo blando: capucha, ojos, boca-vórtice con dientes y corona de tentáculos ── */
  const head = new THREE.Group(); head.position.set(0, -0.4, 0.1); body.add(head);
  const mantle = blob(skin, 0.5, 1.0, 0.85, 1.05); mantle.position.set(0, 0, -0.05); head.add(mantle);
  const hood = blob(skin, 0.34, 1.0, 0.7, 0.9); hood.position.set(0, 0.34, 0.12); head.add(hood);
  const eyes = [-1, 1].map((sd) => { const e = eye({ r: 0.16, iris: 0xffd060, glow: 0.8 }); e.object.position.set(sd * 0.4, 0.16, 0.3); e.object.rotation.y = sd * 0.8; head.add(e.object); return { e, ry: sd * 0.8 }; });
  const mouth = new THREE.Group(); mouth.position.set(0, -0.08, 0.5); head.add(mouth);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.ShaderMaterial({
    uniforms: { uTime, uOpen: { value: 0 }, uC: { value: new THREE.Color(0xff7ae0) }, uC2: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime, uOpen; uniform vec3 uC, uC2; varying vec2 vP;
      void main(){ float r = length(vP), a = atan(vP.y, vP.x); float arms = pow(0.5 + 0.5 * sin(a * 3.0 + log(r + 0.04) * 7.0 + uTime * (5.0 + uOpen * 6.0)), 2.0);
        vec3 c = mix(vec3(0.03, 0.0, 0.06), mix(uC2, uC, arms) * (0.6 + arms * 1.6), smoothstep(0.1, 0.55, r) * (0.3 + 0.7 * uOpen));
        float al = smoothstep(1.0, 0.8, r) * clamp(0.55 + uOpen, 0.0, 1.0); gl_FragColor = vec4(c, al);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n }`,
  }));
  throat.position.z = 0.0; mouth.add(throat);
  const NT = low ? 5 : 8, teeth = [];
  for (let i = 0; i < NT; i++) { const g = new THREE.Group(); g.rotation.z = i * TAU / NT; const tt = horn(fang, 0.035, 0.2, 5); g.add(tt); mouth.add(g); teeth.push({ g, tt }); }
  // tentáculos: corona de 10 (6 largos + 4 cortos) alrededor de la boca; cada uno en un pivote que apunta
  const tents = [], NTE = low ? 6 : 10;
  for (let i = 0; i < NTE; i++) { const a = i * TAU / NTE, long = i % 2 === 0, len = long ? 1.9 : 1.2;
    const piv = new THREE.Group(); piv.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.3 - 0.05, 0.3);
    const t = tentacle(tskin, { len, r0: long ? 0.09 : 0.07, r1: 0.01, hang: false, amp: 0.3, speed: 1.6 + (i % 3) * 0.4, freq: 3, phase: i * 0.9 }); piv.add(t);
    const tip = bead(shellM, 0.045); tip.position.y = len; t.add(tip); head.add(piv); tents.push({ piv, t, a, len, long }); }
  const funnel = ringPool(head, 5, color, { plane: 'xy' }), funnel2 = ringPool(head, 3, 0xffd0f2, { plane: 'xy' });
  const aura = auraShell(0xd6c0ff, 1.55); aura.position.y = 0.3; root.add(aura);

  const mats = [skin, tskin, shellM, glowM, fang];
  const hY = new Spring(0, 60, 8), hX = new Spring(0, 60, 8), lungeS = new Spring(0, 50, 7), openS = new Spring(0, 70, 9), shakeS = new Spring(0, 80, 8);
  let phase = Math.random() * 6, aim = 0, openK = 0, lastS = '', chT = 0, plT = 0;
  const tmp = new V(), dir = new V(), q = new THREE.Quaternion();
  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(Math.max(dt, 0.001), 0.05); const look = ctx.look || tmp.set(0, 0, 1), speed = Math.min(1.5, ctx.speed || 0);
    const charge = st.s === 'charge', pull = st.s === 'pull', hurt = (st.hp ?? 1) < 0.35;
    if (st.s !== lastS) { if (charge) chT = 0; if (pull) plT = 0; lastS = st.s; }
    if (charge) chT += dt; if (pull) plT += dt;
    const ck = charge ? ease(chT / 0.8) : 0, pk = pull ? ease(plT / 0.3) * (plT > 2.3 ? Math.max(0, 1 - (plT - 2.3) / 0.3) : 1) : 0;
    phase += dt * (1.2 + speed * 0.6);
    // flota: sube y baja lento; inhala (se encoge) al cargar y succiona con latidos regulares en pull
    const suck = pull ? Math.pow(0.5 + 0.5 * Math.sin(plT * 9), 2) : 0;
    body.position.y = Math.sin(phase) * 0.09 + ck * 0.1; body.rotation.z = Math.sin(phase * 0.6 + st.id) * 0.05 + (hurt ? Math.sin(t * 5) * 0.06 : 0);
    const sh = shakeS.step(dt, (charge ? 0.04 : 0) + (pull ? 0.03 : 0) + (hurt ? 0.02 : 0)); body.position.x = Math.sin(t * 60) * sh;
    // la cabeza gira hacia el jugador (con retardo) y se lanza hacia adelante al succionar
    const lx = Math.atan2(look.x, Math.max(0.15, look.z)), ly = Math.asin(clamp(look.y, -1, 1)), lim = pull || charge ? 1.0 : 0.6;
    head.rotation.y = hY.step(dt, clamp(lx, -lim, lim)); head.rotation.x = hX.step(dt, -clamp(ly, -0.7, 0.7) * 0.8);
    const lg = lungeS.step(dt, pk * 0.25 - ck * 0.18); head.position.z = 0.1 + lg;
    const hs = 1 + Math.sin(t * 2.1 + st.id) * 0.03 - ck * 0.12 + suck * 0.07; head.scale.set(hs * (1 + pk * 0.08), hs, hs * (1 - suck * 0.05));
    // concha: late de luz; arde al cargar, vibra al succionar; la espiral entera "respira"
    const bright = Math.max(ck, pk * 0.9) + (hurt ? 0.3 * Math.sin(t * 13) : 0);
    shell.rotation.x = Math.sin(t * 0.5) * 0.03 + Math.sin(t * 52) * 0.012 * (ck + pk); shell.rotation.z = Math.sin(t * 0.37 + 1) * 0.04;
    const ss = 1 + Math.sin(t * 1.4) * 0.015 + ck * 0.03 + suck * 0.04; shell.scale.setScalar(ss);
    glowM.userData.u.uGlow.value = 1.2 + bright * 3 + 0.3 * Math.sin(t * 2.5); glowM.emissiveIntensity = 1.0 + bright * 2.4 + 0.25 * Math.sin(t * 2.5); shellM.emissiveIntensity = 0.35 + bright * 1.1;
    shellGlow.material.opacity = 0.15 + bright * 0.55; shellGlow.scale.setScalar(2.6 + bright * 1.8);
    spikes.forEach((c, i) => { c.scale.y = c.userData.h * (1 + 0.1 * Math.sin(t * 3 + i) + bright * 0.7); });
    skin.userData.u.uGlow.value = 0.14 + bright * 0.5; skin.userData.u.uPulse.value = suck * 0.6 + ck * 0.3;
    // boca: cerrada en calma → se abre en vórtice (dientes se abren, disco espiral gira)
    openK = openS.step(dt, charge ? ck * 0.45 : pull ? 1 : 0.0); const ok = clamp(openK, -0.1, 1.15);
    const mr = 0.07 + ok * 0.33 + (pull ? suck * 0.04 : 0); throat.scale.setScalar(Math.max(0.001, mr * 1.02)); throat.material.uniforms.uOpen.value = clamp(ok, 0, 1);
    teeth.forEach(({ g, tt }, i) => { tt.position.y = mr; tt.rotation.x = Math.PI / 2 + 0.55 - ok * 0.9; const s = 0.7 + 0.3 * Math.sin(t * 2 + i); tt.scale.set(0.035, 0.2 * (ok > 0.1 ? 1 : 0.8) * s, 0.035); g.rotation.z = i * TAU / teeth.length + t * pull * 3; });
    // anillos de succión: convergen en embudo hacia la boca (en charge, débiles; en pull, intensos)
    funnel.rings.forEach((r, i) => { const w = pull ? 1 : ck * 0.5; const k = ((t * 1.7 + i / 5) % 1); const rad = lerp(3.0, 0.4, k); funnel.set(i, rad, w > 0 ? Math.sin(k * Math.PI) * 0.9 * w : 0); r.position.set(0, -0.08, 0.5 + rad * 1.1); });
    funnel2.rings.forEach((r, i) => { const w = pull ? 1 : 0; const k = ((t * 2.3 + i / 3 + 0.3) % 1); const rad = lerp(2.2, 0.3, k); funnel2.set(i, rad, w > 0 ? Math.sin(k * Math.PI) * 0.6 : 0); r.position.set(0, -0.08, 0.5 + rad * 0.9); r.rotation.z = t * 2 + i; });
    // tentáculos: ondulan en calma; se recogen al cargar; se estiran hacia el jugador (y ondulan menos) en pull
    dir.copy(look).normalize();
    tents.forEach((T, i) => {
      const spread = new V(Math.cos(T.a) * 0.55, Math.sin(T.a) * 0.45 - 0.15 - (hurt ? 0.35 : 0), 1).normalize();
      spread.x += Math.sin(t * 0.8 + T.a * 2) * 0.15; spread.y += Math.cos(t * 0.7 + T.a * 3) * 0.12;
      const curl = new V(Math.cos(T.a) * 0.9, Math.sin(T.a) * 0.9 - 0.2, 0.35).normalize();                  // se enroscan en charge
      const toward = new V(dir.x, dir.y, dir.z).applyAxisAngle(Z, 0).add(new V(Math.cos(T.a) * 0.12, Math.sin(T.a) * 0.12, 0)).normalize();
      tmp.copy(spread).lerp(curl, ck).lerp(toward, pk).normalize();
      // en el espacio de la cabeza el jugador está rotado por la cabeza: convertir
      if (pk > 0) { tmp.copy(spread).lerp(curl, ck); const lh = look.clone().applyAxisAngle(Y, -head.rotation.y).applyAxisAngle(new V(1, 0, 0), -head.rotation.x); tmp.lerp(lh.add(new V(Math.cos(T.a) * 0.12, Math.sin(T.a) * 0.12, 0)).normalize(), pk).normalize(); }
      q.setFromUnitVectors(Y, tmp); T.piv.quaternion.slerp(q, 1 - Math.exp(-(pull ? 10 : 5) * dt));
      const stretch = 1 + pk * 0.55 - ck * 0.3 + suck * 0.08; T.piv.scale.set(1 - pk * 0.12, stretch, 1 - pk * 0.12);
      const u = T.t.userData.u; u.uAmp.value = (0.34 * (1 - pk * 0.7) + ck * 0.1 + (hurt ? 0.2 : 0)) * (T.long ? 1 : 0.8); u.uSpeed.value = 1.6 + ck * 4 + suck * 3;
    });
    eyes.forEach(({ e, ry }, i) => { tmp.copy(look).applyAxisAngle(Y, -(head.rotation.y + ry)); e.update(dt, tmp, { dilate: charge ? 0.4 : pull ? -0.3 : st.a ? 0.3 : 0, glowMul: 1 + bright }); });
    aura.userData.set(st.sd ? 0.65 + 0.2 * Math.sin(t * 4) : 0);
  } };
}
