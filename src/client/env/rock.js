import * as THREE from 'three';
import { uTime, finish } from '../shaders.js';
import { NOISE, BUMP, HAZE, SURF } from './glsl.js';
import { dc } from './props.js';

// Materiales de roca de las islas (y escombros). Dos caminos:
//  · rockPBR  (Media/Alta): MeshStandardMaterial + shader inyectado → recibe luces, reflejos del entorno y sombras.
//  · rockLite (Baja): ShaderMaterial con luz falsa, sin PBR, muy barato.
// Con `attr` el color de acento y el centro de cada isla vienen por atributos (todas las islas en UNA malla).

const lin = (c) => new THREE.Color(c).convertSRGBToLinear();

export function rockPBR({ envMap = null, attr = true, accent = 0x66ffe0, haze = 0x2a2060, hazeDens = 0.0000028, octaves = 4, bump = 0.22, metal = 0.05 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: metal, envMap, envMapIntensity: 0.22 }); // envMap propio: así envMapIntensity sí cuenta (scene.environment usa otra escala)
  const uni = { uTime, uAccent: { value: new THREE.Color(accent) }, uHaze: { value: lin(haze) }, uHazeD: { value: hazeDens }, uBump: { value: bump } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vWN;
        ${attr ? 'attribute vec3 aAcc; attribute vec4 aIsl; varying vec3 vAcc; varying vec4 vIsl;' : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 wp4 = vec4(transformed, 1.0); vec3 on = objectNormal;
          #ifdef USE_INSTANCING
            wp4 = instanceMatrix * wp4; on = mat3(instanceMatrix) * on;
          #endif
          vWP = (modelMatrix * wp4).xyz; vWN = normalize(mat3(modelMatrix) * on);
          ${attr ? 'vAcc = aAcc; vIsl = aIsl;' : ''} }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        #define FBM_OCT ${octaves}
        uniform float uTime; uniform vec3 uAccent, uHaze; uniform float uHazeD, uBump;
        varying vec3 vWP; varying vec3 vWN; ${attr ? 'varying vec3 vAcc; varying vec4 vIsl;' : ''}
        ${NOISE} ${BUMP} ${HAZE} ${SURF}`)
      .replace('#include <map_fragment>', `
        vec3 rkEmi; float rkRough, rkH;
        { vec3 acc = ${attr ? 'vAcc' : 'uAccent'}; vec4 isl = ${attr ? 'vIsl' : 'vec4(0.0, 0.0, 1.0, 0.0)'}; vec3 alb;
          surfShade(vWP, normalize(vWN), acc, isl, uTime, alb, rkEmi, rkRough, rkH);
          diffuseColor.rgb = alb; }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rkRough;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n normal = bumpN(normal, -vViewPosition, rkH, uBump);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += rkEmi;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.rgb = hazeMix(gl_FragColor.rgb, length(vViewPosition), uHaze, uHazeD);');
  };
  m.customProgramCacheKey = () => `rockPBR${attr}${octaves}`;
  return m;
}

export function rockLite({ attr = true, accent = 0x66ffe0, haze = 0x2a2060, hazeDens = 0.0000028, sun = [0.4, 1, -0.5] } = {}) {
  return finish(new THREE.ShaderMaterial({
    defines: { FBM_OCT: 2, ATTR: attr ? 1 : 0 },
    uniforms: { uTime, uAccent: { value: dc(accent) }, uHaze: { value: dc(haze) }, uHazeD: { value: hazeDens }, uSun: { value: new THREE.Vector3(...sun).normalize() } },
    vertexShader: `varying vec3 vWP; varying vec3 vWN; varying vec3 vAcc; varying vec4 vIsl;
      #if ATTR
      attribute vec3 aAcc; attribute vec4 aIsl;
      #endif
      void main(){ vec4 p4 = vec4(position, 1.0); vec3 n = normal;
        #ifdef USE_INSTANCING
          p4 = instanceMatrix * p4; n = mat3(instanceMatrix) * n;
        #endif
        vec4 w = modelMatrix * p4; vWP = w.xyz; vWN = normalize(mat3(modelMatrix) * n);
        #if ATTR
        vAcc = aAcc; vIsl = aIsl;
        #else
        vAcc = vec3(1.0); vIsl = vec4(0.0, 0.0, 1.0, 0.0);
        #endif
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime, uHazeD; uniform vec3 uAccent, uHaze, uSun; varying vec3 vWP; varying vec3 vWN; varying vec3 vAcc; varying vec4 vIsl;
      ${NOISE} ${BUMP} ${HAZE} ${SURF}
      void main(){
        vec3 N = normalize(vWN), V = cameraPosition - vWP; float dist = length(V); V /= dist;
        vec3 acc = ATTR == 1 ? vAcc : uAccent, alb, emi; float rough, h;
        surfShade(vWP, N, acc, vIsl, uTime, alb, emi, rough, h);
        N = bumpN(N, vWP, h, 0.10);
        float dif = max(dot(N, uSun), 0.0), hem = N.y * 0.5 + 0.5;
        vec3 amb = mix(vec3(0.10, 0.07, 0.20), vec3(0.32, 0.38, 0.62), hem);
        vec3 H = normalize(uSun + V); float spec = pow(max(dot(N, H), 0.0), mix(60.0, 8.0, rough)) * (1.0 - rough) * 1.2;
        vec3 col = alb * (vec3(1.0, 0.92, 0.82) * dif * 1.7 + amb) + emi + vec3(1.0, 0.95, 0.9) * spec * dif;
        col += acc * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.12;
        col = hazeMix(col, dist, uHaze, uHazeD);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
}
