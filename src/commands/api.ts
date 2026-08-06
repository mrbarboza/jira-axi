import { AxiError } from "axi-sdk-js";
import { getFlag, getPositional } from "../args.js";
import type { SiteContext } from "../context.js";
import { JiraClient } from "../client.js";
import { writeNotSupportedError } from "../errors.js";

export const API_HELP = `usage: jira-axi api [--method GET] <path>
jira-axi is read-only in v1: any method other than GET exits 2.
Output is raw JSON, not TOON — this is an escape hatch, not the normal path.
examples:
  jira-axi api /rest/api/3/myself
  jira-axi api /rest/api/3/project/PROJ
`;

export async function apiCommand(args: string[], site: SiteContext | undefined): Promise<string> {
  if (!site) {
    throw new AxiError("no site resolved", "SITE_NOT_RESOLVED");
  }
  const method = (getFlag(args, "--method") ?? "GET").toUpperCase();
  if (method !== "GET") {
    throw writeNotSupportedError(method);
  }

  const path = getPositional(args, 0);
  if (!path) {
    throw new AxiError("usage: jira-axi api [--method GET] <path>", "VALIDATION_ERROR");
  }

  const client = new JiraClient({ site });
  const result = await client.get(path);
  return JSON.stringify(result, null, 2);
}
