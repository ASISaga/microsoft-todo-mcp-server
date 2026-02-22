/**
 * MCP server orchestrator – creates the McpServer instance, registers all
 * tool groups, and exports the server for use with Azure Functions HTTP
 * transport or the stdio transport (direct execution).
 *
 * Tool implementations live in `src/tools/`:
 *   auth-tools.ts        – authentication / session status
 *   task-list-tools.ts   – task-list CRUD
 *   task-tools.ts        – task CRUD
 *   checklist-tools.ts   – checklist-item CRUD
 *   utility-tools.ts     – bulk archive + Graph API diagnostics
 *   github-tools.ts      – GitHub ↔ To Do integration
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import dotenv from "dotenv"
import { registerAuthTools } from "./tools/auth-tools.js"
import { registerTaskListTools } from "./tools/task-list-tools.js"
import { registerTaskTools } from "./tools/task-tools.js"
import { registerChecklistTools } from "./tools/checklist-tools.js"
import { registerUtilityTools } from "./tools/utility-tools.js"
import { registerGitHubTools } from "./tools/github-tools.js"

// Load environment variables (no-op in Azure Functions where they come from App Settings)
dotenv.config()

// ── Server instance ───────────────────────────────────────────────────────────

const server = new McpServer({
  name: "mstodo",
  version: "1.0.0",
})

// ── Register all tools ────────────────────────────────────────────────────────

registerAuthTools(server)
registerTaskListTools(server)
registerTaskTools(server)
registerChecklistTools(server)
registerUtilityTools(server)
registerGitHubTools(server)

// ── Exports ───────────────────────────────────────────────────────────────────

/** Start the server using the stdio transport (used when run directly). */
export async function startServer(): Promise<void> {
  try {
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js")
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error("MCP server started on stdio")
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
