# ADR-0001: Build jira-axi as an AXI-Style CLI Instead of the Atlassian MCP

**Date:** 2026-08-06
**Status:** Accepted
**Deciders:** Miguel Barboza

---

## Context

Agent sessions that touch Jira currently go through the Atlassian MCP server, and the cost is paid twice.
The 34 tool schemas the server loads measure roughly 56,168 characters, about 14,042 tokens, and that is standing context spent before the agent asks a single question.
Then every answer arrives as a JSON envelope: one real issue, C3P-333, came back at 4,475 characters where the four fields an agent actually reads fit in an 85-character row, a 98.1% overhead on a single record and 223,750 against 4,311 characters on a 50-issue page.

The AXI design principles published at https://github.com/kunchenguid/axi describe a different shape for the same job: a plain CLI that emits TOON, declares its schema once per table instead of once per record, truncates long content behind an explicit size hint, pre-computes the aggregates an agent would otherwise derive across several calls, and injects a small live-data hook at session start in place of a wall of tool schemas.
The same trade has already been made elsewhere internally under pressure rather than by design.
`nubank/credit-card-minos-agent` runs its deterministic intake against the Jira REST API with a `JIRA_API_TOKEN` and treats the Atlassian MCP as the fallback path, and `nubank/jira-claude-code-cli` shells out to `acli` rather than to MCP.
Neither is a general-purpose read surface, so the pattern exists but the tool does not.

A generic AXI wrapper over the REST API would not be enough on its own.
Jira has seven problems that are specific to it: opaque `customfield_XXXXX` identifiers, ADF bodies that inflate every description and comment, hierarchy reads that cost one call per level, nine-key people objects repeated on every row, JQL that fails silently into wrong result sets, numeric transition identifiers, and bulk edits with a blast radius.
Those are the parts worth building carefully, and they are the reason this is a purpose-built tool rather than a thin proxy.

## Decision

We will build `jira-axi`, a standalone CLI that talks to the Jira Cloud REST v3 API directly and emits TOON on stdout, and we will migrate agent Jira access onto it so the Atlassian MCP can be unloaded from sessions that only read.
Version 1 is read-only, authenticates with an Atlassian API token held in the macOS keychain, resolves its target Jira site at runtime rather than compiling one in, and ships as a Nubank-internal package built to the constraints that would let it be open-sourced later without a rewrite.
Existing Jira skills keep their prose and swap their MCP calls for `jira-axi` commands rather than being absorbed into subcommands.

### Ratified sub-decisions

These four were settled during the design review and are recorded here rather than as separate ADRs, because each one only makes sense against the decision above.
Any of them may be superseded individually by a later ADR.

| Area | Decision | Immediate consequence |
|---|---|---|
| Auth | Atlassian API token per site, stored in the macOS keychain | No Atlassian developer app registration, so P0 is unblocked today. Swapping to OAuth 3LO later touches one module. |
| v1 scope | Read-only, phases P0 and P1, writes deferred | Write commands leave the v1 surface, `jira-axi api` is `GET`-only and exits `2` on anything else, and P3 aggregates move ahead of P2. |
| Distribution | Nubank-internal to start, built so it can be open-sourced | No public catalog entry yet, but no internal-only assumption is allowed to leak into the code either. See the invariants below. |
| Existing skills | Repoint at `jira-axi`, do not absorb | No new subcommands for pod tagging or sprint reporting. Saving lands the day v1 ships. |

### Multi-site resolution

The target site is resolved per invocation, in this order.

1. `--site <alias|host>`, valid on every command.
2. `JIRA_AXI_SITE`.
3. The nearest `./.jira-axi.json`, walking up from the working directory.
4. `defaultSite` in `~/.jira-axi/config.json`.

One keychain item and one cache directory exist per site.
A cache file whose recorded host does not match the resolved site is discarded rather than used, because a field map is not merely stale across instances but actively wrong: `customfield_10014` is the epic link on one Jira instance and story points on another.

### Open-source readiness invariants

These hold from the first commit so that opening the repository later is a licensing decision rather than an engineering project.

| Invariant | Enforced by |
|---|---|
| No hardcoded hostname, cloud ID, project key, or custom field ID | CI grep over the source tree |
| No Nubank-specific vocabulary in command names, flags, or help text | CI grep over the source tree |
| Every site-specific value arrives from config, environment, or flag | Site resolver is the only source of a host |
| No secret in the repository or in git history | Secret scanning on every commit |
| Benchmarks authored in the AXI catalog's published format | P4 writes them in that format from the start |

## Consequences

### Positive

- The standing schema tax drops from roughly 14,042 tokens to roughly 85 tokens for a `SessionStart` hook that also carries live data instead of only capability descriptions.
- Per-response cost drops by about 98% on the measured cases, and the saving grows with result-set size because TOON declares the schema once per table rather than once per record.
- Pre-computed aggregates such as `sprint current` and `issue tree` collapse multi-call read patterns into one shell invocation, which cuts turns as well as tokens.
- The read path is where nearly all of the measured saving lives, so a read-only v1 captures most of the benefit while carrying none of the write risk.
- Jira-specific normalization, meaning custom field resolution, ADF to markdown, and denormalized people, happens once in the tool instead of being re-derived by the agent on every response.
- Runtime site resolution means the tool works against any Jira Cloud instance, so a second Nubank site or a personal instance costs a `jira-axi site add`, not a fork.

### Negative / Trade-offs

- The API token carries the operator's full human permissions, including write and delete, even though v1 only reads.
  The token must never be printed to stdout or stderr, never written to a dotfile, never appear in help or error output, and be read into memory only by `setup auth`.
  P2 must not open until the token's real write scope has been reviewed.
- We take on ongoing maintenance against the Jira REST v3 API, including field, ADF, and pagination changes that the Atlassian MCP would otherwise absorb for us.
- The AXI community catalog and its published benchmark format are out of reach while the package is internal, so the MCP-versus-axi comparison in P4 has to be run and reported internally to be believed.
  Upstream AXI improvements have to be pulled in by hand.
- Any session that still needs a Jira write keeps the Atlassian MCP loaded, and therefore keeps its full schema tax, which cancels most of the saving for that session.
  This is the unresolved item below.

### Neutral

- P3 aggregates are sequenced ahead of P2 writes, because `sprint current` and `issue tree` are read-only and cut turns, so the phase order differs from the usual read-then-write progression.
- Confluence stays on the Atlassian MCP.
  It is out of scope for a Jira tool, so `jira-pod-fix-version` keeps its `getConfluencePage` call regardless of what happens to its write call.

### Unresolved

`jira-pod-fix-version` exists to make one `editJiraIssue` call.
Under read-only v1 it splits across two backends: reads through `jira-axi`, the write still through MCP.
That keeps roughly 14k tokens of MCP schema loaded in exactly the sessions the skill runs in, so the saving for that one workflow largely evaporates.
Two exits, both cheap, and this needs deciding before P1 starts.

1. Pull `issue edit` forward into v1 as the single write exception.
2. Leave that skill entirely on MCP until P2 and repoint the other three now.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| Keep using the Atlassian MCP as-is | The 14k-token standing schema cost and the ~98% response envelope overhead are the problem being solved, and neither is configurable from the client side. |
| Thin TOON-formatting proxy in front of the Atlassian MCP | Fixes the response envelope but not the standing schema tax, because the MCP server still has to be loaded. Also leaves all seven Jira-specific problems untouched. |
| Adopt `nubank/jira-claude-code-cli` or `acli` directly | Both are built for human or autonomous-worker ergonomics, not agent token economy. Neither emits TOON, pre-computes aggregates, or truncates with size hints, so the response cost stays roughly where it is. |
| Per-skill REST scripts, as `credit-card-minos-agent` does for intake | Works, and is evidence the premise holds, but duplicates auth, field resolution, pagination, and error handling in every skill that needs Jira. |
| Compile in `nubank.atlassian.net` as the default site | Rejected during review. Internal distribution says who may install the tool, not which Jira it talks to, and hardcoding the host would block reuse against any other instance and block open-sourcing later. |
| Ship reads and writes together in v1 | Writes carry the bulk edit and ADF-authoring risk while contributing almost none of the measured saving, and the token's real write scope has not been reviewed yet. |
| Absorb the existing Jira skills into `jira-axi` subcommands | Larger change for no additional token saving, and it would push Nubank pod and C3P conventions into a tool that has to stay vendor-neutral to be open-sourceable. |

## References

- AXI design principles: https://github.com/kunchenguid/axi
- Design review artifact, revision 4: `/Users/miguel.barboza/dev/.lavish/jira-axi-design.html`
- Token measurements: `/tmp/jaxi/bench.js` for response envelopes, `/tmp/jaxi/schema.js` for MCP tool schemas
- Prior internal art, direct Jira REST for deterministic intake with MCP as fallback: https://github.com/nubank/credit-card-minos-agent/blob/main/docs/requirements.md
- Prior internal art, `acli`-based Jira CLI: https://github.com/nubank/jira-claude-code-cli
- Current recommended path being replaced: https://nubank.atlassian.net/wiki/spaces/Playbooks/pages/264782513727
