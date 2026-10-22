// HUD del Huésped (docs/HUESPEDES.md): nombre, 3 habilidades + definitiva con enfriamiento, combo de melee y estados activos.
// Lee sólo el snapshot del jugador propio: mc/ec/s3c (segundos de enfriamiento), ud (segundos hasta definitiva), ua (segundos de definitiva activa),
// cmb (combo melee 0..3), bf (máscara de estados). Si un campo falta se trata como 0 (y mv/es, los antiguos, sirven de respaldo).
// En PC dibuja un panel a la derecha; en táctil dibuja una tira compacta arriba a la izquierda y pone el anillo de enfriamiento
// (variable CSS --p, clases .ready/.act, número en data-cd) sobre los botones .tc-mov .tc-esp .tc-s3 .tc-ult .tc-melee.
// Visible combat strip: basic attack + physical movement/defence, support and ultimate. Legacy rows stay hidden.
import { combatSkills, skillImage } from './skill-images.js';
import { SUPPORT } from '../shared/skill-path.js';
import { CHARACTERS, HABILIDADES } from '../sim/data.js';
import { habSlots, MODOS } from '../sim/modos.js';   // las 3 habilidades por modo (Disparo / Melé)

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
.hq.touch{left:calc(12px + env(safe-area-inset-left,0px));right:auto;top:calc(86px + env(safe-area-inset-top,0px));bottom:auto;width:auto;max-width:150px;gap:3px}
.hq .hmode{flex:none;font-size:10px;font-weight:800;letter-spacing:.08em;padding:1px 7px;border-radius:999px;border:1px solid #ffe27a99;color:#ffe27a;background:#0c0822bb}
.hq.touch .hmode{display:none}
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
.hq-ammo.touch{left:calc(176px + env(safe-area-inset-left,0px));transform:none;bottom:calc(60px + env(safe-area-inset-bottom,0px));min-width:0;text-align:left;display:flex;align-items:baseline;gap:8px}.hq-ammo.touch b{font-size:17px}.hq-ammo.touch small{display:inline}.hq-ammo.touch i{width:70px;margin:0;align-self:center}
@media (max-height:460px){.hq .hs{min-height:22px;padding:3px 8px}}
`;
const BF = [[1, 'Caparazón'], [2, 'Camuflaje'], [4, 'Sobrecarga'], [8, 'Frenesí'], [16, 'Floración'], [32, 'Metamorfosis'], [64, 'Desfase'], [128, 'Planeo'], [256, 'Barrera'], [512, 'Enjambre furioso']];
const RING = { mov: '#5cf2ff', esp: '#ff9a3c', s3: '#b9a4ff', ult: '#ffd23f', melee: '#ff6a6a' };
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

export function createHuespedHud(rootEl) {
  const doc = rootEl.ownerDocument || document;
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s); }
  const el = doc.createElement('div'); el.className = 'hq'; el.id = 'huesped'; rootEl.appendChild(el);
  const am = doc.createElement('div'); am.className = 'hq-ammo'; am.innerHTML = '<b></b><small></small><i><u></u></i>'; rootEl.appendChild(am);
  const ch = doc.createElement('div'); ch.id = 'combohud'; ch.innerHTML = '<b></b><small></small><u><s></s></u>'; rootEl.appendChild(ch);   // contador de combo (modo Combo)
  const eh = doc.createElement('div'); eh.id = 'estilohud'; eh.innerHTML = '<b></b><u><s></s></u><small></small>'; rootEl.appendChild(eh);   // rango de estilo D/C/B/A/S + bajas de un golpe (progresion.js)
  let built = '', cache = {}, me0 = null;
  const rows = {};
  const build = (C, touch, combo) => {
    el.style.setProperty('--hc', hex(C.color || 0xffe27a));
    const S = habSlots(me0.char, combo ? 'combo' : 'shooter'), M = MODOS[combo ? 'combo' : 'shooter'];
    const keys = combo ? ['F·1', 'G·2', 'Z·3'] : ['F', 'G', 'Z'];
    const sk = (id, cls, key, name) => `<div class="hs ${cls}" data-k="${id}">${touch ? '' : `<kbd>${key}</kbd>`}<span>${name}</span><em></em><i></i></div>`;
    el.innerHTML = `<div class="hn"><b>${(C.name || '').toUpperCase()}</b><small>${C.title || ''}</small><span class="hmode">${M.icono} ${M.nombre.toUpperCase()} · Tab</span><span class="tcm"></span></div>` +
      `<div class="hs basic" data-k="fire"><kbd>Clic</kbd><span>Atacar</span><em></em><i></i></div>` + ['mov', 'esp', 's3'].map((k, i) => sk(k, k, keys[i], S[i].name)).join('') + sk('ult', 'ult', 'T', C.ult ? C.ult.name : 'Definitiva') +
      `<div class="hm"><kbd>${combo ? 'A1·A2' : 'V'}</kbd><span>${combo ? 'Combo' : 'Melé'}<span class="pips"></span></span></div><div class="hb"></div>`;
    for (const k of ['fire', 'mov', 'esp', 's3', 'ult']) { const r = el.querySelector(`[data-k="${k}"]`); rows[k] = { r, em: r.querySelector('em'), bar: r.querySelector('i') }; }
    for (const action of combatSkills(me0.char, combo ? 'combo' : 'shooter', me0.sk)) {
      const row = rows[action.key].r; row.insertAdjacentHTML('afterbegin', `<img class="skill-art" src="${skillImage(action.id)}" alt="">`); row.title = `${action.name || action.short}: ${action.desc || ''}`; row.querySelector('span').textContent = action.name || action.short; row.querySelector('kbd')?.replaceChildren(action.hotkey);
    }
    rows.pips = el.querySelector('.hm .pips'); rows.tcm = el.querySelector('.tcm'); rows.hb = el.querySelector('.hb'); rows.hm = el.querySelector('.hm'); rows.slots = S;
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
    if (!C || !hudVisible || me.dead) { el.style.display = 'none'; am.style.display = 'none'; ch.classList.remove('on'); return; }
    el.style.display = ''; el.classList.toggle('touch', !!touch);
    el.classList.toggle('learning', me.sk != null); el.dataset.skills = String(me.sk ?? '');
    doc.body.classList.toggle('learning-skills', me.sk != null);
    me0 = me; const combo = !!me.md; doc.body.classList.toggle('modo-combo', combo);   // en Combo no hay barra de armas ni munición
    const key = `${me.char}|${touch}|${combo}|${me.sk}`; if (key !== built) { built = key; build(C, touch, combo); }
    const cd = (sec, frac, def) => (sec != null ? +sec || 0 : (+frac || 0) * (def ? def.cd : 0));
    const mc = cd(me.mc, me.mv, C.mov), ec = cd(me.ec, me.es, C.esp), s3c = +me.s3c || 0, uc = +me.ud || 0, ua = +me.ua || 0, cmb = Math.max(0, Math.min(3, me.cmb | 0)), bf = me.bf | 0;

    // una fila/botón por SLOT (mov = HAB.1, esp = HAB.2, s3 = HAB.3); de dónde sale cada uno lo dice modos.js (en Melé el slot 3 es la principal de Combo)
    const skill = (k, sec, def, extra = {}) => {
      const total = Math.max(0.01, extra.total || (def ? def.cd : 1)), p = sec > 0.01 ? 1 - Math.min(1, sec / total) : 1, ready = sec <= 0.01 && !!def, row = rows[k], act = !!extra.act;
      const sig = `${Math.ceil(sec * 10)}|${act}`; if (cache[k] !== sig) { cache[k] = sig; row.r.classList.toggle('cd', sec > 0.01 && !act); row.r.classList.toggle('ready', ready && !act); row.r.classList.toggle('act', act); row.em.textContent = act ? '¡YA!' : sec > 0.01 ? `${Math.ceil(sec)} s` : 'LISTA'; row.bar.style.transform = `scaleX(${p})`; }
      setBtn(`.tc-${k}`, p, RING[k], act ? 0 : sec, ready || act, act, def ? def.name : '');
    };
    {
      const S = rows.slots, H = HABILIDADES[me.char], hc = +me.hc || 0, hw = +me.hw || 0, hx = +me.hx || (H ? H.cd : 1);
      const val = { mov: [mc, C.mov, {}], esp: [ec, C.esp, {}], s3: [s3c, C.s3, {}], hab: [hc, H, { total: hx, act: hw > 0 }] };
      ['mov', 'esp', 's3'].forEach((k, i) => { const v = val[S[i].src]; skill(k, v[0], v[1], v[2]); });
    }
    { // definitiva: cooldown en segundos y duración mientras está activa
      const row = rows.ult, active = ua > 0.05, ready = !active && uc <= .01, p = active ? Math.min(1, ua / 12) : 1 - Math.min(1, uc / Math.max(1, me.ux || C.ult?.cd || 60));
      const sig = `${active}|${ready}|${Math.ceil(uc)}|${Math.ceil(ua)}`;
      if (cache.ult !== sig) { cache.ult = sig; row.r.classList.toggle('ready', ready); row.r.classList.toggle('act', active); row.em.textContent = active ? `${Math.ceil(ua)} s` : ready ? '¡LISTA!' : `${Math.ceil(uc)} s`; row.bar.style.transform = `scaleX(${p})`; }
      setBtn('.tc-ult', p, active ? '#ff66c4' : RING.ult, active ? ua : uc, ready, active, C.ult ? C.ult.name : '');

    }
    { // Four-action HUD always depicts physical powers, independent of melee slot routing.
      const source = SUPPORT[me.char] || 'esp', def = C[source];
      skill('mov', mc, C.mov);
      skill('esp', source === 's3' ? s3c : ec, def);
      rows.esp.r.querySelector('span').textContent = def?.name || 'Apoyo';
      const kb = rows.esp.r.querySelector('kbd'); if (kb) kb.textContent = 'Q';
      rows.esp.r.title = def?.desc || '';
      rows.ult.r.title = C.ult?.desc || '';
      if (me.sk != null && me.sk < 1) { rows.esp.em.textContent = 'Oleada 1'; rows.esp.r.classList.remove('ready'); rows.esp.bar.style.transform = 'scaleX(0)'; }
      if (me.sk != null && me.sk < 2) { rows.ult.em.textContent = 'Oleada 3'; rows.ult.r.classList.remove('ready','act'); rows.ult.bar.style.transform = 'scaleX(0)'; }
      rows.esp.r.classList.toggle('locked', me.sk != null && me.sk < 1); rows.ult.r.classList.toggle('locked', me.sk != null && me.sk < 2);
      // Touch labels and rings always describe the physical support, independent of mode.
      for (const action of combatSkills(me.char, combo ? 'combo' : 'shooter', me.sk)) {
        const b = doc.querySelector(`.tc-${action.key}`); if (!b) continue;
        b.dataset.locked = action.locked ? action.unlock : '';
        b.setAttribute('aria-disabled', String(!!action.locked));
        if (action.locked) { b.classList.remove('ready','act'); delete b.dataset.cd; b.style.setProperty('--p','0'); }
      }
      const ub = doc.querySelector('.tc-ult'); if (ub) ub.dataset.cooldownLabel = ua > .05 ? `${Math.ceil(ua)}s` : uc <= .01 ? 'LISTA' : `${Math.ceil(uc)} s`;
    }
    { // contador de combo grande (modo Combo): ×N, nombre del último golpe y barra de la ventana
      const n = combo ? (me.cn | 0) : 0, w = combo ? +me.cw || 0 : 0, on = n > 0 && w > 0, cp = me.char === 'danzante' ? ((me.bf | 0) >> 16) & 7 : 0, sig = `${on}|${n}|${me.cnm}|${cp}`;   // cp = compás de la Danzante (bits 16-18 de bf)
      if (cache.ch !== sig) { cache.ch = sig; ch.classList.toggle('on', on); if (on) { ch.querySelector('b').innerHTML = `×${n}<i>COMBO</i>`; ch.querySelector('small').textContent = (me.cnm || '') + (cp ? `  ·  COMPÁS ${'♪'.repeat(cp)}` : ''); ch.classList.remove('pop'); void ch.offsetWidth; ch.classList.add('pop'); } }
      ch.querySelector('s').style.transform = `scaleX(${Math.min(1, w / 0.9)})`;
      if (!combo) ch.classList.remove('on');
      // Melé: el anillo del botón de ataque 1 muestra cuánto falta para que se corte la cadena (ventana de encadenado)
      const fb = doc.querySelector('.tc-fire'); if (fb) { if (combo && on) setBtn('.tc-fire', Math.min(1, w / 0.9), '#ffd23f', 0, false, false); else if (fb.dataset.ring) { delete fb.dataset.ring; fb.classList.remove('ready', 'act'); } }
    }
    { // Primary action cooldown is authoritative (fire cadence, melee recovery, or reload).
      const sec = +me.ac || 0, b = doc.querySelector('.tc-fire');
      const text = sec > .05 ? (sec < 1 ? sec.toFixed(1) : String(Math.ceil(sec))) : '';
      if (b) { if (text) b.dataset.cd = text; else delete b.dataset.cd; }
      rows.fire.em.textContent = text ? text + ' s' : 'ATACAR';
    }
    { // rango de estilo (D → S) y bajas del multi-kill en curso: mínimo, arriba a la derecha del combo
      const rk = combo ? me.rk | 0 : 0, mk = me.mk | 0, rp = combo ? +me.rp || 0 : 0, on = combo && (rk > 0 || rp > 0.05 || mk >= 2), sig = `${on}|${rk}|${mk}`;
      if (cache.eh !== sig) { cache.eh = sig; eh.classList.toggle('on', on); eh.dataset.r = String('DCBAS'[rk] || 'D'); eh.querySelector('b').textContent = 'DCBAS'[rk] || 'D'; eh.querySelector('small').textContent = mk >= 2 ? `${mk} BAJAS` : ''; eh.classList.remove('pop'); void eh.offsetWidth; eh.classList.add('pop'); }
      eh.querySelector('s').style.transform = `scaleX(${Math.min(1, rp)})`;
    }
    { // combo de melee
      const sig = `c${cmb}`; if (cache.cmb !== sig) { cache.cmb = sig; for (const host of [rows.pips, rows.tcm]) host.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('on', i < cmb)); }
      setBtn('.tc-melee', cmb / 3, RING.melee, 0, cmb >= 3, false, 'Melé rápido');
    }
    { // munición: «cargador / reserva» (reserva -1 = ∞) y barrita mientras recarga
      const has = me.cl != null && me.cm != null && !combo; am.style.display = has ? '' : 'none'; am.classList.toggle('touch', !!touch);
      if (has) { const rl = +me.rl || 0, rs = me.rs == null ? '' : me.rs < 0 ? '∞' : me.rs, sig = `${me.cl}|${me.cm}|${rs}|${rl > 0}`;
        if (cache.am !== sig) { cache.am = sig; am.querySelector('b').innerHTML = `${me.cl}${rs === '' ? '' : ` <span>/ ${rs}</span>`}`; am.classList.toggle('low', me.cm > 0 && me.cl <= Math.max(1, me.cm * 0.25)); am.classList.toggle('rel', rl > 0); am.querySelector('small').textContent = rl > 0 ? 'RECARGANDO' : (me.cl === 0 ? 'RECARGÁ' : ''); }
        am.querySelector('u').style.width = `${Math.round(Math.min(1, rl) * 100)}%`;
        setBtn('.tc-reload', rl > 0 ? rl : (me.cm > 0 ? me.cl / me.cm : 1), '#7dff9a', 0, me.cl === 0 && rl === 0, rl > 0, 'Recargar'); }
      if (combo) { const rb = doc.querySelector('.tc-reload'); if (rb) { if (rb.dataset.ring) { delete rb.dataset.ring; rb.classList.remove('ready', 'act'); } if (rb.getAttribute('aria-label') !== 'Ataque 2') rb.setAttribute('aria-label', 'Ataque 2'); } }   // en Melé ese botón es ATAQUE 2: sin anillo de munición
    }
    { // estados activos
      const un = me.char === 'colmena' ? `${me.un | 0}/${me.uc | 0}` : '', sig = `b${bf}|${un}`;   // Colmena: cuántos zánganos tiene vivos / su límite
      if (cache.bf !== sig) { cache.bf = sig; rows.hb.innerHTML = (un ? `<u>Zánganos ${un}</u>` : '') + BF.filter(([m]) => bf & m).map(([, n]) => `<u>${n}</u>`).join(''); }
    }
  }
  return { update, el };
}
