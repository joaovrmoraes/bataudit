import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAnomalyAlerts } from '@/queries/audit'
import { useProject } from '@/lib/project-context'

export const Route = createFileRoute('/app/anomalies')({
  component: AnomaliesPage,
})

const RULE_LABELS: Record<string, { label: string; color: string }> = {
  volume_spike:   { label: 'Volume Spike',    color: 'bg-[#818cf8]/20 text-[#818cf8]' },
  error_rate:     { label: 'Error Rate',       color: 'bg-[#f87171]/20 text-[#f87171]' },
  brute_force:    { label: 'Brute Force',      color: 'bg-[#fb923c]/20 text-[#fb923c]' },
  silent_service: { label: 'Silent Service',   color: 'bg-[#fbbf24]/20 text-[#fbbf24]' },
  mass_delete:    { label: 'Mass Delete',      color: 'bg-[#f87171]/20 text-[#f87171]' },
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function AnomaliesPage() {
  const { selectedProjectId } = useProject()
  const { data, isLoading } = useAnomalyAlerts(selectedProjectId)

  const alerts = data?.data ?? []

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 text-[#f87171]" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Anomaly Alerts</h1>
          <p className="text-sm text-muted-foreground">Last 24 hours</p>
        </div>
        {alerts.length > 0 && (
          <Badge className="ml-auto bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}

      {!isLoading && alerts.length === 0 && (
        <Card className="p-12 text-center border-border/50">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No anomalies detected in the last 24 hours.</p>
        </Card>
      )}

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => {
            const rule = RULE_LABELS[alert.path] ?? { label: alert.path, color: 'bg-muted text-muted-foreground' }
            return (
              <Card key={alert.id} className="p-4 border-border/50 bg-card">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <AlertTriangle className="h-4 w-4 text-[#f87171] shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={rule.color + ' border-0 text-xs'}>
                          {rule.label}
                        </Badge>
                        <span className="text-sm font-medium text-foreground truncate">
                          {alert.service_name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Project: {alert.project_id ?? '—'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTime(alert.timestamp)}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
