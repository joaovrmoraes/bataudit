import React from 'react'
import { Button } from '@/components/ui/button'
import { HealthStatus } from './components/health-status'
import { ListAudit } from '@/http/audit/list'
import { getHealthDetails } from '@/http/health/details'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Activity } from 'lucide-react'
import { EventCard } from './components/event-card'
import { AppPagination } from '@/components/app-pagination'

export const Route = createFileRoute('/app/')({
  component: RouteComponent,
})

function RouteComponent() {
  const [page, setPage] = React.useState(1)
  const limit = 10

  const { data: auditList } = useQuery({
    queryKey: ['audit', page],
    queryFn: () => ListAudit({ page, limit }),
  })

  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: async () => getHealthDetails(),
  })

  const totalPages = auditList?.pagination.totalPage || 1

  return (
    <div>
      <main className="container mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">
            System Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring and audit for your applications
          </p>
        </div>
        {healthData && <HealthStatus health={healthData} />}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center space-x-2">
              <Activity className="h-6 w-6 text-purple-500" />
              <span>Event Feed</span>
            </h2>
          </div>
          <div className="flex items-center justify-between">
            <Button variant={'secondary'}>Filter</Button>
            <div className="text-sm text-muted-foreground">
              {auditList?.pagination.limit} of{' '}
              {auditList?.pagination.totalItems} events
            </div>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-secondary scrollbar-thumb-primary">
            {auditList?.data.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
          <AppPagination
            page={page}
            totalPages={totalPages}
            setPage={setPage}
          />
        </div>
      </main>
    </div>
  )
}
