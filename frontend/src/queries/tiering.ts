import { useQuery } from '@tanstack/react-query'
import { getAuditHistory, getUsageStat } from '../http/tiering'

export function useAuditHistory(
  projectId: string | null | undefined,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: ['audit-history', projectId, startDate, endDate],
    queryFn: () => getAuditHistory(projectId!, startDate, endDate),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  })
}

export function useUsageStat(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['usage-stat', projectId],
    queryFn: () => getUsageStat(projectId!),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  })
}
