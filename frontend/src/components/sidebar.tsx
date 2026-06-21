import { LayoutDashboard, Activity, ShieldAlert, BarChart2, Settings, ChevronLeft, Users, HeartPulse, Tv, Key, Bell, Archive, UserCog } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { getUser } from '@/lib/auth'

interface NavItemProps {
  to: string
  icon: React.ElementType
  label: string
  exact?: boolean
}

function NavItem({ to, icon: Icon, label, exact }: NavItemProps) {
  return (
    <Link
      to={to}
      activeProps={{ className: 'bg-sidebar-accent text-sidebar-primary font-medium' }}
      inactiveProps={{ className: 'text-sidebar-foreground hover:bg-sidebar-accent/50' }}
      activeOptions={exact ? { exact: true } : undefined}
    >
      <span className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </span>
    </Link>
  )
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider first:pt-0">
      {label}
    </p>
  )
}

function MainNav() {
  return (
    <>
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        <NavItem to="/app/" icon={LayoutDashboard} label="Dashboard" exact />
        <NavItem to="/app/sessions" icon={Activity} label="Sessions" />
        <NavItem to="/app/anomalies" icon={ShieldAlert} label="Anomalies" />
        <NavItem to="/app/insights" icon={BarChart2} label="Insights" />
      </nav>

      <div className="px-2 py-3 border-t border-sidebar-border">
        <NavItem to="/app/settings" icon={Settings} label="Settings" />
      </div>
    </>
  )
}

function SettingsNav() {
  const role = getUser()?.role
  const isOwner = role === 'owner'
  const isAdminOrOwner = role === 'owner' || role === 'admin'

  return (
    <>
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <Link
          to="/app/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        <SectionLabel label="General" />
        <NavItem to="/app/settings/healthcheck" icon={HeartPulse} label="Healthcheck" />

        {isAdminOrOwner && (
          <>
            <SectionLabel label="Team" />
            <NavItem to="/app/settings/members" icon={Users} label="Members" />
            <NavItem to="/app/settings/users" icon={UserCog} label="Users" />
          </>
        )}

        {isAdminOrOwner && (
          <>
            <SectionLabel label="Project" />
            <NavItem to="/app/settings/api-keys" icon={Key} label="API Keys" />
            <NavItem to="/app/settings/wallboard" icon={Tv} label="Wallboard" />
            <NavItem to="/app/settings/notifications" icon={Bell} label="Notifications" />
          </>
        )}

        {isOwner && (
          <>
            <SectionLabel label="Danger" />
            <NavItem to="/app/settings/retention" icon={Archive} label="Retention" />
          </>
        )}
      </nav>
    </>
  )
}

export function Sidebar() {
  const pathname = useRouterState({ select: s => s.location.pathname })
  const inSettings = pathname.startsWith('/app/settings')

  return (
    <aside className="w-56 h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      {!inSettings && (
        <div className="flex items-center gap-3 h-16 px-4 border-b border-sidebar-border shrink-0">
          <img src="/app/bat-logo.png" alt="BatAudit" className="w-9 h-9 object-contain shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-sidebar-foreground leading-tight">BatAudit</p>
            <p className="text-xs text-muted-foreground">Monitoring</p>
          </div>
        </div>
      )}

      {inSettings ? <SettingsNav /> : <MainNav />}
    </aside>
  )
}
