/**
 * Azure Function Timer trigger – renews Microsoft Graph change notification
 * subscriptions before they expire.
 *
 * Runs every 12 hours (well within the 4 230-minute / ~2.9-day maximum
 * expiry for Microsoft To Do task subscriptions).
 *
 * Required App Settings:
 *   GRAPH_SUBSCRIPTION_IDS  – comma-separated list of subscription IDs to renew
 *
 * To create subscriptions initially, POST to /api/manage-subscriptions
 * or use the Microsoft Graph Explorer / az cli.
 */
import { app, InvocationContext, Timer } from "@azure/functions"
import { getTokens } from "../token-manager.js"

const MS_GRAPH_BASE = "https://graph.microsoft.com/v1.0"
const USER_AGENT = "microsoft-todo-mcp-server/1.0"

/** Max expiry for todoTask subscriptions: 4 230 minutes */
const SUBSCRIPTION_EXPIRY_MINUTES = 4230

async function renewSubscriptions(_timer: Timer, context: InvocationContext): Promise<void> {
  const idsEnv = process.env.GRAPH_SUBSCRIPTION_IDS
  if (!idsEnv) {
    context.log("GRAPH_SUBSCRIPTION_IDS not set – nothing to renew")
    return
  }

  const subscriptionIds = idsEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const tokens = await getTokens()
  if (!tokens) {
    context.error("No Microsoft Graph tokens available – cannot renew subscriptions")
    return
  }

  const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_EXPIRY_MINUTES * 60 * 1000).toISOString()

  for (const id of subscriptionIds) {
    try {
      const res = await fetch(`${MS_GRAPH_BASE}/subscriptions/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify({ expirationDateTime }),
      })

      if (res.ok) {
        context.log(`Renewed subscription ${id} until ${expirationDateTime}`)
      } else {
        const text = await res.text()
        context.error(`Failed to renew subscription ${id}: ${res.status} ${text}`)
      }
    } catch (err) {
      context.error(`Error renewing subscription ${id}:`, err)
    }
  }
}

app.timer("subscription-renew", {
  schedule: "0 0 */12 * * *", // every 12 hours
  handler: renewSubscriptions,
})
