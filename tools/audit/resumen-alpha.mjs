import fs from 'node:fs';
const dir=process.argv[2]||'docs/vortex-evidence/alpha-2026-10-25';
const profiles=['principiante','intermedio','experto'];
const prefix=process.argv[3]||'';
const label=prefix?'base-':'';
const rows=profiles.flatMap(p=>fs.readFileSync(`${dir}/${prefix}${p}.jsonl`,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).map(r=>({...r,profile:r.profile.replace('_sin_retardo','')})));
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const pct=(n,d)=>d?Math.round(n/d*1000)/10:null;
function stats(a){const wins=a.filter(r=>r.won),ts=wins.map(r=>r.seconds/60).sort((a,b)=>a-b);return {n:a.length,wins:wins.length,winPct:pct(wins.length,a.length),winMinutesMean:mean(ts),winMinutesMedian:ts.length?(ts[Math.floor((ts.length-1)/2)]+ts[Math.floor(ts.length/2)])/2:null,winMinutesMin:ts[0]??null,winMinutesMax:ts.at(-1)??null,wins8to12:wins.filter(r=>r.seconds>=480&&r.seconds<=720).length,lost:a.filter(r=>r.state==='lost').length,censored:a.filter(r=>r.censored).length,failures:Object.fromEntries([...new Set(a.filter(r=>!r.won).map(r=>r.failure||'death/other'))].map(k=>[k,a.filter(r=>!r.won&&(r.failure||'death/other')===k).length]))};}
const hosts=[...new Set(rows.map(r=>r.char))],maps=['m1','m3','m4','m5','m6','m2'];
const report={commit:'691961a528014681136546983740317d372099b5',at:new Date().toISOString(),overall:stats(rows),profiles:Object.fromEntries(profiles.map(p=>[p,stats(rows.filter(r=>r.profile===p))])),chapters:Object.fromEntries(maps.map(m=>[m,Object.fromEntries(profiles.map(p=>[p,stats(rows.filter(r=>r.profile===p&&r.mapId===m))]))])),hosts:Object.fromEntries(hosts.map(h=>[h,Object.fromEntries(profiles.map(p=>[p,stats(rows.filter(r=>r.profile===p&&r.char===h))]))]))};
fs.writeFileSync(`${dir}/${label}resumen.json`,JSON.stringify(report,null,2));
const keys=['profile','char','mapId','seed','state','seconds','wave','failure','kills','automaticClears','maxCombatGap'];
fs.writeFileSync(`${dir}/${label}partidas.csv`,keys.join(',')+'\n'+rows.map(r=>keys.map(k=>JSON.stringify(r[k]??'')).join(',')).join('\n')+'\n');
console.log(JSON.stringify({overall:report.overall,profiles:report.profiles,chapters:Object.fromEntries(maps.map(m=>[m,profiles.map(p=>`${p}:${report.chapters[m][p].wins}/${report.chapters[m][p].n}`)])),hosts:Object.fromEntries(hosts.map(h=>[h,profiles.map(p=>`${p}:${report.hosts[h][p].wins}/${report.hosts[h][p].n}`)]))},null,2));
