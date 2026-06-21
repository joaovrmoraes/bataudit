import { fetchWithAuth } from '@/lib/api'

export interface User {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'viewer'
  created_at: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: 'admin' | 'viewer'
}

export async function listUsers(): Promise<User[]> {
  const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL ?? ''}/v1/auth/users`)
  if (!res.ok) throw new Error('Failed to list users')
  const json = await res.json()
  return json.data
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL ?? ''}/v1/auth/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (res.status === 409) throw new Error('Email already in use')
  if (!res.ok) throw new Error('Failed to create user')
  return res.json()
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL ?? ''}/v1/auth/users/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete user')
}
