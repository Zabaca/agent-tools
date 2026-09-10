# Thumbnail design rules

Sources are at the bottom. Where a number comes from marketing blogs rather than
a controlled study, it is marked *(folklore)* — directionally useful, not proof.

## Hard mechanics (not opinions)

| Rule | Value |
|---|---|
| Dimensions | 1280x720, 16:9 |
| File size | under 2MB |
| Duration badge | YouTube paints it over the **bottom-right** corner, ~4px inset |
| Safe zone | keep everything that matters inside the centre ~1100x620 (90px margins) |
| Mobile test | render at 168x94 (~13%). Unreadable there = unreadable in the feed |
| A/B testing | YouTube "Test & Compare" is VOD-only — **not available for scheduled lives, premieres, or Shorts**; needs 1-2 weeks and thousands of impressions |

## The decision loop you are designing for

Thumbnail → title → thumbnail. The image has to stop the scroll; the title has to
promise value; then the eye returns to the image to confirm the promise. If the
thumbnail doesn't pop, the title is never read. So:

- **Thumbnail text complements the title, never repeats it.** Title carries the
  *what*; thumbnail carries the *feeling*. If the title already says "12 pull
  requests", the thumbnail should not spend its words on "12".
- Every element should serve one desire loop: the pain, the transformation, or
  the payoff.

## MrBeast's operating principles

- **Title and thumbnail come first, before the video exists.** They set the
  expectation everything else must satisfy. A mismatch tanks watch time, which
  tanks distribution.
- **Concept beats production.** "I Spent 50 Hours In My Front Yard" vs "I Spent
  50 Hours In Ketchup" — same effort, wildly different click. If the image isn't
  inherently interesting, no amount of polish saves it.
- **Three focal points maximum.** Never more.
- **Slight low-angle close-up** of the face makes the subject read as dominant.
- **One word of text is the goal**; text quantifies the stakes, it doesn't explain
  the video.
- High saturation on subject and payoff; background muted or slightly blurred.

## Consensus design rules *(folklore, but consistent across sources)*

- 3-4 words max; 0-3 words outperforms; past 5-6 it's noise on a phone.
- Primary text 150-200px at 1280x720; secondary 80-120px.
- A face with an exaggerated emotion beats objects or text alone (+20-30% claimed).
  Neutral face ≈ no face.
- **Contrast, not colour**: bright subject on dark/blurred background.
- More than three distinct elements ≈ 23% lower CTR claimed. One subject, one
  message, one second.
- One directional element (arrow/circle) max, in a contrasting colour, if any.

## Coding / dev channel specifics

- **A code screenshot with white text and a red arrow reads as amateur now.** It
  loses in a feed of high-contrast faces, and small code is illegible at 168px.
- Do include one small topic marker — a logo, a terminal, a language icon — for
  context, but it is a supporting element, not the subject.
- The genre's winning shape: your face with a real reaction + one bold graphic
  representing the payoff + 2-4 words. Terminal green on near-black is a strong,
  on-brand palette for dev content.
- Consistency of face, palette, and type across uploads is what makes a small
  channel recognizable in a feed.

## Prompt template

Fill the brackets. This is the shape that produced the best results — an explicit
identity block, then pose, then layout, then type, then negatives.

```
The N panels in this image are reference photos of ONE person from different
angles and expressions. Use ALL of them to lock their exact likeness: facial
structure, eyes, nose, mouth, jawline, cheekbones, skin tone and texture,
[distinguishing marks], [hair], [glasses?], and [clothing]. Do not slim or
beautify them.

Now produce ONE new professional YouTube thumbnail, cinematic widescreen 16:9,
showing this same person in a NEW pose: [EXPRESSION — be physical: eyes wide,
eyebrows raised high, jaw dropped, hands beside head], looking straight at the
camera. Place them on the RIGHT side as a clean cutout with a cool rim light.

Background: near-black with [texture, e.g. a faint dark hexagon grid].
On the LEFT side [ONE graphic element — e.g. an arc of exactly twelve glowing
green checkmark badges, evenly spaced in a single clean arc].
Across the lower left, enormous bold condensed sans-serif text: "[LINE 1]" in
white and beneath it "[LINE 2]" in [accent colour], very large and crisp.

High contrast, punchy, no watermark, no other text, no photo grid, no panels.
```

Expression cheat sheet: jaw-drop disbelief (highest energy) · smug closed-mouth
smirk (best for "I got away with something") · arms folded confidence (lowest
energy, most corporate) · palms-up shrug (reads as "not my doing").

## Model notes

| Tier | Model ID | Per image @1K | Use |
|---|---|---|---|
| `flash` | `gemini-3.1-flash-image` | $0.067 | **Default.** Everything. |
| `pro` | `gemini-3-pro-image` | $0.134 | Final pick only, if flash has a visible flaw |
| `lite` | `gemini-3.1-flash-lite-image` | $0.0336 | **Never** — slims and smooths the face |

Version numbers skew: flash and lite are **3.1**, pro is **3**. There is no
`gemini-3.1-pro-image`.

- `flash` is the default because a three-concept round costs $0.20 instead of
  $0.40, and its likeness is not meaningfully worse. Judge the concept at flash;
  spend `pro` on the winner, not the field.
- **flash is loose on counts** — ask for twelve badges and it draws fourteen. So
  **do not put an exact count in a prompt** unless the number is the point. Write
  "a stack of glowing green kanban cards", not "exactly five". If a count really
  matters, that is the one case worth `pro`.
- The model **redraws** the face rather than compositing it; a multi-view sheet is
  what keeps it honest. Always check the result actually looks like the person.
- Expect ~1376x768 output — `generate.sh` crops and resizes to exact spec.

## Sources

- [Leaked MrBeast production doc, summarized](https://simonwillison.net/2024/Sep/15/how-to-succeed-in-mrbeast-production/)
- [MrBeast thumbnail style analysis](https://touhfa.art/blog/thumbnails/mrbeast-thumbnail-article/)
- [YouTube Help: A/B test titles and thumbnails](https://support.google.com/youtube/answer/16391400?hl=en-GB)
- [Thumbnail size + safe zones](https://pixelbatch.io/blog/youtube-thumbnail-size-guide)
- [Word-count guidance](https://miraflow.ai/blog/how-many-words-youtube-thumbnail-2026)
- [Developer-channel thumbnail conventions](https://medium.com/@iniyarajan/ai-powered-youtube-thumbnail-tips-for-developer-channels-7622b5986d99)
- [2026 best-practice roundup](https://www.unkoa.com/youtube-thumbnail-design-tips/)
- Prior art worth reading: [aabrole/claude-video-thumbnail-skill](https://github.com/aabrole/claude-video-thumbnail-skill), [AgriciDaniel/claude-youtube](https://github.com/AgriciDaniel/claude-youtube)
