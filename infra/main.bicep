@description('Name prefix used for all resources. Must be 3-17 lowercase alphanumeric characters.')
@minLength(3)
@maxLength(17)
param appName string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Azure App registration client ID.')
@secure()
param clientId string

@description('Azure App registration client secret.')
@secure()
param clientSecret string

@description('Tenant ID for Microsoft authentication. Use "organizations" for multi-tenant.')
param tenantId string = 'organizations'

@description('GitHub Personal Access Token with repo scope.')
@secure()
param githubToken string = ''

@description('Secret used to validate GitHub webhook payloads.')
@secure()
param githubWebhookSecret string = ''

@description('Random secret stored in Microsoft Graph subscription clientState.')
@secure()
param graphSubscriptionSecret string = ''

@description('Microsoft To Do list ID for GitHub-to-Todo task creation.')
param todoDefaultListId string = ''

// ── Storage Account ──────────────────────────────────────────────────────────

var storageAccountName = '${toLower(replace(appName, '-', ''))}st'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

// ── Log Analytics Workspace ───────────────────────────────────────────────────

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// ── Application Insights ─────────────────────────────────────────────────────

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-ai'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// ── Consumption App Service Plan (scales to zero) ────────────────────────────

resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {}
}

// ── Function App ─────────────────────────────────────────────────────────────

var storageConnectionString = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'functionapp'
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    siteConfig: {
      nodeVersion: '~20'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: storageConnectionString
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(appName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        // ── Microsoft Graph / To Do ──
        {
          name: 'CLIENT_ID'
          value: clientId
        }
        {
          name: 'CLIENT_SECRET'
          value: clientSecret
        }
        {
          name: 'TENANT_ID'
          value: tenantId
        }
        // ── GitHub ──
        {
          name: 'GITHUB_TOKEN'
          value: githubToken
        }
        {
          name: 'GITHUB_WEBHOOK_SECRET'
          value: githubWebhookSecret
        }
        // ── Subscription management ──
        {
          name: 'GRAPH_SUBSCRIPTION_SECRET'
          value: graphSubscriptionSecret
        }
        {
          name: 'MS_TODO_LIST_ID'
          value: todoDefaultListId
        }
      ]
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────

@description('Function App hostname for configuring webhooks.')
output functionAppHostname string = functionApp.properties.defaultHostName

@description('MCP endpoint URL.')
output mcpEndpointUrl string = 'https://${functionApp.properties.defaultHostName}/api/mcp'

@description('GitHub webhook URL to register in your repository settings.')
output githubWebhookUrl string = 'https://${functionApp.properties.defaultHostName}/api/github-webhook'

@description('Microsoft Graph notification URL to use when creating subscriptions.')
output todoWebhookUrl string = 'https://${functionApp.properties.defaultHostName}/api/todo-webhook'
