import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BatAuditClient } from '../src/client'

const config = {
  apiKey: 'test-key',
  serviceName: 'test-service',
  writerUrl: 'http://localhost:8081',
}

const baseEvent = {
  method: 'GET',
  path: '/test',
  status_code: 200,
  identifier: 'user-1',
  service_name: 'test-service',
  environment: 'prod',
  timestamp: '2024-01-01T00:00:00.000Z',
} as const

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateRequestId', () => {
  it('returns a string with bat- prefix', () => {
    const client = new BatAuditClient(config)
    const id = client.generateRequestId()
    expect(id).toMatch(/^bat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('generates unique IDs', () => {
    const client = new BatAuditClient(config)
    const ids = new Set(Array.from({ length: 100 }, () => client.generateRequestId()))
    expect(ids.size).toBe(100)
  })
})

describe('send + flush', () => {
  it('sends POST to /v1/audit with correct headers', async () => {
    const client = new BatAuditClient(config)
    client.send(baseEvent)
    await client.flush()

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8081/v1/audit',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-API-Key': 'test-key',
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('sends the event payload in the body', async () => {
    const client = new BatAuditClient(config)
    client.send(baseEvent)
    await client.flush()

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.method).toBe('GET')
    expect(body.path).toBe('/test')
    expect(body.identifier).toBe('user-1')
  })

  it('flush resolves even if send was never called', async () => {
    const client = new BatAuditClient(config)
    await expect(client.flush()).resolves.toBeUndefined()
  })

  it('flush waits for multiple concurrent sends', async () => {
    const client = new BatAuditClient(config)
    client.send(baseEvent)
    client.send({ ...baseEvent, path: '/other' })
    await client.flush()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('retry', () => {
  it('retries up to 3 times on network error then gives up silently', async () => {
    vi.useFakeTimers()
    const mockFetch = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', mockFetch)

    const client = new BatAuditClient(config)
    client.send(baseEvent)

    await vi.runAllTimersAsync()

    expect(mockFetch).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
    vi.useRealTimers()
  })

  it('succeeds on second attempt after initial failure', async () => {
    vi.useFakeTimers()
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    const client = new BatAuditClient(config)
    client.send(baseEvent)

    await vi.runAllTimersAsync()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
