import { cn } from '@/lib/utils'

interface StatusIndicatorProps {
  status: number
  className?: string
}

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'bg-green-500'
    if (code >= 400 && code < 500) return 'bg-yellow-500'
    if (code >= 500) return 'bg-red-500'
    return 'bg-muted'
  }

  const getStatusText = (code: number) => {
    if (code >= 200 && code < 300) return 'Success'
    if (code >= 400 && code < 500) return 'Client Error'
    if (code >= 500) return 'Server Error'
    return 'Unknown'
  }

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <div className={cn('h-2 w-2 rounded-full', getStatusColor(status))} />
      <span className="text-sm font-mono font-medium">{status}</span>
      <span className="text-xs text-muted-foreground">
        {getStatusText(status)}
      </span>
    </div>
  )
}
