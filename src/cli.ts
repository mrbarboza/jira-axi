import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAxiCli, type AxiCliCommand } from "axi-sdk-js";
import { getFlag } from "./args.js";
import { resolveSite, type SiteContext } from "./context.js";
import { homeCommand } from "./commands/home.js";
import { siteCommand, SITE_HELP } from "./commands/site.js";
import { setupCommand, SETUP_HELP } from "./commands/setup.js";
import { userCommand, USER_HELP } from "./commands/user.js";
import { issueCommand, ISSUE_HELP } from "./commands/issue.js";
import { apiCommand, API_HELP } from "./commands/api.js";

export const DESCRIPTION =
  "Agent-ergonomic CLI for Jira Cloud — token-efficient TOON output, pre-computed aggregates. Read-only v1.";

const VERSION = readPackageVersion();

export const TOP_HELP = `usage: jira-axi [command] [args] [flags]
commands[5]: (none)=dashboard, site, setup, user, issue, api
global: --site <alias|host> on any command, overriding JIRA_AXI_SITE / .jira-axi.json / default site
examples:
  jira-axi
  jira-axi site add work acme.atlassian.net
  echo -n "<api-token>" | jira-axi setup auth --site work --email you@example.com
  jira-axi user whoami
  jira-axi issue list --mine
`;

const COMMAND_HELP: Record<string, string> = {
  site: SITE_HELP,
  setup: SETUP_HELP,
  user: USER_HELP,
  issue: ISSUE_HELP,
  api: API_HELP,
};

const COMMANDS: Record<string, AxiCliCommand<SiteContext | undefined>> = {
  site: (args) => siteCommand(args),
  setup: (args) => setupCommand(args),
  user: (args, ctx) => userCommand(args, ctx),
  issue: (args, ctx) => issueCommand(args, ctx),
  api: (args, ctx) => apiCommand(args, ctx),
};

export async function main(options: { argv?: string[]; stdout?: { write: (chunk: string) => unknown } } = {}) {
  await runAxiCli<SiteContext | undefined>({
    ...(options.argv ? { argv: options.argv } : {}),
    description: DESCRIPTION,
    version: VERSION,
    topLevelHelp: TOP_HELP,
    ...(options.stdout ? { stdout: options.stdout } : {}),
    home: (args, ctx) => homeCommand(args, ctx),
    commands: COMMANDS,
    getCommandHelp: (command) => COMMAND_HELP[command],
    resolveContext: ({ args }) => resolveSiteOrUndefined(getFlag(args, "--site")),
  });
}

function resolveSiteOrUndefined(flagValue: string | undefined): SiteContext | undefined {
  try {
    return resolveSite(flagValue);
  } catch {
    // Commands that need a resolved site (e.g. `user whoami`) throw their own
    // error when they see `undefined`; commands that don't (`site`, `setup`)
    // work fine before any site is registered.
    return undefined;
  }
}

function readPackageVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [join(here, "..", "package.json"), join(here, "..", "..", "package.json")]) {
    if (existsSync(candidate)) {
      const pkg = JSON.parse(readFileSync(candidate, "utf-8")) as { version?: string };
      if (pkg.version) return pkg.version;
    }
  }
  return "0.0.0";
}
