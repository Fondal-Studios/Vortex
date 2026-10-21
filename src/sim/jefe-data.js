// DATOS de los jefes de las 6 arenas: fases, nombres, repertorio de mecánicas y posturas de la IA adaptativa.
// Sin lógica (la lógica vive en jefe-ia.js y jefe-mec.js). Los textos son lo que ve el jugador: todo en español.
// Documentación: docs/JEFES.md.

/** Umbrales de vida (fracción) para pasar a las fases 2, 3 y 4. */
export const FASE_UMBRALES = [0.75, 0.5, 0.25];

/** Reglas de la IA adaptativa (docs/JEFES.md → «Parámetros»). Tiempos en segundos. */
export const IA = {
  muestra: 0.25,        // cada cuánto se mide a los jugadores
  ventana: 20,          // ventana deslizante del perfil (cubetas de 1 s)
  memoria: 60,          // constante de tiempo de la memoria larga (decaimiento exponencial; NO se borra al cambiar de fase)
  mezclaMemoria: 0.3,   // peso de la memoria larga frente a la ventana reciente
  primera: 7,           // no adapta antes de tener este tiempo de combate y de datos
  confMin: 0.4,         // confianza mínima para adoptar una postura
  histeresis: 0.15,     // el rival debe superar al estilo actual por este margen...
  persiste: 4,          // ...durante estos segundos seguidos
  gracia: 11,           // tras cambiar de postura no cambia otra vez antes de este tiempo (ventana de gracia)
  rampa: 5,             // segundos que tarda una postura en llegar a su fuerza plena
  rezago: 10,           // si un jugador cambia de MODO (Disparo ↔ Melé) el jefe tarda esto en readaptar
  descon: 1.1,          // mientras está desconcertado recibe un 10 % más de daño
  topeRes: 0.25,        // TOPE de resistencia por adaptación (+25 %: el daño se divide por 1,25 como mucho)
  resFase: [0.4, 0.6, 0.8, 1],   // fracción del tope que se usa en cada fase: la adaptación se endurece a medida que avanza el combate
  pisoMul: 0.2,         // jamás baja de este multiplicador total (nunca inmunidad)
  actividadMin: 70,     // daño en la ventana por debajo del cual el jugador cuenta como «pasivo»
  // enfurecimiento por tiempo
  enrageT: 600, enrageCoop: 90, enrageRampa: 60, enrageDanio: 0.4, enrageRitmo: 0.35,
};

/** Posturas: lo que el jugador ve en la barra del jefe (icono + texto corto) y el aviso al adoptarla. */
export const POSTURAS = {
  neutro:     { id: 'neutro', icono: '◇', corto: 'Midiendo tu estilo', contra: null,
    aviso: '' },
  antimele:   { id: 'antimele', icono: '✶', corto: 'Coraza de espinas', contra: 'melee',
    aviso: '¡{jefe} aprende de ti! Se endurece contra tu puño', pista: 'Peleá a distancia o con habilidades, o cambiá de modo.' },
  antidist:   { id: 'antidist', icono: '⛨', corto: 'Muro de reflejos', contra: 'gun',
    aviso: '¡{jefe} aprende de ti! Se cubre de tus disparos y cierra la distancia', pista: 'Flanqueá, usá el puño o las habilidades, o cambiá de modo.' },
  antihab:    { id: 'antihab', icono: '⌁', corto: 'Silencio y absorción', contra: 'skill',
    aviso: '¡{jefe} aprende de ti! Absorbe tus habilidades y quiere silenciarte', pista: 'Alterná con golpes o disparos, o cambiá de modo.' },
  antipasivo: { id: 'antipasivo', icono: '☗', corto: 'Asedio de zonas', contra: null,
    aviso: '¡{jefe} aprende de ti! Te niega el espacio con zonas y trampas', pista: 'Atacá con decisión: quedarse esquivando no alcanza.' },
};
export const POSTURA_IDS = Object.keys(POSTURAS);
/** Estilo del jugador/equipo → postura con que el jefe lo contrarresta. */
export const CONTRA = { melee: 'antimele', shooter: 'antidist', skills: 'antihab', passive: 'antipasivo', mixed: 'neutro' };
/** Nombres de estilos para el HUD. */
export const ESTILOS = {
  melee: { icono: '✊', nombre: 'Melé cercano' }, shooter: { icono: '➶', nombre: 'Tirador a distancia' }, skills: { icono: '✺', nombre: 'Habilidades' },
  passive: { icono: '☂', nombre: 'Esquivador' }, mixed: { icono: '☯', nombre: 'Mixto' },
};

/**
 * Repertorio de ataques de mecánica (jefe-mec.js). `f`: fase mínima; `w`: peso base; `st`: multiplicadores de peso por postura.
 * Todo ataque tiene una telegrafía de al menos 1 s (marca en el suelo + color + sonido).
 */
export const REPERTORIO = {
  nova:      { f: 1, w: 3.0, st: { antimele: 2.4 }, nombre: 'Onda circular', color: 0xff5a2a },
  zonas:     { f: 1, w: 3.0, st: { antipasivo: 3 }, nombre: 'Zonas de peligro', color: 0xffb02a },
  barrido:   { f: 2, w: 2.0, st: { antipasivo: 2.2, antimele: 1.3 }, nombre: 'Aspas giratorias', color: 0xff3a6a },
  carga:     { f: 2, w: 1.0, st: { antidist: 3.5 }, nombre: 'Picada', color: 0xff2a2a },
  reflejo:   { f: 1, w: 0.4, st: { antidist: 5 }, nombre: 'Muro de reflejos', color: 0x6ad8ff },
  espinas:   { f: 1, w: 0.4, st: { antimele: 5 }, nombre: 'Coraza de espinas', color: 0xff6a3a },
  silencio:  { f: 1, w: 0.4, st: { antihab: 6 }, nombre: 'Silencio', color: 0xa86aff },
  voladores: { f: 2, w: 0.8, st: { antidist: 4 }, nombre: 'Vuelo de almas', color: 0x9affd8 },
  reparto:   { f: 3, w: 1.2, st: {}, nombre: 'Juntos', color: 0xffe14a },
  arena:     { f: 2, w: 1.1, st: { antipasivo: 2, antihab: 1.4 }, nombre: 'El campo responde', color: 0x7affc8 },
  muralla:   { f: 2, w: 0.3, st: { antidist: 6 }, nombre: 'Muralla de huesos', color: 0xe8e0c8 },
  trampas:   { f: 2, w: 0.3, st: { antipasivo: 9 }, nombre: 'Trampas', color: 0xff9a2a },
};

/**
 * Los 6 jefes. `base`: IA/cuerpo que usa (coloso | argos | madre). `unico`: su MOMENTO ÚNICO (se dispara al entrar en la fase 3 y luego
 * vuelve cada tanto). `sin`: ataques del repertorio que NO usa. `arena`: cómo usa el organismo vivo / nieblas / flora de su mapa.
 */
export const JEFES = {
  m1: { base: 'coloso', nombre: 'El Mandinga', color: '#ff7a2a', sin: [],
    fases: ['El Trato', 'Brasas del Pacto', 'Pisotón', 'Furia del Mandinga'],
    unico: { id: 'pisoton', nombre: 'PISOTÓN', aviso: '¡El Mandinga se alza! Va a caer: saltá la onda y pegale al núcleo' },
    arena: { niebla: 'negra', ordenar: true, fuego: true, etiqueta: 'El Mandinga le ordena al Corazón de Isla' },
    desc: 'Se alza y cae de pisotón: tras la onda queda con el núcleo al descubierto.' },
  m2: { base: 'madre', nombre: 'La Madre de las Ánimas', color: '#ff2f5e', sin: ['carga', 'voladores'],
    fases: ['La Gestación', 'El Parto', 'Raíces', 'Madre Furiosa'],
    unico: { id: 'parto', nombre: 'EL PARTO', aviso: '¡La Madre va a parir! Rompé los huevos antes de que nazcan' },
    arena: { niebla: 'magenta', ordenar: true, fuego: false, etiqueta: 'La Madre le ordena al Espejo que Respira' },
    desc: 'Pare crías protectoras y clava raíces: si rompés todos los huevos queda abierta.' },
  m3: { base: 'argos', nombre: 'El Basilisco', color: '#9b5cff', sin: [],
    fases: ['Ojos Abiertos', 'El Laberinto Mira', 'Mirada Total', 'Párpados Rotos'],
    unico: { id: 'mirada_total', nombre: 'MIRADA TOTAL', aviso: '¡MIRADA TOTAL! Todos los ojos se abren: cubrite detrás de un muro' },
    arena: { niebla: 'blanca', ordenar: true, fuego: false, etiqueta: 'El Basilisco hace cantar a la Garganta' },
    desc: 'Abre todos los ojos y barre el laberinto con la mirada: sólo los muros te salvan.' },
  m4: { base: 'argos', nombre: 'El Basilisco del Jardín', color: '#b6ff2a', sin: [],
    fases: ['Capullo de Ojos', 'Floración', 'Raíces y Mirada', 'Marchitez Furiosa'],
    unico: { id: 'floracion', nombre: 'FLORACIÓN DE OJOS', aviso: '¡Le brotan ojos al Jardín! Rompelos antes de que revienten' },
    arena: { niebla: 'acida', ordenar: true, fuego: true, etiqueta: 'El Basilisco despierta a la Madre Raíz' },
    desc: 'Hace brotar ojos en el suelo que disparan miradas cortas y estallan si no los rompés.' },
  m5: { base: 'coloso', nombre: 'El Mandinga del Reloj', color: '#ffb52e', sin: [],
    fases: ['El Pacto', 'Campanadas', 'Medianoche', 'Hora Detenida'],
    unico: { id: 'campanadas', nombre: 'LAS DOCE CAMPANADAS', aviso: '¡Doce campanadas! Seguí el reloj: cada hora cae una marca' },
    arena: { niebla: 'ambar', ordenar: true, fuego: false, etiqueta: 'El Relojero hace sonar la Plaza' },
    desc: 'Toca las doce campanadas: marcas que caen como las horas del reloj. A medianoche el reloj se detiene.' },
  m6: { base: 'argos', nombre: 'El Basilisco del Osario', color: '#e8e0c8', sin: [],
    fases: ['Hueso y Ceniza', 'Procesión', 'La Grieta Mira', 'Todos los Muertos'],
    unico: { id: 'procesion', nombre: 'LA PROCESIÓN', aviso: '¡La Procesión de huesos! Una fila de marcas avanza hacia ti' },
    arena: { niebla: 'negra', ordenar: true, fuego: false, etiqueta: 'El Basilisco llama a los huesos del Osario' },
    desc: 'Una procesión de marcas recorre el osario y la grieta del altar lo mira todo.' },
};
export const jefeDe = (mapId) => JEFES[mapId] || null;

/** Colores de las marcas del cliente (índice → color). */
export const COLOR_MARCA = [0xff5a2a, 0xffb02a, 0xff3a6a, 0xff2a2a, 0x6ad8ff, 0xa86aff, 0x9affd8, 0xffe14a, 0x7affc8, 0xff9a2a, 0xb6ff2a];
