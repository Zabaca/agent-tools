---
name: youtube-thumbnail
description: Produce a 1280x720 YouTube thumbnail with the user's own face, using a multi-view reference sheet and the local gemini-image CLI. Use when the user asks for a video thumbnail, cover art, or "make a thumbnail" for a stream/upload, or wants to refresh their reusable face-reference sheet from a new webcam clip.
---

# YouTube Thumbnail

Generates a spec-correct thumbnail with the user's real likeness. The face comes
from a **multi-view reference sheet**, not a single frame — that is what stops the
model slimming and beautifying the face into someone else.

Read [DESIGN-RULES.md](DESIGN-RULES.md) before writing any prompt. Non-negotiable
short version: 1280x720, under 2MB, **3-4 words max**, primary text 150-200px,
one face with one exaggerated emotion, max 3 visual elements, bottom-right corner
kept clear for the duration badge, 90px margins.

## Quick start (reference sheet already exists)

```bash
S=~/.claude/skills/youtube-thumbnail
mkdir -p work && cd work
# write the prompt first — see the template in DESIGN-RULES.md
$S/scripts/generate.sh $S/assets/refsheet.png prompt.txt thumb-a        # flash, the default
$S/scripts/generate.sh $S/assets/refsheet.png prompt.txt thumb-a pro    # only for the final pick
```

Then **Read the `.mobile.png`**. If the text is not readable at 168x94, the
thumbnail is not done.

Driven end to end by [`stream-start`](../stream-start/SKILL.md) on a go-live day;
that skill supplies the title and the complementary thumbnail text.

## Workflow

1. **Ask for the title first.** Thumbnail text must complement it, never repeat
   it. Title = the what; thumbnail = the feeling.
2. **Check the reference sheet.** `assets/refsheet.png` is the reusable identity
   plate. Rebuild it only when the user's look changes (see below).
3. **Write 2-3 prompts** — different expression/pose per concept, same layout
   rules. Use the template in DESIGN-RULES.md.
4. **Generate each** with `scripts/generate.sh`. **Default is `flash`** — half the
   price of `pro` and just as good on likeness. Only reach for `pro` on the one
   concept the user picks, and only if flash's version has a visible flaw.
   `lite` drifts the face — never use it for likeness work.
5. **Read every result AND its `.mobile.png`.** Judge: likeness, legibility at
   thumbnail size, badge corner clear, element count.
6. **Show the user the finalists**, say which one you'd upload and why, then copy
   the picked file somewhere durable (`~/Pictures/thumbnails-YYYY-MM-DD/`).

## Rebuilding the reference sheet

Ask for one ~20s clip, good light, framed head-and-shoulders: slow head turn
left → centre → right, chin up, chin down, then 2s each of smug smirk, jaw-drop,
and deadpan.

```bash
S=~/.claude/skills/youtube-thumbnail
$S/scripts/frames.sh "~/Movies/<clip>.mov" work         # -> work/contact-sheet.png
# Read the contact sheet, pick 6 frames: frontal, 3/4 left, 3/4 right, chin-up, smile, open-mouth
$S/scripts/refsheet.sh work/frames $S/assets/refsheet.png 05 08 14 23 32 39
```

Panels are background-removed on-device with macOS Vision (`scripts/cutout.swift`),
so nothing about the user's room is uploaded — only the person.

## Notes

- **Webcam capture from this terminal fails** if the host app has no
  `NSCameraUsageDescription`; ask the user to record in Photo Booth / QuickTime.
- **A/B testing does not exist for scheduled lives or premieres** — a livestream
  thumbnail is a single shot, so pick the safest strong option, not the wildest.
- Keep the user's on-camera look consistent across thumbnails (glasses on/off) —
  recognition compounds.
