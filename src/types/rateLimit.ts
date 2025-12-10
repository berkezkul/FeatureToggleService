// Rate Limiting types

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window (sustained)
  burst: number; // Burst limit (additional requests allowed)
  keyPrefix?: string; // Redis key prefix
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number; // Unix timestamp when limit resets
  retryAfter?: number; // Seconds to wait before retry
  limit: number; // Total limit (sustained + burst)
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter?: number;
}

