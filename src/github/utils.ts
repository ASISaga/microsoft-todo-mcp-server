/**
 * Utility functions for parsing GitHub repository references embedded in text.
 */

/**
 * Extract a stored GitHub issue link from task body content.
 * Looks for the marker: `"GitHub Issue: https://github.com/owner/repo/issues/N"`
 */
export function extractGitHubIssueLink(
  bodyContent: string,
): { owner: string; repo: string; issueNumber: number; url: string } | null {
  const match = bodyContent.match(
    /GitHub Issue:\s*(https:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/([a-zA-Z0-9_][a-zA-Z0-9_.-]*)\/issues\/(\d+))/,
  )
  if (match) {
    return {
      url: match[1],
      owner: match[2],
      repo: match[3],
      issueNumber: parseInt(match[4], 10),
    }
  }
  return null
}
