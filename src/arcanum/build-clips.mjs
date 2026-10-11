// Herramienta de línea de comandos (Node): hornea las animaciones que usa Cristal Vórtice.
//   node src/arcanum/build-clips.mjs /ruta/a/duelo-arcano/assets/characters/AnimationLibrary_Godot_Standard.gltf
// Lee la Universal Animation Library de Quaternius (CC0), la redirige al rig MakeHuman de 326 huesos con retarget.js
// (misma técnica que ARCANUM) y guarda SOLO los clips necesarios en assets/arcanum/clips.bin + clips.json
// (cuaterniones Int16, 30 cuadros/s). Así el navegador no descarga 4 MB de glTF ni redirige nada al arrancar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
globalThis.ProgressEvent ??= class ProgressEvent extends Event { constructor(t, i = {}) { super(t); Object.assign(this, i); } };
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
import { redirigirAMakeHuman, codificarClips } from './rig.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2]; if (!src) throw Error('Falta la ruta del .gltf');
const model = JSON.parse(fs.readFileSync(path.join(aqui, '../../assets/arcanum/narrative/model.json'), 'utf8'));
const gltf = JSON.parse(fs.readFileSync(src, 'utf8'));
const bin = fs.readFileSync(path.join(path.dirname(src), gltf.buffers[0].uri));
gltf.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
const lib = await new Promise((ok, no) => new GLTFLoader().parse(JSON.stringify(gltf), '', ok, no));

// clave del juego → clip de la librería ('!' = espejado)
const CLIPS = {
  idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop', sprint: 'Sprint_Loop', crouch: 'Crouch_Idle_Loop', crouchWalk: 'Crouch_Fwd_Loop',
  aimIdle: 'Pistol_Idle_Loop', aim: 'Pistol_Aim_Neutral', shoot: 'Pistol_Shoot', reload: 'Pistol_Reload',
  cast: 'Spell_Simple_Shoot', spellIdle: 'Spell_Simple_Idle_Loop', punch: 'Punch_Jab', hit: 'Hit_Chest',
  jump: 'Jump_Start', fall: 'Jump_Loop', land: 'Jump_Land', death: 'Death01', talk: 'Idle_Talking_Loop', interact: 'Interact', dance: 'Dance_Loop',
};
const clips = redirigirAMakeHuman(lib, model, CLIPS, { solo: true, enSitio: ['sprint', 'crouchWalk', 'dance'] });
// el retargeter trata walk/jog como en sitio por nombre; el resto de locomoción se declara arriba
const { bin: out, entradas } = codificarClips(clips);
// pistas comunes (todas las clips usan los mismos huesos): se guardan una sola vez
const pistas = Object.values(entradas)[0].pistas;
for (const e of Object.values(entradas)) { if (JSON.stringify(e.pistas) !== JSON.stringify(pistas)) throw Error('pistas distintas'); delete e.pistas; }
const dest = path.join(aqui, '../../assets/arcanum');
fs.writeFileSync(path.join(dest, 'clips.bin'), out);
fs.writeFileSync(path.join(dest, 'clips.json'), JSON.stringify({ fuente: 'Quaternius Universal Animation Library (CC0), redirigida a MakeHuman', clips: entradas, pistas }));
console.log('clips:', Object.keys(entradas).join(', '), '| bytes', out.length, '| pistas', pistas.length);
