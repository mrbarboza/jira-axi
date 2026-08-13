import type { SiteContext } from "../context.js";
export declare const API_HELP = "usage: nu-jira-axi api [--method GET] <path>\nnu-jira-axi is read-only in v1: any method other than GET exits 2.\nOutput is raw JSON, not TOON \u2014 this is an escape hatch, not the normal path.\nexamples:\n  nu-jira-axi api /rest/api/3/myself\n  nu-jira-axi api /rest/api/3/project/PROJ\n";
export declare function apiCommand(args: string[], site: SiteContext | undefined): Promise<string>;
