import { qualityOf, Kit } from '../../src/client/weapons/kit.js';
import { collectSolids } from '../../src/client/weapons/hand-rig.js';
import { BUILD } from '../../src/client/weapons/guns.js';
import '../../src/client/weapons/guns2.js'; import '../../src/client/weapons/guns3.js';
globalThis.document = { createElement: () => ({ getContext: () => ({ createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, strokeRect() {}, fillText() {} }) }) };
const orig = Kit.prototype.part; let seen = 0;
const W = BUILD[0](qualityOf('high'), true);
