// infra/main.bicepparam
// Parameter file for deploying the Microsoft To Do MCP Server to Azure Functions.
//
// IMPORTANT: Secrets (clientSecret, githubToken, githubWebhookSecret,
// graphSubscriptionSecret) must NOT be stored in this file. Pass them at
// deployment time using --parameters flags or Key Vault references:
//
//   az deployment group create \
//     --resource-group <rg-name> \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam \
//     --parameters clientSecret=<secret> githubToken=<token> \
//                  githubWebhookSecret=<secret> graphSubscriptionSecret=<secret>
//
// Alternatively, use Key Vault references in this file:
//   param clientSecret = getSecret('<subscriptionId>', '<vaultRg>', '<vaultName>', 'client-secret')

using './main.bicep'

// ── Required ─────────────────────────────────────────────────────────────────

// Short name used as prefix for all Azure resources (3-17 lowercase alphanumeric).
// The function app itself will be reachable at https://<appName>.azurewebsites.net
param appName = 'mstodo-mcp'

// Azure App registration client ID (public identifier – safe to store here).
// e.g. '00000000-0000-0000-0000-000000000000'
param clientId = ''

// ── Optional ─────────────────────────────────────────────────────────────────

// Tenant for Microsoft authentication. Use 'organizations' (default) or a specific GUID.
param tenantId = 'organizations'

// Microsoft To Do list ID used when GitHub issues are created as tasks.
param todoDefaultListId = ''
