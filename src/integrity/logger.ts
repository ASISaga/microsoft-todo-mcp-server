/**
 * Structured logger for the Integrity MCP server.
 *
 * Replaces raw `console.error` calls with level-aware, context-carrying log
 * entries.  In Azure Functions the output goes to stderr (which App Insights
 * picks up); locally it provides human-readable formatting.
 *
 * Usage:
 *   import { logger } from "../integrity/logger.js"
 *   logger.info("Task created", { taskId, listId })
 *   logger.warn("Token expiring soon", { expiresAt })
 *   logger.error("Graph API request failed", { url, status })
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/** Structured context attached to every log entry. */
export type LogContext = Record<string, unknown>

interface LogEntry {
  level: LogLevel
  message: string
  context?: LogContext
  timestamp: string
}

/**
 * Minimal structured logger.
 *
 * All output goes to `stderr` so it never interferes with MCP JSON-RPC on
 * `stdout` (important for the stdio transport).
 */
export class Logger {
  private minLevel: LogLevel

  constructor(minLevel: LogLevel = "debug") {
    this.minLevel = minLevel
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel]
  }

  private emit(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return
    const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : ""
    console.error(`[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}${ctx}`)
  }

  debug(message: string, context?: LogContext): void {
    this.emit({ level: "debug", message, context, timestamp: new Date().toISOString() })
  }

  info(message: string, context?: LogContext): void {
    this.emit({ level: "info", message, context, timestamp: new Date().toISOString() })
  }

  warn(message: string, context?: LogContext): void {
    this.emit({ level: "warn", message, context, timestamp: new Date().toISOString() })
  }

  error(message: string, context?: LogContext): void {
    this.emit({ level: "error", message, context, timestamp: new Date().toISOString() })
  }

  /** Create a child logger that always includes the given context fields. */
  child(baseContext: LogContext): Logger {
    const parent = this
    const child = new Logger(this.minLevel)
    const originalEmit = child.emit.bind(child)
    child.emit = (entry: LogEntry) => {
      if (!parent.shouldLog(entry.level)) return
      originalEmit({ ...entry, context: { ...baseContext, ...entry.context } })
    }
    return child
  }
}

/** Singleton logger instance. */
export const logger = new Logger((process.env.LOG_LEVEL as LogLevel) ?? "debug")
