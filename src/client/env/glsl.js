// Fragmentos GLSL compartidos por el entorno (ruido, roca/placa de isla, bruma, bump por derivadas).
// Sólo cadenas de texto: shaders.js y los archivos de env/ los pegan dentro de sus shaders.

export const NOISE = /* glsl */`
#ifndef FBM_OCT
#define FBM_OCT 4
#endif
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 hash33(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < FBM_OCT; i++) { s += a * vnoise(p); p = p * 2.02 + vec3(5.2, 1.3, 8.7); a *= 0.5; } return s; }
`;

/** Normal perturbada por derivadas de una altura escalar (Mikkelsen). p y n en el mismo espacio. */
export const BUMP = /* glsl */`
vec3 bumpN(vec3 n, vec3 p, float h, float k){
  vec3 dpx = dFdx(p), dpy = dFdy(p); float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx); float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - k * grad);
}
`;

export const HAZE = /* glsl */`
vec3 hazeMix(vec3 c, float d, vec3 hc, float dens){ return mix(c, hc, 1.0 - exp(-d * d * dens)); }
`;

/** Superficie de isla: roca estratificada con grietas de luz, musgo luminoso y, en las caras planas,
 *  una placa pulida con incrustaciones que marcan el borde jugable. isl = (cx, cz, R, _). */
export const SURF = /* glsl */`
void surfShade(vec3 p, vec3 nW, vec3 acc, vec4 isl, float t, out vec3 alb, out vec3 emi, out float rough, out float hgt){
  float fw = length(fwidth(p)), aa = fw * 1.4;   // tamaño de un píxel en el mundo: las rayas finas se ensanchan, el grano fino se apaga
  float w = vnoise(p * 0.16) * 2.0;
  float sy = (p.y + w * 3.0) * 1.15 + vnoise(p * vec3(0.5, 0.04, 0.5)) * 2.5;
  float strata = smoothstep(0.15, 0.85, abs(sin(sy)));
  float thin = smoothstep(0.82, 1.0, abs(sin(sy * 4.3 + w)));
  float crag = fbm(p * vec3(1.05, 1.5, 1.05) + 3.0);
  float fine = vnoise(p * 6.5) * smoothstep(0.35, 0.08, fw);
  float g = vnoise(p * 0.5 + 7.0);
  vec3 cA = vec3(0.020, 0.018, 0.036), cB = vec3(0.085, 0.052, 0.046), cC = vec3(0.034, 0.042, 0.070);
  alb = mix(mix(cA, cB, strata * 0.65 + g * 0.35), cC, thin * 0.5);
  alb *= 0.34 + 0.62 * crag;
  alb = mix(alb, alb * (0.6 + acc * 1.0), 0.22);
  rough = 0.92 - 0.2 * strata;
  hgt = strata * 0.5 + crag * 1.0 + fine * 0.16;
  emi = vec3(0.0);
  // grietas con luz que fluye
  float n1 = vnoise(p * 0.42 + 3.0), n2 = vnoise(p * 0.95 + 11.0);
  float net = abs(n1 - 0.5) * 2.0 + (n2 - 0.5) * 0.05;
  float crack = (1.0 - smoothstep(0.0, max(0.026, aa * 0.5), net)) * smoothstep(0.50, 0.70, vnoise(p * 0.2 + 21.0));
  float flow = 0.5 + 0.5 * sin(t * 1.6 - p.y * 0.8 + n2 * 10.0);
  emi += acc * crack * (0.4 + 1.5 * flow * flow);
  hgt -= crack * 0.5; alb = mix(alb, vec3(0.01), crack * 0.7);
  // musgo / hongos luminosos sobre repisas
  float up = smoothstep(0.15, 0.55, nW.y);
  float mp = smoothstep(0.50, 0.62, vnoise(p * vec3(0.8, 1.6, 0.8) + 4.0) + up * 0.18 - 0.1) * up;
  alb = mix(alb, vec3(0.012, 0.055, 0.04) * (0.5 + acc), mp * 0.85); rough = mix(rough, 0.97, mp);
  float spot = smoothstep(0.78, 0.9, vnoise(p * 5.5 + 9.0)) * mp;
  emi += acc * spot * (0.7 + 0.8 * sin(t * 1.5 + p.x * 3.0 + p.z * 2.0));
  emi += acc * 0.05 * smoothstep(0.0, -0.8, nW.y); // reflejo del mar de nubes en la panza
  // placa de la cara plana (arriba o, en islas-techo, abajo)
  float plate = smoothstep(0.82, 0.97, abs(nW.y));
  if (plate > 0.001 && isl.z > 1.5) {
    vec2 q = p.xz - isl.xy; float rd = length(q), R = max(isl.z, 1.0), ang = atan(q.y, q.x), TAU = 6.2831853;
    vec3 pa = vec3(0.016, 0.019, 0.032) * (0.7 + 0.6 * mix(0.5, vnoise(p * 2.2), smoothstep(0.5, 0.1, fw))) * (0.8 + 0.4 * vnoise(p * 0.6));
    float rdist = (0.5 - abs(fract(rd / 3.2) - 0.5)) * 3.2;
    float S = floor(R * 0.6 + 0.5) * 2.0, adist = (0.5 - abs(fract(ang / TAU * S) - 0.5)) * TAU * rd / S;
    float sw = max(0.07, aa);
    float seam = max(1.0 - smoothstep(0.02, sw, rdist), (1.0 - smoothstep(0.02, sw, adist)) * step(rd, R - 1.2)) * smoothstep(1.2, 0.3, fw);
    // incrustaciones: anillos dentados, radios y borde
    float lines = 0.0;
    for (int i = 0; i < 3; i++) { float fi = float(i); float rr = R * (0.30 + 0.24 * fi) + 0.25 * cos(ang * (6.0 + 2.0 * fi));
      lines = max(lines, 1.0 - smoothstep(0.04, max(0.11, aa), abs(rd - rr))); }
    float fr = fract(ang / TAU * 12.0), sd = min(fr, 1.0 - fr) * TAU * rd / 12.0;
    float spokes = (1.0 - smoothstep(0.03, max(0.08, aa), sd)) * smoothstep(R * 0.1, R * 0.16, rd) * (1.0 - smoothstep(R * 0.76, R * 0.8, rd));
    lines = max(lines, spokes);
    float wave = 0.5 + 0.5 * sin(rd * 0.35 - t * 1.8 + ang * 2.0);
    vec3 pe = acc * lines * (0.35 + 1.1 * wave * wave * wave);
    float eb = smoothstep(R - 1.0, R - 0.15, rd), core = 1.0 - smoothstep(0.0, max(0.17, aa), abs(rd - (R - 0.32)));
    float dash = step(0.5, fract(ang / TAU * S * 2.0)) * (1.0 - smoothstep(0.0, 0.07, abs(rd - (R - 1.3))));
    pe += acc * (0.22 * eb + 1.5 * core + 0.6 * dash) + vec3(0.4) * core * 0.35;
    vec3 palb = pa * (1.0 - 0.6 * seam) + vec3(0.02) * lines;
    float prough = 0.72 + 0.2 * vnoise(p * 3.0) + 0.1 * seam;
    float phgt = vnoise(p * 5.0) * 0.12 * smoothstep(0.3, 0.06, fw) - seam * 0.35 - lines * 0.12;
    alb = mix(alb, palb, plate); emi = mix(emi, pe, plate); rough = mix(rough, prough, plate); hgt = mix(hgt, phgt, plate);
  }
}
`;
