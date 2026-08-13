# ADR-0004: Add `--fix-version` as a Read Filter on `issue list` and `sprint current`

**Date:** 2026-08-13
**Status:** Accepted
**Deciders:** Miguel Barboza (captain), firstmate (via Lavish)

---

## Context

`jira-pod-fix-version` is a separate skill that sets fix versions on issues; jira-axi has no equivalent write path and this ADR does not add one.
What jira-axi lacks today is the read side: a way to ask "which issues are on fix version X" without hand-writing raw JQL.

`issue list` already builds JQL from shorthand flags in `src/jql/build.ts`: `--mine`, `--project`, `--status`, `--sprint`, `--assignee`, and `--label` each compile to one `AND`-joined clause, and an agent or user reaching for a fix-version filter today has to drop to `--jql "fixVersion = ...`" by hand, bypassing the shorthand entirely.
Fix version is common enough alongside those existing filters, e.g. auditing what remains open on a release, that it belongs in the same builder rather than staying JQL-only.

`sprint current` (`src/commands/sprint.ts`) does not go through `buildJql` at all.
It calls `/rest/agile/1.0/sprint/{id}/issue` directly and currently fetches every issue in the active sprint with no query narrowing.
That endpoint accepts its own native `jql` query parameter, so a fix-version filter here follows the endpoint's existing mechanism rather than introducing a JQL builder to a command that never had one.

`sprint list` and `board` were both considered and set aside.
`board` has no issue-fetching subcommand today (see `SPRINT_HELP` in `sprint.ts` — only `sprint current` and `sprint list` exist, and `sprint list` returns sprint metadata, not issues), so there is no request path to attach a fix-version filter to.

## Decision

Add a `--fix-version <name>` flag to two commands:

1. **`issue list`** — added to `JqlOptions` in `src/jql/build.ts` and wired into `buildJql` the same way as the five existing shorthand filters: `if (options.fixVersion) clauses.push(\`fixVersion = ${quote(options.fixVersion)}\`)`, `AND`-joined with the rest.
2. **`sprint current`** — read via `getFlag(args, "--fix-version")` and passed straight through as the `jql` parameter already accepted by `/rest/agile/1.0/sprint/{id}/issue`, e.g. `jql: fixVersion = "X"`, narrowing the sprint's issue fetch before the status/points rollup runs.

Both accept exactly one fix version per invocation.
There is no multi-value or OR-joined form in this iteration; a user who needs several fix versions in one query still drops to `--jql` on `issue list`, or waits for a later ADR if that need turns out to be common.

This flag only filters and fetches by fix version.
It does not add any way to set, unset, or otherwise write a fix version on an issue.
That capability is intentionally left where it already lives, in the `jira-pod-fix-version` skill, and this ADR does not change that skill or its relationship to jira-axi.

`board` gets no `--fix-version` flag under this ADR, because it has no issue-fetching subcommand for the flag to attach to.

## Consequences

### Positive

- Filtering issues by fix version is now a first-class shorthand on `issue list`, consistent with `--mine`/`--project`/`--status`/`--sprint`/`--assignee`/`--label`, instead of requiring hand-written `--jql`.
- `sprint current` can scope its rollup to a single fix version, useful for checking release readiness within an active sprint, without a second round trip or client-side filtering.
- Read-only scope is unchanged: jira-axi still does not write fix versions, and `jira-pod-fix-version` remains the one place that does.

### Negative / Trade-offs

- Single-value only: a user needing "fixVersion in (X, Y)" cannot express it with the new flag and must still write raw JQL on `issue list`, or is unsupported entirely on `sprint current` since that endpoint's `jql` param would need to be hand-composed to do the same.
- `issue list` and `sprint current` now filter by fix version through two different mechanisms (a JQL clause built into `buildJql` vs. a raw `jql` param passed to the Agile REST endpoint), which is exactly right for each command's existing architecture but means there is no single shared implementation to update if fix-version filtering semantics ever change.

### Neutral / Explicit exclusions

- `board` is out of scope: it has no issue-fetching subcommand today, so there is nothing for `--fix-version` to filter.
- No write capability is added anywhere in jira-axi by this ADR. Setting or clearing a fix version continues to require `jira-pod-fix-version`.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| Multi-value `--fix-version` (comma-separated or repeatable) with OR semantics | Not needed yet; adds parsing and JQL-composition complexity (`fixVersion in (...)`) for a use case that has not come up. Deferred to a later ADR if demand appears. |
| Add `--fix-version` to `board` as well | `board` has no issue-fetching subcommand to attach the filter to; would require adding one first, which is a larger, separate change. |
| Extend jira-axi to also set fix versions (write path) | Out of scope for this filter-only change and duplicates `jira-pod-fix-version`, which already owns that capability. |
| Give `sprint current` a full `buildJql`-style shorthand builder instead of passing through the endpoint's native `jql` param | The endpoint already accepts `jql` directly; building a parallel JQL compiler for one flag on one command is unnecessary indirection. |

## References

- ADR-0001: Build jira-axi as an AXI-Style CLI Instead of the Atlassian MCP — `docs/adr/adr-0001-build-jira-axi-as-an-axi-style-cli.md`
- Existing JQL builder: `src/jql/build.ts`
- `issue list` command: `src/commands/issue.ts`
- `sprint current` command: `src/commands/sprint.ts`
- `jira-pod-fix-version` skill (owns the write path, unaffected by this ADR)
