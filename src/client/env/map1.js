import * as THREE from 'three';
import { cfg } from '../quality.js';
import { skyMaterial, crystalMaterial, groundMaterial, shellMaterial, zoneMaterial } from '../shaders.js';
import { addMotes } from './common.js';

// Entorno del Mapa 1 · Vacío de Islas. `r` es el Renderer (r.mapRoot, r.shared(), r.dyn, r.sun, r.halo, r.camera…).
export function buildMap1(r, map) {
  const root = r.mapRoot;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1200, 32, 16), skyMaterial({ hue: 0.0, speed: 0.04, iters: cfg().skyIters })); sky.renderOrder = -10; root.add(sky); r.sky = sky;
  // islas: disco con relieve + cono inferior (o superior si cuelga)
  const rock = (r, th, hang, seed) => { // cilindro + cono de roca con ruido (relieve de acantilado y estalactitas)
    const g = new THREE.CylinderGeometry(r, r * 0.9, th, cfg().decor ? 48 : 24, cfg().decor ? 5 : 2, true); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * 0.9 + seed) * Math.cos(z * 0.8 - seed) * 0.5 + Math.sin(y * 1.7 + x * 0.3) * 0.25; const k = 1 + n * 0.07 * (1 - Math.abs(y) / (th / 2 + 0.01) * 0.2); p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, y + n * 0.12); }
    g.computeVertexNormals(); return g;
  };
  const spire = (r, depth, seed) => { // cono de roca irregular (isla colgante)
    const g = new THREE.ConeGeometry(r * 0.92, depth, cfg().decor ? 14 : 7, cfg().decor ? 6 : 2, true); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * 1.3 + seed + y * 0.5) * Math.cos(z * 1.1 - seed) * 0.5 + 0.0; const k = 1 + n * 0.22; p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, y + n * 0.8); }
    g.computeVertexNormals(); return g;
  };
  const crystalMat = (k) => r.shared('isl' + k, () => crystalMaterial(new THREE.Color().setHSL((k * 0.17 + 0.5) % 1, 0.85, 0.6), { glow: 0.5 }));
  map.islands.forEach((is, k) => {
    const mat = groundMaterial(k * 0.17, new THREE.Vector3(is.x, 0, is.z));
    const th = is.top - is.y0, body = new THREE.Mesh(rock(is.r, th, is.hang, k * 3.1), mat);
    body.position.set(is.x, (is.top + is.y0) / 2, is.z); root.add(body);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(is.r, cfg().decor ? 48 : 24), mat); cap.rotation.x = is.hang ? Math.PI / 2 : -Math.PI / 2; cap.position.set(is.x, is.hang ? is.y0 + 0.01 : is.top, is.z); root.add(cap);
    const depth = is.r * 1.5, cone = new THREE.Mesh(spire(is.r, depth, k * 1.7), mat);
    if (is.hang) { cone.position.set(is.x, is.top + depth / 2, is.z); } else { cone.rotation.x = Math.PI; cone.position.set(is.x, is.y0 - depth / 2, is.z); }
    root.add(cone);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(is.r, 0.18, 6, 64), zoneMaterial(new THREE.Color().setHSL((k * 0.17) % 1, 1, 0.6), 0));
    rim.rotation.x = Math.PI / 2; rim.position.set(is.x, is.hang ? is.y0 : is.top, is.z); root.add(rim);
    if (cfg().decor) { // racimos de cristal y hongos bioluminiscentes en el borde de la isla
      const geoC = r.shared('cg', () => { const c = new THREE.ConeGeometry(1, 2, 6); c.translate(0, 1, 0); return c; }), geoM = r.shared('mg', () => new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2));
      const mushM = r.shared('mush' + k, () => new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((k * 0.17 + 0.1) % 1, 1, 0.65) }));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + k, rr = is.r * (0.78 + 0.18 * Math.sin(i * 3.7 + k)), sgn = is.hang ? -1 : 1, y0 = is.hang ? is.y0 : is.top;
        const px = is.x + Math.cos(a) * rr, pz = is.z + Math.sin(a) * rr;
        const cl = new THREE.Group(); for (let j = 0; j < 3; j++) { const c = new THREE.Mesh(geoC, crystalMat(k)); const h = 1.2 + ((i * 7 + j * 3) % 5) * 0.45; c.scale.set(0.28, h, 0.28); c.rotation.set(Math.sin(j * 2 + i) * 0.35, 0, Math.cos(j * 2 + i) * 0.35); c.position.set(Math.cos(j * 2.1) * 0.35, 0, Math.sin(j * 2.1) * 0.35); cl.add(c); }
        cl.position.set(px, y0, pz); cl.scale.y = sgn; root.add(cl);
        const m = new THREE.Mesh(geoM, mushM); m.scale.set(0.5, 0.4, 0.5); m.position.set(is.x + Math.cos(a + 0.35) * rr * 0.97, y0, is.z + Math.sin(a + 0.35) * rr * 0.97); m.scale.y *= sgn; root.add(m);
      }
    }
  });
  // planetoide
  for (const s of map.solids) if (s.type === 'sph') {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s.r, 2), groundMaterial(0.55, s.c)); m.position.set(s.c.x, s.c.y, s.c.z); root.add(m);
    r.dyn.push((dt) => { m.rotation.y += dt * 0.05; });
  }
  // zonas
  for (const z of map.zones) {
    let m;
    if (z.kind === 'flip') { const h = z.y1 - z.y0; m = new THREE.Mesh(new THREE.CylinderGeometry(z.r, z.r, h, 24, 1, true), zoneMaterial(0x66ffcc, 1)); m.position.set(z.c.x, z.y0 + h / 2, z.c.z); }
    else { m = new THREE.Mesh(new THREE.SphereGeometry(z.r, 28, 18), zoneMaterial(z.kind === 'zero' ? 0xc7a0ff : z.kind === 'well' ? 0x6aa0ff : 0xffb347, 2)); m.position.set(z.c.x, z.c.y, z.c.z); }
    root.add(m);
  }
  // portales
  for (const po of map.portals) for (const end of [po.a, po.b]) {
    const col = new THREE.Color().setHSL(po.hue, 1, 0.6), g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(po.r * 0.85, 0.16, 8, 32), zoneMaterial(col, 0)), disc = new THREE.Mesh(new THREE.CircleGeometry(po.r * 0.8, 24), zoneMaterial(col, 2));
    g.add(ring, disc); g.position.set(end.x, end.y + 1, end.z); g.rotation.y = Math.atan2(end.x, end.z); root.add(g);
    r.dyn.push((dt, t) => { ring.rotation.z = t * 1.5; disc.rotation.z = -t * 2; });
  }
  { // sol lejano: fuente de brillo para el bloom
    const sun = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff0d0 })); sun.position.set(380, 300, -700); root.add(sun);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: r.halo, color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); halo.scale.setScalar(520); halo.position.copy(sun.position); root.add(halo);
    r.sun.position.copy(sun.position).normalize();
  }
  addMotes(r, root, 220, 38);
  if (!cfg().decor) return;
  // escalas imposibles: formas gigantes, simples, lejanas
  const far = [[0x7d5cff, 'ring'], [0xff5ca8, 'ico'], [0x35e0c2, 'oct'], [0xffc14d, 'ring'], [0x5cb8ff, 'ico']];
  far.forEach(([c, kind], i) => {
    const a = i * 1.26 + 0.4, d = 720 + (i % 2) * 120, m = crystalMaterial(c, { alpha: 0.9 });
    const geo = kind === 'ring' ? new THREE.TorusGeometry(190, 12, 8, 40) : kind === 'ico' ? new THREE.IcosahedronGeometry(130, 0) : new THREE.OctahedronGeometry(150, 0);
    const o = new THREE.Mesh(geo, m); o.position.set(Math.cos(a) * d, (i - 2) * 90 + 60, Math.sin(a) * d); root.add(o);
    r.dyn.push((dt) => { o.rotation.x += dt * 0.04 * (i + 1); o.rotation.y += dt * 0.03; });
  });
  for (let i = 0; i < 40; i++) { // rocas cristalinas flotantes (decoración)
    const a = i * 2.399, d = 90 + (i % 7) * 22, o = new THREE.Mesh(new THREE.OctahedronGeometry(1.5 + (i % 5), 0), crystalMaterial(new THREE.Color().setHSL((i * 0.07) % 1, 0.8, 0.6)));
    o.position.set(Math.cos(a) * d, ((i * 37) % 120) - 60, Math.sin(a) * d); o.scale.y = 1.6; root.add(o);
    r.dyn.push((dt, t) => { o.rotation.y += dt * 0.3; o.position.y += Math.sin(t + i) * dt * 0.8; });
  }
}
