// Same eligibility in authoritative simulation and HUD; coordinates support both forms.
const xyz = p => Array.isArray(p) ? p : [p.x,p.y,p.z];
export function reviveTarget(players, me) {
  if (!me || me.dead || me.aw) return null;
  const a=xyz(me.pos);
  return players.filter(p=>p.id!==me.id && p.dead && !p.lost && !p.aw && p.bleed>0)
    .map(p=>({p,d:Math.hypot(...xyz(p.pos).map((v,i)=>v-a[i]))}))
    .filter(x=>x.d<3.5).sort((a,b)=>a.d-b.d||a.p.id-b.p.id)[0]?.p || null;
}
export function mapMarkers(state, me) {
  const out=[];
  for(const m of state.monsters||[]) if(m.hp>0) out.push({kind:m.boss?'boss':m.el?'elite':'enemy',p:m.p});
  for(const p of state.players||[]) if(p.id!==me.id&&!p.lost) out.push({kind:p.dead?'down':'ally',p:p.pos});
  const targets=state.obj?.targets || (state.obj?.tg?[state.obj.tg]:[]);
  if(state.obj?.state==='active') for(const p of targets) out.push({kind:'objective',p});
  for(const p of state.mis?.targets||[]) out.push({kind:'mission',p});
  if(state.mis?.target) out.push({kind:'mission',p:state.mis.target});
  out.push({kind:'host',p:me.pos});return out;
}
// Player-relative tangent plane also works on the spherical arenas.
export function projectMap(pos, me, range=90) {
  const up=me.up||[0,1,0], f=me.h||[0,0,-1], d=pos.map((v,i)=>v-me.pos[i]);
  const r=[f[1]*up[2]-f[2]*up[1],f[2]*up[0]-f[0]*up[2],f[0]*up[1]-f[1]*up[0]];
  const dot=a=>a.reduce((s,v,i)=>s+v*d[i],0);let x=dot(r)/range,y=-dot(f)/range;
  const n=Math.hypot(x,y),edge=n>1;if(edge){x/=n;y/=n;}
  return {x,y,edge,height:dot(up)};
}
