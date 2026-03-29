import { authHeader } from '@/lib/auth'

export async function logout(): Promise<void> {
  const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/v1/auth/logout`, {
    method: 'POST',
    headers: { ...authHeader() },
  })

  if (!res.ok) {
    throw new Error('Failed to logout')
  }
}
