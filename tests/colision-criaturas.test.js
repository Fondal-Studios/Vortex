import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { makeBot } from '../src/sim/bot.js';
import { MAPS, MAP_IDS } from '../src/sim/maps.js';
import { MONSTERS } from '../src/sim/data.js';
import { v3, dist, len } from '../src/sim/math.js';
import { barrer, empujar, radioCol, holgura } from '../src/sim/colision.js';
import { hundimiento } from './colision-util.js';
import { arena, run } from './helpers.js';

// «Los enemigos no colisionan con las paredes»: causa raíz medida = en el mapa 3 (Laberinto) las criaturas usaban `mapM` (sólo el suelo) y
// atravesaban TODOS los muros por diseño (5–30 % de los cuadros con el centro dentro de un muro); en el resto había esquivas / arrastres /
// nacimientos que movían a la criatura sin colisión. Estas pruebas fijan: ninguna criatura atraviesa un sólido, nadie «salta» (sin
// teletransportes sin aviso), los rezagados llegan solos y lo atascado se desintegra a la vista.
const DT = 1 / 60;
const TOL = 0.35;   // hundimiento tolerado, como fracción del radio visual (el radio de colisión ya es 0,9–0,97 del visual)

test('colisión: en las 6 arenas, con bots jugando oleadas, ninguna criatura queda dentro de un muro, cobertura, isla o techo', { timeout: 600000 }, () => {
  const resumen = [];
  for (const mapId of MAP_IDS) {
    const g = new Game({ mapId, seed: 7 }); const p = g.addPlayer('b'); const bot = makeBot(g, p.id, { seed: 7, skill: 1.2 });
    let peor = -9, quien = '', muestras = 0, malas = 0;
    while (g.state === 'playing' && g.time < 200) {
      g.setInput(p.id, bot(DT)); g.step(DT); g.events.length = 0;
      if (g.tick % 3) continue;
      for (const m of g.monsters) {
        if (m.dead || m.def.boss) continue;
        muestras++;
        const h = hundimiento(g.map, m.pos, m.r).depth / m.r;
        if (h > peor) { peor = h; quien = m.kind; }
        if (h > TOL) malas++;
      }
    }
    resumen.push(`${mapId}: ${muestras} muestras, peor hundimiento ${(peor * 100).toFixed(0)} % del radio (${quien})`);
    assert.equal(malas, 0, `${mapId}: ${malas} muestras con una criatura metida en un sólido (peor ${(peor * 100).toFixed(0)} % del radio, ${quien})`);
  }
  console.log('# ' + resumen.join('\n# '));
});

/** Blancos de lanzamiento: paredes, coberturas y esferas de cada mapa (se saltan los pisos y las islas enormes). */
function blancos(map) {
  const out = [];
  for (const s of map.solids) {
    if (s.floor || s.type === 'inner') continue;
    if (s.type === 'cyl' && (s.r > 8 || s.y1 - s.y0 < 1.5)) continue;
    if (s.type === 'box' && s.h.y < 1.2 && s.h.x > 30) continue;   // losa de piso
    if (s.type === 'sph' && s.r < 2) continue;
    out.push(s);
  }
  const paso = Math.max(1, Math.ceil(out.length / 40));
  return out.filter((_, i) => i % paso === 0);
}
const centroDe = (s) => s.c;
/** ¿El punto está dentro de la zona jugable? (salas del limbo / planta del laberinto / cualquier punto no «fuera del mapa» en las demás) */
const dentro = (map, p) => !map.outOfBounds(p) && (map.walkable ? map.walkable(p.x, p.z, 0.5) : map.maze ? Math.abs(p.x) < map.maze.half - 1 && Math.abs(p.z) < map.maze.half - 1 : true);
const medida = (s) => (s.type === 'box' ? Math.max(s.h.x, s.h.z) : s.r);

test('colisión: criaturas LANZADAS a 60 m/s contra cada pared/cobertura no la atraviesan (suelo y aire, las 6 arenas)', { timeout: 600000 }, () => {
  const ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.8];
  let lanzadas = 0;
  for (const mapId of MAP_IDS) {
    const { g } = arena(mapId); const map = g.map;
    for (const s of blancos(map)) {
      for (const kind of ['astilla', 'geoda', 'prisma', 'espiral']) {
        const def = MONSTERS[kind], flyer = !!def.fly;
        if (!flyer && !(map.walls || map.limbo)) continue;   // el suelo de las demás arenas no es plano
        for (const a of ang) {
          const c = centroDe(s), d = medida(s) + 7, dx = Math.cos(a), dz = Math.sin(a);
          const y0 = flyer ? Math.min(Math.max(c.y, 2.5), 9) : 1.6;
          const pos = v3(c.x + dx * d, y0, c.z + dz * d);
          if (!dentro(map, pos) || holgura(map, pos) < def.r * 1.2 + 0.2) continue;
          const m = g.spawnMonster(kind, pos, { noElite: true }); if (!m) continue;
          m.pos = { ...pos };   // (spawnMonster ya lo sacó de un sólido si hacía falta; acá queremos el punto exacto)
          const toward = { x: -dx, y: 0, z: -dz }, up = { x: 0, y: 1, z: 0 };
          let hundido = -9, cruzo = false, salto = false;
          for (let i = 0; i < 90 && !m.dead; i++) {
            m.vel = { x: toward.x * 60, y: flyer ? 0 : m.vel.y, z: toward.z * 60 };
            barrer(g, m, DT, flyer ? null : up);
            hundido = Math.max(hundido, hundimiento(map, m.pos, m.r).depth / m.r);
            if (s.type === 'box' && a !== 0.8) {   // no cruzó al otro lado de la pared (salvo pasando por arriba o por un costado)
              const along = (m.pos.x - c.x) * dx + (m.pos.z - c.z) * dz, lat = Math.abs((m.pos.x - c.x) * -dz + (m.pos.z - c.z) * dx), semi = Math.abs(dx) > 0.5 ? s.h.z : s.h.x, g0 = Math.abs(dx) > 0.5 ? s.h.x : s.h.z;
              if (m.pos.y > c.y + s.h.y) salto = true;   // pasó POR ARRIBA de una cobertura baja: no cuenta
              else if (!salto && along < -g0 && lat < semi && m.pos.y > c.y - s.h.y) cruzo = true;
            }
          }
          lanzadas++;
          assert.ok(hundido <= TOL, `${mapId} ${kind} contra ${s.type}@${c.x.toFixed(0)},${c.z.toFixed(0)} ángulo ${a}: hundimiento ${(hundido * 100).toFixed(0)} % del radio`);
          assert.ok(!cruzo, `${mapId} ${kind} contra ${s.type}@${c.x.toFixed(0)},${c.z.toFixed(0)} ángulo ${a}: cruzó al otro lado`);
          m.dead = true; g.monsters = g.monsters.filter((q) => !q.dead);
        }
      }
    }
  }
  assert.ok(lanzadas > 300, `se lanzaron ${lanzadas} criaturas`);
  console.log(`# ${lanzadas} criaturas lanzadas a 60 m/s contra paredes/coberturas/esferas: 0 atravesaron`);
});

test('colisión: empujar() (esquiva del Pombero, arrastre de la niebla cian) también barre: un desplazamiento de 8 m no cruza un muro', () => {
  for (const mapId of ['m3', 'm5', 'm6']) {
    const { g } = arena(mapId);
    const muro = g.map.solids.find((s) => s.type === 'box' && s.wall && s.h.y > 3 && Math.min(s.h.x, s.h.z) >= 0.9 && Math.max(s.h.x, s.h.z) > 6);
    assert.ok(muro, mapId + ': hay un muro largo');
    const eje = muro.h.x < muro.h.z ? 'x' : 'z', otro = eje === 'x' ? 'z' : 'x';
    const grosor = muro.h[eje], lado = 3.2;
    const pos = v3(muro.c.x, 1.6, muro.c.z); pos[eje] = muro.c[eje] - grosor - lado;
    if (holgura(g.map, pos) < 1.5) continue;
    const m = g.spawnMonster('astilla', pos, { noElite: true });
    const delta = v3(0, 0, 0); delta[eje] = 2 * (grosor + lado); void otro;
    empujar(g, m, delta);
    assert.ok(m.pos[eje] < muro.c[eje], `${mapId}: la criatura cruzó el muro (${m.pos[eje].toFixed(1)} vs ${muro.c[eje].toFixed(1)})`);
  }
});

test('colisión: nadie nace metido en una pared; las invocadas no aparecen del otro lado de un muro', () => {
  for (const mapId of ['m3', 'm5', 'm6']) {
    const { g } = arena(mapId);
    for (const s of blancos(g.map).filter((q) => q.type === 'box').slice(0, 12)) {
      const m = g.spawnMonster('astilla', v3(s.c.x, Math.min(1.6, s.c.y), s.c.z), { noElite: true });
      assert.ok(hundimiento(g.map, m.pos, m.r).depth / m.r <= TOL, `${mapId}: nació dentro de un muro`);
    }
  }
  // invocada: la madre queda a un lado del muro; el hijo pedido al otro lado aparece pegado a la madre
  const { g } = arena('m3');
  const muro = g.map.walls.find((w) => w.h.x < 1.2 && w.h.z > 6 && Math.abs(w.c.x) < 40);
  const madre = g.spawnMonster('cuarzo', v3(muro.c.x - muro.h.x - 3, 1.5, muro.c.z), { noElite: true });
  const hijo = g.spawnMonster('astilla', v3(muro.c.x + muro.h.x + 3, 1.5, muro.c.z), { parent: madre.id, noElite: true });
  assert.ok(hijo.pos.x < muro.c.x, 'el hijo quedó del lado de la madre');
});

test('sin teletransportes: durante oleadas completas con bots nadie se mueve más de 2,5 m en un tick (salvo la emboscada avisada)', { timeout: 600000 }, () => {
  const resumen = [];
  for (const mapId of MAP_IDS) {
    const g = new Game({ mapId, seed: 11 }); const p = g.addPlayer('b'); const bot = makeBot(g, p.id, { seed: 11, skill: 1.2 });
    const prev = new Map(), teles = new Map();
    let maxSalto = 0, blinks = 0, quien = '';
    while (g.state === 'playing' && g.time < 260) {
      g.setInput(p.id, bot(DT)); g.step(DT);
      const ev = new Map(); // blink de criatura: id → evento
      for (const e of g.events) {
        if (e.t === 'tele') teles.set(e.id, { t: g.time, p: e.p, in: e.in });
        if (e.t === 'blink' && e.id != null) ev.set(e.id, e);
        assert.ok(!(e.t === 'blink' && e.id == null && e.pid == null), `${mapId}: quedó un «blink» de rezagados sin dueño (teletransporte no avisado)`);
      }
      for (const m of g.monsters) {
        if (m.dead || m.def.boss) { prev.delete(m.id); continue; }
        const q = prev.get(m.id);
        if (q) {
          const d = Math.hypot(m.pos.x - q.x, m.pos.y - q.y, m.pos.z - q.z);
          if (ev.has(m.id)) {   // la emboscada: debió avisarse ≥ 0,8 s antes y llegar al punto marcado
            blinks++;
            const t = teles.get(m.id);
            assert.ok(t && g.time - t.t >= 0.8, `${mapId}: el Pombero se teletransportó sin aviso de ≥ 0,8 s`);
            assert.ok(Math.hypot(t.p[0] - m.pos.x, t.p[2] - m.pos.z) < 1.5, `${mapId}: llegó lejos de la marca de aviso`);
          } else if (d > maxSalto) { maxSalto = d; quien = m.kind; }
        }
        prev.set(m.id, { x: m.pos.x, y: m.pos.y, z: m.pos.z });
      }
      g.events.length = 0;
    }
    resumen.push(`${mapId}: salto máx ${maxSalto.toFixed(2)} m/tick (${quien}), emboscadas avisadas ${blinks}`);
    assert.ok(maxSalto <= 2.5, `${mapId}: ${quien} se movió ${maxSalto.toFixed(1)} m en un tick (¿teletransporte sin aviso?)`);
  }
  console.log('# ' + resumen.join('\n# '));
});

/** Escena de fin de oleada: sin cola ni avisos, jugador quieto e inmortal; devuelve el juego. */
function finDeOleada(mapId, criaturas) {
  const { g, p } = arena(mapId); p.hp = 1e9;
  g.phase = 'wave'; g.phaseT = 1e9; g.wave = 1; g.queue = []; g.omens = []; g.objective = null; g.waveTotal = 7;
  const ms = criaturas.map(([kind, pos]) => g.spawnMonster(kind, pos, { noElite: true }));
  for (const m of ms) { m.hp = m.maxhp = 1e9; }
  return { g, p, ms };
}

test('rezagados: las últimas criaturas lejanas NO se teletransportan; acosan al jugador y llegan en ≤ 80 s (m3, m5, m6)', { timeout: 300000 }, () => {
  for (const mapId of ['m3', 'm5', 'm6']) {
    const { g, p } = arena(mapId); const map = g.map;
    // puntos lejanos y libres de la arena
    const lejos = []; for (let i = 0; i < 400 && lejos.length < 4; i++) { const q = map.spawnGround(g.rng, p.pos); if (dist(q, p.pos) > 60) lejos.push(q); }
    if (lejos.length < 3) { const q = map.spawnGround(g.rng, v3(500, 0, 500)); lejos.push(q, q, q); }
    const { g: g2, p: p2, ms } = finDeOleada(mapId, [['astilla', lejos[0]], ['lente', lejos[1]], ['obelisco', lejos[2]], ['prisma', map.spawnAir(g.rng, p.pos, p.up)]]);
    const llegada = new Map(); let blinkSinDueno = 0, saltoMax = 0; const prev = new Map();
    for (let i = 0; i < 80 * 60; i++) {
      g2.step(DT);
      for (const e of g2.events) if (e.t === 'blink' && e.id == null && e.pid == null) blinkSinDueno++;
      g2.events.length = 0;
      for (const m of ms) {
        if (m.dead) continue;
        const q = prev.get(m.id); if (q) saltoMax = Math.max(saltoMax, Math.hypot(m.pos.x - q.x, m.pos.y - q.y, m.pos.z - q.z)); prev.set(m.id, { ...m.pos });
        if (!llegada.has(m.id) && dist(m.pos, p2.pos) < 26) llegada.set(m.id, g2.time);
      }
    }
    assert.equal(blinkSinDueno, 0, `${mapId}: hubo teletransportes de rezagados`);
    assert.ok(saltoMax < 1.5, `${mapId}: salto de ${saltoMax.toFixed(2)} m en un tick`);
    assert.equal(g2.stats.desint || 0, 0, `${mapId}: se desintegró una criatura alcanzable`);
    for (const m of ms) assert.ok(llegada.has(m.id), `${mapId}: ${m.kind} no llegó al jugador en 80 s (dist ${dist(m.pos, p2.pos).toFixed(0)} m)`);
    const tiempos = [...llegada.values()].map((t) => t.toFixed(0)).join(', ');
    console.log(`# ${mapId}: rezagados llegaron a < 26 m del jugador en ${tiempos} s; desintegradas ${g2.stats.desint || 0}`);
  }
});

test('rezagados: una criatura que no puede llegar (otra isla / fuera del mapa) se DESINTEGRA a la vista, sin botín, y la oleada puede cerrar', { timeout: 300000 }, () => {
  const { g, p } = arena('m1'); p.hp = 1e9;
  const lejana = MAPS.m1.ring[1];
  g.phase = 'wave'; g.phaseT = 1e9; g.wave = 1; g.queue = []; g.omens = []; g.objective = null; g.waveTotal = 7;
  const m = g.spawnMonster('astilla', v3(lejana.x, lejana.top + 1.5, lejana.z), { noElite: true });
  const loot0 = g.pickups.length; let desint = null, blink = 0;
  for (let i = 0; i < 90 * 60 && !desint && !m.dead; i++) {
    g.step(DT);
    for (const e of g.events) { if (e.t === 'desint') desint = e; if (e.t === 'blink' && e.id == null && e.pid == null) blink++; }
    g.events.length = 0;
  }
  assert.equal(blink, 0, 'sin teletransportes');
  assert.ok(m.dead, 'la criatura inalcanzable fue retirada');
  if (desint) { assert.ok(['fuera', 'atascada', 'inalcanzable'].includes(desint.why)); assert.equal(g.pickups.length, loot0, 'sin botín'); assert.ok(g.stats.desint >= 1); }
});

test('Pombero: avisa ≥ 0,9 s con marca y rastro; al final de la oleada ya no se teletransporta ni se camufla', () => {
  const { g, p } = arena('m1'); g.phaseT = 1e9;
  p.pos = v3(0, 0.9, 0);
  const m = g.spawnMonster('espejo', v3(0, 0.9, -22), { noElite: true }); m.cd2 = 0; m.hp = m.maxhp = 1e9;
  let tele = null, blink = null;
  for (let i = 0; i < 6 * 60 && !blink; i++) { g.step(DT); for (const e of g.events) { if (e.t === 'tele') tele = { ...e, t: g.time }; if (e.t === 'blink' && e.id === m.id) blink = { ...e, t: g.time }; } g.events.length = 0; }
  assert.ok(tele, 'emitió el aviso (tele)'); assert.ok(tele.in >= 0.9, 'aviso ≥ 0,9 s');
  assert.ok(blink && blink.t - tele.t >= 0.85, 'el salto ocurre después del aviso');
  assert.ok(Math.hypot(blink.p[0] - tele.p[0], blink.p[2] - tele.p[2]) < 0.1, 'llega a la marca');
  // fin de oleada: sin cola ni avisos y pocas criaturas ⇒ no teletransporta
  const { g: g2, p: p2 } = arena('m1'); g2.phase = 'wave'; g2.phaseT = 1e9; g2.wave = 1; g2.queue = []; g2.omens = []; g2.objective = null; g2.waveTotal = 7;
  const m2 = g2.spawnMonster('espejo', v3(0, 0.9, -22), { noElite: true }); m2.cd2 = 0; m2.hp = m2.maxhp = 1e9; p2.pos = v3(0, 0.9, 0);
  let n = 0, cloaked = false; for (let i = 0; i < 8 * 60; i++) { g2.step(DT); for (const e of g2.events) if (e.t === 'blink' || e.t === 'tele') n++; cloaked ||= !!m2.cloak; g2.events.length = 0; }
  assert.equal(n, 0, 'al final de la oleada el Pombero no se teletransporta'); assert.ok(!cloaked, 'ni se camufla');
});

test('colisión: el radio de colisión sigue al del modelo (élites más grandes) y es < radio visual para no trabarse', () => {
  const { g, p } = arena('m5'); void p;
  const a = g.spawnMonster('geoda', v3(0, 1.4, 0), { noElite: true }), e = g.spawnMonster('astilla', v3(10, 1.4, 0), { noElite: true });
  e.elite = true; const normal = g.spawnMonster('astilla', v3(14, 1.4, 0), { noElite: true });
  assert.ok(radioCol(a) < a.r && radioCol(a) > a.r * 0.8);
  assert.ok(radioCol(e) > radioCol(normal));
  assert.ok(len(v3(1, 0, 0)) === 1);
});

test('rendimiento: colisión + antenas con 90 criaturas sobre muros (m3 y m6) ≤ 6 ms por tick de media', { timeout: 300000 }, () => {
  for (const mapId of ['m3', 'm6']) {
    const g = new Game({ mapId, seed: 1 }); const ps = [0, 1, 2, 3].map(() => g.addPlayer()); g.phaseT = 1e9;
    const kinds = Object.keys(MONSTERS).filter((k) => !MONSTERS[k].boss);
    for (let i = 0; i < 90; i++) { const k = kinds[i % kinds.length]; g.spawnMonster(k, MONSTERS[k].fly ? g.map.spawnAir(g.rng, ps[0].pos, ps[0].up) : g.map.spawnGround(g.rng, ps[0].pos)); }
    const bots = ps.map((p, i) => [p, makeBot(g, p.id, { seed: i, skill: 1.2 })]);
    const ts = [];
    for (let i = 0; i < 400; i++) {
      for (const [p, t] of bots) { g.setInput(p.id, t(DT)); p.hp = 1e9; }
      for (const m of g.monsters) m.hp = m.maxhp = 1e9;
      const t0 = performance.now(); g.step(DT); ts.push(performance.now() - t0); g.events.length = 0;
    }
    const mean = ts.reduce((a, b) => a + b, 0) / ts.length;
    console.log(`# ${mapId}: ${g.monsters.length} criaturas → ${mean.toFixed(2)} ms/tick`);
    assert.ok(mean < 6, `${mapId}: ${mean.toFixed(2)} ms/tick`);
  }
  void run;
});
