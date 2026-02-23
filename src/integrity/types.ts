/**
 * Core Integrity domain types.
 *
 * Integrity is the state of being "whole, complete, and unbroken."
 *   Plan Your Work  → create SMART goals as tasks / issues
 *   Work Your Plan  → track completion across both platforms in sync
 *
 * Every task on Microsoft To Do and every issue on GitHub managed by this
 * server represents a commitment.  These types are the vocabulary used to
 * reason about that commitment regardless of which platform it lives on.
 */

/**
 * The four phases of the SMART goal lifecycle.
 *
 * A SMART goal is Specific, Measurable, Achievable, Relevant, and Time-bound.
 * Moving a goal through these phases on either platform keeps Integrity:
 * the goal stays "whole, complete, and unbroken" across both Microsoft To Do
 * and GitHub Issues.
 */
export enum SmartGoalPhase {
  /** Goal defined; commitment made; work not yet begun. ("giving your word") */
  Plan = "plan",
  /** Actively working toward the goal. */
  Track = "track",
  /** Goal achieved; commitment fulfilled. ("keeping your word") */
  Complete = "complete",
  /** Completed work preserved for historical reference. */
  Archive = "archive",
}

/**
 * The Microsoft To Do task status string that corresponds to each SMART goal phase.
 * These are the exact values accepted by the Microsoft Graph API.
 */
export const PHASE_TO_TODO_STATUS: Readonly<Record<SmartGoalPhase, string>> = {
  [SmartGoalPhase.Plan]: "notStarted",
  [SmartGoalPhase.Track]: "inProgress",
  [SmartGoalPhase.Complete]: "completed",
  [SmartGoalPhase.Archive]: "completed",
}

/**
 * The GitHub issue state that corresponds to each SMART goal phase.
 */
export const PHASE_TO_GITHUB_STATE: Readonly<Record<SmartGoalPhase, "open" | "closed">> = {
  [SmartGoalPhase.Plan]: "open",
  [SmartGoalPhase.Track]: "open",
  [SmartGoalPhase.Complete]: "closed",
  [SmartGoalPhase.Archive]: "closed",
}

/**
 * The bond that links a Microsoft To Do task to a GitHub issue.
 *
 * This link is the concrete expression of a cross-platform commitment: the
 * same SMART goal lives simultaneously on both platforms, and the Integrity
 * sync engine ensures they stay in agreement at all times.
 */
export interface IntegrityLink {
  /** Microsoft To Do list that owns the task. */
  listId: string
  /** Microsoft To Do task ID. */
  taskId: string
  /** GitHub repository owner (user or org). */
  owner: string
  /** GitHub repository name. */
  repo: string
  /** GitHub issue number. */
  issueNumber: number
  /** GitHub issue HTML URL. */
  issueUrl: string
}

/**
 * GitHub issue actions that carry Integrity significance – i.e., those that
 * must be reflected in the linked Microsoft To Do task.
 *
 * Other GitHub issue actions (edited, labeled, assigned, milestoned, etc.) do
 * not change the commitment status of a SMART goal and are intentionally
 * ignored by the Integrity sync engine.
 */
export type GitHubIssueAction = "opened" | "closed" | "reopened"
