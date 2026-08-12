import { JiraClient } from "./client.js";
export interface JiraBoard {
    id: number;
    name: string;
    type: string;
}
/** Resolve a board id from --board (numeric id) or --project (first board found). */
export declare function resolveBoardId(client: JiraClient, options: {
    board?: string;
    project?: string;
}): Promise<number>;
