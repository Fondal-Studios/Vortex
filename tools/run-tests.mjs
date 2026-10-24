// Ejecutor de pruebas por grupos (lo usan `npm run test:unit`, `test:browser` y `test:ci`; ver docs/OPERATIONS.md).
//   unit    → pruebas de simulación/servidor/datos que NO necesitan navegador (rápidas).
//   browser → archivos que importan `browserAvailable` de tools/browser.js (E2E con Chromium). Con REQUIRE_BROWSER=1 FALLAN si falta Chromium.
//   all     → unit y luego browser (lo que corre `npm run test:ci`).
// Uso: node tools/run-tests.mjs <unit|browser|all> [--concurrency=N]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const grupo = process.argv[2] || 'all';
const conc = (process.argv.find((a) => a.startsWith('--concurrency=')) || '--concurrency=1').split('=')[1];
if (!['unit', 'browser', 'all'].includes(grupo)) { console.error('Uso: node tools/run-tests.mjs <unit|browser|all>'); process.exit(2); }

const dirTests = path.join(raiz, 'tests');
const todos = fs.readdirSync(dirTests).filter((f) => f.endsWith('.test.js')).sort();
const usaNavegador = (f) => fs.readFileSync(path.join(dirTests, f), 'utf8').includes('browserAvailable');
const unit = todos.filter((f) => !usaNavegador(f)), browser = todos.filter(usaNavegador);

function correr(nombre, archivos, extraEnv = {}) {
  console.log(`\n=== ${nombre}: ${archivos.length} archivos ===`);
  const r = spawnSync(process.execPath, ['--expose-gc', '--test', `--test-concurrency=${conc}`, ...archivos.map((f) => path.join('tests', f))], { cwd: raiz, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  return r.status === null ? 1 : r.status;
}

let estado = 0;
if (grupo === 'unit' || grupo === 'all') estado ||= correr('unit', unit);
if (grupo === 'browser' || grupo === 'all') { const e = correr('browser', browser, { REQUIRE_BROWSER: process.env.REQUIRE_BROWSER ?? (process.env.CI ? '1' : '') }); estado ||= e; }
process.exit(estado);
