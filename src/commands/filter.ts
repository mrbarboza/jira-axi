import { AxiError } from "axi-sdk-js";
import { getPositional } from "../args.js";
import type { SiteContext } from "../context.js";
import { JiraClient } from "../client.js";
import { missingSiteError } from "../errors.js";
import { runIssueSearch } from "./issue.js";
import * as toon from "../toon.js";

export const FILTER_HELP = `usage: jira-axi filter <subcommand> [args]
subcommands[2]:
  list
  run <id>
examples:
  jira-axi filter list
  jira-axi filter run 10042
`;

interface JiraFilter {
  id: string;
  name: string;
  jql: string;
  owner?: { displayName?: string };
}

export async function filterCommand(args: string[], site: SiteContext | undefined): Promise<string> {
  const [subcommand, ...rest] = args;
  if (!site) {
    throw missingSiteError();
  }
  switch (subcommand) {
    case "list":
      return filterList(site);
    case "run":
      return filterRun(rest, site);
    default:
      throw new AxiError(`unknown filter subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
        "Run `jira-axi filter --help` to see subcommands",
      ]);
  }
}

async function filterList(site: SiteContext): Promise<string> {
  const client = new JiraClient({ site });
  const response = (await client.get("/rest/api/3/filter/search")) as { values: JiraFilter[] };
  const rows = response.values.map((filter) => ({
    id: filter.id,
    name: filter.name,
    owner: filter.owner?.displayName ?? "",
  }));
  return toon.combine(toon.table("filters", rows), toon.help(["Run `jira-axi filter run <id>` to see its issues"]));
}

async function filterRun(args: string[], site: SiteContext): Promise<string> {
  const id = getPositional(args, 0);
  if (!id) {
    throw new AxiError("usage: jira-axi filter run <id>", "VALIDATION_ERROR");
  }
  const client = new JiraClient({ site });
  const filter = (await client.get(`/rest/api/3/filter/${id}`)) as JiraFilter;
  return runIssueSearch(site, filter.jql, `filter ${filter.name}`);
}
