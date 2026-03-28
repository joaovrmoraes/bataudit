import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import { applyBatAuditPlugin } from '../src/middleware/fastify'

const config = {
  apiKey: 'test-key',
  serviceName: 'test-service',
  writerUrl: 'http://localhost:8081',
  environment: 'dev' as const,
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function buildApp(captureBody = false) {
  const app = Fastify()
  applyBatAuditPlugin(app, { ...config, captureBody })
  app.get('/ping', async () => ({ ok: true }))
  app.post('/data', async (req) => {
    req.bataudit = { identifier: 'user-99', userEmail: 'u@test.com' }
    return { received: true }
  })
  await app.ready()
  return app
}

describe('applyBatAuditPlugin', () => {
  it('sets X-Request-ID header on response', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/ping' })
    expect(res.headers['x-request-id']).toMatch(/^bat-/)
  })

  it('respects incoming X-Request-ID header', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/ping',
      headers: { 'x-request-id': 'my-trace-id' },
    })
    expect(res.headers['x-request-id']).toBe('my-trace-id')
  })

  it('sends audit event after response', async () => {
    const app = await buildApp()
    await app.inject({ method: 'GET', url: '/ping' })

    await new Promise(r => setTimeout(r, 20))

    expect(fetch).toHaveBeenCalledOnce()
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.method).toBe('GET')
    expect(body.path).toBe('/ping')
    expect(body.status_code).toBe(200)
    expect(body.service_name).toBe('test-service')
  })

  it('captures request.bataudit user context', async () => {
    const app = await buildApp()
    await app.inject({ method: 'POST', url: '/data', payload: {} })

    await new Promise(r => setTimeout(r, 20))

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.identifier).toBe('user-99')
    expect(body.user_email).toBe('u@test.com')
  })

  it('does not capture body by default', async () => {
    const app = await buildApp(false)
    await app.inject({ method: 'POST', url: '/data', payload: { secret: 'value' } })

    await new Promise(r => setTimeout(r, 20))

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.request_body).toBeUndefined()
  })

  it('captures body when captureBody is true', async () => {
    const app = await buildApp(true)
    await app.inject({ method: 'POST', url: '/data', payload: { name: 'test' } })

    await new Promise(r => setTimeout(r, 20))

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.request_body).toEqual({ name: 'test' })
  })
})
