/** Cliente de red del modo cooperativo: manda entradas, recibe snapshots y los interpola ~100 ms atrás. */
export class NetClient {
  constructor() { this.buf = []; this.pid = null; this.events = []; this.rtt = 0; this.lastSnapAt = 0; this.stats = { snaps: 0 }; }
  connect(url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`) {
    return new Promise((res, rej) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => res();
      this.ws.onerror = () => rej(new Error('no se pudo conectar al servidor'));
      this.ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data));
      this.ws.onclose = () => { this.closed = true; };
    });
  }
  onMessage(m) {
    if (m.t === 'welcome') { this.pid = m.pid; this.room = m.room; this.map = m.map; this.buf = []; this.welcomed && this.welcomed(m); }
    else if (m.t === 'snap') {
      const now = performance.now(); this.lastSnapAt = now; this.stats.snaps++;
      this.events.push(...m.s.events);
      this.buf.push({ at: now, s: m.s }); if (this.buf.length > 12) this.buf.shift();
    } else if (m.t === 'error' && this.onError) this.onError(m.msg);
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  /** Estado interpolado para renderizar ahora (retardo fijo 110 ms). */
  view(now = performance.now()) {
    const b = this.buf; if (!b.length) return null;
    const t = now - 110;
    let i = b.length - 1; while (i > 0 && b[i - 1].at > t) i--;
    const A = b[Math.max(0, i - 1)], B = b[i];
    const out = { ...B.s, events: this.events.splice(0) };
    if (A === B || B.at === A.at) return out;
    const k = Math.min(1, Math.max(0, (t - A.at) / (B.at - A.at)));
    const mix = (a, c) => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k];
    const norm3 = (v) => { const l = Math.hypot(...v) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const byId = (arr) => new Map(arr.map((e) => [e.id, e]));
    const mA = byId(A.s.monsters), pA = byId(A.s.players), qA = byId(A.s.projectiles);
    out.monsters = B.s.monsters.map((m) => { const a = mA.get(m.id); return a ? { ...m, p: mix(a.p, m.p), u: norm3(mix(a.u, m.u)), f: norm3(mix(a.f, m.f)) } : m; });
    out.players = B.s.players.map((p) => { const a = pA.get(p.id); return a ? { ...p, pos: mix(a.pos, p.pos), up: norm3(mix(a.up, p.up)), h: norm3(mix(a.h, p.h)) } : p; });
    out.projectiles = B.s.projectiles.map((q) => { const a = qA.get(q.id); return a ? { ...q, p: mix(a.p, q.p) } : q; });
    return out;
  }
}
