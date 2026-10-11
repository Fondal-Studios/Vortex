// Datos de diseño: armas, bestiario, oleadas. Todo número de balance vive acá.
export const G = 28; // magnitud de gravedad

export const LIMITS = { monsters: 90, projectiles: 300, pickups: 40, events: 240 };

export const WEAPONS = [
  { id: 'haz',    name: 'Haz',    kind: 'hitscan', dmg: 22, rate: 0.26, pellets: 1, spread: 0.004, range: 320, max: Infinity, start: Infinity, per: 0 },
  { id: 'prisma', name: 'Prisma', kind: 'hitscan', dmg: 12,  rate: 0.8,  pellets: 9, spread: 0.075, range: 70,  max: 48,  start: 20, per: 1 },
  { id: 'rafaga', name: 'Ráfaga', kind: 'hitscan', dmg: 11,  rate: 0.085, pellets: 1, spread: 0.022, range: 220, max: 360, start: 150, per: 1 },
  { id: 'nova',   name: 'Nova',   kind: 'projectile', dmg: 100, rate: 1.0, splash: 8, speed: 58, max: 32, start: 10, per: 1 },
  { id: 'aguja',  name: 'Aguja',  kind: 'hitscan', dmg: 170, rate: 1.4, pellets: 1, spread: 0, range: 420, pierce: true, max: 28, start: 10, per: 1 },
];

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
  m2: [
    ['astilla', 'racimo'],
    ['astilla', 'racimo', 'lente', 'espejo'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco', 'prisma', 'cuarzo', 'ariete'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco', 'prisma', 'cuarzo', 'ariete', 'graviton', 'aurora'],
    ['astilla', 'racimo', 'lente', 'espejo', 'geoda', 'obelisco', 'prisma', 'cuarzo', 'ariete', 'graviton', 'aurora', 'espiral'],
  ],
};
export const BOSS_OF = { m1: 'coloso', m2: 'madre' };

export const PLAYER = { hp: 100, shield: 100, radius: 0.9, eye: 0.6, speed: 11, dash: 1.7, jump: 11.5, shieldDelay: 3, shieldRate: 35 };
