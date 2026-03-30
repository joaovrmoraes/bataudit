import { LogOut, ChevronDown } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { Button } from './ui/button'
import { getUser, clearAuth } from '@/lib/auth'
import { useLogout } from '@/queries/auth'
import { useProjects } from '@/queries/projects'
import { useProject } from '@/lib/project-context'
import { useEnvironment } from '@/lib/environment-context'
import { ThemeToggle } from './theme-toggle'
import React from 'react'

const ENVIRONMENTS = [
  { value: 'production',  label: 'production',  color: 'text-[#34d399]' },
  { value: 'staging',     label: 'staging',     color: 'text-[#60a5fa]' },
  { value: 'development', label: 'development', color: 'text-[#818cf8]' },
  { value: 'testing',     label: 'testing',     color: 'text-[#fb923c]' },
  { value: 'local',       label: 'local',       color: 'text-muted-foreground' },
]

export function Header() {
  const router = useRouter()
  const user = getUser()
  const logoutMutation = useLogout()
  const { data: projects = [] } = useProjects()
  const { selectedProjectId, setSelectedProjectId } = useProject()
  const { selectedEnvironment, setSelectedEnvironment } = useEnvironment()
  const [projectOpen, setProjectOpen] = React.useState(false)
  const [envOpen, setEnvOpen] = React.useState(false)

  const isOwner = user?.role === 'owner'
  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const selectorLabel = selectedProjectId === null
    ? (isOwner ? 'All Projects' : (selectedProject?.name ?? 'Select project'))
    : (selectedProject?.name ?? 'Select project')

  const envLabel = selectedEnvironment ?? 'All Envs'
  const envColor = ENVIRONMENTS.find(e => e.value === selectedEnvironment)?.color ?? ''

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        clearAuth()
        router.navigate({ to: '/login' })
      },
    })
  }

  return (
    <header className="h-16 shrink-0 border-b border-border bg-card flex items-center justify-between px-6">
      {/* Left: selectors */}
      <div className="flex items-center gap-2">
        {/* Project selector */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-w-[160px] justify-between"
            onClick={() => { setProjectOpen(v => !v); setEnvOpen(false) }}
          >
            <span className="truncate">{selectorLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Button>

          {projectOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-card shadow-lg">
              {isOwner && (
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors border-b border-border/50"
                  onClick={() => { setSelectedProjectId(null); setProjectOpen(false) }}
                >
                  All Projects
                </button>
              )}
              {projects.map(p => (
                <button
                  key={p.id}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors"
                  onClick={() => { setSelectedProjectId(p.id); setProjectOpen(false) }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Environment selector */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 min-w-[120px] justify-between"
            onClick={() => { setEnvOpen(v => !v); setProjectOpen(false) }}
          >
            <span className={`truncate ${envColor}`}>{envLabel}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Button>

          {envOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 min-w-[150px] rounded-md border border-border bg-card shadow-lg">
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors border-b border-border/50"
                onClick={() => { setSelectedEnvironment(null); setEnvOpen(false) }}
              >
                All Envs
              </button>
              {ENVIRONMENTS.map(env => (
                <button
                  key={env.value}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors ${env.color}`}
                  onClick={() => { setSelectedEnvironment(env.value); setEnvOpen(false) }}
                >
                  {env.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        {user && (
          <div className="text-right">
            <p className="text-xs font-medium text-foreground">{user.name || user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="gap-2"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </header>
  )
}
