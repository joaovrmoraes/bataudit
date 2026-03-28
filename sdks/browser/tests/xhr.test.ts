import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BatAuditBrowserClient } from '../src/client'
import { patchXHR } from '../src/interceptors/xhr'

const config = {
  apiKey: 'test-key',
  serviceName: 'my-spa',
  writerUrl: 'http://writer:8081',
}

let unpatch: () => void

beforeEach(() => {
  vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('aaaa-bbbb') })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => {
  unpatch?.()
  vi.unstubAllGlobals()
})

describe('patchXHR', () => {
  it('patches XMLHttpRequest.prototype.open and send', () => {
    const client = new BatAuditBrowserClient(config)
    const originalOpen = XMLHttpRequest.prototype.open
    const originalSend = XMLHttpRequest.prototype.send

    unpatch = patchXHR(client)

    expect(XMLHttpRequest.prototype.open).not.toBe(originalOpen)
    expect(XMLHttpRequest.prototype.send).not.toBe(originalSend)
  })

  it('unpatch restores original methods', () => {
    const client = new BatAuditBrowserClient(config)
    const originalOpen = XMLHttpRequest.prototype.open
    const originalSend = XMLHttpRequest.prototype.send

    unpatch = patchXHR(client)
    unpatch()

    expect(XMLHttpRequest.prototype.open).toBe(originalOpen)
    expect(XMLHttpRequest.prototype.send).toBe(originalSend)
  })

  it('stores method and url on the XHR instance via open()', () => {
    const client = new BatAuditBrowserClient(config)
    unpatch = patchXHR(client)

    const xhr = new XMLHttpRequest() as XMLHttpRequest & Record<string, unknown>
    xhr.open('POST', 'https://api.example.com/submit')

    expect(xhr._bat_method).toBe('POST')
    expect(xhr._bat_url).toBe('https://api.example.com/submit')
    expect(xhr._bat_skip).toBe(false)
  })

  it('marks Writer URL requests as skip', () => {
    const client = new BatAuditBrowserClient(config)
    unpatch = patchXHR(client)

    const xhr = new XMLHttpRequest() as XMLHttpRequest & Record<string, unknown>
    xhr.open('POST', 'http://writer:8081/v1/audit')

    expect(xhr._bat_skip).toBe(true)
  })

  it('sends audit event on loadend', () => {
    const client = new BatAuditBrowserClient(config)
    const sendSpy = vi.spyOn(client, 'send')
    unpatch = patchXHR(client)

    const xhr = new XMLHttpRequest()
    xhr.open('GET', 'https://api.example.com/items')

    // Simulate loadend manually
    const loadendListeners: EventListenerOrEventListenerObject[] = []
    const originalAddEventListener = xhr.addEventListener.bind(xhr)
    xhr.addEventListener = (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type === 'loadend') loadendListeners.push(listener)
      return originalAddEventListener(type, listener)
    }

    xhr.send()

    // Trigger loadend manually
    loadendListeners.forEach(l => {
      if (typeof l === 'function') l(new Event('loadend'))
      else l.handleEvent(new Event('loadend'))
    })

    expect(sendSpy).toHaveBeenCalledOnce()
    const event = sendSpy.mock.calls[0][0]
    expect(event.method).toBe('GET')
    expect(event.path).toBe('/items')
    expect(event.source).toBe('browser')
  })

  it('does NOT call send for Writer URL requests', () => {
    const client = new BatAuditBrowserClient(config)
    const sendSpy = vi.spyOn(client, 'send')
    unpatch = patchXHR(client)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'http://writer:8081/v1/audit')
    xhr.send()

    expect(sendSpy).not.toHaveBeenCalled()
  })
})
