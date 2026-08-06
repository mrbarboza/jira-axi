import { describe, expect, it } from "vitest";
import * as toon from "./toon.js";

describe("pair", () => {
  it("renders a single label: value line", () => {
    expect(toon.pair("site", "acme.atlassian.net")).toBe("site: acme.atlassian.net");
  });

  it("renders booleans and numbers as-is", () => {
    expect(toon.pair("authenticated", true)).toBe("authenticated: true");
    expect(toon.pair("issueCount", 3)).toBe("issueCount: 3");
  });
});

describe("table", () => {
  it("declares the row schema once, matching the ADR's worked example", () => {
    const rows = [{ key: "PROJ-1", summary: "Fix bug", status: "Open" }];
    expect(toon.table("issues", rows)).toBe("issues[1]{key,summary,status}:\n  PROJ-1,Fix bug,Open");
  });

  it("renders multiple rows under one schema declaration", () => {
    const rows = [
      { key: "PROJ-1", status: "Open" },
      { key: "PROJ-2", status: "Done" },
    ];
    expect(toon.table("issues", rows)).toBe("issues[2]{key,status}:\n  PROJ-1,Open\n  PROJ-2,Done");
  });
});

describe("detail", () => {
  it("renders a single labeled object", () => {
    expect(toon.detail("issue", { key: "PROJ-1", status: "Open" })).toBe("issue:\n  key: PROJ-1\n  status: Open");
  });
});

describe("help", () => {
  it("returns empty string for no suggestions", () => {
    expect(toon.help([])).toBe("");
  });

  it("renders a numbered help block", () => {
    expect(toon.help(["Run `jira-axi issue view <KEY>`"])).toBe(
      "help[1]:\n  Run `jira-axi issue view <KEY>`",
    );
  });

  it("counts multiple suggestions", () => {
    expect(toon.help(["first", "second"])).toBe("help[2]:\n  first\n  second");
  });
});

describe("combine", () => {
  it("joins non-empty blocks with a newline", () => {
    expect(toon.combine(toon.pair("a", 1), toon.pair("b", 2))).toBe("a: 1\nb: 2");
  });

  it("filters out empty blocks, e.g. help() with no suggestions", () => {
    expect(toon.combine(toon.pair("a", 1), toon.help([]), toon.pair("b", 2))).toBe("a: 1\nb: 2");
  });
});
