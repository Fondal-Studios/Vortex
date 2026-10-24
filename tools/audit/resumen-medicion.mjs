// Resume la salida de medicion-capitulos.mjs (una línea JSON por partida) en tablas: duración y victorias por estilo.
// Uso: node tools/audit/resumen-medicion.mjs salida.jsonl [salida2.jsonl ...]
import fs from 'node:fs';
const rows = process.argv.slice(2).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const caps = [...new Set(rows.map((r) => r.cap))], estilos = [...new Set(rows.map((r) => r.estilo))];
const med = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
console.log('Duración (min de simulación)\ncap | etapas | n | mediana | mín | máx | mediana(victorias)');
for (const c of caps) { const r = rows.filter((x) => x.cap === c); const w = r.filter((x) => x.state === 'won'); console.log(`${c} | ${r[0].waveTotal} | ${r.length} | ${f(med(r.map((x) => x.simMin)))} | ${f(Math.min(...r.map((x) => x.simMin)))} | ${f(Math.max(...r.map((x) => x.simMin)))} | ${f(med(w.map((x) => x.simMin)))}`); }
console.log('\nVictorias por estilo (ganadas/probadas)\ncap | ' + estilos.join(' | '));
let tot = {};
for (const c of caps) console.log(c + ' | ' + estilos.map((e) => { const r = rows.filter((x) => x.cap === c && x.estilo === e); const w = r.filter((x) => x.state === 'won').length; tot[e] = tot[e] || [0, 0]; tot[e][0] += w; tot[e][1] += r.length; return `${w}/${r.length}`; }).join(' | '));
console.log('TOTAL | ' + estilos.map((e) => `${tot[e][0]}/${tot[e][1]} (${Math.round(100 * tot[e][0] / tot[e][1])}%)`).join(' | '));
const nt = rows.filter((x) => x.timedOut).length; console.log(`\nSin terminar (tope de sim): ${nt}/${rows.length}`);
const fails = {}; for (const x of rows.filter((x) => x.state === 'lost')) { const k = `${x.cap} ${x.estilo}: ${x.failure || '—'} (etapa ${x.wave}/${x.waveTotal})`; fails[k] = (fails[k] || 0) + 1; }
for (const [k, v] of Object.entries(fails)) console.log(`derrota ${v}x ${k}`);
