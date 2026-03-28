import { randomUUID } from 'crypto'
import { AuditEvent, BatAuditConfig } from './types'

const RETRY_DELAYS_MS = [100, 200, 400]

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class BatAuditClient {
  private readonly config: Required<BatAuditConfig>
  private readonly pending: Set<Promise<void>> = new Set()

  constructor(config: BatAuditConfig) {
    this.config = {
      environment: 'prod',
      captureBody: false,
      ...config,
    }
  }

  /** Generate a unique request ID in the format bat-<uuid> */
  generateRequestId(): string {
    return `bat-${randomUUID()}`
  }

  /** Send an audit event asynchronously — does not block the request */
  send(event: AuditEvent): void {
    let p: Promise<void>
    p = this._sendWithRetry(event)
      .catch(() => { /* swallow — best-effort, never throws */ })
      .finally(() => this.pending.delete(p))
    this.pending.add(p)
  }

  /** Wait for all in-flight requests to complete — use in Lambda wrap */
  async flush(): Promise<void> {
    await Promise.allSettled([...this.pending])
  }

  private async _sendWithRetry(event: AuditEvent, attempt = 0): Promise<void> {
    try {
      const res = await fetch(`${this.config.writerUrl}/v1/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify(event),
      })

      if (!res.ok && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        return this._sendWithRetry(event, attempt + 1)
      }
    } catch {
      if (attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt])
        return this._sendWithRetry(event, attempt + 1)
      }
    }
  }
}
