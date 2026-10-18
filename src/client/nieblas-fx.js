// NIEBLAS DE COLORES (cliente): dibuja las zonas de `state.ng` (la simulación está en src/sim/nieblas.js; docs/MUNDO_VIVO.md → «Nieblas con función»).
// PSICODELIA FLASHERA PERO LEGIBLE y BARATA: todas las nubes de todas las zonas son UN solo InstancedMesh de cartulinas (billboards) con un shader de ruido
// suave (≈ 1 llamada de dibujo), más un círculo en el suelo (aro + disco, 2 llamadas) que marca dónde está la niebla aunque no se vea la nube, y los
// «ecos falsos» de la niebla magenta (1 llamada). Presupuesto medido en Baja: ≤ 5 llamadas y ≤ 2 000 triángulos (tests/nieblas-render.test.js).
// Calidad (`cfg().nieblas`): 0 = sólo el aro del suelo y el cartel · 1 = nubes simples (Baja) · 2 = nubes completas.
// HUD: cartel «dentro de niebla X» con su función y cartel de aviso cuando se acerca una dañina; viñeta de color al estar adentro.
// «Reducir efectos» (ajuste reducirGravedad) apaga los ecos falsos y la ondulación de la viñeta.
import * as THREE from 'three';
import { NIEBLAS, nieblaPorIndice, NIEBLA } from '../sim/nieblas.js';
import { OUT } from './shaders.js';
import { settings } from './settings.js';

const MAX_Z = NIEBLA.maxZonas, PUFF_MAX = 30, ECO_MAX = 5;
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
/** Aspecto de cada tipo: color, borde, opacidad base y cuánto brilla (0 = tinta, 1 = luz aditiva). Los índices son los del snapshot. */
const LOOK = [
  { col: [0.55, 1.0, 0.1], rim: [0.85, 1.0, 0.35], a: 0.34, glow: 0.3, bub: 1.0 },      // 0 ácida: verde ácido con burbujas
  { col: [0.1, 0.9, 1.0], rim: [0.7, 1.0, 1.0], a: 0.26, glow: 0.55, bub: 0.3 },        // 1 cian: luz fría
  { col: [1.0, 0.22, 0.95], rim: [1.0, 0.7, 1.0], a: 0.3, glow: 0.5, bub: 0.6 },        // 2 magenta: ondula de color
  { col: [1.0, 0.55, 0.1], rim: [1.0, 0.85, 0.4], a: 0.3, glow: 0.45, bub: 0.5 },       // 3 ámbar: brasa
  { col: [0.93, 0.96, 1.0], rim: [1.0, 1.0, 1.0], a: 0.4, glow: 0.1, bub: 0.1 },        // 4 blanca: lechosa
  { col: [0.03, 0.0, 0.09], rim: [0.55, 0.3, 1.0], a: 0.5, glow: 0.0, bub: 0.2 },       // 5 negra: tinta con borde violeta
];
const VISTA = ['radial-gradient(ellipse at 50% 50%, rgba(120,255,30,.06) 30%, rgba(90,220,10,.40) 100%)', 'radial-gradient(ellipse at 50% 50%, rgba(40,240,255,.05) 35%, rgba(20,200,255,.30) 100%)',
  'radial-gradient(ellipse at 50% 50%, rgba(255,60,240,.06) 30%, rgba(255,40,220,.38) 100%)', 'radial-gradient(ellipse at 50% 50%, rgba(255,150,30,.05) 30%, rgba(255,110,10,.38) 100%)',
  'radial-gradient(ellipse at 50% 50%, rgba(240,246,255,.16) 20%, rgba(236,242,255,.50) 100%)', 'radial-gradient(ellipse at 50% 50%, rgba(10,0,30,.12) 20%, rgba(14,0,40,.62) 100%)'];

const CSS = `
#ngfx{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0;transition:opacity .45s}
#ngchip{position:absolute;left:calc(env(safe-area-inset-left,0px) + 12px);top:calc(env(safe-area-inset-top,0px) + 148px);max-width:min(236px,30vw);display:none;padding:7px 11px 8px;border-radius:12px;background:rgba(10,8,28,.82);border:1px solid var(--nc,#fff);color:#fff;font-size:12px;line-height:1.35;box-shadow:0 0 16px color-mix(in srgb,var(--nc,#fff) 45%,transparent);pointer-events:none}
#ngchip.on{display:block}
#ngchip .n{display:flex;gap:6px;align-items:baseline;font-weight:800;letter-spacing:.05em;color:var(--nc,#fff);font-size:13px}
#ngchip .n i{font-style:normal;font-size:15px}
#ngchip .f{opacity:.94;margin-top:2px}
#ngchip .b{height:4px;margin-top:5px;border-radius:2px;background:#ffffff26;overflow:hidden}
#ngchip .b i{display:block;height:100%;width:100%;background:var(--nc,#fff);transform-origin:left}
#ngchip.aviso{border-style:dashed;animation:ngpulse .7s ease-in-out infinite alternate}
@keyframes ngpulse{from{box-shadow:0 0 6px color-mix(in srgb,var(--nc,#fff) 30%,transparent)}to{box-shadow:0 0 22px color-mix(in srgb,var(--nc,#fff) 80%,transparent)}}
@media (max-width:700px){#ngchip{top:calc(env(safe-area-inset-top,0px) + 112px);font-size:11px;max-width:34vw}#ngchip .n{font-size:12px}}
`;

const VERT = `
  attribute vec3 aCenter; attribute float aSize, aSeed, aAlpha, aGlow, aBub; attribute vec3 aCol, aRim;
  varying vec2 vUv; varying vec3 vCol, vRim; varying float vA, vGlow, vSeed, vBub, vFade;
  void main(){
    vUv = uv; vCol = aCol; vRim = aRim; vA = aAlpha; vGlow = aGlow; vSeed = aSeed; vBub = aBub;
    vec4 mv = viewMatrix * vec4(aCenter, 1.0);
    mv.xy += (position.xy) * aSize;                                  // cartulina que siempre mira a la cámara
    vFade = smoothstep(0.6, 5.0, -mv.z);                             // se disuelve al acercarse (nunca un golpe de color pegado a la cámara)
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = `
  uniform float uTime, uLinear; varying vec2 vUv; varying vec3 vCol, vRim; varying float vA, vGlow, vSeed, vBub, vFade;
  float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1,0)), f.x), mix(h2(i + vec2(0,1)), h2(i + vec2(1,1)), f.x), f.y); }
  void main(){
    vec2 p = vUv - 0.5; float d = length(p) * 2.0;
    vec2 q = p * 3.0 + vSeed * 17.0; q += vec2(uTime * 0.07, -uTime * 0.05);
    float n = vn(q) * 0.6 + vn(q * 2.3 + 5.0) * 0.4;
    float bub = smoothstep(0.62, 0.7, vn(q * 4.0 + uTime * 0.2)) * vBub * 0.35;      // burbujas / destellos
    float a = smoothstep(1.0, 0.15, d + (n - 0.5) * 0.7) * vA * vFade;
    if (a < 0.004) discard;
    float edge = smoothstep(0.35, 0.95, d);
    float sh = 0.5 + 0.5 * sin(uTime * 0.8 + vSeed * 40.0 + d * 3.0);                  // color que respira
    vec3 col = mix(vCol, vRim, edge * 0.7 + bub + 0.18 * sh);
    col *= 0.9 + 0.3 * n;
    if (uLinear > 0.5) col = pow(col, vec3(2.2));
    a = min(a + bub * 0.25 * vA, 0.9);
    gl_FragColor = vec4(col * a * (1.0 + vGlow * 0.6), a * (1.0 - vGlow));            // premultiplicado: glow=1 suma luz, glow=0 tapa como tinta
  }`;

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const Z = new THREE.Vector3(0, 0, 1);

export class NieblasFx {
  constructor(renderer) {
    this.r = renderer; this.root = new THREE.Group(); this.root.name = 'nieblas-fx'; renderer.scene.add(this.root);
    this.t = 0; this.puffs = 9; this.nivel = 1; this.dentro = null; this.key = '';
    // nubes: un solo InstancedMesh con atributos por instancia
    const g = new THREE.InstancedBufferGeometry(); const pl = new THREE.PlaneGeometry(1, 1);
    g.index = pl.index; g.setAttribute('position', pl.attributes.position); g.setAttribute('uv', pl.attributes.uv);
    const n = MAX_Z * PUFF_MAX, mk = (k) => new THREE.InstancedBufferAttribute(new Float32Array(n * k), k);
    this.at = { center: mk(3), size: mk(1), seed: mk(1), alpha: mk(1), glow: mk(1), bub: mk(1), col: mk(3), rim: mk(3) };
    for (const [k, a] of [['aCenter', 'center'], ['aSize', 'size'], ['aSeed', 'seed'], ['aAlpha', 'alpha'], ['aGlow', 'glow'], ['aBub', 'bub'], ['aCol', 'col'], ['aRim', 'rim']]) { this.at[a].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, this.at[a]); }
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uTime: { value: 0 }, uLinear: { value: OUT.linear ? 1 : 0 } },
      transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    this.cloud = new THREE.Mesh(g, this.mat); this.cloud.frustumCulled = false; this.cloud.renderOrder = 6; this.cloud.name = 'nieblas-nubes'; this.root.add(this.cloud);
    // marca de suelo: aro + disco (siempre, aun con las nubes apagadas)
    const add = (geo, op) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }), MAX_Z); m.count = 0; m.frustumCulled = false; m.renderOrder = 5; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_Z * 3), 3); this.root.add(m); return m; };
    this.ring = add(new THREE.RingGeometry(0.93, 1, 48), 1); this.disc = add(new THREE.CircleGeometry(1, 32), 1); this.ring.name = 'nieblas-aro'; this.disc.name = 'nieblas-disco';
    // ecos falsos (niebla magenta): siluetas brillantes que no existen
    this.eco = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: renderer.halo, color: 0xff55ee, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), ECO_MAX);
    this.eco.count = 0; this.eco.frustumCulled = false; this.eco.renderOrder = 7; this.eco.name = 'nieblas-ecos'; this.root.add(this.eco);
    this.ecos = []; this.tmpM = new THREE.Matrix4(); this.tmpQ = new THREE.Quaternion(); this.tmpP = new THREE.Vector3(); this.tmpS = new THREE.Vector3(); this.tmpC = new THREE.Color(); this.u = new THREE.Vector3(); this.t1 = new THREE.Vector3(); this.t2 = new THREE.Vector3();
    if (typeof document !== 'undefined') {
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      this.ov = document.createElement('div'); this.ov.id = 'ngfx'; const c = document.getElementById('c'); if (c && c.parentNode) c.parentNode.insertBefore(this.ov, c.nextSibling); else document.body.appendChild(this.ov);
      const hud = document.getElementById('hud');
      if (hud) { this.chip = document.createElement('div'); this.chip.id = 'ngchip'; this.chip.setAttribute('aria-live', 'polite'); this.chip.innerHTML = '<div class="n"><i></i><span></span></div><div class="f"></div><div class="b"><i></i></div>'; hud.appendChild(this.chip); }
    }
    this.configure({ nieblas: 1 });
  }
  /** Cantidad de nubes según la calidad: 0 sólo marcas de suelo · 1 nubes simples · 2 completas. */
  configure(q) {
    this.nivel = q && q.nieblas != null ? q.nieblas : 1;
    this.puffs = this.nivel === 0 ? 0 : this.nivel === 1 ? 9 : (q && q.shadows ? 30 : 18);
    this.mat.uniforms.uLinear.value = OUT.linear ? 1 : 0;
  }
  update(dt, state, me) {
    this.t += dt; const ng = state && state.ng, zs = ng ? ng.z : [];
    this.mat.uniforms.uTime.value = this.t;
    this.nubes(zs); this.suelo(zs); this.hud(state, ng, me); this.ecosFalsos(state, ng, me, dt);
  }
  nubes(zs) {
    const A = this.at, N = this.puffs; let c = 0;
    if (N > 0) for (const z of zs) {
      const [id, ti, x, y, zz, r, k, ph, ux, uy, uz] = z; if (k < 0.03) continue;
      const L = LOOK[ti], T = nieblaPorIndice(ti); if (!L || !T) continue;
      this.u.set(ux, uy, uz).normalize(); this.t1.set(1, 0, 0); if (Math.abs(this.u.x) > 0.9) this.t1.set(0, 0, 1);
      this.t1.cross(this.u).normalize(); this.t2.crossVectors(this.u, this.t1);
      const pulso = ph === 1 ? 0.6 + 0.4 * Math.sin(this.t * 5 + id) : 1, n = Math.max(3, Math.round(N * Math.min(1, 0.35 + k)));
      for (let j = 0; j < n && c < MAX_Z * PUFF_MAX; j++, c++) {
        const h1 = hash(id * 31 + j * 7.3), h2 = hash(id * 17 + j * 3.1 + 5), h3 = hash(id * 5 + j * 11.7 + 9);
        const rad = Math.sqrt(h2) * r * 0.82, ang = h1 * 6.2832 + this.t * (0.05 + 0.1 * h3) * (j % 2 ? 1 : -1), hg = (0.1 + 0.9 * h3 * h3) * r * 0.5 - NIEBLA.alto * 0.7;
        const ca = Math.cos(ang) * rad, sa = Math.sin(ang) * rad, p3 = A.center.array, o = c * 3;
        p3[o] = x + this.t1.x * ca + this.t2.x * sa + this.u.x * hg; p3[o + 1] = y + this.t1.y * ca + this.t2.y * sa + this.u.y * hg; p3[o + 2] = zz + this.t1.z * ca + this.t2.z * sa + this.u.z * hg;
        A.size.array[c] = r * (0.5 + 0.45 * h2) * (N <= 9 ? 1.35 : 1); A.seed.array[c] = h1 + id; A.alpha.array[c] = L.a * k * pulso * (N <= 9 ? 1.25 : 1);
        A.glow.array[c] = L.glow; A.bub.array[c] = L.bub;
        A.col.array[o] = L.col[0]; A.col.array[o + 1] = L.col[1]; A.col.array[o + 2] = L.col[2]; A.rim.array[o] = L.rim[0]; A.rim.array[o + 1] = L.rim[1]; A.rim.array[o + 2] = L.rim[2];
      }
    }
    this.cloud.geometry.instanceCount = c;
    if (c) for (const a of Object.values(A)) a.needsUpdate = true;
    this.cloud.visible = c > 0;
  }
  suelo(zs) {
    let n = 0;
    for (const z of zs) {
      const [id, ti, x, y, zz, r, k, ph, ux, uy, uz] = z; if (n >= MAX_Z) break;
      if (ph === 0 && k < 0.05) continue;   // dormida y ya disuelta: no se dibuja nada (no ensucia el suelo ni el fondo del Huésped)
      const T = nieblaPorIndice(ti); if (!T) continue;
      this.u.set(ux, uy, uz).normalize();
      this.tmpQ.setFromUnitVectors(Z, this.u);
      this.tmpP.set(x - this.u.x * (NIEBLA.alto - 0.08), y - this.u.y * (NIEBLA.alto - 0.08), zz - this.u.z * (NIEBLA.alto - 0.08));
      this.tmpS.set(r, r, r); this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
      const col = hexRgb(ti === 5 ? '#9a70ff' : T.color), I = ph === 1 ? 0.45 + 0.55 * Math.abs(Math.sin(this.t * 6 + id)) : ph === 2 ? 0.6 : 0.16;   // aviso: parpadea · activa: firme · dormida: tenue
      this.ring.setMatrixAt(n, this.tmpM); this.disc.setMatrixAt(n, this.tmpM);
      this.tmpC.setRGB(col[0] * I * 1.4, col[1] * I * 1.4, col[2] * I * 1.4); this.ring.setColorAt(n, this.tmpC);
      this.tmpC.setRGB(col[0] * I * 0.22, col[1] * I * 0.22, col[2] * I * 0.22); this.disc.setColorAt(n, this.tmpC);
      n++;
    }
    for (const m of [this.ring, this.disc]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.visible = n > 0; }
  }
  /** Cartel y viñeta. Adentro: función de la niebla y cuánto llevás. Si se acerca una dañina (aviso): «¡Salí!» con la cuenta. */
  hud(state, ng, me) {
    if (!this.chip) return;
    const mine = ng && me ? ng.d.find((d) => d[0] === me.id) : null, T = mine ? nieblaPorIndice(mine[1]) : null;
    let aviso = null;
    if (!T && ng && me) for (const z of ng.z) {
      if (z[7] !== 1) continue; const t = nieblaPorIndice(z[1]); if (!t || !t.nocivo) continue;
      const d = Math.hypot(z[2] - me.pos[0], z[3] - me.pos[1], z[4] - me.pos[2]); if (d < z[5] + 14 && (!aviso || d < aviso.d)) aviso = { t, d, z };
    }
    const show = T || aviso; const key = T ? 'in' + mine[1] : aviso ? 'av' + aviso.t.i : '';
    if (key !== this.key) {
      this.key = key; const c = this.chip;
      if (show) { const t = T || aviso.t; c.style.setProperty('--nc', t.color); c.querySelector('.n i').textContent = t.icono; c.querySelector('.n span').textContent = T ? `Dentro de: ${t.nombre}` : `¡Se acerca ${t.nombre.toLowerCase()}!`; c.querySelector('.f').textContent = T ? t.desc : `${t.corto}. Salí de su círculo antes de que actúe.`; }
      c.classList.toggle('on', !!show); c.classList.toggle('aviso', !T && !!aviso);
    }
    const barra = this.chip.querySelector('.b'); barra.style.display = show && !T ? '' : 'none';
    if (show && !T) barra.firstChild.style.transform = `scaleX(${Math.max(0.05, Math.min(1, (aviso.z[6] - 0.1) / 0.5))})`;   // la barra se llena hasta que la niebla empieza a actuar
    // viñeta de color mientras estás adentro
    if (this.ov) {
      const idx = T ? T.i : -1, calma = settings().reducirGravedad;
      if (idx !== this.vig) { this.vig = idx; this.ov.style.background = idx >= 0 ? VISTA[idx] : 'none'; }
      this.ov.style.opacity = idx >= 0 ? String((calma ? 0.7 : 0.85) + (calma ? 0 : 0.15 * Math.sin(this.t * 2))) : '0';
    }
  }
  /** Falsos ecos de la niebla magenta: siluetas brillantes cerca de criaturas reales (no existen; la simulación no los conoce). Se apagan con «Reducir efectos». */
  ecosFalsos(state, ng, me, dt) {
    const dentro = ng && me && ng.d.some((d) => d[0] === me.id && d[1] === 2) && !settings().reducirGravedad;
    this.ecos.length = 0;
    if (dentro && state.monsters) {
      const ms = state.monsters.filter((m) => !m.c).slice(0, ECO_MAX);
      ms.forEach((m, i) => {
        const a = this.t * 0.6 + i * 2.1, off = 7 + 3 * Math.sin(this.t * 0.9 + i), fx = m.p[0] + Math.cos(a) * off, fz = m.p[2] + Math.sin(a) * off;
        this.ecos.push([fx, m.p[1] + 1.2, fz]);
      });
    }
    const cam = this.r.camera; let n = 0;
    for (const e of this.ecos) {
      this.tmpP.set(e[0], e[1], e[2]); this.tmpQ.copy(cam.quaternion); const s = 3.2 * (0.8 + 0.2 * Math.sin(this.t * 7 + n)); this.tmpS.set(s, s * 1.4, s);
      this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS); this.eco.setMatrixAt(n++, this.tmpM);
    }
    this.eco.count = n; this.eco.instanceMatrix.needsUpdate = true; this.eco.visible = n > 0;
  }
  dispose() { this.root.removeFromParent(); this.cloud.geometry.dispose(); this.mat.dispose(); for (const m of [this.ring, this.disc, this.eco]) { m.geometry.dispose(); m.material.dispose(); } if (this.ov) this.ov.remove(); if (this.chip) this.chip.remove(); }
}
