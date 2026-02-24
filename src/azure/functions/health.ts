/**
 * Azure Function HTTP trigger — lightweight health-check endpoint.
 *
 * Returns service status including version, uptime, and connectivity indicators.
 * Useful for monitoring dashboards and deployment verification.
 *
 * GET /api/health
 */
import { app, HttpResponseInit } from "@azure/functions"

const startedAt = Date.now()

async function healthHandler(): Promise<HttpResponseInit> {
  return {
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "healthy",
      version: "2.0.0",
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      services: {
        graphApi: !!process.env.MS_TODO_REFRESH_TOKEN,
        github: !!process.env.GITHUB_TOKEN,
        webhooks: {
          github: !!process.env.GITHUB_WEBHOOK_SECRET,
          graph: !!process.env.GRAPH_SUBSCRIPTION_SECRET,
        },
      },
    }),
  }
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthHandler,
})
