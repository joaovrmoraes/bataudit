import React from 'react'
import { X } from 'lucide-react'
import { useAuditDetail } from '@/queries/audit'

interface EventDetailModalProps {
  eventId: string | null
  onClose: () => void
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground font-mono break-all">{value}</p>
    </div>
  )
}

function JsonField({ label, value }: { label: string; value: unknown }) {
  if (!value) return null
  const str = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (str === 'null' || str === '{}' || str === '[]') return null
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <pre className="text-xs text-foreground bg-secondary/40 rounded-md p-3 overflow-x-auto">{str}</pre>
    </div>
  )
}

export function EventDetailModal({ eventId, onClose }: EventDetailModalProps) {
  const { data: event, isLoading } = useAuditDetail(eventId)

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!eventId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg border border-border bg-card shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">Event Detail</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : event ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="ID" value={event.id} />
                <Field label="Request ID" value={event.request_id} />
                <Field label="Service" value={event.service_name} />
                <Field label="Environment" value={event.environment} />
                <Field label="Method" value={event.method} />
                <Field label="Path" value={event.path} />
                <Field label="Status Code" value={event.status_code} />
                <Field label="Response Time" value={event.response_time ? `${event.response_time}ms` : null} />
                <Field label="Timestamp" value={new Date(event.timestamp).toLocaleString()} />
                <Field label="IP" value={event.ip} />
              </div>

              <div className="border-t border-border/50 pt-4 grid grid-cols-2 gap-4">
                <Field label="Identifier" value={event.identifier} />
                <Field label="User Email" value={event.user_email} />
                <Field label="User Name" value={event.user_name} />
                <Field label="User Type" value={event.user_type} />
                <Field label="Tenant ID" value={event.tenant_id} />
              </div>

              <div className="border-t border-border/50 pt-4 space-y-3">
                <Field label="User Agent" value={event.user_agent} />
                <Field label="Error Message" value={event.error_message} />
                <JsonField label="User Roles" value={event.user_roles} />
                <JsonField label="Query Params" value={event.query_params} />
                <JsonField label="Path Params" value={event.path_params} />
                <JsonField label="Request Body" value={event.request_body} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Event not found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
