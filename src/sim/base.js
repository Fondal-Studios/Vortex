// LA BASE — «El Santuario» (docs/BASE.md): el mapa-hub caminable al que se vuelve entre partidas (como el Orbiter de Warframe).
// Sin oleadas, sin enemigos, sin armas: sólo ESTACIONES físicas con un rango de interacción (botón USAR / tecla E) que abren las
// pantallas que ya existían (Forja, Tienda, Huésped, Territorios, Bestiario…), y personajes ambientales con frases cortas.
//
// Esta parte es la SIMULACIÓN (sin DOM ni three.js): el plano, las colisiones, la navegación (reusa limbo.js), el catálogo de
// estaciones y personajes, y el jardín. Nada usa g.rng ni azar: todo es posición fija o reloj. El dibujo vive en
// src/client/env/base.js + base-fx.js; los datos guardados (cultivos, estación visitada, tutorial) en src/client/perfil.js.
//
// PLANO (x este, z sur; y = 0 es el piso; todo en múltiplos de 4 m). Un gran salón 80 × 84 m con tabiques bajos que lo parten en salas:
//
//            NO  Trofeos  │  Norte: LA FORJA  │  NE  Jardín y Faunario
//            ─────────────┼───────────────────┼──────────────────────
//            O   Mercado  │   HUB: Mesa de    │  E   Sala de los Capullos
//            (Cambista,   │   Territorios     │  (Armero y los Huéspedes)
//             Herrero)    │                   │
//            ─────────────┼───────────────────┼──────────────────────
//            SO  Puerta   │  Sur: aparición   │  SE  Polígono
//                de Coop. │  y el Guía        │  de práctica
import { v3 } from './math.js';
import { makeLimboArena } from './limbo.js';
import { HOST_IDS } from './data.js';
import { MATERIAL_IDS, MATERIALS } from './items.js';

/* ───────────────────────── plano ───────────────────────── */
export const BASE = {
  id: 'base', name: 'El Santuario',
  /** Salas (rectángulos que se pisan 4 m para que el paso no tenga costuras). */
  ROOMS: {
    hub: { x0: -16, x1: 16, z0: -16, z1: 16 }, sur: { x0: -12, x1: 12, z0: 12, z1: 40 }, norte: { x0: -12, x1: 16, z0: -44, z1: -12 },
    este: { x0: 12, x1: 40, z0: -12, z1: 12 }, oeste: { x0: -40, x1: -12, z0: -12, z1: 12 },
    ne: { x0: 12, x1: 40, z0: -44, z1: -8 }, no: { x0: -40, x1: -8, z0: -44, z1: -8 }, se: { x0: 8, x1: 40, z0: 8, z1: 40 }, so: { x0: -40, x1: -8, z0: 8, z1: 40 },
  },
  WALL_H: 14, CELL: 4,
  SPAWN: { x: 0, z: 32, dx: 0, dz: -1 },
};
const R = BASE.ROOMS;
const ROOMS = Object.values(R);

/** Muros del borde: una corona de celdas de 4 m alrededor de la unión de las salas, fusionadas por filas. */
function murosDe(rooms, H, C) {
  const dentro = (x, z) => rooms.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  const x0 = Math.min(...rooms.map((r) => r.x0)) - 2 * C, x1 = Math.max(...rooms.map((r) => r.x1)) + 2 * C;
  const z0 = Math.min(...rooms.map((r) => r.z0)) - 2 * C, z1 = Math.max(...rooms.map((r) => r.z1)) + 2 * C, out = [];
  for (let z = z0; z < z1; z += C) {
    let ini = null;
    for (let x = x0; x <= x1; x += C) {
      let pared = false;
      if (x < x1 && !dentro(x + C / 2, z + C / 2)) for (let dz = -1; dz <= 1 && !pared; dz++) for (let dx = -1; dx <= 1 && !pared; dx++) if (dentro(x + C / 2 + dx * C, z + C / 2 + dz * C)) pared = true;
      if (pared && ini == null) ini = x;
      if (!pared && ini != null) { out.push({ x0: ini, x1: x, z0: z, z1: z + C, h: H, kind: 'borde' }); ini = null; }
    }
  }
  return out;
}

/** Coberturas (sólidos que frenan el paso). `kind` le dice al cliente cómo dibujarlas. */
const tabique = (x, z, hx, hz) => ({ shape: 'box', x, z, hx, hz, h: 9, kind: 'tabique' });
const pilar = (x, z, r = 1.0, h = 12) => ({ shape: 'cyl', x, z, r, h, kind: 'pilar' });
export const CUBAS = [  // cámaras de cultivo de la Forja: la del centro es la grande (muestra la pieza que se está cultivando); las otras cuatro muestran el stock de un material
  { i: 0, x: -9, z: -38, r: 1.5, mat: 'hueso' }, { i: 1, x: -4.5, z: -39, r: 1.5, mat: 'quitina' }, { i: 2, x: 0, z: -39, r: 2.3, mat: null },
  { i: 3, x: 4.5, z: -39, r: 1.5, mat: 'carne' }, { i: 4, x: 9, z: -38, r: 1.5, mat: 'espora' },
];
export const MACETAS = Array.from({ length: 6 }, (_, i) => ({ i, x: 20 + (i % 3) * 6, z: i < 3 ? -20 : -27 }));   // jardín: 3 × 2 macetas
export const CAPULLOS = HOST_IDS.map((id, i) => ({ i, id, x: 38, z: -8.4 + i * 2.4 }));   // un capullo colgante por Huésped, en la pared este de la sala de los Capullos
export const VIVARIOS = [{ i: 0, x: 18, z: -42 }, { i: 1, x: 26, z: -42 }, { i: 2, x: 34, z: -42 }];
export const MANIQUIES = [16, 21, 26, 31, 36].map((x, i) => ({ i, x, z: 35 }));
export const VITRINAS = [-34, -28, -22, -16].map((x, i) => ({ i, x, z: -41.5 }));

const COVERS = [
  // sala central
  { shape: 'cyl', x: 0, z: 0, r: 2.6, h: 1.1, kind: 'mesa' },
  ...[[-11, -11], [11, -11], [-11, 11], [11, 11]].map(([x, z]) => pilar(x, z, 1.1)),
  // tabiques bajos entre salas (cada uno deja un hueco de 6 m, y hacia el centro queda abierto)
  tabique(20, -10, 2, 0.6), tabique(34, -10, 6, 0.6), tabique(20, 10, 2, 0.6), tabique(34, 10, 6, 0.6),
  tabique(-20, -10, 2, 0.6), tabique(-34, -10, 6, 0.6), tabique(-20, 10, 2, 0.6), tabique(-34, 10, 6, 0.6),
  // La Forja: consola de mando y las cubas
  { shape: 'box', x: 0, z: -31, hx: 3.2, hz: 1.0, h: 1.2, kind: 'consola' },
  ...CUBAS.map((c) => ({ shape: 'cyl', x: c.x, z: c.z, r: c.r, h: 6, kind: 'cuba' })),
  // Mercado: puesto del Cambista, yunque del Herrero y fuente de la Sanadora
  { shape: 'box', x: -28, z: -4, hx: 1.0, hz: 3.2, h: 1.3, kind: 'puesto' },
  { shape: 'cyl', x: -28, z: 5.5, r: 0.8, h: 1.0, kind: 'yunque' },
  { shape: 'cyl', x: -22, z: 1.5, r: 1.2, h: 0.8, kind: 'fuente' },
  // Sala de los Capullos: el espejo-capullo del Armero
  { shape: 'cyl', x: 31, z: 0, r: 1.4, h: 4.5, kind: 'espejo' },
  // Jardín y Faunario
  ...MACETAS.map((m) => ({ shape: 'cyl', x: m.x, z: m.z, r: 1.1, h: 0.9, kind: 'maceta' })),
  ...VIVARIOS.map((v) => ({ shape: 'box', x: v.x, z: v.z, hx: 2.4, hz: 1.0, h: 2.4, kind: 'vivario' })),
  // Polígono: los maniquíes de práctica
  ...MANIQUIES.map((m) => ({ shape: 'cyl', x: m.x, z: m.z, r: 0.55, h: 2.1, kind: 'maniqui' })),
  // Sala de Trofeos
  ...VITRINAS.map((v) => ({ shape: 'box', x: v.x, z: v.z, hx: 2.0, hz: 0.8, h: 2.6, kind: 'vitrina' })),
  { shape: 'cyl', x: -24, z: -26, r: 1.3, h: 1.0, kind: 'pedestal' },
  // Puerta de Cooperativo: bancos del vestíbulo
  { shape: 'box', x: -22, z: 24, hx: 0.5, hz: 1.8, h: 0.5, kind: 'banco' }, { shape: 'box', x: -22, z: 32, hx: 0.5, hz: 1.8, h: 0.5, kind: 'banco' },
  // Aparición: columnas del vestíbulo
  ...[22, 30, 38].flatMap((z) => [pilar(-11.5, z, 0.9), pilar(11.5, z, 0.9)]),
];

/* ───────────────────────── estaciones ───────────────────────── */
/** Cada estación: posición, rango de interacción (en metros, en planta) y qué abre. `pantalla` = id de pantalla del menú (ui.show); `acciones` = pequeño menú si abre más de una. */
export const ESTACIONES = {
  forja: { id: 'forja', nombre: 'La Forja Biológica', icono: '🧬', x: 0, z: -30, r: 6.5, color: 0xff7ad9, pantalla: 'inventario', tab: 'for', frase: 'Cultivá piezas vivas en las cubas. Cuando la cuba brilla, ya se puede recoger.' },
  cambista: { id: 'cambista', nombre: 'El Cambista de Almas', icono: '◆', x: -26, z: -4, r: 5.5, color: 0xffd45a, pantalla: 'tienda', frase: 'Todo se cambia. Hasta lo que ya no tenés.' },
  armero: { id: 'armero', nombre: 'Los Capullos (Huéspedes)', icono: '🪞', x: 27, z: 0, r: 6.5, color: 0x6fe9ff, pantalla: 'huesped',
    acciones: [{ id: 'huesped', texto: 'Elegir Huésped', pantalla: 'huesped' }, { id: 'evolucion', texto: 'Evolución', pantalla: 'evolucion' }, { id: 'loadout', texto: 'Equipo y armas', pantalla: 'loadout' }],
    frase: 'Cada Huésped que poseés duerme en un capullo. Mirá cuál querés ser hoy.' },
  territorios: { id: 'territorios', nombre: 'Mesa de Territorios', icono: '🗺', x: 0, z: 0, r: 5.5, color: 0xa0ff7a, pantalla: 'arenas',
    acciones: [{ id: 'arenas', texto: 'Elegir destino y jugar', pantalla: 'arenas' }, { id: 'territorios', texto: 'Territorios y bendiciones', pantalla: 'territorios' }, { id: 'story', texto: 'La Historia', pantalla: 'story' }],
    frase: 'Seis lugares robados del mundo. Elegí uno y empezá la partida.' },
  jardin: { id: 'jardin', nombre: 'Jardín y Herbario', icono: '🌱', x: 26, z: -23.5, r: 8, color: 0x9bff4a, panel: 'jardin', frase: 'Sembrá una semilla, esperá y cosechá materiales para la Forja.' },
  faunario: { id: 'faunario', nombre: 'Faunario', icono: '🦎', x: 26, z: -38.5, r: 6.5, color: 0x56f0b0, pantalla: 'bestiary', frase: 'Las criaturas que ya conociste, vivas en sus vivarios.' },
  poligono: { id: 'poligono', nombre: 'Polígono de Práctica', icono: '🎯', x: 26, z: 26, r: 7.5, color: 0xff9a5a, accion: 'practica', frase: 'Maniquíes que no devuelven los golpes: probá armas, combos y habilidades.' },
  trofeos: { id: 'trofeos', nombre: 'Sala de Trofeos', icono: '🏆', x: -24, z: -30, r: 8, color: 0xffe27a, pantalla: 'inventario', tab: 'obj',
    acciones: [{ id: 'objetos', texto: 'Objetos y armas', pantalla: 'inventario', tab: 'obj' }, { id: 'sets', texto: 'Sets equipados', pantalla: 'inventario', tab: 'set' }, { id: 'bestiario', texto: 'Bestiario', pantalla: 'bestiary' }],
    frase: 'Tus armas legendarias y tus sets, en vitrinas.' },
  coop: { id: 'coop', nombre: 'Puerta de Cooperativo', icono: '🚪', x: -32, z: 28, r: 6.5, color: 0xb98cff, pantalla: 'coop', frase: 'Hasta 4 Pasajeros con un código de sala. (Acá todavía no se ve a los demás.)' },
};
export const ESTACION_IDS = Object.keys(ESTACIONES);

/** Personajes ambientales: se les habla con USAR y dicen una frase corta (rotan en orden, sin azar). `kind` = el tipo de NPC que dibuja objects.js. */
export const PERSONAJES = {
  cambista: { id: 'cambista', kind: 'cambista', nombre: 'El Cambista de Almas', x: -30.6, z: -4, r: 3.5, frases: ['Todo se cambia. Hasta lo que ya no tenés.', 'Mis precios son justos. Los tuyos, no tanto.', 'Un Huésped nuevo vale más que mil núcleos viejos.'] },
  herrero: { id: 'herrero', kind: 'herrero', nombre: 'El Herrero de Huesos', x: -30.5, z: 5.5, r: 3.5, frases: ['Lo que no sirve se funde y se vuelve a forjar.', 'La Forja está al norte: las cubas trabajan solas, yo sólo miro.', 'Hueso, quitina, raíz… todo sirve si tiene paciencia.'] },
  sanadora: { id: 'sanadora', kind: 'sanadora', nombre: 'La Sanadora', x: -19, z: -5, r: 3.5, frases: ['Descansá, vivo. A los muertos nos gusta ver latir algo.', 'Acá nadie te lastima. Aprovechá.', 'El Santuario late. ¿Lo sentís?'] },
  guia: { id: 'guia', kind: 'guia', nombre: 'La Guía del Santuario', x: 6, z: 27, r: 4, frases: ['Bienvenido al Santuario: la base del limbo. Caminá, mirá y usá las estaciones.', 'Al norte, la Forja. Al este, tus Huéspedes. En el centro, la Mesa para elegir destino.', 'Cuando quieras jugar, andá a la Mesa de Territorios, en el centro.'] },
};
export const PERSONAJE_IDS = Object.keys(PERSONAJES);

/** Estación cuyo rango contiene el punto (x,z) (la más cercana en proporción a su rango), o null. */
export function estacionCerca(x, z) {
  let best = null, bk = Infinity;
  for (const e of Object.values(ESTACIONES)) { const d = Math.hypot(x - e.x, z - e.z); if (d <= e.r && d / e.r < bk) { bk = d / e.r; best = e; } }
  return best;
}
/** Lo más cercano con lo que se puede interactuar: { tipo: 'estacion'|'personaje', def } o null. Los personajes (más chicos) ganan si estás pegado a ellos. */
export function interaccionCerca(x, z) {
  let best = null, bk = Infinity;
  for (const e of Object.values(ESTACIONES)) { const d = Math.hypot(x - e.x, z - e.z); if (d <= e.r && d / e.r < bk) { bk = d / e.r; best = { tipo: 'estacion', def: e }; } }
  for (const n of Object.values(PERSONAJES)) { const d = Math.hypot(x - n.x, z - n.z); if (d <= n.r && d / n.r < bk) { bk = d / n.r; best = { tipo: 'personaje', def: n }; } }
  return best;
}

/* ───────────────────────── jardín ───────────────────────── */
/** Plantas del jardín: producen materiales de la Forja. `t` = segundos reales hasta la cosecha; `n` unidades de calidad `cal` (0 Burdo … 3 Perfecto); `costo` en núcleos.
 *  Si otro módulo suma materiales vegetales a MATERIALS, basta con agregar una planta acá (planta cuyo material no exista se ignora). */
const PLANTAS_TODAS = {
  raiz: { id: 'raiz', nombre: 'Brote de Raíz', mat: 'raiz', n: 3, cal: 1, t: 480, costo: 10, texto: 'Un retoño que respira. Da Raíz fina.' },
  espora: { id: 'espora', nombre: 'Hongo Lumínico', mat: 'espora', n: 3, cal: 1, t: 420, costo: 10, texto: 'Moho que brilla en la oscuridad. Da Espora fina.' },
  carne: { id: 'carne', nombre: 'Fruto Carnoso', mat: 'carne', n: 3, cal: 1, t: 600, costo: 14, texto: 'Fruta tibia que late sola. Da Carne fina.' },
  cristal: { id: 'cristal', nombre: 'Flor de Geoda', mat: 'cristal', n: 2, cal: 2, t: 900, costo: 25, texto: 'Pétalos de cristal vivo. Da Cristal excelente.' },
  // — plantas de la FLORA de las arenas (docs/FLORA.md): materiales vegetales para los sets de jardín. Del jardín sale hasta calidad Excelente; lo Perfecto sólo lo dan las plantas raras de las arenas —
  fibra: { id: 'fibra', nombre: 'Zarza Mansa', mat: 'fibra', n: 3, cal: 1, t: 540, costo: 12, texto: 'Una enredadera sin espinas. Da Fibra viva fina.' },
  savia: { id: 'savia', nombre: 'Árbol de Savia Chico', mat: 'savia', n: 3, cal: 1, t: 600, costo: 14, texto: 'Un arbolito que chorrea dulce. Da Savia fina.' },
  petalo: { id: 'petalo', nombre: 'Flor de Luz de Maceta', mat: 'petalo', n: 2, cal: 2, t: 900, costo: 25, texto: 'Pétalos que guardan la luz del día. Da Pétalo de luz excelente.' },
  resina: { id: 'resina', nombre: 'Pino de Resina', mat: 'resina', n: 2, cal: 1, t: 720, costo: 16, texto: 'Gotas ámbar que se juntan solas. Da Resina fina.' },
  nectar: { id: 'nectar', nombre: 'Fruto de Néctar', mat: 'nectar', n: 2, cal: 1, t: 780, costo: 18, texto: 'Un fruto que late con un tictac dulce. Da Néctar fino.' },
  polen: { id: 'polen', nombre: 'Flor de Polen', mat: 'polen', n: 3, cal: 1, t: 600, costo: 14, texto: 'Una flor que estornuda colores. Da Polen psicodélico fino.' },
  hoja_espejo: { id: 'hoja_espejo', nombre: 'Planta Espejo Chica', mat: 'hoja_espejo', n: 1, cal: 2, t: 1200, costo: 30, texto: 'Una hoja pulida que se mira sola. Da Hoja espejo excelente.' },
  raiz_hierro: { id: 'raiz_hierro', nombre: 'Raíz de Hierro', mat: 'raiz_hierro', n: 1, cal: 2, t: 1200, costo: 30, texto: 'Una raíz dura como un clavo. Da Raíz-hierro excelente.' },
};
export const PLANTAS = Object.fromEntries(Object.entries(PLANTAS_TODAS).filter(([, p]) => MATERIALS[p.mat]));
export const PLANTA_IDS = Object.keys(PLANTAS);
export const TOPE_TIEMPO = 7 * 24 * 3600 * 1000;   // el reloj real tiene tope: si la hora guardada está en el futuro o a más de 7 días, se toma como recién sembrada / ya madura

/** Estado de una maceta con la hora `ahora` (ms): { estado: 'vacia'|'crece'|'lista', faltan (s), prog (0..1), planta }. Determinista: sólo depende de lo guardado y del reloj que se le pase. */
export function macetaEstado(m, ahora = Date.now()) {
  const P = m && PLANTAS[m.p]; if (!P) return { estado: 'vacia', faltan: 0, prog: 0, planta: null };
  let t0 = Number(m.t0) || 0; if (t0 > ahora) t0 = ahora;   // reloj raro (hora futura): cuenta desde ahora, nunca regala tiempo
  const pasado = Math.min(TOPE_TIEMPO, Math.max(0, ahora - t0)) / 1000, faltan = Math.max(0, Math.ceil(P.t - pasado));
  return { estado: faltan === 0 ? 'lista' : 'crece', faltan, prog: Math.min(1, pasado / P.t), planta: P };
}

/* ───────────────────────── el mapa ───────────────────────── */
export function makeBase() {
  const map = makeLimboArena({
    id: BASE.id, name: BASE.name, rooms: ROOMS, walls: murosDe(ROOMS, BASE.WALL_H, BASE.CELL), covers: COVERS, navStep: 6,
    navExtra: [[0, 28], [0, -24], [-24, 0], [24, 0], [24, -16], [-24, -16], [24, 20], [-24, 20]],
    zones: [], spawn: BASE.SPAWN, noSpawn: [],
    bossAnchor: v3(0, 8, 0),
    spots: { anchor: v3(0, 0, 0), plates: [], core: v3(0, 0, 0), altar: v3(0, 0, 0), resonators: () => [], eyes: () => [], valves: [], boss: v3(0, 8, 0) },
    deco: { base: true },
  });
  map.base = true;   // la bandera que reconoce Game: sin oleadas ni enemigos
  map.estaciones = ESTACIONES; map.personajes = PERSONAJES;
  return map;
}

/* ───────────────────────── dentro de la partida (Game) ───────────────────────── */
/** Crea los objetos fijos del hub (estaciones y personajes). Se llama una vez desde el constructor de Game. */
export function initBase(g) {
  g.base = { visitas: {}, habla: {} };
  for (const e of Object.values(ESTACIONES)) g.addObject('estacion', v3(e.x, 0, e.z), { kind: e.id, r: e.r, objective: true, life: 1e9 });
  for (const n of Object.values(PERSONAJES)) g.addObject('npc', v3(n.x, 0, n.z), { kind: n.kind, r: 1.2, objective: true, life: 1e9, baseId: n.id });
}
/** Cada cuadro: el jugador no se rompe (nada lo daña en la Base) y no hay oleadas. */
export function stepBase(g) {
  g.phaseT = 1e9; g.phase = 'intermission'; g.wave = 0;
  for (const p of g.players) { if (p.dead) { p.dead = false; p.lost = false; } p.hp = 100; p.shield = 100; }
}
/** Al empezar el cuadro de cada jugador: en la Base no hay armas ni habilidades (se apagan antes de que la simulación las lea). */
export function baseSinArmas(inp) { inp.fire = inp.ability = inp.mov = inp.esp = inp.s3 = inp.melee = inp.a1 = inp.a2 = inp.ult = inp.reload = false; inp.weapon = -1; }
/** Por jugador y por cuadro: USAR (borde de subida) interactúa con lo más cercano. */
export function baseStep(g, p) {
  if (p.melee) p.melee = '';   // sin arma en la mano: en la Base se ve al Huésped, no su espada (el cuerpo dibuja `mw` = p.melee)
  if (!p.interactEdge) return;
  const c = interaccionCerca(p.pos.x, p.pos.z); if (!c) return;
  if (c.tipo === 'estacion') { g.base.visitas[c.def.id] = (g.base.visitas[c.def.id] || 0) + 1; g.emit({ t: 'estacion', pid: p.id, id: c.def.id }); }
  else { const n = g.base.habla[c.def.id] = (g.base.habla[c.def.id] || 0) + 1; g.emit({ t: 'habla', pid: p.id, id: c.def.id, n: n - 1, tx: c.def.frases[(n - 1) % c.def.frases.length] }); }
}
