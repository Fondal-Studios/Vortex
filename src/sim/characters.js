// Habilidades de los personajes: 1) desplazamiento (tecla F) y 2) disparo especial (clic derecho). Cada personaje tiene las suyas.
import { dist, add, sub, mul, madd, norm, dot, cross, v3, clone, len } from './math.js';
import { CHARACTERS, PLAYER } from './data.js';
import { blocked } from './physics.js';
import { hostMove, hostSpecial, cdMul, evoP, evoSkillFx } from './huespedes.js';

const a3 = (v) => [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100, Math.round(v.z * 100) / 100];
const flatDir = (p) => norm(sub(p.heading, mul(p.up, dot(p.heading, p.up))), p.heading);

/** Desplazamiento: devuelve true si se usó. */
function useMove0(g, p) {
  const C = CHARACTERS[p.char]; if (!C || p.dead || p.movCd > 0 || p.carry) return false;
  const h = flatDir(p), id = C.mov.id;
  switch (id) {
    case 'embestida': {
      p.ext = madd(p.ext, h, 42);
      for (const m of g.monsters) { if (m.dead) continue; const d = sub(m.pos, p.pos), t = dot(d, h); if (t < -1 || t > 13 * evoP(p, 'area')) continue; const side = len(sub(d, mul(h, t))); if (side < m.r + 2.2 * evoP(p, 'area')) { g.damageMonster(m, 75, p, m.pos); m.vel = madd(m.vel, h, 14); } }
      break;
    }
    case 'paso': {
      let t = 0; for (; t < 14; t += 1) if (blocked(g.map, madd(madd(p.pos, p.up, 0.4), h, t + 1.4))) break;
      p.pos = madd(p.pos, h, Math.max(0, t - 0.2)); p.vel = mul(p.vel, 0.3); g.emit({ t: 'blink', p: a3(p.pos) });
      break;
    }
    case 'propulsor': p.vel = madd(madd(p.vel, p.up, 15), h, 12); p.grounded = false; break;
    case 'deslizamiento': { const w = norm(add(mul(h, p.input.mz || 1), mul(cross(h, p.up), p.input.mx || 0)), h); p.ext = madd(p.ext, w, 38); break; }
    case 'salto': p.vel = madd(madd(p.vel, p.up, 27), h, 5); p.grounded = false; break;
    case 'fase': p.ext = madd(p.ext, h, -32); p.invulUntil = g.time + 1.0; p.desfaseUntil = g.time + 2; p.vel = madd(p.vel, p.up, 4); break;
    default: if (!hostMove(g, p, id)) return false;
  }
  p.movCd = C.mov.cd * cdMul(p); g.emit({ t: 'skill', pid: p.id, k: 'mov', id, p: a3(p.pos) });
  evoSkillFx(g, p, 'mov');
  return true;
}

/** Disparo especial. */
function useSpecial0(g, p) {
  const C = CHARACTERS[p.char]; if (!C || p.dead || p.espCd > 0 || p.carry) return false;
  const id = C.esp.id, o = g.eyePos(p), d = g.aimDir(p);
  switch (id) {
    case 'onda': {
      for (const m of g.monsters) { if (m.dead) continue; const to = sub(m.pos, p.pos), l = len(to); if (l > 20 * evoP(p, 'area') + m.r) continue; if (dot(norm(to), d) < 0.5 - 0.06 * (p.evo | 0)) continue; g.damageMonster(m, 120, p, m.pos); m.vel = madd(m.vel, norm(to), 22); }
      g.emit({ t: 'boom', p: a3(madd(o, d, 5)), r: 8 });
      break;
    }
    case 'rayo': {
      const w = { dmg: 95, range: 90, pierce: true };
      const end = g.hitscan(p, o, d, w);
      for (const q of g.players) { if (q.dead || q === p) continue; const oc = sub(q.pos, o), t = dot(oc, d); if (t < 0 || t > 90) continue; if (len(sub(oc, mul(d, t))) < 2.4) { q.hp = Math.min(PLAYER.hp, q.hp + 50); q.shield = PLAYER.shield; } }
      g.emit({ t: 'beam', pid: p.id, o: a3(o), to: a3(end), c: 'heal' });
      break;
    }
    case 'cohete': g.addProjectile({ owner: 'p', pid: p.id, kind: 'nova', pos: madd(o, d, 1.5), vel: mul(d, 60), dmg: 240, splash: 9 * evoP(p, 'area'), r: 0.7, life: 4, cluster: 6 + 2 * (p.evo | 0) }); break;
    case 'riel': {
      const w = { dmg: 210, range: 420, pierce: true };
      const hitIds = g.monsters.filter((m) => !m.dead && len(sub(m.pos, o)) < 420 && len(sub(sub(m.pos, o), mul(d, dot(sub(m.pos, o), d)))) < m.r * 1.1 && dot(sub(m.pos, o), d) > 0).map((m) => m);
      const end = g.hitscan(p, o, d, w);
      for (const m of hitIds) m.markUntil = g.time + 9;
      g.emit({ t: 'beam', pid: p.id, o: a3(o), to: a3(end), c: 'rail' });
      break;
    }
    case 'rafaga': {
      const right = cross(p.heading, p.up), w = { dmg: 22, range: 95 }, tips = [];
      for (let i = 0, N = 14 + 3 * (p.evo | 0); i < N; i++) { const dd = norm(add(add(d, mul(right, g.rng.gauss() * 0.07)), mul(cross(d, right), g.rng.gauss() * 0.05))); tips.push(g.hitscan(p, o, dd, w)); }
      g.emit({ t: 'shot', pid: p.id, w: 1, o: a3(o), to: tips.slice(0, 3).map(a3) });
      break;
    }
    case 'singularidad': g.addProjectile({ owner: 'p', pid: p.id, kind: 'nova', pos: madd(o, d, 1.5), vel: mul(d, 30), dmg: 110, splash: 10 * evoP(p, 'area'), r: 0.7, life: 3, well: 4 + 0.5 * (p.evo | 0) }); break;
    default: if (!hostSpecial(g, p, id)) return false;
  }
  p.espCd = C.esp.cd * cdMul(p); g.emit({ t: 'skill', pid: p.id, k: 'esp', id, p: a3(p.pos) });
  evoSkillFx(g, p, 'esp');
  return true;
}
void clone; void v3;

/** Todo daño hecho desde una habilidad cuenta como «habilidad» (estilos de combate: data.js STYLES). */
const asSkill = (fn) => (g, p) => { const s = g.dmgSrc; g.dmgSrc = 'skill'; try { return fn(g, p); } finally { g.dmgSrc = s; } };
export const useMove = asSkill(useMove0);
export const useSpecial = asSkill(useSpecial0);
