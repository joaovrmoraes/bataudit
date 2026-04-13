import { useQuery } from '@tanstack/react-query'
import {
  getWbSummary,
  getWbFeed,
  getWbVolume,
  getWbHealth,
  getWbAlerts,
  getWbErrorRoutes,
  getWbProjects,
} from '@/http/wallboard'

const REFETCH = 30_000

export function useWbSummary(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-summary', projectId],
    queryFn: () => getWbSummary(projectId),
    refetchInterval: REFETCH,
    enabled,
  })
}

export function useWbFeed(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-feed', projectId],
    queryFn: () => getWbFeed(projectId),
    refetchInterval: REFETCH,
    enabled,
    select: d => d.data,
  })
}

export function useWbVolume(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-volume', projectId],
    queryFn: () => getWbVolume(projectId),
    refetchInterval: REFETCH,
    enabled,
    select: d => d.data,
  })
}

export function useWbHealth(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-health', projectId],
    queryFn: () => getWbHealth(projectId),
    refetchInterval: REFETCH,
    enabled,
    select: d => d.data,
  })
}

export function useWbAlerts(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-alerts', projectId],
    queryFn: () => getWbAlerts(projectId),
    refetchInterval: REFETCH,
    enabled,
    select: d => d.data,
  })
}

export function useWbErrorRoutes(projectId?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-error-routes', projectId],
    queryFn: () => getWbErrorRoutes(projectId),
    refetchInterval: REFETCH,
    enabled,
    select: d => d.data,
  })
}

export function useWbProjects(enabled = true) {
  return useQuery({
    queryKey: ['wb-projects'],
    queryFn: () => getWbProjects(),
    refetchInterval: 60_000,
    enabled,
    select: d => d.data,
  })
}
