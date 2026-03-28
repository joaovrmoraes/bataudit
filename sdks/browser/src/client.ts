import { AuditEvent, BatAuditBrowserConfig, BatAuditUserData } from './types'

const RETRY_DELAYS_MS = [100, 200, 400]

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class BatAuditBrowserClient {
  readonly config: Required<BatAuditBrowserConfig>
  private user: BatAuditUserData = { identifier: 'anonymous' }
  private readonly pending: Set<Promise<void>> = new Set()

  constructor(config: BatAuditBrowserConfig) {
    this.config = { environment: 'prod', ...config }
  }

  /** Set the current user context — call after login */
  setUser(data: BatAuditUserData): void {
    this.user = data
  }

  /** Clear user context — call after logout */
  clearUser(): void {
    this.user = { identifier: 'anonymous' }
  }

  /** Generate a unique request ID in the format bat-<uuid> */
  generateRequestId(): string {
    return `bat-${crypto.randomUUID()}`
  }

  /** Build a partial event with user context already filled in */
  buildEvent(partial: Omit<AuditEvent, 'identifier' | 'service_name' | 'environment' | 'source'>): AuditEvent {
    return {
      ...partial,
      identifier: this.user.identifier,
      user_email: this.user.userEmail,
      user_name: this.user.userName,
      user_roles: this.user.userRoles,
      user_type: this.user.userType,
      tenant_id: this.user.tenantId,
      service_name: this.config.serviceName,
      environment: this.config.environment,
      source: 'browser',
    }
  }

  /** Send an audit event asynchronously — does not block */
  send(event: AuditEvent): void {
    let p: Promise<void>
    p = this._sendWithRetry(event)
      .catch(() => { /* best-effort, never throws */ })
      .finally(() => this.pending.delete(p))
    this.pending.add(p)
  }

  /** Wait for all in-flight requests to complete */
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

export function extractPath(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.split('?')[0].split('#')[0]
  }
}
