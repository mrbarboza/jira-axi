import { AxiError } from "axi-sdk-js";
import { getFlag, getPositional, hasFlag } from "../args.js";
import type { SiteContext } from "../context.js";
import { JiraClient } from "../client.js";
import { loadFields, fieldId } from "../fields.js";
import { normalizeIssue, type JiraIssue } from "../normalize/issue.js";
import { buildJql } from "../jql/build.js";
import { adfToMarkdown } from "../adf.js";
import * as toon from "../toon.js";
import { issueListSuggestions, issueViewSuggestions } from "../suggestions.js";

export const ISSUE_HELP = `usage: jira-axi issue <subcommand> [flags]
subcommands[2]:
  list [--mine] [--jql Q] [--project K] [--status S] [--sprint current] [--assignee U] [--label L] [--limit 50]
  view <KEY> [--comments] [--full]
examples:
  jira-axi issue list --mine --sprint current
  jira-axi issue view PROJ-123 --comments
`;

const BASE_FIELDS = ["summary", "status", "assignee", "priority", "labels", "updated", "parent"];
const VIEW_EXTRA_FIELDS = ["description", "reporter"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DESCRIPTION_TRUNCATE_AT = 1500;

export async function issueCommand(args: string[], site: SiteContext | undefined): Promise<string> {
  const [subcommand, ...rest] = args;
  if (!site) {
    throw new AxiError("no site resolved", "SITE_NOT_RESOLVED");
  }
  switch (subcommand) {
    case "list":
      return issueList(rest, site);
    case "view":
      return issueView(rest, site);
    default:
      throw new AxiError(`unknown issue subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
        "Run `jira-axi issue --help` to see subcommands",
      ]);
  }
}

async function issueList(args: string[], site: SiteContext): Promise<string> {
  const { jql, source } = buildJql({
    jql: getFlag(args, "--jql"),
    mine: hasFlag(args, "--mine"),
    project: getFlag(args, "--project"),
    status: getFlag(args, "--status"),
    sprint: getFlag(args, "--sprint"),
    assignee: getFlag(args, "--assignee"),
    label: getFlag(args, "--label"),
  });
  const limit = Math.min(Number(getFlag(args, "--limit") ?? DEFAULT_LIMIT), MAX_LIMIT);

  const fields = await loadFields(site);
  const client = new JiraClient({ site });
  const allowlist = withEpicField(BASE_FIELDS, fields);
  const response = (await client.get("/rest/api/3/search", {
    jql,
    fields: allowlist.join(","),
    maxResults: limit,
  })) as { issues: JiraIssue[] };

  const rows = response.issues.map((issue) => {
    const row = normalizeIssue(issue, fields);
    return {
      key: row.key,
      summary: row.summary,
      status: row.status,
      assignee: row.assignee,
      priority: row.priority,
      updated: row.updated,
    };
  });

  return toon.combine(
    toon.table("issues", rows),
    toon.pair("jql", `${jql} (${source})`),
    toon.help(issueListSuggestions({ jql, count: rows.length })),
  );
}

async function issueView(args: string[], site: SiteContext): Promise<string> {
  const key = getPositional(args, 0);
  if (!key) {
    throw new AxiError("usage: jira-axi issue view <KEY>", "VALIDATION_ERROR");
  }
  const full = hasFlag(args, "--full");
  const withComments = hasFlag(args, "--comments");

  const fields = await loadFields(site);
  const client = new JiraClient({ site });
  const allowlist = withEpicField([...BASE_FIELDS, ...VIEW_EXTRA_FIELDS], fields);
  const issue = (await client.get(`/rest/api/3/issue/${key}`, { fields: allowlist.join(",") })) as JiraIssue;

  const row = normalizeIssue(issue, fields);
  const description = truncate(row.description, full);

  const blocks = [
    toon.detail("issue", { ...row, description }),
  ];

  if (withComments) {
    blocks.push(await renderComments(client, key));
  }

  blocks.push(toon.help(issueViewSuggestions({ key })));
  return toon.combine(...blocks);
}

async function renderComments(client: JiraClient, key: string): Promise<string> {
  const response = (await client.get(`/rest/api/3/issue/${key}/comment`)) as {
    comments: Array<{ author?: { displayName?: string }; created?: string; body?: unknown }>;
  };
  const rows = response.comments.map((comment) => ({
    author: comment.author?.displayName ?? "unknown",
    created: comment.created ?? "",
    body: adfToMarkdown(comment.body as never),
  }));
  return toon.table("comments", rows);
}

function withEpicField(base: string[], fields: Awaited<ReturnType<typeof loadFields>>): string[] {
  const epicLinkId = fieldId(fields, "Epic Link");
  return epicLinkId ? [...base, epicLinkId] : base;
}

function truncate(text: string, full: boolean): string {
  if (full || text.length <= DESCRIPTION_TRUNCATE_AT) return text;
  return `${text.slice(0, DESCRIPTION_TRUNCATE_AT)}... (truncated, pass --full to see all ${text.length} chars)`;
}
