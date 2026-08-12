export declare const SITE_HELP = "usage: jira-axi site <subcommand> [args]\nsubcommands[4]:\n  list, add <alias> <host>, use <alias>, remove <alias>\nexamples:\n  jira-axi site add work acme.atlassian.net\n  jira-axi site use work\n  jira-axi site list\n";
export declare function siteCommand(args: string[]): Promise<string>;
