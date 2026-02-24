/**
 * Tests for the structured logger (src/integrity/logger.ts).
 */
import { describe, it, expect, vi } from "vitest"
import { Logger } from "./logger.js"

describe("Logger", () => {
  it("logs messages to stderr", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const log = new Logger("debug")

    log.info("hello")

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toContain("INFO hello")
    spy.mockRestore()
  })

  it("respects minimum log level", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const log = new Logger("warn")

    log.debug("should not appear")
    log.info("should not appear")
    log.warn("should appear")
    log.error("should appear")

    expect(spy).toHaveBeenCalledTimes(2)
    spy.mockRestore()
  })

  it("includes context in output", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const log = new Logger("debug")

    log.info("request", { url: "/api/test" })

    expect(spy.mock.calls[0][0]).toContain('{"url":"/api/test"}')
    spy.mockRestore()
  })

  it("child logger merges base context", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const parent = new Logger("debug")
    const child = parent.child({ module: "GraphClient" })

    child.info("request", { url: "/api/test" })

    expect(spy.mock.calls[0][0]).toContain('"module":"GraphClient"')
    expect(spy.mock.calls[0][0]).toContain('"url":"/api/test"')
    spy.mockRestore()
  })
})
