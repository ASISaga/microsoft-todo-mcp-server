/**
 * Utility tools – MCP tool registrations for bulk operations and diagnostics.
 *
 * Registers: archive-completed-tasks, test-graph-api-exploration
 */
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { graphClient, MS_GRAPH_BASE } from "../graph/GraphClient.js"
import type { Task, TaskList } from "../graph/types.js"
import { getAccessToken } from "../auth/AuthService.js"

export function registerUtilityTools(server: McpServer): void {
  server.tool(
    "archive-completed-tasks",
    "Move completed tasks older than a specified number of days from one list to another (archive) list. Useful for cleaning up active lists while preserving historical tasks.",
    {
      sourceListId: z.string().describe("ID of the source list to archive tasks from"),
      targetListId: z.string().describe("ID of the target archive list"),
      olderThanDays: z
        .number()
        .min(0)
        .default(90)
        .describe("Archive tasks completed more than this many days ago (default: 90)"),
      dryRun: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, only preview what would be archived without making changes"),
    },
    async ({ sourceListId, targetListId, olderThanDays, dryRun }) => {
      try {
        const token = await getAccessToken()
        if (!token) {
          return { content: [{ type: "text", text: "Failed to authenticate with Microsoft API" }] }
        }

        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

        const tasksResponse = await graphClient.request<{ value: Task[] }>(
          `${MS_GRAPH_BASE}/me/todo/lists/${sourceListId}/tasks?$filter=status eq 'completed'`,
          token,
        )

        if (!tasksResponse || !tasksResponse.value) {
          return { content: [{ type: "text", text: "Failed to retrieve tasks from source list" }] }
        }

        const tasksToArchive = tasksResponse.value.filter((task) => {
          if (!task.completedDateTime?.dateTime) return false
          return new Date(task.completedDateTime.dateTime) < cutoffDate
        })

        if (tasksToArchive.length === 0) {
          return {
            content: [{ type: "text", text: `No completed tasks found older than ${olderThanDays} days.` }],
          }
        }

        if (dryRun) {
          let preview = `📋 Archive Preview\n`
          preview += `Would archive ${tasksToArchive.length} tasks completed before ${cutoffDate.toLocaleDateString()}\n\n`

          tasksToArchive.forEach((task) => {
            const completedDate = task.completedDateTime?.dateTime
              ? new Date(task.completedDateTime.dateTime).toLocaleDateString()
              : "Unknown"
            preview += `- ${task.title} (completed: ${completedDate})\n`
          })

          return { content: [{ type: "text", text: preview }] }
        }

        let successCount = 0
        const failedTasks: string[] = []

        for (const task of tasksToArchive) {
          try {
            const createResponse = await graphClient.request(
              `${MS_GRAPH_BASE}/me/todo/lists/${targetListId}/tasks`,
              token,
              "POST",
              {
                title: task.title,
                status: "completed",
                body: task.body,
                importance: task.importance,
                completedDateTime: task.completedDateTime,
                dueDateTime: task.dueDateTime,
                reminderDateTime: task.reminderDateTime,
                categories: task.categories,
              },
            )

            if (createResponse) {
              await graphClient.request(
                `${MS_GRAPH_BASE}/me/todo/lists/${sourceListId}/tasks/${task.id}`,
                token,
                "DELETE",
              )
              successCount++
            } else {
              failedTasks.push(task.title)
            }
          } catch {
            failedTasks.push(task.title)
          }
        }

        let result = `📦 Archive Complete\n`
        result += `Successfully archived ${successCount} of ${tasksToArchive.length} tasks\n`
        result += `Tasks completed before ${cutoffDate.toLocaleDateString()} were moved.\n`

        if (failedTasks.length > 0) {
          result += `\n⚠️ Failed to archive ${failedTasks.length} tasks:\n`
          failedTasks.forEach((title) => {
            result += `- ${title}\n`
          })
        }

        return { content: [{ type: "text", text: result }] }
      } catch (error) {
        return { content: [{ type: "text", text: `Error archiving tasks: ${error}` }] }
      }
    },
  )

  server.tool(
    "test-graph-api-exploration",
    "Test various Graph API queries to discover hidden properties or endpoints for folder/group organization in Microsoft To Do.",
    {
      testType: z
        .enum(["odata-select", "odata-expand", "headers", "extensions", "all"])
        .describe("Type of test to run"),
    },
    async ({ testType }) => {
      try {
        const token = await getAccessToken()
        if (!token) {
          return { content: [{ type: "text", text: "Failed to authenticate with Microsoft API" }] }
        }

        let results = "🔍 Graph API Exploration Results\n" + "=".repeat(50) + "\n\n"

        // Test 1: $select=* to retrieve all properties
        if (testType === "odata-select" || testType === "all") {
          results += "📊 Test 1: Using $select=* to retrieve all properties\n"
          try {
            const response = await graphClient.request<{ value: Record<string, unknown>[] }>(
              `${MS_GRAPH_BASE}/me/todo/lists?$select=*`,
              token,
            )
            if (response && response.value && response.value.length > 0) {
              const firstList = response.value[0]
              const properties = Object.keys(firstList)
              results += `Found ${properties.length} properties: ${properties.join(", ")}\n`
              results += "\nExample list object:\n"
              results += JSON.stringify(firstList, null, 2).substring(0, 1000) + "...\n"
            }
          } catch (error) {
            results += `Error: ${error}\n`
          }
          results += "\n"
        }

        // Test 2: $expand options
        if (testType === "odata-expand" || testType === "all") {
          results += "📊 Test 2: Using $expand to retrieve related data\n"
          const expandOptions = [
            "extensions",
            "singleValueExtendedProperties",
            "multiValueExtendedProperties",
            "openExtensions",
            "parent",
            "children",
            "folder",
            "parentFolder",
            "group",
            "category",
          ]

          for (const expand of expandOptions) {
            try {
              const response = await graphClient.request<{ value: Record<string, unknown>[] }>(
                `${MS_GRAPH_BASE}/me/todo/lists?$expand=${expand}&$top=1`,
                token,
              )
              if (response && response.value) {
                results += `✓ $expand=${expand}: Success - `
                if (response.value.length > 0 && response.value[0][expand]) {
                  results += `Found data!\n`
                  results += JSON.stringify(response.value[0][expand], null, 2).substring(0, 500) + "...\n"
                } else {
                  results += `No additional data returned\n`
                }
              }
            } catch (error: unknown) {
              results += `✗ $expand=${expand}: ${(error as Error).message || "Failed"}\n`
            }
          }
          results += "\n"
        }

        // Test 3: Response headers
        if (testType === "headers" || testType === "all") {
          results += "📊 Test 3: Checking response headers\n"
          try {
            const response = await fetch(`${MS_GRAPH_BASE}/me/todo/lists`, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                Prefer: "return=representation",
              },
            })

            results += "Response headers:\n"
            response.headers.forEach((value, key) => {
              results += `${key}: ${value}\n`
            })
          } catch (error) {
            results += `Error: ${error}\n`
          }
          results += "\n"
        }

        // Test 4: Extensions endpoint
        if (testType === "extensions" || testType === "all") {
          results += "📊 Test 4: Checking for extensions\n"
          try {
            const listsResponse = await graphClient.request<{ value: TaskList[] }>(
              `${MS_GRAPH_BASE}/me/todo/lists?$top=1`,
              token,
            )

            if (listsResponse && listsResponse.value && listsResponse.value.length > 0) {
              const listId = listsResponse.value[0].id
              try {
                const extResponse = await graphClient.request(
                  `${MS_GRAPH_BASE}/me/todo/lists/${listId}/extensions`,
                  token,
                )
                results += `Extensions found: ${JSON.stringify(extResponse, null, 2)}\n`
              } catch (error: unknown) {
                results += `No extensions endpoint: ${(error as Error).message}\n`
              }
            }
          } catch (error) {
            results += `Error: ${error}\n`
          }
          results += "\n"
        }

        // Test 5: Hidden folder/group endpoints
        if (testType === "all") {
          results += "📊 Test 5: Checking for folder/group endpoints\n"
          const endpoints = [
            "/me/todo/folders",
            "/me/todo/groups",
            "/me/todo/listGroups",
            "/me/todo/listFolders",
            "/me/todo/categories",
          ]

          for (const endpoint of endpoints) {
            try {
              const response = await graphClient.request(`${MS_GRAPH_BASE}${endpoint}`, token)
              results += `✓ ${endpoint}: Found! Response: ${JSON.stringify(response).substring(0, 200)}...\n`
            } catch (error: unknown) {
              results += `✗ ${endpoint}: Not found (${(error as Error).message || "Failed"})\n`
            }
          }
        }

        results += "\n" + "=".repeat(50) + "\n"
        results += "Analysis complete. Check results above for any discovered properties or endpoints."

        return { content: [{ type: "text", text: results }] }
      } catch (error) {
        return { content: [{ type: "text", text: `Error during Graph API exploration: ${error}` }] }
      }
    },
  )
}
