import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { launch, browserAvailable } from '../tools/browser.js';
import { startServer } from '../server/server.js';

// E2E del Laboratorio (EH-06…EH-10, EH-13, EH-16) en Chromium con WebGL por software. UNA prueba a la vez. Si no hay WebGL o Chromium la prueba FALLA o se declara omitida con motivo (nunca pasa en silencio).
// Capturas en shots/editor/ (se abren a mano para revisar el aspecto).
const hasChromium = browserAvailable();
let srv, browser, base;
const SHOTS = 'shots/editor';
test.before(async () => { if (!hasChromium) return; fs.mkdirSync(SHOTS, { recursive: true }); srv = await startServer({ port: 0 }); browser = await launch(); base = `http://localhost:${srv.port}`; });
test.after(async () => { if (browser) await browser.close(); if (srv) await srv.close(); });

const RUIDO = /toNonIndexed/;   // aviso conocido de three al cargar el cuerpo humano en modo móvil (no es del Laboratorio)
async function abrir(w = 1280, h = 720, { todo = true, q = 'low', touch = false, url = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }), pg = await ctx.newPage(), errores = [];
  pg.on('pageerror', (e) => errores.push('pageerror: ' + e.message)); pg.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !RUIDO.test(m.text())) errores.push(m.text().slice(0, 240)); });
  pg.setDefaultTimeout(120000); await pg.goto(`${base}/?q=${q}&autoq=0${url}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 }); await pg.waitForTimeout(400); await pg.evaluate(() => window.__api.ui.confirmTitle());
  if (todo) await pg.evaluate(async () => { const P = await import('/src/client/perfil.js'), H = await import('/src/shared/host-build.js'); P.perfil().lab.piezas = [...H.ORDEN_PARTES]; P.perfil().evo.laboratorio = 4; });
  return { ctx, pg, errores };
}
const entrar = async (pg) => { await pg.evaluate(() => window.__api.ui.show('laboratorio')); await pg.waitForFunction(() => window.__lab && window.__lab.visor && window.__lab.visor.listo, null, { timeout: 180000 }); await pg.waitForTimeout(600); };
const est = (pg) => pg.evaluate(() => { const b = window.__lab.estado.build; return { prop: b.prop, partes: b.partes.map((e) => ({ p: e.p, a: e.a, sim: e.sim, t: e.t })), h: b.nombre, ok: window.__lab.estado.validacion.ok }; });

test('EH-06: abrir y cerrar 20 veces no deja fugas en el visor 3D (geometrías estables) y no hay errores', { skip: !hasChromium, timeout: 1500000 }, async () => {
  const { ctx, pg, errores } = await abrir(844, 390), geos = [];
  for (let i = 0; i < 20; i++) {
    await entrar(pg); geos.push(await pg.evaluate(() => window.__lab.visor.info().geometrias)); await pg.evaluate(() => window.__api.ui.show('huesped', false)); await pg.waitForTimeout(250);
    assert.equal(await pg.evaluate(() => window.__lab.visor), null, 'al salir el visor se libera');
  }
  console.log('geometrías del visor en cada apertura:', geos.join(','));
  assert.ok(geos.every((g) => g === geos[0]), `las geometrías cambian entre aperturas: ${geos}`); assert.deepEqual(errores, []); await ctx.close();
});

test('EH-07: pestaña CUERPO: 9 sliders con límites, arrastrar una parte del cuerpo cambia su tamaño sin reconstruir, y «antes/después»', { skip: !hasChromium, timeout: 600000 }, async () => {
  const { ctx, pg, errores } = await abrir(1280, 720); await entrar(pg);
  assert.equal(await pg.locator('.lb-fila input[type=range]').count(), 4, 'modo básico: 4 sliders');
  await pg.click('#lbmodo'); assert.equal(await pg.locator('#lbpanel .lb-fila input[type=range]').count(), 9, 'modo avanzado: 9 sliders');
  const lims = await pg.evaluate(() => [...document.querySelectorAll('#lbpanel input[data-prop]')].map((i) => [i.dataset.prop, +i.min, +i.max])); const H = await pg.evaluate(async () => (await import('/src/shared/host-build.js')).PROP_RANGOS);
  for (const [k, mn, mx] of lims) assert.deepEqual([mn, mx], H[k], `rango de ${k}`);
  await pg.evaluate(() => { window.__kit0 = window.__lab.visor.body.kit; });
  // los sliders recalculan sin reconstruir: el kit (armadura) es el mismo objeto
  await pg.evaluate(() => { const i = document.querySelector('#lbp-piernas'); i.value = 1.1; i.dispatchEvent(new Event('input', { bubbles: true })); }); await pg.waitForTimeout(300);
  assert.equal((await est(pg)).prop.piernas, 1.1); assert.equal(await pg.evaluate(() => window.__lab.visor.body.kit === window.__kit0), true, 'sin reconstruir');
  // arrastrar la cabeza con el mouse (hacia arriba = más grande)
  await pg.evaluate(() => window.__lab.visor.camara('frente', true)); await pg.waitForTimeout(500);
  const p = await pg.evaluate(() => window.__lab.visor.regionPx('cabeza')); await pg.mouse.move(p.x, p.y); await pg.mouse.down(); for (let i = 1; i <= 10; i++) await pg.mouse.move(p.x, p.y - i * 6); await pg.mouse.up(); await pg.waitForTimeout(300);
  const c1 = (await est(pg)).prop.cabeza; assert.ok(c1 > 1.05 && c1 <= 1.2, `cabeza ${c1}`); assert.equal(await pg.evaluate(() => window.__lab.visor.body.kit === window.__kit0), true);
  assert.equal(await pg.evaluate(() => window.__lab.estado.pasos.atras), 2, 'el arrastre y el slider son 1 paso cada uno');
  // imposible salir del rango: arrastrar mucho más topa en el máximo
  await pg.mouse.move(p.x, p.y); await pg.mouse.down(); for (let i = 1; i <= 40; i++) await pg.mouse.move(p.x, Math.max(10, p.y - i * 8)); await pg.mouse.up(); assert.ok((await est(pg)).prop.cabeza <= 1.2 + 1e-9);
  // antes / después
  await pg.screenshot({ path: `${SHOTS}/cuerpo-despues.png` });
  await pg.dispatchEvent('#lbantesbtn', 'pointerdown'); await pg.waitForTimeout(250); assert.equal(await pg.evaluate(() => window.__lab.visor.body.lab.prop.piernas), 1, 'mientras se mantiene «antes» se ve el cuerpo original'); await pg.screenshot({ path: `${SHOTS}/cuerpo-antes.png` });
  await pg.dispatchEvent('#lbantesbtn', 'pointerup'); await pg.waitForTimeout(250); assert.equal(await pg.evaluate(() => window.__lab.visor.body.lab.prop.piernas), 1.1);
  assert.deepEqual(errores, []); await ctx.close();
});

test('EH-08: PIEZAS: colocar, mover, simetría y borrar en ≤ 3 interacciones; imposible salir de los límites', { skip: !hasChromium, timeout: 600000 }, async () => {
  const { ctx, pg, errores } = await abrir(1280, 720); await entrar(pg); await pg.click('#lbtab-piezas'); await pg.waitForTimeout(300);
  // colocar: interacción 1 = tocar el punto de ancla en el cuerpo 3D · interacción 2 = «Poner»
  await pg.evaluate(() => window.__lab.visor.camara('frente', true)); await pg.waitForTimeout(500);
  const a = await pg.evaluate(() => window.__lab.visor.puntoPx('hombros', 'izq')); await pg.mouse.click(a.x, a.y); await pg.waitForTimeout(250);
  assert.equal(await pg.evaluate(() => window.__lab.ui.sel.ancla), 'hombros'); await pg.click('[data-poner="hombrera_espinas"]'); await pg.waitForTimeout(1200);
  let s = await est(pg); assert.equal(s.partes.length, 1); assert.equal(s.partes[0].sim, 'espejo', 'las piezas en par nacen simétricas'); assert.equal(await pg.evaluate(() => window.__lab.visor.proxies.length), 2, 'dos instancias dibujadas');
  // mover: interacción 3 = arrastrar el asa X del gizmo
  const g = await pg.evaluate(() => window.__lab.visor.gizmoPx()), gx = g.find((q) => q.eje === 0); await pg.mouse.move(gx.x, gx.y); await pg.mouse.down(); for (let i = 1; i <= 6; i++) await pg.mouse.move(gx.x + i * 6 * (gx.x > 600 ? 1 : -1), gx.y); await pg.mouse.up(); await pg.waitForTimeout(300);
  s = await est(pg); assert.notEqual(s.partes[0].t.pos[0], 0, 'el gizmo movió la pieza'); const px = s.partes[0].t.pos[0];
  const xs = await pg.evaluate(() => window.__lab.visor.proxies.map((p) => { const v = p.mesh.getWorldPosition(new window.__lab.visor.body.object.position.constructor()); return v.x; })); assert.ok(Math.abs(xs[0] + xs[1]) < 0.06, `la pareja se mueve en espejo: ${xs}`);
  // límites: empujar mucho recorta al borde (tope) y avisa
  await pg.evaluate(() => { const E = window.__lab.estado; E.patch(0, { pos: [5, 5, 5], rot: [400, 400, 400], esc: 9 }); }); s = await est(pg);
  const lim = await pg.evaluate(async () => { const H = await import('/src/shared/host-build.js'); return H.limitesDe('hombrera_espinas', 'hombros'); });
  for (let k = 0; k < 3; k++) { assert.ok(s.partes[0].t.pos[k] <= lim.pos[k][1] + 1e-9 && s.partes[0].t.pos[k] >= lim.pos[k][0] - 1e-9); assert.ok(Math.abs(s.partes[0].t.rot[k]) <= Math.max(Math.abs(lim.rot[k][0]), lim.rot[k][1])); } assert.ok(s.partes[0].t.esc <= lim.esc[1] + 1e-9); assert.ok(s.ok, 'sigue válido');
  void px;
  // simetría apagada (S): crea una pieza independiente; borrar: 2 interacciones (tocar la pieza + Quitar)
  await pg.evaluate(() => window.__lab.estado.patch(0, { pos: [0.03, 0, 0], rot: [0, 0, 0], esc: 1 })); await pg.waitForTimeout(500);
  await pg.evaluate(() => { document.activeElement && document.activeElement.blur(); document.getElementById('lbcanvas').focus(); }); await pg.keyboard.press('s'); await pg.waitForTimeout(900);
  s = await est(pg); assert.equal(s.partes[0].sim, 'ninguna'); assert.equal(await pg.evaluate(() => window.__lab.visor.proxies.length), 1);
  await pg.screenshot({ path: `${SHOTS}/piezas-gizmo.png` });
  await pg.evaluate(() => { window.__lab.ui.sel = { ancla: null, lado: 'der', i: -1 }; window.__lab.visor.seleccionar({}); }); await pg.waitForTimeout(200);
  const pp = await pg.evaluate(() => { const v = window.__lab.visor, m = v.proxies[0].mesh, w = m.getWorldPosition(m.position.clone()), r = v.proyectar(w), c = document.getElementById('lbcanvas').getBoundingClientRect(); return { x: r.x + c.left, y: r.y + c.top }; });
  await pg.mouse.click(pp.x, pp.y); await pg.waitForTimeout(250); assert.equal(await pg.evaluate(() => window.__lab.ui.sel.i), 0, 'tocar la pieza la selecciona'); await pg.click('#lbsel [data-quitar]'); await pg.waitForTimeout(500);
  assert.equal((await est(pg)).partes.length, 0, 'borrada'); assert.deepEqual(errores, []); await ctx.close();
});

test('EH-09: deshacer/rehacer con teclado y botones, una ráfaga de slider = 1 paso, copias y borrador recuperado tras recargar', { skip: !hasChromium, timeout: 900000 }, async () => {
  const { ctx, pg, errores } = await abrir(1280, 720); await entrar(pg); await pg.click('#lbmodo');
  const pasos = () => pg.evaluate(() => window.__lab.estado.pasos.atras);
  // ráfaga de 15 valores del mismo slider (menos de 700 ms entre ellos) = 1 paso
  await pg.evaluate(() => { const i = document.querySelector('#lbp-torso'); for (let n = 0; n < 15; n++) { i.value = 0.95 + n * 0.005; i.dispatchEvent(new Event('input', { bubbles: true })); } }); await pg.waitForTimeout(100);
  assert.equal(await pasos(), 1, 'la ráfaga es un paso'); assert.ok((await est(pg)).prop.torso > 1.0);
  // piezas por la lista (sin 3D) y deshacer con Ctrl+Z / rehacer con Ctrl+Y y con los botones
  await pg.click('#lbtab-piezas'); await pg.click('[data-ancla="cabeza"]'); await pg.click('[data-poner="cuerno_curvo"]'); await pg.waitForTimeout(500); assert.equal((await est(pg)).partes.length, 1);
  await pg.evaluate(() => document.getElementById('lbcanvas').focus()); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(200); assert.equal((await est(pg)).partes.length, 0, 'Ctrl+Z quita la pieza');
  await pg.keyboard.press('Control+y'); await pg.waitForTimeout(200); assert.equal((await est(pg)).partes.length, 1, 'Ctrl+Y la devuelve');
  await pg.click('#lbundo'); await pg.waitForTimeout(150); assert.equal((await est(pg)).partes.length, 0); await pg.click('#lbredo'); await pg.waitForTimeout(150); assert.equal((await est(pg)).partes.length, 1);
  // ida y vuelta completa: la huella vuelve a ser idéntica
  const r = await pg.evaluate(async () => { const H = await import('/src/shared/host-build.js'), E = window.__lab.estado, h1 = H.huella(E.build); let n = 0; while (E.undo()) n++; const h0 = H.huella(E.build); while (E.redo()); return { n, igual: H.huella(E.build) === h1, h0cambia: h0 !== h1 }; });
  assert.ok(r.n >= 2 && r.igual && r.h0cambia);
  // copias
  await pg.click('#lbcopias'); await pg.fill('#lbsnapn', 'con cuernos'); await pg.click('#lbsnapok'); assert.equal(await pg.evaluate(() => window.__lab.estado.snapshots.length), 1); await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  // borrador: se recupera tras recargar la página
  await pg.evaluate(() => window.__lab.estado.setNombre('Borrador de prueba')); await pg.waitForTimeout(200);
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForFunction(() => window.__api && window.__api.ui); await pg.waitForTimeout(400); await pg.evaluate(() => window.__api.ui.confirmTitle()); await entrar(pg);
  const s = await est(pg); assert.equal(s.h, 'Borrador de prueba'); assert.equal(s.partes.length, 1); assert.equal(await pg.evaluate(() => window.__lab.estado.snapshots.length), 1, 'las copias viajan con el borrador');
  assert.match(await pg.evaluate(() => document.getElementById('lbaviso').textContent), /borrador/i);
  assert.deepEqual(errores, []); await ctx.close();
});

test('EH-10: errores HB-xx con texto accionable en español y avisos de separación cosmético/funcional', { skip: !hasChromium, timeout: 600000 }, async () => {
  const { ctx, pg, errores } = await abrir(1280, 720, { todo: false }); await entrar(pg);
  await pg.click('#lbtab-cuerpo'); assert.match(await pg.textContent('#lbpanel'), /solo estética: no cambia tus estadísticas/);
  await pg.click('#lbtab-piezas'); await pg.click('[data-ancla="pecho"]'); await pg.waitForTimeout(200);
  // pieza no poseída: bloqueada con la forma de conseguirla
  const txt = await pg.textContent('#lbpanel'); assert.match(txt, /🔒/); assert.match(txt, /Ganá|Derrotá|Jugá|Hacé crecer|La tenés/);
  assert.equal(await pg.locator('[data-poner="corazon_cristal"]').isDisabled(), true, 'el Corazón de cristal aún no se tiene');
  await pg.click('[data-poner="placa_pectoral"]'); await pg.waitForTimeout(300); assert.match(await pg.textContent('#lbpanel'), /no cambia tus estadísticas/);
  // diseño inválido cargado a la fuerza: cada HB-xx muestra un texto en español que dice qué hacer
  await pg.evaluate(async () => { const H = await import('/src/shared/host-build.js'), E = window.__lab.estado, b = E.build, P = (p, a) => ({ p, a, sim: 'ninguna', t: { pos: [0, 0, 0], rot: [0, 0, 0], esc: 1 }, c: { mat: H.PARTES[p].variantesMat[0], tinte: null } });
    E.cargar({ ...b, prop: { ...b.prop, brazos: 1.15, hombros: 0.92 }, partes: [P('placas', 'pecho'), P('adrenal', 'cintura'), P('medula', 'espalda'), P('ojo_extra', 'cabeza'), P('placa_pectoral', 'pecho'), P('corazon_cristal', 'pecho')] }, { historia: true }); });
  await pg.waitForTimeout(300); await pg.click('#lbtab-datos'); const revision = await pg.textContent('.lb-msgs'); console.log('revisión:', revision.replace(/\s+/g, ' ').slice(0, 400));
  assert.match(await pg.textContent('#lbestado'), /problema/); assert.match(revision, /HB-0[5-9]|HB-1[0-6]/); assert.match(revision, /[Ee]volucion|ranura|chocan|no se lleva|no tenés|diferir|combinan/);
  const msgs = await pg.evaluate(() => window.__lab.estado.validacion.errores.map((e) => e.msg)); assert.ok(msgs.length >= 2); for (const m of msgs) { assert.ok(m.length > 15 && !/undefined|\{|\}/.test(m), `mensaje roto: ${m}`); assert.match(m, /[a-záéíóúñ]/); }
  await pg.click('#lbguardar'); assert.match(await pg.textContent('#lbaviso'), /Todavía no se puede guardar/); assert.equal(await pg.locator('#lbprobar').isEnabled(), true);
  await pg.click('#lbreparar'); await pg.waitForTimeout(300); assert.equal(await pg.evaluate(() => window.__lab.estado.validacion.ok), true, 'Reparar deja el diseño válido');
  assert.deepEqual(errores, []); await ctx.close();
});

test('EH-13: «Probar» abre el Campo de pruebas con el diseño, el medidor de daño coincide con p.st.dmg (±1) y se vuelve al editor con el estado', { skip: !hasChromium, timeout: 900000 }, async () => {
  const { ctx, pg, errores } = await abrir(1280, 720, { url: '&nolock=1&skipintro=1' }); await entrar(pg);
  await pg.click('#lbtab-piezas'); await pg.click('[data-ancla="espalda"]'); await pg.click('[data-poner="espinas_dorsales"]'); await pg.click('[data-ancla="cintura"]'); await pg.click('[data-poner="adrenal"]'); await pg.evaluate(() => window.__lab.estado.setNombre('Prueba de daño'));
  await pg.click('#lbprobar');
  await pg.waitForFunction(() => window.__api.session && window.__api.session.practice && window.__api.session.game && document.getElementById('labmedidor'), null, { timeout: 180000 });
  const ini = await pg.evaluate(() => { const g = window.__api.session.game, p = g.players[0]; return { char: p.char, lb: p.lb, corg: p.corg, practica: window.__api.session.practice }; });
  assert.equal(ini.char, 'laboratorio'); assert.equal(ini.practica, true); assert.ok(ini.lb >= 1, 'el diseño entró a la simulación'); assert.deepEqual(ini.corg, ['adrenal'], 'solo el órgano funcional del diseño');
  await pg.getByText('Entendido', { exact: true }).click({ timeout: 60000 }).catch(() => {});   // el resumen de la misión se cierra
  await pg.waitForFunction(() => window.__api.session.game.monsters.filter((m) => m.passive && !m.dead).length >= 2, null, { timeout: 120000 });   // aparecen los blancos pasivos
  const total = []; for (let r = 0; r < 3; r++) {
    await pg.evaluate((r) => { const s = window.__api.session, g = s.game, p = g.players[0], ms = g.monsters.filter((m) => m.passive && !m.dead); for (let i = 0; i < 4 + r; i++) { const m = ms[i % Math.max(1, ms.length)]; if (m) g.damageMonster(m, 18 + r * 7, p); } }, r);
    await pg.waitForTimeout(700); const t = await pg.evaluate(() => { window.__labMedidor.leer(); return { meter: +document.getElementById('labmedidor').dataset.total, real: Math.round(window.__api.session.game.players[0].st.dmg), dps: document.getElementById('lbm-dps').textContent }; });
    total.push(t); assert.ok(Math.abs(t.meter - t.real) <= 1, `ráfaga ${r + 1}: medidor ${t.meter} vs p.st.dmg ${t.real}`); assert.ok(t.real > 0);
  }
  console.log('medidor de daño (3 ráfagas):', JSON.stringify(total));
  await pg.screenshot({ path: `${SHOTS}/probar-campo.png` });
  // volver al Laboratorio: la página se recarga, y al empezar se reabre el editor con el diseño
  await pg.click('#lbm-volver'); await pg.waitForFunction(() => window.__api && window.__api.ui, null, { timeout: 120000 }); await pg.waitForTimeout(500);
  await pg.evaluate(() => window.__api.ui.confirmTitle()); await pg.waitForFunction(() => window.__lab && window.__lab.visor && window.__lab.visor.listo, null, { timeout: 180000 });
  const s = await est(pg); assert.equal(s.h, 'Prueba de daño'); assert.equal(s.partes.length, 2); assert.equal(await pg.evaluate(() => window.__api.ui.screen), 'laboratorio');
  assert.deepEqual(errores.filter((e) => !/WebGL|GPU stall|ReadPixels/.test(e)), []); await ctx.close();
});

// ── EH-16 · accesibilidad ──
async function tabHasta(pg, sel, max = 120) { for (let i = 0; i < max; i++) { if (await pg.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), sel)) return i; await pg.keyboard.press('Tab'); } throw new Error('el foco nunca llegó a ' + sel); }
test('EH-16: recorrido COMPLETO solo con teclado (sin mouse ni 3D): poner, ajustar con números, quitar, deshacer, guardar; foco visible', { skip: !hasChromium, timeout: 900000 }, async () => {
  const { ctx, pg, errores } = await abrir(1280, 720); await entrar(pg); await pg.click('#lbmodo');   // (el modo avanzado se activa una vez; después todo es teclado)
  await pg.evaluate(() => { document.activeElement && document.activeElement.blur(); document.getElementById('lbnombre').focus(); });
  const foco = async () => pg.evaluate(() => { const e = document.activeElement, cs = getComputedStyle(e); return { w: parseFloat(cs.outlineWidth), st: cs.outlineStyle, vis: e.matches(':focus-visible'), id: e.id || e.dataset.ancla || e.dataset.poner || e.className }; });
  await tabHasta(pg, '#lbtab-cuerpo'); let f = await foco(); assert.ok(f.vis && f.st !== 'none' && f.w >= 2, `foco visible en la pestaña: ${JSON.stringify(f)}`); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(250); assert.equal(await pg.evaluate(() => window.__lab.ui.tab), 'piezas', 'las flechas cambian de pestaña');
  await tabHasta(pg, '[data-ancla="cabeza"]'); f = await foco(); assert.ok(f.w >= 2 && f.st !== 'none'); await pg.keyboard.press('Enter');
  await tabHasta(pg, '[data-poner="cuerno_curvo"]'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
  assert.equal((await est(pg)).partes.length, 1, 'puesta con el teclado'); assert.match(await pg.textContent('#lbaviso'), /puesta/);
  await tabHasta(pg, '[data-selp="0"]'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300);
  // el slider de posición X se ajusta con las flechas (alternativa al gizmo)
  await tabHasta(pg, '#lbc-pos0'); const x0 = (await est(pg)).partes[0].t.pos[0]; for (let i = 0; i < 5; i++) await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(200);
  const x1 = (await est(pg)).partes[0].t.pos[0]; assert.notEqual(x1, x0, 'las flechas mueven la pieza'); for (let i = 0; i < 200; i++) await pg.keyboard.press('ArrowRight');
  const lim = await pg.evaluate(async () => (await import('/src/shared/host-build.js')).limitesDe('cuerno_curvo', 'cabeza')); assert.ok((await est(pg)).partes[0].t.pos[0] <= lim.pos[0][1] + 1e-9, 'tope respetado con el teclado');
  await tabHasta(pg, '#lbc-quitar'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(300); assert.equal((await est(pg)).partes.length, 0, 'quitada con el teclado');
  await pg.evaluate(() => document.getElementById('lbcanvas').focus()); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(250); assert.equal((await est(pg)).partes.length, 1, 'deshacer con el teclado');
  await pg.keyboard.press('Control+z'); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(150);
  await tabHasta(pg, '#lbguardar'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(400);
  const g = await pg.evaluate(async () => { const P = await import('/src/client/perfil.js'); return { n: P.perfil().lab.slots.length, activo: !!P.perfil().lab.activo }; }); assert.equal(g.n, 1); assert.ok(g.activo, 'guardado y activo');
  // lista de piezas = alternativa completa al 3D: tiene nombre accesible, y el medidor / el estado se anuncian (aria-live)
  assert.equal(await pg.getAttribute('#lbaviso', 'aria-live'), 'polite'); assert.ok(await pg.getAttribute('#lbmed', 'aria-label'), 'el medidor tiene etiqueta de texto'); assert.ok(await pg.getAttribute('#lbcanvas', 'aria-label'));
  assert.equal(await pg.getAttribute('#lbtab-piezas', 'role'), 'tab'); assert.equal(await pg.getAttribute('#lbtabs', 'role'), 'tablist');
  assert.deepEqual(errores, []); await ctx.close();
});

test('EH-16: contraste del texto (WCAG ≥ 4,5 el normal, ≥ 3 el grande), objetivos táctiles ≥ 44 px y sin desbordes en 4 tamaños', { skip: !hasChromium, timeout: 1200000 }, async () => {
  const SIZES = [['844x390', 844, 390, true], ['667x375', 667, 375, true], ['390x844', 390, 844, true], ['1280x720', 1280, 720, false]], problemas = [];
  for (const [vn, w, h, touch] of SIZES) {
    const { ctx, pg, errores } = await abrir(w, h, { touch }); await entrar(pg); if (w > 700) await pg.click('#lbmodo');
    for (const tab of ['cuerpo', 'piezas', 'aspecto', 'datos']) {
      await pg.click(`#lbtab-${tab}`); if (tab === 'piezas') { await pg.click('[data-ancla="cabeza"]'); await pg.click('[data-poner="cuerno_curvo"]'); await pg.waitForTimeout(500); } await pg.waitForTimeout(300);
      const r = await pg.evaluate(() => {
        const root = document.querySelector('#laboratorio'), vw = innerWidth, vh = innerHeight, out = { desborde: [], chico: [], contraste: [], cortado: [] };
        const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0, panel = root.querySelector('#lbpanel'), pr = panel.getBoundingClientRect();
        const dentro = (e) => { const r = e.getBoundingClientRect(); return r.bottom > pr.top && r.top < pr.bottom; };
        const rgba = (c) => { const m = c.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
        const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const fondo = (e) => { let c = { r: 10, g: 6, b: 18, a: 1 }; const pila = []; for (let n = e; n && n.nodeType === 1; n = n.parentElement) pila.push(n); for (const n of pila.reverse()) { const b = rgba(getComputedStyle(n).backgroundColor); if (b.a > 0) c = { r: b.r * b.a + c.r * (1 - b.a), g: b.g * b.a + c.g * (1 - b.a), b: b.b * b.a + c.b * (1 - b.a), a: 1 }; } return c; };
        for (const e of root.querySelectorAll('#lbpanel *, .lb-cab *, .lb-bar *, .lb-medidor *, .lb-cams *, .lb-sel *')) {
          if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) out.desborde.push(`${e.tagName}.${e.className} ${Math.round(r.left)}..${Math.round(r.right)}`);
          if (e.matches('button, input, select, textarea, [role=tab]') && !e.closest('.lb-cams') && dentro(e) && (r.height < 43.5 || r.width < 43.5) && !e.matches('input[type=color]')) out.chico.push(`${e.tagName}#${e.id || e.dataset.paso || e.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
          if (e.matches('button, .lb-chip, .lb-tab, .lb-tag') && e.scrollWidth > e.clientWidth + 1) out.cortado.push(e.textContent.trim().slice(0, 30));
          const t = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1); if (!t) continue; const cs = getComputedStyle(e), fg = rgba(cs.color), bg = fondo(e); if (fg.a < 1) { fg.r = fg.r * fg.a + bg.r * (1 - fg.a); fg.g = fg.g * fg.a + bg.g * (1 - fg.a); fg.b = fg.b * fg.a + bg.b * (1 - fg.a); }
          const L1 = lum(fg), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), px = parseFloat(cs.fontSize), grande = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
          if (cr < (grande ? 3 : 4.5)) out.contraste.push(`${e.tagName}.${e.className} "${e.textContent.trim().slice(0, 24)}" ${cr.toFixed(2)} (${px}px)`);
        }
        return out;
      });
      for (const k of Object.keys(r)) for (const m of [...new Set(r[k])]) problemas.push(`${vn} ${tab} ${k}: ${m}`);
      await pg.screenshot({ path: `${SHOTS}/lab-${vn}-low-${tab}.png` });
    }
    assert.deepEqual(errores, [], vn); await ctx.close();
  }
  console.log('problemas de accesibilidad/diseño:', problemas.length, problemas.slice(0, 25));
  assert.deepEqual(problemas, []);
});
