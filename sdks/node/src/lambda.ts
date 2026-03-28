import { BatAuditClient } from './client'
import { AuditEvent, BatAuditConfig } from './types'

/**
 * Lambda wrapper for BatAudit. Guarantees flush before the function exits.
 *
 * @example
 * const wrap = createLambdaWrapper({ apiKey: '...', serviceName: 'my-fn', writerUrl: '...' })
 *
 * export const handler = wrap(
 *   async (event) => { return { statusCode: 200 } },
 *   (lambdaEvent, result, error) => ({
 *     method: 'POST',
 *     path: lambdaEvent.path ?? '/lambda',
 *     identifier: lambdaEvent.requestContext?.identity?.cognitoIdentityId ?? 'anonymous',
 *     status_code: error ? 500 : result?.statusCode ?? 200,
 *   })
 * )
 */
export function createLambdaWrapper(config: BatAuditConfig) {
  const client = new BatAuditClient(config)
  const environment = config.environment ?? 'prod'

  return function wrap<TEvent, TResult>(
    handler: (event: TEvent) => Promise<TResult>,
    getAuditData?: (event: TEvent, result: TResult | null, error: unknown) => Partial<AuditEvent>
  ): (event: TEvent) => Promise<TResult> {
    return async (lambdaEvent: TEvent): Promise<TResult> => {
      const startTime = Date.now()
      let result: TResult | null = null
      let handlerError: unknown = null

      try {
        result = await handler(lambdaEvent)
        return result
      } catch (err) {
        handlerError = err
        throw err
      } finally {
        const auditData = getAuditData?.(lambdaEvent, result, handlerError) ?? {}

        client.send({
          method: 'POST',
          path: '/lambda',
          status_code: handlerError ? 500 : 200,
          response_time: Date.now() - startTime,
          identifier: 'anonymous',
          service_name: config.serviceName,
          environment,
          timestamp: new Date().toISOString(),
          error_message: handlerError instanceof Error ? handlerError.message : undefined,
          ...auditData,
        })

        await client.flush()
      }
    }
  }
}
