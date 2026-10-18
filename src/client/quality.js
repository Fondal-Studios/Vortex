// Calidad gráfica: Baja (iPhone / equipos modestos), Media y Alta (PC). Se guarda en el navegador.
export const LEVELS = {
  low:    { label: 'Baja (iPhone)', pixelRatio: 0.85, maxPR: 1,   edges: false, particles: 700,  decor: false, skyIters: 4, shellIters: 3, halos: false, shards: 6,  tracers: 12, humans: 'low',    fps: 60, post: false, grade: true, msaa: 4, env: true, lights: 2, lod: 20, full: 10, shadows: false, fogLayers: 1, nieblas: 1, scale: 1 },
  medium: { label: 'Media',         pixelRatio: 1,   maxPR: 1.25, edges: false, particles: 1600, decor: true,  skyIters: 6, shellIters: 4, halos: true,  shards: 12, tracers: 24, humans: 'medium', fps: 60, post: true,  grade: true, msaa: 4, env: true,  lights: 3, bloom: 0.4, lod: 38, full: 24, shadows: false, fogLayers: 2, nieblas: 2, scale: 1 },
  high:   { label: 'Alta',          pixelRatio: 1.5, maxPR: 2,   edges: true,  particles: 3000, decor: true,  skyIters: 8, shellIters: 5, halos: true,  shards: 18, tracers: 40, humans: 'high',   fps: 60, post: true,  grade: true, msaa: 4, env: true,  lights: 4, bloom: 0.55, lod: 70, full: 56, shadows: true, fogLayers: 3, nieblas: 2, scale: 1 },
};
const KEY = 'cristal.calidad.v1';

export function isTouchDevice() {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return coarse || (navigator.maxTouchPoints || 0) > 1 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
}
export function isIOS() { return /iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1); }

/** Elige el nivel inicial: URL (?q=) > guardado > detección (teléfono ⇒ baja, PC ⇒ alta). */
export function initialQuality(params = new URLSearchParams(location.search)) {
  const q = params.get('q');
  if (q && LEVELS[q]) return q;
  try { const s = localStorage.getItem(KEY); if (s && LEVELS[s]) return s; } catch { /* modo privado */ }
  if (isTouchDevice()) return 'low';
  return (navigator.hardwareConcurrency || 4) >= 6 ? 'high' : 'medium';
}
export function saveQuality(level) { try { localStorage.setItem(KEY, level); } catch { /* sin almacenamiento */ } }
export const lower = (level) => (level === 'high' ? 'medium' : 'low');
export let current = 'high';
/** AJUSTES FINOS del menú «Gráficos» (src/client/graficos.js): lo que el jugador cambió a mano sobre el nivel base (escala, sombras, post, partículas…).
 *  `cfg()` devuelve el nivel + esos cambios; se recalcula sólo cuando cambia algo (no crea objetos por cuadro). */
let over = null, merged = null;
export function setCurrent(l) { current = l; merged = null; }
export function setOverrides(o) { over = o && Object.keys(o).length ? { ...o } : null; merged = null; }
export const overrides = () => over || {};
export const cfg = () => (over ? (merged || (merged = { ...LEVELS[current], ...over })) : LEVELS[current]);

/** Vigila los FPS y propone bajar de nivel si hace falta (≥ 5 s seguidos por debajo del umbral). */
export class AutoQuality {
  /** onDrop(nivelMásBajo): baja un escalón (Alta→Media→Baja). onScale(): en Baja ya no hay escalón; si existe, se llama para bajar la resolución de a poco (la decide quien lo usa). */
  constructor(onDrop, onScale = null) { this.onDrop = onDrop; this.onScale = onScale; this.bad = 0; this.enabled = true; }
  tick(dt, level) {
    if (!this.enabled) return;
    if (level === 'low' && !this.onScale) return;
    const fps = 1 / Math.max(dt, 1e-4);
    this.bad = fps < 24 ? this.bad + dt : Math.max(0, this.bad - dt * 2);
    if (this.bad > 5) { this.bad = 0; if (level === 'low') this.onScale(); else this.onDrop(lower(level)); }
  }
}

/** CLARIDAD (legibilidad del Huésped y los enemigos; la psicodelia sigue a tope, pero la lectura del jugador manda).
 *  «Normal» ya trae un mínimo medible de contraste (tools/legibilidad.mjs); «Alta» sube relleno, contorno de luz y suelo. Se guarda en ajustes (settings.js · claridad) o con ?claridad=alta.
 *   key: luz de relleno que sigue al Huésped · rim: fuerza del borde de luz del cuerpo · halo: resplandor detrás de la silueta · pool: charco de luz en el suelo · outline: contorno de luz por salto de profundidad (post.js)
 *   floor: piso tintado en las sombras (post.js, conserva el tono de cada mapa) · fog: tope de opacidad de la niebla · exp: multiplicador de exposición · beacon: halo de color de cada enemigo · beaconDark: halo oscuro detrás (recorta al enemigo claro del fondo) */
export const CLARIDAD = {
  normal: { id: 'normal', label: 'Normal', key: 1.0, rim: 1.0, halo: 0.34, pool: 0.35, floor: 0.04, outline: 0.8, fog: 0.62, exp: 1.05, beacon: 0.42, beaconDark: 0.6 },
  alta:   { id: 'alta',   label: 'Alta',   key: 1.7, rim: 1.9, halo: 0.6,  pool: 0.85, floor: 0.085, outline: 1.0, fog: 0.5,  exp: 1.12, beacon: 0.6, beaconDark: 0.78 },
};
/** Uniforme compartido (0 = Normal, 1 = Alta) que leen los materiales del cuerpo (borde de luz) sin reconstruirse. */
export const uClar = { value: 0 };
/** Qué tan OSCURO es cada mapa (medido en tools/legibilidad.mjs: luma media de la imagen en 3ª persona, sin Claridad): los mapas ya claros (m4-m6) no necesitan relleno,
 *  que sólo les restaría contraste y lavaría los neones; los oscuros (m1-m3) lo llevan completo. Escala relleno, charco, piso de sombras y exposición. */
export const MAP_OSCURO = { m1: 1, m2: 1.2, m3: 1.1, m4: 0.45, m5: 0.3, m6: 0.25 };
let clar = 'normal', mapa = 'm1', eff = null;
function calc() {
  const b = CLARIDAD[clar], f = MAP_OSCURO[mapa] ?? 1;
  eff = { ...b, key: b.key * f, pool: b.pool * f, floor: b.floor * f, exp: 1 + (b.exp - 1) * f, halo: b.halo * (0.5 + 0.5 * f), oscuro: f };
}
export function setClaridad(id) { if (CLARIDAD[id]) { clar = id; uClar.value = id === 'alta' ? 1 : 0; calc(); } return clar; }
export function setClaridadMapa(id) { mapa = id; calc(); }
/** Valores EFECTIVOS de la Claridad para el mapa actual. */
export const claridad = () => eff || (calc(), eff);
export function initialClaridad(saved, params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()) {
  const q = params.get('claridad'); return CLARIDAD[q] ? q : (CLARIDAD[saved] ? saved : 'normal');
}
