// MATERIALES y PARTÍCULAS de los Huéspedes («lo mejor logrado del juego»): almas y bestias en pena del limbo.
//   const M = hostMats(THREE, { color, rim, vein, rough, metal, ns, veinK, rimK, quality });   // → { body, glow, mem, setRegion(r), tick(t) }
//   · body: cuerpo con GRANO procedural (hueso, corteza, sombra), borde de luz tipo subsuperficie (fresnel) y VENAS que laten con el mundo (uBeat).
//   · glow: lo que brilla (ojos, brasas, filos, núcleos): sin sombreado, no se quema en el post-proceso.
//   · mem : velo/membrana/espectro: translúcido, más opaco en el borde y con jirones que fluyen.
//   const fx = hostParticles(THREE, 'brasas', { color, n });  // 1 llamada de dibujo: partículas propias que suben alrededor del cuerpo
// Baja usa los mismos shaders con menos octavas de ruido (sin MeshPhysical). Todo se comparte con las mutaciones (huespedes-evo.js).
import { uTime, uBeat } from './shaders.js';

const NOISE = `
  float hh(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hh(i),hh(i+vec3(1,0,0)),f.x), mix(hh(i+vec3(0,1,0)),hh(i+vec3(1,1,0)),f.x), f.y),
               mix(mix(hh(i+vec3(0,0,1)),hh(i+vec3(1,0,1)),f.x), mix(hh(i+vec3(0,1,1)),hh(i+vec3(1,1,1)),f.x), f.y), f.z); }
  float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * vn3(p); p = p * 2.03 + 7.1; a *= 0.5; } return s / (1.0 - pow(0.5, float(OCT))); }`;

export function hostMats(T, o = {}) {
  const low = o.quality === 'low', oct = low ? 2 : 3, C = (h) => new T.Color(h);
  const U = {
    uAccent: { value: C(o.rim == null ? o.color : o.rim) }, uVein: { value: C(o.vein == null ? o.color : o.vein) }, uRegion: { value: C(0xffffff) }, uRegionK: { value: 0 },
    uRim: { value: o.rimK == null ? 0.7 : o.rimK }, uNs: { value: o.ns || 4 }, uVeinK: { value: o.veinK == null ? 0.8 : o.veinK }, uEvo: { value: 0 }, uBeat, uTime,
  };
  const hook = (key, frag) => (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n#define OCT ${oct}\nvarying vec3 vOP; uniform vec3 uAccent, uVein, uRegion; uniform float uRim, uNs, uVeinK, uBeat, uTime, uRegionK, uEvo;\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${frag.color}`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${frag.emit}`);
    void key;
  };
  const body = new T.MeshStandardMaterial({ vertexColors: true, metalness: o.metal == null ? 0.2 : o.metal, roughness: o.rough == null ? 0.55 : o.rough, envMapIntensity: 1.0, flatShading: false, side: T.DoubleSide });
  body.onBeforeCompile = hook('body', {
    color: `{ float gn = fbm3(vOP * uNs); float gr = vn3(vOP * uNs * 6.0); diffuseColor.rgb *= 0.62 + 0.75 * gn; diffuseColor.rgb *= 0.9 + 0.2 * gr; }`,
    emit: `{ vec3 Nn = normalize(normal); float ndv = clamp(dot(Nn, normalize(vViewPosition)), 0.0, 1.0); float fr = pow(1.0 - ndv, 3.6);
      float v = 1.0 - abs(2.0 * vn3(vOP * uNs * 1.6 + 3.0) - 1.0), v2 = 1.0 - abs(2.0 * vn3(vOP * uNs * 3.1 + 9.0) - 1.0); float vein = smoothstep(0.915, 0.99, v) + 0.5 * smoothstep(0.945, 0.995, v2);
      vec3 rc = mix(uAccent, uRegion, uRegionK); totalEmissiveRadiance += rc * fr * uRim * 0.55 * (1.0 + 0.5 * uEvo) + uVein * vein * uVeinK * (0.3 + 0.95 * uBeat) * (1.0 + 0.4 * uEvo); }`,
  });
  body.customProgramCacheKey = () => 'hbody' + oct;
  const mem = new T.MeshStandardMaterial({ vertexColors: true, metalness: 0, roughness: 0.4, transparent: true, side: T.DoubleSide, depthWrite: false, envMapIntensity: 1.0 });
  mem.onBeforeCompile = hook('mem', {
    color: `{ float flow = fbm3(vOP * uNs * 0.8 + vec3(0.0, -uTime * 0.35, uTime * 0.1)); diffuseColor.rgb *= 0.5 + 0.9 * flow; diffuseColor.a *= 0.35 + 0.85 * smoothstep(0.25, 0.8, flow); }`,
    emit: `{ vec3 Nn = normalize(normal) * (gl_FrontFacing ? 1.0 : -1.0); float ndv = clamp(abs(dot(Nn, normalize(vViewPosition))), 0.0, 1.0); float fr = pow(1.0 - ndv, 2.4);
      vec3 rc = mix(uAccent, uRegion, uRegionK); totalEmissiveRadiance += rc * (0.06 + 0.9 * fr) * (0.8 + 0.4 * uBeat); diffuseColor.a = clamp(diffuseColor.a * (0.12 + 1.0 * fr + 0.12), 0.0, 0.8); }`,
  });
  mem.customProgramCacheKey = () => 'hmem' + oct;
  const glow = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), glowBase = new T.Color(1, 1, 1), tint = new T.Color();
  const api = { body, glow, mem, U,
    /** Región (mapa): tiñe el borde de luz del cuerpo, los brillos y la membrana con el color del folclore del lugar. */
    setRegion(hex, k = 0.55) { if (hex == null) { U.uRegionK.value = 0; glowBase.set(0xffffff); return; } U.uRegion.value.set(hex); U.uRegionK.value = k; glowBase.set(0xffffff).lerp(tint.set(hex), 0.22); },
    /** Cada cuadro: brillo que late con el mundo + la evolución (0–4). */
    tick(t, evo = 0, open = 0) { U.uEvo.value = evo * 0.25; const b = uBeat.value; glow.color.copy(glowBase).multiplyScalar(0.85 + 0.2 * Math.sin(t * 2.4) + 0.25 * b + open * 0.3 + evo * 0.07); },
    dispose() { body.dispose(); glow.dispose(); mem.dispose(); },
  };
  return api;
}

/* ───────── partículas propias de cada Huésped ───────── */
const KINDS = { // rise = velocidad con que suben, rad = radio de la columna, size = tamaño, spin = giro, flick = titileo
  brasas: { rise: 0.5, rad: 0.55, size: 5, spin: 0.5, flick: 7, grav: 1 },       // Axioma: chispas de brasa que suben
  fosforo: { rise: 0.18, rad: 0.9, size: 4, spin: 1.2, flick: 3, grav: 0 },      // Vesper: motas fosforescentes que merodean
  esporas: { rise: 0.22, rad: 1.0, size: 5.5, spin: 0.25, flick: 2, grav: 1 },   // Micelio: esporas que flotan
  espejos: { rise: 0.1, rad: 1.1, size: 4.5, spin: 1.6, flick: 9, grav: 0 },     // Umbra: destellos de espejo
  luz: { rise: 0.45, rad: 0.7, size: 4.5, spin: 0.7, flick: 4, grav: 1 },        // Seraf: polvo dorado que asciende
};
export function hostParticles(T, kind, { color = 0xffffff, n = 48 } = {}) {
  const K = KINDS[kind] || KINDS.luz, g = new T.BufferGeometry(), a = new Float32Array(n), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a[i] = (i + 0.5) / n; g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aS', new T.BufferAttribute(a, 1));
  const m = new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uC: { value: new T.Color(color) }, uC2: { value: new T.Color(0xffffff) }, uBeat, uK: { value: new T.Vector4(K.rise, K.rad, K.size, K.spin) }, uF: { value: new T.Vector2(K.flick, K.grav) }, uPx: { value: 1 } },
    vertexShader: `attribute float aS; uniform float uT, uBeat, uPx; uniform vec4 uK; uniform vec2 uF; varying float vA; varying float vM;
      void main(){ float s = fract(aS * 91.7), h = fract(aS * 7.31 + uT * uK.x * (0.5 + s)), a = aS * 47.0 + uT * uK.w * (0.4 + s), r = uK.y * (0.35 + 0.65 * fract(aS * 9.7)) * (uF.y > 0.5 ? (0.7 + 0.5 * h) : 1.0);
        vec3 p = vec3(cos(a) * r, h * 2.3 + (uF.y > 0.5 ? 0.0 : 0.3 * sin(uT + aS * 20.0)), sin(a) * r); vA = (uF.y > 0.5 ? sin(h * 3.1416) : 0.6 + 0.4 * sin(uT * 1.3 + aS * 30.0)) * (0.6 + 0.5 * uBeat) * (0.55 + 0.45 * sin(uT * uF.x + aS * 60.0)); vM = s;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (1.2 + uK.z * s) * uPx * (5.0 / max(-mv.z, 0.5)); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC, uC2; varying float vA, vM; void main(){ float d = length(gl_PointCoord - 0.5); float core = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(mix(uC, uC2, core * core * 0.8) * 1.5, core * vA); }`,
  });
  const pts = new T.Points(g, m); pts.frustumCulled = false; pts.name = 'particulas-' + kind; pts.renderOrder = 3;
  return { points: pts, material: m, set(hex) { m.uniforms.uC.value.set(hex); }, tick(t) { m.uniforms.uT.value = t; }, dispose() { g.dispose(); m.dispose(); } };
}
