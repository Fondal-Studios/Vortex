import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));

// El nuevo contrato son cuatro acciones táctiles; el preset completo queda opcional.
test('HUD esencial: cuatro acciones y cámara por modo en PC y viewports móviles', { skip: !hasChromium, timeout: 300000 }, () => {
  const r = spawnSync('node', ['tools/check-essential-ui.js', 'shots/essential'], { encoding: 'utf8', timeout: 290000 });
  const out = (r.stdout || '') + (r.stderr || '');
  assert.equal(r.status, 0, out);
  for (const viewport of ['pc', 'iphoneSE', 'iphone13', 'tablet']) for (const mode of ['shooter', 'combo'])
    assert.ok(out.includes(`${viewport} ${mode}: camera ok;`), `${viewport}/${mode} ejecutado`);
});

// Los menús deben tener botón «Volver» en cada pantalla y no desbordar horizontalmente en celular.
test('menús: botón Volver en cada sub-pantalla y sin desborde horizontal', { skip: !hasChromium, timeout: 1000000 }, () => {
  const r = spawnSync('node', ['tools/shot-menus.js', 'shots/menus'], { encoding: 'utf8', timeout: 950000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const lines = out.split('\n').filter((l) => /^(pc|movil)/.test(l));
  assert.ok(lines.length >= 20, 'se revisaron las pantallas: ' + lines.length);
  for (const l of lines) {
    const [vn, screen] = l.split(' '); const j = JSON.parse(l.slice(l.indexOf('{')));
    assert.equal(j.overflowX, 0, `${vn} ${screen}: desborde horizontal ${j.overflowX}`);
    if (screen !== 'main') assert.ok(j.back, `${vn} ${screen}: falta el botón Volver`);
  }
});
