import { LayoutDashboard, Activity, Key, ShieldAlert, Bell, Archive, Users } from 'lucide-react'
import { Link } from '@tanstack/react-router'

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

export function Sidebar() {
  return (
    <aside className="w-56 h-screen flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-4 border-b border-sidebar-border">
        <img src="/app/bat-logo.png" alt="BatAudit" className="w-9 h-9 object-contain shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-sm text-sidebar-foreground leading-tight">BatAudit</p>
          <p className="text-xs text-muted-foreground">Monitoring</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        <NavItem to="/app/" icon={LayoutDashboard} label="Dashboard" exact />
        <NavItem to="/app/sessions" icon={Activity} label="Sessions" />
        <NavItem to="/app/anomalies" icon={ShieldAlert} label="Anomalies" />
        <NavItem to="/app/members" icon={Users} label="Members" />
        <NavItem to="/app/settings/api-keys" icon={Key} label="API Keys" />
        <NavItem to="/app/settings/notifications" icon={Bell} label="Notifications" />
        <NavItem to="/app/settings/retention" icon={Archive} label="Retention" />
      </nav>
    </aside>
  )
}
