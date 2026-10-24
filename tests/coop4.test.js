// Cooperativo a 4 jugadores, sin navegador: 4 clientes "bot" hablan el protocolo WebSocket real contra el servidor real.
// Cubre: lobby (crear / unirse / elegir Huésped y modo / listo / cuenta regresiva), partida de 3+ oleadas con latencia simulada de 200 ms,
// delta de snapshots idéntico al completo, ancho de banda por jugador, reconexión tras un corte, un jugador que se va, errores en español.
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { startServer } from '../server/server.js';
import { NetClient } from '../src/client/net.js';
import { makeBot } from '../src/sim/bot.js';
import { Game } from '../src/sim/game.js';
import { PROTOCOLO, compactar, aplicar, crearEmisor } from '../src/sim/red.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(15); } return false; };
async function cliente(port, opts) { const c = new NetClient(opts); await c.connect(`ws://127.0.0.1:${port}/ws`); return c; }
const HUESPEDES = ['axioma', 'vesper', 'seraf', 'umbra'];

test('delta de snapshots: aplicar(compactar(x)) reconstruye EXACTAMENTE el snapshot completo (4000 ticks, 4 jugadores)', () => {
  const g = new Game({ mapId: 'm1', seed: 9, calm: 2, magazines: true });
  const ps = [0, 1, 2, 3].map((i) => g.addPlayer('J' + i));
  const bots = ps.map((p, i) => makeBot(g, p.id, { seed: i + 1 }));
  const em = crearEmisor(); let cur = null, total = 0, completo = 0, n = 0, ayuda = 0;
  for (let t = 0; t < 4000; t++) {
    ps.forEach((p, i) => { if (p.hp < 30) p.hp = 100; g.setInput(p.id, bots[i](1 / 60)); }); g.step(1 / 60);
    if (g.tick % 3) continue;
    const s = g.snapshot(); completo += JSON.stringify(s).length;
    const d = compactar(em, JSON.parse(JSON.stringify(s)), false); total += JSON.stringify(d).length; n++;
    cur = aplicar(cur, JSON.parse(JSON.stringify(d)));
    assert.deepEqual(JSON.parse(JSON.stringify(cur)), JSON.parse(JSON.stringify(s)), `snapshot ${n} distinto`);
    ayuda = Math.max(ayuda, g.monsters.length);
  }
  console.log(`# delta: ${n} snapshots, completo ${(completo / n) | 0} B → delta ${(total / n) | 0} B por snapshot (${(100 - total / completo * 100).toFixed(0)}% menos), hasta ${ayuda} criaturas`);
  assert.ok(total < completo * 0.9, 'el delta debe ser más chico que el completo');
});

test('lobby: crear, unirse, elegir Huésped y modo, listo, sólo el anfitrión empieza, cuenta regresiva sincronizada', async () => {
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const a = await cliente(srv.port), b = await cliente(srv.port);
    a.send({ t: 'create', lobby: true, map: 'm2', name: 'Ana', char: 'axioma' });
    assert.ok(await until(() => a.lobby && a.room)); assert.match(a.room, /^[A-HJ-NP-Z2-9]{4}$/, 'código corto de 4 caracteres');
    b.send({ t: 'join', room: a.room.toLowerCase(), name: 'Beto', char: 'vesper', mode: 'combo' });
    assert.ok(await until(() => b.lobby && b.lobby.players.length === 2 && a.lobby.players.length === 2));
    assert.equal(b.lobby.map, 'm2'); assert.equal(a.pid, null, 'todavía no hay partida');
    assert.deepEqual(a.lobby.players.map((p) => [p.name, p.char, p.mode, p.host]), [['Ana', 'axioma', 'shooter', true], ['Beto', 'vesper', 'combo', false]]);
    // sólo el anfitrión elige mapa y empieza
    let err = null; b.onError = (m, c) => { err = c; }; b.send({ t: 'start' }); assert.ok(await until(() => err === 'no_anfitrion'));
    // sin «Listo» no empieza
    let aviso = null; a.onAviso = (m) => { aviso = m; }; a.send({ t: 'start' }); assert.ok(await until(() => aviso && /Listo/.test(aviso)));
    b.send({ t: 'pick', char: 'seraf', mode: 'shooter' }); assert.ok(await until(() => a.lobby.players[1].char === 'seraf'));
    b.send({ t: 'ready', on: true }); assert.ok(await until(() => a.lobby.players[1].ready));
    a.send({ t: 'map', map: 'm1' }); assert.ok(await until(() => b.lobby.map === 'm1'));
    assert.equal(b.lobby.players[1].ready, false, 'cambiar el mapa te saca el «Listo»'); b.send({ t: 'ready', on: true });
    assert.ok(await until(() => a.lobby.players[1].ready));
    a.send({ t: 'start' });
    assert.ok(await until(() => a.lobby.cuenta === 3 && b.lobby.cuenta === 3), 'cuenta regresiva para los dos');
    assert.ok(await until(() => a.pid && b.pid, 6000), 'los dos reciben la partida a la vez');
    assert.notEqual(a.pid, b.pid);
    const g = [...srv.rooms.values()][0].game;
    assert.equal(g.mapId, 'm1'); assert.deepEqual(g.players.map((p) => p.char), ['axioma', 'seraf']);
  } finally { await srv.close(); }
});

test('errores claros: versión distinta, sala inexistente, sala llena, mensajes basura', async () => {
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const a = await cliente(srv.port); const e = {};
    a.onError = (m, c) => { e[c] = m; };
    a.send({ t: 'create', v: PROTOCOLO + 7, lobby: true }); assert.ok(await until(() => e.version), 'versión distinta'); assert.match(e.version, /versiones distintas/);
    a.send({ t: 'join', room: 'ZZZZ' }); assert.ok(await until(() => e.sala_inexistente));
    a.send({ t: 'create', lobby: true, name: '<script>alert(1)</script>  ' + 'x'.repeat(50) }); await until(() => a.room);
    assert.ok(a.lobby.players[0].name.length <= 16 && !/[<>]/.test(a.lobby.players[0].name), 'el nombre se limpia');
    const otros = []; for (let i = 0; i < 4; i++) { const c = await cliente(srv.port); c.onError = (m, cod) => { c.err = cod; }; c.send({ t: 'join', room: a.room, name: 'J' + i }); otros.push(c); await sleep(40); }
    assert.ok(await until(() => otros[3].err === 'sala_llena'), 'el 5º jugador recibe «sala llena»');
    const sucio = await cliente(srv.port); sucio.ws.send('{"t":"join","room":{"a":1}}'); sucio.ws.send('[]'); sucio.ws.send('{"t":"in"}'); sucio.ws.send('x'.repeat(20000));
    await sleep(200); assert.equal(srv.rooms.size, 1);
  } finally { await srv.close(); }
});

test('4 bots por WebSocket (200 ms de latencia en dos de ellos): 3+ oleadas sin desincronizar, reconexión y salida de un jugador', { timeout: 170000 }, async () => {
  const srv = await startServer({ port: 0, silencio: true, velocidad: 6, graciaMs: 20000 });
  const cs = [];
  try {
    for (let i = 0; i < 4; i++) cs.push(await cliente(srv.port, { lag: i >= 2 ? 200 : 0 }));   // dos con 200 ms de ida y vuelta
    const bytes = cs.map(() => ({ crudo: 0, comp: 0, n: 0 }));
    // Audit history must span the artificial 200 ms lag at 6x simulation speed.
    // The 12-frame interpolation buffer is intentionally too short for that comparison.
    const history = cs.map(() => new Map());
    cs.forEach((c, i) => { const f = c.onMessage.bind(c); c.onMessage = (m, b) => { if (m.t === 'snap') { bytes[i].crudo += b; bytes[i].comp += zlib.deflateRawSync(JSON.stringify(m), { level: 3 }).length; bytes[i].n++; } f(m, b); if (m.t === 'snap') { history[i].set(c.cur.tick, structuredClone(c.cur)); if (history[i].size > 256) history[i].delete(history[i].keys().next().value); } }; });
    cs[0].send({ t: 'create', lobby: true, map: 'm1', name: 'J0', char: HUESPEDES[0] }); assert.ok(await until(() => cs[0].room));
    for (let i = 1; i < 4; i++) { cs[i].send({ t: 'join', room: cs[0].room, name: 'J' + i, char: HUESPEDES[i], mode: i === 1 ? 'combo' : 'shooter' }); }
    assert.ok(await until(() => cs[0].lobby.players.length === 4)); for (const c of cs.slice(1)) c.send({ t: 'ready' });
    assert.ok(await until(() => cs[0].lobby.players.every((p) => p.ready || p.host)));
    cs[0].send({ t: 'start' }); assert.ok(await until(() => cs.every((c) => c.pid), 8000), 'los 4 entran a la partida');
    const room = [...srv.rooms.values()][0], g = room.game;
    assert.equal(g.players.length, 4); assert.deepEqual(g.players.map((p) => p.char), HUESPEDES);
    // los bots deciden con el estado del servidor y mandan sus entradas POR EL SOCKET (con su latencia)
    const bots = new Map(); cs.forEach((c) => bots.set(c, makeBot(g, c.pid, { seed: c.pid, skill: 1.2 })));
    let vivo = true; const motor = (async () => { while (vivo) { for (const c of cs) { if (c.estado !== 'conectado') continue; const p = g.players.find((q) => q.id === c.pid); if (!p) continue; if (p.hp < 40) p.hp = Math.min(100, p.hp + 8); c.send({ t: 'in', i: bots.get(c)(1 / 20) }); } await sleep(50); } })();
    const t0 = Date.now(); let reconectado = false, salio = false, picoMon = 0;
    while (Date.now() - t0 < 150000 && !(g.wave >= 4 && g.phase === 'intermission') && g.state === 'playing') {
      await sleep(250); picoMon = Math.max(picoMon, g.monsters.length);
      if (!reconectado && g.wave >= 2) { // corte de red brusco del jugador 2: el servidor le guarda el lugar y él vuelve solo
        reconectado = true; const m = room.members[1]; const pid = m.pid; m.ws.terminate();
        assert.ok(await until(() => cs[1].estado === 'reconectando', 3000), 'el cliente detecta el corte');
        assert.equal(g.players.length, 4, 'la partida sigue con su lugar guardado');
        assert.ok(await until(() => cs[1].estado === 'conectado' && cs[1].pid === pid, 12000), 'vuelve a su mismo jugador');
        assert.equal(g.players.length, 4);
      }
      if (!salio && g.wave >= 3) { salio = true; cs[3].salir(); assert.ok(await until(() => g.players.length === 3, 3000), 'quien se va deja de contar y la partida sigue'); }
    }
    vivo = false; await motor;
    console.log(`# 4 bots: oleada ${g.wave}, estado ${g.state}, ${g.tick} ticks (${(g.time / 60).toFixed(1)} min de juego), pico ${picoMon} criaturas, ${g.players.map((p) => p.kills).join('/')} bajas`);
    assert.ok(g.wave >= 3, `llegaron a la oleada ${g.wave}`);
    // sincronía: en un tick común, los clientes conectados ven EXACTAMENTE lo mismo
    await sleep(500); const vivos = cs.slice(0, 3);
    const ticks = history.slice(0, 3);
    const comun = [...ticks[0].keys()].filter((t) => ticks.every((m) => m.has(t)));
    assert.ok(comun.length > 0, 'hay snapshots en común'); const t = comun[comun.length - 1];
    for (const m of ticks.slice(1)) assert.deepEqual({ ...m.get(t), events: 0 }, { ...ticks[0].get(t), events: 0 }, 'las vistas coinciden en el tick ' + t);
    // el último snapshot de cada cliente no está lejos del servidor
    for (const c of vivos) assert.ok(g.tick - c.buf[c.buf.length - 1].s.tick < 60 * 3, 'cliente al día');
    const seg = g.time; const r = bytes.slice(0, 3).map((b) => ({ crudo: b.crudo / seg / 1024, comp: b.comp / seg / 1024 }));
    console.log(`# ancho de banda por jugador (bajada): ${r.map((x) => `${x.crudo.toFixed(1)} KB/s sin comprimir / ${x.comp.toFixed(1)} KB/s comprimido`).join(' | ')}`);
    assert.ok(r[0].comp < 25, 'menos de 25 KB/s por jugador comprimido');
  } finally { for (const c of cs) c.salir(); await srv.close(); }
});

test('fin de partida: cada jugador recibe SU botín del servidor; "otra vez" vuelve al lobby', async () => {
  const srv = await startServer({ port: 0, silencio: true, velocidad: 1 });
  try {
    const a = await cliente(srv.port), b = await cliente(srv.port);
    a.send({ t: 'create', lobby: true, map: 'm1', name: 'A', char: 'axioma' }); await until(() => a.room);
    b.send({ t: 'join', room: a.room, name: 'B', char: 'vesper' }); await until(() => b.lobby);
    b.send({ t: 'ready' }); await until(() => a.lobby.players[1].ready); a.send({ t: 'start' }); assert.ok(await until(() => a.pid && b.pid, 7000));
    const g = [...srv.rooms.values()][0].game;
    for (const p of g.players) p.hp = 0, p.dead = true;   // derrota inmediata
    assert.ok(await until(() => a.fin && b.fin, 3000), 'los dos reciben «fin»');
    assert.equal(a.fin.estado, 'lost'); assert.ok(Array.isArray(a.fin.bag));
    assert.match(a.fin.matchId, /^[A-Za-z0-9_-]{8,64}$/); assert.equal(a.fin.matchId, b.fin.matchId, 'todos cobran con el mismo matchId');
    assert.equal(a.fin.resumen.estado, 'lost'); assert.equal(a.fin.resumen.jugadores.length, 2); assert.ok(a.fin.recompensa.mult >= 0.5 && a.fin.recompensa.mult <= 1.25);
    // corte de red después del final: al reanudar llega de nuevo el MISMO resultado (V02) y no se duplica ningún jugador
    const idFin = a.fin.matchId; a.fin = null; a.ws.close(4000);   // cierre "raro": el cliente reconecta solo
    assert.ok(await until(() => a.fin && a.estado === 'conectado', 8000), 'el resultado vuelve tras reconectar');
    assert.equal(a.fin.matchId, idFin); assert.equal([...srv.rooms.values()][0].game.players.length, 2); assert.equal([...srv.rooms.values()][0].members.length, 2);
    a.send({ t: 'restart' }); assert.ok(await until(() => a.lobby.fase === 'lobby' && !a.lobby.players[0].ready, 3000), 'vuelve al lobby');
  } finally { await srv.close(); }
});

test('seguridad: sin salirse de las carpetas del juego, origen permitido, tope de conexiones por red y salud con CORS', async () => {
  const http = await import('node:http'); const { default: WS } = await import('ws');
  const srv = await startServer({ port: 0, silencio: true, origenes: ['https://amigos.github.io'], maxPorIp: 3 });
  const get = (ruta, headers = {}) => new Promise((res, rej) => { const r = http.request({ host: '127.0.0.1', port: srv.port, path: ruta, headers }, (x) => { let d = ''; x.on('data', (c) => { d += c; }); x.on('end', () => res({ status: x.statusCode, body: d, h: x.headers })); }); r.on('error', rej); r.end(); });
  try {
    for (const ruta of ['/src/../server/server.js', '/public/../package.json', '/%2e%2e/package.json', '/src/%2e%2e/%2e%2e/package.json', '/assets/../../etc/passwd', '/%E0%A4%A', '/vendor/three/../../../package.json', '/node_modules/ws/package.json', '/registros/x', '/jugadores/x', '/escritorio/bin/x'])
      assert.equal((await get(ruta)).status, 404, 'no debe servir ' + ruta);
    assert.equal((await get('/public/config.json')).status, 200); assert.equal((await get('/src/sim/red.js')).status, 200);
    const h = await get('/health', { Origin: 'https://amigos.github.io' });
    assert.equal(h.status, 200); assert.equal(h.h['access-control-allow-origin'], 'https://amigos.github.io'); assert.equal(JSON.parse(h.body).proto, PROTOCOLO);
    assert.equal((await get('/health', { Origin: 'https://intruso.example' })).h['access-control-allow-origin'], undefined, 'origen no invitado: sin permiso CORS');
    const abre = (headers) => new Promise((res) => { const w = new WS(`ws://127.0.0.1:${srv.port}/ws`, { headers }); w.on('open', () => res(w)); w.on('error', () => res(null)); w.on('unexpected-response', () => res(null)); });
    assert.equal(await abre({ Origin: 'https://intruso.example' }), null, 'origen no invitado rechazado');
    const ok = []; for (let i = 0; i < 3; i++) ok.push(await abre({ Origin: 'https://amigos.github.io' })); assert.ok(ok.every(Boolean), 'las 3 primeras conexiones entran');
    assert.equal(await abre({ Origin: 'https://amigos.github.io' }), null, 'la 4ª desde la misma red se rechaza');
    ok.forEach((w) => w.close());
  } finally { await srv.close(); }
});
