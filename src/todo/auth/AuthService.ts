/**
 * AuthService – authentication helpers for the MCP tool handlers.
 *
 * Wraps token lifecycle management from `TokenManager` and provides
 * convenience methods used by individual tool implementations.
 */
import { TokenManager, tokenManager } from "../token-manager.js"
import { MS_GRAPH_BASE } from "../../integrity/constants.js"
import { logger } from "../../integrity/logger.js"

const log = logger.child({ module: "AuthService" })

/** Personal Microsoft account email domains that lack Graph To Do access. */
const PERSONAL_ACCOUNT_DOMAINS = ["outlook.com", "hotmail.com", "live.com", "msn.com", "passport.com"]

/**
 * Provides authentication helpers: access token retrieval and personal-account detection.
 */
export class AuthService {
  constructor(private readonly tokenManager: TokenManager) {}

  /**
   * Returns a valid Microsoft Graph access token, or `null` when no token is
   * available (logs the error to stderr).
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const tokens = await this.tokenManager.getTokens()
      if (tokens) {
        return tokens.accessToken
      }
      log.warn("No valid tokens available")
      return null
    } catch (error) {
      log.error("Error getting access token", { error: String(error) })
      return null
    }
  }

  /**
   * Returns `true` when the signed-in account appears to be a personal Microsoft
   * account (outlook.com, hotmail.com, etc.) that cannot access the To Do API.
   * Logs a prominent warning message in that case.
   */
  async isPersonalMicrosoftAccount(): Promise<boolean> {
    try {
      const token = await this.getAccessToken()
      if (!token) return false

      const response = await fetch(`${MS_GRAPH_BASE}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      if (!response.ok) {
        log.error("Error getting user info", { status: response.status })
        return false
      }

      const userData = await response.json()
      const email: string = userData.mail || userData.userPrincipalName || ""
      const domain = email.split("@")[1]?.toLowerCase()

      if (domain && PERSONAL_ACCOUNT_DOMAINS.some((d) => domain.includes(d))) {
        log.warn("Personal Microsoft Account detected — To Do API may not be available", { email })
        return true
      }

      return false
    } catch (error) {
      log.error("Error checking account type", { error: String(error) })
      return false
    }
  }
}

/** Singleton AuthService instance used across the application. */
export const authService = new AuthService(tokenManager)
