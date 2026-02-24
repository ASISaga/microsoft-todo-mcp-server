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
import { graphClient } from "../../todo/graph/GraphClient.js"

/** Maximum subscription expiry for Microsoft To Do tasks: 4 230 min ≈ 2.9 days. */
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

  const expirationDateTime = new Date(Date.now() + SUBSCRIPTION_EXPIRY_MINUTES * 60 * 1000).toISOString()

  for (const id of subscriptionIds) {
    try {
      const result = await graphClient.request(`https://graph.microsoft.com/v1.0/subscriptions/${id}`, "PATCH", {
        expirationDateTime,
      })

      if (result !== null) {
        context.log(`Renewed subscription ${id} until ${expirationDateTime}`)
      } else {
        context.error(`Failed to renew subscription ${id}: unexpected null response`)
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
