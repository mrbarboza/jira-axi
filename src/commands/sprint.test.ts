import { describe, expect, it, vi } from "vitest";

vi.mock("../client.js", () => ({
  JiraClient: vi.fn(),
}));
vi.mock("../fields.js", () => ({
  loadFields: vi.fn(),
  fieldId: vi.fn(),
}));

import { JiraClient } from "../client.js";
import { loadFields, fieldId } from "../fields.js";
import type { SiteContext } from "../context.js";
import { sprintCommand } from "./sprint.js";

const SITE: SiteContext = { host: "acme.atlassian.net", alias: "work", source: "flag" };

describe("sprint current", () => {
  it("passes the --fix-version flag through as the sprint issue endpoint's jql param", async () => {
    const get = vi.fn().mockImplementation((path: string) => {
      if (path.includes("/board/") && path.endsWith("/sprint")) {
        return Promise.resolve({ values: [{ id: 7, name: "Sprint 7", state: "active" }] });
      }
      if (path.includes("/sprint/7/issue")) {
        return Promise.resolve({ issues: [] });
      }
      throw new Error(`unexpected path: ${path}`);
    });
    vi.mocked(JiraClient).mockImplementation(() => ({ get }) as unknown as JiraClient);
    vi.mocked(loadFields).mockResolvedValue({ host: SITE.host, fetchedAt: "", fields: [] });
    vi.mocked(fieldId).mockReturnValue(undefined);

    await sprintCommand(["current", "--board", "42", "--fix-version", "1.2.0"], SITE);

    expect(get).toHaveBeenCalledWith(
      "/rest/agile/1.0/sprint/7/issue",
      expect.objectContaining({ jql: 'fixVersion = "1.2.0"' }),
    );
  });

  it("omits the jql param when --fix-version isn't given", async () => {
    const get = vi.fn().mockImplementation((path: string) => {
      if (path.includes("/board/") && path.endsWith("/sprint")) {
        return Promise.resolve({ values: [{ id: 7, name: "Sprint 7", state: "active" }] });
      }
      if (path.includes("/sprint/7/issue")) {
        return Promise.resolve({ issues: [] });
      }
      throw new Error(`unexpected path: ${path}`);
    });
    vi.mocked(JiraClient).mockImplementation(() => ({ get }) as unknown as JiraClient);
    vi.mocked(loadFields).mockResolvedValue({ host: SITE.host, fetchedAt: "", fields: [] });
    vi.mocked(fieldId).mockReturnValue(undefined);

    await sprintCommand(["current", "--board", "42"], SITE);

    expect(get).toHaveBeenCalledWith(
      "/rest/agile/1.0/sprint/7/issue",
      expect.not.objectContaining({ jql: expect.anything() }),
    );
  });
});
