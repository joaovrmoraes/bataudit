import { fetchWithAuth } from '@/lib/api'

export async function logout(): Promise<void> {
  const res = await fetchWithAuth(`${import.meta.env.VITE_API_URL ?? ''}/v1/auth/logout`, {
    method: 'POST',
  })

  if (!res.ok) {
    throw new Error('Failed to logout')
  }
}
