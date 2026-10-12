import * as THREE from 'three';
import { uTime, uTide, finish } from '../shaders.js';
import { NOISE, BUMP } from './glsl.js';
import { HEART } from './flesh.js';

// ══════════════════════════════════════════════════════════════════════════════════════════════
//  Cascarón del Mapa 2 «Cámara Fractal» = la pared interior de una GEODA gigante.
//  Una sola malla (esfera R = 85, vista desde adentro) con un shader propio:
//   · placas de cristal facetadas (Voronoi 3D): cada placa tiene su propia inclinación (luz plana) y anillos de ágata;
//   · costuras luminosas entre placas que laten con el corazón del núcleo (la onda del latido las recorre);
//   · cuatro «zonas de color» (rosa carne · cian cristal · ámbar · violeta) para orientarse y para variar la luz;
//   · musgo/hongos bioluminiscentes, destellos que titilan con la mirada, grietas profundas;
//   · bruma de esporas con el color de la zona: lo lejano (la cara opuesta de la geoda = el «cielo») se aleja.
//  uWarn = aviso de marea (rojo que late) · uTide = marea cero-G (todo se enciende, tira a cian).
//  Calidad: uFine=1 añade la segunda capa de placas pequeñas y bump fino (Media/Alta).
// ══════════════════════════════════════════════════════════════════════════════════════════════

export const ZONES_M2 = [ // [oscuro, medio, luz, bruma]  — sRGB «de pantalla» (finish() convierte si hay post)
  { name: 'rosa', dark: [0.16, 0.04, 0.16], mid: [0.52, 0.14, 0.36], hi: [1.0, 0.42, 0.72], haze: [0.30, 0.07, 0.26] },
  { name: 'cian', dark: [0.03, 0.12, 0.20], mid: [0.08, 0.40, 0.55], hi: [0.35, 1.0, 0.95], haze: [0.06, 0.20, 0.30] },
  { name: 'ámbar', dark: [0.20, 0.08, 0.03], mid: [0.58, 0.26, 0.08], hi: [1.0, 0.72, 0.28], haze: [0.30, 0.14, 0.08] },
  { name: 'violeta', dark: [0.09, 0.05, 0.24], mid: [0.30, 0.18, 0.64], hi: [0.74, 0.58, 1.0], haze: [0.14, 0.09, 0.34] },
];
const v3 = (a) => `vec3(${a.map((x) => x.toFixed(3)).join(',')})`;
const ZGLSL = `
const vec3 zD0 = ${v3(ZONES_M2[0].dark)}, zM0 = ${v3(ZONES_M2[0].mid)}, zH0 = ${v3(ZONES_M2[0].hi)}, zF0 = ${v3(ZONES_M2[0].haze)};
const vec3 zD1 = ${v3(ZONES_M2[1].dark)}, zM1 = ${v3(ZONES_M2[1].mid)}, zH1 = ${v3(ZONES_M2[1].hi)}, zF1 = ${v3(ZONES_M2[1].haze)};
const vec3 zD2 = ${v3(ZONES_M2[2].dark)}, zM2 = ${v3(ZONES_M2[2].mid)}, zH2 = ${v3(ZONES_M2[2].hi)}, zF2 = ${v3(ZONES_M2[2].haze)};
const vec3 zD3 = ${v3(ZONES_M2[3].dark)}, zM3 = ${v3(ZONES_M2[3].mid)}, zH3 = ${v3(ZONES_M2[3].hi)}, zF3 = ${v3(ZONES_M2[3].haze)};
// pesos de zona en una dirección: ruido de baja frecuencia con bordes suaves (cuatro regiones grandes)
vec4 zoneW(vec3 d){
  float a = vnoise(d * 1.15 + 3.7), b = vnoise(d * 1.15 + 11.3);
  vec4 w = vec4(smoothstep(0.62, 0.34, a) * smoothstep(0.62, 0.34, b), smoothstep(0.42, 0.66, a) * smoothstep(0.62, 0.34, b), smoothstep(0.62, 0.34, a) * smoothstep(0.42, 0.66, b), smoothstep(0.42, 0.66, a) * smoothstep(0.42, 0.66, b));
  return w / max(w.x + w.y + w.z + w.w, 1e-3);
}
`;

export function geodeShell({ fine = true } = {}) {
  return finish(new THREE.ShaderMaterial({
    side: THREE.BackSide, defines: { FBM_OCT: fine ? 4 : 3, FINE: fine ? 1 : 0 },
    uniforms: { uTime, uTide, uWarn: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uWarn, uTide; varying vec3 vP; ${NOISE} ${BUMP}
      ${HEART}
      ${ZGLSL}
      // Voronoi 3D: (F1, F2, id1, id2) con ids en [0,1]
      vec4 voro(vec3 x){
        vec3 i = floor(x), f = fract(x); float d1 = 9.0, d2 = 9.0; vec3 id = vec3(0.0);
        for (int k = 0; k < 27; k++) { vec3 g = vec3(float(k - (k / 3) * 3) - 1.0, float((k / 3) - ((k / 3) / 3) * 3) - 1.0, float(k / 9) - 1.0);
          vec3 o = hash33(i + g); vec3 r = g + o - f; float d = dot(r, r);
          if (d < d1) { d2 = d1; d1 = d; id = i + g; } else if (d < d2) d2 = d; }
        return vec4(sqrt(d1), sqrt(d2), hash13(id), hash13(id + 17.0));
      }
      void main(){
        vec3 dir = normalize(vP), V = cameraPosition - vP; float dist = length(V); V /= dist;
        vec3 N0 = -dir;                               // hacia el centro: «arriba» de quien pisa la pared
        float beat = heart(uTime), lat = acos(clamp(dir.y, -1.0, 1.0)) / 3.14159;
        float sweep = exp(-pow((lat * 5.0 - fract(uTime / 1.55) * 6.5 + 0.8) * 0.9, 2.0));
        vec4 zw = zoneW(dir);
        vec3 cD = zD0 * zw.x + zD1 * zw.y + zD2 * zw.z + zD3 * zw.w, cM = zM0 * zw.x + zM1 * zw.y + zM2 * zw.z + zM3 * zw.w;
        vec3 cH = zH0 * zw.x + zH1 * zw.y + zH2 * zw.z + zH3 * zw.w, cF = zF0 * zw.x + zF1 * zw.y + zF2 * zw.z + zF3 * zw.w;
        float fw = length(fwidth(vP));                // tamaño de un píxel en el mundo
        // — placas grandes (≈ 7 m): luz plana por placa, anillos de ágata, costuras
        vec3 q = dir * 12.0 + 2.0;
        vec3 wq = q + (vec3(vnoise(q * 0.7), vnoise(q * 0.7 + 5.0), vnoise(q * 0.7 + 9.0)) - 0.5) * 0.9; // dominio deformado: placas irregulares
        vec4 A = voro(wq);
        vec3 tilt = normalize(N0 + (hash33(vec3(A.z, A.w, A.z * 7.0) * 41.0) - 0.5) * 1.25);
        float ring = 0.5 + 0.5 * sin(A.x * 17.0 + A.z * 40.0 + vnoise(q * 3.0) * 3.0);
        float seamW = A.y - A.x, seam = 1.0 - smoothstep(0.0, 0.05 + fw * 0.35, seamW);
        float deep = smoothstep(0.16, 0.0, seamW);   // borde en sombra
        float pv = 0.65 + 0.7 * A.w;
        vec3 alb = mix(cD, cM, 0.25 + 0.75 * ring * pv);
        alb = mix(alb, cM * 1.25, smoothstep(0.55, 0.0, A.x) * 0.35);   // el centro de cada placa, más claro
        // — capa fina (≈ 1.7 m): granulado de cristal
        float body = fbm(q * 2.0 + 3.0);
        float hgt = A.x * 0.6 + body * 0.5 - seam * 0.5;
        vec3 Nf = tilt;
        #if FINE
          vec4 B = voro(dir * 52.0 + 7.0);
          float fb = smoothstep(150.0, 40.0, dist);
          vec3 tb = normalize(N0 + (hash33(vec3(B.z, B.w, B.z * 3.0) * 29.0) - 0.5) * 1.6);
          Nf = normalize(mix(Nf, tb, 0.45 * fb));
          float fseam = 1.0 - smoothstep(0.0, 0.06 + fw * 0.5, B.y - B.x);
          alb *= 1.0 - 0.28 * fseam * fb;
          hgt += B.x * 0.18 * fb;
        #endif
        Nf = bumpN(Nf, vP, hgt, 2.2);
        // — luz del núcleo (en el origen), relleno cálido y brillo de borde
        vec3 L = -dir;
        float mott = 0.55 + 0.9 * fbm(dir * 3.0 + vec3(0.0, uTime * 0.03, 0.0));            // la luz pasa entre manchas de bruma
        float dif = max(dot(Nf, L), 0.0);
        float hem = 0.5 + 0.5 * dot(Nf, N0);
        vec3 H = normalize(L + V); float gl = 0.35 + 0.65 * A.w, spec = pow(max(dot(Nf, H), 0.0), 60.0) * gl;
        float fr = pow(1.0 - clamp(dot(Nf, V), 0.0, 1.0), 3.0);
        vec3 col = alb * (0.16 + 0.95 * dif * mott) * (0.55 + 0.45 * hem) + cH * 0.18 * hem * 0.35 * alb;
        col += mix(cH, vec3(1.0), 0.5) * spec * 0.5 * (0.6 + 0.4 * beat);
        col += cH * fr * 0.22 * (0.5 + 0.5 * dif);
        col *= 1.0 - 0.55 * deep;
        // — costuras que laten
        float pulse = 0.28 + 0.75 * beat + 0.65 * sweep + 0.35 * uTide;
        col += cH * seam * pulse * (0.55 + 0.6 * A.w);
        // — musgo y hongos de luz sobre algunas placas
        float moss = smoothstep(0.58, 0.70, vnoise(q * 0.9 + 21.0) + 0.1 * (A.z - 0.5)) * (1.0 - seam);
        col = mix(col, cM * vec3(0.35, 0.9, 0.7) * (0.25 + 0.5 * dif), moss * 0.6);
        float sp = smoothstep(0.80, 0.9, vnoise(q * 7.0 + 9.0)) * moss;
        col += cH * sp * (0.7 + 0.8 * sin(uTime * 1.6 + q.x * 5.0 + q.z * 3.0));
        // — destellos de cristal que titilan al moverse
        vec3 cell = floor(dir * 170.0);
        float tw = step(0.975, hash13(cell)) * pow(max(dot(reflect(-V, Nf), L), 0.0), 3.0);
        col += vec3(0.9, 1.0, 1.0) * tw * (0.5 + 0.5 * sin(uTime * 4.0 + hash13(cell + 3.0) * 30.0)) * 0.9 * smoothstep(120.0, 30.0, dist);
        // — marea y aviso
        col += vec3(0.05, 0.45, 0.65) * uTide * (0.04 + 0.10 * A.w) * (0.6 + 0.4 * sin(uTime * 2.0 + body * 20.0));
        col = mix(col, vec3(1.0, 0.22, 0.30) * (0.35 + 0.35 * sin(uTime * 8.0)), uWarn * 0.30);
        // — bruma de esporas del color de la zona
        col = mix(col, cF * (0.9 + 0.5 * beat * 0.4), 1.0 - exp(-dist * 0.0040));
        gl_FragColor = vec4(col * 0.92, 1.0);
      }`,
  }));
}
