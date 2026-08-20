---
description: Generate or edit images using Google's Nano Banana image models (Gemini image API). Use this skill when the user asks to create, generate, or produce images from text descriptions, or edit/modify existing images with AI.
---

# Gemini Image Generation Skill

Generate and edit images using `@zabaca/gemini-image`, powered by Google's Nano
Banana models. Defaults to Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`).

## Commands

### Generate an image from text
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/gemini-image/src/main.ts generate "<prompt>" -o <output-path>
```

### Edit an existing image
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/gemini-image/src/main.ts edit <input-image> "<prompt>" -o <output-path>
```

### Use a different model
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/gemini-image/src/main.ts generate "<prompt>" -m gemini-3-pro-image -o <output-path>
```

## Choosing a model

| Model | Use when |
|---|---|
| `gemini-3.1-flash-lite-image` | Default. Cheapest, 1K output, fastest. |
| `gemini-3.1-flash-image` | Need 2K/4K, character consistency, or style references. |
| `gemini-3-pro-image` | Text-heavy images, infographics, exact brand or identity work. |
| `gemini-2.5-flash-image` | Legacy. Only for reproducing older output. |

`-m/--model` overrides `GEMINI_IMAGE_MODEL`, which overrides the default.

## Notes

- **Output format varies by model.** The 3.x models return JPEG; `gemini-2.5-flash-image`
  returns PNG. The output path is written exactly as given, and the CLI warns when the
  extension doesn't match the bytes — prefer `.jpg` on the default model.
- Output dimensions vary by model and prompt; edits tend to match the input image.
- Requires `GEMINI_API_KEY` with billing enabled. There is no free tier for image models.
- Supported input formats: PNG, JPG, JPEG, GIF, WEBP
