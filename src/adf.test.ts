import { describe, expect, it } from "vitest";
import { adfToMarkdown } from "./adf.js";

describe("adfToMarkdown", () => {
  it("returns empty string for null/undefined doc", () => {
    expect(adfToMarkdown(undefined)).toBe("");
    expect(adfToMarkdown(null)).toBe("");
  });

  it("renders a paragraph with marks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "hello " },
            { type: "text", text: "world", marks: [{ type: "strong" }] },
          ],
        },
      ],
    };
    expect(adfToMarkdown(doc)).toBe("hello **world**");
  });

  it("renders a heading capped at h6", () => {
    const doc = {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 9 }, content: [{ type: "text", text: "Title" }] }],
    };
    expect(adfToMarkdown(doc)).toBe("###### Title");
  });

  it("renders a bullet list", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] },
          ],
        },
      ],
    };
    expect(adfToMarkdown(doc)).toBe("- one\n- two");
  });

  it("renders an ordered list", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "first" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "second" }] }] },
          ],
        },
      ],
    };
    expect(adfToMarkdown(doc)).toBe("1. first\n2. second");
  });

  it("renders a fenced code block with language", () => {
    const doc = {
      type: "doc",
      content: [{ type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const x = 1;" }] }],
    };
    expect(adfToMarkdown(doc)).toBe("```ts\nconst x = 1;\n```");
  });

  it("renders a link mark", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "docs", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }],
        },
      ],
    };
    expect(adfToMarkdown(doc)).toBe("[docs](https://example.com)");
  });

  it("degrades an unknown node type to its inline text instead of throwing", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "panel",
          content: [{ type: "paragraph", content: [{ type: "text", text: "note" }] }],
        },
      ],
    };
    expect(() => adfToMarkdown(doc)).not.toThrow();
    expect(adfToMarkdown(doc)).toBe("note");
  });

  it("drops media nodes without throwing", () => {
    const doc = { type: "doc", content: [{ type: "mediaSingle", content: [{ type: "media", attrs: {} }] }] };
    expect(adfToMarkdown(doc)).toBe("");
  });
});
