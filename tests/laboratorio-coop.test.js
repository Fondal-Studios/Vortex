// EH-14 · Coop con diseños del Laboratorio: servidor real + clientes reales (NetClient) por WebSocket. Sin navegador.
// Cubre: lobby/welcome/labs con VB1, MISMA huella en todos los clientes, validación en el servidor (build corrupta ⇒ chasis por defecto sin expulsar),
// maxPayload 8192, PROTOCOLO 6 (cliente viejo rechazado limpiamente), entrada tardía, tamaños de mensaje.
import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { startServer } from '../server/server.js';
import { NetClient } from '../src/client/net.js';
import { PROTOCOLO, ERRORES } from '../src/sim/red.js';
import { defecto, codificar, decodificar, huella, PARTES } from '../src/shared/host-build.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(15); } return false; };
async function cliente(port) { const c = new NetClient(); await c.connect(`ws://127.0.0.1:${port}/ws`); return c; }
const pieza = (p, a, o = {}) => ({ p, a, sim: 'ninguna', t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 }, c: { mat: PARTES[p].variantesMat[0], tinte: null }, ...o });
const build = (id, partes = [], extra = {}) => ({ ...defecto(), id, nombre: 'Coop ' + id.slice(4), partes, ...extra });
const A = build('lab-coopaaaa1', [pieza('cuerno_curvo', 'cabeza', { sim: 'espejo' }), pieza('placas', 'pecho')], { prop: { altura: 1.1, ancho: 0.95 } });
const B = build('lab-coopbbbb2', [pieza('alas_membrana', 'espalda'), pieza('adrenal', 'cintura')], { pal: { primario: '#336699', secundario: '#112233', emisivo: '#ff0000', acabado: 'obsidiana' } });
const vA = codificar(A), vB = codificar(B), hA = huella(A), hB = huella(B);
const mem = (srv) => [...srv.rooms.values()][0];

test('PROTOCOLO 6: el servidor lo anuncia y un cliente de versión vieja (5) recibe el error de versión, claro y sin colgarse', async () => {
  assert.equal(PROTOCOLO, 6);
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`), msgs = [];
    await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); }); ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
    ws.send(JSON.stringify({ t: 'create', v: 5, map: 'm1', name: 'Viejo', char: 'laboratorio', lab: vA }));
    assert.ok(await until(() => msgs.some((m) => m.t === 'error')));
    const e = msgs.find((m) => m.t === 'error'); assert.equal(e.code, 'version'); assert.equal(e.servidor, 6); assert.equal(e.msg, ERRORES.version); assert.equal(srv.rooms.size, 0);
    ws.send(JSON.stringify({ t: 'create', v: PROTOCOLO, map: 'm1', name: 'Nuevo', lobby: true })); assert.ok(await until(() => msgs.some((m) => m.t === 'lobby')));
    ws.close();
  } finally { await srv.close(); }
});

test('lobby: cada jugador ve el diseño del otro (VB1 + huella) y las dos huellas coinciden en AMBOS clientes', async () => {
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const a = await cliente(srv.port), b = await cliente(srv.port);
    a.send({ t: 'create', lobby: true, map: 'm1', name: 'Ana', char: 'laboratorio', evo: 1, lab: vA });
    assert.ok(await until(() => a.lobby && a.room));
    b.send({ t: 'join', room: a.room, name: 'Beto', char: 'laboratorio', evo: 1, lab: vB });
    assert.ok(await until(() => a.lobby && b.lobby && a.lobby.players.length === 2 && b.lobby.players.length === 2));
    for (const c of [a, b]) {
      const [pa, pb] = c.lobby.players; assert.equal(pa.lab.h, hA); assert.equal(pb.lab.h, hB);
      assert.equal(huella(decodificar(pa.lab.vb1).build), hA, 'el cliente recalcula la huella desde VB1'); assert.equal(huella(decodificar(pb.lab.vb1).build), hB);
    }
    assert.deepEqual(a.lobby.players.map((p) => p.lab), b.lobby.players.map((p) => p.lab));
    // cambiar de diseño en el lobby se difunde
    b.send({ t: 'pick', char: 'laboratorio', evo: 1, lab: vA });
    assert.ok(await until(() => a.lobby.players[1].lab && a.lobby.players[1].lab.h === hA));
    // y un cambio a un oficial quita el diseño
    b.send({ t: 'pick', char: 'axioma', lab: vA });
    assert.ok(await until(() => a.lobby.players[1].char === 'axioma')); assert.equal(a.lobby.players[1].lab, undefined);
    a.salir(); b.salir();
  } finally { await srv.close(); }
});

test('partida: ambos clientes reciben `labs` con la MISMA huella y el snapshot trae el índice `lb` de cada jugador', async () => {
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const a = await cliente(srv.port), b = await cliente(srv.port);
    a.send({ t: 'create', map: 'm1', name: 'Ana', char: 'laboratorio', evo: 1, lab: vA });                       // sin lobby: empieza ya
    assert.ok(await until(() => a.pid && a.room));
    b.send({ t: 'join', room: a.room, name: 'Beto', char: 'laboratorio', evo: 1, lab: vB });                      // entra con la partida en marcha
    assert.ok(await until(() => b.pid && a.buf.length > 5 && b.buf.length > 5 && a.labs.length === 2 && b.labs.length === 2));
    assert.deepEqual(a.labs, b.labs, 'las dos vistas de la lista son idénticas');
    for (const c of [a, b]) {
      const s = c.buf[c.buf.length - 1].s, pa = s.players.find((p) => p.id === a.pid), pb = s.players.find((p) => p.id === b.pid);
      assert.equal(pa.char, 'laboratorio'); assert.ok(pa.lb >= 1 && pb.lb >= 1 && pa.lb !== pb.lb);
      assert.equal(c.labs.find((l) => l.i === pa.lb).h, hA); assert.equal(c.labs.find((l) => l.i === pb.lb).h, hB);
      assert.equal(huella(decodificar(c.labs.find((l) => l.i === pa.lb).vb1).build), hA); assert.equal(huella(decodificar(c.labs.find((l) => l.i === pb.lb).vb1).build), hB);
    }
    // la simulación del servidor tiene los órganos de cada diseño (derivados del VB1, no de lo que diga el cliente)
    const g = mem(srv).game, pa = g.players.find((p) => p.id === a.pid), pb = g.players.find((p) => p.id === b.pid);
    assert.deepEqual(pa.corg, ['placas']); assert.deepEqual(pb.corg, ['adrenal']);
    a.salir(); b.salir();
  } finally { await srv.close(); }
});

test('servidor manda: capacidad de más (2 funcionales con evo 0) ⇒ chasis por defecto + aviso en español, SIN expulsar y la partida sigue', async () => {
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const a = await cliente(srv.port), avisos = [];
    const exceso = codificar(build('lab-coopcccc3', [pieza('placas', 'pecho'), pieza('adrenal', 'cintura')]));
    a.send({ t: 'create', map: 'm1', name: 'Ana', char: 'laboratorio', evo: 0, lab: exceso });
    a.welcomed = (m) => avisos.push(m.labAviso);
    assert.ok(await until(() => a.pid && a.buf.length > 3));
    assert.ok(a.labAviso && a.labAviso.includes('Híbrido de Laboratorio'), 'aviso: ' + a.labAviso);
    const s = a.buf[a.buf.length - 1].s, yo = s.players.find((p) => p.id === a.pid); assert.equal(yo.lb, undefined); assert.equal(a.labs.length, 0);
    assert.deepEqual(mem(srv).game.players[0].corg, []); assert.equal(a.estado, 'conectado');
    const n = a.buf.length; assert.ok(await until(() => a.buf.length > n + 3), 'la partida sigue');
    a.salir();
  } finally { await srv.close(); }
});

test('build corrupta o hostil ⇒ aspecto por defecto, sin excepción en el servidor y sin cortar a los demás', async () => {
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const a = await cliente(srv.port); a.send({ t: 'create', lobby: true, map: 'm1', name: 'Ana', char: 'laboratorio', evo: 0, lab: vA }); assert.ok(await until(() => a.room));
    const malos = [vA.slice(0, 30), 'VB1:' + 'A'.repeat(500), 'basura', { partes: [{ p: '__proto__' }] }, ['x'], 5, true, 'x'.repeat(5000), vA.replace(/.$/, '!'), '\u0000VB1:', 'VB1:' + vA.slice(4).split('').reverse().join('')];
    for (const [i, lab] of malos.entries()) {
      const c = await cliente(srv.port); c.send({ t: 'join', room: a.room, name: 'Hostil' + i, char: 'laboratorio', evo: 0, lab });
      if (!(await until(() => c.lobby && c.lobby.players.length >= 2))) assert.fail('no entró ' + i);
      const yo = c.lobby.players.find((p) => p.name === 'Hostil' + i); assert.ok(yo, 'sigue en la sala ' + i);
      if (yo.lab) assert.equal(yo.lab.h, huella(decodificar(yo.lab.vb1).build)); else assert.ok(yo.labAviso && yo.labAviso.includes('Híbrido'), 'aviso ' + i);
      c.salir(); await until(() => a.lobby.players.length === 1);
    }
    assert.equal(a.estado, 'conectado'); assert.equal(a.lobby.players[0].lab.h, hA, 'el anfitrión no se vio afectado');
    a.salir();
  } finally { await srv.close(); }
});

test('maxPayload 8192: un mensaje más grande corta SOLO esa conexión; el servidor y los demás siguen', async () => {
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const a = await cliente(srv.port); a.send({ t: 'create', lobby: true, map: 'm1', name: 'Ana', char: 'laboratorio', lab: vA }); assert.ok(await until(() => a.room));
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`); await new Promise((r) => ws.on('open', r));
    const cierre = new Promise((r) => ws.on('close', (code) => r(code)));
    ws.send(JSON.stringify({ t: 'join', v: PROTOCOLO, room: a.room, name: 'Gigante', char: 'laboratorio', lab: 'VB1:' + 'A'.repeat(9000) }));
    assert.equal(await Promise.race([cierre, sleep(3000).then(() => 'timeout')]), 1009, 'cierre por mensaje demasiado grande');
    assert.equal(a.estado, 'conectado'); assert.equal(a.lobby.players.length, 1);
    const b = await cliente(srv.port); b.send({ t: 'join', room: a.room, name: 'Normal', char: 'laboratorio', lab: vB }); assert.ok(await until(() => b.lobby && b.lobby.players.length === 2));
    a.salir(); b.salir();
  } finally { await srv.close(); }
});

test('tamaños reales: el diseño más grande cabe en ≤ 2 KB; `create` ≤ 8192 y el `lobby` de 4 jugadores con diseños llenos ≤ 8192 bytes', async () => {
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const grande = (id) => build(id, [
      pieza('cuerno_curvo', 'cabeza', { sim: 'espejo', c: { mat: 'metal', tinte: '#aabbcc' } }), pieza('gorguera', 'cuello'), pieza('hombrera_espinas', 'hombros', { sim: 'espejo' }), pieza('placa_pectoral', 'pecho'),
      pieza('espinas_dorsales', 'espalda'), pieza('cuchilla_antebrazo', 'antebrazos', { sim: 'espejo' }), pieza('rodillera_placa', 'muslos', { sim: 'espejo' }), pieza('garras_mano', 'manos', { l: 'izq' }), pieza('cola_larga', 'cola'), pieza('placas', 'espalda'),
    ], { nombre: 'Ñ'.repeat(24) });
    const txts = [1, 2, 3, 4].map((i) => codificar(grande('lab-grande000' + i)));
    for (const t of txts) assert.ok(t.length <= 2048, 'VB1 ' + t.length);
    const create = JSON.stringify({ t: 'create', v: PROTOCOLO, lobby: true, map: 'm1', name: 'x'.repeat(16), char: 'laboratorio', evo: 4, lab: txts[0], equip: [], bend: [], herb: [] }); assert.ok(create.length < 8192);
    const crudos = [], ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`); await new Promise((r) => ws.on('open', r)); ws.on('message', (d) => crudos.push(String(d)));
    ws.send(create); assert.ok(await until(() => crudos.length));
    const extra = []; for (let i = 1; i < 4; i++) { const c = await cliente(srv.port); c.send({ t: 'join', room: JSON.parse(crudos[0]).room, name: 'J' + i, char: 'laboratorio', evo: 4, lab: txts[i] }); extra.push(c); }
    assert.ok(await until(() => crudos.some((m) => JSON.parse(m).players && JSON.parse(m).players.length === 4)));
    const ult = crudos.filter((m) => JSON.parse(m).players && JSON.parse(m).players.length === 4).pop(), bytes = Buffer.byteLength(ult);
    assert.ok(bytes < 8192, 'lobby de 4: ' + bytes + ' bytes'); assert.ok(JSON.parse(ult).players.every((p) => p.lab && p.lab.vb1.startsWith('VB1:')));
    for (const c of extra) c.salir(); ws.close();
  } finally { await srv.close(); }
});

test('reconexión: al volver con el token, la bienvenida trae de nuevo la lista de diseños (`labs`)', async () => {
  const srv = await startServer({ port: 0, silencio: true, graciaMs: 5000 });
  try {
    const a = await cliente(srv.port); a.send({ t: 'create', map: 'm1', name: 'Ana', char: 'laboratorio', evo: 1, lab: vA }); assert.ok(await until(() => a.pid && a.token && a.labs.length === 1));
    const { room, token } = a; a.salida = true; a.ws.close(4001);   // corte «raro»: el servidor guarda el lugar
    const ws = new WebSocket(`ws://127.0.0.1:${srv.port}/ws`), msgs = []; await new Promise((r) => ws.on('open', r)); ws.on('message', (d) => msgs.push(JSON.parse(String(d))));
    ws.send(JSON.stringify({ t: 'resume', v: PROTOCOLO, room, token }));
    assert.ok(await until(() => msgs.some((m) => m.t === 'welcome')));
    const w = msgs.find((m) => m.t === 'welcome'); assert.equal(w.reanudado, true); assert.equal(w.labs.length, 1); assert.equal(w.labs[0].h, hA);
    ws.close();
  } finally { await srv.close(); }
});

test('el laboratorio sin diseño (o un oficial con `lab`) entra normal: sin `lb`, sin aviso', async () => {
  const srv = await startServer({ port: 0, silencio: true });
  try {
    const a = await cliente(srv.port); a.send({ t: 'create', map: 'm1', name: 'Ana', char: 'laboratorio' }); assert.ok(await until(() => a.pid && a.buf.length > 2));
    const b = await cliente(srv.port); b.send({ t: 'join', room: a.room, name: 'Beto', char: 'vesper', lab: vA }); assert.ok(await until(() => b.pid && b.buf.length > 2));
    assert.equal(a.labs.length, 0); assert.equal(b.labAviso, ''); const s = b.buf[b.buf.length - 1].s; assert.ok(s.players.every((p) => p.lb === undefined));
    a.salir(); b.salir();
  } finally { await srv.close(); }
});
