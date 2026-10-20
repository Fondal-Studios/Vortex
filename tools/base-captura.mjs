// Capturas reales de LA BASE (docs/BASE.md) con Chromium por software, y medición de llamadas de dibujo / triángulos con renderer.info.
// Uso: node tools/base-captura.mjs [carpeta=shots/base] [calidad=low] [ancho=1280] [alto=720] [--solo=vista1,vista2] [--hud] [--jpg] [--pr=0.5]
// (--pr = resolución interna: en Alta por software conviene 0.5; las medidas de llamadas y triángulos no dependen de ella)
// Cada vista = { x, z, rumbo } (rumbo en grados: 0 mira al norte, 90 al este). Por vista imprime el cuadro entero y su desglose: mapa, NPC y Huésped (se ocultan por turnos).
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const args = process.argv.slice(2), pos = args.filter((a) => !a.startsWith('--'));
const OUT = pos[0] || 'shots/base', Q = pos[1] || 'low', W = +pos[2] || 1280, H = +pos[3] || 720;
const PR = (args.find((a) => a.startsWith('--pr=')) || '').slice(5), only = (args.find((a) => a.startsWith('--solo=')) || '').slice(7).split(',').filter(Boolean), conHud = args.includes('--hud'), jpg = args.includes('--jpg');
fs.mkdirSync(OUT, { recursive: true });
export const VISTAS = {
  entrada: { x: 0, z: 36, rumbo: 0 }, hub: { x: 0, z: 10, rumbo: 0 }, mesa: { x: 0, z: 6, rumbo: 0 },
  forja: { x: 0, z: -22, rumbo: 0 }, forja2: { x: 6, z: -26, rumbo: 350 },
  cambista: { x: -18, z: -2, rumbo: 270 }, mercado: { x: -16, z: 6, rumbo: 290 },
  capullos: { x: 20, z: 0, rumbo: 90 }, capullos2: { x: 24, z: 6, rumbo: 70 },
  jardin: { x: 24, z: -14, rumbo: 0 }, jardin2: { x: 16, z: -26, rumbo: 70 },
  poligono: { x: 24, z: 14, rumbo: 170 }, trofeos: { x: -24, z: -18, rumbo: 355 }, coop: { x: -26, z: 28, rumbo: 270 }, nave: { x: 0, z: 20, rumbo: 180 },
};
const srv = await startServer({ port: 0 }), b = await launch(), base = `http://localhost:${srv.port}`, errors = [];
const pg = await b.newPage({ viewport: { width: W, height: H } });
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${Q}] ${m.text().slice(0, 400)}`); });
pg.on('pageerror', (e) => errors.push(`[${Q}] PAGEERR ${e.message}`));
await pg.goto(`${base}/?state=base&q=${Q}&autoq=0&nolock=1&skipintro=1&reset=1${PR ? '&pr=' + PR : ''}`);
await pg.waitForFunction('window.__api && window.__api.session && window.__api.session.game', null, { timeout: 60000 });
await pg.waitForTimeout(6000);
await pg.evaluate((conHud) => { const t = document.querySelector('.bh-panel'); document.getElementById('bhtutok') && document.getElementById('bhtutok').click(); if (!conHud) document.querySelector('.bh').style.display = 'none'; document.getElementById('camquick') && (document.getElementById('camquick').style.display = 'none'); const p = document.getElementById('pause'); p && p.classList.add('hidden'); void t; }, conHud);
const medidas = [];
for (const [nombre, v] of Object.entries(VISTAS)) {
  if (only.length && !only.includes(nombre)) continue;
  await pg.evaluate((v) => { const g = window.__session.game, p = g.players[0], a = v.rumbo * Math.PI / 180; p.pos.x = v.x; p.pos.z = v.z; p.pos.y = 0.9; p.vel = { x: 0, y: 0, z: 0 }; p.heading = { x: Math.sin(a), y: 0, z: -Math.cos(a) }; p.pitch = 0.05; window.__renderer.camInit = false; }, v);
  // (la capa del Huésped es una tela con física: al «teletransportar» a la cámara de la vista se estira como un palo hasta que se asienta; se avanzan cuadros hasta que lo hace)
  await pg.evaluate(() => { for (let i = 0; i < 36; i++) window.__step(100); });
  await pg.waitForTimeout(800);
  const m = await pg.evaluate(() => {
    const r = window.__renderer, info = r.gl.info, uno = () => new Promise((ok) => requestAnimationFrame(() => { info.reset(); window.__step(16); ok({ calls: info.render.calls, tris: info.render.triangles }); }));
    return (async () => {
      const todo = await uno(); r.objects.root.visible = false; const sinNpc = await uno(); r.entRoot.visible = false; const mapa = await uno();
      r.objects.root.visible = true; r.entRoot.visible = true; return { todo, sinNpc, mapa };
    })();
  });
  await pg.screenshot({ path: `${OUT}/${nombre}-${Q}-${W}x${H}.${jpg ? 'jpg' : 'png'}`, timeout: 180000, ...(jpg ? { type: 'jpeg', quality: 82 } : {}) });
  const npc = { calls: m.todo.calls - m.sinNpc.calls, tris: m.todo.tris - m.sinNpc.tris }, hue = { calls: m.sinNpc.calls - m.mapa.calls, tris: m.sinNpc.tris - m.mapa.tris }, esc = { calls: m.mapa.calls + npc.calls, tris: m.mapa.tris + npc.tris };
  medidas.push({ vista: nombre, calls: m.todo.calls, tris: m.todo.tris, esc, mapa: m.mapa, hue, npc }); console.log(`${nombre.padEnd(10)} [${Q}] cuadro ${m.todo.calls}/${m.todo.tris} · escenario (mapa+NPC) ${esc.calls}/${esc.tris} [mapa ${m.mapa.calls}/${m.mapa.tris} + NPC ${npc.calls}/${npc.tris}] · Huésped ${hue.calls}/${hue.tris} (llamadas/triángulos)`);
}
const mx = (f) => Math.max(...medidas.map(f)); console.log(`MÁXIMOS [${Q}] cuadro ${mx((x) => x.calls)}/${mx((x) => x.tris)} · escenario (mapa+NPC) ${mx((x) => x.esc.calls)}/${mx((x) => x.esc.tris)} · sólo mapa ${mx((x) => x.mapa.calls)}/${mx((x) => x.mapa.tris)} · NPC ${mx((x) => x.npc.calls)}/${mx((x) => x.npc.tris)} · Huésped ${mx((x) => x.hue.calls)}/${mx((x) => x.hue.tris)}  (presupuesto Baja: escenario ≤ 60/40000, Huésped ≤ 45/20000)`);
console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].join('\n') : 'sin errores de consola');
await b.close(); srv.close && srv.close();
