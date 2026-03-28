# @bataudit/node

Official Node.js SDK for [BatAudit](https://github.com/joaovrmoraes/bataudit) — self-hosted audit logging platform.

## Installation

```bash
npm install @bataudit/node
# or
pnpm add @bataudit/node
```

## Quick Start

### Express

```ts
import { createExpressMiddleware } from '@bataudit/node'

app.use(createExpressMiddleware({
  apiKey: 'your-api-key',
  serviceName: 'payments-api',
  writerUrl: 'http://localhost:8081',
  environment: 'prod',
}))

// Attach user context in your auth middleware:
app.use((req, res, next) => {
  req.bataudit = {
    identifier: req.user.id,
    userEmail: req.user.email,
    userRoles: req.user.roles,
  }
  next()
})
```

### Fastify

```ts
import { applyBatAuditPlugin } from '@bataudit/node'

// Must be called before routes are registered
applyBatAuditPlugin(app, {
  apiKey: 'your-api-key',
  serviceName: 'payments-api',
  writerUrl: 'http://localhost:8081',
  environment: 'prod',
})

// Attach user context in your auth hook:
app.addHook('onRequest', async (request) => {
  request.bataudit = {
    identifier: request.user.id,
    userEmail: request.user.email,
  }
})
```

### Lambda

```ts
import { createLambdaWrapper } from '@bataudit/node'

const wrap = createLambdaWrapper({
  apiKey: 'your-api-key',
  serviceName: 'process-payment',
  writerUrl: 'http://bataudit.internal:8081',
  environment: 'prod',
})

export const handler = wrap(
  async (event) => {
    // your Lambda logic
    return { statusCode: 200 }
  },
  (event, result, error) => ({
    method: 'POST',
    path: event.path ?? '/lambda',
    identifier: event.requestContext?.identity?.cognitoIdentityId ?? 'anonymous',
    status_code: error ? 500 : result?.statusCode ?? 200,
  })
)
```

> **Limitation — hard-kills:** `wrap()` guarantees audit flush via `try/finally`, so it captures handler errors and normal completions. However, **platform-level hard-kills** (OOM, SIGKILL, infrastructure timeout) terminate the Node.js process before `finally` runs — those events cannot be captured by this SDK.
>
> To detect hard-kills, use the [`@bataudit/browser`](../browser/README.md) SDK in your frontend: it records the outgoing request before the Lambda is invoked. If the backend audit never arrives, BatAudit marks it as an orphan event (`GET /v1/audit/orphans`) and the dashboard shows a banner with the count.

## Configuration

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `apiKey` | `string` | Yes | — | API Key from BatAudit dashboard |
| `serviceName` | `string` | Yes | — | Name of this service |
| `writerUrl` | `string` | Yes | — | BatAudit Writer URL |
| `environment` | `'prod' \| 'staging' \| 'dev'` | No | `'prod'` | Deployment environment |
| `captureBody` | `boolean` | No | `false` | Whether to capture request bodies |

## Request ID

The SDK automatically generates a `request_id` in the format `bat-<uuid>` and injects it in the `X-Request-ID` response header.

If the incoming request already has an `X-Request-ID` header, that value is used instead — enabling end-to-end traceability across services.
