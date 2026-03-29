import { authHeader } from '@/lib/auth'

export interface OrphanFilters {
  projectId?: string | null
  service_name?: string
  start_date?: string
  end_date?: string
}

export interface OrphanEvent {
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
}

export interface OrphansResponse {
  data: OrphanEvent[]
  total: number
}

export async function getOrphans(filters?: OrphanFilters): Promise<OrphansResponse> {
  const search = new URLSearchParams()
  if (filters?.projectId) search.set('project_id', filters.projectId)
  if (filters?.service_name) search.set('service_name', filters.service_name)
  if (filters?.start_date) search.set('start_date', filters.start_date)
  if (filters?.end_date) search.set('end_date', filters.end_date)
  const query = search.size > 0 ? `?${search.toString()}` : ''

  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/audit/orphans${query}`, {
    headers: { ...authHeader() },
  })
  if (!res.ok) throw new Error('Failed to fetch orphan events')
  return res.json()
}
