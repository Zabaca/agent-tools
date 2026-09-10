#!/bin/bash
# Build a multi-view identity reference sheet from chosen frames.
# Each panel is background-removed on-device (macOS Vision), so the model sees
# the face, not the room.
#
# usage: refsheet.sh <framesdir> <out.png> <n> <n> <n> ...
#   e.g. refsheet.sh work/frames work/refsheet.png 05 08 14 23 32 39
set -euo pipefail

DIR="${1:?usage: refsheet.sh <framesdir> <out.png> <frame numbers...>}"
OUT="${2:?usage: refsheet.sh <framesdir> <out.png> <frame numbers...>}"
shift 2
[ "$#" -ge 2 ] || { echo "give at least 2 frame numbers (4-6 is ideal)" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
BIN="$HERE/.cutout"
if [ ! -x "$BIN" ] || [ "$HERE/cutout.swift" -nt "$BIN" ]; then
  echo "compiling cutout (first run only)..." >&2
  swiftc -O -o "$BIN" "$HERE/cutout.swift"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

i=0
for n in "$@"; do
  SRC="$DIR/f$n.png"
  [ -f "$SRC" ] || { echo "missing $SRC" >&2; exit 1; }
  i=$((i + 1))
  # Vision cutout -> crop to subject; flatten onto near-black; uniform height.
  "$BIN" "$SRC" "$TMP/cut$i.png" >/dev/null
  magick "$TMP/cut$i.png" -background "#101010" -flatten \
    -resize x700 -gravity center -extent 700x700 "$TMP/p$(printf %02d $i).png"
done

magick montage "$TMP"/p*.png -tile 3x -geometry +6+6 -background "#101010" "$OUT"
echo "refsheet=$OUT panels=$i"
