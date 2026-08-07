import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openMock = vi.fn().mockResolvedValue(undefined);
vi.mock("open", () => ({ default: (...args: unknown[]) => openMock(...args) }));

const randomStateMock = vi.fn().mockReturnValue("test-state");
const buildAuthorizeUrlMock = vi.fn().mockReturnValue(new URL("https://auth.atlassian.com/authorize?state=test-state"));
const listenForCallbackMock = vi.fn();
const exchangeCodeForTokenMock = vi.fn();
const fetchAccessibleResourcesMock = vi.fn();
vi.mock("../oauth.js", () => ({
  randomState: () => randomStateMock(),
  buildAuthorizeUrl: (state: string) => buildAuthorizeUrlMock(state),
  listenForCallback: (state: string, host: string) => listenForCallbackMock(state, host),
  exchangeCodeForToken: (code: string) => exchangeCodeForTokenMock(code),
  fetchAccessibleResources: (token: string) => fetchAccessibleResourcesMock(token),
}));

const saveSessionMock = vi.fn();
vi.mock("../oauth-store.js", () => ({ saveSession: (host: string, session: unknown) => saveSessionMock(host, session) }));

const { setupCommand } = await import("./setup.js");

let homeDir: string;
let originalHome: string | undefined;

beforeEach(() => {
  homeDir = mkdtempSync(join(tmpdir(), "jira-axi-home-"));
  originalHome = process.env.HOME;
  process.env.HOME = homeDir;

  const dir = join(homeDir, ".jira-axi");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "config.json"),
    JSON.stringify({ sites: { work: { host: "acme.atlassian.net" } }, defaultSite: "work" }),
  );

  openMock.mockClear();
  randomStateMock.mockClear();
  buildAuthorizeUrlMock.mockClear();
  listenForCallbackMock.mockReset();
  exchangeCodeForTokenMock.mockReset();
  fetchAccessibleResourcesMock.mockReset();
  saveSessionMock.mockReset();
});

afterEach(() => {
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(homeDir, { recursive: true, force: true });
});

describe("setup auth", () => {
  it("drives the browser + callback + exchange flow and persists the session", async () => {
    listenForCallbackMock.mockResolvedValue({ code: "auth-code" });
    exchangeCodeForTokenMock.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: 3600,
      scope: "read:jira-work",
    });
    fetchAccessibleResourcesMock.mockResolvedValue([
      { id: "cloud-123", name: "Acme", url: "https://acme.atlassian.net", scopes: ["read:jira-work"] },
    ]);

    const result = await setupCommand(["auth", "--site", "work"]);

    expect(openMock).toHaveBeenCalled();
    expect(saveSessionMock).toHaveBeenCalledWith(
      "acme.atlassian.net",
      expect.objectContaining({ accessToken: "at", refreshToken: "rt", cloudId: "cloud-123" }),
    );
    expect(result).toContain("acme.atlassian.net");
    expect(result).toContain("cloud-123");
  });

  it("throws when the authorized account has no access to the requested site", async () => {
    listenForCallbackMock.mockResolvedValue({ code: "auth-code" });
    exchangeCodeForTokenMock.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: 3600,
      scope: "read:jira-work",
    });
    fetchAccessibleResourcesMock.mockResolvedValue([
      { id: "cloud-other", name: "Other", url: "https://other.atlassian.net", scopes: [] },
    ]);

    await expect(setupCommand(["auth", "--site", "work"])).rejects.toThrow(/acme\.atlassian\.net/);
    expect(saveSessionMock).not.toHaveBeenCalled();
  });

  it("falls back to printing the URL when the browser fails to open", async () => {
    openMock.mockRejectedValueOnce(new Error("no display"));
    listenForCallbackMock.mockResolvedValue({ code: "auth-code" });
    exchangeCodeForTokenMock.mockResolvedValue({
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: 3600,
      scope: "read:jira-work",
    });
    fetchAccessibleResourcesMock.mockResolvedValue([
      { id: "cloud-123", name: "Acme", url: "https://acme.atlassian.net", scopes: [] },
    ]);
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    await setupCommand(["auth", "--site", "work"]);

    expect(stderrSpy).toHaveBeenCalled();
    stderrSpy.mockRestore();
  });
});
