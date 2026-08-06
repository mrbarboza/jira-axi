import { homedir } from "node:os";
import { join } from "node:path";

export function jiraAxiHome(): string {
  return join(homedir(), ".jira-axi");
}

export function siteCacheDir(host: string): string {
  return join(jiraAxiHome(), "cache", host);
}
