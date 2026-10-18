// HUÉSPED = GUARDIÁN ENTRE LOS MUERTOS Y LOS VIVOS (docs/CONCEPTO_ARTE.md): cuerpo humano REAL con esqueleto y clips de ARCANUM
// (humans.js, CC0 MakeHuman + Quaternius) vestido con túnica y «intervenido» por el pacto:
//   · máscara ritual (porcelana, obsidiana, hueso u oro según el Huésped) con diadema dorada y ojos de luz;
//   · gorguera y filigrana de oro (texturas Poly Haven, ph.js), NÚCLEO de luz en el pecho que late con el mundo (uBeat);
//   · EVOLUCIÓN VISIBLE POR CAMINO (`pth`, EVO_PATHS de data.js), una pieza física por nivel:
//       1 garras (depredador) | placas de porcelana (coraza) · 2 tendones de luz (velocidad) | anillos orbitando el núcleo (resonancia)
//       3 brazo fusionado de tejido vivo (simbiosis) | cañones de cristal en los hombros (artillería)
//       4 alas de luz + aureola (apoteosis) | grietas de vacío y esquirlas en órbita (anomalía)
//   · ÓRGANOS del campeón (`cg`, organs-vis.js) colgados del pecho y la cabeza;
//   · ASPECTO REGIONAL por mapa (state.map): paleta de acentos, ornamento propio del folclore del lugar y partículas que lo rodean.
// Misma interfaz que host-body.js ({ object, event, update, dispose, human:true }): render.js lo cambia por el de bloques cuando el kit
// humano termina de cargar (Media/Alta). Presupuesto medido: ver docs/ASSETS.md / informe (≈ 25–40 llamadas extra según nivel).
import { goldMaterial, porcelainMaterial as porcelainMaterialHQ, phMaterial } from './ph.js';
import { attachChampOrgans } from './organs-vis.js';
import { uBeat } from './shaders.js';
import { EVO_PATHS } from '../sim/data.js';

const LOOK = { // máscara, color de esencia (núcleo, ojos, luz), túnica y su tinte (oscuro: la luz la ponen las piezas del pacto)
  axioma: { mask: 'porcelana', glow: 0x3aa8ff, layer: 'abrigo-largo', cloth: 0x1e4a8a },
  vesper: { mask: 'obsidiana', glow: 0xb04bff, layer: 'tunica-larga', cloth: 0x3a1460 },
  micelio: { mask: 'hueso', glow: 0x7be03a, layer: 'tunica-corta', cloth: 0x3c5a1c },
  umbra: { mask: 'obsidiana', glow: 0xb98cff, layer: 'tunica-larga', cloth: 0x221636 },
  seraf: { mask: 'oro', glow: 0xffd45a, layer: 'toga-academica', cloth: 0x7a2a3a },
};
LOOK.singular = { mask: 'obsidiana', glow: 0xb26bff, layer: 'tunica-larga', cloth: 0x2a1a3a };   // Singular (vidrio negro y roca estelar)
LOOK.danzante = { mask: 'hueso', glow: 0xff3fa0, layer: 'tunica-corta', cloth: 0x4a1a5e };   // Danzante (máscara de calavera, falda corta de listones)
/** Aspecto regional: cada mapa marca al guardián con su folclore (acento, ornamento, partículas). */
export const REGION = {
  m1: { name: 'Vacío de Islas', accent: 0x9fe8ff, motes: 0xcfe8ff, orn: 'astros' },    // constelaciones: estrellas orbitando la cabeza
  m2: { name: 'Cámara Fractal', accent: 0xff5a9e, motes: 0xffb0d0, orn: 'geoda' },     // esquirlas de geoda que brotan de hombros
  m3: { name: 'Laberinto Celestial', accent: 0xffb050, motes: 0xffe0a0, orn: 'runas' }, // anillo de runas girando en la cintura
  m4: { name: 'Jardín de Carne', accent: 0xff7ab0, motes: 0xc8ff9a, orn: 'flores' },    // flores-ojo y zarcillos en hombros y brazos
  m5: { name: 'Limbo', accent: 0xbfd8ff, motes: 0xdfe8ff, orn: 'velos' },             // velos de ectoplasma colgando de los brazos
  m6: { name: 'Limbo', accent: 0xe8d8ff, motes: 0xf0e8ff, orn: 'velos' },
};
const DEFAULT_PATH = ['coraza', 'resonancia', 'simbiosis', 'apoteosis'];
/** Ids de camino por nivel 1..evo: lo elegido (`pth`) o, si falta, el primer camino de cada nivel. */
export function pathFor(evo, pth) { const out = []; for (let i = 1; i <= evo; i++) { const opts = EVO_PATHS[i] || [], id = pth && pth[i - 1]; out.push(opts.some((o) => o.id === id) ? id : DEFAULT_PATH[i - 1]); } return out; }

export function createHostHuman(T, hm, kit, p, opts = {}) {
  const L = LOOK[p.char] || LOOK.axioma, camera = opts.camera || null, getMap = opts.getMap || (() => null);
  const human = hm.createHuman(kit, { char: p.char, name: p.name, color: L.cloth, accent: L.glow, noGear: true, weapon: 'weapon' in opts ? opts.weapon : 0, overrides: { layer: L.layer } });
  const object = new T.Group(); object.name = 'huesped-humano-' + p.char; object.add(human.object);
  const mats = [], geos = [], track = (m) => { mats.push(m); return m; }, G = (g) => { geos.push(g); return g; };
  const low = opts.quality === 'low'; // Baja (iPhone): MeshStandard en vez de Physical (sin barniz ni transmisión)
  const porcelainMaterial = (o = {}) => low ? phMaterial('marble_01', { color: o.color || 0xffffff, emissive: 0x34343c, roughness: o.roughness || 0.45, normalScale: 0.35 }) : porcelainMaterialHQ(o);
  const gold = track(goldMaterial()), porc = track(porcelainMaterial());
  const maskMat = L.mask === 'oro' ? gold : L.mask === 'porcelana' ? porc : L.mask === 'hueso' ? track(porcelainMaterial({ color: 0xdccfb0, roughness: 0.8, clearcoat: 0.1 })) : track(porcelainMaterial({ color: 0x15121c, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
  const glowC = new T.Color(L.glow), accC = new T.Color(0xffffff);
  const glow = track(new T.MeshBasicMaterial({ color: glowC.clone().multiplyScalar(1.6), toneMapped: false }));
  const accent = track(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const lightMat = track(new T.MeshBasicMaterial({ color: glowC, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, toneMapped: false }));
  const flesh = track(new (low ? T.MeshStandardMaterial : T.MeshPhysicalMaterial)({ color: 0x7a2a3a, roughness: 0.35, ...(low ? {} : { clearcoat: 0.8, clearcoatRoughness: 0.3, sheen: 1, sheenColor: new T.Color(0xff6a7a) }), emissive: glowC.clone().multiplyScalar(0.25) }));
  const voidMat = track(new T.MeshBasicMaterial({ color: 0x0a0414, toneMapped: false }));
  const crystal = track(new (low ? T.MeshStandardMaterial : T.MeshPhysicalMaterial)({ color: glowC, metalness: 0, roughness: 0.08, ...(low ? {} : { transmission: 0.6, thickness: 0.05, ior: 1.6 }), emissive: glowC, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }));
  const wingMat = track(new T.ShaderMaterial({
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
    uniforms: { uC: { value: glowC.clone() }, uC2: { value: new T.Color(0xffffff) }, uT: { value: 0 }, uA: { value: 0.8 }, uBeat },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uC, uC2; uniform float uT, uA, uBeat; varying vec2 vUv;
      void main(){ // ala de luz: plumas (bandas radiales), borde brillante, iridiscencia del color regional, se desvanece hacia la punta
        float r = length(vUv - vec2(0.0, 0.5)), a = atan(vUv.y - 0.5, vUv.x);
        float feather = 0.5 + 0.5 * cos(a * 26.0 + sin(r * 6.0 - uT * 1.5) * 0.6);
        float body = smoothstep(1.0, 0.25, r) * smoothstep(0.0, 0.08, vUv.x);
        float edge = smoothstep(0.08, 0.0, abs(r - 0.92 + 0.05 * sin(a * 9.0))) * 0.8;
        float k = body * (0.14 + 0.9 * pow(feather, 4.0)) + edge * 1.3;
        vec3 c = mix(uC, uC2, 0.5 + 0.5 * sin(r * 7.0 - uT * 2.0 + a * 3.0));
        gl_FragColor = vec4(mix(c, vec3(1.0, 0.95, 0.85), 0.35 * feather * body) * k * uA * 0.45 * (0.85 + 0.3 * uBeat), k * uA * 0.35); }`,
  }));
  const haloTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const haloMat = track(new T.SpriteMaterial({ map: haloTex, color: glowC, blending: T.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  const moteMat = track(new T.ShaderMaterial({ // partículas regionales: suben en espiral alrededor del cuerpo
    transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uT: { value: 0 }, uC: { value: new T.Color(0xffffff) }, uBeat },
    vertexShader: `attribute float aS; uniform float uT, uBeat; varying float vA;
      void main(){ float h = fract(aS * 7.31 + uT * (0.12 + 0.1 * fract(aS * 3.1))), a = aS * 40.0 + uT * (0.6 + fract(aS * 5.3)), r = 0.35 + 0.35 * fract(aS * 9.7) + h * 0.15;
        vec3 p = vec3(cos(a) * r, h * 2.1, sin(a) * r); vA = sin(h * 3.1416) * (0.6 + 0.4 * uBeat);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (2.0 + 4.0 * fract(aS * 13.7)) * (6.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(uC * 1.6, smoothstep(0.5, 0.0, d) * vA); }`,
  }));

  let tinted = false, parts = [], wings = [], orbit = [], core = null, coreHalo = null, organs = null, key = null, ready = false, time = 0, clip = null, act = null, region = null, motes = null, fusion = null;
  const _a = new T.Vector3(), _b = new T.Vector3(), _q = new T.Quaternion(), Y = new T.Vector3(0, 1, 0);
  const bone = (n) => human.bones[n] || null;
  /** Coloca `mesh` en el marco de la persona (pos/rot relativos a su raíz, +Z = adelante) y lo engancha al hueso conservando la pose. */
  function mount(bn, mesh, pos, rot = null) {
    const b = bone(bn); if (!b) return null; const root = human.object; root.updateMatrixWorld(true);
    mesh.position.set(...pos); if (rot) mesh.quaternion.setFromEuler(new T.Euler(...rot)); root.add(mesh); b.attach(mesh); parts.push(mesh); return mesh;
  }
  /** Pieza a lo largo de un hueso: entre `bn` y `cn` (fracción t), con su eje Y sobre el hueso. */
  function along(bn, cn, mesh, t = 0.5) {
    const b = bone(bn), c = bone(cn); if (!b || !c) return null; const root = human.object; root.updateMatrixWorld(true);
    b.getWorldPosition(_a); c.getWorldPosition(_b); root.worldToLocal(_a); root.worldToLocal(_b);
    const dir = _b.clone().sub(_a).normalize(); mesh.position.copy(_a).lerp(_b, t); mesh.quaternion.setFromUnitVectors(Y, dir);
    root.add(mesh); b.attach(mesh); parts.push(mesh); return mesh;
  }
  const local = (bn) => { const b = bone(bn); if (!b) return null; human.object.updateMatrixWorld(true); return human.object.worldToLocal(b.getWorldPosition(new T.Vector3())); };
  const M = (g, m) => new T.Mesh(G(g), m);
  const torusY = (R, r, s = 24) => new T.TorusGeometry(R, r, 6, s).rotateX(Math.PI / 2);

  function clear() { for (const m of parts) m.parent && m.parent.remove(m); parts = []; wings = []; orbit = []; core = coreHalo = fusion = null; if (organs) { organs.dispose(); organs = null; } if (motes) { motes.parent && motes.parent.remove(motes); motes = null; } }
  function build(lv, path, cg, mapId) {
    const hb0 = local('head_h'), eL = local('oculi01_L_h'), eR = local('oculi01_R_h'), head = eL && eR ? eL.clone().add(eR).multiplyScalar(0.5).add(new T.Vector3(0, 0.01, -0.075)) : hb0 && hb0.clone().add(new T.Vector3(0, 0.01, 0.065)), neck = local('neck01_h'), chest = local('spine01_h'), hips = local('spine04_h'); if (!head || !chest) return false;
    clear(); region = REGION[mapId] || REGION.m1; accC.setHex(region.accent); accent.color.copy(accC).multiplyScalar(1.8); wingMat.uniforms.uC2.value.copy(accC); moteMat.uniforms.uC.value.setHex(region.motes);
    const has = (id) => path.includes(id);
    // — máscara ritual: casco frontal + cresta + diadema + ojos de luz (+ astas de hueso en Micelio)
    const mask = M(new T.SphereGeometry(0.118, 28, 18, Math.PI * 0.08, Math.PI * 0.84, 0.72, 1.6), maskMat); mask.scale.set(0.95, 1.25, 1.02);
    mount('head_h', mask, [head.x, head.y, head.z]);
    mount('head_h', M(new T.BoxGeometry(0.01, 0.075, 0.01), gold), [head.x, head.y + 0.045, head.z + 0.117], [-0.25, 0, 0]);
    for (const s of [-1, 1]) mount('head_h', M(new T.BoxGeometry(0.005, 0.07, 0.004), glow), [head.x + s * 0.035, head.y - 0.045, head.z + 0.116], [0.15, 0, -s * 0.06]); // lágrimas de luz
    mount('head_h', M(new T.TorusGeometry(0.112, 0.007, 6, 36), gold), [head.x, head.y + 0.1, head.z - 0.01], [Math.PI / 2 + 0.25, 0, 0]);
    for (const s of [-1, 1]) { const eye = M(new T.SphereGeometry(0.016, 10, 6), glow); eye.scale.set(1.6, 0.45, 0.5); mount('head_h', eye, [head.x + s * 0.035, head.y - 0.005, head.z + 0.121], [0, 0, s * 0.18]); }
    if (L.mask === 'hueso') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) mount('head_h', M(new T.ConeGeometry(0.012 - i * 0.002, 0.11 - i * 0.02, 5), maskMat), [head.x + s * (0.06 + i * 0.03), head.y + 0.12 + i * 0.03, head.z - 0.01], [0, 0, -s * (0.35 + i * 0.3)]);
    // — gorguera, núcleo de luz con jaula dorada, filigrana en brazos
    if (neck) { const gorget = M(new T.TorusGeometry(0.078, 0.013, 8, 32), gold); gorget.scale.set(1, 1, 0.8); mount('neck01_h', gorget, [neck.x, neck.y - 0.03, neck.z + 0.005], [Math.PI / 2 - 0.2, 0, 0]); }
    const big = has('resonancia') ? 1.5 : 1;
    core = M(new T.IcosahedronGeometry(0.03 * big, 0), glow); mount('spine01_h', core, [chest.x, chest.y + 0.02, chest.z + 0.17]);
    mount('spine01_h', M(new T.TorusGeometry(0.045 * big, 0.006, 6, 24), gold), [chest.x, chest.y + 0.02, chest.z + 0.165]);
    coreHalo = new T.Sprite(haloMat); coreHalo.scale.setScalar(0.32); mount('spine01_h', coreHalo, [chest.x, chest.y + 0.02, chest.z + 0.2]);
    for (const s of ['L', 'R']) {
      along(`lowerarm01_${s}_h`, `wrist_${s}_h`, M(torusY(0.05, 0.008), gold), 0.8); along(`lowerarm01_${s}_h`, `wrist_${s}_h`, M(torusY(0.056, 0.006), gold), 0.64);
      along(`upperarm01_${s}_h`, `lowerarm01_${s}_h`, M(torusY(0.075, 0.007), gold), 0.55);
    }
    // ═══ evolución por camino ═══
    if (has('depredador')) for (const s of ['L', 'R']) for (let i = 0; i < 3; i++) { // garras de hueso con filo de luz
      const c = M(new T.ConeGeometry(0.011, 0.16, 5).translate(0, 0.08, 0), maskMat); along(`wrist_${s}_h`, `metacarpal${2 + i}_${s}_h`, c, 0.9); c.rotateX(0.35); c.rotateZ((i - 1) * 0.18);
      const e = M(new T.ConeGeometry(0.004, 0.15, 3).translate(0, 0.085, 0.006), accent); along(`wrist_${s}_h`, `metacarpal${2 + i}_${s}_h`, e, 0.9); e.rotateX(0.35); e.rotateZ((i - 1) * 0.18);
    }
    if (has('coraza')) { // placas de porcelana: hombreras con canto de oro, peto y brazales
      for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1, sh = local(`upperarm01_${s}_h`); if (!sh) continue;
        const pad = M(new T.SphereGeometry(0.1, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), porc); pad.scale.set(1, 0.7, 1.05); mount(`clavicle_${s}_h`, pad, [sh.x + sg * 0.02, sh.y + 0.03, sh.z], [0, 0, sg * 0.5]);
        mount(`clavicle_${s}_h`, M(new T.TorusGeometry(0.075, 0.008, 6, 28), gold), [sh.x + sg * 0.035, sh.y, sh.z], [Math.PI / 2, sg * 0.5, 0]);
        const br = M(new T.CylinderGeometry(0.05, 0.044, 0.13, 14, 1, true), porc); along(`lowerarm01_${s}_h`, `wrist_${s}_h`, br, 0.45); }
      const plate = M(new T.SphereGeometry(0.17, 20, 10, -0.9, 1.8, 0.9, 0.9), porc); plate.scale.set(1, 1.1, 0.75); mount('spine01_h', plate, [chest.x, chest.y - 0.04, chest.z + 0.0]);
    }
    if (has('velocidad')) for (const [a, b2] of [['upperarm01_L_h', 'wrist_L_h'], ['upperarm01_R_h', 'wrist_R_h'], ['upperleg01_L_h', 'foot_L_h'], ['upperleg01_R_h', 'foot_R_h']]) { // tendones de luz
      for (const [t, l] of [[0.25, 0.22], [0.7, 0.22]]) { const c = M(new T.CylinderGeometry(0.006, 0.006, l, 5), accent); along(a, b2, c, t); c.translateZ(a.includes('leg') ? 0.07 : 0.05); }
    }
    if (has('resonancia')) for (let i = 0; i < 3; i++) { const r = M(new T.TorusGeometry(0.09 + i * 0.035, 0.004, 5, 40), i === 1 ? accent : gold); mount('spine01_h', r, [chest.x, chest.y + 0.02, chest.z + 0.18]); r.userData.spin = [0.7 + i * 0.4, (i - 1) * 0.9]; orbit.push(r); }
    if (has('simbiosis')) { // brazo derecho fusionado: bulbos de carne veteados que suben del arma al hombro
      fusion = []; for (let i = 0; i < 6; i++) { const b2 = M(new T.IcosahedronGeometry(0.05 - i * 0.004, 2), flesh); b2.scale.set(1, 1.4, 1); along(i < 3 ? 'lowerarm01_R_h' : 'upperarm01_R_h', i < 3 ? 'wrist_R_h' : 'lowerarm01_R_h', b2, 0.85 - (i % 3) * 0.3); b2.translateX(0.02 * ((i % 2) ? 1 : -1)); fusion.push(b2); }
      for (let i = 0; i < 4; i++) { const v = M(new T.CylinderGeometry(0.005, 0.003, 0.24, 4), accent); along('upperarm01_R_h', 'wrist_R_h', v, 0.25 + i * 0.18); v.translateZ(0.045); v.rotateY(i * 1.6); }
    }
    if (has('artilleria')) for (const s of ['L', 'R']) { const sg = s === 'L' ? 1 : -1, sh = local(`upperarm01_${s}_h`); if (!sh) continue; // cañones de cristal en los hombros
      const tube = M(new T.CylinderGeometry(0.03, 0.04, 0.32, 8), crystal); mount(`clavicle_${s}_h`, tube, [sh.x + sg * 0.01, sh.y + 0.12, sh.z - 0.05], [Math.PI / 2 - 0.25, 0, 0]);
      mount(`clavicle_${s}_h`, M(new T.TorusGeometry(0.042, 0.008, 6, 20), gold), [sh.x + sg * 0.01, sh.y + 0.15, sh.z + 0.08], [-0.25, 0, 0]);
      mount(`clavicle_${s}_h`, M(new T.SphereGeometry(0.022, 10, 8), accent), [sh.x + sg * 0.01, sh.y + 0.16, sh.z + 0.11]);
    }
    if (has('apoteosis')) { // alas de luz + aureola + corona
      const span = 1.3; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const w0 = span * (1 - k * 0.25), g = new T.PlaneGeometry(w0, w0 * 0.55); g.translate(w0 / 2, 0, 0);
        const w = M(g, wingMat); w.renderOrder = 3; mount('spine01_h', w, [chest.x + s * 0.06, chest.y + 0.06 - k * 0.12, chest.z - 0.14], [0, s > 0 ? -0.15 : Math.PI + 0.15, s * (0.55 - k * 0.45)]);
        w.userData.base = w.quaternion.clone(); w.userData.s = s; w.userData.k = k; wings.push(w);
      }
      mount('head_h', M(new T.TorusGeometry(0.2, 0.012, 8, 48), gold), [head.x, head.y + 0.08, head.z - 0.17], [0.15, 0, 0]);
      mount('head_h', M(new T.TorusGeometry(0.2, 0.03, 6, 48), lightMat), [head.x, head.y + 0.08, head.z - 0.175], [0.15, 0, 0]);
      for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2; mount('head_h', M(new T.ConeGeometry(0.009, 0.07 + (i === 3 ? 0.05 : 0), 4), gold), [head.x + Math.sin(a) * 0.1, head.y + 0.11 + Math.cos(a) * 0.02, head.z + Math.cos(a) * 0.06 - 0.02], [-0.2, 0, -a * 0.5]); }
    }
    if (has('anomalia')) { // grietas de vacío con borde de luz + esquirlas negras en órbita
      for (let i = 0; i < 5; i++) { const c = M(new T.BoxGeometry(0.008, 0.12 + (i % 2) * 0.06, 0.004), accent); mount(i < 2 ? 'head_h' : 'spine01_h', c, i < 2 ? [head.x + (i ? 0.03 : -0.045), head.y + 0.02, head.z + 0.12] : [chest.x + (i - 3) * 0.06, chest.y + 0.05 - i * 0.02, chest.z + 0.17], [0.1, 0, 0.5 - i * 0.35]); }
      for (let i = 0; i < 6; i++) { const sh = M(new T.OctahedronGeometry(0.035, 0), voidMat); sh.scale.set(0.6, 1.4, 0.6); mount('spine01_h', sh, [chest.x, chest.y + 0.05, chest.z]); sh.userData.orb = [i * 1.05, 0.38 + (i % 2) * 0.1, 0.9 + (i % 3) * 0.3]; orbit.push(sh); }
    }
    // ═══ aspecto regional (folclore del mapa) ═══
    if (region.orn === 'astros') for (let i = 0; i < 5; i++) { const st = M(new T.OctahedronGeometry(0.018, 0), accent); mount('head_h', st, [head.x, head.y + 0.08, head.z]); st.userData.orb = [i * 1.256, 0.2, 0.8]; orbit.push(st); }
    if (region.orn === 'geoda') for (const s of ['L', 'R']) { const sh = local(`upperarm01_${s}_h`); if (!sh) continue; for (let i = 0; i < 3; i++) mount(`clavicle_${s}_h`, M(new T.ConeGeometry(0.02, 0.1 + i * 0.03, 5), crystal), [sh.x, sh.y + 0.07, sh.z - 0.03 + i * 0.03], [-0.3 + i * 0.3, 0, (s === 'L' ? -1 : 1) * (0.3 + i * 0.2)]); }
    if (region.orn === 'runas' && hips) { const ring = M(new T.TorusGeometry(0.32, 0.006, 4, 6), accent); mount('spine04_h', ring, [hips.x, hips.y + 0.05, hips.z], [Math.PI / 2, 0, 0]); ring.userData.spin = [0.5, 0]; orbit.push(ring);
      const ring2 = M(new T.TorusGeometry(0.34, 0.004, 4, 3), gold); mount('spine04_h', ring2, [hips.x, hips.y + 0.05, hips.z], [Math.PI / 2, 0, 0]); ring2.userData.spin = [-0.35, 0]; orbit.push(ring2); }
    if (region.orn === 'flores') for (const s of ['L', 'R']) for (let i = 0; i < 2; i++) { const f = M(new T.SphereGeometry(0.03, 10, 8), flesh); along(`upperarm01_${s}_h`, `lowerarm01_${s}_h`, f, 0.2 + i * 0.5); f.translateZ(0.05); const iris = M(new T.SphereGeometry(0.016, 8, 6), accent); along(`upperarm01_${s}_h`, `lowerarm01_${s}_h`, iris, 0.2 + i * 0.5); iris.translateZ(0.075); }
    if (region.orn === 'velos') for (const s of ['L', 'R']) { const v = M(new T.PlaneGeometry(0.16, 0.5).translate(0, -0.25, 0), lightMat); along(`lowerarm01_${s}_h`, `wrist_${s}_h`, v, 0.4); v.rotateX(Math.PI); wings.push(Object.assign(v, { userData: { base: v.quaternion.clone(), s: s === 'L' ? 1 : -1, k: 3 } })); }
    // partículas que suben alrededor del cuerpo (1 llamada)
    { const n = 48, g = G(new T.BufferGeometry()), a = new Float32Array(n), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) a[i] = (i + 0.5) / n; g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aS', new T.BufferAttribute(a, 1)); motes = new T.Points(g, moteMat); motes.frustumCulled = false; object.add(motes); }
    // — órganos del campeón (cg): anclas en el pecho y la cabeza (marco «seraf», escala humana)
    if (cg && cg.length) {
      const ta = new T.Group(), hd = new T.Group(); ta.scale.setScalar(0.62); hd.scale.setScalar(0.62);
      mount('spine01_h', ta, [chest.x, chest.y - 0.12, chest.z]); mount('head_h', hd, [head.x, head.y - 0.1, head.z]);
      try { organs = attachChampOrgans(T, 'seraf', { torso: { g: ta }, head: { g: hd } }, cg, { color: L.glow, quality: opts.quality }); } catch (err) { console.warn('órganos del Huésped:', err.message); }
    }
    return true;
  }

  human.ready.then(() => { ready = true; }).catch((e) => console.warn('Huésped humano:', e.message));
  return {
    object, human: true, get person() { return human; }, get parts() { return parts.length; },
    event(e) { act = { k: e.t === 'melee' ? 'punch' : 'cast', t: e.t === 'melee' ? 0.55 : 0.9 }; },
    update(dt, pl, ctx = {}) {
      time += dt; if (!ready || !human.bones.head_h) return;
      const lv = pl.evo | 0, path = pathFor(lv, pl.pth), mapId = getMap() || 'm1', k2 = `${path.join()}|${(pl.cg || []).join()}|${mapId}`;
      if (k2 !== key && build(lv, path, pl.cg || [], mapId)) key = k2;
      if (!tinted) { tinted = true; human.object.traverse((o) => { if (o.name === 'npc-capas' && o.material && o.material.color) { o.material = o.material.clone(); mats.push(o.material); o.material.color.setHex(L.cloth); } }); } // túnica: tinte propio (sin quemarse con la luz)
      // clip: acción (golpe / habilidad) > disparo > locomoción
      const spd = ctx.speed || 0; if (act) { act.t -= dt; if (act.t <= 0) act = null; }
      const c = pl.dead ? 'death' : act ? act.k : (ctx.shot ? 'shoot' : spd > 6 ? 'sprint' : spd > 1.5 ? 'jog' : opts.weapon === null ? 'idle' : 'aimIdle');
      if (c !== clip) { clip = c; human.play(c, { fade: 0.18, restart: c === 'punch' || c === 'cast' || c === 'shoot' }); }
      human.update(dt, { speed: spd, moveDir: ctx.moveDir, pitch: ctx.pitch || 0, camera });
      // vida: núcleo que late, alas que respiran, órbitas, partículas, órganos
      const b = uBeat.value, lvK = 1 + lv * 0.15;
      if (core) { core.rotation.y += dt * 1.4; core.scale.setScalar(1 + 0.25 * b); }
      if (coreHalo) { coreHalo.material.opacity = (0.25 + 0.25 * b) * Math.min(1, 0.6 + lv * 0.1); coreHalo.scale.setScalar(0.16 * lvK * (1 + 0.25 * b)); }
      wingMat.uniforms.uT.value = time; wingMat.uniforms.uA.value = 0.75 + 0.05 * lv; moteMat.uniforms.uT.value = time;
      for (const w of wings) { const fl = Math.sin(time * (w.userData.k === 3 ? 2.6 : 1.6) + w.userData.k) * (w.userData.k === 3 ? 0.35 : 0.12) + (spd > 6 ? 0.25 : 0); _q.setFromAxisAngle(w.userData.k === 3 ? new T.Vector3(1, 0, 0) : Y, fl * w.userData.s); w.quaternion.copy(w.userData.base).multiply(_q); }
      for (const o of orbit) {
        if (o.userData.spin) { o.rotation.z += dt * o.userData.spin[0]; if (o.userData.spin[1]) o.rotation.x = Math.PI / 2 + Math.sin(time * 0.5) * o.userData.spin[1]; }
        else if (o.userData.orb) { if (!o.userData.c0) o.userData.c0 = o.position.clone(); const [ph, r, sp] = o.userData.orb, a = ph + time * sp; o.position.set(o.userData.c0.x + Math.cos(a) * r * 0.5, o.userData.c0.y + Math.sin(time * 1.3 + ph) * 0.05, o.userData.c0.z + Math.sin(a) * r * 0.5); o.rotation.y += dt * 2; }
      }
      if (fusion) fusion.forEach((f, i) => f.scale.set(1 + 0.12 * Math.sin(time * 3 + i), 1.4 + 0.15 * b, 1 + 0.12 * Math.sin(time * 3 + i)));
      if (organs) organs.update(dt, time);
      object.visible = !(ctx.self && ctx.camDist != null && ctx.camDist < 0.5);
    },
    dispose() { clear(); human.dispose(); for (const m of mats) m.dispose(); for (const g of geos) g.dispose(); haloTex.dispose(); },
  };
}
