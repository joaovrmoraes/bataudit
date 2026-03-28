/**
 * BatAudit Mock App
 *
 * A simple Express server with the BatAudit SDK installed.
 * Exposes realistic endpoints so you can test the full SDK → Writer → Worker → Dashboard flow.
 *
 * Usage:
 *   API_KEY=<your-key> WRITER_URL=http://localhost:8081 node server.js
 */

const express = require('express')
const { createExpressMiddleware } = require('@bataudit/node')

const app = express()
app.use(express.json())

const apiKey = process.env.API_KEY || 'bat_demo_key'
const writerUrl = process.env.WRITER_URL || 'http://localhost:8081'
const port = parseInt(process.env.PORT || '3000', 10)

// Attach BatAudit middleware — captures every request automatically.
app.use(
  createExpressMiddleware({
    apiKey,
    serviceName: 'mock-app',
    writerUrl,
    getUser: (req) => ({
      identifier: req.headers['x-user-id'] || 'anonymous',
      userEmail: req.headers['x-user-email'] || undefined,
      userName: req.headers['x-user-name'] || undefined,
    }),
  })
)

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.get('/users', (_req, res) =>
  res.json([
    { id: 'usr_001', name: 'Alice' },
    { id: 'usr_002', name: 'Bob' },
  ])
)

app.get('/users/:id', (req, res) => {
  const users = { usr_001: { id: 'usr_001', name: 'Alice' }, usr_002: { id: 'usr_002', name: 'Bob' } }
  const user = users[req.params.id]
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(user)
})

app.post('/users', (req, res) => res.status(201).json({ id: 'usr_new', ...req.body }))

app.put('/users/:id', (req, res) => res.json({ id: req.params.id, ...req.body }))

app.delete('/users/:id', (req, res) => res.status(204).send())

app.post('/login', (req, res) => {
  if (req.body.password === 'wrong') return res.status(401).json({ error: 'Invalid credentials' })
  res.json({ token: 'mock-jwt-token', userId: 'usr_001' })
})

app.get('/orders', (_req, res) => res.json([{ id: 'ord_001', total: 99.99 }]))

app.post('/orders', (_req, res) => res.status(201).json({ id: 'ord_new', status: 'pending' }))

// Intentionally broken endpoint — always 500
app.get('/crash', (_req, _res) => {
  throw new Error('Intentional crash for testing')
})

// Error handler so 500 is returned instead of crashing Express
app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message })
})

app.listen(port, () => {
  console.log(`Mock app listening on http://localhost:${port}`)
  console.log(`  Writer URL: ${writerUrl}`)
  console.log(`  API Key:    ${apiKey.slice(0, 8)}...`)
})
