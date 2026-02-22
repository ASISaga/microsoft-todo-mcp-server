# Project Folder Organization

```
microsoft-todo-mcp-server/
├── src/
│   ├── index.ts                        # Azure Functions entry point
│   ├── todo-index.ts                   # MCP server with all tools (exports mcpServer)
│   ├── token-manager.ts                # OAuth token management (env vars, refresh)
│   ├── azure-http-adapter.ts           # Azure Functions ↔ Node.js HTTP adapter
│   └── functions/
│       ├── mcp.ts                      # HTTP trigger: MCP Streamable HTTP endpoint
│       ├── github-webhook.ts           # HTTP trigger: GitHub issue webhooks
│       ├── todo-webhook.ts             # HTTP trigger: Microsoft Graph notifications
│       └── subscription-renew.ts      # Timer trigger: renew Graph subscriptions
├── infra/
│   ├── main.bicep                      # Azure infrastructure as code
│   └── main.bicepparam                 # Bicep parameter file
├── .github/
│   └── workflows/
│       ├── ci.yml                      # Lint + typecheck + build
│       └── deploy.yml                  # Deploy to Azure Functions
├── dist/                               # Compiled JavaScript (git-ignored)
├── host.json                           # Azure Functions v4 runtime config
├── local.settings.json.example         # Local dev environment template
├── tsup.config.ts                      # Build configuration
├── tsconfig.json                       # TypeScript configuration
└── package.json                        # Dependencies and scripts
```

## Key Design Decisions

- **No local deployment**: The server runs exclusively on Azure Functions.
- **Scale to zero**: Consumption (Y1) plan – no cost when idle.
- **Stateless tokens**: OAuth tokens read from environment variables; no file system.
- **Event-driven**: GitHub webhooks and Microsoft Graph change notifications eliminate polling.
