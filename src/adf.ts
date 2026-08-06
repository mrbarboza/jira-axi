/**
 * Atlassian Document Format -> markdown, read-only. ADF -> markdown is lossy
 * for exotic node types (panels, status lozenges, tables), which is
 * acceptable for display; markdown -> ADF for writes is deferred to P2.
 */

interface AdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface AdfNode {
  type: string;
  text?: string;
  marks?: AdfMark[];
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
}

export function adfToMarkdown(doc: AdfNode | undefined | null): string {
  if (!doc) return "";
  return renderNodes(doc.content ?? []).trim();
}

function renderNodes(nodes: AdfNode[]): string {
  return nodes.map(renderNode).join("");
}

function renderNode(node: AdfNode): string {
  switch (node.type) {
    case "paragraph":
      return `${renderInline(node.content ?? [])}\n\n`;
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      return `${"#".repeat(Math.min(level, 6))} ${renderInline(node.content ?? [])}\n\n`;
    }
    case "bulletList":
      return `${renderList(node.content ?? [], (item) => `- ${item}`)}\n`;
    case "orderedList":
      return `${renderList(node.content ?? [], (item, i) => `${i + 1}. ${item}`)}\n`;
    case "codeBlock": {
      const language = String(node.attrs?.language ?? "");
      const text = (node.content ?? []).map((c) => c.text ?? "").join("");
      return `\`\`\`${language}\n${text}\n\`\`\`\n\n`;
    }
    case "blockquote":
      return `${renderNodes(node.content ?? [])
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`;
    case "rule":
      return "---\n\n";
    case "mediaSingle":
    case "media":
      return "";
    case "table":
      return `${renderNodes(node.content ?? [])}\n`;
    case "tableRow":
      return `${(node.content ?? []).map((cell) => renderInline(cell.content ?? [])).join(" | ")}\n`;
    case "tableCell":
    case "tableHeader":
      return renderInline(node.content ?? []);
    default:
      // Unknown block node: degrade to its inline text rather than throwing.
      return node.content ? renderNodes(node.content) : "";
  }
}

function renderList(items: AdfNode[], format: (text: string, index: number) => string): string {
  return items
    .map((item, i) => {
      const text = renderNodes(item.content ?? []).trim();
      return format(text, i);
    })
    .join("\n");
}

function renderInline(nodes: AdfNode[]): string {
  return nodes.map(renderInlineNode).join("");
}

function renderInlineNode(node: AdfNode): string {
  switch (node.type) {
    case "text":
      return applyMarks(node.text ?? "", node.marks ?? []);
    case "hardBreak":
      return "\n";
    case "mention":
      return `@${node.attrs?.text ?? node.attrs?.id ?? "unknown"}`;
    case "emoji":
      return String(node.attrs?.text ?? node.attrs?.shortName ?? "");
    case "inlineCard":
    case "link": {
      const url = String(node.attrs?.url ?? node.attrs?.href ?? "");
      return url ? `[${url}](${url})` : "";
    }
    default:
      // Unknown inline node: degrade to its own text content, never throw.
      return node.text ?? (node.content ? renderInline(node.content) : "");
  }
}

function applyMarks(text: string, marks: AdfMark[]): string {
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "strong":
        result = `**${result}**`;
        break;
      case "em":
        result = `_${result}_`;
        break;
      case "strike":
        result = `~~${result}~~`;
        break;
      case "code":
        result = `\`${result}\``;
        break;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        result = href ? `[${result}](${href})` : result;
        break;
      }
      default:
        break;
    }
  }
  return result;
}
