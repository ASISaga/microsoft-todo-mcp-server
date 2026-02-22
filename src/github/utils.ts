/**
 * Utility functions for parsing GitHub repository references embedded in text.
 */

/**
 * Regular expression that matches a `#owner/repo` hashtag in text.
 *
 * Owner: starts and ends with alphanumeric, may contain hyphens.
 * Repo:  starts with alphanumeric or underscore; may contain alphanumeric,
 *        hyphens, underscores, and dots.
 * The hashtag must be followed by whitespace, end-of-string, or a non-path character.
 */
const GITHUB_REPO_HASHTAG_PATTERN =
  /#([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\/[a-zA-Z0-9_][a-zA-Z0-9_.-]*)(?:\s|$|[^\w/.-])/

/**
 * Extract a GitHub repository reference from a `#owner/repo` hashtag in the
 * given text.  Returns `null` if no valid hashtag is found.
 */
export function extractGitHubRepo(text: string): { owner: string; repo: string } | null {
  const match = text.match(GITHUB_REPO_HASHTAG_PATTERN)
  if (match) {
    const parts = match[1].split("/")
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { owner: parts[0], repo: parts[1] }
    }
  }
  return null
}

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
