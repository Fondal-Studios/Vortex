import { chromium } from 'playwright-core';
import fs from 'node:fs';
export async function launch() {
  const base = '/opt/pw-browsers';
  const dir = (fs.existsSync(base) ? fs.readdirSync(base) : []).find((d) => d.startsWith('chromium-'));
  const exe = [process.env.BROWSER_EXECUTABLE, `${base}/${dir}/chrome-linux/chrome`, `${base}/chromium`].find((p) => p && fs.existsSync(p) && fs.statSync(p).isFile());
  return chromium.launch({
    executablePath: exe, headless: true,
    args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
}
