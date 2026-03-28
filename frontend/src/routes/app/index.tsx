import React from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { RefreshCw, AlertCircle, Filter, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAuditList, useAuditStats } from '@/queries/audit'
import { useProject } from '@/lib/project-context'
import { AppPagination } from '@/components/app-pagination'
import { EventDetailModal } from './components/event-detail-modal'

// --- Route search params (filtros persistidos na URL) ---
const searchSchema = z.object({
  page: z.number().optional().default(1),
  service_name: z.string().optional(),
  method: z.string().optional(),
  status_code: z.string().optional(),
  environment: z.string().optional(),
  identifier: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  sort_by: z.enum(['timestamp', 'status_code', 'response_time']).optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
})

export const Route = createFileRoute('/app/')({
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
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(ts).toLocaleDateString()
}

// --- Main component ---
function RouteComponent() {
  const navigate = useNavigate({ from: '/app/' })
  const search = useSearch({ from: '/app/' })
  const { selectedProjectId } = useProject()

  const [filterOpen, setFilterOpen] = React.useState(false)
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null)
  const [sortCol, setSortCol] = React.useState<string>('requests')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc')

  const limit = 50
  const page = search.page ?? 1
  const activeFilters = {
    service_name: search.service_name,
    method: search.method,
    status_code: search.status_code,
    environment: search.environment,
    identifier: search.identifier,
    start_date: search.start_date,
    end_date: search.end_date,
    sort_by: search.sort_by,
    sort_order: search.sort_order,
  }

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useAuditStats(selectedProjectId)
  const { data: auditList, isError: auditError, refetch: refetchList } = useAuditList(page, limit, selectedProjectId, activeFilters)

  function refresh() {
    refetchStats()
    refetchList()
  }

  function setFilter(key: string, value: string) {
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, [key]: value || undefined, page: 1 }) })
  }

  function clearFilters() {
    navigate({ search: { page: 1 } })
  }

  function toggleSort(col: 'timestamp' | 'status_code' | 'response_time') {
    const currentCol = search.sort_by ?? 'timestamp'
    const currentDir = search.sort_order ?? 'desc'
    const newDir = currentCol === col && currentDir === 'desc' ? 'asc' : 'desc'
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, sort_by: col, sort_order: newDir, page: 1 }) })
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Events', value: statsLoading ? '…' : (stats?.total ?? 0).toLocaleString(), color: '#818cf8' },
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
          { label: 'Active Services', value: statsLoading ? '…' : `${stats?.active_services ?? 0}`, color: '#34d399' },
        ].map(card => (
          <Card key={card.label} className="p-4 border-border/50 bg-card/60 space-y-1">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
            {card.sub && <p className="text-xs" style={{ color: card.color }}>{card.sub}</p>}
          </Card>
        ))}
      </div>

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

      {/* 6.4 Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left — charts */}
        <div className="space-y-4">
          {/* Area chart — timeline */}
          <Card className="p-4 border-border/50 bg-card/60 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Events / hour (last 24h)</p>
            <ResponsiveContainer width="100%" height={140}>
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

          {/* Stacked bar — status classes */}
          <Card className="p-4 border-border/50 bg-card/60 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Status distribution</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={[{ name: 'Status', ...Object.fromEntries(statusData.map(s => [s.name, s.value])) }]}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2d3350', fontSize: 12 }} />
                {statusData.map(s => (
                  <Bar key={s.name} dataKey={s.name} stackId="a" fill={s.color} />
                ))}
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

          {/* Donut — methods */}
          <Card className="p-4 border-border/50 bg-card/60 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Methods</p>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={methodData} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={44} strokeWidth={0}>
                    {methodData.map(entry => (
                      <Cell key={entry.name} fill={METHOD_COLORS[entry.name] ?? '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2d3350', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1">
                {methodData.map(entry => (
                  <span key={entry.name} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: METHOD_COLORS[entry.name] ?? '#64748b' }} />
                    {entry.name}: {entry.value.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Right — event feed */}
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
            </div>
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
                <select
                  className="rounded-md border border-input bg-background px-3 py-1 text-xs h-8"
                  value={search.environment ?? ''}
                  onChange={e => setFilter('environment', e.target.value)}
                >
                  <option value="">All environments</option>
                  {['production', 'staging', 'development', 'testing', 'local'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
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
            <div className="max-h-[600px] overflow-y-auto pr-1">
              {/* Sort header */}
              <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground border-b border-border/40 mb-1 sticky top-0 bg-background/80 backdrop-blur-sm z-10">
                {(['timestamp', 'status_code', 'response_time'] as const).map(col => {
                  const labels: Record<string, string> = { timestamp: 'Time', status_code: 'Status', response_time: 'Time(ms)' }
                  const isActive = (search.sort_by ?? 'timestamp') === col
                  return (
                    <button
                      key={col}
                      onClick={() => toggleSort(col)}
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
                    <Badge variant="outline" className={`text-xs font-mono shrink-0 ${methodColor(event.method)}`}>
                      {event.method}
                    </Badge>
                    <span className="text-xs text-foreground font-mono flex-1 truncate">{event.path}</span>
                    <Badge variant="outline" className={`text-xs font-mono shrink-0 ${statusColor(event.status_code)}`}>
                      {event.status_code}
                    </Badge>
                    <span className="text-xs text-muted-foreground w-14 text-right shrink-0">
                      {event.response_time}ms
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AppPagination page={page} totalPages={totalPages} setPage={p => navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, page: p }) })} />
        </div>
      </div>

      {/* 6.6 Event detail modal */}
      <EventDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
    </div>
  )
}
