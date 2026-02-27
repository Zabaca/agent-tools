# Zabaca Agent Tools

CLI tools for Claude Code — a plugin marketplace for Twitter, Google Workspace, and Image Generation.

## Installation

Add the marketplace:
```
/plugin marketplace add Zabaca/agent-tools
```

Install individual plugins:
```
/plugin install x-cli@zabaca-agent-tools
/plugin install google-cli@zabaca-agent-tools
/plugin install gemini-image@zabaca-agent-tools
```

## Plugins

### x-cli
Post tweets and manage X/Twitter interactions from Claude Code.
- Post tweets with text and images
- Reply to existing tweets (threads)
- Commands: `/tweet-doc`, `/tweet-git`

### google-cli
Google Workspace CLI for Claude Code.
- Google Drive: list files, get metadata
- Google Docs: get, create, write (with markdown support)
- Google Sheets: get info, read ranges

### gemini-image
Generate and edit images using Gemini 2.5 Flash from Claude Code.
- Text-to-image generation
- Image editing with AI prompts
- 1024x1024 PNG output

## Requirements

- [Bun](https://bun.sh) runtime
- API keys for respective services (X/Twitter, Google OAuth, Gemini)

## License

MIT
