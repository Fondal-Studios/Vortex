import { Game } from '../sim/game.js';
import { makeBot } from '../sim/bot.js';
import { WEAPONS, MONSTERS, ROLES, FRAGMENTS, CHARACTERS, UPGRADE_KINDS, WEAPON_MODS, WEAPON_MUTS } from '../sim/data.js';
import { Equipo } from './equipo.js';
import { settings, setSetting, sensFromSlider, sliderFromSens } from './settings.js';
import { WEAPON_COLORS } from './shotfx.js';
import { createCombatHud } from './hud-combat.js';
import { createHuespedHud } from './hud-huesped.js';
import { createEvoHud, EVO_KEY } from './hud-evolucion.js';
import { createEvoChoice } from './evo-choice.js';
import { createRadar } from './radar.js';
import { createEvoMenu } from './evo-menu.js';
import { ESSENCE_OF, WEAPON_ORGANS, CHAMP_ORGANS, LINEAGE } from '../sim/data.js';
import * as Perfil from './perfil.js';
import { createCaida } from './caida.js';
import { MAPS } from '../sim/maps.js';
import { blocked } from '../sim/physics.js';
import { rotAround, norm, project, v3, cross, dot, sub, len } from '../sim/math.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { NetClient } from './net.js';
import { LEVELS, initialQuality, saveQuality, AutoQuality, isTouchDevice, isIOS } from './quality.js';
import { TouchControls } from './touch.js';
import * as Story from './story.js';
import { uTime } from './shaders.js';
import { MenuUI, showLoading, trophy } from './ui.js';
import { Pad } from './gamepad.js';
import * as THREE from 'three';
import { startPrologue } from './prologo.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SIM_DT = 1 / 60;
const CAP = !!params.get('cap'); // captura de video determinista: el tiempo lo maneja tools/make-video.js
let capT = 0; const timers = [];
/** setTimeout que respeta el reloj virtual de la captura. */
const later = (fn, ms) => { if (CAP) timers.push({ at: capT * 1000 + ms, fn }); else setTimeout(fn, ms); };

/* ───────── calidad, dispositivo y controles ───────── */
let level = initialQuality(params);
const canvas = $('c');
const renderer = new Renderer(canvas, { level, pixelRatio: params.get('pr') ? +params.get('pr') : null });
const sound = new Sound();
if (renderer.hostfx) renderer.hostfx.setSound(sound); // hostfx.js reproduce los sonidos de habilidades y melee de los Huéspedes
if (CAP) { // no suena nada en vivo: se registra cada sonido con su tiempo virtual para sintetizar la banda sonora
  window.__evlog = []; for (const m of ['ui', 'chirp', 'train', 'heartbeat', 'shot', 'boom', 'hit', 'voice', 'hurt', 'pickup', 'gravity', 'portal', 'wave', 'ability', 'objective', 'ping', 'ray', 'purge', 'stagger', 'down', 'init', 'resume', 'startMusic', 'setListener']) sound[m] = (...a) => { if (m !== 'init' && m !== 'resume' && m !== 'setListener' && m !== 'startMusic') window.__evlog.push({ t: window.__capT || 0, m, a: JSON.parse(JSON.stringify(a)) }); };
}
const subs = new Story.Subtitles($('sub'), sound);
const ctrlPref = params.get('input') || (() => { try { return localStorage.getItem('cristal.ctrl.v1') || 'auto'; } catch { return 'auto'; } })();
const useTouch = () => { const p = $('ctrlsel').value; return p === 'touch' || (p === 'auto' && isTouchDevice()); };
for (const sel of [$('qsel'), $('qsel2')]) { sel.innerHTML = Object.entries(LEVELS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join(''); sel.value = level; }
$('ctrlsel').value = ctrlPref;
const myChar = () => Equipo.char;
function setQuality(l, { save = true } = {}) { if (!LEVELS[l] || l === level) return; level = l; $('qsel').value = $('qsel2').value = l; if (save) saveQuality(l); renderer.applyQuality(l); }
$('qsel').addEventListener('change', (e) => setQuality(e.target.value)); $('qsel2').addEventListener('change', (e) => setQuality(e.target.value));
$('ctrlsel').addEventListener('change', () => { try { localStorage.setItem('cristal.ctrl.v1', $('ctrlsel').value); } catch { /* ok */ } });
const auto = new AutoQuality((l) => { setQuality(l, { save: false }); banner(`Rendimiento bajo: gráficos en «${LEVELS[l].label}»`, 2500); });
if (params.get('autoq') === '0') auto.enabled = false;

/* ───────── entrada de teclado/ratón ───────── */
const keys = new Set();
// iPhone: sin zoom por pellizco ni doble toque, sin menú de selección (importante al anclar a la pantalla de inicio)
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
let lastTap = 0; document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTap < 350) e.preventDefault(); lastTap = n; }, { passive: false });
const mouse = { dx: 0, dy: 0, fire: false, ping: false, esp: false, ads: false }; let pickReq = -1;
const NOLOCK = params.get('nolock') === '1';
let wantWeapon = -1, locked = NOLOCK, session = null, last = performance.now(), mouseSens = 0.0022;
addEventListener('keydown', (e) => {
  if (typeof ui !== 'undefined' && !session && ui.handleKey(e)) return;
  keys.add(e.code);
  if (e.code >= 'Digit1' && e.code <= 'Digit5') { const n = +e.code.slice(5) - 1; if (cardsOpen && n < 3) pickReq = n; else wantWeapon = n; }
  if (e.code === 'Space') e.preventDefault();
  if ((e.code === 'Enter' || e.code === 'Escape') && session && session.intro) skipIntro();
  if (session && session.practice && session.game && !e.repeat) {
    const g = session.game, p = g.players[0];
    if (e.code === 'KeyH') { const ids = Object.keys(CHARACTERS), i = (ids.indexOf(p.char) + 1) % ids.length; g.setLoadout(p.id, ids[i], p.slots); }
    if (e.code === 'Comma' || e.code === 'Period') { const d = e.code === 'Period' ? 1 : -1, slot = Math.max(1, p.slots.indexOf(p.weapon)), n = WEAPONS.length; let w = p.weapon; do { w = (w + d + n) % n; } while (w < 1 || p.slots.includes(w)); g.setSlotWeapon(p.id, slot, w); }
  }
  if (e.code === 'KeyP' && session && !session.intro) { renderer.setThird(!renderer.third); setSetting('third', renderer.third); const b = $('camtoggle'); if (b) b.querySelector('b').textContent = `Cámara: ${renderer.third ? 'tercera persona (te ves)' : 'primera persona'}`; } // cámara en tercera persona (V ahora es melee)
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('mousedown', (e) => { if (e.button === 1) { mouse.ping = true; e.preventDefault(); } if (e.button === 0) mouse.fire = true; if (e.button === 2) { mouse.esp = true; e.preventDefault(); } if (session && session.intro) skipIntro(); });
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.fire = false; if (e.button === 1) mouse.ping = false; if (e.button === 2) mouse.esp = false; });
addEventListener('contextmenu', (e) => { if (session) e.preventDefault(); });
let cardsOpen = false;
addEventListener('wheel', (e) => { if (session) wantWeapon = (((session.mySlot || 0) + (e.deltaY > 0 ? 1 : -1)) % 5 + 5) % 5; });
addEventListener('mousemove', (e) => { if (locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
document.addEventListener('pointerlockchange', () => {
  if (NOLOCK) return; locked = document.pointerLockElement === canvas;
  if (session && !session.ended && !session.touch) $('pause').classList.toggle('hidden', locked || session.headless || !!session.intro);
});
const lockPointer = () => { try { canvas.requestPointerLock(); } catch { /* sin pointer lock */ } };

const touch = new TouchControls($('touch'), {
  onPause: () => pauseTouch(true),
  onWeapon: (d) => { const w = (((session ? session.mySlot || 0 : 0) + d) % 5 + 5) % 5; return w; },
});
let tapSkip = 0;
$('touch').addEventListener('pointerdown', () => { if (session && session.intro) skipIntro(); }, true);
addEventListener('touchstart', () => { sound.init(); sound.resume(); }, { passive: true });

/* ───────── ayuda de puntería (todas las entradas: ratón, táctil y mando) ───────── */
const AIM_KEY = 'cristal.aim.v1'; let aimLevel = isTouchDevice() ? 2 : 1; try { const v = parseInt(localStorage.getItem(AIM_KEY), 10); if (v >= 0 && v <= 3) aimLevel = v; } catch { /* ok */ }
const aimSel = $('aimsel'); if (aimSel) { aimSel.value = String(aimLevel); aimSel.addEventListener('change', () => { aimLevel = +aimSel.value; try { localStorage.setItem(AIM_KEY, String(aimLevel)); } catch { /* ok */ } }); }
let evoChoice = null, evoPrevWant = false;
/** Al apretar EVOLUCIONAR (botón, tecla o aviso) se abre la elección de camino; la sim recibe 1 o 2 recién cuando elegís. */
function evoWant(on) {
  if (on && !evoPrevWant && session && session.lastMe) {
    const me = session.lastMe;
    if (!evoChoice) evoChoice = createEvoChoice(document.body, { onOpen: () => { if (session && session.mode === 'solo') { session.evoPaused = true; session.paused = true; } touch.reset(); }, onClose: () => { if (session && session.evoPaused) { session.evoPaused = false; session.paused = false; } } });
    if (me && !evoChoice.open) evoChoice.show(me);
  }
  evoPrevWant = !!on;
}
let combatHud = null, huespedHud = null, caida = null, evoHud = null, evoMenu = null, organReq = null, organReqT = 0;
const organInput = () => { if (organReq && performance.now() - organReqT > 400) organReq = null; return organReq; }; // input.organ se mantiene 0,4 s (la simulación cobra una sola vez)
const motionSel = $('motionsel'); if (motionSel) { try { motionSel.value = localStorage.getItem('cristal.reduceMotion') === '1' ? '1' : '0'; } catch { /* ok */ } motionSel.addEventListener('change', () => { try { localStorage.setItem('cristal.reduceMotion', motionSel.value); } catch { /* ok */ } }); }
/** Datos de la cámara para la simulación (en 3ª persona el disparo converge a la retícula). */
function camInput() { return renderer.third ? { third: true, side: settings().camSide || 1, dist: settings().camDist || 3.6 } : false; }
function readInput() {
  if (session && session.touch) { const ti = touch.read(); ti.cam = camInput(); ti.style = settings().style; evoWant(ti.evo || (evoHud && evoHud.held())); ti.evo = evoChoice ? evoChoice.value() : 0; ti.organ = organInput(); if (pickReq >= 0) { ti.pick = pickReq; pickReq = -1; } return ti; } // (las tarjetas de mejora también se eligen tocando)
  const zm = renderer.zoomKind || 0, adsM = keys.has('KeyX') || mouse.ads ? (zm === 2 ? settings().scopeMul : settings().adsMul) : 1, SENS = mouseSens * adsM;
  const i = {
    cam: camInput(), style: settings().style,
    mx: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), mz: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    dyaw: mouse.dx * SENS, dpitch: -mouse.dy * SENS, jump: keys.has('Space'), fire: mouse.fire, ability: keys.has('KeyQ'), mov: keys.has('KeyF'), ads: keys.has('KeyX') || mouse.ads, crouch: keys.has('KeyC') || keys.has('ControlLeft'), esp: mouse.esp || keys.has('KeyG'), s3: keys.has('KeyZ'), ult: keys.has('KeyT'), reload: keys.has('KeyR'), melee: keys.has('KeyV'), evo: (evoWant(keys.has(EVO_KEY.code) || !!(evoHud && evoHud.held())), evoChoice ? evoChoice.value() : 0), organ: organInput(), pick: pickReq, interact: keys.has('KeyE'), ping: keys.has('KeyB') || mouse.ping, dash: keys.has('ShiftLeft') || keys.has('ShiftRight'), weapon: wantWeapon,
  };
  mouse.dx = mouse.dy = 0; wantWeapon = -1; pickReq = -1;
  const g = pad.read(padDt); // mando (DualSense / Xbox)
  if (g) {
    i.mx = Math.max(-1, Math.min(1, i.mx + g.mx)); i.mz = Math.max(-1, Math.min(1, i.mz + g.mz)); i.dyaw += g.dyaw * (g.ads ? (zm === 2 ? settings().scopeMul : settings().adsMul) : 1); i.dpitch += g.dpitch * (g.ads ? (zm === 2 ? settings().scopeMul : settings().adsMul) : 1); i.ads = i.ads || g.ads;
    i.fire = i.fire || g.fire; i.jump = i.jump || g.jump; i.dash = i.dash || g.dash; i.ability = i.ability || g.ability; i.mov = i.mov || g.mov; i.esp = i.esp || g.esp; i.s3 = i.s3 || g.s3; i.ult = i.ult || g.ult; i.reload = i.reload || g.reload; i.melee = i.melee || g.melee; i.interact = i.interact || g.interact; i.ping = i.ping || g.ping;
    if (g.next && !padLatch.next) i.weapon = (((session ? session.mySlot || 0 : 0) + 1) % 5 + 5) % 5; if (g.prev && !padLatch.prev) i.weapon = (((session ? session.mySlot || 0 : 0) - 1) % 5 + 5) % 5;
    if (cardsOpen) { if (g.next && !padLatch.next) pickReq = 1; if (g.prev && !padLatch.prev) pickReq = 0; if (g.jump && !padLatch.jump) pickReq = 2; if (pickReq >= 0) i.pick = pickReq; }
    padLatch.next = g.next; padLatch.prev = g.prev; padLatch.jump = g.jump;
    if (g.pause && !padLatch.pause && session && !session.touch) { document.exitPointerLock && document.exitPointerLock(); }
    padLatch.pause = g.pause; renderer.firing = renderer.firing || g.fire;
  }
  return i;
}
const padLatch = { next: false, prev: false, pause: false, jump: false }; let padDt = 0.016;

/** Ayuda de puntería: (1) fricción: la mira se vuelve más lenta sobre un blanco; (2) imán: empuja suave hacia la criatura más cercana al centro. Nivel 0 = apagada, 1 baja, 2 media, 3 alta. Marca `session.onTarget` para el color de la mira. */
function assistAim(inp, state, me, dt, firing = false) {
  session.onTarget = false; if (!me || me.dead) return;
  const up = v3(...me.up), h = v3(...me.h), eye = { x: me.pos[0] + up.x * 0.6, y: me.pos[1] + up.y * 0.6, z: me.pos[2] + up.z * 0.6 };
  const cp = Math.cos(me.pitch), aim = { x: h.x * cp + up.x * Math.sin(me.pitch), y: h.y * cp + up.y * Math.sin(me.pitch), z: h.z * cp + up.z * Math.sin(me.pitch) };
  const map = MAPS[state.map], walls = map && map.walls;
  let best = null, bd = 1, bestOn = false;
  for (const m of state.monsters) {
    if (m.c) continue; const mp = { x: m.p[0], y: m.p[1], z: m.p[2] }, to = norm(sub(mp, eye)), ang = Math.acos(Math.max(-1, Math.min(1, dot(to, aim)))), dd = Math.hypot(mp.x - eye.x, mp.y - eye.y, mp.z - eye.z);
    const size = Math.atan2((m.r || 1) * 1.1, Math.max(1, dd)); // radio angular del blanco
    if (ang < size) bestOn = true;
    const score = ang / Math.max(0.02, size * 2.2 + 0.04); if (score < bd) { bd = score; best = { to, ang, size, mp }; }
  }
  session.onTarget = bestOn;
  if (!best || aimEff() === 0) return;
  if (walls) { const o = { x: eye.x, y: eye.y, z: eye.z }; for (let t = 1.5; t < Math.hypot(best.mp.x - eye.x, best.mp.y - eye.y, best.mp.z - eye.z); t += 1.5) if (blocked(map, { x: o.x + best.to.x * t, y: o.y + best.to.y * t, z: o.z + best.to.z * t })) return; }
  const lv = [0, 0.5, 1, 1.6][aimEff()], cone = 0.12 + 0.05 * lv;
  if (best.ang > cone) return;
  const tan = norm(project(best.to, up), h), yawErr = Math.atan2(dot(cross(h, tan), up), dot(h, tan)), pitchErr = Math.asin(Math.max(-1, Math.min(1, dot(best.to, up)))) - me.pitch;
  const near = Math.max(0, 1 - best.ang / cone), fric = 1 - Math.min(0.7, 0.28 * lv * near * 1.6); // fricción
  inp.dyaw *= fric; inp.dpitch *= fric;
  const k = (firing ? 5.5 : 2.4) * lv * dt * near; inp.dyaw += -yawErr * k; inp.dpitch += pitchErr * k; // imán
}

/** MODO SIMPLE (para quien nunca jugó un shooter): si hay un enemigo bajo la mira, dispara solo; si lo tenés encima, golpea solo. El jugador sólo mueve y mira. */
function simpleAssist(inp, state, me) {
  if (!settings().simple || !me || me.dead || session.paused) return;
  const h = v3(...me.h), st = settings().style || 'disparo'; let close = false;
  for (const m of state.monsters) { const d = { x: m.p[0] - me.pos[0], y: m.p[1] - me.pos[1], z: m.p[2] - me.pos[2] }, l = Math.hypot(d.x, d.y, d.z); if (l < (m.r || 1) + (st === 'melee' ? 4.2 : 3.2) && dot(norm(d), h) > 0.35) { close = true; break; } }
  session.simpleT = (session.simpleT || 0) + 1; const T = session.simpleT;
  if (close) { inp.fire = false; inp.melee = (T % 24) < 10; return; }            // de cerca: golpes ligeros (pulsar y soltar)
  if (!session.onTarget) return;
  if (st === 'disparo') { if (!(me.rl > 0)) inp.fire = true; }
  else if (st === 'habilidad') {                                                 // estilo habilidades: lanza sus poderes solo cuando están listos
    if (!(me.ec > 0)) inp.esp = (T % 20) < 4; else if (!(me.s3c > 0)) inp.s3 = (T % 20) < 4; else if (!(me.rl > 0)) inp.fire = true;
    if ((me.ul | 0) >= 100) inp.ult = (T % 30) < 4;
  }
  // estilo melé: no dispara solo; el jugador se acerca y el golpe sale solo
}
const aimEff = () => (settings().simple ? 3 : aimLevel);

/* ───────── sesión y campaña ───────── */
function startSolo(mapId, opts = {}) {
  const intro = opts.intro !== false && !params.get('auto') && !params.get('skipintro');
  const game = new Game({ mapId, seed: opts.seed || (Math.random() * 1e9) | 0, difficulty: opts.difficulty || 1, calm: intro ? 6 : 4, magazines: true, practice: !!opts.practice });
  const p = game.addPlayer(Story.NAME, null, { char: Equipo.char, slots: Equipo.slots, ...Perfil.paraPartida(Equipo.char), style: settings().style }); // evolución y arma fusionada del perfil (perfil.js)
  if (opts.wave) { game.wave = opts.wave - 1; game.phaseT = 0.1; }
  if (opts.god) p.godmode = true;
  session = { practice: !!opts.practice, horde: !!opts.horde, mode: 'solo', game, pid: p.id, acc: 0, touch: useTouch() && !opts.bot, bot: opts.bot ? makeBot(game, p.id, { seed: 5, skill: opts.skill || 1.2 }) : null, headless: !!opts.bot, ended: false, map: mapId, campaign: opts.campaign || null, intro: null };
  enter(mapId);
  if (intro) beginIntro(opts.campaign && opts.campaign !== 'm1' ? 'short' : 'full'); else finishIntro();
}

async function startCoop(create, code, mapId) {
  const net = new NetClient();
  try { await net.connect(); } catch (e) { $('menuerr').textContent = e.message; return; }
  net.onError = (m) => { $('menuerr').textContent = m; };
  net.welcomed = (m) => { session.map = m.map; session.pid = m.pid; renderer.camInit = false; session.look = null; session.ended = false; $('end').classList.add('hidden'); };
  session = { mode: 'coop', net, pid: null, map: mapId, ended: false, look: null, touch: useTouch(), intro: null };
  net.send(create ? { t: 'create', map: mapId, name: Story.NAME, char: Equipo.char, slots: Equipo.slots } : { t: 'join', room: code, name: Story.NAME, char: Equipo.char, slots: Equipo.slots });
  await new Promise((r) => { const t = setInterval(() => { if (net.pid || net.closed) { clearInterval(t); r(); } }, 30); setTimeout(() => { clearInterval(t); r(); }, 2500); });
  if (!net.pid) { session = null; $('menuerr').textContent ||= 'no se pudo entrar a la sala'; return; }
  enter(net.map);
  if (!params.get('skipintro')) beginIntro('short'); else finishIntro();
}

function enter(mapId) {
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('playing');
  sound.init(); sound.resume(); sound.startMusic(mapId);
  renderer.setMap(mapId); renderer.collMap = (session && session.game) ? session.game.map : null; renderer.camInit = false; renderer.setThird(params.get('cam') ? params.get('cam') === 'third' : !!settings().third);
  buildWeaponHud();
  touch.show(!!session.touch);
  if (!session.touch && !session.headless && !NOLOCK && !params.get('auto')) lockPointer(); // requiere gesto del usuario
  if (session.touch && screen.orientation && screen.orientation.lock) { try { screen.orientation.lock('landscape').catch(() => {}); } catch { /* iOS no lo permite */ } }
}

/* ───────── intro: el tren, el despertar, el Heraldo ───────── */
let cine = null;
function beginIntro(kind) {
  session.intro = kind; $('hud').classList.add('hidden'); if (session.touch) touch.show(false);
  if (kind === 'full' && !params.get('classic_intro')) { // Prólogo 3D «La Estación» (src/client/prologo.js); ?skipprologo=1 lo salta, ?classic_intro=1 vuelve al cine 2D
    if (params.get('skipprologo')) { startWake(Story.WAKE); return; }
    const end = (skipped) => { if (!session) return; session.prologo = null; if (skipped) skipIntro(true); else startWake(Story.WAKE); };
    session.prologo = startPrologue({ THREE, renderer, host: Equipo.char, touch: !!session.touch, sound, manual: true, nolock: NOLOCK, onDone: () => end(false), onSkip: () => end(true) });
  } else if (kind === 'full') {
    $('cine').classList.remove('hidden'); sound.train(11);
    const total = Story.INTRO_TRAIN.reduce((a, l) => a + l[2], 0);
    cine = Story.trainCine($('cine'), total, () => { const f = $('flash'); f.classList.add('on'); sound.heartbeat(); later(() => f.classList.remove('on'), 1200); }, CAP);
    subs.play(Story.INTRO_TRAIN, () => later(() => { if (session && session.intro) startWake(Story.WAKE); }, 900));
  } else startWake(Story.WAKE_SHORT);
}
function startWake(lines) {
  if (!session || !session.intro) return;
  if (cine) { cine.stop(); cine = null; } $('cine').classList.add('hidden');
  renderer.setGuide(true); renderer.startWake(4); sound.heartbeat();
  subs.play(lines, finishIntro);
}
function skipIntro(force) { if (!session || !session.intro || (session.prologo && !force)) return; subs.skip(); if (cine) { cine.stop(); cine = null; } $('cine').classList.add('hidden'); finishIntro(); }
/** Ayuda de controles: aparece la primera vez (y desde Pausa > Ver controles). No pausa la partida. */
function showTutorial(force = false) {
  let seen = false; try { seen = localStorage.getItem('cristal.tut.v2') === '1'; } catch { /* ok */ }
  if ((seen && !force) || !session || session.headless) return;
  const touchUI = !!session.touch, el = $('tutorial');
  const rows = touchUI
    ? [['🕹️', 'Palanca izquierda', 'caminar'], ['👆', 'Arrastrá a la derecha', 'mirar'], ['DISPARO', 'botón grande', 'disparar (mantené para ráfaga)'], ['RECARGAR', 'MELEE · SALTO', 'los 4 botones básicos'], ['ULTI', 'USAR', 'aparecen solos cuando sirven · «Habilidades» en Pausa muestra el resto'], ['HABILIDAD', '◆', 'ayuda de equipo · señalar'], ['‹ ›', 'o tocá la barra', 'cambiar de arma']]
    : [['WASD', 'Shift', 'caminar · correr'], ['Ratón', 'clic izq.', 'apuntar · disparar'], ['F', 'G · clic der.', 'habilidad 1 · habilidad 2'], ['Z', 'T', 'habilidad 3 · definitiva'], ['V', 'R', 'golpe cuerpo a cuerpo (mantener = fuerte) · recargar'], ['Q', 'E · B', 'habilidad de equipo · usar · señalar'], ['1–5', 'rueda', 'cambiar de arma'], ['Esc', '', 'pausa']];
  el.innerHTML = `<h4>CÓMO SE JUEGA</h4><p>Sobreviví las oleadas. Cumplí el objetivo de cada oleada y elegí una <b>mejora de arma</b> al terminarla.</p><div class="trows">${rows.map((r) => `<div><b>${r[0]}</b><i>${r[1]}</i><span>${r[2]}</span></div>`).join('')}</div><button id="tutok" type="button">Entendido</button>`;
  el.classList.remove('hidden'); const close = () => { el.classList.add('hidden'); try { localStorage.setItem('cristal.tut.v2', '1'); } catch { /* ok */ } };
  $('tutok').onclick = close; later(close, force ? 20000 : 16000);
}
function finishIntro() {
  if (!session) return; session.intro = null; renderer.setGuide(false); renderer.wakeT = renderer.wakeDur = 0; $('hud').classList.remove('hidden');
  if (session.touch) touch.show(true); else if (!session.headless && !NOLOCK && !params.get('auto') && !locked) lockPointer();
  banner(Story.MAP_BANNER[session.map] || '', 6000); later(() => showTutorial(), 1200);
}

function buildWeaponHud() {
  $('weapons').innerHTML = ''; session.slotKey = '';
}
/** Barra de armas: 5 ranuras con el arma elegida, munición y pips de mejora (se reconstruye sólo si cambian). */
function updateWeaponHud(me) {
  const key = me.sl.join(',') + '|' + JSON.stringify(me.ug);
  if (session.slotKey !== key) {
    session.slotKey = key;
    $('weapons').innerHTML = me.sl.map((w, i) => { const u = me.ug[i], pips = u ? '▮'.repeat(u[0]) + '▮'.repeat(u[1]) + '▮'.repeat(u[2]) : ''; return `<div id="w${i}" data-i="${i}">${i + 1}<em> · ${WEAPONS[w].name}</em><span class="nm"> </span> <span id="a${i}"></span><i class="pips">${pips}${u && u[3] ? ' ◆' : ''}</i></div>`; }).join('');
    $('weapons').querySelectorAll('div').forEach((d) => d.addEventListener('pointerdown', (e) => { if (session && session.touch) { wantWeapon = +d.dataset.i; touch.weapon = wantWeapon; e.stopPropagation(); } }));
  }
  me.sl.forEach((w, i) => { $('w' + i).classList.toggle('sel', me.w === w); $('a' + i).textContent = me.ammo[w] < 0 ? '∞' : me.ammo[w]; });
  session.mySlot = Math.max(0, me.sl.indexOf(me.w));
}
let bannerTimer = 0;
function banner(text, ms = 2500) { const b = $('banner'); b.textContent = text; b.classList.toggle('long', text.length > 60); b.classList.add('on'); bannerSeq++; const my = bannerSeq; later(() => { if (my === bannerSeq) b.classList.remove('on'); }, ms); }
let bannerSeq = 0;

function pauseTouch(on) { if (!session) return; session.paused = on; $('pausehint').textContent = 'Tocá «Continuar» para seguir'; $('pause').classList.toggle('hidden', !on); if (on) touch.reset(); }

/* ───────── modo de prueba de rendimiento ───────── */
const HORDE_KINDS = ['astilla', 'geoda', 'prisma', 'lente', 'cuarzo', 'espejo', 'racimo', 'graviton', 'obelisco', 'aurora', 'ariete', 'espiral'];
function hordeTopUp(g) {
  const ref = g.players[0]; g.phaseT = 1e9; g.queue = [];
  for (const m of g.monsters) { m.hp = m.maxhp = 1e9; }
  while (g.monsters.length < 88) { const k = HORDE_KINDS[g.monsters.length % HORDE_KINDS.length], def = MONSTERS[k]; g.spawnMonster(k, def.fly ? g.map.spawnAir(g.rng, ref.pos, ref.up) : g.map.spawnGround(g.rng, ref.pos)); }
}

/* ───────── bucle principal ───────── */
function frame(now) {
  if (!CAP) requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; // nunca negativo (carga lenta)
  if (CAP) { capT += dt; window.__capT = capT; for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= capT * 1000) { const f = timers[i].fn; timers.splice(i, 1); f(); } if (cine && cine.tick) cine.tick(dt); }
  { const q = $('camquick'); if (q) { q.classList.toggle('hidden', !session || !!session.intro || !!session.paused); q.classList.toggle('third', !!renderer.third); } }
  window.__fps = (window.__fps || 60) * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
  uTime.value += 0; subs.update(dt); padDt = dt;
  if (session && session.prologo) { if (!params.get('prologo_manual')) session.prologo.tick(dt); return; } // prólogo 3D: dibuja él mismo
  if (!session) { for (const a of pad.menuEvents(dt)) ui.act(a); menuSpin(dt); return; }
  if (session && !session.touch && (!locked || session.ended) && !session.headless) for (const a of pad.menuEvents(dt)) { if (a === 'ok' && !$('pause').classList.contains('hidden')) lockPointer(); if (a === 'back' && !$('end').classList.contains('hidden')) location.reload(); }
  auto.tick(dt, level);
  let state = null;
  if (session.mode === 'solo') {
    const g = session.game, paused = (!locked && !session.headless && !session.touch) || session.paused || !!session.intro;
    const L = !session.bot ? lite(g) : null;
    if (!paused && !session.ended) {
      // La entrada se lee UNA vez por cuadro y se entrega al simulador enseguida (acumula el giro hasta el próximo paso fijo):
      // el giro nunca espera a que toque un paso de 60 Hz y la cámara lo muestra en el mismo cuadro (ver soloLook).
      if (!session.bot) { const inp = readInput(); if (L) { assistAim(inp, L, L.players[0], dt, inp.fire); simpleAssist(inp, L, L.players[0]); } g.setInput(session.pid, inp); }
      session.acc += dt;
      while (session.acc >= SIM_DT) {
        session.acc -= SIM_DT;
        if (session.bot) g.setInput(session.pid, session.bot(SIM_DT));
        g.step(SIM_DT);
        if (g.players[0].godmode) { g.players[0].hp = 100; g.players[0].shield = 100; }
        if (session.horde) hordeTopUp(g);
        if (g.state !== 'playing') break;
      }
    } else if (session.intro) { g.time += 0; }
    state = g.snapshot();
    if (paused) state.events = [];
    if (!session.bot && !session.intro && !params.get('look')) session.look = soloLook(g, session.pid);
  } else {
    const net = session.net;
    if (net.closed) banner('Conexión perdida', 5000);
    state = net.view(now);
    if (!state) return;
    session.sendT = (session.sendT || 0) + dt;
    const inp = session.intro ? { mx: 0, mz: 0, dyaw: 0, dpitch: 0 } : readInput();
    const me = state.players.find((p) => p.id === session.pid);
    session.inAcc = session.inAcc || { dyaw: 0, dpitch: 0 };
    if (me && !session.intro) { assistAim(inp, state, me, dt, inp.fire); simpleAssist(inp, state, me); }
    session.inAcc.dyaw += inp.dyaw; session.inAcc.dpitch += inp.dpitch;
    if (me) predictLook(me, inp.dyaw, inp.dpitch);
    if (session.sendT > 1 / 30) { net.send({ t: 'in', i: { ...inp, dyaw: session.inAcc.dyaw, dpitch: session.inAcc.dpitch } }); session.inAcc = { dyaw: 0, dpitch: 0 }; session.sendT = 0; }
  }
  const me = state.players.find((p) => p.id === session.pid) || state.players[0];
  if (me) session.lastMe = me; // para guardar los núcleos al salir (bankProfile)
  if (params.get('look') === 'boss' && me) {
    const b = state.monsters.find((m) => m.k === 'coloso' || m.k === 'madre' || m.k === 'argos');
    if (b) { const up = v3(...me.up), d = norm(v3(b.p[0] - me.pos[0], b.p[1] - me.pos[1], b.p[2] - me.pos[2])), h = norm(project(d, up), v3(...me.h)); session.look = { h: [h.x, h.y, h.z], pitch: Math.asin(Math.max(-1, Math.min(1, d.x * up.x + d.y * up.y + d.z * up.z))) }; }
  }
  session.myWeapon = me ? me.w : 0;
  if (me && me.char && session.handChar !== me.char && renderer.vm && renderer.vm.setHandStyle) { session.handChar = me.char; try { renderer.vm.setHandStyle(me.char); } catch { /* estilo de mano no disponible */ } }
  if (me && renderer.vm && renderer.vm.setUpgrades) me.sl.forEach((w, i) => { const u = me.ug[i]; renderer.vm.setUpgrades(w, u ? { dmg: u[0], rate: u[1], mag: u[2], mod: u[3] || null } : { dmg: 0, rate: 0, mag: 0, mod: null }); });
  if (me && me.wg && renderer.vm && renderer.vm.setOrgans) me.sl.forEach((w, i) => renderer.vm.setOrgans(w, me.wg[i] || [])); // órganos que crecen en cada arma (organs-vis.js)
  touch.zoomKind = renderer.zoomKind || 0;
  renderer.guideTalk = subs.talking;
  renderer.firing = !!(session.touch ? touch.fire : mouse.fire);
  renderer.render(state, dt, session.pid, session.look);
  audioAndHud(state, me, dt);
  if (!session.ended && (state.state === 'won' || state.state === 'lost')) endGame(state, me);
}
const lite = (g) => ({ map: g.mapId, monsters: g.monsters.map((m) => ({ p: [m.pos.x, m.pos.y, m.pos.z], c: m.cloak })), players: g.players.map((p) => ({ pos: [p.pos.x, p.pos.y, p.pos.z], up: [p.up.x, p.up.y, p.up.z], h: [p.heading.x, p.heading.y, p.heading.z], pitch: p.pitch, dead: p.dead })) });

/** Mirada de la cámara en solitario = rumbo REAL del simulador + el giro que todavía no consumió un paso fijo: cero retraso. */
function soloLook(g, pid) {
  const p = g.players.find((q) => q.id === pid); if (!p) return null;
  let h = p.heading; if (p.input.dyaw) h = norm(rotAround(h, p.up, -p.input.dyaw));
  return { h: [h.x, h.y, h.z], pitch: Math.max(-1.5, Math.min(1.5, p.pitch + p.input.dpitch)) };
}
function predictLook(me, dyaw, dpitch) {
  const L = session.look, up = v3(...me.up);
  if (!L) { session.look = { h: me.h, pitch: me.pitch }; return; }
  let h = norm(project(v3(...L.h), up), v3(...me.h));
  if (dyaw) h = norm(rotAround(h, up, -dyaw));
  const sv = v3(...me.h); if (h.x * sv.x + h.y * sv.y + h.z * sv.z < 0.7) h = sv;
  L.h = [h.x, h.y, h.z]; L.pitch = Math.max(-1.5, Math.min(1.5, L.pitch + dpitch));
}

function audioAndHud(state, me, dt) {
  if (!combatHud) { try { combatHud = createCombatHud($('hud'), { sound }); } catch (err) { console.warn('HUD de combate no disponible', err.message); combatHud = { onEvent() {}, update() {} }; } }
  if (!caida) { try { caida = createCaida({ renderer, root: $('hud'), sound }); } catch (err) { console.warn('Percepción de caída no disponible', err.message); caida = { onEvent() {}, update() {} }; } }
  $('cross').classList.toggle('lock', !!session.onTarget);
  if (me && renderer.camera) { const r = new (renderer.camera.position.constructor)(1, 0, 0).applyQuaternion(renderer.camera.quaternion); sound.setListener({ x: me.pos[0], y: me.pos[1], z: me.pos[2] }, r); }
  sound.intensity += (Math.min(1, state.monsters.length / 25) - sound.intensity) * Math.min(1, dt);
  for (const e of state.events) {
    const mine = me && e.pid === me.id;
    if (combatHud) combatHud.onEvent(e, me, renderer.camera);
    caida.onEvent(e, me);
    switch (e.t) {
      case 'shot': sound.shot(e.w, mine ? null : e.o); break;
      case 'hit': sound.hit(e.p); break;
      case 'kill': if (evoHud && evoHud.absorb && ESSENCE_OF[e.k]) { const v = new THREE.Vector3(e.p[0], e.p[1], e.p[2]).project(renderer.camera); if (v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1) evoHud.absorb((v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, e.k); } sound.voice(e.k, 'die', e.p); trophy('first', 'Primer contacto', 'Derrotá a tu primera criatura', sound); if (e.k === 'coloso') trophy('b1', 'Corazón roto', 'Derrotá al Coloso Prismático', sound); if (e.k === 'argos') trophy('b3', 'Cerré el ojo', 'Derrotá a Argos, el Ojo Primordial', sound); if (e.k === 'madre') trophy('b2', 'El último latido', 'Derrotá a la Madre Geoda', sound); if (e.k === 'geoda') trophy('geoda', 'Paciencia', 'Derrotá una Geoda', sound); break;
      case 'boom': sound.boom(e.p); break;
      case 'hurt': if (mine) { sound.hurt(); const v = $('vignette'); v.classList.add('hurt'); setTimeout(() => v.classList.remove('hurt'), 120); if (navigator.vibrate) navigator.vibrate(30); pad.rumble(120, 0.6); } break;
      case 'pickup': if (mine) sound.pickup(); break;
      case 'revive': trophy('rev', 'Mano amiga', 'Reanimá a un compañero', sound); sound.pickup(); banner(mine ? '¡Te reanimaron!' : 'Compañero reanimado', 1800); break;
      case 'wave': if (!session.intro) { sound.wave(); banner(e.boss ? '¡EL CORAZÓN DEL VÓRTICE!' : `OLEADA ${e.n}`, 2500); } break;
      case 'clear': banner('Oleada superada', 2200); if (e.wave >= 3) trophy('w3', 'Resistente', 'Superá 3 oleadas', sound); break;
      case 'gravity': sound.gravity(e.p); trophy('flip', 'Cabeza abajo', 'Sentí la gravedad invertida', sound); if (me && me.flip) banner('¡LA GRAVEDAD SE INVIERTE!', 1500); flash(); break;
      case 'pull': sound.gravity(e.p); break;
      case 'heal': sound.pickup(); break;
      case 'portal': sound.portal(e.p); trophy('portal', 'Atajo dimensional', 'Cruzá un portal', sound); break;
      case 'blink': sound.voice('espejo', 'blink', e.p); break;
      case 'summon': sound.voice('cuarzo', 'cast', e.p); break;
      case 'ability': sound.ability(mine ? null : (me ? e.p : null)); if (mine) banner(ROLES[e.role].ability.toUpperCase(), 900); break;
      case 'objective': objectiveEvent(e); break;
      case 'ping': sound.ping(); break;
      case 'pass': sound.pickup(); break;
      case 'ray': sound.ray(); banner('¡RAYO DEL VACÍO! Parate en un pilar marcado', 2400); break;
      case 'reflect': sound.boom(e.to); banner('¡REFLEJADO! El Coloso está aturdido', 2200); flash(); break;
      case 'shield': banner('El Coloso recupera su escudo', 1600); break;
      case 'purge': sound.gravity(); banner('¡PURGA! La Madre está abierta: ¡disparale!', 2400); flash(); break;
      case 'gestate': banner('La Madre pone huevos: ¡rompelos antes de que eclosionen!', 2400); break;
      case 'hatch': sound.boom(e.p); break;
      case 'organ': if (mine && evoHud) { const O = e.target === 'c' ? CHAMP_ORGANS[e.id] : WEAPON_ORGANS[e.id]; evoHud.organ(O ? O.name : ''); sound.pickup(); } break; // un órgano creció (organs-vis.js lo muestra)
      case 'evolve': if (mine && evoHud) { evoHud.celebrate(e.tier); sound.objective(true); flash(); } break; // evolución: destello, onda y texto (hud-evolucion.js)
      case 'down': sound.down(); if (mine) banner('¡ESTÁS CAÍDO! Pedí ayuda con B', 2200); break;
      case 'surge': banner('El Vórtice se enfurece…', 1800); break;
      case 'feed': if (!session.feedT || performance.now() - session.feedT > 160) { session.feedT = performance.now(); sound.pickup(); } break; // mapa 4: un impacto alimentó un capullo (el aro de puntos del capullo muestra cuánto)
      case 'gnaw': if (!session.gnawT || performance.now() - session.gnawT > 9000) { session.gnawT = performance.now(); banner('¡Las criaturas están royendo un capullo! Defendelo', 2200); sound.hurt(); } break;
      case 'bloom': sound.objective(true); banner(`¡CAPULLO FLORECIDO! (${e.k + 1}/${e.n}) Crece un tramo del puente`, 3000); break;
      case 'bridge': if (e.ph === 'open') { sound.objective(true); banner('¡EL PUENTE AL UMBRAL ESTÁ COMPLETO! Cruzá hasta la isla del este', 3600); flash(); } else if (e.ph === 'start') sound.gravity(e.p); break;
      case 'hint': banner(e.lvl === 1 ? 'Pista: un capullo está marcado. Disparale para alimentarlo' : e.lvl === 2 ? 'Pista: cada capullo que florece hace crecer un tramo del puente entre la Cámara del Latido (este) y el Umbral' : 'Pista: el puente nacerá en el lugar marcado, entre la Cámara del Latido y el Umbral', 4200); break;
      case 'tshot': break;
      case 'skill': if (mine && !(renderer.hostfx && renderer.hostfx.handles(e))) { sound.ability(); } break; // las de los Huéspedes suenan desde hostfx.js
      case 'upgrade': if (mine) { sound.pickup(); banner('¡Arma mejorada!', 1400); } break;
      case 'gaze': sound.ray(); banner('¡ARGOS TE MIRA! Cubrite detrás de un muro', 2200); break;
      case 'ojobreak': sound.boom(e.p); break;
      case 'well': sound.gravity(e.p); break;
      case 'phase': sound.voice(state.boss && state.boss.name.startsWith('Col') ? 'coloso' : 'madre', 'phase'); banner(`FASE ${e.n}`, 1800); flash(); break;
    }
  }
  if (combatHud) combatHud.update(dt, state, me);
  try { caida.update(dt, state, session.intro ? null : me); } catch (err) { caida.update = () => {}; console.warn('caida', err.message); }
  canvas.classList.toggle('flip', !!(me && me.flip));
  canvas.classList.toggle('tide', !!(state.fx && (state.fx.zero || state.fx.warn)));
  if (state.fx && state.fx.warn && !session.tideWarned) { session.tideWarned = true; banner('LA MAREA SE APROXIMA… sin gravedad', 2500); }
  if (state.fx && !state.fx.warn) session.tideWarned = false;
  $('wave').textContent = state.phase === 'intermission' ? (state.wave ? 'RESPIRO' : 'PREPARATE') : `OLEADA ${state.wave} / ${state.waveTotal}`;
  $('left').textContent = state.phase === 'intermission' ? `siguiente en ${Math.ceil(state.intermission)}s` : `${state.left} criaturas`;
  const pr = $('practice');
  if (session.practice && me) { pr.classList.remove('hidden'); pr.innerHTML = `<b>CAMPO DE PRUEBAS</b> · Héroe: <i>${CHARACTERS[me.char] ? CHARACTERS[me.char].name : '—'}</i> (H) · Arma: <i>${WEAPONS[me.w].name}</i> ( , . ) · munición y vida ilimitadas`; } else pr.classList.add('hidden');
  const bb = $('bossbar');
  if (state.boss) { bb.classList.remove('hidden'); $('bossname').textContent = state.boss.name; $('bossfill').style.width = `${Math.max(0, 100 * state.boss.hp / state.boss.max)}%`; } else bb.classList.add('hidden');
  try { hudDirector(state, me); } catch (err) { if (!window.__hudErr) { window.__hudErr = err; console.error("HUD:", err); } }   // un error de interfaz nunca debe detener el dibujo (pantalla negra)
  if (me) {
    $('hpfill').style.width = `${me.hp}%`; $('shfill').style.width = `${me.sh}%`; $('hpnum').textContent = `Vida ${me.hp}`; $('shnum').textContent = `Escudo ${me.sh}`;
    $('score').textContent = `Puntos ${me.score} · Bajas ${me.kills}` + (me.dead ? ' · CAÍDO: un compañero cerca te reanima' : '');
    updateWeaponHud(me);
    if (state.players.length > 1) {
      const c = $('coop'); c.classList.remove('hidden');
      c.innerHTML = 'Sala ' + (session.net ? session.net.room : '') + '<br>' + state.players.map((p) => `${p.id === me.id ? '▶' : ' '} ${p.name} ${p.id} ${p.dead ? `✖ ${Math.round(p.rv / 3 * 100)}%` : p.hp}`).join('<br>');
    }
  }
}

/* ───────── HUD del director: objetivo, habilidad, jefe, ping, caído ───────── */
const OBJ_ICON = { ancla: '⚓', sintonia: '◈', nucleo: '✦', cultivo: '✿' };
function objectiveEvent(e) {
  if (e.ph === 'start') { banner(`${e.title}: ${e.desc}`, 5200); sound.objective(true); }
  else if (e.ph === 'done') {
    sound.objective(true); trophy('obj', 'Trabajo en equipo', 'Completá un objetivo de oleada', sound);
    banner('¡OBJETIVO CUMPLIDO! Munición, vida y +25 % de daño del equipo', 3200);
    if (FRAGMENTS[e.frag] && !(session && session.intro)) later(() => { if (session && !session.ended && !subs.active) subs.play([['H', FRAGMENTS[e.frag], 7]]); }, 2200);
    const o = $('objective'); o.classList.add('done');
  } else if (e.ph === 'failed') { sound.hurt(); banner('Objetivo fallido: el Vórtice se enfurece', 2800); }
}
function hudDirector(state, me) {
  const o = state.obj, box = $('objective');
  if (o && o.state === 'active') {
    box.classList.remove('hidden', 'done', 'fail'); if (session.objKey !== o.type + state.wave) { session.objKey = o.type + state.wave; session.objT0 = performance.now(); } box.classList.toggle('compact', performance.now() - session.objT0 > 9000);
    $('objtitle').textContent = `${OBJ_ICON[o.type] || '◆'} ${o.title}`; $('objdesc').textContent = o.desc;
    $('objfill').style.width = `${Math.round(o.prog * 100)}%`; $('objtime').textContent = `${Math.ceil(o.left)} s`;
  } else box.classList.add('hidden');
  // habilidades del personaje (desplazamiento + especial) y tarjetas de mejora
  const C = me && CHARACTERS[me.char];
  $('skills').style.display = C ? '' : 'none';
  if (C) {
    const touchUI = !!(session && session.touch), set = (id, name, k, key) => { const el = $(id); el.classList.toggle('cd', k > 0.01); el.querySelector('span').textContent = name + (k > 0.01 ? ` ${Math.ceil(k * (id === 'skm' ? C.mov.cd : C.esp.cd))} s` : ''); el.querySelector('i').style.transform = `scaleX(${1 - k})`; el.querySelector('b').textContent = key; };
    set('skm', C.mov.name, me.mv, touchUI ? '' : 'F'); set('ske', C.esp.name, me.es, touchUI ? '' : 'CLIC DER');
  }
  const wantCards = !!(me && me.cards && me.cards.length && state.phase === 'intermission');
  if (wantCards !== cardsOpen) { cardsOpen = wantCards; $('cards').classList.toggle('hidden', !wantCards); session.cardKey = ''; document.body.classList.toggle('cards-open', wantCards); if (wantCards && session.touch) touch.reset(); }
  if (wantCards) {
    const key = JSON.stringify(me.cards) + me.sl.join(',');
    if (session.cardKey !== key) {
      session.cardKey = key; const WC = WEAPON_COLORS.map((c) => '#' + c.toString(16).padStart(6, '0'));
      $('cardlist').innerHTML = me.cards.map((c, i) => {
        const [w, k, mod, mod0] = c, W = WEAPONS[w], idx = me.sl.indexOf(w), u = me.ug[idx] || [0, 0, 0, null], isForma = k === 'forma', FM = isForma ? (LINEAGE.forms[mod] || { name: mod, desc: '' }) : null, isOrg = k === 'organ', OG = isOrg ? ((mod0 === 'c' ? CHAMP_ORGANS : WEAPON_ORGANS)[mod] || { name: mod, desc: '' }) : null, isMut = k === 'mut', isMod = k === 'mod' || isMut, MU = isMut ? ((WEAPON_MUTS[mod0] || []).find((x) => x.id === mod) || { name: mod, desc: '' }) : null;
        const ix = { dmg: 0, rate: 1, mag: 2 }[k], cur = isMod ? 0 : (u[ix] || 0), eff = { dmg: `daño ${Math.round(W.dmg * (1 + 0.22 * cur))} → ${Math.round(W.dmg * (1 + 0.22 * (cur + 1)))}`, rate: `${(1 / (W.rate / (1 + 0.14 * cur))).toFixed(1)} → ${(1 / (W.rate / (1 + 0.14 * (cur + 1)))).toFixed(1)} disparos/s`, mag: W.max === Infinity ? 'munición ∞' : `máx. ${Math.ceil(W.max * (1 + 0.3 * cur))} → ${Math.ceil(W.max * (1 + 0.3 * (cur + 1)))}` }[k];
        return `<button class="ucard ${isMod ? 'mod' : ''}" data-i="${i}" style="--c:${WC[w % WC.length]}"><div class="wn">${isOrg && mod0 === 'c' ? 'TU CUERPO' : W.name}</div><div class="un">${isForma ? '✦ ' + FM.name : isOrg ? '🧬 ' + OG.name : isMut ? MU.name : isMod ? (WEAPON_MODS[mod] || { name: mod }).name : UPGRADE_KINDS[k].name}</div><div class="ud">${isForma ? FM.desc : isOrg ? OG.desc : isMut ? MU.desc : isMod ? (WEAPON_MODS[mod] || { desc: '' }).desc : eff}</div><div class="lv">${isForma ? '✦ LINAJE FINAL (excluyente)' : isOrg ? '🧬 ÓRGANO (usa esencias)' : isMut ? '★★ EVOLUCIÓN (excluyente)' : isMod ? '★ ESPECIAL' : `NIVEL ${cur} → ${cur + 1}`}</div><kbd>${session.touch ? 'tocá' : 'tecla ' + (i + 1)}</kbd></button>`;
      }).join('');
      $('cardlist').querySelectorAll('.ucard').forEach((b) => b.addEventListener('pointerdown', () => { pickReq = +b.dataset.i; }));
      $('cardhint').textContent = session.mode === 'solo' ? 'La partida espera tu elección. El arma mejorada se ve distinta en tu mano.' : 'Elegí rápido: si no elegís, se aplica la primera. El arma mejorada se ve distinta en tu mano.';
    }
  }
  const ab = $('ability');
  if (me && me.role) {
    const R = ROLES[me.role]; ab.style.display = ''; $('abname').textContent = `${R.name} · ${R.ability}`;
    $('abfill').style.width = `${Math.round((1 - me.ab) * 100)}%`; ab.classList.toggle('cd', me.ab > 0.01);
    $('abkey').textContent = me.ab > 0.01 ? `${Math.ceil(me.ab * R.cd)} s` : (session && session.touch ? 'toca HABILIDAD' : 'Q listo');
  }
  if (session && session.touch && me) { // recargas sobre los botones táctiles
    const set = (sel, k, secs) => { const el = document.querySelector(sel); if (el) { if (k > 0.01) el.dataset.cd = Math.ceil(k * secs); else delete el.dataset.cd; } };
    if (me.role) set('.tc-ability', me.ab, ROLES[me.role].cd);
  }
  if (!huespedHud) { try { huespedHud = createHuespedHud($('hud')); } catch (err) { console.warn('HUD de Huésped no disponible', err.message); huespedHud = { update() {} }; } }
  huespedHud.update(me, !!(session && session.touch), !(session && session.intro));
  if (!evoHud) { try { evoHud = createEvoHud($('hud')); } catch (err) { console.warn('HUD de evolución no disponible', err.message); evoHud = { update() {}, celebrate() {}, held() { return false; } }; } }
  if (session) session.lastMe = me;
  try { if (!window.__radar) window.__radar = createRadar(document.body); window.__radar.update(session && !session.intro ? state : null, me, renderer.camera); } catch (err) { /* el radar nunca debe romper el HUD */ }
  evoHud.update(me, !!(session && session.touch), !(session && session.intro));
  if (session && session.touch && me) { // botones contextuales: sólo aparecen cuando sirven
    const near = (p, r) => Math.hypot(p[0] - me.pos[0], p[1] - me.pos[1], p[2] - me.pos[2]) < r;
    const use = !!((state.obj && state.obj.state === 'active') || me.carry || (state.objs || []).some((o) => near(o.p, 7)) || state.players.some((q) => q.id !== me.id && q.dead && near(q.pos, 7)));
    const C = CHARACTERS[me.char], ultOn = !!(C && C.ult && ((+me.ul || 0) >= (C.ult.charge || 100) - 0.01 || (+me.ua || 0) > 0.05));
    touch.setContext({ ult: ultOn, use, evo: me.co != null && me.evn != null && me.co >= me.evn });
  }
  const dn = $('downed');
  if (me && me.dead) { dn.classList.remove('hidden'); dn.textContent = me.lost ? 'PERDIDO… esperá la próxima oleada' : `CAÍDO · te desangrás ${Math.ceil(me.bleed)} s · ¡pedí ayuda con B!`; } else dn.classList.add('hidden');
  const bm = $('bossmech'), b = state.boss;
  if (b) {
    let t = '';
    if (b.name.startsWith('Argos')) t = b.stagger > 0 ? `ATURDIDO ${Math.ceil(b.stagger)} s · ¡daño ×2,5!` : b.gaze > 0 ? `¡MIRADA en ${Math.ceil(b.gaze)} s! Escondete detrás de un muro` : b.eyes > 0 ? `${b.eyes} OJOS protegen a Argos · destruílos (puntos débiles)` : '';
    else if (b.name.startsWith('Col')) t = b.stagger > 0 ? `ATURDIDO ${Math.ceil(b.stagger)} s · ¡daño ×2,5!` : b.ray > 0 ? `RAYO en ${Math.ceil(b.ray)} s · ¡a un pilar marcado!` : b.shield ? 'ESCUDO DE RESONANCIA · reflejá el rayo con un pilar' : '';
    else t = b.pressure >= 1 ? 'PRESIÓN MÁXIMA · ¡purgá las dos válvulas!' : `PRESIÓN ${Math.round(b.pressure * 100)} % · mantené las 2 válvulas a la vez`;
    bm.textContent = t; bm.classList.toggle('hidden', !t);
  } else bm.classList.add('hidden');
  // aliados: nombre + vida sobre la cabeza; los caídos muestran el progreso de reanimación (visibles aunque estén lejos)
  { const ah = $('allies'), others = (session.mode === 'coop' || state.players.length > 1) && me ? state.players.filter((q) => q.id !== me.id) : [], V4 = renderer.camera && renderer.camera.position.constructor;
    while (ah.children.length > others.length) ah.lastChild.remove(); while (ah.children.length < others.length) { const d = document.createElement('div'); d.className = 'ally'; ah.appendChild(d); }
    if (V4) others.forEach((q, i) => {
      const el = ah.children[i], v = new V4(q.pos[0] + q.up[0] * 2.3, q.pos[1] + q.up[1] * 2.3, q.pos[2] + q.up[2] * 2.3).project(renderer.camera), ok = v.z < 1;
      const key = `${q.name}|${q.dead}|${q.lost}|${Math.round(q.hp / 10)}|${Math.round(q.rv * 10)}`; if (el.dataset.k !== key) { el.dataset.k = key; el.className = 'ally' + (q.dead ? ' down' : ''); el.innerHTML = q.dead ? `<b>${q.lost ? '✖ PERDIDO' : '✚ REANIMAR ' + Math.round(q.rv / 3 * 100) + '%'}</b><em>${q.name}</em>` : `<em>${q.name}</em><u><s style="width:${Math.max(0, Math.min(100, q.hp))}%"></s></u>`; }
      const x = Math.max(0.06, Math.min(0.94, v.z < 1 ? v.x * 0.5 + 0.5 : 0.5)), y = Math.max(0.1, Math.min(0.88, v.z < 1 ? -v.y * 0.5 + 0.5 : 0.5));
      el.style.display = ok || q.dead ? '' : 'none'; el.style.left = `${x * 100}%`; el.style.top = `${y * 100}%`;
    });
  }
  // marcadores de ping proyectados a la pantalla
  const host = $('pings'), cam = renderer.camera; if (!cam) return;
  const V3 = cam.position.constructor, lst = state.pings || [];
  while (host.children.length > lst.length) host.lastChild.remove();
  while (host.children.length < lst.length) host.appendChild(document.createElement('div'));
  lst.forEach((q, i) => {
    const el = host.children[i], v = new V3(q.p[0], q.p[1] + 1.2, q.p[2]), d = me ? Math.hypot(q.p[0] - me.pos[0], q.p[1] - me.pos[1], q.p[2] - me.pos[2]) : 0;
    v.project(cam);
    const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    el.style.display = vis ? '' : 'none'; el.className = 'ping ' + (q.k === 'enemy' ? 'danger' : q.k === 'obj' ? 'obj' : '');
    el.style.left = `${(v.x * 0.5 + 0.5) * 100}%`; el.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
    el.textContent = `${q.l ? q.l + ' · ' : ''}${Math.round(d)} m`;
  });
}

let flashSeq = 0;
function flash() { const f = $('flash'); f.classList.add('on'); const my = ++flashSeq; later(() => { if (my === flashSeq) f.classList.remove('on'); }, 90); }

/* ───────── final / campaña ───────── */
/** Suma los núcleos de la partida al banco del perfil y guarda la evolución (una sola vez por partida solitaria). */
function bankProfile(me) { if (!session || session.mode !== 'solo' || session.banked || !me) return; session.banked = true; try { Perfil.cerrarPartida(Equipo.char, me); } catch (err) { console.warn('Perfil: no se pudo guardar', err.message); } }
function endGame(state, me) {
  bankProfile(me);
  session.ended = true; if (document.exitPointerLock) document.exitPointerLock(); touch.show(false);
  const won = state.state === 'won'; window.__ended = state.state;
  const stats = `Oleada ${state.wave}/${state.waveTotal}\nTiempo ${Math.round(state.time)} s\n` + state.players.map((p) => `${p.name} ${p.id}: ${p.kills} bajas · ${p.score} pts`).join('\n');
  const ruta = Story.RUTAS[params.get('ruta')] || Story.RUTAS.corta, nextCap = session.campaign ? ruta[ruta.indexOf(session.campaign) + 1] : null; // ?ruta=larga: m1 → m5 → m6 → m2
  if (session.mode === 'solo' && session.campaign && won && nextCap) { // → interludio y el capítulo siguiente
    renderer.setGuide(true); subs.play(Story.INTERLUDES[nextCap] || Story.INTERLUDE, () => { renderer.setGuide(false); startSolo(nextCap, { campaign: nextCap }); });
    return;
  }
  if (won && session.campaign === 'm2') { renderer.setGuide(true); subs.play(Story.ENDING, () => { renderer.setGuide(false); trophy('end', 'De vuelta al andén', 'Completá la historia', sound); showEnd(true, stats, 'VOLVISTE AL MUNDO DE LOS VIVOS'); }); return; }
  if (!won) { subs.play(Story.DEFEAT, () => showEnd(false, stats)); return; }
  showEnd(true, stats);
}
function showEnd(won, stats, title) {
  $('endtitle').textContent = title || (won ? 'VÓRTICE ROTO' : 'ATRAPADO EN EL VÓRTICE');
  $('endstats').textContent = stats + (won && title ? '\n\nUn abajo bajo los pies. El tren pasó de largo.' : '');
  $('end').classList.remove('hidden'); document.body.classList.remove('playing');
}

function menuSpin(dt) {
  renderer.t += dt; uTime.value = renderer.t;
  if (!renderer.mapId) renderer.setMap('m1');
  renderer.camera.position.set(Math.cos(renderer.t * 0.1) * 40, 22, Math.sin(renderer.t * 0.1) * 40); renderer.camera.lookAt(0, 4, 0);
  renderer.render({ map: renderer.mapId, players: [], monsters: [], projectiles: [], pickups: [], events: [], fx: {} }, dt, 0, null);
}

/* ───────── menú (estilo PS5) ───────── */
const pad = new Pad();
const loadAnd = (fn) => (params.get('cap') ? fn() : showLoading(1900, fn));
const ui = new MenuUI({ sound, actions: {
  story: () => loadAnd(() => startSolo('m1', { campaign: 'm1' })),
  arena: (m) => loadAnd(() => (m === 'practica' ? startSolo('m1', { intro: false, practice: true }) : startSolo(m, { intro: false }))),
} });
$('mkroom').addEventListener('click', () => startCoop(true, null, $('coopmap').value));
$('joinroom').addEventListener('click', () => startCoop(false, $('roomcode').value.trim()));
$('pause').addEventListener('click', (e) => { if (e.target.closest('.item.sel') || e.target.id === 'quit') return; if (session && session.touch) return; lockPointer(); });
$('resume').addEventListener('click', () => { if (session && session.touch) pauseTouch(false); else lockPointer(); });
$('sens').addEventListener('input', (e) => { mouseSens = 0.00044 * +e.target.value; });
$('sens0').addEventListener('input', (e) => { mouseSens = 0.00044 * +e.target.value; });
$('vol').addEventListener('input', (e) => sound.setVolume(+e.target.value / 10));
$('subsel').addEventListener('change', (e) => { $('sub').style.display = e.target.value === '1' ? '' : 'none'; });
$('evoopen').addEventListener('click', (e) => { e.stopPropagation(); if (!evoMenu) evoMenu = createEvoMenu(document.body, { getMe: () => session && session.lastMe, request: (o) => { organReq = o; organReqT = performance.now(); }, sound }); evoMenu.open(); });
$('quit').addEventListener('click', () => { bankProfile(session && session.lastMe); location.reload(); });
/* ───── ajustes de controles táctiles y cámara (se guardan por jugador) ───── */
function bindTouchSettings() {
  const S = settings(), $$ = (id) => $(id), pct = (v) => `${Math.round(v * 100)} %`;
  const bind = (id, get, set, fmt, outId) => { const el = $$(id); if (!el) return; el.value = get(); const o = outId && $$(outId); const show = () => { if (o) o.textContent = fmt ? fmt(+el.value) : el.value; }; show(); el.addEventListener('input', () => { set(el.type === 'range' ? +el.value : el.value); show(); touch.applyLayout(); }); };
  bind('tsx', () => sliderFromSens(S.sensX), (v) => setSetting('sensX', sensFromSlider(v)), (v) => `${(sensFromSlider(v) * 57.2958).toFixed(2)}°/px`, 'tsxo');
  bind('tsy', () => sliderFromSens(S.sensY), (v) => setSetting('sensY', sensFromSlider(v)), (v) => `${(sensFromSlider(v) * 57.2958).toFixed(2)}°/px`, 'tsyo');
  bind('tsa', () => Math.round(S.adsMul * 100), (v) => setSetting('adsMul', v / 100), (v) => `${v} %`, 'tsao');
  bind('tss', () => Math.round(S.scopeMul * 100), (v) => setSetting('scopeMul', v / 100), (v) => `${v} %`, 'tsso');
  bind('tacc', () => (S.accel ? '1' : '0'), (v) => setSetting('accel', v === '1'));
  bind('tag', () => Math.round(S.accelGain * 10), (v) => setSetting('accelGain', v / 10));
  bind('tinv', () => (S.invertY ? '1' : '0'), (v) => setSetting('invertY', v === '1'));
  bind('tgs', () => Math.round(S.gyroSens * 10), (v) => setSetting('gyroSens', v / 10));
  bind('tadsm', () => S.adsMode, (v) => setSetting('adsMode', v));
  bind('tfing', () => String(S.fingers), (v) => touch.setFingers(+v));
  bind('tadv', () => (S.advanced ? '1' : '0'), (v) => { setSetting('advanced', v === '1'); syncAdv(); });
  const syncAdv = () => { const b = $('advtoggle'); if (b) b.querySelector('b').textContent = `Habilidades: ${settings().advanced ? 'sí' : 'no'}`; const t = $('tadv'); if (t) t.value = settings().advanced ? '1' : '0'; };
  const syncCam = () => { const b = $('camtoggle'); if (b) b.querySelector('b').textContent = `Cámara: ${renderer.third ? 'tercera persona (te ves)' : 'primera persona'}`; };
  const setCam = (on) => { renderer.setThird(on); setSetting('third', !!on); syncCam(); };
  const cb = $('camtoggle'); if (cb) cb.addEventListener('click', (e) => { e.stopPropagation(); setCam(!renderer.third); }); syncCam();
  const syncSide = () => { const b = $('camside'); if (b) b.querySelector('b').textContent = `Hombro de la cámara: ${(settings().camSide || 1) > 0 ? 'derecho' : 'izquierdo'}`; };
  const sb = $('camside'); if (sb) sb.addEventListener('click', (e) => { e.stopPropagation(); setSetting('camSide', (settings().camSide || 1) > 0 ? -1 : 1); syncSide(); }); syncSide();
  for (const [id, key, dflt] of [['camdist', 'camDist', 3.6], ['camfov', 'camFov', 78]]) { const el = $(id); if (!el) continue; el.value = settings()[key] || dflt; el.addEventListener('input', () => setSetting(key, +el.value)); el.addEventListener('pointerdown', (e) => e.stopPropagation()); }
  window.__setCam = setCam; const qc = $('camquick'); if (qc) { const tg = (e) => { e.preventDefault(); e.stopPropagation(); setCam(!renderer.third); }; qc.addEventListener('click', tg); qc.addEventListener('pointerdown', (e) => e.stopPropagation()); }
  const syncSimple = () => { const b = $('simpletoggle'); if (b) b.querySelector('b').textContent = `Modo simple (dispara solo): ${settings().simple ? 'sí' : 'no'}`; };
  const stb = $('simpletoggle'); if (stb) stb.addEventListener('click', (e) => { e.stopPropagation(); setSetting('simple', !settings().simple); syncSimple(); }); syncSimple();
  const STY = { disparo: 'Disparo 🎯', melee: 'Melé ⚔', habilidad: 'Habilidades ✦' }, ORD = ['disparo', 'melee', 'habilidad'];
  const syncStyle = () => { const b = $('styletoggle'); if (b) b.querySelector('b').textContent = `Estilo de combate: ${STY[settings().style] || STY.disparo}`; };
  const sty = $('styletoggle'); if (sty) sty.addEventListener('click', (e) => { e.stopPropagation(); const i = ORD.indexOf(settings().style); setSetting('style', ORD[(i + 1) % ORD.length]); session && (session.styleSend = 30); syncStyle(); }); syncStyle();
  const ab = $('advtoggle'); if (ab) { ab.addEventListener('click', (e) => { e.stopPropagation(); setSetting('advanced', !settings().advanced); syncAdv(); touch.applyLayout(); }); } syncAdv();
  bind('ths', () => Math.round(S.hudScale * 100), (v) => setSetting('hudScale', v / 100));
  bind('tho', () => Math.round(S.hudOpacity * 100), (v) => setSetting('hudOpacity', v / 100));
  const gy = $$('tgy'); if (gy) { gy.value = S.gyro ? '1' : '0'; gy.addEventListener('change', async () => { const ok = await touch.enableGyro(gy.value === '1'); if (!ok) { gy.value = '0'; banner('Giroscopio no disponible en este dispositivo o sin permiso', 2800); } }); if (S.gyro) touch.startGyro(); }
  const edit = () => { if (session && session.touch) { $('pause').classList.add('hidden'); session.paused = true; touch.show(true); touch.edit(true); } else { loadAnd(() => { startSolo('m1', { intro: false, practice: true, touchForce: true }); later(() => { if (session) { session.touch = true; touch.show(true); touch.edit(true); session.paused = true; } }, 1500); }); } };
  const eb = $$('tedit'); if (eb) eb.addEventListener('click', edit); const ec = $$('editctl'); if (ec) ec.addEventListener('click', (e) => { e.stopPropagation(); edit(); });
  const rl = $$('tresetlay'); if (rl) rl.addEventListener('click', () => { touch.setFingers(2); setSetting('hudScale', 1); setSetting('hudOpacity', 0.85); import('./settings.js').then((m) => { m.resetLayout(); touch.applyLayout(); }); });
}
bindTouchSettings();
// al terminar de editar los botones, se reanuda la partida
const _tEdit = touch.edit.bind(touch); touch.edit = (on) => { _tEdit(on); if (!on && session && session.paused && session.practice) { session.paused = false; } };
$('showctl').addEventListener('click', (e) => { e.stopPropagation(); showTutorial(true); });
$('tomenu').addEventListener('click', () => location.reload());
$('again').addEventListener('click', () => {
  if (session.mode === 'coop') { session.net.send({ t: 'restart' }); return; }
  startSolo(session.campaign || session.map, { campaign: session.campaign, intro: false });
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !params.get('auto') && location.hostname !== 'localhost') navigator.serviceWorker.register('./sw.js').catch(() => {});

// Modos automáticos para pruebas visuales y de rendimiento: ?auto=m1&bot=1&wave=3&god=1
if (params.get('prologo') && !params.get('auto')) loadAnd(() => startSolo('m1', { campaign: 'm1' })); // ?prologo=1 fuerza el prólogo (entra directo a la campaña)
if (params.get('auto')) {
  startSolo(params.get('auto'), { bot: params.get('bot') === '1', wave: +params.get('wave') || 0, god: params.get('god') === '1', horde: params.get('horde') === '1', seed: +params.get('seed') || 7, skill: +params.get('skill') || 1.2, difficulty: +params.get('difficulty') || 1, intro: false });
  window.__session = session; window.__renderer = renderer;
}
window.__api = { ui, pad, setSetting, settings, get session() { return session; }, get caida() { return caida; }, renderer, MONSTERS, touch, setQuality, get level() { return level; }, subs };
window.__frame = frame; window.__step = (ms) => frame(last + ms); window.__ui = ui; if (!params.get('cap')) requestAnimationFrame(frame);

// En un sitio estático (sin servidor) el cooperativo no está disponible: se avisa y se deshabilita.
fetch('health').then((r) => { if (!r.ok) throw new Error('sin servidor'); }).catch(() => {
  document.querySelectorAll('.coop button, .coop input, .coop select').forEach((x) => { x.disabled = true; });
  $('menuerr').textContent = 'Cooperativo no disponible acá: necesita el servidor (npm start). El modo solo funciona igual.'; $('menuerr').style.color = '#b9aee8';
});
