import { Game } from '../sim/game.js';
import { makeBot } from '../sim/bot.js';
import { WEAPONS, MONSTERS } from '../sim/data.js';
import { rotAround, norm, project, v3 } from '../sim/math.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { NetClient } from './net.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SIM_DT = 1 / 60;

const STORY = {
  intro: 'Ilse Varga, cartógrafa del silencio, abrió una puerta que no estaba en ningún plano. Del otro lado el espacio no tenía abajo. Ahora el Vórtice la retiene entre dimensiones y sus criaturas de cristal —hambrientas de reflejo— vienen en oleadas. Para volver tiene que romper al Coloso Prismático y a la Madre Geoda, los dos corazones del Vórtice.',
  m1: 'VACÍO DE ISLAS — La gravedad cambia según dónde pisás. Pisá los círculos verdes para caer hacia arriba, usá los portales y escondete en las burbujas de tiempo lento.',
  m2: 'CÁMARA FRACTAL — Caminás por dentro de una esfera hueca: el suelo está en todas partes. Cada tanto la marea apaga la gravedad por unos segundos.',
};
$('story').textContent = STORY.intro;

const canvas = $('c');
const renderer = new Renderer(canvas);
const sound = new Sound();

/* ───────── entrada ───────── */
const keys = new Set();
const mouse = { dx: 0, dy: 0, fire: false };
let wantWeapon = -1, locked = false;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code >= 'Digit1' && e.code <= 'Digit5') wantWeapon = +e.code.slice(5) - 1;
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('mousedown', (e) => { if (e.button === 0) mouse.fire = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.fire = false; });
addEventListener('wheel', (e) => { if (session) wantWeapon = (((session.myWeapon || 0) + (e.deltaY > 0 ? 1 : -1)) % 5 + 5) % 5; });
addEventListener('mousemove', (e) => { if (locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (session && !session.ended) $('pause').classList.toggle('hidden', locked || session.headless);
});
const lockPointer = () => { try { canvas.requestPointerLock(); } catch { /* sin pointer lock (headless) */ } };

function readInput() {
  const SENS = 0.0022;
  const i = {
    mx: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), mz: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    dyaw: mouse.dx * SENS, dpitch: -mouse.dy * SENS, jump: keys.has('Space'), fire: mouse.fire, dash: keys.has('ShiftLeft') || keys.has('ShiftRight'), weapon: wantWeapon,
  };
  mouse.dx = mouse.dy = 0; wantWeapon = -1;
  return i;
}

/* ───────── sesión ───────── */
let session = null;
let last = performance.now();

function startSolo(mapId, opts = {}) {
  const game = new Game({ mapId, seed: opts.seed || (Math.random() * 1e9) | 0, difficulty: opts.difficulty || 1 });
  const p = game.addPlayer('Ilse');
  if (opts.wave) { game.wave = opts.wave - 1; game.phaseT = 0.1; }
  if (opts.god) p.godmode = true;
  session = { mode: 'solo', game, pid: p.id, acc: 0, bot: opts.bot ? makeBot(game, p.id, { seed: 5, skill: opts.skill || 1.2 }) : null, headless: !!opts.bot, ended: false, map: mapId };
  enter(mapId);
}

async function startCoop(create, code, mapId) {
  const net = new NetClient();
  try { await net.connect(); } catch (e) { $('menuerr').textContent = e.message; return; }
  net.onError = (m) => { $('menuerr').textContent = m; };
  net.welcomed = (m) => { session.map = m.map; session.pid = m.pid; renderer.camInit = false; session.look = null; session.ended = false; $('end').classList.add('hidden'); };
  session = { mode: 'coop', net, pid: null, map: mapId, ended: false, look: null };
  net.send(create ? { t: 'create', map: mapId, name: 'Ilse' } : { t: 'join', room: code, name: 'Ilse' });
  await new Promise((r) => { const t = setInterval(() => { if (net.pid || net.closed) { clearInterval(t); r(); } }, 30); setTimeout(() => { clearInterval(t); r(); }, 2500); });
  if (!net.pid) { session = null; $('menuerr').textContent ||= 'no se pudo entrar a la sala'; return; }
  setInterval(() => { if (session && session.net === net && !session.ended) { /* entrada enviada en el bucle */ } }, 1000);
  enter(net.map);
}

function enter(mapId) {
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden');
  sound.init(); sound.resume(); sound.startMusic(mapId);
  renderer.setMap(mapId); renderer.camInit = false;
  banner(STORY[mapId], 6000);
  buildWeaponHud();
  if (!session.headless) lockPointer();
}

function buildWeaponHud() {
  $('weapons').innerHTML = WEAPONS.map((w, i) => `<div id="w${i}">${i + 1} · ${w.name} <span id="a${i}"></span></div>`).join('');
}

let bannerTimer = 0;
function banner(text, ms = 2500) {
  const b = $('banner'); b.textContent = text; b.classList.add('on'); clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.remove('on'), ms);
}

/* ───────── bucle principal ───────── */
let shotsWithinFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  window.__fps = (window.__fps || 60) * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
  if (!session) { menuSpin(dt); return; }
  let state = null;
  if (session.mode === 'solo') {
    const g = session.game, paused = !locked && !session.headless;
    if (!paused && !session.ended) {
      session.acc += dt;
      while (session.acc >= SIM_DT) {
        session.acc -= SIM_DT;
        const inp = session.bot ? session.bot(SIM_DT) : readInput();
        g.setInput(session.pid, inp);
        g.step(SIM_DT);
        if (g.players[0].godmode) { g.players[0].hp = 100; g.players[0].shield = 100; }
        if (g.state !== 'playing') break;
      }
    }
    state = g.snapshot();
    if (paused) state.events = [];
    session.lastEvents = state.events;
  } else {
    const net = session.net;
    if (net.closed) { banner('Conexión perdida', 5000); }
    state = net.view(now);
    if (!state) return;
    // entrada local (30 Hz) + predicción de la mirada
    session.sendT = (session.sendT || 0) + dt;
    const inp = readInput();
    const me = state.players.find((p) => p.id === session.pid);
    session.inAcc = session.inAcc || { dyaw: 0, dpitch: 0 };
    session.inAcc.dyaw += inp.dyaw; session.inAcc.dpitch += inp.dpitch;
    if (me) predictLook(me, inp.dyaw, inp.dpitch);
    if (session.sendT > 1 / 30) {
      net.send({ t: 'in', i: { ...inp, dyaw: session.inAcc.dyaw, dpitch: session.inAcc.dpitch } });
      session.inAcc = { dyaw: 0, dpitch: 0 }; session.sendT = 0;
    }
  }
  const me = state.players.find((p) => p.id === session.pid) || state.players[0];
  session.myWeapon = me ? me.w : 0;
  renderer.render(state, dt, session.pid, session.look);
  audioAndHud(state, me, dt);
  if (!session.ended && (state.state === 'won' || state.state === 'lost')) endGame(state, me);
}

function predictLook(me, dyaw, dpitch) {
  const L = session.look;
  const up = v3(...me.up);
  if (!L) { session.look = { h: me.h, pitch: me.pitch }; return; }
  let h = norm(project(v3(...L.h), up), v3(...me.h));
  if (dyaw) h = norm(rotAround(h, up, -dyaw));
  const sv = v3(...me.h), cosA = h.x * sv.x + h.y * sv.y + h.z * sv.z;
  if (cosA < 0.7) h = sv; // desvío grande (reaparición, portal): confiar en el servidor
  L.h = [h.x, h.y, h.z]; L.pitch = Math.max(-1.5, Math.min(1.5, L.pitch + dpitch));
}

function audioAndHud(state, me, dt) {
  if (me) {
    sound.setListener({ x: me.pos[0], y: me.pos[1], z: me.pos[2] }, { x: 0, y: 0, z: 0 });
    if (renderer.camera) { const r = new (renderer.camera.position.constructor)(1, 0, 0).applyQuaternion(renderer.camera.quaternion); sound.setListener({ x: me.pos[0], y: me.pos[1], z: me.pos[2] }, r); }
  }
  sound.intensity += (Math.min(1, state.monsters.length / 25) - sound.intensity) * Math.min(1, dt);
  for (const e of state.events) {
    const mine = me && e.pid === me.id;
    switch (e.t) {
      case 'shot': sound.shot(e.w, mine ? null : e.o); break;
      case 'hit': sound.hit(e.p); break;
      case 'kill': sound.voice(e.k, 'die', e.p); break;
      case 'boom': sound.boom(e.p); break;
      case 'hurt': if (mine) { sound.hurt(); const v = $('vignette'); v.classList.add('hurt'); setTimeout(() => v.classList.remove('hurt'), 120); } break;
      case 'pickup': if (mine) sound.pickup(); break;
      case 'wave': sound.wave(); banner(e.boss ? '¡EL CORAZÓN DEL VÓRTICE!' : `OLEADA ${e.n}`, 2500); break;
      case 'clear': banner('Oleada superada', 2200); break;
      case 'gravity': sound.gravity(e.p); if (me && me.flip) banner('¡LA GRAVEDAD SE INVIERTE!', 1500); flash(); break;
      case 'portal': sound.portal(e.p); break;
      case 'blink': sound.voice('espejo', 'blink', e.p); break;
      case 'summon': sound.voice('cuarzo', 'cast', e.p); break;
      case 'phase': sound.voice(state.boss && state.boss.name.startsWith('Col') ? 'coloso' : 'madre', 'phase'); banner(`FASE ${e.n}`, 1800); flash(); break;
      case 'bite': break;
    }
  }
  canvas.classList.toggle('flip', !!(me && me.flip));
  canvas.classList.toggle('tide', !!(state.fx && (state.fx.zero || state.fx.warn)));
  if (state.fx && state.fx.warn && !session.tideWarned) { session.tideWarned = true; banner('LA MAREA SE APROXIMA… sin gravedad', 2500); }
  if (state.fx && !state.fx.warn) session.tideWarned = false;
  // HUD
  $('wave').textContent = state.phase === 'intermission' ? (state.wave ? 'RESPIRO' : 'PREPARATE') : `OLEADA ${state.wave} / ${state.waveTotal}`;
  $('left').textContent = state.phase === 'intermission' ? `siguiente en ${Math.ceil(state.intermission)}s` : `${state.left} criaturas`;
  const bb = $('bossbar');
  if (state.boss) { bb.classList.remove('hidden'); $('bossname').textContent = state.boss.name; $('bossfill').style.width = `${Math.max(0, 100 * state.boss.hp / state.boss.max)}%`; } else bb.classList.add('hidden');
  if (me) {
    $('hpfill').style.width = `${me.hp}%`; $('shfill').style.width = `${me.sh}%`; $('hpnum').textContent = `Vida ${me.hp}`; $('shnum').textContent = `Escudo ${me.sh}`;
    $('score').textContent = `Puntos ${me.score} · Bajas ${me.kills}` + (me.dead ? ' · CAÍDO (revivís en la próxima oleada)' : '');
    WEAPONS.forEach((w, i) => { $('w' + i).classList.toggle('sel', me.w === i); $('a' + i).textContent = me.ammo[i] < 0 ? '∞' : me.ammo[i]; });
    if (state.players.length > 1) { const c = $('coop'); c.classList.remove('hidden'); c.innerHTML = 'Sala ' + (session.net ? session.net.room : '') + '<br>' + state.players.map((p) => `${p.id === me.id ? '▶' : ' '} ${p.name} ${p.dead ? '✖' : p.hp}`).join('<br>'); }
  }
}

let flashT = 0;
function flash() { const f = $('flash'); f.classList.add('on'); clearTimeout(flashT); flashT = setTimeout(() => f.classList.remove('on'), 90); }

function endGame(state, me) {
  session.ended = true; document.exitPointerLock && document.exitPointerLock();
  const won = state.state === 'won';
  $('endtitle').textContent = won ? 'VÓRTICE ROTO' : 'ATRAPADA EN EL VÓRTICE';
  $('endstats').textContent = `Oleada ${state.wave}/${state.waveTotal}\nTiempo ${Math.round(state.time)} s\n` + state.players.map((p) => `${p.name}: ${p.kills} bajas · ${p.score} pts`).join('\n') + (won ? '\n\nIlse vuelve a ver un abajo.' : '');
  $('end').classList.remove('hidden');
  window.__ended = state.state;
}

function menuSpin(dt) {
  renderer.t += dt; // el cielo sigue girando detrás del menú
  if (!renderer.mapId) renderer.setMap('m1');
  renderer.camera.position.set(Math.cos(renderer.t * 0.1) * 40, 22, Math.sin(renderer.t * 0.1) * 40); renderer.camera.lookAt(0, 4, 0);
  import('./shaders.js').then((s) => { s.uTime.value = renderer.t; });
  renderer.gl.render(renderer.scene, renderer.camera);
}

/* ───────── menú ───────── */
document.querySelectorAll('[data-start]').forEach((b) => b.addEventListener('click', () => startSolo(b.dataset.start)));
$('mkroom').addEventListener('click', () => startCoop(true, null, $('coopmap').value));
$('joinroom').addEventListener('click', () => startCoop(false, $('roomcode').value.trim()));
$('pause').addEventListener('click', (e) => { if (e.target.id !== 'quit') lockPointer(); });
$('quit').addEventListener('click', () => location.reload());
$('tomenu').addEventListener('click', () => location.reload());
$('again').addEventListener('click', () => {
  if (session.mode === 'coop') { session.net.send({ t: 'restart' }); return; }
  startSolo(session.map);
});

// Modos automáticos para pruebas visuales y de rendimiento: ?auto=m1&bot=1&wave=3&god=1
if (params.get('auto')) {
  startSolo(params.get('auto'), { bot: params.get('bot') === '1', wave: +params.get('wave') || 0, god: params.get('god') === '1', seed: +params.get('seed') || 7, skill: +params.get('skill') || 1.2, difficulty: +params.get('difficulty') || 1 });
  window.__session = session; window.__renderer = renderer;
}
window.__api = { get session() { return session; }, renderer, MONSTERS };
requestAnimationFrame(frame);
