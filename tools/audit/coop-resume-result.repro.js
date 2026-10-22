// Diagnóstico de un defecto conocido: ejecutar con node --test tools/audit/coop-resume-result.repro.js.
// Actualmente FALLA por resultado ausente al reanudar; fuera de la suite de regresión hasta corregir idempotencia.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { startServer } from '../../server/server.js';
import { PROTOCOLO } from '../../src/sim/red.js';

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
  } finally {
    for (const ws of sockets) ws.terminate();
    await srv.close();
  }
});
