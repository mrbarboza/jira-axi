import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../oauth-store.js", () => ({
  hasSession: vi.fn(),
}));

import { hasSession } from "../oauth-store.js";
import { siteCommand } from "./site.js";

let homeDir: string;
let originalHome: string | undefined;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), "jira-axi-home-"));
  originalHome = process.env.HOME;
  process.env.HOME = homeDir;
  vi.mocked(hasSession).mockReset();
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(homeDir, { recursive: true, force: true });
});

describe("siteCommand list", () => {
  it("reports no sites registered when the registry is empty", async () => {
    const result = await siteCommand(["list"]);
    expect(result).toContain("none registered");
  });

  it("shows authenticated status per site sourced from hasSession, not email", async () => {
    await siteCommand(["add", "work", "acme.atlassian.net"]);
    vi.mocked(hasSession).mockReturnValue(true);

    const result = await siteCommand(["list"]);

    expect(hasSession).toHaveBeenCalledWith("acme.atlassian.net");
    expect(result).toContain("acme.atlassian.net");
    expect(result).not.toContain("email");
  });
});

describe("siteCommand add/use/remove", () => {
  it("adds a site and reports it", async () => {
    const result = await siteCommand(["add", "work", "acme.atlassian.net"]);
    expect(result).toContain("work");
    expect(result).toContain("acme.atlassian.net");
  });

  it("rejects add with missing arguments", async () => {
    await expect(siteCommand(["add", "work"])).rejects.toThrow(/usage/);
  });

  it("switches the default site with use", async () => {
    await siteCommand(["add", "work", "acme.atlassian.net"]);
    await siteCommand(["add", "personal", "side.atlassian.net"]);
    const result = await siteCommand(["use", "personal"]);
    expect(result).toContain("personal");
  });

  it("removes a site", async () => {
    await siteCommand(["add", "work", "acme.atlassian.net"]);
    const result = await siteCommand(["remove", "work"]);
    expect(result).toContain("work");
  });
});

describe("siteCommand unknown subcommand", () => {
  it("throws a validation error", async () => {
    await expect(siteCommand(["bogus"])).rejects.toThrow(/unknown site subcommand/);
  });
});
