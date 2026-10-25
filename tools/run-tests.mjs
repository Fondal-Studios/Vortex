// Ejecutor de pruebas por grupos (lo usan `npm run test:unit`, `test:browser` y `test:ci`; ver docs/OPERATIONS.md).
//   unit    → pruebas de simulación/servidor/datos que NO necesitan navegador (rápidas).
//   browser → archivos que importan `browserAvailable` de tools/browser.js (E2E con Chromium). Con REQUIRE_BROWSER=1 FALLAN si falta Chromium.
//   all     → unit y luego browser (lo que corre `npm run test:ci`).
// Uso: node tools/run-tests.mjs <unit|browser|all> [--concurrency=N] [--shard=I/N]
//   --shard=I/N reparte los archivos del grupo en N partes de coste parecido (reparto voraz por peso) y corre sólo la parte I (1..N). El CI lo usa para dividir el trabajo `browser` en una matriz.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const grupo = process.argv[2] || 'all';
const conc = (process.argv.find((a) => a.startsWith('--concurrency=')) || '--concurrency=1').split('=')[1];
const shardArg = (process.argv.find((a) => a.startsWith('--shard=')) || '').split('=')[1];
if (!['unit', 'browser', 'all'].includes(grupo)) { console.error('Uso: node tools/run-tests.mjs <unit|browser|all>'); process.exit(2); }

const dirTests = path.join(raiz, 'tests');
const todos = fs.readdirSync(dirTests).filter((f) => f.endsWith('.test.js')).sort();
const usaNavegador = (f) => fs.readFileSync(path.join(dirTests, f), 'utf8').includes('browserAvailable');
const unit = todos.filter((f) => !usaNavegador(f)), browserTodos = todos.filter(usaNavegador);

// Peso aproximado (minutos en CI, Chromium por software) de los E2E lentos; el resto pesa 1. Sirve sólo para repartir en partes parejas.
const PESO = { 'arenas-vivas-render.test.js': 4, 'base-render.test.js': 6, 'camara.test.js': 4, 'controles.test.js': 9, 'onboarding-browser.test.js': 4, 'recorrido-menu.test.js': 3 };
function particion(lista, i, n) {
  const partes = Array.from({ length: n }, () => ({ w: 0, f: [] }));
  for (const f of [...lista].sort((a, b) => (PESO[b] || 1) - (PESO[a] || 1) || a.localeCompare(b))) { const m = partes.reduce((x, y) => (y.w < x.w ? y : x)); m.f.push(f); m.w += PESO[f] || 1; }
  return partes[i - 1].f.sort();
}
let browser = browserTodos;
if (shardArg) {
  const [i, n] = shardArg.split('/').map(Number);
  if (!(n >= 1 && i >= 1 && i <= n)) { console.error('--shard debe ser I/N con 1 <= I <= N'); process.exit(2); }
  browser = particion(browserTodos, i, n); console.log(`(parte ${i}/${n} del grupo browser: ${browser.join(', ')})`);
}

function correr(nombre, archivos, extraEnv = {}) {
  console.log(`\n=== ${nombre}: ${archivos.length} archivos ===`);
  const r = spawnSync(process.execPath, ['--expose-gc', '--test', `--test-concurrency=${conc}`, ...archivos.map((f) => path.join('tests', f))], { cwd: raiz, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  return r.status === null ? 1 : r.status;
}

let estado = 0;
if (grupo === 'unit' || grupo === 'all') estado ||= correr('unit', unit);
if (grupo === 'browser' || grupo === 'all') { const e = correr('browser', browser, { REQUIRE_BROWSER: process.env.REQUIRE_BROWSER ?? (process.env.CI ? '1' : '') }); estado ||= e; }
process.exit(estado);
