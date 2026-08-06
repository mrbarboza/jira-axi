import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFields, type FieldCacheFile } from "./fields.js";
import type { SiteContext } from "./context.js";

vi.mock("./keychain.js", () => ({ getToken: () => "fake-token" }));

let homeDir: string;
let originalHome: string | undefined;
let originalFetch: typeof fetch;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), "jira-axi-cache-"));
  originalHome = process.env.HOME;
  process.env.HOME = homeDir;
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  globalThis.fetch = originalFetch;
  rmSync(homeDir, { recursive: true, force: true });
});

function cachePath(host: string): string {
  return join(homeDir, ".jira-axi", "cache", host, "fields.json");
}

function writeCache(host: string, file: FieldCacheFile): void {
  const dir = join(homeDir, ".jira-axi", "cache", host);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "fields.json"), JSON.stringify(file));
}

describe("loadFields cache discard", () => {
  it("trusts an on-disk cache whose recorded host matches, without fetching", async () => {
    const host = "acme.atlassian.net";
    const cached: FieldCacheFile = {
      host,
      fetchedAt: "2024-01-01T00:00:00.000Z",
      fields: [{ id: "customfield_10014", name: "Epic Link", custom: true }],
    };
    writeCache(host, cached);

    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const site: SiteContext = { host, email: "me@example.com", source: "flag" };
    const result = await loadFields(site);

    expect(result).toEqual(cached);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("discards a cache file recorded under a different host and refetches", async () => {
    const requestedHost = "second.atlassian.net";
    const staleCache: FieldCacheFile = {
      host: "other.atlassian.net",
      fetchedAt: "2020-01-01T00:00:00.000Z",
      fields: [{ id: "customfield_10014", name: "Story Points", custom: true }],
    };
    writeCache(requestedHost, staleCache);

    const freshFields = [{ id: "customfield_10014", name: "Epic Link", custom: true }];
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(freshFields),
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const site: SiteContext = { host: requestedHost, email: "me@example.com", source: "flag" };
    const result = await loadFields(site);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.host).toBe(requestedHost);
    expect(result.fields).toEqual(freshFields);

    const persisted = JSON.parse(readFileSync(cachePath(requestedHost), "utf-8")) as FieldCacheFile;
    expect(persisted.host).toBe(requestedHost);
    expect(persisted.fields).toEqual(freshFields);
  });
});
