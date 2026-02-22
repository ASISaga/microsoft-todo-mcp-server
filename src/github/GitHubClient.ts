/**
 * GitHubClient – a thin wrapper around the GitHub REST API.
 *
 * Uses the `GITHUB_TOKEN` environment variable for authentication.
 */
import { GITHUB_API_BASE, USER_AGENT } from "../constants.js"

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
  /** Returns the GitHub Personal Access Token from the environment, or `null`. */
  getToken(): string | null {
    return process.env.GITHUB_TOKEN || null
  }

  /**
   * Perform an authenticated GitHub API request.
   *
   * @param url    Full URL (use `GITHUB_API_BASE` + path).
   * @param token  Bearer access token.
   * @param method HTTP method (default: `"GET"`).
   * @param body   Request body for POST / PATCH requests.
   * @returns      Parsed JSON response, or `null` for 204 No Content.
   * @throws       Error on HTTP error responses.
   */
  async request<T>(url: string, token: string, method = "GET", body?: unknown): Promise<T | null> {
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
      console.error("Error making GitHub API request:", error)
      throw error
    }
  }
}

/** Singleton GitHub API client used by all MCP tool handlers. */
export const gitHubClient = new GitHubClient()
