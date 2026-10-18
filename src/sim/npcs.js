// NPCs del limbo: almas que ya no atacan. Aparecen en el respiro entre oleadas cerca del jugador; se les habla con input `npc: {offer: 0|1}` (el cliente
// muestra las ofertas: NPC_INFO). Contrato: docs/MUNDO_VIVO.md. Todo determinista y validado por la simulación.
import { madd, dist, norm, cross } from './math.js';
import { ESS_KEYS } from './organos.js';
import { makeCards } from './loadout.js';
import { WEAPON_ORGANS, CHAMP_ORGANS } from './data.js';
import { organError } from './organos.js';
import { forjar } from './drops.js';

export const NPC_KINDS = ['cambista', 'sanadora', 'herrero'];
export const NPC_INFO = {
  cambista: { name: 'El Cambista de Almas', says: 'Todo se cambia. Hasta lo que ya no tenés.', offers: [
    { text: 'Pagás 30 núcleos → 4 esencias de la que menos tenés', cost: '30 núcleos' }, { text: 'Pagás 6 de tu esencia más abundante → 25 núcleos', cost: '6 esencias' }] },
  sanadora: { name: 'La Sanadora', says: 'Descansá, vivo. A los muertos nos gusta ver latir algo.', offers: [
    { text: 'Curación total de vida y escudo', cost: '3 carne' }, { text: 'Bendición: +10 % de daño durante la próxima oleada', cost: '5 cristal' }] },
  herrero: { name: 'El Herrero de Huesos', says: 'Lo que no sirve se funde y se vuelve a forjar.', offers: [
    { text: 'Volver a sortear tus tarjetas (1 vez por respiro)', cost: '10 núcleos' }, { text: 'Forjar tarjetas de órgano con tus esencias', cost: '20 núcleos' }],
    /* oferta extra (docs/INVENTARIO.md): 2 = objeto vivo al azar (la construcción dirigida está en la Forja del menú) */
    forja: [{ text: 'Forjar un objeto vivo al azar (arma, armadura o reliquia)', cost: '45 núcleos + 4 esencias' }] },
};
const maxKey = (p, f) => ESS_KEYS.reduce((a, k) => (f(p.ess[k], p.ess[a]) ? k : a), ESS_KEYS[0]);

/** Respiro: aparece un NPC cerca del primer jugador vivo (rota según la oleada). */
export function spawnNpc(g) {
  g.objects = g.objects.filter((o) => o.type !== 'npc');
  const ref = g.alivePlayers()[0]; if (!ref) return;
  const kind = NPC_KINDS[(g.wave | 0) % NPC_KINDS.length];
  const side = cross(ref.heading, ref.up);
  const o = g.addObject('npc', madd(madd(ref.pos, ref.heading, 4.5), side, 2), { kind, r: 1.2, life: g.phaseT + 2, rerolled: false });
  g.emit({ t: 'npc', kind, p: [o.pos.x, o.pos.y, o.pos.z] });
}
export function clearNpc(g) { g.objects = g.objects.filter((o) => o.type !== 'npc'); }

/** Cada tick, por jugador: atiende el pedido `npc` si está a ≤ 6 u de un NPC. */
export function npcStep(g, p) {
  const rq = p.input && p.input.npc; if (!rq || rq === p.npcDone) { if (!rq) p.npcDone = null; return; }
  p.npcDone = rq;
  const n = g.objects.find((o) => o.type === 'npc' && dist(o.pos, p.pos) < 7); if (!n || p.dead) return;
  const ok = act(g, p, n, rq.offer === 1 ? 1 : rq.offer === 2 ? 2 : rq.offer === 3 ? 3 : 0); g.emit({ t: 'npcdeal', pid: p.id, kind: n.kind, offer: rq.offer, ok });
}
function act(g, p, n, i) {
  if (i >= 2 && n.kind !== 'herrero') return false;
  switch (n.kind) {
    case 'cambista':
      if (i === 0) { if (p.cores < 30) return false; p.cores -= 30; p.ess[maxKey(p, (a, b) => a < b)] += 4; return true; }
      { const k = maxKey(p, (a, b) => a > b); if (p.ess[k] < 6) return false; p.ess[k] -= 6; p.cores += 25; return true; }
    case 'sanadora':
      if (i === 0) { if (p.ess.carne < 3) return false; p.ess.carne -= 3; p.hp = 100; p.shield = 100; return true; }
      if (p.ess.cristal < 5) return false; p.ess.cristal -= 5; p.blessWave = g.wave + 1; return true;
    case 'herrero':
      if (g.phase !== 'intermission') return false;
      if (i === 2) return forjar(g, p);
      if (i === 0) { if (p.cores < 10 || n.rerolled) return false; p.cores -= 10; n.rerolled = true; p.cards = makeCards(g, p); return true; }
      { if (p.cores < 20) return false; const pool = [];
        for (const w of p.slots) for (const id of Object.keys(WEAPON_ORGANS)) if (!organError(p, 'w', w, id)) pool.push({ w, k: 'organ', t: 'w', id });
        for (const id of Object.keys(CHAMP_ORGANS)) if (!organError(p, 'c', 0, id)) pool.push({ w: p.slots[0], k: 'organ', t: 'c', id });
        if (!pool.length) return false; p.cores -= 20; const cs = []; for (let k = 0; k < 3 && pool.length; k++) cs.push(pool.splice(Math.floor(g.rng.next() * pool.length), 1)[0]); p.cards = cs; return true; }
    default: return false;
  }
}
void norm;
