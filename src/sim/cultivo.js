// Acertijo del Mapa 4 (Jardín de Carne): CULTIVO — «alimentar capullos para hacer crecer un puente vivo».
//
// Reglas (todas visibles en el juego, ver cliente env/map4-objs.js):
//  · Hay 3 capullos repartidos por el jardín (El Vivero, La Garganta, El Mirador). Se alimentan DISPARÁNDOLES: cada impacto
//    suma nutrición (daño/900, tope 50 por impacto → unos 40 tiros de Haz). Se ven más brillantes y abiertos cuanto más comen.
//  · Sin comer (4 s) el capullo se marchita despacio, y las criaturas terrestres cercanas lo ROEN (más rápido). Hay que defenderlos.
//  · Al llegar a 100 % el capullo FLORECE (queda fijo) y hace crecer el siguiente tramo del puente que une la Cámara del Latido
//    con el Umbral (isla del este). Un tramo = unos 7 discos de tejido; tarda 5 s en crecer. Los tramos crecen en orden.
//  · Mientras el puente no esté completo, el Umbral es INALCANZABLE (los discos todavía no son sólidos: se ve el «fantasma»).
//  · Con el puente completo, el Umbral queda abierto: aparece el cofre del Umbral y la oleada 5 trae el Núcleo de memoria al altar.
//  · Pistas opcionales: tras 45 s sin que ningún capullo coma, un marcador señala el capullo más cercano; a los 90 s otra pista
//    explica la regla; a los 135 s se marca dónde nacerá el puente (cada pista, 45 s después de la anterior).
// Estado en `g.cult` (por partida): { open, blooms, secOn[], secG[], spots[], puentes[] }.
import { dropsCofre } from './drops.js';   // capullo florecido → cofre (docs/INVENTARIO.md)
import { v3, dist, clone, clamp } from './math.js';

export const CULT = { gainDiv: 900, maxHit: 50, meleeHit: 0.06, decay: 0.02, decayAfter: 4, gnaw: 0.05, gnawR: 5.5, growSecs: 5, hint: 45, hintMax: 3 };

export function initCult(g) {
  const map = g.map, n = map.layout.sections.length;
  const c = { open: false, blooms: 0, secOn: Array(n).fill(false), secG: Array(n).fill(0), spots: map.spots.capullos.map((p, i) => ({ i, pos: p, bloom: false })), puentes: [], hintT: 0, hintLvl: 0 };
  map.layout.sections.forEach((s, k) => {
    const o = g.addObject('puente', v3(s.c.x, s.c.y, s.c.z), { r: 9, v: 0, state: 'ghost', objective: true, sec: k });
    c.puentes.push(o.id);
  });
  return c;
}
const puente = (g, k) => g.objects.find((o) => o.id === g.cult.puentes[k]);

/** Crea los capullos que falten (los ya florecidos se quedan como flores). */
export function startCultivo(g, o) {
  const c = g.cult;
  for (const sp of c.spots) {
    if (sp.bloom) continue;
    const ob = g.addObject('capullo', clone(sp.pos), { hp: 1000, maxhp: 1000, r: 2.2, hostile: true, objective: true, nut: 0, v: 0, spot: sp.i, fedT: g.time, gnawT: 0 });
    o.ids.push(ob.id);
  }
  o.noProg = 0; o.hintLvl = 0; c.hintT = 0;
}

/** Un impacto sobre un capullo (llamado desde Game.damageObject). */
export function feedCapullo(g, ob, dmg, by, at) {
  if (ob.on || !g.cult) return;
  // Un golpe cuerpo a cuerpo (daño ≈ 35, más lento y arriesgado) alimentaba la mitad que un tiro del Haz: en Melé el Cultivo era casi imposible
  // (los bichos roen más rápido de lo que se alimenta). Ahora un golpe vale como un tiro a tope.
  const gain = Math.max(clamp(dmg, 0, CULT.maxHit) / CULT.gainDiv, by && by.inMelee ? CULT.meleeHit : 0);
  ob.nut = Math.min(1, ob.nut + gain); ob.v = ob.nut; ob.fedT = g.time;
  if (g.objective && g.objective.type === 'cultivo') { g.objective.noProg = 0; g.objective.hintLvl = 0; }
  g.emit({ t: 'feed', id: ob.id, p: [ob.pos.x, ob.pos.y, ob.pos.z], v: Math.round(ob.nut * 100) / 100, at: at ? [at.x, at.y, at.z] : undefined });
  if (ob.nut >= 1) bloom(g, ob, by);
}
function bloom(g, ob, by) {
  const c = g.cult, sp = c.spots[ob.spot];
  ob.on = true; ob.hostile = false; ob.v = 1; ob.nut = 1; sp.bloom = true;
  const k = c.blooms++; c.secOn[k] = true;
  const pu = puente(g, k); if (pu) pu.state = 'grow';
  if (g.objective && g.objective.type === 'cultivo') g.objective.ids = g.objective.ids.filter((id) => id !== ob.id);
  if (by) by.score += 150;
  g.emit({ t: 'bloom', id: ob.id, k, n: c.spots.length, p: [ob.pos.x, ob.pos.y, ob.pos.z] });
  dropsCofre(g, ob.pos);   // el capullo florecido es un cofre (drops.js)
}

/** Cada cuadro: marchitar/roer capullos, hacer crecer el puente. Vive fuera del objetivo: el puente sigue creciendo y es permanente. */
export function tickCultivo(g, dt) {
  const c = g.cult; if (!c) return;
  for (const ob of g.objects) {
    if (ob.type !== 'capullo' || ob.on) continue;
    if (g.time - ob.fedT > CULT.decayAfter) ob.nut = Math.max(0, ob.nut - CULT.decay * dt);
    let near = 0;
    for (const m of g.monsters) if (!m.dead && !m.def.fly && !m.def.boss && Math.hypot(m.pos.x - ob.pos.x, m.pos.z - ob.pos.z) < CULT.gnawR && Math.abs(m.pos.y - ob.pos.y) < 4) near++;
    if (near && ob.nut > 0) {
      ob.nut = Math.max(0, ob.nut - Math.min(3, near) * CULT.gnaw * dt); ob.gnawT -= dt;
      if (ob.gnawT <= 0) { ob.gnawT = 1.4; g.emit({ t: 'gnaw', id: ob.id, p: [ob.pos.x, ob.pos.y, ob.pos.z] }); }
    }
    ob.v = ob.nut;
  }
  // crecimiento (en orden, un tramo a la vez)
  let adv = false;
  for (let k = 0; k < c.secOn.length; k++) {
    if (!c.secOn[k] || c.secG[k] >= 1) continue;
    if (!adv) {
      adv = true; const was = c.secG[k];
      c.secG[k] = Math.min(1, c.secG[k] + dt / CULT.growSecs);
      if (was === 0) g.emit({ t: 'bridge', ph: 'start', k, p: [g.map.layout.sections[k].c.x, g.map.layout.sections[k].c.y, g.map.layout.sections[k].c.z] });
      if (c.secG[k] >= 1) g.emit({ t: 'bridge', ph: 'sec', k, p: [g.map.layout.sections[k].c.x, g.map.layout.sections[k].c.y, g.map.layout.sections[k].c.z] });
    }
  }
  let discs = 0;
  g.map.layout.sections.forEach((s, k) => { discs += Math.floor(c.secG[k] * s.ids.length + 1e-9); });
  g.map.growTo(discs);
  c.puentes.forEach((id, k) => { const o = g.objects.find((x) => x.id === id); if (o) { o.v = c.secG[k]; o.state = c.secG[k] >= 1 ? 'done' : c.secOn[k] ? 'grow' : 'ghost'; } });
  if (!c.open && c.secG.every((x) => x >= 1)) {
    c.open = true;
    const u = g.map.spots.altar;
    g.emit({ t: 'bridge', ph: 'open', p: [u.x, u.y, u.z] });
    // cofre del Umbral: premio por abrir el camino
    g.dropPickup('hp', v3(u.x - 3, u.y + 1.2, u.z + 2)); g.dropPickup('ammo', v3(u.x + 3, u.y + 1.2, u.z + 2), g.ammoPick()); g.dropPickup('ammo', v3(u.x, u.y + 1.2, u.z + 4), g.ammoPick());
  }
}

/** Dentro del objetivo «cultivo»: progreso, pistas y fin. Devuelve true cuando el puente está completo. */
export function cultivoObjective(g, o, dt) {
  const c = g.cult; if (!c) return false;
  let nut = 0; for (const sp of c.spots) { if (sp.bloom) nut += 1; else { const ob = g.objects.find((x) => x.type === 'capullo' && x.spot === sp.i); if (ob) nut += ob.nut; } }
  const grow = c.secG.reduce((a, b) => a + b, 0) / c.secG.length;
  o.prog = clamp((nut / c.spots.length) * 0.7 + grow * 0.3, 0, 1);
  // pistas progresivas (sólo si nada avanza)
  o.noProg = (o.noProg || 0) + dt;
  if ((o.hintLvl || 0) < CULT.hintMax && o.noProg >= CULT.hint && !c.secOn.some((on, k) => on && c.secG[k] < 1)) {
    o.hintLvl = (o.hintLvl || 0) + 1; const lvl = o.hintLvl;
    const al = g.alivePlayers(), ref = al.length ? al[0].pos : g.map.center;
    let tgt = null, bd = Infinity;
    for (const ob of g.objects) if (ob.type === 'capullo' && !ob.on) { const d = dist(ob.pos, ref); if (d < bd) { bd = d; tgt = ob; } }
    const site = g.map.spots.cultivoSite;
    const pos = lvl >= 3 ? site : (tgt ? tgt.pos : site);
    g.pings = g.pings.filter((q) => q.pid !== 0);
    g.pings.push({ id: g.nextId++, pid: 0, k: 'obj', label: lvl >= 3 ? 'el puente nacerá aquí' : 'capullo', pos: clone(pos), until: g.time + 30 });
    g.emit({ t: 'hint', lvl, p: [pos.x, pos.y, pos.z] });
    o.noProg = 0; // la siguiente pista llega 45 s después de ésta, si seguís sin avanzar
  }
  return c.open;
}
