import { BatAuditBrowserClient, extractPath } from '../client'

/**
 * Patches globalThis.fetch to automatically capture every outgoing HTTP request.
 * Requests to the BatAudit Writer URL are ignored to avoid infinite loops.
 *
 * @returns unpatch — call to restore the original fetch
 */
export function patchFetch(client: BatAuditBrowserClient): () => void {
  const originalFetch = globalThis.fetch
  const writerOrigin = new URL(client.config.writerUrl).origin

  globalThis.fetch = async function batAuditFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url

    // Skip requests to the Writer itself — avoids infinite loop
    if (url.startsWith(writerOrigin)) {
      return originalFetch(input, init)
    }

    const existingId =
      init?.headers instanceof Headers
        ? init.headers.get('X-Request-ID')
        : (init?.headers as Record<string, string> | undefined)?.['X-Request-ID']

    const requestId = existingId ?? client.generateRequestId()
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const startTime = Date.now()

    // Inject X-Request-ID into outgoing request
    const headers = new Headers(init?.headers)
    headers.set('X-Request-ID', requestId)

    let statusCode = 0
    try {
      const response = await originalFetch(input, { ...init, headers })
      statusCode = response.status
      return response
    } finally {
      client.send(
        client.buildEvent({
          method,
          path: extractPath(url),
          status_code: statusCode || undefined,
          response_time: Date.now() - startTime,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          request_id: requestId,
          timestamp: new Date().toISOString(),
        })
      )
    }
  }

  return () => {
    globalThis.fetch = originalFetch
  }
}
