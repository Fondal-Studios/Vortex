/** Cliente de red del modo cooperativo: manda entradas, recibe snapshots (en "delta"), los interpola ~100 ms atrás,
 *  se reconecta solo tras un corte breve y puede simular latencia (?lag=200) para probar. */
import { PROTOCOLO, aplicar } from '../sim/red.js';

const VIEW_DELAY = 110;       // ms de retraso al mostrar a los OTROS jugadores y criaturas (para interpolar sin saltos)
const RECONEXION_MAX = 45000; // ms que insiste en volver a la sala antes de rendirse

export class NetClient {
  constructor({ lag = 0 } = {}) {
    this.buf = []; this.pid = null; this.events = []; this.rtt = 0; this.lastSnapAt = 0; this.stats = { snaps: 0, bytes: 0, reconexiones: 0 };
    this.cur = null; this.lag = lag; this.estado = 'desconectado'; this.token = null; this.room = null; this.url = null;
    this.lobby = null; this.fin = null; this.salida = false; this._loc = null;
    /** `lag` = milisegundos de ida y vuelta que se agregan a propósito (mitad en cada sentido). */
  }
  get closed() { return this.estado === 'caido' || this.estado === 'desconectado'; }
  set closed(v) { if (v) this.estado = 'caido'; }
  _abrir(url, timeoutMs = 15000) {
    return new Promise((res, rej) => {
      let listo = false, ws;
      try { ws = new WebSocket(url); } catch { return rej(new Error('no se pudo conectar al servidor')); }
      const t = setTimeout(() => { if (!listo) { try { ws.close(); } catch { /* nada */ } rej(new Error('el servidor no contestó')); } }, timeoutMs);
      ws.onopen = () => { listo = true; clearTimeout(t); res(ws); };
      ws.onerror = () => { if (!listo) { clearTimeout(t); rej(new Error('no se pudo conectar al servidor')); } };
    });
  }
  _enganchar(ws) {
    this.ws = ws;
    ws.onmessage = (ev) => {
      if (ws !== this.ws) return;
      const bytes = ev.data.length; let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (this.lag > 0) setTimeout(() => ws === this.ws && this.onMessage(m, bytes), this.lag / 2); else this.onMessage(m, bytes);
    };
    ws.onclose = () => { if (ws !== this.ws) return; this._cortado(); };
    clearInterval(this._pingT); this._pingT = setInterval(() => this.send({ t: 'ping', c: performance.now() }), 2000);
  }
  /** Conecta una vez. Rechaza si no se puede. */
  async connect(url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`, timeoutMs = 15000) {
    this.url = url; this.salida = false;
    this._enganchar(await this._abrir(url, timeoutMs));
    this.estado = 'conectado';
  }
  /** Conecta insistiendo (para servidores gratuitos que se duermen y tardan ~1 min en despertar). `progreso(segundos)` avisa a la pantalla. */
  async connectInsistiendo(url, { total = 75000, progreso } = {}) {
    const t0 = Date.now(); let ultimo;
    for (let i = 0; ; i++) {
      try { await this.connect(url, 9000); return; } catch (e) { ultimo = e; }
      const seg = (Date.now() - t0) / 1000; if (progreso) progreso(seg);
      if (Date.now() - t0 > total || this.salida) throw ultimo;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  _cortado() {
    clearInterval(this._pingT);
    if (this.salida || !this.token || !this.room || this.estado === 'caido') { this.estado = 'caido'; this.onEstado && this.onEstado('caido'); return; }
    this.estado = 'reconectando'; this.onEstado && this.onEstado('reconectando');
    const t0 = Date.now(); this.stats.reconexiones++;
    const intento = async () => {
      if (this.salida || this.estado !== 'reconectando') return;
      if (Date.now() - t0 > RECONEXION_MAX) { this.estado = 'caido'; this.onEstado && this.onEstado('caido'); return; }
      try { const ws = await this._abrir(this.url, 6000); this._enganchar(ws); this.sendDirecto({ t: 'resume', v: PROTOCOLO, room: this.room, token: this.token }); }
      catch { setTimeout(intento, 1500); }
    };
    setTimeout(intento, 400);
  }
  onMessage(m, bytes = 0) {
    if (m.t === 'welcome') {
      this.pid = m.pid; this.room = m.room; this.map = m.map; this.token = m.token || this.token; this.cur = null; this.buf = []; this._loc = null; this.fin = null;
      if (this.estado !== 'conectado') { this.estado = 'conectado'; this.onEstado && this.onEstado('conectado'); }
      this.labs = Array.isArray(m.labs) ? m.labs : []; this.labAviso = m.labAviso || '';   // diseños del Laboratorio de la sala ([{ i, h, vb1 }]; el snapshot trae `lb` = i)
      this.welcomed && this.welcomed(m);
    } else if (m.t === 'lobby') {
      this.room = m.room; this.token = m.token || this.token; this.lobby = m;
      if (this.estado !== 'conectado') { this.estado = 'conectado'; this.onEstado && this.onEstado('conectado'); }
      this.onLobby && this.onLobby(m);
    } else if (m.t === 'snap') {
      const now = performance.now(); this.lastSnapAt = now; this.stats.snaps++; this.stats.bytes += bytes;
      this.cur = aplicar(this.cur, m.s);
      if (m.s.events && m.s.events.length) this.events.push(...m.s.events);
      this.buf.push({ at: now, s: { ...this.cur, events: [] } }); if (this.buf.length > 12) this.buf.shift();
    } else if (m.t === 'pong') {
      this.rtt = Math.max(0, Math.round(performance.now() - m.c)); this.jugadores = m.j;
    } else if (m.t === 'fin') { this.fin = m; this.onFin && this.onFin(m); }
    else if (m.t === 'aviso') { this.onAviso && this.onAviso(m.msg); }
    else if (m.t === 'labs') { this.labs = Array.isArray(m.labs) ? m.labs : []; this.onLabs && this.onLabs(this.labs); }
    else if (m.t === 'error') {
      if (m.code === 'token' || m.code === 'sala_inexistente') { if (this.estado === 'reconectando') { this.estado = 'caido'; this.onEstado && this.onEstado('caido'); } }
      if (m.code === 'cierre' || m.code === 'falla') this.salida = true;
      this.onError && this.onError(m.msg, m.code, m);
    }
  }
  /** Mensajes que necesitan declarar la versión del protocolo. */
  send(o) {
    if (o && (o.t === 'create' || o.t === 'join' || o.t === 'resume') && o.v === undefined) o = { ...o, v: PROTOCOLO };
    this.sendDirecto(o);
  }
  sendDirecto(o) {
    if (!this.ws || this.ws.readyState !== 1) return;
    const s = JSON.stringify(o);
    if (this.lag > 0) { const ws = this.ws; setTimeout(() => ws.readyState === 1 && ws.send(s), this.lag / 2); } else this.ws.send(s);
  }
  /** Salir de la sala a propósito (no intenta reconectar). */
  salir() { this.salida = true; clearInterval(this._pingT); this.sendDirecto({ t: 'salir' }); try { this.ws && this.ws.close(); } catch { /* nada */ } this.estado = 'desconectado'; }
  /** Estado interpolado para renderizar ahora (retardo fijo 110 ms; el jugador local se muestra casi sin retraso). */
  view(now = performance.now()) {
    const b = this.buf; if (!b.length) return null;
    const t = now - VIEW_DELAY;
    let i = b.length - 1; while (i > 0 && b[i - 1].at > t) i--;
    const A = b[Math.max(0, i - 1)], B = b[i];
    const out = { ...B.s, events: this.events.splice(0) };
    if (A === B || B.at === A.at) return this._local(out, now);
    const k = Math.min(1, Math.max(0, (t - A.at) / (B.at - A.at)));
    const mix = (a, c) => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k];
    const norm3 = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const byId = (arr) => new Map(arr.map((e) => [e.id, e]));
    const mA = byId(A.s.monsters), pA = byId(A.s.players), qA = byId(A.s.projectiles);
    out.monsters = B.s.monsters.map((m) => { const a = mA.get(m.id); return a ? { ...m, p: mix(a.p, m.p), u: norm3(mix(a.u, m.u)), f: norm3(mix(a.f, m.f)) } : m; });
    out.players = B.s.players.map((p) => { const a = pA.get(p.id); return a ? { ...p, pos: mix(a.pos, p.pos), up: norm3(mix(a.up, p.up)), h: norm3(mix(a.h, p.h)) } : p; });
    out.projectiles = B.s.projectiles.map((q) => { const a = qA.get(q.id); return a ? { ...q, p: mix(a.p, q.p) } : q; });
    return this._local(out, now);
  }
  /** Predicción sencilla del jugador local: usa el último snapshot (sin el retraso de 110 ms), lo adelanta con su velocidad y lo suaviza. */
  _local(out, now) {
    const b = this.buf, B = b[b.length - 1], A = b.length > 1 ? b[b.length - 2] : null;
    if (!B || this.pid == null) return out;
    const pb = B.s.players.find((p) => p.id === this.pid); if (!pb) return out;
    let target = pb.pos;
    if (A && B.s.time > A.s.time) {
      const pa = A.s.players.find((p) => p.id === this.pid);
      if (pa) {
        const dt = B.s.time - A.s.time, d = [pb.pos[0] - pa.pos[0], pb.pos[1] - pa.pos[1], pb.pos[2] - pa.pos[2]];
        if (Math.hypot(...d) < 6) { const ahead = Math.min(0.14, (now - B.at) / 1000 + this.rtt / 2000); target = [pb.pos[0] + d[0] / dt * ahead, pb.pos[1] + d[1] / dt * ahead, pb.pos[2] + d[2] / dt * ahead]; }
      }
    }
    const L = this._loc;
    if (!L || Math.hypot(target[0] - L.p[0], target[1] - L.p[1], target[2] - L.p[2]) > 8) this._loc = { p: [...target], t: now };
    else { const k = 1 - Math.exp(-Math.min(0.1, (now - L.t) / 1000) * 22); L.p = [L.p[0] + (target[0] - L.p[0]) * k, L.p[1] + (target[1] - L.p[1]) * k, L.p[2] + (target[2] - L.p[2]) * k]; L.t = now; }
    out.players = out.players.map((p) => (p.id === this.pid ? { ...p, pos: [...this._loc.p], up: pb.up, h: pb.h } : p));
    return out;
  }
}
