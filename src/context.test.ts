import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSite } from "./context.js";

let homeDir: string;
let originalHome: string | undefined;
let originalEnvSite: string | undefined;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), "jira-axi-home-"));
  originalHome = process.env.HOME;
  originalEnvSite = process.env.JIRA_AXI_SITE;
  process.env.HOME = homeDir;
  delete process.env.JIRA_AXI_SITE;
});

afterEach(() => {
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

describe("resolveSite precedence", () => {
  it("throws when nothing resolves", () => {
    expect(() => resolveSite(undefined, homeDir)).toThrowError(/no Jira site resolved/);
  });

  it("falls back to the registry's defaultSite", () => {
    writeConfig({ sites: { work: { host: "acme.atlassian.net" } }, defaultSite: "work" });
    const site = resolveSite(undefined, homeDir);
    expect(site).toEqual({ host: "acme.atlassian.net", alias: "work", source: "default" });
  });

  it("prefers JIRA_AXI_SITE over the registry default", () => {
    writeConfig({
      sites: { work: { host: "acme.atlassian.net" }, personal: { host: "side.atlassian.net" } },
      defaultSite: "work",
    });
    process.env.JIRA_AXI_SITE = "personal";
    const site = resolveSite(undefined, homeDir);
    expect(site).toEqual({ host: "side.atlassian.net", alias: "personal", source: "env" });
  });

  it("prefers JIRA_AXI_SITE over a nearby .jira-axi.json", () => {
    writeConfig({
      sites: { work: { host: "acme.atlassian.net" }, personal: { host: "side.atlassian.net" } },
      defaultSite: "work",
    });
    process.env.JIRA_AXI_SITE = "personal";

    const projectDir = mkdtempSync(join(tmpdir(), "jira-axi-project-"));
    writeFileSync(join(projectDir, ".jira-axi.json"), JSON.stringify({ site: "work" }));

    const site = resolveSite(undefined, projectDir);
    expect(site).toEqual({ host: "side.atlassian.net", alias: "personal", source: "env" });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("prefers the nearest .jira-axi.json over the registry default when no env/flag is set", () => {
    writeConfig({
      sites: { work: { host: "acme.atlassian.net" }, personal: { host: "side.atlassian.net" } },
      defaultSite: "personal",
    });

    const projectDir = mkdtempSync(join(tmpdir(), "jira-axi-project-"));
    writeFileSync(join(projectDir, ".jira-axi.json"), JSON.stringify({ site: "work" }));

    const site = resolveSite(undefined, projectDir);
    expect(site).toEqual({ host: "acme.atlassian.net", alias: "work", source: "project" });
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("prefers the --site flag over everything else", () => {
    writeConfig({
      sites: { work: { host: "acme.atlassian.net" }, personal: { host: "side.atlassian.net" } },
      defaultSite: "work",
    });
    process.env.JIRA_AXI_SITE = "personal";

    const site = resolveSite("work", homeDir);
    expect(site).toEqual({ host: "acme.atlassian.net", alias: "work", source: "flag" });
  });

  it("throws for an unregistered alias or host", () => {
    writeConfig({ sites: { work: { host: "acme.atlassian.net" } }, defaultSite: "work" });
    expect(() => resolveSite("nope", homeDir)).toThrowError(/no site registered/);
  });

  it("resolves a bare host if it matches a registered alias's host", () => {
    writeConfig({ sites: { work: { host: "acme.atlassian.net" } }, defaultSite: "work" });
    const site = resolveSite("acme.atlassian.net", homeDir);
    expect(site).toEqual({ host: "acme.atlassian.net", alias: "work", source: "flag" });
  });

  it("walks up from a nested cwd to find the nearest .jira-axi.json", () => {
    writeConfig({ sites: { work: { host: "acme.atlassian.net" } }, defaultSite: "work" });
    const projectDir = mkdtempSync(join(tmpdir(), "jira-axi-project-"));
    writeFileSync(join(projectDir, ".jira-axi.json"), JSON.stringify({ site: "work" }));
    const nested = join(projectDir, "a", "b", "c");
    mkdirSync(nested, { recursive: true });

    const site = resolveSite(undefined, nested);
    expect(site.source).toBe("project");
    rmSync(projectDir, { recursive: true, force: true });
  });
});
