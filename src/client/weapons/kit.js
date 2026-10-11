// Kit de armas: geometría fusionada por capas (cuerpo anodizado, guante, cristal), materiales
// iridiscentes, pantalla de munición. Todo el código visible está en español.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { OUT } from '../shaders.js';

/** Presupuesto gráfico según el nivel ('low' | 'medium' | 'high'). */
export function qualityOf(name = 'high') {
  const n = name === 'low' || name === 'medium' ? name : 'high';
  return {
    name: n, low: n === 'low', high: n === 'high',
    rbSeg: n === 'high' ? 2 : n === 'medium' ? 1 : 0, // 0 = caja simple
    seg: n === 'high' ? 14 : n === 'medium' ? 10 : 7, torSeg: n === 'high' ? 28 : n === 'medium' ? 20 : 12,
    loops: n === 'low' ? 1 : n === 'medium' ? 2 : 3, detail: n !== 'low',
  };
}

const _geoCache = new Map();
const cached = (key, make) => { let g = _geoCache.get(key); if (!g) { g = make(); _geoCache.set(key, g); } return g; };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _Y = new THREE.Vector3(0, 1, 0), _Z = new THREE.Vector3(0, 0, 1);

export const tint = (hex, m) => new THREE.Color(hex).multiplyScalar(m).getHex();

/**
 * Constructor de piezas. Cada pieza (`part`) tiene tres capas:
 *  'b' = cuerpo metálico anodizado · 'g' = guante / tela · 'l' = luz (cristal, líquido, bobinas)
 * Las posiciones son [x, y, z] con z negativo hacia la boca. `k` (kind) del cristal:
 *  0 líquido que fluye · 1 núcleo de cristal · 2 luz de estado (munición) · 3 bobina (secuencia)
 */
export class Kit {
  constructor(q) { this.q = q; this.parts = {}; this.cur = null; this.stack = [new THREE.Matrix4()]; this.pivots = {}; }
  part(name, pivot = null) {
    if (!this.parts[name]) this.parts[name] = { b: [], g: [], l: [], pivot: pivot ? new THREE.Vector3(...pivot) : null };
    this.cur = this.parts[name]; this.stack = [new THREE.Matrix4()];
    if (pivot) this.stack[0].makeTranslation(-pivot[0], -pivot[1], -pivot[2]);
    return this;
  }
  push(m) { this.stack.push(this.stack[this.stack.length - 1].clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  /** Coloca (traslada/rota) todo lo que se construya dentro de fn. */
  at(pos, rot, fn) { const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), _s); this.push(m); fn(); this.pop(); return this; }

  put(L, geo, pos = [0, 0, 0], o = {}) {
    if (o.q) _q.copy(o.q); else if (o.r) _q.setFromEuler(_e.set(o.r[0], o.r[1], o.r[2])); else _q.identity();
    _p.set(pos[0], pos[1], pos[2]); if (o.s) _s.set(o.s[0], o.s[1], o.s[2]); else _s.set(1, 1, 1);
    _m.compose(_p, _q, _s); _s.set(1, 1, 1);
    const mm = this.stack[this.stack.length - 1].clone().multiply(_m);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1');
    g.applyMatrix4(mm);
    const n = g.attributes.position.count, col = new THREE.Color(o.c ?? 0xffffff), ca = new Float32Array(n * 3), ka = new Float32Array(n).fill(o.k || 0);
    for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.setAttribute('kind', new THREE.BufferAttribute(ka, 1));
    this.cur[L].push(g); return this;
  }

  box(L, [w, h, d], pos, o = {}) {
    const q = this.q, rad = Math.min(o.rad ?? 0.006, Math.min(w, h, d) * 0.45);
    const geo = q.rbSeg && !o.sharp ? cached(`rb${w},${h},${d},${rad},${q.rbSeg}`, () => new RoundedBoxGeometry(w, h, d, q.rbSeg, rad)) : cached(`bx${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
    return this.put(L, geo, pos, o);
  }
  /** Cilindro/cono [radioFrente, radioAtrás, largo] sobre un eje ('z' por defecto). */
  cyl(L, [rt, rb, len], pos, o = {}) {
    const seg = o.seg || this.q.seg, ax = o.axis || 'z';
    const geo = cached(`cy${rt},${rb},${len},${seg},${ax},${o.open ? 1 : 0}`, () => {
      const g = new THREE.CylinderGeometry(rt, rb, len, seg, 1, !!o.open); // +Y = radio rt
      if (ax === 'z') g.rotateX(-Math.PI / 2); else if (ax === 'x') g.rotateZ(-Math.PI / 2); // 'z': rt hacia -Z (boca)
      return g;
    });
    return this.put(L, geo, pos, o);
  }
  sph(L, r, pos, o = {}) { const sg = Math.max(5, Math.round(this.q.seg * 0.75)); return this.put(L, cached(`sp${r},${sg}`, () => new THREE.SphereGeometry(r, sg, Math.max(4, sg >> 1))), pos, o); }
  poly(L, kind, r, pos, o = {}) { // 'oct' | 'ico' | 'tet' (cristales)
    const mk = { oct: () => new THREE.OctahedronGeometry(r, 0), ico: () => new THREE.IcosahedronGeometry(r, 0), tet: () => new THREE.TetrahedronGeometry(r, 0) }[kind];
    return this.put(L, cached(`po${kind}${r}`, mk), pos, o);
  }
  /** Anillo [radio, grosor]; mira hacia Z por defecto. */
  tor(L, [R, r], pos, o = {}) { const ts = o.seg || this.q.torSeg; return this.put(L, cached(`to${R},${r},${ts}`, () => new THREE.TorusGeometry(R, r, this.q.low ? 4 : 6, ts)), pos, o); }
  /** Perfil lateral extruido: pts = [[u,v],...] (u hacia adelante, v hacia arriba), ancho w centrado en x. */
  prof(L, pts, w, x = 0, o = {}) {
    const bt = o.bevel ?? 0.0035, depth = Math.max(0.002, w - 2 * bt);
    const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
    for (const h of o.holes || []) shape.holes.push(new THREE.Path(h.map(([u, v]) => new THREE.Vector2(u, v))));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: !this.q.low || bt > 0.002, bevelSize: bt * 0.8, bevelThickness: bt, bevelSegments: 1, steps: 1, curveSegments: 6 });
    g.translate(0, 0, -depth / 2); g.rotateY(Math.PI / 2); // u -> -Z, extrusión -> X
    return this.put(L, g, [x, 0, 0], o);
  }
  /** Miembro cónico entre dos puntos (dedos, antebrazo, tubos). */
  limb(L, a, b, r0, r1 = r0, o = {}) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    if (len < 1e-5) return this;
    const seg = o.seg || Math.max(5, this.q.seg - 3);
    const geo = cached(`li${r0},${r1},${len.toFixed(4)},${seg}`, () => new THREE.CylinderGeometry(r1, r0, len, seg, 1)); // +Y = r1 (b)
    const qq = new THREE.Quaternion().setFromUnitVectors(_Y, d.normalize());
    this.put(L, geo, A.clone().add(B).multiplyScalar(0.5).toArray(), { ...o, q: qq });
    if (o.ball) { this.sph(L, r0, a, o); this.sph(L, r1, b, o); }
    return this;
  }
  /** Cadena de miembros por un arco (en XY, eje Z) — dedos que envuelven un tubo. */
  arc(L, cx, cy, rad, a0, a1, z, r, n, o = {}) {
    const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, z]); }
    for (let i = 0; i < n; i++) this.limb(L, pts[i], pts[i + 1], r * (1 - 0.08 * (i / n)), r * (1 - 0.08 * ((i + 1) / n)), { ...o, ball: true });
    return pts;
  }

  /** Fusiona una pieza y devuelve un Group con ≤3 mallas (una por capa no vacía). */
  build(name, mats) {
    const p = this.parts[name], grp = new THREE.Group(); if (!p) return grp;
    for (const [L, mat] of [['b', mats.body], ['g', mats.glove], ['l', mats.glow]]) {
      if (!p[L].length) continue;
      const merged = mergeGeometries(p[L], false); p[L].forEach((g) => g.dispose()); p[L] = [];
      const m = new THREE.Mesh(merged, mat); m.frustumCulled = false; m.name = `${name}.${L}`; grp.add(m);
    }
    if (p.pivot) grp.position.copy(p.pivot);
    return grp;
  }
}

/* ───────────────────────── materiales ───────────────────────── */

const NOISE = `
  float hsh(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hsh(i),hsh(i+vec3(1,0,0)),f.x), mix(hsh(i+vec3(0,1,0)),hsh(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(hsh(i+vec3(0,0,1)),hsh(i+vec3(1,0,1)),f.x), mix(hsh(i+vec3(0,1,1)),hsh(i+vec3(1,1,1)),f.x), f.y), f.z); }
  vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }`;

/** Cristal/energía: líquido que fluye, núcleo con refracción fingida, luz de estado y bobinas en secuencia. */
function glowMaterial(hex, q) {
  const mat = new THREE.ShaderMaterial({
    defines: { LOOPS: q.loops },
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(hex) }, uHeat: { value: 0 }, uSeq: { value: -9 }, uAmmo: { value: 1 }, uBoost: { value: 0 }, uHue: { value: 0 } },
    vertexShader: `
      attribute vec3 color; attribute float kind;
      varying vec3 vView, vPos, vCol, vObjDir; varying float vKind;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz; vPos = position; vCol = color; vKind = kind;
        vec3 camObj = (inverse(modelViewMatrix) * vec4(0.0, 0.0, 0.0, 1.0)).xyz; vObjDir = position - camObj; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `
      uniform float uTime, uHeat, uSeq, uAmmo, uBoost, uHue; uniform vec3 uColor;
      varying vec3 vView, vPos, vCol, vObjDir; varying float vKind; ${NOISE}
      void main(){
        vec3 n = normalize(cross(dFdx(vView), dFdy(vView))); vec3 v = normalize(-vView); if (dot(n, v) < 0.0) n = -n;
        float ndv = clamp(dot(n, v), 0.0, 1.0), fres = pow(1.0 - ndv, 2.2);
        vec3 d = normalize(vObjDir); vec3 col; float k = vKind;
        if (k < 0.5) {            // líquido / energía que fluye
          float f = 0.0;
          for (int i = 0; i < LOOPS; i++) { vec3 p = vPos * vec3(55.0, 55.0, 22.0) * (1.0 + float(i) * 0.7) + d * (0.35 * float(i + 1)) + vec3(0.0, 0.0, -uTime * (2.2 + uHeat * 5.0)); f += vn(p) * (0.6 - 0.15 * float(i)); }
          float band = 0.5 + 0.5 * sin(vPos.z * 70.0 - uTime * (7.0 + uHeat * 10.0) + f * 5.0);
          vec3 base = mix(uColor * 0.55, pal(f * 0.8 + uTime * 0.08 + vPos.z * 2.0 + uHue), 0.42);
          col = base * (0.5 + 1.0 * band * f) + uColor * 0.5 * fres;
        } else if (k < 1.5) {     // núcleo de cristal con profundidad fingida
          float c = 0.0;
          for (int i = 0; i < LOOPS; i++) { vec3 p = vPos * (34.0 + 15.0 * float(i)) + d * (0.5 + 0.45 * float(i)) + uTime * vec3(0.2, 0.3, -0.5); c += abs(vn(p) - 0.5) * (1.3 - 0.3 * float(i)); }
          float caustic = pow(clamp(1.0 - c * 1.5, 0.0, 1.0), 3.0);
          col = mix(uColor * 0.7, pal(c * 1.4 + fres * 0.8 + uTime * 0.1 + uHue), 0.45) * (0.8 + ndv * 0.9) + vec3(1.0) * caustic * 0.85 + uColor * fres * 1.3;
        } else if (k < 2.5) {     // luz de estado
          vec3 lc = mix(vec3(1.0, 0.22, 0.32), uColor, smoothstep(0.1, 0.35, uAmmo));
          float pulse = uAmmo < 0.2 ? 0.6 + 0.4 * sin(uTime * 14.0) : 1.0; col = lc * 1.5 * pulse + fres * 0.4;
        } else {                  // bobina: se enciende cuando pasa la secuencia
          float s = exp(-pow((vPos.z - uSeq) * 6.5, 2.0));
          col = uColor * (0.32 + 2.6 * s + 1.0 * uBoost) * (0.75 + 0.25 * sin(uTime * 3.0 + vPos.z * 20.0)) + pal(vPos.z * 3.0 + uTime * 0.3 + uHue) * 0.22 * (0.4 + s) + uColor * fres * 0.8;
        }
        col *= vCol * 0.9;
        col *= 1.0 + uHeat * 1.4 + uBoost * 0.8; col += vec3(1.0, 0.85, 0.7) * (uHeat * 0.3 + uBoost * 0.25);
        col = 1.0 - exp(-col * 1.35);
        gl_FragColor = vec4(col, 1.0);
        //LIN
      }`,
  });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('//LIN', OUT.linear ? 'gl_FragColor.rgb = pow(max(gl_FragColor.rgb, vec3(0.0)), vec3(2.2));' : ''); };
  mat.customProgramCacheKey = () => `wglow${q.loops}${OUT.linear ? 'L' : 'S'}`;
  return mat;
}


/** Detalle de superficie sin geometría: juntas de paneles, tonos anodizados distintos, cepillado, desgaste y rayones. */
function surfaceDetail(mat, hex, strength = 1) {
  const acc = new THREE.Color(hex).offsetHSL(0.45, 0.05, 0.02).multiplyScalar(0.9);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uAcc = { value: acc };
    sh.vertexShader = 'varying vec3 vOP; varying vec3 vON;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vOP = position; vON = normal;');
    sh.fragmentShader = `varying vec3 vOP; varying vec3 vON; uniform vec3 uAcc;
      float h3(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float gPanel, gWear;
      ` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 an = abs(vON); float ax = an.x > an.y && an.x > an.z ? 0.0 : (an.y > an.z ? 1.0 : 2.0);
          vec2 q = ax < 0.5 ? vOP.yz : (ax < 1.5 ? vOP.xz : vOP.xy);
          vec2 g = q / 0.075; vec2 id = floor(g); vec2 f = fract(g);
          float hh = h3(vec3(id, ax + 1.0)); float split = step(0.6, hh);
          vec2 g2 = g * 2.0; vec2 f2 = mix(f, fract(g2), split);
          float e = min(min(f2.x, 1.0 - f2.x), min(f2.y, 1.0 - f2.y));
          gPanel = smoothstep(0.0, 0.05, e);
          float tone = 0.72 + 0.55 * h3(vec3(id, ax + 7.0 + split));
          float brushed = 0.94 + 0.06 * sin(q.x * 700.0 + h3(vec3(id, 3.0)) * 6.0);
          float spk = h3(floor(vOP * vec3(420.0)) + ax); gWear = step(0.987, spk);
          vec3 base = diffuseColor.rgb * tone * brushed;
          float accent = step(0.945, hh) * ${(0.8 * strength).toFixed(2)};
          base = mix(base, uAcc, accent);
          base *= mix(0.2, 1.0, gPanel);
          base += gWear * 0.12;
          diffuseColor.rgb = base;
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
          vec3 rc = 0.5 + 0.5 * cos(6.28318 * (fr * 0.7 + vOP.z * 1.3 + vec3(0.0, 0.33, 0.67)));
          totalEmissiveRadiance += mix(uAcc, rc, 0.6) * fr * ${TUNE.rim.toFixed(2)}; }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (1.0 - gPanel) * 0.35 + gWear * 0.2, 0.05, 1.0);`);
  };
  mat.customProgramCacheKey = () => 'wsurf';
}

export const TUNE = { iri: 0.4, thick: [150, 500], rough: 0.34, cc: 0.3, env: 1.3, rim: 0.45 };
/** Los tres materiales de un arma. body: metal anodizado iridiscente; glove: tela técnica; glow: cristal. */
export function makeMats(q, hex) {
  let body, glove;
  if (q.high) {
    body = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 1, roughness: TUNE.rough, clearcoat: TUNE.cc, clearcoatRoughness: 0.07, iridescence: TUNE.iri, iridescenceIOR: 1.9, iridescenceThicknessRange: TUNE.thick, envMapIntensity: TUNE.env });
    glove = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.62, sheen: 0.7, sheenColor: new THREE.Color(hex).multiplyScalar(0.3), sheenRoughness: 0.6, envMapIntensity: 0.45 });
  } else if (q.name === 'medium') {
    body = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 1, roughness: 0.4, iridescence: TUNE.iri, iridescenceIOR: 1.9, iridescenceThicknessRange: TUNE.thick, envMapIntensity: TUNE.env });
    glove = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.7, envMapIntensity: 0.45 });
  } else {
    body = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.38 });
    glove = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.7 });
  }
  surfaceDetail(body, hex);
  const c = new THREE.Color(hex);
  body.emissive = c.clone().multiplyScalar(q.low ? 0.07 : 0.03); glove.emissive = c.clone().multiplyScalar(q.low ? 0.05 : 0.02);
  const glow = glowMaterial(hex, q);
  return {
    body, glove, glow, base: { be: body.emissive.clone() },
    /** Reloj, calor (0..1), secuencia de bobinas (z), munición (0..1) y destello puntual. */
    set(t, heat, seq = -9, ammo = 1, boost = 0) {
      const u = glow.uniforms; u.uTime.value = t; u.uHeat.value = heat; u.uSeq.value = seq; u.uAmmo.value = ammo; u.uBoost.value = boost;
      const k = heat * 0.35 + boost * 0.2; body.emissive.copy(this.base.be); body.emissive.r += c.r * k; body.emissive.g += c.g * k; body.emissive.b += c.b * k;
    },
    dispose() { body.dispose(); glove.dispose(); glow.dispose(); },
  };
}

/* ───────────────────── pantallita de munición ───────────────────── */

export class AmmoScreen {
  constructor(hex, label, size = [0.052, 0.026]) {
    this.canvas = document.createElement('canvas'); this.canvas.width = 160; this.canvas.height = 80;
    this.ctx = this.canvas.getContext('2d'); this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.hex = '#' + new THREE.Color(hex).getHexString(); this.label = label; this.n = Infinity; this.max = Infinity; this.dirty = true; this.blink = 0;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    this.mesh.frustumCulled = false; this.draw(0);
  }
  set(n, max) { if (n !== this.n || max !== this.max) { this.n = n; this.max = max; this.dirty = true; } }
  get frac() { return Number.isFinite(this.n) && Number.isFinite(this.max) && this.max > 0 ? this.n / this.max : 1; }
  update(t) { const low = this.frac < 0.2, b = low ? (Math.sin(t * 12) > 0 ? 1 : 0) : 1; if (this.dirty || (low && b !== this.blink)) { this.blink = b; this.draw(t); } }
  draw(t) {
    const c = this.ctx, W = 160, H = 80, col = this.frac < 0.2 ? '#ff4060' : this.hex; this.dirty = false;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05030c'); g.addColorStop(1, '#120a22'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = col; c.globalAlpha = 0.5; c.lineWidth = 2; c.strokeRect(2, 2, W - 4, H - 4); c.globalAlpha = 1;
    c.fillStyle = col; c.font = 'bold 13px monospace'; c.textAlign = 'left'; c.fillText(this.label, 8, 17);
    const inf = !Number.isFinite(this.n); const txt = inf ? '∞' : String(Math.max(0, Math.floor(this.n)));
    c.font = `bold ${inf ? 52 : 46}px monospace`; c.textAlign = 'right'; c.shadowColor = col; c.shadowBlur = 10;
    if (this.blink || this.frac >= 0.2) c.fillText(txt, W - 10, 58); c.shadowBlur = 0;
    const segs = 14, f = this.frac, on = Math.ceil(f * segs);
    for (let i = 0; i < segs; i++) { c.globalAlpha = i < on ? 1 : 0.18; c.fillStyle = col; c.fillRect(8 + i * 10.4, 66, 7, 8); } c.globalAlpha = 1;
    c.globalAlpha = 0.12; c.fillStyle = '#fff'; for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1); c.globalAlpha = 1;
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}

export const Z_AXIS = _Z;
