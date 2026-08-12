/**
 * (context) -> next-command suggestions. Mirrors gh-axi's suggestions.ts:
 * contextual disclosure instead of a standing tool schema — the CLI itself
 * teaches the next complete command to run.
 */
export declare function issueListSuggestions(context: {
    jql: string;
    count: number;
}): string[];
export declare function issueViewSuggestions(context: {
    key: string;
}): string[];
