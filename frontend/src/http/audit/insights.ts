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
