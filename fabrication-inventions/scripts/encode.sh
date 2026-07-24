#!/usr/bin/env bash
set -euo pipefail
OUT="${1:-output}"
for NAME in corexy_printer cnc_mill assembly_robot; do
  ffmpeg -y -framerate 24 -i "$OUT/${NAME}_frames/frame_%04d.ppm" -c:v libx264 -pix_fmt yuv420p -crf 18 "$OUT/${NAME}.mp4"
  ffmpeg -y -i "$OUT/${NAME}_hero.ppm" -frames:v 1 "$OUT/${NAME}_hero.png"
done
