import { createAccounts } from './accounts.js';
// Servidor del modo COOPERATIVO (hasta 4 jugadores) + sitio estático opcional.
// La simulación (src/sim) corre ACÁ y es la única fuente de verdad: los clientes sólo mandan entradas y reciben snapshots.
//
// Se configura con variables de entorno (ver docs/COOP_ONLINE.md):
//   PORT / HOST             puerto y dirección (Render, Koyeb, Fly... ponen PORT solos)
//   ALLOWED_ORIGINS         páginas que pueden conectarse, separadas por coma. Ej: https://tuusuario.github.io  (vacío = cualquiera)
//   MAX_SALAS, MAX_POR_IP   topes de salas y de conexiones por red
//   SERVIR_JUEGO=0          no servir los archivos del juego (sólo WebSocket + /health)
//   TRUST_PROXY=1           detrás de un proxy (Render, Fly, cloudflared): la IP real viene en X-Forwarded-For
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { faunaDeRed } from '../src/sim/fauna-data.js';   // Códice de Fauna: sólo especies conocidas y números sanos
import { Game } from '../src/sim/game.js';
import { MAPS } from '../src/sim/maps.js';
import { CHARACTERS } from '../src/sim/data.js';
import { cleanEquip } from '../src/sim/items.js';
import { cleanArbol } from '../src/sim/progresion.js';
import { PROTOCOLO, MAX_JUGADORES, ALFABETO_SALA, normalizarCodigo, ERRORES, compactar, crearEmisor } from '../src/sim/red.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
export const SIM_DT = 1 / 60, SNAP_EVERY = 3; // 60 Hz de simulación, 20 Hz de snapshots
const SNAP_FIN_EVERY = 30;                    // terminada la partida los snapshots bajan a 2 por segundo
const CUENTA_SEG = 3;                         // cuenta regresiva antes de empezar (todos arrancan a la vez)

/** Equipo que manda un cliente: se limpia con las mismas reglas de la simulación (ids conocidos, ranura y Huésped correctos, ≤ 12 entradas). El servidor NO sabe qué tiene cada jugador en su inventario: acota, no verifica la propiedad (docs/INVENTARIO.md). */
export const equipDe = (char, list) => (Array.isArray(list) ? cleanEquip(char, list.slice(0, 12)) : []);

/** Nodos de los árboles de combos y de disparo que manda un cliente: sólo ids reales de ese Huésped, UNA rama por árbol, en orden y ≤ 3 por árbol. El servidor NO sabe cuántos puntos ganó el jugador: acota, no verifica (docs/EVOLUCION.md). */
export const arbolDe = (char, a) => cleanArbol(char, a);

const num = (x, lo, hi, def = 0) => { const n = Math.floor(Number(x)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
const nombreLimpio = (s) => { const t = String(s ?? '').replace(/[\u0000-\u001f\u007f<>&"'`]/g, '').trim().slice(0, 16); return t || 'Pasajero'; };

/** Todo lo que un cliente puede decir de su personaje, ya limpio. Nada de lo que viene de afuera se usa sin pasar por acá. */
export function cargaDe(m = {}) {
  const char = CHARACTERS[m.char] ? m.char : undefined;
  return {
    char, fauna: faunaDeRed(m.fauna), style: typeof m.style === 'string' ? m.style.slice(0, 20) : undefined, melee: typeof m.melee === 'string' ? m.melee.slice(0, 30) : undefined,
    evo: Number.isInteger(m.evo) ? num(m.evo, 0, 4) : undefined, bend: Array.isArray(m.bend) ? m.bend.slice(0, 6).filter((x) => typeof x === 'string') : undefined,
    herb: Array.isArray(m.herb) ? m.herb.slice(0, 12).filter((x) => typeof x === 'string') : undefined, equip: equipDe(char, m.equip), arbol: arbolDe(char, m.arbol),
    maestria: Number.isFinite(+m.maestria) ? num(m.maestria, 0, 10) : undefined,
    pity: m.pity && typeof m.pity === 'object' ? { l: num(m.pity.l, 0, 999), e: num(m.pity.e, 0, 999) } : undefined,
    sigs: Array.isArray(m.sigs) ? m.sigs.slice(0, 5).filter((x) => typeof x === 'string') : undefined,
    slots: Array.isArray(m.slots) ? m.slots.slice(0, 5).map(Number) : undefined,
    mode: m.mode === 'combo' ? 'combo' : 'shooter',
  };
}

function resolveFile(url) {
  let p; try { p = decodeURIComponent(String(url).split('?')[0].split('#')[0]); } catch { return null; }
  if (p.includes('\0')) return null;
  if (p === '/') p = '/public/index.html';
  let base, rel;
  if (p.startsWith('/vendor/three/')) { base = path.join(ROOT, 'node_modules/three/build'); rel = p.slice('/vendor/three/'.length); }
  else if (p.startsWith('/vendor/three-addons/')) { base = path.join(ROOT, 'node_modules/three/examples/jsm'); rel = p.slice('/vendor/three-addons/'.length); }
  else if (p.startsWith('/public/') || p.startsWith('/src/') || p.startsWith('/assets/')) { base = ROOT; rel = p.slice(1); if (!/^(public|src|assets)\//.test(rel)) return null; }
  else if (/^\/[\w.-]+\.(html|css|js|json|webmanifest|png)$/.test(p)) { base = path.join(ROOT, 'public'); rel = p.slice(1); }
  else return null;
  const f = path.resolve(base, rel);
  // nada fuera de la carpeta permitida (../), ni siquiera si el nombre empieza igual
  const dentro = (b) => f === b || f.startsWith(b + path.sep);
  if (!(dentro(base) && (base !== ROOT || ['public', 'src', 'assets'].some((d) => dentro(path.join(ROOT, d)))))) return null;
  return f;
}

const csv = (s) => String(s || '').split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean);

export async function startServer(opts = {}) {
  const env = process.env;
  const cfg = {
    port: opts.port ?? 8080, host: opts.host ?? '0.0.0.0', autoTick: opts.autoTick ?? true,
    maxSalas: opts.maxSalas ?? (+env.MAX_SALAS || 20), maxPorIp: opts.maxPorIp ?? (+env.MAX_POR_IP || 8),
    origenes: opts.origenes ?? csv(env.ALLOWED_ORIGINS), servirJuego: opts.servirJuego ?? env.SERVIR_JUEGO !== '0',
    trustProxy: opts.trustProxy ?? env.TRUST_PROXY === '1', graciaMs: opts.graciaMs ?? (+env.RECONEXION_MS || 45000),
    maxMsgSeg: opts.maxMsgSeg ?? 90, silencio: opts.silencio ?? !!process.env.NODE_TEST_CONTEXT, velocidad: opts.velocidad ?? 1,   // velocidad: sólo para pruebas (simula más rápido que el reloj)
  };
  const log = (...a) => { if (!cfg.silencio) console.log(new Date().toISOString(), ...a); };   // NUNCA se registran IPs, nombres ni mensajes: sólo contadores y códigos de sala
  const rooms = new Map(), porIp = new Map();
  const arranque = Date.now();
  const stats = { conexiones: 0, salasCreadas: 0, partidas: 0 };
  const origenOk = (o) => !cfg.origenes.length || !o || cfg.origenes.includes(String(o).replace(/\/$/, ''));
  const jugadores = () => { let n = 0; for (const r of rooms.values()) n += r.members.length; return n; };

  const accounts = await createAccounts({ databaseUrl: opts.databaseUrl, db: opts.accountDb, trustProxy: cfg.trustProxy });
  const server = http.createServer((req, res) => {
    if (String(req.url).split('?')[0].startsWith('/api/account/')) { void accounts.handle(req, res); return; }
    const url = String(req.url || '/');
    const cors = {}; const o = req.headers.origin; if (o && origenOk(o)) { cors['Access-Control-Allow-Origin'] = o; cors.Vary = 'Origin'; }
    if (req.method === 'OPTIONS') { res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '600' }); return res.end(); }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    const ruta = url.split('?')[0];
    if (ruta === '/health' || ruta === '/salud') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ ok: true, accounts: accounts.enabled, proto: PROTOCOLO, salas: rooms.size, jugadores: jugadores(), max: cfg.maxSalas, up: Math.round((Date.now() - arranque) / 1000) }));
    }
    if (!cfg.servirJuego) { res.writeHead(404, cors); return res.end('Este servidor sólo atiende partidas cooperativas.'); }
    const f = resolveFile(url);
    let st = null; try { st = f && fs.statSync(f); } catch { /* no existe */ }
    if (!f || !st || !st.isFile()) { res.writeHead(404, cors); return res.end('no encontrado'); }
    res.writeHead(200, { ...cors, 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(f).on('error', () => res.destroy()).pipe(res);
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: { threshold: 256, serverNoContextTakeover: true, clientNoContextTakeover: true, zlibDeflateOptions: { level: 3 }, concurrencyLimit: 4 } });
  const ipDe = (req) => (cfg.trustProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : req.socket.remoteAddress) || '?';
  server.on('upgrade', (req, socket, head) => {
    const rechazar = (code, txt) => { socket.write(`HTTP/1.1 ${code} ${txt}\r\nConnection: close\r\n\r\n`); socket.destroy(); };
    if (String(req.url).split('?')[0] !== '/ws') return rechazar(404, 'Not Found');
    if (!origenOk(req.headers.origin)) return rechazar(403, 'Forbidden');
    const ip = ipDe(req), n = porIp.get(ip) || 0;
    if (n >= cfg.maxPorIp) return rechazar(429, 'Too Many Requests');
    wss.handleUpgrade(req, socket, head, (ws) => { ws.ip = ip; porIp.set(ip, n + 1); wss.emit('connection', ws, req); });
  });

  const send = (ws, o) => { if (ws && ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };
  const error = (ws, code, extra = {}) => send(ws, { t: 'error', code, msg: code === 'sala_llena' ? 'sala llena' : code === 'sala_inexistente' ? 'sala inexistente' : (ERRORES[code] || code), ...extra });
  const conectados = (room) => room.members.filter((m) => m.ws);
  const todos = (room, o) => { const s = JSON.stringify(o); for (const m of room.members) send(m.ws, s); };

  const nuevoCodigo = () => { for (let i = 0; i < 50; i++) { let c = ''; for (let k = 0; k < 4; k++) c += ALFABETO_SALA[crypto.randomInt(ALFABETO_SALA.length)]; if (!rooms.has(c)) return c; } return null; };
  function makeRoom(mapId, lobby) {
    const code = nuevoCodigo(); if (!code) return null;
    const room = { code, mapId, lobby: !!lobby, phase: 'lobby', game: null, members: [], acc: 0, last: Date.now(), em: crearEmisor(), cuenta: 0, finEnviado: false, forzarCompleto: true, ultimo: Date.now() };
    rooms.set(code, room); stats.salasCreadas++; log(`sala ${code} creada (${rooms.size} activas)`);
    return room;
  }
  const publicLobby = (room) => ({ t: 'lobby', room: room.code, map: room.mapId, fase: room.phase, cuenta: room.cuenta > 0 ? Math.ceil(room.cuenta) : 0, max: MAX_JUGADORES, players: room.members.map((m) => ({ id: m.id, name: m.name, char: m.carga.char || null, mode: m.carga.mode, ready: m.ready, host: m === room.members[0], away: !m.ws })) });
  function difundirLobby(room) {
    const base = publicLobby(room);
    for (const m of room.members) send(m.ws, { ...base, yo: m.id, token: m.token });
  }
  function bienvenida(room, m, extra = {}) {
    send(m.ws, { ...extra, t: 'welcome', pid: m.pid, room: room.code, map: room.mapId, dt: SIM_DT, token: m.token, yo: m.id, proto: PROTOCOLO, lobby: room.lobby });
    room.forzarCompleto = true;
  }
  function addAlJuego(room, m) {
    const c = m.carga;
    const p = room.game.addPlayer(m.name, null, { ...c, char: c.char });
    if (!p) return false;
    m.pid = p.id; m.away = 0;
    return true;
  }
  function empezar(room) {
    room.game = new Game({ mapId: room.mapId, seed: crypto.randomInt(1e9), calm: room.lobby ? 10 : 16, magazines: true });
    room.finEnviado = false; room.em = crearEmisor(); room.acc = 0; room.last = Date.now(); stats.partidas++;
    const keep = [];
    for (const m of room.members) { if (addAlJuego(room, m)) keep.push(m); else if (m.ws) error(m.ws, 'sala_llena'); }
    room.members = keep; room.phase = 'juego'; room.cuenta = 0;
    for (const m of room.members) bienvenida(room, m);
    log(`sala ${room.code}: empezó con ${room.members.length} jugador(es) en ${room.mapId}`);
  }
  function nuevoMiembro(ws, name, carga) {
    const m = { id: 0, token: crypto.randomBytes(12).toString('hex'), name, ws, carga, ready: false, pid: 0, away: 0, tokens: 0, drops: 0 };
    ws.miembro = m; return m;
  }
  function numerar(room) { room.members.forEach((m, i) => { m.id = i + 1; }); }

  function entrar(ws, room, name, carga) {
    if (room.members.length >= MAX_JUGADORES) return error(ws, 'sala_llena');
    if (room.phase === 'juego' && room.game.state !== 'playing') return error(ws, 'terminada');
    const m = nuevoMiembro(ws, name, carga); m.room = room; room.members.push(m); numerar(room);
    if (room.phase === 'juego') { if (!addAlJuego(room, m)) { room.members.pop(); return error(ws, 'sala_llena'); } bienvenida(room, m); difundirLobby(room); }
    else difundirLobby(room);
    room.ultimo = Date.now();
  }
  function quitar(room, m, motivo) {
    const i = room.members.indexOf(m); if (i < 0) return;
    room.members.splice(i, 1); numerar(room); m.room = null;
    if (m.ws) { m.ws.miembro = null; }
    if (room.game && m.pid) room.game.removePlayer(m.pid);
    if (!room.members.length) { rooms.delete(room.code); log(`sala ${room.code} cerrada (${motivo || 'vacía'}; ${rooms.size} activas)`); return; }
    if (room.phase === 'cuenta') { room.phase = 'lobby'; room.cuenta = 0; }
    difundirLobby(room);
  }

  wss.on('connection', (ws) => {
    stats.conexiones++;
    ws.vivo = true; ws.tokens = 150; ws.tLast = Date.now(); ws.excesos = 0;
    ws.on('pong', () => { ws.vivo = true; });
    ws.on('error', () => { /* el cierre se maneja en 'close' */ });
    ws.on('message', (raw, esBinario) => {
      if (esBinario) return;
      const ahora = Date.now(); ws.tokens = Math.min(150, ws.tokens + (ahora - ws.tLast) / 1000 * cfg.maxMsgSeg); ws.tLast = ahora;
      if (ws.tokens < 1) { if (++ws.excesos > 200) { error(ws, 'lento'); ws.close(1008, 'lento'); } return; }
      ws.tokens -= 1; ws.excesos = 0;
      let msg; try { msg = JSON.parse(raw); } catch { return; }
      if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
      try { atender(ws, msg); } catch (e) { log('error atendiendo un mensaje:', e && e.message); }
    });
    ws.on('close', (code) => {
      const n = (porIp.get(ws.ip) || 1) - 1; if (n <= 0) porIp.delete(ws.ip); else porIp.set(ws.ip, n);
      const m = ws.miembro; if (!m || m.ws !== ws) return;
      const room = m.room; if (!room) return;
      m.ws = null;
      // cierre voluntario (salir, cerrar la pestaña con .close()): se va ya. Corte raro (1006, 1001...): se le guarda el lugar un rato.
      if (code === 1000 || code === 1005 || cfg.graciaMs <= 0) return quitar(room, m, 'salió');
      m.away = Date.now();
      if (room.game && m.pid) { room.game.setInput(m.pid, { mx: 0, mz: 0, fire: false }); const p = room.game.players.find(p => p.id === m.pid); if (p) p.aw = true; }
      if (room.phase !== 'juego') difundirLobby(room);
      log(`sala ${room.code}: un jugador perdió la conexión (le guardamos el lugar ${cfg.graciaMs / 1000} s)`);
    });
  });

  function atender(ws, m) {
    const mem = ws.miembro, room = mem && mem.room;
    switch (m.t) {
      case 'create': {
        if (ws.miembro) return;
        if (m.v !== PROTOCOLO) return error(ws, 'version', { servidor: PROTOCOLO });
        if (rooms.size >= cfg.maxSalas) return error(ws, 'limite');
        const r = makeRoom(MAPS[m.map] ? m.map : 'm1', m.lobby === true); if (!r) return error(ws, 'limite');
        const me = nuevoMiembro(ws, nombreLimpio(m.name), cargaDe(m)); me.room = r; r.members.push(me); numerar(r);
        if (r.lobby) difundirLobby(r); else empezar(r);
        return;
      }
      case 'join': {
        if (ws.miembro) return;
        if (m.v !== PROTOCOLO) return error(ws, 'version', { servidor: PROTOCOLO });
        const r = rooms.get(normalizarCodigo(m.room));
        if (!r) return error(ws, 'sala_inexistente');
        return entrar(ws, r, nombreLimpio(m.name), cargaDe(m));
      }
      case 'resume': {
        if (ws.miembro) return;
        if (m.v !== PROTOCOLO) return error(ws, 'version', { servidor: PROTOCOLO });
        const r = rooms.get(normalizarCodigo(m.room));
        if (!r) return error(ws, 'sala_inexistente');
        const me = typeof m.token === 'string' ? r.members.find((x) => x.token === m.token) : null;
        if (!me) return error(ws, 'token');
        if (me.ws && me.ws !== ws) { const viejo = me.ws; viejo.miembro = null; me.ws = null; try { viejo.close(1000, 'reemplazado'); } catch { /* ya cerrado */ } }
        me.ws = ws; ws.miembro = me; me.away = 0; if (r.game) { const p = r.game.players.find(p => p.id === me.pid); if (p) p.aw = false; }
        if (r.phase === 'juego') bienvenida(r, me, { reanudado: true }); difundirLobby(r);
        log(`sala ${r.code}: un jugador volvió`);
        return;
      }
      case 'ping': return send(ws, { t: 'pong', c: typeof m.c === 'number' ? m.c : 0, j: room ? conectados(room).length : 0 });
      case 'salir': if (mem) { ws.miembro = null; mem.ws = null; quitar(room, mem, 'salió'); } return;
    }
    if (!room) return;
    switch (m.t) {
      case 'in': {
        if (room.phase !== 'juego' || !mem.pid) return;
        if (m.i && typeof m.i === 'object') room.game.setInput(mem.pid, m.i);
        return;
      }
      case 'pick': { // cambiar de Huésped / modo / equipo en el lobby
        if (room.phase !== 'lobby') return;
        mem.carga = cargaDe(m); mem.ready = false; difundirLobby(room); return;
      }
      case 'ready': if (room.phase === 'lobby') { mem.ready = m.on !== false; difundirLobby(room); } return;
      case 'map': {
        if (room.phase !== 'lobby') return;
        if (mem !== room.members[0]) return error(ws, 'no_anfitrion');
        if (MAPS[m.map]) { room.mapId = m.map; for (const x of room.members) x.ready = false; difundirLobby(room); }
        return;
      }
      case 'start': {
        if (room.phase !== 'lobby') return;
        if (mem !== room.members[0]) return error(ws, 'no_anfitrion');
        if (!conectados(room).length) return;
        mem.ready = true;
        if (room.members.every((x) => x.ready || !x.ws)) { room.phase = 'cuenta'; room.cuenta = CUENTA_SEG; room.cuentaAt = Date.now(); difundirLobby(room); }
        else send(ws, { t: 'aviso', msg: 'Todavía hay jugadores sin marcar «Listo».' });
        return;
      }
      case 'loadout': {
        if (room.phase !== 'juego' || !mem.pid) return;
        const g = room.game; if (g.phase !== 'intermission') return;
        const c = cargaDe(m); const p = g.players.find((q) => q.id === mem.pid); if (!p) return;
        g.setLoadout(mem.pid, c.char, c.slots, { equip: c.equip, arbol: c.arbol });
        mem.carga = { ...mem.carga, char: p.char, slots: p.slots, arbol: p.arb, equip: p.eqList };
        return;
      }
      case 'restart': {
        if (room.phase !== 'juego' || room.game.state === 'playing') return;
        if (room.lobby) { room.phase = 'lobby'; room.game = null; for (const x of room.members) { x.ready = false; x.pid = 0; } difundirLobby(room); }
        else empezar(room);
        return;
      }
    }
  }

  /* ───────── el reloj ───────── */
  const botinDe = (p) => (Array.isArray(p.bag) ? p.bag.slice(0, 300).map((b) => ({ id: String(b.id), q: b.q, n: b.n || 1, r: b.r, src: b.src })) : []);
  function snapshotDe(room, completo) {
    const s = room.game.snapshot();
    for (const pj of s.players) { const m = room.members.find((x) => x.pid === pj.id); if (m && !m.ws) pj.aw = 1; }
    return compactar(room.em, s, completo || room.forzarCompleto);
  }
  function difundirSnap(room, completo = false) {
    const msg = JSON.stringify({ t: 'snap', s: snapshotDe(room, completo) }); room.forzarCompleto = false;
    for (const m of room.members) send(m.ws, msg);
  }
  function terminar(room) {
    room.finEnviado = true; difundirSnap(room, true);
    const g = room.game;
    for (const m of room.members) { const p = g.players.find((q) => q.id === m.pid); send(m.ws, { t: 'fin', estado: g.state, oleada: g.wave, bag: p ? botinDe(p) : [] }); }
    log(`sala ${room.code}: terminó (${g.state}, oleada ${g.wave})`);
  }
  function pasoSala(room) {
    const now = Date.now();
    if (room.phase === 'cuenta') {
      room.cuenta = CUENTA_SEG - (now - room.cuentaAt) / 1000;
      const n = Math.ceil(room.cuenta);
      if (room.cuenta <= 0) empezar(room); else if (n !== room.cuentaN) { room.cuentaN = n; difundirLobby(room); }
      return;
    }
    // jugadores que no volvieron a tiempo
    for (const m of [...room.members]) if (!m.ws && m.away && now - m.away > cfg.graciaMs) { log(`sala ${room.code}: un jugador no volvió, se lo quita`); quitar(room, m, 'no volvió'); }
    if (!rooms.has(room.code) || room.phase !== 'juego') return;
    const g = room.game;
    room.acc = Math.min(0.25 * cfg.velocidad, room.acc + (now - room.last) / 1000 * cfg.velocidad); room.last = now;
    while (room.acc >= SIM_DT) {
      room.acc -= SIM_DT; g.step(SIM_DT);
      if (g.state !== 'playing' && !room.finEnviado) terminar(room);
      else if (g.tick % (g.state === 'playing' ? SNAP_EVERY : SNAP_FIN_EVERY) === 0) difundirSnap(room);
    }
  }
  function cerrarSala(room, code) {
    todos(room, { t: 'error', code, msg: ERRORES[code] }); for (const m of room.members) { try { m.ws && m.ws.close(1011, code); } catch { /* ya cerrado */ } }
    rooms.delete(room.code);
  }
  function avanzar() {
    for (const room of [...rooms.values()]) {
      try { pasoSala(room); } catch (e) { log(`sala ${room.code}: FALLÓ (${e && e.message}); se cierra`); cerrarSala(room, 'falla'); }
    }
  }
  /** Avanza todas las salas `n` pasos fijos (los tests lo llaman a mano). */
  function tickRooms(n = 1) {
    for (const room of rooms.values()) { if (room.phase !== 'juego') continue; for (let i = 0; i < n; i++) { room.game.step(SIM_DT); if (room.game.tick % SNAP_EVERY === 0) difundirSnap(room); } }
  }
  let timer = null, latido = null;
  if (cfg.autoTick) timer = setInterval(avanzar, 8);
  // latido: cada 20 s un ping; a quien no contesta en 3 vueltas se lo corta (y entonces entra la reconexión). También mantiene vivas las conexiones detrás de proxys gratuitos.
  latido = setInterval(() => {
    for (const ws of wss.clients) { if (!ws.vivo && (ws.perdidos = (ws.perdidos || 0) + 1) >= 3) { ws.terminate(); continue; } if (ws.vivo) ws.perdidos = 0; ws.vivo = false; try { ws.ping(); } catch { /* cerrado */ } }   // 3 pings sin respuesta (~1 min) = conexión muerta
    const now = Date.now();
    for (const room of [...rooms.values()]) if (room.phase !== 'juego' && !conectados(room).length && now - room.ultimo > cfg.graciaMs) { rooms.delete(room.code); log(`sala ${room.code} cerrada (sin nadie conectado)`); }
  }, 20000);
  latido.unref && latido.unref();

  const cerrar = (aviso = true) => new Promise((r) => {
    if (timer) clearInterval(timer); clearInterval(latido);
    if (aviso) for (const room of rooms.values()) todos(room, { t: 'error', code: 'cierre', msg: ERRORES.cierre });
    for (const c of wss.clients) { try { c.close(1001, 'cierre'); } catch { /* ya cerrado */ } }
    setTimeout(() => { for (const c of wss.clients) c.terminate(); wss.close(); server.close(() => { accounts.close().then(r, r); }); server.closeAllConnections && server.closeAllConnections(); }, aviso ? 300 : 0);
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(cfg.port, cfg.host, () => resolve({ port: server.address().port, rooms, tickRooms, stats, cfg, close: () => cerrar(false), cerrar })); });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = +process.env.PORT || 8080, host = process.env.HOST || '0.0.0.0';
  startServer({ port, host }).then((s) => {
    console.log(`Servidor cooperativo listo en el puerto ${s.port} (protocolo ${PROTOCOLO}). Salud: /health`);
    let saliendo = false;
    const apagar = (sig) => { if (saliendo) return; saliendo = true; console.log(`${sig}: cerrando con cuidado...`); s.cerrar(true).then(() => process.exit(0)); setTimeout(() => process.exit(0), 4000).unref(); };
    process.on('SIGTERM', () => apagar('SIGTERM')); process.on('SIGINT', () => apagar('SIGINT'));
    process.on('uncaughtException', (e) => console.error('error no atrapado:', e && e.message));
    process.on('unhandledRejection', (e) => console.error('promesa rechazada:', e && e.message));
  }).catch((e) => { console.error('No se pudo iniciar el servidor:', e.message); process.exit(1); });
}
