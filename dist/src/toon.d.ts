export type ToonPrimitive = string | number | boolean | null;
export type ToonRow = Record<string, ToonPrimitive>;
/** Render a single label: value line, e.g. "site: acme.atlassian.net". */
export declare function pair(label: string, value: ToonPrimitive): string;
/** Render a labeled table. TOON declares the row schema once, not per row. */
export declare function table(label: string, rows: ToonRow[]): string;
/** Render a single labeled detail object. */
export declare function detail(label: string, row: ToonRow): string;
/** Render up to N contextual "what to run next" suggestions. */
export declare function help(lines: string[]): string;
/** Combine multiple TOON blocks (some possibly empty) into one output string. */
export declare function combine(...blocks: string[]): string;
