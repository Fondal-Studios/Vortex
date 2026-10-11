// KIT ORGÁNICO · OJOS — córnea abombada con reflejo húmedo, esclerótica con venitas, IRIS procedural radial (fibras, collarete,
// anillo límbico), pupila redonda/rasgada/horizontal que se dilata, párpados superior e inferior con borde húmedo, parpadeo
// asimétrico, sacadas, mirada con retardo natural y variantes (predator, cyclops, compound, insect).
// Compatibilidad con el kit viejo: object.children = [esclera, grupo-mirada(iris, pupila, córnea…), párpados]; mats = [esclera, iris, …].
import * as THREE from 'three';
import { uTime } from './shaders.js';
import { cfg } from './quality.js';
import { NOISE_GLSL, isLow, lidMaterial, registerMat } from './organism-skin.js';

const V3 = THREE.Vector3, Col = THREE.Color, TAU = Math.PI * 2;
const geoCache = new Map();
const cache = (k, f) => { let g = geoCache.get(k); if (!g) { g = f(); geoCache.set(k, g); } return g; };
const clamp = THREE.MathUtils.clamp;

const KINDS = {
  //            iris(ang) pupila-forma   párpado sup.  ojo-compuesto
  normal:   { irisAng: 0.52, pupil: 'round', cover: 0.62 },
  predator: { irisAng: 0.66, pupil: 'slit', cover: 0.42 },
  cyclops:  { irisAng: 0.72, pupil: 'round', cover: 0.7 },
  insect:   { irisAng: 0.0, pupil: 'round', cover: 0.9, compound: 9 },
  compound: { irisAng: 0.0, pupil: 'round', cover: 0.9, compound: 16 },
};

const SEGS = () => (isLow() ? [14, 10] : cfg().humans === 'medium' ? [20, 14] : [28, 20]);

function sclera(color, vein, kind, lowQ) {
  const Cls = lowQ ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const m = new Cls({ color, roughness: 0.2, emissive: new Col(0x3a1a14), emissiveIntensity: 0.35 });
  if (!lowQ) { m.clearcoat = 0.8; m.clearcoatRoughness = 0.06; }
  const u = { uHurt: { value: 0 }, uGlow: { value: 0 }, uVeinC: { value: new Col(vein) }, uVeinK: { value: 1 }, uIrisAng: { value: 0.5 }, uLook: { value: new V3(0, 0, 1) }, uCol: { value: new Col(0xffc23a) }, uDil: { value: 0.3 }, uTime };
  m.userData.u = u;
  const comp = !!KINDS[kind].compound;
  m.customProgramCacheKey = () => `org-eyeball-${comp ? 'c' : 'n'}-${lowQ ? 'L' : 'H'}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObj;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vObj; uniform float uTime,uHurt,uGlow,uVeinK,uIrisAng,uDil; uniform vec3 uVeinC,uLook,uCol; ${NOISE_GLSL}`)
      .replace('#include <color_fragment>', comp ? `#include <color_fragment>
        vec3 d = normalize(vObj); float cellN = ${KINDS[kind].compound}.0 * 1.0;
        vec3 q = d * cellN * 2.0; vec3 cid = floor(q + 0.5); vec3 cf = q - cid;
        float hsh = h31(cid + 3.1); float fac = 1.0 - smoothstep(0.25, 0.62, length(cf));
        float ps = smoothstep(0.82, 0.97, dot(d, normalize(uLook)));                  // pseudopupila: la mancha oscura que sigue al que mira
        vec3 fc = mix(uCol * 0.35, uCol * 1.15, fac);
        fc = mix(fc, fc * (0.6 + 0.8 * vec3(hsh, fract(hsh * 7.3), fract(hsh * 3.7))), 0.55);
        fc = mix(fc, vec3(0.02, 0.015, 0.02), ps * 0.85);
        diffuseColor.rgb = fc;` : `#include <color_fragment>
        vec3 d = normalize(vObj);
        float side = 1.0 - smoothstep(0.1, 0.85, d.z);
        float v1 = abs(vn(d * 7.0) - 0.5), v2 = abs(vn(d * 15.0 + 4.0) - 0.5);
        float vein = max(1.0 - smoothstep(0.0, 0.03, v1), (1.0 - smoothstep(0.0, 0.02, v2)) * 0.8) * (0.2 + 0.8 * side) * uVeinK;
        diffuseColor.rgb = mix(diffuseColor.rgb, uVeinC, vein * 0.75);
        diffuseColor.rgb *= 0.88 + 0.2 * vn(d * 3.0 + 2.0);
        diffuseColor.rgb *= 1.0 - 0.45 * smoothstep(0.55, 0.95, abs(d.y));              // oclusión de párpados
        float ang = acos(clamp(d.z, -1.0, 1.0)); diffuseColor.rgb *= 0.55 + 0.45 * smoothstep(uIrisAng * 0.92, uIrisAng * 1.4, ang);   // limbo`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.85, 0.7) * uHurt * 0.8 ${comp ? '+ uCol * uGlow * 0.5 * (0.4 + 0.6 * fac)' : ''};`);
  };
  return registerMat(m, true);
}

function irisMaterial(color, lowQ) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0, emissive: new Col(color), emissiveIntensity: 0.5 });
  const u = { uHurt: { value: 0 }, uGlow: { value: 0.5 }, uCol: { value: new Col(color) }, uCapR: { value: 1 }, uIrisAng: { value: 0.5 }, uPup: { value: new THREE.Vector2(0.3, 0.3) }, uTime, uMode: { value: 0 }, uRing: { value: new Col(color).multiplyScalar(0.35) }, uSeed: { value: Math.random() * 20 } };
  m.userData.u = u;
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  m.customProgramCacheKey = () => `org-iris-${lowQ ? 'L' : 'H'}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uCapR; varying vec3 vDir;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDir = normalize(position); transformed = vDir * uCapR;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vDir; uniform float uTime,uHurt,uGlow,uIrisAng,uMode,uSeed; uniform vec2 uPup; uniform vec3 uCol,uRing; ${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 dn = normalize(vDir); float ang = acos(clamp(dn.z, -1.0, 1.0));
        vec2 q = dn.xy / max(sin(uIrisAng), 0.05); float rr = length(q);                     // 0 centro .. 1 borde del iris
        if (rr > 1.0) discard;
        vec2 dirq = rr > 1e-4 ? q / rr : vec2(1.0, 0.0);
        float pe = length(q / max(uPup, vec2(0.02)));                                       // <1 dentro de la pupila
        // fibras radiales (dos octavas), collarete en ~0.42 y anillo límbico oscuro en el borde
        vec3 rp = vec3(dirq * 13.0, rr * 2.2 + uSeed);
        float f1 = vn(rp), f2 = vn(vec3(dirq * 31.0, rr * 4.0 + 9.0 + uSeed));
        float fib = 0.55 * f1 + 0.45 * f2;
        float zig = 0.42 + (vn(vec3(dirq * 7.0, 1.0 + uSeed)) - 0.5) * 0.12;
        float coll = smoothstep(zig - 0.1, zig, rr) * (1.0 - smoothstep(zig, zig + 0.1, rr));
        float inner = 1.0 - smoothstep(0.0, 0.5, rr);
        vec3 ic = mix(uCol * 0.6, uCol * 1.25 + vec3(0.06), inner);
        ic = mix(ic, uCol * 1.5 + vec3(0.1, 0.07, 0.0), coll * 0.55);
        ic *= 0.55 + 0.9 * fib;
        ic = mix(ic, uRing * 0.35, smoothstep(0.76, 1.0, rr));                                // anillo límbico
        ic *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.5, abs(q.y)));                          // sombra suave del párpado
        float pm = 1.0 - smoothstep(0.88, 1.0, pe);                                          // pupila (borde suave)
        ic = mix(ic, vec3(0.012, 0.008, 0.012), pm);
        ic += uCol * 0.5 * smoothstep(1.0, 1.35, pe) * (1.0 - smoothstep(1.35, 1.8, pe)) * 0.3;   // halo cálido junto a la pupila
        diffuseColor.rgb = ic; float irisMask = 1.0 - pm;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = diffuseColor.rgb * uGlow * 0.9 * irisMask * (0.55 + 0.9 * fib) + vec3(1.0, 0.85, 0.7) * uHurt * 0.8 * irisMask;`);
  };
  return registerMat(m, true);
}

function corneaMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.035, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  m.customProgramCacheKey = () => 'org-cornea';
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `
      // sólo el reflejo húmedo: especular real (sol + entorno) + un reflejo de ventana fijo que le da vida siempre
      vec3 Vc = normalize(vViewPosition); vec3 Rc = reflect(-Vc, normal);
      float win = smoothstep(0.945, 0.975, dot(Rc, normalize(vec3(-0.38, 0.62, 0.69)))) + 0.5 * smoothstep(0.96, 0.985, dot(Rc, normalize(vec3(0.5, -0.35, 0.8))));
      float fr = pow(1.0 - clamp(dot(normal, Vc), 0.0, 1.0), 3.0);
      vec3 spec = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
      gl_FragColor = vec4(spec + vec3(win * 0.85 + fr * 0.06), 1.0);`);
  };
  return registerMat(m, true);
}

/**
 * Ojo vivo. Opciones: r (radio), iris (color), pupil ('round'|'slit'|'horizontal'), glow, kind ('normal'|'predator'|'cyclops'|'insect'|'compound'),
 * sclera (color), vein (color de venitas), lidSkin (material de piel de la criatura para los párpados), lids (false = sin párpados),
 * follow (0..1: cuánto gira el ojo hacia el objetivo), lag (0..1 inercia de la mirada).
 * update(dt, lookLocal:Vector3, { dilate, glowMul, open (0..1 apertura), blinkRate }) · set { blinkNow() }
 */
export function eye({ r = 0.2, iris = 0xffc23a, pupil, glow = 0.5, kind = 'normal', sclera: sclCol = 0xe3cdbd, vein = 0xb0182e, lidSkin = null, lids = true, follow = 0.55, lag = 0.5 } = {}) {
  const K = KINDS[kind] || KINDS.normal; const lowQ = isLow(); pupil = pupil || K.pupil; const compound = !!K.compound;
  const g = new THREE.Group();
  const sclM = sclera(sclCol, vein, kind, lowQ), irisM = irisMaterial(iris, lowQ), corM = corneaMaterial();
  sclM.userData.u.uIrisAng.value = K.irisAng || 0.5; sclM.userData.u.uCol.value.set(iris);
  const [sw, sh2] = SEGS();
  const ball = new THREE.Mesh(cache(`eyeball${sw}`, () => new THREE.SphereGeometry(1, sw, sh2)), sclM); ball.scale.setScalar(r);
  const look = new THREE.Group();
  // iris: casquete esférico (pegado a la esclera; el tamaño y la compensación de escala se resuelven en el shader → sin z-fighting)
  const irisH = new THREE.Mesh(cache(`eyecap${sw}`, () => { const c = new THREE.SphereGeometry(1.25, sw + 6, Math.max(5, sh2 - 4), 0, TAU, 0, 1.15); c.rotateX(Math.PI / 2); return c; }), irisM);
  irisH.scale.setScalar(r * 0.8); irisH.renderOrder = 1; irisH.visible = !compound;
  // el iris ya va pegado a la esclera por construcción: ignora los viejos parches de posición (fixEye) que lo sacaban de lugar
  Object.defineProperty(irisH.position, 'z', { get() { return 0; }, set() { /* fijo */ }, configurable: true });
  const pupH = new THREE.Object3D();
  Object.defineProperty(pupH.position, 'z', { get() { return 0; }, set() { /* fijo */ }, configurable: true });      // sólo un «manillar» de escala: la pupila se pinta en el shader del iris
  const baseP = pupil === 'slit' ? [0.1, 0.77] : pupil === 'horizontal' ? [0.5, 0.2] : [0.24, 0.24];
  pupH.scale.set(r * baseP[0], r * baseP[1], 1);
  const cornea = new THREE.Mesh(cache(`eyecor${sw}`, () => { const c = new THREE.SphereGeometry(1, sw + 6, Math.max(6, sh2 - 3), 0, TAU, 0, compound ? 1.7 : 1.0); c.rotateX(Math.PI / 2); c.scale(1, 1, 1.0); return c; }), corM);
  cornea.scale.set(r * 1.03, r * 1.03, r * 1.03 * (compound ? 1 : 1.1)); cornea.renderOrder = 2;
  look.add(irisH, pupH, cornea);
  g.add(ball, look);
  // párpados: superior e inferior (medias cáscaras de carne)
  const lidG = new THREE.Group(); const lidMat = lidSkin || lidMaterial();
  const lidGeo = cache(`eyelid${sw}`, () => new THREE.SphereGeometry(1, sw, Math.max(5, sh2 >> 1), 0, TAU, 0, Math.PI / 2));
  const up = new THREE.Mesh(lidGeo, lidMat), lo = new THREE.Mesh(lidGeo, lidMat);
  up.scale.setScalar(r * 1.05); lo.scale.set(r * 1.045, -r * 1.045, r * 1.045); lidG.add(up, lo); g.add(lidG);
  if (!lids) lidG.visible = false;
  const mats = [sclM, irisM];
  const U = irisM.userData.u; U.uMode.value = pupil === 'slit' ? 1 : 0;

  // ── estado de vida ──
  let blinkT = 1 + Math.random() * 3, blink = 0, blink2 = 0, blinkSpd = 1;
  let gx = 0, gy = 0, gvx = 0, gvy = 0, fx = 0, fy = 0, sx = 0, sy = 0, sacT = 0.4 + Math.random(), hip = Math.random() * 6;
  let openS = 1, pupS = 1; const tmp = new V3(); const baseOpen = K.cover;
  const api = {
    object: g, mats, iris: irisH, pupil: pupH, ball, look, lids: { upper: up, lower: lo, group: lidG }, cornea,
    blinkNow() { blink = 1; blinkSpd = 1; },
    update(dt, lookLocal, { dilate = 0, glowMul = 1, open = 1, blinkRate = 1 } = {}) {
      // objetivo de la mirada (como antes: gira 55% hacia donde está el jugador) + sacadas + retardo natural
      let tx = 0, ty = 0;
      if (lookLocal) { tmp.copy(lookLocal).normalize(); const ax = Math.atan2(tmp.x, tmp.z), ay = Math.asin(clamp(tmp.y, -1, 1)); tx = clamp(ax, -0.9, 0.9) * follow; ty = -clamp(ay, -0.7, 0.7) * follow; }
      fx += (tx - fx) * Math.min(1, dt * (14 - 11 * lag)); fy += (ty - fy) * Math.min(1, dt * (14 - 11 * lag));
      sacT -= dt; if (sacT <= 0) { const big = Math.random() < 0.14; const a = big ? 0.16 : 0.05; sx = (Math.random() - 0.5) * a; sy = (Math.random() - 0.5) * a * 0.7; sacT = 0.25 + Math.random() * (big ? 2.2 : 1.1); }
      const k = 220, d = 22; // resorte rápido y amortiguado: sacada = salto breve
      gvx += (k * (fx + sx - gx) - d * gvx) * dt; gx += gvx * dt; gvy += (k * (fy + sy - gy) - d * gvy) * dt; gy += gvy * dt;
      look.rotation.set(gy, gx, 0);
      if (compound) sclM.userData.u.uLook.value.set(Math.sin(gx) * Math.cos(gy), -Math.sin(gy), Math.cos(gx) * Math.cos(gy)); // pseudopupila sigue la mirada
      // parpadeo asimétrico: el superior cae rápido y sube más lento; el inferior sube sólo un poco; a veces doble parpadeo
      blinkT -= dt * blinkRate; if (blinkT <= 0) { blink = 1; blinkSpd = 0.8 + Math.random() * 0.5; blinkT = 1.8 + Math.random() * 4.5; if (Math.random() < 0.15) blinkT = 0.18; }
      blink = Math.max(0, blink - dt * 6.5 * blinkSpd);
      const pb = 1 - blink; const closeK = blink <= 0 ? 0 : pb < 0.35 ? pb / 0.35 : 1 - (pb - 0.35) / 0.65;   // cae rápido, sube lento
      openS += (open - openS) * Math.min(1, dt * 10);
      const ap = clamp(openS, 0, 1);
      const eU = THREE.MathUtils.lerp(-0.1, 0.18 + baseOpen, ap) - closeK * (0.18 + baseOpen + 0.1) + gy * -0.35;     // elevación del borde del párpado superior
      const eL = THREE.MathUtils.lerp(0.05, -0.38, ap) + closeK * 0.3 + gy * -0.15 - 0.05 * (1 - ap);                   // y del inferior
      up.rotation.x = -clamp(eU, -0.3, 1.2); lo.rotation.x = -clamp(eL, -0.9, 0.3);
      // pupila: dilatación + hippus (pulso lento y natural) + modo de forma
      hip += dt; const wob = 1 + 0.05 * Math.sin(hip * 2.3) + 0.03 * Math.sin(hip * 5.1);
      pupS += ((1 + dilate) - pupS) * Math.min(1, dt * 9);
      if (pupil === 'slit') { pupH.scale.x = r * 0.1 * pupS * wob; pupH.scale.y = r * 0.77 * (0.85 + 0.15 * Math.min(1.6, pupS)); }
      else if (pupil === 'horizontal') { pupH.scale.x = r * 0.5 * (0.8 + 0.2 * pupS) * wob; pupH.scale.y = r * 0.2 * pupS; }
      else { pupH.scale.x = r * 0.24 * pupS * wob; pupH.scale.y = pupH.scale.x; }
      // a los uniformes del iris (también respeta que la criatura cambie irisH.scale / pupH.scale por su cuenta)
      const ik = Math.max(0.05, irisH.scale.x / (r * 0.8)), ia = (K.irisAng || 0.5) * ik;
      U.uCapR.value = 1.25 * 1.006 / ik; U.uIrisAng.value = ia;
      const isz = Math.max(1e-4, irisH.scale.x);
      U.uPup.value.set(clamp(pupH.scale.x / isz, 0.03, 1.2), clamp(pupH.scale.y / isz, 0.03, 1.2));
      U.uGlow.value = glow * glowMul;     // la emisión la pinta el shader (la pupila no brilla)
      sclM.userData.u.uIrisAng.value = ia; sclM.userData.u.uCol.value.copy(irisM.userData.u.uCol.value); sclM.userData.u.uGlow.value = glow * glowMul;
    },
  };
  api.update(0.016, null, {});
  return api;
}
