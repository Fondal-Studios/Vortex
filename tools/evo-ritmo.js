// RITMO DE EVOLUCIÓN Y COMPOSICIÓN DE TARJETAS medidos con bots (docs/EVOLUCION.md → «Medición»).
// Juega la campaña completa de un mapa con un bot de un estilo (melé / disparo / habilidades), evoluciona en cuanto puede
// (la política más rápida posible: es el TECHO de un jugador atento) y anota en qué oleada y segundo llega a cada nivel,
// cuántos núcleos entran y qué tarjetas se ofrecen en cada respiro.
//   node tools/evo-ritmo.js                  → tabla de los 3 estilos × 8 Huéspedes en el mapa 1
//   node tools/evo-ritmo.js tarjetas         → sólo la composición de tarjetas
import { Game } from '../src/sim/game.js';
import { makeBot } from '../src/sim/bot.js';
import { HOST_IDS } from '../src/sim/data.js';
import * as D from '../src/sim/data.js';
import { dist } from '../src/sim/math.js';
import { rangoDeXp, xpPartida } from '../src/sim/maestria.js';

import { claseDe as claseNueva, esRelevante, estiloDe } from '../src/sim/tarjetas.js';
/** Clase de una tarjeta ({w,k,...}): 'disparo' | 'melee' | 'habilidad' | 'huesped' | 'organo'. Con el código VIEJO (sin tarjetas.js) todo era disparo u órgano. */
export const claseDe = (c) => claseNueva(c);

/** ¿Alcanza para evolucionar ahora? (núcleos y, si existe, el requisito de rango). */
function puedeEvolucionar(p) { return p.evo < 4 && p.cores >= D.EVO_COST[p.evo + 1] && (!D.EVO_RANK_REQ || (p.mastery || 1) >= D.EVO_RANK_REQ[p.evo + 1]); }

/**
 * Una campaña de bot. Opciones: mapId, seed, char, estilo ('melee'|'disparo'|'habilidad'), skill, mastery (rango del Huésped al empezar),
 * evo0/path0 (nivel previo), cores0, politica ('rapida' evoluciona en cuanto puede | 'nunca'), maxSeconds.
 * Devuelve { state, wave, time, tiers: [{tier, wave, t, path}], cores (total ganado), ofertas: [{wave, clases:{...}}], g }.
 */
export function campana({ mapId = 'm1', seed = 1, char = 'axioma', estilo = 'disparo', skill = 1.2, mastery = 1, evo0 = 0, path0 = [], cores0 = 0, politica = 'rapida', maxSeconds = 1500, pick = 'primera', dt = 1 / 60 } = {}) {
  const g = new Game({ mapId, seed });
  const p = g.addPlayer('bot', null, { char, style: estilo, evo: evo0, path: path0, cores: cores0, maestria: mastery });
  const think = makeBot(g, p.id, { seed, skill });
  const R = { tiers: [], ofertas: [], coresTotal: 0, dmgSrc: { melee: 0, gun: 0, skill: 0 } };
  let lastCores = p.cores, lastWave = -1, tickN = 0;
  while (g.state === 'playing' && g.time < maxSeconds) {
    const inp = think(dt);
    const alive = g.monsters.filter((m) => !m.dead);
    let near = null, nd = 1e9; for (const m of alive) { const d = dist(m.pos, p.pos); if (d < nd) { nd = d; near = m; } }
    tickN++;
    if (estilo === 'melee' && near) { inp.fire = false; if (nd > 3 + near.r) inp.mz = 1; if (nd < 4 + near.r) inp.melee = tickN % 20 < 8; }
    if (estilo === 'habilidad') { inp.fire = tickN % 3 === 0; inp.esp = tickN % 30 < 3; inp.s3 = tickN % 30 >= 10 && tickN % 30 < 13; inp.mov = nd < 8 && tickN % 40 < 3; inp.ult = tickN % 50 < 3; }
    if (pick === 'estilo' && p.cards && p.cards.length) { const i = p.cards.findIndex((c) => esRelevante(c, estiloDe(p))); inp.pick = i >= 0 ? i : 0; }
    if (politica === 'rapida' && !p.dead && puedeEvolucionar(p) && tickN % 2 === 0) inp.evo = 1 + (estilo === 'melee' ? 0 : (p.evo % 2 ? 1 : 0)); else inp.evo = 0;
    g.setInput(p.id, inp);
    if (g.wave !== lastWave && g.phase === 'intermission' && p.cards.length) { lastWave = g.wave; const cl = {}; for (const c of p.cards) { const k = claseDe(c); cl[k] = (cl[k] || 0) + 1; } R.ofertas.push({ wave: g.wave, n: p.cards.length, clases: cl, tipos: p.cards.map((c) => c.k), rel: p.cards.filter((c) => esRelevante(c, estiloDe(p))).length }); }
    const evo0t = p.evo;
    g.step(dt);
    if (p.evo > evo0t) R.tiers.push({ tier: p.evo, wave: g.wave, t: +g.time.toFixed(0), path: p.path[p.path.length - 1] });
    if (p.cores > lastCores) R.coresTotal += p.cores - lastCores; lastCores = p.cores;
    for (const k of Object.keys(R.dmgSrc)) R.dmgSrc[k] = g.stats && g.stats[k] || R.dmgSrc[k];
    g.events.length = 0;
  }
  return { state: g.state, wave: g.wave, time: +g.time.toFixed(0), tiers: R.tiers, cores: Math.round(R.coresTotal), ofertas: R.ofertas, evo: p.evo, hp: Math.round(p.hp), g };
}

/**
 * Varias partidas SEGUIDAS con el mismo Huésped, modelando el perfil (src/client/perfil.js): el rango sale de la XP acumulada (maestria.js), los núcleos que sobran se guardan,
 * entre partidas se gasta en el menú (mismas reglas que Perfil.evolucionar: núcleos Y rango) y el nivel/caminos se conservan. Devuelve una fila por partida.
 */
export function partidasEncadenadas({ n = 3, mapId = 'm1', seed = 3, char = 'axioma', estilo = 'disparo', skill = 1.2 } = {}) {
  let xp = 0, cores = 0, evo = 0, path = []; const filas = [];
  for (let i = 0; i < n; i++) {
    const rango = rangoDeXp(xp), antes = evo;
    // en el menú, antes de entrar: gasta lo ahorrado (la misma regla que perfil.evolucionar)
    while (evo < 4 && cores >= D.EVO_COST[evo + 1] && rango >= D.EVO_RANK_REQ[evo + 1]) { cores -= D.EVO_COST[evo + 1]; path.push(D.evoPathsFor(char)[evo + 1][0].id); evo++; }
    const enMenu = evo;
    const r = campana({ mapId, seed: seed + i, char, estilo, skill, mastery: rango, evo0: evo, path0: path, cores0: 0 });
    const p = r.g.players[0];
    cores += Math.floor(p.cores); evo = Math.max(evo, p.evo); path = p.path.slice();
    xp += xpPartida({ kills: r.g.stats.kills, wave: r.wave, won: r.state === 'won' });
    filas.push({ partida: i + 1, rango, nivelAlEntrar: enMenu, nivelAlSalir: evo, ganoNivel: evo - antes, estado: r.state, nucleosGuardados: cores, xp });
  }
  return filas;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv[2] === 'encadenadas') { for (const estilo of ['melee', 'disparo', 'habilidad']) { console.log(estilo); console.table(partidasEncadenadas({ n: +process.env.N || 4, estilo, char: process.env.CHAR || 'axioma' })); } process.exit(0); }
  const solo = process.argv[2] === 'tarjetas';
  const mastery = +process.env.RANGO || 1;
  const chars = process.env.CHARS ? process.env.CHARS.split(',') : HOST_IDS;
  const filas = [];
  for (const estilo of ['melee', 'disparo', 'habilidad']) for (const char of chars) {
    const r = campana({ mapId: process.env.MAPA || 'm1', seed: +process.env.SEED || 3, char, estilo, mastery, pick: process.env.PICK || 'estilo' });
    const tot = {}; let rel = 0, nn = 0, minRel = 9; for (const o of r.ofertas) { rel += o.rel; nn += o.n; minRel = Math.min(minRel, o.rel); for (const [k, n] of Object.entries(o.clases)) tot[k] = (tot[k] || 0) + n; }
    filas.push({ estilo, char, estado: r.state, oleada: r.wave, seg: r.time, nucleos: r.cores, evoFinal: r.evo, niveles: r.tiers.map((t) => `n${t.tier}@o${t.wave}/${t.t}s`).join(' '), tarjetas: JSON.stringify(tot), relev: nn ? Math.round(100 * rel / nn) + '%' : '-', minRel });
  }
  if (solo) console.table(filas.map((f) => ({ estilo: f.estilo, char: f.char, tarjetas: f.tarjetas, relev: f.relev, minRel: f.minRel })));
  else console.table(filas);
}
