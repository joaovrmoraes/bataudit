import { createFileRoute } from '@tanstack/react-router'
import { Database, Archive, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useProject } from '@/lib/project-context'
import { useUsageStat } from '@/queries/tiering'

export const Route = createFileRoute('/app/_layout/settings/retention')({
  component: RetentionPage,
})

function RetentionPage() {
  const { selectedProjectId } = useProject()
  const { data: usage } = useUsageStat(selectedProjectId)

  if (!selectedProjectId) {
    return (
      <div className="p-6 text-muted-foreground">
        Select a project in the header to view retention settings.
      </div>
    )
  }

  const totalRows = (usage?.raw_events ?? 0) + (usage?.hourly_summaries ?? 0) + (usage?.daily_summaries ?? 0)

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Data Retention</h1>
        <p className="text-sm text-muted-foreground mt-1">
          BatAudit automatically tiers old data to keep storage costs low without losing history.
        </p>
      </div>

      {/* Usage */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Storage Usage</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Raw events', value: usage?.raw_events ?? 0, color: '#818cf8', icon: Clock },
            { label: 'Hourly summaries', value: usage?.hourly_summaries ?? 0, color: '#34d399', icon: Archive },
            { label: 'Daily summaries', value: usage?.daily_summaries ?? 0, color: '#60a5fa', icon: Archive },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-border bg-card/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-bold" style={{ color: item.color }}>
                {item.value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">rows</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Total rows: <span className="text-foreground font-medium">{totalRows.toLocaleString()}</span>
        </p>
      </Card>

      {/* Policy */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Archive className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Tiering Policy</h3>
            <p className="text-sm text-muted-foreground">
              Configured via environment variables on the Worker service.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            {
              env: 'TIERING_RAW_DAYS',
              default: '30',
              label: 'Keep raw events for',
              unit: 'days',
              description: 'After this period, events are aggregated into hourly summaries and the raw rows are deleted.',
            },
            {
              env: 'TIERING_HOURLY_DAYS',
              default: '365',
              label: 'Keep hourly summaries for',
              unit: 'days',
              description: 'After this period, hourly summaries are aggregated into daily summaries and deleted.',
            },
            {
              env: 'TIERING_HOUR',
              default: '2',
              label: 'Run aggregation at hour (UTC)',
              unit: '',
              description: 'The UTC hour when the nightly tiering job runs.',
            },
          ].map(row => (
            <div key={row.env} className="rounded-lg border border-border bg-card/50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <p className="text-sm font-medium">{row.label}</p>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <code className="text-xs bg-sidebar px-2 py-1 rounded border border-border">
                    {row.env}={row.default}
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">default: {row.default} {row.unit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Daily summaries are kept indefinitely — you always retain statistical history even after raw data is tiered.
        </p>
      </Card>
    </div>
  )
}
