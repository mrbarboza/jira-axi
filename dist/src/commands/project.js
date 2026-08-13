import { AxiError } from "axi-sdk-js";
import { getPositional } from "../args.js";
import { JiraClient } from "../client.js";
import { missingSiteError } from "../errors.js";
import { loadFields } from "../fields.js";
import * as toon from "../toon.js";
export const PROJECT_HELP = `usage: nu-jira-axi project <subcommand> <KEY>
subcommands[3]:
  view <KEY>
  fields <KEY>
  types <KEY>
examples:
  nu-jira-axi project view PROJ
  nu-jira-axi project types PROJ
`;
export async function projectCommand(args, site) {
    const [subcommand, ...rest] = args;
    if (!site) {
        throw missingSiteError();
    }
    const key = getPositional(rest, 0);
    if (!key) {
        throw new AxiError("usage: nu-jira-axi project <view|fields|types> <KEY>", "VALIDATION_ERROR");
    }
    switch (subcommand) {
        case "view":
            return projectView(site, key);
        case "fields":
            return projectFields(site);
        case "types":
            return projectTypes(site, key);
        default:
            throw new AxiError(`unknown project subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
                "Run `nu-jira-axi project --help` to see subcommands",
            ]);
    }
}
async function fetchProject(site, key) {
    const client = new JiraClient({ site });
    return (await client.get(`/rest/api/3/project/${key}`));
}
async function projectView(site, key) {
    const project = await fetchProject(site, key);
    return toon.combine(toon.detail("project", {
        key: project.key,
        name: project.name,
        type: project.projectTypeKey ?? "",
        lead: project.lead?.displayName ?? "",
    }), toon.help([`Run \`nu-jira-axi issue list --project ${project.key}\` to see its issues`]));
}
async function projectFields(site) {
    const fields = await loadFields(site);
    const rows = fields.fields.map((f) => ({ id: f.id, name: f.name, custom: f.custom }));
    return toon.table("fields", rows);
}
async function projectTypes(site, key) {
    const project = await fetchProject(site, key);
    const rows = (project.issueTypes ?? []).map((t) => ({ id: t.id, name: t.name, subtask: t.subtask }));
    return toon.table("issueTypes", rows);
}
//# sourceMappingURL=project.js.map