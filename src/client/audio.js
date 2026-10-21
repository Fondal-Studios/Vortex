/** Audio 100% procedural (WebAudio): sin archivos, sin licencias. SFX por arma/criatura + música generativa por mapa. */
export class Sound {
  constructor() { this.ctx = null; this.enabled = true; this.intensity = 0; this.mapId = null; this.step = 0; }
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor(); this.master.connect(comp); comp.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musBus = this.ctx.createGain(); this.musBus.gain.value = 0.32; this.musBus.connect(this.master);
    // eco largo para la música
    this.delay = this.ctx.createDelay(1); this.delay.delayTime.value = 0.375;
    const fb = this.ctx.createGain(); fb.gain.value = 0.42; this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.musBus);
    const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setListener(pos, right) { this.lp = pos; this.lr = right; }
  _route(vol, at) { // gain + paneo según posición
    const g = this.ctx.createGain(); let out = g;
    if (at && this.lp) {
      const dx = at[0] - this.lp.x, dy = at[1] - this.lp.y, dz = at[2] - this.lp.z, d = Math.hypot(dx, dy, dz);
      vol *= 1 / (1 + d / 22);
      if (this.ctx.createStereoPanner && this.lr) { const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, (dx * this.lr.x + dy * this.lr.y + dz * this.lr.z) / (d + 1) * 1.6)); g.connect(p); out = p; }
    }
    g.gain.value = vol; out.connect(this.sfxBus); return g;
  }
  tone({ f = 440, f2 = null, type = 'sine', dur = 0.15, vol = 0.3, at = null, att = 0.004, delay = 0 }) {
    if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime + delay;
    vol *= this._vk || 1; const o = this.ctx.createOscillator(), e = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(1, t + att); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e); e.connect(this._route(vol, at)); o.start(t); o.stop(t + dur + 0.05);
  }
  noise({ dur = 0.2, vol = 0.3, freq = 1500, q = 1, type = 'lowpass', freq2 = null, at = null, delay = 0 }) {
    if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime + delay;
    vol *= this._vk || 1; const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t); if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const e = this.ctx.createGain(); e.gain.setValueAtTime(1, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(e); e.connect(this._route(vol, at)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  /* ───── armas: cada una con su firma (grave + chasquido + cola), todo sintetizado ───── */
  /** Deja pasar un sonido como máximo cada `gap` segundos por clave (armas de cadencia loca no saturan el audio). */
  _gate(k, gap) { const t = this.ctx ? this.ctx.currentTime : 0; const g = this._gt || (this._gt = {}); if (g[k] != null && t - g[k] < gap) return false; g[k] = t; return true; }
  /** Golpe grave: seno que cae de f a f2. */
  thump(f, f2, dur, vol, at, delay = 0) { this.tone({ f, f2, type: 'sine', dur, vol, at, delay, att: 0.002 }); }
  /** Chasquido: ráfaga muy corta de ruido agudo. */
  crack(vol, at, freq = 3500, dur = 0.04, delay = 0) { this.noise({ dur, vol, freq, type: 'highpass', at, delay }); }
  shot(w, at) { this._vk = 2.2; try { this._shot(w, at); } finally { this._vk = 1; } }
  _shot(w, at) {
    const T = (o) => this.tone({ ...o, at }), N = (o) => this.noise({ ...o, at }), r = Math.random;
    switch (w) {
      case 0: // Haz: zap láser limpio
        this.thump(150, 55, 0.14, 0.34, at); T({ f: 2400, f2: 240, type: 'sawtooth', dur: 0.11, vol: 0.2 }); T({ f: 4200, f2: 1500, dur: 0.05, vol: 0.08 }); this.crack(0.14, at, 5000, 0.03); N({ dur: 0.18, vol: 0.12, freq: 2500, freq2: 400 }); break;
      case 1: // Prisma: estallido de esquirlas con campanitas
        this.thump(130, 45, 0.22, 0.42, at); this.crack(0.3, at, 2800, 0.06); N({ dur: 0.3, vol: 0.34, freq: 3200, freq2: 300 });
        [1760, 2349, 2960].forEach((f, i) => T({ f, f2: f * 0.94, dur: 0.2, vol: 0.07, delay: 0.012 * i })); break;
      case 2: // Ráfaga: seco y corto
        if (!this._gate('w2', 0.045)) return; this.thump(190, 80, 0.07, 0.24, at); this.crack(0.2, at, 4500, 0.035); T({ f: 1100, f2: 450, type: 'square', dur: 0.05, vol: 0.07 }); N({ dur: 0.08, vol: 0.08, freq: 2500, freq2: 800 }); break;
      case 3: // Nova: cañón pesado
        this.thump(95, 28, 0.55, 0.58, at); T({ f: 220, f2: 50, type: 'sawtooth', dur: 0.4, vol: 0.24 }); N({ dur: 0.6, vol: 0.4, freq: 1400, freq2: 90 }); this.crack(0.2, at, 1800, 0.06); T({ f: 300, f2: 900, dur: 0.25, vol: 0.08, delay: 0.05 }); break;
      case 4: // Aguja: carga que sube y chasquido de riel
        T({ f: 400, f2: 3200, dur: 0.09, vol: 0.15 }); this.crack(0.5, at, 1800, 0.09, 0.08); this.thump(120, 30, 0.5, 0.5, at, 0.08); T({ f: 2600, f2: 90, dur: 0.7, vol: 0.28, delay: 0.08 }); T({ f: 1500, f2: 1480, type: 'triangle', dur: 0.6, vol: 0.06, delay: 0.1 }); N({ dur: 0.5, vol: 0.25, freq: 5000, freq2: 300, delay: 0.08 }); break;
      case 5: // Pulso: pistola de pulso, seca y firme
        this.thump(210, 60, 0.14, 0.4, at); T({ f: 1300, f2: 520, type: 'square', dur: 0.08, vol: 0.12 }); this.crack(0.2, at, 3800, 0.04); T({ f: 800, f2: 300, dur: 0.15, vol: 0.12 }); break;
      case 6: // Gemelas: dos cañones livianos
        if (!this._gate('w6', 0.04)) return; T({ f: 950 + r() * 250, f2: 480, type: 'triangle', dur: 0.05, vol: 0.1 }); this.crack(0.14, at, 6000, 0.03); this.thump(250, 110, 0.05, 0.16, at); break;
      case 7: // Solar: siseo de luz
        if (!this._gate('w7', 0.045)) return; N({ dur: 0.1, vol: 0.5, freq: 1400 + r() * 1000, q: 2, type: 'bandpass' }); this.thump(120, 70, 0.07, 0.14, at); break;
      case 8: // Fractal: arco que chisporrotea
        T({ f: 3200, f2: 300, type: 'sawtooth', dur: 0.1, vol: 0.14 }); T({ f: 1700, f2: 200, type: 'square', dur: 0.14, vol: 0.08 }); this.thump(140, 60, 0.12, 0.26, at);
        for (let i = 0; i < 4; i++) this.crack(0.13, at, 3500 + r() * 3000, 0.02 + r() * 0.02, 0.02 + i * 0.035); break;
      case 9: // Enjambre: salva de cinco misiles
        for (let i = 0; i < 5; i++) { N({ dur: 0.18, vol: 0.12, freq: 600, freq2: 2600, q: 2, type: 'bandpass', delay: i * 0.045 }); this.thump(180, 90, 0.06, 0.14, at, i * 0.045); } break;
      case 10: // Cometa: lanzamiento grave con silbido ascendente
        this.thump(80, 28, 0.5, 0.52, at); T({ f: 180, f2: 1100, dur: 0.35, vol: 0.12, delay: 0.02 }); N({ dur: 0.5, vol: 0.3, freq: 1800, freq2: 120 }); this.crack(0.15, at, 2000, 0.05); break;
      case 11: // Vórtice: succión
        T({ f: 70, f2: 420, dur: 0.45, vol: 0.3 }); T({ f: 140, f2: 840, type: 'triangle', dur: 0.45, vol: 0.1, delay: 0.03 }); N({ dur: 0.45, vol: 0.22, freq: 200, freq2: 3500 }); this.thump(60, 28, 0.4, 0.3, at, 0.2); break;
      case 12: // Lanza: cristal que se parte
        T({ f: 2300, f2: 1150, dur: 0.3, vol: 0.12 }); T({ f: 3450, f2: 1700, type: 'triangle', dur: 0.25, vol: 0.08 }); N({ dur: 0.15, vol: 0.12, freq: 7000, type: 'highpass' }); this.thump(110, 45, 0.2, 0.32, at); this.crack(0.25, at, 5000, 0.05); break;
      case 13: // Cetro Vital: cálido, de vida
        T({ f: 523, f2: 784, dur: 0.2, vol: 0.15 }); T({ f: 784, f2: 1175, dur: 0.22, vol: 0.09, delay: 0.04 }); N({ dur: 0.12, vol: 0.06, freq: 1200, freq2: 400 }); this.thump(180, 100, 0.1, 0.16, at); break;
      case 14: // Eclipse: escopeta pesada + bombeo
        this.thump(90, 26, 0.5, 0.62, at); N({ dur: 0.45, vol: 0.5, freq: 3500, freq2: 150 }); this.crack(0.45, at, 2500, 0.07); T({ f: 140, f2: 50, type: 'sawtooth', dur: 0.3, vol: 0.2 });
        this.crack(0.2, at, 1800, 0.03, 0.28); T({ f: 400, f2: 180, type: 'square', dur: 0.06, vol: 0.1, delay: 0.28 }); this.crack(0.16, at, 2400, 0.03, 0.35); break;
      case 15: // Voltaico: zumbido eléctrico
        T({ f: 130, f2: 100, type: 'sawtooth', dur: 0.18, vol: 0.2 }); T({ f: 2800, f2: 700, type: 'square', dur: 0.12, vol: 0.1 }); this.thump(150, 60, 0.12, 0.2, at);
        for (let i = 0; i < 5; i++) this.crack(0.12, at, 3000 + r() * 4000, 0.02 + r() * 0.025, 0.01 + i * 0.03); break;
      case 16: // Glaciar: hielo que cruje
        N({ dur: 0.1, vol: 0.13, freq: 5200, q: 4, type: 'bandpass' }); T({ f: 2640, f2: 2200, dur: 0.25, vol: 0.08 }); T({ f: 3520, dur: 0.2, vol: 0.05, delay: 0.02 }); this.thump(140, 50, 0.2, 0.3, at); N({ dur: 0.2, vol: 0.12, freq: 3000, freq2: 600 }); break;
      case 17: // Plaga: burbujas viscosas
        T({ f: 280, f2: 720, dur: 0.08, vol: 0.16 }); T({ f: 350, f2: 900, dur: 0.07, vol: 0.12, delay: 0.05 }); T({ f: 220, f2: 640, dur: 0.09, vol: 0.12, delay: 0.09 }); N({ dur: 0.2, vol: 0.15, freq: 700, freq2: 200 }); this.thump(110, 50, 0.1, 0.2, at); break;
      case 18: // Brasa: llama crepitante
        if (!this._gate('w18', 0.045)) return; N({ dur: 0.1, vol: 0.6, freq: 1200, freq2: 300 }); N({ dur: 0.06, vol: 0.25, freq: 200 + r() * 300, q: 3, type: 'bandpass' }); if (r() < 0.4) this.crack(0.08, at, 5000, 0.02); break;
      case 19: // Sembradora: golpe seco, clic metálico y pitido de armado
        this.thump(160, 45, 0.2, 0.52, at); this.crack(0.3, at, 1600, 0.05); T({ f: 800, f2: 700, type: 'square', dur: 0.05, vol: 0.1, delay: 0.04 }); T({ f: 1800, dur: 0.05, vol: 0.08, delay: 0.22 }); break;
      case 20: // Sierra: zumbido de hoja
        if (!this._gate('w20', 0.05)) return; T({ f: 180 + r() * 60, f2: 150, type: 'sawtooth', dur: 0.07, vol: 0.22 }); N({ dur: 0.05, vol: 0.3, freq: 3000, type: 'highpass' }); break;
      case 21: // Pulsar: onda sub-grave en todas direcciones
        this.thump(75, 24, 0.6, 0.68, at); T({ f: 700, f2: 90, dur: 0.45, vol: 0.25 }); N({ dur: 0.5, vol: 0.3, freq: 2500, freq2: 100 }); T({ f: 1400, f2: 700, type: 'triangle', dur: 0.4, vol: 0.06, delay: 0.05 }); break;
      case 22: // Dardos: tres tics de cristal
        for (let i = 0; i < 3; i++) { T({ f: 1700, f2: 1100, type: 'triangle', dur: 0.05, vol: 0.1, delay: i * 0.04 }); this.crack(0.1, at, 6000, 0.03, i * 0.04); } this.thump(200, 90, 0.08, 0.2, at); break;
      case 23: // Réquiem: campana grave del vacío
        this.thump(55, 24, 0.8, 0.6, at); T({ f: 110, dur: 0.8, vol: 0.15 }); T({ f: 165, dur: 0.7, vol: 0.08 }); N({ dur: 0.7, vol: 0.34, freq: 2200, freq2: 70 }); this.crack(0.3, at, 2000, 0.08); T({ f: 220, f2: 110, type: 'sawtooth', dur: 0.5, vol: 0.1 }); break;
      case 24: { const pick = [0, 15, 16, 18, 3, 12, 8]; this._shot(pick[Math.floor(r() * pick.length)], at); break; }
      default: this.thump(150, 55, 0.14, 0.3, at);
    }
  }
  hit(at) { // golpe a una criatura: tic + golpe húmedo (tres variantes para que no se repita)
    if (!this._gate('hit', 0.02)) return; const v = Math.random(); this._vk = 2.4; try { this._hit(at, v); } finally { this._vk = 1; }
  }
  _hit(at, v) {
    if (v < 0.34) { this.tone({ f: 900 + Math.random() * 300, f2: 400, type: 'triangle', dur: 0.05, vol: 0.13, at }); this.thump(180, 90, 0.06, 0.14, at); }
    else if (v < 0.67) { this.noise({ dur: 0.06, vol: 0.12, freq: 1600, freq2: 500, at }); this.tone({ f: 520, f2: 260, type: 'sine', dur: 0.07, vol: 0.12, at }); }
    else { this.crack(0.1, at, 4500, 0.025); this.thump(240, 100, 0.07, 0.15, at); }
  }
  boom(at) { this._vk = 1.4; try { this._boom(at); } finally { this._vk = 1; } }
  _boom(at) { // explosión: golpe sub-grave + estallido + retumbo largo
    this.thump(70, 22, 0.85, 0.85, at); this.noise({ dur: 0.9, vol: 0.7, freq: 2600, freq2: 60, at }); this.crack(0.4, at, 1500, 0.08);
    this.noise({ dur: 1.1, vol: 0.4, freq: 400, freq2: 40, at, delay: 0.1 }); this.tone({ f: 60, f2: 30, type: 'sawtooth', dur: 0.6, vol: 0.2, at });
  }
  /** Marcador de impacto (sonido de UI, sin posición): 'hit' golpe normal · 'crit' crítico · 'armor' blindado · 'kill' eliminación. */
  hitmark(kind = 'hit') { this._vk = kind === 'hit' ? 3 : kind === 'armor' ? 2.5 : 1.8; try { this._hitmark(kind); } finally { this._vk = 1; } }
  _hitmark(kind) {
    switch (kind) {
      case 'crit': this.tone({ f: 1500, f2: 2300, type: 'triangle', dur: 0.07, vol: 0.2 }); this.tone({ f: 2300, f2: 3200, type: 'sine', dur: 0.12, vol: 0.16, delay: 0.045 }); this.noise({ dur: 0.05, vol: 0.08, freq: 7000, type: 'highpass' }); break;
      case 'armor': this.tone({ f: 620, f2: 540, type: 'square', dur: 0.05, vol: 0.1 }); this.noise({ dur: 0.06, vol: 0.12, freq: 3200, q: 6, type: 'bandpass' }); break;
      case 'kill': this.tone({ f: 190, f2: 70, type: 'sine', dur: 0.18, vol: 0.34 }); this.tone({ f: 1250, f2: 1900, type: 'triangle', dur: 0.1, vol: 0.18, delay: 0.02 }); this.tone({ f: 1900, f2: 2800, type: 'sine', dur: 0.16, vol: 0.14, delay: 0.07 }); break;
      default: this.tone({ f: 1750, f2: 1250, type: 'triangle', dur: 0.045, vol: 0.14 }); this.noise({ dur: 0.03, vol: 0.05, freq: 6500, type: 'highpass' });
    }
  }
  /** Viento de caída: ruido filtrado continuo; `k` 0..1 (0 = se apaga). Lo maneja src/client/caida.js. */
  wind(k) {
    if (!this.ctx || !this.enabled) return;
    if (!this._wind) {
      if (k <= 0.01) return;
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.value = 400;
      const g = this.ctx.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(this.sfxBus); s.start();
      this._wind = { s, f, g };
    }
    const t = this.ctx.currentTime, w = this._wind; k = Math.max(0, Math.min(1, k));
    w.g.gain.setTargetAtTime(k * 0.55, t, 0.12); w.f.frequency.setTargetAtTime(350 + k * 1900, t, 0.12);
  }
  /** Aterrizaje fuerte: golpe grave + polvo; `k` 0..1 según la velocidad de caída. */
  landing(k = 0.5) {
    k = Math.max(0.2, Math.min(1, k)); this._vk = 1 + k;
    try { this.thump(90, 30, 0.35 + 0.3 * k, 0.5 * k + 0.2); this.noise({ dur: 0.35 + 0.3 * k, vol: 0.3 * k + 0.1, freq: 1800, freq2: 120 }); } finally { this._vk = 1; }
  }
  /** Caída al vacío: silbido descendente y golpe hueco. */
  abyss() { this.tone({ f: 900, f2: 60, type: 'sine', dur: 0.9, vol: 0.3 }); this.noise({ dur: 0.7, vol: 0.25, freq: 3000, freq2: 100 }); this.thump(60, 24, 0.6, 0.5); }
  hurt() { this.tone({ f: 200, f2: 70, type: 'sawtooth', dur: 0.25, vol: 0.35 }); this.noise({ dur: 0.15, vol: 0.25, freq: 800 }); }
  /** Fauna consumible (docs/FAUNA.md): 'come' (glup + arpegio según la forma) · 'rara' (destello) · 'fin' · 'muerde' · 'fase' · 'remate' / 'devora'. `f` = índice de la forma (cambia la nota). */
  fauna(k, at = null, f = 0) {
    const base = 330 * 2 ** (((f | 0) % 12) / 12);
    if (k === 'come') { this.tone({ f: 260, f2: 620, type: 'sine', dur: 0.14, vol: 0.28, at }); this.noise({ dur: 0.1, vol: 0.12, freq: 900, at }); [0, 4, 7, 12, 16].forEach((s, i) => this.tone({ f: base * 2 ** (s / 12), type: 'triangle', dur: 0.18, vol: 0.16, at, delay: 0.1 + i * 0.055 })); }
    else if (k === 'rara') [0, 7, 12, 19, 24].forEach((s, i) => this.tone({ f: 880 * 2 ** (s / 12), type: 'sine', dur: 0.3, vol: 0.12, at, delay: i * 0.07 }));
    else if (k === 'fin') [0, -4, -9].forEach((s, i) => this.tone({ f: 520 * 2 ** (s / 12), type: 'sine', dur: 0.25, vol: 0.14, delay: i * 0.1 }));
    else if (k === 'muerde') { this.thump(180, 70, 0.14, 0.3, at); this.crack(0.2, at); }
    else if (k === 'fase') this.tone({ f: 900, f2: 200, type: 'sine', dur: 0.3, vol: 0.2, at });
    else if (k === 'remate' || k === 'devora') { this.thump(140, 45, 0.3, 0.4, at); this.tone({ f: base * 2, f2: base * 4, type: 'sawtooth', dur: 0.25, vol: 0.12, at }); this.noise({ dur: 0.25, vol: 0.18, freq: 2500, freq2: 300, at }); }
  }
  /** Flora interactiva (docs/FLORA.md): sonidos mínimos reutilizando tone/noise/thump. */
  flora(k, at = null) {
    if (k === 'cura') [0, 4, 7, 12].forEach((s, i) => this.tone({ f: 660 * 2 ** (s / 12), type: 'sine', dur: 0.2, vol: 0.13, at, delay: i * 0.06 }));
    else if (k === 'cosecha') { this.noise({ dur: 0.1, vol: 0.12, freq: 2200, at }); [0, 7, 12].forEach((s, i) => this.tone({ f: 784 * 2 ** (s / 12), type: 'triangle', dur: 0.14, vol: 0.13, at, delay: 0.04 + i * 0.05 })); }
    else if (k === 'muerde') { this.thump(150, 55, 0.16, 0.34, at); this.crack(0.28, at, 2600, 0.05); this.noise({ dur: 0.14, vol: 0.14, freq: 900, at, delay: 0.02 }); }
    else if (k === 'ata') { this.noise({ dur: 0.3, vol: 0.14, freq: 500, freq2: 1800, at }); this.tone({ f: 120, f2: 70, type: 'sawtooth', dur: 0.3, vol: 0.12, at }); }
    else if (k === 'pincha') this.crack(0.14, at, 4200, 0.03);
    else if (k === 'estalla') { this.thump(110, 40, 0.3, 0.4, at); this.noise({ dur: 0.35, vol: 0.2, freq: 3000, freq2: 200, at }); }
    else if (k === 'nube') this.noise({ dur: 0.7, vol: 0.12, freq: 700, freq2: 300, at });
    else if (k === 'refleja') { this.tone({ f: 1400, f2: 2400, type: 'sine', dur: 0.12, vol: 0.14, at }); this.tone({ f: 2100, type: 'triangle', dur: 0.2, vol: 0.08, at, delay: 0.05 }); }
    else if (k === 'arde') this.noise({ dur: 0.5, vol: 0.14, freq: 1400, freq2: 500, at });
    else if (k === 'hiela') { this.tone({ f: 1800, f2: 900, type: 'sine', dur: 0.2, vol: 0.12, at }); this.crack(0.16, at, 5000, 0.04); }
    else if (k === 'crujido') { this.crack(0.22, at, 1800, 0.06); this.noise({ dur: 0.18, vol: 0.14, freq: 600, at }); }
    else if (k === 'marchita') this.tone({ f: 330, f2: 200, type: 'sine', dur: 0.25, vol: 0.07, at });
    else if (k === 'brota') this.tone({ f: 440, f2: 700, type: 'sine', dur: 0.18, vol: 0.07, at });
    else if (k === 'aviso') this.tone({ f: 520, f2: 380, type: 'square', dur: 0.14, vol: 0.06, at });
    else if (k === 'rara' || k === 'descubre') [0, 7, 12, 19].forEach((s, i) => this.tone({ f: 660 * 2 ** (s / 12), type: 'sine', dur: 0.28, vol: 0.12, at, delay: i * 0.07 }));
  }
  pickup() { [0, 4, 7, 12].forEach((s, i) => this.tone({ f: 523 * 2 ** (s / 12), type: 'triangle', dur: 0.12, vol: 0.2, delay: i * 0.05 })); }
  wave() { [0, 7, 12, 19].forEach((s, i) => this.tone({ f: 110 * 2 ** (s / 12), type: 'sawtooth', dur: 0.9, vol: 0.18, att: 0.1, delay: i * 0.12 })); }
  gravity(at) { this.tone({ f: 80, f2: 600, type: 'sine', dur: 0.8, vol: 0.5, at }); this.tone({ f: 600, f2: 80, type: 'triangle', dur: 0.8, vol: 0.3, at, delay: 0.4 }); }
  ability(at) { this.tone({ f: 330, f2: 880, type: 'sine', dur: 0.4, vol: 0.3, at }); this.tone({ f: 660, f2: 1320, type: 'triangle', dur: 0.3, vol: 0.18, at, delay: 0.08 }); }
  objective(ok) { (ok ? [0, 4, 7, 12, 16] : [0, -3, -7]).forEach((s, i) => this.tone({ f: 440 * 2 ** (s / 12), type: 'triangle', dur: 0.25, vol: 0.22, delay: i * 0.09 })); }
  ping() { this.tone({ f: 1100, f2: 1500, type: 'sine', dur: 0.12, vol: 0.2 }); this.tone({ f: 1500, type: 'sine', dur: 0.1, vol: 0.14, delay: 0.1 }); }
  ray() { this.tone({ f: 120, f2: 900, type: 'sawtooth', dur: 1.6, vol: 0.28, att: 0.8 }); }
  /** Jefes (jefes-fx.js): avisos y golpes de sus mecánicas. `at` = [x,y,z] o null (suena en el centro). */
  jefe(kind, at) {
    if (!this.ctx) return;
    switch (kind) {
      case 'tel': this.tone({ f: 220, f2: 440, type: 'sawtooth', dur: 0.9, vol: 0.16, att: 0.5 }); break;                     // algo se prepara (sube de tono)
      case 'fase': [0, -5, -9].forEach((s, i) => this.tone({ f: 330 * 2 ** (s / 12), type: 'sawtooth', dur: 0.8, vol: 0.2, att: 0.05, delay: i * 0.16 })); this.noise({ dur: 0.6, vol: 0.2, freq: 900, freq2: 90 }); break;
      case 'adapt': this.tone({ f: 523, type: 'triangle', dur: 0.25, vol: 0.2 }); this.tone({ f: 392, type: 'triangle', dur: 0.25, vol: 0.2, delay: 0.14 }); this.tone({ f: 262, f2: 196, type: 'sawtooth', dur: 0.5, vol: 0.18, delay: 0.28 }); break;   // «aprende de ti»
      case 'desc': this.tone({ f: 300, f2: 700, type: 'sine', dur: 0.3, vol: 0.2 }); this.tone({ f: 700, f2: 250, type: 'triangle', dur: 0.4, vol: 0.18, delay: 0.2 }); break;
      case 'enrage': this.tone({ f: 70, f2: 38, type: 'sawtooth', dur: 1.4, vol: 0.5 }); this.noise({ dur: 1.0, vol: 0.35, freq: 700, freq2: 60 }); break;
      case 'unico': [0, 4, 7, 12].forEach((s, i) => this.tone({ f: 392 * 2 ** (s / 12), type: 'triangle', dur: 0.35, vol: 0.2, delay: i * 0.07 })); this.thump(90, 45, 0.5, 0.4, null, 0.3); break;
      case 'impacto': this.thump(80, 30, 0.7, 0.7, at); this.noise({ dur: 0.6, vol: 0.45, freq: 500, freq2: 60, at }); break;
      case 'golpe': this.thump(110, 45, 0.35, 0.45, at); this.noise({ dur: 0.25, vol: 0.25, freq: 1200, freq2: 150, at }); break;
      case 'campana': this.tone({ f: 415, type: 'sine', dur: 1.3, vol: 0.3, at, att: 0.003 }); this.tone({ f: 830, type: 'sine', dur: 0.9, vol: 0.14, at, att: 0.003 }); break;
      case 'barrido': this.tone({ f: 140, f2: 520, type: 'sawtooth', dur: 0.8, vol: 0.2, at, att: 0.15 }); break;
      case 'rebote': this.tone({ f: 1500, f2: 700, type: 'square', dur: 0.12, vol: 0.14, at }); break;
      case 'escudo': this.tone({ f: 260, f2: 780, type: 'sine', dur: 0.5, vol: 0.22, at }); this.tone({ f: 780, type: 'triangle', dur: 0.3, vol: 0.12, at, delay: 0.1 }); break;
      case 'silencio': this.tone({ f: 120, f2: 60, type: 'sine', dur: 1.0, vol: 0.4, at }); this.noise({ dur: 0.8, vol: 0.2, freq: 300, freq2: 60, at }); break;
      default: break;
    }
  }
  down() { this.tone({ f: 180, f2: 50, type: 'sawtooth', dur: 0.6, vol: 0.4 }); this.heartbeat(); }
  portal(at) { this.tone({ f: 300, f2: 1500, type: 'sine', dur: 0.35, vol: 0.3, at }); this.tone({ f: 1500, f2: 300, type: 'triangle', dur: 0.35, vol: 0.2, at, delay: 0.1 }); }
  /** Sonidos de interfaz (menús PS5): navegación, confirmar, volver, trofeo. */
  ui(kind) {
    if (!this.ctx) return;
    if (kind === 'tick') this.tone({ f: 1500, f2: 1900, type: 'sine', dur: 0.04, vol: 0.1 });
    else if (kind === 'ok') { this.tone({ f: 600, f2: 1200, type: 'triangle', dur: 0.12, vol: 0.18 }); this.tone({ f: 1200, type: 'sine', dur: 0.2, vol: 0.1, delay: 0.06 }); }
    else if (kind === 'back') this.tone({ f: 900, f2: 450, type: 'triangle', dur: 0.12, vol: 0.14 });
    else if (kind === 'trophy') [0, 7, 12, 19].forEach((s, i) => this.tone({ f: 784 * 2 ** (s / 12), type: 'sine', dur: 0.4, vol: 0.14, delay: i * 0.09 }));
  }
  setVolume(v) { if (this.master) this.master.gain.value = 0.9 * v; }
  /** Chirrido del Heraldo al hablar (una nota corta por letra). */
  chirp(n) { const f = 700 + (n * 53) % 500; this.tone({ f, f2: f * (1.2 + (n % 3) * 0.1), type: 'sine', dur: 0.07, vol: 0.12 }); }
  /** Tren: estruendo creciente, bocina y silencio. */
  train(secs = 8) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(120, t); f.frequency.exponentialRampToValueAtTime(2200, t + secs);
    const e = this.ctx.createGain(); e.gain.setValueAtTime(0.02, t); e.gain.exponentialRampToValueAtTime(1.0, t + secs); e.gain.setValueAtTime(1.0, t + secs); e.gain.exponentialRampToValueAtTime(0.0001, t + secs + 0.6);
    s.connect(f); f.connect(e); e.connect(this.sfxBus); s.start(t); s.stop(t + secs + 0.7);
    for (const [d, fr] of [[secs * 0.55, 311], [secs * 0.55, 392], [secs * 0.8, 311], [secs * 0.8, 392]]) this.tone({ f: fr, type: 'sawtooth', dur: 1.2, vol: 0.22, att: 0.05, delay: d });
  }
  heartbeat() { this.tone({ f: 60, f2: 40, type: 'sine', dur: 0.25, vol: 0.6 }); this.tone({ f: 55, f2: 38, type: 'sine', dur: 0.25, vol: 0.45, delay: 0.22 }); }
  /** Voz de cada criatura: timbre propio */
  voice(kind, ev, at) {
    const V = {
      astilla: () => this.tone({ f: 1800, f2: 800, type: 'square', dur: 0.1, vol: 0.12, at }),
      geoda: () => { this.tone({ f: 70, f2: 45, type: 'sawtooth', dur: 0.5, vol: 0.4, at }); this.noise({ dur: 0.4, vol: 0.3, freq: 400, at }); },
      prisma: () => this.tone({ f: 1200, f2: 2400, type: 'sine', dur: 0.2, vol: 0.16, at }),
      lente: () => { this.tone({ f: 400, f2: 1600, type: 'sine', dur: 0.45, vol: 0.2, at }); },
      cuarzo: () => { [0, 3, 7].forEach((s, i) => this.tone({ f: 330 * 2 ** (s / 12), type: 'triangle', dur: 0.5, vol: 0.18, at, delay: i * 0.08 })); },
      espejo: () => { this.tone({ f: 3000, f2: 3600, type: 'sine', dur: 0.3, vol: 0.12, at }); },
      racimo: () => this.tone({ f: 800, f2: 1500, type: 'square', dur: 0.08, vol: 0.12, at }),
      graviton: () => this.tone({ f: 55, f2: 300, type: 'sine', dur: 1.2, vol: 0.45, at }),
      coloso: () => { this.tone({ f: 55, f2: 30, type: 'sawtooth', dur: 1.2, vol: 0.6, at }); this.noise({ dur: 1.0, vol: 0.4, freq: 600, freq2: 80, at }); },
      madre: () => { this.tone({ f: 65, f2: 40, type: 'sawtooth', dur: 1.4, vol: 0.55, at }); this.tone({ f: 130, f2: 190, type: 'sine', dur: 1.0, vol: 0.3, at }); },
    };
    (V[kind] || V.astilla)();
    if (ev === 'die') { // la criatura se rompe: esquirlas de cristal + golpe sordo
      this.noise({ dur: 0.28, vol: 0.26, freq: 4200, type: 'highpass', at }); this.tone({ f: 120, f2: 40, type: 'sine', dur: 0.3, vol: 0.34, at, att: 0.002 });
      for (let i = 0; i < 3; i++) this.tone({ f: 1800 + Math.random() * 1600, f2: 900, type: 'triangle', dur: 0.12, vol: 0.06, at, delay: 0.02 + i * 0.035 });
    }
  }

  /* ───── Huéspedes: habilidades y melee (hostfx.js). Todo sintetizado; `at` = [x,y,z] o null (propio) ───── */
  host(id, at) { this._vk = 2; try { this._host(id, at); } finally { this._vk = 1; } }
  _host(id, at) {
    const T = (o) => this.tone({ ...o, at }), N = (o) => this.noise({ ...o, at }), r = Math.random;
    switch (id) {
      case 'impulso': N({ dur: 0.3, vol: 0.4, freq: 300, freq2: 3200, q: 1.5, type: 'bandpass' }); this.thump(120, 40, 0.25, 0.5, at); T({ f: 260, f2: 900, type: 'sawtooth', dur: 0.2, vol: 0.12 }); break;
      case 'espinas': for (let i = 0; i < 6; i++) { T({ f: 2400 - i * 160, f2: 700, type: 'triangle', dur: 0.06, vol: 0.09, delay: i * 0.018 }); this.crack(0.12, at, 5200, 0.025, i * 0.018); } this.thump(150, 60, 0.18, 0.34, at); break;
      case 'zumbido': N({ dur: 0.3, vol: 0.28, freq: 900, freq2: 2400, q: 3, type: 'bandpass' }); T({ f: 180, f2: 320, type: 'sawtooth', dur: 0.28, vol: 0.1 }); T({ f: 200, f2: 360, type: 'sawtooth', dur: 0.26, vol: 0.08, delay: 0.02 }); break;   // Colmena
      case 'cria': for (let i = 0; i < 3; i++) { T({ f: 220 + i * 40, f2: 330 + i * 50, type: 'sawtooth', dur: 0.3, vol: 0.07, delay: i * 0.06 }); T({ f: 700 + i * 150, f2: 400, type: 'triangle', dur: 0.12, vol: 0.06, delay: 0.05 * i }); } N({ dur: 0.35, vol: 0.2, freq: 1400, freq2: 500, q: 2, type: 'bandpass' }); break;
      case 'nido': this.thump(80, 40, 0.35, 0.5, at); T({ f: 420, f2: 140, type: 'sine', dur: 0.25, vol: 0.16 }); N({ dur: 0.2, vol: 0.2, freq: 500, freq2: 2000, q: 1.5, type: 'bandpass' }); break;
      case 'marabunta': this.thump(60, 28, 0.9, 0.6, at); for (let i = 0; i < 6; i++) T({ f: 160 + i * 35, f2: 250 + i * 45, type: 'sawtooth', dur: 0.9, vol: 0.06, delay: i * 0.04 }); N({ dur: 0.9, vol: 0.3, freq: 800, freq2: 2600, q: 2, type: 'bandpass' }); break;
      case 'caparazon': this.thump(90, 45, 0.5, 0.5, at); T({ f: 330, f2: 660, type: 'triangle', dur: 0.35, vol: 0.14 }); [880, 1320, 1760].forEach((f, i) => T({ f, dur: 0.4, vol: 0.05, delay: 0.03 * i })); N({ dur: 0.3, vol: 0.2, freq: 4000, freq2: 900 }); break;
      case 'sobrecarga': this.thump(60, 24, 0.9, 0.7, at); T({ f: 90, f2: 540, type: 'sawtooth', dur: 0.8, vol: 0.3, att: 0.3 }); N({ dur: 0.8, vol: 0.4, freq: 300, freq2: 5000 }); for (let i = 0; i < 4; i++) this.crack(0.2, at, 3500, 0.03, 0.15 + i * 0.1); break;
      case 'paso': T({ f: 1900, f2: 120, type: 'sawtooth', dur: 0.14, vol: 0.14 }); N({ dur: 0.1, vol: 0.3, freq: 5200, type: 'highpass' }); T({ f: 300, f2: 1100, dur: 0.12, vol: 0.12, delay: 0.1 }); this.crack(0.3, at, 3000, 0.04, 0.1); break;
      case 'camuflaje': T({ f: 1200, f2: 300, dur: 0.5, vol: 0.16 }); T({ f: 1210, f2: 305, dur: 0.5, vol: 0.12 }); N({ dur: 0.5, vol: 0.18, freq: 6000, freq2: 800, q: 3, type: 'bandpass' }); break;
      case 'marca': T({ f: 1500, f2: 1500, type: 'square', dur: 0.05, vol: 0.1 }); T({ f: 1500, type: 'square', dur: 0.05, vol: 0.1, delay: 0.09 }); T({ f: 700, f2: 2100, dur: 0.18, vol: 0.14, delay: 0.17 }); this.crack(0.2, at, 4800, 0.03, 0.2); break;
      case 'frenesi': this.thump(70, 28, 0.7, 0.6, at); T({ f: 120, f2: 800, type: 'sawtooth', dur: 0.5, vol: 0.3, att: 0.2 }); for (let i = 0; i < 3; i++) { N({ dur: 0.08, vol: 0.4, freq: 5000, type: 'highpass', delay: 0.05 + i * 0.07 }); } this.heartbeat(); break;
      case 'barrera': this.thump(70, 30, 0.5, 0.55, at); N({ dur: 0.5, vol: 0.4, freq: 500, freq2: 120, q: 2 }); for (let i = 0; i < 5; i++) T({ f: 200 + r() * 200, f2: 500 + r() * 300, dur: 0.07, vol: 0.12, delay: i * 0.05 }); break;
      case 'esporas': N({ dur: 0.6, vol: 0.4, freq: 1400, freq2: 300, q: 1 }); for (let i = 0; i < 5; i++) T({ f: 400 + r() * 500, f2: 900 + r() * 500, dur: 0.06, vol: 0.09, delay: 0.04 + i * 0.06 }); this.thump(110, 60, 0.15, 0.3, at); break;
      case 'biomasa': T({ f: 600, f2: 90, type: 'sawtooth', dur: 0.5, vol: 0.2 }); N({ dur: 0.5, vol: 0.3, freq: 2200, freq2: 150 }); this.thump(70, 45, 0.3, 0.5, at, 0.35); [523, 659, 784].forEach((f, i) => T({ f, dur: 0.25, vol: 0.1, delay: 0.4 + i * 0.07 })); break;
      case 'floracion': this.thump(55, 25, 1, 0.6, at); [262, 330, 392, 523, 659].forEach((f, i) => T({ f, dur: 1.2, vol: 0.09, att: 0.2, delay: i * 0.1 })); N({ dur: 1, vol: 0.25, freq: 200, freq2: 2500 }); break;
      case 'fase': T({ f: 140, f2: 1400, type: 'sine', dur: 0.3, vol: 0.28 }); T({ f: 1400, f2: 140, type: 'triangle', dur: 0.3, vol: 0.14, delay: 0.1 }); N({ dur: 0.3, vol: 0.2, freq: 400, freq2: 4000, q: 2, type: 'bandpass' }); break;
      case 'singularidad': T({ f: 400, f2: 40, type: 'sine', dur: 0.9, vol: 0.4 }); N({ dur: 0.9, vol: 0.3, freq: 3000, freq2: 100 }); this.thump(48, 22, 0.9, 0.6, at, 0.6); break;
      case 'tiempo': for (let i = 0; i < 4; i++) T({ f: i % 2 ? 900 : 700, f2: i % 2 ? 880 : 690, type: 'triangle', dur: 0.05 + i * 0.03, vol: 0.12, delay: i * (0.12 + i * 0.05) }); T({ f: 600, f2: 120, dur: 0.9, vol: 0.2, delay: 0.1 }); N({ dur: 0.7, vol: 0.12, freq: 3000, freq2: 300 }); break;
      case 'colapso': T({ f: 600, f2: 28, type: 'sawtooth', dur: 1.6, vol: 0.4 }); N({ dur: 1.5, vol: 0.5, freq: 4000, freq2: 60 }); this.thump(40, 18, 1.4, 0.8, at, 0.2); T({ f: 90, f2: 45, dur: 1.4, vol: 0.25, delay: 0.3 }); break;
      case 'planeo': N({ dur: 0.5, vol: 0.3, freq: 800, freq2: 2400, q: 1.5, type: 'bandpass' }); T({ f: 300, f2: 900, type: 'triangle', dur: 0.3, vol: 0.12 }); this.thump(100, 50, 0.2, 0.3, at); N({ dur: 0.18, vol: 0.2, freq: 1500, q: 2, type: 'bandpass', delay: 0.25 }); break;
      case 'pulso': this.thump(80, 40, 0.3, 0.6, at); this.thump(80, 40, 0.3, 0.45, at, 0.18); T({ f: 392, f2: 784, type: 'sine', dur: 0.6, vol: 0.14, delay: 0.1 }); N({ dur: 0.5, vol: 0.25, freq: 1800, freq2: 200 }); break;
      case 'simbionte': T({ f: 150, f2: 450, type: 'sawtooth', dur: 0.6, vol: 0.16 }); for (let i = 0; i < 4; i++) T({ f: 300 + i * 90, f2: 600 + i * 120, dur: 0.1, vol: 0.12, delay: 0.1 + i * 0.07 }); N({ dur: 0.5, vol: 0.2, freq: 500, freq2: 2000 }); this.thump(90, 40, 0.3, 0.4, at); break;
      case 'metamorfosis': this.thump(55, 22, 1.1, 0.65, at); [196, 294, 392, 587, 784].forEach((f, i) => T({ f, dur: 1.1, vol: 0.1, att: 0.15, delay: i * 0.08 })); N({ dur: 0.9, vol: 0.3, freq: 600, freq2: 5000 }); this.crack(0.3, at, 3000, 0.08, 0.4); break;
      case 'pirueta': N({ dur: 0.22, vol: 0.3, freq: 1200, freq2: 5200, q: 1.5, type: 'bandpass' }); T({ f: 900, f2: 1800, type: 'triangle', dur: 0.16, vol: 0.1 }); break;
      case 'parada': this.crack(0.5, at, 3200, 0.05); T({ f: 1568, f2: 1568, type: 'sine', dur: 0.5, vol: 0.12 }); T({ f: 2349, dur: 0.45, vol: 0.07, delay: 0.02 }); T({ f: 784, f2: 392, type: 'triangle', dur: 0.2, vol: 0.12 }); break;
      case 'cintas': for (let i = 0; i < 4; i++) N({ dur: 0.12, vol: 0.18, freq: 2000 + i * 500, freq2: 6000, q: 2, type: 'bandpass', delay: i * 0.04 }); T({ f: 700, f2: 1500, type: 'triangle', dur: 0.3, vol: 0.1 }); break;
      case 'danza': this.thump(70, 30, 0.6, 0.5, at); [523, 659, 784, 1047, 1319].forEach((f, i) => T({ f, dur: 0.5, vol: 0.09, delay: i * 0.07 })); for (let i = 0; i < 5; i++) this.crack(0.25, at, 4000, 0.03, 0.05 * i); N({ dur: 0.7, vol: 0.2, freq: 1500, freq2: 6000, q: 2 }); break;
      default: this.ability(at);
    }
  }
  /** Fin de una definitiva: el cuerpo se "desinfla". */
  hostEnd(id, at) { this._vk = 1.6; try { this.tone({ f: 500, f2: 70, type: 'sawtooth', dur: 0.5, vol: 0.2, at }); this.noise({ dur: 0.5, vol: 0.2, freq: 3000, freq2: 120, at }); } finally { this._vk = 1; } }
  /** Melee por Huésped. kind: light|heavy|air (barrido) · hit (sólo el golpe) · exec (ejecución). hit: nº de impactos (0 = al aire). */
  /** Impacto del modo Combo (combo-fx.js): crece con el peso del golpe (1 normal · 1,5 pesado · 2,4+ remate) y sube de tono con cada golpe de la cadena (n). */
  comboHit(host, peso = 1, n = 1, fin = false, at = null) {
    if (!this.ctx || !this.enabled) return; this._vk = 2; const k = Math.min(3, peso), up = 1 + 0.07 * Math.min(6, n), T = (o) => this.tone({ ...o, at }), N = (o) => this.noise({ ...o, at });
    try {
      this.thump(150 / (0.6 + 0.4 * k), 38, 0.16 + 0.1 * k, 0.32 + 0.16 * k, at);
      N({ dur: 0.05 + 0.04 * k, vol: 0.22 + 0.08 * k, freq: 2400 * up, freq2: 500, type: 'bandpass', q: 1.2 });
      T({ f: 520 * up, f2: 180, type: 'triangle', dur: 0.09, vol: 0.1 });
      if (k >= 1.4) { this.crack(0.3, at, 3200, 0.05, 0.015); this.thump(70, 28, 0.3, 0.45, at, 0.02); }
      if (fin) { // remate: boom grave, campana que cae y un destello agudo
        this.thump(55, 22, 0.7, 0.75, at, 0.03); N({ dur: 0.45, vol: 0.38, freq: 900, freq2: 90, q: 0.8, delay: 0.03 });
        T({ f: 880, f2: 220, type: 'sawtooth', dur: 0.35, vol: 0.12, delay: 0.02 }); [1320, 1760, 2640].forEach((f, i) => T({ f, dur: 0.5, vol: 0.05, delay: 0.04 + i * 0.03 }));
      }
      if (host === 'seraf' || host === 'umbra') T({ f: 2200 * up, f2: 3400, type: 'sine', dur: 0.14, vol: 0.06, delay: 0.01 });
      else if (host === 'micelio') N({ dur: 0.3, vol: 0.3, freq: 500, freq2: 70, delay: 0.01 });
      else if (host === 'vesper') this.crack(0.22, at, 5200, 0.03, 0.005);
    } finally { this._vk = 1; }
  }
  melee(host, kind, at, hit = 0, heavy = false) { this._vk = 2.2; try { this._melee(host, kind, at, hit, heavy); } finally { this._vk = 1; } }
  _melee(host, kind, at, hit, heavy) {
    const T = (o) => this.tone({ ...o, at }), N = (o) => this.noise({ ...o, at }), big = heavy || kind === 'heavy' || kind === 'air' || kind === 'exec', k = big ? 1.5 : 1, r = Math.random;
    if (kind !== 'exec' && kind !== 'hit') switch (host) { // el golpe al aire (barrido)
      case 'vesper': N({ dur: 0.07 * k, vol: 0.3, freq: 4200, freq2: 7000, type: 'bandpass', q: 2 }); T({ f: 1500, f2: 600, type: 'sawtooth', dur: 0.06, vol: 0.08 }); if (big) N({ dur: 0.08, vol: 0.28, freq: 4800, type: 'bandpass', q: 2, delay: 0.07 }); break;
      case 'micelio': N({ dur: 0.22 * k, vol: 0.28, freq: 300, freq2: 120, q: 0.8 }); T({ f: 90, f2: 50, dur: 0.18 * k, vol: 0.22 }); break;
      case 'umbra': T({ f: 200, f2: 900, type: 'sine', dur: 0.2 * k, vol: 0.18 }); T({ f: 1200, f2: 300, type: 'triangle', dur: 0.2 * k, vol: 0.07, delay: 0.03 }); N({ dur: 0.18, vol: 0.14, freq: 6000, freq2: 1500, type: 'highpass' }); break;
      case 'seraf': N({ dur: 0.15 * k, vol: 0.18, freq: 900, freq2: 3000, type: 'bandpass', q: 1.5 }); N({ dur: 0.03, vol: 0.55, freq: 3500, type: 'highpass', delay: 0.11 * k }); T({ f: 2400, f2: 500, type: 'square', dur: 0.04, vol: 0.1, delay: 0.11 * k }); break;
      case 'danzante': N({ dur: 0.14 * k, vol: 0.2, freq: 2600, freq2: 6500, type: 'bandpass', q: 2.5 }); T({ f: 1900, f2: 2600, type: 'triangle', dur: 0.05, vol: 0.07, delay: 0.03 }); T({ f: 2500, f2: 2500, type: 'sine', dur: 0.12, vol: 0.05, delay: 0.06 }); break;
      default: N({ dur: 0.12 * k, vol: 0.28, freq: 1400, freq2: 4200, type: 'bandpass', q: 1.2 }); T({ f: 2600, f2: 1900, type: 'triangle', dur: 0.1, vol: 0.06, delay: 0.02 }); // axioma: cuchilla que sale
    }
    if (hit > 0 || kind === 'exec' || kind === 'hit') { // el golpe
      const d = kind === 'hit' ? 0 : 0.06 * k;
      this.thump(big ? 110 : 150, 45, 0.18 * k, big ? 0.6 : 0.4, at, d);
      switch (host) {
        case 'vesper': this.crack(0.3, at, 5000, 0.04, d); T({ f: 900 + r() * 200, f2: 300, type: 'sawtooth', dur: 0.08, vol: 0.1, delay: d }); break;
        case 'micelio': N({ dur: 0.3, vol: 0.4, freq: 600, freq2: 80, delay: d }); this.thump(60, 28, 0.4, 0.55, at, d); break;
        case 'umbra': T({ f: 1800, f2: 400, type: 'sine', dur: 0.25, vol: 0.14, delay: d }); N({ dur: 0.2, vol: 0.2, freq: 5000, freq2: 800, type: 'bandpass', q: 3, delay: d }); break;
        case 'seraf': this.crack(0.5, at, 3000, 0.05, d); T({ f: 700, f2: 1500, dur: 0.12, vol: 0.12, delay: d }); break;
        case 'danzante': this.crack(0.35, at, 3600, 0.04, d); [1760, 2349].forEach((f, i) => T({ f, dur: 0.25, vol: 0.06, delay: d + i * 0.04 })); break;
        default: this.crack(0.3, at, 2600, 0.05, d); T({ f: 1300, f2: 800, type: 'square', dur: 0.06, vol: 0.08, delay: d });
      }
    }
    if (kind === 'exec') { this.thump(55, 24, 0.7, 0.8, at, 0.08); [880, 1175, 1760].forEach((f, i) => T({ f, f2: f * 1.02, dur: 0.35, vol: 0.1, delay: 0.1 + i * 0.07 })); N({ dur: 0.5, vol: 0.3, freq: 3000, freq2: 100, delay: 0.06 }); }
  }

  /* ───── música generativa ───── */
  startMusic(mapId) {
    if (!this.ctx || this.mapId === mapId) return; this.mapId = mapId; this.step = 0;
    clearInterval(this.musTimer);
    const base = mapId === 'base';   // La Base (docs/BASE.md): música calma y cálida (pentatónica mayor, sin pulso de combate)
    const sc = base ? [0, 2, 4, 7, 9, 12, 14] : mapId === 'm1' ? [0, 2, 4, 6, 7, 9, 11] : [0, 1, 4, 5, 7, 8, 10];
    const root = base ? 52 : mapId === 'm1' ? 55 : 49;
    this.musTimer = setInterval(() => {
      if (!this.enabled || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime + 0.05, i = this.step++, inten = base ? 0.05 : this.intensity;
      const note = (deg, oct, dur, vol, type = 'sine', bus = this.musBus, echo = true) => {
        const o = this.ctx.createOscillator(), e = this.ctx.createGain();
        o.type = type; o.frequency.value = root * 2 ** oct * 2 ** (sc[((deg % 7) + 7) % 7] / 12 + Math.floor(deg / 7));
        e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(e); e.connect(bus); if (echo) e.connect(this.delay); o.start(t); o.stop(t + dur + 0.1);
      };
      if (i % 16 === 0) { note(0, 0, 4.5, 0.5, 'sawtooth', this.musBus, false); note(4, 1, 4.5, 0.18, 'triangle'); }
      if (i % 4 === 0 && inten > 0.15) note(0, 1, 0.3, 0.35 * inten + 0.1, 'sine', this.musBus, false); // pulso grave
      const prob = 0.35 + 0.5 * inten;
      if (Math.random() < (base ? 0.3 : prob)) note(Math.floor(Math.random() * 10), 3, 0.5, 0.22, i % 3 ? 'triangle' : 'sine');
      if (inten > 0.4 && i % 2 === 0) note(Math.floor(Math.random() * 5) * 2, 4, 0.18, 0.1, 'square');
    }, 220);
  }
}
