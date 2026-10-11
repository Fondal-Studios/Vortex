// ARCANUM NPC FACTORY — materiales de alta fidelidad para NPC (piel, ojos, cabello, telas).
// Todo es procedural y compartido: ninguna textura nueva por NPC, NINGUNA draw call extra.
// Los materiales siguen siendo MeshStandardMaterial de three; se les agrega lógica con onBeforeCompile:
//   · Piel: luz «envolvente» por canal (aproximación barata a la dispersión bajo la piel: el rojo entra más en la sombra),
//     rubor en mejillas/nariz/orejas, línea de pestañas, ojeras suaves, poros (mapa normal compartido), zona T más brillante;
//     en Alto/Ultra además un segundo brillo especular más fino y orejas que se iluminan a contraluz.
//   · Ojos: la córnea deja de ser un disco negro opaco (el asset la trae con alfa 0): ahora es una capa transparente que
//     solo suma el reflejo húmedo; el globo se oscurece bajo el párpado y en las comisuras (oclusión del ojo).
//   · Cabello: brillo anisotrópico de dos lóbulos (modelo de Kajiya-Kay) a lo largo de la dirección del mechón,
//     raíces más oscuras (oclusión) y destellos por mechón en Alto/Ultra.
//   · Telas: textura de relieve por tipo de tela (lana, lino, cuero, terciopelo, fieltro, madera, lona, seda) en un
//     arreglo de texturas compartido, costuras punteadas cerca de los bordes, desgaste en bordes y polvo en el ruedo.
// Niveles: tier 0 = Bajo (solo el arreglo de la córnea), 1 = Medio (teléfono: todo lo barato), 2 = Alto/Ultra (todo).
import * as T from 'three';
import { FABRICS } from './library.js';

/** detail (1..4, de npcQuality) → 0 bajo · 1 medio · 2 alto/ultra. */
export const npcTier = (detail) => (detail <= 1 ? 0 : detail === 2 ? 1 : 2);

// Centro de cada ojo en la pose de enlace MakeHuman (coordenadas «rest», sin proporciones del NPC).
const EYE = [0.0307, 1.5733, 0.1323];
const FAB_LIST = Object.values(FABRICS).sort((a, b) => a.id - b.id);
const glslArr = (k) => `float[${FAB_LIST.length}](${FAB_LIST.map((f) => f[k].toFixed(3)).join(', ')})`;

// ------------------------------------------------------------------ texturas procedurales compartidas
function hash2(x, y, s) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const mod = (a, p) => ((a % p) + p) % p;
/** Ruido de valor periódico (período P celdas) → sin costuras al repetir. */
function vnoise(x, y, P, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(mod(xi, P), mod(yi, P), seed), b = hash2(mod(xi + 1, P), mod(yi, P), seed), c = hash2(mod(xi, P), mod(yi + 1, P), seed), d = hash2(mod(xi + 1, P), mod(yi + 1, P), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(u, v, P, seed, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * vnoise(u * P * f, v * P * f, P * f, seed + o); n += a; a *= 0.5; f *= 2; } return s / n; }
/** Worley periódico: [F1, F2] (distancias a los dos puntos más cercanos, en celdas). */
function worley(u, v, P, seed) {
  const x = u * P, y = v * P, xi = Math.floor(x), yi = Math.floor(y); let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, px = cx + hash2(mod(cx, P), mod(cy, P), seed), py = cy + hash2(mod(cx, P), mod(cy, P), seed + 7);
    const d = Math.hypot(px - x, py - y); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2];
}
const TAU = Math.PI * 2, sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Altura (0..1) y variación de rugosidad (0..1, 0,5 = neutra) de cada tela en (u, v) ∈ [0,1). */
const PATTERNS = {
  lana(u, v) { // sarga: diagonales + pelusa de hilo
    const rib = 0.5 + 0.5 * Math.cos(TAU * (u + v) * 12), cross = 0.5 + 0.5 * Math.cos(TAU * (u - v) * 24), fuzz = fbm(u, v, 32, 11, 3);
    return [0.62 * Math.pow(rib, 0.7) + 0.13 * cross + 0.25 * fuzz, 0.5 + 0.3 * (fuzz - 0.5)];
  },
  lino(u, v) { // tafetán con irregularidades («slubs»)
    const N = 16, fx = (u * N) % 1, fy = (v * N) % 1, i = Math.floor(u * N), j = Math.floor(v * N), par = (i + j) & 1;
    const sx = 0.75 + 0.5 * vnoise(i, v * 6, N, 3), sy = 0.75 + 0.5 * vnoise(j, u * 6, N, 5);
    const hw = Math.sin(Math.PI * fx) * (par ? 1 : 0.55) * sx, hf = Math.sin(Math.PI * fy) * (par ? 0.55 : 1) * sy;
    return [Math.min(1, Math.max(hw, hf) * 0.85 + 0.1 * fbm(u, v, 16, 9, 2)), 0.5 + 0.25 * (sx - 1)];
  },
  cuero(u, v) { // grano granulado + pliegues
    const [f1, f2] = worley(u, v, 18, 21), cell = sstep(0.0, 0.16, f2 - f1), crease = fbm(u, v, 4, 23, 3);
    return [0.55 * cell + 0.45 * crease, 0.5 + 0.35 * (0.5 - cell) + 0.2 * (crease - 0.5)];
  },
  terciopelo(u, v) { // pelo corto muy fino, «aplastado» en zonas
    const fine = fbm(u, v, 64, 31, 2), crush = fbm(u, v, 3, 33, 3);
    return [0.25 * fine + 0.75 * crush, 0.5 + 0.2 * (crush - 0.5)];
  },
  fieltro(u, v) { const f = fbm(u, v, 24, 41, 4); return [f, 0.5 + 0.2 * (f - 0.5)]; },
  madera(u, v) { // vetas a lo largo de v
    const w = fbm(u, v, 3, 51, 3), g = 0.5 + 0.5 * Math.sin(TAU * (u * 9 + w * 2.2)), pores = vnoise(u * 96, v * 12, 96, 53);
    return [0.75 * g + 0.25 * pores, 0.5 + 0.3 * (0.5 - g)];
  },
  lona(u, v) { // tela gruesa de trabajo
    const N = 10, fx = (u * N) % 1, fy = (v * N) % 1, par = (Math.floor(u * N) + Math.floor(v * N)) & 1;
    const h = Math.max(Math.sin(Math.PI * fx) * (par ? 1 : 0.6), Math.sin(Math.PI * fy) * (par ? 0.6 : 1));
    return [0.85 * h + 0.15 * fbm(u, v, 20, 61, 2), 0.5];
  },
  seda(u, v) { const l = 0.5 + 0.5 * Math.sin(TAU * (u * 40 + v * 6)), f = fbm(u, v, 8, 71, 3); return [0.25 * l + 0.75 * f, 0.5 + 0.15 * (f - 0.5)]; },
};
/** Empaqueta altura → normal (RG), cavidad (B) y rugosidad (A) para una capa de lado S. */
function bakeLayer(out, offset, S, fn, slope) {
  const H = new Float32Array(S * S), R = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const [h, r] = fn(x / S, y / S); H[y * S + x] = h; R[y * S + x] = r; }
  const at = (x, y) => H[mod(y, S) * S + mod(x, S)], k = slope * S / 64;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let nx = -(at(x + 1, y) - at(x - 1, y)) * k, ny = -(at(x, y + 1) - at(x, y - 1)) * k; const l = Math.hypot(nx, ny, 1); nx /= l; ny /= l;
    const i = offset + (y * S + x) * 4;
    out[i] = Math.round((nx * 0.5 + 0.5) * 255); out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    out[i + 2] = Math.round(Math.min(1, Math.max(0, 0.3 + 0.7 * H[y * S + x])) * 255); out[i + 3] = Math.round(Math.min(1, Math.max(0, R[y * S + x])) * 255);
  }
}
const fabricArrays = new Map();
/** Arreglo de texturas de telas (una capa por tela). S = 128 (Medio) o 256 (Alto/Ultra). Se genera una sola vez. */
export function fabricArray(S) {
  if (!fabricArrays.has(S)) {
    const data = new Uint8Array(S * S * 4 * FAB_LIST.length);
    FAB_LIST.forEach((f, l) => bakeLayer(data, l * S * S * 4, S, PATTERNS[f.patron], f.relieve));
    const t = new T.DataArrayTexture(data, S, S, FAB_LIST.length);
    t.format = T.RGBAFormat; t.type = T.UnsignedByteType; t.colorSpace = T.NoColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = T.LinearFilter; t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4;
    t.needsUpdate = true; t.name = 'npc-telas-' + S; fabricArrays.set(S, t);
  }
  return fabricArrays.get(S);
}
let poreTex = null;
/** Mapa normal de poros y arrugas finas de la piel (256², se repite sobre el UV del cuerpo). */
export function poreTexture() {
  if (poreTex) return poreTex;
  const S = 256, data = new Uint8Array(S * S * 4);
  bakeLayer(data, 0, S, (u, v) => { const [f1] = worley(u, v, 28, 91), pit = sstep(0.0, 0.33, f1), fine = fbm(u, v, 48, 93, 2), wr = fbm(u * 0.5, v * 3, 12, 95, 3);
    return [0.55 * pit + 0.25 * fine + 0.2 * wr, 0.5]; }, 1.4);
  // three lee la normal de RGB: se reemplaza la cavidad (B) por la z de la normal.
  for (let i = 0; i < data.length; i += 4) { const x = data[i] / 127.5 - 1, y = data[i + 1] / 127.5 - 1; data[i + 2] = Math.round((Math.sqrt(Math.max(0, 1 - x * x - y * y)) * 0.5 + 0.5) * 255); data[i + 3] = 255; }
  poreTex = new T.DataTexture(data, S, S, T.RGBAFormat); poreTex.colorSpace = T.NoColorSpace; poreTex.wrapS = poreTex.wrapT = T.RepeatWrapping;
  poreTex.magFilter = T.LinearFilter; poreTex.minFilter = T.LinearMipmapLinearFilter; poreTex.generateMipmaps = true; poreTex.anisotropy = 4; poreTex.needsUpdate = true; poreTex.name = 'npc-poros';
  return poreTex;
}

// ------------------------------------------------------------------ inyección en el shader estándar
const DIRECT_A = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;';
// ADAPTADO a three 0.186 (la línea original usaba diffuseBRDF; ahora es BRDF_Lambert( material.diffuseContribution ))
const DIRECT_B = 'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );';
let warned = false;
/** Copia de lights_physical_pars_fragment con ganchos para piel, cabello y telas (o null si three cambió). */
function patchedLights() {
  const src = T.ShaderChunk.lights_physical_pars_fragment;
  if (!src.includes(DIRECT_A) || !src.includes(DIRECT_B)) {
    if (!warned) { warned = true; console.warn('NPC: el shader de three cambió; se usan materiales NPC sin luz de piel/cabello.'); }
    return null;
  }
  return src.replace(DIRECT_A, `${DIRECT_A}
	vec3 npcDiffIrr = irradiance;
	#ifdef NPC_SKIN
		float npcNL = dot( geometryNormal, directLight.direction );
		npcDiffIrr = saturate( ( vec3( npcNL ) + uNpcWrap ) / ( 1.0 + uNpcWrap ) ) * directLight.color;
		#if NPC_TIER > 1
			float npcBack = pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 3.0 ) * npcThin;
			reflectedLight.directDiffuse += npcBack * directLight.color * vec3( 0.9, 0.24, 0.12 ) * material.diffuseColor * 1.6;
			PhysicalMaterial npcM = material; npcM.roughness = max( material.roughness * 0.5, 0.2 );
			reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, npcM ) * 0.3 * npcGloss;
		#endif
	#endif
	#ifdef NPC_HAIR
	irradiance *= 0.3; // el brillo del pelo lo da el modelo anisotrópico, no el GGX isótropo
	{
		vec3 npcH = normalize( directLight.direction + geometryViewDir );
		vec3 npcT1 = normalize( npcT - geometryNormal * 0.07 );
		float npcC1 = dot( npcT1, npcH );
		float npcAtt = smoothstep( -0.2, 0.4, dot( geometryNormal, directLight.direction ) );
		vec3 npcSp = pow( sqrt( max( 0.0, 1.0 - npcC1 * npcC1 ) ), 160.0 ) * 0.045 * mix( vec3( 1.0 ), normalize( material.diffuseColor + 0.03 ) * 1.5, 0.6 );
		#if NPC_TIER > 1
			vec3 npcT2 = normalize( npcT + geometryNormal * 0.16 );
			float npcC2 = dot( npcT2, npcH );
			npcSp += pow( sqrt( max( 0.0, 1.0 - npcC2 * npcC2 ) ), 28.0 ) * 0.35 * npcSheen * material.diffuseColor;
		#endif
		reflectedLight.directSpecular += directLight.color * npcAtt * npcSp * npcAO;
	}
	#endif`).replace(DIRECT_B, `reflectedLight.directDiffuse += npcDiffIrr * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
	#ifdef NPC_FABRIC
		float npcNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.directDiffuse += npcDiffIrr * material.diffuseColor * npcSheen * pow( 1.0 - npcNV, 3.0 ) * 0.9;
	#endif`);
}

const COMMON_FRAG = `
varying vec3 vNpcP;
float npcThin = 0.0; float npcSheen = 0.0; float npcAO = 1.0; float npcGloss = 1.0; vec3 npcT = vec3( 0.0, 1.0, 0.0 );
float npcBlob( vec3 p, vec3 c, vec3 r ) { vec3 d = ( p - c ) / r; return exp( - dot( d, d ) ); }
`;

function install(material, kind, tier, uniforms, frag) {
  const lights = patchedLights();
  material.defines = { ...(material.defines || {}), NPC_TIER: tier };
  if (lights) material.defines['NPC_' + kind.toUpperCase()] = '';
  // Se encadena con un onBeforeCompile previo (p. ej. el viento de las telas en actor.js).
  const prev = Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile') ? material.onBeforeCompile : null;
  const prevKey = Object.prototype.hasOwnProperty.call(material, 'customProgramCacheKey') ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (s, r) => {
    if (prev) prev(s, r);
    Object.assign(s.uniforms, uniforms);
    let v = s.vertexShader, f = s.fragmentShader;
    v = `varying vec3 vNpcP;\n${kind === 'fabric' ? 'attribute vec2 npcFab;\nvarying vec2 vNpcFab;\nvarying vec3 vNpcN;\n' : ''}${frag.restAttr ? 'attribute vec3 npcRest;\n' : ''}${kind === 'hair' ? 'uniform vec3 uNpcCrown;\nvarying vec3 vNpcDir;\n' : ''}` + v;
    v = v.replace('#include <begin_vertex>', `#include <begin_vertex>
	vNpcP = ${frag.restAttr ? 'npcRest' : 'position'};
	${kind === 'fabric' ? 'vNpcFab = npcFab; vNpcN = normal;' : ''}
	${kind === 'hair' ? `vec3 npcD = position - uNpcCrown;
	#ifdef USE_SKINNING
		npcD = ( skinMatrix * vec4( npcD, 0.0 ) ).xyz;
	#endif
	vNpcDir = normalize( normalMatrix * npcD );` : ''}`);
    f = COMMON_FRAG + (frag.pars || '') + f;
    if (lights) f = f.replace('#include <lights_physical_pars_fragment>', lights);
    for (const [chunk, code] of Object.entries(frag.after || {})) f = f.replace(`#include <${chunk}>`, `#include <${chunk}>\n${code}`);
    for (const [chunk, code] of Object.entries(frag.replace || {})) f = f.replace(`#include <${chunk}>`, code);
    s.vertexShader = v; s.fragmentShader = f;
  };
  material.customProgramCacheKey = () => `${prevKey}|npc-${kind}-${tier}-${lights ? 1 : 0}-${frag.key || ''}`;
  material.userData.npc = kind;
  return material;
}

/** Piel del cuerpo (MakeHuman). Necesita el atributo `npcRest` (posición sin proporciones) en la geometría. */
export function skinMaterial(material, { tier, flush = 1, edad = 'adulto', barba = null, tone = [1.0, 0.95, 0.9] }) {
  const lite = tier === 0; if (lite) tier = 1; // low: luz envolvente + rubor + brillo de borde (sólo cuentas, sin texturas extra)
  if (!lite) { material.normalMap = poreTexture(); material.normalMap.repeat.set(48, 48); const ps = tier > 1 ? 0.12 : 0.08; material.normalScale.set(ps, ps); }
  material.roughness = 0.56;
  const old = edad === 'anciano' ? 1 : 0;
  // Sombra de barba sobre la piel (mismas regiones que buildBeard): la barba se funde con la cara en vez de «pegarse».
  const bz = barba ? new T.Vector4(barba.capas.includes('mejillas') ? 1 : 0, barba.capas.includes('menton') ? 1 : 0, barba.capas.includes('bigote') ? 1 : 0, barba.fuerza ?? 0.55) : new T.Vector4(0, 0, 0, 0);
  const bc = new T.Color(barba?.color || '#000000');
  return install(material, 'skin', tier, { uNpcWrap: { value: new T.Vector3(0.32, 0.15, 0.1) }, uNpcFlush: { value: flush }, uNpcOld: { value: old }, uNpcBeard: { value: bz }, uNpcBeardCol: { value: bc }, uNpcTone: { value: new T.Vector3(...tone) } }, {
    restAttr: true, key: lite ? 'l' : '',
    pars: 'uniform vec3 uNpcWrap; uniform float uNpcFlush; uniform float uNpcOld; uniform vec4 uNpcBeard; uniform vec3 uNpcBeardCol; uniform vec3 uNpcTone;\n',
    after: {
      // brillo de borde subsuperficial: la luz ambiente atraviesa lo fino (orejas, nariz, contorno) y sale rojiza
      opaque_fragment: `
	{ float npcNV = saturate( dot( normal, geometryViewDir ) );
	  float npcSS = pow( 1.0 - npcNV, 3.0 ) * ( 0.16 + 0.7 * npcThin );
	  float npcAmb = dot( reflectedLight.indirectDiffuse + reflectedLight.directDiffuse * 0.25, vec3( 0.3333 ) );
	  gl_FragColor.rgb += diffuseColor.rgb * vec3( 1.0, 0.34, 0.2 ) * npcSS * clamp( npcAmb * 1.5 + 0.06, 0.0, 0.9 ); }`,
      color_fragment: `
	vec3 npcQ = vec3( abs( vNpcP.x ), vNpcP.yz );
	float npcCheek = npcBlob( npcQ, vec3( 0.047, 1.543, 0.124 ), vec3( 0.021, 0.018, 0.03 ) );
	float npcNose = npcBlob( vNpcP, vec3( 0.0, 1.537, 0.163 ), vec3( 0.011, 0.013, 0.014 ) );
	float npcEar = smoothstep( 0.064, 0.078, npcQ.x ) * smoothstep( 1.52, 1.545, vNpcP.y ) * ( 1.0 - smoothstep( 1.625, 1.648, vNpcP.y ) ) * smoothstep( 0.005, 0.03, vNpcP.z ) * ( 1.0 - smoothstep( 0.08, 0.1, vNpcP.z ) );
	float npcLip = npcBlob( npcQ, vec3( 0.0, 1.505, 0.154 ), vec3( 0.022, 0.008, 0.012 ) );
	float npcUnder = npcBlob( npcQ, vec3( 0.031, 1.556, 0.128 ), vec3( 0.014, 0.0055, 0.02 ) );
	vec3 npcE = npcQ - vec3( ${EYE.join(', ')} );
	float npcLid = length( npcE * vec3( 0.85, 1.25, 1.0 ) );
	float npcLash = ( 1.0 - smoothstep( 0.0148, 0.0172, npcLid ) ) * smoothstep( -0.004, 0.008, npcE.z ) * mix( 0.45, 1.0, smoothstep( -0.002, 0.003, npcE.y ) );
	npcThin = npcEar + 0.35 * npcNose;
	diffuseColor.rgb *= uNpcTone;
	float npcJaw = npcBlob( npcQ, vec3( 0.0, 1.462, 0.1 ), vec3( 0.075, 0.03, 0.05 ) );
	diffuseColor.rgb *= 1.0 - 0.42 * npcJaw;
	vec3 npcFlushCol = vec3( 1.0, 0.76, 0.74 );
	diffuseColor.rgb *= mix( vec3( 1.0 ), npcFlushCol, saturate( ( npcCheek * 0.32 + npcNose * 0.38 ) * uNpcFlush + npcEar * 0.3 + npcLip * 0.1 ) );
	diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.84, 0.78, 0.86 ), npcUnder * ( 0.35 + 0.25 * uNpcOld ) );
	diffuseColor.rgb *= 1.0 - 0.62 * npcLash;
	if ( uNpcBeard.w > 0.0 ) {
		float npcY = vNpcP.y, npcZ = vNpcP.z, npcAx = npcQ.x;
		float npcMus = uNpcBeard.z * smoothstep( 1.5, 1.507, npcY ) * ( 1.0 - smoothstep( 1.53, 1.537, npcY ) ) * ( 1.0 - smoothstep( 0.036, 0.044, npcAx ) ) * smoothstep( 0.112, 0.12, npcZ );
		float npcChin = uNpcBeard.y * smoothstep( 1.42, 1.432, npcY ) * ( 1.0 - smoothstep( 1.495, 1.503, npcY ) ) * ( 1.0 - smoothstep( 0.044, 0.052, npcAx ) ) * smoothstep( -0.006, 0.006, npcZ );
		float npcChk = uNpcBeard.x * smoothstep( 1.425, 1.437, npcY ) * ( 1.0 - smoothstep( 1.53, 1.585, npcY ) ) * smoothstep( 0.026, 0.034, npcAx ) * ( 1.0 - smoothstep( 0.084, 0.092, npcAx ) ) * smoothstep( -0.016, -0.006, npcZ ) * ( 1.0 - 0.6 * smoothstep( 1.53, 1.56, npcY ) * smoothstep( 0.07, 0.1, npcZ ) );
		float npcBd = saturate( npcMus + npcChin + npcChk ) * ( 1.0 - npcLip * 0.8 );
		diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * ( 0.45 + 0.55 * uNpcBeardCol ), npcBd * uNpcBeard.w );
	}
	npcGloss = 1.0 + 0.8 * npcNose + 0.6 * npcLip - 0.5 * npcLash;`,
      roughnessmap_fragment: `
	roughnessFactor = clamp( roughnessFactor - 0.14 * npcNose - 0.1 * npcLip - 0.06 * npcBlob( npcQ, vec3( 0.0, 1.63, 0.13 ), vec3( 0.04, 0.03, 0.03 ) ) + 0.1 * uNpcOld + 0.25 * npcLash, 0.28, 1.0 );`,
    },
  });
}

/** Ojos MakeHuman: globo opaco + córnea transparente (solo reflejo). El índice debe dibujar la córnea al final. */
export function eyeMaterial(material, { tier }) {
  material.transparent = true; material.premultipliedAlpha = true; material.depthWrite = true; material.roughness = 0.42;
  material.alphaTest = 0;
  return install(material, 'eye', Math.max(1, tier), {}, {
    restAttr: true, key: 'e',
    after: {
      map_fragment: `
	float npcCornea = step( diffuseColor.a, 0.5 );
	diffuseColor.a = 1.0;
	vec3 npcE = vNpcP - vec3( sign( vNpcP.x ) * ${EYE[0]}, ${EYE[1]}, ${EYE[2]} );
	float npcTop = smoothstep( -0.001, 0.0105, npcE.y ), npcSide = smoothstep( 0.0055, 0.0125, abs( npcE.x ) ), npcBot = smoothstep( -0.004, -0.0115, npcE.y );
	diffuseColor.rgb *= ( 1.0 - 0.6 * npcTop ) * ( 1.0 - 0.45 * npcSide ) * ( 1.0 - 0.25 * npcBot );
	diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.0, 0.86, 0.84 ), npcSide * 0.6 );
	diffuseColor.rgb *= 1.0 - npcCornea;`,
      roughnessmap_fragment: `
	roughnessFactor = mix( roughnessFactor, 0.035, npcCornea );`,
    },
    replace: {
      opaque_fragment: `gl_FragColor = vec4( outgoingLight * mix( 1.0, ( 1.0 - 0.55 * npcTop ), npcCornea ), 1.0 - npcCornea );`,
      premultiplied_alpha_fragment: '',
    },
  });
}

/** Cabello/cejas MakeHuman, recoloreado por luminancia (el tinte elegido pasa a ser el color medio real). */
export function hairMaterial(material, { color, gain, tier, brow = false }) {
  material.color.copy(color);
  const uniforms = { uGain: { value: gain }, uNpcCrown: { value: new T.Vector3(0, 1.69, 0.0) } };
  const recolor = `#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	float npcLum = dot( sampledDiffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );
	diffuseColor.rgb *= 0.5 + 0.5 * clamp( npcLum * uGain, 0.0, 2.0 );
	diffuseColor.a *= sampledDiffuseColor.a;
	npcSheen = smoothstep( 0.9, 1.7, npcLum * uGain );
#endif`;
  if (tier === 0 || brow) {
    material.onBeforeCompile = (s) => { Object.assign(s.uniforms, uniforms); s.fragmentShader = 'uniform float uGain; float npcSheen = 0.0;\n' + s.fragmentShader.replace('#include <map_fragment>', recolor); };
    material.customProgramCacheKey = () => 'npc-recolor';
    return material;
  }
  material.roughness = 0.62;
  return install(material, 'hair', tier, uniforms, {
    key: 'h', pars: 'uniform float uGain; varying vec3 vNpcDir;\n',
    replace: { map_fragment: recolor },
    after: {
      color_fragment: `
	float npcR = length( ( vNpcP - vec3( 0.0, 1.585, 0.03 ) ) * vec3( 1.0, 0.9, 1.0 ) );
	npcAO = mix( 0.42, 1.0, smoothstep( 0.092, 0.128, npcR ) );
	diffuseColor.rgb *= npcAO;`,
      normal_fragment_maps: `
	npcT = normalize( vNpcDir - normal * dot( normal, vNpcDir ) + 1e-4 );`,
    },
  });
}

/** Barba procedural (colores por vértice + textura de mechones): mismo brillo anisotrópico que el cabello. */
export function beardMaterial(material, { tier }) {
  if (tier === 0) return material;
  material.roughness = 0.7;
  return install(material, 'hair', tier, { uNpcCrown: { value: new T.Vector3(0, 1.6, 0.02) } }, {
    key: 'b', pars: 'varying vec3 vNpcDir;\n',
    after: {
      map_fragment: `
	#ifdef USE_MAP
		npcSheen = smoothstep( 0.55, 0.95, sampledDiffuseColor.g );
	#endif`,
      normal_fragment_maps: `
	npcT = normalize( vNpcDir - normal * dot( normal, vNpcDir ) + 1e-4 );`,
    },
  });
}

/**
 * Telas procedurales. mode 'uv' = capas de tela con skinning (UV ≈ 6 unidades por metro), 'tri' = accesorios rígidos
 * (proyección triplanar sobre la posición local), 'garment' = ropa MakeHuman (solo polvo en el ruedo y desgaste).
 * La geometría lleva el atributo `npcFab` = (id de tela, distancia en metros al borde más cercano) salvo en 'garment'.
 */
export function fabricMaterial(material, { tier, mode = 'uv', dirt = 0.5, top = null, bottom = null, gain = 2.4 }) {
  // Prenda MakeHuman con zonas: «arriba» (sudadera, camisa; y > 0,97) y «abajo» (pantalón). Se recolorea por luminancia
  // (conserva los pliegues y las costuras pintadas de la textura) y, desde Medio, suma relieve de trama triplanar.
  const tint = mode === 'garment' && (top || bottom) ? {
    uNpcTop: { value: new T.Color(top || '#ffffff') }, uNpcBot: { value: new T.Color(bottom || '#ffffff') },
    uNpcTopMix: { value: top ? 0.88 : 0 }, uNpcBotMix: { value: bottom ? 0.8 : 0 }, uNpcGain: { value: gain } } : null;
  const tintPars = tint ? 'uniform vec3 uNpcTop; uniform vec3 uNpcBot; uniform float uNpcTopMix; uniform float uNpcBotMix; uniform float uNpcGain;\n' : '';
  const tintCode = tint ? `
	{ float npcTopM = smoothstep( 0.95, 1.05, vNpcP.y );
	  float npcLumA = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) ) * uNpcGain;
	  vec3 npcRecT = mix( diffuseColor.rgb, vec3( npcLumA ) * uNpcTop, uNpcTopMix );
	  vec3 npcRecB = mix( diffuseColor.rgb, vec3( npcLumA ) * uNpcBot, uNpcBotMix );
	  diffuseColor.rgb = mix( npcRecB, npcRecT, npcTopM ); }` : '';
  if (mode === 'garment' && tier === 0) {
    return install(material, 'garment', tier, { uNpcDirt: { value: dirt }, ...(tint || {}) }, {
      key: 'g' + (tint ? 't' : ''), pars: 'uniform float uNpcDirt;\n' + tintPars,
      after: { color_fragment: `${tintCode}
	float npcDirt = ( 1.0 - smoothstep( 0.03, 0.42, vNpcP.y ) ) * uNpcDirt;
	diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.74, 0.68, 0.58 ) + vec3( 0.02, 0.016, 0.01 ), npcDirt );`,
      roughnessmap_fragment: 'roughnessFactor = min( 1.0, roughnessFactor + 0.08 * npcDirt );' },
    });
  }
  if (tier === 0) return material;
  const S = tier > 1 ? 256 : 128;
  // Proyección triplanar sobre la posición de reposo (antes de skinning): densidad de hilo constante en metros,
  // sin depender de los UV de las capas derivadas (que se estiran en mangas y hombros) y pegada a la tela al animar.
  if (mode !== 'garment') material.map = null;
  return install(material, 'fabric', tier, { uNpcFab: { value: fabricArray(S) }, uNpcDirt: { value: dirt }, uNpcBump: { value: mode === 'garment' ? 3.2 : 2.5 }, ...(tint || {}) }, {
    key: mode + (tint ? 't' : ''),
    pars: `precision highp sampler2DArray;
uniform sampler2DArray uNpcFab; uniform float uNpcDirt; uniform float uNpcBump; varying vec2 vNpcFab; varying vec3 vNpcN;
${tintPars}const float NPC_TILE[${FAB_LIST.length}] = ${glslArr('tile')};
const float NPC_NRM[${FAB_LIST.length}] = ${glslArr('normal')};
const float NPC_ROUGH[${FAB_LIST.length}] = ${glslArr('rough')};
const float NPC_SHEEN[${FAB_LIST.length}] = ${glslArr('sheen')};
// Relieve por derivadas de pantalla de la altura (vale para cualquier proyección; no necesita tangentes).
vec3 npcBump( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir ) {
	vec3 vSigmaX = normalize( dFdx( surf_pos ) ); vec3 vSigmaY = normalize( dFdy( surf_pos ) );
	vec3 R1 = cross( vSigmaY, surf_norm ); vec3 R2 = cross( surf_norm, vSigmaX );
	float fDet = dot( vSigmaX, R1 ) * faceDir;
	vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
	return normalize( abs( fDet ) * surf_norm - vGrad );
}
`,
    after: {
      color_fragment: `${tintCode}
	int npcId = int( vNpcFab.x + 0.5 );
	float npcLayer = float( npcId );
	vec3 npcW = pow( abs( normalize( vNpcN ) ), vec3( 4.0 ) ); npcW /= ( npcW.x + npcW.y + npcW.z );
	vec3 npcP = vNpcP / NPC_TILE[ npcId ];
	float npcNear = 1.0 - smoothstep( 0.012, 0.05, length( fwidth( npcP ) ) ); // relieve solo donde el patrón se resuelve
	vec4 npcF = texture( uNpcFab, vec3( npcP.zy, npcLayer ) ) * npcW.x + texture( uNpcFab, vec3( npcP.xz, npcLayer ) ) * npcW.y + texture( uNpcFab, vec3( npcP.xy, npcLayer ) ) * npcW.z;
	diffuseColor.rgb *= mix( 0.62 + 0.76 * 0.62, 0.62 + 0.76 * npcF.b, 0.4 + 0.6 * npcNear );
	npcSheen = NPC_SHEEN[ npcId ];
	float npcDirt = ( 1.0 - smoothstep( 0.03, 0.42, vNpcP.y ) ) * uNpcDirt;
	diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.74, 0.68, 0.58 ) + vec3( 0.02, 0.016, 0.01 ), npcDirt );
	float npcEdge = vNpcFab.y;
	float npcWear = ( 1.0 - smoothstep( 0.0, 0.007, npcEdge ) ) * 0.22;
	diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 1.25 + 0.015, npcWear );
	float npcStitch = ( 1.0 - smoothstep( 0.0007, 0.0016, abs( npcEdge - 0.009 ) ) ) * step( 0.42, fract( ( vNpcP.x + vNpcP.y + vNpcP.z ) * 160.0 ) );
	diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * 1.7 + 0.04, npcStitch * 0.8 );`,
      roughnessmap_fragment: `
	roughnessFactor = clamp( NPC_ROUGH[ npcId ] + ( npcF.a - 0.5 ) * 0.4 + 0.08 * npcDirt - 0.15 * npcStitch, 0.2, 1.0 );`,
      normal_fragment_maps: `
	normal = npcBump( - vViewPosition, normal, vec2( dFdx( npcF.b ), dFdy( npcF.b ) ) * NPC_NRM[ npcId ] * uNpcBump * npcNear, faceDirection );`,
    },
  });
}

/** Reordena el índice de los ojos: primero el globo, después la córnea (transparente). Se cachea en la entrada. */
export function eyeIndex(entry) {
  if (entry.eyeIndex) return entry.eyeIndex;
  const idx = entry.attrs.index.array, uv = entry.attrs.uv.array, globe = [], cornea = [];
  for (let t = 0; t < idx.length; t += 3) {
    let u = 0, v = 0; for (let k = 0; k < 3; k++) { u += uv[idx[t + k] * 2]; v += uv[idx[t + k] * 2 + 1]; }
    (u / 3 > 0.85 && v / 3 < 0.15 ? cornea : globe).push(idx[t], idx[t + 1], idx[t + 2]);
  }
  entry.eyeGlobe = globe.length; // (en calidad baja sólo se dibuja el globo, sin la córnea)
  entry.eyeIndex = new T.BufferAttribute(new Uint32Array([...globe, ...cornea]), 1);
  return entry.eyeIndex;
}
/** Posición sin proporciones del NPC (compartida por todos los NPC que usan la malla). */
export function restAttribute(entry) { return (entry.restAttr ||= new T.BufferAttribute(entry.base, 3)); }

// ====================================================================================================================
// GUANTES Y TATUAJES DE CRISTAL (manos y antebrazos de los avatares de jugador)
//  · tattooMaterial: UN solo ShaderMaterial emisivo y barato con 6 estilos (uno por personaje). Dibuja líneas, runas, venas, circuitos,
//    constelaciones u ojos en coordenadas (x = arco en dm, y = largo desde el codo en dm) con pulso que viaja hacia la mano.
//    El atributo `tKind` elige qué es cada pieza: 0 = tatuaje proyectado (sólo líneas, resto transparente), 1 = placa táctica oscura con
//    el tatuaje encima, 2 = cristal facetado luminoso.
//  · gloveSkin: pinta la piel de las manos (dedos incluidos) como guante táctico oscuro con anillos y yemas luminosas, sin mallas extra.
// ====================================================================================================================
export const TATTOO_STYLES = { egida: 0, lumen: 1, forja: 2, vigia: 3, nova: 4, umbra: 5 };

const TATTOO_GLSL = `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float rng(vec2 p, vec2 c, float r){ return abs(length(p - c) - r); }
float tri(vec2 p, vec2 c, float r, float fl){ vec2 a = c + vec2(0.0, r * fl), b = c + vec2(-0.866 * r, -0.5 * r * fl), d = c + vec2(0.866 * r, -0.5 * r * fl);
  return min(seg(p, a, b), min(seg(p, b, d), seg(p, d, a))); }
float rune(vec2 f, float h){
  float d = 9.0;
  if (h > 0.12) d = min(d, seg(f, vec2(0.0, -0.36), vec2(0.0, 0.36)));
  if (fract(h * 7.3) > 0.5) d = min(d, seg(f, vec2(-0.3, 0.34), vec2(0.0, 0.08)));
  if (fract(h * 13.1) > 0.5) d = min(d, seg(f, vec2(0.3, 0.34), vec2(0.0, 0.08)));
  if (fract(h * 3.7) > 0.55) d = min(d, seg(f, vec2(-0.3, -0.34), vec2(0.3, -0.06)));
  if (fract(h * 5.9) > 0.5) d = min(d, seg(f, vec2(-0.3, -0.06), vec2(0.3, -0.34)));
  if (fract(h * 9.7) > 0.62) d = min(d, seg(f, vec2(-0.3, 0.0), vec2(0.3, 0.0)));
  return d;
}
// ojo cósmico: párpado almendrado, iris, pupila y pestañas. f en [-0.5, 0.5]; devuelve (distancia de trazo, distancia de iris)
vec2 eyeShape(vec2 f, float open, float slit){
  float ax = abs(f.x), lid = 0.27 * open * (1.0 - (f.x / 0.47) * (f.x / 0.47));
  float dLid = ax < 0.47 ? abs(abs(f.y) - lid) : length(vec2(ax - 0.47, f.y));
  float d = dLid, di = 9.0;
  float inside = step(abs(f.y), lid + 0.01) * step(ax, 0.47);
  float ir = abs(length(vec2(f.x, f.y * 1.35 / max(open, 0.3))) - 0.15);
  float pu = slit > 0.5 ? seg(f, vec2(0.0, -0.17 * open), vec2(0.0, 0.17 * open)) : max(length(f) - 0.05, 0.0);
  di = min(ir, pu) + (1.0 - inside) * 5.0;
  for (int k = -2; k <= 2; k++) { float x = float(k) * 0.17, y = 0.27 * open * (1.0 - (x / 0.47) * (x / 0.47)); d = min(d, seg(f, vec2(x, y), vec2(x * 1.3, y + 0.11 + 0.03 * float(2 - abs(k))))); }
  return vec2(d, di);
}
// ---- estilos: devuelven (distancia a trazo principal, distancia a trazo de acento) en dm
vec2 sEgida(vec2 p, float t){
  float d = 9.0, a = 9.0; vec2 q = vec2(abs(p.x), p.y);
  if (p.y < 2.3) {
    d = min(d, seg(p, vec2(0.0, 0.1), vec2(0.0, 2.25)));
    d = min(d, seg(vec2(q.x, mod(p.y, 0.4)), vec2(0.0, 0.0), vec2(0.22, 0.16)));
    d = min(d, seg(vec2(q.x, mod(p.y + 0.2, 0.4)), vec2(0.26, 0.0), vec2(0.5, 0.12)) + (p.y < 1.9 ? 0.0 : 9.0));
    vec2 cp = vec2(q.x - 0.62, p.y - 0.15) / 0.52; vec2 id = floor(cp), f = fract(cp) - 0.5;
    if (id.x >= 0.0 && id.x < 2.0 && id.y >= 0.0 && id.y < 4.0 && h21(id + floor(p.x < 0.0 ? 7.0 : 3.0)) > 0.22) d = min(d, rune(f, h21(id * 1.7 + (p.x < 0.0 ? 5.0 : 1.0))) * 0.52);
    a = min(a, abs(p.y - 0.45) + (q.x < 1.3 ? 0.0 : 9.0)); a = min(a, abs(p.y - 2.05) + (q.x < 1.3 ? 0.0 : 9.0));
  }
  d = min(d, tri(p, vec2(0.0, 2.8), 0.4, 1.0)); d = min(d, tri(p, vec2(0.0, 2.8), 0.4 * 0.5, -1.0));
  a = min(a, length(p - vec2(0.0, 2.8)) - 0.0);
  return vec2(d, a);
}
float vein(vec2 p, float i, float t){
  float x = sin(p.y * (1.5 + 0.35 * i) + i * 1.9 + t * 0.15) * (0.30 + 0.1 * i) + (i - 1.5) * 0.2 * (1.0 - smoothstep(0.0, 2.2, p.y) * 0.55);
  float dx = abs(p.x - x), slope = abs(cos(p.y * (1.5 + 0.35 * i) + i * 1.9 + t * 0.15) * (0.30 + 0.1 * i) * (1.5 + 0.35 * i));
  return dx / sqrt(1.0 + slope * slope);
}
vec2 sLumen(vec2 p, float t){
  float d = 9.0, a = 9.0;
  if (p.y < 2.3) {
    for (int i = 0; i < 4; i++) { float fi = float(i); for (int k = -1; k <= 1; k++) { float dd = vein(vec2(p.x - float(k) * 0.95, p.y), fi, t); d = min(d, dd + (abs(float(k)) > 0.5 ? 0.02 : 0.0));
      float yy = (floor(p.y * 2.0) + 0.5) / 2.0; vec2 c = vec2(sin(yy * (1.5 + 0.35 * fi) + fi * 1.9 + t * 0.15) * (0.30 + 0.1 * fi) + (fi - 1.5) * 0.2 * (1.0 - smoothstep(0.0, 2.2, yy) * 0.55) + float(k) * 0.95, yy);
      if (h21(vec2(fi, yy)) > 0.45) a = min(a, length(p - c) - 0.02); } }
  }
  vec2 c = vec2(0.0, 2.85); float bar = min(seg(p, c + vec2(0.0, -0.3), c + vec2(0.0, 0.3)), seg(p, c + vec2(-0.3, 0.0), c + vec2(0.3, 0.0)));
  a = min(a, bar); d = min(d, rng(p, c, 0.38));
  return vec2(d, a);
}
vec2 sForja(vec2 p, float t){
  float d = 9.0, a = 9.0;
  if (p.y < 2.3) {
    vec2 g = vec2(p.x + 3.0, p.y) / 0.42, id = floor(g), f = fract(g) - 0.5; float h = h21(id);
    if (h < 0.3) d = min(d, seg(f, vec2(-0.5, 0.0), vec2(0.5, 0.0)));
    else if (h < 0.55) d = min(d, seg(f, vec2(0.0, -0.5), vec2(0.0, 0.5)));
    else if (h < 0.8) { d = min(d, seg(f, vec2(0.0, 0.0), vec2(0.5, 0.0))); d = min(d, seg(f, vec2(0.0, 0.0), vec2(0.0, 0.5))); }
    d *= 0.42;
    if (h > 0.3) a = min(a, length(f) * 0.42 - 0.07 + (h > 0.62 ? 0.0 : 9.0));
    d = min(d, rng(vec2(f.x, f.y) * 0.42, vec2(0.0), 0.075) + (h > 0.62 ? 0.0 : 9.0));
  }
  vec2 c = vec2(0.0, 2.8), r = abs(p - c); float sq = max(r.x, r.y);
  d = min(d, abs(sq - 0.24)); a = min(a, max(sq - 0.11, 0.0));
  for (int k = -1; k <= 1; k++) { float o = float(k) * 0.14; d = min(d, seg(p, c + vec2(o, 0.24), c + vec2(o, 0.4))); d = min(d, seg(p, c + vec2(o, -0.24), c + vec2(o, -0.4))); d = min(d, seg(p, c + vec2(0.24, o), c + vec2(0.4, o))); d = min(d, seg(p, c + vec2(-0.24, o), c + vec2(-0.4, o))); }
  return vec2(d, a);
}
vec2 sVigia(vec2 p, float t){
  float d = 9.0, a = 9.0;
  if (p.y < 2.3) {
    vec2 g = vec2(p.x + 3.0, p.y) / 0.62; vec2 id = floor(g);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 c = id + vec2(float(i), float(j)); vec2 s = (c + 0.2 + 0.6 * vec2(h21(c), h21(c + 9.1))) * 0.62;
      vec2 pp = vec2(p.x + 3.0, p.y);
      float tw = 0.5 + 0.5 * sin(t * 2.5 + h21(c) * 30.0);
      a = min(a, max(length(pp - s) - 0.035 * (0.6 + tw), 0.0) + (h21(c + 3.3) > 0.28 ? 0.0 : 9.0));
      vec2 c2 = c + vec2(1.0, 0.0); vec2 s2 = (c2 + 0.2 + 0.6 * vec2(h21(c2), h21(c2 + 9.1))) * 0.62;
      if (h21(c + 5.5) > 0.4) d = min(d, seg(pp, s, s2));
      vec2 c3 = c + vec2(0.0, 1.0); vec2 s3 = (c3 + 0.2 + 0.6 * vec2(h21(c3), h21(c3 + 9.1))) * 0.62;
      if (h21(c + 8.8) > 0.55) d = min(d, seg(pp, s, s3));
    }
  }
  vec2 c = vec2(0.0, 2.8); d = min(d, rng(p, c, 0.38)); d = min(d, rng(p, c, 0.28) + 0.0);
  vec2 v = p - c; float an = atan(v.y, v.x); float tk = abs(fract(an * 12.0 / 6.2832) - 0.5);
  if (length(v) > 0.38 && length(v) < 0.46) d = min(d, tk * 0.12 + abs(length(v) - 0.42) * 0.0 + 0.0);
  a = min(a, min(seg(p, c + vec2(0.0, -0.2), c + vec2(0.0, 0.2)), seg(p, c + vec2(-0.2, 0.0), c + vec2(0.2, 0.0))));
  a = min(a, seg(p, c + vec2(-0.1, -0.1), c + vec2(0.1, 0.1))); a = min(a, seg(p, c + vec2(-0.1, 0.1), c + vec2(0.1, -0.1)));
  return vec2(d, a);
}
vec2 sNova(vec2 p, float t){
  float d = 9.0, a = 9.0;
  if (p.y < 2.3) {
    float row = floor(p.y / 0.62); vec2 g = vec2((p.x + 3.0 + h21(vec2(row, 1.0)) * 0.7) / 0.8, p.y / 0.62); vec2 id = vec2(floor(g.x), row), f = fract(g) - 0.5; float h = h21(id);
    if (h > 0.22 && p.y > 0.1) { float open = 0.55 + 0.45 * sin(t * 1.3 + h * 20.0); open = max(open * open * 1.4, 0.25); float sc = 0.8 * (0.7 + 0.5 * h);
      vec2 e = eyeShape(f * vec2(1.0, 0.8 / 0.62 * 0.62 / 0.8 * 0.77) / (0.7 + 0.5 * h) * 1.1, min(open, 1.0), 0.0); d = min(d, e.x * sc * 0.9); a = min(a, e.y * sc * 0.9); }
  }
  vec2 c = vec2(0.0, 2.8); vec2 e = eyeShape((p - c) / 0.85, 1.0, 0.0); d = min(d, e.x * 0.85); a = min(a, e.y * 0.85);
  vec2 v = p - c; float an = atan(v.y, v.x); float r = length(v);
  if (r > 0.42 && r < 0.54) d = min(d, abs(fract(an * 8.0 / 6.2832) - 0.5) * 0.14 * (r - 0.3) * 6.0 + (r - 0.42) * 0.3 * 0.0);
  return vec2(d, a);
}
vec2 sUmbra(vec2 p, float t){
  float d = 9.0, a = 9.0;
  if (p.y < 2.3) {
    for (int i = 0; i < 3; i++) { float fi = float(i);
      float ph = fi * 2.1 + t * 0.5, off = (fi - 1.0) * 0.62;
      float x = off + 0.26 * sin(p.y * 2.6 + ph) * (0.5 + 0.5 * smoothstep(0.0, 1.2, p.y));
      float slope = 0.26 * 2.6 * cos(p.y * 2.6 + ph);
      float dx = abs(p.x - x) / sqrt(1.0 + slope * slope); float taper = 0.25 + 0.75 * smoothstep(0.0, 2.2, p.y);
      d = min(d, dx / taper * 0.6 + 0.0);
      float yk = (floor(p.y / 0.3) + 0.5) * 0.3; float xk = off + 0.26 * sin(yk * 2.6 + ph) * (0.5 + 0.5 * smoothstep(0.0, 1.2, yk));
      a = min(a, abs(length(p - vec2(xk + 0.07, yk)) - 0.045) + (h21(vec2(fi, yk)) > 0.35 ? 0.0 : 9.0)); }
    d = min(d, abs(p.y - 0.18) * 1.0 + (abs(p.x) < 1.1 ? 0.0 : 9.0));
  }
  vec2 c = vec2(0.0, 2.8); vec2 e = eyeShape((p - c) / 0.86, 1.0, 1.0); d = min(d, e.x * 0.86); a = min(a, e.y * 0.86);
  vec2 v = p - c; float r = length(v), an = atan(v.y, v.x);
  if (r > 0.4 && r < 0.5) d = min(d, abs(r - 0.445) + step(0.5, fract(an * 10.0 / 6.2832 + t * 0.05)) * 9.0);
  a = min(a, abs(r - 0.52) + step(0.5, fract(an * 14.0 / 6.2832 - t * 0.25)) * 9.0);
  return vec2(d, a);
}
`;

/**
 * Material de tatuaje/guante de un personaje. style: 'egida'|'lumen'|'forja'|'vigia'|'nova'|'umbra' (o su número).
 * tstate = { value: segundos } compartido (el pulso corre solo con tstate.value += dt). Atributos requeridos: tUv (vec2), tKind (float).
 */
export function tattooMaterial({ style = 'egida', color = 0x66ffee, accent = 0xffffff, tstate }) {
  const st = typeof style === 'number' ? style : (TATTOO_STYLES[style] ?? 0);
  const m = new T.ShaderMaterial({
    transparent: true, depthWrite: true,
    uniforms: { uTime: tstate || { value: 0 }, uStyle: { value: st }, uColor: { value: new T.Color(color) }, uAccent: { value: new T.Color(accent) } },
    vertexShader: 'attribute vec2 tUv; attribute float tKind; varying vec3 vV; varying vec2 vT; varying float vK; varying vec3 vP;\nvoid main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = mv.xyz; vT = tUv; vK = tKind; vP = position; gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uTime, uStyle; uniform vec3 uColor, uAccent; varying vec3 vV; varying vec2 vT; varying float vK; varying vec3 vP;
${TATTOO_GLSL}
void main(){
  vec3 n = normalize(cross(dFdx(vV), dFdy(vV))); vec3 v = normalize(-vV); if (dot(n, v) < 0.0) n = -n;
  float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.0);
  float lit = 0.5 + 0.75 * max(dot(n, normalize(vec3(0.4, 0.8, 0.5))), 0.0);
  float kind = vK;
  vec3 col = vec3(0.0); float alpha = 1.0;
  float beat = 0.82 + 0.18 * sin(uTime * 1.9);
  if (kind > 1.5) {
    // cristal facetado luminoso (muñequera, nudillos): el mismo lenguaje que crystalAccent
    float irid = fract(dot(n, vec3(0.3, 0.5, 0.2)) * 1.5 + fres * 0.9 + (vP.x + vP.y + vP.z) * 6.0 + uTime * 0.12);
    col = uColor * lit * 0.8;
    col = mix(col, (0.5 + 0.5 * cos(6.28318 * (irid + vec3(0.0, 0.33, 0.67)))) * 0.8, 0.08 + 0.3 * fres);
    col += uColor * (0.12 + 0.15 * sin(uTime * 2.4 + vP.y * 90.0)) + vec3(1.0, 0.95, 0.9) * pow(fres, 3.0) * 0.25;
  } else {
    vec2 p = vT; vec2 r;
    if (uStyle < 0.5) r = sEgida(p, uTime); else if (uStyle < 1.5) r = sLumen(p, uTime); else if (uStyle < 2.5) r = sForja(p, uTime);
    else if (uStyle < 3.5) r = sVigia(p, uTime); else if (uStyle < 4.5) r = sNova(p, uTime); else r = sUmbra(p, uTime);
    float flow = 0.55 + 0.45 * sin(p.y * 3.4 - uTime * 2.8);
    float pulse = beat * (0.7 + 0.5 * flow);
    float w = 0.05 + 0.008 * sin(uTime * 2.0 + p.y * 4.0);
    float core = 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.022, r.x), halo = exp(-r.x * r.x * (kind < 0.5 ? 90.0 : 420.0));
    float coreA = 1.0 - smoothstep(w * 0.55, w * 0.55 + 0.022, r.y), haloA = exp(-r.y * r.y * (kind < 0.5 ? 120.0 : 500.0));
    vec3 line = uColor * (0.5 + 0.5 * pulse) * (core + 0.28 * halo) + mix(uColor, vec3(1.0), 0.5) * core * 0.08 * pulse;
    vec3 acc = uAccent * (0.55 + 0.5 * pulse) * (coreA + 0.3 * haloA);
    float cover = clamp(max(core + 0.3 * halo, coreA + 0.35 * haloA), 0.0, 1.0);
    if (kind < 0.5) {
      col = line + acc; alpha = cover * smoothstep(0.0, 0.12, p.y);
      alpha *= 0.55 + 0.45 * smoothstep(0.0, 0.3, 1.0 - fres);
      if (alpha < 0.05) discard;
    } else {
      vec3 base = vec3(0.03, 0.033, 0.04) * lit + uColor * 0.012 + uColor * fres * 0.06;
      col = base + line + acc;
    }
  }
  gl_FragColor = vec4(col, alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
  });
  m.userData.tattoo = true; return m;
}

/**
 * Guante sobre la piel: cualquier vértice de la malla del cuerpo que quede más allá de la muñeca (en el sistema de reposo) se
 * pinta como tela táctica oscura, con yemas y aros de articulación luminosos. wrists = [{ pos:[x,y,z], dir:[x,y,z] }, ...] (dir = muñeca → dedos, unitaria).
 * Idempotente: una segunda llamada sólo cambia colores.
 */
export function gloveSkin(material, { wrists, color = 0x66ffee, tstate }) {
  const u = material.userData.glove;
  if (u) { u.uGCol.value.set(color); return u; }
  const g = { uGCol: { value: new T.Color(color) }, uGTime: tstate || { value: 0 },
    uGW: { value: wrists.map((w) => new T.Vector3(...w.pos)) }, uGD: { value: wrists.map((w) => new T.Vector3(...w.dir)) } };
  material.userData.glove = g;
  const prev = material.onBeforeCompile, prevKey = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.onBeforeCompile = (s, r) => {
    prev?.call(material, s, r); Object.assign(s.uniforms, g);
    s.fragmentShader = 'uniform vec3 uGCol; uniform float uGTime; uniform vec3 uGW[2]; uniform vec3 uGD[2];\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
	{
		vec3 gp = vNpcP; int gs = gp.x >= 0.0 ? 0 : 1; vec3 gw = gs == 0 ? uGW[0] : uGW[1], gd = gs == 0 ? uGD[0] : uGD[1];
		vec3 grel = gp - gw; float gt = dot(grel, gd);
		float gin = smoothstep( -0.012, -0.004, gt ) * ( 1.0 - smoothstep( 0.19, 0.23, length( grel ) ) );
		if ( gin > 0.001 ) {
			float gbeat = 0.8 + 0.2 * sin( uGTime * 1.9 + gt * 20.0 );
			float grip = 0.5 + 0.5 * step( 0.5, fract( gt * 90.0 ) );
			vec3 gbase = vec3( 0.04, 0.045, 0.055 ) * grip + uGCol * 0.03;
			diffuseColor.rgb = mix( diffuseColor.rgb, gbase, gin );
			roughnessFactor = mix( roughnessFactor, 0.52, gin );
			float gtip = smoothstep( 0.128, 0.16, gt );
			float gring = ( 1.0 - smoothstep( 0.0, 0.0035, abs( gt - 0.0 ) ) ) + ( 1.0 - smoothstep( 0.0, 0.003, abs( gt - 0.066 ) ) ) * 0.6 + ( 1.0 - smoothstep( 0.0, 0.003, abs( gt - 0.1 ) ) ) * 0.6;
			totalEmissiveRadiance += uGCol * gin * ( gtip * 1.5 + gring * 1.6 ) * gbeat;
		}
	}`);
  };
  material.customProgramCacheKey = () => prevKey + '|glove';
  material.needsUpdate = true;
  return g;
}
