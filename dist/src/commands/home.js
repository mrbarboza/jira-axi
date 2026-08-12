import { hasSession } from "../oauth-store.js";
import { JiraClient } from "../client.js";
import * as toon from "../toon.js";
export async function homeCommand(_args, site) {
    if (!site) {
        return toon.combine(toon.pair("site", "none resolved"), toon.help(["Run `jira-axi site add <alias> <host>` to register a site"]));
    }
    const authenticated = hasSession(site.host);
    const lines = [
        toon.pair("site", `${site.alias ?? site.host} (${site.host})`),
        toon.pair("authenticated", authenticated),
    ];
    if (!authenticated) {
        lines.push(toon.help([`Run \`jira-axi setup auth --site ${site.alias ?? site.host}\``]));
        return toon.combine(...lines);
    }
    const myOpenCount = await tryCountMyOpenIssues(site);
    if (myOpenCount !== undefined) {
        lines.push(toon.pair("myOpenIssues", myOpenCount));
    }
    lines.push(toon.help(["Run `jira-axi user whoami` to confirm auth", "Run `jira-axi issue list --mine` to see your issues"]));
    return toon.combine(...lines);
}
const OPEN_COUNT_CAP = 100;
/**
 * Jira's search API dropped the `total` field when it moved from
 * /rest/api/3/search to /rest/api/3/search/jql (maxResults: 0 is no longer
 * even accepted). One capped page plus `isLast` is enough for a dashboard
 * hint — exact counts past the cap aren't worth a second round-trip here.
 */
async function tryCountMyOpenIssues(site) {
    try {
        const client = new JiraClient({ site });
        const response = (await client.get("/rest/api/3/search/jql", {
            jql: "assignee = currentUser() AND statusCategory != Done",
            fields: "key",
            maxResults: OPEN_COUNT_CAP,
        }));
        return response.isLast ? String(response.issues.length) : `${response.issues.length}+`;
    }
    catch {
        // Dashboard is best-effort live data; a transient auth/network failure
        // here shouldn't block showing the rest of the dashboard.
        return undefined;
    }
}
//# sourceMappingURL=home.js.map