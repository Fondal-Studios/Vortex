// PRESENCIA del Huésped: lo que se ve de lejos y NO es la armadura. Tres capas baratas (casi todo es shader, pocas llamadas de dibujo) que se suman al cuerpo:
//   1. AURA por camino de evolución: partículas con movimiento y color propios (brasas del Depredador, chispas orbitando de la Coraza, rayas de la Velocidad,
//      runas de la Resonancia, esporas de la Simbiosis, chispas de la Artillería, plumas de la Apoteosis, esquirlas de la Anomalía) + sello en el suelo con un anillo
//      por nivel + pilar de luz en la forma final.
//   2. MARCA DE MAESTRÍA (src/sim/maestria.js): rombos de luz sobre la cabeza (uno por rango sobre el 1), color bronce/plata/oro/prisma; desde el rango 3 estela al correr,
//      5 aura, 7 sello de oro con muescas, 9 pilar de leyenda.
//   3. TRANSFORMACIÓN (≈ 1,2 s) al subir de nivel: 0,25 s de carga (el cuerpo se esconde en una esfera de energía), destello + onda de choque + columna + chispas, y el cuerpo
//      vuelve con rebote elástico y un resplandor extra que se apaga (`pop` y `boost` los lee huesped-cuerpo.js).
//   const pr = createPresence(T, { glow, quality, camera }); object.add(pr.object); pr.set({ evo, path, rank, scale });
//   cada cuadro: pr.update(dt, t, { speed, moveDir:{x,z}, viewH });   pr.burst(colorHex);   pr.pop (escala) · pr.boost (resplandor) · pr.hide (cuerpo oculto durante la carga)
import * as T from 'three';
import { TIER_MARCA, MARCA_COLOR, cosmeticosActivos } from '../sim/maestria.js';
import { claridad } from './quality.js';

/** Color y comportamiento de cada camino (kind = índice en el shader de partículas). */
export const PATH_STYLE = {
  depredador: { color: 0xff4a1c, kind: 0, n: 20 }, coraza: { color: 0xffa62a, kind: 1, n: 16 }, velocidad: { color: 0x3de8ff, kind: 2, n: 22 }, resonancia: { color: 0x7aa8ff, kind: 3, n: 14 },
  simbiosis: { color: 0xff4a78, kind: 4, n: 16 }, artilleria: { color: 0x9aff4a, kind: 5, n: 16 }, apoteosis: { color: 0xfff2b0, kind: 6, n: 18 }, anomalia: { color: 0x9a4aff, kind: 7, n: 16 },
};
export const pathColor = (id, fallback = 0xffffff) => (PATH_STYLE[id] ? PATH_STYLE[id].color : fallback);

const PX = `float px(float size, vec4 mv){ return clamp(size * projectionMatrix[1][1] * uH * 0.5 / max(0.3, -mv.z), 2.0, 56.0); }`;
const PART_VS = `attribute float aS, aK; attribute vec3 aC; uniform float uT, uH, uSc, uK, uSp; uniform vec2 uMv; varying vec3 vC; varying float vA; ${PX}
void main(){
  float s = aS, a = s * 40.0, al = 1.0, size = 0.07, h = 0.0; vec3 p = vec3(0.0); int k = int(aK + 0.5);
  if (k == 0) { h = fract(s * 5.3 + uT * 0.6); float r = 0.3 + 0.35 * fract(s * 9.7); a += sin(uT * 3.0 + s * 20.0) * 0.6; p = vec3(cos(a) * r, h * 2.3, sin(a) * r); al = sin(h * 3.1416); size = 0.075 * (1.0 - h * 0.5); }
  else if (k == 1) { float aa = a + uT * 0.9, r = 0.74 + 0.1 * sin(s * 30.0 + uT * 2.0); p = vec3(cos(aa) * r, 0.5 + 0.9 * fract(s * 3.7) + 0.08 * sin(uT * 2.0 + s * 20.0), sin(aa) * r); al = 0.6 + 0.4 * sin(uT * 4.0 + s * 50.0); size = 0.065; }
  else if (k == 2) { h = fract(s * 3.3 + uT * 1.3); vec3 b = vec3((fract(s * 11.3) - 0.5) * 0.7, 0.15 + fract(s * 5.7) * 1.55, -0.12); p = b - vec3(uMv.x, 0.0, uMv.y) * h * 3.4 + vec3(0.0, 0.0, -h * 0.6); al = (1.0 - h) * (0.3 + 0.7 * uSp); size = 0.055 * (1.0 + uSp * 1.6); }
  else if (k == 3) { float aa = a + uT * 1.4; p = vec3(cos(aa) * 0.98, 1.25 + 0.38 * sin(aa * 2.0 + uT), sin(aa) * 0.98); al = 0.7 + 0.3 * sin(uT * 6.0 + s * 30.0); size = 0.095; }
  else if (k == 4) { h = fract(s * 5.3 + uT * 0.2); float r = 0.35 + 0.4 * fract(s * 9.7); p = vec3(cos(a + uT * 0.3) * r + 0.1 * sin(uT * 1.3 + s * 40.0), 0.2 + h * 2.0, sin(a + uT * 0.3) * r); al = sin(h * 3.1416); size = 0.12 * (0.6 + 0.8 * fract(s * 13.1)); }
  else if (k == 5) { h = fract(s * 6.7 + uT * 0.95); float sd = fract(s * 3.0) < 0.5 ? -1.0 : 1.0; p = vec3(sd * 0.34 + 0.08 * sin(s * 50.0), 1.55 + h * 1.5, 0.3 + 0.1 * cos(s * 50.0)); al = 1.0 - h; size = 0.06; }
  else if (k == 6) { h = fract(s * 4.1 + uT * 0.24); float aa = a + uT * 0.7 + h * 6.0, r = 0.5 + 0.6 * h; p = vec3(cos(aa) * r, 0.1 + h * 2.9, sin(aa) * r); al = sin(h * 3.1416); size = 0.11; }
  else if (k == 7) { h = fract(s * 5.1 + uT * 0.3); float aa = a - uT * 0.8 - h * 3.0, r = 0.95 * (1.0 - h) + 0.2; p = vec3(cos(aa) * r, 0.2 + (1.0 - h) * 2.1, sin(aa) * r); al = sin(h * 3.1416); size = 0.085; }
  else if (k == 8) { h = fract(s * 5.3 + uT * 0.28); float r = 0.45 + 0.3 * fract(s * 9.7); p = vec3(cos(a + uT) * r, h * 2.5, sin(a + uT) * r); al = sin(h * 3.1416); size = 0.055; }
  else { h = fract(s * 3.1 + uT * 1.7); p = vec3(0.16 * sin(s * 40.0), 0.9 + 0.5 * sin(s * 77.0), 0.0) - vec3(uMv.x, 0.0, uMv.y) * h * 3.4 + vec3(0.0, 0.0, -0.2 * h); al = (1.0 - h) * min(1.0, uSp * 1.6); size = 0.075; }
  vC = aC; vA = max(al, 0.0) * uK; vec4 mv = modelViewMatrix * vec4(p * uSc, 1.0); gl_PointSize = vA < 0.02 ? 0.0 : px(size * uSc, mv); gl_Position = projectionMatrix * mv;
}`;
const PART_FS = `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC * 1.7, smoothstep(0.5, 0.05, d) * vA); }`;

const GROUND_FS = `uniform float uT, uEvo, uRank, uK; uniform vec3 uC0, uC1, uCm; varying vec2 vP;
void main(){
  float r = length(vP), an = atan(vP.y, vP.x), a = (0.06 + 0.08 * uEvo) * smoothstep(1.7, 0.0, r) * step(0.5, uEvo); vec3 c = mix(uC0, uC1, 0.5);
  for (int i = 0; i < 4; i++) { if (float(i) < uEvo) { float rr = 0.5 + 0.28 * float(i); a += 0.7 * smoothstep(0.022, 0.0, abs(r - rr)) * (0.65 + 0.35 * sin(uT * 2.2 + float(i) * 1.7)); } }
  if (uEvo >= 2.0) { float t = abs(fract((an + uT * 0.45) / 6.2832 * 14.0) - 0.5); a += 0.55 * smoothstep(0.12, 0.0, t) * smoothstep(0.1, 0.0, abs(r - 1.32)); }
  if (uEvo >= 3.0) { float t = abs(fract((an - uT * 0.3) / 6.2832 * 6.0) - 0.5); a += 0.6 * smoothstep(0.07, 0.0, t) * smoothstep(0.35, 0.0, abs(r - 1.0)) * step(0.5, r - 0.6); }
  if (uRank >= 7.0) { float n = uRank - 1.0, t = abs(fract((an + uT * 0.12) / 6.2832 * n) - 0.5); float ring = smoothstep(0.03, 0.0, abs(r - 1.62)) * 0.6 + smoothstep(0.1, 0.0, t) * smoothstep(0.09, 0.0, abs(r - 1.72)) * 1.4; a += ring; c = mix(c, uCm, clamp(ring, 0.0, 1.0)); }
  if (a < 0.005) discard; gl_FragColor = vec4(c * 1.6, clamp(a, 0.0, 1.0) * uK);
}`;
const PILLAR_VS = `varying vec2 vU; varying vec3 vN, vV; void main(){ vU = vec2(atan(position.z, position.x), position.y); vN = normalMatrix * normal; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
const PILLAR_FS = `uniform float uT, uK, uH; uniform vec3 uC; varying vec2 vU; varying vec3 vN, vV; void main(){ float y = clamp(vU.y / uH, 0.0, 1.0), f = abs(dot(normalize(vN), normalize(vV))); float a = pow(1.0 - y, 1.4) * (0.35 + 0.3 * sin(vU.x * 5.0 + uT * 2.0 + y * 6.0)) * smoothstep(0.0, 0.5, f) * smoothstep(0.0, 0.06, y); gl_FragColor = vec4(uC * 1.5, a * uK); }`;

const add = { transparent: true, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false };
const SIZE_BY_Q = { low: 1, medium: 1.5, high: 2 };

/** Textura de resplandor suave (radial) compartida por los halos de CLARIDAD. */
let HALO_TEX = null;
function haloTex() {
  if (HALO_TEX || typeof document === 'undefined') return HALO_TEX;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(0.7, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  HALO_TEX = new T.CanvasTexture(c); HALO_TEX.colorSpace = T.SRGBColorSpace; return HALO_TEX;
}
const POOL_FS = `uniform vec3 uC; uniform float uA; varying vec2 vP; void main(){ float r = length(vP) / 2.0, a = smoothstep(1.0, 0.15, r) * (0.55 + 0.45 * smoothstep(0.1, 0.55, r)); gl_FragColor = vec4(uC * 1.5, a * uA); }`; // anillo suave: el cuerpo oscuro se recorta contra el charco

export function createPresence(_T, { glow = 0x4ab4ff, quality = 'low', camera = null } = {}) {
  const object = new T.Group(); object.name = 'presencia'; object.frustumCulled = false;
  const uni = { uT: { value: 0 }, uH: { value: 700 }, uSc: { value: 1 }, uK: { value: 1 }, uSp: { value: 0 }, uMv: { value: new T.Vector2() } };
  let pts = null, ground = null, pillar = null, mark = null, markMat = null, cur = { evo: 0, path: [], rank: 1, scale: 1 }, built = '', sp = 0, mv = new T.Vector2(), time = 0, bursts = [];
  // CLARIDAD: charco de luz bajo los pies + resplandor detrás de la silueta (2 llamadas, sin importar el nivel). El cuerpo oscuro siempre se lee contra algo más claro.
  const poolU = { uC: { value: new T.Color(glow) }, uA: { value: 0.5 } };
  const pool = new T.Mesh(new T.CircleGeometry(2, 28).rotateX(-Math.PI / 2), new T.ShaderMaterial({ ...add, uniforms: poolU, vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: POOL_FS }));
  pool.position.y = 0.05; pool.frustumCulled = false; pool.renderOrder = -2; pool.name = 'presencia-charco'; object.add(pool);
  const halo = new T.Sprite(new T.SpriteMaterial({ map: haloTex(), color: glow, ...add })); halo.renderOrder = -1; halo.name = 'presencia-halo'; halo.frustumCulled = false; object.add(halo);
  const _w = new T.Vector3(), _c = new T.Vector3();
  const own = []; // geometrías y materiales a liberar al reconstruir
  const kill = (o) => { if (!o) return; object.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.material) x.material.dispose(); }); };
  const api = { object, pop: 1, boost: 1, hide: false, burstT: -1, get active() { return this.burstT >= 0; } };

  function buildParticles(evo, path, rank) {
    kill(pts); pts = null; const list = [], cos = cosmeticosActivos(rank), q = SIZE_BY_Q[quality] || 1;
    path.slice(0, evo).forEach((id) => { const st = PATH_STYLE[id]; if (st) for (let i = 0; i < Math.round(st.n * q); i++) list.push([st.kind, st.color]); });
    if (cos.includes('aura')) for (let i = 0; i < Math.round(14 * q); i++) list.push([8, glow]);
    if (cos.includes('estela')) for (let i = 0; i < Math.round(16 * q); i++) list.push([9, glow]);
    if (!list.length) return;
    const g = new T.BufferGeometry(), n = list.length, S = new Float32Array(n), K = new Float32Array(n), C = new Float32Array(n * 3), c = new T.Color();
    list.forEach(([k, col], i) => { S[i] = (i + 0.5) / n; K[i] = k; c.set(col); C.set([c.r, c.g, c.b], i * 3); });
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aS', new T.BufferAttribute(S, 1)); g.setAttribute('aK', new T.BufferAttribute(K, 1)); g.setAttribute('aC', new T.BufferAttribute(C, 3));
    pts = new T.Points(g, new T.ShaderMaterial({ ...add, uniforms: uni, vertexShader: PART_VS, fragmentShader: PART_FS })); pts.frustumCulled = false; pts.name = 'presencia-aura'; object.add(pts);
  }
  function buildGround(evo, path, rank) {
    kill(ground); kill(pillar); ground = pillar = null; const cos = cosmeticosActivos(rank);
    if (evo < 1 && !cos.includes('sello')) return;
    const last = path[evo - 1], c1 = pathColor(last, glow), tier = TIER_MARCA(rank), cm = tier ? MARCA_COLOR[tier] : glow;
    const g = new T.CircleGeometry(2, 32); g.rotateX(-Math.PI / 2);
    const u = { uT: uni.uT, uK: { value: 1 }, uEvo: { value: evo }, uRank: { value: cos.includes('sello') ? rank : 0 }, uC0: { value: new T.Color(glow) }, uC1: { value: new T.Color(c1) }, uCm: { value: new T.Color(cm) } };
    ground = new T.Mesh(g, new T.ShaderMaterial({ ...add, side: T.DoubleSide, uniforms: u, vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: GROUND_FS }));
    ground.position.y = 0.04; ground.frustumCulled = false; ground.name = 'presencia-suelo'; ground.userData.u = u; object.add(ground);
    if (evo >= 4 || cos.includes('pilar')) { // pilar de luz: forma final y/o rango 9
      const H = 5, col = cos.includes('pilar') ? new T.Color(0xffffff).lerp(new T.Color(cm), 0.4) : new T.Color(c1), cg = new T.CylinderGeometry(0.5, 0.8, H, 14, 1, true); cg.translate(0, H / 2, 0);
      pillar = new T.Mesh(cg, new T.ShaderMaterial({ ...add, side: T.DoubleSide, uniforms: { uT: uni.uT, uK: { value: 0.55 }, uH: { value: H }, uC: { value: col } }, vertexShader: PILLAR_VS, fragmentShader: PILLAR_FS }));
      pillar.frustumCulled = false; pillar.name = 'presencia-pilar'; object.add(pillar);
    }
  }
  function buildMark(rank, scale) {
    kill(mark); mark = null; markMat = null; if (rank < 2) return;
    const n = rank - 1, tier = TIER_MARCA(rank), geos = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, d = new T.OctahedronGeometry(0.06, 0); d.scale(0.8, 1.7, 0.8); d.translate(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34); geos.push(d); }
    const g = mergeSimple(geos); markMat = new T.MeshBasicMaterial({ color: MARCA_COLOR[tier], ...add, opacity: 0.95 });
    mark = new T.Group(); const m = new T.Mesh(g, markMat); m.frustumCulled = false; mark.add(m); mark.userData.m = m; mark.position.y = 2.02 * scale + 0.16; mark.name = 'presencia-marca'; object.add(mark);
  }
  /** Fusiona geometrías simples sin índice (octaedros) en una sola. */
  function mergeSimple(gs) {
    const arr = gs.map((x) => x.toNonIndexed()), n = arr.reduce((a, x) => a + x.attributes.position.count, 0), pos = new Float32Array(n * 3); let o = 0;
    for (const x of arr) { pos.set(x.attributes.position.array, o); o += x.attributes.position.array.length; x.dispose(); } gs.forEach((x) => x.dispose());
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); return g;
  }

  /** Reconstruye con el estado del Huésped. evo 0..4 · path = ids de camino por nivel · rank = maestría 1..10 · scale = escala del cuerpo. */
  api.set = ({ evo = 0, path = [], rank = 1, scale = 1 } = {}) => {
    const key = `${evo}|${path.join()}|${rank}|${scale.toFixed(2)}`; if (key === built) return; built = key; cur = { evo, path, rank, scale };
    uni.uSc.value = scale; buildParticles(evo, path, rank); buildGround(evo, path, rank); buildMark(rank, scale);
    if (ground) ground.scale.setScalar(scale); if (pillar) pillar.scale.set(scale, scale, scale);
  };

  /** TRANSFORMACIÓN: carga 0,25 s + destello, onda, columna y chispas hasta 1,2 s. */
  api.burst = (colorHex = glow) => {
    api.burstT = 0; api.hide = true; kill(api._b); const b = new T.Group(), col = new T.Color(colorHex), sc = cur.scale, white = new T.Color(0xffffff);
    const mk = (geo, color, op) => { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color, ...add, opacity: op, side: T.DoubleSide })); m.frustumCulled = false; b.add(m); return m; };
    const orb = mk(new T.SphereGeometry(1, 14, 10), white.clone().lerp(col, 0.4), 0.0); orb.position.y = 1.0 * sc;
    const ring1 = mk(new T.RingGeometry(0.92, 1, 56), col, 0), ring2 = mk(new T.RingGeometry(0.94, 1, 56), white.clone().lerp(col, 0.5), 0);
    for (const r of [ring1, ring2]) { r.rotation.x = -Math.PI / 2; r.position.y = 0.06; }
    const colM = mk(new T.CylinderGeometry(0.7, 0.7, 7, 20, 1, true), white.clone().lerp(col, 0.55), 0); colM.position.y = 3.5;
    const n = quality === 'low' ? 54 : 100, gg = new T.BufferGeometry(), dir = new Float32Array(n * 3), S = new Float32Array(n); for (let i = 0; i < n; i++) { const a = i * 2.399, y = ((i * 0.618) % 1) * 2 - 0.55, r = Math.sqrt(Math.max(0, 1 - y * y)); dir.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); S[i] = ((i * 0.7548) % 1); }
    gg.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); gg.setAttribute('aD', new T.BufferAttribute(dir, 3)); gg.setAttribute('aS', new T.BufferAttribute(S, 1));
    const bu = { uB: { value: 0 }, uH: uni.uH, uSc: { value: sc }, uC: { value: col.clone().lerp(white, 0.35) } };
    const sparks = new T.Points(gg, new T.ShaderMaterial({ ...add, uniforms: bu, vertexShader: `attribute vec3 aD; attribute float aS; uniform float uB, uH, uSc; varying float vA; ${PX}
      void main(){ float t = uB, ch = clamp(t / 0.25, 0.0, 1.0), rel = max(0.0, t - 0.25); vec3 p = vec3(0.0, 1.0, 0.0) * uSc; float R = (1.0 - ch) * 2.4 + 0.15;
        if (t < 0.25) p += aD * R * uSc * (0.8 + aS * 0.6); else p += aD * (0.15 + rel * (2.2 + aS * 3.2)) * uSc + vec3(0.0, -rel * rel * 0.8 * aS, 0.0);
        vA = t < 0.25 ? ch : max(0.0, 1.0 - rel / 0.95); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = vA < 0.02 ? 0.0 : px(0.12 * uSc * (0.6 + aS), mv); gl_Position = projectionMatrix * mv; }`, fragmentShader: `uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uC * 1.8, smoothstep(0.5, 0.05, d) * vA); }` })); sparks.frustumCulled = false; b.add(sparks);
    b.userData = { orb, ring1, ring2, colM, sparks, bu }; api._b = b; object.add(b);
  };
  function stepBurst(dt) {
    const t = (api.burstT += dt), b = api._b; if (!b) { api.burstT = -1; api.hide = false; api.pop = 1; api.boost = 1; return; }
    const { orb, ring1, ring2, colM, bu } = b.userData, sc = cur.scale, ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    bu.uB.value = t; const rel = t - 0.25;
    if (t < 0.25) { const u = t / 0.25; orb.visible = true; orb.material.opacity = 0.5 + 0.5 * u; orb.scale.setScalar((0.28 + 0.22 * u + 0.03 * Math.sin(t * 90)) * sc); api.hide = true; api.pop = 1; api.boost = 1 + 2 * u; }
    else {
      api.hide = false; const u = Math.min(1, rel / 0.85), el = 1 - Math.exp(-5.5 * u) * Math.cos(10 * u);
      api.pop = 0.78 + 0.22 * el; api.boost = 1 + 2.4 * Math.max(0, 1 - rel / 0.95);
      orb.material.opacity = Math.max(0, 1 - rel / 0.3); orb.scale.setScalar((0.5 + 3.0 * ease(rel / 0.3)) * sc);
      ring1.scale.setScalar((0.4 + 4.6 * ease(rel / 0.8)) * sc); ring1.material.opacity = Math.max(0, 1 - rel / 0.85);
      const r2 = rel - 0.12; ring2.scale.setScalar((0.3 + 3.6 * ease(r2 / 0.8)) * sc); ring2.material.opacity = r2 < 0 ? 0 : Math.max(0, 0.8 - r2 / 0.8);
      colM.scale.set(sc * (1 + rel * 0.5), 1, sc * (1 + rel * 0.5)); colM.material.opacity = Math.max(0, 0.75 * (1 - rel / 0.9)) * (rel < 0.06 ? rel / 0.06 : 1);
    }
    if (t >= 1.25) { kill(b); api._b = null; api.burstT = -1; api.hide = false; api.pop = 1; api.boost = 1; }
  }
  api.update = (dt, t, ctx = {}) => {
    time = t; uni.uT.value = t; if (ctx.viewH) uni.uH.value = ctx.viewH; else if (typeof innerHeight === 'number') uni.uH.value = innerHeight * Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1));
    const target = Math.min(1, (ctx.speed || 0) / 8), md = ctx.moveDir || { x: 0, z: 1 }; sp += (target - sp) * Math.min(1, 6 * dt); mv.set(md.x || 0, md.z || 0).multiplyScalar(sp); uni.uMv.value.copy(mv); uni.uSp.value = sp;
    if (api.burstT >= 0) stepBurst(dt);
    if (mark) { mark.userData.m.rotation.y = t * (0.8 + cur.rank * 0.08); mark.position.y = 2.02 * cur.scale + 0.16 + 0.03 * Math.sin(t * 2.1); if (TIER_MARCA(cur.rank) === 'prisma') markMat.color.setHSL((t * 0.25) % 1, 0.9, 0.65); markMat.opacity = 0.8 + 0.2 * Math.sin(t * 3); }
    if (ground) ground.userData.u.uK.value = 0.85 + 0.15 * Math.sin(t * 1.7);
    uni.uK.value = api.hide ? 0 : 1; void time;
    const cl = claridad(), sc = cur.scale, vis = api.hide ? 0 : 1;
    pool.scale.setScalar(sc * 1.25); poolU.uA.value = cl.pool * vis; halo.material.opacity = cl.halo * vis; halo.scale.setScalar(3.1 * sc);
    if (camera) { object.getWorldPosition(_w); _c.copy(camera.position).sub(_w); const l = _c.length() || 1; _c.multiplyScalar(-0.75 * sc / l); halo.position.copy(object.worldToLocal(_w.clone().add(_c).addScaledVector(new T.Vector3(0, 1, 0).transformDirection(object.matrixWorld), 1.05 * sc))); } else halo.position.set(0, 1.0 * sc, 0);
  };
  api.dispose = () => { kill(pool); halo.material.dispose(); object.remove(halo); kill(pts); kill(ground); kill(pillar); kill(mark); kill(api._b); object.removeFromParent(); void own; void bursts; };
  return api;
}
