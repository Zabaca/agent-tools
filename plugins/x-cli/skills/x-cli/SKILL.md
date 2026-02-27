---
description: Post tweets and manage X/Twitter interactions using the x-cli tool. Use this skill when the user wants to post tweets, reply to tweets, or attach images to tweets.
---

# X/Twitter CLI Skill

Post tweets and manage X/Twitter interactions using the `x-cli` package.

## When to Use This Skill

Activate this skill when the user:
- Wants to post a tweet
- Needs to reply to an existing tweet (thread)
- Wants to attach an image to a tweet
- Needs to authenticate with X/Twitter

## Commands

### Post a Tweet
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/x-cli/src/main.ts tweet "<message>"
```
Options:
- `-i, --image <path>` - Path to image file to attach (png, jpg, gif, webp, mp4)
- `-r, --reply-to <tweet_id>` - Tweet ID to reply to

### Authenticate
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/x-cli/src/main.ts login
```
Options:
- `-f, --force` - Force re-authentication

## Important Notes

- 280 characters maximum
- URLs count as 23 chars, emojis count as 2, line breaks count as 1
- Supported image formats: PNG, JPG, GIF, WEBP, MP4
- Extract tweet ID from URL: `https://twitter.com/user/status/<ID>`
- Success response returns ID and URL of posted tweet
- Credentials stored at `~/.x-cli/credentials.json`

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Tweet too long" | Over 280 chars | Shorten message |
| "Not authenticated" | No valid token | Run login command |
| "Image upload failed" | Invalid file | Check file path and format |
| "Rate limited" | Too many requests | Wait and retry |
