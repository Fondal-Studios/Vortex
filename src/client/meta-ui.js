// HUD de META: una línea arriba con lo que hay que hacer ahora, marcador de la mini-misión opcional, flecha al objetivo y guía de primera partida.
// Todo se alimenta del snapshot (state.wave/left/obj/boss/mis); los textos viven en meta-texto.js (puro, con tests). Sin botones nuevos: nada tapa el HUD táctil.
import * as THREE from 'three';
import { metaActual, textoMision, metaMapa, PASOS_GUIA } from './meta-texto.js';
import * as Perfil from './perfil.js';

const SIN_GUIA = /[?&]guia=0\b/.test(typeof location !== 'undefined' ? location.search : '');

export function createMetaHud(host, ctx = {}) {
  const top = host.querySelector('#top') || host;
  const goal = document.createElement('div'); goal.id = 'goal'; goal.innerHTML = '<div class="g-main"></div><div class="g-next"></div>';
  const mision = document.createElement('div'); mision.id = 'mision'; mision.className = 'hidden';
  top.prepend(mision); top.prepend(goal);   // la meta va primero (arriba de todo)
  const gMain = goal.querySelector('.g-main'), gNext = goal.querySelector('.g-next');
  const guia = document.createElement('div'); guia.id = 'guia'; guia.className = 'hidden'; guia.innerHTML = '<span class="gu-txt"></span><button type="button" class="gu-skip">Saltar guía</button>';
  host.appendChild(guia);
  const flecha = document.createElement('div'); flecha.id = 'metaflecha'; flecha.className = 'hidden'; flecha.innerHTML = '<i>➤</i><span></span>';
  document.body.appendChild(flecha);
  const v = new THREE.Vector3();
  let cache = '', misCache = '', guiaT = 0, guiaOn = false, ultimo = null;

  const ocultarGuia = () => { guia.classList.add('hidden'); guiaOn = false; };
  const saltar = () => { Perfil.guiaSaltar(); ocultarGuia(); };
  guia.querySelector('.gu-skip').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); saltar(); });
  addEventListener('keydown', (e) => { if (e.code === 'KeyJ' && guiaOn) saltar(); });

  function mostrarPaso(p, touch) {
    Perfil.guiaVisto(p.id);
    guia.querySelector('.gu-txt').textContent = p.txt + (touch ? '' : '  [J: saltar guía]');
    guia.querySelector('.gu-skip').style.display = touch ? '' : 'none';
    guia.classList.remove('hidden'); guiaOn = true; guiaT = performance.now() + 10000;
  }
  /** ¿Toca algún paso de la guía ahora? (uno solo a la vez; nunca encima de un banner ni del cuadro de controles). */
  function pasoGuia(state, me, touch) {
    if (SIN_GUIA || ctx.sinGuia || guiaOn || !me) return;
    const ban = document.getElementById('banner'), tut = document.getElementById('tutorial');
    if ((ban && ban.classList.contains('on')) || (tut && !tut.classList.contains('hidden'))) return;
    const quiere = (id) => PASOS_GUIA.find((p) => p.id === id && Perfil.guiaPendiente(id));
    const w = state.wave || 0; let p = null;
    if (state.phase === 'intermission' && w === 0) p = quiere('meta');
    else if (state.phase === 'intermission' && me.cards && me.cards.length) p = quiere('mejora');
    else if (state.phase === 'wave' && state.obj && state.obj.state === 'active') p = quiere('objetivo');
    else if (state.phase === 'wave' && w >= state.waveTotal) p = quiere('jefe');
    if (p) mostrarPaso(p, touch);
  }

  /** Flecha hacia el punto del objetivo (state.obj.tg). Fuera de pantalla va al borde; en pantalla, sobre el objeto. */
  function apuntar(state, me, camera) {
    const tg = state.obj && state.obj.state === 'active' ? state.obj.tg : null;
    if (!tg || !me || me.dead || !camera) { flecha.classList.add('hidden'); return; }
    v.set(tg[0], tg[1], tg[2]).project(camera);
    const behind = v.z > 1, on = !behind && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.88, W = innerWidth, H = innerHeight;
    const d = Math.round(Math.hypot(tg[0] - me.pos[0], tg[1] - me.pos[1], tg[2] - me.pos[2]));
    flecha.classList.remove('hidden'); flecha.querySelector('span').textContent = `${d} m`;
    let x = v.x, y = v.y; if (behind) { x = -x; y = -y; }
    if (on) { flecha.classList.add('in'); flecha.style.transform = `translate(${(x * 0.5 + 0.5) * W}px, ${Math.max(100, (-y * 0.5 + 0.5) * H - 38)}px)`; flecha.querySelector('i').style.transform = 'rotate(90deg)'; return; }
    flecha.classList.remove('in');
    const ang = Math.atan2(y, x), s = Math.min(0.9 / Math.abs(Math.cos(ang) || 1e-6), 0.82 / Math.abs(Math.sin(ang) || 1e-6));
    flecha.style.transform = `translate(${(Math.cos(ang) * s * 0.5 + 0.5) * W}px, ${Math.max(100, (-Math.sin(ang) * s * 0.5 + 0.5) * H)}px)`;   // nunca tapa la línea de meta de arriba
    flecha.querySelector('i').style.transform = `rotate(${-ang}rad)`;
  }

  return {
    saltarGuia: saltar,
    /** Cada cuadro de HUD. `oculto` = campo de pruebas / introducción: no se muestra nada. */
    update(state, me, camera, { touch = false, oculto = false } = {}) {
      ultimo = state;
      if (oculto || !state) { goal.style.display = 'none'; mision.classList.add('hidden'); flecha.classList.add('hidden'); ocultarGuia(); return; }
      const m = metaActual(state, me);
      if (!m) { goal.style.display = 'none'; mision.classList.add('hidden'); flecha.classList.add('hidden'); ocultarGuia(); return; }
      goal.style.display = ''; goal.dataset.kind = m.kind;
      let next = m.next; const mm = ctx.solo ? metaMapa(state.map) : null;
      if (mm && m.kind === 'espera' && !state.wave) next = `Meta del mapa: vencé a ${mm.jefe} y liberá ${mm.nombre}`;
      if (mm && m.kind === 'jefe') next = `Premio: liberás ${mm.nombre} y elegís una bendición`;
      const key = m.main + '|' + next;
      if (key !== cache) { cache = key; gMain.textContent = m.main; gNext.textContent = next; }
      const mi = textoMision(state.mis), mk = mi ? mi.cls + mi.txt : '';
      if (mk !== misCache) { misCache = mk; if (mi) { mision.textContent = mi.txt; mision.className = mi.cls; } else mision.className = 'hidden'; }
      apuntar(state, me, camera);
      if (guiaOn && performance.now() > guiaT) ocultarGuia();
      else pasoGuia(state, me, touch);
    },
    /** Evento 'mision' de la simulación: aviso de cumplida / perdida. */
    evento(e, banner, sound) {
      mision.classList.remove('pop'); void mision.offsetWidth; mision.classList.add('pop');
      if (e.ph === 'done') { sound.objective(true); banner(`¡MISIÓN CUMPLIDA! +${e.rc} núcleos`, 2600); }
      // No interrumpir el combate para anunciar un desafío opcional fallido.
    },
  };
}
