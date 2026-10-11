import { Game } from '../sim/game.js';
import { makeBot } from '../sim/bot.js';
import { WEAPONS, MONSTERS } from '../sim/data.js';
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
if (CAP) { // no suena nada en vivo: se registra cada sonido con su tiempo virtual para sintetizar la banda sonora
  window.__evlog = []; for (const m of ['ui', 'chirp', 'train', 'heartbeat', 'shot', 'boom', 'hit', 'voice', 'hurt', 'pickup', 'gravity', 'portal', 'wave', 'init', 'resume', 'startMusic', 'setListener']) sound[m] = (...a) => { if (m !== 'init' && m !== 'resume' && m !== 'setListener' && m !== 'startMusic') window.__evlog.push({ t: window.__capT || 0, m, a: JSON.parse(JSON.stringify(a)) }); };
}
const subs = new Story.Subtitles($('sub'), sound);
const ctrlPref = params.get('input') || (() => { try { return localStorage.getItem('cristal.ctrl.v1') || 'auto'; } catch { return 'auto'; } })();
const useTouch = () => { const p = $('ctrlsel').value; return p === 'touch' || (p === 'auto' && isTouchDevice()); };
for (const sel of [$('qsel'), $('qsel2')]) { sel.innerHTML = Object.entries(LEVELS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join(''); sel.value = level; }
$('ctrlsel').value = ctrlPref;
function setQuality(l, { save = true } = {}) { if (!LEVELS[l] || l === level) return; level = l; $('qsel').value = $('qsel2').value = l; if (save) saveQuality(l); renderer.applyQuality(l); }
$('qsel').addEventListener('change', (e) => setQuality(e.target.value)); $('qsel2').addEventListener('change', (e) => setQuality(e.target.value));
$('ctrlsel').addEventListener('change', () => { try { localStorage.setItem('cristal.ctrl.v1', $('ctrlsel').value); } catch { /* ok */ } });
const auto = new AutoQuality((l) => { setQuality(l, { save: false }); banner(`Rendimiento bajo: gráficos en «${LEVELS[l].label}»`, 2500); });
if (params.get('autoq') === '0') auto.enabled = false;

/* ───────── entrada de teclado/ratón ───────── */
const keys = new Set();
const mouse = { dx: 0, dy: 0, fire: false };
const NOLOCK = params.get('nolock') === '1';
let wantWeapon = -1, locked = NOLOCK, session = null, last = performance.now(), mouseSens = 0.0022;
addEventListener('keydown', (e) => {
  if (typeof ui !== 'undefined' && !session && ui.handleKey(e)) return;
  keys.add(e.code);
  if (e.code >= 'Digit1' && e.code <= 'Digit5') wantWeapon = +e.code.slice(5) - 1;
  if (e.code === 'Space') e.preventDefault();
  if ((e.code === 'Enter' || e.code === 'Escape') && session && session.intro) skipIntro();
  if (e.code === 'KeyV' && session && !session.intro) renderer.setThird(!renderer.third); // cámara en tercera persona
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('mousedown', (e) => { if (e.button === 0) mouse.fire = true; if (session && session.intro) skipIntro(); });
addEventListener('mouseup', (e) => { if (e.button === 0) mouse.fire = false; });
addEventListener('wheel', (e) => { if (session) wantWeapon = (((session.myWeapon || 0) + (e.deltaY > 0 ? 1 : -1)) % 5 + 5) % 5; });
addEventListener('mousemove', (e) => { if (locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
document.addEventListener('pointerlockchange', () => {
  if (NOLOCK) return; locked = document.pointerLockElement === canvas;
  if (session && !session.ended && !session.touch) $('pause').classList.toggle('hidden', locked || session.headless || !!session.intro);
});
const lockPointer = () => { try { canvas.requestPointerLock(); } catch { /* sin pointer lock */ } };

const touch = new TouchControls($('touch'), {
  onPause: () => pauseTouch(true),
  onWeapon: (d) => { const w = (((session ? session.myWeapon || 0 : 0) + d) % 5 + 5) % 5; return w; },
});
let tapSkip = 0;
$('touch').addEventListener('pointerdown', () => { if (session && session.intro) skipIntro(); }, true);
addEventListener('touchstart', () => { sound.init(); sound.resume(); }, { passive: true });

function readInput() {
  if (session && session.touch) return touch.read();
  const SENS = mouseSens;
  const i = {
    mx: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), mz: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    dyaw: mouse.dx * SENS, dpitch: -mouse.dy * SENS, jump: keys.has('Space'), fire: mouse.fire, dash: keys.has('ShiftLeft') || keys.has('ShiftRight'), weapon: wantWeapon,
  };
  mouse.dx = mouse.dy = 0; wantWeapon = -1;
  const g = pad.read(padDt); // mando (DualSense / Xbox)
  if (g) {
    i.mx = Math.max(-1, Math.min(1, i.mx + g.mx)); i.mz = Math.max(-1, Math.min(1, i.mz + g.mz)); i.dyaw += g.dyaw; i.dpitch += g.dpitch;
    i.fire = i.fire || g.fire; i.jump = i.jump || g.jump; i.dash = i.dash || g.dash;
    if (g.next && !padLatch.next) i.weapon = (((session ? session.myWeapon || 0 : 0) + 1) % 5 + 5) % 5; if (g.prev && !padLatch.prev) i.weapon = (((session ? session.myWeapon || 0 : 0) - 1) % 5 + 5) % 5;
    padLatch.next = g.next; padLatch.prev = g.prev;
    if (g.pause && !padLatch.pause && session && !session.touch) { document.exitPointerLock && document.exitPointerLock(); }
    padLatch.pause = g.pause; renderer.firing = renderer.firing || g.fire;
  }
  return i;
}
const padLatch = { next: false, prev: false, pause: false }; let padDt = 0.016;

/** Asistencia de puntería táctil: empuja suavemente la mira hacia la criatura más cercana al centro. */
function assistAim(inp, state, me, dt) {
  if (!me || me.dead) return;
  const up = v3(...me.up), h = v3(...me.h), eye = { x: me.pos[0] + up.x * 0.6, y: me.pos[1] + up.y * 0.6, z: me.pos[2] + up.z * 0.6 };
  const cp = Math.cos(me.pitch), aim = { x: h.x * cp + up.x * Math.sin(me.pitch), y: h.y * cp + up.y * Math.sin(me.pitch), z: h.z * cp + up.z * Math.sin(me.pitch) };
  let best = null, bd = 0.2;
  for (const m of state.monsters) {
    const to = norm(sub({ x: m.p[0], y: m.p[1], z: m.p[2] }, eye)), ang = Math.acos(Math.max(-1, Math.min(1, dot(to, aim))));
    if (ang < bd && !m.c) { bd = ang; best = to; }
  }
  if (!best) return;
  const tan = norm(project(best, up), h), yawErr = Math.atan2(dot(cross(h, tan), up), dot(h, tan)), pitchErr = Math.asin(Math.max(-1, Math.min(1, dot(best, up)))) - me.pitch;
  const k = 3.5 * dt; inp.dyaw += -yawErr * k; inp.dpitch += pitchErr * k;
}

/* ───────── sesión y campaña ───────── */
function startSolo(mapId, opts = {}) {
  const intro = opts.intro !== false && !params.get('auto') && !params.get('skipintro');
  const game = new Game({ mapId, seed: opts.seed || (Math.random() * 1e9) | 0, difficulty: opts.difficulty || 1, calm: intro ? 6 : 4 });
  const p = game.addPlayer(Story.NAME);
  if (opts.wave) { game.wave = opts.wave - 1; game.phaseT = 0.1; }
  if (opts.god) p.godmode = true;
  session = { horde: !!opts.horde, mode: 'solo', game, pid: p.id, acc: 0, touch: useTouch() && !opts.bot, bot: opts.bot ? makeBot(game, p.id, { seed: 5, skill: opts.skill || 1.2 }) : null, headless: !!opts.bot, ended: false, map: mapId, campaign: opts.campaign || null, intro: null };
  enter(mapId);
  if (intro) beginIntro(opts.campaign === 'm2' ? 'short' : 'full'); else finishIntro();
}

async function startCoop(create, code, mapId) {
  const net = new NetClient();
  try { await net.connect(); } catch (e) { $('menuerr').textContent = e.message; return; }
  net.onError = (m) => { $('menuerr').textContent = m; };
  net.welcomed = (m) => { session.map = m.map; session.pid = m.pid; renderer.camInit = false; session.look = null; session.ended = false; $('end').classList.add('hidden'); };
  session = { mode: 'coop', net, pid: null, map: mapId, ended: false, look: null, touch: useTouch(), intro: null };
  net.send(create ? { t: 'create', map: mapId, name: Story.NAME } : { t: 'join', room: code, name: Story.NAME });
  await new Promise((r) => { const t = setInterval(() => { if (net.pid || net.closed) { clearInterval(t); r(); } }, 30); setTimeout(() => { clearInterval(t); r(); }, 2500); });
  if (!net.pid) { session = null; $('menuerr').textContent ||= 'no se pudo entrar a la sala'; return; }
  enter(net.map);
  if (!params.get('skipintro')) beginIntro('short'); else finishIntro();
}

function enter(mapId) {
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('playing');
  sound.init(); sound.resume(); sound.startMusic(mapId);
  renderer.setMap(mapId); renderer.camInit = false; renderer.setThird(params.get('cam') === 'third');
  buildWeaponHud();
  touch.show(!!session.touch);
  if (!session.touch && !session.headless && !NOLOCK && !params.get('auto')) lockPointer(); // requiere gesto del usuario
  if (session.touch && screen.orientation && screen.orientation.lock) { try { screen.orientation.lock('landscape').catch(() => {}); } catch { /* iOS no lo permite */ } }
}

/* ───────── intro: el tren, el despertar, el Heraldo ───────── */
let cine = null;
function beginIntro(kind) {
  session.intro = kind; $('hud').classList.add('hidden'); if (session.touch) touch.show(false);
  if (kind === 'full') {
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
function skipIntro() { if (!session || !session.intro) return; subs.skip(); if (cine) { cine.stop(); cine = null; } $('cine').classList.add('hidden'); finishIntro(); }
function finishIntro() {
  if (!session) return; session.intro = null; renderer.setGuide(false); renderer.wakeT = renderer.wakeDur = 0; $('hud').classList.remove('hidden');
  if (session.touch) touch.show(true); else if (!session.headless && !NOLOCK && !params.get('auto') && !locked) lockPointer();
  banner(Story.MAP_BANNER[session.map] || '', 6000);
}

function buildWeaponHud() {
  $('weapons').innerHTML = WEAPONS.map((w, i) => `<div id="w${i}" data-w="${i}">${i + 1} · ${w.name} <span id="a${i}"></span></div>`).join('');
  $('weapons').querySelectorAll('div').forEach((d) => d.addEventListener('pointerdown', (e) => { if (session && session.touch) { wantWeapon = +d.dataset.w; touch.weapon = wantWeapon; e.stopPropagation(); } }));
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
  window.__fps = (window.__fps || 60) * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
  uTime.value += 0; subs.update(dt); padDt = dt;
  if (!session) { for (const a of pad.menuEvents(dt)) ui.act(a); menuSpin(dt); return; }
  if (session && !session.touch && (!locked || session.ended) && !session.headless) for (const a of pad.menuEvents(dt)) { if (a === 'ok' && !$('pause').classList.contains('hidden')) lockPointer(); if (a === 'back' && !$('end').classList.contains('hidden')) location.reload(); }
  auto.tick(dt, level);
  let state = null;
  if (session.mode === 'solo') {
    const g = session.game, paused = (!locked && !session.headless && !session.touch) || session.paused || !!session.intro;
    const L = session.touch && !session.bot ? lite(g) : null;
    if (!paused && !session.ended) {
      session.acc += dt;
      while (session.acc >= SIM_DT) {
        session.acc -= SIM_DT;
        let inp = session.bot ? session.bot(SIM_DT) : readInput();
        if (L) assistAim(inp, L, L.players[0], SIM_DT);
        g.setInput(session.pid, inp); g.step(SIM_DT);
        if (g.players[0].godmode) { g.players[0].hp = 100; g.players[0].shield = 100; }
        if (session.horde) hordeTopUp(g);
        if (g.state !== 'playing') break;
      }
    } else if (session.intro) { g.time += 0; }
    state = g.snapshot();
    if (paused) state.events = [];
  } else {
    const net = session.net;
    if (net.closed) banner('Conexión perdida', 5000);
    state = net.view(now);
    if (!state) return;
    session.sendT = (session.sendT || 0) + dt;
    const inp = session.intro ? { mx: 0, mz: 0, dyaw: 0, dpitch: 0 } : readInput();
    const me = state.players.find((p) => p.id === session.pid);
    session.inAcc = session.inAcc || { dyaw: 0, dpitch: 0 };
    if (session.touch && me && !session.intro) assistAim(inp, state, me, dt);
    session.inAcc.dyaw += inp.dyaw; session.inAcc.dpitch += inp.dpitch;
    if (me) predictLook(me, inp.dyaw, inp.dpitch);
    if (session.sendT > 1 / 30) { net.send({ t: 'in', i: { ...inp, dyaw: session.inAcc.dyaw, dpitch: session.inAcc.dpitch } }); session.inAcc = { dyaw: 0, dpitch: 0 }; session.sendT = 0; }
  }
  const me = state.players.find((p) => p.id === session.pid) || state.players[0];
  if (params.get('look') === 'boss' && me) {
    const b = state.monsters.find((m) => m.k === 'coloso' || m.k === 'madre');
    if (b) { const up = v3(...me.up), d = norm(v3(b.p[0] - me.pos[0], b.p[1] - me.pos[1], b.p[2] - me.pos[2])), h = norm(project(d, up), v3(...me.h)); session.look = { h: [h.x, h.y, h.z], pitch: Math.asin(Math.max(-1, Math.min(1, d.x * up.x + d.y * up.y + d.z * up.z))) }; }
  }
  session.myWeapon = me ? me.w : 0;
  renderer.guideTalk = subs.talking;
  renderer.firing = !!(session.touch ? touch.fire : mouse.fire);
  renderer.render(state, dt, session.pid, session.look);
  audioAndHud(state, me, dt);
  if (!session.ended && (state.state === 'won' || state.state === 'lost')) endGame(state, me);
}
const lite = (g) => ({ monsters: g.monsters.map((m) => ({ p: [m.pos.x, m.pos.y, m.pos.z], c: m.cloak })), players: g.players.map((p) => ({ pos: [p.pos.x, p.pos.y, p.pos.z], up: [p.up.x, p.up.y, p.up.z], h: [p.heading.x, p.heading.y, p.heading.z], pitch: p.pitch, dead: p.dead })) });

function predictLook(me, dyaw, dpitch) {
  const L = session.look, up = v3(...me.up);
  if (!L) { session.look = { h: me.h, pitch: me.pitch }; return; }
  let h = norm(project(v3(...L.h), up), v3(...me.h));
  if (dyaw) h = norm(rotAround(h, up, -dyaw));
  const sv = v3(...me.h); if (h.x * sv.x + h.y * sv.y + h.z * sv.z < 0.7) h = sv;
  L.h = [h.x, h.y, h.z]; L.pitch = Math.max(-1.5, Math.min(1.5, L.pitch + dpitch));
}

function audioAndHud(state, me, dt) {
  if (me && renderer.camera) { const r = new (renderer.camera.position.constructor)(1, 0, 0).applyQuaternion(renderer.camera.quaternion); sound.setListener({ x: me.pos[0], y: me.pos[1], z: me.pos[2] }, r); }
  sound.intensity += (Math.min(1, state.monsters.length / 25) - sound.intensity) * Math.min(1, dt);
  for (const e of state.events) {
    const mine = me && e.pid === me.id;
    switch (e.t) {
      case 'shot': sound.shot(e.w, mine ? null : e.o); break;
      case 'hit': sound.hit(e.p); break;
      case 'kill': sound.voice(e.k, 'die', e.p); trophy('first', 'Primer contacto', 'Derrotá a tu primera criatura', sound); if (e.k === 'coloso') trophy('b1', 'Corazón roto', 'Derrotá al Coloso Prismático', sound); if (e.k === 'madre') trophy('b2', 'El último latido', 'Derrotá a la Madre Geoda', sound); if (e.k === 'geoda') trophy('geoda', 'Paciencia', 'Derrotá una Geoda', sound); break;
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
      case 'phase': sound.voice(state.boss && state.boss.name.startsWith('Col') ? 'coloso' : 'madre', 'phase'); banner(`FASE ${e.n}`, 1800); flash(); break;
    }
  }
  canvas.classList.toggle('flip', !!(me && me.flip));
  canvas.classList.toggle('tide', !!(state.fx && (state.fx.zero || state.fx.warn)));
  if (state.fx && state.fx.warn && !session.tideWarned) { session.tideWarned = true; banner('LA MAREA SE APROXIMA… sin gravedad', 2500); }
  if (state.fx && !state.fx.warn) session.tideWarned = false;
  $('wave').textContent = state.phase === 'intermission' ? (state.wave ? 'RESPIRO' : 'PREPARATE') : `OLEADA ${state.wave} / ${state.waveTotal}`;
  $('left').textContent = state.phase === 'intermission' ? `siguiente en ${Math.ceil(state.intermission)}s` : `${state.left} criaturas`;
  const bb = $('bossbar');
  if (state.boss) { bb.classList.remove('hidden'); $('bossname').textContent = state.boss.name; $('bossfill').style.width = `${Math.max(0, 100 * state.boss.hp / state.boss.max)}%`; } else bb.classList.add('hidden');
  if (me) {
    $('hpfill').style.width = `${me.hp}%`; $('shfill').style.width = `${me.sh}%`; $('hpnum').textContent = `Vida ${me.hp}`; $('shnum').textContent = `Escudo ${me.sh}`;
    $('score').textContent = `Puntos ${me.score} · Bajas ${me.kills}` + (me.dead ? ' · CAÍDO: un compañero cerca (3 s) te reanima' : '');
    WEAPONS.forEach((w, i) => { $('w' + i).classList.toggle('sel', me.w === i); $('a' + i).textContent = me.ammo[i] < 0 ? '∞' : me.ammo[i]; });
    if (state.players.length > 1) {
      const c = $('coop'); c.classList.remove('hidden');
      c.innerHTML = 'Sala ' + (session.net ? session.net.room : '') + '<br>' + state.players.map((p) => `${p.id === me.id ? '▶' : ' '} ${p.name} ${p.id} ${p.dead ? `✖ ${Math.round(p.rv / 3 * 100)}%` : p.hp}`).join('<br>');
    }
  }
}

let flashSeq = 0;
function flash() { const f = $('flash'); f.classList.add('on'); const my = ++flashSeq; later(() => { if (my === flashSeq) f.classList.remove('on'); }, 90); }

/* ───────── final / campaña ───────── */
function endGame(state, me) {
  session.ended = true; if (document.exitPointerLock) document.exitPointerLock(); touch.show(false);
  const won = state.state === 'won'; window.__ended = state.state;
  const stats = `Oleada ${state.wave}/${state.waveTotal}\nTiempo ${Math.round(state.time)} s\n` + state.players.map((p) => `${p.name} ${p.id}: ${p.kills} bajas · ${p.score} pts`).join('\n');
  if (session.mode === 'solo' && session.campaign && won && session.campaign === 'm1') { // → interludio y Cámara Fractal
    renderer.setGuide(true); subs.play(Story.INTERLUDE, () => { renderer.setGuide(false); startSolo('m2', { campaign: 'm2' }); });
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
  arena: (m) => loadAnd(() => startSolo(m, { intro: false })),
} });
$('mkroom').addEventListener('click', () => startCoop(true, null, $('coopmap').value));
$('joinroom').addEventListener('click', () => startCoop(false, $('roomcode').value.trim()));
$('pause').addEventListener('click', (e) => { if (e.target.closest('.item.sel') || e.target.id === 'quit') return; if (session && session.touch) return; lockPointer(); });
$('resume').addEventListener('click', () => { if (session && session.touch) pauseTouch(false); else lockPointer(); });
$('sens').addEventListener('input', (e) => { touch.setSens(0.0009 * +e.target.value); mouseSens = 0.00044 * +e.target.value; });
$('sens0').addEventListener('input', (e) => { touch.setSens(0.0009 * +e.target.value); mouseSens = 0.00044 * +e.target.value; });
$('vol').addEventListener('input', (e) => sound.setVolume(+e.target.value / 10));
$('subsel').addEventListener('change', (e) => { $('sub').style.display = e.target.value === '1' ? '' : 'none'; });
$('quit').addEventListener('click', () => location.reload());
$('tomenu').addEventListener('click', () => location.reload());
$('again').addEventListener('click', () => {
  if (session.mode === 'coop') { session.net.send({ t: 'restart' }); return; }
  startSolo(session.campaign || session.map, { campaign: session.campaign, intro: false });
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !params.get('auto') && location.hostname !== 'localhost') navigator.serviceWorker.register('/sw.js').catch(() => {});

// Modos automáticos para pruebas visuales y de rendimiento: ?auto=m1&bot=1&wave=3&god=1
if (params.get('auto')) {
  startSolo(params.get('auto'), { bot: params.get('bot') === '1', wave: +params.get('wave') || 0, god: params.get('god') === '1', horde: params.get('horde') === '1', seed: +params.get('seed') || 7, skill: +params.get('skill') || 1.2, difficulty: +params.get('difficulty') || 1, intro: false });
  window.__session = session; window.__renderer = renderer;
}
window.__api = { ui, pad, get session() { return session; }, renderer, MONSTERS, touch, setQuality, get level() { return level; }, subs };
window.__frame = frame; window.__step = (ms) => frame(last + ms); window.__ui = ui; if (!params.get('cap')) requestAnimationFrame(frame);

// En un sitio estático (sin servidor) el cooperativo no está disponible: se avisa y se deshabilita.
fetch('health').then((r) => { if (!r.ok) throw new Error('sin servidor'); }).catch(() => {
  document.querySelectorAll('.coop button, .coop input, .coop select').forEach((x) => { x.disabled = true; });
  $('menuerr').textContent = 'Cooperativo no disponible acá: necesita el servidor (npm start). El modo solo funciona igual.'; $('menuerr').style.color = '#b9aee8';
});
