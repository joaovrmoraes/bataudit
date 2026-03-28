import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLambdaWrapper } from '../src/lambda'

const config = {
  apiKey: 'test-key',
  serviceName: 'test-fn',
  writerUrl: 'http://localhost:8081',
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createLambdaWrapper', () => {
  it('returns the handler result', async () => {
    const wrap = createLambdaWrapper(config)
    const handler = wrap(async () => ({ statusCode: 200, body: 'ok' }))
    const result = await handler({})
    expect(result).toEqual({ statusCode: 200, body: 'ok' })
  })

  it('flushes audit event before returning', async () => {
    const wrap = createLambdaWrapper(config)
    const handler = wrap(async () => ({ statusCode: 200 }))
    await handler({})
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('flushes audit event even when handler throws', async () => {
    const wrap = createLambdaWrapper(config)
    const handler = wrap(async () => { throw new Error('crash') })

    await expect(handler({})).rejects.toThrow('crash')
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('sends status_code 500 when handler throws', async () => {
    const wrap = createLambdaWrapper(config)
    const handler = wrap(async () => { throw new Error('oops') })

    await expect(handler({})).rejects.toThrow()

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.status_code).toBe(500)
    expect(body.error_message).toBe('oops')
  })

  it('merges getAuditData into the event', async () => {
    const wrap = createLambdaWrapper(config)
    const handler = wrap(
      async (event: { userId: string }) => ({ statusCode: 200 }),
      (event) => ({ identifier: event.userId, path: '/my-fn' })
    )

    await handler({ userId: 'user-77' })

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.identifier).toBe('user-77')
    expect(body.path).toBe('/my-fn')
  })

  it('sends service_name from config', async () => {
    const wrap = createLambdaWrapper(config)
    const handler = wrap(async () => ({}))
    await handler({})

    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.service_name).toBe('test-fn')
  })
})
