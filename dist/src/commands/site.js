import { AxiError } from "axi-sdk-js";
import { getPositional } from "../args.js";
import { addSite, readConfig, removeSite, useSite } from "../site-registry.js";
import { hasSession } from "../oauth-store.js";
import * as toon from "../toon.js";
export const SITE_HELP = `usage: jira-axi site <subcommand> [args]
subcommands[4]:
  list, add <alias> <host>, use <alias>, remove <alias>
examples:
  jira-axi site add work acme.atlassian.net
  jira-axi site use work
  jira-axi site list
`;
export async function siteCommand(args) {
    const [subcommand, ...rest] = args;
    switch (subcommand) {
        case "list":
            return listSites();
        case "add":
            return addSiteCommand(rest);
        case "use":
            return useSiteCommand(rest);
        case "remove":
            return removeSiteCommand(rest);
        default:
            throw new AxiError(`unknown site subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
                "Run `jira-axi site --help` to see subcommands",
            ]);
    }
}
function listSites() {
    const config = readConfig();
    const rows = Object.entries(config.sites).map(([alias, entry]) => ({
        alias,
        host: entry.host,
        authenticated: hasSession(entry.host),
        default: alias === config.defaultSite,
    }));
    if (rows.length === 0) {
        return toon.combine(toon.pair("sites", "none registered"), toon.help(["Run `jira-axi site add <alias> <host>` to register a site"]));
    }
    return toon.combine(toon.table("sites", rows), toon.help(["Run `jira-axi setup auth --site <alias>` to authenticate a site"]));
}
function addSiteCommand(args) {
    const alias = getPositional(args, 0);
    const host = getPositional(args, 1);
    if (!alias || !host) {
        throw new AxiError("usage: jira-axi site add <alias> <host>", "VALIDATION_ERROR");
    }
    addSite(alias, host);
    return toon.combine(toon.pair("added", `${alias} -> ${host}`), toon.help([`Run \`jira-axi setup auth --site ${alias}\` to authenticate`]));
}
function useSiteCommand(args) {
    const alias = getPositional(args, 0);
    if (!alias) {
        throw new AxiError("usage: jira-axi site use <alias>", "VALIDATION_ERROR");
    }
    useSite(alias);
    return toon.pair("default", alias);
}
function removeSiteCommand(args) {
    const alias = getPositional(args, 0);
    if (!alias) {
        throw new AxiError("usage: jira-axi site remove <alias>", "VALIDATION_ERROR");
    }
    removeSite(alias);
    return toon.pair("removed", alias);
}
//# sourceMappingURL=site.js.map