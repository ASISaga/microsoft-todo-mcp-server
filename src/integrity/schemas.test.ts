/**
 * Tests for Zod webhook payload schemas (src/integrity/schemas.ts).
 */
import { describe, it, expect } from "vitest"
import { GitHubIssuesEventSchema, GraphNotificationPayloadSchema, GraphNotificationSchema } from "./schemas.js"

describe("GitHubIssuesEventSchema", () => {
  it("accepts a valid issues event", () => {
    const payload = {
      action: "opened",
      issue: {
        number: 42,
        title: "Fix login bug",
        html_url: "https://github.com/ASISaga/IntegrityMCP/issues/42",
        body: "Description here",
        state: "open",
      },
      repository: {
        name: "IntegrityMCP",
        owner: { login: "ASISaga" },
      },
    }

    const result = GitHubIssuesEventSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it("accepts event without repository", () => {
    const payload = {
      action: "closed",
      issue: {
        number: 1,
        title: "Test",
        html_url: "https://github.com/o/r/issues/1",
        body: null,
        state: "closed",
      },
    }

    const result = GitHubIssuesEventSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it("rejects payload missing issue", () => {
    const result = GitHubIssuesEventSchema.safeParse({ action: "opened" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid html_url", () => {
    const payload = {
      action: "opened",
      issue: {
        number: 1,
        title: "Test",
        html_url: "not-a-url",
        body: null,
        state: "open",
      },
    }
    const result = GitHubIssuesEventSchema.safeParse(payload)
    expect(result.success).toBe(false)
  })
})

describe("GraphNotificationSchema", () => {
  it("accepts a valid notification", () => {
    const notification = {
      id: "abc-123",
      changeType: "created",
      clientState: "secret",
      resource: "me/todo/lists/list1/tasks/task1",
      resourceData: {
        id: "task1",
        "@odata.type": "#microsoft.graph.todoTask",
        "@odata.id": "me/todo/lists/list1/tasks/task1",
      },
    }

    const result = GraphNotificationSchema.safeParse(notification)
    expect(result.success).toBe(true)
  })

  it("accepts notification without optional fields", () => {
    const notification = {
      id: "abc",
      changeType: "updated",
      resource: "me/todo/lists/x/tasks/y",
    }

    const result = GraphNotificationSchema.safeParse(notification)
    expect(result.success).toBe(true)
  })
})

describe("GraphNotificationPayloadSchema", () => {
  it("accepts a valid payload with multiple notifications", () => {
    const payload = {
      value: [
        { id: "1", changeType: "created", resource: "me/todo/lists/a/tasks/b" },
        { id: "2", changeType: "updated", resource: "me/todo/lists/c/tasks/d" },
      ],
    }

    const result = GraphNotificationPayloadSchema.safeParse(payload)
    expect(result.success).toBe(true)
  })

  it("rejects payload without value array", () => {
    const result = GraphNotificationPayloadSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
