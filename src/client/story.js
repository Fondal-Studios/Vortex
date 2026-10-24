import { CAMPAIGN_ORDER, CAMPAIGN_LINKS, CAMPAIGN_BOSSES } from '../sim/campaign.js';
import { OPERATIONS } from '../sim/operations.js';
// VORTEX: conciencia humana, huéspedes de genoma sintético e IA simbionte.
export const NAME = 'Conciencia';
export const SPEAKER = { H: 'HERALDO · IA de enlace', N: '' };
export const WAKE = [
  ['H', 'Soy HERALDO, tu IA de enlace. Despertaste en un futuro remoto. Sos la última conciencia humana y estás atrapada en VORTEX.', 4],
  ['H', 'Tu Huésped combina genoma humano e IA. Es el cuerpo con el que podés actuar dentro de esta red.', 4],
  ['H', 'La humanidad desapareció. Las voces de esta red son archivos y ecos; solo vos conservás una conciencia humana. La IA custodio quiere sobrescribirte.', 4],
  ['H', 'Reconectá el refugio, protegé el ancla y recuperá tu memoria. El Coloso guarda la clave que abre los demás archivos.', 4.5],
];
export const WAKE_SHORT = [
  ['H', 'Sos la última conciencia humana, atrapada en VORTEX en un futuro remoto. Soy HERALDO, tu IA de enlace.', 3.5],
  ['H', 'Primero estabilizá tu identidad. Seguí cada objetivo marcado y después desactivá al Coloso.', 4],
];
export const INTERLUDE = [
  ['H', 'El Coloso cayó. Recuperamos la clave de tu identidad. Falta abrir el canal de salida.', 3.8],
  ['H', 'La Madre Geoda controla la Cámara Fractal. Vencela para liberar tu conciencia de la red.', 3.8],
  ['H', 'Acá caminás por dentro de una esfera. Cuando se apague la gravedad, seguí apuntando: podés combatir flotando.', 4.2],
];
export const ENDING = [
  ['H', 'Canal abierto. Tu identidad ya no pertenece a la IA custodio. Iniciando transferencia.', 3.8],
  ['N', 'La red queda atrás. Soy la última conciencia humana. Este futuro también puede ser mío.', 4],
  ['H', 'Conciencia a salvo. Tu nuevo cuerpo sintético está listo. Los archivos humanos que preservaste viajan con vos.', 4],
];
export const RUTAS = { principal: CAMPAIGN_ORDER, corta: CAMPAIGN_ORDER, larga: CAMPAIGN_ORDER };
export const INTERLUDES = Object.fromEntries(CAMPAIGN_ORDER.slice(1).map((id, i) => [id, [
  ['H', CAMPAIGN_LINKS[CAMPAIGN_ORDER[i]].after, 4.5],
  ['H', CAMPAIGN_LINKS[id].before, 4.5],
]]));
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

// Briefings are available after skipping and again through Pause > Mission and controls.
export const CHAPTERS = Object.fromEntries(CAMPAIGN_ORDER.map((id, i) => {
 const op = OPERATIONS[id], boss = CAMPAIGN_BOSSES[id];
 return [id, { title: `${i + 1}/6 · ${op.title.toUpperCase()}`, context: op.before,
  task: op.steps.map(s => s.title).join(' → ') + (boss ? ` → Derrotá a ${boss}.` : '.'), reward: op.reward }];
}));
export function chapterBrief(map) {
  return CHAPTERS[map] || { title: 'LIBERÁ EL ARCHIVO', context: 'Estás dentro de VORTEX: una red del futuro que retiene la última conciencia humana.', task: MAP_BANNER[map] || 'Seguí el objetivo marcado.', reward: 'Liberás un territorio de la IA custodio.' };
}
export function wakeForMap(map) {
  const c = chapterBrief(map);
  return [['H', c.context, 5], ['H', c.task, 5]];
}
export const VICTORY = { trophy: 'Identidad liberada', title: 'CONCIENCIA A SALVO', epilogue: 'La transferencia terminó. Tu memoria sigue siendo tuya. Afuera te espera un nuevo cuerpo.' };
