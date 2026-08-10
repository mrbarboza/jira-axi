#!/usr/bin/env bash
# Enforces the open-source readiness invariants from ADR-0001:
# no hardcoded Jira host/cloudId/customfield ID, and no Nubank-specific
# vocabulary on the CLI-facing surface (command names, flags, help text,
# error messages).
set -uo pipefail

fail=0

is_comment_line() {
  # Strip leading whitespace, then check for a // or * (JSDoc/block) comment marker.
  local trimmed="${1#"${1%%[![:space:]]*}"}"
  [[ "$trimmed" == "//"* || "$trimmed" == "*"* || "$trimmed" == "/*"* ]]
}

# Test fixtures legitimately use arbitrary example hosts/ids to exercise the
# site resolver and field cache — they aren't hardcoded production values, so
# *.test.ts is excluded from the host/cloudId/customfield checks below.

echo "== Checking for hardcoded Jira host =="
# Any *.atlassian.net domain other than the "acme.atlassian.net" placeholder
# used in help text and docs examples.
while IFS=: read -r file line content; do
  is_comment_line "$content" && continue
  echo "FAIL: hardcoded Jira host in $file:$line: $content"
  fail=1
done < <(grep -rnE '[a-zA-Z0-9][a-zA-Z0-9.-]*\.atlassian\.net' src/ --include='*.ts' | grep -v '\.test\.ts:' | grep -v 'acme\.atlassian\.net')

echo "== Checking for hardcoded cloudId =="
while IFS=: read -r file line content; do
  is_comment_line "$content" && continue
  echo "FAIL: hardcoded cloudId in $file:$line: $content"
  fail=1
done < <(grep -rnE 'cloudId[[:space:]]*[:=][[:space:]]*["'"'"'][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' src/ --include='*.ts' | grep -v '\.test\.ts:')

echo "== Checking for hardcoded customfield IDs =="
while IFS=: read -r file line content; do
  is_comment_line "$content" && continue
  echo "FAIL: hardcoded customfield ID in $file:$line: $content"
  fail=1
done < <(grep -rnE 'customfield_[0-9]+' src/ --include='*.ts' | grep -v '\.test\.ts:')

echo "== Checking for Nubank-specific vocabulary on the CLI-facing surface =="
# ADR-0001: "No Nubank-specific vocabulary in command names, flags, or help
# text." Interpreted broadly to also cover error messages, since those are
# as user-facing as help text. This list is intentionally narrow (distinctive
# internal terms) to avoid false positives on generic English words.
BANNED_TERMS='nubank|c3p[0-9]*|jira-pod-fix-version|credit-card-minos-agent|jira-claude-code-cli'
if grep -rniE "$BANNED_TERMS" src/ bin/ --include='*.ts' | grep -v -E '\.test\.ts:'; then
  echo "FAIL: Nubank-specific vocabulary found in src/ or bin/ — see lines above"
  fail=1
fi

exit $fail
