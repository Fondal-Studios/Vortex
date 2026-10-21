// Los 6 jefes se pueden VENCER con bots de cada estilo (tirador, melé, habilidades) y pasan por sus 4 fases, sin teletransportes.
// Equilibrio entre estilos: se informa la tabla de tiempos; el «coste» de la adaptación para el estilo contrarrestado se mide en jefes-balance.test.js.
// Los bots de habilidades (Singular) son bastante más lentos que los demás contra los escudos de los jefes: el límite es holgado a propósito (docs/JEFES.md → «Pruebas»).
// Correr: node --test tests/jefes-bots.test.js   (una suite a la vez)
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_IDS } from '../src/sim/maps.js';
import { pelea } from '../tools/jefe-bots.js';

const LIMITE = { shooter: 300, melee: 450, skills: 900 };   // segundos de combate contra el jefe
const SEMILLAS = [1, 2, 3], MIN_VICTORIAS = 1;               // «se puede vencer»: hasta 3 semillas y al menos 1 victoria por jefe y estilo (los bots de melé mueren a veces por las escoltas; se informa la tabla)
const filas = [];
for (const mapId of MAP_IDS) {
  test(`${mapId}: los bots tirador, melé y de habilidades vencen al jefe (≥ ${MIN_VICTORIAS} de ${SEMILLAS.length} semillas) pasando por sus 4 fases`, { timeout: 1500000 }, () => {
    const fila = { mapId };
    for (const est of ['shooter', 'melee', 'skills']) {
      const res = []; let wins = 0;
      for (const seed of SEMILLAS) {
        const r = pelea({ mapId, seed, estilos: [est], maxSeconds: LIMITE[est] + 60 }); res.push(`${r.state[0]}${Math.round(r.t)}`);
        assert.ok(r.salto < 1.2, `${mapId}/${est}/${seed}: el jefe se movió ${r.salto} u en un cuadro (¿teletransporte?)`);
        if (r.state === 'won' && r.t <= LIMITE[est]) {
          wins++; fila[est] = Math.min(fila[est] ?? 1e9, r.t); fila[est + 'Post'] = r.posturas.map((x) => x[1]).filter((x, i, a) => a.indexOf(x) === i).join('>');
          assert.deepEqual([...r.fases].sort(), [1, 2, 3, 4], `${mapId}/${est}/${seed}: pasó por las 4 fases (${[...r.fases]})`);
          assert.ok(r.eventos['phase'] >= 4 && (r.eventos['jatk:tel'] || 0) >= 3, `${mapId}/${est}/${seed}: eventos de fase y de telegrafía`);
        }
        if (wins >= MIN_VICTORIAS) break;
      }
      fila[est + 'Corridas'] = res.join(' ');
      assert.ok(wins >= MIN_VICTORIAS, `${mapId}/${est}: sólo ${wins} victorias en ${res.length} semillas (${res.join(' ')}; w=ganó l=perdió p=sin terminar, segundos)`);
    }
    filas.push(fila);
  });
}
test.after(() => { console.log('# tiempos (s) por jefe y estilo:', JSON.stringify(filas)); });
