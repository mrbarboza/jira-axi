import { encode } from "@toon-format/toon";

export type ToonPrimitive = string | number | boolean | null;
export type ToonRow = Record<string, ToonPrimitive>;

/** Render a single label: value line, e.g. "site: acme.atlassian.net". */
export function pair(label: string, value: ToonPrimitive): string {
  return encode({ [label]: value });
}

/** Render a labeled table. TOON declares the row schema once, not per row. */
export function table(label: string, rows: ToonRow[]): string {
  return encode({ [label]: rows });
}

/** Render a single labeled detail object. */
export function detail(label: string, row: ToonRow): string {
  return encode({ [label]: row });
}

/** Render up to N contextual "what to run next" suggestions. */
export function help(lines: string[]): string {
  if (lines.length === 0) return "";
  const indented = lines.map((l) => `  ${l}`).join("\n");
  return `help[${lines.length}]:\n${indented}`;
}

/** Combine multiple TOON blocks (some possibly empty) into one output string. */
export function combine(...blocks: string[]): string {
  return blocks.filter(Boolean).join("\n");
}
