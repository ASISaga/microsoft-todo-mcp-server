/**
 * GitHubTools – MCP tool registrations for GitHub ↔ Microsoft To Do integration.
 *
 * Registers: create-github-issue-from-task, sync-github-issues-to-todo,
 *            get-github-issue-status
 */
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { GraphClient, MS_GRAPH_BASE } from "../graph/GraphClient.js"
import type { Task, TaskList } from "../graph/types.js"
import { GitHubClient, GITHUB_API_BASE, type GitHubIssue } from "../github/GitHubClient.js"
import { extractGitHubRepo, extractGitHubIssueLink } from "../github/utils.js"

export class GitHubTools {
  constructor(
    private readonly graphClient: GraphClient,
    private readonly gitHubClient: GitHubClient,
  ) {}

  register(server: McpServer): void {
    server.tool(
      "create-github-issue-from-task",
      "Create a GitHub issue from a Microsoft Todo task. The task title or body must contain a GitHub repository hashtag in the format #owner/repo (e.g. #myorg/myrepo). Requires the GITHUB_TOKEN environment variable. The GitHub issue URL is stored back in the task body so it can be synced later.",
      {
        listId: z.string().describe("ID of the task list"),
        taskId: z.string().describe("ID of the task"),
      },
      async ({ listId, taskId }) => {
        try {
          if (!this.gitHubClient.hasToken()) {
            return {
              content: [
                {
                  type: "text",
                  text: "GitHub token not configured. Please set the GITHUB_TOKEN environment variable.",
                },
              ],
            }
          }

          const task = await this.graphClient.request<Task>(`${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}`)

          if (!task) {
            return { content: [{ type: "text", text: `Failed to retrieve task with ID: ${taskId}` }] }
          }

          const bodyContent = task.body?.content || ""

          if (extractGitHubIssueLink(bodyContent)) {
            return {
              content: [
                {
                  type: "text",
                  text: `Task already has a linked GitHub issue. Use sync-github-issues-to-todo to check its status.`,
                },
              ],
            }
          }

          const repo = extractGitHubRepo(task.title) || extractGitHubRepo(bodyContent)
          if (!repo) {
            return {
              content: [
                {
                  type: "text",
                  text: `No GitHub repository hashtag found in task. Add a hashtag like #owner/repo to the task title or body.`,
                },
              ],
            }
          }

          const issueBody = bodyContent
            ? `${bodyContent}\n\n---\n*Created from Microsoft Todo task*`
            : `*Created from Microsoft Todo task*`

          const issue = await this.gitHubClient.request<GitHubIssue>(
            `${GITHUB_API_BASE}/repos/${repo.owner}/${repo.repo}/issues`,
            "POST",
            { title: task.title, body: issueBody },
          )

          if (!issue) {
            return { content: [{ type: "text", text: `Failed to create GitHub issue` }] }
          }

          const updatedBody = bodyContent
            ? `${bodyContent}\n\nGitHub Issue: ${issue.html_url}`
            : `GitHub Issue: ${issue.html_url}`

          await this.graphClient.request<Task>(`${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}`, "PATCH", {
            body: { content: updatedBody, contentType: "text" },
          })

          return {
            content: [
              {
                type: "text",
                text: `GitHub issue created successfully!\nIssue: ${issue.html_url}\nTitle: ${issue.title}\nThe task body has been updated with a link to the GitHub issue.`,
              },
            ],
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error creating GitHub issue: ${error}` }] }
        }
      },
    )

    server.tool(
      "sync-github-issues-to-todo",
      "Sync GitHub issue statuses back to Microsoft Todo. Scans tasks in the specified list (or all lists if omitted) for linked GitHub issue URLs and marks tasks as completed when their corresponding GitHub issues are closed. Requires the GITHUB_TOKEN environment variable.",
      {
        listId: z.string().optional().describe("ID of the task list to sync. If omitted, all task lists are scanned."),
      },
      async ({ listId }) => {
        try {
          if (!this.gitHubClient.hasToken()) {
            return {
              content: [
                {
                  type: "text",
                  text: "GitHub token not configured. Please set the GITHUB_TOKEN environment variable.",
                },
              ],
            }
          }

          let listIds: string[] = []
          if (listId) {
            listIds = [listId]
          } else {
            const listsResponse = await this.graphClient.request<{ value: TaskList[] }>(
              `${MS_GRAPH_BASE}/me/todo/lists`,
            )
            if (!listsResponse || !listsResponse.value) {
              return { content: [{ type: "text", text: "Failed to retrieve task lists" }] }
            }
            listIds = listsResponse.value.map((l) => l.id)
          }

          let checkedCount = 0
          let syncedCount = 0
          const details: string[] = []

          for (const currentListId of listIds) {
            const tasksResponse = await this.graphClient.request<{ value: Task[] }>(
              `${MS_GRAPH_BASE}/me/todo/lists/${currentListId}/tasks?$filter=status ne 'completed'`,
            )
            if (!tasksResponse || !tasksResponse.value) continue

            for (const task of tasksResponse.value) {
              const bodyContent = task.body?.content || ""
              const issueLink = extractGitHubIssueLink(bodyContent)
              if (!issueLink) continue

              checkedCount++

              try {
                const issue = await this.gitHubClient.request<GitHubIssue>(
                  `${GITHUB_API_BASE}/repos/${issueLink.owner}/${issueLink.repo}/issues/${issueLink.issueNumber}`,
                )

                if (issue && issue.state === "closed") {
                  await this.graphClient.request<Task>(
                    `${MS_GRAPH_BASE}/me/todo/lists/${currentListId}/tasks/${task.id}`,
                    "PATCH",
                    { status: "completed" },
                  )
                  syncedCount++
                  details.push(
                    `✓ "${task.title}" marked as completed (GitHub issue #${issueLink.issueNumber} is closed)`,
                  )
                } else if (issue) {
                  details.push(`○ "${task.title}" — GitHub issue #${issueLink.issueNumber} is still open`)
                }
              } catch (error) {
                details.push(`⚠️ Could not check "${task.title}": ${error}`)
              }
            }
          }

          let summary = `GitHub ↔ Todo Sync Complete\n`
          summary += `Checked ${checkedCount} task(s) with linked GitHub issues.\n`
          summary += `Marked ${syncedCount} task(s) as completed.\n`
          if (details.length > 0) {
            summary += `\nDetails:\n${details.join("\n")}`
          }

          return { content: [{ type: "text", text: summary }] }
        } catch (error) {
          return { content: [{ type: "text", text: `Error syncing GitHub issues to Todo: ${error}` }] }
        }
      },
    )

    server.tool(
      "get-github-issue-status",
      "Get the current status of the GitHub issue linked to a Microsoft Todo task. The task must have a GitHub issue URL in its body (added automatically by create-github-issue-from-task). Requires the GITHUB_TOKEN environment variable.",
      {
        listId: z.string().describe("ID of the task list"),
        taskId: z.string().describe("ID of the task"),
      },
      async ({ listId, taskId }) => {
        try {
          if (!this.gitHubClient.hasToken()) {
            return {
              content: [
                {
                  type: "text",
                  text: "GitHub token not configured. Please set the GITHUB_TOKEN environment variable.",
                },
              ],
            }
          }

          const task = await this.graphClient.request<Task>(`${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}`)

          if (!task) {
            return { content: [{ type: "text", text: `Failed to retrieve task with ID: ${taskId}` }] }
          }

          const bodyContent = task.body?.content || ""
          const issueLink = extractGitHubIssueLink(bodyContent)

          if (!issueLink) {
            return {
              content: [
                {
                  type: "text",
                  text: `No linked GitHub issue found in task "${task.title}". Use create-github-issue-from-task to link one.`,
                },
              ],
            }
          }

          const issue = await this.gitHubClient.request<GitHubIssue>(
            `${GITHUB_API_BASE}/repos/${issueLink.owner}/${issueLink.repo}/issues/${issueLink.issueNumber}`,
          )

          if (!issue) {
            return { content: [{ type: "text", text: `Failed to retrieve GitHub issue` }] }
          }

          const stateEmoji = issue.state === "open" ? "🟢" : "🔴"
          let result = `GitHub Issue Status\n`
          result += `Task: "${task.title}"\n`
          result += `Issue: ${issue.html_url}\n`
          result += `Status: ${stateEmoji} ${issue.state}\n`
          result += `Title: ${issue.title}\n`
          result += `Created: ${new Date(issue.created_at).toLocaleString()}\n`
          if (issue.closed_at) {
            result += `Closed: ${new Date(issue.closed_at).toLocaleString()}\n`
          }

          return { content: [{ type: "text", text: result }] }
        } catch (error) {
          return { content: [{ type: "text", text: `Error getting GitHub issue status: ${error}` }] }
        }
      },
    )
  }
}
