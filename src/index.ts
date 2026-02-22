/**
 * Azure Functions entry point.
 * Importing these modules registers all HTTP/timer-triggered functions
 * with the @azure/functions runtime.
 */
import "./functions/mcp.js"
import "./functions/github-webhook.js"
import "./functions/todo-webhook.js"
import "./functions/subscription-renew.js"
