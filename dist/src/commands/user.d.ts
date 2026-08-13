import type { SiteContext } from "../context.js";
export declare const USER_HELP = "usage: nu-jira-axi user <subcommand>\nsubcommands[1]:\n  whoami\nexamples:\n  nu-jira-axi user whoami --site work\n";
export declare function userCommand(args: string[], site: SiteContext | undefined): Promise<string>;
