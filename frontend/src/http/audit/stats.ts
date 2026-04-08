import { fetchWithAuth } from '@/lib/api'

export interface ServiceBreakdown {
  service_name: string
  requests: number
  errors: number
  avg_response_time: number
  last_event: string
}

export interface TimelinePoint {
  hour: string
  count: number
}

export interface AuditStats {
  total: number
  errors_4xx: number
  errors_5xx: number
  avg_response_time: number
  p95_response_time: number
  active_services: number
  last_event_at: string
  by_service: ServiceBreakdown[]
  by_status_class: Record<string, number>
  by_method: Record<string, number>
  timeline: TimelinePoint[]
}

export async function getAuditStats(projectId?: string | null, environment?: string | null): Promise<AuditStats> {
  const search = new URLSearchParams()
  if (projectId) search.set('project_id', projectId)
  if (environment) search.set('environment', environment)
  const query = search.size > 0 ? `?${search.toString()}` : ''

  const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL ?? ''}/v1/audit/stats${query}`)

  if (!res.ok) throw new Error('Failed to fetch stats')
  return res.json()
}
