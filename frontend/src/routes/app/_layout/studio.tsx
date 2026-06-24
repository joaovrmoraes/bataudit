import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { LayoutGrid, Plus, Save, FileDown, Pencil, Trash2, Play, Loader2, X } from 'lucide-react'
import {
  runQuery, listReports, getReport, createReport, updateReport,
  type Report, type Widget, type GridItem, type VizType, type QueryResult,
} from '@/http/studio'
import { useProject } from '@/lib/project-context'

export const Route = createFileRoute('/app/_layout/studio')({
  component: StudioPage,
})

const PIE_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#c084fc', '#f472b6', '#2dd4bf']

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function StudioPage() {
  const { selectedProjectId } = useProject()
  const [reports, setReports] = React.useState<Report[]>([])
  const [reportId, setReportId] = React.useState<string | null>(null)
  const [name, setName] = React.useState('Untitled report')
  const [widgets, setWidgets] = React.useState<Widget[]>([])
  const [layout, setLayout] = React.useState<GridItem[]>([])
  const [editing, setEditing] = React.useState<Widget | null>(null)
  const [saving, setSaving] = React.useState(false)

  const loadList = React.useCallback(async () => {
    try { setReports(await listReports(selectedProjectId ?? undefined)) } catch { /* ignore */ }
  }, [selectedProjectId])

  React.useEffect(() => { void loadList() }, [loadList])

  async function openReport(id: string) {
    const r = await getReport(id)
    setReportId(r.id)
    setName(r.name)
    setWidgets(r.widgets ?? [])
    setLayout(r.layout ?? [])
  }

  function newReport() {
    setReportId(null)
    setName('Untitled report')
    setWidgets([])
    setLayout([])
  }

  function addOrUpdateWidget(w: Widget) {
    setWidgets((prev) => {
      const exists = prev.some((x) => x.id === w.id)
      return exists ? prev.map((x) => (x.id === w.id ? w : x)) : [...prev, w]
    })
    setLayout((prev) => {
      if (prev.some((l) => l.i === w.id)) return prev
      const y = prev.reduce((m, l) => Math.max(m, l.y + l.h), 0)
      return [...prev, { i: w.id, x: 0, y, w: 6, h: 8 }]
    })
    setEditing(null)
  }

  function removeWidget(id: string) {
    setWidgets((p) => p.filter((w) => w.id !== id))
    setLayout((p) => p.filter((l) => l.i !== id))
  }

  async function save() {
    setSaving(true)
    try {
      if (reportId) {
        await updateReport(reportId, { name, widgets, layout })
      } else {
        const r = await createReport({ project_id: selectedProjectId ?? undefined, name, widgets, layout })
        setReportId(r.id)
      }
      await loadList()
    } finally {
      setSaving(false)
    }
  }

  function exportPDF() {
    window.print()
  }

  return (
    <div className="p-6">
      {/* Toolbar (hidden on print) */}
      <div className="print:hidden flex items-center gap-2 mb-4">
        <LayoutGrid className="h-5 w-5 text-primary" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-transparent text-xl font-semibold text-foreground outline-none border-b border-transparent focus:border-border px-1"
        />
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setEditing({ id: uid(), title: 'New widget', sql: 'SELECT method, count(*) AS hits\nFROM audits\nGROUP BY method\nORDER BY hits DESC', viz: 'table' })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary/40">
            <Plus className="h-4 w-4" /> Add widget
          </button>
          <button onClick={() => void save()} disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
          <button onClick={exportPDF}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary/40">
            <FileDown className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Saved reports (hidden on print) */}
      {reports.length > 0 && (
        <div className="print:hidden flex items-center gap-2 mb-4 text-xs">
          <button onClick={newReport} className="rounded border border-border px-2 py-1 text-muted-foreground hover:text-primary">+ New</button>
          {reports.map((r) => (
            <button key={r.id} onClick={() => void openReport(r.id)}
              className={`rounded border px-2 py-1 ${reportId === r.id ? 'border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
              {r.name}
            </button>
          ))}
        </div>
      )}

      {/* Print-only header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">{name}</h1>
        <p className="text-sm text-gray-500">Generated {new Date().toLocaleString()}</p>
      </div>

      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-muted-foreground border border-dashed border-border rounded-lg">
          <LayoutGrid className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">No widgets yet. Click <span className="text-foreground">Add widget</span> to start.</p>
        </div>
      ) : (
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={30}
          width={1100}
          onLayoutChange={(l) => setLayout(l.map((it) => ({ i: it.i, x: it.x, y: it.y, w: it.w, h: it.h })))}
          draggableHandle=".widget-drag"
          isResizable
          isDraggable
        >
          {widgets.map((w) => (
            <div key={w.id} className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">
              <WidgetView widget={w} onEdit={() => setEditing(w)} onRemove={() => removeWidget(w.id)} />
            </div>
          ))}
        </GridLayout>
      )}

      {editing && (
        <WidgetEditor
          widget={editing}
          onClose={() => setEditing(null)}
          onSave={addOrUpdateWidget}
        />
      )}
    </div>
  )
}

// ── Widget rendering ─────────────────────────────────────────────────────────

function WidgetView({ widget, onEdit, onRemove }: { widget: Widget; onEdit: () => void; onRemove: () => void }) {
  const [result, setResult] = React.useState<QueryResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    runQuery(widget.sql)
      .then((r) => active && setResult(r))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'error'))
    return () => { active = false }
  }, [widget.sql])

  return (
    <>
      <div className="widget-drag cursor-move flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
        <span className="text-sm font-medium text-foreground truncate">{widget.title}</span>
        <span className="text-[10px] uppercase text-muted-foreground border border-border rounded px-1">{widget.viz}</span>
        <div className="ml-auto flex items-center gap-1 print:hidden">
          <button onClick={onEdit} className="text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onRemove} className="text-muted-foreground hover:text-[#f87171]"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-2">
        {error ? (
          <p className="text-xs text-[#f87171] font-mono p-2">{error}</p>
        ) : !result ? (
          <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          <VizRender result={result} viz={widget.viz} />
        )}
      </div>
    </>
  )
}

function VizRender({ result, viz }: { result: QueryResult; viz: VizType }) {
  if (result.rows.length === 0) return <p className="text-xs text-muted-foreground p-2">No rows.</p>

  if (viz === 'table') {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr>{result.columns.map((c) => <th key={c} className="text-left font-mono text-muted-foreground px-2 py-1 border-b border-border whitespace-nowrap">{c}</th>)}</tr>
        </thead>
        <tbody>
          {result.rows.map((row, ri) => (
            <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="px-2 py-1 border-b border-border/30 font-mono text-foreground/90 whitespace-nowrap">{cell === null ? '—' : String(cell)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    )
  }

  // chart data: first column = label/x, second = value
  const xKey = result.columns[0]
  const yKey = result.columns[1] ?? result.columns[0]
  const data = result.rows.map((r) => ({ [xKey]: String(r[0]), [yKey]: Number(r[1]) || 0 }))

  if (viz === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%" minHeight={120}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} width={32} />
          <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2d3350', fontSize: 12 }} />
          <Line type="monotone" dataKey={yKey} stroke="#818cf8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // pie
  return (
    <ResponsiveContainer width="100%" height="100%" minHeight={120}>
      <PieChart>
        <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius="80%" label={{ fontSize: 10 }}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={{ background: '#1e2130', border: '1px solid #2d3350', fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Widget editor ────────────────────────────────────────────────────────────

function WidgetEditor({ widget, onClose, onSave }: { widget: Widget; onClose: () => void; onSave: (w: Widget) => void }) {
  const [title, setTitle] = React.useState(widget.title)
  const [sql, setSql] = React.useState(widget.sql)
  const [viz, setViz] = React.useState<VizType>(widget.viz)
  const [preview, setPreview] = React.useState<QueryResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function run() {
    setLoading(true); setError(null)
    try { setPreview(await runQuery(sql)) } catch (e) { setError(e instanceof Error ? e.message : 'error'); setPreview(null) } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
      <div className="w-[760px] max-h-[85vh] overflow-auto bg-card border border-border rounded-lg shadow-xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <p className="font-medium text-foreground">Widget</p>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
              className="flex-1 bg-[#0d1117] border border-border rounded px-3 py-1.5 text-sm text-foreground outline-none" />
            <select value={viz} onChange={(e) => setViz(e.target.value as VizType)}
              className="bg-[#0d1117] border border-border rounded px-3 py-1.5 text-sm text-foreground outline-none">
              <option value="table">Table</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
            </select>
          </div>
          <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={6} spellCheck={false}
            className="w-full resize-y bg-[#0d1117] border border-border rounded text-foreground font-mono text-sm p-3 outline-none" />
          <div className="flex items-center gap-2">
            <button onClick={() => void run()} disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-secondary/40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Preview
            </button>
            <span className="text-xs text-muted-foreground">first column = label · second = value (line/pie)</span>
          </div>
          {error && <p className="text-xs text-[#f87171] font-mono">{error}</p>}
          {preview && (
            <div className="border border-border rounded h-40 overflow-auto">
              <VizRender result={preview} viz={viz} />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button onClick={() => onSave({ id: widget.id, title, sql, viz })}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            Add to report
          </button>
        </div>
      </div>
    </div>
  )
}
