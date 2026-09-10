#!/bin/bash
# Extract frames from a webcam clip and build a contact sheet for picking.
# usage: frames.sh <clip.mov> <outdir> [fps]
set -euo pipefail

CLIP="${1:?usage: frames.sh <clip.mov> <outdir> [fps]}"
OUT="${2:?usage: frames.sh <clip.mov> <outdir> [fps]}"
FPS="${3:-2}"

mkdir -p "$OUT/frames"
rm -f "$OUT/frames"/f*.png

ffmpeg -hide_banner -loglevel error -i "$CLIP" -vf "fps=$FPS" "$OUT/frames/f%02d.png" -y

COUNT=$(ls "$OUT/frames" | wc -l | tr -d ' ')
magick montage "$OUT/frames"/f*.png -tile 6x -geometry 240x+3+3 \
  -background black -fill white -pointsize 20 -label '%t' "$OUT/contact-sheet.png"

echo "frames=$COUNT dir=$OUT/frames sheet=$OUT/contact-sheet.png"
echo "Read the contact sheet, then pass the frame numbers you want to refsheet.sh"
