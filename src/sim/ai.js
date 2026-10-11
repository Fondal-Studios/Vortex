import { v3, add, sub, mul, madd, dot, cross, len, dist, norm, project, rotAround, clone } from './math.js';
import { MONSTERS, G } from './data.js';
import { collide } from './physics.js';

/* ───── utilidades de movimiento compartidas ───── */
const nearest = (targets, pos) => {
  let best = targets[0], bd = Infinity;
  for (const p of targets) { const d = dist(p.pos, pos); if (d < bd) { bd = d; best = p; } }
  return best;
};
const dmgMul = (g) => 1 + 0.04 * (g.wave - 1);

function groundMove(game, m, dt, wish, speed, accel = 10) {
  const g = game.map.gravityAt(m.pos, game.time);
  const zero = len(g) < 0.5;
  if (!zero) m.up = norm(mul(g, -1));
  const up = m.up;
  if (zero) { // flotando: nada hacia el objetivo en 3D, a media velocidad
    m.vel = madd(m.vel, sub(mul(norm(wish, v3()), speed * 0.6), m.vel), Math.min(1, 1.5 * dt));
  } else {
    let w = project(wish, up); const l = len(w); w = l > 1e-6 ? mul(w, 1 / l) : v3();
    const vu = dot(m.vel, up), vt = project(m.vel, up);
    const k = Math.min(1, (m.grounded ? accel : 2) * dt);
    m.vel = madd(madd(vt, sub(mul(w, speed), vt), k), up, vu);
    m.vel = madd(m.vel, g, dt);
    const sp = len(m.vel); if (sp > 60) m.vel = mul(m.vel, 60 / sp);
  }
  m.grounded = false;
  for (let s = 0; s < 2; s++) {
    m.pos = madd(m.pos, m.vel, dt / 2);
    const c = collide(game.map, m.pos, m.vel, m.r * 0.9, up);
    if (c && c.d > 0.55) m.grounded = true;
  }
}

function flyMove(game, m, dt, desired, accel = 3) {
  m.vel = madd(m.vel, sub(desired, m.vel), Math.min(1, accel * dt));
  m.pos = madd(m.pos, m.vel, dt);
  collide(game.map, m.pos, m.vel, m.r * 0.8, null);
  const g = game.map.gravityAt(m.pos, game.time);
  if (len(g) > 0.5) m.up = norm(mul(g, -1));
}

const face = (m, dir) => { if (len(dir) > 1e-6) m.fwd = norm(dir); };
const sp = (m) => m.def.speed * m.speedMul;

function shoot(game, m, from, dir, speed, dmg, kind = 'shard', r = 0.7, life = 7) {
  game.addProjectile({ owner: 'm', kind, pos: clone(from), vel: mul(norm(dir), speed), dmg, r, life });
}

function summon(game, m, kind, n, spread = 4) {
  for (let i = 0; i < n; i++) {
    const t = norm(cross(m.up, game.rng.unit()), v3(1, 0, 0));
    const pos = madd(m.pos, t, game.rng.range(2, spread));
    const k = game.spawnMonster(kind, pos, { parent: m.id });
    if (k) m.kids++;
  }
  game.emit({ t: 'summon', id: m.id, p: [m.pos.x, m.pos.y, m.pos.z] });
}

function pulseGravity(game, m, range, secs) {
  for (const p of game.alivePlayers()) if (dist(p.pos, m.pos) < range) p.flipUntil = game.time + secs;
  game.emit({ t: 'gravity', id: m.id, p: [m.pos.x, m.pos.y, m.pos.z] });
}

function bite(game, m, p, dmg, rate) {
  if (m.cd <= 0 && dist(p.pos, m.pos) < m.r + 0.9 + 0.6) {
    game.hurtPlayer(p, dmg * dmgMul(game)); m.cd = rate;
    game.emit({ t: 'bite', id: m.id });
  }
}

/* ───── comportamientos ───── */
export const AI = {
  // 1) Corredor: persigue en zigzag y salta para cerrar distancia
  runner(game, m, dt, targets) {
    const p = nearest(targets, m.pos), to = sub(p.pos, m.pos), d = len(to), dir = norm(to);
    const side = mul(cross(m.up, dir), Math.sin(m.t * 3 + m.id) * 0.45);
    groundMove(game, m, dt, add(dir, side), sp(m), 12);
    face(m, project(dir, m.up));
    m.cd -= dt; m.cd2 -= dt;
    if (m.cd2 <= 0 && m.grounded && d > 7 && d < 18) { m.vel = madd(madd(m.vel, dir, 9), m.up, 9); m.cd2 = 3.5; m.state = 'leap'; }
    else if (m.grounded && m.cd2 < 2.8) m.state = 'run';
    bite(game, m, p, 8, 1.0);
  },

  // 2) Tanque: rueda cerrado (casi inmune) y se abre ~2s: ese es el momento de pegarle
  tank(game, m, dt, targets) {
    const p = nearest(targets, m.pos), dir = norm(sub(p.pos, m.pos));
    const cyc = m.t % 4.8;
    m.open = cyc > 2.8;
    m.state = m.open ? 'open' : 'roll';
    groundMove(game, m, dt, dir, sp(m) * (m.open ? 0.15 : 1.5), 6);
    face(m, project(dir, m.up));
    m.cd -= dt;
    bite(game, m, p, 22, 1.5);
  },

  // 3) Volador: orbita alto, avisa 0.7s y se lanza en picada
  diver(game, m, dt, targets) {
    const p = nearest(targets, m.pos);
    m.cd -= dt;
    if (m.state === 'wind') {
      m.vel = mul(m.vel, 1 - Math.min(1, 6 * dt));
      m.pos = madd(m.pos, m.vel, dt);
      face(m, sub(p.pos, m.pos));
      if ((m.stateT -= dt) <= 0) { m.state = 'dive'; m.stateT = 1.3; m.dive = norm(sub(p.pos, m.pos)); }
    } else if (m.state === 'dive') {
      flyMove(game, m, dt, mul(m.dive, 30 * m.speedMul), 10);
      face(m, m.dive);
      m.stateT -= dt;
      if (dist(p.pos, m.pos) < m.r + 1.5) { game.hurtPlayer(p, 11 * dmgMul(game)); game.emit({ t: 'bite', id: m.id }); m.state = 'orbit'; m.cd = 3 + game.rng.next() * 2; }
      else if (m.stateT <= 0) { m.state = 'orbit'; m.cd = 2.5 + game.rng.next() * 2; }
    } else {
      m.state = 'orbit';
      const ang = m.t * 0.9 + m.id;
      const side = norm(cross(p.up, v3(Math.cos(ang), 0.3, Math.sin(ang))), v3(1, 0, 0));
      const tgt = madd(madd(p.pos, p.up, 9), side, 12);
      flyMove(game, m, dt, mul(sub(tgt, m.pos), 1.2), 2.5);
      face(m, sub(p.pos, m.pos));
      if (m.cd <= 0 && dist(p.pos, m.pos) < 40) { m.state = 'wind'; m.stateT = 0.7; }
    }
  },

  // 4) A distancia: mantiene 22–32 u, apunta con aviso y dispara (ráfaga de 3 con poca vida)
  ranged(game, m, dt, targets) {
    const p = nearest(targets, m.pos), to = sub(p.pos, m.pos), d = len(to), dir = norm(to);
    let wish = v3();
    if (m.state !== 'aim') wish = d > 32 ? dir : d < 20 ? mul(dir, -1) : mul(cross(m.up, dir), Math.sin(m.t * 0.8 + m.id));
    groundMove(game, m, dt, wish, sp(m), 8);
    face(m, project(dir, m.up));
    m.cd -= dt;
    if (m.state === 'aim') {
      if ((m.stateT -= dt) <= 0) {
        const lead = madd(p.pos, p.vel, 0.4);
        shoot(game, m, madd(m.pos, m.up, 0.5), sub(lead, m.pos), 26, 12 * dmgMul(game), 'shard');
        if (m.burst > 0) { m.burst--; m.stateT = 0.2; } else { m.state = 'idle'; m.cd = 2.2; }
      }
    } else if (m.cd <= 0 && d < 55) {
      m.state = 'aim'; m.stateT = 0.6; m.burst = m.hp < m.maxhp * 0.5 ? 2 : 0;
    }
  },

  // 5) Invocador: huye, canaliza 1s (aviso) y suelta 2 Astillas (máx. 4 vivas)
  summoner(game, m, dt, targets) {
    const p = nearest(targets, m.pos), to = sub(p.pos, m.pos), d = len(to), dir = norm(to);
    const wish = m.state === 'cast' ? v3() : d < 24 ? mul(dir, -1) : d > 36 ? dir : mul(cross(m.up, dir), 0.6);
    groundMove(game, m, dt, wish, sp(m), 8);
    face(m, project(dir, m.up));
    m.cd -= dt;
    if (m.state === 'cast') {
      if ((m.stateT -= dt) <= 0) { summon(game, m, 'astilla', 2); m.state = 'idle'; m.cd = 7; }
    } else if (m.cd <= 0 && m.kids < 4) { m.state = 'cast'; m.stateT = 1.0; }
  },

  // 6) Emboscador: invisible a distancia; parpadea detrás del jugador; revelado al recibir daño
  ambusher(game, m, dt, targets) {
    const p = nearest(targets, m.pos), to = sub(p.pos, m.pos), d = len(to), dir = norm(to);
    m.reveal = Math.max(0, (m.reveal || 0) - dt);
    m.cloak = m.reveal <= 0 && d > 5;
    m.cd -= dt;
    if (m.state === 'blink') {
      if ((m.stateT -= dt) <= 0) {
        m.pos = madd(madd(p.pos, p.heading, -3.4), p.up, 0.1);
        m.vel = v3(); m.state = 'strike'; m.cd = 0.4; m.cd2 = 5.5;
        game.emit({ t: 'blink', id: m.id, p: [m.pos.x, m.pos.y, m.pos.z] });
      }
      return;
    }
    groundMove(game, m, dt, dir, d > 14 ? sp(m) * 0.75 : sp(m), 10);
    face(m, project(dir, m.up));
    m.cd2 -= dt;
    if (m.state !== 'strike' && m.cd2 <= 0 && d > 9 && d < 70) { m.state = 'blink'; m.stateT = 0.6; return; }
    bite(game, m, p, 20, 1.1);
  },

  // 7) Explosivo: corre y detona; al morir explota y daña también a sus vecinos
  exploder(game, m, dt, targets) {
    const p = nearest(targets, m.pos), to = sub(p.pos, m.pos), d = len(to), dir = norm(to);
    groundMove(game, m, dt, dir, sp(m), 14);
    face(m, project(dir, m.up));
    if (d < m.r + 2.6) { m.dead = true; game.explode(m.pos, 6, 36 * dmgMul(game), 40, null); game.emit({ t: 'kill', id: m.id, k: 'racimo', p: [m.pos.x, m.pos.y, m.pos.z] }); }
  },

  // 8) Gravitón: flota a distancia y, tras cargar 1.3s, invierte la gravedad de los jugadores 3.5s
  gravitron(game, m, dt, targets) {
    const p = nearest(targets, m.pos), to = sub(p.pos, m.pos), d = len(to), dir = norm(to);
    m.cd -= dt;
    if (m.state === 'charge') {
      m.vel = mul(m.vel, 1 - Math.min(1, 4 * dt)); m.pos = madd(m.pos, m.vel, dt);
      if ((m.stateT -= dt) <= 0) { pulseGravity(game, m, 60, 3.5); m.state = 'idle'; m.cd = 9; }
      return;
    }
    const ang = m.t * 0.4 + m.id;
    const side = norm(cross(p.up, v3(Math.cos(ang), 0.2, Math.sin(ang))), v3(1, 0, 0));
    const want = madd(madd(p.pos, p.up, 14), side, 26);
    flyMove(game, m, dt, mul(sub(want, m.pos), 0.8), 2);
    face(m, dir);
    if (m.cd <= 0 && d < 80) { m.state = 'charge'; m.stateT = 1.3; }
  },

  // ───── jefes ─────
  coloso(game, m, dt, targets) {
    const a = game.map.bossAnchor, p = nearest(targets, m.pos);
    const ph = m.hp > m.maxhp * 0.66 ? 1 : m.hp > m.maxhp * 0.33 ? 2 : 3;
    if (ph !== m.phase) { m.phase = ph; game.emit({ t: 'phase', n: ph, id: m.id }); }
    const want = v3(a.x + Math.cos(m.t * 0.25) * 12, a.y + Math.sin(m.t * 0.6) * 2, a.z + Math.sin(m.t * 0.25) * 12);
    flyMove(game, m, dt, mul(sub(want, m.pos), 1.5), 3);
    face(m, sub(p.pos, m.pos));
    m.cd -= dt; m.cd2 -= dt; m.sum = (m.sum ?? 6) - dt; m.flipT = (m.flipT ?? 10) - dt;
    if (m.state === 'wind') {
      if ((m.stateT -= dt) <= 0) {
        m.state = 'idle'; m.cd = [0, 3.4, 2.7, 2.1][ph];
        const n = [0, 14, 18, 22][ph], off = m.t * 0.7;
        const els = [-1.25, -0.95, -0.7];
        const el = els[m.ring = ((m.ring || 0) + 1) % 3];
        for (let i = 0; i < n; i++) {
          if (i % 6 === 3) continue; // huecos para esquivar
          const ang = off + (i * Math.PI * 2) / n;
          shoot(game, m, m.pos, v3(Math.cos(ang) * Math.cos(el), Math.sin(el), Math.sin(ang) * Math.cos(el)), 17, 11 * dmgMul(game), 'orb', 0.9, 9);
        }
      }
    } else if (m.cd <= 0) { m.state = 'wind'; m.stateT = 0.8; }
    if (ph >= 2 && m.cd2 <= 0) {
      m.cd2 = 2.2;
      for (let i = -1; i <= 1; i++) {
        const d0 = norm(sub(madd(p.pos, p.vel, 0.5), m.pos));
        shoot(game, m, m.pos, rotAround(d0, p.up, i * 0.12), 32, 14, 'beam', 0.7, 6);
      }
    }
    if (ph >= 2 && m.sum <= 0 && m.kids < 6) { m.sum = 15; const ref = p; for (let i = 0; i < 4; i++) game.spawnMonster('astilla', game.map.spawnGround(game.rng, ref.pos), { parent: m.id }) && m.kids++; game.spawnMonster('prisma', game.map.spawnAir(game.rng, ref.pos, ref.up), { parent: m.id }) && m.kids++; }
    if (ph === 3 && m.flipT <= 0) { m.flipT = 12; pulseGravity(game, m, 200, 3); }
  },

  madre(game, m, dt, targets) {
    const p = nearest(targets, m.pos);
    const ph = m.hp > m.maxhp * 0.66 ? 1 : m.hp > m.maxhp * 0.33 ? 2 : 3;
    if (ph !== m.phase) { m.phase = ph; game.emit({ t: 'phase', n: ph, id: m.id }); }
    m.vel = v3(); m.pos = clone(game.map.bossAnchor);
    face(m, sub(p.pos, m.pos));
    const cycle = [0, 7, 6, 5][ph], closed = cycle * 0.55;
    const c = m.t % cycle, wasOpen = m.open;
    m.open = c >= closed;
    m.state = m.open ? 'open' : 'fire';
    if (m.open && !wasOpen && m.kids < 6) { summon(game, m, 'racimo', ph === 1 ? 3 : 5, 6); }
    if (!m.open) { // espirales: brazos que rotan y barren la esfera
      m.cd -= dt;
      if (m.cd <= 0) {
        m.cd = [0, 0.22, 0.17, 0.13][ph];
        const arms = ph + 3;
        for (let i = 0; i < arms; i++) {
          const ang = m.t * 1.6 + (i * Math.PI * 2) / arms, el = Math.sin(m.t * 0.9 + i) * 0.9;
          shoot(game, m, m.pos, v3(Math.cos(ang) * Math.cos(el), Math.sin(el), Math.sin(ang) * Math.cos(el)), 15, 9 * dmgMul(game), 'orb', 0.8, 9);
        }
      }
    }
    if (ph >= 3) { m.flipT = (m.flipT ?? 12) - dt; if (m.flipT <= 0) { m.flipT = 14; pulseGravity(game, m, 200, 2.5); } }
  },
};
export { MONSTERS, G };
