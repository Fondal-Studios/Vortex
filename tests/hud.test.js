import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));

// El HUD y los botones táctiles NO deben superponerse ni salirse de la pantalla en PC, iPhone SE, 13 y 15 Pro Max (horizontal).
test('HUD móvil y de PC: sin solapes entre botones ni elementos fuera de pantalla', { skip: !hasChromium, timeout: 480000 }, () => {
  const r = spawnSync('node', ['tools/shot-hud.js', 'shots/hud'], { encoding: 'utf8', timeout: 450000 });
  const out = (r.stdout || '') + (r.stderr || '');
  assert.equal(r.status, 0, `HUD con problemas:\n${out}`);
  // los botones nuevos (MELEE, HAB.3, ULTI) existen en los 3 preajustes de dedos y el editor puede moverlos
  for (const vn of ['iphoneSE', 'iphone13', 'iphone15pm']) {
    for (const n of [2, 3, 4]) assert.match(out, new RegExp(`${vn}\\s+${n} dedos \\d+ botones\\s*sin solapes`), `${vn}: ${n} dedos sin solapes`);
    assert.match(out, new RegExp(`${vn}\\s+editor mueve MELEE: -30px 20px ok`), `${vn}: el editor mueve MELEE`);
  }
});

// Los menús deben tener botón «Volver» en cada pantalla y no desbordar horizontalmente en celular.
test('menús: botón Volver en cada sub-pantalla y sin desborde horizontal', { skip: !hasChromium, timeout: 480000 }, () => {
  const r = spawnSync('node', ['tools/shot-menus.js', 'shots/menus'], { encoding: 'utf8', timeout: 450000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').filter((l) => /^(pc|movil)/.test(l));
  assert.ok(lines.length >= 20, 'se revisaron las pantallas: ' + lines.length);
  for (const l of lines) {
    const [vn, screen] = l.split(' '); const j = JSON.parse(l.slice(l.indexOf('{')));
    assert.equal(j.overflowX, 0, `${vn} ${screen}: desborde horizontal ${j.overflowX}`);
    if (screen !== 'main') assert.ok(j.back, `${vn} ${screen}: falta el botón Volver`);
  }
});
