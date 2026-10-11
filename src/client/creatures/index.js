// Registro de criaturas VIVAS. Cada archivo exporta `default function build(kit, color)` → { root, mats, tick(dt, st, t, ctx) }.
// Si un archivo exporta null se usa el modelo de cristal de respaldo (models.js).
import astilla from './astilla.js'; import geoda from './geoda.js'; import prisma from './prisma.js'; import lente from './lente.js';
import cuarzo from './cuarzo.js'; import espejo from './espejo.js'; import racimo from './racimo.js'; import graviton from './graviton.js';
import obelisco from './obelisco.js'; import aurora from './aurora.js'; import ariete from './ariete.js'; import espiral from './espiral.js';
import coloso from './coloso.js'; import madre from './madre.js';
const ALL = { astilla, geoda, prisma, lente, cuarzo, espejo, racimo, graviton, obelisco, aurora, ariete, espiral, coloso, madre };
export const ORGANISMS = Object.fromEntries(Object.entries(ALL).filter(([, v]) => typeof v === 'function'));
