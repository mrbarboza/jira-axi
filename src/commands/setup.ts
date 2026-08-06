import { AxiError, installSessionStartHooks } from "axi-sdk-js";
import { getFlag } from "../args.js";
import { resolveSite } from "../context.js";
import { setToken } from "../keychain.js";
import { setSiteEmail } from "../site-registry.js";
import { isStdinTTY, readStdin } from "../stdin.js";
import * as toon from "../toon.js";

export const SETUP_HELP = `usage: jira-axi setup <subcommand> [flags]
subcommands[2]:
  auth --site <alias> --email <you@example.com>   # token piped via stdin
  hooks                                            # install the SessionStart hook
examples:
  jira-axi site add work acme.atlassian.net
  echo -n "<api-token>" | jira-axi setup auth --site work --email you@example.com
  jira-axi setup hooks
`;

export async function setupCommand(args: string[]): Promise<string> {
  const [subcommand, ...rest] = args;
  switch (subcommand) {
    case "auth":
      return setupAuth(rest);
    case "hooks":
      return setupHooks();
    default:
      throw new AxiError(`unknown setup subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
        "Run `jira-axi setup --help` to see subcommands",
      ]);
  }
}

async function setupAuth(args: string[]): Promise<string> {
  const siteFlag = getFlag(args, "--site");
  const email = getFlag(args, "--email");
  const site = resolveSite(siteFlag);

  if (!email) {
    throw new AxiError("--email is required: Jira Cloud Basic Auth needs the account email", "VALIDATION_ERROR", [
      `Run \`jira-axi setup auth --site ${site.alias ?? site.host} --email <you@example.com>\``,
    ]);
  }

  if (isStdinTTY()) {
    throw new AxiError("API token must be piped via stdin, never passed as a flag", "VALIDATION_ERROR", [
      `echo -n "<api-token>" | jira-axi setup auth --site ${site.alias ?? site.host} --email ${email}`,
    ]);
  }
  const token = (await readStdin()).trim();
  if (token.length === 0) {
    throw new AxiError("empty token read from stdin", "VALIDATION_ERROR");
  }

  setToken(site.host, token);
  if (site.alias) setSiteEmail(site.alias, email);

  return toon.combine(
    toon.pair("authenticated", site.host),
    toon.help([`Run \`jira-axi user whoami --site ${site.alias ?? site.host}\` to confirm`]),
  );
}

function setupHooks(): string {
  installSessionStartHooks({ marker: "jira-axi", binaryNames: ["jira-axi"] });
  return toon.pair("hooks", "installed");
}
