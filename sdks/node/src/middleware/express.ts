import { Request, Response, NextFunction, RequestHandler } from 'express'
import { BatAuditClient } from '../client'
import { BatAuditConfig, BatAuditRequestData } from '../types'

declare global {
  namespace Express {
    interface Request {
      bataudit?: BatAuditRequestData
    }
  }
}

/**
 * Express middleware for BatAudit.
 *
 * @example
 * app.use(createExpressMiddleware({ apiKey: '...', serviceName: 'my-api', writerUrl: 'http://localhost:8081' }))
 *
 * // Attach user context in your auth middleware:
 * req.bataudit = { identifier: req.user.id, userEmail: req.user.email }
 */
export function createExpressMiddleware(config: BatAuditConfig): RequestHandler {
  const client = new BatAuditClient(config)
  const environment = config.environment ?? 'prod'
  const captureBody = config.captureBody ?? false

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now()

    const incoming = req.headers['x-request-id']
    const requestId = typeof incoming === 'string' ? incoming : client.generateRequestId()
    res.setHeader('X-Request-ID', requestId)

    res.on('finish', () => {
      const user = req.bataudit ?? {}

      client.send({
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        response_time: Date.now() - startTime,
        identifier: user.identifier ?? 'anonymous',
        user_email: user.userEmail,
        user_name: user.userName,
        user_roles: user.userRoles,
        user_type: user.userType,
        tenant_id: user.tenantId,
        ip: req.ip ?? req.socket?.remoteAddress,
        user_agent: req.headers['user-agent'],
        request_id: requestId,
        query_params: Object.keys(req.query).length > 0 ? (req.query as Record<string, unknown>) : undefined,
        path_params: Object.keys(req.params).length > 0 ? req.params : undefined,
        request_body: captureBody ? req.body : undefined,
        service_name: config.serviceName,
        environment,
        timestamp: new Date().toISOString(),
      })
    })

    next()
  }
}
