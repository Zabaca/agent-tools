# @zabaca/gemini-image

CLI for Gemini image generation using Google's Nano Banana models.
Defaults to Nano Banana 2 Lite (`gemini-3.1-flash-lite-image`).

## Features

- **Generate images** from text prompts
- **Edit existing images** with text instructions
- **Configurable model** via `GEMINI_IMAGE_MODEL` or `-m/--model`
- Simple CLI interface

## Installation

```bash
npm install -g @zabaca/gemini-image
```

Or run directly with npx:

```bash
npx @zabaca/gemini-image generate "a sunset over mountains" -o sunset.jpg
```

## Setup

1. Get a Gemini API key from [Google AI Studio](https://ai.google.dev)
2. Set the environment variable:

```bash
export GEMINI_API_KEY=your-api-key-here
```

Or create a `.env` file:

```
GEMINI_API_KEY=your-api-key-here
```

3. Optionally pick a model (defaults to `gemini-3.1-flash-lite-image`):

```bash
export GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

## Usage

### Generate Image

Generate an image from a text prompt:

```bash
gemini-image generate "a futuristic city at sunset with flying cars" -o city.jpg
```

**Options:**
- `-o, --output <path>` (required) - Output file path
- `-m, --model <model>` - Model to use (defaults to `$GEMINI_IMAGE_MODEL`)

### Edit Image

Edit an existing image with a text prompt:

```bash
gemini-image edit input.png "add a rainbow in the sky" -o edited.png
```

**Arguments:**
- `<image-path>` - Path to the input image
- `<prompt>` - Description of the edits to make

**Options:**
- `-o, --output <path>` (required) - Output file path
- `-m, --model <model>` - Model to use (defaults to `$GEMINI_IMAGE_MODEL`)

**Supported formats:** PNG, JPG, JPEG, GIF, WebP

## Examples

```bash
# Generate a landscape
gemini-image generate "serene mountain lake at dawn, photorealistic" -o lake.jpg

# Generate abstract art
gemini-image generate "abstract geometric patterns in blue and gold" -o abstract.jpg

# Edit an image
gemini-image edit photo.jpg "make the sky more dramatic with storm clouds" -o dramatic.png

# Add elements to an image
gemini-image edit portrait.png "add sunglasses" -o portrait-sunglasses.png
```

## Models

| Model | Name | Per image @1K |
|---|---|---|
| `gemini-3.1-flash-lite-image` | Nano Banana 2 Lite (default) | $0.0336 |
| `gemini-2.5-flash-image` | Nano Banana (legacy) | $0.039 |
| `gemini-3.1-flash-image` | Nano Banana 2 | $0.067 |
| `gemini-3-pro-image` | Nano Banana Pro | $0.134 |

Precedence: `-m/--model` > `GEMINI_IMAGE_MODEL` > default.

**No free tier.** Image generation requires a billing-enabled API key.

### Output format

Output format depends on the model: the 3.x models return JPEG, while
`gemini-2.5-flash-image` returns PNG. The file is always written to the exact
`-o` path you give, and the CLI warns when that extension disagrees with the
actual bytes. On the default model, prefer `.jpg`.

## Requirements

- [Bun](https://bun.sh) runtime (recommended) or Node.js 18+
- Gemini API key from [Google AI Studio](https://ai.google.dev)

## License

MIT
