import * as THREE from 'three';
import { NOISE, BUMP, HAZE, SURF } from './env/glsl.js';

export const uTime = { value: 0 }; // reloj global compartido por todos los shaders
/** Si hay post-proceso (bloom), los ShaderMaterial propios deben escribir color lineal (el OutputPass lo codifica a sRGB). */
export const OUT = { linear: false };
export function finish(mat) {
  if (!OUT.linear) return mat;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); const i = sh.fragmentShader.lastIndexOf('}'); sh.fragmentShader = sh.fragmentShader.slice(0, i) + ' gl_FragColor.rgb = pow(max(gl_FragColor.rgb, vec3(0.0)), vec3(2.2)); }'; };
  return mat;
}

const PAL = `vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }`;

/* Cielo (Mapa 1 y visores): nebulosas con dominio deformado, vía láctea, galaxias espirales, estrellas de varios
   tamaños que titilan, horizonte atmosférico y un sol con corona. Más oscuro que el primer plano (legibilidad). */
export function skyMaterial({ hue = 0, inside = false, speed = 0.05, iters = 8, sun = null } = {}) {
  const oct = iters <= 4 ? 2 : iters <= 6 ? 3 : 4, full = iters > 4 ? 1 : 0;
  return finish(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, defines: { FBM_OCT: oct, FULL: full },
    uniforms: { uTime, uHue: { value: hue }, uSpeed: { value: speed }, uInside: { value: inside ? 1 : 0 }, uSunDir: { value: new THREE.Vector3(...(sun || [0, 0, 0])).normalize() }, uSunOn: { value: sun ? 1 : 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform float uTime, uHue, uSpeed, uInside, uSunOn; uniform vec3 uSunDir; varying vec3 vDir; ${NOISE}
      vec3 hueRot(vec3 c, float a){ const vec3 k = vec3(0.57735); float ca = cos(a), sa = sin(a); return c * ca + cross(k, c) * sa + k * dot(k, c) * (1.0 - ca); }
      vec3 stars(vec3 d, float scale, float thr, float size, float bright){
        vec3 p = d * scale, i = floor(p), f = fract(p) - 0.5, r = hash33(i); float h = hash13(i + 13.7);
        float dd = length(f - (r - 0.5) * 0.7), on = step(thr, h);
        float tw = 0.65 + 0.35 * sin(uTime * (1.0 + r.x * 3.0) + r.y * 40.0);
        float core = smoothstep(size, 0.0, dd), halo = pow(smoothstep(size * 3.0, 0.0, dd), 3.0) * 0.35;
        vec3 tint = mix(vec3(0.65, 0.8, 1.0), vec3(1.0, 0.78, 0.55), r.z);
        return on * (core + halo) * tw * bright * tint * (0.5 + 0.9 * h);
      }
      vec3 galaxy(vec3 d, vec3 c, float size, float rot, float incl, vec3 col){
        float vis = smoothstep(0.0, 0.25, dot(d, c)); if (vis <= 0.0) return vec3(0.0);
        vec3 u = normalize(cross(c, vec3(0.0, 1.0, 0.1))), v = cross(c, u);
        vec2 q = vec2(dot(d, u), dot(d, v)) / size; float cr = cos(rot), sr = sin(rot); q = mat2(cr, -sr, sr, cr) * q; q.y /= incl;
        float rr = length(q), a = atan(q.y, q.x);
        float arms = 0.5 + 0.5 * cos(2.0 * (a - 2.4 * log(rr + 0.06)) + uTime * 0.02);
        float disc = exp(-rr * 2.4) * (0.35 + 0.9 * arms * smoothstep(0.0, 0.35, rr)) + exp(-rr * 14.0) * 1.3;
        return col * disc * vis * smoothstep(1.4, 0.8, rr);
      }
      void main(){
        vec3 d = normalize(vDir); float t = uTime * uSpeed;
        float up = d.y;
        // base: degradado vertical (cenit casi negro, horizonte luminoso, abajo violeta hondo)
        vec3 zen = vec3(0.008, 0.007, 0.028), hor = vec3(0.05, 0.06, 0.17), low = vec3(0.02, 0.01, 0.06);
        vec3 col = mix(hor, zen, smoothstep(0.0, 0.8, up)); col = mix(col, low, smoothstep(0.0, -0.5, up));
        col += vec3(0.04, 0.17, 0.24) * pow(1.0 - abs(up), 9.0) * 0.5 + vec3(0.25, 0.06, 0.25) * pow(1.0 - abs(up), 22.0) * 0.35;
        // nebulosas (dominio deformado)
        vec3 q = d * 1.7 + vec3(0.0, t * 0.6, 0.0);
        vec3 w = vec3(vnoise(q * 1.3 + 3.0), vnoise(q * 1.3 + 7.0), vnoise(q * 1.3 + 11.0)) - 0.5;
        float n = fbm(q * 1.4 + 2.2 * w + t), n2 = fbm(q * 2.9 - 1.6 * w + 5.0 + t * 0.7);
        float dens = smoothstep(0.38, 0.86, n);
        vec3 nA = vec3(0.16, 0.05, 0.42), nB = vec3(0.60, 0.12, 0.48), nC = vec3(0.05, 0.42, 0.52);
        vec3 nebC = mix(mix(nA, nB, smoothstep(0.3, 0.7, n2)), nC, smoothstep(0.45, 0.8, w.x + 0.5 + n * 0.2));
        float lane = smoothstep(0.55, 0.3, fbm(q * 3.6 + 9.0));            // vetas de polvo oscuras
        col += nebC * dens * (0.18 + 0.55 * n2) * (0.55 + 0.45 * lane) * 0.5;
        #if FULL
        // vía láctea
        vec3 bn = normalize(vec3(0.35, 0.78, -0.45)); float band = exp(-pow(dot(d, bn) * 3.2, 2.0));
        float dust = fbm(d * 5.0 + 4.0);
        col += vec3(0.38, 0.32, 0.55) * band * (0.10 + 0.55 * smoothstep(0.25, 0.8, dust)) * 0.4;
        col *= 1.0 - 0.45 * band * smoothstep(0.55, 0.75, fbm(d * 7.0 + 1.0));
        // galaxias lejanas
        col += galaxy(d, normalize(vec3(-0.55, 0.38, 0.74)), 0.16, 0.6, 2.4, vec3(0.50, 0.55, 1.0)) * 0.4;
        col += galaxy(d, normalize(vec3(0.72, 0.52, 0.46)), 0.10, -0.9, 1.7, vec3(1.0, 0.62, 0.45)) * 0.32;
        #endif
        // estrellas
        float starMask = uInside > 0.5 ? 0.0 : 1.0;
        col += starMask * (stars(d, 55.0, 0.90, 0.16, 0.9) + stars(d, 26.0, 0.955, 0.17, 1.2) + stars(d, 11.0, 0.97, 0.14, 2.4));
        #if FULL
        col += starMask * stars(d, 90.0, 0.93, 0.18, 0.55) * (0.4 + 2.0 * band);
        #endif
        col = hueRot(col, uHue * 6.2832);
        // sol: disco, corona y reflejo en el cielo
        if (uSunOn > 0.5) {
          float sd = max(dot(d, uSunDir), 0.0);
          float disc = smoothstep(0.99905, 0.99935, sd);
          vec3 sc = vec3(1.0, 0.86, 0.6);
          col += sc * (disc * 1.3 + pow(sd, 400.0) * 0.5 + pow(sd, 60.0) * 0.2 + pow(sd, 9.0) * 0.02);
          col += vec3(0.9, 0.35, 0.25) * pow(sd, 3.0) * 0.08 * (0.6 + 0.4 * dens);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/* Cristal facetado: normal por derivadas + iridiscencia por Fresnel. */
export function crystalMaterial(color = 0x66ffee, { alpha = 1, glow = 0, hue = 0 } = {}) {
  const mat = new THREE.ShaderMaterial({
    transparent: alpha < 1, depthWrite: alpha >= 1,
    uniforms: { uTime, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha }, uGlow: { value: glow }, uHurt: { value: 0 }, uHue: { value: hue }, uShim: { value: 0 } },
    vertexShader: `varying vec3 vView; varying vec3 vWorld; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uTime, uAlpha, uGlow, uHurt, uHue, uShim; uniform vec3 uColor; varying vec3 vView; varying vec3 vWorld; ${PAL}
      void main(){
        vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
        vec3 v = normalize(-vView);
        if (dot(n, v) < 0.0) n = -n;
        float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.2);
        float lit = 0.6 + 0.7 * max(dot(n, normalize(vec3(0.4, 0.8, 0.5))), 0.0);
        float irid = fract(dot(n, vec3(0.3, 0.5, 0.2)) * 1.6 + fres * 0.9 + uTime * 0.12 + uHue);
        vec3 col = uColor * lit;
        col = mix(col, pal(irid) * 1.1, 0.2 + 0.5 * fres); col += uColor * 0.12;
        col += uColor * uGlow * (0.6 + 0.4 * sin(uTime * 9.0));
        col += vec3(1.0, 0.9, 0.8) * uHurt;
        col = 1.0 - exp(-col * 1.35); // tonemap suave: el brillo no quema a blanco
        float al = uAlpha;
        if (uShim > 0.0) { float w = sin(vWorld.y * 6.0 + uTime * 5.0 + vWorld.x * 3.0) * 0.5 + 0.5; al = mix(uAlpha, 0.06 + 0.12 * w + fres * 0.5, uShim); }
        gl_FragColor = vec4(col, al);
      }`,
  });
  mat.extensions = { derivatives: true };
  return finish(mat);
}

/* Isla de roca viva (versión suelta, sin atributos): estratos, grietas luminosas, musgo y placa jugable. El Mapa 1 usa
   env/rock.js (PBR o liviano, todas las islas en una malla); esto queda para quien quiera una isla por su cuenta. */
export function groundMaterial(hue = 0, center = new THREE.Vector3(), radius = 20) {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: 3 },
    uniforms: { uTime, uAcc: { value: new THREE.Color().setHSL(hue, 0.9, 0.6) }, uIsl: { value: new THREE.Vector4(center.x, center.z, radius, 0) }, uSun: { value: new THREE.Vector3(0.4, 1, 0.3).normalize() } },
    vertexShader: `varying vec3 vWP; varying vec3 vWN; void main(){ vWN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uAcc, uSun; uniform vec4 uIsl; varying vec3 vWP; varying vec3 vWN; ${NOISE} ${BUMP} ${SURF}
      void main(){
        vec3 N = normalize(vWN), alb, emi; float rough, h; surfShade(vWP, N, uAcc, uIsl, uTime, alb, emi, rough, h);
        N = bumpN(N, vWP, h, 0.2);
        float dif = max(dot(N, uSun), 0.0), hem = N.y * 0.5 + 0.5;
        gl_FragColor = vec4(alb * (vec3(1.0, 0.92, 0.82) * dif * 1.5 + mix(vec3(0.1, 0.07, 0.2), vec3(0.3, 0.36, 0.6), hem)) + emi, 1.0);
      }`,
  }));
}

/* Cascarón interior del Mapa 2: tejido vivo con venas que laten desde el centro, pústulas, parches de cristal,
   brillo subsuperficial fingido y luz que viene del núcleo. Respira (uWarn: aviso de marea; uTide: cero-G). */
export const uTide = { value: 0 }; // 0 normal · 1 marea de cero-G (lo mueve env/map2.js)
export function shellMaterial(hue = 0.3, iters = 5) {
  return finish(new THREE.ShaderMaterial({
    side: THREE.BackSide, defines: { FBM_OCT: Math.max(2, Math.min(4, iters - 1)) },
    uniforms: { uTime, uHue: { value: hue }, uWarn: { value: 0 }, uTide },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uHue, uWarn, uTide; varying vec3 vP; ${NOISE} ${BUMP}
      float heart(float t){ float ph = fract(t / 1.55); return exp(-pow(ph * 10.0, 2.0)) + 0.65 * exp(-pow((ph - 0.27) * 10.0, 2.0)); }
      void main(){
        vec3 dir = normalize(vP), V = normalize(cameraPosition - vP); float dist = length(cameraPosition - vP);
        float lat = acos(clamp(dir.y, -1.0, 1.0)) / 3.14159;
        vec3 p = vP * 0.05; float t = uTime * 0.03;
        vec3 w = vec3(vnoise(p * 1.5 + t), vnoise(p * 1.5 + 7.0 - t), vnoise(p * 1.5 + 13.0)) - 0.5;
        vec3 q = p + w * 0.9;
        float body = fbm(q * 2.0 + 3.0), pust = smoothstep(0.58, 0.80, vnoise(q * 5.0));
        float v1 = 1.0 - abs(2.0 * vnoise(q * 2.0 + 5.0) - 1.0), v2 = 1.0 - abs(2.0 * vnoise(q * 4.6 + 9.0) - 1.0);
        float vein = smoothstep(0.95, 0.998, v1) + 0.5 * smoothstep(0.965, 0.998, v2) * smoothstep(0.45, 0.7, body) + 0.10 * smoothstep(0.75, 0.99, v1);
        float crys = smoothstep(0.50, 0.62, fbm(p * 1.1 + 21.0));
        float hgt = body + pust * 0.55 + vein * 0.30 - crys * 0.15;
        vec3 N = bumpN(-dir, vP, hgt, 3.0);
        vec3 L = -dir;
        float beat = heart(uTime), sweep = exp(-pow((lat * 5.0 - fract(uTime / 1.55) * 6.5 + 0.8) * 0.9, 2.0));
        float mott = 0.55 + 0.9 * fbm(p * 0.7 + t * 2.0);                       // la luz del núcleo pasa entre manchas de bruma
        float dif = max(dot(N, L), 0.0) * mott;
        vec3 flesh = mix(vec3(0.16, 0.03, 0.09), vec3(0.46, 0.12, 0.20), body);
        flesh = mix(flesh, vec3(0.80, 0.40, 0.45), pust * 0.5);
        vec3 glass = mix(vec3(0.04, 0.22, 0.34), vec3(0.15, 0.55, 0.65), vnoise(q * 12.0));
        vec3 alb = mix(flesh, glass, crys);
        float gloss = mix(0.45, 1.0, max(crys, pust));
        vec3 H = normalize(L + V); float spec = pow(max(dot(N, H), 0.0), mix(24.0, 120.0, gloss)) * gloss;
        float ao = 0.55 + 0.75 * smoothstep(0.2, 1.1, hgt);                          // grietas más oscuras, relieves más claros
        vec3 col = alb * ao * (0.12 + 0.80 * dif) + vec3(1.0, 0.8, 0.7) * spec * 0.28;
        float fl = step(0.985, hash13(floor(q * 90.0))) * crys * (0.5 + 0.5 * sin(uTime * 3.0 + dot(floor(q * 90.0), vec3(1.0, 2.0, 3.0))));
        col += vec3(0.7, 1.0, 1.0) * fl * 0.9;                                    // destellos de cristal
        float thin = pust * 0.7 + (1.0 - body) * 0.25;
        col += vec3(1.0, 0.28, 0.20) * thin * (0.05 + 0.20 * beat) * (1.0 - crys);   // subsuperficial
        vec3 veinC = mix(vec3(1.0, 0.30, 0.42), vec3(0.3, 0.9, 1.0), crys);
        col += veinC * vein * (0.14 + 0.55 * beat + 0.7 * sweep + 0.4 * uTide);
        col += vec3(0.08, 0.5, 0.7) * uTide * (0.06 + 0.1 * crys) * (0.5 + 0.5 * sin(uTime * 2.0 + body * 20.0));
        col = mix(col, vec3(1.0, 0.25, 0.4) * (0.35 + 0.35 * sin(uTime * 8.0)), uWarn * 0.28);
        col = mix(col, vec3(0.16, 0.05, 0.20), 1.0 - exp(-dist * 0.0045)); // bruma de esporas: lo lejano se aleja
        gl_FragColor = vec4(col * 0.8, 1.0);
      }`,
  }));
}

/** Color "de pantalla": canales sRGB tal cual (finish() hace pow(2.2) cuando hay post-proceso). */
export function screenColor(hex) { return new THREE.Color().setRGB(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255, THREE.LinearSRGBColorSpace); }

/* Zonas de física: cáscara translúcida animada.
   modo 0 plano · 1 columna que sube · 2 baja/gira (clásico) · 3 burbuja de tiempo lento (reloj en el ecuador)
   4 burbuja sin gravedad (pompa irisada) · 5 pozo de gravedad (atmósfera) · 6 almohadilla circular (uv) */
export function zoneMaterial(color, mode = 0) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, defines: { FBM_OCT: 3 },
    uniforms: { uTime, uColor: { value: color && color.isColor ? color : screenColor(color) }, uMode: { value: mode } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vP; varying vec2 vUv; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vW = (modelMatrix * vec4(position, 1.0)).xyz; vP = position; vUv = uv; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uTime, uMode; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vP; varying vec2 vUv; ${PAL} ${NOISE}
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        vec3 col; float al;
        if (uMode < 1.5 && uMode > 0.5) {            // columna ascendente
          float ang = atan(vP.z, vP.x);
          float n = vnoise(vec3(ang * 6.0, vW.y * 0.16 - uTime * 1.6, 1.0)), n2 = vnoise(vec3(ang * 13.0, vW.y * 0.4 - uTime * 2.6, 5.0));
          float st = smoothstep(0.50, 0.85, n) * 0.8 + smoothstep(0.62, 0.9, n2) * 0.6;
          float band = pow(sin(vW.y * 0.7 - uTime * 3.2) * 0.5 + 0.5, 4.0);
          float ends = smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
          col = uColor * (0.30 + 1.1 * st + 0.5 * band) + vec3(0.5, 0.8, 0.7) * f * 0.4;
          al = (0.03 + 0.24 * f) * (0.4 + 0.9 * st) * ends + band * 0.02 * ends;
        } else if (uMode > 5.5) {                    // almohadilla
          vec2 p = (vUv - 0.5) * 2.0; float r = length(p);
          float ring = smoothstep(0.07, 0.0, abs(fract(r * 2.0 - uTime * 0.35) - 0.5) - 0.38) * smoothstep(1.0, 0.2, r);
          float edge = smoothstep(0.06, 0.0, abs(r - 0.92)), disc = smoothstep(1.0, 0.0, r);
          col = uColor * (0.4 + 0.9 * ring + 1.0 * edge); al = (0.06 * disc + 0.22 * ring + 0.32 * edge) * smoothstep(1.0, 0.9, r);
        } else if (uMode > 4.5) {                    // pozo de gravedad
          vec3 nd = normalize(vP); float ang = atan(nd.z, nd.x);
          float sw = 0.5 + 0.5 * sin(ang * 3.0 + nd.y * 6.0 - uTime * 1.4 + vnoise(nd * 4.0) * 4.0);
          col = uColor * (0.4 + 0.9 * sw); al = (0.015 + 0.16 * f) * (0.4 + 0.8 * sw);
        } else if (uMode > 3.5) {                    // pompa irisada
          vec3 nd = normalize(vP); float nz = fbm(nd * 2.5 + uTime * 0.07);
          vec3 ir = pal(fract(f * 1.2 + nz * 0.9 + uTime * 0.05));
          col = mix(uColor, ir, 0.7) * (0.35 + 0.9 * f + 0.3 * nz); al = 0.03 + 0.28 * f + 0.05 * nz;
        } else if (uMode > 2.5) {                    // burbuja de tiempo lento: ondas y reloj ecuatorial
          vec3 nd = normalize(vP); float ang = atan(nd.z, nd.x);
          float rip = sin(nd.y * 11.0 - uTime * 0.9 + vnoise(nd * 3.0 + uTime * 0.1) * 3.0) * 0.5 + 0.5;
          float eq = smoothstep(0.10, 0.0, abs(nd.y));
          float tick = smoothstep(0.93, 1.0, cos(ang * 24.0 - uTime * 0.25)) * smoothstep(0.10, 0.0, abs(nd.y)) * 0.6 + smoothstep(0.02, 0.0, abs(nd.y)) * 0.5;
          col = uColor * (0.35 + 0.9 * rip * f + 1.5 * tick); al = 0.04 + 0.30 * f + tick * 0.5 + eq * 0.04;
        } else {
          float band = uMode < 0.5 ? 0.5 : sin((vW.x + vW.z) * 0.6 + vW.y * 0.5 + uTime * 2.0) * 0.5 + 0.5;
          col = uColor * (0.25 + 0.9 * band); al = (0.05 + 0.5 * f) * (0.4 + 0.6 * band);
        }
        gl_FragColor = vec4(col, al);
      }`,
  }));
}
