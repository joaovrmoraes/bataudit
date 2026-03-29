import { authHeader } from '@/lib/auth'

export interface Project {
  id: string
  name: string
  slug: string
  created_by: string
  created_at: string
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/auth/projects`, {
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to list projects')
  const data = await res.json()
  return data.data ?? []
}

export async function createProject(name: string, slug: string): Promise<Project> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/auth/projects`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, slug }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Failed to create project')
  }
  return res.json()
}
