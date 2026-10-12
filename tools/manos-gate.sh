#!/bin/bash
# Hoja de contacto del ART GATE de manos y brazos de 1ª persona (Baja y Alta, 844×390 y 1280×720).
# Uso: bash tools/manos-gate.sh [salida=shots/gate/manos]     (un solo Chromium a la vez; tarda ~15 min con render por software)
# Genera:  fp_<calidad>_<ancho>.jpg   8-10 armas en 1ª persona, reposo
#          fire_<calidad>_<ancho>.jpg  las mismas armas disparando (cuadro justo tras el disparo)
#          estilos_<calidad>.jpg      4 tatuajes x guante táctico + 3 guantes (primer plano)
#          presets_<calidad>.jpg      los 6 personajes (primer plano)
#          agarres_<calidad>.jpg      mano derecha de 8 armas (agarre y dedos)
#          dedo_gatillo.jpg           índice en reposo / disparando (primer plano)
set -e
OUT=${1:-shots/gate/manos}; RAW=$OUT/raw; mkdir -p "$RAW"
cd "$(dirname "$0")/.."
WS="0 2 3 4 6 8 10 12 15 20"
label() { # archivo etiqueta
  convert "$1" -gravity SouthWest -undercolor "#000000aa" -fill white -pointsize 20 -annotate +6+4 "$2" "$1"
}
shots() { # dir size args...
  local d=$1 s=$2; shift 2; node tools/shot-hands.js "$d" "$@" --size="$s" > "$d.log" 2>&1 || { cat "$d.log"; exit 1; }
}
for Q in low high; do
  for SZ in 844x390 1280x720; do
    W=${SZ%x*}
    args=(); for w in $WS; do args+=("w=$w&q=$Q&view=fp"); done
    shots "$RAW/fp_${Q}_${W}" $SZ "${args[@]}"
    i=0; for w in $WS; do label "$RAW/fp_${Q}_${W}/$i.jpg" "arma $w · $Q · ${SZ}"; i=$((i+1)); done
    montage "$RAW"/fp_${Q}_${W}/{0..9}.jpg -tile 2x5 -geometry +2+2 -background '#101018' "$OUT/fp_${Q}_${W}.jpg"
    args=(); for w in $WS; do args+=("w=$w&q=$Q&view=fp@40:0.016:35"); done
    shots "$RAW/fire_${Q}_${W}" $SZ "${args[@]}"
    i=0; for w in $WS; do label "$RAW/fire_${Q}_${W}/$i.jpg" "disparo · arma $w · $Q"; i=$((i+1)); done
    montage "$RAW"/fire_${Q}_${W}/{0..9}.jpg -tile 2x5 -geometry +2+2 -background '#101018' "$OUT/fire_${Q}_${W}.jpg"
  done
  V="view=close&a=58&e=28&d=0.42&tgt=0,-0.07,0.0"
  args=()
  for t in runas ojos constelacion venas; do args+=("w=0&q=$Q&$V&hs=66ffee,ff66c4,$t,tactico"); done
  args+=("w=0&q=$Q&$V&hs=ffb040,ff5a2a,runas,cristal" "w=0&q=$Q&$V&hs=ff66c4,9a7bff,constelacion,cristal" "w=0&q=$Q&$V&hs=7dff9a,66ffee,ojos,desnudo" "w=0&q=$Q&$V&hs=ff8a30,ffe060,venas,desnudo")
  shots "$RAW/estilos_$Q" 800x450 "${args[@]}"
  names=(runas+táctico ojos+táctico constelación+táctico venas+táctico runas+cristal constelación+cristal ojos+desnudo venas+desnudo)
  for i in 0 1 2 3 4 5 6 7; do label "$RAW/estilos_$Q/$i.jpg" "${names[$i]} · $Q"; done
  montage "$RAW"/estilos_$Q/{0..7}.jpg -tile 2x4 -geometry +2+2 -background '#101018' "$OUT/estilos_$Q.jpg"
  args=(); for pr in egida lumen forja vigia nova umbra; do args+=("w=0&q=$Q&$V&preset=$pr"); done
  shots "$RAW/presets_$Q" 800x450 "${args[@]}"
  i=0; for pr in egida lumen forja vigia nova umbra; do label "$RAW/presets_$Q/$i.jpg" "$pr · $Q"; i=$((i+1)); done
  montage "$RAW"/presets_$Q/{0..5}.jpg -tile 2x3 -geometry +2+2 -background '#101018' "$OUT/presets_$Q.jpg"
  args=(); for w in 0 1 2 5 6 8 10 15; do args+=("w=$w&q=$Q&view=close&a=140&e=20&d=0.45&tgt=0,-0.08,0.0"); done
  shots "$RAW/agarres_$Q" 800x450 "${args[@]}"
  i=0; for w in 0 1 2 5 6 8 10 15; do label "$RAW/agarres_$Q/$i.jpg" "agarre · arma $w · $Q"; i=$((i+1)); done
  montage "$RAW"/agarres_$Q/{0..7}.jpg -tile 2x4 -geometry +2+2 -background '#101018' "$OUT/agarres_$Q.jpg"
done
V="view=close&a=-65&e=12&d=0.5&tgt=0,-0.06,0.0"
shots "$RAW/dedo" 800x450 "w=0&q=high&$V@40:0.016:" "w=0&q=high&$V@40:0.016:34" "w=0&q=high&view=close&a=40&e=20&d=0.4&tgt=0,-0.08,0.0@40:0.016:" "w=0&q=high&view=close&a=40&e=20&d=0.4&tgt=0,-0.08,0.0@40:0.016:34"
montage "$RAW"/dedo/{0..3}.jpg -tile 2x2 -geometry +2+2 -background '#101018' "$OUT/dedo_gatillo.jpg"
echo "listo: $OUT"
