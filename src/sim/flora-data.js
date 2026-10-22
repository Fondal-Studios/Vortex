// FLORA INTERACTIVA — DATOS PUROS (docs/FLORA.md). Sin lógica, sin DOM, sin azar: los lee la simulación (flora.js), el cliente
// (flora-fx.js, Herbario) y las pruebas. Todo el texto visible va en español.
//
// Tres FUNCIONES con un código de color fijo (el mismo en el suelo, en la planta y en el HUD):
//   CURATIVAS  → verde / cian / dorado        (ayuda)
//   OFENSIVAS  → rojo / magenta               (daño: muerden, hieren, atrapan, estallan)
//   TÓXICAS Y ESPECIALES → violeta / ácido    (veneno, sueño, espejo, savia pegajosa, brasas)
// Estados de cada planta: 0 brote (crece, inofensiva) · 1 madura (actúa) · 2 armando (aviso: ya va a actuar) · 3 marchita (se recupera) · 4 ausente.
export const FN = { cura: 'Curativa', ofensiva: 'Ofensiva', toxica: 'Tóxica / especial' };
export const CODIGO = { verde: '#52ff8a', cian: '#19f0ff', dorado: '#ffd45a', rojo: '#ff4a5a', magenta: '#ff3df2', violeta: '#b07bff', acido: '#c8ff2a' };
export const ST = { BROTE: 0, MADURA: 1, ARMANDO: 2, MARCHITA: 3, AUSENTE: 4 };
export const ST_ES = ['Brote', 'Madura', 'Armando', 'Marchita', 'Ausente'];

/** Reglas generales. Tiempos en segundos. */
export const FLORA = {
  maxActivas: 40,         // tope de entidades interactivas por arena (LIMITS.flora en data.js manda; esto es el valor por defecto)
  maxRaras: 4,            // plantas raras vivas a la vez (se suman a las de la arena)
  nubesMax: 6,            // nubes de esporas vivas a la vez
  telMin: 1.0,            // ninguna planta ofensiva actúa antes de 1 s de aviso (la regla del juego es ≥ 1 s)
  paso: 0.1,              // las interacciones con jugadores y criaturas se miden a 10 Hz
  danoPorOla: 0.06,       // el daño de las plantas sube 6 % por oleada
  curaIcd: 4,             // segundos entre dos curaciones de plantas para el mismo Huésped (no se encadenan)
  curaSiBajo: 0.72,       // la flor se come sola sólo si vida+escudo están por debajo de esta fracción (USAR la cosecha igual)
  venenoMin: 8,           // el veneno nunca baja la vida de un jugador de este valor
  distSpawn: 16,          // las ofensivas nacen a ≥ 16 m de donde aparecen los jugadores
  distClave: 10,          // …y a ≥ 10 m de los puntos de objetivo (las demás: 6 y 5)
  sepMin: 3.2,            // distancia mínima entre dos plantas
  cosechaR: 2.6,          // alcance de USAR para cosechar
  cosechaCd: 1.2,         // segundos entre dos cosechas del mismo Huésped
  rotaCosecha: 0.6,       // al destruir una planta se cae esta parte de lo que daría cosechada
  rebrotaRota: 1.5,       // una planta destruida tarda ×1,5 en rebrotar
  rareVida: 80,           // segundos que dura una planta rara antes de marchitarse para siempre
  fuego: { dur: 6, r: 2.8, dps: 5, mdps: 14, propaga: 4.2, prob: 0.4 },
  hielo: { dur: 6, rompe: 3 },        // congelada no actúa; el siguiente golpe fuerte (×3) la rompe
};

/** Qué da cada material vegetal y cómo se llama (los datos completos —colores, calidades— viven en items.js → MATERIALES). */
export const MAT_FLORA = ['fibra', 'savia', 'petalo', 'resina', 'nectar', 'hoja_espejo', 'raiz_hierro', 'polen'];

/* ───────── ESPECIES ─────────
 * i: índice estable (viaja en el snapshot) · mapa: arena donde crece (o null = rara de evento) · fn · col (código de color) · tipo (comportamiento)
 * hp / r (radio de acción) / brote (s de crecimiento) / rebrota (s para volver tras marchitarse) · p: parámetros del comportamiento
 * cos: cosecha { mat, n: [mín, máx], q: calidad base 0..3 } · forma: silueta del cliente · infl: se prende fuego · tox: inmune a veneno y esporas
 * desc (qué hace) · folk (folclore) · tele (cómo avisa) · contra (cómo se esquiva, destruye o aprovecha) */
export const ESPECIES = {
  /* ── m1 · Vacío de Islas (ánimas y luces malas) ── */
  flor_luz: { i: 0, nombre: 'Flor de Luz Mala', mapa: 'm1', fn: 'cura', col: 'cian', tipo: 'cura', forma: 'flor', hp: 26, r: 1.8, brote: 8, rebrota: 45,
    p: { hp: 18, sh: 14 }, cos: { mat: 'petalo', n: [1, 2], q: 1 },
    desc: 'Florece donde se apagó un ánima. Si estás herido, su luz tibia te cura vida y escudo (y se marchita).',
    folk: 'Dicen que la Luz Mala es un alma que no encontró camino; donde se posa, nace esta flor.',
    tele: 'Se abre y brilla cian cuando está lista; cerrada y gris, todavía no.', contra: 'Los enemigos a distancia la rompen: comela antes. Con USAR la cosechás (pétalo de luz).' },
  liana_ancla: { i: 1, nombre: 'Liana Aferradora', mapa: 'm1', fn: 'ofensiva', col: 'magenta', tipo: 'liana', forma: 'liana', hp: 70, r: 2.6, brote: 10, rebrota: 40,
    p: { rt: 3.2, tel: 1.1, dmg: 7, raiz: 1.6, mraiz: 3, mdmg: 22, cd: 6, usos: 4 }, cos: { mat: 'fibra', n: [1, 2], q: 1 },
    desc: 'Si algo pasa cerca, sus lianas se enroscan al suelo y lo atrapan un instante (Huésped o criatura).',
    folk: 'Las islas flotantes cuelgan raíces al vacío: la Liana busca algo que tirar abajo.',
    tele: 'Un anillo magenta se cierra durante 1,1 s antes de atrapar.', contra: 'Salí del anillo antes de que se cierre, rompela de lejos o llevá enemigos hasta ella.' },
  hongo_anima: { i: 2, nombre: 'Hongo de Ánima', mapa: 'm1', fn: 'toxica', col: 'violeta', tipo: 'hongo', forma: 'hongo', hp: 30, r: 3.4, brote: 9, rebrota: 40, tox: true,
    p: { rt: 3.4, tel: 1.2, nube: 'veneno', nr: 4.6, vida: 7, dps: 2.4, mdps: 6, vel: 0.85 }, cos: { mat: 'polen', n: [1, 2], q: 1 },
    desc: 'Se hincha con el aliento de quien pasa y suelta una nube de esporas venenosas que se queda un rato.',
    folk: 'Brota de las ánimas que se quedaron a mirar. Su veneno marea, pero nunca mata.',
    tele: 'La seta se hincha y se pone violeta durante 1,2 s antes de soltar la nube.', contra: 'Reventala de lejos para que la nube caiga sobre los enemigos. El veneno de la nube no te baja de 8 de vida.' },
  /* ── m2 · Cámara Fractal (espejos y ecos) ── */
  fruto_eco: { i: 3, nombre: 'Fruto de Eco', mapa: 'm2', fn: 'cura', col: 'dorado', tipo: 'energia', forma: 'fruto', hp: 30, r: 1.9, brote: 10, rebrota: 55,
    p: { ultSeconds: 2.8, cd: 0.6, icd: 4 }, cos: { mat: 'nectar', n: [1, 2], q: 1 },
    desc: 'Un fruto dorado que repite lo que le cantás: al comerlo reducís la espera de la definitiva y acelerás tus habilidades.',
    folk: 'En la Cámara todo vuelve; este fruto vuelve a dar fuerza.', tele: 'Brilla dorado y late cuando está maduro.', contra: 'Se come al pasar (si tenés habilidades en espera). Los enemigos a distancia lo rompen.' },
  planta_espejo: { i: 4, nombre: 'Planta Espejo', mapa: 'm2', fn: 'toxica', col: 'cian', tipo: 'espejo', forma: 'espejo', hp: 70, r: 2.6, brote: 12, rebrota: 50,
    p: { reflejos: 4, costo: 16 }, cos: { mat: 'hoja_espejo', n: [1, 1], q: 2 },
    desc: 'Sus hojas son espejos: devuelven los proyectiles enemigos que pasan cerca. Cada reflejo la agrieta.',
    folk: 'Quien se mira demasiado en la Cámara se vuelve eco; esta planta nunca dejó de mirar.', tele: 'Las hojas giran hacia el disparo y destellan al reflejar.', contra: 'Parate detrás de ella: los disparos de los enemigos vuelven. No refleja los tuyos.' },
  zarza_cristal: { i: 5, nombre: 'Zarza de Cristal', mapa: 'm2', fn: 'ofensiva', col: 'magenta', tipo: 'zarza', forma: 'zarza', hp: 60, r: 2.3, brote: 8, rebrota: 40,
    p: { gracia: 0.5, tick: 0.6, dmg: 6, mdps: 5, vel: 0.55 }, cos: { mat: 'fibra', n: [1, 2], q: 1 },
    desc: 'Un matorral de filos de cristal: hiere y frena a quien se queda adentro (a vos y a las criaturas).',
    folk: 'Crece donde un espejo se rompió hacia adentro.', tele: 'Las púas se erizan y el anillo del suelo queda marcado todo el tiempo.', contra: 'Cruzala rápido (el daño empieza a los 0,5 s) o rodeala; atraé enemigos para que se frenen.' },
  /* ── m3 · Laberinto Celestial (cantos y silbidos) ── */
  brote_coro: { i: 6, nombre: 'Brote del Coro', mapa: 'm3', fn: 'cura', col: 'verde', tipo: 'escudo', forma: 'brote', hp: 26, r: 1.8, brote: 7, rebrota: 40,
    p: { sh: 45, ward: 0.8, wardT: 6, hp: 6 }, cos: { mat: 'savia', n: [1, 2], q: 1 },
    desc: 'Un brote que canta bajito: te da escudo y, 6 segundos, recibís 20 % menos de daño.',
    folk: 'El Coro del laberinto siembra estos brotes para que nadie cante solo.', tele: 'Verde brillante y con anillos de sonido cuando está listo.', contra: 'Se come al pasar si te falta escudo. Los enemigos a distancia lo rompen.' },
  flor_sueno: { i: 7, nombre: 'Flor del Sueño', mapa: 'm3', fn: 'toxica', col: 'violeta', tipo: 'narcotica', forma: 'sueno', hp: 28, r: 4.2, brote: 9, rebrota: 45, tox: true,
    p: { rt: 9, tel: 1.2, nube: 'sueno', nr: 4.4, vida: 7, vel: 0.5, mvel: 0.35, cada: 12 }, cos: { mat: 'polen', n: [1, 2], q: 1 },
    desc: 'Exhala una nube narcótica que adormece: te ralentiza a la mitad y deja a las criaturas casi quietas.',
    folk: 'Es el silbido del laberinto hecho flor: te canta hasta que se te cierran los ojos.', tele: 'Cierra los pétalos y se pone violeta 1,2 s antes de exhalar.', contra: 'Mantenete a más de 9 m o fuera de la nube. Atraé a los enemigos adentro: es control gratis.' },
  vejiga_silbido: { i: 8, nombre: 'Vejiga Silbadora', mapa: 'm3', fn: 'ofensiva', col: 'rojo', tipo: 'explosiva', forma: 'vejiga', hp: 14, r: 4.5, brote: 8, rebrota: 35,
    p: { rt: 1.6, tel: 1.1, dmg: 26, mdmg: 70, plantas: 30 }, cos: { mat: 'fibra', n: [1, 2], q: 1 },
    desc: 'Una vejiga llena de aire que estalla cuando la golpean (o la rozan): daña a todo lo que tenga cerca.',
    folk: 'Silba cuando el aire adentro quiere salir.', tele: 'Se hincha, silba y parpadea rojo 1,1 s antes de reventar.', contra: 'Disparale de lejos, o llevá enemigos hasta ella. Evitá rozarla.' },
  /* ── m4 · Jardín de Carne (raíces y carne) ── */
  bulbo_vital: { i: 9, nombre: 'Bulbo Vital', mapa: 'm4', fn: 'cura', col: 'verde', tipo: 'aura', forma: 'bulbo', hp: 70, r: 3.2, brote: 12, rebrota: 50,
    p: { hps: 2.6, shs: 1.5, reserva: 55 }, cos: { mat: 'savia', n: [1, 2], q: 1 },
    desc: 'Un bulbo tibio que cura despacio a quien se queda cerca, hasta agotar su reserva y marchitarse.',
    folk: 'El Jardín se cura a sí mismo: éste es uno de sus corazoncitos.', tele: 'Late verde y su anillo en el suelo se achica a medida que se agota.', contra: 'Curación lenta, no instantánea. Los enemigos lo pisotean: defendelo.' },
  boca_jardin: { i: 10, nombre: 'Boca del Jardín', mapa: 'm4', fn: 'ofensiva', col: 'rojo', tipo: 'muerde', forma: 'carnivora', hp: 90, r: 2.8, brote: 12, rebrota: 45,
    p: { rt: 3.4, tel: 1.2, dmg: 15, mdmg: 55, cd: 3.5 }, cos: { mat: 'raiz_hierro', n: [1, 1], q: 1 },
    desc: 'Planta carnívora: si algo pasa cerca abre la boca y muerde. Muerde igual al Huésped distraído que a una criatura.',
    folk: 'Las raíces buscan carne tibia; ésta ya le tomó el gusto.', tele: 'Abre la boca y un anillo rojo se cierra 1,2 s antes del mordisco.', contra: 'Retrocedé al ver el anillo, destruila de lejos o llevá criaturas a su boca.' },
  arbol_savia: { i: 11, nombre: 'Árbol de Savia', mapa: 'm4', fn: 'toxica', col: 'acido', tipo: 'savia', forma: 'arbol', hp: 120, r: 4.2, brote: 14, rebrota: 60, infl: true,
    p: { vel: 0.6, mvel: 0.6 }, cos: { mat: 'resina', n: [1, 2], q: 1 },
    desc: 'Chorrea savia pegajosa: quien pisa el charco camina al 60 % (vos y las criaturas). Es inflamable.',
    folk: 'Cada gota de savia recuerda un paso que no pudo darse.', tele: 'El charco ámbar del suelo se ve siempre.', contra: 'Rodealo, o atraé enemigos al charco. Con fuego arde (y suelta resina).' },
  /* ── m5 · Plaza de los Ecos (reloj y ciudad muerta) ── */
  fruto_hora: { i: 12, nombre: 'Fruto de la Hora', mapa: 'm5', fn: 'cura', col: 'dorado', tipo: 'energia', forma: 'fruto', hp: 30, r: 1.9, brote: 10, rebrota: 55,
    p: { ultSeconds: 1.8, cd: 0.4, icd: 4, hp: 8 }, cos: { mat: 'nectar', n: [1, 2], q: 1 },
    desc: 'Un fruto que maduró fuera de hora: al comerlo recuperás tiempo (tus habilidades se recargan antes) incluida la definitiva.',
    folk: 'El relojero sembró horas entre los adoquines.', tele: 'Dorado y con un tictac visible cuando está maduro.', contra: 'Se come al pasar. Los enemigos a distancia lo rompen.' },
  hiedra_espina: { i: 13, nombre: 'Hiedra del Relojero', mapa: 'm5', fn: 'ofensiva', col: 'magenta', tipo: 'zarza', forma: 'zarza', hp: 60, r: 2.3, brote: 8, rebrota: 40, infl: true,
    p: { gracia: 0.5, tick: 0.6, dmg: 6, mdps: 5, vel: 0.55 }, cos: { mat: 'fibra', n: [1, 2], q: 1 },
    desc: 'Una hiedra de espinas finas que trepa por las fachadas y el suelo: hiere y frena. Se quema.',
    folk: 'Crece por las grietas de los adoquines buscando el reloj.', tele: 'Espinas erizadas y anillo magenta siempre visible.', contra: 'Cruzala rápido, quemala o llevá enemigos adentro.' },
  arbusto_brasas: { i: 14, nombre: 'Arbusto de Brasas', mapa: 'm5', fn: 'toxica', col: 'rojo', tipo: 'brasas', forma: 'arbusto', hp: 40, r: 3.0, brote: 9, rebrota: 60, infl: true,
    p: { tel: 1.0 }, cos: { mat: 'resina', n: [1, 2], q: 1 },
    desc: 'Un arbusto de ramas al rojo, inflamable: si lo golpean con fuego (o una explosión) arde y prende a las plantas de al lado.',
    folk: 'Los faroles de la plaza se apagaron, pero el fuego se quedó en estas ramas.', tele: 'Chispea 1 s antes de arder.', contra: 'Prendelo de lejos con un arma de fuego cuando haya criaturas cerca; evitá pelear al lado.' },
  /* ── m6 · Osario sin Techo (huesos que no descansan) ── */
  lirio_osario: { i: 15, nombre: 'Lirio del Osario', mapa: 'm6', fn: 'cura', col: 'cian', tipo: 'cura', forma: 'lirio', hp: 26, r: 1.8, brote: 8, rebrota: 45,
    p: { hp: 12, sh: 30 }, cos: { mat: 'petalo', n: [1, 2], q: 1 },
    desc: 'Un lirio blanco entre los huesos: su polen frío te da sobre todo escudo, y algo de vida.',
    folk: 'Las flores del osario florecen para los que no tienen quién les lleve flores.', tele: 'Abierto y blanco azulado cuando está listo.', contra: 'Se come al pasar si te falta escudo. Cosechalo con USAR.' },
  boca_hueso: { i: 16, nombre: 'Boca de Hueso', mapa: 'm6', fn: 'ofensiva', col: 'rojo', tipo: 'muerde', forma: 'carnivora', hp: 110, r: 3.0, brote: 14, rebrota: 50,
    p: { rt: 3.0, tel: 1.5, dmg: 19, mdmg: 70, cd: 5 }, cos: { mat: 'raiz_hierro', n: [1, 2], q: 1 },
    desc: 'Una carnívora con dientes de hueso: tarda más en morder, pero muerde fuerte y a todos los que estén en la boca.',
    folk: 'Los huesos se arman solos; éstos se armaron de planta.', tele: 'Abre la mandíbula 1,5 s, con un anillo rojo que se cierra.', contra: 'Es lenta: retrocedé al ver el aviso. Destruila de lejos.' },
  cardo_ceniza: { i: 17, nombre: 'Cardo de Ceniza', mapa: 'm6', fn: 'ofensiva', col: 'magenta', tipo: 'explosiva', forma: 'cardo', hp: 18, r: 4.2, brote: 8, rebrota: 40, infl: true,
    p: { rt: 1.6, tel: 1.1, dmg: 22, mdmg: 60, plantas: 30, fuego: true }, cos: { mat: 'polen', n: [1, 2], q: 1 },
    desc: 'Un cardo de cenizas encendidas: estalla con un golpe y deja fuego que prende a las plantas cercanas y a las criaturas.',
    folk: 'Del Osario queda la ceniza; el cardo la guarda caliente.', tele: 'Se pone al rojo y chispea 1,1 s antes de estallar.', contra: 'Disparale de lejos cuando haya criaturas cerca. Evitá el fuego que deja.' },
  /* ── RARAS: sólo aparecen en eventos, misiones o contra el jefe (se anuncian en el briefing) ── */
  flor_aurora: { i: 18, nombre: 'Flor de la Aurora', mapa: null, rara: { evento: 'aurora_bendita' }, fn: 'cura', col: 'dorado', tipo: 'cura', forma: 'flor', hp: 40, r: 2.0, brote: 4, rebrota: 0,
    p: { hp: 45, sh: 45 }, cos: { mat: 'petalo', n: [2, 3], q: 3 }, semilla: true,
    desc: 'Brota dentro de la zona dorada de la Bendición de la Aurora: la mejor flor curativa. Pétalos Perfectos.',
    folk: 'Dicen que sólo florece cuando alguien aguanta hasta el amanecer.', tele: 'Dorada, con un pilar de luz.', contra: 'Dura poco (80 s): recogela o cosechala antes de que se marchite.' },
  loto_eclipse: { i: 19, nombre: 'Loto del Eclipse', mapa: null, rara: { evento: 'eclipse' }, fn: 'cura', col: 'violeta', tipo: 'cura', forma: 'lirio', hp: 40, r: 2.0, brote: 4, rebrota: 0,
    p: { hp: 30, sh: 60 }, cos: { mat: 'nectar', n: [2, 3], q: 3 }, semilla: true,
    desc: 'Se abre sólo con el Eclipse, cerca de vos. Néctar Perfecto y mucho escudo, pero se marchita pronto.',
    folk: 'Bebe la oscuridad y la devuelve como luz violeta.', tele: 'Violeta brillante contra el cielo oscuro.', contra: 'Dura 80 s; con el Eclipse también hay élites: elegí qué hacés primero.' },
  retono_pacto: { i: 20, nombre: 'Retoño del Pacto', mapa: null, rara: { mision: true }, fn: 'cura', col: 'verde', tipo: 'cura', forma: 'brote', hp: 40, r: 2.0, brote: 4, rebrota: 0,
    p: { hp: 30, sh: 30 }, cos: { mat: 'resina', n: [2, 3], q: 3 }, semilla: true,
    desc: 'Brota cuando cumplís una misión opcional: la tierra agradece. Resina Perfecta.',
    folk: 'Cada pacto cumplido deja una semilla.', tele: 'Verde con hilos de luz.', contra: 'Dura 80 s. Cosechalo con USAR.' },
  corona_jefe: { i: 21, nombre: 'Corona del Jefe', mapa: null, rara: { jefe: true }, fn: 'ofensiva', col: 'rojo', tipo: 'muerde', forma: 'carnivora', hp: 160, r: 3.4, brote: 4, rebrota: 0,
    p: { rt: 3.8, tel: 1.3, dmg: 22, mdmg: 90, cd: 4 }, cos: { mat: 'raiz_hierro', n: [2, 3], q: 3 }, semilla: true,
    desc: 'Una carnívora enorme que brota en la oleada del jefe. Muerde fuerte, pero su raíz-hierro es de calidad Perfecta.',
    folk: 'Sólo crece donde un jefe pisa fuerte.', tele: 'Abre la boca 1,3 s con un anillo rojo.', contra: 'Destruila de lejos (botín) o cosechala con cuidado. Dura 80 s.' },
};
export const ESP_IDS = Object.keys(ESPECIES);
export const ESP_POR_INDICE = ESP_IDS.slice().sort((a, b) => ESPECIES[a].i - ESPECIES[b].i);
for (const id of ESP_IDS) ESPECIES[id].id = id;
export const especieDe = (i) => ESPECIES[ESP_POR_INDICE[i]] || null;

/** Qué crece en cada arena (cantidad por especie). Total ≈ 22–24 por arena; con las raras nunca pasa de LIMITS.flora. */
export const ARENA_FLORA = {
  m1: { flor_luz: 7, liana_ancla: 8, hongo_anima: 7 },
  m2: { fruto_eco: 6, planta_espejo: 5, zarza_cristal: 10 },
  m3: { brote_coro: 7, flor_sueno: 6, vejiga_silbido: 9 },
  m4: { bulbo_vital: 6, boca_jardin: 8, arbol_savia: 7 },
  m5: { fruto_hora: 6, hiedra_espina: 9, arbusto_brasas: 7 },
  m6: { lirio_osario: 7, boca_hueso: 6, cardo_ceniza: 8 },
};
/** Texto de cada arena para el briefing (qué flora hay y qué raras pueden aparecer). */
export function floraBriefing(mapId) {
  const A = ARENA_FLORA[mapId]; if (!A) return [];
  const L = Object.keys(A).map((id) => `${ESPECIES[id].nombre} (${FN[ESPECIES[id].fn].toLowerCase()})`);
  return [`Flora de la arena: ${L.join(', ')}.`,
    'Plantas raras: Flor de la Aurora (con la Bendición de la Aurora), Loto del Eclipse (con el Eclipse), Retoño del Pacto (al cumplir una misión opcional) y Corona del Jefe (en la oleada del jefe). Dan materiales Perfectos y planos de jardín.'];
}

/** Colores por arena (paleta propia: lo que el cliente usa para el pasto, las hojas y las esporas flotando). */
export const PALETA_ARENA = {
  m1: { a: '#19f0ff', b: '#ff3df2', hoja: '#7fffe8', suelo: '#0e8fa8' },
  m2: { a: '#9b5cff', b: '#ffb52e', hoja: '#d9b8ff', suelo: '#5b2fb0' },
  m3: { a: '#3dffb8', b: '#e8fbff', hoja: '#b8ffe6', suelo: '#16966c' },
  m4: { a: '#ff2f5e', b: '#b6ff2a', hoja: '#e8ff7a', suelo: '#8a1a38' },
  m5: { a: '#ffcf4a', b: '#2f63ff', hoja: '#ffe9a8', suelo: '#8a6a1a' },
  m6: { a: '#efe6c8', b: '#ff6a14', hoja: '#f2e8c8', suelo: '#7a6a4a' },
};

/* ───────── HERBARIO: hitos que dan mejoras permanentes PEQUEÑAS (se guardan en el perfil como ids; el servidor los acota) ───────── */
export const HITOS = {
  desc3:  { id: 'desc3',  nombre: 'Ojo de botánico', txt: 'Descubrí 3 especies', cond: { descubiertas: 3 }, mod: { cura: 0.03 } },
  desc8:  { id: 'desc8',  nombre: 'Colección en marcha', txt: 'Descubrí 8 especies', cond: { descubiertas: 8 }, mod: { cura: 0.04, resis: 0.05 } },
  desc14: { id: 'desc14', nombre: 'Herbario grande', txt: 'Descubrí 14 especies', cond: { descubiertas: 14 }, mod: { resis: 0.05, cura: 0.03 } },
  desc22: { id: 'desc22', nombre: 'Herbario completo', txt: 'Descubrí las 22 especies', cond: { descubiertas: 22 }, mod: { cura: 0.03, resis: 0.05, cos: 1 } },
  cos10:  { id: 'cos10',  nombre: 'Manos verdes', txt: 'Cosechá 10 plantas', cond: { cosechas: 10 }, mod: { cos: 0 , calidad: 0.05 } },
  cos40:  { id: 'cos40',  nombre: 'Buena mano', txt: 'Cosechá 40 plantas', cond: { cosechas: 40 }, mod: { calidad: 0.05, cos: 1 } },
  rara1:  { id: 'rara1',  nombre: 'Rareza hallada', txt: 'Encontrá una planta rara', cond: { raras: 1 }, mod: { calidad: 0.05 } },
  rara4:  { id: 'rara4',  nombre: 'Cazador de raras', txt: 'Encontrá las 4 plantas raras', cond: { raras: 4 }, mod: { cura: 0.03, calidad: 0.05 } },
};
export const HITO_IDS = Object.keys(HITOS);
/** Tope de las mejoras del Herbario (nada se acumula de más): cura +15 %, resistencia a las plantas +15 %, +1 cosecha, calidad +15 %. */
export const HERB_TOPE = { cura: 0.15, resis: 0.15, cos: 1, calidad: 0.15 };
/** Mods totales de una lista de hitos (saneada: ids falsos se ignoran). Devuelve { cura, resis, cos, calidad }. */
export function herbMods(ids) {
  const m = { cura: 0, resis: 0, cos: 0, calidad: 0 };
  for (const id of new Set(Array.isArray(ids) ? ids : [])) { const H = HITOS[id]; if (!H) continue; for (const k of Object.keys(m)) m[k] += H.mod[k] || 0; }
  for (const k of Object.keys(m)) m[k] = Math.min(HERB_TOPE[k], m[k]);
  return m;
}
/** Qué hitos se cumplen con este estado del herbario { vistas:{sp:n}, cosechas:{sp:n} }. */
export function hitosCumplidos(h) {
  const desc = Object.keys((h && h.vistas) || {}).filter((k) => ESPECIES[k]).length;
  const cos = Object.entries((h && h.cosechas) || {}).filter(([k]) => ESPECIES[k]).reduce((a, [, n]) => a + (+n || 0), 0);
  const raras = Object.keys((h && h.vistas) || {}).filter((k) => ESPECIES[k] && ESPECIES[k].rara).length;
  return HITO_IDS.filter((id) => { const c = HITOS[id].cond; return (c.descubiertas == null || desc >= c.descubiertas) && (c.cosechas == null || cos >= c.cosechas) && (c.raras == null || raras >= c.raras); });
}
