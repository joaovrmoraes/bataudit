import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMonitor,
  deleteMonitor,
  listMonitorHistory,
  listMonitors,
  testMonitor,
  updateMonitor,
} from '@/http/healthcheck'

export function useMonitors(projectId?: string) {
  return useQuery({
    queryKey: ['monitors', projectId ?? 'all'],
    queryFn: () => listMonitors(projectId),
    staleTime: 30_000,
  })
}

export function useCreateMonitor(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createMonitor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitors', projectId] }),
  })
}

export function useUpdateMonitor(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Parameters<typeof updateMonitor>[1] & { id: string }) =>
      updateMonitor(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitors', projectId] }),
  })
}

export function useDeleteMonitor(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteMonitor,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitors', projectId] }),
  })
}

export function useTestMonitor() {
  return useMutation({ mutationFn: testMonitor })
}

export function useMonitorHistory(monitorId: string | null) {
  return useQuery({
    queryKey: ['monitor-history', monitorId],
    queryFn: () => listMonitorHistory(monitorId!),
    enabled: !!monitorId,
    staleTime: 10_000,
  })
}
