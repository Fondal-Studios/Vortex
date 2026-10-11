#!/bin/bash
# Genera las hojas de contacto del ART GATE de criaturas-1 en shots/gate/criaturas/ (1 Chromium a la vez).
cd "$(dirname "$0")/.."; T=/tmp/cgate; mkdir -p $T shots/gate/criaturas
declare -A REST=( [astilla]=idle [geoda]=roll [prisma]=orbit [lente]=idle [cuarzo]=idle [espejo]=idle [racimo]=idle )
declare -A ATK=( [astilla]=leap [geoda]=open [prisma]=wind [lente]=aim [cuarzo]=cast [espejo]=strike [racimo]=fuse )
for k in astilla geoda prisma lente cuarzo espejo racimo; do
  r=${REST[$k]}; a=${ATK[$k]}
  node tools/criaturas-sheet.mjs $k low $T/${k}_vl $r,$a 640 480 > $T/${k}_vl.txt
  node tools/criaturas-sheet.mjs $k high $T/${k}_vh $r,$a 640 480 > $T/${k}_vh.txt
  node tools/criaturas-escena.mjs $k $T/${k}_es $r,$a 11 low > $T/${k}_es.txt
  python3 - $k $r $a <<'PY'
import sys
from PIL import Image
k,r,a=sys.argv[1:4]; T='/tmp/cgate'
fs=[f'{T}/{k}_vl_{r}.jpg',f'{T}/{k}_vl_{a}.jpg',f'{T}/{k}_vh_{r}.jpg',f'{T}/{k}_vh_{a}.jpg']
W=Image.new('RGB',(1280,720+480))
for i,f in enumerate(fs): W.paste(Image.open(f).resize((640,480)).crop((0,0,640,480)),((i%2)*640,(i//2)*480) if False else ((i%2)*640,(i//2)*240) ) if False else None
W=Image.new('RGB',(1920,480*2))
for i,f in enumerate(fs): W.paste(Image.open(f),((i%4)*480 if False else (i%2)*640,(i//2)*480))
for j,s in enumerate([r,a]): W.paste(Image.open(f'{T}/{k}_es_{s}.jpg').crop((320,100,960,460)).resize((640,360)),(1280,j*360))
W.crop((0,0,1920,960)).save(f'/home/user/Shower-psico/shots/gate/criaturas/{k}.jpg',quality=85)
PY
done; cat $T/*.txt
