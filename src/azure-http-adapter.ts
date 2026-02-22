/**
 * Minimal adapter that converts Azure Functions HTTP request/response to the
 * Node.js `IncomingMessage` / `ServerResponse` shape expected by
 * `StreamableHTTPServerTransport.handleRequest`.
 */
import type { IncomingMessage, ServerResponse } from "node:http"
import { Readable } from "node:stream"

/** Result collected from the mock ServerResponse after the handler completes. */
export interface ResponseResult {
  status: number
  headers: Record<string, string>
  body: string
}

/**
 * Wraps a raw body Buffer + HTTP metadata into a minimal IncomingMessage.
 */
export function createIncomingMessage(
  method: string,
  headers: Record<string, string | string[]>,
  body: Buffer,
): IncomingMessage {
  const readable = Readable.from([body]) as unknown as IncomingMessage
  ;(readable as any).method = method.toUpperCase()
  ;(readable as any).url = "/"
  ;(readable as any).headers = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(", ") : v]),
  )
  ;(readable as any).httpVersion = "1.1"
  ;(readable as any).httpVersionMajor = 1
  ;(readable as any).httpVersionMinor = 1
  return readable
}

/**
 * Creates a mock ServerResponse that collects status, headers, and body.
 * Resolves the returned promise once `end()` is called.
 */
export function createMockServerResponse(): {
  res: ServerResponse
  result: Promise<ResponseResult>
} {
  let statusCode = 200
  const respHeaders: Record<string, string> = {}
  const chunks: Buffer[] = []

  let resolve!: (r: ResponseResult) => void
  let reject!: (e: unknown) => void
  const result = new Promise<ResponseResult>((res, rej) => {
    resolve = res
    reject = rej
  })

  function setHeader(name: string, value: string | string[]) {
    respHeaders[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value
  }

  const res = {
    statusCode,
    headersSent: false,
    writableEnded: false,

    getHeader: (name: string) => respHeaders[name.toLowerCase()],
    setHeader,
    removeHeader: (name: string) => {
      delete respHeaders[name.toLowerCase()]
    },
    hasHeader: (name: string) => name.toLowerCase() in respHeaders,

    writeHead(status: number, statusMessageOrHeaders?: string | Record<string, any>, hdrs?: Record<string, any>) {
      statusCode = status
      ;(res as any).statusCode = status
      const h = typeof statusMessageOrHeaders === "object" ? statusMessageOrHeaders : hdrs
      if (h) {
        Object.entries(h).forEach(([k, v]) => setHeader(k, Array.isArray(v) ? (v as string[]) : String(v)))
      }
      return res as unknown as ServerResponse
    },

    write(chunk: Buffer | string, _enc?: unknown, cb?: (() => void) | undefined) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
      if (typeof _enc === "function") _enc()
      else if (cb) cb()
      return true
    },

    end(chunk?: Buffer | string | (() => void), _enc?: unknown, cb?: (() => void) | undefined) {
      if (typeof chunk === "function") {
        chunk()
      } else if (chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
      }
      ;(res as any).writableEnded = true
      ;(res as any).headersSent = true
      if (typeof _enc === "function") _enc()
      else if (cb) cb()
      resolve({
        status: (res as any).statusCode,
        headers: { ...respHeaders },
        body: Buffer.concat(chunks).toString("utf8"),
      })
    },

    on: (_event: string, _listener: unknown) => res as unknown as ServerResponse,
    once: (_event: string, _listener: unknown) => res as unknown as ServerResponse,
    off: (_event: string, _listener: unknown) => res as unknown as ServerResponse,
    emit: (_event: string, ..._args: unknown[]) => false as boolean,
    flushHeaders: () => {},
    socket: null as unknown,
  }

  // Surface write errors
  void result.catch(reject)

  return { res: res as unknown as ServerResponse, result }
}
