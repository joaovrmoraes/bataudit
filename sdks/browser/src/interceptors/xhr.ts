import { BatAuditBrowserClient, extractPath } from '../client'

interface InstrumentedXHR extends XMLHttpRequest {
  _bat_method?: string
  _bat_url?: string
  _bat_skip?: boolean
  _bat_request_id?: string
  _bat_start_time?: number
}

/**
 * Patches XMLHttpRequest to automatically capture every outgoing request.
 * Requests to the BatAudit Writer URL are ignored to avoid infinite loops.
 *
 * @returns unpatch — call to restore the original XHR prototype methods
 */
export function patchXHR(client: BatAuditBrowserClient): () => void {
  const writerOrigin = new URL(client.config.writerUrl).origin
  const originalOpen = XMLHttpRequest.prototype.open
  const originalSend = XMLHttpRequest.prototype.send

  XMLHttpRequest.prototype.open = function (
    this: InstrumentedXHR,
    method: string,
    url: string | URL,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...rest: any[]
  ): void {
    const urlStr = url.toString()
    this._bat_method = method.toUpperCase()
    this._bat_url = urlStr
    this._bat_skip = urlStr.startsWith(writerOrigin)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return originalOpen.apply(this, [method, url, ...rest] as any)
  }

  XMLHttpRequest.prototype.send = function (
    this: InstrumentedXHR,
    body?: Document | XMLHttpRequestBodyInit | null
  ): void {
    if (this._bat_skip) {
      return originalSend.apply(this, [body] as Parameters<typeof originalSend>)
    }

    const requestId = client.generateRequestId()
    this._bat_request_id = requestId
    this._bat_start_time = Date.now()

    this.setRequestHeader('X-Request-ID', requestId)

    this.addEventListener('loadend', () => {
      const url = this._bat_url ?? ''
      client.send(
        client.buildEvent({
          method: this._bat_method ?? 'GET',
          path: extractPath(url),
          status_code: this.status || undefined,
          response_time: Date.now() - (this._bat_start_time ?? Date.now()),
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          request_id: this._bat_request_id,
          timestamp: new Date().toISOString(),
        })
      )
    })

    return originalSend.apply(this, [body] as Parameters<typeof originalSend>)
  }

  return () => {
    XMLHttpRequest.prototype.open = originalOpen
    XMLHttpRequest.prototype.send = originalSend
  }
}
