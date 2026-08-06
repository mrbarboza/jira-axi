import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readConfig } from "./site-registry.js";
import { missingSiteError, unknownSiteError } from "./errors.js";
import { jiraAxiHome } from "./paths.js";

export { jiraAxiHome } from "./paths.js";

export type SiteSource = "flag" | "env" | "project" | "default";

export interface SiteContext {
  /** Jira Cloud host, e.g. "acme.atlassian.net". Never a full URL. */
  host: string;
  /** Alias this host is registered under, when resolved through the registry. */
  alias?: string;
  /** Atlassian account email, required for Basic Auth against Jira Cloud. */
  email?: string;
  source: SiteSource;
}

interface ProjectConfig {
  site?: string;
}

/**
 * Resolve the target site for this invocation, in the order fixed by ADR-0001:
 * --site flag > JIRA_AXI_SITE > nearest ./.jira-axi.json > ~/.jira-axi/config.json defaultSite.
 * Throws when nothing resolves or an alias/host has no matching registry entry.
 */
export function resolveSite(flagValue: string | undefined, cwd: string = process.cwd()): SiteContext {
  if (flagValue) {
    return toContext(flagValue, "flag");
  }

  const envSite = process.env.JIRA_AXI_SITE;
  if (envSite) {
    return toContext(envSite, "env");
  }

  const projectSite = findProjectSite(cwd);
  if (projectSite) {
    return toContext(projectSite, "project");
  }

  const config = readConfig();
  if (config.defaultSite) {
    return toContext(config.defaultSite, "default");
  }

  throw missingSiteError();
}

function toContext(aliasOrHost: string, source: SiteSource): SiteContext {
  const config = readConfig();
  const entry = config.sites[aliasOrHost];
  if (entry) {
    return { host: entry.host, alias: aliasOrHost, email: entry.email, source };
  }
  // Not a registered alias — treat as a bare host only if it looks like one
  // and is already registered under some alias; otherwise it's unknown.
  const matchingAlias = Object.entries(config.sites).find(([, v]) => v.host === aliasOrHost);
  if (matchingAlias) {
    return { host: aliasOrHost, alias: matchingAlias[0], email: matchingAlias[1].email, source };
  }
  throw unknownSiteError(aliasOrHost);
}

function findProjectSite(cwd: string): string | undefined {
  let dir = cwd;
  for (;;) {
    const candidate = join(dir, ".jira-axi.json");
    if (existsSync(candidate)) {
      const parsed = JSON.parse(readFileSync(candidate, "utf-8")) as ProjectConfig;
      if (parsed.site) return parsed.site;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
