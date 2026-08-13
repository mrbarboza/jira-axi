export declare const SITE_HELP = "usage: nu-jira-axi site <subcommand> [args]\nsubcommands[4]:\n  list, add <alias> <host>, use <alias>, remove <alias>\nexamples:\n  nu-jira-axi site add work acme.atlassian.net\n  nu-jira-axi site use work\n  nu-jira-axi site list\n";
export declare function siteCommand(args: string[]): Promise<string>;
