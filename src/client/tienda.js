// Compras y ventas de la TIENDA (docs/TIENDA.md) sobre el perfil guardado. Cada función valida TODO antes de tocar nada
// (saldo, requisito, cupo, que el renglón exista en la oferta vigente) y devuelve { ok, motivo?, frase, … }: nunca deja núcleos negativos.
// Los precios salen de src/sim/tienda.js (fijos); acá no se inventa ninguno.
import { CHARACTERS } from '../sim/data.js';
import { ITEMS, MATERIAL_IDS, MAT_STOCK_MAX, LIMITE_INVENTARIO, PLANOS, qForja, desguaceValor } from '../sim/items.js';
import { MODOS_ARBOL } from '../sim/progresion.js';
import {
  oferta, diaDe, claveOferta, precioHuesped, estadoHuesped, reqHuesped, poseeHuesped as _posee, SERVICIOS, precioReroll, ESENCIAS_IDS, ventaMat, frase,
} from '../sim/tienda.js';
import * as Perfil from './perfil.js';

const fallo = (motivo, tipo = 'pobre') => ({ ok: false, motivo, frase: frase(tipo, motivo.length) });
const hecho = (extra = {}) => { Perfil.guardar(); return { ok: true, frase: frase('comprado', Perfil.perfil().tienda.comp.length + Perfil.perfil().cores), ...extra }; };
const gasta = (n) => { const p = Perfil.perfil(); if (!Number.isFinite(n) || n < 0 || p.cores < n) return false; p.cores -= Math.floor(n); return true; };

export const saldo = () => Perfil.perfil().cores;
export const poseeHuesped = (id) => _posee(Perfil.perfil(), id);
/** Estado de un Huésped para la tienda (ver estadoHuesped en sim/tienda.js). */
export const estado = (id) => estadoHuesped(Perfil.perfil(), id);

/** La oferta vigente (día UTC + partidas terminadas). Si cambió, se borran las compras de la anterior. Devuelve la oferta con `comprado` en cada renglón. */
export function ofertaActual(ahora = Date.now()) {
  const p = Perfil.perfil(), of = oferta(diaDe(ahora), p.tienda.rot);
  if (p.tienda.clave !== of.clave) { p.tienda.clave = of.clave; p.tienda.comp = []; Perfil.guardar(); }
  for (const g of ['materiales', 'planos', 'objetos']) for (const r of of[g]) r.comprado = p.tienda.comp.includes(r.k);
  return of;
}

/* ───────── Huéspedes ───────── */
export function comprarHuesped(id) {
  const p = Perfil.perfil(), est = estadoHuesped(p, id);
  if (!CHARACTERS[id] || !CHARACTERS[id].host) return fallo('Ese Huésped no está en venta.', 'requisito');
  if (est === 'poseido') return fallo('Ya es tuyo.', 'requisito');
  if (est === 'bloqueado') return fallo('Ese Huésped no se vende: se gana con la campaña o con su desafío.', 'requisito');
  if (est === 'falta requisito') return fallo(reqHuesped(p, id).texto || 'Falta un requisito.', 'requisito');
  if (est !== 'comprable' || !gasta(precioHuesped(id))) return fallo(`Faltan núcleos (cuesta ${precioHuesped(id)}).`);
  p.huespedes = [...new Set([...p.huespedes, id])]; return hecho({ id });
}

/* ───────── renglones de la oferta rotativa ───────── */
export function comprarRenglon(grupo, k, ahora = Date.now()) {
  const of = ofertaActual(ahora), p = Perfil.perfil(), r = (of[grupo] || []).find((x) => x.k === k);
  if (!r) return fallo('Ese renglón ya no está en el mostrador.', 'requisito');
  if (r.comprado) return fallo('Ya lo compraste en esta tanda.', 'requisito');
  if (p.cores < r.precio) return fallo(`Faltan núcleos (cuesta ${r.precio}).`);
  if (grupo === 'materiales') {
    const a = p.materiales[r.mat]; if (!a || a[r.cal] + r.n > MAT_STOCK_MAX) return fallo('Tu depósito de ese material no tiene lugar para tanto.', 'requisito');
    gasta(r.precio); Perfil.sumarMat(r.mat, r.cal, r.n);
  } else if (grupo === 'planos') {
    if (!PLANOS[r.id] || Perfil.conoce(r.id)) return fallo('Ese plano ya lo conocés.', 'requisito');
    gasta(r.precio); Perfil.aprenderPlano(r.id);
  } else {
    if (!ITEMS[r.id]) return fallo('Objeto desconocido.', 'requisito');
    if (p.inventario.length >= LIMITE_INVENTARIO) return fallo('Tu inventario está lleno: desguazá algo primero.', 'requisito');
    gasta(r.precio); const res = Perfil.agregarItem({ id: r.id, q: r.q }); if (!res.ok) { p.cores += r.precio; return fallo('No entró al inventario.', 'requisito'); }
  }
  p.tienda.comp.push(r.k); return hecho({ renglon: r });
}

/* ───────── servicios ───────── */
export const botiquines = () => Perfil.perfil().consum.botiquin;
export function comprarBotiquin() {
  const p = Perfil.perfil(), S = SERVICIOS.botiquin;
  if (p.consum.botiquin >= S.max) return fallo(`Ya llevás ${S.max} botiquines: es el máximo.`, 'requisito');
  if (!gasta(S.precio)) return fallo(`Faltan núcleos (cuesta ${S.precio}).`);
  p.consum.botiquin++; return hecho();
}
/** Se llama al empezar una partida en solitario: gasta un botiquín y devuelve 1 (o 0 si no hay). */
export function usarBotiquin() { const p = Perfil.perfil(); if (p.consum.botiquin <= 0) return 0; p.consum.botiquin--; Perfil.guardar(); return 1; }

/** Cuántos puntos devolvería el reinicio de ese árbol (0 si no hay nodos elegidos). */
export function puntosReinicio(char, modo) { const a = Perfil.arbol(char, modo); return a.nodos.length ? a.gastado : 0; }
export function comprarReinicio(char, modo) {
  const p = Perfil.perfil(), S = SERVICIOS.reinicio;
  if (!CHARACTERS[char] || !CHARACTERS[char].host || !MODOS_ARBOL.includes(modo)) return fallo('Ese árbol no existe.', 'requisito');
  if (!puntosReinicio(char, modo)) return fallo('Ese árbol no tiene nodos elegidos: no hay nada que reiniciar.', 'requisito');
  if (!gasta(S.precio)) return fallo(`Faltan núcleos (cuesta ${S.precio}).`);
  const e = p.arb[char][modo]; e.nodos = []; return hecho({ devueltos: Perfil.arbol(char, modo).libres });
}

/** Piezas del inventario que se pueden retirar, con su precio. */
export const retirables = () => Perfil.perfil().inventario.map((it) => ({ u: it.u, id: it.id, q: it.q, precio: precioReroll(ITEMS[it.id].r) }));
export function retirarTirada(uid) {
  const p = Perfil.perfil(), it = Perfil.instDe(uid); if (!it) return fallo('Esa pieza ya no está.', 'requisito');
  const precio = precioReroll(ITEMS[it.id].r); if (!gasta(precio)) return fallo(`Faltan núcleos (cuesta ${precio}).`);
  const antes = it.q; it.q = qForja(it.id, p.nf++, 1.5); return hecho({ antes, despues: it.q, uid });
}

export function cambiarEsencia(ess, dir) {
  const p = Perfil.perfil(), S = SERVICIOS.esencia; if (!ESENCIAS_IDS.includes(ess)) return fallo('Esa esencia no existe.', 'requisito');
  if (dir > 0) { if (p.ess[ess] >= 999) return fallo('Ya no te cabe más de esa esencia.', 'requisito'); if (!gasta(S.compra)) return fallo(`Faltan núcleos (cuesta ${S.compra}).`); p.ess[ess]++; return hecho(); }
  if ((p.ess[ess] || 0) < 1) return fallo('No tenés esa esencia para vender.', 'nada');
  p.ess[ess]--; p.cores += S.venta; Perfil.guardar(); return { ok: true, frase: frase('vendido', p.cores) };
}

/* ───────── venta / desguace rápido ───────── */
export function venderMat(mat, cal, n = 1) {
  const p = Perfil.perfil(), a = p.materiales[mat]; n = Math.floor(n);
  if (!MATERIAL_IDS.includes(mat) || !(cal >= 0 && cal <= 3) || !a || n < 1) return fallo('Eso no se puede vender.', 'nada');
  if (a[cal] < n) return fallo('No tenés tantos.', 'nada');
  a[cal] -= n; const v = ventaMat(mat, cal) * n; p.cores += v; Perfil.guardar(); return { ok: true, cores: v, frase: frase('vendido', v) };
}
/** Qué se llevaría el desguace rápido de lo no protegido hasta esa rareza: { n, cores } (no cambia nada). */
export function previewSobrantes(hasta = 0) {
  let n = 0, cores = 0;
  for (const it of Perfil.perfil().inventario) { if (it.lk || it.fv || Perfil.puestoEn(it.u) || ITEMS[it.id].r > hasta) continue; n++; cores += desguaceValor(it).cores; }
  return { n, cores };
}
export function venderSobrantes(hasta = 0) {
  const pv = previewSobrantes(hasta); if (!pv.n) return fallo('No hay sobrantes de esa rareza (las piezas bloqueadas, favoritas o puestas no se venden).', 'nada');
  const r = Perfil.desguazarSobrantes(hasta); Perfil.guardar(); return { ok: true, n: r.n, cores: r.cores, frase: frase('vendido', r.n) };
}
