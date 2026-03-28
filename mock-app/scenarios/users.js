/**
 * Users scenario — multiple users with different roles to exercise the identifier
 * and user_roles fields in BatAudit.
 * Run: node scenarios/users.js
 */

const BASE = process.env.APP_URL || 'http://localhost:3000'

const users = [
  { id: 'usr_001', email: 'alice@acme.com',   name: 'Alice',   roles: ['admin', 'viewer'] },
  { id: 'usr_002', email: 'bob@acme.com',      name: 'Bob',     roles: ['viewer'] },
  { id: 'usr_003', email: 'carol@acme.com',    name: 'Carol',   roles: ['editor'] },
  { id: 'usr_004', email: 'dave@partner.io',   name: 'Dave',    roles: ['viewer'] },
  { id: 'svc_001', email: 'service@internal',  name: 'Service', roles: ['service-account'] },
]

const paths = ['/users', '/users/usr_001', '/orders', '/health']

async function run() {
  console.log('▶ Users scenario — simulating', users.length, 'distinct users...')
  for (const user of users) {
    for (const path of paths) {
      const res = await fetch(`${BASE}${path}`, {
        headers: {
          'X-User-Id':    user.id,
          'X-User-Email': user.email,
          'X-User-Name':  user.name,
        },
      })
      console.log(`  ${user.id.padEnd(10)} GET  ${path.padEnd(25)} → ${res.status}`)
    }
  }
  console.log('✓ Users scenario complete')
}

run().catch(console.error)
