// CATÁLOGO DE DATOS del Editor de Huéspedes (Laboratorio, etapa E1). Datos PUROS: sin DOM, sin Three.js, sin azar.
// Contrato completo: docs/EDITOR_HUESPEDES.md (§2.2 esquema, §2.3 anclas, §2.4 capacidad, §3.4 presupuesto de render).
// Lo consumen: src/shared/host-build.js (validar/derivar/codificar), el servidor, la simulación y el cliente 3D.
//
// Reglas de oro de este archivo:
//  · Si una pieza es COSMÉTICA o FUNCIONAL lo dice SOLO `PARTES[id].cat`, nunca el diseño del jugador.
//  · El efecto de una pieza funcional sale de `organ` (un id de CHAMP_ORGANS de src/sim/data.js). Nada más.
//  · Los ÍNDICES de MATERIALES_KIT, ORDEN_PARTES, ORDEN_ANCLAS, ACABADOS y PRESETS se usan en el formato de red VB1:
//    la lista es SOLO-AÑADIR (jamás se reordena ni se borra una entrada: se marca `retirada` con un `reemplazo`).
//  · Los costes de render (`tris`, `llamadas_extra`) son ESTIMACIONES DE DISEÑO [NV: no medidas]. Cuando exista
//    tools/lab-costes.mjs las fijará con la medición real; hasta entonces el servidor valida con esta tabla.

import { FINISHES } from './cosmetics.js';

export const SCHEMA = 'vortex.hostbuild';
export const VERSION_BUILD = 1;
export const RIG = 'arcanum-mh326@1';          // id de rig + versión del CONTRATO DE ANCLAS
export const CHASIS_ID = 'laboratorio';        // E1: único chasis permitido
export const EDITOR_VERSION = '1.0.0';
export const CATALOGO_VERSION = 1;
export const COSTES_ESTIMADOS = true;           // [NV] los `tris` son estimaciones de diseño hasta medir con tools/lab-costes.mjs

/** Materiales del kit de armadura (src/client/huesped-armor.js, `TEX` + materiales propios). Índice = posición (VB1). */
export const MATERIALES_KIT = ['metal', 'gold', 'bone', 'leather', 'bark', 'stone', 'cloth', 'marble', 'ember', 'light', 'spirit', 'crystal', 'flesh', 'mirror', 'dark'];
/** Acabados que el jugador puede elegir (los 'earned' de src/shared/cosmetics.js; 'aurico' está planeado y no se ofrece). */
export const ACABADOS = Object.freeze(Object.entries(FINISHES).filter(([, f]) => f.channel === 'earned').map(([k]) => k));
/** Presets de cuerpo humano (src/client/humans.js). El rostro queda tras la máscara. */
export const PRESETS = ['jugador1', 'jugador2', 'jugador3', 'jugador4'];

export const CHASIS = Object.freeze({
  laboratorio: Object.freeze({
    id: 'laboratorio', nombre: 'Híbrido de Laboratorio', etiqueta: 'Creación del jugador',
    hp: 1, speed: 1,                                     // FIJOS: ninguna proporción los toca
    resumenBase: Object.freeze({ dano: 5, resistencia: 5, movilidad: 5, control: 4, utilidad: 4, dificultad: 3 }),
  }),
});

/* ───────── proporciones (§3.1). Rango [min, max] y paso de cuantización (0,005). ───────── */
export const PROP_ORDEN = ['altura', 'ancho', 'hombros', 'torso', 'brazos', 'piernas', 'cabeza', 'manos', 'pies'];
export const PROP_RANGOS = Object.freeze({
  altura: [0.90, 1.15], ancho: [0.90, 1.15], hombros: [0.92, 1.12], torso: [0.92, 1.10], brazos: [0.90, 1.15],
  piernas: [0.90, 1.15], cabeza: [0.90, 1.20], manos: [0.85, 1.30], pies: [0.85, 1.25],
});
export const PROP_PASO = 0.005;
export const PROP_BASE = 0.8;                    // origen del byte en VB1: valor = 0,8 + n × 0,005
/** Relaciones entre proporciones (HB-05). */
export const PROP_RELACIONES = Object.freeze({ brazosHombrosMax: 0.15, alturaPiernasMax: 1.30, cabezaSobreHombrosMax: 1.20 });
/** Postura de reposo (avanzado), en grados enteros. */
export const POSE_RANGOS = Object.freeze({ inclinacion: [-10, 10], hombros: [-8, 8] });

/* ───────── topes de render (§3.4): REGLA DE VALIDEZ, no aviso ───────── */
export const TOPES_RENDER = Object.freeze({
  tris: 11000, llamadas: 14, materiales: 8, halos: 3, cadenas: 2, telas: 1,
  instanciasTotal: 24, instanciasPorAncla: 6,      // HB-10 (instancias DIBUJADAS: una pieza espejada cuenta 2)
});
/** Anti-oclusión (HB-16, §2.7): volúmenes en m³ (estimación de diseño). */
export const ANTI_OCLUSION = Object.freeze({ volumenCuerpo: 0.075, razonMax: 1.35, cabezaMax: 0.02 });
export const BRILLO_EMISIVO_MAX = 0.8;              // luminancia relativa máxima del color emisivo (HB-15)
export const BUILD_BYTES_MAX = 2048;                // HB-17: largo máximo del texto VB1

/* ───────── ANCLAS (§2.3): rig arcanum-mh326@1 ───────── */
// huesos: nombre real de cada hueso (assets/arcanum/narrative/model.json). `lados` 1 = centro, 2 = izquierda/derecha.
// Marco local: origen en el hueso (pose de enlace A-pose, sin rotación). +Y arriba, +Z adelante del personaje;
// en anclas de 2 lados, +X = hacia AFUERA del cuerpo (en cada lado); en anclas de 1 lado, +X = lado derecho del personaje.
// El lado izquierdo es el REFLEJO del derecho respecto al plano sagital (pos.x→−x, rot.y→−rot.y, rot.z→−rot.z).
// pos en metros, rot en grados, esc multiplicador. Ninguna de estas cifras toca el combate.
const L = (pos, rot, esc) => Object.freeze({ pos: Object.freeze(pos.map((r) => Object.freeze(r))), rot: Object.freeze(rot.map((r) => Object.freeze(r))), esc: Object.freeze(esc) });
export const ANCLAS = Object.freeze({
  cabeza:     Object.freeze({ nombre: 'Cabeza', lados: 1, huesos: Object.freeze({ c: 'head' }), zona: 'head', limites: L([[-0.14, 0.14], [-0.06, 0.22], [-0.14, 0.14]], [[-45, 45], [-45, 45], [-60, 60]], [0.5, 1.8]), nota: 'Cuernos, cresta, corona, ojos extra.' }),
  cuello:     Object.freeze({ nombre: 'Cuello', lados: 1, huesos: Object.freeze({ c: 'neck02' }), huesosExtra: Object.freeze(['neck01', 'neck03']), zona: 'head', limites: L([[-0.10, 0.10], [-0.08, 0.08], [-0.10, 0.10]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.5]), nota: 'Gorguera, collares.' }),
  hombros:    Object.freeze({ nombre: 'Hombros', lados: 2, huesos: Object.freeze({ izq: 'upperarm01_L', der: 'upperarm01_R' }), zona: 'arms', limites: L([[-0.10, 0.14], [-0.08, 0.16], [-0.12, 0.12]], [[-40, 40], [-40, 40], [-40, 40]], [0.5, 1.8]), nota: 'Hombreras, cañones, alas pequeñas. La pieza cuelga del brazo superior, como el kit.' }),
  pecho:      Object.freeze({ nombre: 'Pecho', lados: 1, huesos: Object.freeze({ c: 'spine01' }), zona: 'torso', limites: L([[-0.14, 0.14], [-0.14, 0.14], [-0.06, 0.14]], [[-30, 30], [-30, 30], [-30, 30]], [0.5, 1.6]), nota: 'Núcleo, glándulas, placas. Los órganos del campeón ya cuelgan de aquí.' }),
  espalda:    Object.freeze({ nombre: 'Espalda', lados: 1, huesos: Object.freeze({ c: 'spine03' }), huesosExtra: Object.freeze(['spine02']), zona: 'torso', limites: L([[-0.14, 0.14], [-0.18, 0.18], [-0.16, 0.04]], [[-30, 30], [-30, 30], [-30, 30]], [0.5, 1.8]), nota: 'Alas y espinas dorsales. El arma cruzada ya usa este hueso.' }),
  cintura:    Object.freeze({ nombre: 'Cintura', lados: 1, huesos: Object.freeze({ c: 'spine04' }), huesosExtra: Object.freeze(['spine05']), zona: 'torso', limites: L([[-0.16, 0.16], [-0.10, 0.10], [-0.14, 0.14]], [[-30, 30], [-30, 30], [-30, 30]], [0.5, 1.6]), nota: 'Faldones, glándulas ventrales.' }),
  antebrazos: Object.freeze({ nombre: 'Antebrazos', lados: 2, huesos: Object.freeze({ izq: 'lowerarm01_L', der: 'lowerarm01_R' }), zona: 'arms', limites: L([[-0.06, 0.06], [-0.14, 0.14], [-0.06, 0.06]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.6]), nota: 'Cuchillas, placas.' }),
  manos:      Object.freeze({ nombre: 'Manos', lados: 2, huesos: Object.freeze({ izq: 'wrist_L', der: 'wrist_R' }), zona: 'arms', limites: L([[-0.05, 0.05], [-0.05, 0.08], [-0.05, 0.05]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.5]), manoOcupada: 'der', nota: 'Garras. La mano derecha ya está ocupada por el arma cuerpo a cuerpo (HB-12).' }),
  muslos:     Object.freeze({ nombre: 'Muslos', lados: 2, huesos: Object.freeze({ izq: 'upperleg01_L', der: 'upperleg01_R' }), zona: 'legs', limites: L([[-0.08, 0.08], [-0.18, 0.18], [-0.08, 0.10]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.6]), nota: 'Rodilleras, placas.' }),
  pies:       Object.freeze({ nombre: 'Pies', lados: 2, huesos: Object.freeze({ izq: 'foot_L', der: 'foot_R' }), huesosExtra: Object.freeze(['toe1-1']), zona: 'legs', limites: L([[-0.06, 0.06], [-0.04, 0.06], [-0.08, 0.12]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.5]), nota: 'Pezuñas, espolones. Reservada: el catálogo E1 no trae piezas para esta ancla.' }),
  cola:       Object.freeze({ nombre: 'Cola', lados: 1, huesos: Object.freeze({ c: 'spine05' }), cadena: true, zona: 'torso', limites: L([[-0.06, 0.06], [-0.06, 0.06], [-0.12, 0.0]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.6]), nota: 'Huesos extra encadenados desde la cadera (ak.chain), como el abdomen de Colmena.' }),
  tentaculos: Object.freeze({ nombre: 'Tentáculos', lados: 1, huesos: Object.freeze({ c: 'spine03' }), cadena: true, zona: 'torso', limites: L([[-0.12, 0.12], [-0.12, 0.12], [-0.16, 0.04]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.6]), nota: 'Reservada: cadenas con muelles desde espalda, hombros o pecho. El catálogo E1 no la usa.' }),
});
/** Orden FIJO de anclas (índice = nibble en VB1; máx. 16). SOLO-AÑADIR. */
export const ORDEN_ANCLAS = Object.freeze(['cabeza', 'cuello', 'hombros', 'pecho', 'espalda', 'cintura', 'antebrazos', 'manos', 'muslos', 'pies', 'cola', 'tentaculos']);

/* ───────── PARTES (catálogo de piezas) ───────── */
const R = (pos, rot, esc) => Object.freeze({ pos: Object.freeze(pos.map((r) => Object.freeze(r))), rot: Object.freeze(rot.map((r) => Object.freeze(r))), esc: Object.freeze(esc) });
const NOMBRE_VARIANTES = ['liso', 'estriado', 'roto'];
function pieza(id, o) {
  const tris = o.tris;
  return Object.freeze({
    id, cat: o.cat, nombre: o.nombre, desc: o.desc, anclas: Object.freeze(o.anclas), lados: o.lados,
    variantes: Object.freeze(o.variantes || NOMBRE_VARIANTES),
    limites: o.limites, tris: Object.freeze({ low: tris, medium: Math.round(tris * 1.75), high: Math.round(tris * 3.3) }),
    mats: Object.freeze(o.mats), variantesMat: Object.freeze(o.variantesMat || [o.mats[0]]),
    extra: Object.freeze({ halo: 0, cadena: 0, tela: 0, ...(o.extra || {}) }),
    llamadas_extra: Object.values({ halo: 0, cadena: 0, tela: 0, ...(o.extra || {}) }).reduce((a, b) => a + b, 0),
    choca_con: Object.freeze(o.choca_con || []), ocupa: Object.freeze(o.ocupa || []),
    despeja_cara: o.despeja_cara !== false, volumen: o.volumen, valor: o.valor,
    obtencion: o.obtencion, organ: o.organ || null, champOrgan: o.organ || null, retirada: false, reemplazo: null,
  });
}
const LIM_GEN = R([[-0.06, 0.06], [-0.06, 0.06], [-0.06, 0.06]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.6]);
const LIM_ANCHO = R([[-0.14, 0.14], [-0.18, 0.22], [-0.16, 0.14]], [[-45, 45], [-45, 45], [-60, 60]], [0.6, 1.6]);
const MATS_DURO = ['bone', 'stone', 'metal', 'marble'];
const MATS_CARNE = ['flesh', 'leather', 'bark'];

const DEFS = {
  // ── 12 cosméticas ──
  cuerno_curvo:      pieza('cuerno_curvo',      { cat: 'cosmetica', nombre: 'Cuerno curvo', desc: 'Un cuerno que se curva hacia atrás. Solo estético.', anclas: ['cabeza'], lados: 'par', limites: R([[-0.12, 0.12], [-0.05, 0.18], [-0.10, 0.10]], [[-30, 30], [-30, 30], [-45, 45]], [0.6, 1.6]), tris: 240, mats: ['bone'], variantesMat: MATS_DURO, ocupa: ['cabeza.cuernos'], volumen: 0.0012, valor: 20, obtencion: 'inicial' }),
  cresta_osea:       pieza('cresta_osea',       { cat: 'cosmetica', nombre: 'Cresta ósea', desc: 'Una cresta de hueso que recorre la cabeza de adelante hacia atrás.', anclas: ['cabeza'], lados: 'unico', limites: R([[-0.06, 0.06], [-0.04, 0.12], [-0.10, 0.10]], [[-20, 20], [-20, 20], [-20, 20]], [0.6, 1.6]), tris: 320, mats: ['bone'], variantesMat: MATS_DURO, ocupa: ['cabeza.corona'], volumen: 0.003, valor: 25, obtencion: 'inicial' }),
  corona_espinas:    pieza('corona_espinas',    { cat: 'cosmetica', nombre: 'Corona de espinas', desc: 'Un aro de espinas que rodea la cabeza sin tapar la cara.', anclas: ['cabeza'], lados: 'unico', limites: R([[-0.05, 0.05], [-0.04, 0.12], [-0.05, 0.05]], [[-20, 20], [-20, 20], [-20, 20]], [0.7, 1.5]), tris: 380, mats: ['metal'], variantesMat: ['metal', 'gold', 'bone'], ocupa: ['cabeza.corona'], volumen: 0.002, valor: 30, obtencion: 'victorias:1' }),
  gorguera:          pieza('gorguera',          { cat: 'cosmetica', nombre: 'Gorguera', desc: 'Un collar ancho de placas alrededor del cuello.', anclas: ['cuello'], lados: 'unico', limites: R([[-0.05, 0.05], [-0.05, 0.05], [-0.05, 0.05]], [[-20, 20], [-20, 20], [-20, 20]], [0.7, 1.4]), tris: 300, mats: ['bone'], variantesMat: MATS_DURO, ocupa: ['cuello.collar'], volumen: 0.004, valor: 15, obtencion: 'inicial' }),
  hombrera_espinas:  pieza('hombrera_espinas',  { cat: 'cosmetica', nombre: 'Hombrera de espinas', desc: 'Una hombrera con púas curvas.', anclas: ['hombros'], lados: 'par', limites: R([[-0.06, 0.10], [-0.05, 0.10], [-0.08, 0.08]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.6]), tris: 520, mats: ['bone'], variantesMat: MATS_DURO, ocupa: ['hombros.hombrera'], volumen: 0.004, valor: 25, obtencion: 'inicial' }),
  placa_pectoral:    pieza('placa_pectoral',    { cat: 'cosmetica', nombre: 'Placa pectoral', desc: 'Una placa decorativa sobre el pecho. No protege: solo se ve.', anclas: ['pecho'], lados: 'unico', limites: R([[-0.08, 0.08], [-0.08, 0.08], [-0.03, 0.08]], [[-20, 20], [-20, 20], [-20, 20]], [0.6, 1.5]), tris: 420, mats: ['metal'], variantesMat: ['metal', 'bone', 'gold', 'stone'], choca_con: ['corazon_cristal'], ocupa: ['pecho.placa'], volumen: 0.003, valor: 20, obtencion: 'inicial' }),
  espinas_dorsales:  pieza('espinas_dorsales',  { cat: 'cosmetica', nombre: 'Espinas dorsales', desc: 'Una hilera de espinas a lo largo de la espalda.', anclas: ['espalda'], lados: 'unico', limites: R([[-0.06, 0.06], [-0.14, 0.14], [-0.10, 0.02]], [[-20, 20], [-20, 20], [-20, 20]], [0.6, 1.6]), tris: 460, mats: ['bone'], variantesMat: MATS_DURO, choca_con: ['alas_membrana'], ocupa: ['espalda.eje'], volumen: 0.004, valor: 20, obtencion: 'inicial' }),
  alas_membrana:     pieza('alas_membrana',     { cat: 'cosmetica', nombre: 'Alas de membrana', desc: 'Un par de alas de membrana. Es estético: no te hace volar.', anclas: ['espalda'], lados: 'unico', limites: R([[-0.06, 0.06], [-0.10, 0.12], [-0.12, 0.02]], [[-25, 25], [-25, 25], [-25, 25]], [0.7, 1.5]), tris: 1100, mats: ['leather', 'bone'], variantesMat: ['leather', 'cloth', 'flesh'], choca_con: ['espinas_dorsales'], ocupa: ['espalda.eje', 'espalda.alta'], volumen: 0.020, valor: 35, obtencion: 'victorias:3' }),
  cola_larga:        pieza('cola_larga',        { cat: 'cosmetica', nombre: 'Cola larga', desc: 'Una cola articulada que se mueve al caminar.', anclas: ['cola'], lados: 'unico', limites: R([[-0.04, 0.04], [-0.04, 0.04], [-0.10, 0.0]], [[-25, 25], [-25, 25], [-25, 25]], [0.7, 1.6]), tris: 900, mats: ['bone'], variantesMat: MATS_DURO, extra: { cadena: 1 }, ocupa: ['cola.cola'], volumen: 0.006, valor: 30, obtencion: 'bajas:150' }),
  cuchilla_antebrazo:pieza('cuchilla_antebrazo',{ cat: 'cosmetica', nombre: 'Cuchilla de antebrazo', desc: 'Una cuchilla pegada al antebrazo. Es decoración: el daño no cambia.', anclas: ['antebrazos'], lados: 'par', limites: R([[-0.04, 0.04], [-0.08, 0.10], [-0.04, 0.06]], [[-25, 25], [-25, 25], [-25, 25]], [0.6, 1.6]), tris: 360, mats: ['metal'], variantesMat: ['metal', 'bone', 'mirror'], ocupa: ['antebrazos.cuchilla'], volumen: 0.0015, valor: 20, obtencion: 'inicial' }),
  rodillera_placa:   pieza('rodillera_placa',   { cat: 'cosmetica', nombre: 'Rodillera de placa', desc: 'Una placa sobre la rodilla.', anclas: ['muslos'], lados: 'par', limites: R([[-0.05, 0.05], [-0.10, 0.12], [-0.04, 0.08]], [[-25, 25], [-25, 25], [-25, 25]], [0.6, 1.5]), tris: 300, mats: ['metal'], variantesMat: ['metal', 'bone', 'stone'], ocupa: ['muslos.rodillera'], volumen: 0.0015, valor: 15, obtencion: 'partidas:2' }),
  garras_mano:       pieza('garras_mano',       { cat: 'cosmetica', nombre: 'Garras de mano', desc: 'Garras que sobresalen de la mano izquierda (la derecha lleva el arma).', anclas: ['manos'], lados: 'par', limites: R([[-0.03, 0.03], [-0.03, 0.05], [-0.03, 0.04]], [[-20, 20], [-20, 20], [-20, 20]], [0.6, 1.4]), tris: 280, mats: ['bone'], variantesMat: MATS_DURO, ocupa: ['manos.garras'], volumen: 0.0008, valor: 15, obtencion: 'bajas:300' }),
  // ── 8 funcionales (visual de los CHAMP_ORGANS; el EFECTO sale de `organ`, no de la posición ni del tamaño) ──
  placas:            pieza('placas',            { cat: 'funcional', nombre: 'Placas quitinosas', desc: '12 % menos de daño recibido. Usa 1 ranura. La posición y el tamaño son solo estética.', anclas: ['pecho', 'espalda', 'hombros'], lados: 'par', limites: LIM_ANCHO, tris: 520, mats: ['bone'], variantesMat: MATS_DURO, volumen: 0.003, valor: 100, obtencion: 'inicial', organ: 'placas' }),
  adrenal:           pieza('adrenal',           { cat: 'funcional', nombre: 'Glándula adrenal', desc: '+8 % de velocidad y habilidades 8 % más rápidas. Usa 1 ranura.', anclas: ['cintura', 'espalda'], lados: 'unico', limites: LIM_GEN, tris: 300, mats: ['flesh'], variantesMat: MATS_CARNE, volumen: 0.0015, valor: 100, obtencion: 'inicial', organ: 'adrenal' }),
  ojo_extra:         pieza('ojo_extra',         { cat: 'funcional', nombre: 'Tercer ojo', desc: '+12 % de daño a todo y revela a los camuflados. Usa 1 ranura.', anclas: ['cabeza', 'pecho'], lados: 'unico', limites: R([[-0.06, 0.06], [-0.04, 0.12], [-0.06, 0.08]], [[-30, 30], [-30, 30], [-30, 30]], [0.6, 1.5]), tris: 260, mats: ['flesh', 'crystal'], variantesMat: ['flesh', 'leather'], extra: { halo: 1 }, volumen: 0.0006, valor: 100, obtencion: 'esencia:ojo', organ: 'ojo_extra' }),
  saco_g:            pieza('saco_g',            { cat: 'funcional', nombre: 'Saco gravitatorio', desc: 'Saltás un 25 % más alto y la definitiva se recupera un 15 % más rápido. Usa 1 ranura.', anclas: ['espalda', 'cintura'], lados: 'unico', limites: LIM_GEN, tris: 340, mats: ['flesh'], variantesMat: MATS_CARNE, volumen: 0.003, valor: 100, obtencion: 'esencia:vacio', organ: 'saco_g' }),
  medula:            pieza('medula',            { cat: 'funcional', nombre: 'Médula regenerativa', desc: 'Regenerás 1,5 de vida por segundo si llevás 3 s sin recibir daño. Usa 1 ranura.', anclas: ['espalda', 'pecho'], lados: 'unico', limites: LIM_GEN, tris: 380, mats: ['flesh', 'bone'], variantesMat: ['flesh', 'leather'], volumen: 0.002, valor: 100, obtencion: 'esencia:carne', organ: 'medula' }),
  tentaculo:         pieza('tentaculo',         { cat: 'funcional', nombre: 'Tentáculo prensil', desc: 'Cuerpo a cuerpo con +20 % de alcance y +10 % de daño. Usa 1 ranura.', anclas: ['espalda', 'hombros', 'cintura'], lados: 'par', limites: LIM_ANCHO, tris: 700, mats: ['flesh'], variantesMat: MATS_CARNE, extra: { cadena: 1 }, volumen: 0.004, valor: 100, obtencion: 'esencia:ojo', organ: 'tentaculo' }),
  corazon_cristal:   pieza('corazon_cristal',   { cat: 'funcional', nombre: 'Corazón de cristal', desc: 'El escudo se recarga un 50 % más rápido. Usa 1 ranura.', anclas: ['pecho'], lados: 'unico', limites: R([[-0.06, 0.06], [-0.06, 0.06], [-0.03, 0.08]], [[-20, 20], [-20, 20], [-20, 20]], [0.6, 1.5]), tris: 320, mats: ['crystal'], variantesMat: ['crystal'], extra: { halo: 1 }, choca_con: ['placa_pectoral'], volumen: 0.0012, valor: 100, obtencion: 'esencia:cristal', organ: 'corazon_cristal' }),
  espiraculo:        pieza('espiraculo',        { cat: 'funcional', nombre: 'Espiráculo', desc: 'La definitiva dura un 20 % más. Usa 1 ranura.', anclas: ['cabeza', 'espalda'], lados: 'unico', limites: LIM_GEN, tris: 300, mats: ['dark'], variantesMat: ['dark', 'stone'], volumen: 0.0015, valor: 100, obtencion: 'esencia:vacio', organ: 'espiraculo' }),
};
/** Catálogo de piezas por id (congelado). */
export const PARTES = Object.freeze(DEFS);
export const CATALOGO = PARTES;
/** Orden FIJO de piezas (índice = byte en VB1). SOLO-AÑADIR. */
export const ORDEN_PARTES = Object.freeze(Object.keys(DEFS));
export const COSMETICAS = Object.freeze(ORDEN_PARTES.filter((id) => DEFS[id].cat === 'cosmetica'));
export const FUNCIONALES = Object.freeze(ORDEN_PARTES.filter((id) => DEFS[id].cat === 'funcional'));

/** Piezas que el jugador tiene desde el primer día (obtencion 'inicial'). El resto se gana jugando (docs/EDITOR_HUESPEDES.md §6). */
export const PIEZAS_INICIALES = Object.freeze(ORDEN_PARTES.filter((id) => DEFS[id].obtencion === 'inicial'));

/** Efectos de las piezas funcionales (E1). Salen de CHAMP_ORGANS: aquí solo se escriben sus números para la vista previa. */
export const ORGANO_EFECTO = Object.freeze({
  placas: Object.freeze({ dmgIn: 0.88 }),
  adrenal: Object.freeze({ spd: 1.08, cd: 0.92 }),
  ojo_extra: Object.freeze({ danoSalida: 1.12, revela: 1 }),
  saco_g: Object.freeze({ salto: 1.25, ult: 1.15 }),
  medula: Object.freeze({ regenPorSeg: 1.5 }),
  tentaculo: Object.freeze({ melee: 1.1, meleeAlcance: 1.2 }),
  corazon_cristal: Object.freeze({ shield: 1.5 }),
  espiraculo: Object.freeze({ ultDur: 1.2 }),
});
/** Cambio de los 6 ejes DESCRIPTIVOS (solo para la interfaz; no se usan en combate). */
export const ORGANO_EJES = Object.freeze({
  placas: Object.freeze({ resistencia: 2 }), adrenal: Object.freeze({ movilidad: 2 }), ojo_extra: Object.freeze({ dano: 1, utilidad: 1 }),
  saco_g: Object.freeze({ movilidad: 1, utilidad: 1 }), medula: Object.freeze({ resistencia: 1, utilidad: 1 }), tentaculo: Object.freeze({ dano: 1, control: 1 }),
  corazon_cristal: Object.freeze({ resistencia: 1 }), espiraculo: Object.freeze({ dano: 1, utilidad: 1 }),
});
/** Cotas de los efectos que NO viven en p.bn (los de p.bn se acotan con CAPS). Los tests las usan como techo. */
export const LIMITES_EFECTO = Object.freeze({ danoSalida: 1.12, salto: 1.25, ultDur: 1.2, meleeAlcance: 1.2, regenPorSeg: 1.5 });

/* ───────── MENSAJES (español) de cada regla HB-xx. {…} se sustituye con los datos de la incidencia. ───────── */
export const MENSAJES = Object.freeze({
  'HB-01': 'Este diseño no se puede leer: es de una versión más nueva del juego o no tiene el formato correcto.',
  'HB-02': 'El nombre o el código del diseño no son válidos.',
  'HB-03': 'El diseño usa un esqueleto o un chasis que esta versión no conoce. Solo existe el Híbrido de Laboratorio.',
  'HB-04': 'Una proporción estaba fuera de su rango y se ajustó.',
  'HB-05': 'Las proporciones no combinan: {detalle}',
  'HB-06': 'La pieza «{pieza}» no existe en el catálogo o todavía no la tenés.',
  'HB-07': 'La pieza «{pieza}» no se puede colocar en «{ancla}».',
  'HB-08': 'La posición, el giro o el tamaño de «{pieza}» estaban fuera de los límites y se ajustaron.',
  'HB-09': 'Hay piezas que chocan: {detalle}',
  'HB-10': 'Demasiadas piezas: {detalle}',
  'HB-11': 'Se pasó del presupuesto de dibujo: {detalle}',
  'HB-12': 'La mano derecha ya lleva tu arma: no admite piezas.',
  'HB-13': 'Tenés más piezas funcionales ({usado}) que ranuras ({max}). Evolucioná al Híbrido para abrir más.',
  'HB-14': 'Una pieza funcional cuenta una sola vez: se quitó el duplicado de «{pieza}».',
  'HB-15': 'Un color no era válido o brillaba demasiado y se ajustó.',
  'HB-16': 'Las piezas tapan demasiado el cuerpo o la cara: {detalle}',
  'HB-17': 'El diseño es demasiado grande para enviarlo ({bytes} de {max}).',
  'HB-18': 'La huella del diseño no coincide: el contenido se modificó o se cortó.',
});
