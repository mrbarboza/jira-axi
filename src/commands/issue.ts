import { AxiError } from "axi-sdk-js";
import { getFlag, getPositional, hasFlag } from "../args.js";
import type { SiteContext } from "../context.js";
import { JiraClient } from "../client.js";
import { missingSiteError } from "../errors.js";
import { loadFields, fieldId } from "../fields.js";
import { normalizeIssue, type JiraIssue } from "../normalize/issue.js";
import { buildJql } from "../jql/build.js";
import { adfToMarkdown } from "../adf.js";
import * as toon from "../toon.js";
import { issueListSuggestions, issueViewSuggestions } from "../suggestions.js";

export const ISSUE_HELP = `usage: jira-axi issue <subcommand> [flags]
subcommands[3]:
  list [--mine] [--jql Q] [--project K] [--status S] [--sprint current] [--assignee U] [--label L] [--limit 50]
  view <KEY> [--comments] [--full]
  tree <KEY> [--depth 2]
examples:
  jira-axi issue list --mine --sprint current
  jira-axi issue view PROJ-123 --comments
  jira-axi issue tree PROJ-100
`;

const BASE_FIELDS = ["summary", "status", "assignee", "priority", "labels", "updated", "parent"];
const VIEW_EXTRA_FIELDS = ["description", "reporter"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const DESCRIPTION_TRUNCATE_AT = 1500;

export async function issueCommand(args: string[], site: SiteContext | undefined): Promise<string> {
  const [subcommand, ...rest] = args;
  if (!site) {
    throw missingSiteError();
  }
  switch (subcommand) {
    case "list":
      return issueList(rest, site);
    case "view":
      return issueView(rest, site);
    case "tree":
      return issueTree(rest, site);
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
  return runIssueSearch(site, jql, source, limit);
}

/**
 * The shared "run JQL, normalize, render a table" path — reused by issue
 * list, saved filters (filter.ts), and free-text search (search.ts), all of
 * which end in the same rendered shape with a different JQL source.
 */
export async function runIssueSearch(
  site: SiteContext,
  jql: string,
  source: string,
  limit: number = DEFAULT_LIMIT,
): Promise<string> {
  const fields = await loadFields(site);
  const client = new JiraClient({ site });
  const allowlist = withEpicField(BASE_FIELDS, fields);
  const response = (await client.get("/rest/api/3/search/jql", {
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

interface TreeNode {
  key: string;
  summary: string;
  status: string;
}

interface TreeNodeWithParent extends TreeNode {
  parentKey: string;
}

/**
 * Resolve epic children + subtasks in one bounded JQL per level rather than
 * an MCP-style walk of one call per issue — the multi-call-to-one-call
 * collapse the ADR calls out for `issue tree`.
 */
async function issueTree(args: string[], site: SiteContext): Promise<string> {
  const key = getPositional(args, 0);
  if (!key) {
    throw new AxiError("usage: jira-axi issue tree <KEY> [--depth 2]", "VALIDATION_ERROR");
  }
  const depth = Math.min(Math.max(Number(getFlag(args, "--depth") ?? "2"), 1), 3);

  const fields = await loadFields(site);
  const client = new JiraClient({ site });
  const root = (await client.get(`/rest/api/3/issue/${key}`, { fields: "summary,status" })) as JiraIssue;
  const rootNode = toTreeNode(root);

  const children = await fetchTreeLevel(client, childrenJql(key, fieldId(fields, "Epic Link")));
  const statusCounts = new Map<string, number>([[rootNode.status, 1]]);
  addCounts(statusCounts, children);

  let byParent = new Map<string, TreeNode[]>();
  if (depth >= 2 && children.length > 0) {
    const subtasks = await fetchTreeLevelWithParent(
      client,
      `parent in (${children.map((c) => quoteKey(c.key)).join(",")})`,
    );
    addCounts(statusCounts, subtasks);
    byParent = groupByParent(subtasks);
  }

  const lines = [renderTreeLine(rootNode, 0)];
  for (const child of children) {
    lines.push(renderTreeLine(child, 1));
    for (const subtask of byParent.get(child.key) ?? []) {
      lines.push(renderTreeLine(subtask, 2));
    }
  }

  return toon.combine(
    lines.join("\n"),
    toon.table(
      "statusCounts",
      [...statusCounts.entries()].map(([status, count]) => ({ status, count })),
    ),
    toon.help([`Run \`jira-axi issue view ${key}\` to see the epic's own detail`]),
  );
}

async function fetchTreeLevel(client: JiraClient, jql: string): Promise<TreeNode[]> {
  const response = (await client.get("/rest/api/3/search/jql", {
    jql,
    fields: "summary,status",
    maxResults: 100,
  })) as { issues: JiraIssue[] };
  return response.issues.map(toTreeNode);
}

async function fetchTreeLevelWithParent(client: JiraClient, jql: string): Promise<TreeNodeWithParent[]> {
  const response = (await client.get("/rest/api/3/search/jql", {
    jql,
    fields: "summary,status,parent",
    maxResults: 100,
  })) as { issues: Array<JiraIssue & { fields: { parent?: { key?: string } } }> };
  return response.issues.map((issue) => ({
    ...toTreeNode(issue),
    parentKey: issue.fields.parent?.key ?? "",
  }));
}

function groupByParent(nodes: TreeNodeWithParent[]): Map<string, TreeNode[]> {
  const byParent = new Map<string, TreeNode[]>();
  for (const node of nodes) {
    const list = byParent.get(node.parentKey) ?? [];
    list.push(node);
    byParent.set(node.parentKey, list);
  }
  return byParent;
}

function toTreeNode(issue: JiraIssue): TreeNode {
  return {
    key: issue.key,
    summary: issue.fields.summary ?? "",
    status: issue.fields.status?.name ?? "",
  };
}

function renderTreeLine(node: TreeNode, level: number): string {
  return `${"  ".repeat(level)}${node.key} ${node.summary} [${node.status}]`;
}

function addCounts(counts: Map<string, number>, nodes: TreeNode[]): void {
  for (const node of nodes) {
    counts.set(node.status, (counts.get(node.status) ?? 0) + 1);
  }
}

function childrenJql(key: string, epicLinkFieldId: string | undefined): string {
  const parentClause = `parent = ${quoteKey(key)}`;
  if (!epicLinkFieldId) return parentClause;
  const numericId = epicLinkFieldId.replace("customfield_", "");
  return `(cf[${numericId}] = ${quoteKey(key)} OR ${parentClause})`;
}

function quoteKey(key: string): string {
  return `"${key.replace(/"/g, '\\"')}"`;
}

function withEpicField(base: string[], fields: Awaited<ReturnType<typeof loadFields>>): string[] {
  const epicLinkId = fieldId(fields, "Epic Link");
  return epicLinkId ? [...base, epicLinkId] : base;
}

function truncate(text: string, full: boolean): string {
  if (full || text.length <= DESCRIPTION_TRUNCATE_AT) return text;
  return `${text.slice(0, DESCRIPTION_TRUNCATE_AT)}... (truncated, pass --full to see all ${text.length} chars)`;
}
