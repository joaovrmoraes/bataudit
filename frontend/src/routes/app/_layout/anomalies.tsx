import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, ShieldAlert, X, Clock, Activity, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAnomalyAlerts, useAuditDetail, useAnomalyRelatedEvents, useAffectedUsers } from '@/queries/audit'
import { useProject } from '@/lib/project-context'
import { useEnvironment } from '@/lib/environment-context'

export const Route = createFileRoute('/app/_layout/anomalies')({
  component: AnomaliesPage,
})

const RULE_META: Record<string, { label: string; color: string; description: string }> = {
  volume_spike:   { label: 'Volume Spike',   color: 'bg-[#818cf8]/20 text-[#818cf8] border-[#818cf8]/30',   description: 'Abnormal spike in request volume (z-score)' },
  error_rate:     { label: 'Error Rate',     color: 'bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30',   description: '4xx/5xx rate exceeded threshold' },
  brute_force:    { label: 'Brute Force',    color: 'bg-[#fb923c]/20 text-[#fb923c] border-[#fb923c]/30',   description: 'Repeated auth failures from same identifier' },
  silent_service: { label: 'Silent Service', color: 'bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/30',   description: 'No events received for threshold minutes' },
  mass_delete:          { label: 'Mass Delete',         color: 'bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30',   description: 'High volume of DELETE requests in short window' },
  error_rate_by_route:  { label: 'Error Rate by Route', color: 'bg-[#f472b6]/20 text-[#f472b6] border-[#f472b6]/30',   description: 'High error rate detected on a specific route' },
}

type AlertSummary = {
  id: string
  path: string
  service_name: string
  environment?: string
  timestamp: string
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function statusColor(code: number) {
  if (code >= 500) return 'text-[#f87171]'
  if (code >= 400) return 'text-[#fbbf24]'
  return 'text-[#4ade80]'
}

function methodColor(m: string) {
  const map: Record<string, string> = {
    GET: 'text-[#4ade80]', POST: 'text-[#818cf8]',
    PUT: 'text-[#fbbf24]', DELETE: 'text-[#f87171]', PATCH: 'text-[#60a5fa]',
  }
  return map[m] ?? 'text-muted-foreground'
}

// ─── Alert card ────────────────────────────────────────────────────────────

function AlertCard({ alert, selected, onClick }: {
  alert: AlertSummary
  selected: boolean
  onClick: () => void
}) {
  const rule = RULE_META[alert.path] ?? { label: alert.path, color: 'bg-muted text-muted-foreground border-border', description: '' }
  return (
    <Card
      className={`p-4 border-border/50 bg-card hover:bg-card/80 transition-colors cursor-pointer select-none ${selected ? 'ring-1 ring-[#818cf8]/50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <AlertTriangle className="h-4 w-4 text-[#f87171] shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={rule.color + ' text-xs'}>{rule.label}</Badge>
              <span className="text-sm font-medium text-foreground truncate">{alert.service_name}</span>
              {alert.environment && (
                <span className="text-xs text-muted-foreground bg-secondary/50 rounded px-1.5 py-0.5">
                  {alert.environment}
                </span>
              )}
            </div>
            {rule.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">{formatTime(alert.timestamp)}</p>
          <p className="text-xs text-muted-foreground/50">{timeAgo(alert.timestamp)}</p>
        </div>
      </div>
    </Card>
  )
}

// ─── Detection details grid ────────────────────────────────────────────────

function DetectionDetails({ details }: { details: Record<string, unknown> }) {
  const rows = Object.entries(details).map(([k, v]) => ({
    key: k.replace(/_/g, ' '),
    value: typeof v === 'number'
      ? (Number.isInteger(v) ? v.toString() : (v as number).toFixed(2))
      : String(v),
  }))
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
      {rows.map(r => (
        <div key={r.key}>
          <p className="text-xs text-muted-foreground capitalize mb-0.5">{r.key}</p>
          <p className="text-sm font-mono text-foreground break-all">{r.value}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Related events list ───────────────────────────────────────────────────

function buildRelatedFilters(
  alert: AlertSummary,
  details: Record<string, unknown> | null,
  projectId?: string | null,
) {
  if (alert.path === 'silent_service') {
    const endDate = details?.last_event_at ? String(details.last_event_at) : alert.timestamp
    const startDate = new Date(new Date(endDate).getTime() - 2 * 60 * 60 * 1000).toISOString()
    return { service_name: alert.service_name, event_type: 'http', start_date: startDate, end_date: endDate, limit: 50, projectId: projectId ?? undefined }
  }

  const ts = new Date(alert.timestamp)
  const windowSecs = Number(details?.window_secs ?? 300)
  const startDate = new Date(ts.getTime() - windowSecs * 1000).toISOString()
  const endDate = ts.toISOString()

  return {
    service_name: alert.service_name,
    event_type: 'http',
    start_date: startDate,
    end_date: endDate,
    limit: 100,
    projectId: projectId ?? undefined,
    ...(alert.path === 'brute_force' && details?.identifier
      ? { identifier: String(details.identifier) }
      : {}),
    ...(alert.path === 'error_rate_by_route' && details?.path
      ? { path: String(details.path), ...(details.method ? { method: String(details.method) } : {}) }
      : {}),
  }
}

function RelatedEvents({ alert, details, projectId }: {
  alert: AlertSummary
  details: Record<string, unknown> | null
  projectId?: string | null
}) {
  const filters = buildRelatedFilters(alert, details, projectId)
  const { data, isLoading } = useAnomalyRelatedEvents(filters)
  const events = data?.data ?? []

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading events…</p>
  }
  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">No related events found in this window.</p>
  }

  return (
    <div className="space-y-1">
      {events.map(e => (
        <div
          key={e.id}
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/30 text-xs font-mono hover:bg-secondary/50 transition-colors"
        >
          <span className={`${methodColor(e.method ?? '')} w-12 shrink-0`}>{e.method}</span>
          <span className="text-foreground flex-1 truncate">{e.path}</span>
          <span className={`${statusColor(e.status_code ?? 0)} w-8 text-right shrink-0`}>{e.status_code}</span>
          <span className="text-muted-foreground w-14 text-right shrink-0">{e.response_time}ms</span>
          <span className="text-muted-foreground/50 w-16 text-right shrink-0">{timeAgo(e.timestamp)}</span>
        </div>
      ))}
      <p className="text-xs text-muted-foreground/50 pt-1">{events.length} event{events.length !== 1 ? 's' : ''} in window</p>
    </div>
  )
}

// ─── Affected Users ────────────────────────────────────────────────────────

function AffectedUsersSection({ details, projectId }: {
  alert: AlertSummary
  details: Record<string, unknown> | null
  projectId?: string | null
}) {
  const path = details?.path ? String(details.path) : null
  const method = details?.method ? String(details.method) : null
  const { data, isLoading } = useAffectedUsers(projectId, path, method)
  const users = data?.data ?? []

  if (!path) return null

  return (
    <div className="px-6 py-5 border-t border-border/30">
      <div className="flex items-center gap-2 mb-4">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Affected Users</h3>
        <span className="text-xs text-muted-foreground font-mono ml-auto">{method && <span className="text-[#f472b6]">{method} </span>}{path}</span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-xs text-muted-foreground">No affected users found.</p>
      ) : (
        <div className="space-y-1">
          {users.map(u => (
            <div key={u.identifier} className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/30 text-xs font-mono hover:bg-secondary/50 transition-colors">
              <span className="text-foreground flex-1 truncate">{u.user_email || u.user_name || u.identifier}</span>
              <span className="text-[#f87171] shrink-0">{u.error_count} err</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground/50 pt-1">{users.length} user{users.length !== 1 ? 's' : ''} affected</p>
        </div>
      )}
    </div>
  )
}

// ─── Left Drawer ───────────────────────────────────────────────────────────

function AlertDrawer({ alert, projectId, onClose }: {
  alert: AlertSummary | null
  projectId?: string | null
  onClose: () => void
}) {
  const { data: full, isLoading: loadingDetail } = useAuditDetail(alert?.id ?? null)
  const rule = alert ? (RULE_META[alert.path] ?? { label: alert.path, color: 'bg-muted text-muted-foreground border-border', description: '' }) : null

  let details: Record<string, unknown> | null = null
  if (full?.request_body) {
    try {
      details = typeof full.request_body === 'string'
        ? JSON.parse(full.request_body)
        : full.request_body as Record<string, unknown>
    } catch { details = null }
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const open = !!alert

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-[520px] max-w-[92vw] bg-card border-l border-border/60 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {alert && rule && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <AlertTriangle className="h-4 w-4 text-[#f87171] shrink-0" />
                <Badge className={`${rule.color} text-xs shrink-0`}>{rule.label}</Badge>
                <span className="text-sm font-semibold text-foreground truncate">{alert.service_name}</span>
                {alert.environment && (
                  <span className="text-xs text-muted-foreground bg-secondary/50 rounded px-1.5 py-0.5 shrink-0">
                    {alert.environment}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-3 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {/* Timestamp + description */}
              <div className="px-6 py-4 border-b border-border/30 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatTime(alert.timestamp)}</span>
                  <span className="text-muted-foreground/50">·</span>
                  <span>{timeAgo(alert.timestamp)}</span>
                </div>
                {rule.description && (
                  <p className="text-sm text-muted-foreground">{rule.description}</p>
                )}
              </div>

              {/* Detection details */}
              <div className="px-6 py-5 border-b border-border/30">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Detection Details</h3>
                </div>
                {loadingDetail ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : details ? (
                  <DetectionDetails details={details} />
                ) : (
                  <p className="text-xs text-muted-foreground">No detail data available.</p>
                )}
              </div>

              {/* Triggering events */}
              <div className="px-6 py-5">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {alert.path === 'silent_service' ? 'Last Events Before Silence' : 'Triggering Events'}
                  </h3>
                </div>
                {loadingDetail ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : (
                  <RelatedEvents alert={alert} details={details} projectId={projectId} />
                )}
              </div>

              {/* Affected users for error_rate_by_route */}
              {alert.path === 'error_rate_by_route' && (
                <AffectedUsersSection alert={alert} details={details} projectId={projectId} />
              )}

              {/* Footer: identifier hint for brute force */}
              {!!details?.identifier && alert.path === 'brute_force' && (
                <div className="px-6 pb-5">
                  <div className="flex items-center gap-2 p-3 rounded-md bg-[#fb923c]/10 border border-[#fb923c]/20">
                    <User className="h-3.5 w-3.5 text-[#fb923c] shrink-0" />
                    <p className="text-xs text-[#fb923c]">
                      Attacker identifier: <span className="font-mono">{String(details.identifier)}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────

function AnomaliesPage() {
  const { selectedProjectId } = useProject()
  const { selectedEnvironment } = useEnvironment()
  const { data, isLoading } = useAnomalyAlerts(selectedProjectId, selectedEnvironment)
  const [selectedAlert, setSelectedAlert] = React.useState<AlertSummary | null>(null)

  const alerts = data?.data ?? []

  function handleSelect(alert: AlertSummary) {
    setSelectedAlert(prev => prev?.id === alert.id ? null : alert)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 text-[#f87171]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Anomaly Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Last 24 hours — click an alert to open the detail panel
          </p>
        </div>
        {alerts.length > 0 && (
          <Badge className="ml-auto bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!isLoading && alerts.length === 0 && (
        <Card className="p-12 text-center border-border/50">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No anomalies detected in the last 24 hours.</p>
        </Card>
      )}

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              selected={selectedAlert?.id === alert.id}
              onClick={() => handleSelect(alert)}
            />
          ))}
        </div>
      )}

      <AlertDrawer
        alert={selectedAlert}
        projectId={selectedProjectId}
        onClose={() => setSelectedAlert(null)}
      />
    </div>
  )
}
