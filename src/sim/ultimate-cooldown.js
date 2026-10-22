// No mana or damage charge. Seconds remaining are authoritative.
export const ULT_COOLDOWN = Object.freeze({sobrecarga:45,frenesi:45,floracion:60,colapso:55,metamorfosis:55,marabunta:60,danza:55,supernova:60});
export function beginUltimateCooldown(p, base, duration, haste = 1) {
 const wait = base / Math.max(1, Math.min(1.25, Number.isFinite(haste) ? haste : 1));
 p.ultCd = wait + duration; p.ultCdMax = p.ultCd;
 p.ultRefundBudget = wait * .2; // all plants/passives combined refund at most 20% per cast
}
export function refundUltimate(p, seconds) {
 const n = Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, p.ultRefundBudget || 0, Math.max(0,(p.ultCd || 0)-(p.ultT || 0))));
 p.ultCd = Math.max(0,(p.ultCd || 0)-n); p.ultRefundBudget = Math.max(0,(p.ultRefundBudget || 0)-n);
 return n;
}
