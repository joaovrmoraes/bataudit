/**
 * Normal scenario — successful requests across methods and paths.
 * Run: node scenarios/normal.js
 */

const BASE = process.env.APP_URL || 'http://localhost:3000'

const requests = [
  { method: 'GET',    path: '/health' },
  { method: 'GET',    path: '/users' },
  { method: 'GET',    path: '/users/usr_001' },
  { method: 'POST',   path: '/users',          body: { name: 'Charlie', email: 'charlie@test.com' } },
  { method: 'PUT',    path: '/users/usr_001',   body: { name: 'Alice Updated' } },
  { method: 'DELETE', path: '/users/usr_002' },
  { method: 'GET',    path: '/orders' },
  { method: 'POST',   path: '/orders',          body: { product: 'SKU-001', qty: 2 } },
]

async function run() {
  console.log('▶ Normal scenario — sending', requests.length, 'requests...')
  for (const r of requests) {
    const opts = {
      method: r.method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'usr_001',
        'X-User-Email': 'alice@acme.com',
      },
    }
    if (r.body) opts.body = JSON.stringify(r.body)
    const res = await fetch(`${BASE}${r.path}`, opts)
    console.log(`  ${r.method.padEnd(6)} ${r.path.padEnd(30)} → ${res.status}`)
  }
  console.log('✓ Normal scenario complete')
}

run().catch(console.error)
