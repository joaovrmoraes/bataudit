# BatAudit Mock App

Express app with the BatAudit SDK pre-configured. Use it to test the full SDK → Writer → Worker → Dashboard flow locally.

## Setup

```bash
cd mock-app
npm install

# Start the BatAudit stack first (if not already running)
docker compose -f ../docker-compose.demo.yml up -d

# Get an API key from the dashboard (Settings → API Keys)
export API_KEY=bat_your_key_here
export WRITER_URL=http://localhost:8081

# Start the mock server
npm start
```

The mock server starts on `http://localhost:3000`.

## Scenarios

Run each scenario independently against the running mock server:

| Command | What it does |
|---------|--------------|
| `npm run scenarios:normal` | Successful GET/POST/PUT/DELETE requests |
| `npm run scenarios:errors` | 401, 404, 500 responses to populate error metrics |
| `npm run scenarios:users`  | 5 distinct users with different roles |
| `npm run scenarios:lambda` | Lambda handler wrap — normal + crash |
| `npm run scenarios:load`   | High-volume load test (configurable) |
| `npm run scenarios:all`    | normal + errors + users in sequence |

### Load scenario options

```bash
REQUESTS=2000 CONCURRENCY=50 node scenarios/load.js
```

## Lambda limitation

The `lambda.js` scenario demonstrates `bataudit.wrap()` which guarantees audit
flush via `try/finally` even when the handler throws. However, **hard-kills by
the platform** (OOM, SIGKILL, timeout at the infrastructure level) terminate the
process before `finally` runs — those events cannot be captured by the backend
SDK. To detect them, use the browser SDK: it records the outgoing request and
the BatAudit dashboard will flag it as an orphan event if no backend audit
arrives within a matching `request_id`.
