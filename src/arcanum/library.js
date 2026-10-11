// ARCANUM NPC FACTORY — biblioteca de piezas compatibles (solo datos; se puede importar desde node).
// Todas las piezas comparten el rig MakeHuman de 326 huesos (assets/characters/narrative/model.json).
// «makehuman»: malla CC0 horneada por tools/characters-build-npcs.py; «procedural»: geometría propia
// generada en src/npc/parts.js a partir de la anatomía base (sin assets externos).

// Puntos de anclaje estandarizados → hueso del rig compartido.
export const ATTACH_POINTS = {
  cabeza: 'head_h', mandibula: 'jaw_h', cuello: 'neck02_h', pecho: 'spine01_h', espalda: 'spine01_h',
  cintura: 'spine05_h', manoDer: 'wrist_R_h', manoIzq: 'wrist_L_h', suelo: null,
};

// Arquetipos base: la diversidad sale de combinar piezas, no de muchos cuerpos.
export const BASES = {
  'masculino-joven':   { label: 'Masculino joven',   sexo: 'm', edad: 'joven',  piel: 'joven-m',   altura: [0.98, 1.08], ancho: [0.92, 1.02], postura: 0,   tempo: 1.05 },
  'masculino-adulto':  { label: 'Masculino adulto',  sexo: 'm', edad: 'adulto', piel: 'adulto-m',  altura: [0.98, 1.09], ancho: [0.95, 1.1],  postura: 0,   tempo: 0.9 },
  'masculino-anciano': { label: 'Masculino anciano', sexo: 'm', edad: 'anciano',piel: 'anciano-m', altura: [0.95, 1.06], ancho: [0.92, 1.08], postura: 0.35,tempo: 0.65 },
  'femenino-joven':    { label: 'Femenino joven',    sexo: 'f', edad: 'joven',  piel: 'joven-f',   altura: [0.94, 1.02], ancho: [0.9, 0.97],  postura: 0,   tempo: 1.05 },
  'femenino-adulto':   { label: 'Femenino adulto',   sexo: 'f', edad: 'adulto', piel: 'adulto-f',  altura: [0.95, 1.04], ancho: [0.92, 1.0],  postura: 0,   tempo: 0.92 },
  'femenino-anciano':  { label: 'Femenino anciano',  sexo: 'f', edad: 'anciano',piel: 'anciano-f', altura: [0.93, 1.0],  ancho: [0.92, 1.04], postura: 0.3, tempo: 0.68 },
};

export const SKINS = {
  'joven-m':      { label: 'Joven (claro)',   file: 'skin-young-male.png' },
  'joven-f':      { label: 'Joven (clara)',   file: 'skin-young.png' },
  'joven-oscura': { label: 'Joven (oscura)',  file: 'skin-young-dark-male.png' },
  'adulto-m':     { label: 'Adulto',          file: 'skin-middle-male.png' },
  'adulto-f':     { label: 'Adulta',          file: 'skin-middle-female.png' },
  'anciano-m':    { label: 'Anciano',         file: 'skin-old.png' },
  'anciano-f':    { label: 'Anciana',         file: 'skin-old-female.png' },
};

// Cabello: mallas MakeHuman, recoloreables por luminancia (src/npc/actor.js).
export const HAIR = {
  ninguno:    { label: 'Calvo',             mesh: null,         largo: 0, bajoCapucha: true,  bajoSombrero: true },
  short04:    { label: 'Rapado',            mesh: 'short04',    largo: 1, bajoCapucha: true,  bajoSombrero: true },
  short02:    { label: 'Corto',             mesh: 'short02',    largo: 1, bajoCapucha: true,  bajoSombrero: true },
  short01:    { label: 'Corto despeinado',  mesh: 'short01',    largo: 1, bajoCapucha: false, bajoSombrero: true },
  bob02:      { label: 'Medio (melena)',    mesh: 'bob02',      largo: 2, bajoCapucha: false, bajoSombrero: true },
  ponytail01: { label: 'Recogido (coleta)', mesh: 'ponytail01', largo: 2, bajoCapucha: false, bajoSombrero: false },
  long01:     { label: 'Largo',             mesh: 'long01',     largo: 3, bajoCapucha: false, bajoSombrero: true },
};

export const EYEBROWS = {
  ninguna:    { label: 'Sin cejas marcadas', mesh: null },
  eyebrow010: { label: 'Finas',  mesh: 'eyebrow010' },
  eyebrow001: { label: 'Pobladas', mesh: 'eyebrow001' },
};

// Barbas procedurales derivadas de la superficie del rostro (sin clipping: siguen la piel y su skinning).
export const BEARDS = {
  ninguna:   { label: 'Sin barba' },
  corta:     { label: 'Barba corta',  capas: ['mejillas', 'menton', 'bigote'], grosor: 0.004, largo: 0 },
  media:     { label: 'Barba media',  capas: ['mejillas', 'menton', 'bigote'], grosor: 0.01,  largo: 0.04 },
  larga:     { label: 'Barba larga',  capas: ['mejillas', 'menton', 'bigote'], grosor: 0.014, largo: 0.12 },
  perilla:   { label: 'Perilla',      capas: ['menton'],                       grosor: 0.008, largo: 0.035 },
  bigote:    { label: 'Bigote',       capas: ['bigote'],                       grosor: 0.008, largo: 0 },
  hechicero: { label: 'Barba de hechicero', capas: ['mejillas', 'menton', 'bigote'], grosor: 0.016, largo: 0.26 },
};

// Telas: relieve procedural compartido (src/npc/materials.js) elegido por prenda con `tela`.
// tile = metros que ocupa una repetición del patrón · normal = fuerza del relieve · rough = rugosidad base
// sheen = brillo rasante (terciopelo, lana) · relieve = pendiente al hornear la textura.
export const FABRICS = {
  lana:       { id: 0, label: 'Lana',       patron: 'lana',       tile: 0.05,  normal: 0.85, rough: 0.9,  sheen: 0.22, relieve: 1.0 },
  lino:       { id: 1, label: 'Lino',       patron: 'lino',       tile: 0.022, normal: 0.8,  rough: 0.82, sheen: 0.05, relieve: 1.0 },
  cuero:      { id: 2, label: 'Cuero',      patron: 'cuero',      tile: 0.035, normal: 0.3,  rough: 0.5,  sheen: 0.0,  relieve: 0.8 },
  terciopelo: { id: 3, label: 'Terciopelo', patron: 'terciopelo', tile: 0.08,  normal: 0.25, rough: 0.95, sheen: 0.75, relieve: 0.6 },
  fieltro:    { id: 4, label: 'Fieltro',    patron: 'fieltro',    tile: 0.05,  normal: 0.4,  rough: 0.95, sheen: 0.18, relieve: 0.8 },
  madera:     { id: 5, label: 'Madera',     patron: 'madera',     tile: 0.12,  normal: 0.4,  rough: 0.72, sheen: 0.0,  relieve: 0.7 },
  lona:       { id: 6, label: 'Lona',       patron: 'lona',       tile: 0.035, normal: 0.9,  rough: 0.88, sheen: 0.05, relieve: 1.0 },
  seda:       { id: 7, label: 'Seda',       patron: 'seda',       tile: 0.05,  normal: 0.2,  rough: 0.38, sheen: 0.1,  relieve: 0.5 },
};
/** Id numérico de una tela (para el atributo de vértice `npcFab`); desconocida → fieltro. */
export const fabricId = (tela) => (FABRICS[tela] || FABRICS.fieltro).id;

// Vestimenta base MakeHuman (con máscaras de ocultación de piel) + capas procedurales encima.
export const OUTFITS = {
  male_casualsuit01:    { label: 'Traje casual',  mesh: 'male_casualsuit01',    normal: true },
  female_elegantsuit01: { label: 'Traje elegante', mesh: 'female_elegantsuit01', normal: true },
  male_worksuit01:      { label: 'Ropa de trabajo', mesh: 'male_worksuit01',     normal: true },
};

export const LAYERS = {
  ninguna:        { label: 'Sin capa exterior' },
  'tunica-larga': { label: 'Túnica larga',       torso: true, mangas: 'campana', falda: 0.06, abierta: false, tela: 'lana' },
  'tunica-corta': { label: 'Túnica de aprendiz',  torso: true, mangas: 'recta',   falda: 0.52, abierta: false, tela: 'lino' },
  'abrigo-largo': { label: 'Abrigo largo',        torso: true, mangas: 'recta',   falda: 0.22, abierta: true, tela: 'lana' },
  'abrigo-corto': { label: 'Chaqueta de campo',   torso: true, mangas: 'recta',   falda: 0.7,  abierta: true, tela: 'lona' },
  'toga-academica': { label: 'Toga académica',    torso: true, mangas: 'campana', falda: 0.14, abierta: true, tela: 'terciopelo' },
  mandil:         { label: 'Mandil de alquimista', torso: false, mandil: true, tela: 'cuero' },
};

export const CAPES = {
  ninguna:  { label: 'Sin capa' },
  corta:    { label: 'Capa corta',  bajo: 0.75, tela: 'lana' },
  larga:    { label: 'Capa larga',  bajo: 0.12, tela: 'lana' },
  esclavina:{ label: 'Esclavina',   bajo: 1.05, tela: 'fieltro' },
};

export const HEADWEAR = {
  ninguno:     { label: 'Nada', tipo: null },
  capucha:     { label: 'Capucha', tipo: 'capucha', cubreCabello: true, tela: 'lana' },
  mago:        { label: 'Sombrero de mago', tipo: 'sombrero', alto: 0.34, ala: 0.13, tela: 'fieltro' },
  'ala-ancha': { label: 'Sombrero de ala ancha', tipo: 'sombrero', alto: 0.1, ala: 0.16, tela: 'fieltro' },
  copa:        { label: 'Sombrero de copa', tipo: 'sombrero', alto: 0.17, ala: 0.07, tela: 'seda' },
  boina:       { label: 'Boina', tipo: 'gorro', tela: 'lana' },
  birrete:     { label: 'Birrete académico', tipo: 'gorro', tela: 'terciopelo' },
  casquete:    { label: 'Casquete de erudito', tipo: 'gorro', tela: 'terciopelo' },
  diadema:     { label: 'Diadema arcana', tipo: 'joya' },
};

export const GLOVES = { ninguno: { label: 'Sin guantes' }, cuero: { label: 'Guantes de cuero', tela: 'cuero' }, ritual: { label: 'Guantes rituales', tela: 'seda' } };
export const BOOTS = { ninguna: { label: 'Zapatos' }, botas: { label: 'Botas altas' }, 'botas-viaje': { label: 'Botas de viaje' } };
export const BELTS = { ninguno: { label: 'Sin cinturón' }, simple: { label: 'Cinturón' }, bolsas: { label: 'Cinturón con bolsas' }, alquimia: { label: 'Cinturón de frascos' } };

export const STAFFS = {
  ninguno:  { label: 'Sin báculo' },
  nudoso:   { label: 'Báculo nudoso', largo: 1.75, cabeza: 'cristal' },
  piedra:   { label: 'Cayado de piedra', largo: 1.6, cabeza: 'piedra' },
  ligero:   { label: 'Vara ligera', largo: 1.7, cabeza: 'anillo' },
  baston:   { label: 'Bastón de paseo', largo: 0.95, cabeza: 'pomo' },
};
export const WANDS = { ninguna: { label: 'Sin varita' }, simple: { label: 'Varita' }, tallada: { label: 'Varita tallada' } };
export const GRIMOIRES = {
  ninguno:  { label: 'Sin grimorio' },
  mano:     { label: 'Grimorio en la mano' },
  cinturon: { label: 'Grimorio al cinturón' },
  flotante: { label: 'Grimorio flotante' },
};

// Accesorios combinables (lista); cada uno declara su punto de anclaje para detectar conflictos.
export const ACCESSORIES = {
  amuleto:   { label: 'Amuleto', attach: 'pecho' },
  gafas:     { label: 'Gafas redondas', attach: 'cabeza' },
  estola:    { label: 'Estola', attach: 'pecho' },
  'cuello-alto': { label: 'Cuello alto', attach: 'cuello' },
  farol:     { label: 'Farol al cinturón', attach: 'cintura', requiere: 'belt' },
  frascos:   { label: 'Frascos alquímicos', attach: 'cintura', requiere: 'belt' },
  pergamino: { label: 'Pergamino', attach: 'cintura', requiere: 'belt' },
  anillo:    { label: 'Anillo con gema', attach: 'manoIzq' },
  orbe:      { label: 'Orbe flotante', attach: 'suelo' },
};

// Paletas: colores base; la afinidad aporta acentos sutiles, nunca «todo rojo».
export const PALETTES = {
  'noche-violeta': { label: 'Noche violeta', primario: '#3b3346', secundario: '#5d5070', acento: '#b8a06a', metal: '#b3955a', cuero: '#4a3426' },
  carbon:          { label: 'Carbón y cobre', primario: '#2f2b2a', secundario: '#4b4440', acento: '#b06a3c', metal: '#a8683f', cuero: '#3d2a1f' },
  'azul-rio':      { label: 'Azul del Moldava', primario: '#2b3c4f', secundario: '#41566b', acento: '#9fb4c2', metal: '#b8bec4', cuero: '#3a2c24' },
  salvia:          { label: 'Salvia', primario: '#56695d', secundario: '#7d8d78', acento: '#d9d2b5', metal: '#a9a48a', cuero: '#5a4634' },
  tierra:          { label: 'Tierra de Vyšehrad', primario: '#5d4a35', secundario: '#7a6548', acento: '#c49a5c', metal: '#8a6b42', cuero: '#4b3524' },
  sombra:          { label: 'Sombra', primario: '#1d1b22', secundario: '#2e2a36', acento: '#7a5aa8', metal: '#8f8a9c', cuero: '#1f1a1c' },
  pergamino:       { label: 'Pergamino', primario: '#6b5b45', secundario: '#8a7a5e', acento: '#3f4a5c', metal: '#a08a5a', cuero: '#4a3a2a' },
  ciudad:          { label: 'Ciudadano de Praga', primario: '#4a4540', secundario: '#6a5f55', acento: '#8a3b32', metal: '#8a8a88', cuero: '#3b2d23' },
  alquimia:        { label: 'Alquimia', primario: '#3f4a3a', secundario: '#5e6a4c', acento: '#c2a24a', metal: '#9a8048', cuero: '#4a3322' },
};

// Afinidad mágica: influencia sutil en gemas, partículas, acento secundario y ritmo del reposo.
export const AFFINITIES = {
  neutral:    { label: 'Neutral',       gema: '#c9c3b2', brillo: 0,    particulas: null,        tempo: 1 },
  fire:       { label: 'Fuego',         gema: '#ff7a2f', brillo: 0.6,  particulas: 'brasas',    tempo: 1.08, tinte: '#b0623a' },
  water:      { label: 'Agua',          gema: '#5bb8ff', brillo: 0.45, particulas: 'gotas',     tempo: 0.9,  tinte: '#4f7a96' },
  earth:      { label: 'Tierra',        gema: '#c2955a', brillo: 0.25, particulas: 'polvo',     tempo: 0.85, tinte: '#8a6a44' },
  wind:       { label: 'Viento',        gema: '#d4f1e8', brillo: 0.4,  particulas: 'brisa',     tempo: 1,    tinte: '#7f9a8c' },
  demonic:    { label: 'Demoníaca',     gema: '#8f4bd8', brillo: 0.5,  particulas: 'ceniza',    tempo: 0.82, tinte: '#5a3a6e' },
  researcher: { label: 'Investigación', gema: '#a8c6e8', brillo: 0.2,  particulas: null,        tempo: 0.95 },
  alchemist:  { label: 'Alquimia',      gema: '#8fd36a', brillo: 0.35, particulas: 'burbujas',  tempo: 1 },
};

// Conjuntos de animación sobre los clips UAL redirigidos (src/characters/retarget.js).
export const ANIMATION_SETS = {
  sereno:   { label: 'Sereno',   reposo: 'idle',      demostrar: 'spellIdle', tempo: 0.9,  postura: 0 },
  energico: { label: 'Enérgico', reposo: 'idle',      demostrar: 'spellIdle', tempo: 1.15, postura: 0 },
  erudito:  { label: 'Erudito',  reposo: 'idle',      demostrar: 'spellIdle', tempo: 0.75, postura: 0.15 },
  anciano:  { label: 'Anciano',  reposo: 'idle',      demostrar: 'spellIdle', tempo: 0.6,  postura: 0.4 },
  arcano:   { label: 'Arcano',   reposo: 'spellIdle', demostrar: 'spellIdle', tempo: 0.85, postura: 0 },
};
export const REQUIRED_CLIPS = ['idle', 'spellIdle'];

export const QUALITY_TIERS = ['auto', 'low', 'medium', 'high', 'ultra'];
export const ROLES = ['maestro', 'mentor', 'aprendiz', 'erudito', 'alquimista', 'demonologo', 'investigador', 'civil', 'reclutador', 'bibliotecario', 'poblacion'];

// Ranuras con una sola pieza → tabla correspondiente (para validar y para la interfaz).
export const SLOTS = {
  base: BASES, skin: SKINS, hair: HAIR, eyebrows: EYEBROWS, beard: BEARDS, outfit: OUTFITS, layer: LAYERS,
  cape: CAPES, hat: HEADWEAR, gloves: GLOVES, boots: BOOTS, belt: BELTS, staff: STAFFS, wand: WANDS,
  grimoire: GRIMOIRES, palette: PALETTES, magicAffinity: AFFINITIES, animationSet: ANIMATION_SETS,
};

// Archivos MakeHuman que cada pieza necesita (carga diferida: solo lo que usa el NPC visible).
export function meshesFor(def) {
  return ['body', 'HighPolyEyes', OUTFITS[def.outfit]?.mesh, HAIR[def.hair]?.mesh, EYEBROWS[def.eyebrows]?.mesh,
    def.boots && def.boots !== 'ninguna' ? null : 'shoes02'].filter(Boolean);
}
export function texturesFor(def) {
  const out = [SKINS[def.skin]?.file, 'HighPolyEyes-color.png'];
  const o = OUTFITS[def.outfit]; if (o) out.push(o.mesh + '-color.png', ...(o.normal ? [o.mesh + '-normal.png'] : []));
  const h = HAIR[def.hair]?.mesh; if (h) out.push(h + '-color.png');
  const e = EYEBROWS[def.eyebrows]?.mesh; if (e) out.push(e + '-color.png');
  if (!def.boots || def.boots === 'ninguna') out.push('shoes02-color.png');
  return out.filter(Boolean);
}
