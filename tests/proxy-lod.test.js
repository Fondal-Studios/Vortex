// Proxy de lejos: cada especie debe verse con SU silueta, no con la esfera genérica (src/client/proxy-lod.js).
// Los modelos usan texturas/canvas del navegador, así que aquí se simula un «document» mínimo.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ctx2d = new Proxy(function () {}, { get: (t, k) => (k === 'canvas' ? undefined : ctx2d), apply: () => ctx2d, set: () => true });
const el = () => ({ style: {}, width: 0, height: 0, getContext: () => ctx2d, addEventListener() {}, removeEventListener() {}, set src(v) {}, setAttribute() {} });
globalThis.document = { createElement: el, createElementNS: el, addEventListener() {}, body: el() };
globalThis.window = globalThis.window || { addEventListener() {}, devicePixelRatio: 1, innerWidth: 800, innerHeight: 600 };

const { bakeProxyGeometry, proxyMaterial } = await import('../src/client/proxy-lod.js');
const { COLORS } = await import('../src/client/models.js');
const KINDS = Object.keys(COLORS);

test('render.js ya no usa la esfera genérica como proxy: usa la silueta horneada', () => {
  const src = fs.readFileSync(new URL('../src/client/render.js', import.meta.url), 'utf8');
  assert.match(src, /bakeProxyGeometry\(m\.k\)/);
  assert.doesNotMatch(src, /shared\('lodgeo',/);
});

for (const kind of KINDS) {
  test(`proxy de «${kind}»: malla propia, liviana y distinta de la esfera`, () => {
    const g = bakeProxyGeometry(kind);
    assert.ok(g, 'se generó una geometría');
    const tris = g.index.count / 3;
    assert.ok(tris >= 12 && tris <= 400, `triángulos razonables (${tris})`);
    assert.notEqual(tris, 80, 'no es el icosaedro de 80 caras');
    g.computeBoundingBox(); const s = g.boundingBox.getSize(new (g.boundingBox.min.constructor)());
    const dims = [s.x, s.y, s.z].sort((a, b) => a - b);
    assert.ok(dims[2] > 0.3, 'tiene tamaño');
    assert.ok(dims[2] / Math.max(dims[0], 1e-3) > 1.15, `no es una esfera (proporción ${(dims[2] / Math.max(dims[0], 1e-3)).toFixed(2)})`);
    assert.ok(g.attributes.color, 'lleva colores de vértice');
    g.dispose();
  });
}

test('las siluetas de las especies son distintas entre sí', () => {
  const sig = new Set();
  for (const k of KINDS) { const g = bakeProxyGeometry(k); sig.add(g.index.count + ':' + g.attributes.position.count); g.dispose(); }
  assert.equal(sig.size, KINDS.length);
});

test('un solo material compartido, barato (sin iluminación)', () => {
  assert.equal(proxyMaterial(), proxyMaterial());
  assert.equal(proxyMaterial().isMeshBasicMaterial, true);
});
