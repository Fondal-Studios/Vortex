// Efectos distintos para cada disparo. Los colores de arma son CANON (ver docs/ARTGATE.md); el dibujo vive en combatfx.js.
import * as THREE from 'three';

export const WEAPON_COLORS = [0x66ffee, 0xff9bd8, 0xffe066, 0xff7a45, 0xb9a4ff, 0x7dfcff, 0xffd23f, 0xff9a3c, 0x9dff5a, 0xff66c4, 0xffb35c, 0x8a7fff, 0xe8f6ff, 0x7dff9a, 0xff5a7a,
  0x66aaff, 0x9fe8ff, 0x7dff4a, 0xff7a1a, 0xffd23f, 0xff5a7a, 0xb98cff, 0x66ffcc, 0xe8d8ff, 0xff66c4];
// id → estilo (se mantiene por compatibilidad con herramientas viejas; el juego usa las tablas de combatfx.js)
const STYLE = {
  haz:      { tracer: 'line', impact: 'spark' },     prisma:  { tracer: 'line', impact: 'crystal' }, rafaga: { tracer: 'thin', impact: 'spark' },
  aguja:    { tracer: 'beam', impact: 'ring' },      pulso:   { tracer: 'line', impact: 'ring' },     gemelas: { tracer: 'thin', impact: 'spark' },
  solar:    { tracer: 'flame', impact: 'fire' },     fractal: { tracer: 'bolt', impact: 'shock' },    cetro: { tracer: 'line', impact: 'poison' },
  eclipse:  { tracer: 'line', impact: 'void' },
  voltaico: { tracer: 'bolt', impact: 'shock' },     glaciar: { tracer: 'frost', impact: 'frost' },  plaga: { tracer: 'flame', impact: 'poison' },
  brasa:    { tracer: 'flame', impact: 'fire' },     sierra:  { tracer: 'thin', impact: 'spark' },    dardos: { tracer: 'thin', impact: 'crystal' },
  requiem:  { tracer: 'beam', impact: 'void' },
};
export function styleOf(id, names) { return STYLE[names[id]] || { tracer: 'line', impact: 'spark' }; }

/**
 * Dibuja un disparo: origin = boca del arma en el mundo (Vector3), e = evento 'shot' { w, o, to[], fx }.
 * Funciona con o sin puntas (`to`): los proyectiles y el Pulsar sólo tienen fogonazo; las estelas las dibuja combat.frame().
 */
export function shotEffects(r, e, origin) {
  const C = r.fx && r.fx.combat; if (!C) return;
  C.shot(e, origin || new THREE.Vector3(e.o[0], e.o[1], e.o[2]));
}
