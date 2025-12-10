import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import logger from '../config/logger';
import { REQUEST_ID_HEADER } from '../utils/requestId';

/**
 * Enhanced error handler with request correlation and database error handling
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.requestId || req.headers[REQUEST_ID_HEADER] || 'unknown';
  
  // Set request ID in response
  res.setHeader(REQUEST_ID_HEADER, requestId as string);

  // Handle database errors
  if (err.name === 'QueryError' || err.message.includes('database') || err.message.includes('connection')) {
    logger.error('Database error:', {
      requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      code: 'DATABASE_ERROR',
    });

    const dbError = new AppError(
      'Database operation failed. Please try again later.',
      'DATABASE_ERROR',
      503
    );
    sendError(res, dbError);
    return;
  }

  // Handle Redis errors
  if (err.message.includes('redis') || err.message.includes('Redis')) {
    logger.error('Redis error:', {
      requestId,
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      code: 'REDIS_ERROR',
    });

    const redisError = new AppError(
      'Cache operation failed. Please try again later.',
      'REDIS_ERROR',
      503
    );
    sendError(res, redisError);
    return;
  }

  // Handle validation errors (from Zod)
  if (err.name === 'ZodError' || err.message.includes('validation')) {
    logger.warn('Validation error:', {
      requestId,
      error: err.message,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
    });

    const validationError = new AppError(
      err.message || 'Validation failed',
      'VALIDATION_ERROR',
      400
    );
    sendError(res, validationError);
    return;
  }

  // Handle application errors
  if (err instanceof AppError) {
    logger.warn('Application error:', {
      requestId,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      details: (err as any).details,
      isOperational: err.isOperational,
    });
    sendError(res, err);
    return;
  }

  // Handle unknown errors
  logger.error('Unhandled error:', {
    requestId,
    error: err.message,
    stack: err.stack,
    name: err.name,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
  });

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal server error occurred'
    : err.message;

  const internalError = new AppError(
    message,
    'INTERNAL_SERVER_ERROR',
    500,
    false // Not operational
  );
  sendError(res, internalError);
};

