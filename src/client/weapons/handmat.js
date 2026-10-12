// Material de las manos y brazos en primera persona (UN solo material compartido por todas las armas).
// Dibuja con código: guante (neopreno / cristal / piel), placas de cristal facetado, correas, costuras luminosas,
// pantallita de muñeca y TATUAJES procedurales emisivos (runas, ojos cósmicos, constelaciones, venas de cristal).
// Sin texturas, sin PointLights. El estilo se cambia en caliente con setHandStyle (sin reconstruir mallas).
//
// Atributos por vértice (los pone Kit.put):  color = tono de gris  ·  kind = clase de pieza  ·  aux = coordenada de flujo.
//   kind 1 placa de cristal · 2 correa/armadura · 3 costura luminosa · 4 manga de tela · 5 piel/guante (malla orgánica: color = (u, v, máscara del tatuaje), aux = flujo) · 6 uña · 7 pantallita
//   +8 = pieza del DEDO ÍNDICE (se flexiona en el vértice con uTrig; +16·n = falange n). Atributos extra del índice: fw, fj2, fj3, fax.
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
  attribute vec3 color; attribute float kind; attribute float aux; attribute vec4 rs;
  attribute vec3 fw; attribute vec3 fj2; attribute vec3 fj3; attribute vec3 fax;
  uniform float uTrig, uGlove;
  varying vec3 vN, vView, vPos, vCol; varying float vKind, vAux; varying vec4 vRs;
  vec3 rotA(vec3 p, vec3 c, vec3 a, float t){ vec3 v = p - c; float ct = cos(t), st = sin(t); return c + v * ct + cross(a, v) * st + a * dot(a, v) * (1.0 - ct); }
  void main(){
    float kk = floor(kind + 0.5), isIdx = mod(floor(kk / 8.0), 2.0), cls = mod(kk, 8.0);
    vec3 p = position, n = normal;
    vPos = position; vCol = color; vAux = aux; vKind = cls; vRs = rs;
    if (isIdx > 0.5) {                   // dedo índice: 3 falanges que se flexionan alrededor de su eje (nudillo en el origen de la pieza)
      float u = clamp(uTrig, 0.0, 1.0), t1 = u * 0.30, t2 = u * 0.62, t3 = u * 0.42; vec3 a = normalize(fax);
      vec3 p1 = rotA(p, vec3(0.0), a, t1);
      vec3 p2 = rotA(rotA(p, fj2, a, t2), vec3(0.0), a, t1);
      vec3 p3 = rotA(rotA(rotA(p, fj3, a, t3), fj2, a, t2), vec3(0.0), a, t1);
      float ws = 1.0 - fw.x - fw.y - fw.z;
      p = ws * p + fw.x * p1 + fw.y * p2 + fw.z * p3;
      vec3 n1 = rotA(n, vec3(0.0), a, t1), n2 = rotA(n, vec3(0.0), a, t1 + t2), n3 = rotA(n, vec3(0.0), a, t1 + t2 + t3);
      n = normalize(ws * n + fw.x * n1 + fw.y * n2 + fw.z * n3);
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = mv.xyz; vN = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * mv;
    // en estilo «desnudo» no hay placas, correas, costuras ni pantallita: se colapsan
    if (uGlove > 1.5 && (cls > 0.5 && cls < 3.5 || cls > 6.5)) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }`;

const FRAG = `
  uniform float uTime, uTat, uTatAmt, uGlove, uFire, uUpg;
  uniform vec3 uColor, uAccent, uSkin, uWeap;
  varying vec3 vN, vView, vPos, vCol; varying float vKind, vAux; varying vec4 vRs;
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec2 h22(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
  float hsh(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hsh(i),hsh(i+vec3(1,0,0)),f.x), mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x), mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x), f.y), f.z); }
  vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
  float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / (dot(ba, ba) + 1e-5), 0.0, 1.0); return length(pa - ba * h); }

  float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0); }
  // facetas de cristal (Voronoi): x = id de la faceta · y = distancia a la arista
  vec2 facets(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0, id = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 r = g + h22(i + g) - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; id = h21(i + g); } else if (d < d2) d2 = d; }
    return vec2(id, sqrt(d2) - sqrt(d1)); }

  // cada tatuaje devuelve vec3(línea 0..1, relleno 0..1, brillo 0..1); q = coordenadas de piel (metros del marco de la mano)
  vec3 tRunas(vec2 q, float aa){
    float S = 0.021; vec2 g = q / S, id = floor(g), f = fract(g);
    float act = step(h21(id), 0.40 + 0.46 * uUpg), d = 9.0;
    for (int s = 0; s < SEGS; s++) { float fs = float(s); vec2 hh = h22(id + fs * 7.3);
      float ia = floor(hh.x * 9.0), ib = floor(hh.y * 9.0);
      vec2 a = vec2(mod(ia, 3.0), floor(ia / 3.0)) * 0.3 + 0.2, b = vec2(mod(ib, 3.0), floor(ib / 3.0)) * 0.3 + 0.2;
      d = min(d, mix(9.0, seg(f, a, b), step(0.22, h21(id + fs * 3.7)))); }
    d = min(d, mix(9.0, seg(f, vec2(0.5, 0.1), vec2(0.5, 0.9)), step(0.62, h21(id + 9.1))));
    d = min(d, mix(9.0, abs(length(f - 0.5) - 0.36), step(0.84, h21(id + 4.4))));
    float w = 0.05, line = smoothstep(w + aa, w - aa * 0.5, d) * act;
    float ph = h21(id) * 6.28, tw = 0.55 + 0.45 * sin(uTime * 1.4 + ph);
    return vec3(line * tw, 0.0, line * smoothstep(0.7, 1.0, sin(uTime * 2.2 + ph * 2.0)));
  }
  vec3 tOjos(vec2 q, float aa){
    float S = 0.036; vec2 g = q / S, id = floor(g), e = fract(g) - 0.5;
    float has = step(h21(id + 5.1), 0.34 + 0.4 * uUpg), ph = h21(id) * 20.0;
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
  vec3 tConst(vec2 q, float aa){
    float S = 0.026; vec2 g = q / S, id = floor(g);
    vec2 sO = id + 0.2 + 0.6 * h22(id), sR = id + vec2(1, 0) + 0.2 + 0.6 * h22(id + vec2(1, 0)), sU = id + vec2(0, 1) + 0.2 + 0.6 * h22(id + vec2(0, 1));
    vec2 sL = id - vec2(1, 0) + 0.2 + 0.6 * h22(id - vec2(1, 0)), sD = id - vec2(0, 1) + 0.2 + 0.6 * h22(id - vec2(0, 1));
    float reg = step(h21(floor(id / 2.0)), 0.6 + 0.35 * uUpg);
    float d = 9.0;
    d = min(d, mix(9.0, seg(g, sO, sR), step(h21(id + 11.0), 0.55)));
    d = min(d, mix(9.0, seg(g, sL, sO), step(h21(id - vec2(1, 0) + 11.0), 0.55)));
    d = min(d, mix(9.0, seg(g, sO, sU), step(h21(id + 23.0), 0.45)));
    d = min(d, mix(9.0, seg(g, sD, sO), step(h21(id - vec2(0, 1) + 23.0), 0.45)));
    float line = (1.0 - smoothstep(0.045, 0.045 + aa * 2.0, d)) * 0.55 * reg;
    float st = 0.0, hot = 0.0;
    vec2 ss[5]; ss[0] = sO; ss[1] = sR; ss[2] = sL; ss[3] = sU; ss[4] = sD;
    for (int i = 0; i < STARS; i++) { float dd = length(g - ss[i]), hh = h21(ss[i] * 1.7), tw = 0.5 + 0.5 * sin(uTime * (1.5 + hh * 3.0) + hh * 40.0);
      float big = step(0.7, hh); st += exp(-dd * dd * (big > 0.5 ? 24.0 : 64.0)) * (0.5 + 0.7 * tw) * (big > 0.5 ? 1.5 : 1.0); hot += exp(-dd * dd * 130.0) * tw; }
    return vec3(min(1.0, line + min(st, 1.0) * reg), 0.0, min(1.0, hot * reg));
  }
  vec3 tVenas(vec2 q, float aa){
    vec3 p = vec3(q * 46.0, 1.7), p2 = vec3(q * 98.0 + 5.0, 3.1);
    float n1 = vn(p + vec3(0.0, 0.0, uTime * 0.05)), n2 = vn(p2);
    float l1 = 1.0 - smoothstep(0.016, 0.04 + aa, abs(n1 - 0.5));
    float l2 = (1.0 - smoothstep(0.012, 0.035 + aa, abs(n2 - 0.5))) * step(0.52, vn(vec3(q * 17.0, 2.0))) * 0.8;
    float m = max(l1, l2) * (0.85 + 0.45 * uUpg);
    float bead = pow(max(0.0, sin(vAux * 18.0 - uTime * 3.0 + n1 * 7.0)), 5.0);
    float node = smoothstep(0.55, 0.9, vn(vec3(q * 190.0, 4.0))) * m;
    return vec3(m, 0.0, min(1.0, bead * m + node * 0.6));
  }

  void main(){
    float kd = vKind;
    vec3 V = normalize(-vView), N = normalize(vN);
    vec3 Nf = normalize(cross(dFdx(vView), dFdy(vView))); if (dot(Nf, V) < 0.0) Nf = -Nf;
    if (dot(N, V) < -0.02) N = -N;
    vec3 L1 = normalize(vec3(-0.42, 0.8, 0.55)), L2 = normalize(vec3(0.7, 0.1, 0.45)), H = normalize(L1 + V);
    float ndv = clamp(dot(N, V), 0.0, 1.0), fres = pow(1.0 - ndv, 3.0);
    float inten = 0.6 + 0.8 * uUpg + 1.7 * uFire;
    vec3 col = vec3(0.0);
    if (kd > 4.5 && kd < 5.5) {   // piel / guante sobre la malla orgánica
      float expo = uGlove > 1.5 ? 1.0 : (uGlove > 0.5 ? 0.0 : smoothstep(1.57, 1.64, vAux));   // yemas al aire en el guante táctico
      vec2 q = vCol.xy; float aa = fwidth(q.x) / (uTat < 0.5 ? 0.021 : uTat < 1.5 ? 0.036 : 0.026) * 0.9;
      vec3 Ns = N; float dif0 = dot(N, L1) * 0.5 + 0.5, dif = dif0 * dif0, dif2 = max(dot(N, L2), 0.0) * 0.3, hemi = N.y * 0.5 + 0.5;
      float spec = 0.12, shin = 18.0; vec3 base;
      float tex = 1.0;
      if (uGlove < 0.5) {                             // neopreno táctico: trama de rombos + costuras
        vec2 w = q * 190.0; float al = clamp(1.0 - fwidth(w.x) * 2.5, 0.0, 1.0);
        float dm = abs(fract(w.x + w.y) - 0.5) + abs(fract(w.x - w.y) - 0.5); tex = 1.0 + (dm - 0.5) * 0.4 * al;
        base = (vec3(0.07, 0.075, 0.105) + uColor * 0.03) * tex * (0.8 + 0.4 * vn(vec3(q * 60.0, 0.0)));
        float cut = smoothstep(1.50, 1.56, vAux) * (1.0 - expo);   // borde del guante con hilo luminoso
        base = mix(base, base * 0.5, cut);
      } else if (uGlove < 1.5) {                      // guante de cristal oscuro, muy brillante y facetado
        Ns = normalize(mix(N, Nf, 0.65)); float d1 = dot(Ns, L1) * 0.5 + 0.5; dif = d1 * d1; hemi = Ns.y * 0.5 + 0.5;
        base = (vec3(0.03, 0.05, 0.09) + uColor * 0.16); spec = 1.1; shin = 55.0; H = normalize(L1 + V);
      } else { base = uSkin; }
      if (expo > 0.01) {                              // piel: poros, venas finas y color de yema
        vec3 sk0 = mix(uSkin, vec3(dot(uSkin, vec3(0.3, 0.55, 0.15))), 0.3) * 0.82; vec3 sk = sk0 * (0.82 + 0.3 * vn(vec3(q * 150.0, 1.0)));
        sk = mix(sk, sk * vec3(1.06, 0.82, 0.78), smoothstep(1.6, 2.0, vAux) * 0.6);
        float vein = (1.0 - smoothstep(0.02, 0.07, abs(vn(vec3(q * 70.0, 5.0)) - 0.5))) * 0.12;
        sk *= 1.0 - vein * vec3(0.3, 0.55, 0.35) - 0.0;
        base = mix(base, sk, expo); spec = mix(spec, 0.14, expo); shin = mix(shin, 14.0, expo);
      }
      float sp = pow(max(dot(Ns, H), 0.0), shin) * spec;
      col = base * (0.32 + 0.5 * hemi + 1.1 * dif + dif2) + vec3(sp) + uAccent * fres * (uGlove < 1.5 ? (uGlove < 0.5 ? 0.35 * (1.0 - expo) + 0.1 * expo : 1.1) : 0.12);
      float sss = expo * smoothstep(0.7, 0.0, dif) * 0.22;
      col += uSkin * sss * vec3(1.0, 0.4, 0.3) + expo * uSkin * fres * vec3(0.3, 0.12, 0.09);   // dispersión bajo la piel
      if (uGlove > 0.5 && uGlove < 1.5) { float c = abs(vn(vec3(q * 80.0, uTime * 0.2)) - 0.5); col += pow(clamp(1.0 - c * 4.0, 0.0, 1.0), 3.0) * uColor * 0.45 + pal(fres * 1.5 + vAux * 0.6 + uTime * 0.1) * fres * 0.5; }
      // — placas de armadura pintadas sobre la malla (dorso, correa de nudillos, falanges): bisel falso por gradiente de la distancia, filo luminoso interior
      float plIn = 0.0;
      if (uGlove < 1.5) {
        float dsd = 9.0, typ = 0.0, w = vRs.w, back = smoothstep(0.2, 0.45, vRs.z);
        if (w < -0.5) {
          vec2 p = vec2(vRs.x + 0.001, vRs.y - 0.057);
          dsd = max(sdBox(p, vec2(0.0205, 0.0225)), (abs(p.x) + abs(p.y) - 0.0338) * 0.7071); typ = 1.0;
          float d2 = sdBox(vec2(vRs.x + 0.004, vRs.y - 0.0885), vec2(0.0375, 0.0042)); if (d2 < dsd) { dsd = d2; typ = 2.0; }
        } else if (w > 0.5) {
          float f = vAux, ac = vRs.x * 0.0088;
          float dA = sdBox(vec2((f - 1.17) * 0.075, ac), vec2(0.0088, 0.0052)) - 0.0010, dB = sdBox(vec2((f - 1.475) * 0.075, ac), vec2(0.0079, 0.0050)) - 0.0010;
          dsd = min(dA, dB); typ = 3.0;
        }
        dsd = mix(1.0, dsd, back);
        float aaP = fwidth(dsd) * 1.1 + 1e-5;
        plIn = smoothstep(aaP, -aaP, dsd);
        if (plIn > 0.001) {
          vec2 gd = vec2(dFdx(dsd), dFdy(dsd)); float gl = length(gd) + 1e-7;
          float bev = smoothstep(0.0, -0.0022, dsd);                       // 0 en el filo, 1 en el interior
          vec3 Np = normalize(N + vec3(gd / gl, 0.0) * (1.0 - bev) * 0.95);
          float dp0 = dot(Np, L1) * 0.5 + 0.5, dpf = dp0 * dp0, hp = Np.y * 0.5 + 0.5, spp = pow(max(dot(Np, H), 0.0), 38.0);
          vec3 pc;
          if (typ < 1.5) {                                                 // cristal facetado del dorso
            vec2 F = facets(vec2(vRs.x, vRs.y) * 210.0); float tl = (F.x - 0.5);
            vec3 Nf2 = normalize(Np + vec3(tl, h21(vec2(F.x * 7.0, 1.0)) - 0.5, 0.0) * 0.55);
            float d3 = dot(Nf2, L1) * 0.5 + 0.5, sp2 = pow(max(dot(Nf2, H), 0.0), 60.0);
            vec3 cb = mix(uColor, uAccent, F.x * 0.75) * 0.34 + vec3(0.02, 0.03, 0.05);
            pc = cb * (0.35 + 1.5 * d3 * d3) + vec3(sp2) * 0.9 + pal(F.x + fres + uTime * 0.07) * (0.12 + 0.3 * fres) + uColor * smoothstep(0.1, 0.0, F.y) * 0.35;
          } else {                                                          // armadura oscura anodizada
            vec3 cb = vec3(0.075, 0.08, 0.11) + uColor * 0.045;
            pc = cb * (0.3 + 0.5 * hp + 1.3 * dpf) + vec3(spp) * 0.8 + uColor * pow(1.0 - ndv, 2.5) * 0.45;
            pc += uColor * (1.0 - smoothstep(0.0, 0.0006 + aaP, abs(dsd + 0.0016))) * 0.9 * (typ > 2.5 ? 1.0 : 0.6);   // hilo luminoso inset
          }
          float line = 1.0 - smoothstep(0.0, 0.0007 + aaP, abs(dsd + 0.0013));
          pc += mix(uColor, uAccent, 0.5 + 0.5 * sin(vAux * 12.0 - uTime * 3.0)) * line * (0.9 + 1.6 * uFire + 0.7 * uUpg) * (typ < 1.5 ? 1.4 : 0.8);
          col = mix(col, pc, plIn);
        }
      }
      // — tatuaje
      if (uTatAmt > 0.5) {
        vec3 T;
        if (uTat < 0.5) T = tRunas(q, aa); else if (uTat < 1.5) T = tOjos(q, aa); else if (uTat < 2.5) T = tConst(q, aa); else T = tVenas(q, aa * 0.02);
        T *= vCol.z * (1.0 - 0.7 * plIn);
        float flow = pow(0.5 + 0.5 * sin(vAux * 15.0 - uTime * 3.2), 5.0);                 // pulso que corre hacia los dedos
        float bias = (uGlove > 1.5 ? 1.0 : (uGlove > 0.5 ? 1.35 : 1.0));
        vec3 tc = mix(uColor, uAccent, clamp(T.z * 0.7 + flow * 0.35, 0.0, 1.0));
        vec3 fc = mix(uAccent, uColor, 0.5 + 0.5 * sin(uTime * 2.0 + vAux * 8.0));
        col += tc * T.x * inten * (1.0 + flow * 0.8) * 1.5 * bias + fc * T.y * inten * 0.9 + vec3(1.0) * T.z * (0.35 + uFire * 0.5);
      }
    } else if (kd > 5.5 && kd < 6.5) {               // uña: lámina pulida con brillo
      float sp = pow(max(dot(N, H), 0.0), 60.0);
      col = (uGlove > 1.5 ? vec3(0.78, 0.55, 0.52) : mix(vec3(0.5, 0.4, 0.45), uColor, 0.35)) * (0.5 + 0.9 * (dot(N, L1) * 0.5 + 0.5)) + vec3(sp) * 0.9 + uAccent * fres * 0.7;
    } else if (kd > 0.5 && kd < 1.5) {                // placa de cristal facetado
      vec3 n = Nf; float face = h21(floor(n.xy * 5.0 + n.z * 11.0)), l = dot(n, L1) * 0.5 + 0.5;
      vec3 base = mix(uColor, uAccent, face * 0.7);
      float c = abs(vn(vPos * 90.0 + n * 3.0) - 0.5);
      col = base * (0.2 + 0.8 * l) * (0.6 + 0.4 * inten * 0.6) + vec3(1.0) * pow(clamp(1.0 - c * 3.5, 0.0, 1.0), 3.0) * 0.3 + pal(face + fres * 0.8 + uTime * 0.1) * fres * 0.3 + vec3(pow(max(dot(n, H), 0.0), 40.0)) * 0.75;
      col += base * (0.18 + 0.5 * uFire);
    } else if (kd > 1.5 && kd < 2.5) {                // armadura oscura facetada (placas y correas)
      vec3 Na = normalize(mix(N, Nf, 0.55)); float dif0 = dot(Na, L1) * 0.5 + 0.5, hemi = Na.y * 0.5 + 0.5, dif2 = max(dot(Na, L2), 0.0) * 0.3;
      vec3 base = (vec3(0.085, 0.09, 0.12) + uColor * 0.035) * vCol.r; float sp = pow(max(dot(Na, H), 0.0), 40.0) * 0.8;
      col = base * (0.3 + 0.5 * hemi + 1.1 * dif0 * dif0 + dif2) + vec3(sp) + uColor * pow(1.0 - clamp(dot(Na, V), 0.0, 1.0), 2.5) * 0.55;
    } else if (kd > 2.5 && kd < 3.5) {                // costura luminosa
      float fl = 0.5 + 0.5 * sin(vAux * 18.0 - uTime * 3.4);
      vec3 c = mix(uColor, uAccent, fl); col = c * (1.2 + 0.6 * fl + 1.4 * uFire + 0.8 * uUpg) + uWeap * 0.35;
    } else if (kd > 3.5 && kd < 4.5) {                // manga de tela: trama, venas de cristal que corren y se deshace en polvo de cristal al final
      float fade = smoothstep(0.42, 1.0, vAux), nz = vn(vPos * 300.0) * 0.6 + vn(vPos * 640.0 + 3.0) * 0.4, lim = fade * 1.12 - 0.05;
      if (nz < lim) discard;
      float dif0 = dot(N, L1) * 0.5 + 0.5, hemi = N.y * 0.5 + 0.5, dif2 = max(dot(N, L2), 0.0) * 0.3;
      float rib = 0.88 + 0.12 * sin(vPos.y * 420.0 + vPos.x * 110.0) * sin(vPos.z * 380.0);
      vec3 base = (vec3(0.05, 0.055, 0.085) + uColor * 0.035) * rib;
      col = base * (0.35 + 0.5 * hemi + 1.0 * dif0 * dif0 + dif2) + uAccent * fres * 0.3;
      float vn1 = abs(vn(vPos * 70.0 + vec3(0.0, 0.0, 2.0)) - 0.5), vein = 1.0 - smoothstep(0.012, 0.035, vn1);
      float pulse = pow(0.5 + 0.5 * sin(vAux * 14.0 - uTime * 3.0), 4.0);
      col += mix(uColor, uAccent, pulse) * vein * (0.5 + 0.9 * pulse + 1.3 * uFire + 0.6 * uUpg) * (1.0 - fade * 0.5);
      col += mix(uColor, vec3(1.0), 0.4) * (1.0 - smoothstep(0.0, 0.11, nz - lim)) * fade * 2.2;   // borde incandescente del polvo
    } else {                                          // pantallita de muñeca: HUD de cristal (barras, ojo cósmico, barrido)
      vec2 sc = vRs.xy; float t = uTime;
      float frame = 1.0 - smoothstep(0.0, 0.05, 0.92 - max(abs(sc.x), abs(sc.y)));
      float bars = 0.0; for (int i = 0; i < 4; i++) { float fi = float(i), cx = -0.66 + fi * 0.44, hgt = 0.18 + 0.3 * (0.5 + 0.5 * sin(t * (1.3 + fi * 0.7) + fi * 2.1) + uFire * 0.4);
        bars = max(bars, step(abs(sc.x - cx), 0.13) * step(0.62, sc.y) * step(sc.y, 0.62 + hgt)); }
      vec2 e = (sc - vec2(0.0, -0.22)) * vec2(1.0, 1.35); float lid = 0.5 * (1.0 - e.x * e.x * 1.1);
      float eye = smoothstep(0.045, 0.0, abs(abs(e.y) - max(lid, 0.0)) - 0.02) * step(abs(e.x), 0.93);
      vec2 pc = e - vec2(0.18 * sin(t * 0.8), 0.04 * sin(t * 1.3)); float iris = smoothstep(0.30, 0.26, length(pc)) * step(abs(e.y), lid), pup = smoothstep(0.11, 0.08, length(pc * vec2(1.6, 1.0)));
      float scan = smoothstep(0.08, 0.0, abs(sc.y - (fract(t * 0.35) * 2.0 - 1.0)));
      float dots = step(0.5, fract(sc.x * 9.0)) * step(abs(sc.y + 0.88), 0.04);
      vec3 ink = uColor * (frame * 1.2 + bars * 1.4 + eye * 1.1 + scan * 0.5 + dots * 0.8) + uAccent * (iris * (1.0 - pup) * 1.5 + pup * 0.0);
      col = vec3(0.008, 0.012, 0.026) + ink * (0.9 + 0.9 * uFire) + uAccent * fres * 0.6 + vec3(pow(max(dot(N, H), 0.0), 40.0)) * 0.5;
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
