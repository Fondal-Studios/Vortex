import test from 'node:test';
import assert from 'node:assert/strict';
import { recargar, cerrarPartida, perfil } from '../src/client/perfil.js';
let saved = '{}';
globalThis.localStorage = { getItem: (key) => key === 'cristal.perfil.v1' ? saved : null, setItem: (key, val) => { if (key === 'cristal.perfil.v1') saved = val; } };
test('núcleos migrados son números y la recompensa suma, no concatena', () => {
  saved = JSON.stringify({ cores: '100' }); recargar();
  cerrarPartida('axioma', { co: 5 }, {});
  assert.equal(perfil().cores, 105);
  assert.equal(JSON.parse(saved).cores, 105);
});
test('núcleos inválidos no contaminan el perfil ni permiten saldos negativos', () => {
  for (const value of [-5, 'oops', 'Infinity', null, {}, []]) {
    saved = JSON.stringify({ cores: value });
    assert.equal(recargar().cores, 0, JSON.stringify(value));
  }
  saved = JSON.stringify({ cores: 12.9 }); assert.equal(recargar().cores, 12);
});
