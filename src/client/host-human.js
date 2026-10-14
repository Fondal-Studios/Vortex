// HUÉSPED CON CUERPO HUMANO REAL «intervenido» (docs/CONCEPTO_ARTE.md · realismo espiritual): la persona con esqueleto y clips de
// ARCANUM (humans.js, CC0 MakeHuman + Quaternius) + máscara ritual (porcelana, obsidiana, hueso u oro según el Huésped), filigrana
// dorada en cuello y brazos, un NÚCLEO de luz en el pecho que late con el mundo (uBeat) y mutaciones FÍSICAS por nivel de evolución:
//   1 hombreras de porcelana con canto de oro · 2 cresta de cristal vivo por la espalda y esquirlas en los antebrazos ·
//   3 alas de luz (plumas aditivas que respiran) · 4 aureola dorada, corona de púas y alas más grandes.
// Los órganos del campeón (`cg`, organs-vis.js) cuelgan del pecho y de la cabeza. Misma interfaz que host-body.js
// ({ object, event, update, dispose, human:true }) para que render.js los intercambie cuando el kit humano termina de cargar.
// Presupuesto: ≈ 14–22 llamadas de dibujo extra sobre la persona (Media/Alta). En Baja se sigue usando host-body.js.
import { goldMaterial, porcelainMaterial } from './ph.js';
import { attachChampOrgans } from './organs-vis.js';
import { uBeat } from './shaders.js';

const LOOK = { // máscara, color de esencia del núcleo y de las piezas de luz
  axioma: { mask: 'porcelana', glow: 0x3aa8ff, preset: 'jugador1' },
  vesper: { mask: 'obsidiana', glow: 0xb04bff, preset: 'jugador4' },
  micelio: { mask: 'hueso', glow: 0x7be03a, preset: 'jugador2' },
  umbra: { mask: 'obsidiana', glow: 0xb98cff, preset: 'jugador2' },
  seraf: { mask: 'oro', glow: 0xffd45a, preset: 'jugador3' },
};

export function createHostHuman(T, hm, kit, p, opts = {}) {
  const L = LOOK[p.char] || LOOK.axioma, camera = opts.camera || null;
  const human = hm.createHuman(kit, { char: p.char, name: p.name, color: L.glow });
  const object = new T.Group(); object.name = 'huesped-humano-' + p.char; object.add(human.object);
  const mats = [], geos = [], track = (m) => { mats.push(m); return m; }, G = (g) => { geos.push(g); return g; };
  const gold = track(goldMaterial()), porc = track(porcelainMaterial());
  const maskMat = L.mask === 'oro' ? gold : L.mask === 'porcelana' ? porc : L.mask === 'hueso' ? track(porcelainMaterial({ color: 0xdccfb0, roughness: 0.8, clearcoat: 0.1 })) : track(porcelainMaterial({ color: 0x15121c, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
  const glowC = new T.Color(L.glow);
  const glow = track(new T.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(2.2), toneMapped: false }));
  const lightMat = track(new T.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
  const wingMat = track(new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    uniforms: { uC: { value: glowC.clone() }, uT: { value: 0 }, uA: { value: 0.8 }, uBeat },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uC; uniform float uT, uA, uBeat; varying vec2 vUv;
      void main(){ // ala de luz: plumas (bandas radiales), borde brillante, se desvanece hacia la punta
        float r = length(vUv - vec2(0.0, 0.5)), a = atan(vUv.y - 0.5, vUv.x);
        float feather = 0.5 + 0.5 * cos(a * 26.0 + sin(r * 6.0 - uT * 1.5) * 0.6);
        float body = smoothstep(1.0, 0.25, r) * smoothstep(0.0, 0.08, vUv.x);
        float edge = smoothstep(0.08, 0.0, abs(r - 0.92 + 0.05 * sin(a * 9.0))) * 0.8;
        float k = body * (0.25 + 0.75 * feather * feather) + edge;
        gl_FragColor = vec4(mix(uC, vec3(1.0, 0.95, 0.85), 0.35 * feather * body) * k * uA * (0.85 + 0.3 * uBeat), k * uA * 0.6); }`,
  }));
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const haloMat = track(new T.SpriteMaterial({ map: haloTex, color: glowC, blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));

  let parts = [], wings = [], core = null, coreHalo = null, organs = null, evo = -1, cgKey = null, ready = false, time = 0, clip = null, shotT = 0, act = null;
  const _a = new T.Vector3(), _b = new T.Vector3(), _q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0);
  const bone = (n) => human.bones[n] || null;
  /** Coloca `mesh` en el marco de la persona (pos/rot relativos a su raíz, +Z = adelante) y lo engancha al hueso conservando la pose. */
  function mount(bn, mesh, pos, rot = null) {
    const b = bone(bn); if (!b) return null; const root = human.object; root.updateMatrixWorld(true);
    const q = rot ? new T.Quaternion().setFromEuler(new T.Euler(...rot)) : new T.Quaternion();
    mesh.position.set(...pos); mesh.quaternion.copy(q); root.add(mesh); b.attach(mesh); parts.push(mesh); return mesh;
  }
  /** Anillo/pieza a lo largo de un hueso: entre `bn` y `cn` (fracción t), con su eje Y sobre el hueso. */
  function along(bn, cn, mesh, t = 0.5) {
    const b = bone(bn), c = bone(cn); if (!b || !c) return null; const root = human.object; root.updateMatrixWorld(true);
    b.getWorldPosition(_a); c.getWorldPosition(_b); root.worldToLocal(_a); root.worldToLocal(_b);
    const dir = _b.clone().sub(_a).normalize(); mesh.position.copy(_a).lerp(_b, t); mesh.quaternion.setFromUnitVectors(Y, dir);
    root.add(mesh); b.attach(mesh); parts.push(mesh); return mesh;
  }
  const local = (bn) => { const b = bone(bn); if (!b) return null; human.object.updateMatrixWorld(true); return human.object.worldToLocal(b.getWorldPosition(new T.Vector3())); };
  const M = (g, m) => new T.Mesh(G(g), m);

  function clear() { for (const m of parts) m.parent && m.parent.remove(m); parts = []; wings = []; core = coreHalo = null; if (organs) { organs.dispose(); organs = null; } }
  function build(lv, cg) {
    clear(); const head = local('head_h'), neck = local('neck01_h'), chest = local('spine01_h') || local('spine02_h'); if (!head || !chest) return;
    // — máscara ritual: casco frontal + cresta + diadema + ojos de luz
    const mask = M(new T.SphereGeometry(0.112, 28, 18, -Math.PI * 0.55, Math.PI * 1.1, 0.42, 1.95), maskMat); mask.scale.set(0.92, 1.12, 0.95); mask.rotation.y = 0;
    mount('head_h', mask, [head.x, head.y + 0.035, head.z + 0.012]);
    const crest = M(new T.BoxGeometry(0.012, 0.16, 0.012), gold); mount('head_h', crest, [head.x, head.y + 0.05, head.z + 0.112], [0.12, 0, 0]);
    const band = M(new T.TorusGeometry(0.106, 0.008, 6, 36), gold); mount('head_h', band, [head.x, head.y + 0.085, head.z + 0.005], [Math.PI / 2 + 0.12, 0, 0]);
    for (const s of [-1, 1]) { const eye = M(new T.SphereGeometry(0.016, 10, 6), glow); eye.scale.set(1.6, 0.45, 0.5); mount('head_h', eye, [head.x + s * 0.038, head.y + 0.05, head.z + 0.1], [0, 0, s * 0.18]); }
    if (L.mask === 'hueso') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const sp = M(new T.ConeGeometry(0.012 - i * 0.002, 0.11 - i * 0.02, 5), maskMat); mount('head_h', sp, [head.x + s * (0.06 + i * 0.03), head.y + 0.15 + i * 0.03, head.z - 0.01], [0, 0, -s * (0.35 + i * 0.3)]); }
    // — gorguera dorada y núcleo de luz en el pecho
    if (neck) { const gorget = M(new T.TorusGeometry(0.078, 0.013, 8, 32), gold); gorget.scale.set(1, 1, 0.8); mount('neck01_h', gorget, [neck.x, neck.y - 0.03, neck.z + 0.005], [Math.PI / 2 - 0.2, 0, 0]); }
    core = M(new T.IcosahedronGeometry(0.03, 0), glow); mount('spine01_h', core, [chest.x, chest.y + 0.02, chest.z + 0.135]);
    const cage = M(new T.TorusGeometry(0.045, 0.006, 6, 24), gold); mount('spine01_h', cage, [chest.x, chest.y + 0.02, chest.z + 0.13]);
    coreHalo = new T.Sprite(haloMat); coreHalo.scale.setScalar(0.32); mount('spine01_h', coreHalo, [chest.x, chest.y + 0.02, chest.z + 0.16]);
    // — filigrana: anillos dorados en antebrazos y brazos
    for (const s of ['L', 'R']) {
      along(`lowerarm01_${s}_h`, `wrist_${s}_h`, M(new T.TorusGeometry(0.042, 0.007, 6, 24).rotateX(Math.PI / 2), gold), 0.78);
      along(`lowerarm01_${s}_h`, `wrist_${s}_h`, M(new T.TorusGeometry(0.046, 0.005, 6, 24).rotateX(Math.PI / 2), gold), 0.62);
      along(`upperarm01_${s}_h`, `lowerarm01_${s}_h`, M(new T.TorusGeometry(0.058, 0.006, 6, 24).rotateX(Math.PI / 2), gold), 0.55);
    }
    // — nivel 1+: hombreras de porcelana con canto de oro
    if (lv >= 1) for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1, sh = local(`upperarm01_${s}_h`); if (!sh) continue;
      const pad = M(new T.SphereGeometry(0.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), porc); pad.scale.set(1, 0.7, 1.05); mount(`clavicle_${s}_h`, pad, [sh.x + sg * 0.02, sh.y + 0.03, sh.z], [0, 0, sg * 0.5]);
      const rim = M(new T.TorusGeometry(0.075, 0.008, 6, 28), gold); mount(`clavicle_${s}_h`, rim, [sh.x + sg * 0.035, sh.y + 0.0, sh.z], [Math.PI / 2, sg * 0.5, 0]);
    }
    // — nivel 2+: cresta de cristal vivo en la espalda + esquirlas en antebrazos
    if (lv >= 2) {
      const cm = glow; for (let i = 0; i < 5; i++) { const h = 0.09 + (i % 2) * 0.05 + (lv >= 4 ? 0.04 : 0), c = M(new T.ConeGeometry(0.018, h, 5), i % 2 ? cm : porc); mount('spine01_h', c, [chest.x, chest.y + 0.12 - i * 0.075, chest.z - 0.12 - Math.sin(i * 0.7) * 0.01], [-0.6 - i * 0.08, 0, 0]); }
      for (const s of ['L', 'R']) for (let i = 0; i < 2; i++) { const c = M(new T.ConeGeometry(0.012, 0.07 + i * 0.03, 4), glow); along(`lowerarm01_${s}_h`, `wrist_${s}_h`, c, 0.3 + i * 0.2); c.rotateX(0.9); c.translateY(0.04); }
    }
    // — nivel 3+: alas de luz
    if (lv >= 3) {
      const span = lv >= 4 ? 1.25 : 0.95;
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
        const g = new T.PlaneGeometry(span * (1 - k * 0.3), span * 0.55 * (1 - k * 0.25)); g.translate(span * (1 - k * 0.3) / 2, 0, 0);
        const w = M(g, wingMat); w.renderOrder = 3; mount('spine01_h', w, [chest.x + s * 0.06, chest.y + 0.06 - k * 0.12, chest.z - 0.14], [0, s > 0 ? -0.5 : Math.PI + 0.5, s * (0.35 - k * 0.45)]);
        w.userData.base = w.quaternion.clone(); w.userData.s = s; w.userData.k = k; wings.push(w);
      }
    }
    // — nivel 4: aureola dorada y corona
    if (lv >= 4) {
      const halo = M(new T.TorusGeometry(0.2, 0.012, 8, 48), gold); mount('head_h', halo, [head.x, head.y + 0.1, head.z - 0.14], [0.15, 0, 0]);
      const hl = M(new T.TorusGeometry(0.2, 0.03, 6, 48), lightMat); mount('head_h', hl, [head.x, head.y + 0.1, head.z - 0.145], [0.15, 0, 0]);
      for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2, sp = M(new T.ConeGeometry(0.009, 0.07 + (i === 3 ? 0.05 : 0), 4), gold); mount('head_h', sp, [head.x + Math.sin(a) * 0.1, head.y + 0.12 + Math.cos(a) * 0.02, head.z + Math.cos(a) * 0.06 - 0.02], [-0.2, 0, -a * 0.5]); }
    }
    // — órganos del campeón (cg): cuelgan de anclas en el pecho y la cabeza (marco «seraf», escala humana)
    if (cg && cg.length) {
      const ta = new T.Group(), hd = new T.Group(); ta.scale.setScalar(0.62); hd.scale.setScalar(0.62);
      mount('spine01_h', ta, [chest.x, chest.y - 0.12, chest.z]); mount('head_h', hd, [head.x, head.y - 0.06, head.z]);
      try { organs = attachChampOrgans(T, 'seraf', { torso: { g: ta }, head: { g: hd } }, cg, { color: L.glow, quality: opts.quality }); } catch (err) { console.warn('órganos del Huésped:', err.message); }
    }
  }

  human.ready.then(() => { ready = true; }).catch((e) => console.warn('Huésped humano:', e.message));
  return {
    object, human: true, get person() { return human; },
    event(e) { act = { k: e.t === 'melee' ? 'punch' : 'cast', t: e.t === 'melee' ? 0.55 : 0.9 }; },
    update(dt, pl, ctx = {}) {
      time += dt; if (!ready) return;
      const lv = pl.evo | 0, ck = (pl.cg || []).join(); if (lv !== evo || ck !== cgKey) { evo = lv; cgKey = ck; build(lv, pl.cg || []); }
      // clip: acción (golpe / habilidad) > disparo > locomoción
      const spd = ctx.speed || 0; shotT = Math.max(0, shotT - dt); if (act) { act.t -= dt; if (act.t <= 0) act = null; }
      const c = pl.dead ? 'death' : act ? act.k : (ctx.shot ? 'shoot' : spd > 6 ? 'sprint' : spd > 1.5 ? 'jog' : 'aimIdle');
      if (c !== clip) { clip = c; human.play(c, { fade: 0.18, restart: c === 'punch' || c === 'cast' || c === 'shoot' }); }
      human.update(dt, { speed: spd, moveDir: ctx.moveDir, pitch: ctx.pitch || 0, camera });
      // vida: núcleo que late, alas que respiran, órganos
      const b = uBeat.value, lvK = 1 + lv * 0.15;
      if (core) { core.rotation.y += dt * 1.4; core.scale.setScalar(1 + 0.25 * b); }
      if (coreHalo) { coreHalo.material.opacity = (0.55 + 0.45 * b) * Math.min(1, 0.6 + lv * 0.12); coreHalo.scale.setScalar(0.3 * lvK * (1 + 0.3 * b)); }
      wingMat.uniforms.uT.value = time; wingMat.uniforms.uA.value = 0.7 + 0.15 * lv;
      for (const w of wings) { const fl = Math.sin(time * 1.6 + w.userData.k) * 0.12 + (spd > 6 ? 0.25 : 0); _q.setFromAxisAngle(Y, fl * w.userData.s); w.quaternion.copy(w.userData.base).multiply(_q); }
      if (organs) organs.update(dt, time);
      object.visible = !(ctx.self && ctx.camDist != null && ctx.camDist < 0.5);
    },
    dispose() { clear(); human.dispose(); for (const m of mats) m.dispose(); for (const g of geos) g.dispose(); haloTex.dispose(); },
  };
}
