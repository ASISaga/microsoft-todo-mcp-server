/**
 * Tests for the Result type utilities (src/integrity/result.ts).
 */
import { describe, it, expect } from "vitest"
import { ok, err, type Result } from "./result.js"

describe("ok", () => {
  it("creates a success result", () => {
    const result = ok(42)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(42)
    }
  })

  it("works with objects", () => {
    const result = ok({ id: "abc" })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.id).toBe("abc")
    }
  })
})

describe("err", () => {
  it("creates a failure result", () => {
    const result = err(new Error("failed"))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.message).toBe("failed")
    }
  })

  it("works with string errors", () => {
    const result: Result<string, string> = err("something went wrong")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("something went wrong")
    }
  })
})
