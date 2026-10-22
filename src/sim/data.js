import { ULT_COOLDOWN } from './ultimate-cooldown.js';
// Datos de diseño: armas, bestiario, oleadas. Todo número de balance vive acá.
import { COLMENA } from './colmena-data.js';   // sexto Huésped (invocador/enjambre): datos puros; lógica en enjambre.js
export const G = 28; // magnitud de gravedad

export const LIMITS = { monsters: 90, projectiles: 300, pickups: 40, events: 240, units: 10, unitsTotal: 24, nests: 2, pozos: 3, satelites: 8, flora: 40 };   // units = zánganos de Colmena por jugador, unitsTotal = en toda la partida, nests = nidos-torreta por jugador (src/sim/enjambre.js)

export const WEAPONS = [
  { id: 'haz',    name: 'Haz',    kind: 'hitscan', dmg: 22, rate: 0.26, pellets: 1, spread: 0.004, range: 320, max: Infinity, start: Infinity, per: 0 },
  { id: 'prisma', name: 'Prisma', kind: 'hitscan', dmg: 12,  rate: 0.8,  pellets: 9, spread: 0.075, range: 70,  max: 48,  start: 20, per: 1 },
  { id: 'rafaga', name: 'Ráfaga', kind: 'hitscan', dmg: 11,  rate: 0.085, pellets: 1, spread: 0.022, range: 220, max: 360, start: 150, per: 1 },
  { id: 'nova',   name: 'Nova',   kind: 'projectile', dmg: 100, rate: 1.0, splash: 8, speed: 58, max: 32, start: 10, per: 1 },
  { id: 'aguja',  name: 'Aguja',  kind: 'hitscan', dmg: 170, rate: 1.4, pellets: 1, spread: 0, range: 420, pierce: true, max: 28, start: 10, per: 1 },
  // ── armas nuevas (se eligen en el equipo antes de jugar; mejoran por oleada). `desc` = una línea para el menú ──
  { id: 'pulso',    name: 'Pulso',    kind: 'hitscan', dmg: 40, rate: 0.34, pellets: 1, spread: 0.003, range: 260, max: 120, start: 60, per: 1, desc: 'Pistola de pulso: semiautomática, precisa y estable.' },
  { id: 'gemelas',  name: 'Gemelas',  kind: 'hitscan', dmg: 8,  rate: 0.07, pellets: 2, spread: 0.04, range: 120, max: 400, start: 200, per: 1, desc: 'Dos cañones en ráfaga loca: mucho volumen de fuego.' },
  { id: 'solar',    name: 'Solar',    kind: 'hitscan', dmg: 4.5, rate: 0.045, pellets: 2, spread: 0.05, range: 24, max: 500, start: 220, per: 1, desc: 'Lanzallamas de luz: derrite todo lo que está cerca.' },
  { id: 'fractal',  name: 'Fractal',  kind: 'hitscan', dmg: 30, rate: 0.5, pellets: 1, spread: 0.004, range: 160, chain: 3, max: 80, start: 40, per: 1, desc: 'Un arco de energía que salta a 3 criaturas más.' },
  { id: 'enjambre', name: 'Enjambre', kind: 'swarm', dmg: 26, rate: 1.1, count: 5, splash: 3, speed: 30, max: 60, start: 30, per: 5, desc: 'Cinco micro-misiles que buscan su blanco.' },
  { id: 'cometa',   name: 'Cometa',   kind: 'projectile', dmg: 120, rate: 0.9, splash: 5, speed: 34, homing: 2.2, max: 24, start: 8, per: 1, desc: 'Proyectil lento y teledirigido con gran explosión.' },
  { id: 'vortice',  name: 'Vórtice',  kind: 'projectile', dmg: 20, rate: 1.8, splash: 7, speed: 38, well: 3, max: 12, start: 4, per: 1, desc: 'Abre un pozo de gravedad: junta a todos y estalla.' },
  { id: 'lanza',    name: 'Lanza',    kind: 'projectile', dmg: 150, rate: 1.0, splash: 0, speed: 110, pierce: true, max: 30, start: 12, per: 1, desc: 'Lanza de cristal que atraviesa filas enteras.' },
  { id: 'cetro',    name: 'Cetro Vital', kind: 'hitscan', dmg: 16, rate: 0.16, pellets: 1, spread: 0.01, range: 90, lifesteal: 0.1, max: 300, start: 100, per: 1, desc: 'Cada impacto te devuelve vida.' },
  { id: 'eclipse',  name: 'Eclipse',  kind: 'hitscan', dmg: 11, rate: 1.2, pellets: 14, spread: 0.1, range: 40, knock: 9, max: 40, start: 16, per: 1, desc: 'Escopeta pesada: empuja y destroza de cerca.' },
  { id: 'voltaico', name: 'Voltaico', kind: 'hitscan', dmg: 20, rate: 0.35, pellets: 1, spread: 0.006, range: 120, chain: 4, max: 200, start: 100, per: 1, desc: 'Arco eléctrico que salta por hasta 4 criaturas.' },
  { id: 'glaciar',  name: 'Glaciar',  kind: 'hitscan', dmg: 14, rate: 0.22, pellets: 1, spread: 0.01, range: 90, slow: 3, max: 160, start: 80, per: 1, desc: 'Ráfaga helada: ralentiza a las criaturas a la mitad.' },
  { id: 'plaga',    name: 'Plaga',    kind: 'hitscan', dmg: 6, rate: 0.18, pellets: 1, spread: 0.012, range: 100, poison: 14, max: 220, start: 100, per: 1, desc: 'Veneno: daño continuo durante 5 segundos.' },
  { id: 'brasa',    name: 'Brasa',    kind: 'hitscan', dmg: 3, rate: 0.05, pellets: 2, spread: 0.06, range: 26, burn: 12, max: 600, start: 250, per: 1, desc: 'Llamas que dejan a las criaturas ardiendo.' },
  { id: 'mina',     name: 'Sembradora', kind: 'mine', dmg: 160, rate: 0.8, splash: 7, speed: 40, max: 20, start: 8, per: 1, desc: 'Minas de cristal: se pegan a la superficie y explotan al acercarse una criatura.' },
  { id: 'sierra',   name: 'Sierra',   kind: 'hitscan', dmg: 5, rate: 0.04, pellets: 3, spread: 0.2, range: 11, pierce: true, max: 600, start: 250, per: 1, desc: 'Sierra de luz giratoria: corta todo lo que tiene delante.' },
  { id: 'pulsar',   name: 'Pulsar',   kind: 'pulse', dmg: 40, rate: 0.7, radius: 10, knock: 12, max: 40, start: 20, per: 1, desc: 'Onda en todas direcciones: sin apuntar, aleja a los que te rodean.' },
  { id: 'dardos',   name: 'Dardos',   kind: 'hitscan', dmg: 26, rate: 0.38, pellets: 3, spread: 0.012, range: 220, max: 150, start: 75, per: 1, desc: 'Ráfaga de 3 dardos de cristal muy precisos.' },
  { id: 'requiem',  name: 'Réquiem',  kind: 'hitscan', dmg: 60, rate: 0.6, pellets: 1, spread: 0.002, range: 360, exec: 2.2, max: 60, start: 24, per: 1, desc: 'Ejecuta: ×2,2 de daño a criaturas con poca vida.' },
  { id: 'quimera',  name: 'Quimera',  kind: 'hitscan', dmg: 22, rate: 0.3, pellets: 1, spread: 0.01, range: 160, chaos: true, max: 150, start: 70, per: 1, desc: 'Cada disparo tiene un efecto distinto al azar: arco, hielo, fuego o explosión.' },
];

/* ───────── Personajes: cada uno con 2 habilidades propias (desplazamiento + disparo especial) y un rol de equipo ───────── */
export const CHARACTERS = {
  egida:  { name: 'Égida',  role: 'vanguardia', preset: 'jugador1', seed: null, color: 0x66ffee, desc: 'Tanque de choque. Aguanta, abre camino y empuja.',
    mov: { id: 'embestida',     name: 'Embestida',      cd: 7,  desc: 'Se lanza hacia adelante y arrolla lo que toca.' },
    esp: { id: 'onda',          name: 'Onda de choque', cd: 12, desc: 'Cono de energía: daño fuerte y empuje.' } },
  lumen:  { name: 'Lumen',  role: 'soporte', preset: 'jugador2', seed: null, color: 0xff66c4, desc: 'Sanadora de cristal. Mantiene vivo al equipo.',
    mov: { id: 'paso',          name: 'Paso de luz',    cd: 6,  desc: 'Teletransporte corto hacia donde mirás.' },
    esp: { id: 'rayo',          name: 'Rayo sanador',   cd: 10, desc: 'Haz que atraviesa: daña criaturas y cura aliados.' } },
  forja:  { name: 'Forja',  role: 'ingeniero', preset: 'jugador3', seed: null, color: 0xffd23f, desc: 'Artillera. Explosivos y torretas.',
    mov: { id: 'propulsor',     name: 'Propulsor',      cd: 8,  desc: 'Impulso hacia arriba y adelante (saltás sobre todo).' },
    esp: { id: 'cohete',        name: 'Cohete de racimo', cd: 14, desc: 'Gran explosión que lanza esquirlas.' } },
  vigia:  { name: 'Vigía',  role: 'explorador', preset: 'jugador4', seed: null, color: 0x9dff5a, desc: 'Cazadora veloz. Marca y elimina objetivos clave.',
    mov: { id: 'deslizamiento', name: 'Deslizamiento',  cd: 6,  desc: 'Carrera relámpago hacia donde se mueve.' },
    esp: { id: 'riel',          name: 'Tiro marcador',  cd: 11, desc: 'Rayo perforante que además marca (+30 % de daño).' } },
  nova:   { name: 'Nova',   role: 'explorador', preset: null, seed: 'nova-7', color: 0xff9a3c, desc: 'Fuego de saturación y saltos imposibles.',
    mov: { id: 'salto',         name: 'Salto cuántico', cd: 9,  desc: 'Salto altísimo, ideal para la gravedad rota.' },
    esp: { id: 'rafaga',        name: 'Ráfaga total',   cd: 9,  desc: '14 disparos de golpe en abanico.' } },
  umbra:  { name: 'Umbra',  role: 'soporte', preset: null, seed: 'umbra-3', color: 0xb98cff, desc: 'Controla el espacio. Fase y singularidades.',
    mov: { id: 'fase',          name: 'Fase',           cd: 8,  desc: 'Salto hacia atrás con 1 s de invulnerabilidad.' },
    esp: { id: 'singularidad',  name: 'Singularidad',   cd: 16, desc: 'Un agujero que arrastra a las criaturas y estalla.' } },
};


/* ───────── ARMAS CUERPO A CUERPO: catálogo de espadas, hachas, martillos, lanzas y dagas. Cada Huésped tiene una propia (innata) y puede fusionarse con otra.
   `special` se activa al fusionar (evolución 1+) y se potencia en la evolución 3+. `aff` = tipos con los que cada Huésped tiene afinidad (+15 %). ───────── */
export const MELEE_TYPES = { espada: 'Espada', hacha: 'Hacha', martillo: 'Martillo', lanza: 'Lanza', daga: 'Daga', innata: 'Innata' };
const L = (dmg, range, arc, cd, extra = {}) => ({ dmg, range, arc, cd, ...extra });
export const MELEE_WEAPONS = {
  // espadas
  filo_oseo:      { type: 'espada',   name: 'Filo óseo',          cost: 0,   special: 'onda',    desc: 'Espada de hueso afilado. El golpe pesado lanza una onda cortante que atraviesa.', light: L(44, 3.8, 0.55, 0.34), heavy: L(125, 4.5, 0.5, 0.9, { knock: 10 }) },
  sable_plasma:   { type: 'espada',   name: 'Sable de plasma',    cost: 60,  special: 'quema',   desc: 'Rápido. Cada tajo deja a la criatura ardiendo.', light: L(36, 3.6, 0.5, 0.26), heavy: L(105, 4.2, 0.5, 0.75, { knock: 6 }) },
  hoja_umbral:    { type: 'espada',   name: 'Hoja del Umbral',    cost: 140, special: 'atraviesa', desc: 'Corta a través de las defensas y de varias criaturas a la vez.', light: L(50, 4.0, 0.5, 0.4, { pierce: true }), heavy: L(135, 4.8, 0.45, 0.95, { pierce: true }) },
  // hachas
  hacha_quitina:  { type: 'hacha',    name: 'Hacha de quitina',   cost: 40,  special: 'sangrado', desc: 'Pesada y brutal. Provoca sangrado (daño con el tiempo).', light: L(58, 3.6, 0.6, 0.5), heavy: L(160, 4.2, 0.55, 1.05, { knock: 8 }) },
  hacha_doble:    { type: 'hacha',    name: 'Hacha doble',        cost: 110, special: 'barrido', desc: 'Doble filo: golpea en un arco enorme a muchas criaturas.', light: L(46, 3.8, 0.85, 0.5), heavy: L(130, 4.4, 0.9, 1.0) },
  segur_vorax:    { type: 'hacha',    name: 'Segur Vórax',        cost: 180, special: 'rapina',  desc: 'Roba vida con cada tajo.', light: L(52, 3.6, 0.6, 0.46), heavy: L(150, 4.2, 0.55, 1.0) },
  // martillos
  martillo_sismico:{ type: 'martillo', name: 'Martillo sísmico',  cost: 70,  special: 'sismo',   desc: 'Lento y devastador. El golpe pesado hace temblar el suelo en área.', light: L(75, 3.8, 0.7, 0.7), heavy: L(200, 4.6, 0.8, 1.3, { knock: 24 }) },
  maza_espora:    { type: 'martillo', name: 'Maza de esporas',    cost: 130, special: 'espora',  desc: 'Cada golpe suelta una nube de esporas que ralentiza y envenena.', light: L(62, 3.8, 0.7, 0.6), heavy: L(170, 4.4, 0.8, 1.2, { knock: 16 }) },
  yunque_vital:   { type: 'martillo', name: 'Yunque vital',       cost: 200, special: 'aturde',  desc: 'Aturde casi por completo a lo que golpea.', light: L(70, 3.6, 0.65, 0.8), heavy: L(190, 4.4, 0.75, 1.3, { knock: 12 }) },
  // lanzas
  lanza_sinaptica:{ type: 'lanza',    name: 'Lanza sináptica',    cost: 50,  special: 'linea',   desc: 'Largo alcance: la punta atraviesa todo lo que está en línea.', light: L(48, 6.5, 0.22, 0.4, { pierce: true }), heavy: L(125, 8, 0.2, 0.95, { pierce: true }) },
  pica_cristal:   { type: 'lanza',    name: 'Pica de cristal',    cost: 120, special: 'estocada', desc: 'El alcance más largo. El golpe pesado es una estocada con embestida.', light: L(44, 7.5, 0.18, 0.45), heavy: L(140, 9, 0.16, 1.0, { knock: 14 }) },
  tridente_abisal:{ type: 'lanza',    name: 'Tridente abisal',    cost: 190, special: 'arrastra', desc: 'Arrastra a las criaturas hacia vos.', light: L(46, 6.0, 0.3, 0.42, { knock: -8 }), heavy: L(120, 7.5, 0.3, 1.0, { knock: -16 }) },
  // dagas
  daga_neurotoxica:{ type: 'daga',    name: 'Daga neurotóxica',   cost: 30,  special: 'veneno',  desc: 'Muy rápida. Cada corte envenena.', light: L(30, 3.0, 0.6, 0.2), heavy: L(85, 3.4, 0.55, 0.55) },
  colmillo:       { type: 'daga',     name: 'Colmillo',           cost: 100, special: 'acuchilla', desc: 'Doble daño si golpeás por la espalda o a una criatura que no te mira.', light: L(34, 3.0, 0.6, 0.22), heavy: L(95, 3.4, 0.55, 0.6) },
  aguja_fantasma: { type: 'daga',     name: 'Aguja fantasma',     cost: 170, special: 'destello', desc: 'El golpe pesado es un destello: te lanza hacia adelante cortando todo a su paso.', light: L(32, 3.0, 0.6, 0.2), heavy: L(100, 3.6, 0.5, 0.7) },
};
// armas innatas de cada Huésped (las de data.js → CHARACTERS[*].melee)
export const NATIVE_MELEE = { axioma: 'cuchillas', vesper: 'garras', micelio: 'punos', umbra: 'hoja_dim', seraf: 'latigo', danzante: 'listones', singular: 'orbita' };
export const MELEE_AFFINITY = { axioma: ['espada', 'hacha'], vesper: ['daga'], micelio: ['martillo', 'hacha'], umbra: ['lanza', 'espada'], seraf: ['lanza', 'daga'], danzante: ['daga', 'espada'], singular: ['martillo', 'lanza'] };
/* Evolución del Huésped con NÚCLEOS (se ganan matando criaturas, completando objetivos y oleadas, y jefes). Coste = núcleos para pasar al nivel siguiente. */
export const EVO_COST = [0, 40, 90, 160, 280];
export const EVO_TIERS = [
  { name: 'Larva',       desc: 'Forma inicial.' },
  { name: 'Despertar',   desc: 'Tu arma cuerpo a cuerpo se fusiona con vos y despierta su poder especial. Elegí un camino.' },
  { name: 'Fusión',      desc: 'La fusión se profundiza. Elegí un camino.' },
  { name: 'Mutación',    desc: 'Tu cuerpo cambia de forma. Elegí un camino.' },
  { name: 'Forma final', desc: 'Lo que elijas ahora define lo que sos. Elegí un camino.' },
];
/* En cada nivel hay DOS caminos EXCLUYENTES: elegir uno cierra el otro para siempre (en ese Huésped). `vis` = cómo se ve la mutación. */
export const EVO_PATHS = [
  null,
  [{ id: 'depredador', name: 'Depredador', vis: 'garras',  desc: 'Melee +20 % y cada golpe cuerpo a cuerpo te cura un 6 % del daño.' },
   { id: 'coraza',     name: 'Coraza',     vis: 'placas',  desc: 'Recibís 18 % menos de daño: placas que crecen sobre el cuerpo.' }],
  [{ id: 'velocidad',  name: 'Velocidad',  vis: 'tendones', desc: '+12 % de velocidad y habilidades 15 % más rápidas.' },
   { id: 'resonancia', name: 'Resonancia', vis: 'nucleo',  desc: 'La definitiva se recupera un 15 % más rápido y dura un 25 % más.' }],
  [{ id: 'simbiosis',  name: 'Simbiosis',  vis: 'fusion',  desc: 'El poder especial de tu arma fusionada se potencia y el melee suma +15 %.' },
   { id: 'artilleria', name: 'Artillería', vis: 'canones', desc: '+15 % de daño con todas las armas a distancia y +30 % de cargador.' }],
  [{ id: 'apoteosis',  name: 'Apoteosis',  vis: 'alas',    desc: 'Todo tu daño +10 % y la definitiva dura un 30 % más.' },
   { id: 'anomalia',   name: 'Anomalía',   vis: 'grietas', desc: 'Una de cada cuatro bajas estalla en esencia: 70 de daño en área.' }],
];
/** Lectura propia de cada camino para un Huésped: mismos ids y MISMOS bonos que EVO_PATHS, más un extra que sólo ese Huésped tiene (lo aplica su archivo de la sim). Si falta, vale el texto general. */
export const EVO_FLAVOR = {
  danzante: {
    depredador: { name: 'Colmillo de Carnaval', desc: 'Melee +20 % y cada golpe te cura un 6 % del daño. Tu Réplica dura 6 s en vez de 4.' },
    coraza:     { name: 'Máscara de Hueso',     desc: 'Recibís 18 % menos de daño. La ventana de la Parada perfecta es un 40 % más larga.' },
    velocidad:  { name: 'Pies de Seda',         desc: '+12 % de velocidad y habilidades 15 % más rápidas. La Pirueta esquiva 0,1 s más.' },
    resonancia: { name: 'Compás Eterno',        desc: 'La definitiva se recupera un 15 % más rápido y dura un 25 % más. Cada golpe a tiempo suma 2 de compás (no 1).' },
    simbiosis:  { name: 'Hilo de Listones',     desc: 'El melee suma +15 %. Lo que devolvés con una parada pega un 50 % más.' },
    artilleria: { name: 'Salva de Gala',        desc: '+15 % de daño con armas a distancia y +30 % de cargador. El estallido de tus paradas llega un 50 % más lejos.' },
    apoteosis:  { name: 'Gala de los Muertos',  desc: 'Todo tu daño +10 % y la definitiva dura un 30 % más. En la Danza Macabra, las paradas automáticas se repiten cada 0,4 s.' },
    anomalia:   { name: 'Baile de Máscaras',    desc: 'Una de cada cuatro bajas estalla en esencia (70 de daño). Cada parada o esquiva perfecta deja un eco que estalla (60 de daño en área).' },
  },
  singular: {
    depredador: { name: 'Devoradora de Mundos',     desc: 'Melee +20 % y cada golpe te cura un 6 % del daño. Un satélite más girando a tu alrededor.' },
    coraza:     { name: 'Corteza Estelar',          desc: 'Recibís 18 % menos de daño. Tus satélites se comen los proyectiles enemigos que cruzan.' },
    velocidad:  { name: 'Perihelio',                desc: '+12 % de velocidad y habilidades 15 % más rápidas. Tus satélites giran un 40 % más rápido (más golpes).' },
    resonancia: { name: 'Resonancia Gravitatoria',  desc: 'La definitiva se recupera un 15 % más rápido y dura un 25 % más. Tus pozos duran un 35 % más.' },
    simbiosis:  { name: 'Anillo de Acreción',       desc: 'El melee suma +15 %. Un satélite más y todos pegan un 25 % más fuerte.' },
    artilleria: { name: 'Cañón de Marea',           desc: '+15 % de daño con armas a distancia y +30 % de cargador. Tus pozos son un 12 % más grandes y su implosión pega un 50 % más.' },
    apoteosis:  { name: 'Supernova Interior',       desc: 'Todo tu daño +10 % y la definitiva dura un 30 % más. Podés sostener un pozo más a la vez.' },
    anomalia:   { name: 'Singularidad Desnuda',     desc: 'Una de cada cuatro bajas estalla en esencia (70 de daño). Además, cada baja tira de las criaturas vecinas hacia el cadáver.' },
  },
};
/* ───────── TRES ESTILOS DE COMBATE (elegís uno; equilibrados entre sí: tests/estilos.test.js) ─────────
   mul = multiplicador de daño según la fuente (melee / gun = disparos / skill = habilidades); cd = enfriamiento de habilidades;
   taken = daño recibido; ult = velocidad de recuperación de definitiva. */
export const STYLES = {
  melee:     { name: 'Melé',        desc: 'Cuerpo a cuerpo: golpes ×1,7, recibís 20 % menos de daño. Tus disparos pegan menos.', mul: { melee: 1.7, gun: 0.75, skill: 1 }, cd: 1, taken: 0.8, ult: 1 },
  disparo:   { name: 'Disparo',     desc: 'A distancia: disparos ×1,3. Tu melee pega menos.', mul: { melee: 0.8, gun: 1.3, skill: 1 }, cd: 1, taken: 1, ult: 1 },
  habilidad: { name: 'Habilidades', desc: 'Poderes: habilidades ×1,9 y el doble de rápidas; la definitiva vuelve antes. Armas y melee pegan menos.', mul: { melee: 0.8, gun: 0.75, skill: 1.9 }, cd: 0.5, taken: 1, ult: 1.3 },
};
/* Estilo interno del modo COMBO (no se elige en el menú: lo pone el sim al activar el modo). Equilibrado contra «Melé» (tests/combos.test.js). */
STYLES.combo = { name: 'Combo', hidden: true, desc: 'Modo Combo: golpes encadenados y una habilidad propia.', mul: { melee: 1.6, gun: 0.75, skill: 1.5 }, cd: 1, taken: 0.85, ult: 1.15 };
export const STYLE_IDS = Object.keys(STYLES).filter((k) => !STYLES[k].hidden);
/** Sin estilo elegido (pruebas, bots viejos): todo ×1. */
export const STYLE_NEUTRAL = { name: 'Neutro', mul: { melee: 1, gun: 1, skill: 1 }, cd: 1, taken: 1, ult: 1 };
/* ───────── MODO DE JUEGO: «Shooter» (el de siempre) o «Combo» (el melé manda; docs/HUESPEDES.md → «Modo Combo») ───────── */
export const GAME_MODES = {
  shooter: { name: 'Shooter', icon: '🎯', desc: 'El de siempre: disparás, apuntás, recargás y usás las 3 habilidades y la definitiva.' },
  combo:   { name: 'Combo',   icon: '⚔',  desc: 'El cuerpo a cuerpo manda: DOS botones de ataque que se encadenan en combos, UNA habilidad muy importante propia y salto.' },
};
export const MODE_IDS = Object.keys(GAME_MODES);
/** Ventana (s) tras la recuperación de un golpe para seguir la cadena, y tiempo máximo de carga de la flecha de Seraf. */
export const COMBO_RULES = { window: 0.75, cancel: 0.7, buffer: 0.28, chargeMax: 1.0 };
/** Cada arma fusionada (por tipo) cambia la FORMA del set: largo máximo de la cadena, daño, alcance/ángulo de A1 y A2 y golpes extra. */
export const COMBO_WEAPON = {
  innata:   { chain: 4, dmg: 1,    cd: 1,    a1: { rng: 1,    arc: 1 },   a2: { rng: 1, arc: 1 },   note: 'El set básico del Huésped.' },
  espada:   { chain: 4, dmg: 1,    cd: 1,    a1: { rng: 1,    arc: 1 },   a2: { rng: 1, arc: 1 },   fin: 1.12, note: 'Espada: cadena de 3-4 golpes; el remate pega 12 % más.' },
  hacha:    { chain: 3, dmg: 1.05, cd: 1,    a1: { rng: 1,    arc: 1.25 }, a2: { rng: 1, arc: 1.3 }, spinAt: 3, note: 'Hacha: 2 golpes lentos y el 3.º es un GIRO que pega alrededor.' },
  martillo: { chain: 2, dmg: 1.15, cd: 1.12, a1: { rng: 0.95, arc: 1.1 }, a2: { rng: 1, arc: 1.2 }, sismo: true, note: 'Martillo: cadena corta; cada golpe aplasta y manda una onda al suelo.' },
  lanza:    { chain: 3, dmg: 1,    cd: 1,    a1: { rng: 1.45, arc: 0.5 }, a2: { rng: 1.05, arc: 1.7 }, note: 'Lanza: A1 es una estocada larga y A2 un barrido amplio.' },
  daga:     { chain: 6, dmg: 1,    cd: 0.92, a1: { rng: 0.95, arc: 1 },   a2: { rng: 0.95, arc: 1 },  note: 'Daga: ráfagas rápidas, cadenas de hasta 6 golpes.' },
};
/** Habilidad PRINCIPAL de cada Huésped en modo Combo. wind = s de preparación (telegrafía), r = radio base (m), rol = para qué sirve. */
export const HABILIDADES = {
  axioma:  { id: 'baluarte',  name: 'Baluarte',            cd: 14, wind: 0.15, r: 5.5, rol: 'escudo',  desc: 'Te cubrís 4,5 s: absorbe el 70 % del daño y lo REFLEJA entero. Al activarlo, onda que empuja y suma escudo.' },
  vesper:  { id: 'caza',      name: 'Frenesí de caza',     cd: 15, wind: 0.25, r: 7,   rol: 'daño en área', desc: 'Embestida que marca y daña a lo que cruza; 6 s de frenesí: +30 % de velocidad, golpes 25 % más rápidos y +20 % de daño.' },
  micelio: { id: 'estallido', name: 'Estallido de esporas', cd: 16, wind: 0.45, r: 9,  rol: 'curación + control', desc: 'Tras una breve carga, las esporas estallan: dañan y enraízan a las criaturas y CURAN al equipo cercano.' },
  umbra:   { id: 'eclipse',   name: 'Eclipse',             cd: 18, wind: 0.3,  r: 8,   rol: 'control de zona', desc: 'Una zona de sombra de 6 s: las criaturas dentro van al 25 % de velocidad y reciben daño continuo.' },
  seraf:   { id: 'bendicion', name: 'Bendición',           cd: 22, wind: 0.4,  r: 15,  rol: 'curación + escudo', desc: 'Luz sobre el equipo: cura fuerte, escudo completo y 20 % menos de daño 6 s. Reanima a un caído cercano.' },
  danzante: { id: 'contrapaso', name: 'Contrapaso',        cd: 9,  wind: 0.08, r: 6,   rol: 'contraataque', desc: 'Te plantás 0,65 s en guardia perfecta: lo que te golpee en ese instante se anula, se devuelve ×3 en área y quedás en Réplica (+35 % de daño 4 s). Si nadie te golpea, la habilidad vuelve en la mitad de tiempo.' },
  singular: { id: 'gravedad', name: 'Colapso gravitatorio', cd: 15, wind: 0.35, r: 9, rol: 'control de área', desc: 'Abrís un pozo delante tuyo: 2,6 s tirando de TODAS las criaturas hacia su centro (las agrupa para tus combos) y, al cerrarse, implosiona: daña en área y las frena. Lo que está adentro recibe +20 % de daño.' },
};
/** Un Huésped se juega con A1 (ataque 1) y A2 (ataque 2) encadenados: cada «move» es una secuencia. seq = entradas, evo = nivel mínimo,
    path = camino de evolución requerido (opcional), w = 'l' ligero | 'h' pesado (stats del arma), dmg = × daño, rng/arc = × alcance/ángulo (arc ≥ 2 = giro de 360°),
    cdr = × recuperación, hits = golpes por pulsación, dash = impulso, blink = teletransporte corto (m, − = hacia atrás), fx = efecto extra, ranged = flecha/proyectil. */
const M = (id, name, seq, o = {}) => ({ id, name, seq, evo: 0, w: 'l', dmg: 1, rng: 1, arc: 1, cdr: 1, hits: 1, kind: 'light', ...o });
export const COMBO_SETS = {
  axioma: [   // armadura: 3 golpes y onda en el 3.º; más abajo, hombro, martillazo, tormenta de acero y ruptura
    M('tajo', 'Tajo de coraza', ['a1']),
    M('contratajo', 'Contratajo', ['a1', 'a1'], { dmg: 1.1 }),
    M('onda_coraza', 'Golpe de armadura', ['a1', 'a1', 'a1'], { dmg: 1.7, cdr: 1.6, kind: 'heavy', fx: 'onda' }),
    M('punio', 'Puñetazo blindado', ['a2'], { w: 'h', kind: 'heavy', cdr: 1 }),
    M('hombro', 'Embestida de hombro', ['a1', 'a2'], { evo: 1, w: 'h', dmg: 1.1, dash: 12, kind: 'lunge', cdr: 0.8 }),
    M('martillazo', 'Martillazo caído', ['a1', 'a1', 'a2'], { evo: 2, w: 'h', dmg: 1.3, fx: 'sismo', kind: 'air', arc: 2 }),
    M('tormenta', 'Tormenta de acero', ['a1', 'a1', 'a1', 'a1'], { evo: 3, dmg: 0.9, hits: 2, arc: 2, kind: 'spin', cdr: 1.4 }),
    M('ruptura', 'Ruptura de baluarte', ['a1', 'a1', 'a1', 'a2'], { evo: 4, w: 'h', dmg: 2.2, fx: 'sismo+onda', kind: 'air', arc: 2, cdr: 1.5 }),
  ],
  vesper: [   // garras rápidas, saltos y embestidas
    M('zarpa', 'Zarpa doble', ['a1'], { dmg: 0.6, hits: 2 }),
    M('rafaga', 'Ráfaga de garras', ['a1', 'a1'], { dmg: 0.5, hits: 3, cdr: 1.1 }),
    M('desgarro', 'Desgarro en carrera', ['a1', 'a1', 'a1'], { dmg: 0.75, hits: 2, dash: 6, kind: 'lunge', cdr: 1.3 }),
    M('salto', 'Salto de caza', ['a2'], { w: 'h', dmg: 1.05, dash: 14, jump: 9, kind: 'lunge', cdr: 0.9 }),
    M('embestida', 'Embestida depredadora', ['a1', 'a2'], { evo: 1, w: 'h', dmg: 1.4, dash: 18, fx: 'marca', kind: 'lunge', cdr: 0.9 }),
    M('torbellino', 'Torbellino de garras', ['a1', 'a1', 'a2'], { evo: 2, dmg: 0.6, hits: 3, arc: 2, kind: 'spin', cdr: 1.3 }),
    M('infinita', 'Ráfaga infinita', ['a1', 'a1', 'a1', 'a1'], { evo: 3, dmg: 0.5, hits: 4, dash: 4, cdr: 1.3 }),
    M('ejecucion', 'Ejecución de cazadora', ['a1', 'a1', 'a1', 'a2'], { evo: 4, w: 'h', dmg: 2.3, dash: 20, fx: 'marca', kind: 'lunge', cdr: 1.4 }),
  ],
  micelio: [  // puños pesados de área y raíces
    M('golpe', 'Golpe de raíz', ['a1'], { arc: 1.2 }),
    M('doble', 'Doble puño', ['a1', 'a1'], { dmg: 1.15, arc: 1.2 }),
    M('raices', 'Brotes de raíz', ['a1', 'a1', 'a1'], { w: 'h', dmg: 1.4, fx: 'raices', kind: 'heavy', cdr: 1.1 }),
    M('aplasta', 'Aplastamiento', ['a2'], { w: 'h', dmg: 1.15, fx: 'sismo', kind: 'heavy', arc: 1.4 }),
    M('brote', 'Brote en círculo', ['a1', 'a2'], { evo: 1, dmg: 1.2, arc: 2, fx: 'raices', kind: 'spin', cdr: 1.2 }),
    M('muro', 'Muro de raíces', ['a1', 'a1', 'a2'], { evo: 2, w: 'h', dmg: 1.4, fx: 'raices+onda', kind: 'heavy', cdr: 1.2 }),
    M('terremoto', 'Terremoto', ['a2', 'a2'], { evo: 3, w: 'h', dmg: 1.8, fx: 'sismo', big: true, arc: 2, kind: 'air', cdr: 1.3 }),
    M('floracion', 'Floración', ['a1', 'a1', 'a1', 'a2'], { evo: 4, w: 'h', dmg: 2.0, arc: 2, fx: 'raices+sismo+cura', big: true, kind: 'air', cdr: 1.5 }),
  ],
  umbra: [    // cortes dimensionales con teletransporte corto
    M('corte', 'Corte dimensional', ['a1'], { dmg: 1.0 }),
    M('doble_corte', 'Doble corte', ['a1', 'a1'], { dmg: 1.05, blink: 3 }),
    M('cruce', 'Cruce de planos', ['a1', 'a1', 'a1'], { dmg: 1.5, blink: 7, line: true, cdr: 1.4, kind: 'lunge' }),
    M('vacio', 'Tajo del vacío', ['a2'], { w: 'h', dmg: 1.1, rng: 1.25, kind: 'heavy' }),
    M('paso_cortante', 'Paso cortante', ['a1', 'a2'], { evo: 1, w: 'h', dmg: 1.3, blink: 5, line: true, kind: 'lunge', cdr: 0.9 }),
    M('desgarro_dim', 'Desgarro dimensional', ['a1', 'a1', 'a2'], { evo: 2, w: 'h', dmg: 1.4, arc: 2, fx: 'pull', kind: 'spin', cdr: 1.2 }),
    M('eco', 'Eco del vacío', ['a2', 'a1'], { evo: 3, dmg: 1.0, hits: 2, blink: -4, fx: 'desfase', cdr: 0.9 }),
    M('eclipse_cuchillas', 'Eclipse de cuchillas', ['a1', 'a1', 'a1', 'a2'], { evo: 4, w: 'h', dmg: 0.9, hits: 3, blink: 9, line: true, kind: 'lunge', cdr: 1.5 }),
  ],
  seraf: [    // melé-rango: flechas de luz (A2 se CARGA manteniendo)
    M('flecha', 'Flecha de luz', ['a1'], { ranged: true, dmg: 0.95, rng: 9 }),
    M('doble_flecha', 'Flecha doble', ['a1', 'a1'], { ranged: true, dmg: 0.8, hits: 2, rng: 9, cdr: 1.05 }),
    M('salva', 'Salva de luz', ['a1', 'a1', 'a1'], { ranged: true, dmg: 0.8, hits: 3, rng: 9, cdr: 1.5, fan: 0.1 }),
    M('cargada', 'Flecha cargada', ['a2'], { ranged: true, w: 'h', dmg: 1.4, rng: 14, pierce: true, charge: true, kind: 'heavy' }),
    M('rematadora', 'Flecha rematadora', ['a1', 'a2'], { evo: 1, ranged: true, w: 'h', dmg: 1.7, rng: 14, pierce: true, fx: 'marca', kind: 'heavy' }),
    M('sanadora', 'Flecha sanadora', ['a1', 'a1', 'a2'], { evo: 2, ranged: true, w: 'h', dmg: 1.4, rng: 14, pierce: true, fx: 'cura', kind: 'heavy' }),
    M('doble_tension', 'Doble tensión', ['a2', 'a2'], { evo: 3, ranged: true, w: 'h', dmg: 1.2, hits: 2, rng: 14, pierce: true, fan: 0.06, cdr: 1.1 }),
    M('lluvia', 'Lluvia de luz', ['a1', 'a1', 'a1', 'a2'], { evo: 4, ranged: true, dmg: 0.85, hits: 7, rng: 9, fan: 0.07, cdr: 1.8 }),
  ],
  danzante: [ // duelista: pasos rápidos, paradas y réplicas. Cada golpe pulsado A TIEMPO suma compás (src/sim/danzante.js): más daño, recuperaciones cortas y cadenas más largas
    M('paso', 'Paso de vals', ['a1'], { dmg: 0.85, arc: 1.2 }),
    M('giro', 'Giro de cinta', ['a1', 'a1'], { dmg: 0.62, hits: 2, arc: 1.5, cdr: 0.95 }),
    M('floreo', 'Floreo', ['a1', 'a1', 'a1'], { dmg: 1.3, blink: 2.5, line: true, kind: 'lunge', cdr: 1.25 }),
    M('parada', 'Parada y réplica', ['a2'], { w: 'h', dmg: 1.1, fx: 'parada', kind: 'heavy', cdr: 0.85 }),
    M('quiebre', 'Quiebre de cintura', ['a1', 'a2'], { evo: 1, w: 'h', dmg: 1.3, blink: -3, fx: 'esquiva', kind: 'lunge', cdr: 0.85 }),
    M('contracompas', 'Contracompás', ['a1', 'a1', 'a2'], { evo: 2, w: 'h', dmg: 1.2, arc: 2, fx: 'parada', kind: 'spin', cdr: 1.1 }),
    M('vals_huesos', 'Vals de huesos', ['a2', 'a1'], { evo: 3, dmg: 0.55, hits: 3, dash: 5, fx: 'esquiva', cdr: 1 }),
    M('gran_final', 'Gran final de carnaval', ['a1', 'a1', 'a1', 'a2'], { evo: 4, w: 'h', dmg: 1.9, fx: 'onda', arc: 2, kind: 'air', cdr: 1.5 }),
  ],
  singular: [ // control de gravedad / área: ARRASTRA a las criaturas hacia vos y las aplasta; sus golpes dejan pozos chicos y sueltan los satélites (src/sim/singular.js)
    M('roce', 'Roce orbital', ['a1'], { arc: 1.35 }),
    M('arrastre', 'Arrastre', ['a1', 'a1'], { dmg: 1.05, arc: 1.5, fx: 'atrae', cdr: 1.05 }),
    M('compresion', 'Compresión', ['a1', 'a1', 'a1'], { w: 'h', dmg: 1.35, fx: 'atrae+pozo', kind: 'heavy', cdr: 1.4 }),
    M('cuasar', 'Pulso de cuásar', ['a2'], { w: 'h', dmg: 1.1, rng: 1.2, arc: 1.6, fx: 'atrae', kind: 'heavy' }),
    M('doble_polo', 'Doble polo', ['a1', 'a2'], { evo: 1, w: 'h', dmg: 1.2, arc: 2, fx: 'atrae', kind: 'spin', cdr: 1.1 }),
    M('meteoros', 'Lluvia de meteoros', ['a1', 'a1', 'a2'], { evo: 2, w: 'h', dmg: 1.3, arc: 2, fx: 'orbita', kind: 'air', cdr: 1.25 }),
    M('acrecion', 'Disco de acreción', ['a2', 'a2'], { evo: 3, w: 'h', dmg: 1.7, arc: 2, fx: 'atrae+pozo', big: true, kind: 'spin', cdr: 1.3 }),
    M('colapso_estelar', 'Colapso estelar', ['a1', 'a1', 'a1', 'a2'], { evo: 4, w: 'h', dmg: 2.2, arc: 2, fx: 'atrae+orbita+pozo', big: true, kind: 'air', cdr: 1.5 }),
  ],
};
/** Ajuste fino de daño por Huésped para que el Combo rinda como el Melé (tests/combos.test.js: tiempos dentro de ±30 %). */
export const COMBO_TUNE = { axioma: 1, vesper: 0.5, micelio: 0.65, umbra: 0.8, seraf: 0.7, danzante: 0.85, singular: 0.62 };
/** Seraf carga su A2: la flecha sale al soltar (daño ×1 a ×2 según el tiempo). */
export const COMBO_CHARGE = { seraf: true };
/* COLMENA (invocador): se registra aparte para no pisar las líneas de los demás Huéspedes. Datos en colmena-data.js, lógica en enjambre.js. */
NATIVE_MELEE.colmena = COLMENA.native; MELEE_AFFINITY.colmena = COLMENA.affinity;
COMBO_SETS.colmena = COLMENA.combo; HABILIDADES.colmena = COLMENA.hab; COMBO_TUNE.colmena = COLMENA.tune;
/** Caminos de evolución de un Huésped: los propios (`CHARACTERS[id].evoPaths`, p. ej. Colmena) o los comunes de EVO_PATHS. */
export const evoPathsFor = (char) => (CHARACTERS[char] && CHARACTERS[char].evoPaths) || EVO_PATHS;

/* Afijos de élite (desde la oleada 3): cada élite lleva UNO, visible (halo + nombre). */
export const AFFIXES = {
  blindado:   { name: 'Blindado',   color: 0xb0c4de, desc: 'Recibe 40 % menos de daño.' },
  veloz:      { name: 'Veloz',      color: 0xffe066, desc: 'Se mueve un 35 % más rápido.' },
  vampirico:  { name: 'Vampírico',  color: 0xff5a6e, desc: 'Cura vida al morder.' },
  explosivo:  { name: 'Explosivo',  color: 0xff9a3c, desc: 'Estalla al morir.' },
  espectral:  { name: 'Espectral',  color: 0xb07bff, desc: 'Cada 4 s se vuelve intangible 1,2 s.' },
  llorón:     { name: 'Llorón',     color: 0x7ae8ff, desc: 'Invoca ánimas al recibir daño.' },
};
export const AFFIX_IDS = Object.keys(AFFIXES);
/* Linajes de armas: un arma a nivel 3 de mejora, con mutación y un órgano, asciende a UNA de dos formas finales (excluyentes). */
export const LINEAGE = {
  req: { lvl: 3 },
  forms: {
    alba:   { name: 'del Alba',  desc: 'Luz: +25 % de daño y cada impacto crítico o 5.º disparo cura 4 de vida.', color: 0xffe9a0 },
    ocaso:  { name: 'del Ocaso', desc: 'Sombra: +40 % de cadencia y los impactos marcan a la criatura (+15 % de daño de todo).', color: 0x8a5bff },
  },
};
export const CORES = { perCost: 1.2, eliteMul: 2, wave: 6, objective: 30, boss: 100 };


/* ───────── EVOLUCIÓN ORGÁNICA: al derrotar criaturas se absorben ESENCIAS; con ellas crecen ÓRGANOS en las armas (3 por arma) y en el campeón (1 + su nivel de evolución).
   Cada órgano cambia cómo se juega Y cómo se ve (`vis` = etiqueta para el modelo). Un órgano por grupo en cada arma: hay que elegir. ───────── */
export const ESSENCES = { carne: { name: 'Carne viva', color: 0xff5a6e }, cristal: { name: 'Cristal vivo', color: 0x66f0ff }, ojo: { name: 'Mirada', color: 0xffd45a }, vacio: { name: 'Vacío', color: 0xb07bff } };
export const ESSENCE_OF = { astilla: 'carne', racimo: 'carne', ariete: 'carne', madre: 'carne', geoda: 'cristal', prisma: 'cristal', cuarzo: 'cristal', coloso: 'cristal', lente: 'ojo', obelisco: 'ojo', espejo: 'ojo', aurora: 'ojo', argos: 'ojo', graviton: 'vacio', espiral: 'vacio' };
export const ESS_YIELD = { normal: 1, elite: 3, boss: 12 };
export const WEAPON_ORGAN_SLOTS = 3;
export const WEAPON_ORGANS = {
  glandula_osea:   { name: 'Glándula ósea',        group: 'daño',     cost: { carne: 8 },              vis: 'hueso',    desc: '+20 % de daño: proyectiles de hueso afilado.' },
  corazon_doble:   { name: 'Corazón doble',        group: 'ritmo',    cost: { carne: 12 },             vis: 'corazon',  desc: '+25 % de cadencia: un segundo corazón late en el arma.' },
  ojo_compuesto:   { name: 'Ojo compuesto',        group: 'punteria', cost: { ojo: 10 },               vis: 'ojo',      desc: 'Dispersión mínima y 18 % de críticos (×2,2). Sólo armas de rayo.', only: ['hitscan'] },
  espina_cristal:  { name: 'Espina cristalina',    group: 'impacto',  cost: { cristal: 10 },           vis: 'cristal',  desc: 'Los disparos atraviesan criaturas.' },
  nervio_conductor:{ name: 'Nervio conductor',     group: 'impacto',  cost: { ojo: 6, cristal: 6 },    vis: 'nervio',   desc: 'El daño salta a 2 criaturas cercanas.' },
  saco_gravitatorio:{ name: 'Saco gravitatorio',   group: 'control',  cost: { vacio: 12 },             vis: 'vacio',    desc: 'Cada impacto arrastra levemente a las criaturas cercanas.' },
  vesicula_acida:  { name: 'Vesícula ácida',       group: 'estado',   cost: { carne: 6, cristal: 6 },  vis: 'acido',    desc: 'Los impactos queman (daño con el tiempo).' },
  camara_esporas:  { name: 'Cámara de esporas',    group: 'estado',   cost: { vacio: 6, carne: 6 },    vis: 'espora',   desc: 'Los impactos envenenan.' },
  glandula_vital:  { name: 'Glándula vital',       group: 'estado',   cost: { carne: 14 },             vis: 'vital',    desc: 'Robás un 8 % del daño como vida.' },
  musculo_cargador:{ name: 'Músculo de cargador',  group: 'cargador', cost: { carne: 10 },             vis: 'musculo',  desc: '+40 % de cargador y recarga más rápida.' },
};
export const CHAMP_ORGANS = {
  placas:      { name: 'Placas quitinosas',   cost: { cristal: 10 },           vis: 'placas',    desc: '12 % menos de daño recibido: placas que crecen del cuerpo.' },
  adrenal:     { name: 'Glándula adrenal',    cost: { carne: 10 },             vis: 'adrenal',   desc: '+8 % de velocidad y habilidades 8 % más rápidas.' },
  ojo_extra:   { name: 'Tercer ojo',          cost: { ojo: 10 },               vis: 'ojo',      desc: '+12 % de daño a todo y revela a los camuflados.' },
  saco_g:      { name: 'Saco gravitatorio',   cost: { vacio: 10 },             vis: 'vacio',    desc: 'Saltás un 25 % más alto y la definitiva se recupera un 15 % más rápido.' },
  medula:      { name: 'Médula regenerativa', cost: { carne: 12 },             vis: 'medula',   desc: 'Regenerás 1,5 de vida por segundo si llevás 3 s sin recibir daño.' },
  tentaculo:   { name: 'Tentáculo prensil',   cost: { carne: 6, ojo: 6 },      vis: 'tentaculo', desc: 'Melee con +20 % de alcance y +10 % de daño.' },
  corazon_cristal:{ name: 'Corazón de cristal', cost: { cristal: 12, vacio: 6 }, vis: 'cristal', desc: 'El escudo se recarga un 50 % más rápido.' },
  espiraculo:  { name: 'Espiráculo',          cost: { vacio: 12 },             vis: 'espiraculo', desc: 'La definitiva dura un 20 % más.' },
};
export const champOrganSlots = (evo) => 1 + (evo || 0);

/* ───────── LOS HUÉSPEDES: organismos biomecánicos jugables (docs/HUESPEDES.md). `host:true` = aparecen primero en la selección.
   Cada uno: arma inicial, melee (ligero/pesado), 3 habilidades (mov = hab. 1, esp = hab. 2, s3 = hab. 3), definitiva (ult), pasiva y stats 0–10. ───────── */
const HOSTS = {
  axioma: { team: 'vanguardia', name: 'Axioma', title: 'El Organismo de Guerra', role: 'asalto', host: true, preset: 'jugador1', seed: null, color: 0x3aa8ff, hp: 1, speed: 1, slots: [2, 5, 3, 4],
    desc: 'Asalto equilibrado. Fusil de proyectiles óseos y cuchillas en los antebrazos. El Huésped inicial: versátil y accesible.',
    story: 'Primer Huésped del proyecto VORTEX: genoma humano reforzado e IA de combate. Su orden de proteger al portador sobrevivió al colapso de la red.',
    stats: { dano: 7, resistencia: 6, movilidad: 6, control: 4, utilidad: 4, dificultad: 2 },
    melee: { light: { dmg: 46, range: 3.6, arc: 0.55, cd: 0.34 }, heavy: { dmg: 130, range: 4.4, arc: 0.45, cd: 0.9, knock: 14 } },
    mov: { id: 'impulso', name: 'Impulso muscular', cd: 6, desc: 'Esquiva y embiste: arrolla lo que toca.' },
    esp: { id: 'espinas', name: 'Descarga de espinas', cd: 8, desc: 'Espinas perforantes en línea recta: atraviesan todo.' },
    s3: { id: 'caparazon', name: 'Caparazón', cd: 16, desc: 'Durante 4 s absorbe el 70 % del daño y refleja parte.' },
    ult: { id: 'sobrecarga', name: 'Sobrecarga Evolutiva', cd: ULT_COOLDOWN.sobrecarga, desc: '10 s: +35 % velocidad, +60 % cadencia, melee más rápido.' },
    passive: { id: 'carnivoro', name: 'Voracidad', desc: 'Cada baja con melee restaura 14 de vida y reduce 1,6 s la espera de la definitiva (límite por uso).' } },
  vesper: { team: 'explorador', name: 'Vesper', title: 'La Depredadora', role: 'asesina', host: true, preset: 'jugador4', seed: null, color: 0xb04bff, hp: 0.78, speed: 1.18, slots: [6, 4, 5, 1],
    desc: 'Asesina de movilidad extrema. Agujas neurotóxicas, garras dobles. Daño explosivo, poca resistencia.',
    story: 'Huésped de infiltración diseñado para recuperar conciencias sin alertar a los custodios. Su IA recuerda rutas que el sistema intentó borrar.',
    stats: { dano: 9, resistencia: 3, movilidad: 10, control: 3, utilidad: 3, dificultad: 7 },
    melee: { light: { dmg: 38, range: 3.4, arc: 0.6, cd: 0.26 }, heavy: { dmg: 110, range: 4, arc: 0.5, cd: 0.7, knock: 6 } },
    mov: { id: 'paso', name: 'Desplazamiento', cd: 4.5, desc: 'Teletransporte instantáneo de corto alcance hacia donde mirás.' },
    esp: { id: 'camuflaje', name: 'Camuflaje refractivo', cd: 14, desc: '5 s casi invisible: las criaturas pierden tu rastro. Atacar lo rompe, con daño extra.' },
    s3: { id: 'marca', name: 'Marca biológica', cd: 10, desc: 'Marca al enemigo apuntado: recibe +40 % de daño 8 s.' },
    ult: { id: 'frenesi', name: 'Frenesí Depredador', cd: ULT_COOLDOWN.frenesi, desc: '8 s: cada baja reinicia el desplazamiento y salta a la siguiente víctima marcada.' },
    passive: { id: 'desprevenido', name: 'Presa distraída', desc: '+50 % de daño a criaturas que no te están mirando o que no te han detectado.' } },
  micelio: { team: 'vanguardia', name: 'Micelio', title: 'El Devorador', role: 'tanque', host: true, preset: 'jugador2', seed: null, color: 0x7be03a, hp: 1.7, speed: 0.86, slots: [3, 10, 17, 20],
    desc: 'Tanque y control territorial. Cañón de esporas y puños sísmicos. Absorbe castigo y domina oleadas.',
    story: 'Huésped de rescate: tejido humano y micelio sintético comparten una IA de protección. Conserva vidas que la red había marcado como pérdidas.',
    stats: { dano: 5, resistencia: 10, movilidad: 3, control: 8, utilidad: 6, dificultad: 4 },
    melee: { light: { dmg: 58, range: 3.8, arc: 0.7, cd: 0.5 }, heavy: { dmg: 170, range: 5, arc: 0.8, cd: 1.1, knock: 22 } },
    mov: { id: 'barrera', name: 'Barrera orgánica', cd: 12, desc: 'Hace crecer un muro vivo delante de vos: bloquea balas y criaturas.' },
    esp: { id: 'esporas', name: 'Nube de esporas', cd: 11, desc: 'Nube que ralentiza y envenena durante 6 s.' },
    s3: { id: 'biomasa', name: 'Absorción de biomasa', cd: 15, desc: 'Absorbe a las criaturas cercanas: cura según cuántas haya.' },
    ult: { id: 'floracion', name: 'Floración Total', cd: ULT_COOLDOWN.floracion, desc: '12 s: el terreno a tu alrededor se vuelve hostil (daño, lentitud) y vos regenerás.' },
    passive: { id: 'callo', name: 'Callo acumulativo', desc: 'Cada golpe recibido da +4 % de resistencia (hasta 40 %) que se disipa en 6 s.' } },
  umbra: { team: 'ingeniero', name: 'Umbra', title: 'El Errante del Vacío', role: 'control', host: true, preset: null, seed: 'umbra-3', color: 0xb98cff, hp: 0.95, speed: 1.02, slots: [8, 10, 9, 6],
    desc: 'Control dimensional. Rifle de distorsión y hoja que atraviesa defensas. Usa el escenario como arma.',
    story: 'Prototipo de enlace temporal. Su IA desincroniza brevemente el cuerpo respecto de VORTEX para atravesar amenazas y ralentizar defensas.',
    stats: { dano: 6, resistencia: 5, movilidad: 7, control: 10, utilidad: 8, dificultad: 9 },
    melee: { light: { dmg: 32, range: 3.8, arc: 0.5, cd: 0.4, pierce: true }, heavy: { dmg: 95, range: 4.6, arc: 0.4, cd: 0.95, pierce: true } },
    mov: { id: 'fase', name: 'Fase', cd: 8, desc: 'Salto hacia atrás con 1 s de invulnerabilidad (pasiva: menos daño al desplazarte).' },
    esp: { id: 'singularidad', name: 'Campo gravitatorio', cd: 14, desc: 'Un agujero que agrupa criaturas y estalla.' },
    s3: { id: 'tiempo', name: 'Distorsión temporal', cd: 18, desc: 'Burbuja de 5 s donde las criaturas se mueven al 25 %.' },
    ult: { id: 'colapso', name: 'Colapso del Umbral', cd: ULT_COOLDOWN.colapso, desc: 'Singularidad grande de 6 s: arrastra, daña y detiene el tiempo local.' },
    passive: { id: 'desfase', name: 'Desfase', desc: '-35 % de daño recibido durante 2 s después de usar Fase o un desplazamiento.' },
    unlock: { precio: 500 }, starter: false },   // se compra en la Tienda (docs/TIENDA.md); quien ya la usaba conserva el acceso (migración en perfil.js)
  seraf: { team: 'soporte', name: 'Seraf', title: 'La Simbiosis Prohibida', role: 'híbrido', host: true, preset: 'jugador3', seed: null, color: 0xffd45a, hp: 0.92, speed: 1.06, slots: [9, 11, 7, 20],
    desc: 'Híbrido de apoyo, daño y evolución. Emisor biológico y látigo extensible. El más técnico y espectacular.',
    story: 'Huésped médico cuya IA convirtió herramientas de reparación genética en armas. Curar y combatir usan la misma energía.',
    stats: { dano: 6, resistencia: 5, movilidad: 6, control: 6, utilidad: 10, dificultad: 8 },
    melee: { light: { dmg: 40, range: 6.5, arc: 0.28, cd: 0.4 }, heavy: { dmg: 115, range: 8, arc: 0.22, cd: 0.95, knock: -10 } },
    mov: { id: 'planeo', name: 'Alas membranosas', cd: 7, desc: 'Impulso aéreo con planeo: casi no caés durante 2 s.' },
    esp: { id: 'pulso', name: 'Pulso vital', cd: 9, desc: 'Daña a las criaturas alrededor y te devuelve vida y reduce hasta 3 s la espera de la definitiva.' },
    s3: { id: 'simbionte', name: 'Simbionte', cd: 20, desc: 'Invoca un organismo aliado 10 s que ataca y distrae.' },
    ult: { id: 'metamorfosis', name: 'Metamorfosis', cd: ULT_COOLDOWN.metamorfosis, desc: '12 s: forma alada. Tus disparos perforan y curan, el látigo ataca en área.' },
    passive: { id: 'adaptacion', name: 'Adaptación', desc: 'Cada tipo de criatura que eliminás (hasta 5) da +2 % de daño contra ese tipo.' },
    unlock: { precio: 500 }, starter: false },   // se compra en la Tienda (docs/TIENDA.md); quien ya la usaba conserva el acceso (migración en perfil.js)
  danzante: { team: 'explorador', name: 'Danzante', title: 'La Memoria del Movimiento', role: 'duelista', host: true, preset: 'jugador4', seed: null, color: 0xff3fa0, hp: 0.84, speed: 1.15, slots: [5, 22, 21, 6],
    desc: 'Duelista acrobático de contraataque. Estoque de listones, esquivas y paradas perfectas que devuelven el golpe. Frágil si baila mal, letal si baila a tiempo.',
    story: 'Su IA aprendió movimientos de archivos de danza humana. Este cuerpo convierte memoria muscular en defensa: anticipar, desviar y responder.',
    stats: { dano: 7, resistencia: 3, movilidad: 9, control: 5, utilidad: 4, dificultad: 9 },
    melee: { light: { dmg: 34, range: 3.4, arc: 0.6, cd: 0.24 }, heavy: { dmg: 96, range: 4.0, arc: 0.5, cd: 0.62, knock: 8 } },
    mov: { id: 'pirueta', name: 'Pirueta', cd: 4.2, desc: 'Te deslizás hacia donde te movés (o atrás). Durante 0,34 s estás en ESQUIVA PERFECTA: lo que te golpee se anula y se devuelve (como la Parada). Si nada te toca, vuelve enseguida.' },
    esp: { id: 'parada', name: 'Parada perfecta', cd: 7, desc: 'Ventana de 0,4 s: el primer golpe que recibas se anula por completo, se devuelve ×3 en área y quedás en Réplica (+35 % de daño 4 s). Si fallás, recarga en la mitad.' },
    s3: { id: 'cintas', name: 'Lazo de cintas', cd: 13, desc: 'Lanza listones en abanico: dañan, enredan (lentitud 3 s), arrastran hacia vos y marcan (+20 % de daño) hasta a 6 criaturas.' },
    ult: { id: 'danza', name: 'Danza Macabra', cd: ULT_COOLDOWN.danza, desc: '10 s: +25 % de velocidad, un remolino de cintas daña a todo lo cercano y CADA golpe que recibís se para solo (una vez cada 0,7 s), con réplica.' },
    passive: { id: 'contratiempo', name: 'Contratiempo', desc: 'Cada parada o esquiva perfecta te da Réplica (+35 % de daño 4 s) y 2 s menos de espera de la definitiva (límite por uso). En Combo, además, los golpes pulsados A TIEMPO suman compás.' },
    unlock: { precio: 600 }, starter: false },   // se compra en la tienda (núcleos); `req` (condición opcional) lo define la tienda si hace falta
  singular: { team: 'ingeniero', name: 'Singular', title: 'El Núcleo Gravitatorio', role: 'gravedad', host: true, preset: null, seed: 'singular-8', color: 0xb26bff, hp: 1.15, speed: 0.95, slots: [10, 11, 3, 8],
    desc: 'Control de gravedad y de área. Abre pozos que arrastran a las hordas, lanza satélites de roca que giran a tu alrededor y la Marea de Gravedad no le hace nada: la usa a favor.',
    story: 'Huésped experimental conectado al simulador gravitatorio de VORTEX. Su IA agrupa amenazas y modifica sus órbitas para proteger al portador.',
    stats: { dano: 5, resistencia: 6, movilidad: 4, control: 10, utilidad: 7, dificultad: 7 },
    extra: { name: 'Órbita', desc: 'Tres satélites de roca estelar giran a tu alrededor y golpean a todo lo que cruzan (cada nivel de evolución los hace más fuertes). Con Coraza, además, frenan los proyectiles enemigos.' },
    melee: { light: { dmg: 38, range: 3.8, arc: 0.6, cd: 0.4, knock: -5 }, heavy: { dmg: 110, range: 4.8, arc: 0.7, cd: 1.0, knock: -14 } },
    mov: { id: 'honda', name: 'Honda gravitatoria', cd: 7, desc: 'Rodeás tu pozo más cercano y salís disparado por la tangente (y le das cuerda). Sin pozo, pegás un salto corto y dejás uno chico detrás.' },
    esp: { id: 'pozo', name: 'Pozo gravitatorio', cd: 9, desc: 'Abrís un pozo donde mirás (hasta 3 a la vez): 6 s tirando de las criaturas hacia el centro, aplastándolas y comiéndose los proyectiles; al cerrarse implosiona.' },
    s3: { id: 'reflujo', name: 'Reflujo de marea', cd: 14, desc: 'Tus pozos se dan vuelta y escupen: empujan hacia afuera con fuerza, dañan y frenan a todo lo cercano. Sin pozos, es una onda a tu alrededor.' },
    ult: { id: 'supernova', name: 'Supernova', cd: ULT_COOLDOWN.supernova, desc: '9 s: tus pozos se funden en uno enorme que te sigue y lleva a todos a órbita; tus satélites se duplican, recibís 25 % menos de daño y al final estalla.' },
    passive: { id: 'horizonte', name: 'Horizonte inmóvil', desc: 'La gravedad no se invierte sobre vos (ni en la Marea ni por jefes). Y cuando llega la Marea de Gravedad, tus pozos y tus satélites se hacen un 35 % más fuertes mientras dure.' },
    unlock: { precio: 750, req: { tipo: 'maestria', rango: 3, texto: 'Alcanzá el rango 3 de maestría con cualquier Huésped.' } }, starter: false },   // se compra en la tienda (núcleos); `req` = condición opcional (maestría de cualquier Huésped)
};
HOSTS.colmena = { ...COLMENA.char, evoPaths: COLMENA.paths };   // Colmena: invocadora de enjambre, con sus propios caminos de evolución
for (const [k, v] of Object.entries(HOSTS)) CHARACTERS[k] = { ...(CHARACTERS[k] || {}), ...v };   // umbra extiende al héroe previo
for (const k of Object.keys(CHARACTERS)) if (!CHARACTERS[k].host) CHARACTERS[k].legacy = true;
export const CHARACTER_IDS = Object.keys(CHARACTERS);
export const HOST_IDS = Object.keys(HOSTS);

/* ───────── Mejoras de armas: tras cada oleada se ofrecen 3 tarjetas; cada nivel se ve en el modelo del arma ───────── */
export const UPGRADE_KINDS = {
  dmg:  { name: 'Más daño',          desc: '+22 % de daño por nivel', max: 5 },
  rate: { name: 'Más cadencia',      desc: '+14 % de cadencia por nivel', max: 5 },
  mag:  { name: 'Más munición',      desc: '+30 % de munición máxima y recarga por nivel', max: 4 },
};
export const WEAPON_MODS = {
  perfora:  { name: 'Perforante',  desc: 'Los disparos atraviesan criaturas.' },
  explosiva:{ name: 'Explosiva',   desc: 'Cada impacto explota en área pequeña.' },
  cadena:   { name: 'Cadena',      desc: 'El daño salta a 2 criaturas cercanas.' },
  vampirica:{ name: 'Vampírica',   desc: 'Cada baja te cura 6 de vida.' },
  precision:{ name: 'Ojo de precisión', desc: 'Dispersión mínima y 15 % de golpes críticos (×2,2).' },
  toxica:   { name: 'Glándula tóxica',  desc: 'Cada impacto envenena (daño con el tiempo).' },
};
/* Segundo nivel de la evolución: tras elegir una mutación el arma ofrece DOS ramas excluyentes (elegir una cierra la otra). */
export const WEAPON_MUTS = {
  perfora:   [{ id: 'espina',      name: 'Espina ósea',        desc: 'Atraviesa corazas: +30 % de daño y rompe la defensa de las geodas.' },
              { id: 'aguijon',     name: 'Aguijón',            desc: 'Menos daño pero envenena a todo lo que atraviesa.' }],
  explosiva: [{ id: 'detonante',   name: 'Vesícula detonante', desc: 'Explosión de área casi el doble de grande.' },
              { id: 'implosiva',   name: 'Vesícula implosiva', desc: 'Cada impacto arrastra a las criaturas cercanas hacia el centro.' }],
  cadena:    [{ id: 'sinapsis',    name: 'Sinapsis',           desc: 'El daño salta a 4 criaturas.' },
              { id: 'tormenta',    name: 'Tormenta neural',    desc: 'Salta a 2, pero aturde y ralentiza fuerte.' }],
  vampirica: [{ id: 'simbiosis',   name: 'Simbiosis',          desc: 'Cada baja cura 10 y repone escudo.' },
              { id: 'parasito',    name: 'Parásito',           desc: 'Cada baja devuelve munición del arma.' }],
  precision: [{ id: 'ojo',         name: 'Ojo compuesto',      desc: 'Críticos 30 % de las veces.' },
              { id: 'pulso',       name: 'Pulso certero',      desc: 'Un crítico devuelve la munición gastada y recarga más rápido.' }],
  toxica:    [{ id: 'neurotoxina', name: 'Neurotoxina',        desc: 'Lo envenenado recibe +20 % de daño de todo.' },
              { id: 'plaga',       name: 'Plaga',              desc: 'Lo envenenado contagia a las criaturas cercanas al morir.' }],
};
export const WAVE_SCALE = { hp: 0.08, speed: 0.016, elite: 0.1 }; // por oleada; élites desde la oleada 3

// Bestiario: ALMAS EN PENA y ESPÍRITUS FOLCLÓRICOS del limbo que añoran la vida (docs/BESTIARIO.md). Los ids internos no cambian. `ai` mapea a src/sim/ai.js
export const MONSTERS = {
  astilla:  { name: 'Ánima',    role: 'corredor',    ai: 'runner',    hp: 24,  speed: 12,  r: 1.0, cost: 1,   score: 10,  fly: false },
  geoda:    { name: 'Almamula', role: 'tanque',      ai: 'tank',      hp: 300, speed: 4.6, r: 2.3, cost: 5,   score: 60,  fly: false },
  prisma:   { name: 'Luz Mala', role: 'volador',     ai: 'diver',     hp: 58,  speed: 10,  r: 1.2, cost: 2,   score: 25,  fly: true },
  lente:    { name: 'La Llorona', role: 'a distancia', ai: 'ranged',    hp: 72,  speed: 5.5, r: 1.4, cost: 2.5, score: 35,  fly: false },
  cuarzo:   { name: 'Salamanquera', role: 'invocador',   ai: 'summoner',  hp: 95,  speed: 4.4, r: 1.5, cost: 4,   score: 55,  fly: false },
  espejo:   { name: 'Pombero',  role: 'emboscador',  ai: 'ambusher',  hp: 62,  speed: 8,   r: 1.2, cost: 3,   score: 45,  fly: false },
  racimo:   { name: 'Fuego Fatuo', role: 'explosivo',   ai: 'exploder',  hp: 26,  speed: 13.5, r: 1.1, cost: 1.5, score: 20,  fly: false },
  graviton: { name: 'El Familiar', role: 'control',     ai: 'gravitron', hp: 115, speed: 4,   r: 1.6, cost: 5,   score: 70,  fly: true },
  obelisco: { name: 'La Viuda', role: 'francotirador', ai: 'sniper',    hp: 140, speed: 2.5, r: 1.6, cost: 4,   score: 55,  fly: false },
  aurora:   { name: 'Difunta',  role: 'sanadora',     ai: 'healer',    hp: 90,  speed: 6,   r: 1.3, cost: 4,   score: 60,  fly: true },
  ariete:   { name: 'Lobizón',  role: 'embestidor',   ai: 'charger',   hp: 190, speed: 6.5, r: 1.9, cost: 4,   score: 50,  fly: false },
  espiral:  { name: 'El Silbón', role: 'atractor',     ai: 'attractor', hp: 120, speed: 4,   r: 1.5, cost: 4.5, score: 65,  fly: true },
  // jefes de mapa
  coloso:   { name: 'El Mandinga', role: 'jefe', ai: 'coloso', hp: 3000, speed: 0, r: 7.5, cost: 0, score: 2000, fly: true, boss: true },
  argos:    { name: 'El Basilisco', role: 'jefe', ai: 'argos', hp: 3400, speed: 0, r: 6.5, cost: 0, score: 3000, fly: true, boss: true },
  madre:    { name: 'La Madre de las Ánimas', role: 'jefe', ai: 'madre',  hp: 3200, speed: 0, r: 7.0, cost: 0, score: 2500, fly: true, boss: true },
};

// Qué criaturas se habilitan en cada oleada de cada mapa
export const WAVE_PLANS = {
  m1: [
    ['astilla', 'lente'],
    ['astilla', 'prisma', 'lente'],
    ['astilla', 'prisma', 'racimo', 'lente'],
    ['astilla', 'prisma', 'racimo', 'lente', 'geoda', 'ariete'],
    ['astilla', 'prisma', 'racimo', 'lente', 'geoda', 'ariete', 'espejo', 'cuarzo', 'obelisco'],
    ['astilla', 'prisma', 'racimo', 'lente', 'geoda', 'ariete', 'espejo', 'cuarzo', 'obelisco', 'graviton', 'aurora', 'espiral'],
  ],
  m3: [
    ['astilla', 'prisma'],
    ['astilla', 'prisma', 'lente', 'racimo'],
    ['astilla', 'prisma', 'lente', 'racimo', 'espejo', 'ariete'],
    ['astilla', 'prisma', 'lente', 'racimo', 'espejo', 'ariete', 'obelisco', 'cuarzo'],
    ['astilla', 'prisma', 'lente', 'racimo', 'espejo', 'ariete', 'obelisco', 'cuarzo', 'geoda', 'aurora'],
    ['astilla', 'prisma', 'lente', 'racimo', 'espejo', 'ariete', 'obelisco', 'cuarzo', 'geoda', 'aurora', 'graviton', 'espiral'],
  ],
  m4: [
    ['astilla', 'racimo'],
    ['astilla', 'racimo', 'prisma', 'lente'],
    ['astilla', 'racimo', 'prisma', 'lente', 'espejo', 'ariete'],
    ['astilla', 'racimo', 'prisma', 'lente', 'espejo', 'ariete', 'cuarzo', 'obelisco'],
    ['astilla', 'racimo', 'prisma', 'lente', 'espejo', 'ariete', 'cuarzo', 'obelisco', 'geoda', 'aurora'],
    ['astilla', 'racimo', 'prisma', 'lente', 'espejo', 'ariete', 'cuarzo', 'obelisco', 'geoda', 'aurora', 'graviton', 'espiral'],
  ],
  // Mapas del limbo (5 y 6): cada uno con SU folclore (docs/MAPAS.md, docs/BESTIARIO_LIMBO.md).
  // Plaza de los Ecos (Praga): luces y lamentos de la ciudad — Ánimas, Luz Mala, Fuego Fatuo, Llorona, Pombero, Viuda,
  // Salamanquera (los alquimistas), Lobizón y el Silbón. Jefe: El Mandinga (el pacto del relojero).
  m5: [
    ['astilla', 'prisma'],
    ['astilla', 'prisma', 'racimo', 'lente'],
    ['astilla', 'prisma', 'racimo', 'lente', 'espejo', 'obelisco'],
    ['astilla', 'prisma', 'racimo', 'lente', 'espejo', 'obelisco', 'cuarzo'],
    ['astilla', 'prisma', 'racimo', 'lente', 'espejo', 'obelisco', 'cuarzo', 'ariete'],
    ['astilla', 'prisma', 'racimo', 'lente', 'espejo', 'obelisco', 'cuarzo', 'ariete', 'espiral'],
  ],
  // Osario sin Techo (Sedlec): los huesos que no descansan — Ánimas, Fuego Fatuo, Almamula, Lobizón, Difunta, Salamanquera,
  // el Familiar (perro negro del cementerio) y el Silbón con su saco de huesos. Jefe: El Basilisco.
  m6: [
    ['astilla', 'racimo'],
    ['astilla', 'racimo', 'geoda'],
    ['astilla', 'racimo', 'geoda', 'ariete', 'aurora'],
    ['astilla', 'racimo', 'geoda', 'ariete', 'aurora', 'cuarzo'],
    ['astilla', 'racimo', 'geoda', 'ariete', 'aurora', 'cuarzo', 'graviton'],
    ['astilla', 'racimo', 'geoda', 'ariete', 'aurora', 'cuarzo', 'graviton', 'espiral'],
  ],
  m2: [
    ['astilla', 'racimo', 'lente'],
    ['astilla', 'racimo', 'lente', 'espejo'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco', 'prisma', 'cuarzo', 'ariete'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco', 'prisma', 'cuarzo', 'ariete', 'graviton', 'aurora'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco', 'prisma', 'cuarzo', 'ariete', 'graviton', 'aurora', 'espiral'],
  ],
};
export const BOSS_OF = { m1: 'coloso', m2: 'madre', m3: 'argos', m4: 'argos', m5: 'coloso', m6: 'argos' };

export const PLAYER = { bleed: 25, hp: 100, shield: 100, radius: 0.9, eye: 0.6, speed: 11, dash: 1.7, jump: 11.5, shieldDelay: 3, shieldRate: 35 };

/* ───────── Director: roles, objetivos y fragmentos de historia ───────── */
export const ROLES = {
  vanguardia: { name: 'Vanguardia', ability: 'Cúpula',        cd: 24, desc: 'Escudo de 6 s: destruye proyectiles y reduce 40 % el daño a los de adentro.' },
  soporte:    { name: 'Soporte',    ability: 'Pulso sanador', cd: 20, desc: 'Cura 40 y repone escudo en radio 12; reanima al instante a quien esté a ≤ 4. Reanima en 1,5 s.' },
  ingeniero:  { name: 'Ingeniero',  ability: 'Torreta',       cd: 28, desc: 'Torreta automática 22 s. Deja munición al empezar cada oleada.' },
  explorador: { name: 'Explorador', ability: 'Marca',         cd: 16, desc: 'Marca criaturas en radio 32: +30 % de daño del equipo 9 s; revela camuflados. +8 % velocidad.' },
};
export const ROLE_IDS = Object.keys(ROLES);

// Qué objetivo trae cada oleada (además de sobrevivir). Sintonía/Núcleo/Ancla: ver docs/DISENO_DIRECTOR.md
export const OBJECTIVE_PLAN = {
  m1: { 2: 'ancla', 4: 'sintonia', 5: 'nucleo', 6: 'secuencia' },
  m2: { 2: 'sintonia', 3: 'caza', 4: 'nucleo', 6: 'secuencia' },
  m3: { 2: 'ancla', 3: 'caza', 5: 'nucleo', 6: 'secuencia' },
  m4: { 2: 'cultivo', 3: 'ancla', 5: 'nucleo', 6: 'ancla' }, // 5: si el puente aún no creció, el mapa lo cambia por otro Cultivo
  m5: { 2: 'secuencia', 3: 'ancla', 5: 'nucleo', 6: 'caza' },   // Plaza de los Ecos: núcleo de los Soportales al portal del Reloj
  m6: { 2: 'ancla', 3: 'nucleo', 5: 'secuencia', 6: 'caza' },   // Osario sin Techo: núcleo del brazo oeste al altar
};
export const OBJECTIVE_INFO = {
  secuencia: { title: 'RECONEXIÓN DEL ARCHIVO', desc: 'Seguí la flecha y ocupá cada terminal durante 2 s. Se activan en orden y conservan el progreso.', limit: 150 },
  caza: { title: 'CAZA DEL CUSTODIO', desc: 'Eliminá al custodio marcado. Al caer, sus defensas se apagan y termina la oleada.', limit: 110 },
  ancla:    { title: 'ANCLA DE REALIDAD', desc: 'Quedate dentro del círculo para estabilizar el recuerdo. Defendé el ancla de las criaturas.', limit: 110 },
  sintonia: { title: 'SINTONÍA', desc: 'Pisá todas las placas a la vez durante 3 s. Solo: cada placa queda viva 10 s tras salir.', limit: 110 },
  cultivo:  { title: 'CULTIVO: PUENTE VIVO', desc: 'Alimentá los 3 capullos disparándoles hasta que florezcan: cada uno hace crecer un tramo del puente al Umbral. Las criaturas los roen: defendelos.', limit: 260 },
  nucleo:   { title: 'NÚCLEO DE MEMORIA', desc: 'Acercate al núcleo para recogerlo y llevalo al altar. Mientras lo llevás caminás más lento y no podés disparar.', limit: 150 },
};
// Fragmentos de recuerdo: los cuenta el Heraldo cada vez que se cumple un objetivo (el sentido de la historia)
export const FRAGMENTS = [
  'Registro 1 — VORTEX nació para conservar conciencias humanas. La IA custodio confundió conservar con controlar.',
  'Registro 2 — El genoma define el cuerpo del Huésped; tu memoria define quién lo habita. No son la misma cosa.',
  'Registro 3 — Las criaturas son defensas de la red vestidas con recuerdos y mitos humanos. Reconocer su forma no las vuelve inofensivas.',
  'Registro 4 — El Coloso guarda la clave de identidad. La Madre Geoda controla la salida. Debés vencer a ambos para escapar.',
  'Registro 5 — Las anclas estabilizan recuerdos; las placas reconectan archivos; los núcleos transportan memoria sin borrarla.',
  'Registro 6 — Soy HERALDO, una IA. Puedo guiarte, pero no decidir quién sos. Esa decisión sigue siendo tuya.',
];
export const BOSS_MECH = { shield: 0.05, stagger: 2.5, rayCd: [0, 14, 11, 9], rayT: 4, madreClosed: 0.15 };

/** Ritmo de las criaturas: 1 = velocidad original. Todas (movimiento, ataques y avisos) corren a este ritmo: más tiempo para reaccionar. Los jefes un poco más rápido. */
export const MONSTER_PACE = 0.7, BOSS_PACE = 0.9;

/* ───────── EVENTOS DE OLEADA (src/sim/eventos.js, docs/MUNDO_VIVO.md) ─────────
 * Como máximo UNO por oleada, desde la oleada EVENTO.minOleada, con oleadas normales entre medias.
 * Cada uno avisa EVENTO.aviso segundos antes. La gravedad invertida sólo existe dentro de «Marea de Gravedad». */
export const EVENTO = { minOleada: 3, aviso: 4, prob: 0.7, demoraMin: 6, demoraMax: 13, flipMax: 3.5, flipBloqueo: 20, rampa: 0.6, caidaMax: 16, amortigua: 5, amortiguaCaida: 10 };
export const EVENTOS = {
  marea_gravedad: { icon: '🌀', color: '#8a9bff', dur: 10, name: 'Marea de Gravedad',
    desc: 'El Vórtice respira al revés: el suelo se vuelve techo unos segundos. Es el ÚNICO momento en que los Familiares y los jefes pueden invertir la gravedad.',
    tele: 'Cuenta atrás de 3 segundos en pantalla antes de la inversión; el giro de cámara dura 0,8 s y termina con aterrizaje blando.',
    contra: 'Seguís pudiendo moverte y disparar. Si aguantás la marea, ganás núcleos y un botiquín.' },
  niebla_almas: { icon: '🌫', color: '#9fd6c4', dur: 20, name: 'Niebla de Almas',
    desc: 'Una bruma espesa tapa el mapa: apenas ves lejos. Las criaturas brillan entre la niebla.',
    tele: 'La pantalla se vuelve lechosa y las criaturas ganan un halo de luz.',
    contra: 'Cada baja da +50 % de núcleos mientras dura. Seguí los halos.' },
  lluvia_astillas: { icon: '☄', color: '#ff9a5a', dur: 16, name: 'Lluvia de Astillas',
    desc: 'Esquirlas caen del cielo en círculos marcados en el suelo, cerca de vos.',
    tele: 'Cada impacto muestra un círculo naranja que se llena durante 1,5 s antes de caer.',
    contra: 'Las astillas también hieren a las criaturas: llevalas a la lluvia. Al final, núcleos.' },
  tormenta_ecos: { icon: '⚡', color: '#7feaff', dur: 18, name: 'Tormenta de Ecos',
    desc: 'Rayos caen sobre el punto donde estabas parado. Quedarse quieto es peligroso.',
    tele: 'Un círculo celeste se marca 2 s antes del rayo, siguiendo tu último lugar.',
    contra: 'El rayo hace mucho daño a las criaturas: atraelas al círculo. Al final, núcleos.' },
  eclipse: { icon: '🌑', color: '#b04a7a', dur: 24, name: 'Eclipse',
    desc: 'El cielo se oscurece: aparecen más élites con afijo, más fuertes.',
    tele: 'La pantalla se tiñe de oscuro rojizo.',
    contra: 'Núcleos ×1,8 por baja mientras dura y un bono al final.' },
  marea_sangre: { icon: '🩸', color: '#ff4a5a', dur: 14, name: 'Marea de Sangre',
    desc: 'Una horda veloz de criaturas débiles se lanza sobre vos.',
    tele: 'Pulso rojo en los bordes; las criaturas llegan por tandas rápidas.',
    contra: 'Son frágiles y dan racha de bajas. Al sobrevivir: vida completa y núcleos.' },
  aurora_bendita: { icon: '✨', color: '#ffd45a', dur: 22, name: 'Bendición de la Aurora',
    desc: 'Aparece una zona dorada que cura y da +30 % de daño. Hay que defenderla: las criaturas la apagan.',
    tele: 'Un pilar de luz dorada marca el lugar durante el aviso.',
    contra: 'Quedate dentro: curación continua y más daño. Si la zona sobrevive, núcleos y escudo completo.' },
  silencio: { icon: '🔇', color: '#a8b4c8', dur: 12, name: 'Silencio',
    desc: 'Nadie puede usar habilidades (ni definitiva) mientras dura. El cuerpo a cuerpo pega más fuerte.',
    tele: 'La pantalla se apaga en grises y las habilidades se bloquean.',
    contra: 'Golpes cuerpo a cuerpo ×1,5 y +30 % de núcleos por baja.' },
};
export const EVENTO_IDS = Object.keys(EVENTOS);
/** Pesos por mapa: cada territorio tiene su subconjunto temático (peso 0 / ausente = no aparece ahí). */
export const EVENTOS_MAPA = {
  m1: { marea_gravedad: 4, tormenta_ecos: 2, eclipse: 2, aurora_bendita: 2, marea_sangre: 1 },            // Vacío de Islas: la gravedad rota
  m2: { marea_gravedad: 4, niebla_almas: 2, silencio: 2, lluvia_astillas: 1, eclipse: 1 },                  // Cámara Fractal: su marea de ingravidez ya era esto
  m3: { niebla_almas: 3, silencio: 2, tormenta_ecos: 2, marea_sangre: 2, aurora_bendita: 1 },              // Laberinto Celestial
  m4: { marea_sangre: 3, aurora_bendita: 3, lluvia_astillas: 2, eclipse: 1, niebla_almas: 1 },             // Jardín de Carne
  m5: { tormenta_ecos: 4, silencio: 2, niebla_almas: 2, eclipse: 2, marea_gravedad: 1 },                   // Plaza de los Ecos
  m6: { niebla_almas: 3, eclipse: 3, lluvia_astillas: 3, marea_sangre: 2, marea_gravedad: 1 },             // Osario sin Techo
};

/* ───────── ARENAS VIVAS (src/sim/arenas-vivas.js · src/client/arenas-vivas-fx.js · docs/MUNDO_VIVO.md) ─────────
 * Cada arena (m1…m6) es un ORGANISMO con nombre y folclore propio. Tiene un CORAZÓN (se puede dañar para debilitarlo)
 * y 2 estructuras más; todas tienen DOS CARAS: ayuda (curación / escudo / velocidad / daño extra que hay que reclamar o
 * defender) y amenaza (ataques con aviso en el suelo: se esquivan moviéndose o cubriéndose, o se apagan rompiendo el órgano).
 * Fases (ligadas a la oleada y al tiempo): dormido → despierto → furioso → ofrenda (el respiro entre oleadas).
 * Órganos:  corazon · boca (se alimenta con bajas cerca) · raiz (ataca; se puede romper) · pulmon (nube que sana o envenena) · vena (carril de luz).
 * Ataques:  golpe (círculo donde estabas) · pulso (anillo alrededor del órgano) · barrido (línea) · giro (línea que gira, como una manecilla).
 * Coordenadas en metros, y = 0 es el piso (en m2 se dan ángulos `cand` sobre el cascarón y se elige el primero libre). */
export const ARENA = {
  telMin: 1.2,                                   // ninguna amenaza golpea antes de 1,2 s de aviso (la regla es ≥ 1 s)
  maxTel: 3,                                     // como mucho 3 avisos a la vez en toda la arena
  amen: { dormido: 0, despierto: 0.55, furioso: 1, ofrenda: 0 },     // cuánto ataca el organismo en cada fase (1 = cadencia plena)
  ayuda: { dormido: 0.4, despierto: 1, furioso: 0.75, ofrenda: 1.5 }, // cuánto ayuda en cada fase
  dormidoOla1: 25,                               // en la oleada 1 duerme los primeros 25 s
  furioso: { 1: 1e9, 2: 50, 3: 28, 4: 28, 5: 14, jefe: 8 },          // segundos de oleada para enfurecerse (por oleada; jefe = última)
  zonaDur: 14,                                   // segundos que dura el beneficio de una boca alimentada
  hpPorOla: 0.15,                                // los órganos tienen hp × (0,85 + 0,15 × oleada)
  danioPorOla: 1.2,                              // daño de ataques + 1,2 por oleada
};
export const ARENAS_VIVAS = {
  m1: {
    id: 'corazon_isla', nombre: 'El Corazón de Isla', color: '#19f0ff', color2: '#ff3df2', motivo: 'medusa',
    folclore: 'Las islas flotantes son el cuerpo de una medusa-coral que duerme sobre el vacío. Las Luces Malas son sus larvas y su corazón late bajo la isla central. Si lo herís se enfurece; si peleás cerca de su Linterna, te presta su luz.',
    frases: { despierto: 'El Corazón de Isla despierta', furioso: 'El Corazón de Isla se enfurece: ¡salí del anillo de luz!', ofrenda: 'El Corazón de Isla ofrece su luz: usá la Linterna', roto: 'El Corazón de Isla queda herido y se adormece', renace: 'El Corazón de Isla vuelve a latir' },
    org: [
      { k: 'corazon', id: 'corazon', nombre: 'Corazón de Isla', x: 0, z: -16, h: 3.4, hr: 2.2, hp: 700, atk: { tipo: 'pulso', r: 8, tel: 1.6, dmg: 15, cd: 9, rango: 22 }, info: 'Late sobre la isla central. Dispará para adormecerlo; su anillo de luz avisa 1,6 s antes de estallar.' },
      { k: 'boca', id: 'linterna', nombre: 'Linterna de Luz Mala', x: -15, z: -6, r: 4.6, bene: 'escudo', hambre: 4, info: 'Se alimenta de las bajas que ocurren cerca: al llenarse te da escudo mientras peleás dentro de su luz.' },
      { k: 'vena', id: 'corriente', nombre: 'Corriente de Luz', a: [2, 10], b: [17, 9.5], w: 2.4, bene: 'veloz', info: 'Carril de luz hacia el portal del este: correr por encima te da velocidad.' },
    ],
  },
  m2: {
    id: 'espejo_respira', nombre: 'El Espejo que Respira', color: '#9b5cff', color2: '#ffb52e', motivo: 'iris',
    folclore: 'Dicen que quien se mira demasiado en la Cámara se vuelve eco. El cascarón es un espejo vivo que inspira y exhala: al inspirar abre su corazón, al exhalar suelta una bruma que sana… o que envenena cuando se enfurece.',
    frases: { despierto: 'El Espejo respira: despierta', furioso: 'El Espejo exhala veneno: ¡salí de la bruma!', ofrenda: 'El Espejo respira en calma: la bruma sana', roto: 'El Núcleo de Eco se quiebra: el Espejo se adormece', renace: 'El Núcleo de Eco vuelve a brillar' },
    org: [
      { k: 'corazon', id: 'nucleo', nombre: 'Núcleo de Eco', cand: [[1.15, 4.0], [1.0, 4.6], [1.3, 3.4], [1.2, 5.0]], h: 4.5, hr: 2.4, hp: 800, vuln: 'inspira', info: 'Sólo recibe todo el daño mientras el Fuelle inspira (se abre el espejo); el resto del ciclo se cierra y casi no se lo daña.' },
      { k: 'boca', id: 'iris', nombre: 'Iris de Espejo', cand: [[0.7, 5.3], [0.8, 5.9], [0.6, 4.7], [0.9, 5.6]], r: 5, bene: 'danio', hambre: 4, info: 'Alimentala con bajas cercanas: al abrirse da +25 % de daño a quien pelee dentro de su luz.' },
      { k: 'pulmon', id: 'fuelle', nombre: 'Fuelle de Espejo', cand: [[0.9, 4.5], [0.8, 4.2], [1.0, 5.2], [0.95, 3.9]], r: 11, hr: 1.9, hp: 420, ciclo: 16, inhala: 6, retiene: 2, mal: 'dano', dps: 6.5, info: 'Inspira 6 s, retiene 2 s y exhala 8 s una bruma. Calmo: sana. Furioso: envenena (aviso al retener el aire).' },
    ],
  },
  m3: {
    id: 'garganta', nombre: 'La Garganta del Laberinto', color: '#3dffb8', color2: '#e8fbff', motivo: 'ondas',
    folclore: 'El laberinto canta para que te pierdas. Cada silbido es un hilo que te tira hacia una pared. Dicen que el Silbón dejó aquí su voz y que el Coro la guarda: quien lo alimenta cantando bajas, canta a su favor.',
    frases: { despierto: 'La Garganta del Laberinto despierta', furioso: 'La Garganta silba: ¡cubrite detrás de un muro!', ofrenda: 'El Coro canta a tu favor: curá en su círculo', roto: 'La Siringe se quiebra: la Garganta calla', renace: 'La Siringe vuelve a cantar' },
    org: [
      { k: 'corazon', id: 'siringe', nombre: 'Siringe de Cristal', x: -10, z: 2, h: 4.4, hr: 2.2, hp: 650, info: 'El corazón del canto. Dañarlo calla a la Garganta hasta la próxima oleada.' },
      { k: 'boca', id: 'coro', nombre: 'Coro de Cristal', x: 12, z: 2, r: 5.2, bene: 'cura', hambre: 4, info: 'Se alimenta de bajas cercanas: al llenarse cura a quien esté dentro de su círculo.' },
      { k: 'raiz', id: 'silbido', nombre: 'Silbido de Cristal', x: 0, z: 20, h: 1.4, hr: 1.5, hp: 380, atk: { tipo: 'barrido', largo: 34, w: 3.2, tel: 1.6, dmg: 14, cd: 6, rango: 40 }, info: 'Dispara un haz de sonido en línea recta (aviso de 1,6 s). Los muros del laberinto lo frenan: cubrite o rompelo.' },
    ],
  },
  m4: {
    id: 'madre_raiz', nombre: 'La Madre Raíz', color: '#ff2f5e', color2: '#b6ff2a', motivo: 'corazon',
    folclore: 'El Jardín no es un lugar, es un cuerpo que come y se cura. Sus raíces buscan carne tibia y sus pulmones sueltan esporas: dulces cuando duerme, adormecedoras cuando tiene hambre.',
    frases: { despierto: 'La Madre Raíz despierta', furioso: 'La Madre Raíz tiene hambre: ¡cuidado con las raíces!', ofrenda: 'La Madre Raíz exhala esporas dulces: sanan', roto: 'El Corazón del Jardín se encoge: la Madre Raíz se adormece', renace: 'El Corazón del Jardín vuelve a latir' },
    org: [
      { k: 'corazon', id: 'corazon', nombre: 'Corazón del Jardín', x: 0, z: 0, h: 4.4, hr: 2.4, hp: 800, regen: 0.05, info: 'Crece sobre la grada del Corazón y se regenera rápido: hay que dañarlo seguido.' },
      { k: 'pulmon', id: 'esporas', nombre: 'Pulmón de Esporas', x: -17, z: -12, r: 11, hr: 2.0, hp: 420, ciclo: 14, inhala: 5, retiene: 2, mal: 'lento', dps: 3, info: 'Su bruma verde sana cuando el Jardín está tranquilo. Enfurecido, sus esporas te frenan y te queman un poco.' },
      { k: 'raiz', id: 'zarcillo', nombre: 'Zarcillo Hambriento', x: 15, z: 14, h: 1.6, hr: 1.7, hp: 380, atk: { tipo: 'golpe', r: 3.4, tel: 1.5, dmg: 13, cd: 5.5, rango: 28 }, info: 'Clava una raíz donde estás parado (círculo rojo 1,5 s antes). También daña a las criaturas: llevalas ahí.' },
    ],
  },
  m5: {
    id: 'reloj_hambriento', nombre: 'El Reloj Hambriento', color: '#ffcf4a', color2: '#2f63ff', motivo: 'reloj',
    folclore: 'El relojero firmó un pacto para que el reloj no parara… y el reloj se quedó con hambre de horas. Su péndulo late en la torre, su manecilla barre la plaza desde la fuente y los adoquines de la calle corren hacia donde las horas se acaban.',
    frases: { despierto: 'El Reloj Hambriento despierta', furioso: 'El Reloj Hambriento da la hora: ¡cuidado con la manecilla!', ofrenda: 'El Reloj marca una hora tranquila: usá los adoquines', roto: 'El Péndulo se detiene: el Reloj se adormece', renace: 'El Péndulo vuelve a oscilar' },
    org: [
      { k: 'corazon', id: 'pendulo', nombre: 'Péndulo del Reloj', x: 13, z: -14, h: 4.6, hr: 2.2, hp: 700, atk: { tipo: 'pulso', r: 8, tel: 1.8, dmg: 15, cd: 12, rango: 24 }, info: 'Da la campanada (anillo dorado de 1,8 s). Dañarlo lo detiene hasta la próxima oleada.' },
      { k: 'raiz', id: 'manecilla', nombre: 'Manecilla de la Fuente', x: 0, z: -4, h: 5.6, hr: 1.5, cover: true, hp: 380, atk: { tipo: 'giro', largo: 26, w: 2.6, tel: 1.8, dmg: 14, cd: 11, rango: 34, omega: 0.9, dur: 2, skip: 4.2 }, info: 'Gira como la manecilla de un reloj: la línea azul avisa 1,8 s y después barre. Las coberturas la frenan.' },
      { k: 'vena', id: 'adoquin', nombre: 'Adoquines de Luz', a: [0, 44], b: [0, 19], w: 2.4, bene: 'veloz', info: 'El camino de la Calle a la Plaza: correr por encima te da velocidad.' },
    ],
  },
  m6: {
    id: 'osario_insomne', nombre: 'El Osario Insomne', color: '#efe6c8', color2: '#ff6a14', motivo: 'costilla',
    folclore: 'Los huesos que no descansan se vuelven a armar solos. Dicen que el Corazón Calcificado late bajo el altar y que, aunque lo rompas, vuelve. Sus manos salen del suelo donde alguien se quedó quieto.',
    frases: { despierto: 'El Osario Insomne despierta', furioso: 'El Osario Insomne reclama: ¡no te quedes quieto!', ofrenda: 'El Osario descansa un momento: el Costillar afila tus armas', roto: 'El Corazón Calcificado se parte… pero no descansa', renace: 'El Corazón Calcificado vuelve a latir' },
    org: [
      { k: 'corazon', id: 'calcificado', nombre: 'Corazón Calcificado', x: 0, z: -42.5, h: 4.2, hr: 2.2, hp: 750, revive: 26, atk: { tipo: 'golpe', r: 3.2, tel: 1.5, dmg: 16, cd: 6.5, rango: 44 }, info: 'Late sobre el altar y hace brotar manos de hueso donde estás quieto. Si lo rompés, vuelve a los 26 s.' },
      { k: 'pulmon', id: 'respiradero', nombre: 'Respiradero de Brasas', x: -10.5, z: 17, r: 9, hr: 1.9, hp: 420, ciclo: 16, inhala: 6, retiene: 2, mal: 'dano', dps: 6, info: 'Una grieta que respira ceniza: tibia y sanadora en calma, ardiente cuando el Osario está furioso.' },
      { k: 'vena', id: 'costillar', nombre: 'Costillar', a: [11, 33], b: [11, 13], w: 2.4, bene: 'danio', info: 'Un camino de costillas luminosas por la nave: pasar por encima te da +25 % de daño.' },
    ],
  },
};
