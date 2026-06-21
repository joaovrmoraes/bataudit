import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listInvites, createInvite, revokeInvite } from '@/http/invites'

export function useInvites() {
  return useQuery({ queryKey: ['invites'], queryFn: listInvites })
}

export function useCreateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ email, role }: { email: string; role: 'admin' | 'viewer' }) =>
      createInvite(email, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })
}

export function useRevokeInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokeInvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })
}
