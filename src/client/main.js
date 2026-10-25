import { decodificar } from '../shared/host-build.js';
import { setActivo as setActivoLab } from './lab-activo.js';
import { CAMPAIGN_ORDER, CAMPAIGN_BOSSES, campaignNext } from '../sim/campaign.js';
import { nombreHuesped } from '../sim/desbloqueos.js';
import { OPERATIONS } from '../sim/operations.js';
import { SUPPORT } from '../shared/skill-path.js';
import { camaraInicial, essentialInteraction, essentialPower } from './essential-controls.js';
import { Game } from '../sim/game.js';
import { makeBot } from '../sim/bot.js';
import { WEAPONS, MONSTERS, ROLES, FRAGMENTS, CHARACTERS, UPGRADE_KINDS, WEAPON_MODS, WEAPON_MUTS, GAME_MODES, HABILIDADES } from '../sim/data.js';
import { comboAssist } from './combo-assist.js';
import { Equipo, asegurarHuesped, saveEquipo } from './equipo.js';
import { settings, setSetting, sensFromSlider, sliderFromSens } from './settings.js';
import { WEAPON_COLORS } from './shotfx.js';
import { createCombatHud } from './hud-combat.js';
import { createHuespedHud } from './hud-huesped.js';
import { createEvoHud, EVO_KEY } from './hud-evolucion.js';
import { createEvoChoice } from './evo-choice.js';
import { createNpcPanel, npcNear, dealText } from './mundo-vivo.js';
import { NPC_INFO } from '../sim/npcs.js';
import { JEFES } from '../sim/jefe-data.js';
import { jefeMemoria } from '../sim/jefes.js';   // jefes por arena (nombres, fases, cuerpo): jefes-fx.js
import { createTacticalHUD } from './tactical-hud.js';
import { createRadar } from './radar.js';
import { createMetaHud } from './meta-ui.js';
import { createEvoMenu } from './evo-menu.js';
import { ESSENCE_OF, WEAPON_ORGANS, CHAMP_ORGANS, LINEAGE, EVENTOS, ARENAS_VIVAS } from '../sim/data.js';
import * as Perfil from './perfil.js';
import { nuevoMatchId } from '../sim/ledger.js';   // cada partida lleva un matchId: cobrarla dos veces no suma (docs/RECOMPENSAS.md)
import { modeloResultados } from '../sim/resultados.js';
import { dibujarResultados } from './resultados-ui.js';   // pantalla final única (solo y coop)
import { ESPECIES as ESPECIES_FLORA, especieDe as especieDeFlora, HITOS as HITOS_FLORA, FN as FN_FLORA } from '../sim/flora-data.js';   // flora interactiva y Herbario (docs/FLORA.md)
import { MATERIALS, CALIDADES } from '../sim/items.js';
import { FAUNA, especiePorIndice, formaPorIndice } from '../sim/fauna-data.js';   // fauna consumible (carteles, sonido y Códice: faunaEvento)
import * as Tienda from './tienda.js';   // Tienda del Cambista (docs/TIENDA.md): aquí sólo el botiquín inicial
import * as Territorios from '../sim/bendiciones.js';
import { TITULOS } from '../sim/maestria.js';
import { createCaida } from './caida.js';
import { createBaseHud, recolectarDatos } from './base-hud.js';   // La Base (docs/BASE.md): HUD propio, mapa-hub en src/sim/base.js + src/client/env/base.js
import { MODOS, MODO_ESPERA, habSlots } from '../sim/modos.js';   // Disparo ↔ Melé en partida (docs/CONTROLES.md)
import { createBotin, nombreBotin } from './botin-hud.js';   // botín en partida (docs/INVENTARIO.md)
import { parseEq } from './items-vis.js';
import { MAPS } from '../sim/maps.js';
import { blocked } from '../sim/physics.js';
import { rotAround, norm, project, v3, cross, dot, sub, len } from '../sim/math.js';
import { Renderer } from './render.js';
import { Sound } from './audio.js';
import { sonarImpacto, hayMeleeConfirmado } from './impacto.js';   // AC-07: sonido de impacto sólo con colisión confirmada por la simulación
import { createCoopUI } from './coop-ui.js';   // Cooperativo: servidor, lobby e invitación (docs/COOP_ONLINE.md)
import { poseeHuesped as poseeHuespedSim } from '../sim/tienda.js';
import { LEVELS, initialClaridad, AutoQuality, isTouchDevice, isIOS, cfg } from './quality.js';
import { nieblaPorIndice as NIEBLAS_T } from '../sim/nieblas.js';   // nieblas de colores: nombre, color y función por índice
import * as Graficos from './graficos-ui.js';   // menú «Gráficos»: presets, resolución, efectos, FPS (graficos.js es la parte pura)
import { TouchControls } from './touch.js';
import * as Story from './story.js';
import { mostrarPrimerHuesped } from './primer-huesped.js';   // Sprint 1: «Elegí tu primer Huésped»
import { CHAPTER_FILMS } from './campaign-films.js';
import { iniciarTransferencia } from './transferencia.js';   // Cómic de transferencia: lectura manual, sin WebGL adicional
import { crearTutorialUI } from './tutorial-ui.js';   // Sprint 1: capa de interfaz del tutorial jugable (lógica en src/sim/tutorial.js)
import { uTime } from './shaders.js';
import { MenuUI, showLoading, trophy } from './ui.js';
import { Pad } from './gamepad.js';
import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const SIM_DT = 1 / 60;
const CAP = !!params.get('cap'); // captura de video determinista: el tiempo lo maneja tools/make-video.js
let capT = 0; const timers = [];
/** setTimeout que respeta el reloj virtual de la captura. */
const later = (fn, ms) => { if (CAP) timers.push({ at: capT * 1000 + ms, fn }); else setTimeout(fn, ms); };

/* ───────── calidad, dispositivo y controles ───────── */
let level = Graficos.preparar(params);   // nivel inicial: ?q= > lo guardado en el menú Gráficos > detección (teléfono ⇒ Baja, PC ⇒ Alta/Media)
const canvas = $('c');
const renderer = new Renderer(canvas, { level, pixelRatio: params.get('pr') ? +params.get('pr') : null });
renderer.applyClaridad(initialClaridad(settings().claridad, params)); // ajuste «Claridad» (Normal/Alta; ?claridad= lo fuerza)
const sound = new Sound();
if (renderer.comboFx) renderer.comboFx.setSound(sound);   // golpes del modo Combo (combo-fx.js): barrido e impacto escalados por golpe
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
/* MODO DE JUEGO «Shooter» o «Combo»: ajuste `mode` (se guarda en el navegador) o ?modo=combo|shooter en el enlace. Sólo los Huéspedes juegan Combo. */
{ const um = params.get('modo'); if (um === 'combo' || um === 'shooter') setSetting('mode', um); }
/** Modo elegido para ESTE Huésped (se recuerda por Huésped: settings.modes); sin elección propia vale el último modo usado (settings.mode). */
const modoElegido = (ch) => { const S = settings(), m = S.modes && S.modes[ch]; return m === 'combo' || m === 'shooter' ? m : S.mode; };
const gameMode = () => (modoElegido(myChar()) === 'combo' && CHARACTERS[myChar()] && CHARACTERS[myChar()].host ? 'combo' : 'shooter');
const NIVEL_PRESET = { low: 'baja', medium: 'media', high: 'alta' };
function setQuality(l, { save = true } = {}) {   // selector rápido de Opciones y bajada automática; el menú Gráficos es la vía completa
  if (!LEVELS[l] || l === level) return;
  if (save) { Graficos.elegirPreset(NIVEL_PRESET[l]); return; }
  level = l; $('qsel').value = $('qsel2').value = l; Graficos.nivelCambiado(l, { guardar: false }); renderer.applyQuality(l);
}
$('qsel').addEventListener('change', (e) => setQuality(e.target.value)); $('qsel2').addEventListener('change', (e) => setQuality(e.target.value));
$('ctrlsel').addEventListener('change', () => { try { localStorage.setItem('cristal.ctrl.v1', $('ctrlsel').value); } catch { /* ok */ } });
const auto = new AutoQuality((l) => { setQuality(l, { save: false }); banner(`Rendimiento bajo: gráficos en «${LEVELS[l].label}»`, 2500); }, () => (Graficos.G.fijadoPorUrl ? false : Graficos.bajarEscalaAuto()));
if (params.get('autoq') === '0') { auto.enabled = false; Graficos.G.autoUrl = false; }
Graficos.conectar({ renderer, auto, banner: (t, ms) => banner(t, ms), alNivel: (n) => { level = n; $('qsel').value = $('qsel2').value = n; } });

/* ───────── entrada de teclado/ratón ───────── */
const keys = new Set();
// iPhone: sin zoom por pellizco ni doble toque, sin menú de selección (importante al anclar a la pantalla de inicio)
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
let lastTap = 0; document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTap < 350) e.preventDefault(); lastTap = n; }, { passive: false });
const mouse = { dx: 0, dy: 0, fire: false, ping: false, esp: false, ads: false }; let pickReq = -1;
const NOLOCK = params.get('nolock') === '1';
const tacticalHUD = createTacticalHUD(document.body);
const minimapOpacity = document.getElementById('minimap-opacity');
minimapOpacity.value = Math.round((settings().minimapOpacity || .85) * 100);
minimapOpacity.oninput = () => setSetting('minimapOpacity', Number(minimapOpacity.value) / 100);
let wantWeapon = -1, locked = NOLOCK, session = null, last = performance.now(), mouseSens = 0.0022;
addEventListener('keydown', (e) => {
  if (typeof ui !== 'undefined' && (!session || session.menuAbierto) && ui.handleKey(e)) return;
  if (session && session.base && baseHud && baseHud.handleKey(e)) { e.preventDefault(); return; }   // La Base: panelitos (opciones 1-3, Esc/E cierran)
  if (session && !$('tutorial').classList.contains('hidden')) { if (['Enter', 'Space', 'Escape'].includes(e.code)) { e.preventDefault(); if (!e.repeat) ($('skillok') || $('tutok'))?.click(); } return; }
  keys.add(e.code);
  if (npcPanel && npcPanel.open) { // panel de un NPC: 1 / 2 eligen la oferta, Esc o E lo cierran (no se cambia de arma ni de tarjeta)
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') { npcPanel.choose(+e.code.slice(5) - 1); return; }
    if (e.code === 'Escape' || e.code === 'KeyE') { npcPanel.close(); return; }
  }
  if (e.code >= 'Digit1' && e.code <= 'Digit5') { const n = +e.code.slice(5) - 1; if (cardsOpen && n < 3) pickReq = n; else if (gameMode() !== 'combo') wantWeapon = n; }   // en Melé 1/2/3 son HAB.1/2/3 (no hay barra de armas)
  if (e.code === 'Tab') { e.preventDefault(); if (!e.repeat && session && !session.intro && !session.ended) cambiarModo(); }   // Tab = cambiar Disparo ↔ Melé
  if (e.code === 'KeyK' && session && !e.repeat) { setSetting('showKeys', !settings().showKeys); keyHint(true); }   // K = mostrar/ocultar la pista de teclas
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
addEventListener('wheel', (e) => { if (session && gameMode() !== 'combo') wantWeapon = (((session.mySlot || 0) + (e.deltaY > 0 ? 1 : -1)) % 5 + 5) % 5; });
addEventListener('mousemove', (e) => { if (locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; } });
document.addEventListener('pointerlockchange', () => {
  if (NOLOCK) return; locked = document.pointerLockElement === canvas; if (!locked && session) syncModeUI();
  if (session && !session.ended && !session.touch) $('pause').classList.toggle('hidden', locked || session.headless || !!session.intro || !!session.menuAbierto || !$('tutorial').classList.contains('hidden') || !!(baseHud && baseHud.open));
});
const lockPointer = () => { try { canvas.requestPointerLock(); } catch { /* sin pointer lock */ } };

const touch = new TouchControls($('touch'), {
  onPause: () => pauseTouch(true),
  onMode: () => cambiarModo(),
  onWeapon: (d) => { const w = (((session ? session.mySlot || 0 : 0) + d) % 5 + 5) % 5; return w; },
});
let tapSkip = 0;
$('touch').addEventListener('pointerdown', () => { if (session && session.intro) skipIntro(); }, true);
addEventListener('touchstart', () => { sound.init(); sound.resume(); }, { passive: true });

/* ───────── ayuda de puntería (todas las entradas: ratón, táctil y mando) ───────── */
const AIM_KEY = 'cristal.aim.v1'; let aimLevel = isTouchDevice() ? 2 : 1; try { const v = parseInt(localStorage.getItem(AIM_KEY), 10); if (v >= 0 && v <= 3) aimLevel = v; } catch { /* ok */ }
const aimSel = $('aimsel'); if (aimSel) { aimSel.value = String(aimLevel); aimSel.addEventListener('change', () => { aimLevel = +aimSel.value; try { localStorage.setItem(AIM_KEY, String(aimLevel)); } catch { /* ok */ } }); }
let npcPanel = null, npcCtx = { npc: null }, npcPrevUse = false;
/** Limbo vivo: el botón USAR / tecla E abre el panel del NPC cercano; el pedido `npc` viaja en UN solo input (la sim repite el trato si se mantiene). */
function npcInput(i) {
  if (!npcPanel) { try { npcPanel = createNpcPanel(document.body, { onToggle: () => touch.reset() }); } catch (err) { console.warn('Panel de NPC no disponible', err.message); npcPanel = { open: false, take() { return null; }, show() {}, close() {}, choose() {}, result() {}, setHint() {} }; } }
  const pressed = !!i.interact && !npcPrevUse; npcPrevUse = !!i.interact;
  if (pressed && npcCtx.npc && !npcPanel.open && !(session && session.faunaCerca)) npcPanel.show(npcCtx.npc.nk);   // (si hay un bicho de la fauna a mano, USAR / E lo come en vez de abrir el panel)
  i.autoc = !!(settings().faunaAuto || params.get('autofauna') === '1');   // fauna: comer solo al quedarse pegado (opcional)
  const rq = npcPanel.take(); if (rq) i.npc = rq;
  i.soft = !!settings().reducirGravedad;   // «Reducir efectos de gravedad»: la inversión llega como un empujón, sin giro de cámara
  return i;
}
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
const fxSel = $('fxsel'); if (fxSel) { try { fxSel.value = localStorage.getItem('cristal.reduceFx') === '1' ? '1' : '0'; } catch { /* ok */ } fxSel.addEventListener('change', () => { try { localStorage.setItem('cristal.reduceFx', fxSel.value); } catch { /* ok */ } }); }   // «Efectos de golpe»: reducidos = menos partículas, sacudida y hit-stop a la mitad, sin cámara lenta
const motionSel = $('motionsel'); if (motionSel) { try { motionSel.value = localStorage.getItem('cristal.reduceMotion') === '1' ? '1' : '0'; } catch { /* ok */ } motionSel.addEventListener('change', () => { try { localStorage.setItem('cristal.reduceMotion', motionSel.value); } catch { /* ok */ } }); }
/** Datos de la cámara para la simulación (en 3ª persona el disparo converge a la retícula). */
function camInput() { return renderer.third ? { third: true, side: settings().camSide || 1, dist: settings().camDist || 3.6 } : false; }
function learnedInput(i) {
  if (session) {
    i.support = session.touch ? !!i.esp : !!(keys.has('KeyQ') || keys.has('KeyG') || i.padSupport);
    i.compact = true;
    i.mov ||= !session.touch && keys.has('KeyF');
    for (const k of ['esp','s3','hab','ability']) i[k] = false;
  }
  return i;
}
function readInput() {
  if (session && session.touch) { touch.setMode(gameMode(), myChar()); const ti = touch.read(); ti.interact ||= tacticalHUD.held(); ti.cam = camInput(); ti.style = settings().style; ti.mode = gameMode(); evoWant(ti.evo || (evoHud && evoHud.held())); ti.evo = evoChoice ? evoChoice.value() : 0; ti.organ = organInput(); if (pickReq >= 0) { ti.pick = pickReq; pickReq = -1; } return learnedInput(npcInput(ti)); } // (las tarjetas de mejora también se eligen tocando)
  const zm = renderer.zoomKind || 0, adsM = keys.has('KeyX') || mouse.ads ? (zm === 2 ? settings().scopeMul : settings().adsMul) : 1, SENS = mouseSens * adsM;
  const i = {
    cam: camInput(), style: settings().style,
    mx: (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), mz: (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0),
    dyaw: mouse.dx * SENS, dpitch: -mouse.dy * SENS, jump: keys.has('Space'), fire: mouse.fire, ability: keys.has('KeyQ'), mov: keys.has('KeyF'), ads: keys.has('KeyX') || mouse.ads, crouch: keys.has('KeyC') || keys.has('ControlLeft'), esp: mouse.esp || keys.has('KeyG'), s3: keys.has('KeyZ'), ult: keys.has('KeyT'), reload: keys.has('KeyR'), melee: keys.has('KeyV'), evo: (evoWant(keys.has(EVO_KEY.code) || !!(evoHud && evoHud.held())), evoChoice ? evoChoice.value() : 0), organ: organInput(), pick: pickReq, interact: keys.has('KeyE') || tacticalHUD.held(), ping: keys.has('KeyB') || mouse.ping, dash: keys.has('ShiftLeft') || keys.has('ShiftRight'), weapon: wantWeapon,
  };
  i.mode = gameMode();   // Disparo: clic izq. dispara · clic der. o G = HAB.2 · F = HAB.1 · Z = HAB.3 · Q = equipo
  if (i.mode === 'combo') {   // Melé: clic izq. = ATAQUE 1 · clic der. = ATAQUE 2 · F/1 = HAB.1 · G/2 = HAB.2 · Z/Q/3 = HAB.3 (la simulación traduce HAB.3); E sigue siendo USAR
    i.a1 = mouse.fire; i.a2 = mouse.esp; i.fire = i.ability = false;
    i.mov = keys.has('KeyF') || keys.has('Digit1'); i.esp = keys.has('KeyG') || keys.has('Digit2'); i.s3 = keys.has('KeyZ') || keys.has('KeyQ') || keys.has('Digit3');
  }
  mouse.dx = mouse.dy = 0; wantWeapon = -1; pickReq = -1;
  const g = pad.read(padDt); // mando (DualSense / Xbox)
  if (g) {
    i.padSupport = g.esp;
    i.mx = Math.max(-1, Math.min(1, i.mx + g.mx)); i.mz = Math.max(-1, Math.min(1, i.mz + g.mz)); i.dyaw += g.dyaw * (g.ads ? (zm === 2 ? settings().scopeMul : settings().adsMul) : 1); i.dpitch += g.dpitch * (g.ads ? (zm === 2 ? settings().scopeMul : settings().adsMul) : 1); i.ads = i.ads || g.ads;
    i.fire = i.fire || g.fire; i.jump = i.jump || g.jump; i.dash = i.dash || g.dash; i.ability = i.ability || g.ability; i.mov = i.mov || g.mov; i.esp = i.esp || g.esp; i.s3 = i.s3 || g.s3; i.ult = i.ult || g.ult; i.reload = i.reload || g.reload; i.melee = i.melee || g.melee; i.interact = i.interact || g.interact; i.ping = i.ping || g.ping;
    if (g.next && !padLatch.next) i.weapon = (((session ? session.mySlot || 0 : 0) + 1) % 5 + 5) % 5; if (g.prev && !padLatch.prev) i.weapon = (((session ? session.mySlot || 0 : 0) - 1) % 5 + 5) % 5;
    if (cardsOpen) { if (g.next && !padLatch.next) pickReq = 1; if (g.prev && !padLatch.prev) pickReq = 0; if (g.jump && !padLatch.jump) pickReq = 2; if (pickReq >= 0) i.pick = pickReq; }
    padLatch.next = g.next; padLatch.prev = g.prev; padLatch.jump = g.jump;
    if (g.pause && !padLatch.pause && session && !session.touch) { document.exitPointerLock && document.exitPointerLock(); }
    padLatch.pause = g.pause; renderer.firing = renderer.firing || g.fire;
    if (i.mode === 'combo') { i.a1 = i.a1 || g.fire; i.a2 = i.a2 || g.melee || g.ads; i.fire = false; }   // mando en Melé: RT ataque 1 · B o LT ataque 2 · LB/RB/cruceta ↑ = HAB.1/2/3 (igual que en Disparo)
    if (g.mode && !padLatch.mode) cambiarModo(); padLatch.mode = g.mode;   // Select/Back = cambiar de modo
  }
  return learnedInput(npcInput(i));
}
const padLatch = { next: false, prev: false, pause: false, jump: false, mode: false }; let padDt = 0.016;

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
  if (me.md) { comboAssist(inp, state, me, { onTarget: session.onTarget }); return; }   // modo Combo: el ataque 1 se encadena solo (combo-assist.js)
  const h = v3(...me.h), st = settings().style || 'disparo'; let close = false;
  for (const m of state.monsters) { const d = { x: m.p[0] - me.pos[0], y: m.p[1] - me.pos[1], z: m.p[2] - me.pos[2] }, l = Math.hypot(d.x, d.y, d.z); if (l < (m.r || 1) + (st === 'melee' ? 4.2 : 3.2) && dot(norm(d), h) > 0.35) { close = true; break; } }
  session.simpleT = (session.simpleT || 0) + 1; const T = session.simpleT;
  if (close) { inp.fire = false; inp.melee = (T % 24) < 10; return; }            // de cerca: golpes ligeros (pulsar y soltar)
  if (!session.onTarget) return;
  if (st === 'disparo') { if (!(me.rl > 0)) inp.fire = true; }
  else if (st === 'habilidad') {                                                 // estilo habilidades: lanza sus poderes solo cuando están listos
    if (!(me.ec > 0)) inp.esp = (T % 20) < 4; else if (!(me.s3c > 0)) inp.s3 = (T % 20) < 4; else if (!(me.rl > 0)) inp.fire = true;
    if ((me.ud || 0) <= 0) inp.ult = (T % 30) < 4;
  }
  // estilo melé: no dispara solo; el jugador se acerca y el golpe sale solo
}
const aimEff = () => (settings().simple ? 3 : aimLevel);

/* ───────── sesión y campaña ───────── */
function startSolo(mapId, opts = {}) {
  asegurarHuesped(true);   // el Huésped tiene que ser tuyo (inicial o desbloqueado); un enlace directo sin Huésped inicial recibe el actual
  // Sprint 1: la primera vez que se juega «Islas — Despertar» hay cinemática de transferencia + tutorial jugable (se guarda; ?tutorial=1 lo fuerza, ?tutorial=0 lo apaga)
  const conTutorial = !opts.practice && !opts.horde && !opts.bot && params.get('tutorial') !== '0' && (params.get('tutorial') === '1' || opts.tutorial || (opts.campaign === 'm1' && !params.get('auto') && Perfil.tutorialPendiente()));
  const conCine = (opts.campaign === 'm1' || (conTutorial && !Perfil.tutorialEstado().cine)) && opts.intro !== false && !params.get('auto') && !params.get('skipintro') && params.get('cine') !== '0';
  const intro = (opts.intro !== false && !params.get('auto') && !params.get('skipintro')) || conCine;
  const game = new Game({ mapId, campaign: !!opts.campaign, operation: !opts.practice && !opts.horde, seed: opts.seed || (Math.random() * 1e9) | 0, difficulty: opts.difficulty || 1, calm: intro ? 6 : 4, magazines: true, practice: !!opts.practice, jefeMem: leerMemoriaJefe(mapId), skillLevel: opts.practice ? null : Perfil.perfil().skillLevel || 0, tutorial: conTutorial ? { desde: Perfil.tutorialEstado().paso } : false });
  const charJ = opts.char || Equipo.char, ppJ = Perfil.paraPartida(charJ); if (opts.lab) ppJ.lab = opts.lab;   // Laboratorio › «Probar»: el diseño sin guardar entra al Campo de pruebas (opts.char = 'laboratorio', opts.lab = texto VB1)
  if (charJ === 'laboratorio' && ppJ.lab) { try { const d = decodificar(ppJ.lab); if (d.ok) setActivoLab(d.build); } catch { /* sin diseño: aspecto por defecto */ } }
  const p = game.addPlayer(Story.NAME, null, { char: charJ, slots: Equipo.slots, ...ppJ, style: settings().style, mode: gameMode(), kit: opts.practice ? 0 : Tienda.usarBotiquin() }); // evolución y arma fusionada del perfil (perfil.js)
  if (opts.wave) { game.wave = opts.wave - 1; game.phaseT = 0.1; }
  if (opts.god) p.godmode = true;
  session = { matchId: nuevoMatchId(), initialSkills: game.skillLevel, practice: !!opts.practice, horde: !!opts.horde, mode: 'solo', game, pid: p.id, acc: 0, touch: useTouch() && !opts.bot, bot: opts.bot ? makeBot(game, p.id, { seed: 5, skill: opts.skill || 1.2 }) : null, headless: !!opts.bot, ended: false, map: mapId, campaign: opts.campaign || null, intro: null, tutorial: conTutorial };
  if (opts.practice && charJ === 'laboratorio') { if (window.__labMedidor) window.__labMedidor.parar(); import('./lab-prueba.js').then((m) => { window.__labMedidor = m.iniciarMedidor(() => session, { volver: () => { try { sessionStorage.setItem('vortex.lab.volver.v1', '1'); } catch { /* nada */ } location.reload(); } }); }); }   // Laboratorio › Probar: medidor de daño y regreso al editor
  enter(mapId);
  if (conCine) beginIntro('transfer'); else if (intro) beginIntro(opts.campaign && opts.campaign !== 'm1' ? 'short' : 'full'); else finishIntro();
}

/** La sala empieza (o se reconecta): coop-ui.js entrega la red ya conectada. */
function startCoopGame(net, m) {
  if (session && session.mode === 'coop' && session.net === net) { session.pid = m.pid; renderer.camInit = false; session.look = null; return; }   // volvió tras un corte: sigue la misma partida
  asegurarHuesped();   // el Huésped tiene que ser tuyo (Tienda)
  session = { matchId: nuevoMatchId(), mode: 'coop', net, pid: m.pid, map: m.map, ended: false, look: null, touch: useTouch(), intro: null };
  net.welcomed = (w) => { session.map = w.map; session.pid = w.pid; renderer.camInit = false; session.look = null; session.ended = false; $('end').classList.add('hidden'); };
  net.onFin = () => { if (session && session.bankWait) { session.bankWait = false; bankProfile(session.lastMe, session.lastState); endGame(session.lastState, session.lastMe); } };
  net.onError = (msg) => banner(msg, 4000);
  enter(net.map);
  if (!params.get('skipintro') && !m.reanudado) beginIntro('short'); else finishIntro();   // si volvés tras recargar la página, no se repite la intro
}

function enter(mapId) {
  if (typeof ui !== 'undefined') ui.desdeBase = null;   // (si venías de la Base, ya no hay a dónde volver con «Volver»)
  document.body.classList.toggle('en-base', mapId === 'base'); if (baseHud && mapId !== 'base') baseHud.mostrar(false);
  $('menu').classList.add('hidden'); $('end').classList.add('hidden'); $('hud').classList.remove('hidden'); document.body.classList.add('playing');
  sound.init(); sound.resume(); sound.startMusic(mapId);
  renderer.setMap(mapId); renderer.collMap = (session && session.game) ? session.game.map : null; renderer.camInit = false; renderer.setThird(params.get('cam') ? params.get('cam') === 'third' : mapId === 'base' || camaraInicial(gameMode(), !!settings().camAuto));
  buildWeaponHud();
  touch.show(!!session.touch); touch.setMode(gameMode(), myChar()); keyHint();
  if (!session.touch && !session.headless && !NOLOCK && !params.get('auto')) lockPointer(); // requiere gesto del usuario
  if (session.touch && screen.orientation && screen.orientation.lock) { try { screen.orientation.lock('landscape').catch(() => {}); } catch { /* iOS no lo permite */ } }
}

/* ───────── intro: despertar de la última conciencia humana ───────── */
let cine = null;
function beginIntro(kind) {
  session.intro = kind; $('hud').classList.add('hidden'); if (session.touch) touch.show(false);
  if (kind === 'transfer') { const cur = session; renderer.setGuide(true); cine = iniciarTransferencia({ char: myChar(), subs, sound, onDone: () => { cine = null; if (session !== cur) return; renderer.setGuide(false); Perfil.cineVista(); finishIntro(); } }); return; }
  if (!session.campaign) { startWake(Story.wakeForMap(session.map, false)); return; }
  if (kind === 'full') startWake(Story.WAKE);
  else startWake(Story.wakeForMap(session.map));
}
function startWake(lines) {
  if (!session || !session.intro) return;
  if (cine) { cine.stop(); cine = null; } $('cine').classList.add('hidden');
  renderer.setGuide(true); renderer.startWake(4); sound.heartbeat();
  subs.play(lines, finishIntro);
}
/** (la transferencia tiene su propio «Saltar» con confirmación) */
function skipIntro(force) { if (!session || !session.intro || session.intro === 'transfer' || (session.prologo && !force)) return; subs.cb = null; subs.skip(); if (cine) { cine.stop(); cine = null; } $('cine').classList.add('hidden'); finishIntro(); }
/** Ayuda de controles: aparece la primera vez (y desde Pausa > Ver controles). Pausa en solitario; en cooperativo la sala continúa. */
function explainSkill(level) {
  const C = CHARACTERS[myChar()], power = level === 1 ? C[SUPPORT[myChar()]] : C.ult;
  if (!power) return;
  const el = $('tutorial'), current = session; current.paused = true; touch.reset(); keys.clear(); mouse.fire = mouse.esp = false;
  if (!current.touch && !NOLOCK) document.exitPointerLock?.();
  el.innerHTML = `<h4>${level === 1 ? 'APOYO DESBLOQUEADO' : 'ULTI DESBLOQUEADA'}</h4><p><b>${power.name}</b></p><p>${power.desc || ''}</p><p>${level === 1 ? 'Usalo para preparar un grupo de enemigos y continuar con disparos o melee. Se recupera después de cada uso.' : 'No consume maná ni carga por daño. Tras usarla, esperá el cooldown indicado en su botón.'}</p><p><b>${current.touch ? (level === 1 ? 'Tocá APOYO' : 'Tocá ULTI') : (level === 1 ? 'Q o G · apoyo / mando RB' : 'T · ulti / mando cruceta ↓')}</b> · El mismo poder en ambos modos.</p><button id="skillok" type="button">Entendido · continuar</button>`;
  el.classList.remove('hidden');
  $('skillok').onclick = () => { el.classList.add('hidden'); if (session === current) { current.paused = false; current.skillExplained = level; touch.reset(); if (!current.touch && !NOLOCK) lockPointer(); } };
}
function showTutorial(force = false) {
  let seen = false; try { seen = localStorage.getItem('cristal.tut.v2') === '1'; } catch { /* ok */ }
  if ((seen && !force) || !session || session.headless) return;
  const touchUI = !!session.touch, el = $('tutorial');
  const rows = touchUI
    ? [['MOVER / MIRAR', 'dos pulgares', 'Izquierda: caminar. Doble toque izquierdo: saltar. Derecha: girar la cámara. Tocá el nombre del arma para cambiarla.'], ['ATACAR', 'tocar / mantener', 'Melé: toque = golpe ligero; mantener = ataque secundario. Disparo: mantener dispara.'], ['APOYO / ULTI', 'se desbloquean jugando', 'Tras la primera oleada: apoyo. Tras la tercera: ulti. Cada uno tendrá su propio botón y explicación.'], ['DEFENSA', 'primer poder · disponible desde el inicio', 'Su imagen representa la movilidad o defensa de tu huésped. El número indica segundos de espera. Cambiá Disparo / Melé arriba.']]
    : [['WASD / RATÓN', 'mover / mirar', 'Clic izquierdo: atacar. Espacio: saltar.'], ['TAB', 'cambiar modo', 'Disparo: primera persona. Melé: tercera persona.'], ['F / Q / T', 'defensa / apoyo / ulti', 'F: movilidad o defensa desde el inicio. Apoyo tras la primera oleada; ulti tras la tercera. Mismos poderes en Disparo y Melé. E: interactuar.'], ['PAUSA', 'más controles', 'Consultá las acciones adicionales y los ajustes cuando los necesites.']];
  const op = session.game?.operation || session.lastState?.operation && OPERATIONS[session.map];
  const chapter = session.campaign ? Story.chapterBrief(session.map) : Story.independentBrief(session.map);
  el.innerHTML = `<h4>${chapter.title}</h4><p>${chapter.context}</p><p><b>${chapter.task}</b></p><p>Al lograrlo: ${chapter.reward}</p><div class="trows">${rows.map((r) => `<div><b>${r[0]}</b><i>${r[1]}</i><span>${r[2]}</span></div>`).join('')}</div><button id="tutok" type="button">Entendido</button>`;
  if (force && session.game?.skillLevel != null) { const C = CHARACTERS[myChar()], level = session.game.skillLevel; const info = document.createElement('div'); for (const [n,def,key] of [[0,C.mov,'F / DEFENSA'],[1,C[SUPPORT[myChar()]],'Q / APOYO'],[2,C.ult,'T / ULTI']]) { if (!def) continue; const p = document.createElement('p'); p.textContent = `${def.name} · ${level >= n ? key + ': ' + def.desc : 'Se desbloquea tras la oleada ' + (n === 1 ? 1 : 3)}`; info.appendChild(p); } el.insertBefore(info, $('tutok')); }
  const tutSession = session, wasPaused = session.paused; if (session.mode === 'solo') session.paused = true; touch.reset(); if (!session.touch && !NOLOCK && document.exitPointerLock) document.exitPointerLock();
  el.classList.remove('hidden'); const close = () => { if (session === tutSession && session.mode === 'solo') session.paused = wasPaused; el.classList.add('hidden'); if (session === tutSession) { if (wasPaused) $('pause').classList.remove('hidden'); else if (!session.touch && !NOLOCK) lockPointer(); } try { localStorage.setItem('cristal.tut.v2', '1'); } catch { /* ok */ } };
  $('tutok').onclick = close;
}
function finishIntro() {
  if (!session) return; session.intro = null; renderer.setGuide(false); renderer.wakeT = renderer.wakeDur = 0; $('hud').classList.remove('hidden');
  if (session.touch) touch.show(true); else if (!session.headless && !NOLOCK && !params.get('auto') && !locked) lockPointer();
  banner(session.game?.operation ? `${session.game.operation.title} · ${session.game.operation.steps[0].title}` : Story.MAP_BANNER[session.map] || '', 6000); if (!session.tutorial) showTutorial(!!session.campaign);   // con tutorial jugable no hace falta la tarjeta de controles
  if (session.tutorial && !session.tutUI) session.tutUI = crearTutorialUI({ THREE, renderer, sound, onSaltar: () => { const g = session && session.game; if (g && g.tutorial) g.tutorial.saltar(); } });
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
const jfxCtx = { banner, flash: () => flash(), sound, get pid() { return session ? session.pid : 0; } };   // lo que necesita jefes-fx.js para avisar y sonar

function pauseTouch(on) { if (!session) return; syncModeUI(); session.paused = on; $('pausehint').textContent = 'Tocá «Continuar» para seguir'; $('pause').classList.toggle('hidden', !on); if (on) touch.reset(); }

/* ───────── modo de prueba de rendimiento ───────── */
const HORDE_KINDS = ['astilla', 'geoda', 'prisma', 'lente', 'cuarzo', 'espejo', 'racimo', 'graviton', 'obelisco', 'aurora', 'ariete', 'espiral'];
function hordeTopUp(g) {
  const ref = g.players[0]; g.phaseT = 1e9; g.queue = [];
  for (const m of g.monsters) { m.hp = m.maxhp = 1e9; }
  while (g.monsters.length < 88) { const k = HORDE_KINDS[g.monsters.length % HORDE_KINDS.length], def = MONSTERS[k]; g.spawnMonster(k, def.fly ? g.map.spawnAir(g.rng, ref.pos, ref.up) : g.map.spawnGround(g.rng, ref.pos)); }
}

/* ───────── LA BASE · «El Santuario» (docs/BASE.md) ───────── */
let baseHud = null;
/** Entra a la Base: un mapa-hub caminable, sin oleadas ni enemigos. USAR (E) en una estación abre la pantalla de siempre (Forja, Tienda, Huésped…). */
function startBase() {
  asegurarHuesped(true);
  const game = new Game({ mapId: 'base', seed: 1, calm: 0 });
  const pp = Perfil.paraPartida(Equipo.char); pp.equip = (pp.equip || []).filter((e) => e.s !== 'melee' && e.s !== 'gun'); pp.melee = undefined;   // en la Base no hay armas desplegadas: se ve la armadura y las reliquias, no el arma
  const p = game.addPlayer(Story.NAME, null, { char: Equipo.char, slots: Equipo.slots, ...pp, style: settings().style, mode: 'shooter' });
  session = { base: true, practice: false, horde: false, mode: 'solo', game, pid: p.id, acc: 0, touch: useTouch(), bot: null, headless: false, ended: false, map: 'base', campaign: null, intro: null, menuAbierto: false, datosT: 9 };
  enter('base');
  $('hud').classList.add('hidden'); $('end').classList.add('hidden');
  if (!baseHud) baseHud = createBaseHud({
    sound,
    onAbrir: (spec) => baseAbrir(spec),
    onPractica: () => loadAnd(() => startSolo('m1', { intro: false, practice: true })),
    onMenu: () => baseAbrir({ pantalla: 'main' }),
    onSalir: () => { const u = new URL(location.href); for (const k of ['state', 'auto', 'bot', 'wave', 'god', 'horde', 'look']) u.searchParams.delete(k); location.href = u.href; },
    onPanel: (abierto) => { if (abierto) { if (document.exitPointerLock) document.exitPointerLock(); touch.reset(); const p = session && session.game.players[0]; if (p) { p.input.interact = false; p.interactPrev = false; } } else if (session && session.base && !session.touch) lockPointer(); },
    onCambio: () => { if (session) session.datosT = 9; },
  });
  baseHud.mostrar(true);
  if (!session.touch && !NOLOCK && !locked) { $('pausehint').textContent = 'Hacé clic para entrar al Santuario'; $('pause').classList.remove('hidden'); }
  if (!Perfil.tutorialBaseVisto()) later(() => { if (session && session.base) baseHud.tutorial(!!session.touch); }, 900);
  window.__session = session; window.__renderer = renderer;
}
/** Abre una pantalla del menú (Tienda, Inventario/Forja, Huésped, Territorios…) encima de la Base. «Volver» (o Esc) en la primera pantalla cierra el menú y vuelve al mapa. */
function baseAbrir(spec) {
  if (!session || !session.base) return;
  session.menuAbierto = true; session.paused = true; if (document.exitPointerLock) document.exitPointerLock(); touch.show(false); touch.reset();
  { const p = session.game.players[0]; if (p) { p.input.interact = false; p.interactPrev = false; } }   // (que un USAR apretado al abrir no quede «pegado» y se pierda el próximo)
  baseHud.mostrar(false); $('pause').classList.add('hidden');
  $('menu').classList.remove('hidden'); document.body.classList.remove('playing'); ui.active = true; ui.desdeBase = baseCerrar; ui.stack = []; ui.screen = 'base';
  ui.show(spec.pantalla || 'main', false);
  if (spec.tab && ui.iv && ui.iv.setTab) ui.iv.setTab(spec.tab);
  if (spec.pantalla === 'arenas') ui.stack = [];
}
function baseCerrar() {
  if (!session || !session.base) return;
  session.menuAbierto = false; session.paused = false; ui.desdeBase = null; $('menu').classList.add('hidden'); document.body.classList.add('playing'); $('hud').classList.add('hidden');
  baseHud.mostrar(true); touch.show(!!session.touch); session.datosT = 9; if (!session.touch) lockPointer();
}
/** Un cuadro de la Base: entrada → simulación → eventos (estación / habla) → dibujo → HUD propio. */
function baseFrame(dt) {
  const g = session.game, paused = (!locked && !session.touch) || session.paused || session.menuAbierto || !!(baseHud && baseHud.open);
  if (session.menuAbierto) for (const a of pad.menuEvents(dt)) ui.act(a);
  if (!paused) {
    g.setInput(session.pid, readInput()); session.acc += dt;
    while (session.acc >= SIM_DT) { session.acc -= SIM_DT; g.step(SIM_DT); }
  }
  const state = g.snapshot(); if (paused) state.events = [];
  if (!params.get('look')) session.look = soloLook(g, session.pid);
  const me = state.players[0]; session.lastMe = me; renderer.firing = false;
  for (const e of state.events) {
    if (e.pid !== session.pid) continue;
    if (e.t === 'estacion') baseHud.activar(e.id); else if (e.t === 'habla') baseHud.hablar(e.id, e.tx);
  }
  session.datosT += dt;
  if (session.datosT > 0.4 && renderer.baseFx) {   // lo guardado → lo que se ve (cubas, capullos, jardín, avisos)
    session.datosT = 0; try { const c = baseHud.cerca; renderer.baseFx.setDatos({ ...recolectarDatos(Perfil.perfil(), Date.now(), Equipo.char), cerca: c && c.tipo === 'estacion' && !baseHud.open ? { x: c.def.x, z: c.def.z, r: c.def.r * 0.62 } : null }); } catch (err) { console.warn('Base: datos', err.message); }
  }
  if (me && renderer.camera) { const r = new (renderer.camera.position.constructor)(1, 0, 0).applyQuaternion(renderer.camera.quaternion); sound.setListener({ x: me.pos[0], y: me.pos[1], z: me.pos[2] }, r); }
  sound.intensity = 0;
  renderer.render(state, dt, session.pid, session.look);
  baseHud.update(me, dt, !!session.touch);
  touch.setContext({ use: !!baseHud.cerca && !baseHud.open, ult: false, evo: false });
}

/* ───────── bucle principal ───────── */
function frame(now) {
  if (!CAP) requestAnimationFrame(frame);
  if (!CAP && now - last < 1000 / Graficos.fpsTope() - 4) return;   // límite de FPS del menú Gráficos (30 / 60): se salta el cuadro sin perder tiempo de simulación
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now; // nunca negativo (carga lenta)
  if (CAP) { capT += dt; window.__capT = capT; for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= capT * 1000) { const f = timers[i].fn; timers.splice(i, 1); f(); } if (cine && cine.tick) cine.tick(dt); }
  document.body.classList.toggle('cam3', !!renderer.third);   // en 3.ª persona el contador de combo se corre a un costado (no tapa al héroe)
  { const q = $('camquick'); if (q) { q.classList.toggle('hidden', !session || !!session.intro || !!session.paused); q.classList.toggle('third', !!renderer.third); } }
  window.__fps = (window.__fps || 60) * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
  uTime.value += 0; subs.update(dt); padDt = dt;
  if (!session || session.base || session.prologo || session.intro || session.ended || session.paused || (!locked && !session.touch)) tacticalHUD.update(null, null, false);
  // El cómic cubre toda la pantalla: no renderizar el mundo ni simular bajo las viñetas.
  if (cine && session?.intro === 'transfer') {
    for (const a of pad.menuEvents(dt)) {
      const selector = a === 'ok' || a === 'right' ? '[data-next]' : a === 'left' ? '[data-prev]' : a === 'back' ? '.tr-skip' : null;
      if (selector) document.querySelector('#transfer ' + selector)?.click();
    }
    return;
  }
  if (session && session.prologo) { if (!params.get('prologo_manual')) session.prologo.tick(dt); return; } // prólogo 3D: dibuja él mismo
  if (!session) { for (const a of pad.menuEvents(dt)) ui.act(a); menuSpin(dt); return; }
  if (session.base) { baseFrame(dt); return; }   // La Base: su propio cuadro, sin oleadas ni HUD de combate
  if (session && !session.touch && (!locked || session.ended) && !session.headless) for (const a of pad.menuEvents(dt)) { if (a === 'ok' && !$('pause').classList.contains('hidden')) lockPointer(); if (a === 'back' && !$('end').classList.contains('hidden')) location.reload(); }
  if (!$('tutorial').classList.contains('hidden')) { for (const action of pad.menuEvents(dt)) if (action === 'ok' || action === 'back') { ($('skillok') || $('tutok'))?.click(); break; } }
  auto.tick(dt, level);
  let state = null;
  if (session.mode === 'solo') {
    const g = session.game, paused = (!locked && !session.headless && !session.touch) || session.paused || !!session.intro;
    const L = !session.bot ? lite(g) : null;
    if (!paused && !session.ended) {
      // La entrada se lee UNA vez por cuadro y se entrega al simulador enseguida (acumula el giro hasta el próximo paso fijo):
      // el giro nunca espera a que toque un paso de 60 Hz y la cámara lo muestra en el mismo cuadro (ver soloLook).
      if (!session.bot) { const inp = readInput(); if (window.__botInput) Object.assign(inp, window.__botInput(g));   /* gancho SÓLO de pruebas (tests/onboarding-browser.test.js): un piloto automático decide la entrada */
        if (L) { assistAim(inp, L, L.players[0], dt, inp.fire); simpleAssist(inp, L, L.players[0]); } g.setInput(session.pid, inp); }
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
    if (g.skillLevel !== null && !session.practice) Perfil.guardarHabilidades(g.skillLevel);
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
  if (me && me.sk != null && !session.intro && !session.headless && !session.paused && session.game?.phase === 'intermission' && $('tutorial').classList.contains('hidden')) {
    session.skillExplained ??= session.initialSkills || 0;
    if (me.sk > session.skillExplained) explainSkill(session.skillExplained + 1);
  }
  if (me) { session.lastMe = me; session.lastWave = state.wave; } // para guardar los núcleos y la maestría al salir (bankProfile)
  if (params.get('look') === 'boss' && me) {
    const b = state.monsters.find((m) => m.k === 'coloso' || m.k === 'madre' || m.k === 'argos');
    if (b) { const up = v3(...me.up), d = norm(v3(b.p[0] - me.pos[0], b.p[1] - me.pos[1], b.p[2] - me.pos[2])), h = norm(project(d, up), v3(...me.h)); session.look = { h: [h.x, h.y, h.z], pitch: Math.asin(Math.max(-1, Math.min(1, d.x * up.x + d.y * up.y + d.z * up.z))) }; }
  }
  session.myWeapon = me ? me.w : 0;
  if (me && me.char && session.handChar !== me.char && renderer.vm && renderer.vm.setHandStyle) { session.handChar = me.char; try { renderer.vm.setHandStyle(me.char); } catch { /* estilo de mano no disponible */ } }
  if (me && renderer.vm && renderer.vm.setUpgrades) me.sl.forEach((w, i) => { const u = me.ug[i]; renderer.vm.setUpgrades(w, u ? { dmg: u[0], rate: u[1], mag: u[2], mod: u[3] || null } : { dmg: 0, rate: 0, mag: 0, mod: null }); });
  if (me && me.wg && renderer.vm && renderer.vm.setOrgans) me.sl.forEach((w, i) => renderer.vm.setOrgans(w, me.wg[i] || [])); // órganos que crecen en cada arma (organs-vis.js)
  if (me && renderer.vm && renderer.vm.setItemGun) { const ig = me.ig ? parseEq(me.eq).find((e) => e.id === me.ig) : null, wid = ig ? WEAPONS.findIndex((w) => w.id === ig.it.g.base) : -1; for (const w of me.sl) renderer.vm.setItemGun(w, w === wid ? ig.id : '', ig ? ig.fase : 0); }   // arma de disparo de un objeto (items-vis.js)
  touch.zoomKind = renderer.zoomKind || 0;
  renderer.guideTalk = subs.talking;
  renderer.firing = !!(session.touch ? touch.fire : mouse.fire) && gameMode() !== 'combo';
  if (session.tutUI) session.tutUI.update(state.tut, dt, { touch: !!session.touch, combo: gameMode() === 'combo' });
  renderer.render(state, dt, session.pid, session.look);
  try { if (!botin) botin = createBotin(THREE, renderer.scene, $('hud')); botin.update(state, me, dt); } catch (err) { if (!window.__botinErr) { window.__botinErr = err; console.warn('Botín:', err.message); } botin = botin || { update() {}, event() {} }; }
  audioAndHud(state, me, dt);
  if (!session.ended && (state.state === 'won' || state.state === 'lost')) { if (session.mode === 'coop' && !session.net.fin && (session.endWait = (session.endWait || 0) + dt) < 2) { session.lastState = state; session.lastMe = me; session.bankWait = true; } else { session.bankWait = false; endGame(state, me); } }
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

/** Fauna consumible: carteles cortos con humor, sonido y Códice (sólo para el jugador propio; las criaturas de los demás suenan bajito). */
/** Flora interactiva (docs/FLORA.md): sonidos mínimos, carteles cortos y el Herbario del perfil. Los dibujos de los efectos los pone flora-fx.js. */
const FLORA_SONIDO = { cura: 'cura', escudo: 'cura', energia: 'cura', muerde: 'muerde', ata: 'ata', pincha: 'pincha', estalla: 'estalla', suelta: 'nube', refleja: 'refleja', arde: 'arde', hiela: 'hiela', rompe: 'hiela', cosecha: 'cosecha', rota: 'crujido', marchita: 'marchita', florece: 'brota', rara: 'rara', arma: 'aviso' };
function floraEvento(e, mine, me) {
  if (!session || session.intro) return;
  const S = especieDeFlora(e.sp), k = FLORA_SONIDO[e.a];
  if (k && (e.a !== 'marchita' || (me && Math.hypot(e.p[0] - me.pos[0], e.p[2] - me.pos[2]) < 12))) sound.flora(k, e.p);
  if (e.a === 'rara' && S) banner(`✨ ¡Brotó una planta RARA: ${S.nombre}! Dura poco: cosechala con USAR.`, 3200);
  else if (e.a === 'cura' && mine && S) banner(`${S.nombre}: +${Math.round(e.hp || 0)} vida · +${Math.round(e.sh || 0)} escudo`, 1400);
  else if (e.a === 'energia' && mine && S) banner(`${S.nombre}: definitiva y habilidades recargadas`, 1500);
  else if (e.a === 'escudo' && mine && S) banner(`${S.nombre}: escudo y −20 % de daño`, 1500);
  else if (e.a === 'cosecha' && mine && S) {
    banner(`🌿 Cosechaste ${e.n}× ${MATERIALS[e.m] ? MATERIALS[e.m].name : e.m} (${CALIDADES[Math.max(0, Math.min(3, e.q | 0))]})`, 1900);
    try { for (const h of Perfil.cosechaPlanta(S.id)) later(() => banner(`📖 Herbario: «${HITOS_FLORA[h].nombre}» (${HITOS_FLORA[h].txt})`, 2800), 2000); } catch { /* sin perfil */ }
  } else if (e.a === 'rota' && mine && S) banner(`${S.nombre} destruida: ${e.n}× ${MATERIALS[e.m] ? MATERIALS[e.m].name : e.m}`, 1500);
  else if (e.a === 'refleja' && S) { /* sólo efecto y sonido */ }
}
/** Descubrimientos del Herbario: la primera vez que una especie está a la vista (≤ 14 m). */
function floraDescubre() {
  if (!renderer.flfx || !session || session.intro) return;
  session.floraVistas = session.floraVistas || new Set();
  for (const id of renderer.flfx.cerca) {
    if (session.floraVistas.has(id)) continue; session.floraVistas.add(id);
    const S = ESPECIES_FLORA[id]; if (!S) continue;
    try { const r = Perfil.verPlanta(id); if (r.nuevo) { sound.flora('descubre', null); banner(`🌿 Nueva planta en el Herbario: ${S.nombre} (${FN_FLORA[S.fn].toLowerCase()})\n${S.desc}`, 3400); for (const h of r.hitos) later(() => banner(`📖 Herbario: «${HITOS_FLORA[h].nombre}» (${HITOS_FLORA[h].txt})`, 2800), 3500); } } catch { /* sin perfil */ }
  }
}
function faunaEvento(e, mine, me) {
  if (!session || session.intro) return;
  const sp = especiePorIndice(e.sp), F = formaPorIndice(e.f), at = e.p || null;
  if (e.ph === 'come') {
    sound.fauna('come', at, e.f);
    if (!mine) return;
    let tx = F ? `${F.icono} ${F.nombre}${e.rf ? ' (renovada)' : ''}` : '', ex = '';
    if (sp && !e.rf && !e.h) ex = sp.frase;
    if (e.h && F) { tx = `¡HÍBRIDO! ${F.icono} ${F.nombre}`; ex = F.desc; }
    banner(`${tx}${ex ? '\n' + ex : ''}`, e.h ? 3600 : 2600);
    try { if (sp) { const r = Perfil.registrarFauna(sp.id, e.h && F && F.hib ? F.id : null); if (r && r.nuevo) later(() => banner(`📖 Nueva especie en el Códice: ${sp.nombre}`, 2600), 2700); else if (r && r.hito) later(() => banner(`📖 ${sp.nombre}: hito de ${r.hito.n} comidas · ${r.hito.txt}`, 3000), 2700); } } catch (err) { console.warn('Códice de Fauna:', err.message); }
  } else if (e.ph === 'rara') { if (sp && session.lastMe) { sound.fauna('rara', at); banner(`✨ ¡Una criatura RARA cerca: ${sp.nombre}!`, 2600); } }
  else if (e.ph === 'fin') { if (mine) { sound.fauna('fin', null); banner(`${F ? F.icono + ' ' + F.nombre : 'La metamorfosis'} se acaba… ¡volvés a ser vos!`, 2000); } }
  else if (e.ph === 'muerde') { if (mine) { sound.fauna('muerde', at); banner(`¡${sp ? sp.nombre : 'Un bicho'} te mordió! Mirá dónde pisás`, 1800); } }
  else if (e.ph === 'remate' || e.ph === 'devora') sound.fauna(e.ph, at, e.f);
  else if (e.ph === 'fase' && mine) sound.fauna('fase', at);
}
function audioAndHud(state, me, dt) {
  if (!combatHud) { try { combatHud = createCombatHud($('hud'), { sound }); } catch (err) { console.warn('HUD de combate no disponible', err.message); combatHud = { onEvent() {}, update() {} }; } }
  if (!caida) { try { caida = createCaida({ renderer, root: $('hud'), sound }); } catch (err) { console.warn('Percepción de caída no disponible', err.message); caida = { onEvent() {}, update() {} }; } }
  $('cross').classList.toggle('lock', !!session.onTarget);
  if (me && renderer.camera) { const r = new (renderer.camera.position.constructor)(1, 0, 0).applyQuaternion(renderer.camera.quaternion); sound.setListener({ x: me.pos[0], y: me.pos[1], z: me.pos[2] }, r); }
  sound.intensity += (Math.min(1, state.monsters.length / 25) - sound.intensity) * Math.min(1, dt);
  floraDescubre();
  session.floraUsar = !!(renderer.flfx && renderer.flfx.usar);
  const meleeOk = hayMeleeConfirmado(state.events);   // AC-07: un golpe cuerpo a cuerpo = un impacto
  for (const e of state.events) {
    const mine = me && e.pid === me.id;
    if (combatHud) combatHud.onEvent(e, me, renderer.camera);
    caida.onEvent(e, me);
    switch (e.t) {
      case 'shot': sound.shot(e.w, mine ? null : e.o); break;
      case 'hit': sonarImpacto(sound, e, meleeOk); break;
      case 'kill': if (evoHud && evoHud.absorb && ESSENCE_OF[e.k]) { const v = new THREE.Vector3(e.p[0], e.p[1], e.p[2]).project(renderer.camera); if (v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1) evoHud.absorb((v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, e.k); } sound.voice(e.k, 'die', e.p); trophy('first', 'Primer contacto', 'Derrotá a tu primera criatura', sound); if (e.k === 'coloso') trophy('b1', 'Corazón roto', 'Derrotá al Coloso Prismático', sound); if (e.k === 'argos') trophy('b3', 'Cerré el ojo', 'Derrotá a Argos, el Ojo Primordial', sound); if (e.k === 'madre') trophy('b2', 'El último latido', 'Derrotá a la Madre Geoda', sound); if (e.k === 'geoda') trophy('geoda', 'Paciencia', 'Derrotá una Geoda', sound); break;
      case 'boom': sonarImpacto(sound, e); break;   // con `hit: 0` (habilidad de área sin blancos) no suena a impacto
      case 'ng': { // nieblas de colores (src/sim/nieblas.js): al entrar a una, cartel con su función (el HUD fijo `#ngchip` queda mientras estés adentro)
        const T = NIEBLAS_T(e.k); if (T && e.ph === 'entra' && e.pid === session.pid && !session.intro) banner(`${T.icono} ${T.nombre}: ${T.corto}`, 2200);
        if (T && e.ph === 'aviso' && T.nocivo && !session.intro && session.lastMe && Math.hypot(e.p[0] - session.lastMe.pos[0], e.p[2] - session.lastMe.pos[2]) < 22) sound.ui && sound.ui('tick');
        break; }
      case 'flora': floraEvento(e, mine, me); break;   // flora interactiva (src/sim/flora.js): curas, mordidas, esporas, cosecha, plantas raras
      case 'fauna': faunaEvento(e, mine, me); break;   // fauna consumible (src/sim/fauna.js): comer, híbridos, remates, mordidas, rara a la vista
      case 'ar': { const AV = ARENAS_VIVAS[e.m], tx = AV && AV.frases[e.ph]; if (tx && !session.intro) later(() => banner(tx, 2600), e.ph === 'ofrenda' ? 2300 : e.ph === 'roto' || e.ph === 'renace' ? 0 : 2700); break; }   // arenas vivas: «El Corazón de Isla despierta»
      case 'arhit': sonarImpacto(sound, e); break;
      case 'arofrenda': sound.pickup(); break;
      case 'arfire': if (e.k >= 2 && !e.fin) sound.boom(e.p); break;   // golpe y pulso ya suenan con su 'boom'
      case 'hurt': if (mine) { sound.hurt(); const v = $('vignette'); v.classList.add('hurt'); setTimeout(() => v.classList.remove('hurt'), 120); if (navigator.vibrate) navigator.vibrate(30); pad.rumble(120, 0.6); } break;
      case 'pickup': if (mine) sound.pickup(); break;
      case 'revive': trophy('rev', 'Mano amiga', 'Reanimá a un compañero', sound); sound.pickup(); banner(mine ? '¡Te reanimaron!' : 'Compañero reanimado', 1800); break;
      case 'wave': if (!session.intro) { sound.wave(); banner(state.operation && !e.boss ? `OLEADA ${e.n}/${state.waveTotal} · ${state.operation.step}` : e.boss ? '¡EL CORAZÓN DEL VÓRTICE!' : `OLEADA ${e.n}`, 2500); } break;
      case 'clear': banner('Oleada superada', 2200); if (e.wave >= 3) trophy('w3', 'Resistente', 'Superá 3 oleadas', sound); break;
      case 'gravity': sound.gravity(e.p); trophy('flip', 'Cabeza abajo', 'Sentí la gravedad invertida', sound); if (me && me.flip) banner('¡LA GRAVEDAD SE INVIERTE!', 1500); flash(); break;
      case 'pull': sound.gravity(e.p); break;
      case 'heal': sound.pickup(); break;
      case 'portal': sound.portal(e.p); trophy('portal', 'Atajo dimensional', 'Cruzá un portal', sound); break;
      case 'blink': sound.voice('espejo', 'blink', e.p); break;
      case 'summon': sound.voice('cuarzo', 'cast', e.p); break;
      case 'ability': sound.ability(mine ? null : (me ? e.p : null)); if (mine) banner(ROLES[e.role].ability.toUpperCase(), 900); break;
      case 'objective': objectiveEvent(e); break;
      case 'mision': if (metaHud) metaHud.evento(e, banner, sound); break;
      case 'ping': sound.ping(); break;
      case 'pass': sound.pickup(); break;
      case 'npc': if (NPC_INFO[e.kind]) banner(`${NPC_INFO[e.kind].name} aparece cerca`, 2200); break;
      case 'npcdeal': if (mine && npcPanel) { npcPanel.result(e); if (e.ok) sound.pickup(); else banner(dealText(e), 2200); } break;
      case 'ray': sound.ray(); banner('¡RAYO DEL VACÍO! Parate en un pilar marcado', 2400); break;
      case 'reflect': sound.boom(e.to); banner('¡REFLEJADO! El Coloso está aturdido', 2200); flash(); break;
      case 'shield': banner('El Coloso recupera su escudo', 1600); break;
      case 'purge': sound.gravity(); banner('¡PURGA! La Madre está abierta: ¡disparale!', 2400); flash(); break;
      case 'gestate': banner('La Madre pone huevos: ¡rompelos antes de que eclosionen!', 2400); break;
      case 'hatch': sound.boom(e.p); break;
      case 'drop': case 'madura': case 'firma': if (botin) botin.event(e, mine || !e.pid); if (e.t === 'drop' && e.r >= 3) sound.objective(true); break;   // objetos: botín del piso, maduración y arma firma
      case 'loot': if (mine) { (session.bag ||= []).push({ id: e.id, q: e.k === 'mat' ? e.q : e.q, n: e.n || 1, r: e.r }); if (botin) botin.event(e, true); sound.pickup(); } break;
      case 'organ': if (mine && evoHud) { const O = e.target === 'c' ? CHAMP_ORGANS[e.id] : WEAPON_ORGANS[e.id]; evoHud.organ(O ? O.name : ''); sound.pickup(); } break; // un órgano creció (organs-vis.js lo muestra)
      case 'combo': if (mine && e.fin && e.n >= 3) sound.objective(true); break;   // remate de un combo largo: pequeño acorde
      case 'multi': if (mine && e.n >= 3) { banner(`¡${e.n} BAJAS DE UN GOLPE!`, 900); if (e.n >= 5) sound.boom(e.p); else sound.pickup(); } break;   // multi-kill (progresion.js)
      case 'rango': if (mine) { banner(`ESTILO ${e.r}`, 700); sound.ui('trophy'); } break;   // subió el rango de estilo D/C/B/A/S
      case 'arrasar': if (mine && e.n >= 4) sound.boom(e.p); break;
      case 'pozo': case 'reflujo': sound.gravity(e.p); break;   // Singular: se abre un pozo / reflujo de marea
      case 'pozoend': sound.boom(e.p); break; case 'orbburst': sonarImpacto(sound, e); break;   // Singular: implosión del pozo / estallido de satélites   // un remate de área barrió a 4+ enemigos
      case 'hab': if (e.ph === 'cast') { sound.ability(mine ? null : e.p); if (mine && me && HABILIDADES[me.char]) banner(HABILIDADES[me.char].name.toUpperCase(), 700); } break;   // habilidad principal (telegrafía)
      case 'evolve': if (mine && evoHud) { evoHud.celebrate(e.tier); sound.objective(true); flash(); } break; // evolución: destello, onda y texto (hud-evolucion.js)
      case 'down': sound.down(); if (mine) banner('¡ESTÁS CAÍDO! Pedí ayuda con B', 2200); break;
      case 'surge': banner('El Vórtice se enfurece…', 1800); break;
      case 'ev': { const D = EVENTOS[e.id]; if (!D) break; // evento de oleada (src/sim/eventos.js): aviso ~4 s antes, activo, fin
        if (e.ph === 'aviso') { sound.wave(); banner(`¡Se acerca: ${D.name}!`, 3600); }
        else if (e.ph === 'activo') { banner(`${D.icon} ${D.name.toUpperCase()}`, 2200); if (e.id !== 'marea_gravedad') flash(); }
        else if (e.ph === 'fin') { banner(e.ok ? `${D.name} superada · ¡premio!` : `${D.name} terminó`, 2000); if (e.ok) sound.objective(true); }
        break; }
      case 'feed': if (!session.feedT || performance.now() - session.feedT > 160) { session.feedT = performance.now(); sound.pickup(); } break; // mapa 4: un impacto alimentó un capullo (el aro de puntos del capullo muestra cuánto)
      case 'gnaw': if (!session.gnawT || performance.now() - session.gnawT > 9000) { session.gnawT = performance.now(); banner('¡Las criaturas están royendo un capullo! Defendelo', 2200); sound.hurt(); } break;
      case 'bloom': sound.objective(true); banner(`¡CAPULLO FLORECIDO! (${e.k + 1}/${e.n}) Crece un tramo del puente`, 3000); break;
      case 'bridge': if (e.ph === 'open') { sound.objective(true); banner('¡EL PUENTE AL UMBRAL ESTÁ COMPLETO! Cruzá hasta la isla del este', 3600); flash(); } else if (e.ph === 'start') sound.gravity(e.p); break;
      case 'hint': banner(e.lvl === 1 ? 'Pista: un capullo está marcado. Disparale para alimentarlo' : e.lvl === 2 ? 'Pista: cada capullo que florece hace crecer un tramo del puente entre la Cámara del Latido (este) y el Umbral' : 'Pista: el puente nacerá en el lugar marcado, entre la Cámara del Latido y el Umbral', 4200); break;
      case 'tshot': break;
      case 'tutpaso': if (mine || !e.pid) { try { Perfil.tutorialPaso(e.n); } catch { /* sin perfil */ } } break;   // el paso queda guardado: si recargás, retomás ahí
      case 'tutok': sound.objective(true); break;
      case 'tutonda': if (e.ok) sound.pickup(); else sound.hurt(); sound.boom(e.p); break;
      case 'tutfin': try { Perfil.tutorialListo(); } catch { /* sin perfil */ } if (session.tutUI) { session.tutUI.dispose(); session.tutUI = null; } banner(e.saltado ? 'Tutorial saltado. El combate empieza en 5 segundos.' : '¡Tutorial completo! El combate real empieza en 5 segundos.', 4200); if (!e.saltado) subs.play([['H', 'Bien hecho. Tu segunda habilidad se activa al superar la primera oleada; la definitiva, tras la tercera. Reconectá el refugio.', 5.5]]); break;
      case 'rewardUnavailable': if (mine) banner('No se pudo comprar: revisá tus esencias y elegí otra mejora.', 2400); break;
      case 'skill': if (mine && !(renderer.hostfx && renderer.hostfx.handles(e))) { sound.ability(); } break; // las de los Huéspedes suenan desde hostfx.js
      case 'upgrade': if (mine) { sound.pickup(); banner('¡Arma mejorada!', 1400); } break;
      case 'gaze': sound.ray(); banner('¡ARGOS TE MIRA! Cubrite detrás de un muro', 2200); break;
      case 'ojobreak': sound.boom(e.p); break;
      case 'well': sound.gravity(e.p); break;
      case 'phase': sound.voice(state.boss && /Mandinga|Col/.test(state.boss.name) ? 'coloso' : 'madre', 'phase'); if (renderer.jfx) renderer.jfx.event(e, jfxCtx); else { banner(`FASE ${e.n}`, 1800); flash(); } break;   // jefes: fases, adaptación y mecánicas (jefes-fx.js)
      case 'jia': case 'jatk': if (renderer.jfx) renderer.jfx.event(e, jfxCtx); break;
    }
  }
  if (combatHud) combatHud.update(dt, state, me);
  try { caida.update(dt, state, session.intro ? null : me); } catch (err) { caida.update = () => {}; console.warn('caida', err.message); }
  canvas.classList.toggle('flip', !!(me && me.flip));
  canvas.classList.toggle('tide', !!(state.fx && (state.fx.zero || state.fx.warn)));
  if (state.fx && state.fx.warn && !session.tideWarned && !state.ev) { session.tideWarned = true; banner('LA MAREA SE APROXIMA… sin gravedad', 2500); }
  if (state.fx && !state.fx.warn) session.tideWarned = false;
  $('wave').textContent = state.phase === 'intermission' ? (state.wave ? 'RESPIRO' : 'PREPARATE') : `OLEADA ${state.wave} / ${state.waveTotal}`;
  $('left').textContent = state.phase === 'intermission' ? `siguiente en ${Math.ceil(state.intermission)}s` : `${state.left} criaturas`;
  const pr = $('practice');
  if (session.practice && me) { pr.classList.remove('hidden'); pr.innerHTML = `<b>CAMPO DE PRUEBAS</b> · Héroe: <i>${CHARACTERS[me.char] ? CHARACTERS[me.char].name : '—'}</i> (H) · Arma: <i>${WEAPONS[me.w].name}</i> ( , . ) · munición y vida ilimitadas`; } else pr.classList.add('hidden');
  const bb = $('bossbar');
  if (state.boss) { bb.classList.remove('hidden'); if (!state.boss.mc) $('bossname').textContent = state.boss.name; $('bossfill').style.width = `${Math.max(0, 100 * state.boss.hp / state.boss.max)}%`; } else bb.classList.add('hidden');
  try { hudDirector(state, me); } catch (err) { if (!window.__hudErr) { window.__hudErr = err; console.error("HUD:", err); } }   // un error de interfaz nunca debe detener el dibujo (pantalla negra)
  if (me) {
    const portrait = $('hudportrait'); if (portrait.dataset.char !== me.char) { portrait.dataset.char = me.char; portrait.src = new URL(CHARACTERS[me.char]?.host && !CHARACTERS[me.char].lab ? `../../public/portraits/${me.char}.png` : '../../public/icon-180.png', import.meta.url).href; portrait.alt = CHARACTERS[me.char]?.name || 'Tu huésped'; }
    $('hudname').textContent = CHARACTERS[me.char]?.name || 'Huésped';
    $('hpfill').style.width = `${me.hp}%`; $('shfill').style.width = `${me.sh}%`; $('hpnum').textContent = `Vida ${me.hp}`; $('shnum').textContent = `Escudo ${me.sh}`;
    $('score').textContent = `Puntos ${me.score} · Bajas ${me.kills}` + (me.dead ? ' · CAÍDO: un compañero cerca te reanima' : '');
    updateWeaponHud(me);
    if (state.players.length > 1) {
      const c = $('coop'); c.classList.remove('hidden');
      c.textContent = ''; c.append('Sala ' + (session.net ? session.net.room + (session.net.rtt ? ` · ${session.net.rtt} ms` : '') : ''), ...state.players.flatMap((p) => [document.createElement('br'), `${p.id === me.id ? '▶' : ' '} ${p.name} ${p.id} ${p.aw ? '(sin conexión)' : p.dead ? `✖ ${Math.round(p.rv / 3 * 100)}%` : p.hp}`]));   // (textContent: los nombres vienen de otros jugadores)
    }
  }
}

/* ───────── HUD del director: objetivo, habilidad, jefe, ping, caído ───────── */
const OBJ_ICON = { secuencia: '▣', caza: '⌖', ancla: '⚓', sintonia: '◈', nucleo: '✦', cultivo: '✿' };
function objectiveEvent(e) {
  if (e.ph === 'start') { banner(e.title, 1800); sound.objective(true); }
  else if (e.ph === 'done') {
    sound.objective(true); trophy('obj', 'Trabajo en equipo', 'Completá un objetivo de oleada', sound);
    banner('¡OBJETIVO CUMPLIDO! Munición, vida y +25 % de daño del equipo', 3200);
    if (FRAGMENTS[e.frag] && !(session && session.intro)) later(() => { if (session && !session.ended && !subs.active) subs.play([['H', FRAGMENTS[e.frag], 7]]); }, 2200);
    const o = $('objective'); o.classList.add('done');
  } else if (e.ph === 'failed') { sound.hurt(); banner('Objetivo fallido: el Vórtice se enfurece', 2800); }
}
let metaHud = null; const metaCtx = { solo: true, sinGuia: false };
function hudDirector(state, me) {
  document.body.classList.toggle('between-waves', state.phase === 'intermission');
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
  document.body.classList.toggle('reward-focus', wantCards && session.mode === 'solo');
  if (wantCards !== cardsOpen) { cardsOpen = wantCards; $('cards').classList.toggle('hidden', !wantCards); session.cardKey = ''; document.body.classList.toggle('cards-open', wantCards); if (wantCards && session.touch) touch.reset(); }
  if (wantCards) {
    const key = JSON.stringify(me.cards) + me.sl.join(',');
    if (session.cardKey !== key) {
      session.cardKey = key; const WC = WEAPON_COLORS.map((c) => '#' + c.toString(16).padStart(6, '0'));
      $('cardlist').innerHTML = me.cards.map((c, i) => {
        const [w, k, mod, mod0] = c, W = WEAPONS[w], idx = me.sl.indexOf(w), u = me.ug[idx] || [0, 0, 0, null], isForma = k === 'forma', FM = isForma ? (LINEAGE.forms[mod] || { name: mod, desc: '' }) : null, isOrg = k === 'organ', OG = isOrg ? ((mod0 === 'c' ? CHAMP_ORGANS : WEAPON_ORGANS)[mod] || { name: mod, desc: '' }) : null, isMut = k === 'mut', isMod = k === 'mod' || isMut, MU = isMut ? ((WEAPON_MUTS[mod0] || []).find((x) => x.id === mod) || { name: mod, desc: '' }) : null;
        const ix = { dmg: 0, rate: 1, mag: 2 }[k], cur = isMod ? 0 : (u[ix] || 0), eff = { dmg: `daño ${Math.round(W.dmg * (1 + 0.22 * cur))} → ${Math.round(W.dmg * (1 + 0.22 * (cur + 1)))}`, rate: `${(1 / (W.rate / (1 + 0.14 * cur))).toFixed(1)} → ${(1 / (W.rate / (1 + 0.14 * (cur + 1)))).toFixed(1)} disparos/s`, mag: W.max === Infinity ? 'munición ∞' : `máx. ${Math.ceil(W.max * (1 + 0.3 * cur))} → ${Math.ceil(W.max * (1 + 0.3 * (cur + 1)))}` }[k];
        return `<button class="ucard ${isMod ? 'mod' : ''}" data-i="${i}" style="--c:${WC[w % WC.length]}"><div class="wn">${isOrg && mod0 === 'c' ? 'TU CUERPO' : 'DISPARO · ' + W.name}</div><div class="un">${isForma ? '✦ ' + FM.name : isOrg ? '🧬 ' + OG.name : isMut ? MU.name : isMod ? (WEAPON_MODS[mod] || { name: mod }).name : UPGRADE_KINDS[k].name}</div><div class="ud">${isForma ? FM.desc : isOrg ? OG.desc : isMut ? MU.desc : isMod ? (WEAPON_MODS[mod] || { desc: '' }).desc : eff}</div><div class="lv">${isForma ? '✦ LINAJE FINAL (excluyente)' : isOrg ? 'Costo: ' + Object.entries(OG.cost || {}).map(([k,n]) => `${n} ${k}`).join(' + ') : isMut ? '★★ EVOLUCIÓN (excluyente)' : isMod ? '★ ESPECIAL' : `NIVEL ${cur} → ${cur + 1}`}</div><kbd>${session.touch ? 'tocá' : 'tecla ' + (i + 1)}</kbd></button>`;
      }).join('');
      $('cardlist').querySelectorAll('.ucard').forEach((b) => b.addEventListener('pointerdown', () => { pickReq = +b.dataset.i; }));
      $('cardhint').textContent = session.mode === 'solo' ? 'Elegí una: las otras se descartan. Disparo mejora el arma; cuerpo mejora al Huésped. Los órganos indican su costo.' : 'Elegí rápido: si no elegís, se aplica la primera. El arma mejorada se ve distinta en tu mano.';
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
  tacticalHUD.update(session && !session.intro && !session.ended && !session.paused && (locked || session.touch) ? state : null, me, session?.mode === 'coop', MAPS[session?.map]);
  try { if (!window.__radar) window.__radar = createRadar(document.body); window.__radar.update(session && !session.intro ? state : null, me, renderer.camera, renderer.nfx ? renderer.nfx.ecos : null); } catch (err) { /* el radar nunca debe romper el HUD */ }
  evoHud.update(me, !!(session && session.touch), !(session && session.intro));
  try { // META: línea de objetivo, misión opcional, flecha y guía (meta-ui.js); nunca debe romper el HUD
    metaCtx.solo = session.mode === 'solo'; metaCtx.sinGuia = !!(session.headless || params.get('auto'));
    if (!metaHud) metaHud = createMetaHud($('hud'), metaCtx);
    metaHud.update(state, me, renderer.camera, { touch: !!session.touch, oculto: !!(session.intro || session.practice) });
  } catch (err) { if (!window.__metaErr) { window.__metaErr = err; console.warn('Meta HUD:', err.message); } metaHud = metaHud || { update() {}, evento() {} }; }
  session.faunaCerca = !!(me && !me.dead && state.fa && state.fa.l.some((r) => Math.hypot(r[2] - me.pos[0], r[3] - me.pos[1], r[4] - me.pos[2]) < FAUNA.alcance + 0.3));   // fauna consumible: hay algo para comer a mano
  { // Limbo vivo: NPC cercano (cartel «E · hablar»; en táctil el botón USAR ya aparece solo porque hay un objeto a menos de 7)
    npcCtx.npc = session && !session.intro ? npcNear(state, me) : null;
    if (npcPanel) { if (npcPanel.open && (!npcCtx.npc || npcCtx.npc.nk !== npcPanel.kind)) npcPanel.close(); npcPanel.setHint(npcCtx.npc ? NPC_INFO[npcCtx.npc.nk] : null, !!(session && session.touch)); }
  }
  if (session && session.touch && me) { // botones contextuales: sólo aparecen cuando sirven
    const near = (p, r) => Math.hypot(p[0] - me.pos[0], p[1] - me.pos[1], p[2] - me.pos[2]) < r;
    const use = essentialInteraction(state, me, { npc: !!npcCtx.npc, fauna: session.faunaCerca, flora: session.floraUsar, tutorial: !!(state.tut && state.tut.usar) });
    const C = CHARACTERS[me.char], ultOn = !!(C && C.ult && ((+me.ud || 0) <= 0 || (+me.ua || 0) > 0.05));
    touch.setSkillLevel(me.sk);
    touch.setContext({ ult: ultOn, use, evo: me.co != null && me.evn != null && me.co >= me.evn });
    const mp = Math.min(1, (performance.now() - modoT) / (MODO_ESPERA * 1000)); if (mp < 1 || session.modeP == null || session.modeP < 1) touch.setModeCd(mp); session.modeP = mp;   // anillo de espera del botón MODO
  }
  const dn = $('downed');
  if (me && me.dead) { dn.classList.remove('hidden'); dn.textContent = me.lost ? 'PERDIDO… esperá la próxima oleada' : `CAÍDO · te desangrás ${Math.ceil(me.bleed)} s · ¡pedí ayuda con B!`; } else dn.classList.add('hidden');
  const bm = $('bossmech'), b = state.boss;
  if (b) {
    let t = '';
    const kb = (b.mc && JEFES[b.mc.mj] && JEFES[b.mc.mj].base) || (/Basilisco|Argos/.test(b.name) ? 'argos' : /Mandinga|Col/.test(b.name) ? 'coloso' : 'madre');   // (los nombres cambiaron: se decide por el cuerpo del jefe)
    if (kb === 'argos') t = b.stagger > 0 ? `ATURDIDO ${Math.ceil(b.stagger)} s · ¡daño ×2,5!` : b.gaze > 0 ? `¡MIRADA en ${Math.ceil(b.gaze)} s! Escondete detrás de un muro` : b.eyes > 0 ? `${b.eyes} OJOS protegen a Argos · destruílos (puntos débiles)` : '';
    else if (kb === 'coloso') t = b.stagger > 0 ? `ATURDIDO ${Math.ceil(b.stagger)} s · ¡daño ×2,5!` : b.ray > 0 ? `RAYO en ${Math.ceil(b.ray)} s · ¡a un pilar marcado!` : b.shield ? 'ESCUDO DE RESONANCIA · reflejá el rayo con un pilar' : '';
    else t = b.pressure >= 1 ? 'PRESIÓN MÁXIMA · ¡purgá las dos válvulas!' : `PRESIÓN ${Math.round(b.pressure * 100)} % · mantené las 2 válvulas a la vez`;
    if (renderer.jfx) t = renderer.jfx.mech(b, t);
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
let botin = null;
function bankProfile(me, state) {
  if (!session || (session.mode !== 'solo' && session.mode !== 'coop') || session.base || session.banked || !me) return;
  const fin = session.mode === 'coop' && session.net && session.net.fin;
  if (fin) session.bag = fin.bag.map((b) => ({ id: b.id, q: b.q, n: b.n || 1, r: b.r }));   // en cooperativo el botín lo dice el SERVIDOR al terminar
  const won = !!state && state.state === 'won';
  let resumen = null; try { resumen = fin ? fin.resumen : session.game ? session.game.resumen() : null; } catch { resumen = null; }
  if (resumen && !state) resumen = { ...resumen, estado: 'abandono' };
  session.banked = true; session.resumen = resumen;
  try { session.mae = Perfil.cerrarPartida(Equipo.char, me, { matchId: fin && fin.matchId ? fin.matchId : session.matchId, bag: session.bag, wave: state ? state.wave : session.lastWave, won, resumen, coop: fin && fin.recompensa ? { mult: fin.recompensa.mult } : null }); session.coopRec = fin && fin.recompensa ? fin.recompensa : null; }
  catch (err) { console.warn('Perfil: no se pudo guardar', err.message); session.mae = { guardado: false, pendiente: false, mensaje: 'No se pudo guardar tu progreso.' }; }
}
/** Adaptación suave ENTRE intentos: el jefe recuerda (un poco) cómo peleaste la última vez en esta arena (jefe-ia.js → iaMemoria). */
function leerMemoriaJefe(mapId) { try { const m = JSON.parse(localStorage.getItem('arcanum.jefeMem.' + mapId) || 'null'); return m && typeof m.s === 'string' ? { s: m.s, c: +m.c || 0, n: +m.n || 0 } : null; } catch { return null; } }
function guardarMemoriaJefe() { try { const g = session && session.game; if (!g || !g.boss || !g.boss.ia || session.practice) return; const m = jefeMemoria(g.boss); if (m && g.boss.ia.t > 15) localStorage.setItem('arcanum.jefeMem.' + session.map, JSON.stringify(m)); } catch { /* sin almacenamiento */ } }
function endGame(state, me) {
  guardarMemoriaJefe();
  bankProfile(me, state);
  let terrNuevo = null; if (state.state === 'won' && session.mode === 'solo' && !session.practice) { try { if (Perfil.liberarTerritorio(session.map)) terrNuevo = Territorios.TERRITORIOS[session.map]; } catch (err) { console.warn('Territorios: no se pudo guardar', err.message); } } // ganar el mapa libera el territorio (perfil.js)
  session.ended = true; if (document.exitPointerLock) document.exitPointerLock(); touch.show(false);
  const won = state.state === 'won'; window.__ended = state.state;
  let stats = `${state.operation ? state.operation.title + '\nOleada' : 'Oleada'} ${state.wave}/${state.waveTotal}\nTiempo ${Math.round(state.time)} s\n` + state.players.map((p) => `${p.name} ${p.id}: ${p.kills} bajas · ${p.score} pts`).join('\n') + maestriaTxt();   // texto plano de respaldo (#endstats); la pantalla real la dibuja resultados-ui.js
  if (session.mode === 'solo' && session.campaign && won) Perfil.completarCapitulo(session.campaign);
  let nuevosHuespedes = [];
  { // Sprint 1: desbloqueos por campaña y por desafío (docs/ONBOARDING.md). No cuentan las partidas de práctica ni las cooperativas.
    let nuevos = []; try {
      if (session.mode === 'solo' && !session.practice && !session.horde) {
        if (session.campaign && won) nuevos = Perfil.desbloqueosRecientes();
        const jefe = won && session.campaign && CAMPAIGN_BOSSES[session.map] ? session.map : '';
        nuevos = nuevos.concat(Perfil.registrarDesafios({ won, map: session.map, boss: jefe, kills: me ? me.kills : 0, mode: gameMode(), time: state.time, wave: state.wave, campaign: !!session.campaign }));
      }
    } catch (err) { console.warn('Desbloqueos: no se pudieron guardar', err.message); }
    nuevosHuespedes = [...new Set(nuevos)];
    if (nuevos.length) { stats += `\n\n¡HUÉSPED DESBLOQUEADO: ${[...new Set(nuevos)].map(nombreHuesped).join(' y ')}! Elegilo antes de la próxima misión en Huéspedes.`; try { sound.objective(true); } catch { /* sin audio */ } }
  }
  session.desbloqueos = []; for (const id of nuevosHuespedes) session.desbloqueos.push(`¡Huésped desbloqueado: ${nombreHuesped(id)}! Elegilo antes de la próxima misión.`); if (terrNuevo) session.desbloqueos.push(`Territorio liberado: ${terrNuevo.nombre}. Elegí su bendición en el Códice.`); if (session.mode === 'solo' && session.campaign && won) session.desbloqueos.push('Avance de capítulo de la campaña');
  if (session.mae && session.mae.subio) session.desbloqueos.push(`Maestría: ¡rango ${session.mae.rangoDespues} · ${TITULOS[session.mae.rangoDespues]}!`);
  const nextCap = session.campaign ? CAMPAIGN_ORDER[CAMPAIGN_ORDER.indexOf(session.campaign) + 1] : null;
  if (session.mode === 'solo' && session.campaign && won && nextCap) { // → interludio y el capítulo siguiente
    playChapterFilm(session.campaign, () => startSolo(nextCap, { campaign: nextCap, intro: false }));
    return;
  }
  if (won && session.campaign === 'm2') { playChapterFilm('m2', () => { trophy('end', Story.VICTORY.trophy, 'Completá la historia', sound); showEnd(true, stats, Story.VICTORY.title); }); return; }
  if (state.operation) { showEnd(won, stats + (state.operation.failure ? '\n' + state.operation.failure : '') + (terrNuevo ? '\nTerritorio liberado. Elegí su bendición en el Códice.' : ''), won ? 'MISIÓN COMPLETADA' : 'MISIÓN FALLIDA'); return; }
  if (!won) { subs.play(Story.DEFEAT, () => showEnd(false, stats)); return; }
  showEnd(true, stats + (terrNuevo ? `\n\nTERRITORIO LIBERADO: ${terrNuevo.nombre}. Elegí su bendición en el menú › Territorios.` : ''));
}
/** La simulación ya terminó: el interludio no consume tiempo ni concede otra recompensa. */
function playChapterFilm(id, next) {
  const cur = session; cur.intro = 'transfer'; $('hud').classList.add('hidden'); touch.show(false);
  cine = iniciarTransferencia({char: myChar(), subs, sound, film: CHAPTER_FILMS[id], onDone: () => {
    cine = null; if(session !== cur)return; cur.intro = null; next();
  }});
}
/** Línea de maestría del fin de partida (XP ganada y, si subió, el rango nuevo). */
function maestriaTxt() { const m = session && session.mae; if (!m) return ''; const a = m.arbol, pc = a ? a.combo + a.disparo : 0; return `\nMaestría +${m.ganada} XP` + (m.subio ? ` · ¡RANGO ${m.rangoDespues}: ${TITULOS[m.rangoDespues]}!` : '') + (pc ? `\nPuntos de ${a.combo ? 'combo' : 'disparo'} +${pc} (gastalos en Huésped › Progresión)` : ''); }
function showEnd(won, stats, title) {
  $('endtitle').textContent = title || (won ? 'VÓRTICE ROTO' : 'ATRAPADO EN EL VÓRTICE');
  $('endstats').textContent = stats + (won && title === Story.VICTORY.title ? '\n\n' + Story.VICTORY.epilogue : '');
  try {   // pantalla de resultados completa (única para solo y coop; reemplaza al texto plano y al resumen de botín)
    const g = Perfil.estadoGuardado(), rc = Perfil.ultimoRecibo(), m = session && session.mae;
    const modelo = modeloResultados({ won, resumen: session && session.resumen, yo: session && session.pid, recibo: rc, mae: m, botin: Perfil.botinLineas(), desbloqueos: session && session.desbloqueos, coop: session && session.coopRec, guardado: m && m.guardado === false ? { ok: false, mensaje: m.mensaje, pendientes: g.pendientes } : { ok: true } });
    dibujarResultados($('end'), modelo, { Perfil, extra: won && title === Story.VICTORY.title ? Story.VICTORY.epilogue : '' });
  } catch (err) { console.warn('Resultados:', err.message); $('endstats').hidden = false; }
  $('end').classList.remove('hidden'); document.body.classList.remove('playing');
  { const tb = $('tobase'); if (tb) tb.classList.toggle('hidden', !settings().baseAlTerminar); }   // «Entrar a la Base» (docs/BASE.md): primera opción si el ajuste está en «sí»
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
/** Sprint 1: un jugador NUEVO elige su primer Huésped (una vez) antes de cualquier partida; después sigue lo que iba a hacer. */
function conPrimerHuesped(siguiente) {
  if (!Perfil.necesitaPrimerHuesped() || params.get('auto')) { siguiente(); return; }
  mostrarPrimerHuesped({ sound, preseleccion: 'axioma', onElegir: (id) => {
    Perfil.elegirInicial(id); Equipo.char = id; saveEquipo(); try { ui.refreshHuesped(); } catch { /* menú no listo */ }
    siguiente();
  } });
}
const ui = new MenuUI({ sound, actions: {
  story: (fresh = false) => conPrimerHuesped(() => {
    if (fresh) Perfil.nuevaCampana();
    const id = campaignNext(Perfil.perfil().campaign);
    if (!id) { ui.go('story'); return; }
    loadAnd(() => startSolo(id, { campaign: id }));
  }),
  base: () => conPrimerHuesped(() => loadAnd(() => startBase())),
  arena: (m) => conPrimerHuesped(() => loadAnd(() => (m === 'practica' ? startSolo('m1', { intro: false, practice: true }) : startSolo(m, { intro: false })))),
} });
$('pause').addEventListener('click', (e) => { if (e.target.closest('.item.sel') || e.target.closest('.pmas') || e.target.id === 'quit') return; if (session && session.touch) return; lockPointer(); });
$('resume').addEventListener('click', () => { if (session && session.touch) pauseTouch(false); else lockPointer(); });
$('sens').addEventListener('input', (e) => { mouseSens = 0.00044 * +e.target.value; });
$('sens0').addEventListener('input', (e) => { mouseSens = 0.00044 * +e.target.value; });
$('vol').addEventListener('input', (e) => sound.setVolume(+e.target.value / 10));
$('subsel').addEventListener('change', (e) => { $('sub').style.display = e.target.value === '1' ? '' : 'none'; });
$('evoopen').addEventListener('click', (e) => { e.stopPropagation(); if (!evoMenu) evoMenu = createEvoMenu(document.body, { getMe: () => session && session.lastMe, request: (o) => { organReq = o; organReqT = performance.now(); }, sound }); evoMenu.open(); });
$('quit').addEventListener('click', () => { bankProfile(session && session.lastMe); if (session && session.net) { try { session.net.salir(); } catch { /* ya cerrado */ } try { sessionStorage.removeItem('arcanum.sala.v1'); } catch { /* nada */ } const u = new URL(location.href); u.searchParams.delete('sala'); location.replace(u.href); return; } location.reload(); });
{ const pb = $('pbase'); if (pb) pb.addEventListener('click', (e) => { e.stopPropagation(); bankProfile(session && session.lastMe); $('tobase').click(); }); }   // Pausa › «Salir a la Base» (misma salida que «Entrar a la Base» del final de partida)
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
  bind('tgrav', () => (S.reducirGravedad ? '1' : '0'), (v) => setSetting('reducirGravedad', v === '1'));
  bind('tgs', () => Math.round(S.gyroSens * 10), (v) => setSetting('gyroSens', v / 10));
  bind('tadsm', () => S.adsMode, (v) => setSetting('adsMode', v));
  bind('tfing', () => String(S.fingers), (v) => touch.setFingers(+v));
  bind('tadv', () => (S.advanced ? '1' : '0'), (v) => { setSetting('advanced', v === '1'); syncAdv(); });
  const powerSelect = $('essentialpower');
  if (powerSelect) {
    powerSelect.addEventListener('change', () => { const key = `${myChar()}:${gameMode()}`; setSetting('essentialPowers', { ...(settings().essentialPowers || {}), [key]: powerSelect.value }); touch.reset(); touch.applyLayout(); });
  }
  const syncAdv = () => { document.body.classList.toggle('hud-focused', !settings().advanced); const b = $('advtoggle'); if (b) b.querySelector('b').textContent = `Controles: ${settings().advanced ? 'completos' : 'esenciales (4 botones)'}`; const t = $('tadv'); if (t) t.value = settings().advanced ? '1' : '0'; };
  const syncCam = () => { const b = $('camtoggle'); if (b) b.querySelector('b').textContent = `Cámara: ${renderer.third ? 'tercera persona (te ves)' : 'primera persona'}`; };
  const setCam = (on) => { renderer.setThird(on); setSetting('third', !!on); syncCam(); };
  const cb = $('camtoggle'); if (cb) cb.addEventListener('click', (e) => { e.stopPropagation(); setCam(!renderer.third); }); syncCam();
  const gx = $('gfxopen'); if (gx) gx.addEventListener('click', (e) => { e.stopPropagation(); Graficos.abrirEnPausa(sound); });   // Pausa › Gráficos
  const syncClar = () => { const b = $('claridad'); if (b) b.querySelector('b').textContent = `Claridad: ${settings().claridad === 'alta' ? 'Alta (más luz sobre vos y los enemigos)' : 'Normal'}`; };
  const cl = $('claridad'); if (cl) cl.addEventListener('click', (e) => { e.stopPropagation(); const v = settings().claridad === 'alta' ? 'normal' : 'alta'; setSetting('claridad', v); renderer.applyClaridad(v); syncClar(); }); syncClar();
  const syncAuto = () => { const b = $('camauto'); if (b) b.querySelector('b').textContent = `Cámara automática por modo: ${settings().camAuto ? 'sí (Melé 3.ª · Disparo 1.ª)' : 'no'}`; };
  { const cs = $('camautosel'); if (cs) { cs.value = settings().camAuto ? '1' : '0'; cs.addEventListener('change', () => { setSetting('camAuto', cs.value === '1'); syncAuto(); }); } }
  { const tr = $('tutrep'); if (tr) tr.addEventListener('click', () => { Perfil.tutorialReiniciar(); sound.ui('ok'); conPrimerHuesped(() => loadAnd(() => startSolo('m1', { tutorial: true, intro: false }))); }); }   // Ajustes › «Repetir tutorial»: Islas con el tutorial (no toca el avance de la campaña)
  const ca = $('camauto'); if (ca) ca.addEventListener('click', (e) => { e.stopPropagation(); setSetting('camAuto', !settings().camAuto); syncAuto(); const cs2 = $('camautosel'); if (cs2) cs2.value = settings().camAuto ? '1' : '0'; }); syncAuto();
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
/* ───── selector de MODO DE JUEGO (Shooter / Combo): menú principal, Huésped, Opciones y Pausa ───── */
function syncModeUI() {
  const select = $('essentialpower'); if (select) { select.closest('label')?.classList.toggle('hidden', session?.game?.skillLevel != null); select.value = essentialPower(gameMode(), settings().essentialPowers?.[`${myChar()}:${gameMode()}`]); const slots = habSlots(myChar(), gameMode()); for (const option of select.options) { option.textContent = option.value === 'ability' ? 'Poder de equipo' : slots[option.value === 'esp' ? 1 : 2]?.name || option.value; } }
  const m = settings().mode === 'combo' ? 'combo' : 'shooter', G = GAME_MODES[m], note = m === 'combo' && gameMode() !== 'combo' ? ' (sólo con Huéspedes)' : '';
  const mi = $('modeitem'); if (mi) { mi.dataset.mode = m; mi.querySelector('b').textContent = `Modo de juego: ${G.icon} ${G.name}`; mi.querySelector('small').textContent = (m === 'combo' ? 'Dos ataques encadenados + una habilidad' : 'Disparás, apuntás y usás habilidades') + note; }
  const hb = $('hsmode'); if (hb) { hb.textContent = `Modo: ${G.icon} ${G.name}`; hb.title = G.desc + note; }
  const sel = $('modesel'); if (sel) sel.value = m;
  const pb = $('modetoggle'); if (pb) pb.querySelector('b').textContent = `Modo de juego: ${G.icon} ${G.name}`;
}
function syncCamLabel() { const b = $('camtoggle'); if (b) b.querySelector('b').textContent = `Cámara: ${renderer.third ? 'tercera persona (te ves)' : 'primera persona'}`; }
/** Cambiar de modo ya NO fuerza la cámara (salvo el ajuste «Cámara automática por modo»). */
function setGameMode(m) { const mm = m === 'combo' ? 'combo' : 'shooter'; settings().modes[myChar()] = mm; setSetting('mode', mm); if (session && !session.base && settings().camAuto) { renderer.setThird(camaraInicial(gameMode(), true)); setSetting('third', renderer.third); syncCamLabel(); } syncModeUI(); touch.setMode(gameMode(), myChar()); if (session) keyHint(); }
/** Botón MODO (táctil), Tab (PC) o Select (mando): alterna Disparo ↔ Melé al instante, sin pausar. Hay una espera corta para no cambiar sin querer. */
let modoT = -1e9;
function cambiarModo() {
  if (!session || session.intro || session.ended) return false;
  if (!(CHARACTERS[myChar()] && CHARACTERS[myChar()].host)) { banner('Este personaje solo juega en modo Disparo', 1400); return false; }
  const ahora = performance.now(); if (ahora - modoT < MODO_ESPERA * 1000) return false;
  modoT = ahora; const nuevo = gameMode() === 'combo' ? 'shooter' : 'combo'; setGameMode(nuevo); sound.ui('ok');
  const nom = `Modo ${MODOS[nuevo].nombre}`; if (session.touch) touch.showTip(document.querySelector('#touch [data-a="mode"]'), nom); else banner(`${MODOS[nuevo].icono} ${nom.toUpperCase()}`, 800);
  document.body.classList.remove('modo-swap'); void document.body.offsetWidth; document.body.classList.add('modo-swap'); setTimeout(() => document.body.classList.remove('modo-swap'), 360);   // el HUD se reordena con una transición corta
  return true;
}
/** Pista de teclas en pantalla (PC): una línea que cambia con el modo. `mostrarAviso` = avisa si se prendió o apagó. */
function keyHint(aviso = false) {
  let el = $('keyhint'); if (!el) { el = document.createElement('div'); el.id = 'keyhint'; $('hud').appendChild(el); }
  const on = !!settings().showKeys && !(session && session.touch), combo = gameMode() === 'combo';
  el.classList.toggle('on', on);
  el.textContent = combo ? 'Clic izq. ATAQUE 1 · Clic der. ATAQUE 2 · F/1 HAB.1 · G/2 HAB.2 · Z/Q/3 HAB.3 · T ulti · E usar · Tab → Disparo · K ocultar'
    : 'Clic izq. disparar · F HAB.1 · G/clic der. HAB.2 · Z HAB.3 · T ulti · R recargar · V melé · Tab → Melé · K ocultar';
  if (session?.game?.skillLevel != null) el.textContent = `Clic izq. ${combo ? 'golpe ligero · clic der. golpe fuerte' : 'disparar · V melee'} · Espacio saltar · F defensa · Q/G apoyo (oleada 1) · T ulti (oleada 3) · E usar · Tab cambiar modo · K ocultar`;
  if (aviso && !(session && session.touch)) banner(on ? 'Pista de teclas: activada (K la oculta)' : 'Pista de teclas: oculta (K la muestra)', 1200);
}
const toggleMode = (e) => { if (e) e.stopPropagation(); setGameMode(settings().mode === 'combo' ? 'shooter' : 'combo'); sound.ui('ok'); };
for (const id of ['modeitem', 'hsmode', 'modetoggle']) { const b = $(id); if (b) b.addEventListener('click', toggleMode); }
{ const sel = $('modesel'); if (sel) sel.addEventListener('change', () => setGameMode(sel.value)); }
{ const _rh = ui.refreshHuesped.bind(ui); ui.refreshHuesped = () => { _rh(); syncModeUI(); }; }
syncModeUI();
// al terminar de editar los botones, se reanuda la partida
const _tEdit = touch.edit.bind(touch); touch.edit = (on) => { _tEdit(on); if (!on && session && session.paused && session.practice) { session.paused = false; } };
$('showctl').addEventListener('click', (e) => { e.stopPropagation(); showTutorial(true); if (!(session && session.touch)) { setSetting('showKeys', true); keyHint(); } });   // «Ver controles» también deja la pista de teclas en pantalla (K la oculta)
$('tomenu').addEventListener('click', () => { if (session && session.net) { try { session.net.salir(); } catch { /* ya cerrado */ } try { sessionStorage.removeItem('arcanum.sala.v1'); } catch { /* nada */ } const u = new URL(location.href); u.searchParams.delete('sala'); location.replace(u.href); return; } location.reload(); });
$('tobase').addEventListener('click', () => { const u = new URL(location.href); for (const k of ['auto', 'bot', 'wave', 'god', 'horde', 'look', 'prologo']) u.searchParams.delete(k); u.searchParams.set('state', 'base'); location.href = u.href; });   // «Entrar a la Base» al terminar una partida
{ const bs = $('basesel'); if (bs) { bs.value = settings().baseAlTerminar === false ? '0' : '1'; bs.addEventListener('change', () => setSetting('baseAlTerminar', bs.value === '1')); } }
$('again').addEventListener('click', () => {
  if (session.mode === 'coop') { session.net.send({ t: 'restart' }); return; }
  startSolo(session.campaign || session.map, { campaign: session.campaign, intro: false });
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !params.get('auto') && location.hostname !== 'localhost') navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});

// Modos automáticos para pruebas visuales y de rendimiento: ?auto=m1&bot=1&wave=3&god=1
if (params.get('prologo') && !params.get('auto')) loadAnd(() => startSolo('m1', { campaign: 'm1' })); // ?prologo=1 fuerza el prólogo (entra directo a la campaña)
if (params.get('state') === 'base' && !params.get('auto')) startBase();   // ?state=base: directo al Santuario
if (params.get('auto') === 'base') { startBase(); window.__session = session; window.__renderer = renderer; }
else if (params.get('auto')) {
  startSolo(params.get('auto'), { bot: params.get('bot') === '1', wave: +params.get('wave') || 0, god: params.get('god') === '1', horde: params.get('horde') === '1', seed: +params.get('seed') || 7, skill: +params.get('skill') || 1.2, difficulty: +params.get('difficulty') || 1, intro: false });
  window.__session = session; window.__renderer = renderer;
}
window.__api = { probarHibrido: (vb1) => { loadAnd(() => startSolo('m1', { intro: false, practice: true, char: 'laboratorio', lab: vb1 })); }, ui, pad, setSetting, setGameMode, gameMode, settings, get session() { return session; }, get caida() { return caida; }, renderer, MONSTERS, touch, setQuality, get level() { return level; }, subs };
window.__frame = frame; window.__step = (ms) => frame(last + ms); window.__ui = ui; if (!params.get('cap')) requestAnimationFrame(frame);

// Cooperativo: la dirección del servidor sale de ?server=, de Opciones, de public/config.json o del propio sitio (src/client/servidor.js).
const coopUI = createCoopUI({
  $, ui, params, CHARACTERS, HOST_IDS: Object.keys(CHARACTERS).filter((id) => CHARACTERS[id].host), posee: (id) => poseeHuespedSim(Perfil.perfil(), id),
  nombre: () => Story.NAME, charActual: () => Equipo.char, gesto: () => { try { sound.init(); sound.resume(); } catch { /* sin audio */ } },
  modoDe: (ch) => modoElegido(ch), ponerModo: (ch, m) => { const S = settings(); setSetting('modes', { ...(S.modes || {}), [ch]: m }); setSetting('mode', m); try { ui.refreshHuesped(); } catch { /* menú no listo */ } },
  elegirChar: (ch) => { if (ch !== Equipo.char) { Equipo.char = ch; saveEquipo(); try { ui.refreshHuesped(); } catch { /* menú no listo */ } } },
  cargaDe: (modo) => { const ch = Equipo.char, P = Perfil.paraPartida(ch); return { name: Story.NAME, char: ch, slots: Equipo.slots, mode: modo || modoElegido(ch), fauna: Perfil.faunaDeLaSala(), arbol: P.arbol, equip: P.equip, pity: P.pity, sigs: P.sigs, melee: P.melee, evo: P.evo, path: P.path, bend: P.bend, herb: P.herb, maestria: P.maestria, lab: P.lab, style: settings().style }; },
  onEmpezar: startCoopGame, banner, enPartida: () => !!(session && session.mode === 'coop'),
  volverAlLobby: () => location.reload(),   // «Otra vez» tras el final: se recarga y el enlace ?sala= devuelve a la sala de espera
});
{ const _coop = () => coopUI.mostrar(); ui.actions.coop = () => conPrimerHuesped(_coop); }
window.__coop = coopUI;
if (params.get('sala')) setTimeout(() => coopUI.autoUnirse(), 0);
