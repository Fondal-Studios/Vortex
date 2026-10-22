// Controles táctiles (iPhone / Android) al estilo de los shooters móviles competitivos:
//  · palanca virtual IZQUIERDA flotante, sólo para caminar (empujarla al borde = correr);
//  · cámara libre con el pulgar DERECHO: movimiento RELATIVO del dedo (sin inercia, sin suavizado, sin saltos al apoyar);
//  · cada dedo conserva su función desde que toca la pantalla (palanca / cámara / botón) aunque cruce otras zonas;
//  · disparo y movimiento y cámara a la vez (multitáctil); arrastrar desde DISPARO también apunta;
//  · sensibilidad horizontal y vertical independientes, multiplicadores de ADS y mira óptica, aceleración opcional, giroscopio opcional;
//  · botones reubicables y redimensionables (modo «Editar controles»), transparencia, preajustes de 2/3/4 dedos.
// DOS MODOS en partida (docs/CONTROLES.md): Disparo y Melé. Un botón MODO los alterna al instante; cada modo muestra SÓLO sus botones.
//  · el botón grande es el ataque principal (Disparo: DISPARAR · Melé: ATAQUE 1 que encadena el combo);
//  · el pequeño de arriba es RECARGAR (Disparo) o ATAQUE 2 (Melé); HAB.1, HAB.2 y HAB.3 se ven siempre, en arco alrededor del ataque.
// Todo se guarda en settings.js. La cámara depende sólo de píxeles recorridos (no de los FPS).
import { settings, setSetting, save, resetLayout } from './settings.js';
import { essentialActions, essentialPower, expandEssentialInput } from './essential-controls.js';
import { fuentes, MODOS } from '../sim/modos.js';   // qué habilidad hay en cada slot según el modo (Disparo / Melé)

const BTN = [
  // id, clase, icono, rótulo, tipo ('hold' | 'toggle' | 'tap'), arrastra la cámara
  ['fire', 'tc-fire', '◉', 'DISPARAR', 'hold', true],       // Disparo: DISPARAR · Melé: ATAQUE 1 (arrastrarlo también apunta)
  ['fireL', 'tc-fireL', '◉', 'DISPARAR', 'hold', true],     // el mismo ataque principal, del lado izquierdo (3 y 4 dedos)
  ['ads', 'tc-ads', '◎', 'APUNTAR', 'hold', false],
  ['jump', 'tc-jump', '⤒', 'SALTO', 'hold', false],
  ['crouch', 'tc-crouch', '⤓', 'AGACHAR', 'toggle', false],
  ['mov', 'tc-mov', '⇢', 'HAB.1', 'hold', false],
  ['esp', 'tc-esp', '✦', 'HAB.2', 'hold', false],
  ['s3', 'tc-s3', '❖', 'HAB.3', 'hold', false],
  ['ult', 'tc-ult', '★', 'ULTI', 'hold', false],
  ['reload', 'tc-reload', '↻', 'RECARGA', 'hold', false],   // Disparo: RECARGAR · Melé: ATAQUE 2 (Seraf: mantener = cargar la flecha)
  ['evo', 'tc-evo', '✺', 'EVOLUC.', 'hold', false],
  ['melee', 'tc-melee', '⚔', 'MELÉ', 'hold', false],         // Disparo: golpe rápido (mantener = pesado)
  ['ability', 'tc-ability', '✚', 'EQUIPO', 'hold', false],
  ['use', 'tc-use', '✋', 'USAR', 'hold', false],
  ['ping', 'tc-ping', '◆', '', 'hold', false],
  ['mode', 'tc-mode', '⌖', 'MODO', 'tap', false],           // alterna Disparo ↔ Melé al instante (con una pequeña espera)
  ['pause', 'tc-pause', '❚❚', '', 'tap', false],
];
// Esencial: ataque, salto, un poder y MODO (+ pausa). USAR sustituye al poder.
// El preset completo conserva los ataques y habilidades adicionales de ambos modos.
//  · contextuales (CTX): aparecen sólo cuando sirven (definitiva cargada, algo para usar, evolución lista);
//  · modo avanzado (setting `advanced`, sólo Disparo): apuntar, agachar, equipo y señalar.
// Correr es automático (palanca al máximo) y el arma se cambia tocando/deslizando la barra de armas de abajo (sólo Disparo).
const BASIC = ['fire', 'reload', 'melee', 'jump', 'mov', 'esp', 's3', 'mode', 'pause'];
const MELE = ['fire', 'reload', 'jump', 'mov', 'esp', 's3', 'mode', 'pause'];
const ADV = ['ads', 'crouch', 'ability', 'ping'];
const CTX = ['ult', 'use', 'evo'];
const TAP = new Set(['pause', 'mode', 'prev', 'next']);   // botones de un solo toque (no se mantienen)
/** Rótulo e icono que cambian con el modo (el resto de los botones se llama igual en los dos). */
const POR_MODO = {
  shooter: { fire: ['◉', 'DISPARAR'], fireL: ['◉', 'DISPARAR'], reload: ['↻', 'RECARGA'] },
  combo:   { fire: ['⚔', 'ATAQUE 1'], fireL: ['⚔', 'ATAQUE 1'], reload: ['✦', 'ATAQUE 2'] },
};
const ICONO_SRC = { mov: '⇢', esp: '✦', s3: '❖', hab: '✺' };   // icono de cada habilidad según de dónde viene (Melé: la principal es ✺)
const SHOW = (fingers, advanced, combo) => (combo ? [...MELE, ...(fingers >= 3 ? ['fireL'] : [])] : [...BASIC, ...(fingers >= 3 ? ['fireL'] : []), ...(advanced ? ADV : [])]);
const STICK_R = 58;             // radio del recorrido de la palanca (px CSS)
const STICK_DEAD = 0.1;         // zona muerta (fracción)

export class TouchControls {
  constructor(host, { onPause, onWeapon, onMode } = {}) {
    this.host = host; this.onPause = onPause; this.onWeapon = onWeapon;
    this.mode = 'shooter'; this.char = ''; this.onMode = onMode; this.reset(true); this.enabled = false; this.editing = false; this.ptrs = new Map();
    this.zoomKind = 0;           // 0 = sin zoom · 1 = ADS común · 2 = mira óptica
    this.gyroOn = false; this.build(); this.applyLayout();
  }
  /* ───── estado de entrada ───── */
  reset(first = false) {
    this.mx = 0; this.mz = 0; this.dyaw = 0; this.dpitch = 0; this.weapon = -1;
    this.st = { fire: false, fireL: false, ads: false, jump: false, crouch: false, dash: false, mov: false, esp: false, s3: false, ult: false, melee: false, reload: false, evo: false, ability: false, use: false, ping: false, };
    this.heldSince = {};
    this.dashStick = false; this.adsToggled = false; this.ctx = this.ctx || {};
    if (!first) { this.ptrs.clear(); this.stick.classList.add('hidden'); this.host.querySelectorAll('.on').forEach((b) => b.classList.remove('on')); }
  }
  get fire() { return this.st.fire || this.st.fireL; }
  /** Compatibilidad: sensibilidad base horizontal (rad/px). */
  setSens(v) { setSetting('sensX', v); }

  /* ───── construcción ───── */
  build() {
    const h = this.host;
    h.innerHTML = `<div class="tc-zone tc-left"></div><div class="tc-zone tc-right"></div><div class="tc-stick hidden"><i></i></div>` +
      BTN.map(([id, cls, ic, label]) => `<button class="tc-btn ${cls}" data-a="${id}" type="button" aria-label="${label || id}"><span class="ic">${ic}</span>${label ? `<small>${label}</small>` : ''}</button>`).join('') +
      `<div class="tc-tip hidden"></div><div class="tc-edit hidden"><b>EDITAR CONTROLES</b><span>Arrastrá un botón · tocá para elegirlo</span>
        <label>Tamaño <input type="range" id="tcSize" min="60" max="180" value="100"></label>
        <label>Transparencia <input type="range" id="tcOp" min="25" max="100" value="85"></label>
        <button type="button" id="tcReset">Restablecer</button><button type="button" id="tcDone" class="ok">Listo</button></div>`;
    this.$ = (s) => h.querySelector(s); this.stick = this.$('.tc-stick'); this.knob = this.stick.querySelector('i'); this.editBox = this.$('.tc-edit'); this.tip = this.$('.tc-tip');
    const opts = { passive: false };
    h.addEventListener('pointerdown', (e) => this.down(e), opts);
    addEventListener('pointermove', (e) => this.move(e), opts); addEventListener('pointerup', (e) => this.up(e)); addEventListener('pointercancel', (e) => this.up(e));
    h.addEventListener('lostpointercapture', (e) => this.up(e));
    addEventListener('blur', () => this.reset()); document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    h.addEventListener('contextmenu', (e) => e.preventDefault());
    this.$('#tcSize').addEventListener('input', (e) => this.setSelectedSize(+e.target.value / 100));
    this.$('#tcOp').addEventListener('input', (e) => { setSetting('hudOpacity', +e.target.value / 100); this.applyLayout(); });
    this.$('#tcReset').addEventListener('click', () => { resetLayout(); this.applyLayout(); });
    this.$('#tcDone').addEventListener('click', () => this.edit(false));
  }
  show(on) { this.enabled = on; this.host.classList.toggle('hidden', !on); document.body.classList.toggle('touch-ui', !!on); if (!on) { this.reset(); this.edit(false); } }

  /* ───── diseño personalizado ───── */
  setSkillLevel(level) { if (this.skillLevel !== level) { this.skillLevel = level; this.reset(); this.applyLayout(); } }
  applyLayout() {
    const s = settings(), basic = this.skillLevel != null || !s.advanced, vis = new Set(this.skillLevel != null ? ['fire','jump','mode','pause', ...(this.ctx?.use ? ['use'] : []), ...(this.skillLevel >= 1 ? ['esp'] : []), ...(this.skillLevel >= 2 ? ['ult'] : [])] : basic ? essentialActions(this.mode, this.ctx, s.essentialPowers?.[`${this.char}:${this.mode}`]) : SHOW(s.fingers, true, this.mode === 'combo'));
    document.body.dataset.essentialPower = essentialPower(this.mode, s.essentialPowers?.[`${this.char}:${this.mode}`]);
    this.relabel(); this.host.classList.toggle('essential', basic); document.body.classList.toggle('hud-focused', basic);
    this.host.style.setProperty('--hud-op', String(s.hudOpacity)); this.host.style.setProperty('--hud-s', String(s.hudScale));
    for (const [id] of BTN) { const el = this.$(`[data-a="${id}"]`), l = s.layout[id] || {}; if (!el) continue; el.style.setProperty('--dx', `${l.dx || 0}px`); el.style.setProperty('--dy', `${l.dy || 0}px`); el.style.setProperty('--s', String((l.s || 1) * s.hudScale)); el.classList.toggle('tc-off', basic ? !vis.has(id) : CTX.includes(id) ? !(this.ctx[id] || this.editing || this.ctxForce) : !(vis.has(id) || this.editing && this.mode !== 'combo' && ADV.includes(id) && s.advanced)); el.classList.toggle('tc-ctx', CTX.includes(id)); }
    const op = this.$('#tcOp'); if (op) op.value = Math.round(s.hudOpacity * 100);
  }
  edit(on) {
    this.editing = on; this.host.classList.toggle('editing', on); this.editBox.classList.toggle('hidden', !on); this.sel = null;
    this.host.querySelectorAll('.tc-btn.sel').forEach((b) => b.classList.remove('sel')); if (!on) save();
    if (on) this.reset();
    this.applyLayout();
  }
  setSelectedSize(k) { if (!this.sel) return; const s = settings(); (s.layout[this.sel] ||= {}).s = k; this.applyLayout(); }
  /** Botones contextuales: { ult, use, evo } = ¿sirven ahora? Sólo repinta cuando algo cambia. */
  setContext(c) {
    // No sustituir la acción bajo un dedo que ya está apoyado.
    if (!settings().advanced && ['esp','s3','ability','use'].some(k => this.st[k])) c = { ...c, use: !!this.ctx?.use };
    this.ctx = this.ctx || {}; const wasUse = !!this.ctx.use; let ch = false; for (const k of CTX) { const v = !!c[k]; if (this.ctx[k] !== v) { this.ctx[k] = v; ch = true; if (!v && this.st[k]) { this.st[k] = false; this.host.querySelector(`[data-a="${k}"]`)?.classList.remove('on'); } } }
    if (ch) { if (!settings().advanced && wasUse !== this.ctx.use) { this.st.esp = this.st.s3 = this.st.ability = this.st.use = false; this.heldSince = {}; } this.applyLayout(); }
  }
  /** Modo de combate: 'shooter' (Disparo) o 'combo' (Melé). Cambia los botones, sus rótulos y el HUD con una animación corta. `char` = Huésped (para los iconos de HAB.1/2/3). */
  setMode(m, char) {
    m = m === 'combo' ? 'combo' : 'shooter'; if (char != null) char = char || '';
    const cambio = this.mode !== m, otro = char != null && char !== this.char; if (!cambio && !otro) return;
    this.mode = m; if (char != null) this.char = char;
    this.host.classList.toggle('combo-mode', m === 'combo'); this.host.classList.toggle('mode-shooter', m !== 'combo');
    if (cambio) { this.reset(); this.swap(); }
    this.relabel(); this.applyLayout();
  }
  /** Rótulos e iconos según el modo y el Huésped (HAB.3 de Melé = la habilidad principal ✺). */
  relabel() {
    const set = (id, ic, label) => { const el = this.$(`[data-a="${id}"]`); if (!el) return; const i = el.querySelector('.ic'), sm = el.querySelector('small'); if (i && i.textContent !== ic) i.textContent = ic; if (sm && label && sm.textContent !== label) sm.textContent = label; };
    for (const [id, [ic, label]] of Object.entries(POR_MODO[this.mode])) { set(id, ic, label); const el = this.$(`[data-a="${id}"]`); if (el && el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label); }
    const src = fuentes(this.char, this.mode); ['mov', 'esp', 's3'].forEach((id, i) => set(id, ICONO_SRC[src[i]] || '•', !settings().advanced ? 'PODER' : `HAB.${i + 1}`));
    if (!settings().advanced) { const power = essentialPower(this.mode, settings().essentialPowers?.[`${this.char}:${this.mode}`]); set(power, '✦', this.ctx?.ult ? 'PODER · ULTI' : 'PODER'); } else set('ability', '✚', 'EQUIPO');
    if (this.skillLevel != null) { set('esp', '✦', 'APOYO'); set('ult', '◆', 'ULTI'); }
    const M = MODOS[this.mode]; set('mode', M.icono, 'MODO'); const mb = this.$('[data-a="mode"]'); if (mb) mb.setAttribute('aria-label', `Modo ${M.nombre}: tocá para cambiar`);
  }
  /** Animación corta al cambiar de modo: los botones nuevos «brotan». */
  swap() {
    this.host.classList.add('tc-swap'); clearTimeout(this.swapT); this.swapT = setTimeout(() => this.host.classList.remove('tc-swap'), 320);
  }
  /** Anillo de espera del botón MODO (0..1; 1 = listo). */
  setModeCd(p) { const b = this.$('[data-a="mode"]'); if (!b) return; b.dataset.ring = '1'; b.style.setProperty('--p', String(Math.max(0, Math.min(1, p)).toFixed(3))); b.style.setProperty('--rc', '#ffe27a'); b.classList.toggle('cd', p < 1); }
  /** Nombre corto de una habilidad al tocar su botón (flota unos instantes sobre él). */
  showTip(el, text) {
    if (!this.tip || !el || !text) return; const r = el.getBoundingClientRect(), W = innerWidth;
    this.tip.textContent = text; this.tip.classList.remove('hidden'); this.tip.style.left = `${Math.max(70, Math.min(W - 70, r.left + r.width / 2))}px`; this.tip.style.top = `${Math.max(4, r.top - 6)}px`;
    this.tip.classList.remove('pop'); void this.tip.offsetWidth; this.tip.classList.add('pop'); clearTimeout(this.tipT); this.tipT = setTimeout(() => this.tip.classList.add('hidden'), 1100);
  }
  /** Cantidad de dedos (2/3/4): muestra u oculta los botones extra. */
  setFingers(n) { setSetting('fingers', n); this.applyLayout(); }

  /* ───── entrada ───── */
  down(e) {
    if (!this.enabled) return; e.preventDefault();
    const btnEl = e.target.closest ? e.target.closest('.tc-btn') : null;
    if (this.editing) { if (btnEl) this.editDown(e, btnEl); return; }
    if (btnEl && btnEl.classList.contains('tc-off')) return;
    const W = innerWidth, id = e.pointerId, now = e.timeStamp || performance.now();
    const p = { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, t: now, hist: [] };
    if (btnEl) {
      const def = BTN.find((b) => b[0] === btnEl.dataset.a); p.kind = 'btn'; p.act = def[0]; p.type = def[4]; p.look = def[5]; p.el = btnEl;
      this.ptrs.set(id, p); try { this.host.setPointerCapture(id); } catch { /* ok */ }
      this.press(p); return;
    }
    { const wi = this.weaponAt(e.clientX, e.clientY, false); if (wi >= 0) { p.kind = 'wbar'; p.last = wi; this.ptrs.set(id, p); try { this.host.setPointerCapture(id); } catch { /* ok */ } this.weapon = wi; return; } } // barra de armas: tocar elige, deslizar cambia
    if (e.clientX < W * 0.5) { // zona izquierda: SÓLO palanca
      if ([...this.ptrs.values()].some((q) => q.kind === 'move')) return;
      p.kind = 'move'; this.ptrs.set(id, p); try { this.host.setPointerCapture(id); } catch { /* ok */ }
      this.stick.style.left = `${e.clientX}px`; this.stick.style.top = `${e.clientY}px`; this.stick.classList.remove('hidden'); this.knob.style.transform = 'translate(-50%,-50%)'; return;
    }
    if ([...this.ptrs.values()].some((q) => q.kind === 'look')) return; // un solo dedo de cámara a la vez
    p.kind = 'look'; this.ptrs.set(id, p); try { this.host.setPointerCapture(id); } catch { /* ok */ }
  }
  /** Casilla de la barra de armas (#weapons) bajo el punto, o -1. `loose`: al deslizar, sólo cuenta la posición horizontal. */
  weaponAt(x, y, loose) {
    const bar = document.getElementById('weapons'); if (!bar || bar.offsetParent === null && getComputedStyle(bar).position !== 'fixed') return -1;
    const br = bar.getBoundingClientRect(); if (br.width < 4 || (!loose && (x < br.left - 4 || x > br.right + 4 || y < br.top - 12 || y > br.bottom + 12))) return -1;
    let best = -1, bd = 1e9; [...bar.children].forEach((c, i) => { const r = c.getBoundingClientRect(), d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0; if (d < bd) { bd = d; best = +c.dataset.i >= 0 ? +c.dataset.i : i; } });
    return !loose && bd > 6 ? -1 : best;
  }
  press(p) {
    const el = p.el, a = p.act;
    if (a === 'pause') { if (this.onPause) this.onPause(); return; }
    if (a === 'prev' || a === 'next') { el.classList.add('on'); if (this.onWeapon) this.weapon = this.onWeapon(a === 'next' ? 1 : -1); return; }
    el.classList.add('on');
    if (a === 'mode') { if (this.onMode) this.onMode(); return; }   // un solo toque: main.js decide (espera de ~0,6 s) y llama a setMode
    if (a === 'mov' || a === 'esp' || a === 's3' || a === 'ult') this.showTip(el, el.getAttribute('aria-label'));   // nombre corto al tocar
    if (p.type === 'toggle') { this.st[a] = !this.st[a]; el.classList.toggle('lock', this.st[a]); return; }
    if (a === 'ads' && settings().adsMode === 'alternar') { this.st.ads = !this.st.ads; el.classList.toggle('lock', this.st.ads); return; }
    this.heldSince[a] = performance.now();
    this.st[a] = true;
  }
  /** Sensibilidad efectiva: multiplicador según estemos apuntando (ADS) o con mira óptica. */
  mul() { const s = settings(); return this.st.ads ? (this.zoomKind === 2 ? s.scopeMul : s.adsMul) : 1; }
  move(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) { if (this.editing) this.editMove(e); return; } e.preventDefault();
    if (p.kind === 'edit') { this.editMove(e); return; } // editor: arrastrar el botón elegido
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : null, list = evs && evs.length ? evs : [e]; // todos los puntos intermedios: precisión en microajustes
    for (const ev of list) {
      const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
      if (p.kind === 'wbar') { const wi = this.weaponAt(p.x, p.y, true); if (wi >= 0 && wi !== p.last) { p.last = wi; this.weapon = wi; } } else if (p.kind === 'move') this.stickMove(p);
      else if (p.kind === 'look' || (p.kind === 'btn' && p.look)) this.look(p, dx, dy, ev.timeStamp || performance.now());
    }
  }
  stickMove(p) {
    const vx = p.x - p.ox, vy = p.y - p.oy, l = Math.hypot(vx, vy) || 1, k = Math.min(1, l / STICK_R), kk = k < STICK_DEAD ? 0 : (k - STICK_DEAD) / (1 - STICK_DEAD);
    this.mx = (vx / l) * kk; this.mz = -(vy / l) * kk; this.dashStick = k > 0.97;
    this.knob.style.transform = `translate(calc(-50% + ${(vx / l) * Math.min(l, STICK_R)}px), calc(-50% + ${(vy / l) * Math.min(l, STICK_R)}px))`;
  }
  /** Cámara: giro = píxeles × sensibilidad (× multiplicador de ADS) (× aceleración opcional). Nada de filtros. */
  look(p, dx, dy, t) {
    const s = settings(); let g = 1;
    if (s.accel) { // velocidad del dedo en px/ms sobre los últimos ~60 ms
      p.hist.push([t, Math.hypot(dx, dy)]); while (p.hist.length > 1 && t - p.hist[0][0] > 60) p.hist.shift();
      const dt = Math.max(8, t - p.hist[0][0]), v = p.hist.reduce((a, h) => a + h[1], 0) / dt;
      g = 1 + s.accelGain * Math.max(0, Math.min(1, (v - 0.35) / 2.0));
    }
    const m = this.mul() * g;
    this.dyaw += dx * s.sensX * m; this.dpitch += -dy * s.sensY * m * (s.invertY ? -1 : 1);
  }
  up(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) return; this.ptrs.delete(e.pointerId);
    if (p.kind === 'move') { this.mx = this.mz = 0; this.dashStick = false; this.stick.classList.add('hidden'); }
    if (p.kind === 'btn') {
      const a = p.act; delete this.heldSince[a]; if (!TAP.has(a)) {
        const stays = p.type === 'toggle' || (a === 'ads' && settings().adsMode === 'alternar');
        if (!stays) { this.st[a] = false; p.el.classList.remove('on'); } else p.el.classList.remove('on');
      } else p.el.classList.remove('on');
    }
  }

  /* ───── modo de edición ───── */
  editDown(e, el) {
    const id = el.dataset.a, s = settings(), l = (s.layout[id] ||= {}), p = { kind: 'edit', id, x: e.clientX, y: e.clientY, dx0: l.dx || 0, dy0: l.dy || 0, sx: e.clientX, sy: e.clientY, el };
    this.ptrs.set(e.pointerId, p); try { this.host.setPointerCapture(e.pointerId); } catch { /* ok */ }
    this.sel = id; this.host.querySelectorAll('.tc-btn.sel').forEach((b) => b.classList.remove('sel')); el.classList.add('sel'); this.$('#tcSize').value = Math.round((l.s || 1) * 100);
  }
  editMove(e) {
    const p = this.ptrs.get(e.pointerId); if (!p || p.kind !== 'edit') return; const l = settings().layout[p.id];
    l.dx = Math.round(p.dx0 + e.clientX - p.sx); l.dy = Math.round(p.dy0 + e.clientY - p.sy); this.applyLayout();
  }

  /* ───── giroscopio (opcional) ───── */
  async enableGyro(on) {
    setSetting('gyro', !!on); if (!on) { this.stopGyro(); return true; }
    try { if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') { const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') { setSetting('gyro', false); return false; } } } catch { setSetting('gyro', false); return false; }
    if (typeof DeviceMotionEvent === 'undefined') { setSetting('gyro', false); return false; }
    this.startGyro(); return true;
  }
  startGyro() {
    if (this.gyroH) return; this.gyroH = (e) => {
      if (!this.enabled || this.editing || !settings().gyro) return; const r = e.rotationRate; if (!r) return;
      const dt = (e.interval || 0.016) * (e.interval > 1 ? 0.001 : 1) , ang = (screen.orientation && screen.orientation.angle != null ? screen.orientation.angle : window.orientation) || 0, sgn = ang === 270 || ang === -90 ? -1 : 1;
      const k = (Math.PI / 180) * dt * settings().gyroSens * this.mul(); // grados/s → radianes por intervalo
      // en horizontal el eje vertical del mundo es el eje X del teléfono (beta) y el cabeceo es el eje Y (gamma)
      this.dyaw += -(r.beta || 0) * k * sgn; this.dpitch += (r.gamma || 0) * k * sgn * (settings().invertY ? -1 : 1);
    };
    addEventListener('devicemotion', this.gyroH);
  }
  stopGyro() { if (this.gyroH) { removeEventListener('devicemotion', this.gyroH); this.gyroH = null; } }

  /** Entrada de este cuadro (los acumulados de giro se consumen). */
  read() {
    const s = this.st, combo = this.mode === 'combo', atk = s.fire || s.fireL, i = { mx: this.mx, mz: this.mz, dyaw: this.dyaw, dpitch: this.dpitch, jump: s.jump, fire: !combo && atk, dash: s.dash || !!this.dashStick, weapon: this.weapon, ability: s.ability, interact: s.use, ping: s.ping, mov: s.mov, esp: s.esp, s3: s.s3, ult: s.ult, melee: !combo && s.melee, reload: !combo && s.reload, evo: s.evo, ads: s.ads, crouch: s.crouch, a1: combo && atk, a2: combo && s.reload, hab: false, mode: this.mode };   // Melé: el botón grande es A1 y el pequeño A2; HAB.3 (s3) la traduce la simulación
    this.dyaw = this.dpitch = 0; this.weapon = -1;
    if (this.skillLevel != null) { const held = performance.now() - (this.heldSince?.fire ?? performance.now()); if (combo && i.a1 && held >= 360) { i.a1 = false; i.a2 = true; } return i; }
    if (settings().advanced) return i;
    const now = performance.now(), held = Object.fromEntries(Object.entries(this.heldSince || {}).map(([k,t]) => [k, now-t]));
    return expandEssentialInput(i, held, this.mode, essentialPower(this.mode, settings().essentialPowers?.[`${this.char}:${this.mode}`]));
  }
}
