// Personas humanas 3D para Cristal Vórtice: el Pasajero/a (un avatar humano reconstruido en el
// Vórtice) y los 4 jugadores del coop con sus roles. Trasplante de la «NPC Factory» de ARCANUM (src/arcanum/, assets CC0
// en assets/arcanum/) + equipo propio (src/arcanum/gear.js), animación por capas, arma en la mano y gestos.
//
//   import { loadHumanKit, createHuman } from './humans.js';
//   const kit = await loadHumanKit({ quality: 'low' });                      // una sola vez (anatomía + animaciones + módulo de armas)
//   const h = createHuman(kit, { preset: 'jugador2', role: 'soporte', color: 0xff66c4, name: 'Ana', weapon: 0 });
//   scene.add(h.object);                                                      // aparece en cuanto termina de armarse (h.ready)
//   h.update(dt, { speed: 3.1, moveDir: { x: 0, z: 1 }, pitch: 0.2, camera }); // cada cuadro
//
// Hace falta importmap con "three" (y "three/addons/": "/vendor/three-addons/"), ver docs/PERSONAS.md.
import * as T from 'three';
import { getNpcStore } from '../arcanum/store.js';
import { createNpcActor } from '../arcanum/actor.js';
import { CLIP_SPEED } from '../arcanum/locomotion.js';
import { PROFILES } from '../arcanum/quality.js';
import { buildGear, crystalAccent } from '../arcanum/gear.js';
import { twoBoneIK, setWorldQuat, handBasis, basisQuat } from '../arcanum/pose.js';

export const QUALITIES = Object.keys(PROFILES); // 'low' | 'medium' | 'high'
export const PLAYER_COLORS = [0x66ffee, 0xff66c4, 0xffd23f, 0x9dff5a]; // los mismos de render.js
export const ROLES = ['vanguardia', 'soporte', 'ingeniero', 'explorador'];
// Personajes del juego (espejo de CHARACTERS en src/sim/data.js): elige guantes + tatuajes de cristal propios, color y, si faltan, preset/semilla/rol.
export const CHAR_IDS = ['egida', 'lumen', 'forja', 'vigia', 'nova', 'umbra', 'axioma', 'vesper', 'micelio', 'seraf'];
export const CHAR_INFO = {
  egida: { color: 0x66ffee, role: 'vanguardia', preset: 'jugador1' }, lumen: { color: 0xff66c4, role: 'soporte', preset: 'jugador2' },
  forja: { color: 0xffd23f, role: 'ingeniero', preset: 'jugador3' }, vigia: { color: 0x9dff5a, role: 'explorador', preset: 'jugador4' },
  nova: { color: 0xff9a3c, role: 'explorador', seed: 'nova-7' }, umbra: { color: 0xb98cff, role: 'soporte', seed: 'umbra-3' },
  // Huéspedes (colores y presets de CHARACTERS en src/sim/data.js; el rol de la 3ª persona es el equivalente de los 4 roles base)
  axioma: { color: 0x3aa8ff, role: 'vanguardia', preset: 'jugador1' }, vesper: { color: 0xb04bff, role: 'explorador', preset: 'jugador4' }, micelio: { color: 0x7be03a, role: 'ingeniero', preset: 'jugador2' }, seraf: { color: 0xffd45a, role: 'soporte', preset: 'jugador3' },
};
CHAR_INFO.singular = { color: 0xb26bff, role: 'ingeniero', preset: 'jugador3' }; CHAR_IDS.push('singular');   // Singular (astro muerto: gravedad y área)
CHAR_INFO.colmena = { color: 0xf0384e, role: 'ingeniero', preset: 'jugador3' }; CHAR_IDS.push('colmena');   // Colmena (invocadora de enjambre)
CHAR_INFO.danzante = { color: 0xff3fa0, role: 'explorador', preset: 'jugador4' }; CHAR_IDS.push('danzante');   // Danzante (duelista acrobático)
const ROLE_CHAR = { vanguardia: 'egida', soporte: 'lumen', ingeniero: 'forja', explorador: 'vigia' }; // sin `char`, el rol elige el estilo de manos

// Nombre corto → clip horneado en assets/arcanum/clips.bin (revive = la caída al revés)
const ALIAS = { idle: 'idle', stand: 'idle', walk: 'walk', run: 'jog', jog: 'jog', sprint: 'sprint', crouch: 'crouch', crouchWalk: 'crouchWalk',
  aim: 'aim', aimIdle: 'aimIdle', shoot: 'shoot', fire: 'shoot', reload: 'reload', gesture: 'cast', cast: 'cast', gesto: 'cast', punch: 'punch',
  hit: 'hit', hurt: 'hit', jump: 'jump', fall: 'fall', caida: 'fall', land: 'land', death: 'death', die: 'death', downed: 'death', talk: 'talk',
  interact: 'interact', help: 'interact', ayuda: 'interact', dance: 'dance', spellIdle: 'spellIdle', revive: 'revive', reanimar: 'revive' };
export const CLIP_NAMES = [...new Set(Object.values(ALIAS))];
// Qué clips se piden como «locomoción/apuntado» (las piernas siguen a la velocidad real y el torso al arma) y cuáles son cuerpo entero.
const LOCO_REQ = new Set(['idle', 'walk', 'jog', 'sprint', 'crouch', 'crouchWalk']);
const AIM_REQ = new Set(['aim', 'aimIdle', 'shoot']);
const NO_WEAPON = new Set(['interact', 'talk', 'dance', 'revive']); // con estos el arma se guarda

// ------------------------------------------------------------------ presets (definiciones de la fábrica)
const BASE_PLAYER = { role: 'poblacion', gloves: 'ninguno', boots: 'ninguna', belt: 'ninguno', magicAffinity: 'neutral', animationSet: 'energico', accessories: [], layer: 'ninguna' };
export const PRESETS = {
  // Protagonista: persona común que viaja en tren (sudadera con capucha, jeans, zapatillas, mochila, auriculares colgando del cuello).
  pasajero: { ...BASE_PLAYER, role: 'civil', name: 'Pasajero/a', base: 'femenino-joven', hair: 'short02', hairColor: '#2a211c', eyebrows: 'eyebrow010',
    outfit: 'male_casualsuit01', extras: ['mochila', 'auriculares'], animationSet: 'sereno', body: { height: 1.0, width: 0.97 } },
  // Cuatro pasajeros del coop: misma estética cotidiana; el color real (acentos emisivos + tinte de ropa) lo pone `spec.color` y el equipo `spec.role`.
  jugador1: { ...BASE_PLAYER, name: 'Jugador 1', base: 'masculino-joven', hair: 'short02', hairColor: '#2a211c', outfit: 'male_casualsuit01', extras: ['mochila', 'auriculares'], body: { height: 1.04, shoulders: 1.04 } },
  jugador2: { ...BASE_PLAYER, name: 'Jugador 2', base: 'femenino-joven', hair: 'ponytail01', hairColor: '#2a1d30', outfit: 'male_casualsuit01', extras: ['mochila', 'auriculares'], body: { height: 0.99 } },
  jugador3: { ...BASE_PLAYER, name: 'Jugador 3', base: 'masculino-joven', skin: 'joven-oscura', hair: 'short04', hairColor: '#191719', outfit: 'male_casualsuit01', extras: ['mochila', 'auriculares'], body: { height: 1.06, width: 1.04, shoulders: 1.08 } },
  jugador4: { ...BASE_PLAYER, name: 'Jugador 4', base: 'femenino-adulto', hair: 'bob02', hairColor: '#7a3a22', outfit: 'male_casualsuit01', extras: ['mochila', 'auriculares'], accessories: ['gafas'], body: { height: 1.0 } },
};
export const PRESET_NAMES = Object.keys(PRESETS);
// Rol → ropa base y tinte de la ropa (la prenda MakeHuman es una sola pieza: sudadera + jeans; el tinte va por zonas, ver materials.js)
const ROLE_LOOK = {
  vanguardia: { top: '#5a6676', bottom: '#667080', topHue: true },
  soporte:    { top: '#d6dbe2', bottom: '#9fa9b8', topHue: false },
  ingeniero:  { top: '#a77b3c', bottom: '#58463a', topHue: false, outfit: 'male_worksuit01' },
  explorador: { top: '#7a8a62', bottom: '#74745a', topHue: false },
};

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
    outfit: pick(r, ['male_casualsuit01', 'male_casualsuit01', 'female_elegantsuit01', 'male_worksuit01']),
    gloves: 'ninguno', belt: 'ninguno', accessories: r() < 0.3 ? ['gafas'] : [],
    body: { height: 0.96 + r() * 0.1, width: 0.94 + r() * 0.1 } };
}

// ------------------------------------------------------------------ color
const col = (c) => new T.Color(c);
const hexs = (c) => '#' + c.getHexString();
/** Colores de la ropa: oscuros y poco saturados (persona común); el color del jugador va sólo en acentos y en un matiz de la sudadera. */
function clothing(color, role) {
  const hsl = {}; col(color ?? 0x66ffee).getHSL(hsl);
  const L = ROLE_LOOK[role];
  const tint = (s, l) => hexs(new T.Color().setHSL(hsl.h, s, l));
  return {
    top: L && !L.topHue ? L.top : L ? hexs(col(L.top).lerp(col(tint(0.5, 0.3)), 0.25)) : tint(0.2, 0.34),
    bottom: L ? L.bottom : null,
    accent: hexs(col(color ?? 0x66ffee)),
  };
}

// ------------------------------------------------------------------ arma (módulo de armas del cliente, con respaldo propio)
let _flashTex = null;
function flashTexture() {
  if (_flashTex) return _flashTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _flashTex = new T.CanvasTexture(c); _flashTex.colorSpace = T.SRGBColorSpace; return _flashTex;
}
const WEAPON_TINTS = [0x66ffee, 0xff8fd0, 0xffd34a, 0xff7a45, 0xa98bff];
/** Arma de respaldo si weapons-vm.js no está: caja + cañón + cristal. Origen en la empuñadura, boca hacia −Z. */
function fallbackWeapon(index, tstate) {
  const c = WEAPON_TINTS[index % WEAPON_TINTS.length], g = new T.Group(), mat = crystalAccent(c, tstate, { glow: 0.5 }), dark = new T.MeshStandardMaterial({ color: 0x23262d, roughness: 0.4, metalness: 0.8 });
  const body = new T.Mesh(new T.BoxGeometry(0.07, 0.1, 0.4), dark); body.position.set(0, 0, -0.05); g.add(body);
  const barrel = new T.Mesh(new T.CylinderGeometry(0.018, 0.022, 0.4, 8), dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, -0.4); g.add(barrel);
  const cr = new T.Mesh(new T.OctahedronGeometry(0.04, 0), mat); cr.scale.set(0.8, 1.2, 1.8); cr.position.set(0, 0.07, -0.1); g.add(cr);
  g.userData.muzzle = [0, 0.02, -0.62]; g.userData.fallback = true; g.userData.mats = [mat, dark]; return g;
}

// ------------------------------------------------------------------ API
/**
 * Carga lo compartido por todas las personas (anatomía, animaciones, módulo de armas; las texturas se cargan al usarse y se reutilizan).
 * quality: 'low' (iPhone) | 'medium' | 'high'. movil: fuerza límites móviles (sin sombras, textura ≤ 512).
 */
export async function loadHumanKit({ quality = 'medium', movil = false } = {}) {
  if (!PROFILES[quality]) quality = 'medium';
  const profile = PROFILES[quality];
  const store = getNpcStore({ textureMax: movil ? Math.min(profile.textureMax, 512) : profile.textureMax });
  const t0 = performance.now();
  const weapons = import('./weapons-vm.js').then((m) => (typeof m.createWeaponModel === 'function' ? m : null)).catch(() => null);
  await store.ready; await Promise.all([store.animationClips(), profile.lod ? store.lodReady : store.body()]);
  if (profile.lod) await store.body(true);
  return { quality, movil, store, profile, loadMs: performance.now() - t0, clips: CLIP_NAMES, humans: new Set(), weaponModule: await weapons };
}

const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const _v = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3(), _v4 = new T.Vector3(), _q = new T.Quaternion();

/**
 * spec: { preset: 'pasajero'|'jugador1'..'jugador4' | seed: texto, role: 'vanguardia'|'soporte'|'ingeniero'|'explorador'|null,
 *         char: 'egida'|'lumen'|'forja'|'vigia'|'nova'|'umbra' (guantes + tatuajes de cristal propios; pone color/preset/rol si faltan; sin `char` el rol elige: vanguardia→egida, soporte→lumen, ingeniero→forja, explorador→vigia; hands:false los apaga),
 *         color: 0xRRGGBB (acentos + matiz de la ropa), accent, name, weapon: índice de arma (0..n) | null, overrides: campos de la fábrica }
 * `weapon` por defecto: el arma 0 (Haz) si hay rol; 'null' = sin arma (el avatar camina/idle normal).
 * Devuelve { object, ready, update, play, setWeapon, shoot, gesture, setRole, setLook, stats, dispose, clip, bones, actor }.
 * `object` ya se puede agregar a la escena: el cuerpo aparece cuando termina de cargar (ready, una promesa).
 * Mira hacia +Z (hacia donde apunta la cara) y los pies están en y = 0; mide ≈ 1,7 unidades (metros).
 */
export function createHuman(kit, spec = {}) {
  let char = CHAR_INFO[spec.char] ? spec.char : null; const ci = char ? CHAR_INFO[char] : null;
  const preset = spec.preset && PRESETS[spec.preset] ? spec.preset : (!spec.seed && ci?.preset) || null;
  if (ci && !spec.preset && !spec.seed && !ci.preset) spec = { ...spec, seed: ci.seed };
  const idx = preset?.startsWith('jugador') ? Number(preset.slice(7)) - 1 : 0;
  let role = ROLES.includes(spec.role) ? spec.role : (ci?.role ?? null);
  if (!char && role && spec.hands !== false) char = ROLE_CHAR[role];
  if (spec.hands === false) char = null;
  let look = { color: spec.color ?? ci?.color ?? (preset === 'pasajero' || !preset ? 0x66ffee : PLAYER_COLORS[idx % 4]), accent: spec.accent ?? null, ...spec.overrides };
  const baseDef = preset ? PRESETS[preset] : fromSeed(spec.seed ?? spec.name ?? 'anon');
  const idBase = String(spec.name || baseDef.name || 'persona').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'persona';
  const id = `${idBase}-${(hash(JSON.stringify([spec, Math.random()])) % 9999)}`;
  const root = new T.Group(); root.name = 'humano-' + (spec.name || preset || 'seed');
  const tstate = { value: Math.random() * 10 };
  let gear = null, current = 'idle', disposed = false, time = 0, pending = null;
  let weaponIndex = spec.weapon === undefined ? 0 : spec.weapon; // null = desarmado
  const W = kit.store.boneWorld(), basis = { R: handBasis(W, 'R'), L: handBasis(W, 'L') };

  function definition() {
    const def = { ...baseDef };
    for (const [k, v] of Object.entries(look)) if (!['color', 'accent', 'overrides'].includes(k) && v != null) def[k] = v;
    delete def.extras; def.id = id; def.name = spec.name || baseDef.name; def.body = { ...(baseDef.body || {}), ...(look.body || {}) };
    if (role && ROLE_LOOK[role].outfit && !look.outfit) def.outfit = ROLE_LOOK[role].outfit;
    const cl = clothing(look.color, role);
    def.palette = 'ciudad'; def.colors = { primario: cl.top, secundario: cl.top, acento: cl.accent, metal: '#8a8a88', cuero: '#2a1f22' };
    def.clothTop = cl.top; def.clothBottom = cl.bottom; def.accentColor = cl.accent;
    if (!def.skin) delete def.skin;
    return def;
  }
  const actor = createNpcActor(kit.store, definition(), { quality: kit.quality, movil: kit.movil });
  root.add(actor.root);
  kit.humans.add(root);

  // ---------------------------------------------------------------- equipo (mochila, auriculares, visor…)
  function decorate() {
    gear?.dispose();
    const accent = look.accent ?? look.color ?? 0x66ffee;
    gear = buildGear(kit, actor, { role: spec.noGear ? null : role, color: accent, quality: kit.quality, extras: spec.noGear ? [] : (baseDef.extras || []), tstate, char, tint: clothing(look.color, role).top });
    if (!spec.noWeapon) attachWeapon(weaponIndex, true);
  }

  // ---------------------------------------------------------------- arma en la mano derecha
  const weaponCache = new Map(); // índice → { holder, model, flash, len }
  let wCur = null, swap = null, kick = 0, flashT = 0, firing = false;
  const holderQ = (() => { // el arma en la palma: adelante (−Z del arma) = hacia los dedos, arriba (+Y) = hacia el pulgar
    const r = basis.R; return basisQuat(r.f, r.u, r.f, r.u); // (identidad: la muñeca ya está en la pose de enlace)
  })();
  void holderQ;
  function makeWeapon(i) {
    if (weaponCache.has(i)) return weaponCache.get(i);
    let model = null;
    try { model = kit.weaponModule?.createWeaponModel(i, { quality: kit.quality }) || null; } catch (e) { console.warn('[humans] arma', i, e.message); }
    if (!model) model = fallbackWeapon(i, tstate);
    const holder = new T.Group(), grip = new T.Group(); holder.name = 'arma-' + i; holder.add(grip); grip.add(model);
    // se calibra con el modelo: la boca fija el largo; escala para que un arma chica no flote ni una larga atraviese el cuerpo
    const mz = model.userData.muzzle || [0, 0, -0.7], len = Math.abs(mz[2]);
    const s = T.MathUtils.clamp(0.62 * (0.7 / Math.max(0.35, len)) ** 0.35, 0.5, 0.75); grip.scale.setScalar(s);
    const flash = new T.Sprite(new T.SpriteMaterial({ map: flashTexture(), color: WEAPON_TINTS[i % 5], blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }));
    flash.position.set(mz[0], mz[1], mz[2]); flash.scale.setScalar(0.4); flash.renderOrder = 10; model.add(flash);
    const w = { index: i, holder, grip, model, flash, len: len * s, s, mz };
    holder.visible = false; weaponCache.set(i, w); return w;
  }
  function attachWeapon(i, instant = false) {
    const hand = actor.bones.wrist_R_h; if (!hand) return;
    if (i == null || i < 0) { if (wCur) { wCur.holder.visible = false; wCur.holder.removeFromParent(); } wCur = null; weaponIndex = null; return; }
    const next = makeWeapon(i);
    const doIt = () => {
      if (wCur) { wCur.holder.visible = false; wCur.holder.removeFromParent(); }
      wCur = next; weaponIndex = i; hand.add(next.holder); next.holder.visible = true; place(next, 0);
    };
    if (instant || !wCur) { doIt(); swap = instant ? null : { t: 0, phase: 1, flash: true }; } else swap = { t: 0, phase: 0, fn: doIt };
  }
  // empuñadura: la palma está ~5 cm por delante de la muñeca, con el pulgar hacia arriba; ajustes finos por arma
  function place(w, k) {
    const r = basis.R, h = w.holder;
    // base: −Z del arma = f (dedos), +Y = u (pulgar); posición = muñeca + f * 0.055 + u * 0.012
    const q = basisQuat(r.f, r.u, r.f, r.u); // identidad (se deja explícito: la base ya está en espacio de la muñeca)
    h.quaternion.copy(q);
    const z = new T.Matrix4().makeBasis(r.f.clone().cross(r.u), r.u, r.f.clone().negate()); // columnas x,y,z del arma en el espacio de la muñeca
    w.grip.quaternion.setFromRotationMatrix(z);
    w.grip.rotation.x += GRIP.tilt; w.grip.position.copy(r.f).multiplyScalar(GRIP.fwd).addScaledVector(r.u, GRIP.up);
    h.position.set(0, 0, 0); h.scale.setScalar(Math.max(0.001, k === 0 ? 1 : k));
    w.grip.position.z += kick * 0.05; // retroceso
  }
  const GRIP = { fwd: 0.07, up: 0.0, tilt: 0 };

  // ---------------------------------------------------------------- gestos (señalar, saludar)
  let gest = null;
  /** gesture('ping', { target: Vector3 en el mundo, time: 1.6 }) señala con el brazo derecho · gesture('wave') saluda · gesture(null) cancela. */
  function gesture(name, { target = null, time = 1.8 } = {}) { gest = name ? { name, t: 0, dur: time, target: target ? target.clone() : null } : null; return api; }
  const ik = { w: 0, g: 0 };
  let postOv = null;   // update(dt, { post(bones, group, dt) }): se ejecuta después del mezclador, antes del IK de la mano libre

  // ---------------------------------------------------------------- IK de la mano izquierda (guardamano) y gestos del brazo derecho
  function overlay(bones, group, dt) {
    if (postOv) { postOv(bones, group, dt); group.updateMatrixWorld(true); }   // pose extra del llamador (golpes del modo Combo: combo-anim.js); el IK de la mano libre y los gestos van después
    const lay = actor.layerClips, aiming = lay?.upper === 'aimIdle', hold = wCur && wCur.holder.parent && wCur.holder.visible;
    ik.w += ((aiming && hold && !gest ? 1 : 0) - ik.w) * Math.min(1, dt * 9);
    if (hold) place(wCur, swap ? swapScale() : 1);
    if (hold && ik.w > 0.02 && bones.upperarm01_L_h) {
      // guardamano: delante de la empuñadura, bajo el cañón; la muñeca queda 6 cm detrás de ese punto, orientada como el arma
      const gz = -Math.min(0.3, Math.max(0.12, wCur.len * 0.38 / wCur.s)) ;
      wCur.grip.updateWorldMatrix(true, false);
      _v.set(0.0, -0.045, gz); wCur.grip.localToWorld(_v);
      _v2.set(0, 0, -1).transformDirection(wCur.grip.matrixWorld).normalize();   // dirección del cañón
      _v3.set(0, 1, 0).transformDirection(wCur.grip.matrixWorld).normalize();    // arriba del arma
      _v.addScaledVector(_v2, -0.055);
      _v4.set(1, 0, 0).transformDirection(group.matrixWorld).multiplyScalar(0.5).y -= 1; _v4.normalize(); // el codo cae hacia abajo y un poco hacia afuera
      twoBoneIK(bones.upperarm01_L_h, bones.lowerarm01_L_h, bones.wrist_L_h, _v, _v4, ik.w);
      const l = basis.L; setWorldQuatSlerp(bones.wrist_L_h, basisQuat(l.f, l.u, _v2, _v3), ik.w);
    }
    if (gest) {
      gest.t += dt; const e = Math.min(smooth(gest.t / 0.25), smooth((gest.dur - gest.t) / 0.35)); ik.g = e;
      if (gest.t >= gest.dur) gest = null;
      if (e > 0.01 && bones.upperarm01_R_h) {
        const sh = bones.upperarm01_R_h.getWorldPosition(_v);
        const fwd = _v2.set(0, 0, 1).transformDirection(group.matrixWorld), rightDir = _v3.set(-1, 0, 0).transformDirection(group.matrixWorld);
        const tgt = new T.Vector3();
        if (gest.name === 'ping') {
          const d = gest.target ? gest.target.clone().sub(sh).normalize() : fwd.clone().add(new T.Vector3(0, 0.1, 0)).normalize();
          tgt.copy(sh).addScaledVector(d, 0.58);
          twoBoneIK(bones.upperarm01_R_h, bones.lowerarm01_R_h, bones.wrist_R_h, tgt, rightDir.clone().multiplyScalar(0.5).add(new T.Vector3(0, -0.5, 0)), e);
          const r = basis.R; setWorldQuatSlerp(bones.wrist_R_h, basisQuat(r.f, r.u, d, new T.Vector3(0, 1, 0)), e);
        } else { // saludo: mano a la altura de la cabeza, oscilando
          const sway = Math.sin(gest.t * 9) * 0.07;
          tgt.copy(sh).addScaledVector(rightDir, 0.14 + sway).addScaledVector(fwd, 0.12).add(new T.Vector3(0, 0.34, 0));
          twoBoneIK(bones.upperarm01_R_h, bones.lowerarm01_R_h, bones.wrist_R_h, tgt, rightDir.clone().multiplyScalar(0.8).add(new T.Vector3(0, -0.4, 0)), e);
          const r = basis.R; setWorldQuatSlerp(bones.wrist_R_h, basisQuat(r.f, r.u, new T.Vector3(0, 1, 0).addScaledVector(fwd, 0.2).normalize(), rightDir.clone().negate()), e * 0.8);
        }
      }
    }
  }
  function setWorldQuatSlerp(bone, q, w) {
    if (w >= 0.999) return setWorldQuat(bone, q);
    bone.getWorldQuaternion(_q); _q.slerp(q, w); setWorldQuat(bone, _q);
  }
  const swapScale = () => { if (!swap) return 1; return swap.phase === 0 ? Math.max(0.001, 1 - swap.t / 0.13) : Math.max(0.001, smooth(swap.t / 0.2)); };

  const ready = actor.ready.then(() => { if (!disposed) decorate(); return api; });
  ready.catch((e) => console.error('[humans] no se pudo armar', spec, e));

  // ---------------------------------------------------------------- estado de locomoción (histéresis de los saltos de clip)
  let loco = 'idle', legYaw = 0;
  function locomotion(speed) {
    const th = { walk: loco === 'idle' ? 0.3 : 0.18, jog: loco === 'walk' ? 1.9 : 1.5, sprint: loco === 'sprint' ? 5.0 : 5.6 };
    let k = speed < th.walk ? 'idle' : speed < th.jog ? 'walk' : speed < th.sprint ? 'jog' : 'sprint';
    loco = k;
    const ts = k === 'idle' ? 1 : T.MathUtils.clamp(speed / CLIP_SPEED[k], k === 'walk' ? 0.55 : 0.65, k === 'walk' ? 1.9 : k === 'jog' ? 1.4 : 1.7);
    return [k, ts];
  }

  const api = {
    object: root, ready, actor,
    get clip() { return current; },
    get bones() { return actor.bones; },
    get weapon() { return weaponIndex; },
    get role() { return role; },
    get char() { return char; },
    get layers() { return actor.layerClips; },
    /**
     * Pide un clip (nombres: ver CLIP_NAMES y alias). idle/walk/jog/sprint/aim/aimIdle/shoot son «de locomoción»: las piernas siguen a la
     * velocidad real (update({speed})) y, con arma, el torso apunta; los demás (fall, death, revive, interact, cast, reload, hit, jump…) son de cuerpo entero.
     * fade en segundos; restart reinicia si ya estaba (p. ej. otro disparo; 'shoot' además dispara el fogonazo).
     */
    play(name, { fade = null, restart = false } = {}) {
      const key = ALIAS[name] || name; if (!actor.hasClip(key) && actor.status === 'ready') { console.warn('[humans] clip desconocido:', name); return api; }
      if (key !== current || restart) pending = { fade, restart };
      if (key === 'shoot' && restart) api.shoot();
      current = key; return api;
    },
    /** Cambia el arma en la mano (índice como createWeaponModel; null = desarmado). El cambio se ve: baja la vieja y sube la nueva con un destello. */
    setWeapon(i) { if (i === weaponIndex && wCur) return api; if (actor.status === 'ready' && gear) attachWeapon(i); else weaponIndex = i; return api; },
    /** Disparo: retroceso del cuerpo y del arma + fogonazo en la boca. */
    shoot() { kick = 1; flashT = 1; return api; },
    /** gesture('ping', { target: Vector3 }) señala · gesture('wave') saluda · gesture(null) cancela. */
    gesture,
    /** Cambia el rol (equipo y ropa); vuelve a armar. */
    async setRole(r) { role = ROLES.includes(r) ? r : null; await actor.setDefinition(definition()); if (!disposed) decorate(); return api; },
    /**
     * Un cuadro. opts: {
     *   speed (m/s reales: elige idle/walk/jog/sprint y ajusta el paso), moveDir {x,z} o [x,z] (dirección de movimiento relativa a hacia dónde mira: z adelante,
     *   x derecha; strafe y retroceso), pitch (rad, + = mira arriba: el torso y el arma lo siguen), look (Vector3 mundo a mirar, false = nada), camera (LOD),
     *   firing (bool: el arma «carga»), cull, snap }.
     */
    update(dt, opts = {}) {
      time += dt; tstate.value += dt;
      postOv = opts.post || null;
      const p = pending; pending = null;
      const armed = weaponIndex != null && !!wCur && !NO_WEAPON.has(current) && !gest;
      if (wCur) wCur.holder.visible = armed && !(swap && swap.phase === 0 && swap.t > 0.12);
      // --- qué clip lleva cada capa
      const speed = opts.speed != null ? Math.max(0, opts.speed) : null;
      let motion = current, lower = null, upper = null, mSpeed = 1, uSpeed = null;
      if (LOCO_REQ.has(current) || AIM_REQ.has(current)) {
        let lk, ts = 1;
        if (current === 'crouch' || current === 'crouchWalk') lk = speed != null && speed > 0.4 ? 'crouchWalk' : 'crouch';
        else if (speed != null) [lk, ts] = locomotion(speed);
        else { lk = AIM_REQ.has(current) ? 'idle' : current; ts = current === 'walk' ? 1 : 1; }
        // dirección: strafe / retroceso (las piernas giran y el torso lo compensa; hacia atrás el ciclo corre al revés)
        const md = opts.moveDir, mx = md ? (Array.isArray(md) ? md[0] : md.x) : 0, mz = md ? (Array.isArray(md) ? md[1] : md.z) : 1;
        let psi = 0, back = false;
        if (lk !== 'idle' && lk !== 'crouch' && (mx || mz !== 1)) {
          const a = Math.atan2(-mx, mz); back = Math.abs(a) > Math.PI / 2 + 0.05;
          psi = back ? (a > 0 ? a - Math.PI : a + Math.PI) : a; psi = T.MathUtils.clamp(psi, -1.15, 1.15);
        }
        legYaw = psi;
        if (back) ts = -ts;
        if (armed) { lower = lk; upper = 'aimIdle'; mSpeed = ts; uSpeed = 1; }
        else if (AIM_REQ.has(current) && speed == null) { motion = current; lower = null; }
        else { motion = lk; mSpeed = ts; uSpeed = ts; }
      } else { legYaw = 0; }
      if (gest && (LOCO_REQ.has(current) || AIM_REQ.has(current))) upper = gest.name === 'wave' ? 'talk' : 'idle';
      // --- ángulo de apuntado
      let pitch = opts.pitch || 0;
      if (!pitch && opts.look && opts.look.isVector3) { root.getWorldPosition(_v); const d = _v2.copy(opts.look).sub(_v); d.y -= 1.45; pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); }
      // --- retroceso y fogonazo
      kick = Math.max(0, kick - dt * 7);
      if (swap) { swap.t += dt; if (swap.phase === 0 && swap.t >= 0.13) { swap.fn(); swap = { t: 0, phase: 1, flash: true }; flashT = Math.max(flashT, 0.7); } else if (swap.phase === 1 && swap.t >= 0.2) swap = null; }
      actor.update(dt, { motion, lower, upper, motionSpeed: mSpeed, upperSpeed: uSpeed, legYaw, pitch: armed || pitch ? pitch : 0, kick: armed ? kick : 0, look: opts.look ?? false,
        camera: opts.camera || null, cull: !!opts.cull, snap: !!opts.snap, fade: p?.fade ?? null, restart: !!p?.restart, overlay });
      // --- arma: animación propia (anillos, cristales) y fogonazo
      if (wCur) {
        const tick = wCur.model.userData.tick; if (tick) try { tick(dt, time, !!opts.firing); } catch { /* arma ajena */ }
        flashT = Math.max(0, flashT - dt * 14); wCur.flash.material.opacity = flashT; wCur.flash.scale.setScalar((0.45 + 0.35 * Math.sin(time * 90) ** 2) * (flashT > 0 ? 1 : 0.001) / wCur.s);
      }
      gear?.update(dt, { speed: speed ?? 0, t: time });
      void firing;
    },
    /** Cambia el aspecto: { color, accent, hair, hairColor, outfit, skinTint… }. Vuelve a armar (asíncrono). */
    async setLook(patch = {}) {
      look = { ...look, ...patch };
      if (Object.keys(patch).every((k) => k === 'accent') && gear) { gear.setColor(col(look.accent ?? look.color)); return api; }
      await actor.setDefinition(definition()); if (!disposed) decorate(); return api;
    },
    /** { drawCalls, triangles, materials } de esta persona (con equipo y arma; sin contar lo ya oculto por LOD). */
    stats() { return actor.stats(); },
    dispose() {
      disposed = true; gear?.dispose(); for (const w of weaponCache.values()) { w.holder.removeFromParent(); w.model.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => m.dispose?.()); }); }
      weaponCache.clear(); actor.dispose(); root.removeFromParent(); kit.humans.delete(root);
    },
  };
  return api;
}

/** Libera las texturas compartidas del kit (llamar al cerrar la escena, después de dispose() de cada persona). */
export function disposeHumanKit(kit) { kit.store.dispose(); }
