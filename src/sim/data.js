// Datos de diseño: armas, bestiario, oleadas. Todo número de balance vive acá.
export const G = 28; // magnitud de gravedad

export const LIMITS = { monsters: 90, projectiles: 300, pickups: 40, events: 240 };

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

/* ───────── LOS HUÉSPEDES: organismos biomecánicos jugables (docs/HUESPEDES.md). `host:true` = aparecen primero en la selección.
   Cada uno: arma inicial, melee (ligero/pesado), 3 habilidades (mov = hab. 1, esp = hab. 2, s3 = hab. 3), definitiva (ult), pasiva y stats 0–10. ───────── */
const HOSTS = {
  axioma: { team: 'vanguardia', name: 'Axioma', title: 'El Organismo de Guerra', role: 'asalto', host: true, preset: 'jugador1', seed: null, color: 0x3aa8ff, hp: 1, speed: 1, slots: [2, 5, 3, 4],
    desc: 'Asalto equilibrado. Fusil de proyectiles óseos y cuchillas en los antebrazos. El Huésped inicial: versátil y accesible.',
    story: 'Cosido por un laboratorio que ya no existe, despierta con una orden grabada en los huesos: sobrevivir. Todavía no sabe quién le dio la orden.',
    stats: { dano: 7, resistencia: 6, movilidad: 6, control: 4, utilidad: 4, dificultad: 2 },
    melee: { light: { dmg: 46, range: 3.6, arc: 0.55, cd: 0.34 }, heavy: { dmg: 130, range: 4.4, arc: 0.45, cd: 0.9, knock: 14 } },
    mov: { id: 'impulso', name: 'Impulso muscular', cd: 6, desc: 'Esquiva y embiste: arrolla lo que toca.' },
    esp: { id: 'espinas', name: 'Descarga de espinas', cd: 8, desc: 'Espinas perforantes en línea recta: atraviesan todo.' },
    s3: { id: 'caparazon', name: 'Caparazón', cd: 16, desc: 'Durante 4 s absorbe el 70 % del daño y refleja parte.' },
    ult: { id: 'sobrecarga', name: 'Sobrecarga Evolutiva', cd: 0, charge: 100, desc: '10 s: +35 % velocidad, +60 % cadencia, melee más rápido.' },
    passive: { id: 'carnivoro', name: 'Voracidad', desc: 'Cada baja con melee restaura 14 de vida/escudo y 8 de carga.' } },
  vesper: { team: 'explorador', name: 'Vesper', title: 'La Depredadora', role: 'asesina', host: true, preset: 'jugador4', seed: null, color: 0xb04bff, hp: 0.78, speed: 1.18, slots: [6, 4, 5, 1],
    desc: 'Asesina de movilidad extrema. Agujas neurotóxicas, garras dobles. Daño explosivo, poca resistencia.',
    story: 'Cazó en un mundo donde la presa pensaba. Desde la estación, la presa es otra cosa y ella lo sabe: algo la persigue desde adentro.',
    stats: { dano: 9, resistencia: 3, movilidad: 10, control: 3, utilidad: 3, dificultad: 7 },
    melee: { light: { dmg: 38, range: 3.4, arc: 0.6, cd: 0.26 }, heavy: { dmg: 110, range: 4, arc: 0.5, cd: 0.7, knock: 6 } },
    mov: { id: 'paso', name: 'Desplazamiento', cd: 4.5, desc: 'Teletransporte instantáneo de corto alcance hacia donde mirás.' },
    esp: { id: 'camuflaje', name: 'Camuflaje refractivo', cd: 14, desc: '5 s casi invisible: las criaturas pierden tu rastro. Atacar lo rompe, con daño extra.' },
    s3: { id: 'marca', name: 'Marca biológica', cd: 10, desc: 'Marca al enemigo apuntado: recibe +40 % de daño 8 s.' },
    ult: { id: 'frenesi', name: 'Frenesí Depredador', cd: 0, charge: 100, desc: '8 s: cada baja reinicia el desplazamiento y salta a la siguiente víctima marcada.' },
    passive: { id: 'desprevenido', name: 'Presa distraída', desc: '+50 % de daño a criaturas que no te están mirando o que no te han detectado.' } },
  micelio: { team: 'vanguardia', name: 'Micelio', title: 'El Devorador', role: 'tanque', host: true, preset: 'jugador2', seed: null, color: 0x7be03a, hp: 1.7, speed: 0.86, slots: [3, 10, 17, 20],
    desc: 'Tanque y control territorial. Cañón de esporas y puños sísmicos. Absorbe castigo y domina oleadas.',
    story: 'Era un jardín antes de ser un cuerpo. La estación lo comió y él se la devolvió con raíces. Todavía tiene hambre.',
    stats: { dano: 5, resistencia: 10, movilidad: 3, control: 8, utilidad: 6, dificultad: 4 },
    melee: { light: { dmg: 58, range: 3.8, arc: 0.7, cd: 0.5 }, heavy: { dmg: 170, range: 5, arc: 0.8, cd: 1.1, knock: 22 } },
    mov: { id: 'barrera', name: 'Barrera orgánica', cd: 12, desc: 'Hace crecer un muro vivo delante de vos: bloquea balas y criaturas.' },
    esp: { id: 'esporas', name: 'Nube de esporas', cd: 11, desc: 'Nube que ralentiza y envenena durante 6 s.' },
    s3: { id: 'biomasa', name: 'Absorción de biomasa', cd: 15, desc: 'Absorbe a las criaturas cercanas: cura según cuántas haya.' },
    ult: { id: 'floracion', name: 'Floración Total', cd: 0, charge: 100, desc: '12 s: el terreno a tu alrededor se vuelve hostil (daño, lentitud) y vos regenerás.' },
    passive: { id: 'callo', name: 'Callo acumulativo', desc: 'Cada golpe recibido da +4 % de resistencia (hasta 40 %) que se disipa en 6 s.' } },
  umbra: { team: 'ingeniero', name: 'Umbra', title: 'El Errante del Vacío', role: 'control', host: true, preset: null, seed: 'umbra-3', color: 0xb98cff, hp: 0.95, speed: 1.02, slots: [8, 10, 9, 6],
    desc: 'Control dimensional. Rifle de distorsión y hoja que atraviesa defensas. Usa el escenario como arma.',
    story: 'Habita varios planos a la vez; en este solo es una sombra con bordes de más. Fue el primero en notar que el tren no estaba en ningún horario.',
    stats: { dano: 6, resistencia: 5, movilidad: 7, control: 10, utilidad: 8, dificultad: 9 },
    melee: { light: { dmg: 42, range: 3.8, arc: 0.5, cd: 0.38, pierce: true }, heavy: { dmg: 120, range: 4.6, arc: 0.4, cd: 0.9, pierce: true } },
    mov: { id: 'fase', name: 'Fase', cd: 8, desc: 'Salto hacia atrás con 1 s de invulnerabilidad (pasiva: menos daño al desplazarte).' },
    esp: { id: 'singularidad', name: 'Campo gravitatorio', cd: 14, desc: 'Un agujero que agrupa criaturas y estalla.' },
    s3: { id: 'tiempo', name: 'Distorsión temporal', cd: 18, desc: 'Burbuja de 5 s donde las criaturas se mueven al 25 %.' },
    ult: { id: 'colapso', name: 'Colapso del Umbral', cd: 0, charge: 100, desc: 'Singularidad grande de 6 s: arrastra, daña y detiene el tiempo local.' },
    passive: { id: 'desfase', name: 'Desfase', desc: '-35 % de daño recibido durante 2 s después de usar Fase o un desplazamiento.' } },
  seraf: { team: 'soporte', name: 'Seraf', title: 'La Simbiosis Prohibida', role: 'híbrido', host: true, preset: 'jugador3', seed: null, color: 0xffd45a, hp: 0.92, speed: 1.06, slots: [9, 11, 7, 20],
    desc: 'Híbrido de apoyo, daño y evolución. Emisor biológico y látigo extensible. El más técnico y espectacular.',
    story: 'Su simbionte no era un arma: era una pregunta. Seraf todavía no sabe si el organismo la usa a ella o ella a él, y eso la hace muy buena.',
    stats: { dano: 6, resistencia: 5, movilidad: 6, control: 6, utilidad: 10, dificultad: 8 },
    melee: { light: { dmg: 40, range: 6.5, arc: 0.28, cd: 0.4 }, heavy: { dmg: 115, range: 8, arc: 0.22, cd: 0.95, knock: -10 } },
    mov: { id: 'planeo', name: 'Alas membranosas', cd: 7, desc: 'Impulso aéreo con planeo: casi no caés durante 2 s.' },
    esp: { id: 'pulso', name: 'Pulso vital', cd: 9, desc: 'Daña a las criaturas alrededor y te devuelve vida y carga.' },
    s3: { id: 'simbionte', name: 'Simbionte', cd: 20, desc: 'Invoca un organismo aliado 10 s que ataca y distrae.' },
    ult: { id: 'metamorfosis', name: 'Metamorfosis', cd: 0, charge: 100, desc: '12 s: forma alada. Tus disparos perforan y curan, el látigo ataca en área.' },
    passive: { id: 'adaptacion', name: 'Adaptación', desc: 'Cada tipo de criatura que eliminás (hasta 5) da +2 % de daño contra ese tipo.' } },
};
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

// Bestiario: criaturas de cristal. `ai` mapea a src/sim/ai.js
export const MONSTERS = {
  astilla:  { name: 'Astilla',  role: 'corredor',    ai: 'runner',    hp: 24,  speed: 12,  r: 1.0, cost: 1,   score: 10,  fly: false },
  geoda:    { name: 'Geoda',    role: 'tanque',      ai: 'tank',      hp: 300, speed: 4.6, r: 2.3, cost: 5,   score: 60,  fly: false },
  prisma:   { name: 'Prisma',   role: 'volador',     ai: 'diver',     hp: 58,  speed: 10,  r: 1.2, cost: 2,   score: 25,  fly: true },
  lente:    { name: 'Lente',    role: 'a distancia', ai: 'ranged',    hp: 72,  speed: 5.5, r: 1.4, cost: 2.5, score: 35,  fly: false },
  cuarzo:   { name: 'Cuarzo',   role: 'invocador',   ai: 'summoner',  hp: 95,  speed: 4.4, r: 1.5, cost: 4,   score: 55,  fly: false },
  espejo:   { name: 'Espejo',   role: 'emboscador',  ai: 'ambusher',  hp: 62,  speed: 8,   r: 1.2, cost: 3,   score: 45,  fly: false },
  racimo:   { name: 'Racimo',   role: 'explosivo',   ai: 'exploder',  hp: 26,  speed: 13.5, r: 1.1, cost: 1.5, score: 20,  fly: false },
  graviton: { name: 'Gravitón', role: 'control',     ai: 'gravitron', hp: 115, speed: 4,   r: 1.6, cost: 5,   score: 70,  fly: true },
  obelisco: { name: 'Obelisco', role: 'francotirador', ai: 'sniper',    hp: 140, speed: 2.5, r: 1.6, cost: 4,   score: 55,  fly: false },
  aurora:   { name: 'Aurora',   role: 'sanadora',     ai: 'healer',    hp: 90,  speed: 6,   r: 1.3, cost: 4,   score: 60,  fly: true },
  ariete:   { name: 'Ariete',   role: 'embestidor',   ai: 'charger',   hp: 190, speed: 6.5, r: 1.9, cost: 4,   score: 50,  fly: false },
  espiral:  { name: 'Espiral',  role: 'atractor',     ai: 'attractor', hp: 120, speed: 4,   r: 1.5, cost: 4.5, score: 65,  fly: true },
  // jefes de mapa
  coloso:   { name: 'Coloso Prismático', role: 'jefe', ai: 'coloso', hp: 3000, speed: 0, r: 7.5, cost: 0, score: 2000, fly: true, boss: true },
  argos:    { name: 'Argos, el Ojo Primordial', role: 'jefe', ai: 'argos', hp: 3400, speed: 0, r: 6.5, cost: 0, score: 3000, fly: true, boss: true },
  madre:    { name: 'Madre Geoda',       role: 'jefe', ai: 'madre',  hp: 3200, speed: 0, r: 7.0, cost: 0, score: 2500, fly: true, boss: true },
};

// Qué criaturas se habilitan en cada oleada de cada mapa
export const WAVE_PLANS = {
  m1: [
    ['astilla'],
    ['astilla', 'prisma'],
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
  m2: [
    ['astilla', 'racimo'],
    ['astilla', 'racimo', 'lente', 'espejo'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco', 'prisma', 'cuarzo', 'ariete'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco', 'prisma', 'cuarzo', 'ariete', 'graviton', 'aurora'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco', 'prisma', 'cuarzo', 'ariete', 'graviton', 'aurora', 'espiral'],
  ],
};
export const BOSS_OF = { m1: 'coloso', m2: 'madre', m3: 'argos' };

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
  m1: { 2: 'ancla', 4: 'sintonia', 5: 'nucleo', 6: 'ancla' },
  m2: { 2: 'sintonia', 3: 'ancla', 4: 'nucleo', 6: 'sintonia' },
  m3: { 2: 'ancla', 3: 'sintonia', 5: 'nucleo', 6: 'ancla' },
};
export const OBJECTIVE_INFO = {
  ancla:    { title: 'ANCLA DE REALIDAD', desc: 'Mantené a alguien dentro del círculo para cargarla y cubrila: las criaturas la roen.', limit: 110 },
  sintonia: { title: 'SINTONÍA', desc: 'Pisá todas las placas a la vez durante 3 s. Solo: cada placa queda viva 10 s tras salir.', limit: 110 },
  nucleo:   { title: 'NÚCLEO DE MEMORIA', desc: 'Uno lleva el núcleo al altar (lento y sin disparar); el resto lo cubre. Pasalo con E cerca.', limit: 150 },
};
// Fragmentos de recuerdo: los cuenta el Heraldo cada vez que se cumple un objetivo (el sentido de la historia)
export const FRAGMENTS = [
  'Fragmento 1 — «El Vórtice no mata. Colecciona. Se alimenta de lo que pudiste ser y no fuiste.»',
  'Fragmento 2 — «Las criaturas son reflejos que aprendieron a tener hambre. Por eso brillan cuando atacan: te están mostrando quién creen que sos.»',
  'Fragmento 3 — «Yo también esperaba un tren. Un martes, en un andén, con los auriculares puestos.»',
  'Fragmento 4 — «Los dos corazones sostienen la puerta. Uno mira hacia afuera; el otro, hacia adentro. Hay que romper los dos.»',
  'Fragmento 5 — «Cada vez que alguien ayuda a otro, el Vórtice pierde un poco de hambre. Por eso te hice cargar el núcleo. No era por el núcleo.»',
  'Fragmento 6 — «Si llegás al final, no te voy a decir adiós. Los Heraldos no podemos. Pero voy a escuchar el tren.»',
];
export const BOSS_MECH = { shield: 0.05, stagger: 2.5, rayCd: [0, 14, 11, 9], rayT: 4, madreClosed: 0.15 };

/** Ritmo de las criaturas: 1 = velocidad original. Todas (movimiento, ataques y avisos) corren a este ritmo: más tiempo para reaccionar. Los jefes un poco más rápido. */
export const MONSTER_PACE = 0.7, BOSS_PACE = 0.9;
