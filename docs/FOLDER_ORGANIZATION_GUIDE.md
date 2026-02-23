# Project Folder Organization

```
IntegrityMCP/
├── src/
│   ├── index.ts                        # Azure Functions entry point
│   ├── server.ts                       # MCP server with all tools (exports mcpServer)
│   ├── token-manager.ts                # OAuth token management (env vars, refresh)
│   ├── azure-http-adapter.ts           # Azure Functions ↔ Node.js HTTP adapter
│   ├── constants.ts                    # Shared constants (API base URLs, user-agent)
│   ├── auth/
│   │   └── AuthService.ts              # Microsoft Graph auth helpers
│   ├── graph/
│   │   ├── GraphClient.ts              # Microsoft Graph REST client (To Do)
│   │   └── types.ts                    # TypeScript interfaces for Graph entities
│   ├── github/
│   │   ├── GitHubClient.ts             # GitHub REST API client (Issues)
│   │   └── utils.ts                    # GitHub repo hashtag / issue-link parsers
│   ├── tools/
│   │   ├── auth-tools.ts               # auth-status tool
│   │   ├── task-list-tools.ts          # To Do list CRUD tools
│   │   ├── task-tools.ts               # To Do task CRUD tools
│   │   ├── checklist-tools.ts          # To Do checklist-item CRUD tools
│   │   ├── utility-tools.ts            # archive-completed-tasks, diagnostics
│   │   └── github-tools.ts             # GitHub ↔ To Do sync tools
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

- **Two first-class platforms**: Microsoft To Do and GitHub Issues are equally important citizens, synchronized in real time via webhooks.
- **SMART goals**: Tasks and issues represent Specific, Measurable, Achievable, Relevant, Time-bound commitments.
- **Single server entrypoint**: `src/server.ts` is the sole MCP server orchestrator; `src/index.ts` is the Azure Functions bootstrap.
- **No local deployment**: The server runs exclusively on Azure Functions.
- **Scale to zero**: Consumption (Y1) plan – no cost when idle.
- **Stateless tokens**: OAuth tokens read from environment variables; no file system.
- **Event-driven**: GitHub webhooks and Microsoft Graph change notifications eliminate polling.
