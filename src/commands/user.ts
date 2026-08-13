import { AxiError } from "axi-sdk-js";
import type { SiteContext } from "../context.js";
import { JiraClient } from "../client.js";
import { missingSiteError } from "../errors.js";
import * as toon from "../toon.js";

export const USER_HELP = `usage: nu-jira-axi user <subcommand>
subcommands[1]:
  whoami
examples:
  nu-jira-axi user whoami --site work
`;

interface JiraMyself {
  accountId: string;
  displayName: string;
  emailAddress?: string;
  active: boolean;
  timeZone?: string;
}

export async function userCommand(args: string[], site: SiteContext | undefined): Promise<string> {
  const [subcommand] = args;
  if (!site) {
    throw missingSiteError();
  }
  switch (subcommand) {
    case "whoami":
      return whoami(site);
    default:
      throw new AxiError(`unknown user subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
        "Run `nu-jira-axi user --help` to see subcommands",
      ]);
  }
}

async function whoami(site: SiteContext): Promise<string> {
  const client = new JiraClient({ site });
  const me = (await client.get("/rest/api/3/myself")) as JiraMyself;
  return toon.combine(
    toon.detail("whoami", {
      accountId: me.accountId,
      name: me.displayName,
      email: me.emailAddress ?? "(hidden)",
      active: me.active,
      site: site.host,
    }),
    toon.help(["Run `nu-jira-axi issue list --mine` to see your open issues"]),
  );
}
