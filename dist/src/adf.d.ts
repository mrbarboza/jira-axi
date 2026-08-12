/**
 * Atlassian Document Format -> markdown, read-only. ADF -> markdown is lossy
 * for exotic node types (panels, status lozenges, tables), which is
 * acceptable for display; markdown -> ADF for writes is deferred to P2.
 */
interface AdfMark {
    type: string;
    attrs?: Record<string, unknown>;
}
interface AdfNode {
    type: string;
    text?: string;
    marks?: AdfMark[];
    attrs?: Record<string, unknown>;
    content?: AdfNode[];
}
export declare function adfToMarkdown(doc: AdfNode | undefined | null): string;
export {};
