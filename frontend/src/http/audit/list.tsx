import type { UUID } from 'node:crypto'
import { fetchWithAuth } from '@/lib/api'

export interface AuditSummary {
  id: string
  event_type: string
  identifier: string
  user_email: string
  user_name: string
  method: string
  path: string
  status_code: number
  service_name: string
  timestamp: string
  response_time: number
  environment?: string
  project_id?: string
}

// Keep the internal alias for backward compatibility within this file.
type Audit = AuditSummary & { id: UUID }

interface ListAuditResponse {
  data: Audit[]
  pagination: {
    limit: number
    page: number
    totalItems: number
    totalPage: number
  }
}

interface ListAuditParams {
  page?: number
  limit?: number
  projectId?: string
  service_name?: string
  method?: string
  path?: string
  status_code?: string
  environment?: string
  identifier?: string
  start_date?: string
  end_date?: string
  sort_by?: string
  sort_order?: string
  event_type?: string
}

export async function ListAudit(
  params?: ListAuditParams
): Promise<ListAuditResponse> {
  const search = new URLSearchParams()
  if (params?.page) search.set('page', String(params.page))
  if (params?.limit) search.set('limit', String(params.limit))
  if (params?.projectId) search.set('project_id', params.projectId)
  if (params?.service_name) search.set('service_name', params.service_name)
  if (params?.method) search.set('method', params.method)
  if (params?.path) search.set('path', params.path)
  if (params?.status_code) search.set('status_code', params.status_code)
  if (params?.environment) search.set('environment', params.environment)
  if (params?.identifier) search.set('identifier', params.identifier)
  if (params?.start_date) search.set('start_date', params.start_date)
  if (params?.end_date) search.set('end_date', params.end_date)
  if (params?.sort_by) search.set('sort_by', params.sort_by)
  if (params?.sort_order) search.set('sort_order', params.sort_order)
  if (params?.event_type) search.set('event_type', params.event_type)
  const query = search.size > 0 ? `?${search.toString()}` : ''

  const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL ?? ''}/v1/audit${query}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) throw new Error('Failed to fetch audit events')

  return await res.json()
}
