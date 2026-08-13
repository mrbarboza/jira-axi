import { describe, expect, it, vi } from "vitest";

vi.mock("../oauth-store.js", () => ({
  hasSession: vi.fn(),
}));
vi.mock("../client.js", () => ({
  JiraClient: vi.fn(),
}));

import { hasSession } from "../oauth-store.js";
import { JiraClient } from "../client.js";
import type { SiteContext } from "../context.js";
import { homeCommand } from "./home.js";

const SITE: SiteContext = { host: "acme.atlassian.net", alias: "work", source: "flag" };

describe("homeCommand", () => {
  it("reports no site resolved when none is given", async () => {
    const result = await homeCommand([], undefined);
    expect(result).toContain("none resolved");
  });

  it("suggests setup auth when the site isn't authenticated", async () => {
    vi.mocked(hasSession).mockReturnValue(false);
    const result = await homeCommand([], SITE);
    expect(result).toContain("authenticated");
    expect(result).toContain("nu-jira-axi setup auth --site work");
    expect(JiraClient).not.toHaveBeenCalled();
  });

  it("shows my open issue count when authenticated and the search succeeds", async () => {
    vi.mocked(hasSession).mockReturnValue(true);
    const get = vi.fn().mockResolvedValue({ issues: [{}, {}], isLast: true });
    vi.mocked(JiraClient).mockImplementation(() => ({ get }) as unknown as JiraClient);

    const result = await homeCommand([], SITE);

    expect(get).toHaveBeenCalledWith(
      "/rest/api/3/search/jql",
      expect.objectContaining({ jql: expect.stringContaining("assignee = currentUser()") }),
    );
    expect(result).toContain("myOpenIssues");
    expect(result).toContain("2");
  });

  it("appends a + when the result page isn't the last one", async () => {
    vi.mocked(hasSession).mockReturnValue(true);
    const get = vi.fn().mockResolvedValue({ issues: new Array(100).fill({}), isLast: false });
    vi.mocked(JiraClient).mockImplementation(() => ({ get }) as unknown as JiraClient);

    const result = await homeCommand([], SITE);

    expect(result).toContain("100+");
  });

  it("omits myOpenIssues when the request fails, without throwing", async () => {
    vi.mocked(hasSession).mockReturnValue(true);
    const get = vi.fn().mockRejectedValue(new Error("network down"));
    vi.mocked(JiraClient).mockImplementation(() => ({ get }) as unknown as JiraClient);

    const result = await homeCommand([], SITE);

    expect(result).not.toContain("myOpenIssues");
    expect(result).toContain("authenticated");
  });
});
