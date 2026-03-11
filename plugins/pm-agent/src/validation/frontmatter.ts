/** Regex-based YAML frontmatter parser — no external dependencies */
export function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  content: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };

  const [, yaml, content] = match;
  const data: Record<string, unknown> = {};

  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value: unknown = trimmed.slice(idx + 1).trim();

    // Strip surrounding quotes
    if (
      typeof value === "string" &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = (value as string).slice(1, -1);
    }

    // Coerce booleans
    if (value === "true") value = true;
    else if (value === "false") value = false;
    // Coerce numbers
    else if (typeof value === "string" && /^\d+(\.\d+)?$/.test(value)) {
      value = Number(value);
    }

    data[key] = value;
  }

  return { data, content };
}
