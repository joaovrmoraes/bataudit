import { LogOut, ChevronDown } from 'lucide-react'
import { useRouter } from '@tanstack/react-router'
import { Button } from './ui/button'
import { getUser, clearAuth } from '@/lib/auth'
import { useLogout } from '@/queries/auth'
import { useProjects } from '@/queries/projects'
import { useProject } from '@/lib/project-context'
import { ThemeToggle } from './theme-toggle'
import React from 'react'

export function Header() {
  const router = useRouter()
  const user = getUser()
  const logoutMutation = useLogout()
  const { data: projects = [] } = useProjects()
  const { selectedProjectId, setSelectedProjectId } = useProject()
  const [open, setOpen] = React.useState(false)

  const isOwner = user?.role === 'owner'
  const selectedProject = projects.find(p => p.id === selectedProjectId)
  const selectorLabel = selectedProjectId === null
    ? (isOwner ? 'All Projects' : (selectedProject?.name ?? 'Select project'))
    : (selectedProject?.name ?? 'Select project')

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
      {/* Project selector */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 min-w-[160px] justify-between"
          onClick={() => setOpen(v => !v)}
        >
          <span className="truncate">{selectorLabel}</span>
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </Button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-md border border-border bg-card shadow-lg">
            {isOwner && (
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors border-b border-border/50"
                onClick={() => { setSelectedProjectId(null); setOpen(false) }}
              >
                All Projects
              </button>
            )}
            {projects.map(p => (
              <button
                key={p.id}
                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 transition-colors"
                onClick={() => { setSelectedProjectId(p.id); setOpen(false) }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
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
