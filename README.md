# Integrity MCP Server

[![CI](https://github.com/ASISaga/IntegrityMCP/actions/workflows/ci.yml/badge.svg)](https://github.com/ASISaga/IntegrityMCP/actions/workflows/ci.yml)
[![Deploy](https://github.com/ASISaga/IntegrityMCP/actions/workflows/deploy.yml/badge.svg)](https://github.com/ASISaga/IntegrityMCP/actions/workflows/deploy.yml)

> **Integrity** is the state of being "whole, complete, and unbroken."
>
> - **Plan Your Work**: when you create a project plan you are giving your word to a specific set of future actions and results.
> - **Work Your Plan**: following the plan is the act of keeping that word.

A **Model Context Protocol (MCP) server** that enables AI assistants (Claude, Cursor, etc.) to manage **SMART goals** across two first-class platforms:

| Platform            | Role                                                 |
| ------------------- | ---------------------------------------------------- |
| **Microsoft To Do** | task/checklist management via Microsoft Graph API    |
| **GitHub Issues**   | issue tracking; synchronized with To Do in real-time |

Deployed exclusively on **Azure Functions Consumption plan** (scales to zero when idle) with **event-driven webhooks** for two-way sync between the platforms.

## SMART Goals

SMART goals are **Specific, Measurable, Achievable, Relevant, and Time-bound**. The Integrity MCP server supports the full SMART lifecycle:

| Phase        | Action                                                                |
| ------------ | --------------------------------------------------------------------- |
| **Plan**     | Create a task/issue with title, description, due date, and importance |
| **Track**    | Monitor status across To Do and GitHub simultaneously                 |
| **Complete** | Mark items done on either platform; the other side stays in sync      |
| **Archive**  | Move old completed tasks to an archive list                           |

## Architecture

```
AI Assistant (Claude/Cursor)
        │  MCP over HTTP
        ▼
┌─────────────────────────────┐
│   Azure Functions (HTTP)    │
│                             │
│  /api/mcp                   │  ◄── MCP Streamable HTTP endpoint
│  /api/github-webhook        │  ◄── GitHub issue events (opened/closed/reopened)
│  /api/todo-webhook          │  ◄── Microsoft Graph change notifications
│  /api/health                │  ◄── Health-check / monitoring
│  subscription-renew (timer) │      Renews Graph subscriptions every 12 h
└─────────────────────────────┘
        │                  │
        ▼                  ▼
 Microsoft Graph       GitHub API
 (To Do tasks)         (Issues)
```

**Scale-to-zero**: The Consumption plan bills only for actual invocations. When idle, no compute runs.

## Features

- **19 MCP Tools**: full task/list/checklist management + GitHub integration
- **GitHub → To Do**: when a GitHub issue is opened, a linked To Do task is created; when closed, the task is marked complete
- **To Do → GitHub**: when a task is created in a mapped list, a GitHub issue is opened automatically (structural mapping: list group → owner, list → repo)
- **Automatic token refresh**: OAuth tokens are refreshed transparently using stored refresh tokens
- **TypeScript + ESM**: fully typed codebase built with `tsup`
- **Health endpoint**: `GET /api/health` returns version, uptime, and service connectivity status
- **Structured logging**: level-aware logger with context propagation (replaces raw `console.error`)
- **Typed domain errors**: `IntegrityError` hierarchy (`AuthError`, `GraphError`, `GitHubError`, `WebhookError`)
- **Zod webhook validation**: inbound GitHub and Graph webhook payloads are validated at the edge
- **Test suite**: Vitest-based tests covering core domain logic, schemas, and utilities

## Prerequisites

| Requirement                   | Notes                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Azure subscription            | Free tier works                                                    |
| Azure App Registration        | Delegated `Tasks.Read`, `Tasks.ReadWrite`, `User.Read` permissions |
| GitHub PAT                    | `repo` scope for issue creation                                    |
| Node.js ≥ 20                  | For local development                                              |
| pnpm                          | `npm install -g pnpm`                                              |
| Azure Functions Core Tools v4 | `npm install -g azure-functions-core-tools@4`                      |

## Quick Start

### 1. Azure App Registration

1. Go to [portal.azure.com](https://portal.azure.com) → **App registrations** → **New registration**
2. Set redirect URI to `http://localhost:3000/callback` (for initial token retrieval)
3. Under **API permissions**, add Microsoft Graph delegated: `Tasks.Read`, `Tasks.ReadWrite`, `User.Read`, `offline_access`
4. Create a **Client secret** under **Certificates & secrets**

### 2. Get OAuth Tokens

Run the one-time auth flow locally to obtain a refresh token:

```bash
git clone https://github.com/ASISaga/IntegrityMCP.git
cd IntegrityMCP

# Set credentials
export CLIENT_ID=<your-client-id>
export CLIENT_SECRET=<your-client-secret>
export TENANT_ID=organizations   # or your tenant ID
export REDIRECT_URI=http://localhost:3000/callback

# Exchange the auth code for tokens, then note the refresh_token value.
```

Store the refresh token securely – you will reference it in the Function App settings.

### 3. Deploy Infrastructure

```bash
# Login to Azure
az login

# Create a resource group
az group create --name rg-integrity-mcp --location eastus

# Deploy Bicep (creates Function App, Storage, App Insights – Consumption plan)
az deployment group create \
  --resource-group rg-integrity-mcp \
  --template-file infra/main.bicep \
  --parameters \
      appName=integrity-mcp \
      clientId=<CLIENT_ID> \
      clientSecret=<CLIENT_SECRET> \
      githubToken=<GITHUB_PAT> \
      githubWebhookSecret=<random-secret> \
      graphSubscriptionSecret=<random-secret>
```

### 4. Configure GitHub CI/CD

Add the following secrets to your GitHub repository (**Settings → Secrets and variables → Actions**):

| Secret                      | Value                                           |
| --------------------------- | ----------------------------------------------- |
| `AZURE_CLIENT_ID`           | Service principal client ID for deployment      |
| `AZURE_TENANT_ID`           | Azure tenant ID                                 |
| `AZURE_SUBSCRIPTION_ID`     | Azure subscription ID                           |
| `AZURE_RESOURCE_GROUP`      | Resource group name                             |
| `AZURE_FUNCTIONAPP_NAME`    | Function app name (e.g. `integrity-mcp`)        |
| `MS_TODO_CLIENT_ID`         | App registration client ID                      |
| `MS_TODO_CLIENT_SECRET`     | App registration client secret                  |
| `MS_TODO_TENANT_ID`         | Tenant ID                                       |
| `GH_INTEGRATION_TOKEN`      | GitHub PAT for To Do → GitHub issue creation    |
| `GITHUB_WEBHOOK_SECRET`     | Shared secret for webhook validation            |
| `GRAPH_SUBSCRIPTION_SECRET` | Shared secret for Graph notification validation |
| `MS_TODO_LIST_ID`           | To Do list ID for GitHub → task creation        |

Push to `main` to trigger an automatic deployment.

### 5. Configure Webhooks

#### GitHub Webhook

In your GitHub repository → **Settings → Webhooks → Add webhook**:

- **Payload URL**: `https://<app>.azurewebsites.net/api/github-webhook`
- **Content type**: `application/json`
- **Secret**: value of `GITHUB_WEBHOOK_SECRET`
- **Events**: Issues (✅)

#### Microsoft Graph Change Notification

Create a subscription once (replace `<notificationUrl>` and `<listId>`):

```http
POST https://graph.microsoft.com/v1.0/subscriptions
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "changeType": "created,updated",
  "notificationUrl": "https://<app>.azurewebsites.net/api/todo-webhook",
  "resource": "me/todo/lists/<listId>/tasks",
  "expirationDateTime": "<now + 4230 minutes>",
  "clientState": "<GRAPH_SUBSCRIPTION_SECRET value>"
}
```

Store the returned subscription `id` in the **GRAPH_SUBSCRIPTION_IDS** App Setting (comma-separated for multiple lists) so the timer function can renew it automatically.

## Local Development

```bash
# Copy and fill in the example settings
cp local.settings.json.example local.settings.json

pnpm install
pnpm run build

# Start the Azure Functions runtime locally
func start
```

The functions are available at `http://localhost:7071/api/`.

## MCP Tools Reference

### Microsoft To Do Tools

| Tool                       | Description                                    |
| -------------------------- | ---------------------------------------------- |
| `auth-status`              | Show current authentication status             |
| `get-task-lists`           | List all To Do lists                           |
| `get-task-lists-organized` | Hierarchical view grouped by category          |
| `create-task-list`         | Create a new list                              |
| `update-task-list`         | Rename a list                                  |
| `delete-task-list`         | Delete a list and its tasks                    |
| `get-tasks`                | Get tasks from a list (with OData filter/sort) |
| `create-task`              | Create a task (SMART goal)                     |
| `update-task`              | Update a task                                  |
| `delete-task`              | Delete a task                                  |
| `get-checklist-items`      | Get subtasks for a task                        |
| `create-checklist-item`    | Add a subtask (action step)                    |
| `update-checklist-item`    | Update a subtask                               |
| `delete-checklist-item`    | Delete a subtask                               |
| `archive-completed-tasks`  | Move old completed tasks to an archive list    |

### GitHub Integration Tools

| Tool                            | Description                                            |
| ------------------------------- | ------------------------------------------------------ |
| `create-github-issue-from-task` | Manually create a GitHub issue from a To Do task       |
| `sync-github-issues-to-todo`    | Bulk-sync closed GitHub issues → completed To Do tasks |
| `get-github-issue-status`       | Check the GitHub issue linked to a task                |

### Diagnostic Tools

| Tool                         | Description                                   |
| ---------------------------- | --------------------------------------------- |
| `test-graph-api-exploration` | Explore Graph API properties (dev/debug tool) |

## Environment Variables

| Variable                    | Required | Description                                                                  |
| --------------------------- | -------- | ---------------------------------------------------------------------------- |
| `CLIENT_ID`                 | ✅       | Azure app registration client ID                                             |
| `CLIENT_SECRET`             | ✅       | Azure app registration client secret                                         |
| `TENANT_ID`                 | ✅       | `organizations`, `consumers`, `common`, or GUID                              |
| `MS_TODO_REFRESH_TOKEN`     | ✅       | OAuth refresh token                                                          |
| `MS_TODO_ACCESS_TOKEN`      | ⬜       | Current access token (auto-refreshed)                                        |
| `MS_TODO_TOKEN_EXPIRES_AT`  | ⬜       | Unix-ms expiry of access token                                               |
| `GITHUB_TOKEN`              | ⬜       | GitHub PAT for issue creation                                                |
| `GITHUB_WEBHOOK_SECRET`     | ⬜       | Validates GitHub webhook payloads                                            |
| `GRAPH_SUBSCRIPTION_SECRET` | ⬜       | Validates Graph change notifications                                         |
| `GRAPH_SUBSCRIPTION_IDS`    | ⬜       | Comma-separated Graph subscription IDs to renew                              |
| `MS_TODO_LIST_ID`           | ⬜       | Default list for GitHub → task creation                                      |
| `LOG_LEVEL`                 | ⬜       | Logger minimum level: `debug` / `info` / `warn` / `error` (default: `debug`) |

## Development Commands

```bash
pnpm install        # Install dependencies
pnpm run build      # Compile TypeScript (tsup)
pnpm run typecheck  # TypeScript type check only
pnpm run lint       # Prettier format check
pnpm run format     # Fix formatting
pnpm run test       # Run test suite (Vitest)
pnpm run test:watch # Run tests in watch mode
pnpm run ci         # lint + typecheck + build (used in CI)
```

## License

MIT
