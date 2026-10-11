import { v3, add, sub, mul, madd, dot, cross, len, dist, norm, clamp, project, rotAround, makeRng, clone, finite } from './math.js';
import { G, LIMITS, WEAPONS, MONSTERS, WAVE_PLANS, BOSS_OF, PLAYER, BOSS_MECH } from './data.js';
import { MAPS } from './maps.js';
import { collide, blocked } from './physics.js';
import { AI } from './ai.js';
import { useAbility, roleFor, reviveRate, speedMul } from './roles.js';
import { makeObjective, updateObjective } from './objectives.js';
import { initColoso, initMadre, bossDeath } from './bossmech.js';
import { Director } from './director.js';
import { ROLES, ROLE_IDS } from './data.js';

const r2 = (n) => Math.round(n * 100) / 100;
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];

/**
 * Simulación autoritativa y determinista (sin DOM, sin three). La corre el navegador
 * en solitario o el servidor en cooperativo. Entrada: setInput(); salida: snapshot().
 */
export class Game {
  constructor({ mapId = 'm1', seed = 1, difficulty = 1, calm = 4 } = {}) {
    this.map = MAPS[mapId];
    if (!this.map) throw new Error('mapa desconocido: ' + mapId);
    this.mapId = mapId;
    this.rng = makeRng(seed);
    this.difficulty = difficulty * (mapId === 'm2' ? 1.35 : 1); // la Cámara Fractal es más exigente (el bot ganaba 8/8)
    this.tick = 0; this.time = 0; this.dt = 1 / 60;
    this.players = []; this.monsters = []; this.projectiles = []; this.pickups = [];
    this.events = [];
    this.nextId = 1;
    this.state = 'playing'; // playing | won | lost
    this.wave = 0; this.waveTotal = WAVE_PLANS[mapId].length + 1;
    this.phase = 'intermission'; this.phaseT = calm; // calma inicial (la historia usa más)
    this.queue = []; this.spawnT = 0; this.spawnGap = 1.5;
    this.boss = null;
    this.objects = []; this.pings = []; this.objective = null; this.fragments = 0; this.teamBuffUntil = 0; this.director = new Director(); this.curTypes = [];
    this.stats = { kills: 0, spawned: 0, maxAlive: 0 };
  }

  /* ─────────── jugadores ─────────── */
  addPlayer(name = 'Pasajero', role = null) {
    if (this.players.length >= 4) return null;
    const idx = this.players.length;
    if (!ROLE_IDS.includes(role)) role = roleFor(idx);
    const pos = clone(this.map.playerSpawn(idx));
    const g = this.map.gravityAt(pos, this.time);
    const up = len(g) > 1e-6 ? norm(mul(g, -1)) : v3(0, 1, 0);
    const p = {
      id: this.nextId++, name, role, abilityCd: 0, carry: 0, bleed: 0, lost: false, abilityPrev: false, interactPrev: false, interactEdge: false, pingPrev: false, pos, vel: v3(), up, heading: norm(project(v3(0, 0, -1), up), v3(1, 0, 0)), pitch: 0,
      hp: PLAYER.hp, shield: PLAYER.shield, dead: false, weapon: 0, ammo: WEAPONS.map((w) => w.start),
      cd: 0, ext: v3(), reviveT: 0, lastHurt: -99, flipUntil: 0, portalCd: 0, grounded: false, kills: 0, score: 0, respawnAt: 0,
      input: { mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, ability: false, interact: false, ping: false },
    };
    this.players.push(p);
    return p;
  }
  removePlayer(id) { this.players = this.players.filter((p) => p.id !== id); }
  setInput(id, inp) {
    const p = this.players.find((q) => q.id === id);
    if (!p) return;
    const i = p.input;
    i.mx = clamp(+inp.mx || 0, -1, 1); i.mz = clamp(+inp.mz || 0, -1, 1);
    i.dyaw = clamp(i.dyaw + (+inp.dyaw || 0), -3, 3); i.dpitch = clamp(i.dpitch + (+inp.dpitch || 0), -3, 3); // acumulativo hasta el próximo step; acotado contra entradas hostiles
    i.jump = !!inp.jump; i.fire = !!inp.fire; i.dash = !!inp.dash; i.ability = !!inp.ability; i.interact = !!inp.interact; i.ping = !!inp.ping;
    if (Number.isInteger(inp.weapon) && inp.weapon >= 0 && inp.weapon < WEAPONS.length) i.weapon = inp.weapon;
  }
  setRole(id, role) { const p = this.players.find((q) => q.id === id); if (p && ROLE_IDS.includes(role)) p.role = role; }
  alivePlayers() { return this.players.filter((p) => !p.dead); }
  eyePos(p) { return madd(p.pos, p.up, PLAYER.eye); }
  aimDir(p) { return add(mul(p.heading, Math.cos(p.pitch)), mul(p.up, Math.sin(p.pitch))); }
  emit(e) { if (this.events.length < LIMITS.events) this.events.push(e); }

  /* ─────────── paso principal ─────────── */
  step(dt) {
    this.tick++; this.time += dt; this.dt = dt;
    if (this.state !== 'playing') return;
    this.director.update(this, dt);
    this.updateWaves(dt);
    for (const p of this.players) this.updatePlayer(p, dt);
    updateObjective(this, dt); this.updateObjects(dt);
    if (this.pings.length) this.pings = this.pings.filter((q) => q.until > this.time);
    for (const m of this.monsters) this.updateMonster(m, dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.separate();
    if (this.monsters.some((m) => m.dead)) this.monsters = this.monsters.filter((m) => !m.dead);
    this.stats.maxAlive = Math.max(this.stats.maxAlive, this.monsters.length);
    if (this.players.length && this.players.every((p) => p.dead)) { this.state = 'lost'; this.emit({ t: 'lost' }); }
  }

  /* ─────────── oleadas ─────────── */
  updateWaves(dt) {
    const plan = WAVE_PLANS[this.mapId];
    if (this.phase === 'intermission') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.startWave(this.wave + 1, plan);
      return;
    }
    // fase 'wave': spawnear en goteo
    this.spawnT -= dt;
    const cap = Math.min(LIMITS.monsters - 12, 44 + 10 * (this.players.length - 1));
    if (this.queue.length && this.spawnT <= 0 && this.monsters.length < cap) {
      this.spawnFromQueue();
      this.spawnT = this.spawnGap * this.director.gapScale();
    }
    if (this.director.wantsRelief()) { const a = this.alivePlayers(); if (a.length) this.dropPickup('hp', madd(a[0].pos, a[0].up, 2)); }
    if (this.queue.length > 3 && this.director.wantsSurge()) { const sp = this.curTypes.filter((t) => ['obelisco', 'aurora', 'espiral', 'graviton', 'cuarzo'].includes(t)); if (sp.length) { this.queue.splice(1, 0, this.rng.pick(sp), this.rng.pick(sp)); this.emit({ t: 'surge' }); } }
    // rezagados: si quedan 1-2 criaturas lejos durante 40 s, el Vórtice las "empuja" hacia los jugadores (evita oleadas eternas)
    const left = this.monsters.filter((m) => !m.dead && !m.def.boss);
    if (!this.queue.length && left.length && left.length <= 2 && left.length === this.monsters.filter((m) => !m.dead).length) {
      this.straggleT = (this.straggleT || 0) + dt;
      if (this.straggleT > 40) {
        this.straggleT = 0; const ref = this.alivePlayers()[0];
        if (ref) for (const m of left) if (dist(m.pos, ref.pos) > 45) { m.pos = m.def.fly ? this.map.spawnAir(this.rng, ref.pos, ref.up) : this.map.spawnGround(this.rng, ref.pos); m.vel = v3(); this.emit({ t: 'blink', p: a3(m.pos) }); }
      }
    } else this.straggleT = 0;
    if (!this.queue.length && !this.monsters.some((m) => !m.dead) && !(this.objective && this.objective.state === 'active')) {
      if (this.wave >= this.waveTotal) { this.state = 'won'; this.emit({ t: 'won' }); return; }
      this.phase = 'intermission'; this.phaseT = 7; this.objective = null;
      this.emit({ t: 'clear', wave: this.wave });
      for (const p of this.alivePlayers()) {
        p.hp = Math.min(PLAYER.hp, p.hp + 40); // respiro entre oleadas
        this.dropPickup('hp', madd(p.pos, p.up, 2));
        for (const w of [2, 1, 3]) this.dropPickup('ammo', madd(madd(p.pos, p.up, 2), p.heading, 3 + w), w);
      }
    }
  }

  startWave(n, plan) {
    this.wave = n; this.phase = 'wave'; this.spawnT = 1;
    for (const p of this.players) { if (p.dead) this.revive(p); if (p.role === 'ingeniero' && !p.dead) { for (const w of [2, 1, 3]) this.dropPickup('ammo', madd(madd(p.pos, p.up, 1.5), p.heading, 2 + w), w); } }
    const n_pl = Math.max(1, this.players.length);
    this.queue = [];
    const isBoss = n === this.waveTotal;
    const types = plan[Math.min(n, plan.length) - 1]; this.curTypes = types;
    this.objective = isBoss ? null : makeObjective(this, n); this.objective0 = this.objective;
    let budget = (8 + 8 * n + 1.3 * n * n) * (1 + 0.6 * (n_pl - 1)) * this.difficulty;
    if (isBoss) { budget *= 0.45; this.queue.push(BOSS_OF[this.mapId]); }
    const cap = { geoda: 1 + Math.floor(n / 2), graviton: 1 + Math.floor(n / 3), cuarzo: 1 + Math.floor(n / 3), espejo: 2 + n, obelisco: 1 + Math.floor(n / 3), aurora: 1 + Math.floor(n / 3), espiral: 1 + Math.floor(n / 4), ariete: 1 + Math.floor(n / 2) };
    const counts = {};
    const weights = types.map((t) => 1 / MONSTERS[t].cost);
    const minCost = Math.min(...types.map((t) => MONSTERS[t].cost));
    let guard = 0;
    while (budget >= minCost && guard++ < 400) {
      let r = this.rng.next() * weights.reduce((a, b) => a + b, 0), i = 0;
      while (i < types.length - 1 && (r -= weights[i]) > 0) i++;
      const t = types[i];
      if (MONSTERS[t].cost > budget || (cap[t] !== undefined && (counts[t] || 0) >= cap[t])) continue;
      counts[t] = (counts[t] || 0) + 1; this.queue.push(t); budget -= MONSTERS[t].cost;
    }
    // el jefe va primero; el resto mezclado
    const boss = isBoss ? this.queue.shift() : null;
    for (let i = this.queue.length - 1; i > 0; i--) { const j = Math.floor(this.rng.next() * (i + 1)); [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]; }
    if (boss) this.queue.unshift(boss);
    this.spawnGap = Math.min(Math.max(0.45, 1.9 - 0.12 * n), Math.max(0.16, 42 / Math.max(1, this.queue.length))); // la oleada dura ~40 s sin importar el tamaño
    this.emit({ t: 'wave', n, boss: isBoss });
  }

  /** Oleada de castigo (objetivo fallido): suma criaturas extra a la cola. */
  surge(frac) {
    const types = this.curTypes.length ? this.curTypes : ['astilla']; let budget = (8 + 8 * this.wave + 1.3 * this.wave * this.wave) * frac * this.difficulty;
    let guard = 0; while (budget >= 1 && guard++ < 80) { const t = this.rng.pick(types); if (MONSTERS[t].cost <= budget && !MONSTERS[t].boss) { this.queue.push(t); budget -= MONSTERS[t].cost; } }
    this.spawnGap = Math.min(this.spawnGap, 0.6);
  }
  spawnFromQueue() {
    const kind = this.queue.shift();
    const def = MONSTERS[kind];
    const ref = this.refPlayer();
    let pos;
    if (def.boss) pos = clone(this.map.bossAnchor);
    else if (def.fly) pos = this.map.spawnAir(this.rng, ref.pos, ref.up);
    else pos = this.map.spawnGround(this.rng, ref.pos);
    this.spawnMonster(kind, pos);
  }
  refPlayer() {
    const a = this.alivePlayers();
    return a.length ? a[Math.floor(this.rng.next() * a.length)] : this.players[0];
  }

  spawnMonster(kind, pos, extra = {}) {
    if (this.monsters.length >= LIMITS.monsters) return null;
    const def = MONSTERS[kind];
    const w = Math.max(1, this.wave);
    const pm = def.boss ? 1 + 0.7 * (this.players.length - 1) : 1;
    const hp = def.hp * (def.boss ? 1 : 1 + 0.07 * (w - 1)) * pm;
    const m = {
      id: this.nextId++, kind, def, pos: clone(pos), vel: v3(), up: v3(0, 1, 0), fwd: v3(0, 0, 1),
      hp, maxhp: hp, r: def.r, speedMul: 1 + 0.018 * (w - 1), t: 0, cd: this.rng.range(0.5, 2), cd2: this.rng.range(1, 3),
      state: 'idle', stateT: 0, dead: false, hurt: 0, kids: 0, parent: 0, far: 0, ...extra,
    };
    this.monsters.push(m);
    if (def.boss) { this.boss = m; if (kind === 'coloso') initColoso(this, m); else initMadre(this, m); }
    this.stats.spawned++;
    return m;
  }

  /* ─────────── jugador ─────────── */
  revive(p) {
    p.dead = false; p.lost = false; p.bleed = 0; p.carry = 0; p.hp = 70; p.shield = 60; p.vel = v3();
    p.pos = clone(this.map.playerSpawn(this.players.indexOf(p)));
    const g = this.map.gravityAt(p.pos, this.time);
    p.up = len(g) > 1e-6 ? norm(mul(g, -1)) : v3(0, 1, 0);
    p.heading = norm(project(p.heading, p.up), v3(1, 0, 0));
  }

  reviveInPlace(p) {
    p.dead = false; p.lost = false; p.bleed = 0; p.hp = 50; p.shield = 0; p.reviveT = 0; p.lastHurt = this.time; p.vel = v3(); p.ext = v3();
    this.emit({ t: 'revive', pid: p.id, p: a3(p.pos) });
  }
  /** Un compañero vivo cerca (3,5 u) reanima al caído en el lugar: 3 s (el Soporte, 1,5 s). Si se agota la cuenta de desangrado, queda fuera hasta la próxima oleada. */
  updateRevive(p, dt) {
    if (p.lost) return;
    let rate = 0; for (const q of this.players) if (!q.dead && q !== p && dist(q.pos, p.pos) < 3.5) rate = Math.max(rate, reviveRate(q));
    p.reviveT = rate ? p.reviveT + dt * rate : Math.max(0, p.reviveT - dt * 0.5);
    p.bleed -= dt;
    if (p.reviveT >= 3) return this.reviveInPlace(p);
    if (p.bleed <= 0 && this.players.some((q) => !q.dead)) { p.lost = true; this.emit({ t: 'bleed', pid: p.id }); }
  }
  /** Empuje externo (embestidas, atracción): se suma a la velocidad y decae. */
  push(p, v) { p.ext = add(p.ext, v); }

  gravityFor(ent, flipUntil = 0) {
    const g = this.map.gravityAt(ent.pos, this.time);
    if (this.time < flipUntil) return len(g) > 0.1 ? mul(g, -1) : mul(ent.up, G);
    return g;
  }

  updatePlayer(p, dt) {
    const inp = p.input;
    if (p.dead) { inp.dyaw = inp.dpitch = 0; p.abilityCd = Math.max(0, p.abilityCd - dt); if (inp.ping && !p.pingPrev) this.doPing(p); p.pingPrev = inp.ping; this.updateRevive(p, dt); return; }
    const g = this.gravityFor(p, p.flipUntil);
    const zero = len(g) < 0.5;
    if (!zero) p.up = norm(mul(g, -1));
    const up = p.up;
    // orientación: re-proyectar el rumbo al plano tangente y aplicar giro
    p.heading = norm(project(p.heading, up), norm(cross(up, v3(1, 0, 0)), v3(0, 0, 1)));
    if (inp.dyaw) p.heading = norm(rotAround(p.heading, up, -inp.dyaw));
    p.pitch = clamp(p.pitch + inp.dpitch, -1.5, 1.5);
    inp.dyaw = 0; inp.dpitch = 0;
    const right = cross(p.heading, up);
    const speed = PLAYER.speed * (inp.dash ? PLAYER.dash : 1) * speedMul(p);
    let wish = add(mul(p.heading, inp.mz), mul(right, inp.mx));
    if (zero) {
      wish = add(mul(this.aimDir(p), inp.mz), mul(right, inp.mx));
      if (inp.jump) wish = madd(wish, up, 1);
      const l = len(wish); if (l > 1) wish = mul(wish, 1 / l);
      p.vel = madd(p.vel, sub(mul(wish, speed), p.vel), Math.min(1, 2 * dt));
    } else {
      const l = len(wish); if (l > 1) wish = mul(wish, 1 / l);
      const vUp = dot(p.vel, up), vt = project(p.vel, up);
      const k = Math.min(1, (p.grounded ? 14 : 3) * dt);
      const nvt = madd(vt, sub(mul(wish, speed), vt), k);
      let nvu = vUp;
      if (inp.jump && p.grounded) nvu = PLAYER.jump;
      p.vel = madd(nvt, up, nvu);
      p.vel = madd(p.vel, g, dt);
      const sp = len(p.vel); if (sp > 62) p.vel = mul(p.vel, 62 / sp);
    }
    // integrar en 2 subpasos y colisionar
    p.grounded = false;
    p.ext = mul(p.ext, Math.max(0, 1 - 4 * dt));
    for (let s = 0; s < 2; s++) {
      p.pos = madd(madd(p.pos, p.vel, dt / 2), p.ext, dt / 2);
      const c = collide(this.map, p.pos, p.vel, PLAYER.radius, up);
      if (c && c.d > 0.55) p.grounded = true;
    }
    if (zero) p.grounded = false;
    // portales
    p.portalCd -= dt;
    if (p.portalCd <= 0) for (const po of this.map.portals) {
      const ends = [[po.a, po.b], [po.b, po.a]];
      for (const [from, to] of ends) if (dist(p.pos, from) < po.r) {
        p.pos = clone(to); p.vel = v3(); p.portalCd = 1.5;
        const g2 = this.map.gravityAt(p.pos, this.time);
        if (len(g2) > 0.5) p.up = norm(mul(g2, -1));
        this.emit({ t: 'portal', pid: p.id, p: a3(to) }); break;
      }
      if (p.portalCd > 0) break;
    }
    if (this.map.outOfBounds(p.pos) || !finite(p.pos)) this.playerFell(p);
    // escudo
    if (this.time - p.lastHurt > PLAYER.shieldDelay && p.shield < PLAYER.shield) p.shield = Math.min(PLAYER.shield, p.shield + PLAYER.shieldRate * dt);
    // armas
    if (inp.weapon >= 0) { p.weapon = inp.weapon; inp.weapon = -1; }
    p.cd -= dt;
    p.abilityCd = Math.max(0, p.abilityCd - dt);
    p.interactEdge = inp.interact && !p.interactPrev; p.interactPrev = inp.interact;
    if (inp.ability && !p.abilityPrev) useAbility(this, p); p.abilityPrev = inp.ability;
    if (inp.ping && !p.pingPrev) this.doPing(p); p.pingPrev = inp.ping;
    if (inp.fire && p.cd <= 0 && !p.carry) this.firePlayer(p);
    // recoger
    for (const k of this.pickups) if (!k.dead && dist(k.pos, p.pos) < 2.6) this.collect(p, k);
  }

  playerFell(p) {
    this.hurtPlayer(p, 25, true);
    if (p.dead) return;
    const idx = this.players.indexOf(p);
    p.pos = clone(this.map.playerSpawn(idx)); p.vel = v3();
    const g = this.map.gravityAt(p.pos, this.time);
    p.up = len(g) > 1e-6 ? norm(mul(g, -1)) : v3(0, 1, 0);
    p.flipUntil = 0;
    this.emit({ t: 'portal', pid: p.id, p: a3(p.pos) });
  }

  hurtPlayer(p, dmg, ignoreCooldown = false) {
    if (p.dead || dmg <= 0) return;
    for (const o of this.objects) if (o.type === 'dome' && dist(p.pos, o.pos) < o.r) { dmg *= 0.6; break; }
    if (p.role === 'vanguardia') dmg *= 0.92;
    this.director.hurt(dmg);
    p.lastHurt = this.time;
    const sh = Math.min(p.shield, dmg); p.shield -= sh; dmg -= sh;
    p.hp -= dmg;
    this.emit({ t: 'hurt', pid: p.id, dmg: r2(dmg + sh) });
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.respawnAt = this.time; p.bleed = PLAYER.bleed; p.lost = false; p.reviveT = 0; this.emit({ t: 'down', pid: p.id }); }
  }

  /* ─────────── armas ─────────── */
  firePlayer(p) {
    const w = WEAPONS[p.weapon];
    if (w.per > 0 && p.ammo[p.weapon] < w.per) { // sin munición → Haz
      p.weapon = 0; return;
    }
    p.cd = Math.max(p.cd, -this.dt) + w.rate; // arrastra el sobrante: la cadencia no se redondea al tick
    if (w.per > 0) p.ammo[p.weapon] -= w.per;
    const origin = this.eyePos(p);
    const base = this.aimDir(p);
    if (w.kind === 'projectile') {
      this.addProjectile({ owner: 'p', pid: p.id, kind: 'nova', pos: madd(origin, base, 1.5), vel: mul(base, w.speed), dmg: w.dmg, splash: w.splash, r: 0.6, life: 4 });
      this.emit({ t: 'shot', pid: p.id, w: p.weapon, o: a3(origin) });
      return;
    }
    const right = cross(p.heading, p.up);
    const tips = [];
    for (let i = 0; i < w.pellets; i++) {
      let d = base;
      if (w.spread) d = norm(add(add(base, mul(right, this.rng.gauss() * w.spread)), mul(cross(base, right), this.rng.gauss() * w.spread)));
      tips.push(this.hitscan(p, origin, d, w));
    }
    this.emit({ t: 'shot', pid: p.id, w: p.weapon, o: a3(origin), to: tips.slice(0, 3).map(a3) });
  }

  /** Rayo: devuelve el punto final. Daña criaturas; las armas "pierce" atraviesan. */
  hitscan(p, o, d, w) {
    const hits = [];
    for (const m of this.monsters) {
      if (m.dead) continue;
      const oc = sub(m.pos, o), tca = dot(oc, d);
      if (tca < 0 || tca > w.range) continue;
      const d2 = dot(oc, oc) - tca * tca, rr = m.r * 1.05;
      if (d2 > rr * rr) continue;
      hits.push({ m, t: tca - Math.sqrt(rr * rr - d2) });
    }
    for (const ob of this.objects) {
      if (!ob.hostile || ob.hp <= 0) continue;
      const oc = sub(ob.pos, o), tca = dot(oc, d); if (tca < 0 || tca > w.range) continue;
      const d2 = dot(oc, oc) - tca * tca, rr = ob.r + 0.3; if (d2 > rr * rr) continue;
      hits.push({ ob, t: tca - Math.sqrt(rr * rr - d2) });
    }
    hits.sort((a, b) => a.t - b.t);
    let tEnd = w.range;
    // línea de tiro: avanzar hasta el primer sólido (solo hasta el primer impacto relevante)
    const limit = hits.length ? (w.pierce ? w.range : Math.max(0.5, hits[0].t)) : Math.min(w.range, 160);
    for (let t = 1.5; t < limit; t += 1.5) if (blocked(this.map, madd(o, d, t))) { tEnd = t; break; }
    if (tEnd === w.range && !hits.length) tEnd = limit;
    for (const h of hits) {
      if (h.t > tEnd) break;
      if (h.ob) this.damageObject(h.ob, w.dmg, p, madd(o, d, Math.max(0, h.t))); else this.damageMonster(h.m, w.dmg, p, madd(o, d, Math.max(0, h.t)));
      if (!w.pierce) { tEnd = h.t; break; }
    }
    return madd(o, d, Math.max(0.5, Math.min(tEnd, w.range)));
  }

  addProjectile(pr) {
    if (this.projectiles.length >= LIMITS.projectiles) this.projectiles.shift();
    pr.id = this.nextId++; pr.age = 0;
    this.projectiles.push(pr);
    return pr;
  }

  /* ─────────── criaturas ─────────── */
  damageMonster(m, dmg, by, at) {
    if (m.dead) return;
    let mul_ = 1;
    if (m.kind === 'geoda') mul_ = m.open ? 1 : 0.2;
    if (m.kind === 'madre') mul_ = m.open ? 1 : 0.15;
    if (m.kind === 'espejo') { m.cloak = false; m.reveal = 2.2; }
    if (m.stun) mul_ *= 1.5;
    if (m.kind === 'coloso') { if (m.shield) mul_ *= BOSS_MECH.shield; if (m.stagger > 0) mul_ *= BOSS_MECH.stagger; }
    if (this.time < (m.markUntil || 0)) mul_ *= 1.3;
    if (by && this.time < this.teamBuffUntil) mul_ *= 1.25;
    if (this.time < (m.shieldUntil || 0)) mul_ *= 0.5;
    m.hp -= dmg * mul_; m.hurt = 0.12;
    if (by) by.score += 0;
    this.emit({ t: 'hit', id: m.id, p: a3(at || m.pos), d: r2(dmg * mul_), arm: mul_ < 1 });
    if (m.hp <= 0) this.killMonster(m, by);
  }

  killMonster(m, by) {
    if (m.dead) return;
    m.dead = true; this.stats.kills++;
    if (by) { by.kills++; by.score += m.def.score; }
    if (m.parent) { const par = this.monsters.find((q) => q.id === m.parent); if (par) par.kids = Math.max(0, par.kids - 1); }
    this.emit({ t: 'kill', id: m.id, k: m.kind, p: a3(m.pos) });
    if (m.kind === 'racimo') this.explode(m.pos, 5.5, 22, 40, null);
    if (m.def.boss) { // al caer el corazón del vórtice todo lo demás se hace añicos
      this.queue = []; bossDeath(this);
      for (const o of this.monsters) if (!o.dead && o !== m) { o.dead = true; this.emit({ t: 'kill', id: o.id, k: o.kind, p: a3(o.pos) }); }
      return;
    }
    const lowHp = this.players.some((p) => !p.dead && p.hp < 55);
    if (this.rng.next() < (lowHp ? 0.3 : 0.18)) {
      if (lowHp && this.rng.next() < 0.6) this.dropPickup('hp', m.pos);
      else this.dropPickup('ammo', m.pos, this.rng.int(1, WEAPONS.length - 1));
    }
    if (m.kind === 'geoda') { if (this.rng.next() < 0.6) this.dropPickup('hp', m.pos); this.dropPickup('ammo', m.pos, this.rng.pick([2, 2, 3, 4, 1])); }
  }

  /** Daño en área: a jugadores (pd) y criaturas (md). */
  explode(pos, radius, pd, md, by, hurtPlayers = true) {
    this.emit({ t: 'boom', p: a3(pos), r: radius });
    if (hurtPlayers) for (const p of this.players) {
      const d = dist(p.pos, pos);
      if (!p.dead && d < radius + PLAYER.radius) this.hurtPlayer(p, pd * (1 - 0.6 * d / (radius + 1)));
    }
    for (const ob of [...this.objects]) if (ob.hostile && ob.hp > 0 && dist(ob.pos, pos) < radius + ob.r) this.damageObject(ob, md * 0.8, by, ob.pos);
    for (const m of this.monsters) {
      if (m.dead) continue;
      const d = dist(m.pos, pos);
      if (d < radius + m.r) this.damageMonster(m, md * (1 - 0.6 * Math.min(1, d / (radius + m.r))), by, m.pos);
    }
  }

  updateMonster(m, dt) {
    if (m.dead) return;
    const ts = this.map.timeScaleAt(m.pos);
    const dtm = dt * ts;
    m.t += dtm; m.hurt = Math.max(0, m.hurt - dt);
    const targets = this.alivePlayers();
    if (targets.length) AI[m.def.ai](this, m, dtm, targets);
    if (m.dead) return;
    if (!finite(m.pos) || this.map.outOfBounds(m.pos)) { m.dead = true; if (m.parent) { const par = this.monsters.find((q) => q.id === m.parent); if (par) par.kids = Math.max(0, par.kids - 1); } if (m.def.boss) { m.pos = clone(this.map.bossAnchor); m.dead = false; m.vel = v3(); } return; }
    // reubicar rezagados (fuera de alcance mucho tiempo)
    if (targets.length && !m.def.boss) {
      let d = Infinity; for (const p of targets) d = Math.min(d, dist(p.pos, m.pos));
      m.far = d > 95 || (d > 55 && m.t > 14 && m.def.speed > 0 && len(m.vel) < 0.5) ? m.far + dt : 0;
      if (m.far > 7) {
        const ref = targets[0];
        m.pos = m.def.fly ? this.map.spawnAir(this.rng, ref.pos, ref.up) : this.map.spawnGround(this.rng, ref.pos);
        m.vel = v3(); m.far = 0;
      }
    }
  }

  separate() {
    const ms = this.monsters, n = ms.length;
    for (let i = 0; i < n; i++) {
      const a = ms[i]; if (a.dead || a.def.boss) continue;
      for (let j = i + 1; j < n; j++) {
        const b = ms[j]; if (b.dead || b.def.boss) continue;
        const dx = a.pos.x - b.pos.x, dy = a.pos.y - b.pos.y, dz = a.pos.z - b.pos.z;
        const min = (a.r + b.r) * 0.8, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < min * min && d2 > 1e-8) {
          const d = Math.sqrt(d2), push = (min - d) * 0.5 / d;
          a.pos.x += dx * push; a.pos.y += dy * push; a.pos.z += dz * push;
          b.pos.x -= dx * push; b.pos.y -= dy * push; b.pos.z -= dz * push;
        }
      }
    }
  }

  /* ─────────── proyectiles ─────────── */
  updateProjectiles(dt) {
    const keep = [];
    for (const pr of this.projectiles) {
      if (pr.owner === 'm' && this.objects.some((o) => o.type === 'dome' && dist(pr.pos, o.pos) < o.r)) { this.emit({ t: 'splat', p: a3(pr.pos) }); continue; }
      const ts = pr.owner === 'm' ? this.map.timeScaleAt(pr.pos) : 1;
      pr.age += dt; pr.life -= dt;
      if (pr.accel) pr.vel = madd(pr.vel, norm(pr.vel), pr.accel * dt * ts);
      const n = Math.max(1, Math.ceil((len(pr.vel) * dt * ts) / 0.9)); // proyectiles rápidos: sub-pasos para no atravesar
      let dead = false, hitP = null;
      for (let k = 0; k < n && !dead; k++) {
        pr.pos = madd(pr.pos, pr.vel, (dt * ts) / n);
        if (blocked(this.map, pr.pos)) { dead = true; hitP = 'solid'; }
        else if (pr.owner === 'm') { for (const p of this.players) if (!p.dead && dist(p.pos, pr.pos) < PLAYER.radius + pr.r) { this.hurtPlayer(p, pr.dmg); dead = true; hitP = 'player'; this.emit({ t: 'splat', p: a3(pr.pos) }); break; } }
        else { for (const m of this.monsters) if (!m.dead && dist(m.pos, pr.pos) < m.r + pr.r) { dead = true; hitP = 'monster'; break; } }
      }
      dead = dead || pr.life <= 0 || !finite(pr.pos) || this.map.outOfBounds(pr.pos);
      if (hitP === 'monster') this.explode(pr.pos, pr.splash, 0, pr.dmg, this.players.find((q) => q.id === pr.pid), false);
      else if (hitP === 'solid') { dead = true; if (pr.splash) this.explode(pr.pos, pr.splash, 0, pr.dmg, this.players.find((q) => q.id === pr.pid), false); else this.emit({ t: 'splat', p: a3(pr.pos) }); }
      if (!dead) keep.push(pr);
    }
    this.projectiles = keep;
  }

  /* ─────────── pickups ─────────── */
  dropPickup(type, pos, w = 0) {
    if (this.pickups.length >= LIMITS.pickups) this.pickups.shift();
    this.pickups.push({ id: this.nextId++, type, w, pos: clone(pos), vel: v3(), up: v3(0, 1, 0), life: 40, dead: false });
  }
  updatePickups(dt) {
    for (const k of this.pickups) {
      k.life -= dt;
      const g = this.map.gravityAt(k.pos, this.time);
      if (len(g) > 0.5) k.up = norm(mul(g, -1));
      k.vel = madd(k.vel, g, dt);
      k.pos = madd(k.pos, k.vel, dt);
      collide(this.map, k.pos, k.vel, 0.5, k.up);
      if (this.map.outOfBounds(k.pos) || k.life <= 0) k.dead = true;
    }
    if (this.pickups.some((k) => k.dead)) this.pickups = this.pickups.filter((k) => !k.dead);
  }
  collect(p, k) {
    if (k.type === 'hp') { if (p.hp >= PLAYER.hp && p.shield >= PLAYER.shield) return; p.hp = Math.min(PLAYER.hp, p.hp + 35); p.shield = PLAYER.shield; }
    else { const w = WEAPONS[k.w]; if (p.ammo[k.w] >= w.max) return; p.ammo[k.w] = Math.min(w.max, p.ammo[k.w] + Math.ceil(w.max * 0.4)); }
    k.dead = true;
    this.emit({ t: 'pickup', pid: p.id, type: k.type });
  }

  /* ─────────── objetos del mundo (puzzles, jefes, habilidades) ─────────── */
  addObject(type, pos, extra = {}) {
    if (this.objects.length >= 40) this.removeObject(this.objects.find((o) => !o.objective && !o.boss) || this.objects[0]);
    const o = { id: this.nextId++, type, pos: clone(pos), r: 1.5, hp: 0, ...extra }; this.objects.push(o); return o;
  }
  removeObject(o) { if (o) this.objects = this.objects.filter((x) => x !== o); }
  damageObject(o, dmg, by, at) {
    if (o.hp <= 0) return;
    o.hp -= dmg; this.emit({ t: 'hit', id: o.id, p: a3(at || o.pos), d: r2(dmg), arm: false });
    if (o.hp <= 0 && o.type === 'sac') {
      this.emit({ t: 'sacbreak', p: a3(o.pos) }); this.removeObject(o);
      this.dropPickup('ammo', o.pos, this.rng.int(1, WEAPONS.length - 1)); if (this.rng.next() < 0.5) this.dropPickup('hp', o.pos);
    }
  }
  updateObjects(dt) {
    for (const o of [...this.objects]) {
      if (o.type === 'dome') { o.life -= dt; if (o.life <= 0) this.removeObject(o); }
      else if (o.type === 'turret') {
        o.life -= dt; o.cd -= dt;
        if (o.life <= 0) { this.removeObject(o); continue; }
        if (o.cd <= 0) {
          let best = null, bd = 35;
          for (const m of this.monsters) { if (m.dead) continue; const d = dist(m.pos, o.pos); if (d < bd) { bd = d; best = m; } }
          if (best) { const by = this.players.find((q) => q.id === o.owner); this.damageMonster(best, 12, by || null, best.pos); this.emit({ t: 'tshot', o: a3(o.pos), to: a3(best.pos) }); o.cd = 0.26; } else o.cd = 0.3;
        }
      } else if (o.type === 'sac') {
        o.hatch -= dt;
        if (o.hatch <= 0) {
          const par = this.monsters.find((q) => q.id === o.parent);
          this.removeObject(o);
          if (par && (par.kids || 0) < 6) { const k = this.spawnMonster('ariete', o.pos, { parent: par.id }); if (k) par.kids++; }
          this.emit({ t: 'hatch', p: a3(o.pos) });
        }
      }
    }
  }
  /** Marcar un lugar/criatura/objeto para todo el equipo (ping). */
  doPing(p) {
    const o = this.eyePos(p), d = this.aimDir(p); let best = null, bt = 140, kind = 'pos', pos = null, label = '';
    for (const m of this.monsters) { if (m.dead) continue; const oc = sub(m.pos, o), t = dot(oc, d); if (t < 0 || t > bt) continue; const d2 = dot(oc, oc) - t * t, rr = m.r * 1.6 + 0.8; if (d2 < rr * rr) { bt = t; best = m; } }
    if (best) { kind = 'enemy'; pos = clone(best.pos); label = best.kind; }
    else {
      let bo = null; bt = 140;
      for (const ob of this.objects) { if (ob.type === 'dome' || ob.type === 'turret') continue; const oc = sub(ob.pos, o), t = dot(oc, d); if (t < 0 || t > bt) continue; const d2 = dot(oc, oc) - t * t, rr = ob.r + 1.8; if (d2 < rr * rr) { bt = t; bo = ob; } }
      if (bo) { kind = 'obj'; pos = clone(bo.pos); label = bo.type; }
    }
    if (!pos) { let t = 1.5; for (; t < 120; t += 1.5) if (blocked(this.map, madd(o, d, t))) break; pos = madd(o, d, Math.min(t, 120) - 0.5); }
    this.pings = this.pings.filter((q) => q.pid !== p.id || q.until > this.time + 3); // máx. 2 por jugador
    this.pings.push({ id: this.nextId++, pid: p.id, k: kind, label, pos, until: this.time + 7 });
    this.emit({ t: 'ping', pid: p.id, k: kind, p: a3(pos) });
  }

  /* ─────────── snapshot (lo que ve el cliente) ─────────── */
  drainEvents() { const e = this.events; this.events = []; return e; }

  snapshot() {
    const boss = this.monsters.find((m) => m.def.boss && !m.dead);
    return {
      tick: this.tick, time: r2(this.time), map: this.mapId, state: this.state, phase: this.phase,
      wave: this.wave, waveTotal: this.waveTotal, left: this.queue.length + this.monsters.length, intermission: r2(Math.max(0, this.phaseT)),
      fx: this.map.fx(this.time),
      boss: boss ? { hp: Math.round(boss.hp), max: Math.round(boss.maxhp), name: boss.def.name, shield: !!boss.shield, stagger: r2(boss.stagger || 0), pressure: r2(boss.pressure || 0), ray: boss.ray ? r2(boss.ray.t) : 0 } : null,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, pos: a3(p.pos), up: a3(p.up), h: a3(p.heading), pitch: r2(p.pitch), hp: Math.round(p.hp), sh: Math.round(p.shield),
        dead: p.dead, rv: r2(p.reviveT), role: p.role, ab: r2(p.abilityCd / ROLES[p.role].cd), carry: p.carry, bleed: r2(Math.max(0, p.bleed)), lost: p.lost, w: p.weapon, ammo: p.ammo.map((a) => (a === Infinity ? -1 : a)), kills: p.kills, score: p.score, flip: this.time < p.flipUntil,
      })),
      monsters: this.monsters.map((m) => ({
        id: m.id, k: m.kind, p: a3(m.pos), u: a3(m.up), f: a3(m.fwd), hp: Math.round(m.hp), mh: Math.round(m.maxhp), r: m.r,
        s: m.vis || m.state, o: !!m.open, pr: r2(m.pressure || 0), mk: this.time < (m.markUntil || 0), c: !!m.cloak, h: m.hurt > 0, t: r2(m.t), a: m.aim ? a3(m.aim) : null, sd: this.time < (m.shieldUntil || 0) || !!m.shield, st: !!m.stun || (m.stagger || 0) > 0,
      })),
      projectiles: this.projectiles.map((q) => ({ id: q.id, k: q.kind, o: q.owner, p: a3(q.pos), v: a3(q.vel), r: q.r })),
      pickups: this.pickups.map((k) => ({ id: k.id, t: k.type, w: k.w, p: a3(k.pos) })),
      objs: this.objects.map((o) => ({ id: o.id, t: o.type, p: a3(o.pos), r: o.r, s: o.state || (o.on ? 'on' : 'off'), v: r2(o.v || 0), hp: Math.round(o.hp || 0), mx: Math.round(o.maxhp || 0), c: o.carrier || 0, ow: o.owner || 0, l: r2(o.life || 0) })),
      obj: this.objective ? { type: this.objective.type, title: this.objective.title, desc: this.objective.desc, prog: r2(this.objective.prog), left: r2(Math.max(0, this.objective.limit - this.objective.t)), state: this.objective.state } : null,
      pings: this.pings.map((q) => ({ id: q.id, pid: q.pid, k: q.k, l: q.label, p: a3(q.pos), left: r2(q.until - this.time) })),
      dir: { stress: r2(this.director.stress), frag: this.fragments, buff: r2(Math.max(0, this.teamBuffUntil - this.time)) },
      events: this.drainEvents(),
    };
  }
}
export { MAPS };
