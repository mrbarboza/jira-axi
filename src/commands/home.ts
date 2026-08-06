import type { SiteContext } from "../context.js";
import { hasToken } from "../keychain.js";
import { JiraClient } from "../client.js";
import * as toon from "../toon.js";

export async function homeCommand(_args: string[], site: SiteContext | undefined): Promise<string> {
  if (!site) {
    return toon.combine(
      toon.pair("site", "none resolved"),
      toon.help(["Run `jira-axi site add <alias> <host>` to register a site"]),
    );
  }

  const authenticated = hasToken(site.host);
  const lines = [
    toon.pair("site", `${site.alias ?? site.host} (${site.host})`),
    toon.pair("authenticated", authenticated),
  ];

  if (!authenticated) {
    lines.push(toon.help([`Run \`jira-axi setup auth --site ${site.alias ?? site.host} --email <you@example.com>\``]));
    return toon.combine(...lines);
  }

  const myOpenCount = await tryCountMyOpenIssues(site);
  if (myOpenCount !== undefined) {
    lines.push(toon.pair("myOpenIssues", myOpenCount));
  }
  lines.push(
    toon.help(["Run `jira-axi user whoami` to confirm auth", "Run `jira-axi issue list --mine` to see your issues"]),
  );

  return toon.combine(...lines);
}

async function tryCountMyOpenIssues(site: SiteContext): Promise<number | undefined> {
  try {
    const client = new JiraClient({ site });
    const response = (await client.get("/rest/api/3/search", {
      jql: "assignee = currentUser() AND statusCategory != Done",
      fields: "key",
      maxResults: 0,
    })) as { total: number };
    return response.total;
  } catch {
    // Dashboard is best-effort live data; a transient auth/network failure
    // here shouldn't block showing the rest of the dashboard.
    return undefined;
  }
}
