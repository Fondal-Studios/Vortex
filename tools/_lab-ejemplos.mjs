// Builds de ejemplo para pruebas y capturas del Laboratorio (mínima, media, peor caso permitido).
import { defecto, idNuevo, normalizar, validar, codificar, PARTES, ANCLAS } from '../src/shared/host-build.js';
const P = (p, a, o = {}) => ({ p, a, sim: o.sim || 'ninguna', ...(o.l ? { l: o.l } : {}), t: { pos: o.pos || [0, 0, 0], rot: o.rot || [0, 0, 0], esc: o.esc || 1 }, c: { mat: o.mat || PARTES[p].variantesMat[0], tinte: o.tinte || null } });
export const EJEMPLOS = {
  minima: normalizar({ ...defecto(), id: 'lab-minima01', nombre: 'Mínima' }),
  media: normalizar({ ...defecto(), id: 'lab-media001', nombre: 'Cazador de brasas', prop: { altura: 1.05, ancho: 0.95, piernas: 1.1, cabeza: 1.05, hombros: 1.04, brazos: 1.06 },
    partes: [P('cuerno_curvo', 'cabeza', { sim: 'espejo' }), P('hombrera_espinas', 'hombros', { sim: 'espejo' }), P('placa_pectoral', 'pecho'), P('espinas_dorsales', 'espalda'), P('adrenal', 'cintura'), P('ojo_extra', 'cabeza', { pos: [0, 0, 0] }), P('cuchilla_antebrazo', 'antebrazos', { sim: 'espejo' })] }),
  peor: normalizar({ ...defecto(), id: 'lab-peor0001', nombre: 'Peor caso', prop: { altura: 1.1, ancho: 1.1, piernas: 1.1, cabeza: 1.1, hombros: 1.1, brazos: 1.1, torso: 1.05, manos: 1.1, pies: 1.1 },
    partes: [P('cuerno_curvo', 'cabeza', { sim: 'espejo' }), P('cresta_osea', 'cabeza'), P('gorguera', 'cuello'), P('hombrera_espinas', 'hombros', { sim: 'espejo' }), P('placa_pectoral', 'pecho'), P('alas_membrana', 'espalda'), P('cola_larga', 'cola'),
      P('cuchilla_antebrazo', 'antebrazos', { sim: 'espejo' }), P('rodillera_placa', 'muslos', { sim: 'espejo' }), P('tentaculo', 'cintura', { l: 'der' }), P('ojo_extra', 'cabeza')] }),
};
if (process.argv[1].endsWith('_lab-ejemplos.mjs')) for (const [k, b] of Object.entries(EJEMPLOS)) { const v = validar(b, { evo: 4 }); console.log(k, v.ok, v.errores.map((e) => e.codigo + ' ' + e.msg), JSON.stringify({ tris: v.render.tris, llamadas: v.render.llamadas, inst: v.render.instancias }), codificar(b).length); }
