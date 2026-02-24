/**
 * TaskListTools – MCP tool registrations for Microsoft To Do task lists.
 *
 * Registers: get-task-lists, get-task-lists-organized, create-task-list,
 *            update-task-list, delete-task-list
 */
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { GraphClient, MS_GRAPH_BASE } from "../graph/GraphClient.js"
import type { TaskList } from "../graph/types.js"

export class TaskListTools {
  constructor(private readonly graphClient: GraphClient) {}

  register(server: McpServer): void {
    server.tool(
      "get-task-lists",
      "Get all Microsoft Todo task lists (the top-level containers that organize your tasks). Shows list names, IDs, and indicates default or shared lists.",
      {},
      async () => {
        try {
          const response = await this.graphClient.request<{ value: TaskList[] }>(`${MS_GRAPH_BASE}/me/todo/lists`)

          if (!response) {
            return { content: [{ type: "text", text: "Failed to retrieve task lists" }] }
          }

          const lists = response.value || []
          if (lists.length === 0) {
            return { content: [{ type: "text", text: "No task lists found." }] }
          }

          const formattedLists = lists.map((list) => {
            let wellKnownInfo = ""
            if (list.wellknownListName && list.wellknownListName !== "none") {
              if (list.wellknownListName === "defaultList") wellKnownInfo = " (Default Tasks List)"
              else if (list.wellknownListName === "flaggedEmails") wellKnownInfo = " (Flagged Emails)"
            }

            let sharingInfo = ""
            if (list.isShared) {
              sharingInfo = list.isOwner ? " (Shared by you)" : " (Shared with you)"
            }

            return `ID: ${list.id}\nName: ${list.displayName}${wellKnownInfo}${sharingInfo}\n---`
          })

          return {
            content: [{ type: "text", text: `Your task lists:\n\n${formattedLists.join("\n")}` }],
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error fetching task lists: ${error}` }] }
        }
      },
    )

    server.tool(
      "get-task-lists-organized",
      "Get all task lists organized into logical folders/categories based on naming patterns, emoji prefixes, and sharing status. Provides a hierarchical view similar to folder organization.",
      {
        includeIds: z.boolean().optional().describe("Include list IDs in output (default: false)"),
        groupBy: z
          .enum(["category", "shared", "type"])
          .optional()
          .describe("Grouping strategy - 'category' (default), 'shared', or 'type'"),
      },
      async ({ includeIds, groupBy }) => {
        try {
          const response = await this.graphClient.request<{ value: TaskList[] }>(`${MS_GRAPH_BASE}/me/todo/lists`)

          if (!response) {
            return { content: [{ type: "text", text: "Failed to retrieve task lists" }] }
          }

          const lists = response.value || []
          if (lists.length === 0) {
            return { content: [{ type: "text", text: "No task lists found." }] }
          }

          // Group by shared status
          if (groupBy === "shared") {
            const sharedLists = lists.filter((l) => l.isShared)
            const personalLists = lists.filter((l) => !l.isShared)

            let output = "📂 Microsoft To Do Lists - By Sharing Status\n"
            output += "=".repeat(50) + "\n\n"

            output += `👥 Shared Lists (${sharedLists.length})\n`
            sharedLists.forEach((list) => {
              const ownership = list.isOwner ? "Shared by you" : "Shared with you"
              output += `   ├─ ${list.displayName} [${ownership}]\n`
            })

            output += `\n🔒 Personal Lists (${personalLists.length})\n`
            personalLists.forEach((list) => {
              output += `   ├─ ${list.displayName}\n`
            })

            return { content: [{ type: "text", text: output }] }
          }

          // Organize lists into categories based on naming patterns
          const organizeLists = (allLists: TaskList[]): { [category: string]: TaskList[] } => {
            const organized: { [category: string]: TaskList[] } = {}

            const patterns = {
              archived: /\(([^)]+)\s*-\s*Archived\)$/i,
              archive: /^📦\s*Archive/i,
              shopping: /^🛒/,
              property: /^🏡/,
              family: /^👪/,
              seasonal: /^(🎄|🎉)/,
              work: /^(Work|SBIR)/i,
              travel: /^(🚗|Rangeley)/i,
              reading: /^📰/,
            }

            allLists.forEach((list) => {
              let placed = false

              const archiveMatch = list.displayName.match(patterns.archived)
              if (archiveMatch) {
                const category = `📦 Archived - ${archiveMatch[1]}`
                if (!organized[category]) organized[category] = []
                organized[category].push(list)
                placed = true
              } else if (patterns.archive.test(list.displayName)) {
                if (!organized["📦 Archives"]) organized["📦 Archives"] = []
                organized["📦 Archives"].push(list)
                placed = true
              } else if (patterns.shopping.test(list.displayName)) {
                if (!organized["🛒 Shopping Lists"]) organized["🛒 Shopping Lists"] = []
                organized["🛒 Shopping Lists"].push(list)
                placed = true
              } else if (patterns.property.test(list.displayName)) {
                if (!organized["🏡 Properties"]) organized["🏡 Properties"] = []
                organized["🏡 Properties"].push(list)
                placed = true
              } else if (patterns.family.test(list.displayName)) {
                if (!organized["👪 Family"]) organized["👪 Family"] = []
                organized["👪 Family"].push(list)
                placed = true
              } else if (patterns.seasonal.test(list.displayName)) {
                if (!organized["🎉 Seasonal & Events"]) organized["🎉 Seasonal & Events"] = []
                organized["🎉 Seasonal & Events"].push(list)
                placed = true
              } else if (patterns.work.test(list.displayName)) {
                if (!organized["💼 Work"]) organized["💼 Work"] = []
                organized["💼 Work"].push(list)
                placed = true
              } else if (patterns.travel.test(list.displayName)) {
                if (!organized["🚗 Travel & Rangeley"]) organized["🚗 Travel & Rangeley"] = []
                organized["🚗 Travel & Rangeley"].push(list)
                placed = true
              } else if (patterns.reading.test(list.displayName)) {
                if (!organized["📚 Reading"]) organized["📚 Reading"] = []
                organized["📚 Reading"].push(list)
                placed = true
              } else if (list.wellknownListName && list.wellknownListName !== "none") {
                if (!organized["⭐ Special Lists"]) organized["⭐ Special Lists"] = []
                organized["⭐ Special Lists"].push(list)
                placed = true
              } else if (list.isShared && !placed) {
                if (!organized["👥 Shared Lists"]) organized["👥 Shared Lists"] = []
                organized["👥 Shared Lists"].push(list)
                placed = true
              } else {
                if (!organized["📋 Other Lists"]) organized["📋 Other Lists"] = []
                organized["📋 Other Lists"].push(list)
              }
            })

            return organized
          }

          const organized = organizeLists(lists)

          let output = "📂 Microsoft To Do Lists - Organized View\n"
          output += "=".repeat(50) + "\n\n"

          const sortedCategories = Object.keys(organized).sort((a, b) => {
            const priority: { [key: string]: number } = {
              "⭐ Special Lists": 1,
              "👥 Shared Lists": 2,
              "💼 Work": 3,
              "👪 Family": 4,
              "🏡 Properties": 5,
              "🛒 Shopping Lists": 6,
              "🚗 Travel & Rangeley": 7,
              "🎉 Seasonal & Events": 8,
              "📚 Reading": 9,
              "📋 Other Lists": 10,
              "📦 Archives": 11,
            }

            const aIsArchived = a.startsWith("📦 Archived -")
            const bIsArchived = b.startsWith("📦 Archived -")

            if (aIsArchived && !bIsArchived) return 1
            if (!aIsArchived && bIsArchived) return -1
            if (aIsArchived && bIsArchived) return a.localeCompare(b)

            const aPriority = priority[a] || 999
            const bPriority = priority[b] || 999

            if (aPriority !== bPriority) return aPriority - bPriority
            return a.localeCompare(b)
          })

          sortedCategories.forEach((category) => {
            const categoryLists = organized[category]
            output += `${category} (${categoryLists.length})\n`

            categoryLists.forEach((list, index) => {
              const isLast = index === categoryLists.length - 1
              const prefix = isLast ? "└─" : "├─"

              let listInfo = `${prefix} ${list.displayName}`

              const metadataLabels: string[] = []
              if (list.wellknownListName === "defaultList") metadataLabels.push("Default")
              if (list.wellknownListName === "flaggedEmails") metadataLabels.push("Flagged Emails")
              if (list.isShared && list.isOwner) metadataLabels.push("Shared by you")
              if (list.isShared && !list.isOwner) metadataLabels.push("Shared with you")

              if (metadataLabels.length > 0) listInfo += ` [${metadataLabels.join(", ")}]`

              output += `   ${listInfo}\n`
              if (!isLast) output += "   │\n"
            })

            output += "\n"
          })

          const totalLists = Object.values(organized).reduce((sum, l) => sum + l.length, 0)
          const totalCategories = Object.keys(organized).length

          output += "-".repeat(50) + "\n"
          output += `Summary: ${totalLists} lists in ${totalCategories} categories\n`

          if (includeIds) {
            output += "\n\n📋 List IDs Reference:\n" + "-".repeat(50) + "\n"
            lists.forEach((list) => {
              output += `${list.displayName}: ${list.id}\n`
            })
          }

          return { content: [{ type: "text", text: output }] }
        } catch (error) {
          return {
            content: [{ type: "text", text: `Error fetching organized task lists: ${error}` }],
          }
        }
      },
    )

    server.tool(
      "create-task-list",
      "Create a new task list (top-level container) in Microsoft Todo to help organize your tasks into categories or projects.",
      {
        displayName: z.string().describe("Name of the new task list"),
      },
      async ({ displayName }) => {
        try {
          const response = await this.graphClient.request<TaskList>(`${MS_GRAPH_BASE}/me/todo/lists`, "POST", {
            displayName,
          })

          if (!response) {
            return { content: [{ type: "text", text: `Failed to create task list: ${displayName}` }] }
          }

          return {
            content: [
              {
                type: "text",
                text: `Task list created successfully!\nName: ${response.displayName}\nID: ${response.id}`,
              },
            ],
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error creating task list: ${error}` }] }
        }
      },
    )

    server.tool(
      "update-task-list",
      "Update the name of an existing task list (top-level container) in Microsoft Todo.",
      {
        listId: z.string().describe("ID of the task list to update"),
        displayName: z.string().describe("New name for the task list"),
      },
      async ({ listId, displayName }) => {
        try {
          const response = await this.graphClient.request<TaskList>(
            `${MS_GRAPH_BASE}/me/todo/lists/${listId}`,
            "PATCH",
            { displayName },
          )

          if (!response) {
            return { content: [{ type: "text", text: `Failed to update task list with ID: ${listId}` }] }
          }

          return {
            content: [{ type: "text", text: `Task list updated successfully!\nNew name: ${response.displayName}` }],
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error updating task list: ${error}` }] }
        }
      },
    )

    server.tool(
      "delete-task-list",
      "Delete a task list (top-level container) from Microsoft Todo. This will remove the list and all tasks within it.",
      {
        listId: z.string().describe("ID of the task list to delete"),
      },
      async ({ listId }) => {
        try {
          const url = `${MS_GRAPH_BASE}/me/todo/lists/${listId}`

          await this.graphClient.request<null>(url, "DELETE")

          return {
            content: [{ type: "text", text: `Task list with ID: ${listId} was successfully deleted.` }],
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error deleting task list: ${error}` }] }
        }
      },
    )
  }
}
