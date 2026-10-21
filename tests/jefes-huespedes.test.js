// La IA de los jefes lee a los 8 Huéspedes en sus dos modos (Disparo y Melé/Combo): en Disparo termina en «Muro de reflejos» (antidist) y nunca en «Coraza de espinas»;
// en Melé termina en «Coraza de espinas» (antimele) — salvo la Colmena, cuyo Combo es casi todo enjambre (habilidad) y se lee como habilidades.
// Correr: node --test tests/jefes-huespedes.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOST_IDS } from '../src/sim/data.js';
import { pelea, CHAR_DE } from '../tools/jefe-bots.js';

test('los 8 Huéspedes × 2 modos: el jefe adopta la postura que corresponde a cómo juega cada uno', { timeout: 900000 }, () => {
  assert.equal(HOST_IDS.length, 8);
  const filas = [], CHAR0 = { ...CHAR_DE };
  try {
    for (const h of HOST_IDS) for (const est of ['melee', 'shooter']) {
      CHAR_DE[est] = h; const r = pelea({ mapId: 'm1', seed: 3, estilos: [est], maxSeconds: 45 }), b = r.g.boss, p = r.g.players[0], post = r.posturas.map((x) => x[1]);
      filas.push(`${h}/${est}: ${post.join('>')} (${b.ia.sh.join('/')})`);
      assert.equal(p.mode, est === 'melee' ? 'combo' : 'shooter', `${h}: el modo es el pedido`);
      if (est === 'shooter') { assert.ok(post.includes('antidist'), `${h} Disparo: ${post.join('>')}`); assert.ok(!post.includes('antimele'), `${h} Disparo nunca debería ser anti-melé: ${post.join('>')}`); }
      else { const ok = h === 'colmena' ? ['antimele', 'antihab'] : ['antimele']; assert.ok(post.some((x) => ok.includes(x)), `${h} Melé: ${post.join('>')}`); assert.ok(post.at(-1) !== 'antidist' || h === 'vesper' || h === 'colmena', `${h} Melé no debe terminar en antidist: ${post.join('>')}`); }
    }
  } finally { Object.assign(CHAR_DE, CHAR0); }
  console.log('# ' + filas.join(' | '));
});
