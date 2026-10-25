// DESBLOQUEO DE HUÉSPEDES (Sprint 1 · docs/ONBOARDING.md). Lógica PURA (sin navegador): la usan perfil.js, la pantalla «Elegí tu primer Huésped»,
// la Tienda, la pantalla de Huéspedes y las pruebas.
//   · Se empieza con UN solo Huésped (el que elige el jugador entre los 3 iniciales). El resto está bloqueado.
//   · Tres vías para conseguir los demás (ninguna cuesta dinero real; la Tienda sólo acepta núcleos ganados jugando):
//       1) CAMPAÑA   – cada capítulo completado entrega un Huésped (tabla RECOMPENSAS_CAMPANA).
//       2) DESAFÍO   – un desafío concreto por Huésped (tabla DESAFIOS), jugable en las arenas.
//       3) TIENDA    – núcleos (sólo los 5 Huéspedes de tienda; precios en data.js › unlock.precio).
//   · Los perfiles viejos (antes del Sprint 1) NO pierden nada: migrarPerfil() les deja los 3 iniciales y lo que ya tenían.
import { CHARACTERS, HOST_IDS, HABILIDADES } from './data.js';
import { CAMPAIGN_ORDER } from './campaign.js';
import { BOSS_NAMES } from './campaign-names.js';

/** Los 3 Huéspedes que se pueden elegir como primero (los iniciales de siempre). */
export const INICIALES = Object.freeze(['axioma', 'vesper', 'micelio']);
export const esElegibleInicial = (id) => INICIALES.includes(id) && !!(CHARACTERS[id] && CHARACTERS[id].host);

/** Ficha de la pantalla «Elegí tu primer Huésped»: rol, estilo marcial/arma y lo que lo distingue. (La historia sale de CHARACTERS[id].story.) */
export const FICHAS_INICIALES = Object.freeze({
  axioma: { rol: 'Vanguardia · asalto equilibrado', estilo: 'Cuchillas en los antebrazos y fusil de proyectiles óseos. Entrás, cortás y disparás: el estilo más versátil.', dificultad: 'Fácil', recomendado: true },
  vesper: { rol: 'Cazadora · asesina de movilidad', estilo: 'Garras dobles y agujas neurotóxicas. Pegás rápido desde el flanco y te vas: mucho daño, poca resistencia.', dificultad: 'Alta' },
  micelio: { rol: 'Bastión · tanque de control', estilo: 'Puños sísmicos y cañón de esporas. Aguantás el castigo, frenás a las criaturas y dominás el espacio.', dificultad: 'Media' },
});
/** Datos listos para dibujar la ficha de un inicial. */
export function fichaInicial(id) {
  const C = CHARACTERS[id], F = FICHAS_INICIALES[id], H = HABILIDADES[id];
  if (!C || !F) return null;
  return { id, nombre: C.name, titulo: C.title, rol: F.rol, estilo: F.estilo, dificultad: F.dificultad, recomendado: !!F.recomendado, historia: C.story, principal: { nombre: (H && H.name) || C.mov.name, texto: (H && H.desc) || C.mov.desc }, definitiva: { nombre: C.ult.name, texto: C.ult.desc }, color: C.color, stats: C.stats };
}

/* ───────── CAMPAÑA ───────── */
/** Capítulo completado → Huésped que entrega. Si ya lo tenés, entrega el primer inicial que todavía no tengas (así los 3 iniciales llegan en los 2 primeros capítulos).
 *  Cap. 1 Islas → Axioma · cap. 2 Laberinto → Vesper · cap. 3 Jardín → Colmena · cap. 4 Plaza → Danzante · cap. 5 Osario → Seraf · cap. 6 Cámara Fractal → Singular + Umbra (final). */
export const RECOMPENSAS_CAMPANA = Object.freeze({
  m1: ['axioma'], m3: ['vesper'], m4: ['colmena'], m5: ['danzante'], m6: ['seraf'], m2: ['singular', 'umbra'],
});
export const nombreHuesped = (id) => (CHARACTERS[id] && CHARACTERS[id].name) || id;

/* ───────── DESAFÍOS ───────── */
// `info` = lo que sabe el cliente al terminar la partida: { won, map, boss (id de mapa del jefe derrotado o ''), kills, mode ('combo' | 'shooter'), time (s), wave, campaign }
const gana = (map) => (i) => !!i.won && i.map === map;
export const DESAFIOS = Object.freeze({
  axioma: { id: 'voluntad', titulo: 'Voluntad de hierro', texto: 'Ganá cualquier misión con 40 bajas o más.', prueba: (i) => !!i.won && (i.kills | 0) >= 40 },
  vesper: { id: 'caza-coloso', titulo: 'Cazadora del Coloso', texto: `Derrotá a ${BOSS_NAMES.m1} usando el modo Disparo.`, prueba: (i) => i.boss === 'm1' && i.mode !== 'combo' },
  micelio: { id: 'raiz-coloso', titulo: 'Raíz del Coloso', texto: `Derrotá a ${BOSS_NAMES.m1} usando el modo Melé.`, prueba: (i) => i.boss === 'm1' && i.mode === 'combo' },
  umbra: { id: 'sin-ojos', titulo: 'Sin ojos que te vean', texto: 'Ganá una misión en el Laberinto Celestial.', prueba: gana('m3') },
  seraf: { id: 'osario', titulo: 'Lo que el Osario guarda', texto: 'Ganá una misión en el Osario sin Techo.', prueba: gana('m6') },
  danzante: { id: 'compas', titulo: 'Compás de la Plaza', texto: 'Ganá una misión en la Plaza de los Ecos usando el modo Melé.', prueba: (i) => !!i.won && i.map === 'm5' && i.mode === 'combo' },
  colmena: { id: 'savia', titulo: 'Savia del Jardín', texto: 'Ganá una misión en el Jardín de Carne.', prueba: gana('m4') },
  singular: { id: 'orbita', titulo: 'Órbita completa', texto: `Derrotá a ${BOSS_NAMES.m2}.`, prueba: (i) => i.boss === 'm2' },
});
export const HUESPEDES_CON_DESAFIO = Object.freeze(Object.keys(DESAFIOS));

/** Todas las vías de un Huésped, para mostrarlas: [{ via: 'campana'|'desafio'|'tienda', texto }]. */
export function rutasDeHuesped(id) {
  const out = [];
  for (const cap of CAMPAIGN_ORDER) if ((RECOMPENSAS_CAMPANA[cap] || []).includes(id)) out.push({ via: 'campana', cap, texto: `Campaña: completá el capítulo ${CAMPAIGN_ORDER.indexOf(cap) + 1}${cap === 'm2' ? ' (final)' : ''}.` });
  if (id === 'axioma' || id === 'vesper') out.push({ via: 'campana', cap: null, texto: 'Si ya lo tenés, el capítulo te da el siguiente inicial que te falte.' });
  if (DESAFIOS[id]) out.push({ via: 'desafio', texto: `Desafío «${DESAFIOS[id].titulo}»: ${DESAFIOS[id].texto}` });
  const C = CHARACTERS[id];
  if (C && C.starter === false && C.unlock && C.unlock.precio) out.push({ via: 'tienda', texto: `Tienda: ${C.unlock.precio} núcleos ganados jugando${C.unlock.req && C.unlock.req.texto ? ' · ' + C.unlock.req.texto : ''}` });
  return out;
}

/* ───────── operaciones sobre un perfil (objeto plano con `inicial`, `huespedes`, `desafios`) ───────── */
const hostIds = () => HOST_IDS.filter((id) => CHARACTERS[id]);
/** Lista de Huéspedes que posee el perfil. `inicial === undefined` = objeto legado (sin Sprint 1): los 3 iniciales eran de todos. */
export function poseidos(p) {
  if (!p) return [];
  const lista = Array.isArray(p.huespedes) ? p.huespedes : [];
  if (p.inicial === undefined) return hostIds().filter((id) => INICIALES.includes(id) || lista.includes(id));
  return hostIds().filter((id) => id === p.inicial || lista.includes(id));
}
export const tiene = (p, id) => poseidos(p).includes(id);
/** Agrega Huéspedes al perfil (sin duplicar). Devuelve los que de verdad eran nuevos. */
export function darHuespedes(p, ids) {
  const nuevos = []; p.huespedes = Array.isArray(p.huespedes) ? p.huespedes : [];
  for (const id of ids) if (CHARACTERS[id] && CHARACTERS[id].host && !tiene(p, id) && !nuevos.includes(id)) { p.huespedes.push(id); nuevos.push(id); }
  return nuevos;
}
/** Capítulo completado → desbloqueos reales (con el reemplazo por «el primer inicial que falta» si ya tenías el del capítulo). */
export function desbloquearPorCapitulo(p, cap) {
  const out = [];
  for (const id of RECOMPENSAS_CAMPANA[cap] || []) {
    if (!tiene(p, id)) { out.push(...darHuespedes(p, [id])); continue; }
    const falta = INICIALES.find((x) => !tiene(p, x)); if (falta) out.push(...darHuespedes(p, [falta]));
  }
  return out;
}
/** Evalúa los desafíos con el resultado de una partida. Entrega los Huéspedes de los desafíos cumplidos. */
export function evaluarDesafios(p, info) {
  const cumplidos = [];
  if (!info || typeof info !== 'object') return cumplidos;
  p.desafios = p.desafios && typeof p.desafios === 'object' ? p.desafios : {};
  for (const [id, D] of Object.entries(DESAFIOS)) {
    if (p.desafios[id]) continue;
    let ok = false; try { ok = !!D.prueba(info); } catch { ok = false; }
    if (!ok) continue;
    p.desafios[id] = 1; cumplidos.push(id);
    darHuespedes(p, [id]);
  }
  return cumplidos;
}
export const desafioCumplido = (p, id) => !!(p && p.desafios && p.desafios[id]);

/* ───────── migración de perfiles ───────── */
/** ¿El guardado crudo trae señales de que alguien ya jugó? (núcleos, maestría, campaña, evolución, inventario, partidas, Huésped elegido…) */
export function tieneHistorial(o, elegido = null) {
  const s = o && typeof o === 'object' ? o : {};
  const lleno = (x) => x && typeof x === 'object' && Object.keys(x).length > 0;
  return !!(elegido || Number(s.cores) > 0 || lleno(s.mae) || lleno(s.evo) || lleno(s.path) || lleno(s.arb) || lleno(s.terr) || (s.campaign && Array.isArray(s.campaign.completed) && s.campaign.completed.length)
    || (Array.isArray(s.huespedes) && s.huespedes.length) || (Array.isArray(s.inventario) && s.inventario.length) || (Array.isArray(s.inv) && s.inv.length) || (s.tienda && Number(s.tienda.rot) > 0)
    || Number(s.skillLevel) > 0 || (Array.isArray(s.owned) && s.owned.length) || (s.base && s.base.tut === true));
}
/** Perfil crudo (guardado en el navegador) → { inicial, huespedes, desafios, veterano }.
 *  · Perfil sin historial y sin `inicial`: JUGADOR NUEVO → inicial null (la pantalla «Elegí tu primer Huésped» lo decide).
 *  · Perfil con historial y sin `inicial` (guardado de antes del Sprint 1): VETERANO → conserva los 3 iniciales y todo lo que usaba. Su inicial es el Huésped que tenía elegido (si era inicial) o Axioma.
 *  `legado(o, elegido)` es la función de tienda.js que reconstruye los Huéspedes comprados (migrarHuespedes). */
export function migrarPerfil(o, elegido, legado) {
  const s = o && typeof o === 'object' ? o : {};
  const valido = (id) => typeof id === 'string' && !!(CHARACTERS[id] && CHARACTERS[id].host);
  const lista = (Array.isArray(s.huespedes) ? s.huespedes : []).filter(valido);
  const desafios = {}; if (s.desafios && typeof s.desafios === 'object') for (const id of HUESPEDES_CON_DESAFIO) if (s.desafios[id]) desafios[id] = 1;
  if (s.ver >= 3 && (s.inicial === null || valido(s.inicial))) {
    return { inicial: s.inicial, huespedes: [...new Set(lista)].filter((id) => id !== s.inicial), desafios, veterano: false };
  }
  if (!tieneHistorial(s, elegido)) return { inicial: null, huespedes: [], desafios, veterano: false };
  const comprados = typeof legado === 'function' ? legado(s, elegido) : [];
  const inicial = esElegibleInicial(elegido) ? elegido : INICIALES[0];
  return { inicial, huespedes: [...new Set([...INICIALES, ...comprados, ...lista])].filter((id) => valido(id) && id !== inicial), desafios, veterano: true };
}
