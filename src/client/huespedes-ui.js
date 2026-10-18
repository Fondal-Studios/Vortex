// Pantalla «ELEGÍ TU HUÉSPED» (previa a la partida). Se engancha en el menú (ui.js: pantalla `huesped`).
//   · riel con los 5 Huéspedes + sección secundaria «Veteranos» (los 6 héroes anteriores, `legacy`)
//   · escenario 3D propio (canvas, src/client/huespedes-view.js): gira solo, se arrastra para girarlo
//   · nombre, título, rol, dificultad de uso, historia breve, barras de estadísticas comparables, habilidades y «Demostración»
//   · «Elegir» guarda el Huésped (Equipo.char → localStorage `cristal.huesped.v1`) y vuelve; «‹ Volver» lo pone ui.js
// El panel de información tiene scroll interno: la cabecera, el 3D y los botones nunca se tapan entre sí. Estilos: public/huespedes.css.
import { CHARACTERS, CHARACTER_IDS, HOST_IDS, ROLES } from '../sim/data.js';
import { Equipo, saveEquipo } from './equipo.js';
import { GLYPHS, HERO_LORE, HERO_STATS } from './heroes-ui.js';
import { buildHostEvo, REGIONS } from './huespedes-evo.js';
import * as Perfil from './perfil.js';
import { tickMenuBeat } from './shaders.js';
import { loadEnvHDRI } from './ph.js';

const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const ROLE_ES = { asalto: 'Asalto', asesina: 'Asesina', tanque: 'Tanque', control: 'Control', 'híbrido': 'Híbrido' };
const STAT_ES = { dano: 'Daño', resistencia: 'Resistencia', movilidad: 'Movilidad', control: 'Control', utilidad: 'Utilidad', dificultad: 'Dificultad' };
const STAT_KEYS = ['dano', 'resistencia', 'movilidad', 'control', 'utilidad', 'dificultad'];
const FRAME = { axioma: [1.15, 2.7, 2.0], vesper: [0.95, 2.1, 3.0], micelio: [1.35, 3.5, 3.0], umbra: [1.3, 3.1, 2.6], seraf: [1.2, 3.1, 3.0] }; // [centro y, alto a encuadrar, ancho a encuadrar]
const FRAME_H = { axioma: [1.02, 2.3, 1.7], vesper: [1.0, 2.25, 1.7], micelio: [1.25, 2.95, 2.2], umbra: [1.0, 2.3, 1.7], seraf: [1.0, 2.3, 2.0] }; // encuadre del cuerpo unificado: [centro y, alto, ancho]
const LEVEL = (d) => (d <= 3 ? 'Fácil' : d <= 6 ? 'Media' : d <= 8 ? 'Alta' : 'Experta');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const roleName = (c) => ROLE_ES[c.role] || (ROLES[c.role] && ROLES[c.role].name) || c.role;
const hosts = () => HOST_IDS.filter((id) => CHARACTERS[id]);
const vets = () => CHARACTER_IDS.filter((id) => CHARACTERS[id] && !CHARACTERS[id].host);

/** Estadísticas 0–10 de un personaje. Los veteranos sólo tienen 4 (1–5): se llevan a 10. */
function statsOf(id) {
  const c = CHARACTERS[id]; if (c.stats) return c.stats;
  const s = HERO_STATS[id] || [3, 3, 3, 3]; return { movilidad: s[0] * 2, dano: s[1] * 2, utilidad: s[2] * 2, control: s[3] * 2 };
}
function avgStats() {
  const out = {}; for (const k of STAT_KEYS) out[k] = hosts().reduce((a, id) => a + (CHARACTERS[id].stats[k] || 0), 0) / hosts().length; return out;
}
function abilitiesOf(id) {
  const c = CHARACTERS[id], L = [];
  const cd = (a) => (a.cd ? `Recarga ${a.cd} s` : '');
  if (c.host) {
    L.push(['Hab. 1', c.mov, cd(c.mov), 'skill'], ['Hab. 2', c.esp, cd(c.esp), 'skill'], ['Hab. 3', c.s3, cd(c.s3), 'skill']);
    L.push(['Definitiva', c.ult, `Se carga con el combate`, 'skill'], ['Pasiva', c.passive, '', 'idle']);
    const m = c.melee; L.push(['Melee', { name: 'Golpe ligero y pesado', desc: `Tocar = ligero (${m.light.dmg} de daño). Mantener = pesado (${m.heavy.dmg} de daño, alcance ${m.heavy.range} m).` }, '', 'melee']);
  } else { L.push(['Hab. 1', c.mov, cd(c.mov), 'skill'], ['Hab. 2', c.esp, cd(c.esp), 'skill']); const r = ROLES[c.role]; if (r) L.push(['Rol', { name: r.ability, desc: r.desc }, `Recarga ${r.cd} s`, 'skill']); }
  return L;
}

export function buildHuespedScreen(menu) {
  const root = menu.root.querySelector('#huesped'); if (!root) return;
  root.classList.add('hs');
  const chip = (id) => { const c = CHARACTERS[id]; return `<button class="hs-chip hs-nav" type="button" data-id="${id}" style="--c:${hex(c.color)}" aria-pressed="false"><i class="hs-dot"></i><span class="hs-cn"><b>${c.name}</b><small>${esc(roleName(c))}</small></span><em class="hs-ok" aria-hidden="true">✓</em></button>`; };
  root.innerHTML = `
    <button class="backbtn" type="button" aria-label="Volver al menú anterior"><span aria-hidden="true">‹</span> Volver</button>
    <div class="hs-wrap">
      <nav class="hs-rail" id="hsrail" aria-label="Huéspedes">
        <div class="hs-hosts">${hosts().map(chip).join('')}</div>
        <button class="hs-vettoggle hs-nav" type="button" id="hsvettoggle" aria-expanded="false">Veteranos <span aria-hidden="true">▾</span></button>
        <div class="hs-vets" id="hsvets" hidden>${vets().map(chip).join('')}</div>
      </nav>
      <section class="hs-center" aria-label="Vista del Huésped">
        <header class="hs-head">
          <h2 id="hsname"></h2><div class="hs-title" id="hstitle"></div>
          <div class="hs-tags"><span class="hs-tag" id="hsrole"></span><span class="hs-tag hs-diff" id="hsdiff"></span><span class="hs-tag hs-chosen" id="hschosen" hidden>✓ Tu Huésped</span></div>
        </header>
        <div class="hs-stage" id="hsstage"><canvas id="hscanvas" aria-label="Modelo 3D del Huésped: arrastrá para girarlo"></canvas><iframe id="hsframe" title="Vista del veterano" tabindex="-1" hidden></iframe><div class="hs-fallback" id="hsfb" hidden></div><div class="hs-region" id="hsregion" aria-live="off"></div></div>
        <div class="hs-actions"><button class="hs-btn hs-nav" type="button" id="hsdemo">Demostración</button><button class="hs-btn hs-main hs-nav" type="button" id="hspick">Elegir</button></div>
      </section>
      <aside class="hs-info" id="hsinfo" aria-label="Información del Huésped"></aside>
    </div>`;
  const $ = (s) => root.querySelector(s);
  $('.backbtn').addEventListener('click', (e) => { e.stopPropagation(); menu.back(); });
  const hs = menu.hs = { sel: null, host: null, THREE: null, renderer: null, failed: false, running: false, yaw: 0, user: 0, idle: 0, drag: null, demoT: [], quality: 'low' };
  const avg = avgStats();

  /* ───── 3D ───── */
  async function ensureThree() {
    if (hs.THREE || hs.failed) return;
    try {
      const THREE = await import('three'); const canvas = $('#hscanvas');
      const gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
      const coarse = matchMedia('(pointer: coarse)').matches; hs.quality = coarse || (window.__api && window.__api.level === 'low') ? 'low' : 'medium';
      gl.setPixelRatio(Math.min(devicePixelRatio || 1, hs.quality === 'low' ? 1.5 : 2)); gl.setClearColor(0x000000, 0);
      gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.2;
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
      const hemi = new THREE.HemisphereLight(0xd4daff, 0x3a1f55, 2.1), key = new THREE.DirectionalLight(0xfff1e0, 3.2), rim = new THREE.DirectionalLight(0xffffff, 2.4), kick = new THREE.DirectionalLight(0xffffff, 1);
      key.position.set(2.2, 3.4, 4); rim.position.set(-3, 2.4, -3.5); kick.position.set(3, 0.4, -2); scene.add(hemi, key, rim, kick);
      const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
      const pad = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, ...add, opacity: 0.18 })); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.005;
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.2, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, ...add, opacity: 0.7 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01;
      const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.83, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, ...add, opacity: 0.5 })); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.012;
      scene.add(pad, ring, ring2);
      Object.assign(hs, { THREE, renderer: gl, scene, cam, rim, kick, pad, ring, ring2 });
      loadEnvHDRI(gl, 'small_cathedral_02').then((t) => { scene.environment = t; scene.environmentIntensity = 0.9; }).catch(() => { /* sin cielo HDRI: luces simples */ });
      new ResizeObserver(() => resize()).observe($('#hsstage'));
    } catch (err) { hs.failed = true; console.warn('Huéspedes: sin 3D —', err.message); }
  }
  function frame() {
    const id = hs.sel, f = hs.host && hs.host.human ? FRAME_H[id] || [1.0, 2.3, 1.6] : FRAME[id] || [1, 2.4], st = $('#hsstage'), w = st.clientWidth, h = st.clientHeight; if (!hs.cam || w < 8 || h < 8) return;
    hs.renderer.setSize(w, h, false); hs.cam.aspect = w / h;
    const fov = hs.THREE.MathUtils.degToRad(hs.cam.fov), dH = (f[1] / 2) / Math.tan(fov / 2), dW = ((f[2] || f[1] * 0.62) / 2) / (Math.tan(fov / 2) * hs.cam.aspect);
    const d = Math.max(dH, dW) * 1.04; hs.cam.position.set(0, f[0] + 0.15, d); hs.cam.lookAt(0, f[0], 0); hs.cam.updateProjectionMatrix();
  }
  const resize = () => frame();
  function setModel(id) {
    if (hs.host) { hs.scene.remove(hs.host.group); hs.host.dispose(); hs.host = null; }
    const C = CHARACTERS[id], col = new hs.THREE.Color(C.color);
    hs.rim.color.copy(col).lerp(new hs.THREE.Color(0xffffff), 0.45); hs.kick.color.copy(col).lerp(new hs.THREE.Color(0xffffff), 0.2); for (const m of [hs.pad, hs.ring, hs.ring2]) m.material.color.copy(col);
    if (C.host) { hs.region = hs.region || 'm1'; hs.user = 0; hs.idle = 0; hs.regionT = 0; humanize(id); } // el MISMO cuerpo de la partida (huesped-cuerpo.js), con la evolución, el camino y los órganos del perfil
    frame();
  }
  /** Cuerpo unificado del Huésped (humano de ARCANUM + armadura/mutación, idle real). Si algo falla, queda la figura de respaldo (huespedes-limbo.js). */
  async function humanize(id) {
    const tok = hs.tok = (hs.tok || 0) + 1;
    try {
      if (!hs.hk) {
        const hm = await import('./humans.js'), mod = await import('./huesped-cuerpo.js'), ph = await import('./ph.js');
        hs.hk = { hm, mod, kit: await hm.loadHumanKit({ quality: hs.quality, movil: hs.quality === 'low' }) };
        ph.loadEnvHDRI(hs.renderer, 'small_cathedral_02').then((t) => { hs.scene.environment = t; hs.scene.environmentIntensity = 1.2; }).catch(() => {});
      }
      if (hs.sel !== id || tok !== hs.tok) return;
      const pp = Perfil.paraPartida(id), pl = { char: id, name: CHARACTERS[id].name, evo: pp.evo || 0, pth: pp.path || [], cg: pp.corg || [], mw: pp.melee || '' };
      const b = hs.hk.mod.createHostBody(hs.THREE, hs.hk.kit, pl, { quality: hs.quality, camera: hs.cam, map: hs.region });
      hs.scene.add(b.object); await b.ready;
      if (hs.sel !== id || tok !== hs.tok) { hs.scene.remove(b.object); b.dispose(); return; }
      if (hs.host) { hs.scene.remove(hs.host.group); hs.host.dispose(); }
      hs.host = { group: b.object, human: true, body: b, get map() { return b.map; }, setMap: (m) => b.setMap(m), update: (dt) => b.update(dt, pl, { speed: 0, pitch: 0, map: hs.region }), pose: (k) => { if (k === 'melee' || k === 'skill') b.event({ t: k }); }, dispose: () => b.dispose() };
      regionLabel(); frame();
    } catch (err) {
      console.warn('Huésped (selección): cuerpo unificado no disponible —', err.message);
      if (hs.sel === id && tok === hs.tok && !hs.host) { const pp = Perfil.paraPartida(id); hs.host = buildHostEvo(hs.THREE, id, { evo: pp.evo || 0, path: pp.path || [], organs: pp.corg || [], map: hs.region, quality: hs.quality }); hs.scene.add(hs.host.group); regionLabel(); frame(); }
    }
  }
  /** Etiqueta del aspecto regional (rota cada ~5 s entre los mapas: así se ven las variaciones del Huésped por folclore). */
  function regionLabel() { const el = $('#hsregion'); if (el) el.textContent = hs.host && hs.host.map && REGIONS[hs.host.map] ? `Aspecto: ${REGIONS[hs.host.map].name} · ${REGIONS[hs.host.map].note}` : ''; }
  const REG_ORDER = ['m1', 'm2', 'm3', 'm4', 'm5'];
  let last = 0;
  function loop(now) {
    if (!root.classList.contains('on') || document.hidden) { hs.running = false; return; }
    requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now; tick(dt, now / 1000);
  }
  function tick(dt, t) {
    if (!hs.renderer || !hs.host || $('#hscanvas').hidden) return;
    hs.idle += dt; if (!hs.drag && hs.idle > 2.5) hs.user += dt * 0.35;
    hs.host.group.rotation.y = -0.3 + hs.user + (hs.drag ? 0 : Math.sin(t * 0.5) * 0.12);
    hs.regionT = (hs.regionT || 0) + dt; if (hs.regionT > 5 && hs.host.setMap) { hs.regionT = 0; hs.region = REG_ORDER[(REG_ORDER.indexOf(hs.region) + 1) % REG_ORDER.length]; hs.host.setMap(hs.region); regionLabel(); }
    tickMenuBeat(t); hs.host.update(dt, t); hs.ring.rotation.z += dt * 0.4; hs.ring2.rotation.z -= dt * 0.25; hs.pad.material.opacity = 0.14 + Math.sin(t * 2) * 0.05;
    hs.renderer.render(hs.scene, hs.cam);
  }
  function start() { if (hs.running) return; hs.running = true; last = performance.now(); requestAnimationFrame(loop); }
  const cv = $('#hscanvas');
  cv.addEventListener('pointerdown', (e) => { hs.drag = { x: e.clientX, u: hs.user }; hs.idle = 0; try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ } });
  cv.addEventListener('pointermove', (e) => { if (hs.drag) { hs.user = hs.drag.u + (e.clientX - hs.drag.x) * 0.012; hs.idle = 0; } });
  const endDrag = () => { hs.drag = null; hs.idle = 0; };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

  /* ───── información ───── */
  function renderInfo(id) {
    const C = CHARACTERS[id], S = statsOf(id), story = C.story || (HERO_LORE[id] || []).join(' ') || C.desc || '';
    const keys = C.host ? STAT_KEYS : ['dano', 'resistencia', 'movilidad', 'control', 'utilidad'].filter((k) => k in S);
    const bars = keys.map((k) => `<div class="hs-stat${k === 'dificultad' ? ' hs-sd' : ''}"><span class="hs-sl">${STAT_ES[k]}</span><span class="hs-bar"><b style="width:${S[k] * 10}%"></b>${C.host && k !== 'dificultad' ? `<u style="left:${avg[k] * 10}%" title="Promedio de los Huéspedes"></u>` : ''}</span><em>${S[k]}/10</em></div>`).join('');
    const abs = abilitiesOf(id).map(([tag, a, cd, kind]) => `<button class="hs-ab" type="button" data-kind="${kind}"><span class="hs-at">${tag}</span><span class="hs-ax"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span>${cd ? `<small>${esc(cd)}</small>` : ''}</span></button>`).join('');
    $('#hsinfo').innerHTML = `<p class="hs-story">${esc(story)}</p><h4>Estadísticas</h4><div class="hs-stats">${bars}</div>${C.host ? '<p class="hs-legend"><u></u> promedio de los 5 Huéspedes</p>' : '<p class="hs-legend">Veterano: vista y datos del héroe anterior.</p>'}<h4>Habilidades</h4><div class="hs-abs">${abs}</div>`;
    $('#hsinfo').scrollTop = 0;
    root.querySelectorAll('.hs-ab').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); demo(b.dataset.kind); }));
  }
  function select(id, quiet) {
    if (!CHARACTERS[id]) id = 'axioma'; hs.sel = id; const C = CHARACTERS[id], vet = !C.host;
    root.style.setProperty('--c', hex(C.color)); root.dataset.sel = id;
    $('#hsname').textContent = C.name; $('#hstitle').textContent = C.title || C.desc || '';
    $('#hsrole').textContent = roleName(C);
    const d = C.stats ? C.stats.dificultad : null; const dd = $('#hsdiff'); dd.hidden = d == null;
    if (d != null) dd.innerHTML = `Dificultad: <b>${LEVEL(d)}</b> <span class="hs-pips" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<i class="${i < Math.ceil(d / 2) ? 'on' : ''}"></i>`).join('')}</span>`;
    $('#hschosen').hidden = Equipo.char !== id;
    root.querySelectorAll('.hs-chip').forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('sel', on); b.classList.toggle('chosen', b.dataset.id === Equipo.char); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    if (vet && $('#hsvets').hidden) toggleVets(true);
    renderInfo(id);
    // escenario: Huésped = 3D propio · veterano = vista de héroe existente
    const fr = $('#hsframe'), fb = $('#hsfb');
    cv.hidden = vet || hs.failed; fr.hidden = !vet; fb.hidden = vet || !hs.failed;
    if (hs.failed) fb.textContent = C.name.slice(0, 1);
    if (vet) {
      const url = new URL(`public/hero-view.html?char=${id}&q=low`, location.href.replace(/[^/]*$/, '')).href;
      if (!fr.dataset.k) { fr.dataset.k = id; fr.src = url; } else { try { fr.contentWindow.postMessage({ hv: 1, char: id }, '*'); } catch { /* ok */ } }
      if (hs.host && hs.scene) { hs.scene.remove(hs.host.group); hs.host.dispose(); hs.host = null; }
    } else if (hs.THREE) { setModel(id); hs.host && hs.host.pose('idle'); }
    if (!quiet) menu.sound.ui('tick');
  }
  function demo(kind) {
    hs.demoT.forEach(clearTimeout); hs.demoT = [];
    const C = CHARACTERS[hs.sel];
    if (!C.host) { try { $('#hsframe').contentWindow.postMessage({ hv: 1, play: 'cast' }, '*'); } catch { /* ok */ } menu.sound.ui('tick'); return; }
    if (!hs.host) return; menu.sound.ui('tick');
    if (kind === 'idle') return hs.host.pose('idle');
    if (kind === 'melee' || kind === 'skill') return hs.host.pose(kind);
    hs.host.pose('melee'); hs.demoT.push(setTimeout(() => hs.host && hs.host.pose('skill'), 1300));
  }
  function toggleVets(open) {
    const v = $('#hsvets'), t = $('#hsvettoggle'); const on = open === undefined ? v.hidden : open; v.hidden = !on; t.setAttribute('aria-expanded', on ? 'true' : 'false'); t.querySelector('span').textContent = on ? '▴' : '▾';
  }
  root.querySelectorAll('.hs-chip').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); select(b.dataset.id); }));
  $('#hsvettoggle').addEventListener('click', (e) => { e.stopPropagation(); menu.sound.ui('tick'); toggleVets(); });
  $('#hsdemo').addEventListener('click', (e) => { e.stopPropagation(); demo('both'); });
  $('#hspick').addEventListener('click', (e) => {
    e.stopPropagation(); Equipo.char = hs.sel; saveEquipo(); menu.sound.ui('ok');
    root.querySelectorAll('.hs-chip').forEach((b) => b.classList.toggle('chosen', b.dataset.id === Equipo.char)); $('#hschosen').hidden = false; menu.refreshHuesped && menu.refreshHuesped(); menu.back();
  });
  // el 3D descansa cuando la pantalla no se ve
  new MutationObserver(() => { if (root.classList.contains('on')) start(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && root.classList.contains('on')) start(); });

  /** Al entrar a la pantalla: parte del Huésped elegido (o Axioma) */
  hs.enter = async () => {
    select(CHARACTERS[Equipo.char] ? Equipo.char : 'axioma', true);
    await ensureThree();
    if (hs.failed) { select(hs.sel, true); return; }
    if (hs.THREE && CHARACTERS[hs.sel].host && !hs.host) setModel(hs.sel); start();
  };
  hs.select = select; hs.demo = demo;
}

export function showHuesped(menu) { if (menu.hs) menu.hs.enter(); }
