import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSiteOrUndefined } from "./cli.js";

let homeDir: string;
let originalHome: string | undefined;
let originalEnvSite: string | undefined;
let originalCwd: string;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), "jira-axi-home-"));
  originalHome = process.env.HOME;
  originalEnvSite = process.env.JIRA_AXI_SITE;
  originalCwd = process.cwd();
  process.env.HOME = homeDir;
  delete process.env.JIRA_AXI_SITE;
  process.chdir(homeDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalEnvSite === undefined) delete process.env.JIRA_AXI_SITE;
  else process.env.JIRA_AXI_SITE = originalEnvSite;
  rmSync(homeDir, { recursive: true, force: true });
});

function writeConfig(config: unknown): void {
  const dir = join(homeDir, ".jira-axi");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "config.json"), JSON.stringify(config));
}

describe("resolveSiteOrUndefined", () => {
  it("swallows the 'nothing configured' case and returns undefined", () => {
    expect(resolveSiteOrUndefined(undefined)).toBeUndefined();
  });

  it("propagates an unknown-site error for a bad --site value instead of swallowing it", () => {
    writeConfig({ sites: { work: { host: "acme.atlassian.net" } }, defaultSite: "work" });
    expect(() => resolveSiteOrUndefined("doesnotexist")).toThrowError(/no site registered for "doesnotexist"/);
  });

  it("still resolves a valid site normally", () => {
    writeConfig({ sites: { work: { host: "acme.atlassian.net" } }, defaultSite: "work" });
    expect(resolveSiteOrUndefined(undefined)).toEqual({
      host: "acme.atlassian.net",
      alias: "work",
      source: "default",
    });
  });
});
