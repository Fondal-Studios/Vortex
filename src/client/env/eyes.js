import * as THREE from 'three';
import { cfg } from '../quality.js';
import { uTime, finish } from '../shaders.js';
import { NOISE } from './glsl.js';
import { rng } from './noise.js';

// ══════════════════════════════════════════════════════════════════════════════════════════════
//  OJOS CÓSMICOS — «entidades que miran desde todas partes». Sirve para los TRES mapas.
//
//  Cada ojo es un cartel (quad) con un shader procedural: párpados que parpadean y a veces se duermen del todo,
//  iris con fibras y colores psicodélicos que cambian, pupila redonda / vertical / horizontal / triple / radiante,
//  halo y destellos. La pupila SIGUE al jugador en el shader (usa cameraPosition) y los ojos del cielo además
//  giran el cuerpo hacia la cámara muy despacio. Todos los ojos son UN solo InstancedMesh (1 llamada de dibujo);
//  las constelaciones suman 1 más (líneas finas). Se desvanecen con la distancia/niebla.
//
//  CÓMO LLAMARLO (render.js, dentro de setMap, DESPUÉS de construir el mapa; r.dyn ya se limpió antes):
//
//      import { addCosmicEyes } from './env/eyes.js';
//      // Mapa 1 · islas flotando (cielo lejano; ojos gigantes entre los monumentos):
//      addCosmicEyes(this, this.mapRoot, { mode: 'sky', count: q.decor ? 40 : 12, radius: 1000, minR: 450, size: 3.2, y0: -150, y1: 700 });
//      // Mapa 2 · esfera hueca de radio 85 (ojos incrustados en la cara interior del cascarón):
//      addCosmicEyes(this, this.mapRoot, { mode: 'shell', shellR: MAPS.m2.R, count: q.decor ? 46 : 12 });
//      // Mapa 3 · laberinto: buildMap3() ya los añade solo (opción { eyes:false } para apagarlos).
//
//  Opciones (todas opcionales):
//    count     cantidad total de ojos (low ≈ 12, medium ≈ 36, high ≈ 60). Por defecto según cfg().
//    mode      'sky' (ojos flotando en una cáscara esférica entre minR y radius)  |  'shell' (pegados a la cara interior
//              de una esfera de radio shellR; mira hacia adentro).
//    radius, minR    distancia máxima/mínima al centro (modo sky).
//    center    [x,y,z] centro del cielo (por defecto 0,0,0).
//    y0, y1    altura mínima/máxima de los ojos (modo sky), para no meterlos bajo el suelo.
//    size      multiplicador de tamaño (1 = pensado para radius≈300; subilo con el radio).
//    shellR    radio de la esfera hueca (modo shell).
//    hosts     [{ pos:[x,y,z], r }] planetas/esferas donde incrustar ojos mirando hacia afuera («ojos dentro de planetas»).
//    zenith    true: un ojo soberano gigante en el techo del cielo (modo sky, por defecto true).
//    constellations  cuántas constelaciones de ojitos unidos por líneas (por defecto 3; 1 en low).
//    haze      color de la niebla a la que se funden (0xRRGGBB) y hazeDens (densidad exp²; por defecto según radius).
//    seed      semilla del reparto (mismo mapa ⇒ mismos ojos).
//  Devuelve { mesh, lines, update(dt,t), count, dispose() }. También se registra solo en r.dyn.
// ══════════════════════════════════════════════════════════════════════════════════════════════

const PALETTE = [[1.0, 0.25, 0.7], [0.2, 0.9, 1.0], [1.0, 0.7, 0.15], [0.6, 0.35, 1.0], [0.4, 1.0, 0.45], [1.0, 0.35, 0.2], [0.9, 0.9, 1.0]];

function eyeMaterial({ haze, hazeDens, far }) {
  return finish(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, defines: { FBM_OCT: 2 },
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, // alfa premultiplicado: alfa 0 ⇒ suma luz (halo)
    uniforms: { uTime, uHaze: { value: new THREE.Color(haze) }, uHD: { value: hazeDens }, uFar: { value: far } },
    vertexShader: `attribute float aType; attribute float aPh; varying vec2 vP; varying vec3 vC; varying float vType; varying float vPh; varying vec2 vLk; varying float vDist;
      void main(){
        vP = position.xy; vType = aType; vPh = aPh; vC = vec3(1.0);
        #ifdef USE_INSTANCING_COLOR
          vC = instanceColor;
        #endif
        mat4 M = modelMatrix * instanceMatrix;
        vec3 ax = normalize(M[0].xyz), ay = normalize(M[1].xyz), wc = M[3].xyz;
        vec3 tc = normalize(cameraPosition - wc);
        vec2 lk = vec2(dot(tc, ax), dot(tc, ay)) * 2.4; float l = length(lk); vLk = l > 1.0 ? lk / l : lk;   // hacia dónde mira la pupila
        vDist = distance(cameraPosition, wc);
        gl_Position = projectionMatrix * viewMatrix * M * vec4(position, 1.0);
      }`,
    fragmentShader: `uniform float uTime, uHD, uFar; uniform vec3 uHaze; varying vec2 vP; varying vec3 vC; varying float vType; varying float vPh; varying vec2 vLk; varying float vDist;
      ${NOISE}
      const float PI = 3.14159265;
      void main(){
        vec2 p = vP; float t = uTime;
        float aa = max(length(fwidth(p)) * 1.4, 0.004);
        // — párpados: parpadeo periódico + «sueño» (cada tanto se cierran del todo y se abren después)
        float cyc = 3.5 + vPh * 6.0, ph = fract((t + vPh * 57.0) / cyc);
        float blink = 1.0 - sin(clamp(ph / 0.09, 0.0, 1.0) * PI);
        float sleep = smoothstep(-0.25, 0.30, sin(t * 0.05 + vPh * 71.0));
        float open = blink * sleep * (0.9 + 0.1 * sin(t * 0.6 + vPh * 9.0));
        float x = p.x / 0.9, prof = pow(max(1.0 - x * x, 0.0), 0.72);
        float up = open * 0.50 * prof, lo = open * 0.34 * prof;
        float dEdge = p.y > 0.0 ? up - p.y : lo + p.y;                // >0 dentro del ojo
        float inEye = smoothstep(0.0, aa, dEdge) * step(abs(x), 1.0);
        // — esclera: tinte del ojo, sombreado esférico y venitas
        float sh = 0.55 + 0.45 * sqrt(clamp(1.0 - pow(p.y / max(p.y > 0.0 ? up : lo, 0.001), 2.0), 0.0, 1.0));
        vec3 scl = mix(vec3(0.92, 0.88, 0.95), vC, 0.30) * sh;
        float vn = abs(vnoise(vec3(p * vec2(7.0, 9.0), vPh * 9.0)) - 0.5) * 2.0;
        scl = mix(scl, vec3(0.8, 0.15, 0.3), (1.0 - smoothstep(0.0, 0.10, vn)) * smoothstep(0.25, 0.9, abs(x)) * 0.5);
        // — iris: fibras radiales, anillos y colores que se desplazan
        vec2 c = vLk * vec2(0.34, 0.12);
        vec2 q = p - c; float rr = length(q) / 0.40, a = atan(q.y, q.x);
        float fib = vnoise(vec3(cos(a) * 7.0, sin(a) * 7.0, rr * 2.2 + vPh * 5.0 + t * 0.05));
        float fib2 = vnoise(vec3(cos(a) * 16.0, sin(a) * 16.0, rr * 3.0 - t * 0.12));
        vec3 pal = 0.5 + 0.5 * cos(6.2832 * (rr * 0.7 + vPh + t * 0.03 + vec3(0.0, 0.33, 0.67)));
        vec3 iris = mix(vC, pal, 0.6) * (0.35 + 1.1 * fib) * (0.7 + 0.6 * fib2);
        iris += vec3(1.0, 0.8, 0.4) * smoothstep(0.55, 0.30, abs(rr - 0.5)) * 0.35 * smoothstep(0.2, 0.5, rr);   // collar claro
        iris *= mix(1.0, 0.25, smoothstep(0.78, 1.0, rr));                                                 // borde oscuro del iris
        float irisM = 1.0 - smoothstep(0.96, 1.0, rr);
        // — pupila: redonda · vertical · horizontal · triple · radiante
        float pr = 0.30 + 0.07 * sin(t * 0.6 + vPh * 9.0) - clamp(0.0, 0.0, 0.0);
        vec2 u = q / 0.40; float dp;
        int ty = int(vType + 0.5);
        if (ty == 1) dp = length(u * vec2(1.0, 0.30)) - pr * 0.95;
        else if (ty == 2) dp = length(u * vec2(0.34, 1.0)) - pr * 0.95;
        else if (ty == 3) { float rot = t * 0.4 + vPh * 6.0; dp = 9.0; for (int k = 0; k < 3; k++) { float ak = rot + float(k) * 2.0944; dp = min(dp, length(u - vec2(cos(ak), sin(ak)) * 0.42) - 0.20); } }
        else dp = length(u) - pr;
        float pupil = 1.0 - smoothstep(0.0, 0.05, dp);
        vec3 pcol = ty == 4 ? vec3(1.6, 1.5, 1.7) * (0.8 + 0.3 * sin(t * 2.0 + vPh * 20.0)) : vec3(0.0);
        // — ensamble
        vec3 col = mix(scl, iris, irisM);
        col = mix(col, pcol, pupil);
        col += vec3(1.0) * exp(-pow(length(p - vec2(-0.14, 0.12) - c * 0.35) / 0.045, 2.0)) * 1.3 * inEye;           // destello fijo (da vida)
        col += vec3(0.9, 0.95, 1.0) * exp(-pow(length(p - vec2(0.10, -0.08) - c * 0.35) / 0.025, 2.0)) * 0.8 * inEye;
        col *= 0.8 + 0.2 * smoothstep(1.0, 0.7, abs(x));
        // — borde de párpado luminoso, pestañas-rayos y halo (alfa 0 ⇒ solo suma luz)
        float lid = exp(-abs(dEdge) * 55.0) * step(abs(x), 1.02);
        float rays = pow(0.5 + 0.5 * sin(atan(p.y, p.x) * 22.0 + vPh * 10.0), 3.0) * exp(-max(length(p * vec2(0.8, 1.6)) - 0.5, 0.0) * 3.2) * (1.0 - inEye);
        float halo = exp(-length(p * vec2(0.9, 1.5)) * 2.3);
        vec3 glow = vC * (lid * 1.6 + rays * 0.35 + halo * 0.30 * (0.3 + 0.7 * open)) + vec3(1.0) * lid * 0.25;
        float al = inEye;
        vec3 rgb = col * inEye + glow;
        // — lejanía: se desvanece con la niebla y la distancia
        float hz = 1.0 - exp(-vDist * vDist * uHD);
        float fade = (1.0 - smoothstep(uFar * 0.78, uFar * 1.12, vDist)) * smoothstep(0.6, 3.0, vDist) * (1.0 - hz * 0.85);
        rgb = mix(rgb, uHaze * al, hz * 0.5) * fade; al *= fade;
        gl_FragColor = vec4(rgb, al);
      }`,
  }));
}

export function addCosmicEyes(r, root, opts = {}) {
  const q = cfg(), rd = rng(opts.seed || 777);
  const mode = opts.mode || 'sky';
  const count = Math.max(1, Math.round(opts.count ?? (q.shadows ? 60 : q.decor ? 36 : 12)));
  const C = new THREE.Vector3(...(opts.center || [0, 0, 0]));
  const radius = opts.radius ?? (mode === 'shell' ? (opts.shellR || 85) : 330), minR = opts.minR ?? radius * 0.35;
  const size = opts.size ?? 1, y0 = opts.y0 ?? -1e9, y1 = opts.y1 ?? 1e9, shellR = opts.shellR ?? 85;
  const far = (mode === 'shell' ? shellR * 3 : radius) * 1.25;
  const hazeDens = opts.hazeDens ?? (mode === 'shell' ? 0.00003 : 1.8 / (radius * radius));
  const mat = eyeMaterial({ haze: opts.haze ?? (mode === 'shell' ? 0x2a0f34 : 0x1a1040), hazeDens, far });
  const list = []; // { pos, quat(home), s, col, type, ph, follow }
  const col = () => { const c = PALETTE[Math.floor(rd() * PALETTE.length)]; return new THREE.Color(c[0], c[1], c[2]); };
  const mtx = new THREE.Matrix4(), tq = new THREE.Quaternion(), up = new THREE.Vector3(), v = new THREE.Vector3();
  const facing = (pos, target, roll) => { up.set(Math.sin(roll), Math.cos(roll), 0.25 * Math.sin(roll * 3.0)).normalize(); mtx.lookAt(target, pos, up); return new THREE.Quaternion().setFromRotationMatrix(mtx); }; // +z del ojo mira a target
  const rdir = () => { for (;;) { v.set(rd() * 2 - 1, rd() * 2 - 1, rd() * 2 - 1); const l = v.length(); if (l > 0.1 && l <= 1) return v.clone().divideScalar(l); } };
  const type = () => { const k = rd(); return k < 0.40 ? 0 : k < 0.62 ? 1 : k < 0.74 ? 2 : k < 0.88 ? 3 : 4; };
  const push = (pos, quat, s, c, ty, follow) => list.push({ pos, quat, s, col: c, type: ty, ph: rd(), follow });

  if (mode === 'shell') {
    // — incrustados en la cara interior del cascarón, mirando hacia adentro (a escala visible)
    for (let i = 0; i < count; i++) {
      let d; for (let k = 0; k < 20; k++) { d = rdir(); if (d.y < -0.93) continue; break; }  // sin ojos justo bajo los pies al aparecer
      const big = rd() < 0.25, s = (big ? 11 + rd() * 9 : 3.5 + rd() * 5) * size;
      const pos = C.clone().addScaledVector(d, shellR - 0.35);
      push(pos, facing(pos, C.clone(), rd() * 6.28), s, col(), type(), 0);
    }
  } else {
    // — modo cielo
    const place = (d, dist) => C.clone().addScaledVector(d, dist);
    const okY = (p) => p.y >= y0 && p.y <= y1;
    if (opts.zenith !== false) { const p = place(new THREE.Vector3(0.02, 1, 0.03).normalize(), Math.min(radius * 0.9, (y1 > 1e8 ? radius : y1 * 0.95))); push(p, facing(p, C.clone().add(new THREE.Vector3(0, -40, 0)), 0.3), radius * 0.30 * size, new THREE.Color(0.7, 0.45, 1.0), 1, 0.35); }
    // planetas anfitriones
    const hosts = opts.hosts || [];
    for (const h of hosts) {
      const hp = new THREE.Vector3(...h.pos), n = Math.max(1, Math.min(3, Math.round(count / 20)));
      for (let k = 0; k < n; k++) { const toC = C.clone().sub(hp).normalize(), d = toC.clone().add(rdir().multiplyScalar(0.55)).normalize(), s = h.r * (k === 0 ? 0.42 : 0.22);
        const p = hp.clone().addScaledVector(d, h.r * 1.004); push(p, facing(p, p.clone().add(d), rd() * 6), s, col(), k === 0 ? 1 : type(), 0); }
    }
    // constelaciones: grupos de ojitos unidos por líneas
    const nCon = opts.constellations ?? (q.decor ? 3 : 1), conLines = [];
    for (let c = 0; c < nCon; c++) {
      let cd, cdist; for (let k = 0; k < 30; k++) { cd = rdir(); cdist = radius * (0.7 + rd() * 0.3); if (okY(place(cd, cdist)) && cd.y > -0.2) break; }
      const n = 5 + Math.floor(rd() * 3), tcol = col(), pts = [], spread = radius * 0.11;
      const tan1 = new THREE.Vector3().crossVectors(cd, new THREE.Vector3(0, 1, 0)).normalize(), tan2 = new THREE.Vector3().crossVectors(cd, tan1);
      for (let k = 0; k < n; k++) { const p = place(cd, cdist).addScaledVector(tan1, (rd() - 0.5) * spread * 2.4).addScaledVector(tan2, (rd() - 0.5) * spread * 1.6); pts.push(p); push(p, facing(p, C.clone(), rd() * 6), (6 + rd() * 8) * size * (radius / 330), tcol.clone().lerp(col(), 0.3), type(), 0.5); }
      for (let k = 1; k < n; k++) conLines.push(pts[k - 1], pts[k]); if (n > 4) conLines.push(pts[n - 1], pts[1]);
    }
    list.conLines = conLines;
    // el resto: gigantes lejanos y pequeños, repartidos por la cáscara (algo más densos hacia arriba)
    let guard = 0;
    while (list.length < count && guard++ < count * 30) {
      const d = rdir(); if (d.y < -0.35 && rd() < 0.85) continue;
      const big = rd() < 0.26, dist = big ? radius * (0.8 + rd() * 0.2) : minR + (radius - minR) * Math.pow(rd(), 0.8);
      const p = place(d, dist); if (!okY(p)) continue;
      const s = (big ? 38 + rd() * 62 : 6 + rd() * 20) * size * (radius / 330);
      push(p, facing(p, C.clone(), rd() * 6.28), s, col(), type(), big ? 0.25 : 0.7);
    }
  }

  // — malla instanciada única
  const geo = new THREE.PlaneGeometry(2.4, 1.6); geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  const n = list.length;
  geo.setAttribute('aType', new THREE.InstancedBufferAttribute(new Float32Array(list.map((e) => e.type)), 1));
  geo.setAttribute('aPh', new THREE.InstancedBufferAttribute(new Float32Array(list.map((e) => e.ph)), 1));
  const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.frustumCulled = false; mesh.renderOrder = -5;
  const one = new THREE.Vector3(), qq = new THREE.Quaternion(), camQ = new THREE.Quaternion();
  list.forEach((e, i) => { mesh.setColorAt(i, e.col); });
  const write = () => {
    for (let i = 0; i < n; i++) { const e = list[i]; mtx.compose(e.pos, e.quat, one.setScalar(e.s)); mesh.setMatrixAt(i, mtx); }
    mesh.instanceMatrix.needsUpdate = true;
  };
  write(); mesh.instanceColor.needsUpdate = true;
  root.add(mesh);

  let lines = null;
  if (list.conLines && list.conLines.length && q.decor) {
    const lg = new THREE.BufferGeometry().setFromPoints(list.conLines);
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x9fb0ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    lines.frustumCulled = false; lines.renderOrder = -6; root.add(lines);
  }

  // — update: los ojos del cielo giran el cuerpo hacia la cámara, cada uno a su ritmo (la pupila ya sigue sola en el shader)
  const movers = list.map((e, i) => (e.follow > 0 ? i : -1)).filter((i) => i >= 0);
  let acc = 0;
  const update = (dt) => {
    if (!movers.length) return;
    acc += dt; if (acc < 1 / 20) return; const k = acc; acc = 0;   // 20 Hz basta: son ojos lejanos
    for (const i of movers) {
      const e = list[i]; mtx.lookAt(r.camera.position, e.pos, up.set(0, 1, 0)); camQ.setFromRotationMatrix(mtx);
      e.cur = e.cur || e.quat.clone(); const target = qq.copy(e.quat).slerp(camQ, e.follow);
      e.cur.slerp(target, Math.min(1, k * 0.8)); mtx.compose(e.pos, e.cur, one.setScalar(e.s)); mesh.setMatrixAt(i, mtx);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  if (r.dyn) r.dyn.push(update);
  return { mesh, lines, update, count: n, dispose() { mesh.geometry.dispose(); mat.dispose(); root.remove(mesh); if (lines) { lines.geometry.dispose(); lines.material.dispose(); root.remove(lines); } } };
}
