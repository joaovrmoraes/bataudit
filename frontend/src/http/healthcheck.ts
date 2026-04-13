import { fetchWithAuth } from '@/lib/api'

export interface Monitor {
  id: string
  project_id: string
  name: string
  url: string
  interval_seconds: number
  timeout_seconds: number
  expected_status: number
  enabled: boolean
  last_status: 'up' | 'down' | 'unknown'
  last_checked_at: string | null
  created_at: string
  updated_at: string
}

export interface MonitorResult {
  id: string
  monitor_id: string
  status: 'up' | 'down'
  status_code: number | null
  response_ms: number | null
  error: string
  checked_at: string
}

const BASE = `${import.meta.env.VITE_API_URL ?? ''}/v1/monitors`

export async function listMonitors(projectId?: string): Promise<Monitor[]> {
  const url = projectId ? `${BASE}?project_id=${encodeURIComponent(projectId)}` : BASE
  const res = await fetchWithAuth(url)
  if (!res.ok) throw new Error('Failed to fetch monitors')
  const json = await res.json()
  return json.data ?? []
}

export async function createMonitor(body: {
  project_id: string
  name: string
  url: string
  interval_seconds?: number
  timeout_seconds?: number
  expected_status?: number
}): Promise<Monitor> {
  const res = await fetchWithAuth(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to create monitor')
  }
  return res.json()
}

export async function updateMonitor(
  id: string,
  body: Partial<Omit<Monitor, 'id' | 'project_id' | 'created_at' | 'updated_at' | 'last_status' | 'last_checked_at'>>,
): Promise<Monitor> {
  const res = await fetchWithAuth(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to update monitor')
  return res.json()
}

export async function deleteMonitor(id: string): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete monitor')
}

export async function testMonitor(id: string): Promise<MonitorResult> {
  const res = await fetchWithAuth(`${BASE}/${id}/test`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to test monitor')
  return res.json()
}

export async function listMonitorHistory(id: string, limit = 50): Promise<MonitorResult[]> {
  const res = await fetchWithAuth(`${BASE}/${id}/history?limit=${limit}`)
  if (!res.ok) throw new Error('Failed to fetch monitor history')
  const json = await res.json()
  return json.data ?? []
}
