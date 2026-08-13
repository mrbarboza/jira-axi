import type { SiteContext } from "../context.js";
export declare const PROJECT_HELP = "usage: nu-jira-axi project <subcommand> <KEY>\nsubcommands[3]:\n  view <KEY>\n  fields <KEY>\n  types <KEY>\nexamples:\n  nu-jira-axi project view PROJ\n  nu-jira-axi project types PROJ\n";
export declare function projectCommand(args: string[], site: SiteContext | undefined): Promise<string>;
