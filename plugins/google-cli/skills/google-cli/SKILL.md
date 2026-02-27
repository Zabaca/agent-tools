---
description: Interact with Google Workspace (Drive, Docs, Sheets) using the google-cli tool. Use this skill when the user wants to search Drive, read/write Google Docs, or read Google Sheets data.
---

# Google Workspace CLI Skill

Interact with Google Drive, Docs, and Sheets using the `google-cli` package.

## When to Use This Skill

Activate this skill when the user:
- Wants to search or list files in Google Drive
- Needs to read, create, or write Google Docs
- Wants to read data from Google Sheets
- Needs to authenticate with Google

## Base Command

```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/google-cli/src/main.ts <command>
```

## Commands

### Authenticate
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/google-cli/src/main.ts login
```
Options:
- `-f, --force` - Force re-authentication

### Drive

#### List files
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/google-cli/src/main.ts drive list
```
Options:
- `-q, --query <query>` - Search query using Drive query syntax
- `-l, --limit <limit>` - Maximum number of files to return

#### Get file metadata
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/google-cli/src/main.ts drive get <fileId>
```

### Docs

#### Get document content
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/google-cli/src/main.ts docs get <documentId>
```
Options:
- `-t, --tab <nameOrIndex>` - Fetch specific tab by name or 0-based index
- `--list-tabs` - List all tabs in the document

#### Create a new document
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/google-cli/src/main.ts docs create <title>
```

#### Write content to a document
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/google-cli/src/main.ts docs write <documentId> [content]
```
Options:
- `-f, --file <path>` - Read content from file instead
- `-a, --append` - Append to document instead of replacing
- `-m, --markdown` - Parse markdown and apply formatting

### Sheets

#### Get spreadsheet info
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/google-cli/src/main.ts sheets get <spreadsheetId>
```

#### Read spreadsheet data
```bash
bun ${CLAUDE_PLUGIN_ROOT}/packages/google-cli/src/main.ts sheets read <spreadsheetId> <range>
```
Options:
- `-f, --format <format>` - Output format: table, json, or csv (default: table)

Example: `sheets read 1ABC...XYZ "Sheet1!A1:C10"`

## Important Notes

- Credentials stored at `~/.google-cli/credentials.json`
- OAuth scopes: Drive (readonly), Docs, Sheets (readonly)
- Run `login` before first use

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "Not authenticated" | No valid token | Run login command |
| "Document not found" | Invalid ID | Check document ID |
| "Permission denied" | No access | Ensure document is shared with your account |
