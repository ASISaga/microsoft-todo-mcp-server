/**
 * GitHubClient – a thin wrapper around the GitHub REST API.
 *
 * Reads the `GITHUB_TOKEN` environment variable for authentication.
 */
import { GITHUB_API_BASE, USER_AGENT } from "../integrity/constants.js"
import { logger } from "../integrity/logger.js"

const log = logger.child({ module: "GitHubClient" })

export { GITHUB_API_BASE }

/** Represents a GitHub issue returned by the REST API. */
export interface GitHubIssue {
  number: number
  html_url: string
  title: string
  state: string
  body: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
}

export class GitHubClient {
  /** Returns `true` when a GitHub token is configured in the environment. */
  hasToken(): boolean {
    return !!process.env.GITHUB_TOKEN
  }

  /** Returns the GitHub Personal Access Token from the environment, or `null`. */
  private getToken(): string | null {
    return process.env.GITHUB_TOKEN || null
  }

  /**
   * Perform an authenticated GitHub API request.
   * Acquires the token from the environment internally.
   *
   * @param url    Full URL (use `GITHUB_API_BASE` + path).
   * @param method HTTP method (default: `"GET"`).
   * @param body   Request body for POST / PATCH requests.
   * @returns      Parsed JSON response, or `null` for 204 No Content.
   * @throws       Error when GITHUB_TOKEN is not configured or on HTTP error responses.
   */
  async request<T>(url: string, method = "GET", body?: unknown): Promise<T | null> {
    const token = this.getToken()
    if (!token) {
      throw new Error("GITHUB_TOKEN environment variable is not configured")
    }

    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    }

    try {
      const options: RequestInit = { method, headers }

      if (body && (method === "POST" || method === "PATCH")) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)

      if (response.status === 204) return null

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GitHub API error! status: ${response.status}, body: ${errorText}`)
      }

      return (await response.json()) as T
    } catch (error) {
      log.error("Error making GitHub API request", { error: String(error), url })
      throw error
    }
  }
}

/** Singleton GitHub API client used by all MCP tool handlers. */
export const gitHubClient = new GitHubClient()
