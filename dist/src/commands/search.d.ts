import type { SiteContext } from "../context.js";
export declare const SEARCH_HELP = "usage: jira-axi search <text> [--project K]\nexamples:\n  jira-axi search \"payment timeout\"\n  jira-axi search \"payment timeout\" --project PROJ\n";
export declare function searchCommand(args: string[], site: SiteContext | undefined): Promise<string>;
