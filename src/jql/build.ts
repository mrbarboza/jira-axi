import { AxiError } from "axi-sdk-js";

export interface JqlOptions {
  jql?: string;
  mine?: boolean;
  project?: string;
  status?: string;
  sprint?: string;
  assignee?: string;
  label?: string;
  fixVersion?: string;
}

export type JqlSource = "explicit" | "built";

export interface JqlResult {
  jql: string;
  source: JqlSource;
}

/**
 * Compile shorthand flags into JQL, always echoing back what actually ran —
 * an agent debugging an empty result needs to see the real query, not guess.
 */
export function buildJql(options: JqlOptions): JqlResult {
  if (options.jql) {
    return { jql: options.jql, source: "explicit" };
  }

  const clauses: string[] = [];
  if (options.mine) clauses.push("assignee = currentUser()");
  if (options.assignee) clauses.push(`assignee = ${quote(options.assignee)}`);
  if (options.project) clauses.push(`project = ${quote(options.project)}`);
  if (options.status) clauses.push(`status = ${quote(options.status)}`);
  if (options.label) clauses.push(`labels = ${quote(options.label)}`);
  if (options.sprint === "current") clauses.push("sprint in openSprints()");
  else if (options.sprint) clauses.push(`sprint = ${quote(options.sprint)}`);
  if (options.fixVersion) clauses.push(`fixVersion = ${quote(options.fixVersion)}`);

  if (clauses.length === 0) {
    throw new AxiError(
      "no filter given: pass --jql, or at least one of --mine/--project/--status/--sprint/--assignee/--label/--fix-version",
      "VALIDATION_ERROR",
    );
  }

  return { jql: `${clauses.join(" AND ")} ORDER BY updated DESC`, source: "built" };
}

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

/** Compile a free-text search into JQL's `text ~` clause, optionally scoped to a project. */
export function buildTextSearchJql(text: string, project?: string): JqlResult {
  const clauses = [`text ~ ${quote(text)}`];
  if (project) clauses.push(`project = ${quote(project)}`);
  return { jql: `${clauses.join(" AND ")} ORDER BY updated DESC`, source: "built" };
}
