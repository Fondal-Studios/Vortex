// TARJETAS ENTRE OLEADAS por estilo (docs/EVOLUCION.md → «Tarjetas»). Datos y reglas PURAS (sin DOM, sin azar propio: el azar viene de g.rng → determinista).
// Cuatro clases de tarjeta: 'disparo' (armas: daño, cadencia, munición, mods, mutaciones, formas), 'melee' (árbol de combos y arma fusionada: COMBO_WEAPON),
// 'habilidad' (recarga, potencia, área, definitiva) y 'huesped' (resistencia, escudo, velocidad, vigor), más los 'organo' de siempre.
// Las de melé / habilidad / Huésped viven en p.cu = { id: unidades } y las leen huespedes.js, combos.js y game.js.

/** Rarezas: multiplican lo que da la tarjeta (en unidades) y cuentan hacia el tope. */
export const RAREZAS = [{ id: 'comun', name: 'Común', mul: 1, p: 0.7 }, { id: 'rara', name: 'Rara', mul: 1.6, p: 0.25 }, { id: 'epica', name: 'Épica', mul: 2.4, p: 0.05 }];
export const CLASES = ['disparo', 'melee', 'habilidad', 'huesped', 'organo'];
/** Clase de tarjeta que le corresponde a cada estilo de combate (data.js → STYLES; el modo Combo juega como Melé). */
export const CLASE_DE_ESTILO = { disparo: 'disparo', melee: 'melee', habilidad: 'habilidad' };
/** Costo en núcleos de relanzar las tarjetas: sube con cada relanzamiento de ese respiro. */
export const REROLL_COSTO = [15, 30, 45];
export const MANO = { base: 3, max: 4 };

const pc = (x) => Math.round(x * 100);
/** Catálogo. `per` = valor por unidad; `max` = tope en unidades (una rara suma 1,6; una épica 2,4). `d(m)` = texto con la rareza `m` aplicada. */
export const TARJETAS = {
  // ── Melé: se conectan con el árbol de combos (combos.js) y con la forma del arma fusionada (COMBO_WEAPON)
  filo:     { k: 'melee', name: 'Filo afinado',     max: 6, per: 0.07, d: (m) => `+${pc(0.07 * m)} % de daño cuerpo a cuerpo (golpes, remates y giros).` },
  ventana:  { k: 'melee', name: 'Cadena fluida',    max: 4, per: 0.12, d: (m) => `La ventana para encadenar golpes dura ${pc(0.12 * m)} % más y se perdona el apuro (buffer +${pc(0.1 * m)} %).` },
  area:     { k: 'melee', name: 'Golpe amplio',     max: 4, per: 0.06, d: (m) => `Tus golpes llegan ${pc(0.04 * m)} % más lejos, abarcan ${pc(0.06 * m)} % más de arco y alcanzan a ${Math.max(1, Math.round(m))} enemigo más.` },
  remate:   { k: 'melee', name: 'Remate letal',     max: 4, per: 0.15, d: (m) => `El último golpe de cada cadena pega ${pc(0.15 * m)} % más.` },
  reflejos: { k: 'melee', name: 'Reflejos',         max: 5, per: 0.04, d: (m) => `Recuperás ${pc(0.04 * m)} % más rápido entre golpes: la cadena corre más.` },
  arma:     { k: 'melee', name: 'Dominio del arma', max: 4, per: 0.08, d: (m) => `Tu arma fusionada rinde más: remate +${pc(0.08 * m)} % y, cada 2 niveles, un golpe más en la cadena.` },
  // ── Habilidades
  enfria:   { k: 'habilidad', name: 'Foco',               max: 5, per: 0.06, d: (m) => `Todas tus habilidades recargan ${pc(0.06 * m)} % más rápido.` },
  potencia: { k: 'habilidad', name: 'Potencia arcana',    max: 6, per: 0.09, d: (m) => `+${pc(0.09 * m)} % de daño de habilidades.` },
  efecto:   { k: 'habilidad', name: 'Eco de poder',       max: 4, per: 0.08, d: (m) => `Las habilidades abarcan ${pc(0.08 * m)} % más área y duran más. Con 2 niveles, además ralentizan lo que tocan.` },
  ulti:     { k: 'habilidad', name: 'Definitiva voraz',   max: 5, per: 0.1,  d: (m) => `La definitiva carga ${pc(0.1 * m)} % más rápido.` },
  // ── Huésped (cuerpo): resistencia, escudo, movilidad
  coraza:   { k: 'huesped', name: 'Piel dura',     max: 5, per: 0.04, d: (m) => `Recibís ${pc(0.04 * m)} % menos de daño.` },
  escudo:   { k: 'huesped', name: 'Escudo vivo',   max: 4, per: 0.2,  d: (m) => `El escudo se recarga ${pc(0.2 * m)} % más rápido.` },
  ligereza: { k: 'huesped', name: 'Paso ligero',   max: 4, per: 0.03, d: (m) => `+${pc(0.03 * m)} % de velocidad.` },
  vigor:    { k: 'huesped', name: 'Vigor',         max: 4, per: 0.6,  d: (m) => `Cada baja te cura ${(0.6 * m).toFixed(1).replace('.', ',')} de vida y entre oleadas recuperás ${Math.round(4 * m)} más.` },
};
export const CLASE_DE_K = { melee: 'melee', habilidad: 'habilidad', huesped: 'huesped', skill: 'habilidad', host: 'huesped' };
const IDS_DE = (k) => Object.keys(TARJETAS).filter((i) => TARJETAS[i].k === k);
export const idsDeClase = (clase) => IDS_DE(clase);

/** Unidades acumuladas de una tarjeta de p.cu (0 si nunca se tomó). */
export const cu = (p, id) => (p && p.cu && p.cu[id]) || 0;
export const cuInit = (p) => { p.cu = p.cu || {}; p.dmgBy = p.dmgBy || { melee: 0, gun: 0, skill: 0 }; p.uso = p.uso || { melee: 0, gun: 0, skill: 0 }; p.dmgSnap = p.dmgSnap || { melee: 0, gun: 0, skill: 0 }; p.rrN = p.rrN || 0; return p.cu; };

/** Clase de una tarjeta ({w,k,...} de la sim, o [w,k,id,mod,r] del snapshot): 'disparo' | 'melee' | 'habilidad' | 'huesped' | 'organo'. */
export function claseDe(c) {
  const k = Array.isArray(c) ? c[1] : c.k, t = Array.isArray(c) ? c[3] : c.t;
  if (k === 'organ') return t === 'c' ? 'huesped' : 'organo';
  if (k === 'melee' || k === 'habilidad' || k === 'huesped') return k;
  return 'disparo';
}
/** ¿Esta tarjeta le sirve a este estilo? (la clase del estilo; los órganos de arma cuentan para Disparo; los de cuerpo y de Huésped, para todos como «complemento», no como «relevante»). */
export const esRelevante = (c, estilo) => claseDe(c) === CLASE_DE_ESTILO[estilo] || (estilo === 'disparo' && claseDe(c) === 'organo');
/** Estilo efectivo del jugador: el modo Combo juega como Melé. */
export const estiloDe = (p) => (p.mode === 'combo' ? 'melee' : p.style === 'melee' ? 'melee' : p.style === 'habilidad' ? 'habilidad' : 'disparo');

/** Lo que el jugador USÓ de verdad en las últimas oleadas (daño por fuente, con memoria: lo reciente pesa el doble). Devuelve {melee,gun,skill} sumando 1. */
export function usoReciente(p) {
  cuInit(p);
  const d = {}; let s = 0;
  for (const k of ['melee', 'gun', 'skill']) { d[k] = 0.5 * (p.uso[k] || 0) + Math.max(0, (p.dmgBy[k] || 0) - (p.dmgSnap[k] || 0)); s += d[k]; }
  const out = {}; for (const k of ['melee', 'gun', 'skill']) out[k] = s > 0 ? d[k] / s : 1 / 3;
  return out;
}
/** Cierra la ventana de uso al ofrecer tarjetas (la próxima oleada empieza de cero, con la anterior a medias). */
export function cerrarUso(p) { cuInit(p); for (const k of ['melee', 'gun', 'skill']) { p.uso[k] = 0.5 * p.uso[k] + Math.max(0, p.dmgBy[k] - p.dmgSnap[k]); p.dmgSnap[k] = p.dmgBy[k]; } }

/** Pesos para la tarjeta LIBRE (3.ª): el estilo manda, lo usado pesa, y siempre queda una pizca de todo (diversidad). */
export function pesosLibres(p) {
  const e = estiloDe(p), u = usoReciente(p), W = { disparo: 0.12, melee: 0.12, habilidad: 0.12, huesped: 0.14 };
  W[CLASE_DE_ESTILO[e]] += 0.3;
  W.disparo += 0.38 * u.gun; W.melee += 0.38 * u.melee; W.habilidad += 0.38 * u.skill;
  return W;
}

/** Tarjetas de una clase que todavía se pueden tomar (no están al tope). */
/** (Cadena fluida y Dominio del arma sólo sirven en el modo Combo: en Disparo / Habilidades con melé suelto no se ofrecen.) */
export function disponibles(p, clase) { return idsDeClase(clase).filter((id) => cu(p, id) < TARJETAS[id].max - 1e-9 && (p.mode === 'combo' || !SOLO_COMBO.includes(id))); }
const SOLO_COMBO = ['ventana', 'arma'];
export function rarezaAl(r) { let a = 0; for (const x of RAREZAS) { a += x.p; if (r < a) return RAREZAS.indexOf(x); } return 0; }

/** Aplica una tarjeta de melé / habilidad / Huésped: suma unidades (con rareza) hasta el tope. */
export function aplicarTarjeta(p, c) {
  const T = TARJETAS[c.id]; if (!T) return false; cuInit(p);
  const m = RAREZAS[c.r | 0] ? RAREZAS[c.r | 0].mul : 1;
  p.cu[c.id] = Math.min(T.max, (p.cu[c.id] || 0) + m); return true;
}
/** Texto de una tarjeta nueva para la pantalla. */
export function textoTarjeta(c) { const T = TARJETAS[c.id]; if (!T) return { name: c.id || '?', desc: '' }; const m = RAREZAS[c.r | 0] ? RAREZAS[c.r | 0].mul : 1; return { name: T.name, desc: T.d(m), rareza: RAREZAS[c.r | 0] ? RAREZAS[c.r | 0].name : 'Común', max: T.max }; }

/** Costo del próximo relanzamiento de este respiro (null si ya no hay más). */
export const costoReroll = (p) => (p.rrN || 0) < REROLL_COSTO.length ? REROLL_COSTO[p.rrN || 0] : null;
