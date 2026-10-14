// Guion y puesta en escena: el tren, el despertar en el Vórtice, el Heraldo, el interludio y el final.
export const NAME = 'Pasajero';
export const SPEAKER = { H: 'Heraldo', N: '' };

// [quién, texto, duración s]
export const INTRO_TRAIN = [
  ['N', 'Martes. 18:42. Andén 3.', 2.6],
  ['N', 'Otro día igual. Los auriculares puestos, la cabeza en otra parte.', 3.2],
  ['N', 'El anuncio avisó que el tren no se detenía en esta estación.', 3.0],
  ['N', 'Alguien gritó. Después, la luz.', 2.2],
];
/* ───────── PRÓLOGO «LA ESTACIÓN» (cinemática 3D realista, src/client/prologo.js) ─────────
   El Pasajero narra en voz baja ('N'). Termina en el atropello: sigue WAKE («No dolió. Eso fue lo raro.» → el Vórtice).
   INTRO_TRAIN queda sólo para el cine 2D clásico (?classic_intro=1). Cada línea: [quién, texto, duración s]. */
export const PROLOGO = {
  cine: {
    titulo: [['N', 'Martes. 18:42. Andén 3.', 2.8]],
    auriculares: [['N', 'Otro día igual. Los auriculares puestos, la cabeza en otra parte.', 4.0]],
    anuncio: [['N', 'El anuncio avisó que el tren no se detenía en esta estación.', 3.8]],
    pies: [['N', 'Se sentía en los pies antes que en los oídos.', 3.0]],
    grito: [['N', 'Alguien gritó.', 1.6]],
    nopense: [['N', 'No lo pensé.', 1.6]],
    ella: [['N', 'Intenté levantarla. No se movía.', 3.0]],
    frenaba: [['N', 'El tren no frenaba.', 2.4]],
  },
};
export const WAKE = [
  ['N', 'No dolió. Eso fue lo raro.', 2.4],
  ['H', 'Shh. No te levantes de golpe. Todavía te estás… ensamblando.', 3.8],
  ['H', 'Sí: te atropelló un tren. Moriste. Esto es el Vórtice, el limbo: lo que queda entre la vida y lo que viene después.', 5.2],
  ['H', 'Pero escuchá ese latido. Es tuyo. Moriste y, de algún modo, todavía estás VIVO.', 4.6],
  ['H', 'Acá abajo todo añora la vida. Cada criatura de este lugar fue algo que la perdió… y ahora te huelen.', 4.8],
  ['H', 'Quieren lo que tenés. Lo único que tenés. Y no piden permiso.', 3.8],
  ['H', 'Solo no vas a durar. Hay guardianes que viven entre los muertos y los vivos: los Huéspedes.', 4.6],
  ['H', 'Hacé un pacto con uno. Él necesita tu cuerpo vivo para volver a cruzar; vos, su poder para salir de acá.', 5.0],
  ['H', 'Y evolucioná. Bien. Cada camino que elijas cierra otro: equivocarte acá se paga con lo que te queda de vida.', 5.4],
  ['H', 'Ya vienen. Que no te la quiten, Pasajero.', 3.2],
];
export const WAKE_SHORT = [
  ['N', 'No dolió. Eso fue lo raro.', 2.0],
  ['H', 'Moriste, pero seguís vivo. Todo acá quiere tu vida. Elegí bien tu Huésped y evolucioná. Ya vienen.', 4.6],
];
export const INTERLUDE = [
  ['H', 'Uno menos. El limbo tiembla… y ahora te desea más que antes.', 3.6],
  ['H', 'Hay otro corazón, más hondo: una cámara hueca donde el suelo está en todas partes.', 4.2],
  ['H', 'Cuando la marea te saque el peso, no te asustes. Flotar también se puede disparar.', 4.2],
];
export const ENDING = [
  ['H', 'Se rompió. Los dos. El Vórtice se pliega sobre sí mismo.', 3.6],
  ['H', 'Mirá arriba, Pasajero. Eso que suena es un tren. Esta vez, de largo.', 4.2],
  ['N', 'Andén 3. 18:42. Los auriculares puestos. Un abajo bajo los pies.', 4.0],
];
export const DEFEAT = [['H', 'Te quitaron la vida que te quedaba. Ahora sos uno más de los que añoran. …O no. Probá de nuevo: otro Huésped, otro camino.', 4.6]];
export const MAP_BANNER = {
  m1: 'VACÍO DE ISLAS — La gravedad cambia según dónde pisás. Círculos verdes: caés hacia arriba. Portales, burbujas de tiempo lento.',
  m2: 'CÁMARA FRACTAL — Caminás por dentro de una esfera hueca. Cada tanto la marea apaga la gravedad.',
};

/** Subtítulos con voz sintética del Heraldo (chirridos por letra). */
export class Subtitles {
  constructor(el, sound) { this.el = el; this.sound = sound; this.queue = []; this.cur = null; this.t = 0; this.talking = 0; this.cb = null; this.skipped = false; }
  play(lines, onDone) { this.queue = lines.slice(); this.cb = onDone || null; this.skipped = false; this.next(); }
  next() {
    const l = this.queue.shift();
    if (!l) { this.cur = null; this.el.classList.remove('on'); this.talking = 0; const cb = this.cb; this.cb = null; if (cb) cb(); return; }
    this.cur = { who: l[0], text: l[1], dur: l[2], shown: 0 }; this.t = 0;
    if (window.__evlog) window.__evlog.push({ t: window.__capT || 0, m: 'line', a: [l[0], l[1], l[2]] });
    this.el.innerHTML = (l[0] === 'H' ? '<b>Heraldo</b> ' : '') + '<span></span>'; this.el.classList.add('on'); this.el.classList.toggle('narr', l[0] !== 'H');
  }
  skip() { this.queue = []; this.skipped = true; this.cur = null; this.el.classList.remove('on'); this.talking = 0; const cb = this.cb; this.cb = null; if (cb) cb(); }
  get active() { return !!this.cur; }
  update(dt) {
    if (!this.cur) return;
    this.t += dt; const c = this.cur, want = Math.min(c.text.length, Math.floor(this.t * 32));
    if (want > c.shown) { const span = this.el.querySelector('span'); span.textContent = c.text.slice(0, want); if (c.who === 'H' && want % 2 === 0 && this.sound) this.sound.chirp(want); c.shown = want; }
    this.talking = c.who === 'H' && c.shown < c.text.length ? 1 : 0;
    if (this.t > c.dur + 0.5) this.next();
  }
}

/** Cine 2D del tren: rieles en perspectiva y un faro que crece hasta el impacto. En modo captura se avanza a mano con tick(dt). */
export function trainCine(canvas, durSec, onImpact, manual = false) {
  const g = canvas.getContext('2d'); let t = 0, raf = 0, last = performance.now(), hit = false, stopped = false;
  const W = () => (canvas.width = canvas.clientWidth * Math.min(devicePixelRatio || 1, 1.5)), H = () => (canvas.height = canvas.clientHeight * Math.min(devicePixelRatio || 1, 1.5));
  W(); H();
  function step(dt) {
    t += dt;
    const w = canvas.width, h = canvas.height, k = Math.min(1, t / durSec), ease = k * k * k;
    g.fillStyle = '#05040a'; g.fillRect(0, 0, w, h);
    const hx = w / 2 + Math.sin(t * 40) * ease * 6, hy = h * 0.46;
    g.strokeStyle = 'rgba(180,170,220,.35)'; g.lineWidth = 2;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(hx + s * 14, hy); g.lineTo(hx + s * w * 0.42, h); g.stroke(); }
    for (let i = 0; i < 14; i++) { const z = ((i / 14) + t * 0.9) % 1, y = hy + (h - hy) * z * z, wd = 14 + (w * 0.42 - 14) * z * z; g.strokeStyle = `rgba(150,140,190,${0.1 + z * 0.4})`; g.beginPath(); g.moveTo(hx - wd, y); g.lineTo(hx + wd, y); g.stroke(); }
    const r = 8 + ease * Math.max(w, h) * 0.9, gr = g.createRadialGradient(hx, hy, 0, hx, hy, r);
    gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.25, 'rgba(255,245,220,.8)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    if (k >= 1 && !hit) { hit = true; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); if (onImpact) onImpact(); }
    if (k < 1) { const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.9); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = v; g.fillRect(0, 0, w, h); }
  }
  function frame(now) { if (stopped) return; raf = requestAnimationFrame(frame); const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; step(dt); }
  if (!manual) raf = requestAnimationFrame(frame); else step(0);
  return { progress: () => Math.min(1, t / durSec), tick: step, stop() { stopped = true; cancelAnimationFrame(raf); } };
}
