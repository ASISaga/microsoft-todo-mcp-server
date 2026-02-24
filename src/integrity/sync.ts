/**
 * Integrity sync engine – keeps Microsoft To Do tasks and GitHub Issues
 * "whole, complete, and unbroken" across both platforms.
 *
 * This module is the heart of the Integrity mechanism:
 *
 *   GitHub → To Do
 *     A GitHub issue event (opened / closed / reopened) is translated into a
 *     SMART goal phase change that is propagated to the linked To Do task.
 *
 *   To Do → GitHub
 *     A To Do task created with a #owner/repo hashtag triggers GitHub issue
 *     creation; the resulting issue URL is stored back in the task body.
 *
 * All status-mapping and body-building logic is centralised here so that the
 * Azure Function handlers stay thin event dispatchers and the MCP tools share
 * the exact same formatting rules.
 */

import { SmartGoalPhase, PHASE_TO_TODO_STATUS, GitHubIssueAction } from "./types.js"

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Marker text used when embedding a GitHub issue URL inside a To Do task body.
 * The extractGitHubIssueLink utility in src/github/utils.ts relies on this
 * exact prefix when resolving the back-reference.
 */
export const ISSUE_LINK_MARKER = "GitHub Issue:"

// ── Status mapping ────────────────────────────────────────────────────────────

/**
 * Map a GitHub issue action to the SMART goal phase it represents.
 *
 * Opening or re-opening an issue restores the active commitment (Plan).
 * Closing an issue signals that the commitment has been fulfilled (Complete).
 */
export function githubActionToGoalPhase(action: GitHubIssueAction): SmartGoalPhase {
  switch (action) {
    case "opened":
    case "reopened":
      return SmartGoalPhase.Plan
    case "closed":
      return SmartGoalPhase.Complete
  }
}

/**
 * Return the Microsoft To Do task status string for a given GitHub issue action.
 *
 * This is the single source of truth for the GitHub → To Do status mapping:
 *   "opened"   → "notStarted"  (Plan phase)
 *   "reopened" → "notStarted"  (Plan phase, back to active)
 *   "closed"   → "completed"   (Complete phase, word kept)
 */
export function githubActionToTodoStatus(action: GitHubIssueAction): string {
  return PHASE_TO_TODO_STATUS[githubActionToGoalPhase(action)]
}

// ── Body builders ─────────────────────────────────────────────────────────────

/**
 * Build the body for a To Do task that was created from a GitHub issue.
 *
 * The issue URL is embedded with the standard marker so the link can be
 * resolved later by extractGitHubIssueLink.
 */
export function buildTaskBodyFromIssue(issueUrl: string, issueBody: string | null | undefined): string {
  const content = issueBody?.trim() ?? ""
  return content ? `${ISSUE_LINK_MARKER} ${issueUrl}\n\n${content}` : `${ISSUE_LINK_MARKER} ${issueUrl}`
}

/**
 * Build the body for a GitHub issue that was created from a To Do task.
 *
 * A provenance footer is appended so GitHub reviewers know the issue
 * originated in Microsoft To Do.
 */
export function buildIssueBodyFromTask(taskBody: string | null | undefined): string {
  const content = taskBody?.trim() ?? ""
  return content ? `${content}\n\n---\n*Created from Microsoft To Do task*` : "*Created from Microsoft To Do task*"
}

/**
 * Append a GitHub issue link to an existing To Do task body.
 *
 * Used after creating a GitHub issue from a task to store the back-reference
 * so the link can later be followed by the sync tools.
 */
export function appendIssueLink(existingBody: string, issueUrl: string): string {
  return existingBody ? `${existingBody}\n\n${ISSUE_LINK_MARKER} ${issueUrl}` : `${ISSUE_LINK_MARKER} ${issueUrl}`
}

// ── Guard ─────────────────────────────────────────────────────────────────────

/**
 * Pattern that matches any GitHub issue URL embedded in text.
 * Anchored to `https://github.com/` to prevent crafted strings from bypassing
 * the guard and triggering duplicate issue creation.
 */
const GITHUB_ISSUE_URL_PATTERN = /https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+/

/**
 * Return true if the given task body already contains a GitHub issue URL.
 */
export function hasGitHubIssueLink(bodyContent: string): boolean {
  return GITHUB_ISSUE_URL_PATTERN.test(bodyContent)
}
