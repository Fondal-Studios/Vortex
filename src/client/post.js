// POST-PROCESO CINEMATOGRÁFICO («realismo espiritual»): una sola pasada final que lee el color HDR y la PROFUNDIDAD de la escena.
// Orden: aberración cromática leve → oclusión ambiental por profundidad (Alta) → niebla volumétrica falsa por capas con
// dispersión del sol (rayos de luz) → exposición + tonemap ACES → sRGB → grading (curva S, lift/gamma/gain, tono partido
// sombras frías / luces doradas, saturación) → viñeta → grano fino. Los píxeles muy brillantes (proyectiles, auras, núcleos)
// se protegen de la niebla y de la AO: la legibilidad manda.
// Calidades: 'low' = niebla de 1 capa + grading + viñeta (sin AO, sin aberración); 'medium' = 2 capas + AO de 4 muestras;
// 'high' = 3 capas + AO de 8 muestras + aberración.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/** Ajustes de color por mapa (sombras frías, luces doradas; la psicodelia vive en el cielo y la luz). */
export const GRADE = {
  def: { fog: 0x2a2440, fogD: 0.010, fogH: 0.06, shadow: [0.86, 0.94, 1.12], high: [1.08, 1.0, 0.86], sat: 0.92, contrast: 1.10, lift: 0.012, sunCol: 0xffd9a0 },
  m1: { fog: 0x3a3266, fogD: 0.006, fogH: 0.035, shadow: [0.84, 0.92, 1.14], high: [1.08, 1.0, 0.86], sat: 0.95, contrast: 1.10, lift: 0.010, sunCol: 0xffd2a0 },
  m2: { fog: 0x3a1430, fogD: 0.012, fogH: 0.0, shadow: [0.94, 0.86, 1.06], high: [1.10, 0.98, 0.84], sat: 0.92, contrast: 1.12, lift: 0.014, sunCol: 0xffb888 },
  m3: { fog: 0x281e52, fogD: 0.008, fogH: 0.08, shadow: [0.86, 0.90, 1.14], high: [1.08, 1.0, 0.88], sat: 0.93, contrast: 1.10, lift: 0.010, sunCol: 0xffe0c4 },
  m4: { fog: 0x2e1626, fogD: 0.010, fogH: 0.06, shadow: [0.92, 0.88, 1.08], high: [1.10, 0.98, 0.86], sat: 0.94, contrast: 1.10, lift: 0.012, sunCol: 0xffc8a0 },
};

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
  #include <packing>
  uniform sampler2D tDiffuse, tDepth; uniform vec2 uRes; uniform float uTime, uExposure, uNear, uFar, uFogD, uFogH, uFogMode, uFogR, uSat, uContrast, uLift, uCA, uGrain, uVig, uInfect, uAO, uHasDepth;
  uniform vec3 uFogCol, uSunDir, uSunCol, uShadow, uHigh, uCamPos; uniform mat4 uProjInv, uCamMat; uniform mat4 uProj;
  varying vec2 vUv;
  float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float h13(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h13(i), h13(i + vec3(1,0,0)), f.x), mix(h13(i + vec3(0,1,0)), h13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h13(i + vec3(0,0,1)), h13(i + vec3(1,0,1)), f.x), mix(h13(i + vec3(0,1,1)), h13(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float viewZ(float d){ return perspectiveDepthToViewZ(d, uNear, uFar); }
  vec3 viewPos(vec2 uv, float d){ vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vec4 v = uProjInv * c; return v.xyz / v.w; }
  vec3 acesFit(vec3 c){ // ACES (RRT+ODT) igual al del renderer de three
    const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    c = I * c; vec3 a = c * (c + 0.0245786) - 0.000090537, b = c * (0.983729 * c + 0.4329510) + 0.238081; return clamp(O * (a / b), 0.0, 1.0); }
  vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
  float layerH(vec3 w){ return uFogMode > 0.5 ? (uFogR - length(w)) : w.y; } // altura: plano (y) o cascarón esférico (mapa 2)
  void main(){
    vec2 uv = vUv, px = 1.0 / uRes;
    vec3 hdr;
    #if CA
      vec2 dca = (uv - 0.5) * uCA; hdr = vec3(texture2D(tDiffuse, uv + dca).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dca).b);
    #else
      hdr = texture2D(tDiffuse, uv).rgb;
    #endif
    float lum = dot(hdr, vec3(0.2126, 0.7152, 0.0722)), keep = smoothstep(0.9, 2.6, lum); // lo muy brillante se respeta
    float d = uHasDepth > 0.5 ? texture2D(tDepth, uv).x : 1.0, sky = step(0.99999, d);
    vec3 P = viewPos(uv, min(d, 0.99999)); float dist = length(P);
    vec3 rayV = normalize(P), rayW = normalize(mat3(uCamMat) * rayV);
    #if AO > 0
    if (sky < 0.5 && uAO > 0.0) {
      vec3 N = normalize(cross(dFdx(P), dFdy(P)));
      float rad = 0.9, rpx = rad * uProj[1][1] * 0.5 * uRes.y / max(-P.z, 0.1); rpx = clamp(rpx, 3.0, 60.0);
      float ang = h12(gl_FragCoord.xy) * 6.2832, occ = 0.0;
      for (int i = 0; i < AO; i++) {
        float fi = (float(i) + 0.5) / float(AO), a = ang + float(i) * 2.39996, r = rpx * sqrt(fi);
        vec2 suv = uv + vec2(cos(a), sin(a)) * r * px; float sd = texture2D(tDepth, suv).x;
        vec3 S = viewPos(suv, sd), v = S - P; float l = length(v);
        occ += max(0.0, dot(N, v) / max(l, 1e-3) - 0.12) * (1.0 - smoothstep(rad * 0.6, rad * 1.6, l));
      }
      float ao = 1.0 - clamp(occ / float(AO) * 1.6, 0.0, 0.75);
      hdr *= mix(1.0, ao, uAO * (1.0 - keep));
    }
    #endif
    // niebla volumétrica falsa: LAYERS muestras a lo largo del rayo, densidad por altura y ruido que deriva
    float maxD = sky > 0.5 ? 140.0 : min(dist, 220.0), trans = 1.0;
    for (int i = 0; i < LAYERS; i++) {
      float t = maxD * (float(i) + 0.6) / float(LAYERS);
      vec3 w = uCamPos + rayW * t;
      float hf = uFogH > 0.0 ? exp(-max(layerH(w) - (uFogMode > 0.5 ? 0.0 : -4.0), 0.0) * uFogH) : 1.0;
      float n = vn(w * 0.045 + vec3(uTime * 0.05, uTime * 0.02, -uTime * 0.04)) * 0.7 + vn(w * 0.13 - vec3(0.0, uTime * 0.07, 0.0)) * 0.3;
      float dens = uFogD * hf * (0.45 + 1.1 * n) * (1.0 + 0.6 * uInfect);
      trans *= exp(-dens * maxD / float(LAYERS));
    }
    float fogA = (1.0 - trans) * (sky > 0.5 ? 0.35 : 1.0) * (1.0 - 0.85 * keep); fogA = min(fogA, 0.72);
    float sunS = pow(max(dot(rayW, uSunDir), 0.0), 6.0);           // dispersión hacia el sol: «rayos» y halo cálido en la niebla
    vec3 fogC = uFogCol * (0.6 + 0.4 * (1.0 - uInfect * 0.3)) + uSunCol * sunS * 0.55;
    hdr = mix(hdr, fogC, fogA);
    // exposición + ACES + sRGB
    vec3 c = toSRGB(acesFit(hdr * uExposure));
    // grading: lift, curva S, tono partido, saturación
    c = c + uLift * (1.0 - c);
    c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0); c = c * c * (3.0 - 2.0 * c) * 0.25 + c * 0.75;
    float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 split = mix(uShadow, uHigh, smoothstep(0.15, 0.75, L)); c *= split;
    c = mix(vec3(L), c, uSat);
    c = mix(c, c * vec3(1.06, 0.9, 0.96), uInfect * 0.35 * (1.0 - L)); // la infección tiñe las sombras de carne
    // viñeta y grano
    vec2 q = uv - 0.5; q.x *= uRes.x / uRes.y; float vig = smoothstep(1.05, 0.35, length(q) * (1.0 + uInfect * 0.12));
    c *= mix(1.0 - uVig, 1.0, vig);
    c += (h12(gl_FragCoord.xy + fract(uTime * 7.13) * 917.0) - 0.5) * uGrain;
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

export class GradePass extends Pass {
  constructor(level = 'high') {
    super();
    const L = level === 'high' ? { ao: 8, layers: 3, ca: 1 } : level === 'medium' ? { ao: 4, layers: 2, ca: 1 } : { ao: 0, layers: 1, ca: 0 };
    this.level = level;
    this.uniforms = {
      tDiffuse: { value: null }, tDepth: { value: null }, uHasDepth: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uExposure: { value: 1.9 },
      uNear: { value: 0.1 }, uFar: { value: 2000 }, uProjInv: { value: new THREE.Matrix4() }, uProj: { value: new THREE.Matrix4() }, uCamMat: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() },
      uFogCol: { value: new THREE.Color() }, uFogD: { value: 0.01 }, uFogH: { value: 0.05 }, uFogMode: { value: 0 }, uFogR: { value: 80 },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0xffd9a0) },
      uShadow: { value: new THREE.Vector3(1, 1, 1) }, uHigh: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 }, uContrast: { value: 1 }, uLift: { value: 0 },
      uCA: { value: level === 'high' ? 0.0028 : 0.002 }, uGrain: { value: level === 'low' ? 0.018 : 0.024 }, uVig: { value: 0.42 }, uInfect: { value: 0 }, uAO: { value: L.ao ? 1 : 0 },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, defines: { AO: L.ao, LAYERS: L.layers, CA: L.ca }, depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.material);
    this.preset('def');
  }
  preset(mapId, extra = {}) {
    const g = { ...GRADE.def, ...(GRADE[mapId] || {}), ...extra }, u = this.uniforms;
    u.uFogCol.value.setHex(g.fog).convertSRGBToLinear(); u.uFogD.value = g.fogD; u.uFogH.value = g.fogH; u.uFogMode.value = mapId === 'm2' ? 1 : 0;
    u.uShadow.value.set(...g.shadow); u.uHigh.value.set(...g.high); u.uSat.value = g.sat; u.uContrast.value = g.contrast; u.uLift.value = g.lift; u.uSunCol.value.setHex(g.sunCol).convertSRGBToLinear();
    if (this.level === 'low') u.uFogD.value *= 0.8;
  }
  /** Datos de cámara/sol de este cuadro (los llama Renderer.render antes de componer). */
  frame(camera, t, { sunDir = null, infect = 0, fogR = null } = {}) {
    const u = this.uniforms; u.uTime.value = t; u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uProj.value.copy(camera.projectionMatrix); u.uProjInv.value.copy(camera.projectionMatrixInverse); u.uCamMat.value.copy(camera.matrixWorld); u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    if (sunDir) u.uSunDir.value.copy(sunDir).normalize(); u.uInfect.value = infect; if (fogR) u.uFogR.value = fogR;
  }
  setSize(w, h) { this.uniforms.uRes.value.set(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.uniforms; u.tDiffuse.value = readBuffer.texture; u.tDepth.value = readBuffer.depthTexture; u.uHasDepth.value = readBuffer.depthTexture ? 1 : 0;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
  dispose() { this.material.dispose(); this.quad.dispose(); }
}

/** Destino de render de la escena con profundidad legible y MSAA (sin él, el post-proceso pierde el antialias). */
export function sceneTarget(samples = 4) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  rt.depthTexture = new THREE.DepthTexture(1, 1); rt.depthTexture.type = THREE.UnsignedIntType; rt.texture.name = 'escena.hdr';
  return rt;
}
