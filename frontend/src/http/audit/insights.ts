import { fetchWithAuth } from '@/lib/api'

export interface TopEndpoint {
  path: string
  method: string
  count: number
}

export interface TopUser {
  identifier: string
  user_email: string
  user_name: string
  count: number
}

export interface TopErrorRoute {
  path: string
  method: string
  error_count: number
  total: number
  error_rate: number
}

export interface TopSlowRoute {
  path: string
  method: string
  avg_ms: number
}

export interface InsightsResult {
  top_endpoints: TopEndpoint[]
  top_users: TopUser[]
  top_error_routes: TopErrorRoute[]
  top_slow_routes: TopSlowRoute[]
}

export async function getInsights(projectId?: string | null, period = '7d'): Promise<InsightsResult> {
  const search = new URLSearchParams()
  if (projectId) search.set('project_id', projectId)
  search.set('period', period)

  const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL ?? ''}/v1/audit/insights?${search.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch insights')
  return res.json()
}

export interface AffectedUser {
  identifier: string
  user_email: string
  user_name: string
  error_count: number
  last_seen: string
}

export async function getAffectedUsers(
  projectId: string,
  path: string,
  method?: string,
  start?: string,
  end?: string,
): Promise<{ data: AffectedUser[] }> {
  const search = new URLSearchParams({ project_id: projectId, path })
  if (method) search.set('method', method)
  if (start) search.set('start', start)
  if (end) search.set('end', end)

  const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL ?? ''}/v1/audit/affected-users?${search.toString()}`)
  if (!res.ok) throw new Error('Failed to fetch affected users')
  return res.json()
}
