# @bataudit/browser

Official browser SDK for [BatAudit](https://github.com/joaovrmoraes/bataudit) — self-hosted audit logging platform.

Automatically intercepts all `fetch` and `XMLHttpRequest` calls and sends audit events to the BatAudit Writer.

## Installation

```bash
npm install @bataudit/browser
# or
pnpm add @bataudit/browser
```

## Quick Start

```ts
import { init } from '@bataudit/browser'

const bataudit = init({
  apiKey: 'your-api-key',
  serviceName: 'my-spa',
  writerUrl: 'http://localhost:8081',
  environment: 'prod',
})

// After login — attach user context:
bataudit.client.setUser({
  identifier: user.id,
  userEmail: user.email,
  userRoles: user.roles,
})

// After logout — clear user context:
bataudit.client.clearUser()
```

All `fetch` and `XHR` requests made after `init()` are intercepted automatically. No further setup needed.

## Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `apiKey` | `string` | Yes | — | API Key from BatAudit dashboard |
| `serviceName` | `string` | Yes | — | Name of this service (e.g. `"my-spa"`) |
| `writerUrl` | `string` | Yes | — | BatAudit Writer URL |
| `environment` | `'prod' \| 'staging' \| 'dev'` | No | `'prod'` | Deployment environment |

## User Context

```ts
bataudit.client.setUser({
  identifier: 'user-123',     // required
  userEmail: 'user@example.com',
  userName: 'Jane Doe',
  userRoles: ['admin'],
  userType: 'internal',
  tenantId: 'tenant-456',
})
```

Before `setUser()` is called, events are sent with `identifier: "anonymous"`.

## Stopping Interception

```ts
bataudit.unpatch()
```

Restores the original `fetch` and `XMLHttpRequest` implementations.

## Flushing In-Flight Events

```ts
await bataudit.client.flush()
```

Waits for all in-flight audit events to be delivered. Useful before page unload or during tests.

## Orphan Events

The browser SDK records each request *before* it is sent to the backend. If the backend never logs a matching audit event (e.g. a Lambda hard-kill, a crash, or a network drop), BatAudit marks it as an **orphan event**.

The dashboard shows a banner with the count of orphan events in the last 24 hours, and you can query them via `GET /v1/audit/orphans`.

> This is the recommended way to detect backend crashes that the [`@bataudit/node`](../node/README.md) SDK cannot capture (e.g. OOM kills, infrastructure timeouts).

## Request ID

The SDK generates a `request_id` in the format `bat-<uuid>` for each intercepted request and injects it in the `X-Request-ID` header. This enables end-to-end correlation between the browser event and the backend audit event.

If a request already has an `X-Request-ID` header, that value is used instead.

## Retry Behavior

Failed sends are retried up to 3 times with exponential backoff (100 ms → 200 ms → 400 ms). After all retries are exhausted the event is silently dropped — audit logging never throws or blocks the application.
