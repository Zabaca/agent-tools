# gemini-image

Generate and edit images with Google's Nano Banana models from Claude Code.

## Features

- Text-to-image generation
- Image editing with AI prompts
- Model is configurable — defaults to Nano Banana 2 Lite

## Models

The default is `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite): the cheapest
per image and a generation newer than the 2.5 model this plugin used to pin.

| Model | Name | Per image @1K |
|---|---|---|
| `gemini-3.1-flash-lite-image` | Nano Banana 2 Lite (default) | $0.0336 |
| `gemini-2.5-flash-image` | Nano Banana (legacy) | $0.039 |
| `gemini-3.1-flash-image` | Nano Banana 2 | $0.067 |
| `gemini-3-pro-image` | Nano Banana Pro | $0.134 |

Override per project with `GEMINI_IMAGE_MODEL`, or per call with `-m/--model`.

There is no free tier for image generation — a billing-enabled key is required.

## Setup

1. Install the plugin: `/plugin install gemini-image@zabaca-agent-tools`
2. Set `GEMINI_API_KEY` environment variable
3. Optionally set `GEMINI_IMAGE_MODEL` to pick a different model

## Requirements

- Gemini API key ([Get one here](https://aistudio.google.com/apikey)) with billing enabled
- [Bun](https://bun.sh) runtime
