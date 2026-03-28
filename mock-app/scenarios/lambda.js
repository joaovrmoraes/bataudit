/**
 * Lambda scenario — simulates a serverless handler using bataudit.wrap().
 * One handler completes normally; another simulates a crash mid-execution.
 *
 * Limitation: hard-kills via OOM or platform timeout (SIGKILL) cannot be
 * captured by the backend SDK — the process is terminated before try/finally
 * runs. The browser SDK can detect these as orphan events if it tracks the
 * request before the Lambda is invoked.
 *
 * Run: node scenarios/lambda.js
 */

const { createLambdaWrapper } = require('@bataudit/node')

const apiKey   = process.env.API_KEY   || 'bat_demo_key'
const writerUrl = process.env.WRITER_URL || 'http://localhost:8081'

const wrap = createLambdaWrapper({ apiKey, serviceName: 'mock-lambda', writerUrl })

// ── Handler 1: normal completion ─────────────────────────────────────────────

const normalHandler = wrap(
  async (event) => {
    console.log('Lambda handler 1: processing event', event.id)
    await new Promise(r => setTimeout(r, 50))
    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  },
  (event) => ({
    identifier: event.userId || 'lambda-user',
    path: '/lambda/normal',
    method: 'POST',
  })
)

// ── Handler 2: crash after partial execution ──────────────────────────────────
// try/finally in wrap() guarantees the audit is sent even when an error is thrown.

const crashHandler = wrap(
  async (_event) => {
    console.log('Lambda handler 2: about to crash...')
    await new Promise(r => setTimeout(r, 20))
    throw new Error('Simulated Lambda handler crash')
  },
  (event) => ({
    identifier: event.userId || 'lambda-user',
    path: '/lambda/crash',
    method: 'POST',
  })
)

// ── Run both ──────────────────────────────────────────────────────────────────

async function run() {
  console.log('▶ Lambda scenario — invoking two handlers...')

  console.log('\n  Invoking normalHandler...')
  const result = await normalHandler({ id: 'evt-001', userId: 'usr_001' })
  console.log('  Result:', result)

  console.log('\n  Invoking crashHandler (expect caught error)...')
  try {
    await crashHandler({ id: 'evt-002', userId: 'usr_002' })
  } catch (err) {
    console.log('  Caught expected error:', err.message)
  }

  // Give async audit flush a moment to complete.
  await new Promise(r => setTimeout(r, 300))
  console.log('\n✓ Lambda scenario complete — check BatAudit for 2 events from mock-lambda')
}

run().catch(console.error)
