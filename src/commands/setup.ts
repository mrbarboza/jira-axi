import open from "open";
import { AxiError, installSessionStartHooks } from "axi-sdk-js";
import { getFlag, hasFlag } from "../args.js";
import { resolveSite } from "../context.js";
import { buildAuthorizeUrl, exchangeCodeForToken, fetchAccessibleResources, listenForCallback, randomState } from "../oauth.js";
import { saveSession } from "../oauth-store.js";
import { cloudIdResolutionError } from "../errors.js";
import * as toon from "../toon.js";

export const SETUP_HELP = `usage: jira-axi setup <subcommand> [flags]
subcommands[3]:
  auth --site <alias>    # opens a browser to authorize this site
  hooks                   # install the SessionStart hook
  skill --check           # check whether the skill doc is stale
examples:
  jira-axi site add work acme.atlassian.net
  jira-axi setup auth --site work
  jira-axi setup hooks
`;

export async function setupCommand(args: string[]): Promise<string> {
  const [subcommand, ...rest] = args;
  switch (subcommand) {
    case "auth":
      return setupAuth(rest);
    case "hooks":
      return setupHooks();
    case "skill":
      return setupSkill(rest);
    default:
      throw new AxiError(`unknown setup subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
        "Run `jira-axi setup --help` to see subcommands",
      ]);
  }
}

async function setupAuth(args: string[]): Promise<string> {
  const siteFlag = getFlag(args, "--site");
  const site = resolveSite(siteFlag);

  const state = randomState();
  const callbackPromise = listenForCallback(state, site.host);
  callbackPromise.catch(() => {});
  await openBrowserOrPrintUrl(buildAuthorizeUrl(state).toString());
  const { code } = await callbackPromise;

  const exchanged = await exchangeCodeForToken(code);
  const resources = await fetchAccessibleResources(exchanged.accessToken);
  const matched = resources.find((r) => new URL(r.url).host === site.host);
  if (!matched) {
    throw cloudIdResolutionError(
      site.host,
      resources.map((r) => new URL(r.url).host),
    );
  }

  saveSession(site.host, {
    version: 1,
    accessToken: exchanged.accessToken,
    refreshToken: exchanged.refreshToken,
    accessTokenExpiresAt: Date.now() + exchanged.expiresIn * 1000,
    cloudId: matched.id,
    scope: exchanged.scope,
  });

  return toon.combine(
    toon.pair("authenticated", site.host),
    toon.pair("cloudId", matched.id),
    toon.help([`Run \`jira-axi user whoami --site ${site.alias ?? site.host}\` to confirm`]),
  );
}

/** Opens the system browser; falls back to printing the URL for headless/SSH sessions where launch fails. */
async function openBrowserOrPrintUrl(url: string): Promise<void> {
  process.stderr.write(`Open this URL to authorize jira-axi:\n${url}\n`);
  try {
    await open(url, { wait: true });
  } catch {
    // Browser failed to open; URL was already printed above.
  }
}

function setupHooks(): string {
  installSessionStartHooks({ marker: "jira-axi", binaryNames: ["jira-axi"] });
  return toon.pair("hooks", "installed");
}

/**
 * Staleness gate for the generated skill doc. Full generation is P4 work;
 * this stub only reports that no skill doc exists yet, so `--check` is a
 * safe no-op until then rather than a command that silently does nothing.
 */
function setupSkill(args: string[]): string {
  if (!hasFlag(args, "--check")) {
    throw new AxiError("usage: jira-axi setup skill --check", "VALIDATION_ERROR");
  }
  return toon.combine(
    toon.pair("skill", "not yet generated"),
    toon.help(["Skill generation lands in a later phase; nothing to check yet"]),
  );
}
