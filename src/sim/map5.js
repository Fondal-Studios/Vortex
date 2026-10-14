// Mapa 5: PLAZA DE LOS ECOS — la Praga vieja de ARCANUM (mapa 'praga' de /duelo-arcano: src/world/praga.js) llegada
// MUERTA al limbo. La calle empedrada desemboca en la plaza del reloj: fachadas barrocas lavadas a hueso y ceniza, faroles
// que ya no dan luz cálida sino un frío de más allá, el reloj astronómico detenido, la fuente cuya agua cae hacia ARRIBA.
//
// ESPACIO TÁCTICO (simple de leer, sin laberintos):
//   · La Calle (sur, x ∈ [-5,5], z ∈ [30,56]): aparición. Embudo defendible que mira a la plaza.
//   · La Plaza (x ∈ [-34,34], z ∈ [-34,30]): un rectángulo abierto con el centro marcado por LA FUENTE.
//     - Ojo de la Fuente (centro, r 10): GRAVEDAD ROTA LEVE (35 %): se salta alto y se flota; vista desde arriba.
//     - Soportales (oeste): fila de pilares con alero: corredor cubierto paralelo a la plaza.
//     - Torre del Reloj (este): bloque alto; al pie, el portal del reloj (altar del Núcleo).
//     - Cuatro cuadrantes, cada uno con UNA cobertura alta (pedestal / quiosco) y UNA baja (puesto de mercado / carro).
//   · Bordes: fachadas continuas de 18 m (nada de caídas). Al norte, sobre los techos, las torres de Týn (orientación).
// Objetivos: Sintonía (placas en cuadrantes opuestos), Núcleo (de los Soportales al portal del Reloj cruzando la Fuente),
// Ancla (frente a la boca de la Calle). Jefe: el Coloso Prismático (resonadores en anillo alrededor de la Fuente).
import { v3 } from './math.js';
import { makeLimboArena } from './limbo.js';

export const M5 = {
  PLAZA: { x0: -34, x1: 34, z0: -34, z1: 30 }, CALLE: { x0: -5, x1: 5, z0: 30, z1: 56 },
  WALL_H: 18, FUENTE: { x: 0, z: -4, r: 3.6 }, OJO: { x: 0, z: -4, r: 10, k: 0.35 },
  TORRE: { x0: 25, x1: 34, z0: -12, z1: 0, h: 26 }, ARCADA: { x: -28.5, roofX0: -34, roofX1: -27.6, z0: -30, z1: 22, h: 7 },
};

const T = 4; // espesor de los muros de borde
const H = M5.WALL_H, P = M5.PLAZA, C = M5.CALLE;
const WALLS = [
  { x0: P.x0 - T, x1: P.x1 + T, z0: P.z0 - T, z1: P.z0, h: H, kind: 'norte' },          // fachadas norte (detrás: Týn)
  { x0: P.x0 - T, x1: P.x0, z0: P.z0 - T, z1: P.z1 + T, h: H, kind: 'oeste' },          // fachadas oeste (detrás de los soportales)
  { x0: P.x1, x1: P.x1 + T, z0: P.z0 - T, z1: P.z1 + T, h: H, kind: 'este' },           // fachadas este
  { x0: P.x0 - T, x1: C.x0, z0: P.z1, z1: P.z1 + T, h: H, kind: 'sur' },                // fachadas sur (a cada lado de la calle)
  { x0: C.x1, x1: P.x1 + T, z0: P.z1, z1: P.z1 + T, h: H, kind: 'sur' },
  { x0: C.x0 - T, x1: C.x0, z0: P.z1, z1: C.z1 + T, h: H, kind: 'calle' },              // la calle
  { x0: C.x1, x1: C.x1 + T, z0: P.z1, z1: C.z1 + T, h: H, kind: 'calle' },
  { x0: C.x0 - T, x1: C.x1 + T, z0: C.z1, z1: C.z1 + T, h: H, kind: 'fondo' },          // fondo de la calle (un arco tapiado)
];
const TW = M5.TORRE, AR = M5.ARCADA;
const COVERS = [
  // centro: la fuente (pileta baja + columna)
  { shape: 'cyl', x: M5.FUENTE.x, z: M5.FUENTE.z, r: M5.FUENTE.r, h: 1.1, kind: 'fuente' },
  { shape: 'cyl', x: M5.FUENTE.x, z: M5.FUENTE.z, r: 0.9, h: 5.2, kind: 'fuente-columna' },
  // este: torre del Ayuntamiento con el reloj
  { shape: 'box', x: (TW.x0 + TW.x1) / 2, z: (TW.z0 + TW.z1) / 2, hx: (TW.x1 - TW.x0) / 2, hz: (TW.z1 - TW.z0) / 2, h: TW.h, kind: 'torre' },
  // oeste: soportales (pilares + alero; por debajo se camina)
  ...[-26, -17, -8, 1, 10, 19].map((z) => ({ shape: 'cyl', x: AR.x, z, r: 0.75, h: AR.h, kind: 'pilar' })),
  { shape: 'box', x: (AR.roofX0 + AR.roofX1) / 2, z: (AR.z0 + AR.z1) / 2, hx: (AR.roofX1 - AR.roofX0) / 2, hz: (AR.z1 - AR.z0) / 2, h: 1.2, y0: AR.h, kind: 'alero' },
  // cuadrantes: una cobertura alta y una baja en cada uno
  { shape: 'box', x: -16, z: -23, hx: 2, hz: 2, h: 4.2, kind: 'pedestal' },          // NO: el santo caído (pedestal sin estatua)
  { shape: 'box', x: -20, z: -9, hx: 1.8, hz: 1.0, h: 1.3, kind: 'puesto' },          // NO: puesto de mercado
  { shape: 'cyl', x: 13, z: -25, r: 1.7, h: 5, kind: 'quiosco' },                     // NE: quiosco de diarios
  { shape: 'box', x: 18, z: -17, hx: 1.0, hz: 1.8, h: 1.3, kind: 'puesto' },          // NE: puesto
  { shape: 'box', x: -18, z: 13, hx: 1.6, hz: 1.6, h: 4, kind: 'pedestal' },          // SO: pedestal
  { shape: 'box', x: -9, z: 22, hx: 1.6, hz: 0.9, h: 1.2, kind: 'carro' },            // SO: carro volcado
  { shape: 'cyl', x: 17, z: 15, r: 1.6, h: 5, kind: 'quiosco' },                      // SE: quiosco
  { shape: 'box', x: 10, z: 7, hx: 1.8, hz: 1.0, h: 1.3, kind: 'puesto' },            // SE: puesto
  // la calle: cajones caídos (cobertura baja a mitad de camino)
  { shape: 'box', x: -2.8, z: 41, hx: 0.9, hz: 0.9, h: 1.1, kind: 'cajon' },
  { shape: 'box', x: 3, z: 47, hx: 0.8, hz: 1.0, h: 1.0, kind: 'cajon' },
  // faroles (postes finos junto a las fachadas)
  ...[[-30, -30], [-30, 26], [30, -30], [30, 26], [-12, -30], [12, -30], [-12, 26], [12, 26], [-3.6, 36], [3.6, 52]].map(([x, z]) => ({ shape: 'cyl', x, z, r: 0.25, h: 4.6, kind: 'farol' })),
];

export function makeMap5() {
  const ring = (n, rad, y, cx = 0, cz = -4, a0 = 0.4) => Array.from({ length: n }, (_, k) => { const a = a0 + (k / n) * Math.PI * 2; return v3(cx + Math.cos(a) * rad, y, cz + Math.sin(a) * rad); });
  const map = makeLimboArena({
    id: 'm5', name: 'Plaza de los Ecos',
    rooms: [P, C], walls: WALLS, covers: COVERS, navStep: 7,
    navExtra: [[0, 33], [0.5, 38], [0, 44], [-0.5, 50], [0, 54], ...[-30, -21.5, -12.5, -3.5, 5.5, 14.5, 24].map((z) => [-31.4, z])], // la Calle y el pasillo de los Soportales
    zones: [{ kind: 'leve', x: M5.OJO.x, z: M5.OJO.z, r: M5.OJO.r, h: 40, k: M5.OJO.k }],
    spawn: { x: 0, z: 50, dx: 0, dz: -1 },
    noSpawn: [{ x: 0, z: 46, r: 14 }],
    bossAnchor: v3(0, 24, -8),
    spots: {
      anchor: v3(0, 0, 15),                                        // frente a la boca de la Calle
      plates: [v3(-24, 0.2, -24), v3(24, 0.2, 20), v3(24, 0.2, -26), v3(-24, 0.2, 22)],
      core: v3(-31, 0.9, -4),                                      // bajo los Soportales
      altar: v3(22, 0.4, -6),                                      // el portal al pie del Reloj
      resonators: (n) => ring(n, 15, 0, 0, -4, 0.3),
      eyes: (n) => Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2; return v3(Math.cos(a) * 20, 18 + (k % 2) * 6, -6 + Math.sin(a) * 20); }),
      valves: [v3(-20, 0, -4), v3(20, 0, 10)],
      boss: v3(0, 24, -8),
    },
    deco: { landmarks: { fuente: M5.FUENTE, torre: M5.TORRE, arcada: M5.ARCADA } },
  });
  return map;
}
