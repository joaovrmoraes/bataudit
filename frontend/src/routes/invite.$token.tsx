import React from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getInvitePreview, acceptInvite } from '@/http/invites'

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const router = useRouter()

  const [preview, setPreview] = React.useState<{ email: string; role: string } | null>(null)
  const [invalid, setInvalid] = React.useState(false)
  const [name, setName] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    getInvitePreview(token)
      .then(setPreview)
      .catch(() => setInvalid(true))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await acceptInvite(token, name.trim(), password)
      router.navigate({ to: '/login' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <img src="/app/bat-logo.png" alt="BatAudit" className="w-16 h-16 object-contain mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">BatAudit</h1>
          <p className="text-sm text-muted-foreground">You've been invited to join</p>
        </div>

        <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
          {invalid ? (
            <div className="text-center space-y-2 py-4">
              <p className="text-sm font-medium text-foreground">Invite not found</p>
              <p className="text-xs text-muted-foreground">This link may have expired or already been used.</p>
            </div>
          ) : !preview ? (
            <p className="text-sm text-muted-foreground text-center py-4">Checking invite…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                <Input value={preview.email} readOnly className="opacity-60 cursor-not-allowed" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Your name</label>
                <Input
                  placeholder="Full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Password</label>
                <Input
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading || !name.trim() || password.length < 8}>
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
