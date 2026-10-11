// OJO ORBITAL — los ojos chicos que giran alrededor de Argos (punto débil). Radio del modelo = 1 (se escala por fuera: r 1.7).
// Globo pintado por shader (esclerótica con venas, iris psicodélico con fibras que giran, pupila que sigue al jugador), párpados de
// carne que parpadean, un mini nervio colgando, corona de 6 espinas de cristal y un AURA ámbar→roja que late (se nota que es débil).
// Barato: geometrías y materiales de carne COMPARTIDOS; sólo el globo y el aura son propios de cada ojo (para que cada uno pulse distinto).
// Este archivo también exporta el material del globo (`eyeballMaterial`) que reutiliza argos.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { uTime } from '../shaders.js';
import { cfg } from '../quality.js';

const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp, damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const Z = new THREE.Vector3(0, 0, 1);

/* ───────── caché de geometrías compartidas ───────── */
const GEO = new Map();
export const shared = (k, f) => { let g = GEO.get(k); if (!g) { g = f(); GEO.set(k, g); } return g; };
export const isLow = () => cfg().humans === 'low';

let DOT = null;
/** Textura circular suave (halo / aura / carga). */
export function softDot() {
  if (DOT || typeof document === 'undefined') return DOT;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (DOT = new THREE.CanvasTexture(c));
}

/* ───────── shader del globo ocular ───────── */
const VERT = `
varying vec3 vObj; varying vec3 vN; varying vec3 vV;
void main(){ vObj = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const FRAG = `
varying vec3 vObj; varying vec3 vN; varying vec3 vV;
uniform float uTime,uHurt,uPup,uHot,uIrisAng,uVein,uDim,uVuln,uSeed,uPhase,uFib;
uniform vec3 uCol;
float h31(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z); }
void main(){
  vec3 d = normalize(vObj); float ang = acos(clamp(d.z, -1.0, 1.0)); float r = ang / uIrisAng;
  float phi = atan(d.y, d.x);
  // ── esclerótica con venas ──
  vec3 scl = mix(vec3(0.95, 0.88, 0.84), vec3(0.93, 0.74, 0.72), smoothstep(0.3, 1.6, ang) * 0.6);
  scl *= 0.9 + 0.16 * vn(d * 3.0 + uSeed);
  float v1 = abs(vn(d * 5.5 + uSeed) - 0.5), v2 = abs(vn(d * 12.0 + uSeed * 2.0) - 0.5), v3 = abs(vn(d * 24.0 + 7.0) - 0.5);
  float side = smoothstep(0.45, 1.5, ang);
  float vein = max(1.0 - smoothstep(0.0, 0.05, v1), max((1.0 - smoothstep(0.0, 0.035, v2)) * 0.9, (1.0 - smoothstep(0.0, 0.028, v3)) * 0.7)) * (0.25 + 0.75 * side) * uVein;
  vec3 veinC = mix(vec3(0.55, 0.05, 0.12), vec3(1.0, 0.55, 0.08), uVuln);
  scl = mix(scl, veinC, clamp(vein, 0.0, 1.0) * 0.92);
  scl += vec3(1.0, 0.5, 0.1) * uVuln * vein * 0.6;
  scl *= 1.0 - 0.5 * smoothstep(0.7, 1.0, abs(d.y));              // sombra de los párpados
  // ── iris psicodélico ──
  vec3 col = scl;
  if (r < 1.02) {
    float sw = phi + r * 1.6 * sin(uTime * 0.23 + uSeed) + uTime * (0.07 + uHot * 0.5);          // las fibras giran lento (y rápido al cargar)
    float fib = vn(vec3(cos(sw) * 8.0, sin(sw) * 8.0, r * 2.2 + uTime * 0.05));
    float str = 0.5 + 0.5 * sin(sw * (uFib) + fib * 6.0 + r * 3.0);
    float rip = 0.5 + 0.5 * sin(r * 26.0 - uTime * (1.4 + uHot * 5.0));                       // ondas que se contraen hacia la pupila
    vec3 pal = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + r * 0.8 + fib * 0.45 + uTime * 0.04 + uPhase * 0.12));
    vec3 ir = mix(pal, uCol * 1.25, 0.42);
    ir *= 0.55 + 0.7 * str; ir *= 0.82 + 0.3 * rip;
    ir += uCol * 0.55 * smoothstep(0.08, 0.0, abs(r - 0.5));                                   // collarete
    ir *= mix(0.45, 1.0, smoothstep(1.0, 0.8, r));                                              // anillo límbico oscuro
    ir = mix(ir, vec3(1.0, 0.2, 0.08) * (0.7 + 0.6 * str), uHot * 0.75);
    ir += vec3(1.0, 0.75, 0.55) * uHot * smoothstep(0.9, 0.05, r) * (0.5 + 0.5 * rip);
    // pupila
    float pr = uPup * 0.55; float pm = 1.0 - smoothstep(pr * 0.86, pr, r);
    vec3 pc = mix(vec3(0.01, 0.0, 0.03), vec3(0.9, 0.3, 0.2), uHot * smoothstep(pr * 0.5, 0.0, r) * 0.9);
    ir = mix(ir, pc, pm);
    col = mix(scl, ir, 1.0 - smoothstep(0.96, 1.02, r));
  }
  // ── luz falsa + brillo húmedo (reflejo de ventana) ──
  vec3 n = normalize(vN); vec3 L = normalize(vec3(-0.45, 0.7, 0.6));
  float diff = 0.5 + 0.5 * max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), normalize(vV)), 0.0), 70.0) * 1.3 + pow(max(dot(reflect(-normalize(vec3(0.6, -0.2, 0.7)), n), normalize(vV)), 0.0), 40.0) * 0.35;
  float fres = pow(1.0 - clamp(dot(n, normalize(vV)), 0.0, 1.0), 3.0);
  col *= diff; col += vec3(spec) * (1.0 - uHot * 0.4) + vec3(0.35, 0.5, 1.0) * fres * 0.35;
  col = mix(col, vec3(dot(col, vec3(0.33))) * vec3(0.7, 0.6, 0.65), uDim);                       // apagado (aturdido)
  col += uHurt * vec3(0.9, 0.8, 0.7) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;
/**
 * Material del globo ocular. Uniformes vivos (m.uniforms): uPup (0.1–1 tamaño de pupila), uHot (0–1 carga roja), uVein (venas),
 * uDim (0–1 apagado), uVuln (0–1 venas ámbar), uHurt, uPhase, uIrisAng (radio angular del iris). Se registra uHurt en userData.u
 * para que setHurt() y render.js lo encuentren.
 */
export function eyeballMaterial({ color = 0xffb020, irisAng = 0.6, fib = 22 } = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG,
    uniforms: { uTime, uHurt: { value: 0 }, uPup: { value: 0.42 }, uHot: { value: 0 }, uIrisAng: { value: irisAng }, uVein: { value: 0.8 }, uDim: { value: 0 }, uVuln: { value: 0 }, uSeed: { value: Math.random() * 30 }, uPhase: { value: 0 }, uFib: { value: fib }, uCol: { value: new THREE.Color(color) } },
  });
  m.userData.u = m.uniforms;
  return m;
}
export const ballGeo = (lo) => shared('ball' + lo, () => new THREE.SphereGeometry(1, lo ? 20 : 36, lo ? 14 : 26));

/* ───────── partes compartidas del ojo orbital ───────── */
const lidGeo = (lo) => shared('olid' + lo, () => new THREE.SphereGeometry(1, lo ? 14 : 22, lo ? 5 : 8, 0, Math.PI * 2, 0, Math.PI / 2));
const spikeGeo = () => shared('ospike', () => {
  const parts = [], up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, c = new THREE.ConeGeometry(0.1, 0.55 + (i % 2) * 0.2, 5, 1); c.translate(0, 0.3, 0);
    const d = new THREE.Vector3(Math.cos(a), Math.sin(a), -0.35).normalize(), q = new THREE.Quaternion().setFromUnitVectors(up, d);
    c.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * 1.02, Math.sin(a) * 1.02, -0.18), q, new THREE.Vector3(1, 1, 1)));
    parts.push(c.toNonIndexed());
  }
  return mergeGeometries(parts, false);
});
let SKIN = null, SPIKEM = null, NERVE = null;
function sharedMats(kit) {
  if (!SKIN || SKIN.__q !== cfg().humans) {
    SKIN = kit.fleshMaterial({ color: 0xa8485c, vein: 0x4a0a1c, spot: 0xff6a50, glow: 0.0, wobble: 0.01, breath: 0.02, spots: 0.3, veins: 1.0, rough: 0.35, sheen: 0.4, scale: 3 }); SKIN.__q = cfg().humans;
    SPIKEM = kit.bioCrystalMaterial(0xff6a30, { glow: 0.9 });
    NERVE = kit.fleshMaterial({ color: 0x6a2a4a, vein: 0x1a0414, spot: 0xff6a50, glow: 0.0, wobble: 0.015, breath: 0.03, spots: 0.3, veins: 0.9, rough: 0.4, sheen: 0.3, scale: 3 });
  }
  return { SKIN, SPIKEM, NERVE };
}

/** Ojo orbital. opts: { color (iris), quality ('low'|…; por defecto cfg().humans) }. Devuelve { root, tick(dt, {hp, maxhp, look, t}), dispose() }. */
export function buildOjo(kit, opts = {}) {
  const lo = (opts.quality || cfg().humans) === 'low';
  const { SKIN: skin, SPIKEM: spk, NERVE: nerveM } = sharedMats(kit);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const ballM = eyeballMaterial({ color: opts.color ?? 0xffb020, irisAng: 0.62, fib: 18 }); ballM.uniforms.uVein.value = 0.9;
  const ball = new THREE.Mesh(ballGeo(lo), ballM); body.add(ball);
  // párpados que parpadean (hemisferios de carne)
  const up = new THREE.Mesh(lidGeo(lo), skin), dn = new THREE.Mesh(lidGeo(lo), skin); up.scale.setScalar(1.07); dn.scale.set(1.07, -1.07, 1.07); body.add(up, dn);
  // espinas de cristal alrededor (corona chica) y mini nervio
  const crown = new THREE.Mesh(spikeGeo(), spk); body.add(crown);
  const tent = kit.tentacle(nerveM, { len: 1.5, r0: 0.17, r1: 0.025, hang: true, amp: 0.3, speed: 1.8, freq: 2.6, phase: Math.random() * 6 }); const pv = new THREE.Group(); pv.position.set(0, -0.3, -0.85); pv.rotation.x = 0.35; pv.add(tent); body.add(pv);
  // aura de punto débil: sprite ámbar/rojo que late
  const auraM = new THREE.SpriteMaterial({ map: softDot(), color: 0xffa020, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const aura = new THREE.Sprite(auraM); aura.scale.setScalar(3.4); root.add(aura);
  // anillo de mira (indica «golpeame»): torus fino aditivo
  const ringM = new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const ring = new THREE.Mesh(shared('oring' + lo, () => new THREE.TorusGeometry(1, 0.02, 4, lo ? 28 : 48)), ringM); ring.scale.setScalar(1.45); root.add(ring);

  const ph0 = Math.random() * 6.28; let blinkT = 1 + Math.random() * 3, blink = 0, op = 1, hpPrev = 1, hit = 0, pupS = 0.45; const tq = new THREE.Quaternion(), d = new THREE.Vector3();
  const cA = new THREE.Color(0xffb020), cB = new THREE.Color(0xff2a18), cc = new THREE.Color();
  return {
    root,
    tick(dt, { hp = 1, maxhp = 1, look = Z, t = 0 } = {}) {
      dt = clamp(dt, 0, 0.05); const f = clamp(hp / Math.max(1, maxhp), 0, 1), u = ballM.uniforms;
      if (f < hpPrev - 0.001) hit = 1; hpPrev = f; hit = Math.max(0, hit - dt * 5);
      // pupila sigue (el globo gira hacia el jugador, con tope para que la pupila no desaparezca por detrás)
      d.copy(look).normalize(); if (d.z < 0.2) { d.z = 0.2; d.normalize(); }
      tq.setFromUnitVectors(Z, d); ball.quaternion.slerp(tq, 1 - Math.exp(-6 * dt));
      // parpadeo
      blinkT -= dt; if (blinkT <= 0) { blink = 1; blinkT = 1.5 + Math.random() * 3.5; } blink = Math.max(0, blink - dt * 6);
      const bl = Math.sin(Math.min(1, blink) * Math.PI); op = damp(op, 1 - hit * 0.5, 10, dt); const o = clamp(op * (1 - bl), 0, 1);
      up.rotation.x = lerp(1.5, -0.95, o); dn.rotation.x = lerp(-1.5, 0.8, o);
      pupS = damp(pupS, 0.4 + 0.07 * Math.sin(t * 1.7 + ph0) + (1 - f) * 0.1 - hit * 0.15, 8, dt); u.uPup.value = pupS;
      // pulso: más rápido y más rojo cuanto menos vida
      const pulse = 0.5 + 0.5 * Math.sin(t * (3 + (1 - f) * 5) + ph0);
      cc.copy(cA).lerp(cB, 1 - f); auraM.color.copy(cc); auraM.opacity = 0.32 + 0.3 * pulse + hit * 0.3; aura.scale.setScalar(3.2 + pulse * 0.5 + hit * 0.4);
      ringM.color.copy(cc); ringM.opacity = 0.25 + 0.35 * pulse; ring.scale.setScalar(1.4 + pulse * 0.06); ring.rotation.z = t * 0.6 + ph0;
      u.uVuln.value = 0.35 + 0.45 * pulse; u.uHurt.value = hit * 0.6; u.uPhase.value = 1 - f; u.uVein.value = 0.9 + (1 - f) * 0.4;
      u.uHot.value = 0.05 * pulse + hit * 0.4;
      crown.rotation.z = t * 0.35 + ph0;
      body.position.y = Math.sin(t * 1.1 + ph0) * 0.06; body.rotation.z = Math.sin(t * 0.7 + ph0) * 0.05;
      const sh = hit * 0.06; body.position.x = (Math.random() - 0.5) * sh; body.scale.setScalar(1 + hit * 0.08);
    },
    dispose() { ballM.dispose(); auraM.dispose(); ringM.dispose(); tent.userData.mat && tent.userData.mat.dispose(); },
  };
}
export default buildOjo;
