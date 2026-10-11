// Publica el modo SOLO como sitio estático (GitHub Pages, iPhone sin PC): node tools/build-static.js → dist/
import fs from 'node:fs'; import path from 'node:path';
const OUT = 'dist', cp = (a, b) => fs.cpSync(a, b, { recursive: true });
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
cp('src', `${OUT}/src`); cp('assets', `${OUT}/assets`); cp('public', `${OUT}/public`);
fs.mkdirSync(`${OUT}/vendor/three`, { recursive: true }); cp('node_modules/three/build', `${OUT}/vendor/three`);
for (const d of ['postprocessing', 'shaders', 'utils', 'environments', 'math', 'geometries']) cp(`node_modules/three/examples/jsm/${d}`, `${OUT}/vendor/three-addons/${d}`);
for (const f of ['public/humans.html', 'public/viewer.html']) fs.rmSync(`${OUT}/${f}`, { force: true });
fs.rmSync(`${OUT}/src/arcanum/build-clips.mjs`, { force: true });
let html = fs.readFileSync('public/index.html', 'utf8');
html = html.replace(/(["'(=])\/(public|vendor|src)\//g, '$1./$2/').replace('"/public/manifest.webmanifest"', '"./public/manifest.webmanifest"');
fs.writeFileSync(`${OUT}/index.html`, html); fs.copyFileSync('public/sw.js', `${OUT}/sw.js`);
const man = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8')); man.start_url = './'; man.icons.forEach((i) => (i.src = i.src.replace('/public/', './public/'))); fs.writeFileSync(`${OUT}/public/manifest.webmanifest`, JSON.stringify(man));
fs.writeFileSync(`${OUT}/.nojekyll`, '');
const size = (d) => fs.readdirSync(d, { recursive: true, withFileTypes: true }).filter((x) => x.isFile()).reduce((a, x) => a + fs.statSync(path.join(x.parentPath, x.name)).size, 0);
console.log(`dist/ listo: ${(size(OUT) / 1048576).toFixed(1)} MB`);
