// MEDICIÓN (solo lectura sobre el juego): partidas completas de campaña SIN navegador, 60 Hz, con la operación real
// (new Game({campaign:true})) y un bot por estilo. Uso:
//   node tools/audit/medicion-capitulos.mjs <capitulo|all> <estilo|all> <semillas "1,2,3"> [salida.jsonl]
// Escribe una línea JSON por partida. No modifica código del juego ni el perfil real (localStorage simulado en memoria).
import fs from 'node:fs';
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const { Game } = await import('../../src/sim/game.js');
const { CAMPAIGN_ORDER, CAMPAIGN_BOSSES } = await import('../../src/sim/campaign.js');
const { makeBot, taskFor, routeTo } = await import('../../src/sim/bot.js');
const { botEstilo, CHAR_DE, STYLE_DE } = await import('../jefe-bots.js');
const { v3, add, sub, mul, dot, cross, len, dist, norm, project } = await import('../../src/sim/math.js');
let Perfil = null; try { Perfil = await import('../../src/client/perfil.js'); } catch (e) { console.error('(perfil.js no carga: se omiten las recompensas) ' + e.message.split('\n')[0]); }   // la medición de duración/victorias no depende del perfil

const [capArg = 'all', estArg = 'all', seedArg = '1,2,3', out = null] = process.argv.slice(2);
const MAX_S = +process.env.MAX_S || 1500;   // tope de reloj de simulación (25 min) para declarar "no concluye"
const caps = capArg === 'all' ? CAMPAIGN_ORDER : capArg.split(',');
const estilos = estArg === 'all' ? ['shooter', 'melee', 'skills'] : estArg.split(',');   // 'idle' = AFK (sólo si se pide)
const seeds = seedArg.split(',').map(Number);

function estiloBot(g, pid, estilo, seed) {
  if (estilo === 'idle') return () => ({});   // jugador AFK: no hace nada
  const be = botEstilo(g, pid, estilo, { seed }), base = makeBot(g, pid, { seed: seed + 100, skill: 1.2 });
  return (dt) => {
    const p = g.players.find((q) => q.id === pid);
    if (!p || p.dead) return be(dt);
    if (g.monsters.some((m) => !m.dead && m.def.boss) || estilo === 'shooter') return sup(be(dt));   // con jefe: lógica oficial de tools/jefe-bots.js
    const i = base(dt), mons = g.monsters.filter((m) => !m.dead);
    let near = null, nd = Infinity; for (const m of mons) { const d = dist(m.pos, p.pos); if (d < nd) { nd = d; near = m; } }
    let cultivo = false;
    if (estilo === 'melee' && g.objective && g.objective.type === 'cultivo' && g.objective.state === 'active') {   // Cultivo: hay que golpear/tirar a los capullos; un bot melé los ataca cuerpo a cuerpo
      let cb = null, cd = Infinity; for (const id of g.objective.ids) { const c = g.objects.find((x) => x.id === id); if (c && c.type === 'capullo' && !c.on) { const d = dist(c.pos, p.pos); if (d < cd) { cd = d; cb = c; } } }
      if (cb && (cd < nd + 4 || !near)) { near = { pos: cb.pos, r: cb.r || 2 }; nd = cd; cultivo = true; }
    }
    if (estilo === 'skills') {
      i.mode = 'shooter';
      if (near && nd < 28) { i.esp = p.espCd <= 0; i.s3 = p.s3Cd <= 0; i.ult = (p.ul || 0) >= 100; i.fire = i.fire && p.espCd > 0 && p.s3Cd > 0; }
      return sup(i);
    }
    // melee sin jefe: acercarse al bicho más cercano y pegar A1/A2 (misma idea que melee() de tools/jefe-bots.js)
    i.mode = 'combo'; i.fire = false;
    const task = taskFor(g, p);
    // Con el núcleo en brazos no se puede atacar: un jugador real corre al altar. (Antes el bot melé se acercaba a pegar, no pegaba, y moría.)
    if (near && !(task && task.carry) && (cultivo || !(task && nd > 7))) {
      const eye = g.eyePos(p), to = norm(sub(near.pos, eye)), tan = norm(project(to, p.up), p.heading);
      const yawErr = Math.atan2(dot(cross(p.heading, tan), p.up), dot(p.heading, tan));
      const pitchErr = Math.asin(Math.max(-1, Math.min(1, dot(to, p.up)))) - p.pitch, mt = 7 * 1.2 * dt;
      i.dyaw = -Math.max(-mt, Math.min(mt, yawErr)); i.dpitch = Math.max(-mt, Math.min(mt, pitchErr));
      const reach = 3.2 + near.r * 0.55;
      if (nd > reach) { const gp = routeTo(g, p, near.pos), w = norm(project(sub(gp, p.pos), p.up), p.heading); i.mz = dot(w, p.heading); i.mx = dot(w, cross(p.heading, p.up)); }
      else { i.mz = 0; i.mx = Math.sin(g.time * 1.3); }
      const t = g.tick % 14; i.a1 = nd < reach + 1.2 && Math.abs(yawErr) < 0.5 && t < 7; i.a2 = nd < reach + 1.2 && Math.abs(yawErr) < 0.5 && t >= 7;
      if (p.habCd !== undefined && p.habCd <= 0 && nd < reach + 1.2) i.hab = true;
    }
    return sup(i);
  };
}
// El cliente real manda `support` junto con esp/s3 (gateSkills en src/shared/skill-path.js lo exige cuando la campaña usa skillLevel); los bots de tools/ no lo mandan.
const sup = (i) => { i.support = !!(i.esp || i.s3); return i; };

function jugar(cap, estilo, seed) {
  const idx = CAMPAIGN_ORDER.indexOf(cap);
  const g = new Game({ mapId: cap, seed, campaign: true, magazines: true, calm: 4, skillLevel: idx === 0 ? 0 : 2 });   // m1: perfil nuevo (habilidades se desbloquean jugando); resto: progresión previa
  const p = g.addPlayer('Conciencia', null, { char: CHAR_DE[estilo] || 'axioma', style: STYLE_DE[estilo] || 'disparo', mode: estilo === 'melee' ? 'combo' : 'shooter', kit: 0 });
  const bot = estiloBot(g, p.id, estilo, seed), dt = 1 / 60;
  const tl = []; let sig = '', lastChange = 0, maxStall = 0, minHp = 1e9, waveStart = {}, objRes = [], t0 = performance.now();
  while (g.state === 'playing' && g.time < MAX_S) {
    g.setInput(p.id, bot(dt)); g.step(dt);
    for (const e of g.events) {
      if (e.t === 'wave') { tl.push(['wave', e.n, +g.time.toFixed(1)]); waveStart[e.n] = +g.time.toFixed(1); }
      else if (e.t === 'objective') { tl.push(['obj', e.ph, e.kind, +g.time.toFixed(1)]); objRes.push(e.ph + ':' + e.kind); }
      else if (e.t === 'clear') tl.push(['clear', e.wave, +g.time.toFixed(1)]);
    }
    g.events.length = 0;
    if (process.env.DEBUG_HP && g.tick % 300 === 0 && g.time > +process.env.DEBUG_HP) console.log('  t', g.time.toFixed(0), 'w', g.wave, g.phase, 'hp', Math.round(p.hp + p.shield), 'mons', g.monsters.length, 'carry', p.carry, 'obj', g.objective && g.objective.type, g.objective && Math.round(g.objective.prog * 100), 'dead', p.dead);
    if (process.env.DEBUG_JEFE && g.tick % 1800 === 0) { const b = g.monsters.find((m) => m.def.boss); if (b) console.log('  jefe', g.time.toFixed(0), 'hp', Math.round(b.hp), b.ia && b.ia.st, 'enr', b.ia && b.ia.enr, 'p', Math.round(p.hp + p.shield), 'sk', g.skillLevel, 'ul', p.ul | 0, 'mons', g.monsters.length, 'dist', Math.round(Math.hypot(b.pos.x - p.pos.x, b.pos.z - p.pos.z)), 'by', Math.round(b.pos.y), 'py', Math.round(p.pos.y)); }
    const o = g.objective, s = [g.wave, g.phase, g.queue.length, g.monsters.length, o ? Math.round(o.prog * 50) + (o.stage || 0) : -1, g.monsters.filter((m) => m.def.boss).map((m) => Math.round(m.hp / 50)).join()].join('|');
    if (s !== sig) { sig = s; lastChange = g.time; } maxStall = Math.max(maxStall, g.time - lastChange);
    minHp = Math.min(minHp, p.hp + p.shield);
    if (!Number.isFinite(p.pos.x)) throw new Error('NaN');
  }
  const won = g.state === 'won', timedOut = g.state === 'playing';
  const snap = g.snapshot(), me = snap.players[0];
  // --- recompensas al cerrar, con el código real de perfil.js (mismo flujo que main.js: bankProfile → cerrarPartida; completarCapitulo sólo si gana)
  let premio = null;
  if (Perfil) {
    store.clear(); Perfil.recargar();
    const antes = { cores: Perfil.perfil().cores, xp: (Perfil.perfil().mae[(CHAR_DE[estilo] || 'axioma')] || { xp: 0 }).xp };
    const mae = Perfil.cerrarPartida(CHAR_DE[estilo] || 'axioma', me, { wave: snap.wave, won });
    if (won) Perfil.completarCapitulo(cap);
    const pf = Perfil.perfil();
    premio = { xpGanada: mae ? mae.ganada : null, coresPerfil: pf.cores - antes.cores, xpPerfil: (pf.mae[(CHAR_DE[estilo] || 'axioma')] || { xp: 0 }).xp - antes.xp, campaignCompleted: pf.campaign.completed.slice(), skillLevelPerfil: pf.skillLevel || 0, terrLiberado: Object.keys(pf.terr) };
  }
  return {
    cap, estilo, seed, state: g.state, timedOut, simSeconds: +g.time.toFixed(1), simMin: +(g.time / 60).toFixed(2), wave: g.wave, waveTotal: g.waveTotal,
    boss: !!CAMPAIGN_BOSSES[cap], failure: g.operationFailure || null, objetivos: objRes, tl, kills: g.stats.kills, simCores: p.cores, minHp: Math.round(minHp), maxStall: +maxStall.toFixed(1),
    cpuMs: Math.round(performance.now() - t0), premio,
  };
}
const sink = out ? fs.createWriteStream(out, { flags: 'a' }) : null;
for (const cap of caps) for (const estilo of estilos) for (const seed of seeds) {
  const r = jugar(cap, estilo, seed); const line = JSON.stringify(r);
  if (sink) sink.write(line + '\n'); console.log(`${cap} ${estilo} s${seed} → ${r.state} ${r.simMin}min etapa ${r.wave}/${r.waveTotal} cpu ${r.cpuMs}ms ${r.failure || ''}`);
}
if (sink) sink.end();
