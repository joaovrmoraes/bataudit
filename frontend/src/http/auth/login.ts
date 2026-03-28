import type { StoredUser } from '@/lib/auth'

interface LoginResponse {
  token: string
  user: StoredUser
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    throw new Error('Invalid credentials')
  }

  return res.json()
}
