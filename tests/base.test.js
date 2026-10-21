// LA BASE · «El Santuario» (docs/BASE.md): plano sin zonas inalcanzables, estaciones y rangos, simulación sin oleadas ni azar, jardín y cultivos,
// perfil (migración y saneo), enlaces con las pantallas del menú y partes puras del HUD. El presupuesto de dibujo y las capturas viven en tests/base-render.test.js.
// Se corre sola: node --test tests/base.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/sim/game.js';
import { MAPS, MAP_IDS } from '../src/sim/maps.js';
import { makeRng, v3 } from '../src/sim/math.js';
import {
  BASE, ESTACIONES, ESTACION_IDS, PERSONAJES, PERSONAJE_IDS, estacionCerca, interaccionCerca, PLANTAS, PLANTA_IDS, macetaEstado, TOPE_TIEMPO,
  CUBAS, MACETAS, CAPULLOS, VIVARIOS, MANIQUIES, VITRINAS,
} from '../src/sim/base.js';
import { HOST_IDS } from '../src/sim/data.js';
import { MATERIALS, ITEMS } from '../src/sim/items.js';
import { PUERTAS, PANTALLAS, avisos, avisosPuertas } from '../src/client/menu-nav.js';

const DT = 1 / 60, MAP = MAPS.base;
const IDLE = { mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, pick: -1 };
const nuevo = (seed = 1) => { const g = new Game({ mapId: 'base', seed }); const p = g.addPlayer('t', null, { char: 'axioma' }); return { g, p }; };
/** Camina con la FÍSICA REAL hacia `target` siguiendo map.navStep (como un jugador que va por el camino evidente). */
function walk(g, p, target, maxT = 70, cerca = 1.2) {
  let t = 0;
  while (t < maxT) {
    if (Math.hypot(target.x - p.pos.x, target.z - p.pos.z) < cerca) return { ok: true, t };
    const st = g.map.navStep(p.pos, target); if (st === 'none') return { ok: false, t, none: true };
    const wp = st || target, wx = wp.x - p.pos.x, wz = wp.z - p.pos.z, l = Math.hypot(wx, wz) || 1;
    p.heading = v3(wx / l, 0, wz / l); g.setInput(p.id, { ...IDLE, mz: 1 }); g.step(DT); g.events.length = 0; t += DT;
    if (p.pos.y < -5) return { ok: false, t, fell: true };
  }
  return { ok: false, t };
}
/** Un punto libre a ~65 % del rango de `e` (el más cercano al centro de la estación). */
function puntoDeAcceso(e) {
  let best = null, bd = Infinity;
  for (let r = 1.5; r <= e.r * 0.9; r += 0.5) for (let a = 0; a < 6.283; a += 0.2) {
    const x = e.x + Math.cos(a) * r, z = e.z + Math.sin(a) * r;
    if (MAP.walkable(x, z, 1.2) && r < bd) { bd = r; best = { x, z }; }
  }
  return best;
}

test('registro: la Base es un mapa para Game/Renderer pero NO una arena (no figura en MAP_IDS ni en las listas de arenas)', () => {
  assert.ok(MAP.base === true && MAP.id === 'base' && MAP.limbo === true);
  assert.ok(!MAP_IDS.includes('base') && !Object.keys(MAPS).includes('base'));
  for (const f of ['spawnGround', 'playerSpawn', 'outOfBounds', 'gravityAt', 'timeScaleAt', 'fx', 'navStep', 'guard', 'steer', 'walkable']) assert.equal(typeof MAP[f], 'function', f);
  assert.equal(MAP.zones.length, 0, 'sin zonas de gravedad rota: se camina normal');
});

test('plano: aparición libre, cuatro muros de borde cerrados y el grafo de navegación conexo (ninguna zona aislada)', () => {
  const s = MAP.playerSpawn(0); assert.ok(MAP.walkable(s.x, s.z, 0.9));
  for (const w of MAP.wallDefs) assert.ok(w.h >= 14, 'muros más altos que cualquier salto');
  const n = MAP.nav; assert.ok(n.N > 100);
  for (let i = 0; i < n.N; i++) for (let j = 0; j < n.N; j++) assert.ok(n.D[i * n.N + j] < 1e8, 'grafo conexo');
  // cerrado: desde la aparición no se llega a un punto afuera del salón
  const b = MAP.bbox; assert.ok(!MAP.walkable(b.x0 - 6, 0, 0) && !MAP.walkable(b.x1 + 6, 0, 0) && !MAP.walkable(0, b.z0 - 6, 0) && !MAP.walkable(0, b.z1 + 6, 0));
  // las salas se pisan ≥ 4 m: no hay costuras que corten el paso
  const R = Object.values(BASE.ROOMS);
  for (const r of R) assert.ok(R.some((o) => o !== r && Math.min(r.x1, o.x1) - Math.max(r.x0, o.x0) >= 4 && Math.min(r.z1, o.z1) - Math.max(r.z0, o.z0) >= 4), 'cada sala se pisa con otra');
});

test('estaciones: catálogo completo, rangos razonables y cada una con un punto de acceso libre DENTRO de su rango', () => {
  for (const id of ['forja', 'cambista', 'armero', 'territorios', 'jardin', 'faunario', 'poligono', 'trofeos', 'coop']) assert.ok(ESTACIONES[id], id);
  for (const e of Object.values(ESTACIONES)) {
    assert.equal(ESTACIONES[e.id], e); assert.ok(e.nombre && e.frase && e.icono); assert.ok(e.r >= 5 && e.r <= 9, `rango de ${e.id}`);
    assert.ok(e.pantalla || e.panel || e.accion || e.acciones, `${e.id} abre algo`);
    const q = puntoDeAcceso(e); assert.ok(q, `${e.id}: hay dónde pararse dentro del rango`);
    const c = estacionCerca(q.x, q.z); assert.ok(c, `${e.id}: el punto de acceso activa alguna estación`);
  }
  for (const n of Object.values(PERSONAJES)) { assert.ok(n.frases.length >= 3 && n.frases.every((f) => f.length < 120), `frases cortas de ${n.id}`); const q = puntoDeAcceso({ ...n, r: n.r }); assert.ok(q, `${n.id}: se puede llegar a hablarle`); }
  assert.equal(estacionCerca(0, 33), null, 'la aparición no está dentro de ninguna estación (no abre nada sola)');
  assert.equal(interaccionCerca(0, 0).def.id, 'territorios');
  assert.equal(interaccionCerca(-26, -4).def.id, 'cambista');
});

test('estaciones: cada pantalla que abren existe en el menú (index.html) y cada pestaña de Inventario es válida', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const pantallas = new Set([...html.matchAll(/data-screen="([\w-]+)"/g)].map((m) => m[1]));
  const TABS = ['obj', 'mat', 'pla', 'for', 'set'];
  for (const e of Object.values(ESTACIONES)) for (const a of [e, ...(e.acciones || [])]) {
    if (a.pantalla) assert.ok(pantallas.has(a.pantalla), `${e.id} → ${a.pantalla}`);
    if (a.tab) { assert.equal(a.pantalla, 'inventario'); assert.ok(TABS.includes(a.tab)); }
  }
  assert.equal(ESTACIONES.forja.tab, 'for', 'la Forja abre el Inventario en la pestaña Forja');
  assert.equal(ESTACIONES.cambista.pantalla, 'tienda'); assert.equal(ESTACIONES.coop.pantalla, 'coop'); assert.equal(ESTACIONES.faunario.pantalla, 'bestiary');
  assert.ok(ESTACIONES.armero.acciones.some((a) => a.pantalla === 'evolucion') && ESTACIONES.armero.acciones.some((a) => a.pantalla === 'loadout'));
  assert.ok(ESTACIONES.territorios.acciones.some((a) => a.pantalla === 'arenas') && ESTACIONES.territorios.acciones.some((a) => a.pantalla === 'territorios'));
  assert.equal(ESTACIONES.poligono.accion, 'practica');
});

test('decorado coherente: una cuba por cultivo, un capullo por Huésped, macetas y vitrinas dentro del salón y sobre piso libre', () => {
  assert.equal(CAPULLOS.length, HOST_IDS.length); assert.deepEqual(CAPULLOS.map((c) => c.id), HOST_IDS);
  assert.equal(CUBAS.length, 5); assert.equal(MACETAS.length, 6); assert.ok(VIVARIOS.length >= 3 && MANIQUIES.length >= 4 && VITRINAS.length >= 4);
  for (const c of CAPULLOS) assert.ok(MAP.rooms.some((r) => c.x > r.x0 && c.x < r.x1 && c.z > r.z0 && c.z < r.z1), 'capullo dentro del salón');
  for (const m of MACETAS) assert.ok(MAP.covers.some((c) => c.kind === 'maceta' && c.x === m.x && c.z === m.z));
  // los capullos cuelgan de la pared este: nadie los atraviesa a pie (están a 2 m del borde y los tabiques no los tapan)
  for (const c of CAPULLOS) assert.ok(MAP.walkable(c.x - 2.2, c.z, 0.5), 'se puede pasar frente a cada capullo');
});

test('transitabilidad física: desde la aparición se camina (física real) hasta cada estación y personaje, y de vuelta', () => {
  const { g, p } = nuevo(), home = MAP.playerSpawn(0);
  for (const e of [...Object.values(ESTACIONES), ...Object.values(PERSONAJES)]) {
    const q = puntoDeAcceso(e); const r = walk(g, p, q); assert.ok(r.ok, `no llegó a ${e.id} (${JSON.stringify(r)}) desde ${JSON.stringify(p.pos)}`);
    const c = interaccionCerca(p.pos.x, p.pos.z); assert.ok(c, `${e.id}: al llegar hay algo con qué interactuar`);
  }
  const r = walk(g, p, home); assert.ok(r.ok, 'vuelve al inicio');
});

test('simulación: sin oleadas ni criaturas ni daño; el jugador siempre está vivo y el estado sigue «playing»', () => {
  const { g, p } = nuevo(); for (let i = 0; i < 60 * 40; i++) { g.setInput(p.id, { ...IDLE, fire: true, ability: true, mov: true, esp: true, dyaw: 0.01 }); g.step(DT); }
  assert.equal(g.state, 'playing'); assert.equal(g.monsters.length, 0); assert.equal(g.wave, 0); assert.equal(g.projectiles.length, 0, 'sin disparos: no hay armas en la Base');
  assert.equal(p.hp, 100); assert.ok(!p.dead); assert.equal(g.phase, 'intermission');
  const lib = g.snapshot().objs.filter((o) => o.t === 'estacion').map((o) => o.nk).sort(); assert.deepEqual(lib, [...ESTACION_IDS].sort());
  assert.equal(g.objects.filter((o) => o.type === 'npc').length, PERSONAJE_IDS.length);
  assert.ok(g.objects.length < 30, 'lejos del tope de 40 objetos de la simulación');
});

test('simulación: USAR cerca de una estación emite «estacion»; cerca de un personaje, «habla» con sus frases en orden; lejos no pasa nada', () => {
  const { g, p } = nuevo(); const ev = [];
  const usar = () => { g.setInput(p.id, { ...IDLE, interact: true }); g.step(DT); ev.push(...g.events.filter((e) => e.t === 'estacion' || e.t === 'habla')); g.events.length = 0; g.setInput(p.id, { ...IDLE }); g.step(DT); g.events.length = 0; };
  usar(); assert.equal(ev.length, 0, 'en la aparición no hay nada cerca');
  walk(g, p, puntoDeAcceso(ESTACIONES.forja)); usar(); assert.deepEqual(ev.map((e) => e.id), ['forja']); assert.equal(ev[0].pid, p.id);
  // mantener USAR apretado no repite (sólo el borde de subida: una pulsación = un evento)
  ev.length = 0; for (let i = 0; i < 30; i++) { g.setInput(p.id, { ...IDLE, interact: true }); g.step(DT); ev.push(...g.events.filter((e) => e.t === 'estacion')); g.events.length = 0; } assert.equal(ev.length, 1);
  g.setInput(p.id, { ...IDLE }); g.step(DT);
  ev.length = 0; walk(g, p, puntoDeAcceso(PERSONAJES.sanadora)); const frases = []; for (let i = 0; i < 4; i++) { usar(); frases.push(ev.pop()); }
  assert.ok(frases.every((f) => f && f.t === 'habla' && f.id === 'sanadora'));
  assert.deepEqual(frases.map((f) => f.tx), [0, 1, 2, 3].map((i) => PERSONAJES.sanadora.frases[i % 3]), 'las frases rotan en orden, sin azar');
});

test('determinismo: nada de la Base consume g.rng (dos corridas con USAR y movimiento dan los mismos eventos, y el generador de la partida queda intacto)', () => {
  const corre = () => {
    const { g, p } = nuevo(7), log = []; for (let i = 0; i < 60 * 12; i++) { g.setInput(p.id, { ...IDLE, mz: 1, interact: i % 40 === 0, dyaw: i % 90 === 0 ? 0.3 : 0 }); g.step(DT); for (const e of g.events) log.push(JSON.stringify(e)); g.events.length = 0; }
    return { log, pos: [p.pos.x, p.pos.z].map((v) => Math.round(v * 1e3)), rng: g.rng.next() };
  };
  const a = corre(), b = corre(); assert.deepEqual(a, b); assert.equal(a.rng, makeRng(7).next(), 'g.rng sin tocar');
});

test('jardín: estados por reloj real con tope; una hora futura no regala tiempo; todas las plantas dan un material que existe', () => {
  assert.ok(PLANTA_IDS.length >= 4);
  for (const id of PLANTA_IDS) { const P = PLANTAS[id]; assert.ok(MATERIALS[P.mat], id); assert.ok(P.t >= 60 && P.t <= 3600 && P.costo > 0 && P.n >= 1 && P.cal >= 0 && P.cal <= 3, id); }
  const id = PLANTA_IDS[0], P = PLANTAS[id], t0 = 1e12;
  assert.equal(macetaEstado(null).estado, 'vacia'); assert.equal(macetaEstado({ p: 'zzz', t0 }).estado, 'vacia');
  assert.equal(macetaEstado({ p: id, t0 }, t0).estado, 'crece'); assert.equal(macetaEstado({ p: id, t0 }, t0).faltan, P.t);
  const mid = macetaEstado({ p: id, t0 }, t0 + P.t * 500); assert.equal(mid.estado, 'crece'); assert.ok(Math.abs(mid.prog - 0.5) < 0.01);
  assert.equal(macetaEstado({ p: id, t0 }, t0 + P.t * 1000).estado, 'lista');
  assert.equal(macetaEstado({ p: id, t0: t0 + 5e6 }, t0).faltan, P.t, 'hora de siembra en el futuro: cuenta desde ahora');
  assert.equal(macetaEstado({ p: id, t0: 1 }, 1 + TOPE_TIEMPO * 3).estado, 'lista');
});

/* ───────────────────────── perfil ───────────────────────── */
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const KEY = 'cristal.perfil.v1';
const abrir = async (obj) => { mem.clear(); if (obj !== undefined) mem.set(KEY, typeof obj === 'string' ? obj : JSON.stringify(obj)); return import('../src/client/perfil.js?' + Math.random()); };

test('perfil: un perfil viejo (sin «base») se abre igual con jardín vacío; un perfil roto o mentiroso se sanea', async () => {
  let P = await abrir({ cores: 40, evo: { axioma: 1 } }); let p = P.perfil();
  assert.equal(p.cores, 40); assert.deepEqual(p.base, { vis: {}, tut: false, jardin: [null, null, null, null, null, null] });
  P = await abrir({ cores: 5, base: { vis: { forja: 123, noexiste: 9 }, tut: 'sí', jardin: [{ p: PLANTA_IDS[1], t0: 77 }, { p: 'falsa', t0: 5 }, 'x', null, { p: PLANTA_IDS[0], t0: -5 }, null, { p: PLANTA_IDS[0], t0: 1 }, null] } });
  p = P.perfil(); assert.deepEqual(p.base.vis, { forja: 123 }); assert.equal(p.base.tut, false); assert.equal(p.base.jardin.length, 6);
  assert.deepEqual(p.base.jardin[0], { p: PLANTA_IDS[1], t0: 77 }); assert.equal(p.base.jardin[1], null); assert.equal(p.base.jardin[2], null); assert.equal(p.base.jardin[4].t0, 0);
  P = await abrir('{{ no es json'); assert.equal(P.perfil().base.jardin.length, 6);
});

test('perfil: sembrar gasta núcleos, no pisa una maceta ocupada, no cosecha antes de tiempo; cosechar suma el material y vacía la maceta; todo persiste', async () => {
  const id = PLANTA_IDS[0], P0 = PLANTAS[id], T = 1e12;
  const P = await abrir({ cores: P0.costo + 3 }); const p = P.perfil();
  assert.equal(P.sembrar(0, 'falsa', T).ok, false); assert.equal(P.sembrar(9, id, T).ok, false);
  const r = P.sembrar(0, id, T); assert.ok(r.ok); assert.equal(p.cores, 3);
  assert.equal(P.sembrar(0, id, T).ok, false, 'ocupada'); assert.equal(P.sembrar(1, id, T).ok, false, 'sin núcleos');
  assert.equal(P.cosechar(0, T + 1000).ok, false, 'todavía crece'); assert.equal(P.cosechar(1, T).ok, false, 'vacía');
  assert.equal(P.jardinEstado(T + 1000)[0].estado, 'crece');
  // persiste: se vuelve a abrir el navegador a mitad del cultivo
  const guardado = JSON.parse(mem.get(KEY)); assert.equal(guardado.base.jardin[0].p, id); assert.equal(guardado.base.jardin[0].t0, T);
  const P2 = await abrir(guardado); assert.equal(P2.jardinEstado(T + P0.t * 1000)[0].estado, 'lista');
  const antes = P2.stockMin(P0.mat, 0), c = P2.cosechar(0, T + P0.t * 1000); assert.ok(c.ok); assert.equal(c.n, P0.n); assert.equal(c.mat, P0.mat);
  assert.equal(P2.stockMin(P0.mat, 0), antes + P0.n); assert.equal(P2.stockMin(P0.mat, P0.cal), antes + P0.n, 'entra con la calidad de la planta');
  assert.equal(P2.jardinEstado(T)[0].estado, 'vacia'); assert.equal(JSON.parse(mem.get(KEY)).base.jardin[0], null);
});

test('perfil: estación visitada, tutorial de la Base y avisos (cultivo de la Forja listo, cosecha del jardín lista)', async () => {
  const id = PLANTA_IDS[0], P0 = PLANTAS[id], T = 1e12;
  const P = await abrir({ cores: 500 }); assert.equal(P.tutorialBaseVisto(), false); P.tutorialBaseListo(); assert.equal(P.tutorialBaseVisto(), true);
  assert.equal(P.visitarEstacion('forja', 99), true); assert.equal(P.visitarEstacion('nada'), false); assert.equal(P.perfil().base.vis.forja, 99);
  const P2 = await abrir(JSON.parse(mem.get(KEY))); assert.equal(P2.tutorialBaseVisto(), true); assert.equal(P2.baseDatos().vis.forja, 99);
  assert.deepEqual(P2.avisosBase(T), {}); P2.sembrar(2, id, T);
  assert.deepEqual(P2.avisosBase(T + 1000), {}); assert.deepEqual(P2.avisosBase(T + P0.t * 1000), { jardin: 1 });
  P2.perfil().cultivo = { item: Object.keys(ITEMS)[0], listo: T + 5000, q: 0.5, dur: 5 };
  assert.deepEqual(P2.avisosBase(T + P0.t * 1000 + 6000), { forja: 1, jardin: 1 }, 'la cuba grande brilla cuando el cultivo terminó');
});

/* ───────────────────────── interfaz: partes puras ───────────────────────── */
test('menú: «La Base» es una puerta del inicio, no una pantalla; su puntito sale del perfil', () => {
  const it = PUERTAS.find((x) => x.go === 'base'); assert.ok(it && it.desc.length > 15 && avisosPuertas({ base: 2, botin: 0, puntos: 0, huesped: 0, bendicion: 0, mision: 0 }).base === 2);
  assert.equal(PANTALLAS.base, undefined, 'la Base es un mapa (main.js › startBase), no una pantalla del menú');
  const id = PLANTA_IDS[0], T = 1e12, P = PLANTAS[id];
  assert.equal(avisos({ cores: 0, inventario: [], menu: {}, base: { jardin: [{ p: id, t0: T }] } }, T + 1000).base, 0);
  assert.equal(avisos({ cores: 0, inventario: [], menu: {}, base: { jardin: [{ p: id, t0: T }] } }, T + P.t * 1000).base, 1);
  assert.equal(avisos({ cores: 0, inventario: [], menu: {}, cultivo: { item: 'x', listo: T }, base: { jardin: [] } }, T + 1).base, 1);
  const ui = fs.readFileSync(new URL('../src/client/ui.js', import.meta.url), 'utf8'); assert.ok(/name === 'base'/.test(ui), 'ui.go(«base») llama a la acción que entra al mapa');
});

test('HUD de la Base (parte pura): datos para las cubas, capullos, jardín y vitrinas salen de lo guardado; objetivo sugerido; tiempos', async () => {
  const { recolectarDatos, avisosEstaciones, objetivoBase, mmss } = await import('../src/client/base-hud.js');
  const id = PLANTA_IDS[0], T = 1e12, item = Object.keys(ITEMS)[0];
  const p = { cores: 10, evo: {}, terr: { m1: { bend: null } }, materiales: { hueso: [2, 1, 0, 0] }, inventario: [{ u: 'a1', id: item, q: 0.5, k: 0 }], huespedes: [], mae: {}, arb: {}, menu: {}, tienda: {}, cultivo: { item, listo: T + 50000, dur: 100, q: 0.5 }, base: { vis: {}, tut: false, jardin: [{ p: id, t0: T }, null, null, null, null, null] } };
  const d = recolectarDatos(p, T, 'vesper'); assert.equal(d.sel, 'vesper'); assert.ok(Math.abs(d.cultivo.prog - 0.5) < 1e-9 && d.cultivo.faltan === 50); assert.equal(d.cultivo.mat, ITEMS[item].mat);
  assert.equal(d.stock.hueso, 3); assert.ok(d.terr.m1); assert.equal(d.jardin.length, 6); assert.equal(d.jardin[0].estado, 'crece'); assert.equal(d.jardin[1].estado, 'vacia');
  assert.equal(d.gems.length, 1); assert.ok(d.owned.length >= 3);
  assert.equal(avisosEstaciones(p, T).forja, undefined); assert.equal(avisosEstaciones(p, T + 60000).forja, 1);
  const o = objetivoBase(p); assert.ok(o.texto && o.donde && o.go);
  assert.equal(mmss(75), '1:15'); assert.equal(mmss(0), '0:00'); assert.equal(mmss(7300), '2 h 01 min');
});

test('mapa: la Base se puede pisar en solitario junto a Game sin tocar las demás arenas (las seis siguen intactas)', () => {
  assert.deepEqual(MAP_IDS, ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']);
  const g = new Game({ mapId: 'm6', seed: 1 }); g.addPlayer('x'); g.step(DT); assert.ok(!g.base, 'las arenas no tienen estado de Base');
});
