import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "@toon-format/toon";
import { AxiError, exitCodeForError, runAxiCli, type AxiCliCommand } from "axi-sdk-js";
import { getFlag } from "./args.js";
import { resolveSite, type SiteContext } from "./context.js";
import { homeCommand } from "./commands/home.js";
import { siteCommand, SITE_HELP } from "./commands/site.js";
import { setupCommand, SETUP_HELP } from "./commands/setup.js";
import { userCommand, USER_HELP } from "./commands/user.js";
import { issueCommand, ISSUE_HELP } from "./commands/issue.js";
import { apiCommand, API_HELP } from "./commands/api.js";
import { sprintCommand, SPRINT_HELP } from "./commands/sprint.js";
import { boardCommand, BOARD_HELP } from "./commands/board.js";
import { projectCommand, PROJECT_HELP } from "./commands/project.js";
import { filterCommand, FILTER_HELP } from "./commands/filter.js";
import { searchCommand, SEARCH_HELP } from "./commands/search.js";

export const DESCRIPTION =
  "Agent-ergonomic CLI for Jira Cloud — token-efficient TOON output, pre-computed aggregates. Read-only v1.";

const VERSION = readPackageVersion();

export const TOP_HELP = `usage: nu-jira-axi [command] [args] [flags]
commands[10]: (none)=dashboard, site, setup, user, issue, sprint, board, project, filter, search, api
global: --site <alias|host> on any command, overriding JIRA_AXI_SITE / .jira-axi.json / default site
examples:
  nu-jira-axi
  nu-jira-axi site add work acme.atlassian.net
  nu-jira-axi setup auth --site work
  nu-jira-axi user whoami
  nu-jira-axi issue list --mine
  nu-jira-axi sprint current --project PROJ
`;

const COMMAND_HELP: Record<string, string> = {
  site: SITE_HELP,
  setup: SETUP_HELP,
  user: USER_HELP,
  issue: ISSUE_HELP,
  sprint: SPRINT_HELP,
  board: BOARD_HELP,
  project: PROJECT_HELP,
  filter: FILTER_HELP,
  search: SEARCH_HELP,
  api: API_HELP,
};

const COMMANDS: Record<string, AxiCliCommand<SiteContext | undefined>> = {
  site: (args) => siteCommand(args),
  setup: (args) => setupCommand(args),
  user: (args, ctx) => userCommand(args, ctx),
  issue: (args, ctx) => issueCommand(args, ctx),
  sprint: (args, ctx) => sprintCommand(args, ctx),
  board: (args, ctx) => boardCommand(args, ctx),
  project: (args, ctx) => projectCommand(args, ctx),
  filter: (args, ctx) => filterCommand(args, ctx),
  search: (args, ctx) => searchCommand(args, ctx),
  api: (args, ctx) => apiCommand(args, ctx),
};

export async function main(options: { argv?: string[]; stdout?: { write: (chunk: string) => unknown } } = {}) {
  const rawArgv = options.argv ?? process.argv.slice(2);
  const argv = normalizeArgv(rawArgv);
  const stdout = options.stdout ?? process.stdout;

  // axi-sdk-js's `resolveContext` hook isn't wrapped in a try/catch, so a
  // genuine unknown-site error thrown from it would crash instead of
  // rendering like every other AxiError. Validate --site up front so that
  // error is caught and rendered here before runAxiCli ever calls the hook.
  try {
    resolveSiteOrUndefined(getFlag(argv, "--site"));
  } catch (error) {
    if (!(error instanceof AxiError)) throw error;
    stdout.write(`${renderAxiError(error)}\n`);
    process.exitCode = exitCodeForError(error);
    return;
  }

  await runAxiCli<SiteContext | undefined>({
    argv,
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

// axi-sdk-js's own `--help` handling only recognizes the literal "--help"
// token (both `argv[0] === "--help"` at the top level and `args.includes("--help")`
// per subcommand) and treats bare invocation as "run the home command", not
// "show help". Rewrite argv here so its checks see what they expect: `-h`
// becomes `--help` everywhere, and no args at all becomes `["--help"]`.
function normalizeArgv(argv: string[]): string[] {
  if (argv.length === 0) return ["--help"];
  return argv.map((token) => (token === "-h" ? "--help" : token));
}

function renderAxiError(error: AxiError): string {
  const output: Record<string, unknown> = { error: error.message, code: error.code };
  if (error.suggestions.length > 0) output.help = error.suggestions;
  return encode(output);
}

export function resolveSiteOrUndefined(flagValue: string | undefined): SiteContext | undefined {
  try {
    return resolveSite(flagValue);
  } catch (error) {
    // Only swallow the "nothing configured at all" case: commands that need a
    // resolved site throw their own missingSiteError() when they see
    // `undefined`; commands that don't (`site`, `setup`) work fine before any
    // site is registered. A genuine unknown-site error (bad --site value)
    // must propagate with its specific suggestions.
    if (error instanceof AxiError && error.code === "SITE_NOT_RESOLVED") {
      return undefined;
    }
    throw error;
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
