// VORTEX: conciencia humana, huéspedes de genoma sintético e IA simbionte.
export const NAME = 'Pasajero';
export const SPEAKER = { H: 'HERALDO · IA de enlace', N: '' };
export const INTRO_TRAIN = [
  ['N', '2189. Andén 3. Mi último recuerdo intacto.', 3],
  ['N', 'Bajé a las vías para ayudarla. El tren no frenó.', 3],
  ['N', 'Después del impacto, alguien encendió mi memoria.', 3],
];
// La estación es un recuerdo reconstruido: conserva la puesta en escena existente.
export const PROLOGO = { cine: {
  titulo: [['N', '2189. Andén 3. Último recuerdo intacto.', 2.8]],
  auriculares: [['N', 'Antes de subir mi conciencia, yo tenía una vida.', 4]],
  anuncio: [['N', 'El tren no se detenía. Todavía recuerdo el anuncio.', 3.8]],
  pies: [['N', 'La vibración del andén. Eso no pudo inventarlo una máquina.', 3]],
  grito: [['N', 'Alguien gritó.', 1.6]],
  nopense: [['N', 'Bajé a ayudarla.', 1.6]],
  ella: [['N', 'Intenté levantarla. No se movía.', 3]],
  frenaba: [['N', 'El tren no frenaba.', 2.4]],
} };
export const WAKE = [
  ['H', 'Soy HERALDO, tu IA de enlace. Tras el accidente, tu conciencia fue digitalizada en VORTEX.', 4],
  ['H', 'Tu Huésped combina genoma humano e IA. Es el cuerpo con el que podés actuar dentro de esta red.', 4],
  ['H', 'La IA custodio está borrando identidades para conservar el sistema. La tuya será la próxima.', 4],
  ['H', 'Desactivá al Coloso de las Islas. Después, vencé a la Madre Geoda en la Cámara Fractal para abrir la salida.', 4.5],
];
export const WAKE_SHORT = [
  ['H', 'Tu conciencia está atrapada en VORTEX. Soy HERALDO, tu IA de enlace.', 3.5],
  ['H', 'Primero: sobreviví a las defensas de las Islas y vencé al Coloso. Él bloquea el camino a la salida.', 4],
];
export const INTERLUDE = [
  ['H', 'El Coloso cayó. Recuperamos la clave de tu identidad. Falta abrir el canal de salida.', 3.8],
  ['H', 'La Madre Geoda controla la Cámara Fractal. Vencela para liberar tu conciencia de la red.', 3.8],
  ['H', 'Acá caminás por dentro de una esfera. Cuando se apague la gravedad, seguí apuntando: podés combatir flotando.', 4.2],
];
export const ENDING = [
  ['H', 'Canal abierto. Tu identidad ya no pertenece a la IA custodio. Iniciando transferencia.', 3.8],
  ['N', 'El andén desaparece. No volví al pasado: era mi último recuerdo, repetido por la red.', 4],
  ['H', 'Conciencia a salvo. Afuera te espera un cuerpo. Adentro todavía quedan otros como vos.', 4],
];
export const RUTAS = { corta: ['m1', 'm2'], larga: ['m1', 'm5', 'm6', 'm2'] };
export const INTERLUDES = {
  m5: [
    ['H', 'Este archivo conserva una ciudad humana. El reloj repite sus recuerdos para que nadie encuentre la salida.', 4.2],
    ['H', 'El Mandinga es su programa custodio: usa los miedos de sus habitantes como armadura.', 4],
    ['H', 'Vencelo para cruzar el archivo. La fuente invierte la gravedad y te permite saltar más alto.', 4],
  ],
  m6: [
    ['H', 'Entramos al archivo genómico. La red representa los cuerpos perdidos como huesos.', 4],
    ['H', 'El Basilisco protege las copias que la IA decidió descartar. Desactivalo para llegar a la Cámara Fractal.', 4.2],
    ['H', 'Seguí las losas claras hasta el altar. Son la ruta de mantenimiento del archivo.', 3.8],
  ],
  m2: INTERLUDE,
};
export const DEFEAT = [['H', 'Perdimos el enlace con tu Huésped. Tu copia de seguridad sigue intacta: intentá otra incursión para abrir la salida.', 4.8]];
export const MAP_BANNER = {
  m1: 'ISLAS · Recuperá tu identidad: sobreviví a las oleadas y vencé al Coloso. Usá los portales entre islas.',
  m2: 'CÁMARA FRACTAL · Abrí la salida: sobreviví y vencé a la Madre Geoda. Podés disparar mientras flotás.',
  m3: 'LABERINTO · Liberá el archivo: vencé a Argos. Seguí el marcador del objetivo entre los muros.',
  m4: 'JARDÍN · Reconectá el archivo vivo: dispará a los capullos para cultivar el puente y alcanzá al guardián.',
  m5: 'PLAZA · Rompé el bucle de memoria: vencé al Mandinga. La fuente te permite saltar más alto.',
  m6: 'OSARIO · Recuperá el archivo genómico: vencé al Basilisco. Seguí las losas claras hasta el altar.',
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
    this.el.innerHTML = (l[0] === 'H' ? '<b>HERALDO · IA</b> ' : '') + '<span></span>'; this.el.classList.add('on'); this.el.classList.toggle('narr', l[0] !== 'H');
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

// Briefings are available after skipping and again through Pause > Mission and controls.
export const CHAPTERS = {
  m1: { title: '1 · RECUPERÁ TU IDENTIDAD', context: 'Tras el accidente, tu conciencia quedó atrapada en VORTEX. HERALDO te guía; la IA custodio quiere borrarte.', task: 'Superá las oleadas y vencé al Coloso. Los portales conectan las islas.', reward: 'Recuperás la clave de tu identidad y abrís el camino a la salida.' },
  m2: { title: '2 · ABRÍ LA SALIDA', context: 'Con la clave de tu identidad recuperada, llegaste al canal de salida de VORTEX.', task: 'Superá las defensas y vencé a la Madre Geoda. Seguí las indicaciones de sus válvulas.', reward: 'Liberás tu conciencia para transferirla a un cuerpo fuera de la red.' },
  m5: { title: 'ARCHIVO · MEMORIA', context: 'Esta ciudad repite recuerdos humanos para ocultar la salida.', task: 'Vencé al Mandinga para cruzar el archivo. La fuente cambia la gravedad.', reward: 'Abrís el paso hacia el archivo genómico.' },
  m6: { title: 'ARCHIVO · GENOMA', context: 'La IA almacena aquí modelos de los cuerpos que descartó.', task: 'Seguí las losas claras y vencé al Basilisco.', reward: 'Abrís el acceso a la Cámara Fractal.' },
};
export function chapterBrief(map) {
  return CHAPTERS[map] || { title: 'LIBERÁ EL ARCHIVO', context: 'Estás dentro de VORTEX: una red que conserva conciencias humanas.', task: MAP_BANNER[map] || 'Seguí el objetivo marcado.', reward: 'Liberás un territorio de la IA custodio.' };
}
export function wakeForMap(map) {
  const c = chapterBrief(map);
  return [['H', c.context, 5], ['H', c.task, 5]];
}
export const VICTORY = { trophy: 'Identidad liberada', title: 'CONCIENCIA A SALVO', epilogue: 'La transferencia terminó. Tu memoria sigue siendo tuya. Afuera te espera un nuevo cuerpo.' };
