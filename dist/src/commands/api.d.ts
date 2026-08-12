import type { SiteContext } from "../context.js";
export declare const API_HELP = "usage: jira-axi api [--method GET] <path>\njira-axi is read-only in v1: any method other than GET exits 2.\nOutput is raw JSON, not TOON \u2014 this is an escape hatch, not the normal path.\nexamples:\n  jira-axi api /rest/api/3/myself\n  jira-axi api /rest/api/3/project/PROJ\n";
export declare function apiCommand(args: string[], site: SiteContext | undefined): Promise<string>;
