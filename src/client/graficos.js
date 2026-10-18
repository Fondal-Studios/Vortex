// MENÚ DE GRÁFICOS — la parte PURA (sin DOM, probada en tests/graficos.test.js): qué significa cada preset, cada interruptor, cómo se guarda
// y cómo se traduce a los ajustes que lee el renderizador (quality.js → cfg()). La pantalla vive en graficos-ui.js.
//
// Idea: el jugador elige un PRESET (Baja / Media / Alta / Automático) y, si quiere, cambia cosas sueltas encima (resolución, sombras, bloom…).
// Lo guardado es { preset, auto, medidor, ajustes:{…sólo lo que cambió a mano} }. `resolver()` devuelve el nivel base (low/medium/high) y los
// cambios sobre ese nivel (los que va a leer cfg()). Así «Restablecer» es borrar `ajustes`, y cambiar de preset limpia lo que no venga al caso.
import { LEVELS } from './quality.js';

export const KEY = 'cristal.graficos.v1';

/** Los 4 presets. `nivel`: nivel base de quality.js. `quien`: para qué equipo sirve (se muestra en la tarjeta). */
export const PRESETS = {
  baja:  { id: 'baja',  nombre: 'Baja',  nivel: 'low',    icono: '🔋', quien: 'iPhone y teléfonos',
    desc: 'Para iPhone y la mayoría de teléfonos. Resolución y efectos al mínimo: poca batería y poco calor. Si igual se calienta, limitá a 30 FPS.' },
  media: { id: 'media', nombre: 'Media', nivel: 'medium', icono: '⚖', quien: 'iPhone recientes, tablets y PC modestas',
    desc: 'Para iPhone recientes (12 en adelante), iPad y notebooks. 60 FPS con brillo y niebla de aire; sin sombras.' },
  alta:  { id: 'alta',  nombre: 'Alta',  nivel: 'high',   icono: '🖥', quien: 'PC con placa de video',
    desc: 'Para PC con placa de video. Sombras, más resolución y todos los detalles. No la uses en el teléfono: se traba.' },
  auto:  { id: 'auto',  nombre: 'Automático', nivel: null, icono: '✨', quien: 'No sé cuál elegir',
    desc: 'Elige por vos según tu equipo (teléfono → Baja, PC → Alta o Media) y baja solo si los FPS caen.' },
};
export const PRESET_IDS = Object.keys(PRESETS);

/** Opciones sueltas. `cfg`: clave que cambia en quality.js. `costo`: 0 casi gratis … 3 muy caro. `en vivo`: se aplica sin reconstruir la escena. */
export const OPCIONES = {
  sombras:   { id: 'sombras',   tipo: 'switch', cfg: 'shadows',   nombre: 'Sombras',                 costo: 3, vivo: false, nota: 'Las sombras del sol sobre el suelo y las criaturas. Lo más caro de todo: apagalas primero si va lento.' },
  bloom:     { id: 'bloom',     tipo: 'switch', cfg: 'post',      nombre: 'Resplandor (bloom)',      costo: 2, vivo: true,  nota: 'El halo de luz alrededor de lo que brilla. Se ve muy psicodélico, pero pide una pasada extra de pantalla.' },
  postproc:  { id: 'postproc',  tipo: 'switch', cfg: 'grade',     nombre: 'Color y contorno',        costo: 1, vivo: true,  nota: 'El color final de cada mapa, la viñeta y el borde de luz que separa al Huésped del fondo. Apagado se ve plano y cuesta leer.' },
  nieblaAire:{ id: 'nieblaAire',tipo: 'pasos',  cfg: 'fogLayers', nombre: 'Niebla de aire',          costo: 2, vivo: true,  nota: 'La bruma de profundidad de cada mapa (capas). Cada capa extra suma trabajo a cada píxel.', pasos: [{ v: 0, t: 'No' }, { v: 1, t: '1 capa' }, { v: 2, t: '2 capas' }, { v: 3, t: '3 capas' }] },
  particulas:{ id: 'particulas',tipo: 'pasos',  cfg: 'particles', nombre: 'Partículas',              costo: 1, vivo: true,  nota: 'Chispas, humo y esquirlas de disparos y golpes. En combates grandes son muchas.', pasos: [{ v: 0.5, t: 'Pocas' }, { v: 1, t: 'Normal' }, { v: 1.6, t: 'Muchas' }] },
  nieblasFx: { id: 'nieblasFx', tipo: 'pasos',  cfg: 'nieblas',   nombre: 'Nubes de las nieblas de colores', costo: 1, vivo: true, nota: 'Cuántas nubes se dibujan en cada niebla de color. «Sólo aviso» deja el círculo en el suelo y el cartel (el efecto en el juego es el mismo).', pasos: [{ v: 0, t: 'Sólo aviso' }, { v: 1, t: 'Simples' }, { v: 2, t: 'Completas' }] },
  humanos:   { id: 'humanos',   tipo: 'pasos',  cfg: 'humans',    nombre: 'Detalle de Huéspedes y criaturas', costo: 2, vivo: false, nota: 'Cuántos polígonos tienen el cuerpo del Huésped y las criaturas. Se reconstruye la escena (1-2 s).', pasos: [{ v: 'low', t: 'Bajo' }, { v: 'medium', t: 'Medio' }, { v: 'high', t: 'Alto' }] },
  decorado:  { id: 'decorado',  tipo: 'switch', cfg: 'decor',     nombre: 'Decorado del mapa',       costo: 2, vivo: false, nota: 'Cielo con capas, ojos cósmicos, vegetación y adornos. Apagado queda lo justo para jugar. Se reconstruye la escena.' },
  lod:       { id: 'lod',       tipo: 'pasos',  cfg: 'lod',       nombre: 'Distancia de dibujo',     costo: 1, vivo: true,  nota: 'Hasta dónde se dibujan las criaturas con todo su detalle (más lejos se vuelven siluetas simples).', pasos: [{ v: 0.6, t: 'Corta' }, { v: 1, t: 'Normal' }, { v: 1.5, t: 'Larga' }] },
  fps:       { id: 'fps',       tipo: 'pasos',  cfg: 'fps',       nombre: 'Límite de FPS',           costo: 2, vivo: true,  nota: '30 FPS gasta la mitad de batería y calor que 60. Si tu pantalla se siente a saltos, probá 30.', pasos: [{ v: 30, t: '30' }, { v: 60, t: '60' }] },
};
export const OPCION_IDS = Object.keys(OPCIONES);
export const ESCALA = { min: 50, max: 150, paso: 5, base: 100 };
export const COSTO_TXT = ['casi nada', 'poco', 'medio', 'mucho'];

/** Cuánto cuesta cada cosa, de más a menos (para la nota «qué pesa más»). Texto para principiantes. */
export const NOTA_COSTOS = [
  'Lo que más pesa: la Resolución y las Sombras. En el teléfono, bajá primero la resolución.',
  'Después: el Resplandor, la Niebla de aire y el Detalle de criaturas.',
  'Lo que casi no se nota en los FPS: Color y contorno, Partículas y las nubes de las nieblas.',
  'Si el teléfono se calienta, probá 30 FPS: gasta la mitad.',
];

/* ───────── estado ───────── */
export const ESTADO_INICIAL = Object.freeze({ preset: 'auto', auto: true, medidor: false, ajustes: Object.freeze({}) });
const esNum = (x) => typeof x === 'number' && Number.isFinite(x);

/** Limpia un estado cualquiera (guardado viejo, a mano, roto): sólo deja claves y valores válidos. */
export function sanear(e) {
  const o = { preset: 'auto', auto: true, medidor: false, ajustes: {} };
  if (!e || typeof e !== 'object') return o;
  if (PRESETS[e.preset]) o.preset = e.preset;
  if (typeof e.auto === 'boolean') o.auto = e.auto;
  if (typeof e.medidor === 'boolean') o.medidor = e.medidor;
  const a = e.ajustes && typeof e.ajustes === 'object' ? e.ajustes : {};
  for (const id of OPCION_IDS) {
    if (!(id in a)) continue;
    const O = OPCIONES[id], v = a[id];
    if (O.tipo === 'switch' && typeof v === 'boolean') o.ajustes[id] = v;
    else if (O.tipo === 'pasos' && O.pasos.some((p) => p.v === v)) o.ajustes[id] = v;
  }
  if (esNum(a.escala)) o.ajustes.escala = Math.max(ESCALA.min, Math.min(ESCALA.max, Math.round(a.escala / ESCALA.paso) * ESCALA.paso));
  return o;
}
export function cargar(almacen = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { return sanear(JSON.parse(almacen.getItem(KEY) || 'null')); } catch { return sanear(null); }
}
export function guardar(e, almacen = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { almacen.setItem(KEY, JSON.stringify(sanear(e))); return true; } catch { return false; }
}

/** Nivel recomendado para este equipo (teléfono → Baja; PC → Alta con 6+ núcleos, si no Media). `equipo`: { tactil, nucleos }. */
export function recomendado(equipo = {}) {
  if (equipo.tactil) return 'low';
  return (equipo.nucleos || 4) >= 6 ? 'high' : 'medium';
}
/** Qué preset se marca como «Recomendado para tu equipo» en la pantalla. */
export const presetRecomendado = (equipo) => ({ low: 'baja', medium: 'media', high: 'alta' })[recomendado(equipo)];

/** Nivel base (low|medium|high) de un estado. */
export function nivelDe(e, equipo = {}) {
  const P = PRESETS[sanear(e).preset];
  return P.nivel || recomendado(equipo);
}
/** Valor efectivo de una opción (lo cambiado a mano, si no el del nivel base). La escala va en % (100 = la del nivel). */
export function valorDe(e, id, equipo = {}) {
  const s = sanear(e);
  if (id === 'escala') return s.ajustes.escala ?? ESCALA.base;
  if (id in s.ajustes) return s.ajustes[id];
  const L = LEVELS[nivelDe(s, equipo)], O = OPCIONES[id];
  if (O.id === 'particulas' || O.id === 'lod') return 1;   // relativas al nivel: 1 = «Normal»
  return L[O.cfg];
}
/** Resuelve un estado: { nivel, ov } donde `ov` son los cambios sobre LEVELS[nivel] que lee cfg() (vacío = nivel puro). */
export function resolver(e, equipo = {}) {
  const s = sanear(e), nivel = nivelDe(s, equipo), L = LEVELS[nivel], ov = {};
  for (const id of OPCION_IDS) {
    if (!(id in s.ajustes)) continue;
    const O = OPCIONES[id], v = s.ajustes[id];
    if (id === 'particulas') ov.particles = Math.round(L.particles * v);
    else if (id === 'lod') { ov.lod = Math.round(L.lod * v); ov.full = Math.max(4, Math.round(L.full * v)); }
    else if (id === 'sombras') ov.shadows = v;
    else ov[O.cfg] = v;
    if (id === 'bloom') ov.bloom = v ? (L.bloom || 0.4) : 0;
    if (ov[O.cfg] === L[O.cfg]) delete ov[O.cfg];   // igual que el nivel: no es un cambio
  }
  if (s.ajustes.escala != null && s.ajustes.escala !== ESCALA.base) ov.scale = s.ajustes.escala / 100;
  if (ov.post && !L.post && ov.bloom == null) ov.bloom = 0.4;
  if (ov.post === false) delete ov.bloom;
  return { nivel, ov };
}
/** Pone un ajuste suelto (devuelve un estado nuevo). Si queda igual al preset, se borra (así «Restablecer» y los presets se entienden). */
export function ajustar(e, id, valor, equipo = {}) {
  const s = sanear(e), a = { ...s.ajustes };
  if (id === 'escala') { const v = Math.max(ESCALA.min, Math.min(ESCALA.max, Math.round(valor / ESCALA.paso) * ESCALA.paso)); if (v === ESCALA.base) delete a.escala; else a.escala = v; }
  else if (OPCIONES[id]) {
    a[id] = valor; const base = resolver({ ...s, ajustes: { ...a, [id]: undefined } }, equipo);   // ¿coincide con el nivel base?
    const L = LEVELS[base.nivel], O = OPCIONES[id];
    if (id !== 'particulas' && id !== 'lod' && L[O.cfg] === valor) delete a[id];
    if ((id === 'particulas' || id === 'lod') && valor === 1) delete a[id];
  }
  return sanear({ ...s, ajustes: a });
}
/** Cambia de preset: borra los ajustes sueltos (empezar limpio) y vuelve a prender el Automático si se elige «auto». */
export function elegirPreset(e, id) {
  const s = sanear(e); if (!PRESETS[id]) return s;
  return sanear({ ...s, preset: id, auto: id === 'auto' ? true : s.auto, ajustes: {} });
}
export const restablecer = (e) => sanear({ ...sanear(e), preset: 'auto', auto: true, ajustes: {} });
export const conMedidor = (e, on) => sanear({ ...sanear(e), medidor: !!on });
export const conAuto = (e, on) => sanear({ ...sanear(e), auto: !!on });
/** Cantidad de ajustes cambiados a mano (para mostrar «Personalizado»). */
export const personalizados = (e) => Object.keys(sanear(e).ajustes).length;

/** Resumen corto para el encabezado: «Baja · 85 % · 30 FPS · personalizado». `px`: { ancho, alto, pr }. */
export function resumen(e, equipo = {}) {
  const s = sanear(e), nivel = nivelDe(s, equipo), L = LEVELS[nivel], { ov } = resolver(s, equipo), c = { ...L, ...ov };
  const nombre = s.preset === 'auto' ? `Automático (${PRESETS[{ low: 'baja', medium: 'media', high: 'alta' }[nivel]].nombre})` : PRESETS[s.preset].nombre;
  const n = personalizados(s);
  return `${nombre} · ${Math.round((c.scale || 1) * 100)} % · ${c.fps} FPS${n ? ` · ${n} ajuste${n > 1 ? 's' : ''} propio${n > 1 ? 's' : ''}` : ''}`;
}
/** Resolución interna aproximada (px) con el pixelRatio que usaría el renderizador: mismo cálculo que Renderer.pixelRatioFor. */
export function pixelRatioDe(cfgFinal, dpr = 1) {
  const k = cfgFinal.scale || 1;
  return Math.max(0.4, Math.min(cfgFinal.maxPR * Math.max(1, k), dpr * cfgFinal.pixelRatio * k));
}
/** Color del medidor de FPS: verde ≥ 50 (o ≥ 0,9 del tope), ámbar ≥ 30, rojo menos. */
export function colorFps(fps, tope = 60) {
  if (fps >= Math.min(50, tope * 0.9)) return 'ok';
  return fps >= 28 ? 'medio' : 'mal';
}
/** Siguiente escala al bajar la resolución sola (Automático en Baja): -15 puntos hasta 60 %. Devuelve null si ya no hay más. */
export function escalaMasBaja(actual) { const n = Math.max(60, Math.round((actual - 15) / ESCALA.paso) * ESCALA.paso); return n < actual ? n : null; }
