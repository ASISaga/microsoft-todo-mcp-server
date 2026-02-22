/**
 * Azure Function HTTP trigger – exposes the MCP server over Streamable HTTP.
 *
 * Clients (Claude, Cursor, etc.) connect to:
 *   POST   /api/mcp  – send a JSON-RPC request and receive a response
 *   GET    /api/mcp  – open an SSE stream (used by MCP clients for server-push)
 *   DELETE /api/mcp  – terminate an active session
 *
 * Authentication is enforced at the Azure Functions level via the
 * `authLevel: "function"` key requirement.
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { mcpServer } from "../todo-index.js"
import { createIncomingMessage, createMockServerResponse } from "../azure-http-adapter.js"

// Per-function-app session map (survives warm re-use)
const sessions = new Map<string, StreamableHTTPServerTransport>()

async function mcpHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log("MCP request:", request.method, request.url)

  const sessionId = request.headers.get("mcp-session-id") ?? undefined

  // Reuse an existing transport for this session, or create a new one
  let transport: StreamableHTTPServerTransport | undefined = sessionId ? sessions.get(sessionId) : undefined

  if (!transport) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      onsessioninitialized: (id) => {
        sessions.set(id, transport!)
      },
    })

    transport.onclose = () => {
      const id = (transport as any)._sessionId
      if (id) sessions.delete(id)
    }

    await mcpServer.connect(transport)
  }

  // Collect headers from the Azure Functions request
  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  // Read body
  const bodyBuffer = Buffer.from(await request.arrayBuffer())
  let parsedBody: unknown
  if (bodyBuffer.length > 0 && headers["content-type"]?.includes("application/json")) {
    try {
      parsedBody = JSON.parse(bodyBuffer.toString("utf8"))
    } catch {
      return { status: 400, body: "Invalid JSON body" }
    }
  }

  const nodeReq = createIncomingMessage(request.method, headers, bodyBuffer)
  const { res: nodeRes, result } = createMockServerResponse()

  await transport.handleRequest(nodeReq, nodeRes, parsedBody)

  const { status, headers: respHeaders, body } = await result

  return {
    status,
    headers: respHeaders,
    body,
  }
}

app.http("mcp", {
  methods: ["GET", "POST", "DELETE"],
  authLevel: "function",
  route: "mcp",
  handler: mcpHandler,
})
