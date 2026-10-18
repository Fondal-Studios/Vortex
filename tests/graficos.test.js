import test from 'node:test';
import assert from 'node:assert/strict';
import * as GF from '../src/client/graficos.js';
import { LEVELS, AutoQuality, cfg, setCurrent, setOverrides, overrides } from '../src/client/quality.js';

// Menú de Gráficos — lógica pura (sin pantalla): presets, ajustes sueltos, guardado, traducción a quality.js y piso de Automático.
const TEL = { tactil: true, nucleos: 6 }, PC = { tactil: false, nucleos: 8 }, PC_CHICA = { tactil: false, nucleos: 4 };
const memoria = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

test('los 4 presets existen y mapean a niveles reales; el automático depende del equipo', () => {
  assert.deepEqual(GF.PRESET_IDS, ['baja', 'media', 'alta', 'auto']);
  assert.equal(GF.nivelDe(GF.elegirPreset(GF.ESTADO_INICIAL, 'baja'), PC), 'low');
  assert.equal(GF.nivelDe(GF.elegirPreset(GF.ESTADO_INICIAL, 'media'), TEL), 'medium');
  assert.equal(GF.nivelDe(GF.elegirPreset(GF.ESTADO_INICIAL, 'alta'), TEL), 'high');
  assert.equal(GF.nivelDe(GF.ESTADO_INICIAL, TEL), 'low', 'teléfono ⇒ Baja');
  assert.equal(GF.nivelDe(GF.ESTADO_INICIAL, PC), 'high');
  assert.equal(GF.nivelDe(GF.ESTADO_INICIAL, PC_CHICA), 'medium');
  assert.equal(GF.presetRecomendado(TEL), 'baja');
  for (const id of GF.PRESET_IDS) assert.ok(GF.PRESETS[id].desc.length > 30 && GF.PRESETS[id].quien, `${id}: descripción y para quién sirve`);
  assert.match(GF.PRESETS.baja.desc, /iPhone/);
});

test('un preset puro no cambia nada sobre LEVELS (ov vacío) y la escala base es 100 %', () => {
  for (const [id, nivel] of [['baja', 'low'], ['media', 'medium'], ['alta', 'high']]) {
    const r = GF.resolver(GF.elegirPreset(GF.ESTADO_INICIAL, id));
    assert.equal(r.nivel, nivel); assert.deepEqual(r.ov, {});
    assert.equal(GF.valorDe(GF.elegirPreset(GF.ESTADO_INICIAL, id), 'escala'), 100);
  }
});

test('cada interruptor se traduce a la clave correcta de quality.js', () => {
  let e = GF.elegirPreset(GF.ESTADO_INICIAL, 'baja');
  e = GF.ajustar(e, 'sombras', true); assert.equal(GF.resolver(e).ov.shadows, true);
  e = GF.ajustar(e, 'bloom', true); assert.equal(GF.resolver(e).ov.post, true); assert.ok(GF.resolver(e).ov.bloom > 0);
  e = GF.ajustar(e, 'nieblaAire', 3); assert.equal(GF.resolver(e).ov.fogLayers, 3);
  e = GF.ajustar(e, 'particulas', 1.6); assert.equal(GF.resolver(e).ov.particles, Math.round(LEVELS.low.particles * 1.6));
  e = GF.ajustar(e, 'humanos', 'high'); assert.equal(GF.resolver(e).ov.humans, 'high');
  e = GF.ajustar(e, 'decorado', true); assert.equal(GF.resolver(e).ov.decor, true);
  e = GF.ajustar(e, 'lod', 1.5); assert.equal(GF.resolver(e).ov.lod, Math.round(LEVELS.low.lod * 1.5)); assert.ok(GF.resolver(e).ov.full > LEVELS.low.full);
  e = GF.ajustar(e, 'fps', 30); assert.equal(GF.resolver(e).ov.fps, 30);
  e = GF.ajustar(e, 'nieblasFx', 0); assert.equal(GF.resolver(e).ov.nieblas, 0);
  e = GF.ajustar(e, 'escala', 150); assert.equal(GF.resolver(e).ov.scale, 1.5);
  assert.equal(GF.valorDe(e, 'escala'), 150);
});

test('volver al valor del preset borra el ajuste; Restablecer y cambiar de preset limpian todo', () => {
  let e = GF.elegirPreset(GF.ESTADO_INICIAL, 'media');
  e = GF.ajustar(e, 'sombras', true); assert.equal(GF.personalizados(e), 1);
  e = GF.ajustar(e, 'sombras', false); assert.equal(GF.personalizados(e), 0, 'media ya trae sombras apagadas');
  e = GF.ajustar(e, 'escala', 70); e = GF.ajustar(e, 'fps', 30); assert.equal(GF.personalizados(e), 2);
  assert.equal(GF.personalizados(GF.elegirPreset(e, 'alta')), 0);
  const r = GF.restablecer(e); assert.equal(r.preset, 'auto'); assert.equal(GF.personalizados(r), 0); assert.equal(r.auto, true);
  assert.equal(GF.personalizados(GF.ajustar(e, 'escala', 100)), 1, 'escala 100 % = la del preset');
});

test('la escala se limita a 50–150 % de a 5 y calcula el pixelRatio como el renderizador', () => {
  let e = GF.elegirPreset(GF.ESTADO_INICIAL, 'baja');
  assert.equal(GF.valorDe(GF.ajustar(e, 'escala', 10), 'escala'), 50);
  assert.equal(GF.valorDe(GF.ajustar(e, 'escala', 999), 'escala'), 150);
  assert.equal(GF.valorDe(GF.ajustar(e, 'escala', 83), 'escala'), 85);
  // iPhone (dpr 3) en Baja: el nivel limita a 1; con 150 % sube a 1,5; con 50 % baja a 0,5 × (3 × 0,85)
  const L = LEVELS.low;
  assert.equal(GF.pixelRatioDe({ ...L, scale: 1 }, 3), 1);
  assert.equal(GF.pixelRatioDe({ ...L, scale: 1.5 }, 3), 1.5);
  assert.ok(Math.abs(GF.pixelRatioDe({ ...L, scale: 0.5 }, 3) - 1) < 1e-9 || GF.pixelRatioDe({ ...L, scale: 0.5 }, 3) <= 1.275);
  assert.ok(GF.pixelRatioDe({ ...L, scale: 0.5 }, 1) >= 0.4);
  // a menos escala nunca da más resolución
  for (const d of [1, 2, 3]) assert.ok(GF.pixelRatioDe({ ...L, scale: 0.5 }, d) <= GF.pixelRatioDe({ ...L, scale: 1 }, d));
});

test('el estado se guarda, se recupera y se sanea (datos viejos o rotos no rompen nada)', () => {
  const m = memoria();
  let e = GF.ajustar(GF.elegirPreset(GF.ESTADO_INICIAL, 'media'), 'escala', 80);
  e = GF.conMedidor(GF.conAuto(e, false), true);
  assert.ok(GF.guardar(e, m));
  assert.deepEqual(GF.cargar(m), e);
  m.setItem(GF.KEY, '{"preset":"ultra","ajustes":{"sombras":"quizás","escala":9999,"fps":45,"humanos":"high","inventado":1}}');
  const s = GF.cargar(m);
  assert.equal(s.preset, 'auto'); assert.deepEqual(s.ajustes, { humanos: 'high', escala: 150 });
  m.setItem(GF.KEY, 'no es json'); assert.deepEqual(GF.cargar(m), GF.sanear(null));
  assert.equal(GF.guardar(GF.ESTADO_INICIAL, null), false, 'sin almacenamiento no falla');
  assert.deepEqual(GF.cargar(null), GF.sanear(null));
});

test('cfg() de quality.js mezcla el nivel con los ajustes y vuelve a lo puro al limpiar', () => {
  setCurrent('low'); setOverrides(null);
  assert.equal(cfg(), LEVELS.low);
  const { ov } = GF.resolver(GF.ajustar(GF.elegirPreset(GF.ESTADO_INICIAL, 'baja'), 'sombras', true));
  setOverrides(ov); assert.equal(cfg().shadows, true); assert.equal(cfg().particles, LEVELS.low.particles); assert.deepEqual(overrides(), ov);
  const a = cfg(); assert.equal(a, cfg(), 'mismo objeto mientras nada cambie (sin asignar por cuadro)');
  setCurrent('high'); assert.equal(cfg().humans, 'high'); assert.equal(cfg().shadows, true);
  setOverrides({}); assert.equal(cfg(), LEVELS.high); setCurrent('high');
});

test('LEVELS trae las claves nuevas (niebla de aire, nubes de nieblas, escala) y los FPS por defecto no frenan a nadie', () => {
  for (const L of Object.values(LEVELS)) { assert.ok(L.fogLayers >= 0 && L.fogLayers <= 3); assert.ok([0, 1, 2].includes(L.nieblas)); assert.equal(L.scale, 1); assert.equal(L.fps, 60); }
  assert.ok(LEVELS.low.fogLayers <= LEVELS.medium.fogLayers && LEVELS.medium.fogLayers <= LEVELS.high.fogLayers);
});

test('cada opción tiene nombre, nota para principiantes, costo 0-3 y valores válidos', () => {
  for (const O of Object.values(GF.OPCIONES)) {
    assert.ok(O.nombre && O.nota.length > 20, O.id); assert.ok(O.costo >= 0 && O.costo <= 3, O.id);
    if (O.tipo === 'pasos') assert.ok(O.pasos.length >= 2 && O.pasos.every((p) => p.t), O.id);
    assert.ok(O.id in { ...GF.OPCIONES }, O.id);
  }
  assert.ok(GF.OPCIONES.sombras.costo === 3 && !GF.OPCIONES.sombras.vivo, 'sombras: caro y reconstruye');
  for (const id of ['sombras', 'bloom', 'postproc', 'nieblaAire', 'particulas', 'humanos', 'lod', 'fps']) assert.ok(GF.OPCIONES[id], `pedido: ${id}`);
  assert.deepEqual(GF.OPCIONES.fps.pasos.map((p) => p.v), [30, 60]);
});

test('resumen, medidor de FPS y color', () => {
  assert.match(GF.resumen(GF.elegirPreset(GF.ESTADO_INICIAL, 'baja')), /^Baja · 100 % · 60 FPS$/);
  assert.match(GF.resumen(GF.ESTADO_INICIAL, TEL), /Automático \(Baja\)/);
  assert.match(GF.resumen(GF.ajustar(GF.elegirPreset(GF.ESTADO_INICIAL, 'baja'), 'fps', 30)), /30 FPS · 1 ajuste propio/);
  assert.equal(GF.colorFps(60), 'ok'); assert.equal(GF.colorFps(45), 'medio'); assert.equal(GF.colorFps(20), 'mal'); assert.equal(GF.colorFps(29, 30), 'ok');
  assert.equal(GF.conMedidor(GF.ESTADO_INICIAL, true).medidor, true);
});

test('Automático: baja un escalón tras 5 s malos, en Baja baja la resolución de a poco (hasta 60 %) y se puede apagar', () => {
  const bajas = [], escalas = [];
  const a = new AutoQuality((l) => bajas.push(l), () => escalas.push(1));
  for (let i = 0; i < 400; i++) a.tick(1 / 20, 'high');   // 20 FPS durante 20 s
  assert.ok(bajas.length >= 2 && bajas[0] === 'medium', 'Alta → Media');
  for (let i = 0; i < 200; i++) a.tick(1 / 20, 'low'); assert.ok(escalas.length >= 1, 'en Baja pide bajar la resolución');
  const b = new AutoQuality(() => assert.fail('apagado'), () => assert.fail('apagado')); b.enabled = false;
  for (let i = 0; i < 400; i++) b.tick(1 / 10, 'high');
  const c = new AutoQuality(() => assert.fail('en Baja sin onScale no hay a dónde bajar')); for (let i = 0; i < 400; i++) c.tick(1 / 10, 'low');
  const ok = new AutoQuality(() => assert.fail('a 60 FPS no baja')); for (let i = 0; i < 2000; i++) ok.tick(1 / 60, 'high');
  assert.equal(GF.escalaMasBaja(100), 85); assert.equal(GF.escalaMasBaja(60), null); assert.equal(GF.escalaMasBaja(65), 60);
});
