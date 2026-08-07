import { afterEach, describe, expect, it, vi } from "vitest";

const execFileSyncMock = vi.fn();
vi.mock("node:child_process", () => ({ execFileSync: (...args: unknown[]) => execFileSyncMock(...args) }));

const { readSecret, writeSecret, hasSecret } = await import("./keychain.js");

afterEach(() => {
  execFileSyncMock.mockReset();
});

describe("readSecret", () => {
  it("calls security find-generic-password with the host-scoped service name", () => {
    execFileSyncMock.mockReturnValue("stored-value\n");
    const value = readSecret("acme.atlassian.net");
    expect(value).toBe("stored-value");
    expect(execFileSyncMock).toHaveBeenCalledWith(
      "security",
      ["find-generic-password", "-s", "jira-axi:acme.atlassian.net", "-a", "acme.atlassian.net", "-w"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
    );
  });

  it("propagates a throw when nothing is stored", () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(() => readSecret("acme.atlassian.net")).toThrow();
  });
});

describe("writeSecret", () => {
  it("calls security add-generic-password with -U to update in place", () => {
    writeSecret("acme.atlassian.net", "new-value");
    expect(execFileSyncMock).toHaveBeenCalledWith("security", [
      "add-generic-password",
      "-s",
      "jira-axi:acme.atlassian.net",
      "-a",
      "acme.atlassian.net",
      "-w",
      "new-value",
      "-U",
    ]);
  });
});

describe("hasSecret", () => {
  it("returns true when readSecret succeeds", () => {
    execFileSyncMock.mockReturnValue("value");
    expect(hasSecret("acme.atlassian.net")).toBe(true);
  });

  it("returns false when readSecret throws", () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(hasSecret("acme.atlassian.net")).toBe(false);
  });
});
