# Vision

**Integrity** is the state of being "whole, complete, and unbroken."

- **Plan Your Work**: when you create a project plan you are giving your word to a specific set of future actions and results.
- **Work Your Plan**: following the plan is the act of keeping that word.

The Integrity MCP server provides an AI assistant interface (via the Model Context Protocol) for managing **SMART goals** across two equal, synchronized platforms:

| Platform | Role |
| --- | --- |
| **Microsoft To Do** | task/checklist management via Microsoft Graph API |
| **GitHub Issues** | issue tracking; always in sync with To Do |

## SMART Goals

SMART goals are **Specific, Measurable, Achievable, Relevant, and Time-bound**.

Every task and GitHub issue managed by this server represents a commitment. The server helps you:
1. **Create** well-defined goals with titles, descriptions, due dates, and importance levels.
2. **Track** progress across both platforms from a single AI interface.
3. **Complete** goals — closing an issue marks the task done; completing a task can close the issue.
4. **Archive** completed work to keep active lists focused.

## Microsoft To Do Hierarchy

Microsoft To Do is organized in a three-level hierarchy:

1. **Task Lists** — top-level containers that organize tasks into projects or areas of focus.
2. **Tasks** — the main action items (SMART goals). Properties: title, body, due date, importance, status, categories.
3. **Checklist Items** — subtasks that break a goal into concrete action steps.

## GitHub Issues

GitHub Issues are first-class citizens, equal in importance to To Do tasks:

- Creating a task with a `#owner/repo` hashtag automatically opens a linked GitHub issue.
- Closing a GitHub issue automatically marks the linked To Do task as completed.
- Reopening a GitHub issue sets the To Do task back to "not started".

## Supported Tools

### Authentication

- `auth-status` — check Microsoft Graph authentication status and token expiry.

### Task List Management (Microsoft To Do)

- `get-task-lists` — list all To Do lists with IDs and sharing status.
- `get-task-lists-organized` — hierarchical view grouped by category or sharing status.
- `create-task-list` — create a new list (project container).
- `update-task-list` — rename a list.
- `delete-task-list` — delete a list and all tasks within it.

### Task Management (Microsoft To Do)

- `get-tasks` — retrieve tasks with OData filter/sort/pagination.
- `create-task` — create a SMART goal task with title, body, due date, importance, and status.
- `update-task` — update any task properties.
- `delete-task` — delete a task and its checklist items.

### Checklist Item Management (Subtasks)

- `get-checklist-items` — list action steps for a task.
- `create-checklist-item` — add an action step.
- `update-checklist-item` — check off or rename an action step.
- `delete-checklist-item` — remove an action step.

### Utilities

- `archive-completed-tasks` — move completed tasks older than N days to an archive list.
- `test-graph-api-exploration` — explore Graph API properties (developer tool).

### GitHub Integration

- `create-github-issue-from-task` — manually push a To Do task to GitHub as an issue.
- `sync-github-issues-to-todo` — pull closed GitHub issue statuses back into To Do.
- `get-github-issue-status` — check the live GitHub issue linked to a task.

## Webhook Automation (Event-Driven Sync)

| Direction | Trigger | Action |
| --- | --- | --- |
| GitHub → To Do | Issue opened | Create linked To Do task |
| GitHub → To Do | Issue closed | Mark To Do task completed |
| GitHub → To Do | Issue reopened | Mark To Do task not started |
| To Do → GitHub | Task created with `#owner/repo` | Open GitHub issue |

## References

- [MCP Documentation](mcp.md)
