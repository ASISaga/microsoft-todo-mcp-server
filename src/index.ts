/**
 * Azure Functions entry point.
 * Importing these modules registers all HTTP/timer-triggered functions
 * with the @azure/functions runtime.
 */
import "./azure/functions/mcp.js"
import "./azure/functions/github-webhook.js"
import "./azure/functions/todo-webhook.js"
import "./azure/functions/subscription-renew.js"
