# x-cli

Post tweets and manage X/Twitter interactions from Claude Code.

## Features

- Post tweets with text and images
- Reply to existing tweets (threads)
- OAuth authentication flow

## Setup

1. Install the plugin: `/plugin install x-cli@zabaca-agent-tools`
2. Authenticate: the skill will guide you through `login`

## Requirements

- X/Twitter API credentials
- [Bun](https://bun.sh) runtime

## Commands

- `/tweet-doc <file>` - Generate and post a tweet from a document
- `/tweet-git [hash]` - Generate and post a tweet from a git commit
