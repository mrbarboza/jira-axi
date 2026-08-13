import type { SiteContext } from "../context.js";
export declare const SPRINT_HELP = "usage: nu-jira-axi sprint <subcommand> [flags]\nsubcommands[2]:\n  current [--board B] [--project K] [--fix-version V]   # active sprint + status/points rollup\n  list --board B                       # all sprints on a board\nexamples:\n  nu-jira-axi sprint current --project PROJ\n  nu-jira-axi sprint list --board 42\n";
export declare function sprintCommand(args: string[], site: SiteContext | undefined): Promise<string>;
