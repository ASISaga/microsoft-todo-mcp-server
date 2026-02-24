/**
 * Typed domain errors for the Integrity MCP server.
 *
 * Every error carries a machine-readable `code` string and optional structured
 * context.  Tool handlers and webhook functions can pattern-match on `code`
 * to return meaningful messages instead of opaque stack traces.
 */

/** Union of all known Integrity error codes. */
export type IntegrityErrorCode =
  | "AUTH_NO_TOKEN"
  | "AUTH_REFRESH_FAILED"
  | "AUTH_PERSONAL_ACCOUNT"
  | "GRAPH_REQUEST_FAILED"
  | "GRAPH_MAILBOX_NOT_ENABLED"
  | "GITHUB_NO_TOKEN"
  | "GITHUB_REQUEST_FAILED"
  | "WEBHOOK_SIGNATURE_INVALID"
  | "WEBHOOK_PAYLOAD_INVALID"
  | "SYNC_NO_LINKED_TASK"
  | "SYNC_NO_LIST_GROUP"
  | "VALIDATION_ERROR"

/**
 * Base error class for all Integrity domain errors.
 */
export class IntegrityError extends Error {
  readonly code: IntegrityErrorCode
  readonly context?: Record<string, unknown>

  constructor(code: IntegrityErrorCode, message: string, context?: Record<string, unknown>) {
    super(message)
    this.name = "IntegrityError"
    this.code = code
    this.context = context
  }
}

/** Raised when authentication tokens are missing or cannot be refreshed. */
export class AuthError extends IntegrityError {
  constructor(code: Extract<IntegrityErrorCode, `AUTH_${string}`>, message: string, context?: Record<string, unknown>) {
    super(code, message, context)
    this.name = "AuthError"
  }
}

/** Raised when a Microsoft Graph API request fails. */
export class GraphError extends IntegrityError {
  constructor(
    code: Extract<IntegrityErrorCode, `GRAPH_${string}`>,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(code, message, context)
    this.name = "GraphError"
  }
}

/** Raised when a GitHub API request fails. */
export class GitHubError extends IntegrityError {
  constructor(
    code: Extract<IntegrityErrorCode, `GITHUB_${string}`>,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(code, message, context)
    this.name = "GitHubError"
  }
}

/** Raised when webhook signature or payload validation fails. */
export class WebhookError extends IntegrityError {
  constructor(
    code: Extract<IntegrityErrorCode, `WEBHOOK_${string}`>,
    message: string,
    context?: Record<string, unknown>,
  ) {
    super(code, message, context)
    this.name = "WebhookError"
  }
}

/**
 * Format an IntegrityError for display in an MCP tool response.
 * Returns a user-friendly string suitable for the `text` content field.
 */
export function formatErrorForTool(error: unknown): string {
  if (error instanceof IntegrityError) {
    return `[${error.code}] ${error.message}`
  }
  return String(error)
}
