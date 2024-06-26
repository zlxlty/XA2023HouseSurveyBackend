import cors from '@koa/cors'
import 'dotenv/config'
import Koa from 'koa'
import koaBody from 'koa-body'
import 'reflect-metadata'

import { apiRouter } from './routes/api'
import { generalRouter } from './routes/general'

import * as Sentry from '@sentry/node'
import { stripUrlQueryAndFragment } from '@sentry/utils'
import LCC from 'leancloud-storage'
import LC from 'leanengine'
import { config } from './config'
import './hooks'
import { createLogger, logger, loggerMiddleware } from './logger'

Sentry.init({
  dsn: 'https://06f1866c5da04fbcbd6d1770acda0d08@sentry.mirroai.com/4',

  tracesSampleRate: 0.1,

  integrations: [...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations()],
})

const requestHandler = (
  ctx: Koa.Context,
  next: () => Promise<void>,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    Sentry.runWithAsyncContext(async () => {
      const hub = Sentry.getCurrentHub()
      hub.configureScope(scope =>
        scope.addEventProcessor(event =>
          Sentry.addRequestDataToEvent(event, ctx.request, {
            include: {
              user: false,
            },
          }),
        ),
      )

      try {
        await next()
      } catch (err) {
        reject(err)
      }
      resolve()
    })
  })
}

// this tracing middleware creates a transaction per request
const tracingMiddleWare = async (
  ctx: Koa.Context,
  next: () => Promise<void>,
): Promise<void> => {
  const reqMethod = (ctx.method || '').toUpperCase()
  const reqUrl = ctx.url && stripUrlQueryAndFragment(ctx.url)

  // connect to trace of upstream app
  let traceparentData
  if (ctx.request.get('sentry-trace')) {
    traceparentData = Sentry.extractTraceparentData(
      ctx.request.get('sentry-trace'),
    )
  }

  const transaction = Sentry.startTransaction({
    name: `${reqMethod} ${reqUrl}`,
    op: 'http.server',
    ...traceparentData,
  })

  ctx.__sentry_transaction = transaction

  // We put the transaction on the scope so users can attach children to it
  Sentry.getCurrentHub().configureScope(scope => {
    scope.setSpan(transaction)
  })

  ctx.res.on('finish', () => {
    // Push `transaction.finish` to the next event loop so open spans have a chance to finish before the transaction closes
    setImmediate(() => {
      // if using koa router, a nicer way to capture transaction using the matched route
      if (ctx._matchedRoute) {
        const mountPath = ctx.mountPath || ''
        transaction.setName(`${reqMethod} ${mountPath}${ctx._matchedRoute}`)
      }
      transaction.setHttpStatus(ctx.status)
      transaction.finish()
    })
  })

  await next()
}

LC.init({
  appId: config.leancloudAppId,
  appKey: config.leancloudAppKey,
  masterKey: config.leancloudMasterKey,
  serverURL: config.leancloudServerUrl,
} as any)

LCC.Cloud.useMasterKey()

// create connection with database
// note that its not active database connection
// TypeORM creates you connection pull to uses connections from pull on your requests
;(async () => {
  const app = new Koa()

  app.on('error', (err, ctx) => {
    Sentry.withScope(function (scope) {
      scope.addEventProcessor(function (event) {
        return Sentry.addRequestDataToEvent(event, ctx.request)
      })
      scope.setSDKProcessingMetadata({ request: ctx.request })
      Sentry.captureException(err)
    })
  })

  app.use(requestHandler)
  app.use(tracingMiddleWare)

  // Enable cors with default options
  app.use(cors())

  app.use(
    LC.koa2({
      ignoreInvalidSessionToken: true,
    }),
  )

  // Logger middleware -> use winston as logger (logging.ts with config)
  app.use(
    loggerMiddleware(
      createLogger({
        defaultMeta: {
          module: 'koa',
        },
      }),
    ),
  )

  app.use(koaBody())

  app.use(generalRouter.routes()).use(generalRouter.allowedMethods())
  app.use(apiRouter.routes()).use(apiRouter.allowedMethods())

  app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`)
  })
})()
