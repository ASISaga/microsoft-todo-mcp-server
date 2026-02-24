/**
 * Integrity MCP server orchestrator – builds the dependency graph, instantiates
 * all tool groups, registers them with the McpServer, and exports the server for
 * use with Azure Functions HTTP transport or the stdio transport.
 *
 * Integrity is the state of being "whole, complete, and unbroken":
 *   Plan Your Work  → create SMART goals as tasks / issues
 *   Work Your Plan  → track completion across both platforms in sync
 *
 * Dependency hierarchy:
 *   TokenManager
 *     └─ AuthService
 *          └─ GraphClient  (Microsoft To Do – first-class citizen)
 *   GitHubClient           (GitHub Issues  – first-class citizen)
 *
 * Tool classes (registered via their `register(server)` method):
 *   AuthTools          – authentication / session status
 *   TaskListTools      – task-list CRUD (Microsoft To Do)
 *   TaskTools          – task CRUD (Microsoft To Do)
 *   ChecklistTools     – checklist-item CRUD (Microsoft To Do)
 *   UtilityTools       – bulk archive + Graph API diagnostics
 *   GitHubTools        – GitHub Issues ↔ Microsoft To Do sync
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import dotenv from "dotenv"
import { VERSION } from "../integrity/constants.js"
import { tokenManager } from "../todo/token-manager.js"
import { authService } from "../todo/auth/AuthService.js"
import { graphClient } from "../todo/graph/GraphClient.js"
import { gitHubClient } from "../github/GitHubClient.js"
import { AuthTools } from "../todo/tools/auth-tools.js"
import { TaskListTools } from "../todo/tools/task-list-tools.js"
import { TaskTools } from "../todo/tools/task-tools.js"
import { ChecklistTools } from "../todo/tools/checklist-tools.js"
import { UtilityTools } from "../todo/tools/utility-tools.js"
import { GitHubTools } from "../github/tools/github-tools.js"

// Load environment variables (no-op in Azure Functions where they come from App Settings)
dotenv.config()

// ── Server instance ───────────────────────────────────────────────────────────

const server = new McpServer({
  name: "integrity",
  version: VERSION,
})

// ── Register all tools (constructor injection) ────────────────────────────────

new AuthTools(tokenManager, authService).register(server)
new TaskListTools(graphClient).register(server)
new TaskTools(graphClient).register(server)
new ChecklistTools(graphClient).register(server)
new UtilityTools(graphClient, authService).register(server)
new GitHubTools(graphClient, gitHubClient).register(server)

// ── Exports ───────────────────────────────────────────────────────────────────

/** Start the server using the stdio transport (used when run directly). */
export async function startServer(): Promise<void> {
  try {
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error("Integrity MCP server started on stdio")
  } catch (error) {
    console.error("Error starting server:", error)
    throw error
  }
}

/** Configured server instance for use with alternative transports (e.g. Azure Functions HTTP). */
export { server as mcpServer }

// ── Main entry point ──────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    console.error("Fatal error in main():", error)
    process.exit(1)
  })
}
