// Fragmentos GLSL compartidos por el Mapa 3 (Laberinto Celestial): colores de zona, runas, bruma.
// Sólo cadenas de texto. Los colores están en valores "de pantalla" (finish() los linealiza si hay bloom).

/** Colores por esquina para orientarse. Esquina de aparición (-x,+z) = ÁMBAR; (+x,+z) = CIAN; (-x,-z) = MAGENTA; (+x,-z) = LIMA; centro = VIOLETA. */
export const ZONES = /* glsl */`
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
const vec3 C_AMB = vec3(1.00, 0.60, 0.22), C_CYA = vec3(0.20, 0.85, 1.00), C_MAG = vec3(1.00, 0.26, 0.74), C_LIM = vec3(0.52, 1.00, 0.34), C_VIO = vec3(0.62, 0.42, 1.00);
vec3 zoneCol(vec2 p){
  vec2 s = clamp(p / 74.0, -1.0, 1.0);
  float wx = smoothstep(-0.25, 0.25, s.x), wz = smoothstep(-0.25, 0.25, s.y);
  vec3 c = mix(mix(C_MAG, C_LIM, wx), mix(C_AMB, C_CYA, wx), wz);
  float cen = 1.0 - smoothstep(20.0, 36.0, max(abs(p.x), abs(p.y)));
  return mix(c, C_VIO, cen);
}
vec3 hazeCol(vec3 dir){ // color de la bruma lejana (un poco más claro hacia el horizonte)
  return mix(vec3(0.07, 0.05, 0.17), vec3(0.20, 0.13, 0.36), pow(1.0 - abs(dir.y), 2.0));
}
`;

/** Runas procedurales: 10 trazos posibles sobre una rejilla 3×3; el hash elige cuáles se encienden. q en [0,1]². */
export const RUNES = /* glsl */`
float segd(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
#define RSEG(k, a, b) if (mod(floor(bits / k), 2.0) > 0.5) d = min(d, segd(q, a, b));
float rune(vec2 q, float h, float w, float aa){
  float bits = floor(h * 1023.0), d = 9.0;
  RSEG(1.0, vec2(0.2, 0.2), vec2(0.8, 0.2))
  RSEG(2.0, vec2(0.2, 0.5), vec2(0.8, 0.5))
  RSEG(4.0, vec2(0.2, 0.8), vec2(0.8, 0.8))
  RSEG(8.0, vec2(0.2, 0.2), vec2(0.2, 0.8))
  RSEG(16.0, vec2(0.5, 0.2), vec2(0.5, 0.8))
  RSEG(32.0, vec2(0.8, 0.2), vec2(0.8, 0.8))
  RSEG(64.0, vec2(0.2, 0.2), vec2(0.8, 0.8))
  RSEG(128.0, vec2(0.2, 0.8), vec2(0.8, 0.2))
  RSEG(256.0, vec2(0.2, 0.5), vec2(0.5, 0.8))
  RSEG(512.0, vec2(0.5, 0.2), vec2(0.8, 0.5))
  return 1.0 - smoothstep(w, w + aa, d);
}
`;

