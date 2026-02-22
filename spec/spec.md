# Microsoft To Do MCP Server – Specification

## Vision

This project provides a **Model Context Protocol (MCP) server** deployed on **Azure Functions** that lets AI assistants (Claude, Cursor, etc.) interact with Microsoft To Do via the Microsoft Graph API. It also offers two-way event-driven synchronization with GitHub Issues via webhooks.

## Architecture

```
AI Assistant (Claude / Cursor)
        │  MCP over Streamable HTTP
        ▼
┌──────────────────────────────┐
│   Azure Functions (HTTP)     │
│                              │
│  /api/mcp                    │  ◄── MCP endpoint
│  /api/github-webhook         │  ◄── GitHub issue events
│  /api/todo-webhook           │  ◄── Microsoft Graph change notifications
│  subscription-renew (timer)  │      Renews Graph subscriptions every 12h
└──────────────────────────────┘
        │                   │
        ▼                   ▼
 Microsoft Graph        GitHub API
 (To Do tasks)          (Issues)
```

**Scale-to-zero**: The Consumption plan bills only for actual invocations. No compute runs when idle.

## Microsoft To Do Hierarchy

Microsoft To Do is organized in a three-level hierarchy:

1. **Task Lists** – Top-level containers that group tasks into categories, projects, or areas of focus (e.g., "Work", "Personal", "Shopping").

2. **Tasks** – Main todo items with properties like title, description, due date, importance, and status.

3. **Checklist Items** – Subtasks belonging to a parent task, used to break down work into smaller steps.

## Webhook Sync

### GitHub → To Do

When a GitHub issue event fires on the registered repository:

| GitHub event        | To Do action                               |
| ------------------- | ------------------------------------------ |
| `issues.opened`     | Create a new task in `MS_TODO_LIST_ID`     |
| `issues.closed`     | Mark the linked task as `completed`        |
| `issues.reopened`   | Mark the linked task as `notStarted`       |

Validation: HMAC-SHA256 signature check using `GITHUB_WEBHOOK_SECRET`.

### To Do → GitHub

When a Microsoft Graph change notification fires for a To Do list:

- If a newly created task title or body contains a `#owner/repo` hashtag, a GitHub issue is opened automatically.
- The GitHub issue URL is written back into the task body for future sync.

Validation: `clientState` value compared against `GRAPH_SUBSCRIPTION_SECRET`.

## MCP Tools

### Authentication (1 tool)

| Tool          | Description                                              | Required params | Optional params |
| ------------- | -------------------------------------------------------- | --------------- | --------------- |
| `auth-status` | Check authentication status, token expiry, and validity. | –               | –               |

### Task List Management (5 tools)

| Tool                       | Description                                                                                               | Required params          | Optional params              |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------ | ---------------------------- |
| `get-task-lists`           | Get all To Do lists with names, IDs, and default/shared status.                                           | –                        | –                            |
| `get-task-lists-organized` | Get lists grouped into logical categories based on naming patterns, emoji prefixes, and sharing status.   | –                        | `includeIds`, `groupBy`      |
| `create-task-list`         | Create a new task list.                                                                                   | `displayName`            | –                            |
| `update-task-list`         | Rename an existing task list.                                                                             | `listId`, `displayName`  | –                            |
| `delete-task-list`         | Delete a task list and all its tasks.                                                                     | `listId`                 | –                            |

### Task Management (4 tools)

| Tool          | Description                                                       | Required params       | Optional params                                                                       |
| ------------- | ----------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| `get-tasks`   | Get tasks from a list. Supports OData `$filter`, `$orderby`, etc. | `listId`              | `filter`, `select`, `orderby`, `top`, `skip`, `count`                                 |
| `create-task` | Create a new task.                                                | `listId`, `title`     | `body`, `dueDateTime`, `startDateTime`, `importance`, `isReminderOn`, `reminderDateTime`, `status`, `categories` |
| `update-task` | Update any property of an existing task.                          | `listId`, `taskId`    | `title`, `body`, `dueDateTime`, `startDateTime`, `importance`, `isReminderOn`, `reminderDateTime`, `status`, `categories` |
| `delete-task` | Delete a task and all its checklist items.                        | `listId`, `taskId`    | –                                                                                     |

### Checklist Item Management (4 tools)

| Tool                    | Description                                                  | Required params                       | Optional params                |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------- | ------------------------------ |
| `get-checklist-items`   | Get subtasks for a task; includes parent task title.         | `listId`, `taskId`                    | –                              |
| `create-checklist-item` | Add a subtask to a task.                                     | `listId`, `taskId`, `displayName`     | `isChecked`                    |
| `update-checklist-item` | Update the text or completion status of a subtask.           | `listId`, `taskId`, `checklistItemId` | `displayName`, `isChecked`     |
| `delete-checklist-item` | Remove a subtask without deleting the parent task.           | `listId`, `taskId`, `checklistItemId` | –                              |

### Bulk Operations (1 tool)

| Tool                      | Description                                                                                                        | Required params                   | Optional params                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------- | -------------------------------- |
| `archive-completed-tasks` | Move completed tasks older than N days from a source list to an archive list. Supports dry-run preview mode.       | `sourceListId`, `targetListId`    | `olderThanDays` (default 90), `dryRun` |

### GitHub Integration (3 tools)

| Tool                            | Description                                                                                                                             | Required params    | Optional params |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------- |
| `create-github-issue-from-task` | Create a GitHub issue from a task. The task title or body must contain a `#owner/repo` hashtag. Writes the issue URL back to the task. | `listId`, `taskId` | –               |
| `sync-github-issues-to-todo`    | Scan tasks for linked GitHub issue URLs and mark tasks as completed when their GitHub issues are closed.                                | –                  | `listId`        |
| `get-github-issue-status`       | Fetch the current open/closed state of the GitHub issue linked to a task.                                                              | `listId`, `taskId` | –               |

### Developer Tools (1 tool)

| Tool                         | Description                                                                 | Required params | Optional params                                       |
| ---------------------------- | --------------------------------------------------------------------------- | --------------- | ----------------------------------------------------- |
| `test-graph-api-exploration` | Run Graph API queries to discover available properties and endpoints. | `testType` (`odata-select`, `odata-expand`, `headers`, `extensions`, `all`) | – |

## Environment Variables

| Variable                    | Required | Description                                              |
| --------------------------- | -------- | -------------------------------------------------------- |
| `CLIENT_ID`                 | ✅       | Azure app registration client ID                        |
| `CLIENT_SECRET`             | ✅       | Azure app registration client secret                    |
| `TENANT_ID`                 | ✅       | `organizations`, `consumers`, `common`, or tenant GUID  |
| `MS_TODO_REFRESH_TOKEN`     | ✅       | OAuth refresh token (set once, auto-renewed)            |
| `MS_TODO_ACCESS_TOKEN`      | ⬜       | Current access token (cached; auto-refreshed from above)|
| `MS_TODO_TOKEN_EXPIRES_AT`  | ⬜       | Unix-ms expiry of cached access token                   |
| `GITHUB_TOKEN`              | ⬜       | GitHub PAT (`repo` scope) for issue creation/reading    |
| `GITHUB_WEBHOOK_SECRET`     | ⬜       | Validates GitHub webhook HMAC-SHA256 signatures         |
| `GRAPH_SUBSCRIPTION_SECRET` | ⬜       | Validates Microsoft Graph `clientState` field           |
| `GRAPH_SUBSCRIPTION_IDS`    | ⬜       | Comma-separated Graph subscription IDs to auto-renew   |
| `MS_TODO_LIST_ID`           | ⬜       | Default list for GitHub issue → task creation           |

## References

- [Model Context Protocol documentation](https://modelcontextprotocol.io/)
- [Microsoft Graph To Do API](https://learn.microsoft.com/en-us/graph/api/resources/todo-overview)
- [Microsoft Graph change notifications](https://learn.microsoft.com/en-us/graph/change-notifications-overview)
- [GitHub Webhooks](https://docs.github.com/en/webhooks)
