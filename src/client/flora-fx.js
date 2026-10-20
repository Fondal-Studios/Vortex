// FLORA (cliente): dibuja el jardín psicodélico de cada arena y lo que la flora interactiva hace (docs/FLORA.md → «Dibujo»).
// La simulación está en src/sim/flora.js; este módulo sólo LEE `state.fl` (estado de cada planta, nubes de esporas, efectos sobre el Huésped).
// PSICODELIA FLASHERA PERO LEGIBLE y BARATA. Todo es autoiluminado y cabe en CINCO llamadas de dibujo:
//   1. plantas + decorado (árboles de cristal, helechos luminosos, setas gigantes, enredaderas que laten) = UNA malla fusionada con un shader que mece, abre,
//      encoge y pinta cada planta según su estado (uniformes por planta), y que DISUELVE (tramado) lo alto que se interpone entre la cámara y el Huésped;
//   2. marcas de suelo = los aros de acción de cada planta con el código de color (verde/cian/dorado ayuda · rojo/magenta daño · violeta/ácido veneno) y el aviso;
//   3. pasto bioluminiscente = una malla de manojos que se aplasta y se ilumina al paso del Huésped y de las criaturas;
//   4. hojas y esporas flotando = una nube de puntos alrededor del Huésped;
//   5. nubes de esporas (veneno / sueño) = hasta 6 esferas en una malla.
// Presupuesto en Baja (renderer.info, tests/flora-render.test.js): ≤ 8 llamadas y ≤ 4 000 triángulos agregados. Calidad (`cfg().vegDens`): 1 Baja · 2 Media · 3 Alta.
// El interruptor «Vegetación» (cfg().veg) apaga el decorado, el pasto y las hojas; las plantas del juego y sus avisos se dibujan SIEMPRE (son parte de la jugada).
// HUD mínimo: un cartel `#flchip` (dentro de #hud) sólo cuando hay una planta interactiva a mano o un efecto de planta sobre el Huésped.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uTime, finish } from './shaders.js';
import { OUT } from './shaders.js';
import { MAPS } from '../sim/maps.js';
import { makeRng } from '../sim/math.js';
import { ESPECIES, especieDe, CODIGO, FN, PALETA_ARENA, ST } from '../sim/flora-data.js';
import { candidatoFlora, clavesDe, sitioLibre } from '../sim/flora.js';
import { formaPlanta, formaDeco, DECO_ARENA, pastoGeometria, rgb } from './env/flora-kit.js';

const NMAX = 32, NCL = 6, NST = 8;
const hex = (s) => parseInt(s.slice(1), 16);
const V4 = () => new THREE.Vector4(), V3 = () => new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const DENS = { 1: { grass: 60, deco: 0.45, motes: 36, det: 0 }, 2: { grass: 220, deco: 1, motes: 90, det: 1 }, 3: { grass: 520, deco: 1.6, motes: 180, det: 2 } };
const FLAG_ES = [[1, 'Frenado'], [2, 'Atrapado'], [4, 'Con escudo'], [8, 'Envenenado'], [16, 'Dormido'], [32, 'Curándose']];

/* ───────── shaders ───────── */
const COMMON_FRAG = `
  float bayer(vec2 p){ vec2 q = mod(floor(p), 4.0); float i = q.x + q.y * 4.0;
    return (mod(i * 7.0, 16.0) + 0.5) / 16.0; }`;
const PLANT_VERT = `
  attribute vec3 aC, aR, aBase; attribute vec4 aP; attribute float aH;
  uniform float uTime, uFadeOn; uniform vec4 uS[${NMAX}], uN[${NMAX}], uW[${NMAX}]; uniform vec3 uHero, uCam;
  varying vec3 vC, vN, vWarn; varying float vG, vFade, vId, vSt, vProg, vFlag, vH, vFlash, vNear, vKind;
  void main(){
    vec3 p = position; float id = aP.w; int ii = int(id + 0.5);
    float st = 1.0, prog = 1.0, flags = 0.0, near = 0.0, flash = 0.0, kind = 0.0; vec3 warn = vec3(1.0);
    if (id > -0.5) { vec4 s = uS[ii], n = uN[ii], w = uW[ii]; st = s.x; prog = s.y; flags = s.w; near = n.x; flash = n.y; warn = w.xyz; kind = w.w; }
    float scale = 1.0;
    if (id > -0.5) {
      if (st > 3.5) scale = 0.0;
      else if (st < 0.5) scale = 0.2 + 0.8 * prog;
      else if (st > 2.5) scale = 0.32 + 0.1 * (1.0 - prog);
      else if (st > 1.5) scale = 1.0 + 0.07 * prog * sin(uTime * 22.0);
      else scale = 1.0 + 0.025 * sin(uTime * 2.0 + id);
    }
    p = aBase + (p - aBase) * scale;
    float ph = aBase.x * 0.7 + aBase.z * 1.3;
    float sway = sin(uTime * 1.6 + ph + aH * 1.7) * (0.07 + 0.06 * near);
    float open = clamp(near * 0.7 + (st > 1.5 && st < 2.5 ? 0.5 + 0.5 * prog : 0.0) + flash * 0.6, 0.0, 1.0);
    if (kind > 0.5 && kind < 1.5 && st > 0.5 && st < 1.5) open = max(open, 0.3);   // las ofensivas en reposo tienen la boca / las lianas entreabiertas: se leen como peligrosas
    if (st > 2.5 && st < 3.5) open = 0.0;
    float pulseVine = id < -0.5 ? 0.0 : 0.0;
    p += aR * (aP.y * sway + aP.z * open * 0.42 + pulseVine);
    vec4 wp = vec4(p, 1.0);
    vFade = 0.0;
    if (uFadeOn > 0.5 && aH > 0.7) {                                    // lo alto que tapa al Huésped se disuelve
      vec3 a = uCam, b = uHero, ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
      float d = length(p - (a + ab * t)); vFade = smoothstep(2.0, 0.7, d) * step(t, 0.96) * step(0.04, t);
    }
    vC = aC; vN = normal; vWarn = warn; vG = aP.x; vId = id; vSt = st; vProg = prog; vFlag = flags; vH = aH; vFlash = flash; vNear = near; vKind = kind;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const PLANT_FRAG = `
  uniform float uTime, uLin; ${COMMON_FRAG}
  varying vec3 vC, vN, vWarn; varying float vG, vFade, vId, vSt, vProg, vFlag, vH, vFlash, vNear, vKind;
  void main(){
    if (vFade > 0.0 && bayer(gl_FragCoord.xy) < vFade * 0.92) discard;
    vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
    float lam = 0.5 + 0.5 * dot(N, normalize(vec3(0.4, 0.8, 0.3)));
    float eclipse = mod(floor(vFlag / 4.0), 2.0), frozen = mod(vFlag, 2.0), burning = mod(floor(vFlag / 2.0), 2.0), rare = mod(floor(vFlag / 32.0), 2.0);
    float pulse = 0.72 + 0.28 * sin(uTime * (2.0 + mod(vId, 5.0) * 0.3) + vId * 1.7 + vH * 2.0);
    vec3 col = vC * (0.4 + 0.55 * lam) + vC * vG * pulse * (0.42 + 0.4 * eclipse) + vec3(0.06) * vG;
    col += vC * vNear * vG * 0.35;
    if (vSt > 2.5 && vSt < 3.5) { float gr = dot(col, vec3(0.33)); col = mix(col, vec3(gr * 0.5), 0.82); }
    if (vSt > 1.5 && vSt < 2.5) { float bl = step(0.0, sin(uTime * (9.0 + 18.0 * vProg))); col = mix(col, vWarn, 0.35 + 0.4 * bl); col += vWarn * 0.3 * bl * vProg; }
    if (frozen > 0.5) col = mix(col, vec3(0.72, 0.95, 1.0) * (0.8 + 0.3 * lam), 0.65);
    if (burning > 0.5) col = mix(col, vec3(1.0, 0.55, 0.12) * (0.75 + 0.5 * sin(uTime * 28.0 + vH * 7.0)), 0.55);
    if (rare > 0.5) col += (0.5 + 0.5 * cos(6.28318 * (uTime * 0.35 + vH * 0.4 + vec3(0.0, 0.33, 0.67)))) * 0.2 + 0.1 * step(0.97, fract(sin(vH * 91.7 + floor(uTime * 6.0)) * 437.5));
    col += vec3(1.0) * vFlash * 0.45;
    float rim = pow(1.0 - clamp(abs(N.y) * 0.5 + 0.5, 0.0, 1.0), 2.0) * 0.12; col += vC * rim;
    if (uLin > 0.5) col = pow(col, vec3(2.2));
    gl_FragColor = vec4(col, 1.0);
  }`;
const MARK_VERT = `
  attribute vec2 aK; attribute float aId; uniform vec4 uS[${NMAX}], uW[${NMAX}], uN[${NMAX}]; varying vec2 vUv, vK; varying vec4 vS, vW; varying float vNear;
  void main(){ int i = int(aId + 0.5); vS = uS[i]; vW = uW[i]; vK = aK; vUv = uv; vNear = uN[i].x; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`;
const MARK_FRAG = `
  uniform float uTime, uLin; varying vec2 vUv, vK; varying vec4 vS, vW; varying float vNear;
  void main(){
    vec2 p = (vUv - 0.5) * 2.0; float r = length(p), a = atan(p.y, p.x), st = vS.x, prog = vS.y, kind = vW.w;
    float frozen = mod(vS.w, 2.0), burning = mod(floor(vS.w / 2.0), 2.0);
    if (st > 3.5 || (st > 2.5 && st < 3.5)) discard;
    float rk = vK.x, rt = vK.y;
    float edge = smoothstep(0.045, 0.0, abs(r - rk)), edgeT = rt > 0.01 ? smoothstep(0.03, 0.0, abs(r - rt)) * step(0.5, fract(a * 3.0 + uTime * 0.25)) : 0.0;
    float dash = kind > 0.5 ? step(0.5, fract(a * 5.0 - uTime * 0.6)) : 1.0;
    float disc = smoothstep(rk, rk * 0.15, r);
    vec3 col = vW.xyz; float al;
    if (st < 0.5) al = (0.35 * edge * step(0.5, fract(a * 8.0)) + 0.03 * disc) * 0.6;                           // brote: puntitos tenues
    else if (st > 1.5) { float bl = 0.55 + 0.45 * sin(uTime * (10.0 + 16.0 * prog)); float fill = smoothstep(rk * prog + 0.02, rk * prog - 0.02, r); al = 0.75 * edge * bl + (0.2 + 0.5 * prog) * fill * bl + edgeT * 0.5; col = mix(col, vec3(1.0), 0.35 * bl); }  // armando: el círculo se llena hasta la acción
    else al = 0.26 * edge * dash + 0.045 * disc + edgeT * 0.22 + vNear * 0.2 * edge;                         // madura: aro tenue, más vivo si te acercás
    if (frozen > 0.5) col = mix(col, vec3(0.7, 0.95, 1.0), 0.7); if (burning > 0.5) col = mix(col, vec3(1.0, 0.5, 0.1), 0.7);
    if (uLin > 0.5) col = pow(col, vec3(2.2));
    gl_FragColor = vec4(col, clamp(al, 0.0, 0.85));
  }`;
const GRASS_VERT = `
  attribute vec3 aBase, aT, aU, aC; uniform float uTime; uniform vec4 uStep[${NST}]; varying vec3 vC; varying float vGlow, vT;
  void main(){
    vec3 p = position; float tip = aT.x, h = aT.y, ph = aT.z; vGlow = 0.0;
    p += (cross(aU, vec3(0.3, 0.9, 0.2)) + vec3(0.0)) * 0.0;
    vec3 dir = normalize(cross(aU, vec3(0.37, 0.11, 0.92)) + 0.001);
    p += dir * sin(uTime * 1.7 + ph + aBase.x * 0.4) * 0.07 * tip * h * 2.0;                   // ondula con el viento
    for (int k = 0; k < ${NST}; k++) {
      vec4 s = uStep[k]; if (s.w < 0.01) continue;
      vec3 dv = p - s.xyz; dv -= aU * dot(dv, aU); float d = length(dv); float f = smoothstep(s.w, 0.25, d);
      p += (normalize(dv + 0.001) * 0.5 - aU * h * 0.55) * f * tip; vGlow += f * tip;           // se aplasta y se ilumina al paso
    }
    vC = aC; vT = tip; gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const GRASS_FRAG = `
  uniform float uTime, uLin; varying vec3 vC; varying float vGlow, vT;
  void main(){ vec3 col = vC * (0.55 + 0.7 * vT) + vC * vGlow * 1.4 + vec3(0.12) * vT * (0.5 + 0.5 * sin(uTime * 2.0 + vT * 6.0)); if (uLin > 0.5) col = pow(col, vec3(2.2)); gl_FragColor = vec4(col, 1.0); }`;
const MOTE_VERT = `
  uniform float uTime, uSize, uPx; uniform vec3 uHero, uUp, uA, uB; attribute vec4 aSeed; varying vec3 vC; varying float vA;
  void main(){
    vec3 t1 = normalize(cross(uUp, abs(uUp.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), t2 = cross(uUp, t1);
    float t = uTime * (0.05 + 0.08 * aSeed.w);
    vec3 q = vec3(fract(aSeed.x + t * 0.3), fract(aSeed.y + t * 0.5), fract(aSeed.z + t * 0.2));
    vec3 rel = (q - 0.5) * vec3(40.0, 0.0, 40.0); float y = q.y * 7.0 + sin(uTime * (0.6 + aSeed.w) + aSeed.x * 20.0) * 0.4;
    vec3 wp = uHero + t1 * rel.x + t2 * rel.z + uUp * y;
    vec4 mv = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uSize * uPx / max(1.0, -mv.z), 1.5, 14.0);
    vC = mix(uA, uB, aSeed.w); vA = smoothstep(0.0, 0.1, q.y) * smoothstep(1.0, 0.8, q.y) * (0.5 + 0.5 * sin(uTime * 2.0 + aSeed.z * 30.0));
  }`;
const MOTE_FRAG = `uniform float uLin; varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.2, d) * vA; if (a < 0.02) discard; vec3 c = vC * 1.3; if (uLin > 0.5) c = pow(c, vec3(2.2)); gl_FragColor = vec4(c * a, a); }`;
const CLOUD_VERT = `
  attribute float aId; uniform vec4 uA[${NCL}], uB[${NCL}]; varying vec3 vP, vNs, vView; varying float vK, vT, vF;
  void main(){ int i = int(aId + 0.5); vec4 c = uA[i]; vec4 b = uB[i]; vec3 wp = c.xyz + position * c.w * 1.14; vP = position; vK = b.y; vT = b.x; vNs = normalize(position); vF = c.w; vView = normalize(cameraPosition - wp);
    gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`;
const CLOUD_FRAG = `
  uniform float uTime, uLin; varying vec3 vP, vNs, vView; varying float vK, vT, vF;
  void main(){
    if (vF < 0.02) discard;
    float f = abs(dot(normalize(vNs), normalize(vView)));                                     // espesor: el centro de la nube es lo más denso, el borde se disuelve
    float sw = 0.5 + 0.5 * sin(vP.x * 4.0 + vP.y * 6.0 - uTime * 1.2 + sin(vP.z * 3.0 + uTime * 0.6) * 2.0);
    vec3 col = vT < 0.5 ? mix(vec3(0.55, 0.15, 0.9), vec3(0.78, 1.0, 0.16), sw) : mix(vec3(0.35, 0.4, 1.0), vec3(0.8, 0.5, 1.0), sw);
    float hz = vT < 0.5 ? smoothstep(0.42, 0.5, fract((vP.x + vP.z) * 3.0 - uTime * 0.5)) * 0.35 : 0.0;
    float a = (0.05 + 0.13 * sw + hz * 0.2) * pow(f, 2.6) * 1.9 * smoothstep(0.0, 0.25, vK);
    if (uLin > 0.5) col = pow(col, vec3(2.2));
    gl_FragColor = vec4(col * (0.9 + 0.5 * sw), a);
  }`;

const CSS = `
#flchip{position:absolute;left:calc(env(safe-area-inset-left,0px) + 12px);top:calc(env(safe-area-inset-top,0px) + 232px);max-width:min(236px,30vw);display:none;padding:7px 11px 8px;border-radius:12px;background:rgba(10,12,26,.82);border:1px solid var(--fc,#fff);box-shadow:0 0 14px color-mix(in srgb,var(--fc,#fff) 38%,transparent);color:#fff;font:12px/1.35 system-ui,sans-serif;pointer-events:none;z-index:3}
#flchip.on{display:block}
#flchip .n{display:flex;gap:6px;align-items:baseline;font-weight:800;letter-spacing:.05em;color:var(--fc,#fff);font-size:13px}
#flchip .n i{font-style:normal;font-size:15px}
#flchip .f{opacity:.94;margin-top:2px}
#flchip .b{height:4px;margin-top:5px;border-radius:2px;background:#ffffff26;overflow:hidden}
#flchip .b i{display:block;height:100%;width:100%;background:var(--fc,#fff);transform-origin:left}
#flchip .e{margin-top:4px;color:#ffe9a8;font-weight:700}
#flchip.aviso{border-style:dashed;animation:flpulse .6s ease-in-out infinite alternate}
@keyframes flpulse{from{box-shadow:0 0 6px color-mix(in srgb,var(--fc,#fff) 30%,transparent)}to{box-shadow:0 0 22px color-mix(in srgb,var(--fc,#fff) 85%,transparent)}}
@media (max-width:700px){#flchip{top:calc(env(safe-area-inset-top,0px) + 190px);font-size:11px;max-width:34vw}#flchip .n{font-size:12px}}
`;
const ICONO = { cura: '✿', ofensiva: '✸', toxica: '☣' };
const VERBO = { cura: 'USAR: cosechar · si estás herido se come sola', ofensiva: 'Peligro: avisa antes de actuar', toxica: 'Especial: mirá su aviso' };

export class FloraFx {
  constructor(renderer) {
    this.r = renderer; this.root = new THREE.Group(); this.root.name = 'flora-fx'; renderer.scene.add(this.root);
    this.mapId = null; this.sig = ''; this.layout = []; this.t = 0; this.q = { veg: true, dens: 2 }; this.cerca = new Set(); this.key = ''; this.flash = new Float32Array(NMAX); this.near = new Float32Array(NMAX);
    this.U = {
      uTime, uLin: { value: OUT.linear ? 1 : 0 }, uFadeOn: { value: 0 }, uHero: { value: V3() }, uCam: { value: V3() },
      uS: { value: Array.from({ length: NMAX }, V4) }, uN: { value: Array.from({ length: NMAX }, V4) }, uW: { value: Array.from({ length: NMAX }, V4) },
      uStep: { value: Array.from({ length: NST }, V4) }, uA: { value: Array.from({ length: NCL }, V4) }, uB: { value: Array.from({ length: NCL }, V4) },
    };
    for (const s of this.U.uS.value) s.set(4, 0, 1, 0);
    this.build_deco = null;
    if (typeof document !== 'undefined') {
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      const hud = document.getElementById('hud');
      if (hud) { this.chip = document.createElement('div'); this.chip.id = 'flchip'; this.chip.setAttribute('aria-live', 'polite'); this.chip.innerHTML = '<div class="n"><i></i><span></span></div><div class="f"></div><div class="b"><i></i></div><div class="e"></div>'; hud.appendChild(this.chip); }
    }
    this.makeClouds();
  }
  /** Calidad: cfg().veg (decorado, pasto y hojas) y cfg().vegDens (1 Baja · 2 Media · 3 Alta). Reconstruye sólo la vegetación. */
  configure(q) {
    const veg = !q || q.veg !== false, dens = Math.max(1, Math.min(3, (q && q.vegDens) || 2));
    this.U.uLin.value = OUT.linear ? 1 : 0;
    if (veg !== this.q.veg || dens !== this.q.dens) { const d0 = this.q.dens; this.q = { veg, dens }; this.sig = ''; this.decoKey = ''; if ((d0 > 1) !== (dens > 1) && this.clouds) { this.limpiar(this.clouds); this.makeClouds(); } }
  }
  /* ───────── construcción ───────── */
  makeClouds() {
    const parts = []; for (let i = 0; i < NCL; i++) { const g = new THREE.IcosahedronGeometry(1, this.q.dens > 1 ? 1 : 0).toNonIndexed(); g.setAttribute('aId', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(i), 1)); parts.push(g); }
    const mat = new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    this.clouds = new THREE.Mesh(mergeGeometries(parts), finish(mat)); this.clouds.frustumCulled = false; this.clouds.renderOrder = 5; this.clouds.name = 'flora-nubes'; this.clouds.visible = false; this.root.add(this.clouds);
  }
  limpiar(m) { if (!m) return; this.root.remove(m); m.geometry && m.geometry.dispose(); m.material && m.material.dispose(); }
  /** Plantas + decorado en una malla (se rehace sólo cuando cambia la disposición o la calidad). */
  construir(map, L) {
    this.limpiar(this.mesh); this.limpiar(this.marks); this.mesh = this.marks = null;
    const dens = DENS[this.q.dens], pal = PALETA_ARENA[this.mapId] || PALETA_ARENA.m1, geos = [], mark = [];
    const rnd0 = makeRng(hashStr(this.mapId + 'deco')), rnd = () => rnd0.next();
    const M4 = new THREE.Matrix4(), pos = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    this.up = [];
    L.forEach((a, i) => {
      const S = a[0] >= 0 ? especieDe(a[0]) : null; this.up[i] = _v.set(a[4], a[5], a[6]).clone();
      if (!S) return;
      const P = formaPlanta(S.forma, S, pal, dens.det), u = this.up[i], yaw = ((i * 2.399) % 6.28);
      pos.set(a[1], a[2], a[3]); _q.setFromUnitVectors(Y, u); _w.copy(u); const yq = new THREE.Quaternion().setFromAxisAngle(Y, yaw);
      M4.compose(pos, _q.clone().multiply(yq), sc.setScalar(S.forma === 'arbol' ? 1.1 : 1.4));
      geos.push(...P.hornear(M4, i, pos.clone(), yaw));
      const half = Math.max(S.r, S.p.rt || 0, S.p.nr ? 1.2 : 0) * 1.14;
      const g = new THREE.PlaneGeometry(half * 2, half * 2); const t1 = new THREE.Vector3(1, 0, 0); if (Math.abs(u.x) > 0.9) t1.set(0, 0, 1); t1.cross(u).normalize(); const t2 = new THREE.Vector3().crossVectors(u, t1);
      const bas = new THREE.Matrix4().makeBasis(t1, t2, u); g.applyMatrix4(bas.setPosition(pos.x + u.x * 0.07, pos.y + u.y * 0.07, pos.z + u.z * 0.07));
      const n = g.attributes.position.count; g.setAttribute('aId', new THREE.BufferAttribute(new Float32Array(n).fill(i), 1));
      const k = new Float32Array(n * 2); for (let j = 0; j < n; j++) { k[j * 2] = S.r / half; k[j * 2 + 1] = S.p.rt ? S.p.rt / half : 0; } g.setAttribute('aK', new THREE.BufferAttribute(k, 2)); mark.push(g.toNonIndexed());
      const c = rgb(CODIGO[S.col]); this.U.uW.value[i].set(c[0], c[1], c[2], S.fn === 'ofensiva' ? 1 : S.fn === 'toxica' ? 2 : 0);
    });
    if (this.q.veg) this.decorar(map, L, geos, pal, dens, rnd);
    if (geos.length) { this.mesh = new THREE.Mesh(mergeGeometries(geos), finish(new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: PLANT_VERT, fragmentShader: PLANT_FRAG, side: THREE.DoubleSide }))); this.mesh.frustumCulled = false; this.mesh.name = 'flora-plantas'; this.root.add(this.mesh); }
    if (mark.length) { this.marks = new THREE.Mesh(mergeGeometries(mark), finish(new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: MARK_VERT, fragmentShader: MARK_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }))); this.marks.frustumCulled = false; this.marks.renderOrder = 2; this.marks.name = 'flora-marcas'; this.root.add(this.marks); }
    geos.forEach((g) => g.dispose()); mark.forEach((g) => g.dispose());
  }
  /** Decorado (sin estado) y pasto: se reparten con el mismo muestreo y las mismas reglas de suelo libre que las plantas (nunca sobre apariciones ni objetivos). */
  decorar(map, L, geos, pal, dens, rnd) {
    const K = clavesDe(map), otros = L.filter((a) => a[0] >= 0).map((a) => ({ pos: { x: a[1], y: a[2], z: a[3] } })), puestos = [], M4 = new THREE.Matrix4(), sc = new THREE.Vector3(1, 1, 1);
    const rng = { next: rnd, unit: () => { const z = rnd() * 2 - 1, a = rnd() * 6.2832, r = Math.sqrt(1 - z * z); return { x: r * Math.cos(a), y: z, z: r * Math.sin(a) }; } };
    const lugar = (min, intentos = 60) => {
      for (let k = 0; k < intentos; k++) {
        const c = candidatoFlora(map, rng); if (!sitioLibre(map, c.pos, c.u, K, false, [])) continue;
        if ([...otros, ...puestos].some((q) => Math.hypot(q.pos.x - c.pos.x, q.pos.y - c.pos.y, q.pos.z - c.pos.z) < min)) continue;
        return c;
      }
      return null;
    };
    const lista = DECO_ARENA[this.mapId] || DECO_ARENA.m1; let idx = 0;
    for (const [tipo, cnt] of lista) {
      const n = Math.max(1, Math.round(cnt * dens.deco));
      for (let j = 0; j < n; j++) {
        const c = lugar(tipo === 'cristal' || tipo === 'hueso' || tipo === 'seta' ? 4 : 2.6); if (!c) continue; puestos.push(c);
        const P = formaDeco(tipo, pal, dens.det, rnd), yaw = rnd() * 6.28, u = new THREE.Vector3(c.u.x, c.u.y, c.u.z), pos = new THREE.Vector3(c.pos.x, c.pos.y, c.pos.z);
        _q.setFromUnitVectors(Y, u); M4.compose(pos, _q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw)), sc.setScalar(0.85 + rnd() * 0.5));
        geos.push(...P.hornear(M4, -1, pos, yaw)); idx++;
      }
    }
    // pasto: manojos alrededor de las plantas y en parches sueltos
    const manojos = [], want = dens.grass, tangente = (u) => { const t1 = new THREE.Vector3(1, 0, 0); if (Math.abs(u.x) > 0.9) t1.set(0, 0, 1); t1.cross(u).normalize(); return [t1, new THREE.Vector3().crossVectors(u, t1)]; };
    for (let guard = 0; manojos.length < want && guard < want * 8; guard++) {
      let centro, u;
      if (guard % 2 === 0 && L.length) { const a = L[Math.floor(rnd() * L.length)]; if (a[0] < 0) continue; centro = new THREE.Vector3(a[1], a[2], a[3]); u = new THREE.Vector3(a[4], a[5], a[6]); }
      else { const c = lugar(0.01, 4); if (!c) continue; centro = new THREE.Vector3(c.pos.x, c.pos.y, c.pos.z); u = new THREE.Vector3(c.u.x, c.u.y, c.u.z); }
      const [t1, t2] = tangente(u), r = 1.2 + rnd() * 2.2, ang = rnd() * 6.28, p = centro.clone().addScaledVector(t1, Math.cos(ang) * r).addScaledVector(t2, Math.sin(ang) * r);
      if (map.id === 'm2') { p.setLength(map.R - 0.05); u = p.clone().normalize().negate(); }
      if (!sitioLibre(map, p, u, null, false, [])) continue;
      manojos.push({ p: [p.x, p.y, p.z], u: [u.x, u.y, u.z] });
    }
    this.limpiar(this.grass); this.grass = null;
    if (manojos.length) {
      this.grass = new THREE.Mesh(pastoGeometria(manojos, rnd, pal, null, 0.75), finish(new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG, side: THREE.DoubleSide })));
      this.grass.frustumCulled = false; this.grass.name = 'flora-pasto'; this.root.add(this.grass);
    }
    // hojas y esporas flotando
    this.limpiar(this.motes); this.motes = null;
    const N = dens.motes, seed = new Float32Array(N * 4), at = new Float32Array(N * 3); for (let i = 0; i < N * 4; i++) seed[i] = rnd();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(at, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    const A = rgb(pal.hoja), B = rgb(pal.a);
    const mat = new THREE.ShaderMaterial({ uniforms: { uTime, uLin: this.U.uLin, uHero: this.U.uHero, uUp: { value: new THREE.Vector3(0, 1, 0) }, uA: { value: new THREE.Vector3(...A) }, uB: { value: new THREE.Vector3(...B) }, uSize: { value: 0.16 }, uPx: { value: 520 } }, vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.motes = new THREE.Points(g, finish(mat)); this.motes.frustumCulled = false; this.motes.renderOrder = 4; this.motes.name = 'flora-motas'; this.root.add(this.motes);
  }
  dispose() { this.limpiar(this.mesh); this.limpiar(this.marks); this.limpiar(this.grass); this.limpiar(this.motes); this.limpiar(this.clouds); this.root.removeFromParent(); if (this.chip) this.chip.remove(); }

  /* ───────── cada cuadro ───────── */
  update(dt, state, me) {
    this.t += dt; const fl = state && state.fl;
    if (!fl || !fl.s) { this.root.visible = false; this.chipOff(); return; }
    this.root.visible = true;
    if (state.map !== this.mapId) { this.mapId = state.map; this.sig = ''; this.layout = []; }
    const map = MAPS[state.map];
    if (fl.l) { const sig = fl.l.map((a) => a.join(',')).join('|') + this.q.veg + this.q.dens; if (sig !== this.sig) { this.sig = sig; this.layout = fl.l; if (map) this.construir(map, fl.l); } }
    if (!this.mesh && !this.marks) { this.chipOff(); return; }
    const S = this.U.uS.value, N = this.U.uN.value, hero = me ? _v.set(me.pos[0], me.pos[1], me.pos[2]) : null;
    this.cerca.clear();
    for (let i = 0; i < Math.min(NMAX, fl.s.length); i++) {
      const [st, hp, flags, prog] = fl.s[i], sp = this.layout[i] ? this.layout[i][0] : -1;
      let near = 0;
      if (hero && this.layout[i] && st !== ST.AUSENTE) {
        const L = this.layout[i], d = Math.hypot(hero.x - L[1], hero.y - L[2], hero.z - L[3]); near = Math.max(0, Math.min(1, 1 - (d - 1.2) / 6)); if (d < 14 && sp >= 0) { const E = especieDe(sp); if (E) this.cerca.add(E.id); }
        for (const m of state.monsters || []) { const dm = Math.hypot(m.p[0] - L[1], m.p[1] - L[2], m.p[2] - L[3]); if (dm < 8) near = Math.max(near, 1 - (dm - 1) / 7); }
      }
      this.near[i] += (near - this.near[i]) * Math.min(1, dt * 6); this.flash[i] = Math.max(0, this.flash[i] - dt * 2.4);
      S[i].set(st, prog / 100, hp / 100, flags); N[i].set(this.near[i], this.flash[i], 0, i);
    }
    for (let i = fl.s.length; i < NMAX; i++) S[i].set(4, 0, 0, 0);
    // nubes de esporas
    const A = this.U.uA.value, B = this.U.uB.value; let nc = 0;
    for (const n of fl.nb || []) { if (nc >= NCL) break; A[nc].set(n[1], n[2], n[3], n[4]); B[nc].set(n[0], n[5] / 100, 0, 0); nc++; }
    for (let i = nc; i < NCL; i++) A[i].set(0, 0, 0, 0);
    this.clouds.visible = nc > 0;
    // Huésped, cámara y tramado
    const cam = this.r.camera;
    if (hero) { this.U.uHero.value.copy(hero).addScaledVector(_w.set(me.up[0], me.up[1], me.up[2]), 0.9); this.U.uCam.value.copy(cam.position); this.U.uFadeOn.value = this.U.uCam.value.distanceTo(this.U.uHero.value) > 1.8 ? 1 : 0; }
    // pasto: pisadores (Huésped y las criaturas más cercanas)
    const ST_ = this.U.uStep.value; let k = 0;
    if (hero) { ST_[k++].set(me.pos[0], me.pos[1], me.pos[2], 1.7); const ms = (state.monsters || []).map((m) => [Math.hypot(m.p[0] - hero.x, m.p[1] - hero.y, m.p[2] - hero.z), m]).filter((x) => x[0] < 30).sort((a, b) => a[0] - b[0]).slice(0, NST - 1); for (const [, m] of ms) ST_[k++].set(m.p[0], m.p[1], m.p[2], 1.2 + m.r * 0.5); }
    for (; k < NST; k++) ST_[k].set(0, 0, 0, 0);
    if (this.motes && hero) { const u = this.motes.material.uniforms; u.uUp.value.set(me.up[0], me.up[1], me.up[2]); u.uPx.value = (this.r.gl.domElement.height || 600) * 0.9; this.motes.visible = this.q.veg; }
    if (this.grass) this.grass.visible = this.q.veg;
    this.hud(fl, me);
  }
  /** ¿Hay una planta madura al alcance de USAR? (la usa el botón USAR táctil). */
  get usar() { return !!this.usarOk; }
  /** Efectos al interactuar (cura, picadura, esporas, crujido…). `e` = evento {t:'flora', a, sp, id, p, …}. */
  onEvent(e, me, state) {
    const fx = this.r.fx; if (!fx || !e.p) return;
    const S = especieDe(e.sp), P = _v.set(e.p[0], e.p[1], e.p[2]), up = (this.up && this.up[e.id]) || Y, c = S ? hex(CODIGO[S.col]) : 0xffffff;
    const top = P.clone().addScaledVector(up, 1.0);
    if (e.id != null && e.id >= 0 && e.id < NMAX) this.flash[e.id] = 1;
    switch (e.a) {
      case 'cura': case 'escudo': case 'energia': fx.spray(top, c, 18, 3.5, 1.0, 0.22, { up: 3, grow: -0.5, c2: 0xffffff }); fx.ring(P, up, c, 2.4, 0.55, { op: 0.8 }); break;
      case 'cosecha': fx.spray(top, 0xffe27a, 16, 4, 0.8, 0.2, { up: 2.5, c2: c }); fx.ring(P, up, 0xffe27a, 1.8, 0.4); break;
      case 'rota': fx.shatter(top, c, { size: 0.35, n: 8, speed: 7 }); break;
      case 'arma': fx.ring(P, up, c, (S && S.r) || 2.5, e.tel || 1.2, { op: 0.9, r0: 0.4 }); break;
      case 'muerde': fx.burst(top, 0xffffff, 12, 8, 0.35, 0.3); fx.burst(top, c, 20, 7, 0.5, 0.35); fx.ring(P, up, c, (S && S.r) || 2.8, 0.3, { op: 0.9 }); break;
      case 'ata': fx.ring(P, up, c, (S && S.r) || 2.6, 0.45, { op: 0.9 }); fx.spray(P, c, 20, 5, 0.6, 0.18, { up: 4 }); break;
      case 'pincha': fx.sparks(top, c, 5, 6, 0.3); break;
      case 'estalla': fx.burst(top, 0xffffff, 16, 10, 0.4, 0.4); fx.burst(top, c, 30, 9, 0.7, 0.35); fx.ring(P, up, c, (S && S.r) || 4, 0.5, { op: 0.9 }); break;
      case 'suelta': fx.spray(top, c, 26, 3, 1.4, 0.45, { smoke: true, grow: 0.6 }); break;
      case 'refleja': fx.flash(top, 0xbff7ff, 2.2, 0.15); fx.sparks(top, 0xbff7ff, 8, 9, 0.35); break;
      case 'arde': fx.spray(top, 0xff9a3c, 14, 3, 0.8, 0.28, { up: 4, c2: 0xff3d1a }); break;
      case 'hiela': fx.spray(top, 0xbfeaff, 16, 3, 0.9, 0.2, { c2: 0xffffff }); fx.ring(P, up, 0xbfeaff, 2, 0.5); break;
      case 'rompe': fx.shatter(top, 0xbfeaff, { size: 0.4, n: 10, speed: 9 }); break;
      case 'marchita': fx.spray(top, 0x8a8a9a, 8, 1.4, 1.2, 0.3, { smoke: true, grow: 0.4 }); break;
      case 'brota': case 'rebrota': case 'florece': fx.spray(top, c, 10, 2.4, 0.8, 0.16, { up: 2.5 }); break;
      case 'rara': fx.ring(P, up, 0xffe27a, 6, 1.4, { op: 0.9 }); fx.spray(top, 0xffe27a, 36, 6, 1.6, 0.25, { up: 5, c2: 0xffffff }); break;
      case 'nube': fx.ring(P, up, c, e.r || 4, 0.6, { op: 0.6 }); break;
      default: break;
    }
    void me; void state;
  }
  chipOff() { if (this.chip && this.key) { this.key = ''; this.chip.classList.remove('on', 'aviso'); } }
  /** Cartel mínimo: la planta interactiva a mano (qué es, qué hace, cuánto falta) y los efectos de plantas sobre el Huésped. */
  hud(fl, me) {
    if (!me || !this.layout.length) return;
    let best = null, bd = 1e9;
    for (let i = 0; i < Math.min(fl.s.length, this.layout.length); i++) {
      const st = fl.s[i][0], L = this.layout[i]; if (st === ST.AUSENTE || st === ST.BROTE || L[0] < 0) continue;
      const E = especieDe(L[0]), d = Math.hypot(me.pos[0] - L[1], me.pos[1] - L[2], me.pos[2] - L[3]); if (E && d < Math.max(E.r, E.p.rt || 0) + 1.2 && d < bd) { bd = d; best = { i, E, st: fl.s[i], d }; }
    }
    this.usarOk = !!best && best.st[0] === ST.MADURA && best.d < 3;
    const fx = (fl.b || []).find((b) => b[0] === me.id), fxTxt = fx ? FLAG_ES.filter(([f]) => fx[1] & f).map(([, t]) => t).join(' · ') : '';
    const key = best ? `${best.i}:${best.st[0]}:${best.st[2] & 3}:${fxTxt}` : fxTxt ? 'fx' + fxTxt : '';
    if (!this.chip) return;
    if (key !== this.key || (best && best.st[0] === ST.ARMANDO)) {
      const c = this.chip; this.key = key;
      if (!best && !fxTxt) { c.classList.remove('on', 'aviso'); return; }
      if (best) {
        const { E, st } = best, estado = st[0] === ST.ARMANDO ? '¡Actuando! Alejate' : st[0] === ST.MADURA ? (st[2] & 1 ? 'Congelada' : st[2] & 2 ? 'Ardiendo' : 'Madura') : 'Marchita (rebrota sola)';
        c.style.setProperty('--fc', CODIGO[E.col]); c.querySelector('.n i').textContent = ICONO[E.fn]; c.querySelector('.n span').textContent = E.nombre;
        c.querySelector('.f').textContent = `${FN[E.fn]} · ${estado}. ${st[0] === ST.MADURA ? VERBO[E.fn] : ''}`;
        c.querySelector('.b').style.display = st[0] === ST.ARMANDO ? '' : 'none'; c.querySelector('.b i').style.transform = `scaleX(${Math.max(0.04, st[3] / 100)})`;
      } else { c.style.setProperty('--fc', '#c8ff2a'); c.querySelector('.n i').textContent = '❀'; c.querySelector('.n span').textContent = 'Efecto de planta'; c.querySelector('.f').textContent = ''; c.querySelector('.b').style.display = 'none'; }
      c.querySelector('.e').textContent = fxTxt ? `Sobre vos: ${fxTxt}` : '';
      c.classList.add('on'); c.classList.toggle('aviso', !!best && best.st[0] === ST.ARMANDO);
    } else if (best && this.chip.classList.contains('aviso')) this.chip.querySelector('.b i').style.transform = `scaleX(${Math.max(0.04, best.st[3] / 100)})`;
  }
}
