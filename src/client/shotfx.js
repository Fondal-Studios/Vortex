// Efectos distintos para cada disparo: trazas, impactos y destellos según el arma (los arma el sim; acá sólo se dibujan).
import * as THREE from 'three';
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export const WEAPON_COLORS = [0x66ffee, 0xff9bd8, 0xffe066, 0xff7a45, 0xb9a4ff, 0x7dfcff, 0xffd23f, 0xff9a3c, 0x9dff5a, 0xff66c4, 0xffb35c, 0x8a7fff, 0xe8f6ff, 0x7dff9a, 0xff5a7a,
  0x66aaff, 0x9fe8ff, 0x7dff4a, 0xff7a1a, 0xffd23f, 0xff5a7a, 0xb98cff, 0x66ffcc, 0xe8d8ff, 0xff66c4];
// id → estilo. tracer: line | bolt (rayo zigzag) | thin | flame | beam | none. impact: spark | frost | poison | fire | shock | ring | crystal | void
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

function impact(r, kind, p, col) {
  const fx = r.fx;
  switch (kind) {
    case 'frost': fx.burst(p, 0xcff6ff, 12, 5, 0.6, 0.5); fx.burst(p, 0x66b8ff, 6, 3, 0.9, 0.9); break;
    case 'poison': fx.burst(p, 0x7dff4a, 10, 3, 0.9, 0.9); break;
    case 'fire': fx.burst(p, 0xff7a1a, 10, 4, 0.5, 0.8); fx.burst(p, 0xffe066, 4, 6, 0.3, 0.4); break;
    case 'shock': fx.burst(p, 0xcfe8ff, 14, 9, 0.25, 0.4); fx.blast(p, 0x66aaff, 1.6, 0.18); break;
    case 'ring': fx.blast(p, col, 2.2, 0.3); fx.burst(p, col, 8, 6, 0.35, 0.5); break;
    case 'crystal': fx.burst(p, col, 14, 8, 0.5, 0.45); break;
    case 'void': fx.burst(p, 0x1a0a2a, 8, 4, 0.6, 1.0); fx.blast(p, 0xb98cff, 2.4, 0.35); break;
    default: fx.burst(p, col, 6, 6, 0.3, 0.4);
  }
}

/** Dibuja un disparo: origin (mundo), tips (puntos de impacto), id del arma. `names` = ids de WEAPONS. */
export function shotEffects(r, e, origin, names) {
  const id = e.w, col = WEAPON_COLORS[id] || 0xffffff;
  let st = styleOf(id, names);
  if (e.fx) st = { tracer: e.fx === 'voltaico' ? 'bolt' : e.fx === 'glaciar' ? 'frost' : e.fx === 'brasa' ? 'flame' : 'line', impact: e.fx === 'voltaico' ? 'shock' : e.fx === 'glaciar' ? 'frost' : e.fx === 'brasa' ? 'fire' : 'ring' }; // Quimera
  const c = e.fx === 'voltaico' ? 0x66aaff : e.fx === 'glaciar' ? 0x9fe8ff : e.fx === 'brasa' ? 0xff7a1a : col;
  for (const t of e.to || []) {
    const tip = V(t);
    switch (st.tracer) {
      case 'bolt': r.objects.bolt(origin, tip, c); break;
      case 'beam': r.objects.beam([origin.x, origin.y, origin.z], t, c, 0.22, 0.16); r.fx.tracer(origin, tip, c); break;
      case 'frost': r.fx.tracer(origin, tip, 0xcff6ff); r.objects.beam([origin.x, origin.y, origin.z], t, 0x66b8ff, 0.2, 0.1); break;
      case 'flame': { const n = 5; for (let i = 1; i <= n; i++) { const q = origin.clone().lerp(tip, i / n); r.fx.burst(q, i % 2 ? 0xff7a1a : 0xffd04a, 2, 2 + i, 0.35, 0.8 + i * 0.12); } break; }
      case 'thin': r.fx.tracer(origin, tip, c); break;
      default: r.fx.tracer(origin, tip, c);
    }
    impact(r, st.impact, tip, c);
  }
}
