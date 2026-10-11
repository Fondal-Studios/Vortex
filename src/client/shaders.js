import * as THREE from 'three';

export const uTime = { value: 0 }; // reloj global compartido por todos los shaders

const PAL = `vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }`;

/* Cielo: pliegues fractales tipo Kali + estrellas. Cada mapa le da su tono. */
export function skyMaterial({ hue = 0, inside = false, speed = 0.05 } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime, uHue: { value: hue }, uSpeed: { value: speed }, uInside: { value: inside ? 1 : 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uHue, uSpeed, uInside; varying vec3 vDir; ${PAL}
      float hash(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        vec3 p = d * (uInside > 0.5 ? 0.9 : 1.5);
        float t = uTime * uSpeed, a = 0.0;
        for (int i = 0; i < 8; i++) {
          p = abs(p) / (dot(p, p) + 0.12) - vec3(0.85 + 0.12 * sin(t + float(i)), 0.78, 0.62 + 0.12 * cos(t * 1.3));
          float c = cos(t * 0.7), s = sin(t * 0.7); p.xy = mat2(c, -s, s, c) * p.xy;
          a += exp(-length(p) * 0.35);
        }
        float v = fract(a * 0.22 + uTime * 0.015 + uHue);
        float glow = pow(clamp(sin(a * 1.7 + uTime * 0.2) * 0.5 + 0.5, 0.0, 1.0), 2.0);
        vec3 col = pal(v) * (0.10 + 0.9 * glow);
        col = mix(vec3(0.015, 0.005, 0.04), col, uInside > 0.5 ? 0.9 : 0.75);
        float st = hash(floor(d * 260.0)); col += vec3(1.0) * smoothstep(0.994, 1.0, st) * (uInside > 0.5 ? 0.0 : 1.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
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
  return mat;
}

/* Suelo/isla: anillos concéntricos psicodélicos + rejilla. */
export function groundMaterial(hue = 0, center = new THREE.Vector3()) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime, uHue: { value: hue }, uC: { value: center } },
    vertexShader: `varying vec3 vWorld; varying vec3 vN; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime, uHue; uniform vec3 uC; varying vec3 vWorld; varying vec3 vN; ${PAL}
      void main(){
        vec3 q = vWorld - uC; float r = length(q.xz);
        float rings = sin(r * 0.9 - uTime * 1.2) * 0.5 + 0.5;
        vec2 g = abs(fract(vWorld.xz * 0.2) - 0.5); float grid = smoothstep(0.46, 0.5, max(g.x, g.y));
        float face = abs(vN.y);
        vec3 top = pal(fract(r * 0.025 + uHue + rings * 0.15 + uTime * 0.02)) * (0.22 + 0.4 * rings);
        top += vec3(0.9, 1.0, 1.0) * grid * 0.5;
        vec3 side = pal(fract(vWorld.y * 0.05 + uHue + 0.3 + uTime * 0.03)) * 0.35;
        gl_FragColor = vec4(mix(side, top, smoothstep(0.55, 0.85, face)), 1.0);
      }`,
  });
}

/* Cascarón interior del Mapa 2: superficie orgánica, respira. */
export function shellMaterial(hue = 0.3) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uTime, uHue: { value: hue }, uWarn: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uHue, uWarn; varying vec3 vP; ${PAL}
      void main(){
        vec3 p = vP * 0.05; float t = uTime * 0.15;
        float f = 0.0, amp = 1.0;
        for (int i = 0; i < 5; i++) { p = vec3(p.y + sin(p.z * 1.7 + t), p.z + sin(p.x * 1.9 - t), p.x + sin(p.y * 1.3 + t)); f += amp * (0.5 + 0.5 * sin(p.x * 3.0 + p.y * 2.0)); amp *= 0.55; p *= 1.7; }
        float cells = abs(sin(f * 4.0 + uTime * 0.4));
        vec3 col = pal(fract(f * 0.35 + uHue + uTime * 0.02)) * (0.10 + 0.30 * cells);
        col = mix(col, vec3(0.04, 0.02, 0.10), 0.35);
        float edge = smoothstep(0.94, 1.0, cells); col += vec3(0.6, 0.9, 1.0) * edge * 0.18;
        col = mix(col, vec3(1.0, 0.3, 0.5) * (0.4 + 0.4 * sin(uTime * 8.0)), uWarn * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/* Zonas de física: cáscara translúcida con bandas animadas. mode 0 plano, 1 sube, 2 baja/gira */
export function zoneMaterial(color, mode = 0) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uTime, uColor: { value: new THREE.Color(color) }, uMode: { value: mode } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uTime, uMode; uniform vec3 uColor; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float band = uMode < 0.5 ? 0.5 : (uMode < 1.5 ? sin(vW.y * 0.8 - uTime * 3.0) * 0.5 + 0.5 : sin((vW.x + vW.z) * 0.6 + vW.y * 0.5 + uTime * 2.0) * 0.5 + 0.5);
        gl_FragColor = vec4(uColor * (0.25 + 0.9 * band), (0.05 + 0.5 * f) * (0.4 + 0.6 * band));
      }`,
  });
}
