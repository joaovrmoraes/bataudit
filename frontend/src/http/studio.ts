import { fetchWithAuth } from '@/lib/api'

const BASE = import.meta.env.VITE_API_URL ?? ''

export interface QueryResult {
  columns: string[]
  rows: unknown[][]
  row_count: number
  elapsed_ms: number
  truncated: boolean
}

export async function runQuery(sql: string): Promise<QueryResult> {
  const res = await fetchWithAuth(`${BASE}/v1/audit/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error ?? 'Query failed')
  return json as QueryResult
}

// ── Reports (Studio) ────────────────────────────────────────────────────────

export type VizType = 'line' | 'pie' | 'table'

export interface Widget {
  id: string
  title: string
  sql: string
  viz: VizType
}

export interface GridItem {
  i: string
  x: number
  y: number
  w: number
  h: number
}

export interface Report {
  id: string
  project_id: string
  name: string
  widgets: Widget[]
  layout: GridItem[]
  created_at?: string
  updated_at?: string
}

export async function listReports(projectId?: string): Promise<Report[]> {
  const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
  const res = await fetchWithAuth(`${BASE}/v1/reports${q}`)
  const json = await res.json()
  return (json?.data ?? []) as Report[]
}

export async function getReport(id: string): Promise<Report> {
  const res = await fetchWithAuth(`${BASE}/v1/reports/${id}`)
  if (!res.ok) throw new Error('Report not found')
  return (await res.json()) as Report
}

export async function createReport(input: {
  project_id?: string
  name: string
  widgets: Widget[]
  layout: GridItem[]
}): Promise<Report> {
  const res = await fetchWithAuth(`${BASE}/v1/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to create report')
  return (await res.json()) as Report
}

export async function updateReport(
  id: string,
  input: { name: string; widgets: Widget[]; layout: GridItem[] },
): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/v1/reports/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error('Failed to save report')
}

export async function deleteReport(id: string): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/v1/reports/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete report')
}
