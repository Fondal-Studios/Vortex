// MATERIAL BIO-ORGÁNICO ÚNICO (obelisco / ariete / coloso / madre / graviton / aurora / espiral).
// Una sola malla fusionada puede mezclar CARNE, QUITINA, HUESO y CRISTAL: el color sale de los colores de vértice y la clase de
// material del atributo `aS` = (clase, brillo):  0 carne · 1 quitina · 2 hueso/cuerno · 3 cristal facetado emisivo · 4 membrana.
// Detalle de superficie 100 % procedural (relieve por derivadas de pantalla, venas, poros, grietas luminosas, anillos de crecimiento).
// Uniformes vivos en mat.userData.u: uHurt, uGlow, uPulse, uVeinGlow, uCry, uGlowCol...  (compatibles con el destello de daño del motor).
// Con { tent:N } soporta un HAZ de N tentáculos en UNA malla (ver obelisco-geo.js › tentacleBundle).
import * as THREE from 'three';
import { uTime } from '../shaders.js';
import { cfg } from '../quality.js';

const NOISE = `
  float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }`;

const guard = (src) => src.replace('#include <opaque_fragment>', `#include <opaque_fragment>
        { vec3 gc = gl_FragColor.rgb; if (!(gc.x == gc.x && gc.y == gc.y && gc.z == gc.z)) gc = vec3(0.0); gl_FragColor.rgb = min(gc, vec3(200.0)); }`);

export function bioMaterial(o = {}) {
  const lvl = cfg().humans, hi = lvl !== 'low', Cls = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new Cls({ vertexColors: true, roughness: 0.5, metalness: 0, side: o.double ? THREE.DoubleSide : THREE.FrontSide, envMapIntensity: o.env ?? 0.2 });
  if (hi) { mat.specularIntensity = o.spec ?? 0.45; mat.clearcoat = o.coat ?? 0.45; mat.clearcoatRoughness = 0.25; mat.sheen = o.sheen ?? 0.12; mat.sheenColor = new THREE.Color(o.rim ?? 0x805060); mat.sheenRoughness = 0.5; }
  if (o.alpha != null && o.alpha < 1) { mat.transparent = true; mat.opacity = o.alpha; mat.depthWrite = o.depthWrite ?? true; }
  const NT = o.tent || 0;
  const u = {
    uTime, uHurt: { value: 0 }, uGlow: { value: o.glowAmt ?? 0 }, uPulse: { value: 0 }, uBreath: { value: o.breath ?? 0.012 },
    uGlowCol: { value: new THREE.Color(o.glow ?? 0xffa040) }, uVein: { value: new THREE.Color(o.vein ?? 0x2a0610) }, uRim: { value: new THREE.Color(o.rim ?? 0x703050) },
    uPS: { value: o.scale ?? 1 }, uBump: { value: o.bump ?? 1 }, uCry: { value: 1 }, uWet: { value: o.wet ?? 0.4 }, uVeinGlow: { value: o.veinGlow ?? 0 }, uCrackGlow: { value: o.crackGlow ?? 0 },
    uFres: { value: o.fres ?? 0 }, uBell: { value: new THREE.Vector3(0, 1, 0) }, uRadial: { value: o.radial ?? 0 }, uRidge: { value: o.ridge ?? 40 }, uMetal: { value: o.metal ?? 0.12 }, uAlb: { value: o.albedo ?? 0.55 }, uLift: { value: o.lift ?? (hi ? 0.9 : 0.6) }, uSelf: { value: o.self ?? (hi ? 0.05 : 0.22) }, uRimK: { value: o.rimK ?? 1.0 },
  };
  if (NT) { u.uTA = { value: Array.from({ length: NT }, () => new THREE.Vector4(0.3, 1.5, 0, 1)) }; u.uTB = { value: Array.from({ length: NT }, () => new THREE.Vector4(0, 0, 0, 0)) }; }
  mat.userData.u = u;
  const key = 'bio' + (NT ? 't' + NT : '') + (hi ? 'h' : 'l') + (o.double ? 'd' : '');
  mat.customProgramCacheKey = () => key; // mismo programa para todas las instancias de la misma variante
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 aS; varying vec3 vO; varying vec2 vS; varying vec2 vU; varying float vSc;
        uniform float uTime, uBreath, uPulse; uniform vec3 uBell;
        ${NT ? `attribute vec4 aT; attribute vec3 aD; uniform vec4 uTA[${NT}]; uniform vec4 uTB[${NT}];` : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vO = position; vS = aS; vU = uv; vSc = length(modelMatrix[0].xyz);
        { float fl = 1.0 - step(0.5, aS.x);
          transformed += normal * fl * (sin(uTime * 2.1 + dot(position, vec3(1.7, 0.9, 1.3)) * 2.0) * uBreath + uPulse * 0.03 * sin(uTime * 19.0 + position.y * 5.0)); }
        { float mbr = step(3.5, aS.x); float f = clamp(1.0 - position.y / max(uBell.y, 0.001), 0.0, 1.0); transformed.xz *= 1.0 - uBell.x * 0.3 * f * f * mbr; transformed.y *= 1.0 + uBell.x * 0.12 * mbr; }
        ${NT ? `{ int id = int(aT.x + 0.5); vec4 A = uTA[id]; vec4 B = uTB[id]; float k = aT.y, L = aT.w, w = k * k;
          vec3 d = normalize(aD); vec3 s1 = normalize(cross(d, abs(d.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))); vec3 s2 = cross(d, s1);
          float tt = uTime * A.y;
          transformed += (s1 * sin(tt + k * 3.1 + aT.z) + s2 * cos(tt * 0.83 + k * 3.9 + aT.z * 1.3)) * A.x * w;
          transformed += B.xyz * (B.w * w * L) + d * ((A.w - 1.0) * k * L); }` : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uHurt, uGlow, uPS, uBump, uCry, uWet, uVeinGlow, uCrackGlow, uRidge, uMetal, uAlb, uFres, uRadial, uLift, uSelf, uRimK;
        uniform vec3 uGlowCol, uVein, uRim;
        varying vec3 vO; varying vec2 vS; varying vec2 vU; varying float vSc;
        float gFl, gCh, gBo, gCr, gVein, gCrack, gH, gN2, gN3;
        ${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float cls = vS.x;
          gFl = 1.0 - smoothstep(0.4, 0.6, cls);
          gCh = smoothstep(0.4, 0.6, cls) * (1.0 - smoothstep(1.4, 1.6, cls));
          gBo = smoothstep(1.4, 1.6, cls) * (1.0 - smoothstep(2.4, 2.6, cls));
          gCr = smoothstep(2.4, 2.6, cls) * (1.0 - smoothstep(3.4, 3.6, cls));
          float gMb = smoothstep(3.4, 3.6, cls);
          vec3 q = vO * uPS;
          float n1 = vn(q * 2.7), n2 = vn(q * 7.0 + 4.0), n3 = vn(q * ${hi ? '17.0' : '11.0'} + 9.0);
          gN2 = n2; gN3 = n3;
          float vein = (1.0 - smoothstep(0.012, 0.055, abs(vn(q * 4.1 + 2.0) - 0.5))) * smoothstep(0.25, 0.6, n1 + 0.2 * n2);
          float vein2 = (1.0 - smoothstep(0.01, 0.04, abs(vn(q * 9.5 + 6.0) - 0.5))) * 0.6;
          gVein = max(vein, vein2) * (gFl + gMb);
          if (uRadial > 0.5) { float cn = pow(abs(sin(atan(vO.z, vO.x + 1e-5) * uRadial * 0.5 + 0.7 * vn(vO * 3.0))), 28.0) * (gFl + gMb) * smoothstep(0.98, 0.5, vU.y); gVein = max(gVein * 0.35, cn); }
          vec3 flesh = diffuseColor.rgb * (0.72 + 0.55 * n1 + 0.15 * n3);
          flesh = mix(flesh, uVein, clamp(gVein, 0.0, 1.0) * 0.6);
          float crack = 1.0 - smoothstep(0.006, 0.03, abs(vn(q * 5.3 + 7.0) - 0.5));
          gCrack = crack * gCh;
          vec3 chit = diffuseColor.rgb * (0.62 + 0.6 * n2 + 0.2 * n3);
          chit *= 1.0 - 0.7 * crack;
          chit = mix(chit, diffuseColor.rgb * 1.7, smoothstep(0.78, 0.95, n3) * 0.35);
          float rg = sin(vU.y * uRidge + n1 * 5.0), rgs = 0.5 + 0.5 * rg;
          vec3 bone = diffuseColor.rgb * (0.6 + 0.32 * rgs + 0.3 * n2);
          bone = mix(bone, bone * vec3(0.78, 0.6, 0.5), smoothstep(0.55, 0.9, n1) * 0.6);
          vec3 cry = diffuseColor.rgb * 0.22;
          float ann = sin(vU.y * uRidge * 0.6 + n1 * 2.0);
          gH = gFl * (n3 * 0.45 + n2 * 0.35 - vein * 0.6 + ann * 0.12) + gCh * (n3 * 0.4 + n2 * 0.3 - crack * 0.9 + ann * 0.3) + gBo * (rg * 0.55 + n3 * 0.3) + gMb * n3 * 0.3;
          diffuseColor.rgb = pow(max((flesh * (gFl + gMb) + chit * gCh + bone * gBo + cry * gCr) * uAlb, vec3(0.0)), vec3(uLift));
          #ifndef FLAT_SHADED
          if (uFres > 0.0) { float fr0 = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))); diffuseColor.a *= clamp(0.35 + uFres * pow(fr0, 2.0) + gVein * 0.5, 0.0, 1.0); }
          #endif
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(gFl * (0.62 - uWet * 0.3 * gN2) + gCh * (0.34 + 0.3 * gN3) + gBo * (0.74 - 0.12 * gN2) + gCr * 0.16 + (1.0 - gFl - gCh - gBo - gCr) * 0.2, 0.14, 1.0);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = gCh * uMetal + gCr * 0.5;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 fdx = dFdx(vViewPosition), fdy = dFdy(vViewPosition);
          vec3 fcr = cross(fdx, fdy); normal = normalize(mix(normal, fcr * inversesqrt(max(dot(fcr, fcr), 1e-20)), gCr));
          float bs = uBump * (gFl * 0.42 + gCh * 0.9 + gBo * 0.8);
          float fade = 1.0 / (1.0 + length(fwidth(vO)) * uPS * 90.0);
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(gH), dhy = dFdy(gH);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          if (abs(det) > 1e-9) { vec3 grad = (dhx * r1 + dhy * r2) / det; if (all(lessThan(abs(grad), vec3(1e5)))) { vec3 nn = normal - clamp(bs * 0.016 * fade * vSc, 0.0, 1.0) * grad; if (dot(nn, nn) > 1e-6) normal = normalize(nn); } }
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 Vw = normalize(vViewPosition);
          float fres = pow(1.0 - clamp(dot(normal, Vw), 0.0, 1.0), 3.0);
          totalEmissiveRadiance += uRim * fres * uRimK * (0.6 * gFl + 0.9 * gCh + 0.5 * gBo);
          totalEmissiveRadiance += diffuseColor.rgb * uSelf * (1.0 - gCr);
          float flick = 0.75 + 0.25 * sin(uTime * 3.0 + vO.y * 3.0 + vO.x * 2.0);
          totalEmissiveRadiance += uGlowCol * (vS.y * uGlow * flick * (1.0 - gCr) + gVein * uVeinGlow * flick + gCrack * uCrackGlow * flick);
          totalEmissiveRadiance += vColor.rgb * gCr * uCry * (0.35 + vS.y * 1.6) * (0.85 + 0.15 * flick);
          totalEmissiveRadiance += vec3(1.0, 0.85, 0.7) * uHurt * 0.9;
        }`);
    if (hi) sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat *= (0.4 * gFl + 0.3 * gCh + 0.1 * gBo + 1.0 * gCr);
        #endif`);
    sh.fragmentShader = guard(sh.fragmentShader);
  };
  return mat;
}

/* ───────────────────────── OJOS ───────────────────────── */
// Esfera pintada por shader: esclerótica con venas, iris fibroso con anillo límbico y pupila (redonda / rendija / horizontal).
// Mira hacia +z local. Con `lids:true` los PÁRPADOS también se pintan en el shader (sin mallas extra): la mirada se desplaza girando el iris
// (uGazeM) mientras los párpados quedan fijos en la cuenca; uOpen=(alto superior, alto inferior, inclinación de la ceja).
export function eyeMaterial({ iris = 0xffb020, sclera = 0xd8c8b8, pupil = 'round', glow = 0.6, irisR = 0.46, instanced = false, lids = false, lid = 0x4a2a34 } = {}) {
  const hi = cfg().humans !== 'low', Cls = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new Cls({ color: 0xffffff, roughness: 0.55, metalness: 0 });
  if (hi) { mat.clearcoat = 0.6; mat.clearcoatRoughness = 0.2; mat.specularIntensity = 0.5; }
  const u = { uTime, uHurt: { value: 0 }, uIris: { value: new THREE.Color(iris) }, uScl: { value: new THREE.Color(sclera) }, uPup: { value: 0.5 }, uIrisR: { value: irisR }, uSlit: { value: pupil === 'slit' ? 1 : pupil === 'goat' ? 2 : 0 }, uGlow: { value: glow }, uSeed: { value: Math.random() * 9 },
    uGazeM: { value: new THREE.Matrix3() }, uOpen: { value: new THREE.Vector3(0.8, 0.6, 0) }, uLid: { value: new THREE.Color(lid) } };
  mat.userData.u = u;
  const key = 'eye' + (instanced ? 'i' : '') + (lids ? 'L' : '') + (hi ? 'h' : 'l');
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vO;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvO = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uHurt, uPup, uIrisR, uSlit, uGlow, uSeed; uniform vec3 uIris, uScl, uOpen, uLid; uniform mat3 uGazeM; varying vec3 vO;
        float gLid;
        ${NOISE}
        vec3 eyeCol(out float irisK, out float pupK){
          vec3 p0 = normalize(vO);
          ${lids ? 'vec3 p = uGazeM * p0;' : 'vec3 p = p0;'}
          vec2 e = p.xy / (1.0 + max(p.z, -0.95));
          float R = length(e), irisR = uIrisR, ang = atan(e.y, e.x + 1e-5);
          vec2 pe = e / irisR; float pr = uPup * 0.62;
          vec2 pd = uSlit > 1.5 ? vec2(pe.x / (pr * 1.5), pe.y / (pr * 0.38)) : uSlit > 0.5 ? vec2(pe.x / (pr * 0.2), pe.y / (pr * 1.25)) : pe / pr;
          float pdist = length(pd), aa = fwidth(pdist) * 1.5 + 0.02;
          pupK = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, pdist);
          float rr = R / irisR; irisK = 1.0 - smoothstep(0.96, 1.02, rr);
          float fib = vn(vec3(cos(ang) * 5.0 + uSeed, sin(ang) * 5.0, rr * 2.2)) * 0.6 + vn(vec3(cos(ang) * 14.0, sin(ang) * 14.0 + uSeed, rr * 3.0)) * 0.4;
          vec3 ic = uIris * (0.12 + 0.6 * fib);
          ic = mix(ic, uIris * 0.9 + vec3(0.03), smoothstep(0.55, 0.2, rr) * 0.5);
          ic *= mix(1.0, 0.15, smoothstep(0.74, 1.0, rr));
          float v1 = 1.0 - smoothstep(0.02, 0.09, abs(vn(vec3(cos(ang) * 4.0, sin(ang) * 4.0, R * 6.0 + uSeed)) - 0.5));
          vec3 sc = uScl * (0.65 + 0.3 * vn(p0 * 7.0)); sc *= vec3(1.0, 0.88, 0.72); sc = mix(sc, vec3(0.55, 0.04, 0.06), v1 * smoothstep(irisR * 0.9, irisR * 2.2, R) * 0.95);
          sc *= 1.0 - 0.55 * smoothstep(irisR * 1.8, 2.6, R);
          vec3 c = mix(sc, ic, irisK);
          gLid = 0.0;
          ${lids ? `{
            vec2 q = p0.xy / (1.0 + max(p0.z, -0.95));
            float k = 1.0 - (q.x * q.x) / 0.9025;
            float hu = uOpen.x * k + uOpen.z * q.x, hl = uOpen.y * k;
            float m = min(hu - q.y, q.y + hl); m = min(m, k * 0.6);
            float w = fwidth(m) * 1.5 + 0.012;
            gLid = 1.0 - smoothstep(-w, w, m);
            float sh = smoothstep(0.0, 0.22, m);                         // sombra del párpado sobre el ojo
            c *= 0.35 + 0.65 * sh; irisK *= (0.5 + 0.5 * sh);
            float lash = 1.0 - smoothstep(0.0, 0.05, abs(m));
            vec3 skin = uLid * (0.6 + 0.6 * vn(p0 * 5.0 + 3.0)) * (0.7 + 0.3 * smoothstep(0.0, 0.5, -m));
            float ven = (1.0 - smoothstep(0.015, 0.05, abs(vn(p0 * 9.0 + 5.0) - 0.5))) * 0.5;
            skin = mix(skin, skin * vec3(0.35, 0.2, 0.25), ven);
            skin = mix(skin, skin * 0.3, lash);
            c = mix(c, skin, gLid);
          }` : ''}
          return c;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float irisK, pupK; vec3 eyeC = eyeCol(irisK, pupK);
        #ifdef USE_COLOR
          eyeC = mix(eyeC, eyeC * vColor.rgb * 1.5, irisK);
        #endif
        pupK *= (1.0 - gLid); irisK *= (1.0 - gLid);
        diffuseColor.rgb = eyeC * (1.0 - pupK) + vec3(0.004, 0.0, 0.006) * pupK;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.62, gLid);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * irisK * (1.0 - pupK) * uGlow * 0.55;
        { float cl = smoothstep(0.965, 0.99, dot(normal, normalize(vec3(-0.45, 0.6, 0.66)))); totalEmissiveRadiance += vec3(1.0, 0.97, 0.92) * cl * 0.45 * (1.0 - pupK) * (1.0 - gLid); }
        totalEmissiveRadiance += vec3(1.0, 0.85, 0.7) * uHurt * 0.6;`);
    if (hi) sh.fragmentShader = sh.fragmentShader.replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        #ifdef USE_CLEARCOAT
          material.clearcoat *= (1.0 - 0.75 * gLid);
        #endif`);
    sh.fragmentShader = guard(sh.fragmentShader);
  };
  return mat;
}
