import { fieldName, type FieldCacheFile } from "../fields.js";
interface JiraUser {
    displayName?: string;
    emailAddress?: string;
}
interface JiraIssueFields {
    summary?: string;
    status?: {
        name?: string;
    };
    assignee?: JiraUser | null;
    reporter?: JiraUser | null;
    priority?: {
        name?: string;
    };
    labels?: string[];
    updated?: string;
    description?: unknown;
    parent?: {
        key?: string;
        fields?: {
            summary?: string;
        };
    };
    [customFieldId: string]: unknown;
}
export interface JiraIssue {
    key: string;
    fields: JiraIssueFields;
}
export interface NormalizedIssue {
    key: string;
    summary: string;
    status: string;
    assignee: string;
    reporter: string;
    priority: string;
    labels: string;
    updated: string;
    epic: string;
    description: string;
}
/**
 * Raw issue envelope -> the flat row an agent actually reads. Custom fields
 * resolve through the site's field cache since customfield_XXXXX is opaque
 * and host-specific; the epic link is read that way for team-managed
 * projects, falling back to `parent` for company-managed / next-gen ones.
 */
export declare function normalizeIssue(issue: JiraIssue, fields: FieldCacheFile): NormalizedIssue;
/** Field name lookup re-exported so callers building a --fields allowlist can resolve ids the same way. */
export { fieldName };
