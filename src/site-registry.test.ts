import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addSite, readConfig, removeSite, useSite } from "./site-registry.js";

let homeDir: string;
let originalHome: string | undefined;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), "nu-jira-axi-home-"));
  originalHome = process.env.HOME;
  process.env.HOME = homeDir;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(homeDir, { recursive: true, force: true });
});

describe("readConfig", () => {
  it("returns an empty registry when no config file exists yet", () => {
    expect(readConfig()).toEqual({ sites: {} });
  });
});

describe("addSite", () => {
  it("registers a site entry with only a host, no email field", () => {
    const config = addSite("work", "acme.atlassian.net");
    expect(config.sites.work).toEqual({ host: "acme.atlassian.net" });
  });

  it("sets the first added site as the default", () => {
    const config = addSite("work", "acme.atlassian.net");
    expect(config.defaultSite).toBe("work");
  });

  it("does not override an existing default when adding a second site", () => {
    addSite("work", "acme.atlassian.net");
    const config = addSite("personal", "side.atlassian.net");
    expect(config.defaultSite).toBe("work");
  });

  it("persists to disk with owner-only permissions", () => {
    addSite("work", "acme.atlassian.net");
    const path = join(homeDir, ".jira-axi", "config.json");
    const persisted = JSON.parse(readFileSync(path, "utf-8"));
    expect(persisted.sites.work).toEqual({ host: "acme.atlassian.net" });
  });
});

describe("useSite", () => {
  it("switches the default site", () => {
    addSite("work", "acme.atlassian.net");
    addSite("personal", "side.atlassian.net");
    const config = useSite("personal");
    expect(config.defaultSite).toBe("personal");
  });

  it("throws for an alias that isn't registered", () => {
    expect(() => useSite("nope")).toThrowError(/no site registered/);
  });
});

describe("removeSite", () => {
  it("removes the entry and clears defaultSite when it pointed at the removed alias", () => {
    addSite("work", "acme.atlassian.net");
    const config = removeSite("work");
    expect(config.sites.work).toBeUndefined();
    expect(config.defaultSite).toBeUndefined();
  });

  it("leaves defaultSite untouched when a different alias is removed", () => {
    addSite("work", "acme.atlassian.net");
    addSite("personal", "side.atlassian.net");
    const config = removeSite("personal");
    expect(config.defaultSite).toBe("work");
  });
});
