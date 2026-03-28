/**
 * Errors scenario — 400s, 422s, 500s to populate the error rate metrics.
 * Run: node scenarios/errors.js
 */

const BASE = process.env.APP_URL || 'http://localhost:3000'

const requests = [
  // 404s
  { method: 'GET',  path: '/users/not-found-id' },
  { method: 'GET',  path: '/users/also-not-found' },
  // 401
  { method: 'POST', path: '/login', body: { email: 'x@x.com', password: 'wrong' } },
  { method: 'POST', path: '/login', body: { email: 'y@y.com', password: 'wrong' } },
  // 500
  { method: 'GET',  path: '/crash' },
  { method: 'GET',  path: '/crash' },
  { method: 'GET',  path: '/crash' },
]

async function run() {
  console.log('▶ Errors scenario — sending', requests.length, 'requests (expect errors)...')
  for (const r of requests) {
    try {
      const opts = {
        method: r.method,
        headers: { 'Content-Type': 'application/json', 'X-User-Id': 'usr_002' },
      }
      if (r.body) opts.body = JSON.stringify(r.body)
      const res = await fetch(`${BASE}${r.path}`, opts)
      console.log(`  ${r.method.padEnd(6)} ${r.path.padEnd(30)} → ${res.status}`)
    } catch (err) {
      console.log(`  ${r.method.padEnd(6)} ${r.path.padEnd(30)} → network error: ${err.message}`)
    }
  }
  console.log('✓ Errors scenario complete')
}

run().catch(console.error)
