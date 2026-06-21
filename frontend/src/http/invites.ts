import { fetchWithAuth } from '@/lib/api'

const BASE = import.meta.env.VITE_API_URL ?? ''

export interface Invite {
  id: string
  email: string
  role: 'admin' | 'viewer'
  expires_at: string
  created_at: string
}

export interface InvitePreview {
  email: string
  role: string
  expires_at: string
}

export async function listInvites(): Promise<Invite[]> {
  const res = await fetchWithAuth(`${BASE}/v1/auth/invites`)
  if (!res.ok) throw new Error('Failed to list invites')
  const json = await res.json()
  return json.data
}

export async function createInvite(email: string, role: 'admin' | 'viewer'): Promise<{ token: string } & Invite> {
  const res = await fetchWithAuth(`${BASE}/v1/auth/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  })
  if (!res.ok) throw new Error('Failed to create invite')
  return res.json()
}

export async function revokeInvite(id: string): Promise<void> {
  const res = await fetchWithAuth(`${BASE}/v1/auth/invites/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to revoke invite')
}

export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const res = await fetch(`${BASE}/v1/auth/invite/${token}`)
  if (!res.ok) throw new Error('Invite not found or expired')
  return res.json()
}

export async function acceptInvite(token: string, name: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/v1/auth/invite/${token}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, password }),
  })
  if (res.status === 409) throw new Error('Email already in use')
  if (res.status === 410) throw new Error('Invite has expired')
  if (!res.ok) throw new Error('Failed to accept invite')
}
