import { FastifyInstance } from 'fastify'
import { BatAuditClient } from '../client'
import { BatAuditConfig, BatAuditRequestData } from '../types'

declare module 'fastify' {
  interface FastifyRequest {
    bataudit?: BatAuditRequestData
  }
}

/**
 * Apply BatAudit hooks directly to a Fastify instance.
 * Must be called before routes are registered.
 *
 * @example
 * applyBatAuditPlugin(app, { apiKey: '...', serviceName: 'my-api', writerUrl: 'http://localhost:8081' })
 *
 * // Attach user context in your auth hook:
 * app.addHook('onRequest', async (request) => {
 *   request.bataudit = { identifier: request.user.id }
 * })
 */
export function applyBatAuditPlugin(fastify: FastifyInstance, config: BatAuditConfig): void {
  const client = new BatAuditClient(config)
  const environment = config.environment ?? 'prod'
  const captureBody = config.captureBody ?? false

  fastify.decorateRequest('bataudit', null)

  fastify.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-request-id']
    const requestId = typeof incoming === 'string' ? incoming : client.generateRequestId()
    ;(request as unknown as Record<string, unknown>)._batRequestId = requestId
    reply.header('X-Request-ID', requestId)
  })

  fastify.addHook('onResponse', async (request, reply) => {
    const user = request.bataudit ?? {}
    const requestId = (request as unknown as Record<string, unknown>)._batRequestId as string ?? client.generateRequestId()
    const query = (request.query ?? {}) as Record<string, unknown>
    const params = (request.params ?? {}) as Record<string, unknown>

    client.send({
      method: request.method,
      path: request.url.split('?')[0],
      status_code: reply.statusCode,
      response_time: Math.round(reply.elapsedTime),
      identifier: user.identifier ?? 'anonymous',
      user_email: user.userEmail,
      user_name: user.userName,
      user_roles: user.userRoles,
      user_type: user.userType,
      tenant_id: user.tenantId,
      ip: request.ip,
      user_agent: request.headers['user-agent'],
      request_id: requestId,
      query_params: Object.keys(query).length > 0 ? query : undefined,
      path_params: Object.keys(params).length > 0 ? params : undefined,
      request_body: captureBody ? request.body : undefined,
      service_name: config.serviceName,
      environment,
      timestamp: new Date().toISOString(),
    })
  })
}
