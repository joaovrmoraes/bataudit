import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BatAuditBrowserClient, extractPath } from '../src/client'

const config = {
  apiKey: 'test-key',
  serviceName: 'my-spa',
  writerUrl: 'http://localhost:8081',
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  vi.stubGlobal('crypto', { randomUUID: () => '00000000-0000-0000-0000-000000000001' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('generateRequestId', () => {
  it('returns string with bat- prefix', () => {
    const client = new BatAuditBrowserClient(config)
    expect(client.generateRequestId()).toBe('bat-00000000-0000-0000-0000-000000000001')
  })
})

describe('setUser / clearUser', () => {
  it('buildEvent uses anonymous by default', () => {
    const client = new BatAuditBrowserClient(config)
    const event = client.buildEvent({ method: 'GET', path: '/test', timestamp: 't' })
    expect(event.identifier).toBe('anonymous')
  })

  it('buildEvent uses setUser identifier', () => {
    const client = new BatAuditBrowserClient(config)
    client.setUser({ identifier: 'user-42', userEmail: 'u@test.com' })
    const event = client.buildEvent({ method: 'GET', path: '/test', timestamp: 't' })
    expect(event.identifier).toBe('user-42')
    expect(event.user_email).toBe('u@test.com')
  })

  it('clearUser resets to anonymous', () => {
    const client = new BatAuditBrowserClient(config)
    client.setUser({ identifier: 'user-42' })
    client.clearUser()
    const event = client.buildEvent({ method: 'GET', path: '/test', timestamp: 't' })
    expect(event.identifier).toBe('anonymous')
  })
})

describe('buildEvent', () => {
  it('always sets source to browser', () => {
    const client = new BatAuditBrowserClient(config)
    const event = client.buildEvent({ method: 'GET', path: '/test', timestamp: 't' })
    expect(event.source).toBe('browser')
  })

  it('fills service_name and environment from config', () => {
    const client = new BatAuditBrowserClient({ ...config, environment: 'staging' })
    const event = client.buildEvent({ method: 'GET', path: '/test', timestamp: 't' })
    expect(event.service_name).toBe('my-spa')
    expect(event.environment).toBe('staging')
  })
})

describe('send + flush', () => {
  it('POSTs to /v1/audit with correct headers', async () => {
    const client = new BatAuditBrowserClient(config)
    client.send(client.buildEvent({ method: 'GET', path: '/test', timestamp: 'ts' }))
    await client.flush()

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8081/v1/audit',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'X-API-Key': 'test-key' }),
      })
    )
  })

  it('flush resolves with no pending sends', async () => {
    const client = new BatAuditBrowserClient(config)
    await expect(client.flush()).resolves.toBeUndefined()
  })
})

describe('extractPath', () => {
  it('extracts path from absolute URL', () => {
    expect(extractPath('https://api.example.com/users/42')).toBe('/users/42')
  })

  it('strips query string from relative URL', () => {
    expect(extractPath('/api/users?page=1')).toBe('/api/users')
  })

  it('strips hash from relative URL', () => {
    expect(extractPath('/page#section')).toBe('/page')
  })

  it('returns path as-is when URL is just a path', () => {
    expect(extractPath('/health')).toBe('/health')
  })
})
