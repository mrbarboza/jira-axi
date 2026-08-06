import type { SiteContext } from "../context.js";
import { hasToken } from "../keychain.js";
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
  } else {
    lines.push(
      toon.help(["Run `jira-axi user whoami` to confirm auth", "Run `jira-axi issue list --mine` to see your issues"]),
    );
  }

  return toon.combine(...lines);
}
