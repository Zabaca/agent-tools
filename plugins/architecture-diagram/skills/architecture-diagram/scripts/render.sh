#!/usr/bin/env bash
# Render a self-contained diagram HTML to PNG with headless Chrome, then check the SVG parses.
#
# Usage: render.sh <file.html> [out.png] [width] [height]
#
# Width should be a little wider than the SVG viewBox width so the page padding fits.
# Height is the window, not the content — make it generous; the screenshot is clipped to the
# window, so too small silently truncates the footer.
set -euo pipefail

SRC=${1:?usage: render.sh <file.html> [out.png] [width] [height]}
OUT=${2:-${SRC%.html}.png}
W=${3:-1960}
H=${4:-1500}

CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
[[ -x $CHROME ]] || { echo "Chrome not found at: $CHROME (set CHROME=…)" >&2; exit 1; }

ABS=$(cd "$(dirname "$SRC")" && pwd)/$(basename "$SRC")

# Chrome writes diagnostics to stderr even on success; only its exit status matters.
"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --screenshot="$OUT" --window-size="$W,$H" "file://$ABS" 2>/dev/null

python3 - "$ABS" <<'PY'
import sys, xml.etree.ElementTree as ET
s = open(sys.argv[1]).read()
if '<svg' not in s:
    print('no <svg> in file — nothing to check'); raise SystemExit
svg = s[s.index('<svg'):s.rindex('</svg>')+6]
ET.fromstring(svg)
print('SVG well-formed')
PY

echo "wrote $OUT — now READ it and look for label/edge collisions, overflow, and dead space"
