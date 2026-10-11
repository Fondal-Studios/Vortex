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
    const o = this.ctx.createOscillator(), e = this.ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(1, t + att); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(e); e.connect(this._route(vol, at)); o.start(t); o.stop(t + dur + 0.05);
  }
  noise({ dur = 0.2, vol = 0.3, freq = 1500, q = 1, type = 'lowpass', freq2 = null, at = null, delay = 0 }) {
    if (!this.ctx || !this.enabled) return; const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t); if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const e = this.ctx.createGain(); e.gain.setValueAtTime(1, t); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(e); e.connect(this._route(vol, at)); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  shot(w, at) {
    switch (w) {
      case 0: this.tone({ f: 1100, f2: 300, type: 'triangle', dur: 0.12, vol: 0.25, at }); this.tone({ f: 2200, f2: 900, type: 'sine', dur: 0.08, vol: 0.12, at }); break;
      case 1: this.noise({ dur: 0.3, vol: 0.5, freq: 3000, freq2: 300, at }); this.tone({ f: 160, f2: 50, type: 'sawtooth', dur: 0.25, vol: 0.4, at }); break;
      case 2: this.tone({ f: 700, f2: 420, type: 'square', dur: 0.06, vol: 0.14, at }); this.noise({ dur: 0.05, vol: 0.1, freq: 6000, type: 'highpass', at }); break;
      case 3: this.tone({ f: 120, f2: 40, type: 'sawtooth', dur: 0.4, vol: 0.45, at }); this.noise({ dur: 0.35, vol: 0.25, freq: 900, freq2: 120, at }); break;
      case 4: this.tone({ f: 2600, f2: 120, type: 'sine', dur: 0.5, vol: 0.4, at }); this.tone({ f: 1300, f2: 60, type: 'triangle', dur: 0.6, vol: 0.25, at }); break;
    }
  }
  hit(at) { this.tone({ f: 900 + Math.random() * 300, f2: 400, type: 'triangle', dur: 0.05, vol: 0.12, at }); }
  boom(at) { this.noise({ dur: 0.7, vol: 0.7, freq: 1800, freq2: 60, at }); this.tone({ f: 90, f2: 25, type: 'sine', dur: 0.6, vol: 0.6, at }); }
  hurt() { this.tone({ f: 200, f2: 70, type: 'sawtooth', dur: 0.25, vol: 0.35 }); this.noise({ dur: 0.15, vol: 0.25, freq: 800 }); }
  pickup() { [0, 4, 7, 12].forEach((s, i) => this.tone({ f: 523 * 2 ** (s / 12), type: 'triangle', dur: 0.12, vol: 0.2, delay: i * 0.05 })); }
  wave() { [0, 7, 12, 19].forEach((s, i) => this.tone({ f: 110 * 2 ** (s / 12), type: 'sawtooth', dur: 0.9, vol: 0.18, att: 0.1, delay: i * 0.12 })); }
  gravity(at) { this.tone({ f: 80, f2: 600, type: 'sine', dur: 0.8, vol: 0.5, at }); this.tone({ f: 600, f2: 80, type: 'triangle', dur: 0.8, vol: 0.3, at, delay: 0.4 }); }
  portal(at) { this.tone({ f: 300, f2: 1500, type: 'sine', dur: 0.35, vol: 0.3, at }); this.tone({ f: 1500, f2: 300, type: 'triangle', dur: 0.35, vol: 0.2, at, delay: 0.1 }); }
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
  }

  /* ───── música generativa ───── */
  startMusic(mapId) {
    if (!this.ctx || this.mapId === mapId) return; this.mapId = mapId; this.step = 0;
    clearInterval(this.musTimer);
    const sc = mapId === 'm1' ? [0, 2, 4, 6, 7, 9, 11] : [0, 1, 4, 5, 7, 8, 10];
    const root = mapId === 'm1' ? 55 : 49;
    this.musTimer = setInterval(() => {
      if (!this.enabled || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime + 0.05, i = this.step++, inten = this.intensity;
      const note = (deg, oct, dur, vol, type = 'sine', bus = this.musBus, echo = true) => {
        const o = this.ctx.createOscillator(), e = this.ctx.createGain();
        o.type = type; o.frequency.value = root * 2 ** oct * 2 ** (sc[((deg % 7) + 7) % 7] / 12 + Math.floor(deg / 7));
        e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(e); e.connect(bus); if (echo) e.connect(this.delay); o.start(t); o.stop(t + dur + 0.1);
      };
      if (i % 16 === 0) { note(0, 0, 4.5, 0.5, 'sawtooth', this.musBus, false); note(4, 1, 4.5, 0.18, 'triangle'); }
      if (i % 4 === 0 && inten > 0.15) note(0, 1, 0.3, 0.35 * inten + 0.1, 'sine', this.musBus, false); // pulso grave
      const prob = 0.35 + 0.5 * inten;
      if (Math.random() < prob) note(Math.floor(Math.random() * 10), 3, 0.5, 0.22, i % 3 ? 'triangle' : 'sine');
      if (inten > 0.4 && i % 2 === 0) note(Math.floor(Math.random() * 5) * 2, 4, 0.18, 0.1, 'square');
    }, 220);
  }
}
