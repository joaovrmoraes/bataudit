import React from 'react'
import { createFileRoute, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { XAxis, YAxis, ResponsiveContainer, AreaChart, Area, ReferenceLine } from 'recharts'
import { ShieldAlert, HeartPulse, AlertTriangle, Activity, Wifi, WifiOff, LayoutDashboard, LayoutGrid } from 'lucide-react'
import {
  activate,
  clearWbTokens,
  getWbTokens,
  refreshAccessToken,
} from '@/http/wallboard'
import {
  useWbSummary,
  useWbFeed,
  useWbVolume,
  useWbHealth,
  useWbAlerts,
  useWbErrorRoutes,
  useWbProjects,
  useWbGrid,
} from '@/queries/wallboard'

const searchSchema = z.object({
  project_id: z.string().optional(),
})

export const Route = createFileRoute('/tv')({
  validateSearch: searchSchema,
  component: TVPage,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(code: number) {
  if (code >= 500) return 'text-[#f87171]'
  if (code >= 400) return 'text-[#fb923c]'
  return 'text-[#4ade80]'
}

function methodColor(m: string) {
  const map: Record<string, string> = {
    GET: 'text-[#4ade80]', POST: 'text-[#818cf8]',
    PUT: 'text-[#fbbf24]', DELETE: 'text-[#f87171]',
  }
  return map[m] ?? 'text-slate-400'
}

function timeAgo(ts: string) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const s = Math.floor(diff / 1000)
  if (s <= 0) return 'now'
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-5 flex flex-col gap-1">
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`text-3xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

// ── Activation screen ─────────────────────────────────────────────────────────

function ActivationScreen({ onActivated }: { onActivated: (profileName: string) => void }) {
  const [code, setCode] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await activate(code.trim())
      onActivated(data.profile_name ?? '')
    } catch {
      setError('Invalid or expired code. Generate one in Settings → Wallboard.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center px-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Activity className="h-8 w-8 text-[#818cf8]" />
          <span className="text-2xl font-bold text-white tracking-tight">BatAudit TV</span>
        </div>
        <p className="text-slate-400 text-sm">Enter the activation code from Settings → Wallboard</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="BAT-XXXXXX"
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono text-lg text-center tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-[#818cf8]"
            maxLength={10}
            autoFocus
          />
          {error && <p className="text-[#f87171] text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading || code.length < 6}
            className="w-full bg-[#818cf8] hover:bg-[#818cf8]/80 disabled:opacity-40 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? 'Activating…' : 'Activate'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Health Carousel ────────────────────────────────────────────────────────────

const PAGE_SIZE = 5
const CAROUSEL_INTERVAL = 15_000

function HealthCarousel({ entries }: { entries: { name: string; last_status: string; response_ms: number; last_checked: string }[] }) {
  const [page, setPage] = React.useState(0)
  const total = entries.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  React.useEffect(() => {
    if (pages <= 1) return
    const t = setInterval(() => setPage(p => (p + 1) % pages), CAROUSEL_INTERVAL)
    return () => clearInterval(t)
  }, [pages])

  // Reset page if entries change and current page is out of range
  React.useEffect(() => {
    if (page >= pages) setPage(0)
  }, [pages, page])

  const slice = entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  return (
    <div>
      {slice.map((h, i) => (
        <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-700/30 last:border-0">
          <span className={`text-xs font-bold shrink-0 w-6 ${h.last_status === 'up' ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
            {h.last_status === 'up' ? '↑' : '↓'}
          </span>
          <span className="text-slate-300 text-xs truncate flex-1">{h.name}</span>
          <span className="text-slate-500 text-xs shrink-0 tabular-nums">{h.response_ms}ms</span>
          <span className="text-slate-600 text-xs shrink-0 tabular-nums">{timeAgo(h.last_checked)}</span>
        </div>
      ))}
      {total === 0 && <p className="text-xs text-slate-500">No monitors configured</p>}
      {pages > 1 && (
        <div className="flex justify-center gap-1 mt-2">
          {Array.from({ length: pages }).map((_, i) => (
            <span
              key={i}
              className={`inline-block w-1.5 h-1.5 rounded-full transition-colors ${i === page ? 'bg-[#818cf8]' : 'bg-slate-700'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Project Grid (multi-project view) ───────────────────────────────────────────

function ProjectGridCard({ stat, onSelect }: {
  stat: { project_id: string; project_name: string; events_today: number; errors_4xx: number; errors_5xx: number; avg_response_ms: number; down_monitors: number }
  onSelect: (id: string) => void
}) {
  const hasErrors = stat.errors_5xx > 0
  const hasWarn = stat.errors_4xx > 0
  const hasDown = stat.down_monitors > 0
  const accent = hasDown || hasErrors ? 'border-[#f87171]/50' : hasWarn ? 'border-[#fb923c]/40' : 'border-slate-700/50'

  return (
    <button
      onClick={() => onSelect(stat.project_id)}
      className={`text-left rounded-xl bg-slate-800/60 border ${accent} p-4 flex flex-col gap-3 hover:bg-slate-800 transition-colors`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white truncate">{stat.project_name}</span>
        {hasDown ? (
          <span className="flex items-center gap-1 text-[#f87171] text-xs font-semibold shrink-0">
            <WifiOff className="h-3 w-3" /> {stat.down_monitors}
          </span>
        ) : (
          <span className="h-2 w-2 rounded-full bg-[#4ade80] shrink-0" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Events</p>
          <p className="text-xl font-bold tabular-nums text-white">{stat.events_today.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Avg</p>
          <p className="text-xl font-bold tabular-nums text-[#818cf8]">{Math.round(stat.avg_response_ms)}ms</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">4xx</p>
          <p className={`text-lg font-bold tabular-nums ${hasWarn ? 'text-[#fb923c]' : 'text-slate-400'}`}>{stat.errors_4xx}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">5xx</p>
          <p className={`text-lg font-bold tabular-nums ${hasErrors ? 'text-[#f87171]' : 'text-slate-400'}`}>{stat.errors_5xx}</p>
        </div>
      </div>
    </button>
  )
}

function ProjectGrid({ environment, onSelect }: { environment?: string; onSelect: (id: string) => void }) {
  const grid = useWbGrid(environment)
  const stats = grid.data ?? []

  if (stats.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 160px)' }}>
        <p className="text-slate-500 text-sm">No projects yet</p>
      </div>
    )
  }

  // Adaptive columns: keep cards readable up to ~4 per row
  const cols = stats.length <= 2 ? stats.length : stats.length <= 9 ? 3 : 4

  return (
    <div
      className="grid gap-3 overflow-y-auto"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, height: 'calc(100vh - 160px)' }}
    >
      {stats.map(s => (
        <ProjectGridCard key={s.project_id} stat={s} onSelect={onSelect} />
      ))}
    </div>
  )
}

// ── TV Dashboard ──────────────────────────────────────────────────────────────

const ENVIRONMENTS = ['', 'production', 'staging', 'development', 'testing', 'local'] as const

function TVDashboard({ projectId, onProjectChange, profileName }: { projectId: string; onProjectChange: (id: string) => void; profileName: string }) {
  const [environment, setEnvironment] = React.useState<string>('')
  const [viewMode, setViewMode] = React.useState<'dashboard' | 'grid'>('dashboard')
  const env = environment || undefined
  const isGrid = viewMode === 'grid'
  const dashEnabled = !isGrid
  const { data: summary } = useWbSummary(projectId || undefined, env, dashEnabled)
  const feed = useWbFeed(projectId || undefined, env, dashEnabled)
  const volume = useWbVolume(projectId || undefined, env, dashEnabled)
  const health = useWbHealth(projectId || undefined, dashEnabled)
  const alerts = useWbAlerts(projectId || undefined, env, dashEnabled)
  const errorRoutes = useWbErrorRoutes(projectId || undefined, env, dashEnabled)
  const projects = useWbProjects()

  function handleGridSelect(id: string) {
    onProjectChange(id)
    setViewMode('dashboard')
  }

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const [clock, setClock] = React.useState(now)
  React.useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000)
    return () => clearInterval(t)
  }, [])

  const healthEntries = health.data ?? []
  const hasDown = healthEntries.some(h => h.last_status === 'down')
  const activeAlerts = (alerts.data ?? []).length

  const selectedProject = (projects.data ?? []).find(p => p.id === projectId)

  return (
    <div className="min-h-screen bg-[#0f1117] text-white p-6 space-y-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-[#818cf8]" />
          <span className="text-lg font-bold tracking-tight">BatAudit</span>
          {profileName && (
            <span className="text-xs bg-[#818cf8]/20 text-[#818cf8] rounded px-2 py-0.5 font-medium">{profileName}</span>
          )}
          {!isGrid && selectedProject && (
            <span className="text-xs bg-slate-700 rounded px-2 py-0.5 text-slate-300">{selectedProject.name}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {hasDown && (
            <span className="flex items-center gap-1.5 text-[#f87171] text-xs font-semibold animate-pulse">
              <WifiOff className="h-3.5 w-3.5" /> SERVICE DOWN
            </span>
          )}
          {activeAlerts > 0 && (
            <span className="flex items-center gap-1.5 text-[#fb923c] text-xs font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" /> {activeAlerts} ALERT{activeAlerts > 1 ? 'S' : ''}
            </span>
          )}
          {/* View toggle */}
          <div className="flex items-center bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${viewMode === 'dashboard' ? 'bg-[#818cf8] text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${viewMode === 'grid' ? 'bg-[#818cf8] text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </button>
          </div>
          <select
            value={environment}
            onChange={e => setEnvironment(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#818cf8]"
          >
            <option value="">All environments</option>
            {ENVIRONMENTS.filter(e => e).map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {!isGrid && (
            <select
              value={projectId}
              onChange={e => onProjectChange(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#818cf8]"
            >
              <option value="">All projects</option>
              {(projects.data ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <span className="text-slate-400 text-sm font-mono">{clock}</span>
        </div>
      </div>

      {isGrid && <ProjectGrid environment={env} onSelect={handleGridSelect} />}

      {!isGrid && (
      <>
      {/* Stats row */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Events today" value={summary?.events_today ?? '—'} color="text-white" />
        <StatCard label="4xx errors" value={summary?.errors_4xx ?? '—'} color="text-[#fb923c]" />
        <StatCard label="5xx errors" value={summary?.errors_5xx ?? '—'} color="text-[#f87171]" />
        <StatCard label="Avg response" value={summary ? `${Math.round(summary.avg_response_ms)}ms` : '—'} color="text-[#818cf8]" />
        <StatCard label="Services" value={summary?.active_services ?? '—'} color="text-[#4ade80]" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-4" style={{ height: 'calc(100vh - 220px)' }}>

        {/* Left: volume chart + error routes */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4" style={{ flex: '0 0 220px' }}>
            {(() => {
              const pts = volume.data ?? []
              const maxVal = pts.length ? Math.max(...pts.map(p => p.count)) : 0
              const avgVal = pts.length ? Math.round(pts.reduce((s, p) => s + p.count, 0) / pts.length) : 0
              const lastVal = pts.length ? pts[pts.length - 1].count : 0

              // Custom dot: renders a visible label only at peak and last point
              const CustomDot = (props: { cx?: number; cy?: number; index?: number; value?: number }) => {
                const { cx, cy, index, value } = props
                if (cx === undefined || cy === undefined || index === undefined || value === undefined) return null
                const isPeak = value === maxVal
                const isLast = index === pts.length - 1
                if (!isPeak && !isLast) return null
                const isDupe = isPeak && isLast
                return (
                  <g>
                    <circle cx={cx} cy={cy} r={3} fill="#818cf8" />
                    <text
                      x={cx}
                      y={cy - 8}
                      textAnchor="middle"
                      fill={isPeak ? '#818cf8' : '#94a3b8'}
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {isDupe ? `▲ ${value}` : isPeak ? `▲ ${value}` : value}
                    </text>
                  </g>
                )
              }

              return (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-widest text-slate-400">Volume (last 2h)</p>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-slate-500">avg <span className="text-slate-300">{avgVal}</span></span>
                      <span className="text-slate-500">now <span className="text-slate-300">{lastVal}</span></span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={150}>
                    <AreaChart data={pts} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
                      <XAxis dataKey="bucket" hide />
                      <YAxis hide domain={[0, maxVal > 0 ? maxVal * 1.3 : 10]} />
                      {avgVal > 0 && (
                        <ReferenceLine y={avgVal} stroke="#475569" strokeDasharray="3 3" label={{ value: `avg ${avgVal}`, position: 'insideTopRight', style: { fill: '#475569', fontSize: 9, fontFamily: 'monospace' } }} />
                      )}
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#818cf8"
                        fill="#818cf8"
                        fillOpacity={0.15}
                        strokeWidth={2}
                        dot={<CustomDot />}
                        activeDot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </>
              )
            })()}
          </div>

          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-3.5 w-3.5 text-[#f87171]" />
              <p className="text-xs uppercase tracking-widest text-slate-400">Top Error Routes</p>
            </div>
            {(errorRoutes.data ?? []).slice(0, 8).map((r, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-700/30 last:border-0">
                <span className={`${methodColor(r.method)} text-xs font-mono w-10 shrink-0`}>{r.method}</span>
                <span className="text-slate-300 text-xs font-mono truncate flex-1">{r.path}</span>
                <span className="text-slate-500 text-xs font-mono shrink-0 tabular-nums">{r.error_count}</span>
                <span className="text-[#f87171] text-xs font-mono shrink-0 tabular-nums w-10 text-right">{r.error_rate.toFixed(0)}%</span>
              </div>
            ))}
            {(errorRoutes.data ?? []).length === 0 && (
              <p className="text-xs text-slate-500">No errors in the last hour</p>
            )}
          </div>
        </div>

        {/* Center: live feed */}
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-3 shrink-0">
            <Wifi className="h-3.5 w-3.5 text-[#4ade80]" />
            <p className="text-xs uppercase tracking-widest text-slate-400">Live Feed</p>
          </div>
          <div className="space-y-1 overflow-y-auto flex-1">
            {(feed.data ?? []).map((ev, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-700/20 last:border-0 text-xs font-mono">
                <span className={`${methodColor(ev.method)} w-10 shrink-0`}>{ev.method}</span>
                <span className="text-slate-300 flex-1 truncate">{ev.path}</span>
                <span className={`${statusColor(ev.status_code)} w-8 text-right shrink-0`}>{ev.status_code}</span>
                <span className="text-slate-500 w-12 text-right shrink-0">{ev.response_ms}ms</span>
                <span className="text-slate-600 w-8 text-right shrink-0">{timeAgo(ev.timestamp)}</span>
              </div>
            ))}
            {(feed.data ?? []).length === 0 && (
              <p className="text-xs text-slate-500">No events yet</p>
            )}
          </div>
        </div>

        {/* Right: health + alerts */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-3.5 w-3.5 text-[#4ade80]" />
                <p className="text-xs uppercase tracking-widest text-slate-400">Health Monitors</p>
              </div>
              {healthEntries.length > PAGE_SIZE && (
                <span className="text-slate-600 text-xs">{healthEntries.length} total</span>
              )}
            </div>
            <HealthCarousel entries={healthEntries} />
          </div>

          <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-[#fb923c]" />
              <p className="text-xs uppercase tracking-widest text-slate-400">Recent Alerts</p>
            </div>
            {(alerts.data ?? []).map((a, i) => (
              <div key={i} className="py-1.5 border-b border-slate-700/30 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-[#fb923c] text-xs font-semibold">{a.rule_type.replace(/_/g, ' ')}</span>
                  <span className="text-slate-500 text-xs">{timeAgo(a.timestamp)}</span>
                </div>
                <p className="text-slate-400 text-xs truncate">{a.service_name}</p>
              </div>
            ))}
            {(alerts.data ?? []).length === 0 && (
              <p className="text-xs text-slate-500">No alerts in the last 30 minutes</p>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function TVPage() {
  const search = useSearch({ from: '/tv' }) as { project_id?: string }
  const [authenticated, setAuthenticated] = React.useState(false)
  const [activeProjectId, setActiveProjectId] = React.useState<string>(search.project_id ?? '')
  const [profileName, setProfileName] = React.useState<string>('')

  // Check existing tokens on mount
  React.useEffect(() => {
    const { access, expiresAt, profileName: pn } = getWbTokens()
    if (pn) setProfileName(pn)
    if (access && Date.now() < expiresAt) {
      setAuthenticated(true)
      return
    }
    // Try silent refresh
    refreshAccessToken().then(tok => {
      if (tok) setAuthenticated(true)
    })
  }, [])

  // Project filter override via URL
  React.useEffect(() => {
    if (search.project_id) setActiveProjectId(search.project_id)
  }, [search.project_id])

  if (!authenticated) {
    return <ActivationScreen onActivated={(pn) => { setAuthenticated(true); setProfileName(pn) }} />
  }

  return (
    <div className="relative">
      <TVDashboard projectId={activeProjectId} onProjectChange={setActiveProjectId} profileName={profileName} />
      <button
        onClick={() => { clearWbTokens(); setAuthenticated(false) }}
        className="fixed bottom-4 right-4 text-xs text-slate-600 hover:text-slate-400 transition-colors"
      >
        Disconnect
      </button>
    </div>
  )
}
