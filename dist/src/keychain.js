import { execFileSync } from "node:child_process";
function serviceName(host) {
    return `jira-axi:${host}`;
}
/** Reads the stored secret for a site, or throws if none is set. Callers treat any throw as "no secret". */
export function readSecret(host) {
    return execFileSync("security", ["find-generic-password", "-s", serviceName(host), "-a", host, "-w"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}
/** Stores (or replaces) the secret for a site. Never logs the value. */
export function writeSecret(host, value) {
    // -U updates in place if an item with this service+account already exists.
    execFileSync("security", [
        "add-generic-password",
        "-s",
        serviceName(host),
        "-a",
        host,
        "-w",
        value,
        "-U",
    ]);
}
export function hasSecret(host) {
    try {
        readSecret(host);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=keychain.js.map