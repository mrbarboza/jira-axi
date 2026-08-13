import type { SiteContext } from "../context.js";
export declare const SPRINT_HELP = "usage: jira-axi sprint <subcommand> [flags]\nsubcommands[2]:\n  current [--board B] [--project K] [--fix-version V]   # active sprint + status/points rollup\n  list --board B                       # all sprints on a board\nexamples:\n  jira-axi sprint current --project PROJ\n  jira-axi sprint list --board 42\n";
export declare function sprintCommand(args: string[], site: SiteContext | undefined): Promise<string>;
