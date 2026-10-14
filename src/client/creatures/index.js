// Registro de criaturas VIVAS. Cada archivo exporta `default function build(kit, color)` → { root, mats, tick(dt, st, t, ctx) }.
// Si un archivo exporta null se usa el modelo de cristal de respaldo (models.js).
import astilla from './anima.js'; import geoda from './almamula.js'; import prisma from './luzmala.js'; import lente from './llorona.js';
import cuarzo from './salamanquera.js'; import espejo from './pombero.js'; import racimo from './fuegofatuo.js'; import graviton from './familiar.js';
import obelisco from './viuda.js'; import aurora from './difunta.js'; import ariete from './lobizon.js'; import espiral from './silbon.js';
import coloso from './mandinga.js'; import madre from './madre-animas.js'; import argos from './basilisco.js';
const ALL = { astilla, geoda, prisma, lente, cuarzo, espejo, racimo, graviton, obelisco, aurora, ariete, espiral, coloso, madre, argos };
export const ORGANISMS = Object.fromEntries(Object.entries(ALL).filter(([, v]) => typeof v === 'function'));
