// Datos del bestiario (interfaz) y consejos de las pantallas de carga. Los números salen de src/sim/data.js.
import { MONSTERS } from '../sim/data.js';
import { COLORS } from './models.js';

const TEXT = {
  astilla: ['Depredador-insecto de biocristal. Zigzaguea, salta y muerde.', 'Frágil: un par de disparos.'],
  geoda: ['Almeja acorazada. Rueda cerrada (casi inmune) y cada ~5 s se abre dos segundos.', 'Dispará solo cuando se abre: el ojo-núcleo es su debilidad.'],
  prisma: ['Mantarraya-polilla de alas translúcidas. Orbita en lo alto, brilla y pica.', 'Disparale durante el brillo de aviso.'],
  lente: ['Un ojo gigante sobre un tallo. Su lente se enciende 0,6 s antes de disparar un proyectil lento.', 'Esquivá de costado; cubrite en las islas.'],
  cuarzo: ['Madre-pólipo. Sus sacos de huevos se hinchan y suelta Astillas (hasta 4).', 'Priorizalo: huye y no deja de invocar.'],
  espejo: ['Camaleón de piel espejada: casi invisible. Parpadea detrás tuyo.', 'Se revela 2 s al recibir daño; mirá atrás al oír el timbre.'],
  racimo: ['Racimo de vejigas de gas. Late cada vez más rápido al acercarse y estalla.', 'Matalo lejos: su explosión daña a sus vecinos.'],
  graviton: ['Embrión flotante que invierte la gravedad de todos durante 3,5 s.', 'Prioridad alta: carga 1,3 s antes del pulso.'],
  obelisco: ['Torreta-planta con un ojo-flor. Traza una línea láser 1,6 s y dispara un rayo veloz.', 'Movete de costado cuando la línea se fija.'],
  aurora: ['Medusa-ángel. Cura 30 % y escuda a sus aliados cercanos.', 'Matala primero o los demás se vuelven duros.'],
  ariete: ['Escarabajo-rinoceronte acorazado. Patea 1 s, embiste en línea recta y queda aturdido.', 'Hacete a un lado; aturdido recibe ×1,5.'],
  espiral: ['Nautilo de concha en espiral. Carga y arrastra a los jugadores durante 2,6 s.', 'Resistí moviéndote lejos de él.'],
  coloso: ['Jefe del Vacío de Islas: leviatán-ojo flotante. 3 fases: anillos de orbes, refuerzos y pulsos de gravedad.', 'Su núcleo siempre es vulnerable. Usá la Aguja.'],
  madre: ['Jefe de la Cámara Fractal: flor-útero. Cerrada dispara espirales; abierta pare Racimos.', 'Castigá la ventana abierta.'],
};
export const BESTIARY = Object.keys(MONSTERS).map((k) => {
  const m = MONSTERS[k];
  return { kind: k, name: m.name, role: m.role, hp: m.hp, speed: m.speed, fly: m.fly, boss: !!m.boss, color: '#' + (COLORS[k] || 0xffffff).toString(16).padStart(6, '0'), desc: TEXT[k][0], tip: TEXT[k][1] };
});

export const TIPS = [
  'Cuando una criatura brilla, está por atacar: ese es tu aviso.',
  'La Geoda solo es vulnerable cuando se abre. Esperá y disparale.',
  'Los círculos verdes invierten la gravedad: caés hacia arriba.',
  'Las burbujas ámbar frenan el tiempo de las criaturas que entran.',
  'El Racimo explota al morir: usalo contra la horda.',
  'En cooperativo, acercate 3 segundos a un compañero caído para reanimarlo.',
  'Sin munición, el Haz es infinito. Siempre tenés un arma.',
  'Durante la marea no hay gravedad: el combate pasa a 3D.',
  'La Aguja atraviesa a todas las criaturas en línea.',
  'La Nova no te daña a vos: usala sin miedo en distancias cortas.',
];
