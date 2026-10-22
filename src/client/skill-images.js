// Vector pictograms depict each actual power, rather than shared Unicode glyphs.
import { CHARACTERS } from '../sim/data.js';
import { SUPPORT } from '../shared/skill-path.js';
const art = {
 disparo:'<path d="M13 39L38 14l10 10-25 25zM19 33l12 12M40 12l6-6m3 13 8-2M33 8l2-6"/><circle cx="34" cy="28" r="4"/>',
 melee:'<path d="M17 48l27-30 7-5-2 12-25 28M14 38l15 14M11 54l8-9M25 14l-6-7m23 38 9 5"/>',
 impulso:'<path d="M8 23h23M5 32h20M9 41h18M29 15l20 17-20 17 5-17z"/>',
 fase:'<path d="M30 11a21 21 0 100 42M33 18l-12 14 12 14M22 32h30"/><path opacity=".5" d="M42 18v28M50 22v20"/>',
 paso:'<ellipse cx="17" cy="32" rx="8" ry="21"/><ellipse cx="47" cy="32" rx="8" ry="21"/><path d="M22 32h20m-7-7 7 7-7 7"/>',
 barrera:'<path d="M12 22l20-12 20 12v24H12zM22 17v29m20-29v29M12 31h40"/><path d="M6 13l6 5m46-5-6 5"/>',
 planeo:'<path d="M32 44C25 23 10 30 6 12c18 2 22 10 26 22 4-12 8-20 26-22-4 18-19 11-26 32zM32 34v20"/>',
 pirueta:'<path d="M45 13A23 23 0 1016 51M44 6l2 9-10 1M20 54l-6-4 4-8"/><path d="M23 32l9-12 9 12-9 12z"/>',
 honda:'<ellipse cx="32" cy="32" rx="24" ry="11" transform="rotate(-35 32 32)"/><circle cx="32" cy="32" r="7"/><path d="M47 18l7-6m-9 0 9 0-1 9"/>',
 zumbido:'<path d="M24 27C6 6 4 35 24 32m16-5C58 6 60 35 40 32M26 20l6-5 6 5v25l-6 7-6-7zM26 30h12M26 38h12"/>',
 espinas:'<path d="M8 49l12-27 3 21zM25 53l8-44 8 44-8-8zM43 43l3-21 12 27z"/>',
 marca:'<circle cx="32" cy="32" r="15"/><path d="M32 6v14m0 24v14M6 32h14m24 0h14M26 32l5 5 8-10"/>',
 esporas:'<path d="M14 43a10 10 0 010-20 16 16 0 0131-2 11 11 0 011 22z"/><circle cx="23" cy="31" r="2"/><circle cx="39" cy="32" r="2"/><path d="M21 51v4m11-7v8m11-5v4"/>',
 singularidad:'<circle cx="32" cy="32" r="9"/><path d="M8 32h12m-5-5 5 5-5 5m41-5H44m5-5-5 5 5 5M32 8v12m-5-5 5 5 5-5m-5 41V44m-5 5 5-5 5 5"/>',
 pulso:'<circle cx="32" cy="32" r="24"/><path d="M11 32h12l5-11 8 23 5-12h12"/>',
 cria:'<path d="M19 13l8-5 8 5v10l-8 5-8-5zM6 36l8-5 8 5v10l-8 5-8-5zM39 36l8-5 8 5v10l-8 5-8-5zM31 32v17m-6-6 6 6 6-6"/>',
 cintas:'<path d="M10 14c42 0 42 36 0 36m44-36C12 14 12 50 54 50M8 32h48M15 26l-7 6 7 6m34-12 7 6-7 6"/>',
 pozo:'<ellipse cx="32" cy="42" rx="24" ry="10"/><ellipse cx="32" cy="42" rx="12" ry="4"/><path d="M32 8v25m-7-7 7 7 7-7M12 15l8 13m32-13-8 13"/>',
 sobrecarga:'<path d="M35 6L16 36h14l-3 22 21-33H34zM8 16l7 5m41-5-7 5M7 49l9-4m41 4-9-4"/>',
 frenesi:'<path d="M14 10l6 20-6 24M29 7l6 23-6 27M44 10l6 20-6 24"/>',
 floracion:'<path d="M32 31C6 7 12 54 32 39c20 15 26-32 0-8zM32 31c-17-24 17-24 0 0M32 39v18M32 50l-11-6m11 9 11-9"/>',
 colapso:'<circle cx="32" cy="32" r="12"/><path d="M5 8l17 14m-11 0h11V11M59 8L42 22m11 0H42V11M5 56l17-14m-11 0h11v11m37 3L42 42m11 0H42v11"/>',
 metamorfosis:'<path d="M32 50C3 55 5 9 10 10l22 21 22-21c5-1 7 45-22 40zM32 19v36M26 9l6 10 6-10M13 28l15 10m23-10L36 38"/>',
 marabunta:'<path d="M14 15l9 6 9-12 9 12 9-6-4 18H18zM14 42l8-5 8 5v10l-8 5-8-5zm20 0 8-5 8 5v10l-8 5-8-5z"/>',
 danza:'<path d="M12 48c8-34 36 12 40-31M10 17c14 22 30-10 43 30M32 19l-7 13 7 13 7-13zM8 7l5 5m43-5-5 5M7 56l6-5m43 5-5-5"/>',
 supernova:'<circle cx="32" cy="32" r="11"/><path d="M32 3v14m0 30v14M3 32h14m30 0h14M11 11l10 10m22 22 10 10M11 53l10-10m22-22 10-10"/>',
};
const cache = new Map();
export function skillImage(id) {
 if (!cache.has(id)) cache.set(id, 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#edf7ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${art[id] || art.impulso}</g></svg>`));
 return cache.get(id);
}
export function combatSkills(char, mode, level = null) {
 const C = CHARACTERS[char] || {}, support = C[SUPPORT[char] || 'esp'];
 return [
  {key:'fire',id:mode==='combo'?'melee':'disparo',name:mode==='combo'?'Ataque cuerpo a cuerpo':'Disparo',short:mode==='combo'?'MELÉ':'DISPARO',hotkey:'Clic'},
  {key:'mov',...C.mov,short:'DEFENSA',hotkey:'F'},
  {key:'esp',...support,short:'APOYO',hotkey:'Q',locked:level!=null&&level<1,unlock:'Oleada 1'},
  {key:'ult',...C.ult,short:'ULTI',hotkey:'T',locked:!C.ult||(level!=null&&level<2),unlock:C.ult?'Oleada 3':'Sin ulti'},
 ];
}
