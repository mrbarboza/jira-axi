import { AxiError } from "axi-sdk-js";
import { getFlag } from "../args.js";
import { JiraClient } from "../client.js";
import { missingSiteError } from "../errors.js";
import { resolveBoardId } from "../agile.js";
import { loadFields, fieldId } from "../fields.js";
import * as toon from "../toon.js";
export const SPRINT_HELP = `usage: jira-axi sprint <subcommand> [flags]
subcommands[2]:
  current [--board B] [--project K]   # active sprint + status/points rollup
  list --board B                       # all sprints on a board
examples:
  jira-axi sprint current --project PROJ
  jira-axi sprint list --board 42
`;
export async function sprintCommand(args, site) {
    const [subcommand, ...rest] = args;
    if (!site) {
        throw missingSiteError();
    }
    switch (subcommand) {
        case "current":
            return sprintCurrent(rest, site);
        case "list":
            return sprintList(rest, site);
        default:
            throw new AxiError(`unknown sprint subcommand: ${subcommand ?? "(none)"}`, "VALIDATION_ERROR", [
                "Run `jira-axi sprint --help` to see subcommands",
            ]);
    }
}
async function sprintCurrent(args, site) {
    const client = new JiraClient({ site });
    const boardId = await resolveBoardId(client, {
        board: getFlag(args, "--board"),
        project: getFlag(args, "--project"),
    });
    const active = (await client.get(`/rest/agile/1.0/board/${boardId}/sprint`, {
        state: "active",
    }));
    const sprint = active.values[0];
    if (!sprint) {
        return toon.combine(toon.pair("sprint", "none active"), toon.help(["Run `jira-axi sprint list --board " + boardId + "` to see all sprints on this board"]));
    }
    const fields = await loadFields(site);
    const pointsFieldId = fieldId(fields, "Story point estimate") ?? fieldId(fields, "Story Points");
    const sprintFields = ["status", ...(pointsFieldId ? [pointsFieldId] : [])];
    const issues = (await client.get(`/rest/agile/1.0/sprint/${sprint.id}/issue`, {
        fields: sprintFields.join(","),
    }));
    const statusCounts = new Map();
    let totalPoints = 0;
    for (const issue of issues.issues) {
        const status = issue.fields.status?.name ?? "unknown";
        statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
        if (pointsFieldId) {
            const points = issue.fields[pointsFieldId];
            if (typeof points === "number")
                totalPoints += points;
        }
    }
    return toon.combine(toon.detail("sprint", {
        id: sprint.id,
        name: sprint.name,
        startDate: sprint.startDate ?? "",
        endDate: sprint.endDate ?? "",
    }), toon.table("statusCounts", [...statusCounts.entries()].map(([status, count]) => ({ status, count }))), toon.pair("totalStoryPoints", totalPoints), toon.pair("issueCount", issues.issues.length), toon.help([`Run \`jira-axi issue list --jql "sprint = ${sprint.id}"\` to see the issues`]));
}
async function sprintList(args, site) {
    const client = new JiraClient({ site });
    const boardId = await resolveBoardId(client, {
        board: getFlag(args, "--board"),
        project: getFlag(args, "--project"),
    });
    const response = (await client.get(`/rest/agile/1.0/board/${boardId}/sprint`));
    const rows = response.values.map((sprint) => ({
        id: sprint.id,
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate ?? "",
        endDate: sprint.endDate ?? "",
    }));
    return toon.combine(toon.table("sprints", rows), toon.help(["Run `jira-axi sprint current --board " + boardId + "` to see the active one"]));
}
//# sourceMappingURL=sprint.js.map