import { ListAudit } from '@/http/audit/list';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/')({
  component: RouteComponent,
})

function RouteComponent() {
  const { data: auditList } = useQuery({
    queryKey: ['audit'],
    queryFn: () => ListAudit({ page: 1, limit: 10 }),
  })


  return (
      auditList && auditList?.data.map(audit => (
          <div key={audit.id} className="border-b last:border-b-0">
            <h3>{audit.path}</h3>
            <p>{audit.method}</p>
            <small>{audit.timestamp}</small>
          </div>
        ))
  )
}


