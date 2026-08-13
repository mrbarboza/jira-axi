import { describe, expect, it } from "vitest";
import { buildJql, buildTextSearchJql } from "./build.js";

describe("buildJql", () => {
  it("passes an explicit --jql through unchanged with source explicit", () => {
    expect(buildJql({ jql: "project = FOO" })).toEqual({ jql: "project = FOO", source: "explicit" });
  });

  it("ignores other flags when --jql is given", () => {
    expect(buildJql({ jql: "project = FOO", mine: true, project: "BAR" })).toEqual({
      jql: "project = FOO",
      source: "explicit",
    });
  });

  it("compiles --mine to currentUser()", () => {
    expect(buildJql({ mine: true })).toEqual({
      jql: "assignee = currentUser() ORDER BY updated DESC",
      source: "built",
    });
  });

  it("compiles --sprint current to openSprints()", () => {
    expect(buildJql({ sprint: "current" })).toEqual({
      jql: "sprint in openSprints() ORDER BY updated DESC",
      source: "built",
    });
  });

  it("compiles a named sprint as an equality clause", () => {
    expect(buildJql({ sprint: "Sprint 12" })).toEqual({
      jql: 'sprint = "Sprint 12" ORDER BY updated DESC',
      source: "built",
    });
  });

  it("combines multiple shorthand flags with AND, in a fixed order", () => {
    expect(
      buildJql({ mine: true, project: "PROJ", status: "In Progress", label: "urgent", sprint: "current" }),
    ).toEqual({
      jql:
        'assignee = currentUser() AND project = "PROJ" AND status = "In Progress" AND labels = "urgent" AND sprint in openSprints() ORDER BY updated DESC',
      source: "built",
    });
  });

  it("compiles --fix-version alongside other filters", () => {
    expect(buildJql({ project: "PROJ", fixVersion: "1.2.0" })).toEqual({
      jql: 'project = "PROJ" AND fixVersion = "1.2.0" ORDER BY updated DESC',
      source: "built",
    });
  });

  it("escapes embedded double quotes in a value", () => {
    expect(buildJql({ project: 'FOO"BAR' })).toEqual({
      jql: 'project = "FOO\\"BAR" ORDER BY updated DESC',
      source: "built",
    });
  });

  it("throws VALIDATION_ERROR when no filter and no --jql are given", () => {
    expect(() => buildJql({})).toThrowError(/no filter given/);
  });
});

describe("buildTextSearchJql", () => {
  it("compiles a bare text search", () => {
    expect(buildTextSearchJql("payment timeout")).toEqual({
      jql: 'text ~ "payment timeout" ORDER BY updated DESC',
      source: "built",
    });
  });

  it("scopes to a project when given", () => {
    expect(buildTextSearchJql("payment timeout", "PROJ")).toEqual({
      jql: 'text ~ "payment timeout" AND project = "PROJ" ORDER BY updated DESC',
      source: "built",
    });
  });
});
