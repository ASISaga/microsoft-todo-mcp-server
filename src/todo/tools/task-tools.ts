/**
 * TaskTools – MCP tool registrations for Microsoft To Do tasks.
 *
 * Registers: get-tasks, create-task, update-task, delete-task
 */
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { GraphClient, MS_GRAPH_BASE } from "../graph/GraphClient.js"
import type { Task } from "../graph/types.js"

export class TaskTools {
  constructor(private readonly graphClient: GraphClient) {}

  register(server: McpServer): void {
    server.tool(
      "get-tasks",
      "Get tasks from a specific Microsoft Todo list. These are the main todo items that can contain checklist items (subtasks).",
      {
        listId: z.string().describe("ID of the task list"),
        filter: z.string().optional().describe("OData $filter query (e.g., 'status eq \\'completed\\'')"),
        select: z
          .string()
          .optional()
          .describe("Comma-separated list of properties to include (e.g., 'id,title,status')"),
        orderby: z.string().optional().describe("Property to sort by (e.g., 'createdDateTime desc')"),
        top: z.number().optional().describe("Maximum number of tasks to retrieve"),
        skip: z.number().optional().describe("Number of tasks to skip"),
        count: z.boolean().optional().describe("Whether to include a count of tasks"),
      },
      async ({ listId, filter, select, orderby, top, skip, count }) => {
        try {
          const queryParams = new URLSearchParams()
          if (filter) queryParams.append("$filter", filter)
          if (select) queryParams.append("$select", select)
          if (orderby) queryParams.append("$orderby", orderby)
          if (top !== undefined) queryParams.append("$top", top.toString())
          if (skip !== undefined) queryParams.append("$skip", skip.toString())
          if (count !== undefined) queryParams.append("$count", count.toString())

          const queryString = queryParams.toString()
          const url = `${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks${queryString ? "?" + queryString : ""}`

          console.error(`Making request to: ${url}`)

          const response = await this.graphClient.request<{ value: Task[]; "@odata.count"?: number }>(url)

          if (!response) {
            return { content: [{ type: "text", text: `Failed to retrieve tasks for list: ${listId}` }] }
          }

          const tasks = response.value || []
          if (tasks.length === 0) {
            return { content: [{ type: "text", text: `No tasks found in list with ID: ${listId}` }] }
          }

          const formattedTasks = tasks.map((task) => {
            let taskInfo = `ID: ${task.id}\nTitle: ${task.title}`

            if (task.status) {
              const status = task.status === "completed" ? "✓" : "○"
              taskInfo = `${status} ${taskInfo}`
            }

            if (task.dueDateTime) {
              taskInfo += `\nDue: ${new Date(task.dueDateTime.dateTime).toLocaleDateString()}`
            }

            if (task.importance) {
              taskInfo += `\nImportance: ${task.importance}`
            }

            if (task.categories && task.categories.length > 0) {
              taskInfo += `\nCategories: ${task.categories.join(", ")}`
            }

            if (task.body && task.body.content && task.body.content.trim() !== "") {
              const previewLength = 50
              const contentPreview =
                task.body.content.length > previewLength
                  ? task.body.content.substring(0, previewLength) + "..."
                  : task.body.content
              taskInfo += `\nDescription: ${contentPreview}`
            }

            return `${taskInfo}\n---`
          })

          let countInfo = ""
          if (count && response["@odata.count"] !== undefined) {
            countInfo = `Total count: ${response["@odata.count"]}\n\n`
          }

          return {
            content: [
              {
                type: "text",
                text: `Tasks in list ${listId}:\n\n${countInfo}${formattedTasks.join("\n")}`,
              },
            ],
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error fetching tasks: ${error}` }] }
        }
      },
    )

    server.tool(
      "create-task",
      "Create a new task in a specific Microsoft Todo list. A task is the main todo item that can have a title, description, due date, and other properties.",
      {
        listId: z.string().describe("ID of the task list"),
        title: z.string().describe("Title of the task"),
        body: z.string().optional().describe("Description or body content of the task"),
        dueDateTime: z.string().optional().describe("Due date in ISO format (e.g., 2023-12-31T23:59:59Z)"),
        startDateTime: z.string().optional().describe("Start date in ISO format (e.g., 2023-12-31T23:59:59Z)"),
        importance: z.enum(["low", "normal", "high"]).optional().describe("Task importance"),
        isReminderOn: z.boolean().optional().describe("Whether to enable reminder for this task"),
        reminderDateTime: z.string().optional().describe("Reminder date and time in ISO format"),
        status: z
          .enum(["notStarted", "inProgress", "completed", "waitingOnOthers", "deferred"])
          .optional()
          .describe("Status of the task"),
        categories: z.array(z.string()).optional().describe("Categories associated with the task"),
      },
      async ({
        listId,
        title,
        body,
        dueDateTime,
        startDateTime,
        importance,
        isReminderOn,
        reminderDateTime,
        status,
        categories,
      }) => {
        try {
          const taskBody: Record<string, unknown> = { title }

          if (body) taskBody.body = { content: body, contentType: "text" }
          if (dueDateTime) taskBody.dueDateTime = { dateTime: dueDateTime, timeZone: "UTC" }
          if (startDateTime) taskBody.startDateTime = { dateTime: startDateTime, timeZone: "UTC" }
          if (importance) taskBody.importance = importance
          if (isReminderOn !== undefined) taskBody.isReminderOn = isReminderOn
          if (reminderDateTime) taskBody.reminderDateTime = { dateTime: reminderDateTime, timeZone: "UTC" }
          if (status) taskBody.status = status
          if (categories && categories.length > 0) taskBody.categories = categories

          const response = await this.graphClient.request<Task>(
            `${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks`,
            "POST",
            taskBody,
          )

          if (!response) {
            return { content: [{ type: "text", text: `Failed to create task in list: ${listId}` }] }
          }

          return {
            content: [
              { type: "text", text: `Task created successfully!\nID: ${response.id}\nTitle: ${response.title}` },
            ],
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error creating task: ${error}` }] }
        }
      },
    )

    server.tool(
      "update-task",
      "Update an existing task in Microsoft Todo. Allows changing any properties of the task including title, due date, importance, etc.",
      {
        listId: z.string().describe("ID of the task list"),
        taskId: z.string().describe("ID of the task to update"),
        title: z.string().optional().describe("New title of the task"),
        body: z.string().optional().describe("New description or body content of the task"),
        dueDateTime: z.string().optional().describe("New due date in ISO format (e.g., 2023-12-31T23:59:59Z)"),
        startDateTime: z.string().optional().describe("New start date in ISO format (e.g., 2023-12-31T23:59:59Z)"),
        importance: z.enum(["low", "normal", "high"]).optional().describe("New task importance"),
        isReminderOn: z.boolean().optional().describe("Whether to enable reminder for this task"),
        reminderDateTime: z.string().optional().describe("New reminder date and time in ISO format"),
        status: z
          .enum(["notStarted", "inProgress", "completed", "waitingOnOthers", "deferred"])
          .optional()
          .describe("New status of the task"),
        categories: z.array(z.string()).optional().describe("New categories associated with the task"),
      },
      async ({
        listId,
        taskId,
        title,
        body,
        dueDateTime,
        startDateTime,
        importance,
        isReminderOn,
        reminderDateTime,
        status,
        categories,
      }) => {
        try {
          const taskBody: Record<string, unknown> = {}

          if (title !== undefined) taskBody.title = title
          if (body !== undefined) taskBody.body = { content: body, contentType: "text" }

          if (dueDateTime !== undefined) {
            taskBody.dueDateTime = dueDateTime === "" ? null : { dateTime: dueDateTime, timeZone: "UTC" }
          }
          if (startDateTime !== undefined) {
            taskBody.startDateTime = startDateTime === "" ? null : { dateTime: startDateTime, timeZone: "UTC" }
          }

          if (importance !== undefined) taskBody.importance = importance
          if (isReminderOn !== undefined) taskBody.isReminderOn = isReminderOn

          if (reminderDateTime !== undefined) {
            taskBody.reminderDateTime = reminderDateTime === "" ? null : { dateTime: reminderDateTime, timeZone: "UTC" }
          }

          if (status !== undefined) taskBody.status = status
          if (categories !== undefined) taskBody.categories = categories

          if (Object.keys(taskBody).length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: "No properties provided for update. Please specify at least one property to change.",
                },
              ],
            }
          }

          const response = await this.graphClient.request<Task>(
            `${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}`,
            "PATCH",
            taskBody,
          )

          if (!response) {
            return {
              content: [{ type: "text", text: `Failed to update task with ID: ${taskId} in list: ${listId}` }],
            }
          }

          return {
            content: [
              { type: "text", text: `Task updated successfully!\nID: ${response.id}\nTitle: ${response.title}` },
            ],
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error updating task: ${error}` }] }
        }
      },
    )

    server.tool(
      "delete-task",
      "Delete a task from a Microsoft Todo list. This will remove the task and all its checklist items (subtasks).",
      {
        listId: z.string().describe("ID of the task list"),
        taskId: z.string().describe("ID of the task to delete"),
      },
      async ({ listId, taskId }) => {
        try {
          const url = `${MS_GRAPH_BASE}/me/todo/lists/${listId}/tasks/${taskId}`
          console.error(`Deleting task: ${url}`)

          await this.graphClient.request<null>(url, "DELETE")

          return {
            content: [{ type: "text", text: `Task with ID: ${taskId} was successfully deleted from list: ${listId}` }],
          }
        } catch (error) {
          return { content: [{ type: "text", text: `Error deleting task: ${error}` }] }
        }
      },
    )
  }
}
