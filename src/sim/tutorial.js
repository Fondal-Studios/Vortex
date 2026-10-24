// TUTORIAL JUGABLE de «Islas — Despertar» (Sprint 1 · docs/ONBOARDING.md). Lógica PURA y determinista (sin navegador, sin azar propio).
// Se engancha en Game con `new Game({ …, tutorial: true })`: mientras dura, NO empiezan las oleadas (el combate real viene después) y
// cada paso se completa sólo cuando la simulación VE que el jugador hizo la acción (distancia recorrida, salto, daño al blanco, habilidad usada…).
//   Game.step() → tickTutorial(g, dt) · Game.snapshot() → g.tutorial.snap() (campo `tut`) · el cliente (src/client/tutorial-ui.js) dibuja panel y marcadores.
// Pasos (≈ 3 min para una persona): mover · mirar · saltar · ataque básico · apuntar/disparar o combo · primera habilidad · esquivar · usar un objeto · curarse.
// La 2.ª habilidad y la definitiva NO se enseñan acá: se desbloquean por oleada (VORTEX_MISSION_CONTROLS.md) y se explican con su aviso didáctico en el momento.
import { v3, dist } from './math.js';

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];

export const DUMMY_HP = 400;          // vida del blanco de práctica (inmóvil, no ataca)
export const DUMMY_GOAL = 0.4;        // el paso «destruilo» se cumple cuando le queda esta fracción de vida
export const ANDAR_METROS = 8;        // distancia a recorrer en «Caminar»
export const GIRO_RAD = 1.6;          // giro acumulado de cámara en «Mirar» (≈ 90°)
export const SALTOS = 2;
export const CURA_DESDE = 55;         // el simulador te «lesiona» hasta esta vida para poder practicar la cura
export const ZONA = { r: 4.2, total: 3.2, reintento: 1.2 };
export const MIN_PASO = 1.5;          // un paso nunca se completa antes de este tiempo (se alcanza a leer)
export const PAUSA_OK = 1.1;          // «¡Bien!» antes de pasar al siguiente
/** Blancos del tutorial en la arena de Islas (isla central: radio 26, suelo en y = 0). */
export const ANCLAS_M1 = Object.freeze({ blanco: [2, 1.4, -14], terminal: [14, 0.9, 6], botiquin: [-12, 0.9, 6] });

/** Los pasos y sus textos (español). `pc` / `touch` según el dispositivo; `combo` cuando el texto cambia en modo Melé. */
export const PASOS = Object.freeze([
  { id: 'mover', titulo: 'Caminar', meta: `Recorré ${ANDAR_METROS} metros`, pc: 'Caminá con W A S D (o las flechas).', touch: 'Mové la palanca de la izquierda para caminar.' },
  { id: 'mirar', titulo: 'Mirar', meta: 'Girá la cámara', pc: 'Mové el mouse para girar la cámara.', touch: 'Deslizá el dedo por la derecha de la pantalla para girar la cámara.' },
  { id: 'saltar', titulo: 'Saltar', meta: `Saltá ${SALTOS} veces`, pc: 'Apretá ESPACIO para saltar.', touch: 'Tocá el botón SALTO.' },
  { id: 'atacar', titulo: 'Ataque básico', meta: 'Herí al blanco', pc: 'Mirá al blanco marcado y atacá con el clic izquierdo.', touch: 'Mirá al blanco marcado y tocá ATAQUE.',
    pcCombo: 'Acercate al blanco marcado y golpealo con el clic izquierdo.', touchCombo: 'Acercate al blanco marcado y tocá ATAQUE para golpear.' },
  { id: 'rematar', titulo: 'Apuntar y disparar', tituloCombo: 'Encadenar golpes', meta: 'Destruí el blanco', pc: 'Apuntá con el mouse y mantené el clic izquierdo hasta destruirlo.', touch: 'Apuntá deslizando el dedo derecho y mantené ATAQUE hasta destruirlo.',
    pcCombo: 'Seguí tocando el clic izquierdo: los golpes se encadenan en un combo.', touchCombo: 'Seguí tocando ATAQUE: los golpes se encadenan en un combo.' },
  { id: 'habilidad', titulo: 'Tu primera habilidad', meta: 'Usá la movilidad de tu Huésped', pc: 'Apretá F (o mantené ESPACIO): es tu habilidad de movilidad y defensa.', touch: 'Mantené apretado el botón SALTO: activa la habilidad de movilidad de tu Huésped.' },
  { id: 'esquivar', titulo: 'Esquivar', meta: 'Salí del círculo antes de que estalle', pc: 'Salí del círculo rojo caminando, saltando o con tu habilidad (F).', touch: 'Salí del círculo rojo con la palanca, el salto o tu habilidad.' },
  { id: 'usar', titulo: 'Usar un objeto', meta: 'Activá el terminal', pc: 'Acercate al terminal marcado y apretá E.', touch: 'Acercate al terminal marcado y tocá USAR (reemplaza al botón PODER).' },
  { id: 'curar', titulo: 'Curarte', meta: 'Recogé el botiquín', pc: 'Tu vida bajó. Caminá hasta el botiquín verde para recuperarla.', touch: 'Tu vida bajó. Caminá hasta el botiquín verde para recuperarla.' },
]);
/** Texto de un paso para este modo (`combo` = Melé) y dispositivo (`touch`). */
export function textoPaso(paso, combo, touch) {
  const P = typeof paso === 'number' ? PASOS[paso] : paso; if (!P) return { titulo: '', meta: '', texto: '' };
  return { titulo: (combo && P.tituloCombo) || P.titulo, meta: P.meta, texto: touch ? (combo && P.touchCombo) || P.touch : (combo && P.pcCombo) || P.pc };
}
export const RESUMEN_FINAL = 'Tutorial completo. Tu segunda habilidad se activa al superar la primera oleada y la definitiva, tras la tercera: el juego te avisa en cuanto estén listas. El combate real empieza ahora.';

/** Crea el tutorial de una partida (lo guarda Game en `g.tutorial`). `desde` = paso por el que retomar (0 = el principio). */
export function crearTutorial(g, { desde = 0 } = {}) {
  const T = {
    i: Math.max(0, Math.min(PASOS.length - 1, desde | 0)), t: 0, ok: false, okT: 0, fin: false, saltado: false, hecho: false,
    prog: 0, dummyId: 0, zona: null, fallos: 0, ent: {}, pasosHechos: 0, tiempo: 0,
    snap() { return snapTutorial(T, g); },
    saltar() { terminar(g, T, true); },
  };
  return T;
}

const jugador = (g) => g.players.find((p) => !p.dead) || g.players[0] || null;
const anclas = (g, p) => {
  if (g.mapId === 'm1') return { blanco: v3(...ANCLAS_M1.blanco), terminal: v3(...ANCLAS_M1.terminal), botiquin: v3(...ANCLAS_M1.botiquin) };
  const o = g.map.playerSpawn(0), at = (dx, dz) => v3(o.x + dx, o.y, o.z + dz);   // otros mapas: puntos cercanos al punto de partida
  return { blanco: at(0, -12), terminal: at(10, 0), botiquin: at(-10, 0) };
};
const dummy = (g, T) => g.monsters.find((m) => m.id === T.dummyId && !m.dead) || null;
const horiz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const modoCombo = (p) => p && p.mode === 'combo';

function crearBlanco(g, T) {
  const A = anclas(g), prev = dummy(g, T); if (prev) return prev;
  const m = g.spawnMonster('geoda', A.blanco, { noElite: true });
  if (m) { m.passive = true; m.open = true; m.hp = m.maxhp = DUMMY_HP; m.tut = true; T.dummyId = m.id; }
  return m;
}
function quitarBlanco(g, T, conAnimacion) {
  for (const m of g.monsters) if (m.tut && !m.dead) { m.dead = true; if (conAnimacion) g.emit({ t: 'kill', id: m.id, k: m.kind, p: a3(m.pos) }); }
  T.dummyId = 0;
}

/** Prepara lo que necesita cada paso al empezar (blancos, círculo, botiquín…). */
function iniciarPaso(g, T, p) {
  const id = PASOS[T.i].id; T.t = 0; T.ok = false; T.okT = 0; T.prog = 0; T.ent = {};
  const A = anclas(g);
  if (id === 'mover') T.ent = { x: p.pos.x, z: p.pos.z, d: 0 };
  else if (id === 'mirar') T.ent = { h: { ...p.heading }, a: 0 };
  else if (id === 'saltar') T.ent = { n: 0, suelo: !!p.grounded };
  else if (id === 'atacar' || id === 'rematar') crearBlanco(g, T);
  else if (id === 'habilidad') { p.movCd = 0; T.ent = { prev: 0 }; }
  else if (id === 'esquivar') T.zona = { p: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, r: ZONA.r, t: 0, total: ZONA.total, espera: 0 };
  else if (id === 'usar') T.ent = { pos: A.terminal };
  else if (id === 'curar') { p.hp = Math.min(p.hp, CURA_DESDE); T.ent = { desde: p.hp, pos: A.botiquin }; g.dropPickup('hp', A.botiquin); }
  g.emit({ t: 'tutpaso', n: T.i, id });
}

function terminar(g, T, saltado) {
  if (T.fin) return;
  T.fin = true; T.saltado = !!saltado; T.hecho = true; T.zona = null;
  quitarBlanco(g, T, false);
  g.pickups = g.pickups.filter((k) => !k.tut);
  for (const p of g.players) { if (p.dead) g.revive && g.revive(p); p.hp = Math.max(p.hp, 100); p.shield = Math.max(p.shield, 100); p.movCd = 0; }
  g.tutorialT = g.time;                                   // lo que duró no cuenta para el límite de la misión (game.js)
  g.phase = 'intermission'; g.phaseT = Math.max(g.phaseT, 5);   // el combate real arranca a los 5 s
  g.emit({ t: 'tutfin', saltado: !!saltado, pasos: T.i + (T.ok ? 1 : 0) });
}

/** Un paso de simulación del tutorial: observa al jugador y avanza si hizo la acción. Llamado por Game.step() después de mover a los jugadores. */
export function tickTutorial(g, dt) {
  const T = g.tutorial; if (!T || T.fin) return;
  const p = jugador(g); if (!p) return;
  T.tiempo += dt;
  if (T.t === 0 && !T.ent.iniciado) { T.ent.iniciado = true; iniciarPaso(g, T, p); }
  T.t += dt;
  const id = PASOS[T.i].id, I = p.input;
  // mantener vivo lo que el tutorial puso en el mundo (los botiquines del suelo caducan a los 40 s)
  for (const k of g.pickups) if (k.type === 'hp' && !k.dead && T.ent.pos && dist(k.pos, T.ent.pos) < 3) { k.tut = true; k.life = Math.max(k.life, 30); }
  if (T.ok) {   // «¡Bien!» y pasa al siguiente
    T.okT += dt;
    if (T.okT >= PAUSA_OK) {
      if (T.i >= PASOS.length - 1) return terminar(g, T, false);
      T.i++; T.pasosHechos = T.i; T.ent = {}; T.t = 0; T.zona = id === 'esquivar' ? null : T.zona; iniciarPaso(g, T, p); T.ent.iniciado = true;
    }
    return;
  }
  let listo = false;
  switch (id) {
    case 'mover': { const E = T.ent; E.d += horiz({ x: E.x, z: E.z }, p.pos); E.x = p.pos.x; E.z = p.pos.z; T.prog = Math.min(1, E.d / ANDAR_METROS); listo = E.d >= ANDAR_METROS; break; }
    case 'mirar': {
      const E = T.ent, h = p.heading, c = Math.max(-1, Math.min(1, h.x * E.h.x + h.y * E.h.y + h.z * E.h.z));
      E.a += Math.acos(c); E.h = { x: h.x, y: h.y, z: h.z }; T.prog = Math.min(1, E.a / GIRO_RAD); listo = E.a >= GIRO_RAD; break;
    }
    case 'saltar': {
      const E = T.ent; if (E.suelo && !p.grounded && I.jump) E.n++; E.suelo = !!p.grounded; T.prog = Math.min(1, E.n / SALTOS); listo = E.n >= SALTOS; break;
    }
    case 'atacar': {
      const m = dummy(g, T) || crearBlanco(g, T); if (!m) break;
      const daño = Math.max(0, 1 - m.hp / m.maxhp); T.prog = Math.min(1, daño / 0.15); listo = daño >= 0.15; break;
    }
    case 'rematar': {
      const m = dummy(g, T) || crearBlanco(g, T); if (!m) break;
      const meta = 1 - DUMMY_GOAL, daño = Math.max(0, 1 - m.hp / m.maxhp); T.prog = Math.min(1, daño / meta);
      if (daño >= meta) { quitarBlanco(g, T, true); listo = true; }
      break;
    }
    case 'habilidad': { const E = T.ent; listo = p.movCd > 0.3 && E.prev <= 0.3; E.prev = p.movCd; T.prog = listo ? 1 : 0; break; }
    case 'esquivar': {
      const Z = T.zona; if (!Z) break;
      if (Z.espera > 0) { Z.espera -= dt; if (Z.espera <= 0) { Z.p = { x: p.pos.x, y: p.pos.y, z: p.pos.z }; Z.t = 0; Z.r = T.fallos >= 2 ? ZONA.r * 0.8 : ZONA.r; } break; }
      Z.t += dt; T.prog = Math.min(0.95, Z.t / Z.total);
      if (Z.t >= Z.total) {
        const fuera = horiz(p.pos, Z.p) > Z.r + 0.4;
        g.emit({ t: 'tutonda', p: a3(Z.p), r: Z.r, ok: fuera });
        if (fuera) { listo = true; T.prog = 1; T.zona = null; } else { T.fallos++; Z.espera = ZONA.reintento; Z.t = 0; }
      }
      break;
    }
    case 'usar': { const E = T.ent; T.cerca = horiz(p.pos, E.pos) < 3.4; listo = T.cerca && !!p.interactEdge; T.prog = T.cerca ? 0.5 : 0; if (listo) T.prog = 1; break; }
    case 'curar': { const E = T.ent; T.prog = Math.max(0, Math.min(1, (p.hp - E.desde) / (100 - E.desde))); listo = p.hp >= Math.min(100, E.desde + 30); break; }
  }
  if (listo && T.t >= MIN_PASO) { T.ok = true; T.okT = 0; T.prog = 1; g.emit({ t: 'tutok', n: T.i, id }); }
}

/** Lo que ve el cliente (snapshot). Siempre datos simples (números y arreglos). */
export function snapTutorial(T, g) {
  const id = PASOS[T.i] ? PASOS[T.i].id : '', m = g ? dummy(g, T) : null, A = g ? anclas(g) : null;
  let marca = null, mp = null;
  if (!T.fin) {
    if ((id === 'atacar' || id === 'rematar') && m) { marca = 'blanco'; mp = a3(m.pos); }
    else if (id === 'usar' && A) { marca = 'terminal'; mp = a3(A.terminal); }
    else if (id === 'curar' && A) { marca = 'botiquin'; mp = a3(A.botiquin); }
  }
  return {
    i: T.i, n: PASOS.length, id, ok: T.ok, fin: T.fin, saltado: T.saltado, prog: r2(T.prog), t: r2(T.t), total: r2(T.tiempo),
    marca, mp, vida: m ? r2(m.hp / m.maxhp) : null,
    zona: T.zona ? { p: a3(T.zona.p), r: T.zona.r, k: r2(Math.min(1, T.zona.t / T.zona.total)), espera: T.zona.espera > 0 } : null,
    usar: !!(T.cerca && id === 'usar' && !T.ok),
  };
}
