import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Tv, Copy, Plus, Trash2, Check, RefreshCw, MonitorPlay, MonitorOff, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProject } from '@/lib/project-context'
import { listWbTokens, generateWbCode, revokeWbCode, type WbTokenItem } from '@/http/wallboard'

export const Route = createFileRoute('/app/_layout/settings/wallboard')({
  component: WallboardSettingsPage,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatus(token: WbTokenItem): 'active' | 'idle' | 'never' {
  if (!token.last_used_at) return 'never'
  const diff = Date.now() - new Date(token.last_used_at).getTime()
  if (diff < 60 * 60 * 1000) return 'active'   // < 1h → access token still valid
  return 'idle'
}

function timeAgo(ts: string | null) {
  if (!ts) return null
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied
        ? <><Check className="h-3 w-3 text-green-500" /> Copied</>
        : <><Copy className="h-3 w-3" /> {label ?? 'Copy'}</>
      }
    </button>
  )
}

// ── Token card ────────────────────────────────────────────────────────────────

function TokenCard({ token, onRevoke }: { token: WbTokenItem; onRevoke: () => void }) {
  const [revoking, setRevoking] = React.useState(false)
  const status = getStatus(token)
  const tvUrl = `${window.location.origin}/tv${token.project_id ? `?project_id=${token.project_id}` : ''}`

  async function handleRevoke() {
    setRevoking(true)
    try {
      await revokeWbCode(token.id)
      onRevoke()
    } finally {
      setRevoking(false)
    }
  }

  return (
    <Card className="p-0 border-border/50 overflow-hidden">
      {/* Status bar */}
      <div className={`h-1 w-full ${status === 'active' ? 'bg-green-500' : status === 'idle' ? 'bg-yellow-500/60' : 'bg-border'}`} />

      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {status === 'active'
              ? <MonitorPlay className="h-4 w-4 text-green-500 shrink-0" />
              : <MonitorOff className="h-4 w-4 text-muted-foreground shrink-0" />
            }
            <span className="font-semibold text-foreground truncate">
              {token.name || 'Unnamed profile'}
            </span>
            {token.project_id && (
              <span className="text-xs bg-secondary text-muted-foreground rounded px-1.5 py-0.5 shrink-0">
                {token.project_id}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {status === 'active' && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-500">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                Active
              </span>
            )}
            {status === 'idle' && (
              <span className="flex items-center gap-1 text-xs text-yellow-500/80">
                <Clock className="h-3 w-3" />
                Idle
              </span>
            )}
            {status === 'never' && (
              <span className="text-xs text-muted-foreground">Never used</span>
            )}
          </div>
        </div>

        {/* Code */}
        <div className="flex items-center justify-between bg-secondary/40 rounded-lg px-4 py-3">
          <span className="font-mono text-xl font-bold tracking-[0.25em] text-foreground select-all">
            {token.code}
          </span>
          <CopyBtn text={token.code} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            {token.last_used_at ? (
              <p className="text-xs text-muted-foreground">
                Last seen {timeAgo(token.last_used_at)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Created {timeAgo(token.created_at)}
              </p>
            )}
            <CopyBtn text={tvUrl} label="Copy TV URL" />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevoke}
            disabled={revoking}
            className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            {revoking
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <><Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke</>
            }
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

function WallboardSettingsPage() {
  const { selectedProjectId } = useProject()
  const [tokens, setTokens] = React.useState<WbTokenItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState('')
  const [error, setError] = React.useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await listWbTokens(selectedProjectId ?? undefined)
      setTokens(res.data ?? [])
    } catch {
      setError('Failed to load profiles')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { load() }, [selectedProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    if (!name.trim()) return
    setError('')
    setCreating(true)
    try {
      const tok = await generateWbCode(selectedProjectId ?? undefined, name.trim())
      setTokens(prev => [tok, ...prev])
      setName('')
    } catch {
      setError('Failed to create profile')
    } finally {
      setCreating(false)
    }
  }

  const active = tokens.filter(t => getStatus(t) === 'active')
  const rest = tokens.filter(t => getStatus(t) !== 'active')

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Tv className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Wallboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage TV profiles. Each profile has its own activation code and can run on a different screen.
          </p>
        </div>
      </div>

      {/* Active sessions summary */}
      {active.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="font-medium">{active.length} screen{active.length > 1 ? 's' : ''} currently active</span>
          <span className="text-green-500/60">·</span>
          <span className="text-green-500/80">{active.map(t => t.name || 'Unnamed').join(', ')}</span>
        </div>
      )}

      {/* Create new */}
      <Card className="p-5 border-border/50">
        <p className="text-sm font-medium text-foreground mb-3">New profile</p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="e.g. TV NOC, TV Software, Reception"
            className="flex-1"
          />
          <Button onClick={create} disabled={creating || !name.trim()} size="sm" className="shrink-0">
            {creating
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <><Plus className="h-3.5 w-3.5 mr-1" /> Create</>
            }
          </Button>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </Card>

      {/* Profiles grid */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tokens.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Tv className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No profiles yet.</p>
          <p className="text-xs mt-1">Create one above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {[...active, ...rest].map(tok => (
            <TokenCard
              key={tok.id}
              token={tok}
              onRevoke={() => setTokens(prev => prev.filter(t => t.id !== tok.id))}
            />
          ))}
        </div>
      )}

      {/* How it works */}
      <Card className="p-4 border-border/50 bg-secondary/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground block mb-1">How it works</span>
          Open <span className="font-mono">{window.location.origin}/tv</span> on any screen and enter the activation code.
          The dashboard refreshes every 30 seconds. Sessions renew automatically — a screen stays locked in for 30 days of inactivity before needing a new code.
        </p>
      </Card>
    </div>
  )
}
