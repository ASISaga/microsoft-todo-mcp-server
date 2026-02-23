# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Build and Development

```bash
pnpm install         # Install dependencies
pnpm run build       # Build with tsup to dist/ directory
pnpm run typecheck   # TypeScript type check only
pnpm run lint        # Check code formatting (Prettier)
pnpm run format      # Fix code formatting
pnpm run ci          # lint + typecheck + build (full CI check)
```

### Local Development (Azure Functions)

```bash
cp local.settings.json.example local.settings.json
# Fill in credentials in local.settings.json
func start           # Requires Azure Functions Core Tools v4
```

## Architecture Overview

This is the **Integrity MCP server** – a **Model Context Protocol (MCP) server** that manages SMART goals across **Microsoft To Do** and **GitHub Issues** as two equal, synchronized first-class platforms. Deployed 100% on **Azure Functions** (Consumption plan – scales to zero).

> **Integrity** is the state of being "whole, complete, and unbroken."
> Plan Your Work → Work Your Plan.

### Entry Points

- **`src/index.ts`** – Azure Functions entry point; imports all function modules
- **`src/functions/mcp.ts`** – HTTP trigger for the MCP Streamable HTTP endpoint (`/api/mcp`)
- **`src/functions/github-webhook.ts`** – HTTP trigger for GitHub issue webhooks (`/api/github-webhook`)
- **`src/functions/todo-webhook.ts`** – HTTP trigger for Microsoft Graph change notifications (`/api/todo-webhook`)
- **`src/functions/subscription-renew.ts`** – Timer trigger that renews Graph subscriptions every 12 h
- **`src/server.ts`** – MCP server with all 19 tools registered (transport-agnostic; exports `mcpServer`)
- **`src/token-manager.ts`** – Stateless token management: reads env vars, refreshes via OAuth, in-memory cache
- **`src/azure-http-adapter.ts`** – Adapts Azure Functions `HttpRequest`/`HttpResponseInit` to Node.js `IncomingMessage`/`ServerResponse` for `StreamableHTTPServerTransport`

### Infrastructure

- **`infra/main.bicep`** – Bicep template: Function App (Consumption Y1), Storage Account, App Insights, Log Analytics
- **`infra/main.bicepparam`** – Parameter file for Bicep deployment
- **`host.json`** – Azure Functions v4 runtime configuration

### CI/CD

- **`.github/workflows/ci.yml`** – Lint + typecheck + build on push/PR
- **`.github/workflows/deploy.yml`** – Deploy to Azure Functions on push to `main`

### Webhook Flow

- **GitHub → To Do**: GitHub sends `issues` webhook → `/api/github-webhook` → creates/updates To Do tasks
- **To Do → GitHub**: Microsoft Graph sends change notification → `/api/todo-webhook` → creates GitHub issue if task has `#owner/repo` hashtag

### Token Management

Tokens are read from **environment variables** (Azure App Settings in production):

- `CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID` – for OAuth token refresh
- `MS_TODO_REFRESH_TOKEN` – stored refresh token (set once, auto-renewed)
- `MS_TODO_ACCESS_TOKEN` + `MS_TODO_TOKEN_EXPIRES_AT` – optional cached access token
