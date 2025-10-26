/**
 * Logger utility using Winston
 */

import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, ...meta } = info as Record<string, unknown>;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${String(timestamp)} [${String(service)}] ${String(level)}: ${String(message)} ${metaStr}`;
  })
);

export function createLogger(service: string): winston.Logger {
  return winston.createLogger({
    level: config.server.nodeEnv === 'production' ? 'info' : 'debug',
    format: logFormat,
    defaultMeta: { service },
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
      }),
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
      }),
      new winston.transports.File({
        filename: 'logs/combined.log',
      }),
    ],
  });
}

export const logger = createLogger('CodeDiffusion');
