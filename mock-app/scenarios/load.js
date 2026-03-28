/**
 * Load scenario — configurable volume of concurrent requests to stress-test
 * the queue, worker autoscaling, and Redis throughput.
 *
 * Options (env vars):
 *   REQUESTS=500        total requests to send (default: 500)
 *   CONCURRENCY=20      parallel in-flight requests (default: 20)
 *   DELAY_MS=0          ms to wait between batches (default: 0)
 *
 * Run: node scenarios/load.js
 *      REQUESTS=2000 CONCURRENCY=50 node scenarios/load.js
 */

const BASE        = process.env.APP_URL    || 'http://localhost:3000'
const TOTAL       = parseInt(process.env.REQUESTS    || '500', 10)
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '20',  10)
const DELAY_MS    = parseInt(process.env.DELAY_MS    || '0',   10)

const paths = [
  ['GET',  '/health'],
  ['GET',  '/users'],
  ['GET',  '/users/usr_001'],
  ['POST', '/login',        { email: 'alice@acme.com', password: 'correct' }],
  ['GET',  '/orders'],
  ['GET',  '/users/ghost'],  // 404
  ['GET',  '/crash'],        // 500
]

const users = ['usr_001', 'usr_002', 'usr_003', 'usr_004', 'svc_001']

let sent = 0, ok = 0, errors = 0

async function sendOne() {
  const [method, path, body] = paths[Math.floor(Math.random() * paths.length)]
  const user = users[Math.floor(Math.random() * users.length)]
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'X-User-Id': user },
    }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${BASE}${path}`, opts)
    sent++
    res.status < 500 ? ok++ : errors++
  } catch {
    sent++
    errors++
  }
}

async function run() {
  console.log(`▶ Load scenario — ${TOTAL} requests, concurrency ${CONCURRENCY}`)
  const start = Date.now()

  for (let i = 0; i < TOTAL; i += CONCURRENCY) {
    const batch = Math.min(CONCURRENCY, TOTAL - i)
    await Promise.all(Array.from({ length: batch }, sendOne))
    if (DELAY_MS > 0) await new Promise(r => setTimeout(r, DELAY_MS))
    process.stdout.write(`\r  Progress: ${sent}/${TOTAL}  OK: ${ok}  Errors: ${errors}`)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✓ Load scenario complete — ${sent} requests in ${elapsed}s (${(sent / elapsed).toFixed(0)} req/s)`)
}

run().catch(console.error)
