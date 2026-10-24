// Mapa del menú (datos PUROS: sin DOM). Docs: docs/MENU.md.
//   INICIO = un botón enorme (CONTINUAR / JUGAR) + «Elegir partida» + 5 puertas: BASE · HUÉSPEDES · COLECCIÓN · COOPERATIVO · AJUSTES.
//   Cada puerta abre SU primera pantalla directamente (sin pasillos intermedios) y arriba queda siempre la misma barra con las pestañas de esa sección:
//     PARTIDAS   Historia · Arenas · Cooperativo
//     HUÉSPEDES  Huésped · Evolución · Inventario · Forja · Tienda · Equipo
//     COLECCIÓN  Criaturas · Fauna · Herbario · Territorios
//     AJUSTES    Controles y sonido · Gráficos
//   «La Base» no es una pantalla: es el mapa jugable (main.js › startBase). Las pantallas NO cambian de id; sólo se reubican.
import { TERRITORIOS, TERRITORIO_IDS } from '../sim/bendiciones.js';
import { gastado } from '../sim/progresion.js';
import { HOST_IDS } from '../sim/data.js';
import { macetaEstado } from '../sim/base.js';   // La Base: cosecha del jardín lista
import { HUESPEDES_TIENDA, estadoHuesped, poseeHuesped, claveOferta, diaDe } from '../sim/tienda.js';

/** Las 5 puertas de la pantalla de inicio. `go` = pantalla que abre; `icono` = clave de menu-hubs.js › ICONOS; `desc` = UNA línea de ayuda; `color` = tinte de la tarjeta. */
export const PUERTAS = [
  { id: 'base', go: 'base', titulo: 'La Base', icono: 'base', desc: 'Caminá, forjá, cultivá y elegí partida', color: '#ffb35a' },
  { id: 'huespedes', go: 'huesped', titulo: 'Huéspedes', icono: 'huesped', desc: 'Elegir, evolucionar, equipar y comprar', color: '#66ffee' },
  { id: 'coleccion', go: 'bestiary', titulo: 'Códice', icono: 'coleccion', desc: 'Arenas, criaturas, fauna y territorios', color: '#b98cff' },
  { id: 'coop', go: 'coop', titulo: 'Cooperativo', icono: 'coop', desc: 'Hasta 4 jugadores con un código', color: '#7fb2ff' },
  { id: 'ajustes', go: 'options', titulo: 'Ajustes', icono: 'ajustes', desc: 'Controles, sonido y gráficos', color: '#9fb0d8' },
];

/** Secciones con pestañas. Cada pestaña: { go: pantalla, t: rótulo, aviso?: clave del puntito, btab?: pestaña interna del Bestiario, ivtab?: pestaña interna del Inventario }. */
export const SECCIONES = {
  partidas: { titulo: 'Partidas', tabs: [
    { go: 'story', t: 'Historia' }, { go: 'arenas', t: 'Misiones', aviso: 'mision' }, { go: 'coop', t: 'Cooperativo' },
  ] },
  huespedes: { titulo: 'Huéspedes', tabs: [
    { go: 'huesped', t: 'Huésped', aviso: 'puntos' }, { go: 'evolucion', t: 'Evolución' }, { go: 'inventario', t: 'Inventario', ivtab: 'obj', aviso: 'botin' },
    { go: 'inventario', t: 'Forja', ivtab: 'for' }, { go: 'tienda', t: 'Tienda', aviso: 'huesped' }, { go: 'loadout', t: 'Equipo' },
  ] },
  coleccion: { titulo: 'Códice', tabs: [
    { go: 'bestiary', t: 'Criaturas', btab: 'c' }, { go: 'bestiary', t: 'Fauna', btab: 'f' }, { go: 'bestiary', t: 'Herbario', btab: 'h' }, { go: 'arena-codex', t: 'Arenas' }, { go: 'territorios', t: 'Territorios', aviso: 'bendicion' },
  ] },
  ajustes: { titulo: 'Ajustes', tabs: [
    { go: 'options', t: 'Controles y sonido' }, { go: 'graficos', t: 'Gráficos' },
  ] },
};
/** Atajos: a qué sección pertenece cada pantalla (la primera pestaña que la nombra). */
export const SECCION_DE = {};
for (const [sid, S] of Object.entries(SECCIONES)) for (const tb of S.tabs) if (!SECCION_DE[tb.go]) SECCION_DE[tb.go] = sid;
SECCION_DE.coop = 'partidas';   // Cooperativo: puerta del inicio, pero vive junto a Historia y Arenas

/** Nombre de cada pantalla (título de la barra) y de quién cuelga: todo cuelga del Inicio (un solo nivel; las pestañas no apilan). */
export const PANTALLAS = {
  main: { nombre: 'Inicio', padre: null },
  story: { nombre: 'Historia', padre: 'main' }, arenas: { nombre: 'Misiones', padre: 'main' }, 'arena-codex': { nombre: 'Arenas', padre: 'main' }, coop: { nombre: 'Cooperativo', padre: 'main' },
  huesped: { nombre: 'Huésped', padre: 'main' }, evolucion: { nombre: 'Evolución', padre: 'main' }, inventario: { nombre: 'Inventario', padre: 'main' }, tienda: { nombre: 'Tienda', padre: 'main' }, loadout: { nombre: 'Equipo', padre: 'main' },
  bestiary: { nombre: 'Colección', padre: 'main' }, territorios: { nombre: 'Territorios', padre: 'main' },
  options: { nombre: 'Controles y sonido', padre: 'main' }, graficos: { nombre: 'Gráficos', padre: 'main' },
};
/** Camino desde Inicio hasta la pantalla: [{ id, nombre }]. Ahora son como mucho dos pasos: «Inicio › Huéspedes». El título no tiene camino. */
export function migas(pantalla) {
  if (pantalla === 'title' || !PANTALLAS[pantalla]) return [];
  if (pantalla === 'main') return [{ id: 'main', nombre: 'Inicio' }];
  const sec = SECCIONES[SECCION_DE[pantalla]];
  return [{ id: 'main', nombre: 'Inicio' }, { id: pantalla, nombre: sec ? sec.titulo : PANTALLAS[pantalla].nombre }];
}
/** Texto plano del camino: «Inicio › Huéspedes». */
export const migasTexto = (pantalla) => migas(pantalla).map((m) => m.nombre).join(' › ');
/** La pestaña activa de una pantalla dentro de su sección: `ctx` = { btab, ivtab } (pestañas internas del Bestiario y del Inventario). -1 si no hay sección. */
export function tabActiva(pantalla, ctx = {}) {
  const S = SECCIONES[SECCION_DE[pantalla]]; if (!S) return -1;
  let i = S.tabs.findIndex((t) => t.go === pantalla && (t.btab ? t.btab === (ctx.btab || 'c') : t.ivtab ? (t.ivtab === 'for') === (ctx.ivtab === 'for') : true));
  if (i < 0) i = S.tabs.findIndex((t) => t.go === pantalla);
  return i;
}

/* ───────── «Continuar» ───────── */
export const MAPAS_NOMBRE = { m1: 'Vacío de Islas', m2: 'Cámara Fractal', m3: 'Laberinto Celestial', m4: 'Jardín de Carne', m5: 'Plaza de los Ecos', m6: 'Osario sin Techo', practica: 'Campo de pruebas' };
/** Qué hace el botón grande de Continuar según lo último que jugaste: { tipo: 'story'|'arena', id?, titulo, sub }. */
export function continuarDe(ultimo, huesped = '') {
  const con = huesped ? ` · con ${huesped}` : '';
  if (ultimo && ultimo.k === 'arena' && MAPAS_NOMBRE[ultimo.id]) return { tipo: 'arena', id: ultimo.id, titulo: 'Seguir jugando', sub: MAPAS_NOMBRE[ultimo.id] + con };
  if (ultimo && ultimo.k === 'story') return { tipo: 'story', titulo: 'Continuar', sub: 'Historia' + con };
  return { tipo: 'story', titulo: 'Jugar', sub: 'Empezar la Historia' + con };
}

/* ───────── puntitos de aviso ───────── */
const numUid = (u) => parseInt(String(u).slice(1), 36) || 0;
/** Cuántos avisos hay de cada clase para un perfil. Todo se calcula del perfil: no se guarda nada acá.
 *  botin: objetos que llegaron desde la última vez que abriste el Inventario · puntos: puntos de progresión sin gastar
 *  huesped: Huéspedes de la Tienda que ya podés comprar · tienda: stock nuevo que no viste · bendicion: territorio liberado sin bendición
 *  mision: territorio nuevo que se acaba de abrir (hay una arena nueva por ganar). */
export function avisos(p, ahora = Date.now()) {
  const out = { botin: 0, puntos: 0, huesped: 0, tienda: 0, bendicion: 0, mision: 0, base: 0 };
  if (!p) return out;
  const visto = (p.menu && p.menu.iv) || 0;
  out.botin = (p.inventario || []).filter((it) => numUid(it.u) >= visto).length;
  for (const id of HOST_IDS) {
    if (!poseeHuesped(p, id)) continue;
    for (const modo of ['combo', 'disparo']) { const e = p.arb && p.arb[id] && p.arb[id][modo]; if (e && (e.pc | 0) - gastado(modo, id, e.nodos || []) > 0) out.puntos++; }
  }
  out.base = (p.cultivo && p.cultivo.listo <= ahora ? 1 : 0) + ((p.base && p.base.jardin) || []).filter((m) => m && macetaEstado(m, ahora).estado === 'lista').length;   // La Base: cultivo de la Forja o cosecha del jardín listos
  out.huesped = HUESPEDES_TIENDA.filter((id) => estadoHuesped(p, id) === 'comprable').length;
  out.tienda = !p.menu || p.menu.tv !== claveOferta(diaDe(ahora), (p.tienda && p.tienda.rot) | 0) ? 1 : 0;
  for (const t of TERRITORIO_IDS) {
    const lib = !!(p.terr && p.terr[t]), T = TERRITORIOS[t];
    if (lib && !(p.terr[t] && p.terr[t].bend)) out.bendicion++;
    else if (!lib && T.requiere.length && T.requiere.every((r) => p.terr && p.terr[r])) out.mision++;
  }
  return out;
}
/** Avisos de cada puerta del inicio (sólo lo que pide una acción útil: cosecha lista, botín nuevo, puntos sin gastar, un Huésped que ya podés comprar, bendición por elegir, territorio nuevo). */
export function avisosPuertas(a) {
  return { base: a.base, huespedes: a.botin + a.puntos + a.huesped, coleccion: a.bendicion, coop: 0, ajustes: 0, partidas: a.mision };
}

/* ───────── ruta de objetivos (el «Próximo paso» del inicio y el objetivo de la Base) ───────── */
/** Los próximos pasos sugeridos, cada uno con su estado: [{ texto, hecho, go }]. Muestra hasta `max` (los hechos más recientes cuentan como contexto). */
export function rutaObjetivos(p, max = 4) {
  const owned = HOST_IDS.filter((id) => poseeHuesped(p, id));
  const jugo = Object.values(p.mae || {}).some((m) => m && m.partidas > 0);
  const evo = Math.max(0, ...Object.values(p.evo || {}).map((n) => n | 0));
  const libres = Object.keys(p.terr || {}).length, pend = Object.keys(p.terr || {}).filter((t) => !(p.terr[t] && p.terr[t].bend));
  const pasos = [
    { texto: 'Jugá tu primera partida', hecho: jugo, go: 'arenas' },
    { texto: 'Evolucioná a tu Huésped', hecho: evo >= 1, go: 'evolucion' },
    { texto: 'Liberá el primer territorio', hecho: libres >= 1, go: 'arenas' },
    { texto: 'Elegí una bendición', hecho: libres >= 1 && pend.length === 0, go: 'territorios' },
    { texto: 'Sumá un Huésped en la Tienda', hecho: owned.length > 3, go: 'tienda' },
    { texto: 'Armá tu equipo en la Forja', hecho: (p.inventario || []).length > 0 && Object.keys(p.eq || {}).length > 0, go: 'inventario' },
    { texto: 'Liberá los 6 territorios', hecho: libres >= TERRITORIO_IDS.length, go: 'arenas' },
  ];
  const primero = pasos.findIndex((x) => !x.hecho);
  if (primero < 0) return pasos.slice(-max);
  return pasos.slice(Math.max(0, primero - 1), Math.max(0, primero - 1) + max);
}
