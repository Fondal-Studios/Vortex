// Calidad gráfica: Baja (iPhone / equipos modestos), Media y Alta (PC). Se guarda en el navegador.
export const LEVELS = {
  low:    { label: 'Baja (iPhone)', pixelRatio: 0.85, maxPR: 1,   edges: false, particles: 700,  decor: false, skyIters: 4, shellIters: 3, halos: false, shards: 6,  tracers: 12, humans: 'low',    fps: 30, post: false, grade: true, msaa: 4, env: true, lights: 2, lod: 20, full: 10, shadows: false },
  medium: { label: 'Media',         pixelRatio: 1,   maxPR: 1.25, edges: false, particles: 1600, decor: true,  skyIters: 6, shellIters: 4, halos: true,  shards: 12, tracers: 24, humans: 'medium', fps: 60, post: true,  grade: true, msaa: 4, env: true,  lights: 3, bloom: 0.4, lod: 38, full: 24, shadows: false },
  high:   { label: 'Alta',          pixelRatio: 1.5, maxPR: 2,   edges: true,  particles: 3000, decor: true,  skyIters: 8, shellIters: 5, halos: true,  shards: 18, tracers: 40, humans: 'high',   fps: 60, post: true,  grade: true, msaa: 4, env: true,  lights: 4, bloom: 0.55, lod: 70, full: 56, shadows: true },
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
export function setCurrent(l) { current = l; }
export const cfg = () => LEVELS[current];

/** Vigila los FPS y propone bajar de nivel si hace falta (≥ 5 s seguidos por debajo del umbral). */
export class AutoQuality {
  constructor(onDrop) { this.onDrop = onDrop; this.bad = 0; this.enabled = true; }
  tick(dt, level) {
    if (!this.enabled || level === 'low') return;
    const fps = 1 / Math.max(dt, 1e-4);
    this.bad = fps < 24 ? this.bad + dt : Math.max(0, this.bad - dt * 2);
    if (this.bad > 5) { this.bad = 0; this.onDrop(lower(level)); }
  }
}
