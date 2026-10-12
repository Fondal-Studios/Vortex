// HUD del Huésped (docs/HUESPEDES.md): nombre, 3 habilidades + definitiva con enfriamiento/carga, combo de melee y estados activos.
// Lee sólo el snapshot del jugador propio: mc/ec/s3c (segundos de enfriamiento), ul (carga 0..100), ua (segundos de definitiva activa),
// cmb (combo melee 0..3), bf (máscara de estados). Si un campo falta se trata como 0 (y mv/es, los antiguos, sirven de respaldo).
// En PC dibuja un panel a la derecha; en táctil dibuja una tira compacta arriba a la izquierda y pone el anillo de enfriamiento
// (variable CSS --p, clases .ready/.act, número en data-cd) sobre los botones .tc-mov .tc-esp .tc-s3 .tc-ult .tc-melee.
import { CHARACTERS } from '../sim/data.js';

const STYLE_ID = 'huesped-style';
const CSS = `
#skills{display:none!important}
.hq{position:absolute;right:calc(18px + env(safe-area-inset-right,0px));bottom:190px;width:min(230px,34vw);display:flex;flex-direction:column;gap:5px;pointer-events:none;font-size:12px}
.hq .hn{display:flex;align-items:baseline;gap:8px;padding:0 4px;white-space:nowrap;overflow:hidden}
.hq .hn b{font-size:15px;letter-spacing:.14em;color:var(--hc,#ffe27a);text-shadow:0 0 10px var(--hc,#ffe27a),0 0 3px #000}
.hq .hn small{opacity:.7;font-size:11px;overflow:hidden;text-overflow:ellipsis}
.hq .hs{position:relative;display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:10px;background:#0c0822bb;border:1px solid #ffffff33;overflow:hidden;backdrop-filter:blur(4px);min-height:26px}
.hq .hs kbd{flex:none;min-width:20px;text-align:center;padding:1px 5px;border-radius:5px;border:1px solid #ffe27a99;color:#ffe27a;font:700 11px system-ui}
.hq .hs span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hq .hs em{flex:none;font-style:normal;font-weight:800;font-size:12px;color:#fff;min-width:2.2em;text-align:right}
.hq .hs i{position:absolute;left:0;bottom:0;height:3px;width:100%;background:#5cf2ff;transform-origin:left}
.hq .hs.cd{opacity:.6}.hq .hs.cd i{background:#8a7fb8}
.hq .hs.ult i{background:#ffd23f}.hq .hs.ult.ready{border-color:#ffd23f;box-shadow:0 0 14px #ffd23f88;animation:hqpulse .8s ease-in-out infinite alternate}
.hq .hs.ult.act{border-color:#ff66c4;box-shadow:0 0 14px #ff66c4aa}.hq .hs.ult.act i{background:#ff66c4}
@keyframes hqpulse{from{filter:brightness(1)}to{filter:brightness(1.5)}}
.hq .hm{display:flex;align-items:center;gap:6px;padding:3px 10px;border-radius:10px;background:#0c0822bb;border:1px solid #ffffff22}
.hq .hm kbd{min-width:20px;text-align:center;padding:1px 5px;border-radius:5px;border:1px solid #ffffff55;color:#fff;font:700 11px system-ui}
.hq .hm>span{flex:1}.hq .pip{display:inline-block;width:11px;height:11px;margin-left:4px;border-radius:50%;border:2px solid #ffffff66;vertical-align:middle}.hq .pip.on{background:#ff9a3c;border-color:#ffd23f;box-shadow:0 0 8px #ff9a3c}
.hq .hb{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;min-height:0}
.hq .hb u{text-decoration:none;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.05em;background:#2a1a5acc;border:1px solid #b9a4ff;color:#fff}
.hq.touch{left:calc(12px + env(safe-area-inset-left,0px));right:auto;top:auto;bottom:calc(84px + env(safe-area-inset-bottom,0px));width:auto;max-width:150px;gap:3px}
.hq.touch .hs,.hq.touch .hm{display:none}.hq.touch .hn b{font-size:12px}.hq.touch .hn small{display:none}
.hq.touch .hb{justify-content:flex-start}.hq.touch .hb u{font-size:10px;padding:1px 6px}
.hq.touch .tcm{display:inline-flex}
.hq .tcm{display:none;align-items:center;gap:2px;padding:0 4px}
.hq .tcm .pip{width:8px;height:8px;margin-left:2px}
.tc-btn[data-ring]::before{content:"";position:absolute;inset:-5px;border-radius:50%;pointer-events:none;background:conic-gradient(var(--rc,#5cf2ff) calc(var(--p,1) * 360deg),#ffffff26 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px))}
.tc-btn.ready{box-shadow:0 0 12px var(--rc,#5cf2ff)}.tc-btn.act{background:#ff66c4aa!important;box-shadow:0 0 18px #ff66c4}
.tc-btn.tc-ult.ready{animation:hqpulse .8s ease-in-out infinite alternate}
.hq-ammo{position:absolute;left:50%;transform:translateX(-50%);bottom:150px;min-width:110px;text-align:center;pointer-events:none;font-weight:800;letter-spacing:.06em;text-shadow:0 0 8px #000,0 0 3px #000}
.hq-ammo b{font-size:clamp(18px,3vw,28px);color:#fff}.hq-ammo b span{opacity:.6;font-size:.7em}.hq-ammo.low b{color:#ff6a6a}
.hq-ammo i{display:none;height:4px;margin-top:3px;border-radius:2px;background:#ffffff33;overflow:hidden}.hq-ammo.rel i{display:block}.hq-ammo i u{display:block;height:100%;width:0;background:#7dff9a;text-decoration:none}
.hq-ammo small{display:block;font-size:10px;color:#7dff9a;letter-spacing:.14em}
.hq-ammo.touch{bottom:calc(66px + env(safe-area-inset-bottom,0px))}.hq-ammo.touch b{font-size:16px}
@media (max-height:460px){.hq .hs{min-height:22px;padding:3px 8px}}
`;
const BF = [[1, 'Caparazón'], [2, 'Camuflaje'], [4, 'Sobrecarga'], [8, 'Frenesí'], [16, 'Floración'], [32, 'Metamorfosis'], [64, 'Desfase'], [128, 'Planeo'], [256, 'Barrera']];
const RING = { mov: '#5cf2ff', esp: '#ff9a3c', s3: '#b9a4ff', ult: '#ffd23f', melee: '#ff6a6a' };
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

export function createHuespedHud(rootEl) {
  const doc = rootEl.ownerDocument || document;
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s); }
  const el = doc.createElement('div'); el.className = 'hq'; el.id = 'huesped'; rootEl.appendChild(el);
  const am = doc.createElement('div'); am.className = 'hq-ammo'; am.innerHTML = '<b></b><small></small><i><u></u></i>'; rootEl.appendChild(am);
  let built = '', cache = {};
  const rows = {};
  const build = (C, touch) => {
    el.style.setProperty('--hc', hex(C.color || 0xffe27a));
    const sk = (id, cls, key, name) => `<div class="hs ${cls}" data-k="${id}">${touch ? '' : `<kbd>${key}</kbd>`}<span>${name}</span><em></em><i></i></div>`;
    el.innerHTML = `<div class="hn"><b>${(C.name || '').toUpperCase()}</b><small>${C.title || ''}</small><span class="tcm"></span></div>` +
      sk('mov', 'mov', 'F', C.mov ? C.mov.name : 'Habilidad 1') + sk('esp', 'esp', 'G', C.esp ? C.esp.name : 'Habilidad 2') +
      sk('s3', 's3', 'Z', C.s3 ? C.s3.name : 'Habilidad 3') + sk('ult', 'ult', 'R', C.ult ? C.ult.name : 'Definitiva') +
      `<div class="hm"><kbd>V</kbd><span>Melee<span class="pips"></span></span></div><div class="hb"></div>`;
    for (const k of ['mov', 'esp', 's3', 'ult']) { const r = el.querySelector(`[data-k="${k}"]`); rows[k] = { r, em: r.querySelector('em'), bar: r.querySelector('i') }; }
    rows.pips = el.querySelector('.hm .pips'); rows.tcm = el.querySelector('.tcm'); rows.hb = el.querySelector('.hb'); rows.hm = el.querySelector('.hm');
    const pips = '<span class="pip"></span><span class="pip"></span><span class="pip"></span>';
    rows.pips.innerHTML = pips; rows.tcm.innerHTML = pips; cache = {};
  };
  const setBtn = (sel, p, rc, cdSec, ready, act, label) => {
    const b = doc.querySelector(sel); if (!b) return;
    b.dataset.ring = '1'; b.style.setProperty('--p', String(p.toFixed(3))); b.style.setProperty('--rc', rc);
    if (cdSec > 0.05) b.dataset.cd = String(Math.ceil(cdSec)); else delete b.dataset.cd;
    b.classList.toggle('ready', ready); b.classList.toggle('act', act);
    if (label && b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
  };

  /** me = jugador propio del snapshot (o null). touch = ¿hay botones táctiles? */
  function update(me, touch = false, hudVisible = true) {
    const C = me && CHARACTERS[me.char];
    if (!C || !hudVisible || me.dead) { el.style.display = 'none'; am.style.display = 'none'; return; }
    el.style.display = ''; el.classList.toggle('touch', !!touch);
    const key = `${me.char}|${touch}`; if (key !== built) { built = key; build(C, touch); }
    const cd = (sec, frac, def) => (sec != null ? +sec || 0 : (+frac || 0) * (def ? def.cd : 0));
    const mc = cd(me.mc, me.mv, C.mov), ec = cd(me.ec, me.es, C.esp), s3c = +me.s3c || 0, ul = +me.ul || 0, ua = +me.ua || 0, cmb = Math.max(0, Math.min(3, me.cmb | 0)), bf = me.bf | 0;
    const ultMax = (C.ult && C.ult.charge) || 100;
    const skill = (k, sec, def) => {
      const total = Math.max(0.01, def ? def.cd : 1), p = sec > 0.01 ? 1 - Math.min(1, sec / total) : 1, ready = sec <= 0.01 && !!def, row = rows[k];
      const sig = `${Math.ceil(sec * 10)}`; if (cache[k] !== sig) { cache[k] = sig; row.r.classList.toggle('cd', sec > 0.01); row.em.textContent = sec > 0.01 ? `${Math.ceil(sec)} s` : 'LISTA'; row.bar.style.transform = `scaleX(${p})`; }
      setBtn(`.tc-${k}`, p, RING[k], sec, ready, false, def ? def.name : '');
    };
    skill('mov', mc, C.mov); skill('esp', ec, C.esp); skill('s3', s3c, C.s3);
    { // definitiva: carga 0..100, «lista» al llegar, y cuenta atrás mientras está activa
      const row = rows.ult, active = ua > 0.05, ready = !active && ul >= ultMax - 0.01, p = active ? Math.min(1, ua / 12) : Math.min(1, ul / ultMax);
      const sig = `${active}|${ready}|${Math.round(ul)}|${Math.ceil(ua)}`;
      if (cache.ult !== sig) { cache.ult = sig; row.r.classList.toggle('ready', ready); row.r.classList.toggle('act', active); row.em.textContent = active ? `${Math.ceil(ua)} s` : ready ? '¡LISTA!' : `${Math.floor(ul)}%`; row.bar.style.transform = `scaleX(${p})`; }
      setBtn('.tc-ult', p, active ? '#ff66c4' : RING.ult, 0, ready, active, C.ult ? C.ult.name : '');
      const b = doc.querySelector('.tc-ult'); if (b) { if (active) b.dataset.cd = String(Math.ceil(ua)); else delete b.dataset.cd; }
    }
    { // combo de melee
      const sig = `c${cmb}`; if (cache.cmb !== sig) { cache.cmb = sig; for (const host of [rows.pips, rows.tcm]) host.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', i < cmb)); }
      setBtn('.tc-melee', cmb / 3, RING.melee, 0, cmb >= 3, false, 'Melee');
    }
    { // munición: «cargador / reserva» (reserva -1 = ∞) y barrita mientras recarga
      const has = me.cl != null && me.cm != null; am.style.display = has ? '' : 'none'; am.classList.toggle('touch', !!touch);
      if (has) { const rl = +me.rl || 0, rs = me.rs == null ? '' : me.rs < 0 ? '∞' : me.rs, sig = `${me.cl}|${me.cm}|${rs}|${rl > 0}`;
        if (cache.am !== sig) { cache.am = sig; am.querySelector('b').innerHTML = `${me.cl}${rs === '' ? '' : ` <span>/ ${rs}</span>`}`; am.classList.toggle('low', me.cm > 0 && me.cl <= Math.max(1, me.cm * 0.25)); am.classList.toggle('rel', rl > 0); am.querySelector('small').textContent = rl > 0 ? 'RECARGANDO' : (me.cl === 0 ? 'RECARGÁ' : ''); }
        am.querySelector('u').style.width = `${Math.round(Math.min(1, rl) * 100)}%`;
        setBtn('.tc-reload', rl > 0 ? rl : (me.cm > 0 ? me.cl / me.cm : 1), '#7dff9a', 0, me.cl === 0 && rl === 0, rl > 0, 'Recargar'); }
    }
    { // estados activos
      const sig = `b${bf}`; if (cache.bf !== sig) { cache.bf = sig; rows.hb.innerHTML = BF.filter(([m]) => bf & m).map(([, n]) => `<u>${n}</u>`).join(''); }
    }
  }
  return { update, el };
}
