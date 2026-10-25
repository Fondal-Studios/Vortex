// ALLOWED_ORIGINS: por defecto restrictivo en producción (docs/OPERATIONS.md), abierto en desarrollo/pruebas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { startServer, origenesPorDefecto, ORIGEN_PAGES } from '../server/server.js';

test('origenesPorDefecto: abierto en desarrollo, solo Pages en producción', () => {
  assert.deepEqual(origenesPorDefecto({}), []);
  assert.deepEqual(origenesPorDefecto({ NODE_ENV: 'production' }), [ORIGEN_PAGES]);
  assert.deepEqual(origenesPorDefecto({ RENDER: 'true' }), [ORIGEN_PAGES]);
  assert.equal(ORIGEN_PAGES, 'https://fondal-studios.github.io');
});

const conectar = (port, origin) => new Promise((resolve) => {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers: origin ? { Origin: origin } : {} });
  ws.on('open', () => { ws.close(); resolve(true); }); ws.on('error', () => resolve(false)); ws.on('unexpected-response', () => resolve(false));
});

test('servidor con orígenes restrictivos: acepta Pages y su propio sitio; rechaza otros; sin Origin (no navegador) pasa', async () => {
  const srv = await startServer({ port: 0, autoTick: false, origenes: [ORIGEN_PAGES] });
  try {
    assert.equal(await conectar(srv.port, ORIGEN_PAGES), true);
    assert.equal(await conectar(srv.port, `http://127.0.0.1:${srv.port}`), true, 'el propio sitio');
    assert.equal(await conectar(srv.port, 'https://malo.example'), false);
    assert.equal(await conectar(srv.port, null), true);
  } finally { await srv.close(); }
});
