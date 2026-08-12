import { homedir } from "node:os";
import { join } from "node:path";
export function jiraAxiHome() {
    return join(homedir(), ".jira-axi");
}
export function siteCacheDir(host) {
    return join(jiraAxiHome(), "cache", host);
}
//# sourceMappingURL=paths.js.map