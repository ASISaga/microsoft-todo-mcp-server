/**
 * GraphClient – a thin wrapper around the Microsoft Graph REST API.
 *
 * Features:
 *  - Automatic `Authorization`, `Accept`, `Content-Type`, and `User-Agent` headers
 *  - 401 auto-retry with a fresh token from AuthService
 *  - Special error message for MailboxNotEnabledForRESTAPI (personal accounts)
 *  - Returns `null` on network errors (errors are logged to stderr)
 */
import { MS_GRAPH_BASE, USER_AGENT } from "../constants.js"
import { getAccessToken } from "../auth/AuthService.js"

export { MS_GRAPH_BASE }

export class GraphClient {
  /**
   * Perform an authenticated Graph API request.
   *
   * @param url    Full URL (use `MS_GRAPH_BASE` + path).
   * @param token  Bearer access token.
   * @param method HTTP method (default: `"GET"`).
   * @param body   Request body for POST / PATCH requests.
   * @returns      Parsed JSON response, or `null` on error / 204 No Content.
   */
  async request<T>(url: string, token: string, method = "GET", body?: unknown): Promise<T | null> {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }

    try {
      const options: RequestInit = { method, headers }

      if (body && (method === "POST" || method === "PATCH")) {
        options.body = JSON.stringify(body)
      }

      console.error(`Making request to: ${url}`)
      console.error(
        `Request options: ${JSON.stringify({
          method,
          headers: { ...headers, Authorization: "Bearer [REDACTED]" },
        })}`,
      )

      let response = await fetch(url, options)

      // On 401, attempt a single token refresh and retry
      if (response.status === 401) {
        console.error("Got 401, attempting token refresh...")
        const newToken = await getAccessToken()
        if (newToken && newToken !== token) {
          headers.Authorization = `Bearer ${newToken}`
          response = await fetch(url, { ...options, headers })
        }
      }

      if (response.status === 204) return null

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`HTTP error! status: ${response.status}, body: ${errorText}`)

        if (errorText.includes("MailboxNotEnabledForRESTAPI")) {
          console.error(`
=================================================================
ERROR: MailboxNotEnabledForRESTAPI

The Microsoft To Do API is not available for personal Microsoft accounts
(outlook.com, hotmail.com, live.com, etc.) through the Graph API.

This is a limitation of the Microsoft Graph API, not an authentication issue.
Microsoft only allows To Do API access for Microsoft 365 business accounts.
=================================================================
          `)
          throw new Error(
            "Microsoft To Do API is not available for personal Microsoft accounts. See console for details.",
          )
        }

        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`)
      }

      const data = await response.json()
      console.error(`Response received: ${JSON.stringify(data).substring(0, 200)}...`)
      return data as T
    } catch (error) {
      console.error("Error making Graph API request:", error)
      return null
    }
  }
}

/** Singleton Graph API client used by all MCP tool handlers. */
export const graphClient = new GraphClient()
