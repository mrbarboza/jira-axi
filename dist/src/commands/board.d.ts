import type { SiteContext } from "../context.js";
export declare const BOARD_HELP = "usage: jira-axi board <subcommand> [flags]\nsubcommands[1]:\n  list [--project K]\nexamples:\n  jira-axi board list --project PROJ\n";
export declare function boardCommand(args: string[], site: SiteContext | undefined): Promise<string>;
