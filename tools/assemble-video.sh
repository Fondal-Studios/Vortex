#!/bin/bash
# Ensambla el video: cuadros → mp4 por segmento (con fundidos) → concatena → mezcla con la banda sonora.
# Uso: bash tools/assemble-video.sh [salida.mp4]
set -e
DIR=/tmp/claude-0/vid; OUT=${1:-demo/cristal-vortice-demo.mp4}; mkdir -p "$(dirname "$OUT")"
FPS=$(python3 -c "import json;print(json.load(open('$DIR/manifest.json'))['fps'])")
rm -f $DIR/seg-*.mp4 $DIR/list.txt
for d in $(ls -d $DIR/*/ | sort); do
  id=$(basename $d); n=$(ls $d/*.jpg 2>/dev/null | wc -l); [ "$n" -gt 0 ] || continue
  dur=$(python3 -c "print($n/$FPS)")
  case $id in 07-*) vf="scale=1280:720,format=yuv420p" ;; 01-*) vf="scale=1280:720,format=yuv420p,fade=t=in:st=0:d=0.6" ;; 08-*) vf="scale=1280:720,format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=$(python3 -c "print(max(0,$dur-1.2))"):d=1.2" ;; *) vf="scale=1280:720,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st=$(python3 -c "print(max(0,$dur-0.4))"):d=0.4" ;; esac
  ffmpeg -y -loglevel error -framerate $FPS -i $d/%05d.jpg -vf "$vf" -c:v libx264 -preset medium -crf 17 -r $FPS $DIR/seg-$id.mp4
  echo "file '$DIR/seg-$id.mp4'" >> $DIR/list.txt
done
ffmpeg -y -loglevel error -f concat -safe 0 -i $DIR/list.txt -c copy $DIR/video-nosound.mp4
python3 tools/synth-audio.py $DIR
ffmpeg -y -loglevel error -i $DIR/video-nosound.mp4 -i $DIR/audio.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
