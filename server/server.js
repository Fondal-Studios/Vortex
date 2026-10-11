// Servidor estático + WebSocket autoritativo (cooperativo 2–4 jugadores).
// Los clientes sólo mandan entradas; la simulación (src/sim) corre acá.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game } from '../src/sim/game.js';
import { MAPS } from '../src/sim/maps.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
export const SIM_DT = 1 / 60, SNAP_EVERY = 3; // 60 Hz de simulación, 20 Hz de snapshots

function resolveFile(url) {
  let p = decodeURIComponent(url.split('?')[0]);
  if (p === '/') p = '/public/index.html';
  if (p.startsWith('/vendor/three/')) return path.join(ROOT, 'node_modules/three/build', p.slice('/vendor/three/'.length));
  if (p.startsWith('/vendor/three-addons/')) return path.join(ROOT, 'node_modules/three/examples/jsm', p.slice('/vendor/three-addons/'.length));
  if (p.startsWith('/public/') || p.startsWith('/src/') || p.startsWith('/assets/')) return path.join(ROOT, p);
  if (/^\/[\w.-]+\.(html|css|js)$/.test(p)) return path.join(ROOT, 'public', p);
  return null;
}

export function startServer({ port = 8080, host = '0.0.0.0', autoTick = true } = {}) {
  const rooms = new Map();
  const server = http.createServer((req, res) => {
    if (req.url === '/health') { res.writeHead(200); return res.end('ok'); }
    const f = resolveFile(req.url);
    if (!f || !f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no encontrado'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

  const send = (ws, o) => { if (ws.readyState === 1) ws.send(typeof o === 'string' ? o : JSON.stringify(o)); };

  function makeRoom(code, mapId) {
    const room = { code, mapId, game: new Game({ mapId, seed: (Math.random() * 1e9) | 0 }), clients: new Map(), acc: 0, last: Date.now() };
    rooms.set(code, room);
    return room;
  }
  function join(ws, room, name) {
    const p = room.game.addPlayer(name);
    if (!p) return send(ws, { t: 'error', msg: 'sala llena' });
    room.clients.set(ws, p.id);
    ws.room = room;
    send(ws, { t: 'welcome', pid: p.id, room: room.code, map: room.mapId, dt: SIM_DT });
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m.t === 'create') {
        if (ws.room) return;
        const map = MAPS[m.map] ? m.map : 'm1';
        const code = String((Math.random() * 9000 + 1000) | 0);
        join(ws, makeRoom(code, map), String(m.name || 'jugador').slice(0, 16));
      } else if (m.t === 'join') {
        const room = rooms.get(String(m.room));
        if (!room || ws.room) return send(ws, { t: 'error', msg: 'sala inexistente' });
        join(ws, room, String(m.name || 'jugador').slice(0, 16));
      } else if (m.t === 'in' && ws.room) {
        const pid = ws.room.clients.get(ws);
        if (pid && m.i && typeof m.i === 'object') ws.room.game.setInput(pid, m.i);
      } else if (m.t === 'restart' && ws.room && ws.room.game.state !== 'playing') {
        const room = ws.room;
        room.game = new Game({ mapId: room.mapId, seed: (Math.random() * 1e9) | 0 });
        for (const [c] of room.clients) { const p = room.game.addPlayer(); room.clients.set(c, p.id); send(c, { t: 'welcome', pid: p.id, room: room.code, map: room.mapId, dt: SIM_DT }); }
      }
    });
    ws.on('close', () => {
      const room = ws.room; if (!room) return;
      room.game.removePlayer(room.clients.get(ws)); room.clients.delete(ws);
      if (!room.clients.size) rooms.delete(room.code);
    });
  });

  /** Avanza todas las salas `n` pasos fijos (los tests lo llaman a mano). */
  function tickRooms(n = 1) {
    for (const room of rooms.values()) for (let i = 0; i < n; i++) {
      room.game.step(SIM_DT);
      if (room.game.tick % SNAP_EVERY === 0) {
        const msg = JSON.stringify({ t: 'snap', s: room.game.snapshot() });
        for (const [ws] of room.clients) send(ws, msg);
      }
    }
  }
  let timer = null;
  if (autoTick) timer = setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      room.acc = Math.min(0.25, room.acc + (now - room.last) / 1000); room.last = now;
      while (room.acc >= SIM_DT) {
        room.acc -= SIM_DT; room.game.step(SIM_DT);
        if (room.game.tick % SNAP_EVERY === 0) {
          const msg = JSON.stringify({ t: 'snap', s: room.game.snapshot() });
          for (const [ws] of room.clients) send(ws, msg);
        }
      }
    }
  }, 8);

  return new Promise((resolve) => server.listen(port, host, () => resolve({
    port: server.address().port, rooms, tickRooms,
    close: () => new Promise((r) => { if (timer) clearInterval(timer); for (const c of wss.clients) c.terminate(); wss.close(); server.close(() => r()); }),
  })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = +process.env.PORT || 8080;
  startServer({ port }).then((s) => console.log(`Cristal Vórtice en http://localhost:${s.port}`));
}
