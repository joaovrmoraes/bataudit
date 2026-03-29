import React from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { Clock, User, Activity, Filter, X, ChevronDown, ChevronRight, Hash } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuditSessions, useSessionTimeline, useSessionByID } from '@/queries/audit'
import { useProject } from '@/lib/project-context'
import { EventDetailModal } from '../components/event-detail-modal'
import type { Session } from '@/http/audit/sessions'

const searchSchema = z.object({
  identifier: z.string().optional(),
  service_name: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const Route = createFileRoute('/app/_layout/sessions')({
  validateSearch: searchSchema,
  component: SessionsPage,
})

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

function formatTime(ts: string) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString([], {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function sessionKey(s: Session) {
  return `${s.identifier}|${s.service_name}|${s.session_start}`
}

const STATUS_COLORS: Record<string, string> = {
  '2': 'bg-green-500/20 text-green-400',
  '3': 'bg-blue-500/20 text-blue-400',
  '4': 'bg-orange-500/20 text-orange-400',
  '5': 'bg-red-500/20 text-red-400',
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-[#34d399]/10 text-[#34d399]',
  POST: 'bg-[#818cf8]/10 text-[#818cf8]',
  PUT: 'bg-[#fb923c]/10 text-[#fb923c]',
  PATCH: 'bg-[#60a5fa]/10 text-[#60a5fa]',
  DELETE: 'bg-[#f87171]/10 text-[#f87171]',
}

function SessionTimeline({
  session,
  projectId,
  onEventClick,
}: {
  session: Session
  projectId: string | null
  onEventClick: (id: string) => void
}) {
  const { data, isLoading, isError } = useSessionTimeline(session, projectId)
  const events = data?.data ?? []

  if (isLoading) return <p className="text-xs text-muted-foreground py-3 px-1">Loading events...</p>
  if (isError) return <p className="text-xs text-destructive py-3 px-1">Failed to load events.</p>
  if (events.length === 0) return <p className="text-xs text-muted-foreground py-3 px-1">No events found.</p>

  return (
    <div className="mt-3 border-t border-border/40 pt-3 space-y-1">
      <p className="text-xs text-muted-foreground mb-2">{events.length} events</p>
      {events.map(event => {
        const statusClass = STATUS_COLORS[String(event.status_code)[0]] ?? 'bg-secondary text-muted-foreground'
        const methodClass = METHOD_COLORS[event.method as string] ?? 'bg-secondary/40 text-muted-foreground'
        return (
          <button
            key={event.id}
            onClick={() => onEventClick(event.id as string)}
            className="w-full text-left flex items-center gap-3 px-2 py-1.5 rounded hover:bg-secondary/40 transition-colors group"
          >
            <span className="text-xs text-muted-foreground font-mono w-28 shrink-0">
              {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded font-mono shrink-0 ${methodClass}`}>
              {event.method}
            </span>
            <span className="text-xs font-mono text-foreground truncate flex-1 group-hover:text-white transition-colors">
              {event.path}
            </span>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${statusClass}`}>
              {event.status_code}
            </span>
            {event.response_time != null && (
              <span className="text-xs text-muted-foreground font-mono w-16 text-right shrink-0">
                {event.response_time}ms
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

function SessionsPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false })
  const { selectedProjectId } = useProject()
  const [filterOpen, setFilterOpen] = React.useState(false)
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null)
  const [sessionIDInput, setSessionIDInput] = React.useState('')
  const [lookupSessionID, setLookupSessionID] = React.useState<string | null>(null)
  const { data: sessionDetail, isLoading: sessionDetailLoading } = useSessionByID(lookupSessionID)

  const filters = {
    projectId: selectedProjectId,
    identifier: search.identifier,
    service_name: search.service_name,
    start_date: search.start_date,
    end_date: search.end_date,
  }

  const { data: sessions = [], isLoading, isError } = useAuditSessions(filters)

  const hasFilters = !!(search.identifier || search.service_name || search.start_date || search.end_date)

  function setFilter(key: string, value: string) {
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, [key]: value || undefined }) })
  }

  function clearFilters() {
    navigate({ search: {} })
  }

  function toggleSession(session: Session) {
    const key = sessionKey(session)
    setExpandedKey(prev => (prev === key ? null : key))
  }

  return (
    <main className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-slate-500" />
            Sessions
          </h1>
          <p className="text-sm text-muted-foreground">
            User sessions derived from audit events — 30 min inactivity gap = new session
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
          <Button
            variant={filterOpen ? 'secondary' : 'outline'}
            size="sm"
            className="gap-2"
            onClick={() => setFilterOpen(v => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-[#818cf8]" />}
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <Card className="p-4 border-border/50 bg-card/60 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Identifier</p>
              <Input
                placeholder="user-id or client-id"
                value={search.identifier ?? ''}
                onChange={e => setFilter('identifier', e.target.value)}
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Service</p>
              <Input
                placeholder="service-name"
                value={search.service_name ?? ''}
                onChange={e => setFilter('service_name', e.target.value)}
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Start date</p>
              <Input
                type="datetime-local"
                value={search.start_date ?? ''}
                onChange={e => setFilter('start_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="text-xs h-8"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">End date</p>
              <Input
                type="datetime-local"
                value={search.end_date ?? ''}
                onChange={e => setFilter('end_date', e.target.value ? new Date(e.target.value).toISOString() : '')}
                className="text-xs h-8"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Explicit session_id lookup */}
      <Card className="p-4 border-border/50 bg-card/60">
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5" />
          Look up session by explicit ID
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="session-id passed via SDK"
            value={sessionIDInput}
            onChange={e => setSessionIDInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setLookupSessionID(sessionIDInput.trim() || null) }}
            className="text-xs h-8 font-mono"
          />
          <Button size="sm" className="h-8 text-xs" onClick={() => setLookupSessionID(sessionIDInput.trim() || null)}>
            Lookup
          </Button>
          {lookupSessionID && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setLookupSessionID(null); setSessionIDInput('') }}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        {lookupSessionID && (
          <div className="mt-3">
            {sessionDetailLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : !sessionDetail ? (
              <p className="text-xs text-destructive">No session found for ID: {lookupSessionID}</p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-4 text-xs">
                  <span className="text-muted-foreground">Identifier: <span className="text-foreground font-mono">{sessionDetail.identifier}</span></span>
                  <span className="text-muted-foreground">Service: <span className="text-foreground font-mono">{sessionDetail.service_name}</span></span>
                  <span className="text-muted-foreground">Duration: <span className="text-[#2dd4bf]">{formatDuration(sessionDetail.duration_seconds)}</span></span>
                  <span className="text-muted-foreground">Events: <span className="text-[#818cf8]">{sessionDetail.event_count}</span></span>
                  <span className="text-muted-foreground">{formatTime(sessionDetail.session_start)} → {formatTime(sessionDetail.session_end)}</span>
                </div>
                <div className="border-t border-border/40 pt-2 space-y-1 max-h-64 overflow-y-auto">
                  {sessionDetail.events.map(event => {
                    const statusClass = STATUS_COLORS[String(event.status_code)[0]] ?? 'bg-secondary text-muted-foreground'
                    const methodClass = METHOD_COLORS[event.method] ?? 'bg-secondary/40 text-muted-foreground'
                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className="w-full text-left flex items-center gap-3 px-2 py-1.5 rounded hover:bg-secondary/40 transition-colors group"
                      >
                        <span className="text-xs text-muted-foreground font-mono w-28 shrink-0">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded font-mono shrink-0 ${methodClass}`}>{event.method}</span>
                        <span className="text-xs font-mono text-foreground truncate flex-1">{event.path}</span>
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded shrink-0 ${statusClass}`}>{event.status_code}</span>
                        {event.response_time != null && (
                          <span className="text-xs text-muted-foreground font-mono w-16 text-right shrink-0">{event.response_time}ms</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Content */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sessions...</p>
      ) : isError ? (
        <Card className="p-6 border-destructive/30 bg-destructive/10 text-destructive text-sm">
          Failed to load sessions. Check your connection and try again.
        </Card>
      ) : sessions.length === 0 ? (
        <Card className="p-8 border-border/50 text-center">
          <p className="text-sm text-muted-foreground">No sessions found.</p>
          {hasFilters && (
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters.</p>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((session, idx) => {
            const key = sessionKey(session)
            const isExpanded = expandedKey === key
            return (
              <Card
                key={`${key}-${idx}`}
                className="p-4 border-border/50 bg-card/60 hover:bg-[#232640] transition-colors cursor-pointer"
                onClick={() => toggleSession(session)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    }
                    <User className="h-4 w-4 text-[#818cf8] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground font-mono truncate">
                        {session.identifier}
                      </p>
                      <Badge variant="secondary" className="text-xs mt-0.5">
                        {session.service_name}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground">Duration</p>
                      <p className="text-sm font-medium text-[#2dd4bf]">
                        {formatDuration(session.duration_seconds)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Events</p>
                      <p className="text-sm font-medium text-[#818cf8]">
                        {session.event_count.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatTime(session.session_start)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        → {formatTime(session.session_end)}
                      </p>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div onClick={e => e.stopPropagation()}>
                    <SessionTimeline
                      session={session}
                      projectId={selectedProjectId}
                      onEventClick={setSelectedEventId}
                    />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Showing up to 200 most recent sessions
      </p>

      <EventDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
    </main>
  )
}
