// Lanzador único del navegador de pruebas (Chromium con WebGL por software).
// Orden de búsqueda del ejecutable:
//   1) BROWSER_EXECUTABLE (ruta exacta al binario)
//   2) PLAYWRIGHT_BROWSERS_PATH (carpeta que crea `npx playwright install chromium`)
//   3) /opt/pw-browsers (imagen de desarrollo)
//   4) ~/.cache/ms-playwright (instalación por defecto de Playwright)
//   5) Chromium del sistema (apt: chromium / chromium-browser / google-chrome)
// En CI se exporta REQUIRE_BROWSER=1: si no hay navegador, las pruebas FALLAN (nunca se omiten en silencio).
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const esArchivo = (p) => { try { return !!p && fs.statSync(p).isFile(); } catch { return false; } };

function enCarpeta(base) {
  if (!base || !fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).filter((d) => /^chromium(_headless_shell)?-/.test(d)).sort((a, b) => (b.startsWith('chromium-') - a.startsWith('chromium-')) || (a < b ? 1 : -1));
  for (const d of dirs) {
    for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-linux/headless_shell', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
      const p = path.join(base, d, rel);
      if (esArchivo(p)) return p;
    }
  }
  return esArchivo(path.join(base, 'chromium')) ? path.join(base, 'chromium') : null;
}

export function findChromium() {
  if (process.env.BROWSER_EXECUTABLE) return esArchivo(process.env.BROWSER_EXECUTABLE) ? process.env.BROWSER_EXECUTABLE : null;
  for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(os.homedir(), '.cache/ms-playwright')]) {
    const p = enCarpeta(base);
    if (p) return p;
  }
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable']) if (esArchivo(p)) return p;
  return null;
}

// Para `{ skip: !hasChromium }` en las pruebas. Con REQUIRE_BROWSER=1 (CI) lanza error en vez de omitir.
export function browserAvailable() {
  const exe = findChromium();
  if (!exe && process.env.REQUIRE_BROWSER === '1') {
    throw new Error('REQUIRE_BROWSER=1 pero no se encontró Chromium (BROWSER_EXECUTABLE / PLAYWRIGHT_BROWSERS_PATH / `npx playwright install --with-deps chromium`).');
  }
  return !!exe;
}

export async function launch() {
  const executablePath = findChromium() || undefined; // sin ruta: Playwright usa su propio Chromium instalado
  return chromium.launch({
    executablePath, headless: true,
    args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
}
