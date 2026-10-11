import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server/server.js';
import { NetClient } from '../src/client/net.js';
import { dist } from '../src/sim/math.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 3000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(15); } return false; };
async function client(port) { const c = new NetClient(); await c.connect(`ws://127.0.0.1:${port}/ws`); return c; }

test('cooperativo: crear sala, unirse, ambos clientes ven la misma partida (2 jugadores)', async () => {
  const srv = await startServer({ port: 0 });
  try {
    const a = await client(srv.port), b = await client(srv.port);
    a.send({ t: 'create', map: 'm1', name: 'A' }); assert.ok(await until(() => a.pid && a.room));
    b.send({ t: 'join', room: a.room, name: 'B' }); assert.ok(await until(() => b.pid));
    assert.notEqual(a.pid, b.pid);
    assert.ok(await until(() => a.buf.length > 5 && b.buf.length > 5), 'ambos reciben snapshots');
    const last = (c) => c.buf[c.buf.length - 1].s;
    assert.equal(last(a).players.length, 2); assert.equal(last(b).players.length, 2);
    // mismos snapshots bit a bit para el mismo tick (el servidor es la única fuente de verdad)
    const common = a.buf.map((x) => x.s).find((s) => b.buf.some((y) => y.s.tick === s.tick));
    assert.ok(common); const twin = b.buf.find((y) => y.s.tick === common.tick).s;
    assert.deepEqual({ ...common, events: 0 }, { ...twin, events: 0 });
  } finally { await srv.close(); }
});

test('cooperativo: cada cliente controla sólo a su jugador; sin desincronización grave entre vistas', async () => {
  const srv = await startServer({ port: 0 });
  try {
    const a = await client(srv.port), b = await client(srv.port);
    a.send({ t: 'create', map: 'm2', name: 'A' }); await until(() => a.room);
    b.send({ t: 'join', room: a.room, name: 'B' }); await until(() => b.pid && a.buf.length && b.buf.length);
    const room = [...srv.rooms.values()][0]; const g = room.game;
    const pa0 = g.players.find((p) => p.id === a.pid).pos, pb0 = { ...g.players.find((p) => p.id === b.pid).pos }; const pa0c = { ...pa0 };
    // A camina hacia adelante y gira; B se queda quieto y dispara
    let drift = 0, samples = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 3500) {
      a.send({ t: 'in', i: { mz: 1, dyaw: 0.02 } }); b.send({ t: 'in', i: { fire: true } });
      await sleep(33);
      const va = a.view(), vb = b.view();
      if (va && vb) { // las dos vistas interpoladas del mismo mundo deben coincidir
        for (const p of va.players) { const q = vb.players.find((x) => x.id === p.id); drift = Math.max(drift, dist({ x: p.pos[0], y: p.pos[1], z: p.pos[2] }, { x: q.pos[0], y: q.pos[1], z: q.pos[2] })); }
        samples++;
      }
    }
    const pa = g.players.find((p) => p.id === a.pid).pos, pb = g.players.find((p) => p.id === b.pid).pos;
    assert.ok(dist(pa, pa0c) > 10, 'A se movió'); assert.ok(dist(pb, pb0) < 1.0, 'B no se movió por entradas de A');
    console.log(`# coop: ${samples} muestras, divergencia máxima entre las dos vistas ${drift.toFixed(2)} u; snapshots A=${a.stats.snaps} B=${b.stats.snaps} (~${(a.stats.snaps / 3.6).toFixed(0)}/s)`);
    assert.ok(drift < 1.5, `divergencia ${drift}`);
    // la vista de A no se atrasa más de ~0.35 s respecto del servidor
    const sv = a.buf[a.buf.length - 1].s; assert.ok(g.tick - sv.tick < 60 * 0.35, `retraso ${g.tick - sv.tick} ticks`);
  } finally { await srv.close(); }
});

test('cooperativo: sala llena (5º cliente rechazado), desconexión limpia y sala vacía se elimina', async () => {
  const srv = await startServer({ port: 0 });
  try {
    const cs = []; for (let i = 0; i < 5; i++) cs.push(await client(srv.port));
    cs[0].send({ t: 'create', map: 'm1' }); await until(() => cs[0].room);
    let err = null; cs[4].onError = (m) => { err = m; };
    for (let i = 1; i < 5; i++) { cs[i].send({ t: 'join', room: cs[0].room }); await sleep(40); }
    assert.ok(await until(() => err === 'sala llena'), 'el 5º jugador es rechazado'); assert.equal([...srv.rooms.values()][0].game.players.length, 4);
    cs[1].ws.close(); assert.ok(await until(() => [...srv.rooms.values()][0].game.players.length === 3), 'se quita al jugador desconectado');
    for (const c of cs) c.ws.close(); assert.ok(await until(() => srv.rooms.size === 0), 'la sala vacía se elimina');
  } finally { await srv.close(); }
});

test('cooperativo: el servidor ignora entradas malformadas y no se cae', async () => {
  const srv = await startServer({ port: 0 });
  try {
    const a = await client(srv.port); a.send({ t: 'create', map: 'm1' }); await until(() => a.pid);
    a.ws.send('esto no es json'); a.ws.send(JSON.stringify({ t: 'in', i: { mx: 'hola', dyaw: 1e308, jump: 1, weapon: 99 } })); a.ws.send(JSON.stringify({ t: 'in', i: null }));
    await sleep(300);
    const g = [...srv.rooms.values()][0].game; const p = g.players[0];
    assert.ok(Number.isFinite(p.pos.x) && Number.isFinite(p.heading.x));
    assert.ok(await until(() => a.buf.length > 3 && a.buf[a.buf.length - 1].s.tick > 20), 'sigue emitiendo snapshots');
  } finally { await srv.close(); }
});
