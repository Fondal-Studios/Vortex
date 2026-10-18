// Descarga REPRODUCIBLE de recursos CC0 de Poly Haven (https://polyhaven.com, licencia CC0: uso libre, sin atribución obligatoria).
// Lista fija de texturas PBR 1K (color + normales GL + rugosidad, JPG) y cielos HDRI 1K. Destino: public/assets/ph/<id>/.
// Uso: node tools/polyhaven-fetch.mjs        (no vuelve a bajar lo que ya está; --forzar baja todo de nuevo)
// Usa `curl` (viene con macOS, Linux y Windows 10+) porque respeta el proxy del sistema; reintenta 4 veces.
// Presupuesto: ≤ 25 MB en total (el script avisa si se pasa). Lista y licencias: docs/ASSETS.md.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const PH_TEXTURES = {
  marble_01: 'mármol blanco veteado (pisos, columnas, porcelana)',
  marble_tiles: 'baldosas de mármol (pisos de templo)',
  white_sandstone_bricks: 'sillares de arenisca clara (muros de templo)',
  medieval_wall_01: 'piedra gastada (muros, plataformas)',
  metal_plate: 'metal trabajado (base del ORO envejecido con tinte y metalness 1)',
  rough_linen: 'tela de lino (ropas, velos)',
  rusty_metal_02: 'metal oxidado y ennegrecido (armaduras de los Huéspedes)',
  brown_leather: 'cuero gastado (correas, faldones, guanteletes)',
  bark_brown_02: 'corteza (Micelio, raíces)',
  rock_boulder_cracked: 'roca agrietada (hueso fósil, coraza pétrea)',
};
export const PH_HDRIS = {
  small_cathedral_02: 'interior de catedral (reflejos dorados, luz de templo)',
  moonless_golf: 'noche sin luna (cielo oscuro, luz fría suave)',
  qwantani_dusk_2_puresky: 'cielo de atardecer puro (luz cálida + rebote frío)',
};
const MAPS = { Diffuse: 'diff', nor_gl: 'nor_gl', Rough: 'rough' };
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'assets', 'ph');
const FORCE = process.argv.includes('--forzar');

function curl(args) {
  for (let i = 1; i <= 4; i++) {
    try { return execFileSync('curl', ['-sSfL', '--retry', '2', '-m', '120', ...args], { maxBuffer: 64 << 20 }); }
    catch (e) { if (i === 4) throw e; console.warn(`  reintento ${i}…`); }
  }
}
const api = (id) => JSON.parse(curl([`https://api.polyhaven.com/files/${id}`]).toString());
function get(url, dest, size) {
  if (!FORCE && fs.existsSync(dest) && (!size || fs.statSync(dest).size === size)) { console.log('  ya está', path.basename(dest)); return; }
  fs.mkdirSync(path.dirname(dest), { recursive: true }); curl(['-o', dest, url]); console.log('  bajado', path.basename(dest), Math.round(fs.statSync(dest).size / 1024) + ' KB');
}
const manifest = { license: 'CC0 1.0 (Poly Haven)', textures: {}, hdris: {} };
for (const [id, use] of Object.entries(PH_TEXTURES)) {
  console.log('textura', id); const f = api(id), entry = { use, page: `https://polyhaven.com/a/${id}`, files: {} };
  for (const [k, short] of Object.entries(MAPS)) {
    const src = f[k] && f[k]['1k'] && f[k]['1k'].jpg; if (!src) { console.warn('  falta', k); continue; }
    const dest = path.join(ROOT, id, `${id}_${short}_1k.jpg`); get(src.url, dest, src.size); entry.files[short] = { file: path.relative(path.join(ROOT, '..', '..', '..'), dest), url: src.url };
  }
  manifest.textures[id] = entry;
}
for (const [id, use] of Object.entries(PH_HDRIS)) {
  console.log('hdri', id); const f = api(id), src = f.hdri['1k'].hdr, dest = path.join(ROOT, id, `${id}_1k.hdr`);
  get(src.url, dest, src.size); manifest.hdris[id] = { use, page: `https://polyhaven.com/a/${id}`, file: path.relative(path.join(ROOT, '..', '..', '..'), dest), url: src.url };
}
fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(manifest, null, 1));
let total = 0; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else total += fs.statSync(p).size; } }; walk(ROOT);
console.log(`total public/assets/ph: ${(total / 1048576).toFixed(1)} MB ${total > 25 * 1048576 ? '⚠ SUPERA el presupuesto de 25 MB' : '(dentro del presupuesto de 25 MB)'}`);
