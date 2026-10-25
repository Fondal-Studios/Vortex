// Regresión V02 (P0): quien se cae durante el final y reanuda recibe el resultado (mismo matchId) sólo con SU botín; ledger sin duplicar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { startServer } from '../server/server.js';
import { PROTOCOLO } from '../src/sim/red.js';

const until = async (fn, ms = 2000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (fn()) return true;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return false;
};

test('resume después del final recupera sólo el botín del jugador autenticado', { timeout: 10000 }, async () => {
  const srv = await startServer({ port: 0, silencio: true });
  const sockets = [];
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`);
    sockets.push(ws);
    const messages = [];
    ws.on('message', (raw) => messages.push(JSON.parse(raw.toString())));
    await once(ws, 'open');
    return { ws, messages, send: (m) => ws.send(JSON.stringify({ v: PROTOCOLO, ...m })) };
  };
  try {
    const a = await connect();
    a.send({ t: 'create', map: 'm1', name: 'A' });
    assert.ok(await until(() => a.messages.some((m) => m.t === 'welcome')));
    const welcomeA = a.messages.find((m) => m.t === 'welcome');
    const b = await connect();
    b.send({ t: 'join', room: welcomeA.room, name: 'B' });
    assert.ok(await until(() => b.messages.some((m) => m.t === 'welcome')));
    const welcomeB = b.messages.find((m) => m.t === 'welcome');
    const room = srv.rooms.get(welcomeA.room);
    // Fixture de finalización: no representa una victoria jugada por humanos.
    const bagA = [{ id: 'fixture-a', q: 0.4, n: 1, r: 1, src: 'test' }];
    const bagB = [{ id: 'fixture-b', q: 0.8, n: 2, r: 2, src: 'test' }];
    room.game.players.find((p) => p.id === welcomeA.pid).bag = bagA;
    room.game.players.find((p) => p.id === welcomeB.pid).bag = bagB;
    a.ws.terminate();
    assert.ok(await until(() => !room.members.find((m) => m.pid === welcomeA.pid).ws));
    room.game.state = 'won';
    assert.ok(await until(() => b.messages.some((m) => m.t === 'fin')));
    assert.deepEqual(b.messages.find((m) => m.t === 'fin').bag, bagB);
    const resumed = await connect();
    resumed.send({ t: 'resume', room: welcomeA.room, token: welcomeA.token });
    assert.ok(await until(() => resumed.messages.some((m) => m.t === 'welcome')));
    assert.ok(await until(() => resumed.messages.some((m) => m.t === 'fin')), 'debe recuperar el resultado que perdió durante el corte');
    const result = resumed.messages.find((m) => m.t === 'fin');
    assert.equal(result.estado, 'won');
    assert.equal(result.oleada, room.game.wave);
    assert.deepEqual(result.bag, bagA, 'no revela el botín del compañero');
    assert.equal(resumed.messages.filter((m) => m.t === 'fin').length, 1);
    assert.match(result.matchId, /^[A-Za-z0-9_-]{8,64}$/, 'el resultado trae el matchId');
    assert.equal(result.matchId, b.messages.find((m) => m.t === 'fin').matchId, 'mismo matchId para todos: acreditar dos veces no suma');
    assert.equal(result.recompensa.base >= 0.5, true);
    assert.equal(room.game.players.length, 2, 'reanudar no duplica jugadores');
    // un segundo resume (reintento de red) reenvía el mismo resultado, sin jugadores nuevos
    const otra = await connect();
    otra.send({ t: 'resume', room: welcomeA.room, token: welcomeA.token });
    assert.ok(await until(() => otra.messages.some((m) => m.t === 'fin')));
    assert.equal(otra.messages.find((m) => m.t === 'fin').matchId, result.matchId);
    assert.equal(room.game.players.length, 2);
    assert.equal(room.members.length, 2);
  } finally {
    for (const ws of sockets) ws.terminate();
    await srv.close();
  }
});

test('la sala terminada y vacía se cierra sola (cierre limpio)', { timeout: 10000 }, async () => {
  const srv = await startServer({ port: 0, silencio: true, graciaMs: 50 });
  const sockets = [];
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`); sockets.push(ws);
    const msgs = []; ws.on('message', (r) => msgs.push(JSON.parse(r.toString()))); await once(ws, 'open');
    ws.send(JSON.stringify({ v: PROTOCOLO, t: 'create', map: 'm1', name: 'Solo' }));
    assert.ok(await until(() => msgs.some((m) => m.t === 'welcome')));
    const room = srv.rooms.get(msgs.find((m) => m.t === 'welcome').room);
    room.game.state = 'lost';
    assert.ok(await until(() => msgs.some((m) => m.t === 'fin')));
    assert.equal(msgs.find((m) => m.t === 'fin').estado, 'lost');
    assert.equal(srv.rooms.size, 1);
    ws.terminate();
    assert.ok(await until(() => srv.rooms.size === 0, 6000));
  } finally { for (const w of sockets) w.terminate(); await srv.close(); }
});
