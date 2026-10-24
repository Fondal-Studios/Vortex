import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Story from '../src/client/story.js';
import {CAMPAIGN_LINKS} from '../src/sim/campaign.js';
import {OPERATIONS} from '../src/sim/operations.js';
test('canon: una única conciencia humana en el futuro, sin accidente ni otros supervivientes',()=>{
 const texts=JSON.stringify([Story.WAKE,Story.ENDING,Story.CHAPTERS,CAMPAIGN_LINKS,OPERATIONS]);
 assert.match(texts,/última conciencia humana/);assert.match(texts,/futuro remoto/);
 assert.doesNotMatch(texts,/accidente|atropell|andén|tren no fren|otros como vos|demás cautivos|detectó conciencias/i);
 assert.match(JSON.stringify(Story.ENDING),/cuerpo sintético/);
});
test('todas las aperturas completas usan el despertar, sin rutas al atropello',()=>{
 const main=fs.readFileSync('src/client/main.js','utf8');
 assert.match(main,/if \(kind === 'full'\) startWake\(Story.WAKE\)/);
 assert.doesNotMatch(main,/startPrologue|Story\.INTRO_TRAIN|Story\.trainCine|sound\.train\(/);
});

// Sprint 1: contrato explícito de la introducción (reemplaza al tren por la transferencia de la conciencia al Huésped elegido)
import * as Tr from '../src/client/transferencia.js';
test('introducción: cinemática de transferencia de 20–30 s, sin tren ni atropello, con subtítulos y saltable', () => {
  assert.ok(Tr.DURACION >= 20 && Tr.DURACION <= 30, 'dura 20–30 s: ' + Tr.DURACION);
  const texto = JSON.stringify(Tr.LINEAS);
  assert.match(texto, /transferencia/i); assert.match(texto, /última conciencia humana/); assert.match(texto, /Huésped/); assert.match(texto, /futuro remoto/);
  assert.doesNotMatch(texto, /tren|atropell|andén|accidente/i);
  const src = fs.readFileSync('src/client/transferencia.js', 'utf8');
  assert.match(src, /createHostBody/, 'usa el cuerpo unificado del Huésped');
  assert.match(src, /reduceFx|reduceMotion/, 'respeta «Reducir efectos»'); assert.match(src, /Tocá de nuevo para saltar/, 'salto con confirmación mínima');
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /startPrologue|trainCine|sound\.train/);
  const main = fs.readFileSync('src/client/main.js', 'utf8');
  assert.match(main, /iniciarTransferencia/); assert.doesNotMatch(main, /startPrologue|Story\.INTRO_TRAIN|Story\.trainCine|sound\.train\(/);
  const dur = Tr.LINEAS.reduce((a, l) => a + l[2], 0); assert.ok(dur >= 18 && dur <= 30, 'los subtítulos cubren la cinemática: ' + dur);
});
test('la cinemática sólo se muestra la primera vez (perfil.tut.cine) y el stub del prólogo sigue sin tren', () => {
  const main = fs.readFileSync('src/client/main.js', 'utf8'); assert.match(main, /tutorialEstado\(\)\.cine/); assert.match(main, /Perfil\.cineVista\(\)/);
});
