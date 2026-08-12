/** Reads the stored secret for a site, or throws if none is set. Callers treat any throw as "no secret". */
export declare function readSecret(host: string): string;
/** Stores (or replaces) the secret for a site. Never logs the value. */
export declare function writeSecret(host: string, value: string): void;
export declare function hasSecret(host: string): boolean;
