import { BOSS_NAMES } from './campaign-names.js';
// Territorios del limbo y sus BENDICIONES (docs/MUNDO_VIVO.md). Datos puros y deterministas: sin azar, sin DOM, sin perfil.
// Cada territorio (mapa) tiene 2 bendiciones EXCLUYENTES: al liberarlo se elige una y la otra queda cerrada para siempre en ese territorio.
// La simulación sólo recibe la lista de ids (opts.bend de addPlayer) y la convierte en multiplicadores pequeños (p.bn).

/** Efectos posibles (todos multiplicadores 1 = sin efecto, salvo `heal` y `kheal` que suman vida). */
export const BN_NEUTRO = Object.freeze({ attackSpeed: 1, spd: 1, gun: 1, melee: 1, skill: 1, dmgIn: 1, ult: 1, shield: 1, ess: 1, cores: 1, cd: 1, heal: 0, kheal: 0 });

export const TERRITORIOS = {
  m1: { id: 'm1', nombre: 'Vacío de Islas', folclore: 'Ánimas y luces malas: las almas que se perdieron entre islas buscan un suelo que no las suelte.', jefe: BOSS_NAMES.m1, requiere: [], color: '#7fd0ff' },
  m2: { id: 'm2', nombre: 'Cámara Fractal', folclore: 'Espejos y ecos: lo que dijiste vuelve distinto, y lo que fuiste te mira desde el cascarón.', jefe: BOSS_NAMES.m2, requiere: ['m1'], color: '#c58bff' },
  m3: { id: 'm3', nombre: 'Laberinto Celestial', folclore: 'Cantos y silbidos: el Silbón enseña a los muros a llamar a quien se anima a escuchar.', jefe: BOSS_NAMES.m3, requiere: ['m2'], color: '#ffe27a' },
  m4: { id: 'm4', nombre: 'Jardín de Carne', folclore: 'Raíces y carne: lo que se enterró sin nombre brota acá, hambriento y paciente.', jefe: BOSS_NAMES.m4, requiere: ['m3'], color: '#ff6f8e' },
  m5: { id: 'm5', nombre: 'Plaza de los Ecos', folclore: 'Una ciudad muerta de noche con las luces prendidas; el relojero firmó un pacto para que el reloj no parara.', jefe: BOSS_NAMES.m5, requiere: ['m1'], color: '#ffb36b' },
  m6: { id: 'm6', nombre: 'Osario sin Techo', folclore: 'Huesos que no descansan: la bóveda cayó hacia arriba y el camposanto sigue contando a sus muertos.', jefe: BOSS_NAMES.m6, requiere: ['m5'], color: '#d8d8c8' },
};
export const TERRITORIO_IDS = Object.keys(TERRITORIOS);

/** 12 bendiciones, 2 por territorio. `fx` = efecto numérico pequeño. Orden: [a, b] por territorio. */
export const BENDICIONES = {
  pie_ligero:    { id: 'pie_ligero',    terr: 'm1', nombre: 'Pie de Isla',       desc: 'Caminás un 4 % más rápido: la gravedad ya no te retiene.', fx: { spd: 1.04 } },
  luz_mala:      { id: 'luz_mala',      terr: 'm1', nombre: 'Luz Mala',          desc: '+5 % de daño con armas de disparo.', fx: { gun: 1.05 } },
  eco:           { id: 'eco',           terr: 'm2', nombre: 'Eco',               desc: '+10 % de daño de habilidades.', fx: { skill: 1.10 } },
  espejo:        { id: 'espejo',        terr: 'm2', nombre: 'Espejo',            desc: 'Recibís un 5 % menos de daño: el golpe vuelve a quien lo dio.', fx: { dmgIn: 0.95 } },
  silbido:       { id: 'silbido',       terr: 'm3', nombre: 'Silbido',           desc: 'La definitiva se carga un 10 % más rápido.', fx: { ult: 1.10 } },
  canto:         { id: 'canto',         terr: 'm3', nombre: 'Canto',             desc: 'El escudo se recarga un 20 % más rápido.', fx: { shield: 1.20 } },
  hambre:        { id: 'hambre',        terr: 'm4', nombre: 'Hambre',            desc: '+25 % de esencias al matar.', fx: { ess: 1.25 } },
  raiz:          { id: 'raiz',          terr: 'm4', nombre: 'Raíz',              desc: 'El respiro entre oleadas te cura 10 de vida extra.', fx: { heal: 10 } },
  hora_detenida: { id: 'hora_detenida', terr: 'm5', nombre: 'Hora Detenida',     desc: 'Las habilidades se recargan un 6 % más rápido.', fx: { cd: 0.94 } },
  farol:         { id: 'farol',         terr: 'm5', nombre: 'Farol',             desc: '+10 % de núcleos ganados.', fx: { cores: 1.10 } },
  hueso_firme:   { id: 'hueso_firme',   terr: 'm6', nombre: 'Hueso Firme',       desc: '+8 % de daño cuerpo a cuerpo.', fx: { melee: 1.08 } },
  descanso_ajeno:{ id: 'descanso_ajeno',terr: 'm6', nombre: 'Descanso Ajeno',    desc: 'Cada baja te cura 1 de vida.', fx: { kheal: 1 } },
};
export const BENDICION_IDS = Object.keys(BENDICIONES);
/** Las dos bendiciones (excluyentes) de un territorio. */
export const bendicionesDe = (terr) => BENDICION_IDS.filter((id) => BENDICIONES[id].terr === terr);
/** La bendición hermana (la que queda cerrada al elegir `id`). */
export const hermana = (id) => { const b = BENDICIONES[id]; return b ? bendicionesDe(b.terr).find((x) => x !== id) || null : null; };

/** Limpia una lista de ids: sólo conocidas, sin repetir y como mucho UNA por territorio (la primera que aparece). Orden estable por territorio. */
export function cleanBend(ids) {
  if (!Array.isArray(ids)) return [];
  const porTerr = {};
  for (const id of ids) { const b = BENDICIONES[id]; if (b && !porTerr[b.terr]) porTerr[b.terr] = id; }
  return TERRITORIO_IDS.filter((t) => porTerr[t]).map((t) => porTerr[t]);
}
/** Combina los efectos de las bendiciones en un objeto de multiplicadores (multiplica los factores, suma las curas). Determinista. */
export function bendMods(ids) {
  const bn = { ...BN_NEUTRO };
  for (const id of cleanBend(ids)) for (const [k, v] of Object.entries(BENDICIONES[id].fx)) { if (k === 'heal' || k === 'kheal') bn[k] += v; else bn[k] *= v; }
  return bn;
}
/** Aplica las bendiciones a un jugador de la simulación (addPlayer / setLoadout). */
export function applyBend(p, ids) { p.bend = cleanBend(ids); p.bn = bendMods(p.bend); }
