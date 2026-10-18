// EVOLUCIÓN VISUAL de los Huéspedes: envuelve buildHost (huespedes-view.js) y le suma lo que el jugador ELIGIÓ al evolucionar:
//   · los CAMINOS (`pth` del snapshot, EVO_PATHS de data.js): una mutación física por nivel, distinta según el camino (huespedes-mut.js);
//   · los ÓRGANOS del campeón (`cg`, organs-vis.js) colgados del pecho y la cabeza;
//   · el ASPECTO REGIONAL del mapa (`map`): color del borde de luz, partículas y un ornamento del folclore del lugar;
//   · el arma cuerpo a cuerpo fusionada en la mano (melee-models.js).
//   import { buildHostEvo } from './huespedes-evo.js';
//   const h = buildHostEvo(THREE, 'seraf', { evo: 2, path: ['coraza', 'velocidad'], organs: [], map: 'm2', melee: 'pica_cristal', quality: 'low' });
//   // → { group, update(dt,t), pose(name), dispose(), setEvo(n), setPath(ids), setMap(id), setMelee(id), setOrgans(ids), evo, tierName, info:{draws,tris} }  (misma API que buildHost)
//   scene.add(h.group); en cada cuadro h.update(dt, t); al evolucionar en la partida h.setEvo(nuevo) (reconstruye en pocos ms).
// Niveles (nombres = EVO_TIERS de data.js): 0 Larva · 1 Despertar · 2 Fusión · 3 Mutación · 4 Forma final. Cada nivel AGREGA una mutación (nunca quita); además el cuerpo
// crece un poco (+2 % por nivel), desde el 3 hay una jaula de aura y en el 4 un sello brillante en el suelo.
// Presupuesto: las mutaciones se funden con las mallas del cuerpo (no suman llamadas de dibujo salvo articulaciones nuevas) → cuerpo + mutaciones ≤ 40 en Baja (se mide).
import { buildHost, HOST_COLORS } from './huespedes-view.js';
import { attachToViewmodel } from './melee-models.js';
import { attachChampOrgans } from './organs-vis.js';
import { applyMutations, pathIds, REGIONS } from './huespedes-mut.js';
import { EVO_TIERS, EVO_PATHS, evoPathsFor, MELEE_WEAPONS } from '../sim/data.js';

/** Dónde agarra el arma cada Huésped (marco del antebrazo derecho) y cuánto se escala. */
const HAND = { axioma: [0, -0.38, 0.05], vesper: [0, -0.56, 0.1], micelio: [0, -0.8, 0.16], umbra: [0, -0.4, 0.05], seraf: [0, -0.37, 0.03] };
const HSCALE = { axioma: 1, vesper: 1, micelio: 1.35, umbra: 1.1, seraf: 1 };
const TSCALE = { lanza: 0.62, martillo: 1, hacha: 1, espada: 1, daga: 1.1 };
export { REGIONS };

/** Construye un Huésped en un nivel de evolución. opts: { evo 0–4, path: ids elegidos, organs: ids, map: 'm1'…, melee id|null|'', quality, budget }. */
export function buildHostEvo(THREE, id, opts = {}) {
  const T = THREE, quality = opts.quality || 'low', color = HOST_COLORS[id];
  let evo = Math.max(0, Math.min(4, opts.evo | 0)), melee = opts.melee || '', organs = Array.isArray(opts.organs) ? opts.organs.slice() : [], pth = Array.isArray(opts.path) ? opts.path.slice() : [], map = opts.map || null;
  const group = new T.Group(); group.name = 'huesped-evo-' + id;
  let geo = evo; // nivel de GEOMETRÍA mostrado (con opts.budget baja hasta que el cuerpo quepa en ese número de llamadas de dibujo; escala y brillo siguen el nivel real)
  let host = null, weapon = null, org = null, anim = null, aura = null, lastT = 0, motion = 0;
  const wantsCatalog = () => !!melee && !!MELEE_WEAPONS[melee];       // arma del catálogo → reemplaza la innata
  const counts = { draws: 0, tris: 0 };

  function clear() {
    if (host) { group.remove(host.group); host.dispose(); host = null; }
    if (weapon) { weapon.dispose(); weapon = null; }
    if (org) { org.dispose(); org = null; }
    if (aura) { group.remove(aura); aura.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); aura.userData.mats.forEach((m) => m.dispose()); aura = null; }
    anim = null;
  }
  function build() {
    clear();
    const ids = pathIds(geo, pth, EVO_PATHS), R = map && REGIONS[map];
    host = buildHost(T, id, quality, { native: !wantsCatalog(), mutate: (P, J, spec, out) => { anim = applyMutations(P, J, spec, { path: ids, region: map }); out.fn = anim; } }); group.add(host.group);
    host.setRegion(R ? R.color : null); host.setEvoLevel(evo);
    counts.draws = host.info.draws; counts.tris = host.info.tris;
    const J = host.joints;
    // manos: arma equipada fusionada (si es innata, la lleva el cuerpo base)
    if (wantsCatalog() && J && J.foreR) {
      const w = MELEE_WEAPONS[melee], k = (HSCALE[id] || 1) * (TSCALE[w.type] || 1);
      weapon = attachToViewmodel(T, J.foreR.g, melee, { frame: 'host', size: k, offset: HAND[id] || [0, -0.4, 0.05], tier: geo, quality, color, aura: false });
      const wi = weapon.model.info; counts.draws += wi.draws; counts.tris += wi.tris;
    }
    // órganos del campeón (docs/EVOLUCION.md): ≤ 6 llamadas de dibujo extra, cuelgan de torso y cabeza
    if (organs.length && J) { org = attachChampOrgans(T, id, J, organs, { color, quality }); counts.draws += org.info.draws; counts.tris += org.info.tris; }
    // jaula de aura (tier ≥ 3) y sello brillante en el suelo (tier 4)
    if (geo >= 3) {
      aura = new T.Group(); const m = [new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.02, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.03, blending: T.AdditiveBlending, depthWrite: false, side: T.BackSide, toneMapped: false })]; aura.userData.mats = m;
      const g = new T.SphereGeometry(1, 20, 14), a1 = new T.Mesh(g, m[0]), a2 = new T.Mesh(g.clone(), m[1]); for (const a of [a1, a2]) { a.position.y = 1.15; a.scale.set(0.95, 1.4, 0.95); a.frustumCulled = false; a.renderOrder = 4; aura.add(a); }
      counts.draws += 2; counts.tris += 160; group.add(aura);
    }
    if (geo >= 4) {
      const sg = new T.Group(), gm = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }), r1 = new T.Mesh(new T.RingGeometry(1.35, 1.4, 48), gm), r2 = new T.Mesh(new T.RingGeometry(1.0, 1.03, 6), gm);
      for (const r of [r1, r2]) { r.rotation.x = -Math.PI / 2; r.position.y = 0.03; r.frustumCulled = false; sg.add(r); }
      group.add(sg); aura = aura || new T.Group(); aura.add(sg); aura.userData.mats = [...(aura.userData.mats || []), gm]; aura.userData.sigil = [r1, r2]; counts.draws += 2; counts.tris += 120;
    }
    group.scale.setScalar(1 + evo * 0.02);
    host.pose('idle'); host.update(0, lastT);
  }
  function fitBuild() { geo = evo; build(); while (opts.budget && counts.draws > opts.budget && geo > 0) { geo--; build(); } }
  fitBuild();
  function update(dt, t) {
    lastT = t == null ? lastT + dt : t; host.update(dt, lastT);
    if (weapon) weapon.update(dt, lastT);
    if (org) org.update(dt, lastT);
    if (aura) { const sg = aura.userData.sigil; if (sg) { sg[0].rotation.z += dt * 0.3; sg[1].rotation.z -= dt * 0.4; } if (aura.userData.mats[1]) aura.userData.mats[1].opacity = 0.03 + Math.sin(lastT * 1.8) * 0.012; }
    void motion;
  }
  return {
    group, update, id,
    pose(n) { host.pose(n); }, get poseName() { return host.poseName; },
    setEvo(n) { n = Math.max(0, Math.min(4, n | 0)); if (n === evo) return; evo = n; fitBuild(); },
    setPath(list) { list = Array.isArray(list) ? list : []; if (list.join() === pth.join()) return; pth = list.slice(); if (evo > 0) fitBuild(); },
    setMap(m) { m = m || null; if (m === map) return; map = m; fitBuild(); },
    setOrgans(list) { list = list || []; if (list.join() === organs.join()) return; organs = list.slice(); fitBuild(); },
    get organs() { return organs; }, get map() { return map; }, get path() { return pathIds(geo, pth, EVO_PATHS); },
    setMelee(m) { m = m || ''; if (m === melee) return; melee = m; fitBuild(); },
    get evo() { return evo; }, get geoEvo() { return geo; }, get mats() { return host.mats; }, get melee() { return melee; }, get tierName() { return EVO_TIERS[evo].name; }, get joints() { return host.joints; },
    get weapon() { return weapon; },
    get info() { return { id, evo, draws: counts.draws, tris: Math.round(counts.tris) }; },
    dispose() { clear(); },
  };
}

const MATERIAL = { axioma: 'hueso y brasas', vesper: 'cristal fantasma', micelio: 'raíz y corteza', umbra: 'espejo y sombra', seraf: 'luz dorada' };
MATERIAL.singular = 'roca estelar y cristal oscuro'; HAND.singular = [0, -0.4, 0.05]; HSCALE.singular = 1.05;   // Singular
MATERIAL.danzante = 'hueso, cintas y cempasúchil'; HAND.danzante = [0, -0.4, 0.05]; HSCALE.danzante = 1;   // Danzante
const PATH_TXT = {
  depredador: (m) => `Depredador: garras largas de ${m} en las manos y una hilera de espinas por el lomo.`,
  coraza: (m) => `Coraza: placas de ${m} superpuestas en hombros, pecho y espalda, con canto luminoso.`,
  velocidad: (m) => `Velocidad: tendones de luz de ${m} por brazos y piernas y estelas que quedan detrás al correr.`,
  resonancia: (m) => `Resonancia: el núcleo del pecho se agranda y tres anillos de runas giran a su alrededor.`,
  simbiosis: (m) => `Simbiosis: el brazo derecho se funde en carne viva y un simbionte con ojo y tentáculos crece en el hombro.`,
  artilleria: (m) => `Artillería: cañones de cristal en los hombros y una cresta de cristales de ${m} en la espalda.`,
  apoteosis: (m) => `Apoteosis: alas de luz de tres capas, aureola quebrada y rayos detrás del cuerpo.`,
  anomalia: (m) => `Anomalía: grietas de vacío, espinas negras con filo de luz y esquirlas oscuras en órbita.`,
};
/** Qué cambia a la vista en cada nivel (para la pantalla «Evolución»): las DOS opciones de cada nivel, con el material de cada Huésped. */
export const EVO_VISUAL = {};
MATERIAL.colmena = 'quitina, cera y miel'; HAND.colmena = HAND.seraf; HSCALE.colmena = 1;   // Colmena
for (const id of Object.keys(MATERIAL)) { EVO_VISUAL[id] = ['']; for (let n = 1; n <= 4; n++) EVO_VISUAL[id][n] = EVO_PATHS[n].map((o) => (PATH_TXT[o.id] ? PATH_TXT[o.id](MATERIAL[id]) : o.name)).join('  ·  '); }
EVO_VISUAL.colmena = [''];   // Colmena tiene caminos PROPIOS: se describen con sus nombres, no con los comunes
for (let n = 1; n <= 4; n++) EVO_VISUAL.colmena[n] = evoPathsFor('colmena')[n].map((o) => o.name + ': ' + o.desc).join('  ·  ');
