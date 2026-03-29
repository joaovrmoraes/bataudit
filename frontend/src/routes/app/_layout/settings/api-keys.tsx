import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Key, Plus, Trash2, Copy, Check, ChevronDown, ChevronRight, Users } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useProjects, useCreateProject } from '@/queries/projects'
import { useAPIKeys, useCreateAPIKey, useRevokeAPIKey } from '@/queries/api-keys'
import { useMembers, useAddMember, useRemoveMember, useUpdateMemberRole } from '@/queries/members'
import type { Member } from '@/http/members/index'

export const Route = createFileRoute('/app/_layout/settings/api-keys')({
  component: APIKeysPage,
})

function APIKeysPage() {
  const [expandedProject, setExpandedProject] = React.useState<string | null>(null)
  const [newKeyName, setNewKeyName] = React.useState<Record<string, string>>({})
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const [showNewProject, setShowNewProject] = React.useState(false)
  const [projectName, setProjectName] = React.useState('')
  const [projectSlug, setProjectSlug] = React.useState('')
  const [projectError, setProjectError] = React.useState('')

  const [activeTab, setActiveTab] = React.useState<Record<string, 'keys' | 'members'>>({})
  const [newMemberEmail, setNewMemberEmail] = React.useState<Record<string, string>>({})
  const [newMemberRole, setNewMemberRole] = React.useState<Record<string, Member['role']>>({})

  const { data: projects = [], isLoading } = useProjects()
  const { data: keys = [] } = useAPIKeys(expandedProject)
  const { data: members = [] } = useMembers(expandedProject)
  const createKeyMutation = useCreateAPIKey(expandedProject)
  const revokeKeyMutation = useRevokeAPIKey(expandedProject)
  const createProjectMutation = useCreateProject()
  const addMemberMutation = useAddMember(expandedProject)
  const removeMemberMutation = useRemoveMember(expandedProject)
  const updateRoleMutation = useUpdateMemberRole(expandedProject)

  function handleCopy(key: string) {
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSlugFromName(name: string) {
    setProjectName(name)
    setProjectSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }

  function handleCreateProject() {
    setProjectError('')
    createProjectMutation.mutate(
      { name: projectName, slug: projectSlug },
      {
        onSuccess: () => {
          setShowNewProject(false)
          setProjectName('')
          setProjectSlug('')
        },
        onError: (err: Error) => setProjectError(err.message),
      },
    )
  }

  return (
    <main className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Key className="h-6 w-6 text-slate-500" />
            API Keys
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage API keys used by your SDKs to send events to BatAudit.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() => setShowNewProject(v => !v)}
        >
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {showNewProject && (
        <Card className="p-4 border-border/50 bg-card/50 space-y-3">
          <p className="text-sm font-medium text-foreground">Create project</p>
          <div className="flex gap-3">
            <Input
              placeholder="Project name"
              value={projectName}
              onChange={e => handleSlugFromName(e.target.value)}
            />
            <Input
              placeholder="slug"
              value={projectSlug}
              onChange={e => setProjectSlug(e.target.value)}
              className="max-w-[200px] font-mono text-sm"
            />
            <Button
              size="sm"
              onClick={handleCreateProject}
              disabled={!projectName || !projectSlug || createProjectMutation.isPending}
            >
              Create
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowNewProject(false)}>
              Cancel
            </Button>
          </div>
          {projectError && <p className="text-xs text-destructive">{projectError}</p>}
        </Card>
      )}

      {revealedKey && (
        <Card className="p-4 border-yellow-500/30 bg-yellow-500/5 space-y-2">
          <p className="text-xs font-medium text-yellow-500 uppercase tracking-wide">
            New API Key — copy it now, it will not be shown again
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-sm font-mono text-foreground bg-secondary/50 px-3 py-2 rounded-md break-all">
              {revealedKey}
            </code>
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0 gap-2"
              onClick={() => handleCopy(revealedKey)}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRevealedKey(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading projects...</p>
      ) : projects.length === 0 ? (
        <Card className="p-8 border-border/50 text-center space-y-2">
          <p className="text-sm text-muted-foreground">No projects yet.</p>
          <p className="text-xs text-muted-foreground">
            Projects are created automatically when your SDK sends its first event, or you can create one manually above.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map(project => (
            <Card key={project.id} className="border-border/50 bg-card/50 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/20 transition-colors"
                onClick={() => {
                  setExpandedProject(expandedProject === project.id ? null : project.id)
                  setRevealedKey(null)
                }}
              >
                <div className="flex items-center gap-3">
                  {expandedProject === project.id
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  }
                  <div>
                    <p className="text-sm font-medium text-foreground">{project.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{project.slug}</p>
                  </div>
                </div>
              </button>

              {expandedProject === project.id && (
                <div className="border-t border-border/30">
                  {/* Tab bar */}
                  <div className="flex border-b border-border/30">
                    <button
                      className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${(activeTab[project.id] ?? 'keys') === 'keys' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => setActiveTab(prev => ({ ...prev, [project.id]: 'keys' }))}
                    >
                      <Key className="h-3 w-3" />
                      API Keys
                    </button>
                    <button
                      className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${activeTab[project.id] === 'members' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => setActiveTab(prev => ({ ...prev, [project.id]: 'members' }))}
                    >
                      <Users className="h-3 w-3" />
                      Members
                    </button>
                  </div>

                  {/* Keys tab */}
                  {(activeTab[project.id] ?? 'keys') === 'keys' && (
                  <div className="p-4 space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Key name (e.g. production)"
                      value={newKeyName[project.id] ?? ''}
                      onChange={e =>
                        setNewKeyName(prev => ({ ...prev, [project.id]: e.target.value }))
                      }
                      className="max-w-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-2"
                      disabled={!newKeyName[project.id] || createKeyMutation.isPending}
                      onClick={() => {
                        createKeyMutation.mutate(
                          { projectId: project.id, name: newKeyName[project.id] },
                          { onSuccess: (data) => setRevealedKey(data.key) },
                        )
                        setNewKeyName(prev => ({ ...prev, [project.id]: '' }))
                      }}
                    >
                      <Plus className="h-3 w-3" />
                      Generate key
                    </Button>
                  </div>

                  {keys.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No keys yet for this project.</p>
                  ) : (
                    <div className="space-y-2">
                      {keys.map(key => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/20"
                        >
                          <div className="flex items-center gap-3">
                            <Key className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-foreground">{key.name}</span>
                            <Badge variant={key.active ? 'default' : 'secondary'} className="text-xs">
                              {key.active ? 'active' : 'revoked'}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                              {new Date(key.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {key.active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => revokeKeyMutation.mutate(key.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  </div>
                  )}

                  {/* Members tab */}
                  {activeTab[project.id] === 'members' && (
                  <div className="p-4 space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Email address"
                        type="email"
                        value={newMemberEmail[project.id] ?? ''}
                        onChange={e => setNewMemberEmail(prev => ({ ...prev, [project.id]: e.target.value }))}
                        className="max-w-xs"
                      />
                      <select
                        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={newMemberRole[project.id] ?? 'viewer'}
                        onChange={e => setNewMemberRole(prev => ({ ...prev, [project.id]: e.target.value as Member['role'] }))}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-2"
                        disabled={!newMemberEmail[project.id] || addMemberMutation.isPending}
                        onClick={() => {
                          addMemberMutation.mutate(
                            { email: newMemberEmail[project.id], role: newMemberRole[project.id] ?? 'viewer' },
                            { onSuccess: () => setNewMemberEmail(prev => ({ ...prev, [project.id]: '' })) },
                          )
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Add member
                      </Button>
                    </div>

                    {members.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No members yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {members.map(member => (
                          <div key={member.user_id} className="flex items-center justify-between py-2 px-3 rounded-md bg-secondary/20">
                            <div className="flex items-center gap-3">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <div>
                                <p className="text-sm text-foreground">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <select
                                className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                                value={member.role}
                                disabled={member.role === 'owner'}
                                onChange={e => updateRoleMutation.mutate({ userId: member.user_id, role: e.target.value as Member['role'] })}
                              >
                                <option value="viewer">Viewer</option>
                                <option value="admin">Admin</option>
                                <option value="owner" disabled>Owner</option>
                              </select>
                              {member.role !== 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-destructive hover:text-destructive"
                                  onClick={() => removeMemberMutation.mutate(member.user_id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
