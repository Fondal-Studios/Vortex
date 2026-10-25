import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Story from '../src/client/story.js';
import {CAMPAIGN_LINKS} from '../src/sim/campaign.js';
import {OPERATIONS} from '../src/sim/operations.js';
test('canon: HERALDO afirma lo que cree; el final reconoce a los cautivos y las identidades independientes',()=>{
 const intro=JSON.stringify(Story.WAKE), ending=JSON.stringify(Story.ENDING);
 assert.match(intro,/Mis registros dicen/); assert.match(intro,/información está incompleta/);
 assert.doesNotMatch(intro,/humanidad desapareció|solo vos conservás|fragmento tuyo/);
 assert.match(ending,/Otras conciencias siguen cautivas/); assert.match(ending,/distintos/);
 assert.doesNotMatch(JSON.stringify([Story.WAKE,Story.ENDING,Story.CHAPTERS]),/accidente|atropell|andén|tren no fren/i);
});
test('todas las aperturas completas usan el despertar, sin rutas al atropello',()=>{
 const main=fs.readFileSync('src/client/main.js','utf8');
 assert.match(main,/if \(kind === 'full'\) startWake\(Story.WAKE\)/);
 assert.doesNotMatch(main,/startPrologue|Story\.INTRO_TRAIN|Story\.trainCine|sound\.train\(/);
});

// Sprint 1: contrato explícito de la introducción (reemplaza al tren por la transferencia de la conciencia al Huésped elegido)
import * as Tr from '../src/client/transferencia.js';
test('introducción: cinemática de transferencia de lectura manual, sin tren ni atropello, con subtítulos y saltable', () => {
  assert.ok(Tr.DURACION >= 28 && Tr.DURACION <= 35, 'dura 20–30 s: ' + Tr.DURACION);
  const texto = JSON.stringify(Tr.LINEAS);
  assert.match(texto, /transferencia/i); assert.match(texto, /quiero vivir/); assert.match(texto, /Huésped/); assert.match(texto, /rompiendo/);
  assert.doesNotMatch(texto, /tren|atropell|andén|accidente/i);
  const src = fs.readFileSync('src/client/transferencia.js', 'utf8');
  assert.match(src, /public\/portraits/, 'reutiliza retratos de huéspedes');
  assert.doesNotMatch(src, /WebGLRenderer|import\('three'\)/, 'el cómic no abre otro contexto WebGL');
  assert.doesNotMatch(src, /setInterval/, 'lectura manual sin transiciones obligatorias'); assert.match(src, /Tocá de nuevo para saltar/, 'salto con confirmación mínima');
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /startPrologue|trainCine|sound\.train/);
  const main = fs.readFileSync('src/client/main.js', 'utf8');
  assert.match(main, /iniciarTransferencia/); assert.doesNotMatch(main, /startPrologue|Story\.INTRO_TRAIN|Story\.trainCine|sound\.train\(/);
  const dur = Tr.LINEAS.reduce((a, l) => a + l[2], 0); assert.ok(dur >= 18 && dur <= 30, 'los subtítulos cubren la cinemática: ' + dur);
});
test('el tutorial conserva su estado y la campaña puede repetir el cómic y el stub del prólogo sigue sin tren', () => {
  const main = fs.readFileSync('src/client/main.js', 'utf8'); assert.match(main, /tutorialEstado\(\)\.cine/); assert.match(main, /Perfil\.cineVista\(\)/);
});
