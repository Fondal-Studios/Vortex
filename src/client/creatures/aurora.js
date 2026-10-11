// AURORA — sanadora. Medusa-ángel: campana translúcida de azul-verde profundo a magenta con canales radiales luminosos, órganos cálidos por dentro,
// ojos serenos entrecerrados, brazos orales con volantes, tentáculos con perlas de luz, cintas-ala que suben desde los lados y un halo flotante.
// Estado cast (~0.9 s): inhala (la campana se expande y el núcleo se concentra) y exhala: pulso, ondas de luz y una nube de esporas.
import * as THREE from 'three';
import { cfg } from '../quality.js';
import { auraShell, glowSprite } from './prisma-util.js';
import { bioMaterial } from './obelisco-mat.js';
import { eyeCluster, ringBank, clamp, lerp, damp } from './obelisco-lib.js';
import { V3, paint, place, aimY, merge, loft, line, prof, blobGeo, crystals, tentacleBundle, tentacleRig, sstep } from './obelisco-geo.js';

const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const TAU = Math.PI * 2;

export default function build(kit, color) {
  const { Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const R = LOW ? 10 : HI ? 24 : 16;
  const GOLD = 0xffc060;
  const bioM = bioMaterial({ glow: 0xff58c8, vein: 0x0a2a3a, rim: 0x1890a0, scale: 1.0, bump: 0.4, wet: 0.9, alpha: 0.55, depthWrite: false, double: true, fres: 1.8, radial: 14, breath: 0.015, sheen: 0 }); const UM = bioM.userData.u; UM.uVeinGlow.value = 0.7;
  const bioO = bioMaterial({ glow: 0xffb050, vein: 0x401030, rim: 0xff6aa0, scale: 1.6, bump: 0.5, wet: 0.8, sheen: 0.1, breath: 0.02 }); const UO = bioO.userData.u; UO.uVeinGlow.value = 0.3;
  const NA = 4, NTn = LOW ? 5 : 9, NW = LOW ? 2 : 6;
  const bioT = bioMaterial({ glow: 0xff58c8, vein: 0x0a2a3a, rim: 0x20c8d0, scale: 2.0, tent: NA + NTn + NW, alpha: 0.78, depthWrite: false, double: true, fres: 1.0, breath: 0, sheen: 0 }); const UT = bioT.userData.u; UT.uVeinGlow.value = 0.5;

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bell = new THREE.Group(); bell.position.y = 0.55; body.add(bell);
  const mesh = (g, m, parent) => { const o = new THREE.Mesh(g, m); parent.add(o); return o; };
  const H = 0.85;
  /* ── campana: dos capas translúcidas con borde festoneado ── */
  { const bp = [], bellR = prof([[0, 1.02], [0.06, 1.08], [0.3, 0.95], [0.6, 0.7], [0.88, 0.34], [1, 0.02]]);
    const mk = (s, rimC, topC, yo) => { const g = loft(line([0, 0, 0], [0, H * s, 0]), { seg: LOW ? 10 : 18, radial: R, r: (t) => bellR(t) * s, round: [0, 0.03], mod: (t, a) => 1 + 0.06 * Math.sin(a * 14) * Math.pow(1 - t, 3) });
      return place(paint(g, rimC, 4, 0, (p, n, uv) => ({ c: new THREE.Color(rimC).lerp(new THREE.Color(topC), sstep(0.05, 0.8, uv[1])), k: 0.9 + 0.5 * (1 - uv[1]), g: (1 - sstep(0.0, 0.18, uv[1])) * 0.9 })), [0, yo, 0]); };
    bp.push(mk(1.0, 0x8a1478, 0x06405a, 0)); bp.push(mk(0.7, 0xc05818, 0x8a2060, 0.02));
    const m = mesh(merge(bp), bioM, bell); m.renderOrder = 2; }
  // órganos interiores (opacos): núcleo cálido y cuatro pétalos de trébol
  const core = new THREE.Group(); core.position.y = 0.3; bell.add(core);
  const nuc = mesh(paint(blobGeo(0.2, 0.2, 0.2, 14, 10), 0xffd890, 0, 1.0), bioO, core);
  const petalsM = []; { const parts = []; for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + 0.4; parts.push(place(paint(blobGeo(0.22, 0.05, 0.13, 10, 8), 0xff6aa8, 0, 0.8), [Math.cos(a) * 0.3, -0.02, Math.sin(a) * 0.3], [0, -a, 0])); } petalsM.push(mesh(merge(parts), bioO, core)); }
  const coreGlow = glowSprite(0xffd890, 1.6, 0.3); core.add(coreGlow);
  // ojos serenos entrecerrados que se ven a través de la campana
  const EC = eyeCluster({ max: 2, quality: level, iris: 0xffffff, sclera: 0x8a7870 }); bell.add(EC.object);
  for (const sd of [-1, 1]) EC.add({ p: new V3(sd * 0.3, 0.14, 0.58), n: new V3(sd * 0.55, 0.05, 0.85), r: 0.12, tint: 0xffb860, lag: 5 });
  // brazos orales (cintas con volantes), tentáculos finos con perlas y cintas-ala: UNA malla
  const specs = [];
  for (let i = 0; i < NA; i++) { const a = i * TAU / NA + 0.5; specs.push({ p: new V3(Math.cos(a) * 0.14, 0.52, Math.sin(a) * 0.14), d: new V3(Math.cos(a) * 0.15, -1, Math.sin(a) * 0.15), len: 1.7, r0: 0.21, r1: 0.05, flat: 7, rot0: -a, ruffle: 0.25, c: 0x7a1a58, ph: i * 1.7 }); }
  for (let i = 0; i < NTn; i++) { const a = (i / NTn) * TAU; specs.push({ p: new V3(Math.cos(a) * 0.9, 0.5, Math.sin(a) * 0.9), d: new V3(Math.cos(a) * 0.08, -1, Math.sin(a) * 0.08), len: 2.6 + (i % 3) * 0.5, r0: 0.04, r1: 0.007, c: 0x147a88, ph: i * 1.1 }); }
  for (let i = 0; i < NW; i++) { const sd = i % 2 ? 1 : -1, k = i >> 1; specs.push({ p: new V3(sd * 0.55, 0.95, -0.15), d: new V3(sd * (0.7 + k * 0.5), 1.0 - k * 0.3, -0.15), len: 1.5 - k * 0.2, r0: 0.3, r1: 0.04, flat: 9, rot0: 0, c: 0xb06820, ph: i + sd }); }
  const tmesh = mesh(tentacleBundle(specs, { seg: LOW ? 8 : 18, radial: LOW ? 4 : 6, color: 0x7a1a58, tipColor: GOLD, tipGlow: 1 }), bioT, body); tmesh.renderOrder = 3;
  const trig = tentacleRig(bioT);
  // halo de ángel y cristales dorados
  const halo = mesh(paint(new THREE.TorusGeometry(0.5, 0.022, 8, LOW ? 24 : 48), GOLD, 3, 1.0), bioO, body); halo.rotation.x = Math.PI / 2 - 0.25; halo.position.set(0, 1.62, -0.05);
  const haloG = glowSprite(0xffc870, 1.6, 0.18); haloG.position.copy(halo.position); body.add(haloG);
  mesh(crystals([0, 1, 2, 3, 4].map((i) => { const a = i * TAU / 5; return { p: new V3(Math.cos(a) * 0.5, 1.0, Math.sin(a) * 0.5), d: new V3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), r: 0.03, h: 0.14, c: GOLD }; }), { sides: 5 }), bioO, body);
  // ondas de luz y esporas
  const waves = ringBank(root, 5, { color: 0xffe0a0, thick: 0.96 });
  const NS = LOW ? 14 : 36, sp = new Float32Array(NS * 3), sph = [];
  for (let i = 0; i < NS; i++) { const a = Math.random() * TAU, r = 0.6 + Math.random() * 1.6; sp[i * 3] = Math.cos(a) * r; sp[i * 3 + 1] = -0.5 + Math.random() * 2.4; sp[i * 3 + 2] = Math.sin(a) * r; sph.push(Math.random() * 6.28); }
  const spG = new THREE.BufferGeometry(); spG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const spM = new THREE.PointsMaterial({ color: 0xffd890, size: 0.1, map: glowSprite(0xffffff).material.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 });
  const spores = new THREE.Points(spG, spM); spores.frustumCulled = false; root.add(spores);
  const aura = auraShell(0xffe0f8, 1.6); aura.position.y = 0.9; root.add(aura);

  const mats = [bioM, bioO, bioT, ...EC.mats];
  const bellS = new Spring(0, 50, 7), tiltX = new Spring(0, 40, 6), tiltY = new Spring(0, 40, 6), jetS = new Spring(0, 60, 8), brightS = new Spring(0, 40, 6);
  let phase = Math.random() * 6, lastS = '', castT = 0, relT = 9;
  const tmp = new V3(), Y = new V3(0, 1, 0), eyeL = new V3(), bendV = new V3(), colA = new THREE.Color(0xffd890), colB = new THREE.Color(0xffffff);
  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0.001, 0.05); const look = ctx.look || tmp.set(0, 0, 1), speed = Math.min(1.5, ctx.speed || 0);
    const cast = st.s === 'cast', hurt = (st.hp ?? 1) < 0.35, stun = !!st.st;
    if (cast && lastS !== 'cast') { castT = 0; relT = 9; } lastS = st.s;
    if (cast) { castT += dt; if (castT > 0.5 && relT > 5) relT = 0; } relT += dt;
    const inhale = cast ? ease(castT / 0.5) * (castT < 0.5 ? 1 : 0) + (castT >= 0.5 ? Math.max(0, 1 - (castT - 0.5) / 0.15) : 0) : 0;
    const exhale = relT < 0.9 ? Math.sin(clamp(relT / 0.9, 0, 1) * Math.PI) : 0;
    phase += dt * (1.9 + speed * 0.8) * (stun ? 0.4 : hurt ? 0.7 : 1) * (cast ? 0.2 : 1) + (hurt ? Math.sin(t * 8) * dt * 0.8 : 0);
    const pulse = clamp(-Math.cos(phase) * 0.5 + 0.5, 0, 1); // 1 = contraída
    const contract = cast ? -0.55 * inhale + exhale * 0.9 : pulse * 0.8 - 0.1;
    const cs = bellS.step(dt, contract); UM.uBell.value.set(cs, H, 1);
    const jet = jetS.step(dt, pulse * 0.1 + exhale * 0.25 - inhale * 0.08); body.position.y = Math.sin(t * 0.6) * 0.06 + jet; body.rotation.z = Math.sin(t * 0.5 + st.id) * 0.06 + (hurt ? Math.sin(t * 4) * 0.07 : 0);
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    bell.rotation.y = tiltY.step(dt, clamp(lx, -0.9, 0.9) * 0.4); bell.rotation.x = tiltX.step(dt, clamp(-ly, -0.5, 0.5) * 0.2 + inhale * 0.1);
    bell.scale.set(1 + inhale * 0.18 - exhale * 0.1, 1 + exhale * 0.12 - inhale * 0.08, 1 + inhale * 0.18 - exhale * 0.1);
    const bright = brightS.step(dt, inhale * 0.8 + exhale * 1.2);
    const nr = 1 + Math.sin(t * 2.2) * 0.07 - inhale * 0.25 + exhale * 0.5; nuc.scale.setScalar(nr);
    petalsM[0].rotation.y = t * (0.15 + inhale * 1.2 + exhale * 2); petalsM[0].scale.setScalar(1 - inhale * 0.3 + exhale * 0.5);
    UO.uGlow.value = 0.5 + bright * 1.6 + (hurt ? Math.sin(t * 14) * 0.4 : 0); UO.uHurt.value = UM.uHurt.value; UT.uHurt.value = UM.uHurt.value;
    UM.uGlow.value = 0.15 + bright * 0.9 - (hurt ? 0.1 : 0); UM.uVeinGlow.value = 0.7 + bright * 1.4; UT.uVeinGlow.value = 0.35 + bright * 0.9; UT.uGlow.value = 0.1 + bright * 0.8;
    UO.uGlowCol.value.copy(colA).lerp(colB, clamp(bright * 0.5, 0, 1));
    coreGlow.material.opacity = 0.2 + bright * 0.2 + 0.05 * Math.sin(t * 3); coreGlow.scale.setScalar(1.5 + bright * 1.0);
    eyeL.copy(look).applyAxisAngle(Y, -bell.rotation.y);
    EC.update(dt, eyeL, { open: 0.5 + bright * 0.1 - (hurt ? 0.1 : 0), dilate: 0.5 + inhale * 0.3, glow: 0.6 + bright, blinkRate: 0.6, track: 0.8, jitter: 0.3 });
    // brazos, tentáculos y cintas: ondulan más al impulsarse, se elevan al inhalar y se sueltan al exhalar
    const hm = hurt ? 1.3 : 1;
    for (let i = 0; i < NA; i++) trig.set(i, (0.35 + pulse * 0.25 + exhale * 0.5) * hm, 1.3 + exhale * 3 + i * 0.1, Y, -0.22 * (1 - pulse) + 0.18 * inhale, 1);
    for (let i = 0; i < NTn; i++) trig.set(NA + i, (0.4 + pulse * 0.3 + exhale * 0.6) * hm * (1 - inhale * 0.5), 1.2 + exhale * 3 + (i % 3) * 0.3, Y, 0.08 * pulse, 1 - pulse * 0.04);
    for (let i = 0; i < NW; i++) { const sd = i % 2 ? 1 : -1; bendV.set(sd * 0.3, 0.0, 0); trig.set(NA + NTn + i, 0.18 + exhale * 0.5, 1.6, bendV, 0.3 * (Math.sin(phase + i * 0.6) * 0.5 + inhale * 0.5 - exhale * 0.3), 1); }
    // halo + cristales
    halo.rotation.z = t * (0.6 + inhale * 4 + exhale * 6); halo.position.y = 1.62 + Math.sin(t * 1.1) * 0.05 + jet * 0.5; haloG.position.copy(halo.position); haloG.material.opacity = 0.12 + bright * 0.3; haloG.scale.setScalar(1.6 + bright * 0.8); halo.scale.setScalar(1 + inhale * 0.2 + exhale * 0.4);
    UO.uCry.value = 0.6 + bright * 1.0;
    // ondas de luz expansivas (curación) y esporas que se dispersan
    for (let i = 0; i < 3; i++) { const k = clamp(relT / 0.95 - i * 0.14, 0, 1); waves.set(i, { r: 0.8 + ease(k) * 5.2, a: relT < 1.2 && k < 1 ? (1 - k) * 0.7 : 0, y: 0.5 }); }
    for (let i = 0; i < 2; i++) { const k = clamp(relT / 0.8 - 0.08 - i * 0.2, 0, 1); waves.set(3 + i, { r: 0.6 + ease(k) * 4.2, a: relT < 1.2 && k < 1 && k > 0 ? (1 - k) * 0.55 : 0, y: 0.5 + 0.5 * i, color: 0xff9ad8 }); }
    waves.flush();
    const pa = spG.attributes.position.array;
    for (let i = 0; i < NS; i++) { const ix = i * 3, bx = pa[ix], bz = pa[ix + 2], rr = Math.hypot(bx, bz) + 0.001;
      if (relT < 0.9 && relT > 0) { const s = (1.5 + (i % 5) * 0.5) * dt; pa[ix] += bx / rr * s * 2.2; pa[ix + 2] += bz / rr * s * 2.2; pa[ix + 1] += 0.4 * dt; }
      else { pa[ix] += Math.sin(t * 0.7 + sph[i]) * 0.1 * dt; pa[ix + 1] += (0.12 + 0.1 * Math.sin(sph[i] + t)) * dt; pa[ix + 2] += Math.cos(t * 0.6 + sph[i]) * 0.1 * dt;
        if (rr > 2.6) { pa[ix] *= 1 - dt * 0.8; pa[ix + 2] *= 1 - dt * 0.8; } }
      if (pa[ix + 1] > 2.2) { const a = Math.random() * TAU, r = 0.5 + Math.random() * 1.2; pa[ix] = Math.cos(a) * r; pa[ix + 1] = -0.7; pa[ix + 2] = Math.sin(a) * r; } }
    spG.attributes.position.needsUpdate = true; spM.opacity = 0.45 + 0.2 * Math.sin(t * 2) + exhale * 0.4; spM.size = 0.1 + exhale * 0.06;
    aura.userData.set(st.sd ? 0.65 + 0.2 * Math.sin(t * 4) : 0);
  } };
}
