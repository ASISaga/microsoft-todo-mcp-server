/**
 * Checklist tools – MCP tool registrations for Microsoft To Do checklist items.
 *
 * Registers: get-checklist-items, create-checklist-item,
 *            update-checklist-item, delete-checklist-item
 */
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { graphClient, MS_GRAPH_BASE } from "../graph/GraphClient.js"
import type { Task, ChecklistItem } from "../graph/types.js"
import { getAccessToken } from "../auth/AuthService.js"

export function registerChecklistTools(server: McpServer): void {
  server.tool(
    "get-checklist-items",
    "Get checklist items (subtasks) for a specific task. Checklist items are smaller steps or components that belong to a parent task.",
    {
      listId: z.string().describe("ID of the task list"),
      taskId: z.string().describe("ID of the task"),
    },
    async ({ listId, taskId }) => {
      try {
        const token = await getAccessToken()
        if (!token) {
          return { content: [{ type: "text", text: "Failed to authenticate with Microsoft API" }] }
        }

        // Fetch the parent task to display its title in the response
        const taskResponse = await graphClient.request<Task>(
          `${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}`,
          token,
        )
        const taskTitle = taskResponse ? taskResponse.title : "Unknown Task"

        const response = await graphClient.request<{ value: ChecklistItem[] }>(
          `${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}/checklistItems`,
          token,
        )

        if (!response) {
          return { content: [{ type: "text", text: `Failed to retrieve checklist items for task: ${taskId}` }] }
        }

        const items = response.value || []
        if (items.length === 0) {
          return {
            content: [{ type: "text", text: `No checklist items found for task "${taskTitle}" (ID: ${taskId})` }],
          }
        }

        const formattedItems = items.map((item) => {
          const status = item.isChecked ? "✓" : "○"
          let itemInfo = `${status} ${item.displayName} (ID: ${item.id})`

          if (item.createdDateTime) {
            itemInfo += `\nCreated: ${new Date(item.createdDateTime).toLocaleString()}`
          }

          return itemInfo
        })

        return {
          content: [
            {
              type: "text",
              text: `Checklist items for task "${taskTitle}" (ID: ${taskId}):\n\n${formattedItems.join("\n\n")}`,
            },
          ],
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Error fetching checklist items: ${error}` }] }
      }
    },
  )

  server.tool(
    "create-checklist-item",
    "Create a new checklist item (subtask) for a task. Checklist items help break down a task into smaller, manageable steps.",
    {
      listId: z.string().describe("ID of the task list"),
      taskId: z.string().describe("ID of the task"),
      displayName: z.string().describe("Text content of the checklist item"),
      isChecked: z.boolean().optional().describe("Whether the item is checked off"),
    },
    async ({ listId, taskId, displayName, isChecked }) => {
      try {
        const token = await getAccessToken()
        if (!token) {
          return { content: [{ type: "text", text: "Failed to authenticate with Microsoft API" }] }
        }

        const requestBody: Record<string, unknown> = { displayName }
        if (isChecked !== undefined) requestBody.isChecked = isChecked

        const response = await graphClient.request<ChecklistItem>(
          `${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}/checklistItems`,
          token,
          "POST",
          requestBody,
        )

        if (!response) {
          return { content: [{ type: "text", text: `Failed to create checklist item for task: ${taskId}` }] }
        }

        return {
          content: [
            {
              type: "text",
              text: `Checklist item created successfully!\nContent: ${response.displayName}\nID: ${response.id}`,
            },
          ],
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Error creating checklist item: ${error}` }] }
      }
    },
  )

  server.tool(
    "update-checklist-item",
    "Update an existing checklist item (subtask). Allows changing the text content or completion status of the subtask.",
    {
      listId: z.string().describe("ID of the task list"),
      taskId: z.string().describe("ID of the task"),
      checklistItemId: z.string().describe("ID of the checklist item to update"),
      displayName: z.string().optional().describe("New text content of the checklist item"),
      isChecked: z.boolean().optional().describe("Whether the item is checked off"),
    },
    async ({ listId, taskId, checklistItemId, displayName, isChecked }) => {
      try {
        const token = await getAccessToken()
        if (!token) {
          return { content: [{ type: "text", text: "Failed to authenticate with Microsoft API" }] }
        }

        const requestBody: Record<string, unknown> = {}
        if (displayName !== undefined) requestBody.displayName = displayName
        if (isChecked !== undefined) requestBody.isChecked = isChecked

        if (Object.keys(requestBody).length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No properties provided for update. Please specify either displayName or isChecked.",
              },
            ],
          }
        }

        const response = await graphClient.request<ChecklistItem>(
          `${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}/checklistItems/${checklistItemId}`,
          token,
          "PATCH",
          requestBody,
        )

        if (!response) {
          return {
            content: [{ type: "text", text: `Failed to update checklist item with ID: ${checklistItemId}` }],
          }
        }

        const statusText = response.isChecked ? "Checked" : "Not checked"

        return {
          content: [
            {
              type: "text",
              text: `Checklist item updated successfully!\nContent: ${response.displayName}\nStatus: ${statusText}`,
            },
          ],
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Error updating checklist item: ${error}` }] }
      }
    },
  )

  server.tool(
    "delete-checklist-item",
    "Delete a checklist item (subtask) from a task. This removes just the specific subtask, not the parent task.",
    {
      listId: z.string().describe("ID of the task list"),
      taskId: z.string().describe("ID of the task"),
      checklistItemId: z.string().describe("ID of the checklist item to delete"),
    },
    async ({ listId, taskId, checklistItemId }) => {
      try {
        const token = await getAccessToken()
        if (!token) {
          return { content: [{ type: "text", text: "Failed to authenticate with Microsoft API" }] }
        }

        const url = `${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}/checklistItems/${checklistItemId}`
        console.error(`Deleting checklist item: ${url}`)

        await graphClient.request<null>(url, token, "DELETE")

        return {
          content: [
            {
              type: "text",
              text: `Checklist item with ID: ${checklistItemId} was successfully deleted from task: ${taskId}`,
            },
          ],
        }
      } catch (error) {
        return { content: [{ type: "text", text: `Error deleting checklist item: ${error}` }] }
      }
    },
  )
}
