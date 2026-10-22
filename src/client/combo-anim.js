// ANIMACIÓN DE GOLPES DEL MODO COMBO (docs/HUESPEDES.md → «Golpes que se ven y se sienten»).
// El esqueleto humano de Arcanum sólo trae UN clip de ataque («punch»); acá cada golpe de combos.js tiene su propia pose procedural
// (anticipación → golpe → contacto → recuperación) sobre los huesos: torso que gira, caderas, piernas con paso/zancada y brazos con IK hacia
// un punto relativo al hombro. Es DATA-DRIVEN:
//   ANIM_GOLPE[huespedId][golpeId] = { a: arquetipo, m: espejo?, esc: escala de tiempo, av: avance visual (m), peso: fuerza del impacto, tr: estela, ... }
//   animDe(huespedId, golpeId, mv?) → descriptor (si el golpe no está en la tabla —Huéspedes nuevos— se deduce del TIPO del golpe en COMBO_SETS)
//   ANIM_HAB[huespedId] = { cast: arquetipo, go: arquetipo } para la habilidad principal (evento `hab`)
// Todo es visual: no toca la simulación (que sigue determinista). `StrikePose` (abajo) es la máquina de estados por jugador; la usa combo-fx.js.
import * as THREE from 'three';
import { ITEM_COMBO_SETS } from '../sim/items.js';
import { COMBO_SETS } from '../sim/data.js';
import { twoBoneIK, setWorldQuat } from '../arcanum/pose.js';

/* ───────── poses: un vector fijo de parámetros (se interpola campo a campo) ─────────
   rw/lw = peso de la mano (0 = la sigue el clip, 1 = IK) · ro/ru/rf = dónde va la mano respecto al HOMBRO (afuera, arriba, adelante; m para un brazo de 0,6 m)
   ty/tp/tr = torso: giro (+ = a la izquierda), inclinación al frente, inclinación al costado (+ = a la derecha) · hy = giro de cadera
   sr/sl = pierna derecha/izquierda adelante (rad; negativo = atrás) · cr = agachada · by = giro de TODO el cuerpo (rad) · hop = salto (m) · av = avance visual (× distancia útil) */
export const SLOTS = ['rw', 'ro', 'ru', 'rf', 'lw', 'lo', 'lu', 'lf', 'ty', 'tp', 'tr', 'hy', 'sr', 'sl', 'cr', 'by', 'hop', 'av'];
const IX = Object.fromEntries(SLOTS.map((k, i) => [k, i]));
export const REST = new Float32Array(SLOTS.length);
/** Construye una pose: P({ R:[afuera,arriba,adelante], L:[…], ty, tp, … }). R/L ausentes = sin IK. */
export const P = (o = {}) => { const v = new Float32Array(SLOTS.length); for (const [k, x] of Object.entries(o)) { if (k === 'R' || k === 'L') { if (!x) continue; const p = k === 'R' ? 'r' : 'l'; v[IX[p + 'w']] = x[3] == null ? 1 : x[3]; v[IX[p + 'o']] = x[0]; v[IX[p + 'u']] = x[1]; v[IX[p + 'f']] = x[2]; } else if (k in IX) v[IX[k]] = x; } return v; };
const mirrorPose = (v) => { const o = new Float32Array(v); for (const [a, b] of [['rw', 'lw'], ['ro', 'lo'], ['ru', 'lu'], ['rf', 'lf'], ['sr', 'sl']]) { o[IX[a]] = v[IX[b]]; o[IX[b]] = v[IX[a]]; } o[IX.ty] = -v[IX.ty]; o[IX.tr] = -v[IX.tr]; o[IX.hy] = -v[IX.hy]; o[IX.by] = -v[IX.by]; return o; };

/* ───────── arquetipos de golpe: tiempos en SEGUNDOS desde el evento de la sim ─────────
   ks = [[t, pose, suavizado?], …] (el primer cuadro lo pone la pose actual → los golpes se encadenan sin saltos) · hit = instante del contacto (impacto, hit-stop, sonido)
   hold = hasta cuándo se mantiene la pose del golpe · dur = cuándo vuelve al reposo · tip = qué mano deja estela ('R' | 'L' | 'RL') */
const G = (guardL = [-0.05, -0.12, 0.34]) => guardL;   // mano libre en guardia
const A = {
  tajo: { dur: 0.46, hit: 0.14, hold: 0.22, tip: 'R', ks: [
    [0.07, P({ R: [0.4, 0.4, -0.12], L: G(), ty: -0.6, tp: 0.02, tr: 0.18, hy: -0.12, sl: 0.2, sr: -0.2, cr: 0.15 }), 'o'],
    [0.14, P({ R: [-0.42, -0.28, 0.52], L: [-0.15, 0.0, 0.3], ty: 0.7, tp: 0.22, tr: -0.12, hy: 0.25, sl: 0.55, sr: -0.3, cr: 0.3, av: 0.6 }), 'i'],
    [0.22, P({ R: [-0.4, -0.3, 0.5], L: [-0.15, 0.0, 0.3], ty: 0.62, tp: 0.2, hy: 0.22, sl: 0.5, sr: -0.28, cr: 0.28, av: 0.7 })]] },
  estocada: { dur: 0.52, hit: 0.15, hold: 0.27, tip: 'R', ks: [
    [0.08, P({ R: [0.18, -0.02, -0.18], L: [-0.18, 0.12, 0.34], ty: -0.45, tp: 0.05, hy: -0.15, sr: -0.5, sl: 0.1, cr: 0.35 }), 'o'],
    [0.15, P({ R: [0.0, 0.1, 0.64], L: [-0.2, 0.0, 0.1], ty: 0.35, tp: 0.4, hy: 0.25, sl: 0.9, sr: -0.45, cr: 0.6, av: 1 }), 'i'],
    [0.27, P({ R: [0.0, 0.08, 0.62], L: [-0.2, 0.0, 0.1], ty: 0.3, tp: 0.38, hy: 0.22, sl: 0.85, sr: -0.42, cr: 0.58, av: 1 })]] },
  punio: { dur: 0.5, hit: 0.14, hold: 0.24, tip: 'R', ks: [
    [0.07, P({ R: [0.26, -0.06, -0.12], L: [-0.1, 0.18, 0.32], ty: -0.55, tp: 0.05, hy: -0.2, cr: 0.3, sr: -0.3, sl: 0.2 }), 'o'],
    [0.14, P({ R: [-0.03, 0.12, 0.66], L: [-0.14, 0.1, 0.26], ty: 0.55, tp: 0.15, hy: 0.3, cr: 0.4, sl: 0.6, sr: -0.4, av: 0.8 }), 'i'],
    [0.24, P({ R: [-0.03, 0.1, 0.64], L: [-0.14, 0.1, 0.26], ty: 0.5, tp: 0.14, hy: 0.27, cr: 0.38, sl: 0.55, sr: -0.38, av: 0.8 })]] },
  martillo: { dur: 0.78, hit: 0.26, hold: 0.4, tip: 'RL', ks: [
    [0.14, P({ R: [0.12, 0.6, -0.08], L: [0.12, 0.6, -0.08], tp: -0.4, cr: -0.1, sl: 0.25, sr: 0.25 }), 'o'],
    [0.26, P({ R: [0.04, -0.3, 0.52], L: [0.04, -0.3, 0.52], tp: 0.7, cr: 0.7, sl: 0.5, sr: 0.5, av: 0.5 }), 'i'],
    [0.4, P({ R: [0.04, -0.34, 0.48], L: [0.04, -0.34, 0.48], tp: 0.62, cr: 0.66, sl: 0.5, sr: 0.5, av: 0.5 })]] },
  zarpa: { dur: 0.4, hit: 0.11, hold: 0.18, tip: 'RL', ks: [
    [0.05, P({ R: [0.42, 0.26, 0.08], L: [0.42, 0.26, 0.08], tp: 0.2, ty: -0.2, cr: 0.35, sl: 0.3, sr: -0.2 }), 'o'],
    [0.11, P({ R: [-0.22, -0.34, 0.5], L: [-0.15, -0.3, 0.46], tp: 0.42, ty: 0.3, cr: 0.5, sl: 0.5, sr: -0.3, av: 0.7 }), 'i'],
    [0.18, P({ R: [-0.2, -0.3, 0.46], L: [-0.14, -0.26, 0.42], tp: 0.4, ty: 0.28, cr: 0.48, sl: 0.5, sr: -0.3, av: 0.7 })]] },
  giro: { dur: 0.62, hit: 0.2, hold: 0.36, tip: 'RL', spin: 1, ks: [
    [0.08, P({ R: [0.55, 0.0, -0.2], L: [0.55, 0.0, -0.2], ty: -0.5, tp: 0.1, cr: 0.4, sl: 0.2, sr: 0.2 }), 'o'],
    [0.26, P({ R: [0.62, 0.05, 0.1], L: [0.62, 0.05, 0.1], ty: 0.4, tp: 0.12, cr: 0.35, sl: 0.3, sr: 0.3, by: Math.PI * 2, av: 0.3 }), 's'],
    [0.38, P({ R: [0.6, 0.05, 0.1], L: [0.6, 0.05, 0.1], ty: 0.2, tp: 0.1, cr: 0.3, by: Math.PI * 2, av: 0.2 })]] },
  salto: { dur: 0.7, hit: 0.28, hold: 0.4, tip: 'RL', ks: [
    [0.1, P({ R: [0.34, -0.25, -0.3], L: [0.34, -0.25, -0.3], tp: 0.15, ty: -0.2, cr: 0.8, sl: 0.4, sr: 0.4 }), 'o'],
    [0.28, P({ R: [0.1, 0.18, 0.6], L: [0.1, 0.18, 0.6], tp: 0.5, ty: 0.15, cr: 0.0, hop: 0.75, sl: 1.0, sr: 0.5, av: 1 }), 'i'],
    [0.4, P({ R: [0.1, 0.05, 0.55], L: [0.1, 0.05, 0.55], tp: 0.4, cr: 0.55, hop: 0.05, sl: 0.5, sr: 0.3, av: 0.9 })]] },
  embestida: { dur: 0.6, hit: 0.15, hold: 0.3, tip: '', ks: [
    [0.08, P({ R: [0.1, -0.2, 0.2], L: [0.1, -0.2, 0.2], tp: 0.15, ty: 0.5, hy: 0.2, cr: 0.5, sl: -0.2, sr: 0.5 }), 'o'],
    [0.15, P({ R: [-0.05, -0.05, 0.45], L: [0.0, -0.1, 0.3], tp: 0.65, ty: -0.4, hy: -0.2, cr: 0.7, sl: 0.9, sr: -0.3, av: 1 }), 'i'],
    [0.3, P({ R: [-0.05, -0.05, 0.45], L: [0.0, -0.1, 0.3], tp: 0.6, ty: -0.35, hy: -0.18, cr: 0.65, sl: 0.8, sr: -0.3, av: 1 })]] },
  corte: { dur: 0.36, hit: 0.1, hold: 0.16, tip: 'R', ks: [
    [0.05, P({ R: [0.52, 0.08, 0.04], L: [-0.2, 0.0, 0.3], ty: -0.75, tp: 0.05, hy: -0.2, cr: 0.15, sr: 0.25 }), 'o'],
    [0.1, P({ R: [-0.52, -0.02, 0.48], L: [-0.1, 0.0, 0.3], ty: 0.85, tp: 0.15, hy: 0.3, cr: 0.25, sl: 0.4, sr: -0.1, av: 0.5 }), 'i'],
    [0.16, P({ R: [-0.5, -0.02, 0.46], L: [-0.1, 0.0, 0.3], ty: 0.8, tp: 0.14, hy: 0.28, cr: 0.22, sl: 0.4, av: 0.5 })]] },
  arco: { dur: 0.5, hit: 0.12, hold: 0.2, tip: '', ks: [
    [0.06, P({ R: [0.12, 0.14, 0.0], L: [-0.1, 0.12, 0.64], ty: -0.5, tp: 0.0, hy: -0.2, cr: 0.15, sr: -0.2, sl: 0.2 }), 'o'],
    [0.12, P({ R: [0.18, 0.1, 0.22], L: [-0.1, 0.12, 0.64], ty: -0.42, tp: -0.04, hy: -0.2, cr: 0.12, sr: -0.2, sl: 0.2 }), 'i'],
    [0.22, P({ R: [0.15, 0.1, 0.12], L: [-0.1, 0.12, 0.6], ty: -0.4, tp: 0.0, hy: -0.2, cr: 0.12, sr: -0.2, sl: 0.2 })]] },
  apertura: { dur: 0.62, hit: 0.15, hold: 0.3, tip: '', ks: [
    [0.08, P({ R: [-0.05, 0.22, 0.42], L: [-0.05, 0.22, 0.42], tp: 0.08, cr: 0.2 }), 'o'],
    [0.15, P({ R: [0.62, 0.3, 0.12], L: [0.62, 0.3, 0.12], tp: -0.18, ty: 0.0, cr: 0.1, hop: 0.06 }), 'i'],
    [0.3, P({ R: [0.6, 0.28, 0.1], L: [0.6, 0.28, 0.1], tp: -0.16, cr: 0.1 })]] },
  carga: { dur: 0.7, hit: 0.18, hold: 0.34, tip: '', ks: [
    [0.1, P({ R: [0.1, 0.12, -0.02], L: [-0.1, 0.1, 0.66], ty: -0.55, tp: 0.0, hy: -0.25, cr: 0.3, sr: -0.3, sl: 0.3 }), 'o'],
    [0.18, P({ R: [0.2, 0.1, 0.3], L: [-0.1, 0.1, 0.66], ty: -0.4, tp: -0.1, hy: -0.2, cr: 0.15, sr: -0.2, sl: 0.2 }), 'i'],
    [0.34, P({ R: [0.15, 0.1, 0.14], L: [-0.1, 0.1, 0.64], ty: -0.4, tp: -0.04, hy: -0.2, cr: 0.15, sr: -0.2, sl: 0.2 })]] },
  caida: { dur: 0.7, hit: 0.3, hold: 0.44, tip: 'RL', ks: [
    [0.1, P({ R: [0.18, 0.62, 0.05], L: [0.18, 0.62, 0.05], tp: -0.2, cr: 0.0, hop: 0.7, sl: 0.5, sr: 0.5 }), 'o'],
    [0.3, P({ R: [0.05, -0.34, 0.5], L: [0.05, -0.34, 0.5], tp: 0.8, cr: 0.85, hop: 0.0, sl: 0.6, sr: 0.6, av: 0.4 }), 'i'],
    [0.44, P({ R: [0.05, -0.34, 0.5], L: [0.05, -0.34, 0.5], tp: 0.7, cr: 0.8, sl: 0.6, sr: 0.6 })]] },
  // habilidad principal: preparación (se mantiene mientras dura `wind`) y liberación
  guardia: { dur: 0.5, hit: 0.2, hold: 0.3, sus: true, tip: '', ks: [
    [0.14, P({ R: [-0.28, 0.0, 0.34], L: [-0.28, 0.0, 0.34], tp: 0.18, cr: 0.35, sl: 0.3, sr: 0.2 }), 'o'], [0.3, P({ R: [-0.3, 0.02, 0.36], L: [-0.3, 0.02, 0.36], tp: 0.2, cr: 0.4, sl: 0.3, sr: 0.2 })]] },
  alzar: { dur: 0.5, hit: 0.2, hold: 0.3, sus: true, tip: '', ks: [
    [0.16, P({ R: [0.24, 0.62, 0.05], L: [0.24, 0.62, 0.05], tp: -0.22, cr: 0.0, hop: 0.05 }), 'o'], [0.34, P({ R: [0.26, 0.64, 0.08], L: [0.26, 0.64, 0.08], tp: -0.26, hop: 0.07 })]] },
  agacho: { dur: 0.5, hit: 0.2, hold: 0.3, sus: true, tip: '', ks: [
    [0.14, P({ R: [0.3, -0.3, -0.25], L: [0.3, -0.3, -0.25], tp: 0.4, ty: -0.2, cr: 0.8, sl: 0.5, sr: -0.4 }), 'o'], [0.3, P({ R: [0.32, -0.3, -0.28], L: [0.32, -0.3, -0.28], tp: 0.45, ty: -0.25, cr: 0.85, sl: 0.5, sr: -0.4 })]] },
  suelo: { dur: 0.5, hit: 0.2, hold: 0.3, sus: true, tip: '', ks: [
    [0.14, P({ R: [0.1, -0.5, 0.35], L: [0.1, -0.5, 0.35], tp: 0.5, cr: 0.8, sl: 0.4, sr: 0.4 }), 'o'], [0.3, P({ R: [0.1, -0.56, 0.38], L: [0.1, -0.56, 0.38], tp: 0.56, cr: 0.85, sl: 0.4, sr: 0.4 })]] },
  estallar: { dur: 0.5, hit: 0.06, hold: 0.2, tip: '', ks: [
    [0.06, P({ R: [0.62, 0.3, 0.15], L: [0.62, 0.3, 0.15], tp: -0.2, cr: 0.0, hop: 0.12 }), 'i'], [0.2, P({ R: [0.58, 0.26, 0.12], L: [0.58, 0.26, 0.12], tp: -0.16, hop: 0.05 })]] },
  sello: { dur: 0.5, hit: 0.06, hold: 0.2, tip: '', ks: [
    [0.06, P({ R: [0.0, 0.1, 0.6], L: [0.0, 0.1, 0.6], tp: 0.3, cr: 0.5, sl: 0.5, sr: 0.2, av: 0.4 }), 'i'], [0.2, P({ R: [0.0, 0.08, 0.58], L: [0.0, 0.08, 0.58], tp: 0.28, cr: 0.5, sl: 0.5, sr: 0.2, av: 0.4 })]] },
};
export const ARQUETIPOS = Object.keys(A);

/* ───────── descriptores por golpe ───────── */
const D = (a, o = {}) => ({ a, m: false, esc: 1, av: 0, peso: 1, hs: 3, ...o });
/** Tabla por Huésped y golpe (los ids son los de COMBO_SETS en data.js; tests/combo-anim.test.js falla si falta alguno de los 5 Huéspedes originales).
 *  m = espejo (golpea con la mano/lado izquierdo) · av = metros de avance visual · peso = fuerza del impacto (1 normal, 1,5 pesado, 2,4 remate) · hs = cuadros de hit-stop
 *  esc = escala de tiempo (>1 = más lento) · trk = largo de la estela (m; 0 = sin estela) · fp = golpe del viewmodel de 1.ª persona que se reutiliza. */
export const ANIM_GOLPE = {
  axioma: {   // armadura: cortes anchos de coraza, hombro y martillazos de plomada
    tajo: D('tajo', { av: 1.1, trk: 0.8, fp: 'SLASH' }),
    contratajo: D('tajo', { m: true, av: 1.2, peso: 1.15, trk: 0.85, fp: 'SLASH_L' }),
    onda_coraza: D('estocada', { esc: 1.25, av: 1.6, peso: 1.9, hs: 5, trk: 1.3, fp: 'THRUST' }),
    punio: D('punio', { av: 1.1, peso: 1.5, hs: 4, trk: 0.5, fp: 'HOOK' }),
    hombro: D('embestida', { av: 2.2, peso: 1.6, hs: 4, fp: 'THRUST' }),
    martillazo: D('martillo', { av: 0.9, peso: 2.0, hs: 5, trk: 1.0, fp: 'SLAM' }),
    tormenta: D('giro', { av: 0.6, peso: 1.3, hs: 3, trk: 1.3, fp: 'SWEEP' }),
    ruptura: D('martillo', { esc: 1.2, av: 1.2, peso: 2.6, hs: 6, trk: 1.4, fp: 'SLAM' }),
  },
  vesper: {   // zarpazos rápidos y saltos
    zarpa: D('zarpa', { esc: 0.9, av: 0.9, peso: 0.8, hs: 2, trk: 0.5, fp: 'RAKE' }),
    rafaga: D('zarpa', { m: true, esc: 0.85, av: 1.1, peso: 0.85, hs: 2, trk: 0.5, fp: 'RAKE' }),
    desgarro: D('zarpa', { esc: 1.0, av: 1.6, peso: 1.1, hs: 3, trk: 0.7, fp: 'RAKE' }),
    salto: D('salto', { av: 2.4, peso: 1.5, hs: 4, trk: 0.6, fp: 'SLAM' }),
    embestida: D('embestida', { av: 2.6, peso: 1.7, hs: 4, trk: 0.6, fp: 'RAKE' }),
    torbellino: D('giro', { esc: 0.9, av: 0.5, peso: 1.2, hs: 3, trk: 0.6, fp: 'SWEEP' }),
    infinita: D('zarpa', { esc: 0.75, av: 1.2, peso: 0.9, hs: 2, trk: 0.6, fp: 'RAKE' }),
    ejecucion: D('salto', { esc: 1.1, av: 3.0, peso: 2.6, hs: 6, trk: 0.9, fp: 'SLAM' }),
  },
  micelio: {  // puños pesados que sacuden el suelo
    golpe: D('punio', { esc: 1.15, av: 0.7, peso: 1.2, hs: 3, trk: 0.0, fp: 'HOOK' }),
    doble: D('punio', { m: true, esc: 1.15, av: 0.8, peso: 1.3, hs: 4, trk: 0.0, fp: 'HOOK_L' }),
    raices: D('martillo', { esc: 1.1, av: 0.6, peso: 1.7, hs: 5, trk: 0.0, fp: 'SLAM' }),
    aplasta: D('martillo', { esc: 1.2, av: 0.7, peso: 1.9, hs: 5, trk: 0.0, fp: 'SLAM' }),
    brote: D('giro', { esc: 1.2, av: 0.3, peso: 1.4, hs: 4, trk: 0.0, fp: 'SLAM' }),
    muro: D('martillo', { esc: 1.25, av: 0.7, peso: 2.0, hs: 5, trk: 0.0, fp: 'SLAM' }),
    terremoto: D('caida', { esc: 1.25, av: 0.4, peso: 2.4, hs: 6, trk: 0.0, fp: 'SLAM' }),
    floracion: D('caida', { esc: 1.35, av: 0.4, peso: 2.8, hs: 6, trk: 0.0, fp: 'SLAM' }),
  },
  umbra: {    // cortes dimensionales con paso corto y teletransporte
    corte: D('corte', { av: 0.7, peso: 1.0, trk: 1.1, fp: 'SLASH' }),
    doble_corte: D('corte', { m: true, av: 1.0, peso: 1.1, trk: 1.2, fp: 'SLASH_L' }),
    cruce: D('corte', { esc: 1.1, av: 1.0, peso: 1.5, hs: 4, trk: 1.8, fp: 'SWEEP' }),
    vacio: D('estocada', { esc: 1.1, av: 0.9, peso: 1.5, hs: 4, trk: 1.6, fp: 'THRUST' }),
    paso_cortante: D('corte', { esc: 1.1, av: 1.0, peso: 1.5, hs: 4, trk: 1.8, fp: 'SWEEP' }),
    desgarro_dim: D('giro', { esc: 1.0, av: 0.4, peso: 1.5, hs: 4, trk: 1.6, fp: 'SWEEP' }),
    eco: D('corte', { m: true, esc: 0.9, av: -0.5, peso: 1.2, hs: 3, trk: 1.4, fp: 'SLASH_L' }),
    eclipse_cuchillas: D('corte', { esc: 1.3, av: 1.2, peso: 2.4, hs: 6, trk: 2.2, fp: 'SWEEP' }),
  },
  seraf: {    // arco de luz: tiran, sueltan y abren los brazos
    flecha: D('arco', { av: 0, peso: 0.9, hs: 1, fp: 'CRACK' }),
    doble_flecha: D('arco', { m: false, esc: 0.95, av: 0, peso: 1.0, hs: 1, fp: 'CRACK' }),
    salva: D('apertura', { esc: 0.95, av: 0, peso: 1.2, hs: 2, fp: 'SWEEP' }),
    cargada: D('carga', { av: 0, peso: 1.6, hs: 3, fp: 'CRACK' }),
    rematadora: D('carga', { esc: 0.9, av: 0, peso: 1.8, hs: 4, fp: 'CRACK' }),
    sanadora: D('apertura', { esc: 1.1, av: 0, peso: 1.3, hs: 2, fp: 'SWEEP' }),
    doble_tension: D('carga', { esc: 1.0, av: 0, peso: 1.7, hs: 3, fp: 'CRACK' }),
    lluvia: D('apertura', { esc: 1.3, av: 0, peso: 2.5, hs: 5, fp: 'SWEEP' }),
  },
};
/** Habilidad principal: preparación (`hab` ph 'cast', dura `dur`) y liberación (ph 'go'). */
export const ANIM_HAB = {
  axioma: { cast: 'guardia', go: 'sello' }, vesper: { cast: 'agacho', go: 'salto' }, micelio: { cast: 'suelo', go: 'estallar' },
  umbra: { cast: 'alzar', go: 'estallar' }, seraf: { cast: 'alzar', go: 'estallar' },
};
/** MELÉ DEL MODO SHOOTER (botón MELEE / melé automático): eventos `melee` con kind light | heavy | air | exec | lunge | spin y `cmb` (1..3 = lugar en la cadena de ligeros).
 *  ANIM_MELEE[huésped] = { light: [golpe 1, golpe 2, golpe 3 (remate)], heavy, air, exec, lunge, spin } → descriptores como los de ANIM_GOLPE. Los ligeros ALTERNAN lado
 *  (tajo derecho → contratajo izquierdo → remate más grande) para que se vea una cadena. Huésped sin entrada: `MELEE_BASE` (mismo esquema, genérico). */
export const MELEE_KINDS = ['light', 'heavy', 'air', 'exec', 'lunge', 'spin'];
const MELEE_BASE = {
  light: [D('tajo', { av: 1.0, trk: 0.8, fp: 'SLASH' }), D('tajo', { m: true, av: 1.1, peso: 1.1, trk: 0.85, fp: 'SLASH_L' }), D('estocada', { esc: 1.1, av: 1.4, peso: 1.6, hs: 4, trk: 1.1, fp: 'THRUST' })],
  heavy: D('martillo', { esc: 1.05, av: 0.9, peso: 1.8, hs: 5, trk: 1.0, fp: 'SLAM' }), air: D('caida', { av: 0.4, peso: 1.8, hs: 5, trk: 0.8, fp: 'SLAM' }),
  exec: D('martillo', { esc: 1.2, av: 1.0, peso: 2.6, hs: 6, trk: 1.4, fp: 'SLAM' }), lunge: D('estocada', { av: 2.4, peso: 1.5, hs: 4, trk: 1.0, fp: 'THRUST' }), spin: D('giro', { av: 0.4, peso: 1.5, hs: 4, trk: 1.2, fp: 'SWEEP' }),
};
export const ANIM_MELEE = {
  axioma: { light: [D('tajo', { av: 1.1, trk: 0.8, fp: 'SLASH' }), D('tajo', { m: true, av: 1.2, peso: 1.15, trk: 0.85, fp: 'SLASH_L' }), D('estocada', { esc: 1.2, av: 1.6, peso: 1.7, hs: 5, trk: 1.3, fp: 'THRUST' })],
    heavy: D('martillo', { av: 0.9, peso: 2.0, hs: 5, trk: 1.0, fp: 'SLAM' }), air: D('caida', { av: 0.4, peso: 1.9, hs: 5, trk: 0.9, fp: 'SLAM' }), exec: D('martillo', { esc: 1.2, av: 1.2, peso: 2.6, hs: 6, trk: 1.4, fp: 'SLAM' }),
    lunge: D('embestida', { av: 2.4, peso: 1.6, hs: 4, fp: 'THRUST' }), spin: D('giro', { av: 0.6, peso: 1.4, hs: 4, trk: 1.3, fp: 'SWEEP' }) },
  vesper: { light: [D('zarpa', { esc: 0.9, av: 0.9, peso: 0.8, hs: 2, trk: 0.5, fp: 'RAKE' }), D('zarpa', { m: true, esc: 0.85, av: 1.1, peso: 0.9, hs: 2, trk: 0.5, fp: 'RAKE' }), D('zarpa', { esc: 1.0, av: 1.6, peso: 1.4, hs: 4, trk: 0.8, fp: 'RAKE' })],
    heavy: D('salto', { av: 2.2, peso: 1.6, hs: 4, trk: 0.6, fp: 'SLAM' }), air: D('caida', { av: 0.4, peso: 1.8, hs: 5, trk: 0.8, fp: 'SLAM' }), exec: D('salto', { esc: 1.1, av: 3, peso: 2.6, hs: 6, trk: 0.9, fp: 'SLAM' }),
    lunge: D('embestida', { av: 2.6, peso: 1.6, hs: 4, trk: 0.6, fp: 'RAKE' }), spin: D('giro', { esc: 0.9, av: 0.5, peso: 1.3, hs: 3, trk: 0.7, fp: 'SWEEP' }) },
  micelio: { light: [D('punio', { esc: 1.15, av: 0.7, peso: 1.2, hs: 3, fp: 'HOOK' }), D('punio', { m: true, esc: 1.15, av: 0.8, peso: 1.3, hs: 4, fp: 'HOOK_L' }), D('martillo', { esc: 1.15, av: 0.7, peso: 1.9, hs: 5, fp: 'SLAM' })],
    heavy: D('martillo', { esc: 1.2, av: 0.7, peso: 2.0, hs: 5, fp: 'SLAM' }), air: D('caida', { esc: 1.25, av: 0.4, peso: 2.2, hs: 6, fp: 'SLAM' }), exec: D('caida', { esc: 1.3, av: 0.5, peso: 2.8, hs: 6, fp: 'SLAM' }),
    lunge: D('embestida', { esc: 1.1, av: 1.8, peso: 1.7, hs: 4, fp: 'HOOK' }), spin: D('giro', { esc: 1.2, av: 0.3, peso: 1.5, hs: 4, fp: 'SLAM' }) },
  umbra: { light: [D('corte', { av: 0.7, trk: 1.1, fp: 'SLASH' }), D('corte', { m: true, av: 1.0, peso: 1.1, trk: 1.2, fp: 'SLASH_L' }), D('estocada', { av: 1.1, peso: 1.6, hs: 4, trk: 1.7, fp: 'THRUST' })],
    heavy: D('corte', { esc: 1.2, av: 1.0, peso: 1.7, hs: 4, trk: 1.8, fp: 'SWEEP' }), air: D('caida', { av: 0.4, peso: 1.8, hs: 5, trk: 1.0, fp: 'SLAM' }), exec: D('corte', { esc: 1.3, av: 1.2, peso: 2.6, hs: 6, trk: 2.2, fp: 'SWEEP' }),
    lunge: D('corte', { esc: 1.1, av: 2.2, peso: 1.5, hs: 4, trk: 1.8, fp: 'THRUST' }), spin: D('giro', { av: 0.4, peso: 1.5, hs: 4, trk: 1.6, fp: 'SWEEP' }) },
  seraf: { light: [D('corte', { esc: 1.05, av: 0.6, peso: 0.9, hs: 2, trk: 1.2, fp: 'SWEEP' }), D('corte', { m: true, esc: 1.05, av: 0.7, peso: 1.0, hs: 2, trk: 1.2, fp: 'SWEEP' }), D('apertura', { esc: 1.0, av: 0.2, peso: 1.6, hs: 4, fp: 'CRACK' })],
    heavy: D('apertura', { esc: 1.15, av: 0.3, peso: 1.8, hs: 5, trk: 1.4, fp: 'CRACK' }), air: D('caida', { av: 0.4, peso: 1.8, hs: 5, trk: 0.8, fp: 'SLAM' }), exec: D('apertura', { esc: 1.3, av: 0.3, peso: 2.6, hs: 6, trk: 1.6, fp: 'CRACK' }),
    lunge: D('estocada', { av: 2.0, peso: 1.5, hs: 4, trk: 1.2, fp: 'THRUST' }), spin: D('giro', { esc: 1.0, av: 0.3, peso: 1.4, hs: 4, trk: 1.3, fp: 'SWEEP' }) },
};
/** Descriptor del melé de Shooter: por Huésped y kind (Huéspedes nuevos → MELEE_BASE). `cmb` = lugar en la cadena de ligeros (1..3); el 3.º es el remate (más peso). */
export function animMelee(char, kind, { cmb = 1 } = {}) {
  const T = ANIM_MELEE[char] || MELEE_BASE, k = MELEE_KINDS.includes(kind) ? kind : 'light';
  let d = k === 'light' ? T.light[clamp3(cmb) - 1] || MELEE_BASE.light[0] : T[k] || MELEE_BASE[k];
  d = { ...d, id: 'melee_' + k + (k === 'light' ? clamp3(cmb) : ''), char, propio: !!ANIM_MELEE[char], melee: true };
  if (k === 'exec') { d.fin = true; d.peso = Math.max(d.peso, 2.2); }
  return d;
}
const clamp3 = (n) => Math.max(1, Math.min(3, n | 0 || 1));
/** Golpe «Caída» (en el aire, mirando abajo): un solo descriptor para todos. */
export const ANIM_PLUNGE = D('caida', { av: 0.4, peso: 1.8, hs: 5, trk: 0.8, fp: 'SLAM' });
// SINGULAR: ganchos que ARRASTRAN hacia adentro, giros que tiran de todo y mazazos de plomada
ANIM_GOLPE.singular = {
  roce: D('tajo', { av: 0.9, peso: 1.0, trk: 0.8, fp: 'HOOK' }),
  arrastre: D('giro', { m: true, esc: 1.05, av: 0.3, peso: 1.2, hs: 3, trk: 1.0, fp: 'HOOK_L' }),
  compresion: D('martillo', { esc: 1.1, av: 0.6, peso: 1.7, hs: 5, trk: 0.8, fp: 'SLAM' }),
  cuasar: D('punio', { esc: 1.15, av: 0.8, peso: 1.6, hs: 4, trk: 0.6, fp: 'HOOK' }),
  doble_polo: D('giro', { esc: 1.1, av: 0.3, peso: 1.5, hs: 4, trk: 1.1, fp: 'SWEEP' }),
  meteoros: D('caida', { esc: 1.1, av: 0.4, peso: 2.0, hs: 5, trk: 1.0, fp: 'SLAM' }),
  acrecion: D('giro', { esc: 1.2, av: 0.2, peso: 2.0, hs: 5, trk: 1.3, fp: 'SWEEP' }),
  colapso_estelar: D('caida', { esc: 1.3, av: 0.4, peso: 2.8, hs: 6, trk: 1.4, fp: 'SLAM' }),
};
ANIM_HAB.singular = { cast: 'suelo', go: 'estallar' };
// COLMENA: picotazos rápidos (estocadas cortas), barrido de alas, giros del enjambre y el remate de la Reina; la habilidad alza los brazos para llamar
ANIM_GOLPE.colmena = {
  picotazo: D('estocada', { esc: 0.8, av: 0.7, peso: 0.9, hs: 2, trk: 0.5, fp: 'THRUST' }),
  doble_aguijon: D('estocada', { m: true, esc: 0.8, av: 0.8, peso: 1.0, hs: 2, trk: 0.6, fp: 'THRUST' }),
  aguijonada: D('estocada', { esc: 1.1, av: 1.2, peso: 1.7, hs: 5, trk: 1.0, fp: 'THRUST' }),
  barrido_alas: D('giro', { esc: 0.9, av: 0.2, peso: 1.3, hs: 3, trk: 1.2, fp: 'SWEEP' }),
  brote_crias: D('apertura', { esc: 0.9, av: 0, peso: 1.1, hs: 2, trk: 0, fp: 'SWEEP' }),
  torbellino_alas: D('giro', { esc: 1.1, av: 0.3, peso: 1.5, hs: 4, trk: 1.3, fp: 'SWEEP' }),
  lluvia_aguijones: D('zarpa', { m: true, esc: 0.85, av: 0.4, peso: 1.2, hs: 3, trk: 0.7, fp: 'RAKE' }),
  llamado_reina: D('caida', { esc: 1.25, av: 0.4, peso: 2.4, hs: 6, trk: 1.2, fp: 'SLAM' }),
  // golpes que añade el árbol de combos (progresion.js)
  enjambre_cerrado: D('giro', { esc: 1.1, av: 0.3, peso: 1.5, hs: 4, trk: 1.2, fp: 'SWEEP' }),
  colmena_total: D('caida', { esc: 1.3, av: 0.4, peso: 2.6, hs: 6, trk: 1.4, fp: 'SLAM' }),
};
ANIM_HAB.colmena = { cast: 'alzar', go: 'estallar' };
/** Respaldo cuando un Huésped (o un golpe) no está en la tabla: se deduce del TIPO del golpe de COMBO_SETS (kind, dash, blink, ranged…). */
export function deducir(mv = {}, n = 1) {
  const par = n % 2 === 0;
  if (mv.ranged) return D(mv.charge || mv.w === 'h' ? 'carga' : (mv.hits || 1) >= 3 ? 'apertura' : 'arco', { av: 0, peso: mv.w === 'h' ? 1.6 : 1, hs: 2, fp: 'CRACK' });
  if (mv.kind === 'spin' || mv.arc >= 2 && mv.kind !== 'air') return D('giro', { av: 0.4, peso: 1.4, hs: 3, trk: 1.1, fp: 'SWEEP' });
  if (mv.blink || mv.line) return D('corte', { m: par, av: 1.0, peso: 1.3, hs: 3, trk: 1.5, fp: 'SWEEP' });
  if (mv.kind === 'lunge') return D(mv.jump ? 'salto' : (mv.dash || 0) >= 12 ? 'embestida' : 'estocada', { av: Math.min(3, (mv.dash || 6) / 6), peso: 1.5, hs: 4, trk: 0.8, fp: 'THRUST' });
  if (mv.kind === 'air') return D('martillo', { esc: 1.2, av: 0.8, peso: 2.0, hs: 5, trk: 1.1, fp: 'SLAM' });
  if (mv.kind === 'heavy' || mv.w === 'h') return D(par ? 'punio' : 'martillo', { esc: 1.1, av: 1.0, peso: 1.6, hs: 4, trk: 0.9, fp: 'SLAM' });
  return D('tajo', { m: par, av: 1.0, peso: 1.0 + 0.08 * (mv.hits || 1), hs: 3, trk: 0.8, fp: par ? 'SLASH_L' : 'SLASH' });
}
const moveOf = (char, id) => (COMBO_SETS[char] || []).find((m) => m.id === id) || Object.values(ITEM_COMBO_SETS).flat().find((m) => m.id === id) || null;
/** Descriptor de un golpe: la tabla del Huésped y, si falta, el respaldo por tipo. `fin` = remate de la cadena (más peso y hit-stop). */
export function animDe(char, id, { fin = false, n = 1, mv = null } = {}) {
  const base = (ANIM_GOLPE[char] && ANIM_GOLPE[char][id]) || (id === 'plunge' ? ANIM_PLUNGE : deducir(mv || moveOf(char, id) || {}, n));
  const d = { ...base, id, char, propio: !!(ANIM_GOLPE[char] && ANIM_GOLPE[char][id]) };
  if (fin) { d.peso = Math.max(d.peso * 1.35, 1.9); d.hs = Math.min(7, d.hs + 2); d.fin = true; }
  return d;
}
export function animHab(char, fase) { const h = ANIM_HAB[char] || ANIM_HAB.axioma; return { a: h[fase === 'cast' ? 'cast' : 'go'], m: false, esc: 1, av: 0, peso: fase === 'go' ? 1.6 : 0.5, hs: 0, hab: true }; }
/** ¿Qué golpes de COMBO_SETS no tienen entrada propia en la tabla? (lo usa el test) */
export function golpesSinAnim(char) { return (COMBO_SETS[char] || []).map((m) => m.id).filter((id) => !(ANIM_GOLPE[char] && ANIM_GOLPE[char][id])); }

/* ───────── máquina de estados por jugador ───────── */
const ease = (k, u) => (k === 'o' ? 1 - (1 - u) * (1 - u) : k === 'i' ? u * u * (2 - u) * 0.5 + u * u * 0.5 : u * u * (3 - 2 * u));
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _hint = new THREE.Vector3(), _s = new THREE.Vector3();
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

export class StrikePose {
  constructor() {
    this.cur = new Float32Array(SLOTS.length);       // pose actual (ya interpolada)
    this.from = new Float32Array(SLOTS.length);
    this.arq = null; this.t = 99; this.desc = null; this.scale = 1; this.mir = false;
    this.hit = false; this.hitT = 0; this.reach = 1; this.sus = false;
    this.w = 0; this.armLen = 0.6; this.bones = null; this.group = null;
    this.off = { fwd: 0, up: 0, lat: 0, yaw: 0 }; this.prevOff = 0; this.vis = 0; this.contactCb = null; this.done = true;
  }
  /** Arranca un golpe (o una pose de habilidad). `reach` = fracción (0..1) del avance visual que hay que hacer (según la distancia al objetivo). */
  trigger(desc, { reach = 1, speed = 1 } = {}) {
    const a = A[desc.a] || A.tajo; this.desc = desc; this.arq = a; this.t = 0; this.scale = (desc.esc || 1) / speed; this.mir = !!desc.m; this.hit = false; this.done = false; this.sus = !!(desc.hab && a.sus); this.reach = reach;
    if (!a.km) { a.km = a.ks.map((k) => [k[0], mirrorPose(k[1]), k[2]]); }   // teclas espejadas (una vez)
    this.from.set(this.cur);
    this.from[IX.by] = ((this.from[IX.by] + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;   // el giro empieza desde la representación más cercana a 0
    this.cur[IX.by] = this.from[IX.by];
  }
  /** Soltar una pose sostenida (preparación de habilidad) y volver al reposo. */
  release() { if (this.arq && this.sus) { this.sus = false; this.t = Math.max(this.t, this.arq.hold * this.scale); } }
  get time() { return this.t / this.scale; }
  /** Avanza `dt` s. Devuelve true en el cuadro en que ocurre el contacto. */
  step(dt) {
    if (this.done || !this.arq) { this.w = 0; return false; }
    this.t += dt; const a = this.arq, s = this.scale, tt = this.t / s;
    let contact = false;
    if (!this.hit && tt >= a.hit) { this.hit = true; contact = true; }
    const ks = this.mir ? a.km : a.ks, out = this.cur;
    let prev = this.from, t0 = 0, found = false;
    for (let i = 0; i < ks.length && !found; i++) {
      const k = ks[i];
      if (tt < k[0]) { const u = (tt - t0) / Math.max(1e-4, k[0] - t0), e = ease(k[2] || 's', Math.min(1, Math.max(0, u))), kv = k[1]; for (let j = 0; j < out.length; j++) out[j] = prev[j] + (kv[j] - prev[j]) * e; found = true; }
      else { prev = k[1]; t0 = k[0]; }
    }
    if (!found) {
      if (this.sus || tt < a.hold) out.set(prev);   // se sostiene la pose del golpe (o de la preparación de la habilidad)
      else { const h0 = Math.max(a.hold, t0), u = Math.min(1, (tt - h0) / Math.max(1e-4, a.dur - h0)), e = ease('s', u); for (let j = 0; j < out.length; j++) out[j] = j === IX.by ? prev[j] : prev[j] * (1 - e); if (u >= 1) { this.done = true; out.fill(0); } }
    }
    // peso general: 1 durante el golpe; cae a 0 al final del reposo (los brazos devuelven el mando al clip)
    this.w = this.done ? 0 : 1;
    // desplazamiento visual del cuerpo (se aplica en huesped-cuerpo.js): avance hacia el objetivo, salto y giro total
    const av = out[IX.av] * (this.desc.av || 0) * this.reach, hop = out[IX.hop];
    this.off.fwd = av; this.off.up = hop; this.off.yaw = out[IX.by];
    this.vis = Math.abs(av - this.prevOff) / Math.max(dt, 1e-4); this.prevOff = av;
    return contact;
  }
  /** Se llama desde el overlay del humano (después del mezclador): doblar torso, caderas, piernas y llevar las manos con IK. */
  apply(bones, group) {
    if (this.w < 0.01 || !bones || !bones.spine04_h) return; this.bones = bones; this.group = group;
    const c = this.cur; group.updateWorldMatrix(true, false); group.getWorldQuaternion(_qc);
    const rot = (bone, ax, ang) => { if (!bone || Math.abs(ang) < 1e-4) return; bone.getWorldQuaternion(_q); _q2.setFromAxisAngle(_v.copy(ax).applyQuaternion(_qc), ang); _q.premultiply(_q2); setWorldQuat(bone, _q); };
    // cuerpo: agachada (cadera baja, rodillas dobladas)
    const cr = c[IX.cr];
    if (bones.root && cr) bones.root.position.y -= 0.15 * cr;   // la cadera baja con las rodillas
    // torso: giro / inclinación repartidos por la columna; cadera (spine05) sólo gira
    const ty = c[IX.ty], tp = c[IX.tp], tr = c[IX.tr], hy = c[IX.hy];
    rot(bones.spine05_h, AX.y, hy);
    for (const [n, k] of [['spine04_h', 0.3], ['spine02_h', 0.35], ['spine01_h', 0.35]]) { const b = bones[n]; rot(b, AX.y, ty * k); rot(b, AX.x, tp * k * 0.9); rot(b, AX.z, tr * k); }
    rot(bones.neck01_h, AX.x, -tp * 0.35); rot(bones.head_h, AX.y, -(ty + hy) * 0.5); rot(bones.head_h, AX.x, -tp * 0.25);
    // piernas: zancada (adelante = giro negativo sobre X) y rodillas dobladas
    const flex = cr * 0.62, sR = c[IX.sr], sL = c[IX.sl];
    for (const [side, st] of [['R', sR], ['L', sL]]) {
      const up = bones[`upperleg01_${side}_h`], lo = bones[`lowerleg01_${side}_h`]; if (!up || !lo) continue;
      rot(up, AX.x, -(st * 0.7 + flex)); rot(lo, AX.x, st > 0 ? st * 0.9 + flex * 1.6 : -st * 0.25 + flex * 1.6);
    }
    // brazos: IK hacia un punto relativo a cada hombro, expresado en el marco del torso
    _e.set(tp * 0.9, (hy + ty) * 0.9, -tr * 0.9, 'YXZ'); _qt.setFromEuler(_e); _qt.premultiply(_qc);
    group.updateWorldMatrix(true, true);
    const sc = this.armLen / 0.6;
    for (const side of ['R', 'L']) {
      const w = c[IX[side === 'R' ? 'rw' : 'lw']]; if (w < 0.01) continue;
      const k = side === 'R' ? 'r' : 'l', ua = bones[`upperarm01_${side}_h`], la = bones[`lowerarm01_${side}_h`], wr = bones[`wrist_${side}_h`]; if (!ua || !la || !wr) continue;
      const o = c[IX[k + 'o']], u = c[IX[k + 'u']], f = c[IX[k + 'f']], sx = side === 'R' ? -1 : 1;   // en el marco del personaje +X = su izquierda
      ua.getWorldPosition(_s); _v2.set(sx * o * sc, u * sc, f * sc).applyQuaternion(_qt); _v3.copy(_s).add(_v2);
      _hint.set(sx * 0.6, -0.8, -0.2).applyQuaternion(_qt);
      twoBoneIK(ua, la, wr, _v3, _hint, Math.min(1, w));
    }
  }
  /** Punta del arma/garra de una mano en el mundo (para la estela): muñeca + dirección del antebrazo × largo. */
  tip(side, len, out) {
    const b = this.bones; if (!b) return null; const wr = b[`wrist_${side}_h`], la = b[`lowerarm01_${side}_h`]; if (!wr || !la) return null;
    wr.getWorldPosition(out); la.getWorldPosition(_v); _v.subVectors(out, _v).normalize(); return out.addScaledVector(_v, len);
  }
  /** Mide el largo del brazo (hombro→codo→muñeca, en el mundo) una vez. */
  measure(bones) { const ua = bones.upperarm01_R_h, la = bones.lowerarm01_R_h, wr = bones.wrist_R_h; if (!ua || !la || !wr) return; ua.getWorldPosition(_v); la.getWorldPosition(_v2); wr.getWorldPosition(_v3); this.armLen = _v.distanceTo(_v2) + _v2.distanceTo(_v3) || 0.6; }
}
