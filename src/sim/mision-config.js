// DEFINICIÓN DECLARATIVA DE MISIONES (campaña y misiones independientes). Una sola fuente de verdad para:
//   · cuántas oleadas/etapas tiene cada misión («Oleada X/Y»), de qué tipo es cada una y con qué criaturas;
//   · el objetivo obligatorio de cada etapa, los objetivos secundarios opcionales y el jefe o desafío final;
//   · la duración objetivo (se valida midiendo con bots: tools/audit/medicion-capitulos.mjs y tests/mision-duracion.test.js);
//   · los LÍMITES DUROS de tiempo: nada es infinito (docs/MISIONES.md). La única excepción es el Campo de pruebas, que se declara
//     aquí mismo como modo aparte (MODOS_APARTE) y nunca es una misión.
// Sin lógica del juego: sólo datos y validadores puros (sin DOM, sin azar). game.js, objectives.js y operations.js los consumen.

/** Tipos de etapa. `combate` = eliminar a todos; `caza` = custodio marcado; `mecanismo` = reconexión/sintonía/núcleo/cultivo;
 *  `defensa` = ancla; `cronometrada` = resistir un tiempo; `evento` = combate con un evento ambiental forzado; `jefe` = encuentro final. */
export const TIPOS_ETAPA = Object.freeze(['combate', 'caza', 'mecanismo', 'defensa', 'cronometrada', 'evento', 'jefe']);
/** Objetivo (objectives.js) que lleva cada tipo de etapa (null = sólo hay que eliminar a las criaturas). */
export const OBJETIVOS_DE = Object.freeze({
  combate: [null], evento: [null], jefe: [null],
  caza: ['caza'], defensa: ['ancla'], cronometrada: ['resistir'], mecanismo: ['secuencia', 'sintonia', 'nucleo', 'cultivo'],
});

/** Modos que NO son misiones. El Campo de pruebas es el único sin final, y por eso está declarado a propósito. */
export const MODOS_APARTE = Object.freeze({
  practica: { nombre: 'Campo de pruebas', sinFin: true, razon: 'Entrenamiento: sin oleadas, vida y munición ilimitadas. No da recompensas de campaña y nunca se usa como misión.' },
  santuario: { nombre: 'El Santuario', sinFin: true, razon: 'Mapa-hub sin oleadas (src/sim/base.js). No es una misión.' },
});

/** Límites duros por defecto (s de simulación). Una misión puede declarar los suyos en `limites`. */
export const LIMITES = Object.freeze({
  etapa: 150,       // etapa de combate/evento sin objetivo: pasado el tope la red «se repliega» (se desintegra a los rezagados) y se pasa a la siguiente
  jefe: 450,        // el encuentro final: al agotarse, derrota «Tiempo agotado»
  mision: 1500,     // la misión completa (25 min de reloj de simulación): al agotarse, derrota «Tiempo agotado»
  elegirMejora: 20, // en solitario el intermedio espera tu elección como máximo esto; luego se elige sola (nadie puede congelar la partida)
});
/** Descansos entre etapas (s). GDD §4: orientativos de 10–20 s con tres mejoras a elegir. */
export const DESCANSO = Object.freeze({ solo: 14, coop: 20, rapido: 12 });

/* ───────── textos de las etapas (los ve el jugador: español) ───────── */
export const TEXTO = Object.freeze({
  combate: ['Despejar la zona', 'Eliminá a todas las criaturas que envía la red. Mantenete en movimiento y aprovechá la cobertura.'],
  evento: ['Anomalía del vórtice', 'Un evento ambiental altera la arena mientras la red ataca. Leé el aviso, aprovechá su contrapartida y eliminá a todas las criaturas.'],
  cronometrada: ['Resistir el asedio', 'Sobreviví hasta que termine la cuenta regresiva: la red envía criaturas sin pausa. Al llegar a cero el asedio se rompe.'],
  secuencia: ['Reconectar el archivo', 'Seguí la flecha: ocupá cada terminal indicado durante 2 segundos.'],
  sintonia: ['Sintonizar las placas', 'Pisá todas las placas a la vez durante 3 segundos. Solo: cada placa queda viva 10 s tras salir.'],
  ancla: ['Proteger la zona segura', 'Permanecé en el círculo y mantenelo libre de enemigos durante 35 segundos acumulados. Si destruyen el ancla, la misión fracasa.'],
  nucleo: ['Extraer el archivo de memoria', 'Recogé el núcleo de memoria y transportalo al altar de salida. No podés disparar mientras lo llevás; si caés, otro jugador puede recuperarlo.'],
  caza: ['Romper el bloqueo', 'Eliminá al custodio marcado para desactivar las defensas de la IA.'],
  cultivo: ['Abrir el puente vivo', 'Alimentá a los tres capullos (disparándoles o golpeándolos) hasta que florezcan y defendelos de las criaturas.'],
});

const E = (kind, objetivo, o) => {
  const [title, desc] = TEXTO[objetivo || kind] || TEXTO[kind];
  return { kind, objective: objetivo, title, desc, ...o };
};
/** Constructores de etapa. Campos comunes: plan (0..5, índice en WAVE_PLANS[mapa]), tier (intensidad: presupuesto y vida de las criaturas),
 *  span (s en que se reparte la oleada), budget (multiplicador del presupuesto), cap (tope de la etapa), bonus (misión secundaria opcional). */
const combate = (o) => E('combate', null, { span: 50, ...o });
const evento = (o) => E('evento', null, { span: 55, ...o });
const resistir = (o) => E('cronometrada', 'resistir', { dur: 60, span: 60, ...o });
const mecanismo = (obj, o) => E('mecanismo', obj, { span: 45, ...o });
const defensa = (o) => E('defensa', 'ancla', { span: 45, ...o });
const caza = (o) => E('caza', 'caza', { span: 45, ...o });
const DERROTA = 'Todo el equipo cae, se agota el tiempo de un objetivo, del encuentro final o de la misión.';
const jefe = (o) => ({ kind: 'jefe', objective: null, title: 'Encuentro final', desc: 'Derrotá al jefe de la arena. Aprende de tu estilo: alterná tus herramientas y leé las marcas del suelo.', span: 40, budget: 0.45, ...o });

/**
 * LAS SEIS MISIONES. `id` = id del mapa (src/sim/maps.js). El orden de la campaña vive en campaign.js.
 * `boss`: cuerpo del jefe (data.js MONSTERS) y su enfurecimiento (IA.enrageT por defecto = 600 s; en misiones, mucho antes).
 * `duracion`: [mín, máx] minutos de simulación con un bot competente (los humanos tardan más: el tope duro de la misión lo contempla).
 */
export const MISIONES = Object.freeze({
  m1: {
    duracion: [8, 12], boss: { kind: 'coloso', enrageT: 90, enrageCoop: 30 },
    victoria: 'Superá las ocho oleadas, recuperá tu identidad y derrotá al Coloso.',
    derrota: DERROTA,
    stages: [
      combate({ plan: 0, tier: 1.0, span: 80 }),
      mecanismo('secuencia', { plan: 1, tier: 1.4 }),
      defensa({ plan: 1, tier: 1.8 }),
      resistir({ plan: 2, tier: 2.2, dur: 90 }),
      mecanismo('nucleo', { plan: 2, tier: 2.6, title: 'Recuperar tu identidad' }),
      combate({ plan: 3, tier: 3.0, span: 80 }),
      evento({ plan: 3, tier: 3.4, span: 80 }),
      jefe({ plan: 3, tier: 3.8 }),
    ],
  },
  m3: {
    duracion: [8, 12], boss: { kind: 'argos', enrageT: 90, enrageCoop: 30 },
    victoria: 'Apagá la vigilancia del Laberinto, superá las ocho oleadas y derrotá a Argos.',
    derrota: DERROTA,
    stages: [
      mecanismo('secuencia', { plan: 0, tier: 1.0 }),
      caza({ plan: 1, tier: 1.4 }),
      combate({ plan: 1, tier: 1.8, span: 80 }),
      defensa({ plan: 2, tier: 2.2 }),
      resistir({ plan: 2, tier: 2.6, dur: 90 }),
      combate({ plan: 3, tier: 3.0, span: 80 }),
      evento({ plan: 4, tier: 3.4, span: 80 }),
      jefe({ plan: 4, tier: 3.8 }),
    ],
  },
  m4: {
    duracion: [8, 12], boss: { kind: 'argos', enrageT: 90, enrageCoop: 30 },
    victoria: 'Hacé crecer el puente vivo, extraé el archivo, superá las ocho oleadas y derrotá a Argos, el Ojo Primordial.',
    derrota: DERROTA,
    stages: [
      mecanismo('cultivo', { plan: 0, tier: 1.0 }),
      combate({ plan: 1, tier: 1.4, span: 80 }),
      defensa({ plan: 2, tier: 1.8 }),
      resistir({ plan: 2, tier: 2.2, dur: 90 }),
      mecanismo('nucleo', { plan: 3, tier: 2.6 }),
      combate({ plan: 3, tier: 3.0, span: 80 }),
      evento({ plan: 4, tier: 3.4, span: 80 }),
      jefe({ plan: 4, tier: 3.8 }),
    ],
  },
  m5: {
    duracion: [8, 12], boss: { kind: 'coloso', enrageT: 90, enrageCoop: 30 },
    victoria: 'Restaurá el archivo de recuerdos de la Plaza, superá las ocho oleadas y derrotá al Mandinga del Reloj.',
    derrota: DERROTA,
    stages: [
      mecanismo('secuencia', { plan: 0, tier: 1.0 }),
      combate({ plan: 1, tier: 1.4, span: 80 }),
      mecanismo('nucleo', { plan: 2, tier: 1.8 }),
      resistir({ plan: 2, tier: 2.2, dur: 90 }),
      defensa({ plan: 3, tier: 2.6 }),
      combate({ plan: 3, tier: 3.0, span: 80 }),
      evento({ plan: 4, tier: 3.4, span: 80 }),
      jefe({ plan: 4, tier: 3.8 }),
    ],
  },
  m6: {
    duracion: [8, 12], boss: { kind: 'argos', enrageT: 90, enrageCoop: 30 },
    victoria: 'Recuperá el vínculo genómico del Osario, superá las ocho oleadas y derrotá al Basilisco.',
    derrota: DERROTA,
    stages: [
      mecanismo('secuencia', { plan: 0, tier: 1.0 }),
      combate({ plan: 1, tier: 1.4, span: 80 }),
      caza({ plan: 2, tier: 1.8 }),
      resistir({ plan: 3, tier: 2.2, dur: 90 }),
      mecanismo('nucleo', { plan: 3, tier: 2.6, title: 'Recuperar el vínculo genómico' }),
      combate({ plan: 4, tier: 3.0, span: 80 }),
      evento({ plan: 4, tier: 3.4, span: 80 }),
      jefe({ plan: 4, tier: 3.8 }),
    ],
  },
  m2: {
    duracion: [8, 12], boss: { kind: 'madre', enrageT: 90, enrageCoop: 30 },
    victoria: 'Abrí el canal de salida, superá las ocho oleadas y derrotá a la Madre Geoda.',
    derrota: DERROTA,
    stages: [
      caza({ plan: 0, tier: 1.0 }),
      combate({ plan: 1, tier: 1.4, span: 80 }),
      mecanismo('secuencia', { plan: 2, tier: 1.8 }),
      resistir({ plan: 3, tier: 2.2, dur: 90 }),
      mecanismo('nucleo', { plan: 3, tier: 2.6 }),
      combate({ plan: 4, tier: 3.0, span: 80 }),
      evento({ plan: 4, tier: 3.4, span: 80 }),
      jefe({ plan: 4, tier: 3.8 }),
    ],
  },
});

/** Configuración resuelta de una misión: aplica los valores por defecto (límites, descansos, recompensas). null si el mapa no tiene misión. */
export function misionConfig(id) {
  const m = MISIONES[id]; if (!m) return null;
  if (m.__r) return m.__r;
  const r = {
    id, duracion: m.duracion, victoria: m.victoria, derrota: m.derrota, boss: m.boss,
    limites: { ...LIMITES, ...(m.limites || {}) }, descanso: { ...DESCANSO, ...(m.descanso || {}) },
    stages: m.stages.map((s, i) => ({ n: i + 1, bonus: null, cap: null, budget: 1, reward: null, ...s })),
  };
  Object.defineProperty(m, '__r', { value: Object.freeze(r), enumerable: false });
  return r;
}
/** Núcleos extra que cobra cada jugador al VENCER la misión (además de los de cada etapa). */
export const PREMIO_MISION = 120;
/** Núcleos de una etapa superada (data.js CORES.wave + 2 por número de etapa) salvo que la etapa declare `reward`. */
export const premioEtapa = (stage, base) => (stage.reward != null ? stage.reward : base);

/** ¿Es una etapa con objetivo obligatorio (cuenta como «paso» de la misión)? */
export const esPaso = (s) => s.kind === 'mecanismo' || s.kind === 'defensa' || s.kind === 'caza';

/**
 * Valida una definición. Devuelve la lista de problemas (vacía = correcta). Lo usan los tests y se puede llamar desde herramientas.
 * Reglas: finita; entre 5 y 8 etapas; sólo la última es el jefe; objetivos coherentes con el tipo; todos los tiempos acotados.
 */
export function validarMision(id, planes = null) {
  const e = [], m = misionConfig(id);
  if (!m) return [`${id}: sin definición de misión`];
  const L = m.limites;
  if (!(m.stages.length >= 5 && m.stages.length <= 8)) e.push(`${id}: ${m.stages.length} etapas (se esperan 5–8)`);
  m.stages.forEach((s, i) => {
    const ult = i === m.stages.length - 1;
    if (!TIPOS_ETAPA.includes(s.kind)) e.push(`${id}#${s.n}: tipo desconocido ${s.kind}`);
    if (!(OBJETIVOS_DE[s.kind] || []).includes(s.objective)) e.push(`${id}#${s.n}: objetivo ${s.objective} no corresponde a ${s.kind}`);
    if ((s.kind === 'jefe') !== ult) e.push(`${id}#${s.n}: el jefe debe ser la última etapa (y la única)`);
    if (!(s.tier >= 1)) e.push(`${id}#${s.n}: tier inválido`);
    if (!(s.span > 0 && s.span <= 120)) e.push(`${id}#${s.n}: span inválido`);
    if (s.kind === 'cronometrada' && !(s.dur >= 20 && s.dur <= 150)) e.push(`${id}#${s.n}: duración de asedio fuera de 20–150 s`);
    if (!Number.isInteger(s.plan) || s.plan < 0 || (planes && s.plan >= planes.length)) e.push(`${id}#${s.n}: plan fuera de rango`);
    if (!s.title || !s.desc) e.push(`${id}#${s.n}: sin título o descripción`);
  });
  if (!m.boss || !m.boss.kind || !(m.boss.enrageT > 0 && m.boss.enrageT < L.jefe)) e.push(`${id}: el jefe necesita enfurecimiento (enrageT) antes del tope del encuentro`);
  if (!(L.etapa > 0 && L.etapa < Infinity && L.jefe > 0 && L.jefe < Infinity && L.mision > 0 && L.mision < Infinity && L.elegirMejora > 0 && L.elegirMejora < Infinity)) e.push(`${id}: límites no finitos`);
  if (!(m.duracion[0] >= 5 && m.duracion[1] <= 15 && m.duracion[0] < m.duracion[1])) e.push(`${id}: duración objetivo fuera de 5–15 min`);
  if (!m.victoria || !m.derrota) e.push(`${id}: faltan condiciones de victoria o derrota`);
  return e;
}

/** Ritmo de campaña: un tramo de combate algo más sostenido, sin tocar jefes/objetivos ni contratos cooperativos. */
export function campaignConfig(id) {
  const original = misionConfig(id); if (!original) return null;
  return { ...original, stages: original.stages.map(s => ['combate', 'evento'].includes(s.kind)
    ? { ...s, span: Math.min(110, s.span + 15), budget: s.budget * 1.2 }
    : { ...s }) };
}
