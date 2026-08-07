import { execFileSync } from "node:child_process";

function serviceName(host: string): string {
  return `jira-axi:${host}`;
}

/** Reads the stored secret for a site, or throws if none is set. Callers treat any throw as "no secret". */
export function readSecret(host: string): string {
  return execFileSync(
    "security",
    ["find-generic-password", "-s", serviceName(host), "-a", host, "-w"],
    { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
  ).trim();
}

/** Stores (or replaces) the secret for a site. Never logs the value. */
export function writeSecret(host: string, value: string): void {
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

export function hasSecret(host: string): boolean {
  try {
    readSecret(host);
    return true;
  } catch {
    return false;
  }
}
