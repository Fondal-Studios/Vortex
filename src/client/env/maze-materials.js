import * as THREE from 'three';
import { uTime, finish } from '../shaders.js';
import { NOISE } from './glsl.js';
import { ZONES, RUNES } from './maze-glsl.js';

// Materiales (shaders) del Mapa 3 · Laberinto Celestial. Todos escriben color "de pantalla" y pasan por finish().
// Uniformes compartidos: uTime (reloj), uBake/uPass (mapas horneados del laberinto), uSunL (dirección del sol).

export const HAZE_D = 0.000042; // densidad de la bruma lejana

export function sharedUniforms({ bake, pass, sunL }) {
  return { uTime, uBake: { value: bake }, uPass: { value: pass }, uSunL: { value: sunL.clone() } };
}

/* ───────── suelo: baldosas con curvas tipo laberinto, caminos con runas que laten hacia el centro, mandala central ───────── */
export function floorMaterial(U, { full = true } = {}) {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: full ? 3 : 2, FULL: full ? 1 : 0 },
    uniforms: { ...U },
    vertexShader: `varying vec3 vWP; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform sampler2D uBake, uPass; uniform vec3 uSunL; varying vec3 vWP; varying vec3 vN;
      ${NOISE} ${ZONES} ${RUNES}
      const float TAU = 6.2831853;
      vec3 bk(vec2 p){ return texture2D(uBake, (p + 80.0) / 160.0).rgb; }
      float ln(float d, float w, float aa){ return 1.0 - smoothstep(w, w + aa, d); }
      void main(){
        vec3 V = cameraPosition - vWP; float dist = length(V); V /= dist;
        vec3 n = normalize(vN); vec2 p = vWP.xz; float t = uTime;
        vec3 zc = zoneCol(p);
        vec3 col;
        if (n.y > 0.5) {
          vec3 b = bk(p); float wd = b.r * 8.0, sunV = b.g, opn = b.b;
          float aa = max(length(fwidth(p)) * 1.3, 0.01);
          // — baldosas de 4×4 con juntas biseladas y arcos de laberinto (truchet) tallados
          vec2 tp = (p + 72.0) / 4.0, ti = floor(tp), tf = fract(tp); float th = hash21(ti);
          vec2 sd = min(tf, 1.0 - tf) * 4.0; float seam = ln(min(sd.x, sd.y), 0.03, 0.05 + aa);
          vec2 tg = th > 0.5 ? vec2(1.0 - tf.x, tf.y) : tf;
          float arc = min(abs(length(tg) - 0.5), abs(length(tg - 1.0) - 0.5)) * 4.0;
          float groove = ln(arc, 0.07, 0.04 + aa);
          vec3 alb = vec3(0.050, 0.042, 0.105) * (0.75 + 0.5 * th) + zc * 0.018;
          alb *= 0.85 + 0.3 * vnoise(vec3(p * 0.9, 1.0));
          alb = mix(alb, vec3(0.012, 0.010, 0.03), seam * 0.8 + groove * 0.5);
          vec3 emi = zc * groove * (0.14 + 0.10 * sin(t * 0.9 + th * TAU)) * 0.9 + zc * seam * 0.05;
          // — caminos abiertos: líneas de luz entre centros de celda, con pulsos que viajan hacia el centro
          vec2 cp = (p + 72.0) / 16.0, ci = floor(cp), q = (cp - ci - 0.5) * 16.0;
          bool inside = ci.x >= 0.0 && ci.y >= 0.0 && ci.x < 9.0 && ci.y < 9.0;
          float cd = max(abs(p.x), abs(p.y));
          if (inside && cd > 24.0) {
            vec4 me = texture2D(uPass, (ci + 0.5) / 9.0), wn = texture2D(uPass, (ci + vec2(-0.5, 0.5)) / 9.0), nn = texture2D(uPass, (ci + vec2(0.5, -0.5)) / 9.0);
            float dl = 99.0;
            if (me.r > 0.5) dl = min(dl, segd(q, vec2(0.0), vec2(8.0, 0.0)));
            if (wn.r > 0.5 && ci.x > 0.0) dl = min(dl, segd(q, vec2(0.0), vec2(-8.0, 0.0)));
            if (me.g > 0.5) dl = min(dl, segd(q, vec2(0.0), vec2(0.0, 8.0)));
            if (nn.g > 0.5 && ci.y > 0.0) dl = min(dl, segd(q, vec2(0.0), vec2(0.0, -8.0)));
            float pulse = pow(0.5 + 0.5 * sin(cd * 0.42 + t * 1.7), 4.0);
            float core = ln(dl, 0.09, 0.05 + aa), halo = exp(-dl * 1.5) * 0.35;
            float ch = 0.5 + 0.5 * sin((q.x + q.y) * 1.3 - t * 0.0);
            emi += zc * (core * (0.55 + 1.6 * pulse) + halo * (0.18 + 0.5 * pulse)) * (0.7 + 0.3 * ch);
            alb = mix(alb, alb * 0.5, core);
            // nodo en el centro de la celda: anillo + runa + puntas
            float nr = length(q), na = atan(q.y, q.x);
            float ring = ln(abs(nr - 1.9), 0.06, 0.04 + aa) + ln(abs(nr - 2.5), 0.03, 0.04 + aa) * 0.7;
            float ticks = ln(abs(fract(na / TAU * 16.0 + t * 0.03) - 0.5) * nr * TAU / 16.0, 0.05, 0.03 + aa) * step(2.7, nr) * step(nr, 3.2);
            float rn = rune(q / 3.4 + 0.5, hash21(ci * 3.7 + 1.0), 0.04, 0.03 + aa * 0.6) * step(abs(q.x), 1.7) * step(abs(q.y), 1.7);
            float blink = 0.65 + 0.35 * sin(t * 1.3 + hash21(ci) * TAU);
            emi += zc * (ring * 0.9 + ticks * 0.7 + rn * 1.4) * blink;
            emi += zc * exp(-nr * 0.9) * 0.16;
          }
          // — plaza central: gran sello / mandala
          if (cd < 24.0) {
            float r = length(p), a = atan(p.y, p.x), a1 = a + t * 0.05, a2 = a - t * 0.035;
            vec3 gold = vec3(1.0, 0.82, 0.50), vio = C_VIO, pk = vec3(1.0, 0.45, 0.85);
            float m = 0.0, m2 = 0.0, m3 = 0.0;
            m += ln(abs(r - 22.0), 0.22, 0.05 + aa) + ln(abs(r - 21.2), 0.05, 0.04 + aa) * 0.8;
            m += ln(abs(r - 16.5), 0.12, 0.05 + aa) + ln(abs(r - 7.3), 0.1, 0.05 + aa) + ln(abs(r - 3.6), 0.14, 0.05 + aa);
            m2 += ln(abs(r - (12.0 + 2.2 * cos(6.0 * a1))), 0.09, 0.05 + aa * 1.5) * step(r, 15.0) * step(8.5, r);
            m2 += ln(abs(r - (5.4 + 1.6 * pow(abs(cos(4.0 * a2)), 1.5))), 0.08, 0.05 + aa * 1.5);
            m3 += ln(abs(fract(a1 / TAU * 24.0) - 0.5) * r * TAU / 24.0, 0.07, 0.04 + aa) * step(16.8, r) * step(r, 21.0) * (0.4 + 0.6 * step(0.5, fract(r * 0.8)));
            m3 += ln(abs(fract(a2 / TAU * 12.0) - 0.5) * r * TAU / 12.0, 0.05, 0.04 + aa) * step(3.9, r) * step(r, 7.0);
            vec2 gq = vec2(fract(a / TAU * 36.0), (r - 17.2) / 3.6); float gh = hash21(vec2(floor(a / TAU * 36.0), 4.0));
            float gl = rune(gq, gh, 0.07, 0.05 + aa * 0.5) * step(0.0, gq.y) * step(gq.y, 1.0) * step(17.2, r) * step(r, 20.8);
            float swirl = (0.5 + 0.5 * sin(a * 8.0 + r * 2.6 - t * 1.8)) * smoothstep(3.5, 0.5, r);
            float lit = 0.65 + 0.35 * sin(t * 0.8 - r * 0.5);
            vec3 mc = mix(vio, gold, smoothstep(24.0, 2.0, r));
            emi += mc * (m * 1.3 + m2 * 1.0 + gl * 1.2) * lit + pk * m3 * 0.8 * lit + gold * swirl * 1.2 + gold * exp(-r * 0.35) * 0.30;
            emi += vio * 0.05 * smoothstep(23.0, 4.0, r);
            alb = mix(alb, vec3(0.02, 0.016, 0.05), (m + m2 + m3) * 0.6);
          }
          // — borde de la losa: línea de luz y marcas
          float eb = max(abs(p.x), abs(p.y));
          float edge = ln(abs(eb - 73.2), 0.10, 0.05 + aa) + ln(abs(eb - 72.55), 0.03, 0.04 + aa) * 0.6;
          emi += zc * edge * (0.9 + 0.5 * sin(t * 1.5 + dot(p, vec2(0.2, 0.15))));
          // — iluminación: ambiente frío + sol con sombras horneadas + reflejo pulido
          float ao = mix(0.5, 1.0, smoothstep(0.0, 5.5, wd)) * (0.65 + 0.35 * opn);
          float ndl = max(dot(n, uSunL), 0.0);
          vec3 R = reflect(-V, n);
          float fr = pow(1.0 - max(dot(n, V), 0.0), 4.0);
          vec3 sky = mix(vec3(0.10, 0.07, 0.24), vec3(0.34, 0.30, 0.72), clamp(R.y, 0.0, 1.0)) + zc * 0.12;
          vec3 amb = vec3(0.30, 0.26, 0.62) * ao;
          col = alb * (amb * 1.5 + vec3(1.0, 0.80, 0.62) * ndl * sunV * 2.6);
          col += sky * (0.07 + 0.55 * fr) * ao;
          col += vec3(1.0, 0.85, 0.7) * pow(max(dot(R, uSunL), 0.0), 60.0) * sunV * 0.7;
          col += emi * (0.75 + 0.25 * ao);
          col += zc * (1.0 - smoothstep(0.0, 3.2, wd)) * 0.10 * (0.7 + 0.3 * sin(t * 0.7 + p.x * 0.1)); // la base de los muros derrama luz
          // bruma baja pegada al suelo, más densa lejos
          col = mix(col, zc * 0.22 + vec3(0.04, 0.03, 0.08), (1.0 - exp(-dist * 0.012)) * 0.28);
        } else {
          // costados y panza: roca cristalina con vetas de luz que caen
          float yy = vWP.y;
          vec3 pp = vWP * vec3(0.5, 0.35, 0.5);
          float w = vnoise(pp * 0.6) * 3.0, st = abs(sin(yy * 1.7 + w));
          float cr = fbm(pp * 1.7 + 3.0);
          vec3 alb = mix(vec3(0.045, 0.035, 0.10), vec3(0.11, 0.06, 0.17), st) * (0.5 + cr);
          float vn = abs(vnoise(vWP * 0.33 + vec3(0.0, -t * 0.25, 0.0)) - 0.5) * 2.0;
          float vein = 1.0 - smoothstep(0.0, 0.09, vn);
          float fade = smoothstep(-34.0, -1.0, yy);
          vec3 emi = zc * vein * (0.6 + 0.6 * sin(t * 1.4 + yy * 0.5)) * fade * 1.2;
          float ndl = max(dot(n, uSunL), 0.0);
          col = alb * (vec3(0.4, 0.34, 0.7) + vec3(1.0, 0.8, 0.6) * ndl * 1.4) + emi;
          float fr = pow(1.0 - max(dot(n, V), 0.0), 3.0);
          col += zc * fr * 0.18;
          col = mix(col, zoneCol(p) * 0.06 + vec3(0.03, 0.02, 0.08), smoothstep(-8.0, -48.0, yy)); // se pierde en la niebla del vacío
        }
        col = mix(col, hazeCol(-V), 1.0 - exp(-dist * dist * ${HAZE_D.toFixed(7)}));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}

/* ───────── muros: cristal facetado e iridiscente, bordes luminosos, vetas internas que fluyen, glifos ───────── */
export function wallMaterial(U, { full = true } = {}) {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: 2, FULL: full ? 1 : 0 },
    uniforms: { ...U },
    vertexShader: `varying vec3 vWP; varying vec3 vN; varying vec3 vLoc; varying vec3 vSize;
      void main(){
        vec3 sc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vSize = sc; vLoc = position * sc; vN = normal;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vWP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform sampler2D uBake; uniform vec3 uSunL; varying vec3 vWP; varying vec3 vN; varying vec3 vLoc; varying vec3 vSize;
      ${NOISE} ${ZONES} ${RUNES}
      const float TAU = 6.2831853;
      void main(){
        vec3 V = cameraPosition - vWP; float dist = length(V); V /= dist;
        vec3 n0 = normalize(vN); float t = uTime;
        vec3 zc = zoneCol(vWP.xz);
        bool side = abs(n0.y) < 0.5, top = n0.y > 0.5;
        vec2 uv = side ? vec2(dot(vWP.xz, vec2(-n0.z, n0.x)), vWP.y) : vWP.xz;
        vec3 T = side ? vec3(-n0.z, 0.0, n0.x) : vec3(1.0, 0.0, 0.0), B = side ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
        float aaU = max(length(fwidth(uv)), 0.002);
        // facetas triangulares
        vec2 fq = mat2(0.8, -0.6, 0.6, 0.8) * uv / 2.7; vec2 fid = floor(fq), ff = fract(fq);
        float tri = step(ff.y, ff.x);
        vec3 jt = hash33(vec3(fid, tri * 7.0 + 1.0)) - 0.5;
        float fh = jt.z + 0.5;
        vec3 n = normalize(n0 + (T * jt.x + B * jt.y) * 0.95);
        float fe = min(min(ff.x, 1.0 - ff.x), min(ff.y, 1.0 - ff.y)); fe = min(fe, abs(ff.x - ff.y) * 0.7);
        float faa = max(length(fwidth(fq)), 0.002);
        float facetLine = 1.0 - smoothstep(0.0, 0.025 + faa, fe);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        vec3 irid = 0.5 + 0.5 * cos(TAU * (vec3(0.0, 0.33, 0.67) + dot(n, V) * 1.1 + fh * 0.5 + t * 0.02 + vWP.y * 0.02));
        // cuerpo oscuro con tinte de zona + vetas internas en dos capas (la segunda con paralaje = profundidad)
        vec3 body = zc * 0.07 + irid * 0.05;
        float foot = exp(-vWP.y * 0.22);
        float v1 = abs(vnoise(vWP * 0.17 + vec3(0.0, -t * 0.20, 0.0)) - 0.5) * 2.0;
        float vein = 1.0 - smoothstep(0.0, 0.11, v1);
        #if FULL
          vec3 p2 = (vWP - V * 2.2) * 0.12 + vec3(7.0, -t * 0.13, 3.0);
          float v2 = abs(vnoise(p2) - 0.5) * 2.0; vein += (1.0 - smoothstep(0.0, 0.14, v2)) * 0.6;
        #endif
        float fl = 0.55 + 0.45 * sin(t * 1.3 + vnoise(vWP * 0.2) * TAU);
        vec3 veinC = mix(zc, irid, 0.35);
        vec3 col = body + veinC * vein * fl * 0.85 + zc * foot * 0.22;
        // luz del sol (sombra aproximada con el suelo al pie del muro) y destellos
        float sunF = mix(texture2D(uBake, (vWP.xz + n0.xz * 1.6 + 80.0) / 160.0).g, 1.0, smoothstep(2.0, 12.0, vWP.y));
        float ndl = max(dot(n, uSunL), 0.0);
        col += (vec3(0.07, 0.06, 0.16) + mix(vec3(0.8, 0.6, 0.5), irid, 0.5) * ndl * sunF * 0.55) * (0.5 + 0.5 * fh);
        vec3 R = reflect(-V, n);
        vec3 sky = mix(vec3(0.08, 0.05, 0.2), vec3(0.45, 0.4, 0.95), clamp(R.y * 0.5 + 0.5, 0.0, 1.0));
        col += sky * fres * 0.75 + irid * fres * 0.35;
        col += vec3(1.0, 0.9, 0.85) * pow(max(dot(R, uSunL), 0.0), 40.0) * sunF * 1.3;
        col += zc * facetLine * 0.16 * (0.4 + 0.6 * fh);
        // vetas de brillo propio en cada faceta (destellan al azar)
        col += irid * pow(max(sin(t * 0.8 + fh * 60.0), 0.0), 18.0) * 0.45 * step(0.6, fh);
        if (side) {
          // franjas de adorno y glifos en dos hileras
          float trim = (1.0 - smoothstep(0.0, 0.05 + aaU, abs(uv.y - 1.1) - 0.04)) + (1.0 - smoothstep(0.0, 0.05 + aaU, abs(uv.y - 10.6) - 0.04));
          col += zc * trim * 0.9;
          vec2 gc = vec2(uv.x / 3.4, (uv.y - 3.6) / 3.2); vec2 gid = floor(gc), gf = fract(gc);
          float gh = hash21(gid * 1.37 + vec2(n0.x * 5.1 + n0.z * 9.7, vSize.x * 0.013 + vSize.z * 0.017));
          if (gid.y >= 0.0 && gid.y < 2.0 && gh > 0.58) {
            vec2 gq = (gf - 0.5) * 1.35 + 0.5;
            float g = rune(gq, hash21(gid + gh * 31.0), 0.045, 0.035 + faa);
            float pl = 0.6 + 0.4 * sin(t * 1.4 + gh * 40.0);
            col += mix(zc, vec3(1.0), 0.25) * g * pl * 1.5;
            col += zc * 0.06 * pl;
          }
        }
        if (top) { // coronación: filo central de luz con trazos que corren
          vec2 lc = vSize.x < vSize.z ? vec2(vLoc.x, vLoc.z) : vec2(vLoc.z, vLoc.x);
          float cl = 1.0 - smoothstep(0.0, 0.2, abs(lc.x));
          float dash = smoothstep(0.35, 0.65, sin(lc.y * 1.6 - t * 1.4) * 0.5 + 0.5);
          col += mix(zc, vec3(1.0), 0.4) * cl * (0.6 + 0.8 * dash) * 1.3;
        }
        // aristas luminosas (distancia a la arista más cercana de esta cara)
        vec3 hs = vSize * 0.5, qd = hs - abs(vLoc) + abs(n0) * 99.0;
        float ed = min(qd.x, min(qd.y, qd.z));
        float edgeW = 0.07 + dist * 0.0006;
        col += mix(zc, vec3(1.0), 0.55) * (1.0 - smoothstep(0.0, edgeW + 0.02, ed)) * 1.7;
        col += zc * exp(-ed * 6.0) * 0.20;
        // resplandor de la base y bruma baja
        col = mix(col, zc * 0.25 + vec3(0.05, 0.04, 0.10), exp(-vWP.y * 0.45) * 0.30);
        col = mix(col, hazeCol(-V), 1.0 - exp(-dist * dist * ${HAZE_D.toFixed(7)}));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}
