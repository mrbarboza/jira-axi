/**
 * (context) -> next-command suggestions. Mirrors gh-axi's suggestions.ts:
 * contextual disclosure instead of a standing tool schema — the CLI itself
 * teaches the next complete command to run.
 */

export function issueListSuggestions(context: { jql: string; count: number }): string[] {
  if (context.count === 0) {
    return [
      "No issues matched. Try loosening the filter, e.g. drop --status or --sprint",
      "Run `jira-axi issue list --jql \"<your JQL>\"` to run a custom query",
    ];
  }
  return [
    "Run `jira-axi issue view <KEY>` to see full detail on one issue",
    "Run `jira-axi issue view <KEY> --comments` to include its comments",
  ];
}

export function issueViewSuggestions(context: { key: string }): string[] {
  return [
    `Run \`jira-axi issue view ${context.key} --full\` to see the untruncated description`,
    "Run `jira-axi issue list --mine` to go back to your open issues",
  ];
}
