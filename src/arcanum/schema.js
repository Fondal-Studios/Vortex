// ARCANUM NPC FACTORY — definición de NPC como datos + validación (sin dependencias de navegador).
// Un NPC importante se guarda como definición concreta (src/content/npcs.js); nunca se aleatoriza en runtime.
import { SLOTS, ACCESSORIES, ATTACH_POINTS, HAIR, HEADWEAR, BASES, QUALITY_TIERS, ROLES, ANIMATION_SETS, REQUIRED_CLIPS } from './library.js';

export const BODY_RANGES = {
  height: [0.85, 1.15], width: [0.85, 1.18], shoulders: [0.9, 1.12], belly: [0, 1], head: [0.92, 1.08], jaw: [0.85, 1.15], nose: [0.85, 1.2],
};
export const DEFAULT_BODY = { height: 1, width: 1, shoulders: 1, belly: 0, head: 1, jaw: 1, nose: 1 };

export const NPC_TEMPLATE = {
  id: '', name: '', role: 'poblacion', base: 'masculino-adulto', skin: 'adulto-m', skinTint: null,
  body: { ...DEFAULT_BODY },
  hair: 'short02', hairColor: '#3a2c22', eyebrows: 'eyebrow010', beard: 'ninguna', beardColor: null,
  outfit: 'male_casualsuit01', layer: 'ninguna', cape: 'ninguna', hat: 'ninguno', gloves: 'ninguno', boots: 'ninguna', belt: 'ninguno',
  staff: 'ninguno', wand: 'ninguna', grimoire: 'ninguno', accessories: [],
  palette: 'ciudad', colors: {}, magicAffinity: 'neutral', animationSet: 'sereno', qualityTier: 'auto',
};

const HEX = /^#[0-9a-f]{6}$/i;
const clone = (o) => JSON.parse(JSON.stringify(o));

// Completa campos ausentes con la plantilla (no corrige errores: eso lo informa validateNPC).
export function normalizeNPC(def) {
  const out = { ...clone(NPC_TEMPLATE), ...clone(def || {}) };
  out.body = { ...DEFAULT_BODY, ...(def?.body || {}) };
  out.colors = { ...(def?.colors || {}) };
  out.accessories = [...(def?.accessories || [])];
  if (!def?.skin && BASES[out.base]) out.skin = BASES[out.base].piel;
  if (!out.beardColor) out.beardColor = out.hairColor;
  return out;
}

// Resultado de la composición: qué piezas quedan visibles tras aplicar reglas de compatibilidad.
export function resolveVisibility(def) {
  const hat = HEADWEAR[def.hat] || HEADWEAR.ninguno, hair = HAIR[def.hair] || HAIR.ninguno;
  return {
    hair: hat.cubreCabello ? hair.bajoCapucha && !!hair.mesh : !!hair.mesh,
    shoes: !def.boots || def.boots === 'ninguna',
  };
}

/** Valida una definición. Devuelve {errors, warnings}. Un NPC con errores no debe generarse ni registrarse. */
export function validateNPC(input, { bones = null, clips = null } = {}) {
  const errors = [], warnings = [], def = normalizeNPC(input);
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(def.id)) errors.push('id inválido: usar minúsculas, números y guiones (2–48)');
  if (typeof def.name !== 'string' || !def.name.trim()) errors.push('Falta el nombre');
  if (!ROLES.includes(def.role)) errors.push(`Rol desconocido: ${def.role}`);
  for (const [slot, table] of Object.entries(SLOTS)) {
    const v = def[slot];
    if (v == null || !Object.prototype.hasOwnProperty.call(table, v)) errors.push(`Pieza inexistente en «${slot}»: ${v}`);
  }
  for (const [k, [lo, hi]] of Object.entries(BODY_RANGES)) {
    const v = def.body[k];
    if (!Number.isFinite(v)) errors.push(`Proporción «${k}» no numérica`);
    else if (v < lo || v > hi) errors.push(`Escala incorrecta: ${k}=${v} fuera de [${lo}, ${hi}]`);
  }
  for (const k of ['hairColor', 'beardColor']) if (def[k] != null && !HEX.test(def[k])) errors.push(`Color inválido en ${k}: ${def[k]}`);
  if (def.skinTint != null && !HEX.test(def.skinTint)) errors.push('Tinte de piel inválido');
  for (const [k, v] of Object.entries(def.colors)) if (!HEX.test(v)) errors.push(`Color de material faltante o inválido: ${k}`);
  if (!QUALITY_TIERS.includes(def.qualityTier)) errors.push(`Nivel de calidad desconocido: ${def.qualityTier}`);

  // Accesorios: existencia, duplicados, anclajes y requisitos.
  if (!Array.isArray(def.accessories)) errors.push('accessories debe ser una lista');
  else {
    const seen = new Set();
    for (const a of def.accessories) {
      if (!ACCESSORIES[a]) { errors.push(`Accesorio inexistente: ${a}`); continue; }
      if (seen.has(a)) errors.push(`Pieza duplicada: ${a}`); seen.add(a);
      const req = ACCESSORIES[a].requiere;
      if (req === 'belt' && (!def.belt || def.belt === 'ninguno')) errors.push(`${ACCESSORIES[a].label} necesita un cinturón`);
    }
    if (seen.has('estola') && seen.has('cuello-alto')) warnings.push('Estola y cuello alto se superponen en el cuello');
    if (seen.has('gafas') && def.hat === 'capucha') warnings.push('Gafas bajo capucha: revisar encuadre frontal');
  }

  // Manos: una pieza por mano.
  const hands = { manoDer: [], manoIzq: [] };
  if (def.staff && def.staff !== 'ninguno') hands.manoDer.push('báculo');
  if (def.wand && def.wand !== 'ninguna') hands.manoDer.push('varita');
  if (def.grimoire === 'mano') hands.manoIzq.push('grimorio');
  for (const [h, items] of Object.entries(hands)) if (items.length > 1) errors.push(`Attachment incorrecto: ${items.join(' y ')} en la misma mano (${h})`);

  // Compatibilidades conocidas.
  const hat = HEADWEAR[def.hat], hair = HAIR[def.hair];
  if (hat && hair) {
    if (hat.cubreCabello && hair.mesh && !hair.bajoCapucha) warnings.push(`La capucha oculta el cabello «${hair.label}» para evitar que lo atraviese`);
    if (hat.tipo === 'sombrero' && !hair.bajoSombrero) errors.push(`Incompatibilidad: «${hat.label}» atraviesa «${hair.label}»`);
  }
  if (def.layer === 'mandil' && def.cape === 'larga') warnings.push('Mandil y capa larga: revisar silueta trasera');
  if (def.beard !== 'ninguna' && BASES[def.base]?.sexo === 'f') warnings.push('Barba en arquetipo femenino: válido, verificar intención');

  // Rig y animación: cuando se dispone del esqueleto real (node test o runtime) se comprueban huesos y clips.
  if (bones) for (const [p, b] of Object.entries(ATTACH_POINTS)) if (b && !bones.has(b)) errors.push(`Rig incompatible: falta el hueso ${b} (${p})`);
  const set = ANIMATION_SETS[def.animationSet];
  if (set && clips) for (const c of new Set([set.reposo, set.demostrar, ...REQUIRED_CLIPS])) if (!clips.has(c)) errors.push(`Animación incompatible: falta el clip ${c}`);
  return { errors, warnings, def };
}

export function assertNPC(def, opts) {
  const r = validateNPC(def, opts);
  if (r.errors.length) throw Error(`NPC «${def?.id || '?'}» inválido:\n- ` + r.errors.join('\n- '));
  return r.def;
}
