// KIT ORGÁNICO · MATERIALES — piel viva, quitina, membrana, baba, pelaje, hueso y biocristal.
// Todo procedural en el fragment shader (sin texturas): micro-relieve por derivadas (poros, arrugas, escamas),
// subsurface fingido (wrap + translucidez por contraluz + tinte de sangre en bordes finos), brillo húmedo con
// variación, venas que pulsan con el latido, bioluminiscencia con ritmo y heridas (uWound) que aparecen con el daño.
// En calidad 'low' (iPhone) se usa MeshStandardMaterial y una versión recortada del mismo shader.
import * as THREE from 'three';
import { uTime } from './shaders.js';
import { cfg } from './quality.js';

const Col = THREE.Color, V3 = THREE.Vector3;
export const isLow = () => cfg().humans === 'low';
export const isHigh = () => cfg().humans === 'high';

export const NOISE_GLSL = `
  float h31(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }`;

/* ───────────── vértice: respiración, pulso, squash (igual que siempre) + vObj/vScl ───────────── */
const VERT_PARS = `uniform float uTime,uWob,uBreath,uPulse,uPhase; uniform vec3 uSquash; varying vec3 vObj; varying float vScl; ${NOISE_GLSL}`;
const vertBody = (anim) => `#include <begin_vertex>
  vObj = position;
  vScl = (length(modelMatrix[0].xyz) + length(modelMatrix[1].xyz) + length(modelMatrix[2].xyz)) / 3.0;
  ${anim ? `float nz = vn(position * 2.3 + vec3(0.0, uTime * 0.9 + uPhase, 0.0)) - 0.5;
  float br = sin(uTime * 2.2 + uPhase) * uBreath + uPulse * 0.08 * sin(uTime * 22.0);
  transformed += normal * (nz * uWob + br);
  transformed *= uSquash;` : ''}`;

/* ───────────── fragmento: utilidades ───────────── */
const FRAG_PARS = `
  uniform float uTime,uHurt,uGlow,uVeins,uSpots,uScale,uWound,uSSS,uWet,uBump,uMicro,uBeat,uPulse,uPhase,uIri,uAlpha;
  uniform vec3 uVein,uSpot,uBlood;
  varying vec3 vObj; varying float vScl;
  ${NOISE_GLSL}
  float hbeat(float k){ float ph = (uTime * uBeat + uPhase * 0.159) * 6.2832 - k; return pow(0.5 + 0.5 * sin(ph), 5.0) + 0.45 * pow(0.5 + 0.5 * sin(ph - 1.25), 5.0); }
  float fadeF(float f, float fp){ return 1.0 - smoothstep(0.05, 0.2, fp * f); }
  // octava de relieve en unidades de mundo: ridged (arrugas) o valor (grano); amplitud ~ pendiente constante
  float oct(vec3 Pw, float f, float fp, float ridge){ f *= uMicro; float n = vn(Pw * f); float x = n * 2.0 - 1.0; float v = ridge > 0.5 ? 1.0 - sqrt(x * x + 0.04) : n; return v * (0.11 / f) * fadeF(f, fp); }
`;

const START = (low) => `#include <color_fragment>
  vec3 Po = vObj; vec3 Pw = vObj * vScl; float fp = length(fwidth(Pw));
  float fdir = gl_FrontFacing ? 1.0 : -1.0;
  vec3 Vv = normalize(vViewPosition);
  #ifdef FLAT_SHADED
    vec3 N0 = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  #else
    vec3 N0 = normalize(vNormal);
  #endif
  float ndv0 = clamp(abs(dot(N0, Vv)), 0.0, 1.0); float thin = pow(1.0 - ndv0, 2.2);
  float hb = hbeat(Po.y * 2.0 + Po.x);
  float vn1 = vn(Po * uScale * 2.0), vn2 = vn(Po * uScale * 5.0 + 7.0);
  float hh = 0.0; float wd = 0.0, wr = 0.0, veinSoft = 0.0, veinCore = 0.0, spotK = 0.0, spotN = 0.0, pore = 0.0, extraEm = 0.0; vec3 extraC = vec3(0.0);
`;

const VEINS = (low) => `
  {
    float d1 = abs(vn1 - 0.5), d2 = abs(vn(Po * uScale * 4.6 + 19.0) - 0.5);
    float w1 = 0.028 * (1.0 + 0.7 * hb), w2 = 0.02 * (1.0 + 0.5 * hb);
    veinCore = max(1.0 - smoothstep(0.0, w1, d1), (1.0 - smoothstep(0.0, w2, d2)) * 0.7);
    veinSoft = max(1.0 - smoothstep(0.0, w1 * 3.2, d1), (1.0 - smoothstep(0.0, w2 * 3.0, d2)) * 0.7);
    vec3 vc = mix(uVein, uBlood, 0.25 * hb);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55 + vc * 0.45, veinSoft * uVeins * 0.55);   // se ven POR DEBAJO (suaves)
    diffuseColor.rgb = mix(diffuseColor.rgb, vc * 0.8, veinCore * uVeins * 0.5);                                // y el núcleo más nítido
  }`;

const SPOTS = `
  spotN = vn(Po * uScale * 3.2 + 11.0); spotK = smoothstep(0.72, 0.8, spotN) * uSpots;
  diffuseColor.rgb = mix(diffuseColor.rgb, uSpot, spotK);`;

const WOUND = (low) => `
  if (uWound > 0.01) {
    float wn = vn(Po * uScale * 1.1 + 31.0) * 0.65 + vn(Po * uScale * 3.3 + 5.0) * 0.35;
    float th = 1.0 - uWound * 0.62;
    wd = smoothstep(th, th + 0.07, wn); wr = smoothstep(th - 0.07, th, wn) * (1.0 - wd);
    ${low ? '' : `float crack = 1.0 - smoothstep(0.0, 0.018, abs(vn(Po * uScale * 6.0 + 13.0) - 0.5)); wd = max(wd, crack * smoothstep(0.3, 0.7, uWound) * 0.85);`}
    vec3 raw = mix(vec3(0.30, 0.02, 0.04), uBlood * 0.55, 0.3 + 0.3 * hb);
    diffuseColor.rgb *= 1.0 - uWound * 0.16;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.35, 0.45) + vec3(0.06, 0.0, 0.03), wr * 0.8);   // moretón / borde
    diffuseColor.rgb = mix(diffuseColor.rgb, raw, wd);                                                                      // carne viva
    hh -= wd * 0.012 * uBump;                                                                                               // hundida
  }`;

/* cuerpo de cada tipo de material (rellena diffuseColor, hh y variables de emisión) */
const MID = {
  flesh: (low) => `
    float mott = vn(Po * uScale * 0.9 + 3.3);
    diffuseColor.rgb *= 0.86 + 0.28 * mott;
    diffuseColor.rgb = mix(diffuseColor.rgb, uVein, uVeins * 0.26 * (0.4 + 0.6 * vn2));
    ${VEINS(low)}
    ${SPOTS}
    pore = smoothstep(0.66, 0.85, vn(Pw * 46.0 * uMicro)) * fadeF(46.0 * uMicro, fp);
    diffuseColor.rgb *= 1.0 - 0.09 * pore;
    ${WOUND(low)}
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55 + uBlood * 0.35, thin * 0.3 * uSSS);
    hh += oct(Pw, 3.2, fp, 0.0) * 1.2 + ${low ? 'oct(Pw, 22.0, fp, 0.0) * 0.6' : 'oct(Pw, 15.0, fp, 1.0) * 0.55 + oct(Pw, 46.0, fp, 0.0) * 0.45 + oct(Pw, 110.0, fp, 0.0) * 0.3'};`,
  chitin: (low) => `
    // placas: surcos finos entre placas + bandas de crecimiento (capas) + iridiscencia de película delgada
    float g1 = abs(vn(Po * uScale * 1.6) - 0.5); float groove = 1.0 - smoothstep(0.0, 0.05, g1);
    float g2 = abs(vn(Po * uScale * 4.2 + 9.0) - 0.5); float groove2 = (1.0 - smoothstep(0.0, 0.03, g2)) * 0.6;
    float gv = max(groove, groove2);
    float band = 0.5 + 0.5 * sin((Po.y * uScale * 5.0 + Po.z * uScale * 2.0 + vn(Po * uScale * 2.0) * 3.0) * 3.1416);
    vec3 cc = diffuseColor.rgb * (0.78 + 0.4 * band);
    vec3 tf = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + ndv0 * 1.4 + band * 0.18 + vn(Po * 2.0) * 0.3));
    cc = mix(cc, cc * (0.5 + tf * 1.3) + tf * 0.05, uIri * (0.25 + 0.75 * thin));
    cc *= 1.0 - gv * 0.7;
    diffuseColor.rgb = cc;
    ${SPOTS.replace('uSpots', 'uSpots')}
    ${VEINS(low).replace(/uVeins \* 0\.55/g, 'uVeins * 0.18').replace(/uVeins \* 0\.5/g, 'uVeins * 0.15')}
    pore = smoothstep(0.68, 0.86, vn(Pw * 60.0 * uMicro)) * fadeF(60.0 * uMicro, fp);
    diffuseColor.rgb *= 1.0 - 0.06 * pore;
    ${WOUND(low)}
    hh += (band * 0.35 - gv) * 0.012 + oct(Pw, ${low ? '30.0' : '38.0'}, fp, 0.0) * 0.5;`,
  lid: (low) => `
    float mott = vn(Po * uScale * 0.9 + 3.3);
    diffuseColor.rgb *= 0.86 + 0.28 * mott;
    ${VEINS(low)}
    float rim = 1.0 - smoothstep(0.0, 0.1, abs(Po.y)); float rim2 = 1.0 - smoothstep(0.0, 0.03, abs(Po.y));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.5, 0.1, 0.13), rim * 0.55);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.55, 0.55), rim2 * 0.4);
    wr = max(wr, rim2);
    extraEm = rim2 * 0.15; extraC = vec3(1.0, 0.5, 0.5);
    hh += oct(Pw, 14.0, fp, 1.0) * 0.8 + oct(Pw, 46.0, fp, 0.0) * 0.5;`,
  membrane: (low) => `
    float mott = vn(Po * uScale * 0.8 + 3.3);
    diffuseColor.rgb *= 0.85 + 0.3 * mott;
    ${VEINS(low).replace(/0\.028/, '0.034').replace(/uVeins \* 0\.55/g, 'uVeins * 0.9')}
    ${SPOTS}
    diffuseColor.a *= clamp(0.34 + 0.42 * thin + veinSoft * uVeins * 0.5 + 0.12 * mott, 0.0, 1.0) * uAlpha;
    ${WOUND(low)}
    hh += oct(Pw, 9.0, fp, 1.0) * 0.5 + oct(Pw, 38.0, fp, 0.0) * 0.4;`,
  goo: (low) => `
    float flow = vn(Po * uScale * 1.2 + vec3(0.0, -uTime * 0.35, 0.0) + uPhase);
    float flow2 = vn(Po * uScale * 3.1 + vec3(uTime * 0.12, -uTime * 0.6, 0.0));
    diffuseColor.rgb *= 0.8 + 0.4 * flow;
    diffuseColor.rgb = mix(diffuseColor.rgb, uVein, uVeins * 0.35 * smoothstep(0.35, 0.8, flow2));
    ${SPOTS}
    float bub = smoothstep(0.84, 0.9, vn(Po * uScale * 5.5 + 3.0)); extraEm = bub; extraC = vec3(0.9, 1.0, 1.0);
    diffuseColor.a *= clamp(uAlpha * (0.78 + 0.35 * thin), 0.0, 1.0);
    ${WOUND(low)}
    hh += (flow * 0.55 + flow2 * 0.25) * 0.05 + bub * 0.01;`,
  fur: (low) => `
    float mott = vn(Po * uScale * 0.9 + 3.3);
    float st = vn(vec3(Pw.x * 38.0, Pw.y * 9.0, Pw.z * 38.0) * uMicro) * fadeF(38.0 * uMicro, fp);
    diffuseColor.rgb *= 0.78 + 0.3 * mott + 0.3 * (st - 0.5);
    diffuseColor.rgb = mix(diffuseColor.rgb, uVein, uVeins * 0.3 * (0.4 + 0.6 * vn2));
    diffuseColor.rgb = mix(diffuseColor.rgb, uSpot, smoothstep(0.62, 0.9, vn(Po * uScale * 1.4 + 6.0)) * uSpots);
    ${SPOTS}
    ${WOUND(low)}
    extraEm = thin * 0.5; extraC = diffuseColor.rgb * 1.5;
    hh += st * 0.012 + oct(Pw, 6.0, fp, 0.0) * 0.5;`,
  bone: (low) => `
    float mott = vn(Po * uScale * 0.9 + 3.3);
    float str = 0.5 + 0.5 * sin((Pw.y * 34.0 + vn(Po * uScale * 2.5) * 5.0));
    diffuseColor.rgb *= 0.82 + 0.26 * mott;
    diffuseColor.rgb *= 0.94 + 0.08 * str;
    pore = smoothstep(0.7, 0.88, vn(Pw * 55.0 * uMicro)) * fadeF(55.0 * uMicro, fp);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.52, 0.4, 0.34), pore * 0.7);
    float crk = 1.0 - smoothstep(0.0, 0.012, abs(vn(Po * 4.0 + 17.0) - 0.5)); diffuseColor.rgb *= 1.0 - crk * 0.35 * uWound;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.55, 0.45), thin * 0.4 * uSSS);
    hh += oct(Pw, 7.0, fp, 0.0) * 0.6 + oct(Pw, 40.0, fp, 0.0) * 0.5 + (str - 0.5) * 0.006 - crk * 0.01 * uWound;`,
  crystal: (low) => `
    vec3 rf = refract(-Vv, N0, 0.72);
    float caus = 0.5 + 0.5 * sin(dot(rf, vec3(3.1, 5.3, 2.7)) * 7.0 + vn(Po * 3.0) * 4.0 + uTime * 0.4);
    float incl = smoothstep(0.62, 0.9, vn(Po * 5.0 + uPhase));
    float incl2 = smoothstep(0.7, 0.95, vn(Po * 11.0 + 5.0 + uTime * 0.05));
    diffuseColor.rgb = mix(diffuseColor.rgb * 0.7, diffuseColor.rgb * 1.4, caus * 0.55);
    diffuseColor.a = clamp(diffuseColor.a * (0.72 + 0.35 * thin) + incl * 0.25, 0.0, 1.0);
    vec3 tf = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + ndv0 * 1.1 + caus * 0.25));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.4 + tf * 1.4), uIri * 0.5 * thin);
    extraEm = thin * 0.6 + incl * (0.5 + 0.5 * sin(uTime * 2.0 + Po.y * 6.0)) * 0.9 + incl2 * 0.35;
    extraC = mix(diffuseColor.rgb, vec3(1.0), 0.35);
    hh = 0.0;`,
};

const ROUGH = (kind, low) => `#include <roughnessmap_fragment>
  {
    float wetN = vn(Pw * 3.1 + vec3(0.0, uTime * 0.05, 0.0));
    ${kind === 'goo' ? 'roughnessFactor = mix(roughnessFactor, 0.04, 0.8);' : kind === 'crystal' || kind === 'fur' ? '' : 'roughnessFactor = mix(roughnessFactor, 0.1, smoothstep(0.52, 0.8, wetN) * uWet);'}
    roughnessFactor = mix(roughnessFactor, 0.07, clamp(wd * 0.8 + wr, 0.0, 1.0));
    roughnessFactor = mix(roughnessFactor, 1.0, pore * 0.35);
    roughnessFactor = clamp(roughnessFactor, 0.04, 1.0);
  }`;

const NORMAL = (kind) => `#include <normal_fragment_maps>
  ${kind === 'crystal' ? '' : `{
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    float hx = dFdx(hh), hy = dFdy(hh);
    vec3 R1 = cross(sy, normal), R2 = cross(normal, sx);
    float det = dot(sx, R1) * fdir;
    vec3 gr = sign(det) * (hx * R1 + hy * R2);
    normal = normalize(abs(det) * normal - uBump * gr);
  }`}`;

const EMIT = (kind, low) => `#include <emissivemap_fragment>
  {
    // subsurface fingido: luz envolvente + contraluz translúcido tintado de sangre (sólo el sol: directionalLights[0])
    vec3 sss = vec3(0.0);
    #if NUM_DIR_LIGHTS > 0
      vec3 Ls = directionalLights[0].direction; vec3 Lc = directionalLights[0].color;
      float ndl = dot(normal, Ls);
      float wrap = clamp((ndl + 0.55) / 1.55, 0.0, 1.0) - clamp(ndl, 0.0, 1.0);
      float trans = pow(clamp(dot(Vv, -Ls), 0.0, 1.0), 2.5) * (0.2 + 1.2 * thin);
      sss = (wrap * 0.3 + trans * 1.2) * Lc * uBlood * diffuseColor.rgb * uSSS;
    #endif
    float pulseW = 0.65 + 0.35 * sin(uTime * 3.0 + vObj.y * 4.0 + vn1 * 3.0);
    float spotP = 0.5 + 0.5 * sin(uTime * 2.4 - spotN * 18.0 + Po.y * 3.0);
    vec3 em = uSpot * (spotK * (1.2 + 0.9 * pulseW + 0.7 * spotP) + ${kind === 'crystal' || kind === 'bone' ? '0.0' : 'uGlow * pulseW'});
    em += uBlood * veinSoft * uVeins * 0.07 * hb * uSSS;
    em += uSpot * wd * 0.3 * (0.6 + 0.4 * hb);
    em += extraC * extraEm * ${kind === 'crystal' ? '0.6 * (0.35 + uGlow * 0.25)' : '0.25'};
    totalEmissiveRadiance += em + sss + vec3(1.0, 0.85, 0.7) * uHurt * ${kind === 'crystal' ? '0.7' : '0.9'};
  }`;

/* ───────────── fábrica común ───────────── */
function makeUniforms(o) {
  return {
    uTime, uHurt: { value: 0 }, uGlow: { value: o.glow ?? 0 }, uPulse: { value: 0 }, uSquash: { value: new V3(1, 1, 1) },
    uWob: { value: o.wobble ?? 0 }, uBreath: { value: o.breath ?? 0 }, uVein: { value: new Col(o.vein ?? 0x7a0f3a) }, uSpot: { value: new Col(o.spot ?? 0x66ffee) },
    uVeins: { value: o.veins ?? 0.5 }, uSpots: { value: o.spots ?? 0 }, uScale: { value: o.scale ?? 2.2 }, uPhase: { value: Math.random() * 6.28 },
    uWound: { value: 0 }, uSSS: { value: o.sss ?? 1 }, uWet: { value: o.wet ?? 0.7 }, uBump: { value: o.bump ?? 1 }, uMicro: { value: o.micro ?? 1 },
    uBeat: { value: o.beat ?? 1.1 }, uIri: { value: o.iriShader ?? 0 }, uAlpha: { value: o.alpha ?? 1 },
    uBlood: { value: new Col(o.blood ?? new Col(o.color ?? 0xff8a7a).lerp(new Col(o.vein ?? 0x7a0f3a), 0.2).multiplyScalar(1.15)) },
  };
}

/* registro de materiales en orden de creación: permite que setHurt llegue a los ojos de la misma criatura */
const REG = [];
export function registerMat(m, eye = false) { m.userData.seq = REG.length; m.userData.eyeMat = eye; REG.push(m); return m; }

function bio(kind, o = {}, base = {}) {
  const low = isLow(), hi = !low;
  const Cls = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const translucent = (o.alpha ?? 1) < 1 || kind === 'membrane' || kind === 'goo' && (o.alpha ?? 1) < 1;
  const mat = new Cls({ color: o.color ?? 0xff8a7a, roughness: o.rough ?? 0.42, metalness: 0, transparent: translucent, opacity: (kind === 'membrane' || kind === 'goo') ? 1 : (o.alpha ?? 1), side: (kind === 'membrane' || (kind === 'flesh' && (o.alpha ?? 1) < 1)) ? THREE.DoubleSide : THREE.FrontSide, flatShading: !!o.flat, ...base });
  const u = makeUniforms(o); mat.userData.u = u; mat.userData.kind = kind;
  const anim = kind !== 'bone' && kind !== 'crystal' && kind !== 'lid';
  const key = `org-${kind}-${low ? 'L' : 'H'}-${o.flat ? 'f' : 's'}`;
  mat.customProgramCacheKey = () => key;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <begin_vertex>', vertBody(anim));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', START(low) + MID[kind](low))
      .replace('#include <roughnessmap_fragment>', ROUGH(kind, low))
      .replace('#include <normal_fragment_maps>', NORMAL(kind))
      .replace('#include <emissivemap_fragment>', EMIT(kind, low));
  };
  registerMat(mat);
  return mat;
}

/* ───────────── API pública ───────────── */

/**
 * Piel/carne viva. Opciones (todas las de siempre siguen valiendo): color, vein, spot, glow, wobble, breath, rough, sheen, iri,
 * alpha, veins, spots, scale, flat. NUEVAS: blood (tinte de sangre bajo la piel), sss (0..2 translucidez), wet (0..1 brillo húmedo
 * con variación), bump (0..2 micro-relieve), micro (escala del micro-detalle), beat (latidos por segundo; las venas pulsan).
 * Uniformes vivos en mat.userData.u: uHurt, uGlow, uPulse, uSquash, uWound (0..1 heridas), uBeat, uBump, uSSS.
 */
export function fleshMaterial(o = {}) {
  const { sheen = 0.8, iri = 0, rough = 0.42, spot = 0x66ffee } = o; const hi = !isLow();
  const mat = bio('flesh', { ...o, rough, iriShader: 0 });
  if (hi) { mat.sheen = sheen; mat.sheenColor = new Col(spot).lerp(new Col(0xffffff), 0.5); mat.sheenRoughness = 0.5; mat.clearcoat = 0.4; mat.clearcoatRoughness = 0.3; if (iri > 0) { mat.iridescence = iri; mat.iridescenceIOR = 1.6; mat.iridescenceThicknessRange = [200, 700]; } }
  return mat;
}

/** Quitina en capas: placas con surcos, bandas de crecimiento e iridiscencia de película delgada. Opciones de fleshMaterial + iri (0..1). */
export function chitinMaterial(o = {}) {
  const { iri = 0.5, rough = 0.28, color = 0x2a3a46 } = o; const hi = !isLow();
  const mat = bio('chitin', { rough, color, vein: 0x0a1a22, veins: 0.25, spots: 0, scale: 2.4, bump: 1.3, sss: 0.4, wobble: 0, breath: 0, ...o, iriShader: iri });
  mat.metalness = 0.12;
  if (hi) { mat.clearcoat = 0.75; mat.clearcoatRoughness = 0.16; mat.sheen = 0.25; mat.sheenColor = new Col(color).lerp(new Col(0xffffff), 0.5); mat.iridescence = Math.min(1, iri * 0.8); mat.iridescenceIOR = 1.55; mat.iridescenceThicknessRange = [180, 620]; }
  return mat;
}

/** Membrana translúcida con venas que laten (alas, campanas, velos). Doble cara. alpha = opacidad general. */
export function membraneMaterial(o = {}) {
  const { color = 0xe8b8d0, alpha = 0.7 } = o; const hi = !isLow();
  const mat = bio('membrane', { color, vein: 0x8a1840, veins: 0.9, scale: 3.0, sss: 1.6, wet: 0.5, wobble: 0.012, breath: 0.01, bump: 0.6, ...o, alpha }, { transparent: true, side: THREE.DoubleSide, depthWrite: false });
  if (hi) { mat.sheen = 0.6; mat.sheenColor = new Col(color).lerp(new Col(0xffffff), 0.5); mat.sheenRoughness = 0.4; }
  return mat;
}

/** Baba / ícor viscoso: brillante, translúcido, con flujo lento y burbujas. */
export function gooMaterial(o = {}) {
  const { color = 0x66d08a, alpha = 0.85 } = o; const hi = !isLow();
  const mat = bio('goo', { color, vein: new Col(color).multiplyScalar(0.35).getHex(), veins: 0.8, scale: 2.0, sss: 1.4, bump: 0.8, wobble: 0.02, breath: 0.01, rough: 0.06, ...o, alpha }, { transparent: alpha < 1 });
  if (hi) { mat.clearcoat = 1; mat.clearcoatRoughness = 0.05; }
  return mat;
}

/** Pelaje barato: hebras por micro-relieve + halo de pelusa en los bordes. Para pelo largo usa furShells(). */
export function furMaterial(o = {}) {
  const { color = 0x8a6a50, sheen = 1 } = o; const hi = !isLow();
  const mat = bio('fur', { color, rough: 0.85, vein: 0x2a1a14, veins: 0.4, sss: 0.7, bump: 1.4, wobble: 0.01, breath: 0.02, ...o });
  if (hi) { mat.sheen = sheen; mat.sheenColor = new Col(color).lerp(new Col(0xffffff), 0.6); mat.sheenRoughness = 0.35; }
  return mat;
}

/** Hueso/quitina/placa dura (caparazón, dientes, garras): poros, estrías de crecimiento y translucidez cálida en los bordes. Recibe uHurt. */
export function boneMaterial(color = 0xf2e6cf, { rough = 0.35, glow = 0, bump = 1, wound = 0 } = {}) {
  const hi = !isLow();
  const mat = bio('bone', { color, rough, glow, bump, vein: 0x40201a, veins: 0, sss: 0.5, blood: 0xd0705a, scale: 2, wobble: 0, breath: 0 }, { metalness: 0.05 });
  if (hi) { mat.clearcoat = 0.6; mat.clearcoatRoughness = 0.22; mat.sheen = 0.3; mat.sheenColor = new Col(color).lerp(new Col(0xffffff), 0.5); }
  mat.emissive = new Col(color).multiplyScalar(glow);
  mat.userData.u.uWound.value = wound;
  return mat;
}

/**
 * Cristal que brota de la carne (biocristal): translúcido, con refracción fingida (cáusticas), inclusiones que brillan,
 * iridiscencia y borde luminoso. opts.transmit = true (sólo calidad alta) usa transmisión real de three (más caro).
 */
export function bioCrystalMaterial(color = 0x66ffee, { glow = 0.7, transmit = false } = {}) {
  const hi = !isLow();
  const mat = bio('crystal', { color, glow, flat: true, rough: 0.12, vein: 0x000000, veins: 0, scale: 1, sss: 0, iriShader: 1, wobble: 0, breath: 0 }, { metalness: 0.1, transparent: true, opacity: 0.88, emissive: new Col(color), emissiveIntensity: glow, flatShading: true });
  if (hi) { mat.iridescence = 1; mat.iridescenceIOR = 1.8; mat.iridescenceThicknessRange = [250, 800]; mat.clearcoat = 1; mat.clearcoatRoughness = 0.04; mat.ior = 1.55; if (transmit && isHigh()) { mat.transmission = 0.6; mat.thickness = 0.4; mat.attenuationColor = new Col(color); mat.attenuationDistance = 0.8; } }
  return mat;
}

/** Aplica el destello de daño a todos los materiales (flesh/chitin/bone/crystal/ojos…). */
export function setHurt(mats, v) {
  for (const m of expand(mats)) { const u = m && m.userData && m.userData.u; if (u && u.uHurt) u.uHurt.value = v; }
}
// materiales de ojos que pertenecen a la misma criatura (creados entre sus materiales declarados o justo después)
function expand(mats) {
  if (!mats || !mats.length) return mats || [];
  if (mats._exp) return mats._exp;
  let lo = 1e9, hi = -1; for (const m of mats) { const q = m && m.userData && m.userData.seq; if (q != null) { lo = Math.min(lo, q); hi = Math.max(hi, q); } }
  const out = new Set(mats);
  if (hi >= 0) { let end = hi; while (end + 1 < REG.length && REG[end + 1].userData.eyeMat) end++; for (let i = lo; i <= end; i++) if (REG[i].userData.eyeMat) out.add(REG[i]); }
  try { Object.defineProperty(mats, '_exp', { value: [...out], enumerable: false }); } catch { /* array congelado */ }
  return [...out];
}
/** Material de párpado de carne con borde húmedo (para eye()). */
export function lidMaterial(color = 0xb8706a, vein = 0x7a1a28) { return bio('lid', { color, vein, veins: 0.6, rough: 0.5, wobble: 0, breath: 0, sss: 0.9, scale: 3 }); }
/** Heridas visibles: w ∈ [0,1] (usa 1 - st.hp). Aparecen moretones, carne viva, grietas y ícor brillante. */
export function setWound(mats, w) { for (const m of expand(mats)) { const u = m && m.userData && m.userData.u; if (u && u.uWound) u.uWound.value = w; } }
/** Latido: velocidad de los latidos (Hz) para todas las pieles. */
export function setBeat(mats, hz) { for (const m of mats) { const u = m && m.userData && m.userData.u; if (u && u.uBeat) u.uBeat.value = hz; } }

/**
 * Pelo largo por capas («shells»): agrega `layers` copias infladas de `mesh` (comparten geometría) con hebras que se afinan hacia la punta.
 * Sólo en calidad media/alta (en baja no hace nada y devuelve []). Cada capa es 1 draw call: úsalo en piezas pequeñas (cola, melena).
 */
export function furShells(mesh, { layers = 4, length = 0.05, color = 0x8a6a50, tip = null, density = 60 } = {}) {
  if (isLow()) return [];
  const out = [];
  for (let i = 1; i <= layers; i++) {
    const k = i / layers;
    const m = new THREE.MeshStandardMaterial({ color: new Col(color).lerp(new Col(tip ?? color).multiplyScalar(1.25), k), roughness: 0.9, side: THREE.FrontSide });
    const u = { uShell: { value: k }, uLenF: { value: length }, uDens: { value: density }, uTime, uHurt: { value: 0 } };
    m.userData.u = u;
    m.customProgramCacheKey = () => 'org-furshell';
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>\nuniform float uShell,uLenF,uTime; varying vec3 vObj; varying float vScl;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvObj = position; vScl = length(modelMatrix[0].xyz); transformed += normal * uShell * uLenF / max(vScl, 1e-3) + vec3(sin(uTime * 1.3 + position.y * 5.0), 0.0, cos(uTime * 1.1 + position.x * 5.0)) * 0.004 * uShell / max(vScl, 1e-3);`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uShell,uHurt,uDens; varying vec3 vObj; varying float vScl; ${NOISE_GLSL}`)
        .replace('#include <color_fragment>', `#include <color_fragment>\nfloat strand = vn(vObj * vScl * uDens); if (strand < 0.18 + uShell * 0.7) discard; diffuseColor.rgb *= 0.55 + 0.6 * uShell;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.85, 0.7) * uHurt * 0.5;`);
    };
    registerMat(m);
    const l = new THREE.Mesh(mesh.geometry, m); l.renderOrder = 1; mesh.add(l); out.push(l);
  }
  return out;
}
