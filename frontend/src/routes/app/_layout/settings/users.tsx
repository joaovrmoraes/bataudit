import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { UserPlus, Trash2, Crown, ShieldCheck, Eye, Copy, Check, X, Link } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useUsers, useDeleteUser } from '@/queries/users'
import { useInvites, useCreateInvite, useRevokeInvite } from '@/queries/invites'
import type { User } from '@/http/users'
import type { Invite } from '@/http/invites'

export const Route = createFileRoute('/app/_layout/settings/users')({
  component: UsersPage,
})

const ROLE_META: Record<User['role'], { label: string; icon: React.ElementType; color: string }> = {
  owner:  { label: 'Owner',  icon: Crown,       color: 'bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/30' },
  admin:  { label: 'Admin',  icon: ShieldCheck, color: 'bg-[#818cf8]/20 text-[#818cf8] border-[#818cf8]/30' },
  viewer: { label: 'Viewer', icon: Eye,         color: 'bg-secondary text-muted-foreground border-border' },
}

function RoleBadge({ role }: { role: User['role'] }) {
  const meta = ROLE_META[role]
  const Icon = meta.icon
  return (
    <Badge className={`${meta.color} text-xs gap-1`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  )
}

function UserRow({ user }: { user: User }) {
  const [confirm, setConfirm] = React.useState(false)
  const deleteMutation = useDeleteUser()
  const isOwner = user.role === 'owner'

  function handleDelete() {
    if (!confirm) { setConfirm(true); return }
    deleteMutation.mutate(user.id, { onSettled: () => setConfirm(false) })
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors">
      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground">
        {(user.name || user.email).charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{user.name || '—'}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
      </div>
      <RoleBadge role={user.role} />
      {!isOwner && (
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${
            confirm
              ? 'bg-[#f87171]/20 text-[#f87171] border border-[#f87171]/30 hover:bg-[#f87171]/30'
              : 'text-muted-foreground hover:text-[#f87171] hover:bg-[#f87171]/10'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirm ? 'Confirm?' : 'Remove'}
        </button>
      )}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary/50"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function InviteRow({ invite }: { invite: Invite }) {
  const revokeMutation = useRevokeInvite()

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/10 border border-border/30">
      <div className="w-9 h-9 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
        <Link className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
        <p className="text-xs text-muted-foreground">
          Expires {new Date(invite.expires_at).toLocaleDateString()}
        </p>
      </div>
      <Badge className={ROLE_META[invite.role]?.color ?? 'bg-secondary text-muted-foreground border-border'}>
        {invite.role}
      </Badge>
      <button
        onClick={() => revokeMutation.mutate(invite.id)}
        disabled={revokeMutation.isPending}
        className="text-muted-foreground hover:text-[#f87171] hover:bg-[#f87171]/10 p-1.5 rounded transition-colors"
        title="Revoke invite"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function InviteForm() {
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<'admin' | 'viewer'>('viewer')
  const [inviteLink, setInviteLink] = React.useState('')
  const [error, setError] = React.useState('')
  const createMutation = useCreateInvite()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setInviteLink('')
    createMutation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: (data) => {
          const link = `${window.location.origin}/invite/${data.token}`
          setInviteLink(link)
          setEmail('')
          setRole('viewer')
        },
        onError: (err: Error) => setError(err.message),
      },
    )
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          type="email"
          placeholder="colleague@company.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="flex-1 h-9 text-sm"
        />
        <select
          value={role}
          onChange={e => setRole(e.target.value as 'admin' | 'viewer')}
          className="text-sm bg-secondary border border-border/50 rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-border h-9"
        >
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
        <Button
          type="submit"
          size="sm"
          disabled={createMutation.isPending || !email.trim()}
          className="h-9 gap-2 shrink-0"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {createMutation.isPending ? 'Generating…' : 'Generate Invite'}
        </Button>
      </form>

      {inviteLink && (
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 rounded-lg border border-border/50">
          <p className="text-xs text-muted-foreground font-mono truncate flex-1">{inviteLink}</p>
          <CopyButton text={inviteLink} />
        </div>
      )}

      {error && <p className="text-xs text-[#f87171]">{error}</p>}
    </div>
  )
}

function UsersPage() {
  const { data: users = [], isLoading: usersLoading } = useUsers()
  const { data: invites = [] } = useInvites()

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">Manage BatAudit accounts</p>
        </div>
        {users.length > 0 && (
          <Badge className="bg-secondary text-muted-foreground border-border ml-auto shrink-0">
            {users.length} user{users.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      <Card className="p-4 border-border/50 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invite user</p>
        <InviteForm />
      </Card>

      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pending invites</p>
          {invites.map(invite => (
            <InviteRow key={invite.id} invite={invite} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {usersLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!usersLoading && users.length === 0 && (
          <Card className="p-8 text-center border-border/50">
            <p className="text-sm text-muted-foreground">No users yet.</p>
          </Card>
        )}
        {users.map(user => (
          <UserRow key={user.id} user={user} />
        ))}
      </div>
    </div>
  )
}
