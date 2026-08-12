import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siteCacheDir } from "./paths.js";
import { JiraClient } from "./client.js";
/** In-process cache so a single invocation never re-reads the file twice. */
const memoryCache = new Map();
function cachePath(host) {
    return join(siteCacheDir(host), "fields.json");
}
/**
 * Load the site's field-name cache, fetching and persisting it on first use.
 * A cache file whose recorded host doesn't match is discarded, not trusted —
 * customfield_10014 is the epic link on one Jira instance and story points on
 * another (ADR-0001).
 */
export async function loadFields(site) {
    const cached = memoryCache.get(site.host);
    if (cached)
        return cached;
    const onDisk = readCacheFile(site.host);
    if (onDisk) {
        memoryCache.set(site.host, onDisk);
        return onDisk;
    }
    const client = new JiraClient({ site });
    const fields = (await client.get("/rest/api/3/field"));
    const file = { host: site.host, fetchedAt: new Date().toISOString(), fields };
    writeCacheFile(site.host, file);
    memoryCache.set(site.host, file);
    return file;
}
function readCacheFile(host) {
    const path = cachePath(host);
    if (!existsSync(path))
        return undefined;
    try {
        const parsed = JSON.parse(readFileSync(path, "utf-8"));
        if (parsed.host !== host)
            return undefined;
        return parsed;
    }
    catch {
        return undefined;
    }
}
function writeCacheFile(host, file) {
    const dir = siteCacheDir(host);
    mkdirSync(dir, { recursive: true });
    writeFileSync(cachePath(host), JSON.stringify(file, null, 2));
}
/** Resolve a Jira field id (e.g. "customfield_10014") to its display name. */
export function fieldName(file, id) {
    return file.fields.find((f) => f.id === id)?.name;
}
/** Resolve a display name (e.g. "Epic Link") to its field id. */
export function fieldId(file, name) {
    return file.fields.find((f) => f.name.toLowerCase() === name.toLowerCase())?.id;
}
//# sourceMappingURL=fields.js.map