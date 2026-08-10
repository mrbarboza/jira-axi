import { AxiError } from "axi-sdk-js";
import { getFlag, getPositional } from "../args.js";
import type { SiteContext } from "../context.js";
import { missingSiteError } from "../errors.js";
import { buildTextSearchJql } from "../jql/build.js";
import { runIssueSearch } from "./issue.js";

export const SEARCH_HELP = `usage: jira-axi search <text> [--project K]
examples:
  jira-axi search "payment timeout"
  jira-axi search "payment timeout" --project PROJ
`;

export async function searchCommand(args: string[], site: SiteContext | undefined): Promise<string> {
  if (!site) {
    throw missingSiteError();
  }
  const text = getPositional(args, 0);
  if (!text) {
    throw new AxiError("usage: jira-axi search <text> [--project K]", "VALIDATION_ERROR");
  }
  const { jql, source } = buildTextSearchJql(text, getFlag(args, "--project"));
  return runIssueSearch(site, jql, source);
}
