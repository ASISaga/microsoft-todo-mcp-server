/**
 * Azure Function HTTP trigger – receives GitHub webhook events.
 *
 * Configure this URL as a webhook in your GitHub repository:
 *   https://<app>.azurewebsites.net/api/github-webhook
 *
 * Required GitHub webhook events: Issues (opened, closed, reopened)
 *
 * Required App Settings:
 *   GITHUB_WEBHOOK_SECRET  – secret configured in the GitHub webhook
 *   MS_TODO_LIST_ID        – (optional) default list to create tasks in
 *
 * The function:
 *   - On `issues.opened`:  creates a new Microsoft Todo task linked to the issue
 *   - On `issues.closed`:  marks the linked Microsoft Todo task as completed
 *   - On `issues.reopened`: marks the linked Microsoft Todo task as not started
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions"
import { createHmac, timingSafeEqual } from "node:crypto"
import { graphClient } from "../../todo/graph/GraphClient.js"
import { githubActionToTodoStatus, buildTaskBodyFromIssue } from "../../integrity/sync.js"

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify the GitHub webhook HMAC-SHA256 signature.
 * Returns true if the payload matches the secret.
 */
function verifySignature(secret: string, rawBody: Buffer, sigHeader: string | null): boolean {
  if (!sigHeader?.startsWith("sha256=")) return false
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(sigHeader))
  } catch {
    return false
  }
}

/** Find a Todo task whose body contains a link to the given GitHub issue URL. */
async function findLinkedTask(issueUrl: string): Promise<{ listId: string; taskId: string } | null> {
  const listsRes = await graphClient.request<{ value: Array<{ id: string }> }>(
    "https://graph.microsoft.com/v1.0/me/todo/lists",
  )
  if (!listsRes?.value) return null

  for (const list of listsRes.value) {
    const tasksRes = await graphClient.request<{
      value: Array<{ id: string; body?: { content: string } }>
    }>(`https://graph.microsoft.com/v1.0/me/todo/lists/${list.id}/tasks?$filter=status ne 'completed'&$select=id,body`)

    for (const task of tasksRes?.value ?? []) {
      if (task.body?.content?.includes(issueUrl)) {
        return { listId: list.id, taskId: task.id }
      }
    }
  }
  return null
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function githubWebhookHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
  const rawBody = Buffer.from(await request.arrayBuffer())

  // Validate signature when a secret is configured
  if (webhookSecret) {
    const sig = request.headers.get("x-hub-signature-256")
    if (!verifySignature(webhookSecret, rawBody, sig)) {
      context.warn("GitHub webhook signature verification failed")
      return { status: 401, body: "Signature mismatch" }
    }
  }

  let payload: Record<string, any>
  try {
    payload = JSON.parse(rawBody.toString("utf8"))
  } catch {
    return { status: 400, body: "Invalid JSON" }
  }

  const event = request.headers.get("x-github-event")
  context.log(`GitHub event: ${event}, action: ${payload.action}`)

  if (event !== "issues") {
    return { status: 200, body: "Event ignored" }
  }

  const { action, issue } = payload as { action: string; issue: Record<string, any> }

  if (action === "opened") {
    // Create a new Todo task for this issue (Plan phase: commitment being made)
    const defaultListId = process.env.MS_TODO_LIST_ID
    if (!defaultListId) {
      context.warn("MS_TODO_LIST_ID not configured – skipping task creation")
      return { status: 200, body: "MS_TODO_LIST_ID not set" }
    }

    const taskBody = buildTaskBodyFromIssue(issue.html_url as string, issue.body as string | null)
    await graphClient.request(`https://graph.microsoft.com/v1.0/me/todo/lists/${defaultListId}/tasks`, "POST", {
      title: issue.title,
      body: { content: taskBody, contentType: "text" },
    })

    context.log(`Created Todo task for GitHub issue #${issue.number}`)
    return { status: 200, body: "Task created" }
  }

  if (action === "closed" || action === "reopened") {
    const linked = await findLinkedTask(issue.html_url as string)
    if (!linked) {
      context.log(`No linked Todo task found for ${issue.html_url}`)
      return { status: 200, body: "No linked task found" }
    }

    const newStatus = githubActionToTodoStatus(action)
    await graphClient.request(
      `https://graph.microsoft.com/v1.0/me/todo/lists/${linked.listId}/tasks/${linked.taskId}`,
      "PATCH",
      { status: newStatus },
    )

    context.log(`Updated Todo task ${linked.taskId} → status: ${newStatus}`)
    return { status: 200, body: "Task updated" }
  }

  return { status: 200, body: "Action ignored" }
}

app.http("github-webhook", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "github-webhook",
  handler: githubWebhookHandler,
})
