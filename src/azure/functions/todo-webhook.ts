/**
 * Azure Function HTTP trigger – receives Microsoft Graph change notifications
 * for Microsoft To Do tasks.
 *
 * Notification URL to register:
 *   https://<app>.azurewebsites.net/api/todo-webhook
 *
 * Microsoft Graph sends two types of requests to this endpoint:
 *   1. Validation (GET/POST with ?validationToken=...) – must echo the token back
 *   2. Change notification (POST with JSON payload)
 *
 * When a new To Do task is created in a list whose parent group name matches a
 * GitHub owner/org and whose list display name matches a repository name, the
 * function automatically opens a GitHub issue.  No hashtags are required – the
 * structural mapping (group → owner, list → repo) determines the target.
 *
 * Required App Settings:
 *   GITHUB_TOKEN  – GitHub personal access token with repo scope
 *
 * To create the Graph subscription (run once, renew via subscription-renew):
 *   POST https://graph.microsoft.com/v1.0/subscriptions
 *   {
 *     "changeType": "created,updated",
 *     "notificationUrl": "https://<app>.azurewebsites.net/api/todo-webhook",
 *     "resource": "me/todo/lists/<listId>/tasks",
 *     "expirationDateTime": "<ISO8601 up to 4230 min from now>",
 *     "clientState": "<random secret stored in GRAPH_SUBSCRIPTION_SECRET>"
 *   }
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions"
import { graphClient } from "../../todo/graph/GraphClient.js"
import { gitHubClient, GITHUB_API_BASE } from "../../github/GitHubClient.js"
import { hasGitHubIssueLink, buildIssueBodyFromTask, appendIssueLink } from "../../integrity/sync.js"

// ── Notification processing ───────────────────────────────────────────────────

interface GraphNotification {
  id: string
  changeType: string
  clientState?: string
  resource: string
  resourceData?: {
    id: string
    "@odata.type": string
    "@odata.id": string
  }
}

async function processNotification(notification: GraphNotification, context: InvocationContext): Promise<void> {
  if (notification.changeType !== "created") return

  if (!gitHubClient.hasToken()) {
    context.warn("GITHUB_TOKEN not configured – skipping GitHub issue creation")
    return
  }

  // Validate client state to prevent spoofed notifications
  const expectedState = process.env.GRAPH_SUBSCRIPTION_SECRET
  if (expectedState && notification.clientState !== expectedState) {
    context.warn(`clientState mismatch for notification ${notification.id}`)
    return
  }

  // Resolve the task from the resource URL
  // e.g. "me/todo/lists/{listId}/tasks/{taskId}"
  const resourceUrl = `https://graph.microsoft.com/v1.0/${notification.resource}`

  const task = await graphClient.request<{
    id: string
    title: string
    body?: { content: string; contentType: string }
  }>(resourceUrl)

  if (!task) {
    context.warn(`Could not fetch task from ${resourceUrl}`)
    return
  }

  const bodyContent = task.body?.content ?? ""

  // Skip if a GitHub issue link already exists (task already synced)
  if (hasGitHubIssueLink(bodyContent)) {
    context.log(`Task "${task.title}" already has a GitHub issue link`)
    return
  }

  // Extract listId from the resource path and resolve owner/repo structurally.
  // The list group display name = GitHub owner; the list display name = repo.
  const listIdMatch = notification.resource.match(/lists\/([^/]+)\/tasks/)
  if (!listIdMatch) {
    context.warn(`Could not extract listId from resource: ${notification.resource}`)
    return
  }
  const listId = listIdMatch[1]

  const ownerRepo = await graphClient.resolveOwnerRepoFromList(listId)
  if (!ownerRepo) {
    context.log(`List ${listId} has no associated list group – skipping GitHub issue creation`)
    return
  }

  const issueBody = buildIssueBodyFromTask(bodyContent)

  const issue = await gitHubClient.request<{ html_url: string; number: number }>(
    `${GITHUB_API_BASE}/repos/${ownerRepo.owner}/${ownerRepo.repo}/issues`,
    "POST",
    { title: task.title, body: issueBody },
  )

  if (!issue) return

  context.log(`Created GitHub issue #${issue.number} for task "${task.title}"`)

  // Store the issue URL back in the task body so the link can be resolved later
  const updatedBody = appendIssueLink(bodyContent, issue.html_url)

  await graphClient.request(`https://graph.microsoft.com/v1.0/me/todo/lists/${listId}/tasks/${task.id}`, "PATCH", {
    body: { content: updatedBody, contentType: "text" },
  })
}

// ── Azure Function handler ────────────────────────────────────────────────────

async function todoWebhookHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  // Microsoft Graph validation handshake
  const validationToken = request.query.get("validationToken")
  if (validationToken) {
    context.log("Graph subscription validation request")
    return {
      status: 200,
      headers: { "Content-Type": "text/plain" },
      body: validationToken,
    }
  }

  let payload: { value: GraphNotification[] }
  try {
    payload = (await request.json()) as { value: GraphNotification[] }
  } catch {
    return { status: 400, body: "Invalid JSON" }
  }

  // Process each notification asynchronously (respond quickly to Graph)
  const tasks = (payload.value ?? []).map((n) =>
    processNotification(n, context).catch((err) => context.error("Notification processing error:", err)),
  )

  await Promise.all(tasks)

  return { status: 202 }
}

app.http("todo-webhook", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "todo-webhook",
  handler: todoWebhookHandler,
})
