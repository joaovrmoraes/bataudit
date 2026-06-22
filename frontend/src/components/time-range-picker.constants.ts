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
