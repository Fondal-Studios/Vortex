import { v3, add, sub, mul, dot, cross, len, dist, norm, project, makeRng } from './math.js';
import { WEAPONS } from './data.js';

/**
 * Jugador automático para pruebas de partida completa. Tiene límites "humanos":
 * velocidad de giro acotada, puntería con error y sin ver a través de la geometría.
 */
export function makeBot(game, pid, { seed = 1, skill = 1 } = {}) {
  const rng = makeRng(seed * 7919);
  let strafe = 1, strafeT = 0, jumpT = 0;
  return function think(dt) {
    const p = game.players.find((q) => q.id === pid);
    const inp = { mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1 };
    if (!p || p.dead) return inp;
    const mons = game.monsters.filter((m) => !m.dead);
    const right = cross(p.heading, p.up);
    const eye = game.eyePos(p);

    // objetivo: prioridad por amenaza y cercanía
    let tgt = null, best = Infinity, near = 0, nearest = Infinity;
    for (const m of mons) {
      const d = dist(m.pos, p.pos);
      if (d < 13) near++;
      const calm = (m.kind === 'geoda' && m.open && d > 7) || m.kind === 'madre';
      if (!calm && d < nearest && !m.def.fly) nearest = d;
      let sc = d;
      if (m.kind === 'racimo' && d < 25) sc -= 22;
      if (m.kind === 'graviton' || m.kind === 'cuarzo') sc -= 14;
      if (m.kind === 'geoda') sc += m.open ? -12 : 30;
      if (m.kind === 'espejo' && m.cloak) sc += 40;
      if (m.def.boss && m.kind === 'madre' && !m.open) sc += 60;
      if (sc < best) { best = sc; tgt = m; }
    }

    // arma
    const d = tgt ? dist(tgt.pos, p.pos) : 0;
    let w = 0;
    if (tgt) {
      if (tgt.def.boss) w = p.ammo[4] >= 1 && tgt.open !== false ? 4 : p.ammo[2] > 0 ? 2 : p.ammo[3] > 0 ? 3 : 0;
      else if (near >= 3 && p.ammo[1] > 0 && d < 30) w = 1;
      else if (d > 60 && p.ammo[4] > 0) w = 4;
      else if (tgt.kind === 'geoda' && p.ammo[3] > 0 && d > 10) w = 3;
      else if (d < 45 && p.ammo[2] > 0) w = 2;
      else if (d < 25 && p.ammo[1] > 0) w = 1;
    }
    if (w !== p.weapon) inp.weapon = w;

    // puntería con giro limitado y error
    let wishMove = v3();
    if (tgt) {
      const lead = w === 3 ? tgt.pos : add(tgt.pos, mul(tgt.vel, 0.05));
      const noise = (1.2 - 0.6 * Math.min(1, skill)) * 0.35;
      const aimPt = add(lead, mul(norm(cross(p.up, sub(lead, eye))), rng.gauss() * noise * Math.max(2, d / 12)));
      const to = norm(sub(aimPt, eye));
      const tan = norm(project(to, p.up), p.heading);
      const sinA = dot(cross(p.heading, tan), p.up), cosA = dot(p.heading, tan);
      const yawErr = Math.atan2(sinA, cosA);
      const pitchErr = Math.asin(Math.max(-1, Math.min(1, dot(to, p.up)))) - p.pitch;
      const maxTurn = 7 * skill * dt;
      inp.dyaw = -Math.max(-maxTurn, Math.min(maxTurn, yawErr));
      inp.dpitch = Math.max(-maxTurn, Math.min(maxTurn, pitchErr));
      const armored = (tgt.kind === 'geoda' || tgt.kind === 'madre') && !tgt.open;
      inp.fire = !armored && Math.abs(yawErr) < 0.07 && Math.abs(pitchErr) < 0.07 && d < (WEAPONS[w].range || 140) * 0.8;
    }

    // movimiento: estrafear, retroceder ante cuerpo a cuerpo, buscar botiquines, no salirse de la isla
    strafeT -= dt; if (strafeT <= 0) { strafe = -strafe; strafeT = 0.8 + rng.next() * 1.4; }
    wishMove = add(wishMove, mul(right, strafe * 0.8));
    if (nearest < 10) wishMove = add(wishMove, mul(sub(p.pos, tgt && tgt.pos || p.pos), 0.25));
    if (mons.length && nearest > 28) wishMove = add(wishMove, mul(p.heading, 0.5));
    for (const q of game.projectiles) { // esquivar proyectiles enemigos que vienen hacia mí
      if (q.owner !== 'm') continue;
      const to = sub(p.pos, q.pos), dd = len(to);
      if (dd < 28 && dd > 1 && dot(norm(q.vel), mul(to, 1 / dd)) > 0.93) {
        const side = norm(cross(norm(q.vel), p.up));
        wishMove = add(wishMove, mul(side, dot(side, right) >= 0 ? 3 : -3));
      }
    }
    const needHp = p.hp < 65, needAmmo = p.ammo[2] < 30 && p.ammo[1] < 6;
    let pk = null, pd = 45;
    for (const k of game.pickups) { const dd = dist(k.pos, p.pos); if (dd < pd && ((k.type === 'hp' && needHp) || (k.type === 'ammo' && needAmmo))) { pd = dd; pk = k; } }
    if (pk) wishMove = add(mul(norm(project(sub(pk.pos, p.pos), p.up), p.heading), 2), mul(wishMove, 0.3));
    if (game.mapId === 'm1') {
      const c = v3(0, p.pos.y, 0), off = dist(p.pos, c);
      const inward = norm(sub(c, p.pos));
      if (off > 13) wishMove = add(wishMove, mul(inward, 3));
      if (off > 18) { const out = Math.max(0, dot(wishMove, mul(inward, -1))); wishMove = add(wishMove, mul(inward, out + 2)); }
      if (off > 18) inp.dash = false;
    }
    wishMove = project(wishMove, p.up);
    const l = len(wishMove);
    if (l > 0.05) { const n = mul(wishMove, 1 / Math.max(1, l)); inp.mz = dot(n, p.heading); inp.mx = dot(n, right); }
    jumpT -= dt;
    const edgy = game.mapId === 'm1' && dist(p.pos, v3(0, p.pos.y, 0)) > 11;
    if (near >= 2 && jumpT <= 0 && !edgy) { inp.jump = true; jumpT = 1.2 + rng.next(); }
    inp.dash = inp.dash || false;
    if (nearest < 14 && !(game.mapId === 'm1' && dist(p.pos, v3(0, p.pos.y, 0)) > 15)) inp.dash = true;
    return inp;
  };
}
