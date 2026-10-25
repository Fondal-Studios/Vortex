// CAMPO DE PRUEBAS DEL LABORATORIO (EH-13, docs/EDITOR_HUESPEDES.md §4.3): medidor de daño SOLO en el cliente + botón «Volver al Editor Genómico».
// Lee `p.st.dmg` (el daño que acumula la simulación; no se toca la simulación) y calcula: daño total, daño por segundo en una ventana móvil de 5 s, el pico y cuánto tardarías en
// hacerle 400 de daño a un maniquí (DUMMY_HP). Sin red, sin guardar nada.
const VENTANA = 5, DUMMY_HP = 400;
/** Cálculo puro (lo prueban los tests): muestras = [{ t, dmg }] acumuladas; devuelve { total, dps, pico, ttk }. */
export function calcularMedidor(muestras, ahora) {
  if (!muestras.length) return { total: 0, dps: 0, pico: 0, ttk: null };
  const fin = muestras[muestras.length - 1], base = muestras[0], total = Math.max(0, fin.dmg - base.dmg);
  const ref = muestras.filter((m) => m.t >= ahora - VENTANA), a = ref.length ? ref[0] : fin, dt = Math.max(0.25, Math.min(VENTANA, ahora - a.t)), dps = Math.max(0, (fin.dmg - a.dmg) / dt);
  let pico = 0; for (let i = 0; i < muestras.length; i++) { const w = muestras.filter((m) => m.t >= muestras[i].t && m.t <= muestras[i].t + VENTANA); if (w.length > 1) { const d = (w[w.length - 1].dmg - w[0].dmg) / Math.max(0.25, w[w.length - 1].t - w[0].t); if (d > pico) pico = d; } }
  return { total, dps, pico: Math.max(pico, dps), ttk: pico > 0.5 ? DUMMY_HP / pico : null };
}
export function iniciarMedidor(getSesion, { volver } = {}) {
  const el = document.createElement('div'); el.id = 'labmedidor'; el.className = 'lb-medidor-juego'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'off');
  el.innerHTML = '<b>MEDIDOR DE DAÑO</b><span id="lbm-dps">0</span><small>por segundo (5 s)</small><span id="lbm-pico">pico 0</span><span id="lbm-tot">total 0</span><span id="lbm-ttk"></span><button type="button" id="lbm-volver">‹ Volver al Editor Genómico</button>';
  document.body.appendChild(el); el.querySelector('#lbm-volver').addEventListener('click', (e) => { e.stopPropagation(); volver && volver(); });
  const m = []; let t0 = performance.now(), id = 0;
  const leer = () => { const s = getSesion(); const g = s && s.game, p = g && g.players.find((q) => q.id === s.pid); if (!p) return; const t = (performance.now() - t0) / 1000; m.push({ t, dmg: p.st ? p.st.dmg : 0 }); if (m.length > 4000) m.splice(0, 1000);
    const r = calcularMedidor(m, t); el.querySelector('#lbm-dps').textContent = Math.round(r.dps); el.querySelector('#lbm-pico').textContent = `pico ${Math.round(r.pico)}`; el.querySelector('#lbm-tot').textContent = `total ${Math.round(r.total)}`;
    el.querySelector('#lbm-ttk').textContent = r.ttk ? `${DUMMY_HP} de daño en ${r.ttk.toFixed(1).replace('.', ',')} s` : 'Disparale a un blanco'; el.dataset.total = String(Math.round(r.total)); };
  id = setInterval(leer, 200); leer();
  return { el, leer, parar() { clearInterval(id); el.remove(); } };
}
