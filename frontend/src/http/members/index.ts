import { authHeader } from '@/lib/auth'

export interface Member {
  user_id: string
  project_id: string
  role: 'owner' | 'admin' | 'viewer'
  name: string
  email: string
}

export async function listMembers(projectId: string): Promise<Member[]> {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/v1/auth/projects/${projectId}/members`,
    { headers: { ...authHeader() } },
  )
  if (!res.ok) throw new Error('Failed to list members')
  const data = await res.json()
  return data.data ?? []
}

export async function addMember(
  projectId: string,
  email: string,
  role: Member['role'],
): Promise<void> {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/v1/auth/projects/${projectId}/members`,
    {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    },
  )
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Failed to add member')
  }
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: Member['role'],
): Promise<void> {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/v1/auth/projects/${projectId}/members/${userId}`,
    {
      method: 'PATCH',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    },
  )
  if (!res.ok) throw new Error('Failed to update member role')
}

export async function removeMember(
  projectId: string,
  userId: string,
): Promise<void> {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/v1/auth/projects/${projectId}/members/${userId}`,
    { method: 'DELETE', headers: { ...authHeader() } },
  )
  if (!res.ok) throw new Error('Failed to remove member')
}
