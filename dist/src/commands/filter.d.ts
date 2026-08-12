import type { SiteContext } from "../context.js";
export declare const FILTER_HELP = "usage: jira-axi filter <subcommand> [args]\nsubcommands[2]:\n  list\n  run <id>\nexamples:\n  jira-axi filter list\n  jira-axi filter run 10042\n";
export declare function filterCommand(args: string[], site: SiteContext | undefined): Promise<string>;
