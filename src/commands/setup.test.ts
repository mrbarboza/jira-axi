import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AxiError } from "axi-sdk-js";

const openMock = vi.fn().mockResolvedValue(undefined);
vi.mock("open", () => ({ default: (...args: unknown[]) => openMock(...args) }));

const randomStateMock = vi.fn().mockReturnValue("test-state");
const buildAuthorizeUrlMock = vi.fn().mockReturnValue(new URL("https://auth.atlassian.com/authorize?state=test-state"));
const listenForCallbackMock = vi.fn();
const exchangeCodeForTokenMock = vi.fn();
const fetchAccessibleResourcesMock = vi.fn();
// `listenForCallbackImpl` lets a test hand setup.ts a plain, un-instrumented promise:
// vi.fn()'s own call-tracking attaches an internal `.then` to recorded return values,
// which would mask the exact unhandled-rejection timing the crash regression test needs.
let listenForCallbackImpl: (state: string, host: string) => Promise<{ code: string }> = (state, host) =>
  listenForCallbackMock(state, host);
vi.mock("../oauth.js", () => ({
  randomState: () => randomStateMock(),
  buildAuthorizeUrl: (state: string) => buildAuthorizeUrlMock(state),
  listenForCallback: (state: string, host: string) => listenForCallbackImpl(state, host),
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
  listenForCallbackImpl = (state, host) => listenForCallbackMock(state, host);
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

  it("does not crash the process when the callback times out while still awaiting the browser open", async () => {
    // Simulates the report's repro3 vs repro4 race: the callback promise rejects
    // (timeout) while `setupAuth` is still awaiting `openBrowserOrPrintUrl`, i.e.
    // before any `.catch`/`await` had a chance to attach a handler to it "naturally".
    // Without a handler attached at creation time, this rejection would be a fatal
    // unhandled rejection and kill the process instead of surfacing as an AxiError.
    let openResolve = () => {};
    openMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          openResolve = resolve;
        }),
    );

    const timeoutError = new AxiError("timed out waiting for the OAuth redirect for acme.atlassian.net", "AUTH_TIMEOUT");
    let rejectCallback = (_err: unknown) => {};
    // Plain (non-vi.fn) promise: vi.fn()'s call-result tracking attaches its own `.then`
    // to recorded return values, which would mask the unhandled-rejection timing below.
    listenForCallbackImpl = () =>
      new Promise((_resolve, reject) => {
        rejectCallback = reject;
      });

    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      const authPromise = setupCommand(["auth", "--site", "work"]);

      // Fire the "timeout" while setupAuth is still stuck awaiting the browser-open step.
      rejectCallback(timeoutError);
      await new Promise((r) => setTimeout(r, 10));

      // Now let the browser-open step resolve so setupAuth proceeds to `await callbackPromise`.
      openResolve();

      await expect(authPromise).rejects.toBe(timeoutError);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
    }

    expect(unhandledRejections).toHaveLength(0);
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
