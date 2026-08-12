export { jiraAxiHome } from "./paths.js";
export type SiteSource = "flag" | "env" | "project" | "default";
export interface SiteContext {
    /** Jira Cloud host, e.g. "acme.atlassian.net". Never a full URL. */
    host: string;
    /** Alias this host is registered under, when resolved through the registry. */
    alias?: string;
    source: SiteSource;
}
/**
 * Resolve the target site for this invocation, in the order fixed by ADR-0001:
 * --site flag > JIRA_AXI_SITE > nearest ./.jira-axi.json > ~/.jira-axi/config.json defaultSite.
 * Throws when nothing resolves or an alias/host has no matching registry entry.
 */
export declare function resolveSite(flagValue: string | undefined, cwd?: string): SiteContext;
