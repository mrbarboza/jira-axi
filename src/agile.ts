import { AxiError } from "axi-sdk-js";
import { JiraClient } from "./client.js";

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

/** Resolve a board id from --board (numeric id) or --project (first board found). */
export async function resolveBoardId(
  client: JiraClient,
  options: { board?: string; project?: string },
): Promise<number> {
  if (options.board) {
    const id = Number(options.board);
    if (Number.isNaN(id)) {
      throw new AxiError(`--board must be a numeric board id, got "${options.board}"`, "VALIDATION_ERROR");
    }
    return id;
  }
  if (options.project) {
    const response = (await client.get("/rest/agile/1.0/board", {
      projectKeyOrId: options.project,
    })) as { values: JiraBoard[] };
    const board = response.values[0];
    if (!board) {
      throw new AxiError(`no board found for project ${options.project}`, "VALIDATION_ERROR");
    }
    return board.id;
  }
  throw new AxiError("pass --board <id> or --project <key> to resolve a board", "VALIDATION_ERROR");
}
