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
/* ───────── PRÓLOGO «LA ESTACIÓN» (escena 3D, src/client/prologo.js) ─────────
   Todo es el Pasajero pensando en voz baja ('N'). Cada bloque es [quién, texto, duración s]. Termina en el faro que
   después, en WAKE, el Heraldo llama «te atropelló un tren». INTRO_TRAIN queda sólo para el cine clásico (?classic_intro=1). */
export const PROLOGO = {
  espera: [
    ['N', 'Martes. 18:42. Andén 3.', 2.8],
    ['N', 'Otro día igual. Los auriculares puestos, la cabeza en otra parte.', 3.6],
  ],
  cartel: [['N', '«Exprés sin parada». O sea: nadie sube, nadie baja. Perfecto.', 3.6]],
  tren: [
    ['N', 'El anuncio raspa los parlantes: el próximo tren no se detiene.', 3.4],
    ['N', 'Se siente en los pies antes que en los oídos.', 2.8],
  ],
  borde: [['N', 'Una mujer se tambalea justo en el borde…', 2.6]],
  caida: [['N', '¡Se cayó! ¡Cayó a las vías!', 2.2], ['N', 'Alguien grita. Creo que soy yo.', 2.6]],
  ruptura: [
    ['N', 'El tiempo se estira como un chicle viejo.', 3.0],
    ['N', 'Las luces se alargan, el sonido se arrastra. El tren atraviesa algo que no estaba ahí.', 4.4],
    ['N', 'Las paredes respiran.', 2.4],
  ],
  contacto: [
    ['N', 'De las vías sube algo vivo. Tiene un ojo enorme y me mira.', 3.8],
    ['N', 'Me ofrece una cosa tibia. Se me pega a la mano. Late.', 3.8],
  ],
  disparo: [['N', 'Sabe para qué sirve. Apuntá al capullo del otro andén y disparale.', 4.2]],
  impacto: [['N', 'Mi mano disparó sola… casi.', 2.2]],
  decision: [
    ['N', 'Entre las nervaduras quedó un mecanismo. Y al fondo, un umbral latiendo.', 4.0],
    ['N', 'Quedarme a ver cómo termina, o cruzar. Elegir también es esperar menos.', 3.8],
  ],
  abierto: [['N', 'Se abrió. Del otro lado hay luz. Y un faro, muy cerca.', 3.4]],
};
/** Objetivos en pantalla del prólogo: [título, pista PC, pista táctil]. */
export const PROLOGO_OBJ = {
  mirar: ['Mirá a tu alrededor', 'Mové el ratón (o las flechas) para mirar', 'Deslizá el pulgar derecho para mirar'],
  caminar: ['Caminá hasta el cartel de horarios', 'W A S D para caminar', 'Palanca izquierda para caminar'],
  leer: ['Leé la pantalla', 'Quedate frente al cartel', 'Quedate frente al cartel'],
  tren: ['Algo viene por el túnel', 'Mirá hacia el fondo de la vía', 'Mirá hacia el fondo de la vía'],
  ayudar: ['¡Ayudala! Acercate al borde del andén', 'W A S D hasta la marca brillante', 'Palanca izquierda hasta la marca brillante'],
  ruptura: ['Observá la ruptura', 'Esto no es normal. Seguí mirando.', 'Esto no es normal. Seguí mirando.'],
  contacto: ['Algo se acerca', 'Quedate quieto: te está eligiendo', 'Quedate quieto: te está eligiendo'],
  disparar: ['Disparale al capullo del otro andén', 'Apuntá con el ratón · clic izquierdo para disparar', 'Apuntá con el pulgar · tocá DISPARO'],
  activar: ['Activá el mecanismo', 'Acercate al pedestal y pulsá E', 'Acercate al pedestal y tocá USAR'],
  cruzar: ['Atravesá el umbral', 'Caminá hacia el anillo luminoso', 'Caminá hacia el anillo luminoso'],
};
export const WAKE = [
  ['N', 'No dolió. Eso fue lo raro.', 2.4],
  ['H', 'Shh. No te levantes de golpe. Todavía te estás… ensamblando.', 3.8],
  ['H', 'Sí: te atropelló un tren. Todos lo cuentan igual. Y todos preguntan lo mismo: «¿estoy muerto?».', 4.6],
  ['H', 'Casi. Esto es el Vórtice: lo que queda entre estar vivo y no estarlo.', 4.0],
  ['H', 'Te dejó esas armas. Acá nada perdona, y el Vórtice es un anfitrión previsor.', 4.2],
  ['H', 'La regla es una sola: sobrevivís a TODO lo que venga y volvés al mundo de los vivos. Si no… te quedás. De adorno.', 5.6],
  ['H', 'Dos corazones sostienen este lugar. Rompelos. Y no te caigas: acá abajo no hay «abajo».', 4.6],
  ['H', 'Ya vienen. Dispará a todo lo que se mueva. Suerte, Pasajero.', 3.4],
];
export const WAKE_SHORT = [
  ['N', 'No dolió. Eso fue lo raro.', 2.0],
  ['H', 'Sobrevivís a todo y volvés al mundo de los vivos. Si no, te quedás. Ya vienen.', 4.2],
];
export const INTERLUDE = [
  ['H', 'Uno menos. El Vórtice tiembla… y se acuerda de vos.', 3.6],
  ['H', 'Hay otro corazón, más hondo: una cámara hueca donde el suelo está en todas partes.', 4.2],
  ['H', 'Cuando la marea te saque el peso, no te asustes. Flotar también se puede disparar.', 4.2],
];
export const ENDING = [
  ['H', 'Se rompió. Los dos. El Vórtice se pliega sobre sí mismo.', 3.6],
  ['H', 'Mirá arriba, Pasajero. Eso que suena es un tren. Esta vez, de largo.', 4.2],
  ['N', 'Andén 3. 18:42. Los auriculares puestos. Un abajo bajo los pies.', 4.0],
];
export const DEFEAT = [['H', 'El Vórtice te guarda un lugar. Siempre hay lugar. Probá de nuevo.', 3.6]];
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
