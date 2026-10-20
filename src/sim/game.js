import { v3, add, sub, mul, madd, dot, cross, len, dist, norm, clamp, project, rotAround, makeRng, clone, finite } from './math.js';
import { MONSTER_PACE, BOSS_PACE, G, LIMITS, WEAPONS, MONSTERS, WAVE_PLANS, BOSS_OF, PLAYER, BOSS_MECH, CHARACTERS, CHARACTER_IDS, HOST_IDS, WAVE_SCALE, MELEE_WEAPONS, CORES, EVO_PATHS, evoPathsFor, STYLES, AFFIX_IDS, LINEAGE } from './data.js';
import { MAPS } from './maps.js';
import { collide, blocked } from './physics.js';
import { AI } from './ai.js';
import { useAbility, roleFor, reviveRate, speedMul } from './roles.js';
import { makeObjective, updateObjective } from './objectives.js';
import { initColoso, initMadre, initArgos, bossDeath } from './bossmech.js';
import { useMove, useSpecial } from './characters.js';
import { spawnNpc, clearNpc, npcStep } from './npcs.js';
import { initBase, stepBase, baseStep, baseSinArmas } from './base.js';   // La Base (docs/BASE.md): mapa-hub sin oleadas
import { orgSnap, loadOrgans, shapeOrgans, hasC } from './organos.js';
import { applyBend } from './bendiciones.js';
import { applyMaestria } from './maestria.js';
import { applyArbol, shapeArbolGun } from './progresion.js';   // árbol de combos y de disparo permanentes (docs/EVOLUCION.md)
import { setMode } from './combos.js';
import { enrutar } from './modos.js';   // slots de habilidad por modo (Disparo / Melé)
import { initDrops, initPity, updateLoot, flushLoot, lootSnap, dropsKill, dropsJefe, dropsRespiro } from './drops.js';   // dropeo de objetos (docs/INVENTARIO.md): rng propio g.drRng
import { applyEquip, itemsSnap, shapeItemGun, ensureGunSlot } from './items-fx.js';
import { initHost, addCores, updateHost, hostDamageIn, hostOut, hostDamaged, hostHit, hostSnap, hostKill, hostObject, inWall, inChrono } from './huespedes.js';
import { cleanSlots, upgOf, wstat, ammoMax, makeCards, applyCard, shapeWeapon, anyMut, clipOf, reloadTime } from './loadout.js';
import { Director } from './director.js';
import { initArenas, tickArenas, arSnap, arTargets, arExplosion, arKill, arVel, arDanio, danarOrgano } from './arenas-vivas.js'; // arenas vivas (src/sim/arenas-vivas.js)
import { initNieblas, tickNieblas, ngSnap, ngVel, ngDanio, ngRecibe, ngOculta, ngMonstruoRecibe, ngDeforma } from './nieblas.js';   // nieblas de colores con función (src/sim/nieblas.js)
import { initFlora, tickFlora, flSnap, flVel, flRecibe, floraRayo, floraExplosion, applyHerb } from './flora.js';   // flora interactiva (src/sim/flora.js)
import { initEventos, planOleada, finOleada, tickEventos, evSnap, factorFlip, limitarCaida } from './eventos.js';
import { initFauna, initFaunaPlayer, tickFauna, shapeFauna, faunaSnap, faunaPlayerSnap } from './fauna.js';   // fauna consumible y metamorfosis (src/sim/fauna.js, docs/FAUNA.md)
import { iniciarMision, misionKill, misionHurt, misionFin, misionSnap, puntoObjetivo } from './metas.js';
import { initCult, tickCultivo, feedCapullo } from './cultivo.js';
import { ROLES, ROLE_IDS } from './data.js';

const r2 = (n) => Math.round(n * 100) / 100;
/** Caminos de evolución válidos: en orden, uno por nivel, y nunca más que niveles alcanzados; al primer inválido se corta. */
const cleanPath = (path, evo, char) => { const out = [], EP = evoPathsFor(char); for (let i = 0; i < Math.min(path.length, evo); i++) { const o = EP[i + 1]; if (!o || !o.some((x) => x.id === path[i])) break; out.push(path[i]); } return out; };
const a3 = (v) => [r2(v.x), r2(v.y), r2(v.z)];

/**
 * Simulación autoritativa y determinista (sin DOM, sin three). La corre el navegador
 * en solitario o el servidor en cooperativo. Entrada: setInput(); salida: snapshot().
 */
export class Game {
  constructor({ mapId = 'm1', seed = 1, difficulty = 1, calm = 4, practice = false, magazines = false } = {}) {
    this.magazines = !!magazines;   // cargadores y recarga (el juego real los usa; las pruebas viejas no)
    this.practice = !!practice; this.practiceT = 0;
    this.map = MAPS[mapId];
    if (!this.map) throw new Error('mapa desconocido: ' + mapId);
    if (this.map.instance) this.map = this.map.instance(); // mapas que cambian durante la partida (mapa 4: el puente crece)
    this.mapId = mapId;
    this.rng = makeRng(seed); this.seed = seed;
    this.difficulty = difficulty * (mapId === 'm2' ? 1.35 : 1); // la Cámara Fractal es más exigente (el bot ganaba 8/8)
    this.tick = 0; this.time = 0; this.dt = 1 / 60;
    this.players = []; this.monsters = []; this.projectiles = []; this.pickups = [];
    this.events = [];
    this.nextId = 1;
    this.state = 'playing'; // playing | won | lost
    this.wave = 0; this.waveTotal = (WAVE_PLANS[mapId] || []).length + 1;
    this.phase = 'intermission'; this.phaseT = calm; // calma inicial (la historia usa más)
    this.queue = []; this.omens = []; this.spawnT = 0; this.spawnGap = 1.5;
    this.boss = null; this.mision = null; this.forceElite = false;
    this.objects = []; this.pings = []; this.objective = null; this.fragments = 0; this.teamBuffUntil = 0; this.director = new Director(); this.curTypes = [];
    this.stats = { kills: 0, spawned: 0, maxAlive: 0 };
    this.cult = this.map.cultivo ? initCult(this) : null; // acertijo del mapa 4 (src/sim/cultivo.js)
    initArenas(this);                                     // arenas vivas: cada mapa es un organismo (src/sim/arenas-vivas.js; rng propio g.arRng)
    initFlora(this);                                      // flora interactiva (src/sim/flora.js; rng propio g.flRng)
    initNieblas(this);                                    // nieblas de colores con función (src/sim/nieblas.js; rng propio g.ngRng)
    initFauna(this);                                      // fauna consumible (src/sim/fauna.js; rng propio g.faRng, ids propios: no toca g.rng)
    initDrops(this, seed);                                // botín: g.drRng derivado de la semilla (nunca usa g.rng)
    if (this.map.base) initBase(this);                    // La Base: estaciones y personajes fijos (src/sim/base.js)
    initEventos(this);                                    // eventos de oleada (src/sim/eventos.js): la gravedad invertida vive dentro de uno de ellos
  }

  /* ─────────── jugadores ─────────── */
  addPlayer(name = 'Pasajero', role = null, opts = {}) {
    if (this.players.length >= 4) return null;
    const idx = this.players.length;
    const char = CHARACTERS[opts.char] ? opts.char : (role == null ? HOST_IDS[idx % HOST_IDS.length] : null);
    if (char && (role == null || !ROLE_IDS.includes(role))) role = CHARACTERS[char].team || CHARACTERS[char].role;
    if (!ROLE_IDS.includes(role)) role = roleFor(idx);
    const pos = clone(this.map.playerSpawn(idx));
    const g = this.map.gravityAt(pos, this.time);
    const up = len(g) > 1e-6 ? norm(mul(g, -1)) : v3(0, 1, 0);
    const p = {
      id: this.nextId++, name, role, char: char || null, slots: cleanSlots(opts.slots || (char && CHARACTERS[char] && CHARACTERS[char].slots)), upg: {}, cards: [], movCd: 0, espCd: 0, movPrev: false, espPrev: false, invulUntil: 0, abilityCd: 0, carry: 0, bleed: 0, lost: false, abilityPrev: false, interactPrev: false, interactEdge: false, pingPrev: false, pos, vel: v3(), up, heading: norm(project(v3(0, 0, -1), up), v3(1, 0, 0)), pitch: 0,
      hp: PLAYER.hp, shield: PLAYER.shield, dead: false, weapon: 0, ammo: WEAPONS.map((w) => w.start), clip: WEAPONS.map(() => 1e9), reloadT: 0, reloadW: -1, reloadPrev: false,
      cd: 0, ext: v3(), reviveT: 0, lastHurt: -99, flipUntil: 0, portalCd: 0, grounded: false, kills: 0, score: 0, respawnAt: 0,
      input: { mx: 0, mz: 0, dyaw: 0, dpitch: 0, jump: false, fire: false, dash: false, weapon: -1, ability: false, interact: false, ping: false, mov: false, esp: false, pick: -1, ads: false, crouch: false, melee: false, s3: false, ult: false, evo: 0, reload: false },
    };
    if (MELEE_WEAPONS[opts.melee]) p.melee = opts.melee; if (STYLES[opts.style] && opts.style !== 'combo') p.style = opts.style; if (Number.isInteger(opts.evo)) p.evo = Math.max(0, Math.min(4, opts.evo)); if (Array.isArray(opts.path)) p.path = cleanPath(opts.path, p.evo, p.char); if (opts.cores > 0) p.cores = Math.min(5000, Math.floor(opts.cores));
    if (opts.mode === 'combo') p.mode = 'combo';
    initHost(p); loadOrgans(p, opts); applyBend(p, opts.bend); applyHerb(p, opts.herb); applyMaestria(p, opts.maestria); applyArbol(p, opts.arbol); // bendiciones de territorio (src/sim/bendiciones.js) y maestría del Huésped (src/sim/maestria.js)
    p.kit = Math.max(0, Math.min(2, opts.kit | 0));   // botiquines iniciales de la Tienda (docs/TIENDA.md): una segunda oportunidad cada uno
    initFaunaPlayer(p, opts.fauna); initPity(p, opts.pity); p.sigPlan = Array.isArray(opts.sigs) && opts.sigs.includes(p.char); applyEquip(p, opts.equip, this);   // objetos equipados (src/sim/items-fx.js) y garantía de legendaria (drops.js)
    this.players.push(p);
    return p;
  }
  removePlayer(id) { this.players = this.players.filter((p) => p.id !== id); }
  setInput(id, inp) {
    const p = this.players.find((q) => q.id === id);
    if (!p) return;
    const i = p.input;
    if (inp.mode === 'combo' || inp.mode === 'shooter') setMode(p, inp.mode);   // modo de juego (src/sim/combos.js)
    i.mx = clamp(+inp.mx || 0, -1, 1); i.mz = clamp(+inp.mz || 0, -1, 1);
    i.dyaw = clamp(i.dyaw + (+inp.dyaw || 0), -7, 7); i.dpitch = clamp(i.dpitch + (+inp.dpitch || 0), -4, 4); // acumulativo hasta el próximo step; acotado contra entradas hostiles
    i.jump = !!inp.jump; i.fire = !!inp.fire; i.dash = !!inp.dash; i.ability = !!inp.ability; i.interact = !!inp.interact; i.autoc = !!inp.autoc; i.ping = !!inp.ping; i.mov = !!inp.mov; i.esp = !!inp.esp; i.ads = !!inp.ads; i.crouch = !!inp.crouch; i.melee = !!inp.melee; i.reload = !!inp.reload; i.npc = (inp.npc && typeof inp.npc === 'object' && (inp.npc.offer === 0 || inp.npc.offer === 1 || inp.npc.offer === 2 || inp.npc.offer === 3)) ? { offer: inp.npc.offer } : null; if (typeof inp.style === 'string' && STYLES[inp.style] && inp.style !== 'combo' && p.mode !== 'combo') p.style = inp.style; i.organ = (inp.organ && typeof inp.organ === 'object' && Number.isInteger(inp.organ.w) && typeof inp.organ.id === 'string') ? { t: inp.organ.t === 'c' ? 'c' : 'w', w: inp.organ.w, id: inp.organ.id.slice(0, 30) } : null; i.evo = inp.evo === true ? 1 : (inp.evo === 1 || inp.evo === 2) ? inp.evo : 0; i.s3 = !!inp.s3; i.ult = !!inp.ult; i.soft = !!inp.soft;
    i.a1 = !!inp.a1; i.a2 = !!inp.a2; i.hab = !!inp.hab;   // Combo: ataque 1, ataque 2, habilidad principal
    { // los 3 slots de habilidad (HAB.1 = mov, HAB.2 = esp, HAB.3 = s3) se traducen según el modo (src/sim/modos.js): en Melé HAB.3 es la habilidad principal de Combo
      const r = enrutar(p.char, p.mode, { mov: i.mov, esp: i.esp, s3: i.s3 }, i.hab); i.mov = r.mov; i.esp = r.esp; i.s3 = r.s3; i.hab = r.hab;
      if (p.mode === 'combo') { i.fire = false; i.melee = false; i.reload = false; }   // en Melé el disparo, el melé rápido y recargar no hacen nada (el ataque es A1/A2)
    }
    if (inp.cam && typeof inp.cam === 'object') p.cam = { third: !!inp.cam.third, side: inp.cam.side < 0 ? -1 : 1, dist: clamp(+inp.cam.dist || 3.6, 1.5, 7) }; else if (inp.cam === false) p.cam = null;
    if (Number.isInteger(inp.weapon) && inp.weapon >= 0 && inp.weapon < WEAPONS.length) i.weapon = inp.weapon;
    if (Number.isInteger(inp.pick) && inp.pick >= 0 && inp.pick < 3) i.pick = inp.pick;
  }
  /** Cambia de arma activa por id (campo de pruebas) y la deja en la ranura `slot` (1..4). */
  setSlotWeapon(id, slot, wid) { const p = this.players.find((q) => q.id === id); if (!p || slot < 1 || slot > 4 || wid < 1 || wid >= WEAPONS.length) return; p.slots = cleanSlots(p.slots.map((w, i) => (i === slot ? wid : w))); p.weapon = wid; }
  setLoadout(id, char, slots, prof = null) { const p = this.players.find((q) => q.id === id); if (!p) return; if (CHARACTERS[char]) { p.char = char; p.role = CHARACTERS[char].team || CHARACTERS[char].role; initHost(p); if (prof) { if (MELEE_WEAPONS[prof.melee]) p.melee = prof.melee; if (Number.isInteger(prof.evo)) p.evo = Math.max(0, Math.min(4, prof.evo)); if (Array.isArray(prof.path)) p.path = cleanPath(prof.path, p.evo, p.char); if (prof.cores > 0) p.cores = Math.min(5000, Math.floor(prof.cores)); loadOrgans(p, prof); if (prof.bend) applyBend(p, prof.bend); applyMaestria(p, prof.maestria ?? p.mastery); applyArbol(p, prof.arbol ?? p.arb); if (prof.pity) initPity(p, prof.pity); if (Array.isArray(prof.sigs)) p.sigPlan = prof.sigs.includes(p.char); } applyEquip(p, prof && prof.equip !== undefined ? prof.equip : p.eqList, this); } if (Array.isArray(slots)) p.slots = cleanSlots(slots); else if (CHARACTERS[char] && CHARACTERS[char].slots) p.slots = cleanSlots(CHARACTERS[char].slots); ensureGunSlot(p); }
  setRole(id, role) { const p = this.players.find((q) => q.id === id); if (p && ROLE_IDS.includes(role)) p.role = role; }
  alivePlayers() { return this.players.filter((p) => !p.dead); }
  eyePos(p) { return madd(p.pos, p.up, PLAYER.eye - (p.input.crouch ? 0.3 : 0)); }
  /** Hacia dónde MIRA la cámara (rumbo + inclinación). */
  lookDir(p) { return add(mul(p.heading, Math.cos(p.pitch)), mul(p.up, Math.sin(p.pitch))); }
  /** Posición de la cámara en tercera persona (sobre el hombro): la usa la simulación para que el disparo vaya a donde apunta la RETÍCULA. */
  camPos(p) {
    const c = p.cam, d = this.lookDir(p), right = cross(p.heading, p.up), k = p.input.ads ? 0.7 : 1;
    return madd(madd(madd(this.eyePos(p), d, -c.dist * k), right, c.side * 0.8 * k), p.up, 0.25);
  }
  /** Dirección de disparo. En 1ª persona = la mirada. En 3ª persona: desde el ojo hacia el punto que cruza la retícula (primer enemigo o muro delante de la cámara). */
  aimDir(p) {
    const d = this.lookDir(p), c = p.cam;
    if (!c || !c.third) return d;
    const o = this.camPos(p), t0 = Math.max(1, c.dist * 0.9); let best = 120;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const oc = sub(m.pos, o), tca = dot(oc, d); if (tca < t0 || tca > best) continue;
      const d2 = dot(oc, oc) - tca * tca, rr = m.r * 1.05 + 0.35; if (d2 > rr * rr) continue;
      best = Math.min(best, tca - Math.sqrt(rr * rr - d2));
    }
    for (let t = t0; t < best; t += 1.5) if (blocked(this.map, madd(o, d, t))) { best = t; break; }
    const dir = sub(madd(o, d, Math.max(t0, best)), this.eyePos(p)), l = len(dir);
    return l > 0.5 ? mul(dir, 1 / l) : d;
  }
  emit(e) { if (this.events.length < LIMITS.events) this.events.push(e); }

  /* ─────────── paso principal ─────────── */
  step(dt) {
    this.tick++; this.time += dt; this.dt = dt;
    if (this.state !== 'playing') { if (this.loot.length) flushLoot(this); return; }
    this.director.update(this, dt);
    this.updateWaves(dt); this.updateOmens(); tickArenas(this, dt); tickNieblas(this, dt); tickFlora(this, dt); tickFauna(this, dt);
    for (const p of this.players) this.updatePlayer(p, dt);
    updateObjective(this, dt); this.updateObjects(dt); if (this.cult) tickCultivo(this, dt);
    if (this.pings.length) this.pings = this.pings.filter((q) => q.until > this.time);
    for (const m of this.monsters) this.updateMonster(m, dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt); updateLoot(this, dt);
    this.separate();
    if (this.monsters.some((m) => m.dead)) this.monsters = this.monsters.filter((m) => !m.dead);
    this.stats.maxAlive = Math.max(this.stats.maxAlive, this.monsters.length);
    if (this.players.length && this.players.every((p) => p.dead)) { this.state = 'lost'; this.emit({ t: 'lost' }); }
    if (this.state !== 'playing') flushLoot(this);   // lo que quedó en el piso se entrega a su dueño
  }

  /* ─────────── oleadas ─────────── */
  /** Campo de pruebas: sin oleadas; blancos pasivos que reaparecen, munición y vida ilimitadas. */
  updatePractice(dt) {
    this.phaseT = 1e9; this.phase = 'intermission';
    for (const p of this.players) { if (p.dead) { p.dead = false; p.hp = 100; } p.hp = Math.min(PLAYER.hp, p.hp + 40 * dt); p.shield = PLAYER.shield; WEAPONS.forEach((w, i) => { if (w.max !== Infinity) p.ammo[i] = ammoMax(p, i); }); }
    const alive = this.monsters.filter((m) => !m.dead && m.passive).length;
    this.practiceT -= dt;
    if (alive < 8 && this.practiceT <= 0 && this.players.length) {
      this.practiceT = 0.8; const ref = this.players[0], kinds = ['astilla', 'geoda', 'prisma', 'lente', 'cuarzo', 'espejo', 'ariete', 'obelisco'], k = kinds[this.stats.spawned % kinds.length], def = MONSTERS[k];
      const pos = def.fly ? this.map.spawnAir(this.rng, ref.pos, ref.up) : this.map.spawnGround(this.rng, ref.pos);
      const m = this.spawnMonster(k, pos, { noElite: true }); if (m) { m.passive = true; m.hp = m.maxhp = Math.max(300, m.maxhp); if (k === 'geoda') m.open = true; }
    }
  }
  updateWaves(dt) {
    if (this.map.base) return stepBase(this);
    if (this.practice) return this.updatePractice(dt);
    const plan = WAVE_PLANS[this.mapId];
    if (this.phase === 'intermission') {
      const choosing = this.wave > 0 && this.players.some((p) => !p.dead && p.cards.length);
      if (!(choosing && this.players.length === 1 && this.phaseT <= 3.5)) this.phaseT -= dt; // en solitario la partida espera tu elección
      if (this.phaseT > 4 && this.wave > 0 && this.players.every((p) => !p.cards.length)) this.phaseT = 4; // todos eligieron su mejora
      if (this.phaseT <= 0) this.startWave(this.wave + 1, plan);
      return;
    }
    // fase 'wave': spawnear en goteo
    tickEventos(this, dt);
    this.spawnT -= dt;
    const cap = Math.min(LIMITS.monsters - 12, 44 + 10 * (this.players.length - 1));
    if (this.queue.length && this.spawnT <= 0 && this.monsters.length < cap) {
      this.spawnFromQueue();
      this.spawnT = this.spawnGap * this.director.gapScale();
    }
    if (this.director.wantsRelief()) { const a = this.alivePlayers(); if (a.length) this.dropPickup('hp', madd(a[0].pos, a[0].up, 2)); }
    if (this.queue.length > 3 && this.director.wantsSurge()) { const sp = this.curTypes.filter((t) => ['obelisco', 'aurora', 'espiral', 'graviton', 'cuarzo'].includes(t)); if (sp.length) { this.queue.splice(1, 0, this.rng.pick(sp), this.rng.pick(sp)); this.emit({ t: 'surge' }); } }
    // rezagados: si pasan 40 s sin bajas y quedan criaturas lejos, el Vórtice las "empuja" hacia los jugadores (evita oleadas eternas)
    const left = this.monsters.filter((m) => !m.dead && !m.def.boss);
    if (!this.queue.length && !this.omens.length && left.length && left.length === this.monsters.filter((m) => !m.dead).length) {
      this.straggleT = (this.straggleT || 0) + dt;
      if (this.straggleT > (left.length <= 4 ? 6 : 25)) {   // las últimas criaturas vienen a buscarte: nunca hay que salir a cazarlas por el mapa
        this.straggleT = 0; const ref = this.alivePlayers()[0];
        if (ref) for (const m of left) if (dist(m.pos, ref.pos) > 28) { m.pos = m.def.fly ? this.map.spawnAir(this.rng, ref.pos, ref.up) : this.map.spawnGround(this.rng, ref.pos); m.vel = v3(); this.emit({ t: 'blink', p: a3(m.pos) }); }
      }
    } else this.straggleT = 0;
    if (!this.queue.length && !this.omens.length && !this.monsters.some((m) => !m.dead) && !(this.objective && this.objective.state === 'active')) {
      if (this.wave >= this.waveTotal) { this.state = 'won'; this.emit({ t: 'won' }); return; }
      misionFin(this); finOleada(this);
      this.phase = 'intermission'; this.phaseT = this.players.length > 1 ? 22 : 12; this.objective = null;
      for (const p of this.players) p.cards = this.wave < this.waveTotal ? makeCards(this, p) : [];
      this.emit({ t: 'clear', wave: this.wave }); spawnNpc(this); dropsRespiro(this);
      for (const p of this.players) addCores(this, p, CORES.wave + this.wave * 2);
      for (const p of this.alivePlayers()) {
        p.hp = Math.min(PLAYER.hp, p.hp + 40 + (p.bn ? p.bn.heal : 0)); // respiro entre oleadas (+ bendición Raíz)
        this.dropPickup('hp', madd(p.pos, p.up, 2));
        for (const [i, w] of [p.slots[2], p.slots[1], p.slots[3]].entries()) this.dropPickup('ammo', madd(madd(p.pos, p.up, 2), p.heading, 4 + i), w);
      }
    }
  }

  startWave(n, plan) {
    clearNpc(this);
    this.wave = n; this.phase = 'wave'; this.spawnT = 1;
    for (const p of this.players) if (p.cards.length) { applyCard(p, p.cards[0], this); p.cards = []; } // quien no eligió, recibe la primera
    for (const p of this.players) { if (p.dead) this.revive(p); if (p.role === 'ingeniero' && !p.dead) { for (const w of [2, 1, 3]) this.dropPickup('ammo', madd(madd(p.pos, p.up, 1.5), p.heading, 2 + w), w); } }
    const n_pl = Math.max(1, this.players.length);
    this.queue = [];
    const isBoss = n === this.waveTotal;
    const types = plan[Math.min(n, plan.length) - 1]; this.curTypes = types;
    this.objective = isBoss ? null : makeObjective(this, n); this.objective0 = this.objective;
    iniciarMision(this, n, isBoss);
    let budget = (8 + 8 * n + 1.3 * n * n) * (1 + 0.6 * (n_pl - 1)) * this.difficulty;
    if (isBoss) { budget *= 0.45; this.queue.push(BOSS_OF[this.mapId]); }
    const cap = { geoda: 1 + Math.floor(n / 2), graviton: 1 + Math.floor(n / 3), cuarzo: 1 + Math.floor(n / 3), espejo: 2 + n, obelisco: 1 + Math.floor(n / 3), aurora: 1 + Math.floor(n / 3), espiral: 1 + Math.floor(n / 4), ariete: 1 + Math.floor(n / 2) };
    const counts = {};
    const SHOOT = { ranged: 2, sniper: 1.6, gravitron: 1.2 };   // los tiradores pesan más: no todo es melee
    const weights = types.map((t) => (SHOOT[MONSTERS[t].ai] || 1) / MONSTERS[t].cost);
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
    planOleada(this, n, isBoss);
    this.emit({ t: 'wave', n, boss: isBoss });
  }

  /** Oleada de castigo (objetivo fallido): suma criaturas extra a la cola. */
  surge(frac) {
    const types = this.curTypes.length ? this.curTypes : ['astilla']; let budget = (8 + 8 * this.wave + 1.3 * this.wave * this.wave) * frac * this.difficulty;
    let guard = 0; while (budget >= 1 && guard++ < 80) { const t = this.rng.pick(types); if (MONSTERS[t].cost <= budget && !MONSTERS[t].boss) { this.queue.push(t); budget -= MONSTERS[t].cost; } }
    this.spawnGap = Math.min(this.spawnGap, 0.6);
  }
  /** Las criaturas no aparecen de golpe: primero una señal (grieta/vibración, evento `omen`) y ~1,1 s después nacen. Nunca detrás del jugador ni pegadas a él. */
  spawnFromQueue() {
    const kind = this.queue.shift();
    const def = MONSTERS[kind];
    const ref = this.refPlayer();
    if (def.boss) { this.spawnMonster(kind, clone(this.map.bossAnchor)); return; }
    let pos = null;
    for (let i = 0; i < 8; i++) {
      pos = def.fly ? this.map.spawnAir(this.rng, ref.pos, ref.up) : this.map.spawnGround(this.rng, ref.pos);
      const to = sub(pos, ref.pos), l = len(to);
      if (l < 14) continue;                                                  // nunca encima del jugador
      if (dot(norm(project(to, ref.up)), ref.heading) < -0.35 && i < 7) continue; // ni a su espalda (salvo último intento)
      break;
    }
    const at = this.time + 1.1;
    this.omens.push({ kind, pos: clone(pos), at, k: kind });
    this.emit({ t: 'omen', k: kind, p: a3(pos), in: 1.1 });
  }
  updateOmens() {
    if (!this.omens.length) return;
    const keep = [];
    for (const o of this.omens) { if (this.time >= o.at) this.spawnMonster(o.kind, o.pos, { omen: true }); else keep.push(o); }
    this.omens = keep;
  }
  /** Arma al azar para un cofre de munición: de las ranuras de algún jugador vivo (no el Haz). */
  ammoPick() { const a = this.alivePlayers(), p = a.length ? a[Math.floor(this.rng.next() * a.length)] : this.players[0]; return p ? p.slots[1 + Math.floor(this.rng.next() * 4)] : 1; }
  refPlayer() {
    const a = this.alivePlayers();
    return a.length ? a[Math.floor(this.rng.next() * a.length)] : this.players[0];
  }

  spawnMonster(kind, pos, extra = {}) {
    if (this.monsters.length >= LIMITS.monsters) return null;
    const def = MONSTERS[kind];
    const w = Math.max(1, this.wave);
    const pm = def.boss ? 1 + 0.7 * (this.players.length - 1) : 1;
    let elite = !def.boss && !extra.noElite && w >= 3 && this.rng.next() < WAVE_SCALE.elite * (w - 2) * 0.5 + (this.evEliteBoost || 0);
    if (!elite && this.forceElite && !def.boss && !extra.noElite) elite = true; // misión «Caza mayor»: garantiza un élite
    if (elite) this.forceElite = false;
    const hp = def.hp * (def.boss ? 1 : (1 + WAVE_SCALE.hp * (w - 1)) * (elite ? 2.2 : 1)) * pm;
    const m = {
      id: this.nextId++, kind, def, pos: clone(pos), vel: v3(), up: v3(0, 1, 0), fwd: v3(0, 0, 1),
      hp, maxhp: hp, r: def.r, speedMul: (1 + WAVE_SCALE.speed * (w - 1)) * (elite ? 1.12 : 1), elite, t: 0, cd: this.rng.range(0.5, 2), cd2: this.rng.range(1, 3),
      state: 'idle', stateT: 0, dead: false, hurt: 0, kids: 0, parent: 0, far: 0, ...extra,
    };
    if (extra.affix && !def.boss) m.elite = true;
    if (!def.boss && this.evSpeedMul !== 1) m.speedMul *= this.evSpeedMul;   // Marea de Sangre: horda veloz
    if (m.elite && !def.boss) { m.affix = extra.affix || AFFIX_IDS[Math.floor(this.rng.next() * AFFIX_IDS.length)]; if (m.affix === 'veloz') m.speedMul *= 1.35; }
    this.monsters.push(m);
    if (def.boss) { this.boss = m; if (kind === 'coloso') initColoso(this, m); else if (kind === 'argos') initArgos(this, m); else initMadre(this, m); }
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

  /** Gravedad que siente `ent`. Durante una inversión pasa de +1 a −1 con una rampa suave (eventos.js factorFlip), no de golpe. */
  gravityFor(ent, flipUntil = 0, flipFrom = -1e9) {
    const g = this.map.gravityAt(ent.pos, this.time);
    if (this.time < flipUntil) return mul(len(g) > 0.1 ? g : mul(ent.up, -G), factorFlip(this.time, flipFrom, flipUntil));
    return g;
  }

  updatePlayer(p, dt) {
    const inp = p.input;
    if (this.base) baseSinArmas(inp);
    if (p.dead) { inp.dyaw = inp.dpitch = 0; p.abilityCd = Math.max(0, p.abilityCd - dt); if (inp.ping && !p.pingPrev) this.doPing(p); p.pingPrev = inp.ping; this.updateRevive(p, dt); return; }
    const g = this.gravityFor(p, p.flipUntil, p.flipFrom);
    const zero = len(g) < 0.5;
    if (!zero) p.up = norm(mul(g, -1));
    const up = p.up;
    // orientación: re-proyectar el rumbo al plano tangente y aplicar giro
    p.heading = norm(project(p.heading, up), norm(cross(up, v3(1, 0, 0)), v3(0, 0, 1)));
    if (inp.dyaw) p.heading = norm(rotAround(p.heading, up, -inp.dyaw));
    p.pitch = clamp(p.pitch + inp.dpitch, -1.5, 1.5);
    inp.dyaw = 0; inp.dpitch = 0;
    const right = cross(p.heading, up);
    const speed = PLAYER.speed * (inp.dash && !inp.crouch ? PLAYER.dash : 1) * speedMul(p) * arVel(this, p) * ngVel(this, p) * flVel(this, p) * (inp.crouch ? 0.55 : 1) * (inp.ads ? 0.8 : 1);
    let wish = add(mul(p.heading, inp.mz), mul(right, inp.mx));
    wish = ngDeforma(this, p, wish);   // niebla magenta: tuerce un poco el rumbo (no con «Reducir efectos»)
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
      if (inp.jump && p.grounded) nvu = PLAYER.jump * (p.jumpMul || 1);
      p.vel = madd(nvt, up, nvu);
      p.vel = madd(p.vel, g, dt * (this.time < (p.glideUntil || 0) ? 0.12 : 1));
      limitarCaida(this, p, g);   // tope de velocidad en la inversión + aterrizaje blando al terminar
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
    if (this.time - p.lastHurt > PLAYER.shieldDelay && p.shield < PLAYER.shield) p.shield = Math.min(PLAYER.shield, p.shield + PLAYER.shieldRate * (p.bn ? p.bn.shield : 1) * (hasC(p, 'corazon_cristal') ? 1.5 : 1) * dt);
    // armas
    if (inp.weapon >= 0) { p.weapon = inp.weapon < 5 ? p.slots[inp.weapon] : inp.weapon; inp.weapon = -1; }
    if (inp.pick >= 0) { if (p.cards.length) { applyCard(p, p.cards[inp.pick] || p.cards[0], this); p.cards = []; this.emit({ t: 'upgrade', pid: p.id }); } inp.pick = -1; }
    p.movCd = Math.max(0, p.movCd - dt); p.espCd = Math.max(0, p.espCd - dt);
    if (inp.mov && !p.movPrev && !this.evSilencio) useMove(this, p); p.movPrev = inp.mov;
    if (inp.esp && !p.espPrev && !this.evSilencio) useSpecial(this, p); p.espPrev = inp.esp;
    p.cd -= dt;
    p.abilityCd = Math.max(0, p.abilityCd - dt);
    p.interactEdge = inp.interact && !p.interactPrev; p.interactPrev = inp.interact;
    if (inp.ability && !p.abilityPrev && !this.evSilencio) useAbility(this, p); p.abilityPrev = inp.ability;
    if (inp.ping && !p.pingPrev) this.doPing(p); p.pingPrev = inp.ping;
    updateHost(this, p, dt); npcStep(this, p); if (this.base) baseStep(this, p);
    if (this.magazines) this.updateReload(p, dt);
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
    if (p.dead || dmg <= 0 || this.time < p.invulUntil) return;
    for (const o of this.objects) if (o.type === 'dome' && dist(p.pos, o.pos) < o.r) { dmg *= 0.6; break; }
    if (p.role === 'vanguardia') dmg *= 0.92;
    dmg *= ngRecibe(this, p);   // niebla ámbar: +30 % de daño recibido
    dmg *= flRecibe(this, p);   // Brote del Coro (flora): −20 % de daño unos segundos
    dmg = hostDamageIn(this, p, dmg); hostDamaged(this, p);
    this.director.hurt(dmg);
    p.lastHurt = this.time;
    const sh = Math.min(p.shield, dmg); p.shield -= sh; dmg -= sh;
    p.hp -= dmg;
    this.emit({ t: 'hurt', pid: p.id, dmg: r2(dmg + sh) }); misionHurt(this);
    if (p.hp <= 0 && p.kit > 0) { p.kit--; p.hp = PLAYER.hp * 0.5; p.shield = PLAYER.shield; p.invulUntil = this.time + 2; this.emit({ t: 'kit', pid: p.id }); return; }   // Botiquín inicial
    if (p.hp <= 0) { p.hp = 0; p.dead = true; p.respawnAt = this.time; p.bleed = PLAYER.bleed; p.lost = false; p.reviveT = 0; this.emit({ t: 'down', pid: p.id }); }
  }

  /* ─────────── armas ─────────── */
  /** Inicia la recarga del arma actual (si hace falta y hay reserva). */
  startReload(p) {
    const w = WEAPONS[p.weapon], cap = clipOf(p, p.weapon);
    if (!this.magazines || p.reloadT > 0 || p.dead) return false;
    if (Math.min(p.clip[p.weapon], cap) >= cap) return false;
    if (w.per > 0 && p.ammo[p.weapon] < w.per * (Math.min(p.clip[p.weapon], cap) + 1)) return false;   // no hay reserva fuera del cargador
    p.reloadT = reloadTime(p, p.weapon); p.reloadW = p.weapon; p.reloadTotal = p.reloadT;
    this.emit({ t: 'reload', pid: p.id, w: p.weapon, secs: r2(p.reloadT) });
    return true;
  }
  updateReload(p, dt) {
    const inp = p.input;
    if (inp.reload && !p.reloadPrev) this.startReload(p); p.reloadPrev = inp.reload;
    if (p.reloadT > 0) {
      if (p.reloadW !== p.weapon) { p.reloadT = 0; return; }                // cambiar de arma cancela
      p.reloadT -= dt;
      if (p.reloadT <= 0) { p.reloadT = 0; const w = WEAPONS[p.weapon], cap = clipOf(p, p.weapon); p.clip[p.weapon] = w.per > 0 ? Math.min(cap, Math.floor(p.ammo[p.weapon] / w.per)) : cap; this.emit({ t: 'reloaded', pid: p.id, w: p.weapon }); }
    } else if (this.magazines && p.clip[p.weapon] < 1 && !p.dead) this.startReload(p);   // recarga automática al vaciarse
  }
  firePlayer(p) {
    const w0 = WEAPONS[p.weapon], st = wstat(p, p.weapon);
    if (this.magazines) { if (p.reloadT > 0) return; if (p.clip[p.weapon] > clipOf(p, p.weapon)) p.clip[p.weapon] = clipOf(p, p.weapon); if (p.clip[p.weapon] < 1 && !(w0.per > 0 && p.ammo[p.weapon] < w0.per)) { this.startReload(p); return; } }
    if (w0.per > 0 && p.ammo[p.weapon] < w0.per) { // sin munición → Haz
      p.weapon = 0; return;
    }
    p.cd = Math.max(p.cd, -this.dt) + w0.rate / st.rate;
    if (st.forma === 'alba') { p.albaN = (p.albaN || 0) + 1; if (p.albaN % 5 === 0 && !p.dead) p.hp = Math.min(PLAYER.hp, p.hp + 4); } // arrastra el sobrante: la cadencia no se redondea al tick
    if (w0.per > 0) p.ammo[p.weapon] -= w0.per;
    if (this.magazines) p.clip[p.weapon]--;
    const origin = this.eyePos(p);
    const base = this.aimDir(p);
    const w = { ...w0, dmg: w0.dmg * st.dmg, mod: st.mod, pierce: w0.pierce || st.mod === 'perfora', chain: w0.chain || (st.mod === 'cadena' ? 2 : 0) };
    shapeWeapon(w, st); shapeOrgans(w, p, p.weapon); shapeItemGun(w, p, p.weapon); shapeArbolGun(w, p); shapeFauna(w, p);   // + nodos del árbol de disparo
    if (w.kind === 'pulse') { // onda radial sin apuntar
      for (const m of this.monsters) { if (m.dead) continue; const d = dist(m.pos, p.pos); if (d < w.radius + m.r) { this.damageMonster(m, w.dmg * (1 - 0.4 * d / (w.radius + m.r)), p, m.pos); m.vel = madd(m.vel, norm(sub(m.pos, p.pos)), w.knock); } }
      for (const ob of [...this.objects]) if (ob.hostile && ob.hp > 0 && dist(ob.pos, p.pos) < w.radius + ob.r) this.damageObject(ob, w.dmg, p, ob.pos);
      this.emit({ t: 'pulsar', pid: p.id, p: a3(p.pos), r: w.radius, w: p.weapon }); this.emit({ t: 'shot', pid: p.id, w: p.weapon, o: a3(origin) });
      return;
    }
    if (w.chaos) { const r = this.rng.next(); if (r < 0.25) w.chain = 3; else if (r < 0.5) w.slow = 3; else if (r < 0.75) w.burn = 14; else w.mod = 'explosiva'; w.fxk = r < 0.25 ? 'voltaico' : r < 0.5 ? 'glaciar' : r < 0.75 ? 'brasa' : 'explosiva'; }
    if (w.kind === 'mine') {
      this.addProjectile({ owner: 'p', pid: p.id, kind: 'mina', wid: p.weapon, pos: madd(origin, base, 1.5), vel: mul(base, w.speed), dmg: w.dmg, splash: w.splash, r: 0.5, life: 3, mine: true });
      this.emit({ t: 'shot', pid: p.id, w: p.weapon, o: a3(origin) }); return;
    }
    if (w.kind === 'projectile' || w.kind === 'swarm') {
      const n = w.kind === 'swarm' ? w.count : 1, right = cross(p.heading, p.up);
      for (let i = 0; i < n; i++) {
        let d = base;
        if (n > 1) d = norm(add(add(base, mul(right, (i - (n - 1) / 2) * 0.07)), mul(p.up, this.rng.gauss() * 0.03)));
        this.addProjectile({ owner: 'p', pid: p.id, kind: w.kind === 'swarm' ? 'swarm' : (w.id === 'lanza' ? 'lanza' : 'nova'), wid: p.weapon, pos: madd(origin, d, 1.5), vel: mul(d, w.speed), dmg: w.dmg, splash: w.splash || (st.mod === 'explosiva' ? 2.8 : 0), r: w.kind === 'swarm' ? 0.4 : 0.6, life: w.kind === 'swarm' ? 3.2 : 4, homing: w.homing || (w.kind === 'swarm' ? 3.2 : 0), well: w.well || 0, pierce: !!w.pierce, hit: w.pierce ? [] : null });
      }
      this.emit({ t: 'shot', pid: p.id, w: p.weapon, o: a3(origin) });
      return;
    }
    const right = cross(p.heading, p.up);
    const tips = [];
    for (let i = 0; i < w.pellets; i++) {
      let d = base;
      if (w.spread) { const sp = w.spread * (p.input.ads ? 0.35 : 1) * (p.input.crouch ? 0.8 : 1); d = norm(add(add(base, mul(right, this.rng.gauss() * sp)), mul(cross(base, right), this.rng.gauss() * sp))); }
      let wp = w; if (w.critP && this.rng.next() < w.critP) { wp = { ...w, dmg: w.dmg * 2.2, crit: true }; if (w.critRefund && w0.per > 0) p.ammo[p.weapon] = Math.min(ammoMax(p, p.weapon), p.ammo[p.weapon] + w0.per); }
      tips.push(this.hitscan(p, origin, d, wp));
    }
    this.emit({ t: 'shot', pid: p.id, w: p.weapon, o: a3(origin), to: tips.slice(0, 3).map(a3), fx: w.fxk || undefined });
  }

  /** Rayo: devuelve el punto final. Daña criaturas; las armas "pierce" atraviesan. */
  hitscan(p, o, d, w) {
    const hits = [];
    for (const m of this.monsters) {
      if (m.dead) continue;
      const oc = sub(m.pos, o), tca = dot(oc, d);
      if (tca < 0 || tca > w.range) continue;
      const d2 = dot(oc, oc) - tca * tca, rr = m.r * 1.05 + 0.35 + tca * 0.012; // margen de puntería: más generoso a distancia
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
      const at = madd(o, d, Math.max(0, h.t));
      if (h.ob) this.damageObject(h.ob, w.dmg, p, at);
      else {
        const dmgHit = w.exec && h.m.hp < h.m.maxhp * 0.35 ? w.dmg * w.exec : w.dmg;
        this.critNow = !!w.crit; this.pierceNow = !!w.armorBreak;
        this.damageMonster(h.m, dmgHit, p, at);
        this.critNow = false; this.pierceNow = false;
        if (!h.m.dead) this.applyStatus(h.m, w, p);
        if (w.lifesteal && p && !p.dead) p.hp = Math.min(PLAYER.hp, p.hp + w.dmg * w.lifesteal);
        if (w.knock && !h.m.dead) h.m.vel = madd(h.m.vel, d, w.knock);
        if (w.stormSlow) h.m.slowUntil = this.time + 2.5;
        if (w.pullHit) for (const q of this.monsters) if (!q.dead && q !== h.m && !q.def.boss && dist(q.pos, at) < w.pullHit + q.r) q.vel = madd(q.vel, norm(sub(at, q.pos)), 5);
        if (w.chain && !w.noChain) this.chainFrom(p, h.m, w);
        if (w.mod === 'explosiva' && w.kind === 'hitscan') { this.explode(at, w.blast || 2.6, 0, w.dmg * 0.5, p, false); if (w.pull) for (const q of this.monsters) if (!q.dead && !q.def.boss && dist(q.pos, at) < w.pull + q.r) q.vel = madd(q.vel, norm(sub(at, q.pos)), 9); }
      }
      if (!w.pierce) { tEnd = h.t; break; }
    }
    floraRayo(this, o, d, tEnd, w, p);   // flora interactiva: las plantas reciben el disparo (y su elemento) pero NO lo frenan
    for (const h of arTargets(this, o, d, w.range)) if (h.t <= tEnd + 0.01) danarOrgano(this, h.ar, w.dmg, p, madd(o, d, Math.max(0, h.t)));   // órganos de la arena viva: reciben el disparo pero NO lo frenan (no tapan a las criaturas)
    return madd(o, d, Math.max(0.5, Math.min(tEnd, w.range)));
  }

  /** Estados de las armas: ralentizar (hielo), veneno y fuego (daño continuo). */
  applyStatus(m, w, p) {
    if (w.slow && !m.def.boss) m.slowUntil = this.time + w.slow;
    const dps = w.poison || w.burn;
    if (dps) { m.dotUntil = this.time + (w.poison ? 5 : 4); m.dotDps = dps * (p ? wstat(p, p.weapon).dmg : 1); m.dotBy = p ? p.id : 0; m.dotKind = w.poison ? 'poison' : 'burn'; }
  }
  /** Arco de energía: el daño salta a las criaturas más cercanas (Fractal / mejora Cadena). */
  chainFrom(p, from, w) {
    const used = new Set([from.id]); let cur = from;
    for (let i = 0; i < w.chain; i++) {
      let best = null, bd = 15; for (const m of this.monsters) { if (m.dead || used.has(m.id)) continue; const d = dist(m.pos, cur.pos); if (d < bd) { bd = d; best = m; } }
      if (!best) break; used.add(best.id); this.damageMonster(best, w.dmg * 0.7, p, best.pos); if (w.stormSlow) best.slowUntil = this.time + 2.5; this.emit({ t: 'arc', o: a3(cur.pos), to: a3(best.pos) }); cur = best;
    }
  }
  addProjectile(pr) {
    if (this.projectiles.length >= LIMITS.projectiles) this.projectiles.shift();
    pr.id = this.nextId++; pr.age = 0; if (this.dmgSrc === 'skill' && pr.owner === 'p') pr.src = 'skill';
    this.projectiles.push(pr);
    return pr;
  }

  /* ─────────── criaturas ─────────── */
  damageMonster(m, dmg, by, at) {
    if (m.dead) return;
    let mul_ = 1;
    if (m.kind === 'geoda') mul_ = m.open ? 1 : (this.pierceNow ? 0.7 : 0.2);
    if (m.kind === 'madre') mul_ = m.open ? 1 : 0.15;
    if (m.kind === 'espejo') { m.cloak = false; m.reveal = 2.2; }
    if (m.stun) mul_ *= 1.5;
    if (m.affix === 'blindado') mul_ *= 0.6;
    if (m.affix === 'espectral' && this.time < (m.ghostUntil || 0)) mul_ *= 0.05;
    if (m.kind === 'coloso' || m.kind === 'argos') { if (m.shield) mul_ *= BOSS_MECH.shield; if (m.stagger > 0) mul_ *= BOSS_MECH.stagger; }
    if (this.time < (m.markUntil || 0)) mul_ *= m.markMul || 1.3;
    if (by && by.input) { mul_ *= hostOut(this, by, m); if (this.time < (m.dotUntil || 0) && m.dotKind === 'poison' && anyMut(by, 'neurotoxina')) mul_ *= 1.2; }
    if (by && this.time < this.teamBuffUntil) mul_ *= 1.25;
    if (by && by.input && this.evZona && dist(by.pos, this.evZona.pos) < this.evZona.r) mul_ *= 1.3;   // Bendición de la Aurora
    if (by && by.input) mul_ *= arDanio(this, by);   // Iris de Espejo / Costillar (arenas vivas)
    if (by && by.input) mul_ *= ngDanio(this, by);   // nieblas ámbar y magenta: daño que hace el jugador de adentro
    mul_ *= ngMonstruoRecibe(this, m, by);           // niebla ámbar: la criatura de adentro también recibe +30 % · niebla blanca: disparar desde adentro te delata
    if (this.time < (m.shieldUntil || 0)) mul_ *= 0.5;
    m.hp -= dmg * mul_; m.hurt = 0.12;
    if (by && by.input) { hostHit(this, by, m, dmg * mul_); if (wstat(by, by.weapon).forma === 'ocaso' && this.time >= (m.markUntil || 0) - 2.5) { m.markUntil = this.time + 3; m.markMul = 1.15; } }
    if (m.affix === 'llorón' && !m.dead && this.time >= (m.weepAt || 0) && (m.kids || 0) < 3) { m.weepAt = this.time + 3; const k = this.spawnMonster('astilla', madd(m.pos, norm(this.rng.unit()), 3), { parent: m.id, noElite: true }); if (k) m.kids = (m.kids || 0) + 1; }
    this.emit({ t: 'hit', id: m.id, p: a3(at || m.pos), d: r2(dmg * mul_), arm: mul_ < 1, cr: this.critNow || undefined });
    if (m.hp <= 0) this.killMonster(m, by);
  }

  killMonster(m, by) {
    if (m.dead) return;
    m.dead = true; this.stats.kills++; this.straggleT = 0; arKill(this, m);   // alimenta a las Bocas cercanas (arenas vivas)
    if (by && by.input) hostKill(this, by, m);
    if (by) { by.kills++; by.score += m.def.score; if (wstat(by, by.weapon).mod === 'vampirica' && !by.dead) { const mu = wstat(by, by.weapon).mut; by.hp = Math.min(PLAYER.hp, by.hp + (mu === 'simbiosis' ? 10 : 6)); if (mu === 'simbiosis') by.shield = Math.min(PLAYER.shield, by.shield + 8); if (mu === 'parasito') { const w0 = WEAPONS[by.weapon]; if (w0.per > 0) by.ammo[by.weapon] = Math.min(ammoMax(by, by.weapon), by.ammo[by.weapon] + w0.per * 3); } }
      if (m.dotKind === 'poison' && this.time < (m.dotUntil || 0) && anyMut(by, 'plaga')) for (const q of this.monsters) if (!q.dead && q !== m && dist(q.pos, m.pos) < 9) { q.dotUntil = this.time + 4; q.dotDps = 6; q.dotKind = 'poison'; q.dotBy = by.id; } }
    if (m.parent) { const par = this.monsters.find((q) => q.id === m.parent); if (par) par.kids = Math.max(0, par.kids - 1); }
    this.emit({ t: 'kill', id: m.id, k: m.kind, p: a3(m.pos) }); misionKill(this, m, by);
    if (m.kind === 'racimo') this.explode(m.pos, 5.5, 22, 40, null);
    if (m.affix === 'explosivo') this.explode(m.pos, 6, 28, 30, null);
    if (m.def.boss) { // al caer el corazón del vórtice todo lo demás se hace añicos
      this.queue = []; this.omens = []; bossDeath(this); dropsJefe(this, m.pos);
      for (const o of this.monsters) if (!o.dead && o !== m) { o.dead = true; this.emit({ t: 'kill', id: o.id, k: o.kind, p: a3(o.pos) }); }
      return;
    }
    dropsKill(this, by, m);   // élites y geodas pueden soltar objetos (drops.js)
    const lowHp = this.players.some((p) => !p.dead && p.hp < 55);
    if (this.rng.next() < (lowHp ? 0.3 : 0.18)) {
      if (lowHp && this.rng.next() < 0.6) this.dropPickup('hp', m.pos);
      else this.dropPickup('ammo', m.pos, this.ammoPick());
    }
    if (m.kind === 'geoda') { if (this.rng.next() < 0.6) this.dropPickup('hp', m.pos); this.dropPickup('ammo', m.pos, this.ammoPick()); }
  }

  /** Daño en área: a jugadores (pd) y criaturas (md). */
  explode(pos, radius, pd, md, by, hurtPlayers = true) {
    this.emit({ t: 'boom', p: a3(pos), r: radius }); if (by) arExplosion(this, pos, radius, md, by); floraExplosion(this, pos, radius, md, by);
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
    if (m.affix === 'espectral') { if (this.time > (m.ghostNext || 0)) { m.ghostUntil = this.time + 1.2; m.ghostNext = this.time + 4; } }
    const ts = this.map.timeScaleAt(m.pos);
    const slowed = this.time < (m.slowUntil || 0) && !m.def.boss;
    const dtm = dt * ts * (slowed ? 0.5 : 1) * (this.time < (m.chronoUntil || 0) && !m.def.boss ? 0.25 : 1) * (m.def.boss ? BOSS_PACE : MONSTER_PACE);
    if (this.time < (m.dotUntil || 0)) { // veneno / fuego: daño continuo
      m.hp -= m.dotDps * dt; m.hurt = Math.max(m.hurt, 0.05);
      if (m.hp <= 0) { this.killMonster(m, this.players.find((q) => q.id === m.dotBy) || null); return; }
    }
    m.t += dtm; m.hurt = Math.max(0, m.hurt - dt);
    const targets = this.alivePlayers().filter((q) => (this.time >= (q.cloakUntil || 0) || dist(q.pos, m.pos) < 6) && !ngOculta(this, q, m));   // camuflaje: te pierden salvo muy cerca
    if (m.passive && targets.length) { const d = sub(targets[0].pos, m.pos), up = m.up || v3(0, 1, 0); m.fwd = norm(project(d, up), m.fwd); }
    else if (targets.length) AI[m.def.ai](this, m, dtm, targets);
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
      this.dmgSrc = pr.src || null;
      if (pr.owner === 'm' && (this.objects.some((o) => o.type === 'dome' && dist(pr.pos, o.pos) < o.r) || inWall(this, pr.pos))) { this.emit({ t: 'splat', p: a3(pr.pos) }); continue; }
      const ts = pr.owner === 'm' ? this.map.timeScaleAt(pr.pos) * (inChrono(this, pr.pos) ? 0.25 : 1) : 1;
      pr.age += dt; pr.life -= dt;
      if (pr.accel) pr.vel = madd(pr.vel, norm(pr.vel), pr.accel * dt * ts);
      if (pr.homing && pr.owner === 'p') { // teledirigido: gira hacia la criatura más cercana delante
        let best = null, bd = 60; for (const m of this.monsters) { if (m.dead) continue; const d = dist(m.pos, pr.pos); if (d < bd && dot(norm(sub(m.pos, pr.pos)), norm(pr.vel)) > 0.2) { bd = d; best = m; } }
        if (best) { const sp = len(pr.vel); pr.vel = mul(norm(madd(pr.vel, norm(sub(best.pos, pr.pos)), pr.homing * sp * dt)), sp); }
      }
      const n = Math.max(1, Math.ceil((len(pr.vel) * dt * ts) / 0.9)); // proyectiles rápidos: sub-pasos para no atravesar
      let dead = false, hitP = null;
      for (let k = 0; k < n && !dead; k++) {
        pr.pos = madd(pr.pos, pr.vel, (dt * ts) / n);
        if (blocked(this.map, pr.pos)) { dead = true; hitP = 'solid'; }
        else if (pr.owner === 'm') { for (const p of this.players) if (!p.dead && dist(p.pos, pr.pos) < PLAYER.radius + pr.r) { this.hurtPlayer(p, pr.dmg); dead = true; hitP = 'player'; this.emit({ t: 'splat', p: a3(pr.pos) }); break; } }
        else if (pr.pierce) { for (const m of this.monsters) if (!m.dead && !pr.hit.includes(m.id) && dist(m.pos, pr.pos) < m.r + pr.r) { pr.hit.push(m.id); this.damageMonster(m, pr.dmg, this.players.find((q) => q.id === pr.pid), m.pos); } }
        else { for (const m of this.monsters) if (!m.dead && dist(m.pos, pr.pos) < m.r + pr.r + (pr.owner === 'p' ? 0.5 : 0)) { dead = true; hitP = 'monster'; break; } }
      }
      dead = dead || pr.life <= 0 || !finite(pr.pos) || this.map.outOfBounds(pr.pos);
      const owner = this.players.find((q) => q.id === pr.pid);
      if (dead && pr.owner === 'p') {
        if (pr.mine) { const mine = this.objects.filter((o) => o.type === 'mine' && o.owner === pr.pid); if (mine.length >= 6) this.removeObject(mine[0]); this.addObject('mine', pr.pos, { life: 25, r: 5, dmg: pr.dmg, splash: pr.splash, owner: pr.pid, arm: 0.6 }); this.emit({ t: 'minePlace', p: a3(pr.pos) }); }
        else if (pr.well) { this.addObject('well', pr.pos, { life: pr.well, r: 2, dmg: pr.dmg, splash: pr.splash || 7, owner: pr.pid, src: pr.src }); this.emit({ t: 'well', p: a3(pr.pos) }); }
        else if (hitP === 'monster' && !pr.pierce) this.explode(pr.pos, pr.splash || 0.1, 0, pr.dmg, owner, false);
        else if (hitP === 'solid') { if (pr.splash) this.explode(pr.pos, pr.splash, 0, pr.dmg, owner, false); else this.emit({ t: 'splat', p: a3(pr.pos) }); }
        else if (pr.life <= 0 && pr.splash) this.explode(pr.pos, pr.splash, 0, pr.dmg, owner, false);
        if (pr.cluster) for (let i = 0; i < pr.cluster; i++) { const dd = this.rng.unit(); this.addProjectile({ owner: 'p', pid: pr.pid, kind: 'nova', pos: clone(pr.pos), vel: mul(dd, 26), dmg: 45, splash: 3.2, r: 0.4, life: 0.5 }); }
      } else if (dead && hitP === 'monster') this.explode(pr.pos, pr.splash, 0, pr.dmg, owner, false);
      else if (dead && hitP === 'solid') { if (pr.splash) this.explode(pr.pos, pr.splash, 0, pr.dmg, owner, false); else this.emit({ t: 'splat', p: a3(pr.pos) }); }
      if (!dead) keep.push(pr);
    }
    this.projectiles = keep; this.dmgSrc = null;
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
    else { const wid = p.slots.includes(k.w) && k.w > 0 ? k.w : p.slots[1 + Math.floor(this.rng.next() * 4)], w = WEAPONS[wid], mx = ammoMax(p, wid); if (p.ammo[wid] >= mx) return; p.ammo[wid] = Math.min(mx, p.ammo[wid] + Math.ceil(mx * 0.4)); }
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
    if (o.type === 'capullo') return feedCapullo(this, o, dmg, by, at); // se alimenta, no se rompe
    o.hp -= dmg; this.emit({ t: 'hit', id: o.id, p: a3(at || o.pos), d: r2(dmg), arm: false });
    if (o.hp <= 0 && o.type === 'ojo') { this.emit({ t: 'ojobreak', p: a3(o.pos) }); this.removeObject(o); this.dropPickup('hp', o.pos); return; }
    if (o.hp <= 0 && o.type === 'sac') {
      this.emit({ t: 'sacbreak', p: a3(o.pos) }); this.removeObject(o);
      this.dropPickup('ammo', o.pos, this.ammoPick()); if (this.rng.next() < 0.5) this.dropPickup('hp', o.pos);
    }
  }
  updateObjects(dt) {
    try { this.updateObjects0(dt); } finally { this.dmgSrc = null; }
  }
  updateObjects0(dt) {
    for (const o of [...this.objects]) {
      this.dmgSrc = null;
      if (hostObject(this, o, dt)) continue;
      if (o.type === 'dome') { o.life -= dt; if (o.life <= 0) this.removeObject(o); }
      else if (o.type === 'turret') {
        o.life -= dt; o.cd -= dt;
        if (o.life <= 0) { this.removeObject(o); continue; }
        if (o.cd <= 0) {
          let best = null, bd = 35;
          for (const m of this.monsters) { if (m.dead) continue; const d = dist(m.pos, o.pos); if (d < bd) { bd = d; best = m; } }
          if (best) { const by = this.players.find((q) => q.id === o.owner); this.damageMonster(best, 12, by || null, best.pos); this.emit({ t: 'tshot', o: a3(o.pos), to: a3(best.pos) }); o.cd = 0.26; } else o.cd = 0.3;
        }
      } else if (o.type === 'mine') {
        o.life -= dt; o.arm -= dt;
        if (o.life <= 0) { this.removeObject(o); continue; }
        if (o.arm <= 0 && this.monsters.some((m) => !m.dead && dist(m.pos, o.pos) < o.r + m.r)) { this.removeObject(o); this.explode(o.pos, o.splash, 0, o.dmg, this.players.find((q) => q.id === o.owner), false); }
      } else if (o.type === 'well') {
        this.dmgSrc = o.src || null;
        o.life -= dt;
        for (const m of this.monsters) { if (m.dead || m.def.boss) continue; const d = dist(m.pos, o.pos); if (d < 16 && d > 0.8) m.vel = madd(m.vel, norm(sub(o.pos, m.pos)), 40 * dt); }
        if (o.life <= 0) { this.removeObject(o); this.explode(o.pos, o.splash, 0, o.dmg * 2, this.players.find((q) => q.id === o.owner), false); }
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
      for (const ob of this.objects) { if (ob.type === 'dome' || ob.type === 'turret' || ob.type === 'zangano' || ob.type === 'nido' || ob.type === 'reina') continue; const oc = sub(ob.pos, o), t = dot(oc, d); if (t < 0 || t > bt) continue; const d2 = dot(oc, oc) - t * t, rr = ob.r + 1.8; if (d2 < rr * rr) { bt = t; bo = ob; } }
      if (bo) { kind = 'obj'; pos = clone(bo.pos); label = bo.type; }
    }
    if (!pos) { let t = 1.5; for (; t < 120; t += 1.5) if (blocked(this.map, madd(o, d, t))) break; pos = madd(o, d, Math.min(t, 120) - 0.5); }
    this.pings = this.pings.filter((q) => q.pid !== p.id || q.until > this.time + 3); // máx. 2 por jugador
    this.pings.push({ id: this.nextId++, pid: p.id, k: kind, label, pos, until: this.time + 7 });
    this.emit({ t: 'ping', pid: p.id, k: kind, p: a3(pos) });
  }

  /* ─────────── snapshot (lo que ve el cliente) ─────────── */
  drainEvents() { const e = this.events; this.events = []; return e; }

  clipSnap(p) {
    if (!this.magazines) return {};
    const w = WEAPONS[p.weapon], cap = clipOf(p, p.weapon), cl = Math.min(p.clip[p.weapon], cap);
    return { cl, cm: cap, rs: w.per > 0 ? Math.max(0, Math.floor(p.ammo[p.weapon] / w.per) - cl) : -1, rl: p.reloadT > 0 ? r2(1 - p.reloadT / (p.reloadTotal || 1)) : 0 };
  }
  snapshot() {
    const boss = this.monsters.find((m) => m.def.boss && !m.dead);
    return {
      tick: this.tick, time: r2(this.time), map: this.mapId, state: this.state, phase: this.phase,
      wave: this.wave, waveTotal: this.waveTotal, left: this.queue.length + this.omens.length + this.monsters.length, om: this.omens.map((o) => [...a3(o.pos), o.k, r2(o.at - this.time)]), intermission: r2(Math.max(0, this.phaseT)),
      fx: this.map.fx(this.time),
      boss: boss ? { hp: Math.round(boss.hp), max: Math.round(boss.maxhp), name: boss.def.name, shield: !!boss.shield, stagger: r2(boss.stagger || 0), pressure: r2(boss.pressure || 0), ray: boss.ray ? r2(boss.ray.t) : 0, eyes: boss.eyesAlive || 0, gaze: boss.gaze ? r2(boss.gaze.t) : 0 } : null,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, pos: a3(p.pos), up: a3(p.up), h: a3(p.heading), pitch: r2(p.pitch), hp: Math.round(p.hp), sh: Math.round(p.shield),
        dead: p.dead, rv: r2(p.reviveT), role: p.role, ab: r2(p.abilityCd / ROLES[p.role].cd), carry: p.carry, bleed: r2(Math.max(0, p.bleed)), lost: p.lost, char: p.char, ...hostSnap(this, p), ...faunaPlayerSnap(this, p), ...itemsSnap(this, p), ...this.clipSnap(p), ...orgSnap(p), sl: p.slots, ug: p.slots.map((w) => { const u = p.upg[w]; return u ? [u.dmg, u.rate, u.mag, u.mod, u.mut, u.forma || null] : 0; }), cards: p.cards.map((c) => [c.w, c.k, c.forma || c.mut || c.mod || c.id || '', c.mod || c.t || '']), mv: r2(p.movCd / (CHARACTERS[p.char] ? CHARACTERS[p.char].mov.cd : 1)), es: r2(p.espCd / (CHARACTERS[p.char] ? CHARACTERS[p.char].esp.cd : 1)), w: p.weapon, ammo: p.ammo.map((a) => (a === Infinity ? -1 : a)), kills: p.kills, score: p.score, flip: this.time < p.flipUntil, ads: p.input.ads ? 1 : 0, cr: p.input.crouch ? 1 : 0,
      })),
      monsters: this.monsters.map((m) => ({
        id: m.id, k: m.kind, p: a3(m.pos), u: a3(m.up), f: a3(m.fwd), hp: Math.round(m.hp), mh: Math.round(m.maxhp), r: m.r,
        s: m.vis || m.state, o: !!m.open, pr: r2(m.pressure || 0), mk: this.time < (m.markUntil || 0), c: !!m.cloak, el: !!m.elite, af: m.affix || undefined, ef: (this.time < (m.slowUntil || 0) ? 1 : 0) | (this.time < (m.dotUntil || 0) ? (m.dotKind === 'poison' ? 2 : 4) : 0), h: m.hurt > 0, t: r2(m.t), a: m.aim ? a3(m.aim) : null, sd: this.time < (m.shieldUntil || 0) || !!m.shield, st: !!m.stun || (m.stagger || 0) > 0,
      })),
      projectiles: this.projectiles.map((q) => ({ id: q.id, k: q.kind, o: q.owner, p: a3(q.pos), v: a3(q.vel), r: q.r })),
      pickups: this.pickups.map((k) => ({ id: k.id, t: k.type, w: k.w, p: a3(k.pos) })),
      ...(this.loot.length ? { lt: lootSnap(this) } : {}),
      objs: this.objects.map((o) => ({ id: o.id, t: o.type, p: a3(o.pos), r: o.r, s: o.state || (o.on ? 'on' : 'off'), v: r2(o.v || 0), hp: Math.round(o.hp || 0), mx: Math.round(o.maxhp || 0), c: o.carrier || 0, nk: o.kind || undefined, ow: o.owner || 0, l: r2(o.life || 0) })),
      obj: this.objective ? { type: this.objective.type, title: this.objective.title, desc: this.objective.desc, prog: r2(this.objective.prog), left: r2(Math.max(0, this.objective.limit - this.objective.t)), state: this.objective.state, tg: puntoObjetivo(this) } : null,
      mis: misionSnap(this),
      pings: this.pings.map((q) => ({ id: q.id, pid: q.pid, k: q.k, l: q.label, p: a3(q.pos), left: r2(q.until - this.time) })),
      ev: evSnap(this), ar: arSnap(this), ng: ngSnap(this), fl: flSnap(this), fa: faunaSnap(this),
      dir: { stress: r2(this.director.stress), frag: this.fragments, buff: r2(Math.max(0, this.teamBuffUntil - this.time)) },
      events: this.drainEvents(),
    };
  }
}
export { MAPS };
