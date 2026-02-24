/**
 * Zod schemas for validating inbound webhook payloads.
 *
 * Using Zod for runtime validation ensures that malformed payloads are
 * rejected early with clear error messages instead of causing opaque
 * failures deep in the business logic.
 */
import { z } from "zod"

// ── GitHub webhook schemas ────────────────────────────────────────────────────

/** GitHub issue as embedded in webhook payloads. */
export const GitHubIssuePayloadSchema = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string().url(),
  body: z.string().nullable(),
  state: z.string(),
})

/** GitHub repository as embedded in webhook payloads. */
export const GitHubRepositoryPayloadSchema = z.object({
  name: z.string(),
  owner: z.object({
    login: z.string(),
  }),
})

/** Top-level GitHub `issues` webhook event payload. */
export const GitHubIssuesEventSchema = z.object({
  action: z.string(),
  issue: GitHubIssuePayloadSchema,
  repository: GitHubRepositoryPayloadSchema.optional(),
})

export type GitHubIssuesEvent = z.infer<typeof GitHubIssuesEventSchema>

// ── Microsoft Graph notification schemas ──────────────────────────────────────

/** Single Graph change notification entry. */
export const GraphNotificationSchema = z.object({
  id: z.string(),
  changeType: z.string(),
  clientState: z.string().optional(),
  resource: z.string(),
  resourceData: z
    .object({
      id: z.string(),
      "@odata.type": z.string(),
      "@odata.id": z.string(),
    })
    .optional(),
})

/** Top-level Graph change notification payload. */
export const GraphNotificationPayloadSchema = z.object({
  value: z.array(GraphNotificationSchema),
})

export type GraphNotification = z.infer<typeof GraphNotificationSchema>
export type GraphNotificationPayload = z.infer<typeof GraphNotificationPayloadSchema>
