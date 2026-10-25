// Comprobación mínima de V01/V03/V08 (docs/VORTEX_AUDIT.md) sobre perfil.js:cerrarPartida con localStorage simulado.
// Uso: node tools/audit/guardado-test.mjs   (no toca el juego ni ningún perfil real)
const mem = new Map(); let fallar = false;
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { if (fallar) { const e = new Error('cuota'); e.name = 'QuotaExceededError'; throw e; } mem.set(k, String(v)); }, removeItem: (k) => mem.delete(k) };
const P = await import('../../src/client/perfil.js');
const KEY = 'cristal.perfil.v1';
const jug = { kills: 40, co: 300, pk: [0, 0, 0, 0, 0, 0, 0, 0], bag: [] };
const out = {};
// V03 – idempotencia: la MISMA partida cerrada dos y tres veces
P.recargar(); P.cerrarPartida('axioma', jug, { wave: 3, won: true });
const una = { cores: P.perfil().cores, xp: P.perfil().mae.axioma.xp, partidas: P.perfil().mae.axioma.partidas, rot: P.perfil().tienda.rot };
P.cerrarPartida('axioma', jug, { wave: 3, won: true }); P.cerrarPartida('axioma', jug, { wave: 3, won: true });
const tres = { cores: P.perfil().cores, xp: P.perfil().mae.axioma.xp, partidas: P.perfil().mae.axioma.partidas, rot: P.perfil().tienda.rot };
out.V03_idempotente = JSON.stringify(una) === JSON.stringify(tres); out.V03_una_llamada = una; out.V03_tres_llamadas_misma_partida = tres;
out.V03_recarga_tras_cerrar = JSON.parse(mem.get(KEY)).cores;   // lo persistido ya incluye el triple
// V01 – almacenamiento que falla: ¿lanza?, ¿devuelve algo que avise?
mem.clear(); P.recargar(); fallar = true; let lanzo = false, ret;
try { ret = P.cerrarPartida('axioma', jug, { wave: 3, won: true }); } catch { lanzo = true; }
out.V01_lanza_excepcion = lanzo; out.V01_retorno_informa_fallo = !!(ret && (ret.error || ret.guardado === false || ret.persistido === false));
out.V01_en_memoria_cores = P.perfil().cores; fallar = false; out.V01_persistido_en_disco = mem.has(KEY) ? JSON.parse(mem.get(KEY)).cores : 'nada guardado';
out.V01_guardar_devuelve = P.guardar();   // undefined => no hay resultado explícito
// V08 – normalización de moneda cargada como texto
mem.clear(); mem.set(KEY, JSON.stringify({ cores: '100', terr: {} })); P.recargar(); P.cerrarPartida('axioma', { co: 5, kills: 0, pk: [0, 0, 0, 0, 0, 0, 0, 0] }, { wave: 1 });
out.V08_cores_100_mas_5 = P.perfil().cores;
console.log(JSON.stringify(out, null, 1));
