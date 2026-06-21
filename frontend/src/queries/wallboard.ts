import { useQuery } from '@tanstack/react-query'
import {
  getWbSummary,
  getWbFeed,
  getWbVolume,
  getWbHealth,
  getWbAlerts,
  getWbErrorRoutes,
  getWbProjects,
  getWbGrid,
} from '@/http/wallboard'

const REFETCH = 30_000

export function useWbSummary(projectId?: string, environment?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-summary', projectId, environment],
    queryFn: () => getWbSummary(projectId, environment),
    refetchInterval: REFETCH,
    enabled,
  })
}

export function useWbFeed(projectId?: string, environment?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-feed', projectId, environment],
    queryFn: () => getWbFeed(projectId, environment),
    refetchInterval: REFETCH,
    enabled,
    select: d => d.data,
  })
}

export function useWbVolume(projectId?: string, environment?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-volume', projectId, environment],
    queryFn: () => getWbVolume(projectId, environment),
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

export function useWbAlerts(projectId?: string, environment?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-alerts', projectId, environment],
    queryFn: () => getWbAlerts(projectId, environment),
    refetchInterval: REFETCH,
    enabled,
    select: d => d.data,
  })
}

export function useWbErrorRoutes(projectId?: string, environment?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-error-routes', projectId, environment],
    queryFn: () => getWbErrorRoutes(projectId, environment),
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

export function useWbGrid(environment?: string, enabled = true) {
  return useQuery({
    queryKey: ['wb-grid', environment],
    queryFn: () => getWbGrid(environment),
    refetchInterval: REFETCH,
    enabled,
    select: d => d.data,
  })
}
