"use client"

import React from 'react'
import { format, parse, isValid } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RelativeRange =
  | '5m' | '15m' | '30m'
  | '1h' | '3h' | '6h' | '12h' | '24h'
  | '3d' | '7d' | '30d'

export const RELATIVE_LABELS: Record<RelativeRange, string> = {
  '5m':  'Last 5 minutes',
  '15m': 'Last 15 minutes',
  '30m': 'Last 30 minutes',
  '1h':  'Last 1 hour',
  '3h':  'Last 3 hours',
  '6h':  'Last 6 hours',
  '12h': 'Last 12 hours',
  '24h': 'Last 24 hours',
  '3d':  'Last 3 days',
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
}

// Quick chips shown inline in the toolbar
const QUICK_PRESETS: RelativeRange[] = ['5m', '30m', '1h', '3h', '12h']
const QUICK_LABELS: Record<string, string> = {
  '5m': '5m', '30m': '30m', '1h': '1h', '3h': '3h', '12h': '12h',
}

// Left column of the Custom panel
const RELATIVE_ROWS: { label: string; presets: RelativeRange[]; chips: string[] }[] = [
  {
    label: 'Minutes',
    presets: ['5m', '15m', '30m'],
    chips: ['5 minutes', '15 minutes', '30 minutes'],
  },
  {
    label: 'Hours',
    presets: ['1h', '3h', '6h', '12h', '24h'],
    chips: ['1 hour', '3 hours', '6 hours', '12 hours', '24 hours'],
  },
  {
    label: 'Days',
    presets: ['3d', '7d', '30d'],
    chips: ['3 days', '7 days', '30 days'],
  },
]

interface TimeRangePickerProps {
  timeRange?: string
  startDate?: string
  endDate?: string
  onRelative: (range: RelativeRange) => void
  onAbsolute: (start: string, end: string) => void
  onClear: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (!isValid(d)) return ''
  return format(d, 'yyyy-MM-dd')
}

function toTimeStr(iso?: string) {
  if (!iso) return '00:00'
  const d = new Date(iso)
  if (!isValid(d)) return '00:00'
  return format(d, 'HH:mm')
}

function buildDate(dateStr: string, timeStr: string): Date | null {
  if (!dateStr) return null
  const d = parse(`${dateStr} ${timeStr || '00:00'}`, 'yyyy-MM-dd HH:mm', new Date())
  return isValid(d) ? d : null
}

// ── Main component ────────────────────────────────────────────────────────────

export function TimeRangePicker({
  timeRange,
  startDate,
  endDate,
  onRelative,
  onAbsolute,
  onClear,
}: TimeRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Absolute panel state — text inputs drive the calendar, and vice-versa
  const [startDateStr, setStartDateStr] = React.useState('')
  const [startTimeStr, setStartTimeStr] = React.useState('00:00')
  const [endDateStr,   setEndDateStr]   = React.useState('')
  const [endTimeStr,   setEndTimeStr]   = React.useState('23:59')
  const [range, setRange] = React.useState<DateRange | undefined>()

  // Seed state from props when popover opens
  React.useEffect(() => {
    if (open) {
      const sd = toDateStr(startDate)
      const ed = toDateStr(endDate)
      setStartDateStr(sd)
      setStartTimeStr(toTimeStr(startDate))
      setEndDateStr(ed)
      setEndTimeStr(toTimeStr(endDate))
      setRange({
        from: sd ? new Date(startDate!) : undefined,
        to:   ed ? new Date(endDate!)   : undefined,
      })
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep text inputs in sync when calendar range changes
  function handleCalendarSelect(r: DateRange | undefined) {
    setRange(r)
    if (r?.from) {
      setStartDateStr(format(r.from, 'yyyy-MM-dd'))
    }
    if (r?.to) {
      setEndDateStr(format(r.to, 'yyyy-MM-dd'))
    }
  }

  // Keep calendar in sync when text inputs change
  function handleStartDateChange(v: string) {
    setStartDateStr(v)
    const d = buildDate(v, startTimeStr)
    if (d) setRange(prev => ({ from: d, to: prev?.to }))
  }
  function handleEndDateChange(v: string) {
    setEndDateStr(v)
    const d = buildDate(v, endTimeStr)
    if (d) setRange(prev => ({ from: prev?.from, to: d }))
  }

  function handleRelative(r: RelativeRange) {
    onRelative(r)
    setOpen(false)
  }

  function handleApply() {
    const from = buildDate(startDateStr, startTimeStr)
    if (!from) return
    const to = buildDate(endDateStr, endTimeStr) ?? from
    onAbsolute(from.toISOString(), to.toISOString())
    setOpen(false)
  }

  // Is the current timeRange one of the quick presets?
  const isNonQuick = timeRange && !QUICK_PRESETS.includes(timeRange as RelativeRange)
  // "Custom" chip is active when a non-quick relative or a custom absolute is set
  const isCustomActive = !!isNonQuick || timeRange === 'custom'

  const customLabel = isNonQuick
    ? (RELATIVE_LABELS[timeRange as RelativeRange] ?? timeRange!)
    : timeRange === 'custom' && startDate
      ? `${format(new Date(startDate), 'MMM d HH:mm')}${endDate ? ` — ${format(new Date(endDate), 'MMM d HH:mm')}` : ''}`
      : 'Custom'

  return (
    <div className="flex items-center gap-0.5">
      {/* ── Quick chips ────────────────────────────────────────────────── */}
      {QUICK_PRESETS.map(preset => {
        const active = timeRange === preset
        return (
          <button
            key={preset}
            onClick={() => handleRelative(preset)}
            className={cn(
              'h-8 px-3 text-xs font-medium rounded-md border transition-colors',
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
            )}
          >
            {QUICK_LABELS[preset]}
          </button>
        )
      })}

      {/* ── Custom chip + panel ────────────────────────────────────────── */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'h-8 px-3 text-xs font-medium rounded-md border transition-colors flex items-center gap-1 max-w-[200px]',
              isCustomActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
            )}
          >
            <span className="truncate">{isCustomActive ? customLabel : 'Custom'}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          side="bottom"
          sideOffset={6}
          className="w-auto p-0 border-border/60 bg-card shadow-2xl"
        >
          <div className="flex">
            {/* ── Left: Relative presets ─────────────────────────────── */}
            <div className="w-[230px] border-r border-border/60 p-4 space-y-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Relative</p>
              <div className="space-y-3">
                {RELATIVE_ROWS.map(({ label, presets, chips }) => (
                  <div key={label} className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
                    <div className="flex flex-wrap gap-1">
                      {presets.map((preset, i) => {
                        const active = timeRange === preset
                        return (
                          <button
                            key={preset}
                            onClick={() => handleRelative(preset)}
                            className={cn(
                              'px-2 py-1 rounded text-xs border transition-colors',
                              active
                                ? 'bg-primary text-primary-foreground border-primary font-medium'
                                : 'bg-background text-foreground border-border hover:border-primary/50 hover:bg-primary/5',
                            )}
                          >
                            {chips[i]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Clear */}
              {(timeRange || startDate) && (
                <div className="pt-2 border-t border-border/40">
                  <button
                    onClick={() => { onClear(); setOpen(false) }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear selection
                  </button>
                </div>
              )}
            </div>

            {/* ── Right: Absolute ────────────────────────────────────── */}
            <div className="flex flex-col">
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Absolute</p>

                {/* Editable date + time inputs */}
                <div className="flex items-end gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Start date</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={startDateStr}
                        onChange={e => handleStartDateChange(e.target.value)}
                        className="h-8 w-[130px] rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                      />
                      <input
                        type="time"
                        value={startTimeStr}
                        onChange={e => setStartTimeStr(e.target.value)}
                        className="h-8 w-[90px] rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                      />
                    </div>
                  </div>

                  <span className="text-muted-foreground text-sm pb-1">—</span>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">End date</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={endDateStr}
                        onChange={e => handleEndDateChange(e.target.value)}
                        className="h-8 w-[130px] rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                      />
                      <input
                        type="time"
                        value={endTimeStr}
                        onChange={e => setEndTimeStr(e.target.value)}
                        className="h-8 w-[90px] rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Dual calendar */}
              <Calendar
                mode="range"
                numberOfMonths={2}
                selected={range}
                onSelect={handleCalendarSelect}
                className="p-3 border-t border-border/40"
              />

              {/* Apply row */}
              <div className="px-4 py-3 border-t border-border/60 bg-muted/10 flex items-center justify-end">
                <Button
                  size="sm"
                  onClick={handleApply}
                  disabled={!startDateStr}
                  className="h-7 text-xs px-5"
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
