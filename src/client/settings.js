// Preferencias del jugador (se guardan en el navegador, por dispositivo). Versionadas: si cambia el formato se migra sin perder lo anterior.
const KEY = 'cristal.ajustes.v2', OLD_SENS = 'cristal.sens.touch.v1';
export const DEFAULTS = Object.freeze({
  sensX: 0.0062,      // rad por píxel (horizontal): ≈ 0.36°/px → un giro de 180° con ~500 px de deslizamiento
  sensY: 0.0052,      // rad por píxel (vertical)
  adsMul: 0.6,        // multiplicador al apuntar (ADS) con miras comunes
  scopeMul: 0.38,     // multiplicador con mira óptica (armas de largo alcance)
  accel: false,       // aceleración de cámara (opcional; por defecto velocidad FIJA)
  accelGain: 0.8,     // cuánto acelera un deslizamiento rápido (0..2)
  invertY: false,
  gyro: false, gyroSens: 1,
  aim: null,          // ayuda de puntería 0..3 (null = según dispositivo)
  fingers: 2,         // 2, 3 o 4 dedos
  hudScale: 1, hudOpacity: 0.85,
  adsMode: 'mantener', // 'mantener' | 'alternar'
  layout: {},         // { botón: { dx, dy, s } }: posiciones y tamaños personalizados
});
let cache = null;
function load() {
  let o = {}; try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { o = {}; }
  if (o.sensX == null) { try { const old = parseFloat(localStorage.getItem(OLD_SENS)); if (old > 0) o.sensX = Math.min(0.012, old * 1.35); } catch { /* ok */ } } // migración
  cache = { ...DEFAULTS, ...o, layout: { ...(o.layout || {}) } };
  return cache;
}
export const settings = () => cache || load();
export function setSetting(k, v) { const s = settings(); s[k] = v; save(); return s; }
export function save() { try { localStorage.setItem(KEY, JSON.stringify(settings())); } catch { /* sin almacenamiento */ } }
export function resetLayout() { const s = settings(); s.layout = {}; s.hudScale = 1; s.hudOpacity = 0.85; save(); }
/** Control deslizante 1..20 → rad/px (escala exponencial: afinado fino abajo, rápido arriba): 1→0.0012 · 12→0.0054 · 20→0.016. */
const R = Math.pow(0.016 / 0.0012, 1 / 19);
export const sensFromSlider = (v) => 0.0012 * Math.pow(R, v - 1);
export const sliderFromSens = (s) => Math.max(1, Math.min(20, Math.round(Math.log(s / 0.0012) / Math.log(R) + 1)));
