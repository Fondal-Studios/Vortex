import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const hasChromium = fs.existsSync('/opt/pw-browsers') && fs.readdirSync('/opt/pw-browsers').some((d) => d.startsWith('chromium-'));

// El HUD y los botones táctiles NO deben superponerse ni salirse de la pantalla en PC, iPhone SE, 13, 15 Pro Max y tableta (horizontal),
// en los DOS modos (Disparo y Melé), con toques de al menos 44 px, sin tapar el centro y con las 3 habilidades siempre a mano.
test('HUD móvil y de PC: Disparo y Melé sin solapes, 3 habilidades siempre, botón MODO y editor', { skip: !hasChromium, timeout: 3000000 }, () => {
  const r = spawnSync('node', ['tools/shot-hud.js', 'shots/hud'], { encoding: 'utf8', timeout: 2900000 });
  const out = (r.stdout || '') + (r.stderr || '');
  assert.equal(r.status, 0, `HUD con problemas:\n${out}`);
  // los botones (MELÉ, HAB.1/2/3, MODO, ULTI) existen en los 3 preajustes de dedos y el editor puede moverlos
  for (const vn of ['iphoneSE', 'iphone13', 'iphone15pm', 'tablet']) {
    for (const n of [2, 3, 4]) assert.match(out, new RegExp(`${vn}\\s+${n} dedos \\d+ botones\\s*sin solapes`), `${vn}: ${n} dedos sin solapes`);
    assert.match(out, new RegExp(`${vn}\\s+modo básico oculta lo avanzado: ok`), `${vn}: el modo básico sólo muestra lo básico`);
    assert.match(out, new RegExp(`${vn}\\s+HAB.1/2/3 siempre visibles en Disparo: ok`), `${vn}: las 3 habilidades están siempre`);
    assert.match(out, new RegExp(`${vn}\\s+modo avanzado \\d+ botones\\s*sin solapes`), `${vn}: modo avanzado sin solapes`);
    assert.match(out, new RegExp(`${vn}\\s+Melé \\d+ botones\\s*sin solapes`), `${vn}: Melé sin solapes`);
    assert.match(out, new RegExp(`${vn}\\s+modo Melé muestra sólo lo suyo: ok`), `${vn}: Melé muestra sólo sus botones (ATAQUE 1/2, sin MELÉ ni avanzados)`);
    assert.match(out, new RegExp(`${vn}\\s+botón MODO alterna Disparo ↔ Melé: ok`), `${vn}: el botón MODO cambia el modo al instante y tiene espera`);
    assert.match(out, new RegExp(`${vn}\\s+editor mueve MELEE: -30px 20px ok`), `${vn}: el editor mueve MELEE`);
    for (const h of ['vesper', 'danzante', 'singular']) for (const m of ['Disparo', 'Melé']) assert.match(out, new RegExp(`${vn}\\s+huésped ${h} ${m} \\d+ botones[^\\n]*sin solapes`), `${vn}: ${h} en ${m} sin solapes`);
  }
  for (const h of ['axioma', 'vesper', 'micelio', 'umbra', 'seraf', 'colmena', 'danzante', 'singular']) for (const m of ['Disparo', 'Melé']) assert.match(out, new RegExp(`iphone13\\s+huésped ${h} ${m} \\d+ botones[^\\n]*sin solapes`), `iphone13: ${h} en ${m}`);
  assert.match(out, /pc\s+huésped \w+ Melé[^\n]*\[filas mov,esp,s3,ult\][^\n]*sin solapes/, 'PC: el panel del Huésped muestra las 3 habilidades y la ulti en Melé');
  assert.doesNotMatch(out, /FALLA|TOQUE CHICO|TAPA EL CENTRO|SOLAPE|FUERA DE PANTALLA/, 'ningún problema de HUD');
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
