import { useQuery } from '@tanstack/react-query'
import { ListAudit } from '@/http/audit/list'
import { getAuditStats } from '@/http/audit/stats'
import { getAuditDetail } from '@/http/audit/details'
import { getSessions, type SessionFilters } from '@/http/audit/sessions'
import type { Session } from '@/http/audit/sessions'

export function useAuditList(page: number, limit: number, projectId?: string | null, filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['audit', page, projectId, filters],
    queryFn: () => ListAudit({ page, limit, projectId: projectId ?? undefined, ...filters }),
    refetchInterval: 60_000,
  })
}

export function useAuditStats(projectId?: string | null) {
  return useQuery({
    queryKey: ['audit-stats', projectId],
    queryFn: () => getAuditStats(projectId),
    refetchInterval: 60_000,
  })
}

export function useAuditSessions(filters?: SessionFilters) {
  return useQuery({
    queryKey: ['audit-sessions', filters],
    queryFn: () => getSessions(filters),
  })
}

export function useAuditDetail(id: string | null) {
  return useQuery({
    queryKey: ['audit-detail', id],
    queryFn: () => getAuditDetail(id!),
    enabled: !!id,
  })
}

export function useSessionTimeline(session: Session | null, projectId?: string | null) {
  return useQuery({
    queryKey: ['session-timeline', session?.identifier, session?.service_name, session?.session_start, projectId],
    queryFn: () => ListAudit({
      identifier: session!.identifier,
      service_name: session!.service_name,
      start_date: session!.session_start,
      end_date: session!.session_end,
      limit: 500,
      projectId: projectId ?? undefined,
    }),
    enabled: !!session,
  })
}
