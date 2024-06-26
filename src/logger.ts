import Koa, { Context } from 'koa'
import merge from 'lodash/merge'
import * as path from 'path'
import winston, { format, LoggerOptions, transports } from 'winston'
import { config } from './config'

export const createLogger = (options?: LoggerOptions): winston.Logger => {
  const mergedOptions = merge(
    {
      level: config.loggingLevel,
      transports: [
        //
        // - Write all logs error (and below) to `error.log`.
        new transports.File({
          filename: path.resolve(__dirname, '../error.log'),
          level: 'error',
        }),
        //
        // - Write to all logs with specified level to console.
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple(),
            format.timestamp(),
          ),
        }),
      ],
    },
    options,
  )
  return winston.createLogger(mergedOptions)
}

export const loggerMiddleware = (
  winstonInstance: winston.Logger,
): Koa.Middleware => {
  return async (ctx: Context, next: () => Promise<any>): Promise<void> => {
    const start = new Date().getTime()
    try {
      await next()
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string }
      ctx.status = error.status || 500
      ctx.body = {
        message: error.message || 'Internal Server Error',
      }
    }
    const ms = new Date().getTime() - start

    let logLevel: string
    if (ctx.status >= 500) {
      logLevel = 'error'
    } else if (ctx.status >= 400) {
      logLevel = 'warn'
    } else {
      logLevel = 'info'
    }

    const msg = `${ctx.method} ${ctx.originalUrl} ${ctx.status} ${ms}ms`

    winstonInstance.log(logLevel, msg)
  }
}

export const logger = createLogger()
