import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWebhook,
  deleteWebhook,
  getVapidPublicKey,
  listDeliveries,
  listWebhooks,
  subscribePush,
  testWebhook,
  unsubscribePush,
} from '../http/notifications'

// ── Push ──────────────────────────────────────────────────────────────────────

export function useVapidPublicKey() {
  return useQuery({
    queryKey: ['vapid-public-key'],
    queryFn: getVapidPublicKey,
    staleTime: Infinity,
  })
}

export function useSubscribePush(projectId: string) {
  return useMutation({
    mutationFn: (subscription: PushSubscription): Promise<{ id: string }> =>
      subscribePush(projectId, subscription),
  })
}

export function useUnsubscribePush(projectId: string) {
  return useMutation({
    mutationFn: (channelId: string) => unsubscribePush(projectId, channelId),
  })
}

// ── Webhooks ──────────────────────────────────────────────────────────────────

export function useWebhooks(projectId: string) {
  return useQuery({
    queryKey: ['webhooks', projectId],
    queryFn: () => listWebhooks(projectId),
    enabled: !!projectId,
  })
}

export function useCreateWebhook(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ url, secret }: { url: string; secret?: string }) =>
      createWebhook(projectId, url, secret),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks', projectId] }),
  })
}

export function useDeleteWebhook(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (webhookId: string) => deleteWebhook(projectId, webhookId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks', projectId] }),
  })
}

export function useTestWebhook(projectId: string) {
  return useMutation({
    mutationFn: (webhookId: string) => testWebhook(projectId, webhookId),
  })
}

export function useDeliveries(webhookId: string) {
  return useQuery({
    queryKey: ['deliveries', webhookId],
    queryFn: () => listDeliveries(webhookId),
    enabled: !!webhookId,
  })
}
