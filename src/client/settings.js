// Preferencias del jugador (se guardan en el navegador, por dispositivo). Versionadas: si cambia el formato se migra sin perder lo anterior.
const KEY = 'cristal.ajustes.v2', OLD_SENS = 'cristal.sens.touch.v1';
export const DEFAULTS = Object.freeze({
  sensX: 0.0042,      // rad por píxel (horizontal): ≈ 0.24°/px → un giro de 180° con ~750 px (dos deslizamientos cómodos); más calmo que antes
  sensY: 0.0034,      // rad por píxel (vertical)
  adsMul: 0.6,        // multiplicador al apuntar (ADS) con miras comunes
  scopeMul: 0.38,     // multiplicador con mira óptica (armas de largo alcance)
  accel: false,       // aceleración de cámara (opcional; por defecto velocidad FIJA)
  accelGain: 0.8,     // cuánto acelera un deslizamiento rápido (0..2)
  invertY: false,
  reducirGravedad: false, // «Reducir efectos de gravedad»: la inversión de la Marea de Gravedad es un empujón hacia arriba, sin giro de cámara (viaja en el input como `soft`)
  faunaAuto: false,   // fauna consumible: comer solo al quedarte pegado a un bicho (~0,6 s); por URL ?autofauna=1. Por defecto se come con USAR / E
  gyro: false, gyroSens: 1,
  aim: null,          // ayuda de puntería 0..3 (null = según dispositivo)
  fingers: 2,         // 2, 3 o 4 dedos
  minimapOpacity: 0.85, hudScale: 1, hudOpacity: 0.85,
  essentialPowers: {}, // un poder equipado por huésped y modo, los demás disponibles en completo
  advanced: false,    // controles completos; por defecto cuatro acciones táctiles y HUD esencial
  mode: 'shooter',    // MODO DE JUEGO: 'shooter' (el de siempre) | 'combo' (dos ataques encadenados + una habilidad; data.js GAME_MODES). También por URL ?modo=combo|shooter
  modes: {},          // MODO elegido por Huésped en partida: { axioma: 'combo', vesper: 'shooter', … } ('shooter' = Disparo, 'combo' = Melé); sin entrada ⇒ vale `mode`
  showKeys: false,    // «Mostrar controles»: pista de teclas en pantalla (PC)
  style: 'disparo',  // estilo de combate: 'melee' | 'disparo' | 'habilidad' (data.js STYLES)
  simple: false,       // MODO SIMPLE: ayuda de puntería alta, dispara solo al tener un enemigo en la mira y golpea solo cuando lo tenés encima
  claridad: 'normal', // CLARIDAD visual (quality.js · CLARIDAD): 'normal' | 'alta' (más luz de relleno y contorno de luz sobre el Huésped y los enemigos)
  baseAlTerminar: true, // al terminar una partida se ofrece «Entrar a la Base» en vez de volver al menú (docs/BASE.md)
  third: false,        // cámara en tercera persona sobre el hombro (verte a vos mismo)
  camDist: 3.6, camSide: 1, camFov: 78,   // distancia, hombro (1 derecha / -1 izquierda) y campo de visión de la 3ª persona
  adsMode: 'mantener', // 'mantener' | 'alternar'
  layout: {},         // { botón: { dx, dy, s } }: posiciones y tamaños personalizados
});
let cache = null;
function load() {
  let o = {}; try { o = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { o = {}; }
  if (o.sensX == null) { try { const old = parseFloat(localStorage.getItem(OLD_SENS)); if (old > 0) o.sensX = Math.min(0.012, old * 1.35); } catch { /* ok */ } } // migración
  if (o.ver !== 3) { delete o.sensX; delete o.sensY; o.ver = 3; }   // v3: sensibilidad por defecto más baja (la anterior se sentía nerviosa)
  cache = { ...DEFAULTS, ...o, layout: { ...(o.layout || {}) }, modes: { ...(o.modes || {}) } };
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
