# Frontend

React dashboard for visualizing BatAudit audit events, managing projects, API keys, and monitoring sessions.

## Stack

| Tool | Version | Role |
|---|---|---|
| React | 19 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 7 | Build tool and dev server |
| TanStack Router | 1.x | File-based routing with search param validation (zod) |
| TanStack Query | 5.x | Server state, caching, auto-refresh |
| Tailwind CSS | 4 | Utility-first styling |
| shadcn/ui | — | Component primitives (Radix UI) |
| Recharts (via shadcn) | 3.x | Charts (area, bar, donut) |
| Lucide React | — | Icons |

---

## Pages

| Route | Description |
|-------|-------------|
| `/login` | Login form — email + password → JWT |
| `/setup` | First-run wizard to create the owner account |
| `/app/` | Main dashboard — metrics, charts, event feed, filters, event detail modal |
| `/app/sessions` | User sessions — expandable timeline per session |
| `/app/settings/api-keys` | API Keys + project member management (tabs) |

---

## Architecture

The frontend separates API access into two layers:

```
src/http/       → Pure fetch functions (no React state)
src/queries/    → useQuery / useMutation hooks (TanStack Query)
```

`src/lib/project-context.tsx` provides a global `selectedProjectId` (React Context). `null` = "All Projects" (owner only). The project selector in the header updates this context; all queries re-fetch automatically.

---

## Project structure

```
src/
├── components/
│   ├── ui/                    # shadcn/ui primitives
│   ├── header.tsx             # Nav bar with project selector + logout
│   └── app-pagination.tsx
├── http/
│   └── audit/
│       ├── list.tsx           # GET /v1/audit (filters + sort)
│       ├── stats.ts           # GET /v1/audit/stats
│       ├── sessions.ts        # GET /v1/audit/sessions
│       └── details.ts         # GET /v1/audit/:id
│   ├── auth/logout.ts
│   ├── members/index.ts
│   └── projects/ (via auth queries)
├── queries/
│   ├── audit.ts               # useAuditList, useAuditStats, useAuditSessions,
│   │                          # useAuditDetail, useSessionTimeline
│   ├── auth.ts                # useLogout
│   ├── projects.ts            # useProjects, useCreateProject
│   ├── api-keys.ts            # useAPIKeys, useCreateAPIKey, useRevokeAPIKey
│   └── members.ts             # useMembers, useAddMember, useUpdateMemberRole, useRemoveMember
├── routes/
│   ├── __root.tsx             # Root layout (QueryClientProvider, ProjectProvider, Header)
│   ├── login.tsx
│   ├── setup.tsx
│   └── app/
│       ├── _layout.tsx
│       ├── index.tsx          # Dashboard page
│       ├── sessions.tsx       # Sessions page
│       ├── settings/
│       │   └── api-keys.tsx   # API Keys + Members settings
│       └── components/
│           ├── event-detail-modal.tsx
│           ├── event-card.tsx
│           └── status-indicator.tsx
└── lib/
    ├── auth.ts                # JWT storage + authHeader()
    ├── project-context.tsx    # Global project selection context
    └── utils.ts
```

---

## Environment variables

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Reader base URL | `http://localhost:8082` |

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:8082
```

---

## Running locally

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:5173)
pnpm dev

# Build for production
pnpm build
```

The production build outputs to `dist/`. In production, the Reader serves assets at `/app`.

---

## Notes

- All filters and sort options in the dashboard are persisted in the URL via TanStack Router search params
- The dashboard auto-refreshes every 60 seconds (stats + event list)
- Sessions page expands inline per-session event timelines; clicking an event opens the full detail modal
- Dark mode only; light mode planned in Phase 10
