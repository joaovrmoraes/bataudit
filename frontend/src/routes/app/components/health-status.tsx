import { Activity, Database, Server, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HealthResponse } from '@/http/health/details';

interface HealthStatusProps {
  health: HealthResponse;
}

export function HealthStatus({ health }: HealthStatusProps) {
  const isHealthy = health.status === 'ok';
  
  return (
    <Card className="p-4 bg-gradient-glow shadow-card border-border/50">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        <div className="flex items-center space-x-2">
          <div className={cn(
            "flex h-6 w-6 items-center justify-center rounded",
            isHealthy ? "bg-green-500/20 text-green-500" : "bg-destructive/20 text-destructive"
          )}>
            {isHealthy ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-medium">{health.status.toUpperCase()}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-500/20 text-purple-500">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">API</p>
            <p className="text-sm font-medium text-yellow-500">{health.api_response_ms}ms</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-500/20 text-purple-500">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Database</p>
            <p className="text-sm font-medium text-yellow-500">{health.db_response_ms}ms</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-secondary/50 text-secondary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Environment</p>
            <p className="text-sm font-medium text-yellow-500">{health.environment}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-muted-foreground">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Version</p>
            <p className="text-sm font-medium text-foreground">{health.version}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className={cn(
            "flex h-6 w-6 items-center justify-center rounded",
            health.db_status === 'ok' ? "bg-green-500/20 text-green-500" : "bg-warning/20 text-warning"
          )}>
            <Database className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">DB Status</p>
            <p className="text-sm font-medium">{health.db_status.toUpperCase()}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}