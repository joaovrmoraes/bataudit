import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Activity, Plus, Trash2, TestTube2, Pencil, CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useProject } from '@/lib/project-context'
import {
  useMonitors,
  useCreateMonitor,
  useUpdateMonitor,
  useDeleteMonitor,
  useTestMonitor,
  useMonitorHistory,
} from '@/queries/healthcheck'
import type { Monitor, MonitorResult } from '@/http/healthcheck'

export const Route = createFileRoute('/app/_layout/settings/healthcheck')({
  component: HealthcheckPage,
})

function StatusBadge({ status }: { status: Monitor['last_status'] }) {
  if (status === 'up')
    return (
      <Badge className="bg-[#34d399]/20 text-[#34d399] border-[#34d399]/30 gap-1">
        <CheckCircle2 className="h-3 w-3" /> UP
      </Badge>
    )
  if (status === 'down')
    return (
      <Badge className="bg-[#f87171]/20 text-[#f87171] border-[#f87171]/30 gap-1">
        <XCircle className="h-3 w-3" /> DOWN
      </Badge>
    )
  return <Badge variant="outline" className="text-muted-foreground gap-1"><Clock className="h-3 w-3" /> Unknown</Badge>
}

function relativeTime(ts: string | null) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

function HistoryRow({ result }: { result: MonitorResult }) {
  const isUp = result.status === 'up'
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 text-xs">
      {isUp
        ? <CheckCircle2 className="h-3 w-3 text-[#34d399] shrink-0" />
        : <XCircle className="h-3 w-3 text-[#f87171] shrink-0" />}
      <span className="text-muted-foreground w-24 shrink-0">{relativeTime(result.checked_at)}</span>
      {result.status_code != null && (
        <span className="font-mono text-muted-foreground">{result.status_code}</span>
      )}
      {result.response_ms != null && (
        <span className="text-muted-foreground ml-auto">{result.response_ms}ms</span>
      )}
      {result.error && <span className="text-[#f87171] truncate max-w-[200px]">{result.error}</span>}
    </div>
  )
}

function MonitorRow({
  monitor,
  projectId,
  onEdit,
}: {
  monitor: Monitor
  projectId: string
  onEdit: (m: Monitor) => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const { data: history } = useMonitorHistory(expanded ? monitor.id : null)
  const testMutation = useTestMonitor()
  const deleteMutation = useDeleteMonitor(projectId)
  const updateMutation = useUpdateMonitor(projectId)
  const [testResult, setTestResult] = React.useState<MonitorResult | null>(null)

  async function handleTest() {
    setTestResult(null)
    const result = await testMutation.mutateAsync(monitor.id)
    setTestResult(result)
  }

  return (
    <div className="border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <StatusBadge status={monitor.last_status} />

        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{monitor.name}</span>
          <span className="text-xs text-muted-foreground font-mono truncate">{monitor.url}</span>
        </div>

        <span className="text-xs text-muted-foreground hidden sm:block whitespace-nowrap">
          every {monitor.interval_seconds}s · {relativeTime(monitor.last_checked_at)}
        </span>

        <button
          onClick={() => updateMutation.mutate({ id: monitor.id, enabled: !monitor.enabled })}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title={monitor.enabled ? 'Disable — pauses all checks for this monitor' : 'Enable — resume periodic checks'}
        >
          {monitor.enabled
            ? <ToggleRight className="h-5 w-5 text-[#34d399]" />
            : <ToggleLeft className="h-5 w-5" />}
        </button>

        <button
          onClick={() => onEdit(monitor)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Edit monitor settings"
        >
          <Pencil className="h-4 w-4" />
        </button>

        <button
          onClick={handleTest}
          disabled={testMutation.isPending}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="Run an immediate check and see the result"
        >
          <TestTube2 className="h-4 w-4" />
        </button>

        <button
          onClick={() => deleteMutation.mutate(monitor.id)}
          className="text-muted-foreground hover:text-[#f87171] transition-colors"
          title="Delete this monitor permanently"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {testResult && (
        <div className="mx-4 mb-2 rounded border border-border/50 bg-card/40 px-3 py-2 text-xs">
          <span className="font-semibold mr-2">Test result:</span>
          <StatusBadge status={testResult.status} />
          {testResult.status_code != null && (
            <span className="ml-2 text-muted-foreground">HTTP {testResult.status_code}</span>
          )}
          {testResult.response_ms != null && (
            <span className="ml-2 text-muted-foreground">{testResult.response_ms}ms</span>
          )}
          {testResult.error && (
            <span className="ml-2 text-[#f87171]">{testResult.error}</span>
          )}
        </div>
      )}

      {expanded && (
        <div className="mx-4 mb-2 rounded border border-border/50 bg-card/40 divide-y divide-border/30">
          {!history?.length ? (
            <p className="px-3 py-4 text-xs text-center text-muted-foreground">No history yet</p>
          ) : (
            history.map(r => <HistoryRow key={r.id} result={r} />)
          )}
        </div>
      )}
    </div>
  )
}

const EMPTY_FORM = {
  name: '',
  url: '',
  interval_seconds: 60,
  timeout_seconds: 10,
  expected_status: 200,
}

function MonitorForm({
  projectId,
  initial,
  onClose,
}: {
  projectId: string
  initial?: Monitor
  onClose: () => void
}) {
  const createMutation = useCreateMonitor(projectId)
  const updateMutation = useUpdateMonitor(projectId)
  const [form, setForm] = React.useState(
    initial
      ? {
          name: initial.name,
          url: initial.url,
          interval_seconds: initial.interval_seconds,
          timeout_seconds: initial.timeout_seconds,
          expected_status: initial.expected_status,
        }
      : EMPTY_FORM,
  )
  const [error, setError] = React.useState('')

  function field(key: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [key]: key === 'name' || key === 'url' ? e.target.value : Number(e.target.value) }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (initial) {
        await updateMutation.mutateAsync({ id: initial.id, ...form })
      } else {
        await createMutation.mutateAsync({ project_id: projectId, ...form })
      }
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Error')
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <form onSubmit={submit} className="space-y-3 p-4 border-t border-border/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Name</label>
          <Input value={form.name} onChange={field('name')} placeholder="API Health" required className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">URL</label>
          <Input value={form.url} onChange={field('url')} placeholder="https://api.example.com/health" required className="h-8 text-sm font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Interval (seconds)</label>
          <Input type="number" value={form.interval_seconds} onChange={field('interval_seconds')} min={10} max={3600} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Timeout (seconds)</label>
          <Input type="number" value={form.timeout_seconds} onChange={field('timeout_seconds')} min={1} max={30} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Expected status code</label>
          <Input type="number" value={form.expected_status} onChange={field('expected_status')} min={100} max={599} className="h-8 text-sm" />
        </div>
      </div>

      {error && <p className="text-xs text-[#f87171]">{error}</p>}

      <div className="flex items-center gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Saving…' : initial ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

export default function HealthcheckPage() {
  const { selectedProjectId } = useProject()
  const projectId = selectedProjectId ?? ''
  const { data: monitors = [], isLoading } = useMonitors(projectId || undefined)
  const [showForm, setShowForm] = React.useState(false)
  const [editing, setEditing] = React.useState<Monitor | null>(null)

  if (!selectedProjectId) {
    return (
      <div className="flex flex-col gap-6 p-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold text-foreground">Healthcheck Monitors</h1>
        </div>
        <div className="rounded-lg border border-border/50 bg-card/60 px-6 py-10 text-center text-sm text-muted-foreground">
          Select a project in the header to manage healthcheck monitors.
        </div>
      </div>
    )
  }

  function handleEdit(m: Monitor) {
    setEditing(m)
    setShowForm(false)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">Healthcheck Monitors</h1>
            <p className="text-xs text-muted-foreground">BatAudit pings your URLs and notifies on status changes.</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => { setEditing(null); setShowForm(v => !v) }}
          disabled={monitors.length >= 10}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add monitor
        </Button>
      </div>

      <Card className="border-border bg-card overflow-hidden">
        {showForm && !editing && (
          <MonitorForm projectId={projectId} onClose={closeForm} />
        )}

        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Loading…</div>
        ) : monitors.length === 0 && !showForm ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No monitors yet. Add one to start tracking uptime.
          </div>
        ) : (
          monitors.map(m => (
            <React.Fragment key={m.id}>
              <MonitorRow monitor={m} projectId={projectId} onEdit={handleEdit} />
              {editing?.id === m.id && (
                <MonitorForm projectId={projectId} initial={editing} onClose={closeForm} />
              )}
            </React.Fragment>
          ))
        )}

        {monitors.length >= 10 && (
          <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border/50">
            Maximum of 10 monitors per project reached.
          </p>
        )}
      </Card>
    </div>
  )
}
