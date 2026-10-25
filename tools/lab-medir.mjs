// Mide en un navegador REAL (Chromium) las piezas del Laboratorio: triángulos y llamadas de cada pieza (sola, en cada ancla permitida y en los extremos de sus límites), a una calidad.
// Lo usan tools/lab-costes.mjs (genera la tabla) y tests/lab-piezas.test.js (la compara con el catálogo). Devuelve { pieza: { tris, llamadas, mats, casos, errores[] } }.
import { codificar, normalizar, defecto, PARTES, ORDEN_PARTES, ANCLAS, limitesDe, instancias } from '../src/shared/host-build.js';

/** Un diseño con UNA pieza en el ancla `a` con la transformación `t`. Espejo si la pieza es de tipo par (en anclas de 2 lados, el lado derecho sólo en `manos` no: HB-12). */
export function disenoDe(id, a, t = {}) {
  const d = PARTES[id], A = ANCLAS[a], par = d.lados === 'par' && !(a === 'manos');
  return normalizar({ ...defecto(), id: 'lab-medida01', nombre: 'Medida', partes: [{ p: id, a, sim: par ? 'espejo' : 'ninguna', ...(A.lados === 2 && !par ? { l: 'izq' } : {}), t: { pos: t.pos || [0, 0, 0], rot: t.rot || [0, 0, 0], esc: t.esc || 1 }, c: { mat: d.variantesMat[0], tinte: null } }] });
}
/** Casos de una pieza: por defecto en cada ancla y los 3 extremos (mín, máx, mixto) de sus límites en el ancla por defecto. */
export function casosDe(id) {
  const d = PARTES[id], out = [];
  for (const a of d.anclas) out.push({ nombre: `${a}:defecto`, build: disenoDe(id, a) });
  const a0 = d.anclas[0], L = limitesDe(id, a0);
  out.push({ nombre: `${a0}:mín`, build: disenoDe(id, a0, { pos: L.pos.map((x) => x[0]), rot: L.rot.map((x) => x[0]), esc: L.esc[0] }) });
  out.push({ nombre: `${a0}:máx`, build: disenoDe(id, a0, { pos: L.pos.map((x) => x[1]), rot: L.rot.map((x) => x[1]), esc: L.esc[1] }) });
  out.push({ nombre: `${a0}:mixto`, build: disenoDe(id, a0, { pos: [L.pos[0][1], L.pos[1][0], L.pos[2][1]], rot: [L.rot[0][0], L.rot[1][1], L.rot[2][0]], esc: (L.esc[0] + L.esc[1]) / 2 }) });
  return out;
}
export async function medirPiezas(browser, base, quality = 'low', ids = ORDEN_PARTES) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 320 } }), pg = await ctx.newPage(), errores = [];
  pg.on('pageerror', (e) => errores.push('pageerror: ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /armor|Laboratorio|Hu[eé]sped/i.test(m.text()))) errores.push(m.text().slice(0, 200)); });
  await pg.goto(`${base}/huesped-arte.html?frozen=1&w=320&h=320&q=${quality}&char=laboratorio&t=0.2`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction(() => window.__ready, null, { timeout: 120000 });
  const res = {};
  for (const id of ids) {
    const casos = casosDe(id), r = { casos: [], tris: 0, llamadas: 0, mats: [] };
    for (const c of casos) {
      const m = await pg.evaluate((b) => { const body = window.__body; body.setLab(b); window.__advance(0.3); window.__advance(0.1); window.__render();
        const s = body.stats(), cuerpo = s.meshes.find((x) => x[0] === 'kit-cuerpo'), mats = s.meshes.filter((x) => x[0] !== 'kit-cuerpo').map((x) => x[0].replace('kit-', ''));
        let finito = true, rad = 0; body.object.traverse((o) => { if (o.isSkinnedMesh) { const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i++) if (!Number.isFinite(a[i])) finito = false; for (let i = 0; i < a.length; i += 3) rad = Math.max(rad, Math.hypot(a[i], a[i + 1] - 1, a[i + 2])); } });
        return { tris: Math.round(s.tris - (cuerpo ? cuerpo[1] : 0)), llamadas: s.meshes.length - 1, mats, finito, rad: +rad.toFixed(2), proxies: body.proxies.length }; }, c.build);
      r.casos.push({ nombre: c.nombre, ...m, esperadas: instancias(c.build).length });
    }
    const d0 = r.casos.find((c) => c.nombre.endsWith(':defecto') && c.nombre.startsWith(PARTES[id].anclas[0])) || r.casos[0];
    r.tris = d0.tris; r.llamadas = d0.llamadas; r.mats = d0.mats; res[id] = r;
  }
  await ctx.close(); res.__errores = errores; return res;
}

/** Diseños de ejemplo para EH-03/04: mínimo (vacío), medio y PEOR CASO PERMITIDO (se llena el presupuesto con las piezas más caras que `validar` deja pasar; determinista). */
export async function ejemplos() {
  const { validar, costeRender } = await import('../src/shared/host-build.js'), { crearEstado } = await import('../src/client/lab-estado.js'), { prng } = await import('../src/shared/host-build-sugeridor.js');
  const mk = () => crearEstado({ ctx: () => ({ evo: 4 }), azar: prng(5) });
  const minimo = mk().build;
  const M = mk(); for (const [p, a] of [['cuerno_curvo', 'cabeza'], ['hombrera_espinas', 'hombros'], ['placa_pectoral', 'pecho'], ['espinas_dorsales', 'espalda'], ['adrenal', 'cintura'], ['cuchilla_antebrazo', 'antebrazos']]) M.agregar(p, a);
  M.setProp('altura', 1.05); M.setProp('piernas', 1.1); M.setProp('cabeza', 1.1);
  let W = null, mejor = -1;   // búsqueda al azar (determinista): se queda con el diseño válido de más triángulos
  for (let n = 0; n < 150; n++) { const E = mk(), rr = prng(1000 + n), lista = [...ORDEN_PARTES].sort(() => rr() - 0.5); for (let vuelta = 0; vuelta < 3; vuelta++) for (const id of lista) { const as = [...PARTES[id].anclas].sort(() => rr() - 0.5); for (const a of as) { if (E.agregar(id, a, rr() < 0.6 ? {} : { sim: 'ninguna', l: rr() < 0.5 ? 'izq' : 'der' }).ok) break; } } const t = costeRender(E.build, 'low').tris; if (t > mejor) { mejor = t; W = E; } }
  W.setProp('altura', 1.1); W.setProp('ancho', 1.1); W.setProp('torso', 1.05); W.setProp('manos', 1.2); W.setProp('pies', 1.2);
  const v = validar(W.build, { evo: 4 }); if (!v.ok) throw new Error('el peor caso no es válido: ' + v.errores[0].msg);
  void costeRender; return { minimo, medio: M.build, peor: W.build };
}
