import type { SiteContext } from "../context.js";
export declare const ISSUE_HELP = "usage: nu-jira-axi issue <subcommand> [flags]\nsubcommands[3]:\n  list [--mine] [--jql Q] [--project K] [--status S] [--sprint current] [--assignee U] [--label L] [--fix-version V] [--limit 50]\n  view <KEY> [--comments] [--full]\n  tree <KEY> [--depth 2]\nexamples:\n  nu-jira-axi issue list --mine --sprint current\n  nu-jira-axi issue view PROJ-123 --comments\n  nu-jira-axi issue tree PROJ-100\n";
export declare function issueCommand(args: string[], site: SiteContext | undefined): Promise<string>;
/**
 * The shared "run JQL, normalize, render a table" path — reused by issue
 * list, saved filters (filter.ts), and free-text search (search.ts), all of
 * which end in the same rendered shape with a different JQL source.
 */
export declare function runIssueSearch(site: SiteContext, jql: string, source: string, limit?: number): Promise<string>;
