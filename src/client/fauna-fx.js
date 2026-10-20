// FAUNA CONSUMIBLE (cliente): dibuja los bichos de `state.fa`, sus rastros en el suelo, las partículas de comer, y el HUD mínimo (docs/FAUNA.md).
// La simulación está en src/sim/fauna.js y los datos en src/sim/fauna-data.js.
// PRESUPUESTO (Baja, medido con renderer.info en tests/fauna-render.test.js): ≤ 12 llamadas de dibujo y ≤ 3 000 triángulos entre todos los bichos visibles:
//   · 1 llamada: TODOS los bichos (un solo InstancedMesh con una geometría de ~120 triángulos: cuerpo, cabeza, alas, patas, cola y antenas; cada especie es otra
//     combinación de proporciones por instancia + dos colores + un ciclo de animación en el shader: aletea, repta, salta, nada o corretea). Autoiluminados.
//   · 1 llamada: los halos (cartulinas aditivas que hacen que se lean de lejos y brillen «flashero»).
//   · 1 llamada: los rastros del suelo (escarcha, fuego, nube tóxica, raíces).
//   · 1 llamada: las partículas al comer / rematar / fasear.
//   LOD: a más de 55 m sólo el halo; a más de 95 m nada. Con «Reducir efectos» (ajuste reducirGravedad) no parpadean ni hay chispas de más.
// HUD (sólo si hace falta; nada fijo): chip con la forma activa y su barra de tiempo (#ffchip, dentro de #hud), cartel «E · Comer…» cuando hay un bicho a mano
// (#ffprompt) y hasta 4 puntitos de color en el borde hacia los bichos cercanos fuera de pantalla (#ffradar).
import * as THREE from 'three';
import { ESPECIES, ESPECIE_IDS, FORMAS, FAUNA, formaPorIndice, especiePorIndice } from '../sim/fauna-data.js';
import { OUT } from './shaders.js';
import { settings } from './settings.js';

const MAXN = 16, BURST_N = 120, ZMAX = 10;
const col3 = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Estados del snapshot → número que usa el shader (0 duerme, 1 pasta, 2 alerta, 3 huye, 4 acecha, 5 cansada). */
export const ESTADO_TXT = ['dormida', 'pastando', 'alerta', 'huyendo', 'acechando', 'cansada'];

/* ───────── geometría del bicho (una sola, ~120 triángulos) ───────── */
// Partes (atributo aPart): 0 cuerpo · 1 cabeza · 2 ala izq. · 3 ala der. · 4 patas · 5 cola · 6 antenas. Marco local: +z adelante, +y arriba, +x izquierda, 1 m de largo.
function buildGeometry() {
  const parts = [];
  const add = (geo, part, idx = 0) => { const g = geo.index ? geo.toNonIndexed() : geo; const n = g.attributes.position.count; g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1)); g.setAttribute('aIdx', new THREE.BufferAttribute(new Float32Array(n).fill(idx), 1)); g.deleteAttribute('uv'); parts.push(g); };
  const body = new THREE.SphereGeometry(0.5, 8, 5); body.scale(0.5, 0.42, 1.0); add(body, 0);
  const head = new THREE.SphereGeometry(0.5, 6, 4); head.scale(0.36, 0.32, 0.42); head.translate(0, 0.04, 0.58); add(head, 1);
  const wing = (s) => { const g = new THREE.BufferGeometry(), v = new Float32Array([0, 0, 0.2, s * 0.9, 0.12, 0.35, s * 0.55, 0.05, -0.05, 0, 0, 0.2, s * 0.55, 0.05, -0.05, 0, 0, -0.25, 0, 0, -0.25, s * 0.55, 0.05, -0.05, s * 0.8, 0.08, -0.45]); g.setAttribute('position', new THREE.BufferAttribute(v, 3)); g.computeVertexNormals(); return g; };
  add(wing(1), 2); add(wing(-1), 3);
  for (let i = 0; i < 6; i++) { const s = i % 2 ? -1 : 1, z = -0.28 + Math.floor(i / 2) * 0.28, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([s * 0.2, -0.05, z, s * 0.34, -0.55, z + 0.1, s * 0.26, -0.05, z + 0.07]), 3)); g.computeVertexNormals(); add(g, 4, i); }
  const tail = new THREE.ConeGeometry(0.18, 1, 5, 1, true); tail.rotateX(-Math.PI / 2); tail.translate(0, 0, -0.95); add(tail, 5);
  for (const s of [1, -1]) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([s * 0.05, 0.1, 0.7, s * 0.28, 0.5, 1.05, s * 0.1, 0.12, 0.72]), 3)); g.computeVertexNormals(); add(g, 6); }
  const n = parts.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), pt = new Float32Array(n), ix = new Float32Array(n);
  let o = 0; for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); pt.set(g.attributes.aPart.array, o); ix.set(g.attributes.aIdx.array, o); o += g.attributes.position.count; g.dispose(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('aPart', new THREE.BufferAttribute(pt, 1)); geo.setAttribute('aIdx', new THREE.BufferAttribute(ix, 1));
  return geo;
}
export const TRIS_BICHO = (() => { try { return buildGeometry().attributes.position.count / 3; } catch { return 0; } })();

const VERT = `
  attribute float aPart, aIdx; attribute vec3 aC1, aC2; attribute vec4 aShape, aMov;
  uniform float uTime; varying vec3 vC1, vC2, vN, vV, vL; varying float vPart, vSt, vSeed;
  void main(){
    vec3 p = position, n = normal;
    float kind = aMov.x, spd = aMov.y, ph = aMov.z, st = aMov.w;
    float asleep = st < 0.5 ? 1.0 : 0.0, run = (st > 2.5 && st < 3.5) || st > 4.5 ? 1.0 : 0.0;
    float t = uTime * spd * (1.0 + 0.9 * run) + ph;
    float wing = aShape.x, leg = aShape.y, tail = aShape.z, len = aShape.w;
    float flier = kind > 0.5 && kind < 1.5 ? 1.0 : 0.0, swimmer = kind > 2.5 && kind < 3.5 ? 1.0 : 0.0;
    if (aPart < 0.5) { p.z *= len; p.x += sin(t * 2.2 + p.z * 5.0) * 0.07 * (1.0 - flier) * (1.0 - asleep) * (0.4 + swimmer * 1.4); p.y *= 1.0 + 0.06 * sin(uTime * 1.7 + ph) * asleep; }
    else if (aPart < 1.5) { p.z += 0.5 * (len - 1.0); p.y += sin(t * 2.0) * 0.03 * (1.0 - asleep) - 0.05 * asleep; }
    else if (aPart < 3.5) {
      float sgn = aPart < 2.5 ? 1.0 : -1.0, a = sin(uTime * (flier > 0.5 ? 26.0 : 5.0) * (0.6 + 0.4 * spd) + ph) * (flier > 0.5 ? 0.95 : 0.12) * (1.0 - 0.92 * asleep) + 0.28 + 0.25 * run * flier;
      float c = cos(a), s = sin(a); p.xz *= wing; vec2 xy = vec2(p.x * c - p.y * s * sgn, p.x * s * sgn + p.y * c); p.xy = xy; p.y += 0.1; p.z *= 0.9 + 0.2 * len; p.z += 0.0;
    }
    else if (aPart < 4.5) { float sw = sin(t * 3.4 + aIdx * 1.9) * 0.16 * leg * (1.0 - asleep) * (kind > 1.5 && kind < 2.5 ? 0.3 : 1.0); p.y *= leg; p.z = p.z * len + sw; p.x *= 1.0 + 0.4 * leg; p.y -= 0.0; if (flier > 0.5) { p.y = p.y * 0.5; p.z += 0.05; } }
    else if (aPart < 5.5) { p.z = (p.z + 0.45) * tail * 1.15 - 0.45 * len; p.x += sin(t * 3.0 + p.z * 4.0) * 0.12 * abs(p.z) * (1.0 - asleep); p.xy *= mix(0.2, 1.0, step(0.01, tail)); }
    else { p.y += sin(t * 2.4 + aIdx) * 0.05; p.z += 0.5 * (len - 1.0); }
    if (flier > 0.5 || swimmer > 0.5) p.y += sin(uTime * 2.2 + ph) * 0.06;
    if (st > 3.5 && st < 4.5) p.y += 0.12 * (p.z > 0.0 ? 1.0 : 0.0);   // acechando: se levanta
    mat4 M = modelMatrix * instanceMatrix;
    vec4 wp = M * vec4(p, 1.0);
    vN = normalize(mat3(M) * n); vV = normalize(cameraPosition - wp.xyz); vL = p; vC1 = aC1; vC2 = aC2; vPart = aPart; vSt = st; vSeed = ph;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const FRAG = `
  uniform float uTime, uLinear; varying vec3 vC1, vC2, vN, vV, vL; varying float vPart, vSt, vSeed;
  void main(){
    vec3 N = normalize(vN), V = normalize(vV); if (!gl_FrontFacing) N = -N;
    float ndv = clamp(dot(N, V), 0.0, 1.0), fr = pow(1.0 - ndv, 2.2);
    float band = 0.5 + 0.5 * sin(vL.z * 9.0 + vL.x * 6.0 + uTime * 1.4 + vSeed * 6.0);
    vec3 col = mix(vC1, vC2, band * 0.6);
    float stripe = smoothstep(0.8, 0.96, sin(vL.z * 24.0 + vSeed * 9.0)); col = mix(col, vC2, stripe * 0.5);
    if (vPart > 1.5 && vPart < 3.5) { float vein = 0.55 + 0.6 * abs(sin(vL.x * 20.0 + vL.z * 9.0 + vSeed)); col = mix(vC2, vec3(1.0), 0.3) * vein; }
    else if (vPart > 3.5 && vPart < 4.5) col = mix(vC1, vec3(0.1), 0.5);
    else if (vPart > 5.5) col = mix(vC2, vec3(1.0), 0.5);
    float pulse = 0.88 + 0.24 * sin(uTime * 3.1 + vSeed * 20.0), dim = vSt < 0.5 ? 0.6 : 1.0;
    float alert = (vSt > 1.5 && vSt < 2.5) ? 0.3 + 0.3 * step(0.0, sin(uTime * 14.0)) : 0.0;
    float lam = 0.5 + 0.5 * dot(N, normalize(vec3(0.3, 1.0, 0.4)));
    vec3 c = col * lam * (0.62 + 0.3 * pulse) * dim + vC2 * fr * 0.55 * dim + vec3(alert);
    if (uLinear > 0.5) c = pow(c, vec3(2.2));
    gl_FragColor = vec4(c, 1.0);
  }`;
const HALO_V = `
  attribute vec3 aCenter, aCol; attribute float aSize, aA, aSeed; uniform float uTime; varying vec3 vCol; varying float vA; varying vec2 vUv;
  void main(){ vUv = uv; vCol = aCol; vA = aA * (0.85 + 0.15 * sin(uTime * 4.0 + aSeed * 30.0)); vec4 mv = viewMatrix * vec4(aCenter, 1.0); mv.xy += position.xy * aSize; gl_Position = projectionMatrix * mv; }`;
const HALO_F = `
  uniform float uLinear; varying vec3 vCol; varying float vA; varying vec2 vUv;
  void main(){ float d = length(vUv - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a *= a; if (a < 0.01) discard; vec3 c = vCol * a * vA; if (uLinear > 0.5) c = pow(c, vec3(2.2)); gl_FragColor = vec4(c, a * vA); }`;
const ZONA_V = `
  attribute vec3 aCol; attribute vec2 aKF; varying vec3 vCol; varying vec2 vKF, vP; void main(){ vCol = aCol; vKF = aKF; vP = position.xy; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`;
const ZONA_F = `
  uniform float uTime, uLinear; varying vec3 vCol; varying vec2 vKF, vP;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main(){
    float r = length(vP), an = atan(vP.y, vP.x), k = vKF.x, fade = vKF.y;
    float base = smoothstep(1.0, 0.55, r) * 0.28;
    float pat = 0.0;
    if (k < 0.5) pat = smoothstep(0.1, 0.0, abs(fract(an * 3.0 / 3.14159) - 0.5)) * smoothstep(1.0, 0.0, r) * 0.9 + smoothstep(0.05, 0.0, abs(r - 0.7)) * 0.7;           // escarcha: estrella y aro
    else if (k < 1.5) pat = h(floor(vP * 6.0) + floor(uTime * 8.0)) * smoothstep(1.0, 0.2, r) * 0.9;                                                                           // fuego: chispeo
    else if (k < 2.5) pat = smoothstep(0.65, 0.7, fract(sin(floor(vP.x * 5.0) * 12.9 + floor(vP.y * 5.0) * 7.0 + floor(uTime * 2.0)) * 43.7)) * smoothstep(1.0, 0.1, r);     // nube tóxica: burbujas
    else pat = (0.5 + 0.5 * sin(an * 7.0 + r * 9.0)) * smoothstep(1.0, 0.3, r) * 0.7;                                                                                          // raíces / vapor
    float a = (base + pat * 0.55) * smoothstep(1.0, 0.85, r) * fade; if (a < 0.01) discard;
    vec3 c = vCol * (0.8 + pat) * a; if (uLinear > 0.5) c = pow(c, vec3(2.2)); gl_FragColor = vec4(c, a);
  }`;
const BURST_V = `
  attribute vec3 aStart, aEnd, aCol; attribute vec2 aT; uniform float uTime; varying vec3 vCol; varying float vA;
  void main(){
    float t = clamp((uTime - aT.x) / aT.y, 0.0, 1.0), e = t * t * (3.0 - 2.0 * t);
    vec3 d = aEnd - aStart, side = normalize(cross(d, vec3(0.3, 1.0, 0.2)) + 1e-4);
    vec3 p = mix(aStart, aEnd, e) + side * sin(t * 3.14159) * (0.4 + fract(aT.x * 7.3)) * 0.9;
    vCol = aCol; vA = (t >= 1.0 || uTime < aT.x) ? 0.0 : (1.0 - 0.4 * t); vec4 mv = viewMatrix * vec4(p, 1.0);
    gl_PointSize = vA < 0.01 ? 0.0 : (1.0 - 0.5 * t) * 22.0 * projectionMatrix[1][1] / max(0.5, -mv.z); gl_Position = projectionMatrix * mv;
  }`;
const BURST_F = `uniform float uLinear; varying vec3 vCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; if (a < 0.02) discard; vec3 c = vCol * 1.6 * a; if (uLinear > 0.5) c = pow(c, vec3(2.2)); gl_FragColor = vec4(c, a); }`;

const CSS = `
#ffchip{position:absolute;left:calc(env(safe-area-inset-left,0px) + 24px);bottom:112px;display:none;min-width:150px;max-width:min(260px,40vw);padding:6px 10px 7px;border-radius:12px;background:rgba(10,8,28,.8);border:1px solid var(--fc,#fff);box-shadow:0 0 14px color-mix(in srgb,var(--fc,#fff) 45%,transparent);color:#fff;font:600 12px/1.25 system-ui,sans-serif;pointer-events:none;text-shadow:0 0 4px #000}
#ffchip.on{display:block}
#ffchip .n{display:flex;gap:6px;align-items:baseline;font-weight:800;letter-spacing:.04em;color:var(--fc,#fff);font-size:13px}
#ffchip .n i{font-style:normal;font-size:15px}#ffchip .n em{margin-left:auto;font-style:normal;font-weight:700;color:#fff;opacity:.85;font-size:12px}
#ffchip .f{opacity:.88;margin-top:2px;font-weight:500}
#ffchip .r{opacity:.7;font-size:10px;margin-top:2px;font-weight:600}
#ffchip .b{height:4px;margin-top:5px;border-radius:2px;background:#ffffff26;overflow:hidden}
#ffchip .b i{display:block;height:100%;width:100%;background:var(--fc,#fff);transform-origin:left}
#ffchip.fin{animation:ffpulse .5s ease-in-out infinite alternate}
@keyframes ffpulse{from{opacity:.55}to{opacity:1}}
body.touch-ui #ffchip{top:calc(env(safe-area-inset-top,0px) + 124px);bottom:auto;left:calc(env(safe-area-inset-left,0px) + 12px);min-width:0;max-width:34vw;font-size:11px}
body.touch-ui #ffchip .f{display:none}
#ffprompt{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 168px);transform:translateX(-50%);display:none;padding:5px 12px;border-radius:999px;background:rgba(10,8,28,.82);border:1px solid var(--pc,#fff);color:#fff;font:700 13px system-ui,sans-serif;text-shadow:0 0 4px #000;pointer-events:none;white-space:nowrap;z-index:3}
#ffprompt.on{display:block}#ffprompt.ya{box-shadow:0 0 16px var(--pc,#fff)}#ffprompt kbd{padding:0 6px;border:1px solid #ffffff99;border-radius:5px;margin-right:4px;font:800 12px system-ui}#ffprompt small{opacity:.75;font-weight:600;margin-left:6px}#ffprompt.pel{border-color:#ff5a6a}
#ffradar{position:fixed;inset:0;pointer-events:none;z-index:2}
#ffradar i{position:absolute;left:0;top:0;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:var(--dc,#fff);box-shadow:0 0 8px var(--dc,#fff);opacity:.8;display:none}
`;

export class FaunaFx {
  constructor(renderer) {
    this.r = renderer; this.root = new THREE.Group(); this.root.name = 'fauna-fx'; renderer.scene.add(this.root);
    this.t = 0; this.cur = new Map(); this.key = ''; this.pkey = ''; this.reduced = false;
    // — bichos
    const geo = buildGeometry(), mk = (k) => new THREE.InstancedBufferAttribute(new Float32Array(MAXN * k), k).setUsage(THREE.DynamicDrawUsage);
    this.at = { c1: mk(3), c2: mk(3), shape: mk(4), mov: mk(4) };
    geo.setAttribute('aC1', this.at.c1); geo.setAttribute('aC2', this.at.c2); geo.setAttribute('aShape', this.at.shape); geo.setAttribute('aMov', this.at.mov);
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTime: { value: 0 }, uLinear: { value: OUT.linear ? 1 : 0 } }, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAXN); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.name = 'fauna-bichos'; this.mesh.renderOrder = 4; this.root.add(this.mesh);
    // — halos
    const hg = new THREE.InstancedBufferGeometry(), pl = new THREE.PlaneGeometry(1, 1); hg.index = pl.index; hg.setAttribute('position', pl.attributes.position); hg.setAttribute('uv', pl.attributes.uv);
    const hm = (k) => new THREE.InstancedBufferAttribute(new Float32Array(MAXN * k), k).setUsage(THREE.DynamicDrawUsage);
    this.ha = { center: hm(3), col: hm(3), size: hm(1), a: hm(1), seed: hm(1) };
    for (const [k, a] of [['aCenter', 'center'], ['aCol', 'col'], ['aSize', 'size'], ['aA', 'a'], ['aSeed', 'seed']]) hg.setAttribute(k, this.ha[a]);
    hg.instanceCount = 0;
    this.hmat = new THREE.ShaderMaterial({ vertexShader: HALO_V, fragmentShader: HALO_F, uniforms: { uTime: this.mat.uniforms.uTime, uLinear: this.mat.uniforms.uLinear }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.halo = new THREE.Mesh(hg, this.hmat); this.halo.frustumCulled = false; this.halo.renderOrder = 5; this.halo.name = 'fauna-halos'; this.root.add(this.halo);
    // — rastros del suelo
    const zg = new THREE.CircleGeometry(1, 28); this.za = { col: new THREE.InstancedBufferAttribute(new Float32Array(ZMAX * 3), 3).setUsage(THREE.DynamicDrawUsage), kf: new THREE.InstancedBufferAttribute(new Float32Array(ZMAX * 2), 2).setUsage(THREE.DynamicDrawUsage) };
    zg.setAttribute('aCol', this.za.col); zg.setAttribute('aKF', this.za.kf);
    this.zmat = new THREE.ShaderMaterial({ vertexShader: ZONA_V, fragmentShader: ZONA_F, uniforms: { uTime: this.mat.uniforms.uTime, uLinear: this.mat.uniforms.uLinear }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.zonas = new THREE.InstancedMesh(zg, this.zmat, ZMAX); this.zonas.count = 0; this.zonas.frustumCulled = false; this.zonas.renderOrder = 3; this.zonas.name = 'fauna-rastros'; this.root.add(this.zonas);
    // — partículas
    const bg = new THREE.BufferGeometry(), B = { start: new Float32Array(BURST_N * 3), end: new Float32Array(BURST_N * 3), col: new Float32Array(BURST_N * 3), t: new Float32Array(BURST_N * 2) };
    for (let i = 0; i < BURST_N; i++) B.t[i * 2] = 1e9;
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(BURST_N * 3), 3)); bg.setAttribute('aStart', new THREE.BufferAttribute(B.start, 3).setUsage(THREE.DynamicDrawUsage)); bg.setAttribute('aEnd', new THREE.BufferAttribute(B.end, 3).setUsage(THREE.DynamicDrawUsage));
    bg.setAttribute('aCol', new THREE.BufferAttribute(B.col, 3).setUsage(THREE.DynamicDrawUsage)); bg.setAttribute('aT', new THREE.BufferAttribute(B.t, 2).setUsage(THREE.DynamicDrawUsage));
    this.B = B; this.bi = 0;
    this.bmat = new THREE.ShaderMaterial({ vertexShader: BURST_V, fragmentShader: BURST_F, uniforms: { uTime: this.mat.uniforms.uTime, uLinear: this.mat.uniforms.uLinear }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.burst = new THREE.Points(bg, this.bmat); this.burst.frustumCulled = false; this.burst.renderOrder = 6; this.burst.name = 'fauna-chispas'; this.root.add(this.burst);
    this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpP = new THREE.Vector3(); this.tmpS = new THREE.Vector3(); this.tmpU = new THREE.Vector3(); this.tmpF = new THREE.Vector3(); this.tmpR = new THREE.Vector3(); this.tmpV = new THREE.Vector3(); this.tmpC = new THREE.Color();
    this.Z = new THREE.Vector3(0, 0, 1); this.cam = new THREE.Vector3();
    this.hud();
  }
  hud() {
    if (typeof document === 'undefined') return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const hud = document.getElementById('hud');
    if (hud) { this.chip = document.createElement('div'); this.chip.id = 'ffchip'; this.chip.setAttribute('aria-live', 'polite'); this.chip.innerHTML = '<div class="n"><i></i><span></span><em></em></div><div class="f"></div><div class="r"></div><div class="b"><i></i></div>'; hud.appendChild(this.chip); }
    this.prompt = document.createElement('div'); this.prompt.id = 'ffprompt'; document.body.appendChild(this.prompt);
    this.radar = document.createElement('div'); this.radar.id = 'ffradar'; for (let i = 0; i < 4; i++) this.radar.appendChild(document.createElement('i')); document.body.appendChild(this.radar);
  }
  configure(q) { this.nivel = q && q.fauna != null ? q.fauna : 1; this.mat.uniforms.uLinear.value = OUT.linear ? 1 : 0; }

  /** Cada cuadro: dibuja los bichos del snapshot. */
  update(dt, state, me) {
    this.t += dt; this.mat.uniforms.uTime.value = this.t; this.reduced = !!settings().reducirGravedad;
    const fa = state && state.fa, rows = fa ? fa.l : [], cam = this.r.camera; cam.getWorldPosition(this.cam);
    // suavizado entre snapshots
    const seen = new Set(), k = 1 - Math.exp(-14 * dt);
    for (const r of rows) {
      const [id, si, x, y, z, ux, uy, uz, fx, fy, fz, st] = r; seen.add(id);
      let c = this.cur.get(id); if (!c) { c = { p: new THREE.Vector3(x, y, z), u: new THREE.Vector3(ux, uy, uz), f: new THREE.Vector3(fx, fy, fz), born: this.t }; this.cur.set(id, c); }
      c.sp = si; c.st = st; c.tp = this.tmpV.set(x, y, z); c.p.lerp(c.tp, Math.min(1, k)); c.u.lerp(this.tmpU.set(ux, uy, uz), k).normalize(); c.f.lerp(this.tmpF.set(fx, fy, fz), k); c.f.addScaledVector(c.u, -c.f.dot(c.u)); if (c.f.lengthSq() < 1e-6) c.f.set(fx, fy, fz); c.f.normalize();
      c.id = id;
    }
    for (const id of [...this.cur.keys()]) if (!seen.has(id)) this.cur.delete(id);
    let n = 0, hn = 0; const A = this.at, H = this.ha, list = [...this.cur.values()];
    for (const c of list) {
      const sp = especiePorIndice(c.sp); if (!sp) continue;
      const d = c.p.distanceTo(this.cam); if (d > 95 || n >= MAXN) continue;
      const a = Math.min(1, (this.t - c.born) * 1.6), tam = sp.tam * a;   // nacen creciendo
      const vuela = sp.vuelo > 0;
      if (d <= 55) {
        this.tmpR.crossVectors(c.u, c.f).normalize();   // x = arriba × adelante
        this.tmpM.makeBasis(this.tmpR, c.u, c.f); this.tmpM.scale(this.tmpS.set(tam * 1.9, tam * 1.9, tam * 1.9)); this.tmpM.setPosition(c.p); this.mesh.setMatrixAt(n, this.tmpM);
        const c1 = col3(sp.c1), c2 = col3(sp.c2), sh = sp.cuerpo; A.c1.array.set(c1, n * 3); A.c2.array.set(c2, n * 3);
        A.shape.array.set([sh[0], sh[1], sh[2], sh[3]], n * 4);
        A.mov.array.set([sp.mov, 0.8 + hash(c.id) * 0.5, hash(c.id * 3.1) * 6.28, c.st], n * 4); n++;
      }
      // halo (siempre, hasta 95 m): más grande y brillante cuando está alerta o es rara
      const cc = col3(sp.c1), ce = col3(sp.c2), hh = hn++ * 3;
      this.tmpP.copy(c.p).addScaledVector(c.u, tam * 0.6);
      H.center.array.set([this.tmpP.x, this.tmpP.y, this.tmpP.z], hh); H.col.array.set([cc[0] * 0.6 + ce[0] * 0.4, cc[1] * 0.6 + ce[1] * 0.4, cc[2] * 0.6 + ce[2] * 0.4], hh);
      H.size.array[hn - 1] = tam * (sp.rara ? 9 : 5.2) * (c.st === 2 ? 1.25 : 1) * (this.reduced ? 0.85 : 1); H.a.array[hn - 1] = (c.st === 0 ? 0.28 : 0.5) * (sp.rara ? 1.5 : 1) * (d > 55 ? 1.2 : 1); H.seed.array[hn - 1] = hash(c.id * 1.7);
      void vuela;
    }
    this.mesh.count = n; for (const a of Object.values(A)) a.needsUpdate = true; this.mesh.instanceMatrix.needsUpdate = true; this.mesh.visible = n > 0;
    this.halo.geometry.instanceCount = hn; for (const a of Object.values(H)) a.needsUpdate = true; this.halo.visible = hn > 0;
    this.suelo(fa ? fa.z : []);
    this.chispas(dt);
    this.avisos(state, me, list);
  }
  suelo(zs) {
    let n = 0;
    for (const z of zs) {
      if (n >= ZMAX) break; const [k, x, y, zz, r, rest, ux, uy, uz] = z;
      this.tmpU.set(ux, uy, uz).normalize(); this.tmpQ.setFromUnitVectors(this.Z, this.tmpU); this.tmpP.set(x + this.tmpU.x * 0.06, y + this.tmpU.y * 0.06, zz + this.tmpU.z * 0.06); this.tmpS.set(r, r, r); this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      this.zonas.setMatrixAt(n, this.tmpM);
      const C = [[0.7, 0.95, 1.0], [1.0, 0.45, 0.1], [0.55, 1.0, 0.2], [0.6, 0.9, 0.3], [1.0, 0.9, 0.8]][k] || [1, 1, 1];
      this.za.col.array.set(C, n * 3); this.za.kf.array.set([k, Math.min(1, rest * 3)], n * 2); n++;
    }
    this.zonas.count = n; this.zonas.instanceMatrix.needsUpdate = true; this.za.col.needsUpdate = true; this.za.kf.needsUpdate = true; this.zonas.visible = n > 0;
  }
  /** Chispas: n partículas de `a` hacia `b` (comer: de la criatura a la boca; remate: del centro hacia afuera). */
  soltar(a, b, hexes, n, dur = 0.55, spread = 0) {
    const B = this.B, nn = this.reduced ? Math.ceil(n / 2) : n;
    for (let i = 0; i < nn; i++) {
      const j = this.bi++ % BURST_N, c = col3(hexes[i % hexes.length]), s = (hash(this.t * 13 + i) - 0.5), u = (hash(this.t * 7 + i * 3) - 0.5);
      B.start.set([a[0] + s * 0.4, a[1] + u * 0.4, a[2] + (hash(i + this.t) - 0.5) * 0.4], j * 3);
      B.end.set(spread ? [a[0] + (hash(this.t + i * 5) - 0.5) * 2 * spread, a[1] + Math.abs(u) * spread * 0.6, a[2] + (hash(this.t * 3 + i * 11) - 0.5) * 2 * spread] : [b[0], b[1], b[2]], j * 3);
      B.col.set(c, j * 3); B.t.set([this.t + i * 0.012, dur * (0.8 + hash(i * 1.3) * 0.5)], j * 2);
    }
    for (const k of ['aStart', 'aEnd', 'aCol', 'aT']) this.burst.geometry.attributes[k].needsUpdate = true;
  }
  chispas() { this.bmat.uniforms.uTime.value = this.t; }
  /** Eventos `fauna` del snapshot: comer (el bicho vuela hacia la boca), remate, fase, hielo… */
  onEvent(e, me, state) {
    if (e.t !== 'fauna') return;
    const ply = state && state.players ? state.players.find((q) => q.id === e.pid) : null, boca = ply ? [ply.pos[0] + ply.up[0] * 1.3, ply.pos[1] + ply.up[1] * 1.3, ply.pos[2] + ply.up[2] * 1.3] : null;
    if (e.ph === 'come' && boca) { const sp = especiePorIndice(e.sp), F = formaPorIndice(e.f); if (sp) this.soltar(e.p, boca, [sp.c1, sp.c2, F ? F.color : sp.c1], 26, 0.5); }
    else if (e.ph === 'remate') { const F = formaPorIndice(e.f); this.soltar(e.p, null, [F ? F.color : '#fff', '#ffffff'], 34, 0.6, e.r || 5); }
    else if (e.ph === 'fase' || e.ph === 'hiela' || e.ph === 'destello') this.soltar(e.p, null, e.ph === 'hiela' ? ['#8be9ff', '#ffffff'] : e.ph === 'fase' ? ['#8a5cff', '#19f0ff'] : ['#fff2a8', '#ffffff'], 12, 0.45, 1.6);
    else if (e.ph === 'muerde') this.soltar(e.p, null, ['#ff5a6a', '#ffffff'], 8, 0.35, 0.9);
    else if (e.ph === 'hibrido' && boca) this.soltar(boca, null, ['#ff7ae6', '#7affff', '#fff2a8'], 40, 0.9, 2.2);
  }
  /** Chip de la forma, cartel de comer y puntitos del borde. */
  avisos(state, me, list) {
    if (!this.chip) return;
    const F = me ? formaPorIndice(me.mf) : null, R = me ? formaPorIndice(me.mr) : null, on = !!F && !me.dead;
    const key = on ? `${me.mf}|${me.mr || 0}` : ''; if (key !== this.key) {
      this.key = key; const c = this.chip; c.classList.toggle('on', on);
      if (on) { c.style.setProperty('--fc', F.color); c.querySelector('.n i').textContent = F.icono; c.querySelector('.n span').textContent = F.nombre; c.querySelector('.f').textContent = F.desc.split('. ')[0] + '.'; c.querySelector('.r').textContent = R ? `Residuo: ${R.icono} ${R.nombre}` : ''; }
    }
    if (on) { const left = Math.max(0, me.mt || 0), tot = Math.max(1, me.md || 60); this.chip.querySelector('.n em').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`; this.chip.querySelector('.b i').style.transform = `scaleX(${Math.max(0.02, Math.min(1, left / tot))})`; this.chip.classList.toggle('fin', left < 8); }
    // cartel «comer» (el bicho más cercano a mano)
    let best = null, bd = 99; if (me && !me.dead && !(state && state.ended)) for (const c of list) { const d = Math.hypot(c.p.x - me.pos[0], c.p.y - me.pos[1], c.p.z - me.pos[2]); if (d < bd) { bd = d; best = c; } }
    const sp = best && bd < 5.5 ? especiePorIndice(best.sp) : null, touch = document.body.classList.contains('touch-ui');
    const pk = sp ? `${sp.id}|${bd < FAUNA.alcance ? 1 : 0}|${touch ? 1 : 0}` : '';
    if (pk !== this.pkey) {
      this.pkey = pk; const p = this.prompt; p.classList.toggle('on', !!sp);
      if (sp) { const Fm = FORMAS[sp.forma]; p.style.setProperty('--pc', sp.c1); p.classList.toggle('ya', bd < FAUNA.alcance); p.classList.toggle('pel', !!sp.peligrosa); p.innerHTML = bd < FAUNA.alcance ? `<kbd>${touch ? 'USAR' : 'E'}</kbd>Comer: ${sp.nombre}<small>${Fm.icono} ${Fm.nombre}${sp.peligrosa ? ' · ⚠ muerde' : ''}</small>` : `${sp.nombre}<small>${bd < 5.5 ? 'acercate' : ''}${sp.peligrosa ? ' · ⚠ muerde' : ''}</small>`; }
    }
    // puntitos hacia los bichos que no se ven (sutil: ≤ 4, sólo cercanos)
    const dots = this.radar.children, cam = this.r.camera; let k = 0;
    if (me && !me.dead && cam && list.length && !(state && state.ended)) {
      const W = innerWidth, H = innerHeight, v = this.tmpV;
      const cand = list.map((c) => ({ c, d: Math.hypot(c.p.x - me.pos[0], c.p.y - me.pos[1], c.p.z - me.pos[2]) })).filter((q) => q.d < 42 && q.d > 6).sort((a, b) => a.d - b.d);
      for (const { c, d } of cand) {
        if (k >= 4) break; const sp2 = especiePorIndice(c.sp); if (!sp2) continue;
        v.copy(c.p).project(cam); const behind = v.z > 1, onS = !behind && Math.abs(v.x) < 0.9 && Math.abs(v.y) < 0.86; if (onS) continue;
        let x = v.x, y = v.y; if (behind) { x = -x; y = -y; }
        const ang = Math.atan2(y, x), s = Math.min(0.9 / Math.abs(Math.cos(ang) || 1e-6), 0.8 / Math.abs(Math.sin(ang) || 1e-6)), px = (Math.cos(ang) * s * 0.5 + 0.5) * W, py = (-Math.sin(ang) * s * 0.5 + 0.5) * H;
        const el = dots[k++]; el.style.display = 'block'; el.style.setProperty('--dc', sp2.c1); el.style.transform = `translate(${px}px, ${py}px) scale(${d < 18 ? 1.25 : 0.9})`; el.style.opacity = String(d < 18 ? 0.9 : 0.55);
      }
    }
    for (; k < dots.length; k++) dots[k].style.display = 'none';
  }
  dispose() {
    this.root.removeFromParent(); this.mesh.geometry.dispose(); this.mat.dispose(); this.halo.geometry.dispose(); this.hmat.dispose(); this.zonas.geometry.dispose(); this.zmat.dispose(); this.burst.geometry.dispose(); this.bmat.dispose();
    for (const el of [this.chip, this.prompt, this.radar]) if (el) el.remove();
  }
}
void ESPECIES; void ESPECIE_IDS;
