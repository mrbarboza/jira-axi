export interface JqlOptions {
    jql?: string;
    mine?: boolean;
    project?: string;
    status?: string;
    sprint?: string;
    assignee?: string;
    label?: string;
}
export type JqlSource = "explicit" | "built";
export interface JqlResult {
    jql: string;
    source: JqlSource;
}
/**
 * Compile shorthand flags into JQL, always echoing back what actually ran —
 * an agent debugging an empty result needs to see the real query, not guess.
 */
export declare function buildJql(options: JqlOptions): JqlResult;
/** Compile a free-text search into JQL's `text ~` clause, optionally scoped to a project. */
export declare function buildTextSearchJql(text: string, project?: string): JqlResult;
