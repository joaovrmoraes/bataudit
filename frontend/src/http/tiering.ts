import { fetchWithAuth } from '@/lib/api'

const BASE = import.meta.env.VITE_API_URL ?? ''

export interface HistoryPoint {
  period_start: string
  period_type: 'hour' | 'day'
  event_count: number
  errors_4xx: number
  errors_5xx: number
  avg_ms: number
  p95_ms: number
}

export interface UsageStat {
  raw_events: number
  hourly_summaries: number
  daily_summaries: number
}

export async function getAuditHistory(
  projectId: string,
  startDate?: string,
  endDate?: string,
  environment?: string | null,
): Promise<{ data: HistoryPoint[]; from: string; to: string }> {
  const params = new URLSearchParams({ project_id: projectId })
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  if (environment) params.set('environment', environment)

  const res = await fetchWithAuth(`${BASE}/v1/audit/stats/history?${params}`)
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export async function getUsageStat(projectId: string): Promise<UsageStat> {
  const res = await fetchWithAuth(
    `${BASE}/v1/audit/stats/usage?project_id=${encodeURIComponent(projectId)}`,
  )
  if (!res.ok) throw new Error('Failed to fetch usage')
  return res.json()
}
