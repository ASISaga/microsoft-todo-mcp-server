# Project Folder Organization

```
IntegrityMCP/
├── src/
│   ├── index.ts                        # Azure Functions entry point
│   ├── integrity/                      # Core domain logic
│   │   ├── constants.ts                # API base URLs, user-agent, version
│   │   ├── types.ts                    # SmartGoalPhase enum, IntegrityLink, phase maps
│   │   ├── sync.ts                     # Sync engine: status mapping, body builders
│   │   ├── logger.ts                   # Structured logger (levels, child loggers)
│   │   ├── errors.ts                   # Typed error hierarchy (AuthError, GraphError, etc.)
│   │   ├── result.ts                   # Result<T, E> type with ok()/err() helpers
│   │   ├── schemas.ts                  # Zod schemas for webhook payload validation
│   │   ├── *.test.ts                   # Unit tests for each module
│   ├── mcp/
│   │   └── server.ts                   # MCP server with all tools (exports mcpServer)
│   ├── todo/
│   │   ├── token-manager.ts            # OAuth token management (env vars, refresh)
│   │   ├── auth/
│   │   │   └── AuthService.ts          # Microsoft Graph auth helpers
│   │   ├── graph/
│   │   │   ├── GraphClient.ts          # Microsoft Graph REST client (To Do)
│   │   │   └── types.ts               # TypeScript interfaces for Graph entities
│   │   └── tools/
│   │       ├── auth-tools.ts           # auth-status tool
│   │       ├── task-list-tools.ts      # To Do list CRUD tools
│   │       ├── task-tools.ts           # To Do task CRUD tools
│   │       ├── checklist-tools.ts      # To Do checklist-item CRUD tools
│   │       └── utility-tools.ts        # archive-completed-tasks, diagnostics
│   ├── github/
│   │   ├── GitHubClient.ts             # GitHub REST API client (Issues)
│   │   ├── utils.ts                    # GitHub issue link extractor
│   │   ├── utils.test.ts              # Tests for utils
│   │   └── tools/
│   │       └── github-tools.ts         # GitHub ↔ To Do sync tools
│   └── azure/                          # Azure Functions handlers
│       ├── http-adapter.ts             # Azure Functions ↔ Node.js HTTP adapter
│       └── functions/
│           ├── mcp.ts                  # HTTP trigger: MCP Streamable HTTP endpoint
│           ├── github-webhook.ts       # HTTP trigger: GitHub issue webhooks
│           ├── todo-webhook.ts         # HTTP trigger: Microsoft Graph notifications
│           ├── subscription-renew.ts   # Timer trigger: renew Graph subscriptions
│           └── health.ts              # HTTP trigger: health-check endpoint
├── infra/
│   ├── main.bicep                      # Azure infrastructure as code
│   └── main.bicepparam                 # Bicep parameter file
├── spec/
│   ├── spec.md                         # Project specification
│   └── mcp.md                          # MCP protocol reference
├── docs/
│   ├── FOLDER_ORGANIZATION_GUIDE.md    # This file
│   └── STANDARD_BUILD_COMMANDS.md      # Build/deploy commands
├── .github/
│   └── workflows/
│       ├── ci.yml                      # Lint + typecheck + build
│       └── deploy.yml                  # Deploy to Azure Functions
├── dist/                               # Compiled JavaScript (git-ignored)
├── host.json                           # Azure Functions v4 runtime config
├── local.settings.json.example         # Local dev environment template
├── vitest.config.ts                    # Test configuration
├── tsup.config.ts                      # Build configuration
├── tsconfig.json                       # TypeScript configuration
└── package.json                        # Dependencies and scripts
```

## Key Design Decisions

- **Two first-class platforms**: Microsoft To Do and GitHub Issues are equally important citizens, synchronized in real time via webhooks.
- **SMART goals**: Tasks and issues represent Specific, Measurable, Achievable, Relevant, Time-bound commitments.
- **Single server entrypoint**: `src/mcp/server.ts` is the sole MCP server orchestrator; `src/index.ts` is the Azure Functions bootstrap.
- **Scale to zero**: Consumption (Y1) plan – no cost when idle.
- **Stateless tokens**: OAuth tokens read from environment variables; no file system.
- **Event-driven**: GitHub webhooks and Microsoft Graph change notifications eliminate polling.
- **Structured logging**: All modules use `Logger` from `src/integrity/logger.ts` instead of raw `console.error`.
- **Typed errors**: Domain-specific error classes in `src/integrity/errors.ts` carry machine-readable codes.
- **Zod validation**: Inbound webhook payloads are validated at the edge via Zod schemas.
- **Tests alongside source**: Test files (`*.test.ts`) live next to the modules they cover.
