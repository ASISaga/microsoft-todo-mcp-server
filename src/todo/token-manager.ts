// src/todo/token-manager.ts
// Token management for Azure Functions – reads from environment variables,
// refreshes via OAuth 2.0 refresh-token grant, and caches in-memory.

import { logger } from "../integrity/logger.js"

const log = logger.child({ module: "TokenManager" })

/** Buffer before token expiry to trigger proactive refresh (5 minutes). */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

export interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Manages Microsoft Graph access tokens: reads from environment variables,
 * refreshes via the OAuth 2.0 refresh-token grant, and caches in-memory.
 *
 * Environment variables read:
 *   MS_TODO_ACCESS_TOKEN     – current access token
 *   MS_TODO_REFRESH_TOKEN    – OAuth refresh token
 *   MS_TODO_TOKEN_EXPIRES_AT – Unix-ms expiry of the access token
 *   CLIENT_ID / MS_TODO_CLIENT_ID
 *   CLIENT_SECRET / MS_TODO_CLIENT_SECRET
 *   TENANT_ID / MS_TODO_TENANT_ID (default: "organizations")
 */
export class TokenManager {
  /** In-memory token cache; survives between warm Azure Function invocations. */
  private cachedToken: TokenData | null = null

  /**
   * Returns a valid Microsoft Graph token set, refreshing when necessary.
   * Returns `null` when no token or refresh token is available.
   */
  async getTokens(): Promise<TokenData | null> {
    // 1. Return cached token if still valid (with 5-min buffer)
    if (this.cachedToken && Date.now() < this.cachedToken.expiresAt - TOKEN_REFRESH_BUFFER_MS) {
      return this.cachedToken
    }

    // 2. Bootstrap from env vars
    const envAccessToken = process.env.MS_TODO_ACCESS_TOKEN
    const envRefreshToken = process.env.MS_TODO_REFRESH_TOKEN
    const envExpiresAt = process.env.MS_TODO_TOKEN_EXPIRES_AT ? parseInt(process.env.MS_TODO_TOKEN_EXPIRES_AT, 10) : 0

    if (envAccessToken && envExpiresAt && Date.now() < envExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
      this.cachedToken = {
        accessToken: envAccessToken,
        refreshToken: envRefreshToken || "",
        expiresAt: envExpiresAt,
      }
      return this.cachedToken
    }

    // 3. Refresh via refresh-token grant
    const refreshToken = envRefreshToken || this.cachedToken?.refreshToken
    if (refreshToken) {
      return this.refreshAccessToken(refreshToken)
    }

    log.warn("No valid access token or refresh token available")
    return null
  }

  private async refreshAccessToken(refreshToken: string): Promise<TokenData | null> {
    const clientId = process.env.CLIENT_ID || process.env.MS_TODO_CLIENT_ID
    const clientSecret = process.env.CLIENT_SECRET || process.env.MS_TODO_CLIENT_SECRET
    const tenantId = process.env.TENANT_ID || process.env.MS_TODO_TENANT_ID || "organizations"

    if (!clientId || !clientSecret) {
      log.error("Missing CLIENT_ID or CLIENT_SECRET for token refresh")
      return null
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

    const formData = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "offline_access Tasks.Read Tasks.ReadWrite Tasks.Read.Shared Tasks.ReadWrite.Shared User.Read",
    })

    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        log.error("Token refresh failed", { status: response.status, error: errorText })
        return null
      }

      const data = await response.json()
      const expiresAt = Date.now() + (data.expires_in || 3600) * 1000 - TOKEN_REFRESH_BUFFER_MS

      this.cachedToken = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt,
      }

      return this.cachedToken
    } catch (error) {
      log.error("Error refreshing token", { error: String(error) })
      return null
    }
  }
}

/** Singleton TokenManager instance used across the application. */
export const tokenManager = new TokenManager()
