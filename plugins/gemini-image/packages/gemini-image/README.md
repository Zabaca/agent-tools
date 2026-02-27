# @zabaca/gemini-image

CLI for Gemini image generation using Google's Nano Banana (Gemini 2.5 Flash Image) model.

## Features

- **Generate images** from text prompts
- **Edit existing images** with text instructions
- **Free tier**: 500 requests/day via Google AI Studio
- Simple CLI interface

## Installation

```bash
npm install -g @zabaca/gemini-image
```

Or run directly with npx:

```bash
npx @zabaca/gemini-image generate "a sunset over mountains" -o sunset.png
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

## Usage

### Generate Image

Generate an image from a text prompt:

```bash
gemini-image generate "a futuristic city at sunset with flying cars" -o city.png
```

**Options:**
- `-o, --output <path>` (required) - Output file path

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

**Supported formats:** PNG, JPG, JPEG, GIF, WebP

## Examples

```bash
# Generate a landscape
gemini-image generate "serene mountain lake at dawn, photorealistic" -o lake.png

# Generate abstract art
gemini-image generate "abstract geometric patterns in blue and gold" -o abstract.png

# Edit an image
gemini-image edit photo.jpg "make the sky more dramatic with storm clouds" -o dramatic.png

# Add elements to an image
gemini-image edit portrait.png "add sunglasses" -o portrait-sunglasses.png
```

## API

This CLI uses Google's **Gemini 2.5 Flash Image** model (codename: Nano Banana).

**Free Tier:** 500 requests/day via Google AI Studio API key

**Pricing:** ~$0.15 per 4K generation after free tier

## Requirements

- [Bun](https://bun.sh) runtime (recommended) or Node.js 18+
- Gemini API key from [Google AI Studio](https://ai.google.dev)

## License

MIT
