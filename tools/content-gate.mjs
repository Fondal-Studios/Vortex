// node tools/content-gate.mjs docs/identity-gates.json
import fs from 'node:fs';
import { evaluateGate } from '../src/shared/identity.js';
const file=process.argv[2];
if(!file){console.error('Uso: node tools/content-gate.mjs <registro.json>');process.exit(2);}
const registry=JSON.parse(fs.readFileSync(file,'utf8'));let failed=0;
for(const piece of registry.pieces||[]){const gate=evaluateGate(piece.type,piece.scores,piece.evidence);const missingFiles=Object.values(piece.evidence||{}).filter(p=>typeof p!=='string'||!fs.existsSync(p));const pass=gate.pass&&!missingFiles.length&&piece.reviewedBy&&piece.reviewedBy!==piece.author;
 console.log(`${pass?'PASA':'PENDIENTE'} ${piece.id}: ${[...gate.missing,...missingFiles].join(', ')||(!pass?'falta revisión independiente':'mínimo ≥7, evidencia presente')}`);if(!pass)failed++;}
if(!registry.pieces?.length)failed++;process.exitCode=failed?1:0;
