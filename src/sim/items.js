// CATÁLOGO DE OBJETOS (docs/INVENTARIO.md): armas de disparo, armas cuerpo a cuerpo, armadura (cabeza, torso, brazos, piernas) y reliquias.
// Datos puros y deterministas (sin DOM, sin azar, sin perfil). Todo es ORGÁNICO: cada objeto está hecho de un material vivo (hueso, quitina, raíz,
// cristal, carne, espora, vacío) y MADURA al acumular bajas (4 fases: Latente → Despierta → Madura → Plena), subiendo de bono y de aspecto.
//
// Un objeto del catálogo (ITEMS[id]) es la plantilla; lo que se guarda en el inventario es una INSTANCIA { id, q, k }:
//   id = plantilla · q = tirada de calidad 0..1 (±6 % sobre los bonos) · k = bajas acumuladas con el objeto puesto (define la fase de maduración).
// Los efectos viajan a la simulación como `opts.equip` de addPlayer/setLoadout (lista de { s: ranura, id, q, k }); src/sim/items-fx.js los aplica.
import { WEAPONS } from './data.js';
import { ESPECIES } from './flora-data.js';   // la flora de las arenas da materiales vegetales (docs/FLORA.md)

/* ───────── ranuras y tipos ───────── */
export const SLOTS = ['gun', 'melee', 'head', 'torso', 'arms', 'legs', 'relic'];
export const ARMOR_SLOTS = ['head', 'torso', 'arms', 'legs'];
export const SLOT_NAME = { gun: 'Arma de disparo', melee: 'Arma cuerpo a cuerpo', head: 'Cabeza', torso: 'Torso', arms: 'Brazos', legs: 'Piernas', relic: 'Reliquia' };
export const TYPE_OF_SLOT = { gun: 'disparo', melee: 'melee', head: 'armadura', torso: 'armadura', arms: 'armadura', legs: 'armadura', relic: 'reliquia' };
export const TYPE_NAME = { disparo: 'Disparo', melee: 'Cuerpo a cuerpo', armadura: 'Armadura', reliquia: 'Reliquia' };
export const TYPES = ['disparo', 'melee', 'armadura', 'reliquia'];

/* ───────── rarezas ───────── */
export const RARITIES = [
  { id: 'comun', name: 'Común', color: 0xb8c0d8, css: '#b8c0d8', cap: 0.035, total: 0.05, heal: 2, kheal: 0.2, desguace: 6 },
  { id: 'rara', name: 'Rara', color: 0x5ab4ff, css: '#5ab4ff', cap: 0.06, total: 0.09, heal: 4, kheal: 0.4, desguace: 18 },
  { id: 'epica', name: 'Épica', color: 0xc070ff, css: '#c070ff', cap: 0.09, total: 0.15, heal: 7, kheal: 0.7, desguace: 50 },
  { id: 'legendaria', name: 'Legendaria', color: 0xffc23a, css: '#ffc23a', cap: 0.13, total: 0.24, heal: 10, kheal: 1.0, desguace: 140 },
];
export const RARITY_IDX = { comun: 0, rara: 1, epica: 2, legendaria: 3 };

/* ───────── materiales orgánicos: paleta e identidad ───────── */
export const MATERIALS = {
  hueso:   { name: 'Hueso',   color: 0xe6d9bc, dark: 0xb5a482, glow: 0xffcf8a, ess: 'carne',   lema: 'Firme y heredado',  texto: 'Hueso de lo que no descansa: aguanta golpes y se endurece con el uso.' },
  quitina: { name: 'Quitina', color: 0x8a5a2e, dark: 0x4a2c14, glow: 0xff9a3c, ess: 'carne',   lema: 'Caparazón que crece', texto: 'Placas en capas, como un insecto enorme: protege y arma de a poco.' },
  raiz:    { name: 'Raíz',    color: 0x7a5530, dark: 0x3a2a18, glow: 0x9bff4a, ess: 'ojo',     lema: 'Viva y paciente',    texto: 'Madera que todavía respira: se cura sola y echa brotes.' },
  cristal: { name: 'Cristal', color: 0x9fd8ff, dark: 0x4a78b0, glow: 0x19f0ff, ess: 'cristal', lema: 'Resuena y canta',    texto: 'Geoda viva: late con luz fría y amplifica lo que toca.' },
  carne:   { name: 'Carne',   color: 0xb03a48, dark: 0x6a1a28, glow: 0xff5a6e, ess: 'carne',   lema: 'Voraz y cálida',     texto: 'Músculo que no sabe que murió: se alimenta de cada baja.' },
  espora:  { name: 'Espora',  color: 0xa8d94a, dark: 0x4a6a1a, glow: 0xd6ff5a, ess: 'ojo',     lema: 'Se esparce',         texto: 'Hongo y moho luminoso: envenena, siembra y se multiplica.' },
  vacio:   { name: 'Vacío',   color: 0x2a1c46, dark: 0x0e0a1c, glow: 0xb98cff, ess: 'vacio',   lema: 'Hambre sin forma',   texto: 'Materia que no está del todo acá: ligera, rápida y hambrienta.' },
};
export const MATERIAL_IDS = Object.keys(MATERIALS);   // los 7 orgánicos que caen en el botín general
/** MATERIALES VEGETALES (docs/FLORA.md): sólo salen de COSECHAR (USAR) o destruir plantas. Con calidad 0..3 como los demás. Se consultan igual en MATERIALS,
 *  pero MATERIAL_IDS sigue siendo los 7 orgánicos (el botín general, la tienda y los sets no los mezclan). */
export const MATERIALS_FLORA = {
  fibra:       { name: 'Fibra viva',      color: 0x6fbf5a, dark: 0x2f6a2a, glow: 0x9bff7a, ess: 'ojo',     lema: 'Flexible y terca',     texto: 'Hebras de enredadera y zarza: trenzadas aguantan casi cualquier tirón.', flora: true },
  savia:       { name: 'Savia',           color: 0xd9a441, dark: 0x8a5a14, glow: 0xffd45a, ess: 'carne',   lema: 'Dulce y espesa',       texto: 'Sangre de planta: cura, pega y conserva.', flora: true },
  petalo:      { name: 'Pétalo de luz',   color: 0xbff7ff, dark: 0x5aa8c0, glow: 0x19f0ff, ess: 'cristal', lema: 'Luz que se doblega',   texto: 'Pétalos que guardan la luz de las flores curativas.', flora: true },
  resina:      { name: 'Resina',          color: 0xe0a040, dark: 0x7a4a14, glow: 0xff9a3c, ess: 'carne',   lema: 'Pegajosa y paciente',  texto: 'Gotas de árbol viejo: sellan, ralentizan y arden despacio.', flora: true },
  nectar:      { name: 'Néctar',          color: 0xffe08a, dark: 0xb08a2a, glow: 0xffd45a, ess: 'ojo',     lema: 'Un trago de tiempo',   texto: 'Néctar de frutos de eco y de hora: recarga lo que se gastó.', flora: true },
  hoja_espejo: { name: 'Hoja espejo',     color: 0xc8e8ff, dark: 0x6a8ab0, glow: 0x9fd8ff, ess: 'cristal', lema: 'Devuelve lo que recibe', texto: 'Hoja pulida como un espejo: refleja disparos y luz.', flora: true },
  raiz_hierro: { name: 'Raíz-hierro',     color: 0x7a6a58, dark: 0x3a3028, glow: 0xff7a4a, ess: 'carne',   lema: 'Madera que muerde',    texto: 'Raíz de carnívora endurecida como metal: afila y pesa.', flora: true },
  polen:       { name: 'Polen psicodélico', color: 0xd09aff, dark: 0x6a3aa8, glow: 0xb07bff, ess: 'ojo',   lema: 'Aturde y multiplica',  texto: 'Polen de hongos y flores narcóticas: veneno, sueño y semillas.', flora: true },
};
export const FLORA_MAT_IDS = Object.keys(MATERIALS_FLORA);
Object.assign(MATERIALS, MATERIALS_FLORA);
export const TODOS_MAT_IDS = [...MATERIAL_IDS, ...FLORA_MAT_IDS];

/* ───────── maduración ───────── */
export const FASES = ['Latente', 'Despierta', 'Madura', 'Plena'];
/** Bajas con el objeto puesto para llegar a cada fase (las armas cuentan sólo sus bajas; la armadura y las reliquias, todas). */
export const FASE_KILLS = { arma: [0, 18, 60, 160], resto: [0, 25, 90, 240] };
/** Cuánto crecen los bonos con cada fase (multiplica la desviación respecto de 1). */
export const FASE_MUL = [1, 1.06, 1.12, 1.2];

/* ───────── bonos numéricos (mismas claves que p.bn de las bendiciones: src/sim/bendiciones.js → BN_NEUTRO) ───────── */
export const BN_KEYS = ['attackSpeed', 'spd', 'gun', 'melee', 'skill', 'dmgIn', 'ult', 'shield', 'ess', 'cores', 'cd'];
export const ADD_KEYS = ['heal', 'kheal'];
/** Bonos de economía y escudo: pueden ser el doble de grandes que los de combate (no cuentan para la suma de poder de combate). */
export const UTIL_KEYS = ['shield', 'ess', 'cores'];
export const STAT_ES = { attackSpeed: 'Velocidad de ataque', spd: 'Velocidad', gun: 'Daño de disparo', melee: 'Daño cuerpo a cuerpo', skill: 'Daño de habilidades', dmgIn: 'Daño recibido', ult: 'Carga de la definitiva', shield: 'Recarga del escudo', ess: 'Esencias', cores: 'Núcleos', cd: 'Recarga de habilidades', heal: 'Vida entre oleadas', kheal: 'Vida por baja' };
/** Topes del total (con todo puesto y fase Plena): nada se sale de acá aunque se sumen 7 legendarias. */
export const CAPS = { attackSpeed: [0.88, 1.15], spd: [0.92, 1.12], gun: [0.8, 1.05], melee: [0.8, 1.1], skill: [0.8, 1.1], dmgIn: [0.78, 1.1], ult: [0.8, 1.35], shield: [0.8, 1.5], ess: [0.8, 1.4], cores: [0.8, 1.3], cd: [0.8, 1.2], heal: [0, 20], kheal: [0, 2] };

/* ───────── pasivos con condición ─────────  id → { name, txt(v) }. La lógica está en items-fx.js. `f` en el objeto = fase mínima. */
export const PASIVOS = {
  ultimo_aliento: { name: 'Último aliento', txt: (v) => `Con menos del 35 % de vida, +${pc(v)} % de daño.` },
  racha:          { name: 'Racha', txt: (v) => `Cada baja en los últimos 5 s suma +${pc(v)} % de daño (hasta 5 veces).` },
  escudo_pleno:   { name: 'Escudo pleno', txt: (v) => `Con el escudo completo, +${pc(v)} % de daño.` },
  cazador_elite:  { name: 'Cazador de élites', txt: (v) => `+${pc(v)} % de daño a élites y jefes.` },
  espinas:        { name: 'Espinas vivas', txt: (v) => `Al recibir daño devolvés el ${pc(v)} % a las criaturas a 5 m.` },
  savia:          { name: 'Savia', txt: (v) => `Cada baja te cura ${v} de vida.` },
  siembra:        { name: 'Siembra', txt: (v) => `Cada 6.ª baja suelta una nube de esporas de ${v} m de radio.` },
  regen:          { name: 'Regeneración', txt: (v) => `Tras 3 s sin recibir daño recuperás ${v} de vida por segundo.` },
  eco_golpe:      { name: 'Eco', txt: (v) => `Cada 5.º golpe cuerpo a cuerpo pega +${pc(v)} % más fuerte.` },
  fervor:         { name: 'Fervor', txt: (v) => `Cada baja suma ${v} puntos a la definitiva.` },
  presa:          { name: 'Presa marcada', txt: (v) => `El primer golpe a una criatura sana la marca: recibe +${pc(v)} % de daño 4 s.` },
  sombra:         { name: 'Sombra', txt: (v) => `Tras una baja, 2 s con ${pc(v)} % menos de daño recibido.` },
  furia:          { name: 'Furia', txt: (v) => `Con la definitiva activa, +${pc(v)} % de daño.` },
  drenaje:        { name: 'Drenaje', txt: (v) => `Los golpes cuerpo a cuerpo te curan el ${pc(v)} % del daño que hacen.` },
  onda:           { name: 'Onda', txt: (v) => `Cada ${v}.º golpe cuerpo a cuerpo lanza una onda cortante que atraviesa.` },
  verdugo:        { name: 'Verdugo', txt: (v) => `Rematás criaturas con menos del ${pc(v)} % de vida de un golpe.` },
};
function pc(v) { return Math.round(v * 100); }

/* ───────── sinergias (con esencias, órganos, estilos y caminos) ───────── */
export const SYN_TXT = {
  ess:    (s) => `Sinergia: con ${s.n}+ de esencia de ${ESS_ES[s.k]}, ${fxTxt(s.fx)}.`,
  organ:  (s) => `Sinergia: con ${s.n}+ órganos (campeón o armas), ${fxTxt(s.fx)}.`,
  estilo: (s) => `Sinergia: en estilo ${ESTILO_ES[s.k]}, ${fxTxt(s.fx)}.`,
  camino: (s) => `Sinergia: con el camino ${CAMINO_ES[s.k]}, ${fxTxt(s.fx)}.`,
};
const ESS_ES = { carne: 'Carne', cristal: 'Cristal', ojo: 'Mirada', vacio: 'Vacío' };
const ESTILO_ES = { melee: 'Melé', disparo: 'Disparo', habilidad: 'Habilidades', combo: 'Combo' };
const CAMINO_ES = { depredador: 'Depredador', coraza: 'Coraza', velocidad: 'Velocidad', resonancia: 'Resonancia', simbiosis: 'Simbiosis', artilleria: 'Artillería', apoteosis: 'Apoteosis', anomalia: 'Anomalía' };
export function fxTxt(fx) {
  return Object.entries(fx).map(([k, v]) => (ADD_KEYS.includes(k) ? `${STAT_ES[k].toLowerCase()} +${v}` : k === 'dmgIn' ? `${Math.round((1 - v) * 100)} % menos de daño recibido` : `${STAT_ES[k].toLowerCase()} ${v >= 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)} %`)).join(' y ');
}

/* ───────── atajos para escribir el catálogo ───────── */
const M = (id, name, seq, o = {}) => ({ id, name, seq, evo: 0, w: 'l', dmg: 1, rng: 1, arc: 1, cdr: 1, hits: 1, kind: 'light', ...o });
const L = (dmg, range, arc, cd, extra = {}) => ({ dmg, range, arc, cd, ...extra });

/* Tipos de arma propios de los objetos (forma del set de combos; el resto reutiliza COMBO_WEAPON de data.js). */
export const ITEM_COMBO_WEAPON = {
  gemelas: { chain: 5, dmg: 1, cd: 1.75, a1: { rng: 1, arc: 1.1 }, a2: { rng: 1, arc: 1.2 }, fin: 1.15, note: 'Espadas gemelas: dos hojas, cadenas de hasta 5 golpes.' },
  garras:  { chain: 6, dmg: 1.4, cd: 0.88, a1: { rng: 0.95, arc: 1 }, a2: { rng: 1, arc: 1.1 }, note: 'Garras dobles: ráfagas muy rápidas.' },
  baculo:  { chain: 3, dmg: 0.95, cd: 1.05, a1: { rng: 1.2, arc: 1.2 }, a2: { rng: 1.25, arc: 1.4 }, sismo: true, note: 'Cetro de raíz: golpes largos que hacen temblar el suelo.' },
  guadana: { chain: 3, dmg: 1.05, cd: 1, a1: { rng: 1.35, arc: 1.7 }, a2: { rng: 1.35, arc: 2 }, fin: 1.1, note: 'Guadaña: barridos enormes en arco.' },
};
/** Sets de combo propios de un objeto (reemplazan el del Huésped mientras está puesto; mismo formato que COMBO_SETS de data.js). */
export const ITEM_COMBO_SETS = {
  gemelas: [   // Axioma con las dos hojas: cada pulsación pega con las dos; más abajo, tijera, remolino y la danza de acero
    M('tajo_gemelo', 'Tajo gemelo', ['a1'], { dmg: 0.62, hits: 2 }),
    M('cruce_hojas', 'Cruce de hojas', ['a1', 'a1'], { dmg: 0.6, hits: 3, cdr: 1.05 }),
    M('tijera', 'Tijera', ['a1', 'a1', 'a1'], { dmg: 1.1, hits: 2, arc: 2, kind: 'spin', cdr: 1.35 }),
    M('remolino', 'Remolino de acero', ['a2'], { w: 'h', dmg: 1.05, hits: 2, arc: 2, kind: 'spin', cdr: 1 }),
    M('estocada_doble', 'Estocada doble', ['a1', 'a2'], { evo: 0, w: 'h', dmg: 1.15, hits: 2, dash: 12, kind: 'lunge', cdr: 0.85 }),
    M('luna_rota', 'Luna rota', ['a1', 'a1', 'a2'], { evo: 1, w: 'h', dmg: 1.25, hits: 2, fx: 'onda', arc: 1.6, kind: 'heavy', cdr: 1.1 }),
    M('danza_acero', 'Danza de acero', ['a1', 'a1', 'a1', 'a1'], { evo: 3, dmg: 0.62, hits: 4, arc: 2, kind: 'spin', cdr: 1.3 }),
    M('vigilia_ceniza', 'Vigilia y Ceniza', ['a1', 'a1', 'a1', 'a1', 'a2'], { evo: 4, w: 'h', dmg: 2.0, hits: 2, fx: 'sismo+onda', arc: 2, kind: 'air', cdr: 1.5 }),
  ],
};

/* ───────── EL CATÁLOGO ─────────
   Campos: name, type ('disparo'|'melee'|'armadura'|'reliquia'), slot, r (rareza 0..3), mat, lore, st (bonos), pa ([{id, v, f?}]), syn ([{t, k, n, fx}]),
   host (sólo ese Huésped puede equiparlo: ARMAS SIGNATURE), sig (cómo se consigue), g (arma de disparo), m (arma melé), via ('melee'|'gun'|'any'), vis (pista visual). */
const IT = {};
function def(id, name, slot, r, mat, lore, o = {}) { IT[id] = { id, name, slot, type: TYPE_OF_SLOT[slot], r, mat, lore, st: {}, pa: [], syn: [], via: slot === 'gun' ? 'gun' : slot === 'melee' ? 'melee' : 'any', ...o }; }

/* ── armas de disparo: `g.base` = arma de WEAPONS que se usa; dmg/rate/mag multiplican; fx se suma al disparo (pierce, chain, burn, poison, slow, lifesteal, spreadMul, critP) ── */
def('fusil_hueso', 'Carabina de Hueso', 'gun', 0, 'hueso', 'Un fémur ahuecado que escupe esquirlas. Se dispara con el dedo en la médula.', { g: { base: 'pulso', dmg: 1.05, rate: 1, mag: 1.1, fx: {} }, vis: 'hueso' });
def('escupe_quitina', 'Escupe-Quitina', 'gun', 0, 'quitina', 'Cuatro bocas de insecto en una culata: lo que muerde de cerca, lo hace en abanico.', { g: { base: 'prisma', dmg: 1.06, rate: 1.04, mag: 1.1, fx: { spreadMul: 0.85 } }, vis: 'quitina' });
def('arco_raiz', 'Arco de Raíz Viva', 'gun', 1, 'raiz', 'Una raíz tensada que todavía crece. Sus dardos dejan semillas de veneno.', { g: { base: 'dardos', dmg: 1.07, rate: 1.05, mag: 1.15, fx: { poison: 8 } }, pa: [{ id: 'savia', v: 1 }], st: { heal: 2 }, vis: 'raiz' });
def('canon_geoda', 'Cañón de Geoda', 'gun', 1, 'cristal', 'Cristal hueco que dispara su propia luz. Atraviesa a quien esté en fila.', { g: { base: 'lanza', dmg: 1.08, rate: 1.05, mag: 1.2, fx: {} }, pa: [{ id: 'cazador_elite', v: 0.05 }], vis: 'cristal' });
def('lanzaesporas', 'Madre de Esporas', 'gun', 2, 'espora', 'Un hongo del tamaño de un pecho. Cada disparo es una cosecha de veneno.', { g: { base: 'plaga', dmg: 1.12, rate: 1.1, mag: 1.25, fx: { poison: 16, chain: 1 } }, pa: [{ id: 'siembra', v: 4.5 }], syn: [{ t: 'ess', k: 'ojo', n: 8, fx: { gun: 1.05 } }], vis: 'espora' });
def('vena_voraz', 'Fusil Voraz', 'gun', 2, 'carne', 'Una arteria con gatillo: cada impacto le devuelve algo al que dispara.', { g: { base: 'cetro', dmg: 1.12, rate: 1.1, mag: 1.2, fx: { lifesteal: 0.05 } }, pa: [{ id: 'racha', v: 0.02 }], syn: [{ t: 'ess', k: 'carne', n: 8, fx: { kheal: 0.3 } }], vis: 'carne' });
def('susurro_vacio', 'Susurro del Vacío', 'gun', 2, 'vacio', 'No suena. Lo que apunta, deja de estar un instante antes del disparo.', { g: { base: 'requiem', dmg: 1.14, rate: 1.08, mag: 1.15, fx: { critP: 0.12 } }, pa: [{ id: 'verdugo', v: 0.2, f: 2 }], syn: [{ t: 'estilo', k: 'disparo', fx: { gun: 1.05 } }], vis: 'vacio' });
def('tormenta_geodas', 'Tormenta de Geodas', 'gun', 3, 'cristal', 'Nació en la Cámara Fractal cuando un espejo se rompió hacia adentro: dispara relámpagos que se acuerdan unos de otros.', {
  g: { base: 'voltaico', dmg: 1.2, rate: 1.12, mag: 1.3, fx: { chain: 3 } }, st: { gun: 1.03, ult: 1.04 }, pa: [{ id: 'racha', v: 0.02 }, { id: 'fervor', v: 1, f: 1 }, { id: 'furia', v: 0.12, f: 3 }],
  syn: [{ t: 'camino', k: 'artilleria', fx: { gun: 1.05 } }], vis: 'cristal' });
def('arco_aureola', 'Arco de la Aureola Quebrada', 'gun', 3, 'cristal', 'La aureola de Seraf, partida y tensada. Sus flechas de luz atraviesan todo y devuelven un poco de cielo.', {
  host: 'seraf', g: { base: 'aguja', dmg: 1.22, rate: 1.1, mag: 1.3, fx: { lifesteal: 0.05, critP: 0.08 } }, st: { gun: 1.04, ult: 1.05 }, ranged: 1.14,
  pa: [{ id: 'fervor', v: 1 }, { id: 'presa', v: 0.06, f: 1 }, { id: 'verdugo', v: 0.2, f: 3 }], syn: [{ t: 'estilo', k: 'combo', fx: { skill: 1.04 } }, { t: 'camino', k: 'apoteosis', fx: { gun: 1.05 } }],
  sig: { map: 'm6', misiones: 1, texto: 'Vencé al Basilisco en el Osario sin Techo con Seraf habiendo cumplido al menos una misión opcional.' }, vis: 'arco_aureola' });

/* ── armas cuerpo a cuerpo: `m` tiene la forma de MELEE_WEAPONS (type, special, light, heavy) + dual (multiplica el golpe ligero: dos hojas) + exec (umbral de ejecución) + model (src/client/melee-models.js) ── */
def('cuchilla_hueso', 'Cuchilla de Hueso', 'melee', 0, 'hueso', 'Una costilla afilada contra una piedra del osario. Corta, y recuerda a quién.', { m: { type: 'espada', special: 'onda', light: L(40, 3.6, 0.55, 0.34), heavy: L(112, 4.3, 0.5, 0.9, { knock: 9 }), model: 'filo_oseo' }, vis: 'hueso' });
def('hacha_caparazon', 'Hacha de Caparazón', 'melee', 0, 'quitina', 'El escudo de un bicho que ya no lo necesita, con un mango de su propia pata.', { m: { type: 'hacha', special: 'sangrado', light: L(54, 3.5, 0.6, 0.5), heavy: L(150, 4.1, 0.55, 1.05, { knock: 8 }), model: 'hacha_quitina' }, st: { dmgIn: 0.99 }, vis: 'quitina' });
def('maza_raiz', 'Maza de Raíz', 'melee', 1, 'raiz', 'Un nudo de raíces con un puño de tierra dentro. Cada golpe siembra.', { m: { type: 'martillo', special: 'espora', light: L(66, 3.7, 0.7, 0.66), heavy: L(182, 4.4, 0.8, 1.2, { knock: 18 }), model: 'maza_espora' }, pa: [{ id: 'regen', v: 1.2 }], vis: 'raiz' });
def('pica_geoda', 'Pica de Geoda', 'melee', 1, 'cristal', 'Una aguja de cristal que mide dos Huéspedes. La punta canta cuando alcanza.', { m: { type: 'lanza', special: 'linea', light: L(47, 6.6, 0.22, 0.4, { pierce: true }), heavy: L(128, 8.1, 0.2, 0.95, { pierce: true }), model: 'lanza_sinaptica' }, st: { skill: 1.03 }, vis: 'cristal' });
def('aguja_sembradora', 'Aguja Sembradora', 'melee', 1, 'espora', 'Un aguijón de moho con punta de esporas. Pincha, siembra y se va.', { m: { type: 'daga', special: 'veneno', light: L(32, 3.0, 0.6, 0.2), heavy: L(90, 3.4, 0.55, 0.55), model: 'daga_neurotoxica' }, pa: [{ id: 'presa', v: 0.06 }], vis: 'espora' });
def('cercenadora', 'Cercenadora', 'melee', 2, 'carne', 'Una hoja de carne endurecida con dientes de sierra. Come lo que corta.', { m: { type: 'hacha', special: 'rapina', light: L(56, 3.6, 0.62, 0.46), heavy: L(158, 4.2, 0.58, 1.0), model: 'segur_vorax' }, pa: [{ id: 'drenaje', v: 0.06 }, { id: 'racha', v: 0.02, f: 1 }], syn: [{ t: 'estilo', k: 'melee', fx: { melee: 1.05 } }], vis: 'carne' });
def('filo_vacio', 'Filo del Vacío', 'melee', 2, 'vacio', 'Una hoja que sólo existe de un lado. Atraviesa la defensa y la cara que la lleva.', { m: { type: 'espada', special: 'atraviesa', light: L(52, 4.0, 0.52, 0.38, { pierce: true }), heavy: L(140, 4.8, 0.46, 0.92, { pierce: true }), model: 'hoja_umbral' }, st: { spd: 1.02 }, pa: [{ id: 'sombra', v: 0.1 }, { id: 'eco_golpe', v: 0.5, f: 2 }], vis: 'vacio' });
def('yunque_coloso', 'Yunque del Coloso', 'melee', 3, 'cristal', 'Un trozo del Coloso Prismático, todavía caliente. Cuando cae, el suelo se acuerda.', {
  m: { type: 'martillo', special: 'sismo', light: L(78, 3.9, 0.72, 0.68), heavy: L(215, 4.7, 0.82, 1.25, { knock: 26 }), model: 'martillo_sismico' }, st: { melee: 1.05, dmgIn: 0.98 },
  pa: [{ id: 'cazador_elite', v: 0.12 }, { id: 'eco_golpe', v: 0.4, f: 1 }, { id: 'onda', v: 9, f: 3 }], syn: [{ t: 'camino', k: 'coraza', fx: { dmgIn: 0.97 } }], vis: 'cristal' });
def('gemelas_axioma', 'Espadas Gemelas «Vigilia y Ceniza»', 'melee', 3, 'hueso', 'Las dos hojas del Guerrero Caído: una vigila, la otra arde. Se sostienen con las dos manos y pegan con las dos.', {
  host: 'axioma', m: { type: 'gemelas', special: 'onda', dual: 1.5, light: L(29, 3.6, 0.6, 0.22), heavy: L(106, 4.4, 0.6, 0.78, { knock: 9 }), model: 'filo_oseo', combo: 'gemelas' },
  st: { melee: 1.03, spd: 1.02 }, pa: [{ id: 'eco_golpe', v: 0.35 }, { id: 'racha', v: 0.02, f: 1 }, { id: 'onda', v: 14, f: 2 }, { id: 'furia', v: 0.1, f: 3 }],
  syn: [{ t: 'estilo', k: 'combo', fx: { melee: 1.04 } }, { t: 'camino', k: 'coraza', fx: { dmgIn: 0.97 } }],
  sig: { map: 'm1', misiones: 1, texto: 'Vencé al Coloso en el Vacío de Islas con Axioma habiendo cumplido al menos una misión opcional.' }, vis: 'gemelas' });
def('colmillos_luna', 'Colmillos de Luna Hueca', 'melee', 3, 'quitina', 'Dos garras de la Bestia Cazadora, arrancadas de una luna que nunca llegó a salir. Rasgan con las dos manos.', {
  host: 'vesper', m: { type: 'garras', special: 'sangrado', dual: 1.5, light: L(21, 3.0, 0.62, 0.17), heavy: L(80, 3.5, 0.55, 0.52), model: 'colmillo', combo: null },
  st: { melee: 1.04, spd: 1.03 }, pa: [{ id: 'drenaje', v: 0.04 }, { id: 'presa', v: 0.06, f: 1 }, { id: 'racha', v: 0.02, f: 2 }, { id: 'verdugo', v: 0.22, f: 3 }],
  syn: [{ t: 'camino', k: 'depredador', fx: { melee: 1.05 } }, { t: 'estilo', k: 'melee', fx: { spd: 1.02 } }],
  sig: { map: 'm2', misiones: 1, texto: 'Vencé a la Madre de las Ánimas en la Cámara Fractal con Vesper habiendo cumplido al menos una misión opcional.' }, vis: 'garras' });
def('baculo_raiz', 'Cetro de Raíz Madre', 'melee', 3, 'raiz', 'El báculo del Coloso Raíz: una rama que nunca se secó. Donde pega, brota.', {
  host: 'micelio', m: { type: 'baculo', special: 'espora', light: L(57, 4.4, 0.78, 0.62), heavy: L(162, 5.0, 0.9, 1.15, { knock: 20 }), model: 'maza_espora', combo: null },
  st: { melee: 1.04, dmgIn: 0.97 }, pa: [{ id: 'regen', v: 1.8 }, { id: 'siembra', v: 6 }, { id: 'espinas', v: 0.25, f: 2 }, { id: 'savia', v: 2, f: 3 }],
  syn: [{ t: 'ess', k: 'ojo', n: 8, fx: { heal: 4 } }, { t: 'camino', k: 'simbiosis', fx: { melee: 1.05 } }],
  sig: { map: 'm4', misiones: 1, texto: 'Vencé a Argos en el Jardín de Carne con Micelio habiendo cumplido al menos una misión opcional.' }, vis: 'baculo' });
def('guadana_umbra', 'Segadora de Ecos', 'melee', 3, 'vacio', 'La guadaña del Errante: corta el instante en que uno iba a estar. Remata a lo que ya casi no está.', {
  host: 'umbra', m: { type: 'guadana', special: 'atraviesa', exec: 0.28, light: L(32, 5.2, 0.95, 0.4, { pierce: true }), heavy: L(98, 6.0, 1.1, 0.95, { pierce: true, knock: 6 }), model: 'hoja_umbral', combo: null },
  st: { melee: 1.04, cd: 0.97 }, pa: [{ id: 'cazador_elite', v: 0.1 }, { id: 'sombra', v: 0.12, f: 1 }, { id: 'verdugo', v: 0.3, f: 2 }, { id: 'eco_golpe', v: 0.4, f: 3 }],
  syn: [{ t: 'camino', k: 'anomalia', fx: { skill: 1.05 } }, { t: 'ess', k: 'vacio', n: 8, fx: { melee: 1.05 } }],
  sig: { map: 'm5', misiones: 1, texto: 'Vencé al Mandinga en la Plaza de los Ecos con Umbra habiendo cumplido al menos una misión opcional.' }, vis: 'guadana' });

/* ── armadura: 4 ranuras. Cada pieza ocupa su ranura y REEMPLAZA el aspecto base de esa parte del cuerpo (src/client/items-vis.js) ── */
def('casco_hueso', 'Casco de Hueso Lijado', 'head', 0, 'hueso', 'Un cráneo ajeno, vaciado y pulido. Sorprendentemente cómodo.', { st: { dmgIn: 0.99, ult: 1.03 } });
def('yelmo_quitina', 'Yelmo de Quitina', 'head', 1, 'quitina', 'Dos placas de caparazón con un visor entre ellas.', { st: { dmgIn: 0.98, cd: 0.98 } });
def('capucha_raiz', 'Capucha de Raíces', 'head', 1, 'raiz', 'Raíces finas que te cubren la cabeza y se alimentan de lo que perdés.', { st: { heal: 3, ess: 1.05 }, pa: [{ id: 'regen', v: 0.8 }] });
def('corona_cristal', 'Corona de Geoda', 'head', 2, 'cristal', 'Siete puntas de cristal que cantan una nota fría cuando algo muere cerca.', { st: { skill: 1.07, ult: 1.05 }, pa: [{ id: 'fervor', v: 1 }], syn: [{ t: 'estilo', k: 'habilidad', fx: { cd: 0.96 } }] });
def('mascara_vacio', 'Rostro Sin Nombre', 'head', 3, 'vacio', 'La máscara del Errante: no tiene ojos, pero ve cuándo uno va a golpear.', { st: { cd: 0.93, spd: 1.03, skill: 1.05 }, pa: [{ id: 'sombra', v: 0.12 }, { id: 'fervor', v: 1, f: 2 }, { id: 'furia', v: 0.1, f: 3 }], syn: [{ t: 'ess', k: 'vacio', n: 8, fx: { cd: 0.97 } }] });

def('peto_hueso', 'Costillar Prestado', 'torso', 0, 'hueso', 'Un tórax de otro, atado con tendones. Aguanta mejor que uno propio.', { st: { dmgIn: 0.98 } });
def('coraza_quitina', 'Coraza de Caparazón', 'torso', 1, 'quitina', 'Placas superpuestas como un escarabajo: se cierran solas ante el golpe.', { st: { dmgIn: 0.96, shield: 1.08 } });
def('torso_carne', 'Pecho Palpitante', 'torso', 1, 'carne', 'Un pecho que late fuera de sincro con el tuyo y te da su calor.', { st: { heal: 4, kheal: 0.3 }, pa: [{ id: 'savia', v: 1 }] });
def('pulmon_espora', 'Pulmón de Esporas', 'torso', 2, 'espora', 'Respira por vos y exhala esporas cuando algo cae.', { st: { dmgIn: 0.96, shield: 1.1 }, pa: [{ id: 'regen', v: 1.4 }, { id: 'siembra', v: 4.5, f: 1 }], syn: [{ t: 'organ', n: 2, fx: { dmgIn: 0.97 } }] });
def('corazon_coloso', 'Corazón del Coloso', 'torso', 3, 'raiz', 'El corazón de un guardián de raíz: late despacio, pero cuando late, el suelo lo oye.', { st: { dmgIn: 0.93, shield: 1.12, heal: 6 }, pa: [{ id: 'regen', v: 2 }, { id: 'espinas', v: 0.2, f: 1 }, { id: 'ultimo_aliento', v: 0.15, f: 2 }, { id: 'sombra', v: 0.1, f: 3 }], syn: [{ t: 'camino', k: 'coraza', fx: { dmgIn: 0.97 } }] });

def('brazales_hueso', 'Brazales de Hueso', 'arms', 0, 'hueso', 'Dos antebrazos de hueso con las muñecas atadas en cuero.', { st: { melee: 1.03 } });
def('guanteletes_quitina', 'Guanteletes de Quitina', 'arms', 1, 'quitina', 'Garras de escarabajo en cada mano: golpeás con todo el caparazón.', { st: { melee: 1.05, gun: 1.02 } });
def('zarpas_carne', 'Zarpas de Carne', 'arms', 1, 'carne', 'Brazos de carne viva con uñas negras. Se curan mientras desgarran.', { st: { melee: 1.04, kheal: 0.3 } });
def('brazos_cristal', 'Antebrazos de Geoda', 'arms', 2, 'cristal', 'Geodas que brillan al disparar y vibran al golpear.', { st: { gun: 1.07, skill: 1.03 }, pa: [{ id: 'escudo_pleno', v: 0.05 }], syn: [{ t: 'estilo', k: 'disparo', fx: { gun: 1.04 } }] });
def('manos_eco', 'Manos de Eco', 'arms', 3, 'vacio', 'Manos que llegan un poco antes que vos: cada quinto golpe se repite solo.', { st: { melee: 1.05, gun: 1.02 }, pa: [{ id: 'eco_golpe', v: 0.25 }, { id: 'presa', v: 0.05, f: 1 }, { id: 'racha', v: 0.02, f: 2 }, { id: 'drenaje', v: 0.05, f: 3 }], syn: [{ t: 'estilo', k: 'melee', fx: { melee: 1.04 } }] });

def('grebas_hueso', 'Grebas de Hueso', 'legs', 0, 'hueso', 'Tibias atadas por fuera de las propias. Hacen ruido, pero corren.', { st: { spd: 1.02 } });
def('patas_quitina', 'Patas de Quitina', 'legs', 1, 'quitina', 'Cuatro articulaciones de más: el paso se acorta y la zancada se alarga.', { st: { spd: 1.03, dmgIn: 0.99 } });
def('pies_raiz', 'Pies de Raíz', 'legs', 1, 'raiz', 'Raíces que se agarran al suelo y lo sueltan a tiempo.', { st: { spd: 1.02, heal: 3 }, pa: [{ id: 'regen', v: 0.8 }] });
def('zancos_cristal', 'Zancos de Cristal', 'legs', 2, 'cristal', 'Piernas de vidrio de geoda: pesan nada y rebotan en la luz.', { st: { spd: 1.05, cd: 0.97 }, syn: [{ t: 'camino', k: 'velocidad', fx: { spd: 1.02 } }] });
def('pasos_vacio', 'Pasos del Vacío', 'legs', 3, 'vacio', 'Cada paso toca el suelo un poco después de haberlo pisado.', { st: { spd: 1.06, cd: 0.95 }, pa: [{ id: 'sombra', v: 0.1 }, { id: 'racha', v: 0.02, f: 1 }, { id: 'furia', v: 0.1, f: 3 }], syn: [{ t: 'camino', k: 'velocidad', fx: { spd: 1.02 } }] });

/* ── reliquias ── */
def('reliquia_diente', 'Diente de Cazador', 'relic', 0, 'hueso', 'Un colmillo que cuelga de un cordón. Se dice que muerde solo.', { st: { melee: 1.03 } });
def('semilla_latente', 'Semilla Latente', 'relic', 1, 'espora', 'No germina, pero tampoco se queda quieta. Con cada baja pesa un poco más.', { st: { ess: 1.1, cores: 1.05 }, pa: [{ id: 'siembra', v: 4, f: 2 }] });
def('ojo_cerrado', 'Ojo Cerrado', 'relic', 1, 'cristal', 'Un ojo de cristal con el párpado puesto. A veces se abre y mira por vos.', { st: { gun: 1.04, ult: 1.04 } });
def('latido_ajeno', 'Latido Ajeno', 'relic', 2, 'carne', 'Un corazón chico en un frasco. Late cuando matás.', { st: { kheal: 0.7, heal: 5 }, pa: [{ id: 'savia', v: 1.5 }], syn: [{ t: 'ess', k: 'carne', n: 8, fx: { melee: 1.04 } }] });
def('fragmento_umbral', 'Fragmento de Umbral', 'relic', 2, 'vacio', 'Un trozo de puerta que no abre a ningún lado.', { st: { cd: 0.95, skill: 1.05 }, pa: [{ id: 'sombra', v: 0.08 }] });
def('capullo_eterno', 'Capullo Eterno', 'relic', 3, 'raiz', 'Un capullo que nunca termina de abrirse: guarda todo lo que vos no necesitás.', { st: { cores: 1.1, ess: 1.15, heal: 8 }, pa: [{ id: 'regen', v: 1.5 }, { id: 'savia', v: 2, f: 1 }, { id: 'ultimo_aliento', v: 0.14, f: 2 }, { id: 'fervor', v: 2, f: 3 }], syn: [{ t: 'organ', n: 3, fx: { cores: 1.05 } }] });

/* ── piezas que completan los SETS ORGÁNICOS (docs/INVENTARIO.md → «Sets») ── */
def('guantes_raiz', 'Guantes de Corteza', 'arms', 2, 'raiz', 'Dedos de madera joven que se cierran solos sobre lo que agarran.', { st: { melee: 1.05, heal: 3 }, pa: [{ id: 'regen', v: 1 }] });
def('pecho_geoda', 'Pecho de Geoda', 'torso', 2, 'cristal', 'Una geoda abierta sobre el pecho: devuelve la luz con intereses.', { st: { dmgIn: 0.96, skill: 1.04 }, pa: [{ id: 'escudo_pleno', v: 0.04 }] });
def('craneo_carne', 'Cráneo Vivo', 'head', 1, 'carne', 'Un cráneo recubierto de músculo tibio que mastica solo.', { st: { melee: 1.03, kheal: 0.3 } });
def('patas_carne', 'Patas Voraces', 'legs', 1, 'carne', 'Tendones tensados de más: cada paso come un poco de suelo.', { st: { spd: 1.03, kheal: 0.2 } });
def('sombrero_espora', 'Sombrero de Hongo', 'head', 2, 'espora', 'Un sombrero ancho que llueve esporas cuando algo cae cerca.', { st: { ess: 1.08, cores: 1.04 }, pa: [{ id: 'siembra', v: 4, f: 1 }] });
def('manos_hongo', 'Manos de Micelio', 'arms', 1, 'espora', 'Hilos blancos que unen los dedos y envenenan lo que tocan.', { st: { melee: 1.04, gun: 1.02 } });
def('pies_micelio', 'Pies de Micelio', 'legs', 1, 'espora', 'Una red de hilos bajo cada paso: sentís el suelo a lo lejos.', { st: { spd: 1.03, heal: 2 } });
def('sudario_vacio', 'Sudario del Vacío', 'torso', 2, 'vacio', 'Tela que no termina de existir: el golpe la atraviesa un instante antes de llegar.', { st: { dmgIn: 0.96, spd: 1.02 }, pa: [{ id: 'sombra', v: 0.08 }] });

/* ── JARDÍN (docs/FLORA.md): variantes hechas con plantas. Mismo material visual que su familia (raíz / cristal / espora), receta con materiales VEGETALES (`jardin: [[material, cantidad]]`). ── */
def('capucha_savia', 'Capucha de Savia', 'head', 1, 'raiz', 'Una capucha de hojas selladas con savia: huele a bosque después de llover.', { st: { heal: 3, dmgIn: 0.99 }, pa: [{ id: 'regen', v: 0.8 }], jardin: [['savia', 2], ['fibra', 2]] });
def('coraza_savia', 'Coraza de Savia', 'torso', 2, 'raiz', 'Corteza viva con savia dorada por dentro: se cierra sola sobre cada herida.', { st: { dmgIn: 0.96, heal: 4 }, pa: [{ id: 'savia', v: 1.2 }], jardin: [['savia', 3], ['resina', 2], ['fibra', 2]] });
def('guantes_savia', 'Guantes de Savia', 'arms', 1, 'raiz', 'Dedos de liana tejida: agarran fuerte y no se rompen.', { st: { melee: 1.04, heal: 2 }, jardin: [['fibra', 3], ['savia', 1]] });
def('botas_savia', 'Botas de Savia', 'legs', 1, 'raiz', 'Suelas de resina fresca: se pegan al suelo justo lo necesario.', { st: { spd: 1.02, heal: 3 }, jardin: [['resina', 2], ['fibra', 2]] });
def('maza_savia', 'Maza de Savia', 'melee', 2, 'raiz', 'Un nudo de árbol viejo bañado en savia: cada golpe deja el suelo pegajoso.', { m: { type: 'martillo', special: 'espora', light: L(64, 3.7, 0.7, 0.66), heavy: L(176, 4.4, 0.8, 1.2, { knock: 17 }), model: 'maza_espora' }, pa: [{ id: 'regen', v: 1.2 }], vis: 'raiz', jardin: [['resina', 3], ['savia', 2], ['raiz_hierro', 1]] });
def('corona_petalo', 'Corona de Pétalos', 'head', 1, 'cristal', 'Pétalos de luz entretejidos: cada baja cercana les saca un brillo nuevo.', { st: { skill: 1.04, ult: 1.03 }, jardin: [['petalo', 3], ['fibra', 1]] });
def('peto_petalo', 'Peto de Pétalos', 'torso', 2, 'cristal', 'Capas de pétalo cristalino que se abren cuando algo golpea y devuelven escudo.', { st: { shield: 1.1, dmgIn: 0.97 }, pa: [{ id: 'escudo_pleno', v: 0.04 }], jardin: [['petalo', 4], ['nectar', 2], ['fibra', 2]] });
def('brazales_petalo', 'Brazales de Pétalos', 'arms', 1, 'cristal', 'Dos manojos de flores de luz atados a las muñecas.', { st: { skill: 1.03, gun: 1.02 }, jardin: [['petalo', 3], ['fibra', 2]] });
def('sandalias_petalo', 'Sandalias de Pétalos', 'legs', 1, 'cristal', 'Pétalos que no pesan: cada paso deja una huella de luz.', { st: { spd: 1.03, cd: 0.98 }, jardin: [['petalo', 2], ['nectar', 1], ['fibra', 2]] });
def('cetro_petalo', 'Cetro de Pétalos', 'melee', 2, 'cristal', 'Un tallo de cristal florecido en la punta: perfora y deja una flor de luz.', { m: { type: 'lanza', special: 'linea', light: L(49, 6.6, 0.22, 0.4, { pierce: true }), heavy: L(132, 8.1, 0.2, 0.95, { pierce: true }), model: 'lanza_sinaptica' }, st: { skill: 1.03 }, vis: 'cristal', jardin: [['petalo', 4], ['hoja_espejo', 1], ['nectar', 2]] });
def('cerbatana_espina', 'Cerbatana de Espinas', 'gun', 1, 'raiz', 'Un tallo hueco con espinas de zarza: cada soplido es una dosis de veneno.', { g: { base: 'dardos', dmg: 1.06, rate: 1.05, mag: 1.15, fx: { poison: 9 } }, vis: 'raiz', jardin: [['fibra', 3], ['polen', 2]] });
def('semilla_jardin', 'Semilla de Jardín', 'relic', 1, 'espora', 'Una semilla que late: dicen que, si la plantás en tierra buena, da un jardín entero.', { st: { heal: 4, ess: 1.05 }, jardin: [['polen', 2], ['savia', 2]] });
def('corazon_flor', 'Corazón de Flor', 'relic', 2, 'cristal', 'El centro de una flor de luz, todavía abierto: te cuida mientras no mires.', { st: { shield: 1.1, heal: 5 }, pa: [{ id: 'regen', v: 1 }], jardin: [['petalo', 3], ['nectar', 2], ['polen', 1]] });

// Equipamiento de ritmo: cada silueta usa los materiales orgánicos del catálogo.
def('tendones_relampago', 'Tendones Relámpago', 'arms', 2, 'carne', 'Fibras tensas: atacás más rápido, pero cada golpe pierde fuerza.', { st: { attackSpeed: 1.08, melee: 0.97, gun: 0.97 } });
def('punos_basalticos', 'Puños Basálticos', 'arms', 1, 'quitina', 'Placas pesadas: golpes más fuertes y deliberados.', { st: { attackSpeed: 0.96, melee: 1.05 } });
def('relicario_amortiguador', 'Relicario Amortiguador', 'relic', 1, 'cristal', 'Una geoda absorbe impactos a cambio de parte de tu potencia.', { st: { dmgIn: 0.95, gun: 0.98, melee: 0.98 } });

/* ───────── SETS ORGÁNICOS: familias de 4 piezas de armadura + 1 arma. Bonos con 2 y 4 piezas (el arma cuenta como pieza). ───────── */
export const SETS = {
  osario:   { name: 'Set Osario', mat: 'hueso', items: ['casco_hueso', 'peto_hueso', 'brazales_hueso', 'grebas_hueso', 'cuchilla_hueso'], lore: 'Los huesos del osario se reconocen entre sí: juntos no se rompen.',
    b2: { fx: { dmgIn: 0.97 } }, b4: { fx: { dmgIn: 0.96, melee: 1.04 }, pa: [{ id: 'espinas', v: 0.15 }] }, vis: 'Las vetas pasan de brasa tenue a un latido dorado y un halo de polvo de hueso rodea el cuerpo.' },
  quitina:  { name: 'Set Quitina', mat: 'quitina', items: ['yelmo_quitina', 'coraza_quitina', 'guanteletes_quitina', 'patas_quitina', 'hacha_caparazon'], lore: 'Un caparazón entero, pieza a pieza: cada placa cubre el hueco de la otra.',
    b2: { fx: { shield: 1.1 } }, b4: { fx: { dmgIn: 0.95, shield: 1.12 }, pa: [{ id: 'escudo_pleno', v: 0.05 }] }, vis: 'Las placas se cierran con un destello ámbar y las vetas recorren todo el caparazón.' },
  raiz_madre: { name: 'Set Raíz Madre', mat: 'raiz', items: ['capucha_raiz', 'corazon_coloso', 'guantes_raiz', 'pies_raiz', 'maza_raiz'], lore: 'La Raíz Madre te reconoce como suyo y te cuida.',
    b2: { fx: { heal: 4 } }, b4: { fx: { heal: 6, dmgIn: 0.97 }, pa: [{ id: 'regen', v: 1.5 }] }, vis: 'Brotes verdes florecen por todo el cuerpo y las raíces laten en sincronía.' },
  cristal_hueco: { name: 'Set Cristal Hueco', mat: 'cristal', items: ['corona_cristal', 'pecho_geoda', 'brazos_cristal', 'zancos_cristal', 'pica_geoda'], lore: 'Cristal por dentro y por fuera: la luz da vueltas hasta que sale como poder.',
    b2: { fx: { skill: 1.04 } }, b4: { fx: { skill: 1.05, cd: 0.95, ult: 1.05 }, pa: [{ id: 'fervor', v: 1 }] }, vis: 'Los cristales se encienden en cadena y un aura fría canta una sola nota.' },
  carne_viva: { name: 'Set Carne Viva', mat: 'carne', items: ['craneo_carne', 'torso_carne', 'zarpas_carne', 'patas_carne', 'cercenadora'], lore: 'Un cuerpo entero hecho de otros: tiene hambre y se alimenta de lo que mata.',
    b2: { fx: { kheal: 0.3 } }, b4: { fx: { kheal: 0.5, melee: 1.04 }, pa: [{ id: 'drenaje', v: 0.05 }] }, vis: 'La carne late de a pares, las venas se vuelven rojo vivo y el pecho se hincha con cada respiro.' },
  espora:   { name: 'Set Espora', mat: 'espora', items: ['sombrero_espora', 'pulmon_espora', 'manos_hongo', 'pies_micelio', 'aguja_sembradora'], lore: 'Un micelio que te recorre entero y piensa por vos.',
    b2: { fx: { ess: 1.1 } }, b4: { fx: { ess: 1.12, cores: 1.06 }, pa: [{ id: 'siembra', v: 5 }] }, vis: 'Nubes de esporas luminosas flotan alrededor y los sombreros brillan al compás.' },
  vacio:    { name: 'Set Vacío', mat: 'vacio', items: ['mascara_vacio', 'sudario_vacio', 'manos_eco', 'pasos_vacio', 'filo_vacio'], lore: 'El Vacío te viste: dejás de estar del todo en un solo lugar.',
    b2: { fx: { spd: 1.02 } }, b4: { fx: { spd: 1.03, cd: 0.95 }, pa: [{ id: 'sombra', v: 0.1 }] }, vis: 'Los bordes se deshacen en esquirlas violetas y una sombra te sigue medio paso atrás.' },
  /* — SETS DE JARDÍN (docs/FLORA.md): se forjan con materiales vegetales; su aspecto es el de su material base — */
  savia:    { name: 'Set Savia', mat: 'raiz', jardin: true, items: ['capucha_savia', 'coraza_savia', 'guantes_savia', 'botas_savia', 'maza_savia'], lore: 'La savia del Jardín no olvida: te cierra las heridas antes de que las notes.',
    b2: { fx: { heal: 3 } }, b4: { fx: { heal: 5, dmgIn: 0.97 }, pa: [{ id: 'regen', v: 1.5 }] }, vis: 'Hojas húmedas brotan por el cuerpo y un hilo de savia dorada late bajo la armadura.' },
  flor_luz: { name: 'Set Flor de Luz', mat: 'cristal', jardin: true, items: ['corona_petalo', 'peto_petalo', 'brazales_petalo', 'sandalias_petalo', 'cetro_petalo'], lore: 'Una flor abierta alrededor del cuerpo: cuanto más oscuro está, más brilla.',
    b2: { fx: { shield: 1.08 } }, b4: { fx: { shield: 1.1, skill: 1.04, ult: 1.04 }, pa: [{ id: 'fervor', v: 1 }] }, vis: 'Pétalos de luz se abren en cadena y una corona de brillo cian gira detrás de la cabeza.' },
};
export const SET_IDS = Object.keys(SETS);
/** Objetos de jardín (llevan `jardin`): los planos de las plantas raras salen de acá. */
export const PLANOS_JARDIN = Object.keys(IT).filter((id) => IT[id].jardin);
for (const sid of SET_IDS) for (const id of SETS[sid].items) { if (!IT[id]) throw new Error('Set ' + sid + ': objeto inexistente ' + id); IT[id].set = sid; }
/** Piezas de cada set que lleva puestas la lista de equipo: { set: n }. */
export function setCounts(list) { const c = {}; for (const e of list) { const it = IT[e.id]; if (it && it.set) c[it.set] = (c[it.set] || 0) + 1; } return c; }
/** Bonos de set activos: [{ set, n, tier: 2|4, b }]. */
export function setActivos(list) {
  const out = [], c = setCounts(list);
  for (const [sid, n] of Object.entries(c)) { if (n >= 2) out.push({ set: sid, n, tier: 2, b: SETS[sid].b2 }); if (n >= 4) out.push({ set: sid, n, tier: 4, b: SETS[sid].b4 }); }
  return out;
}

export const ITEMS = IT;
export const ITEM_IDS = Object.keys(IT);
export const SIGNATURES = Object.fromEntries(ITEM_IDS.filter((id) => IT[id].host).map((id) => [IT[id].host, id]));
export const itemOf = (id) => IT[id] || null;
export const rarityOf = (it) => RARITIES[it.r];
export const isSignature = (id) => !!(IT[id] && IT[id].host);
export const isWeapon = (it) => it.slot === 'gun' || it.slot === 'melee';

/* ───────── instancias y fases ───────── */
export const killsFor = (it) => (isWeapon(it) ? FASE_KILLS.arma : FASE_KILLS.resto);
/** Fase 0..3 según las bajas acumuladas. */
export function faseDe(it, k) { const T = killsFor(it); let f = 0; for (let i = 1; i < 4; i++) if ((k || 0) >= T[i]) f = i; return f; }
/** Progreso hacia la fase siguiente: { fase, k, desde, hasta (null en Plena), frac, falta }. */
export function progresoFase(it, k) {
  const T = killsFor(it), f = faseDe(it, k), max = f >= 3; k = Math.max(0, Math.floor(k || 0));
  return { fase: f, k, desde: T[f], hasta: max ? null : T[f + 1], frac: max ? 1 : (k - T[f]) / (T[f + 1] - T[f]), falta: max ? 0 : T[f + 1] - k, max };
}
/** Calidad de la tirada: multiplica las desviaciones (0,94 a 1,06). */
export const rollMul = (q) => 0.94 + 0.12 * Math.max(0, Math.min(1, Number.isFinite(+q) ? +q : 0.5));
/** Lleva un multiplicador v (1 = nada) a su valor efectivo: 1 + (v − 1) × tirada × fase. */
const scale = (v, mul) => 1 + (v - 1) * mul;
/** Bonos efectivos de una instancia (con tirada y fase). Devuelve { st: {clave: valor}, fase }. */
export function itemStats(inst) {
  const it = IT[inst.id]; if (!it) return { st: {}, fase: 0 };
  const fase = faseDe(it, inst.k), mul = rollMul(inst.q) * FASE_MUL[fase], st = {};
  for (const [k, v] of Object.entries(it.st)) st[k] = ADD_KEYS.includes(k) ? Math.round(v * mul * 100) / 100 : Math.round(scale(v, mul) * 1000) / 1000;
  return { st, fase };
}
/** Pasivos activos (los de fase mínima ya alcanzada). */
export function pasivosActivos(inst) { const it = IT[inst.id]; if (!it) return []; const f = faseDe(it, inst.k); return it.pa.filter((p) => (p.f || 0) <= f); }
/** Puntaje de poder (para comparar y ordenar): suma de |desviaciones| de bonos + pasivos y sinergias. */
export function poder(inst) {
  const it = IT[inst.id]; if (!it) return 0; const { st } = itemStats(inst); let s = 0;
  for (const [k, v] of Object.entries(st)) s += ADD_KEYS.includes(k) ? v * (k === 'heal' ? 0.012 : 0.1) : Math.abs(v - 1);
  s += 0.02 * pasivosActivos(inst).length + 0.01 * it.syn.length + (it.g ? Math.abs(it.g.dmg - 1) * 0.5 : 0) + (it.m ? 0.03 : 0);
  return Math.round(s * 1000) / 1000;
}

/* ───────── validación (cliente y servidor) ───────── */
/** '' si el Huésped `char` puede llevar esta instancia en su ranura, o el motivo en español. */
export function equipError(char, inst, slot = null) {
  const it = inst && IT[inst.id]; if (!it) return 'objeto desconocido';
  if (slot && it.slot !== slot) return `no entra en la ranura ${SLOT_NAME[slot].toLowerCase()}`;
  if (it.host && it.host !== char) return `sólo la puede llevar ${it.host[0].toUpperCase()}${it.host.slice(1)}`;
  return '';
}
const num = (x, lo, hi, d) => (Number.isFinite(+x) ? Math.max(lo, Math.min(hi, +x)) : d);
/** Limpia una lista de equipo recibida de afuera (perfil, servidor): como mucho una pieza por ranura, sólo ids conocidos, ranura correcta, sin armas signature ajenas. */
export function cleanEquip(char, list) {
  const out = [], seen = new Set();
  if (!Array.isArray(list)) return out;
  for (const e of list.slice(0, 12)) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || e.id.length > 40) continue;
    const it = IT[e.id]; if (!it || seen.has(it.slot) || (e.s && e.s !== it.slot)) continue;
    if (equipError(char, e)) continue;
    seen.add(it.slot); out.push({ s: it.slot, id: it.id, q: Math.round(num(e.q, 0, 1, 0.5) * 100) / 100, k: Math.floor(num(e.k, 0, 99999, 0)) });
  }
  return out.sort((a, b) => SLOTS.indexOf(a.s) - SLOTS.indexOf(b.s));
}

/* ───────── efectos agregados del equipo ───────── */
/** Combina los bonos estáticos de todas las piezas en un objeto { clave: factor } (heal/kheal suman) con los topes de CAPS. */
export function foldStatic(list) {
  const bn = {};
  for (const e of list) for (const [k, v] of Object.entries(itemStats(e).st)) bn[k] = ADD_KEYS.includes(k) ? (bn[k] || 0) + v : (bn[k] ?? 1) * v;
  return capBn(bn);
}
export function capBn(bn) {
  for (const [k, [lo, hi]] of Object.entries(CAPS)) if (k in bn) bn[k] = Math.max(lo, Math.min(hi, bn[k]));
  return bn;
}

/* ───────── textos para la interfaz ───────── */
/** Líneas en español de los bonos de una instancia: ['Daño cuerpo a cuerpo +6 %', …]. */
export function lineasStats(inst) {
  const { st } = itemStats(inst), out = [];
  for (const [k, v] of Object.entries(st)) out.push(ADD_KEYS.includes(k) ? `${STAT_ES[k]} +${v}` : k === 'dmgIn' ? `${STAT_ES[k]} −${Math.round((1 - v) * 1000) / 10} %` : k === 'cd' ? `${STAT_ES[k]} −${Math.round((1 - v) * 1000) / 10} %` : `${STAT_ES[k]} ${v >= 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 1000) / 10} %`);
  return out;
}
export function lineasArma(inst) {
  const it = IT[inst.id]; if (!it) return []; const out = [];
  if (it.g) { const b = WEAPONS.find((w) => w.id === it.g.base); out.push(`Base: ${b ? b.name : it.g.base} · daño ×${it.g.dmg} · cadencia ×${it.g.rate} · cargador ×${it.g.mag}`); for (const k of Object.keys(it.g.fx || {})) out.push(FX_ES[k] || k); }
  if (it.m) { out.push(`${TIPO_MELEE[it.m.type] || it.m.type} · ligero ${it.m.light.dmg} (alcance ${it.m.light.range} m) · pesado ${it.m.heavy.dmg} (alcance ${it.m.heavy.range} m)${it.m.dual ? ' · DOS HOJAS: el golpe ligero pega con las dos' : ''}`); }
  return out;
}
const FX_ES = { pierce: 'Atraviesa', chain: 'Salta entre criaturas', burn: 'Quema', poison: 'Envenena', slow: 'Ralentiza', lifesteal: 'Roba vida', spreadMul: 'Dispersión más cerrada', critP: 'Posibilidad de crítico' };
export const TIPO_MELEE = { espada: 'Espada', hacha: 'Hacha', martillo: 'Martillo', lanza: 'Lanza', daga: 'Daga', gemelas: 'Espadas gemelas', garras: 'Garras dobles', baculo: 'Cetro', guadana: 'Guadaña' };
export const lineasPasivos = (inst) => { const it = IT[inst.id]; if (!it) return []; const f = faseDe(it, inst.k); return it.pa.map((p) => ({ name: PASIVOS[p.id].name, txt: PASIVOS[p.id].txt(p.v), f: p.f || 0, on: (p.f || 0) <= f })); };
export const lineasSinergias = (inst) => { const it = IT[inst.id]; return it ? it.syn.map((s) => SYN_TXT[s.t](s)) : []; };
/** Qué trae la fase siguiente (para el UI): texto del primer pasivo que se desbloquea o «más bonos». */
export function proximaFase(inst) {
  const it = IT[inst.id]; if (!it) return null; const f = faseDe(it, inst.k); if (f >= 3) return null;
  const nuevos = it.pa.filter((p) => (p.f || 0) === f + 1).map((p) => `${PASIVOS[p.id].name}: ${PASIVOS[p.id].txt(p.v)}`);
  return { fase: f + 1, nombre: FASES[f + 1], txt: nuevos.length ? nuevos.join(' ') : `Los bonos crecen un ${Math.round((FASE_MUL[f + 1] / FASE_MUL[f] - 1) * 100)} %.` };
}

/* ───────── desguace ───────── */
/** Qué da desguazar una instancia: núcleos y esencia del tipo del material. Lo madurado vale más. */
export function desguaceValor(inst) {
  const it = IT[inst.id]; if (!it) return { cores: 0, ess: {} };
  const R = RARITIES[it.r], f = faseDe(it, inst.k), cores = Math.round(R.desguace * 0.5 * (1 + 0.25 * f)), n = 1 + it.r + (f >= 2 ? 1 : 0);
  return { cores, ess: { [MATERIALS[it.mat].ess]: n }, mats: { [it.mat]: { cal: Math.max(0, it.r - 0), n: 1 + (it.r >= 2 ? 1 : 0) + (f >= 3 ? 1 : 0) } } };   // devuelve materiales de la calidad del objeto
}
/** Núcleos y esencias que cuesta FORJAR una firma en el Herrero (Huésped con el requisito cumplido). */
export const FORJA_FIRMA = { cores: 120, ess: 6 };
export const LIMITE_INVENTARIO = 60;

/* ═════════════ FORJA BIOLÓGICA: materiales, planos y recetas (docs/INVENTARIO.md → «Forja») ═════════════
   Lo que CAE en las partidas son sobre todo materiales (con calidad 0..3) y planos; los objetos finales se construyen en la Forja. */
export const CALIDADES = ['Burdo', 'Fino', 'Excelente', 'Perfecto'];
/** MATERIALES = los 7 materiales orgánicos + su nombre de calidad. Cada tipo se guarda por calidad: materiales[mat] = [n0, n1, n2, n3]. */
export const MATERIALES = Object.fromEntries(TODOS_MAT_IDS.map((m) => [m, { ...MATERIALS[m], id: m, calidades: CALIDADES }]));
export const MAT_STOCK_MAX = 99;
/** Plano de cada objeto (id = el del objeto). Los de rareza Común se conocen de entrada; el resto se encuentra en partidas. Las armas firma sólo vienen del jefe de su mapa. */
export const PLANOS = Object.fromEntries(ITEM_IDS.map((id) => [id, { id, item: id, nombre: 'Plano: ' + IT[id].name, r: IT[id].r, inicial: IT[id].r === 0, firma: !!IT[id].host }]));
export const PLANOS_INICIALES = ITEM_IDS.filter((id) => PLANOS[id].inicial);
const SEC = { hueso: 'quitina', quitina: 'hueso', raiz: 'espora', cristal: 'vacio', carne: 'hueso', espora: 'raiz', vacio: 'cristal' };   // material secundario de cada receta
/** Receta: { item, plano, mats: [{ mat, n, cal }] (cal = calidad mínima), cores, ess?, tiempo (s de cultivo) }. */
function receta(id) {
  const it = IT[id], r = it.r, m = it.mat, s = SEC[m];
  const T = [{ mats: [{ mat: m, n: 3, cal: 0 }], cores: 15, tiempo: 5 }, { mats: [{ mat: m, n: 4, cal: 1 }, { mat: s, n: 1, cal: 0 }], cores: 40, tiempo: 15 }, { mats: [{ mat: m, n: 5, cal: 2 }, { mat: s, n: 2, cal: 1 }], cores: 90, tiempo: 30 }, { mats: [{ mat: m, n: 6, cal: 3 }, { mat: s, n: 3, cal: 2 }], cores: 220, tiempo: 60 }][r];
  const R = { item: id, plano: id, mats: T.mats.map((x) => ({ ...x })), cores: T.cores, tiempo: T.tiempo };
  if (it.jardin) R.mats = [{ mat: m, n: Math.max(1, Math.ceil(T.mats[0].n / 2)), cal: T.mats[0].cal }, ...it.jardin.map(([fm, n]) => ({ mat: fm, n, cal: Math.max(0, r - 1) }))];   // variante de jardín: la mitad del material base + materiales vegetales
  if (it.host) { R.mats.push({ mat: 'vacio', n: 2, cal: 3 }); R.cores = 320; R.tiempo = 90; R.especial = 'Pide materiales Perfectos del Vacío y el plano raro que suelta el jefe de su mapa.'; }
  return R;
}
export const RECETAS = Object.fromEntries(ITEM_IDS.map((id) => [id, receta(id)]));
/** Calidad de la tirada de un objeto forjado: determinista (misma receta + mismo contador de forja = mismo resultado) y acotada 0,15..1; materiales mejores la suben. */
export function qForja(id, contador, calMedia = 0) {
  let h = 2166136261; const str = `${id}|${contador | 0}`; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  const u = ((h >>> 0) % 1000) / 1000;
  return Math.round(Math.max(0.15, Math.min(1, 0.15 + 0.6 * u + 0.08 * Math.max(0, Math.min(3, calMedia)))) * 100) / 100;
}
/** Texto del costo de una receta para la interfaz. */
export const costoTexto = (R) => R.mats.map((x) => `${x.n}× ${MATERIALS[x.mat].name} (${CALIDADES[x.cal]}+)`).join(' · ') + ` · ${R.cores} núcleos`;

/* ═════════════ CONSUMIBLES DE JARDÍN (docs/FLORA.md → «Forja de jardín»): se fabrican al instante con materiales vegetales ═════════════
   da: { botiquin: n } suma botiquines iniciales (tope 5) · { cebo: n } cebos para atraer fauna (los usa el sistema de fauna) · { semilla: 'especie' } semilla para el
   Jardín de la base (la base la planta; ver el contrato en docs/FLORA.md). Las semillas de plantas RARAS no se fabrican: sólo se encuentran. */
export const CONSUMIBLES = {
  botiquin_organico: { id: 'botiquin_organico', nombre: 'Botiquín orgánico', icono: '✚', desc: 'Un botiquín vivo: suma 1 botiquín inicial (te levanta una vez con la mitad de la vida). Máximo 5.', mats: [{ mat: 'savia', n: 3, cal: 1 }, { mat: 'fibra', n: 2, cal: 0 }], cores: 30, da: { botiquin: 1 } },
  cebo_fauna: { id: 'cebo_fauna', nombre: 'Cebo para fauna', icono: '☘', desc: 'Néctar y polen en un fardo: atrae criaturas de la fauna al empezar una partida (para consumirlas y mutar).', mats: [{ mat: 'nectar', n: 2, cal: 1 }, { mat: 'polen', n: 2, cal: 0 }], cores: 20, da: { cebo: 1 } },
};
for (const sid of Object.keys(ESPECIES)) {
  const S = ESPECIES[sid]; if (S.rara) continue;
  CONSUMIBLES['semilla_' + sid] = { id: 'semilla_' + sid, nombre: 'Semilla: ' + S.nombre, icono: '❀', desc: `Para el Jardín de la base: cultivá ${S.nombre} y cosechala sin salir de casa. ${S.fn === 'ofensiva' ? 'Ojo: es peligrosa también ahí.' : ''}`.trim(),
    mats: [{ mat: S.cos.mat, n: 2, cal: 1 }, { mat: 'savia', n: 1, cal: 0 }], cores: 25, da: { semilla: sid } };
}
export const CONSUMIBLE_IDS = Object.keys(CONSUMIBLES);
