import json,sys
d=json.load(open(sys.argv[1]))
out="// Composición en pantalla de cada arma (generado por tools/compose-armas.js + compose-write.py; el FOV del viewmodel está en weapons-vm.js).\nexport const VIEWS = {\n"
for k,v in sorted(d.items(),key=lambda a:int(a[0])):
    out+=f"  {k}: {{ pos: {json.dumps(v['pos'])}, scale: {v['scale']}, zs: {v['zs']}, rot: {json.dumps(v['rot'])} }},\n"
out+="};\n"
open('src/client/weapons/compose.js','w').write(out)
