// HUD de la evolución en partida (docs/HUESPEDES.md → «Evolución»): contador de núcleos de la partida (co), nivel actual (evo), barra hacia el
// siguiente nivel (evn) y, cuando co ≥ evn, el aviso «¡Podés evolucionar!» con la tecla N (B ya es «marcar» y T la definitiva) y un botón táctil/clic que envía input.evo.
// Al llegar el evento {t:'evolve', pid, tier} de la simulación: destello, onda y texto «EVOLUCIÓN: <nombre del nivel>».
//   const evoHud = createEvoHud($('hud'));
//   evoHud.update(me, touch, hudVisible);          // una vez por cuadro (me = jugador propio del snapshot)
//   evoHud.celebrate(tier);                        // al recibir el evento evolve propio
//   evoHud.held()                                  // true mientras se aprieta el botón (main.js lo suma a input.evo)
import { EVO_TIERS, CHARACTERS, ESSENCES, ESSENCE_OF } from '../sim/data.js';
const ESS_KEYS = ['carne', 'cristal', 'ojo', 'vacio'];

/** Tecla de evolucionar en PC (B quedó para marcar, T para la definitiva, R recargar). */
export const EVO_KEY = { code: 'KeyN', label: 'N' };
const STYLE_ID = 'evohud-style';
const CSS = `
#evohud{position:absolute;left:calc(14px + env(safe-area-inset-left,0px));top:calc(66px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:5px;align-items:flex-start;pointer-events:none;font-size:12px;max-width:min(46vw,260px);z-index:6}
#evohud .eh-row{display:flex;align-items:center;gap:8px;padding:4px 10px;border-radius:12px;background:#0c0822bb;border:1px solid #ffffff2e;backdrop-filter:blur(4px);white-space:nowrap}
#evohud .eh-row i{font-style:normal;color:var(--hc,#ffe27a);text-shadow:0 0 8px var(--hc,#ffe27a)}
#evohud .eh-row b{font-size:15px;color:#fff;font-variant-numeric:tabular-nums}
#evohud .eh-lv{font-size:10px;letter-spacing:.1em;text-transform:uppercase;opacity:.85}
#evohud .eh-bar{position:relative;width:54px;height:5px;border-radius:3px;background:#ffffff26;overflow:hidden;flex:none}
#evohud .eh-bar u{position:absolute;left:0;top:0;bottom:0;background:var(--hc,#ffe27a);border-radius:3px;transition:width .3s}
#evohud .eh-ess{display:flex;gap:6px;padding:2px 8px;border-radius:10px;background:#0c0822a0;border:1px solid #ffffff1e;font-size:11px;white-space:nowrap}
#evohud .eh-ess span{display:inline-flex;align-items:center;gap:3px;color:#fff;font-variant-numeric:tabular-nums}
#evohud .eh-ess i{width:7px;height:7px;border-radius:50%;background:var(--e);box-shadow:0 0 6px var(--e)}
#evohud .eh-ess span.pop{animation:ehess .5s ease-out}@keyframes ehess{0%{transform:scale(1.7)}100%{transform:scale(1)}}
.eh-fly{position:fixed;z-index:8;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--e);box-shadow:0 0 12px 3px var(--e);pointer-events:none;transition:transform .7s cubic-bezier(.5,0,.8,.4),opacity .7s}
#evohud .eh-go{pointer-events:auto;display:none;align-items:center;gap:8px;min-height:44px;padding:6px 14px;border-radius:22px;border:2px solid var(--hc,#ffe27a);background:#1a1040e6;color:#fff;font:800 13px/1.1 system-ui,sans-serif;letter-spacing:.06em;cursor:pointer;box-shadow:0 0 18px var(--hc,#ffe27a);animation:ehpulse .7s ease-in-out infinite alternate;touch-action:none;user-select:none;-webkit-user-select:none}
#evohud .eh-go kbd{padding:1px 6px;border-radius:5px;border:1px solid #ffffff99;font:700 11px system-ui}
#evohud.ready .eh-go{display:inline-flex}
#evohud.touch{top:calc(150px + env(safe-area-inset-top,0px))}
#evohud.touch .eh-go kbd{display:none}
@keyframes ehpulse{from{filter:brightness(1);transform:scale(1)}to{filter:brightness(1.4);transform:scale(1.04)}}
#evofx{position:absolute;inset:0;pointer-events:none;z-index:7;display:none;align-items:center;justify-content:center;overflow:hidden}
#evofx.on{display:flex}
#evofx::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,var(--hc,#fff) 0,#ffffffcc 8%,transparent 60%);opacity:0;animation:evflash 1.1s ease-out forwards}
#evofx .ef-ring{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;border:5px solid var(--hc,#fff);box-shadow:0 0 30px var(--hc,#fff),inset 0 0 30px var(--hc,#fff);opacity:0;animation:evring 1.1s ease-out forwards}
#evofx .ef-txt{position:relative;text-align:center;font:900 clamp(22px,5vw,46px)/1.05 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#fff;text-shadow:0 0 22px var(--hc,#fff),0 0 4px #000;opacity:0;animation:evtxt 2.4s ease-out forwards}
#evofx .ef-txt small{display:block;margin-top:6px;font-size:.38em;letter-spacing:.2em;color:#fff;opacity:.9}
@keyframes evflash{0%{opacity:0}12%{opacity:.85}100%{opacity:0}}
@keyframes evring{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(48)}}
@keyframes evtxt{0%{opacity:0;transform:scale(.7)}12%{opacity:1;transform:scale(1.08)}22%{transform:scale(1)}78%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){#evofx::before,#evofx .ef-ring{animation:none;opacity:0}}
@media (max-height:460px){#evohud{font-size:11px}#evohud .eh-go{min-height:40px;font-size:12px}#evohud.touch{top:calc(128px + env(safe-area-inset-top,0px))}}
`;
const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');

export function createEvoHud(rootEl) {
  const doc = rootEl.ownerDocument || document;
  if (!doc.getElementById(STYLE_ID)) { const s = doc.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; doc.head.appendChild(s); }
  const el = doc.createElement('div'); el.id = 'evohud'; el.setAttribute('aria-live', 'polite');
  el.innerHTML = '<div class="eh-row"><i aria-hidden="true">◆</i><b class="eh-n">0</b><span class="eh-lv"></span><span class="eh-bar"><u></u></span></div><div class="eh-ess" aria-label="Esencias absorbidas"></div><button type="button" class="eh-go" aria-label="Evolucionar"><span>¡Podés evolucionar!</span><kbd>' + EVO_KEY.label + '</kbd></button>';
  rootEl.appendChild(el);
  const fx = doc.createElement('div'); fx.id = 'evofx'; fx.setAttribute('aria-hidden', 'true'); rootEl.appendChild(fx);
  const n = el.querySelector('.eh-n'), lv = el.querySelector('.eh-lv'), bar = el.querySelector('.eh-bar u'), go = el.querySelector('.eh-go');
  const essEl = el.querySelector('.eh-ess'); let essSig = '';
  let held = false, tapT = 0, cache = '', hostColor = 0xffe27a, fxTimer = 0;
  const press = (e) => { e.preventDefault(); e.stopPropagation(); held = true; tapT = performance.now(); };
  const release = () => { held = false; };
  go.addEventListener('pointerdown', press); go.addEventListener('pointerup', release); go.addEventListener('pointercancel', release); go.addEventListener('pointerleave', release);
  go.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); held = true; tapT = performance.now(); setTimeout(release, 120); });
  const api = {
    el,
    /** ¿está apretado el botón (o se tocó hace menos de 150 ms)? */
    held() { return held || (tapT && performance.now() - tapT < 150); },
    update(me, touch = false, hudVisible = true) {
      if (!me || !hudVisible || me.dead || me.co == null) { el.style.display = 'none'; return; }
      el.style.display = ''; el.classList.toggle('touch', !!touch);
      const C = CHARACTERS[me.char]; if (C && C.color !== hostColor) { hostColor = C.color; el.style.setProperty('--hc', hex(hostColor)); fx.style.setProperty('--hc', hex(hostColor)); }
      const co = me.co | 0, evo = me.evo | 0, need = me.evn | 0, ready = need > 0 && co >= need, sig = `${co}|${evo}|${need}`;
      if (sig !== cache) {
        cache = sig; n.textContent = String(co); lv.textContent = `Nv. ${evo}${need > 0 ? ` · ${need} para ${evo + 1}` : ' · máx.'}`;
        bar.style.width = need > 0 ? Math.min(100, (co / need) * 100) + '%' : '100%';
      }
      el.classList.toggle('ready', ready);
      if (Array.isArray(me.ess)) { const es = me.ess.join(); if (es !== essSig) { const old = essSig ? essSig.split(',') : null; essSig = es; essEl.innerHTML = ESS_KEYS.map((k, i) => `<span data-k="${k}" title="${ESSENCES[k].name}" style="--e:#${ESSENCES[k].color.toString(16).padStart(6, '0')}"><i></i>${me.ess[i] | 0}</span>`).join(''); if (old) essEl.querySelectorAll('span').forEach((sp, i) => { if (+old[i] !== (me.ess[i] | 0)) sp.classList.add('pop'); }); } }
    },
    /** Estela de color desde (x, y) de la pantalla hacia el contador de esencias (la criatura `kind` murió ahí). */
    absorb(x, y, kind) {
      const k = ESSENCE_OF[kind], c = k && ESSENCES[k]; if (!c || el.style.display === 'none') return; const t = essEl.querySelector(`[data-k="${k}"]`) || essEl, r = t.getBoundingClientRect();
      const d = doc.createElement('i'); d.className = 'eh-fly'; d.style.setProperty('--e', hex(c.color)); d.style.left = x + 'px'; d.style.top = y + 'px'; rootEl.ownerDocument.body.appendChild(d);
      requestAnimationFrame(() => { d.style.transform = `translate(${r.left + r.width / 2 - x}px, ${r.top + r.height / 2 - y}px) scale(.4)`; d.style.opacity = '0.2'; }); setTimeout(() => d.remove(), 800);
    },
    /** Al crecer un órgano (evento organ): texto breve. */
    organ(name) {
      fx.innerHTML = `<div class="ef-txt" style="font-size:clamp(16px,3.4vw,30px)">¡Creció un órgano!<small>${name}</small></div>`; fx.classList.remove('on'); void fx.offsetWidth; fx.classList.add('on'); clearTimeout(fxTimer); fxTimer = setTimeout(() => fx.classList.remove('on'), 2500);
    },
    /** Destello + onda + texto «EVOLUCIÓN: <nivel>». */
    celebrate(tier) {
      const t = EVO_TIERS[Math.max(0, Math.min(4, tier | 0))]; fx.innerHTML = `<i class="ef-ring"></i><div class="ef-txt">EVOLUCIÓN: ${t.name}<small>Nivel ${tier} de 4</small></div>`;
      fx.classList.remove('on'); void fx.offsetWidth; fx.classList.add('on'); clearTimeout(fxTimer); fxTimer = setTimeout(() => fx.classList.remove('on'), 2500);
    },
    dispose() { el.remove(); fx.remove(); },
  };
  return api;
}
