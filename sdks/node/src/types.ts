export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type Environment = 'prod' | 'staging' | 'dev'

export interface BatAuditConfig {
  /** API Key generated in the BatAudit dashboard */
  apiKey: string
  /** Name of this service (e.g. "payments-api") */
  serviceName: string
  /** BatAudit Writer URL (e.g. "http://localhost:8081") */
  writerUrl: string
  /** Deployment environment — defaults to "prod" */
  environment?: Environment
  /** Whether to capture request bodies — defaults to false */
  captureBody?: boolean
}

/** Set on req.bataudit (Express) or request.bataudit (Fastify) to attach user context */
export interface BatAuditRequestData {
  identifier?: string
  userEmail?: string
  userName?: string
  userRoles?: string[]
  userType?: string
  tenantId?: string
}

export interface AuditEvent {
  id?: string
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
  ip?: string
  user_agent?: string
  request_id?: string
  query_params?: Record<string, unknown>
  path_params?: Record<string, unknown>
  request_body?: unknown
  error_message?: string
  service_name: string
  environment: string
  timestamp: string
}
