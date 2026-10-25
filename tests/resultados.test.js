import test from 'node:test';
import assert from 'node:assert/strict';
import { modeloResultados } from '../src/sim/resultados.js';
import { Game } from '../src/sim/game.js';
const R = { estado: 'lost', oleada: 3, total: 5, etapas: 2, tiempo: 125, operacion: 'Operación Raíz', fallo: 'Se agotó el tiempo del objetivo.', hitos: { obj: 2, objFalla: 1, sec: 1, elite: 2 }, jugadores: [{ id: 1, nombre: 'Ana', bajas: 30, puntos: 900, cores: 80, st: { dmg: 4000, obj: 2, sup: 3, rev: 1, elite: 2 }, t: 125 }, { id: 2, nombre: 'Beto', bajas: 5, puntos: 100, cores: 20, st: { dmg: 100, obj: 0, sup: 9, rev: 2, elite: 0 }, t: 125 }] };
test('resultados: derrota muestra Etapa X/Y, tiempo, objetivos, parcial y lo que sólo da la victoria', () => {
  const m = modeloResultados({ won: false, resumen: R, yo: 2, recibo: { cores: 20, coresBrutos: 80, xp: 40, mae: { ganada: 40, arbol: null } }, guardado: { ok: true } });
  assert.equal(m.titulo, 'MISIÓN FALLIDA'); assert.deepEqual(m.resumen, ['Etapa 3/5', 'Tiempo 2:05']); assert.match(m.motivo, /tiempo/);
  assert.equal(m.objetivos.length, 3); assert.equal(m.recompensas.every((r) => r.parcial), true); assert.ok(m.perdido.length >= 4); assert.match(m.nota, /completar la misión/);
  assert.equal(m.aporte.find((a) => a.txt.startsWith('Apoyo')).val, 9, 'el aporte es el de QUIEN mira la pantalla'); assert.equal(m.tabla.filter((t) => t.yo).length, 1); assert.equal(m.aviso, null);
});
test('resultados: victoria sin lo parcial; aviso grave si el guardado falló; aviso de duplicado', () => {
  const v = modeloResultados({ won: true, resumen: { ...R, estado: 'won' }, recibo: { cores: 80, xp: 100, mae: { ganada: 100 } }, desbloqueos: ['Territorio liberado'] });
  assert.equal(v.titulo, 'MISIÓN COMPLETADA'); assert.deepEqual(v.perdido, []); assert.equal(v.recompensas.some((r) => r.parcial), false); assert.deepEqual(v.desbloqueos, ['Territorio liberado']);
  const f = modeloResultados({ won: true, resumen: R, recibo: { cores: 1 }, guardado: { ok: false, mensaje: 'Lleno.', pendientes: 1 } });
  assert.equal(f.aviso.grave, true); assert.match(f.aviso.txt, /pendiente/); assert.deepEqual(f.aviso.acciones, ['reintentar', 'descargar', 'copiar']);
  assert.match(modeloResultados({ won: true, resumen: R, recibo: { duplicado: true, cores: 1 } }).aviso.txt, /ya estaba cobrada/);
  assert.doesNotThrow(() => modeloResultados({}));
});
test('Game.resumen(): hitos y aporte reales de una partida simulada', () => {
  const g = new Game({ mapId: 'm1', seed: 3, calm: 1, operation: true }); const p = g.addPlayer('A');
  g.step(1 / 60); const r = g.resumen();
  assert.equal(r.jugadores.length, 1); assert.equal(typeof r.jugadores[0].st.dmg, 'number'); assert.equal(r.total, g.waveTotal); assert.deepEqual(Object.keys(r.hitos).sort(), ['elite', 'obj', 'objFalla', 'sec']);
  const m = g.spawnMonster ? null : null; g.state = 'won'; assert.equal(g.resumen().etapas, g.waveTotal); assert.ok(p);
});
