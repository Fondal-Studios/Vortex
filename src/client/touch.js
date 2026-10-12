// Controles táctiles (iPhone / Android): palanca a la izquierda, mirar arrastrando a la derecha,
// botón de disparo grande (se puede arrastrar desde él para apuntar), salto, correr y cambio de arma.
const SENS_KEY = 'cristal.sens.touch.v1';

export class TouchControls {
  constructor(host, { onPause, onWeapon } = {}) {
    this.host = host; this.onPause = onPause; this.onWeapon = onWeapon;
    this.mx = 0; this.mz = 0; this.dyaw = 0; this.dpitch = 0; this.fire = false; this.jump = false; this.dash = false; this.weapon = -1; this.ability = false; this.interact = false; this.ping = false; this.mov = false; this.esp = false;
    this.sens = 0.0045; try { const s = parseFloat(localStorage.getItem(SENS_KEY)); if (s > 0) this.sens = s; } catch { /* sin almacenamiento */ }
    this.ptrs = new Map(); this.enabled = false; this.build();
  }
  setSens(v) { this.sens = v; try { localStorage.setItem(SENS_KEY, String(v)); } catch { /* ok */ } }
  build() {
    const h = this.host; h.innerHTML = `
      <div class="tc-zone tc-left"></div><div class="tc-zone tc-right"></div>
      <div class="tc-stick hidden"><i></i></div>
      <button class="tc-btn tc-fire" data-a="fire"><span class="ic">◉</span><small>DISPARO</small></button>
      <button class="tc-btn tc-jump" data-a="jump"><span class="ic">⤒</span><small>SALTO</small></button>
      <button class="tc-btn tc-dash" data-a="dash"><span class="ic">»</span><small>CORRER</small></button>
      <button class="tc-btn tc-ability" data-a="ability"><span class="ic">✚</span><small>EQUIPO</small></button>
      <button class="tc-btn tc-mov" data-a="mov"><span class="ic">⇢</span><small>DESPL.</small></button>
      <button class="tc-btn tc-esp" data-a="esp"><span class="ic">✦</span><small>ESPECIAL</small></button>
      <button class="tc-btn tc-use" data-a="use"><span class="ic">✋</span><small>USAR</small></button>
      <button class="tc-btn tc-ping" data-a="ping">◆</button>
      <button class="tc-btn tc-prev" data-a="prev">‹</button><button class="tc-btn tc-next" data-a="next">›</button>
      <button class="tc-pause" data-a="pause">❚❚</button>`;
    this.$ = (s) => h.querySelector(s); this.stick = this.$('.tc-stick'); this.knob = this.stick.querySelector('i');
    const opts = { passive: false };
    for (const z of ['.tc-left', '.tc-right']) { const el = this.$(z); el.addEventListener('pointerdown', (e) => this.down(e, z === '.tc-left' ? 'move' : 'look'), opts); }
    h.querySelectorAll('.tc-btn,.tc-pause').forEach((b) => b.addEventListener('pointerdown', (e) => this.down(e, 'btn', b.dataset.a), opts));
    addEventListener('pointermove', (e) => this.move(e), opts); addEventListener('pointerup', (e) => this.up(e)); addEventListener('pointercancel', (e) => this.up(e));
    h.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  show(on) { this.enabled = on; this.host.classList.toggle('hidden', !on); if (!on) this.reset(); }
  reset() { this.mx = this.mz = 0; this.fire = this.jump = this.dash = this.ability = this.interact = this.ping = this.mov = this.esp = false; this.ptrs.clear(); this.stick.classList.add('hidden'); this.host.querySelectorAll('.on').forEach((b) => b.classList.remove('on')); }
  down(e, kind, act) {
    if (!this.enabled) return; e.preventDefault();
    const p = { kind, act, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, el: e.currentTarget };
    this.ptrs.set(e.pointerId, p); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ok */ }
    if (kind === 'move') { this.stick.style.left = e.clientX + 'px'; this.stick.style.top = e.clientY + 'px'; this.stick.classList.remove('hidden'); this.knob.style.transform = 'translate(-50%,-50%)'; }
    if (kind === 'btn') {
      p.el.classList.add('on');
      if (act === 'fire') this.fire = true; else if (act === 'jump') this.jump = true; else if (act === 'dash') this.dash = !this.dash, p.el.classList.toggle('lock', this.dash);
      else if (act === 'ability') this.ability = true; else if (act === 'mov') this.mov = true; else if (act === 'esp') this.esp = true; else if (act === 'use') this.interact = true; else if (act === 'ping') this.ping = true;
      else if (act === 'prev' || act === 'next') { this.cycle(act === 'next' ? 1 : -1); }
      else if (act === 'pause' && this.onPause) this.onPause();
    }
  }
  cycle(d) { if (this.onWeapon) this.weapon = this.onWeapon(d); }
  move(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) return; e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (p.kind === 'move') {
      const R = 56, vx = e.clientX - p.ox, vy = e.clientY - p.oy, l = Math.hypot(vx, vy) || 1, k = Math.min(1, l / R);
      this.mx = (vx / l) * k; this.mz = -(vy / l) * k; this.dashStick = k > 0.97;
      this.knob.style.transform = `translate(calc(-50% + ${(vx / l) * Math.min(l, R)}px), calc(-50% + ${(vy / l) * Math.min(l, R)}px))`;
    } else if (p.kind === 'look' || (p.kind === 'btn' && p.act === 'fire')) { this.dyaw += dx * this.sens; this.dpitch += -dy * this.sens; }
  }
  up(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) return; this.ptrs.delete(e.pointerId);
    if (p.kind === 'move') { this.mx = this.mz = 0; this.dashStick = false; this.stick.classList.add('hidden'); }
    if (p.kind === 'btn') { if (p.act !== 'dash') p.el.classList.remove('on'); if (p.act === 'fire') this.fire = false; if (p.act === 'jump') this.jump = false; if (p.act === 'ability') this.ability = false; if (p.act === 'mov') this.mov = false; if (p.act === 'esp') this.esp = false; if (p.act === 'use') this.interact = false; if (p.act === 'ping') this.ping = false; }
  }
  /** Entrada para este cuadro (acumulados de giro se consumen). */
  read() {
    const i = { mx: this.mx, mz: this.mz, dyaw: this.dyaw, dpitch: this.dpitch, jump: this.jump, fire: this.fire, dash: this.dash || !!this.dashStick, weapon: this.weapon, ability: this.ability, interact: this.interact, ping: this.ping, mov: this.mov, esp: this.esp };
    this.dyaw = this.dpitch = 0; this.weapon = -1; return i;
  }
}
