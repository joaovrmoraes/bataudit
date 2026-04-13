import { useQuery } from '@tanstack/react-query'
import { ListAudit } from '@/http/audit/list'
import { getAuditStats } from '@/http/audit/stats'
import { getAuditDetail } from '@/http/audit/details'
import { getSessions, getSessionByID, type SessionFilters } from '@/http/audit/sessions'
import { getOrphans, type OrphanFilters } from '@/http/audit/orphans'
import { getInsights, getAffectedUsers } from '@/http/audit/insights'
import type { Session } from '@/http/audit/sessions'

export function useAuditList(page: number, limit: number, projectId?: string | null, filters?: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ['audit', page, projectId, filters],
    queryFn: () => ListAudit({ page, limit, projectId: projectId ?? undefined, ...filters }),
    refetchInterval: 60_000,
  })
}

export function useAuditStats(projectId?: string | null, environment?: string | null) {
  return useQuery({
    queryKey: ['audit-stats', projectId, environment],
    queryFn: () => getAuditStats(projectId, environment),
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

export function useAnomalyAlerts(projectId?: string | null, environment?: string | null) {
  const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
  sinceDate.setMinutes(0, 0, 0) // truncate to hour so queryKey is stable across renders
  const since = sinceDate.toISOString()
  return useQuery({
    queryKey: ['anomaly-alerts', projectId, environment, since],
    queryFn: () => ListAudit({
      event_type: 'system.alert',
      projectId: projectId ?? undefined,
      environment: environment ?? undefined,
      start_date: since,
      limit: 100,
    }),
    refetchInterval: 60_000,
  })
}

export function useOrphans(filters?: OrphanFilters) {
  return useQuery({
    queryKey: ['audit-orphans', filters],
    queryFn: () => getOrphans(filters),
    enabled: !!filters?.projectId,
    refetchInterval: 60_000,
  })
}

export function useInsights(projectId?: string | null, period = '7d') {
  return useQuery({
    queryKey: ['insights', projectId, period],
    queryFn: () => getInsights(projectId, period),
    staleTime: 5 * 60_000,
  })
}

export function useSessionByID(sessionID: string | null) {
  return useQuery({
    queryKey: ['session-by-id', sessionID],
    queryFn: () => getSessionByID(sessionID!),
    enabled: !!sessionID,
  })
}

export function useAnomalyRelatedEvents(params: Parameters<typeof ListAudit>[0], enabled = true) {
  return useQuery({
    queryKey: ['anomaly-related', params],
    queryFn: () => ListAudit(params),
    enabled: enabled && !!params?.service_name,
  })
}

export function useAffectedUsers(
  projectId?: string | null,
  path?: string | null,
  method?: string | null,
  start?: string,
  end?: string,
) {
  return useQuery({
    queryKey: ['affected-users', projectId, path, method, start, end],
    queryFn: () => getAffectedUsers(projectId!, path!, method ?? undefined, start, end),
    enabled: !!projectId && !!path,
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
