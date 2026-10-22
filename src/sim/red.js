// Reglas comunes de la red del modo cooperativo (las usan el servidor y el navegador).
// 1) PROTOCOLO: número de versión del "idioma" entre cliente y servidor. Si cambia el formato de los mensajes, se SUBE.
// 2) compactar / aplicar: los snapshots viajan como "delta" (sólo lo que cambió) para gastar poco internet.

/** Subí este número cada vez que cambie el formato de los mensajes. Cliente y servidor deben coincidir. */
export const PROTOCOLO = 3; // secuencia/caza y sus campos de objetivo
/** Tope de jugadores por sala. */
export const MAX_JUGADORES = 4;
/** Alfabeto del código de sala: sin 0/O/1/I para que no se confunda al dictarlo. */
export const ALFABETO_SALA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalizarCodigo = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
export const codigoValido = (s) => /^[A-HJ-NP-Z2-9]{4}$/.test(s);

/** Mensajes en español para cada código de error del servidor (el cliente los muestra tal cual). */
export const ERRORES = {
  sala_llena: 'La sala está llena (máximo 4 jugadores).',
  sala_inexistente: 'Esa sala no existe. Revisá el código o pedile al anfitrión que cree una nueva.',
  version: 'Tu juego y el servidor son de versiones distintas. Recargá la página (o borrá la caché) para actualizar.',
  limite: 'El servidor está al tope de salas. Probá de nuevo en unos minutos.',
  limite_ip: 'Hay demasiadas conexiones desde tu red. Cerrá otras pestañas del juego e intentá de nuevo.',
  terminada: 'Esa partida ya terminó. Pedile al anfitrión que empiece otra.',
  no_anfitrion: 'Sólo el anfitrión puede hacer eso.',
  lento: 'Estás mandando mensajes demasiado rápido.',
  cierre: 'El servidor se está reiniciando. Volvé a entrar en un minuto.',
  falla: 'La sala tuvo un problema interno y se cerró. Creá una nueva.',
  token: 'No pudimos devolverte a tu lugar en la sala (pasó demasiado tiempo).',
  invalido: 'Mensaje inválido.',
};

/* ───────── delta de snapshots ───────── */
const SIEMPRE = new Set(['tick', 'time', 'events']);   // cambian casi siempre: se mandan enteros
const KEYFRAME = 60;                                                                // un snapshot completo cada 60 (≈ 3 s a 20 Hz): cura cualquier resto

/** Estado de quien emite (una sala): recuerda lo último que mandó. */
export const crearEmisor = () => ({ prev: {}, ent: {}, n: 0 });

const LISTAS = new Set(['players', 'monsters', 'projectiles']);   // listas de entidades con `id`: de cada una sólo se manda lo que cambió

function deltaLista(em, k, lista, full) {
  const mem = em.ent[k] || (em.ent[k] = new Map()), seen = new Set();
  const out = lista.map((e) => {
    seen.add(e.id);
    const ks = Object.keys(e), sig = ks.join(','), old = mem.get(e.id);
    if (full || !old || old.sig !== sig) { const f = {}; for (const kk of ks) f[kk] = JSON.stringify(e[kk]); mem.set(e.id, { sig, f }); return e; }
    const d = { id: e.id };
    for (const kk of ks) { if (kk === 'id') continue; const s = JSON.stringify(e[kk]); if (s !== old.f[kk]) { d[kk] = e[kk]; old.f[kk] = s; } }
    return d;
  });
  for (const id of [...mem.keys()]) if (!seen.has(id)) mem.delete(id);
  return out;
}

/**
 * Convierte un snapshot completo en un "delta": sólo las partes que cambiaron desde el último que se mandó.
 * `completo` fuerza un snapshot entero (jugador nuevo, reconexión, fin de partida).
 */
export function compactar(em, snap, completo = false) {
  em.n++;
  const full = completo || em.n % KEYFRAME === 1;
  const out = {};
  for (const k of Object.keys(snap)) {
    const v = snap[k];
    if (LISTAS.has(k)) { out[k] = deltaLista(em, k, v, full); continue; }
    if (SIEMPRE.has(k)) { out[k] = v; continue; }
    const s = JSON.stringify(v);
    if (full || em.prev[k] !== s) { out[k] = v; em.prev[k] = s; }
  }
  const gone = []; for (const k of Object.keys(em.prev)) if (!(k in snap)) { gone.push(k); delete em.prev[k]; }
  if (gone.length) out._x = gone;
  if (full) out._f = 1;
  return out;
}

/**
 * Del lado del cliente: arma el snapshot completo a partir del anterior (`cur`) y un delta.
 * Devuelve un objeto NUEVO (los anteriores no se tocan: el interpolador los sigue usando).
 */
export function aplicar(cur, d) {
  if (!d || typeof d !== 'object') return cur;
  const base = d._f || !cur ? {} : cur, next = { ...base };
  for (const k of Object.keys(d)) {
    if (k === '_f' || k === '_x') continue;
    if (LISTAS.has(k)) {
      const old = new Map(((base[k]) || []).map((e) => [e.id, e]));
      next[k] = d[k].map((e) => { const o = old.get(e.id); return o ? { ...o, ...e } : e; });
    } else next[k] = d[k];
  }
  if (Array.isArray(d._x)) for (const k of d._x) delete next[k];
  return next;
}
