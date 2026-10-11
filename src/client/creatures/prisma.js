// PRISMA — volador. Mantarraya-polilla de carne y biocristal: tórax peludo, cabeza con ojos grandes, antenas plumosas, trompa que
// se desenrolla al atacar y alas de membrana translúcida (borde de ataque curvo, borde de fuga festoneado, venas en abanico y
// OCELOS legibles: anillos oscuro / dorado / magenta con pupila) montadas en un esqueleto de 3 huesos (hombro, codo, punta).
// Estados: orbit = vuela en círculos / wind = se repliega y brilla (aviso 0.7 s: alas arriba, ocelos y venas arden) /
// dive = alas pegadas atrás, cuerpo estirado, trompa afuera. st.hp<0.35: ala coja; st.sd aura; st.st aturdida.
import { THREE, TAU, gazeDir, lod, clamp, lerp, smooth, rng, bio, crystalMat, lidMaterial, ellipsoid, tube, spike, plate, crystal, crystalCluster, paint, orient, path, bendAttr, Rig, skinRigid, skinChain, eye, boneQuat, glowSprite, shieldAura, tickAura, Spring, dampTo } from './geoda-bio.js';
import { uTime } from '../shaders.js';

const WING_NOISE = `
  float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y), mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }
  vec3 pal(float t){ return 0.5 + 0.5 * cos(6.2831 * (t + vec3(0.0, 0.33, 0.67))); }`;

export default function build(kit, color) {
  const L = lod(), low = L.low, hi = L.hi, V3 = THREE.Vector3, R = rng(31);
  const col = new THREE.Color(color);
  const skin = bio({ rough: 0.5, clear: 0.3, sheen: 0.2, sssColor: 0xff70c0, sss: 0.25, env: 0.6, tex: 'flesh', tile: 1.8, bump: 0.7, grain: 0.5, seam: 0x1a0420, seamK: 0.5, vein: color, veinK: 0.35, veinGlow: 0.7 });
  const bone = bio({ rough: 0.4, clear: 0.5, clearRough: 0.3, env: 0.6, tex: 'plates', tile: 1.6, bump: 0.6, grain: 0.5, seam: color, seamK: 0.15, seamGlow: 0.3 });
  const fur = bio({ rough: 0.8, tex: 'fine', bend: true, bump: 0, grain: 0.3, vcol: true, sheen: 0.8, sssColor: 0xff90d0 }); fur.userData.u.uAmp.value = 0.035; fur.userData.u.uSpd.value = 2.5;
  const cry = crystalMat(0x7af4ff, { glow: 0.9, alpha: 0.9 });
  const mats = [skin, bone, fur, cry];

  /* ── membrana de ala: venas en abanico, escamas iridiscentes y OCELOS (anillos) por shader. aK = s (raíz→punta), aPh = v (ataque→fuga) ── */
  function wingMat(kind) {
    const u = { uTime, uHurt: { value: 0 }, uWind: { value: 0 }, uC1: { value: new THREE.Color(0x1a0540) }, uC2: { value: col.clone() }, uKind: { value: kind } };
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    m.userData.u = u; m.forceSinglePass = true; m.customProgramCacheKey = () => 'prismawing';
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aK; attribute float aPh; varying vec2 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\n vW = vec2(aK, aPh);\n transformed.y += sin(uTimeW * 7.0 - aK * 9.0 + aPh * 3.0) * 0.03 * smoothstep(0.6, 1.0, aPh) * (0.3 + aK);'.replace('uTimeW', 'uTime')).replace('#include <common>', '#include <common>\nuniform float uTime;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>\nuniform float uTime,uHurt,uWind,uKind; uniform vec3 uC1,uC2; varying vec2 vW; ${WING_NOISE}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float s = vW.x, v = vW.y;
          // venas: radiales en abanico (más densas hacia el borde), con ramificaciones cruzadas finas
          float fan = v * (6.0 + 5.0 * s) + sin(s * 3.0) * 0.25; float l1 = abs(fract(fan) - 0.5); float vein = smoothstep(0.43, 0.5, l1) * (0.35 + 0.65 * smoothstep(0.0, 0.25, v));
          float cell = abs(vn(vec3(s * 14.0, v * 8.0, 3.0)) - 0.5); float cross = (1.0 - smoothstep(0.43, 0.5, cell)) * 0.5 * smoothstep(0.15, 0.55, v);
          float leading = smoothstep(0.1, 0.0, v) * 1.0, rim = smoothstep(0.9, 1.0, v);
          float vv = clamp(max(vein, cross) + leading, 0.0, 1.0);
          // ocelo: dos (alas delanteras: grande; traseras: pequeño). Distancias en proporción de pantalla
          vec2 c0 = uKind < 0.5 ? vec2(0.6, 0.5) : vec2(0.55, 0.45); float rs = uKind < 0.5 ? 0.17 : 0.1;
          vec2 q = (vec2(s, v) - c0) * vec2(1.5, 0.92); float d = length(q) / rs;
          float oRing = smoothstep(1.0, 0.92, d);
          float c1 = smoothstep(1.0, 0.9, d) - smoothstep(0.85, 0.75, d);       // aro exterior oscuro
          float c2 = smoothstep(0.78, 0.7, d) - smoothstep(0.62, 0.54, d);      // aro dorado
          float c3 = smoothstep(0.58, 0.5, d) - smoothstep(0.36, 0.28, d);      // aro magenta
          float c4 = smoothstep(0.3, 0.22, d);                                   // pupila
          float glint = smoothstep(0.12, 0.0, length(q - vec2(-0.035, 0.03)) / rs * 1.2) * 0.9;
          vec3 irid = pal(s * 0.5 + v * 0.4 + 0.55 + uTime * 0.04 + vn(vec3(s * 6.0, v * 6.0, uTime * 0.2)) * 0.3);
          vec3 base = mix(uC1, uC2, smoothstep(0.05, 1.0, s * 0.8 + v * 0.3)); base = mix(base, irid * 0.8, 0.1 + 0.18 * v);
          base = mix(base, vec3(0.04, 0.0, 0.08), c1 * 0.95); base = mix(base, vec3(1.0, 0.82, 0.3), c2); base = mix(base, uC2 * 1.2, c3); base = mix(base, vec3(0.02, 0.0, 0.05), c4); base += glint;
          base = mix(base, vec3(0.05, 0.0, 0.1), rim * 0.55); base = mix(base, vec3(0.03, 0.0, 0.06), vv * 0.92);
          // lúnulas a lo largo del borde de fuga
          float lun = smoothstep(0.1, 0.0, abs(v - 0.86)) * smoothstep(0.35, 0.5, abs(fract(s * 7.0) - 0.5)); base = mix(base, vec3(1.0, 0.9, 0.7), lun * 0.6);
          diffuseColor.rgb = base; float oc = max(c2 + c3 + c4, 0.0);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float fres = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.0);
          diffuseColor.a = clamp(0.4 + 0.3 * (1.0 - v) + vv * 0.5 + (c1 + c2 + c3 + c4) * 0.55 + fres * 0.25, 0.0, 0.96) * (1.0 - smoothstep(0.93, 1.0, v) * 0.45);
          totalEmissiveRadiance += uC2 * (vv * (0.35 + uWind * 2.6) * (0.6 + 0.4 * sin(uTime * 3.0 - s * 8.0)) + (c3 * 0.9 + c2 * 0.5) * (0.5 + uWind * 2.2)) + irid * fres * 0.4 + vec3(1.0, 0.85, 0.7) * uHurt * 0.9;`);
    };
    return m;
  }
  const wingF = wingMat(0), wingH = wingMat(1); mats.push(wingF, wingH);

  const rig = new Rig();
  const root = rig.bone(null, [0, 0, 0], 'root'), body = rig.bone(root, [0, 0.1, 0.15], 'body');
  const head = rig.bone(body, [0, 0.1, 0.72], 'head');
  const ab = []; [[0, 0.08, -0.35], [0, 0.04, -0.75], [0, 0.0, -1.1], [0, -0.04, -1.4]].forEach((p, i) => ab.push(rig.bone(i ? ab[i - 1] : body, p, 'ab')));
  // ── alas ──
  const WSEG = low ? [5, 4] : [11, 8];
  const LEx = (s) => 0.28 + 1.52 * s, LEz = (s) => 0.2 + 0.1 * Math.sin(Math.PI * s) - 0.42 * s * s;
  const chord = (s) => 1.0 * (0.34 + 0.66 * Math.sin(Math.PI * Math.pow(s, 0.8))) * Math.pow(Math.max(0, 1 - Math.pow(s, 2.4)), 0.55);
  function foreGeo(side) {
    const [nx, nz] = WSEG, P = [], K = [], I = [], PH = [];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const s = i / nx, v = j / nz, scal = 0.13 * Math.pow(v, 2.5) * Math.pow(Math.abs(Math.sin(s * Math.PI * 3.0 + 0.5)), 0.7);
      P.push(side * LEx(s), 0.1 + 0.11 * Math.sin(v * Math.PI * 0.85) * (1 - 0.5 * s) - 0.06 * s + 0.04 * v * v, LEz(s) - v * chord(s) - scal); K.push(s); PH.push(v);
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = i * (nz + 1) + j, b = a + nz + 1; if (side > 0) I.push(a, b, a + 1, b, b + 1, a + 1); else I.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(K, 1)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(PH, 1)); g.setIndex(I); g.computeVertexNormals(); return g;
  }
  function hindGeo(side) {
    const [nx, nz] = WSEG, P = [], K = [], I = [], PH = [];
    // ala trasera: lóbulo redondeado con cola larga tipo golondrina
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      const s = i / nx, v = j / nz, w = 0.95 * Math.sin(Math.PI * (0.08 + 0.7 * s)), ch = 0.55 * (0.5 + 0.5 * Math.sin(Math.PI * (s * 0.9 + 0.05))) + (s > 0.55 ? 0.9 * Math.pow((s - 0.55) / 0.45, 2.2) * (1 - 0.7 * Math.abs(v - 0.4)) : 0);
      P.push(side * (0.3 + 1.0 * s * (1 - 0.15 * v)), 0.06 - 0.03 * s, -0.2 - v * ch * (1 + 0.2 * Math.sin(s * 6) * v * 0.3) - 0.3 * s * s); K.push(s); PH.push(v);
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const a = i * (nz + 1) + j, b = a + nz + 1; if (side > 0) I.push(a, b, a + 1, b, b + 1, a + 1); else I.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aK', new THREE.Float32BufferAttribute(K, 1)); g.setAttribute('aPh', new THREE.Float32BufferAttribute(PH, 1)); g.setIndex(I); g.computeVertexNormals(); return g;
  }
  const wings = [];
  for (const side of [-1, 1]) {
    const sh = rig.bone(body, [side * 0.26, 0.1, 0.16], 'sh'), el = rig.bone(sh, [side * 1.0, 0.12, LEz(0.47)], 'el'), tip = rig.bone(el, [side * 1.75, 0.1, LEz(1)], 'wt'), hw = rig.bone(sh, [side * 0.34, 0.07, -0.18], 'hw'), hwt = rig.bone(hw, [side * 1.2, 0.04, -0.5], 'hwt');
    rig.add(wingF, skinChain(foreGeo(side), [sh, el, tip], 0.28)); rig.add(wingH, skinChain(hindGeo(side), [hw, hwt], 0.3));
    // huesos del ala: borde de ataque (tubo curvo) + dedos en abanico; garra de cristal en la muñeca
    const LE = []; for (let i = 0; i <= 6; i++) { const s = i / 6; LE.push([side * LEx(s), 0.12 + 0.02 * Math.sin(s * 3), LEz(s)]); }
    const lg = tube(LE, { rad: (t) => 0.05 * (1 - t * 0.8) + 0.008, seg: low ? 8 : 14, sides: low ? 4 : 6, caps: true }); paint(lg, (p, n) => new THREE.Color(0x2a1038).lerp(new THREE.Color(0x7a4a9a), smooth(0.0, 1, n.y * 0.5 + 0.5))); rig.add(bone, skinChain(lg, [sh, el, tip], 0.28));
    if (!low) for (let f = 0; f < 3; f++) { const s0 = 0.18 + f * 0.1, a = LE[Math.round(s0 * 6)], tgt = [side * (LEx(s0 + 0.5)), 0.08, LEz(s0 + 0.5) - chord(s0 + 0.5) * (0.85 + f * 0.05)]; const fg = tube([a, [lerp(a[0], tgt[0], 0.5), 0.1, lerp(a[2], tgt[2], 0.5)], tgt], { rad: (t) => 0.018 * (1 - t) + 0.004, seg: 5, sides: 4, caps: false }); paint(fg, 0x3a1850); rig.add(bone, skinChain(fg, [sh, el, tip], 0.28)); }
    const claw = spike(0.035, 0.22, { sides: 5, seg: 3, bend: 0.5, bendDir: [0, 0, -1], pos: [side * 1.0, 0.13, LEz(0.47) + 0.03], dir: [side * 0.3, 0.5, 1] }); paint(claw, (p) => new THREE.Color(0x5a3a6a).lerp(new THREE.Color(0xfff0e0), smooth(0.05, 0.22, p.z - 0.25))); rig.add(bone, skinRigid(claw, el));
    crystalCluster(2, 0.025, 0.2, { pos: [side * 1.0, 0.14, LEz(0.47)], dir: [side * 0.3, 1, 0.2], seed: 70 + side, c0: 0x20406a, c1: 0xe0ffff }).forEach((c) => rig.add(cry, skinRigid(c, el)));
    wings.push({ sh, el, tip, hw, hwt, side });
  }
  // ── cuerpo ──
  const thor = ellipsoid([0.31, 0.29, 0.44], { w: low ? 10 : 18, h: low ? 7 : 12, noise: 0.1, seed: 2, pos: [0, 0.12, 0.2] }); paint(thor, (p, n) => new THREE.Color(0x24083a).lerp(new THREE.Color(0x7a3466), smooth(-0.4, 0.8, -n.y) * 0.7)); rig.add(skin, skinRigid(thor, body));
  const hd = ellipsoid([0.2, 0.19, 0.22], { w: low ? 9 : 14, h: low ? 6 : 10, noise: 0.07, seed: 5, pos: [0, 0.11, 0.8] }); paint(hd, (p, n) => new THREE.Color(0x1e0630).lerp(new THREE.Color(0x6a2a5a), smooth(0, -0.9, n.y) * 0.6)); rig.add(skin, skinRigid(hd, head));
  const abG = tube([[0, 0.1, -0.2], [0, 0.07, -0.55], [0, 0.03, -0.95], [0, -0.01, -1.3], [0, -0.04, -1.45]], { rad: (t) => 0.2 * Math.pow(1 - t, 0.7) * (0.7 + 0.5 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.6)) + 0.015, seg: low ? 10 : 20, sides: low ? 6 : 10, bulge: (t) => 1 + 0.07 * Math.sin(t * TAU * 6) });
  paint(abG, (p, n) => new THREE.Color(0x24083a).lerp(new THREE.Color(0x8a4a7a), smooth(0.2, -0.9, n.y))); rig.add(skin, skinChain(abG, [body, ...ab], 0.2));
  for (let i = 0; i < (low ? 3 : 5); i++) { const z = -0.28 - i * 0.2, y = 0.1 - i * 0.03, r = 0.19 * (1 - i * 0.14); const g = plate({ w: r * 0.9, l: 0.1, h: 0.04, nr: 2, ns: 7, wrap: 1.4 / r * 0.3, keel: 0.5, quat: orient(new V3(0, 1, -0.1 * i), new V3(0, -0.1, 1)), pos: [0, y + r * 0.85, z], col: 0x2a1038, col2: 0x8a5aa8 }); rig.add(bone, skinChain(g, [body, ...ab], 0.2)); }
  // pelaje: mechones finos que se mecen (cuello del tórax)
  if (!low) for (let i = 0; i < 46; i++) { const a = R() * TAU, t = R(), z = 0.55 - t * 0.7, rr = 0.25 * Math.sqrt(Math.max(0.1, 1 - Math.pow((z - 0.2) / 0.44, 2))); const base = new V3(Math.sin(a) * rr, 0.12 + Math.cos(a) * rr * 0.95, z), out = new V3(Math.sin(a), Math.cos(a), -0.3).normalize(), len = 0.08 + R() * 0.07;
    const g = tube([base, base.clone().addScaledVector(out, len * 0.5), base.clone().addScaledVector(out, len).add(new V3(0, 0, -0.03))], { rad: [0.011, 0.002], seg: 2, sides: 3, caps: false }); paint(g, new THREE.Color(0x70346a).lerp(new THREE.Color(0xe8a8c8), R() * 0.7)); bendAttr(g, (p) => clamp(p.distanceTo(base) / len, 0, 1), R() * 6); rig.add(fur, skinRigid(g, body)); }
  // ── ojos grandes con párpados ──
  const eyes = [];
  for (const s of [-1, 1]) { const e = eye({ r: 0.125, iris: color, iris2: 0x40081c, sclera: 0x24102c, vein: 0x601838, pupil: 'slit', irisR: 1.0, glow: 0.9, lidMat: lidMaterial({ color: 0x1a0630, vein: 0x20082a, sssColor: 0xff70c0, sss: 0.15, tile: 2 }), slant: 0.32, maxYaw: 0.5, maxPitch: 0.4, follow: 0.9 }); const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, s * 0.8, 0)); e.object.quaternion.copy(q); e.mount = q; rig.attach(head, e.object, [s * 0.15, 0.14, 0.86]); eyes.push(e); mats.push(e.mat, e.lid.material); }
  // ── antenas plumosas ──
  const ants = [];
  for (const s of [-1, 1]) {
    const J = [[s * 0.07, 0.27, 0.9], [s * 0.2, 0.52, 1.12], [s * 0.38, 0.68, 1.4], [s * 0.6, 0.7, 1.68]], bs = []; J.forEach((p, i) => bs.push(rig.bone(i ? bs[i - 1] : head, p, 'an')));
    const g = tube(J, { rad: [0.016, 0.005], seg: low ? 6 : 10, sides: 4, caps: false }); paint(g, 0x2a1038); rig.add(bone, skinChain(g, bs, 0.1));
    const nB = low ? 3 : 8; for (let i = 0; i < nB; i++) { const t = 0.25 + (i / nB) * 0.7, c = new THREE.CatmullRomCurve3(J.map((q) => new V3(...q))).getPointAt(t), ln = 0.16 * (1 - Math.abs(t - 0.55) * 0.9); for (const sd of [-1, 1]) { const bg = spike(0.007, ln, { sides: 3, seg: 1, pos: [c.x, c.y, c.z], dir: [sd * 0.6 + s * 0.4, 0.5, 0.35] }); paint(bg, new THREE.Color(0x7a4a9a).lerp(new THREE.Color(color), t)); rig.add(bone, skinChain(bg, bs, 0.1)); } }
    const tipC = crystal(0.02, 0.1, { sides: 5, pos: J[3], dir: [s * 0.5, 0.1, 1], seed: 4, c0: 0x40a0b0, c1: 0xffffff }); rig.add(cry, skinRigid(tipC, bs[3]));
    ants.push(bs);
  }
  // ── trompa enrollable + colmillos ──
  const PJ = [[0, 0.02, 0.97], [0, -0.03, 1.2], [0, -0.1, 1.42], [0, -0.2, 1.6]], pb = []; PJ.forEach((p, i) => pb.push(rig.bone(i ? pb[i - 1] : head, p, 'pr')));
  const pg = tube(PJ, { rad: (t) => 0.035 * (1 - t * 0.8) + 0.004, seg: low ? 6 : 12, sides: low ? 4 : 6, bulge: (t) => 1 + 0.15 * Math.sin(t * 25) }); paint(pg, (p) => new THREE.Color(0x8a3a60).lerp(new THREE.Color(0xff9ab0), smooth(1.3, 1.6, p.z))); rig.add(skin, skinChain(pg, pb, 0.1));
  for (const s of [-1, 1]) { const fg = spike(0.03, 0.16, { sides: 4, seg: 2, bend: 0.35, bendDir: [-s, 0, 0.3], pos: [s * 0.08, -0.04, 0.93], dir: [s * 0.15, -0.8, 0.5] }); paint(fg, (p) => new THREE.Color(0x70405a).lerp(new THREE.Color(0xfff2e0), smooth(-0.04, -0.14, p.y))); rig.add(bone, skinRigid(fg, head)); }
  // ── cola de tentáculos con cristal ──
  const tails = [];
  [[-0.1, 0.5], [0.1, 0.5], [0, 0.9]].forEach(([x, len], k) => {
    const J = [[x, -0.04, -1.3], [x * 1.5, -0.06, -1.3 - len * 0.35], [x * 2.2, -0.05, -1.3 - len * 0.7], [x * 3, -0.03, -1.3 - len]], bs = []; J.forEach((p, i) => bs.push(rig.bone(i ? bs[i - 1] : ab[3], p, 'tl')));
    const g = tube(J, { rad: (t) => (k === 2 ? 0.045 : 0.03) * (1 - t * 0.85) + 0.005, seg: low ? 8 : 14, sides: low ? 4 : 6, caps: true }); paint(g, (p) => new THREE.Color(0x60306a).lerp(new THREE.Color(color), smooth(-1.3 - len * 0.5, -1.3 - len, p.z) * 0.7)); rig.add(skin, skinChain(g, bs, 0.12)); tails.push({ bs, k });
    if (k === 2) rig.add(cry, skinRigid(crystal(0.05, 0.26, { sides: 6, taper: 0.7, tip: 0.4, pos: J[3], dir: [0, 0.1, -1], seed: 9, c0: 0x20406a, c1: 0xe0ffff }), bs[3]));
  });
  // cristales del lomo
  [[0.42, 0.34, 0.3], [0.1, 0.3, 0.26], [-0.25, 0.25, 0.2]].forEach(([z, y, h], i) => crystalCluster(low ? 1 : 3, 0.04 - i * 0.006, h, { pos: [0, y, z], dir: [0, 1, -0.45], seed: 80 + i, c0: 0x20406a, c1: 0xe0ffff }).forEach((c) => rig.add(cry, skinRigid(c, body))));
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group);
  const halo = glowSprite(color, 3.2, 0.0); halo.position.set(0, 0.1, 0.1); rootObj.add(halo);
  const aura = shieldAura(0xaa88ff, 1.5); rootObj.add(aura);
  const wl = new Spring(0, 70, 8), wr = new Spring(0, 70, 8), tailS = new Spring(0, 45, 5), headY = new Spring(0, 90, 10), headX = new Spring(0, 90, 10);
  let phase = Math.random() * 6, windK = 0, diveK = 0, prK = 0; const tmp = new V3(), look = new V3(0, 0, 1), q1 = new THREE.Quaternion(), lh = new V3();
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(Math.max(dt, 0.001), 0.05); const speed = Math.min(1.5, ctx.speed || 0);
    if (ctx.look) look.copy(ctx.look);
    const wind = st.s === 'wind', dive = st.s === 'dive', hurt = (st.hp ?? 1) < 0.35, stun = !!st.st;
    windK = dampTo(windK, wind ? 1 : 0, 12, dt); diveK = dampTo(diveK, dive ? 1 : 0, 9, dt); const tense = Math.max(windK, diveK);
    phase += dt * TAU * (1.5 + speed * 1.4) * (stun ? 0.4 : hurt ? 0.75 : 1) * (1 - 0.9 * tense) + (hurt ? Math.sin(t * 9) * dt * 1.5 : 0);
    const amp = 0.62 * (1 - tense) * (stun ? 0.5 : 1), base = Math.sin(phase) * amp + 0.1 - (stun ? 0.35 : 0);
    const tgt = base + windK * (1.0 + Math.sin(t * 42) * 0.035 - base) + diveK * (-0.12 - base);
    const fl = tgt * (hurt ? 0.55 : 1) - (hurt ? 0.18 : 0), fr = tgt, sweep = 0.12 + windK * 0.6 + diveK * 1.2;
    const sl = wl.step(dt, fl * 1.25), sr = wr.step(dt, fr * 1.25);
    wings.forEach((w) => { const side = w.side, f = side < 0 ? fl : fr, spr = side < 0 ? sl : sr;
      w.sh.rotation.set(0, side * sweep, side * f); w.el.rotation.set(0, side * (0.08 + windK * 0.5 + diveK * 0.25), side * ((spr - f) * 0.85 - 0.1 - windK * 0.6));
      w.tip.rotation.z = side * (spr - f) * 0.5; w.hw.rotation.set(0, side * 0.2 * windK, side * (spr * 0.4 - 0.05)); w.hwt.rotation.z = side * (spr - f) * 0.6 - side * 0.1 * Math.sin(phase - 0.8); });
    wingF.userData.u.uWind.value = wingH.userData.u.uWind.value = windK;
    // cuerpo: banqueo, rebote con cada aleteo, estiramiento en la picada, repliegue en el aviso
    const bob = Math.sin(phase) * 0.07 * (1 - tense);
    body.position.y = body.userData.rest.y + bob; body.rotation.z = Math.sin(t * 0.55 + st.id) * 0.16 * (1 - tense) + (hurt ? Math.sin(t * 3.1) * 0.14 : 0); body.rotation.x = diveK * 0.34 - windK * 0.28 + Math.cos(phase) * 0.04;
    const br = 1 + Math.sin(t * 2.3 + st.id) * 0.025; body.scale.set(lerp(1, 0.8, diveK) * (1 - 0.06 * windK) * br, lerp(1, 0.82, diveK) * (1 - 0.05 * windK) * br, lerp(1, 1.3, diveK) * (1 + 0.04 * windK));
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    head.rotation.y = headY.step(dt, clamp(lx, -0.9, 0.9) * 0.7); head.rotation.x = headX.step(dt, -clamp(ly, -0.6, 0.6) * 0.5 + diveK * 0.1);
    // ojos
    head.updateMatrix(); boneQuat(head, root, q1); q1.invert();
    eyes.forEach((e, k) => { gazeDir(look, ctx.dist, tmp.set(k ? 0.15 : -0.15, 0.25, 0.97), lh); lh.applyQuaternion(q1); lh.applyQuaternion(e.mount.clone().invert()); e.update(dt, lh, { open: stun ? 0.4 : hurt ? 0.7 : dive ? 1 : 0.92, dilate: dive ? -0.4 : wind ? 0.5 : 0, glowMul: 1 + windK * 2.2, squint: diveK * 0.6, quiver: stun ? 1 : 0 }); });
    // trompa: enrollada en reposo, se desenrolla al picar
    prK = dampTo(prK, dive ? 1 : wind ? 0.4 : 0, 12, dt);
    pb.forEach((b, i) => { const curl = (1 - prK) * (i === 0 ? 1.0 : 1.5) + (dive ? Math.sin(t * 20) * 0.04 : 0); b.rotation.x = -curl; });
    ants.forEach((bs, k) => { bs.forEach((b, i) => { b.rotation.x = Math.sin(t * 2.6 + k * 2 + i * 0.7) * 0.12 - diveK * 0.35 * (i ? 0 : 1) + windK * 0.3 * (i ? 0 : 1); b.rotation.y = Math.sin(t * 1.9 + k + i) * 0.1 * (k ? 1 : -1); }); });
    // cola: se arquea con el movimiento, se enrolla en el aviso, se endereza en la picada
    const tp = tailS.step(dt, -Math.cos(phase) * 0.22 * (1 - tense) + windK * 0.9 - diveK * 0.1 + (hurt ? 0.3 : 0));
    ab.forEach((b, i) => { b.rotation.x = tp * 0.3 + (hurt ? 0.05 : 0); b.rotation.y = Math.sin(t * 1.3 + i * 0.8) * 0.12 * (1 - diveK); });
    tails.forEach((T) => T.bs.forEach((b, i) => { const a = lerp(0.3, 0.6, windK) * (1 - 0.8 * diveK) * (1 + 0.2 * T.k); b.rotation.y = Math.sin(t * (2.1 + T.k * 0.4 + windK * 5) + i * 1.0 + T.k) * a * 0.5; b.rotation.x = Math.cos(t * 1.7 + i * 0.9 + T.k) * a * 0.3 + windK * 0.3; }));
    const pulse = 0.9 + 0.4 * Math.sin(t * 6);
    cry.emissiveIntensity = pulse * 0.8 + windK * 2.6;
    skin.userData.u.uVeinGlow.value = 0.7 + windK * 2.2 + diveK * 0.5; skin.userData.u.uSss.value = 0.4 + windK * 0.8; bone.userData.u.uSeamGlow.value = 0.3 + windK * 1.5;
    halo.material.opacity = windK * 0.75 + diveK * 0.15; halo.scale.setScalar(2.6 + windK * 1.6 + Math.sin(t * 30) * 0.12 * windK);
    rootObj.rotation.z = stun ? Math.sin(t * 21) * 0.05 : 0; tickAura(aura, st, t);
  } };
}
