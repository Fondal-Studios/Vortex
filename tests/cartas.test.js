import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));

// Las tarjetas de mejora (y los carteles de tutorial, pausa, final y caído) entran SIN recortes en 844×390, 667×375, 390×844, 1280×720 y 1920×1080.
test('tarjetas de mejora y carteles: ningún elemento queda fuera de la pantalla en 5 tamaños', { skip: !hasChromium, timeout: 400000 }, () => {
  const r = spawnSync('node', ['tools/shot-cartas.js', 'shots/cartas'], { encoding: 'utf8', timeout: 380000 });
  const out = (r.stdout || '') + (r.stderr || '');
  for (const t of ['844x390', '667x375', '390x844', '1280x720', '1920x1080']) assert.match(out, new RegExp(`${t} tarjetas`), `se revisó ${t}`);
  assert.equal(r.status, 0, `Tarjetas con recortes:\n${out}`);
});

// Percepción de caída y bordes (aviso de borde, vacío debajo, viñeta, caer al vacío y reaparecer).
test('caída y bordes: avisos de borde, vacío, viñeta y reaparición', { skip: !hasChromium, timeout: 200000 }, () => {
  const r = spawnSync('node', ['tools/shot-caida.js', 'shots/caida'], { encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '') + (r.stderr || '');
  assert.equal(r.status, 0, `Caída con problemas:\n${out}`);
});
