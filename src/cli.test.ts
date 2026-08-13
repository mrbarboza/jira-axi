import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main, resolveSiteOrUndefined } from "./cli.js";

function captureStdout(): { write: (chunk: string) => void; output: string } {
  const state = { write: (chunk: string) => (state.output += chunk), output: "" };
  return state;
}

let homeDir: string;
let originalHome: string | undefined;
let originalEnvSite: string | undefined;
let originalCwd: string;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), "nu-jira-axi-home-"));
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

describe("main", () => {
  it("treats -h as an alias for --help at the top level", async () => {
    const dash = captureStdout();
    const full = captureStdout();
    await main({ argv: ["-h"], stdout: dash });
    await main({ argv: ["--help"], stdout: full });
    expect(dash.output).toBe(full.output);
  });

  it("treats -h as an alias for --help after a subcommand", async () => {
    const dash = captureStdout();
    const full = captureStdout();
    await main({ argv: ["issue", "-h"], stdout: dash });
    await main({ argv: ["issue", "--help"], stdout: full });
    expect(dash.output).toBe(full.output);
  });

  it("prints top-level help on bare invocation instead of the dashboard", async () => {
    const bare = captureStdout();
    const full = captureStdout();
    await main({ argv: [], stdout: bare });
    await main({ argv: ["--help"], stdout: full });
    expect(bare.output).toBe(full.output);
  });
});
