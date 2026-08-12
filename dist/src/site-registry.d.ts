export interface SiteEntry {
    host: string;
}
export interface SiteRegistryConfig {
    sites: Record<string, SiteEntry>;
    defaultSite?: string;
}
export declare function readConfig(): SiteRegistryConfig;
export declare function addSite(alias: string, host: string): SiteRegistryConfig;
export declare function useSite(alias: string): SiteRegistryConfig;
export declare function removeSite(alias: string): SiteRegistryConfig;
