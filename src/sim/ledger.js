// LEDGER DE RECOMPENSAS (Sprint 1, GDD §10 «RewardsLedger», AC-09): cada partida tiene un matchId único y, al cobrarla, deja un RECIBO.
// Cobrar dos veces el mismo matchId NO suma (recarga, reintento de red, doble clic, reconexión). Módulo PURO: sin DOM, sin almacenamiento,
// sin azar oculto (el azar y el reloj se inyectan). El perfil (src/client/perfil.js) guarda el ledger y la cola; acá sólo están las reglas.
// Documentación: docs/RECOMPENSAS.md.

export const LEDGER_MAX = 50;      // recibos que se recuerdan (los más nuevos)
export const COLA_MAX = 20;        // recompensas pendientes de acreditar (almacenamiento caído)
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** matchId nuevo: «m» + hora en base 36 + 10 caracteres al azar. `azar` y `ahora` se pueden inyectar (pruebas). */
export function nuevoMatchId(azar = Math.random, ahora = Date.now) {
  let r = ''; const A = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 10; i++) r += A[Math.floor(azar() * A.length) % A.length];
  return 'm' + Math.max(0, Math.floor(ahora())).toString(36) + r;
}
export const matchIdValido = (s) => typeof s === 'string' && ID_RE.test(s);

/** JSON estable (claves ordenadas): el mismo contenido da siempre el mismo texto. */
export function estable(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(estable).join(',') + ']';
  return '{' + Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== 'function').sort().map((k) => JSON.stringify(k) + ':' + estable(v[k])).join(',') + '}';
}
/** Huella de 53 bits (cyrb53) en hexadecimal: sirve para detectar «mismo matchId con otro resultado» y para firmar copias de seguridad. No es criptografía. */
export function huella(texto, semilla = 0) {
  let h1 = 0xdeadbeef ^ semilla, h2 = 0x41c6ce57 ^ semilla;
  for (let i = 0; i < texto.length; i++) { const c = texto.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
export const hashResultado = (obj) => huella(estable(obj));

/** Ledger = lista de recibos { id, h (huella del resultado), at, ...datos }. Sanea lo que venga de disco: ids válidos, sin repetidos, ≤ LEDGER_MAX. */
export function limpiarLedger(raw) {
  const out = [], vistos = new Set();
  if (!Array.isArray(raw)) return out;
  for (const r of raw) {
    if (!r || typeof r !== 'object' || !matchIdValido(r.id) || vistos.has(r.id)) continue;
    vistos.add(r.id);
    out.push({ ...r, id: r.id, h: typeof r.h === 'string' ? r.h.slice(0, 32) : '', at: Number.isFinite(+r.at) ? +r.at : 0 });
  }
  return out.slice(-LEDGER_MAX);
}
export const buscar = (ledger, id) => (Array.isArray(ledger) ? ledger.find((r) => r.id === id) || null : null);

/**
 * Decide si un resultado se puede acreditar. No modifica nada.
 *  → { accion: 'acreditar' }                        el matchId es nuevo
 *  → { accion: 'duplicado', recibo, conflicto }     ya se acreditó; `conflicto` = mismo id con OTRO resultado (no se suma igual)
 *  → { accion: 'invalido' }                         matchId inservible
 */
export function evaluar(ledger, matchId, hash) {
  if (!matchIdValido(matchId)) return { accion: 'invalido' };
  const r = buscar(ledger, matchId);
  if (!r) return { accion: 'acreditar' };
  return { accion: 'duplicado', recibo: r, conflicto: !!(hash && r.h && r.h !== hash) };
}
/** Devuelve un ledger NUEVO con el recibo agregado al final (se descartan los más viejos pasado el tope). */
export function agregar(ledger, recibo, max = LEDGER_MAX) {
  const base = limpiarLedger(ledger).filter((r) => r.id !== recibo.id);
  return [...base, { ...recibo }].slice(-max);
}

/** Cola de recompensas pendientes: { matchId, char, jugador, info, at }. Sin repetidos por matchId, ≤ COLA_MAX (se descartan las más viejas). */
export function limpiarCola(raw) {
  const out = [], vistos = new Set();
  if (!Array.isArray(raw)) return out;
  for (const e of raw) {
    if (!e || typeof e !== 'object' || !matchIdValido(e.matchId) || vistos.has(e.matchId) || typeof e.char !== 'string' || !e.jugador || typeof e.jugador !== 'object') continue;
    vistos.add(e.matchId); out.push({ matchId: e.matchId, char: e.char.slice(0, 24), jugador: e.jugador, info: e.info && typeof e.info === 'object' ? e.info : {}, at: Number.isFinite(+e.at) ? +e.at : 0 });
  }
  return out.slice(-COLA_MAX);
}
export function encolar(cola, entrada, max = COLA_MAX) {
  const base = limpiarCola(cola).filter((e) => e.matchId !== entrada.matchId);
  return limpiarCola([...base, entrada]).slice(-max);
}
export const quitarDeCola = (cola, matchId) => limpiarCola(cola).filter((e) => e.matchId !== matchId);
