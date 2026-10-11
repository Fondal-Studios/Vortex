// Genera los íconos de la app (iPhone: pantalla de inicio) con Chromium: public/icon-180.png y icon-512.png
import { launch } from './browser.js';
import fs from 'node:fs';
const b = await launch(); const pg = await b.newPage({ viewport: { width: 512, height: 512 } });
await pg.setContent(`<canvas id=c width=512 height=512></canvas>`);
const png = await pg.evaluate(() => {
  const c = document.getElementById('c'), g = c.getContext('2d');
  const bg = g.createRadialGradient(256, 200, 20, 256, 256, 360); bg.addColorStop(0, '#3a1080'); bg.addColorStop(0.6, '#150636'); bg.addColorStop(1, '#07030f'); g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
  // cristal central iridiscente
  const pts = [[256, 70], [380, 210], [330, 440], [182, 440], [132, 210]];
  const grad = g.createLinearGradient(130, 70, 390, 440); grad.addColorStop(0, '#66ffee'); grad.addColorStop(0.5, '#ff66c4'); grad.addColorStop(1, '#ffd23f');
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = grad; g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1;
  g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
  g.lineWidth = 3; g.strokeStyle = '#ffffffaa'; g.beginPath(); g.moveTo(256, 70); g.lineTo(256, 440); g.moveTo(132, 210); g.lineTo(380, 210); g.moveTo(256, 210); g.lineTo(182, 440); g.moveTo(256, 210); g.lineTo(330, 440); g.stroke();
  // ojo
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(256, 270, 56, 34, 0, 0, 7); g.fill(); g.fillStyle = '#7dfff0'; g.beginPath(); g.arc(256, 270, 22, 0, 7); g.fill(); g.fillStyle = '#07030f'; g.beginPath(); g.ellipse(256, 270, 8, 20, 0, 0, 7); g.fill();
  return c.toDataURL('image/png');
});
fs.writeFileSync('public/icon-512.png', Buffer.from(png.split(',')[1], 'base64'));
const p2 = await b.newPage({ viewport: { width: 180, height: 180 } });
await p2.setContent(`<body style="margin:0"><img src="${png}" width=180 height=180></body>`); await p2.screenshot({ path: 'public/icon-180.png' });
await b.close(); console.log('íconos listos');
