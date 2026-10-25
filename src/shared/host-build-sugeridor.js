// SUGERIDOR DETERMINISTA del Laboratorio (EH-11, docs/EDITOR_HUESPEDES.md §4.4). NO es inteligencia artificial generativa:
// es un motor de reglas y plantillas con un generador de números al azar SEMBRADO. 100 % local: cero red, cero telemetría.
//   · misma plantilla + misma semilla + mismo ctx  →  EXACTAMENTE la misma build (misma huella).
//   · toda salida pasa `validar` sin errores (se repara antes de entregar).
//   · las piezas que el jugador no posee (ctx.poseidas) nunca se usan.
//
// API: PLANTILLAS · sugerir(plantilla, semilla, ctx) · reparar(raw, ctx) · sugerirPaleta(semilla) · completarSimetria(build) · explicar(build, ctx) · prng(semilla)
import { huella as hashTexto } from '../sim/ledger.js';
import {
  PARTES, ANCLAS, PROP_RANGOS, PROP_RELACIONES, ACABADOS, defecto, normalizar, validar, sellar, derivarStats, conflictos, instancias, limitesDe, limitarBrillo, MENSAJES,
} from './host-build.js';

/** Generador de números al azar sembrado (mulberry32). La semilla puede ser número o texto. */
export function prng(semilla) {
  let s = typeof semilla === 'string' ? parseInt(hashTexto(semilla).slice(-8), 16) : Number.isFinite(semilla) ? Math.floor(semilla) : 0;
  s >>>= 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const elige = (r, a) => a[Math.min(a.length - 1, Math.floor(r() * a.length))];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nuevaPieza = (p, a, o = {}) => ({ p, a, sim: o.sim || 'ninguna', ...(o.l ? { l: o.l } : {}), t: { pos: o.pos || [0, 0, 0], rot: o.rot || [0, 0, 0], esc: o.esc || 1 }, c: { mat: o.mat || PARTES[p].variantesMat[0], tinte: o.tinte || null } });

/* ───────── paleta: armonías en HSL ───────── */
function hslHex(h, s, l) {
  h = ((h % 360) + 360) % 360; const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
/** Tres colores que combinan (análogos, complementarios o tríada). */
export function sugerirPaleta(semilla) {
  const r = prng(semilla), h = Math.floor(r() * 360), esquema = elige(r, ['analoga', 'complementaria', 'triada']);
  const h2 = esquema === 'analoga' ? h + 28 : esquema === 'complementaria' ? h + 180 : h + 120;
  return { primario: hslHex(h, 0.45 + r() * 0.25, 0.28 + r() * 0.14), secundario: hslHex(h + 12, 0.15 + r() * 0.15, 0.12 + r() * 0.08), emisivo: limitarBrillo(hslHex(h2, 0.85, 0.55 + r() * 0.1)).v, esquema };
}

/* ───────── plantillas ───────── */
// `partes`: piezas cosméticas y estructurales; `funcionales`: preferencias en orden (se usan las que la capacidad y la posesión permitan).
export const PLANTILLAS = Object.freeze({
  brutal: Object.freeze({
    id: 'brutal', nombre: 'Brutal', desc: 'Ancho y pesado: cuernos, hombreras y placas.',
    prop: { altura: 1.02, ancho: 1.12, hombros: 1.10, torso: 1.08, brazos: 1.10, piernas: 1.0, cabeza: 0.95, manos: 1.1, pies: 1.05 },
    partes: [['cuerno_curvo', 'cabeza', { sim: 'espejo', esc: 1.2 }], ['hombrera_espinas', 'hombros', { sim: 'espejo', esc: 1.2 }], ['placa_pectoral', 'pecho', {}], ['cuchilla_antebrazo', 'antebrazos', { sim: 'espejo' }], ['rodillera_placa', 'muslos', { sim: 'espejo' }]],
    funcionales: [['placas', 'espalda'], ['tentaculo', 'espalda'], ['medula', 'pecho']], nombres: ['Rompehuesos', 'Coloso de fosa', 'Muralla viva', 'Cuerno de hierro'],
  }),
  cazador: Object.freeze({
    id: 'cazador', nombre: 'Cazador', desc: 'Esbelto y rápido: cola, cresta y cuchillas.',
    prop: { altura: 1.08, ancho: 0.94, hombros: 0.95, torso: 0.95, brazos: 1.04, piernas: 1.08, cabeza: 0.95, manos: 1.0, pies: 1.1 },
    partes: [['cresta_osea', 'cabeza', {}], ['cola_larga', 'cola', {}], ['espinas_dorsales', 'espalda', {}], ['cuchilla_antebrazo', 'antebrazos', { sim: 'espejo' }]],
    funcionales: [['adrenal', 'cintura'], ['saco_g', 'espalda'], ['ojo_extra', 'cabeza']], nombres: ['Cazador de brasas', 'Sombra de la cresta', 'Rastro afilado', 'Lince de vidrio'],
  }),
  etereo: Object.freeze({
    id: 'etereo', nombre: 'Etéreo', desc: 'Alto y liviano: alas, corona y un ojo extra.',
    prop: { altura: 1.10, ancho: 0.92, hombros: 0.96, torso: 0.94, brazos: 1.02, piernas: 1.04, cabeza: 1.0, manos: 1.05, pies: 1.0 },
    partes: [['corona_espinas', 'cabeza', { mat: 'gold' }], ['alas_membrana', 'espalda', { esc: 1.1 }], ['gorguera', 'cuello', {}]],
    funcionales: [['ojo_extra', 'cabeza'], ['espiraculo', 'cabeza'], ['corazon_cristal', 'pecho']], nombres: ['Visión alada', 'Luz de ceniza', 'Ala del umbral', 'Heraldo pálido'],
  }),
  enjambre: Object.freeze({
    id: 'enjambre', nombre: 'Enjambre', desc: 'Tentáculos y alas pequeñas, con garras en la mano libre.',
    prop: { altura: 1.0, ancho: 1.0, hombros: 1.0, torso: 1.0, brazos: 1.06, piernas: 1.0, cabeza: 1.0, manos: 1.15, pies: 1.0 },
    partes: [['alas_membrana', 'espalda', { esc: 0.8 }], ['cuerno_curvo', 'cabeza', { sim: 'espejo', esc: 0.8 }], ['garras_mano', 'manos', { l: 'izq' }]],
    funcionales: [['tentaculo', 'cintura', { sim: 'espejo' }], ['medula', 'pecho'], ['adrenal', 'cintura']], nombres: ['Madre de la colmena', 'Nube de picos', 'Cría inquieta', 'Zumbido hondo'],
  }),
  acorazado: Object.freeze({
    id: 'acorazado', nombre: 'Acorazado', desc: 'Cubierto de placas: aguanta lo que venga.',
    prop: { altura: 0.98, ancho: 1.10, hombros: 1.08, torso: 1.06, brazos: 1.05, piernas: 0.98, cabeza: 0.95, manos: 1.0, pies: 1.1 },
    partes: [['gorguera', 'cuello', {}], ['hombrera_espinas', 'hombros', { sim: 'espejo' }], ['placa_pectoral', 'pecho', {}], ['rodillera_placa', 'muslos', { sim: 'espejo' }], ['espinas_dorsales', 'espalda', {}]],
    funcionales: [['placas', 'hombros', { sim: 'espejo' }], ['corazon_cristal', 'pecho'], ['medula', 'espalda']], nombres: ['Bastión andante', 'Caparazón de coral', 'Muro de quitina', 'Guardia ósea'],
  }),
});
export const PLANTILLA_IDS = Object.freeze(Object.keys(PLANTILLAS));

/* ───────── reparar ───────── */
const orden = (e, i) => [PARTES[e.p].valor, -PARTES[e.p].tris.low, -i];   // se quita primero: menos valor, más triángulos, la más nueva
const menosValiosa = (b, candidatos) => {
  let mejor = -1, mk = null;
  for (const i of candidatos) { const k = orden(b.partes[i], i); if (mk === null || k[0] < mk[0] || (k[0] === mk[0] && (k[1] < mk[1] || (k[1] === mk[1] && k[2] < mk[2])))) { mk = k; mejor = i; } }
  return mejor;
};
const quitar = (b, i, cambios, motivo) => { const e = b.partes[i]; cambios.push(`Se quitó «${PARTES[e.p].nombre}»: ${motivo}.`); b.partes.splice(i, 1); };

/**
 * «Reparar»: deja el diseño válido con los menores cambios posibles y SIN mentir (devuelve la lista de cambios en español).
 * Aplica los recortes de HB-04/08/14, arregla proporciones (HB-05), quita choques (HB-09) y, si hace falta, las piezas de menos valor
 * hasta cumplir HB-10/11/13/16. Las piezas no poseídas (HB-06) se quitan. → { build (sellada), cambios[], ok }
 */
export function reparar(raw, ctx = {}) {
  const cambios = [], c = ctx && typeof ctx === 'object' ? ctx : {};
  const v0 = validar(raw, c);
  if (v0.errores.some((e) => e.codigo === 'HB-01')) { const d = defecto(); return { build: sellar(d, c), cambios: ['El diseño no se pudo leer: se volvió al Híbrido por defecto.'], ok: true }; }
  for (const a of v0.avisos) if (a.codigo !== 'HB-18') cambios.push(a.msg);
  for (const e of v0.errores) if (['HB-02', 'HB-03', 'HB-06', 'HB-07'].includes(e.codigo)) cambios.push(e.msg);
  let b = normalizar(raw);
  const poseidas = c.poseidas instanceof Set ? c.poseidas : Array.isArray(c.poseidas) ? new Set(c.poseidas) : null;
  if (poseidas) for (let i = b.partes.length - 1; i >= 0; i--) if (!poseidas.has(b.partes[i].p)) quitar(b, i, cambios, 'todavía no la tenés');
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    const r = validar(b, c); if (r.ok) break;
    const cod = r.errores.map((e) => e.codigo);
    const P = b.prop, REL = PROP_RELACIONES;
    if (cod.includes('HB-05')) {
      if (Math.abs(P.brazos - P.hombros) > REL.brazosHombrosMax + 1e-9) { P.brazos = clamp(Math.round(clamp(P.brazos, P.hombros - REL.brazosHombrosMax, P.hombros + REL.brazosHombrosMax) * 200) / 200, ...PROP_RANGOS.brazos); cambios.push('Se acercó el largo de brazos al ancho de hombros.'); }
      else if (P.altura * P.piernas > REL.alturaPiernasMax + 1e-9) { P.piernas = Math.max(PROP_RANGOS.piernas[0], Math.floor(REL.alturaPiernasMax / P.altura * 200) / 200); cambios.push('Se acortaron las piernas para que los pies lleguen al suelo.'); }
      else if (P.cabeza > REL.cabezaSobreHombrosMax * P.hombros + 1e-9) { P.cabeza = Math.max(PROP_RANGOS.cabeza[0], Math.floor(REL.cabezaSobreHombrosMax * P.hombros * 200) / 200); cambios.push('Se achicó la cabeza respecto de los hombros.'); }
      else break;
      continue;
    }
    if (cod.includes('HB-12')) {
      let hecho = false;
      for (const e of b.partes) if (e.a === 'manos' && (e.sim === 'espejo' || e.l === 'der')) { e.sim = 'ninguna'; e.l = 'izq'; hecho = true; }
      if (hecho) { cambios.push('Las garras quedaron solo en la mano izquierda: la derecha lleva tu arma.'); continue; }
    }
    if (cod.includes('HB-09')) {
      const cf = conflictos(b);
      if (cf.length) { const i = menosValiosa(b, [cf[0].i, cf[0].j]); quitar(b, i, cambios, 'chocaba con otra pieza'); continue; }
    }
    if (cod.includes('HB-13')) {
      const funcs = b.partes.map((e, i) => i).filter((i) => PARTES[b.partes[i].p].cat === 'funcional');
      if (funcs.length) { quitar(b, funcs[funcs.length - 1], cambios, 'no hay ranuras suficientes'); continue; }
    }
    // HB-10 / 11 / 16 (y cualquier otro): fuera la menos valiosa
    if (b.partes.length) { quitar(b, menosValiosa(b, b.partes.map((e, i) => i)), cambios, 'el diseño se pasaba de los límites'); continue; }
    break;
  }
  const fin = validar(b, c);
  if (!fin.ok) { const d = defecto(); cambios.push('No se pudo reparar: se volvió al Híbrido por defecto.'); return { build: sellar(d, c), cambios, ok: false }; }
  return { build: sellar(b, c), cambios: [...new Set(cambios)], ok: true };
}

/* ───────── sugerir ───────── */
/**
 * Una build completa a partir de una plantilla y una semilla. Misma entrada → misma salida. Siempre válida (pasa por `reparar`).
 * ctx = { evo, poseidas }.  → { build, plantilla, notas[] }
 */
export function sugerir(plantilla, semilla = 1, ctx = {}) {
  const T = typeof plantilla === 'string' && Object.hasOwn(PLANTILLAS, plantilla) ? PLANTILLAS[plantilla] : PLANTILLAS.brutal, r = prng(`${T.id}|${typeof semilla === 'number' || typeof semilla === 'string' ? semilla : 0}`);
  const c = ctx && typeof ctx === 'object' ? ctx : {}, poseidas = c.poseidas instanceof Set ? c.poseidas : Array.isArray(c.poseidas) ? new Set(c.poseidas) : null;
  const tiene = (p) => !poseidas || poseidas.has(p);
  const b = defecto();
  b.id = 'lab-' + hashTexto(`${T.id}|${semilla}`).slice(0, 10); b.nombre = elige(r, T.nombres);
  b.base = { preset: elige(r, ['jugador1', 'jugador2', 'jugador3', 'jugador4']), piel: elige(r, ['#8a5a3c', '#c58c6a', '#5a3a28', '#e0b090', '#3a2a22']) };
  for (const k of Object.keys(PROP_RANGOS)) { const [lo, hi] = PROP_RANGOS[k]; b.prop[k] = clamp(Math.round((T.prop[k] + (r() - 0.5) * 0.06) * 200) / 200, lo, hi); }
  const notas = [];
  const pal = sugerirPaleta(`${T.id}|${semilla}|pal`); b.pal = { primario: pal.primario, secundario: pal.secundario, emisivo: pal.emisivo, acabado: elige(r, ACABADOS) };
  for (const [p, a, o = {}] of T.partes) {
    if (!tiene(p)) { notas.push(`Sin «${PARTES[p].nombre}» (todavía no la tenés).`); continue; }
    const L = limitesDe(p, a), esc = clamp(Math.round(((o.esc || 1) + (r() - 0.5) * 0.2) * 100) / 100, ...L.esc);
    const pos = [0, 1, 2].map((i) => clamp(Math.round((r() - 0.5) * 0.02 * 500) / 500, ...L.pos[i])), rot = [0, 1, 2].map((i) => clamp(Math.round((r() - 0.5) * 6), ...L.rot[i]));
    b.partes.push(nuevaPieza(p, a, { ...o, esc, pos, rot, mat: elige(r, PARTES[p].variantesMat) }));
  }
  const max = derivarStats(b, c).cap.max; let usadas = 0;
  for (const [p, a, o = {}] of T.funcionales) {
    if (usadas >= max) break;
    if (!tiene(p)) { notas.push(`Sin «${PARTES[p].nombre}» (todavía no la tenés).`); continue; }
    b.partes.push(nuevaPieza(p, a, { ...o, mat: elige(r, PARTES[p].variantesMat), esc: Math.round((1 + (r() - 0.5) * 0.2) * 100) / 100 })); usadas++;
  }
  const fix = reparar(b, c);
  return { build: fix.build, plantilla: T.id, notas: [...notas, ...fix.cambios] };
}

/* ───────── otras acciones ───────── */
/** «Completar simetría»: toda pieza de tipo «par» pasa a espejo. */
export function completarSimetria(build, ctx = {}) {
  const b = normalizar(build); let n = 0;
  for (const e of b.partes) if (PARTES[e.p].lados === 'par' && e.sim !== 'espejo') { e.sim = 'espejo'; delete e.l; n++; }
  const r = reparar(b, ctx);
  return { build: r.build, cambios: n ? [`${n} pieza(s) ahora son simétricas.`, ...r.cambios] : r.cambios };
}
/** «Explicar»: qué hace cada pieza funcional y qué es solo estética (texto en español, desde la tabla de efectos). */
export function explicar(build, ctx = {}) {
  const b = normalizar(build), S = derivarStats(b, ctx), out = [];
  out.push(`Ranuras de órgano: ${S.cap.usado} de ${S.cap.max}.`);
  for (const e of S.efectos) out.push(`${e.nombre}: ${e.desc}`);
  const cosm = instancias(b).filter((x) => x.cat === 'cosmetica').length;
  out.push(cosm ? `Tenés ${cosm} pieza(s) estéticas dibujadas: no cambian ninguna estadística.` : 'Todavía no hay piezas estéticas.');
  out.push('El tamaño, la altura y la posición de las piezas son solo estética: no cambian tus estadísticas.');
  return out;
}
export { MENSAJES, ANCLAS };
