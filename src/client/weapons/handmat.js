// Material de las manos y brazos en primera persona (UN solo material compartido por todas las armas).
// Dibuja con código: guante (neopreno / cristal / piel), placas de cristal facetado, correas, costuras luminosas,
// pantallita de muñeca y TATUAJES procedurales emisivos (runas, ojos cósmicos, constelaciones, venas de cristal).
// Sin texturas, sin PointLights. El estilo se cambia en caliente con setHandStyle (sin reconstruir mallas).
//
// Atributos por vértice (los pone Kit.put):  color = tono de gris  ·  kind = clase de pieza  ·  aux = coordenada de flujo.
//   kind 0 piel/guante · 1 placa de cristal · 2 correa/armadura · 3 costura luminosa · 4 manga de tela · 7 pantallita
//   kind 8..11 = lo mismo que 0..3 pero en el DEDO ÍNDICE (se curva en el vértice con uTrig).
import * as THREE from 'three';
import { OUT } from '../shaders.js';

export const TATTOOS = ['runas', 'ojos', 'constelacion', 'venas', 'ninguno'];
export const GLOVES = ['tactico', 'cristal', 'desnudo'];

/** Uniformes compartidos (todas las armas y calidades miran los mismos objetos). */
export const HU = {
  uTime: { value: 0 }, uColor: { value: new THREE.Color(0x66ffee) }, uAccent: { value: new THREE.Color(0xff66c4) }, uSkin: { value: new THREE.Color(0xb98066) },
  uWeap: { value: new THREE.Color(0x66ffee) }, uTat: { value: 0 }, uTatAmt: { value: 1 }, uGlove: { value: 0 }, uFire: { value: 0 }, uUpg: { value: 0 }, uTrig: { value: 0 },
};
export const HAND_STYLE = { color: 0x66ffee, accent: 0xff66c4, tattoo: 'runas', glove: 'tactico', skin: 0xb98066 };

/** Cambia el estilo de manos. Parcial: lo que no se pasa se conserva. Devuelve el estilo vigente. */
export function setHandStyle(st = {}) {
  if (st.color !== undefined) { HAND_STYLE.color = st.color; HU.uColor.value.set(st.color); }
  if (st.accent !== undefined) { HAND_STYLE.accent = st.accent; HU.uAccent.value.set(st.accent); }
  if (st.skin !== undefined) { HAND_STYLE.skin = st.skin; HU.uSkin.value.set(st.skin); }
  if (st.tattoo !== undefined) { const i = TATTOOS.indexOf(st.tattoo); if (i >= 0) { HAND_STYLE.tattoo = st.tattoo; HU.uTat.value = Math.min(i, 3); HU.uTatAmt.value = i === 4 ? 0 : 1; } }
  if (st.glove !== undefined) { const i = GLOVES.indexOf(st.glove); if (i >= 0) { HAND_STYLE.glove = st.glove; HU.uGlove.value = i; } }
  return { ...HAND_STYLE };
}
setHandStyle(HAND_STYLE);

/** Variantes listas para los personajes (usar con setHandStyle). */
export const HAND_PRESETS = {
  egida:  { color: 0xffb040, accent: 0xff5a2a, tattoo: 'runas', glove: 'tactico' },
  lumen:  { color: 0xfff0a8, accent: 0x66e8ff, tattoo: 'constelacion', glove: 'cristal' },
  forja:  { color: 0xff8a30, accent: 0xffe060, tattoo: 'venas', glove: 'tactico' },
  vigia:  { color: 0x7dff9a, accent: 0x66ffee, tattoo: 'ojos', glove: 'tactico' },
  nova:   { color: 0xff66c4, accent: 0x9a7bff, tattoo: 'constelacion', glove: 'desnudo' },
  umbra:  { color: 0xb050ff, accent: 0x40ffc0, tattoo: 'ojos', glove: 'cristal' },
};

const VERT = `
  attribute vec3 color; attribute float kind; attribute float aux;
  uniform float uTrig, uGlove;
  varying vec3 vN, vView, vPos, vON, vCol; varying float vKind, vAux;
  vec3 rotX(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c); }
  void main(){
    vec3 p = position, n = normal; float k = kind;
    vPos = position; vON = normal; vCol = color; vAux = aux;
    if (k > 7.5) {                       // dedo índice: 3 falanges que se curvan (nudillo en el origen, dedo hacia -Z)
      float d = max(0.0, -p.z), u = clamp(uTrig, 0.0, 1.0);
      float t0 = -(0.10 + 0.30 * u), t1 = -(0.15 + 0.60 * u), t2 = -(0.10 + 0.45 * u);
      vec3 J1 = vec3(0.0, 0.0, -0.05), J2 = vec3(0.0, 0.0, -0.088);
      vec3 q = rotX(p, t0);
      vec3 J1p = rotX(J1, t0); q = mix(q, J1p + rotX(q - J1p, t1), smoothstep(0.045, 0.055, d));
      vec3 J2p = J1p + rotX(rotX(J2, t0) - J1p, t1); q = mix(q, J2p + rotX(q - J2p, t2), smoothstep(0.083, 0.093, d));
      n = rotX(n, t0 + t1 * smoothstep(0.045, 0.055, d) + t2 * smoothstep(0.083, 0.093, d)); p = q; k -= 8.0; vKind = k + 8.0;
    } else vKind = k;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = mv.xyz; vN = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * mv;
    // en estilo «desnudo» no hay placas, correas, costuras ni pantallita: se colapsan
    float kk = k > 7.5 ? k - 8.0 : k;
    if (uGlove > 1.5 && (kk > 0.5 && kk < 3.5 || kk > 6.5)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;

const FRAG = `
  uniform float uTime, uTat, uTatAmt, uGlove, uFire, uUpg;
  uniform vec3 uColor, uAccent, uSkin, uWeap;
  varying vec3 vN, vView, vPos, vON, vCol; varying float vKind, vAux;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 h22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  float hsh(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hsh(i),hsh(i+vec3(1,0,0)),f.x), mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x), mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x), f.y), f.z); }
  vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
  float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / (dot(ba, ba) + 1e-5), 0.0, 1.0); return length(pa - ba * h); }
  vec2 proj(vec3 p, vec3 n, out float ax){ vec3 a = abs(n); if (a.x > a.y && a.x > a.z) { ax = 0.0; return p.yz; } if (a.y > a.z) { ax = 1.0; return p.xz; } ax = 2.0; return p.xy; }

  // cada tatuaje devuelve vec3(línea 0..1, relleno 0..1, brillo 0..1)
  vec3 tRunas(vec2 q, float ax, float aa){
    float S = 0.04; vec2 g = q / S, id = floor(g), f = fract(g);
    float act = step(h21(id + ax * 17.0), 0.42 + 0.46 * uUpg), d = 9.0;
    for (int s = 0; s < SEGS; s++) { float fs = float(s); vec2 hh = h22(id + fs * 7.3 + ax * 3.1);
      float ia = floor(hh.x * 9.0), ib = floor(hh.y * 9.0);
      vec2 a = vec2(mod(ia, 3.0), floor(ia / 3.0)) * 0.3 + 0.2, b = vec2(mod(ib, 3.0), floor(ib / 3.0)) * 0.3 + 0.2;
      d = min(d, mix(9.0, seg(f, a, b), step(0.22, h21(id + fs * 3.7)))); }
    d = min(d, mix(9.0, seg(f, vec2(0.5, 0.1), vec2(0.5, 0.9)), step(0.62, h21(id + 9.1))));
    d = min(d, mix(9.0, abs(length(f - 0.5) - 0.36), step(0.84, h21(id + 4.4))));          // círculo de sello
    float w = 0.05, line = smoothstep(w + aa, w - aa * 0.5, d) * act;
    float ph = h21(id) * 6.28, tw = 0.55 + 0.45 * sin(uTime * 1.4 + ph);
    return vec3(line * tw, 0.0, line * smoothstep(0.7, 1.0, sin(uTime * 2.2 + ph * 2.0)));
  }
  vec3 tOjos(vec2 q, float ax, float aa){
    float S = 0.078; vec2 g = q / S, id = floor(g), e = fract(g) - 0.5;
    float has = step(h21(id + ax * 5.1), 0.36 + 0.4 * uUpg), ph = h21(id) * 20.0;
    float bl = 1.0 - 0.92 * smoothstep(0.93, 1.0, sin(uTime * 0.8 + ph) * 0.5 + 0.5);
    float w = 0.40, hg = 0.19 * bl, x = clamp(e.x / w, -1.0, 1.0), lid = hg * (1.0 - x * x), ay = abs(e.y);
    float ins = step(abs(e.x), w) * step(ay, lid);
    float edge = (1.0 - smoothstep(0.022, 0.022 + aa, abs(ay - lid))) * step(abs(e.x), w);
    vec2 pc = e - vec2(0.05 * sin(uTime * 0.7 + ph), 0.0); float r = length(pc);
    float ring = 1.0 - smoothstep(0.02, 0.02 + aa, abs(r - 0.115));
    float iris = ins * smoothstep(0.13, 0.11, r), pup = smoothstep(0.05, 0.035, length(pc * vec2(2.4, 0.8)));
    float ang = atan(e.y, e.x), rays = step(0.55, fract(ang * 1.27324 + ph)) * step(0.23, length(e * vec2(0.8, 1.6))) * (1.0 - smoothstep(0.30, 0.31, length(e * vec2(0.8, 1.6))));
    float line = max(max(edge, ring * ins), rays * 0.6 * step(0.05, bl));
    float fill = iris * (1.0 - pup) * (0.55 + 0.45 * sin(uTime * 3.0 + ph));
    return vec3(line * has * (1.0 - pup * 0.7), fill * has, has * edge * smoothstep(0.7, 1.0, sin(uTime * 1.6 + ph)));
  }
  vec3 tConst(vec2 q, float ax, float aa){
    float S = 0.052; vec2 g = q / S, id = floor(g);
    vec2 sO = id + 0.2 + 0.6 * h22(id + ax), sR = id + vec2(1, 0) + 0.2 + 0.6 * h22(id + vec2(1, 0) + ax), sU = id + vec2(0, 1) + 0.2 + 0.6 * h22(id + vec2(0, 1) + ax);
    vec2 sL = id - vec2(1, 0) + 0.2 + 0.6 * h22(id - vec2(1, 0) + ax), sD = id - vec2(0, 1) + 0.2 + 0.6 * h22(id - vec2(0, 1) + ax);
    float reg = step(h21(floor(id / 2.0) + ax * 3.0), 0.55 + 0.4 * uUpg);
    float d = 9.0;
    d = min(d, mix(9.0, seg(g, sO, sR), step(h21(id + 11.0), 0.55)));
    d = min(d, mix(9.0, seg(g, sL, sO), step(h21(id - vec2(1, 0) + 11.0), 0.55)));
    d = min(d, mix(9.0, seg(g, sO, sU), step(h21(id + 23.0), 0.45)));
    d = min(d, mix(9.0, seg(g, sD, sO), step(h21(id - vec2(0, 1) + 23.0), 0.45)));
    float line = (1.0 - smoothstep(0.03, 0.03 + aa * 2.0, d)) * 0.55 * reg;
    float st = 0.0, hot = 0.0;
    vec2 ss[5]; ss[0] = sO; ss[1] = sR; ss[2] = sL; ss[3] = sU; ss[4] = sD;
    for (int i = 0; i < STARS; i++) { float dd = length(g - ss[i]), hh = h21(ss[i] * 1.7), tw = 0.5 + 0.5 * sin(uTime * (1.5 + hh * 3.0) + hh * 40.0);
      float big = step(0.7, hh); st += exp(-dd * dd * (big > 0.5 ? 120.0 : 420.0)) * (0.5 + 0.7 * tw) * (big > 0.5 ? 1.4 : 0.9); hot += exp(-dd * dd * 900.0) * tw; }
    return vec3(min(1.0, line + min(st, 1.0) * reg), 0.0, min(1.0, hot * reg));
  }
  vec3 tVenas(vec3 p, float aa){
    float n1 = vn(p * 38.0), n2 = vn(p * 83.0 + 7.3);
    float w1 = 0.028, l1 = 1.0 - smoothstep(w1, w1 + 0.03 + aa, abs(n1 - 0.5));
    float l2 = (1.0 - smoothstep(0.02, 0.05 + aa, abs(n2 - 0.5))) * step(0.52, vn(p * 19.0 + 3.0)) * 0.8;
    float m = max(l1, l2) * (0.55 + 0.45 * uUpg + 0.3);
    float bead = pow(max(0.0, sin(vAux * 26.0 - uTime * 3.0 + n1 * 7.0)), 5.0);
    float node = smoothstep(0.55, 0.9, vn(p * 150.0)) * m;
    return vec3(m, 0.0, min(1.0, bead * m + node * 0.6));
  }

  void main(){
    float kd = vKind > 7.5 ? vKind - 8.0 : vKind;
    vec3 V = normalize(-vView), N = normalize(vN);
    vec3 Nf = normalize(cross(dFdx(vView), dFdy(vView))); if (dot(Nf, V) < 0.0) Nf = -Nf;
    if (dot(N, V) < -0.02) N = -N;
    vec3 L1 = normalize(vec3(-0.42, 0.8, 0.55)), L2 = normalize(vec3(0.7, 0.1, 0.45)), H = normalize(L1 + V);
    float ndv = clamp(dot(N, V), 0.0, 1.0), fres = pow(1.0 - ndv, 3.0);
    float dif = dot(N, L1) * 0.5 + 0.5; dif *= dif; float dif2 = max(dot(N, L2), 0.0) * 0.3, hemi = N.y * 0.5 + 0.5;
    float inten = 0.6 + 0.8 * uUpg + 1.7 * uFire;
    float ax; vec2 q = proj(vPos, vON, ax); float aa = fwidth(q.x) / 0.04 * 0.9;
    vec3 col = vec3(0.0);
    if (kd < 0.5) {                                   // piel / guante
      float tex = 1.0, spec = 0.12, shin = 18.0; vec3 base;
      if (uGlove < 0.5) {                             // neopreno táctico con trama de rombos
        vec2 w = q * 230.0; float al = clamp(1.0 - fwidth(w.x) * 2.5, 0.0, 1.0);
        float dm = abs(fract(w.x + w.y) - 0.5) + abs(fract(w.x - w.y) - 0.5); tex = 1.0 + (dm - 0.5) * 0.34 * al;
        base = (vec3(0.085, 0.09, 0.125) + uColor * 0.035) * vCol * tex;
      } else if (uGlove < 1.5) {                      // guante de cristal oscuro, muy brillante
        base = (vec3(0.03, 0.05, 0.09) + uColor * 0.16) * vCol; spec = 1.1; shin = 55.0;
      } else {                                        // piel
        base = uSkin * vCol * (0.85 + 0.2 * vn(vPos * 90.0)); spec = 0.16; shin = 14.0;
      }
      float sp = pow(max(dot(N, H), 0.0), shin) * spec;
      col = base * (0.32 + 0.5 * hemi + 1.1 * dif + dif2) + vec3(sp) + uAccent * fres * (uGlove < 1.5 ? (uGlove < 0.5 ? 0.35 : 1.1) : 0.12);
      if (uGlove > 1.5) col += uSkin * 0.35 * smoothstep(0.7, 0.0, dif) * vec3(1.0, 0.35, 0.25); // piel: dispersión en la sombra
      if (uGlove > 0.5 && uGlove < 1.5) { float c = abs(vn(vPos * 70.0 + vec3(0.0, 0.0, uTime * 0.2)) - 0.5); col += pow(clamp(1.0 - c * 4.0, 0.0, 1.0), 3.0) * uColor * 0.45 + pal(fres * 1.5 + vAux * 3.0 + uTime * 0.1) * fres * 0.5; }
      // — tatuaje
      vec3 T = vec3(0.0);
      if (uTatAmt > 0.5) {
        if (uTat < 0.5) T = tRunas(q, ax, aa); else if (uTat < 1.5) T = tOjos(q, ax, aa); else if (uTat < 2.5) T = tConst(q, ax, aa); else T = tVenas(vPos, aa * 0.02);
        float flow = pow(0.5 + 0.5 * sin(vAux * 20.0 - uTime * 3.2), 5.0);                 // pulso que corre hacia los dedos
        float bias = (uGlove > 1.5 ? 1.0 : (uGlove > 0.5 ? 1.35 : 1.0));
        vec3 tc = mix(uColor, uAccent, clamp(T.z * 0.7 + flow * 0.35 + (uTat > 2.5 ? 0.0 : 0.0), 0.0, 1.0));
        vec3 fc = mix(uAccent, uColor, 0.5 + 0.5 * sin(uTime * 2.0 + vAux * 10.0));
        col += tc * T.x * inten * (1.0 + flow * 0.8) * 1.5 * bias + fc * T.y * inten * 0.9 + vec3(1.0) * T.z * (0.35 + uFire * 0.5);
        if (uGlove > 1.5) col *= 1.0 - 0.35 * smoothstep(0.0, 1.0, T.x) * 0.0;
      }
    } else if (kd < 1.5) {                            // placa de cristal facetado
      vec3 n = Nf; float face = h21(floor(n.xy * 5.0 + n.z * 11.0)), l = dot(n, L1) * 0.5 + 0.5;
      vec3 base = mix(uColor, uAccent, face * 0.8);
      float c = abs(vn(vPos * 90.0 + n * 3.0) - 0.5);
      col = base * (0.35 + 1.0 * l) * (0.55 + 0.45 * inten * 0.6) + vec3(1.0) * pow(clamp(1.0 - c * 3.5, 0.0, 1.0), 3.0) * 0.6 + pal(face + fres * 0.8 + uTime * 0.1) * fres * 0.6 + vec3(pow(max(dot(n, H), 0.0), 40.0)) * 0.9;
      col += base * (0.25 + 0.5 * uFire);
    } else if (kd < 2.5) {                            // correa / armadura oscura
      vec3 base = vec3(0.1, 0.105, 0.14) * vCol; float sp = pow(max(dot(N, H), 0.0), 36.0) * 0.55;
      vec2 w = q * 160.0; float al = clamp(1.0 - fwidth(w.x) * 2.0, 0.0, 1.0); base *= 1.0 + (step(0.5, fract(w.x)) - 0.5) * 0.12 * al;
      col = base * (0.3 + 0.5 * hemi + 1.0 * dif + dif2) + vec3(sp) + uColor * fres * 0.5;
    } else if (kd < 3.5) {                            // costura luminosa
      float fl = 0.5 + 0.5 * sin(vAux * 30.0 - uTime * 3.4);
      vec3 c = mix(uColor, uAccent, fl); col = c * (1.2 + 0.6 * fl + 1.4 * uFire + 0.8 * uUpg) + uWeap * 0.35 * vCol.g;
    } else if (kd < 5.0) {                            // manga de tela
      float rib = 0.9 + 0.1 * sin(vAux * 380.0);
      vec3 base = (vec3(0.045, 0.05, 0.075) + uColor * 0.03) * rib * vCol;
      col = base * (0.35 + 0.5 * hemi + 1.0 * dif + dif2) + uAccent * fres * 0.25;
    } else {                                          // pantallita de muñeca: píxeles que parpadean
      vec3 px = floor(vPos * 260.0); float t = floor(uTime * 4.0);
      float on = step(0.55, h21(px.xy + px.z * 1.7 + t * 3.1)) * step(0.3, h21(px.xz + 5.0)) ;
      float bar = step(fract(vAux * 90.0 - uTime * 0.7), 0.5);
      col = vec3(0.01, 0.015, 0.03) + uColor * (0.25 + on * 1.5) * (0.6 + 0.4 * bar) + uAccent * fres * 0.8 + vec3(pow(max(dot(N, H), 0.0), 40.0)) * 0.6;
      col *= 1.0 + uFire;
    }
    col = 1.0 - exp(-col * 1.35);
    gl_FragColor = vec4(col, 1.0);
    //LIN
  }`;

const _mats = new Map();
/** Un único material por nivel de calidad (comparte los uniformes HU). */
export function handMaterial(q) {
  const key = q.low ? 0 : q.name === 'medium' ? 1 : 2;
  let m = _mats.get(key); if (m) return m;
  m = new THREE.ShaderMaterial({
    defines: { SEGS: key === 0 ? 2 : 3, STARS: key === 0 ? 1 : 5 }, uniforms: HU, vertexShader: VERT, fragmentShader: FRAG,
  });
  m.extensions = { derivatives: true };
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('//LIN', OUT.linear ? 'gl_FragColor.rgb = pow(max(gl_FragColor.rgb, vec3(0.0)), vec3(2.2));' : ''); };
  m.customProgramCacheKey = () => `whand${key}${OUT.linear ? 'L' : 'S'}`;
  _mats.set(key, m); return m;
}
