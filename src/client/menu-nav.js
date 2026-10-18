// Mapa del menú principal (datos PUROS: sin DOM). Cuatro puertas → cuatro «hubs» → las pantallas de siempre.
//   Inicio ─ JUGAR (Historia · Arenas · Cooperativo) · MI HUÉSPED (Huésped · Evolución · Inventario y Forja · Equipo) · MUNDO (Territorios · Bestiario · Tienda) · AJUSTES (Gráficos · Controles y sonido)
// Las pantallas existentes NO cambian de id: sólo se reubican. Acá también viven las migas de pan, los puntitos de aviso y la ruta de objetivos.
import { TERRITORIOS, TERRITORIO_IDS } from '../sim/bendiciones.js';
import { gastado } from '../sim/progresion.js';
import { HOST_IDS } from '../sim/data.js';
import { HUESPEDES_TIENDA, estadoHuesped, poseeHuesped, claveOferta, diaDe } from '../sim/tienda.js';

/** Las 4 puertas de la pantalla de inicio. `art` = imagen de fondo; `desc` = una línea que se ve siempre (y como ayuda al pasar el mouse o tocar). */
export const PUERTAS = [
  { id: 'jugar', hub: 'hub-jugar', titulo: 'Jugar', desc: 'Historia, Arenas y Cooperativo', art: './public/art/arena-m1.jpg' },
  { id: 'huesped', hub: 'hub-huesped', titulo: 'Mi Huésped', desc: 'Elegirlo, evolucionarlo, equiparlo y forjar', art: './public/art/historia.jpg' },
  { id: 'mundo', hub: 'hub-mundo', titulo: 'Mundo', desc: 'Territorios, Bestiario y la Tienda del Cambista', art: './public/art/arena-m4.jpg' },
  { id: 'ajustes', hub: 'hub-ajustes', titulo: 'Ajustes', desc: 'Gráficos, controles, sonido y subtítulos', art: './public/art/opciones.jpg' },
];

/** Cada hub: título, frase corta y sus tarjetas. `go` = pantalla que abre; `aviso` = clave del puntito (ver avisos()). */
export const HUBS = {
  'hub-jugar': { puerta: 'jugar', titulo: 'Jugar', sub: 'Elegí cómo querés jugar hoy.', items: [
    { go: 'story', titulo: 'Historia', desc: 'La campaña: un tren, un andén, una luz. 2 capítulos y 2 jefes.', art: './public/art/historia.jpg' },
    { go: 'arenas', titulo: 'Arenas', desc: 'Directo a la acción en cualquiera de los 6 mapas, o probá armas en el Campo de pruebas.', art: './public/art/arena-m1.jpg', aviso: 'mision' },
    { go: 'coop', titulo: 'Cooperativo', desc: 'Hasta 4 Pasajeros con un código de sala (necesita el servidor).', art: './public/art/coop.jpg' },
  ] },
  'hub-huesped': { puerta: 'huesped', titulo: 'Mi Huésped', sub: 'Todo lo de tu organismo en un solo lugar.', items: [
    { go: 'huesped', titulo: 'Huésped', desc: 'Elegí a tu Huésped; mirá su maestría y su progresión Shooter / Combo.', art: './public/art/historia.jpg', aviso: 'puntos' },
    { go: 'evolucion', titulo: 'Evolución', desc: 'Gastá núcleos: 4 niveles, mutaciones, órganos y armas fusionadas.', art: './public/art/arena-m3.jpg' },
    { go: 'inventario', titulo: 'Inventario y Forja', desc: 'Objetos, materiales, planos, sets y la Forja biológica.', art: './public/art/arena-m2.jpg', aviso: 'botin' },
    { go: 'loadout', titulo: 'Equipo', desc: 'Veteranos y tus armas de disparo (4 ranuras, el Haz es fijo).', art: './public/art/coop.jpg' },
  ] },
  'hub-mundo': { puerta: 'mundo', titulo: 'Mundo', sub: 'El Vórtice, sus lugares, sus bestias y su mercader.', items: [
    { go: 'territorios', titulo: 'Territorios', desc: 'Los 6 lugares robados del mundo y una bendición por cada uno.', art: './public/art/arena-m5.jpg', aviso: 'bendicion' },
    { go: 'bestiary', titulo: 'Bestiario', desc: 'Girá cada criatura en 3D y leé sus avisos y debilidades.', art: './public/art/bestiario.jpg' },
    { go: 'tienda', titulo: 'Tienda', desc: 'El Cambista vende Huéspedes, planos, materiales y servicios.', art: './public/art/arena-m6.jpg', aviso: 'tienda', saldo: true },
  ] },
  'hub-ajustes': { puerta: 'ajustes', titulo: 'Ajustes', sub: 'Que se vea bien y se sienta cómodo.', items: [
    { go: 'graficos', titulo: 'Gráficos', desc: 'Baja, Media o Alta, resolución, sombras y límite de FPS.', art: './public/art/opciones.jpg' },
    { go: 'options', titulo: 'Controles y sonido', desc: 'Sensibilidad, ayuda de puntería, volumen, subtítulos y botones táctiles.', art: './public/art/opciones.jpg' },
  ] },
};

/** Nombre de cada pantalla en las migas de pan y de quién cuelga. */
export const PANTALLAS = {
  main: { nombre: 'Inicio', padre: null },
  'hub-jugar': { nombre: 'Jugar', padre: 'main' }, 'hub-huesped': { nombre: 'Mi Huésped', padre: 'main' }, 'hub-mundo': { nombre: 'Mundo', padre: 'main' }, 'hub-ajustes': { nombre: 'Ajustes', padre: 'main' },
  story: { nombre: 'Historia', padre: 'hub-jugar' }, arenas: { nombre: 'Arenas', padre: 'hub-jugar' }, coop: { nombre: 'Cooperativo', padre: 'hub-jugar' },
  huesped: { nombre: 'Huésped', padre: 'hub-huesped' }, evolucion: { nombre: 'Evolución', padre: 'hub-huesped' }, inventario: { nombre: 'Inventario', padre: 'hub-huesped' }, loadout: { nombre: 'Equipo', padre: 'hub-huesped' },
  territorios: { nombre: 'Territorios', padre: 'hub-mundo' }, bestiary: { nombre: 'Bestiario', padre: 'hub-mundo' }, tienda: { nombre: 'Tienda', padre: 'hub-mundo' },
  graficos: { nombre: 'Gráficos', padre: 'hub-ajustes' }, options: { nombre: 'Controles y sonido', padre: 'hub-ajustes' },
};
/** Camino desde Inicio hasta la pantalla: [{ id, nombre }] (para las migas «Inicio › Mi Huésped › Inventario»). El título no tiene migas. */
export function migas(pantalla) {
  const out = []; let id = pantalla, guard = 0;
  while (id && PANTALLAS[id] && guard++ < 6) { out.unshift({ id, nombre: PANTALLAS[id].nombre }); id = PANTALLAS[id].padre; }
  return pantalla === 'title' || !PANTALLAS[pantalla] ? [] : out;
}
/** Texto plano de las migas: «Inicio › Mi Huésped › Inventario». */
export const migasTexto = (pantalla) => migas(pantalla).map((m) => m.nombre).join(' › ');

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
  const out = { botin: 0, puntos: 0, huesped: 0, tienda: 0, bendicion: 0, mision: 0 };
  if (!p) return out;
  const visto = (p.menu && p.menu.iv) || 0;
  out.botin = (p.inventario || []).filter((it) => numUid(it.u) >= visto).length;
  for (const id of HOST_IDS) {
    if (!poseeHuesped(p, id)) continue;
    for (const modo of ['combo', 'disparo']) { const e = p.arb && p.arb[id] && p.arb[id][modo]; if (e && (e.pc | 0) - gastado(modo, id, e.nodos || []) > 0) out.puntos++; }
  }
  out.huesped = HUESPEDES_TIENDA.filter((id) => estadoHuesped(p, id) === 'comprable').length;
  out.tienda = !p.menu || p.menu.tv !== claveOferta(diaDe(ahora), (p.tienda && p.tienda.rot) | 0) ? 1 : 0;
  for (const t of TERRITORIO_IDS) {
    const lib = !!(p.terr && p.terr[t]), T = TERRITORIOS[t];
    if (lib && !(p.terr[t] && p.terr[t].bend)) out.bendicion++;
    else if (!lib && T.requiere.length && T.requiere.every((r) => p.terr && p.terr[r])) out.mision++;
  }
  return out;
}
/** Avisos de cada puerta (suma de lo que cuelga de ella). */
export function avisosPuertas(a) {
  return { jugar: a.mision, huesped: a.botin + a.puntos, mundo: a.huesped + a.tienda + a.bendicion, ajustes: 0 };
}

/* ───────── ruta de objetivos (Jugar) ───────── */
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
