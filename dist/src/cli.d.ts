import { type SiteContext } from "./context.js";
export declare const DESCRIPTION = "Agent-ergonomic CLI for Jira Cloud \u2014 token-efficient TOON output, pre-computed aggregates. Read-only v1.";
export declare const TOP_HELP = "usage: jira-axi [command] [args] [flags]\ncommands[10]: (none)=dashboard, site, setup, user, issue, sprint, board, project, filter, search, api\nglobal: --site <alias|host> on any command, overriding JIRA_AXI_SITE / .jira-axi.json / default site\nexamples:\n  jira-axi\n  jira-axi site add work acme.atlassian.net\n  jira-axi setup auth --site work\n  jira-axi user whoami\n  jira-axi issue list --mine\n  jira-axi sprint current --project PROJ\n";
export declare function main(options?: {
    argv?: string[];
    stdout?: {
        write: (chunk: string) => unknown;
    };
}): Promise<void>;
export declare function resolveSiteOrUndefined(flagValue: string | undefined): SiteContext | undefined;
