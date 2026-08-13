import { AxiError } from "axi-sdk-js";
import { getPositional } from "../args.js";
import { JiraClient } from "../client.js";
import { missingSiteError } from "../errors.js";
import { runIssueSearch } from "./issue.js";
import * as toon from "../toon.js";
export const FILTER_HELP = `usage: nu-jira-axi filter <subcommand> [args]
subcommands[2]:
  list
  run <id>
examples:
  nu-jira-axi filter list
  nu-jira-axi filter run 10042
`;
export async function filterCommand(args, site) {
    const [subcommand, ...rest] = args;
    if (!site) {
        throw missingSiteError();
    }
    switch (subcommand) {
        case "list":
            return filterList(site);
        case "run":
            return filterRun(rest, site);
        default:
            throw new AxiError(`unknown filter subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
                "Run `nu-jira-axi filter --help` to see subcommands",
            ]);
    }
}
async function filterList(site) {
    const client = new JiraClient({ site });
    const response = (await client.get("/rest/api/3/filter/search"));
    const rows = response.values.map((filter) => ({
        id: filter.id,
        name: filter.name,
        owner: filter.owner?.displayName ?? "",
    }));
    return toon.combine(toon.table("filters", rows), toon.help(["Run `nu-jira-axi filter run <id>` to see its issues"]));
}
async function filterRun(args, site) {
    const id = getPositional(args, 0);
    if (!id) {
        throw new AxiError("usage: nu-jira-axi filter run <id>", "VALIDATION_ERROR");
    }
    const client = new JiraClient({ site });
    const filter = (await client.get(`/rest/api/3/filter/${id}`));
    return runIssueSearch(site, filter.jql, `filter ${filter.name}`);
}
//# sourceMappingURL=filter.js.map