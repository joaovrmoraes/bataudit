import React from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { RefreshCw, AlertCircle, Filter, X, ChevronUp, ChevronDown, ShieldAlert, Download, Unlink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAuditList, useAuditStats, useAnomalyAlerts, useOrphans } from '@/queries/audit'
import { useAuditHistory } from '@/queries/tiering'
import { useProject } from '@/lib/project-context'
import { useEnvironment } from '@/lib/environment-context'
import { getToken } from '@/lib/auth'
import { AppPagination } from '@/components/app-pagination'
import { EventDetailModal } from '../components/event-detail-modal'

// --- Route search params (filtros persistidos na URL) ---
const searchSchema = z.object({
  page: z.number().optional().default(1),
  service_name: z.string().optional(),
  method: z.string().optional(),
  status_code: z.string().optional(),
  identifier: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  sort_by: z.enum(['timestamp', 'status_code', 'response_time']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
})

export const Route = createFileRoute('/app/_layout/')({
  validateSearch: searchSchema,
  component: RouteComponent,
})

// --- Helpers ---
function statusColor(code: number) {
  if (code >= 500) return 'text-[#f87171] border-[#f87171]/40'
  if (code >= 400) return 'text-[#fb923c] border-[#fb923c]/40'
  if (code >= 300) return 'text-[#60a5fa] border-[#60a5fa]/40'
  return 'text-[#34d399] border-[#34d399]/40'
}

function methodColor(method: string) {
  const m: Record<string, string> = {
    GET: 'text-[#34d399] border-[#34d399]/40',
    POST: 'text-[#818cf8] border-[#818cf8]/40',
    PUT: 'text-[#fb923c] border-[#fb923c]/40',
    PATCH: 'text-[#60a5fa] border-[#60a5fa]/40',
    DELETE: 'text-[#f87171] border-[#f87171]/40',
  }
  return m[method.toUpperCase()] ?? 'text-muted-foreground border-border'
}

function errorRateBadge(rate: number) {
  if (rate >= 5) return <Badge className="bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30">{rate.toFixed(1)}%</Badge>
  if (rate >= 1) return <Badge className="bg-[#fb923c]/20 text-[#fb923c] border-[#fb923c]/30">{rate.toFixed(1)}%</Badge>
  return <Badge className="bg-[#34d399]/20 text-[#34d399] border-[#34d399]/30">{rate.toFixed(1)}%</Badge>
}

function timeAgo(ts: string) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 0) return 'just now'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

// --- Main component ---
function RouteComponent() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const { selectedProjectId } = useProject()
  const { selectedEnvironment, setSelectedEnvironment } = useEnvironment()

  const [filterOpen, setFilterOpen] = React.useState(false)
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null)
  const [sortCol, setSortCol] = React.useState<string>('requests')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')
  const [showOrphans, setShowOrphans] = React.useState(false)

  const limit = 50
  const page = search.page ?? 1
  const activeFilters = {
    service_name: search.service_name,
    method: search.method,
    status_code: search.status_code,
    environment: selectedEnvironment ?? undefined,
    identifier: search.identifier,
    start_date: search.start_date,
    end_date: search.end_date,
    sort_by: search.sort_by,
    sort_order: search.sort_order,
  }

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useAuditStats(selectedProjectId, selectedEnvironment)
  const { data: auditList, isError: auditError, refetch: refetchList } = useAuditList(page, limit, selectedProjectId, activeFilters)
  const { data: anomalyData } = useAnomalyAlerts(selectedProjectId, selectedEnvironment)
  const { data: historyData } = useAuditHistory(selectedProjectId, undefined, undefined, selectedEnvironment)
  const since24h = React.useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), [])
  const { data: orphansData } = useOrphans({ projectId: selectedProjectId, start_date: since24h, environment: selectedEnvironment })

  function refresh() {
    refetchStats()
    refetchList()
  }

  function setFilter(key: string, value: string) {
    navigate({ from: Route.fullPath, search: (prev) => ({ ...prev, [key]: value || undefined, page: 1 }) })
  }

  function clearFilters() {
    navigate({ from: Route.fullPath, search: { page: 1 } })
  }

  const [exporting, setExporting] = React.useState(false)
  const [exportOpen, setExportOpen] = React.useState(false)

  async function handleExport(format: 'csv' | 'json') {
    setExporting(true)
    try {
      const base = import.meta.env.VITE_API_URL ?? ''
      const params = new URLSearchParams()
      params.set('format', format)
      if (selectedProjectId) params.set('project_id', selectedProjectId)
      if (activeFilters.service_name) params.set('service_name', activeFilters.service_name)
      if (activeFilters.method) params.set('method', activeFilters.method)
      if (activeFilters.status_code) params.set('status_code', activeFilters.status_code)
      if (activeFilters.environment) params.set('environment', activeFilters.environment)
      if (activeFilters.identifier) params.set('identifier', activeFilters.identifier)
      if (activeFilters.start_date) params.set('start_date', activeFilters.start_date)
      if (activeFilters.end_date) params.set('end_date', activeFilters.end_date)

      const res = await fetch(`${base}/v1/audit/export?${params}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        alert(body.error ?? 'Export failed')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bataudit-export-${new Date().toISOString().slice(0, 10)}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function toggleFeedSort(col: 'timestamp' | 'status_code' | 'response_time') {
    const currentCol = search.sort_by ?? 'timestamp'
    const currentDir = search.sort_order ?? 'desc'
    const newDir = currentCol === col && currentDir === 'desc' ? 'asc' : 'desc'
    navigate({ from: Route.fullPath, search: (prev) => ({ ...prev, sort_by: col, sort_order: newDir, page: 1 }) })
  }

  const hasFilters = Object.values(activeFilters).some(Boolean)
  const totalPages = auditList?.pagination.totalPage ?? 1

  // Sorted breakdown table
  const sortedServices = React.useMemo(() => {
    if (!stats?.by_service) return []
    return [...stats.by_service].sort((a, b) => {
      const key = sortCol as keyof typeof a
      const va = a[key] as number | string
      const vb = b[key] as number | string
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [stats?.by_service, sortCol, sortDir])

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <ChevronDown className="h-3 w-3 opacity-30" />
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  // Pie chart data
  const methodData = stats
    ? Object.entries(stats.by_method).map(([name, value]) => ({ name, value }))
    : []
  const METHOD_COLORS: Record<string, string> = {
    GET: '#34d399', POST: '#818cf8', PUT: '#fb923c', PATCH: '#60a5fa', DELETE: '#f87171',
  }
  const statusData = stats
    ? [
        { name: '2xx', value: stats.by_status_class['2xx'] ?? 0, color: '#34d399' },
        { name: '3xx', value: stats.by_status_class['3xx'] ?? 0, color: '#60a5fa' },
        { name: '4xx', value: stats.by_status_class['4xx'] ?? 0, color: '#fb923c' },
        { name: '5xx', value: stats.by_status_class['5xx'] ?? 0, color: '#f87171' },
      ]
    : []
  const timelineData = (stats?.timeline ?? []).map(p => ({
    hour: new Date(p.hour).getHours() + 'h',
    count: p.count,
  }))

  const historyChartData = (historyData?.data ?? []).map(p => ({
    label: p.period_type === 'day'
      ? new Date(p.period_start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : new Date(p.period_start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' }),
    events: p.event_count,
    errors: p.errors_4xx + p.errors_5xx,
  }))

  return (
    <div className="container mx-auto p-6 space-y-6">

      {/* 6.1 Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {selectedProjectId === null ? 'All Projects' : (stats?.by_service[0]?.service_name ?? 'Dashboard')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {stats?.last_event_at
              ? `Last event: ${timeAgo(stats.last_event_at)}`
              : 'No events yet'}
          </p>
        </div>
        <Button variant="secondary" size="sm" className="gap-2" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* 6.2 Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Events', value: statsLoading ? '…' : (stats?.total ?? 0).toLocaleString(), color: '#818cf8' },
          { label: 'Active Services', value: statsLoading ? '…' : `${stats?.active_services ?? 0}`, color: '#34d399' },
          {
            label: 'Errors 4xx',
            value: statsLoading ? '…' : `${stats?.errors_4xx ?? 0}`,
            sub: stats && stats.total > 0 ? `${((stats.errors_4xx / stats.total) * 100).toFixed(1)}%` : undefined,
            color: '#fb923c',
          },
          {
            label: 'Errors 5xx',
            value: statsLoading ? '…' : `${stats?.errors_5xx ?? 0}`,
            sub: stats && stats.total > 0 ? `${((stats.errors_5xx / stats.total) * 100).toFixed(1)}%` : undefined,
            color: '#f87171',
          },
          { label: 'Avg Response', value: statsLoading ? '…' : `${Math.round(stats?.avg_response_time ?? 0)}ms`, color: '#60a5fa' },
          { label: 'p95 Response', value: statsLoading ? '…' : `${Math.round(stats?.p95_response_time ?? 0)}ms`, color: '#2dd4bf' },
          { label: 'Anomaly Alerts', value: (anomalyData?.pagination.totalItems ?? 0).toString(), color: '#f87171' },
          { label: 'Orphan Requests', value: `${orphansData?.total ?? 0}`, color: '#fb923c' },
        ].map(card => (
          <Card key={card.label} className="p-4 border-border/50 bg-card/60 space-y-1">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            {card.sub && <p className="text-xs" style={{ color: card.color }}>{card.sub}</p>}
          </Card>
        ))}
      </div>

      {/* Orphan events banner */}
      {(orphansData?.total ?? 0) > 0 && (
        <div className="space-y-2">
          <Card className="p-4 border-[#fb923c]/30 bg-[#fb923c]/5 flex items-center gap-3">
            <Unlink className="h-4 w-4 text-[#fb923c] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#fb923c]">
                {orphansData!.total} request{orphansData!.total !== 1 ? 's' : ''} without backend response in the last 24h
              </p>
              <p className="text-xs text-muted-foreground">
                Browser-side events with no matching backend audit — possible crashes, timeouts, or OOM kills.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-[#fb923c] hover:text-[#fb923c] border border-[#fb923c]/30 shrink-0"
              onClick={() => setShowOrphans(v => !v)}
            >
              {showOrphans ? 'Hide' : 'View orphans'}
            </Button>
          </Card>
          {showOrphans && (
            <Card className="border-border/50 bg-card/60 overflow-hidden">
              <div className="px-4 py-2 border-b border-border/40 text-xs text-muted-foreground uppercase tracking-wide">
                Orphan requests (last 24h)
              </div>
              <div className="divide-y divide-border/20">
                {orphansData!.data.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 px-4 py-2 hover:bg-[#232640] cursor-pointer transition-colors text-sm"
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">{event.service_name}</span>
                    <Badge variant="outline" className={`text-xs font-mono shrink-0 ${methodColor(event.method)}`}>
                      {event.method}
                    </Badge>
                    <span className="text-xs text-foreground font-mono flex-1 truncate">{event.path}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{event.identifier}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* 6.3 Breakdown by service */}
      {sortedServices.length > 0 && (
        <Card className="border-border/50 bg-card/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-xs text-muted-foreground uppercase">
                {[
                  { key: 'service_name', label: 'Service' },
                  { key: 'requests', label: 'Requests' },
                  { key: 'errors', label: 'Errors' },
                  { key: 'error_rate', label: 'Error Rate' },
                  { key: 'avg_response_time', label: 'Avg Time' },
                  { key: 'last_event', label: 'Last Event' },
                ].map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left cursor-pointer select-none hover:text-foreground transition-colors"
                    onClick={() => col.key !== 'error_rate' && toggleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.key !== 'error_rate' && <SortIcon col={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedServices.map(svc => {
                const rate = svc.requests > 0 ? (svc.errors / svc.requests) * 100 : 0
                return (
                  <tr
                    key={svc.service_name}
                    className="border-b border-border/20 hover:bg-[#232640] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-foreground">{svc.service_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{svc.requests.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{svc.errors.toLocaleString()}</td>
                    <td className="px-4 py-3">{errorRateBadge(rate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{Math.round(svc.avg_response_time)}ms</td>
                    <td className="px-4 py-3 text-muted-foreground">{timeAgo(svc.last_event)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Charts — full width */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Area chart — timeline */}
        <Card className="p-4 border-border/50 bg-card/60 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Events / hour (last 24h)</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={30} />
              <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2d3350', fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#818cf8" fill="url(#areaGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Area chart — 90-day history */}
        <Card className="p-4 border-border/50 bg-card/60 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Event history (90 days)</p>
          {!selectedProjectId ? (
            <div className="flex items-center justify-center h-[180px] text-xs text-muted-foreground">
              Select a project to view 90-day history
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={historyChartData}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2d3350', fontSize: 12 }} />
                <Area type="monotone" dataKey="events" stroke="#34d399" fill="url(#histGrad)" strokeWidth={2} dot={false} name="Events" />
                <Area type="monotone" dataKey="errors" stroke="#f87171" fill="none" strokeWidth={1.5} dot={false} name="Errors" strokeDasharray="3 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Bar chart — status classes (separate bars) */}
        <Card className="p-4 border-border/50 bg-card/60 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Status distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusData} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={35} />
              <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2d3350', fontSize: 12 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {statusData.map(s => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 flex-wrap">
            {statusData.map(s => (
              <span key={s.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.name}: {s.value.toLocaleString()}
              </span>
            ))}
          </div>
        </Card>

        {/* Methods bar chart */}
        <Card className="p-4 border-border/50 bg-card/60 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Methods</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={methodData.filter(e => e.name)} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} width={35} />
              <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2d3350', fontSize: 12 }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {methodData.filter(e => e.name).map(entry => (
                  <Cell key={entry.name} fill={METHOD_COLORS[entry.name] ?? '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Event feed — full width */}
      <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Event Feed</p>
            <div className="flex items-center gap-2">
              {hasFilters && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={clearFilters}>
                  <X className="h-3 w-3" />
                  Clear filters
                </Button>
              )}
              <Button
                variant={filterOpen ? 'secondary' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setFilterOpen(v => !v)}
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
                {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-[#818cf8]" />}
              </Button>
              <div className="relative">
                <Button variant="outline" size="sm" className="gap-2" disabled={exporting} onClick={() => setExportOpen(v => !v)}>
                  <Download className="h-3.5 w-3.5" />
                  {exporting ? 'Exporting…' : 'Export'}
                </Button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1 flex flex-col z-10 bg-card border border-border rounded-md shadow-lg overflow-hidden min-w-[100px]">
                    <button
                      className="px-3 py-2 text-xs text-left hover:bg-sidebar-accent transition-colors"
                      onClick={() => { handleExport('csv'); setExportOpen(false) }}
                    >
                      CSV
                    </button>
                    <button
                      className="px-3 py-2 text-xs text-left hover:bg-sidebar-accent transition-colors"
                      onClick={() => { handleExport('json'); setExportOpen(false) }}
                    >
                      JSON
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Environment quick-filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { value: null, label: 'All envs' },
              { value: 'production', label: 'production', color: 'text-[#34d399] border-[#34d399]/50 bg-[#34d399]/10' },
              { value: 'staging', label: 'staging', color: 'text-[#60a5fa] border-[#60a5fa]/50 bg-[#60a5fa]/10' },
              { value: 'development', label: 'development', color: 'text-[#818cf8] border-[#818cf8]/50 bg-[#818cf8]/10' },
              { value: 'testing', label: 'testing', color: 'text-[#fb923c] border-[#fb923c]/50 bg-[#fb923c]/10' },
              { value: 'local', label: 'local', color: 'text-muted-foreground border-border/60 bg-muted/30' },
            ] as { value: string | null; label: string; color?: string }[]).map(env => {
              const active = selectedEnvironment === env.value
              return (
                <button
                  key={env.value ?? '__all__'}
                  onClick={() => setSelectedEnvironment(env.value)}
                  className={[
                    'px-2.5 py-0.5 rounded-full border text-xs font-medium transition-colors',
                    active
                      ? (env.value === null ? 'bg-foreground text-background border-foreground' : env.color)
                      : 'text-muted-foreground border-border/40 hover:border-border hover:text-foreground',
                  ].join(' ')}
                >
                  {env.label}
                </button>
              )
            })}
          </div>

          {/* 6.5 Filter panel */}
          {filterOpen && (
            <Card className="p-4 border-border/50 bg-card/60 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Service name" value={search.service_name ?? ''} onChange={e => setFilter('service_name', e.target.value)} className="text-xs h-8" />
                <select
                  className="rounded-md border border-input bg-background px-3 py-1 text-xs h-8"
                  value={search.method ?? ''}
                  onChange={e => setFilter('method', e.target.value)}
                >
                  <option value="">All methods</option>
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <Input placeholder="Status code" value={search.status_code ?? ''} onChange={e => setFilter('status_code', e.target.value)} className="text-xs h-8" />
                <Input placeholder="Identifier" value={search.identifier ?? ''} onChange={e => setFilter('identifier', e.target.value)} className="text-xs h-8" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Start date</p>
                  <Input type="datetime-local" value={search.start_date ?? ''} onChange={e => setFilter('start_date', e.target.value ? new Date(e.target.value).toISOString() : '')} className="text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">End date</p>
                  <Input type="datetime-local" value={search.end_date ?? ''} onChange={e => setFilter('end_date', e.target.value ? new Date(e.target.value).toISOString() : '')} className="text-xs h-8" />
                </div>
              </div>
            </Card>
          )}

          {/* Event list */}
          {auditError ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to load events. Check your connection and try again.
            </div>
          ) : (
            <div className="pr-1">
              {/* Sort header */}
              <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground border-b border-border/40 mb-1 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                {(['timestamp', 'status_code', 'response_time'] as const).map(col => {
                  const labels: Record<string, string> = { timestamp: 'Time', status_code: 'Status', response_time: 'Time(ms)' }
                  const isActive = (search.sort_by ?? 'timestamp') === col
                  return (
                    <button
                      key={col}
                      onClick={() => toggleFeedSort(col)}
                      className={`flex items-center gap-0.5 hover:text-foreground transition-colors ${isActive ? 'text-foreground' : ''} ${col === 'timestamp' ? 'w-16 shrink-0' : col === 'status_code' ? 'shrink-0' : 'w-14 text-right shrink-0 ml-auto'}`}
                    >
                      {labels[col]}
                      {isActive
                        ? (search.sort_order === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                        : null}
                    </button>
                  )
                })}
              </div>
              {auditList?.data.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No events found.</p>
              )}
              <div className="space-y-1">
                {auditList?.data.map(event => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[#232640] cursor-pointer transition-colors text-sm"
                    onClick={() => setSelectedEventId(event.id)}
                  >
                    <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-xs text-muted-foreground w-20 shrink-0 truncate">{event.service_name}</span>
                    {event.event_type === 'system.alert' ? (
                      <Badge className="text-xs font-mono shrink-0 bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30 gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        ALERT
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={`text-xs font-mono shrink-0 ${methodColor(event.method)}`}>
                        {event.method}
                      </Badge>
                    )}
                    <span className="text-xs text-foreground font-mono flex-1 truncate">{event.path}</span>
                    {event.event_type !== 'system.alert' && (
                      <Badge variant="outline" className={`text-xs font-mono shrink-0 ${statusColor(event.status_code)}`}>
                        {event.status_code}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground w-14 text-right shrink-0">
                      {event.response_time ? `${event.response_time}ms` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AppPagination page={page} totalPages={totalPages} setPage={p => navigate({ from: Route.fullPath, search: (prev) => ({ ...prev, page: p }) })} />
        </div>

      <EventDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
    </div>
  )
}
