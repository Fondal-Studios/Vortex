// Capa de interfaz del TUTORIAL JUGABLE (Sprint 1 · docs/ONBOARDING.md). La lógica y la verificación viven en src/sim/tutorial.js (determinista);
// acá sólo se DIBUJA lo que la simulación dice (snapshot `tut`): panel de objetivo, marcadores en pantalla y objetos del mundo (terminal, botiquín, círculo a esquivar).
// No agrega botones al HUD de cuatro acciones: el único control propio es «Saltar tutorial» (con confirmación) dentro del panel.
import { PASOS, textoPaso } from '../sim/tutorial.js';

export function crearTutorialUI({ THREE, renderer, root = document.body, sound = null, onSaltar = () => {} } = {}) {
  const panel = document.createElement('div'); panel.id = 'tutpanel'; panel.setAttribute('role', 'status'); panel.setAttribute('aria-live', 'polite');
  panel.innerHTML = '<div class="tp-top"><span class="tp-n"></span><button type="button" class="tp-skip">Saltar tutorial</button></div><h4></h4><p></p><div class="tp-bar"><b></b></div><div class="tp-meta"><span class="tp-m"></span><span class="tp-dots"></span></div>';
  root.appendChild(panel); document.body.classList.add('tut-on');
  const mark = document.createElement('div'); mark.className = 'tut-mark'; mark.hidden = true; mark.innerHTML = '<span></span>'; root.appendChild(mark);
  const q = (s) => panel.querySelector(s), skip = q('.tp-skip'); let ask = 0, ultimo = '', mundo = null, tNow = 0;
  skip.addEventListener('click', (e) => { e.stopPropagation(); if (ask > 0) { ask = 0; onSaltar(); } else { ask = 3.5; skip.classList.add('ask'); skip.textContent = '¿Seguro? Tocá de nuevo'; } });
  skip.addEventListener('pointerdown', (e) => e.stopPropagation());
  // objetos del mundo (se crean una vez)
  const objetos = {};
  if (THREE && renderer && renderer.scene) {
    const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
    const col = (c) => new THREE.MeshBasicMaterial({ color: c, ...add, opacity: 0.55 });
    const terminal = new THREE.Group(); const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 2.4, 12), new THREE.MeshBasicMaterial({ color: 0x5fe7ff, ...add, opacity: 0.5 })); pil.position.y = 1.2;
    const ar = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.8, 40), col(0x5fe7ff)); ar.rotation.x = -Math.PI / 2; ar.position.y = 0.05; terminal.add(pil, ar); terminal.visible = false;
    const botiq = new THREE.Group(); const esf = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), col(0x6dff9c)); esf.position.y = 1.0; const ar2 = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.4, 32), col(0x6dff9c)); ar2.rotation.x = -Math.PI / 2; ar2.position.y = 0.05; botiq.add(esf, ar2); botiq.visible = false;
    const zona = new THREE.Group(); const zr = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: 0xff5a5a, ...add, opacity: 0.9 })); const zf = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0xff3030, ...add, opacity: 0.18 }));
    for (const m of [zr, zf]) m.rotation.x = -Math.PI / 2; zf.position.y = 0.04; zr.position.y = 0.05; zona.add(zr, zf); zona.visible = false;
    renderer.scene.add(terminal, botiq, zona); Object.assign(objetos, { terminal, botiq, zona, zf, pil, esf });
  }
  const proyectar = (p) => { if (!renderer || !renderer.camera || !THREE) return null; const v = new THREE.Vector3(p[0], p[1] + 1.2, p[2]).project(renderer.camera); const w = innerWidth, h = innerHeight; return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, atras: v.z > 1 }; };
  function update(tut, dt, { touch = false, combo = false } = {}) {
    if (!tut || tut.fin) { panel.hidden = true; mark.hidden = true; for (const k of ['terminal', 'botiq', 'zona']) if (objetos[k]) objetos[k].visible = false; return; }
    tNow += dt; if (ask > 0) { ask -= dt; if (ask <= 0) { skip.classList.remove('ask'); skip.textContent = 'Saltar tutorial'; } }
    panel.hidden = false; panel.classList.toggle('ok', !!tut.ok);
    const P = PASOS[tut.i], T = textoPaso(P, combo, touch), clave = tut.i + '|' + combo + '|' + touch;
    if (clave !== ultimo) {
      ultimo = clave; q('.tp-n').textContent = `Tutorial · paso ${tut.i + 1} de ${tut.n}`; q('h4').textContent = T.titulo; q('p').textContent = T.texto; q('.tp-m').textContent = T.meta;
      q('.tp-dots').innerHTML = PASOS.map((_, k) => `<i class="${k < tut.i ? 'on' : k === tut.i ? 'cur' : ''}"></i>`).join('');
    }
    q('.tp-bar b').style.width = `${Math.round(100 * (tut.ok ? 1 : tut.prog))}%`;
    // marcador en pantalla (blanco / terminal / botiquín / círculo)
    let mk = null, txt = '';
    if (tut.marca === 'blanco') { mk = tut.mp; txt = 'BLANCO' + (tut.vida != null ? ` · ${Math.round(tut.vida * 100)} %` : ''); }
    else if (tut.marca === 'terminal') { mk = tut.mp; txt = 'TERMINAL' + (tut.usar ? ' · USAR' : ''); }
    else if (tut.marca === 'botiquin') { mk = tut.mp; txt = 'BOTIQUÍN'; }
    // (el círculo a esquivar se ve en el suelo y el panel lo explica: sin marcador flotante que choque con los botones)
    const pr = mk && proyectar(mk);
    if (pr && !pr.atras) { mark.hidden = false; mark.dataset.k = tut.marca || 'zona'; mark.firstChild.textContent = txt; mark.style.left = `${Math.max(40, Math.min(innerWidth - 40, pr.x))}px`; mark.style.top = `${Math.max(90, Math.min(innerHeight - 30, pr.y))}px`; } else mark.hidden = true;
    // objetos del mundo
    const O = objetos, pulso = 0.85 + 0.15 * Math.sin(tNow * 4);
    if (O.terminal) { O.terminal.visible = tut.marca === 'terminal'; if (O.terminal.visible) { O.terminal.position.set(tut.mp[0], tut.mp[1] - 0.9, tut.mp[2]); O.pil.scale.set(pulso, 1, pulso); } }
    if (O.botiq) { O.botiq.visible = tut.marca === 'botiquin'; if (O.botiq.visible) { O.botiq.position.set(tut.mp[0], tut.mp[1] - 0.9, tut.mp[2]); O.esf.position.y = 1 + 0.15 * Math.sin(tNow * 3); } }
    if (O.zona) { const z = tut.zona; O.zona.visible = !!z; if (z) { O.zona.position.set(z.p[0], z.p[1] - 0.8, z.p[2]); O.zona.scale.set(z.r, 1, z.r); O.zf.material.opacity = 0.1 + 0.3 * z.k; } }
  }
  function dispose() {
    panel.remove(); mark.remove(); document.body.classList.remove('tut-on');
    for (const k of ['terminal', 'botiq', 'zona']) { const o = objetos[k]; if (o && o.parent) o.parent.remove(o); }
  }
  return { update, dispose, panel };
}
