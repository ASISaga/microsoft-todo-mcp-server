/**
 * Tests for the SMART goal types (src/integrity/types.ts).
 */
import { describe, it, expect } from "vitest"
import { SmartGoalPhase, PHASE_TO_TODO_STATUS, PHASE_TO_GITHUB_STATE } from "./types.js"

describe("SmartGoalPhase", () => {
  it("has exactly four phases", () => {
    const phases = Object.values(SmartGoalPhase)
    expect(phases).toEqual(["plan", "track", "complete", "archive"])
  })
})

describe("PHASE_TO_TODO_STATUS", () => {
  it("maps Plan to notStarted", () => {
    expect(PHASE_TO_TODO_STATUS[SmartGoalPhase.Plan]).toBe("notStarted")
  })

  it("maps Track to inProgress", () => {
    expect(PHASE_TO_TODO_STATUS[SmartGoalPhase.Track]).toBe("inProgress")
  })

  it("maps Complete to completed", () => {
    expect(PHASE_TO_TODO_STATUS[SmartGoalPhase.Complete]).toBe("completed")
  })

  it("maps Archive to completed", () => {
    expect(PHASE_TO_TODO_STATUS[SmartGoalPhase.Archive]).toBe("completed")
  })
})

describe("PHASE_TO_GITHUB_STATE", () => {
  it("maps Plan and Track to open", () => {
    expect(PHASE_TO_GITHUB_STATE[SmartGoalPhase.Plan]).toBe("open")
    expect(PHASE_TO_GITHUB_STATE[SmartGoalPhase.Track]).toBe("open")
  })

  it("maps Complete and Archive to closed", () => {
    expect(PHASE_TO_GITHUB_STATE[SmartGoalPhase.Complete]).toBe("closed")
    expect(PHASE_TO_GITHUB_STATE[SmartGoalPhase.Archive]).toBe("closed")
  })
})
