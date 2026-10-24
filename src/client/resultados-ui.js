// PANTALLA DE RESULTADOS (GDD §4): dibuja el modelo de src/sim/resultados.js dentro de #end. Resumen principal arriba, detalle plegable abajo.
// Texto SIEMPRE con textContent (nada de innerHTML con datos). Los botones Reintentar / Base / Menú son los de siempre (main.js): sólo se reubican.
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };

export function dibujarResultados(raiz, m, { Perfil, extra = '' } = {}) {
  const caja = raiz.querySelector('.pbox'); if (!caja) return;
  let R = caja.querySelector('#endres'); if (R) R.remove();
  R = el('div', 'endres ' + m.tono); R.id = 'endres'; R.dataset.tono = m.tono;
  const pre = caja.querySelector('#endstats'); if (pre) pre.hidden = true;   // el texto plano queda de respaldo, oculto
  const titulo = caja.querySelector('#endtitle'); if (titulo) titulo.textContent = m.titulo;
  if (m.subtitulo) R.append(el('p', 'er-sub', m.subtitulo));
  const fila = el('div', 'er-fila'); for (const t of m.resumen) fila.append(el('span', 'er-chip', t)); R.append(fila);
  if (m.motivo) R.append(el('p', 'er-motivo', m.motivo));
  if (m.aviso) {   // guardado fallido (grave) o partida ya cobrada
    const a = el('div', 'er-aviso' + (m.aviso.grave ? ' grave' : ''), m.aviso.txt); a.setAttribute('role', 'alert');
    if (m.aviso.acciones.length && Perfil) {
      const msg = el('p', 'er-msg'), barra = el('div', 'er-acc');
      const btn = (id, txt, fn) => { const b = el('button', 'er-btn', txt); b.type = 'button'; b.id = id; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); barra.append(b); };
      btn('er-reintentar', 'Reintentar guardado', () => { const r = Perfil.reintentarGuardado(); msg.textContent = r.ok ? (r.pendientes ? 'Guardado, pero quedan recompensas pendientes.' : 'Listo: tu progreso se guardó y la recompensa se acreditó.') : r.mensaje; if (r.ok && !r.pendientes) a.classList.remove('grave'); });
      btn('er-descargar', 'Descargar copia', () => { try { const u = URL.createObjectURL(new Blob([Perfil.exportarProgreso()], { type: 'text/plain' })), l = document.createElement('a'); l.href = u; l.download = Perfil.nombreCopia(); document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000); msg.textContent = 'Copia descargada. Guardala: con ella podés recuperar tu progreso.'; } catch { msg.textContent = 'No se pudo descargar: usá «Copiar texto».'; } });
      btn('er-copiar', 'Copiar texto', async () => { const t = Perfil.exportarProgreso(); try { await navigator.clipboard.writeText(t); msg.textContent = 'Copiado. Pegalo en un lugar seguro (notas, mensaje a vos mismo).'; } catch { ta.hidden = false; ta.value = t; ta.select(); msg.textContent = 'Seleccioná y copiá este texto.'; } });
      const ta = el('textarea', 'er-copia'); ta.hidden = true; ta.readOnly = true; ta.id = 'er-copia';
      a.append(barra, msg, ta);
    }
    R.append(a);
  }
  if (m.recompensas.length) {
    const s = el('section', 'er-sec'); s.append(el('h3', '', m.parcial ? 'Recompensa parcial' : 'Recompensa'));
    m.recompensas.forEach((r, i) => { const f = el('div', 'er-rec' + (r.parcial ? ' parcial' : '')); f.style.animationDelay = (0.15 * i) + 's'; f.append(el('span', '', r.txt), el('b', '', r.val)); if (r.nota) f.append(el('small', '', r.nota)); s.append(f); });
    R.append(s);
  }
  if (m.botin.length) { const s = el('section', 'er-sec'); s.append(el('h3', '', 'Botín')); for (const l of m.botin.slice(0, 16)) s.append(el('p', 'er-botin', l)); R.append(s); }
  if (m.desbloqueos.length) { const s = el('section', 'er-sec desb'); s.append(el('h3', '', 'Desbloqueos')); m.desbloqueos.forEach((d, i) => { const p = el('p', 'er-desb', d); p.style.animationDelay = (0.4 + 0.2 * i) + 's'; s.append(p); }); R.append(s); }
  if (m.nota) R.append(el('p', 'er-nota', m.nota));
  if (extra) R.append(el('p', 'er-epilogo', extra));
  const det = el('details', 'er-det'); det.id = 'er-detalle'; det.append(el('summary', '', 'Ver detalle'));
  const t1 = el('div', 'er-sec');
  t1.append(el('h3', '', 'Objetivos')); for (const o of m.objetivos) { const f = el('div', 'er-rec' + (o.ok ? '' : ' parcial')); f.append(el('span', '', o.txt), el('b', '', o.val)); t1.append(f); }
  if (m.aporte.length) { t1.append(el('h3', '', 'Tu aporte')); for (const o of m.aporte) { const f = el('div', 'er-rec'); f.append(el('span', '', o.txt), el('b', '', String(o.val))); t1.append(f); } }
  if (m.tabla.length > 1) { t1.append(el('h3', '', 'Equipo')); for (const j of m.tabla) { const f = el('div', 'er-rec' + (j.yo ? ' yo' : '')); f.append(el('span', '', j.nombre + (j.yo ? ' (vos)' : '')), el('b', '', `${j.bajas} bajas · ${j.dmg} daño · ${j.apoyo} apoyo · ${j.obj} obj.`)); t1.append(f); } }
  if (m.perdido.length) { t1.append(el('h3', '', 'Sólo se obtiene al completar la misión')); for (const x of m.perdido) t1.append(el('p', 'er-botin', x)); }
  det.append(t1); R.append(det);
  (pre || titulo).after(R);
  if (!document.getElementById('endres-css')) {
    const st = el('style'); st.id = 'endres-css';
    st.textContent = '.endres{max-height:62vh;overflow:auto;text-align:left;font-size:14px}.endres.derrota h3{color:#ff9a8a}.er-fila{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}.er-chip{background:#ffffff18;border-radius:999px;padding:3px 12px}.er-motivo{color:#ff9a8a}.er-sec h3{margin:12px 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.8}.er-rec{display:flex;justify-content:space-between;gap:12px;padding:3px 0;animation:erin .5s both}.er-rec.parcial b{opacity:.75}.er-rec.yo{color:#ffd24a}.er-rec small{opacity:.6}.er-botin{margin:2px 0;opacity:.9}.er-desb{margin:4px 0;color:#9affc8;animation:erin .6s both}.er-aviso{background:#ffffff14;border-radius:8px;padding:8px 10px;margin:8px 0}.er-aviso.grave{background:#7a1f1f;color:#fff;border:1px solid #ff8a8a}.er-acc{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.er-btn{min-height:40px;padding:6px 12px;border-radius:6px;border:1px solid #fff8;background:#0006;color:#fff;cursor:pointer}.er-copia{width:100%;height:80px;margin-top:6px}.er-det summary{cursor:pointer;margin:10px 0;opacity:.85}.er-nota,.er-epilogo{opacity:.8;font-size:13px}@keyframes erin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.er-rec,.er-desb{animation:none}}';
    document.head.append(st);
  }
}
