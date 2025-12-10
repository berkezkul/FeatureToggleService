import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { generateRequestId, REQUEST_ID_HEADER } from '../utils/requestId';

// Extend Express Request to include request ID
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Request logging middleware with request ID tracking
 * Logs request start, response, and errors with correlation
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate or use existing request ID
  const requestId = (req.headers[REQUEST_ID_HEADER] as string) || generateRequestId();
  req.requestId = requestId;
  req.startTime = Date.now();

  // Set request ID in response header
  res.setHeader(REQUEST_ID_HEADER, requestId);

  // Log request start
  logger.info('Request started', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    tenantId: req.user?.tenantId || req.apiKey?.tenantId,
    userId: req.user?.userId || req.apiKey?.keyId,
  });

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    const logData = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
    };

    if (res.statusCode >= 400) {
      logger.warn('Request completed with error', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
};

