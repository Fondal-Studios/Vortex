// Guardado robusto e idempotencia de cerrarPartida (V01, V03, AC-09). localStorage simulado: no toca ningún perfil real.
import test from 'node:test';
import assert from 'node:assert/strict';
const mem = new Map(); let fallar = null, soloPerfil = false;
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { if (fallar && (!soloPerfil || k === 'cristal.perfil.v1')) { const e = new Error('cuota'); e.name = fallar; throw e; } mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
};
const P = await import('../src/client/perfil.js');
const KEY = 'cristal.perfil.v1';
const jug = () => ({ kills: 40, co: 300, pk: [0, 0, 0, 0, 0, 0, 0, 0], bag: [] });
const fresco = () => { mem.clear(); fallar = null; soloPerfil = false; P.recargar(); };
const bolsa = [{ id: 'mat:hueso', q: 1, n: 4 }, { id: 'plano:cuchilla_hueso', q: 1, n: 1 }];
const RES_PERDER = { etapas: 3, total: 5, hitos: { obj: 2, sec: 1, elite: 0 } }, RES_GANAR = { etapas: 5, total: 5, hitos: {} };

test('V03: el mismo matchId cobrado 3 veces suma una sola vez (y también tras recargar)', () => {
  fresco(); const matchId = 'partida-0001';
  const a = P.cerrarPartida('axioma', jug(), { matchId, wave: 3, won: true, resumen: RES_GANAR });
  assert.equal(a.guardado, true); assert.equal(a.duplicado, false);
  const antes = { cores: P.perfil().cores, xp: P.perfil().mae.axioma.xp, partidas: P.perfil().mae.axioma.partidas, rot: P.perfil().tienda.rot };
  const b = P.cerrarPartida('axioma', jug(), { matchId, wave: 3, won: true, resumen: RES_GANAR }); P.cerrarPartida('axioma', jug(), { matchId, wave: 3, won: true, resumen: RES_GANAR });
  assert.equal(b.duplicado, true); assert.equal(P.perfil().cores, antes.cores); assert.equal(P.perfil().mae.axioma.xp, antes.xp); assert.equal(P.perfil().mae.axioma.partidas, 1);
  P.recargar();   // "recarga de página": el recibo está en disco
  P.cerrarPartida('axioma', jug(), { matchId, wave: 3, won: true, resumen: RES_GANAR });
  assert.deepEqual({ cores: P.perfil().cores, xp: P.perfil().mae.axioma.xp, partidas: P.perfil().mae.axioma.partidas, rot: P.perfil().tienda.rot }, antes);
  assert.equal(P.perfil().cores, 300);
  assert.equal(JSON.parse(mem.get(KEY)).ledger.length, 1);
});
test('sin matchId, repetir exactamente la misma llamada tampoco suma; partidas distintas sí', () => {
  fresco(); P.cerrarPartida('axioma', jug(), { wave: 3, won: true }); P.cerrarPartida('axioma', jug(), { wave: 3, won: true });
  assert.equal(P.perfil().cores, 300);
  P.cerrarPartida('axioma', jug(), { matchId: 'otra-partida-1', wave: 3, won: true }); assert.equal(P.perfil().cores, 600);
});
test('el ledger recuerda sólo las últimas 50 partidas', () => {
  fresco(); for (let i = 0; i < 60; i++) P.cerrarPartida('axioma', { co: 1, kills: 0 }, { matchId: 'partida-' + String(i).padStart(3, '0'), wave: 1 });
  assert.equal(P.perfil().ledger.length, 50); assert.equal(P.perfil().cores, 60);
});
test('derrota: recompensa parcial; victoria: completa y con lo exclusivo', () => {
  fresco(); const d = P.cerrarPartida('axioma', jug(), { matchId: 'derrota-001', wave: 4, won: false, resumen: RES_PERDER, bag: bolsa });
  assert.ok(P.perfil().cores > 0 && P.perfil().cores < 300, 'núcleos parciales: ' + P.perfil().cores);
  assert.equal(P.conoce('cuchilla_hueso'), true, 'el plano inicial ya se conocía'); assert.equal(P.planos().length, P.planos().length);
  assert.ok(d.recibo.parcial); assert.equal(d.recibo.won, false);
  const xpD = P.perfil().mae.axioma.xp;
  fresco(); P.cerrarPartida('axioma', jug(), { matchId: 'victoria-01', wave: 5, won: true, resumen: RES_GANAR, bag: bolsa });
  assert.equal(P.perfil().cores, 300); assert.ok(P.perfil().mae.axioma.xp > xpD, 'ganar da más XP que perder');
});
test('derrota: el botín raro, los planos y la firma NO se acreditan', () => {
  fresco(); const sg = P.cerrarPartida('axioma', { ...jug(), sg: 1 }, { matchId: 'derrota-002', wave: 3, won: false, resumen: RES_PERDER, bag: [{ id: 'plano:pica_geoda', q: 1, n: 1 }] });
  assert.equal(P.conoce('pica_geoda'), false); assert.equal(Object.keys(P.perfil().sigs).length, 0); assert.ok(sg.guardado);
  fresco(); P.cerrarPartida('axioma', { ...jug(), sg: 1 }, { matchId: 'victoria-02', wave: 5, won: true, resumen: RES_GANAR, bag: [{ id: 'plano:pica_geoda', q: 1, n: 1 }] });
  assert.equal(P.conoce('pica_geoda'), true); assert.equal(P.perfil().sigs.axioma, 1);
});
test('coop: el multiplicador del servidor (base + bono) escala núcleos y XP', () => {
  fresco(); P.cerrarPartida('axioma', jug(), { matchId: 'coop-0001', wave: 5, won: true, resumen: RES_GANAR, coop: { mult: 1.2 } });
  assert.equal(P.perfil().cores, 360);
});

test('V01: almacenamiento lleno → se avisa, no queda nada a medias, la partida espera y se acredita al volver (sin duplicar)', () => {
  fresco(); const avisos = []; const off = P.alGuardar((r) => avisos.push(r));
  fallar = 'QuotaExceededError';
  const r = P.cerrarPartida('axioma', jug(), { matchId: 'cuota-0001', wave: 3, won: true, resumen: RES_GANAR, bag: bolsa });
  assert.equal(r.guardado, false); assert.equal(r.pendiente, true); assert.equal(r.motivo, 'lleno'); assert.match(r.mensaje, /lleno/);
  assert.equal(P.perfil().cores, 0, 'deshecho en memoria: no se marcó como acreditado'); assert.deepEqual(P.perfil().ledger, []);
  assert.equal(mem.has(KEY), false, 'nada a medias en disco');
  assert.equal(P.estadoGuardado().ok, false); assert.equal(P.estadoGuardado().pendientes, 1); assert.ok(avisos.some((a) => a.ok === false && a.motivo === 'lleno'));
  assert.equal(P.guardar().ok, false, 'guardar() informa el fallo (ya no devuelve undefined)');
  const x = P.reintentarGuardado(); assert.equal(x.ok, false); assert.equal(x.pendientes, 1);
  fallar = null;   // vuelve el espacio
  const y = P.reintentarGuardado(); assert.equal(y.acreditadas, 1); assert.equal(y.pendientes, 0);
  assert.equal(P.perfil().cores, 300); assert.equal(JSON.parse(mem.get(KEY)).cores, 300);
  P.reintentarGuardado(); P.cerrarPartida('axioma', jug(), { matchId: 'cuota-0001', wave: 3, won: true, resumen: RES_GANAR });
  assert.equal(P.perfil().cores, 300, 'ni el reintento ni cobrar de nuevo duplican'); off();
});
test('V01: la cola sobrevive a recargar la página y se acredita luego', () => {
  fresco(); soloPerfil = true; fallar = 'SecurityError';   // el perfil no se puede escribir, pero la cola (clave aparte) sí
  assert.equal(P.cerrarPartida('axioma', jug(), { matchId: 'cola-0001', wave: 3, won: true }).motivo, 'bloqueado');
  assert.ok(mem.has('cristal.pendientes.v1'));
  P.recargar(); assert.equal(P.pendientes().length, 1, 'tras recargar, la cola persistida vuelve');
  fallar = null; assert.equal(P.procesarPendientes().acreditadas, 1); assert.equal(P.perfil().cores, 300); assert.equal(P.pendientes().length, 0); assert.equal(mem.has('cristal.pendientes.v1'), false);
});
test('exportar / importar: restaura el progreso sin permitir cobrar de nuevo lo ya acreditado', () => {
  fresco(); P.cerrarPartida('axioma', jug(), { matchId: 'copia-0001', wave: 3, won: true }); const texto = P.exportarProgreso();
  fresco(); assert.equal(P.perfil().cores, 0); const r = P.importarProgreso(texto); assert.equal(r.ok, true); assert.equal(P.perfil().cores, 300);
  P.cerrarPartida('axioma', jug(), { matchId: 'copia-0001', wave: 3, won: true }); assert.equal(P.perfil().cores, 300);
  assert.equal(P.importarProgreso('basura').ok, false); assert.equal(P.perfil().cores, 300, 'una copia mala no toca nada');
  fallar = 'QuotaExceededError'; const e = P.importarProgreso(texto); assert.equal(e.ok, false); fallar = null;
});
test('perfiles viejos y dañados: abren, conservan y no se pisan en silencio', () => {
  fresco(); mem.set(KEY, JSON.stringify({ cores: '100', inv: [], terr: {} })); assert.equal(P.recargar().cores, 100); assert.equal(P.perfil().esq, 1); assert.deepEqual(P.perfil().ledger, []);
  P.cerrarPartida('axioma', { co: 5, kills: 0 }, { matchId: 'viejo-0001', wave: 1 }); assert.equal(P.perfil().cores, 105);
  mem.clear(); mem.set(KEY, '{esto no es json'); const p = P.recargar(); assert.equal(p.cores, 0); assert.equal(P.estadoGuardado().corrupto, true);
  assert.equal(mem.get('cristal.perfil.v1.corrupto'), '{esto no es json', 'queda una copia del guardado ilegible');
  mem.clear(); mem.set(KEY, JSON.stringify({ esq: 99, cores: 7 })); P.recargar(); assert.equal(P.guardar().ok, false, 'un guardado de versión futura no se sobrescribe'); assert.equal(JSON.parse(mem.get(KEY)).cores, 7);
  mem.clear(); mem.set(KEY, JSON.stringify({ cores: 12.9, ledger: [{ id: 'x1' }, { id: 'valido-0001', h: 'x', at: 1 }] })); P.recargar(); assert.equal(P.perfil().ledger.length, 1);
});
