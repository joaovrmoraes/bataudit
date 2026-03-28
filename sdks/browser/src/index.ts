import { BatAuditBrowserClient } from './client'
import { patchFetch } from './interceptors/fetch'
import { patchXHR } from './interceptors/xhr'
import { BatAuditBrowserConfig } from './types'

export interface BatAuditBrowserInstance {
  client: BatAuditBrowserClient
  /** Stop intercepting requests and restore originals */
  unpatch: () => void
}

/**
 * Initialize BatAudit browser SDK.
 * Automatically intercepts all fetch and XHR requests.
 *
 * @example
 * const bataudit = init({ apiKey: '...', serviceName: 'my-spa', writerUrl: 'http://localhost:8081' })
 *
 * // After login:
 * bataudit.client.setUser({ identifier: user.id, userEmail: user.email })
 *
 * // After logout:
 * bataudit.client.clearUser()
 */
export function init(config: BatAuditBrowserConfig): BatAuditBrowserInstance {
  const client = new BatAuditBrowserClient(config)
  const unpatchFetch = patchFetch(client)
  const unpatchXHR = patchXHR(client)

  return {
    client,
    unpatch: () => {
      unpatchFetch()
      unpatchXHR()
    },
  }
}

export { BatAuditBrowserClient } from './client'
export type { BatAuditBrowserConfig, BatAuditUserData, AuditEvent } from './types'
