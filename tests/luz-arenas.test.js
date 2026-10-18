import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LUZ, LUZ_ORGANO, cicloDe, pesos, mezclaLuz, luzOrgano } from '../src/client/luz-arenas.js';
import { MAP_IDS } from '../src/sim/maps.js';
import { ARENAS_VIVAS } from '../src/sim/data.js';

// Luz de las arenas (src/client/luz-arenas.js): lo puro. Que el DÍA sea idéntico a la luz medida por tools/legibilidad.mjs, que ocaso y eclipse no bajen la
// luz del sol más de lo permitido, que el sol no se aleje del disco del cielo y que cada arena tenga su luz propia.
const BASE = { sol: [0.9, 0.95, 1], rim: [1, 0.4, 0.77], rel: [0.67, 0.72, 1] };
const ang = (v, a, b) => { const d = new THREE.Vector3(...v).normalize(); d.applyAxisAngle(new THREE.Vector3(0, 1, 0), a * Math.PI / 180); const ax = new THREE.Vector3(0, 1, 0).cross(d); if (ax.lengthSq() > 1e-6) d.applyAxisAngle(ax.normalize(), b * Math.PI / 180); return d.angleTo(new THREE.Vector3(...v).normalize()) * 180 / Math.PI; };

test('cada arena tiene su luz propia: idea, ocaso y eclipse completos y distintos entre sí', () => {
  assert.deepEqual(Object.keys(LUZ).sort(), [...MAP_IDS].sort());
  const solesOcaso = new Set(), rims = new Set();
  for (const id of MAP_IDS) {
    const L = LUZ[id]; assert.ok(L.nombre && L.idea.length > 40, id);
    for (const f of ['ocaso', 'eclipse']) { const F = L[f]; for (const k of ['sol', 'rel', 'rim', 'niebla']) assert.match(F[k], /^#[0-9a-f]{6}$/i, `${id}.${f}.${k}`); for (const k of ['solI', 'relI', 'rimI', 'az', 'el', 'sat']) assert.ok(Number.isFinite(F[k]), `${id}.${f}.${k}`); }
    solesOcaso.add(L.ocaso.sol + L.eclipse.sol); rims.add(L.ocaso.rim + L.eclipse.rim);
  }
  assert.equal(solesOcaso.size, 6, '6 soles distintos'); assert.ok(rims.size >= 5, 'contraluces propios');
});

test('el DÍA no cambia nada: es la luz base de cada mapa (misma que midió legibilidad)', () => {
  for (const id of MAP_IDS) {
    const L = mezclaLuz(id, BASE, 0);
    assert.deepEqual(L.sol, BASE.sol); assert.deepEqual(L.rim, BASE.rim); assert.deepEqual(L.rel, BASE.rel);
    assert.equal(L.solI, 1); assert.equal(L.rimI, 1); assert.equal(L.relI, 1); assert.equal(L.sat, 1); assert.equal(L.az, 0); assert.equal(L.el, 0); assert.equal(L.niebla, null); assert.equal(L.key, 1);
  }
});

test('ocaso y eclipse: el sol baja a lo sumo a ×0,72, el contraluz sube, el relleno del Huésped lo compensa y el sol no se aleja del cielo', () => {
  for (const id of MAP_IDS) {
    let prev = 1;
    for (let c = 0; c <= 1.0001; c += 0.05) {
      const L = mezclaLuz(id, BASE, c);
      assert.ok(L.solI >= 0.72 - 1e-9 && L.solI <= prev + 1e-9, `${id}: el sol baja de a poco (c=${c.toFixed(2)} → ${L.solI.toFixed(2)})`); prev = L.solI;
      assert.ok(L.rimI >= 1 - 1e-9 && L.relI >= 0.94, `${id}: contraluz ≥ base y relleno ≥ 0,94`);
      assert.ok(L.key >= 1 - 1e-9 && L.key <= 1.61, 'relleno del Huésped entre ×1 y ×1,6');
      assert.ok(ang([-0.42, 0.34, -0.84], L.az, L.el) <= 40, `${id}: el sol gira ≤ 40° (c=${c.toFixed(2)})`);
      for (const k of ['sol', 'rim', 'rel']) for (const v of L[k]) assert.ok(v >= 0 && v <= 1.0001, 'colores válidos');
    }
    const e = mezclaLuz(id, BASE, 1); assert.ok(e.key > 1.45, `${id}: en el eclipse el relleno propio sube`); assert.ok(e.rimI >= 1.6, `${id}: contraluz fuerte en el eclipse`);
    assert.notDeepEqual(e.sol, BASE.sol); assert.ok(e.niebla && e.niebla.length === 3);
  }
});

test('el ciclo sigue al mundo, empieza en día, un pulso lento nunca lo baja y el evento Eclipse lo lleva al final; ?ciclo= lo congela', () => {
  assert.equal(cicloDe({ infect: 0, t: 0 }), 0); assert.equal(cicloDe({ infect: 0, t: 45 }), 0, 'oleada 1: siempre día');
  let prev = -1; for (let i = 0; i <= 10; i++) { const c = cicloDe({ infect: i / 10, t: 0 }); assert.ok(c >= prev, 'más infección, más tarde'); prev = c; }
  assert.ok(cicloDe({ infect: 1, t: 0 }) < 0.9, 'sin evento el jefe es ocaso profundo, no eclipse total');
  assert.ok(cicloDe({ infect: 0.5, t: 0, eclipse: 1 }) === 1);
  assert.equal(cicloDe({ forzado: 'dia', infect: 1 }), 0); assert.equal(cicloDe({ forzado: 'ocaso' }), 0.5); assert.equal(cicloDe({ forzado: 'eclipse' }), 1);
  for (let t = 0; t < 200; t += 5) assert.ok(Math.abs(cicloDe({ infect: 0.5, t }) - cicloDe({ infect: 0.5, t: t + 0.1 })) < 0.01, 'suave: sin saltos');
  const w = pesos(0.5); assert.equal(w.oca, 1); assert.equal(w.ecl, 0); const z = pesos(1); assert.equal(z.oca, 0); assert.equal(z.ecl, 1);
});

test('luces de órganos: color de la paleta de la arena, latido por fase, más tenues en Baja y casi apagadas si el órgano está roto', () => {
  for (const id of MAP_IDS) {
    const A = ARENAS_VIVAS[id], cor = luzOrgano(id, 'corazon', 'despierto', false, 0), fu = luzOrgano(id, 'corazon', 'furioso', false, 0), ay = luzOrgano(id, 'ayuda', 'despierto', false, 0);
    assert.equal(cor.color, A.color); assert.equal(fu.color, A.color2, 'furioso: color de amenaza'); assert.equal(ay.color, A.color);
    assert.ok(luzOrgano(id, 'corazon', 'dormido').i < cor.i && cor.i < luzOrgano(id, 'corazon', 'furioso', false, 0.13).i + 30);
    assert.ok(luzOrgano(id, 'corazon', 'despierto', false, 0, true).i < cor.i, 'Baja más tenue');
    assert.ok(luzOrgano(id, 'corazon', 'despierto', true, 0).i < cor.i * 0.2, 'roto: casi apagada');
    assert.ok(cor.i > 8 && cor.i < 140, 'intensidad en el rango de las demás luces del juego');
  }
  assert.equal(luzOrgano('mX', 'corazon', 'despierto'), null);
  assert.ok(LUZ_ORGANO.dist <= 30 && LUZ_ORGANO.decay >= 1.4);
});
