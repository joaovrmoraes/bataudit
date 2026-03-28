import { authHeader } from '@/lib/auth'

const BASE = import.meta.env.VITE_API_URL ?? ''

export interface WebhookChannel {
  id: string
  project_id: string
  type: 'webhook'
  config: { url: string; secret?: string }
  active: boolean
  created_at: string
}

export interface Delivery {
  id: string
  channel_id: string
  alert_event_id: string
  status: 'success' | 'failed'
  status_code?: number
  response_body?: string
  delivered_at: string
}

// ── Push ──────────────────────────────────────────────────────────────────────

export async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${BASE}/v1/notifications/push/vapid-public-key`, {
    headers: authHeader(),
  })
  if (!res.ok) throw new Error('Failed to fetch VAPID key')
  const data = await res.json()
  return data.public_key as string
}

export async function subscribePush(projectId: string, subscription: PushSubscription): Promise<void> {
  const res = await fetch(`${BASE}/v1/notifications/push/subscribe`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, subscription: subscription.toJSON() }),
  })
  if (!res.ok) throw new Error('Failed to subscribe')
}

export async function unsubscribePush(projectId: string, channelId: string): Promise<void> {
  const res = await fetch(`${BASE}/v1/notifications/push/subscribe`, {
    method: 'DELETE',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, channel_id: channelId }),
  })
  if (!res.ok) throw new Error('Failed to unsubscribe')
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export async function listWebhooks(projectId: string): Promise<WebhookChannel[]> {
  const res = await fetch(
    `${BASE}/v1/notifications/webhooks?project_id=${encodeURIComponent(projectId)}`,
    { headers: authHeader() },
  )
  if (!res.ok) throw new Error('Failed to list webhooks')
  return res.json()
}

export async function createWebhook(
  projectId: string,
  url: string,
  secret?: string,
): Promise<WebhookChannel> {
  const res = await fetch(`${BASE}/v1/notifications/webhooks`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, url, secret }),
  })
  if (!res.ok) throw new Error('Failed to create webhook')
  return res.json()
}

export async function deleteWebhook(projectId: string, webhookId: string): Promise<void> {
  const res = await fetch(
    `${BASE}/v1/notifications/webhooks/${webhookId}?project_id=${encodeURIComponent(projectId)}`,
    { method: 'DELETE', headers: authHeader() },
  )
  if (!res.ok) throw new Error('Failed to delete webhook')
}

export async function testWebhook(
  projectId: string,
  webhookId: string,
): Promise<{ status_code: number; response: string }> {
  const res = await fetch(
    `${BASE}/v1/notifications/webhooks/${webhookId}/test?project_id=${encodeURIComponent(projectId)}`,
    { method: 'POST', headers: authHeader() },
  )
  if (!res.ok) throw new Error('Webhook test failed')
  return res.json()
}

export async function listDeliveries(webhookId: string): Promise<Delivery[]> {
  const res = await fetch(`${BASE}/v1/notifications/webhooks/${webhookId}/deliveries`, {
    headers: authHeader(),
  })
  if (!res.ok) throw new Error('Failed to list deliveries')
  return res.json()
}
