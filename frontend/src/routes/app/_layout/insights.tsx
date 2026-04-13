import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { BarChart2, TrendingUp, Users, AlertTriangle, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useInsights } from '@/queries/audit'
import { useProject } from '@/lib/project-context'
import React from 'react'

export const Route = createFileRoute('/app/_layout/insights')({
  component: InsightsPage,
})

const PERIODS = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
]

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-[#34d399]/20 text-[#34d399] border-[#34d399]/30',
  POST:   'bg-[#60a5fa]/20 text-[#60a5fa] border-[#60a5fa]/30',
  PUT:    'bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/30',
  DELETE: 'bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30',
  PATCH:  'bg-[#c084fc]/20 text-[#c084fc] border-[#c084fc]/30',
}

function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_COLORS[method] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${cls}`}>
      {method}
    </span>
  )
}

function RankCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <Card className="flex flex-col bg-card border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="flex-1 divide-y divide-border/50">{children}</div>
    </Card>
  )
}

function EmptyRow() {
  return (
    <div className="px-4 py-6 text-center text-xs text-muted-foreground">No data for this period</div>
  )
}

export default function InsightsPage() {
  const { selectedProjectId } = useProject()
  const [period, setPeriod] = React.useState('7d')
  const { data, isLoading } = useInsights(selectedProjectId, period)
  const navigate = useNavigate()

  function goToEvents(filters: Record<string, string>) {
    navigate({ to: '/app', search: (prev) => ({ ...prev, ...filters, page: 1 }), hash: 'events' })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Insights</h1>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-card border-border" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {/* Top Endpoints */}
          <RankCard title="Top Endpoints by Volume" icon={TrendingUp}>
            {!data?.top_endpoints?.length ? <EmptyRow /> : data.top_endpoints.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-sidebar-accent/40 transition-colors"
                onClick={() => goToEvents({ method: row.method, path: row.path })}
                title="View events for this endpoint"
              >
                <span className="w-5 text-right text-xs font-mono text-muted-foreground">{i + 1}</span>
                <MethodBadge method={row.method} />
                <span className="flex-1 truncate text-xs font-mono text-foreground">{row.path}</span>
                <span className="text-xs font-semibold tabular-nums text-foreground">{row.count.toLocaleString()}</span>
              </div>
            ))}
          </RankCard>

          {/* Top Users */}
          <RankCard title="Top Users by Activity" icon={Users}>
            {!data?.top_users?.length ? <EmptyRow /> : data.top_users.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-sidebar-accent/40 transition-colors"
                onClick={() => goToEvents({ identifier: row.identifier })}
                title="View events for this user"
              >
                <span className="w-5 text-right text-xs font-mono text-muted-foreground">{i + 1}</span>
                <div className="flex flex-1 flex-col min-w-0">
                  <span className="truncate text-xs font-medium text-foreground">{row.user_email || row.identifier}</span>
                  {row.user_email && row.identifier !== row.user_email && (
                    <span className="truncate text-[11px] text-muted-foreground">{row.identifier}</span>
                  )}
                </div>
                <span className="text-xs font-semibold tabular-nums text-foreground">{row.count.toLocaleString()}</span>
              </div>
            ))}
          </RankCard>

          {/* Top Error Routes */}
          <RankCard title="Top Routes by Error Rate" icon={AlertTriangle}>
            {!data?.top_error_routes?.length ? <EmptyRow /> : data.top_error_routes.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-sidebar-accent/40 transition-colors"
                onClick={() => goToEvents({ method: row.method, path: row.path })}
                title="View error events for this route"
              >
                <span className="w-5 text-right text-xs font-mono text-muted-foreground">{i + 1}</span>
                <MethodBadge method={row.method} />
                <span className="flex-1 truncate text-xs font-mono text-foreground">{row.path}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{row.error_count.toLocaleString()} err</span>
                  <Badge className="bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30 text-[10px] px-1.5 py-0">
                    {row.error_rate.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ))}
          </RankCard>

          {/* Top Slow Routes */}
          <RankCard title="Top Routes by Response Time" icon={Clock}>
            {!data?.top_slow_routes?.length ? <EmptyRow /> : data.top_slow_routes.map((row, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-sidebar-accent/40 transition-colors"
                onClick={() => goToEvents({ method: row.method, path: row.path, sort_by: 'response_time', sort_order: 'desc' })}
                title="View slowest events for this route"
              >
                <span className="w-5 text-right text-xs font-mono text-muted-foreground">{i + 1}</span>
                <MethodBadge method={row.method} />
                <span className="flex-1 truncate text-xs font-mono text-foreground">{row.path}</span>
                <span className="text-xs font-semibold tabular-nums text-foreground">{Math.round(row.avg_ms).toLocaleString()}ms</span>
              </div>
            ))}
          </RankCard>

        </div>
      )}
    </div>
  )
}
