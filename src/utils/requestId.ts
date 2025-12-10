import { randomUUID } from 'crypto';

/**
 * Generate unique request ID for request tracking
 */
export const generateRequestId = (): string => {
  return randomUUID();
};

/**
 * Request ID middleware - adds request ID to all requests
 */
export const REQUEST_ID_HEADER = 'x-request-id';

