// import { Activity, Search, Settings } from 'lucide-react'
// import { Button } from './ui/button'
// import { Input } from './ui/input'

export function Header() {
  return (
    <header className="border-b border-border bg-gradient-dark backdrop-blur-sm">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-xl font-bold text-slate-500">BatAudit</h1>
              <p className="text-xs text-muted-foreground">System Monitoring</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              className="pl-10 bg-secondary/50 border-border/50 focus:bg-secondary"
            />
          </div>

          <Button variant="secondary" size="sm">
            <Activity className="h-4 w-4 mr-2" />
            Live
          </Button>

          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button> */}
        </div>
      </div>
    </header>
  )
}
