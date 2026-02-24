/**
 * GraphClient – a thin wrapper around the Microsoft Graph REST API.
 *
 * Features:
 *  - Automatic `Authorization`, `Accept`, `Content-Type`, and `User-Agent` headers
 *  - Token acquisition and 401 auto-retry handled internally via AuthService
 *  - Special error message for MailboxNotEnabledForRESTAPI (personal accounts)
 *  - Returns `null` on network errors (errors are logged to stderr)
 */
import { MS_GRAPH_BASE, MS_GRAPH_BETA_BASE, USER_AGENT } from "../../integrity/constants.js"
import { AuthService, authService } from "../auth/AuthService.js"
import { logger } from "../../integrity/logger.js"

const log = logger.child({ module: "GraphClient" })

export { MS_GRAPH_BASE }

export class GraphClient {
  constructor(private readonly authService: AuthService) {}

  /**
   * Perform an authenticated Graph API request.
   * Acquires a token from AuthService automatically and retries once on 401.
   *
   * @param url    Full URL (use `MS_GRAPH_BASE` + path).
   * @param method HTTP method (default: `"GET"`).
   * @param body   Request body for POST / PATCH requests.
   * @returns      Parsed JSON response, or `null` on error / 204 No Content.
   */
  async request<T>(url: string, method = "GET", body?: unknown): Promise<T | null> {
    let token = await this.authService.getAccessToken()
    if (!token) {
      log.error("No access token available for Graph API request")
      return null
    }

    const buildHeaders = (t: string): Record<string, string> => ({
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
    })

    try {
      const options: RequestInit = { method, headers: buildHeaders(token) }

      if (body && (method === "POST" || method === "PATCH")) {
        options.body = JSON.stringify(body)
      }

      log.debug("Graph API request", { url, method })

      let response = await fetch(url, options)

      // On 401, attempt a single token refresh and retry
      if (response.status === 401) {
        log.info("Got 401, attempting token refresh")
        const newToken = await this.authService.getAccessToken()
        if (newToken && newToken !== token) {
          token = newToken
          response = await fetch(url, { ...options, headers: buildHeaders(token) })
        }
      }

      if (response.status === 204) return null

      if (!response.ok) {
        const errorText = await response.text()
        log.error("Graph API HTTP error", { status: response.status, url })

        if (errorText.includes("MailboxNotEnabledForRESTAPI")) {
          log.error("MailboxNotEnabledForRESTAPI — To Do API unavailable for personal Microsoft accounts")
          throw new Error(
            "Microsoft To Do API is not available for personal Microsoft accounts. See console for details.",
          )
        }

        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
      }

      const data = await response.json()
      log.debug("Graph API response received", { url })
      return data as T
    } catch (error) {
      log.error("Error making Graph API request", { error: String(error), url })
      return null
    }
  }

  /**
   * Resolve the GitHub owner and repository for a given To Do list.
   *
   * Uses the Microsoft Graph beta API to read:
   *  - The list's `displayName` → repository name
   *  - The list's `groupId`    → look up the list group's `displayName` → owner
   *
   * Returns `null` when the list has no associated group (meaning it is not
   * mapped to a GitHub repository in the structural architecture).
   */
  async resolveOwnerRepoFromList(listId: string): Promise<{ owner: string; repo: string } | null> {
    const list = await this.request<{ id: string; displayName: string; groupId?: string }>(
      `${MS_GRAPH_BETA_BASE}/me/todo/lists/${listId}`,
    )
    if (!list?.groupId) return null

    const group = await this.request<{ id: string; displayName: string }>(
      `${MS_GRAPH_BETA_BASE}/me/todo/listGroups/${list.groupId}`,
    )
    if (!group) return null

    return { owner: group.displayName, repo: list.displayName }
  }
}

/** Singleton Graph API client used by all MCP tool handlers. */
export const graphClient = new GraphClient(authService)
