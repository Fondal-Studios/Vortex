#!/bin/bash
# ART GATE criaturas-2 (Gravitón, Obelisco, Aurora, Ariete, Espiral + jefes Coloso y Madre): genera las hojas de contacto
# en shots/gate/criaturas/<k>.jpg y las mediciones en /tmp/cgate2/*.txt. Un Chromium a la vez (software GL: lento).
#   normales: izq. = visor Baja (reposo|ataque) arriba, Alta abajo; der. = EN ESCENA real (Baja) reposo y ataque.
#   jefes:    <k>.jpg = visor Baja por estados/fases (2x3);  <k>-escena.jpg = en escena real por estado (cámara del jugador y de lado).
# Uso: bash tools/criaturas2-gate.sh [kinds...]   (por defecto todas)
cd "$(dirname "$0")/.."; T=/tmp/cgate2; mkdir -p $T shots/gate/criaturas
KINDS=${@:-graviton obelisco aurora ariete espiral coloso madre}
declare -A REST=( [graviton]=idle [obelisco]=idle [aurora]=idle [ariete]=idle [espiral]=idle )
declare -A ATK=( [graviton]=charge [obelisco]=charge [aurora]=cast [ariete]=wind [espiral]=pull )
declare -A FR=( [graviton]=39 [obelisco]=30 [aurora]=25 [ariete]=25 [espiral]=40 )
declare -A CAM=( [graviton]="9 1.5 2 3.2 250" [obelisco]="7 1.0 2 1.6 250" [aurora]="9 1.5 3 3.2 250" [ariete]="8 1.4 3 1.2 250" [espiral]="9 1.5 3 3.0 250" )
retry() { for i in 1 2 3; do "$@" && return 0; sleep 3; done; return 1; }
for k in $KINDS; do
  case $k in
  coloso)
    export CS_QS="&sc=1.0&dist=7&cy=0"
    retry node tools/criaturas2-sheet.mjs coloso low $T/co_v "idle:1:0:0:0.0:40,wind:1:0:0:0.0:25,ray:1:0:0:0.0:60,stagger:1:0:0:0.0:50,idle:0.5:0:0:0.0:60,idle:0.2:0:0:0.0:60" 640 480 > $T/coloso_v.txt
    retry node tools/criaturas2-escena.mjs coloso $T/co_e idle,ray,stagger,idle:0.5,idle:0.2 32 0 0 0 low > $T/coloso_e.txt
    retry node tools/criaturas2-escena.mjs coloso $T/co_p idle,ray -1 0 0 0 low > $T/coloso_p.txt
    unset CS_QS
    python3 - <<'PY'
from PIL import Image
T='/tmp/cgate2'
fs=['idle_1_0_0_0.0_40','wind_1_0_0_0.0_25','ray_1_0_0_0.0_60','stagger_1_0_0_0.0_50','idle_0.5_0_0_0.0_60','idle_0.2_0_0_0.0_60']
W=Image.new('RGB',(1920,960))
for i,f in enumerate(fs): W.paste(Image.open(f'{T}/co_v_{f}.jpg'),((i%3)*640,(i//3)*480))
W.save('/home/user/Shower-psico/shots/gate/criaturas/coloso.jpg',quality=85)
es=['idle','ray','stagger','idle_0.5','idle_0.2']
W=Image.new('RGB',(1920,720))
for i,f in enumerate(es): W.paste(Image.open(f'{T}/co_e_{f}.jpg').resize((640,360)),((i%3)*640,(i//3)*360))
W.paste(Image.open(f'{T}/co_p_idle.jpg').resize((640,360)),(640*2,360))
W.save('/home/user/Shower-psico/shots/gate/criaturas/coloso-escena.jpg',quality=85)
PY
    ;;
  madre)
    export CS_QS="&sc=1.0&dist=9&cy=0.2"
    retry node tools/criaturas2-sheet.mjs madre low $T/ma_v "fire:1:0:0:0.0:30,fire:0.4:0:0:1.0:30,vent:1:0:0:0.0:30,gestate:1:0:0:0.0:30,open:1:0:0:0.0:30,open:1:0:0:1.0:30" 640 480 > $T/madre_v.txt
    retry node tools/criaturas2-escena.mjs madre $T/ma_e fire:1:0.1,fire:1:0.95,open,gestate,vent 30 0 0 0 low > $T/madre_e.txt
    unset CS_QS
    python3 - <<'PY'
from PIL import Image
T='/tmp/cgate2'
fs=['fire_1_0_0_0.0_30','fire_0.4_0_0_1.0_30','vent_1_0_0_0.0_30','gestate_1_0_0_0.0_30','open_1_0_0_0.0_30','open_1_0_0_1.0_30']
W=Image.new('RGB',(1920,960))
for i,f in enumerate(fs): W.paste(Image.open(f'{T}/ma_v_{f}.jpg'),((i%3)*640,(i//3)*480))
W.save('/home/user/Shower-psico/shots/gate/criaturas/madre.jpg',quality=85)
es=['fire_1_0.1','fire_1_0.95','open','gestate','vent']
W=Image.new('RGB',(1920,720))
for i,f in enumerate(es): W.paste(Image.open(f'{T}/ma_e_{f}.jpg').resize((640,360)),((i%3)*640,(i//3)*360))
W.save('/home/user/Shower-psico/shots/gate/criaturas/madre-escena.jpg',quality=85)
PY
    ;;
  *)
    r=${REST[$k]}; a=${ATK[$k]}; f=${FR[$k]}; export CS_QS=""
    retry node tools/criaturas2-sheet.mjs $k low $T/${k}_vl "$r:1:0:0:0.5:40,$a:1:0:0:0.5:$f" 640 480 > $T/${k}_vl.txt
    retry node tools/criaturas2-sheet.mjs $k high $T/${k}_vh "$r:1:0:0:0.5:40,$a:1:0:0:0.5:$f" 640 480 > $T/${k}_vh.txt
    retry node tools/criaturas2-escena.mjs $k $T/${k}_es $r,$a ${CAM[$k]%% *} $(echo ${CAM[$k]} | cut -d' ' -f2) $(echo ${CAM[$k]} | cut -d' ' -f3) $(echo ${CAM[$k]} | cut -d' ' -f4) low m1 $(echo ${CAM[$k]} | cut -d' ' -f5) > $T/${k}_es.txt
    python3 - $k $r $a $f <<'PY'
import sys
from PIL import Image
k,r,a,f=sys.argv[1:5]; T='/tmp/cgate2'
fs=[f'{T}/{k}_vl_{r}_1_0_0_0.5_40.jpg',f'{T}/{k}_vl_{a}_1_0_0_0.5_{f}.jpg',f'{T}/{k}_vh_{r}_1_0_0_0.5_40.jpg',f'{T}/{k}_vh_{a}_1_0_0_0.5_{f}.jpg']
W=Image.new('RGB',(1920,960))
for i,fn in enumerate(fs): W.paste(Image.open(fn),((i%2)*640,(i//2)*480))
for j,s in enumerate([r,a]): W.paste(Image.open(f'{T}/{k}_es_{s}.jpg').resize((640,360)),(1280,j*360))
W.save(f'/home/user/Shower-psico/shots/gate/criaturas/{k}.jpg',quality=85)
PY
    ;;
  esac
done
if [ -n "$EXTRA" ]; then   # fotogramas de combate en 1ª persona (Baja y Media) y jefes en escena en Media
  retry node tools/criaturas2-fp.mjs $T/fp_low.jpg low m1 "ariete:15:-5:wind,obelisco:26:-1:charge,aurora:20:4:cast,espiral:24:-11:pull,graviton:32:-4:charge" > $T/fp_low.txt
  retry env W=960 HH=540 node tools/criaturas2-fp.mjs $T/fp_med.jpg medium m1 "ariete:14:-5:wind,obelisco:22:-1:charge,aurora:18:4:cast,espiral:24:-10:pull,graviton:30:-4:charge" > $T/fp_med.txt
  retry env W=640 HH=360 CS_ANIM=0.6 node tools/criaturas2-escena.mjs coloso $T/cm idle 30 0 0 0 medium > $T/coloso_m.txt
  retry env W=640 HH=360 CS_ANIM=0.6 node tools/criaturas2-escena.mjs madre $T/mm fire:1:0.9,open 30 0 0 0 medium > $T/madre_m.txt
  python3 - <<'PY'
from PIL import Image
T='/tmp/cgate2'; D='/home/user/Shower-psico/shots/gate/criaturas'
Image.open(f'{T}/fp_low.jpg').save(f'{D}/combate-baja.jpg',quality=85)
Image.open(f'{T}/fp_med.jpg').save(f'{D}/combate-media.jpg',quality=85)
W=Image.new('RGB',(1920,360))
for i,f in enumerate(['cm_idle','mm_fire_1_0.9','mm_open']): W.paste(Image.open(f'{T}/{f}.jpg').resize((640,360)),(i*640,0))
W.save(f'{D}/jefes-media.jpg',quality=85)
PY
fi
cat $T/*.txt
