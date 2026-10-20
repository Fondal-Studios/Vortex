import test from 'node:test';
import assert from 'node:assert/strict';

// Códice de Fauna en el PERFIL (src/client/perfil.js): migración de guardados viejos, saneo de basura, registro de comidas, hitos y lo que viaja a la partida.
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const Perfil = await import('../src/client/perfil.js');
const KEY = 'cristal.perfil.v1';

test('un perfil viejo (sin fauna) se abre igual, con el Códice vacío, y conserva lo suyo', () => {
  mem[KEY] = JSON.stringify({ cores: 123, evo: { axioma: 2 }, ess: { carne: 5, cristal: 0, ojo: 0, vacio: 0 } }); const p = Perfil.recargar();
  assert.equal(p.cores, 123); assert.deepEqual(p.fauna, { c: {}, adn: {}, hib: [], tot: 0 }); assert.deepEqual(Perfil.paraPartida('axioma').fauna, {});
});
test('un perfil con basura en `fauna` se sanea (especies inventadas, números negativos o con coma, híbridos falsos)', () => {
  mem[KEY] = JSON.stringify({ cores: 1, fauna: { c: { lagartija_hielo: 4.7, fantasma: 9, colibri_luz: -2, rana_marea: 'x' }, adn: { hielo: 2, nada: 1 }, hib: ['ventisca', 'ventisca', 'no_existe'] } }); const p = Perfil.recargar();
  assert.deepEqual(p.fauna.c, { lagartija_hielo: 4 }); assert.deepEqual(p.fauna.adn, { hielo: 2 }); assert.deepEqual(p.fauna.hib, ['ventisca']); assert.equal(p.fauna.tot, 4);
  mem[KEY] = JSON.stringify({ fauna: 'hola' }); assert.deepEqual(Perfil.recargar().fauna, { c: {}, adn: {}, hib: [], tot: 0 });
});
test('registrarFauna: descubre, cuenta, da ADN, avisa hitos, recuerda híbridos y guarda', () => {
  mem[KEY] = '{}'; Perfil.recargar();
  const r1 = Perfil.registrarFauna('lagartija_hielo'); assert.equal(r1.nuevo, true); assert.deepEqual(r1.hitos, [1]); assert.equal(r1.n, 1); assert.equal(r1.especie.nombre, 'Lagartija de Hielo');
  for (let i = 0; i < 3; i++) Perfil.registrarFauna('lagartija_hielo'); const r5 = Perfil.registrarFauna('lagartija_hielo'); assert.deepEqual(r5.hitos, [5]); assert.equal(r5.hito.n, 5);
  for (let i = 0; i < 4; i++) Perfil.registrarFauna('lagartija_hielo'); const r10 = Perfil.registrarFauna('lagartija_hielo'); assert.equal(r10.hito.n, 10);
  Perfil.registrarFauna('mariposa_electrica', 'ventisca');
  const f = Perfil.fauna(); assert.equal(f.c.lagartija_hielo, 10); assert.equal(f.adn.hielo, 10); assert.equal(f.adn.electrica, 1); assert.deepEqual(f.hib, ['ventisca']); assert.equal(f.tot, 11);
  assert.equal(Perfil.registrarFauna('inventada'), null);
  const guardado = JSON.parse(mem[KEY]).fauna; assert.equal(guardado.c.lagartija_hielo, 10);
  Perfil.recargar(); assert.equal(Perfil.fauna().c.lagartija_hielo, 10, 'sobrevive a recargar');
  assert.deepEqual(Perfil.paraPartida('axioma').fauna, { lagartija_hielo: 10, mariposa_electrica: 1 }); assert.deepEqual(Perfil.faunaDeLaSala(), { lagartija_hielo: 10, mariposa_electrica: 1 });
});
test('el Códice llega a la simulación: con 10 comidas la forma dura más', async () => {
  const { Game } = await import('../src/sim/game.js'), { faunaSpawn, comer } = await import('../src/sim/fauna.js'), { madd } = await import('../src/sim/math.js');
  const dur = (cod) => { const g = new Game({ mapId: 'm1', seed: 1 }); const p = g.addPlayer('t', null, { char: 'axioma', fauna: cod }); const f = faunaSpawn(g, 'lagartija_hielo', madd(p.pos, p.heading, 2), 'dormida'); comer(g, p, f); return p.ff.d; };
  assert.ok(dur(Perfil.paraPartida('axioma').fauna) > dur({}) + 10);
});
