// BOTÍN EN PARTIDA (docs/INVENTARIO.md): objetos, materiales y planos que caen al piso (luz + gema del color de la rareza), cartel «E · recoger» cerca de lo valioso
// y mini-notificaciones («Conseguiste Hueso Fino ×2»). Sólo LEE el snapshot (`lt`, eventos `drop`/`loot`/`madura`/`firma`); no toca la simulación.
//   const botin = createBotin(THREE, renderer.scene, $('hud'));   cada cuadro: botin.update(state, me, dt)   por evento: botin.event(e, mine)
import { ITEMS, RARITIES, MATERIALS, CALIDADES, FASES } from '../sim/items.js';

const COLOR = RARITIES.map((r) => r.color);
/** Nombre en español de lo que cae: objeto, material (id `mat:<material>`, q = calidad) o plano (id `plano:<objeto>`). */
export function nombreBotin(id, q = 0, n = 1) {
  if (id.startsWith('mat:')) { const m = MATERIALS[id.slice(4)]; return m ? `${m.name} ${CALIDADES[Math.max(0, Math.min(3, q | 0))].toLowerCase()}${n > 1 ? ' ×' + n : ''}` : id; }
  if (id.startsWith('plano:')) { const it = ITEMS[id.slice(6)]; return it ? `Plano: ${it.name}` : id; }
  return ITEMS[id] ? ITEMS[id].name : id;
}
const rarDe = (id, r) => Math.max(0, Math.min(3, r | 0));

export function createBotin(THREE, scene, hudEl) {
  const group = new THREE.Group(); group.name = 'botin'; scene.add(group);
  const gemGeo = new THREE.OctahedronGeometry(0.28, 0), beamGeo = new THREE.CylinderGeometry(0.05, 0.22, 7, 8, 1, true), ringGeo = new THREE.RingGeometry(0.55, 0.62, 24);
  const mats = COLOR.map((c) => ({ gem: new THREE.MeshBasicMaterial({ color: c, toneMapped: false }), beam: new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), ring: new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }) }));
  const live = new Map(); let t = 0;
  const box = document.createElement('div'); box.id = 'botin-toasts'; box.setAttribute('aria-live', 'polite'); hudEl.appendChild(box);
  const prompt = document.createElement('div'); prompt.id = 'botin-prompt'; prompt.hidden = true; hudEl.appendChild(prompt);
  const up = new THREE.Vector3(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  function toast(txt, r, extra = '') {
    const el = document.createElement('div'); el.className = 'bt'; el.style.setProperty('--c', RARITIES[rarDe(null, r)].css); el.innerHTML = `<i></i><b></b><small></small>`; el.querySelector('b').textContent = txt; el.querySelector('small').textContent = extra;
    box.prepend(el); while (box.children.length > 5) box.lastChild.remove(); setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 3800);
  }
  function mk(o) {
    const g = new THREE.Group(), m = mats[rarDe(o[1], o[2])];
    const gem = new THREE.Mesh(gemGeo, m.gem), beam = new THREE.Mesh(beamGeo, m.beam), ring = new THREE.Mesh(ringGeo, m.ring); beam.position.y = 3.4; ring.rotation.x = -Math.PI / 2; ring.position.y = -0.55; gem.position.y = 0.2;
    gem.scale.setScalar(o[1].startsWith('mat:') ? 0.7 : o[1].startsWith('plano:') ? 0.85 : 1); g.add(gem, beam, ring); g.userData = { gem, ring, beam }; group.add(g); return g;
  }
  return {
    group,
    /** Cada cuadro: sincroniza el botín del piso y el cartel de recoger. */
    update(state, me, dt) {
      t += dt; const lt = (state && state.lt) || [], seen = new Set();
      if (me) up.set(me.up[0], me.up[1], me.up[2]); else up.set(0, 1, 0); q.setFromUnitVectors(Y, up.lengthSq() ? up.normalize() : Y);
      let near = null, nd = 1e9;
      for (const o of lt) {
        if (o[6] && me && o[6] !== me.id) continue;   // botín personal de otro jugador: no se ve
        seen.add(o[0]); let g = live.get(o[0]); if (!g) { g = mk(o); live.set(o[0], g); }
        g.position.set(o[3], o[4], o[5]); g.quaternion.copy(q);
        const u = g.userData; u.gem.position.y = 0.45 + Math.sin(t * 2 + o[0]) * 0.1; u.gem.rotation.y = t * 1.5; u.ring.material.opacity = 0.35 + 0.25 * Math.sin(t * 3 + o[0]); g.scale.setScalar(Math.min(1, 0.2 + (t - (g.userData.t0 ??= t)) * 3));
        if (me) { const d = Math.hypot(o[3] - me.pos[0], o[4] - me.pos[1], o[5] - me.pos[2]); if (d < nd && d < 4.6 && o[2] >= 2) { nd = d; near = o; } }
      }
      for (const [id, g] of live) if (!seen.has(id)) { group.remove(g); live.delete(id); }
      if (near) { prompt.hidden = false; prompt.style.setProperty('--c', RARITIES[rarDe(null, near[2])].css); prompt.textContent = `E · recoger ${nombreBotin(near[1], near[2], near[7] || 1)}`; } else prompt.hidden = true;
    },
    /** Eventos del bus: `drop` (cayó algo), `loot` (lo recogiste), `madura` (un objeto subió de fase), `firma` (se cumplió la condición de tu arma firma). */
    event(e, mine) {
      if (e.t === 'drop' && (mine || !e.pid) && e.r >= 2) toast(`¡Cayó: ${nombreBotin(e.id, e.r, e.n)}!`, e.r, e.directo ? 'Va directo a tu mochila' : 'Acercate y presioná E');
      else if (e.t === 'loot' && mine) toast(nombreBotin(e.id, e.k === 'mat' ? e.q : e.r, e.n), e.r, e.k === 'mat' ? 'Material' : e.k === 'plano' ? 'Plano nuevo para la Forja' : 'Objeto');
      else if (e.t === 'madura' && mine) toast(`${ITEMS[e.id] ? ITEMS[e.id].name : e.id} maduró`, ITEMS[e.id] ? ITEMS[e.id].r : 1, `Ahora está ${FASES[e.fase]}`);
      else if (e.t === 'firma' && mine) toast('¡Cumpliste la condición de tu arma firma!', 3, 'Llevá su plano a la Forja');
    },
    dispose() { scene.remove(group); box.remove(); prompt.remove(); gemGeo.dispose(); beamGeo.dispose(); ringGeo.dispose(); for (const m of mats) { m.gem.dispose(); m.beam.dispose(); m.ring.dispose(); } },
  };
}
