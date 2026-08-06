import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jiraAxiHome } from "./paths.js";
import { AxiError } from "axi-sdk-js";

export interface SiteEntry {
  host: string;
  /**
   * Atlassian account email for this site. Not a secret — Jira Cloud Basic
   * Auth requires `email:api_token`, so this rides alongside the host in the
   * registry while the token itself stays in the keychain.
   */
  email?: string;
}

export interface SiteRegistryConfig {
  sites: Record<string, SiteEntry>;
  defaultSite?: string;
}

function configPath(): string {
  return join(jiraAxiHome(), "config.json");
}

export function readConfig(): SiteRegistryConfig {
  const path = configPath();
  if (!existsSync(path)) {
    return { sites: {} };
  }
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as SiteRegistryConfig;
  return { sites: parsed.sites ?? {}, defaultSite: parsed.defaultSite };
}

function writeConfig(config: SiteRegistryConfig): void {
  const home = jiraAxiHome();
  mkdirSync(home, { recursive: true });
  writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

export function addSite(alias: string, host: string): SiteRegistryConfig {
  const config = readConfig();
  config.sites[alias] = { host };
  if (!config.defaultSite) config.defaultSite = alias;
  writeConfig(config);
  return config;
}

export function setSiteEmail(alias: string, email: string): SiteRegistryConfig {
  const config = readConfig();
  const entry = config.sites[alias];
  if (!entry) {
    throw new AxiError(`no site registered under alias "${alias}"`, "SITE_NOT_FOUND", [
      "Run `jira-axi site list` to see registered sites",
    ]);
  }
  entry.email = email;
  writeConfig(config);
  return config;
}

export function useSite(alias: string): SiteRegistryConfig {
  const config = readConfig();
  if (!config.sites[alias]) {
    throw new AxiError(`no site registered under alias "${alias}"`, "SITE_NOT_FOUND", [
      "Run `jira-axi site list` to see registered sites",
    ]);
  }
  config.defaultSite = alias;
  writeConfig(config);
  return config;
}

export function removeSite(alias: string): SiteRegistryConfig {
  const config = readConfig();
  delete config.sites[alias];
  if (config.defaultSite === alias) delete config.defaultSite;
  writeConfig(config);
  return config;
}
