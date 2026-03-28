import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listMembers, addMember, updateMemberRole, removeMember, type Member } from '@/http/members/index'

export function useMembers(projectId: string | null) {
  return useQuery({
    queryKey: ['members', projectId],
    queryFn: () => listMembers(projectId!),
    enabled: !!projectId,
  })
}

export function useAddMember(projectId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: Member['role'] }) =>
      addMember(projectId!, email, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', projectId] }),
  })
}

export function useUpdateMemberRole(projectId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Member['role'] }) =>
      updateMemberRole(projectId!, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', projectId] }),
  })
}

export function useRemoveMember(projectId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeMember(projectId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', projectId] }),
  })
}
