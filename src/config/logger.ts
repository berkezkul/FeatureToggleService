import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE || 'logs/app.log';

// Ensure logs directory exists
const logDir = path.dirname(logFile);

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    // Add request ID if available
    winston.format((info: winston.Logform.TransformableInfo) => {
      if (info.requestId) {
        info.requestId = info.requestId;
      }
      return info;
    })()
  ),
  defaultMeta: { 
    service: 'feature-toggle-service',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: logFile,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

// If we're not in production, log to console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export default logger;

