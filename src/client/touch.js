// Controles táctiles (iPhone / Android) al estilo de los shooters móviles competitivos:
//  · palanca virtual IZQUIERDA flotante, sólo para caminar (empujarla al borde = correr);
//  · cámara libre con el pulgar DERECHO: movimiento RELATIVO del dedo (sin inercia, sin suavizado, sin saltos al apoyar);
//  · cada dedo conserva su función desde que toca la pantalla (palanca / cámara / botón) aunque cruce otras zonas;
//  · disparo y movimiento y cámara a la vez (multitáctil); arrastrar desde DISPARO también apunta;
//  · sensibilidad horizontal y vertical independientes, multiplicadores de ADS y mira óptica, aceleración opcional, giroscopio opcional;
//  · botones reubicables y redimensionables (modo «Editar controles»), transparencia, preajustes de 2/3/4 dedos.
// Todo se guarda en settings.js. La cámara depende sólo de píxeles recorridos (no de los FPS).
import { settings, setSetting, save, resetLayout } from './settings.js';

const BTN = [
  // id, clase, icono, rótulo, tipo ('hold' | 'toggle' | 'tap'), arrastra la cámara
  ['fire', 'tc-fire', '◉', 'DISPARO', 'hold', true],
  ['fireL', 'tc-fireL', '◉', 'DISPARO', 'hold', true],
  ['ads', 'tc-ads', '◎', 'APUNTAR', 'hold', false],
  ['jump', 'tc-jump', '⤒', 'SALTO', 'hold', false],
  ['crouch', 'tc-crouch', '⤓', 'AGACHAR', 'toggle', false],
  ['mov', 'tc-mov', '⇢', 'HAB.1', 'hold', false],
  ['esp', 'tc-esp', '✦', 'HAB.2', 'hold', false],
  ['s3', 'tc-s3', '❖', 'HAB.3', 'hold', false],
  ['ult', 'tc-ult', '★', 'ULTI', 'hold', false],
  ['reload', 'tc-reload', '↻', 'RECARGA', 'hold', false],
  ['evo', 'tc-evo', '✺', 'EVOLUC.', 'hold', false],
  ['melee', 'tc-melee', '⚔', 'MELEE', 'hold', false],
  ['ability', 'tc-ability', '✚', 'EQUIPO', 'hold', false],
  ['use', 'tc-use', '✋', 'USAR', 'hold', false],
  ['ping', 'tc-ping', '◆', '', 'hold', false],
  ['pause', 'tc-pause', '❚❚', '', 'tap', false],
];
// Modo básico: SÓLO 4 botones (disparo, recargar, melee, salto) + pausa. Lo demás:
//  · contextuales (CTX): aparecen sólo cuando sirven (definitiva cargada, algo para usar, evolución lista);
//  · modo avanzado (setting `advanced`): habilidades 1/2/3, apuntar, agachar, equipo y señalar.
// Correr es automático (palanca al máximo) y el arma se cambia tocando/deslizando la barra de armas de abajo.
const BASIC = ['fire', 'reload', 'melee', 'jump', 'pause'];
const ADV = ['mov', 'esp', 's3', 'ads', 'crouch', 'ability', 'ping'];
const CTX = ['ult', 'use', 'evo'];
const SHOW = (fingers, advanced) => [...BASIC, ...(fingers >= 3 ? ['fireL'] : []), ...(advanced ? ADV : [])];
const STICK_R = 58;             // radio del recorrido de la palanca (px CSS)
const STICK_DEAD = 0.1;         // zona muerta (fracción)

export class TouchControls {
  constructor(host, { onPause, onWeapon } = {}) {
    this.host = host; this.onPause = onPause; this.onWeapon = onWeapon;
    this.reset(true); this.enabled = false; this.editing = false; this.ptrs = new Map();
    this.zoomKind = 0;           // 0 = sin zoom · 1 = ADS común · 2 = mira óptica
    this.gyroOn = false; this.build(); this.applyLayout();
  }
  /* ───── estado de entrada ───── */
  reset(first = false) {
    this.mx = 0; this.mz = 0; this.dyaw = 0; this.dpitch = 0; this.weapon = -1;
    this.st = { fire: false, fireL: false, ads: false, jump: false, crouch: false, dash: false, mov: false, esp: false, s3: false, ult: false, melee: false, reload: false, evo: false, ability: false, use: false, ping: false };
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
      `<div class="tc-edit hidden"><b>EDITAR CONTROLES</b><span>Arrastrá un botón · tocá para elegirlo</span>
        <label>Tamaño <input type="range" id="tcSize" min="60" max="180" value="100"></label>
        <label>Transparencia <input type="range" id="tcOp" min="25" max="100" value="85"></label>
        <button type="button" id="tcReset">Restablecer</button><button type="button" id="tcDone" class="ok">Listo</button></div>`;
    this.$ = (s) => h.querySelector(s); this.stick = this.$('.tc-stick'); this.knob = this.stick.querySelector('i'); this.editBox = this.$('.tc-edit');
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
  show(on) { this.enabled = on; this.host.classList.toggle('hidden', !on); if (!on) { this.reset(); this.edit(false); } }

  /* ───── diseño personalizado ───── */
  applyLayout() {
    const s = settings(), vis = new Set(SHOW(s.fingers, !!s.advanced));
    this.host.style.setProperty('--hud-op', String(s.hudOpacity)); this.host.style.setProperty('--hud-s', String(s.hudScale));
    for (const [id] of BTN) { const el = this.$(`[data-a="${id}"]`), l = s.layout[id] || {}; if (!el) continue; el.style.setProperty('--dx', `${l.dx || 0}px`); el.style.setProperty('--dy', `${l.dy || 0}px`); el.style.setProperty('--s', String((l.s || 1) * s.hudScale)); el.classList.toggle('tc-off', CTX.includes(id) ? !(this.ctx[id] || this.editing || this.ctxForce) : !(vis.has(id) || this.editing && ADV.includes(id) && s.advanced)); el.classList.toggle('tc-ctx', CTX.includes(id)); }
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
    this.ctx = this.ctx || {}; let ch = false; for (const k of CTX) { const v = !!c[k]; if (this.ctx[k] !== v) { this.ctx[k] = v; ch = true; if (!v && this.st[k]) { this.st[k] = false; this.host.querySelector(`[data-a="${k}"]`)?.classList.remove('on'); } } }
    if (ch) this.applyLayout();
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
    if (p.type === 'toggle') { this.st[a] = !this.st[a]; el.classList.toggle('lock', this.st[a]); return; }
    if (a === 'ads' && settings().adsMode === 'alternar') { this.st.ads = !this.st.ads; el.classList.toggle('lock', this.st.ads); return; }
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
      const a = p.act; if (a !== 'prev' && a !== 'next' && a !== 'pause') {
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
    const s = this.st, i = { mx: this.mx, mz: this.mz, dyaw: this.dyaw, dpitch: this.dpitch, jump: s.jump, fire: s.fire || s.fireL, dash: s.dash || !!this.dashStick, weapon: this.weapon, ability: s.ability, interact: s.use, ping: s.ping, mov: s.mov, esp: s.esp, s3: s.s3, ult: s.ult, melee: s.melee, reload: s.reload, evo: s.evo, ads: s.ads, crouch: s.crouch };
    this.dyaw = this.dpitch = 0; this.weapon = -1; return i;
  }
}
