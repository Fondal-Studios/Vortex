// HUD propio y MÍNIMO de LA BASE (docs/BASE.md). No toca el HUD de partida (touch.js, hud*.js, style.css): vive en su propia capa y su propio <style>.
//   Arriba: saldo de núcleos, materiales, objetivo sugerido y los botones Jugar · Menú · Salir.
//   Abajo: el cartel «E · Usar» de lo que tenés cerca; un panelito para las estaciones con varias opciones; el panel del Jardín; la frase de cada personaje; el tutorial.
// Parte PURA (sin DOM, se prueba en tests/base.test.js): recolectarDatos, avisosEstaciones, objetivoBase, mmss.
import { ESTACIONES, PERSONAJES, interaccionCerca, PLANTAS, PLANTA_IDS, macetaEstado } from '../sim/base.js';
import { MATERIALS, ITEMS, RARITIES, poder } from '../sim/items.js';
import { HOST_IDS } from '../sim/data.js';
import { poseeHuesped } from '../sim/tienda.js';
import { avisos, rutaObjetivos } from './menu-nav.js';
import * as Perfil from './perfil.js';

/* ───────────────────────── parte pura ───────────────────────── */
export const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')} min` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Puntitos de aviso por estación: { forja, jardin, armero, cambista, trofeos, territorios } → cantidad. */
export function avisosEstaciones(p, ahora = Date.now()) {
  const a = avisos(p, ahora), out = {};
  if (p.cultivo && p.cultivo.listo <= ahora) out.forja = 1;
  const lista = ((p.base && p.base.jardin) || []).filter((m) => m && macetaEstado(m, ahora).estado === 'lista').length; if (lista) out.jardin = lista;
  if (a.puntos) out.armero = a.puntos;
  if (a.huesped || a.tienda) out.cambista = a.huesped + a.tienda;
  if (a.botin) out.trofeos = a.botin;
  if (a.mision || a.bendicion) out.territorios = a.mision + a.bendicion;
  return out;
}
/** Todo lo que base-fx.js necesita para dibujar tu partida guardada. `p` = perfil (Perfil.perfil()), `sel` = Huésped elegido. */
export function recolectarDatos(p, ahora = Date.now(), sel = 'axioma') {
  const cu = p.cultivo, d = { sel, terr: {}, stock: {}, owned: HOST_IDS.filter((id) => poseeHuesped(p, id)), avisos: avisosEstaciones(p, ahora) };
  d.cultivo = cu && ITEMS[cu.item] ? { item: cu.item, mat: ITEMS[cu.item].mat, prog: Math.max(0, Math.min(1, 1 - (cu.listo - ahora) / Math.max(1, cu.dur * 1000))), faltan: Math.max(0, Math.ceil((cu.listo - ahora) / 1000)) } : null;
  for (const m of Object.keys(MATERIALS)) d.stock[m] = (p.materiales[m] || []).reduce((a, b) => a + b, 0);
  for (const id of Object.keys(p.terr || {})) d.terr[id] = true;
  d.jardin = (p.base.jardin || []).map((m) => { const s = macetaEstado(m, ahora); return { estado: s.estado, prog: s.prog, faltan: s.faltan, mat: s.planta ? s.planta.mat : null, planta: s.planta ? s.planta.id : null }; });
  const inv = (p.inventario || []).filter((it) => ITEMS[it.id]).sort((a, b) => ITEMS[b.id].r - ITEMS[a.id].r || poder(b) - poder(a));
  d.gems = inv.slice(0, 16).map((it) => RARITIES[ITEMS[it.id].r].color);
  return d;
}
const DONDE = { arenas: 'la Mesa de Territorios', story: 'la Mesa de Territorios', evolucion: 'los Capullos', inventario: 'la Forja', tienda: 'el Cambista', territorios: 'la Mesa de Territorios', huesped: 'los Capullos', loadout: 'los Capullos' };
/** Objetivo sugerido: el primer paso de la ruta sin cumplir. */
export function objetivoBase(p) {
  const s = rutaObjetivos(p, 7).find((x) => !x.hecho); if (!s) return { texto: '¡Ruta completa! Elegí tu próxima partida en la Mesa de Territorios.', donde: 'la Mesa de Territorios', go: 'arenas' };
  return { texto: s.texto, donde: DONDE[s.go] || 'el Santuario', go: s.go };
}

/* ───────────────────────── interfaz ───────────────────────── */
const CSS = `
.bh{position:fixed;inset:0;pointer-events:none;z-index:30;font-family:"Trebuchet MS",system-ui,sans-serif;color:#fff6e8;text-shadow:0 1px 3px #1a0f2acc}
.bh.hidden{display:none}.bh *{box-sizing:border-box}
.bh button{pointer-events:auto;font:inherit;color:inherit;cursor:pointer}
.bh-top{position:absolute;left:0;right:0;top:0;display:flex;gap:10px;align-items:flex-start;padding:8px 12px;flex-wrap:wrap}
.bh-box{background:linear-gradient(180deg,#3a2458d9,#2a1a44d9);border:1.5px solid #ffd27a88;border-radius:12px;padding:6px 12px;backdrop-filter:blur(3px)}
.bh-saldo{display:flex;flex-direction:column;gap:2px;min-width:120px}.bh-saldo b{font-size:20px;color:#ffe27a}.bh-saldo i{font-style:normal;font-size:12px;opacity:.95;display:flex;gap:8px;flex-wrap:wrap}
.bh-saldo i span{display:inline-flex;align-items:center;gap:3px}.bh-saldo i em{width:9px;height:9px;border-radius:50%;display:inline-block;border:1px solid #fff8}
.bh-obj{flex:1 1 220px;min-width:180px;font-size:14px;line-height:1.25}.bh-obj small{display:block;opacity:.85;font-size:12px}.bh-obj b{color:#9fffe0}
.bh-btns{margin-left:auto;display:flex;gap:6px}
.bh-btn{min-height:44px;min-width:76px;padding:6px 14px;border-radius:12px;border:1.5px solid #ffd27acc;background:linear-gradient(180deg,#7a3fb0,#4a2a80);font-weight:700;font-size:15px;text-shadow:0 1px 2px #000a}
.bh-btn.jugar{background:linear-gradient(180deg,#ffb040,#d9701a);border-color:#fff0b0}.bh-btn:hover,.bh-btn:focus-visible{filter:brightness(1.18);outline:2px solid #fff8}
.bh-prompt{position:absolute;left:50%;bottom:calc(26px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);text-align:center;max-width:min(560px,86vw);transition:opacity .15s;opacity:0}
.bh-prompt.on{opacity:1}.bh-prompt .bh-box{display:inline-block;padding:8px 16px}.bh-prompt b{font-size:18px;color:#ffe27a}.bh-prompt kbd{display:inline-block;min-width:26px;padding:1px 7px;border-radius:7px;background:#ffe27a;color:#3a2458;font-weight:900;text-shadow:none;margin-right:6px}
.bh-prompt p{margin:3px 0 0;font-size:13px;opacity:.95}
.bh-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,94vw);max-height:86vh;overflow:auto;pointer-events:auto;padding:14px 16px}
.bh-panel h3{margin:0 0 4px;font-size:20px;color:#ffe27a}.bh-panel p{margin:2px 0 10px;font-size:14px}
.bh-acc{display:flex;flex-direction:column;gap:8px}.bh-acc .bh-btn{text-align:left;width:100%}.bh-acc kbd{background:#ffe27a;color:#3a2458;border-radius:6px;padding:0 7px;margin-right:8px;font-weight:900;text-shadow:none}
.bh-jar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.bh-mac{background:#1a0f2a99;border:1.5px solid #fff4;border-radius:10px;padding:8px;min-height:104px;display:flex;flex-direction:column;gap:5px;font-size:13px}
.bh-sem{display:flex;flex-wrap:wrap;gap:6px}.bh-sem .bh-btn{min-width:0;padding:4px 10px;font-size:13px;min-height:44px}.bh-sem .bh-btn small{display:block;font-weight:400;font-size:11px;opacity:.9}.bh-sem .bh-btn.on{outline:2px solid #ffe27a;background:linear-gradient(180deg,#3fae6a,#1f7a48)}.bh-sel{font-size:13px;margin:8px 0!important}
.bh-mac.lista{border-color:#ffe27a;box-shadow:0 0 12px #ffe27a88}.bh-mac b{font-size:14px}.bh-mac .bh-btn{min-height:36px;font-size:13px;padding:3px 8px;text-align:center}.bh-mac .bar{height:7px;border-radius:5px;background:#fff3;overflow:hidden}.bh-mac .bar i{display:block;height:100%;background:linear-gradient(90deg,#9bff4a,#ffe27a)}
.bh-habla{position:absolute;left:50%;top:22%;transform:translateX(-50%);max-width:min(480px,88vw);text-align:center;opacity:0;transition:opacity .25s;pointer-events:none}.bh-habla.on{opacity:1}.bh-habla b{display:block;font-size:13px;color:#9fffe0;margin-bottom:2px}.bh-habla span{font-size:16px}
.bh-tut{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(520px,94vw);pointer-events:auto;padding:16px 18px;z-index:2}.bh-tut h3{margin:0 0 6px;font-size:21px;color:#ffe27a}.bh-tut ul{margin:6px 0 12px;padding-left:20px;line-height:1.45;font-size:15px}.bh-tut li{margin:3px 0}
.bh-toast{position:absolute;left:50%;top:92px;transform:translateX(-50%);opacity:0;transition:opacity .25s;pointer-events:none;font-size:15px;text-align:center}.bh-toast.on{opacity:1}
body.en-base #hud,body.en-base #radar,body.en-base .radar{display:none!important}
body.en-base #touch .tc-btn:not(.tc-use):not(.tc-jump):not(.tc-pause){display:none!important}
@media (max-height:430px){.bh-top{padding:5px 8px;gap:6px}.bh-box{padding:4px 9px}.bh-saldo b{font-size:16px}.bh-obj{font-size:12px}.bh-btn{min-height:40px;font-size:13px;padding:4px 10px;min-width:62px}.bh-prompt{bottom:70px}.bh-panel{max-height:94vh;padding:10px 12px}.bh-mac{min-height:88px}}
`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);

/** opts: { onAbrir({pantalla, tab}), onPractica(), onSalir(), onMenu(), onPanel(abierto), onCambio(), sound, touch } */
export function createBaseHud(opts = {}) {
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.className = 'bh hidden'; root.setAttribute('role', 'region'); root.setAttribute('aria-label', 'La Base');
  root.innerHTML = `<div class="bh-top"><div class="bh-box bh-saldo"><b id="bhcores">◆ 0</b><i id="bhmats"></i></div>
    <div class="bh-box bh-obj" id="bhobj"></div>
    <div class="bh-btns"><button class="bh-btn jugar" id="bhjugar" type="button">▶ Jugar</button><button class="bh-btn" id="bhmenu" type="button">Menú</button><button class="bh-btn" id="bhsalir" type="button">Salir</button></div></div>
    <div class="bh-prompt" id="bhprompt"></div><div class="bh-habla bh-box" id="bhhabla"></div><div class="bh-toast bh-box" id="bhtoast"></div><div class="bh-panel bh-box" id="bhpanel" hidden></div>`;
  document.body.appendChild(root);
  const $ = (id) => root.querySelector('#' + id), H = { open: null, root, cerca: null, ult: 0, toastT: 0, hablaT: 0, datos: null };
  const snd = (k) => { try { opts.sound && opts.sound.ui && opts.sound.ui(k); } catch { /* sin sonido */ } };
  const abrirPanel = (kind, html, bind) => { H.open = kind; const p = $('bhpanel'); p.hidden = false; p.innerHTML = html; bind && bind(p); if (opts.onPanel) opts.onPanel(true); };
  H.cerrarPanel = () => { if (!H.open || H.open === 'tut') return; H.open = null; clearInterval(H.jardinT); $('bhpanel').hidden = true; if (opts.onPanel) opts.onPanel(false); };
  const toast = (t, ms = 2400) => { const e = $('bhtoast'); e.textContent = t; e.classList.add('on'); clearTimeout(H.toastT); H.toastT = setTimeout(() => e.classList.remove('on'), ms); };
  H.toast = toast;

  /* ── estación → pantalla / panelito / jardín ── */
  H.activar = function activar(id) {
    const e = ESTACIONES[id]; if (!e) return; try { Perfil.visitarEstacion(id); } catch { /* sin perfil */ }
    snd('ok');
    if (e.panel === 'jardin') return H.abrirJardin();
    const lista = e.acciones || (e.accion === 'practica' ? [{ id: 'practica', texto: 'Entrar al Campo de pruebas', practica: true }] : null);
    if (lista) {
      abrirPanel('acc', `<h3>${esc(e.icono)} ${esc(e.nombre)}</h3><p>${esc(e.frase)}</p><div class="bh-acc">${lista.map((a, i) => `<button class="bh-btn" type="button" data-i="${i}"><kbd>${i + 1}</kbd>${esc(a.texto)}</button>`).join('')}<button class="bh-btn" type="button" data-x="1" style="opacity:.85">Cerrar (Esc)</button></div>`, (p) => {
        p.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => H.elegir(lista[+b.dataset.i]))); p.querySelector('[data-x]').addEventListener('click', () => { snd('back'); H.cerrarPanel(); });
      }); H.lista = lista; return;
    }
    H.cerrarPanel(); opts.onAbrir && opts.onAbrir({ pantalla: e.pantalla, tab: e.tab, estacion: id });
  };
  H.elegir = function elegir(a) { if (!a) return; H.cerrarPanel(); if (a.practica) opts.onPractica && opts.onPractica(); else opts.onAbrir && opts.onAbrir({ pantalla: a.pantalla, tab: a.tab }); };
  H.hablar = function hablar(id, texto) {
    const n = PERSONAJES[id]; if (!n) return; const e = $('bhhabla'); e.innerHTML = `<b>${esc(n.nombre)}</b><span>«${esc(texto)}»</span>`; e.classList.add('on'); clearTimeout(H.hablaT); H.hablaT = setTimeout(() => e.classList.remove('on'), 5200); snd('tick');
  };

  /* ── jardín ── */
  H.semilla = PLANTA_IDS[0];
  H.abrirJardin = function abrirJardin() {
    const draw = () => {
      const p = Perfil.perfil(), est = Perfil.jardinEstado(), P = PLANTAS[H.semilla];
      const html = `<h3>🌱 Jardín y Herbario</h3><p>Tenés <b>${p.cores}</b> núcleos. Elegí una semilla, sembrala en una maceta vacía y esperá: el reloj corre aunque cierres el juego.</p>
        <div class="bh-sem">${PLANTA_IDS.map((k) => `<button class="bh-btn${k === H.semilla ? ' on' : ''}" type="button" data-k="${k}" title="${esc(PLANTAS[k].texto)}">${esc(PLANTAS[k].nombre)}<small>${PLANTAS[k].costo}◆ · ${mmss(PLANTAS[k].t)}</small></button>`).join('')}</div>
        <p class="bh-sel">${esc(P.texto)} Rinde <b>${P.n} × ${esc(MATERIALS[P.mat].name)}</b>.</p>
        <div class="bh-jar">${est.map((m, i) => {
          if (m.estado === 'vacia') return `<div class="bh-mac"><b>Maceta ${i + 1}</b><span>vacía</span><button class="bh-btn" type="button" data-s="${i}" ${p.cores < P.costo ? 'disabled style="opacity:.55"' : ''}>Sembrar ${esc(P.nombre)}</button></div>`;
          if (m.estado === 'crece') return `<div class="bh-mac"><b>${esc(m.planta.nombre)}</b><span>crece… faltan ${mmss(m.faltan)}</span><div class="bar"><i style="width:${Math.round(m.prog * 100)}%"></i></div><span>Dará ${m.planta.n} × ${esc(MATERIALS[m.planta.mat].name)}</span></div>`;
          return `<div class="bh-mac lista"><b>${esc(m.planta.nombre)}</b><span>¡Lista!</span><button class="bh-btn" type="button" data-c="${i}">Cosechar ${m.planta.n} × ${esc(MATERIALS[m.planta.mat].name)}</button></div>`;
        }).join('')}</div><div class="bh-acc" style="margin-top:10px"><button class="bh-btn" type="button" data-x="1">Cerrar (Esc)</button></div>`;
      const pn = $('bhpanel'); pn.innerHTML = html;
      pn.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { H.semilla = b.dataset.k; snd('tick'); draw(); }));
      pn.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { const r = Perfil.sembrar(+b.dataset.s, H.semilla); toast(r.ok ? `Sembraste ${r.planta.nombre}` : r.motivo); snd(r.ok ? 'ok' : 'back'); opts.onCambio && opts.onCambio(); draw(); }));
      pn.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { const r = Perfil.cosechar(+b.dataset.c); toast(r.ok ? `Cosechaste ${r.n} × ${MATERIALS[r.mat].name}` : r.motivo); snd(r.ok ? 'ok' : 'back'); opts.onCambio && opts.onCambio(); draw(); }));
      pn.querySelector('[data-x]').addEventListener('click', () => { snd('back'); H.cerrarPanel(); });
    };
    abrirPanel('jardin', '', null); draw(); clearInterval(H.jardinT); H.jardinT = setInterval(() => { if (H.open === 'jardin') draw(); else clearInterval(H.jardinT); }, 1000);
  };

  /* ── tutorial ── */
  H.tutorial = function tutorial(touch) {
    H.tutOpen = true; const p = $('bhpanel'); p.hidden = false; H.open = 'tut'; if (opts.onPanel) opts.onPanel(true);
    p.innerHTML = `<h3>Bienvenido al Santuario</h3><p>Tu base en el limbo: acá no hay enemigos. Caminá y usá las estaciones.</p><ul>
      <li>${touch ? 'Palanca izquierda: caminar · arrastrá a la derecha: mirar' : 'WASD o flechas: caminar · mouse: mirar'}.</li>
      <li>Parate en una estación que brilla y tocá <b>${touch ? 'USAR' : 'E'}</b>: abre la Forja, la Tienda, tus Huéspedes…</li>
      <li>Un <b style="color:#ffe27a">puntito dorado</b> sobre una estación = hay algo para vos (cultivo listo, botín nuevo…).</li>
      <li>Para jugar, andá a la <b>Mesa de Territorios</b> (el centro) o tocá «Jugar».</li></ul><div class="bh-acc"><button class="bh-btn jugar" type="button" id="bhtutok">¡Entendido!</button></div>`;
    p.querySelector('#bhtutok').addEventListener('click', () => { H.tutOpen = false; H.open = null; p.hidden = true; try { Perfil.tutorialBaseListo(); } catch { /* sin perfil */ } snd('ok'); if (opts.onPanel) opts.onPanel(false); });
  };

  /* ── teclado (lo llama main.js): 1/2/3 eligen una opción, Esc o E cierran ── */
  H.handleKey = function handleKey(e) {
    if (!H.open) return false;
    if (H.open === 'tut') { if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'KeyE') { const b = root.querySelector('#bhtutok'); b && b.click(); } return true; }
    if (e.code === 'Escape' || e.code === 'KeyE') { H.cerrarPanel(); snd('back'); return true; }
    if (H.open === 'acc' && /^Digit[1-9]$/.test(e.code)) { const a = (H.lista || [])[+e.code.slice(5) - 1]; if (a) H.elegir(a); return true; }
    return true;
  };

  /* ── cada cuadro ── */
  H.mostrar = (on) => root.classList.toggle('hidden', !on);
  H.update = function update(me, dt, touch) {
    H.ult += dt;
    const c = me && !me.dead ? interaccionCerca(me.pos[0], me.pos[2]) : null; H.cerca = c;
    const pr = $('bhprompt');
    if (c && !H.open) {
      const d = c.def, tecla = touch ? 'USAR' : 'E', txt = c.tipo === 'estacion' ? d.nombre : d.nombre, sub = c.tipo === 'estacion' ? d.frase : 'Hablar';
      const key = c.tipo + d.id + tecla; if (pr.dataset.k !== key) { pr.dataset.k = key; pr.innerHTML = `<div class="bh-box"><b><kbd>${tecla}</kbd>${esc(txt)}</b><p>${esc(sub)}</p></div>`; } pr.classList.add('on');
    } else pr.classList.remove('on');
    if (H.ult > 0.5) { // refresco de números (cuentas, materiales, objetivo): dos veces por segundo alcanza
      H.ult = 0; let p; try { p = Perfil.perfil(); } catch { return; }
      $('bhcores').textContent = `◆ ${p.cores} núcleos`;
      $('bhmats').innerHTML = Object.keys(MATERIALS).map((m) => { const n = (p.materiales[m] || []).reduce((a, b) => a + b, 0); return n ? `<span title="${esc(MATERIALS[m].name)}"><em style="background:${hex(MATERIALS[m].glow)}"></em>${n}</span>` : ''; }).join('') || '<span style="opacity:.8">sin materiales todavía</span>';
      const o = objetivoBase(p); $('bhobj').innerHTML = `<b>Objetivo:</b> ${esc(o.texto)}<small>Andá a ${esc(o.donde)}</small>`;
    }
  };
  $('bhjugar').addEventListener('click', () => { snd('ok'); opts.onAbrir && opts.onAbrir({ pantalla: 'arenas' }); });
  $('bhmenu').addEventListener('click', () => { snd('ok'); opts.onMenu && opts.onMenu(); });
  $('bhsalir').addEventListener('click', () => { snd('back'); opts.onSalir && opts.onSalir(); });
  H.destroy = () => { clearInterval(H.jardinT); root.remove(); st.remove(); };
  return H;
}
