import { authHeader } from '@/lib/auth'

export interface Session {
  identifier: string
  service_name: string
  session_start: string
  session_end: string
  duration_seconds: number
  event_count: number
}

export interface SessionEvent {
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

export interface SessionDetail {
  session_id: string
  identifier: string
  service_name: string
  session_start: string
  session_end: string
  duration_seconds: number
  event_count: number
  events: SessionEvent[]
}

export interface SessionFilters {
  projectId?: string | null
  identifier?: string
  service_name?: string
  start_date?: string
  end_date?: string
}

export async function getSessionByID(sessionID: string): Promise<SessionDetail> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/audit/sessions/${encodeURIComponent(sessionID)}`, {
    headers: { ...authHeader() },
  })
  if (!res.ok) throw new Error('Session not found')
  return res.json()
}

export async function getSessions(filters?: SessionFilters): Promise<Session[]> {
  const search = new URLSearchParams()
  if (filters?.projectId) search.set('project_id', filters.projectId)
  if (filters?.identifier) search.set('identifier', filters.identifier)
  if (filters?.service_name) search.set('service_name', filters.service_name)
  if (filters?.start_date) search.set('start_date', filters.start_date)
  if (filters?.end_date) search.set('end_date', filters.end_date)
  const query = search.size > 0 ? `?${search.toString()}` : ''

  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/audit/sessions${query}`, {
    headers: { ...authHeader() },
  })
  if (!res.ok) throw new Error('Failed to fetch sessions')
  const data = await res.json()
  return data.data ?? []
}
