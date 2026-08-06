import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siteCacheDir } from "./paths.js";
import type { SiteContext } from "./context.js";
import { JiraClient } from "./client.js";

export interface JiraFieldDescriptor {
  id: string;
  name: string;
  custom: boolean;
}

export interface FieldCacheFile {
  host: string;
  fetchedAt: string;
  fields: JiraFieldDescriptor[];
}

/** In-process cache so a single invocation never re-reads the file twice. */
const memoryCache = new Map<string, FieldCacheFile>();

function cachePath(host: string): string {
  return join(siteCacheDir(host), "fields.json");
}

/**
 * Load the site's field-name cache, fetching and persisting it on first use.
 * A cache file whose recorded host doesn't match is discarded, not trusted —
 * customfield_10014 is the epic link on one Jira instance and story points on
 * another (ADR-0001).
 */
export async function loadFields(site: SiteContext): Promise<FieldCacheFile> {
  const cached = memoryCache.get(site.host);
  if (cached) return cached;

  const onDisk = readCacheFile(site.host);
  if (onDisk) {
    memoryCache.set(site.host, onDisk);
    return onDisk;
  }

  const client = new JiraClient({ site });
  const fields = (await client.get("/rest/api/3/field")) as JiraFieldDescriptor[];
  const file: FieldCacheFile = { host: site.host, fetchedAt: new Date().toISOString(), fields };
  writeCacheFile(site.host, file);
  memoryCache.set(site.host, file);
  return file;
}

function readCacheFile(host: string): FieldCacheFile | undefined {
  const path = cachePath(host);
  if (!existsSync(path)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as FieldCacheFile;
    if (parsed.host !== host) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeCacheFile(host: string, file: FieldCacheFile): void {
  const dir = siteCacheDir(host);
  mkdirSync(dir, { recursive: true });
  writeFileSync(cachePath(host), JSON.stringify(file, null, 2));
}

/** Resolve a Jira field id (e.g. "customfield_10014") to its display name. */
export function fieldName(file: FieldCacheFile, id: string): string | undefined {
  return file.fields.find((f) => f.id === id)?.name;
}

/** Resolve a display name (e.g. "Epic Link") to its field id. */
export function fieldId(file: FieldCacheFile, name: string): string | undefined {
  return file.fields.find((f) => f.name.toLowerCase() === name.toLowerCase())?.id;
}
