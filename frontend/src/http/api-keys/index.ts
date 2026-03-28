import { authHeader } from '@/lib/auth'

export interface APIKey {
  id: string
  name: string
  project_id: string
  created_at: string
  expires_at: string | null
  active: boolean
}

export async function listAPIKeys(projectId: string): Promise<APIKey[]> {
  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/v1/auth/api-keys?project_id=${projectId}`,
    { headers: { ...authHeader() } },
  )
  if (!res.ok) throw new Error('Failed to list api keys')
  const data = await res.json()
  return data.data ?? []
}

export async function createAPIKey(
  projectId: string,
  name: string,
): Promise<{ key: string; note: string }> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/v1/auth/api-keys`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId, name }),
  })
  if (!res.ok) throw new Error('Failed to create api key')
  return res.json()
}

export async function revokeAPIKey(id: string): Promise<void> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/v1/auth/api-keys/${id}`, {
    method: 'DELETE',
    headers: { ...authHeader() },
  })
  if (!res.ok) throw new Error('Failed to revoke api key')
}
