import type { SiteContext } from "../context.js";
export declare const SEARCH_HELP = "usage: nu-jira-axi search <text> [--project K]\nexamples:\n  nu-jira-axi search \"payment timeout\"\n  nu-jira-axi search \"payment timeout\" --project PROJ\n";
export declare function searchCommand(args: string[], site: SiteContext | undefined): Promise<string>;
