---
description: Generate or edit images using the Gemini 2.5 Flash Image API (Nano Banana). Use this skill when the user asks to create, generate, or produce images from text descriptions, or edit/modify existing images with AI.
---

# Gemini Image Generation Skill

Generate and edit images using `@zabaca/gemini-image` powered by Gemini 2.5 Flash Image (Nano Banana).

## Commands

### Generate an image from text
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/gemini-image/src/main.ts generate "<prompt>" -o <output-path>
```

### Edit an existing image
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/gemini-image/src/main.ts edit <input-image> "<prompt>" -o <output-path>
```

## Notes

- Output: 1024x1024 PNG
- 500 free requests/day
- Requires `GEMINI_API_KEY` environment variable
- Supported input formats: PNG, JPG, JPEG, GIF, WEBP
