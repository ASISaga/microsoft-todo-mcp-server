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
 *
 * Architecture: The To Do hierarchy mirrors the GitHub hierarchy.
 *   List group display name = GitHub owner / organisation
 *   List display name       = GitHub repository name
 *   Task                    = GitHub issue
 *
 * The function:
 *   - On `issues.opened`:   finds the To Do list whose parent group name matches
 *                           the repo owner and whose own name matches the repo,
 *                           then creates a linked task in that list.
 *   - On `issues.closed`:   marks the linked Microsoft Todo task as completed
 *   - On `issues.reopened`: marks the linked Microsoft Todo task as not started
 */
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions"
import { createHmac, timingSafeEqual } from "node:crypto"
import { graphClient } from "../../todo/graph/GraphClient.js"
import { githubActionToTodoStatus, buildTaskBodyFromIssue } from "../../integrity/sync.js"
import { MS_GRAPH_BASE, MS_GRAPH_BETA_BASE } from "../../integrity/constants.js"
import type { TaskList, TaskListGroup } from "../../todo/graph/types.js"

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

/**
 * Find the To Do list ID for the given GitHub owner and repository.
 *
 * Looks for a list group whose `displayName` equals `owner`, then within that
 * group looks for a list whose `displayName` equals `repo`.  If the list does
 * not exist it is created inside the matching group.
 *
 * Returns `null` when no list group matching the owner is found.
 */
async function findOrCreateListForRepo(
  owner: string,
  repo: string,
  context: InvocationContext,
): Promise<string | null> {
  // Find the list group matching the GitHub owner
  const groupsRes = await graphClient.request<{ value: TaskListGroup[] }>(`${MS_GRAPH_BETA_BASE}/me/todo/listGroups`)
  if (!groupsRes?.value) {
    context.warn("Could not retrieve To Do list groups")
    return null
  }

  const group = groupsRes.value.find((g) => g.displayName === owner)
  if (!group) {
    context.warn(`No To Do list group found matching GitHub owner "${owner}"`)
    return null
  }

  // Find or create the list matching the GitHub repository within that group.
  // Use the group's own lists endpoint to avoid fetching all lists.
  const listsRes = await graphClient.request<{ value: TaskList[] }>(
    `${MS_GRAPH_BETA_BASE}/me/todo/listGroups/${group.id}/lists`,
  )
  const lists = listsRes?.value ?? []
  const existing = lists.find((l) => l.displayName === repo)
  if (existing) return existing.id

  // Create a new list inside the group
  const newList = await graphClient.request<TaskList>(
    `${MS_GRAPH_BETA_BASE}/me/todo/listGroups/${group.id}/lists`,
    "POST",
    { displayName: repo },
  )
  if (!newList) {
    context.warn(`Failed to create To Do list "${repo}" in group "${owner}"`)
    return null
  }

  context.log(`Created To Do list "${repo}" in group "${owner}" (id: ${newList.id})`)
  return newList.id
}

/** Find a Todo task whose body contains a link to the given GitHub issue URL. */
async function findLinkedTask(issueUrl: string): Promise<{ listId: string; taskId: string } | null> {
  const listsRes = await graphClient.request<{ value: Array<{ id: string }> }>(`${MS_GRAPH_BASE}/me/todo/lists`)
  if (!listsRes?.value) return null

  for (const list of listsRes.value) {
    const tasksRes = await graphClient.request<{
      value: Array<{ id: string; body?: { content: string } }>
    }>(`${MS_GRAPH_BASE}/me/todo/lists/${list.id}/tasks?$filter=status ne 'completed'&$select=id,body`)

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

  const { action, issue, repository } = payload as {
    action: string
    issue: Record<string, any>
    repository?: Record<string, any>
  }

  if (action === "opened") {
    // Determine owner and repo from the webhook payload
    const owner = repository?.owner?.login as string | undefined
    const repo = repository?.name as string | undefined

    if (!owner || !repo) {
      context.warn("Webhook payload missing repository owner or name – skipping task creation")
      return { status: 200, body: "Repository info missing" }
    }

    // Find or create the To Do list matching this repository
    const listId = await findOrCreateListForRepo(owner, repo, context)
    if (!listId) {
      context.warn(`No matching To Do list group for owner "${owner}" – skipping task creation`)
      return { status: 200, body: "No matching list group" }
    }

    const taskBody = buildTaskBodyFromIssue(issue.html_url as string, issue.body as string | null)
    await graphClient.request(`${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks`, "POST", {
      title: issue.title,
      body: { content: taskBody, contentType: "text" },
    })

    context.log(`Created Todo task for GitHub issue #${issue.number} in list "${repo}" (owner: "${owner}")`)
    return { status: 200, body: "Task created" }
  }

  if (action === "closed" || action === "reopened") {
    const linked = await findLinkedTask(issue.html_url as string)
    if (!linked) {
      context.log(`No linked Todo task found for ${issue.html_url}`)
      return { status: 200, body: "No linked task found" }
    }

    const newStatus = githubActionToTodoStatus(action)
    await graphClient.request(`${MS_GRAPH_BASE}/me/todo/lists/${linked.listId}/tasks/${linked.taskId}`, "PATCH", {
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
