import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Users, UserPlus, Trash2, ShieldCheck, Eye, Crown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useProject } from '@/lib/project-context'
import { useMembers, useAddMember, useRemoveMember, useUpdateMemberRole } from '@/queries/members'
import type { Member } from '@/http/members/index'

export const Route = createFileRoute('/app/_layout/members')({
  component: MembersPage,
})

const ROLE_META: Record<Member['role'], { label: string; icon: React.ElementType; color: string }> = {
  owner:  { label: 'Owner',  icon: Crown,       color: 'bg-[#fbbf24]/20 text-[#fbbf24] border-[#fbbf24]/30' },
  admin:  { label: 'Admin',  icon: ShieldCheck, color: 'bg-[#818cf8]/20 text-[#818cf8] border-[#818cf8]/30' },
  viewer: { label: 'Viewer', icon: Eye,         color: 'bg-secondary text-muted-foreground border-border' },
}

function RoleBadge({ role }: { role: Member['role'] }) {
  const meta = ROLE_META[role]
  const Icon = meta.icon
  return (
    <Badge className={`${meta.color} text-xs gap-1`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  )
}

function MemberRow({
  member,
  currentUserRole,
  projectId,
}: {
  member: Member
  currentUserRole: Member['role']
  projectId: string
}) {
  const [confirmRemove, setConfirmRemove] = React.useState(false)
  const removeMutation = useRemoveMember(projectId)
  const updateRoleMutation = useUpdateMemberRole(projectId)

  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'
  const isOwner = member.role === 'owner'

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateRoleMutation.mutate({ userId: member.user_id, role: e.target.value as Member['role'] })
  }

  function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return }
    removeMutation.mutate(member.user_id, { onSettled: () => setConfirmRemove(false) })
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors">
      {/* Avatar placeholder */}
      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground">
        {(member.name || member.email).charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{member.name || '—'}</p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>

      {/* Role */}
      {canManage && !isOwner ? (
        <select
          value={member.role}
          onChange={handleRoleChange}
          disabled={updateRoleMutation.isPending}
          className="text-xs bg-secondary border border-border/50 rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-border"
        >
          <option value="admin">Admin</option>
          <option value="viewer">Viewer</option>
        </select>
      ) : (
        <RoleBadge role={member.role} />
      )}

      {/* Remove */}
      {canManage && !isOwner && (
        <button
          onClick={handleRemove}
          disabled={removeMutation.isPending}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${
            confirmRemove
              ? 'bg-[#f87171]/20 text-[#f87171] border border-[#f87171]/30 hover:bg-[#f87171]/30'
              : 'text-muted-foreground hover:text-[#f87171] hover:bg-[#f87171]/10'
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {confirmRemove ? 'Confirm?' : 'Remove'}
        </button>
      )}
    </div>
  )
}

function AddMemberForm({ projectId }: { projectId: string }) {
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<Member['role']>('viewer')
  const [error, setError] = React.useState('')
  const addMutation = useAddMember(projectId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    addMutation.mutate(
      { email: email.trim(), role },
      {
        onSuccess: () => { setEmail(''); setRole('viewer') },
        onError: (err: Error) => setError(err.message),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3 flex-wrap">
      <Input
        type="email"
        placeholder="user@example.com"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="flex-1 min-w-[220px] h-9 text-sm"
      />
      <select
        value={role}
        onChange={e => setRole(e.target.value as Member['role'])}
        className="text-sm bg-secondary border border-border/50 rounded-md px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-border h-9"
      >
        <option value="viewer">Viewer</option>
        <option value="admin">Admin</option>
      </select>
      <Button type="submit" size="sm" disabled={addMutation.isPending || !email.trim()} className="h-9 gap-2">
        <UserPlus className="h-3.5 w-3.5" />
        {addMutation.isPending ? 'Adding…' : 'Add Member'}
      </Button>
      {error && <p className="w-full text-xs text-[#f87171]">{error}</p>}
    </form>
  )
}

function MembersPage() {
  const { selectedProjectId } = useProject()
  const { data: members = [], isLoading } = useMembers(selectedProjectId)

  // Determine current user's role (simplistic — owner if any owner row, else fallback admin for demo)
  const currentUserRole: Member['role'] = (members.find(m => m.role === 'owner')?.role) ?? 'admin'

  if (!selectedProjectId) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center border-border/50">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Select a project to manage its members.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">Members</h1>
            <p className="text-sm text-muted-foreground">Manage who has access to this project</p>
          </div>
        </div>
        {members.length > 0 && (
          <Badge className="bg-secondary text-muted-foreground border-border shrink-0">
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Add member form */}
      <Card className="p-4 border-border/50">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add member</p>
        <AddMemberForm projectId={selectedProjectId} />
        <p className="text-xs text-muted-foreground/60 mt-2">
          The user must already have a BatAudit account.
        </p>
      </Card>

      {/* Members list */}
      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && members.length === 0 && (
          <Card className="p-8 text-center border-border/50">
            <p className="text-sm text-muted-foreground">No members yet.</p>
          </Card>
        )}
        {members.map(member => (
          <MemberRow
            key={member.user_id}
            member={member}
            currentUserRole={currentUserRole}
            projectId={selectedProjectId}
          />
        ))}
      </div>
    </div>
  )
}
