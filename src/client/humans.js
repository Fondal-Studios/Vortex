// Personas humanas 3D para Cristal Vórtice (jugadores del coop y la protagonista Pasajero/a).
// Trasplante mínimo de la «NPC Factory» de ARCANUM (src/arcanum/, assets CC0 en assets/arcanum/).
//
//   import { loadHumanKit, createHuman } from './humans.js';
//   const kit = await loadHumanKit({ quality: 'low' });            // una sola vez (anatomía + animaciones)
//   const h = createHuman(kit, { preset: 'jugador2', color: 0xff66c4, name: 'Ana' });
//   scene.add(h.object);                                           // aparece en cuanto termina de armarse (h.ready)
//   h.play('walk'); ... h.update(dt, { speed: 3 });                // cada cuadro
//
// Hace falta importmap con "three" (y "three/addons/": "/vendor/three-addons/"), ver docs/PERSONAS.md.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getNpcStore } from '../arcanum/store.js';
import { createNpcActor } from '../arcanum/actor.js';
import { CLIP_SPEED } from '../arcanum/locomotion.js';
import { PROFILES } from '../arcanum/quality.js';

export const QUALITIES = Object.keys(PROFILES); // 'low' | 'medium' | 'high'
export const PLAYER_COLORS = [0x66ffee, 0xff66c4, 0xffd23f, 0x9dff5a]; // los mismos de render.js

// Nombre corto → clip horneado en assets/arcanum/clips.bin
const ALIAS = { idle: 'idle', stand: 'idle', walk: 'walk', run: 'jog', jog: 'jog', sprint: 'sprint', crouch: 'crouch', crouchWalk: 'crouchWalk',
  aim: 'aim', aimIdle: 'aimIdle', shoot: 'shoot', fire: 'shoot', reload: 'reload', gesture: 'cast', cast: 'cast', gesto: 'cast', punch: 'punch',
  hit: 'hit', hurt: 'hit', jump: 'jump', fall: 'fall', caida: 'fall', land: 'land', death: 'death', die: 'death', talk: 'talk', interact: 'interact', dance: 'dance', spellIdle: 'spellIdle' };
export const CLIP_NAMES = [...new Set(Object.values(ALIAS))];

// ------------------------------------------------------------------ presets (definiciones de la fábrica)
const BASE_PLAYER = { role: 'poblacion', gloves: 'ninguno', boots: 'botas', belt: 'simple', magicAffinity: 'neutral', animationSet: 'energico', accessories: [] };
export const PRESETS = {
  // Protagonista: persona común que viaja en tren (campera urbana, mochila, auriculares colgando del cuello, botas). Sin utilería de fantasía.
  pasajero: { ...BASE_PLAYER, role: 'civil', name: 'Pasajero/a', base: 'femenino-joven', hair: 'short02', hairColor: '#2a211c', eyebrows: 'eyebrow010',
    outfit: 'male_worksuit01', layer: 'abrigo-corto', boots: 'botas', belt: 'ninguno', extras: ['mochila', 'auriculares'],
    palette: 'ciudad', colors: { primario: '#3b4656', secundario: '#56657a', acento: '#d9d2b5', metal: '#8a8a88', cuero: '#2f2420' },
    animationSet: 'sereno', body: { height: 1.0, width: 0.97 } },
  // Cuatro pasajeros del coop: misma estética cotidiana; el color real (ropa + acento emisivo) lo pone `spec.color`.
  jugador1: { ...BASE_PLAYER, name: 'Jugador 1', base: 'masculino-joven', hair: 'short02', hairColor: '#2a211c', outfit: 'male_casualsuit01', layer: 'abrigo-corto', boots: 'botas', belt: 'ninguno', extras: ['mochila', 'auriculares'], body: { height: 1.04, shoulders: 1.04 } },
  jugador2: { ...BASE_PLAYER, name: 'Jugador 2', base: 'femenino-joven', hair: 'ponytail01', hairColor: '#2a1d30', outfit: 'female_elegantsuit01', layer: 'abrigo-corto', boots: 'botas', belt: 'ninguno', extras: ['mochila', 'auriculares'], body: { height: 0.99 } },
  jugador3: { ...BASE_PLAYER, name: 'Jugador 3', base: 'masculino-joven', skin: 'joven-oscura', hair: 'short04', hairColor: '#191719', outfit: 'male_worksuit01', layer: 'abrigo-corto', boots: 'botas-viaje', belt: 'ninguno', extras: ['auriculares'], body: { height: 1.06, width: 1.04, shoulders: 1.08 } },
  jugador4: { ...BASE_PLAYER, name: 'Jugador 4', base: 'femenino-adulto', hair: 'bob02', hairColor: '#7a3a22', outfit: 'male_worksuit01', layer: 'abrigo-corto', boots: 'botas-viaje', belt: 'ninguno', extras: ['mochila'], accessories: ['gafas'], body: { height: 1.0 } },
};
export const PRESET_NAMES = Object.keys(PRESETS);

function hash(str) { let h = 2166136261 >>> 0; for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rng(seed) { let s = hash(seed) || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];

/** Definición reproducible a partir de una semilla (sólo cuerpos jóvenes/adultos: son los que traen piel en assets/arcanum). */
function fromSeed(seed) {
  const r = rng(seed), f = r() < 0.5;
  const base = f ? pick(r, ['femenino-joven', 'femenino-adulto']) : pick(r, ['masculino-joven', 'masculino-adulto']);
  const joven = base.endsWith('joven');
  return { ...BASE_PLAYER, name: 'Persona ' + seed, base, skin: !f && joven && r() < 0.25 ? 'joven-oscura' : undefined,
    hair: pick(r, f ? ['long01', 'ponytail01', 'bob02', 'short02'] : ['short01', 'short02', 'short04']),
    hairColor: pick(r, ['#2a211c', '#3a2c22', '#5a3c26', '#7a5434', '#a07a4a', '#6e2f1d', '#191719']),
    eyebrows: pick(r, ['eyebrow001', 'eyebrow010']), skinTint: r() < 0.35 ? pick(r, ['#f3dccb', '#e8c9b0', '#d9b393']) : null,
    extras: r() < 0.7 ? ['mochila', 'auriculares'] : ['auriculares'],
    outfit: f ? pick(r, ['female_elegantsuit01', 'male_worksuit01']) : pick(r, ['male_casualsuit01', 'male_worksuit01']),
    layer: pick(r, ['ninguna', 'abrigo-corto', 'abrigo-largo']), boots: pick(r, ['ninguna', 'botas', 'botas-viaje']),
    gloves: 'ninguno', belt: 'ninguno', accessories: r() < 0.3 ? ['gafas'] : [],
    body: { height: 0.96 + r() * 0.1, width: 0.94 + r() * 0.1 } };
}

// ------------------------------------------------------------------ color
const col = (c) => new T.Color(typeof c === 'number' ? c : c);
const hex = (c) => '#' + c.getHexString();
/** Paleta de ropa a partir del color del jugador: base oscura + tela con el tono + acento brillante. */
function paletteFromColor(color) {
  const c = col(color), hsl = {}; c.getHSL(hsl);
  const mk = (s, l) => hex(new T.Color().setHSL(hsl.h, Math.min(1, hsl.s * s), l));
  return { primario: mk(0.75, 0.2), secundario: mk(0.85, 0.36), acento: hex(c), metal: mk(0.4, 0.62), cuero: '#2a1f22' };
}

// ------------------------------------------------------------------ acento emisivo «psicodélico»
function accentMaterial(color, tstate) {
  return new T.ShaderMaterial({
    uniforms: { uTime: tstate, uColor: { value: col(color) } },
    vertexShader: 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vP;
      vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
      void main(){ float f = pow(1.0 - abs(vN.z), 1.4); float h = vN.x * 0.5 + vN.y * 0.35 + (vP.x + vP.y + vP.z) * 7.0 + uTime * 0.22;
        vec3 c = mix(uColor * 1.5, pal(h), 0.28 + 0.5 * f); c *= 1.05 + 0.25 * sin(uTime * 2.2 + vP.y * 12.0);
        gl_FragColor = vec4(c, 1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  });
}
function buildAccent(kit, actor, material, quality) {
  const W = kit.store.boneWorld(), bones = actor.bones, made = [];
  const put = (boneName, geo, wx, wy, wz) => {
    const b = bones[boneName], w = W[boneName]; if (!b || !w) return;
    geo.translate(wx - w[0], wy - w[1], wz - w[2]);
    const m = new T.Mesh(geo, material); m.name = 'acento-' + boneName; m.frustumCulled = false; b.add(m); made.push(m);
  };
  const seg = quality === 'low' ? 5 : 8;
  // cristal en el pecho (octaedro alargado)
  const cr = new T.OctahedronGeometry(0.045, quality === 'low' ? 0 : 1); cr.scale(0.7, 1.35, 0.7);
  put('spine01_h', cr, 0, 1.3, 0.125);
  if (quality !== 'low') for (const s of ['L', 'R']) { // brazaletes
    const w = W[`wrist_${s}_h`], e = W[`lowerarm01_${s}_h`]; if (!w || !e) continue;
    const dir = new T.Vector3(e[0] - w[0], e[1] - w[1], e[2] - w[2]).normalize();
    const g = new T.TorusGeometry(0.036, 0.007, 5, seg * 2); g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), dir));
    put(`wrist_${s}_h`, g, w[0] + dir.x * 0.05, w[1] + dir.y * 0.05, w[2] + dir.z * 0.05);
  }
  return made;
}

// ------------------------------------------------------------------ utilería cotidiana (mochila, auriculares): geometría propia
function buildExtras(kit, actor, extras, color, tint) {
  const W = kit.store.boneWorld(), bones = actor.bones, made = [], mats = [];
  const low = kit.quality === 'low', seg = low ? 6 : 10;
  const mat = new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05, vertexColors: true }); mats.push(mat);
  const paint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), k = new T.Color(c); for (let i = 0; i < n; i++) k.toArray(a, i * 3); g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
  const put = (boneName, geos) => {
    const b = bones[boneName], w = W[boneName]; if (!b || !w) return;
    const g = geos.length > 1 ? mergeGeometries(geos.map((x) => { const y = x.index ? x.toNonIndexed() : x; return y; })) : geos[0];
    geos.forEach((x) => x !== g && x.dispose());
    g.translate(-w[0], -w[1], -w[2]);
    const m = new T.Mesh(g, mat); m.name = 'extra-' + boneName; m.frustumCulled = false; b.add(m); made.push(m);
  };
  const base = tint ? new T.Color(tint) : new T.Color(0x33384a);
  if (extras.includes('mochila')) {
    const body = new T.BoxGeometry(0.27, 0.36, 0.13); body.translate(0, 1.26, -0.15);
    const pocket = new T.BoxGeometry(0.2, 0.16, 0.05); pocket.translate(0, 1.18, -0.235);
    const sl = new T.BoxGeometry(0.045, 0.3, 0.17); sl.translate(-0.09, 1.34, -0.03); const sr = sl.clone(); sr.translate(0.18, 0, 0);
    put('spine01_h', [paint(body, base.clone().multiplyScalar(0.9)), paint(pocket, base.clone().multiplyScalar(0.65)), paint(sl, '#1b1b1f'), paint(sr, '#1b1b1f')]);
  }
  if (extras.includes('auriculares')) {
    // aro colgando del cuello + dos copas sobre el pecho (el cable no se modela)
    const band = new T.TorusGeometry(0.105, 0.012, 5, seg * 2, Math.PI * 1.55); band.rotateX(Math.PI / 2); band.rotateY(Math.PI * 0.2 + Math.PI * 0.0); band.translate(0, 1.47, -0.01);
    const cl = new T.CylinderGeometry(0.035, 0.035, 0.03, seg); cl.rotateZ(Math.PI / 2); cl.translate(-0.095, 1.40, 0.075); const cr = cl.clone(); cr.translate(0.19, 0, 0);
    put('neck02_h', [paint(band, '#15151a'), paint(cl, new T.Color(color ?? 0x66ffee).multiplyScalar(0.7)), paint(cr, new T.Color(color ?? 0x66ffee).multiplyScalar(0.7))]);
  }
  return { made, mats };
}

// ------------------------------------------------------------------ API
/**
 * Carga lo compartido por todas las personas (anatomía, animaciones; las texturas se cargan al usarse y se reutilizan).
 * quality: 'low' (iPhone) | 'medium' | 'high'. movil: fuerza límites móviles (sin sombras, textura ≤ 512).
 */
export async function loadHumanKit({ quality = 'medium', movil = false } = {}) {
  if (!PROFILES[quality]) quality = 'medium';
  const profile = PROFILES[quality];
  const store = getNpcStore({ textureMax: movil ? Math.min(profile.textureMax, 512) : profile.textureMax });
  const t0 = performance.now();
  await store.ready; await Promise.all([store.animationClips(), store.body()]);
  return { quality, movil, store, profile, loadMs: performance.now() - t0, clips: CLIP_NAMES, humans: new Set() };
}

/**
 * spec: { preset: 'pasajero'|'jugador1'..'jugador4' | seed: cualquier texto, color: 0xRRGGBB|'#rrggbb' (ropa + acento), name,
 *         accent: color del acento (por defecto = color), overrides: campos de la fábrica a pisar (hair, hairColor, outfit…) }
 * Devuelve { object, ready, update(dt, opts), play(clip, {fade, restart}), setLook(patch), stats(), clip, dispose() }.
 * `object` ya se puede agregar a la escena: el cuerpo aparece cuando termina de cargar (ready, una promesa).
 * Mira hacia +Z (hacia donde apunta la cara) y los pies están en y = 0; mide ≈ 1,7 unidades (metros).
 */
export function createHuman(kit, spec = {}) {
  const preset = spec.preset && PRESETS[spec.preset] ? spec.preset : null;
  const idx = preset?.startsWith('jugador') ? Number(preset.slice(7)) - 1 : 0;
  let look = { color: spec.color ?? (preset === 'pasajero' ? null : PLAYER_COLORS[idx % 4]), accent: spec.accent ?? null, ...spec.overrides };
  const baseDef = preset ? PRESETS[preset] : fromSeed(spec.seed ?? spec.name ?? 'anon');
  const idBase = String(spec.name || baseDef.name || 'persona').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'persona';
  const id = `${idBase}-${(hash(JSON.stringify([spec, Math.random()])) % 9999)}`;
  const root = new T.Group(); root.name = 'humano-' + (spec.name || preset || 'seed');
  const tstate = { value: Math.random() * 10 };
  let accentMat = null, accentMeshes = [], extraMeshes = [], extraMats = [], current = 'idle', disposed = false;

  function definition() {
    const def = { ...baseDef, ...(look.overrides || {}) };
    for (const [k, v] of Object.entries(look)) if (!['color', 'accent', 'overrides'].includes(k) && v != null) def[k] = v;
    delete def.extras; def.id = id; def.name = spec.name || baseDef.name; def.body = { ...(baseDef.body || {}), ...(look.body || {}) };
    if (look.color != null) { def.palette = 'ciudad'; def.colors = { ...paletteFromColor(look.color), ...(baseDef.colors || {}) , ...paletteFromColor(look.color) }; }
    // pasajero conserva su paleta propia salvo que se pida un color explícito
    if (!def.skin) delete def.skin;
    return def;
  }
  const actor = createNpcActor(kit.store, definition(), { quality: kit.quality, movil: kit.movil });
  root.add(actor.root);
  kit.humans.add(root);

  function decorate() {
    for (const m of accentMeshes) { m.removeFromParent(); m.geometry.dispose(); }
    accentMeshes = [];
    const c = look.accent ?? look.color ?? (look.color === null && preset === 'pasajero' ? 0x66ffee : 0xffffff);
    if (!accentMat) accentMat = accentMaterial(c, tstate); else accentMat.uniforms.uColor.value.set(col(c));
    accentMeshes = buildAccent(kit, actor, accentMat, kit.quality);
    for (const m of extraMeshes) { m.removeFromParent(); m.geometry.dispose(); } for (const m of extraMats) m.dispose();
    const ex = buildExtras(kit, actor, baseDef.extras || [], look.color ?? 0x66ffee, look.color != null ? hex(new T.Color(paletteFromColor(look.color).primario)) : '#3b4656');
    extraMeshes = ex.made; extraMats = ex.mats;
  }
  const ready = actor.ready.then(() => { if (!disposed) decorate(); return api; });
  ready.catch((e) => console.error('[humans] no se pudo armar', spec, e));

  const api = {
    object: root, ready, actor,
    get clip() { return current; },
    get bones() { return actor.bones; },
    /** Cambia la animación (nombres: ver CLIP_NAMES y alias). fade en segundos; restart reinicia si ya estaba (p. ej. otro disparo). */
    play(name, { fade = null, restart = false } = {}) {
      const key = ALIAS[name] || name; if (!actor.hasClip(key) && actor.status === 'ready') { console.warn('[humans] clip desconocido:', name); return api; }
      if (key !== current || restart) pending = { fade, restart };
      current = key; return api;
    },
    /** Un cuadro. opts: { speed (m/s reales para ajustar el paso al caminar/correr), look (Vector3 a mirar, false = nada), camera (para el LOD), cull }. */
    update(dt, opts = {}) {
      tstate.value += dt;
      const p = pending; pending = null;
      const sp = CLIP_SPEED[current] ? (opts.speed != null ? opts.speed / CLIP_SPEED[current] : 1) : 1;
      actor.update(dt, { motion: current, motionSpeed: sp, look: opts.look ?? false, camera: opts.camera || null, cull: !!opts.cull, snap: !!opts.snap, fade: p?.fade ?? null, restart: !!p?.restart });
    },
    /** Cambia el aspecto: { color, accent, hair, hairColor, outfit, layer, accessories, skinTint… }. Vuelve a armar (asíncrono). */
    async setLook(patch = {}) {
      look = { ...look, ...patch };
      if (Object.keys(patch).every((k) => k === 'accent') && accentMat) { accentMat.uniforms.uColor.value.set(col(look.accent ?? look.color)); return api; }
      await actor.setDefinition(definition()); if (!disposed) decorate(); return api;
    },
    /** { drawCalls, triangles, materials } de esta persona (sin contar lo ya oculto por LOD). */
    stats() { const s = actor.stats(); return s; },
    dispose() {
      disposed = true; actor.dispose(); for (const m of [...accentMeshes, ...extraMeshes]) m.geometry.dispose(); extraMats.forEach((m) => m.dispose()); accentMat?.dispose(); root.removeFromParent(); kit.humans.delete(root);
    },
  };
  let pending = null;
  return api;
}

/** Libera las texturas compartidas del kit (llamar al cerrar la escena, después de dispose() de cada persona). */
export function disposeHumanKit(kit) { kit.store.dispose(); }
