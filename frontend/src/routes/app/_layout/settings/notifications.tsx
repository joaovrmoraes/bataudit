import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Bell, Webhook, Plus, Trash2, TestTube2, ChevronDown, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useProject } from '@/lib/project-context'
import { useVapidPublicKey, useSubscribePush, useUnsubscribePush, useWebhooks, useCreateWebhook, useDeleteWebhook, useTestWebhook, useDeliveries } from '@/queries/notifications'
import type { Delivery, WebhookChannel } from '@/http/notifications'

export const Route = createFileRoute('/app/_layout/settings/notifications')({
  component: NotificationsPage,
})

// ── Push section ──────────────────────────────────────────────────────────────

const PUSH_CHANNEL_KEY = 'bat_push_channel_id'

function PushSection({ projectId }: { projectId: string }) {
  const { data: vapidKey } = useVapidPublicKey()
  const [pushStatus, setPushStatus] = React.useState<'idle' | 'active' | 'error'>('idle')
  const [channelId, setChannelId] = React.useState<string | null>(null)
  const [errorMsg, setErrorMsg] = React.useState('')
  const subscribe = useSubscribePush(projectId)
  const unsubscribe = useUnsubscribePush(projectId)

  // Detect existing subscription on mount
  React.useEffect(() => {
    const stored = localStorage.getItem(`${PUSH_CHANNEL_KEY}:${projectId}`)
    if (!stored) return
    navigator.serviceWorker?.getRegistration('/sw.js').then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        setChannelId(stored)
        setPushStatus('active')
      } else {
        localStorage.removeItem(`${PUSH_CHANNEL_KEY}:${projectId}`)
      }
    })
  }, [projectId])

  async function handleEnable() {
    setErrorMsg('')
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setErrorMsg('Push notifications are not supported in this browser.')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setErrorMsg('Notification permission denied.')
        return
      }
      if (!vapidKey) {
        setErrorMsg('VAPID key not available.')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const channel = await subscribe.mutateAsync(sub)
      setChannelId(channel.id)
      localStorage.setItem(`${PUSH_CHANNEL_KEY}:${projectId}`, channel.id)
      setPushStatus('active')
    } catch (e) {
      setErrorMsg(String(e))
      setPushStatus('error')
    }
  }

  async function handleDisable() {
    if (!channelId) return
    try {
      await unsubscribe.mutateAsync(channelId)
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      await sub?.unsubscribe()
      localStorage.removeItem(`${PUSH_CHANNEL_KEY}:${projectId}`)
      setPushStatus('idle')
      setChannelId(null)
    } catch (e) {
      setErrorMsg(String(e))
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Bell className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">Browser Push Notifications</h3>
          <p className="text-sm text-muted-foreground">
            Receive alerts in this browser even when the tab is in the background.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {pushStatus === 'active' ? (
          <>
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20">Active</Badge>
            <Button variant="outline" size="sm" onClick={handleDisable} disabled={unsubscribe.isPending}>
              Disable
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={handleEnable} disabled={subscribe.isPending}>
            Enable notifications
          </Button>
        )}
        {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
      </div>
    </Card>
  )
}

// ── Delivery history ──────────────────────────────────────────────────────────

function DeliveryHistory({ webhookId }: { webhookId: string }) {
  const { data: deliveries = [] } = useDeliveries(webhookId)

  return (
    <div className="mt-2 space-y-1">
      {deliveries.length === 0 && (
        <p className="text-xs text-muted-foreground px-2">No deliveries yet.</p>
      )}
      {deliveries.map((d: Delivery) => (
        <div key={d.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-card/50">
          {d.status === 'success' ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          )}
          <span className="font-mono text-muted-foreground">
            {new Date(d.delivered_at).toLocaleString()}
          </span>
          {d.status_code != null && (
            <Badge variant="outline" className="text-xs py-0">
              {d.status_code}
            </Badge>
          )}
          {d.response_body && (
            <span className="truncate text-muted-foreground max-w-xs">{d.response_body}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Webhook row ───────────────────────────────────────────────────────────────

function WebhookRow({
  webhook,
  projectId,
}: {
  webhook: WebhookChannel
  projectId: string
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [testResult, setTestResult] = React.useState<string | null>(null)
  const deleteWebhook = useDeleteWebhook(projectId)
  const testWebhook = useTestWebhook(projectId)

  async function handleTest() {
    setTestResult(null)
    try {
      const r = await testWebhook.mutateAsync(webhook.id)
      setTestResult(`HTTP ${r.status_code} — ${r.response || 'OK'}`)
    } catch (e) {
      setTestResult(`Error: ${String(e)}`)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 p-3">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="font-mono text-sm flex-1 truncate">{webhook.config.url}</span>
        {webhook.config.secret && (
          <Badge variant="outline" className="text-xs">HMAC</Badge>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testWebhook.isPending}
          className="gap-1"
        >
          <TestTube2 className="h-3.5 w-3.5" />
          Test
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteWebhook.mutate(webhook.id)}
          disabled={deleteWebhook.isPending}
          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {testResult && (
        <div className="px-4 pb-2 text-xs text-muted-foreground">{testResult}</div>
      )}
      {expanded && <DeliveryHistory webhookId={webhook.id} />}
    </div>
  )
}

// ── Webhook section ───────────────────────────────────────────────────────────

function WebhookSection({ projectId }: { projectId: string }) {
  const { data: webhooks = [] } = useWebhooks(projectId)
  const createWebhook = useCreateWebhook(projectId)
  const [showForm, setShowForm] = React.useState(false)
  const [url, setUrl] = React.useState('')
  const [secret, setSecret] = React.useState('')
  const [formError, setFormError] = React.useState('')

  async function handleCreate() {
    setFormError('')
    if (!url.startsWith('http')) {
      setFormError('URL must start with http:// or https://')
      return
    }
    try {
      await createWebhook.mutateAsync({ url, secret: secret || undefined })
      setUrl('')
      setSecret('')
      setShowForm(false)
    } catch (e) {
      setFormError(String(e))
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Webhook className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Webhooks</h3>
            <p className="text-sm text-muted-foreground">
              POST alerts to any URL — Discord, Slack, n8n, PagerDuty, etc.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)} className="gap-1">
          <Plus className="h-4 w-4" />
          Add webhook
        </Button>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-lg border border-border p-4 bg-card/50">
          <Input
            placeholder="https://hooks.example.com/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Input
            placeholder="Secret (optional — used for HMAC-SHA256 signature)"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          {formError && <p className="text-sm text-red-400">{formError}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={createWebhook.isPending}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowForm(false); setFormError('') }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {webhooks.map((wh) => (
          <WebhookRow key={wh.id} webhook={wh} projectId={projectId} />
        ))}
        {webhooks.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">No webhooks configured.</p>
        )}
      </div>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function NotificationsPage() {
  const { selectedProjectId } = useProject()

  if (!selectedProjectId) {
    return (
      <div className="p-6 text-muted-foreground">
        Select a project in the header to manage notifications.
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how you receive alerts when anomalies are detected.
        </p>
      </div>
      <PushSection projectId={selectedProjectId} />
      <WebhookSection projectId={selectedProjectId} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}
