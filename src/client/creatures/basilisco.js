// EL BASILISCO (id interno «argos», jefe 3) — la serpiente-gallo que nace del huevo de un gallo viejo y mata con la MIRADA. Cabeza de
// GALLO (cresta roja enorme, barbas, pico amarillo, plumas de golilla tornasoladas) sobre un CUERPO DE SERPIENTE de escamas verde-negro
// iridiscente enroscado en el aire, alas de membrana con plumas y un penacho de cola de gallo. Los OJOS son el combate: brillan siempre.
// 'gaze' (2.5 s, AVISO de la mirada mortal) = se yergue, cresta y golilla erizadas, alas abiertas y los ojos se encienden blancos con
// halos crecientes (escondete detrás de un muro) · 'stagger' = cae flojo, cabeza colgando, ojos cerrados, alas caídas (vulnerable).
// st.sd = escudo (mientras sus ojos-centinela orbitan). NÚCLEO = el buche: bolsa de luz verde bajo la garganta.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { THREE, lod, clamp, lerp, smooth, Rig, velo, carne, hueso, pelo, brillo, setBrillo, nucleo, motas, sudario, ellipsoid, tube, spike, paint, skinRigid, skinChain, skinFn, setK, glowSprite, disposer, shieldAura, tickAura, Spring, dampTo, TAU, rng, joinUV } from './alma-kit.js';

export default function build(kit, color = 0x9dff3a) {
  const L = lod(), low = L.low, V3 = THREE.Vector3, col = new THREE.Color(color);
  const scale = carne({ vein: color, veinK: 0.16, veinGlow: 1.2, sss: 0.2, sssColor: 0x60ff80, rimColor: 0x40ffd0, rim: 0.8, tex: 'scales', tile: 6, bump: 1.4, rough: 0.35, clear: 0.9, iri: 1, lift: 0.0, color: 0x707070 });
  const comb = carne({ vein: 0xff2040, veinK: 0.4, veinGlow: 0.6, sss: 0.9, sssColor: 0xff3050, rimColor: 0xff6080, rim: 0.6, tex: 'flesh', tile: 3, rough: 0.4, clear: 0.6 });
  const beakM = hueso({ rimColor: 0xffe080, rim: 0.4 });
  const feath = velo(0x2a6a30, { alpha: 0.95, rimColor: 0xffc040, rim: 1.2, flutter: 0.05, speed: 2, hem: 0.6, hemGlow: 1.0, iri: 1, iriSpd: 0.15, weave: 0.4 });
  const wingM = velo(0x10241a, { alpha: 0.88, rimColor: color, rim: 1.4, flutter: 0.06, speed: 1.6, hem: 0.5, hemGlow: 1.2, iri: 1, iriSpd: 0.1 });
  const eyeM = brillo(0xe8ff60, 3);
  const mats = [scale, comb, beakM, feath, wingM, eyeM];
  const rig = new Rig();
  // ── columna: cuello erguido que baja a un cuerpo enroscado (1.5 vueltas) y termina en la cola ──
  const P = [[0, 1.05, 0.55], [0, 0.8, 0.5], [0, 0.55, 0.38]];
  const turns = 1.5, N = low ? 12 : 16; for (let i = 1; i <= N; i++) { const k = i / N, a = Math.PI / 2 + k * turns * TAU, r = 0.55 - 0.15 * k; P.push([Math.cos(a) * r * 1.0, 0.35 - k * 0.95 + Math.sin(k * 9) * 0.03, Math.sin(a) * r * 0.85]); }
  const root = rig.bone(null, [0, 0, 0], 'root'); const sp = []; { let par = root; const step = Math.max(1, Math.floor(P.length / 12)); const idx = []; for (let i = 0; i < P.length; i += step) idx.push(i); if (idx[idx.length - 1] !== P.length - 1) idx.push(P.length - 1);
    for (let j = idx.length - 1; j >= 0; j--) { const b = rig.bone(par, P[idx[j]], 's' + j); sp.unshift(b); par = b; } }   // de la cola a la cabeza: mover el cuello no mueve el rollo
  const head = rig.bone(sp[0], [0, 1.18, 0.62], 'head');
  const bodyG = tube(P, { rad: (t) => (t < 0.12 ? lerp(0.14, 0.2, t / 0.12) : lerp(0.24, 0.03, Math.pow((t - 0.12) / 0.88, 1.2))) * (1 + 0.04 * Math.sin(t * 80)), seg: low ? 60 : 110, sides: low ? 8 : 12, ex: [1, 0.92] });
  paint(bodyG, (p, n) => new THREE.Color(0x04100a).lerp(new THREE.Color(0x123018), smooth(-0.3, 0.6, n.y)).lerp(new THREE.Color(0x6a7a40), smooth(-0.3, -0.85, n.y) * 0.8));
  rig.add(scale, skinChain(bodyG, sp.slice().reverse(), 0.12));
  // ── cabeza de gallo ──
  const H = head.userData.rest, hp = (g) => rig.add(scale, skinRigid(g, head));
  const sk = ellipsoid([0.13, 0.13, 0.16], { w: low ? 14 : 20, h: low ? 10 : 14, noise: 0.05, seed: 4, pos: [H.x, H.y, H.z] }); paint(sk, (p) => new THREE.Color(0x0a1a10).lerp(new THREE.Color(0xa08020), 0.35 * smooth(H.y - 0.05, H.y + 0.1, p.y))); hp(sk);
  const bk = spike(0.06, 0.2, { sides: 6, seg: 3, bend: 0.4, bendDir: [0, -1, 0], pos: [H.x, H.y - 0.02, H.z + 0.12], dir: [0, -0.15, 1] }); bk.scale(1, 1, 0.75); paint(bk, 0xf0c030); rig.add(beakM, skinRigid(bk, head));
  const jaw = rig.bone(head, [H.x, H.y - 0.05, H.z + 0.1], 'jaw'); const lb = spike(0.045, 0.14, { sides: 6, seg: 2, bend: 0.2, bendDir: [0, 1, 0], pos: [H.x, H.y - 0.06, H.z + 0.11], dir: [0, -0.3, 1] }); paint(lb, 0xd8a020); rig.add(beakM, skinRigid(lb, jaw));
  const crest = rig.bone(head, [H.x, H.y + 0.12, H.z], 'crest');
  { const parts = []; for (let i = 0; i < 6; i++) { const k = i / 5, z = H.z + 0.12 - k * 0.3, h = 0.15 - Math.abs(k - 0.35) * 0.12; const g = ellipsoid([0.025, h, 0.05], { w: 8, h: 8, pos: [H.x, H.y + 0.11 + h * 0.9, z] }); paint(g, 0xd01830); parts.push(g); }
    for (const s of [-1, 1]) { const w = ellipsoid([0.03, 0.08, 0.04], { w: 8, h: 8, pos: [H.x + s * 0.03, H.y - 0.15, H.z + 0.1] }); paint(w, 0xc01028); parts.push(w); }
    rig.add(comb, skinRigid(joinUV(parts.slice(0, 6)), crest)); rig.add(comb, skinRigid(joinUV(parts.slice(6)), jaw)); }
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(1, 10, 8); e.scale(0.045, 0.045, 0.03); e.translate(H.x + s * 0.11, H.y + 0.03, H.z + 0.06); rig.add(eyeM, skinRigid(e, head)); }
  // golilla: plumas tornasol que se erizan (sudario partido alrededor del cuello)
  const ruffB = rig.bone(sp[0], [0, 1.0, 0.5], 'ruff');
  const ruff = sudario([[0, 1.1, 0.55], [0, 0.98, 0.47], [0, 0.82, 0.4]], { rad: (t) => lerp(0.15, 0.24, t), rows: 6, cols: low ? 16 : 24, tatter: 0.7, seed: 6, up: [0, 0, 1], color: 0xffc040, colorEnd: 0x30a060, kStart: 0.2 });
  rig.add(feath, skinFn(ruff, () => [[ruffB, 1]]));
  // alas: membrana con plumas, nacen del segundo hueso
  const wings = [-1, 1].map((s) => { const wb = rig.bone(sp[1], [s * 0.12, 0.75, 0.38], 'w0'), wt = rig.bone(wb, [s * 0.75, 0.95, 0.15], 'w1');
    const g = sudario([[s * 0.12, 0.75, 0.38], [s * 0.45, 0.92, 0.3], [s * 0.85, 0.98, 0.1], [s * 1.15, 0.85, -0.1]], { rad: (t) => 0.6 * Math.sin(Math.PI * (0.1 + 0.85 * t)) * (1 - t * 0.3), arc: [Math.PI * 0.5, Math.PI * 1.5], up: [0, 1, 0], rows: 12, cols: 12, tatter: 0.55, seed: 30 + s, color: 0x2a6a40, colorEnd: 0xc0a030 });
    rig.add(wingM, skinChain(g, [wb, wt], 0.2)); return { wb, wt, s }; });
  // penacho de cola de gallo
  const tail = sp[sp.length - 1], tp = tail.userData.rest;
  { const parts = []; for (let i = 0; i < (low ? 4 : 7); i++) { const a = -0.8 + i * (1.6 / ((low ? 4 : 7) - 1)); const g = sudario([tp.toArray(), [tp.x + Math.sin(a) * 0.2, tp.y + 0.25, tp.z - 0.15], [tp.x + Math.sin(a) * 0.35, tp.y + 0.35, tp.z - 0.45], [tp.x + Math.sin(a) * 0.4, tp.y + 0.15, tp.z - 0.7]], { rad: 0.035, arc: [-1.5, 1.5], up: [0, 1, 0], rows: 8, cols: 4, tatter: 0.2, seed: 50 + i, color: 0x103a20, colorEnd: 0x40e0a0 }); parts.push(g.toNonIndexed()); }
    rig.add(feath, skinRigid(mergeGeometries(parts, false), tail)); }
  // ── ensamblaje ──
  const group = rig.build(); const rootObj = new THREE.Group(); rootObj.add(group); const K = 0.95; rootObj.scale.setScalar(K); rootObj.position.y = -0.25;
  const core = nucleo(color, 0.11, { halo: 8 }); sp[1].add(core.object); core.object.position.set(0, -0.08, 0.13); mats.push(...core.mats);
  const eyeGlow = [-1, 1].map((s) => { const g = glowSprite(0xe8ff60, 0.4, 0.6); g.position.set(H.x + s * 0.11, H.y + 0.03, H.z + 0.09).sub(H); head.add(g); mats.push(g.material); return g; });
  const venom = motas(36, { color, size: 0.06, modo: 'orbit', box: [1.0, 1.4, 1.0], speed: 0.3 }); venom.position.y = 0.2; rootObj.add(venom); mats.push(venom.material);
  const gazeIn = motas(30, { color: 0xffffa0, size: 0.06, modo: 'suck', box: [1.4, 1.4, 1.4], speed: 1.0, k: 0, center: [0, 0, 0] }); head.add(gazeIn); gazeIn.position.set(0, 0.03, 0.08); mats.push(gazeIn.material);
  const aura = shieldAura(col.clone().lerp(new THREE.Color(0xffffff), 0.4), 1.5); aura.position.set(0, 0.35, 0.1); rootObj.add(aura);
  mats.push(disposer(rig, [aura.geometry, aura.material, venom.userData.geo, gazeIn.userData.geo]));
  // ── animación ──
  const sHy = new Spring(0, 20, 5), sHp = new Spring(0, 20, 5), look = new V3(0, 0, 1);
  let gK = 0, sK = 0, prevHp = 1, flinch = 0;
  return { root: rootObj, mats, tick(dt, st, t, ctx = {}) {
    dt = Math.min(dt, 0.05);
    const gaze = st.s === 'gaze', stag = st.s === 'stagger' || !!st.st, hp01 = st.hp == null ? 1 : st.hp, ph = hp01 > 0.66 ? 1 : hp01 > 0.33 ? 2 : 3; if (ctx.look) look.copy(ctx.look);
    if (st.hp != null) { if (st.hp < prevHp - 0.002) flinch = 1; prevHp = st.hp; } flinch = Math.max(0, flinch - dt * 3);
    gK = dampTo(gK, gaze ? 1 : 0, gaze ? 2.5 : 4, dt); sK = dampTo(sK, stag ? 1 : 0, stag ? 3 : 2, dt); const idle = Math.max(0, 1 - gK - sK);
    rootObj.position.y = -0.25 + Math.sin(t * 0.8) * 0.05 - sK * 0.12;
    // ondulación de serpiente por la cadena; se yergue en la mirada, se afloja aturdido
    sp.forEach((b, i) => { const w = Math.sin(t * 1.6 - i * 0.7) * 0.07 * (1 - sK * 0.7); b.rotation.y = w; b.rotation.z = Math.cos(t * 1.2 - i * 0.6) * 0.04; b.rotation.x = i < 3 ? (-gK * 0.3 + sK * 0.35) : sK * 0.04; });
    const lx = Math.atan2(look.x, Math.max(0.2, look.z)), ly = Math.asin(clamp(look.y, -1, 1));
    head.rotation.y = sHy.step(dt, clamp(lx, -0.9, 0.9) * (0.6 + 0.3 * gK) * (1 - sK)); head.rotation.x = sHp.step(dt, -clamp(ly, -0.6, 0.6) * 0.7 * (1 - sK) + sK * 0.9 - gK * 0.1);
    head.rotation.z = Math.sin(t * 2.3) * 0.08 * idle + sK * 0.3; head.scale.setScalar(1.55);   // tic de gallo
    jaw.rotation.x = 0.05 + gK * 0.35 + flinch * 0.3 + Math.max(0, Math.sin(t * 3.1)) * 0.08 * idle;
    crest.scale.set(1, 1 + gK * 0.35 - sK * 0.3, 1 + gK * 0.15); ruffB.scale.setScalar(1 + gK * 0.35); feath.userData.u.uFlut.value = 0.05 + gK * 0.08;
    wings.forEach(({ wb, wt, s }) => { wb.rotation.z = s * (0.15 * idle + 0.55 * gK - 0.6 * sK + Math.sin(t * 1.4) * 0.08 * idle); wb.rotation.y = s * (0.2 * gK); wt.rotation.z = s * (Math.sin(t * 1.4 - 0.5) * 0.1 + 0.3 * gK - 0.3 * sK); });
    // ojos: siempre encendidos; en la mirada se vuelven blancos y crecen los halos; aturdido se apagan (cerrados)
    setBrillo(eyeM, (2.5 + gK * 4) * (1 - sK * 0.9)); eyeGlow.forEach((g) => { g.material.opacity = (0.5 + gK * 0.5) * (1 - sK); g.scale.setScalar(0.35 + gK * (1.2 + 0.3 * Math.sin(t * 20))); });
    eyeM.color.lerp(new THREE.Color(1, 1, 1).multiplyScalar(4), gK * 0.6);
    gazeIn.material.uniforms.uK.value = gK * 1.3;
    scale.userData.u.uVeinGlow.value = 0.6 + 0.3 * ph + gK * 1.2 + 0.3 * Math.sin(t * 2.4);
    core.set(1.1 + gK * 0.8 + sK * 1.4 + flinch * 0.4, t, dt);
    venom.material.uniforms.uK.value = 0.5 + 0.2 * ph; venom.rotation.y = t * 0.2;
    tickAura(aura, st, t);
  } };
}
