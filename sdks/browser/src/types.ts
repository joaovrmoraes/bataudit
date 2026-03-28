export type Environment = 'prod' | 'staging' | 'dev'

export interface BatAuditBrowserConfig {
  /** API Key generated in the BatAudit dashboard */
  apiKey: string
  /** Name of this service (e.g. "my-spa") */
  serviceName: string
  /** BatAudit Writer URL (e.g. "http://localhost:8081") */
  writerUrl: string
  /** Deployment environment — defaults to "prod" */
  environment?: Environment
}

/** User context — set via client.setUser() after login */
export interface BatAuditUserData {
  identifier: string
  userEmail?: string
  userName?: string
  userRoles?: string[]
  userType?: string
  tenantId?: string
}

export interface AuditEvent {
  method: string
  path: string
  status_code?: number
  response_time?: number
  identifier: string
  user_email?: string
  user_name?: string
  user_roles?: unknown
  user_type?: string
  tenant_id?: string
  user_agent?: string
  request_id?: string
  service_name: string
  environment: string
  source: 'browser'
  timestamp: string
}
