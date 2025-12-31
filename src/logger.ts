import winston from "winston";

let logger: winston.Logger | null = null;

/**
 * Initialize the logger with the specified level
 */
export function initLogger(level: string = "info"): winston.Logger {
  logger = winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length
          ? ` ${JSON.stringify(meta)}`
          : "";
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
      })
    ),
    transports: [new winston.transports.Console()],
  });

  return logger;
}

/**
 * Get the logger instance
 */
export function getLogger(): winston.Logger {
  if (!logger) {
    return initLogger();
  }
  return logger;
}
