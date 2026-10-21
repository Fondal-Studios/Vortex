// EQUILIBRIO de la IA adaptativa: adaptarse contra tu estilo no debe volver al jefe «injusto». Para cada jefe y estilo se compara el tiempo medio de victoria
// con la IA ENCENDIDA contra el mismo jefe con la IA APAGADA (sólo mecánicas, sin posturas): el coste de la adaptación para el estilo contrarrestado
// debe quedar entre −25 % y +45 % (los combates tienen mucha varianza: se promedian varias semillas). Y los otros estilos no deben sufrir más que ese tope.
// Correr: node --test tests/jefes-balance.test.js   (una suite a la vez; ~4 min)
import test from 'node:test';
import assert from 'node:assert/strict';
import { pelea } from '../tools/jefe-bots.js';

const SEMILLAS = [1, 2, 3, 4], MAPAS = ['m1', 'm5', 'm6'], ESTILOS = ['shooter', 'melee', 'skills'];
const media = (a) => a.reduce((x, y) => x + y, 0) / a.length;
test('coste de la adaptación: entre −25 % y +45 % del tiempo de victoria, para los tres estilos', { timeout: 2400000 }, () => {
  const tabla = [];
  for (const mapId of MAPAS) for (const est of ESTILOS) {
    const t = { on: [], off: [] };
    for (const seed of SEMILLAS) for (const ia of [false, true]) { const r = pelea({ mapId, seed, estilos: [est], maxSeconds: 1000, ia }); if (r.state === 'won') t[ia ? 'on' : 'off'].push(r.t); }   // se promedian sólo las victorias (los bots pierden a veces por las escoltas)
    assert.ok(t.on.length >= 2 && t.off.length >= 2, `${mapId}/${est}: muy pocas victorias para medir (con IA ${t.on.length}, sin IA ${t.off.length} de ${SEMILLAS.length})`);
    const coste = media(t.on) / media(t.off) - 1; tabla.push({ mapId, est, sinIA: Math.round(media(t.off)), conIA: Math.round(media(t.on)), coste: Math.round(coste * 100) + ' %', victorias: `${t.off.length}/${t.on.length}` });
    assert.ok(coste <= 0.45 && coste >= -0.25, `${mapId}/${est}: coste ${(coste * 100).toFixed(0)} % de la adaptación`);
  }
  console.log('# coste de la adaptación:', JSON.stringify(tabla));
});
