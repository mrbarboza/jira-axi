import { AxiError } from "axi-sdk-js";
import { getFlag } from "../args.js";
import type { SiteContext } from "../context.js";
import { JiraClient } from "../client.js";
import type { JiraBoard } from "../agile.js";
import * as toon from "../toon.js";

export const BOARD_HELP = `usage: jira-axi board <subcommand> [flags]
subcommands[1]:
  list [--project K]
examples:
  jira-axi board list --project PROJ
`;

export async function boardCommand(args: string[], site: SiteContext | undefined): Promise<string> {
  const [subcommand, ...rest] = args;
  if (!site) {
    throw new AxiError("no site resolved", "SITE_NOT_RESOLVED");
  }
  switch (subcommand) {
    case "list":
      return boardList(rest, site);
    default:
      throw new AxiError(`unknown board subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
        "Run `jira-axi board --help` to see subcommands",
      ]);
  }
}

async function boardList(args: string[], site: SiteContext): Promise<string> {
  const client = new JiraClient({ site });
  const project = getFlag(args, "--project");
  const response = (await client.get("/rest/agile/1.0/board", project ? { projectKeyOrId: project } : {})) as {
    values: JiraBoard[];
  };
  const rows = response.values.map((board) => ({ id: board.id, name: board.name, type: board.type }));
  return toon.combine(
    toon.table("boards", rows),
    toon.help(["Run `jira-axi sprint current --board <id>` to see a board's active sprint"]),
  );
}
