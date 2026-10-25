// Roles de cooperativo y sus habilidades (tecla E). Cada rol aporta algo distinto: ver docs/DISENO_DIRECTOR.md
import { dist, add, madd, v3, clone } from './math.js';
import { ROLES, ROLE_IDS, PLAYER } from './data.js';

export const roleFor = (index) => ROLE_IDS[index % ROLE_IDS.length];

/** Usa la habilidad del jugador si no está en recarga. Devuelve true si se activó. */
export function useAbility(g, p) {
  if (p.dead || p.abilityCd > 0) return false;
  const R = ROLES[p.role];
  switch (p.role) {
    case 'vanguardia':
      g.addObject('dome', clone(p.pos), { owner: p.id, life: 6, r: 6.5 });
      break;
    case 'soporte':
      for (const q of g.players) {
        const d = dist(q.pos, p.pos);
        if (!q.dead && d < 12) { q.hp = Math.min(PLAYER.hp, q.hp + 40); q.shield = PLAYER.shield; if (q !== p && p.st) p.st.sup++; }
        else if (q.dead && !q.lost && d < 4) g.reviveInPlace(q, p);
      }
      g.emit({ t: 'pulse', pid: p.id, p: [p.pos.x, p.pos.y, p.pos.z] });
      break;
    case 'ingeniero': {
      const mine = g.objects.filter((o) => o.type === 'turret' && o.owner === p.id);
      if (mine.length >= 2) g.removeObject(mine[0]);
      g.addObject('turret', madd(p.pos, p.up, 0.4), { owner: p.id, life: 22, cd: 0.5, up: clone(p.up) });
      break;
    }
    case 'explorador':
      for (const m of g.monsters) if (!m.dead && dist(m.pos, p.pos) < 32) { m.markUntil = g.time + 9; if (m.kind === 'espejo') { m.cloak = false; m.reveal = 9; } }
      g.emit({ t: 'mark', pid: p.id, p: [p.pos.x, p.pos.y, p.pos.z] });
      break;
    default: return false;
  }
  p.abilityCd = R.cd; g.emit({ t: 'ability', pid: p.id, role: p.role });
  return true;
}

/** Pasivos de rol */
export const reviveRate = (helper) => (helper.role === 'soporte' ? 2 : 1);
export const speedMul = (p) => (p.role === 'explorador' ? 1.08 : 1) * (p.carry ? 0.75 : 1) * (p.spdMul || 1);
