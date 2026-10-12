// ESPIRAL — atractor. Nautilo-caracol: concha en espiral logarítmica de quitina oscura con costillas de cámara y cresta de cristales (las cámaras
// brillan por dentro) y un cuerpo blando que asoma por la abertura: capucha húmeda, ojos de cámara, corona de tentáculos y una boca-vórtice con dientes.
// Estados: charge (0.8 s) = se encoge y la concha arde / pull (2.6 s) = la boca se abre en vórtice, los tentáculos se estiran hacia el jugador
// y anillos de succión CONVERGEN hacia la boca.
import * as THREE from 'three';
import { cfg } from '../quality.js';
import { auraShell, glowSprite } from './prisma-util.js';
import { bioMaterial } from './obelisco-mat.js';
import { eyeCluster, ringBank, clamp, lerp, damp } from './obelisco-lib.js';
import { V3, paint, place, aimY, merge, loft, line, prof, blobGeo, spikes, crystals, tentacleBundle, tentacleRig, sstep } from './obelisco-geo.js';
import { uTime } from '../shaders.js';

const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const TAU = Math.PI * 2;

export default function build(kit, color) {
  const { Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const R = LOW ? 8 : HI ? 18 : 12;
  const bioS = bioMaterial({ glow: 0xff5ad0, vein: 0x10062a, rim: 0x6a4aff, scale: 0.9, bump: 1.1, wet: 0.3, ridge: 160, sheen: 0.1, metal: 0.2, breath: 0 }); const US = bioS.userData.u; US.uCrackGlow.value = 0.35;
  const bioB = bioMaterial({ glow: 0xffc860, vein: 0x12041a, rim: 0x6a2a68, scale: 3.0, bump: 0.8, wet: 0.7, sheen: 0.2, breath: 0.02 }); const UB = bioB.userData.u; UB.uVeinGlow.value = 0.12;
  const NTE = LOW ? 6 : 10;
  const bioT = bioMaterial({ glow: 0xffc860, vein: 0x12041a, rim: 0x6a2a68, scale: 4.0, tent: NTE, breath: 0 }); const UT = bioT.userData.u; UT.uVeinGlow.value = 0.12;
  const SHELL = 0x3a2a78, SHELL2 = 0x5c46b0, FLESH = 0x3c1236;

  /* ── concha: tubo en espiral logarítmica (se ensancha hasta la abertura) con costillas de cámara ── */
  const Phi = 3.25 * Math.PI, bb = 0.2, Rend = 0.78, cc = 0.5, R0 = Rend * Math.exp(-bb * Phi);
  const spiralPt = (phi, off = 0) => { const Rr = Rend * Math.exp(-bb * (Phi - phi)) + off, psi = phi - Phi - Math.PI / 2; return new V3(0, Rr * Math.sin(psi), Rr * Math.cos(psi)); };
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.scale.setScalar(1.4); // un poco más grande que la unidad: se lee a 20–30 m (el hitscan del sim es generoso: 1.05·r + 0.35)
  const shell = new THREE.Group(); shell.position.set(0, 0.5, -0.38); body.add(shell);
  const NSEG = LOW ? 40 : 90;
  const pts = []; for (let i = 0; i <= 60; i++) pts.push(spiralPt(Phi * i / 60));
  const rho = (t) => (R0 + t * (Rend - R0)) * cc;
  { const sp = [];
    const outer = loft(pts, { seg: NSEG, radial: R, r: (t) => rho(t) * (1 + 0.1 * sstep(0.94, 1, t)), mod: (t, a) => (1 + 0.05 * Math.sin(t * (LOW ? 60 : 110))) * (1 + 0.045 * Math.sin(a * 6)), round: [0.03, 0] });
    sp.push(paint(outer, SHELL, 1, 0, (p, n, uv) => ({ c: new THREE.Color(SHELL).lerp(new THREE.Color(SHELL2), 0.5 + 0.5 * Math.sin(uv[1] * 40 + uv[0] * 6.3 * 1)), k: 0.8 + 0.6 * uv[1], g: 0.2 * Math.pow(0.5 + 0.5 * Math.sin(uv[1] * (LOW ? 60 : 110)), 6) })));
    // cresta de cristales sobre el borde exterior de la espiral
    const items = []; const NSP = LOW ? 7 : 12;
    for (let i = 0; i < NSP; i++) { const t = 0.35 + 0.62 * i / (NSP - 1), phi = Phi * t, Rr = Rend * Math.exp(-bb * (Phi - phi)), rr = rho(t), psi = phi - Phi - Math.PI / 2; const dir = new V3(0, Math.sin(psi), Math.cos(psi)); const sx = (i % 2 ? 0.14 : -0.14) * (Rr / Rend);
      items.push({ p: new V3(sx, dir.y * (Rr + rr * 0.92), dir.z * (Rr + rr * 0.92)), d: dir.clone().add(new V3(sx * 3, 0, 0)), r: 0.06 * (Rr / Rend + 0.4), h: 0.3 * (Rr / Rend + 0.3), c: 0xb48cff }); }
    sp.push(crystals(items, { sides: 5 }));
    const m = new THREE.Mesh(merge(sp), bioS); shell.add(m);
    // interior luminoso de las cámaras (se ve por la abertura)
    const inner = loft(pts, { seg: LOW ? 30 : 60, radial: LOW ? 6 : 8, r: (t) => rho(t) * 0.8, round: [0.03, 0] });
    const im = new THREE.Mesh(paint(inner, 0xff3aa8, 3, 1.0, (p, n, uv) => ({ k: 0.7 + 0.5 * Math.pow(0.5 + 0.5 * Math.sin(uv[1] * 60), 3), g: 1 })), bioS); shell.add(im); }
  const shellGlow = glowSprite(0xff6ae0, 2.8, 0.0); shellGlow.position.set(0, 0, 0.2); shell.add(shellGlow);

  /* ── cuerpo blando: capucha, ojos, boca-vórtice con dientes y corona de tentáculos ── */
  const head = new THREE.Group(); head.position.set(0, -0.4, 0.1); body.add(head);
  { const hp = [];
    hp.push(place(paint(blobGeo(0.52, 0.44, 0.54, R + 6, 12), FLESH, 0, 0, (p, n) => ({ k: 0.75 + 0.4 * n.y })), [0, 0, -0.05]));
    hp.push(place(paint(blobGeo(0.36, 0.26, 0.34, 14, 10), 0x2a0c28, 0, 0, (p, n) => ({ k: 0.8 + 0.4 * n.y })), [0, 0.36, 0.1]));
    // anillo carnoso (labio) alrededor de la boca
    hp.push(place(paint(new THREE.TorusGeometry(0.2, 0.07, 8, LOW ? 14 : 24), 0x5a1c50, 0, 0, () => ({ k: 0.9 })), [0, -0.08, 0.5]));
    const mh = new THREE.Mesh(merge(hp), bioB); head.add(mh); }
  const EC = eyeCluster({ max: 2, quality: level, iris: 0xffffff, sclera: 0x8a7a60 }); head.add(EC.object);
  for (const sd of [-1, 1]) EC.add({ p: new V3(sd * 0.4, 0.16, 0.3), n: new V3(sd * 0.8, 0.1, 0.55), r: 0.16, tint: 0xffa830, lag: 7 });
  const mouth = new THREE.Group(); mouth.position.set(0, -0.08, 0.5); head.add(mouth);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.ShaderMaterial({
    uniforms: { uTime, uOpen: { value: 0 }, uC: { value: new THREE.Color(0xff5ad0) }, uC2: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime, uOpen; uniform vec3 uC, uC2; varying vec2 vP;
      void main(){ float r = length(vP), a = atan(vP.y, vP.x); float arms = pow(0.5 + 0.5 * sin(a * 3.0 + log(r + 0.04) * 7.0 + uTime * (5.0 + uOpen * 6.0)), 2.0);
        vec3 c = mix(vec3(0.02, 0.0, 0.05), mix(uC2, uC, arms) * (0.45 + arms * 1.1), smoothstep(0.1, 0.55, r) * (0.3 + 0.7 * uOpen));
        float al = smoothstep(1.0, 0.8, r) * clamp(0.55 + uOpen, 0.0, 1.0); gl_FragColor = vec4(c, al);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n }`,
  }));
  mouth.add(throat);
  const NTH = LOW ? 5 : 8; const teethG = new THREE.Group(); mouth.add(teethG);
  { const it = []; for (let i = 0; i < NTH; i++) { const a = i * TAU / NTH; it.push({ p: new V3(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0), d: new V3(-Math.cos(a) * 0.5, -Math.sin(a) * 0.5, 0.9), r: 0.035, h: 0.2 }); } teethG.add(new THREE.Mesh(spikes(it, { sides: 5, color: 0xd8cca8, cls: 2, curve: 0.2 }), bioB)); }
  // tentáculos: corona de 10 (6 largos + 4 cortos) alrededor de la boca, una malla
  const tspecs = [];
  for (let i = 0; i < NTE; i++) { const a = i * TAU / NTE, long = i % 2 === 0, len = long ? 1.9 : 1.2;
    tspecs.push({ p: new V3(Math.cos(a) * 0.42, Math.sin(a) * 0.3 - 0.05, 0.3), d: new V3(Math.cos(a) * 0.6, Math.sin(a) * 0.5 - 0.1, 1), len, r0: long ? 0.085 : 0.065, r1: 0.01, c: 0x44163e, ph: i * 0.9 }); }
  head.add(new THREE.Mesh(tentacleBundle(tspecs, { seg: LOW ? 8 : 16, radial: LOW ? 5 : 7, color: 0x44163e, tipColor: 0xffc860, tipGlow: 1 }), bioT));
  const trig = tentacleRig(bioT);
  const funnelG = new THREE.Group(); funnelG.position.set(0, -0.08, 0.5); funnelG.rotation.x = Math.PI / 2; head.add(funnelG);
  const funnel = ringBank(funnelG, 8, { color: color, thick: 0.95 });
  const aura = auraShell(0xd6c0ff, 1.55); aura.position.y = 0.3; root.add(aura);

  const mats = [bioS, bioB, bioT, ...EC.mats];
  const hY = new Spring(0, 60, 8), hX = new Spring(0, 60, 8), lungeS = new Spring(0, 50, 7), openS = new Spring(0, 70, 9), shakeS = new Spring(0, 80, 8);
  let phase = Math.random() * 6, openK = 0, lastS = '', chT = 0, plT = 0;
  const tmp = new V3(), dir = new V3(), Yv = new V3(0, 1, 0), eyeL = new V3(), lh = new V3(), tdir = new V3(), cA = new THREE.Color(0xff5ad0), cB = new THREE.Color(0xffd0f0);
  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0.001, 0.05); const look = ctx.look || tmp.set(0, 0, 1), speed = Math.min(1.5, ctx.speed || 0);
    const charge = st.s === 'charge', pull = st.s === 'pull', hurt = (st.hp ?? 1) < 0.35;
    if (st.s !== lastS) { if (charge) chT = 0; if (pull) plT = 0; lastS = st.s; }
    if (charge) chT += dt; if (pull) plT += dt;
    const ck = charge ? ease(chT / 0.8) : 0, pk = pull ? ease(plT / 0.3) * (plT > 2.3 ? Math.max(0, 1 - (plT - 2.3) / 0.3) : 1) : 0;
    phase += dt * (1.2 + speed * 0.6);
    const suck = pull ? Math.pow(0.5 + 0.5 * Math.sin(plT * 9), 2) : 0;
    body.position.y = Math.sin(phase) * 0.09 + ck * 0.1; body.rotation.z = Math.sin(phase * 0.6 + st.id) * 0.05 + (hurt ? Math.sin(t * 5) * 0.06 : 0);
    const sh = shakeS.step(dt, (charge ? 0.04 : 0) + (pull ? 0.03 : 0) + (hurt ? 0.02 : 0)); body.position.x = Math.sin(t * 60) * sh;
    const lx = Math.atan2(look.x, Math.max(0.15, look.z)), ly = Math.asin(clamp(look.y, -1, 1)), lim = pull || charge ? 1.0 : 0.6;
    head.rotation.y = hY.step(dt, clamp(lx, -lim, lim)); head.rotation.x = hX.step(dt, -clamp(ly, -0.7, 0.7) * 0.8);
    const lg = lungeS.step(dt, pk * 0.25 - ck * 0.18); head.position.z = 0.1 + lg;
    const hs = 1 + Math.sin(t * 2.1 + st.id) * 0.03 - ck * 0.12 + suck * 0.07; head.scale.set(hs * (1 + pk * 0.08), hs, hs * (1 - suck * 0.05));
    // concha: late de luz; arde al cargar, vibra al succionar; la espiral entera "respira"
    const bright = Math.max(ck, pk * 0.9) + (hurt ? 0.3 * Math.sin(t * 13) : 0);
    shell.rotation.x = Math.sin(t * 0.5) * 0.03 + Math.sin(t * 52) * 0.012 * (ck + pk); shell.rotation.z = Math.sin(t * 0.37 + 1) * 0.04;
    shell.scale.setScalar(1 + Math.sin(t * 1.4) * 0.015 + ck * 0.03 + suck * 0.04);
    US.uCry.value = 0.7 + bright * 2.2 + 0.2 * Math.sin(t * 2.5); US.uGlow.value = bright * 1.4; US.uCrackGlow.value = 0.3 + bright * 1.8; US.uHurt.value = UB.uHurt.value;
    shellGlow.material.opacity = 0.08 + bright * 0.4; shellGlow.scale.setScalar(2.4 + bright * 1.6);
    UB.uVeinGlow.value = 0.12 + bright * 0.7; UB.uPulse.value = suck * 0.6 + ck * 0.3; UB.uGlow.value = bright * 0.4; UT.uVeinGlow.value = UB.uVeinGlow.value; UT.uHurt.value = UB.uHurt.value;
    UB.uGlowCol.value.copy(cA).lerp(cB, 0.0);
    // boca: cerrada en calma → se abre en vórtice
    openK = openS.step(dt, charge ? ck * 0.45 : pull ? 1 : 0.0); const ok = clamp(openK, -0.1, 1.15);
    const mr = 0.07 + ok * 0.33 + (pull ? suck * 0.04 : 0); throat.scale.setScalar(Math.max(0.001, mr * 1.02)); throat.material.uniforms.uOpen.value = clamp(ok, 0, 1);
    teethG.scale.setScalar(Math.max(0.2, mr * 3.0)); teethG.rotation.z = t * pull * 3 + 0.2 * Math.sin(t * 2);
    // anillos de succión: convergen en embudo hacia la boca
    const NF = LOW ? 5 : 8;
    for (let i = 0; i < NF; i++) {
      if (i < 5) { const w = pull ? 1 : ck * 0.5, k = ((t * 1.7 + i / 5) % 1), rad = lerp(3.0, 0.4, k); funnel.set(i, { r: rad, a: w > 0 ? Math.sin(k * Math.PI) * 0.7 * w : 0, y: -rad * 1.1 }); }
      else { const j = i - 5, w = pull ? 1 : 0, k = ((t * 2.3 + j / 3 + 0.3) % 1), rad = lerp(2.2, 0.3, k); funnel.set(i, { r: rad, a: w > 0 ? Math.sin(k * Math.PI) * 0.5 : 0, y: -rad * 0.9, rot: t * 2 + j, color: 0xffd0f2 }); }
    }
    funnel.flush();
    // tentáculos: ondulan en calma; se recogen al cargar; se estiran hacia el jugador (y ondulan menos) en pull
    lh.copy(look).applyAxisAngle(Yv, -head.rotation.y).applyAxisAngle(new V3(1, 0, 0), -head.rotation.x).normalize();
    for (let i = 0; i < NTE; i++) {
      const sp = tspecs[i], a = i * TAU / NTE, long = i % 2 === 0;
      // desviación (en el espacio de la cabeza) respecto a la dirección en reposo: hacia el jugador en pull, enroscada en charge
      tdir.set(lh.x * 1.0 - sp.d.x * 0.3 * 0, lh.y, lh.z).multiplyScalar(pk * 1.2);
      tdir.x += Math.cos(a) * (-ck * 0.9) + Math.sin(t * 0.8 + a * 2) * 0.15 * (1 - pk); tdir.y += Math.sin(a) * (-ck * 0.9) + Math.cos(t * 0.7 + a * 3) * 0.12 * (1 - pk) - (hurt ? 0.35 : 0) * (1 - pk); tdir.z += -ck * 0.7;
      trig.set(i, (0.34 * (1 - pk * 0.7) + ck * 0.1 + (hurt ? 0.2 : 0)) * (long ? 1 : 0.8), 1.6 + ck * 4 + suck * 3, tdir, 0.7, 1 + pk * 0.55 - ck * 0.3 + suck * 0.08);
    }
    eyeL.copy(look).applyAxisAngle(Yv, -head.rotation.y);
    EC.update(dt, eyeL, { open: 0.85, dilate: charge ? 0.8 : pull ? 0.4 : st.a ? 0.8 : 0.6, glow: 0.4 + bright, blinkRate: 0.8 });
    aura.userData.set(st.sd ? 0.65 + 0.2 * Math.sin(t * 4) : 0);
  } };
}
