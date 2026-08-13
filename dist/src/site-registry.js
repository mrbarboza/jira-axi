import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { jiraAxiHome } from "./paths.js";
import { AxiError } from "axi-sdk-js";
function configPath() {
    return join(jiraAxiHome(), "config.json");
}
export function readConfig() {
    const path = configPath();
    if (!existsSync(path)) {
        return { sites: {} };
    }
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return { sites: parsed.sites ?? {}, defaultSite: parsed.defaultSite };
}
function writeConfig(config) {
    const home = jiraAxiHome();
    mkdirSync(home, { recursive: true });
    writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}
export function addSite(alias, host) {
    const config = readConfig();
    config.sites[alias] = { host };
    if (!config.defaultSite)
        config.defaultSite = alias;
    writeConfig(config);
    return config;
}
export function useSite(alias) {
    const config = readConfig();
    if (!config.sites[alias]) {
        throw new AxiError(`no site registered under alias "${alias}"`, "SITE_NOT_FOUND", [
            "Run `nu-jira-axi site list` to see registered sites",
        ]);
    }
    config.defaultSite = alias;
    writeConfig(config);
    return config;
}
export function removeSite(alias) {
    const config = readConfig();
    delete config.sites[alias];
    if (config.defaultSite === alias)
        delete config.defaultSite;
    writeConfig(config);
    return config;
}
//# sourceMappingURL=site-registry.js.map