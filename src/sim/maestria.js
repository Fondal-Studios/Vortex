// MAESTRÍA de cada Huésped (docs/HUESPEDES.md, «Maestría»): progreso PERSISTENTE por Huésped, rangos 1–10.
// Datos puros y deterministas (sin DOM, sin azar, sin perfil): el perfil (src/client/perfil.js) guarda la XP; la simulación sólo recibe el RANGO
// (opts.maestria de addPlayer) y lo convierte en multiplicadores PEQUEÑOS que se suman a los de las bendiciones (p.bn). Con rango 1 no cambia nada.
import { bendMods, BN_NEUTRO } from './bendiciones.js';

export const RANGO_MAX = 10;
/** XP acumulada necesaria para llegar a cada rango (índice = rango; el 1 se tiene de entrada). */
export const XP_RANGO = [0, 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];
export const TITULOS = ['', 'Huésped', 'Aprendiz', 'Iniciado', 'Adepto', 'Vinculado', 'Veterano', 'Maestro', 'Gran Maestro', 'Ascendido', 'Arcano'];
/** Color de la marca de maestría según el rango (bronce, plata, oro, prisma). */
export const TIER_MARCA = (r) => (r >= 10 ? 'prisma' : r >= 7 ? 'oro' : r >= 4 ? 'plata' : r >= 2 ? 'bronce' : '');
export const MARCA_COLOR = { bronce: 0xd08a4a, plata: 0xdfe6f5, oro: 0xffd24a, prisma: 0xffffff };

/** Cosméticos que se desbloquean por rango (los lee el cuerpo 3D: huesped-maestria.js). */
export const COSMETICOS = [
  { rango: 2, id: 'marca', nombre: 'Marca de bronce', texto: 'Un rombo de luz flota sobre tu cabeza: crece uno por rango.' },
  { rango: 3, id: 'estela', nombre: 'Estela', texto: 'Al correr dejás una estela de luz del color de tu Huésped.' },
  { rango: 5, id: 'aura', nombre: 'Aura de maestría', texto: 'Chispas de tu color suben alrededor del cuerpo.' },
  { rango: 7, id: 'sello', nombre: 'Sello de oro', texto: 'Un sello con muescas gira bajo tus pies y la marca pasa a oro.' },
  { rango: 9, id: 'pilar', nombre: 'Pilar de leyenda', texto: 'Una columna de luz sube detrás de vos: se ve de lejos.' },
  { rango: 10, id: 'prisma', nombre: 'Marca prisma', texto: 'La marca cambia de color sin parar. Título: Arcano.' },
];
/** Bonos numéricos (acumulativos) en los rangos 2, 4, 6, 8 y 10. Chicos a propósito: la maestría adorna, no rompe el balance. Mismas claves que BN_NEUTRO. */
export const BONOS = {
  axioma:  [[2, { melee: 1.03 }, '+3 % daño cuerpo a cuerpo'], [4, { dmgIn: 0.98 }, '−2 % daño recibido'], [6, { shield: 1.08 }, 'el escudo recarga un 8 % más rápido'], [8, { spd: 1.02 }, '+2 % velocidad'], [10, { skill: 1.04, melee: 1.02 }, '+4 % daño de habilidades y +2 % cuerpo a cuerpo']],
  vesper:  [[2, { gun: 1.03 }, '+3 % daño con armas de disparo'], [4, { spd: 1.02 }, '+2 % velocidad'], [6, { cd: 0.97 }, 'las habilidades recargan un 3 % más rápido'], [8, { gun: 1.03 }, '+3 % daño con armas de disparo'], [10, { cd: 0.97, ult: 1.05 }, '−3 % recarga y la definitiva se recupera un 5 % más rápido']],
  micelio: [[2, { dmgIn: 0.98 }, '−2 % daño recibido'], [4, { ess: 1.08 }, '+8 % de esencias al matar'], [6, { shield: 1.08 }, 'el escudo recarga un 8 % más rápido'], [8, { dmgIn: 0.98 }, '−2 % daño recibido'], [10, { heal: 5, kheal: 0.5 }, '+5 de vida entre oleadas y +0,5 por baja']],
  umbra:   [[2, { skill: 1.03 }, '+3 % daño de habilidades'], [4, { cd: 0.97 }, '−3 % recarga de habilidades'], [6, { spd: 1.02 }, '+2 % velocidad'], [8, { skill: 1.03 }, '+3 % daño de habilidades'], [10, { ult: 1.06, cd: 0.97 }, 'la definitiva se recupera un 6 % más rápido y −3 % recarga']],
  seraf:   [[2, { ult: 1.04 }, 'la definitiva se recupera un 4 % más rápido'], [4, { shield: 1.08 }, 'el escudo recarga un 8 % más rápido'], [6, { cores: 1.04 }, '+4 % de núcleos ganados'], [8, { skill: 1.03 }, '+3 % daño de habilidades'], [10, { ult: 1.05, cores: 1.04 }, 'la definitiva se recupera un 5 % más rápido y +4 % de núcleos']],
  danzante: [[2, { melee: 1.03 }, '+3 % daño cuerpo a cuerpo'], [4, { spd: 1.02 }, '+2 % velocidad'], [6, { cd: 0.97 }, 'las habilidades recargan un 3 % más rápido'], [8, { melee: 1.03 }, '+3 % daño cuerpo a cuerpo'], [10, { cd: 0.97, ult: 1.05 }, '−3 % recarga y la definitiva se recupera un 5 % más rápido']],
  singular: [[2, { skill: 1.03 }, '+3 % daño de habilidades (pozos y satélites incluidos)'], [4, { cd: 0.97 }, '−3 % recarga de habilidades'], [6, { dmgIn: 0.98 }, '−2 % daño recibido'], [8, { skill: 1.03 }, '+3 % daño de habilidades'], [10, { ult: 1.05, cd: 0.97 }, 'la definitiva se recupera un 5 % más rápido y −3 % recarga']],
};

BONOS.laboratorio = BONOS.axioma;   // Híbrido Genómico: los mismos bonos genéricos de Axioma (nada propio que balancear)
BONOS.colmena = [[2, { skill: 1.03 }, '+3 % daño de habilidades (también el de tus zánganos)'], [4, { cd: 0.97 }, '−3 % recarga de habilidades'], [6, { cores: 1.04 }, '+4 % de núcleos ganados'], [8, { skill: 1.03 }, '+3 % daño de habilidades'], [10, { ult: 1.05, skill: 1.02 }, 'la definitiva se recupera un 5 % más rápido y +2 % daño de habilidades']];
export const clampRango = (r) => Math.max(1, Math.min(RANGO_MAX, Number.isFinite(r) ? Math.floor(r) : 1));
export const rangoDeXp = (xp) => { let r = 1; for (let i = 2; i <= RANGO_MAX; i++) if ((xp || 0) >= XP_RANGO[i]) r = i; return r; };
/** Progreso hacia el siguiente rango: { rango, xp, desde, hasta (null en el máximo), frac 0..1, falta, max }. */
export function progreso(xp) {
  xp = Math.max(0, Math.floor(xp || 0)); const rango = rangoDeXp(xp), max = rango >= RANGO_MAX, desde = XP_RANGO[rango], hasta = max ? null : XP_RANGO[rango + 1];
  return { rango, xp, desde, hasta, frac: max ? 1 : (xp - desde) / (hasta - desde), falta: max ? 0 : hasta - xp, max };
}
/** XP de una partida con este Huésped: por jugarla, por cada baja, por cada oleada superada y por ganar. */
export function xpPartida({ kills = 0, wave = 0, won = false } = {}) {
  return Math.max(0, Math.floor(15 + Math.min(300, kills) * 1.5 + Math.min(40, Math.max(0, wave)) * 8 + (won ? 60 : 0)));
}
/** Recompensas de un Huésped por rango (2..10): [{ rango, titulo, bono: texto|null, cosmetico: {nombre,texto}|null }]. */
export function recompensas(char) {
  const out = [];
  for (let r = 2; r <= RANGO_MAX; r++) {
    const b = (BONOS[char] || []).find((x) => x[0] === r), c = COSMETICOS.find((x) => x.rango === r);
    out.push({ rango: r, titulo: TITULOS[r], bono: b ? b[2] : null, cosmetico: c ? { nombre: c.nombre, texto: c.texto } : null });
  }
  return out;
}
/** La próxima recompensa con algo para estrenar (bono o cosmético) por encima de `rango`, o null en el máximo. */
export const proximaRecompensa = (char, rango) => recompensas(char).find((x) => x.rango > rango && (x.bono || x.cosmetico)) || null;
/** Cosméticos activos con ese rango (ids). */
export const cosmeticosActivos = (rango) => COSMETICOS.filter((c) => rango >= c.rango).map((c) => c.id);
/** Multiplicadores de la maestría (parciales: sólo lo que cambia). `heal`/`kheal` suman, el resto multiplica. */
export function maestriaMods(char, rango) {
  const m = {}; rango = clampRango(rango);
  for (const [r, fx] of BONOS[char] || []) if (rango >= r) for (const [k, v] of Object.entries(fx)) m[k] = k === 'heal' || k === 'kheal' ? (m[k] || 0) + v : (m[k] || 1) * v;
  return m;
}
/** Aplica la maestría al jugador (p.mastery y p.bn). Idempotente: siempre parte de las bendiciones (p.bend). */
export function applyMaestria(p, rango) {
  p.mastery = clampRango(rango); p.bn = bendMods(p.bend || []);
  for (const [k, v] of Object.entries(maestriaMods(p.char, p.mastery))) p.bn[k] = k === 'heal' || k === 'kheal' ? (p.bn[k] || 0) + v : (p.bn[k] ?? BN_NEUTRO[k] ?? 1) * v;
  return p.bn;
}
