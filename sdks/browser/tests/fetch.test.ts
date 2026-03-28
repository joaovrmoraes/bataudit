import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BatAuditBrowserClient } from '../src/client'
import { patchFetch } from '../src/interceptors/fetch'

const config = {
  apiKey: 'test-key',
  serviceName: 'my-spa',
  writerUrl: 'http://writer:8081',
}

let unpatch: () => void
let mockFetch: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('aaaa-bbbb') })
  mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  unpatch?.()
  vi.unstubAllGlobals()
})

describe('patchFetch', () => {
  it('replaces globalThis.fetch', () => {
    const client = new BatAuditBrowserClient(config)
    const original = globalThis.fetch
    unpatch = patchFetch(client)
    expect(globalThis.fetch).not.toBe(original)
  })

  it('unpatch restores original fetch', () => {
    const client = new BatAuditBrowserClient(config)
    const original = globalThis.fetch
    unpatch = patchFetch(client)
    unpatch()
    expect(globalThis.fetch).toBe(original)
  })

  it('forwards the request and returns the response', async () => {
    const client = new BatAuditBrowserClient(config)
    unpatch = patchFetch(client)

    const res = await globalThis.fetch('https://api.example.com/users')
    expect(res).toEqual({ ok: true, status: 200 })
    // mockFetch called at least once for the app request (+ possibly once for writer send)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/users',
      expect.anything()
    )
  })

  it('injects X-Request-ID into outgoing request', async () => {
    const client = new BatAuditBrowserClient(config)
    unpatch = patchFetch(client)

    await globalThis.fetch('https://api.example.com/users')

    const [, options] = mockFetch.mock.calls[0]
    const headers = options.headers as Headers
    expect(headers.get('X-Request-ID')).toBeTruthy()
  })

  it('respects existing X-Request-ID header', async () => {
    const client = new BatAuditBrowserClient(config)
    unpatch = patchFetch(client)

    await globalThis.fetch('https://api.example.com/users', {
      headers: { 'X-Request-ID': 'existing-id' },
    })

    const [, options] = mockFetch.mock.calls[0]
    const headers = options.headers as Headers
    expect(headers.get('X-Request-ID')).toBe('existing-id')
  })

  it('does NOT intercept requests to the Writer URL', async () => {
    const sendSpy = vi.fn()
    const client = new BatAuditBrowserClient(config)
    client.send = sendSpy
    unpatch = patchFetch(client)

    await globalThis.fetch('http://writer:8081/v1/audit')

    // fetch called once (the writer request), send never called
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('sends audit event after response', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, status: 200 }) // app request
      .mockResolvedValue({ ok: true })                  // writer send

    const client = new BatAuditBrowserClient(config)
    const sendSpy = vi.spyOn(client, 'send')
    unpatch = patchFetch(client)

    await globalThis.fetch('https://api.example.com/data')

    expect(sendSpy).toHaveBeenCalledOnce()
    const event = sendSpy.mock.calls[0][0]
    expect(event.method).toBe('GET')
    expect(event.path).toBe('/data')
    expect(event.status_code).toBe(200)
    expect(event.source).toBe('browser')
  })
})
