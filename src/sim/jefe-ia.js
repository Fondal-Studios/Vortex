// IA ADAPTATIVA DE LOS JEFES (docs/JEFES.md → «Algoritmo de la IA»).
// El jefe MIDE cómo jugás (ventana deslizante de 20 s + memoria larga que sobrevive a los cambios de fase), te CLASIFICA
// (melé cercano / tirador a distancia / habilidades / esquivador / mixto) con histéresis, y ELIGE una postura que lo contrarresta.
// Todo es determinista y sin DOM: NO usa g.rng. Usa su PROPIO generador derivado de la semilla (ia.rs, un entero que viaja con el estado).
// El estado vive en el jefe (m.ia) y se resume en el snapshot compacto con iaSnap().
//
// Límites para que nunca sea injusto: la resistencia por adaptación no pasa de IA.topeRes (+25 %), llega despacio (rampa), tiene una
// ventana de gracia entre cambios, nunca hay inmunidad (piso IA.pisoMul) y si cambiás de MODO el jefe tarda IA.rezago en readaptar.
import { len, sub, madd, norm } from './math.js';
import { PLAYER } from './data.js';
import { blocked } from './physics.js';
import { IA, POSTURAS, CONTRA } from './jefe-data.js';

const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const NB = 20;                    // cubetas de 1 s = ventana
const NF = 16;                    // campos por cubeta
// campos: 0 melé, 1 disparo, 2 habilidad (daño a TODO), 3 daño al jefe, 4 daño a adds, 5 curación, 6 suma distancia, 7 muestras,
//         8 suma velocidad, 9 muestras tras cobertura, 10 intención melé, 11 intención disparo, 12 intención habilidad, 13 aciertos de disparo,
//         14 cuadros disparando, 15 esquivas (dash/salto)
const F = { MEL: 0, GUN: 1, SKL: 2, BOSS: 3, ADD: 4, HEAL: 5, DIST: 6, N: 7, SPD: 8, COV: 9, IMEL: 10, IGUN: 11, ISKL: 12, GHIT: 13, GFIRE: 14, DODGE: 15 };

/** Generador propio (mulberry32 con el estado en un entero: se serializa con el jefe). */
export function iaRand(ia) {
  ia.rs = (ia.rs + 0x6d2b79f5) >>> 0;
  let t = ia.rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const nuevoJugador = () => ({ b: Array.from({ length: NB }, () => new Array(NF).fill(0)), mem: new Array(NF).fill(0), mode: '', hp: -1, estilo: 'mixed', conf: 0, ult: 0 });

/** Crea el estado de IA del jefe. `mem` (opcional): memoria de intentos anteriores (iaMemoria) para empezar con una pista suave. */
export function iaInit(g, m, mem = null) {
  m.ia = {
    rs: (((g.seed | 0) ^ 0x7ef1a5) * 2654435761) >>> 0,
    t: 0, sec: 0, acc: 0, tEval: 0, pl: {},
    st: 'neutro', lvl: 0, cur: 'mixed', conf: 0, cand: 'mixed', candT: 0, ult: -99,   // estilo del equipo, candidato y último cambio de postura
    lag: 0, desc: 0, cambios: 0, avisos: [],
    prior: mem && mem.s && CONTRA[mem.s] ? mem.s : null,                               // intento anterior: el jefe «recuerda» (pista suave)
    sh: [0, 0, 0], enr: 0, enrOn: false,
  };
  if (m.ia.prior) m.ia.priorT = 0;
  return m.ia;
}

const jug = (ia, id) => (ia.pl[id] ||= nuevoJugador());
function cubeta(ia, pl) { return pl.b[ia.sec % NB]; }
function sumar(pl, campos) { const v = new Array(NF).fill(0); for (const b of pl.b) for (let i = 0; i < NF; i++) v[i] += b[i]; return campos ? v : v; }

/** Anota un golpe del jugador `by` a la criatura `victim` (de cualquier tipo) con daño `dealt` ya multiplicado. Lo llama game.damageMonster. */
export function iaGolpe(g, boss, by, victim, dealt) {
  const ia = boss.ia; if (!ia || !by || !by.input || dealt <= 0) return;
  const src = g.dmgSrc || (by.inMelee ? 'melee' : 'gun'), pl = jug(ia, by.id), b = cubeta(ia, pl);
  const k = src === 'melee' ? F.MEL : src === 'skill' ? F.SKL : F.GUN;
  b[k] += dealt; pl.mem[k] += dealt;
  const kk = victim === boss ? F.BOSS : F.ADD; b[kk] += dealt; pl.mem[kk] += dealt;
  if (k === F.GUN) { b[F.GHIT]++; pl.mem[F.GHIT]++; }
  if (victim !== boss) return;
  // efectos de la postura sobre quien golpea al jefe (docs/JEFES.md → «Posturas»)
  if (ia.st === 'antimele' && src === 'melee' && ia.lvl > 0.3 && g.time >= (pl.espCd || 0) && !by.dead) {
    pl.espCd = g.time + 0.6; g.hurtPlayer(by, Math.min(7, 2 + dealt * 0.04) * ia.lvl);   // espinas: te devuelve un poco (tope 7 por golpe)
  }
  if (ia.st === 'antihab' && src === 'skill' && ia.lvl > 0.3) boss.hp = Math.min(boss.maxhp, boss.hp + dealt * 0.07 * ia.lvl);   // absorción
}

/** Multiplicador del daño que recibe el jefe POR LA ADAPTACIÓN (nunca baja del piso; el tope de resistencia es IA.topeRes). */
export function iaMult(g, boss, src) {
  const ia = boss.ia; if (!ia) return 1;
  let mul = 1; const P = POSTURAS[ia.st];
  if (P && P.contra && P.contra === src) mul /= 1 + IA.topeRes * ia.lvl;
  if (ia.desc > 0) mul *= IA.descon;
  return Math.max(IA.pisoMul, mul);
}

/* ───────── medición ───────── */
function muestrear(g, boss, dt) {
  const ia = boss.ia;
  for (const p of g.players) {
    const pl = jug(ia, p.id), b = cubeta(ia, pl), inp = p.input;
    if (p.dead) { pl.hp = -1; continue; }
    const d = Math.hypot(p.pos.x - boss.pos.x, p.pos.z - boss.pos.z), v = len(p.vel);
    const add = (i, x) => { b[i] += x; pl.mem[i] += x; };
    add(F.DIST, Math.min(60, d)); add(F.N, 1); add(F.SPD, Math.min(v, 30));
    if (p.mode === 'combo') { if (inp.a1 || inp.a2) add(F.IMEL, 1); } else if (inp.melee) add(F.IMEL, 1);
    if (inp.fire && p.mode !== 'combo') { add(F.IGUN, 1); add(F.GFIRE, 1); }
    if (inp.mov || inp.esp || inp.s3 || inp.hab || inp.ult) add(F.ISKL, 1);
    if (inp.dash || (inp.jump && !pl.salto)) add(F.DODGE, 1);
    pl.salto = !!inp.jump;
    if (g.map.walls && ((ia.t * 4) | 0) % 2 === 0) { // cobertura: ¿hay un muro entre el jugador y el jefe? (1 rayo cada 0,5 s)
      const dd = sub(boss.pos, p.pos), l = len(dd); let cub = 0;
      if (l > 4) { const n = norm(dd); for (let t = 2; t < l - 4; t += 2) if (blocked(g.map, madd(p.pos, n, t))) { cub = 1; break; } }
      add(F.COV, cub * 2);
    }
    const tot = p.hp + p.shield; if (pl.hp >= 0 && tot > pl.hp + 6) add(F.HEAL, tot - pl.hp); pl.hp = tot;
    // cambio de MODO (Disparo ↔ Melé): el jefe se desconcierta y tarda en readaptar
    if (pl.mode && pl.mode !== p.mode && ia.st !== 'neutro' && ia.t > IA.primera) {
      ia.lag = IA.rezago; ia.desc = Math.min(IA.rezago, 8); ia.avisos.push('desc'); g.emit({ t: 'jia', k: 'desc', id: boss.id });
      for (const bb of pl.b) for (let i = 0; i < 3; i++) bb[i] *= 0.4;   // olvida rápido el estilo anterior (la memoria larga queda)
    }
    pl.mode = p.mode;
  }
}

/** Puntajes de estilo a partir de un vector de medidas. */
function puntajes(v, tFight) {
  const dm = v[F.MEL], dg = v[F.GUN], ds = v[F.SKL], tot = dm + dg + ds, n = Math.max(1, v[F.N]);
  const im = v[F.IMEL], ig = v[F.IGUN], is = v[F.ISKL], it = im + ig + is;
  const wd = clamp(tot / (IA.actividadMin * 2), 0, 1);
  const sh = (a, ta, i, ti) => wd * (tot > 0 ? a / tot : 0) + (1 - wd) * (ti > 0 ? i / ti : 0);
  const sm = sh(dm, tot, im, it), sg = sh(dg, tot, ig, it), ss = sh(ds, tot, is, it);
  const dMed = v[F.DIST] / n, cerca = clamp(1 - (dMed - 5) / 22, 0, 1), mov = clamp(v[F.SPD] / n / PLAYER.speed, 0, 1.4), cob = clamp(v[F.COV] / n, 0, 1);
  const activo = clamp(it / (n * 0.6), 0, 1);                     // fracción de muestras con intención de atacar
  const pas = clamp(1 - tot / IA.actividadMin, 0, 1) * (1 - 0.8 * activo) * clamp((tFight - 8) / 8, 0, 1) * (0.5 + 0.3 * Math.min(1, mov) + 0.2 * cob);
  return { melee: sm * (0.55 + 0.45 * cerca), shooter: sg * (0.55 + 0.45 * (1 - cerca)), skills: ss, passive: pas, dMed: r2(dMed), cerca: r2(cerca), tot };
}
function mejor(p) {
  const arr = [['melee', p.melee], ['shooter', p.shooter], ['skills', p.skills], ['passive', p.passive]].sort((a, b) => b[1] - a[1]);
  const [e, s] = arr[0], seg = arr[1][1];
  if (s < IA.confMin || s - seg < 0.12) return { e: 'mixed', conf: s };
  return { e, conf: s };
}
/** Clasifica un vector (ventana o memoria) y mezcla ambos. */
function clasificar(ia, vWin, vMem) {
  const a = puntajes(vWin, ia.t), c = puntajes(vMem, ia.t), w = IA.mezclaMemoria;
  const mix = { melee: a.melee * (1 - w) + c.melee * w, shooter: a.shooter * (1 - w) + c.shooter * w, skills: a.skills * (1 - w) + c.skills * w, passive: a.passive * (1 - w) + c.passive * w, dMed: a.dMed, cerca: a.cerca, tot: a.tot };
  return { ...mejor(mix), pt: mix };
}

/** Un paso de la IA. Devuelve nada; deja en ia.st/ia.lvl la postura vigente. */
export function iaTick(g, boss, dt) {
  const ia = boss.ia; if (!ia) return;
  ia.t += dt; ia.acc += dt;
  if (ia.lag > 0) ia.lag = Math.max(0, ia.lag - dt);
  if (ia.desc > 0) ia.desc = Math.max(0, ia.desc - dt);
  // decaimiento de la memoria larga
  const dec = Math.exp(-dt / IA.memoria);
  for (const id in ia.pl) { const m = ia.pl[id].mem; for (let i = 0; i < NF; i++) m[i] *= dec; }
  const sec = Math.floor(ia.t);
  if (sec !== ia.sec) { ia.sec = sec; for (const id in ia.pl) ia.pl[id].b[sec % NB].fill(0); }
  // enfurecimiento por tiempo
  const T = IA.enrageT + IA.enrageCoop * (g.players.length - 1);
  if (ia.t > T) { ia.enr = clamp((ia.t - T) / IA.enrageRampa, 0, 1); if (!ia.enrOn) { ia.enrOn = true; g.emit({ t: 'jia', k: 'enr', id: boss.id }); } }
  // rampa de la postura
  if (ia.lag > 0) ia.lvl = Math.max(0, ia.lvl - dt * 0.08); else if (ia.st !== 'neutro') ia.lvl = Math.min(ia.cambios === 0 && ia.pistaMax ? ia.pistaMax : 1, ia.lvl + dt / IA.rampa);
  if (ia.acc < IA.muestra) return;
  const step = ia.acc; ia.acc = 0;
  muestrear(g, boss, step);
  if (ia.t - ia.tEval < 1) return;   // la clasificación se hace una vez por segundo
  ia.tEval = ia.t;
  evaluar(g, boss);
}

function evaluar(g, boss) {
  const ia = boss.ia, tot = new Array(NF).fill(0), mem = new Array(NF).fill(0);
  let peso = 0, mejorJ = null;
  for (const p of g.players) {
    const pl = ia.pl[p.id]; if (!pl) continue;
    const v = sumar(pl);
    const c = clasificar(ia, v, pl.mem); pl.estilo = c.e; pl.conf = r2(c.conf);
    const w = 1 + v[F.MEL] + v[F.GUN] + v[F.SKL];
    for (let i = 0; i < NF; i++) { tot[i] += v[i]; mem[i] += pl.mem[i]; }
    peso += w; if (!mejorJ || w > mejorJ.w) mejorJ = { w, id: p.id };
  }
  if (!peso) return;
  const eq = clasificar(ia, tot, mem);
  ia.conf = r2(eq.conf);
  const dmg = tot[F.MEL] + tot[F.GUN] + tot[F.SKL] || 1;
  ia.sh = [Math.round(100 * tot[F.MEL] / dmg), Math.round(100 * tot[F.GUN] / dmg), Math.round(100 * tot[F.SKL] / dmg)];
  // histéresis: el estilo del equipo sólo cambia si el rival gana por margen durante `persiste` segundos
  if (eq.e === ia.cur) ia.candT = 0;
  else if (eq.e === ia.cand) ia.candT += 1;
  else { ia.cand = eq.e; ia.candT = 1; }
  if (ia.cur === 'mixed' && ia.cand === eq.e && eq.e !== 'mixed' && ia.candT >= IA.persiste) { ia.cur = eq.e; ia.candT = 0; }
  else if (eq.e !== 'mixed' && ia.cand === eq.e && eq.e !== ia.cur && ia.candT >= IA.persiste && eq.conf >= (eq.pt[ia.cur] ?? 0) + IA.histeresis) { ia.cur = eq.e; ia.candT = 0; }
  else if (eq.e === 'mixed' && ia.cur !== 'mixed' && ia.cand === 'mixed' && ia.candT >= IA.persiste * 3) { ia.cur = 'mixed'; ia.candT = 0; }
  decidirPostura(g, boss, false);
}

/** Elige la postura para el estilo actual. `fase`: cambio de fase (puede adaptar antes de que termine la gracia). */
function decidirPostura(g, boss, fase) {
  const ia = boss.ia;
  if (ia.lag > 0 || ia.t < IA.primera) return;
  const want = CONTRA[ia.cur] || 'neutro';
  if (want === ia.st) return;
  const libre = g.time - ia.ult >= (fase ? IA.gracia * 0.5 : IA.gracia);
  if (!libre && ia.st !== 'neutro') return;
  ia.st = want; ia.lvl = 0; ia.ult = g.time; ia.cambios++;
  g.emit({ t: 'jia', k: 'adapt', st: want, id: boss.id, n: ia.cambios });
}

/** Cambio de fase del jefe: la IA vuelve a evaluar (adaptación «cada fase»). */
export function iaFase(g, boss) {
  const ia = boss.ia; if (!ia) return;
  evaluar(g, boss);
  decidirPostura(g, boss, true);
}

/** Memoria compacta del intento (para el siguiente: «adaptación entre intentos suaves»). */
export function iaMemoria(boss) {
  const ia = boss && boss.ia; if (!ia) return null;
  return { s: ia.cur, c: ia.conf, n: ia.cambios };
}
/** El jefe entra recordando el intento anterior: antes de medir nada, usa una postura suave (nunca más del 40 % de fuerza) hasta tener datos propios. */
export function iaPista(g, boss) {
  const ia = boss.ia; if (!ia || !ia.prior) return;
  ia.cur = ia.prior; ia.st = CONTRA[ia.prior] || 'neutro'; ia.lvl = 0; ia.ult = g.time; ia.pistaMax = 0.4;
  if (ia.st !== 'neutro') g.emit({ t: 'jia', k: 'recuerda', st: ia.st, id: boss.id });
}

/** Estilo de un jugador (para elegir víctimas de los contraataques). */
export function iaEstilo(boss, id) { const pl = boss.ia && boss.ia.pl[id]; return pl ? pl.estilo : 'mixed'; }
/** Distancia media (m) del jugador al jefe en la ventana. */
export function iaDistMedia(boss, id) { const pl = boss.ia && boss.ia.pl[id]; if (!pl) return 0; const v = sumar(pl); return v[F.DIST] / Math.max(1, v[F.N]); }

/** Resumen COMPACTO para el snapshot (lo que dibuja el HUD). */
export function iaSnap(boss) {
  const ia = boss.ia; if (!ia) return null;
  return { st: ia.st, lv: r2(ia.lvl), es: ia.cur, cf: ia.conf, sh: ia.sh, lg: r2(ia.lag), ds: r2(ia.desc), en: r2(ia.enr), n: ia.cambios };
}
/** Estado completo exportable (pruebas de determinismo y de ida y vuelta). */
export function iaExport(boss) { return boss && boss.ia ? JSON.parse(JSON.stringify(boss.ia)) : null; }
export { F as IA_CAMPOS };
