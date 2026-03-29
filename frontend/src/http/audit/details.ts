import { authHeader } from '@/lib/auth'

export interface AuditDetail {
  id: string
  method: string
  path: string
  status_code: number
  response_time: number
  identifier: string
  user_email: string
  user_name: string
  user_roles: unknown
  user_type: string
  tenant_id: string
  ip: string
  user_agent: string
  request_id: string
  query_params: unknown
  path_params: unknown
  request_body: unknown
  error_message: string
  service_name: string
  environment: string
  timestamp: string
  project_id: string
}

export async function getAuditDetail(id: string): Promise<AuditDetail> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/audit/${id}`, {
    headers: { ...authHeader() },
  })
  if (!res.ok) throw new Error('Failed to fetch audit detail')
  return res.json()
}
