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
import { getTokens } from "../token-manager.js"

const MS_GRAPH_BASE = "https://graph.microsoft.com/v1.0"
const USER_AGENT = "microsoft-todo-mcp-server/1.0"

// ── Helpers ──────────────────────────────────────────────────────────────────

async function graphRequest<T>(url: string, token: string, method = "GET", body?: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph API ${method} ${url} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

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
async function findLinkedTask(token: string, issueUrl: string): Promise<{ listId: string; taskId: string } | null> {
  const listsRes = await graphRequest<{ value: Array<{ id: string }> }>(`${MS_GRAPH_BASE}/me/todo/lists`, token)
  if (!listsRes?.value) return null

  for (const list of listsRes.value) {
    const tasksRes = await graphRequest<{
      value: Array<{ id: string; body?: { content: string } }>
    }>(`${MS_GRAPH_BASE}/me/todo/lists/${list.id}/tasks?$filter=status ne 'completed'&$select=id,body`, token)

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

  const tokens = await getTokens()
  if (!tokens) {
    context.error("No Microsoft Graph tokens available")
    return { status: 500, body: "Graph authentication not configured" }
  }

  const msToken = tokens.accessToken

  if (action === "opened") {
    // Create a new Todo task for this issue
    const defaultListId = process.env.MS_TODO_LIST_ID
    if (!defaultListId) {
      context.warn("MS_TODO_LIST_ID not configured – skipping task creation")
      return { status: 200, body: "MS_TODO_LIST_ID not set" }
    }

    const taskBody = `GitHub Issue: ${issue.html_url}\n\n${issue.body ?? ""}`
    await graphRequest(`${MS_GRAPH_BASE}/me/todo/lists/${defaultListId}/tasks`, msToken, "POST", {
      title: issue.title,
      body: { content: taskBody, contentType: "text" },
    })

    context.log(`Created Todo task for GitHub issue #${issue.number}`)
    return { status: 200, body: "Task created" }
  }

  if (action === "closed" || action === "reopened") {
    const linked = await findLinkedTask(msToken, issue.html_url as string)
    if (!linked) {
      context.log(`No linked Todo task found for ${issue.html_url}`)
      return { status: 200, body: "No linked task found" }
    }

    const newStatus = action === "closed" ? "completed" : "notStarted"
    await graphRequest(`${MS_GRAPH_BASE}/me/todo/lists/${linked.listId}/tasks/${linked.taskId}`, msToken, "PATCH", {
      status: newStatus,
    })

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
