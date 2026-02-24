/**
 * AuthService – authentication helpers for the MCP tool handlers.
 *
 * Wraps token lifecycle management from `TokenManager` and provides
 * convenience methods used by individual tool implementations.
 */
import { TokenManager, tokenManager } from "../token-manager.js"
import { MS_GRAPH_BASE } from "../../integrity/constants.js"

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
      console.error("No valid tokens available")
      return null
    } catch (error) {
      console.error("Error getting access token:", error)
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
        console.error(`Error getting user info: ${response.status}`)
        return false
      }

      const userData = await response.json()
      const email: string = userData.mail || userData.userPrincipalName || ""
      const domain = email.split("@")[1]?.toLowerCase()

      if (domain && PERSONAL_ACCOUNT_DOMAINS.some((d) => domain.includes(d))) {
        console.error(`
=================================================================
WARNING: Personal Microsoft Account Detected

Your Microsoft account (${email}) appears to be a personal account.
Microsoft To Do API access is typically not available for personal accounts
through the Microsoft Graph API, only for Microsoft 365 business accounts.

You may encounter the "MailboxNotEnabledForRESTAPI" error. This is a
limitation of the Microsoft Graph API, not an issue with authentication.
=================================================================
        `)
        return true
      }

      return false
    } catch (error) {
      console.error("Error checking account type:", error)
      return false
    }
  }
}

/** Singleton AuthService instance used across the application. */
export const authService = new AuthService(tokenManager)
