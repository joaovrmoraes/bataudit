import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createExpressMiddleware } from '../src/middleware/express'

const config = {
  apiKey: 'test-key',
  serviceName: 'test-service',
  writerUrl: 'http://localhost:8081',
  environment: 'dev' as const,
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    method: 'GET',
    path: '/api/users',
    ip: '1.2.3.4',
    headers: { 'user-agent': 'jest' },
    query: {},
    params: {},
    socket: { remoteAddress: '1.2.3.4' },
    bataudit: undefined,
    ...overrides,
  }
}

function makeRes(statusCode = 200) {
  const listeners: Record<string, () => void> = {}
  return {
    statusCode,
    setHeader: vi.fn(),
    on: (event: string, cb: () => void) => { listeners[event] = cb },
    emit: (event: string) => listeners[event]?.(),
  }
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createExpressMiddleware', () => {
  it('calls next()', () => {
    const middleware = createExpressMiddleware(config)
    const next = vi.fn()
    const req = makeReq()
    const res = makeRes()

    middleware(req as any, res as any, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('sets X-Request-ID header on response', () => {
    const middleware = createExpressMiddleware(config)
    const req = makeReq()
    const res = makeRes()

    middleware(req as any, res as any, vi.fn())
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.stringMatching(/^bat-/))
  })

  it('respects incoming X-Request-ID header', () => {
    const middleware = createExpressMiddleware(config)
    const req = makeReq({ headers: { 'x-request-id': 'existing-id', 'user-agent': 'test' } })
    const res = makeRes()

    middleware(req as any, res as any, vi.fn())
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'existing-id')
  })

  it('sends audit event on response finish', async () => {
    const middleware = createExpressMiddleware(config)
    const req = makeReq()
    const res = makeRes(201)

    middleware(req as any, res as any, vi.fn())
    res.emit('finish')

    await new Promise(r => setTimeout(r, 10))

    expect(fetch).toHaveBeenCalledOnce()
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.method).toBe('GET')
    expect(body.path).toBe('/api/users')
    expect(body.status_code).toBe(201)
    expect(body.identifier).toBe('anonymous')
    expect(body.environment).toBe('dev')
  })

  it('uses req.bataudit.identifier when set', async () => {
    const middleware = createExpressMiddleware(config)
    const req = makeReq({ bataudit: { identifier: 'user-42', userEmail: 'u@test.com' } })
    const res = makeRes()

    middleware(req as any, res as any, vi.fn())
    res.emit('finish')

    await new Promise(r => setTimeout(r, 10))

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.identifier).toBe('user-42')
    expect(body.user_email).toBe('u@test.com')
  })

  it('does not send request_body when captureBody is false (default)', async () => {
    const middleware = createExpressMiddleware(config)
    const req = makeReq({ body: { password: 'secret' } })
    const res = makeRes()

    middleware(req as any, res as any, vi.fn())
    res.emit('finish')

    await new Promise(r => setTimeout(r, 10))

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.request_body).toBeUndefined()
  })

  it('sends request_body when captureBody is true', async () => {
    const middleware = createExpressMiddleware({ ...config, captureBody: true })
    const req = makeReq({ body: { name: 'João' } })
    const res = makeRes()

    middleware(req as any, res as any, vi.fn())
    res.emit('finish')

    await new Promise(r => setTimeout(r, 10))

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.request_body).toEqual({ name: 'João' })
  })
})
