// Caching types

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
}

export interface CacheResult<T> {
  hit: boolean;
  data?: T;
  key: string;
}

export interface CacheMetadata {
  cachedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
  version?: string; // Cache version for ETag support
}

export interface CacheEntry<T> {
  data: T;
  metadata: CacheMetadata;
}

