import type { SiteContext } from "./context.js";
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
/**
 * Load the site's field-name cache, fetching and persisting it on first use.
 * A cache file whose recorded host doesn't match is discarded, not trusted —
 * customfield_10014 is the epic link on one Jira instance and story points on
 * another (ADR-0001).
 */
export declare function loadFields(site: SiteContext): Promise<FieldCacheFile>;
/** Resolve a Jira field id (e.g. "customfield_10014") to its display name. */
export declare function fieldName(file: FieldCacheFile, id: string): string | undefined;
/** Resolve a display name (e.g. "Epic Link") to its field id. */
export declare function fieldId(file: FieldCacheFile, name: string): string | undefined;
