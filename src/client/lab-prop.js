// PROPORCIONES DEL LABORATORIO (docs/EDITOR_HUESPEDES.md §3.1). Compilador puro de proporciones -> escalas de hueso, y aplicador sobre el esqueleto humano.
//   const r = aplicarProporciones(human.bones, prop, kit.store.boneWorld());   // r = { x, y, z, lift }
// Idea: el jugador razona en «tamaño final» de cada segmento (efectivo); el compilador deriva la escala LOCAL de cada hueso como efectiva / efectiva(padre).
// Las escalas de hueso son UNIFORMES por segmento (sin cizalla). `altura` y `ancho` son globales (escala del contenedor, como `bodyScale` de huesped-cuerpo.js).
// El mezclador de animación no tiene pistas de escala, así que no pisa estos valores (medido en tools/lab-spike.mjs, informe en docs/EDITOR_HUESPEDES.md §3.1).
// Sin DOM: se puede importar desde Node (usa three sólo para dos vectores).
import * as T from 'three';

// Los rangos y las relaciones viven en el núcleo de datos compartido (src/shared/host-build-catalogo.js): el cliente, el servidor y la simulación usan los MISMOS números.
import { PROP_ORDEN, PROP_RANGOS as RANGOS, PROP_RELACIONES } from '../shared/host-build-catalogo.js';
/** Rango [mín, máx, neutro] de cada proporción. */
export const PROP_RANGOS = Object.freeze(Object.fromEntries(PROP_ORDEN.map((k) => [k, [RANGOS[k][0], RANGOS[k][1], 1]])));
export const PROP_CLAVES = [...PROP_ORDEN];
export const PROP_NEUTRA = Object.freeze(Object.fromEntries(PROP_CLAVES.map((k) => [k, 1])));
export const PROP_ES = { altura: 'Altura', ancho: 'Ancho', hombros: 'Hombros', torso: 'Torso', brazos: 'Brazos', piernas: 'Piernas', cabeza: 'Cabeza', manos: 'Manos', pies: 'Pies' };
/** Las 4 del modo básico. */
export const PROP_BASICAS = ['altura', 'ancho', 'piernas', 'cabeza'];

const num = (x, d) => (Number.isFinite(Number(x)) ? Number(x) : d);
/** Recorta cada valor a su rango (los que faltan quedan en 1). Devuelve un objeto nuevo. */
export function limitarProp(prop = {}) {
  const o = {}; for (const k of PROP_CLAVES) { const [a, b, d] = PROP_RANGOS[k]; o[k] = Math.min(b, Math.max(a, num(prop[k], d))); }
  return o;
}
/** Reglas entre proporciones (HB-05). Devuelve la lista de mensajes en español (vacía = todo bien). */
export function errorProp(prop) {
  const p = limitarProp(prop), out = [], R = PROP_RELACIONES;
  if (p.altura * p.piernas > R.alturaPiernasMax + 1e-9) out.push(`La altura y las piernas juntas no pueden pasar de ${String(R.alturaPiernasMax).replace('.', ',')}: bajá una de las dos.`);
  if (p.cabeza > p.hombros * R.cabezaSobreHombrosMax + 1e-9) out.push('La cabeza no puede ser más de un 20 % más grande que los hombros.');
  if (Math.abs(p.brazos - p.hombros) > R.brazosHombrosMax + 1e-9) out.push(`Los brazos y los hombros no pueden diferir en más de ${String(R.brazosHombrosMax).replace('.', ',')}.`);
  return out;
}
/**
 * Cambia UNA proporción al valor pedido y, si rompería una regla entre proporciones, la acerca hasta donde sí se puede (nunca toca las otras).
 * Devuelve { prop, tope } (tope = texto en español si el valor pedido no se pudo alcanzar, o '').
 */
export function ajustarProp(prop, k, v) {
  const p = limitarProp({ ...prop, [k]: v }), [a, b] = PROP_RANGOS[k], R = PROP_RELACIONES, pedido = Math.min(b, Math.max(a, num(v, 1)));
  let x = p[k], motivo = '';
  const lim = (cota, texto) => { if (cota < x) { x = cota; motivo = texto; } }, piso = (cota, texto) => { if (cota > x) { x = cota; motivo = texto; } };
  if (k === 'altura') lim(R.alturaPiernasMax / p.piernas, 'altura y piernas');
  if (k === 'piernas') lim(R.alturaPiernasMax / p.altura, 'altura y piernas');
  if (k === 'cabeza') lim(p.hombros * R.cabezaSobreHombrosMax, 'cabeza y hombros');
  if (k === 'hombros') { piso(p.cabeza / R.cabezaSobreHombrosMax, 'cabeza y hombros'); piso(p.brazos - R.brazosHombrosMax, 'brazos y hombros'); lim(p.brazos + R.brazosHombrosMax, 'brazos y hombros'); }
  if (k === 'brazos') { piso(p.hombros - R.brazosHombrosMax, 'brazos y hombros'); lim(p.hombros + R.brazosHombrosMax, 'brazos y hombros'); }
  x = Math.min(b, Math.max(a, Math.round(x * 200) / 200));
  if (x > pedido) x = Math.floor(Math.min(x, pedido + 1e-9) * 200) / 200;
  let out = { ...p, [k]: x };
  for (let i = 0; i < 12 && errorProp(out).length; i++) { const dir = Math.sign((num(prop[k], 1)) - x) || (x > 1 ? -1 : 1); x = Math.min(b, Math.max(a, Math.round((x + dir * 0.005) * 200) / 200)); out = { ...p, [k]: x }; }   // el redondeo a 0,005 pudo pasarse un pelo de la regla: se corrige
  return { prop: out, tope: Math.abs(x - pedido) > 0.0025 ? `Tope: ${PROP_ES[k].toLowerCase()} ya no puede seguir porque se rompería la regla de ${motivo || 'proporciones'}.` : '' };
}

/** [hueso, grupo ('torso'...|número fijo), hueso padre de la tabla]. Cada hueso `_h` escala el segmento que EMPIEZA en esa articulación. */
function tabla() {
  const T = [['spine04_h', 'torso', null], ['spine03_h', 'torso', 'spine04_h'], ['spine02_h', 'torso', 'spine03_h'], ['spine01_h', 'torso', 'spine02_h'], ['neck01_h', 1, 'spine01_h'], ['head_h', 'cabeza', 'neck01_h']];
  for (const s of ['L', 'R']) T.push([`clavicle_${s}_h`, 'hombros', 'spine01_h'], [`upperarm01_${s}_h`, 'brazos', `clavicle_${s}_h`], [`lowerarm01_${s}_h`, 'brazos', `upperarm01_${s}_h`], [`wrist_${s}_h`, 'manos', `lowerarm01_${s}_h`],
    [`upperleg01_${s}_h`, 'piernas', null], [`lowerleg01_${s}_h`, 'piernas', `upperleg01_${s}_h`], [`foot_${s}_h`, 'pies', `lowerleg01_${s}_h`]);
  return T;
}
export const TABLA_HUESOS = tabla();

/** Escalas efectivas por segmento (altura y ancho aparte, son del contenedor). */
export function escalasEfectivas(prop) { const p = limitarProp(prop); return { torso: p.torso, hombros: p.hombros, brazos: p.brazos, piernas: p.piernas, cabeza: p.cabeza, manos: p.manos, pies: p.pies }; }

/** Escala LOCAL que lleva cada hueso de la tabla: efectiva / efectiva(padre). */
export function escalasLocales(prop) {
  const e = escalasEfectivas(prop), eff = (g) => (typeof g === 'number' ? g : e[g]), by = new Map(TABLA_HUESOS.map((r) => [r[0], r])), out = {};
  for (const [h, g, par] of TABLA_HUESOS) { const pe = par ? eff(by.get(par)[1]) : 1; out[h] = eff(g) / pe; }
  return out;
}

/**
 * Sube o baja el cuerpo para que la planta del pie siga en el suelo: las piernas y los pies más largos hunden el pie (el clip mueve la cadera a una altura fija).
 * W = posiciones de enlace de los huesos (kit.store.boneWorld()). Devuelve metros del modelo, SIN la escala del contenedor.
 */
export function elevacion(prop, W) {
  const p = limitarProp(prop), hip = W && W['upperleg01_L_h'] ? W['upperleg01_L_h'][1] : 0.81, ank = W && W['foot_L_h'] ? W['foot_L_h'][1] : 0.08;
  return (p.piernas - 1) * (hip - ank) + (p.pies - 1) * ank;
}

const _a = new T.Vector3(), _b = new T.Matrix4();
/**
 * Elevación VIVA (cada cuadro, después de animar): la distancia cadera→tobillo cambia en cada clip (agachado, salto…), así que se mide en la pose actual.
 * Con las piernas escaladas `s`, el pie baja (s−1)·d0 (d0 = distancia sin escalar) y la planta (pies−1)·altura del tobillo. `holder` es el contenedor que lleva la escala global.
 * Devuelve metros del modelo (hay que multiplicar por holder.scale.y para ponerlo en holder.position.y).
 */
export function elevacionViva(bones, prop, holder, anklePose = 0.08) {
  const p = limitarProp(prop); if (!bones || !holder) return 0;
  holder.updateWorldMatrix(true, false); _b.copy(holder.matrixWorld).invert();
  let d = 0;
  for (const s of ['L', 'R']) { const h = bones[`upperleg01_${s}_h`], a = bones[`foot_${s}_h`]; if (!h || !a) continue; h.updateWorldMatrix(true, false); a.updateWorldMatrix(true, false); const hy = _a.setFromMatrixPosition(h.matrixWorld).applyMatrix4(_b).y, ay = _a.setFromMatrixPosition(a.matrixWorld).applyMatrix4(_b).y; d = Math.max(d, hy - ay); }
  return (p.piernas - 1) * (d / p.piernas) + (p.pies - 1) * anklePose;
}

/**
 * Aplica las proporciones a los huesos (`human.bones`, nombres `_h`). Devuelve { x, y, z, lift }: multiplicadores del contenedor (ancho, altura, ancho) y elevación en metros
 * del modelo. Es seguro llamarla en cada cambio de un slider (no reconstruye nada) y también en cada cuadro.
 */
export function aplicarProporciones(bones, prop, W = null) {
  const p = limitarProp(prop), loc = escalasLocales(p);
  if (bones) for (const [h, s] of Object.entries(loc)) { const b = bones[h]; if (b) b.scale.setScalar(s); }
  return { x: p.ancho, y: p.altura, z: p.ancho, lift: elevacion(p, W) };
}
