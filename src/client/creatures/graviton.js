// GRAVITÓN — control. Embrión-cefalópodo que flota sin peso: un manto translúcido índigo (se ven los órganos por dentro) con aletas de membrana,
// un órgano luminoso en el centro que distorsiona el espacio (anillos giroscópicos y ondas expansivas), rostro con un gran ojo de pupila horizontal
// y dos ojos menores, pico de hueso y un haz de tentáculos que "no saben dónde está el suelo".
// Estado charge (1.3 s): los tentáculos se tensan hacia ARRIBA, el órgano se contrae y brilla, los anillos convergen; al soltar: onda de choque.
import * as THREE from 'three';
import { cfg } from '../quality.js';
import { auraShell, glowSprite } from './prisma-util.js';
import { bioMaterial } from './obelisco-mat.js';
import { bigEye, eyeCluster, ringBank, clamp, lerp, damp } from './obelisco-lib.js';
import { V3, paint, place, aimY, merge, loft, line, prof, patch, blobGeo, spikes, crystals, tentacleBundle, tentacleRig, sstep } from './obelisco-geo.js';

const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const TAU = Math.PI * 2;

export default function build(kit, color) {
  const { Spring } = kit;
  const level = cfg().humans, LOW = level === 'low', HI = level === 'high';
  const R = LOW ? 8 : HI ? 16 : 12;
  const FLESH = 0x4a3a62, MANTLE = 0x3a3a92, CORE = 0xff6ae0, CRYS = 0x7a90ff;
  const bioO = bioMaterial({ glow: 0xff5ad8, vein: 0x120a2a, rim: 0x3a2a7a, scale: 1.4, bump: 0.9, wet: 0.7, sheen: 0.15, breath: 0.012, albedo: LOW ? undefined : 0.5, lift: LOW ? undefined : 1.05 }); const UO = bioO.userData.u; UO.uVeinGlow.value = 0.25;
  const bioM = bioMaterial({ glow: 0x8a6aff, vein: 0x180c3a, rim: 0x5a4aff, scale: 1.1, bump: 0.5, wet: 0.8, alpha: 0.5, depthWrite: false, double: true, fres: 1.7, breath: 0.02, sheen: 0.0 }); const UM = bioM.userData.u; UM.uVeinGlow.value = 0.55; UM.uCrackGlow.value = 0.0;
  const bioT = bioMaterial({ glow: 0x8a6aff, vein: 0x180c3a, rim: 0x4a3aaa, scale: 2.2, tent: 10, breath: 0, albedo: LOW ? undefined : 0.5, lift: LOW ? undefined : 1.05 }); const UT = bioT.userData.u; UT.uVeinGlow.value = 0.35;

  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); root.scale.setScalar(1.35); // un poco más grande que la unidad: se lee a 20–30 m (el hitscan del sim es generoso: 1.05·r + 0.35) body.position.y = 0.55;
  const head = new THREE.Group(); body.add(head);
  const mesh = (g, m = bioO, parent = head) => { const o = new THREE.Mesh(g, m); parent.add(o); return o; };

  /* ── manto translúcido, aletas de membrana ── */
  { const mp = [];
    const mt = loft([new V3(0, 0.05, 0.0), new V3(0, 0.5, -0.02), new V3(0, 0.95, -0.1), new V3(0, 1.42, -0.28)], { seg: LOW ? 10 : 18, radial: R, r: prof([[0, 0.3], [0.2, 0.58], [0.48, 0.66], [0.78, 0.42], [1, 0.02]]), ry: () => 1.0, round: [0, 0.05], mod: (t, a) => 1 + 0.05 * Math.sin(a * 3 + t * 6) });
    mp.push(paint(mt, MANTLE, 4, 0, (p, n, uv) => ({ k: 0.8 + 0.5 * uv[1], g: 0 })));
    for (const sd of [-1, 1]) {
      const fin = patch((u, v) => { const x = 0.52 + u * 0.62 * Math.pow(Math.sin(Math.PI * (0.1 + v * 0.8)), 0.8), y = lerp(0.75, 1.3, v) + u * 0.18, z = -0.1 - 0.12 * v - 0.12 * u * u; return new V3(sd * x, y, z); }, 6, 8, { thick: 0 });
      mp.push(paint(fin, MANTLE, 4, 0, (p, n, uv) => ({ k: 0.7 + 0.8 * uv[0], g: 0 })));
    }
    mesh(merge(mp), bioM); }

  /* ── órgano interior: núcleo que late, anillos giroscópicos, sacos oscuros y cristales ── */
  const organ = new THREE.Group(); organ.position.set(0, 0.62, -0.04); head.add(organ);
  const core = mesh(paint(blobGeo(0.26, 0.26, 0.26, LOW ? 10 : 18, LOW ? 8 : 12), 0x120a22, 0, 0.35, (p, n) => ({ k: 0.8 })), bioO, organ);
  const ringsG = merge([[0.46, 0.2, 0.0], [0.56, 1.1, 0.5], [0.66, -0.7, 1.0]].slice(0, LOW ? 2 : 3).map(([r, rx, rz]) => paint(place(new THREE.TorusGeometry(r, 0.016, 5, LOW ? 28 : 56), [0, 0, 0], [rx, 0, rz]), CRYS, 3, 1.0)));
  const ringsM = mesh(ringsG, bioO, organ);
  const lobes = []; { const parts = []; for (let i = 0; i < 3; i++) { const a = i * TAU / 3; parts.push(place(paint(blobGeo(0.13, 0.11, 0.13, 10, 8), 0x8a1a58, 0, 0.6, (p) => ({ k: 0.8 + p.y })), [Math.cos(a) * 0.3, Math.sin(a * 1.3) * 0.12, Math.sin(a) * 0.3])); } mesh(merge(parts), bioO, organ); }
  const lens = auraShell(0xa8b4ff, 1.0); lens.scale.setScalar(0.62); organ.add(lens);
  const haloS = glowSprite(color, 2.2, 0.55); organ.add(haloS);
  const rings = ringBank(organ, LOW ? 5 : 8, { color: 0x8a9aff, thick: 0.965 });
  { const cr = crystals([0, 1, 2, 3].map((i) => { const a = i * 1.7; return { p: new V3(Math.cos(a) * 0.2, 1.3 + (i % 2) * 0.05, -0.28 + Math.sin(a) * 0.2), d: new V3(Math.cos(a) * 0.4, 1, -0.25 + Math.sin(a) * 0.3), r: 0.05, h: 0.28 + (i % 2) * 0.12, c: CRYS }; }), { sides: 5 }); mesh(cr, bioO, head); }

  /* ── rostro: carne pálida, un gran ojo de pupila horizontal, dos ojos menores y pico ── */
  { const fp = [];
    fp.push(paint(blobGeo(0.52, 0.42, 0.5, 18, 12, (p) => { p.z += 0.08 * Math.max(0, p.y + 0.4); }), FLESH, 0, 0, (p, n) => ({ k: 0.75 + 0.35 * n.y })));
    fp[0] = place(fp[0], [0, -0.1, 0.05]);
    // reborde óseo sobre el ojo grande
    fp.push(paint(loft([new V3(-0.3, 0.12, 0.4), new V3(0, 0.2, 0.5), new V3(0.3, 0.12, 0.4)], { seg: 8, radial: 5, r: () => 0.045, round: [0.2, 0.2] }), 0x5a5a8a, 1, 0));
    mesh(merge(fp), bioO, head); }
  const E1 = bigEye({ r: 0.21, iris: 0xffc040, pupil: 'goat', lidColor: 0x7a68a8, scleraColor: 0x8a8070, quality: level, irisR: 0.56 }); E1.object.position.set(0, -0.05, 0.43); head.add(E1.object);
  const EC = eyeCluster({ max: 2, quality: level, iris: 0xffffff, sclera: 0x7a7088 }); head.add(EC.object);
  EC.add({ p: new V3(-0.4, 0.02, 0.3), n: new V3(-0.8, 0.1, 0.55), r: 0.085, tint: 0x8aa0ff, lag: 9 }); EC.add({ p: new V3(0.4, -0.2, 0.28), n: new V3(0.8, -0.1, 0.55), r: 0.065, tint: 0x8aa0ff, lag: 7 });
  const beakUp = new THREE.Group(), beakLo = new THREE.Group(); beakUp.position.set(0, -0.44, 0.34); beakLo.position.set(0, -0.44, 0.34); head.add(beakUp, beakLo);
  mesh(paint(loft([new V3(0, 0.0, 0), new V3(0, -0.02, 0.14), new V3(0, -0.14, 0.24)], { seg: 6, radial: 6, r: (t) => lerp(0.1, 0.006, Math.pow(t, 0.9)), ry: () => 0.8, round: [0.2, 0] }), 0x22203a, 1, 0), bioO, beakUp);
  mesh(paint(loft([new V3(0, -0.04, 0), new V3(0, -0.07, 0.1), new V3(0, -0.02, 0.18)], { seg: 6, radial: 6, r: (t) => lerp(0.075, 0.006, Math.pow(t, 0.9)), ry: () => 0.8, round: [0.2, 0] }), 0x22203a, 1, 0), bioO, beakLo);

  /* ── tentáculos: 6 largos finos + 4 cortos gruesos, UNA malla ── */
  const specs = [], NL = LOW ? 5 : 6, NSH = LOW ? 2 : 4;
  for (let i = 0; i < NL; i++) { const a = 0.2 + (i / NL) * TAU; specs.push({ p: new V3(Math.sin(a) * 0.4, -0.3, Math.cos(a) * 0.4), d: new V3(Math.sin(a) * 0.35, -1, Math.cos(a) * 0.35), sag: new V3(0, 0, 0), len: 2.5, r0: 0.07, r1: 0.01, c: FLESH, ph: i * 1.7 }); }
  for (let i = 0; i < NSH; i++) { const a = 0.9 + (i / NSH) * TAU; specs.push({ p: new V3(Math.sin(a) * 0.3, -0.34, Math.cos(a) * 0.3), d: new V3(Math.sin(a) * 0.5, -1, Math.cos(a) * 0.5), sag: new V3(0, 0, 0), len: 1.5, r0: 0.11, r1: 0.014, c: FLESH, ph: i * 2.3 + 1 }); }
  mesh(tentacleBundle(specs, { seg: LOW ? 8 : 16, radial: LOW ? 5 : 7, color: FLESH, tipColor: 0xff8aff, tipGlow: 1 }), bioT);
  const trig = tentacleRig(bioT); const NTE = specs.length;
  const aura = auraShell(0xb8c4ff, 1.5); aura.position.y = 0.8; root.add(aura);

  const mats = [bioO, bioM, bioT, ...E1.mats, ...EC.mats];
  const headS = new Spring(0, 60, 8), headX = new Spring(0, 60, 8), orgS = new Spring(1, 120, 9), upS = new Spring(0, 55, 6), shock = { t: 9 };
  let cT = 0, lastS = '', phase = Math.random() * 6;
  const tmp = new V3(), look0 = new V3(0, 0, 1), Yv = new V3(0, 1, 0), upBend = new V3(0, 1, 0), dirTmp = new V3(), eyeLook = new V3(), cc = new THREE.Color();
  const hot = new THREE.Color(0xffffff), baseC = new THREE.Color(CORE);

  return { root, mats, tick(dt, st, t, ctx = {}) {
    dt = clamp(dt, 0.001, 0.05); const look = ctx.look || look0, speed = Math.min(1.5, ctx.speed || 0);
    const charge = st.s === 'charge', hurt = (st.hp ?? 1) < 0.35;
    if (charge && lastS !== 'charge') cT = 0; if (!charge && lastS === 'charge') { shock.t = 0; orgS.x = 1.9; orgS.v = 10; } lastS = st.s;
    cT = charge ? cT + dt : 0; const ck = charge ? clamp(cT / 1.3, 0, 1) : 0, ce = ease(ck);
    shock.t += dt;
    phase += dt * (0.8 + speed * 0.6);
    body.position.y = 0.55 + Math.sin(phase) * 0.1 + ce * 0.15; body.rotation.z = Math.sin(phase * 0.7) * 0.07 + (hurt ? Math.sin(t * 5) * 0.08 : 0); body.rotation.x = Math.cos(phase * 0.6) * 0.05;
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    head.rotation.y = headS.step(dt, clamp(lx, -1, 1) * 0.5 + (hurt ? Math.sin(t * 9) * 0.1 : 0)); head.rotation.x = headX.step(dt, -clamp(ly, -0.6, 0.6) * 0.4 + ce * 0.12);
    const br = 1 + Math.sin(t * 1.7 + st.id) * 0.035 - ce * 0.06;
    head.scale.set(br * (1 + ce * 0.04 * Math.sin(t * 40)), br * (1 + 0.05 * ce), br);
    // órgano: latido lento; en charge se CONTRAE y arde; al soltar revienta y vuelve (resorte)
    const beat = 1 + Math.sin(t * 2.4) * 0.07 + (hurt ? Math.sin(t * 17) * 0.1 : 0);
    const os = charge ? lerp(1, 0.42, ce) * (1 + Math.sin(t * 38) * 0.05 * ce) : orgS.step(dt, 1); organ.scale.setScalar(os * beat);
    ringsM.rotation.y = t * (0.6 + ce * 5); ringsM.rotation.x = Math.sin(t * 0.7) * 0.4 + t * 0.2 * ce;
    UO.uGlow.value = 0.6 + ce * 2.6 + (shock.t < 0.3 ? 2.5 : 0); UO.uPulse.value = ce; UO.uCry.value = 0.9 + ce * 1.6 + (shock.t < 0.4 ? 1.5 : 0);
    UO.uGlowCol.value.copy(baseC).lerp(hot, clamp(ce * 0.6 + (shock.t < 0.3 ? 0.6 : 0), 0, 1));
    UM.uVeinGlow.value = 0.5 + ce * 1.2 + (shock.t < 0.4 ? 1.0 : 0); UM.uGlow.value = ce * 0.4; UM.uHurt.value = UO.uHurt.value; UT.uHurt.value = UO.uHurt.value; UT.uVeinGlow.value = 0.3 + ce * 0.8;
    haloS.material.opacity = 0.35 + ce * 0.4 + (shock.t < 0.4 ? 0.4 : 0); haloS.scale.setScalar(2.0 + ce * 1.2 + (shock.t < 0.4 ? 1.8 : 0));
    lens.userData.set(0.35 + ce * 0.6); lens.scale.setScalar(0.6 + 0.05 * Math.sin(t * 3) + (1 - os) * 0.2);
    // anillos: en calma salen despacio (distorsión); en charge CONVERGEN hacia el órgano; al soltar, onda de choque
    const nH = LOW ? 3 : 4;
    for (let i = 0; i < rings.object.count; i++) {
      const horiz = i < nH; const j = horiz ? i : i - nH, n = horiz ? nH : (rings.object.count - nH);
      if (horiz) {
        if (charge) { const k = ((cT * 2.4 + j / n) % 1); rings.set(i, { r: lerp(3.0, 0.45, k), a: (1 - Math.abs(k * 2 - 1)) * (0.4 + ce * 0.9) * 0.55, color: 0x8a9aff }); }
        else if (shock.t < 0.9) { const k = clamp(shock.t / 0.9 - j * 0.12, 0, 1); rings.set(i, { r: 0.5 + k * 10, a: (1 - k) * 0.6, color: 0x8a9aff }); }
        else { const k = ((t * 0.33 + j / n) % 1); rings.set(i, { r: 0.7 + k * 2.4, a: Math.sin(k * Math.PI) * 0.22, color: 0x8a9aff }); }
      } else {
        const rz = -Math.PI / 2 + 1.1 + j * 1.0 - Math.PI / 2 + Math.PI / 2;
        if (charge) { const k = ((cT * 1.9 + j / n) % 1); rings.set(i, { r: lerp(2.4, 0.4, k), a: Math.sin(k * Math.PI) * (0.3 + ce * 0.7) * 0.5, rx: 1.1, rz: j * 1.0 + t * 0.4, color: 0xd0a0ff }); }
        else if (shock.t < 0.9) { const k = clamp(shock.t / 0.9 - 0.05 * j, 0, 1); rings.set(i, { r: 0.5 + k * 8, a: (1 - k) * 0.5, rx: 1.1, rz: j * 1.0, color: 0xd0a0ff }); }
        else { const k = ((t * 0.27 + j / n) % 1); rings.set(i, { r: 0.6 + k * 1.8, a: Math.sin(k * Math.PI) * 0.14, rx: 1.1, rz: j * 1.0 + t * 0.2, color: 0xd0a0ff }); }
      }
    }
    rings.flush();
    // tentáculos: a la deriva en calma, TENSOS hacia arriba en charge; después azotan hacia abajo
    const up = upS.step(dt, ce);
    for (let i = 0; i < NTE; i++) {
      const sp = specs[i], a = Math.atan2(sp.d.x, sp.d.z), drift = 0.5 + 0.5 * Math.sin(t * 0.45 + sp.ph) + (hurt ? 0.4 : 0);
      dirTmp.set(Math.sin(a + Math.sin(t * 0.3 + sp.ph) * 0.4) * (0.2 + drift * 0.35), 0.0, Math.cos(a + Math.sin(t * 0.3 + sp.ph) * 0.4) * (0.2 + drift * 0.35)).addScaledVector(Yv, up * 1.7 - speed * 0.15 + 0.08 * Math.sin(t * 1.3 + sp.ph * 2));
      trig.set(i, lerp(sp.r0 > 0.09 ? 0.35 : 0.55, 0.05 + 0.03 * Math.sin(t * 45 + i), ce) * (1 + (hurt ? 0.5 : 0)), (0.9 + ce * 8 + (hurt ? 1.2 : 0)) * (0.85 + 0.3 * ((i * 7) % 5) / 5), dirTmp, 1, 1 + ce * 0.1);
    }
    // ojos: el grande se abre al cargar; los pequeños siguen
    eyeLook.copy(look).applyAxisAngle(Yv, -head.rotation.y);
    E1.update(dt, eyeLook, { open: 0.7 - hurt * 0.1 + ce * 0.2, pupil: 0.5 + ce * 0.5, glow: 0.5 + ce * 1.5, hurt: UO.uHurt.value, blinkRate: 0.8, brow: 0.12 });
    EC.update(dt, eyeLook, { open: 0.7, dilate: st.a ? 0.8 : 0.5, glow: 0.4 + ce, track: 1 });
    const bo = 0.06 + 0.04 * Math.sin(t * 1.9) + ce * 0.45 + (hurt ? 0.15 : 0);
    beakUp.rotation.x = -bo * 0.8; beakLo.rotation.x = bo * 0.9;
    aura.userData.set(st.sd ? 0.65 + 0.2 * Math.sin(t * 4) : 0);
  } };
}
