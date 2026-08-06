import { adfToMarkdown } from "../adf.js";
import { fieldId, fieldName, type FieldCacheFile } from "../fields.js";
import { relativeTime } from "../relativeTime.js";

interface JiraUser {
  displayName?: string;
  emailAddress?: string;
}

interface JiraIssueFields {
  summary?: string;
  status?: { name?: string };
  assignee?: JiraUser | null;
  reporter?: JiraUser | null;
  priority?: { name?: string };
  labels?: string[];
  updated?: string;
  description?: unknown;
  parent?: { key?: string; fields?: { summary?: string } };
  [customFieldId: string]: unknown;
}

export interface JiraIssue {
  key: string;
  fields: JiraIssueFields;
}

export interface NormalizedIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string;
  reporter: string;
  priority: string;
  labels: string;
  updated: string;
  epic: string;
  description: string;
}

/**
 * Raw issue envelope -> the flat row an agent actually reads. Custom fields
 * resolve through the site's field cache since customfield_XXXXX is opaque
 * and host-specific; the epic link is read that way for team-managed
 * projects, falling back to `parent` for company-managed / next-gen ones.
 */
export function normalizeIssue(issue: JiraIssue, fields: FieldCacheFile): NormalizedIssue {
  const f = issue.fields;
  return {
    key: issue.key,
    summary: f.summary ?? "",
    status: f.status?.name ?? "",
    assignee: displayName(f.assignee),
    reporter: displayName(f.reporter),
    priority: f.priority?.name ?? "",
    labels: (f.labels ?? []).join(","),
    updated: f.updated ? relativeTime(f.updated) : "",
    epic: resolveEpic(f, fields),
    description: adfToMarkdown(f.description as never),
  };
}

function displayName(user: JiraUser | null | undefined): string {
  return user?.displayName ?? "unassigned";
}

function resolveEpic(f: JiraIssueFields, fields: FieldCacheFile): string {
  if (f.parent?.fields?.summary) {
    return f.parent.key ? `${f.parent.key} ${f.parent.fields.summary}` : f.parent.fields.summary;
  }
  const epicLinkId = fieldId(fields, "Epic Link");
  const epicLinkValue = epicLinkId ? f[epicLinkId] : undefined;
  if (typeof epicLinkValue === "string") return epicLinkValue;
  return "";
}

/** Field name lookup re-exported so callers building a --fields allowlist can resolve ids the same way. */
export { fieldName };
