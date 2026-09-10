#!/bin/bash
# Generate a thumbnail from a reference image + prompt, then normalize it to
# YouTube spec and emit the mobile-size legibility test.
#
# usage: generate.sh <reference.png> <prompt-file.txt> <out-basename> [model]
#   model: flash (default) | pro | lite
set -euo pipefail

REF="${1:?usage: generate.sh <reference.png> <prompt-file> <out-basename> [flash|pro|lite]}"
PROMPT_FILE="${2:?usage: generate.sh <reference.png> <prompt-file> <out-basename> [flash|pro|lite]}"
BASE="${3:?usage: generate.sh <reference.png> <prompt-file> <out-basename> [flash|pro|lite]}"
TIER="${4:-flash}"

case "$TIER" in
  pro)   MODEL="gemini-3-pro-image" ;;
  flash) MODEL="gemini-3.1-flash-image" ;;
  lite)  MODEL="gemini-3.1-flash-lite-image" ;;
  *)     MODEL="$TIER" ;;
esac

CLI_DIR="${GEMINI_IMAGE_DIR:-$HOME/Projects/uptownhr/research/packages/gemini-image}"
ENV_FILE="${GEMINI_ENV_FILE:-$HOME/Projects/uptownhr/research/.env}"
[ -d "$CLI_DIR" ] || { echo "gemini-image CLI not found at $CLI_DIR (set GEMINI_IMAGE_DIR)" >&2; exit 1; }

if [ -z "${GEMINI_API_KEY:-}" ]; then
  GEMINI_API_KEY="$(grep -m1 '^GEMINI_API_KEY=' "$ENV_FILE" | cut -d= -f2-)"
  export GEMINI_API_KEY
fi
[ -n "$GEMINI_API_KEY" ] || { echo "GEMINI_API_KEY not set and not found in $ENV_FILE" >&2; exit 1; }

RAW="${BASE}.raw.jpg"
PROMPT="$(cat "$PROMPT_FILE")"

# The CLI runs from its own directory, so -o and the reference must be ABSOLUTE —
# a relative path lands the output inside the CLI repo and the resize below fails.
RAW_ABS="$(cd "$(dirname "$RAW")" && pwd)/$(basename "$RAW")"
REF_ABS="$(cd "$(dirname "$REF")" && pwd)/$(basename "$REF")"

( cd "$CLI_DIR" && bun src/main.ts edit "$REF_ABS" "$PROMPT" -m "$MODEL" -o "$RAW_ABS" ) >/dev/null

# The model returns ~1376x768 (1.79); center-crop to exactly 16:9, then resize.
W=$(magick identify -format "%w" "$RAW")
H=$(magick identify -format "%h" "$RAW")
CROP_W=$(python3 -c "print(min($W, round($H*16/9)))")
CROP_H=$(python3 -c "print(min($H, round($W*9/16)))")
magick "$RAW" -gravity center -crop "${CROP_W}x${CROP_H}+0+0" +repage \
  -resize 1280x720! -quality 92 "${BASE}.jpg"
magick "${BASE}.jpg" -resize 168x94! "${BASE}.mobile.png"
rm -f "$RAW"

SIZE=$(stat -f%z "${BASE}.jpg")
echo "thumbnail=${BASE}.jpg model=$MODEL bytes=$SIZE (limit 2000000)"
echo "mobile-test=${BASE}.mobile.png  <- LOOK AT THIS. If the text is unreadable, redo it."
