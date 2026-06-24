import { createFileRoute } from '@tanstack/react-router'
import React from 'react'
import { Play, Database, AlertCircle, Loader2 } from 'lucide-react'
import { runQuery, type QueryResult } from '@/http/studio'

export const Route = createFileRoute('/app/_layout/query')({
  component: QueryPage,
})

const EXAMPLES: { label: string; sql: string }[] = [
  {
    label: 'Recent 5xx errors',
    sql: "SELECT timestamp, identifier, method, path, status_code\nFROM audits\nWHERE status_code >= 500\nORDER BY timestamp DESC\nLIMIT 50",
  },
  {
    label: 'Who changed a resource',
    sql: "SELECT timestamp, identifier, user_email, method, path\nFROM audits\nWHERE path LIKE '%/assets/%' AND method IN ('PUT','PATCH','DELETE')\nORDER BY timestamp DESC",
  },
  {
    label: 'Top routes by volume',
    sql: 'SELECT path, method, count(*) AS hits\nFROM audits\nGROUP BY path, method\nORDER BY hits DESC\nLIMIT 20',
  },
  {
    label: 'Slowest routes',
    sql: 'SELECT path, round(avg(response_time)) AS avg_ms, count(*) AS hits\nFROM audits\nGROUP BY path\nORDER BY avg_ms DESC\nLIMIT 20',
  },
]

const SCHEMA = [
  'timestamp', 'identifier', 'user_email', 'user_name', 'user_type', 'tenant_id',
  'method', 'path', 'status_code', 'response_time', 'service_name', 'environment',
  'event_type', 'source', 'ip', 'user_agent', 'request_id', 'session_id', 'error_message',
]

function QueryPage() {
  const [sql, setSql] = React.useState(EXAMPLES[0].sql)
  const [result, setResult] = React.useState<QueryResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  const run = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await runQuery(sql)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Query failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [sql])

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void run()
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">Query</h1>
        <span className="text-xs text-muted-foreground">read-only SQL over your audit logs</span>
      </div>

      <div className="flex gap-4 items-start">
        {/* Editor + results */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              rows={8}
              className="w-full resize-y bg-[#0d1117] text-foreground font-mono text-sm p-4 outline-none"
              placeholder="SELECT * FROM audits LIMIT 100"
            />
            <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-card">
              <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to run</span>
              <button
                onClick={() => void run()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Run
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-[#f87171]/40 bg-[#f87171]/10 px-3 py-2 text-sm text-[#f87171]">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="font-mono break-words">{error}</span>
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-3 py-2 border-b border-border text-xs text-muted-foreground">
                <span>{result.row_count} row{result.row_count !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{result.elapsed_ms} ms</span>
                {result.truncated && <span className="text-[#fbbf24]">· truncated to 1000</span>}
              </div>
              <ResultTable result={result} />
            </div>
          )}
        </div>

        {/* Helper sidebar */}
        <div className="w-64 shrink-0 space-y-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold text-foreground mb-2">Examples</p>
            <div className="space-y-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => setSql(ex.sql)}
                  className="block w-full text-left text-xs text-muted-foreground hover:text-primary rounded px-2 py-1 hover:bg-secondary/40"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs font-semibold text-foreground mb-2">Table: <span className="font-mono">audits</span></p>
            <div className="flex flex-wrap gap-1">
              {SCHEMA.map((col) => (
                <button
                  key={col}
                  onClick={() => setSql((s) => s + (s.endsWith(' ') || s === '' ? '' : ' ') + col)}
                  className="font-mono text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 hover:text-primary hover:border-primary/40"
                >
                  {col}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Read-only. Only SELECT runs.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultTable({ result }: { result: QueryResult }) {
  if (result.columns.length === 0) {
    return <p className="px-4 py-6 text-sm text-muted-foreground text-center">No columns.</p>
  }
  return (
    <div className="overflow-auto max-h-[55vh]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-[#0d1117]">
          <tr>
            {result.columns.map((c) => (
              <th key={c} className="text-left font-mono font-semibold text-muted-foreground px-3 py-2 border-b border-border whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-secondary/30">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-1.5 border-b border-border/40 font-mono text-foreground/90 whitespace-nowrap max-w-xs truncate">
                  {cell === null ? <span className="text-muted-foreground italic">null</span> : String(cell)}
                </td>
              ))}
            </tr>
          ))}
          {result.rows.length === 0 && (
            <tr><td colSpan={result.columns.length} className="px-4 py-6 text-center text-muted-foreground">No rows.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
