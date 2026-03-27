# Frontend

React dashboard for visualizing BatAudit events and monitoring system health.

## Stack

| Tool | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | — | Type safety |
| Vite | 7 | Build tool and dev server |
| TanStack Router | 1.x | File-based routing |
| TanStack Query | 5.x | Server state and data fetching |
| Tailwind CSS | 4 | Utility-first styling |
| shadcn/ui | — | UI component primitives (Radix UI) |
| Lucide React | — | Icons |
| Biome | — | Linting and formatting |

## Pages

| Route | Description |
|---|---|
| `/app` | Main dashboard — health status + paginated event feed |

## API calls

All API calls target the Reader service. The base URL is currently hardcoded to `http://localhost:8080` — this will be replaced by a `VITE_API_URL` environment variable (Phase prerequisites in the roadmap).

| Function | Endpoint | Description |
|---|---|---|
| `ListAudit(page, limit)` | `GET /audit` | Paginated list of audit events |
| `getHealthDetails()` | `GET /health` | System health metrics |

## Project structure

```
src/
├── components/          # Shared UI components
│   ├── ui/             # shadcn/ui primitives (Badge, Button, Card, etc.)
│   ├── header.tsx      # Top navigation bar
│   └── app-pagination.tsx
├── http/               # API client functions
│   ├── audit/list.tsx
│   ├── health/details.tsx
│   └── query-client.ts
├── routes/             # File-based routes (TanStack Router)
│   ├── __root.tsx      # Root layout (QueryClientProvider, Header)
│   └── app/
│       ├── _layout.tsx
│       ├── index.tsx   # Dashboard page
│       └── components/
│           ├── event-card.tsx      # Individual audit event display
│           ├── health-status.tsx   # Health metrics grid
│           └── status-indicator.tsx
└── lib/
    └── utils.ts
```

## Running locally

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build
```

The production build outputs to `dist/`. In production, the Reader service serves the built assets at `/app`.

## Development notes

- The dev server proxies nothing by default — the Reader and Writer must be running locally or accessible at their hardcoded addresses
- The app uses a dark gradient background by default; light mode is not yet implemented (planned in Phase 10)
- The "Filter" button on the event feed is not yet functional (planned in Phase 6.2)
