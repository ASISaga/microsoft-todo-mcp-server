/**
 * Tests for GitHub utility functions (src/github/utils.ts).
 */
import { describe, it, expect } from "vitest"
import { extractGitHubIssueLink } from "./utils.js"

describe("extractGitHubIssueLink", () => {
  it("extracts owner, repo, issue number, and URL", () => {
    const result = extractGitHubIssueLink("GitHub Issue: https://github.com/ASISaga/IntegrityMCP/issues/42")
    expect(result).toEqual({
      url: "https://github.com/ASISaga/IntegrityMCP/issues/42",
      owner: "ASISaga",
      repo: "IntegrityMCP",
      issueNumber: 42,
    })
  })

  it("extracts from multi-line body", () => {
    const body = `Some task description\n\nGitHub Issue: https://github.com/octo/repo/issues/7\n\nMore notes`
    const result = extractGitHubIssueLink(body)
    expect(result).not.toBeNull()
    expect(result!.owner).toBe("octo")
    expect(result!.repo).toBe("repo")
    expect(result!.issueNumber).toBe(7)
  })

  it("returns null when no link is present", () => {
    expect(extractGitHubIssueLink("Just a regular task body")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(extractGitHubIssueLink("")).toBeNull()
  })

  it("handles repos with dots and underscores", () => {
    const result = extractGitHubIssueLink("GitHub Issue: https://github.com/owner/my_repo.js/issues/99")
    expect(result).not.toBeNull()
    expect(result!.repo).toBe("my_repo.js")
    expect(result!.issueNumber).toBe(99)
  })

  it("handles owner with hyphens", () => {
    const result = extractGitHubIssueLink("GitHub Issue: https://github.com/my-org/my-repo/issues/1")
    expect(result).not.toBeNull()
    expect(result!.owner).toBe("my-org")
    expect(result!.repo).toBe("my-repo")
  })
})
