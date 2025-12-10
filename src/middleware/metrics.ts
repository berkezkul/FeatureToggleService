import { Request, Response, NextFunction } from 'express';
import { metrics, METRIC_NAMES } from '../utils/metrics';

/**
 * Metrics collection middleware
 * Tracks request counts, durations, and errors
 */
export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Track request start
  metrics.increment(METRIC_NAMES.HTTP_REQUESTS_TOTAL, {
    method: req.method,
    path: req.path,
    status: 'pending',
  });

  // Capture response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode.toString();
    const statusClass = `${Math.floor(res.statusCode / 100)}xx`;

    // Track request completion
    metrics.increment(METRIC_NAMES.HTTP_REQUESTS_TOTAL, {
      method: req.method,
      path: req.path,
      status: statusCode,
      status_class: statusClass,
    });

    // Track request duration
    metrics.observe(METRIC_NAMES.HTTP_REQUEST_DURATION_MS, duration, {
      method: req.method,
      path: req.path,
      status: statusCode,
    });

    // Track errors
    if (res.statusCode >= 400) {
      metrics.increment(METRIC_NAMES.ERRORS_TOTAL, {
        method: req.method,
        path: req.path,
        status: statusCode,
        error_type: res.statusCode >= 500 ? 'server_error' : 'client_error',
      });
    }
  });

  next();
};

