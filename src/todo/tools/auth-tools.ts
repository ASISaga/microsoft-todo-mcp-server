/**
 * AuthTools – MCP tool registrations for authentication / session status.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { TokenManager } from "../token-manager.js"
import type { AuthService } from "../auth/AuthService.js"

export class AuthTools {
  constructor(
    private readonly tokenManager: TokenManager,
    private readonly authService: AuthService,
  ) {}

  register(server: McpServer): void {
    server.tool(
      "auth-status",
      "Check if you're authenticated with Microsoft Graph API. Shows current token status and expiration time, and indicates if the token needs to be refreshed.",
      {},
      async () => {
        const tokens = await this.tokenManager.getTokens()

        if (!tokens) {
          return {
            content: [
              {
                type: "text",
                text: "Not authenticated. Please configure MS_TODO_ACCESS_TOKEN and MS_TODO_REFRESH_TOKEN environment variables.",
              },
            ],
          }
        }

        const isExpired = Date.now() > tokens.expiresAt
        const expiryTime = new Date(tokens.expiresAt).toLocaleString()

        const isPersonal = await this.authService.isPersonalMicrosoftAccount()
        let accountMessage = ""

        if (isPersonal) {
          accountMessage =
            "\n\n⚠️ WARNING: You are using a personal Microsoft account. " +
            "Microsoft To Do API access is typically not available for personal accounts " +
            "through the Microsoft Graph API. You may encounter 'MailboxNotEnabledForRESTAPI' errors. " +
            "This is a Microsoft limitation, not an authentication issue."
        }

        if (isExpired) {
          return {
            content: [
              {
                type: "text",
                text: `Authentication expired at ${expiryTime}. Will attempt to refresh when you call any API.${accountMessage}`,
              },
            ],
          }
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Authenticated. Token expires at ${expiryTime}.${accountMessage}`,
              },
            ],
          }
        }
      },
    )
  }
}
