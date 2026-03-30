---
sidebar_position: 1
title: Node.js SDK
---

# Node.js SDK

The `@bataudit/node` SDK provides automatic HTTP audit logging for Express and Fastify applications.

## Installation

```bash
npm install @bataudit/node
# or
pnpm add @bataudit/node
```

---

## Express

```typescript
import express from 'express'
import { createExpressMiddleware } from '@bataudit/node'

const app = express()
app.use(express.json())

app.use(createExpressMiddleware({
  apiKey: 'bat_your_api_key',
  serviceName: 'my-api',
  writerUrl: 'http://localhost:8081',
  environment: 'production',
}))

app.listen(3000)
```

Every request is automatically logged after the response is sent.

### Attaching user context

The middleware reads user data from `req.bataudit`, which you set in your auth middleware:

```typescript
app.use(async (req, res, next) => {
  const user = await verifyToken(req.headers.authorization)
  if (user) {
    req.bataudit = {
      identifier: user.id,
      userEmail: user.email,
      userName: user.name,
      userRoles: user.roles,
      userType: user.type,
      tenantId: user.organizationId,
    }
  }
  next()
})
```

If `req.bataudit` is not set, `identifier` defaults to `'anonymous'`.

### Capturing request bodies

Request bodies are **not captured by default** to avoid logging sensitive data accidentally. Enable it explicitly:

```typescript
app.use(createExpressMiddleware({
  apiKey: 'bat_your_api_key',
  serviceName: 'my-api',
  writerUrl: 'http://localhost:8081',
  captureBody: true, // ← opt-in
}))
```

:::warning
BatAudit masks `password`, `secret`, `token`, and credit card patterns server-side, but review what your API accepts before enabling body capture in production.
:::

---

## Fastify

```typescript
import Fastify from 'fastify'
import { applyBatAuditPlugin } from '@bataudit/node'

const app = Fastify()

applyBatAuditPlugin(app, {
  apiKey: 'bat_your_api_key',
  serviceName: 'my-api',
  writerUrl: 'http://localhost:8081',
  environment: 'production',
})

await app.listen({ port: 3000 })
```

### Attaching user context (Fastify)

```typescript
app.addHook('onRequest', async (request) => {
  const user = await verifyToken(request.headers.authorization)
  if (user) {
    request.bataudit = {
      identifier: user.id,
      userEmail: user.email,
    }
  }
})
```

---

## Configuration

| Option | Type | Required | Default | Description |
|---|---|---|---|---|
| `apiKey` | string | ✅ | — | API key from dashboard |
| `serviceName` | string | ✅ | — | Name of this service |
| `writerUrl` | string | ✅ | — | BatAudit Writer URL |
| `environment` | string | — | `prod` | `prod`, `staging`, `dev` |
| `captureBody` | boolean | — | `false` | Capture request bodies |

---

## AWS Lambda

BatAudit sends events asynchronously in the background. In AWS Lambda, the process may be frozen before the HTTP request to the Writer completes, causing events to be lost.

**Workaround:** Await the log call explicitly at the end of the handler:

```typescript
import { BatAuditClient } from '@bataudit/node'

const client = new BatAuditClient({
  apiKey: 'bat_your_api_key',
  serviceName: 'my-lambda',
  writerUrl: 'https://your-writer-url',
})

export const handler = async (event) => {
  const result = await processEvent(event)

  // Await explicitly before Lambda freezes
  await client.send({
    path: event.path,
    method: event.httpMethod,
    status_code: result.statusCode,
    identifier: event.requestContext?.identity?.user ?? 'anonymous',
    service_name: 'my-lambda',
    environment: 'production',
    timestamp: new Date().toISOString(),
  })

  return result
}
```

---

## TypeScript types

```typescript
import type { BatAuditConfig, BatAuditRequestData, AuditEvent } from '@bataudit/node'
```
