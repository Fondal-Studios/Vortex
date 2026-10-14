// Mapa 6: OSARIO SIN TECHO — el osario de Sedlec de ARCANUM (mapa 'sedlec' de /duelo-arcano: src/world/prague-route.js,
// escenografia.js y ruta-paisaje.js: bóvedas, pirámides de calaveras, guirnaldas de huesos y la araña de huesos) llegado
// al limbo. La bóveda se cayó hacia arriba: las nervaduras flotan sobre la nave y el cielo del más allá entra por el hueco.
//
// ESPACIO TÁCTICO: una CRUZ (planta de iglesia) que se entiende de un vistazo.
//   · Nave sur (x ∈ [-14,14], z ∈ [12,40]): aparición, restos de bancos (cobertura baja) y dos pares de pilares.
//   · El Crucero (centro, x ∈ [-14,14], z ∈ [-12,12]): la araña de huesos flota encima; GRAVEDAD ROTA LEVE (r 6,5);
//     cuatro pirámides de calaveras en las esquinas (cobertura alta).
//   · Brazo oeste y brazo este (x hasta ±40): osarios en cajones (bajo) y columnas de calaveras (alto).
//   · Nave norte (z hasta -46): pilares, dos sarcófagos y el ALTAR al fondo, bajo la fractura de luz.
//   · Bordes: muros del osario de 14 m (rotos arriba). Nada de caídas.
// Objetivos: Ancla (brazo este), Núcleo (del fondo del brazo oeste al altar), Sintonía (brazos opuestos).
// Jefe: Argos, el Ojo Primordial (flota sobre el crucero; sus ojos orbitan por encima de los muros).
import { v3 } from './math.js';
import { makeLimboArena } from './limbo.js';

export const M6 = {
  NAVE: { x0: -14, x1: 14, z0: -46, z1: 40 }, CRUCERO: { x0: -40, x1: 40, z0: -12, z1: 12 },
  WALL_H: 14, OJO: { x: 0, z: 0, r: 6.5, k: 0.35 }, ALTAR: { x: 0, z: -42, hx: 3, hz: 1.4, h: 1.4 },
};
const T = 4, H = M6.WALL_H, N = M6.NAVE, X = M6.CRUCERO;
const WALLS = [
  { x0: N.x0 - T, x1: N.x0, z0: X.z1, z1: N.z1 + T, h: H, kind: 'nave' },       // nave sur, lado oeste
  { x0: N.x1, x1: N.x1 + T, z0: X.z1, z1: N.z1 + T, h: H, kind: 'nave' },       // nave sur, lado este
  { x0: N.x0 - T, x1: N.x1 + T, z0: N.z1, z1: N.z1 + T, h: H, kind: 'portal' }, // fachada sur (por donde entraste)
  { x0: N.x0 - T, x1: N.x0, z0: N.z0 - T, z1: X.z0, h: H, kind: 'nave' },       // nave norte, oeste
  { x0: N.x1, x1: N.x1 + T, z0: N.z0 - T, z1: X.z0, h: H, kind: 'nave' },       // nave norte, este
  { x0: N.x0 - T, x1: N.x1 + T, z0: N.z0 - T, z1: N.z0, h: H, kind: 'abside' }, // ábside (detrás del altar)
  { x0: X.x0 - T, x1: X.x0, z0: X.z0 - T, z1: X.z1 + T, h: H, kind: 'testero' },// fondo del brazo oeste
  { x0: X.x1, x1: X.x1 + T, z0: X.z0 - T, z1: X.z1 + T, h: H, kind: 'testero' },// fondo del brazo este
  { x0: X.x0 - T, x1: N.x0 - T, z0: X.z0 - T, z1: X.z0, h: H, kind: 'brazo' },  // brazos: caras norte y sur
  { x0: N.x1 + T, x1: X.x1 + T, z0: X.z0 - T, z1: X.z0, h: H, kind: 'brazo' },
  { x0: X.x0 - T, x1: N.x0 - T, z0: X.z1, z1: X.z1 + T, h: H, kind: 'brazo' },
  { x0: N.x1 + T, x1: X.x1 + T, z0: X.z1, z1: X.z1 + T, h: H, kind: 'brazo' },
];
const A = M6.ALTAR;
const COVERS = [
  // crucero: cuatro pirámides de calaveras (de las esquinas de la nave de Sedlec)
  ...[[-9.5, -8.5], [9.5, -8.5], [-9.5, 8.5], [9.5, 8.5]].map(([x, z]) => ({ shape: 'cyl', x, z, r: 2.5, h: 4.4, kind: 'piramide' })),
  // naves: pilares de la bóveda caída
  ...[[-8, 20], [8, 20], [-8, 31], [8, 31], [-8, -21], [8, -21], [-8, -32], [8, -32]].map(([x, z]) => ({ shape: 'cyl', x, z, r: 1.0, h: 12, kind: 'pilar' })),
  // nave sur: restos de bancos
  { shape: 'box', x: -3.6, z: 25.5, hx: 2.2, hz: 0.45, h: 0.95, kind: 'banco' },
  { shape: 'box', x: 3.6, z: 25.5, hx: 2.2, hz: 0.45, h: 0.95, kind: 'banco' },
  // nave norte: sarcófagos (dejan un pasillo central de 6 m) y el altar
  { shape: 'box', x: -4.5, z: -27, hx: 1.1, hz: 2.2, h: 1.1, kind: 'sarcofago' },
  { shape: 'box', x: 4.5, z: -27, hx: 1.1, hz: 2.2, h: 1.1, kind: 'sarcofago' },
  { shape: 'box', x: A.x, z: A.z, hx: A.hx, hz: A.hz, h: A.h, kind: 'altar' },
  // brazo oeste: cajón de osario (bajo) y columna de calaveras (alta)
  { shape: 'box', x: -24, z: 6, hx: 1.6, hz: 1.0, h: 1.3, kind: 'osario' },
  { shape: 'cyl', x: -31, z: -5, r: 1.3, h: 6, kind: 'columna' },
  // brazo este: cobertura en los bordes (el centro queda libre para el Ancla)
  { shape: 'box', x: 22.5, z: -8.5, hx: 1.6, hz: 1.0, h: 1.3, kind: 'osario' },
  { shape: 'cyl', x: 35.5, z: 8.5, r: 1.3, h: 6, kind: 'columna' },
];

export function makeMap6() {
  return makeLimboArena({
    id: 'm6', name: 'Osario sin Techo',
    rooms: [N, X], walls: WALLS, covers: COVERS, navStep: 6,
    navExtra: [[0, 36], [0, -36], [-36, 0], [36, 0], [11.5, 26], [-11.5, 26], [11.5, -27], [-11.5, -27]],
    zones: [{ kind: 'leve', x: M6.OJO.x, z: M6.OJO.z, r: M6.OJO.r, h: 40, k: M6.OJO.k }],
    spawn: { x: 0, z: 35, dx: 0, dz: -1 },
    noSpawn: [{ x: 0, z: 33, r: 12 }],
    bossAnchor: v3(0, 34, -4),
    spots: {
      anchor: v3(29, 0, 0),
      plates: [v3(-26, 0.2, -6), v3(26, 0.2, 7), v3(0, 0.2, 18), v3(0, 0.2, -16)],
      core: v3(-36, 0.9, 1),
      altar: v3(0, 0.4, -37),
      resonators: (n) => Array.from({ length: n }, (_, k) => { const a = 0.4 + (k / n) * Math.PI * 2; return v3(Math.cos(a) * 14, 0, Math.sin(a) * 14); }).map((p) => (Math.abs(p.x) > 13 && Math.abs(p.z) > 11 ? v3(Math.sign(p.x) * 12, 0, Math.sign(p.z) * 4) : p)),
      eyes: (n) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return v3(Math.cos(a) * 16, 19 + (k % 2) * 5, -4 + Math.sin(a) * 16); }),
      valves: [v3(-26, 0, 0), v3(26, 0, 0)],
      boss: v3(0, 34, -4),
    },
    deco: { landmarks: { altar: A } },
  });
}
