import pino from 'pino'

/**
 * Universal logger using pino for both client and server
 * In browser, pino automatically uses console methods
 * On server, uses pino-pretty transport in development
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: typeof window === 'undefined' && process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined
})
