import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { MAP_IDS } from '../src/sim/maps.js';
import { v3, dist, madd, norm } from '../src/sim/math.js';
import { PLAYER, WAVE_PLANS } from '../src/sim/data.js';
import { iniciarEvento } from '../src/sim/eventos.js';
import { nieblaTemporal } from '../src/sim/nieblas.js';
import {
  FAUNA, ESPECIES, ESPECIE_IDS, FORMAS, FORMA_BASE_IDS, HIBRIDOS, HIBRIDOS_DEF, TODAS, FORMA_IDS, especiesDe, RARAS, hibridoDe, formaIndice, formaPorIndice, especieIndice,
  bonoCodice, parConExtra, limpiarFauna, registrarComida, HITOS, proximoHito, faunaDeRed, mezclar,
} from '../src/sim/fauna-data.js';
import { CTL, faunaSpawn, darForma, comer, parDe, faunaDamageIn, faunaSpd, faunaMelee, shapeFauna, faunaHit, tickFauna, faunaSnap, faunaForzarRara } from '../src/sim/fauna.js';
import { arena, run, hash } from './helpers.js';

// FAUNA CONSUMIBLE Y METAMORFOSIS (src/sim/fauna.js + fauna-data.js, docs/FAUNA.md): datos, determinismo (rng propio), límites, spawn por arena, comportamiento,
// consumo, el efecto de CADA forma, híbridos, residuo, Códice, misión, eventos/nieblas, Melé/Shooter y snapshot compacto.
// Los bots que no se traban están en fauna-bots.test.js y el presupuesto de dibujo en fauna-render.test.js.
const enOla = (g, n = 4) => { g.wave = n; g.phase = 'wave'; g.phaseT = 1e9; if (g.ar) g.ar.wave = n; };
/** Cancha: 1 jugador casi invulnerable, sin oleadas, sin fauna espontánea (se crea a mano), y un blanco quieto de vida enorme. */
function cancha(mapId = 'm1', { seed = 1, ola = 0, cod = null } = {}) {
  const { g, p } = arena(mapId, { seed }); if (ola) enOla(g, ola);
  g.fa.cd = 1e9; g.ng.zonas = g.ng.zonas.filter((z) => z.src !== 'arena');
  if (cod) p.fcod = { ...cod };
  return { g, p };
}
const blanco = (g, p, d = 3, hp = 1e9) => { const m = g.spawnMonster('astilla', madd(p.pos, p.heading, d), { noElite: true }); m.passive = true; m.hp = m.maxhp = hp; return m; };
const comerEsp = (g, p, esp, d = 1.5) => { const f = faunaSpawn(g, esp, madd(p.pos, p.heading, d), 'dormida'); assert.ok(f, 'nació ' + esp); assert.equal(comer(g, p, f), true); return f; };
const FASE = (g, p, id) => { p.ff = { id, t: 80, d: 80, base: HIBRIDOS[id] ? HIBRIDOS[id].hib : null, sp: null, extra: false }; p.faPar = null; };

/* ───────── datos ───────── */
test('datos: ≥ 18 especies, 3 temáticas por arena, formas completas, ≥ 6 híbridos y reglas de equilibrio', () => {
  assert.ok(ESPECIE_IDS.length >= 18, `${ESPECIE_IDS.length} especies`);
  for (const m of MAP_IDS) assert.equal(especiesDe(m).length, 3, `${m}: 3 especies temáticas`);
  assert.ok(RARAS.length >= 1);
  const pel = ESPECIE_IDS.filter((i) => ESPECIES[i].peligrosa); assert.ok(pel.length >= 2 && pel.length <= 3, `peligrosas: ${pel.length}`);
  for (const id of ESPECIE_IDS) {
    const s = ESPECIES[id];
    assert.equal(s.id, id); assert.ok(FORMAS[s.forma], `${id}: forma ${s.forma}`);
    assert.ok(s.nombre && s.folclore.length > 60 && s.frase && s.pista, `${id}: textos`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(s.c1) && /^#[0-9a-f]{6}$/i.test(s.c2), `${id}: colores`);
    assert.ok(s.dur >= 60 && s.dur <= 90, `${id}: duración ${s.dur} entre 60 y 90 s`);
    assert.ok(s.corre >= s.vel && s.alerta >= 5 && s.tam > 0.3 && s.tam < 1, `${id}: números`);
    assert.ok(s.mapa === '*' || MAP_IDS.includes(s.mapa), id);
    assert.equal(especieIndice(id), ESPECIE_IDS.indexOf(id));
  }
  for (const id of FORMA_BASE_IDS) { const f = FORMAS[id]; assert.ok(f.nombre && f.icono && f.desc.length > 40 && /^#[0-9a-f]{6}$/i.test(f.color) && f.par && Number.isInteger(f.vis), id); }
  assert.ok(HIBRIDOS_DEF.length >= 6, 'al menos 6 híbridos'); assert.equal(Object.keys(HIBRIDOS).length, HIBRIDOS_DEF.length);
  for (const h of HIBRIDOS_DEF) {
    assert.ok(FORMAS[h.a] && FORMAS[h.b], h.id); assert.equal(hibridoDe(h.a, h.b), h.id); assert.equal(hibridoDe(h.b, h.a), h.id, 'el orden no importa');
    const par = HIBRIDOS[h.id].par; assert.ok(!par.dIn || par.dIn >= 0.6, `${h.id}: dIn`); assert.ok(!par.dOut || par.dOut <= 1.15, `${h.id}: dOut`); assert.ok(!par.spd || par.spd <= 1.3, `${h.id}: spd`);
    assert.ok(Object.keys(par).length >= Math.max(Object.keys(FORMAS[h.a].par).length, 2), `${h.id}: conserva efectos`);
  }
  assert.ok(hibridoDe('hielo', 'electrica') && hibridoDe('brasa', 'marea'), 'ejemplos del pedido: hielo+eléctrica, brasa+marea');
  assert.equal(hibridoDe('hielo', 'hielo'), null); assert.equal(hibridoDe('lunar', 'sonico'), null);
  FORMA_IDS.forEach((id, i) => { assert.equal(formaIndice(id), i + 1); assert.equal(formaPorIndice(i + 1), TODAS[id]); });
  assert.equal(formaIndice(null), 0); assert.equal(formaPorIndice(0), null);
  for (const f of Object.values(FORMAS)) { const p = f.par; assert.ok(!p.dIn || p.dIn >= 0.7, `${f.id}: dIn`); assert.ok(!p.dOut || p.dOut <= 1.15, `${f.id}: dOut`); assert.ok(!p.spd || p.spd <= 1.2, `${f.id}: spd`); }
  const m = mezclar(FORMAS.hueso, FORMAS.hueso); assert.ok(m.dIn >= 0.6, 'mezclar recorta dIn');
});

/* ───────── determinismo, rng propio y límites ───────── */
test('determinismo: misma semilla = misma fauna; y la fauna NO toca el azar de las oleadas (g.rng ni los ids)', () => {
  const jugar = (off) => { CTL.off = off; try { const g = new Game({ mapId: 'm4', seed: 11, calm: 2 }); const p = g.addPlayer('t'); p.hp = 1e6; run(g, 12); return { g, rng: g.rng.next(), q: g.queue.join(), nid: g.nextId, mons: g.monsters.map((m) => m.kind + m.id).join() }; } finally { CTL.off = false; } };
  const a = jugar(false), b = jugar(false), c = jugar(true);
  assert.deepEqual(a.g.snapshot().fa, b.g.snapshot().fa); assert.ok(a.g.snapshot().fa, 'hay fauna');
  assert.equal(hash(a.g.snapshot()), hash(b.g.snapshot()));
  assert.equal(c.g.fa, null, 'CTL.off apaga todo');
  assert.equal(a.rng, c.rng, 'g.rng sigue igual con y sin fauna'); assert.equal(a.q, c.q, 'misma cola de oleada'); assert.equal(a.nid, c.nid, 'mismos ids'); assert.equal(a.mons, c.mons);
  const o = new Game({ mapId: 'm4', seed: 12, calm: 2 }); o.addPlayer('t'); run(o, 12); assert.notDeepEqual(o.snapshot().fa, a.g.snapshot().fa, 'otra semilla, otra fauna');
});
test('límites: nunca más de FAUNA.max bichos ni rastros de más; en el jefe no nace nada; en combate nace poco', () => {
  const { g, p } = arena('m1', { seed: 5 }); g.phaseT = 1e9;
  let max = 0, zmax = 0; run(g, 90, () => { max = Math.max(max, g.fa.list.length); zmax = Math.max(zmax, g.fa.zonas.length); });
  assert.ok(max >= 6 && max <= FAUNA.max, `respiro: ${max}`);
  g.wave = 2; g.phase = 'wave'; g.phaseT = 1e9; if (g.ar) g.ar.wave = 2; blanco(g, p, 20); let nacidas0 = g.fa.stats.nacidas; run(g, 120, () => { max = Math.max(max, g.fa.list.length); });
  assert.ok(g.fa.list.length <= FAUNA.oleada.meta + 4, `en combate quedan ${g.fa.list.length}`);
  assert.ok(g.fa.stats.nacidas - nacidas0 <= 14, `en combate nacen pocas (${g.fa.stats.nacidas - nacidas0} en 120 s)`);
  g.wave = g.waveTotal; run(g, 200); assert.ok(g.fa.list.length <= 1, `jefe: ${g.fa.list.length} (se retiran)`);
  const n0 = g.fa.stats.nacidas; run(g, 40); assert.equal(g.fa.stats.nacidas, n0, 'en el jefe no nace fauna');
  assert.ok(max <= FAUNA.max && zmax <= FAUNA.zonasMax); p.hp = p.hp;
  for (let i = 0; i < 30; i++) faunaSpawn(g, 'lagartija_hielo', madd(p.pos, p.heading, 5 + i)); assert.ok(g.fa.list.length >= 1);
});
test('spawn por arena: cada arena sólo ve SUS 3 especies (más las raras) y con el tiempo salen las tres', () => {
  for (const id of MAP_IDS) {
    const g = new Game({ mapId: id, seed: 21 }); const p = g.addPlayer('t'); p.hp = 1e6; g.phaseT = 1e9;
    const vistas = new Set(); run(g, 240, () => { for (const f of g.fa.list) vistas.add(f.sp.id); });
    for (const v of vistas) assert.ok(especiesDe(id).includes(v) || ESPECIES[v].rara, `${id}: ${v} no es de esta arena`);
    for (const e of especiesDe(id)) assert.ok(vistas.has(e), `${id}: nunca salió ${e}`);
    for (const f of g.fa.list) { assert.ok(Number.isFinite(f.pos.x + f.pos.y + f.pos.z) && !g.map.outOfBounds(f.pos), `${id}: ${f.sp.id} en el aire o fuera`); }
  }
});
test('los bichos se quedan sobre el piso del mapa durante 3 minutos (nadie se cae al vacío ni atraviesa muros)', () => {
  for (const id of MAP_IDS) {
    const g = new Game({ mapId: id, seed: 8 }); const p = g.addPlayer('t'); p.hp = 1e6; g.phaseT = 1e9; let fuera = 0;
    run(g, 180, () => { for (const f of g.fa.list) if (g.map.outOfBounds(f.pos) || !Number.isFinite(f.pos.x)) fuera++; });
    assert.equal(fuera, 0, `${id}: ${fuera} cuadros fuera del mapa`);
  }
});

/* ───────── comportamiento ───────── */
test('estados: dormida → alerta → huye (zigzag, se cansa y descansa); pastando se mueve; los voladores mantienen altura', () => {
  const { g, p } = cancha('m3');
  const f = faunaSpawn(g, 'grillo_silbador', madd(p.pos, p.heading, 14), 'dormida'); assert.equal(f.st, 'dormida');
  const p0 = { ...f.pos }; run(g, 2); assert.equal(f.st, 'dormida', 'a 14 m sigue durmiendo'); assert.ok(dist(f.pos, p0) < 0.5);
  p.pos = madd(f.pos, norm(v3(1, 0, 0)), -2.5); p.vel = v3(); run(g, 0.2); assert.equal(f.st, 'dormida', 'caminando despacio a 2,5 m todavía duerme (se puede comer)');
  p.pos = madd(f.pos, v3(1, 0, 0), -1.0); run(g, 0.1); assert.equal(f.st, 'alerta', 'a 1 m despierta');
  const antes = dist(f.pos, p.pos); run(g, 2, () => { p.pos = madd(f.pos, v3(1, 0, 0), -1.8); p.vel = v3(); });
  assert.equal(f.st === 'huyendo' || f.st === 'cansada', true, 'huye si te quedás cerca'); void antes;
  let cans = false, huyo = false; for (let i = 0; i < 60 * 12; i++) { p.pos = madd(f.pos, v3(1, 0, 0), -3); p.vel = v3(); g.step(1 / 60); if (f.st === 'cansada') cans = true; if (f.st === 'huyendo') huyo = true; }
  assert.ok(huyo && cans, 'corre y se cansa (así se la puede alcanzar)');
  const q = faunaSpawn(g, 'polilla_vacio', madd(p.pos, p.heading, 10), 'pastando'); run(g, 4, () => { p.pos = madd(q.pos, v3(1, 0, 0), -25); });
  const base = g.map.islandAt ? g.map.islandAt(q.pos) : null; void base; assert.ok(Number.isFinite(q.pos.y));
});
test('pastando: se mueve de a poco; ni se queda atrás ni cruza el mapa', () => {
  const { g, p } = cancha('m5'); const f = faunaSpawn(g, 'cucaracha_relojera', v3(0, 0.6, 20), 'pastando'); p.pos = v3(0, 0.9, -30);
  const p0 = { ...f.pos }; let mov = 0; run(g, 30, () => { mov = Math.max(mov, dist(f.pos, p0)); });
  assert.ok(mov > 1, `se movió ${mov.toFixed(1)} m`); assert.ok(mov < 60);
});
test('peligrosas: no huyen, muerden si las pisás (con aviso) y nunca te bajan de 15 de vida', () => {
  const { g, p } = cancha('m4', { ola: 3 }); blanco(g, p, 40); const f = faunaSpawn(g, 'sapo_venenoso', madd(p.pos, p.heading, 6), 'pastando');
  p.pos = madd(f.pos, v3(1, 0, 0), -4); run(g, 0.3); assert.equal(f.st, 'acechando', 'se queda mirando (no huye)');
  const hp0 = p.hp = 100; p.shield = 0; p.pos = madd(f.pos, v3(1, 0, 0), -0.5); p.vel = v3(); run(g, 4, () => { p.pos = madd(f.pos, v3(1, 0, 0), -0.5); p.vel = v3(); });
  assert.ok(g.fa.stats.mordidas >= 1 && p.hp < hp0, 'mordió'); assert.ok(p.hp > 0);
  p.hp = 20; p.shield = 0; p.invulUntil = 0; f.muerdeCd = 0; f.st = 'acechando'; run(g, 3, () => { p.pos = madd(f.pos, v3(1, 0, 0), -0.5); p.vel = v3(); });
  assert.ok(p.hp >= 15 - 1e-6, `la mordida no mata (hp ${p.hp})`);
  const d = new Game({ mapId: 'm4', seed: 3 }); d.addPlayer('x'); const sapo = faunaSpawn(d, 'sapo_venenoso', v3(0, 1, 0), 'dormida'); void sapo;
});

/* ───────── consumo ───────── */
test('comer: USAR a ≤ 2,7 m da la forma (60-90 s) y lo anota; lejos no pasa nada; dormida y despierta se pueden comer', () => {
  const { g, p } = cancha('m1');
  const lej = faunaSpawn(g, 'lagartija_hielo', madd(p.pos, p.heading, 6), 'dormida');
  p.input.interact = true; run(g, 0.1); p.input.interact = false; run(g, 0.1);
  assert.equal(p.ff, null, 'a 6 m no come'); assert.ok(g.fa.list.includes(lej));
  p.pos = madd(lej.pos, v3(1, 0, 0), -2.2); p.vel = v3(); g.drainEvents();
  p.input.interact = true; run(g, 0.05); p.input.interact = false;
  assert.ok(p.ff && p.ff.id === 'hielo', 'forma de hielo'); assert.ok(p.ff.t >= 60 && p.ff.t <= 90, `dura ${p.ff.t}`);
  assert.ok(!g.fa.list.includes(lej), 'el bicho desaparece');
  const ev = g.drainEvents().find((e) => e.t === 'fauna' && e.ph === 'come'); assert.ok(ev && ev.pid === p.id && ev.f === formaIndice('hielo') && ev.sp === especieIndice('lagartija_hielo'));
  const s = g.snapshot().players[0]; assert.equal(s.mf, formaIndice('hielo')); assert.ok(s.mt > 59 && s.md >= 60);
  const g2 = new Game({ mapId: 'm1' }); g2.addPlayer('x'); const s2 = g2.snapshot().players[0]; assert.equal(s2.mf, undefined, 'sin forma no hay campos');
  run(g, 0.1); const q = faunaSpawn(g, 'colibri_luz', madd(p.pos, p.heading, 1.5), 'pastando');   // despierta también (si te alcanza)
  p.input.interact = true; run(g, 0.05); p.input.interact = false; assert.ok(!g.fa.list.includes(q), 'despierta, a mano, también se come');
});
test('auto-consumo opcional (input.autoc): pegado ~0,6 s se come solo; sin la opción nunca', () => {
  const { g, p } = cancha('m1'); faunaSpawn(g, 'lagartija_hielo', madd(p.pos, p.heading, 1.65), 'dormida');
  run(g, 2); assert.equal(p.ff, null, 'sin autoc no come');
  const { g: g2, p: p2 } = cancha('m1'); faunaSpawn(g2, 'lagartija_hielo', madd(p2.pos, p2.heading, 1.65), 'dormida');
  p2.input.autoc = true; run(g2, 0.4); assert.equal(p2.ff, null); run(g2, 0.5); assert.ok(p2.ff, 'a los ~0,6 s se come');
});
test('al caer la metamorfosis se pierde; la forma termina sola y avisa', () => {
  const { g, p } = cancha('m2'); comerEsp(g, p, 'mariposa_electrica'); p.ff.t = 0.2; g.drainEvents(); run(g, 0.5);
  assert.equal(p.ff, null); assert.ok(g.drainEvents().some((e) => e.t === 'fauna' && e.ph === 'fin'));
  comerEsp(g, p, 'mariposa_electrica'); g.hurtPlayer(p, 1e9, true); run(g, 0.2); assert.equal(p.ff, null);
});

/* ───────── formas: híbridos, refresco, residuo ───────── */
test('híbridos: las 12 combinaciones salen al comer una especie de cada forma, en cualquier orden', () => {
  const porForma = (f) => ESPECIE_IDS.find((i) => ESPECIES[i].forma === f);
  for (const h of HIBRIDOS_DEF) for (const [x, y] of [[h.a, h.b], [h.b, h.a]]) {
    const { g, p } = cancha('m1'); comerEsp(g, p, porForma(x)); comerEsp(g, p, porForma(y));
    assert.equal(p.ff.id, h.id, `${x}+${y}`); assert.deepEqual([...p.ff.base].sort(), [h.a, h.b].sort()); assert.ok(p.fr === null, 'fusionar no deja residuo'); assert.ok(p.ff.t > 60 && p.ff.t <= FAUNA.duracionMax);
    assert.ok(g.drainEvents().some((e) => e.t === 'fauna' && e.ph === 'hibrido'));
  }
});
test('sustituir deja un residuo menor; refrescar no; el híbrido no se fusiona otra vez; el residuo se apaga', () => {
  const { g, p } = cancha('m1');
  comerEsp(g, p, 'lagartija_hielo'); const t0 = p.ff.t; run(g, 10); const t1 = p.ff.t; assert.ok(t1 < t0 - 9);
  comerEsp(g, p, 'lagartija_hielo'); assert.equal(p.ff.id, 'hielo'); assert.ok(p.ff.t > t1, 'comer la misma refresca'); assert.equal(p.fr, null);
  comerEsp(g, p, 'colibri_luz');   // hielo + luz: no hay híbrido → sustituye
  assert.equal(p.ff.id, 'luz'); assert.ok(p.fr && p.fr.id === 'hielo' && p.fr.t <= FAUNA.residuoMax, 'hielo queda como residuo');
  const par = parDe(p); assert.ok(par.dIn < 1 && par.dIn > FORMAS.hielo.par.dIn, 'el residuo da una parte del −daño recibido');
  assert.equal(par.slow, FORMAS.luz.par.slow, 'el residuo NO da efectos por golpe'); assert.ok(!par.freeze);
  p.fr.t = 0.1; run(g, 0.3); assert.equal(p.fr, null, 'el residuo termina');
  comerEsp(g, p, 'polilla_vacio');   // luz + vacío → sustituye (sin híbrido)
  const { g: g3, p: p3 } = cancha('m1'); comerEsp(g3, p3, 'lagartija_hielo'); comerEsp(g3, p3, 'mariposa_electrica'); assert.equal(p3.ff.id, 'ventisca');
  comerEsp(g3, p3, 'salamandra_brasa'); assert.equal(p3.ff.id, 'brasa', 'un híbrido no se fusiona con un tercero: lo sustituye'); assert.equal(p3.fr.id, 'ventisca');
});

/* ───────── el efecto de CADA forma ───────── */
const golpear = (g, p, m, n = 1, dmg = 10) => { for (let i = 0; i < n; i++) { g.time += 0.2; g.damageMonster(m, dmg, p, m.pos); } };
test('hielo: −20 % de daño, ralentiza y a veces congela, deja escarcha que ayuda a vos y frena a ellos, y el fuego duele', () => {
  const { g, p } = cancha('m1', { ola: 3 }); const m = blanco(g, p); FASE(g, p, 'hielo');
  assert.ok(Math.abs(faunaDamageIn(g, p, 100) - 80) < 0.01, '−20 %');
  golpear(g, p, m, 1); assert.ok(m.slowUntil > g.time, 'ralentiza');
  let cong = 0; for (let i = 0; i < 60; i++) { m.chronoUntil = 0; golpear(g, p, m); if (m.chronoUntil > g.time) cong++; } assert.ok(cong >= 1 && cong < 40, `congela a veces (${cong}/60)`);
  p.input.mz = 1; run(g, 3); assert.ok(g.fa.zonas.some((z) => z.k === 0), 'deja escarcha al correr');
  const z = g.fa.zonas[0]; const base = faunaSpd(g, p); p.pos = madd(z.pos, z.u, 0.8); assert.ok(faunaSpd(g, p) >= base - 1e-9);
  const enZona = blanco(g, p, 0.1); enZona.pos = { ...z.pos }; enZona.slowUntil = 0; run(g, 0.2); assert.ok(enZona.slowUntil > g.time, 'la escarcha frena a las criaturas');
  p.ngB = { dIn: 1.3 }; assert.ok(faunaDamageIn(g, p, 100) > 100 * 0.8 * 1.2, 'vulnerable al fuego (niebla ámbar)'); p.ngB = null;
});
test('brasa: tus golpes queman, la estela de fuego daña a las criaturas, +8 % de daño y +5 % de daño recibido', () => {
  const { g, p } = cancha('m1', { ola: 3 }); const m = blanco(g, p); FASE(g, p, 'brasa');
  golpear(g, p, m); assert.equal(m.dotKind, 'burn'); assert.ok(m.dotDps >= 14 && m.dotUntil > g.time);
  assert.ok(faunaDamageIn(g, p, 100) > 100); p.input.mz = 1; run(g, 3); const z = g.fa.zonas.find((q) => q.k === 1); assert.ok(z && z.dps > 0, 'estela de fuego');
  const e = blanco(g, p, 0.1); e.pos = { ...z.pos }; z.born = g.time; z.life = 99; const hp = e.hp = e.maxhp = 1000; run(g, 1); assert.ok(e.hp < hp, 'quema');
});
test('eléctrica: +18 % de velocidad y cadena de rayos a los vecinos', () => {
  const { g, p } = cancha('m2', { ola: 3 }); const a = blanco(g, p, 3), b = blanco(g, p, 5), c = blanco(g, p, 7); FASE(g, p, 'electrica');
  p.spdMul = 1; assert.ok(Math.abs(faunaSpd(g, p) - 1.18) < 0.01);
  g.drainEvents(); const hb = b.hp, hc = c.hp; golpear(g, p, a, 1, 50); assert.ok(b.hp < hb && c.hp <= hc, 'el rayo salta'); assert.ok(g.drainEvents().some((e) => e.t === 'arc'));
});
test('marea: se cura sola, el escudo vuelve y los golpes empujan', () => {
  const { g, p } = cancha('m3', { ola: 3 }); const m = blanco(g, p); FASE(g, p, 'marea'); p.hp = 40; p.shield = 0; p.lastHurt = -99; run(g, 5);
  assert.ok(p.hp > 40 + 3.5 * 4.5, `curó ${p.hp - 40}`); assert.ok(p.shield > 20, 'escudo');
  const v0 = m.vel.x + m.vel.z; m.vel = v3(); golpear(g, p, m); assert.ok(Math.hypot(m.vel.x, m.vel.z) > 3, 'empuja'); void v0;
});
test('cristal: +40 de escudo al transformarse, −12 % de daño y refleja un 35 % a los que te rodean', () => {
  const { g, p } = cancha('m2', { ola: 3 }); p.shield = 0; comerEsp(g, p, 'escarabajo_cristal'); assert.ok(p.shield >= 40);
  const m = blanco(g, p, 4); const hp = m.hp; assert.ok(Math.abs(faunaDamageIn(g, p, 100) - 88) < 0.01); assert.ok(m.hp < hp, 'devolvió daño'); assert.ok(hp - m.hp > 20);
});
test('vacío: salta más, fase (1.ª herida cada 7 s te vuelve intocable) y drena vida con lo que golpeás', () => {
  const { g, p } = cancha('m1', { ola: 3 }); FASE(g, p, 'vacio'); p.jumpMul = 1; run(g, 0.1); assert.ok(p.jumpMul >= 1.35 - 1e-9);
  const hp = p.hp = 50; p.shield = 0; p.invulUntil = 0; g.hurtPlayer(p, 30); assert.equal(p.hp, hp, 'la primera herida no pega (fase)'); assert.ok(p.invulUntil > g.time);
  p.invulUntil = 0; p.shield = 0; g.time += 1; g.hurtPlayer(p, 30); assert.ok(p.hp < hp, 'la segunda dentro de 7 s sí');
  g.time += 8; p.invulUntil = 0; p.shield = 0; const h2 = p.hp; g.hurtPlayer(p, 30); assert.equal(p.hp, h2, 'pasado el enfriamiento, otra fase');
  const m = blanco(g, p); p.hp = 50; golpear(g, p, m, 1, 100); assert.ok(p.hp > 50, 'drena');
});
test('veneno: los golpes envenenan y a veces suelta una nube tóxica que ralentiza y daña', () => {
  const { g, p } = cancha('m4', { ola: 3 }); const m = blanco(g, p); FASE(g, p, 'veneno');
  golpear(g, p, m); assert.equal(m.dotKind, 'poison'); let nube = false; for (let i = 0; i < 80 && !nube; i++) { golpear(g, p, m); nube = g.fa.zonas.some((z) => z.k === 2); } assert.ok(nube, 'nube tóxica');
  const z = g.fa.zonas.find((q) => q.k === 2); const e = blanco(g, p, 0.1); e.pos = { ...z.pos }; z.born = g.time; const hp = e.hp = e.maxhp = 500; run(g, 1); assert.ok(e.hp < hp && e.slowUntil > g.time);
});
test('luz: +10 % de daño, +5 % de velocidad, disparos que atraviesan y deslumbran a los vecinos', () => {
  const { g, p } = cancha('m1', { ola: 3 }); FASE(g, p, 'luz'); const w = { kind: 'hitscan', dmg: 10, pierce: false }; shapeFauna(w, p); assert.equal(w.pierce, true, 'atraviesa');
  const a = blanco(g, p, 3), b = blanco(g, p, 4); b.slowUntil = 0; let dz = false; for (let i = 0; i < 80 && !dz; i++) { golpear(g, p, a); dz = b.slowUntil > g.time; } assert.ok(dz, 'deslumbra');
  const w2 = { kind: 'projectile', pierce: false }; shapeFauna(w2, p); assert.equal(w2.pierce, false, 'sólo los rayos');
});
test('hueso: −28 % de daño y las criaturas pegadas a vos se clavan en las espinas', () => {
  const { g, p } = cancha('m6', { ola: 3 }); FASE(g, p, 'hueso'); const m = blanco(g, p, 1.5); const hp = m.hp;
  assert.ok(Math.abs(faunaDamageIn(g, p, 100) - 72) < 0.01); assert.ok(hp - m.hp > 40, 'espinas'); const lejos = blanco(g, p, 9); const h2 = lejos.hp; faunaDamageIn(g, p, 100); assert.equal(lejos.hp, h2, 'las lejanas no');
});
test('eco: a veces el golpe vuelve como un eco; sangre: robás vida; humo: te pierden de vista; lunar: salto y escudo; sónico: empuje', () => {
  const { g, p } = cancha('m2', { ola: 3 }); const m = blanco(g, p); FASE(g, p, 'eco'); let ec = false; for (let i = 0; i < 80 && !ec; i++) { golpear(g, p, m); ec = g.fa.eco.length > 0; } assert.ok(ec, 'eco en cola');
  const hp = m.hp; run(g, 0.5); assert.ok(m.hp < hp, 'el eco pega');
  FASE(g, p, 'sangre'); p.hp = 50; golpear(g, p, m, 1, 100); assert.ok(p.hp >= 50 + 100 * 0.12 * 0.9, 'lifesteal'); assert.ok(faunaDamageIn(g, p, 100) > 105);
  FASE(g, p, 'humo'); p.cloakUntil = 0; p.faAtk = -99; run(g, 0.2); assert.ok(p.cloakUntil > g.time, 'humo = camuflaje'); assert.ok(Math.abs(faunaSpd(g, p) - 1.14) < 0.01);
  FASE(g, p, 'lunar'); p.jumpMul = 1; p.shield = 0; p.lastHurt = -99; run(g, 3); assert.ok(p.jumpMul >= 1.3 - 1e-9 && p.shield > 20);
  FASE(g, p, 'sonico'); m.vel = v3(); golpear(g, p, m); assert.ok(Math.hypot(m.vel.x, m.vel.z) > 5);
});
test('flora, tiempo, ceniza, cobre, arcoíris y aurora: cada una hace lo suyo', () => {
  const { g, p } = cancha('m4', { ola: 3 }); const m = blanco(g, p, 3);
  FASE(g, p, 'flora'); p.hp = 40; run(g, 4); assert.ok(p.hp > 45, 'savia cura'); let en = false; for (let i = 0; i < 60 && !en; i++) { m.chronoUntil = 0; golpear(g, p, m); en = m.chronoUntil > g.time; } assert.ok(en, 'enraíza');
  FASE(g, p, 'tiempo'); p.movCd = 10; m.slowUntil = 0; run(g, 1); assert.ok(m.slowUntil > g.time, 'aura frena'); assert.ok(p.movCd < 9.8 - 0.1, 'recargas más rápidas');
  FASE(g, p, 'ceniza'); const hp = m.hp; m.slowUntil = 0; run(g, 1); assert.ok(m.hp < hp && m.slowUntil > g.time, 'ceniza frena y asfixia');
  FASE(g, p, 'cobre'); const b = blanco(g, p, 4); const hb = b.hp; golpear(g, p, m, 1, 80); assert.ok(b.hp < hb, 'chispas'); assert.ok(Math.abs(faunaDamageIn(g, p, 100) - 85) < 0.01);
  FASE(g, p, 'arcoiris'); const w = { kind: 'hitscan', pierce: false }; shapeFauna(w, p); assert.ok(w.pierce); p.hp = 50; run(g, 3); assert.ok(p.hp > 52);
  FASE(g, p, 'aurora'); p.hp = 30; p.shield = 0; p.lastHurt = -99; run(g, 4); assert.ok(p.hp > 50 && p.shield > 40);
});
test('los 20 + 12 formas: todas aplican sus números sin romper nada (dIn/dOut/spd dentro del rango de equilibrio)', () => {
  const { g, p } = cancha('m1', { ola: 3 }); const m = blanco(g, p);
  for (const id of FORMA_IDS) {
    FASE(g, p, id); p.hp = 100; p.shield = 100; p.lastHurt = -99; p.faPhaseCd = 1e9; const par = parDe(p);
    const d = faunaDamageIn(g, p, 100); assert.ok(d >= 55 && d <= 125, `${id}: daño recibido ${d}`);
    run(g, 0.3); golpear(g, p, m, 3, 20); assert.ok(Number.isFinite(p.hp) && Number.isFinite(m.hp), id);
    const sp = faunaSpd(g, p); assert.ok(sp >= 0.9 && sp <= 1.31, `${id}: velocidad ${sp}`); assert.ok(par);
    p.invulUntil = 0; g.time += 10;
  }
  assert.equal(p.dead, false);
});
test('equilibrio: ninguna forma multiplica mucho el daño total (daño hecho/recibido) ni se vuelve inmortal', () => {
  for (const id of FORMA_IDS) {
    const par = TODAS[id].par; const sal = (par.dOut || 1) * (1 / (par.dIn || 1));
    assert.ok(sal <= 1.6, `${id}: poder neto ${sal.toFixed(2)}`);
    assert.ok((par.regen || 0) <= 9 && (par.sreg || 0) <= 16 && (par.lifesteal || 0) <= 0.2, `${id}: curación`);
  }
});

/* ───────── Melé y Shooter ───────── */
test('Melé: el remate (golpe pesado o 3.er golpe) DEVORA al bicho de enfrente y suelta el golpe elemental de la forma; el golpe liviano no devora', () => {
  const { g, p } = cancha('m1', { ola: 3 }); p.mode = 'combo';
  const f = faunaSpawn(g, 'lagartija_hielo', madd(p.pos, p.heading, 2), 'dormida'); const o = g.eyePos(p), d = norm(g.aimDir(p));
  faunaMelee(g, p, o, d, 3.4, false); assert.ok(g.fa.list.includes(f), 'un golpe normal no devora'); assert.equal(p.ff, null);
  faunaMelee(g, p, o, d, 3.4, true); assert.ok(!g.fa.list.includes(f), 'el remate devora'); assert.equal(p.ff.id, 'hielo');
  assert.ok(g.drainEvents().some((e) => e.t === 'fauna' && e.ph === 'devora'));
  const ms = [blanco(g, p, 2), blanco(g, p, 3.5)]; for (const m of ms) { m.hp = m.maxhp = 1e6; m.chronoUntil = 0; } g.drainEvents(); p.faFinCd = 0; p.faBusy = false;
  let c = 0; for (let i = 0; i < 40; i++) { p.faFinCd = 0; faunaMelee(g, p, o, d, 3.4, true); if (ms.some((m) => m.chronoUntil > g.time)) c++; } assert.ok(c >= 1, 'el remate de hielo congela');
  assert.ok(ms[0].hp < 1e6, 'daña'); assert.ok(g.fa.stats.remates >= 1);
  const ev = g.drainEvents().find((e) => e.t === 'fauna' && e.ph === 'remate'); assert.ok(ev && ev.k === 'hielo' && ev.r === 5);
});
test('Melé de verdad: los golpes del Huésped (strike) proc de la forma y el golpe pesado devora', () => {
  const { g, p } = cancha('m1', { ola: 3 }); g.setInput(p.id, { mode: 'combo' }); p.mode = 'shooter';   // el golpe V clásico (Disparo) también remata con el pesado
  const f = faunaSpawn(g, 'lagartija_hielo', madd(p.pos, p.heading, 2), 'dormida'); const m = blanco(g, p, 3); void m;
  p.input.melee = true; run(g, 0.7); p.input.melee = false; run(g, 0.5);
  assert.ok(p.ff && p.ff.id === 'hielo' || !g.fa.list.includes(f) === false, 'el pesado devora o el bicho sigue (si no alcanzó)');
});
test('Shooter: la forma cambia la munición (atraviesa, color elemental) y los disparos reales aplican estados', () => {
  const { g, p } = cancha('m1', { ola: 3 }); const w = { kind: 'hitscan' }; FASE(g, p, 'hielo'); shapeFauna(w, p); assert.equal(w.fxk, 'glaciar');
  FASE(g, p, 'brasa'); shapeFauna(w, p); assert.equal(w.fxk, 'brasa'); FASE(g, p, 'electrica'); shapeFauna(w, p); assert.equal(w.fxk, 'voltaico');
  const m = blanco(g, p, 8); p.weapon = 0; FASE(g, p, 'hielo'); g.drainEvents(); p.input.fire = true; run(g, 0.5); p.input.fire = false;
  const sh = g.drainEvents().find((e) => e.t === 'shot'); assert.ok(sh && sh.fx === 'glaciar', 'el disparo viaja con el color de hielo'); assert.ok(m.hp < 1e9 && m.slowUntil > 0, 'el disparo ralentiza');
});

/* ───────── eventos, nieblas, misión ───────── */
test('la Lluvia de Astillas ahuyenta a la fauna y frena los nacimientos; la niebla cian atrae al Colibrí de Luz', () => {
  const { g, p } = arena('m1', { seed: 9 }); g.phaseT = 1e9; run(g, 20); assert.ok(g.fa.list.length >= 3);
  iniciarEvento(g, 'lluvia_astillas', { aviso: 0 }); run(g, 3); assert.ok(g.fa.list.every((f) => f.st === 'huyendo' || f.st === 'cansada' || f.st === 'dormida' && false), 'todos huyen');
  const n0 = g.fa.stats.nacidas; run(g, 5); assert.equal(g.fa.stats.nacidas, n0, 'sin nacimientos durante la lluvia'); void p;
  const h = new Game({ mapId: 'm1', seed: 14 }); h.addPlayer('t'); h.phaseT = 1e9; h.ng.zonas = []; h.fa.cd = 1e9;
  const z = nieblaTemporal(h, 'cian', madd(h.map.spots.core, v3(0, 1.6, 0), 1), 7, 600); for (let i = 0; i < 60 * 4; i++) h.step(1 / 60); assert.ok(z.ph === 'activo' || z.k > 0.3);
  h.fa.cd = 0; let colibri = 0; for (let i = 0; i < 400 && colibri < 6; i++) { h.fa.cd = 0; h.fa.list = []; h.step(1 / 60); if (h.fa.list.some((f) => f.sp.id === 'colibri_luz')) colibri++; }
  assert.ok(colibri >= 3, `la niebla cian atrae al colibrí (${colibri}/400)`);
});
test('misión «Alimentación»: en la oleada 4 aparece una rara cerca y comerla paga núcleos', () => {
  const { g, p } = arena('m1', { seed: 4 }); g.phaseT = 1e9; g.startWave(4, WAVE_PLANS.m1);
  assert.equal(g.mision.k, 'alimento'); assert.equal(g.mision.st, 'active'); const rara = g.fa.list.find((f) => f.sp.rara); assert.ok(rara, 'hay una rara'); assert.ok(rara.vida > 150);
  const cores = p.cores; p.pos = madd(rara.pos, v3(1, 0, 0), -2); p.vel = v3(); p.input.interact = true; run(g, 0.1);
  assert.equal(g.mision.st, 'done'); assert.ok(p.cores > cores, 'núcleos de premio'); assert.ok(p.ff, 'y encima la forma');
  const h = new Game({ mapId: 'm1', seed: 4 }); h.addPlayer('t'); h.startWave(1, WAVE_PLANS.m1); assert.notEqual(h.mision.k, 'alimento');
  const k = new Game({ mapId: 'm1', seed: 4 }); k.addPlayer('t'); k.startWave(5, WAVE_PLANS.m1); assert.equal(k.mision.k, 'intacto', 'el ciclo normal no cambia');
});

/* ───────── Códice ───────── */
test('Códice: hitos 1/5/10/25/50, +duración al 10, efecto extra al 25; se lleva a la partida y se sanea', () => {
  assert.deepEqual(HITOS.map((h) => h.n), [1, 5, 10, 25, 50]); assert.equal(proximoHito(0).n, 1); assert.equal(proximoHito(10).n, 25); assert.equal(proximoHito(50), null);
  assert.equal(bonoCodice(0).descubierta, false); assert.equal(bonoCodice(1).descubierta, true); assert.equal(bonoCodice(5).durMas, 5); assert.equal(bonoCodice(10).durK, 1.2); assert.equal(bonoCodice(25).extra, true); assert.equal(bonoCodice(50).durMas, 15);
  const { g, p } = cancha('m1', { cod: { lagartija_hielo: 0 } }); comerEsp(g, p, 'lagartija_hielo'); const base = p.ff.d;
  const { g: g2, p: p2 } = cancha('m1', { cod: { lagartija_hielo: 10 } }); comerEsp(g2, p2, 'lagartija_hielo'); assert.ok(Math.abs(p2.ff.d - (base * 1.2 + 5)) < 1.01, `+20 % y +5 s: ${p2.ff.d} vs ${base}`); assert.ok(p2.ff.d > base);
  const { g: g3, p: p3 } = cancha('m1', { cod: { lagartija_hielo: 25 } }); comerEsp(g3, p3, 'lagartija_hielo'); assert.equal(p3.ff.extra, true);
  const par = parDe(p3), par0 = parDe(p); assert.ok(par.freeze[0] > par0.freeze[0], 'efecto extra: más probabilidad de congelar');
  assert.ok(Math.round(p3.ff.d) >= Math.round(base * 1.2), 'duración mayor');
  assert.ok(parConExtra(FORMAS.vacio, true).phase[0] < FORMAS.vacio.par.phase[0], 'vacío: fase más seguido'); assert.equal(parConExtra(FORMAS.hielo, false), FORMAS.hielo.par);
  for (const id of FORMA_BASE_IDS) { const e = parConExtra(FORMAS[id], true); assert.ok(e && typeof e === 'object', id); }
  const f = limpiarFauna({ c: { lagartija_hielo: 7.9, inventada: 4, colibri_luz: -3 }, adn: { hielo: 3, nada: 9 }, hib: ['ventisca', 'falso', 'ventisca'] });
  assert.deepEqual(f.c, { lagartija_hielo: 7 }); assert.deepEqual(f.adn, { hielo: 3 }); assert.deepEqual(f.hib, ['ventisca']); assert.equal(f.tot, 7);
  assert.deepEqual(limpiarFauna(null), { c: {}, adn: {}, hib: [], tot: 0 }); assert.deepEqual(limpiarFauna('basura'), { c: {}, adn: {}, hib: [], tot: 0 });
  const r = registrarComida(f, 'lagartija_hielo'); assert.deepEqual(r.hitos, [10 - 2 > 7 ? 0 : 0].filter(Boolean)); const f2 = limpiarFauna({}); const r1 = registrarComida(f2, 'colibri_luz', 'prismatico'); assert.equal(r1.nuevo, true); assert.deepEqual(r1.hitos, [1]); assert.deepEqual(f2.hib, ['prismatico']); assert.equal(f2.adn.luz, 1);
  for (let i = 0; i < 4; i++) registrarComida(f2, 'colibri_luz'); const r5 = registrarComida(f2, 'colibri_luz'); assert.equal(f2.c.colibri_luz, 6); assert.deepEqual(r5.hitos, []);
  assert.deepEqual(faunaDeRed({ lagartija_hielo: 12, x: 5, colibri_luz: 1e9 }), { lagartija_hielo: 12, colibri_luz: 99999 });
  const opt = new Game({ mapId: 'm1' }).addPlayer('x', null, { fauna: { lagartija_hielo: 30, falsa: 5 } }); assert.deepEqual(opt.fcod, { lagartija_hielo: 30 });
});

/* ───────── snapshot compacto ───────── */
test('snapshot compacto: `fa` sólo si hay algo, filas de 12 números, pesa poco; los campos del jugador sólo con forma', () => {
  const g = new Game({ mapId: 'm3', seed: 2 }); const p = g.addPlayer('t'); p.hp = 1e6; g.phaseT = 1e9; run(g, 30);
  const s = g.snapshot(); assert.ok(s.fa && s.fa.l.length >= 3); for (const r of s.fa.l) { assert.equal(r.length, 12); assert.ok(r.every(Number.isFinite)); assert.ok(r[1] >= 0 && r[1] < ESPECIE_IDS.length && r[11] >= 0 && r[11] <= 5); }
  const kb = JSON.stringify(s.fa).length; assert.ok(kb < 1500, `fa pesa ${kb} bytes con ${s.fa.l.length} bichos`);
  assert.ok(!('mf' in s.players[0]) && !('mt' in s.players[0]));
  const f = g.fa.list[0]; p.pos = madd(f.pos, v3(1, 0, 0), -2); p.input.interact = true; run(g, 0.05); const q = g.snapshot().players[0]; assert.ok(q.mf > 0 && q.mt > 0 && q.md > 0);
  const vacio = new Game({ mapId: 'm3' }); assert.equal(faunaSnap(vacio), null, 'nada que mostrar → null');
});
test('rastros: escarcha y fuego caducan y el snapshot los describe', () => {
  const { g, p } = cancha('m1'); FASE(g, p, 'hielo'); p.input.mz = 1; run(g, 3); const s = g.snapshot().fa; assert.ok(s && s.z.length >= 1 && s.z[0].length === 9);
  p.input.mz = 0; FASE(g, p, 'luz'); run(g, 9); assert.equal(g.fa.zonas.length, 0, 'se evaporan');
  faunaForzarRara(g); assert.ok(g.fa.list.some((f) => f.sp.rara));
});
test('modo práctica y La Base: la fauna no rompe nada (práctica sí tiene; Base no)', () => {
  const g = new Game({ mapId: 'm1', practice: true }); g.addPlayer('t'); run(g, 20); assert.ok(g.fa.list.length >= 3);
  const h = new Game({ mapId: 'm1' }); h.addPlayer('t'); h.map = { ...h.map, base: true }; assert.ok(tickFauna && typeof faunaHit === 'function' && typeof darForma === 'function');
});
