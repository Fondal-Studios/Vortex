// MODELO DE LA PANTALLA FINAL (GDD §4 «Resultados»): victoria/derrota, oleada X/Y, tiempo, objetivos, estadísticas, aporte de apoyo, XP, núcleos,
// botín, maestría y desbloqueos. Pura (sin DOM): src/client/resultados-ui.js la dibuja y tests/resultados.test.js la prueba. Misma pantalla en solo y coop.
import { SOLO_VICTORIA } from './recompensas.js';

const mmss = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/**
 * @param {object} d  { won, resumen (Game.resumen()), yo (id del jugador), recibo (perfil.ultimoRecibo()), mae, botin: [líneas], desbloqueos: [textos], coop: {base,bono,afk}|null, guardado: {ok,mensaje,pendientes} }
 */
export function modeloResultados(d) {
  const R = d.resumen || { etapas: 0, total: 0, tiempo: 0, hitos: {}, jugadores: [] }, rc = d.recibo || null, won = !!d.won, H = R.hitos || {};
  const etapa = R.operacion ? 'Etapa' : 'Oleada', yo = (R.jugadores || []).find((j) => j.id === d.yo) || (R.jugadores || [])[0] || null;
  const partes = [`${etapa} ${Math.max(0, R.oleada | 0)}/${R.total | 0}`, `Tiempo ${mmss(R.tiempo)}`];
  const objetivos = [{ txt: 'Objetivos obligatorios', val: `${H.obj | 0} cumplido(s)${H.objFalla ? ` · ${H.objFalla} fallido(s)` : ''}`, ok: !H.objFalla }, { txt: 'Objetivos secundarios', val: `${H.sec | 0} cumplido(s)`, ok: (H.sec | 0) > 0 }, { txt: 'Élites abatidas', val: String(H.elite | 0), ok: (H.elite | 0) > 0 }];
  const rec = [];
  if (rc && !rc.error) {
    rec.push({ txt: 'XP de maestría', val: `+${(rc.mae && rc.mae.ganada) || rc.xp || 0}`, parcial: !won });
    rec.push({ txt: 'Núcleos', val: `+${rc.cores | 0}`, parcial: !won, nota: !won && rc.coresBrutos > rc.cores ? `de ${rc.coresBrutos} ganados` : '' });
    if (d.coop && d.coop.bono > 0) rec.push({ txt: 'Bono por tu aporte al equipo', val: `+${Math.round(d.coop.bono * 100)} %`, parcial: false });
    if (d.coop && d.coop.afk) rec.push({ txt: 'Sin aporte mínimo: recompensa reducida y sin bono', val: '', parcial: true });
    if (rc.mae && rc.mae.arbol && (rc.mae.arbol.combo || rc.mae.arbol.disparo)) rec.push({ txt: 'Puntos de progresión', val: `+${rc.mae.arbol.combo + rc.mae.arbol.disparo}`, parcial: !won });
  }
  const aporte = yo ? [{ txt: 'Bajas', val: yo.bajas }, { txt: 'Daño', val: yo.st.dmg }, { txt: 'Objetivos', val: yo.st.obj }, { txt: 'Apoyo (curas y escudos)', val: yo.st.sup }, { txt: 'Reanimaciones', val: yo.st.rev }, { txt: 'Élites', val: yo.st.elite }] : [];
  const tabla = (R.jugadores || []).map((j) => ({ nombre: j.nombre, yo: yo && j.id === yo.id, bajas: j.bajas, puntos: j.puntos, dmg: j.st.dmg, apoyo: j.st.sup + j.st.rev, obj: j.st.obj }));
  const g = d.guardado || { ok: true }, aviso = g.ok === false ? { grave: true, txt: (g.mensaje || 'No se pudo guardar.') + (g.pendientes ? ' Tu recompensa quedó pendiente: se acredita sola cuando se pueda guardar.' : ''), acciones: ['reintentar', 'descargar', 'copiar'] } : (rc && rc.duplicado ? { grave: false, txt: 'Esta partida ya estaba cobrada: no se suma otra vez.', acciones: [] } : null);
  return {
    won, tono: won ? 'victoria' : 'derrota', titulo: won ? 'MISIÓN COMPLETADA' : 'MISIÓN FALLIDA', subtitulo: R.operacion || '', motivo: !won ? (R.fallo || '') : '',
    resumen: partes, objetivos, recompensas: rec, botin: Array.isArray(d.botin) ? d.botin : [], desbloqueos: Array.isArray(d.desbloqueos) ? d.desbloqueos : [],
    perdido: !won ? SOLO_VICTORIA.map((x) => x.texto) : [], aporte, tabla, aviso, parcial: !won,
    nota: !won ? 'Al perder se conserva una parte: recursos y XP según lo que avanzaste. La recompensa principal y los desbloqueos requieren completar la misión.' : '',
  };
}
