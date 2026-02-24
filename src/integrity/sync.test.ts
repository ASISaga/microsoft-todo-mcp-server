/**
 * Tests for the Integrity sync engine (src/integrity/sync.ts).
 */
import { describe, it, expect } from "vitest"
import {
  githubActionToGoalPhase,
  githubActionToTodoStatus,
  buildTaskBodyFromIssue,
  buildIssueBodyFromTask,
  appendIssueLink,
  hasGitHubIssueLink,
  ISSUE_LINK_MARKER,
} from "./sync.js"
import { SmartGoalPhase } from "./types.js"

describe("githubActionToGoalPhase", () => {
  it("maps 'opened' to Plan", () => {
    expect(githubActionToGoalPhase("opened")).toBe(SmartGoalPhase.Plan)
  })

  it("maps 'reopened' to Plan", () => {
    expect(githubActionToGoalPhase("reopened")).toBe(SmartGoalPhase.Plan)
  })

  it("maps 'closed' to Complete", () => {
    expect(githubActionToGoalPhase("closed")).toBe(SmartGoalPhase.Complete)
  })
})

describe("githubActionToTodoStatus", () => {
  it("maps 'opened' to 'notStarted'", () => {
    expect(githubActionToTodoStatus("opened")).toBe("notStarted")
  })

  it("maps 'reopened' to 'notStarted'", () => {
    expect(githubActionToTodoStatus("reopened")).toBe("notStarted")
  })

  it("maps 'closed' to 'completed'", () => {
    expect(githubActionToTodoStatus("closed")).toBe("completed")
  })
})

describe("buildTaskBodyFromIssue", () => {
  it("includes the issue URL with marker", () => {
    const body = buildTaskBodyFromIssue("https://github.com/o/r/issues/1", null)
    expect(body).toBe(`${ISSUE_LINK_MARKER} https://github.com/o/r/issues/1`)
  })

  it("appends issue body when present", () => {
    const body = buildTaskBodyFromIssue("https://github.com/o/r/issues/1", "Fix the bug")
    expect(body).toContain("Fix the bug")
    expect(body).toContain(ISSUE_LINK_MARKER)
  })

  it("handles empty string body", () => {
    const body = buildTaskBodyFromIssue("https://github.com/o/r/issues/1", "  ")
    expect(body).toBe(`${ISSUE_LINK_MARKER} https://github.com/o/r/issues/1`)
  })
})

describe("buildIssueBodyFromTask", () => {
  it("returns provenance footer when no task body", () => {
    expect(buildIssueBodyFromTask(null)).toBe("*Created from Microsoft To Do task*")
  })

  it("includes task body and provenance footer", () => {
    const body = buildIssueBodyFromTask("Ship feature X")
    expect(body).toContain("Ship feature X")
    expect(body).toContain("*Created from Microsoft To Do task*")
  })
})

describe("appendIssueLink", () => {
  it("appends issue link to existing body", () => {
    const result = appendIssueLink("My task", "https://github.com/o/r/issues/1")
    expect(result).toContain("My task")
    expect(result).toContain(ISSUE_LINK_MARKER)
  })

  it("creates body with just the link when body is empty", () => {
    const result = appendIssueLink("", "https://github.com/o/r/issues/1")
    expect(result).toBe(`${ISSUE_LINK_MARKER} https://github.com/o/r/issues/1`)
  })
})

describe("hasGitHubIssueLink", () => {
  it("returns true when a GitHub issue URL is present", () => {
    expect(hasGitHubIssueLink("GitHub Issue: https://github.com/ASISaga/IntegrityMCP/issues/42")).toBe(true)
  })

  it("returns false when no GitHub issue URL is present", () => {
    expect(hasGitHubIssueLink("Just a regular task")).toBe(false)
  })

  it("returns false for non-GitHub URLs", () => {
    expect(hasGitHubIssueLink("https://example.com/issues/1")).toBe(false)
  })
})
