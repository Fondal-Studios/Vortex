// REGLA DE RECOMPENSAS (GDD §4 y §7): qué se paga al GANAR, qué se paga (parcial) al PERDER y cómo se reparte en cooperativo.
// Datos puros y deterministas (sin DOM, sin azar, sin perfil). Lo usan el perfil (src/client/perfil.js → cerrarPartida), el servidor (server/server.js → mensaje `fin`)
// y la pantalla de resultados (src/sim/resultados.js). Tabla y justificación en docs/RECOMPENSAS.md.
//
// Palabras: «biomasa» = esencias (carne/cristal/ojo/vacío). Es un banco que el jugador ARRASTRA de partida en partida (lo que sobra vuelve al banco),
// no un premio de fin de misión: por eso no se recorta al perder (recortarlo castigaría lo que ya tenía guardado).

/** Parámetros. Todo lo que se pueda ajustar sin tocar código está acá. */
export const REGLAS = {
  /** DERROTA: fracciones del premio completo. El avance (etapas superadas / total) las sube entre el mínimo y el máximo; jamás llegan a 1. */
  derrota: {
    cores: [0.25, 0.6],          // núcleos ganados en la partida
    recursos: [0.25, 0.75],      // materiales y semillas del botín (por cada pila: mínimo 1 si se superó alguna etapa)
    xp: 0.5,                     // XP de maestría por bajas y etapas (sin el bono de victoria)
    arbol: 0.5,                  // puntos de los árboles de combos / disparo
  },
  /** XP extra por hitos de la misión (se suma al perder; al ganar ya están en la XP completa). Con tope. */
  xpHito: { etapa: 10, objetivo: 20, secundario: 15, elite: 8, tope: 150 },
  /** COOPERATIVO */
  coop: {
    base: 1,                     // recompensa base: igual para todo participante legítimo
    bonoMax: 0.25,               // el bono por contribución suma como máximo +25 %
    afkBase: 0.5,                // sin contribución mínima: base al 50 % y sin bono
    minTiempo: 20,               // segundos presentes para contar como participante
    // aporte mínimo (cualquiera de estos basta): evita premiar a quien se queda parado
    minimo: { dmg: 150, obj: 1, sup: 2, rev: 1, elite: 1, bajas: 3 },
    // pesos por categoría: IGUALES a propósito (el daño no vale más que apoyar o reanimar)
    categorias: ['dmg', 'obj', 'sup', 'rev'],
  },
};

/** Lo que SÓLO se obtiene al completar la misión (se muestra en la pantalla de resultados y en docs/RECOMPENSAS.md). */
export const SOLO_VICTORIA = [
  { id: 'principal', texto: 'Recompensa principal de la misión (núcleos y XP completos)' },
  { id: 'avance', texto: 'Avance de capítulo de la campaña' },
  { id: 'huespedes', texto: 'Desbloqueo de huéspedes ligados a la misión' },
  { id: 'territorio', texto: 'Territorio liberado y su bendición' },
  { id: 'raro', texto: 'Botín raro: objetos, planos de jefe y la condición del arma firma' },
];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (r, t) => r[0] + (r[1] - r[0]) * clamp(t, 0, 1);

/**
 * Regla aplicable a una partida. `resumen` = Game.resumen() { estado, etapas, total, hitos }. `won` manda si se pasa.
 * → { won, avance (0..1), cores, recursos, xp, arbol (fracciones 0..1), equipo, planos, firma, campana, desbloqueos (bool), xpHitos }
 */
export function reglaDe(won, resumen = null) {
  const R = REGLAS.derrota, total = Math.max(1, (resumen && resumen.total) | 0), etapas = clamp((resumen && resumen.etapas) | 0, 0, total), avance = etapas / total;
  if (won) return { won: true, avance: 1, etapas, total, cores: 1, recursos: 1, xp: 1, arbol: 1, equipo: true, planos: true, firma: true, campana: true, desbloqueos: true, xpHitos: 0 };
  const h = (resumen && resumen.hitos) || {}, X = REGLAS.xpHito;
  const xpHitos = Math.min(X.tope, etapas * X.etapa + Math.max(0, h.obj | 0) * X.objetivo + Math.max(0, h.sec | 0) * X.secundario + Math.max(0, h.elite | 0) * X.elite);
  return { won: false, avance, etapas, total, cores: lerp(R.cores, avance), recursos: etapas > 0 ? lerp(R.recursos, avance) : 0, xp: R.xp, arbol: R.arbol, equipo: false, planos: false, firma: false, campana: false, desbloqueos: false, xpHitos };
}

const esRecurso = (id) => typeof id === 'string' && (id.startsWith('mat:') || id.startsWith('semilla:'));
/** Filtra la bolsa de botín según la regla. Devuelve { bag, perdido: [{id, n}] }. Con victoria no toca nada. */
export function filtrarBotin(bag, regla) {
  const lista = Array.isArray(bag) ? bag : [];
  if (!regla || regla.won) return { bag: lista, perdido: [] };
  const out = [], perdido = [];
  for (const d of lista) {
    if (!d || typeof d !== 'object') continue;
    const n = Math.max(1, d.n | 0);
    if (!esRecurso(String(d.id)) || regla.recursos <= 0) { perdido.push({ id: String(d.id), n }); continue; }   // objetos de equipo, planos y firma: sólo victoria
    const k = Math.max(1, Math.floor(n * regla.recursos));
    out.push({ ...d, n: k }); if (n > k) perdido.push({ id: String(d.id), n: n - k });
  }
  return { bag: out, perdido };
}
/** Núcleos que se acreditan de los ganados en la partida. */
export const ajustarCores = (co, regla, mult = 1) => Math.max(0, Math.floor(Math.max(0, Math.floor(Number(co) || 0)) * (regla ? regla.cores : 1) * mult));

/* ───────── cooperativo ───────── */
/** ¿Aportó lo mínimo? (y estuvo presente un rato). */
export function aporteMinimo(j) {
  const M = REGLAS.coop.minimo, s = (j && j.st) || {};
  if ((j && j.t) !== undefined && j.t < REGLAS.coop.minTiempo) return false;
  return (s.dmg | 0) >= M.dmg || (s.obj | 0) >= M.obj || (s.sup | 0) >= M.sup || (s.rev | 0) >= M.rev || (s.elite | 0) >= M.elite || ((j && j.bajas) | 0) >= M.bajas;
}
/**
 * Reparte la recompensa de cooperativo. `jugadores` = Game.resumen().jugadores.
 * Cada categoría (daño, objetivos, apoyo, reanimaciones) se mide contra el MEJOR del equipo en esa categoría (0..1); el aporte final
 * mezcla la mejor categoría (60 %) con el promedio de las categorías en juego (40 %), así que quien apoya o reanima rinde igual que quien hace daño.
 * → { [id]: { base, bono, mult, aporte (0..1), afk, mejor (categoría) } }. En partida de 1 jugador no hay bono.
 */
export function repartoCoop(jugadores) {
  const C = REGLAS.coop, lista = Array.isArray(jugadores) ? jugadores : [], out = {}, solo = lista.length <= 1;
  const max = {}; for (const c of C.categorias) max[c] = Math.max(0, ...lista.map((j) => (j.st && j.st[c]) | 0));
  const activas = C.categorias.filter((c) => max[c] > 0);
  for (const j of lista) {
    const ok = aporteMinimo(j), niveles = activas.map((c) => ((j.st && j.st[c]) || 0) / max[c]);
    const mejorN = niveles.length ? Math.max(...niveles) : 0, prom = niveles.length ? niveles.reduce((a, b) => a + b, 0) / niveles.length : 0;
    const aporte = ok ? clamp(0.6 * mejorN + 0.4 * prom, 0, 1) : 0, afk = !ok && !solo;
    const base = afk ? C.afkBase : C.base, bono = solo || !ok ? 0 : Math.round(C.bonoMax * aporte * 1000) / 1000;
    out[j.id] = { base, bono, mult: Math.round((base + bono) * 1000) / 1000, aporte: Math.round(aporte * 1000) / 1000, afk, mejor: niveles.length && ok ? C.categorias[C.categorias.indexOf(activas[niveles.indexOf(mejorN)])] : null };
  }
  return out;
}
