// LEGIBILIDAD del Huésped y los enemigos en 3ª persona: captura real de cada mapa y mide el contraste silueta↔fondo.
// Método: la misma escena se fotografía 3 veces (todo visible / sin Huésped / sin enemigos); la diferencia da la MÁSCARA de cada uno,
// y se compara la luminancia (lineal, Rec.709) del borde interior de la máscara contra el fondo inmediato (la captura sin ese objeto).
//   ratio WCAG por píxel de borde = (Lmax+0.05)/(Lmin+0.05) → se informa mediana y p25 (el cuarto de silueta peor leído).
// Además ΔE (CIE Lab) por píxel de borde: un borde cuenta como LEGIBLE si ratio ≥ 1.5 o ΔE ≥ 30 (el color también separa figura y fondo).
// Criterio mínimo (CRITERIO abajo): ≥ 70 % del borde legible en TODOS los mapas, Huésped y enemigos, en Baja y Alta.
// Uso: node tools/legibilidad.mjs [carpeta] [calidades=low,high] [mapas=m1..m6] [claridad=normal|alta]
import fs from 'node:fs';
import { launch } from './browser.js';
import { startServer } from '../server/server.js';
const OUT = process.argv[2] || 'shots/legibilidad', QS = (process.argv[3] || 'low,high').split(','), MAPS = (process.argv[4] || 'm1,m2,m3,m4,m5,m6').split(','), CL = process.argv[5] || 'normal';
export const CRITERIO = { legible: 0.7 }; // fracción del borde de la silueta con ratio de luma ≥ 1.5 o ΔE(Lab) ≥ 30
fs.mkdirSync(OUT, { recursive: true });
const srv = await startServer({ port: 0 }); const b = await launch(); const rows = [], errors = [];
const ana = await (await b.newContext()).newPage(); await ana.setContent('<canvas id=c></canvas>');
/** Analiza 3 PNG (base64) en un canvas: devuelve estadísticas del Huésped y de los enemigos. */
async function analizar(A, B, C) {
  return ana.evaluate(async ([A, B, C]) => {
    const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + s; });
    const px = async (s) => { const i = await load(s), c = document.getElementById('c'); c.width = i.width; c.height = i.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: x.getImageData(0, 0, i.width, i.height).data }; };
    const [a, bb, cc] = [await px(A), await px(B), await px(C)], W = a.w, H = a.h;
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (im, i) => 0.2126 * lin(im.d[i * 4]) + 0.7152 * lin(im.d[i * 4 + 1]) + 0.0722 * lin(im.d[i * 4 + 2]);
    const lab = (im, i) => { const r = lin(im.d[i * 4]), g = lin(im.d[i * 4 + 1]), b = lin(im.d[i * 4 + 2]), X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883, f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]; };
    const dE = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    // zona de la interfaz (HUD oculto, pero por si acaso) no se excluye: el HUD se esconde antes de capturar
    const stats = (full, bg) => {
      const n = W * H, mask = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const k = i * 4, d = Math.abs(full.d[k] - bg.d[k]) + Math.abs(full.d[k + 1] - bg.d[k + 1]) + Math.abs(full.d[k + 2] - bg.d[k + 2]); mask[i] = d > 36 ? 1 : 0; }
      // limpiar ruido: un píxel de máscara debe tener ≥ 4 vecinos de máscara (3×3)
      const m2 = new Uint8Array(n); let area = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!mask[i]) continue; let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += mask[i + dy * W + dx]; if (s >= 5) { m2[i] = 1; area++; } }
      if (area < 120) return { area, ok: false };
      const ratios = [], inL = [], outL = [], des = []; let legible = 0;
      for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
        const i = y * W + x; if (!m2[i]) continue;
        // borde interior: algún vecino a 2 px fuera de la máscara
        let edge = false, ox = 0, oy = 0; for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (!m2[i + dy * W + dx]) { edge = true; ox = dx; oy = dy; break; }
        if (!edge) continue; const j = i + oy * W + ox * 1;
        const lh = L(full, i), lb = L(bg, j); inL.push(lh); outL.push(lb);
        const r = (Math.max(lh, lb) + 0.05) / (Math.min(lh, lb) + 0.05); ratios.push(r);
        const de = dE(lab(full, i), lab(bg, j)); des.push(de); if (r >= 1.5 || de >= 30) legible++;
      }
      if (ratios.length < 20) return { area, ok: false };
      const q = (arr, p) => { const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
      const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
      return { ok: true, area, borde: ratios.length, mediana: +q(ratios, 0.5).toFixed(2), p25: +q(ratios, 0.25).toFixed(2), dE: +q(des, 0.5).toFixed(0), legible: +(legible / ratios.length).toFixed(2), lumaCuerpo: +mean(inL).toFixed(3), lumaFondo: +mean(outL).toFixed(3), fondoP10: +q(outL, 0.1).toFixed(3), fondoP90: +q(outL, 0.9).toFixed(3) };
    };
    // luma media (sRGB perceptual 0-255) de toda la imagen y del centro, para vigilar que no se lave
    let sum = 0, sumC = 0, nC = 0, sat = 0; for (let i = 0; i < W * H; i++) { const k = i * 4, y = 0.2126 * a.d[k] + 0.7152 * a.d[k + 1] + 0.0722 * a.d[k + 2]; sum += y; const mx = Math.max(a.d[k], a.d[k + 1], a.d[k + 2]), mn = Math.min(a.d[k], a.d[k + 1], a.d[k + 2]); sat += mx ? (mx - mn) / mx : 0; const x = i % W, yy = (i / W) | 0; if (x > W * 0.25 && x < W * 0.75 && yy > H * 0.25 && yy < H * 0.75) { sumC += y; nC++; } }
    return { huesped: stats(a, bb), enemigos: stats(a, cc), lumaImg: +(sum / (W * H)).toFixed(1), lumaCentro: +(sumC / nC).toFixed(1), satMedia: +(sat / (W * H)).toFixed(3) };
  }, [A, B, C]);
}
for (const q of QS) for (const map of MAPS) {
  const pg = await (await b.newContext({ viewport: { width: 960, height: 720 } })).newPage();
  pg.on('pageerror', (e) => errors.push(`${map}: ${e.message}`)); pg.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(`${map}: ${m.text()}`); });
  await pg.goto(`http://localhost:${srv.port}/?auto=${map}&god=1&seed=3&q=${q}&autoq=0&nolock=1&skipintro=1&cam=third&claridad=${CL}`, { timeout: 180000 });
  await pg.waitForFunction(() => window.__api && window.__api.session && window.__api.session.game, null, { timeout: 90000 });
  await pg.addStyleTag({ content: 'body > *:not(canvas#c){visibility:hidden !important} #c{visibility:visible !important}' });
  await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; g.phaseT = 1e9; g.queue = []; for (const m of g.monsters) m.dead = true; p.char = 'axioma'; p.evo = 0; window.__api.setSetting('simple', false); p.input.fire = false;
    const h = p.heading, u = p.up, r = { x: h.y * u.z - h.z * u.y, y: h.z * u.x - h.x * u.z, z: h.x * u.y - h.y * u.x };
    const at = (f, s) => ({ x: p.pos.x + h.x * f + r.x * s, y: p.pos.y + h.y * f + r.y * s, z: p.pos.z + h.z * f + r.z * s });
    window.__mons = [['astilla', 5, -2.0], ['prisma', 7, 2.2], ['ariete', 10, 0.2]].map(([k, f, s]) => { const m = g.spawnMonster(k, at(f, s), { noElite: true, passive: true }); m.hp = m.maxhp = 1e9; m.speedMul = 0; m.home = { ...m.pos }; return m; });
    clearInterval(window.__pin); window.__pin = setInterval(() => { for (const m of window.__mons) { m.pos = { ...m.home }; m.vel = { x: 0, y: 0, z: 0 }; } }, 8); });
  await pg.waitForFunction(() => { const e = [...window.__api.renderer.ents.ply.values()][0]; return e && e.body && e.body.isReady; }, null, { timeout: 150000, polling: 1000 }).catch(() => null);
  await pg.waitForTimeout(3000);
  // (se oculta sólo el CUERPO: el charco y el halo de luz —presencia— son parte legítima del fondo de la silueta)
  const vis = (hp, hm) => pg.evaluate(([hp, hm]) => { const R = window.__api.renderer; for (const e of R.ents.ply.values()) e.object.traverse((o) => { let pres = false; for (let a = o; a; a = a.parent) if (a.name === 'presencia') pres = true; if (!pres && (o.isMesh || o.isPoints || o.isSprite)) o.visible = !hp; }); for (const e of R.ents.mon.values()) e.object.visible = !hm; }, [hp, hm]);
  const shot = async (n, hp, hm) => { await vis(hp, hm); await pg.waitForTimeout(500); const buf = await pg.screenshot({ type: 'png', timeout: 180000 }); fs.writeFileSync(`${OUT}/${map}-${q}-${n}.png`, buf); return buf.toString('base64'); };
  const A = await shot('juego', false, false), B = await shot('sinhuesped', true, false), C = await shot('sinenemigos', false, true);
  const info = await pg.evaluate(() => { const R = window.__api.renderer, i = R.gl.info.render; return { calls: i.calls, tris: i.triangles }; });
  const r = { mapa: map, calidad: q, claridad: CL, ...(await analizar(A, B, C)), ...info }; rows.push(r);
  const f = (s) => (s.ok ? `legible ${(s.legible * 100) | 0}% med ${s.mediana} p25 ${s.p25} dE ${s.dE} (cuerpo ${s.lumaCuerpo} / fondo ${s.lumaFondo})` : 'sin máscara');
  const bien = (s) => s.ok && s.legible >= CRITERIO.legible;
  console.log(`${map} ${q} ${CL}  HUÉSPED ${f(r.huesped)} ${bien(r.huesped) ? 'OK' : 'BAJO'} | ENEMIGOS ${f(r.enemigos)} ${bien(r.enemigos) ? 'OK' : 'BAJO'} | luma img ${r.lumaImg} centro ${r.lumaCentro} sat ${r.satMedia} | calls ${r.calls} tris ${r.tris}`);
  await pg.context().close();
}
fs.writeFileSync(`${OUT}/medidas-${CL}.json`, JSON.stringify(rows, null, 1));
console.log(errors.length ? 'ERRORES:\n' + [...new Set(errors)].slice(0, 8).join('\n') : 'sin errores de consola'); await b.close(); await srv.close();
