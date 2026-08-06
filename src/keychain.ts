import { execFileSync } from "node:child_process";
import { missingTokenError } from "./errors.js";

function serviceName(host: string): string {
  return `jira-axi:${host}`;
}

/** Reads the stored API token for a site, or throws if none is set. */
export function getToken(host: string): string {
  try {
    return execFileSync(
      "security",
      ["find-generic-password", "-s", serviceName(host), "-a", host, "-w"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    throw missingTokenError(host);
  }
}

/** Stores (or replaces) the API token for a site. Never logs the value. */
export function setToken(host: string, token: string): void {
  // -U updates in place if an item with this service+account already exists.
  execFileSync("security", [
    "add-generic-password",
    "-s",
    serviceName(host),
    "-a",
    host,
    "-w",
    token,
    "-U",
  ]);
}

export function hasToken(host: string): boolean {
  try {
    getToken(host);
    return true;
  } catch {
    return false;
  }
}
