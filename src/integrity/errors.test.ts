/**
 * Tests for the domain error types (src/integrity/errors.ts).
 */
import { describe, it, expect } from "vitest"
import { IntegrityError, AuthError, GraphError, GitHubError, WebhookError, formatErrorForTool } from "./errors.js"

describe("IntegrityError", () => {
  it("carries code and message", () => {
    const err = new IntegrityError("VALIDATION_ERROR", "bad input")
    expect(err.code).toBe("VALIDATION_ERROR")
    expect(err.message).toBe("bad input")
    expect(err.name).toBe("IntegrityError")
  })

  it("carries optional context", () => {
    const err = new IntegrityError("VALIDATION_ERROR", "bad input", { field: "title" })
    expect(err.context).toEqual({ field: "title" })
  })
})

describe("subclasses", () => {
  it("AuthError has correct name", () => {
    const err = new AuthError("AUTH_NO_TOKEN", "no token")
    expect(err.name).toBe("AuthError")
    expect(err instanceof IntegrityError).toBe(true)
  })

  it("GraphError has correct name", () => {
    const err = new GraphError("GRAPH_REQUEST_FAILED", "request failed")
    expect(err.name).toBe("GraphError")
    expect(err instanceof IntegrityError).toBe(true)
  })

  it("GitHubError has correct name", () => {
    const err = new GitHubError("GITHUB_NO_TOKEN", "no token")
    expect(err.name).toBe("GitHubError")
    expect(err instanceof IntegrityError).toBe(true)
  })

  it("WebhookError has correct name", () => {
    const err = new WebhookError("WEBHOOK_SIGNATURE_INVALID", "bad sig")
    expect(err.name).toBe("WebhookError")
    expect(err instanceof IntegrityError).toBe(true)
  })
})

describe("formatErrorForTool", () => {
  it("formats IntegrityError with code prefix", () => {
    const err = new IntegrityError("AUTH_NO_TOKEN", "no token")
    expect(formatErrorForTool(err)).toBe("[AUTH_NO_TOKEN] no token")
  })

  it("stringifies unknown errors", () => {
    expect(formatErrorForTool("some string")).toBe("some string")
    expect(formatErrorForTool(new Error("generic"))).toBe("Error: generic")
  })
})
