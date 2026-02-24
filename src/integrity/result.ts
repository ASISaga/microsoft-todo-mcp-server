/**
 * A lightweight Result type that makes success / failure explicit.
 *
 * Replaces the pattern of returning `T | null` from API client methods.
 * Callers can pattern-match on `ok` instead of null-checking, and failure
 * results carry structured error information.
 *
 * Usage:
 *   const result = await graphClient.request<Task>(url)
 *   if (result.ok) {
 *     console.log(result.value)
 *   } else {
 *     console.error(result.error)
 *   }
 */

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }

/** Create a success result. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

/** Create a failure result. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
