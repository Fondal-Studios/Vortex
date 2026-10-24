import { OPERATIONS } from '../sim/operations.js';
// Pantalla de Cooperativo: estado del servidor, crear / unirse, sala de espera (lobby) y enlace para invitar.
// Lo que pasa DENTRO de la partida sigue en main.js; acá sólo se prepara la sala y se entrega la red cuando todos empiezan.
import { NetClient } from './net.js';
import { PROTOCOLO, ERRORES, MAX_JUGADORES, normalizarCodigo, codigoValido } from '../sim/red.js';
import * as Srv from './servidor.js';

const SALA_KEY = 'arcanum.sala.v1';   // sessionStorage: sala + ficha para volver a entrar si se recarga la página
const guardarSala = (o) => { try { if (o) sessionStorage.setItem(SALA_KEY, JSON.stringify(o)); else sessionStorage.removeItem(SALA_KEY); } catch { /* sin almacenamiento */ } };
const leerSala = () => { try { return JSON.parse(sessionStorage.getItem(SALA_KEY) || 'null'); } catch { return null; } };

/**
 * ctx = { $, ui, params, CHARACTERS, HOST_IDS, posee(id), cargaDe() → objeto con lo que viaja al servidor, modoDe(char), ponerModo(char, modo), elegirChar(char),
 *         nombre, gesto() (desbloquea el sonido), onEmpezar(net, msgWelcome), banner(txt, ms), CODIGO_DEMO }
 */
export function createCoopUI(ctx) {
  const { $, params } = ctx;
  let srv = null, net = null, auto = false, enSala = false, estadoSrv = null, ocupado = false, lagParam = +params.get('lag') || 0;
  const el = (id) => $(id);
  const nombreChar = (id) => (ctx.CHARACTERS[id] ? ctx.CHARACTERS[id].name : id || '—');

  /* ───── indicador flotante de red (reconectando...) ───── */
  let netstat = null;
  function setNetStat(txt) {
    if (!netstat) { netstat = document.createElement('div'); netstat.id = 'netstat'; netstat.hidden = true; document.body.appendChild(netstat); }
    netstat.hidden = !txt; netstat.textContent = txt || '';
  }

  /* ───── estado del servidor ───── */
  function pintarEstado(donde, r) {
    const t = r.estado === 'encendido' ? `${Srv.TEXTO.encendido}${r.ms ? ` · ${r.ms} ms` : ''}${r.info ? ` · ${r.info.jugadores} jugando en ${r.info.salas} sala(s)` : ''}` : (Srv.TEXTO[r.estado] || '');
    donde.textContent = t; donde.className = 'hint ' + (r.estado === 'encendido' ? 'ok' : r.estado === 'dormido' ? 'warn' : 'mal');
  }
  async function revisar(donde = el('coopstat')) {
    srv = await Srv.resolver(params);
    donde.textContent = 'Buscando el servidor…'; donde.className = 'hint';
    estadoSrv = await Srv.probar(srv); pintarEstado(donde, estadoSrv);
    const ok = estadoSrv.estado === 'encendido' || estadoSrv.estado === 'dormido';
    for (const id of ['mkroom', 'joinroom', 'roomcode']) el(id).disabled = !ok;
    return estadoSrv;
  }
  /** Al abrir la pantalla de Cooperativo (lo llama main.js). */
  async function mostrar() {
    if (enSala) { vistaLobby(true); return; }
    vistaLobby(false); el('coopmap').value = el('coopmap').value || 'm1';
    if (auto) return;   // entrando por un enlace ?sala=: ese proceso ya muestra su propio estado
    const r = await revisar();
    if (r.estado === 'dormido') despertar();   // despertarlo ya, mientras el jugador elige
  }
  let despertando = false;
  async function despertar() {   // un servidor gratuito dormido tarda ~1 min: lo "tocamos" y reintentamos hasta que conteste
    if (despertando) return; despertando = true; const t0 = Date.now();
    while (Date.now() - t0 < 90000 && estadoSrv && estadoSrv.estado === 'dormido' && !enSala) {
      el('coopstat').textContent = `${Srv.TEXTO.dormido} · despertando… ${Math.round((Date.now() - t0) / 1000)} s`;
      await new Promise((r) => setTimeout(r, 3000));
      estadoSrv = await Srv.probar(srv, { timeout: 6000 });
    }
    despertando = false; if (!enSala) pintarEstado(el('coopstat'), estadoSrv || { estado: 'sin_conexion' });
  }

  /* ───── conexión ───── */
  /** La dirección del navegador queda con ?sala=… (así una recarga vuelve a la sala y se puede copiar el enlace a mano). */
  function fijarUrl(sala) { try { const u = new URL(location.href); u.searchParams.set('sala', sala); if (srv && !srv.porDefecto && srv.http) u.searchParams.set('server', srv.http); history.replaceState(null, '', u.search); } catch { /* sin history */ } }
  function msgError(msg, code) { return ERRORES[code] || msg || 'Error de conexión.'; }
  function poner(txt, clase) { const m = el(enSala ? 'lbmsg' : 'coopstat'); m.textContent = txt; m.className = 'hint ' + (clase || ''); }
  async function conectar() {
    srv = srv || await Srv.resolver(params);
    if (!srv.ws) { poner(Srv.TEXTO.sin_servidor, 'mal'); return null; }
    ctx.gesto && ctx.gesto();
    net = new NetClient({ lag: lagParam }); window.__net = net;
    net.onError = (msg, code) => {
      poner(msgError(msg, code), 'mal');
      if (code === 'token' || code === 'sala_inexistente' || code === 'cierre' || code === 'falla') { guardarSala(null); if (enSala) salirLocal(); }
    };
    net.onAviso = (m) => poner(m, 'warn');
    net.onLobby = (m) => { if (ctx.enPartida && ctx.enPartida()) { if (m.fase === 'lobby') ctx.volverAlLobby && ctx.volverAlLobby(m); return; } enSala = true; guardarSala({ room: m.room, token: net.token, ws: srv.ws }); fijarUrl(m.room); dibujarLobby(m); };
    net.welcomed = (m) => { ctx.onEmpezar(net, m); setNetStat(null); };
    net.onEstado = (e) => { setNetStat(e === 'reconectando' ? 'Se cortó la conexión · reconectando…' : e === 'caido' ? 'Conexión perdida' : null); };
    const t0 = Date.now();
    try {
      await net.connectInsistiendo(srv.ws, { total: 80000, progreso: (s) => poner(`Despertando al servidor… ${Math.round(s)} s (los servidores gratuitos tardan hasta 1 minuto la primera vez)`, 'warn') });
    } catch { poner(Date.now() - t0 > 20000 ? Srv.TEXTO.dormido + '. Probá de nuevo en un minuto.' : Srv.TEXTO.sin_conexion, 'mal'); net = null; return null; }
    return net;
  }
  async function crear() {
    if (ocupado) return; ocupado = true;
    try { const n = await conectar(); if (n) { poner('Creando la sala…'); n.send({ t: 'create', lobby: true, map: el('coopmap').value, ...ctx.cargaDe() }); } } finally { ocupado = false; }
  }
  async function unirse(codigo) {
    if (ocupado) return; const c = normalizarCodigo(codigo);
    if (!codigoValido(c)) { poner('El código tiene 4 letras o números (por ejemplo K7MQ).', 'mal'); return; }
    ocupado = true;
    try {
      const n = await conectar(); if (!n) return; poner('Entrando a la sala ' + c + '…');
      const g = leerSala();
      if (g && g.room === c && g.token) { // si se recargó la página, se vuelve a ocupar el mismo lugar
        let respondio = false; const oldErr = n.onError; n.onError = (m, code, x) => { if (code === 'token' && !respondio) { respondio = true; n.onError = oldErr; n.send({ t: 'join', room: c, ...ctx.cargaDe() }); } else oldErr(m, code, x); };
        n.send({ t: 'resume', room: c, token: g.token });
      } else n.send({ t: 'join', room: c, ...ctx.cargaDe() });
    } finally { ocupado = false; }
  }

  /* ───── sala de espera ───── */
  function vistaLobby(si) { el('coopA').hidden = !!si; el('coopL').hidden = !si; if (ctx.ui && ctx.ui.screen === 'coop') ctx.ui.focus(0, true); }
  function llenarHuespedes() {
    const sel = el('lbchar'); const ids = ctx.HOST_IDS.filter((id) => { try { return ctx.posee(id); } catch { return id === 'axioma'; } });
    sel.innerHTML = ''; for (const id of ids) { const o = document.createElement('option'); o.value = id; o.textContent = nombreChar(id); sel.appendChild(o); }
    sel.value = ctx.charActual();
  }
  function dibujarLobby(m) {
    vistaLobby(true); if (!el('lbchar').options.length) llenarHuespedes();
    el('lbcode').textContent = m.room; el('lbcount').textContent = `${m.players.length}/${m.max || MAX_JUGADORES}`;
    const ul = el('lbplayers'); ul.textContent = '';
    for (const p of m.players) {
      const li = document.createElement('li'); if (p.id === m.yo) li.className = 'yo';
      const n = document.createElement('span'); n.className = 'nom'; n.textContent = `${p.name}${p.host ? ' · anfitrión' : ''}${p.id === m.yo ? ' (vos)' : ''}`;
      const d = document.createElement('span'); d.className = 'det'; d.textContent = `${nombreChar(p.char)} · ${p.mode === 'combo' ? 'Melé' : 'Shooter'}`;
      const r = document.createElement('span'); r.className = p.away ? 'ausente' : p.ready || p.host ? 'ok' : 'no'; r.textContent = p.away ? 'sin conexión' : p.ready ? '✔ listo' : p.host ? 'anfitrión' : 'esperando';
      li.append(n, d, r); ul.appendChild(li);
    }
    for (let i = m.players.length; i < (m.max || MAX_JUGADORES); i++) { const li = document.createElement('li'); li.className = 'vacio'; li.textContent = 'lugar libre'; ul.appendChild(li); }
    const yo = m.players.find((p) => p.id === m.yo) || m.players[0], host = !!(yo && yo.host);
    el('lbmap').value = m.map; el('lbmap').disabled = !host || m.fase !== 'lobby';
    if (document.activeElement !== el('lbchar')) el('lbchar').value = yo && yo.char ? yo.char : ctx.charActual();
    if (document.activeElement !== el('lbmode')) el('lbmode').value = yo ? yo.mode : 'shooter';
    el('lbready').textContent = yo && yo.ready ? 'Ya no estoy listo' : 'Estoy listo'; el('lbready').hidden = host;
    el('lbstart').hidden = !host; el('lbstart').disabled = m.fase !== 'lobby';
    const cuenta = m.cuenta > 0;
    for (const id of ['lbchar', 'lbmode', 'lbready']) el(id).disabled = cuenta;
    if (cuenta) poner(`¡Empieza en ${m.cuenta}!`, 'ok');
    else poner(host ? (m.players.length < 2 ? 'Mandá el enlace a tus amigos con «Invitar amigos». Podés empezar solo, pero es mejor acompañado.' : 'Cuando todos estén listos, tocá «Empezar la partida».') : 'Marcá «Estoy listo». El anfitrión empieza la partida.');
    ctx.ui && ctx.ui.screen === 'coop' && ctx.ui.focus(ctx.ui.idx || 0, true);
  }
  function salirLocal() { enSala = false; auto = false; guardarSala(null); try { net && net.salir(); } catch { /* ya cerrado */ } net = null; setNetStat(null); try { const u = new URL(location.href); u.searchParams.delete('sala'); history.replaceState(null, '', u.search || location.pathname); } catch { /* nada */ } vistaLobby(false); revisar(); }

  async function invitar() {
    const m = net && net.lobby; if (!m) return; const url = Srv.enlaceSala(m.room, srv);
    try { if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ title: 'ARCANUM · Cooperativo', text: 'Sumate a mi sala:', url }); poner('Enlace compartido.', 'ok'); return; } } catch { /* canceló: se copia igual */ }
    try { await navigator.clipboard.writeText(url); poner('Enlace copiado: pegalo en el chat de tus amigos. ' + url, 'ok'); }
    catch { poner('Copiá este enlace y mandalo: ' + url, 'ok'); try { window.prompt('Copiá este enlace y mandalo a tus amigos:', url); } catch { /* sin ventana */ } }
  }

  /* ───── botones ───── */
  el('coopretry').addEventListener('click', () => { auto = false; mostrar(); });
  el('mkroom').addEventListener('click', crear);
  el('joinroom').addEventListener('click', () => unirse(el('roomcode').value));
  el('roomcode').addEventListener('input', () => { el('roomcode').value = normalizarCodigo(el('roomcode').value); });
  el('roomcode').addEventListener('keydown', (e) => { if (e.key === 'Enter') unirse(el('roomcode').value); e.stopPropagation(); });
  el('lbinvite').addEventListener('click', invitar);
  el('lbleave').addEventListener('click', salirLocal);
  el('lbready').addEventListener('click', () => { const yo = net.lobby.players.find((p) => p.id === net.lobby.yo); ctx.gesto && ctx.gesto(); net.send({ t: 'ready', on: !(yo && yo.ready) }); });
  el('lbstart').addEventListener('click', () => { ctx.gesto && ctx.gesto(); net.send({ t: 'start' }); });
  el('lbmap').addEventListener('change', () => net.send({ t: 'map', map: el('lbmap').value }));
  const elegir = () => { const ch = el('lbchar').value; ctx.elegirChar(ch); ctx.ponerModo(ch, el('lbmode').value); net.send({ t: 'pick', ...ctx.cargaDe(el('lbmode').value) }); };
  el('lbchar').addEventListener('change', () => { el('lbmode').value = ctx.modoDe(el('lbchar').value); elegir(); });
  el('lbmode').addEventListener('change', elegir);

  /* ───── Opciones › Cooperativo ───── */
  const inp = el('srvurl');
  inp.value = Srv.guardado();
  inp.addEventListener('keydown', (e) => e.stopPropagation());
  inp.addEventListener('change', () => { const n = Srv.normalizar(inp.value); if (inp.value.trim() && !n) { el('srvstat').textContent = 'Esa dirección no parece válida. Ejemplo: https://mi-juego.onrender.com'; el('srvstat').className = 'hint mal'; return; } Srv.guardar(n ? n.http : ''); inp.value = n ? n.http : ''; el('srvtest').click(); });
  el('srvtest').addEventListener('click', async () => { const s = await Srv.resolver(params); el('srvstat').textContent = s.http ? `Probando ${s.http}…` : ''; pintarEstado(el('srvstat'), await Srv.probar(s)); });
  el('srvreset').addEventListener('click', async () => { Srv.guardar(''); inp.value = ''; srv = null; el('srvtest').click(); });

  /* ───── enlace ?sala=ABCD: entra solo ───── */
  async function autoUnirse() {
    const c = normalizarCodigo(params.get('sala'));
    if (!c) return;
    auto = true; ctx.ui.act('ok'); ctx.ui.go('coop'); el('roomcode').value = c;
    srv = await Srv.resolver(params);
    if (!srv.ws) { poner(Srv.TEXTO.sin_servidor, 'mal'); return; }
    await unirse(c);
  }
  return { mostrar, autoUnirse, salirLocal, setNetStat, get net() { return net; }, get enSala() { return enSala; }, PROTOCOLO };
}

// Los valores de red siguen siendo mapId; los rótulos representan operaciones.
for (const o of document.querySelectorAll('#coopscr option')) if (OPERATIONS[o.value]) o.textContent = OPERATIONS[o.value].title;
