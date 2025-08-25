import { User, Globe, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from './status-indicator'
import { cn } from '@/lib/utils'

interface AuditEvent {
  id: string
  timestamp: string
  method: string
  path: string
  status_code: number
  identifier: string
  user_email: string
  service_name: string
  response_time?: number
  user_agent?: string
}

interface EventCardProps {
  event: AuditEvent
  className?: string
}

export function EventCard({ event, className }: EventCardProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (seconds < 60) return `${seconds}s ago`
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString()
  }

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-green-500'
      case 'POST':
        return 'text-purple-500'
      case 'PUT':
        return 'text-yellow-500'
      case 'DELETE':
        return 'text-red-500'
      case 'PATCH':
        return 'text-blue-500'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <Card
      className={cn(
        'p-4 flex flex-col gap-2 transition-all duration-300 border-border/50 bg-card/50 backdrop-blur-sm hover:[box-shadow:0_0_20px_hsl(267_57%_50%_/_0.3)] hover:cursor-pointer',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-mono text-yellow-500 font-medium">
              {formatTimestamp(event.timestamp)}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Badge
              variant="outline"
              className={cn('font-mono text-xs', getMethodColor(event.method))}
            >
              {event.method}
            </Badge>
            <span className="font-mono text-sm text-foreground font-medium">
              {event.path}
            </span>
          </div>
        </div>

        <StatusIndicator status={event.status_code} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <User className="h- w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {event.identifier}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {event.user_email}
            </span>
          </div>

          <Badge variant="secondary" className="text-xs">
            {event.service_name}
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          {event.response_time && (
            <span className="text-xs text-muted-foreground font-mono">
              {event.response_time}ms
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
