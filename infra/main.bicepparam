// infra/main.bicepparam
// Example parameter file for deploying the Microsoft To Do MCP Server to Azure Functions.
//
// Usage:
//   az deployment group create \
//     --resource-group <rg-name> \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam

using './main.bicep'

// ── Required ─────────────────────────────────────────────────────────────────

// Short name used as prefix for all Azure resources (3-17 lowercase alphanumeric).
// The function app itself will be reachable at https://<appName>.azurewebsites.net
param appName = 'mstodo-mcp'

// Azure App registration credentials (replace with your values or use Key Vault references).
param clientId = ''       // e.g. '00000000-0000-0000-0000-000000000000'
param clientSecret = ''   // Store securely – do NOT commit the actual value

// ── Optional ─────────────────────────────────────────────────────────────────

// Tenant for Microsoft authentication. Use 'organizations' (default) or a specific GUID.
param tenantId = 'organizations'

// GitHub Personal Access Token with repo scope.
param githubToken = ''

// Secret that GitHub sends in the X-Hub-Signature-256 header of each webhook delivery.
param githubWebhookSecret = ''

// Random secret stored in Graph subscription clientState for notification validation.
param graphSubscriptionSecret = ''

// Microsoft To Do list ID used when GitHub issues are created as tasks.
param todoDefaultListId = ''
