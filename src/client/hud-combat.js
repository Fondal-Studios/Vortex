// HUD de combate (DOM + CSS, se auto-inyecta): marcador de impacto, indicador direccional de daño recibido,
// viñeta de vida baja, manchas de ícor en pantalla, kill feed + racha + puntos, destello al matar élites.
// Uso (ver docs/gate/combatfx.md):
//   const combatHud = createCombatHud(document.getElementById('hud'), { sound });
//   dentro del bucle de eventos:  combatHud.onEvent(e, me, renderer.camera);
//   una vez por cuadro, DESPUÉS de los eventos:  combatHud.update(dt, state, me);
// Sólo lee el estado (snapshot + eventos): no toca el simulador.
import { WEAPONS, MONSTERS } from '../sim/data.js';

const STYLE_ID = 'combat-hud-style';
const CSS = `
.chud{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:3;font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;user-select:none}
.chud .vig{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 48%,rgba(160,8,40,.50) 100%);box-shadow:inset 0 0 140px 34px rgba(255,10,60,.42)}
.chud .flash{position:absolute;inset:0;opacity:0}
.chud .hm{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0;--c:#fff}
.chud .hm i{position:absolute;left:-1.5px;top:-1.5px;width:3px;height:12px;background:var(--c);border-radius:2px;box-shadow:0 0 5px #000c,0 0 10px var(--c)}
.chud .hm i:nth-child(1){transform:rotate(45deg) translateY(-15px)}.chud .hm i:nth-child(2){transform:rotate(135deg) translateY(-15px)}
.chud .hm i:nth-child(3){transform:rotate(225deg) translateY(-15px)}.chud .hm i:nth-child(4){transform:rotate(315deg) translateY(-15px)}
.chud .hm.big i{width:4px;height:17px;transform-origin:50% 0}
.chud .hm.big i:nth-child(1){transform:rotate(45deg) translateY(-17px)}.chud .hm.big i:nth-child(2){transform:rotate(135deg) translateY(-17px)}
.chud .hm.big i:nth-child(3){transform:rotate(225deg) translateY(-17px)}.chud .hm.big i:nth-child(4){transform:rotate(315deg) translateY(-17px)}
.chud .hring{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px;border-radius:50%;border:3px solid #ff3a5a;opacity:0;box-shadow:0 0 14px #ff3a5a}
.chud .dir{position:absolute;left:50%;top:50%;width:min(76vmin,760px);height:min(76vmin,760px);margin:calc(min(76vmin,760px) / -2) 0 0 calc(min(76vmin,760px) / -2);border-radius:50%;opacity:0;
 background:conic-gradient(from -24deg,rgba(255,40,70,0) 0deg,rgba(255,40,70,.0) 3deg,rgba(255,52,84,.95) 24deg,rgba(255,40,70,0) 45deg,rgba(255,40,70,0) 48deg);
 -webkit-mask:radial-gradient(circle,transparent 58%,#000 61%,#000 69%,transparent 72%);mask:radial-gradient(circle,transparent 58%,#000 61%,#000 69%,transparent 72%)}
.chud .splat{position:absolute;opacity:0;border-radius:44% 56% 52% 48% / 50% 42% 58% 50%;filter:blur(.4px)}
.chud .kf{position:absolute;right:20px;top:27%;display:flex;flex-direction:column;align-items:flex-end;gap:5px;max-width:42vw}
.chud .kfe{display:flex;gap:8px;align-items:center;padding:3px 10px;font-size:15px;letter-spacing:.04em;color:#fff;background:linear-gradient(270deg,#0009,#0000);border-right:3px solid var(--c,#fff);text-shadow:0 0 6px #000,0 0 2px #000}
.chud .kfe b{color:var(--c,#fff);font-size:16px}.chud .kfe small{opacity:.7;font-size:12px}.chud .kfe.elite{font-size:17px;background:linear-gradient(270deg,#5a1a00cc,#0000)}
.chud .st{position:absolute;left:50%;top:19%;transform:translateX(-50%);text-align:center;opacity:0}
.chud .st .n{font-size:44px;font-weight:900;font-style:italic;color:#ffe27a;text-shadow:0 0 14px #ff8a2a,0 2px 0 #000,0 0 4px #000;line-height:1}
.chud .st .l{font-size:15px;letter-spacing:.32em;color:#fff;text-shadow:0 0 8px #000;margin-top:2px}
.chud .st .t{width:120px;height:3px;margin:6px auto 0;background:#fff3;border-radius:2px;overflow:hidden}.chud .st .t b{display:block;height:100%;background:#ffe27a}
.chud .pp{position:absolute;font-size:22px;font-weight:900;font-style:italic;color:#ffe27a;text-shadow:0 0 8px #000,0 0 3px #000,0 0 12px #ff8a2a;opacity:0;white-space:nowrap}
.chud .rd{position:absolute;left:24px;bottom:118px;font-size:26px;font-weight:900;font-style:italic;color:#ff5a7a;text-shadow:0 0 8px #000,0 0 3px #000;opacity:0}
.chud .tag{position:absolute;left:50%;top:34%;transform:translateX(-50%);font-size:20px;letter-spacing:.3em;color:#ffd23f;text-shadow:0 0 12px #ff3a5a,0 0 3px #000;opacity:0;white-space:nowrap}
@media (pointer:coarse){.chud .kf{top:20%;right:calc(10px + env(safe-area-inset-right))}.chud .kfe{font-size:12px}.chud .rd{bottom:92px;left:16px}.chud .st .n{font-size:32px}}
`;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const NAMES = Object.fromEntries(Object.entries(MONSTERS).map(([k, v]) => [k, v.name.split(',')[0].toUpperCase()]));
const ICHOR = { astilla: '#2de0b0', geoda: '#9a58e0', prisma: '#e0509c', lente: '#e0b52a', cuarzo: '#e06a3a', espejo: '#9fc0e0', racimo: '#e02a4a', graviton: '#5a6ae0', coloso: '#e0a84c', madre: '#7ed048', argos: '#e0408c', obelisco: '#22c8e0', aurora: '#e07ad0', ariete: '#e07a30', espiral: '#9a78e0' };
const MULTI = ['', '', 'DOBLE', 'TRIPLE', 'CUÁDRUPLE', 'MULTIPLE'];

export function createCombatHud(rootEl, opts = {}) {
  const doc = rootEl.ownerDocument || document;
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s); }
  const el = (cls, html = '', parent) => { const d = doc.createElement('div'); d.className = cls; if (html) d.innerHTML = html; (parent || root).appendChild(d); return d; };
  const root = doc.createElement('div'); root.className = 'chud'; rootEl.appendChild(root);
  const vig = el('vig'), flash = el('flash'), hm = el('hm', '<i></i><i></i><i></i><i></i>'), hring = el('hring');
  const dirs = [0, 1, 2, 3, 4].map(() => el('dir')), kf = el('kf'), st = el('st', '<div class="n"></div><div class="l"></div><div class="t"><b></b></div>'), rd = el('rd'), tag = el('tag');
  const sound = opts.sound || null;

  const S = { t: 0, cam: null, me: null, myShots: [], hits: [], kills: [], hurts: [], extra: [], mon: new Map(), lastKills: null, lastScore: 0, lastSh: 100, streak: 0, streakT: 0, multiT: 0, multi: 0, lastMark: 0, arcs: [], dirIdx: 0, hp: 100, pulse: 0 };

  /** Mundo → pantalla (px). Devuelve null si está detrás de la cámara. */
  function toScreen(p) {
    const c = S.cam; if (!c || !c.matrixWorldInverse) return null; const m = c.matrixWorldInverse.elements, q = c.projectionMatrix.elements;
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
    if (z > -0.1) return null; const cx = q[0] * x, cy = q[5] * y, w = -z;
    return { x: (cx / w * 0.5 + 0.5) * innerWidth, y: (0.5 - cy / w * 0.5) * innerHeight };
  }
  /** Ángulo (rad, 0 = enfrente, + = derecha) hacia un punto del mundo respecto de la cámara. */
  function bearing(p) {
    const c = S.cam; if (!c || !c.matrixWorldInverse) return 0; const m = c.matrixWorldInverse.elements;
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
    return Math.atan2(x, -z);
  }
  const lvlOf = (me, w) => { if (!me || !me.sl || !Array.isArray(me.up)) return 0; const i = me.sl.indexOf(w), u = i >= 0 ? me.up[i] : 0; return Array.isArray(u) ? u[0] || 0 : 0; };
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  function segDist(p, a, b) { const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1e-6; let t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / l2; t = clamp(t, 0, 1); return near(p, [a[0] + d[0] * t, a[1] + d[1] * t, a[2] + d[2] * t]); }

  /** ¿Este golpe es mío? En solitario siempre; en cooperativo, si coincide con mi último disparo/habilidad. */
  function isMine(p, state) {
    if (!state || state.players.length <= 1) return true;
    for (const s of S.myShots) { if (S.t - s.t > 0.9) continue; const w = WEAPONS[s.w]; if (w && (w.kind === 'projectile' || w.kind === 'swarm' || w.kind === 'mine' || w.kind === 'pulse')) return true; for (const t of s.tips) if (segDist(p, s.o, t) < 2.5 + 0.1 * near(s.o, p)) return true; if (!s.tips.length) return true; }
    return S.t - S.skillT < 0.8;
  }

  const anim = (node, frames, o) => { try { return node.animate(frames, o); } catch { return null; } };

  function marker(kind, color) {
    hm.style.setProperty('--c', color); hm.classList.toggle('big', kind === 'crit' || kind === 'kill');
    anim(hm, [{ opacity: 1, transform: 'scale(1.5) rotate(0deg)' }, { opacity: 1, transform: 'scale(1.0)', offset: 0.25 }, { opacity: 0, transform: 'scale(0.92)' }], { duration: kind === 'kill' ? 420 : 240, easing: 'ease-out' });
    if (kind === 'kill') { hring.style.borderColor = color; hring.style.boxShadow = '0 0 14px ' + color; anim(hring, [{ opacity: 0.9, transform: 'scale(0.6)' }, { opacity: 0, transform: 'scale(2.1)' }], { duration: 380, easing: 'ease-out' }); }
    if (kind === 'crit') { hring.style.borderColor = color; hring.style.boxShadow = '0 0 14px ' + color; anim(hring, [{ opacity: 0.7, transform: 'scale(0.5)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 260, easing: 'ease-out' }); }
  }
  function screenFlash(color, a, ms) { flash.style.background = `radial-gradient(ellipse at center, transparent 20%, ${color} 130%)`; anim(flash, [{ opacity: a }, { opacity: 0 }], { duration: ms, easing: 'ease-out' }); }
  function splat(color, n, size) {
    for (let i = 0; i < n; i++) {
      const d = doc.createElement('div'); d.className = 'splat'; const side = Math.random(), r = (60 + Math.random() * 140) * size;
      const x = side < 0.5 ? Math.random() * 22 : 78 + Math.random() * 22, y = Math.random() * 100; d.style.cssText = `left:${x}%;top:${y}%;width:${r}px;height:${r * (0.7 + Math.random() * 0.5)}px;margin:${-r / 2}px;background:radial-gradient(closest-side,${color} 0%,${color}cc 55%,${color}00 100%)`;
      root.appendChild(d); const a = anim(d, [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 0.85, transform: 'scale(1)', offset: 0.08 }, { opacity: 0.55, offset: 0.55 }, { opacity: 0, transform: `translateY(${30 + Math.random() * 50}px) scale(1.05,1.3)` }], { duration: 2200 + Math.random() * 1200, easing: 'ease-out' });
      if (a) a.onfinish = () => d.remove(); else d.remove();
    }
  }
  function pop(text, p, color) {
    const s = toScreen(p); if (!s) return; const d = doc.createElement('div'); d.className = 'pp'; d.textContent = text; d.style.left = s.x + 'px'; d.style.top = s.y + 'px'; if (color) d.style.color = color; root.appendChild(d);
    const a = anim(d, [{ opacity: 0, transform: 'translate(-50%,0) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-14px) scale(1.15)', offset: 0.18 }, { opacity: 1, transform: 'translate(-50%,-44px) scale(1)', offset: 0.7 }, { opacity: 0, transform: 'translate(-50%,-70px) scale(.95)' }], { duration: 1100, easing: 'ease-out' });
    if (a) a.onfinish = () => d.remove(); else d.remove();
  }
  function feed(html, color, cls) {
    const d = doc.createElement('div'); d.className = 'kfe ' + (cls || ''); d.style.setProperty('--c', color); d.innerHTML = html; kf.appendChild(d); while (kf.children.length > 5) kf.removeChild(kf.firstChild);
    const a = anim(d, [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none', offset: 0.12 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 4200 });
    if (a) a.onfinish = () => d.remove(); else d.remove();
  }
  function showTag(text, color) { tag.textContent = text; tag.style.color = color || '#ffd23f'; anim(tag, [{ opacity: 0, transform: 'translateX(-50%) scale(1.6)' }, { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.15 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: 1500, easing: 'ease-out' }); }

  /* ───────── eventos ───────── */
  function onEvent(e, me, cam) {
    if (cam) S.cam = cam; if (me) S.me = me; const mine = me && e.pid === me.id;
    switch (e.t) {
      case 'shot': if (mine) { S.myShots.push({ t: S.t, w: e.w, o: e.o, tips: e.to || [] }); if (S.myShots.length > 8) S.myShots.shift(); } break;
      case 'skill': if (mine) S.skillT = S.t; break;
      case 'hit': S.hits.push(e); break;
      case 'kill': S.kills.push(e); break;
      case 'hurt': if (mine) S.hurts.push(e); break;
      case 'bite': case 'splat': case 'boom': case 'gazefire': case 'ray': S.extra.push(e); break;
      case 'down': if (mine) { screenFlash('rgba(255,0,40,.9)', 0.8, 900); } break;
      default: break;
    }
  }

  /* ───────── cuadro ───────── */
  function update(dt, state, me) {
    S.t += dt; if (me) S.me = me; me = me || S.me; if (state) S.state = state;
    const monsters = new Map(); if (state) for (const m of state.monsters) monsters.set(m.id, m);
    // 1) marcador de impacto: UNO por cuadro (prioridad: muerte > crítico > golpe > blindado)
    if (S.hits.length || S.kills.length) {
      let best = null, dmgMax = 0; const killedIds = new Set(S.kills.map((k) => k.id));
      const myShot = [...S.myShots].reverse().find((s) => S.t - s.t < 0.6) || null, w = myShot ? myShot.w : (me ? me.w : 0), base = (WEAPONS[w] ? WEAPONS[w].dmg : 20) * (1 + 0.22 * lvlOf(me, w));
      for (const h of S.hits) {
        if (!isMine(h.p, state)) continue; const ratio = h.d / base; dmgMax = Math.max(dmgMax, h.d);
        const kind = h.arm ? 'armor' : killedIds.has(h.id) ? 'kill' : ratio >= 1.9 ? 'crit' : 'hit', pr = { armor: 0, hit: 1, crit: 2, kill: 3 };
        if (!best || pr[kind] > pr[best]) best = kind;
      }
      if (!best) for (const k of S.kills) if (isMine(k.p, state)) { best = 'kill'; break; }
      if (best && S.t - S.lastMark > 0.028) {
        S.lastMark = S.t; const col = { hit: '#ffffff', armor: '#aab4d8', crit: '#ffd23f', kill: '#ff3a5a' }[best]; marker(best, col); if (sound && sound.hitmark) sound.hitmark(best);
      }
    }
    // 2) eliminaciones: feed + racha + puntos (las mías se reconocen por el aumento de `kills` del jugador)
    const killsNow = me ? me.kills : 0; let dk = S.lastKills == null ? 0 : killsNow - S.lastKills; if (dk < 0) dk = 0; S.lastKills = killsNow;
    const dScore = me ? me.score - S.lastScore : 0; if (me) S.lastScore = me.score;
    const list = S.kills.slice(0, S.kills.length), minen = Math.min(dk, list.length);
    for (let i = 0; i < list.length; i++) {
      const k = list[i], pm = S.mon.get(k.id), el = !!(pm && pm.el), boss = k.k === 'coloso' || k.k === 'madre' || k.k === 'argos', name = NAMES[k.k] || 'CRIATURA';
      if (i < minen) {
        const pts = Math.round(dScore / Math.max(1, minen)) || (MONSTERS[k.k] ? MONSTERS[k.k].score : 0), color = ICHOR[k.k] || '#ffe27a';
        feed(`<b>+${pts}</b> ${el ? 'ÉLITE ' : ''}${name}`, el || boss ? '#ffd23f' : color, el || boss ? 'elite' : '');
        pop('+' + pts, k.p, el || boss ? '#ffd23f' : '#ffe27a');
        S.streak++; S.streakT = 3.6; S.multi = S.t - S.multiT < 1.8 ? S.multi + 1 : 1; S.multiT = S.t;
        if (el) { screenFlash('rgba(255,190,60,.85)', 0.5, 700); showTag('ÉLITE ABATIDA', '#ffd23f'); }
        if (boss) { screenFlash('rgba(255,255,255,.9)', 0.7, 1100); showTag('¡' + name + ' DERROTADO!', '#ffd23f'); }
        if (S.multi >= 2 && !el && !boss) showTag(MULTI[Math.min(5, S.multi)] + ' ×' + S.multi, '#ff8a5a');
        if (S.streak >= 3) { st.querySelector('.n').textContent = '×' + S.streak; st.querySelector('.l').textContent = S.streak >= 10 ? 'IMPARABLE' : S.streak >= 6 ? 'RACHA' : 'EN RACHA'; anim(st, [{ opacity: 1, transform: 'translateX(-50%) scale(1.5)' }, { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.2 }], { duration: 300, fill: 'forwards' }); }
      } else feed(`${name} <small>abatido</small>`, '#8a90b0', '');
    }
    if (S.streakT > 0) { S.streakT -= dt; st.style.opacity = S.streak >= 3 ? 1 : 0; st.querySelector('.t b').style.width = clamp(S.streakT / 3.6, 0, 1) * 100 + '%'; if (S.streakT <= 0) { S.streak = 0; anim(st, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); } }
    // 3) daño recibido: arcos hacia el origen + ícor + número
    for (const h of S.hurts) {
      let src = null; const my = me ? me.pos : null;
      for (const x of S.extra) { if (!my) break; if (x.t === 'bite') { const m = monsters.get(x.id); if (m) { src = m.p; break; } } }
      if (!src) for (const x of S.extra) { if (x.t === 'gazefire') { src = x.from; break; } if (x.t === 'splat' && my && near(x.p, my) < 5) { src = x.p; break; } if (x.t === 'boom' && my && near(x.p, my) < x.r + 2) { src = x.p; break; } }
      let mk = null;
      if (!src && my) { let bd = 1e9; for (const m of monsters.values()) { const d = near(m.p, my); if (d < bd && d < 80) { bd = d; src = m.p; } } }
      if (src && my) { let bd = 1e9; for (const m of monsters.values()) { const d = near(m.p, src); if (d < bd) { bd = d; mk = m; } } }
      const mag = clamp(h.dmg / 22, 0.5, 2.2), col = ICHOR[mk && mk.k] || '#ff2a5a';
      if (src) { S.arcs.push({ p: src, t: 1.5, mag }); } else S.arcs.push({ p: null, t: 1.2, mag });
      splat(col, 1 + Math.round(mag), mag * 0.8 + 0.4); screenFlash('rgba(255,20,60,.8)', clamp(0.25 + h.dmg / 80, 0.25, 0.6), 320);
      rd.textContent = '-' + Math.round(h.dmg); anim(rd, [{ opacity: 0, transform: 'translateY(8px) scale(1.5)' }, { opacity: 1, transform: 'none', offset: 0.12 }, { opacity: 1, offset: 0.6 }, { opacity: 0, transform: 'translateY(-26px)' }], { duration: 1100 });
    }
    // arcos: siguen a la fuente mientras el jugador gira
    for (let i = S.arcs.length - 1; i >= 0; i--) { const a = S.arcs[i]; a.t -= dt; if (a.t <= 0) S.arcs.splice(i, 1); }
    dirs.forEach((d, i) => { const a = S.arcs[S.arcs.length - 1 - i]; if (!a) { d.style.opacity = 0; return; } const k = clamp(a.t / 1.5, 0, 1), ang = a.p ? bearing(a.p) : 0; d.style.opacity = a.p ? Math.min(1, k * 1.6) : 0; d.style.transform = `rotate(${ang}rad) scale(${0.97 + 0.06 * a.mag})`; });
    // 4) vida baja: viñeta roja que late más rápido cuanto menos vida; ruptura de escudo
    if (me) {
      const hp = me.dead ? 0 : me.hp, k = clamp((42 - hp) / 42, 0, 1); S.pulse += dt * (1.4 + k * 5.5); const beat = 0.5 + 0.5 * Math.sin(S.pulse * 3.3) * (0.6 + 0.4 * Math.sin(S.pulse * 6.6));
      vig.style.opacity = hp <= 0 ? 0.9 : (k > 0 ? (k * (0.45 + 0.55 * beat)).toFixed(3) : 0);
      if (S.lastSh > 0 && me.sh <= 0 && !me.dead) { screenFlash('rgba(102,255,238,.9)', 0.55, 500); showTag('ESCUDO ROTO', '#66ffee'); }
      S.lastSh = me.sh;
    }
    // limpieza del cuadro
    S.hits.length = 0; S.kills.length = 0; S.hurts.length = 0; S.extra.length = 0; S.mon = monsters;
    for (let i = S.myShots.length - 1; i >= 0; i--) if (S.t - S.myShots[i].t > 1.2) S.myShots.splice(i, 1);
  }
  S.skillT = -9;
  function reset() { S.streak = 0; S.streakT = 0; S.arcs.length = 0; S.lastKills = null; S.lastScore = 0; kf.innerHTML = ''; vig.style.opacity = 0; }
  return { onEvent, update, reset, destroy() { root.remove(); }, el: root };
}
