// Cliente del Limbo vivo (src/client/mundo-vivo.js): NPC cercano, afijos, linajes, panel y su cableado. Sin navegador: lógica pura + chequeos de fuente.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { arena, ahead, run } from './helpers.js';
import { AFFIXES, AFFIX_IDS, LINEAGE } from '../src/sim/data.js';
import { NPC_INFO, NPC_KINDS } from '../src/sim/npcs.js';
import { npcNear, affixInfo, lineageOf, lineageStyle, dealText, hexCss, NPC_COLORS, NPC_RANGE, createNpcPanel } from '../src/client/mundo-vivo.js';

const src = (f) => fs.readFileSync(new URL('../src/client/' + f, import.meta.url), 'utf8');

test('npcNear: usa el mismo alcance que la simulación (7) y elige el más cercano', () => {
  const me = { pos: [0, 0, 0] }, mk = (id, x, nk = 'cambista') => ({ id, t: 'npc', nk, p: [x, 0, 0] });
  assert.equal(NPC_RANGE, 7);
  assert.equal(npcNear({ objs: [mk(1, 6.9), mk(2, 3, 'herrero')] }, me).id, 2);
  assert.equal(npcNear({ objs: [mk(1, 7.1)] }, me), null);
  assert.equal(npcNear({ objs: [{ id: 3, t: 'plate', p: [1, 0, 0] }] }, me), null, 'sólo objetos npc');
  assert.equal(npcNear({ objs: [mk(1, 2, 'raro')] }, me), null, 'tipo desconocido ignorado');
  assert.equal(npcNear({ objs: [mk(1, 2)] }, { pos: [0, 0, 0], dead: true }), null);
  assert.equal(npcNear(null, me), null);
});

test('npcNear con el snapshot real: el NPC del respiro aparece y se puede usar', () => {
  const { g, p } = arena(); g.phase = 'wave'; g.wave = 1; g.waveTotal = 7; g.phaseT = 1e9; g.objective = null; g.monsters = []; g.queue = []; run(g, 1.5);
  let s = g.snapshot(), me = s.players[0]; const n = npcNear(s, me);
  assert.ok(n, 'hay NPC cerca'); assert.ok(NPC_KINDS.includes(n.nk)); assert.ok(NPC_COLORS[n.nk]);
  g.setInput(p.id, { npc: { offer: 1 } }); run(g, 0.1); s = g.snapshot();
  const d = s.events.find((e) => e.t === 'npcdeal'); assert.ok(d, 'la sim responde con npcdeal'); assert.ok(dealText(d).length > 5);
});

test('afijos: los 6 tienen nombre, color y etiqueta en mayúsculas; sin afijo no hay nada', () => {
  for (const id of AFFIX_IDS) { const a = affixInfo(id); assert.equal(a.name, AFFIXES[id].name); assert.equal(a.color, AFFIXES[id].color); assert.equal(a.label, a.name.toUpperCase()); }
  assert.equal(affixInfo(undefined), null); assert.equal(affixInfo('inexistente'), null);
  assert.equal(hexCss(0xb0c4de), '#b0c4de'); assert.equal(hexCss(0x0000ff), '#0000ff');
});

test('linajes: se lee de la ranura del arma en mano y el estilo difiere entre Alba y Ocaso', () => {
  const me = { sl: [0, 3, 5, 7, 9], w: 5, ug: [0, 0, [3, 0, 0, null, 'sinapsis', 'ocaso'], 0, 0] };
  assert.equal(lineageOf(me).id, 'ocaso'); assert.equal(lineageOf(me).color, LINEAGE.forms.ocaso.color);
  assert.equal(lineageOf({ ...me, w: 3 }), null, 'otra arma sin linaje');
  assert.equal(lineageOf({ ...me, w: 99 }), null); assert.equal(lineageOf(null), null);
  const a = lineageStyle('alba'), o = lineageStyle('ocaso');
  assert.notEqual(a.color, o.color); assert.ok(a.ember > 0 && o.ember < 0, 'Alba sube, Ocaso cae'); assert.equal(lineageStyle('nada'), null);
});

test('linajes: el snapshot real trae la forma en ug[i][5]', () => {
  const { g, p } = arena(); p.upg[p.slots[1]] = { dmg: 3, rate: 0, mag: 0, mod: null, mut: 'x', forma: 'alba' };
  const me = g.snapshot().players[0]; me.w = p.slots[1]; assert.equal(lineageOf(me).id, 'alba');
});

test('dealText: éxito y fracaso usan el texto de NPC_INFO', () => {
  for (const k of NPC_KINDS) for (const offer of [0, 1]) {
    assert.ok(dealText({ kind: k, offer, ok: true }).includes(NPC_INFO[k].name));
    assert.ok(dealText({ kind: k, offer, ok: false }).includes(NPC_INFO[k].offers[offer].cost));
  }
  assert.equal(dealText({ kind: 'x' }), 'No pasó nada.');
});

test('panel de NPC: el pedido sale UNA sola vez y sólo con el panel abierto', () => {
  const mkEl = () => { const el = { className: '', innerHTML: '', classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {}, querySelectorAll: () => [], querySelector: () => ({ addEventListener() {}, set textContent(v) { el.msg = v; } }) }; return el; };
  globalThis.document = { createElement: mkEl }; globalThis.performance ||= { now: () => 0 };
  const log = []; const pn = createNpcPanel({ appendChild() {} }, { onToggle: (o) => log.push(o) });
  assert.equal(pn.open, false); assert.equal(pn.choose(0), false); assert.equal(pn.take(), null);
  assert.ok(pn.show('sanadora')); assert.equal(pn.open, true); assert.equal(pn.kind, 'sanadora');
  assert.equal(pn.show('no-existe'), false);
  assert.equal(pn.choose(2), false); assert.ok(pn.choose(1));
  assert.deepEqual(pn.take(), { offer: 1 }); assert.equal(pn.take(), null, 'no se repite');
  pn.result({ kind: 'sanadora', offer: 1, ok: true }); pn.close(); assert.equal(pn.open, false); assert.deepEqual(log, [true, false]);
  delete globalThis.document;
});

test('cableado: render, objetos, main y el arma usan el módulo (chequeo de fuente)', () => {
  assert.match(src('render.js'), /setAffix\(e, m\.af\)/); assert.match(src('render.js'), /vm\.setLineage\(/);
  assert.match(src('objects.js'), /buildNpc\(d\)/); assert.match(src('objects.js'), /o\.t === 'npc'/);
  assert.match(src('weapons-vm.js'), /setLineage\(st\)/);
  const m = src('main.js'); assert.match(m, /npcInput\(ti\)/); assert.match(m, /return (?:learnedInput\()?npcInput\(i\)/);   /* el input pasa por learnedInput (aprendizaje de controles) antes de salir */ assert.match(m, /case 'npcdeal'/); assert.match(m, /npcPanel\.choose/);
  assert.ok(fs.readFileSync(new URL('../public/style.css', import.meta.url), 'utf8').includes('#npcpanel'));
  void ahead;
});
