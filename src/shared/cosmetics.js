import { HOST_IDENTITY } from './identity.js';
export const FINISHES = Object.freeze({
  archivo: { name: 'Archivo original', price: 0, channel: 'earned', metal: '#b9c5cc', bone: '#dbd1bd', roughness: 0.55, metalness: 0.45 },
  porcelana: { name: 'Memoria de porcelana', price: 180, channel: 'earned', metal: '#edf0e8', bone: '#ffffff', roughness: 0.28, metalness: 0.12 },
  obsidiana: { name: 'Obsidiana sináptica', price: 240, channel: 'earned', metal: '#697285', bone: '#8992a5', roughness: 0.35, metalness: 0.8 },
  aurico: { name: 'Edición áurica', price: null, channel: 'planned', metal: '#d8b875', bone: '#f0d9a2', roughness: 0.32, metalness: 0.7 },
});
export const COSMETICS = Object.freeze(Object.fromEntries(Object.keys(HOST_IDENTITY).flatMap(host => Object.entries(FINISHES).map(([finish, f]) => {
  const id = `${host}_${finish}`; return [id, Object.freeze({ id, host, finish, ...f, sku: `vortex.skin.${id}.v1`, kind: 'finish' })];
}))));
export function cosmeticFor(host, id) { const c = COSMETICS[id]; return c?.host === host ? c : COSMETICS[`${host}_archivo`] || null; }
export function cleanCosmetics(value) {
  const owned = [...new Set((Array.isArray(value?.owned) ? value.owned : []).filter(id => COSMETICS[id]?.channel === 'earned'))];
  const equipped = {};
  for (const host of Object.keys(HOST_IDENTITY)) { const id = value?.equipped?.[host], c = COSMETICS[id]; if (c?.host === host && c.channel === 'earned' && (c.price === 0 || owned.includes(id))) equipped[host] = id; }
  return { owned, equipped };
}
export function ownsCosmetic(profile, id) { const c = COSMETICS[id]; return !!c && c.channel === 'earned' && (c.price === 0 || profile.cosmetics?.owned?.includes(id)); }
export function purchaseCosmetic(profile, id) {
  const c = COSMETICS[id];
  if (!c || c.channel !== 'earned') return { ok: false, reason: 'Esta edición todavía no está a la venta.' };
  if (ownsCosmetic(profile, id)) return { ok: false, reason: 'Ya está en tu colección.' };
  if (!Number.isSafeInteger(profile.cores) || profile.cores < c.price) return { ok: false, reason: 'No alcanzan los núcleos. Se consiguen jugando.' };
  profile.cosmetics = cleanCosmetics(profile.cosmetics); profile.cores -= c.price; profile.cosmetics.owned.push(id);
  return { ok: true, reason: 'Acabado adquirido. Ya podés equiparlo.' };
}
export function equipCosmetic(profile, host, id) {
  if (COSMETICS[id]?.host !== host || !ownsCosmetic(profile, id)) return false;
  profile.cosmetics = cleanCosmetics(profile.cosmetics); profile.cosmetics.equipped[host] = id; return true;
}
