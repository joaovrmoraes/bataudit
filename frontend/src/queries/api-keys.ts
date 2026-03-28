import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAPIKeys, createAPIKey, revokeAPIKey } from '@/http/api-keys/index'

export function useAPIKeys(projectId: string | null) {
  return useQuery({
    queryKey: ['api-keys', projectId],
    queryFn: () => listAPIKeys(projectId!),
    enabled: !!projectId,
  })
}

export function useCreateAPIKey(projectId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, name }: { projectId: string; name: string }) =>
      createAPIKey(projectId, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys', projectId] }),
  })
}

export function useRevokeAPIKey(projectId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: revokeAPIKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys', projectId] }),
  })
}
