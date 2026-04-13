const BASE = import.meta.env.VITE_API_URL ?? ''

const WB_ACCESS_KEY = 'wb_access_token'
const WB_REFRESH_KEY = 'wb_refresh_token'
const WB_PROJECT_KEY = 'wb_project_id'
const WB_EXPIRES_KEY = 'wb_expires_at'
const WB_PROFILE_KEY = 'wb_profile_name'

export function getWbTokens() {
  return {
    access: localStorage.getItem(WB_ACCESS_KEY),
    refresh: localStorage.getItem(WB_REFRESH_KEY),
    projectId: localStorage.getItem(WB_PROJECT_KEY),
    expiresAt: Number(localStorage.getItem(WB_EXPIRES_KEY) ?? 0),
    profileName: localStorage.getItem(WB_PROFILE_KEY) ?? '',
  }
}

export function clearWbTokens() {
  localStorage.removeItem(WB_ACCESS_KEY)
  localStorage.removeItem(WB_REFRESH_KEY)
  localStorage.removeItem(WB_PROJECT_KEY)
  localStorage.removeItem(WB_EXPIRES_KEY)
  localStorage.removeItem(WB_PROFILE_KEY)
}

function saveTokens(access: string, refresh: string | null, projectId: string, expiresIn: number, profileName?: string) {
  localStorage.setItem(WB_ACCESS_KEY, access)
  if (refresh) localStorage.setItem(WB_REFRESH_KEY, refresh)
  localStorage.setItem(WB_PROJECT_KEY, projectId)
  localStorage.setItem(WB_EXPIRES_KEY, String(Date.now() + expiresIn * 1000))
  if (profileName !== undefined) localStorage.setItem(WB_PROFILE_KEY, profileName)
}

export async function activate(code: string) {
  const res = await fetch(`${BASE}/v1/wallboard/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  })
  if (!res.ok) throw new Error('Invalid or expired code')
  const data = await res.json()
  saveTokens(data.access_token, data.refresh_token, data.project_id ?? '', data.expires_in, data.profile_name ?? '')
  return data as { access_token: string; refresh_token: string; project_id: string; profile_name: string; expires_in: number }
}

export async function refreshAccessToken(): Promise<string | null> {
  const { refresh } = getWbTokens()
  if (!refresh) return null
  const res = await fetch(`${BASE}/v1/wallboard/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  })
  if (!res.ok) { clearWbTokens(); return null }
  const data = await res.json()
  saveTokens(data.access_token, null, data.project_id ?? '', data.expires_in)
  return data.access_token
}

async function wbFetch(path: string, projectId?: string): Promise<Response> {
  let { access } = getWbTokens()
  const { expiresAt } = getWbTokens()

  // Renew if expires in < 5 min
  if (!access || Date.now() > expiresAt - 5 * 60 * 1000) {
    access = await refreshAccessToken()
    if (!access) throw new Error('unauthenticated')
  }

  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
  return fetch(`${BASE}${path}${qs}`, {
    headers: { Authorization: `Bearer ${access}` },
  })
}

// ── Data ──────────────────────────────────────────────────────────────────────

export interface WbSummary {
  events_today: number
  errors_4xx: number
  errors_5xx: number
  avg_response_ms: number
  active_services: number
}

export interface WbFeedEvent {
  method: string
  path: string
  status_code: number
  response_ms: number
  service_name: string
  timestamp: string
}

export interface WbVolumePoint {
  bucket: string
  count: number
}

export interface WbHealthEntry {
  name: string
  url: string
  last_status: string
  response_ms: number
  last_checked: string
}

export interface WbProject {
  id: string
  name: string
}

export interface WbAlert {
  rule_type: string
  service_name: string
  environment: string
  timestamp: string
}

export interface WbErrorRoute {
  path: string
  method: string
  error_count: number
  error_rate: number
}

export async function getWbSummary(projectId?: string): Promise<WbSummary> {
  const res = await wbFetch('/v1/wallboard/summary', projectId)
  if (!res.ok) throw new Error('Failed to fetch summary')
  return res.json()
}

export async function getWbFeed(projectId?: string): Promise<{ data: WbFeedEvent[] }> {
  const res = await wbFetch('/v1/wallboard/feed', projectId)
  if (!res.ok) throw new Error('Failed to fetch feed')
  return res.json()
}

export async function getWbVolume(projectId?: string): Promise<{ data: WbVolumePoint[] }> {
  const res = await wbFetch('/v1/wallboard/volume', projectId)
  if (!res.ok) throw new Error('Failed to fetch volume')
  return res.json()
}

export async function getWbHealth(projectId?: string): Promise<{ data: WbHealthEntry[] }> {
  const res = await wbFetch('/v1/wallboard/health', projectId)
  if (!res.ok) throw new Error('Failed to fetch health')
  return res.json()
}

export async function getWbAlerts(projectId?: string): Promise<{ data: WbAlert[] }> {
  const res = await wbFetch('/v1/wallboard/alerts', projectId)
  if (!res.ok) throw new Error('Failed to fetch alerts')
  return res.json()
}

export async function getWbErrorRoutes(projectId?: string): Promise<{ data: WbErrorRoute[] }> {
  const res = await wbFetch('/v1/wallboard/error-routes', projectId)
  if (!res.ok) throw new Error('Failed to fetch error routes')
  return res.json()
}

export async function getWbProjects(): Promise<{ data: WbProject[] }> {
  const res = await wbFetch('/v1/wallboard/projects')
  if (!res.ok) throw new Error('Failed to fetch projects')
  return res.json()
}

// ── Management (called from Settings, uses regular JWT) ───────────────────────
import { fetchWithAuth } from '@/lib/api'

export interface WbTokenItem {
  id: string
  name: string
  code: string
  project_id: string
  expires_at: string
  created_at: string
  last_used_at: string | null
}

export async function listWbTokens(projectId?: string): Promise<{ data: WbTokenItem[] }> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
  const res = await fetchWithAuth(`${BASE}/v1/wallboard/tokens${qs}`)
  if (!res.ok) throw new Error('Failed to list tokens')
  return res.json()
}

export async function generateWbCode(projectId?: string, name?: string): Promise<WbTokenItem> {
  const res = await fetchWithAuth(`${BASE}/v1/wallboard/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId ?? '', name: name ?? '' }),
  })
  if (!res.ok) throw new Error('Failed to generate code')
  return res.json()
}

export async function revokeWbCode(id: string): Promise<void> {
  await fetchWithAuth(`${BASE}/v1/wallboard/token?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}
