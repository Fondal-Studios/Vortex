// Dónde está el servidor cooperativo y si está despierto.
// Orden de prioridad: 1) ?server=… en el enlace  2) lo que el jugador guardó en Opciones › Cooperativo
//                     3) "servidor" de public/config.json (lo cambia el dueño sin tocar código)  4) el mismo sitio donde está alojado el juego.
const KEY = 'arcanum.servidor.v1';
const leer = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };

/** Acepta «https://x.onrender.com», «wss://x…/ws», «x.onrender.com», «localhost:8080»… y devuelve {http, ws} o null si no sirve. */
export function normalizar(txt) {
  let t = String(txt || '').trim(); if (!t) return null;
  if (/\s/.test(t)) return null;
  if (!/^[a-z]+:\/\//i.test(t)) t = (/^(localhost|127\.|192\.168\.|10\.)/i.test(t) ? 'http://' : 'https://') + t;
  let u; try { u = new URL(t); } catch { return null; }
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(u.protocol)) return null;
  const seguro = u.protocol === 'https:' || u.protocol === 'wss:';
  const host = u.host; if (!host) return null;
  return { http: `${seguro ? 'https' : 'http'}://${host}`, ws: `${seguro ? 'wss' : 'ws'}://${host}/ws`, host };
}

let cfgCache = null;
async function config() {
  if (cfgCache) return cfgCache;
  try { const r = await fetch(new URL('public/config.json', document.baseURI), { cache: 'no-store' }); cfgCache = r.ok ? await r.json() : {}; } catch { cfgCache = {}; }
  return cfgCache;
}

/** {http, ws, origen:'enlace'|'ajuste'|'config'|'mismo'|'ninguno', porDefecto:bool} */
export async function resolver(params = new URLSearchParams(location.search)) {
  const q = normalizar(params.get('server'));
  if (q) return { ...q, origen: 'enlace', porDefecto: false };
  const g = normalizar(leer());
  if (g) return { ...g, origen: 'ajuste', porDefecto: false };
  const c = normalizar((await config()).servidor);
  if (c) return { ...c, origen: 'config', porDefecto: true };
  if (/^https?:$/.test(location.protocol) && !/\.github\.io$/i.test(location.hostname)) { const h = location.host; return { http: location.origin, ws: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${h}/ws`, host: h, origen: 'mismo', porDefecto: true }; }
  return { http: '', ws: '', host: '', origen: 'ninguno', porDefecto: true };
}
export function guardar(txt) { try { if (txt) localStorage.setItem(KEY, txt); else localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } }
export const guardado = leer;

/** Mensajes para el jugador (español, sin jerga). */
export const TEXTO = {
  encendido: 'Servidor encendido',
  dormido: 'Servidor dormido (puede tardar 30 a 60 segundos en despertar)',
  sin_conexion: 'Sin conexión con el servidor',
  sin_servidor: 'Todavía no hay servidor configurado (mirá Opciones › Cooperativo)',
  version: 'El servidor es de otra versión del juego: recargá la página',
};

/** Prueba el servidor. Devuelve {estado:'encendido'|'dormido'|'sin_conexion'|'sin_servidor'|'version', ms, info}. */
export async function probar(srv, { timeout = 8000 } = {}) {
  if (!srv || !srv.http) return { estado: 'sin_servidor' };
  const t0 = performance.now(), ctl = new AbortController(), to = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(srv.http + '/health', { cache: 'no-store', signal: ctl.signal });
    clearTimeout(to);
    const ct = r.headers.get('content-type') || '';
    if (r.ok && ct.includes('json')) { const info = await r.json(); return { estado: info.proto !== undefined && info.proto !== PROTO() ? 'version' : 'encendido', ms: Math.round(performance.now() - t0), info }; }
    return { estado: 'dormido', ms: Math.round(performance.now() - t0) };   // contestó otra cosa (la página de "despertando" de Render, un 502/503...)
  } catch {
    clearTimeout(to);
    // Un servidor que duerme suele contestar sin los permisos de lectura (CORS): con no-cors vemos si ALGO contesta.
    try { const c2 = new AbortController(), t2 = setTimeout(() => c2.abort(), Math.min(timeout, 6000)); await fetch(srv.http + '/health', { mode: 'no-cors', cache: 'no-store', signal: c2.signal }); clearTimeout(t2); return { estado: 'dormido', ms: Math.round(performance.now() - t0) }; }
    catch { return { estado: ctl.signal.aborted ? 'dormido' : 'sin_conexion', ms: Math.round(performance.now() - t0) }; }
  }
}
import { PROTOCOLO } from '../sim/red.js';
const PROTO = () => PROTOCOLO;

/** Enlace para invitar a la sala. Si el servidor no es el de por defecto, va dentro del enlace (?server=…). */
export function enlaceSala(codigo, srv) {
  const u = new URL(location.href); u.search = ''; u.hash = '';
  u.searchParams.set('sala', codigo);
  if (srv && !srv.porDefecto && srv.http) u.searchParams.set('server', srv.http);
  return u.href;
}
